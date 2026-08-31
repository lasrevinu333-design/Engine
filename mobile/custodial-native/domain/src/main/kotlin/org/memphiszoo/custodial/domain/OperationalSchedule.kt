package org.memphiszoo.custodial.domain

import kotlin.math.max

/** Days used by the static Custodial schedule. */
enum class ServiceDay(val index: Int) {
    MONDAY(0),
    TUESDAY(1),
    WEDNESDAY(2),
    THURSDAY(3),
    FRIDAY(4),
    SATURDAY(5),
    SUNDAY(6);

    fun plusDays(days: Int): ServiceDay {
        val normalized = ((index + days) % 7 + 7) % 7
        return entries.first { it.index == normalized }
    }
}

data class StableCustodialPosition(
    val positionId: String,
    val employeeDisplayName: String,
    val deviceId: String,
    val workDays: Set<ServiceDay>,
    val shiftStartMinute: Int,
    val shiftEndMinute: Int,
    val lunchStartMinute: Int,
    val lunchEndMinute: Int,
    val placeholder: Boolean = false,
) {
    init {
        require(positionId.isNotBlank())
        require(employeeDisplayName.isNotBlank())
        require(deviceId.matches(Regex("KIOSK_(0[2-9]|10)")))
        require(workDays.size == 5 || positionId == "ALIJAH")
        require(shiftStartMinute in 0 until shiftEndMinute)
        require(shiftEndMinute <= 24 * 60)
        require(lunchStartMinute in shiftStartMinute until shiftEndMinute)
        require(lunchEndMinute - lunchStartMinute == 60)
        require(lunchEndMinute <= shiftEndMinute)
    }

    fun works(day: ServiceDay): Boolean = day in workDays
    val minutesFromStartToLunch: Int get() = lunchStartMinute - shiftStartMinute
}

