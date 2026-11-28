import Foundation
import Observation
import SwiftUI

/// App-wide state: playlists, the active catalog, guide, favourites, history and settings.
@Observable
final class AppModel {
    enum SyncState: Equatable {
        case idle
        case running(String)
        case failed(String)
        case done(live: Int, movies: Int, series: Int)
    }

    var settings: AppSettings { didSet { if settings != oldValue { settings.save(); Lang.current = settings.language } } }
    private(set) var accounts: [PlaylistAccount] = []
    private(set) var activeAccountId: String?
    private(set) var catalog = Catalog()
    private(set) var guide = EpgGuide()
    private(set) var providerInfo: ProviderInfo?
    private(set) var favorites: Set<String> = []
    private(set) var progress: [String: WatchProgress] = [:]
    private(set) var recentSearches: [String] = []
    var syncState: SyncState = .idle
    var guideLoading = false
    private(set) var webKey = ""
    private(set) var webKeyExpires: Date?
    /// Parental lock opened with the PIN for this session.
    var parentalUnlocked = false
    /// What the full-screen player is showing.
    var playback: PlaybackRequest?

    func play(_ entry: MediaEntry, channels: [MediaEntry] = []) {
        // Parental control: a locked channel never plays, and zapping only
        // reaches channels outside the locked categories.
        guard !isLocked(entry.group) else { return }
        let channels = channels.filter { !isLocked($0.group) }
        let saved = progress[entry.id]
        playback = PlaybackRequest(
            entryId: entry.id,
            title: entry.title,
            subtitle: entry.kind == .live ? nowPlaying(entry)?.title : entry.group,
            url: entry.streamUrl,
            kind: entry.kind,
            imageUrl: entry.logoUrl,
            startAt: entry.kind == .live || saved?.completed == true ? 0 : (saved?.position ?? 0),
            channels: channels
        )
        Haptics.tap()
    }

    func play(episode: Episode, of series: MediaEntry, all: [Episode]) {
        let saved = progress[series.id]
        let sameEpisode = saved?.season == episode.season && (saved?.episodeNumber == episode.number || saved?.episodeTitle == episode.title)
        let resume = sameEpisode && saved?.completed == false ? (saved?.position ?? 0) : 0
        let next = all.drop { $0.id != episode.id }.dropFirst()
        playback = PlaybackRequest(
            entryId: series.id,
            title: series.title,
            subtitle: "S\(episode.season) · E\(episode.number) — \(episode.title)",
            url: episode.streamUrl,
            kind: .series,
            imageUrl: series.logoUrl,
            startAt: resume,
            season: episode.season,
            episodeNumber: episode.number,
            nextEpisodes: Array(next)
        )
        Haptics.tap()
    }

    private var detailsCache: [String: MediaDetails] = [:]
    private var episodesCache: [String: [Episode]] = [:]

    var activeAccount: PlaylistAccount? { accounts.first { $0.id == activeAccountId } }

    init() {
        let loaded = AppSettings.load()
        settings = loaded
        Lang.current = loaded.language
        if let data = Keychain.data("accounts"), let saved = try? JSONDecoder().decode([PlaylistAccount].self, from: data) {
            accounts = saved
        }
        activeAccountId = UserDefaults.standard.string(forKey: "active_account") ?? accounts.first?.id
        recentSearches = UserDefaults.standard.stringArray(forKey: "recent_searches") ?? []
        loadAccountData()
    }

    // MARK: - Accounts

    func validate(_ account: PlaylistAccount) async throws -> PlaylistAccount {
        var checked = account
        checked.name = checked.name.trimmed.isEmpty ? (account.type == .xtream ? (account.host.isEmpty ? "Xtream" : account.host) : t("My playlist")) : checked.name.trimmed
        switch account.type {
        case .xtream:
            if account.isPrivateHost {
                let number = PrivateHosts.clean(account.hostNumber ?? "")
                checked.hostNumber = number
                guard let server = await PrivateHosts.resolve(number) else {
                    throw SyncError.invalid(t("Host %@ not found. Check the number you received.", number))
                }
                checked.server = server
            }
            checked.server = checked.server.trimmed
            checked.username = checked.username.trimmed
            guard !checked.server.isEmpty, !checked.username.isEmpty else { throw SyncError.invalid(t("Fill in server, username and password.")) }
            _ = try await XtreamClient.authenticate(checked)
        case .m3u:
            checked.m3uUrl = checked.m3uUrl.trimmed
            guard URL(string: checked.m3uUrl)?.scheme?.hasPrefix("http") == true else { throw SyncError.invalid(t("Enter a valid playlist address (http:// or https://).")) }
        }
        return checked
    }

