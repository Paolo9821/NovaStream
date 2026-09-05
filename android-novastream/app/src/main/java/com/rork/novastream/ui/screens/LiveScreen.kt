package com.rork.novastream.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.Programme
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.FavoriteHeart
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveScreen(
    viewModel: AppViewModel,
    contentPadding: PaddingValues,
    onOpenDetail: (String) -> Unit,
) {
    val strings = LocalStrings.current
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val query by viewModel.liveQuery.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val epg by viewModel.epg.collectAsStateWithLifecycle()

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            now = System.currentTimeMillis()
        }
    }

    var guideEntryId by remember { mutableStateOf<String?>(null) }
    var groupSheetOpen by remember { mutableStateOf(false) }

    val total = remember(catalog, settings, unlocked) { viewModel.countOf(MediaKind.LIVE) }
    val entries = remember(catalog, query, settings, unlocked, favorites) {
        viewModel.filteredEntries(MediaKind.LIVE, query)
    }
    val groups = remember(catalog, settings, unlocked) {
        viewModel.visibleEntries(MediaKind.LIVE).map { it.group }.distinct().sorted()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding())
    ) {
        SearchRow(
            value = query.search,
            placeholder = strings.searchIn.format(formatCount(total), strings.unitChannels),
            filterActive = query.group != null,
            filterDescription = strings.filterByCategory,
            onValueChange = { viewModel.applyQuery(MediaKind.LIVE, query.copy(search = it)) },
            // The filter button opens the provider's channel groups, the same as
            // on the film and series pages. Favourites stay one chip away below.
            onFilterClick = { groupSheetOpen = true },
        )

        if (groups.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item("favorites") {
                    GroupChip(
                        label = strings.onlyFavorites,
                        selected = query.favoritesOnly,
                        onClick = {
                            viewModel.applyQuery(
                                MediaKind.LIVE,
                                query.copy(favoritesOnly = !query.favoritesOnly)
                            )
                        },
                    )
                }
                item("all") {
                    GroupChip(
                        label = strings.allChannels,
                        selected = query.group == null && !query.favoritesOnly,
                        onClick = {
                            viewModel.applyQuery(
                                MediaKind.LIVE,
                                query.copy(group = null, favoritesOnly = false)
                            )
                        },
                    )
                }
                items(groups, key = { it }) { group ->
                    GroupChip(
                        label = group,
                        selected = query.group == group,
                        onClick = {
                            viewModel.applyQuery(
                                MediaKind.LIVE,
                                query.copy(group = if (query.group == group) null else group)
                            )
                        },
                    )
                }
            }
        }

        if (entries.isEmpty()) {
            EmptyState(
                icon = Icons.Rounded.LiveTv,
                title = if (total == 0) strings.noChannelsTitle else strings.noChannelsFoundTitle,
                body = if (total == 0) strings.noChannelsBody else strings.noChannelsFoundBody,
            )
        } else {
            LazyColumn(
                contentPadding = PaddingValues(
                    start = 20.dp,
                    end = 20.dp,
                    top = 8.dp,
                    bottom = contentPadding.calculateBottomPadding() + 24.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(entries, key = { it.id }) { entry ->
                    ChannelRow(
                        entry = entry,
                        current = if (epg.isEmpty) null else viewModel.currentProgramme(entry, now),
                        nowMs = now,
                        isFavorite = favorites.contains(entry.id),
                        onToggleFavorite = { viewModel.toggleFavorite(entry.id) },
                        onOpenGuide = { guideEntryId = entry.id },
                        onClick = { onOpenDetail(entry.id) },
                    )
                }
            }
        }
    }

    if (groupSheetOpen) {
        CategorySheet(
            title = strings.providerCategories,
            allLabel = strings.allChannels,
            groups = groups,
            selectedGroup = query.group,
            onSelect = { group ->
                viewModel.applyQuery(
                    MediaKind.LIVE,
                    query.copy(group = group, favoritesOnly = false),
                )
                groupSheetOpen = false
            },
            onDismiss = { groupSheetOpen = false },
        )
    }

    val guideEntry = guideEntryId?.let { viewModel.entryById(it) }
    if (guideEntry != null) {
        ModalBottomSheet(onDismissRequest = { guideEntryId = null }) {
            val programmes = viewModel.upcomingProgrammes(guideEntry, now)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
            ) {
                Text(guideEntry.title, style = MaterialTheme.typography.titleLarge)
                Text(
                    text = strings.todaySchedule,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))

                if (programmes.isEmpty()) {
                    Text(
                        text = strings.noProgrammeInfo,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = strings.epgMissingHint,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.height(420.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(programmes, key = { "${it.startEpochMs}_${it.title}" }) { programme ->
                            ProgrammeRow(programme = programme, nowMs = now)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelRow(
    entry: MediaEntry,
    current: Programme?,
    nowMs: Long,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onOpenGuide: () -> Unit,
    onClick: () -> Unit,
) {
    val accents = LocalNovaAccents.current
    val strings = LocalStrings.current

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(
                modifier = Modifier.padding(start = 12.dp, end = 8.dp, top = 12.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FocusableSurface(
                    onClick = onClick,
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.surface,
                    focusRingColor = accents.live,
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(accents.liveContainer),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (entry.logoUrl.isNullOrBlank()) {
                                Icon(
                                    imageVector = Icons.Rounded.LiveTv,
                                    contentDescription = null,
                                    tint = accents.live,
                                )
                            } else {
                                AsyncImage(
                                    model = entry.logoUrl,
                                    contentDescription = entry.title,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Fit,
                                )
                            }
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                text = entry.title,
                                style = MaterialTheme.typography.titleSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = entry.group,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(accents.liveContainer),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = strings.watchNow,
                                tint = accents.live,
                                modifier = Modifier.size(22.dp),
                            )
                        }
                    }
                }
                Spacer(Modifier.width(6.dp))
                FavoriteHeart(
                    isFavorite = isFavorite,
                    onToggle = onToggleFavorite,
                    onSurface = true,
                )
            }

            NowPlayingStrip(
                programme = current,
                nowMs = nowMs,
                onOpenGuide = onOpenGuide,
                modifier = Modifier.padding(start = 16.dp, end = 12.dp, bottom = 12.dp),
            )
        }
    }
}

@Composable
private fun NowPlayingStrip(
    programme: Programme?,
    nowMs: Long,
    onOpenGuide: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            if (programme == null) {
                Text(
                    text = strings.noProgrammeInfo,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(accents.live)
                    )
                    Spacer(Modifier.width(7.dp))
                    Text(
                        text = "${clockLabel(programme.startEpochMs)} ${programme.title}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { programme.progressAt(nowMs) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp),
                    color = accents.live,
                    trackColor = accents.liveContainer,
                    drawStopIndicator = {},
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Surface(
            onClick = onOpenGuide,
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Rounded.CalendarMonth,
                    contentDescription = null,
                    modifier = Modifier.size(15.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = strings.guide,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ProgrammeRow(programme: Programme, nowMs: Long) {
    val strings = LocalStrings.current
    val onAir = programme.isOnAir(nowMs)
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = if (onAir) MaterialTheme.colorScheme.secondaryContainer
        else MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                text = clockLabel(programme.startEpochMs),
                style = MaterialTheme.typography.titleSmall,
                color = if (onAir) MaterialTheme.colorScheme.onSecondaryContainer
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = programme.title,
                    style = MaterialTheme.typography.bodyLarge,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (onAir) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = strings.onAirNow,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { programme.progressAt(nowMs) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp),
                        drawStopIndicator = {},
                    )
                }
                if (!programme.description.isNullOrBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = programme.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = clockLabel(programme.stopEpochMs),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun GroupChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        shape = RoundedCornerShape(12.dp),
        colors = FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surface,
            selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onSecondaryContainer,
        ),
    )
}

private val clockFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

internal fun clockLabel(epochMs: Long): String = synchronized(clockFormat) {
    clockFormat.format(Date(epochMs))
}
