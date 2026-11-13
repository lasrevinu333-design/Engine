package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeSeparationContextTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !args[0].equals("--immutable-copy-only")) throw new IllegalArgumentException("new_copy_cases_only");
        for (String name : new String[]{"COPY_scalarTypesNullsOrderAndManifestBytesRemainExact",
            "COPY_inputAndReturnedGraphsCannotChangeOriginal", "COPY_largeBoundedSessionsRemainExactAcrossCopies"}) {
            var result = new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSeparationContextTest.class, name));
            if (!result.wasSuccessful()) { for (var failure : result.getFailures()) System.err.println(failure.getTrace()); throw new AssertionError(name); }
            System.out.println("PASS_SOURCE_COPY " + name);
        }
    }
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
    private static JSONObject copyData() throws Exception {
        JSONObject input = data().put("authority_revision", 4294967300L).put("assignment_epoch", 7L);
        JSONObject first = input.getJSONArray("server_known_open_sessions").getJSONObject(0);
        first.put("session_uuid", "legacy \"quoted\" \\ path / Español 🐘").put("started_at", JSONObject.NULL);
        input.getJSONArray("server_known_open_sessions").put(new JSONObject().put("session_id", id(7))
            .put("session_uuid", JSONObject.NULL).put("client_session_id", "legacy-original-second")
            .put("started_at", JSONObject.NULL).put("status_at_separation", "pending_submit"));
        return input;
    }
    private static void exactGraph(JSONObject expected, JSONObject actual) throws Exception {
        assertEquals(expected.toString(), actual.toString());
        assertEquals(expected.keySet(), actual.keySet());
        for (String field : expected.keySet()) {
            if (field.equals("server_known_open_sessions")) {
                JSONArray a=expected.getJSONArray(field), b=actual.getJSONArray(field);assertNotSame(a,b);assertEquals(a.length(),b.length());
                for (int i=0;i<a.length();i++) {
                    JSONObject x=a.getJSONObject(i), y=b.getJSONObject(i);assertNotSame(x,y);assertEquals(x.keySet(),y.keySet());
                    for (String name:x.keySet()) { assertEquals(x.get(name).getClass(),y.get(name).getClass());assertEquals(x.get(name),y.get(name)); }
                }
            } else { assertEquals(expected.get(field).getClass(),actual.get(field).getClass());assertEquals(expected.get(field),actual.get(field)); }
        }
    }
    @Test public void COPY_scalarTypesNullsOrderAndManifestBytesRemainExact() throws Exception {
        JSONObject input=copyData(), previous=new JSONObject(input.toString());
        var original=NativeSeparationContext.validateRetainedData(input,NativeProviderPrincipal.fromNativeJournal(principal()));
        exactGraph(previous,original.json());exactGraph(previous,original.json());
        assertEquals(Instant.parse("2026-09-27T08:00:00.123456Z"),original.cutoff);
        var snapshot=NativeProtectedWorkSnapshot.capture(Map.of("original_opaque_work","preserved", "original_counter",3L));
        JSONObject manifest=snapshot.manifest(original);
        String oldBytes=snapshot.manifest(original).put("separation_context",new JSONObject(input.toString())).toString();
        assertEquals(oldBytes,manifest.toString());assertEquals(NativeProviderPrincipal.hash(oldBytes),NativeProviderPrincipal.hash(manifest.toString()));
        assertFalse(manifest.getBoolean("new_work_allowed"));assertFalse(manifest.getBoolean("phone_released"));
    }
    @Test public void COPY_inputAndReturnedGraphsCannotChangeOriginal() throws Exception {
        JSONObject input=copyData(), previous=new JSONObject(input.toString());
        var principal=NativeProviderPrincipal.fromNativeJournal(principal());
        var original=NativeSeparationContext.validateRetainedData(input,principal);
        var same=NativeSeparationContext.validateRetainedData(new JSONObject(previous.toString()),principal);
        input.put("employee_id",id(99)).put("authority_revision",1);
        input.getJSONArray("server_known_open_sessions").getJSONObject(0).put("session_id",id(99));
        input.getJSONArray("server_known_open_sessions").put(new JSONObject().put("foreign",true));
        JSONObject returned=original.json();returned.remove("credential_id");returned.put("cutoff_at","foreign");
        returned.getJSONArray("server_known_open_sessions").getJSONObject(1).put("started_at","replacement");
        returned.getJSONArray("server_known_open_sessions").remove(0);
        original.originalPrincipal().put("employee_id",id(99));
        exactGraph(previous,original.json());assertTrue(original.same(same));assertTrue(original.matchesPrincipal(principal));
        assertEquals(id(2),original.originalPrincipal().getString("employee_id"));
    }
    @Test public void COPY_largeBoundedSessionsRemainExactAcrossCopies() throws Exception {
        JSONObject input=data();JSONArray sessions=new JSONArray();
        for(int i=0;i<384;i++)sessions.put(new JSONObject().put("session_id",id(1000+i))
            .put("session_uuid",i%2==0?JSONObject.NULL:"legacy-"+i)
            .put("client_session_id",i%3==0?JSONObject.NULL:"client-"+i)
            .put("started_at",i%5==0?JSONObject.NULL:"legacy-original-time-"+i)
            .put("status_at_separation",i%2==0?"active":"pending_submit"));
        input.put("server_known_open_sessions",sessions);
        byte[] wire=envelope(input).getBytes(StandardCharsets.UTF_8);assertTrue(wire.length<=131072);
        String previous=new JSONObject(input.toString()).toString();var original=read(input);
        long started=System.nanoTime();long copiedRows=0;
        for(int copy=0;copy<40;copy++){
            JSONObject detached=original.json();assertEquals(previous,detached.toString());copiedRows+=detached.getJSONArray("server_known_open_sessions").length();
            detached.getJSONArray("server_known_open_sessions").getJSONObject(0).put("client_session_id","foreign-copy");
        }
        long elapsed=System.nanoTime()-started;
        System.out.println("COPY_RESOURCE_SAMPLE copies=40 rows="+copiedRows+" wireBytes="+wire.length+" elapsedNanos="+elapsed);
        assertEquals(384,original.json().getJSONArray("server_known_open_sessions").length());
        assertEquals(JSONObject.NULL,original.json().getJSONArray("server_known_open_sessions").getJSONObject(0).get("client_session_id"));
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
