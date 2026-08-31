package org.memphiszoo.custodial.runtime

import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.memphiszoo.custodial.data.AssignmentSnapshotEntity
import org.memphiszoo.custodial.data.CurrentWorkProjection
import org.memphiszoo.custodial.data.DeviceStateEntity
import org.memphiszoo.custodial.data.JournalRepository
import org.memphiszoo.custodial.data.JournalRuntimeSnapshot
import org.memphiszoo.custodial.domain.AdmittedCustodialTag
import org.memphiszoo.custodial.domain.AssignmentSummary
import org.memphiszoo.custodial.domain.CanonicalCommands
import org.memphiszoo.custodial.domain.CleaningScreenState
import org.memphiszoo.custodial.domain.CustodialAppState
import org.memphiszoo.custodial.domain.DeliveryState
import org.memphiszoo.custodial.domain.EmployeeIdentity
import org.memphiszoo.custodial.domain.FinishCleaningCommand
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.ManagerHelpCause
import org.memphiszoo.custodial.domain.NfcFieldState
import org.memphiszoo.custodial.domain.RequestManagerHelpCommand
import org.memphiszoo.custodial.domain.ScanSource
import org.memphiszoo.custodial.domain.StableOperationIds
import org.memphiszoo.custodial.domain.StartCleaningCommand
import org.memphiszoo.custodial.domain.VerifiedScanInput
import org.memphiszoo.custodial.domain.WorkChainState
import org.memphiszoo.custodial.domain.WorkSummary

