package com.rork.novastream.data.net

import android.util.Log
import com.rork.novastream.data.model.SyncFailure
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.prepareGet
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import io.ktor.utils.io.jvm.javaio.toInputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.EOFException
import java.io.File
import java.io.IOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

private const val BUFFER_BYTES = 64 * 1024
private const val TAG = "Downloads"

/** Attempts per request before a provider is declared unreachable. */
private const val MAX_ATTEMPTS = 3

/**
 * Identities presented to IPTV panels. Many of them silently drop the
 * connection when they see Android's default "Dalvik" agent, which is exactly
 * what surfaces as "unexpected end of stream". A media player identity is what
 * these panels expect; a browser one is the fallback for the few that filter
 * players.
 */
private val USER_AGENTS = listOf(
    "VLC/3.0.21 LibVLC/3.0.21",
    "Mozilla/5.0 (Linux; Android 12; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "IPTVSmartersPlayer",
)

/**
 * Headers for provider requests. `Connection: close` stops the platform from
 * reusing a pooled socket the panel already closed on its side, the other
 * common cause of an empty answer on TV boxes.
 */
private fun HttpRequestBuilder.providerHeaders(attempt: Int) {
    header(HttpHeaders.UserAgent, USER_AGENTS[attempt % USER_AGENTS.size])
    header(HttpHeaders.Accept, "*/*")
    header(HttpHeaders.Connection, "close")
}

/** True for dropped or reset connections, which usually succeed a moment later. */
private fun Throwable.isTransient(): Boolean = when (this) {
    is UnknownHostException -> false
    is SSLException -> false
    is EOFException, is SocketException, is SocketTimeoutException -> true
    is IOException -> true
    else -> false
}

/**
 * Runs [block] up to [MAX_ATTEMPTS] times while the failure looks like a
 * dropped connection, waiting a little longer each time. Each attempt gets its
 * own index so the caller can vary the identity it presents.
 */
suspend fun <T> withProviderRetry(block: suspend (attempt: Int) -> T): T {
    var last: Throwable? = null
    repeat(MAX_ATTEMPTS) { attempt ->
        try {
            return block(attempt)
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (error: Throwable) {
            last = error
            if (!error.isTransient() || attempt == MAX_ATTEMPTS - 1) throw error
            Log.w(TAG, "Richiesta al provider interrotta (tentativo ${attempt + 1}): ${error.javaClass.simpleName}")
            delay(1_200L * (attempt + 1))
        }
    }
    throw last ?: IOException("unreachable")
}

/**
 * Streams a response straight to disk and returns the file.
 *
 * Provider catalogs and XMLTV guides routinely weigh tens of megabytes, while a
 * TV box hands the whole app a heap of around ninety. Reading such a response
 * into a string would need that much again in one contiguous block, which is
 * exactly the allocation that fails. Here bytes travel from the socket to a
 * file in small chunks, and parsing reads that file back the same way, so peak
 * memory no longer depends on how large the provider's list is. Dropped
 * connections are retried with a fresh socket.
 */
suspend fun HttpClient.downloadToFile(url: String, target: File): File = withContext(Dispatchers.IO) {
    target.parentFile?.mkdirs()
    withProviderRetry { attempt ->
        prepareGet(url) { providerHeaders(attempt) }.execute { response ->
            if (!response.status.isSuccess()) {
                throw ProviderHttpException(response.status.value)
            }
            response.bodyAsChannel().toInputStream().use { input ->
                target.outputStream().buffered(BUFFER_BYTES).use { output ->
                    input.copyTo(output, BUFFER_BYTES)
                }
            }
        }
    }
    target
}

/** Small provider answers (account check, details), with the same retry policy. */
suspend fun HttpClient.getProviderText(url: String): String = withContext(Dispatchers.IO) {
    withProviderRetry { attempt ->
        get(url) { providerHeaders(attempt) }.bodyAsText()
    }
}

/** The provider answered, but with an HTTP error status. */
class ProviderHttpException(val status: Int) : IllegalStateException("Il server ha risposto $status")

/** Classifies a network failure so the interface can explain it in the viewer's language. */
fun Throwable.toSyncFailure(): SyncFailure? {
    var current: Throwable? = this
    while (current != null) {
        when (current) {
            is ProviderHttpException -> return when (current.status) {
                401, 403 -> SyncFailure.REFUSED
                404 -> SyncFailure.NOT_FOUND
                else -> SyncFailure.SERVER_ERROR
            }
            is UnknownHostException -> return SyncFailure.UNREACHABLE
            is ConnectException, is NoRouteToHostException -> return SyncFailure.UNREACHABLE
            is SocketTimeoutException -> return SyncFailure.TIMEOUT
            is SSLException -> return SyncFailure.SECURE
            is EOFException, is SocketException -> return SyncFailure.CONNECTION_CLOSED
            is IOException -> if (current.message.orEmpty().contains("end of stream", ignoreCase = true)) {
                return SyncFailure.CONNECTION_CLOSED
            }
        }
        current = current.cause
    }
    return if (this is IOException) SyncFailure.CONNECTION_CLOSED else null
}
