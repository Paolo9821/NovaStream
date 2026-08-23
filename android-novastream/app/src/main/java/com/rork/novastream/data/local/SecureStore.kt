package com.rork.novastream.data.local

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
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
    }
}
