package com.rork.novastream.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.novastream.data.model.SortOption
import com.rork.novastream.ui.components.LocalIsTv
import com.rork.novastream.ui.components.PickerSheet
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.vm.CatalogQuery

/**
 * Layout shared by Live TV, Films and Series: the provider's categories stay
 * open in a column on the left (with the back arrow above them), the content
 * fills the right, and sorting lives behind the menu button at the top right.
 * On a remote, LEFT from the content always lands back on the categories.
 */
@Composable
fun SectionBrowser(
    sectionTitle: String,
    accent: Color,
    allLabel: String,
    total: Int,
    unitLabel: String,
    groups: List<String>,
    counts: Map<String, Int>,
    selectedGroup: String?,
    onSelectGroup: (String?) -> Unit,
    onBack: () -> Unit,
    search: String,
    searchPlaceholder: String,
    onSearchChange: (String) -> Unit,
    shownCount: Int,
    filterActive: Boolean,
    onOpenFilters: () -> Unit,
    contentPadding: PaddingValues,
    content: @Composable ColumnScope.() -> Unit,
) {
    val isTv = LocalIsTv.current
    val configuration = LocalConfiguration.current
    val wide = isTv || configuration.screenWidthDp >= 720
    // A phone held sideways is wide but short: a narrower column leaves room for the posters.
    val columnWidth = when {
        isTv -> 300.dp
        wide && configuration.screenHeightDp < 500 -> 230.dp
        wide -> 300.dp
        else -> 138.dp
    }
    val strings = LocalStrings.current

    Row(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding())
    ) {
        CategoryColumn(
            sectionTitle = sectionTitle,
            accent = accent,
            allLabel = allLabel,
            total = total,
            groups = groups,
            counts = counts,
            selectedGroup = selectedGroup,
            onSelectGroup = onSelectGroup,
            onBack = onBack,
            compact = !wide,
            bottomPadding = contentPadding.calculateBottomPadding(),
            modifier = Modifier
                .width(columnWidth)
                .fillMaxHeight(),
        )
        Box(
            modifier = Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
        )
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 18.dp, end = 14.dp, top = 10.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(Modifier.weight(if (wide) 0.9f else 1f)) {
                    Text(
                        text = selectedGroup ?: allLabel,
                        style = if (wide) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "${formatCount(shownCount)} $unitLabel",
                        style = MaterialTheme.typography.bodySmall,
                        color = accent,
                        maxLines = 1,
                    )
                }
                if (wide) {
                    SectionSearchField(
                        value = search,
                        placeholder = searchPlaceholder,
                        onValueChange = onSearchChange,
                        modifier = Modifier.weight(1.1f),
                    )
                }
                MenuButton(
                    active = filterActive,
                    accent = accent,
                    description = strings.more.sortAndFilter,
                    onClick = onOpenFilters,
                )
            }
            if (!wide) {
                SectionSearchField(
                    value = search,
                    placeholder = searchPlaceholder,
                    onValueChange = onSearchChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 4.dp),
                )
            }
            content()
        }
    }
}

@Composable
private fun CategoryColumn(
    sectionTitle: String,
    accent: Color,
    allLabel: String,
    total: Int,
    groups: List<String>,
    counts: Map<String, Int>,
    selectedGroup: String?,
    onSelectGroup: (String?) -> Unit,
    onBack: () -> Unit,
    compact: Boolean,
    bottomPadding: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val strings = LocalStrings.current
    var filter by rememberSaveable { mutableStateOf("") }
    val shown = remember(groups, filter) {
        val needle = filter.trim()
        if (needle.isEmpty()) groups else groups.filter { it.contains(needle, ignoreCase = true) }
    }
    val selectedIndex = if (selectedGroup == null) 0 else (shown.indexOf(selectedGroup) + 1).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = (selectedIndex - 2).coerceAtLeast(0))
    val selectedFocus = rememberFocusRequester()

    Column(
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceContainerLow)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 6.dp, end = 10.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.tvFocusFrame(cornerRadius = 24.dp),
            ) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = strings.back)
            }
            Text(
                text = sectionTitle,
                style = if (compact) MaterialTheme.typography.titleSmall else MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        SectionSearchField(
            value = filter,
            placeholder = strings.more.searchCategories,
            onValueChange = { filter = it },
            compact = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
        )
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .focusGroup(),
            contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 4.dp, bottom = bottomPadding + 24.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            item("all") {
                CategoryRow(
                    label = allLabel,
                    count = total,
                    selected = selectedGroup == null,
                    accent = accent,
                    compact = compact,
                    focusRequester = if (selectedGroup == null) selectedFocus else null,
                    onClick = { onSelectGroup(null) },
                )
            }
            itemsIndexed(shown, key = { _, group -> "g_$group" }) { _, group ->
                CategoryRow(
                    label = group,
                    count = counts[group] ?: 0,
                    selected = selectedGroup == group,
                    accent = accent,
                    compact = compact,
                    focusRequester = if (selectedGroup == group) selectedFocus else null,
                    onClick = { onSelectGroup(group) },
                )
            }
        }
    }
    // The remote starts on the category in use, like any IPTV box player.
    RequestInitialFocus(selectedFocus)
}

@Composable
private fun CategoryRow(
    label: String,
    count: Int,
    selected: Boolean,
    accent: Color,
    compact: Boolean,
    focusRequester: FocusRequester?,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (selected) accent.copy(alpha = 0.22f) else Color.Transparent,
        modifier = Modifier
            .fillMaxWidth()
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .tvFocusFrame(cornerRadius = 12.dp),
    ) {
        Row(
            modifier = Modifier.heightIn(min = if (compact) 44.dp else 50.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .padding(start = 4.dp)
                    .width(4.dp)
                    .height(if (compact) 22.dp else 26.dp)
                    .background(if (selected) accent else Color.Transparent, RoundedCornerShape(2.dp))
            )
            Text(
                text = label,
                style = if (compact) MaterialTheme.typography.bodySmall else MaterialTheme.typography.bodyLarge,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.86f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 10.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            )
            Text(
                text = formatCount(count),
                style = MaterialTheme.typography.labelMedium,
                color = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(end = 10.dp),
            )
        }
    }
}