    func add(_ account: PlaylistAccount) async {
        accounts.removeAll { $0.id == account.id }
        accounts.append(account)
        persistAccounts()
        select(account.id)
        await sync()
        await pushWebState()
    }

    func update(_ account: PlaylistAccount) async {
        guard let i = accounts.firstIndex(where: { $0.id == account.id }) else { return }
        accounts[i] = account
        persistAccounts()
        if account.id == activeAccountId { await sync() }
    }

    func remove(_ account: PlaylistAccount) {
        accounts.removeAll { $0.id == account.id }
        persistAccounts()
        for prefix in ["catalog-", "guide-", "progress-"] { FileStore.remove("\(prefix)\(account.id).json") }
        UserDefaults.standard.removeObject(forKey: "favorites-\(account.id)")
        if activeAccountId == account.id { select(accounts.first?.id) }
        Task { await pushWebState() }
    }

    func select(_ id: String?) {
        activeAccountId = id
        UserDefaults.standard.set(id, forKey: "active_account")
        detailsCache = [:]
        episodesCache = [:]
        loadAccountData()
        if id != nil, catalog.entries.isEmpty { Task { await sync() } }
    }

    private func persistAccounts() {
        Keychain.set(try? JSONEncoder().encode(accounts), for: "accounts")
    }

    private func loadAccountData() {
        guard let id = activeAccountId else {
            catalog = Catalog(); guide = EpgGuide(); favorites = []; progress = [:]; providerInfo = nil
            return
        }
        catalog = FileStore.load(Catalog.self, from: "catalog-\(id).json") ?? Catalog(accountId: id)
        guide = FileStore.load(EpgGuide.self, from: "guide-\(id).json") ?? EpgGuide()
        favorites = Set(UserDefaults.standard.stringArray(forKey: "favorites-\(id)") ?? [])
        progress = FileStore.load([String: WatchProgress].self, from: "progress-\(id).json") ?? [:]
        providerInfo = nil
        if let account = activeAccount?.xtreamLine {
            Task { providerInfo = try? await XtreamClient.authenticate(account) }
        }
        // Playlists of Xtream panels saved before they were read through the
        // panel's API are downloaded again once, so details and guide appear.
        if let account = activeAccount, account.type == .m3u, account.xtreamLine != nil,
           !catalog.entries.isEmpty,
           !catalog.entries.contains(where: { $0.id.hasPrefix("movie_") || $0.id.hasPrefix("series_") }),
           !UserDefaults.standard.bool(forKey: "panel-upgrade-\(account.id)") {
            UserDefaults.standard.set(true, forKey: "panel-upgrade-\(account.id)")
            Task { await sync() }
        } else if guideIsStale {
            Task { await refreshGuide() }
        }
    }

    // MARK: - Sync

