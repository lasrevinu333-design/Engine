package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual SQL receipt bytes against the native request/receipt/settlement owners.
 * Encrypted input events/generation are explicitly seeded synthetic journal
 * fixtures, NOT runtime generation/ingress or qualified observation evidence. */
public final class NativeProviderEventSqlWireTest {
    private static final class Fixture {
        final JSONObject sql;
        final NativeProviderJournalTest.Fixture nativeStore = new NativeProviderJournalTest.Fixture();
        final NativeProviderPrincipal principal;
        final NativeProviderJournal.EventBatch batch;
        Fixture() throws Exception {
            String path = System.getenv("NATIVE_PROVIDER_EVENTS_FIXTURE");
            assertNotNull("Actual emitted SQL fixture required; no skipped PASS", path);
            sql = new JSONObject(new String(Files.readAllBytes(Path.of(path)), StandardCharsets.UTF_8));
            principal = NativeProviderPrincipal.fromNativeJournal(sql.getJSONObject("nativePrincipal"));
            nativeStore.journal().observeActivePrincipal(principal);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            JSONArray events = sql.getJSONObject("request").getJSONArray("events");
            for (int i = 0; i < events.length(); i++) {
                JSONObject wire = events.getJSONObject(i), stored = new JSONObject(wire.toString());
                stored.put("schema", "custodial.native-provider-journal.v1").put("interval_version", 2).put("state", "PENDING").put("authority_state", "CURRENT")
                    .put("principal", principal.json()).put("receipt_assignment_epoch", Long.toString(wire.getLong("receipt_assignment_epoch")));
                writes.put(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.EVENT, wire.getString("event_id")), stored.toString().toCharArray());
                JSONObject generation = new JSONObject().put("schema", "custodial.native-provider-journal.v1").put("state", "CONFIRMED")
                    .put("principal", principal.json()).put("token_digest", wire.get("token_digest"));
                writes.put(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.GENERATION, wire.getString("generation_id")), generation.toString().toCharArray());
            }
            ProviderRecordStore store = nativeStore.storage.store();
            store.commit(store.load().revision, writes, Collections.emptySet());
            batch = nativeStore.journal().pendingEvents(principal, 16);
            assertEquals(4, batch.events.size());
            JSONObject emitted = ProviderWireJson.object(batch.body(), 65536);
            for (int i = 0; i < events.length(); i++) {
                JSONObject expected = events.getJSONObject(i);
                assertTrue(ProviderWireJson.same(expected, batch.events.get(expected.getString("event_id")).wire()));
            }
            assertEquals("custodial.native-provider-events.v2", emitted.getString("schema"));
        }
        NativeProviderEventReceipts parse(JSONObject body) throws Exception {
            return NativeProviderEventReceipts.validateResponse(batch, new AuthorizedResponse(200, Map.of("content-type", "application/json; charset=utf-8"),
                body.toString().getBytes(StandardCharsets.UTF_8)));
        }
    }
    @Test public void exactSqlAdmissionAndLostResponseReplaySettleWithoutRewritingOriginalObservation() throws Exception {
        Fixture f = new Fixture();
        assertEquals(4, f.parse(f.sql.getJSONObject("admitted")).admittedIds().size());
        f.nativeStore.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.nativeStore.journal().settleEvents(f.principal, f.batch, f.parse(f.sql.getJSONObject("admitted"))));
        f.nativeStore.storage.memory.persistThenReject = false;
        int commits = f.nativeStore.storage.memory.commits;
        assertEquals(4, f.nativeStore.journal().settleEvents(f.principal, f.batch, f.parse(f.sql.getJSONObject("replay"))));
        assertEquals(commits, f.nativeStore.storage.memory.commits);
        assertEquals(0, f.nativeStore.journal().pendingEvents(f.principal, 16).events.size());
        for (NativeProviderJournal.PendingEvent e : f.batch.events.values()) {
            JSONObject stored = f.nativeStore.read(ProviderEnvelopeCrypto.Domain.EVENT, e.id);
            assertEquals("SETTLED", stored.getString("state"));
            assertTrue(ProviderWireJson.same(e.wire().getJSONObject("original_observation"), stored.getJSONObject("admission").getJSONObject("original_observation")));
        }
    }
    @Test public void actualSqlMixedReplyAndMissingItemsLeaveOtherEventsPending() throws Exception {
        Fixture f = new Fixture();
        assertEquals(1, f.nativeStore.journal().settleEvents(f.principal, f.batch, f.parse(f.sql.getJSONObject("mixed"))));
        assertEquals(3, f.nativeStore.journal().pendingEvents(f.principal, 16).events.size());
        JSONObject empty = new JSONObject().put("ok", true).put("data", new JSONObject().put("schema", "custodial.native-provider-event-receipts.v2").put("results", new JSONArray()));
        assertTrue(f.parse(empty).admittedIds().isEmpty());
    }
    @Test public void sqlReceiptCannotSettleAlteredObservationForeignGenerationOrRetiredCallback() throws Exception {
        for (String field : new String[]{"generation_id", "content_sha256", "receipt_credential_id", "original_observation"}) {
            Fixture f = new Fixture(); JSONObject changed = new JSONObject(f.sql.getJSONObject("admitted").toString());
            for (int i = 0; i < changed.getJSONObject("data").getJSONArray("results").length(); i++) {
                JSONObject item = changed.getJSONObject("data").getJSONArray("results").getJSONObject(i);
                if (field.equals("original_observation")) item.getJSONObject(field).put("elapsed_realtime_ms", 9999);
                else item.put(field, field.endsWith("id") ? "99000000-0000-4000-8000-000000000001" : "f".repeat(64));
            }
            assertTrue(f.parse(changed).admittedIds().isEmpty());
        }
        Fixture f = new Fixture(); NativeProviderEventReceipts accepted = f.parse(f.sql.getJSONObject("admitted"));
        f.nativeStore.journal().observeUnavailable(); f.nativeStore.journal().observeActivePrincipal(f.principal);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.nativeStore.journal().settleEvents(f.principal, f.batch, accepted));
        assertEquals(4, f.nativeStore.journal().pendingEvents(f.principal, 16).events.size());
    }
}
