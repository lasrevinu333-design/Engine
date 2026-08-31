package org.memphiszoo.custodial.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface NotificationDao {
    @Query("SELECT * FROM notification_sequence WHERE singletonId = 1")
    suspend fun sequence(): NotificationSequenceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putSequence(value: NotificationSequenceEntity)

    @Insert
    suspend fun insertEpisode(value: NotificationEpisodeEntity)

    @Query("SELECT * FROM notification_episodes WHERE episodeId = :episodeId")
    suspend fun episode(episodeId: String): NotificationEpisodeEntity?

    @Query("""
        SELECT * FROM notification_episodes
        WHERE state IN ('QUEUED','PLAYING')
        ORDER BY queueSequence ASC
        LIMIT 1
    """)
    suspend fun nextPending(): NotificationEpisodeEntity?

    @Query("""
        UPDATE notification_episodes
        SET state = 'PLAYING'
        WHERE episodeId = :episodeId
          AND state = 'QUEUED'
          AND nextSignalIndex = :expectedSignalIndex
    """)
    suspend fun markPlaying(episodeId: String, expectedSignalIndex: Int): Int

    @Query("""
        UPDATE notification_episodes
        SET nextSignalIndex = :nextSignalIndex,
            state = :nextState,
            completedWallEpochMs = :completedWallEpochMs
        WHERE episodeId = :episodeId
          AND state = 'PLAYING'
          AND nextSignalIndex = :expectedSignalIndex
    """)
    suspend fun advance(
        episodeId: String,
        expectedSignalIndex: Int,
        nextSignalIndex: Int,
        nextState: String,
        completedWallEpochMs: Long?,
    ): Int

    @Query("""
        UPDATE notification_episodes
        SET recipientPositionId = :recipientPositionId,
            assignmentEpoch = :assignmentEpoch
        WHERE episodeId = :episodeId
          AND state = 'QUEUED'
          AND nextSignalIndex = 0
    """)
    suspend fun rerouteBeforePlayback(episodeId: String, recipientPositionId: String, assignmentEpoch: Long): Int

    @Query("""
        UPDATE notification_episodes
        SET state = 'CANCELLED', completedWallEpochMs = :wallEpochMs
        WHERE episodeId = :episodeId
          AND state = 'QUEUED'
          AND nextSignalIndex = 0
    """)
    suspend fun cancelBeforePlayback(episodeId: String, wallEpochMs: Long): Int

    @Query("SELECT COUNT(*) FROM notification_episodes WHERE state IN ('QUEUED','PLAYING')")
    suspend fun pendingCount(): Int
}
