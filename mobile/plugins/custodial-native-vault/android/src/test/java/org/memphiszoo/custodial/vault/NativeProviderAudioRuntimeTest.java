package org.memphiszoo.custodial.vault;
import org.junit.Test;import static org.junit.Assert.*;import java.util.List;import org.json.JSONObject;
/** Actual owner/journal/transport composition, synthetic clocks/SDK edges. */
public final class NativeProviderAudioRuntimeTest {
    @Test public void nativeOwnerStartsOriginalAndMirrorCannotAcquireSecondSound()throws Exception{
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderAudioSequenceTest.Fixture sdk=new NativeProviderAudioSequenceTest.Fixture();x.audioSurface=sdk;x.audioScheduler=sdk;x.owner=x.reconstruct();
        NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        assertEquals("IN_PROGRESS",x.inbox(p.recordId).getString("audio_state"));assertEquals(List.of("tone"),sdk.effects);
        Object plugin=new Object();java.util.Map<String,Object> attachment=x.owner.mirrorAttach(plugin,(incarnation,revision)->{});String id=(String)attachment.get("attachment_id");x.owner.mirrorStopped(plugin,id);
        JSONObject claim=x.owner.mirrorClaimNext(plugin,id);assertNotNull(claim);assertFalse(claim.getBoolean("play_audio"));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->x.owner.mirrorApply(plugin,id,claim.getString("claim_id"),"audio_started"));
        sdk.full();assertEquals("COMPLETED",x.inbox(p.recordId).getString("audio_state"));x.sync();assertEquals(2,sdk.texts.size());
    }
    @Test public void nextNativeRecordWaitsAndStartsOnlyAfterOriginalQuietRelease()throws Exception{
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);NativeProviderAudioSequenceTest.Fixture sdk=new NativeProviderAudioSequenceTest.Fixture();
        x.audioSurface=sdk;x.audioScheduler=sdk;x.owner=x.reconstruct();NativeProviderPayload first=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{first};x.sync();
        NativeProviderPayload second=NativeProviderCompositionTest.payload(new NativeProviderIngressTest.Fixture(true,false),77);
        // Match the current prepared native generation, preserving every exact
        // source payload field except a distinct job identity.
        java.util.Map<String,String> data=new java.util.TreeMap<>(first.data());data.put("receipt_job_id",second.get("receipt_job_id"));
        second=NativeProviderPayloadTest.accept(NativeProviderPayloadTest.signed(data));x.owner.receive(second);x.sync();assertEquals(1,sdk.effects.stream().filter("tone"::equals).count());
        sdk.full();x.sync();assertEquals(3,sdk.effects.stream().filter("tone"::equals).count());assertEquals("IN_PROGRESS",x.inbox(second.recordId).getString("audio_state"));sdk.full();
    }
    @Test public void currentIncarnationLossStopsWithoutCompletedOrReplay()throws Exception{
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);NativeProviderAudioSequenceTest.Fixture sdk=new NativeProviderAudioSequenceTest.Fixture();
        x.audioSurface=sdk;x.audioScheduler=sdk;x.owner=x.reconstruct();NativeProviderPayload p=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{p};x.sync();
        x.journal.observeUnavailable();x.journal.observeActivePrincipal(x.f.principal);x.owner.reconcile();
        assertEquals(List.of("tone","stop","release"),sdk.effects);assertEquals("IN_PROGRESS",x.inbox(p.recordId).getString("audio_state"));x.sync();assertEquals(1,sdk.effects.stream().filter("tone"::equals).count());
    }
    @Test public void incompleteAudioEvidenceCannotJoinValidClockAdmission()throws Exception{
        NativeProviderAppIdentity app=NativeProviderJournalTest.app();NativeProviderTime.Profile profile=NativeProviderTimeTest.profile(0,0,1000000000L);
        NativeProviderReleaseAdmission.Release time=new NativeProviderReleaseAdmission.Release(app.versionCode,app.versionName,profile,"a".repeat(64),"b".repeat(64));
        NativeProviderReleaseAdmission.Selected clock=NativeProviderReleaseAdmission.select(new NativeProviderReleaseAdmission.Release[]{time},profile.platform,app);
        NativeProviderAudioPolicy policy=new NativeProviderAudioPolicy("synthetic.tts","syntheticVoice",900,"c".repeat(64),"d".repeat(64));
        NativeProviderAudioAdmission.Entry entry=new NativeProviderAudioAdmission.Entry(app.versionCode,app.versionName,profile.fingerprint(),"a".repeat(64),"b".repeat(64),policy);
        assertNull(NativeProviderAudioAdmission.compiled(app,clock));assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[0],app,clock));
        assertSame(policy,NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{entry},app,clock));
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{entry,entry},app,clock));
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{entry},app,null));
        NativeProviderAudioAdmission.Entry crossed=new NativeProviderAudioAdmission.Entry(app.versionCode,app.versionName,profile.fingerprint(),"e".repeat(64),"b".repeat(64),policy);
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{crossed},app,clock));
    }
}
