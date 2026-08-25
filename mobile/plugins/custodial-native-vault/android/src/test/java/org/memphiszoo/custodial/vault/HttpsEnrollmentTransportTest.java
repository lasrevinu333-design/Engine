package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

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
    public void activeCredentialStatusAcceptsOnlyExactAuthenticatedIdentity() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":true,
              "enrollment_required":false,
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
    public void activeCredentialStatusRefusesAmbiguousOrMismatchedResponses() throws Exception {
        for (String body : List.of(
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":true,\"policy_mode\":\"observe\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_09\",\"credential_id\":\"80000000-0000-4000-8000-000000000008\"}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":\"90000000-0000-4000-8000-000000000009\"}}"
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

    private static HttpsEnrollmentTransport.HttpResult statusResponse(int status, String body) {
        return new HttpsEnrollmentTransport.HttpResult(
            status,
            Map.of("content-type", List.of("application/json")),
            body.getBytes(StandardCharsets.UTF_8)
        );
    }
}
