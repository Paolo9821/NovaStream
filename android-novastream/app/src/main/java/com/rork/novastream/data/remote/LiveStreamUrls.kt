package com.rork.novastream.data.remote

/**
 * Live channels of an Xtream panel can be pulled two ways: as one continuous
 * MPEG-TS stream (`.ts`) or as HLS segments (`.m3u8`). The continuous stream
 * has no gaps between segments, so it is tried first; when a provider refuses
 * it the player goes back to HLS for that channel.
 */
object LiveStreamUrls {

    private val xtreamLive = Regex("""^(.+/live/[^/]+/[^/]+/[^/?#]+)\.(ts|m3u8)([?#].*)?$""", RegexOption.IGNORE_CASE)

    /** The address actually handed to the player for [url]. */
    fun forPlayback(url: String, useHls: Boolean): String {
        val match = xtreamLive.matchEntire(url) ?: return url
        val (base, _, tail) = match.destructured
        return base + (if (useHls) ".m3u8" else ".ts") + tail
    }

    /** True when [playbackUrl] is the continuous form and an HLS one can be tried instead. */
    fun canFallBack(playbackUrl: String): Boolean {
        val match = xtreamLive.matchEntire(playbackUrl) ?: return false
        return match.groupValues[2].equals("ts", ignoreCase = true)
    }
}
