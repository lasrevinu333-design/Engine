package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.time.Instant;
import org.json.JSONObject;
import org.junit.Test;

/** Synthetic timing/retention protocol tests, not hardware accuracy evidence. */
public final class NativeProviderBestEffortTest {
    private static final long S=1794574800000000L;
    private static NativeProviderTime.Profile policy() throws Exception {
        return NativeProviderTime.Profile.androidBestEffort("android-test",NativeProviderTimeTest.platform(),"a".repeat(64));
    }
    private static NativeProviderTime.Bounds at(long a,long b,long now) throws Exception {
        return NativeProviderTimeTest.bounds(a,b,now,S,policy());
    }
    @Test public void estimateIsExplicitAndDoesNotInventHardwareBounds() throws Exception {
        NativeProviderTime.Bounds b=at(1000,1100,1200);
        assertTrue(b.bestEffort);assertEquals(S+150000,b.earliestMicros);
        assertEquals(S,b.serverObservedMicros);assertEquals(-1,policy().ratePpm);
        try {NativeProviderTime.duration(0,1,policy());fail();} catch(VaultFailure expected) {}
        JSONObject o=new NativeProviderJournal.Observation(b,1200L,4).json();
        assertEquals("custodial.provider-best-effort-observation.v1",o.getString("schema"));
        assertFalse(o.has("earliest_at"));assertFalse(o.has("latest_at"));
        NativeProviderObservationWire.validate(o,true);
        assertEquals(Long.valueOf(S),NativeProviderObservationWire.serverFloor(o));
    }
    @Test public void elapsedEstimateCannotAuthorizeExpiryDeletion() throws Exception {
        NativeProviderTime.Bounds b=at(0,0,600000);
        Instant expiry=Instant.parse(NativeProviderTime.canonical(S+1000000));
        assertTrue(NativeProviderTime.reached(b,expiry));
        assertFalse(NativeProviderTime.authoritativelyReached(b,expiry));
        assertTrue(NativeProviderTime.authoritativelyReached(b,Instant.parse(NativeProviderTime.canonical(S))));
    }
    @Test public void requestAndSampleHorizonsRemainBounded() throws Exception {
        assertNotNull(at(0,44999,44999));
        try {at(0,45000,45000);fail();} catch(VaultFailure expected) {}
        assertNotNull(at(0,0,899999));assertNull(at(0,0,900000));
    }
    @Test public void bootCounterPlatformAndOverflowStillFailClosed() throws Exception {
        var s=NativeProviderTimeTest.sample(1000,1100,4,S,900000000);
        assertNull(NativeProviderTime.observe(s,policy(),NativeProviderTimeTest.platform(),new NativeProviderClockExchange.Point(1200,5)));
        assertNull(at(1000,1100,1099));assertNull(at(0,1,Long.MAX_VALUE));
        assertNull(NativeProviderTime.observe(s,policy(),new NativeProviderTime.Platform("wrong","wrong","wrong"),new NativeProviderClockExchange.Point(1200,4)));
    }
    @Test public void wireRejectsClaimedBoundsAndOutOfHorizonEstimates() throws Exception {
        JSONObject base=new NativeProviderJournal.Observation(at(0,0,1),1L,4).json();
        for(String field:new String[]{"earliest_at","latest_at","quantization_nanos"}) {
            JSONObject bad=new JSONObject(base.toString()).put(field,0);
            try {NativeProviderObservationWire.validate(bad,true);fail();} catch(Exception expected) {}
        }
        for(long delta:new long[]{-1,900000000}) {
            JSONObject bad=new JSONObject(base.toString()).put("estimated_at",NativeProviderTime.canonical(S+delta));
            try {NativeProviderObservationWire.validate(bad,true);fail();} catch(Exception expected) {}
        }
    }
    @Test public void originalV2AndEstimatedV3SettleTogetherWithoutRewritingEither() throws Exception {
        var f=new NativeProviderIngressTest.Fixture(true,true);
        long server=NativeProviderTime.micros(Instant.parse(NativeProviderIngressTest.NOW));
        var b=NativeProviderTime.observe(NativeProviderTimeTest.sample(0,100,7,server,900000000L),policy(),
            NativeProviderTimeTest.platform(),new NativeProviderClockExchange.Point(100,7));
        f.r.f.journal().recordArrival(f.r.principal,f.payload,new NativeProviderJournal.Observation(b,100,7));
        var other=new java.util.TreeMap<>(f.payload.data());
        other.put("receipt_job_id","77000000-0000-4000-8000-000000000002");
        f.r.f.journal().recordArrival(f.r.principal,NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(other)),
            NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW,100,7));
        var batch=f.r.f.journal().pendingEvents(f.r.principal,16);
        assertEquals(2,batch.events.size());
        assertEquals("custodial.native-provider-events.v3",new JSONObject(new String(batch.body(),java.nio.charset.StandardCharsets.UTF_8)).get("schema"));
        var rows=new org.json.JSONArray();var schemas=new java.util.HashSet<String>();
        for(var event:batch.events.values()){
            var row=event.wire();schemas.add(row.getString("schema"));
            row.put("schema",row.getString("schema").replace("event.","event-receipt."))
                .put("admitted_state","ACCEPTED").put("server_received_at",NativeProviderTime.canonical(server)).put("replayed",false);
            rows.put(row);
        }
        assertEquals(java.util.Set.of("custodial.native-provider-event.v2","custodial.native-provider-event.v3"),schemas);
        var envelope=new JSONObject().put("ok",true).put("data",new JSONObject().put("schema","custodial.native-provider-event-receipts.v3").put("results",rows));
        var response=new AuthorizedResponse(200,java.util.Map.of("Content-Type","application/json"),envelope.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var receipts=NativeProviderEventReceipts.validateResponse(batch,response);
        assertEquals(2,receipts.admittedIds().size());
        try(var query=f.r.f.journal().prepareEventDecisions(f.r.principal,batch)) {
            var results=new org.json.JSONArray();
            for(int i=0;i<rows.length();i++) {
                var receipt=new JSONObject(rows.getJSONObject(i).toString()).put("replayed",true);
                results.put(new JSONObject().put("event_id",receipt.getString("event_id")).put("decision","ORIGINAL_ACCEPTED").put("receipt",receipt));
            }
            var body=NativeProviderEventDecisionsTest.envelope(query,results);
            var readback=NativeProviderEventDecisions.validate(query,NativeProviderEventDecisionsTest.exchange(query,body));
            assertEquals(2,readback.admittedIds().size());
            assertEquals(2,f.r.f.journal().pendingEvents(f.r.principal,16).events.size());
        }
        assertEquals(2,f.r.f.journal().settleEvents(f.r.principal,batch,receipts));
        assertEquals(2,f.count(ProviderEnvelopeCrypto.Domain.EVENT));
        assertEquals(2,f.count(ProviderEnvelopeCrypto.Domain.INBOX));
    }
}
