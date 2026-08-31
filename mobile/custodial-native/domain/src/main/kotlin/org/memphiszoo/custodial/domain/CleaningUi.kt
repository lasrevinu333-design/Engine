package org.memphiszoo.custodial.domain

data class AssignmentSummary(
    val snapshotId: String,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val locationId: String,
    val locationName: String,
    val expectedTagPayloadHash: String,
)

data class WorkSummary(
    val startOperationId: String,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val locationId: String,
    val locationName: String,
    val expectedTagPayloadHash: String,
    val state: WorkChainState,
    val draftId: String? = null,
    val draftNote: String = "",
)

sealed interface CleaningScreenState {
    data object SetupRequired : CleaningScreenState
    data object Ready : CleaningScreenState
    data class LocationConfirmed(
        val assignment: AssignmentSummary,
        val deliveryId: String,
    ) : CleaningScreenState
    data class SavingStart(val locationName: String) : CleaningScreenState
    data class Active(val work: WorkSummary) : CleaningScreenState
    data class FinishReady(
        val work: WorkSummary,
        val deliveryId: String,
        val note: String,
    ) : CleaningScreenState
    data class SavingFinish(val locationName: String) : CleaningScreenState
    data class SavedWaitingToSend(val locationName: String) : CleaningScreenState
    data class NeedsManager(val locationName: String?) : CleaningScreenState
    data class Error(
        val message: String,
        val canRetry: Boolean,
    ) : CleaningScreenState
}

data class CustodialAppState(
    val unlocked: Boolean = false,
    val identity: EmployeeIdentity? = null,
    val screen: CleaningScreenState = CleaningScreenState.SetupRequired,
    val attentionWork: WorkSummary? = null,
    val notice: String? = null,
    val deliveryState: DeliveryState = DeliveryState.Idle,
    val pendingOperationCount: Int = 0,
    val busy: Boolean = false,
)
