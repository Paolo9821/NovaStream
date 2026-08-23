package com.rork.novastream.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.VideoLibrary
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.vm.AppViewModel
import com.rork.novastream.ui.vm.CatalogQuery

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    kind: MediaKind,
    contentPadding: PaddingValues,
    onOpenDetail: (String) -> Unit,
) {
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val query by viewModel.queryOf(kind).collectAsStateWithLifecycle()

    var groupSheetOpen by remember { mutableStateOf(false) }

    val total = remember(catalog, settings, unlocked) { viewModel.countOf(kind) }
    val years = remember(catalog, settings, unlocked) { viewModel.availableYears(kind) }
    val entries = remember(catalog, query, settings, unlocked) { viewModel.filteredEntries(kind, query) }
    val groups = remember(catalog, kind) {
        viewModel.visibleEntries(kind).map { it.group }.distinct().sorted()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding())
    ) {
        SearchRow(
            value = query.search,
            placeholder = "Cerca tra ${"%,d".format(total).replace(',', '.')} ${nounOf(kind)}…",
            filterActive = query.group != null,
            onValueChange = { viewModel.applyQuery(kind, query.copy(search = it)) },
            onFilterClick = { groupSheetOpen = true },
        )

        SortChipsRow(
            query = query,
            years = years,
            onQueryChange = { viewModel.applyQuery(kind, it) },
        )

        if (query.group != null) {
            ActiveGroupRow(
                group = query.group.orEmpty(),
                onClear = { viewModel.applyQuery(kind, query.copy(group = null)) },
            )
        }

        if (entries.isEmpty()) {
            EmptyState(
                icon = Icons.Rounded.VideoLibrary,
                title = if (total == 0) "Catalogo vuoto" else "Nessun risultato",
                body = if (total == 0) {
                    "Collega una playlist dalla schermata Account per importare i contenuti."
                } else {
                    "Prova a cambiare ricerca, anno o categoria."
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 132.dp),
                contentPadding = PaddingValues(
                    start = 20.dp,
                    end = 20.dp,
                    top = 12.dp,
                    bottom = contentPadding.calculateBottomPadding() + 24.dp,
                ),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                items(entries, key = { it.id }) { entry ->
                    PosterCard(entry = entry, onClick = { onOpenDetail(entry.id) })
                }
            }
        }
    }

    if (groupSheetOpen) {
        ModalBottomSheet(onDismissRequest = { groupSheetOpen = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("Categorie del provider", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(4.dp))
                GroupRow(
                    label = "Tutte le categorie",
                    selected = query.group == null,
                    onClick = {
                        viewModel.applyQuery(kind, query.copy(group = null))
                        groupSheetOpen = false
                    },
                )
                groups.forEach { group ->
                    GroupRow(
                        label = group,
                        selected = query.group == group,
                        onClick = {
                            viewModel.applyQuery(kind, query.copy(group = group))
                            groupSheetOpen = false
                        },
                    )
                }
            }
        }
    }

}

@Composable
fun SearchRow(
    value: String,
    placeholder: String,
    filterActive: Boolean,
    onValueChange: (String) -> Unit,
    onFilterClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 64.dp),
            placeholder = {
                Text(
                    text = placeholder,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Rounded.Search,
                    contentDescription = null,
                    modifier = Modifier.size(26.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            trailingIcon = if (value.isNotEmpty()) {
                {
                    IconButton(onClick = { onValueChange("") }) {
                        Icon(Icons.Rounded.Close, contentDescription = "Cancella ricerca")
                    }
                }
            } else null,
            singleLine = true,
            shape = RoundedCornerShape(18.dp),
            textStyle = MaterialTheme.typography.bodyLarge,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                disabledContainerColor = MaterialTheme.colorScheme.surface,
                focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
            ),
        )

        Surface(
            onClick = onFilterClick,
            shape = RoundedCornerShape(18.dp),
            color = if (filterActive) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(64.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Rounded.FilterList,
                    contentDescription = "Filtra per categoria",
                    modifier = Modifier.size(28.dp),
                    tint = if (filterActive) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}

@Composable
private fun SortChipsRow(
    query: CatalogQuery,
    years: List<Int>,
    onQueryChange: (CatalogQuery) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item("recent") {
            SortChip(
                label = SortOption.RECENTLY_ADDED.label,
                selected = query.sort == SortOption.RECENTLY_ADDED && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.RECENTLY_ADDED, year = null)) },
            )
        }
        items(years, key = { "year_$it" }) { year ->
            SortChip(
                label = "Anno: $year",
                selected = query.year == year,
                onClick = {
                    onQueryChange(
                        if (query.year == year) query.copy(year = null)
                        else query.copy(year = year, sort = SortOption.NAME_ASC)
                    )
                },
            )
        }
        item("az") {
            SortChip(
                label = SortOption.NAME_ASC.label,
                selected = query.sort == SortOption.NAME_ASC && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.NAME_ASC, year = null)) },
            )
        }
        item("za") {
            SortChip(
                label = SortOption.NAME_DESC.label,
                selected = query.sort == SortOption.NAME_DESC && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.NAME_DESC, year = null)) },
            )
        }
        item("provider") {
            SortChip(
                label = SortOption.PROVIDER_DEFAULT.label,
                selected = query.sort == SortOption.PROVIDER_DEFAULT && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.PROVIDER_DEFAULT, year = null)) },
            )
        }
    }
}

@Composable
private fun SortChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = if (selected) {
            { Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
        } else null,
        shape = RoundedCornerShape(12.dp),
        colors = FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surface,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
            selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ),
    )
}

@Composable
private fun ActiveGroupRow(group: String, onClear: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Categoria: $group",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onClear) {
            Icon(Icons.Rounded.Close, contentDescription = "Rimuovi filtro categoria")
        }
    }
}

@Composable
private fun GroupRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (selected) {
                Icon(Icons.Rounded.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

private fun nounOf(kind: MediaKind): String = when (kind) {
    MediaKind.LIVE -> "canali"
    MediaKind.MOVIE -> "film"
    MediaKind.SERIES -> "serie"
}
