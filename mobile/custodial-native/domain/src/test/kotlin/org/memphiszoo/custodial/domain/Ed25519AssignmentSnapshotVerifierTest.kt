package org.memphiszoo.custodial.domain

import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Ed25519AssignmentSnapshotVerifierTest {
    @Test
    fun acceptsExactSignedBytesAndRejectsEveryChangedComponent() {
        val pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val keyId = Ed25519AssignmentSnapshotVerifier.keyId(pair.public)
        val verifier = Ed25519AssignmentSnapshotVerifier.fromBase64X509(
            mapOf(keyId to Base64.getEncoder().encodeToString(pair.public.encoded)),
        )
        val bytes = "{\"schema_version\":\"custodial-native-assignment-snapshot.v1\"}".toByteArray()
        val signature = Signature.getInstance("Ed25519").run {
            initSign(pair.private)
            update(bytes)
            sign()
        }
        val candidate = candidate(bytes, signature, keyId)

        assertTrue(verifier.verify(candidate))
        assertFalse(verifier.verify(candidate.copy(canonicalBytes = bytes + 0)))
        assertFalse(verifier.verify(candidate.copy(signatureBytes = signature.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() })))
        assertFalse(verifier.verify(candidate.copy(signingKeyId = "0".repeat(64))))
        assertFalse(verifier.verify(candidate.copy(signatureAlgorithm = "SHA256withRSA")))
    }

    private fun candidate(bytes: ByteArray, signature: ByteArray, keyId: String) = AssignmentSnapshotCandidate(
        snapshotId = Ed25519AssignmentSnapshotVerifier.sha256(bytes),
        canonicalBytes = bytes,
        snapshotDigest = Ed25519AssignmentSnapshotVerifier.sha256(bytes),
        signatureDigest = Ed25519AssignmentSnapshotVerifier.sha256(signature),
        signatureBytes = signature,
        signingKeyId = keyId,
        employeeId = "employee",
        deviceInstallationId = "installation",
        operatingDate = "2026-08-30",
        scheduleVersion = "version",
        scheduleRevision = 1,
        datedExceptionRevision = 0,
        workOccurrenceId = "occurrence",
        attemptGeneration = 1,
        positionId = "position",
        locationId = "location",
        locationName = "Location",
        expectedTagPayloadHash = "a".repeat(64),
        ownershipStartEpochMs = 1,
        ownershipEndEpochMs = 2,
        issuedAtEpochMs = 1,
        offlineValidThroughEpochMs = 2,
        serverHighWaterMark = 1,
        trustedTimeLowerBoundAtAcceptance = 1,
    )
}
