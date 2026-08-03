package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.InputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPrivateKeySpec;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Exact Android equality gate against the backend-owned v2 golden fixture. */
public final class ManagerV2GoldenContractTest {
    private static final String RESOURCE = "manager-device-auth-v2-golden.json";
    private static final String LABEL = "Operations Manager phone";
    private static final String CODE = "12345678";
    private static final String ACCESS = "full_access";

    @Test
    public void androidSemanticsProofAndKeyIdentifiersMatchBackendGolden() throws Exception {
        JSONObject fixture = fixture();
        assertEquals(2, fixture.getInt("fixture_version"));
        assertEquals(ManagerV2WireContract.CONTRACT, fixture.getString("contract_version"));
        assertTrue(fixture.getString("warning").startsWith("Public deterministic test material only."));
        JSONObject sessionContract = fixture.getJSONObject("ops_session_contract");
        assertEquals(ManagerV2WireContract.OPS_SESSION_MIN_BYTES, sessionContract.getInt("minimum_utf8_bytes"));
        assertEquals(ManagerV2WireContract.OPS_SESSION_MAX_BYTES, sessionContract.getInt("maximum_utf8_bytes"));
        assertEquals("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$", sessionContract.getString("pattern"));
        assertEquals(
            sessionContract.getString("golden_value"),
            ManagerV2WireContract.opsSession(sessionContract.getString("golden_value"))
        );

        JSONObject ids = fixture.getJSONObject("identifiers");
        String operationId = ids.getString("operation_id");
        String deviceId = ids.getString("device_id");
        JSONObject keyMaterial = fixture.getJSONObject("test_only_key_material");
        PublicKey signing = publicKey(keyMaterial.getJSONObject("signing_public_key_jwk"));
        PublicKey wrapping = publicKey(keyMaterial.getJSONObject("wrapping_public_key_jwk"));
        String signingKeyId = keyMaterial.getString("signing_key_id");
        String wrappingKeyId = keyMaterial.getString("wrapping_key_id");
        assertEquals(jwk(keyMaterial.getJSONObject("signing_public_key_jwk")), ManagerV2WireContract.publicJwk(signing));
        assertEquals(jwk(keyMaterial.getJSONObject("wrapping_public_key_jwk")), ManagerV2WireContract.publicJwk(wrapping));
        assertEquals(signingKeyId, ManagerV2WireContract.thumbprint(signing));
        assertEquals(wrappingKeyId, ManagerV2WireContract.thumbprint(wrapping));

        JSONObject digests = fixture.getJSONObject("semantic_body_sha256");
        JSONObject challenges = digests.getJSONObject("attestation_challenges");
        for (String purpose : List.of("enroll", "recover", "authorized_session")) {
            assertEquals(
                challenges.getString("android_" + purpose),
                ManagerV2WireContract.challengeBodyDigest(
                    operationId, purpose, deviceId, LABEL, "android", signingKeyId, wrappingKeyId
                )
            );
            assertEquals(
                challenges.getString("ios_" + purpose),
                ManagerV2WireContract.challengeBodyDigest(
                    operationId, purpose, deviceId, LABEL, "ios", signingKeyId, wrappingKeyId
                )
            );
        }

        JSONObject androidAttestation = fixture.getJSONObject("attestation_examples").getJSONObject("android");
        String evidenceDigest = ManagerV2WireContract.playIntegrityEvidenceDigest(
            androidAttestation.getString("app_id"), androidAttestation.getString("token")
        );
        JSONObject enrollment = digests.getJSONObject("enrollment_operations");
        for (String flow : List.of("enroll", "recover")) {
            assertEquals(
                enrollment.getString("android_" + flow),
                ManagerV2WireContract.enrollmentBodyDigest(
                    operationId, flow, CODE, deviceId, LABEL, "android", ACCESS,
                    signingKeyId, wrappingKeyId, androidAttestation.getString("provider"),
                    androidAttestation.getString("challenge_id"), evidenceDigest
                )
            );
        }
        JSONObject actions = digests.getJSONObject("actions");
        for (String action : List.of("resume", "confirm", "cancel")) {
            assertEquals(actions.getString(action), ManagerV2WireContract.actionBodyDigest(operationId, action));
        }
        assertEquals(digests.getString("removal"), ManagerV2WireContract.removeBodyDigest(operationId, deviceId));
        assertEquals(
            digests.getJSONObject("authorized_sessions").getString("android"),
            ManagerV2WireContract.authorizedSessionBodyDigest(
                operationId, deviceId, ACCESS, androidAttestation.getString("provider"),
                androidAttestation.getString("challenge_id"), evidenceDigest
            )
        );

        JSONObject proof = fixture.getJSONObject("proof");
        byte[] input = ManagerV2WireContract.proofInput(
            proof.getString("method"), proof.getString("path"), operationId,
            proof.getLong("issued_at"), proof.getString("nonce"), proof.getString("body_sha256")
        );
        assertEquals(proof.getString("input_hex"), hex(input));
        assertEquals(proof.getString("input_base64url"), ManagerV2WireContract.base64url(input));
        JSONObject value = proof.getJSONObject("value");
        assertEquals(ManagerV2WireContract.PROOF_ALGORITHM, value.getString("algorithm"));
        assertTrue(ManagerV2WireContract.verifyP1363(
            signing,
            input,
            ManagerV2WireContract.decodeBase64url(value.getString("signature"), 64, "test_invalid_signature")
        ));
    }

