package org.memphiszoo.custodial.domain

enum class OperationalNotificationCategory {
    DUE_SOON,
    OVERDUE,
    EVENT_REMINDER,
    SCHEDULE_0945_CHANGE,
    LUNCH_COVERAGE_START,
    LUNCH_COVERAGE_END,
    DIRECT_MESSAGE,
    MANAGER_REASSIGNMENT,
    EMERGENCY,
}

enum class PlaybackSignal { ALERT_TONE, FULL_SPOKEN_MESSAGE }

object NotificationCadence {
    val exactSignals: List<PlaybackSignal> = listOf(
        PlaybackSignal.ALERT_TONE,
        PlaybackSignal.FULL_SPOKEN_MESSAGE,
        PlaybackSignal.ALERT_TONE,
        PlaybackSignal.FULL_SPOKEN_MESSAGE,
    )
}

data class OperationalNotificationEpisode(
    val episodeId: String,
    val category: OperationalNotificationCategory,
    val recipientPositionId: String,
    val assignmentEpoch: Long,
    val fullSpokenMessage: String,
    val payloadSha256: String,
) {
    init {
        require(episodeId.isNotBlank())
        require(recipientPositionId.isNotBlank())
        require(assignmentEpoch >= 0)
        require(fullSpokenMessage.isNotBlank())
        require(payloadSha256.matches(Regex("[a-f0-9]{64}")))
    }
}

enum class NotificationEpisodeState { QUEUED, PLAYING, COMPLETED, CANCELLED }

data class NotificationEpisodeRecord(
    val episode: OperationalNotificationEpisode,
    val state: NotificationEpisodeState = NotificationEpisodeState.QUEUED,
    val nextSignalIndex: Int = 0,
)

data class PlaybackCommand(
    val episodeId: String,
    val signalIndex: Int,
    val signal: PlaybackSignal,
    val spokenMessage: String?,
)

sealed interface NotificationQueueResult {
    data class Accepted(val replayed: Boolean) : NotificationQueueResult
    data class Rejected(val reason: String) : NotificationQueueResult
}

/** Pure deterministic queue used by the Android audio/TTS adapter. */
class NotificationEpisodeQueue {
    private val records = linkedMapOf<String, NotificationEpisodeRecord>()

    fun enqueue(episode: OperationalNotificationEpisode): NotificationQueueResult {
        val existing = records[episode.episodeId]
        if (existing != null) {
            return if (existing.episode.payloadSha256 == episode.payloadSha256 && existing.episode == episode) {
                NotificationQueueResult.Accepted(replayed = true)
            } else {
                NotificationQueueResult.Rejected("Episode ID already exists with different bytes or routing")
            }
        }
        records[episode.episodeId] = NotificationEpisodeRecord(episode)
        return NotificationQueueResult.Accepted(replayed = false)
    }

    /** A stale undelivered recipient may be replaced before playback begins. */
    fun rerouteBeforePlayback(episodeId: String, recipientPositionId: String, assignmentEpoch: Long): Boolean {
        val record = records[episodeId] ?: return false
        if (record.state != NotificationEpisodeState.QUEUED || record.nextSignalIndex != 0) return false
        records[episodeId] = record.copy(
            episode = record.episode.copy(
                recipientPositionId = recipientPositionId,
                assignmentEpoch = assignmentEpoch,
            ),
        )
        return true
    }

    fun cancelBeforePlayback(episodeId: String): Boolean {
        val record = records[episodeId] ?: return false
        if (record.state != NotificationEpisodeState.QUEUED || record.nextSignalIndex != 0) return false
        records[episodeId] = record.copy(state = NotificationEpisodeState.CANCELLED)
        return true
    }

    /** Returns only the head episode, so two voices can never overlap. */
    fun nextCommand(): PlaybackCommand? {
        val entry = records.entries.firstOrNull {
            it.value.state == NotificationEpisodeState.QUEUED || it.value.state == NotificationEpisodeState.PLAYING
        } ?: return null
        val record = entry.value
        if (record.nextSignalIndex >= NotificationCadence.exactSignals.size) return null
        val signal = NotificationCadence.exactSignals[record.nextSignalIndex]
        if (record.state == NotificationEpisodeState.QUEUED) {
            records[entry.key] = record.copy(state = NotificationEpisodeState.PLAYING)
        }
        return PlaybackCommand(
            episodeId = entry.key,
            signalIndex = record.nextSignalIndex,
            signal = signal,
            spokenMessage = record.episode.fullSpokenMessage.takeIf { signal == PlaybackSignal.FULL_SPOKEN_MESSAGE },
        )
    }

    /** Acknowledges exactly the command returned. Duplicate or stale callbacks do nothing. */
    fun acknowledge(command: PlaybackCommand): Boolean {
        val record = records[command.episodeId] ?: return false
        if (record.state != NotificationEpisodeState.PLAYING || record.nextSignalIndex != command.signalIndex) return false
        val nextIndex = record.nextSignalIndex + 1
        records[command.episodeId] = if (nextIndex == NotificationCadence.exactSignals.size) {
            record.copy(state = NotificationEpisodeState.COMPLETED, nextSignalIndex = nextIndex)
        } else {
            record.copy(nextSignalIndex = nextIndex)
        }
        return true
    }

    fun record(episodeId: String): NotificationEpisodeRecord? = records[episodeId]
    fun pendingCount(): Int = records.values.count {
        it.state == NotificationEpisodeState.QUEUED || it.state == NotificationEpisodeState.PLAYING
    }
}
