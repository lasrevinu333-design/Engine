package org.memphiszoo.custodial.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface JournalDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertDeviceState(value: DeviceStateEntity): Long
    @Query("SELECT * FROM device_state WHERE singletonId = 1") suspend fun deviceState(): DeviceStateEntity?
    @Query("SELECT * FROM device_state WHERE singletonId = 1") fun observeDeviceState(): Flow<DeviceStateEntity?>
    @Update suspend fun updateDeviceState(value: DeviceStateEntity): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertBootSession(value: BootSessionEntity): Long
    @Query("SELECT * FROM boot_sessions WHERE bootSessionId = :id") suspend fun bootSession(id: String): BootSessionEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertDeviceSequence(value: DeviceSequenceEntity): Long
    @Query("SELECT * FROM device_sequence WHERE singletonId = 1") suspend fun deviceSequence(): DeviceSequenceEntity?
    @Query("UPDATE device_sequence SET nextSequence = :next WHERE singletonId = 1 AND nextSequence = :expected")
    suspend fun advanceSequence(expected: Long, next: Long): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertNfcFieldState(value: NfcFieldStateEntity): Long
    @Update suspend fun updateNfcFieldState(value: NfcFieldStateEntity): Int
    @Query("SELECT * FROM nfc_field_state WHERE installationId = :installationId")
    suspend fun nfcFieldState(installationId: String): NfcFieldStateEntity?
    @Query("SELECT * FROM nfc_field_state WHERE installationId = :installationId")
    fun observeNfcFieldState(installationId: String): Flow<NfcFieldStateEntity?>

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertAssignmentSnapshot(value: AssignmentSnapshotEntity): Long
    @Query("SELECT * FROM assignment_snapshots WHERE snapshotId = :id") suspend fun assignmentSnapshot(id: String): AssignmentSnapshotEntity?
    @Query("""
        SELECT * FROM assignment_snapshots
        WHERE expectedTagPayloadHash = :payloadHash
          AND employeeId = :employeeId
          AND deviceInstallationId = :installationId
          AND state = 'ACTIVE'
        ORDER BY scheduleRevision DESC, datedExceptionRevision DESC, issuedAtEpochMs DESC
    """)
    suspend fun activeAssignmentsForTag(
        payloadHash: String,
        employeeId: String,
        installationId: String,
    ): List<AssignmentSnapshotEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertScanDelivery(value: ScanDeliveryEntity): Long
    @Query("SELECT * FROM scan_deliveries WHERE deliveryId = :id") suspend fun scanDelivery(id: String): ScanDeliveryEntity?
    @Query("""
        UPDATE scan_deliveries
        SET consumedOperationId = :operationId,
            outcomeCode = :outcomeCode,
            outcomePayloadDigest = :outcomePayloadDigest
        WHERE deliveryId = :deliveryId AND outcomeCode IS NULL
    """)
    suspend fun consumeScanDelivery(
        deliveryId: String,
        operationId: String?,
        outcomeCode: String,
        outcomePayloadDigest: String,
    ): Int

    @Insert suspend fun insertOperation(value: OperationEntity)
    @Query("SELECT * FROM operations WHERE operationId = :id") suspend fun operation(id: String): OperationEntity?
    @Query("UPDATE operations SET state = :state, lastFailureCode = :failure WHERE operationId = :id")
    suspend fun updateOperationState(id: String, state: String, failure: String?): Int
    @Query("SELECT COUNT(*) FROM operations") suspend fun operationCount(): Int

    @Insert suspend fun insertWorkChain(value: WorkChainEntity)
    @Query("SELECT * FROM work_chains WHERE startOperationId = :id") suspend fun workChain(id: String): WorkChainEntity?
    @Query("SELECT * FROM work_chains WHERE finishOperationId = :finishId") suspend fun workChainByFinish(finishId: String): WorkChainEntity?
    @Query("""
        UPDATE work_chains
        SET finishOperationId = :finishId,
            finishDraftId = :draftId,
            state = 'FINISHING',
            updatedSequence = :sequence,
            updatedAtWallEpochMs = :updatedAt
        WHERE startOperationId = :startId
          AND state = 'ACTIVE'
          AND finishOperationId IS NULL
    """)
    suspend fun markWorkChainFinishing(startId: String, finishId: String, draftId: String, sequence: Long, updatedAt: Long): Int
    @Query("""
        UPDATE work_chains
        SET state = 'COMPLETED', updatedAtWallEpochMs = :updatedAt
        WHERE finishOperationId = :finishId AND state NOT IN ('COMPLETED', 'CANCELLED')
    """)
    suspend fun completeWorkChainByFinish(finishId: String, updatedAt: Long): Int
    @Query("""
        UPDATE work_chains
        SET state = 'NEEDS_MANAGER', managerHelpCause = :cause, updatedAtWallEpochMs = :updatedAt
        WHERE finishOperationId = :finishId AND state NOT IN ('COMPLETED', 'CANCELLED')
    """)
    suspend fun markWorkChainConflict(finishId: String, cause: String, updatedAt: Long): Int
    @Query("""
        UPDATE work_chains
        SET state = 'NEEDS_MANAGER', managerHelpCause = :cause, updatedAtWallEpochMs = :updatedAt
        WHERE startOperationId = :startId AND state NOT IN ('COMPLETED', 'CANCELLED')
    """)
    suspend fun markWorkChainConflictByStart(startId: String, cause: String, updatedAt: Long): Int
    @Query("""
        UPDATE work_chains
        SET finishDraftId = :draftId, updatedSequence = :sequence, updatedAtWallEpochMs = :updatedAt
        WHERE startOperationId = :startId AND state = 'ACTIVE'
    """)
    suspend fun attachDraft(startId: String, draftId: String, sequence: Long, updatedAt: Long): Int

    @Insert suspend fun insertCurrentWorkPointer(value: CurrentWorkPointerEntity)
    @Query("SELECT * FROM current_work_pointer WHERE installationId = :installationId")
    suspend fun currentWorkPointer(installationId: String): CurrentWorkPointerEntity?
    @Query("""
        SELECT p.installationId AS installationId,
               c.startOperationId AS startOperationId,
               c.workOccurrenceId AS workOccurrenceId,
               c.attemptGeneration AS attemptGeneration,
               c.locationId AS locationId,
               c.locationNameSnapshot AS locationNameSnapshot,
               c.expectedTagPayloadHash AS expectedTagPayloadHash,
               c.state AS workState,
               c.finishOperationId AS finishOperationId,
               c.finishDraftId AS finishDraftId,
               f.note AS draftNote,
               f.state AS draftState
        FROM current_work_pointer p
        JOIN work_chains c ON c.startOperationId = p.startOperationId
        LEFT JOIN finish_drafts f ON f.startOperationId = c.startOperationId
        WHERE p.installationId = :installationId
        LIMIT 1
    """)
    suspend fun currentWorkProjection(installationId: String): CurrentWorkProjection?
    @Query("""
        SELECT p.installationId AS installationId,
               c.startOperationId AS startOperationId,
               c.workOccurrenceId AS workOccurrenceId,
               c.attemptGeneration AS attemptGeneration,
               c.locationId AS locationId,
               c.locationNameSnapshot AS locationNameSnapshot,
               c.expectedTagPayloadHash AS expectedTagPayloadHash,
               c.state AS workState,
               c.finishOperationId AS finishOperationId,
               c.finishDraftId AS finishDraftId,
               f.note AS draftNote,
               f.state AS draftState
        FROM current_work_pointer p
        JOIN work_chains c ON c.startOperationId = p.startOperationId
        LEFT JOIN finish_drafts f ON f.startOperationId = c.startOperationId
        WHERE p.installationId = :installationId
        LIMIT 1
    """)
    fun observeCurrentWorkProjection(installationId: String): Flow<CurrentWorkProjection?>
    @Query("""
        SELECT d.installationId AS installationId,
               c.startOperationId AS startOperationId,
               c.workOccurrenceId AS workOccurrenceId,
               c.attemptGeneration AS attemptGeneration,
               c.locationId AS locationId,
               c.locationNameSnapshot AS locationNameSnapshot,
               c.expectedTagPayloadHash AS expectedTagPayloadHash,
               c.state AS workState,
               c.finishOperationId AS finishOperationId,
               c.finishDraftId AS finishDraftId,
               f.note AS draftNote,
               f.state AS draftState
        FROM device_state d
        JOIN work_chains c ON c.deviceInstallationId = d.installationId
        LEFT JOIN finish_drafts f ON f.startOperationId = c.startOperationId
        WHERE d.singletonId = 1
          AND c.state IN ('FINISHING', 'NEEDS_MANAGER', 'READY_TO_RESUME')
        ORDER BY c.updatedSequence DESC
        LIMIT 1
    """)
    suspend fun latestUnsettledWorkProjection(): CurrentWorkProjection?
    @Query("""
        SELECT d.installationId AS installationId,
               c.startOperationId AS startOperationId,
               c.workOccurrenceId AS workOccurrenceId,
               c.attemptGeneration AS attemptGeneration,
               c.locationId AS locationId,
               c.locationNameSnapshot AS locationNameSnapshot,
               c.expectedTagPayloadHash AS expectedTagPayloadHash,
               c.state AS workState,
               c.finishOperationId AS finishOperationId,
               c.finishDraftId AS finishDraftId,
               f.note AS draftNote,
               f.state AS draftState
        FROM device_state d
        JOIN work_chains c ON c.deviceInstallationId = d.installationId
        LEFT JOIN finish_drafts f ON f.startOperationId = c.startOperationId
        WHERE d.singletonId = 1
          AND c.state IN ('FINISHING', 'NEEDS_MANAGER', 'READY_TO_RESUME')
        ORDER BY c.updatedSequence DESC
        LIMIT 1
    """)
    fun observeLatestUnsettledWorkProjection(): Flow<CurrentWorkProjection?>
    @Query("DELETE FROM current_work_pointer WHERE installationId = :installationId AND startOperationId = :startId")
    suspend fun deleteCurrentWorkPointer(installationId: String, startId: String): Int
    @Query("SELECT COUNT(*) FROM current_work_pointer") suspend fun currentWorkPointerCount(): Int
    @Query("""
        UPDATE work_chains
        SET state = 'ACTIVE', managerHelpCause = NULL, updatedSequence = :sequence, updatedAtWallEpochMs = :updatedAt
        WHERE startOperationId = :startId AND state = 'READY_TO_RESUME'
    """)
    suspend fun markWorkChainResumed(startId: String, sequence: Long, updatedAt: Long): Int
    @Query("""
        UPDATE work_chains
        SET state = 'NEEDS_MANAGER', managerHelpCause = :cause,
            resolutionGeneration = resolutionGeneration + 1,
            updatedSequence = :sequence, updatedAtWallEpochMs = :updatedAt
        WHERE startOperationId = :startId AND state = 'ACTIVE'
    """)
    suspend fun markWorkChainNeedsManager(startId: String, cause: String, sequence: Long, updatedAt: Long): Int

    @Upsert suspend fun upsertFinishDraft(value: FinishDraftEntity)
    @Query("SELECT * FROM finish_drafts WHERE startOperationId = :startId") suspend fun finishDraftForStart(startId: String): FinishDraftEntity?
    @Query("UPDATE finish_drafts SET state = :state, updatedAtWallEpochMs = :updatedAt WHERE startOperationId = :startId")
    suspend fun updateFinishDraftState(startId: String, state: String, updatedAt: Long): Int

    @Insert suspend fun insertOutbox(value: OutboxEntity)
    @Query("SELECT * FROM outbox WHERE operationId = :id") suspend fun outbox(id: String): OutboxEntity?
    @Query("UPDATE outbox SET deliveryState = :state, leaseOwner = NULL, leaseBootSessionId = NULL, leaseAcquiredElapsedMs = NULL, leaseDurationMs = NULL, updatedAtWallEpochMs = :updatedAt WHERE operationId = :id")
    suspend fun updateOutboxState(id: String, state: String, updatedAt: Long): Int
    @Query("""
        SELECT o.operationId FROM operations o
        JOIN outbox x ON x.operationId = o.operationId
        WHERE o.operationType = 'FINISH'
          AND x.deliveryState NOT IN ('ACKNOWLEDGED', 'QUARANTINED')
        ORDER BY o.localSequence DESC
        LIMIT 1
    """)
    suspend fun latestUnsettledFinishOperationId(): String?
    @Query("""
        SELECT x.operationId FROM outbox x
        WHERE (
            (
                x.deliveryState IN ('PENDING', 'AMBIGUOUS')
                AND (
                    x.lastAttemptElapsedMs IS NULL
                    OR x.lastAttemptBootSessionId IS NULL
                    OR x.lastAttemptBootSessionId != :bootSessionId
                    OR (x.lastAttemptElapsedMs + x.retryDelayMs) <= :elapsedMs
                )
            )
            OR (
                x.deliveryState = 'LEASED'
                AND (
                    x.leaseBootSessionId IS NULL
                    OR x.leaseBootSessionId != :bootSessionId
                    OR (x.leaseAcquiredElapsedMs + x.leaseDurationMs) <= :elapsedMs
                )
            )
        )
          AND (x.dependencyOperationId IS NULL OR EXISTS (SELECT 1 FROM receipts d WHERE d.operationId = x.dependencyOperationId))
          AND (x.barrierOperationId IS NULL OR EXISTS (SELECT 1 FROM receipts b WHERE b.operationId = x.barrierOperationId) OR EXISTS (SELECT 1 FROM outbox bx WHERE bx.operationId = x.barrierOperationId AND bx.deliveryState IN ('BLOCKED', 'QUARANTINED')))
        ORDER BY x.localSequence
        LIMIT 1
    """)
    suspend fun nextRunnableOperationId(bootSessionId: String, elapsedMs: Long): String?
    @Query("""
        UPDATE outbox
        SET deliveryState = 'LEASED',
            attempts = attempts + 1,
            leaseOwner = :owner,
            leaseGeneration = leaseGeneration + 1,
            leaseBootSessionId = :bootSessionId,
            leaseAcquiredElapsedMs = :elapsedMs,
            leaseDurationMs = :durationMs,
            lastAttemptBootSessionId = :bootSessionId,
            lastAttemptElapsedMs = :elapsedMs,
            updatedAtWallEpochMs = :updatedAt
        WHERE operationId = :operationId
          AND (
            deliveryState IN ('PENDING', 'AMBIGUOUS')
            OR (
                deliveryState = 'LEASED'
                AND (
                    leaseBootSessionId IS NULL
                    OR leaseBootSessionId != :bootSessionId
                    OR (leaseAcquiredElapsedMs + leaseDurationMs) <= :elapsedMs
                )
            )
          )
          AND EXISTS (
            SELECT 1 FROM device_state d
            WHERE d.singletonId = 1
              AND d.legacyCutoverState = 'COMPLETE'
              AND d.leaseAdmissionState = 'OPEN'
              AND d.leaseAdmissionGeneration = :expectedLeaseGeneration
          )
    """)
    suspend fun leaseOperation(
        operationId: String,
        owner: String,
        bootSessionId: String,
        elapsedMs: Long,
        durationMs: Long,
        updatedAt: Long,
        expectedLeaseGeneration: Long,
    ): Int
    @Query("""
        UPDATE outbox
        SET deliveryState = :newState,
            retryDelayMs = :retryDelayMs,
            nextReconciliationKind = :nextReconciliationKind,
            leaseOwner = NULL,
            leaseBootSessionId = NULL,
            leaseAcquiredElapsedMs = NULL,
            leaseDurationMs = NULL,
            updatedAtWallEpochMs = :updatedAt
        WHERE operationId = :operationId
          AND deliveryState = 'LEASED'
          AND leaseOwner = :owner
          AND leaseGeneration = :generation
    """)
    suspend fun applyLeaseFailure(
        operationId: String,
        owner: String,
        generation: Long,
        newState: String,
        retryDelayMs: Long,
        nextReconciliationKind: String,
        updatedAt: Long,
    ): Int

    @Query("""
        UPDATE operations
        SET state = 'LEASED'
        WHERE operationId = :operationId
          AND state IN ('PENDING', 'AMBIGUOUS', 'LEASED')
    """)
    suspend fun markOperationLeased(operationId: String): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertReceipt(value: ReceiptEntity): Long
    @Query("SELECT * FROM receipts WHERE operationId = :id") suspend fun receipt(id: String): ReceiptEntity?

    @Insert suspend fun insertDiagnostic(value: OperationDiagnosticEntity)
    @Query("SELECT * FROM operation_diagnostics WHERE operationId = :operationId ORDER BY observedAtEpochMs")
    suspend fun diagnostics(operationId: String): List<OperationDiagnosticEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertUiTransition(value: UiTransitionEntity): Long
    @Query("SELECT * FROM ui_transitions ORDER BY createdAtEpochMs, transitionId") suspend fun uiTransitions(): List<UiTransitionEntity>
    @Query("SELECT * FROM ui_transitions WHERE announcedAtEpochMs IS NULL ORDER BY createdAtEpochMs, transitionId LIMIT 1")
    suspend fun nextUnannouncedUiTransition(): UiTransitionEntity?
    @Query("UPDATE ui_transitions SET announcedAtEpochMs = :announcedAt WHERE transitionId = :transitionId AND announcedAtEpochMs IS NULL")
    suspend fun markUiTransitionAnnounced(transitionId: String, announcedAt: Long): Int

    @Query("SELECT COUNT(*) FROM outbox WHERE deliveryState IN ('PENDING','LEASED','AMBIGUOUS','HELD_FOR_CUTOVER')")
    suspend fun pendingOperationCount(): Int
    @Query("SELECT COUNT(*) FROM outbox WHERE deliveryState IN ('PENDING','LEASED','AMBIGUOUS','HELD_FOR_CUTOVER')")
    fun observePendingOperationCount(): Flow<Int>

    @Query("""
        SELECT s.* FROM nfc_field_state f
        JOIN scan_deliveries s ON s.deliveryId = f.acceptedDeliveryId
        WHERE f.installationId = :installationId
          AND f.state IN ('ACCEPTED_WAITING_FOR_ABSENCE','RECOVERY_ABSENCE_PROBE')
          AND s.outcomeCode IS NULL
        LIMIT 1
    """)
    suspend fun pendingScanDelivery(installationId: String): ScanDeliveryEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertSupportCase(value: SupportCaseEntity): Long
    @Query("SELECT * FROM support_cases WHERE startOperationId = :startId AND resolutionGeneration = :generation")
    suspend fun supportCase(startId: String, generation: Long): SupportCaseEntity?
}