    @Test
    public void hkdfAadAndBothSealedResultsMatchAndDecryptExactly() throws Exception {
        JSONObject fixture = fixture();
        JSONObject ids = fixture.getJSONObject("identifiers");
        JSONObject keyMaterial = fixture.getJSONObject("test_only_key_material");
        JSONObject envelope = fixture.getJSONObject("envelope");
        String operationId = ids.getString("operation_id");
        String wrappingKeyId = keyMaterial.getString("wrapping_key_id");
        assertEquals(ManagerV2WireContract.ENVELOPE_ALGORITHM, envelope.getString("algorithm"));
        assertBytes(envelope, "enrollment_hkdf_info", ManagerV2WireContract.envelopeInfo(operationId, wrappingKeyId));
        assertBytes(envelope, "session_hkdf_info", ManagerV2WireContract.sessionEnvelopeInfo(operationId, wrappingKeyId));

        JSONObject pendingData = fixture.getJSONObject("exact_public_dtos")
            .getJSONObject("pending_enrollment").getJSONObject("data");
        JSONObject enrollmentEnvelope = envelope.getJSONObject("sealed_enrollment_result");
        assertJsonEquals(enrollmentEnvelope, pendingData.getJSONObject("result_envelope"));
        Map<String, String> enrollmentBinding = stringMap(
            "operation_id", operationId,
            "credential_id", ids.getString("credential_id"),
            "device_id", ids.getString("device_id"),
            "manager_id", ids.getString("manager_id"),
            "credential_expires_at", pendingData.getString("credential_expires_at"),
            "resume_expires_at", pendingData.getString("resume_expires_at"),
            "wrapping_key_id", enrollmentEnvelope.getString("wrapping_key_id"),
            "ephemeral_key_id", enrollmentEnvelope.getString("ephemeral_key_id"),
            "salt", enrollmentEnvelope.getString("salt"),
            "iv", enrollmentEnvelope.getString("iv")
        );
        byte[] enrollmentAad = ManagerV2WireContract.envelopeAad(enrollmentBinding);
        assertBytes(envelope, "enrollment_aad", enrollmentAad);
        JSONObject enrollmentSecret = decrypt(
            enrollmentEnvelope, privateKey(keyMaterial.getString("wrapping_private_scalar_hex")),
            operationId, enrollmentAad, false
        );
        assertExactKeys(enrollmentSecret, Set.of(
            "contract_version", "operation_id", "credential_id", "device_credential",
            "device_id", "manager_id", "credential_expires_at"
        ));
        assertEquals(ManagerV2WireContract.CONTRACT, enrollmentSecret.getString("contract_version"));
        assertEquals(operationId, enrollmentSecret.getString("operation_id"));
        assertEquals(ids.getString("credential_id") + "." + "S".repeat(43), enrollmentSecret.getString("device_credential"));
        assertEquals(ids.getString("device_id"), enrollmentSecret.getString("device_id"));
        assertEquals(ids.getString("manager_id"), enrollmentSecret.getString("manager_id"));

        JSONObject sessionData = fixture.getJSONObject("exact_public_dtos")
            .getJSONObject("authorized_session").getJSONObject("data");
        JSONObject sessionEnvelope = envelope.getJSONObject("sealed_authorized_session_result");
        assertJsonEquals(sessionEnvelope, sessionData.getJSONObject("result_envelope"));
        List<String> roles = strings(sessionData.getJSONArray("roles"));
        assertEquals(strings(fixture.getJSONArray("canonical_roles")), roles);
        Map<String, String> sessionBinding = stringMap(
            "operation_id", operationId,
            "session_id", ids.getString("session_id"),
            "credential_id", ids.getString("credential_id"),
            "device_id", ids.getString("device_id"),
            "manager_id", ids.getString("manager_id"),
            "roles", String.join(",", roles),
            "access_level", sessionData.getString("access_level"),
            "session_expires_at", sessionData.getString("session_expires_at"),
            "wrapping_key_id", sessionEnvelope.getString("wrapping_key_id"),
            "ephemeral_key_id", sessionEnvelope.getString("ephemeral_key_id"),
            "salt", sessionEnvelope.getString("salt"),
            "iv", sessionEnvelope.getString("iv")
        );
        byte[] sessionAad = ManagerV2WireContract.sessionEnvelopeAad(sessionBinding);
        assertBytes(envelope, "session_aad", sessionAad);
        byte[] sessionPlaintext = decryptBytes(
            sessionEnvelope, privateKey(keyMaterial.getString("wrapping_private_scalar_hex")),
            operationId, sessionAad, true
        );
        char[] bearer = null;
        try {
            // Golden acceptance must traverse the exact production parser;
            // direct test-only JSON inspection previously allowed a sealed
            // session that both native runtimes would reject at runtime.
            bearer = HttpsEnrollmentTransport.parseAuthorizedSessionSecret(
                sessionPlaintext,
                operationId,
                ids.getString("session_id"),
                ids.getString("device_id"),
                ids.getString("manager_id"),
                roles,
                sessionData.getString("access_level"),
                sessionData.getString("session_expires_at")
            );
            assertTrue(bearer.length >= ManagerV2WireContract.OPS_SESSION_MIN_BYTES);
            assertEquals(new String(bearer), ManagerV2WireContract.opsSession(new String(bearer)));
            assertEquals(
                fixture.getJSONObject("ops_session_contract").getString("golden_value"),
                new String(bearer)
            );
        } finally {
            VaultValidation.wipe(bearer);
            Arrays.fill(sessionPlaintext, (byte) 0);
        }
    }

