package com.rork.novastream.data.local

import android.content.Context
import android.util.Log
import java.io.BufferedOutputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * On-device store for the two big, non-sensitive files: the channel/movie/series
 * catalog and the TV guide.
 *
 * They are kept as compressed JSON with no encryption on top. The content is a
 * public listing already served by the provider, and every extra layer was one
 * more way for the file to come back unreadable after a reboot — which meant the
 * whole list had to be downloaded again at every launch. Credentials are a
 * different matter and stay sealed in [SecureStore].
 *
 * Writes are atomic: the new copy is built beside the old one, pushed to the
 * disk, and only then swapped in, so a power cut can never leave half a catalog
 * behind.
 */
class CatalogCache(context: Context) {

    private val dir: File = File(context.applicationContext.filesDir, "catalog").apply { mkdirs() }

    /** Streams JSON into a compressed file and swaps it in once complete. */
    fun write(name: String, body: (OutputStream) -> Unit): Boolean = runCatching {
        if (!dir.exists()) dir.mkdirs()
        val target = File(dir, name)
        val temp = File(dir, name + TEMP_SUFFIX)
        temp.outputStream().use { fileStream ->
            val raw = BufferedOutputStream(fileStream, BUFFER_BYTES)
            raw.write(MAGIC)
            // kotlinx writes JSON in small pieces; buffering on both sides of the
            // deflater keeps a 40 MB catalog from becoming millions of tiny passes.
            GZIPOutputStream(raw, BUFFER_BYTES).use { deflated ->
                BufferedOutputStream(deflated, BUFFER_BYTES).use(body)
            }
            raw.flush()
            runCatching { fileStream.fd.sync() }
        }
        if (temp.length() <= MAGIC.size) throw IllegalStateException("empty catalog write")
        target.delete()
        if (!temp.renameTo(target)) throw IllegalStateException("catalog swap failed")
        Log.i(TAG, "Catalogo salvato ($name, ${target.length() / 1024} KB)")
        true
    }.onFailure {
        Log.w(TAG, "Salvataggio del catalogo non riuscito")
        runCatching { File(dir, name + TEMP_SUFFIX).delete() }
    }.getOrDefault(false)

    /**
     * Opens a saved file for reading, or null when it is missing or was written
     * by an older build. The caller closes the stream.
     */
    fun read(name: String): InputStream? = runCatching {
        val file = File(dir, name)
        if (!file.exists() || file.length() <= MAGIC.size) return null
        val raw = file.inputStream().buffered(BUFFER_BYTES)
        val header = ByteArray(MAGIC.size)
        val complete = runCatching { raw.read(header) == header.size }.getOrDefault(false)
        if (!complete || !header.contentEquals(MAGIC)) {
            runCatching { raw.close() }
            return null
        }
        GZIPInputStream(raw, BUFFER_BYTES).buffered(BUFFER_BYTES)
    }.onFailure { Log.w(TAG, "Lettura del catalogo salvato non riuscita") }.getOrNull()

    fun has(name: String): Boolean = File(dir, name).let { it.exists() && it.length() > MAGIC.size }

    fun delete(name: String) {
        runCatching { File(dir, name).delete() }
        runCatching { File(dir, name + TEMP_SUFFIX).delete() }
    }

    fun clear() {
        runCatching { dir.listFiles()?.forEach { it.delete() } }
    }

    fun sizeBytes(): Long = runCatching { dir.listFiles()?.sumOf { it.length() } ?: 0L }
        .getOrDefault(0L)

    /** Drops leftovers of a save that never finished, e.g. after the app was killed. */
    fun sweepUnfinishedWrites() {
        runCatching {
            dir.listFiles()?.forEach { file ->
                if (file.name.endsWith(TEMP_SUFFIX)) file.delete()
            }
        }
    }

    private companion object {
        const val TAG = "CatalogCache"
        const val BUFFER_BYTES = 64 * 1024
        const val TEMP_SUFFIX = ".writing"

        /** File signature of the compressed catalog format. */
        val MAGIC = byteArrayOf('N'.code.toByte(), 'S'.code.toByte(), 'C'.code.toByte(), 1)
    }
}
