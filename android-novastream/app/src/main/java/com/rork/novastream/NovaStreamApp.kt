package com.rork.novastream

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import com.rork.novastream.data.local.CrashReporter
import com.rork.novastream.data.net.ProviderNetwork

class NovaStreamApp : Application(), SingletonImageLoader.Factory {
    override fun onCreate() {
        super.onCreate()
        CrashReporter.install(this)
    }

    /** Covers and logos come from the provider too, so they share its DNS. */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { ProviderNetwork.mediaClient })) }
            .build()
}
