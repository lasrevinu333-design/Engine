package org.memphiszoo.custodial.notification

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.memphiszoo.custodial.data.NotificationJournal

data class NotificationDrainResult(
    val signalsPlayed: Int,
    val completedEpisodes: Int,
    val retryRequired: Boolean,
    val failureMessage: String?,
)

/**
 * Single-flight Room-backed playback. A second caller waits; it cannot overlap audio.
 * A failed signal remains at the same durable step and is retried by the next scheduled drain.
 */
class NotificationPlaybackRunner(
    private val journal: NotificationJournal,
    private val output: NotificationAudioOutput,
    private val wallClockMillis: () -> Long = System::currentTimeMillis,
) {
    private val singleFlight = Mutex()

    suspend fun drain(maxSignals: Int = 64): NotificationDrainResult = singleFlight.withLock {
        require(maxSignals > 0)
        var signals = 0
        var completed = 0
        while (signals < maxSignals) {
            val command = journal.nextCommand() ?: break
            try {
                output.play(command)
            } catch (error: Throwable) {
                return@withLock NotificationDrainResult(
                    signalsPlayed = signals,
                    completedEpisodes = completed,
                    retryRequired = true,
                    failureMessage = error.message ?: error::class.java.simpleName,
                )
            }
            if (!journal.acknowledge(command, wallClockMillis())) {
                return@withLock NotificationDrainResult(
                    signalsPlayed = signals,
                    completedEpisodes = completed,
                    retryRequired = true,
                    failureMessage = "Notification playback acknowledgement was stale",
                )
            }
            signals += 1
            if (command.signalIndex == 3) completed += 1
        }
        NotificationDrainResult(signals, completed, retryRequired = journal.pendingCount() > 0, failureMessage = null)
    }
}
