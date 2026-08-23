package com.rork.novastream.ui.screens

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.NetworkCheck
import androidx.compose.material.icons.rounded.Speed
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
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.DnsPreset
import com.rork.novastream.data.local.ThemeMode
import com.rork.novastream.ui.components.PrivacyNote
import com.rork.novastream.ui.vm.AppViewModel
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: AppViewModel,
    onBack: () -> Unit,
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val dnsCheck by viewModel.dnsCheck.collectAsStateWithLifecycle()
    val dnsChecking by viewModel.dnsChecking.collectAsStateWithLifecycle()
    val speedResult by viewModel.speedResult.collectAsStateWithLifecycle()
    val speedRunning by viewModel.speedRunning.collectAsStateWithLifecycle()
    val catalog by viewModel.catalog.collectAsStateWithLifecycle()

    var pinDialogOpen by remember { mutableStateOf(false) }
    var groupsDialogOpen by remember { mutableStateOf(false) }
    var wipeDialogOpen by remember { mutableStateOf(false) }
    var customDnsIp by remember(settings.customDnsPrimary) { mutableStateOf(settings.customDnsPrimary) }
    var customDnsDoh by remember(settings.customDnsDohUrl) { mutableStateOf(settings.customDnsDohUrl) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Impostazioni") },
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
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = padding.calculateTopPadding() + 4.dp,
                bottom = padding.calculateBottomPadding() + 40.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item("aspetto") {
                SettingsCard(title = "Aspetto") {
                    Text(
                        text = "Tema dell'interfaccia",
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
                            ) { Text(mode.label) }
                        }
                    }
                }
            }

            item("dns") {
                SettingsCard(title = "DNS") {
                    Text(
                        text = "Resolver usato dall'app per verificare e raggiungere i server della playlist.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    DnsPreset.entries.forEach { preset ->
                        DnsRow(
                            preset = preset,
                            selected = settings.dnsPreset == preset,
                            onClick = { viewModel.settingsStore.update { it.copy(dnsPreset = preset) } },
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    if (settings.dnsPreset == DnsPreset.CUSTOM) {
                        Spacer(Modifier.height(4.dp))
                        OutlinedTextField(
                            value = customDnsIp,
                            onValueChange = {
                                customDnsIp = it
                                viewModel.settingsStore.update { current -> current.copy(customDnsPrimary = it.trim()) }
                            },
                            label = { Text("DNS primario (IP)") },
                            placeholder = { Text("es. 94.140.14.14") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = customDnsDoh,
                            onValueChange = {
                                customDnsDoh = it
                                viewModel.settingsStore.update { current -> current.copy(customDnsDohUrl = it.trim()) }
                            },
                            label = { Text("Endpoint DNS-over-HTTPS (facoltativo)") },
                            placeholder = { Text("https://dns.example.com/dns-query") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { viewModel.checkDns() },
                        enabled = !dnsChecking,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (dnsChecking) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(10.dp))
                            Text("Verifica in corso…")
                        } else {
                            Icon(Icons.Rounded.NetworkCheck, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Verifica risoluzione DNS")
                        }
                    }

                    dnsCheck?.let { check ->
                        Spacer(Modifier.height(10.dp))
                        ResultRow(
                            title = check.host,
                            value = if (check.addresses.isEmpty()) "Nessuna risposta"
                            else check.addresses.take(2).joinToString(", "),
                            hint = "${check.resolver} · ${check.latencyMs} ms",
                        )
                    }
                }
            }

            item("speedtest") {
                SettingsCard(title = "Speedtest") {
                    Text(
                        text = "Misura la banda disponibile per capire quale qualità di stream puoi reggere.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = { viewModel.runSpeedTest() },
                        enabled = !speedRunning,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (speedRunning) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                            Spacer(Modifier.width(10.dp))
                            Text("Test in corso…")
                        } else {
                            Icon(Icons.Rounded.Speed, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Avvia speedtest")
                        }
                    }
                    speedResult?.let { result ->
                        Spacer(Modifier.height(10.dp))
                        ResultRow(
                            title = "Download",
                            value = "%.1f Mbps".format(result.downloadMbps),
                            hint = "Latenza ${result.latencyMs} ms · ${result.bytes / 1_000_000} MB scaricati",
                        )
                    }
                }
            }

            item("player") {
                SettingsCard(title = "Player") {
                    Text(
                        text = "Buffer: ${settings.bufferSeconds} secondi",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Slider(
                        value = settings.bufferSeconds.toFloat(),
                        onValueChange = { value ->
                            viewModel.settingsStore.update { it.copy(bufferSeconds = value.roundToInt()) }
                        },
                        valueRange = 5f..90f,
                        steps = 16,
                    )
                    ToggleRow(
                        title = "Decodifica hardware",
                        subtitle = "Più fluida e leggera; disattivala se vedi artefatti video.",
                        checked = settings.hardwareDecoding,
                        onCheckedChange = { value ->
                            viewModel.settingsStore.update { it.copy(hardwareDecoding = value) }
                        },
                    )
                    ToggleRow(
                        title = "Episodio successivo automatico",
                        subtitle = "Nelle serie passa al prossimo episodio a fine riproduzione.",
                        checked = settings.autoplayNextEpisode,
                        onCheckedChange = { value ->
                            viewModel.settingsStore.update { it.copy(autoplayNextEpisode = value) }
                        },
                    )
                }
            }

            item("parental") {
                SettingsCard(title = "Blocco genitori") {
                    ToggleRow(
                        title = "Proteggi con PIN",
                        subtitle = "Nascondi i gruppi scelti finché non viene inserito il PIN.",
                        checked = settings.parentalEnabled,
                        onCheckedChange = { value ->
                            if (value) pinDialogOpen = true else viewModel.settingsStore.clearParental()
                        },
                    )
                    if (settings.parentalEnabled) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "${settings.blockedGroups.size} gruppi bloccati",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = { groupsDialogOpen = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = catalog.entries.isNotEmpty(),
                        ) { Text("Scegli i gruppi da bloccare") }
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { pinDialogOpen = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Cambia PIN") }
                    }
                }
            }

            item("privacy") {
                PrivacyNote(
                    title = "Privacy totale",
                    body = "Account e cataloghi sono cifrati con ${viewModel.encryptionLabel}. Nessun dato viene inviato a servizi esterni: gli anni dei film arrivano dai metadati del tuo provider.",
                )
            }

            item("dati") {
                SettingsCard(title = "Dati e cache") {
                    ResultRow(
                        title = "Archivio cifrato",
                        value = "${viewModel.vaultSizeBytes() / 1024} KB",
                        hint = "Catalogo scaricato dal provider attivo",
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { viewModel.clearCatalogCache() },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Rounded.DeleteSweep, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Svuota la cache del catalogo")
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { wipeDialogOpen = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Cancella tutti i dati dell'app") }
                }
            }
        }
    }

    if (pinDialogOpen) {
        PinDialog(
            title = "Imposta il PIN",
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
            title = { Text("Cancellare tutto?") },
            text = { Text("Account, catalogo, cronologia e blocco genitori verranno rimossi definitivamente dal dispositivo.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.wipeEverything()
                    wipeDialogOpen = false
                }) { Text("Cancella tutto") }
            },
            dismissButton = {
                TextButton(onClick = { wipeDialogOpen = false }) { Text("Annulla") }
            },
        )
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun DnsRow(preset: DnsPreset, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceContainerHigh,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(text = preset.label, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = preset.description,
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
            .padding(vertical = 8.dp),
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
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun ResultRow(title: String, value: String, hint: String) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium)
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
        )
    }
}

@Composable
fun PinDialog(
    title: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
    error: String? = null,
) {
    var pin by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = pin,
                    onValueChange = { if (it.length <= 6 && it.all { char -> char.isDigit() }) pin = it },
                    label = { Text("PIN (4-6 cifre)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                )
                if (error != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(pin) },
                enabled = pin.length >= 4,
            ) { Text("Conferma") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } },
    )
}

@Composable
private fun GroupsDialog(
    groups: List<String>,
    blocked: Set<String>,
    onToggle: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Gruppi da bloccare") },
        text = {
            if (groups.isEmpty()) {
                Text("Importa prima una playlist per vedere i gruppi del provider.")
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
                                { Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            } else null,
                            modifier = Modifier.fillMaxWidth(),
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
        confirmButton = { TextButton(onClick = onDismiss) { Text("Fatto") } },
    )
}
