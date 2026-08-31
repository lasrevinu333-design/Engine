package org.memphiszoo.custodial.ui

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredHeightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@Composable
fun SlideUpLockScreen(
    employeeName: String,
    timeText: String,
    onUnlock: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var offsetPx by remember { mutableFloatStateOf(0f) }
    var screenHeightPx by remember { mutableFloatStateOf(1f) }
    val scope = rememberCoroutineScope()
    val thresholdFraction = 0.24f
    val motionEnabled = ValueAnimator.areAnimatorsEnabled()

    fun settle(velocity: Float) {
        val unlock = offsetPx <= -screenHeightPx * thresholdFraction || velocity < -1200f
        val target = if (unlock) -screenHeightPx else 0f
        val start = offsetPx
        scope.launch {
            if (motionEnabled) {
                Animatable(start).animateTo(
                    target,
                    spring(
                        stiffness = if (unlock) 420f else 500f,
                        dampingRatio = if (unlock) 0.9f else 0.88f,
                    ),
                ) { offsetPx = value }
            } else {
                offsetPx = target
            }
            if (unlock) onUnlock()
        }
    }

    Surface(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged { screenHeightPx = it.height.toFloat().coerceAtLeast(1f) }
            .graphicsLayer { translationY = offsetPx },
        color = Color(0xFF10251C),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(timeText, color = Color.White, fontSize = 54.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(12.dp))
                Text(employeeName, color = Color.White, style = MaterialTheme.typography.headlineSmall)
                Text("Custodian", color = Color(0xFFD8E4DC), style = MaterialTheme.typography.bodyLarge)
            }
            Column(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.72f)
                        .requiredHeightIn(min = 72.dp)
                        .clip(RoundedCornerShape(28.dp))
                        .background(Color.White.copy(alpha = 0.14f))
                        .semantics { contentDescription = "Slide up to unlock" }
                        .pointerInput(motionEnabled, screenHeightPx) {
                            awaitEachGesture {
                                val down = awaitFirstDown(requireUnconsumed = false)
                                val tracker = VelocityTracker()
                                tracker.addPosition(down.uptimeMillis, down.position)
                                var previousY = down.position.y
                                drag(down.id) { change ->
                                    tracker.addPosition(change.uptimeMillis, change.position)
                                    val delta = change.position.y - previousY
                                    previousY = change.position.y
                                    change.consume()
                                    offsetPx = (offsetPx + delta).coerceIn(-screenHeightPx, 0f)
                                }
                                settle(tracker.calculateVelocity().y)
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("↑  Slide up to unlock", color = Color.White, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(12.dp))
                TactileButton(label = "Unlock", onClick = onUnlock, modifier = Modifier.fillMaxWidth(0.72f))
            }
        }
    }
}