    @Test
    public void exactPublicDtosAndChallengeReplacementRemainCanonical() throws Exception {
        JSONObject fixture = fixture();
        JSONObject ids = fixture.getJSONObject("identifiers");
        JSONObject dtos = fixture.getJSONObject("exact_public_dtos");
        JSONObject pending = dtos.getJSONObject("pending_enrollment");
        JSONObject authorized = dtos.getJSONObject("authorized_session");
        assertExactKeys(pending, Set.of("ok", "data"));
        assertExactKeys(authorized, Set.of("ok", "data"));
        assertTrue(pending.getBoolean("ok"));
        assertTrue(authorized.getBoolean("ok"));
        assertEquals(ManagerV2WireContract.CONTRACT, pending.getJSONObject("data").getString("contract_version"));
        assertEquals(ManagerV2WireContract.CONTRACT, authorized.getJSONObject("data").getString("contract_version"));
        assertEquals(strings(fixture.getJSONArray("canonical_roles")), strings(pending.getJSONObject("data").getJSONArray("roles")));
        assertEquals(strings(fixture.getJSONArray("canonical_roles")), strings(authorized.getJSONObject("data").getJSONArray("roles")));

        JSONObject replacement = fixture.getJSONObject("challenge_expiry_replacement");
        assertTrue(replacement.getString("invariant").contains("Same operation and request fingerprint"));
        JSONObject firstRecord = replacement.getJSONObject("first").getJSONObject("record");
        JSONObject nextRecord = replacement.getJSONObject("replacement").getJSONObject("record");
        assertEquals(ids.getString("operation_id"), firstRecord.getString("operationId"));
        assertEquals(firstRecord.getString("operationId"), nextRecord.getString("operationId"));
        assertEquals(firstRecord.getString("requestFingerprint"), nextRecord.getString("requestFingerprint"));
        assertEquals(1, firstRecord.getInt("generation"));
        assertEquals(2, nextRecord.getInt("generation"));
        assertFalse(firstRecord.getString("challengeId").equals(nextRecord.getString("challengeId")));
        assertNotNull(firstRecord.getString("supersededAt"));
        assertTrue(nextRecord.isNull("supersededAt"));
        assertEquals(
            firstRecord.getString("challengeId"),
            replacement.getJSONObject("first").getJSONObject("response").getJSONObject("data").getString("challenge_id")
        );
        assertEquals(
            nextRecord.getString("challengeId"),
            replacement.getJSONObject("replacement").getJSONObject("response").getJSONObject("data").getString("challenge_id")
        );
    }

