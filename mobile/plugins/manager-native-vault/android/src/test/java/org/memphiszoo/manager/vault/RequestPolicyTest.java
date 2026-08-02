package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.Test;

public final class RequestPolicyTest {
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";

    @Test
    public void acceptsOnlyCanonicalAllowlistedPaths() throws Exception {
        AuthorizedRequest status = RequestPolicy.validate(request(
            "/mobile-auth-api/session",
            "POST",
            Map.of(),
            new byte[0]
        ), DEVICE);
        assertEquals("/mobile-auth-api/session", status.path);

        for (String path : new String[] {
            "/manager-notifications-api/register",
            "/messaging-api/device-notifications/ack",
            "/scan-api/rpc",
            "/feedback-api/submit"
        }) RequestPolicy.validate(request(path, "POST", jsonHeaders(), "{\"device_id\":\"ops-app-11111111-1111-4111-8111-111111111111\"}".getBytes(StandardCharsets.UTF_8)), DEVICE);
        RequestPolicy.validate(request(
            "/schedule-api/my-day-summary?device_id=ops-app-11111111-1111-4111-8111-111111111111",
            "GET",
            Map.of(),
            new byte[0]
        ), DEVICE);
        RequestPolicy.validate(request("/analytics-api/inspection-coverage", "GET", Map.of(), new byte[0]), DEVICE);
        RequestPolicy.validate(request("/admin-api/events", "GET", Map.of(), new byte[0]), DEVICE);
        RequestPolicy.validate(request(
            "/admin-api/events/parse-ai", "POST", jsonHeaders(), "{}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE);
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
            "/messaging-api/messages?next=https://evil.example/",
            "/messaging-api/messages?next=%252fadmin-api/health",
            "/unknown-api/path"
        }) expectFailure(() -> RequestPolicy.validate(request(path, "GET", Map.of(), new byte[0]), DEVICE));
    }

    @Test
    public void genericTransportNeverReachesCredentialManagement() throws Exception {
        for (String path : new String[] {
            "/manager-device-auth/enroll",
            "/manager-device-auth/recover",
            "/manager-device-auth/remove",
            "/manager-device-auth/enrollment-operations/11111111-1111-4111-8111-111111111111/confirm",
            "/device-auth/enroll",
            "/device-auth/logout",
            "/device-auth/rotate"
        }) expectCode("manager_native_credential_path_refused", () -> RequestPolicy.validate(
            request(path, "POST", jsonHeaders(), "{}".getBytes(StandardCharsets.UTF_8)),
            DEVICE
        ));
    }

