package org.memphiszoo.custodial.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ZooColors = lightColorScheme(
    primary = Color(0xFF183B2B),
    onPrimary = Color.White,
    secondary = Color(0xFF8A5A2B),
    background = Color(0xFFF5F2EA),
    surface = Color.White,
    onSurface = Color(0xFF17201B),
    error = Color(0xFF8B1E1E),
)

@Composable
fun FoundationTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ZooColors, typography = Typography(), content = content)
}
