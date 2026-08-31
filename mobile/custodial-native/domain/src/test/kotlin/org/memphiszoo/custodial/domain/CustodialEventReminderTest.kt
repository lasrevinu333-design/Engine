package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CustodialEventReminderTest {
    @Test fun spokenReminderContainsOnlyExplicitCustodialInformation() {
        val reminder = CustodialEventReminder(
            eventId = "event-1",
            eventTitle = "Zoo Dinner",
            locationName = "Teton Lodge",
            eventDateText = "Friday, September 4",
            eventTimeText = "6:00 to 9:00 PM",
            expectedAttendance = 250,
            notes = listOf(
                CustodialEventNote(EventNoteKind.EXTRA_CANS, "Place four extra trash cans"),
                CustodialEventNote(EventNoteKind.RESTROOM_CHECK, "Check Teton Restrooms before guests arrive"),
            ),
        )
        val text = reminder.spokenMessage("Maurice")
        assertTrue(text.startsWith("Maurice, event reminder."))
        assertTrue(text.contains("Expected attendance is 250"))
        assertTrue(text.contains("Place four extra trash cans"))
        assertFalse(text.contains("VIP", ignoreCase = true))
    }

    @Test fun noAttendanceDoesNotInventOne() {
        val reminder = CustodialEventReminder("event-2", "Morning Meeting", "Courtyard", "Monday", "9:00 AM", null, emptyList())
        assertEquals("Tammy, event reminder. Morning Meeting is at Courtyard on Monday, 9:00 AM.", reminder.spokenMessage("Tammy"))
    }
}