    private static JSONObject decrypt(
        JSONObject envelope,
        PrivateKey wrappingPrivate,
        String operationId,
        byte[] aad,
        boolean session
    ) throws Exception {
        byte[] clear = decryptBytes(envelope, wrappingPrivate, operationId, aad, session);
        try {
            return new JSONObject(new String(clear, StandardCharsets.UTF_8));
        } finally {
            Arrays.fill(clear, (byte) 0);
        }
    }

    private static byte[] decryptBytes(
        JSONObject envelope,
        PrivateKey wrappingPrivate,
        String operationId,
        byte[] aad,
        boolean session
    ) throws Exception {
        PublicKey ephemeral = publicKey(envelope.getJSONObject("ephemeral_public_key_jwk"));
        assertEquals(envelope.getString("ephemeral_key_id"), ManagerV2WireContract.thumbprint(ephemeral));
        byte[] salt = decode(envelope, "salt", 32);
        byte[] iv = decode(envelope, "iv", 12);
        byte[] ciphertext = decodeVariable(envelope, "ciphertext");
        byte[] tag = decode(envelope, "tag", 16);
        return session
            ? ManagerV2WireContract.decryptSessionEnvelope(
                wrappingPrivate, ephemeral, operationId, envelope.getString("wrapping_key_id"),
                salt, iv, ciphertext, tag, aad
            )
            : ManagerV2WireContract.decryptEnvelope(
                wrappingPrivate, ephemeral, operationId, envelope.getString("wrapping_key_id"),
                salt, iv, ciphertext, tag, aad
            );
    }

    private static JSONObject fixture() throws Exception {
        try (InputStream input = ManagerV2GoldenContractTest.class.getClassLoader().getResourceAsStream(RESOURCE)) {
            assertNotNull("Golden fixture must be packaged as a JVM test resource", input);
            return new JSONObject(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static PublicKey publicKey(JSONObject value) throws Exception {
        return ManagerV2WireContract.publicKey(jwk(value));
    }

    private static Map<String, String> jwk(JSONObject value) throws Exception {
        Map<String, String> result = new LinkedHashMap<>();
        for (String key : List.of("kty", "crv", "x", "y")) result.put(key, value.getString(key));
        return Map.copyOf(result);
    }

    private static PrivateKey privateKey(String scalarHex) throws Exception {
        AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
        parameters.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec curve = parameters.getParameterSpec(ECParameterSpec.class);
        return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(scalarHex, 16), curve));
    }

    private static Map<String, String> stringMap(String... values) {
        Map<String, String> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) result.put(values[index], values[index + 1]);
        return Map.copyOf(result);
    }

    private static List<String> strings(JSONArray value) {
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        for (int index = 0; index < value.length(); index += 1) result.add(value.optString(index));
        return List.copyOf(result);
    }

    private static byte[] decode(JSONObject object, String field, int bytes) throws Exception {
        return ManagerV2WireContract.decodeBase64url(object.getString(field), bytes, "test_invalid_fixture");
    }

    private static byte[] decodeVariable(JSONObject object, String field) throws Exception {
        return java.util.Base64.getUrlDecoder().decode(object.getString(field));
    }

    private static void assertBytes(JSONObject source, String prefix, byte[] actual) throws Exception {
        assertEquals(source.getString(prefix + "_hex"), hex(actual));
        assertEquals(source.getString(prefix + "_base64url"), ManagerV2WireContract.base64url(actual));
    }

    private static void assertJsonEquals(JSONObject expected, JSONObject actual) {
        assertEquals(expected.toString(), actual.toString());
    }

    private static void assertExactKeys(JSONObject value, Set<String> expected) {
        java.util.HashSet<String> actual = new java.util.HashSet<>();
        java.util.Iterator<String> keys = value.keys();
        while (keys.hasNext()) actual.add(keys.next());
        assertEquals(expected, actual);
    }

    private static String hex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(java.util.Locale.ROOT, "%02x", item & 0xff));
        return result.toString();
    }
}
