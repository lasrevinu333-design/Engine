package org.memphiszoo.custodial.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.memphiszoo.custodial.domain.AttendanceCard
import org.memphiszoo.custodial.domain.EmployeeHomeSnapshot
import org.memphiszoo.custodial.domain.Freshness
import org.memphiszoo.custodial.domain.HomeCapability
import org.memphiszoo.custodial.domain.HourlyWeatherCard

@Composable
fun EmployeeHomeScreen(
    state: EmployeeHomeSnapshot,
    onSchedule: () -> Unit,
    onMessages: () -> Unit,
    onEvents: () -> Unit,
    onFeedback: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        state.activeCleaning?.let { active ->
            Surface(
                color = Color(0xFFDDEDDD),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth().testTag("active-cleaning"),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Cleaning now", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text(active.locationName, style = MaterialTheme.typography.headlineSmall)
                    Text("Started ${active.startedAtText}", style = MaterialTheme.typography.bodyLarge)
                    Text("Tap the same tag when you are done.", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                state.employeeName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() },
            )
            Text(state.title, style = MaterialTheme.typography.titleMedium)
            Text(state.workDaysText, style = MaterialTheme.typography.bodyLarge)
            Text(state.shiftSummary, style = MaterialTheme.typography.bodyLarge)
        }

        StatusCard(title = "Zoo attendance", testTag = "attendance-card") {
            AttendanceContent(state.attendance)
        }
        StatusCard(title = "Weather", testTag = "weather-card") {
            WeatherContent(state.weather)
        }

        Text("What do you need?", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        HomeActionButton("Schedule", HomeCapability.SCHEDULE in state.capabilities, onSchedule)
        HomeActionButton("Messages", HomeCapability.MESSAGES in state.capabilities, onMessages)
        HomeActionButton("Events", HomeCapability.EVENTS in state.capabilities, onEvents)
        HomeActionButton("Feedback", HomeCapability.FEEDBACK in state.capabilities, onFeedback)
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun StatusCard(title: String, testTag: String, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        tonalElevation = 2.dp,
        modifier = Modifier.fillMaxWidth().testTag(testTag),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
private fun AttendanceContent(card: AttendanceCard) {
    val value = card.currentAttendance?.toString() ?: "Not available"
    Text(value, style = MaterialTheme.typography.headlineSmall)
    FreshnessLine(card.freshness, card.observedAtText)
}

@Composable
private fun WeatherContent(card: HourlyWeatherCard) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(card.currentTemperatureText ?: "Not available", style = MaterialTheme.typography.headlineSmall)
        card.conditionText?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
    }
    card.hourlySummary.forEach { Text(it, style = MaterialTheme.typography.bodyLarge) }
    FreshnessLine(card.freshness, card.observedAtText)
}

@Composable
private fun FreshnessLine(freshness: Freshness, observedAtText: String?) {
    val text = when (freshness) {
        Freshness.FRESH -> observedAtText?.let { "Updated $it" } ?: "Current"
        Freshness.STALE -> observedAtText?.let { "Last updated $it" } ?: "Last saved information"
        Freshness.UNAVAILABLE -> "Not available right now"
    }
    Text(text, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun HomeActionButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    if (!enabled) return
    TactileButton(label = label, onClick = onClick, modifier = Modifier.testTag("home-${label.lowercase()}"))
}
