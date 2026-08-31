package org.memphiszoo.custodial.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.memphiszoo.custodial.MainActivity

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
}
