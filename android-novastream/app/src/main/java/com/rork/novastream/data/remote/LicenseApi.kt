package com.rork.novastream.data.remote

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.rork.novastream.data.model.AccountType
import com.rork.novastream.data.model.PlaylistAccount
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

private const val TAG = "LicenseApi"

/** Public licence server that also settles the card purchases made on the site. */
const val LICENSE_BACKEND_URL: String =
    "https://crea-un-applicazione-di-iptv-che-accetta-backend.rork.app"

/** Fallback storefront, used until the server reports its own address. */
const val DEFAULT_STORE_URL: String = "https://novastream.rork.app"

/** What the registry says about this device right now. */
enum class RemoteStatus {
    /** Paid and valid. */
    ACTIVE,

    /** Paused by the owner; can come back. */
    SUSPENDED,

    /** Killed by the owner for good. */
    REVOKED,

    /** Was valid, the paid period ran out. */
    EXPIRED,

    /** No purchase has ever been recorded for this device. */
    NONE,
}

/** One authoritative answer about a device. */
data class RemoteLicense(
    val status: RemoteStatus,
    val plan: String = "",
    val expiresAtMs: Long? = null,
    val note: String = "",
    /**
     * When the server first saw this device. It survives uninstalls, so the free
     * window keeps running from the original date instead of starting over.
     */
    val trialStartedAtMs: Long? = null,
    /** Server clock, used so a device cannot rewind its own trial. */
    val serverTimeMs: Long = 0L,
)

/**
 * Answer of the website playlist manager: the key shown on screen, the
 * playlists sent from the site that must be installed, and the ids of the ones
 * the site asked to delete.
 */
data class DeviceSync(
    val key: String,
    val install: List<PlaylistAccount>,
    val remove: List<String>,
    /** When the key stops working, already moved onto this device's clock. */
    val keyExpiresAtMs: Long = 0L,
    /** Server time of the last opening from the website; it grows when the key is used. */
    val lastOpenAtMs: Long = 0L,
)

/** Outcome of asking the server. Silence is never treated as a verdict. */
sealed interface LicenseCheck {
    data class Answered(val record: RemoteLicense) : LicenseCheck

    /** Offline, DNS blocked or server error — the local grace window applies. */
    data class Unavailable(val reason: String) : LicenseCheck
}

/**
 * Thin HTTPS client for the NovaStream licence server. The device only ever asks
 * one question — "am I allowed?" — so there is nothing here a customer could
 * tamper with to grant themselves access.
 */
