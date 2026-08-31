package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

public final class HttpsEnrollmentTransportTest {
    private static final String DEVICE = "KIOSK_08";
    private static final String CREDENTIAL = "80000000-0000-4000-8000-000000000008";

    @Test
    public void recursivelyScrubsCredentialKeysAndEveryCredentialSubstring() throws Exception {
        char[] credential = "device-credential-secret-123456".toCharArray();
        String source = """
            {
              "ok": false,
              "credential_active": true,
              "device_credential": "device-credential-secret-123456",
              "message": "Device device-credential-secret-123456 rejected",
              "nested": {
                "array": [
                  "prefix-device-credential-secret-123456-suffix",
                  {"safe":"preserved","token":"hidden"}
                ],
                "key-device-credential-secret-123456": "hidden"
              }
            }
            """;
        byte[] safe = HttpsEnrollmentTransport.scrubResponseBody(
            source.getBytes(StandardCharsets.UTF_8),
            "application/json",
            credential
        );
        String encoded = new String(safe, StandardCharsets.UTF_8);
        assertFalse(encoded.contains(new String(credential)));
        assertFalse(encoded.contains("device_credential"));
        assertFalse(encoded.contains("\"token\""));
        assertTrue(encoded.contains("credential_active"));
        assertTrue(encoded.contains("preserved"));
    }

    @Test
    public void nonJsonCredentialEchoIsRefused() throws Exception {
        char[] credential = "device-credential-secret-123456".toCharArray();
        try {
            HttpsEnrollmentTransport.scrubResponseBody(
                "Error: device-credential-secret-123456".getBytes(StandardCharsets.UTF_8),
                "text/plain",
                credential
            );
            fail("Expected secret echo refusal");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_secret_response_refused", error.code);
        }
    }

