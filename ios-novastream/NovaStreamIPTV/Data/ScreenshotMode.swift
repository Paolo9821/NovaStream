import SwiftUI

#if DEBUG && targetEnvironment(simulator)
/// App Store screenshot fixtures. Compiled only into Debug simulator builds.
enum ScreenshotMode {
    static var isActive: Bool {
        UserDefaults.standard.string(forKey: "RORK_SCREENSHOT_SCENARIO") == "app-store"
    }

    /// Requested screen, read fresh each time from the launch arguments.
    static var target: String? {
        guard isActive else { return nil }
        return UserDefaults.standard.string(forKey: "RORK_SCREENSHOT_TARGET")
    }

    nonisolated static func poster(_ name: String) -> String? {
        Bundle.main.url(forResource: name, withExtension: "jpg")?.absoluteString
    }

    /// Seeds both models once, before the first view renders.
    static func bootstrap(model: AppModel, license: LicenseManager) {
        guard isActive else { return }
        model.seedScreenshotData()
        license.seedScreenshotAccess(paywall: target == "paywall")
    }

    static func tab(for target: String?) -> Int {
        if target == "live" { return 1 }
        if target == "movies" { return 2 }
        if target == "series" { return 3 }
        return 0
    }
}

/// Invisible marker telling the capture tool a target is on screen.
struct ScreenshotMarker: View {
    let label: String
    var body: some View {
        Color.clear.frame(width: 2, height: 2)
            .accessibilityElement()
            .accessibilityLabel(label)
            .allowsHitTesting(false)
    }
}
#endif
