package com.rork.novastream.data.net

import com.rork.novastream.data.local.AppSettings
import kotlinx.coroutines.flow.StateFlow
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * The single HTTP stack for everything that comes from the provider: playlist,
 * guide, covers and video. Sharing one client means the DNS choice made in
 * Settings, and the automatic bypass of operator DNS blocks, apply everywhere
 * instead of only to the "Check DNS" button.
 */
object ProviderNetwork {

    @Volatile
    private var settings: StateFlow<AppSettings>? = null

    /** Connects the network stack to the saved settings; called once by the repository. */
    fun attach(flow: StateFlow<AppSettings>) {
        settings = flow
    }

    val dns: ProviderDns by lazy { ProviderDns { settings?.value ?: AppSettings() } }

    /** Lists and guide: long reads, since providers stream tens of megabytes slowly. */
    val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .dns(dns)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    /** Video and covers: fail fast so the player can retry or show its error. */
    val mediaClient: OkHttpClient by lazy {
        client.newBuilder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
