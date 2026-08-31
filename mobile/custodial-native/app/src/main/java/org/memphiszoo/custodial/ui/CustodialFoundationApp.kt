package org.memphiszoo.custodial.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay
import org.memphiszoo.custodial.domain.CleaningScreenState
import org.memphiszoo.custodial.domain.CustodialAppState
import org.memphiszoo.custodial.domain.PlainLanguage

@Composable
fun CustodialFoundationApp(
    state: CustodialAppState,
    onUnlock: () -> Unit,
    onStartCleaning: () -> Unit,
    onFinishCleaning: () -> Unit,
    onFinishNoteChanged: (String) -> Unit,
    onNotNow: () -> Unit,
    onNeedHelp: () -> Unit,
    onTryAgain: () -> Unit,
    onDismissNotice: () -> Unit,
) {
    FoundationTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            if (!state.unlocked) {
                SlideUpLockScreen(
                    employeeName = state.identity?.fullName ?: "Custodial Phone",
                    timeText = rememberCurrentTime(),
                    onUnlock = onUnlock,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                EmployeeFoundationScreen(
                    state = state,
                    onStartCleaning = onStartCleaning,
                    onFinishCleaning = onFinishCleaning,
                    onFinishNoteChanged = onFinishNoteChanged,
                    onNotNow = onNotNow,
                    onNeedHelp = onNeedHelp,
                    onTryAgain = onTryAgain,
                    onDismissNotice = onDismissNotice,
                )
            }
        }
    }
}

@Composable
private fun rememberCurrentTime(): String {
    val formatter = remember { DateTimeFormatter.ofPattern("h:mm") }
    var value by remember { mutableStateOf(LocalTime.now().format(formatter)) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000)
            val current = LocalTime.now().format(formatter)
            if (current != value) value = current
        }
    }
    return value
}

@Composable
private fun EmployeeFoundationScreen(
    state: CustodialAppState,
    onStartCleaning: () -> Unit,
    onFinishCleaning: () -> Unit,
    onFinishNoteChanged: (String) -> Unit,
    onNotNow: () -> Unit,
    onNeedHelp: () -> Unit,
    onTryAgain: () -> Unit,
    onDismissNotice: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Memphis Zoo Custodial", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        state.identity?.let { identity ->
            Text(identity.fullName, style = MaterialTheme.typography.titleLarge)
            Text(identity.role, style = MaterialTheme.typography.bodyLarge)
        }

        state.notice?.let { notice ->
            NoticeCard(notice, onDismissNotice)
        }

        PlainLanguage.delivery(state.deliveryState)?.let { message ->
            StatusCard(
                message = message,
                supporting = if (state.pendingOperationCount > 0) {
                    "${state.pendingOperationCount} saved ${if (state.pendingOperationCount == 1) "update" else "updates"} waiting to send."
                } else null,
            )
        }

        state.attentionWork?.let { attention ->
            StatusCard(
                message = "Manager help is needed for ${attention.locationName}.",
                supporting = "That cleaning is saved. You can continue other assigned work.",
                emphasized = true,
            )
        }

        when (val screen = state.screen) {
            CleaningScreenState.SetupRequired -> SetupRequiredScreen()
            CleaningScreenState.Ready -> ReadyScreen()
            is CleaningScreenState.LocationConfirmed -> LocationConfirmedScreen(
                locationName = screen.assignment.locationName,
                busy = state.busy,
                onStartCleaning = onStartCleaning,
                onNotNow = onNotNow,
            )
            is CleaningScreenState.SavingStart -> SavingScreen("Saving ${screen.locationName} on this phone…")
            is CleaningScreenState.Active -> ActiveCleaningScreen(
                locationName = screen.work.locationName,
                busy = state.busy,
                onNeedHelp = onNeedHelp,
            )
            is CleaningScreenState.FinishReady -> FinishCleaningScreen(
                locationName = screen.work.locationName,
                note = screen.note,
                busy = state.busy,
                onNoteChanged = onFinishNoteChanged,
                onFinishCleaning = onFinishCleaning,
                onNotNow = onNotNow,
                onNeedHelp = onNeedHelp,
            )
            is CleaningScreenState.SavingFinish -> SavingScreen("Saving ${screen.locationName} on this phone…")
            is CleaningScreenState.SavedWaitingToSend -> SavedScreen(screen.locationName)
            is CleaningScreenState.NeedsManager -> StatusCard(
                message = screen.locationName?.let { "Manager help is needed for $it." } ?: "Manager help is needed.",
                supporting = "Your work is saved on this phone.",
                emphasized = true,
            )
            is CleaningScreenState.Error -> ErrorScreen(screen.message, screen.canRetry, onTryAgain)
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SetupRequiredScreen() {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Manager setup needed", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text("This phone is safe. Ask a manager to finish the employee assignment before starting work.")
        }
    }
}

@Composable
private fun ReadyScreen() {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Ready for work", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text("Tap this phone to the tag at your assigned location.")
        }
    }
}

@Composable
private fun LocationConfirmedScreen(
    locationName: String,
    busy: Boolean,
    onStartCleaning: () -> Unit,
    onNotNow: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(locationName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Start only when you are ready to clean this location.")
            TactileButton("Start Cleaning", onStartCleaning, busy = busy)
            TactileButton("Not now", onNotNow, enabled = !busy)
        }
    }
}

@Composable
private fun ActiveCleaningScreen(locationName: String, busy: Boolean, onNeedHelp: () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Cleaning now", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(locationName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("When finished, tap this phone to the same location tag again.")
            TactileButton("Need help", onNeedHelp, busy = busy)
        }
    }
}

@Composable
private fun FinishCleaningScreen(
    locationName: String,
    note: String,
    busy: Boolean,
    onNoteChanged: (String) -> Unit,
    onFinishCleaning: () -> Unit,
    onNotNow: () -> Unit,
    onNeedHelp: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Finish Cleaning", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(locationName, style = MaterialTheme.typography.headlineSmall)
            Text("Standard cleaning is already selected. Add a note only when useful.")
            OutlinedTextField(
                value = note,
                onValueChange = onNoteChanged,
                enabled = !busy,
                label = { Text("Optional note") },
                supportingText = { Text("${note.length}/500") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
            )
            TactileButton("Finish Cleaning", onFinishCleaning, busy = busy)
            TactileButton("Not now", onNotNow, enabled = !busy)
            TactileButton("Need help", onNeedHelp, enabled = !busy)
        }
    }
}

@Composable
private fun SavingScreen(message: String) {
    StatusCard(message = message, supporting = "Do not close the app until saving finishes.")
}

@Composable
private fun SavedScreen(locationName: String) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Cleaning saved", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(locationName)
            Text("You may continue to your next assigned location.")
        }
    }
}

@Composable
private fun ErrorScreen(message: String, canRetry: Boolean, onTryAgain: () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Could not continue", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(message)
            if (canRetry) TactileButton("Try again", onTryAgain)
        }
    }
}

@Composable
private fun NoticeCard(message: String, onDismiss: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 18.dp, top = 12.dp, bottom = 12.dp, end = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(message, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            TextButton(onClick = onDismiss) { Text("Dismiss") }
        }
    }
}

@Composable
private fun StatusCard(message: String, supporting: String? = null, emphasized: Boolean = false) {
    Card(
        Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        colors = if (emphasized) CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
        else CardDefaults.cardColors(),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(message, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            supporting?.let { Text(it) }
        }
    }
}
