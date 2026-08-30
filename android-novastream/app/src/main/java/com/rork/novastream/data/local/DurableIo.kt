package com.rork.novastream.data.local

import android.system.Os
import android.system.OsConstants
import android.util.Log
import java.io.File

/**
 * Small file writes that survive a power cut.
 *
 * TV boxes are unplugged rather than shut down, and that is exactly when a
 * half-written file — or a rename the filesystem had not recorded yet — turns
 * into "the app forgot my playlist". Every write here therefore goes to a
 * scratch file, is pushed to the flash chip, and is only then renamed over the
 * real one; the directory itself is flushed too, because on ext4 the rename is
 * a directory change and would otherwise still be sitting in the cache.
 *
 * Android's own SharedPreferences are written in the background, so a box
 * losing power seconds after a change can come back without it. Anything the
 * customer would notice — credentials, licence, device identity — is stored
 * through this object instead.
 */
internal object DurableIo {

    private const val TAG = "DurableIo"
    private const val TEMP_SUFFIX = ".writing"

    fun writeBytes(file: File, bytes: ByteArray): Boolean = runCatching {
        val dir = file.parentFile ?: throw IllegalStateException("no parent directory")
        if (!dir.exists()) dir.mkdirs()
        val temp = File(dir, file.name + TEMP_SUFFIX)
        temp.outputStream().use { stream ->
            stream.write(bytes)
            stream.flush()
            stream.fd.sync()
        }
        // A plain rename replaces the old copy atomically; deleting first is only
        // a fallback for filesystems that refuse to overwrite.
        if (!temp.renameTo(file)) {
            file.delete()
            if (!temp.renameTo(file)) throw IllegalStateException("swap failed")
        }
        syncDir(dir)
        true
    }.onFailure {
        Log.w(TAG, "Scrittura durevole non riuscita")
        runCatching { file.parentFile?.let { File(it, file.name + TEMP_SUFFIX).delete() } }
    }.getOrDefault(false)

    fun writeText(file: File, text: String): Boolean =
        writeBytes(file, text.toByteArray(Charsets.UTF_8))

    fun readBytes(file: File): ByteArray? = runCatching {
        if (!file.exists() || file.length() == 0L) null else file.readBytes()
    }.getOrNull()

    fun readText(file: File): String? =
        readBytes(file)?.toString(Charsets.UTF_8)?.takeIf { it.isNotBlank() }

    fun delete(file: File) {
        runCatching { file.delete() }
        runCatching { file.parentFile?.let { File(it, file.name + TEMP_SUFFIX).delete() } }
        file.parentFile?.let { syncDir(it) }
    }

    /** Drops scratch files left behind by a write that never finished. */
    fun sweep(dir: File) {
        runCatching {
            dir.listFiles()?.forEach { if (it.name.endsWith(TEMP_SUFFIX)) it.delete() }
        }
    }

    /**
     * Flushes a directory entry, which is what makes the rename above durable.
     * Java has no API for it, so the POSIX call is used directly.
     */
    fun syncDir(dir: File) {
        runCatching {
            val descriptor = Os.open(dir.absolutePath, OsConstants.O_RDONLY, 0)
            try {
                Os.fsync(descriptor)
            } finally {
                Os.close(descriptor)
            }
        }
    }
}
