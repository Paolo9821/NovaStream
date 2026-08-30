package com.rork.novastream.data.local

import android.content.Context
import android.provider.Settings
import android.util.Log
import java.io.File
import java.net.NetworkInterface
import java.security.MessageDigest
import java.util.UUID

/**
 * Stable, non-transferable identity of the current device.
 *
 * [macAddress] is the real hardware address when the platform still exposes it
 * (Android 9 and older, most Android TV boxes). From Android 10 the OS hides it,
 * so a deterministic locally-administered address is derived from [deviceId]:
 * it stays identical for the lifetime of the installation on that hardware.
 */
data class DeviceIdentity(
    val macAddress: String,
    val deviceId: String,
    val isHardwareMac: Boolean,
) {
    /** Short label used when both values must fit on a single line. */
    val shortLabel: String get() = "$macAddress · $deviceId"
}

object DeviceIdentityResolver {

    private const val PREFS = "novastream_device"
    private const val KEY_FALLBACK_ID = "fallback_device_id"
    private const val ID_FILE = "device_id"
    private const val ANONYMISED_MAC = "02:00:00:00:00:00"
    private const val KNOWN_BAD_ANDROID_ID = "9774d56d682e549c"
    private const val TAG = "DeviceIdentity"

    fun resolve(context: Context): DeviceIdentity {
        val hardwareMac = readHardwareMac()
        val deviceId = resolveDeviceId(context, hardwareMac)
        return DeviceIdentity(
            macAddress = hardwareMac ?: deriveMac(deviceId),
            deviceId = deviceId,
            isHardwareMac = hardwareMac != null,
        )
    }

    /**
     * The licence is tied to this value, so it must come back identical after a
     * reboot, a power cut, or even a reinstall. The sources are tried from the
     * most specific to the most general:
     *
     * 1. the durable copy written the last time the app ran;
     * 2. the identifier an older build kept in preferences;
     * 3. the Android identifier, when the platform provides a usable one;
     * 4. a value derived from the network card, which is the same after a wipe;
     * 5. a random value, only when this device offers nothing stable at all.
     *
     * The order never demotes an identity that already existed, so devices
     * updating from an earlier version keep the licence they paid for.
     */
    private fun resolveDeviceId(context: Context, hardwareMac: String?): String {
        val appContext = context.applicationContext
        val file = idFile(appContext)
        DurableIo.readText(file)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }

        val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = prefs.getString(KEY_FALLBACK_ID, null)?.takeIf { it.isNotBlank() }

        val androidId = runCatching {
            Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull()?.takeIf { it.isNotBlank() && it != KNOWN_BAD_ANDROID_ID }

        val resolved = stored
            ?: androidId
            ?: hardwareMac?.let { hashOf("novastream-id::$it") }
            ?: UUID.randomUUID().toString().replace("-", "").take(16)

        // Both copies are kept: the file is the one that survives, preferences
        // stay in step so an older build could still read the same identity.
        DurableIo.writeText(file, resolved)
        prefs.edit().putString(KEY_FALLBACK_ID, resolved).commit()
        return resolved
    }

    private fun idFile(context: Context): File =
        File(File(context.filesDir, "keys").apply { mkdirs() }, ID_FILE)

    /** Returns the real interface address, or null when the platform anonymises it. */
    private fun readHardwareMac(): String? = runCatching {
        NetworkInterface.getNetworkInterfaces()
            ?.toList()
            .orEmpty()
            .filter { it.name.equals("wlan0", true) || it.name.equals("eth0", true) }
            .sortedBy { if (it.name.equals("eth0", true)) 0 else 1 }
            .firstNotNullOfOrNull { networkInterface ->
                networkInterface.hardwareAddress
                    ?.takeIf { it.size == 6 }
                    ?.joinToString(":") { "%02X".format(it) }
                    ?.takeIf { it != ANONYMISED_MAC }
            }
    }.onFailure { Log.d(TAG, "Hardware address not readable on this platform") }.getOrNull()

    /** Deterministic locally-administered MAC derived from the device id. */
    private fun deriveMac(deviceId: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("novastream-mac::$deviceId".toByteArray(Charsets.UTF_8))
        val bytes = digest.copyOf(6)
        bytes[0] = ((bytes[0].toInt() and 0xFE) or 0x02).toByte()
        return bytes.joinToString(":") { "%02X".format(it) }
    }

    private fun hashOf(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
        .take(16)
}
