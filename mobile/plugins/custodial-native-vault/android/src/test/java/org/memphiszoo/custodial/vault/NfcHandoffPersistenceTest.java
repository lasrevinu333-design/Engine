package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.*;
import org.junit.Test;

/** Actual native handoff/store path; controlled preferences/cipher/URI, no hardware proof. */
public final class NfcHandoffPersistenceTest {
    static final String URL="memphiszoo://scan?code=NOCX", ID="nfc-a.v1:04010203040506";
    static final String KEY="native_nfc_handoffs";
    static AndroidOfflineAuthorityTimeStore store(PhysicalTagOccurrenceTest.Preferences p) {
        return new AndroidOfflineAuthorityTimeStore(p.object(),new TestCipher());
    }
    static void uncertain(PhysicalTagOccurrenceTest.Attempt attempt) throws Exception {
        PhysicalTagOccurrenceTest.refused("custodial_native_nfc_handoff_persistence_uncertain",attempt);
    }
    @Test public void memoryOnlyFailedWriteDoesNotCreateUnlocatedPendingCapacity() throws Exception {
        var prefs=new PhysicalTagOccurrenceTest.Preferences();
        var store=new AndroidOfflineAuthorityTimeStore(prefs.object(),new TestCipher());
        prefs.beforeCommit=()->prefs.persistThenFail=prefs.commits==1;
        boolean failed=false;
        try { NativeNfcScanHandoff.record(store,URL,1000,7,ID); }
        catch(VaultFailure expected) { failed=true; }
        // A definite refusal must leave no pending entry. A durable successful
        // retry may retain one entry only if its exact ID was returned.
        if(failed)assertTrue("failed commit must not silently retain an unlocated pending entry",store.loadNfcHandoffs().isEmpty());
        else assertEquals(prefs.disk,prefs.durableDisk);
    }
    @Test public void exactCiphertextRetryReturnsOnlyDurableOriginalLocator() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        List<Object> observed=new ArrayList<>();
        p.beforeCommit=()->p.persistThenFail=p.commits==1;
        p.afterCommit=()->observed.add(p.disk.get(KEY));
        var result=NativeNfcScanHandoff.recordResult(s,URL,1000,7,ID);
        assertTrue(result.durable);assertFalse(result.handoffId.isEmpty());
        assertEquals(2,p.commits);assertEquals(observed.get(0),observed.get(1));
        assertEquals(p.disk,p.durableDisk);
        assertEquals(ID,NativeNfcScanHandoff.require(store(p),result.handoffId,1001,7).get("native_tag_identity"));
    }
    @Test public void repeatedAmbiguousFailuresHoldOneLocatorThenHealthyFifthReadSucceeds() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        p.disk.put("unrelated_pending_draft","exact-original-bytes");p.durableDisk=new HashMap<>(p.disk);
        p.persistThenFail=true;
        var first=NativeNfcScanHandoff.recordResult(s,URL,1000,7,ID);
        assertFalse(first.durable);assertFalse(first.handoffId.isEmpty());
        for(int i=0;i<3;i++) {
            long time=1001+i;
            uncertain(()->NativeNfcScanHandoff.recordResult(store(p),URL,time,7,ID));
            uncertain(()->NativeNfcScanHandoff.require(store(p),first.handoffId,time,7));
        }
        p.persistThenFail=false;
        var fifth=NativeNfcScanHandoff.recordResult(store(p),URL,1005,7,ID);
        assertTrue(fifth.durable);assertFalse(first.handoffId.equals(fifth.handoffId));
        assertEquals(Set.of(fifth.handoffId),store(p).loadNfcHandoffs().keySet());
        assertEquals(p.disk,p.durableDisk);assertEquals("exact-original-bytes",p.disk.get("unrelated_pending_draft"));
        assertEquals(0,p.applies);assertEquals(0,p.clears);
    }
    @Test public void verifiedRollbackRestoresExistingCiphertextAndProtectedWorkExactly() throws Exception {
        var f=new PhysicalTagOccurrenceTest.Fixture();f.start();
        f.prefs.disk.put("unrelated_pending_draft","draft-bytes");
        String legacy=NativeNfcScanHandoff.record(f.store,URL,1000,7);
        Map<String,Object> before=new HashMap<>(f.prefs.disk);
        int next=f.prefs.commits+1;
        f.prefs.beforeCommit=()->f.prefs.persistThenFail=f.prefs.commits<next+2;
        var failed=NativeNfcScanHandoff.recordResult(f.store,URL,1001,7,ID);
        assertFalse(failed.durable);assertEquals("",failed.handoffId);
        assertEquals(before,f.prefs.disk);assertEquals(before,f.prefs.durableDisk);
        assertEquals(Set.of(legacy),f.store.loadNfcHandoffs().keySet());
        assertEquals(ID,f.store.loadOccurrence(f.session).nativeTagIdentity);
        assertEquals(0,f.prefs.applies);assertEquals(0,f.prefs.clears);
    }
    @Test public void verifiedRollbackRemovesOnlyNewKeyWhenOriginalWasAbsent() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        p.disk.put("protected_queue","original-queue");p.durableDisk=new HashMap<>(p.disk);
        Map<String,Object> before=new HashMap<>(p.disk);
        p.beforeCommit=()->p.persistThenFail=p.commits<3;
        var result=NativeNfcScanHandoff.recordResult(s,URL,1000,7,ID);
        assertFalse(result.durable);assertEquals("",result.handoffId);
        assertEquals(before,p.disk);assertEquals(before,p.durableDisk);assertFalse(p.disk.containsKey(KEY));
    }
    @Test public void uncertainRollbackSurvivesNewStoreAndBlocksClaimUntilVerified() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        String original=NativeNfcScanHandoff.record(s,URL,1000,7,ID);
        Map<String,Object> before=new HashMap<>(p.disk);
        p.persistThenFail=true;
        var result=NativeNfcScanHandoff.recordResult(s,URL,1001,7,ID);
        assertFalse(result.durable);assertFalse(result.handoffId.isEmpty());
        uncertain(()->NativeNfcScanHandoff.require(store(p),result.handoffId,1002,7));
        uncertain(()->store(p).loadNfcHandoffsForPhysicalRead());
        p.persistThenFail=false;
        assertEquals(Set.of(original),store(p).loadNfcHandoffs().keySet());
        assertEquals(before,p.disk);assertEquals(before,p.durableDisk);
    }
    @Test public void unexplainedReadbackCannotBeOverwrittenOrAccepted() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        p.afterCommit=()->p.disk.put(KEY,"unexplained-third-ciphertext");
        var result=NativeNfcScanHandoff.recordResult(s,URL,1000,7,ID);
        assertFalse(result.durable);assertFalse(result.handoffId.isEmpty());
        assertEquals("unexplained-third-ciphertext",p.disk.get(KEY));
        int commits=p.commits;
        uncertain(()->store(p).loadNfcHandoffsForPhysicalRead());
        assertEquals(commits,p.commits);assertEquals("unexplained-third-ciphertext",p.disk.get(KEY));
    }
    @Test public void definitiveNoWriteFailureRollsBackWithoutNavigationAuthority() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        p.beforeCommit=()->p.fail=p.commits==1;
        var result=NativeNfcScanHandoff.recordResult(s,URL,1000,7,ID);
        assertFalse(result.durable);assertEquals("",result.handoffId);assertEquals(2,p.commits);
        assertTrue(s.loadNfcHandoffs().isEmpty());assertFalse(p.disk.containsKey(KEY));
    }
    @Test public void fourLegitimatePendingEntriesAreNeverEvictedByTheFix() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        Set<String> original=new HashSet<>();
        for(int i=0;i<4;i++)original.add(NativeNfcScanHandoff.record(s,URL,1000+i,7,ID));
        Map<String,Object> before=new HashMap<>(p.disk);
        PhysicalTagOccurrenceTest.refused("custodial_native_nfc_handoff_capacity_reached",()->NativeNfcScanHandoff.recordResult(s,URL,1005,7,ID));
        assertEquals(before,p.disk);assertEquals(original,s.loadNfcHandoffs().keySet());
    }
    @Test public void rejectedIdentityLeavesOriginalProtectedBytesUntouched() throws Exception {
        var p=new PhysicalTagOccurrenceTest.Preferences();var s=store(p);
        p.disk.put("pending_legacy_work","retained");Map<String,Object> before=new HashMap<>(p.disk);
        PhysicalTagOccurrenceTest.refused("custodial_native_tag_identity_unavailable",()->NativeNfcScanHandoff.recordResult(s,URL,1000,7,"nfc-a.v1:08010203"));
        assertEquals(before,p.disk);assertEquals(0,p.commits);
    }
}
