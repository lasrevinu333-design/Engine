package org.memphiszoo.custodial.data

import androidx.room.withTransaction
import org.memphiszoo.custodial.domain.NotificationCadence
import org.memphiszoo.custodial.domain.NotificationEpisodeState
import org.memphiszoo.custodial.domain.NotificationQueueResult
import org.memphiszoo.custodial.domain.OperationalNotificationCategory
import org.memphiszoo.custodial.domain.OperationalNotificationEpisode
import org.memphiszoo.custodial.domain.PlaybackCommand
import org.memphiszoo.custodial.domain.PlaybackSignal

class NotificationJournal(private val database: CustodialDatabase) {
    private val dao = database.notificationDao()

    private suspend fun nextSequence(): Long {
        val current = dao.sequence() ?: NotificationSequenceEntity(nextSequence = 1)
        dao.putSequence(current.copy(nextSequence = current.nextSequence + 1))
        return current.nextSequence
    }

    suspend fun enqueue(episode: OperationalNotificationEpisode, wallEpochMs: Long): NotificationQueueResult =
        database.withTransaction {
            val existing = dao.episode(episode.episodeId)
            if (existing != null) {
                return@withTransaction if (existing.toDomain() == episode) {
                    NotificationQueueResult.Accepted(replayed = true)
                } else {
                    NotificationQueueResult.Rejected("Episode ID already exists with different bytes or routing")
                }
            }
            dao.insertEpisode(
                NotificationEpisodeEntity(
                    episodeId = episode.episodeId,
                    category = episode.category.name,
                    recipientPositionId = episode.recipientPositionId,
                    assignmentEpoch = episode.assignmentEpoch,
                    fullSpokenMessage = episode.fullSpokenMessage,
                    payloadSha256 = episode.payloadSha256,
                    queueSequence = nextSequence(),
                    state = NotificationEpisodeState.QUEUED.name,
                    nextSignalIndex = 0,
                    createdWallEpochMs = wallEpochMs,
                    completedWallEpochMs = null,
                ),
            )
            NotificationQueueResult.Accepted(replayed = false)
        }

    suspend fun nextCommand(): PlaybackCommand? = database.withTransaction {
        var episode = dao.nextPending() ?: return@withTransaction null
        if (episode.nextSignalIndex !in NotificationCadence.exactSignals.indices) return@withTransaction null
        if (episode.state == NotificationEpisodeState.QUEUED.name) {
            if (dao.markPlaying(episode.episodeId, episode.nextSignalIndex) != 1) return@withTransaction null
            episode = requireNotNull(dao.episode(episode.episodeId))
        }
        if (episode.state != NotificationEpisodeState.PLAYING.name) return@withTransaction null
        val signal = NotificationCadence.exactSignals[episode.nextSignalIndex]
        PlaybackCommand(
            episodeId = episode.episodeId,
            signalIndex = episode.nextSignalIndex,
            signal = signal,
            spokenMessage = episode.fullSpokenMessage.takeIf { signal == PlaybackSignal.FULL_SPOKEN_MESSAGE },
        )
    }

    suspend fun acknowledge(command: PlaybackCommand, wallEpochMs: Long): Boolean = database.withTransaction {
        val nextIndex = command.signalIndex + 1
        val completed = nextIndex == NotificationCadence.exactSignals.size
        dao.advance(
            episodeId = command.episodeId,
            expectedSignalIndex = command.signalIndex,
            nextSignalIndex = nextIndex,
            nextState = if (completed) NotificationEpisodeState.COMPLETED.name else NotificationEpisodeState.PLAYING.name,
            completedWallEpochMs = wallEpochMs.takeIf { completed },
        ) == 1
    }

    suspend fun rerouteBeforePlayback(episodeId: String, recipientPositionId: String, assignmentEpoch: Long): Boolean =
        database.withTransaction { dao.rerouteBeforePlayback(episodeId, recipientPositionId, assignmentEpoch) == 1 }

    suspend fun cancelBeforePlayback(episodeId: String, wallEpochMs: Long): Boolean =
        database.withTransaction { dao.cancelBeforePlayback(episodeId, wallEpochMs) == 1 }

    suspend fun episode(episodeId: String): NotificationEpisodeEntity? = dao.episode(episodeId)
    suspend fun pendingCount(): Int = dao.pendingCount()

    private fun NotificationEpisodeEntity.toDomain(): OperationalNotificationEpisode = OperationalNotificationEpisode(
        episodeId = episodeId,
        category = OperationalNotificationCategory.valueOf(category),
        recipientPositionId = recipientPositionId,
        assignmentEpoch = assignmentEpoch,
        fullSpokenMessage = fullSpokenMessage,
        payloadSha256 = payloadSha256,
    )
}
