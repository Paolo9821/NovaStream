package com.rork.novastream.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.rork.novastream.ui.theme.LocalNovaAccents

/**
 * Full-width primary button that stays readable under the remote's highlight.
 *
 * Material's focus feedback on a filled button is a faint wash over the same
 * blue, and the shared focus frame painted a second tint on top of the label:
 * from the sofa the word looked doubled and blurred. Here the focused button
 * swaps to solid high-contrast colours (ink on light, light on dark) with a
 * ring in the focus hue, and nothing is drawn over the text.
 */
@Composable
fun NovaPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 56.dp,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scheme = MaterialTheme.colorScheme
    val ring = LocalNovaAccents.current.focus

    val container by animateColorAsState(
        targetValue = if (focused) scheme.onBackground else scheme.primary,
        animationSpec = tween(140),
        label = "primaryButtonContainer",
    )
    val content by animateColorAsState(
        targetValue = if (focused) scheme.background else scheme.onPrimary,
        animationSpec = tween(140),
        label = "primaryButtonContent",
    )
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.03f else 1f,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 520f),
        label = "primaryButtonScale",
    )

    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interaction,
        modifier = modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .fillMaxWidth()
            .height(height)
            .scale(scale),
        shape = RoundedCornerShape(16.dp),
        border = if (focused) BorderStroke(3.dp, ring) else null,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 0.dp,
            focusedElevation = 0.dp,
            pressedElevation = 0.dp,
        ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
