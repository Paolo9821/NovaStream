package com.rork.novastream.data.parser

import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import java.util.Locale

/** A parsed playlist: its entries, the episodes behind each series and the guide it announces. */
class M3uPlaylist(
    val entries: List<MediaEntry>,
    val episodes: Map<String, List<Episode>>,
    val epgUrl: String,
)

/**
 * Parses an m3u/m3u8 playlist into catalog entries.
 * Year, category and kind are derived from what the provider itself writes in the
 * playlist (group-title, stream path and the year inside the title) — no external lookups.
 */
object M3uParser {

    private val attributeRegex = Regex("([A-Za-z0-9_-]+)=\"([^\"]*)\"")
    private val parenYearRegex = Regex("[(\\[](19\\d{2}|20\\d{2})[)\\]]")
    private val looseYearRegex = Regex("\\b(19\\d{2}|20\\d{2})\\b")
    private val qualityRegex = Regex("\\b(4K|UHD|FHD|FULL ?HD|HD|SD)\\b", RegexOption.IGNORE_CASE)

    fun parse(content: String, nowMs: Long): List<MediaEntry> =
        parse(content.lineSequence(), nowMs)

    fun parse(lines: Sequence<String>, nowMs: Long): List<MediaEntry> =
        parsePlaylist(lines, nowMs).entries

    /**
     * Reads a playlist as it streams off the disk. Large providers ship files of
     * tens of megabytes, so the text is never held whole: only the entries built
     * from it stay in memory.
     */
    fun parsePlaylist(lines: Sequence<String>, nowMs: Long): M3uPlaylist {
        val entries = ArrayList<MediaEntry>()
        val decisive = java.util.BitSet()
        var pendingInfo: String? = null
        var order = 0
        var epgUrl = ""

        lines.forEach { rawLine ->
            val line = rawLine.trim().removePrefix("\uFEFF")
            when {
                line.isEmpty() -> Unit
                line.startsWith("#EXTM3U", ignoreCase = true) -> {
                    if (epgUrl.isEmpty()) epgUrl = headerEpgUrl(line)
                }
                line.startsWith("#EXTINF", ignoreCase = true) -> pendingInfo = line
                line.startsWith("#") -> Unit
                else -> {
                    val info = pendingInfo
                    if (info != null) {
                        if (pathKind(line) != null) decisive.set(entries.size)
                        entries += buildEntry(info, line, order++, nowMs)
                        pendingInfo = null
                    }
                }
            }
        }
        val settled = settleKinds(entries, decisive)
        return groupEpisodes(dedupeMovies(settled), epgUrl)
    }

    /** Groups loose episodes of an already parsed list (catalogs saved by older builds). */
    fun regroupSeries(entries: List<MediaEntry>): M3uPlaylist =
        groupEpisodes(dedupeMovies(entries), "")

    /** The first guide address in `url-tvg` / `x-tvg-url`, which may list several separated by commas. */
    private fun headerEpgUrl(header: String): String {
        val attributes = attributeRegex.findAll(header).associate { it.groupValues[1].lowercase() to it.groupValues[2] }
        val raw = attributes["url-tvg"] ?: attributes["x-tvg-url"] ?: attributes["tvg-url"] ?: return ""
        return raw.split(',', ' ').map { it.trim() }.firstOrNull { it.startsWith("http", ignoreCase = true) }.orEmpty()
    }

    /**
     * The same film listed twice in one category (same title and year, or the
     * very same address) is shown once.
     */
    private fun dedupeMovies(entries: List<MediaEntry>): List<MediaEntry> {
        val seenUrls = HashSet<String>()
        val seenTitles = HashSet<String>()
        return entries.filter { entry ->
            if (entry.kind != MediaKind.MOVIE) return@filter true
            val titleKey = "${entry.group}|${LiveLeakFilter.normalize(entry.title)}|${entry.year ?: 0}|${entry.quality.orEmpty()}"
            seenUrls.add(entry.streamUrl) && seenTitles.add(titleKey)
        }
    }