    func sync() async {
        guard var account = activeAccount else { return }
        if case .running = syncState { return }
        syncState = .running(t("Connecting to the provider…"))
        account = await refreshPrivateHost(account)
        do {
            let result: Catalog
            var playlistEpg = account.playlistEpgUrl
            // An m3u link of an Xtream panel is read through the panel's API:
            // real series, the provider's categories, details and guide. The
            // plain playlist stays the fallback when the API does not answer.
            var panelCatalog: XtreamCatalog?
            if account.type == .m3u, let line = account.xtreamLine {
                panelCatalog = try? await XtreamClient.loadCatalog(line) { message in
                    await MainActor.run { self.syncState = .running(message) }
                }
                if panelCatalog?.entries.isEmpty == true { panelCatalog = nil }
            }
            switch account.type {
            case .m3u where panelCatalog != nil:
                let loaded = panelCatalog!
                var entries = loaded.entries
                var order = loaded.groupOrder
                if catalog.accountId == account.id {
                    for kind in [MediaKind.movie, .series] where !entries.contains(where: { $0.kind == kind }) {
                        let previous = catalog.of(kind).filter { $0.id.hasPrefix("movie_") || $0.id.hasPrefix("series_") }
                        guard !previous.isEmpty else { continue }
                        entries += previous
                        if let saved = catalog.groupOrder[kind.rawValue] { order[kind.rawValue] = saved }
                    }
                }
                result = Catalog(accountId: account.id, entries: entries, synced: Date(), groupOrder: order)
            case .m3u:
                syncState = .running(t("Downloading playlist…"))
                let data = try await Net.get(account.m3uUrl)
                syncState = .running(t("Reading playlist…"))
                let parsed = await Task.detached(priority: .userInitiated) { M3UParser.parse(Net.text(data)) }.value
                guard !parsed.entries.isEmpty else { throw SyncError.empty }
                playlistEpg = parsed.epgUrl
                result = Catalog(accountId: account.id, entries: parsed.entries, synced: Date(), m3uEpisodes: parsed.episodes)
            case .xtream:
                let loaded = try await XtreamClient.loadCatalog(account) { message in
                    await MainActor.run { self.syncState = .running(message) }
                }
                guard !loaded.entries.isEmpty else { throw SyncError.empty }
                // A temporary provider error can leave movies or series empty:
                // keep the ones already saved for this playlist instead of erasing them.
                var entries = loaded.entries
                var order = loaded.groupOrder
                if catalog.accountId == account.id {
                    for kind in [MediaKind.movie, .series] where !entries.contains(where: { $0.kind == kind }) {
                        let previous = catalog.of(kind)
                        guard !previous.isEmpty else { continue }
                        entries += previous
                        if let saved = catalog.groupOrder[kind.rawValue] { order[kind.rawValue] = saved }
                    }
                }
                result = Catalog(accountId: account.id, entries: entries, synced: Date(), groupOrder: order)
            }
            guard account.id == activeAccountId else {
                // The user switched playlist meanwhile: keep this result for
                // later and load the playlist now selected if it has nothing yet.
                let finished = result
                Task.detached(priority: .utility) { FileStore.save(finished, to: "catalog-\(account.id).json") }
                syncState = .idle
                if activeAccountId != nil, catalog.entries.isEmpty { await sync() }
                return
            }
            catalog = result
            let snapshot = result
            Task.detached(priority: .utility) { FileStore.save(snapshot, to: "catalog-\(account.id).json") }
            if let i = accounts.firstIndex(where: { $0.id == account.id }) {
                accounts[i].lastSync = Date()
                accounts[i].playlistEpgUrl = playlistEpg
                persistAccounts()
            }
            detailsCache = [:]
            episodesCache = [:]
            syncState = .done(live: result.of(.live).count, movies: result.of(.movie).count, series: result.of(.series).count)
            Haptics.success()
            await refreshGuide()
        } catch {
            guard account.id == activeAccountId else {
                syncState = .idle
                if activeAccountId != nil, catalog.entries.isEmpty { await sync() }
                return
            }
            syncState = .failed(error.localizedDescription)
            Haptics.error()
        }
    }

    /// A private host may move: its number is looked up again before each
    /// download, and the last known address is kept when the list is unreachable.
    private func refreshPrivateHost(_ account: PlaylistAccount) async -> PlaylistAccount {
        guard account.isPrivateHost, let server = await PrivateHosts.resolve(account.hostNumber ?? ""),
              server != account.server else { return account }
        var updated = account
        updated.server = server
        if let i = accounts.firstIndex(where: { $0.id == account.id }) {
            accounts[i].server = server
            persistAccounts()
        }
        return updated
    }

