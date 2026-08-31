package org.memphiszoo.custodial.domain

enum class CoverAllOutputLanguage { ENGLISH, SPANISH, BILINGUAL }

data class CoverAllAssignmentLine(
    val sortMinute: Int,
    val timeWindowEnglish: String,
    val timeWindowSpanish: String,
    val locationName: String,
    val instructionEnglish: String,
    val instructionSpanish: String,
    val noteEnglish: String? = null,
    val noteSpanish: String? = null,
) {
    init {
        require(sortMinute in 0 until 24 * 60)
        require(timeWindowEnglish.isNotBlank())
        require(timeWindowSpanish.isNotBlank())
        require(locationName.isNotBlank())
        require(instructionEnglish.isNotBlank())
        require(instructionSpanish.isNotBlank())
    }
}

data class CoverAllDaySchedule(
    val capacity: CoverAllSlot,
    val serviceDateText: String,
    val shiftText: String,
    val breakTextEnglish: String?,
    val breakTextSpanish: String?,
    val assignments: List<CoverAllAssignmentLine>,
    val managerContact: String,
) {
    init {
        require(serviceDateText.isNotBlank())
        require(shiftText.isNotBlank())
        require(assignments.isNotEmpty())
        require(managerContact.isNotBlank())
    }
}

object CoverAllScheduleTextRenderer {
    fun render(schedule: CoverAllDaySchedule, language: CoverAllOutputLanguage): String = when (language) {
        CoverAllOutputLanguage.ENGLISH -> english(schedule)
        CoverAllOutputLanguage.SPANISH -> spanish(schedule)
        CoverAllOutputLanguage.BILINGUAL -> english(schedule) + "\n\n------------------------------\n\n" + spanish(schedule)
    }

    private fun english(schedule: CoverAllDaySchedule): String = buildString {
        appendLine("MEMPHIS ZOO CUSTODIAL — ${schedule.capacity.id}")
        appendLine("Date: ${schedule.serviceDateText}")
        appendLine("Shift: ${schedule.shiftText}")
        schedule.breakTextEnglish?.takeIf { it.isNotBlank() }?.let { appendLine("Break: $it") }
        appendLine()
        appendLine("Assignments")
        schedule.assignments.sortedWith(compareBy<CoverAllAssignmentLine> { it.sortMinute }.thenBy { it.locationName }).forEachIndexed { index, item ->
            appendLine("${index + 1}. ${item.timeWindowEnglish} — ${item.locationName}")
            appendLine("   ${item.instructionEnglish}")
            item.noteEnglish?.takeIf { it.isNotBlank() }?.let { appendLine("   Note: $it") }
        }
        appendLine()
        appendLine("Report problems or needed supplies to ${schedule.managerContact}.")
        append("This schedule does not provide phone or program access.")
    }

    private fun spanish(schedule: CoverAllDaySchedule): String = buildString {
        appendLine("LIMPIEZA DEL ZOOLÓGICO DE MEMPHIS — ${schedule.capacity.id}")
        appendLine("Fecha: ${schedule.serviceDateText}")
        appendLine("Turno: ${schedule.shiftText}")
        schedule.breakTextSpanish?.takeIf { it.isNotBlank() }?.let { appendLine("Descanso: $it") }
        appendLine()
        appendLine("Asignaciones")
        schedule.assignments.sortedWith(compareBy<CoverAllAssignmentLine> { it.sortMinute }.thenBy { it.locationName }).forEachIndexed { index, item ->
            appendLine("${index + 1}. ${item.timeWindowSpanish} — ${item.locationName}")
            appendLine("   ${item.instructionSpanish}")
            item.noteSpanish?.takeIf { it.isNotBlank() }?.let { appendLine("   Nota: $it") }
        }
        appendLine()
        appendLine("Informe los problemas o suministros necesarios a ${schedule.managerContact}.")
        append("Este horario no proporciona acceso a un teléfono ni al programa.")
    }
}
