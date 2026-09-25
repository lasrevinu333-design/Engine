package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderEventReceiptsTest {
    static NativeProviderIngressTest.Fixture fixture() throws Exception {
        NativeProviderIngressTest.Fixture f = new NativeProviderIngressTest.Fixture(true, true); f.arrive(NativeProviderIngressTest.NOW); return f;
    }
    static NativeProviderJournal.EventBatch batch(NativeProviderIngressTest.Fixture f) throws Exception { return f.r.f.journal().pendingEvents(f.r.principal, 16); }
    static JSONObject receipt(NativeProviderJournal.PendingEvent event) throws Exception {
        return event.wire().put("schema", NativeProviderEventReceipts.SCHEMA).put("admitted_state", "ACCEPTED")
            .put("server_received_at", "2026-09-24T19:00:00.987654Z").put("replayed", false);
    }
    static AuthorizedResponse response(JSONArray rows) throws Exception {
        return new AuthorizedResponse(200, Map.of("Content-Type", "application/json"), new JSONObject().put("ok", true)
            .put("data", new JSONObject().put("schema", "custodial.native-provider-event-receipts.v1").put("results", rows)).toString().getBytes(StandardCharsets.UTF_8));
    }
    static NativeProviderEventReceipts validate(NativeProviderJournal.EventBatch batch, JSONObject... rows) throws Exception {
        JSONArray array = new JSONArray(); for (JSONObject row : rows) array.put(row); return NativeProviderEventReceipts.validateResponse(batch, response(array));
    }
    @Test public void exactCommittedReceiptSettlesOnlyOriginalEventWithoutDeletingWorkOrResettingReminder() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f);
        assertEquals(1, batch.events.size()); NativeProviderJournal.PendingEvent pending = batch.events.values().iterator().next();
        JSONObject wire = ProviderWireJson.object(batch.body(), 65536).getJSONArray("events").getJSONObject(0);
        assertFalse(wire.has("principal")); assertFalse(wire.has("installation_seal")); assertEquals("received", wire.getString("action"));
        JSONObject before = f.read(ProviderEnvelopeCrypto.Domain.INBOX); int commits = f.r.f.storage.memory.commits;
        NativeProviderEventReceipts admitted = validate(batch, receipt(pending)); assertEquals(1, f.r.f.journal().settleEvents(f.r.principal, batch, admitted));
        assertEquals(commits + 1, f.r.f.storage.memory.commits); assertEquals(0, batch(f).events.size());
        JSONObject settled = f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, pending.id); assertEquals("SETTLED", settled.getString("state"));
        assertEquals("2026-09-24T19:00:00.987654Z", settled.getJSONObject("admission").getString("server_received_at"));
        assertTrue(NativeLegacyLineageJournal.same(before, f.read(ProviderEnvelopeCrypto.Domain.INBOX)));
        assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT)); // Retained immutable evidence, not deletion.
    }
    @Test public void missingOrMismatchedBatchItemsStayQueuedWhileExactItemSettles() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); Map<String, String> data = new TreeMap<>(f.payload.data());
        data.put("receipt_job_id", "77000000-0000-4000-8000-000000000002");
        f.r.f.journal().recordArrival(f.r.principal, NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(data)), NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 301, 7));
        NativeProviderJournal.EventBatch batch = batch(f); assertEquals(2, batch.events.size());
        java.util.Iterator<NativeProviderJournal.PendingEvent> events = batch.events.values().iterator();
        NativeProviderJournal.PendingEvent first = events.next(), second = events.next();
        NativeProviderEventReceipts mixed = validate(batch, receipt(first), receipt(second).put("content_sha256", "f".repeat(64)));
        assertEquals(1, f.r.f.journal().settleEvents(f.r.principal, batch, mixed)); assertEquals(java.util.Set.of(second.id), batch(f).events.keySet());
        NativeProviderJournal.EventBatch retry = batch(f); NativeProviderEventReceipts missing = validate(retry);
        int commits = f.r.f.storage.memory.commits; assertEquals(0, f.r.f.journal().settleEvents(f.r.principal, retry, missing)); assertEquals(commits, f.r.f.storage.memory.commits);
    }
    @Test public void everyImmutableEchoAndReceiptTypeIsBoundAndDuplicateIdsInvalidateAmbiguousResponse() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f); NativeProviderJournal.PendingEvent event = batch.events.values().iterator().next();
        JSONObject valid = receipt(event);
        for (java.util.Iterator<String> keys = valid.keys(); keys.hasNext();) {
            String key = keys.next(); JSONObject wrong = new JSONObject(valid.toString()).put(key, "wrong");
            assertEquals("mismatched " + key, 0, validate(batch, wrong).admittedIds().size());
        }
        for (JSONObject invalid : new JSONObject[]{new JSONObject(valid.toString()).put("extra", true), new JSONObject(valid.toString()).put("admitted_state", "REJECTED")})
            assertTrue(validate(batch, invalid).admittedIds().isEmpty());
        ProviderRecordStoreTest.failure("custodial_provider_event_receipt_invalid", () -> validate(batch, valid, valid));
        assertEquals(1, batch(f).events.size());
    }
    @Test public void malformedHttpJsonDecimalNumbersAndChangedOriginalObservationCannotSettle() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f); JSONObject row = receipt(batch.events.values().iterator().next());
        AuthorizedResponse good = response(new JSONArray().put(row)); String body = new String(good.body, StandardCharsets.UTF_8);
        for (String malformed : new String[]{"", "<html>OK</html>", body.replace("\"ok\":true", "\"ok\":true,\"ok\":false")})
            try { NativeProviderEventReceipts.validateResponse(batch, new AuthorizedResponse(200, good.headers, malformed.getBytes(StandardCharsets.UTF_8))); fail(); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
        for (String number : new String[]{"receipt_assignment_epoch", "boot_count", "elapsed_realtime_ms"}) {
            String decimal = body.replaceAll("(\"" + number + "\":)([0-9]+)", "$1$2.0"); assertNotEquals(body, decimal);
            NativeProviderEventReceipts rejected = NativeProviderEventReceipts.validateResponse(batch, new AuthorizedResponse(200, good.headers, decimal.getBytes(StandardCharsets.UTF_8)));
            assertTrue(rejected.admittedIds().isEmpty());
        }
        row.getJSONObject("original_observation").put("authenticated_at", "2026-09-24T17:00:00.123458Z"); assertTrue(validate(batch, row).admittedIds().isEmpty());
        assertEquals(1, batch(f).events.size());
    }
    @Test public void unknownAcceptedGenerationAndEventIdsNeverRetireAnotherEvent() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f); JSONObject row = receipt(batch.events.values().iterator().next());
        for (String key : new String[]{"event_id", "generation_id", "receipt_job_id", "record_id", "receipt_credential_id", "receipt_employee_id"}) {
            JSONObject changed = new JSONObject(row.toString()).put(key, "99000000-0000-4000-8000-000000000001");
            assertTrue(validate(batch, changed).admittedIds().isEmpty());
        }
        NativeProviderJournal.EventBatch other = batch(f);
        ProviderRecordStoreTest.failure("custodial_provider_event_receipt_invalid", () -> f.r.f.journal().settleEvents(f.r.principal, other, validate(batch, row)));
    }
    @Test public void removedForeignAndUnavailableThenSamePrincipalCannotSettleOldInFlightBatch() throws Exception {
        for (String transition : new String[]{"removed", "foreign", "returned"}) {
            NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f); NativeProviderEventReceipts receipt = validate(batch, receipt(batch.events.values().iterator().next()));
            if (transition.equals("removed")) f.r.f.journal().observeRemoved();
            else if (transition.equals("foreign")) f.r.f.journal().observeActivePrincipal(NativeProviderPrincipal.fromNativeJournal(f.r.principal.json().put("assignment_epoch", 8)));
            else { f.r.f.journal().observeUnavailable(); f.r.f.journal().observeActivePrincipal(f.r.principal); }
            Map<String, Object> before = new HashMap<>(f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure(transition.equals("returned") ? "custodial_provider_operation_stale" : "custodial_provider_waiting_native_principal",
                () -> f.r.f.journal().settleEvents(f.r.principal, batch, receipt));
            assertEquals(before, f.r.f.storage.memory.raw);
        }
    }
    @Test public void samePrincipalRetiredGenerationAndExpiredPayloadCanDrainOriginalAlreadyAcceptedEvent() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); f.r.f.journal().captureToken("new-generation-token");
        NativeProviderJournal.Prepared next = f.r.f.journal().prepareRegistration(f.r.principal, NativeProviderJournalTest.app());
        f.r.f.journal().confirmRegistration(f.r.principal, next, NativeProviderRegistrationReceipt.validateResponse(next,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next, f.r.prepared.generationId, NativeProviderIngressTest.RETIRE))));
        NativeProviderJournal.EventBatch pending = batch(f); NativeProviderJournal.PendingEvent old = pending.events.values().iterator().next();
        assertEquals(f.r.prepared.generationId, old.wire().getString("generation_id"));
        assertEquals(1, f.r.f.journal().settleEvents(f.r.principal, pending, validate(pending, receipt(old))));
        assertEquals(f.r.prepared.generationId, f.read(ProviderEnvelopeCrypto.Domain.INBOX).getString("generation_id"));
    }
    @Test public void failedAndAmbiguousSettlementKeepsExactFactAndRecoversWithoutSecondWrite() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture(); NativeProviderJournal.EventBatch batch = batch(f); JSONObject row = receipt(batch.events.values().iterator().next());
        NativeProviderEventReceipts receipt = validate(batch, row); Map<String, Object> before = new HashMap<>(f.r.f.storage.memory.raw);
        f.r.f.storage.memory.reject = true; ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.r.f.journal().settleEvents(f.r.principal, batch, receipt));
        assertEquals(before, f.r.f.storage.memory.raw); f.r.f.storage.memory.reject = false; f.r.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.r.f.journal().settleEvents(f.r.principal, batch, receipt));
        f.r.f.storage.memory.persistThenReject = false; int commits = f.r.f.storage.memory.commits;
        assertEquals(1, f.r.f.journal().settleEvents(f.r.principal, batch, validate(batch, row.put("replayed", true)))); assertEquals(commits, f.r.f.storage.memory.commits);
        assertEquals(0, batch(f).events.size());
        ProviderRecordStoreTest.failure("custodial_provider_event_receipt_invalid", () -> f.r.f.journal().settleEvents(f.r.principal, batch,
            validate(batch, row.put("server_received_at", "2026-09-24T19:00:00.987655Z"))));
    }
    @Test public void eventBatchCannotExceedSixteenOrBeMutatedThroughReturnedWire() throws Exception {
        NativeProviderIngressTest.Fixture f = fixture();
        for (int limit : new int[]{0, -1, 17}) ProviderRecordStoreTest.failure("custodial_provider_event_batch_invalid", () -> f.r.f.journal().pendingEvents(f.r.principal, limit));
        NativeProviderJournal.EventBatch batch = batch(f); NativeProviderJournal.PendingEvent pending = batch.events.values().iterator().next();
        pending.wire().put("action", "acknowledged"); assertEquals("received", pending.wire().getString("action"));
        try { batch.events.clear(); fail(); } catch (UnsupportedOperationException expected) { }
    }
    @Test public void unavailableNativeClockKeepsUnknownObservationAcrossQuarantineAndExactReceipt() throws Exception {
        NativeProviderIngressTest.Fixture f = new NativeProviderIngressTest.Fixture(true, false);
        assertEquals("QUARANTINED", f.r.f.journal().recordArrival(f.r.principal, f.payload, new NativeProviderJournal.Observation(null, -1, -1)).state);
        assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertTrue(f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 500, 8)).newlyAdmitted);
        NativeProviderJournal.EventBatch batch = batch(f); JSONObject row = receipt(batch.events.values().iterator().next());
        JSONObject original = row.getJSONObject("original_observation");
        assertTrue(original.isNull("authenticated_at")); assertTrue(original.isNull("boot_count")); assertTrue(original.isNull("elapsed_realtime_ms"));
        assertEquals(1, f.r.f.journal().settleEvents(f.r.principal, batch, validate(batch, row)));
        ProviderRecordStoreTest.failure("custodial_provider_observation_invalid", () -> new NativeProviderJournal.Observation(java.time.Instant.parse(NativeProviderIngressTest.NOW), -1, -1));
    }
}
