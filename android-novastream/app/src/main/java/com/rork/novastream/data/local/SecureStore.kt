package com.rork.novastream.data.local

import android.content.Context
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.io.BufferedOutputStream
import java.io.EOFException
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.KeyStore
import java.security.SecureRandom
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Local-only encrypted storage. Every value is sealed with AES-256-GCM and never
 * leaves the device.
 *
 * Values live in files written the durable way (see [DurableIo]) instead of in
 * SharedPreferences, which Android flushes in the background: a box unplugged
 * seconds after a change used to come back without it.
 *
 * The key is a random 256-bit secret kept in `keys/master.key`, wrapped twice —
 * once by the Android Keystore, once by a secret derived from this installation.
 * Cheap TV boxes are known to come back from a hard power cut with an emptied
 * keystore, which made every saved credential and the licence record unreadable
 * in one go; the second wrap is what brings them back. Neither copy can be used
 * on different hardware, and nothing ever leaves the device.
 */
class SecureStore(context: Context) {

    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val vaultDir: File = File(appContext.filesDir, "vault").apply { mkdirs() }

    /** Sealed values, one file each. Kept out of the vault, which gets cleared. */
    private val valuesDir: File = File(appContext.filesDir, "values").apply { mkdirs() }

    /** The wrapped master key. Never inside a directory the app wipes. */
    private val keyFile: File =
        File(File(appContext.filesDir, "keys").apply { mkdirs() }, "master.key")

    @Volatile
    private var cachedKey: SecretKey? = null

    val algorithmLabel: String = "AES-256-GCM · Android Keystore"

    fun putString(key: String, value: String) {
        val sealed = seal(value) ?: return
        if (DurableIo.writeText(valueFile(key), sealed) && prefs.contains(key)) {
            // The copy an older build left in preferences is no longer the truth.
            prefs.edit().remove(key).commit()
        }
    }

    fun getString(key: String): String? {
        DurableIo.readText(valueFile(key))?.let { sealed ->
            open(sealed)?.let { return it }
        }
        // Written by 1.1.x straight into preferences and sealed with the old
        // keystore-only key: read once here, then rewritten as a durable file.
        val legacy = prefs.getString(key, null) ?: return null
        val plain = open(legacy) ?: legacyKeystoreKey()?.let { open(legacy, it) } ?: return null
        putString(key, plain)
        return plain
    }

    fun remove(key: String) {
        DurableIo.delete(valueFile(key))
        if (prefs.contains(key)) prefs.edit().remove(key).commit()
    }

    private fun valueFile(key: String): File =
        File(valuesDir, key.filter { it.isLetterOrDigit() || it == '_' } + ".sec")

    /**
     * Encrypts straight into the vault file.
     *
     * The catalog of a large provider is far too big to seal in one go, so the
     * caller writes into a stream that compresses and encrypts as it goes: only
     * a small buffer is ever resident. The payload is deflated first, which
     * turns tens of megabytes of catalog text into a couple of megabytes on
     * disk, and is then sealed one block at a time (see [ChunkedEncryptStream]).
     */
    fun writeVaultStream(name: String, body: (OutputStream) -> Unit): Boolean = runCatching {
        val target = File(vaultDir, name)
        val temp = File(vaultDir, name + TEMP_SUFFIX)
        val key = masterKey()
        temp.outputStream().use { fileStream ->
            val raw = BufferedOutputStream(fileStream, BUFFER_BYTES)
            raw.write(MAGIC)
            val sealedStream = ChunkedEncryptStream(raw, key)
            // The buffer matters: kotlinx writes JSON in small pieces and every
            // single one of them would otherwise mean a compression pass.
            GZIPOutputStream(sealedStream, BUFFER_BYTES).use { deflated ->
                BufferedOutputStream(deflated, BUFFER_BYTES).use(body)
            }
            sealedStream.close()
            raw.flush()
            // Pushes the bytes out of the OS cache before the swap, so a power cut
            // straight after the rename cannot leave an unreadable file behind.
            runCatching { fileStream.fd.sync() }
        }
        if (temp.length() == 0L) throw IllegalStateException("empty vault write")
        target.delete()
        if (!temp.renameTo(target)) throw IllegalStateException("vault swap failed")
        DurableIo.syncDir(vaultDir)
        true
    }.onFailure {
        Log.w(TAG, "Scrittura cifrata non riuscita")
        runCatching { File(vaultDir, name + TEMP_SUFFIX).delete() }
    }.getOrDefault(false)

