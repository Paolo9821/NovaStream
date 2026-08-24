package com.rork.novastream.ui.components

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.VisualTransformation

/**
 * Text field that behaves correctly under a remote control.
 *
 * On a phone, tapping a field means "I want to type", so the keyboard should
 * appear straight away. On a TV the highlight merely passes over fields on its
 * way down the page, and a keyboard that opens by itself covers the screen and
 * traps the user. Here the field is read-only while it is only highlighted, and
 * becomes editable when OK is pressed; BACK closes the keyboard and hands the
 * D-pad back to the page. Touch devices keep the standard behaviour.
 */
@Composable
fun TvTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: @Composable (() -> Unit)? = null,
    placeholder: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    supportingText: @Composable (() -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
) {
    val isTv = LocalIsTv.current
    val keyboard = LocalSoftwareKeyboardController.current
    var editing by remember { mutableStateOf(false) }

    LaunchedEffect(editing) {
        if (editing) keyboard?.show()
    }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        placeholder = placeholder,
        trailingIcon = trailingIcon,
        supportingText = supportingText,
        singleLine = singleLine,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = KeyboardActions(
            onDone = {
                editing = false
                keyboard?.hide()
            }
        ),
        // While the field is only highlighted it stays read-only, which is what
        // keeps the on-screen keyboard from opening on its own.
        readOnly = isTv && !editing,
        modifier = modifier
            .onFocusChanged { state ->
                if (!state.isFocused && editing) {
                    editing = false
                    keyboard?.hide()
                }
            }
            .onPreviewKeyEvent { event ->
                if (!isTv || event.type != KeyEventType.KeyDown) {
                    return@onPreviewKeyEvent false
                }
                when (event.key) {
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> {
                        if (editing) false else { editing = true; true }
                    }

                    Key.Back -> {
                        if (editing) {
                            editing = false
                            keyboard?.hide()
                            true
                        } else {
                            false
                        }
                    }

                    else -> false
                }
            },
    )
}
