package com.rork.novastream.data.net

import io.ktor.client.HttpClient
import io.ktor.client.request.prepareGet
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.isSuccess
import io.ktor.utils.io.jvm.javaio.toInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

private const val BUFFER_BYTES = 64 * 1024

/**
 * Streams a response straight to disk and returns the file.
 *
 * Provider catalogs and XMLTV guides routinely weigh tens of megabytes, while a
 * TV box hands the whole app a heap of around ninety. Reading such a response
 * into a string would need that much again in one contiguous block, which is
 * exactly the allocation that fails. Here bytes travel from the socket to a
 * file in small chunks, and parsing reads that file back the same way, so peak
 * memory no longer depends on how large the provider's list is.
 */
suspend fun HttpClient.downloadToFile(url: String, target: File): File = withContext(Dispatchers.IO) {
    target.parentFile?.mkdirs()
    prepareGet(url).execute { response ->
        if (!response.status.isSuccess()) {
            throw IllegalStateException("Il server ha risposto ${response.status.value}")
        }
        response.bodyAsChannel().toInputStream().use { input ->
            target.outputStream().buffered(BUFFER_BYTES).use { output ->
                input.copyTo(output, BUFFER_BYTES)
            }
        }
    }
    target
}
