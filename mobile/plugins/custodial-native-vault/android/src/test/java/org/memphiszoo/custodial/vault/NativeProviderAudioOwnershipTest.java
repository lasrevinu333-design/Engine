package org.memphiszoo.custodial.vault;

import org.junit.Test;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;

/** Two synthetic consumers share the actual durable journal. No audio, device,
 * Android service or independently qualified effect is invoked by this proof. */
public final class NativeProviderAudioOwnershipTest {
    private static NativeProviderJournal.Observation observed() throws Exception { return NativeProviderPresentationTest.observed(); }
    @Test public void competingConsumersCannotTreatIdempotentJournalReplayAsSecondAudioPermission() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims first = new NativeProviderClaims(f.journal()), second = new NativeProviderClaims(f.journal());
        Object a = new Object(), b = new Object(); first.attach(a); second.attach(b);
        NativeProviderClaims.Claim left = first.claimNext(a, f.principal, NativeProviderPresentationTest.observed());
        NativeProviderClaims.Claim right = second.claimNext(b, f.principal, NativeProviderPresentationTest.observed());
        assertTrue(left.data().getBoolean("play_audio")); assertTrue(right.data().getBoolean("play_audio"));
        int effects = 0;
        first.apply(a, f.principal, left.id, "audio_started", NativeProviderPresentationTest.observed()); effects++;
        try { second.apply(b, f.principal, right.id, "audio_started", NativeProviderPresentationTest.observed()); effects++; }
        catch (VaultFailure refused) { assertEquals("custodial_provider_audio_already_owned", refused.code); }
        assertEquals("one durable original permits at most one first audio effect", 1, effects);
        assertEquals("IN_PROGRESS", f.record().getString("audio_state"));
    }
    @Test public void firstAcquisitionHasOneCommitAndReplayCannotGrantAnotherEffect() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        int before = f.f.r.f.storage.memory.commits; long events=f.events();
        assertTrue(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        assertEquals(before+1,f.f.r.f.storage.memory.commits);assertEquals(events,f.events());
        assertFalse(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        assertEquals(before+1,f.f.r.f.storage.memory.commits);
        // Historical generic transition remains idempotent, never a first-effect grant.
        f.action("audio_started");assertEquals(before+1,f.f.r.f.storage.memory.commits);
    }
    @Test public void completedOriginalCanNeverAcquireAgain() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        assertTrue(f.journal().tryStartAudio(f.principal,f.presentation,observed()));f.action("audio_completed");
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        assertFalse(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("COMPLETED",f.record().getString("audio_state"));
    }
    @Test public void rejectedWriteCannotGrantSoundAndLaterExactRetryMayAcquire() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);f.f.r.f.storage.memory.reject=true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved",()->f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        assertEquals(before,f.f.r.f.storage.memory.raw);f.f.r.f.storage.memory.reject=false;
        assertEquals("PENDING",f.record().getString("audio_state"));
        assertTrue(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
    }
    @Test public void persistedLostReadbackRemainsUncertainWithoutReplay() throws Exception {
        NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();f.f.r.f.storage.memory.persistThenReject=true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved",()->f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        f.f.r.f.storage.memory.persistThenReject=false;assertEquals("IN_PROGRESS",f.record().getString("audio_state"));
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        assertFalse(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
        assertEquals(before,f.f.r.f.storage.memory.raw);
    }
    @Test public void unknownExpiredOrStraddlingTimeCannotAcquireEvenWithOriginalPendingOpen() throws Exception {
        for(boolean opened:new boolean[]{false,true}){
            NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();if(opened)f.action("opened");
            Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
            for(NativeProviderJournal.Observation now:NativeProviderPresentationTest.unavailableActionTimes(f))
                ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable",()->f.journal().tryStartAudio(f.principal,f.presentation,now));
            assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("PENDING",f.record().getString("audio_state"));
        }
    }
    @Test public void dismissOrAcknowledgmentCannotBeTurnedIntoFirstAudio() throws Exception {
        for(String action:new String[]{"dismissed","acknowledged"}){
            NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();f.action(action);
            Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure("custodial_provider_operation_stale",()->f.journal().tryStartAudio(f.principal,f.presentation,observed()));
            assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals("PENDING",f.record().getString("audio_state"));
        }
    }
    @Test public void removalAndIncarnationChangeFenceFirstAcquisitionWithoutMutation() throws Exception {
        for(boolean removed:new boolean[]{false,true}){
            NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
            if(removed)f.journal().observeRemoved();else{f.journal().observeUnavailable();f.journal().observeActivePrincipal(f.principal);}
            Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure(removed?"custodial_provider_waiting_native_principal":"custodial_provider_operation_stale",()->f.journal().tryStartAudio(f.principal,f.presentation,observed()));
            assertEquals(before,f.f.r.f.storage.memory.raw);
        }
    }
    @Test public void originalOwnerMayCompleteAfterExpiryButRestartedConsumerGetsNoNewAudio() throws Exception {
        NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        NativeProviderClaims claims=new NativeProviderClaims(f.journal());Object owner=new Object();claims.attach(owner);
        NativeProviderClaims.Claim claim=claims.claimNext(owner,f.principal,observed());claims.apply(owner,f.principal,claim.id,"audio_started",observed());
        NativeProviderClaims restarted=new NativeProviderClaims(f.journal());Object next=new Object();restarted.attach(next);
        assertFalse(restarted.claimNext(next,f.principal,observed()).data().getBoolean("play_audio"));
        NativeProviderJournal.Observation expired=NativeProviderTimeTest.observation(f.f.payload.validUntil,500,7);
        claims.apply(owner,f.principal,claim.id,"audio_completed",expired);
        assertEquals("COMPLETED",f.record().getString("audio_state"));
        assertFalse(f.journal().tryStartAudio(f.principal,f.presentation,observed()));
    }
}
