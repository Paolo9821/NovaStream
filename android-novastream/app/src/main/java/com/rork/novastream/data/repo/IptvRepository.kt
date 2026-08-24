package com.rork.novastream.data.repo

import android.content.Context
import android.util.Log
import com.rork.novastream.data.local.SecureStore
import com.rork.novastream.data.local.SettingsStore
import com.rork.novastream.data.model.AccountType
import com.rork.novastream.data.model.Catalog
import com.rork.novastream.data.model.EpgGuide
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.data.model.WatchProgress
import com.rork.novastream.data.net.DnsCheck
import com.rork.novastream.data.net.DohResolver
import com.rork.novastream.data.net.SpeedTester
import com.rork.novastream.data.net.downloadToFile
import com.rork.novastream.data.parser.M3uParser
import com.rork.novastream.data.parser.XmltvParser
import com.rork.novastream.data.remote.XtreamClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.http.encodeURLParameter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import kotlinx.serialization.json.encodeToStream
import java.io.File
import java.util.UUID

/**
 * Single source of truth for accounts, catalog, EPG, favorites and playback progress.
 * Everything written to disk goes through [SecureStore], so credentials, guide and
 * catalog stay encrypted on the device.
 */
class IptvRepository(context: Context) {

    private val appContext = context.applicationContext
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val http = HttpClient(Android) {
        expectSuccess = false
        install(HttpTimeout) {
            requestTimeoutMillis = 180_000
            connectTimeoutMillis = 20_000
            socketTimeoutMillis = 120_000
        }
    }

    val secureStore = SecureStore(appContext)
    val settingsStore = SettingsStore(appContext)
    private val downloadDir: File = File(appContext.cacheDir, "downloads").apply { mkdirs() }
    private val xtream = XtreamClient(http, downloadDir)
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

    private val _favorites = MutableStateFlow<Set<String>>(emptySet())
    val favorites: StateFlow<Set<String>> = _favorites.asStateFlow()

    private val _epg = MutableStateFlow(EpgGuide())
    val epg: StateFlow<EpgGuide> = _epg.asStateFlow()

    private val _epgState = MutableStateFlow<SyncState>(SyncState.Idle)
    val epgState: StateFlow<SyncState> = _epgState.asStateFlow()

