package com.rork.novastream.data.net

import android.util.Log
import com.rork.novastream.data.local.AppSettings
import com.rork.novastream.data.local.DnsPreset
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import java.io.ByteArrayOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.random.Random
import kotlin.system.measureTimeMillis

/** Outcome of a DNS check, shown on the DNS settings page. */
data class DnsCheck(
    val host: String,
    val resolver: String,
    val addresses: List<String>,
    val latencyMs: Long,
    /** True when the network's own DNS could not find the host and the encrypted one did. */
    val networkBlocked: Boolean = false,
)

/**
 * The DNS every provider request goes through: playlist, guide, covers and video.
 *
 * Italian operators (and others) block IPTV panels by making their own DNS
 * forget the server name, so the app reported "server not reachable" while the
 * subscription was fine. In the automatic mode the network DNS is asked first
 * and an encrypted DNS-over-HTTPS resolver is asked in parallel: its answer is
 * used when the network one is empty or points to a dead "sinkhole" address,
 * and is appended as a second route otherwise, so OkHttp moves on to it if the
 * first address refuses the connection. A resolver picked by hand in Settings
 * is asked first instead, with the network DNS as the fallback.
 */
class ProviderDns(private val settings: () -> AppSettings) : Dns {

    private sealed interface Upstream {
        val label: String

        data object Network : Upstream {
            override val label: String = "System DNS"
        }

        data class Https(override val label: String, val url: String, val bootstrap: List<String>) : Upstream

        data class Udp(override val label: String, val server: String) : Upstream
    }

    private data class Plan(val primary: Upstream, val fallbacks: List<Upstream>) {
        val id: String = (listOf(primary) + fallbacks).joinToString(">") { it.label }
    }

    private data class Answer(val label: String, val addresses: List<InetAddress>)

    private data class Resolution(val addresses: List<InetAddress>, val sources: List<String>, val networkBlocked: Boolean)

    private data class Cached(val resolution: Resolution, val expiresAt: Long)

    private val cache = ConcurrentHashMap<String, Cached>()
    private val httpsResolvers = ConcurrentHashMap<String, Dns>()
    private val executor = Executors.newCachedThreadPool { runnable ->
        Thread(runnable, "nova-dns").apply { isDaemon = true }
    }

