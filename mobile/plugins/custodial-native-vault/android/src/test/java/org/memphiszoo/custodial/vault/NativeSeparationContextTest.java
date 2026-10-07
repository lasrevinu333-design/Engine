package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeSeparationContextTest {
    static String id(int n) { return "95000000-0000-4000-8000-" + String.format("%012d", n); }
    static JSONObject principal() throws Exception {
        return new JSONObject().put("schema_version", "custodial-protected-principal.v1")
            .put("device_id", "KIOSK_08").put("employee_id", id(2)).put("credential_id", id(3)).put("assignment_epoch", 7)
            .put("credential_operation_id", id(4)).put("installation_seal", "original-seal-00000001")
            .put("enrolled_at", "2026-07-31T21:52:04.123456Z");
    }
    static JSONObject data() throws Exception {
        return new JSONObject().put("schema", "custodial.separation-context.v1").put("separation_id", id(5))
            .put("authority_revision", 42).put("device_id", id(1)).put("canonical_device_id", "KIOSK_08")
            .put("employee_id", id(2)).put("credential_id", id(3)).put("assignment_epoch", 7)
            .put("cutoff_at", "2026-09-27T08:00:00.123456Z").put("state", "PENDING_RECONCILIATION")
            .put("native_inventory_state", "UNKNOWN").put("new_work_allowed", false).put("phone_released", false)
            .put("purpose", "SEPARATION_STATUS_ONLY").put("server_known_open_sessions", new JSONArray().put(new JSONObject()
                .put("session_id", id(6)).put("session_uuid", "legacy-session-1").put("client_session_id", JSONObject.NULL)
                .put("started_at", "2026-09-27T07:50:00.123456+00:00").put("status_at_separation", "active")));
    }
    static AuthorizedResponse response(String body) throws VaultFailure { return new AuthorizedResponse(200, Map.of(), body.getBytes(StandardCharsets.UTF_8)); }
    static AuthorizedRequest request() { return new AuthorizedRequest(NativeSeparationContext.PATH, "GET", Map.of(), new byte[0]); }
    static String envelope(JSONObject data) throws Exception { return new JSONObject().put("ok", true).put("data", data).toString(); }
    static NativeSeparationContext read(JSONObject data) throws Exception {
        return NativeSeparationContext.fromAuthenticatedResponse(request(), response(envelope(data)), NativeProviderPrincipal.fromNativeJournal(principal()));
    }
    interface Checked { void run() throws Exception; }
    static void denied(Checked work) throws Exception {
        try { work.run(); fail("invalid separation context accepted"); }
        catch (VaultFailure expected) { assertEquals(NativeSeparationContext.FAILURE, expected.code); }
    }
    @Test public void exactOriginalContextAndMicrosecondsAreRetained() throws Exception {
        var value = read(data()); assertEquals(id(5), value.separationId); assertEquals(42L, value.authorityRevision);
        assertEquals(Instant.parse("2026-09-27T08:00:00.123456Z"), value.cutoff);
        assertEquals(123456000, value.cutoff.getNano()); assertTrue(ProviderWireJson.same(data(), value.json()));
        assertEquals("UNKNOWN", value.json().getString("native_inventory_state"));
        assertFalse(value.json().getBoolean("new_work_allowed")); assertFalse(value.json().getBoolean("phone_released"));
    }
    @Test public void callerMutationCannotRebindCapturedEvidence() throws Exception {
        var value = read(data()); value.json().put("employee_id", id(99)); value.originalPrincipal().put("assignment_epoch", 8);
        assertEquals(id(2), value.json().getString("employee_id")); assertEquals(7, value.originalPrincipal().getLong("assignment_epoch"));
        assertTrue(value.matchesPrincipal(NativeProviderPrincipal.fromNativeJournal(principal())));
        for (String field : new String[]{"installation_seal", "enrolled_at", "credential_operation_id", "credential_id", "employee_id", "assignment_epoch"}) {
            JSONObject changed = principal().put(field, field.equals("assignment_epoch") ? 8 : field.equals("enrolled_at") ? "2026-08-01T00:00:00Z" : field.equals("installation_seal") ? "replacement-seal-00000001" : id(99));
            assertFalse(value.matchesPrincipal(NativeProviderPrincipal.fromNativeJournal(changed)));
        }
    }
    @Test public void exactRouteMethodAndSuccessOnly() throws Exception {
        for (String path : new String[]{"/device-auth/status", NativeSeparationContext.PATH + "?device_id=KIOSK_08", NativeSeparationContext.PATH + "/"})
            denied(() -> NativeSeparationContext.fromAuthenticatedResponse(new AuthorizedRequest(path,"GET",Map.of(),new byte[0]), response(envelope(data())), NativeProviderPrincipal.fromNativeJournal(principal())));
        for (String method : new String[]{"POST", "HEAD", "get"}) denied(() -> NativeSeparationContext.fromAuthenticatedResponse(new AuthorizedRequest(NativeSeparationContext.PATH,method,Map.of(),new byte[0]), response(envelope(data())), NativeProviderPrincipal.fromNativeJournal(principal())));
        for (int status : new int[]{201,204,401,403,503}) denied(() -> NativeSeparationContext.fromAuthenticatedResponse(request(), new AuthorizedResponse(status,Map.of(),envelope(data()).getBytes(StandardCharsets.UTF_8)), NativeProviderPrincipal.fromNativeJournal(principal())));
        denied(() -> NativeSeparationContext.fromAuthenticatedResponse(new AuthorizedRequest(NativeSeparationContext.PATH,"GET",Map.of(),new byte[]{1}),response(envelope(data())),NativeProviderPrincipal.fromNativeJournal(principal())));
    }
    @Test public void wrongPrincipalAndAuthorityCannotBeCaptured() throws Exception {
        for (String field : new String[]{"employee_id", "credential_id"}) denied(() -> read(data().put(field,id(99))));
        denied(() -> read(data().put("canonical_device_id", "KIOSK_09")));
        for (Object epoch : new Object[]{8,0,-1,"7",JSONObject.NULL,true}) denied(() -> read(data().put("assignment_epoch",epoch)));
        for (Object revision : new Object[]{0,-1,"42",9007199254740992L,JSONObject.NULL}) denied(() -> read(data().put("authority_revision",revision)));
        for (String field : new String[]{"new_work_allowed", "phone_released"}) for (Object value : new Object[]{true,"false",0,JSONObject.NULL}) denied(() -> read(data().put(field,value)));
        denied(() -> read(data().put("purpose", "NEW_WORK"))); denied(() -> read(data().put("state", "RECONCILED")));
        denied(() -> read(data().put("native_inventory_state", "ASSUMED_EMPTY"))); denied(() -> read(data().put("schema", "v0")));
    }
    @Test public void ambiguousWireAndUnknownFieldsAreRejected() throws Exception {
        String valid = envelope(data());
        for (String body : new String[]{valid.replace("\"assignment_epoch\":7", "\"assignment_epoch\":7.0"), valid.replace("\"assignment_epoch\":7", "\"assignment_epoch\":7e0"),
            valid.replace("\"ok\":true", "\"ok\":true,\"ok\":true"), valid+" trailing", "{'ok':true,'data':{}}"})
            denied(() -> NativeSeparationContext.fromAuthenticatedResponse(request(),response(body),NativeProviderPrincipal.fromNativeJournal(principal())));
        denied(() -> read(data().put("unexpected",true)));
        JSONObject missing=data();missing.remove("phone_released");denied(() -> read(missing));
    }
    @Test public void timestampRemainsExactNotASecondsOrMillisBoundary() throws Exception {
        for (String time : new String[]{"2026-09-27T08:00:00Z","2026-09-27T08:00:00.123Z","2026-09-27T08:00:00.123456+00:00",
            "2026-02-30T08:00:00.123456Z","2026-09-27T08:00:60.123456Z"}) denied(() -> read(data().put("cutoff_at",time)));
        assertFalse(read(data()).same(read(data().put("cutoff_at","2026-09-27T08:00:00.123457Z"))));
    }
    @Test public void databaseInventoryNeverBecomesNativeAcceptance() throws Exception {
        for (String state : new String[]{"UNKNOWN","VERIFIED_EMPTY","PROTECTED_PENDING","RECONCILED"}) {
            var value=read(data().put("native_inventory_state",state)); assertFalse(value.json().getBoolean("phone_released"));
            assertEquals(1,value.json().getJSONArray("server_known_open_sessions").length());
        }
        JSONObject duplicate=data();JSONArray sessions=duplicate.getJSONArray("server_known_open_sessions");sessions.put(sessions.getJSONObject(0));denied(() -> read(duplicate));
        JSONObject closed=data();closed.getJSONArray("server_known_open_sessions").getJSONObject(0).put("status_at_separation","closed");denied(() -> read(closed));
    }
}