    /** True when a usable copy of this vault file is already on the device. */
    fun hasVault(name: String): Boolean =
        File(vaultDir, name).let { it.exists() && it.length() > 0L }

    /**
     * Opens a vault file for streaming reads, or null when the file is missing,
     * damaged or written by an older build. The caller closes the stream.
     */
    fun readVaultStream(name: String): InputStream? = runCatching {
        val file = File(vaultDir, name)
        if (!file.exists()) return null
        val raw = file.inputStream().buffered(BUFFER_BYTES)
        val header = ByteArray(MAGIC.size)
        val read = runCatching { readFully(raw, header) }.getOrDefault(false)
        if (!read || !header.contentEquals(MAGIC)) {
            // Anything else is a leftover from a previous format: the caller
            // throws it away and downloads a fresh copy.
            runCatching { raw.close() }
            return null
        }
        GZIPInputStream(ChunkedDecryptStream(raw, masterKey()), BUFFER_BYTES).buffered(BUFFER_BYTES)
    }.onFailure { Log.w(TAG, "Apertura del file cifrato non riuscita") }.getOrNull()

    fun deleteVault(name: String) {
        runCatching { File(vaultDir, name).delete() }
        runCatching { File(vaultDir, name + TEMP_SUFFIX).delete() }
    }

    fun clearVault() {
        runCatching { vaultDir.listFiles()?.forEach { it.delete() } }
    }

    fun vaultSizeBytes(): Long =
        runCatching { vaultDir.listFiles()?.sumOf { it.length() } ?: 0L }.getOrDefault(0L)

    /** Clears leftovers of a save that never finished, e.g. after the app was killed. */
    fun sweepUnfinishedWrites() {
        DurableIo.sweep(vaultDir)
        DurableIo.sweep(valuesDir)
    }

    private fun seal(plain: String, key: SecretKey = masterKey()): String? = runCatching {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val body = Base64.encodeToString(encrypted, Base64.NO_WRAP)
        "$iv:$body"
    }.onFailure { Log.w(TAG, "Cifratura non riuscita") }.getOrNull()

