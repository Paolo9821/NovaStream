package com.rork.novastream.data.local

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.math.ceil

/** How long the app stays fully usable before a license is required. */
const val TRIAL_DAYS: Int = 7

sealed interface LicenseStatus {
    /** Inside the free window. [daysRemaining] is always at least 1 while valid. */
    data class Trial(
        val daysRemaining: Int,
        val expiresAtMs: Long,
        val usedFraction: Float,
    ) : LicenseStatus

    /** A valid activation code for this exact device was entered. */
    data object Licensed : LicenseStatus

    /** Trial is over and no valid license is bound to this device. */
    data class Expired(val expiredAtMs: Long) : LicenseStatus
}

data class LicenseState(
    val termsAccepted: Boolean = false,
    val status: LicenseStatus = LicenseStatus.Trial(TRIAL_DAYS, 0L, 0f),
    val identity: DeviceIdentity,
)

/**
 * Derives and verifies activation codes. A code is a pure function of the device
 * identifier, so it unlocks that single device and nothing else — copying it to
 * another install can never validate.
 */
object LicenseCodes {

    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private const val GROUP = 4
    private const val LENGTH = 16

    /** The one code that activates the device with this identifier. */
    fun forDevice(deviceId: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("novastream-license::$deviceId".toByteArray(Charsets.UTF_8))
        val raw = (0 until LENGTH)
            .map { ALPHABET[(digest[it].toInt() and 0xFF) % ALPHABET.length] }
            .joinToString("")
        return raw.chunked(GROUP).joinToString("-")
    }

    fun matches(deviceId: String, input: String): Boolean =
        normalize(input) == normalize(forDevice(deviceId))

    /** Keeps only the significant characters so dashes and case never matter. */
    fun normalize(input: String): String =
        input.uppercase().filter { it.isLetterOrDigit() }

    /** Re-inserts the dashes while the user is typing. */
    fun format(input: String): String =
        normalize(input).take(LENGTH).chunked(GROUP).joinToString("-")
}

/**
 * Owns the first-launch terms flag, the trial clock and the device-bound license.
 * The trial record is sealed with [SecureStore] and stamped with the device id, so
 * clearing preferences or restoring a backup on other hardware cannot extend it.
 */
class LicenseStore(context: Context, private val secureStore: SecureStore) {

    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    val identity: DeviceIdentity = DeviceIdentityResolver.resolve(context)

    private val _state = MutableStateFlow(evaluate())
    val state: StateFlow<LicenseState> = _state.asStateFlow()

    /** Recomputed whenever the app returns to the foreground, so day changes apply. */
    fun refresh() {
        _state.value = evaluate()
    }

    fun acceptTerms() {
        prefs.edit().putBoolean(KEY_TERMS, true).apply()
        // Accepting is the first real launch: this is when the trial clock starts.
        startTrialIfNeeded()
        refresh()
    }

    /** Returns true when the code belongs to this device and was stored. */
    fun activate(code: String): Boolean {
        if (!LicenseCodes.matches(identity.deviceId, code)) return false
        secureStore.putString(KEY_LICENSE, "${identity.deviceId}|${LicenseCodes.normalize(code)}")
        refresh()
        return true
    }

    fun activationCodeForSupport(): String = LicenseCodes.forDevice(identity.deviceId)

    private fun evaluate(): LicenseState {
        val termsAccepted = prefs.getBoolean(KEY_TERMS, false)
        val status = when {
            hasValidLicense() -> LicenseStatus.Licensed
            else -> trialStatus()
        }
        return LicenseState(
            termsAccepted = termsAccepted,
            status = status,
            identity = identity,
        )
    }

    private fun hasValidLicense(): Boolean {
        val stored = secureStore.getString(KEY_LICENSE) ?: return false
        val parts = stored.split("|")
        if (parts.size != 2) return false
        val (boundDeviceId, code) = parts
        return boundDeviceId == identity.deviceId && LicenseCodes.matches(identity.deviceId, code)
    }

    private fun trialStatus(): LicenseStatus {
        val record = startTrialIfNeeded()
        val expiresAt = record.startedAtMs + TimeUnit.DAYS.toMillis(TRIAL_DAYS.toLong())
        val now = record.effectiveNowMs

        if (now >= expiresAt) return LicenseStatus.Expired(expiresAt)

        val remainingMs = expiresAt - now
        val daysRemaining = ceil(remainingMs.toDouble() / TimeUnit.DAYS.toMillis(1)).toInt()
        val total = TimeUnit.DAYS.toMillis(TRIAL_DAYS.toLong()).toFloat()
        return LicenseStatus.Trial(
            daysRemaining = daysRemaining.coerceAtLeast(1),
            expiresAtMs = expiresAt,
            usedFraction = ((total - remainingMs) / total).coerceIn(0f, 1f),
        )
    }

    /**
     * Reads (or creates) the sealed trial record. [TrialRecord.effectiveNowMs] never
     * moves backwards, so setting the system clock to the past cannot revive a trial.
     */
    private fun startTrialIfNeeded(): TrialRecord {
        val now = System.currentTimeMillis()
        val stored = secureStore.getString(KEY_TRIAL)?.split("|")

        if (stored != null && stored.size == 3 && stored[0] == identity.deviceId) {
            val startedAt = stored[1].toLongOrNull()
            val lastSeen = stored[2].toLongOrNull()
            if (startedAt != null && lastSeen != null) {
                val effectiveNow = maxOf(now, lastSeen)
                secureStore.putString(KEY_TRIAL, "${identity.deviceId}|$startedAt|$effectiveNow")
                return TrialRecord(startedAt, effectiveNow)
            }
        }

        secureStore.putString(KEY_TRIAL, "${identity.deviceId}|$now|$now")
        return TrialRecord(now, now)
    }

    private data class TrialRecord(val startedAtMs: Long, val effectiveNowMs: Long)

    private companion object {
        const val PREFS = "novastream_license"
        const val KEY_TERMS = "is_terms_accepted"
        const val KEY_TRIAL = "trial_record"
        const val KEY_LICENSE = "license_record"
    }
}
