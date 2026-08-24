package com.rork.novastream.ui.navigation

import android.net.Uri
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.DeviceProfile
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.screens.AccountsScreen
import com.rork.novastream.ui.screens.CatalogScreen
import com.rork.novastream.ui.screens.DetailScreen
import com.rork.novastream.ui.screens.HomeScreen
import com.rork.novastream.ui.screens.LiveScreen
import com.rork.novastream.ui.screens.PlayerScreen
import com.rork.novastream.ui.screens.SettingsScreen
import com.rork.novastream.ui.vm.AppViewModel

private const val ROUTE_HOME = "home"
private const val ROUTE_LIVE = "live"
private const val ROUTE_MOVIES = "movies"
private const val ROUTE_SERIES = "series"
private const val ROUTE_ACCOUNTS = "accounts"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_DETAIL = "detail/{entryId}"
private const val ROUTE_PLAYER = "player/{entryId}/{streamUrl}"

private data class TopLevelDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

@Composable
fun AppNavigation(viewModel: AppViewModel) {
    val strings = LocalStrings.current
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val destinations = listOf(
        TopLevelDestination(ROUTE_HOME, strings.tabHome, Icons.Rounded.Home),
        TopLevelDestination(ROUTE_LIVE, strings.tabLive, Icons.Rounded.LiveTv),
        TopLevelDestination(ROUTE_MOVIES, strings.tabMovies, Icons.Rounded.Movie),
        TopLevelDestination(ROUTE_SERIES, strings.tabSeries, Icons.Rounded.Tv),
    )
    val isTopLevel = destinations.any { it.route == currentRoute }

    val configuration = LocalConfiguration.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val useRail = settings.deviceProfile == DeviceProfile.TV || configuration.screenWidthDp >= 720

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (isTopLevel && !useRail) {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    destinations.forEach { destination ->
                        NavigationBarItem(
                            selected = currentRoute == destination.route,
                            onClick = { navController.navigateToTab(destination.route) },
                            icon = { Icon(destination.icon, contentDescription = destination.label) },
                            label = { Text(destination.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Row(Modifier.fillMaxSize()) {
            if (isTopLevel && useRail) {
                NavigationRail(
                    containerColor = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.padding(top = padding.calculateTopPadding()),
                ) {
                    destinations.forEach { destination ->
                        NavigationRailItem(
                            selected = currentRoute == destination.route,
                            onClick = { navController.navigateToTab(destination.route) },
                            icon = { Icon(destination.icon, contentDescription = destination.label) },
                            label = { Text(destination.label) },
                        )
                    }
                }
            }

            NavHost(
                navController = navController,
                startDestination = ROUTE_HOME,
                modifier = Modifier.fillMaxSize(),
            ) {
                composable(ROUTE_HOME) {
                    HomeScreen(
                        viewModel = viewModel,
                        contentPadding = padding,
                        onOpenCategory = { kind ->
                            navController.navigateToTab(
                                when (kind) {
                                    MediaKind.LIVE -> ROUTE_LIVE
                                    MediaKind.MOVIE -> ROUTE_MOVIES
                                    MediaKind.SERIES -> ROUTE_SERIES
                                }
                            )
                        },
                        onOpenAccounts = { navController.navigate(ROUTE_ACCOUNTS) },
                        onOpenSettings = { navController.navigate(ROUTE_SETTINGS) },
                        onOpenDetail = { navController.navigate("detail/$it") },
                        onResume = { entryId, url -> navController.navigateToPlayer(entryId, url) },
                    )
                }

                composable(ROUTE_LIVE) {
                    LiveScreen(
                        viewModel = viewModel,
                        contentPadding = padding,
                        onOpenDetail = { navController.navigate("detail/$it") },
                    )
                }

                composable(ROUTE_MOVIES) {
                    CatalogScreen(
                        viewModel = viewModel,
                        kind = MediaKind.MOVIE,
                        contentPadding = padding,
                        onOpenDetail = { navController.navigate("detail/$it") },
                    )
                }

                composable(ROUTE_SERIES) {
                    CatalogScreen(
                        viewModel = viewModel,
                        kind = MediaKind.SERIES,
                        contentPadding = padding,
                        onOpenDetail = { navController.navigate("detail/$it") },
                    )
                }

                composable(ROUTE_ACCOUNTS) {
                    AccountsScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
                }

                composable(ROUTE_SETTINGS) {
                    SettingsScreen(
                        viewModel = viewModel,
                        onBack = { navController.popBackStack() },
                    )
                }

                composable(
                    route = ROUTE_DETAIL,
                    arguments = listOf(navArgument("entryId") { type = NavType.StringType }),
                ) { entry ->
                    val entryId = entry.arguments?.getString("entryId").orEmpty()
                    DetailScreen(
                        viewModel = viewModel,
                        entryId = entryId,
                        onBack = { navController.popBackStack() },
                        onPlay = { id, url -> navController.navigateToPlayer(id, url) },
                        onOpenRelated = { relatedId -> navController.navigate("detail/$relatedId") },
                    )
                }

                composable(
                    route = ROUTE_PLAYER,
                    arguments = listOf(
                        navArgument("entryId") { type = NavType.StringType },
                        navArgument("streamUrl") { type = NavType.StringType },
                    ),
                ) { entry ->
                    val entryId = entry.arguments?.getString("entryId").orEmpty()
                    val encoded = entry.arguments?.getString("streamUrl").orEmpty()
                    PlayerScreen(
                        viewModel = viewModel,
                        entryId = entryId,
                        streamUrl = Uri.decode(encoded),
                        onBack = { navController.popBackStack() },
                    )
                }
            }
        }
    }
}

private fun NavHostController.navigateToTab(route: String) {
    navigate(route) {
        popUpTo(ROUTE_HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

private fun NavHostController.navigateToPlayer(entryId: String, streamUrl: String) {
    if (streamUrl.isBlank()) return
    navigate("player/$entryId/${Uri.encode(streamUrl)}")
}