    @Test
    public void remoteFailureCarriesOnlyValidatedStatus() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = new HttpsEnrollmentTransport.HttpResult(
            401,
            Map.of("set-cookie", List.of("secret")),
            "{\"ok\":false,\"code\":\"invalid_enrollment_code\",\"error\":\"unsafe body\"}".getBytes(StandardCharsets.UTF_8)
        );
        try {
            HttpsEnrollmentTransport.requireSuccessData(response, "custodial_native_terminal_request_failed");
            fail("Expected failure");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_terminal_request_failed", error.code);
            assertEquals(401, error.httpStatus);
            assertEquals("invalid_enrollment_code", error.remoteReason);
            assertFalse(error.getMessage().contains("unsafe body"));
        }
    }

    @Test
    public void successParserRequiresOkObjectAndData() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = new HttpsEnrollmentTransport.HttpResult(
            200,
            Map.of(),
            "{\"ok\":true,\"data\":{\"operation_id\":\"safe\"}}".getBytes(StandardCharsets.UTF_8)
        );
        JSONObject data = HttpsEnrollmentTransport.requireSuccessData(response, "failure");
        assertEquals("safe", data.getString("operation_id"));
    }

    @Test
    public void productionEnrollmentShapePreservesPostgresTimestampsAndEmployeeName() throws Exception {
        JSONObject data = new JSONObject("""
            {
              "operation_id":"c1b452ef-b5f3-4664-aa4c-2ebbb2f9c40b",
              "device_id":"KIOSK_08",
              "flow":"recovery",
              "device_credential":"773f2200-5ee9-4bb0-8c90-314334eb9833.synthetic-recovery-secret-1234567890",
              "credential_id":"773f2200-5ee9-4bb0-8c90-314334eb9833",
              "credential_expires_at":"2036-08-23T13:56:42.682000+00:00",
              "resume_expires_at":"2026-08-26T14:26:42.682000+00:00",
              "device_name":"Karen Robinson",
              "employee":{
                "id":"3da709bb-2223-4e15-8e3a-db02e3f32e97",
                "employee_code":"EMP007",
                "display_name":"Karen Robinson"
              },
              "replayed":false
            }
            """);
        try (EnrollmentResult result = HttpsEnrollmentTransport.parseEnrollmentResult(data)) {
            assertEquals("c1b452ef-b5f3-4664-aa4c-2ebbb2f9c40b", result.operationId);
            assertEquals("KIOSK_08", result.deviceId);
            assertEquals("recovery", result.flow);
            assertEquals("2026-08-26T14:26:42.682Z", result.metadata.resumeExpiresAt);
            assertEquals("2036-08-23T13:56:42.682Z", result.metadata.credentialExpiresAt);
            assertEquals("Karen Robinson", result.metadata.employeeName);
        }
    }

    @Test
    public void activeCredentialStatusAcceptsOnlyExactAuthenticatedIdentity() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":true,
              "enrollment_required":false,
              "recovery_required":false,
              "policy_mode":"enforce",
              "canonical_device_id":"KIOSK_08",
              "credential_id":"80000000-0000-4000-8000-000000000008"
            }}
            """);
        assertEquals(
            ActiveCredentialStatus.ACCEPTED,
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL)
        );
    }

    @Test
    public void activeCredentialStatusRecognizesExactEnrollmentRequiredProof() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":false,
              "enrollment_required":true,
              "recovery_required":false,
              "policy_mode":"enforce",
              "canonical_device_id":"KIOSK_08",
              "credential_id":null
            }}
            """);
        assertEquals(
            ActiveCredentialStatus.ENROLLMENT_REQUIRED,
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL)
        );
    }

    @Test
    public void activeCredentialStatusAcceptsExplicitRecoveryDuringObserveRollout() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":false,
              "enrollment_required":true,
              "recovery_required":true,
              "policy_mode":"observe",
              "canonical_device_id":"KIOSK_08",
              "credential_id":null
            }}
            """);
        assertEquals(
            ActiveCredentialStatus.ENROLLMENT_REQUIRED,
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL)
        );
    }

    @Test
    public void activeCredentialStatusRefusesAmbiguousOrMismatchedResponses() throws Exception {
        for (String body : List.of(
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":true,\"recovery_required\":false,\"policy_mode\":\"observe\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":true,\"recovery_required\":true,\"policy_mode\":\"unknown\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":true,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":\"80000000-0000-4000-8000-000000000008\"}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_09\",\"credential_id\":\"80000000-0000-4000-8000-000000000008\"}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":\"90000000-0000-4000-8000-000000000009\"}}"
        )) {
            try {
                HttpsEnrollmentTransport.classifyActiveCredentialStatus(statusResponse(200, body), DEVICE, CREDENTIAL);
                fail("Expected exact active-credential proof refusal");
            } catch (VaultFailure error) {
                assertEquals("custodial_native_credential_revalidation_refused", error.code);
            }
        }
    }

    @Test
    public void activeCredentialStatusPreservesUnavailableServerClass() throws Exception {
        try {
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(
                statusResponse(503, "{\"ok\":false,\"code\":\"device_auth_unavailable\"}"),
                DEVICE,
                CREDENTIAL
            );
            fail("Expected server-unavailable refusal");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_credential_revalidation_failed", error.code);
            assertEquals(503, error.httpStatus);
            assertEquals("device_auth_unavailable", error.remoteReason);
        }
    }

    @Test
    public void canonicalOperationReceiptPreservesExactBytesAndHeaders() throws Exception {
        byte[] body = ("{\"operation_id\":\"11111111-1111-4111-8111-111111111111\","
            + "\"expected_payload_sha256\":\"" + "a".repeat(64) + "\","
            + "\"canonical_server_digest\":\"" + "b".repeat(64) + "\","
            + "\"server_effect_id\":\"session:11111111-1111-4111-8111-111111111111\","
            + "\"accepted_at_epoch_ms\":1800000000000,\"replayed\":false}").getBytes(StandardCharsets.UTF_8);
        byte[] safe = HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
            "/scan-api/native-v1/operations/11111111-1111-4111-8111-111111111111",
            201,
            body,
            "application/json",
            "credential-secret".toCharArray()
        );
        assertArrayEquals(body, safe);
        Map<String, String> headers = HttpsEnrollmentTransport.safeResponseHeaders(Map.of(
            "X-Custodial-Operation-Id", List.of("11111111-1111-4111-8111-111111111111"),
            "X-Custodial-Conflict-Code", List.of("IDENTITY_MISMATCH"),
            "Set-Cookie", List.of("secret")
        ));
        assertTrue(headers.containsKey("x-custodial-operation-id"));
        assertTrue(headers.containsKey("x-custodial-conflict-code"));
        assertFalse(headers.containsKey("set-cookie"));
    }

    @Test
    public void canonicalOperationReceiptRejectsUnexpectedOrSecretContent() throws Exception {
        String base = "{\"operation_id\":\"11111111-1111-4111-8111-111111111111\","
            + "\"expected_payload_sha256\":\"" + "a".repeat(64) + "\","
            + "\"canonical_server_digest\":\"" + "b".repeat(64) + "\","
            + "\"server_effect_id\":\"effect\",\"accepted_at_epoch_ms\":1800000000000,"
            + "\"replayed\":false,\"extra\":true}";
        try {
            HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
                "/scan-api/native-v1/operations/11111111-1111-4111-8111-111111111111",
                200,base.getBytes(StandardCharsets.UTF_8),"application/json",null
            );
            fail("Expected exact receipt shape refusal");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_invalid_response", error.code);
        }
        String secret = base.replace("\"extra\":true", "\"extra\":\"credential-secret\"");
        try {
            HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
                "/scan-api/native-v1/operations/11111111-1111-4111-8111-111111111111",
                200,secret.getBytes(StandardCharsets.UTF_8),"application/json","credential-secret".toCharArray()
            );
            fail("Expected credential echo refusal");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_secret_response_refused", error.code);
        }
    }

    @Test
    public void authorizedNetworkFailureDistinguishesPreflightFromUnknownDelivery() {
        assertEquals(
            "custodial_native_request_not_sent",
            HttpsEnrollmentTransport.authorizedNetworkFailure(false, new IOException("before send")).code
        );
        assertEquals(
            "custodial_native_request_not_sent",
            HttpsEnrollmentTransport.authorizedNetworkFailure(true, new UnknownHostException("dns")).code
        );
        assertEquals(
            "custodial_native_delivery_unknown",
            HttpsEnrollmentTransport.authorizedNetworkFailure(true, new SocketTimeoutException("after send")).code
        );
    }

    private static HttpsEnrollmentTransport.HttpResult statusResponse(int status, String body) {
        return new HttpsEnrollmentTransport.HttpResult(
            status,
            Map.of("content-type", List.of("application/json")),
            body.getBytes(StandardCharsets.UTF_8)
        );
    }
}
