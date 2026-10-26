package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Actual storage owners, synthetic memory-only preferences/cipher. No device/key access. */
public final class AndroidFrozenCryptoAdmissionSourceProbe {
    private static int cases, mismatches;
    private static final class MemoryPreferences implements SharedPreferences {
        final Map<String,Object> values = new HashMap<>(); int commits;
        public synchronized Map<String,?> getAll(){return new HashMap<>(values);}
        public synchronized boolean contains(String key){return values.containsKey(key);}
        public synchronized String getString(String key,String fallback){return values.containsKey(key)?(String)values.get(key):fallback;}
        @SuppressWarnings("unchecked") public synchronized Set<String> getStringSet(String key,Set<String> fallback){return values.containsKey(key)?(Set<String>)values.get(key):fallback;}
        public int getInt(String key,int fallback){return (Integer)values.getOrDefault(key,fallback);}
        public long getLong(String key,long fallback){return (Long)values.getOrDefault(key,fallback);}
        public float getFloat(String key,float fallback){return (Float)values.getOrDefault(key,fallback);}
        public boolean getBoolean(String key,boolean fallback){return (Boolean)values.getOrDefault(key,fallback);}
        public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){throw new UnsupportedOperationException();}
        public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){throw new UnsupportedOperationException();}
        public Editor edit(){return new Editor(){
            final Map<String,Object> writes=new HashMap<>(); final java.util.Set<String> removes=new java.util.HashSet<>(); boolean clear;
            public Editor putString(String key,String value){writes.put(key,value);return this;}
            public Editor putStringSet(String key,Set<String> value){writes.put(key,value);return this;}
            public Editor putInt(String key,int value){writes.put(key,value);return this;}
            public Editor putLong(String key,long value){writes.put(key,value);return this;}
            public Editor putFloat(String key,float value){writes.put(key,value);return this;}
            public Editor putBoolean(String key,boolean value){writes.put(key,value);return this;}
            public Editor remove(String key){removes.add(key);return this;}
            public Editor clear(){clear=true;return this;}
            public boolean commit(){synchronized(MemoryPreferences.this){commits++;if(clear)values.clear();for(String key:removes)values.remove(key);values.putAll(writes);return true;}}
            public void apply(){throw new UnsupportedOperationException();}
        };}
    }
    private static final class CountingCipher implements CredentialCipher {
        int ordinary, existing; boolean fail;
        CountDownLatch entered, release;
        public EncryptedSecret encrypt(char[] value)throws VaultFailure{
            ordinary++;
            if(entered!=null){entered.countDown();try{if(!release.await(2,TimeUnit.SECONDS))throw new VaultFailure("source_test_timeout");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new VaultFailure("source_test_interrupted",e);}}
            if(fail)throw new VaultFailure("synthetic_encryption_failed");
            return new EncryptedSecret("synthetic-ciphertext","synthetic-iv");
        }
        public EncryptedSecret encryptWithExistingKey(char[] value)throws VaultFailure{existing++;return new EncryptedSecret("synthetic-existing","synthetic-iv");}
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{throw new VaultFailure("source_test_no_decryption");}
        public void destroyKey()throws VaultFailure{throw new VaultFailure("source_test_no_retirement");}
    }
    private static void check(boolean good,String label){cases++;if(!good)mismatches++;System.out.println((good?"PASS ":"MISMATCH ")+label);}
    private static void require(boolean good,String label){if(!good)throw new AssertionError(label);}
    private static VaultFailure save(AndroidOfflineAuthorityTimeStore store)throws Exception{
        try{store.saveScanEntries(new java.util.LinkedHashMap<>());return null;}catch(VaultFailure e){return e;}
    }
    private static String protect(AndroidOfflineAuthorityTimeStore store, boolean existing)throws Exception{
        Method method=AndroidOfflineAuthorityTimeStore.class.getDeclaredMethod("protect",JSONObject.class,String.class,boolean.class);method.setAccessible(true);
        try{return (String)method.invoke(store,new JSONObject().put("synthetic",true),"synthetic_source_refusal",existing);}
        catch(InvocationTargetException e){if(e.getCause() instanceof Exception)throw (Exception)e.getCause();throw e;}
    }
    public static void main(String[] args)throws Exception{
        MemoryPreferences normal=new MemoryPreferences();CountingCipher normalCipher=new CountingCipher();
        require(save(new AndroidOfflineAuthorityTimeStore(normal,normalCipher))==null,"positive_control_failed");
        check(normalCipher.ordinary==1&&normalCipher.existing==0&&normal.commits==1&&normal.contains("offline_scan_entries"),"unfrozen_ordinary_work_still_encrypts_and_commits");
        for(String kind:new String[]{"fence","probe","malformed_fence"}){
            MemoryPreferences raw=new MemoryPreferences();CountingCipher cipher=new CountingCipher();
            raw.values.put("retained_synthetic_work","exact-original-bytes");
            raw.values.put(kind.equals("probe")?AndroidProtectedWorkPreferences.PROBE_KEY:AndroidProtectedWorkPreferences.FENCE_KEY,kind.equals("malformed_fence")?Integer.valueOf(7):"retained-guard");
            Map<String,?> original=raw.getAll();VaultFailure failure=save(new AndroidOfflineAuthorityTimeStore(raw,cipher));
            require(failure!=null&&original.equals(raw.getAll())&&raw.commits==0,"original_write_guard_or_retention_failed");
            check(cipher.ordinary==0&&cipher.existing==0,kind+"_refuses_before_key_creating_encryption");
        }
        MemoryPreferences recovery=new MemoryPreferences();CountingCipher recoveryCipher=new CountingCipher();
        recovery.values.put(AndroidProtectedWorkPreferences.PROBE_KEY,"pending-recovery");Map<String,?> recoveryBefore=recovery.getAll();
        String protectedControl=protect(new AndroidOfflineAuthorityTimeStore(recovery,recoveryCipher),true);
        check(protectedControl!=null&&recoveryCipher.existing==1&&recoveryCipher.ordinary==0&&recoveryBefore.equals(recovery.getAll())&&recovery.commits==0,"existing_key_only_control_protection_is_preserved_without_write_or_thaw");
        MemoryPreferences failureRaw=new MemoryPreferences();CountingCipher failureCipher=new CountingCipher();failureCipher.fail=true;
        VaultFailure cryptoFailure=save(new AndroidOfflineAuthorityTimeStore(failureRaw,failureCipher));
        check(cryptoFailure!=null&&"synthetic_encryption_failed".equals(cryptoFailure.code)&&failureRaw.commits==0&&failureRaw.getAll().isEmpty(),"ordinary_crypto_failure_stays_truthful_without_commit");
        MemoryPreferences race=new MemoryPreferences();CountingCipher raceCipher=new CountingCipher();
        raceCipher.entered=new CountDownLatch(1);raceCipher.release=new CountDownLatch(1);
        AndroidOfflineAuthorityTimeStore raceStore=new AndroidOfflineAuthorityTimeStore(race,raceCipher);
        CountDownLatch freezeStarted=new CountDownLatch(1),freezeDone=new CountDownLatch(1);
        AtomicReference<Throwable> error=new AtomicReference<>();
        Thread writer=new Thread(()->{try{protect(raceStore,false);}catch(Throwable e){error.compareAndSet(null,e);}},"owned-source-crypto");
        Thread freezer=new Thread(()->{freezeStarted.countDown();try{new AndroidProtectedWorkPreferences(race).prepareProbe(Map.of(),"synthetic-pending-probe");}catch(Throwable e){error.compareAndSet(null,e);}finally{freezeDone.countDown();}},"owned-source-freeze");
        boolean early;
        try{writer.start();require(raceCipher.entered.await(2,TimeUnit.SECONDS),"writer_not_entered");freezer.start();require(freezeStarted.await(2,TimeUnit.SECONDS),"freezer_not_started");early=freezeDone.await(150,TimeUnit.MILLISECONDS);}
        finally{raceCipher.release.countDown();writer.join(2000);if(freezer.getState()==Thread.State.NEW)freezer.start();freezer.join(2000);require(!writer.isAlive()&&!freezer.isAlive(),"owned_source_thread_alive");}
        require(error.get()==null&&freezeDone.getCount()==0&&race.contains(AndroidProtectedWorkPreferences.PROBE_KEY),"concurrency_positive_control_failed");
        check(!early,"existing_process_wide_freeze_boundary_serializes_ordinary_crypto");
        MemoryPreferences late=new MemoryPreferences();CountingCipher lateCipher=new CountingCipher();
        new AndroidProtectedWorkPreferences(late).prepareProbe(Map.of(),"synthetic-pending-probe");
        VaultFailure lateFailure=save(new AndroidOfflineAuthorityTimeStore(late,lateCipher));
        check(lateFailure!=null&&lateCipher.ordinary==0&&lateCipher.existing==0&&late.commits==1,"new_adapter_after_durable_probe_cannot_invoke_ordinary_crypto");
        System.out.println("RESULT {\"cases\":"+cases+",\"pass\":"+(cases-mismatches)+",\"mismatches\":"+mismatches+",\"actual_storage_owners\":true,\"synthetic_memory_only_preferences_and_cipher\":true,\"real_key_creation_tested\":false,\"phone_proof\":false}");
    }
}
