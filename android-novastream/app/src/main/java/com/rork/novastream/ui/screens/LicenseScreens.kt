package com.rork.novastream.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.novastream.data.local.BlockReason
import com.rork.novastream.data.local.DeviceIdentity
import com.rork.novastream.data.local.LicenseStatus
import com.rork.novastream.data.local.ONLINE_GRACE_DAYS
import com.rork.novastream.ui.components.BrandMark
import com.rork.novastream.ui.i18n.Language
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.theme.LocalNovaAccents
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/** Medium date in the language currently selected in Settings. */
internal fun licenseDate(epochMs: Long, language: Language): String =
    DateFormat.getDateInstance(DateFormat.LONG, Locale(language.code)).format(Date(epochMs))

/**
 * Hard gate shown once the trial is over, or once a paid period lapsed, and the
 * licence server has no valid purchase for this device. Nothing behind it is
 * reachable: the only way through is buying online.
 */
@Composable
fun LicenseLockedScreen(
    identity: DeviceIdentity,
    expiredAtMs: Long,
    wasPaid: Boolean,
    verifying: Boolean,
    language: Language,
    storeUrl: String,
    onRetry: () -> Unit,
) {
    val strings = LocalStrings.current
    val context = LocalContext.current

    GateScaffold(
        icon = { tint ->
            Icon(
                imageVector = Icons.Rounded.Lock,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(38.dp),
            )
        },
        accent = MaterialTheme.colorScheme.error,
        title = if (wasPaid) strings.licensePaidExpiredTitle else strings.licenseExpiredTitle,
        body = if (wasPaid) {
            strings.licensePaidExpiredBody.format(licenseDate(expiredAtMs, language))
        } else {
            strings.licenseExpiredBody.format(licenseDate(expiredAtMs, language))
        },
        identity = identity,
        footnote = strings.storeSteps,
    ) {
        Button(
            onClick = { openStore(context, storeUrl, identity.deviceId) },
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Icon(Icons.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                text = if (wasPaid) strings.licenseRenewAction else strings.activateOnline,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(12.dp))
        RecheckButton(verifying = verifying, onRetry = onRetry)
    }
}

/**
 * Gate shown when the server actively refuses this device — revoked or paused by
 * the owner — or when it has not been reachable for longer than the grace window.
 */
@Composable
fun LicenseBlockedScreen(
    identity: DeviceIdentity,
    reason: BlockReason,
    note: String,
    verifying: Boolean,
    lastVerifiedAtMs: Long,
    language: Language,
    storeUrl: String,
    onRetry: () -> Unit,
) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current
    val context = LocalContext.current

    val accent: Color = when (reason) {
        BlockReason.REVOKED -> MaterialTheme.colorScheme.error
        BlockReason.SUSPENDED -> accents.privacy
        BlockReason.UNVERIFIED -> MaterialTheme.colorScheme.primary
    }
    val icon = when (reason) {
        BlockReason.REVOKED -> Icons.Rounded.Lock
        BlockReason.SUSPENDED -> Icons.Rounded.PauseCircle
        BlockReason.UNVERIFIED -> Icons.Rounded.CloudOff
    }

    GateScaffold(
        icon = { tint ->
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(38.dp),
            )
        },
        accent = accent,
        title = when (reason) {
            BlockReason.REVOKED -> strings.licenseRevokedTitle
            BlockReason.SUSPENDED -> strings.licenseSuspendedTitle
            BlockReason.UNVERIFIED -> strings.licenseUnverifiedTitle
        },
        body = when (reason) {
            BlockReason.REVOKED -> strings.licenseRevokedBody
            BlockReason.SUSPENDED -> strings.licenseSuspendedBody
            BlockReason.UNVERIFIED -> strings.licenseUnverifiedBody.format(ONLINE_GRACE_DAYS)
        },
        note = note,
        identity = identity,
        footnote = if (lastVerifiedAtMs > 0L) {
            strings.licenseLastCheck.format(licenseDate(lastVerifiedAtMs, language))
        } else {
            strings.licenseNeverChecked
        },
    ) {
        RecheckButton(verifying = verifying, onRetry = onRetry, primary = true)
        if (reason == BlockReason.REVOKED) {
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { openStore(context, storeUrl, identity.deviceId) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(
                    imageVector = Icons.Rounded.OpenInNew,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(strings.activateOnline, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/** Shared full-screen layout of the two hard gates. */
@Composable
private fun GateScaffold(
    icon: @Composable (Color) -> Unit,
    accent: Color,
    title: String,
    body: String,
    identity: DeviceIdentity,
    footnote: String,
    note: String = "",
    actions: @Composable () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandMark(size = 40.dp)
            Spacer(Modifier.height(28.dp))
            Box(
                modifier = Modifier
                    .size(84.dp)
                    .background(accent.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                icon(accent)
            }
            Spacer(Modifier.height(20.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            if (note.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Surface(shape = RoundedCornerShape(14.dp), color = accent.copy(alpha = 0.10f)) {
                    Text(
                        text = note,
                        style = MaterialTheme.typography.bodySmall,
                        color = accent,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            Spacer(Modifier.height(26.dp))
            DeviceIdentityCard(identity = identity)

            Spacer(Modifier.height(24.dp))
            actions()

            Spacer(Modifier.height(16.dp))
            Text(
                text = footnote,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** "I already paid" action: asks the server again straight away. */
@Composable
private fun RecheckButton(verifying: Boolean, onRetry: () -> Unit, primary: Boolean = false) {
    val strings = LocalStrings.current
    val content: @Composable () -> Unit = {
        if (verifying) {
            CircularProgressIndicator(
                strokeWidth = 2.dp,
                color = if (primary) MaterialTheme.colorScheme.onPrimary
                else MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
        } else {
            Icon(
                imageVector = Icons.Rounded.Refresh,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(10.dp))
        Text(
            text = if (verifying) strings.licenseChecking else strings.alreadyPaidCheck,
            fontWeight = FontWeight.SemiBold,
        )
    }

    if (primary) {
        Button(
            onClick = onRetry,
            enabled = !verifying,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
        ) { content() }
    } else {
        OutlinedButton(
            onClick = onRetry,
            enabled = !verifying,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
        ) { content() }
    }
}

/** Purchase entry point shown in Settings while no purchase covers this device. */
@Composable
fun BuyLicenseCard(
    identity: DeviceIdentity,
    storeUrl: String,
    modifier: Modifier = Modifier,
) {
    val strings = LocalStrings.current
    val context = LocalContext.current

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(
                text = strings.buyLicenseWhere,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = strings.storeSteps,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { openStore(context, storeUrl, identity.deviceId) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    imageVector = Icons.Rounded.OpenInNew,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(strings.activateOnline, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/** White card showing the MAC and the device id, with a one-tap copy action. */
@Composable
fun DeviceIdentityCard(
    identity: DeviceIdentity,
    modifier: Modifier = Modifier,
) {
    val strings = LocalStrings.current
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    var copied by remember { mutableStateOf(false) }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(
                text = strings.deviceIdentityLabel,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = identity.macAddress,
                        style = MaterialTheme.typography.headlineSmall,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "${strings.deviceIdLabel} · ${identity.deviceId}",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(
                    onClick = {
                        clipboard.setText(AnnotatedString(identity.deviceId))
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        copied = true
                    },
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ContentCopy,
                        contentDescription = strings.copyIdentifier,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            HorizontalDivider(color = LocalNovaAccents.current.hairline)
            Spacer(Modifier.height(14.dp))
            Text(
                text = if (copied) strings.identifierCopied else strings.licenseBoundNote,
                style = MaterialTheme.typography.bodySmall,
                color = if (copied) LocalNovaAccents.current.live
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Amber trial strip shown at the top of Home while the free window is running. */
@Composable
fun TrialBanner(
    trial: LicenseStatus.Trial,
    language: Language,
    onActivate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current
    val lastDay = trial.daysRemaining <= 1
    val accent: Color = if (lastDay) MaterialTheme.colorScheme.error else accents.privacy
    val progress by animateFloatAsState(
        targetValue = trial.usedFraction,
        animationSpec = spring(stiffness = 220f),
        label = "trialProgress",
    )

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(accent),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Timer,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(24.dp),
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = if (lastDay) strings.trialLastDay
                        else strings.trialDaysRemaining.format(trial.daysRemaining),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = strings.trialActiveUntil.format(
                            licenseDate(trial.expiresAtMs, language)
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    LinearProgressIndicator(
                        progress = { progress },
                        color = accent,
                        trackColor = accents.hairline,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        gapSize = 0.dp,
                        drawStopIndicator = {},
                    )
                }
                Spacer(Modifier.width(8.dp))
                TextButton(
                    onClick = onActivate,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Text(strings.trialActivateAction, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
