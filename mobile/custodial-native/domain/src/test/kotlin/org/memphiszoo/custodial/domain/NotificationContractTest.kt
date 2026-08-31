package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationContractTest {
    private fun episode(id: String = "episode-1", hash: Char = 'a') = OperationalNotificationEpisode(
        episodeId = id,
        category = OperationalNotificationCategory.OVERDUE,
        recipientPositionId = "TAMMY",
        assignmentEpoch = 8,
        fullSpokenMessage = "Tammy, Teton Restrooms is overdue. Please handle it now.",
        payloadSha256 = hash.toString().repeat(64),
    )

    @Test fun exactCadenceIsAlertSpeechAlertIdenticalSpeechThenSilence() {
        val queue = NotificationEpisodeQueue()
        assertEquals(NotificationQueueResult.Accepted(false), queue.enqueue(episode()))
        val commands = buildList {
            repeat(4) {
                val command = requireNotNull(queue.nextCommand())
                add(command)
                assertTrue(queue.acknowledge(command))
                assertFalse(queue.acknowledge(command))
            }
        }
        assertEquals(NotificationCadence.exactSignals, commands.map { it.signal })
        assertEquals(
            listOf(null, episode().fullSpokenMessage, null, episode().fullSpokenMessage),
            commands.map { it.spokenMessage },
        )
        assertNull(queue.nextCommand())
        assertEquals(NotificationEpisodeState.COMPLETED, queue.record("episode-1")?.state)
        assertEquals(0, queue.pendingCount())
    }

    @Test fun exactDuplicateIsReplayButChangedPayloadWithSameIdIsRejected() {
        val queue = NotificationEpisodeQueue()
        assertEquals(NotificationQueueResult.Accepted(false), queue.enqueue(episode()))
        assertEquals(NotificationQueueResult.Accepted(true), queue.enqueue(episode()))
        assertTrue(queue.enqueue(episode(hash = 'b')) is NotificationQueueResult.Rejected)
        assertEquals(1, queue.pendingCount())
    }

    @Test fun staleRecipientCanRerouteOnlyBeforePlayback() {
        val queue = NotificationEpisodeQueue()
        queue.enqueue(episode())
        assertTrue(queue.rerouteBeforePlayback("episode-1", "KAREN", 9))
        assertEquals("KAREN", queue.record("episode-1")?.episode?.recipientPositionId)
        val first = requireNotNull(queue.nextCommand())
        assertFalse(queue.rerouteBeforePlayback("episode-1", "MAURICE", 10))
        assertEquals("KAREN", queue.record("episode-1")?.episode?.recipientPositionId)
        assertTrue(queue.acknowledge(first))
    }

    @Test fun fifoPreventsOverlappingEpisodes() {
        val queue = NotificationEpisodeQueue()
        queue.enqueue(episode("first"))
        queue.enqueue(episode("second", 'b'))
        repeat(4) {
            val command = requireNotNull(queue.nextCommand())
            assertEquals("first", command.episodeId)
            queue.acknowledge(command)
        }
        assertEquals("second", queue.nextCommand()?.episodeId)
    }
}
