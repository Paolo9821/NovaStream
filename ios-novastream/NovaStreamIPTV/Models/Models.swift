import Foundation

nonisolated enum AccountType: String, Codable, Sendable {
    case m3u, xtream
}

/// A saved provider account. Credentials only ever live in the Keychain.
nonisolated struct PlaylistAccount: Codable, Identifiable, Hashable, Sendable {
    var id: String = UUID().uuidString
    var name: String
    var type: AccountType
    var m3uUrl: String = ""
    var server: String = ""
    var username: String = ""
    var password: String = ""
    var epgUrl: String = ""
    var lastSync: Date? = nil
    /// Guide announced by the playlist itself (`url-tvg`).
    var playlistEpgUrl: String = ""
    /// Set when the playlist was sent from the website.
    var fromWeb: Bool = false
    /// Private host number. The server it stands for is saved in `server`
    /// but never shown; it is looked up again before each update.
    var hostNumber: String? = nil

    var isPrivateHost: Bool { !(hostNumber ?? "").isEmpty }

    var typeLabel: String { type == .xtream ? "Xtream" : "m3u" }

    var effectiveEpgUrl: String {
        if !epgUrl.isEmpty { return epgUrl }
        if !playlistEpgUrl.isEmpty { return playlistEpgUrl }
        if type == .xtream, !server.isEmpty {
            return "\(XtreamClient.base(server))/xmltv.php?username=\(username.urlQueryEncoded)&password=\(password.urlQueryEncoded)"
        }
        return ""
    }

    var host: String {
        if isPrivateHost { return "Host \(hostNumber ?? "")" }
        let raw = type == .xtream ? server : m3uUrl
        return URL(string: raw.hasPrefix("http") ? raw : "http://\(raw)")?.host ?? ""
    }
}

nonisolated enum MediaKind: String, Codable, Sendable, CaseIterable, Hashable {
    case live, movie, series
}

/// One playable item (channel, film or series) imported from the provider.
nonisolated struct MediaEntry: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var kind: MediaKind
    var group: String
    var logoUrl: String?
    var streamUrl: String = ""
    var year: Int?
    var providerOrder: Int = 0
    var added: Double = 0
    var plot: String?
    var genres: [String] = []
    var quality: String?
    var seriesId: String?
    var tvgId: String?
    var extraGroups: [String] = []

    func inGroup(_ name: String) -> Bool { group == name || extraGroups.contains(name) }
}

nonisolated struct MediaDetails: Codable, Sendable, Hashable {
    var plot: String?
    var genres: [String] = []
    var cast: [String] = []
    var director: String?
    var rating: String?
    var duration: String?
    var releaseDate: String?
    var country: String?
    var coverUrl: String?
    var backdropUrl: String?
}

nonisolated struct Episode: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var season: Int
    var number: Int
    var streamUrl: String
    var plot: String?
    var thumbUrl: String?
}

nonisolated struct Catalog: Codable, Sendable {
    var accountId: String = ""
    var entries: [MediaEntry] = []
    var synced: Date = .distantPast
    var groupOrder: [String: [String]] = [:]
    var m3uEpisodes: [String: [Episode]] = [:]

    func of(_ kind: MediaKind) -> [MediaEntry] { entries.filter { $0.kind == kind } }

    /// Categories of [items] in the provider's own order.
    func orderedGroups(_ kind: MediaKind, items: [MediaEntry]) -> [String] {
        var present: [String] = []
        var seen = Set<String>()
        for entry in items.sorted(by: { $0.providerOrder < $1.providerOrder }) {
            for g in [entry.group] + entry.extraGroups where seen.insert(g).inserted {
                present.append(g)
            }
        }
        let declared = groupOrder[kind.rawValue] ?? []
        guard !declared.isEmpty else { return present }
        var remaining = Set(present)
        var result: [String] = []
        for g in declared where remaining.remove(g) != nil { result.append(g) }
        result += present.filter { remaining.contains($0) }
        return result
    }
}

nonisolated struct Programme: Codable, Hashable, Sendable {
    var title: String
    var start: Double
    var stop: Double
    var desc: String?
    var category: String?

    func isOnAir(_ now: Double) -> Bool { now >= start && now < stop }
    func progress(_ now: Double) -> Double {
        let span = stop - start
        guard span > 0 else { return 0 }
        return min(max((now - start) / span, 0), 1)
    }
}

/// Parsed XMLTV guide keyed by lowercase channel id.
nonisolated struct EpgGuide: Codable, Sendable {
    var sourceUrl: String = ""
    var updated: Date = .distantPast
    var byChannel: [String: [Programme]] = [:]
    var nameIndex: [String: String] = [:]

    var isEmpty: Bool { byChannel.isEmpty }

    func programmes(for entry: MediaEntry) -> [Programme] {
        if let id = entry.tvgId?.lowercased(), let list = byChannel[id] { return list }
        let key = XMLTVParser.normalizeName(entry.title)
        if let id = nameIndex[key], let list = byChannel[id] { return list }
        return []
    }
}

nonisolated struct WatchProgress: Codable, Identifiable, Hashable, Sendable {
    var id: String { entryId }
    var entryId: String
    var title: String
    var imageUrl: String?
    var streamUrl: String
    var kind: MediaKind
    var position: Double
    var duration: Double
    var updated: Date
    var season: Int = 0
    var episodeNumber: Int = 0
    var episodeTitle: String?
    var completed: Bool = false

    var fraction: Double { duration > 0 ? min(max(position / duration, 0), 1) : 0 }
    var remainingMinutes: Int { Int(max(duration - position, 0) / 60) }
}

nonisolated struct ProviderInfo: Codable, Sendable {
    var known: Bool = false
    var expires: Date?
    var status: String?
    var maxConnections: Int?
}

nonisolated enum SortOption: String, Codable, CaseIterable, Sendable {
    case recentlyAdded, nameAsc, nameDesc, providerDefault

    var label: String {
        switch self {
        case .recentlyAdded: t("Recently added")
        case .nameAsc: t("Name A–Z")
        case .nameDesc: t("Name Z–A")
        case .providerDefault: t("Provider order")
        }
    }
}

/// What the player is asked to play.
struct PlaybackRequest: Identifiable, Hashable {
    let id = UUID()
    var entryId: String
    var title: String
    var subtitle: String?
    var url: String
    var kind: MediaKind
    var imageUrl: String?
    var startAt: Double = 0
    var season: Int = 0
    var episodeNumber: Int = 0
    /// Channel list for zapping (live only).
    var channels: [MediaEntry] = []
    /// Following episodes for autoplay (series only).
    var nextEpisodes: [Episode] = []
}

nonisolated extension String {
    var urlQueryEncoded: String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+?#/")
        return addingPercentEncoding(withAllowedCharacters: allowed) ?? self
    }

    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
