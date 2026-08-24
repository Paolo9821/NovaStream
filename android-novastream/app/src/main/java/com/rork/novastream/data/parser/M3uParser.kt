package com.rork.novastream.data.parser

import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind

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

    /**
     * Reads a playlist as it streams off the disk. Large providers ship files of
     * tens of megabytes, so the text is never held whole: only the entries built
     * from it stay in memory.
     */
    fun parse(lines: Sequence<String>, nowMs: Long): List<MediaEntry> {
        val entries = ArrayList<MediaEntry>()
        var pendingInfo: String? = null
        var order = 0

        lines.forEach { rawLine ->
            val line = rawLine.trim()
            when {
                line.isEmpty() -> Unit
                line.startsWith("#EXTINF", ignoreCase = true) -> pendingInfo = line
                line.startsWith("#") -> Unit
                else -> {
                    val info = pendingInfo
                    if (info != null) {
                        entries += buildEntry(info, line, order++, nowMs)
                        pendingInfo = null
                    }
                }
            }
        }
        entries.trimToSize()
        return entries
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

    private fun classify(group: String, url: String, title: String): MediaKind {
        val haystack = "${group.lowercase()} ${url.lowercase()}"
        val seriesHints = listOf("/series/", "serie", "series", "tv show", "stagione", "season")
        val movieHints = listOf("/movie/", "/vod/", "film", "movie", "cinema", "vod")
        val episodePattern = Regex("s\\d{1,2}\\s?e\\d{1,2}", RegexOption.IGNORE_CASE)

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
