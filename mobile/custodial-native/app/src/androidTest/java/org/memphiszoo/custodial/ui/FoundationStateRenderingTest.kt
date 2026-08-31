package org.memphiszoo.custodial.ui

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import org.memphiszoo.custodial.domain.AssignmentSummary
import org.memphiszoo.custodial.domain.CleaningScreenState
import org.memphiszoo.custodial.domain.CustodialAppState
import org.memphiszoo.custodial.domain.EmployeeIdentity

class FoundationStateRenderingTest {
    @get:Rule val rule = createComposeRule()

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
