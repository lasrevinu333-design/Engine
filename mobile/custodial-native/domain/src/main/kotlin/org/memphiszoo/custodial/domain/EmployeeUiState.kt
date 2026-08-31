package org.memphiszoo.custodial.domain

data class EmployeeIdentity(
    val employeeId: String,
    val fullName: String,
    val role: String = "Custodian",
)

data class ActiveCleaning(
    val startOperationId: String,
    val locationId: String,
    val locationName: String,
)

sealed interface DeliveryState {
    data object Idle : DeliveryState
    data object SavingOnPhone : DeliveryState
    data object SavedWaitingToSend : DeliveryState
    data object SentToZoo : DeliveryState
    data class NotSaved(val reason: String) : DeliveryState
    data object NeedsManager : DeliveryState
    data object Restored : DeliveryState
}

data class EmployeeUiState(
    val identity: EmployeeIdentity?,
    val activeCleaning: ActiveCleaning?,
    val deliveryState: DeliveryState = DeliveryState.Idle,
    val lockState: LockState = LockState.Locked,
)

enum class LockState { Locked, Unlocked }