/** The nine positions are operational capacity even when two names remain placeholders. */
object CustodialStaticRoster {
    val positions: List<StableCustodialPosition> = listOf(
        StableCustodialPosition(
            positionId = "KAREN",
            employeeDisplayName = "Karen Robinson",
            deviceId = "KIOSK_08",
            workDays = setOf(ServiceDay.TUESDAY, ServiceDay.WEDNESDAY, ServiceDay.THURSDAY, ServiceDay.FRIDAY, ServiceDay.SATURDAY),
            shiftStartMinute = 5 * 60,
            shiftEndMinute = 14 * 60,
            lunchStartMinute = 9 * 60 + 30,
            lunchEndMinute = 10 * 60 + 30,
        ),
        StableCustodialPosition(
            positionId = "TAMMY",
            employeeDisplayName = "Tammy Miller",
            deviceId = "KIOSK_04",
            workDays = setOf(ServiceDay.MONDAY, ServiceDay.TUESDAY, ServiceDay.WEDNESDAY, ServiceDay.THURSDAY, ServiceDay.FRIDAY),
            shiftStartMinute = 5 * 60,
            shiftEndMinute = 14 * 60,
            lunchStartMinute = 8 * 60 + 30,
            lunchEndMinute = 9 * 60 + 30,
        ),
        StableCustodialPosition(
            positionId = "KATHY",
            employeeDisplayName = "Kathy Phelps",
            deviceId = "KIOSK_07",
            workDays = setOf(ServiceDay.TUESDAY, ServiceDay.WEDNESDAY, ServiceDay.THURSDAY, ServiceDay.FRIDAY, ServiceDay.SATURDAY),
            shiftStartMinute = 6 * 60,
            shiftEndMinute = 15 * 60,
            lunchStartMinute = 10 * 60 + 30,
            lunchEndMinute = 11 * 60 + 30,
        ),
        StableCustodialPosition(
            positionId = "OPTION_2",
            employeeDisplayName = "Tabitha Masterson",
            deviceId = "KIOSK_09",
            workDays = setOf(ServiceDay.FRIDAY, ServiceDay.SATURDAY, ServiceDay.SUNDAY, ServiceDay.MONDAY, ServiceDay.TUESDAY),
            shiftStartMinute = 6 * 60,
            shiftEndMinute = 15 * 60,
            lunchStartMinute = 10 * 60,
            lunchEndMinute = 11 * 60,
        ),
        StableCustodialPosition(
            positionId = "OPTION_4",
            employeeDisplayName = "Open Employee 4",
            deviceId = "KIOSK_10",
            workDays = setOf(ServiceDay.SATURDAY, ServiceDay.SUNDAY, ServiceDay.MONDAY, ServiceDay.TUESDAY, ServiceDay.WEDNESDAY),
            shiftStartMinute = 6 * 60,
            shiftEndMinute = 15 * 60,
            lunchStartMinute = 10 * 60,
            lunchEndMinute = 11 * 60,
            placeholder = true,
        ),
        StableCustodialPosition(
            positionId = "OPTION_5",
            employeeDisplayName = "Kaili Michaelson",
            deviceId = "KIOSK_05",
            workDays = setOf(ServiceDay.SUNDAY, ServiceDay.MONDAY, ServiceDay.TUESDAY, ServiceDay.WEDNESDAY, ServiceDay.THURSDAY),
            shiftStartMinute = 7 * 60,
            shiftEndMinute = 16 * 60,
            lunchStartMinute = 11 * 60,
            lunchEndMinute = 12 * 60,
        ),
        StableCustodialPosition(
            positionId = "ALIJAH",
            employeeDisplayName = "Alijah Collins",
            deviceId = "KIOSK_02",
            workDays = setOf(ServiceDay.THURSDAY, ServiceDay.FRIDAY, ServiceDay.SATURDAY, ServiceDay.SUNDAY, ServiceDay.MONDAY),
            shiftStartMinute = 7 * 60,
            shiftEndMinute = 16 * 60,
            lunchStartMinute = 12 * 60,
            lunchEndMinute = 13 * 60,
        ),
        StableCustodialPosition(
            positionId = "OPTION_1",
            employeeDisplayName = "Maurice Stanton",
            deviceId = "KIOSK_06",
            workDays = setOf(ServiceDay.THURSDAY, ServiceDay.FRIDAY, ServiceDay.SATURDAY, ServiceDay.SUNDAY, ServiceDay.MONDAY),
            shiftStartMinute = 8 * 60,
            shiftEndMinute = 17 * 60,
            lunchStartMinute = 12 * 60,
            lunchEndMinute = 13 * 60,
        ),
        StableCustodialPosition(
            positionId = "OPTION_3",
            employeeDisplayName = "Open Employee 3",
            deviceId = "KIOSK_03",
            workDays = setOf(ServiceDay.SATURDAY, ServiceDay.SUNDAY, ServiceDay.MONDAY, ServiceDay.TUESDAY, ServiceDay.WEDNESDAY),
            shiftStartMinute = 8 * 60,
            shiftEndMinute = 17 * 60,
            lunchStartMinute = 12 * 60 + 30,
            lunchEndMinute = 13 * 60 + 30,
            placeholder = true,
        ),
    )

    init {
        require(positions.size == 9)
        require(positions.map { it.positionId }.toSet().size == 9)
        require(positions.map { it.deviceId }.toSet().size == 9)
        require(positions.count { it.placeholder } == 2)
    }

    fun position(positionId: String): StableCustodialPosition =
        requireNotNull(positions.singleOrNull { it.positionId == positionId }) { "Unknown custodial position: $positionId" }
}

data class CoverAllSlot(val slotNumber: Int) {
    init { require(slotNumber in 1..8) }
    val id: String = "CoverAll%02d".format(slotNumber)
}

data class CoverAllActivationPlan(
    val automaticSlots: List<CoverAllSlot>,
    val manuallyAddedSlots: List<CoverAllSlot>,
) {
    val allSlots: List<CoverAllSlot> = automaticSlots + manuallyAddedSlots
}

