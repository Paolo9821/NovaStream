package com.rork.novastream.data.local

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.android.play.core.review.ReviewManagerFactory
import com.google.android.play.core.ktx.launchReview
import com.google.android.play.core.ktx.requestReview

/**
 * Google's in-app rating prompt.
 *
 * The rules of the API are followed to the letter: nothing is asked before it
 * (no "do you like the app? yes/no" gate, which Play forbids), the store alone
 * decides whether the sheet actually appears, and a call that shows nothing is
 * a success rather than an error.
 *
 * What is kept on the device is only *when it is fair to ask*: someone who has
 * just installed the app has no opinion yet, so the request waits until they
 * have had NovaStream for a few days and have opened it a handful of times.
 * After an attempt the clock is pushed months ahead, so the prompt can never
 * become a recurring interruption even where Play would allow another one.
 */
object ReviewPrompt {

    private const val PREFS = "novastream_review"
    private const val KEY_FIRST_LAUNCH = "first_launch_at"
    private const val KEY_LAUNCHES = "launch_count"
    private const val KEY_LAST_REQUEST = "last_request_at"
    private const val TAG = "ReviewPrompt"

    /** Days of use before the question is worth asking at all. */
    private const val MIN_DAYS_INSTALLED = 3L

    /** Launches before asking: someone who opened it twice has nothing to say. */
    private const val MIN_LAUNCHES = 5

    private const val DAY_MS = 24L * 60 * 60 * 1000

    /** Never ask twice within four months, whatever Play's own quota allows. */
    private const val MIN_GAP_MS = 120 * DAY_MS

    /** Records this launch. Called once per cold start, before anything is shown. */
    fun noteLaunch(context: Context) {
        val prefs = prefs(context)
        val now = System.currentTimeMillis()
        val first = prefs.getLong(KEY_FIRST_LAUNCH, 0L)
        prefs.edit()
            .putLong(KEY_FIRST_LAUNCH, if (first == 0L) now else first)
            .putInt(KEY_LAUNCHES, prefs.getInt(KEY_LAUNCHES, 0) + 1)
            .apply()
    }

    /** True when this install has earned the right to be asked. */
    fun isDue(context: Context): Boolean {
        val prefs = prefs(context)
        val now = System.currentTimeMillis()
        val first = prefs.getLong(KEY_FIRST_LAUNCH, 0L)
        if (first == 0L) return false
        if (now - first < MIN_DAYS_INSTALLED * DAY_MS) return false
        if (prefs.getInt(KEY_LAUNCHES, 0) < MIN_LAUNCHES) return false
        val last = prefs.getLong(KEY_LAST_REQUEST, 0L)
        return last == 0L || now - last >= MIN_GAP_MS
    }

    /**
     * Hands the request to Play. The sheet may or may not appear — that is the
     * store's decision, and the app has to behave identically either way, so
     * the attempt is written down regardless and a failure shows nothing.
     */
    suspend fun request(activity: Activity) {
        runCatching {
            val manager = ReviewManagerFactory.create(activity)
            val info = manager.requestReview()
            manager.launchReview(activity, info)
        }.onFailure { Log.i(TAG, "Richiesta di recensione non disponibile") }

        prefs(activity)
            .edit()
            .putLong(KEY_LAST_REQUEST, System.currentTimeMillis())
            .apply()
    }

    private fun prefs(context: Context) = context.applicationContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
