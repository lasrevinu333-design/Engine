package org.memphiszoo.custodial.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.memphiszoo.custodial.domain.ActiveCleaningCard
import org.memphiszoo.custodial.domain.AttendanceCard
import org.memphiszoo.custodial.domain.EmployeeHomeSnapshot
import org.memphiszoo.custodial.domain.Freshness
import org.memphiszoo.custodial.domain.HomeCapability
import org.memphiszoo.custodial.domain.HourlyWeatherCard

@RunWith(AndroidJUnit4::class)
class EmployeeHomeScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun priorityOrderShowsActiveWorkIdentityStatusAndOnlyWorkingRoutes() {
        compose.setContent {
            FoundationTheme {
                EmployeeHomeScreen(
                    state = state(capabilities = setOf(HomeCapability.SCHEDULE, HomeCapability.EVENTS)),
                    onSchedule = {}, onMessages = {}, onEvents = {}, onFeedback = {},
                )
            }
        }
        compose.onNodeWithTag("active-cleaning").assertIsDisplayed()
        compose.onNodeWithText("Tammy Miller").assertIsDisplayed()
        compose.onNodeWithText("Custodian").assertIsDisplayed()
        compose.onNodeWithTag("attendance-card").assertIsDisplayed()
        compose.onNodeWithTag("weather-card").assertIsDisplayed()
        compose.onNodeWithText("Schedule").assertIsDisplayed()
        compose.onNodeWithText("Events").assertIsDisplayed()
        compose.onNodeWithText("Messages").assertDoesNotExist()
        compose.onNodeWithText("Feedback").assertDoesNotExist()
        compose.onNodeWithText("Time & Attendance", substring = true).assertDoesNotExist()
    }

    private fun state(capabilities: Set<HomeCapability>) = EmployeeHomeSnapshot(
        employeeName = "Tammy Miller",
        workDaysText = "Monday–Friday",
        shiftStartText = "5:00 AM",
        lunchText = "8:30–9:30 AM",
        shiftEndText = "2:00 PM",
        activeCleaning = ActiveCleaningCard("Teton Restrooms", "8:14 AM"),
        attendance = AttendanceCard(1_234, "8:00 AM", Freshness.FRESH),
        weather = HourlyWeatherCard("78°", "Clear", listOf("9 AM 80°", "10 AM 82°"), "8:00 AM", Freshness.FRESH),
        capabilities = capabilities,
    )
}
