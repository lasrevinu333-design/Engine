package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Three phases: actual Java query preparation; separate synthetic SQL/HMAC;
 * actual Java consumption. No reply nonce/hash rewriting or native authority
 * qualification. Exported plaintext records are ONLY newly created test data. */
public final class NativeProviderEventDecisionSqlWireTest {
    static final String TOKEN = "synthetic-F6-Java-query-token-not-production";
    static final String FILE = "native-provider-event-decision-input.json";
    static String sha(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) out.append(String.format("%02x", b & 255));
        return out.toString();
    }
    static JSONArray records(ProviderRecordStore store) throws Exception {
        ProviderRecordStore.Snapshot snapshot = store.load(); JSONArray rows = new JSONArray();
        for (ProviderRecordStore.Key key : snapshot.keys()) {
            char[] value = snapshot.read(key);
            try { rows.put(new JSONObject().put("domain", key.domain.name()).put("id", key.id).put("json", new String(value))); }
            finally { Arrays.fill(value, '\0'); }
        }
        return rows;
    }
    static JSONObject preparedCase(NativeProviderJournalTest.Fixture f, NativeProviderPrincipal principal, JSONObject registration, JSONObject receipt, NativeProviderPayload payload) throws Exception {
        try (NativeProviderEventDecisions.Query query = f.journal().prepareEventDecisions(principal, f.journal().pendingEvents(principal,16))) {
            byte[] body=query.request().body;assertEquals(sha(body),query.bodySha256);
            return new JSONObject().put("seed",new JSONObject().put("principal",principal.json()).put("registration",registration)
                .put("registration_receipt",receipt).put("payload",payload.json()).put("journal_revision",f.storage.store().load().revision).put("records",records(f.storage.store())))
                .put("query",new JSONObject().put("path",NativeProviderEventDecisions.PATH).put("method","POST")
                    .put("body_base64",Base64.getEncoder().encodeToString(body)).put("body_sha256",query.bodySha256));
        }
    }
    // This entrypoint never performs HTTP or consumes a synthetic server
    // acceptance. Registration/producer/time inputs are explicitly synthetic.
    public static void main(String[] args) throws Exception {
        assertEquals(1, args.length); Path directory = Path.of(args[0]);
        assertTrue(directory.isAbsolute()); assertEquals(directory, directory.toRealPath());
        NativeProviderJournalTest.Fixture f = new NativeProviderJournalTest.Fixture();
        NativeProviderPrincipal principal = NativeProviderJournalTest.v1();
        NativeProviderJournal journal = f.journal();
        journal.captureToken(TOKEN); journal.observeActivePrincipal(principal);
        NativeProviderAppIdentity app = NativeProviderAppIdentity.fromPackaged("org.memphiszoo.custodial", "synthetic", 53, NativeProviderAppIdentityTest.packaged(53));
        NativeProviderJournal.Prepared prepared = journal.prepareRegistration(principal, app);
        JSONObject registration;
        try (NativeProviderJournal.Registration op = journal.registrationRequest(principal, prepared, false)) {
            registration = ProviderWireJson.object(op.request().body, 65536);
        }
        JSONObject receipt = NativeProviderRegistrationReceiptTest.data(prepared, null, NativeProviderRegistrationReceiptTest.TIME);
        journal.confirmRegistration(principal, prepared, NativeProviderRegistrationReceipt.validateResponse(prepared, NativeProviderRegistrationReceiptTest.response(receipt)));
        NativeProviderPayload payload = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.lunch(prepared));
        assertTrue(journal.recordArrival(principal, payload, NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 101, 7)).newlyAdmitted);
        NativeProviderJournal.Presentation presentation = journal.presentation(principal, payload.recordId);
        int elapsed = 102;
        for (String action : new String[]{"displayed", "opened", "acknowledged"})
            journal.applyPresentationAction(principal, presentation, action, NativeProviderIngressTest.observation("2026-09-24T17:00:00.223457Z", elapsed++, 7));
        assertEquals(4,journal.pendingEvents(principal,16).events.size());
        JSONObject output=preparedCase(f,principal,registration,receipt,payload);
        Map<String,String> unadmitted=new TreeMap<>(payload.data());unadmitted.put("receipt_job_id","77000000-0000-4000-8000-000000000099");
        NativeProviderPayload missing=NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(unadmitted));
        assertTrue(journal.recordArrival(principal,missing,NativeProviderIngressTest.observation("2026-09-24T17:00:00.323457Z",110,7)).newlyAdmitted);
        assertEquals(5,journal.pendingEvents(principal,16).events.size());
        output.put("unresolved",preparedCase(f,principal,registration,receipt,payload));
        Files.write(directory.resolve(FILE), (output.toString() + "\n").getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE_NEW);
        System.out.println("NATIVE_DECISION_QUERY_PREPARED_SYNTHETIC_ONLY");
    }
    static final class Fixture implements AutoCloseable {
        final JSONObject wire, input;
        final NativeProviderJournalTest.Fixture f = new NativeProviderJournalTest.Fixture();
        final NativeProviderPrincipal principal;
        final NativeProviderEventDecisions.Query query;
        Fixture() throws Exception { this(false); }
        Fixture(boolean missing) throws Exception {
            String file = System.getenv("NATIVE_PROVIDER_EVENT_DECISION_FIXTURE"); assertNotNull("explicit actual SQL fixture required; never skipped", file);
            wire = ProviderWireJson.object(Files.readAllBytes(Path.of(file)), 2097152);
            assertEquals("custodial.native-provider-event-decision-wire-fixture.v1", wire.getString("schema"));
            assertTrue(wire.getBoolean("actual_sql")); assertTrue(wire.getBoolean("actual_http_hmac")); assertTrue(wire.getBoolean("cleanup_verified"));
            assertFalse(wire.getBoolean("production")); assertTrue(wire.getBoolean("synthetic"));
            JSONObject prepared=wire.getJSONObject("native_input");input=missing?prepared.getJSONObject("unresolved"):prepared; JSONObject seed = input.getJSONObject("seed");
            principal = NativeProviderPrincipal.fromNativeJournal(seed.getJSONObject("principal"));
            long revision = seed.getLong("journal_revision"); assertTrue(revision > 0 && revision <= 32);
            ProviderRecordStore store = f.storage.store();
            for (long n = 1; n < revision; n++) store.commit(store.load().revision, Collections.emptyMap(), Collections.emptySet());
            Map<ProviderRecordStore.Key,char[]> writes = new TreeMap<>(); JSONArray rows = seed.getJSONArray("records");
            assertTrue(rows.length() > 4 && rows.length() <= 32);
            try {
                for (int i = 0; i < rows.length(); i++) { JSONObject row = rows.getJSONObject(i);
                    ProviderRecordStore.Key key = ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.valueOf(row.getString("domain")), row.getString("id"));
                    assertFalse(writes.containsKey(key)); writes.put(key, row.getString("json").toCharArray()); }
                store.commit(store.load().revision, writes, Collections.emptySet());
            } finally { for (char[] value : writes.values()) Arrays.fill(value, '\0'); }
            assertEquals(revision, store.load().revision);
            query = f.journal().prepareEventDecisions(principal, f.journal().pendingEvents(principal, 16));
            assertArrayEquals(Base64.getDecoder().decode(input.getJSONObject("query").getString("body_base64")), query.request().body);
            assertEquals(input.getJSONObject("query").getString("body_sha256"), query.bodySha256);
        }
        NativeProviderEventDecisions.Exchange exchange(String which) throws Exception {
            JSONObject row = wire.getJSONObject(which); byte[] raw = Base64.getDecoder().decode(row.getString("body_base64"));
            assertEquals(row.getString("body_sha256"), sha(raw)); assertEquals(query.bodySha256, row.getString("request_body_sha256"));
            return new NativeProviderEventDecisions.Exchange(new AuthorizedResponse(row.getInt("status"), Map.of("content-type", row.getString("content_type")), raw),
                row.getString("request_id"), NativeProviderEventDecisions.PATH, row.getString("request_body_sha256"));
        }
        NativeProviderEventReceipts receipts(String which) throws Exception { return NativeProviderEventDecisions.validate(query, exchange(which)); }
        Map<String,String> nonEvents() throws Exception {
            Map<String,String> result = new TreeMap<>(); JSONArray rows = records(f.storage.store());
            for (int i = 0; i < rows.length(); i++) { JSONObject row = rows.getJSONObject(i); if (!"EVENT".equals(row.getString("domain"))) result.put(row.getString("domain")+":"+row.getString("id"), row.getString("json")); }
            return result;
        }
        public void close() { query.close(); }
    }
    @Test public void actualSqlCurrentHmacResponseSettlesOnlyFourExactJavaOriginals() throws Exception {
        try (Fixture f = new Fixture()) { Map<String,String> protectedRecords = f.nonEvents();
            assertEquals(4, f.query.batch.events.size());
            assertTrue(f.f.journal().settleEventDecisions(f.principal, f.query, f.receipts("first")).events.isEmpty());
            for (String id : f.query.batch.events.keySet()) assertEquals("SETTLED", f.f.read(ProviderEnvelopeCrypto.Domain.EVENT,id).getString("state"));
            assertEquals(protectedRecords, f.nonEvents());
        }
    }
    @Test public void actualFreshHttpRetryAfterLostResponsePreservesOriginalIdentity() throws Exception {
        try (Fixture f = new Fixture()) {
            assertNotEquals(f.wire.getJSONObject("first").getString("request_id"), f.wire.getJSONObject("retry").getString("request_id"));
            Map<String,Object> before = new HashMap<>(f.f.storage.memory.raw);
            f.receipts("first"); assertEquals(before, f.f.storage.memory.raw); // Validation alone is not settlement.
            assertTrue(f.f.journal().settleEventDecisions(f.principal,f.query,f.receipts("retry")).events.isEmpty());
            int commits = f.f.storage.memory.commits;
            assertTrue(f.f.journal().settleEventDecisions(f.principal,f.query,f.receipts("first")).events.isEmpty());
            assertEquals(commits, f.f.storage.memory.commits);
        }
    }
    @Test public void actualUnresolvedOriginalRemainsPendingByteExactWhileAcceptedSettle() throws Exception {
        try (Fixture f=new Fixture(true)) {
            Map<String,String> protectedRecords=f.nonEvents();Map<String,String> originals=new HashMap<>();
            for(String id:f.query.batch.events.keySet())originals.put(id,f.f.read(ProviderEnvelopeCrypto.Domain.EVENT,id).toString());
            NativeProviderJournal.EventBatch remaining=f.f.journal().settleEventDecisions(f.principal,f.query,f.receipts("unresolved"));
            assertEquals(1,remaining.events.size());String id=remaining.events.keySet().iterator().next();
            assertEquals(originals.get(id),f.f.read(ProviderEnvelopeCrypto.Domain.EVENT,id).toString());assertEquals(protectedRecords,f.nonEvents());
        }
    }
    @Test public void actualResponseCannotBeReboundToAnotherNonceBodyOrRequester() throws Exception {
        try (Fixture f = new Fixture()) { NativeProviderEventDecisions.Exchange original = f.exchange("first");
            Map<String,Object> before = new HashMap<>(f.f.storage.memory.raw);
            for (String bad : new String[]{"nonce","body","requester"}) {
                AuthorizedResponse response = original.response;
                if (bad.equals("requester")) { JSONObject value = ProviderWireJson.object(response.body,262144); value.getJSONObject("data").getJSONObject("requester").put("assignment_epoch",99);
                    response = new AuthorizedResponse(200,Map.of("content-type","application/json"),value.toString().getBytes(StandardCharsets.UTF_8)); }
                NativeProviderEventDecisions.Exchange crossed = new NativeProviderEventDecisions.Exchange(response,
                    bad.equals("nonce") ? "44000000-0000-4000-8000-000000000099" : original.requestId, NativeProviderEventDecisions.PATH,
                    bad.equals("body") ? "0".repeat(64) : original.bodySha256);
                NativeProviderEventDecisionsTest.rejected(() -> NativeProviderEventDecisions.validate(f.query,crossed));
                assertEquals(before,f.f.storage.memory.raw);
            }
        }
    }
    @Test public void currentRemovalOrRotationFencesLateActualResponseWithoutWrites() throws Exception {
        for (boolean removal : new boolean[]{false,true}) try (Fixture f = new Fixture()) {
            NativeProviderEventReceipts accepted = f.receipts("first");
            if (removal) f.f.journal().observeRemoved(); else { f.f.journal().captureToken("synthetic-next-token"); f.f.journal().prepareRegistration(f.principal,NativeProviderJournalTest.app()); }
            Map<String,Object> before = new HashMap<>(f.f.storage.memory.raw);
            NativeProviderEventDecisionsTest.rejected(() -> f.f.journal().settleEventDecisions(f.principal,f.query,accepted));
            assertEquals(before,f.f.storage.memory.raw);
        }
    }
    @Test public void actualReceiptAmbiguousCommitReadbackDoesNotAppendOrReplayEffects() throws Exception {
        try (Fixture f = new Fixture()) { Map<String,String> protectedRecords = f.nonEvents(); NativeProviderEventReceipts accepted=f.receipts("first");
            f.f.storage.memory.persistThenReject=true;
            NativeProviderEventDecisionsTest.rejected(() -> f.f.journal().settleEventDecisions(f.principal,f.query,accepted));
            f.f.storage.memory.persistThenReject=false; int commits=f.f.storage.memory.commits;
            assertTrue(f.f.journal().settleEventDecisions(f.principal,f.query,f.receipts("retry")).events.isEmpty());
            assertEquals(commits,f.f.storage.memory.commits);assertEquals(protectedRecords,f.nonEvents());
        }
    }
}
