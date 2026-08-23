package com.rork.novastream.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Smartphone
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.novastream.data.local.DeviceProfile
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.theme.LocalNovaAccents

/**
 * First-launch screen asking whether the app runs on a TV or on a phone/tablet.
 * The answer is persisted, so it is shown only once.
 */
@Composable
fun OnboardingScreen(
    suggestedProfile: DeviceProfile,
    onConfirm: (DeviceProfile) -> Unit,
) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current
    val haptics = LocalHapticFeedback.current
    var selected by remember { mutableStateOf(suggestedProfile) }

    val configuration = LocalConfiguration.current
    val wide = configuration.screenWidthDp >= 720

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    0f to MaterialTheme.colorScheme.background,
                    0.55f to MaterialTheme.colorScheme.background,
                    1f to MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 24.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "N",
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "NovaStream",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground,
                )
            }

            Spacer(Modifier.height(28.dp))

            Text(
                text = strings.welcomeTitle,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = strings.welcomeSubtitle,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(28.dp))

            val tvCard: @Composable (Modifier) -> Unit = { modifier ->
                DeviceOptionCard(
                    icon = Icons.Rounded.Tv,
                    title = strings.deviceTvTitle,
                    body = strings.deviceTvBody,
                    accent = accents.live,
                    container = accents.liveContainer,
                    selected = selected == DeviceProfile.TV,
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        selected = DeviceProfile.TV
                    },
                    modifier = modifier,
                )
            }
            val phoneCard: @Composable (Modifier) -> Unit = { modifier ->
                DeviceOptionCard(
                    icon = Icons.Rounded.Smartphone,
                    title = strings.devicePhoneTitle,
                    body = strings.devicePhoneBody,
                    accent = MaterialTheme.colorScheme.primary,
                    container = accents.movieContainer,
                    selected = selected == DeviceProfile.PHONE,
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        selected = DeviceProfile.PHONE
                    },
                    modifier = modifier,
                )
            }

            if (wide) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    tvCard(Modifier.weight(1f))
                    phoneCard(Modifier.weight(1f))
                }
            } else {
                tvCard(Modifier.fillMaxWidth())
                Spacer(Modifier.height(14.dp))
                phoneCard(Modifier.fillMaxWidth())
            }

            Spacer(Modifier.height(28.dp))

            Button(
                onClick = { onConfirm(selected) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                ),
            ) {
                Text(
                    text = strings.welcomeContinue,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(12.dp))
            Text(
                text = strings.welcomeChangeLater,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun DeviceOptionCard(
    icon: ImageVector,
    title: String,
    body: String,
    accent: androidx.compose.ui.graphics.Color,
    container: androidx.compose.ui.graphics.Color,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.02f else 1f,
        animationSpec = spring(dampingRatio = 0.62f, stiffness = 520f),
        label = "deviceCardScale",
    )

    Surface(
        onClick = onClick,
        modifier = modifier.scale(scale),
        shape = RoundedCornerShape(20.dp),
        color = if (selected) container else MaterialTheme.colorScheme.surface,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) accent else MaterialTheme.colorScheme.outlineVariant),
        tonalElevation = if (selected) 3.dp else 0.dp,
        shadowElevation = if (selected) 8.dp else 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .background(accent.copy(alpha = if (selected) 0.20f else 0.12f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (selected) {
                Spacer(Modifier.width(10.dp))
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .background(accent, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Rounded.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