    func refreshGuide() async {
        guard let account = activeAccount, !account.epgCandidates.isEmpty, !guideLoading else { return }
        guideLoading = true
        defer { guideLoading = false }
        for url in account.epgCandidates {
            guard let data = try? await Net.get(url), !data.isEmpty else {
                #if DEBUG
                print("epg_source_failed url=\(url.prefix(60))")
                #endif
                continue
            }
            let now = Date().timeIntervalSince1970
            let parsed = await Task.detached(priority: .utility) {
                XMLTVParser.parse(data: data, sourceUrl: url, from: now - 6 * 3600, to: now + 3 * 86_400)
            }.value
            guard account.id == activeAccountId else { return }
            guard !parsed.isEmpty else { continue }
            guide = parsed
            Task.detached(priority: .utility) { FileStore.save(parsed, to: "guide-\(account.id).json") }
            return
        }
    }

    /// True when the saved guide no longer covers today, so a phone that
    /// stays on for days never shows yesterday's schedule.
    var guideIsStale: Bool {
        guard let account = activeAccount, !account.epgCandidates.isEmpty else { return false }
        if guide.isEmpty { return true }
        if !Calendar.current.isDateInToday(guide.updated) { return true }
        if Date().timeIntervalSince(guide.updated) > 12 * 3600 { return true }
        let lastStop = guide.byChannel.values.compactMap { $0.last?.stop }.max() ?? 0
        return lastStop < Date().timeIntervalSince1970 + 3 * 3600
    }

    /// Re-downloads the active playlist when the chosen interval has passed.
    func autoRefreshIfNeeded() async {
        guard let account = activeAccount else { return }
        if let interval = settings.autoRefresh.interval,
           Date().timeIntervalSince(account.lastSync ?? .distantPast) > interval {
            await sync()
        } else if guideIsStale {
            await refreshGuide()
        }
    }

    // MARK: - Website playlist manager

    func pushWebState() async {
        guard let answer = await LicenseAPI.sync(accounts: accounts) else { return }
        webKey = answer.key
        webKeyExpires = answer.keyExpires
        var changed = false
        for id in answer.remove where accounts.contains(where: { $0.id == id }) {
            accounts.removeAll { $0.id == id }
            changed = true
        }
        for var item in answer.install where !accounts.contains(where: { $0.id == item.id }) {
            if item.isPrivateHost {
                // Sent from the website by number: find its server first.
                guard let server = await PrivateHosts.resolve(item.hostNumber ?? "") else { continue }
                item.server = server
            }
            accounts.append(item)
            changed = true
        }
        if changed {
            persistAccounts()
            if activeAccount == nil { select(accounts.first?.id) }
            Haptics.success()
        }
    }

    // MARK: - Catalog queries

    func isLocked(_ group: String) -> Bool {
        guard settings.parentalEnabled, !parentalUnlocked else { return false }
        return settings.lockedGroups.contains(group)
    }

    func entries(_ kind: MediaKind) -> [MediaEntry] {
        let all = catalog.of(kind)
        guard settings.parentalEnabled, settings.hideLockedGroups, !parentalUnlocked else { return all }
        return all.filter { !settings.lockedGroups.contains($0.group) }
    }

    func groups(_ kind: MediaKind) -> [String] {
        catalog.orderedGroups(kind, items: entries(kind))
    }

    struct GroupCounts {
        var total = 0
        var favourites = 0
        var byGroup: [String: Int] = [:]
    }

    @ObservationIgnored private var countsCache: [String: (key: String, value: GroupCounts)] = [:]

    /// How many titles each category holds, for the category column. Kept
    /// until the catalog, favourites or parental lock change, since large
    /// providers list tens of thousands of titles.
    func groupCounts(_ kind: MediaKind) -> GroupCounts {
        let items = entries(kind)
        let key = "\(catalog.accountId)|\(catalog.synced.timeIntervalSince1970)|\(items.count)|\(favorites.count)|\(parentalUnlocked)|\(settings.parentalEnabled)|\(settings.lockedGroups.count)"
        if let cached = countsCache[kind.rawValue], cached.key == key { return cached.value }
        var counts = GroupCounts()
        for entry in items {
            counts.byGroup[entry.group, default: 0] += 1
            for extra in entry.extraGroups where extra != entry.group { counts.byGroup[extra, default: 0] += 1 }
            guard !isLocked(entry.group) else { continue }
            counts.total += 1
            if favorites.contains(entry.id) { counts.favourites += 1 }
        }
        countsCache[kind.rawValue] = (key, counts)
        return counts
    }

