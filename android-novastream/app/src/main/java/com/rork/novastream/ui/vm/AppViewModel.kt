package com.rork.novastream.ui.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rork.novastream.data.local.AppSettings
import com.rork.novastream.data.local.SettingsStore
import com.rork.novastream.data.model.Catalog
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.data.model.WatchProgress
import com.rork.novastream.data.net.DnsCheck
import com.rork.novastream.data.net.SpeedResult
import com.rork.novastream.data.repo.IptvRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CatalogQuery(
    val search: String = "",
    val sort: SortOption = SortOption.RECENTLY_ADDED,
    val year: Int? = null,
    val group: String? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = IptvRepository(application)

    val accounts: StateFlow<List<PlaylistAccount>> = repository.accounts
    val activeAccountId: StateFlow<String?> = repository.activeAccountId
    val catalog: StateFlow<Catalog> = repository.catalog
    val syncState: StateFlow<SyncState> = repository.syncState
    val progress: StateFlow<List<WatchProgress>> = repository.progress
    val settings: StateFlow<AppSettings> = repository.settingsStore.settings

    val settingsStore: SettingsStore get() = repository.settingsStore
    val encryptionLabel: String get() = repository.secureStore.algorithmLabel

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

    fun accountById(id: String?): PlaylistAccount? = accounts.value.firstOrNull { it.id == id }

    fun entryById(id: String): MediaEntry? = catalog.value.entries.firstOrNull { it.id == id }

    /** Entries of a kind with parental blocking applied. */
    fun visibleEntries(kind: MediaKind): List<MediaEntry> {
        val current = settings.value
        val all = catalog.value.of(kind)
        if (!current.parentalEnabled || _parentalUnlocked.value) return all
        return all.filterNot { current.blockedGroups.contains(it.group) }
    }

    fun countOf(kind: MediaKind): Int = visibleEntries(kind).size

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
        val filtered = visibleEntries(kind).asSequence()
            .filter { search.isEmpty() || it.title.contains(search, ignoreCase = true) }
            .filter { query.year == null || it.year == query.year }
            .filter { query.group == null || it.group == query.group }
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

    fun clearSyncState() = repository.clearSyncState()

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
}
