package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.Test;

public final class RequestPolicyTest {
    private static final String DEVICE = "KIOSK_02";

    @Test
    public void acceptsOnlyCanonicalAllowlistedPaths() throws Exception {
        AuthorizedRequest status = RequestPolicy.validate(request(
            "/device-auth/status?device_id=KIOSK_02",
            "GET",
            Map.of(),
            new byte[0]
        ), DEVICE);
        assertEquals("/device-auth/status?device_id=KIOSK_02", status.path);

        for (String path : new String[] {
            "/employee-notifications-api/register",
            "/messaging-api/device-notifications/ack",
            "/schedule-api/my-day-summary?device_id=KIOSK_02",
            "/scan-api/submit",
            "/feedback-api/submit"
        }) RequestPolicy.validate(request(path, "POST", jsonHeaders(), "{\"device_id\":\"KIOSK_02\"}".getBytes(StandardCharsets.UTF_8)), DEVICE);
    }

    @Test
    public void rejectsEncodedTraversalSeparatorsAndNonCanonicalPaths() throws Exception {
        for (String path : new String[] {
            "https://evil.example/messaging-api/x",
            "//evil.example/messaging-api/x",
            "/messaging-api/%2e%2e/device-auth/status",
            "/messaging-api/%2Fdevice-auth/status",
            "/messaging-api/%5cdevice-auth/status",
            "/messaging-api//messages",
            "/messaging-api/../device-auth/status",
            "/messaging-api/./messages",
            "/messaging-api/messages#fragment",
            "/unknown-api/path"
        }) expectFailure(() -> RequestPolicy.validate(request(path, "GET", Map.of(), new byte[0]), DEVICE));
    }

    @Test
    public void genericTransportNeverReachesCredentialManagement() throws Exception {
        for (String path : new String[] {
            "/custodial-device-auth/enroll",
            "/custodial-device-auth/recover",
            "/custodial-device-auth/remove",
            "/custodial-device-auth/enrollment-operations/11111111-1111-4111-8111-111111111111/confirm",
            "/device-auth/enroll",
            "/device-auth/logout",
            "/device-auth/rotate"
        }) expectCode("custodial_native_credential_path_refused", () -> RequestPolicy.validate(
            request(path, "POST", jsonHeaders(), "{}".getBytes(StandardCharsets.UTF_8)),
            DEVICE
        ));
    }

    @Test
    public void bodyQueryAndHeaderIdentityMustMatchAuthoritativeDevice() throws Exception {
        expectCode("custodial_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/schedule-api/my-day-summary?device_id=KIOSK_03",
            "GET",
            Map.of(),
            new byte[0]
        ), DEVICE));
        expectCode("custodial_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/messaging-api/send",
            "POST",
            jsonHeaders(),
            "{\"outer\":[{\"assigned_device_id\":\"KIOSK_03\"}]}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        expectCode("custodial_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/messaging-api/send",
            "POST",
            Map.of("Content-Type", "application/json", "X-Device-Id", "KIOSK_03"),
            "{}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        RequestPolicy.validate(request(
            "/messaging-api/send?device_id=KIOSK_02",
            "POST",
            Map.of("Content-Type", "application/json", "X-Device-Id", "KIOSK_02"),
            "{\"device_id\":\"KIOSK_02\"}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE);
    }

    @Test
    public void rejectsUnsupportedBodiesMalformedUtf8AndCallerCredentials() throws Exception {
        expectCode("custodial_native_body_refused", () -> RequestPolicy.validate(request(
            "/scan-api/upload",
            "POST",
            Map.of("Content-Type", "application/octet-stream"),
            new byte[] { 1, 2, 3 }
        ), DEVICE));
        expectCode("custodial_native_body_refused", () -> RequestPolicy.validate(request(
            "/scan-api/upload",
            "POST",
            jsonHeaders(),
            new byte[] { (byte) 0xc3, (byte) 0x28 }
        ), DEVICE));
        expectCode("custodial_native_headers_refused", () -> RequestPolicy.validate(request(
            "/device-auth/status",
            "GET",
            Map.of("Authorization", "Device attacker"),
            new byte[0]
        ), DEVICE));
        for (String header : new String[] {
            "X-Memphis-Native-Attestation-Version",
            "X-Memphis-Native-Request-Id",
            "X-Memphis-Native-Request-Timestamp",
            "X-Memphis-Native-Request-Attestation"
        }) expectCode("custodial_native_headers_refused", () -> RequestPolicy.validate(request(
            "/device-auth/status",
            "GET",
            Map.of(header, "caller-controlled"),
            new byte[0]
        ), DEVICE));
    }

    @Test
    public void rejectsJsonPrefixesWithTrailingObjectsArraysOrGarbage() throws Exception {
        for (String body : new String[] {
            "{\"device_id\":\"KIOSK_02\"}{}",
            "[{}] []",
            "{\"device_id\":\"KIOSK_02\"} trailing"
        }) expectCode("custodial_native_body_refused", () -> RequestPolicy.validate(request(
            "/messaging-api/send",
            "POST",
            jsonHeaders(),
            body.getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
    }

    @Test
    public void webViewInputsAreBoundedBeforeNativeCopiesOrDecode() throws Exception {
        assertEquals("12345678", WebViewInputPolicy.enrollmentCode("12345678"));
        expectCode("custodial_native_invalid_enrollment", () -> WebViewInputPolicy.enrollmentCode("1".repeat(1_000_000)));
        expectCode("custodial_native_body_refused", () -> WebViewInputPolicy.validateBodyBase64("AAAA\nAAAA"));
        expectCode("custodial_native_body_refused", () -> WebViewInputPolicy.validateBodyBase64("A==="));

        String exactMaximum = "A".repeat(WebViewInputPolicy.MAX_ENCODED_BODY_CHARS - 2) + "==";
        WebViewInputPolicy.validateBodyBase64(exactMaximum);
        String oversized = "A".repeat(WebViewInputPolicy.MAX_ENCODED_BODY_CHARS + 4);
        expectCode("custodial_native_request_too_large", () -> WebViewInputPolicy.validateBodyBase64(oversized));

        WebViewInputPolicy.validateHeader("X-Safe", "v".repeat(8192));
        expectCode("custodial_native_headers_refused", () -> WebViewInputPolicy.validateHeader("X-Safe", "v".repeat(8193)));
    }

    private static AuthorizedRequest request(String path, String method, Map<String, String> headers, byte[] body) {
        return new AuthorizedRequest(path, method, headers, body);
    }

    private static Map<String, String> jsonHeaders() {
        return Map.of("Content-Type", "application/json");
    }

    private static void expectFailure(ThrowingAction action) throws Exception {
        try {
            action.run();
            fail("Expected request rejection");
        } catch (VaultFailure expected) {
            // Exact path errors vary between malformed origins and paths.
        }
    }

    private static void expectCode(String code, ThrowingAction action) throws Exception {
        try {
            action.run();
            fail("Expected " + code);
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
        }
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }
}
