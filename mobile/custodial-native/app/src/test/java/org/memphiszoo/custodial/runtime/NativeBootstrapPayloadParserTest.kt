package org.memphiszoo.custodial.runtime

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64
import java.util.TreeMap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.memphiszoo.custodial.domain.Ed25519AssignmentSnapshotVerifier

class NativeBootstrapPayloadParserTest {
    private lateinit var pair: KeyPair
    private lateinit var keyId: String
    private lateinit var parser: NativeBootstrapPayloadParser

    private val deviceId = "KIOSK_08"
    private val employeeId = "3da709bb-2223-4e15-8e3a-db02e3f32e97"
    private val installationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    private val credentialId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    private val locationId = "9eb69196-c103-4a9f-873a-227d32c42ccd"

    @Before
    fun setUp() {
        pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        keyId = Ed25519AssignmentSnapshotVerifier.keyId(pair.public)
        val verifier = Ed25519AssignmentSnapshotVerifier.fromBase64X509(
            mapOf(keyId to Base64.getEncoder().encodeToString(pair.public.encoded)),
        )
        parser = NativeBootstrapPayloadParser(keyId, verifier)
    }

    @Test
    fun parsesAuthenticatedStatusAndExactSignedSnapshots() {
        val status = parser.parseStatus(statusResponse())
        val parsed = parser.parseBootstrap(bootstrapResponse(snapshotEnvelope()), status, installationId)

        assertEquals(deviceId, parsed.device.canonicalDeviceId)
        assertEquals(employeeId, parsed.device.employeeId)
        assertEquals("Karen Robinson", parsed.device.employeeName)
        assertEquals(18L, parsed.device.assignmentEpoch)
        assertEquals(1, parsed.snapshots.size)
        assertEquals(locationId, parsed.snapshots.single().locationId)
        assertEquals("Cathouse Cafe Men's Restroom", parsed.snapshots.single().locationName)
        assertTrue(parsed.snapshots.single().signatureBytes.isNotEmpty())
    }

    @Test
    fun rejectsChangedCanonicalBytesEvenWhenEnvelopeDigestIsUpdated() {
        val status = parser.parseStatus(statusResponse())
        val original = snapshotBody().toMutableMap()
        original["location_name"] = "Changed Location"
        val changed = canonical(original)
        val envelope = snapshotEnvelope().apply {
            // A malicious intermediary can update plain envelope digests but cannot produce a valid signature.
            put("canonical_bytes_b64", Base64.getEncoder().encodeToString(changed))
            put("snapshot_id", sha256(changed))
            put("snapshot_digest", sha256(changed))
        }

        val failure = assertThrows(BootstrapPayloadException::class.java) {
            parser.parseBootstrap(bootstrapResponse(envelope), status, installationId)
        }
        assertTrue(failure.message!!.contains("signature", ignoreCase = true))
    }

    @Test
    fun rejectsSignedButNonCanonicalJson() {
        val status = parser.parseStatus(statusResponse())
        val body = snapshotBody()
        val nonCanonical = JSONObject(body).toString().toByteArray()
        val envelope = signedEnvelope(nonCanonical, pair)

        val failure = assertThrows(BootstrapPayloadException::class.java) {
            parser.parseBootstrap(bootstrapResponse(envelope), status, installationId)
        }
        assertTrue(failure.message!!.contains("canonical", ignoreCase = true))
    }

    @Test
    fun rejectsAssignmentEpochOrInstallationMismatch() {
        val status = parser.parseStatus(statusResponse())
        val wrongEpoch = snapshotBody().toMutableMap().apply { this["assignment_epoch"] = 17L }
        val epochFailure = assertThrows(BootstrapPayloadException::class.java) {
            parser.parseBootstrap(bootstrapResponse(signedEnvelope(canonical(wrongEpoch), pair)), status, installationId)
        }
        assertTrue(epochFailure.message!!.contains("older phone assignment", ignoreCase = true))

        val wrongInstall = snapshotBody().toMutableMap().apply {
            this["device_installation_id"] = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        }
        val installationFailure = assertThrows(BootstrapPayloadException::class.java) {
            parser.parseBootstrap(bootstrapResponse(signedEnvelope(canonical(wrongInstall), pair)), status, installationId)
        }
        assertTrue(installationFailure.message!!.contains("different phone installation", ignoreCase = true))
    }

