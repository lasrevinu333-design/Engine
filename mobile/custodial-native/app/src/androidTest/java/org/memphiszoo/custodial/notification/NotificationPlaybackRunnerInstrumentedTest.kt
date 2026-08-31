package org.memphiszoo.custodial.notification

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.memphiszoo.custodial.data.CustodialDatabase
import org.memphiszoo.custodial.data.NotificationJournal
import org.memphiszoo.custodial.domain.OperationalNotificationCategory
import org.memphiszoo.custodial.domain.OperationalNotificationEpisode
import org.memphiszoo.custodial.domain.PlaybackCommand
import org.memphiszoo.custodial.domain.PlaybackSignal

@RunWith(AndroidJUnit4::class)
class NotificationPlaybackRunnerInstrumentedTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var database: CustodialDatabase
    private lateinit var journal: NotificationJournal

    @Before fun setUp() {
        database = Room.inMemoryDatabaseBuilder(context, CustodialDatabase::class.java).allowMainThreadQueries().build()
        journal = NotificationJournal(database)
    }
    @After fun tearDown() = database.close()

    @Test fun drainsExactTwoCycleSequenceAndStops() = runBlocking {
        journal.enqueue(episode("one", 'a'), 1)
        val played = mutableListOf<PlaybackCommand>()
        val runner = NotificationPlaybackRunner(journal, NotificationAudioOutput { played += it }, { 100 })
        val result = runner.drain()
        assertEquals(listOf(PlaybackSignal.ALERT_TONE, PlaybackSignal.FULL_SPOKEN_MESSAGE, PlaybackSignal.ALERT_TONE, PlaybackSignal.FULL_SPOKEN_MESSAGE), played.map { it.signal })
        assertEquals(4, result.signalsPlayed)
        assertEquals(1, result.completedEpisodes)
        assertFalse(result.retryRequired)
        assertEquals(0, journal.pendingCount())
    }

    @Test fun concurrentDrainsAreSerializedAndNeverOverlapEpisodes() = runBlocking {
        journal.enqueue(episode("one", 'a'), 1)
        journal.enqueue(episode("two", 'b'), 2)
        val played = mutableListOf<PlaybackCommand>()
        val runner = NotificationPlaybackRunner(journal, NotificationAudioOutput { command -> synchronized(played) { played += command } }, { 100 })
        coroutineScope { listOf(async { runner.drain() }, async { runner.drain() }).awaitAll() }
        assertEquals(8, played.size)
        assertEquals(listOf("one", "one", "one", "one", "two", "two", "two", "two"), played.map { it.episodeId })
        assertEquals(0, journal.pendingCount())
    }

    @Test fun failedAudioLeavesDurableStepForAControlledRetry() = runBlocking {
        journal.enqueue(episode("one", 'a'), 1)
        var first = true
        val failing = NotificationPlaybackRunner(journal, NotificationAudioOutput {
            if (first) { first = false; error("speaker unavailable") }
        }, { 100 })
        val failed = failing.drain()
        assertTrue(failed.retryRequired)
        assertEquals(0, failed.signalsPlayed)
        assertEquals(1, journal.pendingCount())

        val played = mutableListOf<PlaybackCommand>()
        val recovered = NotificationPlaybackRunner(journal, NotificationAudioOutput { played += it }, { 200 }).drain()
        assertFalse(recovered.retryRequired)
        assertEquals(4, played.size)
    }

    private fun episode(id: String, hash: Char) = OperationalNotificationEpisode(
        episodeId = id,
        category = OperationalNotificationCategory.OVERDUE,
        recipientPositionId = "TAMMY",
        assignmentEpoch = 8,
        fullSpokenMessage = "Tammy, Teton Restrooms is overdue. Please handle it now.",
        payloadSha256 = hash.toString().repeat(64),
    )
}
