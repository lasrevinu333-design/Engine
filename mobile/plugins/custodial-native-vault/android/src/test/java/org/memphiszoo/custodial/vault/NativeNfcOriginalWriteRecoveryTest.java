package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.util.*;
import org.json.JSONObject;
import org.junit.Test;

/** NEW owning fixed-NFC-row protocol cases. Durable/memory preferences are an
 * explicit fault model and existing-key access is TestCipher, not Android disk,
 * Keystore, OS restart, physical tag acceptance or all8/browser qualification.
 * Candidate handoff maps are synthetic; no scan/UI/navigation is exercised.
 */
public final class NativeNfcOriginalWriteRecoveryTest {
    static final String ROW="native_nfc_handoffs",PENDING="native_nfc_original_write_attempt.v1",GEN="native_nfc_original_write_generation.v1";
    static final String A="00000000-0000-4000-8000-000000000011",B="00000000-0000-4000-8000-000000000012";
    interface Action {void run()throws Exception;}
    static void uncertain(Action a)throws Exception {try{a.run();fail("expected retained original uncertainty");}catch(VaultFailure expected){}}
    static final class Fixture {
        final PhysicalTagOccurrenceTest.Preferences p=new PhysicalTagOccurrenceTest.Preferences();
        final TestCipher cipher=new TestCipher();final AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        Fixture(){p.disk.put("unrelated_pending","original unreadable bytes");p.disk.put("float",Float.intBitsToFloat(0x7fc00001));p.durableDisk=new HashMap<>(p.disk);}
    }
    static Map<String,Object> record(String id,String state){return new LinkedHashMap<>(Map.of("handoff_id",id,"entry_id",id,"state",state,"url","memphiszoo://scan?code=NOCX","native_tag_identity","nfc-a.v1:04010203040506","created_elapsed_ms",1000L,"expires_elapsed_ms",31000L,"boot_count",7));}
    static AndroidOfflineAuthorityTimeStore.NfcHandoffCapture capture(Fixture f,String id)throws Exception {
        var c=f.store.loadNfcHandoffsForPhysicalRead();c.handoffs.put(id,record(id,"PENDING"));return c;
    }
    static PhysicalTagOccurrenceTest.Preferences restart(PhysicalTagOccurrenceTest.Preferences p){
        var next=new PhysicalTagOccurrenceTest.Preferences();next.disk=new HashMap<>(p.durableDisk);next.durableDisk=new HashMap<>(p.durableDisk);return next;
    }
    static JSONObject pending(TestCipher cipher,Object encoded)throws Exception {
        JSONObject envelope=new JSONObject((String)encoded);char[] clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
        try{return new JSONObject(String.valueOf(clear));}finally{VaultValidation.wipe(clear);}
    }
    @Test public void durableOriginalAttemptMustPrecedeTheCandidateBody()throws Exception {
        var f=new Fixture();var c=capture(f,A);
        f.p.afterCommit=()->{if(f.p.disk.containsKey(ROW))assertTrue("original durable journal must precede the NFC body",f.p.durableDisk.containsKey(PENDING));};
        assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,f.store.persistPhysicalNfcHandoffs(c));
        assertEquals(2,f.p.commits);assertEquals(f.p.disk,f.p.durableDisk);assertFalse(f.p.disk.containsKey(PENDING));
        assertTrue(((String)f.p.disk.get(GEN)).matches("[a-f0-9-]{36}"));assertEquals("original unreadable bytes",f.p.disk.get("unrelated_pending"));
        assertEquals(0,f.cipher.destroyCalls);assertEquals(Set.of(A),f.store.loadNfcHandoffs().keySet());
    }
    @Test public void crashModelRecoversOriginalAttemptWithoutNewCiphertextOrLocator()throws Exception {
        var f=new Fixture();var c=capture(f,A);f.p.beforeCommit=()->f.p.persistThenFail=f.p.commits>=2;
        assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,f.store.persistPhysicalNfcHandoffs(c));
        assertTrue(f.p.durableDisk.containsKey(PENDING));assertFalse(f.p.durableDisk.containsKey(ROW));
        JSONObject journal=pending(f.cipher,f.p.durableDisk.get(PENDING));String id=journal.getString("operation_id");int encrypts=f.cipher.existingKeyEncryptCalls;
        var next=restart(f.p);var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),f.cipher);
        assertTrue(recreated.loadNfcHandoffs().isEmpty());assertEquals(encrypts,f.cipher.existingKeyEncryptCalls);
        assertEquals(id,next.disk.get(GEN));assertFalse(next.disk.containsKey(PENDING));assertEquals(next.disk,next.durableDisk);
        assertEquals("original unreadable bytes",next.disk.get("unrelated_pending"));assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void pendingOriginalDeniesEveryOrdinaryEditorAndCannotBecomeSeparationFence()throws Exception {
        var f=new Fixture();var c=capture(f,A);f.p.beforeCommit=()->f.p.persistThenFail=f.p.commits>=2;
        assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,f.store.persistPhysicalNfcHandoffs(c));
        var guard=new AndroidProtectedWorkPreferences(f.p.object());int count=f.p.commits;assertTrue(guard.frozen());
        assertFalse(guard.edit().putString("new","invented").commit());assertFalse(guard.edit().remove(PENDING).commit());assertFalse(guard.edit().remove(GEN).commit());
        uncertain(()->guard.freeze(guard.protectedSnapshot(),"not separation authority"));uncertain(f.store::requireOrdinaryVaultAdmission);
        assertEquals(count,f.p.commits);assertEquals(0,f.p.clears);assertEquals(0,f.p.applies);
    }
    @Test public void recoveredJournalCannotOverwriteThirdCiphertextOrChangedUnknownRows()throws Exception {
        for(boolean third:new boolean[]{false,true}){
            var f=new Fixture();var c=capture(f,A);f.p.beforeCommit=()->f.p.persistThenFail=f.p.commits>=2;
            assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,f.store.persistPhysicalNfcHandoffs(c));
            var next=restart(f.p);if(third)next.disk.put(ROW,"unexplained third");else next.disk.put("float",Float.intBitsToFloat(0x7fc00002));
            next.durableDisk=new HashMap<>(next.disk);var before=new HashMap<>(next.disk);
            var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),f.cipher);
            uncertain(recreated::loadNfcHandoffs);assertEquals(0,next.commits);assertTrue(next.disk.containsKey(PENDING));assertEquals(before,next.disk);
        }
    }
    @Test public void sameExactNfcCiphertextAfterRollbackHasAChangedDurableGeneration()throws Exception {
        var f=new Fixture();assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,f.store.persistPhysicalNfcHandoffs(capture(f,A)));
        var before=new HashMap<>(f.p.disk);Object oldCiphertext=before.get(ROW),oldGen=before.get(GEN);int first=f.p.commits+1;
        var c=capture(f,B);f.p.beforeCommit=()->f.p.persistThenFail=f.p.commits>=first+1;
        assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,f.store.persistPhysicalNfcHandoffs(c));
        var next=restart(f.p);var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),f.cipher);
        assertEquals(Set.of(A),recreated.loadNfcHandoffs().keySet());assertEquals(oldCiphertext,next.disk.get(ROW));
        assertNotEquals("ABA cannot re-use the old durable NFC generation",oldGen,next.disk.get(GEN));
        assertEquals(0x7fc00001,Float.floatToRawIntBits((Float)next.disk.get("float")));
    }
    @Test public void staleOriginalCaptureAfterWorkAbaCannotBeginJournalOrEncryptCandidate()throws Exception {
        var f=new Fixture();var c=capture(f,A);var guard=new AndroidProtectedWorkPreferences(f.p.object());
        assertTrue(guard.edit().putString("unrelated_pending","B").commit());assertTrue(guard.edit().putString("unrelated_pending","original unreadable bytes").commit());
        var before=new HashMap<>(f.p.disk);int count=f.p.commits,encrypts=f.cipher.existingKeyEncryptCalls;
        uncertain(()->f.store.persistPhysicalNfcHandoffs(c));assertEquals(before,f.p.disk);assertEquals(count,f.p.commits);
        assertEquals(encrypts,f.cipher.existingKeyEncryptCalls);assertFalse(f.p.disk.containsKey(PENDING));
    }
    @Test public void ordinaryClaimUpdatesUseSameProtocolWithoutInventingAnotherLocator()throws Exception {
        var f=new Fixture();assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.DURABLE,f.store.persistPhysicalNfcHandoffs(capture(f,A)));
        Object before=f.p.disk.get(GEN);var handoffs=f.store.loadNfcHandoffs();handoffs.get(A).put("state","CLAIMED");f.store.saveNfcHandoffs(handoffs);
        assertEquals(Set.of(A),f.store.loadNfcHandoffs().keySet());assertEquals("CLAIMED",f.store.loadNfcHandoffs().get(A).get("state"));
        assertNotEquals(before,f.p.disk.get(GEN));assertEquals(f.p.disk,f.p.durableDisk);assertFalse(f.p.disk.containsKey(PENDING));
    }
    @Test public void malformedOriginalMarkerOrGenerationRemainsUnreadableAndDenied()throws Exception {
        for(String key:List.of(PENDING,GEN))for(Object value:List.of(false,17,"malformed")){
            var f=new Fixture();f.p.disk.put(key,value);f.p.durableDisk=new HashMap<>(f.p.disk);var before=new HashMap<>(f.p.disk);
            uncertain(f.store::requireWorkAdmission);uncertain(f.store::loadNfcHandoffsForPhysicalRead);
            assertEquals(before,f.p.disk);assertEquals(0,f.p.commits);assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
        }
    }
    @Test public void missingExistingKeyDuringRestartCannotRepairOrRegenerateOriginalJournal()throws Exception {
        var f=new Fixture();var c=capture(f,A);f.p.beforeCommit=()->f.p.persistThenFail=f.p.commits>=2;
        assertEquals(AndroidOfflineAuthorityTimeStore.NfcWriteResult.UNCERTAIN,f.store.persistPhysicalNfcHandoffs(c));var next=restart(f.p);
        CredentialCipher missing=new CredentialCipher(){public EncryptedSecret encrypt(char[] c){throw new AssertionError("no new key");}
            public EncryptedSecret encryptWithExistingKey(char[] c){throw new AssertionError("no new encryption");}
            public char[] decrypt(EncryptedSecret c)throws VaultFailure{throw new VaultFailure("synthetic_missing_existing_key");}
            public void destroyKey(){throw new AssertionError("no retirement");}};
        var recreated=new AndroidOfflineAuthorityTimeStore(next.object(),missing);var before=new HashMap<>(next.disk);
        uncertain(recreated::loadNfcHandoffs);assertEquals(0,next.commits);assertEquals(before,next.disk);assertTrue(next.disk.containsKey(PENDING));
    }
    @Test public void oldFrozenWorkIsNeverRetrofittedWithANewAttemptOrGeneration()throws Exception {
        var f=new Fixture();f.p.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,"old exact frozen evidence");f.p.durableDisk=new HashMap<>(f.p.disk);
        var before=new HashMap<>(f.p.disk);uncertain(f.store::loadNfcHandoffsForPhysicalRead);
        assertEquals(before,f.p.disk);assertEquals(0,f.p.commits);assertFalse(f.p.disk.containsKey(GEN));assertFalse(f.p.disk.containsKey(PENDING));
    }
}
