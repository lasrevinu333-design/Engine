package org.memphiszoo.custodial.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.memphiszoo.custodial.MainActivity
import org.memphiszoo.custodial.domain.AssignmentSummary
import org.memphiszoo.custodial.domain.CleaningScreenState
import org.memphiszoo.custodial.domain.CustodialAppState
import org.memphiszoo.custodial.domain.EmployeeIdentity

class FoundationInteractionTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    @Test fun unlockButtonProvidesGestureIndependentAccess() {
        rule.onNodeWithContentDescription("Slide up to unlock").assertExists()
        rule.onNodeWithText("Unlock").assertIsDisplayed().performClick()
        rule.onNodeWithText("Memphis Zoo Custodial").assertIsDisplayed()
    }

    @Test fun unfinishedPrimaryRoutesAreNotRendered() {
        rule.onNodeWithText("Unlock").performClick()
        rule.onNodeWithText("Schedule").assertDoesNotExist()
        rule.onNodeWithText("Messages").assertDoesNotExist()
        rule.onNodeWithText("Events").assertDoesNotExist()
        rule.onNodeWithText("Feedback").assertDoesNotExist()
    }

    @Test fun savingStartDisablesThePrimaryCommand() {
        rule.setContent {
            CustodialFoundationApp(
                state = CustodialAppState(
                    unlocked = true,
                    identity = EmployeeIdentity("test", "Test Custodian"),
                    screen = CleaningScreenState.LocationConfirmed(
                        AssignmentSummary("snap", "occ", 1, "loc", "Test Restroom", "hash"),
                        "scan",
                    ),
                    busy = true,
                ),
                onUnlock = {}, onStartCleaning = {}, onFinishCleaning = {}, onFinishNoteChanged = {},
                onNotNow = {}, onNeedHelp = {}, onTryAgain = {}, onDismissNotice = {},
            )
        }
        rule.onNodeWithText("Saving on this phone…").assertExists().assertIsNotEnabled()
    }
}
