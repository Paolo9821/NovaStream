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
    val epgUrl: String = "",
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
    val tvgId: String? = null,
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

/** One XMLTV `<programme>` entry mapped to a channel. */
@Serializable
data class Programme(
    val title: String,
    val startEpochMs: Long,
    val stopEpochMs: Long,
    val description: String? = null,
    val category: String? = null,
) {
    fun isOnAir(nowMs: Long): Boolean = nowMs in startEpochMs until stopEpochMs

    fun progressAt(nowMs: Long): Float {
        val span = stopEpochMs - startEpochMs
        if (span <= 0L) return 0f
        return ((nowMs - startEpochMs).toFloat() / span).coerceIn(0f, 1f)
    }
}

/**
 * Parsed XMLTV guide. [byChannel] is keyed by the lowercase XMLTV channel id and
 * [nameIndex] maps normalized display names to those ids, so channels without a
 * `tvg-id` can still be matched by name.
 */
@Serializable
data class EpgGuide(
    val sourceUrl: String = "",
    val updatedAtEpochMs: Long = 0L,
    val byChannel: Map<String, List<Programme>> = emptyMap(),
    val nameIndex: Map<String, String> = emptyMap(),
) {
    val programmeCount: Int get() = byChannel.values.sumOf { it.size }
    val channelCount: Int get() = byChannel.size
    val isEmpty: Boolean get() = byChannel.isEmpty()
}

/**
 * What was watched of a title and where it was left.
 *
 * Series carry the episode they were last on ([season], [episodeNumber]), so the
 * series page can offer to carry on without the viewer hunting for the right
 * episode. [completed] marks a title watched to the end: it stays in the history
 * rather than being forgotten, which is what lets a finished episode point at
 * the one after it.
 */
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
    val season: Int = 0,
    val episodeNumber: Int = 0,
    val episodeTitle: String? = null,
    val completed: Boolean = false,
) {
    val fraction: Float
        get() = if (durationMs <= 0L) 0f else (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)

    val remainingMinutes: Long
        get() = (durationMs - positionMs).coerceAtLeast(0L) / 60000L

    /** True when this record names a specific episode of a series. */
    val hasEpisode: Boolean get() = kind == MediaKind.SERIES && episodeNumber > 0
}

/** Sort modes offered above every catalog. */
enum class SortOption {
    RECENTLY_ADDED,
    NAME_ASC,
    NAME_DESC,
    PROVIDER_DEFAULT,
}

sealed interface SyncState {
    data object Idle : SyncState
    data class Running(val message: String) : SyncState
    data class Failed(val message: String) : SyncState
    data class Success(val live: Int, val movies: Int, val series: Int) : SyncState
}
