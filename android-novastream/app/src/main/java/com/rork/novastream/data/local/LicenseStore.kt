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

/** How long a licensed device keeps working without reaching the license server. */
const val ONLINE_GRACE_DAYS: Int = 14

/** Why a licensed device was locked again. */
enum class BlockReason {
    /** The owner revoked this license for good. */
    REVOKED,

    /** The owner paused this license; it can be reactivated remotely. */
    SUSPENDED,

    /** No contact with the license server for longer than the grace window. */
    UNVERIFIED,
}

/** Last answer received from the license server for this device. */
enum class RemoteVerdict { UNKNOWN, ACTIVE, SUSPENDED, REVOKED }

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

    /** The code is valid locally but the server refused it, or could not be reached. */
    data class Blocked(val reason: BlockReason, val note: String = "") : LicenseStatus
}

data class LicenseState(
    val termsAccepted: Boolean = false,
    val status: LicenseStatus = LicenseStatus.Trial(TRIAL_DAYS, 0L, 0f),
    val identity: DeviceIdentity,
    /** When the license server last answered. 0 while it never did. */
    val lastVerifiedAtMs: Long = 0L,
    /** True while a verification call is in flight. */
    val verifying: Boolean = false,
)

/**
 * Derives and verifies activation codes. A code is a pure function of the device
 * identifier, so it unlocks that single device and nothing else — copying it to
 * another install can never validate.
 */
object LicenseCodes {

    /** Shown in the admin panel so the owner knows how codes are derived. */
    const val SALT_PREVIEW: String = "novastream-license::"

    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private const val GROUP = 4
    private const val LENGTH = 16

    /** The one code that activates the device with this identifier. */
    fun forDevice(deviceId: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$SALT_PREVIEW$deviceId".toByteArray(Charsets.UTF_8))
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

    /**
     * Turned on by the view model when Firebase keys are present. Without it the
     * app behaves exactly as before: offline codes, no remote enforcement.
     */
    var onlineEnforcement: Boolean = false

    private var verifying: Boolean = false

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
        // Optimistic: the grace window starts now and the server confirms shortly after.
        storeVerdict(RemoteVerdict.UNKNOWN, System.currentTimeMillis())
        refresh()
        return true
    }

    /** The code bound to this install, needed when registering it on the server. */
    fun boundCode(): String? = secureStore.getString(KEY_LICENSE)
        ?.split("|")
        ?.takeIf { it.size == 2 && it[0] == identity.deviceId }
        ?.get(1)

    /** True when a licensed device should ask the server again. */
    fun needsRemoteCheck(nowMs: Long = System.currentTimeMillis()): Boolean {
        if (!onlineEnforcement || !hasValidLicense()) return false
        val record = verdictRecord() ?: return true
        return nowMs - record.checkedAtMs >= CHECK_INTERVAL_MS
    }

    /** Stores a fresh server answer and re-evaluates the gate. */
    fun applyRemoteVerdict(verdict: RemoteVerdict, note: String = "") {
        storeVerdict(verdict, System.currentTimeMillis(), note)
        refresh()
    }

    fun setVerifying(value: Boolean) {
        verifying = value
        refresh()
    }

    fun activationCodeForSupport(): String = LicenseCodes.forDevice(identity.deviceId)

    private fun evaluate(): LicenseState {
        val termsAccepted = prefs.getBoolean(KEY_TERMS, false)
        val status = when {
            hasValidLicense() -> licensedStatus()
            else -> trialStatus()
        }
        val record = verdictRecord()
        return LicenseState(
            termsAccepted = termsAccepted,
            status = status,
            identity = identity,
            lastVerifiedAtMs = if (record?.verdict != RemoteVerdict.UNKNOWN) {
                record?.checkedAtMs ?: 0L
            } else {
                0L
            },
            verifying = verifying,
        )
    }

    /**
     * A locally valid code is not enough once the registry is enabled: the last
     * server answer decides, and it must be recent enough.
     */
    private fun licensedStatus(): LicenseStatus {
        if (!onlineEnforcement) return LicenseStatus.Licensed

        val record = verdictRecord() ?: run {
            // License bound before the registry existed: start the grace window now.
            storeVerdict(RemoteVerdict.UNKNOWN, System.currentTimeMillis())
            return LicenseStatus.Licensed
        }

        return when (record.verdict) {
            RemoteVerdict.REVOKED -> LicenseStatus.Blocked(BlockReason.REVOKED, record.note)
            RemoteVerdict.SUSPENDED -> LicenseStatus.Blocked(BlockReason.SUSPENDED, record.note)
            RemoteVerdict.ACTIVE, RemoteVerdict.UNKNOWN -> {
                val age = System.currentTimeMillis() - record.checkedAtMs
                if (age > TimeUnit.DAYS.toMillis(ONLINE_GRACE_DAYS.toLong())) {
                    LicenseStatus.Blocked(BlockReason.UNVERIFIED)
                } else {
                    LicenseStatus.Licensed
                }
            }
        }
    }

    private fun storeVerdict(verdict: RemoteVerdict, checkedAtMs: Long, note: String = "") {
        val safeNote = note.replace('|', ' ').take(120)
        secureStore.putString(
            KEY_VERDICT,
            "${identity.deviceId}|${verdict.name}|$checkedAtMs|$safeNote",
        )
    }

    /** Verdicts are sealed and stamped with the device id, like the trial record. */
    private fun verdictRecord(): VerdictRecord? {
        val parts = secureStore.getString(KEY_VERDICT)?.split("|") ?: return null
        if (parts.size < 3 || parts[0] != identity.deviceId) return null
        val verdict = runCatching { RemoteVerdict.valueOf(parts[1]) }.getOrNull() ?: return null
        val checkedAt = parts[2].toLongOrNull() ?: return null
        return VerdictRecord(verdict, checkedAt, parts.getOrNull(3).orEmpty())
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

    private data class VerdictRecord(
        val verdict: RemoteVerdict,
        val checkedAtMs: Long,
        val note: String,
    )

    private companion object {
        const val PREFS = "novastream_license"
        const val KEY_TERMS = "is_terms_accepted"
        const val KEY_TRIAL = "trial_record"
        const val KEY_LICENSE = "license_record"
        const val KEY_VERDICT = "remote_verdict"

        /** Licensed devices re-check twice a day; failures fall back to the grace window. */
        val CHECK_INTERVAL_MS: Long = TimeUnit.HOURS.toMillis(12)
    }
}
