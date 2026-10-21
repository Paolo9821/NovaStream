package com.rork.novastream.data.parser

/**
 * Recognises live-TV records that a provider filed among its films.
 *
 * Several panels put the cover cards of their live categories ("Italia",
 * "Italia 4K - FHD", each with a "choose a channel from the list" poster) and
 * sometimes whole channels into the film list. They then appeared in Movies,
 * usually at the top of "Recently added". The checks are deliberately narrow so
 * that a real film is never hidden:
 * - the portal itself says the record is live;
 * - the film is named exactly like its own category and that category is a
 *   live category (a category cover, not a film);
 * - the film carries the name of a live channel and sits in a category that
 *   also exists on the live side.
 */
class LiveLeakFilter(
    liveCategoryNames: Collection<String>,
    liveChannelNames: Collection<String>,
) {
    private val liveCategories: Set<String> = liveCategoryNames.mapTo(HashSet()) { normalize(it) }
    private val liveChannels: Set<String> = liveChannelNames.mapTo(HashSet()) { normalize(it) }

    val isEmpty: Boolean get() = liveCategories.isEmpty() && liveChannels.isEmpty()

    fun isLiveLeak(title: String, group: String, streamType: String = ""): Boolean {
        if (streamType.trim().lowercase() in LIVE_STREAM_TYPES) return true
        val name = normalize(title)
        if (name.isEmpty()) return false
        val category = normalize(group)
        val liveCategory = category in liveCategories
        if (liveCategory && name == category) return true
        return liveCategory && name in liveChannels
    }

    companion object {
        /**
         * Drops films that are really live covers from a catalog that was saved
         * by an older build, so the fix shows up without waiting for a new sync.
         */
        fun purgeMovies(entries: List<com.rork.novastream.data.model.MediaEntry>): List<com.rork.novastream.data.model.MediaEntry> {
            val live = entries.filter { it.kind == com.rork.novastream.data.model.MediaKind.LIVE }
            if (live.isEmpty()) return entries
            val filter = LiveLeakFilter(live.map { it.group }.distinct(), live.map { it.title })
            val kept = entries.filterNot {
                it.kind == com.rork.novastream.data.model.MediaKind.MOVIE && filter.isLiveLeak(it.title, it.group)
            }
            return if (kept.size == entries.size) entries else kept
        }

        private val LIVE_STREAM_TYPES = setOf("live", "created_live", "radio_streams", "radio")
        private val nonAlphanumeric = Regex("[^\\p{L}\\p{N}]+")

        /** "Italia 4K - FHD" and "Italia 4K-FHD" are the same name. */
        fun normalize(value: String): String = value.lowercase().replace(nonAlphanumeric, "")
    }
}
