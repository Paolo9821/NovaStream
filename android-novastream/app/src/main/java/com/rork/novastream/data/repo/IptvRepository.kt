package com.rork.novastream.data.repo

import android.content.Context
import android.util.Log
import com.rork.novastream.data.local.SecureStore
import com.rork.novastream.data.local.SettingsStore
import com.rork.novastream.data.model.AccountType
import com.rork.novastream.data.model.Catalog
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.data.model.WatchProgress
import com.rork.novastream.data.net.DnsCheck
import com.rork.novastream.data.net.DohResolver
import com.rork.novastream.data.net.SpeedTester
import com.rork.novastream.data.parser.M3uParser
import com.rork.novastream.data.remote.XtreamClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.util.UUID

/**
 * Single source of truth for accounts, catalog and playback progress.
 * Everything written to disk goes through [SecureStore], so credentials and the
 * imported catalog stay encrypted on the device.
 */
class IptvRepository(context: Context) {

    private val appContext = context.applicationContext
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val http = HttpClient(Android) {
        expectSuccess = false
        install(HttpTimeout) {
            requestTimeoutMillis = 120_000
            connectTimeoutMillis = 20_000
            socketTimeoutMillis = 60_000
        }
    }

    val secureStore = SecureStore(appContext)
    val settingsStore = SettingsStore(appContext)
    private val xtream = XtreamClient(http)
    private val resolver = DohResolver(http)
    private val speedTester = SpeedTester(http)

    private val _accounts = MutableStateFlow<List<PlaylistAccount>>(emptyList())
    val accounts: StateFlow<List<PlaylistAccount>> = _accounts.asStateFlow()

    private val _activeAccountId = MutableStateFlow<String?>(null)
    val activeAccountId: StateFlow<String?> = _activeAccountId.asStateFlow()

    private val _catalog = MutableStateFlow(Catalog())
    val catalog: StateFlow<Catalog> = _catalog.asStateFlow()

    private val _syncState = MutableStateFlow<SyncState>(SyncState.Idle)
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    private val _progress = MutableStateFlow<List<WatchProgress>>(emptyList())
    val progress: StateFlow<List<WatchProgress>> = _progress.asStateFlow()

    init {
        restore()
    }

    val activeAccount: PlaylistAccount?
        get() = _accounts.value.firstOrNull { it.id == _activeAccountId.value }

    private fun restore() {
        _accounts.value = secureStore.getString(KEY_ACCOUNTS)
            ?.let { runCatching { json.decodeFromString<List<PlaylistAccount>>(it) }.getOrNull() }
            .orEmpty()
        _activeAccountId.value = secureStore.getString(KEY_ACTIVE)
        _progress.value = secureStore.getString(KEY_PROGRESS)
            ?.let { runCatching { json.decodeFromString<List<WatchProgress>>(it) }.getOrNull() }
            .orEmpty()
        _activeAccountId.value?.let { id ->
            secureStore.readVault(catalogFile(id))
                ?.let { runCatching { json.decodeFromString<Catalog>(it) }.getOrNull() }
                ?.let { _catalog.value = it }
        }
    }

    private fun persistAccounts() {
        secureStore.putString(KEY_ACCOUNTS, json.encodeToString(_accounts.value))
        _activeAccountId.value?.let { secureStore.putString(KEY_ACTIVE, it) } ?: secureStore.remove(KEY_ACTIVE)
    }

    /** Validates the credentials, saves the account encrypted and imports its catalog. */
    suspend fun addAccount(account: PlaylistAccount, makeActive: Boolean = true): Result<PlaylistAccount> {
        val validation = validate(account)
        if (validation.isFailure) {
            val message = validation.exceptionOrNull()?.message ?: "Verifica non riuscita"
            _syncState.value = SyncState.Failed(message)
            return Result.failure(IllegalStateException(message))
        }

        _accounts.value = _accounts.value + account
        if (makeActive || _activeAccountId.value == null) {
            _activeAccountId.value = account.id
            _catalog.value = Catalog()
        }
        persistAccounts()
        if (_activeAccountId.value == account.id) sync(account)
        return Result.success(account)
    }

    /**
     * Switches the active provider: the previous catalog is wiped from the device and
     * the new one is downloaded from scratch.
     */
    suspend fun switchAccount(accountId: String) {
        val target = _accounts.value.firstOrNull { it.id == accountId } ?: return
        _activeAccountId.value?.let { secureStore.deleteVault(catalogFile(it)) }
        _catalog.value = Catalog()
        _activeAccountId.value = accountId
        persistAccounts()
        sync(target)
    }

    suspend fun removeAccount(accountId: String) {
        secureStore.deleteVault(catalogFile(accountId))
        _accounts.value = _accounts.value.filterNot { it.id == accountId }
        if (_activeAccountId.value == accountId) {
            val next = _accounts.value.firstOrNull()
            _activeAccountId.value = next?.id
            _catalog.value = Catalog()
            persistAccounts()
            next?.let { sync(it) }
        } else {
            persistAccounts()
        }
    }

