package com.rork.novastream.data.net

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.head
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.system.measureTimeMillis

data class SpeedResult(
    val downloadMbps: Double,
    val latencyMs: Long,
    val bytes: Long,
)

/** Measures download throughput and latency so the user can judge stream quality. */
class SpeedTester(private val http: HttpClient) {

    suspend fun run(): Result<SpeedResult> = withContext(Dispatchers.IO) {
        runCatching {
            val latency = measureTimeMillis {
                http.head(LATENCY_URL)
            }

            var bytes = 0L
            val elapsed = measureTimeMillis {
                val payload: ByteArray = http.get(DOWNLOAD_URL).body()
                bytes = payload.size.toLong()
            }

            if (bytes <= 0L) throw IllegalStateException("Nessun dato ricevuto dal server di test")
            val seconds = (elapsed.coerceAtLeast(1L)) / 1000.0
            val mbps = (bytes * 8.0) / (seconds * 1_000_000.0)
            SpeedResult(downloadMbps = mbps, latencyMs = latency, bytes = bytes)
        }.onFailure { Log.w(TAG, "Speedtest non riuscito") }
    }

    private companion object {
        const val DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=10000000"
        const val LATENCY_URL = "https://speed.cloudflare.com/__down?bytes=1"
        const val TAG = "SpeedTester"
    }
}
