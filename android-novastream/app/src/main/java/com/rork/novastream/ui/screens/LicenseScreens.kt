package com.rork.novastream.ui.screens

import android.content.Intent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material.icons.rounded.Smartphone
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.VpnKey
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.novastream.data.local.BlockReason
import com.rork.novastream.data.local.DeviceIdentity
import com.rork.novastream.data.local.LicenseCodes
import com.rork.novastream.data.local.ONLINE_GRACE_DAYS
import com.rork.novastream.data.local.LicenseStatus
import com.rork.novastream.data.local.SalesConfig
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
 * Hard gate shown once the 7-day trial is over and no license is bound to this
 * device. Nothing behind it is reachable.
 */
@Composable
fun LicenseLockedScreen(
    identity: DeviceIdentity,
    expiredAtMs: Long,
    language: Language,
    sales: SalesConfig,
    onActivate: (String) -> Boolean,
) {
    val strings = LocalStrings.current
    val context = LocalContext.current
    var sheetVisible by remember { mutableStateOf(false) }

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
                    .background(
                        MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
                        CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(38.dp),
                )
            }
            Spacer(Modifier.height(20.dp))
            Text(
                text = strings.licenseExpiredTitle,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = strings.licenseExpiredBody.format(licenseDate(expiredAtMs, language)),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(26.dp))
            DeviceIdentityCard(identity = identity)

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = { sheetVisible = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Rounded.VpnKey, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(strings.enterActivationCode, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = {
                    launchPurchase(
                        context = context,
                        sales = sales,
                        subject = strings.licenseRequestSubject,
                        message = strings.licenseRequestBody
                            .format(identity.macAddress, identity.deviceId),
                        chooserTitle = strings.buyLicense,
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Rounded.ShoppingCart, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(
                    text = if (sales.storeName.isNotBlank()) sales.storeName else strings.buyLicense,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(16.dp))
            Text(
                text = sales.priceNote.ifBlank { strings.resellerHint },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            Spacer(Modifier.height(12.dp))
        }
    }

    if (sheetVisible) {
        ActivationSheet(
            identity = identity,
            onDismiss = { sheetVisible = false },
            onActivate = onActivate,
        )
    }
}

/**
 * Gate shown when the code is valid on this device but the registry says
 * otherwise: revoked, suspended, or simply not reachable for too long.
 */
@Composable
fun LicenseBlockedScreen(
    identity: DeviceIdentity,
    reason: BlockReason,
    note: String,
    verifying: Boolean,
    lastVerifiedAtMs: Long,
    language: Language,
    sales: SalesConfig,
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
    val title = when (reason) {
        BlockReason.REVOKED -> strings.licenseRevokedTitle
        BlockReason.SUSPENDED -> strings.licenseSuspendedTitle
        BlockReason.UNVERIFIED -> strings.licenseUnverifiedTitle
    }
    val body = when (reason) {
        BlockReason.REVOKED -> strings.licenseRevokedBody
        BlockReason.SUSPENDED -> strings.licenseSuspendedBody
        BlockReason.UNVERIFIED -> strings.licenseUnverifiedBody.format(ONLINE_GRACE_DAYS)
    }

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
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(38.dp),
                )
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
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = accent.copy(alpha = 0.10f),
                ) {
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
            Button(
                onClick = onRetry,
                enabled = !verifying,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                if (verifying) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
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
                    text = if (verifying) strings.licenseChecking else strings.licenseRetryCheck,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            if (reason != BlockReason.UNVERIFIED) {
                Spacer(Modifier.height(12.dp))
                OutlinedButton(
                    onClick = {
                        launchPurchase(
                            context = context,
                            sales = sales,
                            subject = strings.licenseRequestSubject,
                            message = strings.licenseRequestBody
                                .format(identity.macAddress, identity.deviceId),
                            chooserTitle = strings.buyLicense,
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ShoppingCart,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = if (sales.storeName.isNotBlank()) sales.storeName
                        else strings.buyLicense,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                text = if (lastVerifiedAtMs > 0L) {
                    strings.licenseLastCheck.format(licenseDate(lastVerifiedAtMs, language))
                } else {
                    strings.licenseNeverChecked
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** Purchase entry point shown in Settings while no license is bound yet. */
@Composable
fun BuyLicenseCard(
    sales: SalesConfig,
    identity: DeviceIdentity,
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
                text = when {
                    sales.priceNote.isNotBlank() -> sales.priceNote
                    sales.isConfigured && sales.storeName.isNotBlank() -> sales.storeName
                    else -> strings.buyLicenseFallback
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = {
                    launchPurchase(
                        context = context,
                        sales = sales,
                        subject = strings.licenseRequestSubject,
                        message = strings.licenseRequestBody
                            .format(identity.macAddress, identity.deviceId),
                        chooserTitle = strings.buyLicense,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Rounded.ShoppingCart, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(strings.buyLicenseAction, fontWeight = FontWeight.SemiBold)
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
                        clipboard.setText(
                            AnnotatedString("${identity.macAddress} · ${identity.deviceId}")
                        )
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

/** Bottom sheet where the activation code is typed and checked against this device. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivationSheet(
    identity: DeviceIdentity,
    onDismiss: () -> Unit,
    onActivate: (String) -> Boolean,
) {
    val strings = LocalStrings.current
    val haptics = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var code by remember { mutableStateOf("") }
    var invalid by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = 22.dp)
                .padding(bottom = 28.dp),
        ) {
            Text(
                text = strings.activationTitle,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = strings.activationSubtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))

            OutlinedTextField(
                value = code,
                onValueChange = {
                    code = LicenseCodes.format(it)
                    invalid = false
                },
                label = { Text(strings.activationField) },
                placeholder = { Text("XXXX-XXXX-XXXX-XXXX", fontFamily = FontFamily.Monospace) },
                singleLine = true,
                isError = invalid,
                textStyle = MaterialTheme.typography.titleMedium.copy(
                    fontFamily = FontFamily.Monospace,
                ),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    capitalization = KeyboardCapitalization.Characters,
                ),
                supportingText = {
                    Text(
                        text = if (invalid) strings.activationInvalid else strings.activationFormat,
                        style = MaterialTheme.typography.bodySmall,
                    )
                },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(14.dp))
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Smartphone,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            text = strings.activationBoundTo,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = identity.macAddress,
                            style = MaterialTheme.typography.titleSmall,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = {
                    if (onActivate(code)) {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onDismiss()
                    } else {
                        invalid = true
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    }
                },
                enabled = LicenseCodes.normalize(code).length == 16,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(strings.activateAction, fontWeight = FontWeight.SemiBold)
            }

            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Lock,
                    contentDescription = null,
                    tint = LocalNovaAccents.current.live,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = strings.activationSecure,
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalNovaAccents.current.live,
                )
            }
            Spacer(
                Modifier.windowInsetsPadding(WindowInsets.navigationBars)
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
