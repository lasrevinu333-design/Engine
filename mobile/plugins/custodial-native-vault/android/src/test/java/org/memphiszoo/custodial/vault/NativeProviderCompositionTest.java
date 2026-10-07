package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual native owners with synthetic profile/network/effect dependencies only. */
public final class NativeProviderCompositionTest {
    static NativeProviderJournal.Observation observed() throws Exception { return NativeProviderPresentationTest.observed(); }
    static NativeProviderPayload payload(NativeProviderIngressTest.Fixture f, int n) throws Exception {
        Map<String,String> data = new TreeMap<>(f.payload.data());
        data.put("receipt_job_id", String.format("77000000-0000-4000-8000-%012d", n));
        return NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(data));
    }
    @Test public void interruptedAudioAfterProcessDeathIsNotOfferedAgainOrMarkedCompleted() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        Object attachment = new Object(); NativeProviderClaims first = new NativeProviderClaims(f.journal()); first.attach(attachment);
        NativeProviderClaims.Claim before = first.claimNext(attachment,f.principal,observed());
        first.apply(attachment,f.principal,before.id,"displayed",observed());
        first.apply(attachment,f.principal,before.id,"audio_started",observed());
        assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        Map<String,Object> stored = new HashMap<>(f.f.r.f.storage.memory.raw);
        NativeProviderClaims restarted = new NativeProviderClaims(f.journal()); restarted.attach(attachment);
        NativeProviderClaims.Claim after = restarted.claimNext(attachment,f.principal,observed());
        assertNotNull(after); assertFalse("Interrupted speech must not be replayed",after.data().getBoolean("play_audio"));
        assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        assertEquals(stored,f.f.r.f.storage.memory.raw);
    }
    @Test public void persistedAdmissionOrderWinsOverRandomRecordKeyAfterRestart() throws Exception {
        NativeProviderIngressTest.Fixture f = new NativeProviderIngressTest.Fixture(true,false);
        List<NativeProviderPayload> order = new ArrayList<>(); for(int n=1;n<=3;n++)order.add(payload(f,n));
        order.sort(Comparator.comparing((NativeProviderPayload p)->p.recordId).reversed());
        for(NativeProviderPayload p:order)f.r.f.journal().recordArrival(f.r.principal,p,observed());
        List<String> expected = new ArrayList<>();for(NativeProviderPayload p:order)expected.add(p.recordId);
        assertEquals("FIFO is actual admission order, not UUID/hash ordering",expected,f.r.f.journal().admittedRecordIds(f.r.principal));
        NativeProviderClaims claims = new NativeProviderClaims(f.r.f.journal());Object attachment=new Object();claims.attach(attachment);
        assertEquals(order.get(0).recordId,claims.claimNext(attachment,f.r.principal,observed()).presentation.payload.recordId);
    }
    @Test public void singleAudioCapabilitySerializesQueueAndDismissDoesNotReleaseActiveSpeech() throws Exception {
        NativeProviderIngressTest.Fixture f=new NativeProviderIngressTest.Fixture(true,false);
        NativeProviderPayload p=payload(f,1),q=payload(f,2);f.r.f.journal().recordArrival(f.r.principal,p,observed());f.r.f.journal().recordArrival(f.r.principal,q,observed());
        NativeProviderClaims claims=new NativeProviderClaims(f.r.f.journal());Object attached=new Object();claims.attach(attached);
        NativeProviderClaims.Claim first=claims.claimNext(attached,f.r.principal,observed());assertEquals(p.recordId,first.presentation.payload.recordId);
        assertNull(claims.claimNext(attached,f.r.principal,observed()));
        claims.apply(attached,f.r.principal,first.id,"audio_started",observed());
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(attached,f.r.principal,first.id,"audio_started",observed()));
        claims.apply(attached,f.r.principal,first.id,"dismissed",observed());claims.retire(attached,f.r.principal,first.id);
        assertNull(claims.claimNext(attached,f.r.principal,observed()));claims.apply(attached,f.r.principal,first.id,"audio_completed",observed());
        assertEquals(q.recordId,claims.claimNext(attached,f.r.principal,observed()).presentation.payload.recordId);
    }
    @Test public void unknownHistoricalOrderIsPreservedNotReconstructedFromClockOrUuid() throws Exception {
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();JSONObject old=f.record();old.remove("admission_ordinal");
        ProviderRecordStore store=f.f.r.f.storage.store();char[] raw=old.toString().toCharArray();
        try{store.commit(store.load().revision,Map.of(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.INBOX,f.f.payload.recordId),raw),java.util.Set.of());}
        finally{java.util.Arrays.fill(raw,'\0');}
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_admission_order_unavailable",()->f.journal().admittedRecordIds(f.principal));
        assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals(1,f.journal().pendingEvents(f.principal,16).events.size());
    }
    @Test public void admissionOrdinalSurvivesAmbiguousCommitDuplicateAndNewLaterRecord() throws Exception {
        NativeProviderIngressTest.Fixture f=new NativeProviderIngressTest.Fixture(true,false);f.r.f.storage.memory.persistThenReject=true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved",()->f.arrive(NativeProviderIngressTest.NOW));
        f.r.f.storage.memory.persistThenReject=false;long ordinal=f.read(ProviderEnvelopeCrypto.Domain.INBOX).getLong("admission_ordinal");
        int commits=f.r.f.storage.memory.commits;assertFalse(f.arrive(NativeProviderIngressTest.NOW).newlyAdmitted);assertEquals(commits,f.r.f.storage.memory.commits);
        NativeProviderPayload next=payload(f,7);f.r.f.journal().recordArrival(f.r.principal,next,observed());
        assertEquals(List.of(f.payload.recordId,next.recordId),f.r.f.journal().admittedRecordIds(f.r.principal));
        assertEquals(ordinal,f.read(ProviderEnvelopeCrypto.Domain.INBOX).getLong("admission_ordinal"));
    }
    static NativeProviderJobLifecycle.Invocation invocation() throws Exception {
        return new NativeProviderJobLifecycle(new NativeProviderJobLifecycle.Effects(){public void release(Object owner){}public void finished(Object owner,boolean retry){}}).begin(new Object(),()->100);
    }
    static final class Surface implements NativeProviderDisplayDriver.Surface {
        final Map<String,String> active=new HashMap<>();int shows,cancels;boolean enabled=true;NativeProviderHttpTest.Hook onShow;
        public boolean enabled(NativeProviderPayload payload){return enabled;}
        public NativeProviderDisplayDriver.Active active(NativeProviderJournal.OsDisplayIntent intent){
            return !active.containsKey(intent.tag)?NativeProviderDisplayDriver.Active.ABSENT:intent.attemptId.equals(active.get(intent.tag))?NativeProviderDisplayDriver.Active.MATCH:NativeProviderDisplayDriver.Active.CONFLICT;
        }
        public void show(NativeProviderJournal.OsDisplayIntent intent)throws Exception{shows++;active.put(intent.tag,intent.attemptId);if(onShow!=null)onShow.run();}
        public void cancel(String tag){cancels++;active.remove(tag);}
        public boolean absent(String tag){return !active.containsKey(tag);}
    }
    static final class Composition {
        final NativeProviderHttpTest.Fixture f;
        final NativeProviderJournal journal;
        final Surface surface=new Surface();
        final NativeProviderJobLifecycleTest.Jobs jobs=new NativeProviderJobLifecycleTest.Jobs();
        final List<String> paths=new ArrayList<>();final List<JSONObject> requests=new ArrayList<>();
        NativeProviderTime.Profile profile=NativeProviderTimeTest.profile(0,0,900_000_000_000L);
        NativeProviderRuntimeOwner owner;int tokens;long elapsed=100,readingStep;NativeProviderHttpTest.Hook duringHttp;boolean loseResponse;
        NativeProviderPayload[] inventoryRows=new NativeProviderPayload[0];
        String responseServerNow=NativeProviderIngressTest.NOW,responseClockEnd="2026-09-24T17:15:00.123457Z";
        int responseStatus=200;byte[] overrideResponse;
        Composition(boolean legacy)throws Exception{f=new NativeProviderHttpTest.Fixture(legacy);journal=f.provider.journal();owner=reconstruct();}
        NativeProviderRuntimeOwner reconstruct()throws Exception{
            NativeProviderClockExchange.Readings readings=()->{long now=elapsed;elapsed+=readingStep;return new NativeProviderClockExchange.Point(now,7);};
            NativeProviderAppIdentity app=NativeProviderJournalTest.app();
            NativeProviderHttp http=new NativeProviderHttp(url->{
                assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.provider.storage.lock));paths.add(url.getPath());
                NativeProviderHttpTest.Connection c=new NativeProviderHttpTest.Connection(url,new byte[0]);
                c.onResponse=()->{
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.provider.storage.lock));
                    JSONObject request=ProviderWireJson.object(c.sent.toByteArray(),65536);requests.add(request);
                    String nonce=c.sentHeaders.get("X-Memphis-Native-Request-Id");
                    JSONObject data;
                    if(url.getPath().equals(NativeProviderEventDecisions.PATH)){
                        org.json.JSONArray results=new org.json.JSONArray();for(int i=0;i<request.getJSONArray("events").length();i++)
                            results.put(new JSONObject().put("event_id",request.getJSONArray("events").getJSONObject(i).getString("event_id")).put("decision","UNRESOLVED"));
                        c.response=new JSONObject().put("ok",true).put("data",new JSONObject().put("schema","custodial.native-provider-event-decisions.v1")
                            .put("native_request_id",nonce).put("request_body_sha256",NativeProviderPrincipal.hash(new String(c.sent.toByteArray(),java.nio.charset.StandardCharsets.UTF_8)))
                            .put("requester",request.getJSONObject("requester")).put("results",results)).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    }else if(url.getPath().endsWith("/events")){
                        org.json.JSONArray receipts=new org.json.JSONArray();for(int i=0;i<request.getJSONArray("events").length();i++)
                            receipts.put(new JSONObject(request.getJSONArray("events").getJSONObject(i).toString()).put("schema",NativeProviderEventReceipts.SCHEMA)
                                .put("admitted_state","ACCEPTED").put("server_received_at","2026-09-24T19:00:00.987654Z").put("replayed",false));
                        c.response=NativeProviderEventReceiptsTest.response(receipts).body;
                    }else{
                        if(url.getPath().endsWith("/inventory")){
                            NativeProviderInventory.Request expected=journal.prepareInventory(f.principal);
                            data=NativeProviderInventoryTest.data(expected,inventoryRows.length==0?null:inventoryRows[inventoryRows.length-1],false,inventoryRows);
                        }else{
                            NativeProviderJournal.Prepared prepared=journal.prepareRegistration(f.principal,app);
                            JSONObject meta=f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"journal");
                            data=prepared.confirmed?prepared.json().getJSONObject("admission"):NativeProviderRegistrationReceiptTest.data(prepared,
                                meta.isNull("current_generation")?null:meta.getString("current_generation"),meta.isNull("current_generation")?NativeProviderRegistrationReceiptTest.TIME:NativeProviderIngressTest.RETIRE);
                        }
                        c.response=new JSONObject().put("ok",true).put("data",data).put("clock",new JSONObject().put("native_request_id",nonce)
                            .put("server_now",responseServerNow).put("valid_until",responseClockEnd)).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    }
                    c.status=responseStatus;if(overrideResponse!=null)c.response=overrideResponse;
                    if(duringHttp!=null)duringHttp.run();if(loseResponse)c.timeout=true;
                };return c;
            },()->NativeProviderHttpTest.NOW,()->java.util.UUID.randomUUID().toString(),readings);
            return new NativeProviderRuntimeOwner(f.engine,f.principalJournal,f.legacyJournal,journal,f.provider.storage.lock,surface,
                new NativeProviderRuntimeOwner.Delivery(actual->profile,NativeProviderTimeTest.platform(),readings,()->app,http,jobs,(registration,attempt)->{
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.provider.storage.lock));tokens++;registration.captureToken("synthetic-refreshed-token");
                }));
        }
        NativeProviderJobLifecycle.Result sync()throws Exception{return owner.synchronize(invocation());}
        JSONObject inbox(String id)throws Exception{return f.provider.read(ProviderEnvelopeCrypto.Domain.INBOX,id);}
    }
    @Test public void unqualifiedCompositionHasNoTokenNetworkOrNewEffectsAndPreservesStore()throws Exception{
        Composition x=new Composition(false);x.profile=null;Map<String,Object> before=new HashMap<>(x.f.provider.storage.memory.raw);
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.owner.pendingWork());assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.sync());
        ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",()->x.owner.captureToken("must-not-save"));
        ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",()->x.owner.receive(NativeProviderIngressTest.payload(x.f.prepared)));
        assertEquals(0,x.tokens);assertTrue(x.paths.isEmpty());assertEquals(0,x.surface.shows);assertEquals(before,x.f.provider.storage.memory.raw);
    }
    @Test public void oneCompositionRegistersRecoversAdmitsDisplaysAndDrainsOriginalReceiptsAcrossRestart()throws Exception{
        for(boolean legacy:new boolean[]{false,true}){
            Composition x=new Composition(legacy);NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};
            x.owner.receive(p);JSONObject original=x.f.provider.read(ProviderEnvelopeCrypto.Domain.QUARANTINE,p.recordId).getJSONObject("received_observation");
            assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.sync());assertEquals(1,x.surface.shows);
            assertTrue(ProviderWireJson.same(original,x.inbox(p.recordId).getJSONObject("received_observation")));
            assertTrue(original.isNull("earliest_at"));assertEquals(1,x.journal.pendingEvents(x.f.principal,16).events.size());
            x.owner=x.reconstruct();assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(1,x.surface.shows);
            assertTrue(x.journal.pendingEvents(x.f.principal,16).events.isEmpty());assertEquals(0,x.tokens);
            assertEquals(1,x.paths.stream().filter(pth->pth.endsWith("/register")).count());
        }
    }
    @Test public void boundedPassDoesNotStarveNinthDisplayOrSeventeenthReceipt()throws Exception{
        Composition x=new Composition(false);x.inventoryRows=new NativeProviderPayload[20];
        for(int i=0;i<20;i++)x.inventoryRows[i]=NativeProviderInventoryTest.payload(x.f.prepared,i+1);
        assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.sync());assertEquals(8,x.surface.shows);
        assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.sync());assertEquals(16,x.surface.shows);
        assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.sync());assertEquals(20,x.surface.shows);
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(20,x.surface.shows);assertTrue(x.journal.pendingEvents(x.f.principal,16).events.isEmpty());
    }
    @Test public void overlappingInvocationDoesNotCreateSecondHttpOwner()throws Exception{
        Composition x=new Composition(false);int[] overlaps={0};x.duringHttp=()->{int before=x.paths.size();assertEquals(NativeProviderJobLifecycle.Result.RETRY,x.sync());assertEquals(before,x.paths.size());overlaps[0]++;};
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(2,overlaps[0]);
    }
    @Test public void removalDuringUnlockedHttpFencesOriginalResponseAndReleasesSingleflight()throws Exception{
        Composition x=new Composition(false);x.duringHttp=()->x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,NativeProviderHttpTest.DEVICE);
        ProviderRecordStoreTest.failure("custodial_native_vault_concurrent_change",x::sync);
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND,x.owner.pendingWork());assertEquals(0,x.surface.shows);
        x.owner.reconcile();assertEquals("REMOVED",x.f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"journal").getString("availability"));
    }
    @Test public void unknownNetworkOutcomePreservesOriginalGenerationForRetryAndNeverDisplays()throws Exception{
        Composition x=new Composition(false);x.loseResponse=true;
        ProviderRecordStoreTest.failure("custodial_provider_network_unavailable",x::sync);assertEquals(0,x.surface.shows);
        assertEquals(x.f.prepared.generationId,x.f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"journal").getString("pending_generation"));
        x.loseResponse=false;assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());
        assertEquals(x.requests.get(0).getString("operation_id"),x.requests.get(1).getString("operation_id"));
    }
    @Test public void inheritedCallerMonitorCannotLeakIntoNetworkAndCanceledInvocationDoesNothing()throws Exception{
        Composition x=new Composition(false);
        synchronized(x.f.engine){ProviderRecordStoreTest.failure("custodial_provider_network_lock_held",x::sync);}
        synchronized(x.f.provider.storage.lock){ProviderRecordStoreTest.failure("custodial_provider_network_lock_held",x::sync);}
        NativeProviderJobLifecycle.Invocation stopped=invocation();stopped.attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled",()->x.owner.synchronize(stopped));assertTrue(x.paths.isEmpty());
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());
    }
    @Test public void cancellationDuringHttpPreservesOriginalPendingAndReleasesInvocationOwner()throws Exception{
        Composition x=new Composition(false);NativeProviderJobLifecycle.Invocation call=invocation();x.duringHttp=call.attempt::cancel;
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled",()->x.owner.synchronize(call));assertEquals(0,x.surface.shows);
        assertEquals(x.f.prepared.generationId,x.f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"journal").getString("pending_generation"));
        x.duringHttp=null;assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());
    }
    @Test public void profileLossAfterHttpNeverCreatesClockOrNewEffects()throws Exception{
        Composition x=new Composition(false);x.duringHttp=()->x.profile=null;
        ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",x::sync);
        assertEquals(1,x.paths.size());assertEquals(0,x.surface.shows);
        assertFalse(x.f.provider.storage.store().load().keys().stream().anyMatch(k->k.id.startsWith("clock-")));
    }
    static NativeProviderActionIntent action(Composition x,NativeProviderPayload p,String kind)throws Exception{
        String attempt=x.inbox(p.recordId).getString("os_attempt_id");boolean open=kind.equals("opened");
        return NativeProviderActionIntent.parse(NativeProviderActionIntent.PACKAGE,NativeProviderActionIntent.PACKAGE,
            open?NativeProviderActionIntent.OPEN_ACTIVITY:NativeProviderActionIntent.ACTION_RECEIVER,NativeProviderActionIntent.ACTION_PREFIX+kind,
            "mz-custodial-provider://notification/"+p.recordId+"/"+attempt+"/"+kind,false,open);
    }
    @Test public void exactOsOpenCommitsBeforeOfflineSameAppLaunchWithoutInventedAudioOrNetwork()throws Exception{
        Composition x=new Composition(false);NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        NativeProviderActionIntent open=action(x,p,"opened");int network=x.paths.size(),scheduled=x.jobs.inspected;
        x.owner.applyAction(open);assertEquals(scheduled,x.jobs.inspected);assertTrue(x.inbox(p.recordId).getBoolean("navigation_pending"));
        x.elapsed=1_000_100; // Only the already-durable original navigation may drain after clock expiry.
        int[] launches={0};x.owner.openCommitted(open,()->{try{assertTrue(x.inbox(p.recordId).getBoolean("navigation_pending"));launches[0]++;}catch(Exception e){throw new AssertionError(e);}});
        assertEquals(1,launches[0]);assertEquals(network,x.paths.size());assertFalse(x.inbox(p.recordId).getBoolean("os_cancel_pending"));
        Object attached=new Object();x.owner.attach(attached);NativeProviderClaims.Claim historical=x.owner.claimNext(attached);
        assertTrue(historical.data().getBoolean("historical"));assertFalse(historical.data().getBoolean("play_audio"));
        assertEquals("PENDING",x.inbox(p.recordId).getString("audio_state"));
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale",()->x.owner.openCommitted(open,()->launches[0]++));assertEquals(1,launches[0]);
    }
    @Test public void nativeDismissIsLocalAndNativeAckIsOriginalDistinctReceipt()throws Exception{
        for(String kind:new String[]{"dismissed","acknowledged"}){
            Composition x=new Composition(false);NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
            x.owner.applyAction(action(x,p,kind));JSONObject stored=x.inbox(p.recordId);
            assertFalse(stored.getBoolean("os_cancel_pending"));assertEquals(kind.equals("dismissed"),stored.isNull("acknowledged_event_id"));
            assertEquals(p.contentHash,stored.getString("content_sha256"));assertEquals("PENDING",stored.getString("audio_state"));
        }
    }
    @Test public void sameNameAssignmentEpochChangeRetiresClaimAndCannotOpenOldCard()throws Exception{
        Composition x=new Composition(false);NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        Object attached=new Object();x.owner.attach(attached);NativeProviderClaims.Claim first=x.owner.claimNext(attached);assertNotNull(first);
        new NativePrincipalJournalTest().capture(x.f.principalJournal,x.f.engine.getState(),new NativePrincipalJournalTest().data()
            .put("credential_id",x.f.principal.json().get("credential_id")).put("assignment_epoch",5));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->x.owner.applyClaim(attached,first.id,"opened"));
        assertEquals("REVOKED_OR_FOREIGN",x.inbox(p.recordId).getString("authority_state"));assertTrue(x.inbox(p.recordId).isNull("opened_event_id"));
    }
    @Test public void disabledOsSurfaceDoesNotFakeDisplayAndNativeCardRemainsClaimable()throws Exception{
        Composition x=new Composition(false);x.surface.enabled=false;NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(0,x.surface.shows);assertTrue(x.inbox(p.recordId).isNull("displayed_event_id"));
        Object attached=new Object();x.owner.attach(attached);assertNotNull(x.owner.claimNext(attached));
    }
    @Test public void expiredQuarantinePrefixCannotStarveLaterValidRecordOrDeleteOriginals()throws Exception{
        Composition x=new Composition(false);List<NativeProviderPayload> rows=new ArrayList<>();
        for(int i=1;i<=33;i++)rows.add(NativeProviderInventoryTest.payload(x.f.prepared,i));
        rows.sort(Comparator.comparing(p->p.recordId));Map<String,String> originalExpired=new HashMap<>();
        for(int i=0;i<rows.size();i++){
            NativeProviderPayload p=rows.get(i);
            if(i<32){Map<String,String> data=new TreeMap<>(p.data());data.put("reservation_at","2026-09-24T16:00:00.123456Z");
                data.put("scheduled_at","2026-09-24T16:00:00.000000Z");data.put("scheduled_time","11:00");data.put("valid_until","2026-09-24T17:00:00.000000Z");
                p=NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(data));}
            x.owner.receive(p);
            if(i<32)originalExpired.put(p.recordId,x.f.provider.read(ProviderEnvelopeCrypto.Domain.QUARANTINE,p.recordId).toString());
        }
        x.sync();assertEquals(1,x.surface.shows);assertEquals(rows.get(32).recordId,x.journal.admittedRecordIds(x.f.principal).get(0));
        for(Map.Entry<String,String> row:originalExpired.entrySet())assertTrue(ProviderWireJson.same(new JSONObject(row.getValue()),x.f.provider.read(ProviderEnvelopeCrypto.Domain.QUARANTINE,row.getKey())));
    }
    @Test public void everyQuarantineAdmissionUsesFreshNativeObservation()throws Exception{
        Composition x=new Composition(false);NativeProviderPayload p=NativeProviderInventoryTest.payload(x.f.prepared,1),q=NativeProviderInventoryTest.payload(x.f.prepared,2);
        x.sync();NativeProviderJournal.Observation unknown=NativeProviderIngressTest.observation(null,100,7);
        x.journal.recordArrival(x.f.principal,p,unknown);x.journal.recordArrival(x.f.principal,q,unknown);x.readingStep=1;x.sync();
        assertNotEquals(x.inbox(p.recordId).getJSONObject("admission_bounds").getLong("elapsed_realtime_ms"),x.inbox(q.recordId).getJSONObject("admission_bounds").getLong("elapsed_realtime_ms"));
    }
    @Test public void missingNativeTokenUsesOnlySameBoundedWorkerAndThenOriginalRegistration()throws Exception{
        Composition x=new Composition(false);x.f.provider.storage.memory.raw.clear();x.owner=x.reconstruct();
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(1,x.tokens);
        assertEquals(1,x.paths.stream().filter(p->p.endsWith("/register")).count());
        assertEquals(NativeProviderJobLifecycle.Result.DRAINED,x.sync());assertEquals(1,x.tokens);
    }
    @Test public void expiredUnusedAudioOfferRetiresCapabilityWithoutClaimingCompletedSpeech()throws Exception{
        NativeProviderIngressTest.Fixture f=new NativeProviderIngressTest.Fixture(true,false);NativeProviderPayload p=payload(f,1),q=payload(f,2);
        f.r.f.journal().recordArrival(f.r.principal,p,observed());f.r.f.journal().recordArrival(f.r.principal,q,observed());
        NativeProviderClaims claims=new NativeProviderClaims(f.r.f.journal());Object attached=new Object();claims.attach(attached);
        NativeProviderClaims.Claim first=claims.claimNext(attached,f.r.principal,observed());
        NativeProviderJournal.Observation unknown=NativeProviderIngressTest.observation(null,1000000,7);
        assertNull(claims.claimNext(attached,f.r.principal,unknown));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(attached,f.r.principal,first.id,"audio_started",observed()));
        assertEquals("PENDING",f.r.f.read(ProviderEnvelopeCrypto.Domain.INBOX,p.recordId).getString("audio_state"));
        assertEquals(q.recordId,claims.claimNext(attached,f.r.principal,observed()).presentation.payload.recordId);
    }
}
