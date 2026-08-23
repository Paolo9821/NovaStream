package com.rork.novastream.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.rork.novastream.data.local.SalesChannel
import com.rork.novastream.data.local.SalesConfig

/**
 * Opens the reseller channel configured in the admin panel with the device
 * identifiers already written into the message. Falls back to the system share
 * sheet whenever the target app is missing or nothing was configured yet.
 */
internal fun launchPurchase(
    context: Context,
    sales: SalesConfig,
    subject: String,
    message: String,
    chooserTitle: String,
) {
    val intent = purchaseIntent(sales, subject, message)
    // Telegram and plain web links cannot carry a body: keep it one paste away.
    if (sales.channel == SalesChannel.TELEGRAM || sales.channel == SalesChannel.WEBSITE) {
        copyToClipboard(context, message)
    }
    val launched = runCatching { context.startActivity(intent) }.isSuccess
    if (!launched) {
        runCatching {
            context.startActivity(
                Intent.createChooser(shareIntent(subject, message), chooserTitle)
            )
        }
    }
}

private fun purchaseIntent(sales: SalesConfig, subject: String, message: String): Intent {
    if (!sales.isConfigured) return Intent.createChooser(shareIntent(subject, message), subject)
    return when (sales.channel) {
        SalesChannel.WHATSAPP -> {
            val number = sales.handle.filter { it.isDigit() }
            Intent(Intent.ACTION_VIEW, "https://wa.me/$number?text=${Uri.encode(message)}".toUri())
        }

        SalesChannel.TELEGRAM -> {
            val user = sales.handle.removePrefix("@").substringAfterLast('/')
            Intent(Intent.ACTION_VIEW, "https://t.me/$user".toUri())
        }

        SalesChannel.WEBSITE -> Intent(Intent.ACTION_VIEW, normalizedUrl(sales.handle).toUri())

        SalesChannel.EMAIL -> Intent(Intent.ACTION_SENDTO, "mailto:${sales.handle}".toUri()).apply {
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, message)
        }

        SalesChannel.SHARE -> Intent.createChooser(shareIntent(subject, message), subject)
    }
}

private fun shareIntent(subject: String, message: String): Intent =
    Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, message)
    }

private fun normalizedUrl(raw: String): String =
    if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "https://$raw"

private fun String.toUri(): Uri = Uri.parse(this)

internal fun copyToClipboard(context: Context, text: String, toast: String? = null) {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    manager?.setPrimaryClip(ClipData.newPlainText("NovaStream", text))
    if (toast != null) Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
