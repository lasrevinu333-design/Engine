package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import org.junit.Test;

/** Actual engine/context/Android adapter chain with synthetic HTTP/key/disk.
 * Not mounted Android/process-death/physical acceptance. */
public final class NativeSeparationFreezeTest {
    static final class Fixture {
        final NativeSeparationTransportTest.Fixture transport=new NativeSeparationTransportTest.Fixture();
        final AndroidProtectedWorkPreferencesTest.Preferences preferences=new AndroidProtectedWorkPreferencesTest.Preferences();
        final TestCipher workCipher=new TestCipher();
        final AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(preferences.object(),workCipher);
        final NativePrincipalJournal principal=new NativePrincipalJournal(store);
        Fixture()throws Exception{store.savePrincipal(transport.store.value);preferences.disk.put("unknown-old-work","unreadable preserved");}
        NativeSeparationEvidence observe()throws VaultFailure{return NativeSeparationFreeze.observe(transport.engine,store,principal,null);}
    }
    @Test public void completeNativeChainFreezesExactOriginalAndSafeRetry()throws Exception{
        var f=new Fixture();var before=new HashMap<>(f.preferences.disk);var state=f.transport.engine.getState();
        var proof=f.observe();assertEquals(NativeProtectedWorkSnapshot.capture(before).digest,proof.rawSnapshotDigest);
        for(var e:before.entrySet())assertEquals(e.getValue(),f.preferences.disk.get(e.getKey()));
        assertEquals(state,f.transport.engine.getState());assertEquals(0,f.workCipher.destroyCalls);
        assertEquals(1,f.transport.calls);String encrypted=(String)f.preferences.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        var retried=f.observe();assertEquals(proof.body,retried.body);assertEquals(encrypted,f.preferences.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
        AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());assertEquals(1,f.transport.calls);
    }
    @Test public void durablePreHttpGuardRefusesOrdinaryWriterWithoutDroppingOriginals()throws Exception{
        var f=new Fixture();String receiptKey="a".repeat(64),receipt="exact newly arrived receipt";
        // TestCipher is deterministic; saving the same principal is not a mutation.
        // Once the durable check starts, ordinary work cannot race its inventory.
        f.transport.hook=()->f.store.saveCompletionReceipt(receiptKey,receipt);
        AndroidProtectedWorkPreferencesTest.denied(()->f.observe());
        assertFalse(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertEquals("unreadable preserved",f.preferences.disk.get("unknown-old-work"));assertNotNull(f.principal.readFor(f.transport.engine.getState()));
        assertNull(f.store.loadCompletionReceipt(receiptKey));AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());
        f.transport.hook=()->{};assertNotNull(f.observe());
    }
    @Test public void failedHttpIsNotSeparationAuthorityAndDoesNotEraseWork()throws Exception{
        var f=new Fixture();var original=new HashMap<>(f.preferences.disk);
        f.transport.hook=()->{throw new VaultFailure("synthetic_service_unavailable");};
        AndroidProtectedWorkPreferencesTest.denied(()->f.observe());
        for(var entry:original.entrySet())assertEquals(entry.getValue(),f.preferences.disk.get(entry.getKey()));
        assertEquals(original.size()+1,f.preferences.disk.size());assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertFalse(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.restore(f.transport.engine,f.store,f.principal,null));f.transport.wiped();
    }
    @Test public void corruptedOrForeignExistingFenceCannotBeReplaced()throws Exception{
        for(Object existing:new Object[]{"unreadable retained fence",7}){
            var f=new Fixture();f.preferences.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,existing);var original=new HashMap<>(f.preferences.disk);
            AndroidProtectedWorkPreferencesTest.denied(()->f.observe());assertEquals(original,f.preferences.disk);
        }
    }
    @Test public void failedMemoryOnlyCommitThenWholeCoordinatorRetryIsDurable()throws Exception{
        var f=new Fixture();f.transport.hook=()->f.preferences.persistThenFail=true;AndroidProtectedWorkPreferencesTest.denied(()->f.observe());
        String encrypted=(String)f.preferences.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);assertNotNull(encrypted);
        assertFalse(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));f.preferences.persistThenFail=false;f.transport.hook=()->{};
        f.observe();assertEquals(encrypted,f.preferences.durableDisk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
        f.preferences.disk=new HashMap<>(f.preferences.durableDisk);
        AndroidProtectedWorkPreferencesTest.denied(()->new AndroidOfflineAuthorityTimeStore(f.preferences.object(),f.workCipher).requireWorkAdmission());
    }
    @Test public void restartedAdapterReadsExactOriginalProofWithoutNetworkOrWrites()throws Exception{
        var f=new Fixture();var proof=f.observe();var bytes=new HashMap<>(f.preferences.durableDisk);var state=f.transport.engine.getState();
        int encryptions=f.workCipher.existingKeyEncryptCalls;
        f.preferences.disk=new HashMap<>(bytes);
        var restarted=new AndroidOfflineAuthorityTimeStore(f.preferences.object(),f.workCipher);
        var restored=NativeSeparationFreeze.restore(f.transport.engine,restarted,new NativePrincipalJournal(restarted),null);
        assertEquals(proof.body,restored.body);assertEquals(proof.signature,restored.signature);
        assertEquals(bytes,f.preferences.disk);assertEquals(bytes,f.preferences.durableDisk);assertEquals(state,f.transport.engine.getState());
        assertEquals(1,f.transport.calls);assertEquals(encryptions,f.workCipher.existingKeyEncryptCalls);assertEquals(0,f.workCipher.destroyCalls);
        AndroidProtectedWorkPreferencesTest.denied(()->restarted.requireWorkAdmission());
    }
    @Test public void missingCorruptOrChangedRetainedRawWorkNeverBecomesEmptyRecovery()throws Exception{
        for(int variation=0;variation<4;variation++){
            var f=new Fixture();f.observe();
            if(variation==0)f.preferences.disk.remove(AndroidProtectedWorkPreferences.FENCE_KEY);
            if(variation==1)f.preferences.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,"corrupt retained fence");
            if(variation==2)f.preferences.disk.put("unknown-old-work","changed original bytes");
            if(variation==3)f.preferences.disk.remove("unknown-old-work");
            var before=new HashMap<>(f.preferences.disk);
            AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.restore(f.transport.engine,f.store,f.principal,null));
            assertEquals(before,f.preferences.disk);assertEquals(1,f.transport.calls);
        }
    }
    @Test public void changedRawReadbackDuringRestoreIsRefusedWithoutAdoption()throws Exception{
        var f=new Fixture();f.observe();
        NativeSeparationFreeze.Store interrupted=new NativeSeparationFreeze.Store(){
            public java.util.Map<String,?> separationRawSnapshot()throws VaultFailure{return f.store.separationRawSnapshot();}
            public void prepareSeparationProbe(java.util.Map<String,?> raw){fail("restore must not prepare");}
            public org.json.JSONObject readSeparationSnapshotEvidence(java.util.Map<String,?> captured)throws VaultFailure{
                var evidence=f.store.readSeparationSnapshotEvidence(captured);f.preferences.disk.put("unknown-old-work","changed while decoding");return evidence;
            }
            public void freezeSeparationSnapshot(java.util.Map<String,?> raw,NativeSeparationEvidence evidence){fail("restore must not write");}
        };
        AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.restore(f.transport.engine,interrupted,f.principal,null));
        assertEquals("changed while decoding",f.preferences.disk.get("unknown-old-work"));assertEquals(1,f.transport.calls);
    }
    @Test public void failedProbePersistenceNeverStartsAuthenticatedTransport()throws Exception{
        for(boolean memoryOnly:new boolean[]{false,true}){
            var f=new Fixture();var before=new HashMap<>(f.preferences.disk);
            f.preferences.fail=!memoryOnly;f.preferences.persistThenFail=memoryOnly;
            AndroidProtectedWorkPreferencesTest.denied(()->f.observe());assertEquals(0,f.transport.calls);
            for(var e:before.entrySet())assertEquals(e.getValue(),f.preferences.disk.get(e.getKey()));
            assertFalse(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            assertFalse(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        }
    }
    @Test public void postObservationCryptoOrCommitFailureRemainsDurablyPendingAfterRestart()throws Exception{
        for(int failure=0;failure<3;failure++){
            var f=new Fixture();var originals=new HashMap<>(f.preferences.disk);final int selected=failure;
            f.transport.hook=()->{if(selected==0)f.workCipher.failEncrypts=1;else if(selected==1)f.preferences.fail=true;else f.preferences.persistThenFail=true;};
            AndroidProtectedWorkPreferencesTest.denied(()->f.observe());assertEquals(1,f.transport.calls);
            assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            f.preferences.disk=new HashMap<>(f.preferences.durableDisk);f.preferences.fail=false;f.preferences.persistThenFail=false;f.transport.hook=()->{};
            var restarted=new AndroidOfflineAuthorityTimeStore(f.preferences.object(),f.workCipher);
            AndroidProtectedWorkPreferencesTest.denied(()->restarted.requireWorkAdmission());
            AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.restore(f.transport.engine,restarted,new NativePrincipalJournal(restarted),null));
            for(var e:originals.entrySet())assertEquals(e.getValue(),f.preferences.disk.get(e.getKey()));
            NativeSeparationFreeze.observe(f.transport.engine,restarted,new NativePrincipalJournal(restarted),null);
            assertFalse(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
            for(var e:originals.entrySet())assertEquals(e.getValue(),f.preferences.disk.get(e.getKey()));
        }
    }
}
