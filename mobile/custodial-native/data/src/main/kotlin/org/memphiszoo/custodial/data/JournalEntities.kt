package org.memphiszoo.custodial.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "device_state")
data class DeviceStateEntity(
    @PrimaryKey val singletonId: Int = 1,
    val installationId: String,
    val originalInstallationNamespaceId: String,
    val enrolledDeviceIdentifier: String,
    val employeeId: String,
    val employeeNameSnapshot: String,
    val assignmentEpoch: Long,
    val activeAttributionCredentialEpoch: Long,
    val creationEpoch: Long,
    val activeCredentialSlotDigest: String?,
    val operationCreationFenceState: String,
    val operationCreationFenceGeneration: Long,
    val leaseAdmissionState: String,
    val leaseAdmissionGeneration: Long,
    val legacyCutoverState: String,
    val legacyCutoverGeneration: Long,
    val currentBootSessionId: String,
    val inboundResolutionCursor: Long,
    val trustedTimeState: String,
    val updatedAtWallEpochMs: Long,
)

@Entity(tableName = "boot_sessions", indices = [Index(value = ["bootIdentityHash"], unique = true)])
data class BootSessionEntity(
    @PrimaryKey val bootSessionId: String,
    val bootIdentityHash: String,
    val firstElapsedMs: Long,
    val observedWallEpochMs: Long,
    val automaticTimeEnabled: Boolean,
    val createdAtEpochMs: Long,
)

@Entity(tableName = "device_sequence")
data class DeviceSequenceEntity(@PrimaryKey val singletonId: Int = 1, val nextSequence: Long)

@Entity(tableName = "nfc_field_state")
data class NfcFieldStateEntity(
    @PrimaryKey val installationId: String,
    val state: String,
    val fieldGeneration: Long,
    val acceptedDeliveryId: String?,
    val acceptedPayloadHash: String?,
    val acceptedTagUidHash: String?,
    val acceptedBootSessionId: String?,
    val acceptedElapsedMs: Long?,
    val lastLivePresenceElapsedMs: Long?,
    val absenceProofDigest: String?,
    val updatedAtWallEpochMs: Long,
)

@Entity(
    tableName = "assignment_snapshots",
    indices = [
        Index(value = ["workOccurrenceId", "attemptGeneration"]),
        Index(value = ["employeeId", "deviceInstallationId", "locationId"]),
    ],
)
data class AssignmentSnapshotEntity(
    @PrimaryKey val snapshotId: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val canonicalBytes: ByteArray,
    val snapshotDigest: String,
    val signatureDigest: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val signatureBytes: ByteArray,
    val signingKeyId: String,
    val signatureAlgorithm: String,
    val employeeId: String,
    val deviceInstallationId: String,
    val operatingDate: String,
    val scheduleVersion: String,
    val scheduleRevision: Long,
    val datedExceptionRevision: Long,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val positionId: String,
    val locationId: String,
    val locationName: String,
    val expectedTagPayloadHash: String,
    val ownershipStartEpochMs: Long,
    val ownershipEndEpochMs: Long,
    val issuedAtEpochMs: Long,
    val offlineValidThroughEpochMs: Long,
    val serverHighWaterMark: Long,
    val trustedTimeLowerBoundAtAcceptance: Long,
    val state: String,
    val verifiedAtEpochMs: Long,
)

@Entity(
    tableName = "scan_deliveries",
    indices = [Index(value = ["bootSessionId", "fieldGeneration", "ndefPayloadHash"], unique = true)],
)
data class ScanDeliveryEntity(
    @PrimaryKey val deliveryId: String,
    val installationId: String,
    val bootSessionId: String,
    val fieldGeneration: Long,
    val tagUidHash: String?,
    val ndefPayloadHash: String,
    val source: String,
    val liveTagVerified: Boolean,
    val livePayloadRereadHash: String,
    val receivedElapsedMs: Long,
    val receivedWallEpochMs: Long,
    val consumedOperationId: String?,
    val outcomeCode: String?,
    val outcomePayloadDigest: String?,
    val authenticatedHandoffIdentity: String?,
)

@Entity(
    tableName = "operations",
    indices = [
        Index(value = ["localSequence"], unique = true),
        Index(value = ["workOccurrenceId", "attemptGeneration"]),
        Index(value = ["predecessorOperationId"]),
    ],
)
data class OperationEntity(
    @PrimaryKey val operationId: String,
    val operationType: String,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val employeeId: String,
    val deviceInstallationId: String,
    val attributionCredentialEpoch: Long,
    val creationEpoch: Long,
    val operationCreationFenceGeneration: Long,
    val locationId: String,
    val assignmentSnapshotId: String,
    val predecessorOperationId: String?,
    val continuityParentOperationId: String?,
    val localSequence: Long,
    val bootSessionId: String,
    val createdElapsedMs: Long,
    val createdWallEpochMs: Long,
    val wireSchemaVersion: Int,
    val contentType: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val canonicalRequestBytes: ByteArray,
    val payloadSha256: String,
    val state: String,
    val legacyCutoverGeneration: Long,
    val lastFailureCode: String?,
)

