package org.memphiszoo.custodial.data

import android.database.sqlite.SQLiteConstraintException
import androidx.room.withTransaction
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import org.memphiszoo.custodial.domain.AssignmentSnapshotCandidate
import org.memphiszoo.custodial.domain.AssignmentSnapshotState
import org.memphiszoo.custodial.domain.AssignmentSnapshotVerifier
import org.memphiszoo.custodial.domain.BootObservation
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.CutoverState
import org.memphiszoo.custodial.domain.DeviceBootstrap
import org.memphiszoo.custodial.domain.FinishCleaningCommand
import org.memphiszoo.custodial.domain.FinishDraftState
import org.memphiszoo.custodial.domain.GateState
import org.memphiszoo.custodial.domain.JournalRejectionCode
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.ManagerHelpCause
import org.memphiszoo.custodial.domain.ManagerHelpRequested
import org.memphiszoo.custodial.domain.NfcFieldState
import org.memphiszoo.custodial.domain.OperationState
import org.memphiszoo.custodial.domain.OperationType
import org.memphiszoo.custodial.domain.OutboxState
import org.memphiszoo.custodial.domain.ReceiptApplied
import org.memphiszoo.custodial.domain.RequestManagerHelpCommand
import org.memphiszoo.custodial.domain.ReconciliationKind
import org.memphiszoo.custodial.domain.RecordedScan
import org.memphiszoo.custodial.domain.ScanOutcomeCode
import org.memphiszoo.custodial.domain.StartCleaningCommand
import org.memphiszoo.custodial.domain.StartedCleaning
import org.memphiszoo.custodial.domain.FinishedCleaning
import org.memphiszoo.custodial.domain.SupportCaseState
import org.memphiszoo.custodial.domain.TrustedTimeState
import org.memphiszoo.custodial.domain.VerifiedScanInput
import org.memphiszoo.custodial.domain.WorkChainState

