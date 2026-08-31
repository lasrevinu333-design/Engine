package org.memphiszoo.custodial.domain

import java.text.Normalizer

enum class CleaningMode { SCAN_TRACKED, REMINDER_ONLY, NEVER_CLEAN }

data class OperationalPlace(
    val placeId: String,
    val displayName: String,
    val cleaningMode: CleaningMode,
    val eventEligible: Boolean,
    val scheduleEligible: Boolean,
    val staffingEligible: Boolean,
    val active: Boolean = true,
) {
    init {
        require(placeId.isNotBlank())
        require(displayName.isNotBlank())
        if (cleaningMode == CleaningMode.NEVER_CLEAN) {
            require(!scheduleEligible) { "NEVER_CLEAN places cannot be schedule eligible" }
            require(!staffingEligible) { "NEVER_CLEAN places cannot be staffing eligible" }
        }
    }

    val mayCreateCleaningWork: Boolean
        get() = active && cleaningMode == CleaningMode.SCAN_TRACKED && scheduleEligible && staffingEligible
}

data class PlaceAlias(
    val rawAlias: String,
    val placeId: String,
    val active: Boolean = true,
)

sealed interface PlaceResolution {
    data class Resolved(val place: OperationalPlace, val matchedAlias: String?) : PlaceResolution
    data class Ambiguous(val candidates: List<OperationalPlace>, val rawInput: String) : PlaceResolution
    data class NeedsReview(val rawInput: String) : PlaceResolution
}

object PlaceNameNormalizer {
    fun normalize(value: String): String {
        val withoutMarks = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return withoutMarks.lowercase()
            .replace('&', ' ')
            .replace(Regex("[^a-z0-9]+"), " ")
            .trim()
            .replace(Regex("\\s+"), " ")
    }
}

/** Exact and normalized alias resolution. Unknown text is preserved instead of rejected or guessed. */
class PlaceRegistry(
    places: Collection<OperationalPlace>,
    aliases: Collection<PlaceAlias>,
) {
    private val placesById = places.associateBy { it.placeId }
    private val aliases = aliases.toList()

    init {
        require(placesById.size == places.size) { "Duplicate place ID" }
        require(aliases.all { it.placeId in placesById }) { "Alias points to unknown place" }
    }

    fun resolve(rawInput: String): PlaceResolution {
        val input = rawInput.trim()
        if (input.isEmpty()) return PlaceResolution.NeedsReview(rawInput)
        val normalized = PlaceNameNormalizer.normalize(input)
        val direct = placesById.values.filter {
            it.active && (it.placeId.equals(input, ignoreCase = true) || PlaceNameNormalizer.normalize(it.displayName) == normalized)
        }
        val aliasMatches = aliases.filter {
            it.active && PlaceNameNormalizer.normalize(it.rawAlias) == normalized
        }.mapNotNull { placesById[it.placeId] }.filter { it.active }
        val candidates = (direct + aliasMatches).distinctBy { it.placeId }
        return when (candidates.size) {
            0 -> PlaceResolution.NeedsReview(rawInput)
            1 -> PlaceResolution.Resolved(
                place = candidates.single(),
                matchedAlias = aliases.firstOrNull {
                    it.active && it.placeId == candidates.single().placeId && PlaceNameNormalizer.normalize(it.rawAlias) == normalized
                }?.rawAlias,
            )
            else -> PlaceResolution.Ambiguous(candidates.sortedBy { it.displayName }, rawInput)
        }
    }

    companion object {
        fun withStingrays(): PlaceRegistry = PlaceRegistry(
            places = listOf(
                OperationalPlace(
                    placeId = "STINGRAYS",
                    displayName = "Stingrays",
                    cleaningMode = CleaningMode.NEVER_CLEAN,
                    eventEligible = true,
                    scheduleEligible = false,
                    staffingEligible = false,
                ),
            ),
            aliases = listOf(
                PlaceAlias("stingray", "STINGRAYS"),
                PlaceAlias("sting ray", "STINGRAYS"),
                PlaceAlias("sting rays", "STINGRAYS"),
                PlaceAlias("StingRays", "STINGRAYS"),
            ),
        )
    }
}
