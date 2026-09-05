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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
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
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.ui.components.EmptyState
import com.rork.novastream.ui.components.LocalIsTv
import com.rork.novastream.ui.components.PosterCard
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.Strings
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
    val strings = LocalStrings.current
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val unlocked by viewModel.parentalUnlocked.collectAsStateWithLifecycle()
    val query by viewModel.queryOf(kind).collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()

    var groupSheetOpen by remember { mutableStateOf(false) }

    val total = remember(catalog, settings, unlocked) { viewModel.countOf(kind) }
    val years = remember(catalog, settings, unlocked) { viewModel.availableYears(kind) }
    val entries = remember(catalog, query, settings, unlocked, favorites) {
        viewModel.filteredEntries(kind, query)
    }
    val groups = remember(catalog, kind, settings, unlocked) {
        viewModel.visibleEntries(kind).map { it.group }.distinct().sorted()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding())
    ) {
        SearchRow(
            value = query.search,
            placeholder = strings.searchIn.format(formatCount(total), unitOf(kind, strings)),
            filterActive = query.group != null,
            filterDescription = strings.filterByCategory,
            onValueChange = { viewModel.applyQuery(kind, query.copy(search = it)) },
            onFilterClick = { groupSheetOpen = true },
        )

        SortChipsRow(
            query = query,
            years = years,
            strings = strings,
            onQueryChange = { viewModel.applyQuery(kind, it) },
        )

        if (query.group != null) {
            ActiveGroupRow(
                group = strings.categoryFilter.format(query.group.orEmpty()),
                description = strings.removeCategoryFilter,
                onClear = { viewModel.applyQuery(kind, query.copy(group = null)) },
            )
        }

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

    if (groupSheetOpen) {
        CategorySheet(
            title = strings.providerCategories,
            allLabel = strings.allCategories,
            groups = groups,
            selectedGroup = query.group,
            onSelect = { group ->
                viewModel.applyQuery(kind, query.copy(group = group))
                groupSheetOpen = false
            },
            onDismiss = { groupSheetOpen = false },
        )
    }
}

/**
 * The provider's category list, shown as a sheet over the current screen.
 *
 * Providers ship hundreds of groups, so the list is lazy and scrollable and the
 * sheet opens at full height: the old fixed column simply ran off the bottom of
 * the screen and the categories past the fold could not be reached at all.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategorySheet(
    title: String,
    allLabel: String,
    groups: List<String>,
    selectedGroup: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val strings = LocalStrings.current
    // Full height from the start: a half-open sheet turns every D-pad press into
    // a resize instead of a move down the list.
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val firstRow = rememberFocusRequester()

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(2.dp))
            Text(
                text = strings.categoriesCount.format(formatCount(groups.size)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    // fill = false keeps a short list compact while a long one
                    // takes the rest of the sheet and scrolls inside it.
                    .weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                contentPadding = PaddingValues(bottom = 28.dp),
            ) {
                item("all") {
                    GroupRow(
                        label = allLabel,
                        selected = selectedGroup == null,
                        onClick = { onSelect(null) },
                        modifier = Modifier.focusRequester(firstRow),
                    )
                }
                items(groups, key = { it }) { group ->
                    GroupRow(
                        label = group,
                        selected = selectedGroup == group,
                        onClick = { onSelect(if (selectedGroup == group) null else group) },
                    )
                }
            }
        }
        RequestInitialFocus(firstRow, key = groups.size)
    }
}

@Composable
fun SearchRow(
    value: String,
    placeholder: String,
    filterActive: Boolean,
    filterDescription: String,
    onValueChange: (String) -> Unit,
    onFilterClick: () -> Unit,
) {
    val strings = LocalStrings.current
    val isTv = LocalIsTv.current
    val keyboard = LocalSoftwareKeyboardController.current
    // On a remote the highlight merely passes over this field on its way down
    // the page. A keyboard that opened by itself would cover the screen and trap
    // the viewer, so typing begins only when OK is pressed and BACK ends it.
    var editing by remember { mutableStateOf(false) }

    LaunchedEffect(editing, isTv) {
        if (!isTv) return@LaunchedEffect
        if (editing) keyboard?.show() else keyboard?.hide()
    }

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
            // Read-only while it is only highlighted: this is what keeps the
            // on-screen keyboard shut until the viewer asks for it.
            readOnly = isTv && !editing,
            supportingText = if (isTv) {
                {
                    Text(
                        text = if (editing) "" else strings.searchOpenHint,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else null,
            keyboardActions = KeyboardActions(
                onSearch = {
                    editing = false
                    keyboard?.hide()
                }
            ),
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 64.dp)
                .tvFocusFrame(cornerRadius = 18.dp)
                .onFocusChanged { state ->
                    if (!state.isFocused && editing) editing = false
                }
                .onPreviewKeyEvent { event ->
                    if (!isTv || event.type != KeyEventType.KeyDown) {
                        return@onPreviewKeyEvent false
                    }
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter, Key.NumPadEnter ->
                            if (editing) false else { editing = true; true }

                        Key.Back -> if (editing) { editing = false; true } else false

                        else -> false
                    }
                },
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
                        Icon(Icons.Rounded.Close, contentDescription = strings.clearSearch)
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
            modifier = Modifier
                .size(64.dp)
                .tvFocusFrame(cornerRadius = 18.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Rounded.FilterList,
                    contentDescription = filterDescription,
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
    strings: Strings,
    onQueryChange: (CatalogQuery) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item("favorites") {
            SortChip(
                label = strings.onlyFavorites,
                selected = query.favoritesOnly,
                onClick = { onQueryChange(query.copy(favoritesOnly = !query.favoritesOnly)) },
            )
        }
        item("recent") {
            SortChip(
                label = strings.sortRecent,
                selected = query.sort == SortOption.RECENTLY_ADDED && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.RECENTLY_ADDED, year = null)) },
            )
        }
        items(years, key = { "year_$it" }) { year ->
            SortChip(
                label = strings.sortYear.format(year),
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
                label = strings.sortNameAsc,
                selected = query.sort == SortOption.NAME_ASC && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.NAME_ASC, year = null)) },
            )
        }
        item("za") {
            SortChip(
                label = strings.sortNameDesc,
                selected = query.sort == SortOption.NAME_DESC && query.year == null,
                onClick = { onQueryChange(query.copy(sort = SortOption.NAME_DESC, year = null)) },
            )
        }
        item("provider") {
            SortChip(
                label = strings.sortProvider,
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
private fun ActiveGroupRow(group: String, description: String, onClear: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = group,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onClear) {
            Icon(Icons.Rounded.Close, contentDescription = description)
        }
    }
}

@Composable
private fun GroupRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .tvFocusFrame(cornerRadius = 12.dp),
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
