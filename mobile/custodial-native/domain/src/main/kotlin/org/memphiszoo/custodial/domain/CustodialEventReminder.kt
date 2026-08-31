package org.memphiszoo.custodial.domain

enum class EventNoteKind { TRASH, EXTRA_CANS, RESTROOM_CHECK, SUPPLIES, OTHER_CUSTODIAL }

data class CustodialEventNote(val kind: EventNoteKind, val text: String) {
    init { require(text.isNotBlank()) }
}

data class CustodialEventReminder(
    val eventId: String,
    val eventTitle: String,
    val locationName: String,
    val eventDateText: String,
    val eventTimeText: String,
    val expectedAttendance: Int?,
    val notes: List<CustodialEventNote>,
) {
    init {
        require(eventId.isNotBlank())
        require(eventTitle.isNotBlank())
        require(locationName.isNotBlank())
        require(eventDateText.isNotBlank())
        require(eventTimeText.isNotBlank())
        require(expectedAttendance == null || expectedAttendance >= 0)
    }

    fun spokenMessage(employeeName: String): String = buildString {
        require(employeeName.isNotBlank())
        append("$employeeName, event reminder. $eventTitle is at $locationName on $eventDateText, $eventTimeText.")
        expectedAttendance?.let { append(" Expected attendance is $it.") }
        if (notes.isNotEmpty()) append(" ${notes.joinToString(" ") { it.text.trim().trimEnd('.') + "." }}")
    }
}