    /** Background worker for disk work that must never run on the UI thread. */
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        restore()
    }

    val activeAccount: PlaylistAccount?
        get() = _accounts.value.firstOrNull { it.id == _activeAccountId.value }

    private fun restore() {
        // Accounts, favorites and progress are a few kilobytes: reading them
        // inline keeps the first frame correct.
        _accounts.value = secureStore.getString(KEY_ACCOUNTS)
            ?.let { runCatching { json.decodeFromString<List<PlaylistAccount>>(it) }.getOrNull() }
            .orEmpty()
        _activeAccountId.value = secureStore.getString(KEY_ACTIVE)
        _progress.value = secureStore.getString(KEY_PROGRESS)
            ?.let { runCatching { json.decodeFromString<List<WatchProgress>>(it) }.getOrNull() }
            .orEmpty()
        _favorites.value = secureStore.getString(KEY_FAVORITES)
            .let { stored -> stored?.let { runCatching { json.decodeFromString<Set<String>>(it) }.getOrNull() } }
            .orEmpty()

        // The catalog and the guide are the two big files. Decrypting and
        // parsing them takes seconds on a TV box, so they load in the
        // background and appear as soon as they are ready.
        val activeId = _activeAccountId.value ?: return
        ioScope.launch {
            readVault<Catalog>(catalogFile(activeId))?.let { _catalog.value = it }
            readVault<EpgGuide>(epgFile(activeId))?.let { _epg.value = it }
        }
    }

    /** Decodes an encrypted cache file without ever holding its text in memory. */
    @OptIn(ExperimentalSerializationApi::class)
    private inline fun <reified T> readVault(name: String): T? =
        secureStore.readVaultStream(name)?.use { stream ->
            runCatching { json.decodeFromStream<T>(stream) }.getOrNull()
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
            _epg.value = EpgGuide()
        }
        persistAccounts()
        if (_activeAccountId.value == account.id) {
            sync(account)
            refreshEpg()
        }
        return Result.success(account)
    }

    /**
     * Switches the active provider: the previous catalog and guide are wiped from the
     * device and the new ones are downloaded from scratch.
     */
    suspend fun switchAccount(accountId: String) {
        val target = _accounts.value.firstOrNull { it.id == accountId } ?: return
        _activeAccountId.value?.let {
            secureStore.deleteVault(catalogFile(it))
            secureStore.deleteVault(epgFile(it))
        }
        _catalog.value = Catalog()
        _epg.value = EpgGuide()
        _activeAccountId.value = accountId
        persistAccounts()
        sync(target)
        refreshEpg()
    }

    suspend fun removeAccount(accountId: String) {
        secureStore.deleteVault(catalogFile(accountId))
        secureStore.deleteVault(epgFile(accountId))
        _accounts.value = _accounts.value.filterNot { it.id == accountId }
        if (_activeAccountId.value == accountId) {
            val next = _accounts.value.firstOrNull()
            _activeAccountId.value = next?.id
            _catalog.value = Catalog()
            _epg.value = EpgGuide()
            persistAccounts()
            next?.let {
                sync(it)
                refreshEpg()
            }
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
                    // Playlists are commonly tens of megabytes: the file goes to
                    // disk and is read back a line at a time.
                    val temp = File(downloadDir, "playlist-${account.id}.m3u")
                    try {
                        http.downloadToFile(account.m3uUrl, temp)
                        _syncState.value = SyncState.Running("Organizzo i contenuti…")
                        val entries = temp.bufferedReader().useLines { lines ->
                            M3uParser.parse(lines, System.currentTimeMillis())
                        }
                        if (entries.isEmpty()) {
                            throw IllegalStateException("L'URL non contiene una playlist m3u valida")
                        }
                        entries
                    } finally {
                        temp.delete()
                    }
                }
            }
        }

        result.onSuccess { entries ->
            // Encrypting a large catalog takes seconds. It has to stay off the
            // UI thread, otherwise the screen freezes exactly when the download
            // ends and the progress bar stops moving.
            withContext(Dispatchers.IO) {
                val catalog = Catalog(
                    accountId = account.id,
                    entries = entries,
                    syncedAtEpochMs = System.currentTimeMillis(),
                )
                var live = 0
                var movies = 0
                var series = 0
                entries.forEach { entry ->
                    when (entry.kind) {
                        MediaKind.LIVE -> live++
                        MediaKind.MOVIE -> movies++
                        MediaKind.SERIES -> series++
                    }
                }

                _catalog.value = catalog
                _syncState.value = SyncState.Running("Salvo il catalogo…")
                writeVault(catalogFile(account.id), catalog)
                _accounts.value = _accounts.value.map {
                    if (it.id == account.id) it.copy(lastSyncEpochMs = catalog.syncedAtEpochMs) else it
                }
                persistAccounts()
                _syncState.value = SyncState.Success(live = live, movies = movies, series = series)
            }
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

    fun clearEpgState() {
        _epgState.value = SyncState.Idle
    }

    /** Address of the XMLTV guide: the account override, or the Xtream default endpoint. */
    fun effectiveEpgUrl(account: PlaylistAccount): String {
        account.epgUrl.trim().takeIf { it.isNotBlank() }?.let { return it }
        if (account.type != AccountType.XTREAM) return ""
        val base = account.server.trim().trimEnd('/').let {
            if (it.startsWith("http://") || it.startsWith("https://")) it else "http://$it"
        }
        return "$base/xmltv.php?username=${account.username.encodeURLParameter()}" +
            "&password=${account.password.encodeURLParameter()}"
    }

    fun updateEpgUrl(accountId: String, url: String) {
        _accounts.value = _accounts.value.map {
            if (it.id == accountId) it.copy(epgUrl = url.trim()) else it
        }
        persistAccounts()
    }

    /** Downloads and parses the XMLTV guide of the active account. */
    suspend fun refreshEpg() {
        val account = activeAccount ?: run {
            _epgState.value = SyncState.Idle
            return
        }
        val url = effectiveEpgUrl(account)
        if (url.isBlank()) {
            _epgState.value = SyncState.Idle
            return
        }

        _epgState.value = SyncState.Running(url)
        val now = System.currentTimeMillis()
        val result = runCatching {
            withContext(Dispatchers.IO) {
                val temp = File(downloadDir, "epg-${account.id}.xml")
                try {
                    http.downloadToFile(url, temp)
                    if (temp.length() == 0L) {
                        throw IllegalStateException("Guida vuota o non raggiungibile")
                    }
                    temp.inputStream().use { stream ->
                        XmltvParser.parse(
                            input = stream,
                            sourceUrl = url,
                            windowStartMs = now - EPG_PAST_WINDOW_MS,
                            windowEndMs = now + EPG_FUTURE_WINDOW_MS,
                        )
                    }
                } finally {
                    temp.delete()
                }
            }
        }

        result.onSuccess { guide ->
            if (guide.isEmpty) {
                _epgState.value = SyncState.Failed("Nessun programma trovato nel file XMLTV")
                return@onSuccess
            }
            _epg.value = guide
            withContext(Dispatchers.IO) { writeVault(epgFile(account.id), guide) }
            _epgState.value = SyncState.Success(guide.channelCount, guide.programmeCount, 0)
        }.onFailure { error ->
            Log.w(TAG, "Download della guida EPG non riuscito")
            _epgState.value = SyncState.Failed(
                error.message?.takeIf { it.isNotBlank() } ?: "Impossibile scaricare la guida"
            )
        }
    }

    fun toggleFavorite(entryId: String) {
        val updated = _favorites.value.toMutableSet()
        if (!updated.add(entryId)) updated.remove(entryId)
        _favorites.value = updated
        secureStore.putString(KEY_FAVORITES, json.encodeToString(updated))
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
        _epg.value = EpgGuide()
        secureStore.clearVault()
    }

    fun wipeEverything() {
        _accounts.value = emptyList()
        _activeAccountId.value = null
        _catalog.value = Catalog()
        _epg.value = EpgGuide()
        _progress.value = emptyList()
        _favorites.value = emptySet()
        secureStore.remove(KEY_ACCOUNTS)
        secureStore.remove(KEY_ACTIVE)
        secureStore.remove(KEY_PROGRESS)
        secureStore.remove(KEY_FAVORITES)
        secureStore.clearVault()
        settingsStore.clearParental()
    }

    fun vaultSizeBytes(): Long = secureStore.vaultSizeBytes()

    suspend fun checkDns(host: String): DnsCheck =
        resolver.resolve(host, settingsStore.settings.value)

    suspend fun runSpeedTest() = speedTester.run()

    /** Encrypts a cache file straight to disk, without building the whole string. */
    @OptIn(ExperimentalSerializationApi::class)
    private inline fun <reified T> writeVault(name: String, value: T) {
        secureStore.writeVaultStream(name) { stream -> json.encodeToStream(value, stream) }
    }

    private fun catalogFile(accountId: String) = "catalog_$accountId.bin"

    private fun epgFile(accountId: String) = "epg_$accountId.bin"

    companion object {
        private const val KEY_ACCOUNTS = "accounts"
        private const val KEY_ACTIVE = "active_account"
        private const val KEY_PROGRESS = "watch_progress"
        private const val KEY_FAVORITES = "favorites"
        private const val TAG = "IptvRepository"
        private const val EPG_PAST_WINDOW_MS = 6L * 60 * 60 * 1000
        private const val EPG_FUTURE_WINDOW_MS = 48L * 60 * 60 * 1000

        fun newAccountId(): String = UUID.randomUUID().toString()
    }
}
