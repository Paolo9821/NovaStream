package com.rork.novastream.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.novastream.ui.components.LocalIsTv
import com.rork.novastream.ui.components.QrCodePanel
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame
import androidx.compose.ui.focus.focusRequester
import com.rork.novastream.ui.i18n.LocalStrings

/**
 * Wraps a purchase button and hands it the right way to reach the storefront.
 *
 * On a phone the link simply opens: the browser is right there and it is the
 * quickest route to the payment page. On a television there is usually no
 * browser worth the name — and no keyboard to type an address into — so the
 * link is shown as a QR code instead, which the customer scans with the phone
 * already in their hand.
 */
@Composable
fun StorePurchase(
    storeUrl: String,
    deviceId: String,
    content: @Composable (onBuy: () -> Unit) -> Unit,
) {
    val context = LocalContext.current
    val isTv = LocalIsTv.current
    var qrVisible by remember { mutableStateOf(false) }

    content {
        if (isTv) qrVisible = true else openStore(context, storeUrl, deviceId)
    }

    if (qrVisible) {
        StoreQrDialog(
            link = storeLink(storeUrl, deviceId),
            onDismiss = { qrVisible = false },
        )
    }
}

/** Full-size QR of the storefront link, made to be scanned from the sofa. */
@Composable
private fun StoreQrDialog(
    link: String,
    onDismiss: () -> Unit,
) {
    val strings = LocalStrings.current
    val closeFocus = rememberFocusRequester()
    RequestInitialFocus(closeFocus)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = strings.qrScanTitle,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = strings.storeSteps,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(16.dp))
                QrCodePanel(
                    content = link,
                    title = strings.qrScanTitle,
                    caption = strings.qrScanCaption,
                    modifier = Modifier.widthIn(max = 320.dp),
                    codeSize = 200,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier
                    .focusRequester(closeFocus)
                    .tvFocusFrame(cornerRadius = 20.dp),
            ) { Text(strings.close) }
        },
    )
}
