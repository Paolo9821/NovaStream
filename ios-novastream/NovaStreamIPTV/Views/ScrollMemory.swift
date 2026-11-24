import Foundation

/// Remembers where each list was left (per playlist, section and category), so
/// Live, Movies and Series reopen on the same row after the player, a detail
/// page, a category switch or a pushed category screen. Kept for the session.
final class ScrollMemory {
    static let shared = ScrollMemory()
    private var spots: [String: String] = [:]

    static func key(account: String?, kind: MediaKind, group: String) -> String {
        "\(account ?? "-")|\(kind.rawValue)|\(group)"
    }

    func spot(_ key: String) -> String? { spots[key] }

    func save(_ id: String?, for key: String) {
        spots[key] = id
    }
}

/// Rows of a `List` currently on screen, with their position in the list.
/// A plain reference type, so scrolling does not redraw the list.
final class VisibleRows {
    private var rows: [String: Int] = [:]

    func appeared(_ id: String, at index: Int) { rows[id] = index }
    func disappeared(_ id: String) { rows[id] = nil }
    func reset() { rows = [:] }

    /// The topmost row on screen.
    var top: String? { rows.min { $0.value < $1.value }?.key }
}