@Entity(tableName = "work_chains", indices = [Index(value = ["finishOperationId"], unique = true)])
data class WorkChainEntity(
    @PrimaryKey val startOperationId: String,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val employeeId: String,
    val deviceInstallationId: String,
    val locationId: String,
    val locationNameSnapshot: String,
    val assignmentSnapshotId: String,
    val expectedTagPayloadHash: String,
    val finishOperationId: String?,
    val finishDraftId: String?,
    val state: String,
    val managerHelpCause: String?,
    val resolutionGeneration: Long,
    val conflictClaimantOperationId: String?,
    val conflictClaimantDigest: String?,
    val updatedSequence: Long,
    val updatedAtWallEpochMs: Long,
)

@Entity(
    tableName = "current_work_pointer",
    indices = [Index(value = ["startOperationId"], unique = true)],
    foreignKeys = [ForeignKey(
        entity = WorkChainEntity::class,
        parentColumns = ["startOperationId"],
        childColumns = ["startOperationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class CurrentWorkPointerEntity(
    @PrimaryKey val installationId: String,
    val startOperationId: String,
    val updatedSequence: Long,
)

@Entity(
    tableName = "finish_drafts",
    indices = [Index(value = ["startOperationId"], unique = true)],
    foreignKeys = [ForeignKey(
        entity = WorkChainEntity::class,
        parentColumns = ["startOperationId"],
        childColumns = ["startOperationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class FinishDraftEntity(
    @PrimaryKey val draftId: String,
    val startOperationId: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val canonicalAnswerBytes: ByteArray,
    val answerSha256: String,
    val note: String,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val issuePayloadBytes: ByteArray?,
    val state: String,
    val updatedSequence: Long,
    val updatedAtWallEpochMs: Long,
)

@Entity(
    tableName = "outbox",
    indices = [Index(value = ["localSequence"], unique = true)],
    foreignKeys = [ForeignKey(
        entity = OperationEntity::class,
        parentColumns = ["operationId"],
        childColumns = ["operationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class OutboxEntity(
    @PrimaryKey val operationId: String,
    val localSequence: Long,
    val dependencyOperationId: String?,
    val barrierOperationId: String?,
    val deliveryState: String,
    val attempts: Int,
    val leaseOwner: String?,
    val leaseGeneration: Long,
    val leaseBootSessionId: String?,
    val leaseAcquiredElapsedMs: Long?,
    val leaseDurationMs: Long?,
    val lastAttemptBootSessionId: String?,
    val lastAttemptElapsedMs: Long?,
    val retryDelayMs: Long,
    val nextReconciliationKind: String,
    val updatedAtWallEpochMs: Long,
)

@Entity(
    tableName = "receipts",
    foreignKeys = [ForeignKey(
        entity = OperationEntity::class,
        parentColumns = ["operationId"],
        childColumns = ["operationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class ReceiptEntity(
    @PrimaryKey val operationId: String,
    val receiptSchemaVersion: Int,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val canonicalReceiptBytes: ByteArray,
    val receiptSha256: String,
    val canonicalServerDigest: String,
    val serverEffectId: String,
    val acceptedAtEpochMs: Long,
)

@Entity(
    tableName = "operation_diagnostics",
    indices = [Index(value = ["operationId"])],
    foreignKeys = [ForeignKey(
        entity = OperationEntity::class,
        parentColumns = ["operationId"],
        childColumns = ["operationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class OperationDiagnosticEntity(
    @PrimaryKey val diagnosticId: String,
    val operationId: String,
    val source: String,
    val code: String,
    val detailDigest: String,
    val leaseOwner: String?,
    val leaseGeneration: Long?,
    val observedAtEpochMs: Long,
)

@Entity(tableName = "ui_transitions", indices = [Index(value = ["operationId"])])
data class UiTransitionEntity(
    @PrimaryKey val transitionId: String,
    val operationId: String?,
    val transitionKind: String,
    val message: String,
    val createdAtEpochMs: Long,
    val announcedAtEpochMs: Long?,
)

@Entity(
    tableName = "support_cases",
    indices = [Index(value = ["startOperationId", "resolutionGeneration"], unique = true)],
    foreignKeys = [ForeignKey(
        entity = WorkChainEntity::class,
        parentColumns = ["startOperationId"],
        childColumns = ["startOperationId"],
        onDelete = ForeignKey.RESTRICT,
    )],
)
data class SupportCaseEntity(
    @PrimaryKey val supportCaseId: String,
    val startOperationId: String,
    val resolutionGeneration: Long,
    val reasonCode: String,
    val note: String,
    val state: String,
    val canonicalResolutionOperationId: String?,
    val canonicalResolutionDigest: String?,
    val serverSequence: Long?,
    val createdAtEpochMs: Long,
    val updatedAtEpochMs: Long,
)

@Entity(
    tableName = "inbound_resolutions",
    indices = [Index(value = ["resolutionOperationId"], unique = true)],
)
data class InboundResolutionEntity(
    @PrimaryKey val serverSequence: Long,
    val resolutionOperationId: String,
    val supportCaseId: String,
    val resolutionGeneration: Long,
    @ColumnInfo(typeAffinity = ColumnInfo.BLOB) val canonicalResolutionBytes: ByteArray,
    val resolutionSha256: String,
    val appliedAtEpochMs: Long?,
)
