package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Safe compaction of synthetic records only, after actual typed receipt validation.
 * No production/phone data or original NFC/enrollment namespace is present. */
public final class NativeProviderCompactionTest {
    static NativeProviderJournal.Observation time(String value) throws Exception { return NativeProviderIngressTest.observation(value, 1000, 7); }
    static final String EXPIRED = "2026-09-24T19:00:00.000000Z", DEDUPE_END = "2026-09-26T18:00:00.000000Z";
    static void settle(NativeProviderPresentationTest.Fixture f) throws Exception {
        NativeProviderJournal.EventBatch batch = f.journal().pendingEvents(f.principal, 16); JSONArray receipts = new JSONArray();
        for (NativeProviderJournal.PendingEvent event : batch.events.values()) receipts.put(NativeProviderEventReceiptsTest.receipt(event));
        f.journal().settleEvents(f.principal, batch, NativeProviderEventReceipts.validateResponse(batch, NativeProviderEventReceiptsTest.response(receipts)));
    }
    static NativeProviderPresentationTest.Fixture ready() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        f.action("displayed"); f.action("audio_started"); f.action("audio_completed"); f.action("dismissed");
        f.journal().confirmMirrorRetired(f.principal, f.presentation);
        f.journal().confirmOsCanceled(f.journal().pendingOsCancellations().get(0)); settle(f); return f;
    }
    static int compact(NativeProviderPresentationTest.Fixture f, String now) throws Exception { return f.journal().compactSettledRecords(f.principal, time(now), 16); }
    static JSONObject tombstone(NativeProviderPresentationTest.Fixture f) throws Exception { return f.f.r.f.read(ProviderEnvelopeCrypto.Domain.TOMBSTONE, f.f.payload.recordId); }
    static void mutate(NativeProviderPresentationTest.Fixture f, ProviderEnvelopeCrypto.Domain domain, String id, JSONObject value) throws Exception {
        ProviderRecordStore store = f.f.r.f.storage.store(); ProviderRecordStore.Key key = ProviderRecordStore.key(domain, id); char[] bytes = value.toString().toCharArray();
        try { store.commit(store.load().revision, Collections.singletonMap(key, bytes), Collections.emptySet()); } finally { Arrays.fill(bytes, '\0'); }
    }
    @Test public void onlyExpiredTerminalExactlySettledRecordsBecomeDedupeTombstonesAtomically() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); assertEquals(0, compact(f, NativeProviderIngressTest.NOW));
        int before = f.f.r.f.storage.memory.commits; assertEquals(1, compact(f, EXPIRED)); assertEquals(before + 1, f.f.r.f.storage.memory.commits);
        assertEquals(0, f.events()); assertEquals(0, f.f.count(ProviderEnvelopeCrypto.Domain.INBOX)); assertEquals(1, f.f.count(ProviderEnvelopeCrypto.Domain.TOMBSTONE));
        JSONObject tomb = tombstone(f); assertEquals(f.f.payload.contentHash, tomb.getString("content_sha256")); assertEquals(DEDUPE_END, tomb.getString("dedupe_until"));
        assertEquals(2, tomb.getJSONArray("admissions").length()); assertTrue(f.journal().pendingEvents(f.principal, 16).events.isEmpty());
    }
    @Test public void compactedIdentityCannotBeReanimatedByDuplicateOrChangedLongerLivedPayload() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); compact(f, EXPIRED);
        ProviderRecordStoreTest.failure("custodial_provider_payload_expired", () -> f.journal().recordArrival(f.principal, f.f.payload, NativeProviderPresentationTest.observed()));
        Map<String, String> changed = new TreeMap<>(f.f.payload.data()); changed.put("body", "changed old record");
        NativeProviderPayload conflict = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(changed));
        ProviderRecordStoreTest.failure("custodial_provider_payload_conflict", () -> f.journal().recordArrival(f.principal, conflict, NativeProviderPresentationTest.observed()));
        assertEquals(0, f.events()); assertEquals(1, f.f.count(ProviderEnvelopeCrypto.Domain.TOMBSTONE));
    }
    @Test public void exactFortyEightHourBoundaryRemovesOnlyCurrentSettledTombstoneAndOldPayloadRemainsExpired() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); compact(f, EXPIRED);
        assertEquals(0, compact(f, "2026-09-26T17:59:59.999999Z")); assertEquals(1, compact(f, DEDUPE_END));
        assertEquals(0, f.f.count(ProviderEnvelopeCrypto.Domain.TOMBSTONE));
        ProviderRecordStoreTest.failure("custodial_provider_payload_expired", () -> f.journal().recordArrival(f.principal, f.f.payload, time(DEDUPE_END)));
    }
    @Test public void missingClockOrAnyPendingEffectReceiptAudioOrNavigationPreservesRecords() throws Exception {
        for (String pending : new String[]{"receipt", "display", "os", "mirror", "audio", "navigation", "nonterminal"}) {
            NativeProviderPresentationTest.Fixture f = ready(); JSONObject record = f.record();
            switch (pending) {
                case "receipt": {
                    String id = record.getString("received_event_id"); JSONObject event = f.f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, id);
                    event.put("state", "PENDING"); event.remove("admission"); mutate(f, ProviderEnvelopeCrypto.Domain.EVENT, id, event); break;
                }
                case "display": record.put("display_state", "DISPLAY_UNCERTAIN"); break;
                case "os": record.put("os_cancel_pending", true); break;
                case "mirror": record.put("mirror_retire_pending", true); break;
                case "audio": record.put("audio_state", "IN_PROGRESS"); break;
                case "navigation": record.put("navigation_pending", true); break;
                case "nonterminal": record.put("card_dismissed", false); break;
            }
            if (!pending.equals("receipt")) mutate(f, ProviderEnvelopeCrypto.Domain.INBOX, f.f.payload.recordId, record);
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw); assertEquals(pending, 0, compact(f, EXPIRED)); assertEquals(before, f.f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure("custodial_provider_compaction_unavailable", () -> f.journal().compactSettledRecords(f.principal, time(null), 16));
        }
    }
    @Test public void alteredStoredAdmissionFailsClosedWithoutDeletingOriginalWork() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); String id = f.record().getString("received_event_id"); JSONObject event = f.f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, id);
        event.getJSONObject("admission").put("content_sha256", "f".repeat(64)); mutate(f, ProviderEnvelopeCrypto.Domain.EVENT, id, event);
        Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_journal_corrupt_preserved", () -> compact(f, EXPIRED)); assertEquals(before, f.f.r.f.storage.memory.raw);
    }
    @Test public void foreignRecordsAndTombstonesAreFencedAndNeverEvictedByANewPrincipal() throws Exception {
        for (boolean compactFirst : new boolean[]{false, true}) {
            NativeProviderPresentationTest.Fixture f = ready(); if (compactFirst) compact(f, EXPIRED); f.journal().observeRemoved();
            NativeProviderPrincipal other = NativeProviderJournalTest.v2(); f.journal().observeActivePrincipal(other);
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
            assertEquals(0, f.journal().compactSettledRecords(other, time("2026-10-01T00:00:00.000000Z"), 16)); assertEquals(before, f.f.r.f.storage.memory.raw);
            assertEquals("REVOKED_OR_FOREIGN", (compactFirst ? tombstone(f) : f.record()).getString("authority_state"));
        }
    }
    @Test public void malformedTombstoneCannotShortenRetentionEvenWithValidEncryption() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); compact(f, EXPIRED); JSONObject tomb = tombstone(f);
        tomb.put("dedupe_until", EXPIRED); mutate(f, ProviderEnvelopeCrypto.Domain.TOMBSTONE, f.f.payload.recordId, tomb);
        Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_journal_corrupt_preserved", () -> compact(f, EXPIRED)); assertEquals(before, f.f.r.f.storage.memory.raw);
    }
    @Test public void ambiguousCompactionReadbackStillPreservesDedupeAndCannotCreateAnotherReceipt() throws Exception {
        NativeProviderPresentationTest.Fixture f = ready(); f.f.r.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> compact(f, EXPIRED));
        f.f.r.f.storage.memory.persistThenReject = false; int before = f.f.r.f.storage.memory.commits;
        assertEquals(0, compact(f, EXPIRED)); assertEquals(before, f.f.r.f.storage.memory.commits); assertEquals(1, f.f.count(ProviderEnvelopeCrypto.Domain.TOMBSTONE));
        ProviderRecordStoreTest.failure("custodial_provider_payload_expired", () -> f.journal().recordArrival(f.principal, f.f.payload, time(EXPIRED)));
    }
}
