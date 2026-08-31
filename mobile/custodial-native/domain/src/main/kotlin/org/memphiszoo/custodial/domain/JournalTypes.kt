package org.memphiszoo.custodial.domain

enum class GateState { OPEN, CLOSED_FOR_EPOCH_SWITCH, BLOCKED }
enum class CutoverState { IMPORTING, COMPLETE }
enum class TrustedTimeState { VERIFIED, ROLLBACK_DETECTED, UNCERTAIN }
enum class AssignmentSnapshotState { ACTIVE, SUPERSEDED, EXPIRED, QUARANTINED }
enum class ScanSource { READER, COLD_INTENT, WARM_INTENT, RECOVERED_HANDOFF }
enum class NfcFieldState { ARMED, ACCEPTED_WAITING_FOR_ABSENCE, RECOVERY_ABSENCE_PROBE, ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY }
enum class ScanOutcomeCode { START_CREATED, FINISH_CREATED, DISMISSED_NO_OPERATION }
enum class OperationType { START, FINISH, SUPPORT_REQUEST, MANAGER_RESOLUTION, FEEDBACK, MESSAGE, ACK }
enum class OperationState { PENDING, LEASED, AMBIGUOUS, ACKNOWLEDGED, BLOCKED, QUARANTINED }
enum class WorkChainState { ACTIVE, FINISHING, NEEDS_MANAGER, READY_TO_RESUME, COMPLETED, CANCELLED }
enum class FinishDraftState { EDITING, SUBMITTED_WAITING_RECEIPT, NEEDS_MANAGER, RETIRED_AFTER_RECEIPT }
enum class OutboxState { PENDING, LEASED, AMBIGUOUS, BLOCKED, ACKNOWLEDGED, QUARANTINED, HELD_FOR_CUTOVER }
enum class ReconciliationKind { SEND_EXACT_BYTES, READ_CANONICAL_STATUS }
enum class ManagerHelpCause {
    EMPLOYEE_REQUEST,
    TAG_DAMAGED,
    CORRECTABLE_LOCATION,
    FINISH_TERMINAL_CONFLICT,
    DUPLICATE_WORK_OCCURRENCE,
    INTEGRITY_QUARANTINE,
    HARD_REVOCATION,
}
enum class SupportCaseState { LOCAL_PENDING, OPEN, RESOLVED }

enum class JournalRejectionCode {
    NOT_INITIALIZED,
    IDENTITY_MISMATCH,
    CUTOVER_INCOMPLETE,
    OPERATION_CREATION_CLOSED,
    LEASE_ADMISSION_CLOSED,
    STALE_FENCE_GENERATION,
    STALE_CREATION_EPOCH,
    TRUSTED_TIME_UNAVAILABLE,
    ASSIGNMENT_NOT_FOUND,
    ASSIGNMENT_NOT_ACTIVE,
    ASSIGNMENT_BINDING_MISMATCH,
    ASSIGNMENT_TIME_OUTSIDE_WINDOW,
    TAG_MISMATCH,
    LIVE_TAG_REQUIRED,
    TAG_STILL_PRESENT,
    SCAN_NOT_FOUND,
    SCAN_ALREADY_CONSUMED,
    ALREADY_CLEANING,
    WORK_NOT_FOUND,
    WORK_NOT_ACTIVE,
    WORK_POINTER_MISMATCH,
    OPERATION_ID_CONFLICT,
    RECEIPT_CONFLICT,
    CONCURRENT_CONFLICT,
    INTEGRITY_FAILURE,
}

data class TrustedTimeInterval(val earliestEpochMs: Long, val latestEpochMs: Long) {
    init { require(earliestEpochMs <= latestEpochMs) }
}

data class BootObservation(
    val bootSessionId: String,
    val bootIdentityHash: String,
    val elapsedMs: Long,
    val wallEpochMs: Long,
    val automaticTimeEnabled: Boolean,
)

data class DeviceBootstrap(
    val installationId: String,
    val originalInstallationNamespaceId: String,
    val enrolledDeviceIdentifier: String,
    val employeeId: String,
    val employeeName: String,
    val assignmentEpoch: Long,
    val attributionCredentialEpoch: Long,
    val creationEpoch: Long,
    val bootSessionId: String,
    val cutoverState: CutoverState = CutoverState.COMPLETE,
    val trustedTimeState: TrustedTimeState = TrustedTimeState.VERIFIED,
)

