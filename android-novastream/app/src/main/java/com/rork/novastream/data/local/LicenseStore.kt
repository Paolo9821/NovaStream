package com.rork.novastream.data.local

import android.content.Context
import com.rork.novastream.data.remote.RemoteLicense
import com.rork.novastream.data.remote.RemoteStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.TimeUnit
import kotlin.math.ceil

/** How long the app stays fully usable before a licence is required. */
const val TRIAL_DAYS: Int = 7

/** How long a paid device keeps working without reaching the licence server. */
const val ONLINE_GRACE_DAYS: Int = 14

/**
 * How long a brand-new installation may run before its free window has to be
 * confirmed by the server. Without this a reinstalled device could dodge the
 * server-side anchor simply by staying offline — and streaming needs a
 * connection anyway, so nothing legitimate is lost.
 */
const val TRIAL_ANCHOR_GRACE_DAYS: Int = 3

/** Why a paid device was locked again. */
enum class BlockReason {
    /** The owner revoked this licence for good. */
    REVOKED,

    /** The owner paused this licence; it can be reactivated remotely. */
    SUSPENDED,

    /** No contact with the licence server for longer than the grace window. */
    UNVERIFIED,
}

sealed interface LicenseStatus {
    /** Inside the free window. [daysRemaining] is always at least 1 while valid. */
    data class Trial(
        val daysRemaining: Int,
        val expiresAtMs: Long,
        val usedFraction: Float,
    ) : LicenseStatus

    /** A purchase is registered for this device. [expiresAtMs] is null for lifetime. */
    data class Licensed(val expiresAtMs: Long? = null) : LicenseStatus

    /** Trial is over, or the paid period ran out. A purchase unlocks the app. */
    data class Expired(val expiredAtMs: Long, val wasPaid: Boolean = false) : LicenseStatus

    /** The server refused this device, or could not be reached for too long. */
    data class Blocked(val reason: BlockReason, val note: String = "") : LicenseStatus
}

data class LicenseState(
    val termsAccepted: Boolean = false,
    val status: LicenseStatus = LicenseStatus.Trial(TRIAL_DAYS, 0L, 0f),
    val identity: DeviceIdentity,
    /** When the licence server last answered. 0 while it never did. */
    val lastVerifiedAtMs: Long = 0L,
    /** True while a verification call is in flight. */
    val verifying: Boolean = false,
)

/**
 * Owns the first-launch terms flag, the trial clock, and the cached answer from
 * the licence server. There is no local activation code: a device is unlocked
 * only because the server says a payment exists for it. The cached answer is
 * sealed with [SecureStore] and stamped with the device id, so copying
 * preferences to other hardware unlocks nothing.
 */
class LicenseStore(context: Context, private val secureStore: SecureStore) {

    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    val identity: DeviceIdentity = DeviceIdentityResolver.resolve(context)

    /**
     * True when this copy of the app found no trial record of its own, which is
     * what a first install and a reinstall look like from here. Read before the
     * record is created below, and reported to the server so it can tell the two
     * apart by the anchor it already holds.
     */
    val isFreshInstall: Boolean = secureStore.getString(KEY_TRIAL) == null

    private var verifying: Boolean = false
    private var lastAttemptMs: Long = 0L

    private val _state = MutableStateFlow(evaluate())
    val state: StateFlow<LicenseState> = _state.asStateFlow()

    /** Recomputed whenever the app returns to the foreground, so day changes apply. */
    fun refresh() {
        _state.value = evaluate()
    }

    fun acceptTerms() {
        // commit(), not apply(): a box unplugged right after this must not ask again.
        prefs.edit().putBoolean(KEY_TERMS, true).commit()
        // Accepting is the first real launch: this is when the trial clock starts.
        startTrialIfNeeded()
        refresh()
    }

