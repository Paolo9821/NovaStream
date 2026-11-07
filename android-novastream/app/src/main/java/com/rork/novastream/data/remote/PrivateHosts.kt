package com.rork.novastream.data.remote

import android.util.Log
import com.rork.novastream.data.net.getProviderText
import io.ktor.client.HttpClient
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Resolves a private host number into the server address it stands for.
 *
 * The list is a public file on the NovaStream website (`/app/host.json`):
 *
 * ```
 * { "hosts": [ { "id": "1836", "url": "http://cdn.example.xyz" } ] }
 * ```
 *
 * A plain map (`{ "hosts": { "1836": "http://…" } }`) is accepted too. The
 * address is kept with the account but never shown: the customer only ever
 * sees and types the number.
 */
class PrivateHosts(private val http: HttpClient) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /** The server behind [number], or null when no list lists it. */
    suspend fun resolve(number: String): String? {
        val wanted = number.trim().trimStart('#')
        if (wanted.isEmpty()) return null
        for (source in SOURCES) {
            val text = runCatching { http.getProviderText("$source?t=${System.currentTimeMillis() / 60_000}") }
                .onFailure { Log.w(TAG, "Lista host non raggiungibile") }
                .getOrNull() ?: continue
            val root = runCatching { json.parseToJsonElement(text) as? JsonObject }.getOrNull() ?: continue
            lookup(root, wanted)?.let { return it }
        }
        return null
    }

    private fun lookup(root: JsonObject, wanted: String): String? {
        when (val hosts = root["hosts"]) {
            is JsonArray -> hosts.forEach { item ->
                val obj = item as? JsonObject ?: return@forEach
                val id = obj.text("id") ?: obj.text("number") ?: obj.text("code")
                if (id.equals(wanted, ignoreCase = true)) {
                    return (obj.text("url") ?: obj.text("host") ?: obj.text("server"))?.normalized()
                }
            }
            is JsonObject -> hosts.entries.firstOrNull { it.key.equals(wanted, ignoreCase = true) }
                ?.let { entry ->
                    val value = entry.value
                    val url = when (value) {
                        is JsonPrimitive -> value.contentOrNull
                        is JsonObject -> value.text("url") ?: value.text("host")
                        else -> null
                    }
                    return url?.normalized()
                }
            else -> Unit
        }
        return null
    }

    private fun JsonObject.text(key: String): String? =
        (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }

    private fun String.normalized(): String? {
        val value = trim().trimEnd('/')
        if (value.isEmpty()) return null
        return if (value.startsWith("http://", true) || value.startsWith("https://", true)) value else "http://$value"
    }

    private companion object {
        const val TAG = "PrivateHosts"
        val SOURCES = listOf(
            "https://novastreamapp.com/app/host.json",
            "https://novastream.rork.app/app/host.json",
        )
    }
}