    private val seasonEpisodeRegex = Regex("""[Ss](\d{1,2})\s?[Ee][Pp]?\s?(\d{1,4})""")
    private val seasonXEpisodeRegex = Regex("""\b(\d{1,2})x(\d{1,3})\b""")

    /**
     * An m3u playlist lists every episode as its own line, so a provider with a
     * few thousand series ships hundreds of thousands of them. Episodes of the
     * same show (same name before "S01E02", same category) become one series
     * entry; its episodes are kept aside for the series page.
     */
    private fun groupEpisodes(entries: List<MediaEntry>, epgUrl: String): M3uPlaylist {
        val result = ArrayList<MediaEntry>(entries.size)
        val seriesIndex = HashMap<String, Int>()
        val episodes = HashMap<String, MutableList<Episode>>()

        entries.forEach { entry ->
            if (entry.kind != MediaKind.SERIES) {
                result += entry
                return@forEach
            }
            val match = seasonEpisodeRegex.find(entry.title) ?: seasonXEpisodeRegex.find(entry.title)
            val showName = (match?.let { entry.title.substring(0, it.range.first) } ?: entry.title)
                .trim().trimEnd('-', '|', ':', '·', '.', '_').trim()
                .ifEmpty { entry.title }
            val season = match?.groupValues?.get(1)?.toIntOrNull() ?: 1
            val number = match?.groupValues?.get(2)?.toIntOrNull()
            val key = "${entry.group}|${showName.lowercase(Locale.ROOT).replace(Regex("[^\\p{L}\\p{N}]"), "")}"
            val seriesId = "m3u:${key.hashCode()}_${entry.providerOrder}"

            val existing = seriesIndex[key]
            val id = if (existing == null) {
                seriesIndex[key] = result.size
                result += entry.copy(
                    id = "m3useries_${key.hashCode()}_${entry.providerOrder}",
                    title = showName,
                    seriesId = seriesId,
                )
                seriesId
            } else {
                result[existing].seriesId.orEmpty()
            }
            val list = episodes.getOrPut(id) { ArrayList() }
            list += Episode(
                id = entry.id,
                title = entry.title,
                season = season,
                number = number ?: (list.count { it.season == season } + 1),
                streamUrl = entry.streamUrl,
                thumbUrl = entry.logoUrl,
            )
        }

        val sorted = episodes.mapValues { (_, list) ->
            list.distinctBy { it.streamUrl }.sortedWith(compareBy({ it.season }, { it.number }))
        }
        result.trimToSize()
        return M3uPlaylist(result, sorted, epgUrl)
    }

    /**
     * Second pass over the playlist. An entry whose address does not say what it
     * is (no /live/, /movie/ or /series/ in the path) takes the kind most of its
     * group has: a live group's cover card, which providers often point at a
     * placeholder .mp4, stays in Live TV instead of landing among the films.
     * Films that are really live category covers or channels are then moved back.
     */
    private fun settleKinds(entries: ArrayList<MediaEntry>, decisive: java.util.BitSet): List<MediaEntry> {
        val tally = HashMap<String, IntArray>()
        entries.forEach { entry ->
            tally.getOrPut(entry.group) { IntArray(MediaKind.entries.size) }[entry.kind.ordinal]++
        }
        val majority = tally.mapValues { (_, counts) ->
            MediaKind.entries[counts.indices.maxBy { counts[it] }]
        }

        val liveGroups = HashSet<String>()
        val liveNames = ArrayList<String>()
        entries.forEachIndexed { index, entry ->
            if (!decisive[index]) {
                val groupKind = majority[entry.group] ?: entry.kind
                if (groupKind != entry.kind && (groupKind == MediaKind.LIVE || entry.kind == MediaKind.LIVE)) {
                    entries[index] = entry.copy(kind = groupKind)
                }
            }
            if (entries[index].kind == MediaKind.LIVE) {
                liveGroups += entry.group
                liveNames += entry.title
            }
        }

        val leaks = LiveLeakFilter(liveGroups, liveNames)
        if (leaks.isEmpty) {
            entries.trimToSize()
            return entries
        }
        val result = ArrayList<MediaEntry>(entries.size)
        entries.forEachIndexed { index, entry ->
            when {
                entry.kind != MediaKind.MOVIE || !leaks.isLiveLeak(entry.title, entry.group) -> result += entry
                // A /movie/ address cannot play as a channel: the cover card is simply left out.
                decisive[index] -> Unit
                else -> result += entry.copy(kind = MediaKind.LIVE)
            }
        }
        return result
    }

