package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderRegistrationReceiptTest {
    public static void main(String[] args) throws Exception {
        if(args.length!=1||!args[0].equals("--stored-admission-only"))throw new IllegalArgumentException("new_stored_admission_cases_only");
        for(String name:new String[]{"STORED_validationDoesNotSerializeOrMintReceipt", "STORED_stateAndLiveReceiptSemanticsStayDistinct",
            "STORED_originalBindingTypesAndTimesRemainRequired"}) {
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProviderRegistrationReceiptTest.class,name));
            if(!result.wasSuccessful()){for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);}
            System.out.println("PASS_STORED_ADMISSION_SOURCE "+name);
        }
    }
    static final String TIME = "2026-09-24T12:00:00.123456Z", LATER = "2026-09-24T12:00:01.654321Z";
    static JSONObject data(NativeProviderJournal.Prepared prepared, String prior, String time) throws Exception {
        JSONObject p = prepared.json(), principal = p.getJSONObject("principal");
        return new JSONObject().put("schema", NativeProviderRegistrationReceipt.SCHEMA)
            .put("operation_id", prepared.operationId).put("generation_id", prepared.generationId)
            .put("registration_id", "88000000-0000-4000-8000-000000000001").put("principal_digest", prepared.principalDigest)
            .put("token_digest", prepared.tokenDigest).put("device_id", principal.get("device_id")).put("credential_id", principal.get("credential_id"))
            .put("employee_id", principal.get("employee_id")).put("assignment_epoch", principal.get("assignment_epoch"))
            .put("native_app", p.get("native_app")).put("activated_at", time).put("prior_generation_id", prior == null ? JSONObject.NULL : prior)
            .put("prior_dispatch_retired_at", prior == null ? JSONObject.NULL : time).put("server_now", time).put("admitted_state", "ACTIVE").put("replayed", false);
    }
    static AuthorizedResponse response(JSONObject data) throws Exception {
        return raw(200, "application/json; charset=utf-8", new JSONObject().put("ok", true).put("data", data).toString());
    }
    static AuthorizedResponse raw(int status, String type, String body) throws VaultFailure { return new AuthorizedResponse(status, Map.of("content-type", type), body.getBytes(StandardCharsets.UTF_8)); }
    private static JSONObject storedGeneration(String state, boolean rotated) throws Exception {
        JSONObject principal=new JSONObject().put("schema_version","custodial-protected-principal.v1").put("device_id","KIOSK_08")
            .put("employee_id","95000000-0000-4000-8000-000000000002").put("credential_id","95000000-0000-4000-8000-000000000003")
            .put("assignment_epoch",7).put("credential_operation_id","95000000-0000-4000-8000-000000000004")
            .put("installation_seal","original-seal-00000001").put("enrolled_at","2026-07-31T21:52:04.123456Z");
        JSONObject app=new JSONObject().put("package_name","org.memphiszoo.custodial").put("version_name","synthetic-source-test")
            .put("version_code",53).put("build_id","synthetic-stored-admission");
        JSONObject generation=new JSONObject().put("schema","custodial.native-provider-journal.v1").put("state",state).put("generation_id","88000000-0000-4000-8000-000000000002")
            .put("operation_id","88000000-0000-4000-8000-000000000003")
            .put("principal",principal).put("principal_digest",NativeProviderPrincipal.fromNativeJournal(principal).digest)
            .put("token_digest","a".repeat(64)).put("capture_sequence",1).put("prepared_epoch",1).put("native_app",app)
            .put("registration_id","88000000-0000-4000-8000-000000000001").put("activated_at",TIME);
        JSONObject admission=new JSONObject().put("schema",NativeProviderRegistrationReceipt.SCHEMA)
            .put("operation_id",generation.get("operation_id")).put("generation_id",generation.get("generation_id"))
            .put("registration_id",generation.get("registration_id")).put("principal_digest",generation.get("principal_digest"))
            .put("token_digest",generation.get("token_digest")).put("device_id",principal.get("device_id"))
            .put("credential_id",principal.get("credential_id")).put("employee_id",principal.get("employee_id"))
            .put("assignment_epoch",principal.get("assignment_epoch")).put("native_app",app).put("activated_at",TIME)
            .put("prior_generation_id",rotated?"88000000-0000-4000-8000-000000000004":JSONObject.NULL)
            .put("prior_dispatch_retired_at",rotated?TIME:JSONObject.NULL).put("server_now",LATER).put("admitted_state","ACTIVE").put("replayed",false);
        return generation.put("admission",admission);
    }
    private static final class SerializationObserved extends JSONObject {
        int serializations;
        SerializationObserved(JSONObject value) throws Exception {for(String key:value.keySet())put(key,value.get(key));}
        @Override public String toString(){serializations++;return super.toString();}
    }
    @Test public void STORED_validationDoesNotSerializeOrMintReceipt() throws Exception {
        JSONObject source=storedGeneration("CONFIRMED",false);String before=source.toString();
        var admission=new SerializationObserved(source.getJSONObject("admission"));
        var original=new SerializationObserved(source);original.put("admission",admission);
        NativeProviderRegistrationReceipt.requireStoredAdmission(original);
        assertEquals("stored validation must not serialize the generation",0,original.serializations);
        assertEquals("stored validation must not serialize the admission",0,admission.serializations);
        assertEquals(before,source.toString());
    }
    @Test public void STORED_stateAndLiveReceiptSemanticsStayDistinct() throws Exception {
        for(boolean rotated:new boolean[]{false,true}) {
            JSONObject original=storedGeneration("CONFIRMED",rotated);String bytes=original.toString();
            NativeProviderRegistrationReceipt.requireStoredAdmission(original);
            var expected=new NativeProviderJournal.Prepared(original);
            var receipt=NativeProviderRegistrationReceipt.validateResponse(expected,response(original.getJSONObject("admission")));
            assertEquals(original.get("registration_id"),receipt.registrationId);assertEquals(TIME,receipt.activatedAt);
            assertEquals(rotated?"88000000-0000-4000-8000-000000000004":null,receipt.priorGenerationId);
            receipt.requireExpected(expected);assertEquals(bytes,original.toString());
            original.put("state","DISPATCH_RETIRED_ARRIVAL_DRAINING").put("dispatch_retired_at",LATER);NativeProviderRegistrationReceipt.requireStoredAdmission(original);
            ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid",()->NativeProviderRegistrationReceipt.validateResponse(
                new NativeProviderJournal.Prepared(original),response(original.getJSONObject("admission"))));
        }
        JSONObject prepared=storedGeneration("PREPARED_QUARANTINE",false);
        NativeProviderRegistrationReceipt.validateResponse(new NativeProviderJournal.Prepared(prepared),response(prepared.getJSONObject("admission")));
        ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid",()->NativeProviderRegistrationReceipt.requireStoredAdmission(prepared));
    }
    @Test public void STORED_originalBindingTypesAndTimesRemainRequired() throws Exception {
        for(String field:new String[]{"schema","operation_id","generation_id","registration_id","principal_digest","token_digest","device_id",
            "credential_id","employee_id","assignment_epoch","native_app","activated_at","prior_generation_id","prior_dispatch_retired_at","server_now","admitted_state","replayed","extra"}) {
            JSONObject changed=storedGeneration("CONFIRMED",false);changed.getJSONObject("admission").put(field,"wrong");String before=changed.toString();
            ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid",()->NativeProviderRegistrationReceipt.requireStoredAdmission(changed));
            assertEquals(before,changed.toString());
        }
        for(String defect:new String[]{"registration","activation","capture","epochDecimal","appVersion","appBinding","appField","priorSame","priorMissingTime","serverBefore","normalizedTime","revoked"}) {
            JSONObject changed=storedGeneration("CONFIRMED",true),admission=changed.getJSONObject("admission");
            switch(defect){
                case "registration":changed.put("registration_id","88000000-0000-4000-8000-000000000099");break;
                case "activation":changed.put("activated_at",LATER);break;
                case "capture":changed.remove("capture_sequence");break;
                case "epochDecimal":admission.put("assignment_epoch",7.0);break;
                case "appVersion":admission.getJSONObject("native_app").put("version_code",0);break;
                case "appBinding":admission.put("native_app",new JSONObject(changed.getJSONObject("native_app").toString()).put("version_code",54));break;
                case "appField":admission.getJSONObject("native_app").put("foreign",true);break;
                case "priorSame":admission.put("prior_generation_id",changed.get("generation_id"));break;
                case "priorMissingTime":admission.put("prior_dispatch_retired_at",JSONObject.NULL);break;
                case "serverBefore":admission.put("server_now","2026-09-24T11:59:59.123456Z");break;
                case "normalizedTime":admission.put("activated_at","2026-09-24T12:00:00.123456+00:00");break;
                case "revoked":changed.put("state","REVOKED_OR_FOREIGN");break;
            }
            String before=changed.toString();
            ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid",()->NativeProviderRegistrationReceipt.requireStoredAdmission(changed));
            assertEquals(before,changed.toString());
        }
    }
    static final class Fixture {
        final NativeProviderJournalTest.Fixture f = new NativeProviderJournalTest.Fixture();
        final NativeProviderPrincipal principal;
        final NativeProviderJournal.Prepared prepared;
        Fixture(boolean legacy) throws Exception {
            principal = legacy ? NativeProviderJournalTest.v2() : NativeProviderJournalTest.v1();
            f.journal().captureToken("old-token"); f.journal().observeActivePrincipal(principal);
            prepared = f.journal().prepareRegistration(principal, NativeProviderJournalTest.app());
        }
        NativeProviderRegistrationReceipt receipt(String prior, String time) throws Exception {
            return NativeProviderRegistrationReceipt.validateResponse(prepared, response(data(prepared, prior, time)));
        }
    }
    @Test public void exactReceiptConfirmsAndSameTokenReturnsSameGenerationAcrossRestart() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture f = new Fixture(legacy); NativeProviderRegistrationReceipt receipt = f.receipt(null, TIME);
            NativeProviderJournal.Prepared accepted = f.f.journal().confirmRegistration(f.principal, f.prepared, receipt);
            assertTrue(accepted.confirmed); assertEquals(TIME, accepted.json().getString("activated_at"));
            int commits = f.f.storage.memory.commits;
            NativeProviderJournal.Prepared same = f.f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
            assertEquals(accepted.generationId, same.generationId); assertTrue(same.confirmed); assertEquals(commits, f.f.storage.memory.commits);
            ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.f.journal().tokenForPrepared(f.principal, f.prepared));
        }
    }
    @Test public void mismatchedBindingUnknownFieldsAndNonActiveStateNeverConfirm() throws Exception {
        Fixture f = new Fixture(false); Map<String, Object> before = new HashMap<>(f.f.storage.memory.raw);
        for (String field : new String[]{"schema", "operation_id", "generation_id", "registration_id", "principal_digest", "token_digest",
            "device_id", "credential_id", "employee_id", "assignment_epoch", "native_app", "activated_at", "prior_generation_id",
            "prior_dispatch_retired_at", "server_now", "admitted_state", "replayed", "extra"}) {
            JSONObject changed = data(f.prepared, null, TIME).put(field, "wrong");
            ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid", () -> NativeProviderRegistrationReceipt.validateResponse(f.prepared, response(changed)));
            assertEquals(before, f.f.storage.memory.raw);
        }
    }
    @Test public void http200EmptyHtmlDuplicatesWrongContentTypesAndDecimalEpochCannotSettle() throws Exception {
        Fixture f = new Fixture(false); String valid = new JSONObject().put("ok", true).put("data", data(f.prepared, null, TIME)).toString();
        for (AuthorizedResponse invalid : new AuthorizedResponse[]{raw(500, "application/json", valid), raw(200, "text/html", valid),
            raw(200, "application/json", ""), raw(200, "application/json", "<html>OK</html>"),
            raw(200, "application/json", valid.replace("\"ok\":true", "\"ok\":false,\"ok\":true")),
            raw(200, "application/json", valid.replace("\"assignment_epoch\":4", "\"assignment_epoch\":4.0")),
            raw(200, "application/json", valid.replace("\"ok\":true", "\"ok\":\"true\""))}) {
            try { NativeProviderRegistrationReceipt.validateResponse(f.prepared, invalid); fail("Malformed transport result admitted"); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
        }
        assertFalse(f.f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
    }
    @Test public void fractionalTimesPreservedAndImpossibleFutureOrNormalizedTimesRejected() throws Exception {
        Fixture f = new Fixture(true); assertEquals(TIME, f.receipt(null, TIME).activatedAt);
        for (String invalid : new String[]{"2026-09-24T12:00:00Z", "2026-09-24T12:00:00.123Z", "2026-09-24T24:00:00.000000Z",
            "2026-09-24T23:59:60.000000Z", "2026-02-30T12:00:00.000000Z", LATER}) {
            JSONObject changed = data(f.prepared, null, TIME).put("activated_at", invalid);
            ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid", () -> NativeProviderRegistrationReceipt.validateResponse(f.prepared, response(changed)));
        }
    }
    @Test public void rotationAtomicallyRetiresOnlyExactKnownPredecessor() throws Exception {
        Fixture f = new Fixture(false); f.f.journal().confirmRegistration(f.principal, f.prepared, f.receipt(null, TIME));
        f.f.journal().captureToken("new-token"); NativeProviderJournal.Prepared next = f.f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
        NativeProviderRegistrationReceipt missing = NativeProviderRegistrationReceipt.validateResponse(next, response(data(next, null, LATER)));
        Map<String, Object> before = new HashMap<>(f.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_generation_chain_mismatch", () -> f.f.journal().confirmRegistration(f.principal, next, missing));
        assertEquals(before, f.f.storage.memory.raw);
        NativeProviderRegistrationReceipt exact = NativeProviderRegistrationReceipt.validateResponse(next, response(data(next, f.prepared.generationId, LATER)));
        int commits = f.f.storage.memory.commits; assertTrue(f.f.journal().confirmRegistration(f.principal, next, exact).confirmed);
        assertEquals(commits + 1, f.f.storage.memory.commits);
        JSONObject old = f.f.read(ProviderEnvelopeCrypto.Domain.GENERATION, f.prepared.generationId);
        assertEquals("DISPATCH_RETIRED_ARRIVAL_DRAINING", old.getString("state")); assertEquals(TIME, old.getString("activated_at"));
        assertEquals(LATER, old.getString("dispatch_retired_at")); assertEquals(f.prepared.principalDigest, old.getString("principal_digest"));
    }
    @Test public void lostConfirmationReadbackReturnsSameCommittedReceiptWithoutSecondWrite() throws Exception {
        Fixture f = new Fixture(false); NativeProviderRegistrationReceipt receipt = f.receipt(null, TIME); f.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.f.journal().confirmRegistration(f.principal, f.prepared, receipt));
        f.f.storage.memory.persistThenReject = false; int commits = f.f.storage.memory.commits;
        NativeProviderRegistrationReceipt replay = NativeProviderRegistrationReceipt.validateResponse(f.prepared,
            response(data(f.prepared, null, TIME).put("replayed", true).put("server_now", LATER)));
        assertTrue(f.f.journal().confirmRegistration(f.principal, f.prepared, replay).confirmed); assertEquals(commits, f.f.storage.memory.commits);
        NativeProviderRegistrationReceipt changedTime = NativeProviderRegistrationReceipt.validateResponse(f.prepared, response(data(f.prepared, null, LATER)));
        ProviderRecordStoreTest.failure("custodial_provider_registration_receipt_invalid", () -> f.f.journal().confirmRegistration(f.principal, f.prepared, changedTime));
    }
    @Test public void principalUnavailableRemovedOrDifferentDuringHttpCannotConfirm() throws Exception {
        for (String transition : new String[]{"unavailable", "removed", "foreign"}) {
            Fixture f = new Fixture(true); NativeProviderRegistrationReceipt receipt = f.receipt(null, TIME);
            if (transition.equals("unavailable")) f.f.journal().observeUnavailable();
            else if (transition.equals("removed")) f.f.journal().observeRemoved();
            else f.f.journal().observeActivePrincipal(NativeProviderPrincipal.fromNativeJournal(f.principal.json().put("assignment_epoch", 8)));
            Map<String, Object> before = new HashMap<>(f.f.storage.memory.raw);
            ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", () -> f.f.journal().confirmRegistration(f.principal, f.prepared, receipt));
            assertEquals(before, f.f.storage.memory.raw);
        }
    }
}
