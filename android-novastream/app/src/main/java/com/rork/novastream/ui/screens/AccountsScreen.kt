package com.rork.novastream.ui.screens

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.model.AccountType
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.model.SyncState
import com.rork.novastream.data.repo.IptvRepository
import com.rork.novastream.ui.components.PrivacyNote
import com.rork.novastream.ui.vm.AppViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(
    viewModel: AppViewModel,
    onBack: () -> Unit,
) {
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val activeId by viewModel.activeAccountId.collectAsStateWithLifecycle()
    val syncState by viewModel.syncState.collectAsStateWithLifecycle()

    var formOpen by remember { mutableStateOf(accounts.isEmpty()) }
    var pendingSwitch by remember { mutableStateOf<PlaylistAccount?>(null) }
    var pendingDelete by remember { mutableStateOf<PlaylistAccount?>(null) }
    var submitting by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gestione account") },
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
                bottom = padding.calculateBottomPadding() + 32.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item("header") {
                Column {
                    Text("I tuoi account", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Cambia playlist quando vuoi: la lista precedente viene cancellata dal dispositivo e riscaricata dal nuovo server.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            item("sync") {
                AnimatedVisibility(visible = syncState is SyncState.Running) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = (syncState as? SyncState.Running)?.message.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            items(
                count = accounts.size,
                key = { index -> accounts[index].id },
            ) { index ->
                val account = accounts[index]
                AccountRow(
                    account = account,
                    isActive = account.id == activeId,
                    onSwitch = { pendingSwitch = account },
                    onDelete = { pendingDelete = account },
                )
            }

            item("privacy") {
                PrivacyNote(
                    title = "Privacy totale",
                    body = "Credenziali di tutti gli account cifrate sul dispositivo con ${viewModel.encryptionLabel}, mai condivise.",
                )
            }

            item("add-toggle") {
                Button(
                    onClick = { formOpen = !formOpen },
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(vertical = 16.dp),
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (formOpen) "Chiudi il modulo" else "Aggiungi account (m3u o Xtream)")
                }
            }

            if (formOpen) {
                item("form") {
                    AccountForm(
                        submitting = submitting,
                        error = formError,
                        onSubmit = { account ->
                            submitting = true
                            formError = null
                            viewModel.addAccount(account) { result ->
                                submitting = false
                                result.onSuccess { formOpen = false }
                                    .onFailure { formError = it.message }
                            }
                        },
                    )
                }
            }
        }
    }

    pendingSwitch?.let { account ->
        AlertDialog(
            onDismissRequest = { pendingSwitch = null },
            title = { Text("Passare a ${account.name}?") },
            text = {
                Text("Canali, film e serie dell'account attuale verranno cancellati dal dispositivo e riscaricati dal server di ${account.name}.")
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.switchAccount(account.id)
                    pendingSwitch = null
                }) { Text("Cambia account") }
            },
            dismissButton = {
                TextButton(onClick = { pendingSwitch = null }) { Text("Annulla") }
            },
        )
    }

    pendingDelete?.let { account ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Eliminare ${account.name}?") },
            text = { Text("Le credenziali cifrate e la lista scaricata verranno rimosse definitivamente dal dispositivo.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.removeAccount(account.id)
                    pendingDelete = null
                }) { Text("Elimina") }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("Annulla") }
            },
        )
    }
}

@Composable
private fun AccountRow(
    account: PlaylistAccount,
    isActive: Boolean,
    onSwitch: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = if (isActive) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
        else MaterialTheme.colorScheme.surface,
        border = if (isActive) androidx.compose.foundation.BorderStroke(
            1.5.dp,
            MaterialTheme.colorScheme.primary
        ) else null,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(23.dp))
                    .background(
                        if (isActive) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (account.type == AccountType.XTREAM) Icons.Rounded.Storage else Icons.Rounded.Link,
                    contentDescription = null,
                    tint = if (isActive) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = "${account.name} — ${account.typeLabel}",
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = buildString {
                        append(if (isActive) "Attivo" else "Non attivo")
                        append(" · ")
                        append(lastSyncLabel(account.lastSyncEpochMs))
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (isActive) {
                Icon(
                    imageVector = Icons.Rounded.CheckCircle,
                    contentDescription = "Account attivo",
                    tint = MaterialTheme.colorScheme.primary,
                )
            } else {
                IconButton(onClick = onSwitch) {
                    Icon(Icons.Rounded.SwapHoriz, contentDescription = "Cambia account")
                }
            }
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Rounded.Delete,
                    contentDescription = "Elimina account",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountForm(
    submitting: Boolean,
    error: String?,
    onSubmit: (PlaylistAccount) -> Unit,
) {
    var type by remember { mutableStateOf(AccountType.XTREAM) }
    var name by remember { mutableStateOf("") }
    var server by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var m3uUrl by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = type == AccountType.M3U,
                    onClick = { type = AccountType.M3U },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                ) { Text("URL m3u") }
                SegmentedButton(
                    selected = type == AccountType.XTREAM,
                    onClick = { type = AccountType.XTREAM },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                ) { Text("Codici Xtream") }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nome playlist") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            if (type == AccountType.XTREAM) {
                OutlinedTextField(
                    value = server,
                    onValueChange = { server = it },
                    label = { Text("Server") },
                    placeholder = { Text("http://srv.example.com:8080") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = if (passwordVisible) VisualTransformation.None
                    else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Rounded.VisibilityOff
                                else Icons.Rounded.Visibility,
                                contentDescription = if (passwordVisible) "Nascondi password" else "Mostra password",
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                OutlinedTextField(
                    value = m3uUrl,
                    onValueChange = { m3uUrl = it },
                    label = { Text("URL della playlist m3u") },
                    placeholder = { Text("http://srv.example.com/get.php?...") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            if (error != null) {
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            Button(
                onClick = {
                    val account = PlaylistAccount(
                        id = IptvRepository.newAccountId(),
                        name = name.trim().ifBlank { if (type == AccountType.XTREAM) "Playlist Xtream" else "Playlist m3u" },
                        type = type,
                        m3uUrl = m3uUrl.trim(),
                        server = server.trim(),
                        username = username.trim(),
                        password = password,
                    )
                    onSubmit(account)
                },
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 16.dp),
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text("Verifica e import in corso…")
                } else {
                    Text("Importa e crittografa")
                }
            }

            OutlinedButton(
                onClick = {
                    name = ""; server = ""; username = ""; password = ""; m3uUrl = ""
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Svuota i campi") }
        }
    }
}

private fun lastSyncLabel(epochMs: Long): String {
    if (epochMs <= 0L) return "Mai sincronizzato"
    val formatter = SimpleDateFormat("d MMM yyyy, HH:mm", Locale.ITALIAN)
    return "Aggiornato ${formatter.format(Date(epochMs))}"
}
