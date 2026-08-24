package com.rork.novastream.data.local

import android.content.Context
import android.os.Build
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Catches anything that would kill the process and keeps the stack trace so the
 * next launch can show it. Without this the app just vanishes from the screen
 * and nobody can say what went wrong.
 */
object CrashReporter {

    private const val PREFS = "novastream_crash"
    private const val KEY_REPORT = "last_report"
    private const val MAX_CHARS = 4_000

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { store(appContext, thread.name, error) }
            previous?.uncaughtException(thread, error)
        }
    }

    /** The report waiting to be shown, or null when the last run ended cleanly. */
    fun pending(context: Context): String? = runCatching {
        prefs(context).getString(KEY_REPORT, null)?.takeIf { it.isNotBlank() }
    }.getOrNull()

    fun clear(context: Context) {
        runCatching { prefs(context).edit().remove(KEY_REPORT).apply() }
    }

    private fun store(context: Context, threadName: String, error: Throwable) {
        val stack = StringWriter().also { writer ->
            PrintWriter(writer).use { error.printStackTrace(it) }
        }.toString()

        val report = buildString {
            appendLine("NovaStream ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE}")
            appendLine("thread: $threadName")
            appendLine()
            append(stack)
        }.take(MAX_CHARS)

        // commit(), not apply(): the process is about to die.
        prefs(context).edit().putString(KEY_REPORT, report).commit()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
