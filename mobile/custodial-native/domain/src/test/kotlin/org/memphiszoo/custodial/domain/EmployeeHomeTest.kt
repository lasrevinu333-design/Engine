package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class EmployeeHomeTest {
    @Test fun titleIsExactlyCustodianAndShiftContainsOnlyOperationalTimes() {
        val snapshot = fixture()
        assertEquals("Custodian", snapshot.title)
        assertEquals("Start 5:00 AM  •  Lunch 8:30–9:30 AM  •  Done 2:00 PM", snapshot.shiftSummary)
    }

    @Test fun aDifferentTitleIsRejectedBecauseEricIsTheAuthority() {
        assertThrows(IllegalArgumentException::class.java) { fixture(title = "Employee") }
    }

    @Test fun weatherIsBoundedToEightUsefulHours() {
        assertThrows(IllegalArgumentException::class.java) {
            fixture(weather = HourlyWeatherCard("80°", "Clear", List(9) { "$it PM" }, "8:00 AM", Freshness.FRESH))
        }
    }

    private fun fixture(
        title: String = "Custodian",
        weather: HourlyWeatherCard = HourlyWeatherCard("80°", "Clear", listOf("9 AM 80°"), "8:00 AM", Freshness.FRESH),
    ) = EmployeeHomeSnapshot(
        employeeName = "Tammy Miller",
        title = title,
        workDaysText = "Monday–Friday",
        shiftStartText = "5:00 AM",
        lunchText = "8:30–9:30 AM",
        shiftEndText = "2:00 PM",
        activeCleaning = null,
        attendance = AttendanceCard(1_234, "8:00 AM", Freshness.FRESH),
        weather = weather,
        capabilities = HomeCapability.entries.toSet(),
    )
}
