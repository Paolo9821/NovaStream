package com.rork.novastream.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * Opens the NovaStream storefront with the device identifier pre-filled, and
 * leaves it on the clipboard so it can be pasted on TV browsers that ignore
 * query parameters.
 */
internal fun openStore(context: Context, storeUrl: String, deviceId: String) {
    copyToClipboard(context, deviceId)
    val target = buildString {
        append(if (storeUrl.startsWith("http")) storeUrl else "https://$storeUrl")
        append(if (contains('?')) "&" else "?")
        append("device=")
        append(Uri.encode(deviceId))
    }
    val opened = runCatching {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(target))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }.isSuccess
    if (!opened) {
        // Android TV boxes without a browser: hand the link to whatever can take it.
        runCatching {
            context.startActivity(
                Intent.createChooser(
                    Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "$target\n$deviceId")
                    },
                    "NovaStream",
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }
}

internal fun copyToClipboard(context: Context, text: String, toast: String? = null) {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    manager?.setPrimaryClip(ClipData.newPlainText("NovaStream", text))
    if (toast != null) Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
