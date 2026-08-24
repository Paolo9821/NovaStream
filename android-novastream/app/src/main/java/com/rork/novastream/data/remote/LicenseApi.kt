package com.rork.novastream.data.remote

import android.util.Log
import com.rork.novastream.Config
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

private const val TAG = "LicenseApi"

/** Remote lifecycle of a license, controlled by the owner from the admin panel. */
enum class RemoteStatus {
    ACTIVE,
    SUSPENDED,
    REVOKED;

    val wire: String get() = name.lowercase()

    companion object {
        fun from(raw: String?): RemoteStatus = when (raw?.lowercase()) {
            "suspended" -> SUSPENDED
            "revoked" -> REVOKED
            else -> ACTIVE
        }
    }
}

/** One row of the `licenses` collection. */
data class RemoteLicense(
    val deviceId: String,
    val code: String = "",
    val status: RemoteStatus = RemoteStatus.ACTIVE,
    val note: String = "",
    val label: String = "",
    val issuedAtMs: Long = 0L,
    val updatedAtMs: Long = 0L,
    val lastSeenMs: Long = 0L,
)

/** Outcome of asking the server about one device. */
sealed interface LicenseCheck {
    data class Found(val record: RemoteLicense) : LicenseCheck

    /** The server answered, but this device was never registered. */
    data object Missing : LicenseCheck

    /** No answer: offline, DNS blocked, server error. Never treated as a verdict. */
    data class Unavailable(val reason: String) : LicenseCheck
}

/** Owner session obtained with Firebase email/password sign-in. */
data class AdminSession(val idToken: String, val email: String)

/**
 * Firestore REST client for the license registry. It talks plain HTTPS so the app
 * needs no Firebase SDK, no google-services plugin and no extra native code.
 *
 * Layout: collection `licenses`, one document per device, document id = device id.
 * Anonymous clients can read their own row and self-register; only the signed-in
 * owner can change a status, which is what makes remote revocation possible.
 */
