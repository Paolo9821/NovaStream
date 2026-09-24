package com.rork.novastream.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.AddCircleOutline
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.LicenseStatus
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.ui.components.CategoryBadge
import com.rork.novastream.ui.components.ContinueCard
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.components.SectionHeader
import com.rork.novastream.ui.components.TvTextField
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
    val license by viewModel.license.collectAsStateWithLifecycle()
    val storeUrl by viewModel.storeUrl.collectAsStateWithLifecycle()
    val restoring by viewModel.catalogRestoring.collectAsStateWithLifecycle()
    val recovering by viewModel.catalogRecovering.collectAsStateWithLifecycle()
    /** Same full rebuild as in Settings, so it asks the same confirmation. */
    var rebuildDialogOpen by remember { mutableStateOf(false) }

    val active = remember(accounts, activeId) { accounts.firstOrNull { it.id == activeId } }
    val counts = remember(catalog, settings, unlocked) {
        MediaKind.entries.associateWith { viewModel.countOf(it) }
    }
    val favoriteEntries = remember(catalog, favorites, settings, unlocked) {
        viewModel.favoriteEntries()
    }
    // Finished titles stay in the history so a series can offer its next
    // episode, but this row is about what is still unwatched.
    val unfinished = remember(progress) { progress.filterNot { it.completed } }

    /** Open while the PIN is being typed to reveal the protected categories. */
    var parentalPinOpen by remember { mutableStateOf(false) }

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
            GreetingHeader(
                greeting = greeting(strings),
                playlistLabel = active?.let { strings.playlistPrefix.format(it.name) }
                    ?: strings.noActivePlaylist,
                connected = active != null,
            )
        }

        (license.status as? LicenseStatus.Trial)?.let { trial ->
            item("trial") {
                // Same rule as Settings: a link on a phone, a QR code on a TV.
                StorePurchase(
                    storeUrl = storeUrl,
                    deviceId = license.identity.deviceId,
                ) { onBuy ->
                    TrialBanner(
                        trial = trial,
                        language = settings.language,
                        onActivate = onBuy,
                    )
                }
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
                val count = counts[kind] ?: 0
                CategoryCard(
                    kind = kind,
                    count = count,
                    // An empty row while the saved list is still opening would
                    // read as "you have nothing": it waits instead.
                    loading = count == 0 && (restoring || recovering),
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
                        // No heart here on purpose: on this row every card is
                        // already a favourite, and the small button kept
                        // stealing taps meant to open the title. Removing one
                        // is done from the title's own page.
                        PosterCard(
                            entry = entry,
                            onClick = { onOpenDetail(entry.id) },
                            modifier = Modifier.width(118.dp),
                        )
                    }
                }
            }
        }

        if (unfinished.isNotEmpty()) {
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
                    items(unfinished, key = { it.entryId }) { item ->
                        ContinueCard(
                            title = item.title,
                            subtitle = when {
                                item.hasEpisode -> "S${item.season}E${item.episodeNumber} · " +
                                    if (item.remainingMinutes <= 0L) strings.almostDone
                                    else strings.minutesRemaining.format(item.remainingMinutes)
                                item.remainingMinutes <= 0L -> strings.almostDone
                                else -> strings.minutesRemaining.format(item.remainingMinutes)
                            },
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
                    blockedCount = viewModel.blockedCount(),
                    strings = strings,
                    onLock = { viewModel.lockParental() },
                    onUnlock = { parentalPinOpen = true },
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
                // Throws away every saved channel, film and series and imports
                // the provider list from scratch, exactly like "Erase and
                // download again" in Settings, so new channels always show up.
                OutlinedButton(
                    onClick = { rebuildDialogOpen = true },
                    enabled = syncState !is SyncState.Running,
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

    if (rebuildDialogOpen) {
        AlertDialog(
            onDismissRequest = { rebuildDialogOpen = false },
            title = { Text(strings.catalogRebuildTitle) },
            text = { Text(strings.catalogRebuildBody) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.rebuildCatalog()
                    rebuildDialogOpen = false
                }) { Text(strings.catalogRebuildConfirm) }
            },
            dismissButton = {
                TextButton(onClick = { rebuildDialogOpen = false }) { Text(strings.cancel) }
            },
        )
    }

    if (parentalPinOpen) {
        ParentalUnlockDialog(
            strings = strings,
            onDismiss = { parentalPinOpen = false },
            onSubmit = { pin -> viewModel.unlockParental(pin) },
        )
    }
}

/**
 * Asks for the PIN before the protected categories come back into view. A wrong
 * code says so and keeps the dialog open, so nobody is left wondering whether
 * the lock is broken.
 */
@Composable
private fun ParentalUnlockDialog(
    strings: Strings,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Boolean,
) {
    var pin by remember { mutableStateOf("") }
    var wrong by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.parentalPinTitle) },
        text = {
            Column {
                TvTextField(
                    value = pin,
                    onValueChange = { value ->
                        if (value.length <= 6 && value.all { it.isDigit() }) {
                            pin = value
                            wrong = false
                        }
                    },
                    label = { Text(strings.parentalPinLabel) },
                    singleLine = true,
                    isError = wrong,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = if (wrong) strings.parentalPinWrong else strings.parentalUnlockHint,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (wrong) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (onSubmit(pin)) onDismiss() else wrong = true },
                enabled = pin.length >= 4,
            ) { Text(strings.parentalUnlockAction) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    )
}

