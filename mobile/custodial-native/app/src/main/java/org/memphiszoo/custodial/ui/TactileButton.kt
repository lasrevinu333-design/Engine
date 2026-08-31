package org.memphiszoo.custodial.ui

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
fun TactileButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    disabledReason: String? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, label = "button-scale")
    val elevation by animateDpAsState(if (pressed) 1.dp else 7.dp, label = "button-elevation")
    val baseColor = MaterialTheme.colorScheme.primary
    val pressedColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.86f)
    val containerColor by animateColorAsState(if (pressed) pressedColor else baseColor, label = "button-color")
    val haptic = LocalHapticFeedback.current
    val available = enabled && !busy
    Button(
        onClick = {
            haptic.performHapticFeedback(HapticFeedbackType.Confirm)
            onClick()
        },
        enabled = available,
        interactionSource = interaction,
        colors = ButtonDefaults.buttonColors(containerColor = containerColor),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = elevation,
            pressedElevation = 1.dp,
            disabledElevation = 0.dp,
        ),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .semantics {
                stateDescription = when {
                    busy -> "Saving on this phone"
                    !enabled && !disabledReason.isNullOrBlank() -> disabledReason
                    !enabled -> "Unavailable"
                    else -> "Ready"
                }
            },
    ) {
        Text(if (busy) "Saving on this phone…" else label)
    }
}
