package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaceRegistryTest {
    @Test fun stingraysAliasesResolveToEventEligibleNeverCleanPlace() {
        val registry = PlaceRegistry.withStingrays()
        listOf("Stingrays", "sting ray", "STING-RAYS", "stingrày").forEach { input ->
            val result = registry.resolve(input)
            assertTrue("Expected resolution for $input", result is PlaceResolution.Resolved)
            val place = (result as PlaceResolution.Resolved).place
            assertEquals("STINGRAYS", place.placeId)
            assertEquals(CleaningMode.NEVER_CLEAN, place.cleaningMode)
            assertTrue(place.eventEligible)
            assertFalse(place.mayCreateCleaningWork)
        }
    }

    @Test fun unknownEventLocationIsPreservedForReviewAndDoesNotInventAPlace() {
        val raw = "New Habitat North Tent"
        val result = PlaceRegistry.withStingrays().resolve(raw)
        assertEquals(PlaceResolution.NeedsReview(raw), result)
    }

    @Test fun ambiguousAliasDoesNotGuess() {
        val registry = PlaceRegistry(
            places = listOf(
                OperationalPlace("EAST", "East Plaza", CleaningMode.REMINDER_ONLY, true, false, false),
                OperationalPlace("WEST", "West Plaza", CleaningMode.REMINDER_ONLY, true, false, false),
            ),
            aliases = listOf(PlaceAlias("plaza", "EAST"), PlaceAlias("plaza", "WEST")),
        )
        val result = registry.resolve("Plaza")
        assertTrue(result is PlaceResolution.Ambiguous)
        assertEquals(setOf("EAST", "WEST"), (result as PlaceResolution.Ambiguous).candidates.map { it.placeId }.toSet())
    }
}
