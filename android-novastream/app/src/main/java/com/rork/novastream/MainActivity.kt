package com.rork.novastream

import android.app.UiModeManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
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
import com.rork.novastream.data.local.DeviceProfile
import com.rork.novastream.data.local.ThemeMode
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.stringsFor
import com.rork.novastream.ui.navigation.AppNavigation
import com.rork.novastream.ui.screens.OnboardingScreen
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
            val suggestedProfile = remember { detectDeviceProfile() }

            CompositionLocalProvider(LocalStrings provides strings) {
                AppTheme(darkTheme = darkTheme) {
                    if (settings.onboardingDone) {
                        AppNavigation(viewModel = viewModel)
                    } else {
                        OnboardingScreen(
                            suggestedProfile = suggestedProfile,
                            onConfirm = { profile ->
                                viewModel.settingsStore.completeOnboarding(profile)
                            },
                        )
                    }
                }
            }
        }
    }

    /** Pre-selects the most likely answer on the welcome screen. */
    private fun detectDeviceProfile(): DeviceProfile {
        val uiModeManager = getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
        val isTelevision = uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION ||
            packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        return if (isTelevision) DeviceProfile.TV else DeviceProfile.PHONE
    }
}