    /**
     * True when it is worth calling the server. A device without a valid purchase
     * asks often, so reopening the app right after paying unlocks it immediately;
     * a paid device settles into a twice-a-day heartbeat.
     */
    fun needsRemoteCheck(nowMs: Long = System.currentTimeMillis()): Boolean {
        if (verifying) return false
        val record = remoteRecord()
        val settled = record != null &&
            record.status == RemoteStatus.ACTIVE &&
            (record.expiresAtMs == null || record.expiresAtMs > nowMs)
        if (settled) return nowMs - record.checkedAtMs >= CHECK_INTERVAL_MS
        return nowMs - lastAttemptMs >= RETRY_INTERVAL_MS
    }

    fun markAttempt(nowMs: Long = System.currentTimeMillis()) {
        lastAttemptMs = nowMs
    }

    /** Stores a fresh server answer and re-evaluates the gate. */
    fun applyRemote(record: RemoteLicense) {
        val safeNote = record.note.replace('|', ' ').take(120)
        // The server owns the trial clock, so a reinstall picks the count back up
        // where it was instead of handing out another free week.
        record.trialStartedAtMs?.let { anchorTrial(it, record.serverTimeMs) }
        // Stamped with the server clock when there is one. A box whose own clock
        // has not been set yet would otherwise file this answer in 1970 and look
        // unverified for decades the moment the real time arrives.
        val checkedAt = maxOf(record.serverTimeMs, effectiveNow())
        secureStore.putString(
            KEY_REMOTE,
            listOf(
                identity.deviceId,
                record.status.name,
                record.expiresAtMs?.toString() ?: "",
                checkedAt.toString(),
                safeNote,
            ).joinToString("|"),
        )
        refresh()
    }

    fun setVerifying(value: Boolean) {
        verifying = value
        refresh()
    }

    private fun evaluate(): LicenseState {
        val record = remoteRecord()
        return LicenseState(
            termsAccepted = prefs.getBoolean(KEY_TERMS, false),
            status = statusOf(record),
            identity = identity,
            lastVerifiedAtMs = record?.checkedAtMs ?: 0L,
            verifying = verifying,
        )
    }

    private fun statusOf(record: RemoteRecord?): LicenseStatus {
        if (record == null || record.status == RemoteStatus.NONE) return trialStatus()
        val now = effectiveNow()
        return when (record.status) {
            RemoteStatus.REVOKED -> LicenseStatus.Blocked(BlockReason.REVOKED, record.note)
            RemoteStatus.SUSPENDED -> LicenseStatus.Blocked(BlockReason.SUSPENDED, record.note)
            RemoteStatus.EXPIRED -> LicenseStatus.Expired(
                expiredAtMs = record.expiresAtMs ?: record.checkedAtMs,
                wasPaid = true,
            )
            RemoteStatus.ACTIVE -> when {
                record.expiresAtMs != null && record.expiresAtMs <= now ->
                    LicenseStatus.Expired(record.expiresAtMs, wasPaid = true)
                now - record.checkedAtMs > TimeUnit.DAYS.toMillis(ONLINE_GRACE_DAYS.toLong()) ->
                    LicenseStatus.Blocked(BlockReason.UNVERIFIED)
                else -> LicenseStatus.Licensed(record.expiresAtMs)
            }
            RemoteStatus.NONE -> trialStatus()
        }
    }

    /** Server answers are sealed and stamped with the device id, like the trial record. */
    private fun remoteRecord(): RemoteRecord? {
        val parts = secureStore.getString(KEY_REMOTE)?.split("|") ?: return null
        if (parts.size < 4 || parts[0] != identity.deviceId) return null
        val status = runCatching { RemoteStatus.valueOf(parts[1]) }.getOrNull() ?: return null
        val checkedAt = parts[3].toLongOrNull() ?: return null
        return RemoteRecord(
            status = status,
            expiresAtMs = parts[2].toLongOrNull(),
            checkedAtMs = checkedAt,
            note = parts.getOrNull(4).orEmpty(),
        )
    }

