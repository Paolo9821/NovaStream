package com.rork.novastream.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.focusGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * True when the app is driven by a remote control rather than a touchscreen.
 * Focus behaviour that would be intrusive on a phone (moving the highlight on
 * its own, opening the keyboard) is enabled only when this is set.
 */
val LocalIsTv = staticCompositionLocalOf { false }

@Composable
fun rememberFocusRequester(): FocusRequester = remember { FocusRequester() }

/**
 * Marks the scrollable body of a screen as the landing zone for the D-pad.
 *
 * The node itself never takes focus: because it is a focus group, any focus
 * request aimed at it is handed to the first focusable child inside, and the
 * list scrolls on its own as the highlight walks past the viewport.
 */
fun Modifier.contentFocusZone(requester: FocusRequester): Modifier =
    this.focusRequester(requester).focusGroup()

/**
 * Sends the D-pad "down" press from a top bar control straight into the screen
 * body. Compose cannot always work out that route by itself, which otherwise
 * leaves the highlight stranded on the back arrow.
 */
fun Modifier.dpadDownTo(requester: FocusRequester): Modifier =
    this.focusProperties { down = requester }

/**
 * Moves the highlight into the screen body once it has been laid out, so a
 * remote user starts on real content instead of the back arrow. A request made
 * before the target is attached throws, hence the frame wait and the guard.
 */
@Composable
fun RequestInitialFocus(
    requester: FocusRequester,
    enabled: Boolean = LocalIsTv.current,
    key: Any? = Unit,
) {
    LaunchedEffect(enabled, key) {
        if (!enabled) return@LaunchedEffect
        withFrameNanos { }
        runCatching { requester.requestFocus() }
    }
}

/**
 * Draws an unmistakable highlight around whatever the remote is pointing at.
 *
 * Material's own focus feedback is a faint tint that disappears on a bright
 * settings page seen from three metres away, so the user loses track of the
 * cursor while scrolling and confirms the wrong row. This paints a thick ring
 * plus a light wash over the control, on top of its own background so nothing
 * can hide it, and it reserves no extra space so layouts are untouched.
 *
 * The ring follows descendants too (`hasFocus`), which is what lets it wrap
 * composite controls such as a slider or a switch row.
 */
@Composable
fun Modifier.tvFocusFrame(
    cornerRadius: Dp = 16.dp,
    ringWidth: Dp = 3.dp,
): Modifier {
    var focused by remember { mutableStateOf(false) }
    val progress by animateFloatAsState(
        targetValue = if (focused) 1f else 0f,
        animationSpec = tween(durationMillis = 130),
        label = "tvFocusFrame",
    )
    val ringColor = MaterialTheme.colorScheme.primary
    return this
        .onFocusChanged { state -> focused = state.hasFocus }
        .drawWithContent {
            drawContent()
            if (progress < 0.01f) return@drawWithContent
            val radius = CornerRadius(cornerRadius.toPx())
            drawRoundRect(
                color = ringColor.copy(alpha = 0.10f * progress),
                cornerRadius = radius,
            )
            val stroke = ringWidth.toPx()
            drawRoundRect(
                color = ringColor.copy(alpha = progress),
                topLeft = Offset(stroke / 2f, stroke / 2f),
                size = Size(size.width - stroke, size.height - stroke),
                cornerRadius = radius,
                style = Stroke(width = stroke),
            )
        }
}

/**
 * Tints a settings section while the highlight is somewhere inside it, so the
 * user keeps a sense of place on a long page even between two rows.
 */
@Composable
fun Modifier.sectionFocusTracker(onFocusWithin: (Boolean) -> Unit): Modifier =
    this.onFocusChanged { state -> onFocusWithin(state.hasFocus) }

/**
 * Frees the D-pad from a control that reads up and down as value changes.
 *
 * A slider answers vertical presses by moving its own value, so the highlight
 * gets stuck on it: the remote scrolls seconds instead of walking further down
 * the page. Vertical presses are claimed here, before the control sees them,
 * and turned back into focus movement. Left and right still adjust the value.
 */
@Composable
fun Modifier.dpadVerticalEscape(): Modifier {
    val focusManager = LocalFocusManager.current
    return this.then(
        remember(focusManager) {
            Modifier.onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionUp -> focusManager.moveFocus(FocusDirection.Up)
                    Key.DirectionDown -> focusManager.moveFocus(FocusDirection.Down)
                    else -> false
                }
            }
        }
    )
}