    func sorted(_ items: [MediaEntry], by sort: SortOption) -> [MediaEntry] {
        switch sort {
        case .providerDefault: items.sorted { $0.providerOrder < $1.providerOrder }
        case .nameAsc: items.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        case .nameDesc: items.sorted { $0.title.localizedStandardCompare($1.title) == .orderedDescending }
        case .recentlyAdded: items.sorted { ($0.added, -$0.providerOrder) > ($1.added, -$1.providerOrder) }
        }
    }

    func search(_ query: String) -> [MediaEntry] {
        let q = query.trimmed
        guard q.count >= 2 else { return [] }
        return catalog.entries.filter { !isLocked($0.group) && $0.title.localizedStandardContains(q) }.prefix(200).map { $0 }
    }

    func rememberSearch(_ query: String) {
        let q = query.trimmed
        guard q.count >= 2 else { return }
        recentSearches.removeAll { $0.caseInsensitiveCompare(q) == .orderedSame }
        recentSearches.insert(q, at: 0)
        recentSearches = Array(recentSearches.prefix(8))
        UserDefaults.standard.set(recentSearches, forKey: "recent_searches")
    }

    func clearSearches() {
        recentSearches = []
        UserDefaults.standard.removeObject(forKey: "recent_searches")
    }

    func entry(_ id: String) -> MediaEntry? { catalog.entries.first { $0.id == id } }

    func nowPlaying(_ entry: MediaEntry) -> Programme? {
        let now = Date().timeIntervalSince1970
        return guide.programmes(for: entry).first { $0.isOnAir(now) }
    }

    func upcoming(_ entry: MediaEntry, limit: Int = 12) -> [Programme] {
        let now = Date().timeIntervalSince1970
        return guide.programmes(for: entry).filter { $0.stop > now }.prefix(limit).map { $0 }
    }

    // MARK: - Details

    func details(for entry: MediaEntry) async -> MediaDetails? {
        if let cached = detailsCache[entry.id] { return cached }
        guard let account = activeAccount?.xtreamLine else { return nil }
        var result: MediaDetails?
        if entry.kind == .movie, entry.id.hasPrefix("movie_") {
            result = await XtreamClient.movieDetails(account, streamId: String(entry.id.dropFirst("movie_".count)))
        } else if entry.kind == .series, let sid = entry.seriesId, !sid.hasPrefix("m3u:") {
            if let (info, eps) = try? await XtreamClient.seriesInfo(account, seriesId: sid) {
                result = info
                episodesCache[entry.id] = eps
            }
        }
        if let result { detailsCache[entry.id] = result }
        return result
    }

    func episodes(for entry: MediaEntry) async throws -> [Episode] {
        if let cached = episodesCache[entry.id] { return cached }
        if let sid = entry.seriesId, let local = catalog.m3uEpisodes[sid] { return local }
        guard let account = activeAccount?.xtreamLine, let sid = entry.seriesId, !sid.hasPrefix("m3u:") else { return [] }
        let (info, eps) = try await XtreamClient.seriesInfo(account, seriesId: sid)
        episodesCache[entry.id] = eps
        if let info { detailsCache[entry.id] = info }
        return eps
    }

    // MARK: - Favourites and history

    func isFavorite(_ id: String) -> Bool { favorites.contains(id) }

    func toggleFavorite(_ id: String) {
        if favorites.contains(id) { favorites.remove(id) } else { favorites.insert(id) }
        if let acc = activeAccountId { UserDefaults.standard.set(Array(favorites), forKey: "favorites-\(acc)") }
        Haptics.tap()
    }

    func favoriteEntries(_ kind: MediaKind? = nil) -> [MediaEntry] {
        catalog.entries.filter { favorites.contains($0.id) && (kind == nil || $0.kind == kind) && !isLocked($0.group) }
    }

    func saveProgress(_ item: WatchProgress) {
        var record = item
        record.completed = item.duration > 0 && item.position / item.duration > 0.95
        progress[item.entryId] = record
        persistProgress()
    }

    func clearProgress(_ id: String) {
        progress[id] = nil
        persistProgress()
    }

