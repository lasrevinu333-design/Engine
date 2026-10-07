package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderRequestPolicyTest {
    static AuthorizedRequest request(String path, String method) {
        return new AuthorizedRequest(path, method, Map.of("Content-Type", "application/json"),
            method.equals("GET") || method.equals("HEAD") ? new byte[0] : "{}".getBytes(StandardCharsets.UTF_8));
    }
    @Test public void allCanonicalNativeProviderMethodsAreOutsideGenericBridge() throws Exception {
        for (String operation : new String[]{"", "/register", "/status", "/events", "/inventory", "/unknown"}) {
            for (String method : new String[]{"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}) {
                try { RequestPolicy.validate(request("/employee-notifications-api/native-provider" + operation, method), "KIOSK_08"); fail("Generic native provider route admitted"); }
                catch (VaultFailure refused) { assertEquals("custodial_native_provider_path_refused", refused.code); }
            }
        }
    }
    @Test public void caseSlashEncodingAliasesAndAmbiguousPathsNeverReachGenericSigner() throws Exception {
        for (String route : new String[]{
            "/employee-notifications-api/Native-Provider/register", "/EMPLOYEE-NOTIFICATIONS-API/native-provider/events",
            "/employee-notifications-api/native-provider/register/", "/employee-notifications-api/native-provider/",
            "/employee-notifications-api/native-provider/status?device_id=KIOSK_08", "/employee-notifications-api/native-provider/status#x",
            "/employee-notifications-api/%6eative-provider/register", "/employee-notifications-api/native%2dprovider/register",
            "/employee-notifications-api/native-provider%2fregister", "/employee-notifications-api/native-provider%252fregister",
            "/employee-notifications-api/native-provider//events", "/employee-notifications-api/./native-provider/events",
            "/employee-notifications-api/native-provider/../register", "/employee-notifications-api/native-provider\\register",
            "/employee-notifications-api/native-provider/%ZZ", "/employee-notifications-api/native-provider/%",
        }) {
            try { RequestPolicy.validate(request(route, "POST"), "KIOSK_08"); fail("Native provider alias admitted: " + route); }
            catch (VaultFailure refused) { assertTrue(refused.code.startsWith("custodial_native_")); }
        }
    }
    @Test public void existingNonprotectedPathsRetainTheirOriginalPolicy() throws Exception {
        for (String route : new String[]{"/employee-notifications-api/register", "/employee-notifications-api/receipt",
            "/messaging-api/device-notifications/ack", "/schedule-api/my-day-summary", "/scan-api/submit", "/feedback-api/submit"})
            assertEquals(route, RequestPolicy.validate(request(route, "POST"), "KIOSK_08").path);
    }
}
