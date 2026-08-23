package com.rork.novastream.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Category accent colors shared across the whole app. */
data class NovaAccents(
    val live: Color,
    val liveContainer: Color,
    val movie: Color,
    val movieContainer: Color,
    val series: Color,
    val seriesContainer: Color,
    val privacy: Color,
    val privacyContainer: Color,
    val hairline: Color,
)

private val LightAccents = NovaAccents(
    live = AccentGreen,
    liveContainer = AccentGreenSoft,
    movie = AccentBlue,
    movieContainer = AccentBlueSoft,
    series = AccentPurple,
    seriesContainer = AccentPurpleSoft,
    privacy = Color(0xFF8A6D00),
    privacyContainer = PrivacyAmberSoft,
    hairline = HairlineLight,
)

private val DarkAccents = NovaAccents(
    live = AccentGreenDark,
    liveContainer = Color(0xFF102A22),
    movie = AccentBlueDark,
    movieContainer = AccentBlueSoftDark,
    series = AccentPurpleDark,
    seriesContainer = Color(0xFF241F45),
    privacy = PrivacyAmber,
    privacyContainer = Color(0xFF33290A),
    hairline = HairlineDark,
)

val LocalNovaAccents = staticCompositionLocalOf { LightAccents }

private val LightScheme = lightColorScheme(
    primary = AccentBlue,
    onPrimary = Color.White,
    primaryContainer = AccentBlueSoft,
    onPrimaryContainer = Color(0xFF10275C),
    secondary = AccentGreen,
    onSecondary = Color.White,
    secondaryContainer = AccentGreenSoft,
    onSecondaryContainer = Color(0xFF073B2C),
    tertiary = AccentPurple,
    onTertiary = Color.White,
    tertiaryContainer = AccentPurpleSoft,
    onTertiaryContainer = Color(0xFF251F55),
    background = Canvas,
    onBackground = InkPrimary,
    surface = SurfaceWhite,
    onSurface = InkPrimary,
    surfaceVariant = Color(0xFFEEF1F5),
    onSurfaceVariant = InkSecondary,
    surfaceContainer = SurfaceWhite,
    surfaceContainerHigh = Color(0xFFF1F3F7),
    surfaceContainerLow = Color(0xFFFBFCFD),
    outline = Color(0xFFD1D5DB),
    outlineVariant = HairlineLight,
    error = Color(0xFFDC2626),
)

private val DarkScheme = darkColorScheme(
    primary = AccentBlueDark,
    onPrimary = Color(0xFF08132B),
    primaryContainer = AccentBlueSoftDark,
    onPrimaryContainer = Color(0xFFD9E4FF),
    secondary = AccentGreenDark,
    onSecondary = Color(0xFF04241A),
    secondaryContainer = Color(0xFF102A22),
    onSecondaryContainer = Color(0xFFD3F7E8),
    tertiary = AccentPurpleDark,
    onTertiary = Color(0xFF181343),
    tertiaryContainer = Color(0xFF241F45),
    onTertiaryContainer = Color(0xFFE7E3FF),
    background = CanvasDark,
    onBackground = InkPrimaryDark,
    surface = SurfaceDark,
    onSurface = InkPrimaryDark,
    surfaceVariant = Color(0xFF1E2532),
    onSurfaceVariant = InkSecondaryDark,
    surfaceContainer = SurfaceDark,
    surfaceContainerHigh = Color(0xFF1C222D),
    surfaceContainerLow = Color(0xFF11161F),
    outline = Color(0xFF3A4353),
    outlineVariant = HairlineDark,
    error = Color(0xFFF87171),
)

@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkScheme else LightScheme
    val accents = if (darkTheme) DarkAccents else LightAccents

    CompositionLocalProvider(LocalNovaAccents provides accents) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NovaTypography,
            content = content
        )
    }
}
