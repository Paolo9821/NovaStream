package com.rork.novastream.data.local

import android.content.Context
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.i18n.Language
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.util.Locale

enum class ThemeMode { SYSTEM, LIGHT, DARK }

/** Which kind of device the app is running on, chosen once during onboarding. */
enum class DeviceProfile { PHONE, TV }

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

/**
 * How often the catalog is refreshed on its own. The provider list changes far
 * less than the guide, so a daily pass is plenty and a manual refresh is always
 * available from Home and from Settings.
 */
enum class CatalogUpdateInterval(val days: Int) {
    MANUAL(0),
    DAILY(1),
    EVERY_2_DAYS(2),
    EVERY_3_DAYS(3),
    WEEKLY(7);

    val intervalMs: Long get() = days * 24L * 60 * 60 * 1000
}

data class AppSettings(
    val onboardingDone: Boolean = false,
    val deviceProfile: DeviceProfile = DeviceProfile.PHONE,
    val language: Language = Language.ENGLISH,
    /**
     * Dark by default on every device: this is a television app watched in a
     * dark room, and a white canvas lights up the whole lounge. Anyone who
     * prefers otherwise switches it in Settings.
     */
    val themeMode: ThemeMode = ThemeMode.DARK,
    val dnsPreset: DnsPreset = DnsPreset.SYSTEM,
    val customDnsPrimary: String = "",
    val customDnsDohUrl: String = "",
    val bufferSeconds: Int = 30,
    val hardwareDecoding: Boolean = true,
    val autoplayNextEpisode: Boolean = true,
    /** Seconds of warning before the next episode starts on its own. */
    val nextEpisodeDelaySeconds: Int = 10,
    val catalogUpdateInterval: CatalogUpdateInterval = CatalogUpdateInterval.DAILY,
    val autoUpdateGuide: Boolean = true,
    val parentalEnabled: Boolean = false,
    val pinHash: String = "",
    /**
     * Categories hidden behind the PIN. Entries are `KIND|group` so the same
     * group name can be blocked in Live and left open in Films; plain names
     * written by older versions still block that group everywhere.
     */
    val blockedGroups: Set<String> = emptySet(),
) {
    /** True when [group] of [kind] is one of the protected categories. */
    fun isGroupBlocked(kind: MediaKind, group: String): Boolean =
        blockedGroups.contains(blockedGroupKey(kind, group)) || blockedGroups.contains(group)

    /** Blocked categories of one section, as plain group names. */
    fun blockedGroupsOf(kind: MediaKind): Set<String> {
        val prefix = "${kind.name}|"
        return blockedGroups.mapNotNullTo(mutableSetOf()) { entry ->
            when {
                entry.startsWith(prefix) -> entry.removePrefix(prefix)
                !entry.contains('|') -> entry
                else -> null
            }
        }
    }
}

/** Storage key of a category inside one section. */
fun blockedGroupKey(kind: MediaKind, group: String): String = "${kind.name}|$group"

