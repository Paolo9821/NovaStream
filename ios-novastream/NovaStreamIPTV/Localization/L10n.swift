import Foundation

/// In-app language, as on Android: the viewer can pick one of eight languages
/// regardless of the phone's language. English text is the key.
nonisolated enum Lang: String, Codable, CaseIterable, Sendable {
    case en, it, es, fr, de, pt, ro, tr

    nonisolated(unsafe) static var current: Lang = .deviceDefault

    static var deviceDefault: Lang {
        let code = Locale.preferredLanguages.first.map { String($0.prefix(2)) } ?? "en"
        let lang = Lang(rawValue: code) ?? .en
        return available.contains(lang) ? lang : .en
    }

    /// Languages with a translation table (the others appear once translated).
    static var available: [Lang] { allCases.filter { $0 == .en || !$0.table.isEmpty } }

    var nativeName: String {
        switch self {
        case .en: "English"
        case .it: "Italiano"
        case .es: "Español"
        case .fr: "Français"
        case .de: "Deutsch"
        case .pt: "Português"
        case .ro: "Română"
        case .tr: "Türkçe"
        }
    }

    var locale: Locale { Locale(identifier: rawValue) }

    fileprivate var table: [String: String] {
        switch self {
        case .en: [:]
        case .it: Strings.it
        case .es: Strings.es
        case .fr: Strings.fr
        case .de: Strings.de
        case .pt: Strings.pt
        case .ro: Strings.ro
        case .tr: Strings.tr
        }
    }
}

/// Translates an English string into the chosen language.
nonisolated func t(_ key: String) -> String {
    Lang.current.table[key] ?? key
}

/// Translates and formats (`%d`, `%@`).
nonisolated func t(_ key: String, _ args: CVarArg...) -> String {
    String(format: t(key), locale: Lang.current.locale, arguments: args)
}

nonisolated enum Strings {}
