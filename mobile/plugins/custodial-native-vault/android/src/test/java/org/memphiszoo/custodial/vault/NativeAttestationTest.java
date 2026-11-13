package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.Test;

public final class NativeAttestationTest {
    @Test
    public void protectedCredentialIdFillsMissingMetadataButRejectsAConflictingBinding() throws Exception {
        char[] credential = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.test-secret".toCharArray();
        try {
            assertEquals(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                NativeAttestation.resolveStoredCredentialId(credential, "")
            );
            assertEquals(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                NativeAttestation.resolveStoredCredentialId(
                    credential,
                    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"
                )
            );
            try {
                NativeAttestation.resolveStoredCredentialId(
                    credential,
                    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
                );
                fail("Expected the conflicting credential binding to be rejected.");
            } catch (VaultFailure error) {
                assertEquals("custodial_native_credential_binding_mismatch", error.code);
            }
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private static final String CREDENTIAL = "11111111-1111-4111-8111-111111111111.super-secret";
    private static final String DEVICE = "KIOSK_02";
    private static final String LOCATION = "TETM";
    private static final String SESSION = "22222222-2222-4222-8222-222222222222";
    private static final String SNAPSHOT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String EMPLOYEE = "33333333-3333-4333-8333-333333333333";
    private static final String COMPLETION = "44444444-4444-4444-8444-444444444444";
    private static final String CONTEXT = "55555555-5555-4555-8555-555555555555";
    private static final String SCAN_ENTRY = "66666666-6666-4666-8666-666666666666";

    @Test
    public void offlineStartUsesTheExactPublishedCanonicalHmac() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            Map<String, Object> result = NativeAttestation.offlineStart(
                DEVICE, LOCATION, SESSION, SNAPSHOT, EMPLOYEE, 7L,
                "11111111-1111-4111-8111-111111111111", SCAN_ENTRY, credential,
                "2026-08-13T12:34:56.789Z"
            );
            assertEquals("custodial-native-start.v1", result.get("p_native_start_attestation_version"));
            assertEquals("2026-08-13T12:34:56.789Z", result.get("p_client_started_at"));
            assertEquals(SCAN_ENTRY, result.get("p_native_scan_entry_id"));
            assertEquals("d7e06a5950c2a029a4d0d0d9477e41e7c28c4e2bd5193e0540702f88c38f9cc4", result.get("p_native_start_attestation"));
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    @Test
    public void recoveredStartPreservesOriginalProofAndAddsCurrentTransportHmac() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            Map<String, Object> result = NativeAttestation.offlineStartTransport(
                DEVICE, LOCATION, SESSION, SNAPSHOT, EMPLOYEE, 7L,
                "99999999-9999-4999-8999-999999999999", SCAN_ENTRY,
                "2026-08-13T12:34:56.789Z", "custodial-native-start.v1",
                "a".repeat(64), credential
            );
            assertEquals("custodial-native-start.v1", result.get("p_native_start_attestation_version"));
            assertEquals("a".repeat(64), result.get("p_native_start_attestation"));
            assertEquals("custodial-native-start-transport.v1", result.get("p_native_start_transport_attestation_version"));
            assertEquals("a9d12ad307b0b112f44d07d9717d1a486e3a765a436918e20290d28b13df91c1", result.get("p_native_start_transport_attestation"));
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    @Test
    public void offlineCompletionUsesTheExactPublishedCanonicalHmac() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            Map<String, Object> result = NativeAttestation.offlineCompletion(
                DEVICE, LOCATION, SESSION, COMPLETION, CONTEXT, SCAN_ENTRY,
                "2026-08-13T12:34:56.789Z", credential, "2026-08-13T13:45:00.123Z"
            );
            assertEquals("custodial-native-completion.v2", result.get("p_native_completion_attestation_version"));
            assertEquals(SCAN_ENTRY, result.get("p_native_finish_scan_entry_id"));
            assertEquals("2026-08-13T13:45:00.123Z", result.get("p_client_ended_at"));
            assertEquals("1e00a0c93c977d3385423974fbb96744521fa0b9d0e18e6b91f08a87315f969e", result.get("p_native_completion_attestation"));
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    @Test
    public void recoveredCompletionPreservesOriginalProofAndAddsCurrentTransportHmac() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            Map<String, Object> result = NativeAttestation.offlineCompletionTransport(
                DEVICE, LOCATION, SESSION, COMPLETION, CONTEXT, SCAN_ENTRY,
                "2026-08-13T12:34:56.789Z", "2026-08-13T13:45:00.123Z",
                "custodial-native-completion.v2", "b".repeat(64), credential
            );
            assertEquals("custodial-native-completion.v2", result.get("p_native_completion_attestation_version"));
            assertEquals("b".repeat(64), result.get("p_native_completion_attestation"));
            assertEquals("custodial-native-completion-transport.v1", result.get("p_native_completion_transport_attestation_version"));
            assertEquals("d1aa15163a1c5d7d6fea9bfcf4b8428bf7c026765f5d90b94d8a327ced609733", result.get("p_native_completion_transport_attestation"));
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    @Test
    public void offlineCompletionRejectsNonUuidCompletionIdentity() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            NativeAttestation.offlineCompletion(
                DEVICE, LOCATION, SESSION, "completion-1", CONTEXT, SCAN_ENTRY,
                "2026-08-13T12:34:56.789Z", credential, "2026-08-13T13:45:00.123Z"
            );
            fail("Expected a canonical UUID requirement.");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_completion_attestation_refused", error.code);
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    @Test
    public void physicalRequestHeadersUseExactCanonicalHmacAndFreshIds() throws Exception {
        char[] credential = CREDENTIAL.toCharArray();
        try {
            AuthorizedRequest request = new AuthorizedRequest(
                "/scan-api/tool_start_offline_occurrence?mode=canary",
                "POST",
                VaultCollections.mapOf("Content-Type", "application/json"),
                "{\"p_device_id\":\"KIOSK_02\"}".getBytes(StandardCharsets.UTF_8)
            );
            Map<String, String> first = NativeAttestation.requestHeaders(
                request, DEVICE, credential, "66666666-6666-4666-8666-666666666666", 1786630516017L
            );
            Map<String, String> second = NativeAttestation.requestHeaders(
                request, DEVICE, credential, "77777777-7777-4777-8777-777777777777", 1786630516017L
            );
            assertEquals("custodial-native-request.v1", first.get("X-Memphis-Native-Attestation-Version"));
            assertEquals("66666666-6666-4666-8666-666666666666", first.get("X-Memphis-Native-Request-Id"));
            assertEquals("2026-08-13T14:15:16.017Z", first.get("X-Memphis-Native-Request-Timestamp"));
            assertEquals("f124712df2348ba3d70998b3a806c98cd13f83357cb0fe0cc033d338ad4bd9e1", first.get("X-Memphis-Native-Request-Attestation"));
            assertNotEquals(first.get("X-Memphis-Native-Request-Id"), second.get("X-Memphis-Native-Request-Id"));
            assertNotEquals(first.get("X-Memphis-Native-Request-Attestation"), second.get("X-Memphis-Native-Request-Attestation"));
        } finally {
            VaultValidation.wipe(credential);
        }
    }
}
