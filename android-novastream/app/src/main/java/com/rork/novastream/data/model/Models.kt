package com.rork.novastream.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class AccountType { M3U, XTREAM }

/** A saved IPTV provider account. Credentials are only ever persisted encrypted. */
@Serializable
data class PlaylistAccount(
    val id: String,
    val name: String,
    val type: AccountType,
    val m3uUrl: String = "",
    val server: String = "",
    val username: String = "",
    val password: String = "",
    val lastSyncEpochMs: Long = 0L,
) {
    val typeLabel: String get() = if (type == AccountType.XTREAM) "Xtream" else "m3u"
}

@Serializable
enum class MediaKind { LIVE, MOVIE, SERIES }

/** A single playable item (channel, movie or series) imported from the provider. */
@Serializable
data class MediaEntry(
    val id: String,
    val title: String,
    val kind: MediaKind,
    val group: String,
    val logoUrl: String? = null,
    val streamUrl: String = "",
    val year: Int? = null,
    val providerOrder: Int = 0,
    val addedEpochMs: Long = 0L,
    val plot: String? = null,
    val genres: List<String> = emptyList(),
    val quality: String? = null,
    val seriesId: String? = null,
)

@Serializable
data class Catalog(
    val accountId: String = "",
    val entries: List<MediaEntry> = emptyList(),
    val syncedAtEpochMs: Long = 0L,
) {
    fun of(kind: MediaKind): List<MediaEntry> = entries.filter { it.kind == kind }
}

@Serializable
data class Episode(
    val id: String,
    val title: String,
    val season: Int,
    val number: Int,
    val streamUrl: String,
    val plot: String? = null,
    val thumbUrl: String? = null,
)

@Serializable
data class WatchProgress(
    val entryId: String,
    val title: String,
    val imageUrl: String? = null,
    val streamUrl: String,
    val kind: MediaKind,
    val positionMs: Long,
    val durationMs: Long,
    val updatedAtEpochMs: Long,
) {
    val fraction: Float
        get() = if (durationMs <= 0L) 0f else (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)

    val remainingLabel: String
        get() {
            val remaining = (durationMs - positionMs).coerceAtLeast(0L) / 60000L
            return if (remaining <= 0L) "Quasi finito" else "$remaining min rimanenti"
        }
}

/** Sort modes offered above every catalog. */
enum class SortOption(val label: String) {
    RECENTLY_ADDED("Recentemente aggiunti"),
    NAME_ASC("Nome A-Z"),
    NAME_DESC("Nome Z-A"),
    PROVIDER_DEFAULT("Default provider"),
}

sealed interface SyncState {
    data object Idle : SyncState
    data class Running(val message: String) : SyncState
    data class Failed(val message: String) : SyncState
    data class Success(val live: Int, val movies: Int, val series: Int) : SyncState
}
