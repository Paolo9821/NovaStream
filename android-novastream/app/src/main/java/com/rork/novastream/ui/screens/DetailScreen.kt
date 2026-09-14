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
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaDetails
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.Programme
import com.rork.novastream.ui.components.FavoriteHeart
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.contentFocusZone
import com.rork.novastream.ui.components.dpadDownTo
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame
import com.rork.novastream.ui.components.accentFor
import com.rork.novastream.ui.components.containerFor
import com.rork.novastream.ui.components.iconFor
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.Strings
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    viewModel: AppViewModel,
    entryId: String,
    onBack: () -> Unit,
    onPlay: (String, String) -> Unit,
    onOpenRelated: (String) -> Unit,
) {
    val strings = LocalStrings.current
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val episodes by viewModel.episodes.collectAsStateWithLifecycle()
    val episodesLoading by viewModel.episodesLoading.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val epg by viewModel.epg.collectAsStateWithLifecycle()
    val history by viewModel.progress.collectAsStateWithLifecycle()
    val details by viewModel.details.collectAsStateWithLifecycle()
    val detailsLoading by viewModel.detailsLoading.collectAsStateWithLifecycle()

    val entry = remember(catalog, entryId) { viewModel.entryById(entryId) }
    val related = remember(catalog, entryId) { entry?.let { viewModel.related(it) }.orEmpty() }
    val now = remember(entryId) { System.currentTimeMillis() }
    val programmes = remember(entryId, epg) {
        entry?.takeIf { it.kind == MediaKind.LIVE }
            ?.let { viewModel.upcomingProgrammes(it, now).take(8) }
            .orEmpty()
    }

    LaunchedEffect(entryId) {
        entry?.let {
            if (it.kind == MediaKind.SERIES) viewModel.loadEpisodes(it)
            // Listings carry only a title and a poster: the plot, the genres and
            // the cast live behind the provider's detail endpoint.
            viewModel.loadDetails(it)
        }
    }

    /** Only the description of the title on screen, never a leftover one. */
    val entryDetails = details?.takeIf { it.entryId == entryId }

    // Providers hand over every episode of every season in one flat list. Split
    // it by season so a long-running series is not an endless scroll.
    val seasons = remember(episodes) { episodes.map { it.season }.distinct().sorted() }

    /** The episode this series should carry on from, if it was ever started. */
    val resumeEpisode = remember(episodes, history, entryId) {
        viewModel.resumeEpisode(entryId, episodes)
    }
    /** Where a film was left, so its button offers to carry on instead of restarting. */
    val movieResumeMs = remember(history, entryId) {
        if (entry?.kind == MediaKind.MOVIE) viewModel.resumePositionFor(entryId, entry.streamUrl)
        else 0L
    }

    var chosenSeason by remember(entryId) { mutableStateOf<Int?>(null) }
    // Until a season is picked by hand, the page opens on the one being watched.
    val activeSeason = chosenSeason?.takeIf { seasons.contains(it) }
        ?: resumeEpisode?.season?.takeIf { seasons.contains(it) }
        ?: seasons.firstOrNull()
    val seasonEpisodes = remember(episodes, activeSeason) {
        if (activeSeason == null) episodes else episodes.filter { it.season == activeSeason }
    }

    val contentFocus = rememberFocusRequester()
    // Waits for the entry, otherwise the body is still the "unavailable" box.
    RequestInitialFocus(contentFocus, key = entry?.id)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (entry?.kind) {
                            MediaKind.LIVE -> strings.detailChannelTitle
                            MediaKind.SERIES -> strings.detailSeriesTitle
                            else -> strings.detailMovieTitle
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.dpadDownTo(contentFocus)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = strings.back)
                    }
                },
                actions = {
                    if (entry != null) {
                        FavoriteHeart(
                            isFavorite = favorites.contains(entry.id),
                            onToggle = { viewModel.toggleFavorite(entry.id) },
                            onSurface = true,
                            modifier = Modifier.padding(end = 10.dp),
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        if (entry == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Text(strings.contentUnavailable, style = MaterialTheme.typography.bodyLarge)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .contentFocusZone(contentFocus),
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 32.dp,
            ),
        ) {
            item("cover") {
                CoverImage(entry, backdropUrl = entryDetails?.backdropUrl)
            }

            item("meta") {
                val genres = remember(entry.genres, entryDetails) {
                    (entryDetails?.genres.orEmpty() + entry.genres).distinct()
                }
                val plot = entryDetails?.plot?.takeIf { it.isNotBlank() } ?: entry.plot

                Column(Modifier.padding(horizontal = 20.dp)) {
                    Spacer(Modifier.height(18.dp))
                    Text(text = entry.title, style = MaterialTheme.typography.headlineMedium)
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        entryDetails?.rating?.let { rating ->
                            Icon(
                                imageVector = Icons.Rounded.Star,
                                contentDescription = null,
                                tint = LocalNovaAccents.current.privacy,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = rating,
                                style = MaterialTheme.typography.titleSmall,
                                color = LocalNovaAccents.current.privacy,
                            )
                            Spacer(Modifier.width(10.dp))
                        }
                        Text(
                            text = listOfNotNull(
                                entry.year?.toString(),
                                entryDetails?.durationLabel,
                                entry.quality,
                                entry.group,
                            ).joinToString("  •  "),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (genres.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(genres.take(6), key = { it }) { genre ->
                                AssistChip(
                                    onClick = {},
                                    label = { Text(genre) },
                                    colors = AssistChipDefaults.assistChipColors(
                                        containerColor = containerFor(entry.kind),
                                        labelColor = accentFor(entry.kind),
                                    ),
                                    border = null,
                                )
                            }
                        }
                    }

                    // The whole reason someone opens a film page: what is it about.
                    if (!plot.isNullOrBlank()) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = strings.plotTitle,
                            style = MaterialTheme.typography.titleSmall,
                            color = accentFor(entry.kind),
                        )
                        Spacer(Modifier.height(6.dp))
                        ExpandablePlot(text = plot, strings = strings)
                    } else if (detailsLoading && entry.kind != MediaKind.LIVE) {
                        Spacer(Modifier.height(16.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(15.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = strings.loadingDetails,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else if (entry.kind != MediaKind.LIVE) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = strings.noPlotAvailable,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    entryDetails?.let { info -> CreditsBlock(details = info, strings = strings) }
                }
            }

            if (entry.kind != MediaKind.SERIES) {
                item("play") {
                    Button(
                        onClick = { onPlay(entry.id, entry.streamUrl) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp)
                            .tvFocusFrame(cornerRadius = 22.dp),
                        contentPadding = PaddingValues(vertical = 16.dp),
                    ) {
                        Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                        Spacer(Modifier.width(10.dp))
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = when {
                                    entry.kind == MediaKind.LIVE -> strings.watchNow
                                    movieResumeMs > 0L -> strings.resumeAction
                                    else -> strings.playNow
                                },
                                style = MaterialTheme.typography.titleMedium,
                            )
                            // Films say out loud where they will pick up, so the
                            // button is never a gamble between resume and restart.
                            if (movieResumeMs > 0L) {
                                Text(
                                    text = strings.playerResumedFrom.format(
                                        formatClock(movieResumeMs)
                                    ),
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            }
                        }
                    }
                }
            }

            if (entry.kind == MediaKind.LIVE) {
                item("guide-header") {
                    Text(
                        text = strings.guide,
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 10.dp),
                    )
                }
                if (programmes.isEmpty()) {
                    item("guide-empty") {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            Text(
                                text = strings.noProgrammeInfo,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = strings.epgMissingHint,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                } else {
                    items(programmes, key = { "${it.startEpochMs}_${it.title}" }) { programme ->
                        GuideRow(
                            programme = programme,
                            nowMs = now,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                        )
                    }
                }
            }

            if (entry.kind == MediaKind.SERIES) {
                item("episodes-header") {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        Spacer(Modifier.height(20.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = strings.episodes,
                                style = MaterialTheme.typography.titleLarge,
                                modifier = Modifier.weight(1f),
                            )
                            if (seasonEpisodes.isNotEmpty()) {
                                Text(
                                    text = strings.episodesInSeason.format(seasonEpisodes.size),
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                    }
                }

                // The whole point of a series page for someone mid-binge: one
                // button that goes straight to the right episode.
                if (resumeEpisode != null) {
                    item("resume") {
                        ResumeEpisodeButton(
                            label = strings.resumeAction,
                            episodeLabel = "S${resumeEpisode.season}E${resumeEpisode.number}" +
                                " · ${resumeEpisode.title}",
                            hint = strings.resumeSeriesHint,
                            onClick = { onPlay(entry.id, resumeEpisode.streamUrl) },
                        )
                    }
                }

                if (seasons.size > 1) {
                    item("seasons") {
                        SeasonPicker(
                            seasons = seasons,
                            selected = activeSeason,
                            strings = strings,
                            onSelect = { season -> chosenSeason = season },
                        )
                    }
                }
                if (episodesLoading) {
                    item("episodes-loading") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(12.dp))
                            Text(strings.loadingEpisodes)
                        }
                    }
                } else if (episodes.isEmpty()) {
                    item("episodes-empty") {
                        Text(
                            text = strings.noEpisodes,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                        )
                    }
                } else {
                    items(seasonEpisodes, key = { it.id }) { episode ->
                        EpisodeRow(
                            episode = episode,
                            onClick = { onPlay(entry.id, episode.streamUrl) },
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 5.dp),
                        )
                    }
                }
            }

            if (related.isNotEmpty()) {
                item("related-header") {
                    Text(
                        text = strings.sameCategory,
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 12.dp),
                    )
                }
                item("related-row") {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        items(related, key = { it.id }) { item ->
                            PosterCard(
                                entry = item,
                                onClick = { onOpenRelated(item.id) },
                                modifier = Modifier.width(124.dp),
                                isFavorite = favorites.contains(item.id),
                                onToggleFavorite = { viewModel.toggleFavorite(item.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Big, unmissable way back into a series: names the exact episode it will play
 * so nobody has to remember where they stopped.
 */
@Composable
private fun ResumeEpisodeButton(
    label: String,
    episodeLabel: String,
    hint: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 16.dp)
            .tvFocusFrame(cornerRadius = 22.dp),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
    ) {
        Icon(Icons.Rounded.PlayArrow, contentDescription = null)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(text = label, style = MaterialTheme.typography.titleMedium)
            Text(
                text = episodeLabel,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = hint,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.72f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Formats a saved position as `m:ss` or `h:mm:ss` for the resume label. */
private fun formatClock(ms: Long): String {
    val totalSeconds = ms.coerceAtLeast(0L) / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.US, "%d:%02d", minutes, seconds)
    }
}

/**
 * Row of season buttons. It scrolls sideways so a series with thirty seasons
 * behaves like one with two, and the season being browsed stays highlighted.
 */
@Composable
private fun SeasonPicker(
    seasons: List<Int>,
    selected: Int?,
    strings: Strings,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = strings.seasonPickerTitle,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 20.dp, bottom = 8.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(seasons, key = { it }) { season ->
                val isSelected = season == selected
                FilterChip(
                    selected = isSelected,
                    onClick = { onSelect(season) },
                    label = {
                        Text(
                            // Specials and unnumbered extras land in season 0.
                            text = if (season <= 0) strings.seasonOther
                            else strings.seasonChip.format(season),
                            style = MaterialTheme.typography.titleSmall,
                        )
                    },
                    leadingIcon = if (isSelected) {
                        {
                            Icon(
                                imageVector = Icons.Rounded.Check,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                        selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier.tvFocusFrame(cornerRadius = 20.dp),
                )
            }
        }
        Spacer(Modifier.height(14.dp))
    }
}

/**
 * Plot text that opens up on demand. Providers ship synopses of very different
 * lengths, so a long one is cut to four lines with a "read more" rather than
 * pushing the play button off the screen.
 */
@Composable
private fun ExpandablePlot(text: String, strings: Strings, modifier: Modifier = Modifier) {
    var expanded by remember(text) { mutableStateOf(false) }
    var overflows by remember(text) { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = if (expanded) Int.MAX_VALUE else 4,
            overflow = TextOverflow.Ellipsis,
            onTextLayout = { result -> if (!expanded) overflows = result.hasVisualOverflow },
        )
        if (overflows) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (expanded) strings.readLess else strings.readMore,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { expanded = !expanded }
                    .tvFocusFrame(cornerRadius = 8.dp)
                    .padding(vertical = 4.dp, horizontal = 2.dp),
            )
        }
    }
}

/** Cast, director and origin, shown only for the fields the provider filled in. */
@Composable
private fun CreditsBlock(details: MediaDetails, strings: Strings, modifier: Modifier = Modifier) {
    val rows = listOfNotNull(
        details.cast.takeIf { it.isNotEmpty() }?.let { strings.castLabel to it.joinToString(", ") },
        details.director?.takeIf { it.isNotBlank() }?.let { strings.directorLabel to it },
        details.releaseDate?.takeIf { it.isNotBlank() }?.let { strings.releaseLabel to it },
        details.country?.takeIf { it.isNotBlank() }?.let { strings.countryLabel to it },
    )
    if (rows.isEmpty()) return

    Column(modifier = modifier) {
        Spacer(Modifier.height(16.dp))
        rows.forEach { (label, value) ->
            Row(modifier = Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.Top) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(96.dp),
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun CoverImage(entry: MediaEntry, backdropUrl: String? = null) {
    val artwork = backdropUrl?.takeIf { it.isNotBlank() } ?: entry.logoUrl
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .background(containerFor(entry.kind)),
        contentAlignment = Alignment.Center,
    ) {
        if (artwork.isNullOrBlank()) {
            Icon(
                imageVector = iconFor(entry.kind),
                contentDescription = null,
                tint = accentFor(entry.kind),
                modifier = Modifier.size(56.dp),
            )
        } else {
            AsyncImage(
                model = artwork,
                contentDescription = entry.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.55f to Color.Transparent,
                        1f to MaterialTheme.colorScheme.background,
                    )
                )
        )
    }
}

@Composable
private fun GuideRow(programme: Programme, nowMs: Long, modifier: Modifier = Modifier) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current
    val onAir = programme.isOnAir(nowMs)

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = if (onAir) accents.liveContainer else MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                text = clockLabel(programme.startEpochMs),
                style = MaterialTheme.typography.titleSmall,
                color = if (onAir) accents.live else MaterialTheme.colorScheme.onSurfaceVariant,
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
                        color = accents.live,
                    )
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { programme.progressAt(nowMs) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp),
                        color = accents.live,
                        drawStopIndicator = {},
                    )
                }
            }
        }
    }
}

@Composable
private fun EpisodeRow(episode: Episode, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val strings = LocalStrings.current
    FocusableSurface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Text(
                    text = "S${episode.season}E${episode.number}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = episode.title,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Icon(
                imageVector = Icons.Rounded.PlayArrow,
                contentDescription = strings.playEpisode,
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
