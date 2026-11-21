import Foundation

nonisolated struct M3UPlaylist: Sendable {
    var entries: [MediaEntry]
    var episodes: [String: [Episode]]
    var epgUrl: String
}

/// Parses m3u/m3u8 playlists. Kind, category and year come only from what the
/// provider wrote (group-title, stream path, year in the title).
nonisolated enum M3UParser {
    private static let attributeRegex = try! NSRegularExpression(pattern: #"([A-Za-z0-9_-]+)="([^"]*)""#)
    private static let parenYear = try! NSRegularExpression(pattern: #"[(\[](19\d{2}|20\d{2})[)\]]"#)
    private static let looseYear = try! NSRegularExpression(pattern: #"\b(19\d{2}|20\d{2})\b"#)
    private static let quality = try! NSRegularExpression(pattern: #"\b(4K|UHD|FHD|FULL ?HD|HD|SD)\b"#, options: .caseInsensitive)
    private static let seasonEpisode = try! NSRegularExpression(pattern: #"[Ss](\d{1,2})\s?[Ee][Pp]?\s?(\d{1,4})"#)
    private static let seasonX = try! NSRegularExpression(pattern: #"\b(\d{1,2})x(\d{1,3})\b"#)
    private static let episodePattern = try! NSRegularExpression(pattern: #"s\d{1,2}\s?e\d{1,2}"#, options: .caseInsensitive)

    static func parse(_ content: String) -> M3UPlaylist {
        var entries: [MediaEntry] = []
        var decisive = Set<Int>()
        var pending: String?
        var order = 0
        var epgUrl = ""
        let now = Date().timeIntervalSince1970

        content.enumerateLines { raw, _ in
            var line = raw.trimmed
            if line.hasPrefix("\u{FEFF}") { line.removeFirst() }
            if line.isEmpty { return }
            let upper = line.prefix(7).uppercased()
            if upper.hasPrefix("#EXTM3U") {
                if epgUrl.isEmpty { epgUrl = headerEpg(line) }
            } else if upper.hasPrefix("#EXTINF") {
                pending = line
            } else if line.hasPrefix("#") {
                return
            } else if let info = pending {
                if pathKind(line) != nil { decisive.insert(entries.count) }
                entries.append(buildEntry(info: info, url: line, order: order, now: now))
                order += 1
                pending = nil
            }
        }
        let settled = settleKinds(entries, decisive: decisive)
        return groupEpisodes(dedupeMovies(settled), epgUrl: epgUrl)
    }

    static func extractYear(_ title: String) -> Int? {
        if let y = firstGroup(parenYear, title).flatMap(Int.init) { return y }
        if let y = firstGroup(looseYear, title).flatMap(Int.init), (1900...2100).contains(y) { return y }
        return nil
    }

    // MARK: - Steps

    private static func headerEpg(_ header: String) -> String {
        let attrs = attributes(header)
        guard let raw = attrs["url-tvg"] ?? attrs["x-tvg-url"] ?? attrs["tvg-url"] else { return "" }
        return raw.split(whereSeparator: { $0 == "," || $0 == " " })
            .map { String($0).trimmed }
            .first { $0.lowercased().hasPrefix("http") } ?? ""
    }

    private static func dedupeMovies(_ entries: [MediaEntry]) -> [MediaEntry] {
        var urls = Set<String>()
        var titles = Set<String>()
        return entries.filter { entry in
            guard entry.kind == .movie else { return true }
            let key = "\(entry.group)|\(entry.title.lowercased())|\(entry.year ?? 0)|\(entry.quality ?? "")"
            return urls.insert(entry.streamUrl).inserted && titles.insert(key).inserted
        }
    }

    /// Episodes of one show (same name before "S01E02", same category) become one series entry.
    private static func groupEpisodes(_ entries: [MediaEntry], epgUrl: String) -> M3UPlaylist {
        var result: [MediaEntry] = []
        result.reserveCapacity(entries.count)
        var seriesIndex: [String: Int] = [:]
        var episodes: [String: [Episode]] = [:]

        for entry in entries {
            guard entry.kind == .series else { result.append(entry); continue }
            let ns = entry.title as NSString
            let range = NSRange(location: 0, length: ns.length)
            let match = seasonEpisode.firstMatch(in: entry.title, range: range) ?? seasonX.firstMatch(in: entry.title, range: range)
            var show = match.map { ns.substring(to: $0.range.location) } ?? entry.title
            show = show.trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "-|:·._ ")).trimmed
            if show.isEmpty { show = entry.title }
            let season = match.flatMap { Int(ns.substring(with: $0.range(at: 1))) } ?? 1
            let number = match.flatMap { Int(ns.substring(with: $0.range(at: 2))) }
            let normalized = show.lowercased().filter { $0.isLetter || $0.isNumber }
            let key = "\(entry.group)|\(normalized)"

            let seriesId: String
            if let existing = seriesIndex[key] {
                seriesId = result[existing].seriesId ?? ""
            } else {
                seriesId = "m3u:\(stableHash(key))_\(entry.providerOrder)"
                seriesIndex[key] = result.count
                var series = entry
                series.id = "m3useries_\(entry.providerOrder)_\(normalized.prefix(24))"
                series.title = show
                series.seriesId = seriesId
                result.append(series)
            }
            var list = episodes[seriesId, default: []]
            list.append(Episode(
                id: entry.id,
                title: entry.title,
                season: season,
                number: number ?? (list.filter { $0.season == season }.count + 1),
                streamUrl: entry.streamUrl,
                thumbUrl: entry.logoUrl
            ))
            episodes[seriesId] = list
        }
        let sorted = episodes.mapValues { list -> [Episode] in
            var seen = Set<String>()
            return list.filter { seen.insert($0.streamUrl).inserted }
                .sorted { ($0.season, $0.number) < ($1.season, $1.number) }
        }
        return M3UPlaylist(entries: result, episodes: sorted, epgUrl: epgUrl)
    }

    /// Entries whose address does not say what they are take their group's majority kind.
    private static func settleKinds(_ entries: [MediaEntry], decisive: Set<Int>) -> [MediaEntry] {
        var tally: [String: [MediaKind: Int]] = [:]
        for e in entries { tally[e.group, default: [:]][e.kind, default: 0] += 1 }
        let majority = tally.mapValues { counts in counts.max { $0.value < $1.value }?.key ?? .live }
        var result = entries
        for i in result.indices where !decisive.contains(i) {
            let groupKind = majority[result[i].group] ?? result[i].kind
            if groupKind != result[i].kind, groupKind == .live || result[i].kind == .live {
                result[i].kind = groupKind
            }
        }
        return result
    }

    private static func pathKind(_ url: String) -> MediaKind? {
        let lower = url.lowercased()
        if lower.contains("/movie/") { return .movie }
        if lower.contains("/series/") { return .series }
        if lower.contains("/live/") { return .live }
        return nil
    }

    private static func buildEntry(info: String, url: String, order: Int, now: Double) -> MediaEntry {
        let attrs = attributes(info)
        var rawTitle = ""
        if let comma = lastTopLevelComma(info) { rawTitle = String(info[info.index(after: comma)...]).trimmed }
        if rawTitle.isEmpty { rawTitle = attrs["tvg-name"] ?? "" }
        if rawTitle.isEmpty { rawTitle = t("Untitled") }
        let groupRaw = (attrs["group-title"] ?? "").trimmed
        let group = groupRaw.isEmpty ? t("Uncategorized") : groupRaw
        let kind = classify(group: group, url: url, title: rawTitle)
        let tvgId = attrs["tvg-id"].flatMap { $0.trimmed.isEmpty ? nil : $0 }
        let base = tvgId ?? url
        return MediaEntry(
            id: "\(stableHash(base))_\(order)",
            title: cleanTitle(rawTitle),
            kind: kind,
            group: group,
            logoUrl: attrs["tvg-logo"].flatMap { $0.trimmed.isEmpty ? nil : $0 },
            streamUrl: url,
            year: extractYear(rawTitle),
            providerOrder: order,
            added: now,
            quality: firstGroup(quality, rawTitle)?.uppercased(),
            tvgId: tvgId
        )
    }

    /// The title follows the last comma that is outside a quoted attribute.
    private static func lastTopLevelComma(_ info: String) -> String.Index? {
        var inQuotes = false
        var firstComma: String.Index?
        for idx in info.indices {
            let c = info[idx]
            if c == "\"" { inQuotes.toggle() }
            else if c == ",", !inQuotes { firstComma = idx; break }
        }
        return firstComma
    }

    private static func classify(group: String, url: String, title: String) -> MediaKind {
        if let kind = pathKind(url) { return kind }
        let hay = "\(group.lowercased()) \(url.lowercased())"
        let range = NSRange(title.startIndex..., in: title)
        if ["serie", "series", "tv show", "stagione", "season"].contains(where: hay.contains)
            || episodePattern.firstMatch(in: title, range: range) != nil { return .series }
        if ["/vod/", "film", "movie", "vod"].contains(where: hay.contains) { return .movie }
        let lower = url.lowercased()
        if lower.hasSuffix(".mp4") || lower.hasSuffix(".mkv") || lower.hasSuffix(".avi") { return .movie }
        return .live
    }

    private static func cleanTitle(_ title: String) -> String {
        let ns = title as NSString
        var cleaned = parenYear.stringByReplacingMatches(in: title, range: NSRange(location: 0, length: ns.length), withTemplate: "")
        cleaned = cleaned.replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
        cleaned = cleaned.trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "-|·")).trimmed
        return cleaned.isEmpty ? title : cleaned
    }

    private static func attributes(_ line: String) -> [String: String] {
        let ns = line as NSString
        var result: [String: String] = [:]
        for m in attributeRegex.matches(in: line, range: NSRange(location: 0, length: ns.length)) {
            result[ns.substring(with: m.range(at: 1)).lowercased()] = ns.substring(with: m.range(at: 2))
        }
        return result
    }

    private static func firstGroup(_ regex: NSRegularExpression, _ text: String) -> String? {
        let ns = text as NSString
        guard let m = regex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return ns.substring(with: m.range(at: 1))
    }

    /// Deterministic across launches (String.hashValue is seeded per process).
    static func stableHash(_ s: String) -> String {
        var h: UInt64 = 1469598103934665603
        for b in s.utf8 { h = (h ^ UInt64(b)) &* 1099511628211 }
        return String(h, radix: 36)
    }
}