/**
 * The masthead of the app: a colour wash that names the time of day and the
 * playlist on air. It is the one place where NovaStream is allowed to shout,
 * and it gives the rest of the screen something to sit under.
 */
@Composable
private fun GreetingHeader(
    greeting: String,
    playlistLabel: String,
    connected: Boolean,
    modifier: Modifier = Modifier,
) {
    val accents = LocalNovaAccents.current
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        accents.movie.copy(alpha = 0.34f),
                        accents.series.copy(alpha = 0.26f),
                        accents.warm.copy(alpha = 0.22f),
                    )
                )
            )
            .padding(horizontal = 18.dp, vertical = 20.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(if (connected) accents.live else accents.warm)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "NovaStream",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.72f),
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = greeting,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(12.dp))
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.78f),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlaylistPlay,
                        contentDescription = null,
                        tint = if (connected) accents.live else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = playlistLabel,
                        style = MaterialTheme.typography.titleSmall,
                        color = if (connected) accents.live
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/**
 * Each section gets its own colour rather than a row of identical grey cards:
 * live is green, films are blue, series are violet, and the tint carries
 * through the whole app so a glance is enough to know where you are.
 */
@Composable
private fun CategoryCard(
    kind: MediaKind,
    count: Int,
    loading: Boolean,
    strings: Strings,
    onClick: () -> Unit,
) {
    val accent = accentFor(kind)
    FocusableSurface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        focusRingColor = accent,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(accent.copy(alpha = 0.22f), Color.Transparent),
                    )
                )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CategoryBadge(kind = kind)
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = when (kind) {
                            MediaKind.LIVE -> strings.liveTvTitle
                            MediaKind.MOVIE -> strings.moviesTitle
                            MediaKind.SERIES -> strings.seriesTitle
                        },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (loading) {
                        Text(
                            text = strings.catalogUpdating,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            text = "${formatCount(count)} ${unitOf(kind, strings)}",
                            style = MaterialTheme.typography.titleSmall,
                            color = accent,
                        )
                    }
                }
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = accent,
                    )
                    Spacer(Modifier.width(6.dp))
                }
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(accent.copy(alpha = 0.18f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
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
    onUnlock: () -> Unit,
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
                // Typing the PIN reveals the protected categories for this
                // session; changing what is protected still lives in Settings.
                OutlinedButton(onClick = onUnlock) { Text(strings.parentalUnlockAction) }
                Spacer(Modifier.width(8.dp))
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
