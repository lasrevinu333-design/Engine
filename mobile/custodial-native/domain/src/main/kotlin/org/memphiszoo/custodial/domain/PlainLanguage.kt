package org.memphiszoo.custodial.domain

object PlainLanguage {
    fun delivery(state: DeliveryState): String? = when (state) {
        DeliveryState.Idle -> null
        DeliveryState.SavingOnPhone -> "Saving on this phone…"
        DeliveryState.SavedWaitingToSend -> "Saved on this phone. Waiting to send."
        DeliveryState.SentToZoo -> "Sent to the zoo system."
        is DeliveryState.NotSaved -> "Not saved. Tap Try again."
        DeliveryState.NeedsManager -> "Saved on this phone. Ask a manager for help."
        DeliveryState.Restored -> "Your cleaning was restored."
    }
}
