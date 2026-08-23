package com.rork.novastream.data.net

import android.util.Log
import com.rork.novastream.data.local.AppSettings
import com.rork.novastream.data.local.DnsPreset
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.InetAddress
import kotlin.system.measureTimeMillis

data class DnsCheck(
    val host: String,
    val resolver: String,
    val addresses: List<String>,
    val latencyMs: Long,
)

/**
 * Resolves host names through the selected DNS-over-HTTPS resolver, falling back to
 * the system resolver. Used to verify and reach provider servers.
 */
class DohResolver(private val http: HttpClient) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    suspend fun resolve(host: String, settings: AppSettings): DnsCheck = withContext(Dispatchers.IO) {
        val cleanHost = host.substringAfter("://").substringBefore("/").substringBefore(":").trim()
        val endpoint = when (settings.dnsPreset) {
            DnsPreset.CUSTOM -> settings.customDnsDohUrl.trim()
            else -> settings.dnsPreset.dohUrl
        }
        val resolverLabel = when (settings.dnsPreset) {
            DnsPreset.CUSTOM -> settings.customDnsPrimary.ifBlank { "Custom" }
            DnsPreset.SYSTEM -> "System"
            DnsPreset.GOOGLE -> "Google"
            DnsPreset.CLOUDFLARE -> "Cloudflare"
            DnsPreset.QUAD9 -> "Quad9"
        }

        if (endpoint.isBlank()) return@withContext systemResolve(cleanHost, resolverLabel)

        var addresses: List<String> = emptyList()
        val elapsed = measureTimeMillis {
            addresses = runCatching { queryDoh(endpoint, cleanHost) }
                .onFailure { Log.w(TAG, "Risoluzione DoH non riuscita, uso il resolver di sistema") }
                .getOrDefault(emptyList())
        }
        if (addresses.isEmpty()) systemResolve(cleanHost, resolverLabel)
        else DnsCheck(cleanHost, resolverLabel, addresses, elapsed)
    }

    private suspend fun queryDoh(endpoint: String, host: String): List<String> {
        val separator = if (endpoint.contains("?")) "&" else "?"
        val url = "$endpoint${separator}name=$host&type=A"
        val body = http.get(url) { header("Accept", "application/dns-json") }.bodyAsText()
        val answers = json.parseToJsonElement(body).jsonObject["Answer"]?.jsonArray ?: return emptyList()
        return answers.mapNotNull { element ->
            val obj = element.jsonObject
            val type = obj["type"]?.jsonPrimitive?.content?.toIntOrNull()
            if (type == 1) obj["data"]?.jsonPrimitive?.content else null
        }
    }

    private fun systemResolve(host: String, resolverLabel: String): DnsCheck {
        var addresses: List<String> = emptyList()
        val elapsed = measureTimeMillis {
            addresses = runCatching { InetAddress.getAllByName(host).map { it.hostAddress ?: "" } }
                .getOrDefault(emptyList())
                .filter { it.isNotBlank() }
        }
        return DnsCheck(host, resolverLabel, addresses, elapsed)
    }

    private companion object {
        const val TAG = "DohResolver"
    }
}
