package org.memphiszoo.custodial.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "notification_sequence")
data class NotificationSequenceEntity(
    @PrimaryKey val singletonId: Int = 1,
    val nextSequence: Long,
)

@Entity(
    tableName = "notification_episodes",
    indices = [
        Index(value = ["queueSequence"], unique = true),
        Index(value = ["state", "queueSequence"]),
        Index(value = ["recipientPositionId", "assignmentEpoch"]),
    ],
)
data class NotificationEpisodeEntity(
    @PrimaryKey val episodeId: String,
    val category: String,
    val recipientPositionId: String,
    val assignmentEpoch: Long,
    val fullSpokenMessage: String,
    val payloadSha256: String,
    val queueSequence: Long,
    val state: String,
    val nextSignalIndex: Int,
    val createdWallEpochMs: Long,
    val completedWallEpochMs: Long?,
)
