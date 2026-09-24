package com.rork.novastream.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import com.rork.novastream.ui.components.RequestInitialFocus
import com.rork.novastream.ui.components.rememberFocusRequester
import com.rork.novastream.ui.components.tvFocusFrame

/** One row the viewer can pick in the player options panel. */
data class PlayerChoice(
    val key: String,
    val label: String,
    val detail: String? = null,
    val selected: Boolean,
)

/** A titled group of rows: audio, subtitles, picture format or speed. */
data class PlayerOptionSection(
    val id: String,
    val title: String,
    val icon: ImageVector,
    val choices: List<PlayerChoice>,
    /** Shown instead of rows when the stream offers nothing to choose here. */
    val emptyNote: String? = null,
    val onChoose: (String) -> Unit,
)

private val PanelColor = Color(0xF2101014)
private val RowSelectedColor = Color.White.copy(alpha = 0.10f)

/**
 * Side panel over the running picture, the way streaming apps show their audio
 * and subtitle menu: the video keeps playing on the left, dimmed only a little,
 * so the viewer hears and sees a change the moment they pick it.
 *
 * A dialog rather than an overlay inside the player, so the remote's arrows
 * walk these rows instead of seeking the video underneath. Picking a row keeps
 * the panel open: several changes can be made in one go, and BACK closes it.
 */
@Composable
fun PlayerOptionsPanel(
    title: String,
    closeLabel: String,
    sections: List<PlayerOptionSection>,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        // The system dims behind a dialog heavily by default; here the picture
        // is the whole point, so it stays almost fully visible.
        val dialogWindow = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect { dialogWindow?.setDimAmount(0.2f) }

        val entered = remember { MutableTransitionState(false).apply { targetState = true } }
        val scrimInteraction = remember { MutableInteractionSource() }
        val firstFocus = rememberFocusRequester()
        // The highlight starts on what is currently in use, so OK on a remote
        // never changes anything by accident.
        val focusKey = remember(sections) {
            sections.firstNotNullOfOrNull { section ->
                section.choices.firstOrNull { it.selected }?.let { "${section.id}/${it.key}" }
            } ?: sections.firstNotNullOfOrNull { section ->
                section.choices.firstOrNull()?.let { "${section.id}/${it.key}" }
            }
        }
        RequestInitialFocus(requester = firstFocus)

        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val panelWidth = (maxWidth * 0.92f).coerceAtMost(380.dp)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(
                        interactionSource = scrimInteraction,
                        indication = null,
                        onClick = onDismiss,
                    )
            )
            AnimatedVisibility(
                visibleState = entered,
                enter = slideInHorizontally(tween(220)) { it } + fadeIn(tween(160)),
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(panelWidth),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            PanelColor,
                            RoundedCornerShape(topStart = 26.dp, bottomStart = 26.dp),
                        )
                        .windowInsetsPadding(WindowInsets.safeDrawing),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 22.dp, end = 8.dp, top = 14.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = title,
                            color = Color.White,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.tvFocusFrame(cornerRadius = 24.dp),
                        ) {
                            Icon(Icons.Rounded.Close, contentDescription = closeLabel, tint = Color.White)
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        sections.forEach { section ->
                            item(key = "header-${section.id}") {
                                SectionTitle(section.title, section.icon)
                            }
                            if (section.choices.isEmpty() && section.emptyNote != null) {
                                item(key = "empty-${section.id}") {
                                    Text(
                                        text = section.emptyNote,
                                        color = Color.White.copy(alpha = 0.58f),
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    )
                                }
                            }
                            section.choices.forEach { choice ->
                                val rowKey = "${section.id}/${choice.key}"
                                item(key = "row-$rowKey") {
                                    ChoiceRow(
                                        choice = choice,
                                        onClick = { section.onChoose(choice.key) },
                                        modifier = if (rowKey == focusKey) {
                                            Modifier.focusRequester(firstFocus)
                                        } else Modifier,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String, icon: ImageVector) {
    Row(
        modifier = Modifier.padding(start = 10.dp, top = 18.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = title.uppercase(),
            color = Color.White.copy(alpha = 0.72f),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun ChoiceRow(
    choice: PlayerChoice,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp)
            .tvFocusFrame(cornerRadius = 14.dp)
            .clip(shape)
            .background(if (choice.selected) RowSelectedColor else Color.Transparent, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            if (choice.selected) {
                Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = choice.label,
                color = Color.White,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (choice.selected) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (choice.detail != null) {
                Text(
                    text = choice.detail,
                    color = Color.White.copy(alpha = 0.58f),
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
