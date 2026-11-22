import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(LicenseManager.self) private var license

    var body: some View {
        @Bindable var model = model
        Group {
            if !model.settings.onboardingDone || !model.settings.termsAccepted {
                OnboardingView()
                    .transition(.opacity)
            } else if !license.isUnlocked {
                PaywallView(blocking: true)
                    .transition(.opacity)
            } else {
                MainTabs()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model.settings.onboardingDone)
        .animation(.easeInOut(duration: 0.3), value: license.isUnlocked)
        #if DEBUG && targetEnvironment(simulator)
        .overlay(alignment: .topLeading) {
            if ScreenshotMode.isActive {
                VStack(spacing: 0) {
                    Color.clear.frame(width: 2, height: 2)
                        .accessibilityElement()
                        .accessibilityIdentifier("rork.screenshot.ready.app-store")
                        .allowsHitTesting(false)
                    if ScreenshotMode.target == "paywall", !license.isUnlocked {
                        ScreenshotMarker(label: "rork.screenshot.target.paywall")
                    }
                }
            }
        }
        #endif
        .fullScreenCover(item: $model.playback) { request in
            PlayerView(request: request)
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model
    @State private var tab = 0
    @State private var moviesPath = NavigationPath()
    @State private var seriesPath = NavigationPath()

    init() {
        #if DEBUG && targetEnvironment(simulator)
        let target = ScreenshotMode.target
        _tab = State(initialValue: ScreenshotMode.tab(for: target))
        if target == "detail" {
            var path = NavigationPath()
            path.append(Route.detail(Self.screenshotEntry("series_1")))
            _tab = State(initialValue: 3)
            _seriesPath = State(initialValue: path)
        }
        #endif
    }

    var body: some View {
        TabView(selection: $tab) {
            Tab(t("Home"), systemImage: "house.fill", value: 0) {
                NavigationStack { HomeView().novaDestinations() }
            }
            Tab(MediaKind.live.title, systemImage: MediaKind.live.symbol, value: 1) {
                NavigationStack { LiveView().novaDestinations() }
            }
            Tab(MediaKind.movie.title, systemImage: MediaKind.movie.symbol, value: 2) {
                NavigationStack(path: $moviesPath) { CatalogView(kind: .movie).novaDestinations() }
            }
            Tab(MediaKind.series.title, systemImage: MediaKind.series.symbol, value: 3) {
                NavigationStack(path: $seriesPath) { CatalogView(kind: .series).novaDestinations() }
            }
            Tab(t("Search"), systemImage: "magnifyingglass", value: 4, role: .search) {
                NavigationStack { SearchView().novaDestinations() }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        #if DEBUG && targetEnvironment(simulator)
        .overlay(alignment: .topLeading) {
            if let target = ScreenshotMode.target, ["home", "live", "movies", "series", "detail"].contains(target) {
                ScreenshotMarker(label: "rork.screenshot.target.\(target)")
            }
        }
        #endif
    }

    #if DEBUG && targetEnvironment(simulator)
    /// Placeholder entry; DetailView reads the live catalog by id.
    private static func screenshotEntry(_ id: String) -> MediaEntry {
        MediaEntry(id: id, title: "Midnight Lab", kind: .series, group: "Sci-Fi", logoUrl: ScreenshotMode.poster("demo_midnight_lab"), year: 2025, plot: "A night-shift research team discovers their experiment is answering back.", genres: ["Sci-Fi"], quality: "HD", seriesId: "demo-series-1")
    }
    #endif
}

/// Shared navigation destinations.
enum Route: Hashable {
    case detail(MediaEntry)
    case accounts
    case settings
    case group(MediaKind, String)
}

extension View {
    func novaDestinations() -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .detail(let entry): DetailView(entry: entry)
            case .accounts: AccountsView()
            case .settings: SettingsView()
            case .group(let kind, let group):
                kind == .live ? AnyView(LiveView(initialGroup: group)) : AnyView(CatalogView(kind: kind, initialGroup: group))
            }
        }
    }
}