    var continueWatching: [WatchProgress] {
        progress.values
            .filter { $0.kind != .live && !$0.completed && $0.position > 30 && !isLockedEntry($0.entryId) }
            .sorted { $0.updated > $1.updated }
            .prefix(15).map { $0 }
    }

    var recentChannels: [MediaEntry] {
        progress.values.filter { $0.kind == .live }.sorted { $0.updated > $1.updated }
            .compactMap { entry($0.entryId) }.filter { !isLocked($0.group) }
            .prefix(10).map { $0 }
    }

    /// True when the saved item's category is behind the parental PIN.
    private func isLockedEntry(_ id: String) -> Bool {
        guard settings.parentalEnabled, !parentalUnlocked else { return false }
        return entry(id).map { settings.lockedGroups.contains($0.group) } ?? false
    }

    private func persistProgress() {
        guard let acc = activeAccountId else { return }
        let snapshot = progress
        Task.detached(priority: .utility) { FileStore.save(snapshot, to: "progress-\(acc).json") }
    }

    // MARK: - Storage

    func clearHistory() {
        progress = [:]
        persistProgress()
    }

    var storageBytes: Int64 {
        FileStore.size(prefix: "catalog-") + FileStore.size(prefix: "guide-") + FileStore.size(prefix: "progress-")
    }
}

