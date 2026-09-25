package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual journal/encrypted-store transitions with synthetic SDK/time/network/storage boundaries.
 * No OS notify, native SDK ingress, real HTTP or phone acceptance is credited. */
public final class NativeProviderIngressTest {
    static final String NOW = "2026-09-24T17:00:00.123457Z", RETIRE = "2026-09-24T17:00:00.123456Z";
    static NativeProviderJournal.Observation observation(String time, long elapsed, int boot) throws Exception {
        return new NativeProviderJournal.Observation(time == null ? null : Instant.parse(time), elapsed, boot);
    }
    static NativeProviderPayload payload(NativeProviderJournal.Prepared prepared) throws Exception {
        return NativeProviderPayloadTest.accept(NativeProviderPayloadTest.lunch(prepared));
    }
    static final class Fixture {
        final NativeProviderRegistrationReceiptTest.Fixture r;
        final NativeProviderPayload payload;
        Fixture(boolean confirmed, boolean legacy) throws Exception {
            r = new NativeProviderRegistrationReceiptTest.Fixture(legacy); payload = payload(r.prepared);
            if (confirmed) confirm();
        }
        void confirm() throws Exception { r.f.journal().confirmRegistration(r.principal, r.prepared, r.receipt(null, NativeProviderRegistrationReceiptTest.TIME)); }
        NativeProviderJournal.Arrival arrive(String time) throws Exception { return r.f.journal().recordArrival(r.principal, payload, observation(time, 101, 7)); }
        JSONObject read(ProviderEnvelopeCrypto.Domain domain) throws Exception { return r.f.read(domain, payload.recordId); }
        long count(ProviderEnvelopeCrypto.Domain domain) throws Exception { return r.f.storage.store().load().keys().stream().filter(k -> k.domain == domain).count(); }
    }
    @Test public void beforeConfirmationArrivalQuarantinesThenAtomicallyPromotesWithOriginalObservation() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture f = new Fixture(false, legacy); assertEquals("QUARANTINED", f.arrive(NOW).state);
            JSONObject original = f.read(ProviderEnvelopeCrypto.Domain.QUARANTINE).getJSONObject("received_observation");
            assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT)); assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.INBOX));
            assertFalse(f.arrive(NOW).newlyAdmitted); f.confirm(); int before = f.r.f.storage.memory.commits;
            assertTrue(f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, observation(NOW, 555, 7)).newlyAdmitted);
            assertEquals(before + 1, f.r.f.storage.memory.commits); assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.QUARANTINE));
            JSONObject inbox = f.read(ProviderEnvelopeCrypto.Domain.INBOX);
            assertTrue(NativeLegacyLineageJournal.same(original, inbox.getJSONObject("received_observation")));
            assertEquals("PENDING_DISPLAY", inbox.getString("display_state")); assertEquals("mz-provider:" + f.payload.recordId, inbox.getString("os_tag"));
            JSONObject event = f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, inbox.getString("received_event_id"));
            assertEquals("received", event.getString("action")); assertEquals("PENDING", event.getString("state"));
            assertEquals(f.payload.contentHash, event.getString("content_sha256"));
            assertTrue(NativeLegacyLineageJournal.same(original, event.getJSONObject("original_observation")));
        }
    }
    @Test public void oneAtomicAcceptedRecordAndReceivedEventSurviveRestartAndDuplicateInventory() throws Exception {
        Fixture f = new Fixture(true, false); int before = f.r.f.storage.memory.commits; assertTrue(f.arrive(NOW).newlyAdmitted);
        assertEquals(before + 1, f.r.f.storage.memory.commits); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        JSONObject original = f.read(ProviderEnvelopeCrypto.Domain.INBOX); before = f.r.f.storage.memory.commits;
        NativeProviderPayload inventory = NativeProviderPayload.fromInventory(f.payload.json());
        assertFalse(f.r.f.journal().recordArrival(f.r.principal, inventory, observation(NOW, 202, 7)).newlyAdmitted);
        assertFalse(f.arrive(NativeProviderPayloadTest.END).newlyAdmitted); // Deduped fact, not fresh display permission.
        assertEquals(before, f.r.f.storage.memory.commits); assertTrue(NativeLegacyLineageJournal.same(original, f.read(ProviderEnvelopeCrypto.Domain.INBOX)));
    }
    @Test public void conflictingSameRecordContentCannotReplaceOriginalPayloadOrReceipt() throws Exception {
        Fixture f = new Fixture(true, false); f.arrive(NOW); Map<String, Object> original = new HashMap<>(f.r.f.storage.memory.raw);
        Map<String, String> changed = new TreeMap<>(f.payload.data()); changed.put("body", "A different assigned body");
        NativeProviderPayload conflict = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(changed));
        ProviderRecordStoreTest.failure("custodial_provider_payload_conflict", () -> f.r.f.journal().recordArrival(f.r.principal, conflict, observation(NOW, 111, 7)));
        assertEquals(original, f.r.f.storage.memory.raw);
    }
    @Test public void unknownGenerationOrWrongTokenNeverCreateAnAuthorityRecord() throws Exception {
        Fixture f = new Fixture(true, true); Map<String, Object> original = new HashMap<>(f.r.f.storage.memory.raw);
        for (String field : new String[]{"generation_id", "token_digest"}) {
            Map<String, String> changed = new TreeMap<>(f.payload.data()); changed.put(field, field.equals("generation_id") ? "99000000-0000-4000-8000-000000000001" : "d".repeat(64));
            NativeProviderPayload invalid = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(changed));
            ProviderRecordStoreTest.failure(field.equals("generation_id") ? "custodial_provider_generation_unknown" : "custodial_provider_generation_refused",
                () -> f.r.f.journal().recordArrival(f.r.principal, invalid, observation(NOW, 100, 7)));
            assertEquals(original, f.r.f.storage.memory.raw);
        }
    }
    @Test public void unknownOrBehindAuthenticatedClockQuarantinesAndNeverUsesWallClock() throws Exception {
        for (String unknown : new String[]{null, "2026-09-24T17:00:00.123455Z"}) {
            Fixture f = new Fixture(true, false); assertEquals("QUARANTINED", f.arrive(unknown).state);
            assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT)); JSONObject first = f.read(ProviderEnvelopeCrypto.Domain.QUARANTINE).getJSONObject("received_observation");
            assertTrue(f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, observation(NOW, 500, 8)).newlyAdmitted);
            assertTrue(NativeLegacyLineageJournal.same(first, f.read(ProviderEnvelopeCrypto.Domain.INBOX).getJSONObject("received_observation")));
            // New boot/anchor does not forge a UTC timestamp for the original unknown observation.
            if (unknown == null) assertTrue(first.isNull("authenticated_at"));
        }
    }
    @Test public void expiryRejectsNewAdmissionAndPreservesQuarantinedOriginalWithoutReceivedEvent() throws Exception {
        Fixture f = new Fixture(false, false); f.arrive(NOW); f.confirm(); Map<String, Object> before = new HashMap<>(f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_payload_expired", () -> f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, observation(NativeProviderPayloadTest.END, 900, 7)));
        assertEquals(before, f.r.f.storage.memory.raw); assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void originalActivationAndExactMicrosecondRetirementBoundariesAreEnforced() throws Exception {
        Fixture f = new Fixture(false, false);
        NativeProviderRegistrationReceipt activatedLater = NativeProviderRegistrationReceipt.validateResponse(f.r.prepared,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(f.r.prepared, null, NOW)));
        f.r.f.journal().confirmRegistration(f.r.principal, f.r.prepared, activatedLater);
        ProviderRecordStoreTest.failure("custodial_provider_reservation_refused", () -> f.arrive(NOW));
        Fixture old = new Fixture(true, true); old.r.f.journal().captureToken("next");
        NativeProviderJournal.Prepared next = old.r.f.journal().prepareRegistration(old.r.principal, NativeProviderJournalTest.app());
        assertEquals("QUARANTINED", old.arrive(NOW).state); // Actual server retirement may be ahead of the local confirmation.
        NativeProviderRegistrationReceipt receipt = NativeProviderRegistrationReceipt.validateResponse(next,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next, old.r.prepared.generationId, RETIRE)));
        old.r.f.journal().confirmRegistration(old.r.principal, next, receipt);
        assertTrue(old.r.f.journal().drainQuarantine(old.r.principal, old.payload.recordId, observation(NOW, 200, 7)).newlyAdmitted);
        Map<String, String> late = new TreeMap<>(old.payload.data()); late.put("receipt_job_id", "77000000-0000-4000-8000-000000000002");
        late.put("reservation_at", NOW); NativeProviderPayload invalid = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(late));
        ProviderRecordStoreTest.failure("custodial_provider_reservation_refused", () -> old.r.f.journal().recordArrival(old.r.principal, invalid, observation(NOW, 201, 7)));
        NativeProviderPayload newGeneration = payload(next); assertTrue(old.r.f.journal().recordArrival(old.r.principal, newGeneration, observation(NOW, 202, 7)).newlyAdmitted);
    }
    @Test public void failedWriteAndAmbiguousCommittedReadbackNeverReturnAcceptanceOrDuplicateEvent() throws Exception {
        Fixture f = new Fixture(true, false); Map<String, Object> before = new HashMap<>(f.r.f.storage.memory.raw); f.r.f.storage.memory.reject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.arrive(NOW)); assertEquals(before, f.r.f.storage.memory.raw);
        f.r.f.storage.memory.reject = false; f.r.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.arrive(NOW));
        f.r.f.storage.memory.persistThenReject = false; int commits = f.r.f.storage.memory.commits;
        assertFalse(f.arrive(NOW).newlyAdmitted); assertEquals(commits, f.r.f.storage.memory.commits); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void ambiguousQuarantinePromotionCanBeRetriedWithoutAnotherEvent() throws Exception {
        Fixture f = new Fixture(false, true); f.arrive(NOW); f.confirm(); f.r.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, observation(NOW, 201, 7)));
        f.r.f.storage.memory.persistThenReject = false; int commits = f.r.f.storage.memory.commits;
        assertFalse(f.r.f.journal().drainQuarantine(f.r.principal, f.payload.recordId, observation(NOW, 202, 7)).newlyAdmitted);
        assertEquals(commits, f.r.f.storage.memory.commits); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void removalFencesInboxAndUnsentEventAtomicallyButRetainsFactsAndExactCancelIntents() throws Exception {
        Fixture f = new Fixture(true, true); f.arrive(NOW); JSONObject original = f.read(ProviderEnvelopeCrypto.Domain.INBOX);
        int before = f.r.f.storage.memory.commits; f.r.f.journal().observeRemoved(); assertEquals(before + 1, f.r.f.storage.memory.commits);
        JSONObject retired = f.read(ProviderEnvelopeCrypto.Domain.INBOX); assertEquals("REVOKED_OR_FOREIGN", retired.getString("authority_state"));
        assertEquals("ADMITTED", retired.getString("state")); assertTrue(retired.getBoolean("os_cancel_pending")); assertTrue(retired.getBoolean("mirror_retire_pending"));
        assertEquals(original.getString("os_tag"), retired.getString("os_tag")); assertTrue(NativeLegacyLineageJournal.same(original.getJSONObject("payload"), retired.getJSONObject("payload")));
        JSONObject event = f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, retired.getString("received_event_id"));
        assertEquals("PENDING", event.getString("state")); assertEquals("REVOKED_OR_FOREIGN", event.getString("authority_state"));
        assertEquals(f.r.principal.digest, NativeProviderPrincipal.fromNativeJournal(event.getJSONObject("principal")).digest);
        f.r.f.journal().observeActivePrincipal(f.r.principal);
        ProviderRecordStoreTest.failure("custodial_provider_generation_refused", () -> f.arrive(NOW));
        f.r.f.journal().captureToken("old-token"); NativeProviderJournal.Prepared next = f.r.f.journal().prepareRegistration(f.r.principal, NativeProviderJournalTest.app());
        assertNotEquals(f.r.prepared.generationId, next.generationId); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.INBOX));
    }
    @Test public void unavailabilityAndForeignPrincipalCannotAdmitOrDrainAndQuarantineSurvivesRemoval() throws Exception {
        Fixture f = new Fixture(false, false); f.arrive(NOW); JSONObject original = f.read(ProviderEnvelopeCrypto.Domain.QUARANTINE);
        f.r.f.journal().observeUnavailable(); ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", () -> f.arrive(NOW));
        f.r.f.journal().observeActivePrincipal(f.r.principal); assertFalse(f.arrive(NOW).newlyAdmitted);
        f.r.f.journal().observeActivePrincipal(NativeProviderPrincipal.fromNativeJournal(f.r.principal.json().put("assignment_epoch", 5)));
        ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", () -> f.arrive(NOW));
        JSONObject retired = f.read(ProviderEnvelopeCrypto.Domain.QUARANTINE); assertEquals("REVOKED_OR_FOREIGN", retired.getString("authority_state"));
        assertTrue(NativeLegacyLineageJournal.same(original.getJSONObject("payload"), retired.getJSONObject("payload")));
        assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
    }
    @Test public void fullInboxRefusesNewWorkPersistsOnlyReservedDiagnosticAndEvictsNothing() throws Exception {
        Fixture f = new Fixture(true, false); ProviderRecordStore store = f.r.f.storage.store();
        Map<ProviderRecordStore.Key, char[]> fill = new HashMap<>();
        for (int i = 0; i < 256; i++) fill.put(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.INBOX, "synthetic-capacity-" + i), ("{\"schema\":\"custodial.native-provider-journal.v1\",\"retained\":" + i + "}").toCharArray());
        try { store.commit(store.load().revision, fill, Collections.emptySet()); } finally { fill.values().forEach(chars -> Arrays.fill(chars, '\0')); }
        Map<String, Object> before = new HashMap<>(f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_capacity_preserved", () -> f.arrive(NOW)); assertEquals(256, f.count(ProviderEnvelopeCrypto.Domain.INBOX));
        for (String key : before.keySet()) if (!key.equals(ProviderRecordStore.INDEX)) assertEquals(before.get(key), f.r.f.storage.memory.raw.get(key));
        assertEquals(0, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertTrue(f.r.f.read(ProviderEnvelopeCrypto.Domain.METADATA, "recovery-diagnostic").getBoolean("recovery_needed"));
    }
}
