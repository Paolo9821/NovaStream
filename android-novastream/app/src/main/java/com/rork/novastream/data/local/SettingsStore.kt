package com.rork.novastream.data.local

import android.content.Context
import com.rork.novastream.ui.i18n.Language
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.util.Locale

enum class ThemeMode { SYSTEM, LIGHT, DARK }

enum class DnsPreset(
    val primary: String,
    val secondary: String,
    val dohUrl: String,
) {
    SYSTEM("", "", ""),
    GOOGLE("8.8.8.8", "8.8.4.4", "https://dns.google/resolve"),
    CLOUDFLARE("1.1.1.1", "1.0.0.1", "https://cloudflare-dns.com/dns-query"),
    QUAD9("9.9.9.9", "149.112.112.112", "https://dns.quad9.net:5053/dns-query"),
    CUSTOM("", "", "");

    val addressLabel: String get() = if (primary.isEmpty()) "" else "$primary · $secondary"
}

data class AppSettings(
    val language: Language = Language.ENGLISH,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val dnsPreset: DnsPreset = DnsPreset.SYSTEM,
    val customDnsPrimary: String = "",
    val customDnsDohUrl: String = "",
    val bufferSeconds: Int = 30,
    val hardwareDecoding: Boolean = true,
    val autoplayNextEpisode: Boolean = true,
    val parentalEnabled: Boolean = false,
    val pinHash: String = "",
    val blockedGroups: Set<String> = emptySet(),
)

/** Non-sensitive preferences. The parental PIN is only ever stored as a salted hash. */
class SettingsStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("novastream_settings", Context.MODE_PRIVATE)

    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private fun load(): AppSettings = AppSettings(
        language = Language.fromCode(
            prefs.getString(KEY_LANGUAGE, null) ?: Locale.getDefault().language
        ),
        themeMode = runCatching { ThemeMode.valueOf(prefs.getString(KEY_THEME, null) ?: "SYSTEM") }
            .getOrDefault(ThemeMode.SYSTEM),
        dnsPreset = runCatching { DnsPreset.valueOf(prefs.getString(KEY_DNS, null) ?: "SYSTEM") }
            .getOrDefault(DnsPreset.SYSTEM),
        customDnsPrimary = prefs.getString(KEY_DNS_CUSTOM_IP, "").orEmpty(),
        customDnsDohUrl = prefs.getString(KEY_DNS_CUSTOM_DOH, "").orEmpty(),
        bufferSeconds = prefs.getInt(KEY_BUFFER, 30),
        hardwareDecoding = prefs.getBoolean(KEY_HW, true),
        autoplayNextEpisode = prefs.getBoolean(KEY_AUTOPLAY, true),
        parentalEnabled = prefs.getBoolean(KEY_PARENTAL, false),
        pinHash = prefs.getString(KEY_PIN, "").orEmpty(),
        blockedGroups = prefs.getStringSet(KEY_BLOCKED, emptySet())?.toSet() ?: emptySet(),
    )

    private fun persist(settings: AppSettings) {
        prefs.edit()
            .putString(KEY_LANGUAGE, settings.language.code)
            .putString(KEY_THEME, settings.themeMode.name)
            .putString(KEY_DNS, settings.dnsPreset.name)
            .putString(KEY_DNS_CUSTOM_IP, settings.customDnsPrimary)
            .putString(KEY_DNS_CUSTOM_DOH, settings.customDnsDohUrl)
            .putInt(KEY_BUFFER, settings.bufferSeconds)
            .putBoolean(KEY_HW, settings.hardwareDecoding)
            .putBoolean(KEY_AUTOPLAY, settings.autoplayNextEpisode)
            .putBoolean(KEY_PARENTAL, settings.parentalEnabled)
            .putString(KEY_PIN, settings.pinHash)
            .putStringSet(KEY_BLOCKED, settings.blockedGroups)
            .apply()
        _settings.value = settings
    }

    fun update(transform: (AppSettings) -> AppSettings) {
        persist(transform(_settings.value))
    }

    fun setPin(pin: String) {
        update { it.copy(pinHash = hashPin(pin), parentalEnabled = true) }
    }

    fun clearParental() {
        update { it.copy(pinHash = "", parentalEnabled = false, blockedGroups = emptySet()) }
    }

    fun verifyPin(pin: String): Boolean {
        val stored = _settings.value.pinHash
        return stored.isNotEmpty() && stored == hashPin(pin)
    }

    private fun hashPin(pin: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest("novastream::$pin".toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private companion object {
        const val KEY_LANGUAGE = "language"
        const val KEY_THEME = "theme_mode"
        const val KEY_DNS = "dns_preset"
        const val KEY_DNS_CUSTOM_IP = "dns_custom_ip"
        const val KEY_DNS_CUSTOM_DOH = "dns_custom_doh"
        const val KEY_BUFFER = "buffer_seconds"
        const val KEY_HW = "hardware_decoding"
        const val KEY_AUTOPLAY = "autoplay_next"
        const val KEY_PARENTAL = "parental_enabled"
        const val KEY_PIN = "parental_pin"
        const val KEY_BLOCKED = "parental_blocked_groups"
    }
}