class CustodialCoordinator(
    private val repository: JournalRepository,
    private val clock: AndroidRuntimeClock,
    private val onDeviceReady: (DeviceStateEntity) -> Unit,
    private val onOperationSaved: (String) -> Unit,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
) {
    private val started = AtomicBoolean(false)
    private val commandMutex = Mutex()
    private val _state = MutableStateFlow(CustodialAppState())
    val state: StateFlow<CustodialAppState> = _state.asStateFlow()
    private var configuredInstallationId: String? = null

    fun start() {
        if (!started.compareAndSet(false, true)) return
        scope.launch {
            repository.observeRuntime().collect { snapshot ->
                val device = snapshot.deviceState
                if (device != null && configuredInstallationId != device.installationId) {
                    val existing = repository.bootSession(device.currentBootSessionId)
                    val observation = clock.bootObservation(existing)
                    when (val reconciled = repository.reconcileBootSession(observation)) {
                        is JournalResult.Success -> {
                            configuredInstallationId = reconciled.value.installationId
                            onDeviceReady(reconciled.value)
                        }
                        is JournalResult.Rejected -> {
                            _state.value = _state.value.copy(
                                screen = CleaningScreenState.Error(reconciled.message, canRetry = true),
                                notice = reconciled.message,
                            )
                        }
                    }
                }
                applyRuntime(snapshot)
            }
        }
    }

    fun unlock() {
        _state.value = _state.value.copy(unlocked = true)
    }

    fun lock() {
        _state.value = _state.value.copy(unlocked = false)
    }

    fun clearNotice() {
        _state.value = _state.value.copy(notice = null)
    }

    fun onBootstrapStarted() {
        val current = _state.value
        _state.value = current.copy(
            busy = true,
            notice = if (current.identity == null) "Getting this phone ready…" else current.notice,
        )
    }

    internal fun onBootstrapOutcome(outcome: BootstrapOutcome) {
        val current = _state.value
        when (outcome) {
            is BootstrapOutcome.Ready -> {
                val nextScreen = when (current.screen) {
                    CleaningScreenState.SetupRequired,
                    is CleaningScreenState.Error -> CleaningScreenState.Ready
                    else -> current.screen
                }
                _state.value = current.copy(
                    screen = nextScreen,
                    busy = false,
                    notice = if (outcome.snapshotCount == 0) {
                        "Phone ready. No assigned locations are saved for today."
                    } else {
                        "Schedule saved on this phone."
                    },
                )
            }
            is BootstrapOutcome.SetupRequired -> {
                _state.value = current.copy(
                    screen = if (current.screen is CleaningScreenState.Active || current.screen is CleaningScreenState.FinishReady) current.screen else CleaningScreenState.SetupRequired,
                    busy = false,
                    notice = outcome.message,
                )
            }
            is BootstrapOutcome.Retryable -> {
                _state.value = current.copy(
                    screen = if (current.screen is CleaningScreenState.Active || current.screen is CleaningScreenState.FinishReady) current.screen else CleaningScreenState.Error(outcome.message, canRetry = true),
                    busy = false,
                    notice = outcome.message,
                )
            }
        }
    }

    fun onAdmittedTag(admitted: AdmittedCustodialTag) {
        scope.launch {
            commandMutex.withLock { handleAdmittedTag(admitted) }
        }
    }

    fun onTagReadFailure(message: String) {
        _state.value = _state.value.copy(notice = message)
    }

    fun onTagRemoved(absenceProofDigest: String) {
        scope.launch {
            commandMutex.withLock {
                val device = repository.deviceState() ?: return@withLock
                val moment = runCatching(clock::moment).getOrNull() ?: return@withLock
                when (val result = repository.confirmTagAbsent(
                    installationId = device.installationId,
                    absenceProofDigest = absenceProofDigest,
                    elapsedMs = moment.elapsedMs,
                    wallEpochMs = moment.wallEpochMs,
                )) {
                    is JournalResult.Success -> {
                        if (_state.value.notice?.startsWith("Move the phone away") == true) {
                            _state.value = _state.value.copy(notice = null)
                        }
                    }
                    is JournalResult.Rejected -> {
                        if (result.code.name != "INTEGRITY_FAILURE") {
                            _state.value = _state.value.copy(notice = result.message)
                        }
                    }
                }
            }
        }
    }

    fun startCleaning() {
        scope.launch {
            commandMutex.withLock {
                val confirmation = _state.value.screen as? CleaningScreenState.LocationConfirmed ?: return@withLock
                val device = repository.deviceState() ?: return@withLock showError("This phone needs manager setup before it can start work.")
                val moment = runCatching(clock::moment).getOrNull()
                    ?: return@withLock showError("This phone is restoring its secure work state. Try again.")
                val trusted = moment.trustedTime
                    ?: return@withLock showError("Connect this phone before starting a new cleaning.")
                val assignment = confirmation.assignment
                val operationId = StableOperationIds.derive("START", confirmation.deliveryId, assignment.snapshotId)
                val bytes = CanonicalCommands.start(
                    operationId = operationId,
                    assignmentSnapshotId = assignment.snapshotId,
                    workOccurrenceId = assignment.workOccurrenceId,
                    attemptGeneration = assignment.attemptGeneration,
                    deliveryId = confirmation.deliveryId,
                    employeeId = device.employeeId,
                    deviceInstallationId = device.installationId,
                    locationId = assignment.locationId,
                    createdAtEpochMs = moment.wallEpochMs,
                )
                _state.value = _state.value.copy(
                    screen = CleaningScreenState.SavingStart(assignment.locationName),
                    busy = true,
                    notice = null,
                    deliveryState = DeliveryState.SavingOnPhone,
                )
                when (val result = repository.startCleaning(
                    StartCleaningCommand(
                        operationId = operationId,
                        deliveryId = confirmation.deliveryId,
                        assignmentSnapshotId = assignment.snapshotId,
                        locationId = assignment.locationId,
                        canonicalRequestBytes = bytes,
                        wireSchemaVersion = 1,
                        expectedCreationEpoch = device.creationEpoch,
                        expectedOperationFenceGeneration = device.operationCreationFenceGeneration,
                        expectedLeaseFenceGeneration = device.leaseAdmissionGeneration,
                        expectedCutoverGeneration = device.legacyCutoverGeneration,
                        trustedTime = trusted,
                        bootSessionId = moment.bootSessionId,
                        createdElapsedMs = moment.elapsedMs,
                        createdWallEpochMs = moment.wallEpochMs,
                    ),
                )) {
                    is JournalResult.Success -> {
                        onOperationSaved(device.installationId)
                        _state.value = _state.value.copy(
                            screen = CleaningScreenState.Active(
                                WorkSummary(
                                    startOperationId = result.value.startOperationId,
                                    workOccurrenceId = assignment.workOccurrenceId,
                                    attemptGeneration = assignment.attemptGeneration,
                                    locationId = assignment.locationId,
                                    locationName = result.value.locationName,
                                    expectedTagPayloadHash = assignment.expectedTagPayloadHash,
                                    state = WorkChainState.ACTIVE,
                                ),
                            ),
                            busy = false,
                            notice = "You are cleaning ${result.value.locationName}.",
                            deliveryState = DeliveryState.SavedWaitingToSend,
                        )
                    }
                    is JournalResult.Rejected -> {
                        _state.value = _state.value.copy(
                            screen = confirmation,
                            busy = false,
                            notice = result.message,
                            deliveryState = DeliveryState.NotSaved(result.message),
                        )
                    }
                }
            }
        }
    }

    fun dismissScan() {
        scope.launch {
            commandMutex.withLock {
                val current = _state.value.screen
                val deliveryId = when (current) {
                    is CleaningScreenState.LocationConfirmed -> current.deliveryId
                    is CleaningScreenState.FinishReady -> current.deliveryId
                    else -> return@withLock
                }
                val wall = System.currentTimeMillis()
                when (val result = repository.dismissScan(deliveryId, wall)) {
                    is JournalResult.Success -> {
                        val runtime = repository.runtimeSnapshot()
                        val currentWork = runtime.currentWork?.toSummary()
                        _state.value = _state.value.copy(
                            screen = currentWork?.let(CleaningScreenState::Active) ?: CleaningScreenState.Ready,
                            busy = false,
                            notice = "Cleaning not started. Move the phone away from the tag.",
                        )
                    }
                    is JournalResult.Rejected -> showError(result.message)
                }
            }
        }
    }

    fun updateFinishNote(note: String) {
        val screen = _state.value.screen as? CleaningScreenState.FinishReady ?: return
        val bounded = note.take(MAX_NOTE_LENGTH)
        _state.value = _state.value.copy(screen = screen.copy(note = bounded))
        scope.launch {
            commandMutex.withLock {
                val current = _state.value.screen as? CleaningScreenState.FinishReady ?: return@withLock
                if (current.work.startOperationId != screen.work.startOperationId) return@withLock
                val device = repository.deviceState() ?: return@withLock
                val draftId = StableOperationIds.derive("DRAFT", current.work.startOperationId)
                when (val result = repository.saveFinishDraft(
                    installationId = device.installationId,
                    startOperationId = current.work.startOperationId,
                    draftId = draftId,
                    canonicalAnswerBytes = CanonicalCommands.standardFinishAnswers(),
                    note = current.note,
                    issuePayloadBytes = null,
                    wallEpochMs = System.currentTimeMillis(),
                )) {
                    is JournalResult.Success -> Unit
                    is JournalResult.Rejected -> _state.value = _state.value.copy(notice = result.message)
                }
            }
        }
    }

    fun finishCleaning() {
        scope.launch {
            commandMutex.withLock {
                val finish = _state.value.screen as? CleaningScreenState.FinishReady ?: return@withLock
                val device = repository.deviceState() ?: return@withLock showError("This phone needs manager setup before it can finish work.")
                val moment = runCatching(clock::moment).getOrNull()
                    ?: return@withLock showError("This phone is restoring its secure work state. Try again.")
                val draftId = StableOperationIds.derive("DRAFT", finish.work.startOperationId)
                val operationId = StableOperationIds.derive("FINISH", finish.work.startOperationId, finish.deliveryId)
                val bytes = CanonicalCommands.finish(
                    operationId = operationId,
                    startOperationId = finish.work.startOperationId,
                    workOccurrenceId = finish.work.workOccurrenceId,
                    attemptGeneration = finish.work.attemptGeneration,
                    deliveryId = finish.deliveryId,
                    draftId = draftId,
                    employeeId = device.employeeId,
                    deviceInstallationId = device.installationId,
                    locationId = finish.work.locationId,
                    note = finish.note,
                    createdAtEpochMs = moment.wallEpochMs,
                )
                _state.value = _state.value.copy(
                    screen = CleaningScreenState.SavingFinish(finish.work.locationName),
                    busy = true,
                    notice = null,
                    deliveryState = DeliveryState.SavingOnPhone,
                )
                when (val result = repository.finishCleaning(
                    FinishCleaningCommand(
                        operationId = operationId,
                        startOperationId = finish.work.startOperationId,
                        deliveryId = finish.deliveryId,
                        draftId = draftId,
                        canonicalAnswerBytes = CanonicalCommands.standardFinishAnswers(),
                        note = finish.note,
                        issuePayloadBytes = null,
                        canonicalRequestBytes = bytes,
                        wireSchemaVersion = 1,
                        expectedCreationEpoch = device.creationEpoch,
                        expectedOperationFenceGeneration = device.operationCreationFenceGeneration,
                        expectedLeaseFenceGeneration = device.leaseAdmissionGeneration,
                        expectedCutoverGeneration = device.legacyCutoverGeneration,
                        bootSessionId = moment.bootSessionId,
                        createdElapsedMs = moment.elapsedMs,
                        createdWallEpochMs = moment.wallEpochMs,
                    ),
                )) {
                    is JournalResult.Success -> {
                        onOperationSaved(device.installationId)
                        _state.value = _state.value.copy(
                            screen = CleaningScreenState.SavedWaitingToSend(finish.work.locationName),
                            busy = false,
                            notice = "Cleaning saved on this phone.",
                            deliveryState = DeliveryState.SavedWaitingToSend,
                        )
                    }
                    is JournalResult.Rejected -> {
                        _state.value = _state.value.copy(
                            screen = finish,
                            busy = false,
                            notice = result.message,
                            deliveryState = DeliveryState.NotSaved(result.message),
                        )
                    }
                }
            }
        }
    }

    fun requestManagerHelp() {
        scope.launch {
            commandMutex.withLock {
                val active = when (val screen = _state.value.screen) {
                    is CleaningScreenState.Active -> screen.work
                    is CleaningScreenState.FinishReady -> screen.work
                    else -> return@withLock
                }
                val note = (_state.value.screen as? CleaningScreenState.FinishReady)?.note.orEmpty()
                val device = repository.deviceState() ?: return@withLock showError("This phone needs manager setup before it can save help.")
                val moment = runCatching(clock::moment).getOrNull()
                    ?: return@withLock showError("This phone is restoring its secure work state. Try again.")
                val operationId = StableOperationIds.derive("HELP", active.startOperationId, ManagerHelpCause.EMPLOYEE_REQUEST.name)
                val bytes = CanonicalCommands.supportRequest(
                    operationId = operationId,
                    startOperationId = active.startOperationId,
                    workOccurrenceId = active.workOccurrenceId,
                    reason = ManagerHelpCause.EMPLOYEE_REQUEST,
                    note = note,
                    employeeId = device.employeeId,
                    deviceInstallationId = device.installationId,
                    locationId = active.locationId,
                    createdAtEpochMs = moment.wallEpochMs,
                )
                _state.value = _state.value.copy(busy = true, notice = null, deliveryState = DeliveryState.SavingOnPhone)
                when (val result = repository.requestManagerHelp(
                    RequestManagerHelpCommand(
                        operationId = operationId,
                        startOperationId = active.startOperationId,
                        reason = ManagerHelpCause.EMPLOYEE_REQUEST,
                        note = note,
                        canonicalRequestBytes = bytes,
                        wireSchemaVersion = 1,
                        expectedCreationEpoch = device.creationEpoch,
                        expectedOperationFenceGeneration = device.operationCreationFenceGeneration,
                        expectedLeaseFenceGeneration = device.leaseAdmissionGeneration,
                        expectedCutoverGeneration = device.legacyCutoverGeneration,
                        bootSessionId = moment.bootSessionId,
                        createdElapsedMs = moment.elapsedMs,
                        createdWallEpochMs = moment.wallEpochMs,
                    ),
                )) {
                    is JournalResult.Success -> {
                        onOperationSaved(device.installationId)
                        _state.value = _state.value.copy(
                            screen = CleaningScreenState.Ready,
                            busy = false,
                            notice = "Saved on this phone. Ask a manager for help.",
                            deliveryState = DeliveryState.NeedsManager,
                        )
                    }
                    is JournalResult.Rejected -> {
                        _state.value = _state.value.copy(busy = false, notice = result.message, deliveryState = DeliveryState.NotSaved(result.message))
                    }
                }
            }
        }
    }

    fun requestSync() {
        scope.launch {
            repository.deviceState()?.let { onOperationSaved(it.installationId) }
        }
    }

    private suspend fun handleAdmittedTag(admitted: AdmittedCustodialTag) {
        val device = repository.deviceState()
        if (device == null) {
            showError("This phone needs manager setup before it can scan locations.")
            return
        }
        if (_state.value.busy) {
            _state.value = _state.value.copy(notice = "Saving on this phone. Wait for it to finish.")
            return
        }
        val moment = runCatching(clock::moment).getOrElse {
            showError("This phone is restoring its secure work state. Try again.")
            return
        }
        val field = repository.nfcFieldState(device.installationId)
        val generation = when (field?.state) {
            NfcFieldState.ARMED.name, NfcFieldState.ABSENCE_CONFIRMED_WAITING_FOR_DISCOVERY.name -> (field.fieldGeneration + 1)
            else -> field?.fieldGeneration ?: 1L
        }
        val deliveryId = StableOperationIds.derive(
            "SCAN",
            device.installationId,
            moment.bootSessionId,
            generation.toString(),
            admitted.tag.payloadSha256,
            admitted.tagUidHash.orEmpty(),
        )
        val recorded = repository.recordVerifiedScan(
            VerifiedScanInput(
                deliveryId = deliveryId,
                installationId = device.installationId,
                bootSessionId = moment.bootSessionId,
                tagUidHash = admitted.tagUidHash,
                ndefPayloadHash = admitted.tag.payloadSha256,
                livePayloadRereadHash = admitted.tag.payloadSha256,
                source = admitted.source,
                liveTagVerified = true,
                receivedElapsedMs = moment.elapsedMs,
                receivedWallEpochMs = moment.wallEpochMs,
                authenticatedHandoffIdentity = admitted.authenticatedHandoffIdentity,
            ),
        )
        if (recorded is JournalResult.Rejected) {
            _state.value = _state.value.copy(notice = recorded.message)
            return
        }
        val accepted = (recorded as JournalResult.Success).value
        val pending = repository.pendingScanDelivery(device.installationId)
        if (pending?.deliveryId != accepted.deliveryId) {
            _state.value = _state.value.copy(notice = "Move the phone away from the tag, then tap it again when ready.")
            return
        }

        val current = repository.currentWork(device.installationId)
        if (current != null) {
            if (current.expectedTagPayloadHash == admitted.tag.payloadSha256) {
                _state.value = _state.value.copy(
                    screen = CleaningScreenState.FinishReady(
                        work = current.toSummary(),
                        deliveryId = accepted.deliveryId,
                        note = current.draftNote.orEmpty(),
                    ),
                    notice = "Finish ${current.locationNameSnapshot} when ready.",
                )
            } else {
                repository.dismissScan(accepted.deliveryId, moment.wallEpochMs)
                _state.value = _state.value.copy(
                    screen = CleaningScreenState.Active(current.toSummary()),
                    notice = "This is not the tag for ${current.locationNameSnapshot}.",
                )
            }
            return
        }

        val trusted = moment.trustedTime
        if (trusted == null) {
            repository.dismissScan(accepted.deliveryId, moment.wallEpochMs)
            _state.value = _state.value.copy(
                screen = CleaningScreenState.Ready,
                notice = "Connect this phone before starting a new cleaning.",
            )
            return
        }
        when (val assignment = repository.activeAssignmentForTag(admitted.tag.payloadSha256, trusted)) {
            is JournalResult.Success -> {
                _state.value = _state.value.copy(
                    screen = CleaningScreenState.LocationConfirmed(assignment.value.toSummary(), accepted.deliveryId),
                    notice = null,
                )
            }
            is JournalResult.Rejected -> {
                repository.dismissScan(accepted.deliveryId, moment.wallEpochMs)
                _state.value = _state.value.copy(screen = CleaningScreenState.Ready, notice = assignment.message)
            }
        }
    }

    private fun applyRuntime(snapshot: JournalRuntimeSnapshot) {
        val previous = _state.value
        val device = snapshot.deviceState
        val identity = device?.let { EmployeeIdentity(it.employeeId, it.employeeNameSnapshot) }
        val current = snapshot.currentWork?.toSummary()
        val attention = snapshot.latestUnsettledWork
            ?.takeIf { it.workState == WorkChainState.NEEDS_MANAGER.name || it.workState == WorkChainState.READY_TO_RESUME.name }
            ?.toSummary()
        val ephemeral = previous.screen
        val screen = when {
            device == null -> CleaningScreenState.SetupRequired
            current != null -> when (ephemeral) {
                is CleaningScreenState.FinishReady -> if (ephemeral.work.startOperationId == current.startOperationId) ephemeral else CleaningScreenState.Active(current)
                is CleaningScreenState.SavingFinish -> ephemeral
                else -> CleaningScreenState.Active(current)
            }
            ephemeral is CleaningScreenState.LocationConfirmed ||
                ephemeral is CleaningScreenState.SavingStart ||
                ephemeral is CleaningScreenState.SavingFinish ||
                ephemeral is CleaningScreenState.SavedWaitingToSend -> ephemeral
            else -> CleaningScreenState.Ready
        }
        val delivery = when {
            snapshot.pendingOperationCount > 0 -> DeliveryState.SavedWaitingToSend
            previous.pendingOperationCount > 0 -> DeliveryState.SentToZoo
            attention != null -> DeliveryState.NeedsManager
            previous.deliveryState is DeliveryState.NotSaved -> previous.deliveryState
            else -> DeliveryState.Idle
        }
        _state.value = previous.copy(
            identity = identity,
            screen = screen,
            attentionWork = attention,
            deliveryState = delivery,
            pendingOperationCount = snapshot.pendingOperationCount,
        )
    }

    private fun showError(message: String) {
        val current = _state.value.screen
        _state.value = _state.value.copy(
            screen = if (current is CleaningScreenState.Active || current is CleaningScreenState.FinishReady) current else CleaningScreenState.Error(message, canRetry = true),
            notice = message,
            busy = false,
            deliveryState = DeliveryState.NotSaved(message),
        )
    }

    private fun CurrentWorkProjection.toSummary() = WorkSummary(
        startOperationId = startOperationId,
        workOccurrenceId = workOccurrenceId,
        attemptGeneration = attemptGeneration,
        locationId = locationId,
        locationName = locationNameSnapshot,
        expectedTagPayloadHash = expectedTagPayloadHash,
        state = WorkChainState.valueOf(workState),
        draftId = finishDraftId,
        draftNote = draftNote.orEmpty(),
    )

    private fun AssignmentSnapshotEntity.toSummary() = AssignmentSummary(
        snapshotId = snapshotId,
        workOccurrenceId = workOccurrenceId,
        attemptGeneration = attemptGeneration,
        locationId = locationId,
        locationName = locationName,
        expectedTagPayloadHash = expectedTagPayloadHash,
    )

    private companion object {
        const val MAX_NOTE_LENGTH = 500
    }
}