    @Test
    public void bodyQueryAndHeaderIdentityMustMatchAuthoritativeDevice() throws Exception {
        expectCode("manager_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/messaging-api/threads?device_id=ops-app-22222222-2222-4222-8222-222222222222",
            "GET",
            Map.of(),
            new byte[0]
        ), DEVICE));
        expectCode("manager_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/messaging-api/broadcast",
            "POST",
            jsonHeaders(),
            "{\"outer\":[{\"assigned_device_id\":\"ops-app-22222222-2222-4222-8222-222222222222\"}]}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        expectCode("manager_native_device_binding_mismatch", () -> RequestPolicy.validate(request(
            "/messaging-api/broadcast",
            "POST",
            Map.of("Content-Type", "application/json", "X-Device-Id", "ops-app-22222222-2222-4222-8222-222222222222"),
            "{}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        RequestPolicy.validate(request(
            "/messaging-api/broadcast?device_id=ops-app-11111111-1111-4111-8111-111111111111",
            "POST",
            Map.of("Content-Type", "application/json", "X-Device-Id", "ops-app-11111111-1111-4111-8111-111111111111"),
            "{\"device_id\":\"ops-app-11111111-1111-4111-8111-111111111111\"}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE);
    }

    @Test
    public void rejectsUnsupportedBodiesMalformedUtf8AndCallerCredentials() throws Exception {
        expectCode("manager_native_body_refused", () -> RequestPolicy.validate(request(
            "/scan-api/rpc",
            "POST",
            Map.of("Content-Type", "application/octet-stream"),
            new byte[] { 1, 2, 3 }
        ), DEVICE));
        expectCode("manager_native_body_refused", () -> RequestPolicy.validate(request(
            "/scan-api/rpc",
            "POST",
            jsonHeaders(),
            new byte[] { (byte) 0xc3, (byte) 0x28 }
        ), DEVICE));
        expectCode("manager_native_headers_refused", () -> RequestPolicy.validate(request(
            "/mobile-auth-api/session",
            "POST",
            Map.of("Authorization", "Device attacker"),
            new byte[0]
        ), DEVICE));
        for (String name : new String[] { "Cookie", "X-Device-Security-CSRF", "X-CSRF-Token", "Origin" }) {
            expectCode("manager_native_headers_refused", () -> RequestPolicy.validate(request(
                "/admin-api/device-security/session",
                "GET",
                Map.of(name, "attacker"),
                new byte[0]
            ), DEVICE));
        }
        expectCode("manager_native_body_refused", () -> RequestPolicy.validate(request(
            "/scan-api/rpc",
            "POST",
            jsonHeaders(),
            "{\"authorization\":\"Bearer attacker\"}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        expectCode("manager_native_query_refused", () -> RequestPolicy.validate(request(
            "/analytics-api/inspections?access_token=attacker",
            "GET",
            Map.of(),
            new byte[0]
        ), DEVICE));
    }

    @Test
    public void rejectsMethodConfusionForRegisteredRoutes() throws Exception {
        expectCode("manager_native_path_refused", () -> RequestPolicy.validate(request(
            "/auth-api/ops/trusted-devices/revoke-all", "GET", Map.of(), new byte[0]
        ), DEVICE));
        expectCode("manager_native_path_refused", () -> RequestPolicy.validate(request(
            "/manager-notifications-api/register", "PATCH", jsonHeaders(), "{}".getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
        expectCode("manager_native_path_refused", () -> RequestPolicy.validate(request(
            "/schedule-api/audit", "DELETE", Map.of(), new byte[0]
        ), DEVICE));
        expectCode("manager_native_path_refused", () -> RequestPolicy.validate(request(
            "/admin-api/bundle", "GET", Map.of(), new byte[0]
        ), DEVICE));
        expectCode("manager_native_path_refused", () -> RequestPolicy.validate(request(
            "/operational-insights-api/arbitrary/nested/path", "GET", Map.of(), new byte[0]
        ), DEVICE));
    }

    @Test
    public void rejectsJsonPrefixesWithTrailingObjectsArraysOrGarbage() throws Exception {
        for (String body : new String[] {
            "{\"device_id\":\"ops-app-11111111-1111-4111-8111-111111111111\"}{}",
            "[{}] []",
            "{\"device_id\":\"ops-app-11111111-1111-4111-8111-111111111111\"} trailing"
        }) expectCode("manager_native_body_refused", () -> RequestPolicy.validate(request(
            "/messaging-api/broadcast",
            "POST",
            jsonHeaders(),
            body.getBytes(StandardCharsets.UTF_8)
        ), DEVICE));
    }

    @Test
    public void webViewInputsAreBoundedBeforeNativeCopiesOrDecode() throws Exception {
        assertEquals("12345678", WebViewInputPolicy.enrollmentCode("12345678"));
        expectCode("manager_native_invalid_enrollment", () -> WebViewInputPolicy.enrollmentCode("1".repeat(1_000_000)));
        expectCode("manager_native_body_refused", () -> WebViewInputPolicy.validateBodyBase64("AAAA\nAAAA"));
        expectCode("manager_native_body_refused", () -> WebViewInputPolicy.validateBodyBase64("A==="));

        String exactMaximum = "A".repeat(WebViewInputPolicy.MAX_ENCODED_BODY_CHARS - 2) + "==";
        WebViewInputPolicy.validateBodyBase64(exactMaximum);
        String oversized = "A".repeat(WebViewInputPolicy.MAX_ENCODED_BODY_CHARS + 4);
        expectCode("manager_native_request_too_large", () -> WebViewInputPolicy.validateBodyBase64(oversized));

        WebViewInputPolicy.validateHeader("X-Safe", "v".repeat(8192));
        expectCode("manager_native_headers_refused", () -> WebViewInputPolicy.validateHeader("X-Safe", "v".repeat(8193)));
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
