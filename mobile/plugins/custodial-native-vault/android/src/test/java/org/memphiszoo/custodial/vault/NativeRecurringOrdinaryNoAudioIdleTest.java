package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;

/** Actual sequence ownership/ABA model only with explicit fake SDK adapter.
 * Does not prove default Runtime, real service/SDK quiet or voice completion. */
public final class NativeRecurringOrdinaryNoAudioIdleTest {
    private static final class Surface implements NativeProviderAudioSequence.Surface,NativeProviderAudioSequence.Scheduler {
        int prepare,stop,release,tone,speech;boolean failReady=true,quiet=true,released=true;
        @Override public void prepare(String operation,NativeProviderAudioSequence.Result ready){prepare++;if(failReady)ready.done(false);}
        @Override public void tone(String operation,NativeProviderAudioSequence.Authority authority,NativeProviderAudioSequence.Result result){tone++;}
        @Override public void speak(String operation,String text,NativeProviderAudioSequence.Authority authority,NativeProviderAudioSequence.Result result){speech++;}
        @Override public void stop(String operation,NativeProviderAudioSequence.Result result){stop++;result.done(quiet);}
        @Override public void release(String operation,NativeProviderAudioSequence.Result result){release++;result.done(released);}
        @Override public Object after(Runnable callback,long millis){return new Object();}
        @Override public void cancel(Object handle){}
    }
    private static class Owner implements NativeProviderAudioSequence.Owner {
        int current,begin,completed,stopped;
        @Override public void current()throws VaultFailure{current++;}
        @Override public boolean begin(){begin++;return true;}
        @Override public void completed(){completed++;}
        @Override public void stopped(){stopped++;}
    }
    @Test public void currentIdleObservationDoesNotInvokeOriginalOwnerOrSdk()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        synchronized(engine){synchronized(coordinator){var read=sequence.captureOrdinaryIdle();read.requireCurrent();read.requireCurrent();}}
        assertEquals(0,surface.prepare+surface.stop+surface.release+surface.tone+surface.speech);
    }
    @Test public void realStartEntryInvalidatesOldReadBeforeOriginalOwnerCallback()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        synchronized(engine){synchronized(coordinator){
            var old=sequence.captureOrdinaryIdle();final boolean[] seen={false};
            Owner owner=new Owner(){@Override public void current()throws VaultFailure{
                assertFalse(sequence.busy());assertThrows(VaultFailure.class,old::requireCurrent);
                assertThrows(VaultFailure.class,sequence::captureOrdinaryIdle);seen[0]=true;super.current();}};
            sequence.start("Synthetic model text",owner);assertTrue(seen[0]);assertEquals(1,owner.current);assertEquals(0,owner.begin);
            assertFalse(sequence.busy());assertEquals(0,surface.tone+surface.speech);
            assertThrows(VaultFailure.class,old::requireCurrent);sequence.captureOrdinaryIdle().requireCurrent();
        }}
    }
    @Test public void originalOwnerFailureCannotRevivePreEntryIdleRead()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        synchronized(engine){synchronized(coordinator){
            var old=sequence.captureOrdinaryIdle();Owner owner=new Owner(){@Override public void current()throws VaultFailure{
                assertFalse(sequence.busy());assertThrows(VaultFailure.class,sequence::captureOrdinaryIdle);
                throw new VaultFailure("synthetic_pre_effect_refusal");}};
            VaultFailure failure=assertThrows(VaultFailure.class,()->sequence.start("Synthetic",owner));assertEquals("synthetic_pre_effect_refusal",failure.code);
            assertFalse(sequence.busy());assertEquals(0,surface.prepare);assertThrows(VaultFailure.class,old::requireCurrent);
            sequence.captureOrdinaryIdle().requireCurrent();
        }}
    }
    @Test public void returnedQuietAndReleaseDoNotEraseEntryAba()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        synchronized(engine){synchronized(coordinator){
            var old=sequence.captureOrdinaryIdle();sequence.start("Synthetic",new Owner());
            assertEquals(1,surface.prepare);assertEquals(1,surface.stop);assertEquals(1,surface.release);assertFalse(sequence.busy());
            assertThrows(VaultFailure.class,old::requireCurrent);var fresh=sequence.captureOrdinaryIdle();fresh.requireCurrent();
        }}
    }
    @Test public void unresolvedPrepareAndUnconfirmedReleaseStayBusy()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();surface.failReady=false;
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        synchronized(engine){synchronized(coordinator){sequence.start("Synthetic",new Owner());assertTrue(sequence.busy());
            assertThrows(VaultFailure.class,sequence::captureOrdinaryIdle);}}
        Object engine2=new Object(),coordinator2=new Object();Surface other=new Surface();other.released=false;
        var second=new NativeProviderAudioSequence(engine2,coordinator2,other,other);
        synchronized(engine2){synchronized(coordinator2){second.start("Synthetic",new Owner());assertEquals(1,other.release);assertTrue(second.busy());
            assertThrows(VaultFailure.class,second::captureOrdinaryIdle);}}
    }
    @Test public void exactOriginalMonitorPairIsRequired()throws Exception {
        Object engine=new Object(),coordinator=new Object();Surface surface=new Surface();
        var sequence=new NativeProviderAudioSequence(engine,coordinator,surface,surface);
        assertThrows(VaultFailure.class,sequence::captureOrdinaryIdle);
        synchronized(engine){assertThrows(VaultFailure.class,sequence::captureOrdinaryIdle);
            synchronized(coordinator){var read=sequence.captureOrdinaryIdle();read.requireCurrent();}}
        NativeProviderAudioSequence.OrdinaryIdleRead read;
        synchronized(engine){synchronized(coordinator){read=sequence.captureOrdinaryIdle();}}
        assertThrows(VaultFailure.class,read::requireCurrent);
    }
}
