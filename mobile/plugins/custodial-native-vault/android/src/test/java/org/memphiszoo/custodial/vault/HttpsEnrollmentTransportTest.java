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
}
