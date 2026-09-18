package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.security.KeyStore;
import java.security.ProviderException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.*;
import org.junit.runner.RunWith;

/** Isolated instrumentation only. Never run against an enrolled phone package. */
@RunWith(AndroidJUnit4.class)
public final class NfcRecoveryAndroidRuntimeTest {
    static final String PREF = "MemphisZooCustodialOfflineAuthorityTimeV1";
    static final String ACTIVE = "native_nfc_handoffs";
    static final String ARCHIVE = "native_nfc_handoff_quarantine_record:";
    static final String AAD = "org.memphiszoo.custodial.native-vault.offline-authority-time.v1";
    private Context context;
    private SharedPreferences prefs;

    @Before public void prepare() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("Instrumentation must use a test-only namespace", context.getPackageName().endsWith(".test"));
        assertTrue("Only emulator execution is allowed", Build.FINGERPRINT.contains("generic") || Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE));
        prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        assertTrue(prefs.edit().clear().commit());
        new AndroidKeystoreCipher().destroyKey();
    }
    @After public void cleanup() throws Exception {
        if (prefs != null) assertTrue(prefs.edit().clear().commit());
        if (context != null && context.getPackageName().endsWith(".test")) new AndroidKeystoreCipher().destroyKey();
    }
    private KeyStore keys() throws Exception { KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);return s; }
    private String read(String code) { return NativeNfcScanHandoff.recordPhysicalRead(context,"memphiszoo://scan?code="+code); }
    private AndroidOfflineAuthorityTimeStore store() { return new AndroidOfflineAuthorityTimeStore(context); }
    private long archives() { return prefs.getAll().keySet().stream().filter(k->k.startsWith(ARCHIVE)).count(); }
    private void retained(String original) {
        assertTrue(prefs.getAll().entrySet().stream().anyMatch(e->e.getKey().startsWith(ARCHIVE)&&original.equals(e.getValue())));
    }
    private void malformed() { assertTrue(prefs.edit().putString(ACTIVE,"{invalid-old-nfc-envelope").commit()); }
    private void assertCredential(EncryptedSecret secret) throws Exception {
        char[] clear=new AndroidKeystoreCipher().decrypt(secret);
        try { assertEquals("fixture-current-credential",new String(clear)); } finally { Arrays.fill(clear,'\0'); }
    }
    private Map<String,Object> entry(String id) {
        Map<String,Object> m=new LinkedHashMap<>();long now=SystemClock.elapsedRealtime();
        m.put("schema_version","native-nfc-handoff.v1");m.put("handoff_id",id);m.put("entry_id",UUID.randomUUID().toString());
        m.put("url","memphiszoo://scan?code=TETM");m.put("created_elapsed_ms",now);m.put("expires_elapsed_ms",now+900000L);
        m.put("boot_count",Settings.Global.getInt(context.getContentResolver(),"boot_count",-1));m.put("state","pending");return m;
    }
    @Test public void strictEncryptionMissingAliasRefusesWithoutGenerating() throws Exception {
        AndroidKeystoreCipher c=new AndroidKeystoreCipher();
        for(int n=0;n<2;n++) {
            try { c.encryptWithExistingKey("fixture".toCharArray());fail("Missing alias accepted"); }
            catch(VaultFailure e) { assertEquals("custodial_native_vault_key_missing",e.code); }
            assertFalse(keys().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
        }
        EncryptedSecret ordinary=c.encrypt("fixture-current-credential".toCharArray());
        assertTrue(keys().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));assertCredential(ordinary);
        EncryptedSecret strict=c.encryptWithExistingKey("strict-fixture".toCharArray());
        char[] clear=c.decrypt(strict);try{assertEquals("strict-fixture",new String(clear));}finally{Arrays.fill(clear,'\0');}
    }
    @Test public void realKeystoreAuthenticationFailurePreservesThenAcceptsOnlyFreshRead() throws Exception {
        String oldId=read("TETM");assertFalse(oldId.isEmpty());String original=prefs.getString(ACTIVE,null);
        new AndroidKeystoreCipher().destroyKey();
        EncryptedSecret current=new AndroidKeystoreCipher().encrypt("fixture-current-credential".toCharArray());
        assertTrue(prefs.edit().putString("offline_occurrence_sha256:fixture","untouched-work")
            .putString("offline_authority_anchor","untouched-anchor").putString("rollback_fence","untouched-fence").commit());
        try{store().loadNfcHandoffs();fail("Old ciphertext decrypted with replacement fixture key");}
        catch(VaultFailure e){assertEquals("custodial_native_vault_decrypt_failed",e.code);}
        String fresh=read("NOCX");assertFalse(fresh.isEmpty());assertNotEquals(oldId,fresh);
        Map<String,Map<String,Object>> records=store().loadNfcHandoffs();assertEquals(1,records.size());assertTrue(records.containsKey(fresh));
        assertEquals("memphiszoo://scan?code=NOCX",records.get(fresh).get("url"));assertEquals(1L,archives());retained(original);
        assertFalse(prefs.getString(ACTIVE,"").contains("NOCX"));assertCredential(current);
        assertEquals("untouched-work",prefs.getString("offline_occurrence_sha256:fixture",null));
        assertEquals("untouched-anchor",prefs.getString("offline_authority_anchor",null));assertEquals("untouched-fence",prefs.getString("rollback_fence",null));
    }
    @Test public void malformedAndMissingKeyCannotCreateAnAliasOrReturnHandoff() throws Exception {
        malformed();String original=prefs.getString(ACTIVE,null);
        for(int n=0;n<2;n++){assertEquals("",read("NOCX"));assertFalse(keys().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
            assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(1L,archives());retained(original);}
    }
    @Test public void malformedWithHealthyKeyPreservesCredentialAndOldBytes() throws Exception {
        EncryptedSecret current=new AndroidKeystoreCipher().encrypt("fixture-current-credential".toCharArray());
        malformed();String original=prefs.getString(ACTIVE,null);String id=read("NOCX");assertFalse(id.isEmpty());
        assertTrue(store().loadNfcHandoffs().containsKey(id));assertEquals(1L,archives());retained(original);assertCredential(current);
    }
    @Test public void keyDisappearingAfterArchiveRefusesReplacement() throws Exception {
        new AndroidKeystoreCipher().encrypt("fixture".toCharArray());malformed();String original=prefs.getString(ACTIVE,null);
        AndroidOfflineAuthorityTimeStore s=store();AndroidOfflineAuthorityTimeStore.NfcHandoffCapture capture=s.loadNfcHandoffsForPhysicalRead();
        retained(original);new AndroidKeystoreCipher().destroyKey();String id=UUID.randomUUID().toString();capture.handoffs.put(id,entry(id));
        try{s.saveNfcHandoffsAfterPhysicalRead(capture);fail("Recreated missing key");}
        catch(VaultFailure e){assertEquals("custodial_native_vault_key_missing",e.code);}
        assertFalse(keys().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));assertEquals(original,prefs.getString(ACTIVE,null));retained(original);
    }
    @Test public void claimsCannotInvokePhysicalReadRecovery() throws Exception {
        new AndroidKeystoreCipher().encrypt("fixture".toCharArray());malformed();String original=prefs.getString(ACTIVE,null);
        try{NativeNfcScanHandoff.claim(context,"memphiszoo://scan?code=TETM&mz_nfc_handoff="+UUID.randomUUID());fail("Claim accepted malformed data");}
        catch(VaultFailure expected){assertEquals("custodial_native_nfc_handoff_refused",expected.code);}
        assertEquals(0L,archives());assertEquals(original,prefs.getString(ACTIVE,null));
    }
    private SharedPreferences failCommit(int number, boolean writeThenFail) {
        AtomicInteger commits=new AtomicInteger();
        return (SharedPreferences)Proxy.newProxyInstance(SharedPreferences.class.getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            try {
                if(!method.getName().equals("edit"))return method.invoke(prefs,args);
                SharedPreferences.Editor real=prefs.edit();
                return Proxy.newProxyInstance(SharedPreferences.Editor.class.getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(ep,em,ea)->{
                    try{
                        if(em.getName().equals("commit")&&commits.incrementAndGet()==number){if(writeThenFail)real.commit();return false;}
                        Object value=em.invoke(real,ea);return value instanceof SharedPreferences.Editor?ep:value;
                    }catch(InvocationTargetException e){throw e.getCause();}
                });
            }catch(InvocationTargetException e){throw e.getCause();}
        });
    }
    private void recordThrough(AndroidOfflineAuthorityTimeStore s) throws VaultFailure {
        NativeNfcScanHandoff.record(s,"memphiszoo://scan?code=NOCX",SystemClock.elapsedRealtime(),Settings.Global.getInt(context.getContentResolver(),"boot_count",-1));
    }
    @Test public void failedArchiveCommitDoesNotReturnSuccessOrReplaceSource() throws Exception {
        new AndroidKeystoreCipher().encrypt("fixture".toCharArray());malformed();String original=prefs.getString(ACTIVE,null);
        AndroidOfflineAuthorityTimeStore s=new AndroidOfflineAuthorityTimeStore(failCommit(1,false),new AndroidKeystoreCipher(AAD,131072));
        try{recordThrough(s);fail("Archive failure accepted");}catch(VaultFailure e){assertEquals("custodial_native_nfc_handoff_preservation_failed",e.code);}
        assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(0L,archives());
    }
    @Test public void failedReplacementCommitDoesNotReturnSuccessAndRetainsArchive() throws Exception {
        EncryptedSecret current=new AndroidKeystoreCipher().encrypt("fixture-current-credential".toCharArray());malformed();String original=prefs.getString(ACTIVE,null);
        AndroidOfflineAuthorityTimeStore s=new AndroidOfflineAuthorityTimeStore(failCommit(2,false),new AndroidKeystoreCipher(AAD,131072));
        try{recordThrough(s);fail("Replacement failure accepted");}catch(VaultFailure e){assertEquals("custodial_native_offline_time_persistence_failed",e.code);}
        assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(1L,archives());retained(original);assertCredential(current);
        assertFalse(read("NOCX").isEmpty());assertEquals(1L,archives());
    }
    @Test public void providerFailureDoesNotBecomeCorruptionRecovery() throws Exception {
        assertFalse(read("TETM").isEmpty());String original=prefs.getString(ACTIVE,null);
        CredentialCipher broken=new CredentialCipher(){
            public EncryptedSecret encrypt(char[] p)throws VaultFailure{throw new VaultFailure("unexpected_encrypt");}
            public char[] decrypt(EncryptedSecret p)throws VaultFailure{throw new VaultFailure("custodial_native_vault_decrypt_failed",new ProviderException("isolated transient provider fixture"));}
            public void destroyKey()throws VaultFailure{throw new VaultFailure("unexpected_destroy");}
        };
        try{recordThrough(new AndroidOfflineAuthorityTimeStore(prefs,broken));fail("Provider failure recovered");}
        catch(VaultFailure e){assertEquals("custodial_native_vault_decrypt_failed",e.code);}
        assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(0L,archives());
    }
    @Test public void fourValidPendingHandoffsArePreservedAndFifthRefused() throws Exception {
        Set<String> ids=new HashSet<>();for(int i=0;i<4;i++){String id=read("TETM");assertFalse(id.isEmpty());ids.add(id);}
        String original=prefs.getString(ACTIVE,null);assertEquals(4,ids.size());assertEquals("",read("NOCX"));
        assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(ids,store().loadNfcHandoffs().keySet());assertEquals(0L,archives());
    }
    @Test public void boundedArchiveRefusesWithoutDeletingEvidence() throws Exception {
        new AndroidKeystoreCipher().encrypt("fixture".toCharArray());malformed();String original=prefs.getString(ACTIVE,null);
        for(int i=0;i<4;i++)assertTrue(prefs.edit().putString(ARCHIVE+"fixture"+i,"preserved"+i).commit());
        assertEquals("",read("NOCX"));assertEquals(original,prefs.getString(ACTIVE,null));assertEquals(4L,archives());
    }
    @Test public void concurrentReadsAreSerializedWithoutLostHandoffs() throws Exception {
        new AndroidKeystoreCipher().encrypt("fixture".toCharArray());ExecutorService pool=Executors.newFixedThreadPool(4);
        try{CountDownLatch go=new CountDownLatch(1);List<Future<String>> futures=new ArrayList<>();
            for(int i=0;i<4;i++)futures.add(pool.submit(()->{go.await();return read("TETM");}));go.countDown();
            Set<String> ids=new HashSet<>();for(Future<String> f:futures){String id=f.get(20,TimeUnit.SECONDS);assertFalse(id.isEmpty());ids.add(id);}
            assertEquals(4,ids.size());assertEquals(ids,store().loadNfcHandoffs().keySet());assertEquals(0L,archives());
        }finally{pool.shutdownNow();}
    }
}
