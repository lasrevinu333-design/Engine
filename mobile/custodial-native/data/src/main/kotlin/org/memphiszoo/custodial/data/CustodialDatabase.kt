package org.memphiszoo.custodial.data

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        DeviceStateEntity::class,
        BootSessionEntity::class,
        DeviceSequenceEntity::class,
        NfcFieldStateEntity::class,
        AssignmentSnapshotEntity::class,
        ScanDeliveryEntity::class,
        OperationEntity::class,
        WorkChainEntity::class,
        CurrentWorkPointerEntity::class,
        FinishDraftEntity::class,
        OutboxEntity::class,
        ReceiptEntity::class,
        OperationDiagnosticEntity::class,
        UiTransitionEntity::class,
        SupportCaseEntity::class,
        InboundResolutionEntity::class,
        NotificationSequenceEntity::class,
        NotificationEpisodeEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class CustodialDatabase : RoomDatabase() {
    abstract fun notificationDao(): NotificationDao
    abstract fun journalDao(): JournalDao
}
