package com.rork.novastream.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.novastream.data.local.DeviceIdentity
import com.rork.novastream.ui.components.LocalIsTv
import com.rork.novastream.ui.components.QrCodePanel
import com.rork.novastream.ui.i18n.Strings

/**
 * Address of the website playlist manager with the device and its key already
 * attached, so a QR scan lands straight on this device's list.
 */
internal fun playlistManagerLink(storeUrl: String, identity: DeviceIdentity, key: String): String = buildString {
    val base = (if (storeUrl.startsWith("http")) storeUrl else "https://$storeUrl").trimEnd('/')
    append(base)
    append("/playlist?device=")
    append(Uri.encode(identity.macAddress))
    if (key.isNotBlank()) {
        append("&key=")
        append(Uri.encode(key))
    }
}

/**
 * Tells the customer they can add and delete playlists from the website, and
 * shows the two things the site asks for: this device and its key. On a TV the
 * QR code does the typing; on a phone a button opens the page directly.
 */
@Composable
fun WebManageCard(
    identity: DeviceIdentity,
    deviceKey: String,
    storeUrl: String,
    strings: Strings,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val isTv = LocalIsTv.current
    val link = playlistManagerLink(storeUrl, identity, deviceKey)
    val siteLabel = storeUrl.removePrefix("https://").removePrefix("http://").trimEnd('/') + "/playlist"

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Language,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    text = strings.webManageTitle,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Text(
                text = strings.webManageBody.format(siteLabel),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CodeTile(
                    label = strings.webManageDeviceLabel,
                    value = identity.macAddress,
                    modifier = Modifier.weight(1.4f),
                )
                CodeTile(
                    label = strings.webManageKeyLabel,
                    value = deviceKey.chunked(3).joinToString(" "),
                    loading = deviceKey.isBlank(),
                    loadingLabel = strings.webManageKeyLoading,
                    emphasize = true,
                    modifier = Modifier.weight(1f),
                )
            }

            Text(
                text = strings.webManageKeyHint,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (isTv && deviceKey.isNotBlank()) {
                QrCodePanel(
                    content = link,
                    title = strings.webManageQrTitle,
                    caption = strings.webManageQrCaption,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            } else {
                FilledTonalButton(
                    onClick = {
                        runCatching {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse(link))
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.AutoMirrored.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(strings.webManageOpen)
                }
            }
        }
    }
}

@Composable
private fun CodeTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    loadingLabel: String = "",
    emphasize: Boolean = false,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = if (emphasize) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            if (loading) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(loadingLabel, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            } else {
                Text(
                    text = value,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = if (emphasize) 18.sp else 14.sp,
                    color = if (emphasize) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
            }
        }
    }
}
