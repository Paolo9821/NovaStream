package com.rork.novastream.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.AddCircleOutline
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.ui.components.CategoryBadge
import com.rork.novastream.ui.components.ContinueCard
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.components.SectionHeader
import com.rork.novastream.ui.components.accentFor
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.Strings
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import java.util.Calendar

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    contentPadding: PaddingValues,
    onOpenCategory: (MediaKind) -> Unit,
    onOpenAccounts: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenDetail: (String) -> Unit,
    onResume: (String, String) -> Unit,
) {
    val strings = LocalStrings.current
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val activeId by viewModel.activeAccountId.collectAsStateWithLifecycle()
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val syncState by viewModel.syncState.collectAsStateWithLifecycle()
    val progress by viewModel.progress.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()

    val active = remember(accounts, activeId) { accounts.firstOrNull { it.id == activeId } }
    val counts = remember(catalog, settings, unlocked) {
        MediaKind.entries.associateWith { viewModel.countOf(it) }
    }
    val favoriteEntries = remember(catalog, favorites, settings, unlocked) {
        viewModel.favoriteEntries()
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = contentPadding.calculateBottomPadding() + 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item("greeting") {
            Column {
                Text(text = greeting(strings), style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(10.dp))
                PlaylistStatusChip(
                    playlistLabel = active?.let { strings.playlistPrefix.format(it.name) }
                        ?: strings.noActivePlaylist,
                    encryption = "${strings.encryptedLocally} · ${viewModel.encryptionLabel}",
                )
            }
        }

        item("sync") {
            AnimatedVisibility(visible = syncState is SyncState.Running || syncState is SyncState.Failed) {
                SyncBanner(
                    syncState = syncState,
                    onRetry = { viewModel.refresh() },
                    onDismiss = { viewModel.clearSyncState() },
                )
            }
        }

        if (accounts.isEmpty()) {
            item("empty") {
                EmptyState(
                    icon = Icons.Rounded.PlaylistAdd,
                    title = strings.noPlaylistTitle,
                    body = strings.noPlaylistBody,
                    action = {
                        Button(onClick = onOpenAccounts) {
                            Icon(Icons.Rounded.AddCircleOutline, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(strings.addPlaylistAction)
                        }
                    },
                )
            }
        } else {
            items(MediaKind.entries.toList(), key = { it.name }) { kind ->
                CategoryCard(
                    kind = kind,
                    count = counts[kind] ?: 0,
                    strings = strings,
                    onClick = { onOpenCategory(kind) },
                )
            }
        }

        if (favoriteEntries.isNotEmpty()) {
            item("favorites-header") {
                SectionHeader(
                    title = strings.favorites,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            item("favorites-row") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(favoriteEntries, key = { it.id }) { entry ->
                        PosterCard(
                            entry = entry,
                            onClick = { onOpenDetail(entry.id) },
                            modifier = Modifier.width(118.dp),
                            isFavorite = true,
                            onToggleFavorite = { viewModel.toggleFavorite(entry.id) },
                        )
                    }
                }
            }
        }

        if (progress.isNotEmpty()) {
            item("continue-header") {
                SectionHeader(
                    title = strings.continueWatching,
                    action = strings.clear,
                    onAction = { viewModel.clearProgress() },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            item("continue-row") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(progress, key = { it.entryId }) { item ->
                        ContinueCard(
                            title = item.title,
                            subtitle = if (item.remainingMinutes <= 0L) strings.almostDone
                            else strings.minutesRemaining.format(item.remainingMinutes),
                            imageUrl = item.imageUrl,
                            fraction = item.fraction,
                            onClick = { onResume(item.entryId, item.streamUrl) },
                        )
                    }
                }
            }
        }

        if (settings.parentalEnabled) {
            item("parental") {
                ParentalRow(
                    unlocked = unlocked,
                    blockedCount = settings.blockedGroups.size,
                    strings = strings,
                    onLock = { viewModel.lockParental() },
                    onOpenSettings = onOpenSettings,
                )
            }
        }

        item("actions") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                FilledTonalButton(
                    onClick = onOpenAccounts,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(vertical = 16.dp),
                ) {
                    Icon(Icons.Rounded.Person, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(strings.accountButton)
                }
                OutlinedButton(
                    onClick = onOpenSettings,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(vertical = 16.dp),
                ) {
                    Icon(Icons.Rounded.Settings, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(strings.settingsButton)
                }
            }
        }

        if (active != null) {
            item("refresh") {
                OutlinedButton(
                    onClick = { viewModel.refresh() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                    ),
                ) {
                    Icon(Icons.Rounded.Refresh, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(strings.refreshFromProvider)
                }
            }
        }
    }
}

@Composable
private fun PlaylistStatusChip(playlistLabel: String, encryption: String) {
    val accents = LocalNovaAccents.current
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = accents.privacyContainer,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.Lock,
                contentDescription = null,
                tint = accents.privacy,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Column {
                Text(
                    text = playlistLabel,
                    style = MaterialTheme.typography.titleSmall,
                    color = accents.privacy,
                )
                Text(
                    text = encryption,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun CategoryCard(
    kind: MediaKind,
    count: Int,
    strings: Strings,
    onClick: () -> Unit,
) {
    FocusableSurface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        focusRingColor = accentFor(kind),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CategoryBadge(kind = kind)
            Spacer(Modifier.width(16.dp))
            Text(
                text = when (kind) {
                    MediaKind.LIVE -> strings.liveTvTitle
                    MediaKind.MOVIE -> strings.moviesTitle
                    MediaKind.SERIES -> strings.seriesTitle
                },
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "${formatCount(count)} ${unitOf(kind, strings)}",
                style = MaterialTheme.typography.titleSmall,
                color = accentFor(kind),
            )
            Spacer(Modifier.width(6.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SyncBanner(syncState: SyncState, onRetry: () -> Unit, onDismiss: () -> Unit) {
    val strings = LocalStrings.current
    val failed = syncState as? SyncState.Failed
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (failed != null) MaterialTheme.colorScheme.errorContainer
        else MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (failed == null) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Spacer(Modifier.width(12.dp))
                }
                Text(
                    text = when (syncState) {
                        is SyncState.Running -> syncState.message
                        is SyncState.Failed -> syncState.message
                        else -> ""
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (failed != null) MaterialTheme.colorScheme.onErrorContainer
                    else MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.weight(1f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (failed == null) {
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.primary,
                )
            } else {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onRetry) { Text(strings.retry) }
                    OutlinedButton(onClick = onDismiss) { Text(strings.close) }
                }
            }
        }
    }
}

@Composable
private fun ParentalRow(
    unlocked: Boolean,
    blockedCount: Int,
    strings: Strings,
    onLock: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = if (unlocked) Icons.Rounded.LockOpen else Icons.Rounded.Lock,
                contentDescription = null,
                tint = if (unlocked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = if (unlocked) strings.parentalUnlockedTitle else strings.parentalActiveTitle,
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    text = strings.parentalGroupsProtected.format(blockedCount),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (unlocked) {
                OutlinedButton(onClick = onLock) { Text(strings.lock) }
            } else {
                OutlinedButton(onClick = onOpenSettings) { Text(strings.manage) }
            }
        }
    }
}

internal fun formatCount(count: Int): String = "%,d".format(count).replace(',', '.')

internal fun unitOf(kind: MediaKind, strings: Strings): String = when (kind) {
    MediaKind.LIVE -> strings.unitChannels
    MediaKind.MOVIE -> strings.unitTitles
    MediaKind.SERIES -> strings.unitSeries
}

private fun greeting(strings: Strings): String {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 5..12 -> strings.greetingMorning
        in 13..17 -> strings.greetingAfternoon
        else -> strings.greetingEvening
    }
}
