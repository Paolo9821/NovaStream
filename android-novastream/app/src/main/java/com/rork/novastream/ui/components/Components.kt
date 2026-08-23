package com.rork.novastream.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.theme.LocalNovaAccents

@Composable
fun accentFor(kind: MediaKind): Color {
    val accents = LocalNovaAccents.current
    return when (kind) {
        MediaKind.LIVE -> accents.live
        MediaKind.MOVIE -> accents.movie
        MediaKind.SERIES -> accents.series
    }
}

@Composable
fun containerFor(kind: MediaKind): Color {
    val accents = LocalNovaAccents.current
    return when (kind) {
        MediaKind.LIVE -> accents.liveContainer
        MediaKind.MOVIE -> accents.movieContainer
        MediaKind.SERIES -> accents.seriesContainer
    }
}

fun iconFor(kind: MediaKind): ImageVector = when (kind) {
    MediaKind.LIVE -> Icons.Rounded.LiveTv
    MediaKind.MOVIE -> Icons.Rounded.Movie
    MediaKind.SERIES -> Icons.Rounded.Tv
}

/**
 * Surface that reacts to both touch press and D-pad focus, so the same card works
 * on a phone and on Android TV.
 */
@Composable
fun FocusableSurface(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(16.dp),
    color: Color = MaterialTheme.colorScheme.surface,
    focusRingColor: Color = MaterialTheme.colorScheme.primary,
    content: @Composable () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.04f else if (pressed) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 520f),
        label = "focusScale"
    )

    Surface(
        onClick = onClick,
        modifier = modifier.scale(scale),
        shape = shape,
        color = color,
        interactionSource = interactionSource,
        tonalElevation = if (focused) 4.dp else 0.dp,
        shadowElevation = if (focused) 10.dp else 0.dp,
        border = if (focused) BorderStroke(2.dp, focusRingColor) else null,
        content = { content() }
    )
}

/** Circular heart toggle used on cards, rows and detail headers. */
@Composable
fun FavoriteHeart(
    isFavorite: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    size: Int = 36,
    onSurface: Boolean = false,
) {
    val strings = LocalStrings.current
    val scale by animateFloatAsState(
        targetValue = if (isFavorite) 1.1f else 1f,
        animationSpec = spring(dampingRatio = 0.45f, stiffness = 600f),
        label = "heartScale"
    )
    Surface(
        onClick = onToggle,
        modifier = modifier.size(size.dp),
        shape = RoundedCornerShape((size / 2).dp),
        color = when {
            isFavorite -> MaterialTheme.colorScheme.error.copy(alpha = 0.16f)
            onSurface -> MaterialTheme.colorScheme.surfaceVariant
            else -> Color.Black.copy(alpha = 0.42f)
        },
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                contentDescription = if (isFavorite) strings.removeFavorite else strings.addFavorite,
                tint = when {
                    isFavorite -> MaterialTheme.colorScheme.error
                    onSurface -> MaterialTheme.colorScheme.onSurfaceVariant
                    else -> Color.White
                },
                modifier = Modifier
                    .size((size * 0.52).dp)
                    .scale(scale),
            )
        }
    }
}

@Composable
fun PosterCard(
    entry: MediaEntry,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isFavorite: Boolean = false,
    onToggleFavorite: (() -> Unit)? = null,
) {
    Column(modifier = modifier) {
        Box {
            FocusableSurface(
                onClick = onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                PosterImage(entry = entry)
            }
            if (onToggleFavorite != null) {
                FavoriteHeart(
                    isFavorite = isFavorite,
                    onToggle = onToggleFavorite,
                    size = 32,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = entry.title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = entry.year?.toString() ?: entry.group,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun PosterImage(entry: MediaEntry, modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        if (entry.logoUrl.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(containerFor(entry.kind)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = iconFor(entry.kind),
                    contentDescription = null,
                    tint = accentFor(entry.kind),
                    modifier = Modifier.size(34.dp),
                )
            }
        } else {
            AsyncImage(
                model = entry.logoUrl,
                contentDescription = entry.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

@Composable
fun ContinueCard(
    title: String,
    subtitle: String,
    imageUrl: String?,
    fraction: Float,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.width(212.dp)) {
        FocusableSurface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Box(Modifier.fillMaxSize()) {
                if (imageUrl.isNullOrBlank()) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    listOf(
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                                        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.22f),
                                    )
                                )
                            )
                    )
                } else {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
                LinearProgressIndicator(
                    progress = { fraction },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = Color.White.copy(alpha = 0.35f),
                    drawStopIndicator = {},
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
    }
}

@Composable
fun PrivacyNote(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
) {
    val accents = LocalNovaAccents.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = accents.privacyContainer,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accents.privacy.copy(alpha = 0.22f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = accents.privacy,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = accents.privacy,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = title, style = MaterialTheme.typography.titleLarge)
        if (action != null && onAction != null) {
            Text(
                text = action,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    action: @Composable (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(32.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(20.dp))
            action()
        }
    }
}

@Composable
fun CategoryBadge(
    kind: MediaKind,
    modifier: Modifier = Modifier,
    size: Int = 52,
) {
    Box(
        modifier = modifier
            .size(size.dp)
            .clip(RoundedCornerShape((size / 3.4).dp))
            .background(accentFor(kind)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = iconFor(kind),
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size((size * 0.52).dp),
        )
    }
}
