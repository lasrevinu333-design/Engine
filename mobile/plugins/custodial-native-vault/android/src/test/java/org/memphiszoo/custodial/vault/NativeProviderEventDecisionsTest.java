package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual native request/receipt/journal/engine; all server replies are explicitly
 * synthetic. No SQL/real network/clock qualification or delivery credit. */
public final class NativeProviderEventDecisionsTest {
    static final String RID = NativeProviderHttpTest.RID;
    static NativeProviderEventDecisions.Query query(NativeProviderIngressTest.Fixture f) throws Exception {
        return f.r.f.journal().prepareEventDecisions(f.r.principal, NativeProviderEventReceiptsTest.batch(f));
    }
    static JSONObject accepted(NativeProviderJournal.PendingEvent event) throws Exception {
        return new JSONObject().put("event_id", event.id).put("decision", "ORIGINAL_ACCEPTED")
            .put("receipt", NativeProviderEventReceiptsTest.receipt(event).put("replayed", true));
    }
    static JSONObject envelope(NativeProviderEventDecisions.Query query, JSONArray results) throws Exception {
        return new JSONObject().put("ok", true).put("data", new JSONObject().put("schema", "custodial.native-provider-event-decisions.v1")
            .put("native_request_id", RID).put("request_body_sha256", query.bodySha256).put("requester", query.requester()).put("results", results));
    }
    static NativeProviderEventDecisions.Exchange exchange(NativeProviderEventDecisions.Query query, JSONObject body) throws Exception {
        return new NativeProviderEventDecisions.Exchange(new AuthorizedResponse(200, Map.of("content-type", "application/json; charset=utf-8"),
            body.toString().getBytes(StandardCharsets.UTF_8)), RID, NativeProviderEventDecisions.PATH, query.bodySha256);
    }
    static NativeProviderEventReceipts validate(NativeProviderEventDecisions.Query query, JSONObject... results) throws Exception {
        JSONArray rows = new JSONArray(); for (JSONObject result : results) rows.put(result);
        return NativeProviderEventDecisions.validate(query, exchange(query, envelope(query, rows)));
    }
    interface Change { void change(JSONObject value) throws Exception; }
    static void rejected(ProviderRecordStoreTest.Attempt action) throws Exception {
        try { action.run(); fail("must reject without settlement"); } catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
    }
    @Test public void queryHasOnlyCurrentRequesterAndExactOriginalsAndReturnedBytesCannotMutateIt() throws Exception {
        NativeProviderIngressTest.Fixture f = NativeProviderEventReceiptsTest.fixture(); Map<String,Object> before = new HashMap<>(f.r.f.storage.memory.raw);
        try (NativeProviderEventDecisions.Query q = query(f)) {
            AuthorizedRequest a = q.request(); JSONObject body = ProviderWireJson.object(a.body, 65536);
            assertEquals(NativeProviderEventDecisions.PATH, a.path); assertEquals("POST", a.method);
            assertEquals(3, body.length()); assertEquals(7, body.getJSONObject("requester").length());
            assertEquals(f.r.prepared.generationId, body.getJSONObject("requester").getString("current_generation_id"));
            assertTrue(ProviderWireJson.same(q.batch.events.values().iterator().next().wire(), body.getJSONArray("events").getJSONObject(0)));
            assertFalse(new String(a.body, StandardCharsets.UTF_8).contains("installation_seal"));
            Arrays.fill(a.body, (byte)0); assertNotEquals(0, q.request().body[0]); q.requester().put("assignment_epoch", 999);
            assertEquals(f.r.principal.json().getLong("assignment_epoch"), q.requester().getLong("assignment_epoch")); assertEquals(before, f.r.f.storage.memory.raw);
            q.close(); ProviderRecordStoreTest.failure("custodial_provider_operation_closed", q::request);
        }
    }
    @Test public void originalAcceptedSettlesOnlyOriginalRecordAndLeavesAllPresentationBytes() throws Exception {
        NativeProviderIngressTest.Fixture f = NativeProviderEventReceiptsTest.fixture(); JSONObject inbox = f.read(ProviderEnvelopeCrypto.Domain.INBOX);
        try (NativeProviderEventDecisions.Query q = query(f)) {
            NativeProviderJournal.PendingEvent e = q.batch.events.values().iterator().next();
            assertTrue(f.r.f.journal().settleEventDecisions(f.r.principal, q, validate(q, accepted(e))).events.isEmpty());
            assertEquals("SETTLED", f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, e.id).getString("state"));
            assertTrue(ProviderWireJson.same(inbox, f.read(ProviderEnvelopeCrypto.Domain.INBOX))); assertEquals(1, f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        }
    }
    @Test public void unresolvedAndMissingKeepOriginalBytesAndReturnOnlyQueriedPendingEvents() throws Exception {
        for (boolean omit : new boolean[]{false,true}) {
            NativeProviderIngressTest.Fixture f = NativeProviderEventReceiptsTest.fixture();
            try (NativeProviderEventDecisions.Query q = query(f)) {
                NativeProviderJournal.PendingEvent e = q.batch.events.values().iterator().next(); Map<String,String> next = new java.util.TreeMap<>(f.payload.data());
                next.put("receipt_job_id", "77000000-0000-4000-8000-000000000099"); f.r.f.journal().recordArrival(f.r.principal,
                    NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(next)), NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW,301,7));
                Map<String,Object> before = new HashMap<>(f.r.f.storage.memory.raw);
                NativeProviderEventReceipts r = omit ? validate(q) : validate(q,new JSONObject().put("event_id",e.id).put("decision","UNRESOLVED"));
                NativeProviderJournal.EventBatch remaining = f.r.f.journal().settleEventDecisions(f.r.principal,q,r);
                assertEquals(Set.of(e.id), remaining.events.keySet()); assertEquals(2, NativeProviderEventReceiptsTest.batch(f).events.size());
                assertEquals(before,f.r.f.storage.memory.raw); assertArrayEquals(q.batch.body(),remaining.body());
            }
        }
    }
    @Test public void mixedBatchSettlesOnlyExactPositivesWithoutInventingMissingResults() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture(); Map<String,String> next=new java.util.TreeMap<>(f.payload.data());
        next.put("receipt_job_id","77000000-0000-4000-8000-000000000099"); f.r.f.journal().recordArrival(f.r.principal,NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(next)),NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW,301,7));
        try(NativeProviderEventDecisions.Query q=query(f)){java.util.Iterator<NativeProviderJournal.PendingEvent> it=q.batch.events.values().iterator();NativeProviderJournal.PendingEvent first=it.next(),second=it.next();
            NativeProviderJournal.EventBatch remaining=f.r.f.journal().settleEventDecisions(f.r.principal,q,validate(q,accepted(first)));
            assertEquals(Set.of(second.id),remaining.events.keySet()); assertEquals("PENDING",f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT,second.id).getString("state"));}
    }
    @Test public void everyFreshBindingAndEnvelopeMismatchRejectsBeforeAnyWrite() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();
        try(NativeProviderEventDecisions.Query q=query(f)){
            JSONObject good=envelope(q,new JSONArray().put(accepted(q.batch.events.values().iterator().next())));
            for(Change change:new Change[]{v->v.put("ok",false),v->v.put("extra",true),v->v.getJSONObject("data").put("extra",true),
                v->v.getJSONObject("data").put("native_request_id",NativeProviderHttpTest.OP),v->v.getJSONObject("data").put("request_body_sha256","0".repeat(64)),
                v->v.getJSONObject("data").put("schema","other"),v->v.getJSONObject("data").getJSONObject("requester").put("assignment_epoch",8),
                v->v.getJSONObject("data").getJSONObject("requester").put("token_digest","0".repeat(64)),v->v.getJSONObject("data").getJSONObject("requester").put("extra",true)}){
                JSONObject bad=new JSONObject(good.toString());change.change(bad);Map<String,Object> before=new HashMap<>(f.r.f.storage.memory.raw);
                rejected(()->NativeProviderEventDecisions.validate(q,exchange(q,bad)));assertEquals(before,f.r.f.storage.memory.raw);
            }
        }
    }
    @Test public void duplicateForeignMalformedAndTerminalDecisionsCannotSettle() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();try(NativeProviderEventDecisions.Query q=query(f)){
            JSONObject good=accepted(q.batch.events.values().iterator().next());
            rejected(()->validate(q,good,good));
            for(Change change:new Change[]{v->v.put("event_id",NativeProviderHttpTest.OP),v->v.put("decision","PERMANENTLY_DENIED"),
                v->v.put("decision","UNRESOLVED"),v->v.put("extra",true),v->v.getJSONObject("receipt").put("replayed",false),
                v->v.getJSONObject("receipt").put("generation_id",NativeProviderHttpTest.OP),v->v.getJSONObject("receipt").put("receipt_employee_id",NativeProviderHttpTest.OP),
                v->v.getJSONObject("receipt").put("receipt_assignment_epoch","7"),v->v.getJSONObject("receipt").getJSONObject("original_observation").put("boot_count",8),
                v->v.getJSONObject("receipt").put("server_received_at","2000-01-01T00:00:00.000000Z")}){
                JSONObject bad=new JSONObject(good.toString());change.change(bad);rejected(()->validate(q,bad));
            }
            assertEquals(1,NativeProviderEventReceiptsTest.batch(f).events.size());
            NativeProviderJournal.PendingEvent event=q.batch.events.values().iterator().next();
            JSONObject numeric=accepted(event).getJSONObject("receipt").put("receipt_assignment_epoch",7.0);
            assertTrue(numeric.get("receipt_assignment_epoch") instanceof Double);
            // JSONObject serializes an integral Double as integer JSON; test the
            // actual typed receipt boundary directly instead of asserting that
            // a valid serialized integer is still a hostile floating object.
            rejected(()->NativeProviderEventReceipts.originalAcceptances(q.batch,Map.of(event.id,numeric)));
        }
    }
    @Test public void noHttpStatusContentTypeOrMalformedJsonIsASettlement() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();try(NativeProviderEventDecisions.Query q=query(f)){
            byte[] bytes=envelope(q,new JSONArray().put(accepted(q.batch.events.values().iterator().next()))).toString().getBytes(StandardCharsets.UTF_8);
            for(int status:new int[]{201,302,400,401,403,409,503})rejected(()->NativeProviderEventDecisions.validate(q,new NativeProviderEventDecisions.Exchange(new AuthorizedResponse(status,Map.of("content-type","application/json"),bytes),RID,NativeProviderEventDecisions.PATH,q.bodySha256)));
            for(byte[] body:new byte[][]{"<html>ok</html>".getBytes(StandardCharsets.UTF_8),"{}".getBytes(StandardCharsets.UTF_8),new byte[262145],new String(bytes,StandardCharsets.UTF_8).replace("\"ok\":true","\"ok\":true,\"ok\":false").getBytes(StandardCharsets.UTF_8)})
                rejected(()->NativeProviderEventDecisions.validate(q,new NativeProviderEventDecisions.Exchange(new AuthorizedResponse(200,Map.of("content-type","application/json"),body),RID,NativeProviderEventDecisions.PATH,q.bodySha256)));
            for(Map<String,String> headers:java.util.List.of(Map.<String,String>of(),Map.of("content-type","text/plain"),Map.of("content-type","application/json","Content-Type","application/json")))
                rejected(()->NativeProviderEventDecisions.validate(q,new NativeProviderEventDecisions.Exchange(new AuthorizedResponse(200,headers,bytes),RID,NativeProviderEventDecisions.PATH,q.bodySha256)));
            assertEquals(1,NativeProviderEventReceiptsTest.batch(f).events.size());
        }
    }
    @Test public void samePrincipalRotationQueriesNewRequesterButPreservesRetiredOriginalGeneration() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture(); f.r.f.journal().captureToken("rotated-only-synthetic");
        NativeProviderJournal.Prepared next=f.r.f.journal().prepareRegistration(f.r.principal,NativeProviderJournalTest.app());
        f.r.f.journal().confirmRegistration(f.r.principal,next,NativeProviderRegistrationReceipt.validateResponse(next,NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next,f.r.prepared.generationId,NativeProviderIngressTest.RETIRE))));
        try(NativeProviderEventDecisions.Query q=query(f)){assertEquals(next.generationId,q.requester().getString("current_generation_id"));
            NativeProviderJournal.PendingEvent old=q.batch.events.values().iterator().next();assertEquals(f.r.prepared.generationId,old.wire().getString("generation_id"));
            assertNotEquals(q.requester().getString("token_digest"),old.wire().getString("token_digest"));
            assertTrue(f.r.f.journal().settleEventDecisions(f.r.principal,q,validate(q,accepted(old))).events.isEmpty());}
    }
    @Test public void removedForeignReturnedAndGenerationChangedScopesCannotConsumeLateReply() throws Exception {
        for(String edge:new String[]{"removed","foreign","returned","rotation"}){
            NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();try(NativeProviderEventDecisions.Query q=query(f)){
                NativeProviderEventReceipts r=validate(q,accepted(q.batch.events.values().iterator().next()));
                if(edge.equals("removed"))f.r.f.journal().observeRemoved();else if(edge.equals("foreign"))f.r.f.journal().observeActivePrincipal(NativeProviderPrincipal.fromNativeJournal(f.r.principal.json().put("assignment_epoch",8)));
                else if(edge.equals("returned")){f.r.f.journal().observeUnavailable();f.r.f.journal().observeActivePrincipal(f.r.principal);}else{f.r.f.journal().captureToken("next");f.r.f.journal().prepareRegistration(f.r.principal,NativeProviderJournalTest.app());}
                Map<String,Object> before=new HashMap<>(f.r.f.storage.memory.raw);rejected(()->f.r.f.journal().settleEventDecisions(f.r.principal,q,r));assertEquals(before,f.r.f.storage.memory.raw);
            }
        }
    }
    @Test public void failedAndUnknownCommitKeepOriginalReceiptAndIdempotentReadback() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();try(NativeProviderEventDecisions.Query q=query(f)){
            NativeProviderEventReceipts r=validate(q,accepted(q.batch.events.values().iterator().next()));Map<String,Object> before=new HashMap<>(f.r.f.storage.memory.raw);
            f.r.f.storage.memory.reject=true;rejected(()->f.r.f.journal().settleEventDecisions(f.r.principal,q,r));assertEquals(before,f.r.f.storage.memory.raw);
            f.r.f.storage.memory.reject=false;f.r.f.storage.memory.persistThenReject=true;rejected(()->f.r.f.journal().settleEventDecisions(f.r.principal,q,r));
            f.r.f.storage.memory.persistThenReject=false;int commits=f.r.f.storage.memory.commits;
            assertTrue(f.r.f.journal().settleEventDecisions(f.r.principal,q,r).events.isEmpty());assertEquals(commits,f.r.f.storage.memory.commits);
        }
    }
    @Test public void decisionExchangeCannotEnterClockAuthorityOrGenericBridge() throws Exception {
        NativeProviderIngressTest.Fixture f=NativeProviderEventReceiptsTest.fixture();try(NativeProviderEventDecisions.Query q=query(f)){
            ProviderRecordStoreTest.failure("custodial_native_provider_path_refused",()->RequestPolicy.validate(q.request(),"KIOSK_08"));
            rejected(()->new NativeProviderClockExchange(exchange(q,envelope(q,new JSONArray())).response,RID,NativeProviderEventDecisions.PATH,q.bodySha256,new NativeProviderClockExchange.Point(100,7),new NativeProviderClockExchange.Point(101,7)));
        }
    }
}