    suspend fun refreshActive() {
        activeAccount?.let { sync(it) }
    }

    private suspend fun validate(account: PlaylistAccount): Result<Unit> = runCatching {
        when (account.type) {
            AccountType.XTREAM -> {
                if (account.server.isBlank() || account.username.isBlank() || account.password.isBlank()) {
                    throw IllegalStateException("Compila server, username e password")
                }
                xtream.authenticate(account).getOrThrow()
            }
            AccountType.M3U -> {
                if (!account.m3uUrl.startsWith("http", ignoreCase = true)) {
                    throw IllegalStateException("Inserisci un URL m3u valido (http o https)")
                }
            }
        }
    }

    private suspend fun sync(account: PlaylistAccount) {
        _syncState.value = SyncState.Running("Connessione a ${account.name}…")
        val result = runCatching {
            when (account.type) {
                AccountType.XTREAM -> xtream.loadCatalog(account) { message ->
                    _syncState.value = SyncState.Running(message)
                }
                AccountType.M3U -> withContext(Dispatchers.IO) {
                    _syncState.value = SyncState.Running("Scarico la playlist…")
                    val body = http.get(account.m3uUrl).bodyAsText()
                    if (!body.contains("#EXTINF", ignoreCase = true)) {
                        throw IllegalStateException("L'URL non contiene una playlist m3u valida")
                    }
                    _syncState.value = SyncState.Running("Organizzo i contenuti…")
                    M3uParser.parse(body, System.currentTimeMillis())
                }
            }
        }

        result.onSuccess { entries ->
            val catalog = Catalog(
                accountId = account.id,
                entries = entries,
                syncedAtEpochMs = System.currentTimeMillis(),
            )
            _catalog.value = catalog
            secureStore.writeVault(catalogFile(account.id), json.encodeToString(catalog))
            _accounts.value = _accounts.value.map {
                if (it.id == account.id) it.copy(lastSyncEpochMs = catalog.syncedAtEpochMs) else it
            }
            persistAccounts()
            _syncState.value = SyncState.Success(
                live = entries.count { it.kind == MediaKind.LIVE },
                movies = entries.count { it.kind == MediaKind.MOVIE },
                series = entries.count { it.kind == MediaKind.SERIES },
            )
        }.onFailure { error ->
            Log.w(TAG, "Import della playlist non riuscito")
            _syncState.value = SyncState.Failed(
                error.message?.takeIf { it.isNotBlank() } ?: "Impossibile raggiungere il server"
            )
        }
    }

    fun clearSyncState() {
        _syncState.value = SyncState.Idle
    }

    suspend fun episodesOf(entry: MediaEntry): List<Episode> {
        val account = activeAccount ?: return emptyList()
        val seriesId = entry.seriesId ?: return emptyList()
        if (account.type != AccountType.XTREAM) return emptyList()
        return runCatching { xtream.loadEpisodes(account, seriesId) }
            .onFailure { Log.w(TAG, "Impossibile caricare gli episodi") }
            .getOrDefault(emptyList())
    }

    fun saveProgress(entry: MediaEntry, streamUrl: String, positionMs: Long, durationMs: Long) {
        if (durationMs <= 0L || positionMs < 15_000L) return
        val updated = WatchProgress(
            entryId = entry.id,
            title = entry.title,
            imageUrl = entry.logoUrl,
            streamUrl = streamUrl,
            kind = entry.kind,
            positionMs = positionMs,
            durationMs = durationMs,
            updatedAtEpochMs = System.currentTimeMillis(),
        )
        val remaining = durationMs - positionMs
        val list = _progress.value.filterNot { it.entryId == entry.id }
        _progress.value = if (remaining < 90_000L) list.take(12)
        else (listOf(updated) + list).take(12)
        secureStore.putString(KEY_PROGRESS, json.encodeToString(_progress.value))
    }

    fun clearProgress() {
        _progress.value = emptyList()
        secureStore.remove(KEY_PROGRESS)
    }

    fun clearCatalogCache() {
        _catalog.value = Catalog()
        secureStore.clearVault()
    }

    fun wipeEverything() {
        _accounts.value = emptyList()
        _activeAccountId.value = null
        _catalog.value = Catalog()
        _progress.value = emptyList()
        secureStore.remove(KEY_ACCOUNTS)
        secureStore.remove(KEY_ACTIVE)
        secureStore.remove(KEY_PROGRESS)
        secureStore.clearVault()
        settingsStore.clearParental()
    }

    fun vaultSizeBytes(): Long = secureStore.vaultSizeBytes()

    suspend fun checkDns(host: String): DnsCheck =
        resolver.resolve(host, settingsStore.settings.value)

    suspend fun runSpeedTest() = speedTester.run()

    private fun catalogFile(accountId: String) = "catalog_$accountId.bin"

    companion object {
        private const val KEY_ACCOUNTS = "accounts"
        private const val KEY_ACTIVE = "active_account"
        private const val KEY_PROGRESS = "watch_progress"
        private const val TAG = "IptvRepository"

        fun newAccountId(): String = UUID.randomUUID().toString()
    }
}