class LicenseApi(private val baseUrl: String = LICENSE_BACKEND_URL) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val http: HttpClient by lazy {
        HttpClient(Android) {
            expectSuccess = false
            engine {
                connectTimeout = 12_000
                socketTimeout = 12_000
            }
        }
    }

    /**
     * Asks the registry about one device and records the heartbeat server-side.
     *
     * Both names of the device travel together: customers usually type the MAC
     * shown on screen when they buy, while the app identifies itself with its
     * device id. The server honours whichever one the purchase was made against.
     *
     * [freshInstall] tells the server this copy of the app holds no trial record
     * of its own, so a reinstall is counted rather than rewarded with a new week.
     */
    suspend fun check(
        deviceId: String,
        mac: String = "",
        freshInstall: Boolean = false,
    ): LicenseCheck = withContext(Dispatchers.IO) {
        runCatching {
            val response = http.post("$baseUrl/api/license/status") {
                contentType(ContentType.Application.Json)
                setBody(
                    buildJsonObject {
                        put("deviceId", deviceId)
                        if (mac.isNotBlank()) put("mac", mac)
                        if (freshInstall) put("fresh", true)
                    }.toString(),
                )
            }
            if (response.status.value !in 200..299) {
                return@runCatching LicenseCheck.Unavailable("http ${response.status.value}")
            }
            val body = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
                ?: return@runCatching LicenseCheck.Unavailable("bad payload")
            val found = body["found"]?.jsonPrimitive?.booleanOrNull ?: false
            val status = if (!found) {
                RemoteStatus.NONE
            } else {
                when (body["status"]?.jsonPrimitive?.contentOrNull) {
                    "active" -> RemoteStatus.ACTIVE
                    "suspended" -> RemoteStatus.SUSPENDED
                    "revoked" -> RemoteStatus.REVOKED
                    "expired" -> RemoteStatus.EXPIRED
                    else -> RemoteStatus.NONE
                }
            }
            LicenseCheck.Answered(
                RemoteLicense(
                    status = status,
                    plan = body["plan"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    expiresAtMs = body["expiresAt"]?.jsonPrimitive?.longOrNull,
                    note = body["note"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    trialStartedAtMs = body["trialStartedAt"]?.jsonPrimitive?.longOrNull,
                    serverTimeMs = body["serverTime"]?.jsonPrimitive?.longOrNull ?: 0L,
                ),
            )
        }.getOrElse { error ->
            Log.d(TAG, "licence check unavailable: ${error.message}")
            LicenseCheck.Unavailable(error.message ?: "network error")
        }
    }

    /**
     * Reconciles the playlists on this device with the website. Only the name,
     * the kind and the server host of each playlist are reported, never an
     * address with credentials in it. Returns null when the server is out of reach.
     */
    suspend fun syncDevice(
        deviceId: String,
        mac: String,
        accounts: List<PlaylistAccount>,
    ): DeviceSync? = withContext(Dispatchers.IO) {
        runCatching {
            val response = http.post("$baseUrl/api/device/sync") {
                contentType(ContentType.Application.Json)
                setBody(
                    buildJsonObject {
                        put("deviceId", deviceId)
                        put("mac", mac)
                        putJsonArray("playlists") {
                            accounts.forEach { account ->
                                val xtream = account.type == AccountType.XTREAM
                                addJsonObject {
                                    put("id", account.id)
                                    put("name", account.name)
                                    put("type", if (xtream) "xtream" else "m3u")
                                    put("host", hostOf(if (xtream) account.server else account.m3uUrl))
                                }
                            }
                        }
                    }.toString(),
                )
            }
            if (response.status.value !in 200..299) return@runCatching null
            val body = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
                ?: return@runCatching null
            val install = (body["install"] as? JsonArray).orEmpty().mapNotNull { element ->
                val item = element as? JsonObject ?: return@mapNotNull null
                fun text(key: String): String = item[key]?.jsonPrimitive?.contentOrNull.orEmpty()
                val id = text("id").takeIf { it.isNotBlank() } ?: return@mapNotNull null
                val type = if (text("type") == "xtream") AccountType.XTREAM else AccountType.M3U
                PlaylistAccount(
                    id = id,
                    name = text("name").ifBlank { if (type == AccountType.XTREAM) "Xtream" else "m3u" },
                    type = type,
                    m3uUrl = text("m3uUrl"),
                    server = text("server"),
                    username = text("username"),
                    password = text("password"),
                    epgUrl = text("epgUrl"),
                )
            }
            val remove = (body["remove"] as? JsonArray).orEmpty()
                .mapNotNull { it.jsonPrimitive.contentOrNull?.takeIf { id -> id.isNotBlank() } }
            // The countdown runs on this device's clock, whatever time it thinks it is.
            val serverTime = body["serverTime"]?.jsonPrimitive?.longOrNull ?: 0L
            val skew = if (serverTime > 0L) System.currentTimeMillis() - serverTime else 0L
            val expiresAt = body["keyExpiresAt"]?.jsonPrimitive?.longOrNull ?: 0L
            DeviceSync(
                key = body["key"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                install = install,
                remove = remove,
                keyExpiresAtMs = if (expiresAt > 0L) expiresAt + skew else 0L,
                lastOpenAtMs = body["lastOpenAt"]?.jsonPrimitive?.longOrNull ?: 0L,
            )
        }.getOrElse { error ->
            Log.d(TAG, "device sync unavailable: ${error.message}")
            null
        }
    }

    private fun hostOf(url: String): String =
        runCatching { java.net.URI(url.trim()).host }.getOrNull().orEmpty()

    /** Where customers buy. Read from the server so the address can change later. */
    suspend fun storeUrl(): String = withContext(Dispatchers.IO) {
        runCatching {
            val response = http.get("$baseUrl/api/config")
            if (response.status.value !in 200..299) return@runCatching DEFAULT_STORE_URL
            val body = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
            body?.get("storeUrl")?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
                ?: DEFAULT_STORE_URL
        }.getOrDefault(DEFAULT_STORE_URL)
    }
}
