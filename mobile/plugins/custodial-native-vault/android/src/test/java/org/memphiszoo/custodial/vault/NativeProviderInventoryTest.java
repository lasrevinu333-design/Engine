package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual encrypted journal, strict parser, engine and typed HTTP adapter; synthetic
 * transport/storage/time only. Not SQL authority, Android process or delivery proof. */
public final class NativeProviderInventoryTest {
    static final String NOW = NativeProviderIngressTest.NOW;
    static final String INVALID = "custodial_provider_inventory_invalid", STALE = "custodial_provider_operation_stale";
    static NativeProviderPayload payload(NativeProviderJournal.Prepared prepared, int index) throws Exception {
        Map<String, String> data = new TreeMap<>(NativeProviderPayloadTest.lunch(prepared));
        data.put("receipt_job_id", String.format(java.util.Locale.ROOT, "77000000-0000-4000-8000-%012d", index));
        data.put("notification_key", String.format(java.util.Locale.ROOT, "%064d", index));
        return NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(data));
    }
    static JSONObject tuple(NativeProviderPayload p) throws Exception {
        return new JSONObject().put("reservation_at", p.get("reservation_at")).put("job_id", p.jobId);
    }
    static JSONObject data(NativeProviderInventory.Request request, NativeProviderPayload ceiling, boolean more,
        NativeProviderPayload... payloads) throws Exception {
        JSONObject p = request.principal.json(), scan = request.scan(); JSONArray rows = new JSONArray();
        for (NativeProviderPayload value : payloads) rows.put(new JSONObject().put("payload", value.json()).put("provider_outcome", "delivery_outcome_unknown"));
        JSONObject result = new JSONObject().put("schema", "custodial.native-provider-inventory.v1")
            .put("scan_id", scan.get("scan_id")).put("principal_digest", request.principal.digest)
            .put("generation_ids", scan.getJSONArray("generation_ids"))
            .put("cursor", payloads.length == 0 ? scan.get("cursor") : tuple(payloads[payloads.length - 1]))
            .put("ceiling", ceiling == null ? JSONObject.NULL : tuple(ceiling))
            .put("server_now", NOW).put("has_more", more).put("rows", rows);
        for (String field : new String[]{"device_id", "employee_id", "credential_id", "assignment_epoch"}) result.put(field, p.get(field));
        return result;
    }
    static AuthorizedResponse response(JSONObject data) throws Exception {
        return new AuthorizedResponse(200, Map.of("content-type", "application/json; charset=utf-8"),
            new JSONObject().put("ok", true).put("data", data).toString().getBytes(StandardCharsets.UTF_8));
    }
    static NativeProviderInventory.Page page(NativeProviderInventory.Request request, JSONObject data) throws Exception {
        return NativeProviderInventory.validateResponse(request, response(data));
    }
    static NativeProviderJournal.Observation observed() throws Exception { return NativeProviderIngressTest.observation(NOW, 101, 7); }
    static final class Fixture {
        final NativeProviderIngressTest.Fixture ingress;
        final NativeProviderJournalTest.Fixture store;
        final NativeProviderPrincipal principal;
        final NativeProviderJournal.Prepared generation;
        Fixture(boolean legacy) throws Exception {
            ingress = new NativeProviderIngressTest.Fixture(true, legacy); store = ingress.r.f; principal = ingress.r.principal; generation = ingress.r.prepared;
        }
        NativeProviderJournal journal() { return store.journal(); }
        NativeProviderInventory.Request prepare() throws Exception { return journal().prepareInventory(principal); }
        int consume(NativeProviderInventory.Request request, JSONObject data) throws Exception { return journal().consumeInventory(principal, request, page(request, data), observed()); }
        JSONObject recovery(NativeProviderInventory.Request request) throws Exception { return store.read(ProviderEnvelopeCrypto.Domain.METADATA, request.recoveryId); }
        long count(ProviderEnvelopeCrypto.Domain domain) throws Exception { return ingress.count(domain); }
    }
    @Test public void thirtyTwoRowsThenNextPageSurviveRestartAndDeduplicateFcmWithoutNewReceipt() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture f = new Fixture(legacy); NativeProviderInventory.Request first = f.prepare(); NativeProviderPayload end = payload(f.generation, 33);
            NativeProviderPayload[] rows = new NativeProviderPayload[32]; for (int i = 0; i < rows.length; i++) rows[i] = payload(f.generation, i + 1);
            assertEquals(32, f.consume(first, data(first, end, true, rows))); assertEquals(32, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
            NativeProviderInventory.Request next = f.prepare(); assertEquals(first.scan().get("scan_id"), next.scan().get("scan_id"));
            assertTrue(NativeLegacyLineageJournal.same(tuple(rows[31]), next.scan().getJSONObject("cursor")));
            assertEquals(1, f.consume(next, data(next, end, false, end))); assertNull(f.prepare());
            int commits = f.store.storage.memory.commits;
            assertFalse(f.journal().recordArrival(f.principal, rows[0], observed()).newlyAdmitted);
            assertEquals(commits, f.store.storage.memory.commits); assertEquals(33, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
            assertEquals(2, f.recovery(first).getJSONObject("completed_scan").getInt("pages"));
        }
    }
    @Test public void unknownNativeClockDurablyQuarantinesBeforeCompletingScanAndDoesNotInventReceipt() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare(); NativeProviderPayload p = payload(f.generation, 1);
        assertEquals(1, f.journal().consumeInventory(f.principal, request, page(request, data(request, p, false, p)),
            NativeProviderIngressTest.observation(null, -1, -1)));
        assertNull(f.prepare()); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.QUARANTINE)); assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertTrue(f.journal().drainQuarantine(f.principal, p.recordId, observed()).newlyAdmitted);
        JSONObject stored = f.store.read(ProviderEnvelopeCrypto.Domain.INBOX, p.recordId).getJSONObject("received_observation");
        assertTrue(stored.isNull("authenticated_at")); assertTrue(stored.isNull("boot_count"));
    }
    @Test public void explicitEmptyEndCompletesButEmptyHasMoreCannotEraseNeed() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare();
        ProviderRecordStoreTest.failure(INVALID, () -> page(request, data(request, null, true)));
        assertEquals(0, f.consume(request, data(request, null, false))); assertNull(f.prepare());
        f.journal().requestRecovery(); assertNotNull(f.prepare());
    }
    @Test public void deletedMessagesBeforeEnrollmentPreservesNeedButCannotInventGeneration() throws Exception {
        NativeProviderJournalTest.Fixture f = new NativeProviderJournalTest.Fixture(); NativeProviderPrincipal principal = NativeProviderJournalTest.v1();
        assertEquals(1, f.journal().requestRecovery());
        ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", () -> f.journal().prepareInventory(principal));
        f.journal().observeActivePrincipal(principal); f.journal().captureToken("synthetic"); f.journal().prepareRegistration(principal, NativeProviderJournalTest.app());
        ProviderRecordStoreTest.failure("custodial_provider_recovery_waiting_confirmation", () -> f.journal().prepareInventory(principal));
        assertEquals(0, f.storage.store().load().keys().stream().filter(k -> k.id.startsWith("recovery-")).count());
    }
    @Test public void recoveryEpochDuringScanCoalescesWithoutChangingOriginalCeiling() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare();
        long epoch = f.journal().requestRecovery(); f.journal().requestRecovery();
        assertEquals(request.scan().get("scan_id"), f.prepare().scan().get("scan_id"));
        f.consume(request, data(request, null, false)); NativeProviderInventory.Request next = f.prepare();
        assertNotEquals(request.scan().get("scan_id"), next.scan().get("scan_id")); assertEquals(epoch + 1, next.scan().getLong("captured_epoch"));
        assertTrue(next.scan().isNull("cursor"));
    }
    @Test public void committedRowWithLostReadbackDoesNotAdvanceCursorOrDuplicateOnRetry() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare(); NativeProviderPayload p = payload(f.generation, 1);
        JSONObject data = data(request, p, false, p); f.store.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.consume(request, data));
        f.store.storage.memory.persistThenReject = false; assertTrue(f.prepare().scan().isNull("cursor")); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertEquals(1, f.consume(request, data)); assertNull(f.prepare()); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void checkpointLostReadbackIsRecoveredFromDurableCursorWithoutReplayingEffects() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare(); NativeProviderPayload p = payload(f.generation, 1), end = payload(f.generation, 2);
        int checkpointCommit = f.store.storage.memory.commits + 2;
        ProviderRecordStore.Backend backend = new ProviderRecordStore.Backend() {
            public Map<String, ?> readAll() throws Exception { return f.store.storage.memory.readAll(); }
            public boolean replace(Map<String, String> next) { boolean ok = f.store.storage.memory.replace(next); return ok && f.store.storage.memory.commits != checkpointCommit; }
        };
        Object lock = f.store.storage.lock;
        NativeProviderJournal broken = new NativeProviderJournal(new ProviderRecordStore(backend,
            new ProviderEnvelopeCrypto(f.store.storage.keys, () -> backend.readAll().isEmpty(), lock), lock), lock);
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> broken.consumeInventory(f.principal, request, page(request, data(request, end, true, p)), observed()));
        NativeProviderInventory.Request next = f.prepare(); assertTrue(NativeLegacyLineageJournal.same(tuple(p), next.scan().getJSONObject("cursor")));
        ProviderRecordStoreTest.failure(STALE, () -> f.consume(request, data(request, end, true, p))); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        f.consume(next, data(next, end, false, end)); assertNull(f.prepare()); assertEquals(2, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void unavailableReturnFencesOldCallbackButKeepsExactScanAndRemovalNeverRebindsIt() throws Exception {
        Fixture f = new Fixture(true); NativeProviderInventory.Request request = f.prepare(); JSONObject empty = data(request, null, false);
        f.journal().observeUnavailable(); f.journal().observeActivePrincipal(f.principal);
        ProviderRecordStoreTest.failure(STALE, () -> f.consume(request, empty)); NativeProviderInventory.Request resumed = f.prepare();
        assertTrue(ProviderWireJson.same(request.scan(), resumed.scan())); f.journal().observeRemoved();
        JSONObject old = f.recovery(request); assertEquals("REVOKED_OR_FOREIGN", old.getString("authority_state"));
        f.journal().observeActivePrincipal(f.principal); f.journal().captureToken("fresh-after-removal");
        NativeProviderJournal.Prepared generation = f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
        f.journal().confirmRegistration(f.principal, generation, NativeProviderRegistrationReceipt.validateResponse(generation,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(generation, null, NativeProviderRegistrationReceiptTest.TIME))));
        NativeProviderInventory.Request next = f.prepare(); assertNotEquals(request.recoveryId, next.recoveryId);
        assertTrue(ProviderWireJson.same(old, f.recovery(request))); ProviderRecordStoreTest.failure(STALE, () -> f.consume(resumed, empty));
    }
    @Test public void rotationRetainsOldScanGenerationSetThenSchedulesNewGenerationWithoutRelabeling() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare(); f.journal().captureToken("rotate");
        NativeProviderJournal.Prepared nextGeneration = f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
        f.journal().confirmRegistration(f.principal, nextGeneration, NativeProviderRegistrationReceipt.validateResponse(nextGeneration,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(nextGeneration, f.generation.generationId, NativeProviderRegistrationReceiptTest.TIME))));
        assertEquals(1, f.prepare().scan().getJSONArray("generation_ids").length()); f.consume(request, data(request, null, false));
        NativeProviderInventory.Request next = f.prepare(); assertEquals(2, next.scan().getJSONArray("generation_ids").length());
    }
    @Test public void malformedIdentityBoundsOrderingAndProviderOutcomesNeverAdvanceCursor() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request request = f.prepare(); NativeProviderPayload p = payload(f.generation, 1), q = payload(f.generation, 2);
        for (String fault : new String[]{"principal", "generation", "scan", "epoch", "time", "expired", "ceiling", "cursor", "order", "duplicate", "too_many", "outcome", "content", "extra"}) {
            JSONObject d = data(request, q, false, p, q); JSONArray rows = d.getJSONArray("rows");
            switch (fault) {
                case "principal": d.put("principal_digest", "d".repeat(64)); break;
                case "generation": d.put("generation_ids", new JSONArray().put("99000000-0000-4000-8000-000000000001")); break;
                case "scan": d.put("scan_id", "99000000-0000-4000-8000-000000000001"); break;
                case "epoch": d.put("assignment_epoch", "4"); break;
                case "time": d.put("server_now", "2026-09-24T17:00:00.123455Z"); break;
                case "expired": d.put("server_now", NativeProviderPayloadTest.END); break;
                case "ceiling": d.put("ceiling", tuple(p)); break;
                case "cursor": d.put("cursor", tuple(p)); break;
                case "order": d.put("rows", new JSONArray().put(rows.get(1)).put(rows.get(0))); break;
                case "duplicate": rows.put(rows.get(1)); break;
                case "too_many": for (int i = 2; i < 33; i++) rows.put(rows.get(0)); break;
                case "outcome": rows.getJSONObject(0).put("provider_outcome", "known_nonacceptance"); break;
                case "content": rows.getJSONObject(0).getJSONObject("payload").put("body", "changed"); break;
                case "extra": d.put("accepted", true); break;
            }
            Map<String, Object> before = new HashMap<>(f.store.storage.memory.raw);
            try { f.consume(request, d); fail(fault); } catch (VaultFailure expected) { assertTrue(fault, expected.code.startsWith("custodial_provider_")); }
            assertEquals(fault, before, f.store.storage.memory.raw);
        }
        byte[] decimal = new String(response(data(request, p, false, p)).body, StandardCharsets.UTF_8)
            .replace("\"assignment_epoch\":" + request.principal.json().getLong("assignment_epoch"), "\"assignment_epoch\":" + request.principal.json().getLong("assignment_epoch") + ".0").getBytes(StandardCharsets.UTF_8);
        ProviderRecordStoreTest.failure(INVALID, () -> NativeProviderInventory.validateResponse(request, new AuthorizedResponse(200, Map.of("Content-Type", "application/json"), decimal)));
    }
    @Test public void continuationCannotChangeCeilingTimeGenerationsOrReplayEarlierTuple() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request first = f.prepare(); NativeProviderPayload p = payload(f.generation, 1), q = payload(f.generation, 2);
        f.consume(first, data(first, q, true, p)); NativeProviderInventory.Request next = f.prepare();
        for (String field : new String[]{"ceiling", "server_now", "generation_ids", "rows"}) {
            JSONObject changed = data(next, q, false, q);
            switch (field) {
                case "ceiling": changed.put(field, tuple(payload(f.generation, 3))); break;
                case "server_now": changed.put(field, "2026-09-24T17:00:00.123458Z"); break;
                case "generation_ids": changed.put(field, new JSONArray().put("99000000-0000-4000-8000-000000000001")); break;
                case "rows": changed = data(next, q, false, p); break;
            }
            JSONObject d = changed; ProviderRecordStoreTest.failure(INVALID, () -> page(next, d));
        }
        NativeProviderInventory.Request otherObject = f.prepare(); NativeProviderInventory.Page original = page(next, data(next, q, false, q));
        ProviderRecordStoreTest.failure(INVALID, () -> f.journal().consumeInventory(f.principal, otherObject, original, observed()));
    }
    static OfflineAuthorityTime unknownClock() {
        OfflineAuthorityTime.OfflineAuthorityTimeStore storage = (OfflineAuthorityTime.OfflineAuthorityTimeStore) java.lang.reflect.Proxy.newProxyInstance(
            OfflineAuthorityTime.class.getClassLoader(), new Class<?>[]{OfflineAuthorityTime.OfflineAuthorityTimeStore.class}, (proxy, method, args) -> {
                if (method.getName().equals("loadAnchor") || method.getName().equals("loadRollbackFence")) return null;
                throw new AssertionError("Unexpected cleaning store access: " + method.getName());
            });
        return new OfflineAuthorityTime(storage, new OfflineAuthorityTime.MonotonicClock() {
            public long now() { return 101; } public int bootCount() { return 7; }
        });
    }
    @Test public void actualEngineTypedInventorySignsExactOriginalBodyAndQuarantinesUnknownClock() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(legacy); f.send(false, f.http());
            NativeProviderInventory.Request request = f.provider.journal().prepareInventory(f.principal); NativeProviderPayload p = payload(f.prepared, 1);
            byte[] body = response(data(request, p, false, p)).body;
            NativeProviderHttp http = new NativeProviderHttp(url -> { f.connection = new NativeProviderHttpTest.Connection(url, body); return f.connection; }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID);
            assertEquals(1, f.engine.recoverNativeProviderInventory(request, f.principalJournal, f.legacyJournal, f.provider.journal(), http, new NativeProviderHttp.Attempt(), unknownClock()));
            NativeProviderHttpTest.Connection c = f.connection;
            assertEquals("/employee-notifications-api/native-provider/inventory", c.getURL().getPath()); assertArrayEquals(request.body(), c.sent.toByteArray());
            JSONObject wire = ProviderWireJson.object(c.sent.toByteArray(), 65536); assertEquals(32, wire.getInt("limit")); assertFalse(wire.has("token")); assertFalse(wire.has("principal"));
            char[] secret = f.cipher.decrypt(f.persistence.current().secret);
            try {
                Map<String, String> expected = NativeAttestation.requestHeaders(new AuthorizedRequest(c.getURL().getPath(), "POST", Map.of(), c.sent.toByteArray()), "KIOSK_08", secret, NativeProviderHttpTest.RID, NativeProviderHttpTest.NOW);
                for (String header : expected.keySet()) assertEquals(expected.get(header), c.sentHeaders.get(header));
            } finally { Arrays.fill(secret, '\0'); }
            assertEquals("QUARANTINED", f.provider.read(ProviderEnvelopeCrypto.Domain.QUARANTINE, p.recordId).getString("state"));
            assertNull(f.provider.journal().prepareInventory(f.principal)); assertTrue(c.disconnects > 0);
        }
    }
    @Test public void canceledOrUnavailableHttpCannotAdvanceOriginalInventory() throws Exception {
        for (String fault : new String[]{"cancel", "unavailable", "removed"}) {
            NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); f.send(false, f.http());
            NativeProviderInventory.Request request = f.provider.journal().prepareInventory(f.principal); NativeProviderPayload p = payload(f.prepared, 1);
            byte[] body = response(data(request, p, false, p)).body; NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt();
            NativeProviderHttp http = new NativeProviderHttp(url -> {
                f.connection = new NativeProviderHttpTest.Connection(url, body); f.connection.onResponse = () -> {
                    if (fault.equals("cancel")) attempt.cancel();
                    else if (fault.equals("unavailable")) { f.provider.journal().observeUnavailable(); f.provider.journal().observeActivePrincipal(f.principal); }
                    else f.provider.journal().observeRemoved();
                }; return f.connection;
            }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID);
            try { f.engine.recoverNativeProviderInventory(request, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, unknownClock()); fail(fault); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
            assertTrue(f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA, request.recoveryId).getJSONObject("scan").isNull("cursor"));
            assertEquals(0, f.provider.storage.store().load().keys().stream().filter(k -> k.domain == ProviderEnvelopeCrypto.Domain.INBOX || k.domain == ProviderEnvelopeCrypto.Domain.QUARANTINE).count());
        }
    }
    @Test public void persistedArraysAndLargeIntegersCompareExactlyWithoutChangingLegacyJournal() throws Exception {
        JSONObject a = new JSONObject().put("values", new JSONArray().put("a").put(9007199254740992L)).put("nested", new JSONObject().put("v", 1));
        JSONObject b = new JSONObject().put("nested", new JSONObject().put("v", 1L)).put("values", new JSONArray().put("a").put(9007199254740992L));
        assertTrue(ProviderWireJson.same(a, b)); b.getJSONArray("values").put(1, 9007199254740993L); assertFalse(ProviderWireJson.same(a, b));
        b.getJSONArray("values").put(1, 9007199254740992d); assertFalse(ProviderWireJson.same(a, b));
        assertFalse(ProviderWireJson.same(new JSONArray().put("a").put("b"), new JSONArray().put("b").put("a")));
    }
    @Test public void onlyExactAuthenticatedCursorErrorRestartsScanWithoutErasingNeedOrEarlierRows() throws Exception {
        Fixture f = new Fixture(false); NativeProviderInventory.Request first = f.prepare(); NativeProviderPayload p = payload(f.generation, 1), q = payload(f.generation, 2);
        f.consume(first, data(first, q, true, p)); NativeProviderInventory.Request request = f.prepare();
        JSONObject error = new JSONObject().put("schema", "custodial.native-provider-inventory-restart.v1").put("ok", false)
            .put("error", "custodial_native_provider_cursor_invalid").put("principal_digest", request.principal.digest);
        for (String field : new String[]{"scan_id", "cursor", "ceiling", "server_now", "generation_ids"}) error.put(field, request.scan().get(field));
        AuthorizedResponse response = new AuthorizedResponse(409, Map.of("content-type", "application/json"), error.toString().getBytes(StandardCharsets.UTF_8));
        ProviderRecordStoreTest.failure(INVALID, () -> NativeProviderInventory.validateCursorRejection(first, response));
        ProviderRecordStoreTest.failure(INVALID, () -> NativeProviderInventory.validateCursorRejection(request, new AuthorizedResponse(400, response.headers, response.body)));
        JSONObject wrong = new JSONObject(error.toString()).put("cursor", tuple(q));
        ProviderRecordStoreTest.failure(INVALID, () -> NativeProviderInventory.validateCursorRejection(request, new AuthorizedResponse(409, response.headers, wrong.toString().getBytes(StandardCharsets.UTF_8))));
        NativeProviderInventory.CursorRejection receipt = NativeProviderInventory.validateCursorRejection(request, response);
        f.journal().restartInventory(f.principal, request, receipt); NativeProviderInventory.Request next = f.prepare();
        assertNotEquals(request.scan().get("scan_id"), next.scan().get("scan_id")); assertTrue(next.scan().isNull("cursor"));
        assertEquals(request.scan().get("captured_epoch"), next.scan().get("captured_epoch")); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertTrue(ProviderWireJson.same(request.scan(), f.recovery(next).getJSONObject("last_restarted_scan")));
        ProviderRecordStoreTest.failure(STALE, () -> f.journal().restartInventory(f.principal, request, receipt));
        f.consume(next, data(next, q, false, p, q)); assertNull(f.prepare()); assertEquals(2, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
}