#if DEBUG && targetEnvironment(simulator)
extension AppModel {
    /// Invented, non-sensitive demo library for App Store screenshots. Never saved.
    func seedScreenshotData() {
        var s = settings
        s.onboardingDone = true
        s.termsAccepted = true
        s.theme = .dark
        settings = s

        let account = PlaylistAccount(id: "demo-home", name: "My Home Playlist", type: .m3u, m3uUrl: "https://playlist.example.com/home.m3u", lastSync: Date().addingTimeInterval(-3600))
        accounts = [account]
        activeAccountId = account.id

        let now = Date().timeIntervalSince1970
        var entries: [MediaEntry] = []
        var guideMap: [String: [Programme]] = [:]
        let channels: [(String, String, [String])] = [
            ("Nova News 24", "News", ["Morning Briefing", "World Today", "Markets Live", "Evening Report"]),
            ("Aurora Sports", "Sports", ["Matchday Live", "Highlights Show", "Locker Room", "Late Kick-off"]),
            ("Terra Docs", "Documentaries", ["Wild Coasts", "The Deep Blue", "Mountain Kingdoms", "Ancient Rivers"]),
            ("Lumen Kids", "Kids", ["Paper Planes", "Star Tales", "Little Builders", "Moon Club"]),
            ("Vista Music", "Music", ["Fresh Hits", "Acoustic Hour", "Live Session", "Night Mix"]),
            ("Coastline TV", "Entertainment", ["Kitchen Stories", "Home Rescue", "Quiz Night", "The Late Show"]),
            ("Harbor News", "News", ["Local Today", "Weather Watch", "City Desk", "Night Edition"]),
            ("Summit Sports 2", "Sports", ["Trail Running", "Cycling Classics", "Climb Week", "Board Masters"]),
            ("Atlas Travel", "Documentaries", ["Island Hopping", "Street Food Trails", "Slow Trains", "Desert Roads"]),
            ("Pulse Music", "Music", ["Chart Countdown", "Indie Corner", "Throwback Mix", "After Hours"]),
        ]
        let slotStart = (now / 1800).rounded(.down) * 1800 - 900
        for (i, ch) in channels.enumerated() {
            let tvg = "demo.ch\(i)"
            entries.append(MediaEntry(id: "live_\(i)", title: ch.0, kind: .live, group: ch.1, streamUrl: "https://example.com/live/\(i).m3u8", providerOrder: i, added: now, quality: i % 3 == 0 ? "FHD" : "HD", tvgId: tvg))
            guideMap[tvg] = ch.2.enumerated().map { j, title in
                let start = slotStart + Double(j) * 3600 - Double(i % 3) * 600
                return Programme(title: title, start: start, stop: start + 3600, desc: nil, category: ch.1)
            }
        }
        let movies: [(String, String?, Int, String, [String], String)] = [
            ("The Quiet Harbor", "demo_quiet_harbor", 2025, "Drama", ["Drama", "Mystery"], "A lighthouse keeper on a fog-bound island finds letters that rewrite her family's story, one tide at a time."),
            ("Northbound", "demo_northbound", 2024, "Adventure", ["Adventure"], "Two strangers share the last train across the frozen north and a secret neither can afford to lose."),
            ("Glass Orchard", "demo_glass_orchard", 2025, "Fantasy", ["Fantasy"], "A botanist discovers an orchard that only blooms at night, and the price of every fruit it bears."),
            ("Echo Valley", "demo_echo_valley", 2023, "Adventure", ["Adventure", "Drama"], "An estranged father and daughter hike a desert canyon where every echo remembers something."),
            ("Paper Lanterns", nil, 2024, "Drama", ["Drama"], "A festival night brings an old neighbourhood back together."),
            ("Signal Lost", nil, 2025, "Thriller", ["Thriller"], "A radio operator hears a voice that should not exist."),
        ]
        for (i, m) in movies.enumerated() {
            entries.append(MediaEntry(id: "movie_\(i)", title: m.0, kind: .movie, group: m.3, logoUrl: m.1.flatMap(ScreenshotMode.poster), streamUrl: "https://example.com/movie/\(i).mp4", year: m.2, providerOrder: 100 + i, added: now - Double(i) * 86400, plot: m.5, genres: m.4, quality: "4K"))
        }
        let series: [(String, String?, String, String)] = [
            ("Coastline", "demo_coastline", "Crime", "In a neon-lit coastal town, a detective returns home to solve the case that made her leave."),
            ("Midnight Lab", "demo_midnight_lab", "Sci-Fi", "A night-shift research team discovers their experiment is answering back."),
            ("Small Kitchen", nil, "Lifestyle", "Big flavours from the tiniest kitchens in the city."),
        ]
        var episodes: [String: [Episode]] = [:]
        for (i, s) in series.enumerated() {
            let sid = "demo-series-\(i)"
            entries.append(MediaEntry(id: "series_\(i)", title: s.0, kind: .series, group: s.2, logoUrl: s.1.flatMap(ScreenshotMode.poster), year: 2025, providerOrder: 200 + i, added: now, plot: s.3, genres: [s.2], quality: "HD", seriesId: sid))
            episodes[sid] = (1...6).map { n in
                Episode(id: "\(sid)-e\(n)", title: ["Arrival", "Low Tide", "The Signal", "Undertow", "Glass Night", "Daybreak"][n - 1], season: 1, number: n, streamUrl: "https://example.com/series/\(i)/\(n).mp4", plot: nil)
            }
        }
        catalog = Catalog(accountId: account.id, entries: entries, synced: Date(), groupOrder: [:], m3uEpisodes: episodes)
        guide = EpgGuide(sourceUrl: "demo", updated: Date(), byChannel: guideMap)
        favorites = ["live_0", "live_2", "movie_0", "series_1"]
        let ago = Date()
        progress = [
            "movie_1": WatchProgress(entryId: "movie_1", title: "Northbound", imageUrl: ScreenshotMode.poster("demo_northbound"), streamUrl: "", kind: .movie, position: 2700, duration: 6300, updated: ago.addingTimeInterval(-600)),
            "series_1": WatchProgress(entryId: "series_1", title: "Midnight Lab", imageUrl: ScreenshotMode.poster("demo_midnight_lab"), streamUrl: "", kind: .series, position: 1200, duration: 2700, updated: ago.addingTimeInterval(-3600), season: 1, episodeNumber: 3, episodeTitle: "The Signal"),
            "live_0": WatchProgress(entryId: "live_0", title: "Nova News 24", streamUrl: "", kind: .live, position: 0, duration: 0, updated: ago.addingTimeInterval(-120)),
            "live_1": WatchProgress(entryId: "live_1", title: "Aurora Sports", streamUrl: "", kind: .live, position: 0, duration: 0, updated: ago.addingTimeInterval(-7200)),
            "live_2": WatchProgress(entryId: "live_2", title: "Terra Docs", streamUrl: "", kind: .live, position: 0, duration: 0, updated: ago.addingTimeInterval(-9000)),
        ]
    }
}
#endif
