package org.memphiszoo.custodial.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.memphiszoo.custodial.domain.AssignmentSnapshotCandidate
import org.memphiszoo.custodial.domain.AssignmentSnapshotVerifier
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.CutoverState
import org.memphiszoo.custodial.domain.DeviceBootstrap
import org.memphiszoo.custodial.domain.FinishCleaningCommand
import org.memphiszoo.custodial.domain.FinishDraftState
import org.memphiszoo.custodial.domain.JournalRejectionCode
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.ManagerHelpCause
import org.memphiszoo.custodial.domain.RequestManagerHelpCommand
import org.memphiszoo.custodial.domain.NfcFieldState
import org.memphiszoo.custodial.domain.OperationState
import org.memphiszoo.custodial.domain.OutboxState
import org.memphiszoo.custodial.domain.ScanSource
import org.memphiszoo.custodial.domain.StartCleaningCommand
import org.memphiszoo.custodial.domain.TrustedTimeInterval
import org.memphiszoo.custodial.domain.VerifiedScanInput
import org.memphiszoo.custodial.domain.WorkChainState

@RunWith(AndroidJUnit4::class)
class JournalRepositoryInstrumentedTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var database: CustodialDatabase
    private lateinit var repository: JournalRepository

    private val installationId = "installation-kiosk-08"
    private val employeeId = "employee-karen"
    private val bootSessionId = "boot-1"
    private var wall = 1_800_000_000_000L
    private var elapsed = 10_000L

    @Before
    fun setUp() {
        runBlocking {
            database = newDatabase()
            repository = JournalRepository(database, verifier())
            repository.initializeDevice(bootstrap(), wall).success()
        }
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun exactStartReplayReturnsPriorOutcomeWithoutDuplicateRows() = runBlocking {
        val snapshot = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val scan = recordScan("scan-a", "tag-a")
        val command = startCommand("start-a", scan.deliveryId, snapshot, "start-a-bytes")

        val first = repository.startCleaning(command).success()
        val replay = repository.startCleaning(command).success()

        assertFalse(first.replayed)
        assertTrue(replay.replayed)
        assertEquals(first.startOperationId, replay.startOperationId)
        assertEquals(1, repository.operationCount())
        assertEquals(1, repository.pointerCount())
    }

    @Test
    fun concurrentStartAttemptsCreateExactlyOneWorkChainAndPointer() = runBlocking {
        val snapshot = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val scan = recordScan("scan-a", "tag-a")
        val commands = listOf(
            startCommand("start-a", scan.deliveryId, snapshot, "start-a-bytes"),
            startCommand("start-b", scan.deliveryId, snapshot, "start-b-bytes"),
        )

        val results = withContext(Dispatchers.Default) {
            commands.map { command -> async { repository.startCleaning(command) } }.awaitAll()
        }

        assertEquals(1, results.count { it is JournalResult.Success })
        assertEquals(1, results.count { it is JournalResult.Rejected })
        assertEquals(1, repository.operationCount())
        assertEquals(1, repository.pointerCount())
    }

    @Test
    fun notNowConsumesScanWithoutCreatingWorkAndRequiresTagRemoval() = runBlocking {
        recordScan("scan-a", "tag-a")

        val first = repository.dismissScan("scan-a", wall + 1).success()
        val replay = repository.dismissScan("scan-a", wall + 2).success()
        val heldTag = repository.recordVerifiedScan(scanInput("scan-b", "tag-a"))

        assertFalse(first.replayed)
        assertTrue(replay.replayed)
        assertEquals(JournalRejectionCode.TAG_STILL_PRESENT, heldTag.rejectionCode())
        assertEquals(0, repository.operationCount())
        assertEquals(0, repository.pointerCount())
        assertEquals(listOf("Cleaning not started."), repository.transitions().map { it.message })
    }

    @Test
    fun acceptedScanRemainsUsableAfterEmployeeMovesPhoneAwayBeforeStart() = runBlocking {
        val snapshot = acceptSnapshot("snapshot-away", "occurrence-away", "location-away", "Teton Restrooms", "tag-away")
        val scan = recordScan("scan-away", "tag-away")
        removeTag()

        val started = repository.startCleaning(startCommand("start-away", scan.deliveryId, snapshot, "start-away")).success()

        assertEquals("start-away", started.operationId)
        assertEquals("start-away", repository.currentPointer(installationId)?.startOperationId)
        assertEquals(WorkChainState.ACTIVE.name, repository.workChain("start-away")?.state)
    }

    @Test
    fun abandonedLeaseCanBeReclaimedWithHigherGeneration() = runBlocking {
        val snapshot = acceptSnapshot("snapshot-lease", "occurrence-lease", "location-lease", "Teton Restrooms", "tag-lease")
        val scan = recordScan("scan-lease", "tag-lease")
        repository.startCleaning(startCommand("start-lease", scan.deliveryId, snapshot, "start-lease")).success()

        val first = repository.leaseNextRunnable("worker-a", bootSessionId, 20_000, 1_000, wall + 10).success()!!
        val reclaimed = repository.leaseNextRunnable("worker-b", bootSessionId, 21_001, 1_000, wall + 20).success()!!

        assertEquals("start-lease", first.operationId)
        assertEquals("start-lease", reclaimed.operationId)
        assertEquals(first.leaseGeneration + 1, reclaimed.leaseGeneration)
        assertEquals("worker-b", reclaimed.leaseOwner)
    }

    @Test
    fun terminallyResolvedFinishBarrierAllowsLaterOfflineStartToSend() = runBlocking {
        createFinishedAThenStartB()
        acknowledge("start-a", "receipt-start-a", "effect-start-a")
        repository.applyTerminalFinishConflict("finish-a", "FINISH_CONFLICT", "detail", wall + 500).success()

        val next = repository.leaseNextRunnable("worker-b", bootSessionId, elapsed + 1_000, 2_000, wall + 600).success()

        assertNotNull(next)
        assertEquals("start-b", next?.operationId)
    }

    @Test
    fun needHelpPreservesDraftReleasesPointerAndQueuesExactlyOnce() = runBlocking {
        val snapshot = acceptSnapshot("snapshot-help", "occurrence-help", "location-help", "Aquarium Restrooms", "tag-help")
        val scan = recordScan("scan-help", "tag-help")
        repository.startCleaning(startCommand("start-help", scan.deliveryId, snapshot, "start-help")).success()
        repository.saveFinishDraft(
            installationId = installationId,
            startOperationId = "start-help",
            draftId = "draft-help",
            canonicalAnswerBytes = "answers-help".toByteArray(),
            note = "Need more supplies",
            issuePayloadBytes = null,
            wallEpochMs = wall + 1,
        ).success()
        val command = helpCommand("help-operation", "start-help", "Need more supplies")

        val first = repository.requestManagerHelp(command).success()
        val replay = repository.requestManagerHelp(command).success()

        assertFalse(first.replayed)
        assertTrue(replay.replayed)
        assertEquals(first.supportCaseId, replay.supportCaseId)
        assertNull(repository.currentPointer(installationId))
        assertEquals(WorkChainState.NEEDS_MANAGER.name, repository.workChain("start-help")?.state)
        assertEquals(FinishDraftState.NEEDS_MANAGER.name, repository.finishDraft("start-help")?.state)
        assertEquals(OutboxState.PENDING.name, repository.outbox("help-operation")?.deliveryState)
        assertEquals(2, repository.operationCount())
    }

    @Test
    fun finishAReleasesPointerSoCleaningBCanStartOfflineBehindBarrier() = runBlocking {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val startAScan = recordScan("scan-a-start", "tag-a")
        repository.startCleaning(startCommand("start-a", startAScan.deliveryId, a, "start-a")).success()
        removeTag()
        val finishAScan = recordScan("scan-a-finish", "tag-a")
        repository.finishCleaning(finishCommand("finish-a", "start-a", finishAScan.deliveryId, "draft-a", "finish-a")).success()

        assertNull(repository.currentPointer(installationId))
        assertEquals(WorkChainState.FINISHING.name, repository.workChain("start-a")?.state)

        removeTag()
        val b = acceptSnapshot("snapshot-b", "occurrence-b", "location-b", "Aquarium Restrooms", "tag-b")
        val startBScan = recordScan("scan-b-start", "tag-b")
        repository.startCleaning(startCommand("start-b", startBScan.deliveryId, b, "start-b")).success()

        assertEquals("start-b", repository.currentPointer(installationId)?.startOperationId)
        assertEquals("finish-a", repository.outbox("start-b")?.barrierOperationId)
        assertEquals(3, repository.operationCount())
    }

    @Test
    fun terminalConflictForFinishedADoesNotAlterLaterActiveCleaningB() = runBlocking {
        val finishA = createFinishedAThenStartB()

        repository.applyTerminalFinishConflict(
            finishOperationId = finishA,
            code = "FINISH_CONFLICT",
            detailDigest = "detail-a",
            wallEpochMs = wall + 100,
        ).success()

        assertEquals(WorkChainState.NEEDS_MANAGER.name, repository.workChain("start-a")?.state)
        assertEquals(FinishDraftState.NEEDS_MANAGER.name, repository.finishDraft("start-a")?.state)
        assertEquals("start-b", repository.currentPointer(installationId)?.startOperationId)
        assertEquals(WorkChainState.ACTIVE.name, repository.workChain("start-b")?.state)
    }

    @Test
    fun canonicalFinishReceiptForACompletesOnlyAWhileBStaysCurrent() = runBlocking {
        val finishA = createFinishedAThenStartB()
        acknowledge("start-a", "receipt-start-a", "effect-start-a")
        acknowledge(finishA, "receipt-finish-a", "effect-finish-a")

        assertEquals(WorkChainState.COMPLETED.name, repository.workChain("start-a")?.state)
        assertEquals(FinishDraftState.RETIRED_AFTER_RECEIPT.name, repository.finishDraft("start-a")?.state)
        assertEquals("start-b", repository.currentPointer(installationId)?.startOperationId)
        assertEquals(WorkChainState.ACTIVE.name, repository.workChain("start-b")?.state)
    }

    @Test
    fun canonicalReceiptPreventsLaterTerminalConflictRegression() = runBlocking {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val startScan = recordScan("scan-a-start", "tag-a")
        repository.startCleaning(startCommand("start-a", startScan.deliveryId, a, "start-a")).success()
        removeTag()
        val finishScan = recordScan("scan-a-finish", "tag-a")
        repository.finishCleaning(finishCommand("finish-a", "start-a", finishScan.deliveryId, "draft-a", "finish-a")).success()
        acknowledge("finish-a", "receipt-finish-a", "effect-finish-a")

        val conflict = repository.applyTerminalFinishConflict("finish-a", "LATE_FAILURE", "detail", wall + 200)

        assertEquals(JournalRejectionCode.CONCURRENT_CONFLICT, conflict.rejectionCode())
        assertEquals(OperationState.ACKNOWLEDGED.name, repository.operation("finish-a")?.state)
        assertEquals(OutboxState.ACKNOWLEDGED.name, repository.outbox("finish-a")?.deliveryState)
        assertEquals(WorkChainState.COMPLETED.name, repository.workChain("start-a")?.state)
    }

    @Test
    fun staleLeaseFailureCannotRegressCanonicalReceipt() = runBlocking {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val scan = recordScan("scan-a", "tag-a")
        repository.startCleaning(startCommand("start-a", scan.deliveryId, a, "start-a")).success()

        val lease = repository.leaseNextRunnable("worker-a", bootSessionId, elapsed + 10, 1_000, wall + 10).success()
        assertNotNull(lease)
        acknowledge("start-a", "receipt-start-a", "effect-start-a")
        val stale = repository.applyLeaseFailure(
            operationId = "start-a",
            leaseOwner = "worker-a",
            leaseGeneration = lease!!.leaseGeneration,
            ambiguous = true,
            code = "TIMEOUT",
            detailDigest = "timeout-detail",
            retryDelayMs = 5_000,
            wallEpochMs = wall + 20,
        ).success()

        assertFalse(stale)
        assertEquals(OperationState.ACKNOWLEDGED.name, repository.operation("start-a")?.state)
        assertEquals(OutboxState.ACKNOWLEDGED.name, repository.outbox("start-a")?.deliveryState)
    }

    @Test
    fun retryDelayIsMeasuredByElapsedTimeAndRebootMakesRetryImmediatelyEligible() = runBlocking {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val scan = recordScan("scan-a", "tag-a")
        repository.startCleaning(startCommand("start-a", scan.deliveryId, a, "start-a")).success()
        val first = repository.leaseNextRunnable("worker-a", bootSessionId, 20_000, 1_000, wall + 10).success()!!
        assertTrue(repository.applyLeaseFailure("start-a", "worker-a", first.leaseGeneration, false, "NETWORK", "detail", 5_000, wall + 20).success())

        assertNull(repository.leaseNextRunnable("worker-b", bootSessionId, 24_999, 1_000, wall + 30).success())
        assertNotNull(repository.leaseNextRunnable("worker-b", bootSessionId, 25_000, 1_000, wall + 40).success())
    }

    @Test
    fun importingCutoverAndUntrustedAssignmentBothBlockNewStartWithoutPartialRows() = runBlocking {
        val importingDb = newDatabase()
        try {
            val importingRepo = JournalRepository(importingDb, verifier())
            importingRepo.initializeDevice(bootstrap(CutoverState.IMPORTING), wall).success()
            val candidate = snapshotCandidate("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
            importingRepo.acceptAssignmentSnapshot(candidate, wall).success()
            importingRepo.recordVerifiedScan(scanInput("scan-a", "tag-a")).success()
            val result = importingRepo.startCleaning(startCommand("start-a", "scan-a", candidate.toEntityView(), "start-a"))
            assertEquals(JournalRejectionCode.CUTOVER_INCOMPLETE, result.rejectionCode())
            assertEquals(0, importingRepo.operationCount())
            assertEquals(0, importingRepo.pointerCount())
        } finally {
            importingDb.close()
        }

        val expired = acceptSnapshot(
            "snapshot-expired",
            "occurrence-expired",
            "location-expired",
            "Expired Restroom",
            "tag-expired",
            ownershipEnd = wall + 100,
            validThrough = wall + 100,
        )
        removeTagIfNeeded()
        val expiredScan = recordScan("scan-expired", "tag-expired")
        val expiredResult = repository.startCleaning(
            startCommand(
                "start-expired",
                expiredScan.deliveryId,
                expired,
                "start-expired",
                trusted = TrustedTimeInterval(wall + 101, wall + 102),
            ),
        )
        assertEquals(JournalRejectionCode.ASSIGNMENT_TIME_OUTSIDE_WINDOW, expiredResult.rejectionCode())
        assertNull(repository.operation("start-expired"))
    }

    @Test
    fun forgedScanWithoutLiveTagNeverCreatesDelivery() = runBlocking {
        val result = repository.recordVerifiedScan(scanInput("forged", "tag-a", live = false))

        assertEquals(JournalRejectionCode.LIVE_TAG_REQUIRED, result.rejectionCode())
        assertEquals(0, repository.operationCount())
    }

    @Test
    fun exactRequestBytesSurviveLeaseAndReceipt() = runBlocking {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val scan = recordScan("scan-a", "tag-a")
        val bytes = byteArrayOf(0, 1, 2, 3, 127, -1)
        repository.startCleaning(startCommand("start-a", scan.deliveryId, a, bytes = bytes)).success()

        val lease = repository.leaseNextRunnable("worker-a", bootSessionId, elapsed + 50, 2_000, wall + 50).success()!!
        assertArrayEquals(bytes, lease.canonicalRequestBytes)
        assertEquals(sha(bytes), lease.payloadSha256)
    }

    private fun newDatabase(): CustodialDatabase = Room.inMemoryDatabaseBuilder(context, CustodialDatabase::class.java)
        .allowMainThreadQueries()
        .build()

    private fun verifier(): AssignmentSnapshotVerifier = AssignmentSnapshotVerifier { candidate ->
        candidate.signatureDigest == "signature:${candidate.snapshotDigest}"
    }

    private fun bootstrap(cutover: CutoverState = CutoverState.COMPLETE) = DeviceBootstrap(
        installationId = installationId,
        originalInstallationNamespaceId = "original-kiosk-08",
        enrolledDeviceIdentifier = "KIOSK_08",
        employeeId = employeeId,
        employeeName = "Karen Robinson",
        assignmentEpoch = 1,
        attributionCredentialEpoch = 1,
        creationEpoch = 1,
        bootSessionId = bootSessionId,
        cutoverState = cutover,
    )

    private suspend fun acceptSnapshot(
        id: String,
        occurrence: String,
        location: String,
        name: String,
        tag: String,
        ownershipStart: Long = wall - 1_000,
        ownershipEnd: Long = wall + 100_000,
        validThrough: Long = wall + 100_000,
    ): AssignmentSnapshotEntity {
        val candidate = snapshotCandidate(id, occurrence, location, name, tag, ownershipStart, ownershipEnd, validThrough)
        return repository.acceptAssignmentSnapshot(candidate, wall).success()
    }

    private fun snapshotCandidate(
        id: String,
        occurrence: String,
        location: String,
        name: String,
        tag: String,
        ownershipStart: Long = wall - 1_000,
        ownershipEnd: Long = wall + 100_000,
        validThrough: Long = wall + 100_000,
    ): AssignmentSnapshotCandidate {
        val bytes = "$id|$occurrence|$location|$name|$tag|$ownershipStart|$ownershipEnd|$validThrough".toByteArray()
        val digest = sha(bytes)
        return AssignmentSnapshotCandidate(
            snapshotId = id,
            canonicalBytes = bytes,
            snapshotDigest = digest,
            signatureDigest = "signature:$digest",
            employeeId = employeeId,
            deviceInstallationId = installationId,
            operatingDate = "2026-08-30",
            scheduleVersion = "static-v1",
            scheduleRevision = 18,
            datedExceptionRevision = 0,
            workOccurrenceId = occurrence,
            attemptGeneration = 1,
            positionId = "position-karen",
            locationId = location,
            locationName = name,
            expectedTagPayloadHash = tag,
            ownershipStartEpochMs = ownershipStart,
            ownershipEndEpochMs = ownershipEnd,
            issuedAtEpochMs = wall - 2_000,
            offlineValidThroughEpochMs = validThrough,
            serverHighWaterMark = 10,
            trustedTimeLowerBoundAtAcceptance = wall - 500,
        )
    }

    private fun AssignmentSnapshotCandidate.toEntityView() = AssignmentSnapshotEntity(
        snapshotId = snapshotId,
        canonicalBytes = canonicalBytes,
        snapshotDigest = snapshotDigest,
        signatureDigest = signatureDigest,
        signatureBytes = signatureBytes,
        signingKeyId = signingKeyId,
        signatureAlgorithm = signatureAlgorithm,
        employeeId = employeeId,
        deviceInstallationId = deviceInstallationId,
        operatingDate = operatingDate,
        scheduleVersion = scheduleVersion,
        scheduleRevision = scheduleRevision,
        datedExceptionRevision = datedExceptionRevision,
        workOccurrenceId = workOccurrenceId,
        attemptGeneration = attemptGeneration,
        positionId = positionId,
        locationId = locationId,
        locationName = locationName,
        expectedTagPayloadHash = expectedTagPayloadHash,
        ownershipStartEpochMs = ownershipStartEpochMs,
        ownershipEndEpochMs = ownershipEndEpochMs,
        issuedAtEpochMs = issuedAtEpochMs,
        offlineValidThroughEpochMs = offlineValidThroughEpochMs,
        serverHighWaterMark = serverHighWaterMark,
        trustedTimeLowerBoundAtAcceptance = trustedTimeLowerBoundAtAcceptance,
        state = "ACTIVE",
        verifiedAtEpochMs = wall,
    )

    private suspend fun recordScan(id: String, tag: String): org.memphiszoo.custodial.domain.RecordedScan {
        elapsed += 100
        wall += 100
        return repository.recordVerifiedScan(scanInput(id, tag)).success()
    }

    private fun scanInput(id: String, tag: String, live: Boolean = true) = VerifiedScanInput(
        deliveryId = id,
        installationId = installationId,
        bootSessionId = bootSessionId,
        tagUidHash = "uid:$tag",
        ndefPayloadHash = tag,
        livePayloadRereadHash = if (live) tag else "different",
        source = ScanSource.READER,
        liveTagVerified = live,
        receivedElapsedMs = elapsed,
        receivedWallEpochMs = wall,
    )

    private suspend fun removeTag() {
        elapsed += 100
        wall += 100
        repository.confirmTagAbsent(installationId, "absence:$elapsed", elapsed, wall).success()
    }

    private suspend fun removeTagIfNeeded() {
        // Test helper tolerates the already-armed initial state.
        val result = repository.confirmTagAbsent(installationId, "absence:$elapsed", elapsed, wall)
        if (result is JournalResult.Rejected && result.code != JournalRejectionCode.INTEGRITY_FAILURE) {
            failNow("Unexpected tag-removal result: $result")
        }
    }

    private fun startCommand(
        operationId: String,
        deliveryId: String,
        snapshot: AssignmentSnapshotEntity,
        text: String = operationId,
        bytes: ByteArray = text.toByteArray(),
        trusted: TrustedTimeInterval = TrustedTimeInterval(wall, wall + 1),
    ) = StartCleaningCommand(
        operationId = operationId,
        deliveryId = deliveryId,
        assignmentSnapshotId = snapshot.snapshotId,
        locationId = snapshot.locationId,
        canonicalRequestBytes = bytes,
        wireSchemaVersion = 1,
        expectedCreationEpoch = 1,
        expectedOperationFenceGeneration = 1,
        expectedLeaseFenceGeneration = 1,
        expectedCutoverGeneration = 1,
        trustedTime = trusted,
        bootSessionId = bootSessionId,
        createdElapsedMs = elapsed,
        createdWallEpochMs = wall,
    )

    private fun finishCommand(
        operationId: String,
        startId: String,
        deliveryId: String,
        draftId: String,
        text: String,
    ) = FinishCleaningCommand(
        operationId = operationId,
        startOperationId = startId,
        deliveryId = deliveryId,
        draftId = draftId,
        canonicalAnswerBytes = "answers:$text".toByteArray(),
        note = "",
        issuePayloadBytes = null,
        canonicalRequestBytes = text.toByteArray(),
        wireSchemaVersion = 1,
        expectedCreationEpoch = 1,
        expectedOperationFenceGeneration = 1,
        expectedLeaseFenceGeneration = 1,
        expectedCutoverGeneration = 1,
        bootSessionId = bootSessionId,
        createdElapsedMs = elapsed,
        createdWallEpochMs = wall,
    )

    private fun helpCommand(operationId: String, startId: String, note: String) = RequestManagerHelpCommand(
        operationId = operationId,
        startOperationId = startId,
        reason = ManagerHelpCause.EMPLOYEE_REQUEST,
        note = note,
        canonicalRequestBytes = "$operationId|$startId|$note".toByteArray(),
        wireSchemaVersion = 1,
        expectedCreationEpoch = 1,
        expectedOperationFenceGeneration = 1,
        expectedLeaseFenceGeneration = 1,
        expectedCutoverGeneration = 1,
        bootSessionId = bootSessionId,
        createdElapsedMs = elapsed,
        createdWallEpochMs = wall,
    )

    private suspend fun createFinishedAThenStartB(): String {
        val a = acceptSnapshot("snapshot-a", "occurrence-a", "location-a", "Teton Restrooms", "tag-a")
        val startAScan = recordScan("scan-a-start", "tag-a")
        repository.startCleaning(startCommand("start-a", startAScan.deliveryId, a, "start-a")).success()
        removeTag()
        val finishAScan = recordScan("scan-a-finish", "tag-a")
        repository.finishCleaning(finishCommand("finish-a", "start-a", finishAScan.deliveryId, "draft-a", "finish-a")).success()
        removeTag()
        val b = acceptSnapshot("snapshot-b", "occurrence-b", "location-b", "Aquarium Restrooms", "tag-b")
        val startBScan = recordScan("scan-b-start", "tag-b")
        repository.startCleaning(startCommand("start-b", startBScan.deliveryId, b, "start-b")).success()
        return "finish-a"
    }

    private suspend fun acknowledge(operationId: String, receiptText: String, effectId: String) {
        val operation = repository.operation(operationId) ?: failNow("Missing operation $operationId")
        repository.applyCanonicalReceipt(
            CanonicalReceiptCommand(
                operationId = operationId,
                expectedPayloadSha256 = operation.payloadSha256,
                canonicalReceiptBytes = receiptText.toByteArray(),
                canonicalServerDigest = "server:$receiptText",
                serverEffectId = effectId,
                acceptedAtEpochMs = wall + 1_000,
            ),
        ).success()
    }

    private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }

    private fun failNow(message: String): Nothing = throw AssertionError(message)

    private fun <T> JournalResult<T>.success(): T = when (this) {
        is JournalResult.Success -> value
        is JournalResult.Rejected -> failNow("Expected success, got $code: $message")
    }

    private fun JournalResult<*>.rejectionCode(): JournalRejectionCode = when (this) {
        is JournalResult.Rejected -> code
        is JournalResult.Success -> failNow("Expected rejection, got success: $value")
    }
}
