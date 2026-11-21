import Foundation

nonisolated enum ThemeMode: String, Codable, CaseIterable, Sendable {
    case dark, light, system
    var label: String {
        switch self {
        case .dark: t("Dark")
        case .light: t("Light")
        case .system: t("Automatic")
        }
    }
}

nonisolated enum AutoRefresh: String, Codable, CaseIterable, Sendable {
    case off, daily, weekly
    var label: String {
        switch self {
        case .off: t("Off")
        case .daily: t("Every day")
        case .weekly: t("Every week")
        }
    }
    var interval: TimeInterval? {
        switch self {
        case .off: nil
        case .daily: 86_400
        case .weekly: 7 * 86_400
        }
    }
}

nonisolated enum BufferMode: String, Codable, CaseIterable, Sendable {
    case auto, small, large
    var label: String {
        switch self {
        case .auto: t("Automatic")
        case .small: t("Low latency")
        case .large: t("Stable (large buffer)")
        }
    }
    var seconds: Double {
        switch self {
        case .auto: 0
        case .small: 4
        case .large: 30
        }
    }
}

nonisolated struct AppSettings: Codable, Sendable, Equatable {
    var theme: ThemeMode = .dark
    var language: Lang = Lang.deviceDefault
    var sort: SortOption = .providerDefault
    var autoplayNext = true
    var autoReconnect = true
    var buffer: BufferMode = .auto
    var autoRefresh: AutoRefresh = .daily
    var parentalEnabled = false
    var parentalPin = ""
    var lockedGroups: [String] = []
    var hideLockedGroups = false
    var onboardingDone = false
    var termsAccepted = false

    private static let key = "app_settings"

    static func load() -> AppSettings {
        guard let data = UserDefaults.standard.data(forKey: key),
              let s = try? JSONDecoder().decode(AppSettings.self, from: data) else { return AppSettings() }
        return s
    }

    func save() {
        UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: Self.key)
    }

    /// Typical adult category words, locked automatically when parental control is turned on.
    static let adultHints = ["xxx", "adult", "adulti", "18+", "porn", "erotic"]
}
