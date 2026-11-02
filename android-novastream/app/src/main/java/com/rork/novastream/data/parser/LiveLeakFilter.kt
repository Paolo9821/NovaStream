package com.rork.novastream.data.parser

import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind

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
         * Removes channels, channel lists and category covers that a provider
         * filed among its films or series, and drops impossible years (a
         * "Year: 2087" chip). Runs on every fresh download and on the catalog
         * saved by an older build, so the clean-up needs no new sync.
         *
         * A record goes when:
         * - [isLiveLeak] recognises it (live category cover or channel);
         * - its address is a live one (`/live/`, or an HLS playlist for a film);
         * - its poster is the logo of one specific live channel;
         * - its title is a channel-list label ("Canali tematici", "scegli un canale"…);
         * - it belongs to a numbered run of identical cards ("Movie Select 1 4K",
         *   "Movie Select 2 4K"… all with the same poster and no plot), together
         *   with any other card of that category sharing the same poster;
         * - it is a series named exactly like a live channel and marked like one
         *   (quality tag, live category or channel logo).
         */
        fun purgeCatalog(entries: List<MediaEntry>): List<MediaEntry> {
            val live = entries.filter { it.kind == MediaKind.LIVE }
            val filter = LiveLeakFilter(live.map { it.group }.distinct(), live.map { it.title })
            val liveCategoryKeys = live.mapTo(HashSet()) { normalize(it.group) }
            val liveNames = live.mapTo(HashSet()) { normalize(it.title) }.filter { it.length >= 5 }.toHashSet()
            // Only logos that identify one channel (or very few): a generic
            // placeholder shared by many channels says nothing about a film.
            val channelLogos = live.mapNotNull { it.logoUrl?.trim()?.takeIf(String::isNotEmpty) }
                .groupingBy { it }.eachCount()
                .filterValues { it <= 3 }.keys

            val dropped = HashSet<String>()

            // Numbered runs of identical cards, per category.
            entries.asSequence()
                .filter { it.kind != MediaKind.LIVE }
                .groupBy { it.kind to it.group }
                .values
                .forEach { group ->
                    val runs = group
                        .filter { !it.logoUrl.isNullOrBlank() }
                        .groupBy { it.logoUrl!!.trim() to runKey(it.title) }
                        .filter { (key, members) ->
                            members.size >= 3 && key.second.isNotEmpty() &&
                                members.all { it.plot.isNullOrBlank() } &&
                                members.map { normalize(it.title) }.distinct().size == members.size
                        }
                    if (runs.isEmpty()) return@forEach
                    val posters = runs.keys.mapTo(HashSet()) { it.first }
                    group.forEach { entry ->
                        val poster = entry.logoUrl?.trim()
                        if (poster != null && poster in posters && entry.plot.isNullOrBlank()) dropped += entry.id
                    }
                }

            val currentYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
            var changed = dropped.isNotEmpty()
            val kept = ArrayList<MediaEntry>(entries.size)
            for (entry in entries) {
                if (entry.kind == MediaKind.LIVE) {
                    kept += entry
                    continue
                }
                if (entry.id in dropped || isChannelRecord(entry, filter, liveCategoryKeys, liveNames, channelLogos)) {
                    changed = true
                    continue
                }
                val year = entry.year
                if (year != null && (year < 1900 || year > currentYear + 1)) {
                    changed = true
                    kept += entry.copy(year = null)
                } else {
                    kept += entry
                }
            }
            return if (changed) kept else entries
        }

        private fun isChannelRecord(
            entry: MediaEntry,
            filter: LiveLeakFilter,
            liveCategoryKeys: Set<String>,
            liveNames: Set<String>,
            channelLogos: Set<String>,
        ): Boolean {
            if (filter.isLiveLeak(entry.title, entry.group)) return true
            val url = entry.streamUrl.lowercase().substringBefore('?')
            if (url.contains("/live/")) return true
            if (entry.kind == MediaKind.MOVIE && url.endsWith(".m3u8")) return true
            val poster = entry.logoUrl?.trim()
            if (poster != null && poster in channelLogos) return true
            val name = normalize(entry.title)
            if (CHANNEL_LIST_LABELS.any { name.startsWith(it) || name.contains(it) && it.length > 10 }) return true
            if (entry.kind == MediaKind.SERIES && name in liveNames) {
                val tagged = QUALITY_TAG.containsMatchIn(entry.title)
                if (tagged || normalize(entry.group) in liveCategoryKeys) return true
            }
            return false
        }

        /** "Movie Select 2 4K" and "Movie Select 3 4K" share a key; real titles rarely do. */
        private fun runKey(title: String): String =
            normalize(title).replace(Regex("\\d+"), "#").takeIf { it.contains('#') }.orEmpty()

        private val CHANNEL_LIST_LABELS = listOf(
            "canalitematici", "sceglituncanale", "scegliuncanale", "sceglileuncanale",
            "chooseachannel", "selectachannel", "elijauncanal", "elegiruncanal",
            "choisissezunechaine", "listacanali", "channellist",
        )
        private val QUALITY_TAG = Regex("(?i)(\\b(hd|fhd|uhd|sd|4k|hevc|h265)\\b|\\+1\\b|24/7)")

        private val LIVE_STREAM_TYPES = setOf("live", "created_live", "radio_streams", "radio")
        private val nonAlphanumeric = Regex("[^\\p{L}\\p{N}]+")

        /** "Italia 4K - FHD" and "Italia 4K-FHD" are the same name. */
        fun normalize(value: String): String = value.lowercase().replace(nonAlphanumeric, "")
    }
}
