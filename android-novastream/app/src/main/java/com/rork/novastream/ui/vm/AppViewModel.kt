package com.rork.novastream.ui.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rork.novastream.data.local.AppSettings
import com.rork.novastream.data.local.CatalogUpdateInterval
import com.rork.novastream.data.local.DeviceIdentity
import com.rork.novastream.data.local.LicenseState
import com.rork.novastream.data.local.LicenseStore
import com.rork.novastream.data.local.SettingsStore
import com.rork.novastream.data.model.Catalog
import com.rork.novastream.data.model.EpgGuide
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.model.Programme
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.data.model.WatchProgress
import com.rork.novastream.data.net.DnsCheck
import com.rork.novastream.data.net.SpeedResult
import com.rork.novastream.data.parser.XmltvParser
import com.rork.novastream.data.remote.DEFAULT_STORE_URL
import com.rork.novastream.data.remote.LicenseApi
import com.rork.novastream.data.remote.LicenseCheck
import com.rork.novastream.data.repo.IptvRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

data class CatalogQuery(
    val search: String = "",
    val sort: SortOption = SortOption.RECENTLY_ADDED,
    val year: Int? = null,
    val group: String? = null,
    val favoritesOnly: Boolean = false,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = IptvRepository(application)

    val accounts: StateFlow<List<PlaylistAccount>> = repository.accounts
    val activeAccountId: StateFlow<String?> = repository.activeAccountId
    val catalog: StateFlow<Catalog> = repository.catalog
    val syncState: StateFlow<SyncState> = repository.syncState
    val progress: StateFlow<List<WatchProgress>> = repository.progress
    val settings: StateFlow<AppSettings> = repository.settingsStore.settings
    val favorites: StateFlow<Set<String>> = repository.favorites
    val epg: StateFlow<EpgGuide> = repository.epg
    val epgState: StateFlow<SyncState> = repository.epgState

    /** True while the saved catalog is being read back at launch. */
    val catalogRestoring: StateFlow<Boolean> = repository.restoring

    /** True while a freshly downloaded catalog is still being written to disk. */
    val catalogSaving: StateFlow<Boolean> = repository.saving

    val settingsStore: SettingsStore get() = repository.settingsStore
    val encryptionLabel: String get() = repository.secureStore.algorithmLabel

    private val licenseStore = LicenseStore(application, repository.secureStore)
    private val licenseApi = LicenseApi()

    /** Terms acceptance plus the trial/license state bound to this device. */
    val license: StateFlow<LicenseState> = licenseStore.state
    val deviceIdentity: DeviceIdentity get() = licenseStore.identity

    private val _storeUrl = MutableStateFlow(DEFAULT_STORE_URL)

    /** Address of the storefront customers are sent to, resolved from the server. */
    val storeUrl: StateFlow<String> = _storeUrl.asStateFlow()

    private val _startupChecking = MutableStateFlow(true)

    /**
     * True while the launch-time licence verification is still in flight. The UI
     * waits on it only when the cached answer would not already grant access, so a
     * purchase made minutes earlier unlocks the app without any user action.
     */
    val startupChecking: StateFlow<Boolean> = _startupChecking.asStateFlow()

    init {
        licenseStore.refresh()
        // Every launch asks the registry again: revoked and expired devices lock
        // themselves even if the local cache still looked healthy.
        viewModelScope.launch {
            withTimeoutOrNull(STARTUP_CHECK_TIMEOUT_MS) { verifyWithServer() }
            _startupChecking.value = false
        }
        viewModelScope.launch { _storeUrl.value = licenseApi.storeUrl() }
        // The saved catalog opens instantly; the scheduled refresh, if one is due,
        // then runs quietly behind it.
        viewModelScope.launch { repository.autoRefreshIfDue() }
    }

    /** Re-checks the update schedule, e.g. when the app returns to the foreground. */
    fun checkScheduledUpdate() {
        viewModelScope.launch { repository.autoRefreshIfDue() }
    }

    fun setCatalogUpdateInterval(interval: CatalogUpdateInterval) {
        settingsStore.update { it.copy(catalogUpdateInterval = interval) }
        checkScheduledUpdate()
    }

    fun setAutoUpdateGuide(enabled: Boolean) {
        settingsStore.update { it.copy(autoUpdateGuide = enabled) }
    }

    /** When the active catalog was last downloaded, or 0 when never. */
    fun lastCatalogSyncMs(): Long = activeAccount?.lastSyncEpochMs?.takeIf { it > 0L }
        ?: catalog.value.syncedAtEpochMs

    fun acceptTerms() = licenseStore.acceptTerms()

    /** Re-evaluates the trial clock, e.g. when the app returns to the foreground. */
    fun refreshLicense() {
        licenseStore.refresh()
        syncLicense()
    }

    private var syncing = false

    /**
     * Asks the registry whether this device is still allowed. A failed call is
     * never a verdict: the device keeps working until the grace window runs out.
     */
    fun syncLicense(force: Boolean = false) {
        if (syncing) return
        if (!force && !licenseStore.needsRemoteCheck()) return
        viewModelScope.launch { verifyWithServer() }
    }

    /** Single place where the registry is asked, guarded against overlapping calls. */
    private suspend fun verifyWithServer() {
        if (syncing) return
        syncing = true
        licenseStore.markAttempt()
        licenseStore.setVerifying(true)
        try {
            val identity = licenseStore.identity
            val check = licenseApi.check(
                deviceId = identity.deviceId,
                mac = identity.macAddress,
                freshInstall = licenseStore.isFreshInstall,
            )
            when (check) {
                is LicenseCheck.Answered -> licenseStore.applyRemote(check.record)
                // Offline or server down: keep the last answer, grace window ticks.
                is LicenseCheck.Unavailable -> Unit
            }
        } finally {
            licenseStore.setVerifying(false)
            syncing = false
        }
    }

    private val _parentalUnlocked = MutableStateFlow(false)
    val parentalUnlocked: StateFlow<Boolean> = _parentalUnlocked.asStateFlow()

    private val _movieQuery = MutableStateFlow(CatalogQuery())
    val movieQuery: StateFlow<CatalogQuery> = _movieQuery.asStateFlow()

    private val _seriesQuery = MutableStateFlow(CatalogQuery())
    val seriesQuery: StateFlow<CatalogQuery> = _seriesQuery.asStateFlow()

    private val _liveQuery = MutableStateFlow(CatalogQuery(sort = SortOption.PROVIDER_DEFAULT))
    val liveQuery: StateFlow<CatalogQuery> = _liveQuery.asStateFlow()

    private val _episodes = MutableStateFlow<List<Episode>>(emptyList())
    val episodes: StateFlow<List<Episode>> = _episodes.asStateFlow()

    private val _episodesLoading = MutableStateFlow(false)
    val episodesLoading: StateFlow<Boolean> = _episodesLoading.asStateFlow()

    private val _dnsCheck = MutableStateFlow<DnsCheck?>(null)
    val dnsCheck: StateFlow<DnsCheck?> = _dnsCheck.asStateFlow()

    private val _dnsChecking = MutableStateFlow(false)
    val dnsChecking: StateFlow<Boolean> = _dnsChecking.asStateFlow()

    private val _speedResult = MutableStateFlow<SpeedResult?>(null)
    val speedResult: StateFlow<SpeedResult?> = _speedResult.asStateFlow()

    private val _speedRunning = MutableStateFlow(false)
    val speedRunning: StateFlow<Boolean> = _speedRunning.asStateFlow()

    val activeAccount: PlaylistAccount?
        get() = repository.activeAccount

    fun entryById(id: String): MediaEntry? = catalog.value.entries.firstOrNull { it.id == id }

    /** Entries of a kind with parental blocking applied. */
    fun visibleEntries(kind: MediaKind): List<MediaEntry> {
        val current = settings.value
        val all = catalog.value.of(kind)
        if (!current.parentalEnabled || _parentalUnlocked.value) return all
        return all.filterNot { current.blockedGroups.contains(it.group) }
    }

    fun countOf(kind: MediaKind): Int = visibleEntries(kind).size

    fun favoriteEntries(): List<MediaEntry> {
        val ids = favorites.value
        if (ids.isEmpty()) return emptyList()
        val visibleIds = MediaKind.entries.flatMap { visibleEntries(it) }
        return visibleIds.filter { ids.contains(it.id) }
    }

    fun isFavorite(entryId: String): Boolean = favorites.value.contains(entryId)

    fun toggleFavorite(entryId: String) = repository.toggleFavorite(entryId)

    fun allGroups(): List<String> = catalog.value.entries
        .map { it.group }
        .distinct()
        .sorted()

    fun availableYears(kind: MediaKind): List<Int> = visibleEntries(kind)
        .mapNotNull { it.year }
        .distinct()
        .sortedDescending()
        .take(8)

    fun applyQuery(kind: MediaKind, query: CatalogQuery) {
        when (kind) {
            MediaKind.MOVIE -> _movieQuery.value = query
            MediaKind.SERIES -> _seriesQuery.value = query
            MediaKind.LIVE -> _liveQuery.value = query
        }
    }

    fun queryOf(kind: MediaKind): StateFlow<CatalogQuery> = when (kind) {
        MediaKind.MOVIE -> movieQuery
        MediaKind.SERIES -> seriesQuery
        MediaKind.LIVE -> liveQuery
    }

    fun filteredEntries(kind: MediaKind, query: CatalogQuery): List<MediaEntry> {
        val search = query.search.trim()
        val favoriteIds = favorites.value
        val filtered = visibleEntries(kind).asSequence()
            .filter { search.isEmpty() || it.title.contains(search, ignoreCase = true) }
            .filter { query.year == null || it.year == query.year }
            .filter { query.group == null || it.group == query.group }
            .filter { !query.favoritesOnly || favoriteIds.contains(it.id) }
            .toList()

        return when (query.sort) {
            SortOption.RECENTLY_ADDED -> filtered.sortedWith(
                compareByDescending<MediaEntry> { it.addedEpochMs }.thenBy { it.providerOrder }
            )
            SortOption.NAME_ASC -> filtered.sortedBy { it.title.lowercase() }
            SortOption.NAME_DESC -> filtered.sortedByDescending { it.title.lowercase() }
            SortOption.PROVIDER_DEFAULT -> filtered.sortedBy { it.providerOrder }
        }
    }

    fun related(entry: MediaEntry): List<MediaEntry> = visibleEntries(entry.kind)
        .filter { it.group == entry.group && it.id != entry.id }
        .take(12)

    /** Programmes of a live channel, matched by tvg-id first and by name as a fallback. */
    fun programmesFor(entry: MediaEntry): List<Programme> {
        val guide = epg.value
        if (guide.isEmpty) return emptyList()
        val direct = entry.tvgId?.lowercase()?.takeIf { guide.byChannel.containsKey(it) }
        val key = direct
            ?: guide.nameIndex[XmltvParser.normalizeName(entry.title)]
            ?: entry.tvgId?.let { guide.nameIndex[XmltvParser.normalizeName(it)] }
            ?: return emptyList()
        return guide.byChannel[key].orEmpty()
    }

    fun currentProgramme(entry: MediaEntry, nowMs: Long): Programme? =
        programmesFor(entry).firstOrNull { it.isOnAir(nowMs) }

    fun upcomingProgrammes(entry: MediaEntry, nowMs: Long): List<Programme> =
        programmesFor(entry).filter { it.stopEpochMs >= nowMs }

    fun addAccount(account: PlaylistAccount, onDone: (Result<PlaylistAccount>) -> Unit) {
        viewModelScope.launch {
            onDone(repository.addAccount(account))
        }
    }

    fun switchAccount(accountId: String) {
        viewModelScope.launch { repository.switchAccount(accountId) }
    }

    fun removeAccount(accountId: String) {
        viewModelScope.launch { repository.removeAccount(accountId) }
    }

    fun refresh() {
        viewModelScope.launch { repository.refreshActive() }
    }

    fun refreshEpg() {
        viewModelScope.launch { repository.refreshEpg() }
    }

    fun updateEpgUrl(url: String) {
        activeAccount?.let { repository.updateEpgUrl(it.id, url) }
    }

    fun effectiveEpgUrl(): String = activeAccount?.let { repository.effectiveEpgUrl(it) }.orEmpty()

    fun clearSyncState() = repository.clearSyncState()

    fun clearEpgState() = repository.clearEpgState()

    fun loadEpisodes(entry: MediaEntry) {
        if (entry.seriesId == null) {
            _episodes.value = emptyList()
            return
        }
        viewModelScope.launch {
            _episodesLoading.value = true
            _episodes.value = repository.episodesOf(entry)
            _episodesLoading.value = false
        }
    }

    fun saveProgress(entry: MediaEntry, streamUrl: String, positionMs: Long, durationMs: Long) {
        repository.saveProgress(entry, streamUrl, positionMs, durationMs)
    }

    /**
     * Where playback of a title should pick up again, in milliseconds. Returns 0
     * for live channels, for titles never started, and for ones already watched
     * to the end, so those always open from the beginning.
     */
    fun resumePositionFor(entryId: String): Long {
        val saved = repository.progressFor(entryId) ?: return 0L
        if (saved.kind == MediaKind.LIVE) return 0L
        if (saved.durationMs > 0L && saved.durationMs - saved.positionMs < 90_000L) return 0L
        return saved.positionMs.coerceAtLeast(0L)
    }

    fun clearProgress() = repository.clearProgress()

    fun clearCatalogCache() = repository.clearCatalogCache()

    fun wipeEverything() {
        repository.wipeEverything()
        _parentalUnlocked.value = false
    }

    fun vaultSizeBytes(): Long = repository.vaultSizeBytes()

    fun unlockParental(pin: String): Boolean {
        val ok = settingsStore.verifyPin(pin)
        if (ok) _parentalUnlocked.value = true
        return ok
    }

    fun lockParental() {
        _parentalUnlocked.value = false
    }

    fun checkDns() {
        val host = activeAccount?.let { account ->
            if (account.server.isNotBlank()) account.server else account.m3uUrl
        }?.takeIf { it.isNotBlank() } ?: "cloudflare.com"

        viewModelScope.launch {
            _dnsChecking.value = true
            _dnsCheck.value = repository.checkDns(host)
            _dnsChecking.value = false
        }
    }

    fun runSpeedTest() {
        viewModelScope.launch {
            _speedRunning.value = true
            _speedResult.value = repository.runSpeedTest().getOrNull()
            _speedRunning.value = false
        }
    }

    private companion object {
        /** A slow network must never keep a paying customer staring at a spinner. */
        val STARTUP_CHECK_TIMEOUT_MS: Long = TimeUnit.SECONDS.toMillis(7)
    }
}
