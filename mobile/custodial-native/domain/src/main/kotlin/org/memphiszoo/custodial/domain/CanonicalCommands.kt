package org.memphiszoo.custodial.domain

import java.nio.charset.StandardCharsets
import java.util.UUID

object StableOperationIds {
    fun derive(vararg parts: String): String = UUID.nameUUIDFromBytes(
        parts.joinToString("|").toByteArray(StandardCharsets.UTF_8),
    ).toString()
}

object CanonicalCommands {
    fun standardFinishAnswers(): ByteArray = "{\"standard_work_completed\":true}".toByteArray(StandardCharsets.UTF_8)

    fun start(
        operationId: String,
        assignmentSnapshotId: String,
        workOccurrenceId: String,
        attemptGeneration: Int,
        deliveryId: String,
        employeeId: String,
        deviceInstallationId: String,
        locationId: String,
        createdAtEpochMs: Long,
    ): ByteArray = json(
        "assignment_snapshot_id" to string(assignmentSnapshotId),
        "attempt_generation" to attemptGeneration.toString(),
        "created_at_epoch_ms" to createdAtEpochMs.toString(),
        "delivery_id" to string(deliveryId),
        "device_installation_id" to string(deviceInstallationId),
        "employee_id" to string(employeeId),
        "location_id" to string(locationId),
        "operation_id" to string(operationId),
        "schema" to string("custodial-native-start.v1"),
        "work_occurrence_id" to string(workOccurrenceId),
    )

    fun supportRequest(
        operationId: String,
        startOperationId: String,
        workOccurrenceId: String,
        reason: ManagerHelpCause,
        note: String,
        employeeId: String,
        deviceInstallationId: String,
        locationId: String,
        createdAtEpochMs: Long,
    ): ByteArray = json(
        "created_at_epoch_ms" to createdAtEpochMs.toString(),
        "device_installation_id" to string(deviceInstallationId),
        "employee_id" to string(employeeId),
        "location_id" to string(locationId),
        "note" to string(note),
        "operation_id" to string(operationId),
        "reason" to string(reason.name),
        "schema" to string("custodial-native-support-request.v1"),
        "start_operation_id" to string(startOperationId),
        "work_occurrence_id" to string(workOccurrenceId),
    )

    fun finish(
        operationId: String,
        startOperationId: String,
        workOccurrenceId: String,
        attemptGeneration: Int,
        deliveryId: String,
        draftId: String,
        employeeId: String,
        deviceInstallationId: String,
        locationId: String,
        note: String,
        createdAtEpochMs: Long,
    ): ByteArray = json(
        "attempt_generation" to attemptGeneration.toString(),
        "created_at_epoch_ms" to createdAtEpochMs.toString(),
        "delivery_id" to string(deliveryId),
        "device_installation_id" to string(deviceInstallationId),
        "draft_id" to string(draftId),
        "employee_id" to string(employeeId),
        "location_id" to string(locationId),
        "note" to string(note),
        "operation_id" to string(operationId),
        "schema" to string("custodial-native-finish.v1"),
        "standard_work_completed" to "true",
        "start_operation_id" to string(startOperationId),
        "work_occurrence_id" to string(workOccurrenceId),
    )

    private fun json(vararg values: Pair<String, String>): ByteArray = values
        .sortedBy { it.first }
        .joinToString(prefix = "{", postfix = "}", separator = ",") { (key, value) -> "${string(key)}:$value" }
        .toByteArray(StandardCharsets.UTF_8)

    private fun string(value: String): String = buildString(value.length + 2) {
        append('"')
        value.forEach { character ->
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\u000C' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (character.code < 0x20) append("\\u%04x".format(character.code)) else append(character)
            }
        }
        append('"')
    }
}