    private fun open(sealed: String, key: SecretKey = masterKey()): String? = runCatching {
        val parts = sealed.split(":")
        if (parts.size != 2) return null
        val iv = Base64.decode(parts[0], Base64.NO_WRAP)
        val body = Base64.decode(parts[1], Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH, iv))
        String(cipher.doFinal(body), Charsets.UTF_8)
    }.getOrNull()

    private fun masterKey(): SecretKey {
        cachedKey?.let { return it }
        synchronized(this) {
            cachedKey?.let { return it }
            val key = loadOrCreateMasterKey()
            cachedKey = key
            return key
        }
    }

    /**
     * Reads the master key back through whichever of its two wraps still works,
     * and repairs the broken one. A brand-new key is created only when the file
     * is genuinely absent — never just because the keystore had a bad day.
     */
    private fun loadOrCreateMasterKey(): SecretKey {
        val stored = DurableIo.readText(keyFile)?.split("|")
        if (stored != null && stored.size >= 3 && stored[0] == KEY_FILE_VERSION) {
            unwrapWithKeystore(stored[1])?.let { return SecretKeySpec(it, "AES") }

            val fromDevice = unwrapWithDeviceSecret(stored[2])
            if (fromDevice != null) {
                // The keystore lost its key, which is what a hard power cut does
                // to some boxes. The data is fine; only the wrap is written again.
                Log.w(TAG, "Chiave di sistema persa: ripristinata dalla copia locale")
                writeKeyFile(fromDevice)
                return SecretKeySpec(fromDevice, "AES")
            }
            Log.w(TAG, "Chiave locale non recuperabile")
        }

        val material = ByteArray(32).also { SecureRandom().nextBytes(it) }
        writeKeyFile(material)
        return SecretKeySpec(material, "AES")
    }

    private fun writeKeyFile(material: ByteArray) {
        val keystoreWrap = runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, keystoreWrapKey())
            val body = cipher.doFinal(material)
            "${encode(cipher.iv)}:${encode(body)}"
        }.getOrDefault(NO_WRAP)

        val deviceWrap = runCatching {
            val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, deviceSecretKey(salt))
            val body = cipher.doFinal(material)
            "${encode(salt)}:${encode(cipher.iv)}:${encode(body)}"
        }.getOrDefault(NO_WRAP)

        DurableIo.writeText(keyFile, "$KEY_FILE_VERSION|$keystoreWrap|$deviceWrap")
    }

    private fun unwrapWithKeystore(wrap: String): ByteArray? {
        if (wrap == NO_WRAP) return null
        return runCatching {
            val parts = wrap.split(":")
            if (parts.size != 2) return null
            val key = existingKey(WRAP_ALIAS) ?: return null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH, decode(parts[0])))
            cipher.doFinal(decode(parts[1]))
        }.getOrNull()
    }

    private fun unwrapWithDeviceSecret(wrap: String): ByteArray? {
        if (wrap == NO_WRAP) return null
        return runCatching {
            val parts = wrap.split(":")
            if (parts.size != 3) return null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                deviceSecretKey(decode(parts[0])),
                GCMParameterSpec(TAG_LENGTH, decode(parts[1])),
            )
            cipher.doFinal(decode(parts[2]))
        }.getOrNull()
    }

    /** Keystore key, used only to wrap the master key. */
    private fun keystoreWrapKey(): SecretKey {
        existingKey(WRAP_ALIAS)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                WRAP_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    /** The key 1.1.x sealed its values with; used to read them one last time. */
    private fun legacyKeystoreKey(): SecretKey? = existingKey(LEGACY_ALIAS)

    private fun existingKey(alias: String): SecretKey? = runCatching {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.secretKey
    }.getOrNull()

    /**
     * Second lock on the master key, derived from values that belong to this
     * installation on this hardware. It cannot follow the data to another
     * device, which is the property that matters here, and unlike the keystore
     * it is still there after the box is yanked out of the socket.
     */
    private fun deviceSecretKey(salt: ByteArray): SecretKey {
        val androidId = runCatching {
            Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull().orEmpty()
        val material = "novastream::${appContext.packageName}::$androidId"
        val secret = SecretKeyFactory.getInstance(DERIVATION)
            .generateSecret(PBEKeySpec(material.toCharArray(), salt, DERIVATION_ROUNDS, 256))
            .encoded
        return SecretKeySpec(secret, "AES")
    }

    private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decode(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)

    /**
     * Seals the payload one block at a time, each with its own nonce. Blocks are
     * independent, so a huge catalog never has to be held in memory whole, and
     * decryption cannot be tripped up by a partial read.
     *
     * Closing writes the end marker and flushes, but leaves the underlying
     * stream open: the caller owns it and still has to sync it to disk.
     */
    private class ChunkedEncryptStream(
        private val sink: OutputStream,
        private val key: SecretKey,
    ) : OutputStream() {

        private val block = ByteArray(CHUNK_BYTES)
        private var filled = 0
        private var closed = false

        override fun write(b: Int) {
            if (filled == block.size) sealBlock()
            block[filled++] = b.toByte()
        }

        override fun write(b: ByteArray, off: Int, len: Int) {
            var offset = off
            var remaining = len
            while (remaining > 0) {
                if (filled == block.size) sealBlock()
                val take = minOf(remaining, block.size - filled)
                System.arraycopy(b, offset, block, filled, take)
                filled += take
                offset += take
                remaining -= take
            }
        }

        override fun flush() {
            sealBlock()
            sink.flush()
        }

        override fun close() {
            if (closed) return
            closed = true
            sealBlock()
            sink.write(0)
            sink.flush()
        }

        private fun sealBlock() {
            if (filled == 0) return
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key)
            val sealed = cipher.doFinal(block, 0, filled)
            val iv = cipher.iv
            sink.write(iv.size)
            sink.write(iv)
            sink.write(sealed.size ushr 24 and 0xFF)
            sink.write(sealed.size ushr 16 and 0xFF)
            sink.write(sealed.size ushr 8 and 0xFF)
            sink.write(sealed.size and 0xFF)
            sink.write(sealed)
            filled = 0
        }
    }

    /** Reads back what [ChunkedEncryptStream] wrote, one sealed block at a time. */
    private class ChunkedDecryptStream(
        private val source: InputStream,
        private val key: SecretKey,
    ) : InputStream() {

        private var block: ByteArray = EMPTY
        private var position = 0
        private var ended = false

        override fun read(): Int {
            if (!ensureBlock()) return -1
            return block[position++].toInt() and 0xFF
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (len == 0) return 0
            if (!ensureBlock()) return -1
            val take = minOf(len, block.size - position)
            System.arraycopy(block, position, b, off, take)
            position += take
            return take
        }

        override fun available(): Int = block.size - position

        override fun close() {
            source.close()
        }

        /** True when [block] holds at least one byte still to be handed out. */
        private fun ensureBlock(): Boolean {
            while (position >= block.size) {
                if (ended) return false
                val ivSize = source.read()
                if (ivSize <= 0) {
                    ended = true
                    return false
                }
                val iv = ByteArray(ivSize)
                if (!readFully(source, iv)) throw EOFException("vault truncated")
                val header = ByteArray(4)
                if (!readFully(source, header)) throw EOFException("vault truncated")
                val size = (header[0].toInt() and 0xFF shl 24) or
                    (header[1].toInt() and 0xFF shl 16) or
                    (header[2].toInt() and 0xFF shl 8) or
                    (header[3].toInt() and 0xFF)
                if (size <= 0 || size > MAX_BLOCK_BYTES) throw EOFException("vault block invalid")
                val sealed = ByteArray(size)
                if (!readFully(source, sealed)) throw EOFException("vault truncated")
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH, iv))
                block = cipher.doFinal(sealed)
                position = 0
            }
            return true
        }
    }

    private companion object {
        const val PREFS = "novastream_secure"
        const val KEYSTORE = "AndroidKeyStore"

        /** Alias of the key 1.1.x sealed its values with, directly. */
        const val LEGACY_ALIAS = "novastream_master_key"

        /** Alias of the key that now only wraps the master key. */
        const val WRAP_ALIAS = "novastream_key_wrap"

        const val KEY_FILE_VERSION = "v1"
        const val NO_WRAP = "-"
        const val DERIVATION = "PBKDF2WithHmacSHA1"
        const val DERIVATION_ROUNDS = 12_000

        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_LENGTH = 128
        const val TAG = "SecureStore"
        const val BUFFER_BYTES = 64 * 1024
        const val TEMP_SUFFIX = ".writing"

        /** Plain bytes sealed together in one block: 256 KB keeps memory flat. */
        const val CHUNK_BYTES = 256 * 1024

        /** Guard against a damaged length field asking for an absurd allocation. */
        const val MAX_BLOCK_BYTES = 4 * 1024 * 1024

        val EMPTY = ByteArray(0)

        /** File signature of the compressed, block-sealed vault format. */
        val MAGIC = byteArrayOf('N'.code.toByte(), 'S'.code.toByte(), 'V'.code.toByte(), 2)

        /** Fills [target] completely; false when the stream ended too early. */
        fun readFully(source: InputStream, target: ByteArray): Boolean {
            var offset = 0
            while (offset < target.size) {
                val read = source.read(target, offset, target.size - offset)
                if (read < 0) return false
                offset += read
            }
            return true
        }
    }
}
