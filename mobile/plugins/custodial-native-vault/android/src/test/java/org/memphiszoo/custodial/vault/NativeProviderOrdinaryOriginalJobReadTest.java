package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real encrypted journal and actual display-driver algorithms with explicit
 * synthetic host principal/time/OS fixtures. No Runtime/qualified physical clock,
 * original SDK release fact, native job or ordinary receipt authority claimed. */
public final class NativeProviderOrdinaryOriginalJobReadTest {
    private static final class Fixture {
        final NativeProviderPresentationTest.Fixture f=new NativeProviderPresentationTest.Fixture();
        // The maintained fixture factory returns a NEW Journal every call.
        // Runtime retains one actual Journal; these same-owner entry cases do too.
        final NativeProviderJournal originalJournal=f.journal();
        final Surface surface=new Surface();final NativeProviderDisplayDriver driver=new NativeProviderDisplayDriver(originalJournal,surface);
        Fixture()throws Exception{}
        NativeProviderDisplayDriver.Guard guard(){return ()->{originalJournal.requirePresentationCurrent(f.principal,f.presentation);
            try{return NativeProviderPresentationTest.observed();}catch(Exception failure){throw new VaultFailure("synthetic_time_error",failure);}};}
        void displayed()throws Exception{assertTrue(driver.display(f.principal,f.presentation,guard()));assertEquals(1,surface.shows);}
        Map<String,Object> raw(){return new HashMap<>(f.f.r.f.storage.memory.raw);}
        int commits(){return f.f.r.f.storage.memory.commits;}
        NativeProviderJournal journal(){return originalJournal;}
        NativeProviderJournal.Observation now()throws Exception{return NativeProviderPresentationTest.observed();}
    }
    private interface Hook {void run()throws Exception;}
    private static final class Surface implements NativeProviderDisplayDriver.Surface {
        NativeProviderDisplayDriver.Active active=NativeProviderDisplayDriver.Active.ABSENT;boolean enabled=true;int shows,cancels;
        Hook onActive;
        public boolean enabled(NativeProviderPayload actual){return enabled;}
        public NativeProviderDisplayDriver.Active active(NativeProviderJournal.OsDisplayIntent actual)throws Exception{
            if(onActive!=null){var once=onActive;onActive=null;once.run();}return active;}
        public void show(NativeProviderJournal.OsDisplayIntent actual){shows++;active=NativeProviderDisplayDriver.Active.MATCH;}
        public void cancel(String exact){cancels++;active=NativeProviderDisplayDriver.Active.ABSENT;}
        public boolean absent(String exact){return active==NativeProviderDisplayDriver.Active.ABSENT;}
    }
    @Test public void readOnlyJournalEntryInvalidatesEarlierReadWithoutWriting()throws Exception{
        Fixture f=new Fixture();Map<String,Object> before=f.raw();int commits=f.commits();
        var old=f.journal().captureOrdinaryReadFence();old.requireCurrent();
        f.journal().requirePresentationCurrent(f.f.principal,f.f.presentation);
        ProviderRecordStoreTest.failure("custodial_provider_original_job_stale",old::requireCurrent);
        f.journal().captureOrdinaryReadFence().requireCurrent();assertEquals(before,f.raw());assertEquals(commits,f.commits());
    }
    @Test public void refusedJournalEntryAlsoInvalidatesEarlierReadWithoutWriting()throws Exception{
        Fixture f=new Fixture();Map<String,Object> before=f.raw();int commits=f.commits();var old=f.journal().captureOrdinaryReadFence();
        ProviderRecordStoreTest.failure("custodial_provider_action_invalid",()->f.journal().applyPresentationAction(f.f.principal,f.f.presentation,"not_an_action",f.now()));
        ProviderRecordStoreTest.failure("custodial_provider_original_job_stale",old::requireCurrent);
        assertEquals(before,f.raw());assertEquals(commits,f.commits());
    }
    @Test public void anotherActualJournalAdapterCommitInvalidatesNativeStoreFence()throws Exception{
        Fixture f=new Fixture();var storage=f.f.f.r.f.storage;var old=f.journal().captureOrdinaryReadFence();
        var other=new NativeProviderJournal(storage.store(),storage.lock);
        other.applyPresentationAction(f.f.principal,f.f.presentation,"displayed",f.now());
        assertThrows(VaultFailure.class,old::requireCurrent);
        // Fresh observation is permitted; no uncertain history is erased.
        f.journal().captureOrdinaryReadFence().requireCurrent();assertFalse(f.f.record().isNull("displayed_event_id"));
    }
    @Test public void initialNativeStoreFenceRejectsMutationInsideActualFinalReadCallback()throws Exception{
        Fixture f=new Fixture();var storage=f.f.f.r.f.storage;boolean[] armed={false};int[] callbacks={0};
        ProviderRecordStore.Backend backend=new ProviderRecordStore.Backend(){
            public Object retainedSourceIdentity(){return storage.memory.retainedSourceIdentity();}
            public Map<String,?> readAll()throws Exception{
                if(armed[0]){armed[0]=false;callbacks[0]++;f.f.action("acknowledged");}
                return storage.memory.readAll();}
            public boolean replace(Map<String,String> next){throw new AssertionError("observer must not write");}
        };
        var journal=new NativeProviderJournal(new ProviderRecordStore(backend,new ProviderEnvelopeCrypto(storage.keys,()->storage.memory.readAll().isEmpty(),storage.lock),storage.lock),storage.lock);
        var initial=journal.captureOriginalStoreRead();initial.requireCurrent();int commits=f.commits();
        armed[0]=true;
        // The existing store already rejects a mutation INSIDE this read. Keep
        // that stronger refusal; never relax it to obtain a fresh tail snapshot.
        ProviderRecordStoreTest.failure("custodial_provider_retained_source_changed",journal::captureOrdinaryReadFence);
        assertEquals(1,callbacks[0]);assertEquals(commits+1,f.commits());assertFalse(f.f.record().isNull("acknowledged_event_id"));
        assertThrows(VaultFailure.class,initial::requireCurrent);
        assertFalse(f.f.record().isNull("acknowledged_event_id")); // Never roll back/retry the actual original action.
    }
    @Test public void nestedStoreReadCannotMintSettledJournalFence()throws Exception{
        Fixture f=new Fixture();var storage=f.f.f.r.f.storage;boolean[] armed={true};int[] refused={0};
        final NativeProviderJournal[] journal={null};
        ProviderRecordStore.Backend backend=new ProviderRecordStore.Backend(){
            public Object retainedSourceIdentity(){return storage.memory.retainedSourceIdentity();}
            public Map<String,?> readAll()throws Exception{
                if(armed[0]){armed[0]=false;ProviderRecordStoreTest.failure("custodial_provider_original_job_stale",()->journal[0].captureOrdinaryReadFence());refused[0]++;}
                return storage.memory.readAll();}
            public boolean replace(Map<String,String> next){throw new AssertionError("read-only case must not write");}
        };
        journal[0]=new NativeProviderJournal(new ProviderRecordStore(backend,new ProviderEnvelopeCrypto(storage.keys,()->storage.memory.readAll().isEmpty(),storage.lock),storage.lock),storage.lock);
        Map<String,Object> before=f.raw();int commits=f.commits();journal[0].requirePresentationCurrent(f.f.principal,f.f.presentation);
        assertEquals(1,refused[0]);journal[0].captureOrdinaryReadFence().requireCurrent();assertEquals(before,f.raw());assertEquals(commits,f.commits());
    }
    @Test public void originalAttemptAndCompletionObserveRealOneShotJournalLineageWithoutWriting()throws Exception{
        Fixture f=new Fixture();
        ProviderRecordStoreTest.failure("custodial_provider_original_job_unavailable",()->f.journal().observeOriginalAudioAttempt(f.f.principal,f.f.presentation,f.now()));
        assertTrue(f.journal().tryStartAudio(f.f.principal,f.f.presentation,f.now()));
        Map<String,Object> attempted=f.raw();int count=f.commits();var original=f.journal().observeOriginalAudioAttempt(f.f.principal,f.f.presentation,f.now());
        assertTrue(original.admissionOrdinal>0);assertTrue(original.recordSha256.matches("[a-f0-9]{64}"));
        ProviderRecordStoreTest.failure("custodial_provider_original_job_unavailable",()->f.journal().observeOriginalAudioCompletion(f.f.principal,f.f.presentation,f.now()));
        assertEquals(attempted,f.raw());assertEquals(count,f.commits());f.f.action("audio_completed");
        Map<String,Object> completed=f.raw();count=f.commits();var terminal=f.journal().observeOriginalAudioCompletion(f.f.principal,f.f.presentation,f.now());
        assertEquals(original.registrationId,terminal.registrationId);assertEquals(original.admissionOrdinal,terminal.admissionOrdinal);
        assertNotEquals(original.recordSha256,terminal.recordSha256);assertFalse(f.journal().tryStartAudio(f.f.principal,f.f.presentation,f.now()));
        assertEquals(completed,f.raw());assertEquals(count,f.commits());
    }
    @Test public void completedJournalAloneDoesNotConstructOriginalRuntimeReadOrReleaseFact()throws Exception{
        Fixture f=new Fixture();assertTrue(f.journal().tryStartAudio(f.f.principal,f.f.presentation,f.now()));f.f.action("audio_completed");
        assertNotNull(f.journal().observeOriginalAudioCompletion(f.f.principal,f.f.presentation,f.now()));
        // Constructor privacy is a boundary check, not reflective manufacture.
        for(var constructor:NativeProviderRuntimeOwner.OrdinaryOriginalJobRead.class.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        for(var constructor:NativeProviderAudioSequence.ReleasedCompletion.class.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
    }
    @Test public void retiredAcknowledgedAndCancelPendingOriginalsCannotBecomeCurrentReads()throws Exception{
        for(String kind:new String[]{"dismissed","acknowledged","cancel"}){
            Fixture f=new Fixture();assertTrue(f.journal().tryStartAudio(f.f.principal,f.f.presentation,f.now()));f.f.action("audio_completed");
            if("cancel".equals(kind))f.journal().requestOsCancellation(f.f.principal,f.f.presentation);else f.f.action(kind);
            Map<String,Object> before=f.raw();int count=f.commits();
            ProviderRecordStoreTest.failure("custodial_provider_original_job_unavailable",()->f.journal().observeOriginalAudioCompletion(f.f.principal,f.f.presentation,f.now()));
            assertEquals(before,f.raw());assertEquals(count,f.commits());
        }
    }
    @Test public void missingQualifiedIntervalNeverBecomesOriginalJobRead()throws Exception{
        Fixture f=new Fixture();assertTrue(f.journal().tryStartAudio(f.f.principal,f.f.presentation,f.now()));f.f.action("audio_completed");
        Map<String,Object> before=f.raw();int count=f.commits();
        ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable",()->f.journal().observeOriginalAudioCompletion(f.f.principal,f.f.presentation,NativeProviderIngressTest.observation(null,500,7)));
        assertEquals(before,f.raw());assertEquals(count,f.commits());
    }
    @Test public void genuineDisplayedObservationIsReadOnlyAndNeverNotifiesAgain()throws Exception{
        Fixture f=new Fixture();f.displayed();Map<String,Object> before=f.raw();int count=f.commits();
        f.driver.requireOriginalDisplayed(f.f.principal,f.f.presentation,f.guard());
        assertEquals(before,f.raw());assertEquals(count,f.commits());assertEquals(1,f.surface.shows);assertEquals(0,f.surface.cancels);
    }
    @Test public void absentConflictOrDisabledActualCardNeverPassesDisplayRead()throws Exception{
        for(String mode:new String[]{"ABSENT","CONFLICT","DISABLED"}){
            Fixture f=new Fixture();f.displayed();if("DISABLED".equals(mode))f.surface.enabled=false;
            else f.surface.active=NativeProviderDisplayDriver.Active.valueOf(mode);
            Map<String,Object> before=f.raw();int count=f.commits();
            ProviderRecordStoreTest.failure("custodial_provider_os_display_unconfirmed",()->f.driver.requireOriginalDisplayed(f.f.principal,f.f.presentation,f.guard()));
            assertEquals(before,f.raw());assertEquals(count,f.commits());assertEquals(1,f.surface.shows);assertEquals(0,f.surface.cancels);
        }
    }
    @Test public void actualAcknowledgementInsideOsReadIsRefusedByTrailingNativeGuard()throws Exception{
        Fixture f=new Fixture();f.displayed();f.surface.onActive=()->f.f.action("acknowledged");int before=f.commits();
        VaultFailure failure=assertThrows(VaultFailure.class,()->f.driver.requireOriginalDisplayed(f.f.principal,f.f.presentation,()->{
            var now=f.guard().current();
            try{if(!f.f.record().isNull("acknowledged_event_id"))throw new VaultFailure("custodial_provider_original_job_unavailable");}
            catch(VaultFailure original){throw original;}catch(Exception unavailable){throw new VaultFailure("synthetic_record_read_error",unavailable);}
            return now;}));
        assertEquals("custodial_provider_original_job_unavailable",failure.code);assertEquals(before+1,f.commits());
        assertFalse(f.f.record().isNull("acknowledged_event_id"));assertEquals(1,f.surface.shows);assertEquals(0,f.surface.cancels);
    }
    @Test public void mirrorDisplayWithoutActualOriginalOsIntentCannotPassRead()throws Exception{
        Fixture f=new Fixture();f.f.action("displayed");f.surface.active=NativeProviderDisplayDriver.Active.MATCH;
        Map<String,Object> before=f.raw();int count=f.commits();
        ProviderRecordStoreTest.failure("custodial_provider_original_job_unavailable",()->f.driver.requireOriginalDisplayed(f.f.principal,f.f.presentation,f.guard()));
        assertEquals(before,f.raw());assertEquals(count,f.commits());assertEquals(0,f.surface.shows);
    }
}
