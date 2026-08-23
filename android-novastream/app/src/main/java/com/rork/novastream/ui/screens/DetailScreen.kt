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
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.components.accentFor
import com.rork.novastream.ui.components.containerFor
import com.rork.novastream.ui.components.iconFor
import com.rork.novastream.ui.vm.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    viewModel: AppViewModel,
    entryId: String,
    onBack: () -> Unit,
    onPlay: (String, String) -> Unit,
    onOpenRelated: (String) -> Unit,
) {
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val episodes by viewModel.episodes.collectAsStateWithLifecycle()
    val episodesLoading by viewModel.episodesLoading.collectAsStateWithLifecycle()

    val entry = remember(catalog, entryId) { viewModel.entryById(entryId) }
    val related = remember(catalog, entryId) { entry?.let { viewModel.related(it) }.orEmpty() }

    LaunchedEffect(entryId) {
        entry?.let { if (it.kind == MediaKind.SERIES) viewModel.loadEpisodes(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(titleFor(entry?.kind)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Indietro")
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
                Text("Contenuto non disponibile", style = MaterialTheme.typography.bodyLarge)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding() + 32.dp,
            ),
        ) {
            item("cover") { CoverImage(entry) }

            item("meta") {
                Column(Modifier.padding(horizontal = 20.dp)) {
                    Spacer(Modifier.height(18.dp))
                    Text(text = entry.title, style = MaterialTheme.typography.headlineMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = listOfNotNull(
                            entry.year?.toString(),
                            entry.quality,
                            entry.group,
                        ).joinToString("  •  "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (entry.genres.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            entry.genres.take(3).forEach { genre ->
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
                    if (!entry.plot.isNullOrBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = entry.plot,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (entry.kind != MediaKind.SERIES) {
                item("play") {
                    Button(
                        onClick = { onPlay(entry.id, entry.streamUrl) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 20.dp),
                        contentPadding = PaddingValues(vertical = 16.dp),
                    ) {
                        Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = if (entry.kind == MediaKind.LIVE) "Guarda ora" else "Riproduci ora",
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                }
            } else {
                item("episodes-header") {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        Spacer(Modifier.height(20.dp))
                        Text("Episodi", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(8.dp))
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
                            Text("Carico gli episodi dal provider…")
                        }
                    }
                } else if (episodes.isEmpty()) {
                    item("episodes-empty") {
                        Text(
                            text = "Il provider non ha fornito un elenco episodi per questa serie.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                        )
                    }
                } else {
                    items(episodes, key = { it.id }) { episode ->
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
                        text = "Nella stessa categoria",
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
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CoverImage(entry: MediaEntry) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .background(containerFor(entry.kind)),
        contentAlignment = Alignment.Center,
    ) {
        if (entry.logoUrl.isNullOrBlank()) {
            Icon(
                imageVector = iconFor(entry.kind),
                contentDescription = null,
                tint = accentFor(entry.kind),
                modifier = Modifier.size(56.dp),
            )
        } else {
            AsyncImage(
                model = entry.logoUrl,
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
private fun EpisodeRow(episode: Episode, onClick: () -> Unit, modifier: Modifier = Modifier) {
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
                contentDescription = "Riproduci episodio",
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

private fun titleFor(kind: MediaKind?): String = when (kind) {
    MediaKind.LIVE -> "Dettaglio canale"
    MediaKind.SERIES -> "Dettaglio serie"
    else -> "Dettaglio film"
}
