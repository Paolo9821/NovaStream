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
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Storefront
import androidx.compose.material.icons.rounded.VpnKey
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rork.novastream.data.local.LicenseCodes
import com.rork.novastream.data.local.SalesChannel
import com.rork.novastream.ui.theme.LocalNovaAccents
import com.rork.novastream.ui.vm.AppViewModel

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

    var customerId by remember { mutableStateOf("") }
    var issuedCode by remember { mutableStateOf("") }
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
                            }
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
                        "SHA-256 of \"${LicenseCodes.SALT_PREVIEW}<device id>\".",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

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
