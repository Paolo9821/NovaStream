package com.rork.novastream.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Storefront
import androidx.compose.material.icons.rounded.VpnKey
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.LicenseCodes
import com.rork.novastream.data.local.SalesChannel
import com.rork.novastream.data.remote.RemoteLicense
import com.rork.novastream.data.remote.RemoteStatus
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/**
 * Owner-only panel: issues activation codes offline and configures where
 * customers are sent to buy. Kept in English on purpose — it never ships to
 * end users, it is reached only through the hidden Settings gesture.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    viewModel: AppViewModel,
    onBack: () -> Unit,
) {
    var unlocked by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Admin · License manager") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        if (!unlocked) {
            AdminGate(
                viewModel = viewModel,
                contentPadding = padding,
                onUnlocked = { unlocked = true },
            )
        } else {
            AdminPanel(viewModel = viewModel, contentPadding = padding)
        }
    }
}

@Composable
private fun AdminGate(
    viewModel: AppViewModel,
    contentPadding: PaddingValues,
    onUnlocked: () -> Unit,
) {
    var passphrase by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .imePadding()
            .padding(horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(78.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.AdminPanelSettings,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(36.dp),
            )
        }
        Spacer(Modifier.height(18.dp))
        Text(
            text = "Owner access",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Enter the admin passphrase to issue activation codes.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = passphrase,
            onValueChange = {
                passphrase = it
                error = false
            },
            label = { Text("Admin passphrase") },
            singleLine = true,
            isError = error,
            visualTransformation = PasswordVisualTransformation(),
            supportingText = { if (error) Text("Wrong passphrase") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                if (viewModel.verifyAdminPassphrase(passphrase)) onUnlocked() else error = true
            },
            enabled = passphrase.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Text("Unlock", fontWeight = FontWeight.SemiBold)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminPanel(
    viewModel: AppViewModel,
    contentPadding: PaddingValues,
) {
    val context = LocalContext.current
    val accents = LocalNovaAccents.current
    val sales by viewModel.sales.collectAsStateWithLifecycle()
    val identity = viewModel.deviceIdentity

    val online by viewModel.adminOnline.collectAsStateWithLifecycle()

    var customerId by remember { mutableStateOf("") }
    var issuedCode by remember { mutableStateOf("") }
    var customerLabel by remember { mutableStateOf("") }
    var adminEmail by remember { mutableStateOf("") }
    var adminPassword by remember { mutableStateOf("") }
    var handle by remember(sales.handle) { mutableStateOf(sales.handle) }
    var storeName by remember(sales.storeName) { mutableStateOf(sales.storeName) }
    var priceNote by remember(sales.priceNote) { mutableStateOf(sales.priceNote) }
    var newPassphrase by remember { mutableStateOf("") }
    var passphraseSaved by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .imePadding(),
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = contentPadding.calculateTopPadding() + 4.dp,
            bottom = contentPadding.calculateBottomPadding() + 40.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (viewModel.isUsingDefaultAdminPassphrase) {
            item("warning") {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = accents.privacy.copy(alpha = 0.14f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Warning,
                            contentDescription = null,
                            tint = accents.privacy,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "Default passphrase is still active. Change it below.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        item("generator") {
            AdminCard(title = "Issue an activation code") {
                Text(
                    text = "Paste the Device ID the customer sends you. The code is derived " +
                        "from that ID, works only on that device and never expires.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = customerId,
                    onValueChange = {
                        customerId = it.trim()
                        issuedCode = ""
                    },
                    label = { Text("Customer Device ID") },
                    supportingText = {
                        if (online.signedIn) Text("Registering online lets you revoke it later.")
                    },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = FontFamily.Monospace
                    ),
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                Row {
                    Button(
                        onClick = { issuedCode = viewModel.generateActivationCode(customerId) },
                        enabled = customerId.isNotBlank(),
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Rounded.VpnKey, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Generate")
                    }
                    Spacer(Modifier.width(10.dp))
                    OutlinedButton(
                        onClick = {
                            customerId = identity.deviceId
                            issuedCode = viewModel.generateActivationCode(identity.deviceId)
                        },
                    ) {
                        Icon(Icons.Rounded.Bolt, contentDescription = "This device")
                    }
                }

                AnimatedVisibility(
                    visible = issuedCode.isNotEmpty(),
                    enter = fadeIn() + expandVertically(),
                ) {
                    Column {
                        Spacer(Modifier.height(16.dp))
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.primaryContainer,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(16.dp)) {
                                Text(
                                    text = "Activation code",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    text = issuedCode,
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Spacer(Modifier.height(14.dp))
                                Row {
                                    Button(
                                        onClick = {
                                            copyToClipboard(context, issuedCode, "Code copied")
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Icon(Icons.Rounded.ContentCopy, contentDescription = null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Copy")
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    OutlinedButton(
                                        onClick = {
                                            launchPurchase(
                                                context = context,
                                                sales = com.rork.novastream.data.local.SalesConfig(),
                                                subject = "NovaStream activation code",
                                                message = "NovaStream activation code\n" +
                                                    "Device ID: $customerId\nCode: $issuedCode",
                                                chooserTitle = "Send code",
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Icon(Icons.Rounded.Share, contentDescription = null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Send")
                                    }
                                }

                                if (online.signedIn) {
                                    Spacer(Modifier.height(12.dp))
                                    OutlinedTextField(
                                        value = customerLabel,
                                        onValueChange = { customerLabel = it },
                                        label = { Text("Customer name (optional)") },
                                        singleLine = true,
                                        shape = RoundedCornerShape(14.dp),
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                    Spacer(Modifier.height(10.dp))
                                    Button(
                                        onClick = {
                                            viewModel.adminIssueOnline(customerId, customerLabel)
                                            customerLabel = ""
                                        },
                                        enabled = !online.busy,
                                        modifier = Modifier.fillMaxWidth(),
                                    ) {
                                        Icon(Icons.Rounded.CloudDone, contentDescription = null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Register in the online registry")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        item("online") {
            AdminCard(title = "Online control") {
                when {
                    !online.configured -> Text(
                        text = "The online registry is off: the Firebase keys are missing from " +
                            "this build. Codes still work offline, but they cannot be revoked. " +
                            "Add EXPO_PUBLIC_FIREBASE_PROJECT_ID and EXPO_PUBLIC_FIREBASE_API_KEY, " +
                            "then rebuild.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    !online.signedIn -> {
                        Text(
                            text = "Sign in with your Firebase owner account to see every " +
                                "activated device and suspend or revoke it remotely.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(14.dp))
                        OutlinedTextField(
                            value = adminEmail,
                            onValueChange = { adminEmail = it.trim() },
                            label = { Text("Owner email") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                capitalization = KeyboardCapitalization.None,
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = adminPassword,
                            onValueChange = { adminPassword = it },
                            label = { Text("Password") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        online.error?.let { message ->
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = message,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                        Spacer(Modifier.height(14.dp))
                        Button(
                            onClick = {
                                viewModel.adminSignIn(adminEmail, adminPassword)
                                adminPassword = ""
                            },
                            enabled = !online.busy && adminEmail.isNotBlank() &&
                                adminPassword.isNotBlank(),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (online.busy) {
                                CircularProgressIndicator(
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                            }
                            Text("Sign in")
                        }
                    }

                    else -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.CloudDone,
                                contentDescription = null,
                                tint = accents.live,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = online.email,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = { viewModel.adminRefreshLicenses() }) {
                                Icon(Icons.Rounded.Refresh, contentDescription = "Refresh")
                            }
                            IconButton(onClick = { viewModel.adminSignOut() }) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.Logout,
                                    contentDescription = "Sign out",
                                )
                            }
                        }
                        online.error?.let { message ->
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = message,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                        if (online.busy) {
                            Spacer(Modifier.height(12.dp))
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        if (online.licenses.isEmpty() && !online.busy) {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                text = "No device registered yet. Devices appear here as soon " +
                                    "as they activate a code with internet access.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        online.licenses.forEach { record ->
                            Spacer(Modifier.height(14.dp))
                            HorizontalDivider(color = accents.hairline)
                            Spacer(Modifier.height(14.dp))
                            RemoteLicenseRow(
                                record = record,
                                busy = online.busy,
                                onSetStatus = { status ->
                                    viewModel.adminSetStatus(record.deviceId, status)
                                },
                                onCopy = {
                                    copyToClipboard(context, record.deviceId, "Device ID copied")
                                },
                            )
                        }
                    }
                }
            }
        }

        item("sales") {
            AdminCard(title = "Where customers buy") {
                Text(
                    text = "This is what the \"Buy a license\" button opens on a locked device.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SalesChannel.entries.forEach { channel ->
                        FilterChip(
                            selected = sales.channel == channel,
                            onClick = { viewModel.updateSales(sales.copy(channel = channel)) },
                            label = { Text(channelLabel(channel)) },
                        )
                    }
                }
                if (sales.channel != SalesChannel.SHARE) {
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = handle,
                        onValueChange = { handle = it },
                        label = { Text(channelHint(sales.channel)) },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = storeName,
                    onValueChange = { storeName = it },
                    label = { Text("Store name (optional)") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = priceNote,
                    onValueChange = { priceNote = it },
                    label = { Text("Price note (optional)") },
                    placeholder = { Text("Lifetime license · 20 €") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = {
                        viewModel.updateSales(
                            sales.copy(
                                handle = handle,
                                storeName = storeName,
                                priceNote = priceNote,
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Rounded.Storefront, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Save sales channel")
                }
            }
        }

        item("passphrase") {
            AdminCard(title = "Admin passphrase") {
                OutlinedTextField(
                    value = newPassphrase,
                    onValueChange = {
                        newPassphrase = it
                        passphraseSaved = false
                    },
                    label = { Text("New passphrase (min 6 characters)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        if (viewModel.setAdminPassphrase(newPassphrase)) {
                            passphraseSaved = true
                            newPassphrase = ""
                        }
                    },
                    enabled = newPassphrase.trim().length >= 6,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Update passphrase") }
                if (passphraseSaved) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = "Passphrase updated on this device.",
                        style = MaterialTheme.typography.bodySmall,
                        color = accents.live,
                    )
                }
            }
        }

        item("howto") {
            AdminCard(title = "How it works") {
                Text(
                    text = "1. The customer opens NovaStream and copies the Device ID from the " +
                        "lock screen.\n" +
                        "2. They send it to you through the channel above.\n" +
                        "3. You paste it here, generate the code and send it back.\n" +
                        "4. They tap \"Enter activation code\" and the app unlocks forever.\n\n" +
                        "Codes are computed offline with a one-way hash of the Device ID, so a " +
                        "code copied to another device is always rejected. Formula: " +
                        "SHA-256 of \"${LicenseCodes.SALT_PREVIEW}<device id>\".\n\n" +
                        "With the online registry on, every activated device checks in twice a " +
                        "day. Suspend pauses it, revoke kills it for good; the device locks at " +
                        "its next check-in. A device that never reaches the server keeps " +
                        "working for 14 days, then asks to go online.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** One registered device with its remote kill switch. */
