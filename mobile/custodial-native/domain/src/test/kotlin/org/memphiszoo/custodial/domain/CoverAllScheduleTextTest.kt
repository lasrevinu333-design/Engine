package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CoverAllScheduleTextTest {
    private val schedule = CoverAllDaySchedule(
        capacity = CoverAllSlot(1),
        serviceDateText = "Monday, August 31, 2026",
        shiftText = "9:00 AM–3:00 PM",
        breakTextEnglish = "12:00–12:30 PM",
        breakTextSpanish = "12:00–12:30 PM",
        assignments = listOf(
            CoverAllAssignmentLine(600, "10:00–10:30 AM", "10:00–10:30 AM", "Aquarium Restrooms", "Clean both restrooms.", "Limpie ambos baños."),
            CoverAllAssignmentLine(540, "9:00–9:30 AM", "9:00–9:30 AM", "Teton Restrooms", "Clean both restrooms.", "Limpie ambos baños.", "Check trash boxes.", "Revise las cajas de basura."),
        ),
        managerContact = "the Custodial Manager",
    )

    @Test fun englishAndSpanishSchedulesAreCompleteAndOrdered() {
        val english = CoverAllScheduleTextRenderer.render(schedule, CoverAllOutputLanguage.ENGLISH)
        val spanish = CoverAllScheduleTextRenderer.render(schedule, CoverAllOutputLanguage.SPANISH)
        assertTrue(english.indexOf("Teton Restrooms") < english.indexOf("Aquarium Restrooms"))
        assertTrue(spanish.indexOf("Teton Restrooms") < spanish.indexOf("Aquarium Restrooms"))
        assertTrue(english.contains("CoverAll01"))
        assertTrue(spanish.contains("CoverAll01"))
        assertTrue(spanish.contains("Limpie ambos baños"))
    }

    @Test fun bilingualIsExactlyEnglishDividerSpanish() {
        val bilingual = CoverAllScheduleTextRenderer.render(schedule, CoverAllOutputLanguage.BILINGUAL)
        assertEquals(2, Regex("CoverAll01").findAll(bilingual).count())
        assertTrue(bilingual.contains("Assignments"))
        assertTrue(bilingual.contains("Asignaciones"))
    }

    @Test fun outputExplicitlyProvidesNoPhoneOrProgramAccess() {
        val english = CoverAllScheduleTextRenderer.render(schedule, CoverAllOutputLanguage.ENGLISH)
        assertTrue(english.contains("does not provide phone or program access"))
        assertFalse(english.contains("password", ignoreCase = true))
        assertFalse(english.contains("login", ignoreCase = true))
    }
}