class JournalRepository(
    private val database: CustodialDatabase,
    private val snapshotVerifier: AssignmentSnapshotVerifier,
) {
    private val dao = database.journalDao()

    private class Rejection(val code: JournalRejectionCode, override val message: String) : RuntimeException(message)

    private fun reject(code: JournalRejectionCode, message: String): Nothing = throw Rejection(code, message)

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }

    private fun deterministicId(vararg parts: String): String = UUID.nameUUIDFromBytes(
        parts.joinToString("|").toByteArray(StandardCharsets.UTF_8),
    ).toString()

    private suspend fun <T> transaction(block: suspend () -> T): JournalResult<T> = try {
        JournalResult.Success(database.withTransaction { block() })
    } catch (failure: Rejection) {
        JournalResult.Rejected(failure.code, failure.message)
    } catch (failure: SQLiteConstraintException) {
        JournalResult.Rejected(JournalRejectionCode.CONCURRENT_CONFLICT, "Another saved action won this race. Nothing was duplicated.")
    }

    suspend fun initializeDevice(bootstrap: DeviceBootstrap, wallEpochMs: Long): JournalResult<DeviceStateEntity> = transaction {
        val expected = DeviceStateEntity(
            installationId = bootstrap.installationId,
            originalInstallationNamespaceId = bootstrap.originalInstallationNamespaceId,
            enrolledDeviceIdentifier = bootstrap.enrolledDeviceIdentifier,
            employeeId = bootstrap.employeeId,
            employeeNameSnapshot = bootstrap.employeeName,
            assignmentEpoch = bootstrap.assignmentEpoch,
            activeAttributionCredentialEpoch = bootstrap.attributionCredentialEpoch,
            creationEpoch = bootstrap.creationEpoch,
            activeCredentialSlotDigest = null,
            operationCreationFenceState = GateState.OPEN.name,
            operationCreationFenceGeneration = 1,
            leaseAdmissionState = GateState.OPEN.name,
            leaseAdmissionGeneration = 1,
            legacyCutoverState = bootstrap.cutoverState.name,
            legacyCutoverGeneration = 1,
            currentBootSessionId = bootstrap.bootSessionId,
            inboundResolutionCursor = 0,
            trustedTimeState = bootstrap.trustedTimeState.name,
            updatedAtWallEpochMs = wallEpochMs,
        )
        dao.insertDeviceState(expected)
        dao.insertDeviceSequence(DeviceSequenceEntity(nextSequence = 1))
        dao.insertNfcFieldState(
            NfcFieldStateEntity(
                installationId = bootstrap.installationId,
                state = NfcFieldState.ARMED.name,
                fieldGeneration = 0,
                acceptedDeliveryId = null,
                acceptedPayloadHash = null,
                acceptedTagUidHash = null,
                acceptedBootSessionId = null,
                acceptedElapsedMs = null,
                lastLivePresenceElapsedMs = null,
                absenceProofDigest = null,
                updatedAtWallEpochMs = wallEpochMs,
            ),
        )
        val actual = dao.deviceState() ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "This phone could not initialize its saved work area.")
        if (
            actual.installationId != expected.installationId ||
            actual.originalInstallationNamespaceId != expected.originalInstallationNamespaceId ||
            actual.employeeId != expected.employeeId ||
            actual.enrolledDeviceIdentifier != expected.enrolledDeviceIdentifier
        ) {
            reject(JournalRejectionCode.IDENTITY_MISMATCH, "This phone is assigned to a different employee or installation.")
        }
        actual
    }

    suspend fun reconcileBootSession(observation: BootObservation): JournalResult<DeviceStateEntity> = transaction {
        val device = dao.deviceState()
            ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone needs manager setup before it can restore work.")
        val expected = BootSessionEntity(
            bootSessionId = observation.bootSessionId,
            bootIdentityHash = observation.bootIdentityHash,
            firstElapsedMs = observation.elapsedMs,
            observedWallEpochMs = observation.wallEpochMs,
            automaticTimeEnabled = observation.automaticTimeEnabled,
            createdAtEpochMs = observation.wallEpochMs,
        )
        val inserted = dao.insertBootSession(expected)
        val stored = dao.bootSession(observation.bootSessionId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The phone restart record could not be saved.")
        if (
            stored.bootIdentityHash != expected.bootIdentityHash ||
            stored.automaticTimeEnabled != expected.automaticTimeEnabled ||
            stored.firstElapsedMs > observation.elapsedMs
        ) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The phone restart identity changed unexpectedly.")
        }
        val trusted = when {
            !observation.automaticTimeEnabled -> TrustedTimeState.UNCERTAIN
            observation.wallEpochMs + 5 * 60_000L < device.updatedAtWallEpochMs -> TrustedTimeState.ROLLBACK_DETECTED
            else -> TrustedTimeState.VERIFIED
        }
        val updated = device.copy(
            currentBootSessionId = observation.bootSessionId,
            trustedTimeState = trusted.name,
            updatedAtWallEpochMs = maxOf(device.updatedAtWallEpochMs, observation.wallEpochMs),
        )
        if (dao.updateDeviceState(updated) != 1) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "The phone restart state changed at the same time.")
        }
        if (device.currentBootSessionId != observation.bootSessionId) {
            val field = dao.nfcFieldState(device.installationId)
            if (field != null && field.state == NfcFieldState.ACCEPTED_WAITING_FOR_ABSENCE.name) {
                if (dao.updateNfcFieldState(
                    field.copy(
                        state = NfcFieldState.RECOVERY_ABSENCE_PROBE.name,
                        updatedAtWallEpochMs = observation.wallEpochMs,
                    ),
                ) != 1) {
                    reject(JournalRejectionCode.CONCURRENT_CONFLICT, "The scanner restart state changed at the same time.")
                }
            }
        }
        dao.deviceState() ?: updated
    }

    suspend fun acceptAssignmentSnapshot(candidate: AssignmentSnapshotCandidate, verifiedAtEpochMs: Long): JournalResult<AssignmentSnapshotEntity> = transaction {
        if (sha256(candidate.canonicalBytes) != candidate.snapshotDigest || !snapshotVerifier.verify(candidate)) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved assignment could not be verified.")
        }
        val entity = AssignmentSnapshotEntity(
            snapshotId = candidate.snapshotId,
            canonicalBytes = candidate.canonicalBytes.copyOf(),
            snapshotDigest = candidate.snapshotDigest,
            signatureDigest = candidate.signatureDigest,
            signatureBytes = candidate.signatureBytes.copyOf(),
            signingKeyId = candidate.signingKeyId,
            signatureAlgorithm = candidate.signatureAlgorithm,
            employeeId = candidate.employeeId,
            deviceInstallationId = candidate.deviceInstallationId,
            operatingDate = candidate.operatingDate,
            scheduleVersion = candidate.scheduleVersion,
            scheduleRevision = candidate.scheduleRevision,
            datedExceptionRevision = candidate.datedExceptionRevision,
            workOccurrenceId = candidate.workOccurrenceId,
            attemptGeneration = candidate.attemptGeneration,
            positionId = candidate.positionId,
            locationId = candidate.locationId,
            locationName = candidate.locationName,
            expectedTagPayloadHash = candidate.expectedTagPayloadHash,
            ownershipStartEpochMs = candidate.ownershipStartEpochMs,
            ownershipEndEpochMs = candidate.ownershipEndEpochMs,
            issuedAtEpochMs = candidate.issuedAtEpochMs,
            offlineValidThroughEpochMs = candidate.offlineValidThroughEpochMs,
            serverHighWaterMark = candidate.serverHighWaterMark,
            trustedTimeLowerBoundAtAcceptance = candidate.trustedTimeLowerBoundAtAcceptance,
            state = AssignmentSnapshotState.ACTIVE.name,
            verifiedAtEpochMs = verifiedAtEpochMs,
        )
        dao.insertAssignmentSnapshot(entity)
        val stored = dao.assignmentSnapshot(candidate.snapshotId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The assignment was not saved.")
        val storedComparable = stored.copy(canonicalBytes = byteArrayOf(), signatureBytes = byteArrayOf())
        val entityComparable = entity.copy(canonicalBytes = byteArrayOf(), signatureBytes = byteArrayOf())
        if (
            storedComparable != entityComparable
            || !stored.canonicalBytes.contentEquals(entity.canonicalBytes)
            || !stored.signatureBytes.contentEquals(entity.signatureBytes)
        ) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "A different assignment already uses this identity.")
        }
        stored
    }

    suspend fun recordVerifiedScan(input: VerifiedScanInput): JournalResult<RecordedScan> = transaction {
        if (!input.liveTagVerified || input.ndefPayloadHash != input.livePayloadRereadHash) {
            reject(JournalRejectionCode.LIVE_TAG_REQUIRED, "Hold the phone to the location tag and try again.")
        }
        val device = dao.deviceState()
            ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone is not ready for scanning.")
        if (device.installationId != input.installationId || device.currentBootSessionId != input.bootSessionId) {
            reject(JournalRejectionCode.IDENTITY_MISMATCH, "This scan does not belong to the current phone session.")
        }
        val state = dao.nfcFieldState(input.installationId)
            ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone is not ready for scanning.")
        if (state.state == NfcFieldState.ACCEPTED_WAITING_FOR_ABSENCE.name || state.state == NfcFieldState.RECOVERY_ABSENCE_PROBE.name) {
            val prior = state.acceptedDeliveryId?.let { dao.scanDelivery(it) }
            if (prior != null && prior.ndefPayloadHash == input.ndefPayloadHash && prior.tagUidHash == input.tagUidHash) {
                return@transaction RecordedScan(prior.deliveryId, prior.fieldGeneration, replayed = true)
            }
            reject(JournalRejectionCode.TAG_STILL_PRESENT, "Move the phone away from the tag before scanning again.")
        }
        if (state.state != NfcFieldState.ARMED.name && state.state != NfcFieldState.ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY.name) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The scanner needs a moment to reset.")
        }
        val generation = state.fieldGeneration + 1
        val delivery = ScanDeliveryEntity(
            deliveryId = input.deliveryId,
            installationId = input.installationId,
            bootSessionId = input.bootSessionId,
            fieldGeneration = generation,
            tagUidHash = input.tagUidHash,
            ndefPayloadHash = input.ndefPayloadHash,
            source = input.source.name,
            liveTagVerified = true,
            livePayloadRereadHash = input.livePayloadRereadHash,
            receivedElapsedMs = input.receivedElapsedMs,
            receivedWallEpochMs = input.receivedWallEpochMs,
            consumedOperationId = null,
            outcomeCode = null,
            outcomePayloadDigest = null,
            authenticatedHandoffIdentity = input.authenticatedHandoffIdentity,
        )
        val inserted = dao.insertScanDelivery(delivery)
        if (inserted == -1L) {
            val existing = dao.scanDelivery(input.deliveryId)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The scan identity is unavailable.")
            if (existing.ndefPayloadHash != delivery.ndefPayloadHash || existing.livePayloadRereadHash != delivery.livePayloadRereadHash) {
                reject(JournalRejectionCode.INTEGRITY_FAILURE, "A different tag already uses this scan identity.")
            }
            return@transaction RecordedScan(existing.deliveryId, existing.fieldGeneration, replayed = true)
        }
        val updated = dao.updateNfcFieldState(
            state.copy(
                state = NfcFieldState.ACCEPTED_WAITING_FOR_ABSENCE.name,
                fieldGeneration = generation,
                acceptedDeliveryId = delivery.deliveryId,
                acceptedPayloadHash = delivery.ndefPayloadHash,
                acceptedTagUidHash = delivery.tagUidHash,
                acceptedBootSessionId = delivery.bootSessionId,
                acceptedElapsedMs = delivery.receivedElapsedMs,
                lastLivePresenceElapsedMs = delivery.receivedElapsedMs,
                absenceProofDigest = null,
                updatedAtWallEpochMs = delivery.receivedWallEpochMs,
            ),
        )
        if (updated != 1) reject(JournalRejectionCode.CONCURRENT_CONFLICT, "Another scan was already accepted.")
        RecordedScan(delivery.deliveryId, generation, replayed = false)
    }

    suspend fun confirmTagAbsent(installationId: String, absenceProofDigest: String, elapsedMs: Long, wallEpochMs: Long): JournalResult<Unit> = transaction {
        val state = dao.nfcFieldState(installationId)
            ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone is not ready for scanning.")
        if (state.state == NfcFieldState.ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY.name) return@transaction Unit
        if (state.state != NfcFieldState.ACCEPTED_WAITING_FOR_ABSENCE.name && state.state != NfcFieldState.RECOVERY_ABSENCE_PROBE.name) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "No accepted tag is waiting for removal.")
        }
        if (dao.updateNfcFieldState(
            state.copy(
                state = NfcFieldState.ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY.name,
                lastLivePresenceElapsedMs = elapsedMs,
                absenceProofDigest = absenceProofDigest,
                updatedAtWallEpochMs = wallEpochMs,
            ),
        ) != 1) reject(JournalRejectionCode.CONCURRENT_CONFLICT, "The scanner state changed while saving tag removal.")
    }

    suspend fun dismissScan(deliveryId: String, wallEpochMs: Long): JournalResult<RecordedScan> = transaction {
        val scan = dao.scanDelivery(deliveryId)
            ?: reject(JournalRejectionCode.SCAN_NOT_FOUND, "That scan is no longer available.")
        if (scan.outcomeCode != null) {
            if (scan.outcomeCode == ScanOutcomeCode.DISMISSED_NO_OPERATION.name) {
                return@transaction RecordedScan(scan.deliveryId, scan.fieldGeneration, replayed = true)
            }
            reject(JournalRejectionCode.SCAN_ALREADY_CONSUMED, "That scan already started or finished a cleaning.")
        }
        val digest = sha256("DISMISSED_NO_OPERATION|$deliveryId".toByteArray(StandardCharsets.UTF_8))
        if (dao.consumeScanDelivery(deliveryId, null, ScanOutcomeCode.DISMISSED_NO_OPERATION.name, digest) != 1) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "That scan was handled at the same time.")
        }
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(deliveryId, "DISMISSED_NO_OPERATION"),
                operationId = null,
                transitionKind = "SCAN_DISMISSED",
                message = "Cleaning not started.",
                createdAtEpochMs = wallEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        RecordedScan(deliveryId, scan.fieldGeneration, replayed = false)
    }

    suspend fun startCleaning(command: StartCleaningCommand): JournalResult<StartedCleaning> = transaction {
        val payloadHash = sha256(command.canonicalRequestBytes)
        dao.operation(command.operationId)?.let { existing ->
            if (existing.operationType != OperationType.START.name || existing.payloadSha256 != payloadHash || !existing.canonicalRequestBytes.contentEquals(command.canonicalRequestBytes)) {
                reject(JournalRejectionCode.OPERATION_ID_CONFLICT, "A different saved action already uses this identity.")
            }
            val chain = dao.workChain(command.operationId)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved cleaning is incomplete.")
            return@transaction StartedCleaning(existing.operationId, chain.startOperationId, chain.locationNameSnapshot, replayed = true)
        }

        val device = requireCreationAuthority(
            command.expectedCreationEpoch,
            command.expectedOperationFenceGeneration,
            command.expectedLeaseFenceGeneration,
            command.expectedCutoverGeneration,
            command.bootSessionId,
        )
        if (device.trustedTimeState != TrustedTimeState.VERIFIED.name) {
            reject(JournalRejectionCode.TRUSTED_TIME_UNAVAILABLE, "Connect this phone before starting a new cleaning.")
        }
        val snapshot = dao.assignmentSnapshot(command.assignmentSnapshotId)
            ?: reject(JournalRejectionCode.ASSIGNMENT_NOT_FOUND, "This location is not in the saved schedule.")
        validateSnapshot(device, snapshot, command.locationId, command.trustedTime)
        val scan = requireAvailableScan(command.deliveryId, snapshot.expectedTagPayloadHash)
        dao.currentWorkPointer(device.installationId)?.let {
            reject(JournalRejectionCode.ALREADY_CLEANING, "Finish or get help with the current cleaning first.")
        }

        val sequence = allocateSequence()
        val barrier = dao.latestUnsettledFinishOperationId()
        val operation = OperationEntity(
            operationId = command.operationId,
            operationType = OperationType.START.name,
            workOccurrenceId = snapshot.workOccurrenceId,
            attemptGeneration = snapshot.attemptGeneration,
            employeeId = device.employeeId,
            deviceInstallationId = device.installationId,
            attributionCredentialEpoch = device.activeAttributionCredentialEpoch,
            creationEpoch = device.creationEpoch,
            operationCreationFenceGeneration = device.operationCreationFenceGeneration,
            locationId = snapshot.locationId,
            assignmentSnapshotId = snapshot.snapshotId,
            predecessorOperationId = null,
            continuityParentOperationId = null,
            localSequence = sequence,
            bootSessionId = command.bootSessionId,
            createdElapsedMs = command.createdElapsedMs,
            createdWallEpochMs = command.createdWallEpochMs,
            wireSchemaVersion = command.wireSchemaVersion,
            contentType = command.contentType,
            canonicalRequestBytes = command.canonicalRequestBytes.copyOf(),
            payloadSha256 = payloadHash,
            state = OperationState.PENDING.name,
            legacyCutoverGeneration = device.legacyCutoverGeneration,
            lastFailureCode = null,
        )
        dao.insertOperation(operation)
        dao.insertOutbox(
            OutboxEntity(
                operationId = operation.operationId,
                localSequence = sequence,
                dependencyOperationId = null,
                barrierOperationId = barrier,
                deliveryState = OutboxState.PENDING.name,
                attempts = 0,
                leaseOwner = null,
                leaseGeneration = 0,
                leaseBootSessionId = null,
                leaseAcquiredElapsedMs = null,
                leaseDurationMs = null,
                lastAttemptBootSessionId = null,
                lastAttemptElapsedMs = null,
                retryDelayMs = 0,
                nextReconciliationKind = ReconciliationKind.SEND_EXACT_BYTES.name,
                updatedAtWallEpochMs = command.createdWallEpochMs,
            ),
        )
        dao.insertWorkChain(
            WorkChainEntity(
                startOperationId = operation.operationId,
                workOccurrenceId = snapshot.workOccurrenceId,
                attemptGeneration = snapshot.attemptGeneration,
                employeeId = device.employeeId,
                deviceInstallationId = device.installationId,
                locationId = snapshot.locationId,
                locationNameSnapshot = snapshot.locationName,
                assignmentSnapshotId = snapshot.snapshotId,
                expectedTagPayloadHash = snapshot.expectedTagPayloadHash,
                finishOperationId = null,
                finishDraftId = null,
                state = WorkChainState.ACTIVE.name,
                managerHelpCause = null,
                resolutionGeneration = 0,
                conflictClaimantOperationId = null,
                conflictClaimantDigest = null,
                updatedSequence = sequence,
                updatedAtWallEpochMs = command.createdWallEpochMs,
            ),
        )
        dao.insertCurrentWorkPointer(CurrentWorkPointerEntity(device.installationId, operation.operationId, sequence))
        if (dao.consumeScanDelivery(scan.deliveryId, operation.operationId, ScanOutcomeCode.START_CREATED.name, payloadHash) != 1) {
            reject(JournalRejectionCode.SCAN_ALREADY_CONSUMED, "That scan was already handled.")
        }
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(operation.operationId, "START_SAVED"),
                operationId = operation.operationId,
                transitionKind = "START_SAVED",
                message = "You are cleaning ${snapshot.locationName}.",
                createdAtEpochMs = command.createdWallEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        StartedCleaning(operation.operationId, operation.operationId, snapshot.locationName, replayed = false)
    }

    suspend fun saveFinishDraft(
        installationId: String,
        startOperationId: String,
        draftId: String,
        canonicalAnswerBytes: ByteArray,
        note: String,
        issuePayloadBytes: ByteArray?,
        wallEpochMs: Long,
    ): JournalResult<FinishDraftEntity> = transaction {
        val pointer = dao.currentWorkPointer(installationId)
            ?: reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "There is no active cleaning to update.")
        if (pointer.startOperationId != startOperationId) reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "A different cleaning is active.")
        val chain = dao.workChain(startOperationId)
            ?: reject(JournalRejectionCode.WORK_NOT_FOUND, "The current cleaning could not be found.")
        if (chain.state != WorkChainState.ACTIVE.name) reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning is not open for changes.")
        val sequence = allocateSequence()
        val draft = FinishDraftEntity(
            draftId = draftId,
            startOperationId = startOperationId,
            canonicalAnswerBytes = canonicalAnswerBytes.copyOf(),
            answerSha256 = sha256(canonicalAnswerBytes),
            note = note,
            issuePayloadBytes = issuePayloadBytes?.copyOf(),
            state = FinishDraftState.EDITING.name,
            updatedSequence = sequence,
            updatedAtWallEpochMs = wallEpochMs,
        )
        dao.upsertFinishDraft(draft)
        if (dao.attachDraft(startOperationId, draftId, sequence, wallEpochMs) != 1) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning changed while saving.")
        }
        draft
    }

    suspend fun finishCleaning(command: FinishCleaningCommand): JournalResult<FinishedCleaning> = transaction {
        val payloadHash = sha256(command.canonicalRequestBytes)
        dao.operation(command.operationId)?.let { existing ->
            if (existing.operationType != OperationType.FINISH.name || existing.payloadSha256 != payloadHash || !existing.canonicalRequestBytes.contentEquals(command.canonicalRequestBytes)) {
                reject(JournalRejectionCode.OPERATION_ID_CONFLICT, "A different saved action already uses this identity.")
            }
            val chain = dao.workChain(command.startOperationId)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved cleaning is incomplete.")
            if (chain.finishOperationId != existing.operationId) reject(JournalRejectionCode.INTEGRITY_FAILURE, "The finish is attached to a different cleaning.")
            return@transaction FinishedCleaning(existing.operationId, command.startOperationId, replayed = true)
        }

        val device = requireCreationAuthority(
            command.expectedCreationEpoch,
            command.expectedOperationFenceGeneration,
            command.expectedLeaseFenceGeneration,
            command.expectedCutoverGeneration,
            command.bootSessionId,
        )
        val pointer = dao.currentWorkPointer(device.installationId)
            ?: reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "There is no active cleaning to finish.")
        if (pointer.startOperationId != command.startOperationId) reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "A different cleaning is active.")
        val chain = dao.workChain(command.startOperationId)
            ?: reject(JournalRejectionCode.WORK_NOT_FOUND, "The current cleaning could not be found.")
        if (chain.state != WorkChainState.ACTIVE.name || chain.finishOperationId != null) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning is no longer open for finishing.")
        }
        val scan = requireAvailableScan(command.deliveryId, chain.expectedTagPayloadHash)
        val sequence = allocateSequence()
        val answerHash = sha256(command.canonicalAnswerBytes)
        dao.upsertFinishDraft(
            FinishDraftEntity(
                draftId = command.draftId,
                startOperationId = command.startOperationId,
                canonicalAnswerBytes = command.canonicalAnswerBytes.copyOf(),
                answerSha256 = answerHash,
                note = command.note,
                issuePayloadBytes = command.issuePayloadBytes?.copyOf(),
                state = FinishDraftState.SUBMITTED_WAITING_RECEIPT.name,
                updatedSequence = sequence,
                updatedAtWallEpochMs = command.createdWallEpochMs,
            ),
        )
        val start = dao.operation(command.startOperationId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The start record is missing.")
        val operation = OperationEntity(
            operationId = command.operationId,
            operationType = OperationType.FINISH.name,
            workOccurrenceId = chain.workOccurrenceId,
            attemptGeneration = chain.attemptGeneration,
            employeeId = device.employeeId,
            deviceInstallationId = device.installationId,
            attributionCredentialEpoch = start.attributionCredentialEpoch,
            creationEpoch = device.creationEpoch,
            operationCreationFenceGeneration = device.operationCreationFenceGeneration,
            locationId = chain.locationId,
            assignmentSnapshotId = chain.assignmentSnapshotId,
            predecessorOperationId = start.operationId,
            continuityParentOperationId = start.operationId,
            localSequence = sequence,
            bootSessionId = command.bootSessionId,
            createdElapsedMs = command.createdElapsedMs,
            createdWallEpochMs = command.createdWallEpochMs,
            wireSchemaVersion = command.wireSchemaVersion,
            contentType = command.contentType,
            canonicalRequestBytes = command.canonicalRequestBytes.copyOf(),
            payloadSha256 = payloadHash,
            state = OperationState.PENDING.name,
            legacyCutoverGeneration = device.legacyCutoverGeneration,
            lastFailureCode = null,
        )
        dao.insertOperation(operation)
        dao.insertOutbox(
            OutboxEntity(
                operationId = operation.operationId,
                localSequence = sequence,
                dependencyOperationId = start.operationId,
                barrierOperationId = null,
                deliveryState = OutboxState.PENDING.name,
                attempts = 0,
                leaseOwner = null,
                leaseGeneration = 0,
                leaseBootSessionId = null,
                leaseAcquiredElapsedMs = null,
                leaseDurationMs = null,
                lastAttemptBootSessionId = null,
                lastAttemptElapsedMs = null,
                retryDelayMs = 0,
                nextReconciliationKind = ReconciliationKind.SEND_EXACT_BYTES.name,
                updatedAtWallEpochMs = command.createdWallEpochMs,
            ),
        )
        if (dao.markWorkChainFinishing(command.startOperationId, operation.operationId, command.draftId, sequence, command.createdWallEpochMs) != 1) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning changed while finishing.")
        }
        if (dao.deleteCurrentWorkPointer(device.installationId, command.startOperationId) != 1) {
            reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "The current cleaning changed while finishing.")
        }
        if (dao.consumeScanDelivery(scan.deliveryId, operation.operationId, ScanOutcomeCode.FINISH_CREATED.name, payloadHash) != 1) {
            reject(JournalRejectionCode.SCAN_ALREADY_CONSUMED, "That scan was already handled.")
        }
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(operation.operationId, "FINISH_SAVED"),
                operationId = operation.operationId,
                transitionKind = "FINISH_SAVED",
                message = "Cleaning saved on this phone.",
                createdAtEpochMs = command.createdWallEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        FinishedCleaning(operation.operationId, command.startOperationId, replayed = false)
    }

    suspend fun requestManagerHelp(command: RequestManagerHelpCommand): JournalResult<ManagerHelpRequested> = transaction {
        val payloadHash = sha256(command.canonicalRequestBytes)
        dao.operation(command.operationId)?.let { existing ->
            if (
                existing.operationType != OperationType.SUPPORT_REQUEST.name ||
                existing.payloadSha256 != payloadHash ||
                !existing.canonicalRequestBytes.contentEquals(command.canonicalRequestBytes)
            ) {
                reject(JournalRejectionCode.OPERATION_ID_CONFLICT, "A different saved action already uses this identity.")
            }
            val chain = dao.workChain(command.startOperationId)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The cleaning linked to this request is missing.")
            val support = dao.supportCase(chain.startOperationId, chain.resolutionGeneration)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved help request is incomplete.")
            return@transaction ManagerHelpRequested(existing.operationId, support.supportCaseId, replayed = true)
        }

        val device = requireCreationAuthority(
            command.expectedCreationEpoch,
            command.expectedOperationFenceGeneration,
            command.expectedLeaseFenceGeneration,
            command.expectedCutoverGeneration,
            command.bootSessionId,
        )
        val pointer = dao.currentWorkPointer(device.installationId)
            ?: reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "There is no active cleaning to request help with.")
        if (pointer.startOperationId != command.startOperationId) {
            reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "A different cleaning is active.")
        }
        val chain = dao.workChain(command.startOperationId)
            ?: reject(JournalRejectionCode.WORK_NOT_FOUND, "The current cleaning could not be found.")
        if (chain.state != WorkChainState.ACTIVE.name) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning is no longer open.")
        }
        val start = dao.operation(command.startOperationId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The start record is missing.")
        val sequence = allocateSequence()
        val operation = OperationEntity(
            operationId = command.operationId,
            operationType = OperationType.SUPPORT_REQUEST.name,
            workOccurrenceId = chain.workOccurrenceId,
            attemptGeneration = chain.attemptGeneration,
            employeeId = device.employeeId,
            deviceInstallationId = device.installationId,
            attributionCredentialEpoch = start.attributionCredentialEpoch,
            creationEpoch = device.creationEpoch,
            operationCreationFenceGeneration = device.operationCreationFenceGeneration,
            locationId = chain.locationId,
            assignmentSnapshotId = chain.assignmentSnapshotId,
            predecessorOperationId = start.operationId,
            continuityParentOperationId = start.operationId,
            localSequence = sequence,
            bootSessionId = command.bootSessionId,
            createdElapsedMs = command.createdElapsedMs,
            createdWallEpochMs = command.createdWallEpochMs,
            wireSchemaVersion = command.wireSchemaVersion,
            contentType = command.contentType,
            canonicalRequestBytes = command.canonicalRequestBytes.copyOf(),
            payloadSha256 = payloadHash,
            state = OperationState.PENDING.name,
            legacyCutoverGeneration = device.legacyCutoverGeneration,
            lastFailureCode = null,
        )
        dao.insertOperation(operation)
        dao.insertOutbox(
            OutboxEntity(
                operationId = operation.operationId,
                localSequence = sequence,
                dependencyOperationId = start.operationId,
                barrierOperationId = null,
                deliveryState = OutboxState.PENDING.name,
                attempts = 0,
                leaseOwner = null,
                leaseGeneration = 0,
                leaseBootSessionId = null,
                leaseAcquiredElapsedMs = null,
                leaseDurationMs = null,
                lastAttemptBootSessionId = null,
                lastAttemptElapsedMs = null,
                retryDelayMs = 0,
                nextReconciliationKind = ReconciliationKind.SEND_EXACT_BYTES.name,
                updatedAtWallEpochMs = command.createdWallEpochMs,
            ),
        )
        if (dao.markWorkChainNeedsManager(command.startOperationId, command.reason.name, sequence, command.createdWallEpochMs) != 1) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning changed while requesting help.")
        }
        dao.finishDraftForStart(command.startOperationId)?.let {
            dao.updateFinishDraftState(command.startOperationId, FinishDraftState.NEEDS_MANAGER.name, command.createdWallEpochMs)
        }
        if (dao.deleteCurrentWorkPointer(device.installationId, command.startOperationId) != 1) {
            reject(JournalRejectionCode.WORK_POINTER_MISMATCH, "The current cleaning changed while requesting help.")
        }
        val updatedChain = dao.workChain(command.startOperationId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The cleaning could not be restored after requesting help.")
        val support = SupportCaseEntity(
            supportCaseId = deterministicId(command.startOperationId, "support", updatedChain.resolutionGeneration.toString()),
            startOperationId = command.startOperationId,
            resolutionGeneration = updatedChain.resolutionGeneration,
            reasonCode = command.reason.name,
            note = command.note,
            state = SupportCaseState.LOCAL_PENDING.name,
            canonicalResolutionOperationId = null,
            canonicalResolutionDigest = null,
            serverSequence = null,
            createdAtEpochMs = command.createdWallEpochMs,
            updatedAtEpochMs = command.createdWallEpochMs,
        )
        if (dao.insertSupportCase(support) == -1L) {
            val existing = dao.supportCase(command.startOperationId, updatedChain.resolutionGeneration)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The help request could not be restored.")
            if (existing.reasonCode != support.reasonCode || existing.note != support.note) {
                reject(JournalRejectionCode.INTEGRITY_FAILURE, "A different help request already uses this identity.")
            }
        }
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(command.operationId, "HELP_SAVED"),
                operationId = command.operationId,
                transitionKind = "HELP_SAVED",
                message = "Saved on this phone. Ask a manager for help.",
                createdAtEpochMs = command.createdWallEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        val stored = dao.supportCase(command.startOperationId, updatedChain.resolutionGeneration) ?: support
        ManagerHelpRequested(operation.operationId, stored.supportCaseId, replayed = false)
    }

    suspend fun applyCanonicalReceipt(command: CanonicalReceiptCommand): JournalResult<ReceiptApplied> = transaction {
        val operation = dao.operation(command.operationId)
            ?: reject(JournalRejectionCode.WORK_NOT_FOUND, "The saved action could not be found.")
        if (operation.payloadSha256 != command.expectedPayloadSha256) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The server response does not match the saved action.")
        }
        val receiptHash = sha256(command.canonicalReceiptBytes)
        dao.receipt(command.operationId)?.let { existing ->
            if (existing.receiptSha256 != receiptHash || existing.canonicalServerDigest != command.canonicalServerDigest || !existing.canonicalReceiptBytes.contentEquals(command.canonicalReceiptBytes)) {
                reject(JournalRejectionCode.RECEIPT_CONFLICT, "Two different server results were received for the same action.")
            }
            return@transaction ReceiptApplied(command.operationId, replayed = true)
        }
        dao.insertReceipt(
            ReceiptEntity(
                operationId = command.operationId,
                receiptSchemaVersion = 1,
                canonicalReceiptBytes = command.canonicalReceiptBytes.copyOf(),
                receiptSha256 = receiptHash,
                canonicalServerDigest = command.canonicalServerDigest,
                serverEffectId = command.serverEffectId,
                acceptedAtEpochMs = command.acceptedAtEpochMs,
            ),
        )
        if (dao.updateOperationState(command.operationId, OperationState.ACKNOWLEDGED.name, null) != 1) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved action could not be acknowledged.")
        }
        if (dao.updateOutboxState(command.operationId, OutboxState.ACKNOWLEDGED.name, command.acceptedAtEpochMs) != 1) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "The send record could not be acknowledged.")
        }
        if (operation.operationType == OperationType.FINISH.name) {
            val chain = dao.workChainByFinish(operation.operationId)
                ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The completed cleaning chain is missing.")
            if (dao.completeWorkChainByFinish(operation.operationId, command.acceptedAtEpochMs) != 1) {
                reject(JournalRejectionCode.INTEGRITY_FAILURE, "The completed cleaning could not be closed.")
            }
            if (dao.updateFinishDraftState(chain.startOperationId, FinishDraftState.RETIRED_AFTER_RECEIPT.name, command.acceptedAtEpochMs) != 1) {
                reject(JournalRejectionCode.INTEGRITY_FAILURE, "The completed cleaning details could not be retired.")
            }
        }
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(command.operationId, "ACKNOWLEDGED", command.canonicalServerDigest),
                operationId = command.operationId,
                transitionKind = "SENT_TO_ZOO",
                message = "Sent to the zoo system.",
                createdAtEpochMs = command.acceptedAtEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        ReceiptApplied(command.operationId, replayed = false)
    }

    suspend fun applyTerminalFinishConflict(
        finishOperationId: String,
        code: String,
        detailDigest: String,
        wallEpochMs: Long,
    ): JournalResult<SupportCaseEntity> = transaction {
        val finish = dao.operation(finishOperationId)
            ?: reject(JournalRejectionCode.WORK_NOT_FOUND, "The finish record could not be found.")
        if (finish.operationType != OperationType.FINISH.name) reject(JournalRejectionCode.INTEGRITY_FAILURE, "Only a finish can receive this conflict.")
        val chain = dao.workChainByFinish(finishOperationId)
            ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The finish is not attached to a cleaning.")
        if (dao.receipt(finishOperationId) != null || finish.state == OperationState.ACKNOWLEDGED.name) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "This finish was already accepted by the zoo system.")
        }
        dao.updateOperationState(finishOperationId, OperationState.BLOCKED.name, code)
        dao.updateOutboxState(finishOperationId, OutboxState.BLOCKED.name, wallEpochMs)
        if (dao.markWorkChainConflict(finishOperationId, ManagerHelpCause.FINISH_TERMINAL_CONFLICT.name, wallEpochMs) != 1) {
            reject(JournalRejectionCode.WORK_NOT_ACTIVE, "The cleaning was already completed or cancelled.")
        }
        dao.updateFinishDraftState(chain.startOperationId, FinishDraftState.NEEDS_MANAGER.name, wallEpochMs)
        dao.insertDiagnostic(
            OperationDiagnosticEntity(
                diagnosticId = deterministicId(finishOperationId, code, detailDigest),
                operationId = finishOperationId,
                source = "SERVER_CANONICAL",
                code = code,
                detailDigest = detailDigest,
                leaseOwner = null,
                leaseGeneration = null,
                observedAtEpochMs = wallEpochMs,
            ),
        )
        val support = SupportCaseEntity(
            supportCaseId = deterministicId(chain.startOperationId, "support", chain.resolutionGeneration.toString()),
            startOperationId = chain.startOperationId,
            resolutionGeneration = chain.resolutionGeneration,
            reasonCode = ManagerHelpCause.FINISH_TERMINAL_CONFLICT.name,
            note = "",
            state = SupportCaseState.LOCAL_PENDING.name,
            canonicalResolutionOperationId = null,
            canonicalResolutionDigest = null,
            serverSequence = null,
            createdAtEpochMs = wallEpochMs,
            updatedAtEpochMs = wallEpochMs,
        )
        dao.insertSupportCase(support)
        dao.insertUiTransition(
            UiTransitionEntity(
                transitionId = deterministicId(finishOperationId, "NEEDS_MANAGER"),
                operationId = finishOperationId,
                transitionKind = "NEEDS_MANAGER",
                message = "Saved on this phone. Ask a manager for help.",
                createdAtEpochMs = wallEpochMs,
                announcedAtEpochMs = null,
            ),
        )
        dao.supportCase(chain.startOperationId, chain.resolutionGeneration) ?: support
    }

    suspend fun leaseNextRunnable(
        leaseOwner: String,
        bootSessionId: String,
        elapsedMs: Long,
        durationMs: Long,
        wallEpochMs: Long,
    ): JournalResult<LeaseToken?> = transaction {
        val device = dao.deviceState() ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone is not ready to send work.")
        if (device.legacyCutoverState != CutoverState.COMPLETE.name) reject(JournalRejectionCode.CUTOVER_INCOMPLETE, "Saved work is still being prepared.")
        if (device.leaseAdmissionState != GateState.OPEN.name) reject(JournalRejectionCode.LEASE_ADMISSION_CLOSED, "Sending is paused while this phone updates securely.")
        val operationId = dao.nextRunnableOperationId(bootSessionId, elapsedMs) ?: return@transaction null
        if (dao.leaseOperation(operationId, leaseOwner, bootSessionId, elapsedMs, durationMs, wallEpochMs, device.leaseAdmissionGeneration) != 1) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "Another sender already claimed this saved action.")
        }
        if (dao.markOperationLeased(operationId) != 1) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "The saved action changed before sending.")
        }
        val outbox = dao.outbox(operationId) ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The send record is missing.")
        val operation = dao.operation(operationId) ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved action is missing.")
        LeaseToken(
            operationId = operation.operationId,
            operationType = OperationType.valueOf(operation.operationType),
            canonicalRequestBytes = operation.canonicalRequestBytes.copyOf(),
            payloadSha256 = operation.payloadSha256,
            reconciliationKind = ReconciliationKind.valueOf(outbox.nextReconciliationKind),
            leaseOwner = leaseOwner,
            leaseGeneration = outbox.leaseGeneration,
        )
    }

    suspend fun applyLeaseFailure(
        operationId: String,
        leaseOwner: String,
        leaseGeneration: Long,
        ambiguous: Boolean,
        code: String,
        detailDigest: String,
        retryDelayMs: Long,
        wallEpochMs: Long,
    ): JournalResult<Boolean> = transaction {
        val state = if (ambiguous) OutboxState.AMBIGUOUS.name else OutboxState.PENDING.name
        val reconciliation = if (ambiguous) {
            ReconciliationKind.READ_CANONICAL_STATUS
        } else {
            ReconciliationKind.SEND_EXACT_BYTES
        }
        val changed = dao.applyLeaseFailure(
            operationId,
            leaseOwner,
            leaseGeneration,
            state,
            retryDelayMs.coerceAtLeast(0),
            reconciliation.name,
            wallEpochMs,
        ) == 1
        if (changed) {
            dao.updateOperationState(operationId, if (ambiguous) OperationState.AMBIGUOUS.name else OperationState.PENDING.name, code)
            dao.insertDiagnostic(
                OperationDiagnosticEntity(
                    diagnosticId = deterministicId(operationId, leaseOwner, leaseGeneration.toString(), code, detailDigest),
                    operationId = operationId,
                    source = "TRANSPORT",
                    code = code,
                    detailDigest = detailDigest,
                    leaseOwner = leaseOwner,
                    leaseGeneration = leaseGeneration,
                    observedAtEpochMs = wallEpochMs,
                ),
            )
        }
        changed
    }

    suspend fun deviceState(): DeviceStateEntity? = dao.deviceState()
    suspend fun bootSession(bootSessionId: String): BootSessionEntity? = dao.bootSession(bootSessionId)
    suspend fun nfcFieldState(installationId: String): NfcFieldStateEntity? = dao.nfcFieldState(installationId)
    suspend fun currentPointer(installationId: String): CurrentWorkPointerEntity? = dao.currentWorkPointer(installationId)
    suspend fun currentWork(installationId: String): CurrentWorkProjection? = dao.currentWorkProjection(installationId)
    suspend fun latestUnsettledWork(): CurrentWorkProjection? = dao.latestUnsettledWorkProjection()
    suspend fun pendingScanDelivery(installationId: String): ScanDeliveryEntity? = dao.pendingScanDelivery(installationId)
    suspend fun workChain(startOperationId: String): WorkChainEntity? = dao.workChain(startOperationId)
    suspend fun operation(operationId: String): OperationEntity? = dao.operation(operationId)
    suspend fun outbox(operationId: String): OutboxEntity? = dao.outbox(operationId)
    suspend fun finishDraft(startOperationId: String): FinishDraftEntity? = dao.finishDraftForStart(startOperationId)
    suspend fun receipt(operationId: String): ReceiptEntity? = dao.receipt(operationId)
    suspend fun operationCount(): Int = dao.operationCount()
    suspend fun pointerCount(): Int = dao.currentWorkPointerCount()
    suspend fun pendingOperationCount(): Int = dao.pendingOperationCount()
    suspend fun transitions(): List<UiTransitionEntity> = dao.uiTransitions()
    suspend fun nextUnannouncedTransition(): UiTransitionEntity? = dao.nextUnannouncedUiTransition()

    suspend fun markTransitionAnnounced(transitionId: String, announcedAtEpochMs: Long): Boolean =
        dao.markUiTransitionAnnounced(transitionId, announcedAtEpochMs) == 1

    suspend fun runtimeSnapshot(): JournalRuntimeSnapshot {
        val device = dao.deviceState()
        return JournalRuntimeSnapshot(
            deviceState = device,
            currentWork = device?.let { dao.currentWorkProjection(it.installationId) },
            latestUnsettledWork = dao.latestUnsettledWorkProjection(),
            nfcFieldState = device?.let { dao.nfcFieldState(it.installationId) },
            pendingOperationCount = dao.pendingOperationCount(),
        )
    }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    fun observeRuntime(): Flow<JournalRuntimeSnapshot> = dao.observeDeviceState().flatMapLatest { device ->
        if (device == null) {
            combine(
                dao.observeLatestUnsettledWorkProjection(),
                dao.observePendingOperationCount(),
            ) { unsettled, pending ->
                JournalRuntimeSnapshot(null, null, unsettled, null, pending)
            }
        } else {
            combine(
                dao.observeCurrentWorkProjection(device.installationId),
                dao.observeLatestUnsettledWorkProjection(),
                dao.observeNfcFieldState(device.installationId),
                dao.observePendingOperationCount(),
            ) { current, unsettled, field, pending ->
                JournalRuntimeSnapshot(device, current, unsettled, field, pending)
            }
        }
    }.distinctUntilChanged()

    suspend fun activeAssignmentForTag(
        payloadHash: String,
        trustedTime: org.memphiszoo.custodial.domain.TrustedTimeInterval,
    ): JournalResult<AssignmentSnapshotEntity> = transaction {
        val device = dao.deviceState()
            ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone needs manager setup before it can start work.")
        val candidates = dao.activeAssignmentsForTag(payloadHash, device.employeeId, device.installationId)
        if (candidates.isEmpty()) {
            reject(JournalRejectionCode.ASSIGNMENT_NOT_FOUND, "This location is not assigned to this phone right now.")
        }
        val eligible = candidates.filter { snapshot ->
            snapshot.state == AssignmentSnapshotState.ACTIVE.name &&
                trustedTime.earliestEpochMs >= snapshot.ownershipStartEpochMs &&
                trustedTime.latestEpochMs <= snapshot.ownershipEndEpochMs &&
                trustedTime.latestEpochMs <= snapshot.offlineValidThroughEpochMs
        }
        if (eligible.isEmpty()) {
            reject(JournalRejectionCode.ASSIGNMENT_TIME_OUTSIDE_WINDOW, "Connect this phone to refresh who owns this location now.")
        }
        val selected = eligible.first()
        val ambiguous = eligible.drop(1).any { other ->
            other.scheduleRevision == selected.scheduleRevision &&
                other.datedExceptionRevision == selected.datedExceptionRevision &&
                other.issuedAtEpochMs == selected.issuedAtEpochMs &&
                (other.workOccurrenceId != selected.workOccurrenceId || other.locationId != selected.locationId)
        }
        if (ambiguous) {
            reject(JournalRejectionCode.INTEGRITY_FAILURE, "Two current assignments claim this tag. Ask a manager for help.")
        }
        selected
    }

    suspend fun applyPermanentOperationConflict(
        operationId: String,
        code: String,
        detailDigest: String,
        wallEpochMs: Long,
    ): JournalResult<SupportCaseEntity?> {
        val operation = dao.operation(operationId)
            ?: return JournalResult.Rejected(JournalRejectionCode.WORK_NOT_FOUND, "The saved action could not be found.")
        return if (operation.operationType == OperationType.FINISH.name) {
            when (val result = applyTerminalFinishConflict(operationId, code, detailDigest, wallEpochMs)) {
                is JournalResult.Success -> JournalResult.Success(result.value)
                is JournalResult.Rejected -> result
            }
        } else {
            transaction {
                if (dao.receipt(operationId) != null || operation.state == OperationState.ACKNOWLEDGED.name) {
                    reject(JournalRejectionCode.CONCURRENT_CONFLICT, "This action was already accepted by the zoo system.")
                }
                if (dao.updateOperationState(operationId, OperationState.BLOCKED.name, code) != 1) {
                    reject(JournalRejectionCode.INTEGRITY_FAILURE, "The saved action could not be blocked safely.")
                }
                if (dao.updateOutboxState(operationId, OutboxState.BLOCKED.name, wallEpochMs) != 1) {
                    reject(JournalRejectionCode.INTEGRITY_FAILURE, "The send record could not be blocked safely.")
                }
                dao.insertDiagnostic(
                    OperationDiagnosticEntity(
                        diagnosticId = deterministicId(operationId, code, detailDigest),
                        operationId = operationId,
                        source = "SERVER_CANONICAL",
                        code = code,
                        detailDigest = detailDigest,
                        leaseOwner = null,
                        leaseGeneration = null,
                        observedAtEpochMs = wallEpochMs,
                    ),
                )
                if (operation.operationType != OperationType.START.name) return@transaction null
                val chain = dao.workChain(operationId)
                    ?: reject(JournalRejectionCode.INTEGRITY_FAILURE, "The cleaning linked to this start is missing.")
                if (dao.markWorkChainConflictByStart(operationId, ManagerHelpCause.DUPLICATE_WORK_OCCURRENCE.name, wallEpochMs) != 1) {
                    reject(JournalRejectionCode.WORK_NOT_ACTIVE, "This cleaning was already completed or cancelled.")
                }
                dao.deleteCurrentWorkPointer(operation.deviceInstallationId, operationId)
                val support = SupportCaseEntity(
                    supportCaseId = deterministicId(chain.startOperationId, "support", chain.resolutionGeneration.toString()),
                    startOperationId = chain.startOperationId,
                    resolutionGeneration = chain.resolutionGeneration,
                    reasonCode = ManagerHelpCause.DUPLICATE_WORK_OCCURRENCE.name,
                    note = "",
                    state = SupportCaseState.LOCAL_PENDING.name,
                    canonicalResolutionOperationId = null,
                    canonicalResolutionDigest = null,
                    serverSequence = null,
                    createdAtEpochMs = wallEpochMs,
                    updatedAtEpochMs = wallEpochMs,
                )
                dao.insertSupportCase(support)
                dao.insertUiTransition(
                    UiTransitionEntity(
                        transitionId = deterministicId(operationId, "NEEDS_MANAGER"),
                        operationId = operationId,
                        transitionKind = "NEEDS_MANAGER",
                        message = "Saved on this phone. Ask a manager for help.",
                        createdAtEpochMs = wallEpochMs,
                        announcedAtEpochMs = null,
                    ),
                )
                dao.supportCase(chain.startOperationId, chain.resolutionGeneration) ?: support
            }
        }
    }

    private suspend fun requireCreationAuthority(
        expectedCreationEpoch: Long,
        expectedOperationFenceGeneration: Long,
        expectedLeaseFenceGeneration: Long,
        expectedCutoverGeneration: Long,
        expectedBootSessionId: String,
    ): DeviceStateEntity {
        val device = dao.deviceState() ?: reject(JournalRejectionCode.NOT_INITIALIZED, "This phone is not ready for work.")
        if (device.currentBootSessionId != expectedBootSessionId) {
            reject(JournalRejectionCode.IDENTITY_MISMATCH, "The phone restarted. Restore the current work state before continuing.")
        }
        if (device.legacyCutoverState != CutoverState.COMPLETE.name) reject(JournalRejectionCode.CUTOVER_INCOMPLETE, "Saved work is still being prepared.")
        if (device.legacyCutoverGeneration != expectedCutoverGeneration) reject(JournalRejectionCode.STALE_FENCE_GENERATION, "The saved work state changed. Try the tag again.")
        if (device.operationCreationFenceState != GateState.OPEN.name) reject(JournalRejectionCode.OPERATION_CREATION_CLOSED, "Starting and finishing are paused while this phone updates securely.")
        if (device.leaseAdmissionState != GateState.OPEN.name) reject(JournalRejectionCode.LEASE_ADMISSION_CLOSED, "Sending is paused while this phone updates securely.")
        if (device.operationCreationFenceGeneration != expectedOperationFenceGeneration || device.leaseAdmissionGeneration != expectedLeaseFenceGeneration) {
            reject(JournalRejectionCode.STALE_FENCE_GENERATION, "The secure phone state changed. Try again.")
        }
        if (device.creationEpoch != expectedCreationEpoch) reject(JournalRejectionCode.STALE_CREATION_EPOCH, "The employee assignment changed. Ask a manager for help.")
        return device
    }

    private fun validateSnapshot(
        device: DeviceStateEntity,
        snapshot: AssignmentSnapshotEntity,
        locationId: String,
        trustedTime: org.memphiszoo.custodial.domain.TrustedTimeInterval,
    ) {
        if (snapshot.state != AssignmentSnapshotState.ACTIVE.name) reject(JournalRejectionCode.ASSIGNMENT_NOT_ACTIVE, "This saved assignment is no longer current.")
        if (snapshot.employeeId != device.employeeId || snapshot.deviceInstallationId != device.installationId || snapshot.locationId != locationId) {
            reject(JournalRejectionCode.ASSIGNMENT_BINDING_MISMATCH, "This location belongs to a different current assignment.")
        }
        if (
            trustedTime.earliestEpochMs < snapshot.ownershipStartEpochMs ||
            trustedTime.latestEpochMs > snapshot.ownershipEndEpochMs ||
            trustedTime.latestEpochMs > snapshot.offlineValidThroughEpochMs
        ) {
            reject(JournalRejectionCode.ASSIGNMENT_TIME_OUTSIDE_WINDOW, "Connect this phone to refresh who owns this location now.")
        }
    }

    private suspend fun requireAvailableScan(deliveryId: String, expectedTagHash: String): ScanDeliveryEntity {
        val scan = dao.scanDelivery(deliveryId) ?: reject(JournalRejectionCode.SCAN_NOT_FOUND, "Hold the phone to the location tag again.")
        if (!scan.liveTagVerified || scan.livePayloadRereadHash != scan.ndefPayloadHash) reject(JournalRejectionCode.LIVE_TAG_REQUIRED, "Hold the phone to the location tag again.")
        if (scan.outcomeCode != null) reject(JournalRejectionCode.SCAN_ALREADY_CONSUMED, "That scan was already handled.")
        if (scan.ndefPayloadHash != expectedTagHash) reject(JournalRejectionCode.TAG_MISMATCH, "This is not the tag for the current location.")
        val field = dao.nfcFieldState(scan.installationId) ?: reject(JournalRejectionCode.NOT_INITIALIZED, "The scanner is not ready.")
        val acceptedGenerationState = field.state == NfcFieldState.ACCEPTED_WAITING_FOR_ABSENCE.name ||
            field.state == NfcFieldState.RECOVERY_ABSENCE_PROBE.name ||
            field.state == NfcFieldState.ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY.name
        if (!acceptedGenerationState || field.acceptedDeliveryId != scan.deliveryId || field.fieldGeneration != scan.fieldGeneration) {
            reject(JournalRejectionCode.SCAN_ALREADY_CONSUMED, "That scan is no longer active.")
        }
        return scan
    }

    private suspend fun allocateSequence(): Long {
        val sequence = dao.deviceSequence() ?: reject(JournalRejectionCode.NOT_INITIALIZED, "The saved-work sequence is missing.")
        if (dao.advanceSequence(sequence.nextSequence, sequence.nextSequence + 1) != 1) {
            reject(JournalRejectionCode.CONCURRENT_CONFLICT, "Another action was saved at the same time. Try again.")
        }
        return sequence.nextSequence
    }
}
