package com.rork.novastream.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/**
 * Full-height panel used by the category pickers.
 *
 * Deliberately not a `ModalBottomSheet`. A sheet wires its own drag gesture to
 * the scrollable inside it: when a fast fling reaches the last row, the leftover
 * velocity is handed to the sheet, which starts to slide away and is snapped
 * back, so the whole panel shudders up and down instead of simply stopping at
 * the bottom. A dialog has no such gesture, so a fling ends where the list ends.
 *
 * BACK and the close button dismiss it, which is what a remote needs, and the
 * panel still slides up from the bottom edge so it reads as a sheet.
 */
@Composable
fun PickerSheet(
    title: String,
    onDismiss: () -> Unit,
    subtitle: String? = null,
    closeLabel: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        // Runs once per opening, so the panel animates in and then holds still.
        val entered = remember { MutableTransitionState(false).apply { targetState = true } }
        val scrimInteraction = remember { MutableInteractionSource() }

        Column(modifier = Modifier.fillMaxSize()) {
            // Tapping above the panel closes it, the way the area outside a
            // sheet does. No ripple: this is empty space, not a control.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.08f)
                    .clickable(
                        interactionSource = scrimInteraction,
                        indication = null,
                        onClick = onDismiss,
                    )
            )
            AnimatedVisibility(
                visibleState = entered,
                enter = slideInVertically(animationSpec = tween(220)) { it } + fadeIn(tween(160)),
                modifier = Modifier.weight(0.92f),
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                    color = MaterialTheme.colorScheme.surfaceContainerLow,
                    tonalElevation = 3.dp,
                ) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                modifier = Modifier
                                    .width(36.dp)
                                    .height(4.dp)
                                    .background(
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                        shape = RoundedCornerShape(2.dp),
                                    )
                            )
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 20.dp, end = 8.dp, top = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.titleLarge,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (subtitle != null) {
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        text = subtitle,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            IconButton(
                                onClick = onDismiss,
                                modifier = Modifier.tvFocusFrame(cornerRadius = 24.dp),
                            ) {
                                Icon(Icons.Rounded.Close, contentDescription = closeLabel)
                            }
                        }
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 20.dp),
                            content = content,
                        )
                    }
                }
            }
        }
    }
}