@Composable
private fun RemoteLicenseRow(
    record: RemoteLicense,
    busy: Boolean,
    onSetStatus: (RemoteStatus) -> Unit,
    onCopy: () -> Unit,
) {
    val accents = LocalNovaAccents.current
    val statusColor = when (record.status) {
        RemoteStatus.ACTIVE -> accents.live
        RemoteStatus.SUSPENDED -> accents.privacy
        RemoteStatus.REVOKED -> MaterialTheme.colorScheme.error
    }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = record.label.ifBlank { record.deviceId },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = record.deviceId,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = statusColor.copy(alpha = 0.14f),
            ) {
                Text(
                    text = record.status.name.lowercase(Locale.US),
                    style = MaterialTheme.typography.labelMedium,
                    color = statusColor,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
            IconButton(onClick = onCopy) {
                Icon(
                    imageVector = Icons.Rounded.ContentCopy,
                    contentDescription = "Copy device ID",
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        if (record.lastSeenMs > 0L) {
            Text(
                text = "Last seen ${adminDate(record.lastSeenMs)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (record.status != RemoteStatus.ACTIVE) {
                OutlinedButton(
                    onClick = { onSetStatus(RemoteStatus.ACTIVE) },
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("Reactivate")
                }
            }
            if (record.status != RemoteStatus.SUSPENDED) {
                OutlinedButton(
                    onClick = { onSetStatus(RemoteStatus.SUSPENDED) },
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PauseCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("Suspend")
                }
            }
            if (record.status != RemoteStatus.REVOKED) {
                OutlinedButton(
                    onClick = { onSetStatus(RemoteStatus.REVOKED) },
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Block,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("Revoke", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

private fun adminDate(epochMs: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT, Locale.US)
        .format(Date(epochMs))

@Composable
private fun AdminCard(
    title: String,
    content: @Composable () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

private fun channelLabel(channel: SalesChannel): String = when (channel) {
    SalesChannel.WHATSAPP -> "WhatsApp"
    SalesChannel.TELEGRAM -> "Telegram"
    SalesChannel.WEBSITE -> "Website"
    SalesChannel.EMAIL -> "Email"
    SalesChannel.SHARE -> "Share sheet"
}

private fun channelHint(channel: SalesChannel): String = when (channel) {
    SalesChannel.WHATSAPP -> "Phone number with country code"
    SalesChannel.TELEGRAM -> "Telegram username"
    SalesChannel.WEBSITE -> "Shop URL"
    SalesChannel.EMAIL -> "Support email"
    SalesChannel.SHARE -> ""
}
