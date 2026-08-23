package com.rork.novastream.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.novastream.ui.components.BrandMark
import com.rork.novastream.ui.i18n.LocalStrings

/**
 * First-launch legal gate. The clause text is intentionally kept in English on every
 * locale because it is the binding wording supplied for the product.
 */
private const val TERMS_INTRO =
    "Welcome. Before using this application, you must read, understand, and agree to " +
        "the following Terms and Conditions:"

private val TERMS_CLAUSES: List<Pair<String, String>> = listOf(
    "1. Disclaimer of Liability for Unlawful or Misuse:" to
        "This application is provided on an 'as is' and 'as available' basis. It is intended " +
        "solely for lawful, personal use in compliance with all applicable laws and regulations. " +
        "The creator, developer, and distributor of this application shall not be held liable or " +
        "responsible for any unlawful, unauthorized, or improper use of the application, or for " +
        "any activity carried out by the user.",
    "2. No Media Included & IPTV Disclaimer:" to
        "This application functions purely as a media player tool. It DOES NOT contain, provide, " +
        "host, distribute, or promote any IPTV streams, channel lists, playlists, subscriptions, " +
        "or copyrighted material. The user assumes sole and full legal responsibility for all " +
        "content, links, or files loaded into, processed by, or viewed within the application.",
    "3. Copyright Compliance:" to
        "By using this app, you warrant and represent that you will not infringe upon any " +
        "third-party intellectual property or copyright laws. The creator disclaims any and all " +
        "liability arising from copyright violations or illegal streaming performed by users.",
)

private const val TERMS_CLOSING =
    "By clicking 'Accept', you acknowledge that you have read, understood, and agreed to be " +
        "bound by these Terms and Conditions in their entirety."

@Composable
fun TermsScreen(
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val strings = LocalStrings.current
    val scrollState = rememberScrollState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandMark(size = 56.dp)
            Spacer(Modifier.height(14.dp))
            Text(
                text = "Terms of Service & Disclaimer",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(18.dp))

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(18.dp),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Box {
                    Column(
                        modifier = Modifier
                            .verticalScroll(scrollState)
                            .padding(horizontal = 18.dp, vertical = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Text(
                            text = TERMS_INTRO,
                            style = MaterialTheme.typography.bodyLarge,
                            lineHeight = 24.sp,
                        )
                        TERMS_CLAUSES.forEach { (heading, body) ->
                            Text(
                                text = buildAnnotatedString {
                                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                                        append(heading)
                                    }
                                    append(" ")
                                    append(body)
                                },
                                style = MaterialTheme.typography.bodyLarge,
                                lineHeight = 24.sp,
                            )
                        }
                        Text(
                            text = TERMS_CLOSING,
                            style = MaterialTheme.typography.bodyLarge,
                            lineHeight = 24.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(Modifier.height(18.dp))
            Button(
                onClick = onAccept,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(
                    text = "Accept",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            TextButton(
                onClick = onDecline,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 14.dp),
                colors = ButtonDefaults.textButtonColors(
                    contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
            ) {
                Text(text = "Decline", fontWeight = FontWeight.SemiBold)
            }
            Text(
                text = strings.termsSavedOnce,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            )
        }
    }
}
