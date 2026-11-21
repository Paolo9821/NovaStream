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
        let resume = saved?.episodeTitle == episode.title && saved?.season == episode.season && saved?.completed == false ? (saved?.position ?? 0) : 0
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
        if let account = activeAccount, account.type == .xtream {
            Task { providerInfo = try? await XtreamClient.authenticate(account) }
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
            switch account.type {
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
                result = Catalog(accountId: account.id, entries: loaded.entries, synced: Date(), groupOrder: loaded.groupOrder)
            }
            guard account.id == activeAccountId else { syncState = .idle; return }
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
        guard let account = activeAccount, !account.effectiveEpgUrl.isEmpty else { return }
        guideLoading = true
        defer { guideLoading = false }
        guard let data = try? await Net.get(account.effectiveEpgUrl) else { return }
        let now = Date().timeIntervalSince1970
        let url = account.effectiveEpgUrl
        let parsed = await Task.detached(priority: .utility) {
            XMLTVParser.parse(data: data, sourceUrl: url, from: now - 6 * 3600, to: now + 3 * 86_400)
        }.value
        guard account.id == activeAccountId, !parsed.isEmpty else { return }
        guide = parsed
        Task.detached(priority: .utility) { FileStore.save(parsed, to: "guide-\(account.id).json") }
    }

    /// Re-downloads the active playlist when the chosen interval has passed.
    func autoRefreshIfNeeded() async {
        guard let interval = settings.autoRefresh.interval, let account = activeAccount else { return }
        let last = account.lastSync ?? .distantPast
        if Date().timeIntervalSince(last) > interval { await sync() }
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
        guard let account = activeAccount, account.type == .xtream else { return nil }
        var result: MediaDetails?
        if entry.kind == .movie {
            result = await XtreamClient.movieDetails(account, streamId: String(entry.id.dropFirst("movie_".count)))
        } else if entry.kind == .series, let sid = entry.seriesId {
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
        guard let account = activeAccount, account.type == .xtream, let sid = entry.seriesId else { return [] }
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
        catalog.entries.filter { favorites.contains($0.id) && (kind == nil || $0.kind == kind) }
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
            .filter { $0.kind != .live && !$0.completed && $0.position > 30 }
            .sorted { $0.updated > $1.updated }
            .prefix(15).map { $0 }
    }

    var recentChannels: [MediaEntry] {
        progress.values.filter { $0.kind == .live }.sorted { $0.updated > $1.updated }
            .prefix(10).compactMap { entry($0.entryId) }
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
