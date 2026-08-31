package org.memphiszoo.custodial.runtime

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import java.util.TreeMap
import org.json.JSONArray
import org.json.JSONObject
import org.memphiszoo.custodial.domain.AssignmentSnapshotCandidate
import org.memphiszoo.custodial.domain.AssignmentSnapshotVerifier
import org.memphiszoo.custodial.domain.CustodialTagProtocol

internal data class AuthenticatedDeviceStatus(
    val canonicalDeviceId: String,
    val employeeId: String,
    val employeeName: String,
    val employeeRole: String,
    val assignmentEpoch: Long,
    val credentialId: String,
    val credentialExpiresAt: String,
)

internal data class ParsedBootstrap(
    val contractVersion: String,
    val serviceDate: String,
    val generatedAtEpochMs: Long,
    val device: AuthenticatedDeviceStatus,
    val snapshots: List<AssignmentSnapshotCandidate>,
)

internal class NativeBootstrapPayloadParser(
    private val expectedSigningKeyId: String,
    private val verifier: AssignmentSnapshotVerifier,
) {
    fun parseStatus(response: SecureHttpResponse): AuthenticatedDeviceStatus {
        val root = successData(response, "This phone could not verify its employee assignment.")
        if (!root.optBoolean("authenticated", false)) fail("This phone needs manager setup before employee services can be used.")
        return AuthenticatedDeviceStatus(
            canonicalDeviceId = requiredString(root, "canonical_device_id"),
            employeeId = requiredUuid(root, "employee_id"),
            employeeName = requiredString(root, "employee_name"),
            employeeRole = root.optString("employee_role", "Custodian").ifBlank { "Custodian" },
            assignmentEpoch = requiredPositiveLong(root, "assignment_epoch"),
            credentialId = requiredUuid(root, "credential_id"),
            credentialExpiresAt = requiredString(root, "credential_expires_at"),
        )
    }

    fun parseBootstrap(
        response: SecureHttpResponse,
        status: AuthenticatedDeviceStatus,
        installationId: String,
    ): ParsedBootstrap {
        val data = successData(response, "The saved schedule could not be refreshed.")
        val contract = requiredString(data, "contract_version")
        if (contract != BOOTSTRAP_CONTRACT) fail("This phone and the zoo schedule are not using the same program version.")
        val responseKeyId = requiredHash(data, "signing_key_id")
        if (responseKeyId != expectedSigningKeyId) fail("The saved schedule was signed by an unknown authority.")
        val device = data.optJSONObject("device") ?: fail("The phone assignment is missing from the schedule response.")
        val returned = AuthenticatedDeviceStatus(
            canonicalDeviceId = requiredString(device, "canonical_device_id"),
            employeeId = requiredUuid(device, "employee_id"),
            employeeName = requiredString(device, "employee_name"),
            employeeRole = status.employeeRole,
            assignmentEpoch = requiredPositiveLong(device, "assignment_epoch"),
            credentialId = requiredUuid(device, "credential_id"),
            credentialExpiresAt = status.credentialExpiresAt,
        )
        if (
            returned.canonicalDeviceId != status.canonicalDeviceId ||
            returned.employeeId != status.employeeId ||
            returned.employeeName != status.employeeName ||
            returned.assignmentEpoch != status.assignmentEpoch ||
            returned.credentialId != status.credentialId ||
            requiredUuid(device, "device_installation_id") != installationId
        ) fail("The phone assignment changed while the schedule was loading. Try again.")

        val array = data.optJSONArray("assignment_snapshots") ?: JSONArray()
        if (array.length() > MAX_SNAPSHOTS) fail("The saved schedule is too large for this phone.")
        val snapshots = buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: fail("A saved assignment is damaged.")
                add(parseSnapshot(item, returned, installationId))
            }
        }
        if (snapshots.map { it.snapshotId }.toSet().size != snapshots.size) fail("The saved schedule contains a duplicate assignment identity.")
        return ParsedBootstrap(
            contractVersion = contract,
            serviceDate = requiredDate(data, "service_date"),
            generatedAtEpochMs = requiredPositiveLong(data, "generated_at_epoch_ms"),
            device = returned,
            snapshots = snapshots,
        )
    }

    private fun parseSnapshot(
        envelope: JSONObject,
        status: AuthenticatedDeviceStatus,
        installationId: String,
    ): AssignmentSnapshotCandidate {
        val canonicalBytes = decodeBase64(requiredString(envelope, "canonical_bytes_b64"), "assignment bytes")
        val signatureBytes = decodeBase64(requiredString(envelope, "signature_b64"), "assignment signature")
        val snapshotDigest = requiredHash(envelope, "snapshot_digest")
        val snapshotId = requiredHash(envelope, "snapshot_id")
        val signatureDigest = requiredHash(envelope, "signature_digest")
        val keyId = requiredHash(envelope, "signing_key_id")
        val algorithm = requiredString(envelope, "signature_algorithm")
        if (snapshotId != snapshotDigest || snapshotDigest != sha256(canonicalBytes)) fail("A saved assignment changed while downloading.")
        if (signatureDigest != sha256(signatureBytes)) fail("A saved assignment signature is damaged.")
        if (keyId != expectedSigningKeyId || algorithm != "Ed25519") fail("A saved assignment has an unknown signature.")

        val body = parseCanonicalObject(canonicalBytes)
        requireExactKeys(body, SNAPSHOT_KEYS)
        if (canonicalize(body) != canonicalBytes.toString(StandardCharsets.UTF_8)) fail("A saved assignment is not in the required canonical format.")
        if (requiredString(body, "schema_version") != SNAPSHOT_SCHEMA) fail("A saved assignment uses an unsupported format.")
        if (requiredUuid(body, "employee_id") != status.employeeId) fail("A saved assignment belongs to a different employee.")
        if (requiredUuid(body, "device_installation_id") != installationId) fail("A saved assignment belongs to a different phone installation.")
        if (requiredPositiveLong(body, "assignment_epoch") != status.assignmentEpoch) fail("A saved assignment belongs to an older phone assignment.")
        if (requiredUuid(body, "credential_id") != status.credentialId) fail("A saved assignment belongs to a different secure credential.")
        val locationId = requiredUuid(body, "location_id")
        if (requiredPositiveLong(body, "tag_payload_version") != CustodialTagProtocol.VERSION.toLong()) fail("A location tag uses an unsupported format.")
        if (requiredUuid(body, "tag_id") != locationId) fail("A location tag identity does not match its assignment.")
        val ownershipStart = requiredPositiveLong(body, "ownership_start_epoch_ms")
        val ownershipEnd = requiredPositiveLong(body, "ownership_end_epoch_ms")
        val issued = requiredPositiveLong(body, "issued_at_epoch_ms")
        val offlineValidThrough = requiredPositiveLong(body, "offline_valid_through_epoch_ms")
        if (ownershipEnd <= ownershipStart || offlineValidThrough > ownershipEnd || issued > offlineValidThrough) {
            fail("A saved assignment has an invalid ownership time window.")
        }
        val candidate = AssignmentSnapshotCandidate(
            snapshotId = snapshotId,
            canonicalBytes = canonicalBytes,
            snapshotDigest = snapshotDigest,
            signatureDigest = signatureDigest,
            signatureBytes = signatureBytes,
            signingKeyId = keyId,
            signatureAlgorithm = algorithm,
            employeeId = status.employeeId,
            deviceInstallationId = installationId,
            operatingDate = requiredDate(body, "operating_date"),
            scheduleVersion = requiredUuid(body, "schedule_version"),
            scheduleRevision = requiredNonNegativeLong(body, "schedule_revision"),
            datedExceptionRevision = requiredNonNegativeLong(body, "dated_exception_revision"),
            workOccurrenceId = requiredUuid(body, "work_occurrence_id"),
            attemptGeneration = requiredPositiveLong(body, "attempt_generation").toIntExact("attempt_generation"),
            positionId = requiredUuid(body, "position_id"),
            locationId = locationId,
            locationName = requiredString(body, "location_name"),
            expectedTagPayloadHash = requiredHash(body, "expected_tag_payload_hash"),
            ownershipStartEpochMs = ownershipStart,
            ownershipEndEpochMs = ownershipEnd,
            issuedAtEpochMs = issued,
            offlineValidThroughEpochMs = offlineValidThrough,
            serverHighWaterMark = requiredNonNegativeLong(body, "server_high_water_mark"),
            trustedTimeLowerBoundAtAcceptance = requiredPositiveLong(body, "trusted_time_lower_bound_at_acceptance"),
        )
        if (!verifier.verify(candidate)) fail("The saved assignment signature could not be verified.")
        return candidate
    }

    private fun successData(response: SecureHttpResponse, fallback: String): JSONObject {
        val body = runCatching { JSONObject(response.body.toString(StandardCharsets.UTF_8)) }.getOrElse { fail(fallback) }
        if (response.status !in 200..299 || !body.optBoolean("ok", false)) {
            val message = body.optString("error", fallback).trim().ifBlank { fallback }
            fail(message)
        }
        return body.optJSONObject("data") ?: fail(fallback)
    }

    private fun parseCanonicalObject(bytes: ByteArray): JSONObject = runCatching {
        val source = bytes.toString(StandardCharsets.UTF_8)
        if (source.toByteArray(StandardCharsets.UTF_8).contentEquals(bytes).not()) fail("A saved assignment is not valid UTF-8.")
        JSONObject(source)
    }.getOrElse { fail("A saved assignment is damaged.") }

    private fun canonicalize(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is String -> quote(value)
        is Boolean -> if (value) "true" else "false"
        is Int, is Long, is Short, is Byte -> value.toString()
        is Number -> fail("A saved assignment contains an unsupported number.")
        is JSONArray -> buildString {
            append('[')
            for (index in 0 until value.length()) {
                if (index > 0) append(',')
                append(canonicalize(value.get(index)))
            }
            append(']')
        }
        is JSONObject -> buildString {
            append('{')
            val keys = TreeMap<String, Any?>()
            value.keys().forEach { key -> keys[key] = value.get(key) }
            keys.entries.forEachIndexed { index, entry ->
                if (index > 0) append(',')
                append(quote(entry.key)).append(':').append(canonicalize(entry.value))
            }
            append('}')
        }
        else -> fail("A saved assignment contains unsupported data.")
    }

    private fun quote(value: String): String = buildString {
        append('"')
        value.forEach { character ->
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\u000c' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (character.code < 0x20) append("\\u%04x".format(character.code)) else append(character)
            }
        }
        append('"')
    }

    private fun requireExactKeys(value: JSONObject, expected: Set<String>) {
        val actual = value.keys().asSequence().toSet()
        if (actual != expected) fail("A saved assignment contains unexpected or missing fields.")
    }

    private fun requiredString(value: JSONObject, name: String): String = value.optString(name, "").trim().ifBlank { fail("$name is missing.") }
    private fun requiredUuid(value: JSONObject, name: String): String = requiredString(value, name).lowercase().also {
        if (!UUID.matches(it)) fail("$name is invalid.")
    }
    private fun requiredHash(value: JSONObject, name: String): String = requiredString(value, name).lowercase().also {
        if (!HASH.matches(it)) fail("$name is invalid.")
    }
    private fun requiredDate(value: JSONObject, name: String): String = requiredString(value, name).also {
        if (!DATE.matches(it)) fail("$name is invalid.")
    }
    private fun requiredPositiveLong(value: JSONObject, name: String): Long = requiredNonNegativeLong(value, name).also {
        if (it < 1) fail("$name is invalid.")
    }
    private fun requiredNonNegativeLong(value: JSONObject, name: String): Long = runCatching { value.getLong(name) }.getOrElse { fail("$name is invalid.") }.also {
        if (it < 0) fail("$name is invalid.")
    }
    private fun Long.toIntExact(name: String): Int = toInt().also { if (it.toLong() != this || it < 1) fail("$name is invalid.") }
    private fun decodeBase64(value: String, label: String): ByteArray = runCatching { Base64.getDecoder().decode(value) }.getOrElse { fail("The $label is invalid.") }
    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun fail(message: String): Nothing = throw BootstrapPayloadException(message)

    private companion object {
        const val BOOTSTRAP_CONTRACT = "custodial-native-bootstrap.v1"
        const val SNAPSHOT_SCHEMA = "custodial-native-assignment-snapshot.v1"
        const val MAX_SNAPSHOTS = 512
        val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        val HASH = Regex("^[0-9a-f]{64}$")
        val DATE = Regex("^\\d{4}-\\d{2}-\\d{2}$")
        val SNAPSHOT_KEYS = setOf(
            "schema_version", "employee_id", "device_installation_id", "assignment_epoch", "credential_id",
            "operating_date", "schedule_version", "schedule_revision", "dated_exception_revision",
            "source_occurrence_id", "work_occurrence_id", "attempt_generation", "position_id", "location_id",
            "location_name", "tag_payload_version", "tag_id", "expected_tag_payload_hash",
            "ownership_start_epoch_ms", "ownership_end_epoch_ms", "issued_at_epoch_ms",
            "offline_valid_through_epoch_ms", "server_high_water_mark", "trusted_time_lower_bound_at_acceptance",
        )
    }
}

internal class BootstrapPayloadException(message: String) : Exception(message)
