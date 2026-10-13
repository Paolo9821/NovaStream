package com.rork.novastream.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast

/*
 * The storefront opener and its QR link used to live here. They were removed in
 * 1.3.2 to comply with the Google Play payments policy: the app must not lead
 * users to a payment method outside Google Play.
 */

internal fun copyToClipboard(context: Context, text: String, toast: String? = null) {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    manager?.setPrimaryClip(ClipData.newPlainText("NovaStream", text))
    if (toast != null) Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
}
