package org.memphiszoo.custodial.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.memphiszoo.custodial.domain.NotificationCadence
import org.memphiszoo.custodial.domain.NotificationEpisodeState
import org.memphiszoo.custodial.domain.NotificationQueueResult
import org.memphiszoo.custodial.domain.OperationalNotificationCategory
import org.memphiszoo.custodial.domain.OperationalNotificationEpisode

@RunWith(AndroidJUnit4::class)
class NotificationJournalInstrumentedTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var database: CustodialDatabase
    private lateinit var journal: NotificationJournal

    @Before fun setUp() {
        database = Room.inMemoryDatabaseBuilder(context, CustodialDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        journal = NotificationJournal(database)
    }

    @After fun tearDown() = database.close()

    @Test fun exactCadencePersistsAndDoesNotReplayAfterCompletion() = runBlocking {
        assertEquals(NotificationQueueResult.Accepted(false), journal.enqueue(episode(), 100L))
        val signals = buildList {
            repeat(4) {
                val command = requireNotNull(journal.nextCommand())
                add(command.signal)
                assertTrue(journal.acknowledge(command, 200L + it))
                assertFalse(journal.acknowledge(command, 300L + it))
            }
        }
        assertEquals(NotificationCadence.exactSignals, signals)
        assertNull(journal.nextCommand())
        assertEquals(NotificationEpisodeState.COMPLETED.name, journal.episode("episode-1")?.state)
        assertEquals(0, journal.pendingCount())
    }

    @Test fun processRecreationContinuesAtNextUnplayedSignal() = runBlocking {
        journal.enqueue(episode(), 100L)
        val tone = requireNotNull(journal.nextCommand())
        assertTrue(journal.acknowledge(tone, 101L))

        val recreated = NotificationJournal(database)
        val speech = requireNotNull(recreated.nextCommand())
        assertEquals(1, speech.signalIndex)
        assertEquals(episode().fullSpokenMessage, speech.spokenMessage)
    }

    @Test fun rerouteOnlyBeforeFirstToneAndFifoBlocksOverlap() = runBlocking {
        journal.enqueue(episode("episode-1", 'a'), 100L)
        journal.enqueue(episode("episode-2", 'b'), 101L)
        assertTrue(journal.rerouteBeforePlayback("episode-1", "KAREN", 9))
        val first = requireNotNull(journal.nextCommand())
        assertEquals("episode-1", first.episodeId)
        assertFalse(journal.rerouteBeforePlayback("episode-1", "MAURICE", 10))
        assertEquals("KAREN", journal.episode("episode-1")?.recipientPositionId)
        assertEquals(2, journal.pendingCount())
    }

    private fun episode(id: String = "episode-1", hash: Char = 'a') = OperationalNotificationEpisode(
        episodeId = id,
        category = OperationalNotificationCategory.OVERDUE,
        recipientPositionId = "TAMMY",
        assignmentEpoch = 8,
        fullSpokenMessage = "Tammy, Teton Restrooms is overdue. Please handle it now.",
        payloadSha256 = hash.toString().repeat(64),
    )
}