data class AssignmentSnapshotCandidate(
    val snapshotId: String,
    val canonicalBytes: ByteArray,
    val snapshotDigest: String,
    val signatureDigest: String,
    val signatureBytes: ByteArray = byteArrayOf(),
    val signingKeyId: String = "",
    val signatureAlgorithm: String = "Ed25519",
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
)

fun interface AssignmentSnapshotVerifier {
    fun verify(candidate: AssignmentSnapshotCandidate): Boolean
}

data class VerifiedScanInput(
    val deliveryId: String,
    val installationId: String,
    val bootSessionId: String,
    val tagUidHash: String?,
    val ndefPayloadHash: String,
    val livePayloadRereadHash: String,
    val source: ScanSource,
    val liveTagVerified: Boolean,
    val receivedElapsedMs: Long,
    val receivedWallEpochMs: Long,
    val authenticatedHandoffIdentity: String? = null,
)

data class StartCleaningCommand(
    val operationId: String,
    val deliveryId: String,
    val assignmentSnapshotId: String,
    val locationId: String,
    val canonicalRequestBytes: ByteArray,
    val wireSchemaVersion: Int,
    val contentType: String = "application/json",
    val expectedCreationEpoch: Long,
    val expectedOperationFenceGeneration: Long,
    val expectedLeaseFenceGeneration: Long,
    val expectedCutoverGeneration: Long,
    val trustedTime: TrustedTimeInterval,
    val bootSessionId: String,
    val createdElapsedMs: Long,
    val createdWallEpochMs: Long,
)

data class FinishCleaningCommand(
    val operationId: String,
    val startOperationId: String,
    val deliveryId: String,
    val draftId: String,
    val canonicalAnswerBytes: ByteArray,
    val note: String,
    val issuePayloadBytes: ByteArray?,
    val canonicalRequestBytes: ByteArray,
    val wireSchemaVersion: Int,
    val contentType: String = "application/json",
    val expectedCreationEpoch: Long,
    val expectedOperationFenceGeneration: Long,
    val expectedLeaseFenceGeneration: Long,
    val expectedCutoverGeneration: Long,
    val bootSessionId: String,
    val createdElapsedMs: Long,
    val createdWallEpochMs: Long,
)

data class RequestManagerHelpCommand(
    val operationId: String,
    val startOperationId: String,
    val reason: ManagerHelpCause,
    val note: String,
    val canonicalRequestBytes: ByteArray,
    val wireSchemaVersion: Int,
    val contentType: String = "application/json",
    val expectedCreationEpoch: Long,
    val expectedOperationFenceGeneration: Long,
    val expectedLeaseFenceGeneration: Long,
    val expectedCutoverGeneration: Long,
    val bootSessionId: String,
    val createdElapsedMs: Long,
    val createdWallEpochMs: Long,
)

data class CanonicalReceiptCommand(
    val operationId: String,
    val expectedPayloadSha256: String,
    val canonicalReceiptBytes: ByteArray,
    val canonicalServerDigest: String,
    val serverEffectId: String,
    val acceptedAtEpochMs: Long,
)

data class RecordedScan(val deliveryId: String, val fieldGeneration: Long, val replayed: Boolean)
data class StartedCleaning(val operationId: String, val startOperationId: String, val locationName: String, val replayed: Boolean)
data class FinishedCleaning(val operationId: String, val startOperationId: String, val replayed: Boolean)
data class ReceiptApplied(val operationId: String, val replayed: Boolean)
data class ManagerHelpRequested(val operationId: String, val supportCaseId: String, val replayed: Boolean)
data class LeaseToken(
    val operationId: String,
    val operationType: OperationType,
    val canonicalRequestBytes: ByteArray,
    val payloadSha256: String,
    val reconciliationKind: ReconciliationKind,
    val leaseOwner: String,
    val leaseGeneration: Long,
)

sealed interface JournalResult<out T> {
    data class Success<T>(val value: T) : JournalResult<T>
    data class Rejected(val code: JournalRejectionCode, val message: String) : JournalResult<Nothing>
}
