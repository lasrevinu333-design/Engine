package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderRegistrationReceiptTest {
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
