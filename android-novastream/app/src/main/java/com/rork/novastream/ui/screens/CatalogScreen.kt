package com.rork.novastream.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.rounded.VideoLibrary
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.LocalIsTv
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import com.rork.novastream.ui.vm.CatalogQuery

/** Films or series: categories on the left, posters on the right. */
@Composable
fun CatalogScreen(
    viewModel: AppViewModel,
    kind: MediaKind,
    contentPadding: PaddingValues,
    onOpenDetail: (String) -> Unit,
    onBack: () -> Unit,
) {
    val strings = LocalStrings.current
    val accents = LocalNovaAccents.current
    val isTv = LocalIsTv.current
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val query by viewModel.queryOf(kind).collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()

    var filtersOpen by remember { mutableStateOf(false) }

    val total = remember(catalog, settings, unlocked) { viewModel.countOf(kind) }
    val years = remember(catalog, settings, unlocked) { viewModel.availableYears(kind) }
    val entries = remember(catalog, query, settings, unlocked, favorites) {
        viewModel.filteredEntries(kind, query)
    }
    val groups = remember(catalog, kind, settings, unlocked) { viewModel.visibleGroupsOf(kind) }
    val counts = remember(catalog, kind, settings, unlocked) { viewModel.groupCountsOf(kind) }
    // A new category starts from its first row instead of where the last one was left.
    val gridState = remember(query.group, query.sort, query.year, query.favoritesOnly) { LazyGridState() }
    val accent = if (kind == MediaKind.MOVIE) accents.movie else accents.series

    SectionBrowser(
        sectionTitle = if (kind == MediaKind.MOVIE) strings.tabMovies else strings.tabSeries,
        accent = accent,
        allLabel = strings.allCategories,
        total = total,
        unitLabel = unitOf(kind, strings),
        groups = groups,
        counts = counts,
        selectedGroup = query.group,
        onSelectGroup = { viewModel.applyQuery(kind, query.copy(group = it)) },
        onBack = onBack,
        search = query.search,
        searchPlaceholder = strings.searchIn.format(formatCount(total), unitOf(kind, strings)),
        onSearchChange = { viewModel.applyQuery(kind, query.copy(search = it)) },
        shownCount = entries.size,
        filterActive = query.isFiltered(),
        onOpenFilters = { filtersOpen = true },
        contentPadding = contentPadding,
    ) {
        if (entries.isEmpty()) {
            EmptyState(
                icon = if (query.favoritesOnly) Icons.Filled.Favorite else Icons.Rounded.VideoLibrary,
                title = when {
                    query.favoritesOnly -> strings.noFavoritesTitle
                    total == 0 -> strings.emptyCatalogTitle
                    else -> strings.noResultsTitle
                },
                body = when {
                    query.favoritesOnly -> strings.noFavoritesBody
                    total == 0 -> strings.emptyCatalogBody
                    else -> strings.noResultsBody
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            LazyVerticalGrid(
                state = gridState,
                columns = GridCells.Adaptive(minSize = if (isTv) 150.dp else 112.dp),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = 10.dp,
                    bottom = contentPadding.calculateBottomPadding() + 24.dp,
                ),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                items(entries, key = { it.id }) { entry ->
                    PosterCard(
                        entry = entry,
                        onClick = { onOpenDetail(entry.id) },
                        isFavorite = favorites.contains(entry.id),
                        onToggleFavorite = { viewModel.toggleFavorite(entry.id) },
                    )
                }
            }
        }
    }

    if (filtersOpen) {
        SortFilterSheet(
            query = query,
            years = years,
            showRecent = true,
            accent = accent,
            onQueryChange = { viewModel.applyQuery(kind, it) },
            onDismiss = { filtersOpen = false },
        )
    }
}

/** True when anything other than the provider's plain order is applied. */
internal fun CatalogQuery.isFiltered(): Boolean =
    sort != SortOption.PROVIDER_DEFAULT || year != null || favoritesOnly