object CoverAllPolicy {
    val capacity: List<CoverAllSlot> = (1..8).map(::CoverAllSlot)

    fun automaticRequired(absentPositionCount: Int): Int {
        require(absentPositionCount in 0..9)
        return max(0, absentPositionCount - 2)
    }

    fun plan(absentPositionCount: Int, manuallyAddedCount: Int = 0): CoverAllActivationPlan {
        require(manuallyAddedCount >= 0)
        val automaticCount = automaticRequired(absentPositionCount)
        require(automaticCount + manuallyAddedCount <= capacity.size) {
            "CoverAll capacity exceeded: ${automaticCount + manuallyAddedCount}/${capacity.size}"
        }
        return CoverAllActivationPlan(
            automaticSlots = capacity.take(automaticCount),
            manuallyAddedSlots = capacity.drop(automaticCount).take(manuallyAddedCount),
        )
    }
}

data class EventReminderOccurrence(
    val dayOffsetFromEvent: Int,
    val reminderDay: ServiceDay,
    val deliveryMinute: Int,
    val recipientPositionId: String,
)

object EventReminderPolicy {
    private val offsets = listOf(-3, -2, 0)

    /**
     * The owner of the event location receives a reminder only on reminder dates they work.
     * Delivery is fifteen minutes after that position's scheduled start on that date.
     */
    fun plan(eventDay: ServiceDay, eventOwner: StableCustodialPosition): List<EventReminderOccurrence> =
        offsets.mapNotNull { offset ->
            val reminderDay = eventDay.plusDays(offset)
            if (!eventOwner.works(reminderDay)) return@mapNotNull null
            EventReminderOccurrence(
                dayOffsetFromEvent = offset,
                reminderDay = reminderDay,
                deliveryMinute = eventOwner.shiftStartMinute + 15,
                recipientPositionId = eventOwner.positionId,
            )
        }
}

data class OwnershipInterval(
    val locationId: String,
    val ownerId: String,
    val startMinute: Int,
    val endMinute: Int,
) {
    init {
        require(locationId.isNotBlank())
        require(ownerId.isNotBlank())
        require(startMinute in 0 until endMinute)
        require(endMinute <= 24 * 60)
    }
}

sealed interface OwnershipDefect {
    data class Gap(val fromMinute: Int, val toMinute: Int) : OwnershipDefect
    data class Overlap(val fromMinute: Int, val toMinute: Int) : OwnershipDefect
    data class WrongLocation(val foundLocationId: String) : OwnershipDefect
}

object OwnershipContinuity {
    /** Verifies exactly one owner for every minute of the required coverage window. */
    fun validate(
        locationId: String,
        coverageStartMinute: Int,
        coverageEndMinute: Int,
        intervals: List<OwnershipInterval>,
    ): List<OwnershipDefect> {
        require(coverageStartMinute in 0 until coverageEndMinute)
        require(coverageEndMinute <= 24 * 60)
        val defects = mutableListOf<OwnershipDefect>()
        val relevant = intervals.filter {
            if (it.locationId != locationId) {
                defects += OwnershipDefect.WrongLocation(it.locationId)
                false
            } else {
                it.endMinute > coverageStartMinute && it.startMinute < coverageEndMinute
            }
        }.sortedWith(compareBy<OwnershipInterval> { it.startMinute }.thenBy { it.endMinute })

        var cursor = coverageStartMinute
        for (interval in relevant) {
            val start = max(interval.startMinute, coverageStartMinute)
            val end = minOf(interval.endMinute, coverageEndMinute)
            when {
                start > cursor -> defects += OwnershipDefect.Gap(cursor, start)
                start < cursor -> defects += OwnershipDefect.Overlap(start, minOf(cursor, end))
            }
            cursor = max(cursor, end)
        }
        if (cursor < coverageEndMinute) defects += OwnershipDefect.Gap(cursor, coverageEndMinute)
        return defects
    }
}
