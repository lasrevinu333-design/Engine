package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;

/** Actual encrypted offline Store entry/CAS with synthetic host preferences and
 * cipher, never Runtime/full-principal/frame/qualified Current authority. */
public final class NativeRecurringOrdinaryPrincipalLifetimeTest {
    private interface Hook {void run()throws VaultFailure;}
    private static final class Cipher implements CredentialCipher {
        final TestCipher delegate=new TestCipher(32*1024*1024);Hook next;
        public EncryptedSecret encrypt(char[] clear)throws VaultFailure{return delegate.encrypt(clear);}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{
            if(next!=null){Hook h=next;next=null;h.run();}return delegate.encryptWithExistingKey(clear);
        }
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{return delegate.decrypt(value);}
        public void destroyKey(){throw new AssertionError("no key removal");}
    }
    private static final class Fixture {
        final NativeRetainedOwnerTest.WorkDisk disk=new NativeRetainedOwnerTest.WorkDisk();
        final android.content.SharedPreferences raw=disk.preferences();final Cipher cipher=new Cipher();
        final AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(raw,cipher);
        AndroidOfflineAuthorityTimeStore another(){return new AndroidOfflineAuthorityTimeStore(raw,cipher);}
    }
    private static void stale(AndroidOfflineAuthorityTimeStore.OrdinaryPrincipalRead read){assertThrows(VaultFailure.class,read::requireCurrent);}
    @Test public void stableReadIsCallbackFreeAndDoesNotWrite()throws Exception{
        Fixture f=new Fixture();var read=f.store.captureOrdinaryPrincipalRead();int count=f.disk.commits;
        f.cipher.next=()->{throw new AssertionError("scalar read must not call cipher");};
        read.requireCurrent();read.requireCurrent();assertEquals(count,f.disk.commits);assertTrue(f.disk.memory.isEmpty());
    }
    @Test public void malformedNativeEntryInvalidatesBeforeParseAndFinallyUnwinds()throws Exception{
        Fixture f=new Fixture();var old=f.store.captureOrdinaryPrincipalRead();int count=f.disk.commits;
        assertThrows(VaultFailure.class,()->f.store.savePrincipal("not JSON"));stale(old);
        f.store.captureOrdinaryPrincipalRead().requireCurrent();assertEquals(count,f.disk.commits);assertTrue(f.disk.memory.isEmpty());
    }
    @Test public void actualNativeSaveThroughSamePreferencesAdapterInvalidatesRead()throws Exception{
        Fixture f=new Fixture();f.store.savePrincipal("{\"synthetic\":\"A\"}");var old=f.store.captureOrdinaryPrincipalRead();
        int count=f.disk.commits;f.another().savePrincipal("{\"synthetic\":\"B\"}");
        assertTrue(f.disk.commits>count);assertEquals("B",new org.json.JSONObject(f.store.loadPrincipal()).getString("synthetic"));stale(old);
        f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
    @Test public void freshCaptureInsideNativeEncryptionIsRefusedEvenBeforeRowChanged()throws Exception{
        Fixture f=new Fixture();var old=f.store.captureOrdinaryPrincipalRead();int[] calls={0};
        f.cipher.next=()->{calls[0]++;stale(old);assertThrows(VaultFailure.class,()->f.another().captureOrdinaryPrincipalRead());};
        f.store.savePrincipal("{\"synthetic\":\"A\"}");assertEquals(1,calls[0]);
        f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
    @Test public void failedCryptoEntryStillInvalidatesAndUnwinds()throws Exception{
        Fixture f=new Fixture();var old=f.store.captureOrdinaryPrincipalRead();int count=f.disk.commits;
        f.cipher.next=()->{throw new VaultFailure("synthetic_encrypt_failure");};
        assertThrows(VaultFailure.class,()->f.store.savePrincipal("{\"synthetic\":\"A\"}"));stale(old);
        assertEquals(count,f.disk.commits);assertTrue(f.disk.memory.isEmpty());f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
    @Test public void nativeAbaCannotRestoreEarlierLifetime()throws Exception{
        Fixture f=new Fixture();String a="{\"synthetic\":\"A\"}";f.store.savePrincipal(a);
        String raw=(String)f.disk.memory.get("authenticated_principal");var old=f.store.captureOrdinaryPrincipalRead();
        f.store.savePrincipal("{\"synthetic\":\"B\"}");f.store.savePrincipal(a);
        assertEquals(raw,f.disk.memory.get("authenticated_principal"));stale(old);f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
    @Test public void legacyValidationRefusalAndActualSaveSharePrincipalLifetime()throws Exception{
        Fixture f=new Fixture();var first=f.store.captureOrdinaryPrincipalRead();
        assertThrows(VaultFailure.class,()->f.store.saveLegacyRecord("not a supported key","{}"));stale(first);
        var second=f.store.captureOrdinaryPrincipalRead();int[] callbacks={0};
        f.cipher.next=()->{callbacks[0]++;assertThrows(VaultFailure.class,()->f.store.captureOrdinaryPrincipalRead());};
        f.store.saveLegacyRecord("principal","{\"synthetic\":true}");assertEquals(1,callbacks[0]);stale(second);
        assertEquals("{\"synthetic\":true}",f.store.loadLegacyRecord("principal"));f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
    @Test public void unrelatedWorkAndAnotherPrivateNamespaceDoNotInvalidatePrincipal()throws Exception{
        Fixture f=new Fixture(),other=new Fixture();var read=f.store.captureOrdinaryPrincipalRead();
        int count=f.disk.commits;f.store.saveAssignedActivationTransport("{\"synthetic\":true}");
        assertTrue(f.disk.commits>count);read.requireCurrent();other.store.savePrincipal("{\"synthetic\":true}");read.requireCurrent();
    }
    @Test public void nestedNativeEntryCannotMintFreshIdleAfterInnerReturns()throws Exception{
        Fixture f=new Fixture();int[] nested={0};
        f.cipher.next=()->{f.another().savePrincipal("{\"synthetic\":\"inner\"}");nested[0]++;
            assertThrows(VaultFailure.class,()->f.store.captureOrdinaryPrincipalRead());};
        // The genuine outer original raw CAS refuses after the inner commit;
        // its finalizer still unwinds only its own entry and never rolls back it.
        assertThrows(VaultFailure.class,()->f.store.savePrincipal("{\"synthetic\":\"outer\"}"));assertEquals(1,nested[0]);
        assertEquals("inner",new org.json.JSONObject(f.store.loadPrincipal()).getString("synthetic"));f.store.captureOrdinaryPrincipalRead().requireCurrent();
    }
}
