package com.rork.novastream.ui.i18n

import com.rork.novastream.data.model.SyncFailure
import com.rork.novastream.data.model.SyncState

/**
 * What to show for a failed download: a plain explanation in the viewer's
 * language for network failures, never a raw library message such as
 * "unexpected end of stream on com.android.okhttp.Address@…".
 */
fun Strings.failureText(state: SyncState.Failed): String = when (state.reason) {
    SyncFailure.CONNECTION_CLOSED -> syncFailClosed
    SyncFailure.UNREACHABLE -> syncFailUnreachable
    SyncFailure.TIMEOUT -> syncFailTimeout
    SyncFailure.SECURE -> syncFailSecure
    SyncFailure.REFUSED -> syncFailRefused
    SyncFailure.NOT_FOUND -> syncFailNotFound
    SyncFailure.SERVER_ERROR -> syncFailServer
    null -> state.message
}
