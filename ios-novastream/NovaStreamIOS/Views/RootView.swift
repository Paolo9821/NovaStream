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
        .fullScreenCover(item: $model.playback) { request in
            PlayerView(request: request)
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        TabView {
            Tab(t("Home"), systemImage: "house.fill") {
                NavigationStack { HomeView().novaDestinations() }
            }
            Tab(MediaKind.live.title, systemImage: MediaKind.live.symbol) {
                NavigationStack { LiveView().novaDestinations() }
            }
            Tab(MediaKind.movie.title, systemImage: MediaKind.movie.symbol) {
                NavigationStack { CatalogView(kind: .movie).novaDestinations() }
            }
            Tab(MediaKind.series.title, systemImage: MediaKind.series.symbol) {
                NavigationStack { CatalogView(kind: .series).novaDestinations() }
            }
            Tab(t("Search"), systemImage: "magnifyingglass", role: .search) {
                NavigationStack { SearchView().novaDestinations() }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
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
