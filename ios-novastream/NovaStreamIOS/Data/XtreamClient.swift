import Foundation

nonisolated struct XtreamCatalog: Sendable {
    var entries: [MediaEntry]
    var groupOrder: [String: [String]]
}

/// Minimal Xtream Codes client. Portals disagree on types (numbers vs strings),
/// so every field is read loosely.
nonisolated enum XtreamClient {
    static func base(_ server: String) -> String {
        var trimmed = server.trimmed
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        return trimmed.lowercased().hasPrefix("http://") || trimmed.lowercased().hasPrefix("https://") ? trimmed : "http://\(trimmed)"
    }

    static func apiUrl(_ a: PlaylistAccount, _ action: String = "") -> String {
        let suffix = action.isEmpty ? "" : "&action=\(action)"
        return "\(base(a.server))/player_api.php?username=\(a.username.urlQueryEncoded)&password=\(a.password.urlQueryEncoded)\(suffix)"
    }

    private static func streamBase(_ a: PlaylistAccount, _ type: String) -> String {
        "\(base(a.server))/\(type)/\(a.username.urlQueryEncoded)/\(a.password.urlQueryEncoded)"
    }

    /// Verifies the credentials before an account is saved.
    static func authenticate(_ a: PlaylistAccount) async throws -> ProviderInfo {
        let root = try await Net.json(apiUrl(a))
        guard let dict = root as? [String: Any], let user = dict["user_info"] as? [String: Any] else {
            throw SyncError.invalid(t("The server did not return the user information."))
        }
        if str(user, "auth") == "0" { throw SyncError.refused }
        let exp = str(user, "exp_date").flatMap(Double.init).flatMap { $0 > 0 ? Date(timeIntervalSince1970: $0) : nil }
        return ProviderInfo(known: true, expires: exp, status: str(user, "status"), maxConnections: str(user, "max_connections").flatMap(Int.init))
    }

    static func loadCatalog(_ a: PlaylistAccount, progress: @Sendable (String) async -> Void) async throws -> XtreamCatalog {
        await progress(t("Fetching categories…"))
        async let liveCats = categories(a, "get_live_categories")
        async let vodCats = categories(a, "get_vod_categories")
        async let seriesCats = categories(a, "get_series_categories")
        let (lc, vc, sc) = await (liveCats, vodCats, seriesCats)

        await progress(t("Fetching live channels…"))
        let live = try await list(a, "get_live_streams").enumerated().compactMap { index, d -> MediaEntry? in
            guard let id = str(d, "stream_id") else { return nil }
            return MediaEntry(
                id: "live_\(id)",
                title: str(d, "name") ?? "Channel \(id)",
                kind: .live,
                group: lc.names[str(d, "category_id") ?? ""] ?? t("Uncategorized"),
                logoUrl: str(d, "stream_icon"),
                streamUrl: "\(streamBase(a, "live"))/\(id).m3u8",
                providerOrder: index,
                added: epoch(str(d, "added")),
                tvgId: str(d, "epg_channel_id")
            )
        }

        await progress(t("Fetching movies…"))
        let movies = (try? await list(a, "get_vod_streams"))?.enumerated().compactMap { index, d -> MediaEntry? in
            guard let id = str(d, "stream_id") else { return nil }
            let catId = str(d, "category_id") ?? ""
            if !catId.isEmpty, vc.names[catId] == nil, lc.names[catId] != nil { return nil }
            if str(d, "stream_type") == "live" { return nil }
            let name = str(d, "name") ?? "Film \(id)"
            let group = vc.names[catId] ?? t("Uncategorized")
            return MediaEntry(
                id: "movie_\(id)",
                title: name,
                kind: .movie,
                group: group,
                logoUrl: str(d, "stream_icon") ?? str(d, "cover"),
                streamUrl: "\(streamBase(a, "movie"))/\(id).\(str(d, "container_extension") ?? "mp4")",
                year: year(d, name),
                providerOrder: index,
                added: epoch(str(d, "added")),
                plot: str(d, "plot"),
                genres: splitGenres(str(d, "genre")),
                quality: str(d, "quality"),
                extraGroups: extraGroups(d, vc.names, group)
            )
        } ?? []

        await progress(t("Fetching TV series…"))
        let series = (try? await list(a, "get_series"))?.enumerated().compactMap { index, d -> MediaEntry? in
            guard let id = str(d, "series_id") else { return nil }
            let name = str(d, "name") ?? "Series \(id)"
            let group = sc.names[str(d, "category_id") ?? ""] ?? t("Uncategorized")
            return MediaEntry(
                id: "series_\(id)",
                title: name,
                kind: .series,
                group: group,
                logoUrl: str(d, "cover") ?? str(d, "stream_icon"),
                year: year(d, name),
                providerOrder: index,
                added: epoch(str(d, "last_modified")),
                plot: str(d, "plot"),
                genres: splitGenres(str(d, "genre")),
                seriesId: id,
                extraGroups: extraGroups(d, sc.names, group)
            )
        } ?? []

        return XtreamCatalog(
            entries: live + movies + series,
            groupOrder: [MediaKind.live.rawValue: lc.order, MediaKind.movie.rawValue: vc.order, MediaKind.series.rawValue: sc.order]
        )
    }

    static func movieDetails(_ a: PlaylistAccount, streamId: String) async -> MediaDetails? {
        guard let root = try? await Net.json(apiUrl(a, "get_vod_info") + "&vod_id=\(streamId)") as? [String: Any],
              let info = root["info"] as? [String: Any] else { return nil }
        return details(info, cover: str(info, "movie_image") ?? str(info, "cover_big"))
    }

    static func seriesInfo(_ a: PlaylistAccount, seriesId: String) async throws -> (MediaDetails?, [Episode]) {
        var root = try await Net.json(apiUrl(a, "get_series_info") + "&series_id=\(seriesId)")
        if let array = root as? [Any], let first = array.first { root = first }
        guard let dict = root as? [String: Any] else { return (nil, []) }
        let info = (dict["info"] as? [String: Any]).map { details($0, cover: str($0, "cover")) }

        var buckets: [(Int?, [Any])] = []
        switch dict["episodes"] {
        case let obj as [String: Any]:
            buckets = obj.map { (Int($0.key), episodeList($0.value)) }
        case let arr as [Any]:
            if arr.first is [String: Any] { buckets = [(nil, arr)] }
            else { buckets = arr.enumerated().map { ($0.offset, episodeList($0.element)) } }
        default: break
        }
        var seen = Set<String>()
        let episodes = buckets.flatMap { seasonKey, list in
            list.enumerated().compactMap { position, element -> Episode? in
                guard let e = element as? [String: Any] else { return nil }
                let inner = e["info"] as? [String: Any] ?? [:]
                guard let id = str(e, "id") ?? str(e, "stream_id") ?? str(e, "episode_id") else { return nil }
                let ext = str(e, "container_extension") ?? str(inner, "container_extension") ?? "mp4"
                let number = str(e, "episode_num").flatMap(Int.init) ?? str(inner, "episode_num").flatMap(Int.init) ?? position + 1
                let season = str(e, "season").flatMap(Int.init) ?? str(inner, "season").flatMap(Int.init) ?? seasonKey ?? 1
                return Episode(
                    id: id,
                    title: str(e, "title") ?? str(inner, "name") ?? String(format: t("Episode %d"), number),
                    season: max(season, 0),
                    number: number,
                    streamUrl: "\(streamBase(a, "series"))/\(id).\(ext)",
                    plot: str(inner, "plot") ?? str(inner, "description"),
                    thumbUrl: str(inner, "movie_image")
                )
            }
        }
        .filter { seen.insert($0.streamUrl).inserted }
        .sorted { ($0.season, $0.number) < ($1.season, $1.number) }
        return (info, episodes)
    }

    // MARK: - Helpers

    private struct Categories { var names: [String: String] = [:]; var order: [String] = [] }

    private static func categories(_ a: PlaylistAccount, _ action: String) async -> Categories {
        guard let items = try? await list(a, action) else { return Categories() }
        var result = Categories()
        for d in items {
            guard let id = str(d, "category_id"), let name = str(d, "category_name") else { continue }
            result.names[id] = name
            if !result.order.contains(name) { result.order.append(name) }
        }
        return result
    }

    private static func list(_ a: PlaylistAccount, _ action: String) async throws -> [[String: Any]] {
        let root = try await Net.json(apiUrl(a, action))
        if let arr = root as? [[String: Any]] { return arr }
        if let obj = root as? [String: Any] { return obj.values.compactMap { $0 as? [String: Any] } }
        return []
    }

    private static func episodeList(_ value: Any) -> [Any] {
        if let arr = value as? [Any] { return arr }
        if let obj = value as? [String: Any] { return Array(obj.values) }
        return []
    }

    private static func details(_ info: [String: Any], cover: String?) -> MediaDetails {
        var backdrop: String?
        if let arr = info["backdrop_path"] as? [Any] { backdrop = arr.first as? String }
        let minutes = str(info, "episode_run_time").flatMap(Int.init).map { "\($0) min" }
        return MediaDetails(
            plot: str(info, "plot") ?? str(info, "description"),
            genres: splitGenres(str(info, "genre")),
            cast: (str(info, "cast") ?? str(info, "actors") ?? "").split(separator: ",").map { String($0).trimmed }.filter { !$0.isEmpty }.prefix(8).map { $0 },
            director: str(info, "director"),
            rating: str(info, "rating").flatMap { $0 == "0" || $0 == "0.0" ? nil : $0 },
            duration: str(info, "duration") ?? minutes,
            releaseDate: str(info, "releasedate") ?? str(info, "releaseDate"),
            country: str(info, "country"),
            coverUrl: cover,
            backdropUrl: backdrop.flatMap { $0.isEmpty ? nil : $0 }
        )
    }

    private static func extraGroups(_ d: [String: Any], _ names: [String: String], _ group: String) -> [String] {
        guard let ids = d["category_ids"] as? [Any] else { return [] }
        var seen = Set<String>()
        return ids.compactMap { names["\($0)"] }.filter { $0 != group && seen.insert($0).inserted }
    }

    static func str(_ d: [String: Any], _ key: String) -> String? {
        guard let value = d[key], !(value is NSNull) else { return nil }
        let s: String
        if let v = value as? String { s = v }
        else if let v = value as? NSNumber { s = v.stringValue }
        else { return nil }
        let trimmed = s.trimmed
        return trimmed.isEmpty || trimmed == "null" ? nil : trimmed
    }

    private static func epoch(_ s: String?) -> Double {
        guard let v = s.flatMap(Double.init) else { return 0 }
        return v > 100_000_000_000 ? v / 1000 : v
    }

    private static func year(_ d: [String: Any], _ name: String) -> Int? {
        for key in ["year", "releaseDate", "release_date"] {
            if let v = str(d, key), let y = Int(v.prefix(4)) { return y }
        }
        return M3UParser.extractYear(name)
    }

    private static func splitGenres(_ s: String?) -> [String] {
        guard let s else { return [] }
        var seen = Set<String>()
        return s.split(whereSeparator: { $0 == "," || $0 == "/" }).map { String($0).trimmed }
            .filter { !$0.isEmpty && seen.insert($0).inserted }.prefix(6).map { $0 }
    }
}