    /** What the stream address says, when it follows the usual /live/, /movie/, /series/ layout. */
    private fun pathKind(url: String): MediaKind? {
        val lower = url.lowercase()
        return when {
            "/movie/" in lower -> MediaKind.MOVIE
            "/series/" in lower -> MediaKind.SERIES
            "/live/" in lower -> MediaKind.LIVE
            else -> null
        }
    }

    private fun buildEntry(info: String, url: String, order: Int, nowMs: Long): MediaEntry {
        val attributes = attributeRegex.findAll(info).associate { it.groupValues[1].lowercase() to it.groupValues[2] }
        val rawTitle = info.substringAfter(",", "").trim().ifEmpty {
            attributes["tvg-name"].orEmpty().ifEmpty { "Senza titolo" }
        }
        val group = attributes["group-title"].orEmpty().ifBlank { "Senza categoria" }
        val kind = classify(group, url, rawTitle)
        val year = extractYear(rawTitle)
        val quality = qualityRegex.find(rawTitle)?.value?.uppercase()

        return MediaEntry(
            id = buildId(attributes["tvg-id"], url, order),
            title = cleanTitle(rawTitle),
            kind = kind,
            group = group,
            logoUrl = attributes["tvg-logo"]?.takeIf { it.isNotBlank() },
            streamUrl = url,
            year = year,
            providerOrder = order,
            addedEpochMs = nowMs,
            quality = quality,
            tvgId = attributes["tvg-id"]?.takeIf { it.isNotBlank() },
        )
    }

    private fun buildId(tvgId: String?, url: String, order: Int): String {
        val base = tvgId?.takeIf { it.isNotBlank() } ?: url
        return "${base.hashCode()}_$order"
    }

    private val episodePattern = Regex("s\\d{1,2}\\s?e\\d{1,2}", RegexOption.IGNORE_CASE)

    private fun classify(group: String, url: String, title: String): MediaKind {
        pathKind(url)?.let { return it }
        val haystack = "${group.lowercase()} ${url.lowercase()}"
        val seriesHints = listOf("serie", "series", "tv show", "stagione", "season")
        // "cinema" is left out on purpose: it names live channel groups too (Sky Cinema, Cinema Uno).
        val movieHints = listOf("/vod/", "film", "movie", "vod")

        return when {
            seriesHints.any { haystack.contains(it) } || episodePattern.containsMatchIn(title) -> MediaKind.SERIES
            movieHints.any { haystack.contains(it) } -> MediaKind.MOVIE
            url.endsWith(".mp4", true) || url.endsWith(".mkv", true) || url.endsWith(".avi", true) -> MediaKind.MOVIE
            else -> MediaKind.LIVE
        }
    }

    /** Reads the release year the provider embedded in the title, e.g. "Dune (2024)". */
    fun extractYear(title: String): Int? {
        parenYearRegex.find(title)?.groupValues?.get(1)?.toIntOrNull()?.let { return it }
        val loose = looseYearRegex.find(title)?.groupValues?.get(1)?.toIntOrNull() ?: return null
        return loose.takeIf { it in 1900..2100 }
    }

    private fun cleanTitle(title: String): String = title
        .replace(parenYearRegex, "")
        .replace(Regex("\\s{2,}"), " ")
        .trim()
        .trim('-', '|', '·')
        .trim()
        .ifEmpty { title }
}
