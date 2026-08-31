package org.memphiszoo.custodial.domain

enum class HomeCapability { SCHEDULE, MESSAGES, EVENTS, FEEDBACK }
enum class Freshness { FRESH, STALE, UNAVAILABLE }

data class AttendanceCard(
    val currentAttendance: Int?,
    val observedAtText: String?,
    val freshness: Freshness,
) {
    init { require(currentAttendance == null || currentAttendance >= 0) }
}

data class HourlyWeatherCard(
    val currentTemperatureText: String?,
    val conditionText: String?,
    val hourlySummary: List<String>,
    val observedAtText: String?,
    val freshness: Freshness,
) {
    init { require(hourlySummary.size <= 8) }
}

data class ActiveCleaningCard(
    val locationName: String,
    val startedAtText: String,
) {
    init {
        require(locationName.isNotBlank())
        require(startedAtText.isNotBlank())
    }
}

data class EmployeeHomeSnapshot(
    val employeeName: String,
    val title: String = "Custodian",
    val workDaysText: String,
    val shiftStartText: String,
    val lunchText: String,
    val shiftEndText: String,
    val activeCleaning: ActiveCleaningCard?,
    val attendance: AttendanceCard,
    val weather: HourlyWeatherCard,
    val capabilities: Set<HomeCapability>,
) {
    init {
        require(employeeName.isNotBlank())
        require(title == "Custodian")
        require(workDaysText.isNotBlank())
        require(shiftStartText.isNotBlank())
        require(lunchText.isNotBlank())
        require(shiftEndText.isNotBlank())
    }

    val shiftSummary: String
        get() = "Start $shiftStartText  •  Lunch $lunchText  •  Done $shiftEndText"
}
