package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlainLanguageTest {
    @Test fun everyMaterialDeliveryStateHasExactWording() {
        assertNull(PlainLanguage.delivery(DeliveryState.Idle))
        assertEquals("Saving on this phone…", PlainLanguage.delivery(DeliveryState.SavingOnPhone))
        assertEquals("Saved on this phone. Waiting to send.", PlainLanguage.delivery(DeliveryState.SavedWaitingToSend))
        assertEquals("Sent to the zoo system.", PlainLanguage.delivery(DeliveryState.SentToZoo))
        assertEquals("Not saved. Tap Try again.", PlainLanguage.delivery(DeliveryState.NotSaved("disk")))
        assertEquals("Saved on this phone. Ask a manager for help.", PlainLanguage.delivery(DeliveryState.NeedsManager))
        assertEquals("Your cleaning was restored.", PlainLanguage.delivery(DeliveryState.Restored))
    }
}
