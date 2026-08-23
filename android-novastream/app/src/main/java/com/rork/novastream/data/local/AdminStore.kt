package com.rork.novastream.data.local

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest

/** Where customers are sent when they tap "Buy a license". */
enum class SalesChannel { WHATSAPP, TELEGRAM, WEBSITE, EMAIL, SHARE }

/**
 * Owner-configured sales contact. [handle] holds the phone number, username,
 * URL or address depending on [channel].
 */
data class SalesConfig(
    val channel: SalesChannel = SalesChannel.SHARE,
    val handle: String = "",
    val storeName: String = "",
    val priceNote: String = "",
) {
    /** A channel is usable only once the owner filled the destination in. */
    val isConfigured: Boolean
        get() = channel == SalesChannel.SHARE || handle.isNotBlank()
}

/**
 * Holds the reseller contact shown to customers and the passphrase that opens the
 * hidden admin panel. Activation codes are derived offline by [LicenseCodes], so
 * the owner can issue them with no server involved.
 */
class AdminStore(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private val _sales = MutableStateFlow(load())
    val sales: StateFlow<SalesConfig> = _sales.asStateFlow()

    fun updateSales(config: SalesConfig) {
        prefs.edit()
            .putString(KEY_CHANNEL, config.channel.name)
            .putString(KEY_HANDLE, config.handle.trim())
            .putString(KEY_STORE_NAME, config.storeName.trim())
            .putString(KEY_PRICE_NOTE, config.priceNote.trim())
            .apply()
        _sales.value = load()
    }

    /** True while the owner still uses the passphrase shipped with the build. */
    val isUsingDefaultPassphrase: Boolean
        get() = prefs.getString(KEY_PASSPHRASE, null).isNullOrEmpty()

    fun verifyPassphrase(input: String): Boolean {
        val stored = prefs.getString(KEY_PASSPHRASE, null)
        val expected = stored ?: hash(DEFAULT_PASSPHRASE)
        return hash(input.trim()) == expected
    }

    /** Rejects anything shorter than 6 characters so the panel stays protected. */
    fun setPassphrase(newPassphrase: String): Boolean {
        val trimmed = newPassphrase.trim()
        if (trimmed.length < 6) return false
        prefs.edit().putString(KEY_PASSPHRASE, hash(trimmed)).apply()
        return true
    }

    private fun load(): SalesConfig = SalesConfig(
        channel = runCatching {
            SalesChannel.valueOf(prefs.getString(KEY_CHANNEL, null) ?: SalesChannel.SHARE.name)
        }.getOrDefault(SalesChannel.SHARE),
        handle = prefs.getString(KEY_HANDLE, "").orEmpty(),
        storeName = prefs.getString(KEY_STORE_NAME, "").orEmpty(),
        priceNote = prefs.getString(KEY_PRICE_NOTE, "").orEmpty(),
    )

    private fun hash(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest("novastream-admin::$value".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    companion object {
        /** Shipped default — the owner is prompted to replace it in the panel. */
        const val DEFAULT_PASSPHRASE = "novastream-admin"

        private const val PREFS = "novastream_admin"
        private const val KEY_CHANNEL = "sales_channel"
        private const val KEY_HANDLE = "sales_handle"
        private const val KEY_STORE_NAME = "sales_store_name"
        private const val KEY_PRICE_NOTE = "sales_price_note"
        private const val KEY_PASSPHRASE = "admin_passphrase"
    }
}
