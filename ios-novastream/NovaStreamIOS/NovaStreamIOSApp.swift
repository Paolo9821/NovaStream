import SwiftUI

@main
struct NovaStreamIOSApp: App {
    @State private var model = AppModel()
    @State private var license = LicenseManager()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(license)
                .tint(Nova.blue)
                .preferredColorScheme(colorScheme)
                .id(model.settings.language)
                .task { await license.start() }
                .task {
                    await model.pushWebState()
                    await model.autoRefreshIfNeeded()
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .background:
                        model.parentalUnlocked = false
                    case .active:
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
