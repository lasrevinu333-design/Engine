package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class OperationalScheduleTest {
    @Test fun ninePositionsIncludeTwoWorkingPlaceholdersAndNineUniquePhones() {
        val positions = CustodialStaticRoster.positions
        assertEquals(9, positions.size)
        assertEquals(2, positions.count { it.placeholder })
        assertEquals(setOf("Open Employee 3", "Open Employee 4"), positions.filter { it.placeholder }.map { it.employeeDisplayName }.toSet())
        assertEquals((2..10).map { "KIOSK_%02d".format(it) }.toSet(), positions.map { it.deviceId }.toSet())
    }

    @Test fun controllingWorkdayCorrectionsArePresent() {
        val tammy = CustodialStaticRoster.position("TAMMY")
        assertTrue(tammy.works(ServiceDay.MONDAY))
        assertTrue(!tammy.works(ServiceDay.SATURDAY))
        val option4 = CustodialStaticRoster.position("OPTION_4")
        assertTrue(option4.works(ServiceDay.SATURDAY))
        assertTrue(option4.works(ServiceDay.WEDNESDAY))
        assertTrue(!option4.works(ServiceDay.THURSDAY))
    }

    @Test fun newEmployeeLunchesAreWithinThirtyMinutesOfFourHours() {
        listOf("OPTION_1", "OPTION_2", "OPTION_5").map(CustodialStaticRoster::position).forEach {
            assertTrue(it.minutesFromStartToLunch in (4 * 60 - 30)..(4 * 60 + 30))
        }
    }

    @Test fun everyAbsenceAfterSecondCreatesOneAutomaticCoverAll() {
        val expected = listOf(0, 0, 0, 1, 2, 3, 4, 5, 6, 7)
        assertEquals(expected, (0..9).map(CoverAllPolicy::automaticRequired))
        assertEquals(listOf("CoverAll01", "CoverAll02"), CoverAllPolicy.plan(4).automaticSlots.map { it.id })
        assertEquals(listOf("CoverAll01", "CoverAll02"), CoverAllPolicy.plan(0, 2).manuallyAddedSlots.map { it.id })
        assertThrows(IllegalArgumentException::class.java) { CoverAllPolicy.plan(9, 2) }
    }

    @Test fun eventRemindersUseThreeTwoAndDayOfOffsetsOnlyOnWorkingDays() {
        val maurice = CustodialStaticRoster.position("OPTION_1")
        val reminders = EventReminderPolicy.plan(ServiceDay.MONDAY, maurice)
        assertEquals(listOf(-3, -2, 0), reminders.map { it.dayOffsetFromEvent })
        assertEquals(listOf(ServiceDay.FRIDAY, ServiceDay.SATURDAY, ServiceDay.MONDAY), reminders.map { it.reminderDay })
        assertTrue(reminders.all { it.deliveryMinute == 8 * 60 + 15 })

        val tammy = CustodialStaticRoster.position("TAMMY")
        val tammyReminders = EventReminderPolicy.plan(ServiceDay.MONDAY, tammy)
        assertEquals(listOf(-3, 0), tammyReminders.map { it.dayOffsetFromEvent })
    }

    @Test fun continuityAcceptsHandoffsAndRejectsGapsOrOverlap() {
        val complete = listOf(
            OwnershipInterval("TETON", "TAMMY", 300, 570),
            OwnershipInterval("TETON", "KAREN", 570, 630),
            OwnershipInterval("TETON", "TAMMY", 630, 840),
            OwnershipInterval("TETON", "MAURICE", 840, 1020),
        )
        assertTrue(OwnershipContinuity.validate("TETON", 300, 1020, complete).isEmpty())

        val broken = listOf(
            OwnershipInterval("TETON", "TAMMY", 300, 560),
            OwnershipInterval("TETON", "KAREN", 570, 640),
            OwnershipInterval("TETON", "MAURICE", 630, 1020),
        )
        val defects = OwnershipContinuity.validate("TETON", 300, 1020, broken)
        assertTrue(defects.any { it is OwnershipDefect.Gap })
        assertTrue(defects.any { it is OwnershipDefect.Overlap })
    }
}
