package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Map;
import org.junit.Test;

/** Actual whole-WORK adapter methods; SAME existing explicit memory-only raw
 * preferences fixture, not Android durable generation or effect authority.
 * The positive cases prove raw DATA observation only. PROCESS_ONLY must refuse
 * the independent native-generation join. No private field/constructor write,
 * fake journal/current, credential, HTTP, UI or typed-receipt factory. */
public final class NativeRecurringWholeWorkReadTest {
    private static final CredentialCipher NO_CRYPTO=new CredentialCipher(){
        public EncryptedSecret encrypt(char[] value){throw new AssertionError("read must not encrypt");}
        public char[] decrypt(EncryptedSecret value){throw new AssertionError("raw observation must not decrypt");}
        public void destroyKey(){throw new AssertionError("read must not destroy a key");}
    };
    @FunctionalInterface interface Checked {void run()throws Exception;}
    private static void refuses(Checked call)throws Exception {
        try{call.run();fail("Original read must refuse");}catch(VaultFailure expected){assertNotNull(expected.code);}
    }
    private static AndroidOfflineAuthorityTimeStore store(AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences raw){
        return new AndroidOfflineAuthorityTimeStore(raw,NO_CRYPTO);
    }
    @Test public void unchangedWholeRawDataIncludesForeignOpaqueRowsWithoutDecryptOrWrite()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();
        raw.values.put("ordinary", "opaque encrypted original");raw.values.put("unrecognized:foreign", "unreadable remains present");
        var original=raw.getAll();var owner=store(raw);
        try(var read=owner.captureWholeWorkRead()){read.requireReadOnlyCurrent(owner);read.requireReadOnlyCurrent(owner);}
        assertEquals(original,raw.getAll());assertEquals(0,raw.commits);
    }
    @Test public void processOnlyDataCannotPassTheInstalledNativeGenerationJoin()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put("ordinary","A");var owner=store(raw);
        try(var read=owner.captureWholeWorkRead()){
            read.requireReadOnlyCurrent(owner);refuses(()->read.requireInstalledNativeGeneration(owner));
            read.requireReadOnlyCurrent(owner);
        }
        assertEquals(0,raw.commits);assertEquals("A",raw.values.get("ordinary"));
    }
    @Test public void anotherAdapterCannotAdoptTheOriginalWholeRead()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put("ordinary","A");var owner=store(raw);var alias=store(raw);
        try(var read=owner.captureWholeWorkRead()){
            refuses(()->read.requireReadOnlyCurrent(alias));read.requireReadOnlyCurrent(owner);
        }
        assertEquals(0,raw.commits);
    }
    @Test public void writeAndRestoreSameBytesStillInvalidatesTheWholeOriginal()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put("ordinary","A");var owner=store(raw);
        try(var read=owner.captureWholeWorkRead()){
            var adapter=new AndroidProtectedWorkPreferences(raw);
            assertTrue(adapter.edit().putString("ordinary","B").commit());
            assertTrue(adapter.edit().putString("ordinary","A").commit());
            assertEquals("A",raw.values.get("ordinary"));refuses(()->read.requireReadOnlyCurrent(owner));
        }
        assertEquals(2,raw.commits);
    }
    @Test public void anOrdinaryNoopCommitAlsoInvalidatesOriginalData()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put("ordinary","A");var owner=store(raw);
        try(var read=owner.captureWholeWorkRead()){
            assertTrue(new AndroidProtectedWorkPreferences(raw).edit().putString("ordinary","A").commit());
            refuses(()->read.requireReadOnlyCurrent(owner));
        }
        assertEquals(1,raw.commits);
    }
    @Test public void retiredReadCannotReturnToAUsableObservation()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();var owner=store(raw);var read=owner.captureWholeWorkRead();
        read.close();read.close();refuses(()->read.requireReadOnlyCurrent(owner));refuses(()->read.requireInstalledNativeGeneration(owner));
        assertEquals(0,raw.commits);
    }
    @Test public void malformedFenceOrPendingOriginalRemainsPreservedAndRefused()throws Exception {
        for(String key:new String[]{AndroidProtectedWorkPreferences.FENCE_KEY,AndroidProtectedWorkPreferences.PROBE_KEY,
            AndroidProtectedWorkPreferences.NFC_WRITE_KEY,AndroidProtectedWorkPreferences.WORK_WRITE_KEY}){
            var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put(key,"malformed original is not absent");
            Map<String,?> original=raw.getAll();refuses(()->store(raw).captureWholeWorkRead());
            assertEquals(original,raw.getAll());assertEquals(0,raw.commits);
        }
    }
    @Test public void lastPersistenceCallbackReturningUnchangedVaultCannotHideAWorkMutation()throws Exception {
        // Same actual persistence interface and actual whole-WORK adapter; this
        // is a callback DATA test, not a fabricated native Runtime/epoch join.
        var original=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();raw.values.put("ordinary","A");var owner=store(raw);
        VaultSnapshot vault=original.persistence.load();int[] callbacks={0};
        VaultPersistence late=new VaultPersistence(){
            public VaultSnapshot load()throws VaultFailure {
                callbacks[0]++;
                assertTrue(new AndroidProtectedWorkPreferences(raw).edit().putString("ordinary","B").commit());
                return original.persistence.load();
            }
            public void commit(long revision,VaultSnapshot next)throws VaultFailure {original.persistence.commit(revision,next);}
        };
        try(var read=owner.captureWholeWorkRead()){
            read.requireReadOnlyCurrent(owner);
            assertEquals(vault,late.load());assertEquals(1,callbacks[0]);
            refuses(()->read.requireReadOnlyCurrent(owner));
        }
        assertEquals("B",raw.values.get("ordinary"));assertEquals(1,raw.commits);
        original.wiped();
    }
    @Test public void unsupportedRawCellIsRefusedWithoutDroppingOrReinterpretingIt()throws Exception {
        var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();Object foreign=new Object();raw.values.put("foreign:unknown",foreign);
        refuses(()->store(raw).captureWholeWorkRead());assertSame(foreign,raw.values.get("foreign:unknown"));assertEquals(0,raw.commits);
    }
}
