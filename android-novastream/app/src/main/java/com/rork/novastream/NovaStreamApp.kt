package com.rork.novastream

import android.app.Application
import com.rork.novastream.data.local.CrashReporter

class NovaStreamApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashReporter.install(this)
    }
}
