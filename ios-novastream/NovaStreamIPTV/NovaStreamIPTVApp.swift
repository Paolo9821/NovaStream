import SwiftUI

@main
struct NovaStreamIPTVApp: App {
    @State private var model: AppModel
    @State private var license: LicenseManager
    @Environment(\.scenePhase) private var scenePhase

    init() {
        EncryptedDNS.configure()
        let model = AppModel()
        let license = LicenseManager()
        #if DEBUG && targetEnvironment(simulator)
        ScreenshotMode.bootstrap(model: model, license: license)
        #endif
        _model = State(initialValue: model)
        _license = State(initialValue: license)
    }

    /// True only for App Store screenshot captures in a Debug simulator build.
    private var screenshotFixture: Bool {
        #if DEBUG && targetEnvironment(simulator)
        if ScreenshotMode.isActive { return true }
        #endif
        return false
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(license)
                .tint(Nova.blue)
                .preferredColorScheme(colorScheme)
                .id(model.settings.language)
                .task {
                    if screenshotFixture { return }
                    await license.start()
                }
                .task {
                    if screenshotFixture { return }
                    await model.pushWebState()
                    await model.autoRefreshIfNeeded()
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .background:
                        model.parentalUnlocked = false
                    case .active:
                        if screenshotFixture { return }
                        Task {
                            await license.refresh()
                            await model.pushWebState()
                        }
                    default: break
                    }
                }
        }
    }

    private var colorScheme: ColorScheme? {
        switch model.settings.theme {
        case .dark: .dark
        case .light: .light
        case .system: nil
        }
    }
}
