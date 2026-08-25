package com.rork.novastream.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.NetworkCheck
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Smartphone
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.VpnKey
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.BlockReason
import com.rork.novastream.data.local.CatalogUpdateInterval
import com.rork.novastream.data.local.DeviceProfile
import com.rork.novastream.data.local.DnsPreset
import com.rork.novastream.data.local.LicenseStatus
import com.rork.novastream.data.local.ThemeMode
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.ui.components.PrivacyNote
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.TvTextField
import com.rork.novastream.ui.components.dpadVerticalEscape
import com.rork.novastream.ui.components.sectionFocusTracker
import com.rork.novastream.ui.components.tvFocusFrame
import com.rork.novastream.ui.components.contentFocusZone
import com.rork.novastream.ui.components.dpadDownTo
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.i18n.Language
import com.rork.novastream.ui.i18n.LocalStrings
import com.rork.novastream.ui.i18n.Strings
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: AppViewModel,
    onBack: () -> Unit,
) {
    val strings = LocalStrings.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val dnsCheck by viewModel.dnsCheck.collectAsStateWithLifecycle()
    val dnsChecking by viewModel.dnsChecking.collectAsStateWithLifecycle()
    val speedResult by viewModel.speedResult.collectAsStateWithLifecycle()
    val speedRunning by viewModel.speedRunning.collectAsStateWithLifecycle()
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()
    val epg by viewModel.epg.collectAsStateWithLifecycle()
    val epgState by viewModel.epgState.collectAsStateWithLifecycle()
    val syncState by viewModel.syncState.collectAsStateWithLifecycle()
    val catalogSaving by viewModel.catalogSaving.collectAsStateWithLifecycle()
    val activeId by viewModel.activeAccountId.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val license by viewModel.license.collectAsStateWithLifecycle()
    val accents = LocalNovaAccents.current
    val storeUrl by viewModel.storeUrl.collectAsStateWithLifecycle()

    var pinDialogOpen by remember { mutableStateOf(false) }
    var groupsDialogOpen by remember { mutableStateOf(false) }
    var wipeDialogOpen by remember { mutableStateOf(false) }
    var customDnsIp by remember(settings.customDnsPrimary) { mutableStateOf(settings.customDnsPrimary) }
    var customDnsDoh by remember(settings.customDnsDohUrl) { mutableStateOf(settings.customDnsDohUrl) }

    val activeAccount = remember(accounts, activeId) { accounts.firstOrNull { it.id == activeId } }
    val lastSync = remember(activeAccount?.lastSyncEpochMs, catalog.syncedAtEpochMs) {
        activeAccount?.lastSyncEpochMs?.takeIf { it > 0L } ?: catalog.syncedAtEpochMs
    }
    var epgUrlField by remember(activeId, activeAccount?.epgUrl) {
        mutableStateOf(activeAccount?.epgUrl.orEmpty())
    }

    val contentFocus = rememberFocusRequester()
    RequestInitialFocus(contentFocus)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(strings.settingsTitle) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.dpadDownTo(contentFocus)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = strings.back)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .contentFocusZone(contentFocus),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = padding.calculateTopPadding() + 4.dp,
                bottom = padding.calculateBottomPadding() + 40.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item("language") {
                SettingsCard(title = strings.languageSection) {
                    Text(
                        text = strings.languageSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Language.entries.chunked(2).forEach { rowLanguages ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                rowLanguages.forEach { language ->
                                    LanguageChip(
                                        language = language,
                                        selected = settings.language == language,
                                        onClick = {
                                            viewModel.settingsStore.update { it.copy(language = language) }
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                if (rowLanguages.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            item("license") {
                SettingsCard(title = strings.licenseSection) {
                    val status = license.status
                    Text(
                        text = when (status) {
                            is LicenseStatus.Licensed -> when (val until = status.expiresAtMs) {
                                null -> strings.licenseLifetime
                                else -> strings.licenseActiveUntil
                                    .format(licenseDate(until, settings.language))
                            }
                            is LicenseStatus.Trial ->
                                strings.licenseStatusTrial.format(status.daysRemaining)
                            is LicenseStatus.Expired -> strings.licenseExpiredTitle
                            is LicenseStatus.Blocked -> when (status.reason) {
                                BlockReason.REVOKED -> strings.licenseRevokedTitle
                                BlockReason.SUSPENDED -> strings.licenseSuspendedTitle
                                BlockReason.UNVERIFIED -> strings.licenseUnverifiedTitle
                            }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = when (status) {
                            is LicenseStatus.Licensed -> accents.live
                            is LicenseStatus.Blocked -> MaterialTheme.colorScheme.error
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = when {
                            license.verifying -> strings.licenseChecking
                            license.lastVerifiedAtMs > 0L -> strings.licenseLastCheck
                                .format(licenseDate(license.lastVerifiedAtMs, settings.language))
                            else -> strings.licenseNeverChecked
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    DeviceIdentityCard(identity = license.identity)
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { viewModel.syncLicense(force = true) },
                        enabled = !license.verifying,
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) {
                        Icon(Icons.Rounded.Refresh, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (license.verifying) strings.licenseChecking
                            else strings.alreadyPaidCheck,
                        )
                    }
                }
            }

            item("device") {
                SettingsCard(title = strings.deviceSection) {
                    Text(
                        text = strings.deviceSectionSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        DeviceProfile.entries.forEachIndexed { index, profile ->
                            SegmentedButton(
                                selected = settings.deviceProfile == profile,
                                onClick = { viewModel.settingsStore.setDeviceProfile(profile) },
                                shape = SegmentedButtonDefaults.itemShape(index, DeviceProfile.entries.size),
                                modifier = Modifier.tvFocusFrame(
                                    cornerRadius = segmentCorner(index, DeviceProfile.entries.size),
                                ),
                                icon = {
                                    Icon(
                                        imageVector = if (profile == DeviceProfile.TV) Icons.Rounded.Tv
                                        else Icons.Rounded.Smartphone,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                    )
                                },
                            ) {
                                Text(
                                    text = if (profile == DeviceProfile.TV) strings.deviceTvTitle
                                    else strings.devicePhoneTitle,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }
            }

            item("appearance") {
                SettingsCard(title = strings.appearance) {
                    Text(
                        text = strings.themeLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        ThemeMode.entries.forEachIndexed { index, mode ->
                            SegmentedButton(
                                selected = settings.themeMode == mode,
                                onClick = { viewModel.settingsStore.update { it.copy(themeMode = mode) } },
                                shape = SegmentedButtonDefaults.itemShape(index, ThemeMode.entries.size),
                                modifier = Modifier.tvFocusFrame(
                                    cornerRadius = segmentCorner(index, ThemeMode.entries.size),
                                ),
                            ) { Text(themeLabel(mode, strings)) }
                        }
                    }
                }
            }

            item("autoupdate") {
                SettingsCard(title = strings.autoUpdateSection) {
                    Text(
                        text = strings.autoUpdateSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))

                    ResultRow(
                        title = strings.catalogSavedLabel,
                        value = strings.catalogSavedValue.format(catalog.entries.size),
                        hint = when {
                            lastSync > 0L -> strings.catalogLastSync.format(dateLabel(lastSync))
                            else -> strings.catalogNeverSynced
                        },
                    )

                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CatalogUpdateInterval.entries.forEach { interval ->
                            DnsRow(
                                label = intervalLabel(interval, strings),
                                description = intervalDescription(interval, strings),
                                selected = settings.catalogUpdateInterval == interval,
                                onClick = { viewModel.setCatalogUpdateInterval(interval) },
                            )
                        }
                    }

                    if (settings.catalogUpdateInterval != CatalogUpdateInterval.MANUAL) {
                        Spacer(Modifier.height(4.dp))
                        ToggleRow(
                            title = strings.autoUpdateGuideToggle,
                            subtitle = strings.autoUpdateGuideToggleSub,
                            checked = settings.autoUpdateGuide,
                            onCheckedChange = { viewModel.setAutoUpdateGuide(it) },
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    val syncing = syncState is SyncState.Running
                    Button(
                        onClick = { viewModel.refresh() },
                        enabled = !syncing && activeAccount != null,
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) {
                        if (syncing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(strings.catalogUpdating)
                        } else {
                            Icon(Icons.Rounded.Refresh, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(strings.catalogUpdateAction)
                        }
                    }

                    if (catalogSaving) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = strings.catalogSavingNotice,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    (syncState as? SyncState.Failed)?.let { failure ->
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = failure.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }

            item("epg") {
                SettingsCard(title = strings.epgSection) {
                    Text(
                        text = strings.epgSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))

                    if (activeAccount == null) {
                        Text(
                            text = strings.epgNoAccount,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    } else {
                        TvTextField(
                            value = epgUrlField,
                            onValueChange = {
                                epgUrlField = it
                                viewModel.updateEpgUrl(it)
                            },
                            label = { Text(strings.fieldEpgUrl) },
                            placeholder = { Text("http://srv.example.com/xmltv.php") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            supportingText = {
                                Text(strings.fieldEpgUrlHint, style = MaterialTheme.typography.bodySmall)
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(12.dp))

                        val running = epgState is SyncState.Running
                        Button(
                            onClick = { viewModel.refreshEpg() },
                            enabled = !running,
                            modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                        ) {
                            if (running) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(strings.epgUpdating)
                            } else {
                                Icon(Icons.Rounded.CalendarMonth, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text(strings.epgUpdateAction)
                            }
                        }

                        (epgState as? SyncState.Failed)?.let { failure ->
                            Spacer(Modifier.height(10.dp))
                            Text(
                                text = failure.message,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }

                        Spacer(Modifier.height(10.dp))
                        ResultRow(
                            title = strings.guide,
                            value = if (epg.isEmpty) strings.epgNever
                            else strings.epgLoaded.format(epg.programmeCount, epg.channelCount),
                            hint = if (epg.updatedAtEpochMs > 0L) {
                                strings.updatedPrefix.format(dateLabel(epg.updatedAtEpochMs))
                            } else {
                                viewModel.effectiveEpgUrl().take(64)
                            },
                        )
                    }
                }
            }

            item("dns") {
                SettingsCard(title = strings.dnsSection) {
                    Text(
                        text = strings.dnsSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    DnsPreset.entries.forEach { preset ->
                        DnsRow(
                            label = dnsLabel(preset, strings),
                            description = dnsDescription(preset, strings),
                            selected = settings.dnsPreset == preset,
                            onClick = { viewModel.settingsStore.update { it.copy(dnsPreset = preset) } },
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    if (settings.dnsPreset == DnsPreset.CUSTOM) {
                        Spacer(Modifier.height(4.dp))
                        TvTextField(
                            value = customDnsIp,
                            onValueChange = {
                                customDnsIp = it
                                viewModel.settingsStore.update { current -> current.copy(customDnsPrimary = it.trim()) }
                            },
                            label = { Text(strings.dnsPrimaryLabel) },
                            placeholder = { Text(strings.dnsPrimaryHint) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(10.dp))
                        TvTextField(
                            value = customDnsDoh,
                            onValueChange = {
                                customDnsDoh = it
                                viewModel.settingsStore.update { current -> current.copy(customDnsDohUrl = it.trim()) }
                            },
                            label = { Text(strings.dnsDohLabel) },
                            placeholder = { Text(strings.dnsDohHint) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { viewModel.checkDns() },
                        enabled = !dnsChecking,
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) {
                        if (dnsChecking) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(10.dp))
                            Text(strings.dnsChecking)
                        } else {
                            Icon(Icons.Rounded.NetworkCheck, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(strings.dnsCheckAction)
                        }
                    }

                    dnsCheck?.let { check ->
                        Spacer(Modifier.height(10.dp))
                        ResultRow(
                            title = check.host,
                            value = if (check.addresses.isEmpty()) strings.dnsNoAnswer
                            else check.addresses.take(2).joinToString(", "),
                            hint = "${check.resolver} · ${check.latencyMs} ms",
                        )
                    }
                }
            }

            item("speedtest") {
                SettingsCard(title = strings.speedSection) {
                    Text(
                        text = strings.speedSubtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = { viewModel.runSpeedTest() },
                        enabled = !speedRunning,
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) {
                        if (speedRunning) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(strings.speedRunning)
                        } else {
                            Icon(Icons.Rounded.Speed, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(strings.speedStart)
                        }
                    }
                    speedResult?.let { result ->
                        Spacer(Modifier.height(10.dp))
                        ResultRow(
                            title = strings.speedDownload,
                            value = "%.1f Mbps".format(result.downloadMbps),
                            hint = strings.speedHint.format(result.latencyMs, result.bytes / 1_000_000),
                        )
                    }
                }
            }

            item("player") {
                SettingsCard(title = strings.playerSection) {
                    Text(
                        text = strings.bufferLabel.format(settings.bufferSeconds),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Slider(
                        value = settings.bufferSeconds.toFloat(),
                        onValueChange = { value ->
                            viewModel.settingsStore.update { it.copy(bufferSeconds = value.roundToInt()) }
                        },
                        valueRange = 5f..90f,
                        steps = 16,
                        // Without this the remote would keep changing the value
                        // instead of moving on to the rest of the page.
                        modifier = Modifier
                            .dpadVerticalEscape()
                            .tvFocusFrame(cornerRadius = 22.dp),
                    )
                    ToggleRow(
                        title = strings.hwDecoding,
                        subtitle = strings.hwDecodingSub,
                        checked = settings.hardwareDecoding,
                        onCheckedChange = { value ->
                            viewModel.settingsStore.update { it.copy(hardwareDecoding = value) }
                        },
                    )
                    ToggleRow(
                        title = strings.autoplayNext,
                        subtitle = strings.autoplayNextSub,
                        checked = settings.autoplayNextEpisode,
                        onCheckedChange = { value ->
                            viewModel.settingsStore.update { it.copy(autoplayNextEpisode = value) }
                        },
                    )
                    // How long the "up next" card stays on screen before the
                    // following episode starts by itself.
                    if (settings.autoplayNextEpisode) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = strings.autoplayDelayLabel.format(settings.nextEpisodeDelaySeconds),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Slider(
                            value = settings.nextEpisodeDelaySeconds.toFloat(),
                            onValueChange = { value ->
                                viewModel.settingsStore.update {
                                    it.copy(nextEpisodeDelaySeconds = value.roundToInt().coerceIn(3, 30))
                                }
                            },
                            valueRange = 3f..30f,
                            steps = 8,
                            modifier = Modifier
                                .dpadVerticalEscape()
                                .tvFocusFrame(cornerRadius = 22.dp),
                        )
                    }
                }
            }

            item("parental") {
                SettingsCard(title = strings.parentalSection) {
                    ToggleRow(
                        title = strings.parentalToggle,
                        subtitle = strings.parentalToggleSub,
                        checked = settings.parentalEnabled,
                        onCheckedChange = { value ->
                            if (value) pinDialogOpen = true else viewModel.settingsStore.clearParental()
                        },
                    )
                    if (settings.parentalEnabled) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = strings.parentalBlockedCount.format(settings.blockedGroups.size),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = { groupsDialogOpen = true },
                            modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                            enabled = catalog.entries.isNotEmpty(),
                        ) { Text(strings.parentalChooseGroups) }
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { pinDialogOpen = true },
                            modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                        ) { Text(strings.parentalChangePin) }
                    }
                }
            }

            item("privacy") {
                PrivacyNote(
                    title = strings.privacyTotal,
                    body = strings.privacySettingsBody.format(viewModel.encryptionLabel),
                )
            }

            item("buy") {
                if (license.status !is LicenseStatus.Licensed) {
                    BuyLicenseCard(
                        identity = license.identity,
                        storeUrl = storeUrl,
                    )
                }
            }

            item("data") {
                SettingsCard(title = strings.dataSection) {
                    ResultRow(
                        title = strings.vaultLabel,
                        value = "${viewModel.vaultSizeBytes() / 1024} KB",
                        hint = strings.vaultHint,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { viewModel.clearCatalogCache() },
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) {
                        Icon(Icons.Rounded.DeleteSweep, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(strings.clearCacheAction)
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { wipeDialogOpen = true },
                        modifier = Modifier.fillMaxWidth().tvFocusFrame(cornerRadius = 20.dp),
                    ) { Text(strings.wipeAction) }
                }
            }

            item("version") {
                Text(
                    text = strings.appVersionLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                )
            }
        }
    }

    if (pinDialogOpen) {
        PinDialog(
            title = strings.parentalSetPin,
            label = strings.parentalPinLabel,
            confirmLabel = strings.confirm,
            cancelLabel = strings.cancel,
            onDismiss = { pinDialogOpen = false },
            onConfirm = { pin ->
                viewModel.settingsStore.setPin(pin)
                pinDialogOpen = false
                groupsDialogOpen = true
            },
        )
    }

    if (groupsDialogOpen) {
        GroupsDialog(
            groups = viewModel.allGroups(),
            blocked = settings.blockedGroups,
            strings = strings,
            onToggle = { group ->
                viewModel.settingsStore.update { current ->
                    val updated = current.blockedGroups.toMutableSet()
                    if (!updated.add(group)) updated.remove(group)
                    current.copy(blockedGroups = updated)
                }
            },
            onDismiss = { groupsDialogOpen = false },
        )
    }

    if (wipeDialogOpen) {
        AlertDialog(
            onDismissRequest = { wipeDialogOpen = false },
            title = { Text(strings.wipeDialogTitle) },
            text = { Text(strings.wipeDialogBody) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.wipeEverything()
                    wipeDialogOpen = false
                }) { Text(strings.wipeConfirm) }
            },
            dismissButton = {
                TextButton(onClick = { wipeDialogOpen = false }) { Text(strings.cancel) }
            },
        )
    }
}

@Composable
private fun LanguageChip(
    language: Language,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                text = language.nativeLabel,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        leadingIcon = if (selected) {
            {
                Icon(
                    Icons.Rounded.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
            }
        } else null,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .height(44.dp)
            .tvFocusFrame(cornerRadius = 12.dp),
    )
}

/** Ring rounding that matches the shape of a segmented button at [index]. */
private fun segmentCorner(index: Int, count: Int): Dp =
    if (index == 0 || index == count - 1) 20.dp else 4.dp

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    // The section itself lights up while the cursor is anywhere inside it, so a
    // glance at the screen answers "where am I?" without hunting for the ring.
    var focusWithin by remember { mutableStateOf(false) }
    val borderColor by animateColorAsState(
        targetValue = if (focusWithin) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        else Color.Transparent,
        animationSpec = tween(durationMillis = 160),
        label = "sectionBorder",
    )

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .sectionFocusTracker { focusWithin = it },
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(2.dp, borderColor),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = if (focusWithin) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun DnsRow(
    label: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .tvFocusFrame(cornerRadius = 14.dp),
        shape = RoundedCornerShape(14.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceContainerHigh,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(text = label, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (selected) {
                Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            // The whole row answers the OK key: on a remote the switch alone is
            // a tiny target and an easy stop to lose sight of.
            .toggleable(
                value = checked,
                role = Role.Switch,
                onValueChange = onCheckedChange,
            )
            .tvFocusFrame(cornerRadius = 12.dp)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.bodyLarge)
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked = checked, onCheckedChange = null)
    }
}

@Composable
private fun ResultRow(title: String, value: String, hint: String) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Text(
            text = hint,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun PinDialog(
    title: String,
    label: String,
    confirmLabel: String,
    cancelLabel: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var pin by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            TvTextField(
                value = pin,
                onValueChange = { if (it.length <= 6 && it.all { char -> char.isDigit() }) pin = it },
                label = { Text(label) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(pin) }, enabled = pin.length >= 4) { Text(confirmLabel) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(cancelLabel) } },
    )
}

@Composable
private fun GroupsDialog(
    groups: List<String>,
    blocked: Set<String>,
    strings: Strings,
    onToggle: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.parentalGroupsTitle) },
        text = {
            if (groups.isEmpty()) {
                Text(strings.parentalImportFirst)
            } else {
                LazyColumn(
                    modifier = Modifier.height(360.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(count = groups.size, key = { groups[it] }) { index ->
                        val group = groups[index]
                        FilterChip(
                            selected = blocked.contains(group),
                            onClick = { onToggle(group) },
                            label = { Text(group, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            leadingIcon = if (blocked.contains(group)) {
                                {
                                    Icon(
                                        Icons.Rounded.Check,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            } else null,
                            modifier = Modifier
                                .fillMaxWidth()
                                .tvFocusFrame(cornerRadius = 8.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.errorContainer,
                                selectedLabelColor = MaterialTheme.colorScheme.onErrorContainer,
                                selectedLeadingIconColor = MaterialTheme.colorScheme.onErrorContainer,
                            ),
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(strings.done) } },
    )
}

private fun themeLabel(mode: ThemeMode, strings: Strings): String = when (mode) {
    ThemeMode.SYSTEM -> strings.themeSystem
    ThemeMode.LIGHT -> strings.themeLight
    ThemeMode.DARK -> strings.themeDark
}

private fun dnsLabel(preset: DnsPreset, strings: Strings): String = when (preset) {
    DnsPreset.SYSTEM -> strings.dnsSystem
    DnsPreset.GOOGLE -> "Google"
    DnsPreset.CLOUDFLARE -> "Cloudflare"
    DnsPreset.QUAD9 -> "Quad9"
    DnsPreset.CUSTOM -> strings.dnsCustom
}

private fun dnsDescription(preset: DnsPreset, strings: Strings): String = when (preset) {
    DnsPreset.SYSTEM -> strings.dnsSystemDesc
    DnsPreset.CUSTOM -> strings.dnsCustomDesc
    else -> preset.addressLabel
}

private fun intervalLabel(interval: CatalogUpdateInterval, strings: Strings): String =
    when (interval) {
        CatalogUpdateInterval.MANUAL -> strings.autoUpdateManual
        CatalogUpdateInterval.DAILY -> strings.autoUpdateDaily
        CatalogUpdateInterval.EVERY_2_DAYS -> strings.autoUpdateEvery2
        CatalogUpdateInterval.EVERY_3_DAYS -> strings.autoUpdateEvery3
        CatalogUpdateInterval.WEEKLY -> strings.autoUpdateWeekly
    }

private fun intervalDescription(interval: CatalogUpdateInterval, strings: Strings): String =
    when (interval) {
        CatalogUpdateInterval.MANUAL -> strings.catalogUpdateAction
        else -> strings.autoUpdateSubtitle.substringBefore('.')
    }

private fun dateLabel(epochMs: Long): String {
    val formatter = SimpleDateFormat("d MMM, HH:mm", Locale.getDefault())
    return formatter.format(Date(epochMs))
}
