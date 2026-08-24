package com.rork.novastream.data.local

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Base64InputStream
import android.util.Base64OutputStream
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Local-only encrypted storage. Every value is sealed with an AES-256-GCM key that is
 * generated inside the Android Keystore and never leaves the device.
 */
class SecureStore(context: Context) {

    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val vaultDir: File = File(appContext.filesDir, "vault").apply { mkdirs() }

    val algorithmLabel: String = "AES-256-GCM · Android Keystore"

    fun putString(key: String, value: String) {
        val sealed = seal(value) ?: return
        prefs.edit().putString(key, sealed).apply()
    }

    fun getString(key: String): String? {
        val stored = prefs.getString(key, null) ?: return null
        return open(stored)
    }

    fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    fun writeVault(name: String, content: String) {
        val sealed = seal(content) ?: return
        runCatching { File(vaultDir, name).writeText(sealed) }
            .onFailure { Log.w(TAG, "Impossibile scrivere il file cifrato") }
    }

    fun readVault(name: String): String? {
        val file = File(vaultDir, name)
        if (!file.exists()) return null
        return runCatching { open(file.readText()) }.getOrNull()
    }

    /**
     * Encrypts straight into the vault file.
     *
     * The catalog of a large provider is far too big to seal in one go: that
     * would hold the text, its bytes, the encrypted copy and the Base64 copy in
     * memory at the same time. Here the caller writes into a stream that
     * encrypts and encodes as it goes, so only a small buffer is ever resident.
     * The file format is unchanged, so vaults written earlier still open.
     */
    fun writeVaultStream(name: String, body: (OutputStream) -> Unit): Boolean = runCatching {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        File(vaultDir, name).outputStream().buffered(BUFFER_BYTES).use { raw ->
            raw.write(Base64.encodeToString(cipher.iv, Base64.NO_WRAP).toByteArray(Charsets.UTF_8))
            raw.write(SEPARATOR.code)
            CipherOutputStream(Base64OutputStream(raw, Base64.NO_WRAP), cipher).use(body)
        }
        true
    }.onFailure { Log.w(TAG, "Scrittura cifrata non riuscita") }.getOrDefault(false)

    /** Opens a vault file for streaming reads. The caller closes the stream. */
    fun readVaultStream(name: String): InputStream? = runCatching {
        val file = File(vaultDir, name)
        if (!file.exists()) return null
        val raw = file.inputStream().buffered(BUFFER_BYTES)
        val ivText = ByteArrayOutputStream()
        while (true) {
            val byte = raw.read()
            if (byte == -1 || byte == SEPARATOR.code) break
            ivText.write(byte)
        }
        val iv = Base64.decode(ivText.toByteArray(), Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(TAG_LENGTH, iv))
        CipherInputStream(Base64InputStream(raw, Base64.NO_WRAP), cipher)
    }.onFailure { Log.w(TAG, "Apertura del file cifrato non riuscita") }.getOrNull()

    fun deleteVault(name: String) {
        runCatching { File(vaultDir, name).delete() }
    }

    fun clearVault() {
        runCatching { vaultDir.listFiles()?.forEach { it.delete() } }
    }

    fun vaultSizeBytes(): Long =
        runCatching { vaultDir.listFiles()?.sumOf { it.length() } ?: 0L }.getOrDefault(0L)

    private fun seal(plain: String): String? = runCatching {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val body = Base64.encodeToString(encrypted, Base64.NO_WRAP)
        "$iv:$body"
    }.onFailure { Log.w(TAG, "Cifratura non riuscita") }.getOrNull()

    private fun open(sealed: String): String? = runCatching {
        val parts = sealed.split(":")
        if (parts.size != 2) return null
        val iv = Base64.decode(parts[0], Base64.NO_WRAP)
        val body = Base64.decode(parts[1], Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(TAG_LENGTH, iv))
        String(cipher.doFinal(body), Charsets.UTF_8)
    }.onFailure { Log.w(TAG, "Decifratura non riuscita") }.getOrNull()

    private fun masterKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val existing = keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry
        existing?.secretKey?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val PREFS = "novastream_secure"
        const val KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "novastream_master_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_LENGTH = 128
        const val TAG = "SecureStore"
        const val SEPARATOR = ':'
        const val BUFFER_BYTES = 64 * 1024
    }
}
