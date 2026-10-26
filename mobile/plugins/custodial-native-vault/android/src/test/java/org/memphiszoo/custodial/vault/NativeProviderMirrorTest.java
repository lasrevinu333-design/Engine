package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual native owner/journal. No Android/physical audio or JS ingress is faked. */
public final class NativeProviderMirrorTest {
    @Test public void uninterruptedOriginalAudioMayCompleteAcrossPayloadExpiryExactlyOnce()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"displayed",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);long events=f.events();
        JSONObject state=claims.state(owner,f.principal,claim,expired);
        assertEquals("HISTORICAL_EXPIRED",state.getString("freshness"));assertFalse(state.getBoolean("stop_audio"));
        assertEquals("Expiry classification itself never rewrites protected records",before,f.f.r.f.storage.memory.raw);
        claims.apply(owner,f.principal,claim,"audio_completed",expired);
        assertEquals("COMPLETED",f.record().getString("audio_state"));assertEquals(events,f.events());
        assertTrue(f.record().isNull("opened_event_id"));assertTrue(f.record().isNull("acknowledged_event_id"));
        before=new HashMap<>(f.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(owner,f.principal,claim,"audio_completed",expired));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(owner,f.principal,claim,"audio_started",expired));
        assertEquals(before,f.f.r.f.storage.memory.raw);
        claims.detach(owner);claims.attach(owner);assertNull(claims.claimNext(owner,f.principal,expired));
        assertEquals(before,f.f.r.f.storage.memory.raw);
    }
    @Test public void expiryChoiceCannotStartAnUnstartedOfferEvenForOriginalPendingOpen()throws Exception{
        for(boolean opened:new boolean[]{false,true}){
            NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
            NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
            String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
            if(opened)claims.apply(owner,f.principal,claim,"opened",NativeProviderPresentationTest.observed());
            NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
            Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable",()->claims.apply(owner,f.principal,claim,"audio_started",expired));
            assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("PENDING",f.record().getString("audio_state"));
        }
    }
    @Test public void interruptedExpiryEpisodeCannotResumeOrManufactureCompletion()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"displayed",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        claims.apply(owner,f.principal,claim,"audio_stopped",expired);
        assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(owner,f.principal,claim,"audio_completed",expired));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->claims.apply(owner,f.principal,claim,"audio_started",expired));
        claims.detach(owner);claims.attach(owner);assertNull(claims.claimNext(owner,f.principal,expired));
        assertEquals(before,f.f.r.f.storage.memory.raw);
    }
    @Test public void localDismissRetirementPreservesOriginalExpiryCompletionWithoutAck()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"displayed",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        claims.apply(owner,f.principal,claim,"dismissed",expired);claims.retire(owner,f.principal,claim);
        JSONObject state=claims.state(owner,f.principal,claim,expired);
        assertTrue(state.getBoolean("retire_visual"));assertFalse(state.getBoolean("stop_audio"));
        claims.apply(owner,f.principal,claim,"audio_completed",expired);
        assertEquals("COMPLETED",f.record().getString("audio_state"));assertTrue(f.record().isNull("acknowledged_event_id"));
    }
    @Test public void originalAckStillRequestsStopAfterPayloadExpiryWithoutInventingCompletion()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"acknowledged",NativeProviderPresentationTest.observed());
        String original=f.record().getString("acknowledged_event_id");
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        JSONObject state=claims.state(owner,f.principal,claim,expired);
        assertEquals("HISTORICAL_EXPIRED",state.getString("freshness"));assertTrue(state.getBoolean("stop_audio"));
        claims.apply(owner,f.principal,claim,"audio_stopped",expired);
        assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        assertEquals(original,f.record().getString("acknowledged_event_id"));
    }
    @Test public void samePrincipalTokenRotationKeepsExactOriginalExpiryEpisodeWithoutNewOffer()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"displayed",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        f.journal().captureToken("synthetic-expiry-rotation");
        NativeProviderJournal.Prepared next=f.journal().prepareRegistration(f.principal,NativeProviderJournalTest.app());
        f.journal().confirmRegistration(f.principal,next,NativeProviderRegistrationReceipt.validateResponse(next,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next,f.f.r.prepared.generationId,NativeProviderIngressTest.RETIRE))));
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);long events=f.events();
        assertFalse(claims.state(owner,f.principal,claim,expired).getBoolean("stop_audio"));
        assertNull("No successor offer while original owns FIFO",claims.claimNext(owner,f.principal,expired));
        assertEquals(before,f.f.r.f.storage.memory.raw);
        claims.apply(owner,f.principal,claim,"audio_completed",expired);
        assertEquals("COMPLETED",f.record().getString("audio_state"));assertEquals(events,f.events());
        assertNull(claims.claimNext(owner,f.principal,expired));
    }
    @Test public void stateReadsFreshNativeClassificationInsteadOfAdmissionBoolean()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"displayed");
        JSONObject before=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);
        assertEquals("CURRENT",before.getString("freshness"));
        m.x.elapsed=900_100;
        JSONObject unknown=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);
        assertEquals("FRESHNESS_UNAVAILABLE",unknown.getString("freshness"));
        assertFalse(unknown.getBoolean("retire_visual"));
        assertTrue(m.x.inbox(m.p.recordId).getBoolean("mirror_rendered"));
        assertTrue(m.x.inbox(m.p.recordId).isNull("opened_event_id"));
    }
    @Test public void nativeBoundsClassifyExactExpiryStraddleAndUnknownWithoutRecordWrites()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"displayed",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_started",NativeProviderPresentationTest.observed());
        claims.apply(owner,f.principal,claim,"audio_completed",NativeProviderPresentationTest.observed());
        Map<String,Object> bytes=new HashMap<>(f.f.r.f.storage.memory.raw);int commits=f.f.r.f.storage.memory.commits;
        java.time.Instant expiry=f.f.payload.validUntil;
        NativeProviderJournal.Observation[] times={NativeProviderPresentationTest.observed(),
            NativeProviderTimeTest.observation(expiry,500,7),NativeProviderTimeTest.observation(expiry.minusNanos(1000),500,7),
            NativeProviderTimeTest.observation(expiry.minusNanos(2000),500,7),new NativeProviderJournal.Observation(null,500,7),
            NativeProviderTimeTest.observation(f.f.payload.reservedAt.minusNanos(1000),500,7),NativeProviderPresentationTest.observed()};
        String[] expected={"CURRENT","HISTORICAL_EXPIRED","FRESHNESS_UNAVAILABLE","FRESHNESS_UNAVAILABLE","FRESHNESS_UNAVAILABLE","FRESHNESS_UNAVAILABLE","CURRENT"};
        for(int i=0;i<times.length;i++){
            JSONObject state=claims.state(owner,f.principal,claim,times[i]);assertEquals(expected[i],state.getString("freshness"));
            assertTrue(state.getBoolean("current"));assertFalse(state.getBoolean("retire_visual"));assertFalse(state.getBoolean("stop_audio"));
            assertEquals(bytes,f.f.r.f.storage.memory.raw);assertEquals(commits,f.f.r.f.storage.memory.commits);
        }
        claims.detach(owner);claims.attach(owner);
        assertNull("No new expired historical restoration",claims.claimNext(owner,f.principal,times[1]));
        assertEquals(bytes,f.f.r.f.storage.memory.raw);
    }
    @Test public void classificationPreservesOriginalPendingOpenThroughSamePrincipalRotation()throws Exception{
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        String claim=claims.claimNext(owner,f.principal,NativeProviderPresentationTest.observed()).id;
        claims.apply(owner,f.principal,claim,"opened",NativeProviderPresentationTest.observed());
        String original=f.record().getString("opened_event_id");byte[] events=f.journal().pendingEvents(f.principal,16).body();
        f.journal().captureToken("synthetic-classification-rotation");
        NativeProviderJournal.Prepared next=f.journal().prepareRegistration(f.principal,NativeProviderJournalTest.app());
        f.journal().confirmRegistration(f.principal,next,NativeProviderRegistrationReceipt.validateResponse(next,
            NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next,f.f.r.prepared.generationId,NativeProviderIngressTest.RETIRE))));
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        Map<String,Object> bytes=new HashMap<>(f.f.r.f.storage.memory.raw);
        JSONObject state=claims.state(owner,f.principal,claim,expired);assertEquals("HISTORICAL_EXPIRED",state.getString("freshness"));assertTrue(state.getBoolean("navigation_pending"));
        claims.apply(owner,f.principal,claim,"opened",expired);assertEquals(bytes,f.f.r.f.storage.memory.raw);
        assertArrayEquals(events,f.journal().pendingEvents(f.principal,16).body());assertEquals(original,f.record().getString("opened_event_id"));
        claims.apply(owner,f.principal,claim,"navigation_completed",expired);assertEquals(original,f.record().getString("opened_event_id"));
    }
    @Test public void authoritativeRemovalCanReportRetiredButCannotExposeOrReviveOriginalClaim()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");
        m.x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,NativeProviderHttpTest.DEVICE);
        JSONObject state=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);
        assertEquals("RETIRED",state.getString("freshness"));assertFalse(state.getBoolean("current"));
        assertTrue(state.getBoolean("retire_visual"));assertTrue(state.getBoolean("stop_audio"));assertFalse(state.getBoolean("navigation_pending"));
        assertEquals(5,state.length());assertFalse(state.has("payload"));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.apply(claim,"opened"));
    }
    @Test public void localDismissDoesNotBecomeIdentityRetirementOrServerAck()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"dismissed");
        JSONObject state=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);
        assertEquals("CURRENT",state.getString("freshness"));assertTrue(state.getBoolean("retire_visual"));assertFalse(state.getBoolean("stop_audio"));
        assertTrue(m.x.inbox(m.p.recordId).isNull("acknowledged_event_id"));
    }
    static final class Mirror {
        final NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        final Object plugin=new Object();final List<String> hints=new ArrayList<>();
        String attachment;NativeProviderPayload p;
        Mirror()throws Exception{p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();}
        Map<String,Object> attach()throws Exception{
            Map<String,Object> snapshot=x.owner.mirrorAttach(plugin,(incarnation,revision)->hints.add(incarnation+"/"+revision));
            attachment=(String)snapshot.get("attachment_id");return snapshot;
        }
        JSONObject claim()throws Exception{return x.owner.mirrorClaimNext(plugin,attachment);}
        void ready()throws Exception{x.owner.mirrorStopped(plugin,attachment);}
        void apply(String claim,String action)throws Exception{x.owner.mirrorApply(plugin,attachment,claim,action);}
    }
    @Test public void attachmentRequiresPositiveStopTransitionBeforeAudioCapableClaim()throws Exception{
        Mirror m=new Mirror();Map<String,Object> snapshot=m.attach();assertEquals("ATTACHED",snapshot.get("state"));assertEquals(false,snapshot.get("audio_ready"));
        ProviderRecordStoreTest.failure("custodial_provider_audio_stop_unconfirmed",m::claim);assertEquals(1,m.hints.size());
        assertEquals(m.x.journal.presentationRevision(),Long.parseLong((String)snapshot.get("revision")));
        m.ready();JSONObject claim=m.claim();assertTrue(claim.getBoolean("play_audio"));assertEquals(m.p.contentHash,claim.getJSONObject("payload").getString("content_sha256"));
        assertEquals("PENDING",m.x.inbox(m.p.recordId).getString("audio_state"));
    }
    @Test public void oldOrForeignAttachmentCannotConfirmStopClaimOrApplyAfterRotation()throws Exception{
        Mirror m=new Mirror();m.attach();String old=m.attachment;m.ready();String claim=m.claim().getString("claim_id");
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.x.owner.mirrorStopped(new Object(),old));
        m.attach();assertNotEquals(old,m.attachment);
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.x.owner.mirrorStopped(m.plugin,old));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.x.owner.mirrorApply(m.plugin,old,claim,"audio_started"));
        ProviderRecordStoreTest.failure("custodial_provider_audio_stop_unconfirmed",m::claim);
        assertEquals("PENDING",m.x.inbox(m.p.recordId).getString("audio_state"));
    }
    @Test public void detachDuringAudioKeepsOriginalUncertaintyAndFreshAttachmentDoesNotReplay()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String old=m.attachment,claim=m.claim().getString("claim_id");m.apply(claim,"audio_started");
        m.x.owner.detach(m.plugin);assertEquals("IN_PROGRESS",m.x.inbox(m.p.recordId).getString("audio_state"));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.x.owner.mirrorApply(m.plugin,old,claim,"audio_completed"));
        m.attach();m.ready();assertFalse(m.claim().getBoolean("play_audio"));assertEquals("IN_PROGRESS",m.x.inbox(m.p.recordId).getString("audio_state"));
    }
    @Test public void acknowledgedOriginalRetiresVisualAndRequestsAudioStopWithoutCompletedFact()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"audio_started");
        m.x.owner.applyAction(NativeProviderCompositionTest.action(m.x,m.p,"acknowledged"));
        JSONObject state=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);assertTrue(state.getBoolean("retire_visual"));assertTrue(state.getBoolean("stop_audio"));
        m.x.owner.mirrorRetire(m.plugin,m.attachment,claim);m.apply(claim,"audio_stopped");
        assertEquals("IN_PROGRESS",m.x.inbox(m.p.recordId).getString("audio_state"));assertFalse(m.x.inbox(m.p.recordId).isNull("acknowledged_event_id"));
    }
    @Test public void nativeDismissRetiresOnlyVisualNotRunningAudioOrServerAck()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"audio_started");
        m.x.owner.applyAction(NativeProviderCompositionTest.action(m.x,m.p,"dismissed"));
        JSONObject state=m.x.owner.mirrorClaimState(m.plugin,m.attachment,claim);assertTrue(state.getBoolean("retire_visual"));assertFalse(state.getBoolean("stop_audio"));
        m.x.owner.mirrorRetire(m.plugin,m.attachment,claim);m.apply(claim,"audio_completed");
        assertEquals("COMPLETED",m.x.inbox(m.p.recordId).getString("audio_state"));assertTrue(m.x.inbox(m.p.recordId).isNull("acknowledged_event_id"));
    }
    @Test public void continuouslyForegroundArrivalPublishesHintAndPullUsesOriginalNativeRecord()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String first=m.claim().getString("claim_id");m.apply(first,"dismissed");m.x.owner.mirrorRetire(m.plugin,m.attachment,first);
        int previous=m.hints.size();NativeProviderPayload second=NativeProviderInventoryTest.payload(m.x.f.prepared,9);m.x.owner.receive(second);
        assertTrue(m.hints.size()>previous);assertEquals(second.contentHash,m.claim().getJSONObject("payload").getString("content_sha256"));
    }
    @Test public void noQualifiedProfileReturnsSuspendedAndCannotGrantPayload()throws Exception{
        Mirror m=new Mirror();m.x.profile=null;Map<String,Object> before=new HashMap<>(m.x.f.provider.storage.memory.raw);
        assertEquals("SUSPENDED",m.attach().get("state"));m.ready();ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",m::claim);
        assertEquals(before,m.x.f.provider.storage.memory.raw);
    }
    @Test public void removalInvalidatesAttachmentAndSignalsWithoutAnyPayloadInHint()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");int prior=m.hints.size();
        m.x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,NativeProviderHttpTest.DEVICE);m.x.owner.reconcile();
        assertTrue(m.hints.size()>prior);ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->m.apply(claim,"opened"));
        for(String hint:m.hints)assertTrue(hint.matches("[0-9a-f-]{36}/[0-9]+"));assertTrue(m.x.inbox(m.p.recordId).isNull("opened_event_id"));
    }
    @Test public void finishedAudioDoesNotEraseUnhandledVisualAcrossAttachmentRestart()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");
        m.apply(claim,"displayed");m.apply(claim,"audio_started");m.apply(claim,"audio_completed");
        m.attach();m.ready();JSONObject restored=m.claim();assertNotNull("Unhandled visual remains persistent",restored);
        assertFalse(restored.getBoolean("play_audio"));assertEquals(m.p.contentHash,restored.getJSONObject("payload").getString("content_sha256"));
        assertEquals("COMPLETED",m.x.inbox(m.p.recordId).getString("audio_state"));
    }
    @Test public void completedOriginalNavigationNeverResurfacesOrReplaysAfterRestart()throws Exception{
        Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");
        m.apply(claim,"displayed");m.apply(claim,"opened");m.apply(claim,"navigation_completed");
        m.x.owner.mirrorRetire(m.plugin,m.attachment,claim);m.attach();m.ready();assertNull(m.claim());
        assertFalse(m.x.inbox(m.p.recordId).getBoolean("navigation_pending"));
        assertFalse(m.x.inbox(m.p.recordId).isNull("opened_event_id"));
    }
    @Test public void destinationReadbackRetiresUnusedAudioOfferWithoutStarvingNextOriginal()throws Exception{
        Mirror m=new Mirror();m.x.owner.applyAction(NativeProviderCompositionTest.action(m.x,m.p,"opened"));
        m.attach();m.ready();JSONObject next=m.claim();String claim=next.getString("claim_id");
        assertTrue(next.getBoolean("navigation_pending"));m.apply(claim,"navigation_completed");m.x.owner.mirrorRetire(m.plugin,m.attachment,claim);
        NativeProviderPayload second=NativeProviderInventoryTest.payload(m.x.f.prepared,9);m.x.owner.receive(second);
        JSONObject successor=m.claim();assertNotNull("Retired unstarted capability cannot starve FIFO",successor);
        assertEquals(second.contentHash,successor.getJSONObject("payload").getString("content_sha256"));
        assertEquals("PENDING",m.x.inbox(m.p.recordId).getString("audio_state"));
    }
    @Test public void currentMirrorCapabilityCannotCreateOpenAckWithExpiredOrRolledBackClockSample()throws Exception{
        for(String action:new String[]{"opened","acknowledged"})for(long elapsed:new long[]{0,900_100}){
            Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"displayed");
            m.x.elapsed=elapsed;assertNull(m.claim()); // Persist the existing clock owner's invalidation before the action snapshot.
            Map<String,Object> before=new HashMap<>(m.x.f.provider.storage.memory.raw);int commits=m.x.f.provider.storage.memory.commits;
            int requests=m.x.paths.size(),shows=m.x.surface.shows,cancels=m.x.surface.cancels;
            ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable",()->m.apply(claim,action));
            assertTrue("Denied action preserves all provider bytes",before.equals(m.x.f.provider.storage.memory.raw));assertEquals(commits,m.x.f.provider.storage.memory.commits);
            assertEquals(requests,m.x.paths.size());assertEquals(shows,m.x.surface.shows);assertEquals(cancels,m.x.surface.cancels);
            assertTrue(m.x.inbox(m.p.recordId).isNull(action+"_event_id"));
        }
    }
    @Test public void alreadyRecordedMirrorActionsAndPendingOpenSurviveClockLossWithoutNewFacts()throws Exception{
        for(String action:new String[]{"opened","acknowledged"}){
            Mirror m=new Mirror();m.attach();m.ready();String claim=m.claim().getString("claim_id");m.apply(claim,"displayed");m.apply(claim,action);
            String event=m.x.inbox(m.p.recordId).getString(action+"_event_id");
            m.x.elapsed=900_100;assertNull(m.claim()); // Clock invalidation is preserved evidence, not a new action fact.
            Map<String,Object> before=new HashMap<>(m.x.f.provider.storage.memory.raw);
            m.apply(claim,action);assertTrue("Original replay preserves all provider bytes",before.equals(m.x.f.provider.storage.memory.raw));
            assertEquals(event,m.x.inbox(m.p.recordId).getString(action+"_event_id"));
            if("opened".equals(action)){
                m.attach();m.ready();JSONObject pending=m.claim();assertTrue(pending.getBoolean("navigation_pending"));
                assertTrue(pending.getBoolean("historical"));assertFalse(pending.getBoolean("play_audio"));
                m.apply(pending.getString("claim_id"),"navigation_completed");assertFalse(m.x.inbox(m.p.recordId).getBoolean("navigation_pending"));
                assertEquals(event,m.x.inbox(m.p.recordId).getString("opened_event_id"));
            }
        }
    }
}