/** Non-sensitive preferences. The parental PIN is only ever stored as a salted hash. */
class SettingsStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("novastream_settings", Context.MODE_PRIVATE)

    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private fun load(): AppSettings = AppSettings(
        onboardingDone = prefs.getBoolean(KEY_ONBOARDING_DONE, false),
        deviceProfile = runCatching {
            DeviceProfile.valueOf(prefs.getString(KEY_DEVICE_PROFILE, null) ?: "PHONE")
        }.getOrDefault(DeviceProfile.PHONE),
        language = Language.fromCode(
            prefs.getString(KEY_LANGUAGE, null) ?: Locale.getDefault().language
        ),
        themeMode = runCatching { ThemeMode.valueOf(prefs.getString(KEY_THEME, null) ?: "DARK") }
            .getOrDefault(ThemeMode.DARK),
        dnsPreset = runCatching { DnsPreset.valueOf(prefs.getString(KEY_DNS, null) ?: "SYSTEM") }
            .getOrDefault(DnsPreset.SYSTEM),
        customDnsPrimary = prefs.getString(KEY_DNS_CUSTOM_IP, "").orEmpty(),
        customDnsDohUrl = prefs.getString(KEY_DNS_CUSTOM_DOH, "").orEmpty(),
        bufferSeconds = prefs.getInt(KEY_BUFFER, 30),
        hardwareDecoding = prefs.getBoolean(KEY_HW, true),
        autoplayNextEpisode = prefs.getBoolean(KEY_AUTOPLAY, true),
        nextEpisodeDelaySeconds = prefs.getInt(KEY_AUTOPLAY_DELAY, 10).coerceIn(3, 60),
        catalogUpdateInterval = runCatching {
            CatalogUpdateInterval.valueOf(prefs.getString(KEY_AUTO_UPDATE, null) ?: "DAILY")
        }.getOrDefault(CatalogUpdateInterval.DAILY),
        autoUpdateGuide = prefs.getBoolean(KEY_AUTO_UPDATE_EPG, true),
        parentalEnabled = prefs.getBoolean(KEY_PARENTAL, false),
        pinHash = prefs.getString(KEY_PIN, "").orEmpty(),
        blockedGroups = prefs.getStringSet(KEY_BLOCKED, emptySet())?.toSet() ?: emptySet(),
    )

    private fun persist(settings: AppSettings) {
        prefs.edit()
            .putBoolean(KEY_ONBOARDING_DONE, settings.onboardingDone)
            .putString(KEY_DEVICE_PROFILE, settings.deviceProfile.name)
            .putString(KEY_LANGUAGE, settings.language.code)
            .putString(KEY_THEME, settings.themeMode.name)
            .putString(KEY_DNS, settings.dnsPreset.name)
            .putString(KEY_DNS_CUSTOM_IP, settings.customDnsPrimary)
            .putString(KEY_DNS_CUSTOM_DOH, settings.customDnsDohUrl)
            .putInt(KEY_BUFFER, settings.bufferSeconds)
            .putBoolean(KEY_HW, settings.hardwareDecoding)
            .putBoolean(KEY_AUTOPLAY, settings.autoplayNextEpisode)
            .putInt(KEY_AUTOPLAY_DELAY, settings.nextEpisodeDelaySeconds)
            .putString(KEY_AUTO_UPDATE, settings.catalogUpdateInterval.name)
            .putBoolean(KEY_AUTO_UPDATE_EPG, settings.autoUpdateGuide)
            .putBoolean(KEY_PARENTAL, settings.parentalEnabled)
            .putString(KEY_PIN, settings.pinHash)
            .putStringSet(KEY_BLOCKED, settings.blockedGroups)
            // commit(), not apply(): these are tiny writes, and a TV box pulled
            // from the socket seconds later must still find them there.
            .commit()
        _settings.value = settings
    }

    fun update(transform: (AppSettings) -> AppSettings) {
        persist(transform(_settings.value))
    }

    /** Stores the device chosen on the welcome screen so it is never asked again. */
    fun completeOnboarding(profile: DeviceProfile) {
        update { it.copy(deviceProfile = profile, onboardingDone = true) }
    }

    fun setDeviceProfile(profile: DeviceProfile) {
        update { it.copy(deviceProfile = profile) }
    }

    fun setPin(pin: String) {
        update { it.copy(pinHash = hashPin(pin), parentalEnabled = true) }
    }

    /** Adds or removes one category of one section from the protected list. */
    fun toggleBlockedGroup(kind: MediaKind, group: String) {
        update { current ->
            val key = blockedGroupKey(kind, group)
            val updated = current.blockedGroups.toMutableSet()
            // A legacy plain entry blocks the group everywhere: turning it off
            // here has to clear that form too, or the row would never unblock.
            val removed = updated.remove(key) or updated.remove(group)
            if (!removed) updated.add(key)
            current.copy(blockedGroups = updated)
        }
    }

    /** Blocks or clears every category of one section in one go. */
    fun setBlockedGroups(kind: MediaKind, groups: Collection<String>, blocked: Boolean) {
        update { current ->
            val updated = current.blockedGroups.toMutableSet()
            groups.forEach { group ->
                val key = blockedGroupKey(kind, group)
                if (blocked) {
                    updated.add(key)
                } else {
                    updated.remove(key)
                    updated.remove(group)
                }
            }
            current.copy(blockedGroups = updated)
        }
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
        const val KEY_ONBOARDING_DONE = "onboarding_done"
        const val KEY_DEVICE_PROFILE = "device_profile"
        const val KEY_LANGUAGE = "language"
        const val KEY_THEME = "theme_mode"
        const val KEY_DNS = "dns_preset"
        const val KEY_DNS_CUSTOM_IP = "dns_custom_ip"
        const val KEY_DNS_CUSTOM_DOH = "dns_custom_doh"
        const val KEY_BUFFER = "buffer_seconds"
        const val KEY_HW = "hardware_decoding"
        const val KEY_AUTOPLAY = "autoplay_next"
        const val KEY_AUTOPLAY_DELAY = "autoplay_next_delay"
        const val KEY_AUTO_UPDATE = "catalog_auto_update"
        const val KEY_AUTO_UPDATE_EPG = "catalog_auto_update_epg"
        const val KEY_PARENTAL = "parental_enabled"
        const val KEY_PIN = "parental_pin"
        const val KEY_BLOCKED = "parental_blocked_groups"
    }
}
