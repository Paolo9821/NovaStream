package com.rork.novastream.data.parser

import android.util.Log
import android.util.Xml
import com.rork.novastream.data.model.EpgGuide
import com.rork.novastream.data.model.Programme
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.GZIPInputStream

/**
 * Streaming parser for XMLTV electronic programme guides.
 * Only programmes inside the requested time window are kept, which keeps the
 * encrypted guide small enough to store on the device.
 */
object XmltvParser {

    private const val TAG = "XmltvParser"
    private val withZone = SimpleDateFormat("yyyyMMddHHmmss Z", Locale.US)
    private val withoutZone = SimpleDateFormat("yyyyMMddHHmmss", Locale.US)

    /** Normalizes a channel name so playlists and guides can be matched by title. */
    fun normalizeName(value: String): String = value
        .lowercase(Locale.ROOT)
        .replace(Regex("\\(.*?\\)"), " ")
        .replace(Regex("\\b(hd|fhd|uhd|4k|sd|full ?hd)\\b"), " ")
        .replace(Regex("[^a-z0-9]"), "")

    fun parse(
        bytes: ByteArray,
        sourceUrl: String,
        windowStartMs: Long,
        windowEndMs: Long,
    ): EpgGuide {
        val programmes = HashMap<String, MutableList<Programme>>()
        val nameIndex = HashMap<String, String>()

        openStream(bytes).use { stream ->
            val parser = Xml.newPullParser()
            parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
            parser.setInput(stream, null)

            var event = parser.eventType
            while (event != XmlPullParser.END_DOCUMENT) {
                if (event == XmlPullParser.START_TAG) {
                    when (parser.name.lowercase(Locale.ROOT)) {
                        "channel" -> readChannel(parser, nameIndex)
                        "programme" -> readProgramme(parser, windowStartMs, windowEndMs)
                            ?.let { (channelId, programme) ->
                                programmes.getOrPut(channelId) { ArrayList() }.add(programme)
                            }
                    }
                }
                event = parser.next()
            }
        }

        val sorted = programmes.mapValues { (_, list) -> list.sortedBy { it.startEpochMs } }
        return EpgGuide(
            sourceUrl = sourceUrl,
            updatedAtEpochMs = System.currentTimeMillis(),
            byChannel = sorted,
            nameIndex = nameIndex,
        )
    }

    private fun openStream(bytes: ByteArray): InputStream {
        val raw = ByteArrayInputStream(bytes)
        val gzipped = bytes.size > 2 &&
            bytes[0] == 0x1f.toByte() &&
            bytes[1] == 0x8b.toByte()
        return if (gzipped) GZIPInputStream(raw) else raw
    }

    private fun readChannel(parser: XmlPullParser, nameIndex: MutableMap<String, String>) {
        val channelId = parser.getAttributeValue(null, "id")?.lowercase(Locale.ROOT) ?: return
        var depth = 1
        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> {
                    depth++
                    if (parser.name.equals("display-name", ignoreCase = true)) {
                        val text = readText(parser)
                        depth--
                        val key = normalizeName(text)
                        if (key.isNotEmpty()) nameIndex.putIfAbsent(key, channelId)
                    }
                }
                XmlPullParser.END_TAG -> depth--
                XmlPullParser.END_DOCUMENT -> return
            }
        }
        nameIndex.putIfAbsent(normalizeName(channelId), channelId)
    }

    private fun readProgramme(
        parser: XmlPullParser,
        windowStartMs: Long,
        windowEndMs: Long,
    ): Pair<String, Programme>? {
        val channelId = parser.getAttributeValue(null, "channel")?.lowercase(Locale.ROOT)
        val start = parseTime(parser.getAttributeValue(null, "start"))
        val stop = parseTime(parser.getAttributeValue(null, "stop"))

        var title = ""
        var description: String? = null
        var category: String? = null

        var depth = 1
        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> {
                    when (parser.name.lowercase(Locale.ROOT)) {
                        "title" -> {
                            if (title.isEmpty()) title = readText(parser)
                            else skipTag(parser)
                        }
                        "desc" -> {
                            if (description == null) description = readText(parser)
                            else skipTag(parser)
                        }
                        "category" -> {
                            if (category == null) category = readText(parser)
                            else skipTag(parser)
                        }
                        else -> skipTag(parser)
                    }
                }
                XmlPullParser.END_TAG -> depth--
                XmlPullParser.END_DOCUMENT -> depth = 0
            }
        }

        if (channelId.isNullOrBlank() || start == null || title.isBlank()) return null
        val end = stop ?: (start + 3_600_000L)
        if (end < windowStartMs || start > windowEndMs) return null

        return channelId to Programme(
            title = title,
            startEpochMs = start,
            stopEpochMs = end,
            description = description?.takeIf { it.isNotBlank() },
            category = category?.takeIf { it.isNotBlank() },
        )
    }

    /** Reads the text of the current START_TAG and consumes its END_TAG. */
    private fun readText(parser: XmlPullParser): String {
        val builder = StringBuilder()
        var depth = 1
        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.TEXT -> builder.append(parser.text)
                XmlPullParser.START_TAG -> depth++
                XmlPullParser.END_TAG -> depth--
                XmlPullParser.END_DOCUMENT -> depth = 0
            }
        }
        return builder.toString().trim()
    }

    private fun skipTag(parser: XmlPullParser) {
        var depth = 1
        while (depth > 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> depth++
                XmlPullParser.END_TAG -> depth--
                XmlPullParser.END_DOCUMENT -> depth = 0
            }
        }
    }

    private fun parseTime(raw: String?): Long? {
        val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return runCatching {
            if (value.length > 14) synchronized(withZone) { withZone.parse(value) }
            else synchronized(withoutZone) { withoutZone.parse(value) }
        }.onFailure { Log.w(TAG, "Formato data XMLTV non riconosciuto") }
            .getOrNull()
            ?.let { date: Date -> date.time }
    }
}
