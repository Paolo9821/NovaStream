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
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.FocusableSurface
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel

@Composable
fun LiveScreen(
    viewModel: AppViewModel,
    contentPadding: PaddingValues,
    onOpenDetail: (String) -> Unit,
) {
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val query by viewModel.liveQuery.collectAsStateWithLifecycle()

    val total = remember(catalog, settings, unlocked) { viewModel.countOf(MediaKind.LIVE) }
    val entries = remember(catalog, query, settings, unlocked) {
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
            placeholder = "Cerca tra ${"%,d".format(total).replace(',', '.')} canali…",
            filterActive = query.group != null,
            onValueChange = { viewModel.applyQuery(MediaKind.LIVE, query.copy(search = it)) },
            onFilterClick = {
                viewModel.applyQuery(MediaKind.LIVE, query.copy(group = null))
            },
        )

        if (groups.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item("all") {
                    GroupChip(
                        label = "Tutti i canali",
                        selected = query.group == null,
                        onClick = { viewModel.applyQuery(MediaKind.LIVE, query.copy(group = null)) },
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
                title = if (total == 0) "Nessun canale importato" else "Nessun canale trovato",
                body = if (total == 0) {
                    "Collega una playlist dalla schermata Account per ricevere i canali live."
                } else {
                    "Prova con un'altra ricerca o categoria."
                },
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
                    ChannelRow(entry = entry, onClick = { onOpenDetail(entry.id) })
                }
            }
        }
    }
}

@Composable
private fun ChannelRow(entry: MediaEntry, onClick: () -> Unit) {
    val accents = LocalNovaAccents.current
    FocusableSurface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        focusRingColor = accents.live,
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
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
                    .size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(accents.liveContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.PlayArrow,
                    contentDescription = "Riproduci",
                    tint = accents.live,
                    modifier = Modifier.size(22.dp),
                )
            }
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
