package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual emitted SQL pages and native parser. Synthetic principal/time only;
 * not production transport, qualified effect time, admission or display. */
public final class NativeProviderInventorySqlWireTest {
    private static NativeProviderInventory.Request request(NativeProviderPrincipal principal, JSONObject body, long pages) throws Exception {
        JSONObject scan = new JSONObject().put("captured_epoch", 0).put("pages", pages);
        for (String key : new String[]{"scan_id", "generation_ids", "cursor", "ceiling", "server_now"}) scan.put(key, body.get(key));
        return new NativeProviderInventory.Request(principal, 0, "synthetic-sql-recovery", scan);
    }
    private static AuthorizedResponse response(JSONObject body, int status) throws Exception {
        return new AuthorizedResponse(status, Map.of("content-type", "application/json; charset=utf-8"), body.toString().getBytes(StandardCharsets.UTF_8));
    }
    @Test public void actualSqlFrozenPagesAndRestartBindFullNativePrincipalWithoutRelabelling() throws Exception {
        String path = System.getenv("NATIVE_LOCATION_INVENTORY_FIXTURE");
        assertNotNull("Actual emitted SQL fixture required; never count skipped fixture as PASS", path);
        JSONObject fixture = new JSONObject(new String(Files.readAllBytes(Path.of(path)), StandardCharsets.UTF_8));
        NativeProviderPrincipal principal = NativeProviderPrincipal.fromNativeJournal(fixture.getJSONObject("nativePrincipal"));
        NativeProviderInventory.Request first = request(principal, fixture.getJSONObject("request"), 0);
        assertTrue(ProviderWireJson.same(new JSONObject(new String(first.body(), StandardCharsets.UTF_8)), fixture.getJSONObject("request")));
        NativeProviderInventory.Page page1 = NativeProviderInventory.validateResponse(first, response(fixture.getJSONObject("page1"), 200));
        assertEquals(32, page1.rows.size()); assertTrue(page1.hasMore);
        for (NativeProviderPayload row : page1.rows) { row.requirePrincipal(principal); assertEquals("custodial.native-location-payload.v2", row.get("schema")); }
        NativeProviderInventory.Request next = request(principal, fixture.getJSONObject("continuation"), 1);
        NativeProviderInventory.Page page2 = NativeProviderInventory.validateResponse(next, response(fixture.getJSONObject("page2"), 200));
        assertEquals(2, page2.rows.size()); assertFalse(page2.hasMore);
        assertTrue(ProviderWireJson.same(page1.data().get("ceiling"), page2.data().get("ceiling")));
        for (int i = 0; i < fixture.getJSONArray("restarts").length(); i++) {
            JSONObject restart = fixture.getJSONArray("restarts").getJSONObject(i);
            NativeProviderInventory.Request rejected = request(principal, restart.getJSONObject("request"), 1);
            NativeProviderInventory.validateCursorRejection(rejected, response(restart.getJSONObject("response"), 409)).requireRequest(rejected);
        }
        for (String fault : new String[]{"generation", "principal", "content", "ceiling"}) {
            JSONObject changed = new JSONObject(fixture.getJSONObject("page1").toString()), data = changed.getJSONObject("data");
            if (fault.equals("generation")) data.getJSONArray("generation_ids").put(0, "99000000-0000-4000-8000-000000000001");
            if (fault.equals("principal")) data.put("principal_digest", "b".repeat(64));
            if (fault.equals("content")) data.getJSONArray("rows").getJSONObject(0).getJSONObject("payload").put("body", "changed");
            if (fault.equals("ceiling")) data.put("ceiling", JSONObject.NULL);
            try { NativeProviderInventory.validateResponse(first, response(changed, 200)); fail(fault); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
        }
    }
}