    /** Client used only to talk to the DoH resolvers, reached by fixed IP addresses. */
    private val bootstrapClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(4, TimeUnit.SECONDS)
            .readTimeout(4, TimeUnit.SECONDS)
            .callTimeout(6, TimeUnit.SECONDS)
            .build()
    }

    override fun lookup(hostname: String): List<InetAddress> {
        val resolution = resolve(hostname, useCache = true)
        if (resolution.addresses.isEmpty()) throw UnknownHostException("No address for $hostname")
        return resolution.addresses
    }

    /** Fresh resolution of [host] (a name or a full URL) for the DNS settings page. */
    fun diagnose(host: String): DnsCheck {
        val clean = host.substringAfter("://").substringBefore("/").substringAfter("@").substringBefore(":").trim()
        var resolution = Resolution(emptyList(), emptyList(), false)
        val elapsed = measureTimeMillis { resolution = resolve(clean, useCache = false) }
        return DnsCheck(
            host = clean,
            resolver = resolution.sources.ifEmpty { listOf(planFor(settings()).primary.label) }.joinToString(" + "),
            addresses = resolution.addresses.mapNotNull { it.hostAddress },
            latencyMs = elapsed,
            networkBlocked = resolution.networkBlocked,
        )
    }

    private fun resolve(hostname: String, useCache: Boolean): Resolution {
        if (hostname.isIpLiteral()) {
            return Resolution(InetAddress.getAllByName(hostname).toList(), listOf("IP"), false)
        }
        val plan = planFor(settings())
        val key = "${plan.id}|$hostname"
        if (useCache) {
            cache[key]?.takeIf { it.expiresAt > System.currentTimeMillis() }?.let { return it.resolution }
        }

        val fallbackTask = executor.submit<Answer?> { firstAnswer(plan.fallbacks, hostname) }
        val primary = query(plan.primary, hostname)
        val waitMs = if (primary.isEmpty()) FALLBACK_FULL_WAIT_MS else FALLBACK_SHORT_WAIT_MS
        val fallback = runCatching { fallbackTask.get(waitMs, TimeUnit.MILLISECONDS) }.getOrNull()
        val complete = fallbackTask.isDone

        val sources = buildList {
            if (primary.isNotEmpty()) add(plan.primary.label)
            if (fallback != null && fallback.addresses.any { it !in primary }) add(fallback.label)
        }
        val networkBlocked = plan.primary is Upstream.Network && primary.isEmpty() && fallback != null
        if (networkBlocked) Log.i(TAG, "DNS della rete senza risposta: uso ${fallback?.label}")

        val resolution = Resolution(
            addresses = (primary + fallback?.addresses.orEmpty()).distinct(),
            sources = sources,
            networkBlocked = networkBlocked,
        )
        if (resolution.addresses.isNotEmpty()) {
            val ttl = if (complete) CACHE_TTL_MS else PARTIAL_CACHE_TTL_MS
            cache[key] = Cached(resolution, System.currentTimeMillis() + ttl)
        }
        return resolution
    }

    private fun firstAnswer(upstreams: List<Upstream>, host: String): Answer? {
        upstreams.forEach { upstream ->
            val addresses = query(upstream, host)
            if (addresses.isNotEmpty()) return Answer(upstream.label, addresses)
        }
        return null
    }

    private fun query(upstream: Upstream, host: String): List<InetAddress> = runCatching {
        when (upstream) {
            Upstream.Network -> Dns.SYSTEM.lookup(host)
            is Upstream.Https -> httpsResolver(upstream).lookup(host)
            is Upstream.Udp -> udpLookup(upstream.server, host)
        }
    }.getOrDefault(emptyList()).filterNot { it.isSinkhole() }

    private fun httpsResolver(upstream: Upstream.Https): Dns = httpsResolvers.getOrPut(upstream.url) {
        val url = upstream.url.toHttpUrlOrNull() ?: return@getOrPut Dns { emptyList() }
        DnsOverHttps.Builder()
            .client(bootstrapClient)
            .url(url)
            .includeIPv6(false)
            .resolvePrivateAddresses(true)
            .apply {
                if (upstream.bootstrap.isNotEmpty()) {
                    bootstrapDnsHosts(upstream.bootstrap.map { InetAddress.getByName(it) })
                }
            }
            .build()
    }

    private fun planFor(current: AppSettings): Plan {
        val cloudflare = https(DnsPreset.CLOUDFLARE)
        val google = https(DnsPreset.GOOGLE)
        return when (current.dnsPreset) {
            DnsPreset.SYSTEM -> Plan(Upstream.Network, listOf(cloudflare, google))
            DnsPreset.GOOGLE -> Plan(google, listOf(Upstream.Network))
            DnsPreset.CLOUDFLARE -> Plan(cloudflare, listOf(Upstream.Network))
            DnsPreset.QUAD9 -> Plan(https(DnsPreset.QUAD9), listOf(Upstream.Network))
            DnsPreset.CUSTOM -> {
                val doh = current.customDnsDohUrl.trim()
                val ip = current.customDnsPrimary.trim()
                val primary = when {
                    doh.startsWith("https://") -> Upstream.Https("Custom DoH", doh, emptyList())
                    ip.isIpLiteral() -> Upstream.Udp("DNS $ip", ip)
                    else -> Upstream.Network
                }
                Plan(primary, listOf(Upstream.Network, cloudflare).filterNot { it == primary })
            }
        }
    }

    private fun https(preset: DnsPreset): Upstream.Https = Upstream.Https(
        label = "${preset.displayName} DoH",
        url = preset.dohUrl,
        bootstrap = listOf(preset.primary, preset.secondary).filter { it.isNotBlank() },
    )

    /** Plain DNS query over UDP, for a custom resolver given only by its IP address. */
    private fun udpLookup(server: String, host: String): List<InetAddress> {
        val id = Random.nextInt(0, 0xFFFF)
        val request = ByteArrayOutputStream().apply {
            write(id shr 8); write(id and 0xFF)
            write(0x01); write(0x00) // recursion desired
            write(0x00); write(0x01) // one question
            repeat(6) { write(0x00) }
            host.trimEnd('.').split('.').forEach { label ->
                val bytes = label.toByteArray(Charsets.US_ASCII)
                write(bytes.size); write(bytes)
            }
            write(0x00)
            write(0x00); write(0x01) // type A
            write(0x00); write(0x01) // class IN
        }.toByteArray()

        val response = ByteArray(1500)
        val length = DatagramSocket().use { socket ->
            socket.soTimeout = UDP_TIMEOUT_MS
            socket.send(DatagramPacket(request, request.size, InetAddress.getByName(server), 53))
            val packet = DatagramPacket(response, response.size)
            socket.receive(packet)
            packet.length
        }
        if (length < 12) return emptyList()
        fun u16(at: Int): Int = ((response[at].toInt() and 0xFF) shl 8) or (response[at + 1].toInt() and 0xFF)
        if (u16(0) != id) return emptyList()

        fun skipName(start: Int): Int {
            var at = start
            while (at < length) {
                val size = response[at].toInt() and 0xFF
                if (size == 0) return at + 1
                if (size and 0xC0 == 0xC0) return at + 2
                at += size + 1
            }
            return length
        }

        var offset = 12
        repeat(u16(4)) { offset = skipName(offset) + 4 }
        val result = mutableListOf<InetAddress>()
        repeat(u16(6)) {
            offset = skipName(offset)
            if (offset + 10 > length) return result
            val type = u16(offset)
            val dataLength = u16(offset + 8)
            offset += 10
            if (type == 1 && dataLength == 4 && offset + 4 <= length) {
                result += InetAddress.getByAddress(host, response.copyOfRange(offset, offset + 4))
            }
            offset += dataLength
        }
        return result
    }

    private companion object {
        const val TAG = "ProviderDns"
        const val CACHE_TTL_MS = 10 * 60_000L
        const val PARTIAL_CACHE_TTL_MS = 60_000L
        const val FALLBACK_SHORT_WAIT_MS = 800L
        const val FALLBACK_FULL_WAIT_MS = 7_000L
        const val UDP_TIMEOUT_MS = 3_000
    }
}

private val IPV4 = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")

private fun String.isIpLiteral(): Boolean = IPV4.matches(this) || (contains(':') && all { it.isLetterOrDigit() || it == ':' || it == '.' })

/** Addresses operators hand out for blocked names: nothing can be reached there. */
private fun InetAddress.isSinkhole(): Boolean =
    isAnyLocalAddress || isLoopbackAddress || (this is Inet4Address && address[0].toInt() == 0)