    private fun trialStatus(): LicenseStatus {
        val record = startTrialIfNeeded()
        val expiresAt = record.startedAtMs + TimeUnit.DAYS.toMillis(TRIAL_DAYS.toLong())
        val now = record.effectiveNowMs

        // A trial the server has never confirmed cannot run forever: that is the
        // only way an offline reinstall could keep restarting the free window.
        if (!record.anchored &&
            now - record.startedAtMs > TimeUnit.DAYS.toMillis(TRIAL_ANCHOR_GRACE_DAYS.toLong())
        ) {
            return LicenseStatus.Blocked(BlockReason.UNVERIFIED)
        }

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
     * The latest moment this installation has ever seen.
     *
     * A TV box has no battery-backed clock: unplugged and switched on again it
     * can report a date years in the past until the network sets the time. Every
     * licence decision uses this value instead of the raw system clock, so a
     * rewind can neither revive a finished trial nor make a paid device look
     * like it has not checked in for weeks.
     */
    private fun effectiveNow(): Long =
        maxOf(System.currentTimeMillis(), trialRecord()?.effectiveNowMs ?: 0L)

    /**
     * Reads (or creates) the sealed trial record. [TrialRecord.effectiveNowMs] never
     * moves backwards, so setting the system clock to the past cannot revive a trial.
     */
    private fun startTrialIfNeeded(): TrialRecord {
        val now = System.currentTimeMillis()
        val stored = trialRecord()

        if (stored != null) {
            val effectiveNow = maxOf(now, stored.effectiveNowMs)
            val record = stored.copy(effectiveNowMs = effectiveNow)
            writeTrial(record)
            return record
        }

        val record = TrialRecord(startedAtMs = now, effectiveNowMs = now, anchored = false)
        writeTrial(record)
        return record
    }

    /**
     * Adopts the start date the server holds for this device. The earlier of the
     * two dates wins, so a device that ran offline for its first days keeps that
     * head start, while a reinstall inherits the original date.
     */
    private fun anchorTrial(serverStartedAtMs: Long, serverTimeMs: Long) {
        if (serverStartedAtMs <= 0L) return
        val current = trialRecord()
        val startedAt = minOf(current?.startedAtMs ?: serverStartedAtMs, serverStartedAtMs)
        val effectiveNow = maxOf(
            System.currentTimeMillis(),
            current?.effectiveNowMs ?: 0L,
            serverTimeMs,
        )
        writeTrial(TrialRecord(startedAt, effectiveNow, anchored = true))
    }

    /** Records written before the server anchor existed have no fourth field. */
    private fun trialRecord(): TrialRecord? {
        val parts = secureStore.getString(KEY_TRIAL)?.split("|") ?: return null
        if (parts.size < 3 || parts[0] != identity.deviceId) return null
        val startedAt = parts[1].toLongOrNull() ?: return null
        val lastSeen = parts[2].toLongOrNull() ?: return null
        return TrialRecord(
            startedAtMs = startedAt,
            effectiveNowMs = lastSeen,
            anchored = parts.getOrNull(3) == ANCHORED_FLAG,
        )
    }

    private fun writeTrial(record: TrialRecord) {
        val flag = if (record.anchored) ANCHORED_FLAG else "0"
        secureStore.putString(
            KEY_TRIAL,
            "${identity.deviceId}|${record.startedAtMs}|${record.effectiveNowMs}|$flag",
        )
    }

    private data class TrialRecord(
        val startedAtMs: Long,
        val effectiveNowMs: Long,
        /** True once the licence server confirmed when this device first appeared. */
        val anchored: Boolean,
    )

    private data class RemoteRecord(
        val status: RemoteStatus,
        val expiresAtMs: Long?,
        val checkedAtMs: Long,
        val note: String,
    )

    private companion object {
        const val PREFS = "novastream_license"
        const val KEY_TERMS = "is_terms_accepted"
        const val KEY_TRIAL = "trial_record"
        const val KEY_REMOTE = "remote_license"
        const val ANCHORED_FLAG = "1"

        /** Paid devices re-check twice a day. */
        val CHECK_INTERVAL_MS: Long = TimeUnit.HOURS.toMillis(12)

        /** Unpaid or blocked devices retry often, so a fresh purchase lands fast. */
        val RETRY_INTERVAL_MS: Long = TimeUnit.SECONDS.toMillis(20)
    }
}
