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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
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
     */
    suspend fun check(deviceId: String, mac: String = ""): LicenseCheck = withContext(Dispatchers.IO) {
        runCatching {
            val response = http.post("$baseUrl/api/license/status") {
                contentType(ContentType.Application.Json)
                setBody(
                    buildJsonObject {
                        put("deviceId", deviceId)
                        if (mac.isNotBlank()) put("mac", mac)
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
                ),
            )
        }.getOrElse { error ->
            Log.d(TAG, "licence check unavailable: ${error.message}")
            LicenseCheck.Unavailable(error.message ?: "network error")
        }
    }

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