@Composable
private fun MenuButton(active: Boolean, accent: Color, description: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = if (active) accent else MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier
            .size(54.dp)
            .tvFocusFrame(cornerRadius = 16.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = Icons.Rounded.Menu,
                contentDescription = description,
                modifier = Modifier.size(28.dp),
                tint = if (active) Color.Black else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * Search field that behaves on a remote: highlighting it does not pop the
 * keyboard up, OK starts typing and BACK stops.
 */
@Composable
fun SectionSearchField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val strings = LocalStrings.current
    val isTv = LocalIsTv.current
    val keyboard = LocalSoftwareKeyboardController.current
    var editing by remember { mutableStateOf(false) }

    LaunchedEffect(editing, isTv) {
        if (!isTv) return@LaunchedEffect
        if (editing) keyboard?.show() else keyboard?.hide()
    }

    TextField(
        value = value,
        onValueChange = onValueChange,
        readOnly = isTv && !editing,
        keyboardActions = KeyboardActions(onSearch = { editing = false; keyboard?.hide() }),
        modifier = modifier
            .heightIn(min = if (compact) 48.dp else 54.dp)
            .tvFocusFrame(cornerRadius = 14.dp)
            .onFocusChanged { state -> if (!state.isFocused && editing) editing = false }
            .onPreviewKeyEvent { event ->
                if (!isTv || event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
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
                style = if (compact) MaterialTheme.typography.bodySmall else MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Rounded.Search,
                contentDescription = null,
                modifier = Modifier.size(if (compact) 18.dp else 22.dp),
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
        shape = RoundedCornerShape(14.dp),
        textStyle = if (compact) MaterialTheme.typography.bodySmall else MaterialTheme.typography.bodyMedium,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
        ),
    )
}

/** The sorting and filtering choices behind the menu button. */
@Composable
fun SortFilterSheet(
    query: CatalogQuery,
    years: List<Int>,
    showRecent: Boolean,
    accent: Color,
    onQueryChange: (CatalogQuery) -> Unit,
    onDismiss: () -> Unit,
) {
    val strings = LocalStrings.current
    val firstFocus = rememberFocusRequester()

    PickerSheet(
        title = strings.more.sortAndFilter,
        closeLabel = strings.close,
        onDismiss = onDismiss,
    ) {
        Spacer(Modifier.height(12.dp))
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .focusGroup(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(bottom = 28.dp),
        ) {
            item("provider") {
                OptionRow(
                    label = strings.sortProvider,
                    selected = query.sort == SortOption.PROVIDER_DEFAULT && query.year == null,
                    accent = accent,
                    focusRequester = firstFocus,
                    onClick = {
                        onQueryChange(query.copy(sort = SortOption.PROVIDER_DEFAULT, year = null))
                        onDismiss()
                    },
                )
            }
            item("favorites") {
                OptionRow(
                    label = strings.onlyFavorites,
                    selected = query.favoritesOnly,
                    accent = accent,
                    icon = if (query.favoritesOnly) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    onClick = { onQueryChange(query.copy(favoritesOnly = !query.favoritesOnly)) },
                )
            }
            if (showRecent) item("recent") {
                OptionRow(
                    label = strings.sortRecent,
                    selected = query.sort == SortOption.RECENTLY_ADDED && query.year == null,
                    accent = accent,
                    onClick = {
                        onQueryChange(query.copy(sort = SortOption.RECENTLY_ADDED, year = null))
                        onDismiss()
                    },
                )
            }
            item("az") {
                OptionRow(
                    label = strings.sortNameAsc,
                    selected = query.sort == SortOption.NAME_ASC && query.year == null,
                    accent = accent,
                    onClick = {
                        onQueryChange(query.copy(sort = SortOption.NAME_ASC, year = null))
                        onDismiss()
                    },
                )
            }
            item("za") {
                OptionRow(
                    label = strings.sortNameDesc,
                    selected = query.sort == SortOption.NAME_DESC && query.year == null,
                    accent = accent,
                    onClick = {
                        onQueryChange(query.copy(sort = SortOption.NAME_DESC, year = null))
                        onDismiss()
                    },
                )
            }
            if (years.isNotEmpty()) {
                item("years_header") {
                    Column {
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        Text(
                            text = strings.more.filterYearSection,
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp, start = 4.dp),
                        )
                    }
                }
                itemsIndexed(years, key = { _, year -> "year_$year" }) { _, year ->
                    OptionRow(
                        label = year.toString(),
                        selected = query.year == year,
                        accent = accent,
                        onClick = {
                            onQueryChange(
                                if (query.year == year) query.copy(year = null)
                                else query.copy(year = year, sort = SortOption.NAME_ASC)
                            )
                            onDismiss()
                        },
                    )
                }
            }
        }
        RequestInitialFocus(firstFocus)
    }
}

@Composable
private fun OptionRow(
    label: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
    icon: ImageVector? = null,
    focusRequester: FocusRequester? = null,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (selected) accent.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .fillMaxWidth()
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .tvFocusFrame(cornerRadius = 12.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.width(12.dp))
            }
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                modifier = Modifier.weight(1f),
            )
            if (selected) {
                Icon(Icons.Rounded.Check, contentDescription = null, tint = accent)
            }
        }
    }
}
