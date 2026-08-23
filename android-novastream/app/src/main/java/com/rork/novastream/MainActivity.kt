package com.rork.novastream

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.novastream.data.local.ThemeMode
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.stringsFor
import com.rork.novastream.ui.navigation.AppNavigation
import com.rork.novastream.ui.theme.AppTheme
import com.rork.novastream.ui.vm.AppViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val viewModel: AppViewModel = viewModel()
            val settings by viewModel.settings.collectAsStateWithLifecycle()
            val darkTheme = when (settings.themeMode) {
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }
            val strings = remember(settings.language) { stringsFor(settings.language) }

            CompositionLocalProvider(LocalStrings provides strings) {
                AppTheme(darkTheme = darkTheme) {
                    AppNavigation(viewModel = viewModel)
                }
            }
        }
    }
}