    private fun statusResponse(): SecureHttpResponse {
        val data = JSONObject()
            .put("authenticated", true)
            .put("canonical_device_id", deviceId)
            .put("employee_id", employeeId)
            .put("employee_name", "Karen Robinson")
            .put("employee_role", "Custodian")
            .put("assignment_epoch", 18)
            .put("credential_id", credentialId)
            .put("credential_expires_at", "2027-08-30T00:00:00.000Z")
        return SecureHttpResponse(200, emptyMap(), JSONObject().put("ok", true).put("data", data).toString().toByteArray())
    }

    private fun bootstrapResponse(envelope: JSONObject): SecureHttpResponse {
        val device = JSONObject()
            .put("canonical_device_id", deviceId)
            .put("device_installation_id", installationId)
            .put("employee_id", employeeId)
            .put("employee_name", "Karen Robinson")
            .put("assignment_epoch", 18)
            .put("credential_id", credentialId)
        val data = JSONObject()
            .put("contract_version", "custodial-native-bootstrap.v1")
            .put("generated_at_epoch_ms", 1_788_267_600_000L)
            .put("service_date", "2026-09-01")
            .put("device", device)
            .put("signing_key_id", keyId)
            .put("assignment_snapshots", JSONArray().put(envelope))
        return SecureHttpResponse(200, emptyMap(), JSONObject().put("ok", true).put("data", data).toString().toByteArray())
    }

    private fun snapshotEnvelope(): JSONObject = signedEnvelope(canonical(snapshotBody()), pair)

    private fun snapshotBody(): Map<String, Any> = mapOf(
        "schema_version" to "custodial-native-assignment-snapshot.v1",
        "employee_id" to employeeId,
        "device_installation_id" to installationId,
        "assignment_epoch" to 18L,
        "credential_id" to credentialId,
        "operating_date" to "2026-09-01",
        "schedule_version" to "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "schedule_revision" to 18L,
        "dated_exception_revision" to 0L,
        "source_occurrence_id" to "8f751704-71c7-4ef3-9b51-053af93d1760",
        "work_occurrence_id" to "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "attempt_generation" to 1L,
        "position_id" to "f22348e9-d4b9-5a7e-b8fd-d0d2c1ec534f",
        "location_id" to locationId,
        "location_name" to "Cathouse Cafe Men's Restroom",
        "tag_payload_version" to 1L,
        "tag_id" to locationId,
        "expected_tag_payload_hash" to "f3361a748f0751517ac9ee0093689b91239faf2d9e4e64fd1b766e0dda6151e4",
        "ownership_start_epoch_ms" to 1_788_267_600_000L,
        "ownership_end_epoch_ms" to 1_788_284_700_000L,
        "issued_at_epoch_ms" to 1_788_267_600_000L,
        "offline_valid_through_epoch_ms" to 1_788_284_700_000L,
        "server_high_water_mark" to 18L,
        "trusted_time_lower_bound_at_acceptance" to 1_788_267_600_000L,
    )

    private fun signedEnvelope(bytes: ByteArray, signingPair: KeyPair): JSONObject {
        val signature = Signature.getInstance("Ed25519").run {
            initSign(signingPair.private)
            update(bytes)
            sign()
        }
        return JSONObject()
            .put("snapshot_id", sha256(bytes))
            .put("canonical_bytes_b64", Base64.getEncoder().encodeToString(bytes))
            .put("snapshot_digest", sha256(bytes))
            .put("signature_algorithm", "Ed25519")
            .put("signing_key_id", keyId)
            .put("signature_b64", Base64.getEncoder().encodeToString(signature))
            .put("signature_digest", sha256(signature))
    }

    private fun canonical(values: Map<String, Any>): ByteArray = buildString {
        append('{')
        TreeMap(values).entries.forEachIndexed { index, (key, value) ->
            if (index > 0) append(',')
            append(JSONObject.quote(key)).append(':')
            append(if (value is String) JSONObject.quote(value) else value.toString())
        }
        append('}')
    }.toByteArray()

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}
