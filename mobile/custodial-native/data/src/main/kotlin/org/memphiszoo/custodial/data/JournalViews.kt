package org.memphiszoo.custodial.data

import org.memphiszoo.custodial.domain.FinishDraftState
import org.memphiszoo.custodial.domain.WorkChainState

data class CurrentWorkProjection(
    val installationId: String,
    val startOperationId: String,
    val workOccurrenceId: String,
    val attemptGeneration: Int,
    val locationId: String,
    val locationNameSnapshot: String,
    val expectedTagPayloadHash: String,
    val workState: String,
    val finishOperationId: String?,
    val finishDraftId: String?,
    val draftNote: String?,
    val draftState: String?,
) {
    fun parsedWorkState(): WorkChainState = WorkChainState.valueOf(workState)
    fun parsedDraftState(): FinishDraftState? = draftState?.let(FinishDraftState::valueOf)
}

data class JournalRuntimeSnapshot(
    val deviceState: DeviceStateEntity?,
    val currentWork: CurrentWorkProjection?,
    val latestUnsettledWork: CurrentWorkProjection?,
    val nfcFieldState: NfcFieldStateEntity?,
    val pendingOperationCount: Int,
)
