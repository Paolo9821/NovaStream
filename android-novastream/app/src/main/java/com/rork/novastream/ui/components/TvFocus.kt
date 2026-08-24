package com.rork.novastream.ui.components

import androidx.compose.foundation.focusGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager

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