class LicenseApi(
    private val projectId: String = Config.allValues["EXPO_PUBLIC_FIREBASE_PROJECT_ID"].orEmpty(),
    private val apiKey: String = Config.allValues["EXPO_PUBLIC_FIREBASE_API_KEY"].orEmpty(),
) {

    /** False until the Firebase keys are supplied; the app then stays fully offline. */
    val isConfigured: Boolean
        get() = projectId.isNotBlank() && apiKey.isNotBlank()

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

    private val documents: String
        get() = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents"

    // ---------------------------------------------------------------- client

    /** Reads the verdict for one device. Anonymous read, allowed by the rules. */
    suspend fun fetch(deviceId: String): LicenseCheck = withContext(Dispatchers.IO) {
        if (!isConfigured) return@withContext LicenseCheck.Unavailable("not configured")
        request {
            val response = http.get("$documents/licenses/${path(deviceId)}?key=$apiKey")
            when (response.status.value) {
                200 -> LicenseCheck.Found(parseDocument(response.bodyAsText(), deviceId))
                404 -> LicenseCheck.Missing
                else -> LicenseCheck.Unavailable("http ${response.status.value}")
            }
        }
    }

    /**
     * Registers a freshly activated device as `active` so it shows up in the admin
     * list. If the row already exists the server value wins — a revoked device can
     * never re-register itself.
     */
    suspend fun register(deviceId: String, code: String): LicenseCheck = withContext(Dispatchers.IO) {
        if (!isConfigured) return@withContext LicenseCheck.Unavailable("not configured")
        val now = System.currentTimeMillis()
        request {
            val response = http.post("$documents/licenses?documentId=${path(deviceId)}&key=$apiKey") {
                contentType(ContentType.Application.Json)
                setBody(
                    document(
                        "deviceId" to text(deviceId),
                        "code" to text(code),
                        "status" to text(RemoteStatus.ACTIVE.wire),
                        "note" to text(""),
                        "label" to text(""),
                        "issuedAtMs" to number(now),
                        "updatedAtMs" to number(now),
                        "lastSeenMs" to number(now),
                    )
                )
            }
            when (response.status.value) {
                200 -> LicenseCheck.Found(parseDocument(response.bodyAsText(), deviceId))
                // 409: already registered — read the authoritative row instead.
                409 -> fetch(deviceId)
                else -> LicenseCheck.Unavailable("http ${response.status.value}")
            }
        }
    }

    /** Best-effort activity ping so the owner sees which devices are still in use. */
    suspend fun touch(deviceId: String) {
        if (!isConfigured) return
        withContext(Dispatchers.IO) {
            runCatching {
                http.patch(
                    "$documents/licenses/${path(deviceId)}" +
                        "?key=$apiKey&updateMask.fieldPaths=lastSeenMs"
                ) {
                    contentType(ContentType.Application.Json)
                    setBody(document("lastSeenMs" to number(System.currentTimeMillis())))
                }
            }
        }
    }

    // ----------------------------------------------------------------- owner

    /** Firebase email/password sign-in. The token is kept in memory only. */
    suspend fun signIn(email: String, password: String): Result<AdminSession> =
        withContext(Dispatchers.IO) {
            if (!isConfigured) return@withContext Result.failure(IllegalStateException("Firebase keys missing"))
            runCatching {
                val response = http.post(
                    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey"
                ) {
                    contentType(ContentType.Application.Json)
                    setBody(
                        buildJsonObject {
                            put("email", email.trim())
                            put("password", password)
                            put("returnSecureToken", true)
                        }.toString()
                    )
                }
                val body = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
                if (response.status.value != 200) {
                    throw IllegalStateException(authError(body))
                }
                val token = body?.get("idToken")?.jsonPrimitive?.contentOrNull.orEmpty()
                if (token.isBlank()) throw IllegalStateException("Sign-in failed")
                AdminSession(idToken = token, email = email.trim())
            }
        }

    /** All registered devices, newest first. Requires the owner token. */
    suspend fun list(session: AdminSession): Result<List<RemoteLicense>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val response = http.get("$documents/licenses?pageSize=300&key=$apiKey") {
                    header("Authorization", "Bearer ${session.idToken}")
                }
                if (response.status.value != 200) {
                    throw IllegalStateException(readError(response))
                }
                val root = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
                val docs = root?.get("documents") as? JsonArray ?: JsonArray(emptyList())
                docs.mapNotNull { element ->
                    (element as? JsonObject)?.let { parseFields(it, "") }
                }.sortedByDescending { it.updatedAtMs }
            }
        }

    /** Suspends, revokes or reactivates one device. This is the remote kill switch. */
    suspend fun setStatus(
        session: AdminSession,
        deviceId: String,
        status: RemoteStatus,
        note: String = "",
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = http.patch(
                "$documents/licenses/${path(deviceId)}?key=$apiKey" +
                    "&updateMask.fieldPaths=status" +
                    "&updateMask.fieldPaths=note" +
                    "&updateMask.fieldPaths=updatedAtMs"
            ) {
                header("Authorization", "Bearer ${session.idToken}")
                contentType(ContentType.Application.Json)
                setBody(
                    document(
                        "status" to text(status.wire),
                        "note" to text(note),
                        "updatedAtMs" to number(System.currentTimeMillis()),
                    )
                )
            }
            if (response.status.value != 200) throw IllegalStateException(readError(response))
        }
    }

    /** Pre-registers a device the owner sold before it ever connected. */
    suspend fun issue(
        session: AdminSession,
        deviceId: String,
        code: String,
        label: String,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val now = System.currentTimeMillis()
            val response = http.patch(
                "$documents/licenses/${path(deviceId)}?key=$apiKey" +
                    "&updateMask.fieldPaths=deviceId" +
                    "&updateMask.fieldPaths=code" +
                    "&updateMask.fieldPaths=status" +
                    "&updateMask.fieldPaths=label" +
                    "&updateMask.fieldPaths=issuedAtMs" +
                    "&updateMask.fieldPaths=updatedAtMs"
            ) {
                header("Authorization", "Bearer ${session.idToken}")
                contentType(ContentType.Application.Json)
                setBody(
                    document(
                        "deviceId" to text(deviceId),
                        "code" to text(code),
                        "status" to text(RemoteStatus.ACTIVE.wire),
                        "label" to text(label),
                        "issuedAtMs" to number(now),
                        "updatedAtMs" to number(now),
                    )
                )
            }
            if (response.status.value != 200) throw IllegalStateException(readError(response))
        }
    }

    // --------------------------------------------------------------- helpers

    private inline fun request(block: () -> LicenseCheck): LicenseCheck = try {
        block()
    } catch (error: Exception) {
        Log.w(TAG, "License check unavailable: ${error.javaClass.simpleName}")
        LicenseCheck.Unavailable(error.message ?: "network error")
    }

    private fun parseDocument(body: String, fallbackId: String): RemoteLicense {
        val root = json.parseToJsonElement(body) as? JsonObject
        return parseFields(root, fallbackId)
    }

    private fun parseFields(root: JsonObject?, fallbackId: String): RemoteLicense {
        val fields = root?.get("fields") as? JsonObject
        val name = root?.get("name")?.jsonPrimitive?.contentOrNull.orEmpty()
        val idFromPath = name.substringAfterLast('/', "")
        return RemoteLicense(
            deviceId = fields.string("deviceId").ifBlank { idFromPath.ifBlank { fallbackId } },
            code = fields.string("code"),
            status = RemoteStatus.from(fields.string("status")),
            note = fields.string("note"),
            label = fields.string("label"),
            issuedAtMs = fields.long("issuedAtMs"),
            updatedAtMs = fields.long("updatedAtMs"),
            lastSeenMs = fields.long("lastSeenMs"),
        )
    }

    private suspend fun readError(response: HttpResponse): String {
        val body = runCatching { json.parseToJsonElement(response.bodyAsText()) as? JsonObject }
            .getOrNull()
        val message = (body?.get("error") as? JsonObject)
            ?.get("message")?.jsonPrimitive?.contentOrNull
        return message ?: "Request failed (${response.status.value})"
    }

    private fun authError(body: JsonObject?): String {
        val raw = (body?.get("error") as? JsonObject)
            ?.get("message")?.jsonPrimitive?.contentOrNull.orEmpty()
        return when {
            raw.startsWith("EMAIL_NOT_FOUND") -> "No owner account with this email"
            raw.startsWith("INVALID_PASSWORD") || raw.startsWith("INVALID_LOGIN_CREDENTIALS") ->
                "Wrong email or password"
            raw.startsWith("USER_DISABLED") -> "This account is disabled"
            raw.startsWith("TOO_MANY_ATTEMPTS") -> "Too many attempts, try later"
            raw.isBlank() -> "Sign-in failed"
            else -> raw
        }
    }

    private fun document(vararg fields: Pair<String, JsonElement>): String =
        buildJsonObject { put("fields", JsonObject(fields.toMap())) }.toString()

    private fun text(value: String): JsonElement = buildJsonObject { put("stringValue", value) }

    private fun number(value: Long): JsonElement =
        buildJsonObject { put("integerValue", value.toString()) }

    /** Device ids are hex/UUID-like, but keep the path safe anyway. */
    private fun path(deviceId: String): String = deviceId.filter { it.isLetterOrDigit() || it == '-' }

    private fun JsonObject?.string(field: String): String =
        (this?.get(field) as? JsonObject)?.get("stringValue")?.jsonPrimitive?.contentOrNull.orEmpty()

    private fun JsonObject?.long(field: String): Long {
        val node = this?.get(field) as? JsonObject ?: return 0L
        val raw = node["integerValue"]?.jsonPrimitive?.contentOrNull
            ?: node["doubleValue"]?.jsonPrimitive?.contentOrNull
        return raw?.toDouble()?.toLong() ?: 0L
    }
}
