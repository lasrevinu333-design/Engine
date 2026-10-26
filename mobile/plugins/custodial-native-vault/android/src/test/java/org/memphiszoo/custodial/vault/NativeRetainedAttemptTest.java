package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual new native frame/journal/Android adapter, original manifest/HMAC and
 * synthetic AES-GCM + SharedPreferences/durable-disk fault model. Not Android
 * Keystore, fsync/process-death, mounted engine/HTTP/SQL or physical phone proof. */
public final class NativeRetainedAttemptTest {
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--pending-prepared-restoration-only".equals(args[0])){
            var test=new NativeRetainedAttemptTest();
            for(String name:new String[]{"RESTORE_writeOriginalAfterClosedFailedPreparation","RESTORE_queryOriginalAfterClosedFailedPreparation",
                "RESTORE_wrongScopePhaseWritingAndDriftNeverLookAbsent"}){
                try{NativeRetainedAttemptTest.class.getMethod(name).invoke(test);}
                catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
                System.out.println("PASS_SOURCE_MOCK "+name);
            }
            System.out.println("PRIVATE_RESTORED_ORIGINAL_ONLY_NO_DURABILITY_DISPATCH_AUTH_OR_KEY_AUTHORITY");return;
        }
        if(args.length==1&&"--baseline-unchanged-candidate-only".equals(args[0])){
            new NativeRetainedAttemptTest().COORD_candidateRecommitWithoutReencryption();return;
        }
        if(args.length!=1||!("--journal-coordination-only".equals(args[0])||"--journal-coordination-remaining-only".equals(args[0])))
            throw new IllegalArgumentException("focused cases required");
        var test=new NativeRetainedAttemptTest();
        for(String name:new String[]{"COORD_ordinaryWriteEpochBeforeFalseThrowAndHold","COORD_singleMonitorAndUntypedBackingRefusal",
            "COORD_exactWriteCandidateAcrossInstances","COORD_exactQueryCandidateAcrossInstances",
            "COORD_ambiguousWriteFenceNeverMintsDispatch","COORD_ambiguousQueryFenceNeverMintsDispatch",
            "COORD_pendingRejectsForeignRowsAndClosedOriginal","COORD_sharedMonitorSerializesOriginalWithOrdinaryWrite",
            "COORD_candidateRecommitWithoutReencryption","COORD_sameThreadCallbackCannotReenterOriginalCommit"}) {
            if("--journal-coordination-remaining-only".equals(args[0])&&
                (name.equals("COORD_ordinaryWriteEpochBeforeFalseThrowAndHold")||name.equals("COORD_singleMonitorAndUntypedBackingRefusal")
                ||name.equals("COORD_exactWriteCandidateAcrossInstances")))continue;
            try{NativeRetainedAttemptTest.class.getMethod(name).invoke(test);}
            catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
            System.out.println("PASS_SOURCE_MOCK "+name);
        }
        System.out.println("SOURCE_ONLY_NO_DURABLE_ALL8_AUTH_SQL_TRANSPORT_ANDROID_OR_PHONE_PROOF");
    }
    interface Work { void run() throws Exception; }
    static void denied(Work work) throws Exception { try { work.run();fail("refusal required"); } catch(VaultFailure expected) {} }
    static String id(int n) { return NativeSeparationContextTest.id(n); }
    static final class Disk {
        Map<String,Object> memory=new HashMap<>(),durable=new HashMap<>();
        boolean fail,memoryOnly,corruptReadback,throwBefore,throwAfter;int commits;
        Runnable beforeCommit=()->{},afterCommit=()->{};
        final java.util.List<Map<String,Object>> candidates=new java.util.ArrayList<>();
        private SharedPreferences instance;
        SharedPreferences preferences() {
            if(instance!=null)return instance;
            return instance=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(p,m,a)-> {
                if(m.getName().equals("getAll")) return new HashMap<>(memory);
                if(m.getName().equals("contains"))return memory.containsKey(a[0]);
                if(m.getName().equals("getString")||m.getName().equals("getBoolean"))return memory.getOrDefault(a[0],a[1]);
                if(!m.getName().equals("edit")) throw new AssertionError(m.getName());
                Map<String,Object> writes=new HashMap<>();
                return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(e,method,args)-> {
                    if(method.getName().equals("putString")) { writes.put((String)args[0],args[1]);return e; }
                    if(!method.getName().equals("commit")) throw new AssertionError("no clear/remove/apply: "+method.getName());
                    commits++;candidates.add(new HashMap<>(writes));beforeCommit.run();
                    if(throwBefore)throw new IllegalStateException("synthetic_before_memory");
                    if(fail)return false;
                    memory.putAll(writes);
                    if(corruptReadback)memory.put("unknown-retained","preserve me");
                    afterCommit.run();if(throwAfter)throw new IllegalStateException("synthetic_after_memory");
                    if(!memoryOnly)durable=new HashMap<>(memory);
                    return !memoryOnly;
                });
            });
        }
        void restart() { memory=new HashMap<>(durable);instance=null; }
    }
    static final class ExistingCipher implements CredentialCipher {
        final SecretKeySpec synthetic=new SecretKeySpec(new byte[32],"AES");
        int existing,creates,destroys;boolean missing;
        final String aad;Runnable beforeEncrypt=()->{};
        ExistingCipher(){this(AndroidRetainedAttemptStore.AAD);}
        ExistingCipher(String aad){this.aad=aad;}
        public EncryptedSecret encrypt(char[] text) { creates++;throw new AssertionError("new key forbidden"); }
        public void destroyKey() { destroys++;throw new AssertionError("retirement forbidden"); }
        public EncryptedSecret encryptWithExistingKey(char[] text) throws VaultFailure {
            beforeEncrypt.run();existing++;if(missing)throw new VaultFailure("synthetic_missing_existing_key");
            byte[] clear=new String(text).getBytes(StandardCharsets.UTF_8);
            try { Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,synthetic);c.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                return new EncryptedSecret(Base64.getEncoder().encodeToString(c.doFinal(clear)),Base64.getEncoder().encodeToString(c.getIV()));
            } catch(Exception error) { throw new VaultFailure("synthetic_cipher_failure",error); }
            finally { Arrays.fill(clear,(byte)0); }
        }
        public char[] decrypt(EncryptedSecret value) throws VaultFailure {
            if(missing)throw new VaultFailure("synthetic_missing_existing_key");byte[] clear=null;
            try { Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,synthetic,new GCMParameterSpec(128,Base64.getDecoder().decode(value.iv)));
                c.updateAAD(aad.getBytes(StandardCharsets.UTF_8));clear=c.doFinal(Base64.getDecoder().decode(value.ciphertext));return new String(clear,StandardCharsets.UTF_8).toCharArray();
            } catch(Exception error) { throw new VaultFailure("synthetic_cipher_failure",error); }
            finally { if(clear!=null)Arrays.fill(clear,(byte)0); }
        }
    }
    static final class Fixture {
        final Disk disk=new Disk();final ExistingCipher cipher=new ExistingCipher();
        final char[] credential=(id(3)+".synthetic-source-only-secret").toCharArray();
        final NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal());
        final Map<String,Object> originals=new HashMap<>();final NativeRetainedRecordValues values;final byte[] wire;
        Fixture() throws Exception {
            originals.put("unknown-old-work","opaque-original-ciphertext");originals.put("negative-zero",-0f);
            originals.put("set",Set.of("Spanish ñ","unpaired\ud800"));originals.put("large-opaque", "x".repeat(20000));
            values=NativeRetainedRecordValues.capture(originals);
            NativeSeparationEvidence proof=NativeSeparationEvidence.sign(NativeSeparationContextTest.read(NativeSeparationContextTest.data()),values.snapshot(),credential);
            // Exact wrapper whitespace/order is deliberately not canonicalized.
            wire=(" \n"+proof.json().toString()+"\t ").getBytes(StandardCharsets.UTF_8);
        }
        NativeRetainedAttempt attempt(int nonce,int chunk) throws Exception { return NativeRetainedAttempt.prepareChunk(wire,values,principal,7,credential,id(30),id(31),chunk,id(nonce),1791531600123L); }
        NativeRetainedAttemptJournal journal() { return new AndroidRetainedAttemptStore(disk.preferences(),cipher).journal(); }
        NativeRetainedAttempt restore(NativeRetainedAttemptJournal.Observation value) throws Exception {
            return NativeRetainedAttempt.restore(value.record(),values,principal,7,credential);
        }
    }


    @Test public void RESTORE_writeOriginalAfterClosedFailedPreparation()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();byte[] body=null;try {
                var journal=f.journal();assertNull(journal.restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0));
                var original=f.attempt(40,0);body=original.body();var headers=original.nativeHeaders();
                fault(f.disk,mode);denied(()->journal.prepare(original));original.close();
                var before=new HashMap<>(f.disk.memory);var candidate=new HashMap<>(f.disk.candidates.get(0));
                int commits=f.disk.commits,encrypts=f.cipher.existing;
                clearFault(f.disk);var rebuilt=f.journal();
                try(var restored=rebuilt.restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0)){
                    assertNotNull(restored);assertEquals(id(40),restored.requestId);assertEquals(headers,restored.nativeHeaders());
                    byte[] actual=restored.body();try{assertArrayEquals(body,actual);}finally{Arrays.fill(actual,(byte)0);}
                    assertEquals(before,f.disk.memory);assertEquals(commits,f.disk.commits);assertEquals(encrypts,f.cipher.existing);
                    if(mode==0||mode==2)assertNull(rebuilt.observe()); // never alias candidate as raw/durable
                    rebuilt.prepare(restored);assertEquals(candidate,f.disk.durable);assertEquals(encrypts,f.cipher.existing);
                }
                denied(()->rebuilt.restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0));
                assertEquals(0,f.cipher.creates+f.cipher.destroys);
            }finally{if(body!=null)Arrays.fill(body,(byte)0);Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void RESTORE_queryOriginalAfterClosedFailedPreparation()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();var disk=new Disk();var cipher=new ExistingCipher(AndroidRetainedQueryStore.AAD);
            byte[] body=null;try(var target=f.attempt(40,0);var foreignTarget=f.attempt(41,0)){
                var journal=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
                assertNull(journal.restorePendingPreparedOriginal(target,f.principal,7,f.credential));
                var query=NativeRetainedReadQuery.prepare(target,f.principal,7,f.credential,id(50),1791531601123L);
                body=query.body();var headers=query.nativeHeaders();fault(disk,mode);denied(()->journal.prepare(query));query.close();
                var candidate=new HashMap<>(disk.candidates.get(0));var before=new HashMap<>(disk.memory);
                int commits=disk.commits,encrypts=cipher.existing;clearFault(disk);
                var rebuilt=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
                denied(()->rebuilt.restorePendingPreparedOriginal(foreignTarget,f.principal,7,f.credential));
                denied(()->rebuilt.restorePendingPreparedOriginal(target,f.principal,8,f.credential));
                assertEquals(before,disk.memory);assertEquals(commits,disk.commits);assertEquals(encrypts,cipher.existing);
                try(var restored=rebuilt.restorePendingPreparedOriginal(target,f.principal,7,f.credential)){
                    assertEquals(id(50),restored.requestId);assertEquals(headers,restored.nativeHeaders());
                    byte[] actual=restored.body();try{assertArrayEquals(body,actual);}finally{Arrays.fill(actual,(byte)0);}
                    assertEquals(commits,disk.commits);assertEquals(encrypts,cipher.existing);
                    if(mode==0||mode==2)assertNull(rebuilt.observe());
                    rebuilt.prepare(restored);assertEquals(candidate,disk.durable);assertEquals(encrypts,cipher.existing);
                }
                assertEquals(0,cipher.creates+cipher.destroys);
            }finally{if(body!=null)Arrays.fill(body,(byte)0);Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void RESTORE_wrongScopePhaseWritingAndDriftNeverLookAbsent()throws Exception {
        var f=new Fixture();char[] wrong=f.credential.clone();wrong[wrong.length-1]^=1;
        try(var original=f.attempt(40,0)){
            int[] refused={0};
            f.disk.beforeCommit=()->{try{denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0));refused[0]++;}
                catch(Exception error){throw new AssertionError(error);}};
            f.disk.fail=true;denied(()->f.journal().prepare(original));assertEquals(1,refused[0]);f.disk.beforeCommit=()->{};
            int commits=f.disk.commits,encrypts=f.cipher.existing;clearFault(f.disk);
            var foreignValues=NativeRetainedRecordValues.capture(Map.of("foreign","not original values"));
            var foreignPrincipal=NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal().put("assignment_epoch",8));
            denied(()->f.journal().restorePendingPreparedOriginal(foreignValues,f.principal,7,f.credential,0));
            denied(()->f.journal().restorePendingPreparedOriginal(f.values,foreignPrincipal,7,f.credential,0));
            denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,8,f.credential,0));
            denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,wrong,0));
            denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,1));
            try(var target=f.attempt(42,0)){
                var aliasedWrongKind=new AndroidRetainedQueryStore(f.disk.preferences(),new ExistingCipher(AndroidRetainedQueryStore.AAD)).journal();
                denied(()->aliasedWrongKind.restorePendingPreparedOriginal(target,f.principal,7,f.credential));
            }
            assertEquals(commits,f.disk.commits);assertEquals(encrypts,f.cipher.existing);assertTrue(f.disk.memory.isEmpty());
            try(var restored=f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0)){
                f.journal().prepare(restored);f.disk.fail=true;denied(()->f.journal().fenceDispatch(restored));
                clearFault(f.disk);denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0));
                f.disk.memory.put("unknown-original-row","do not discard");var drift=new HashMap<>(f.disk.memory);commits=f.disk.commits;
                denied(()->f.journal().restorePendingPreparedOriginal(f.values,f.principal,7,f.credential,0));
                assertEquals(drift,f.disk.memory);assertEquals(commits,f.disk.commits);
            }
        }finally{Arrays.fill(wrong,'\0');Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        for(Class<?> type:new Class<?>[]{NativeRetainedAttemptJournal.PendingPrepared.class,NativeRetainedQueryJournal.PendingPrepared.class}){
            for(var field:type.getDeclaredFields())assertTrue(java.lang.reflect.Modifier.isPrivate(field.getModifiers()));
            assertEquals(0,type.getDeclaredMethods().length); // no row/map/JSON getters
            for(var constructor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        }
    }

    @Test public void COORD_ordinaryWriteEpochBeforeFalseThrowAndHold()throws Exception {
        var disk=new Disk();var work=new AndroidProtectedWorkPreferences(disk.preferences());
        var original=work.observeReadOnly();int[] calls={0};
        assertFalse(work.withOrdinaryWriteAdmission(()->{calls[0]++;return false;}));
        assertEquals(1,calls[0]);assertFalse(work.matchesReadOnly(original));
        original=work.observeReadOnly();
        denied(()->work.withOrdinaryWriteAdmission(()->{calls[0]++;throw new VaultFailure("synthetic_unknown");}));
        assertEquals(2,calls[0]);assertFalse(work.matchesReadOnly(original));
        original=work.observeReadOnly();work.withOrdinaryWorkAdmission(()->null);
        assertTrue(work.matchesReadOnly(original)); // encryption admission alone is not a write
        disk.memory.put(AndroidProtectedWorkPreferences.FENCE_KEY,"original opaque hold");
        original=work.observeReadOnly();denied(()->work.withOrdinaryWriteAdmission(()->{calls[0]++;return true;}));
        denied(()->work.withOrdinaryWriteAdmission(null));assertEquals(2,calls[0]);assertTrue(work.matchesReadOnly(original));
        assertEquals(0,disk.commits);
    }
    @Test public void COORD_singleMonitorAndUntypedBackingRefusal()throws Exception {
        assertSame(AndroidProviderCipher.STORE_LOCK,AndroidProtectedWorkPreferences.retainedCommitLock());
        assertSame(AndroidProviderCipher.STORE_LOCK,AndroidRetainedBatchStore.LOCK);
        var f=new Fixture();var q=new Disk();var b=new Disk();var queryCipher=new ExistingCipher(AndroidRetainedQueryStore.AAD);
        var write=new AndroidRetainedAttemptStore(f.disk.preferences(),f.cipher);
        var read=new AndroidRetainedQueryStore(q.preferences(),queryCipher);
        var batch=new AndroidRetainedBatchStore(b.preferences(),new ExistingCipher(AndroidRetainedBatchStore.AAD),
            (query,index)->new ExistingCipher("synthetic-slot:"+query+":"+index),write.journal(),read.journal());
        denied(()->write.compareAndCommit(Map.of(),Map.of("index","caller bytes")));
        denied(()->read.compareAndCommit(Map.of(),Map.of("index","caller bytes")));
        denied(()->batch.compareAndCommit(Map.of(),Map.of("batch:index","caller bytes")));
        assertEquals(0,f.disk.commits+q.commits+b.commits);
        for(Class<?> type:new Class<?>[]{NativeRetainedAttemptJournal.OriginalCommit.class,NativeRetainedQueryJournal.OriginalCommit.class,
            NativeRetainedBatchJournal.OriginalCommit.class})
            for(var constructor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
    }
    private static void fault(Disk disk,int mode) {
        disk.fail=mode==0;disk.memoryOnly=mode==1;disk.throwBefore=mode==2;disk.throwAfter=mode==3;
    }
    private static void clearFault(Disk disk){disk.fail=false;disk.memoryOnly=false;disk.throwBefore=false;disk.throwAfter=false;}
    @Test public void COORD_exactWriteCandidateAcrossInstances()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();var workDisk=new Disk();workDisk.memory.put(AndroidProtectedWorkPreferences.FENCE_KEY,"original WORK hold");
            var work=new AndroidProtectedWorkPreferences(workDisk.preferences());var observation=work.observeReadOnly();
            try(var original=f.attempt(40,0);var foreign=f.attempt(41,0)){
                fault(f.disk,mode);denied(()->f.journal().prepare(original));
                assertFalse(work.matchesReadOnly(observation));assertTrue(work.frozen());
                var candidate=new HashMap<>(f.disk.candidates.get(0));int encrypts=f.cipher.existing,commits=f.disk.commits;
                denied(()->f.journal().prepare(foreign));assertEquals(encrypts,f.cipher.existing);assertEquals(commits,f.disk.commits);
                clearFault(f.disk);f.journal().prepare(original);
                assertEquals(candidate,f.disk.candidates.get(1));assertEquals(candidate,f.disk.durable);assertEquals(encrypts,f.cipher.existing);
                assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal().observe().state);
                assertEquals(0,f.cipher.creates+f.cipher.destroys);assertTrue(work.frozen());
            }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void COORD_exactQueryCandidateAcrossInstances()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();var disk=new Disk();var cipher=new ExistingCipher(AndroidRetainedQueryStore.AAD);
            try(var target=f.attempt(40,0);
                var original=NativeRetainedReadQuery.prepare(target,f.principal,7,f.credential,id(50),1791531601123L);
                var foreign=NativeRetainedReadQuery.prepare(target,f.principal,7,f.credential,id(51),1791531601123L)){
                fault(disk,mode);denied(()->new AndroidRetainedQueryStore(disk.preferences(),cipher).journal().prepare(original));
                var candidate=new HashMap<>(disk.candidates.get(0));int encrypts=cipher.existing,commits=disk.commits;
                denied(()->new AndroidRetainedQueryStore(disk.preferences(),cipher).journal().prepare(foreign));
                assertEquals(commits,disk.commits);assertEquals(encrypts,cipher.existing);
                clearFault(disk);var journal=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();journal.prepare(original);
                assertEquals(candidate,disk.candidates.get(1));assertEquals(candidate,disk.durable);assertEquals(encrypts,cipher.existing);
                assertEquals(NativeRetainedQueryJournal.PREPARED,journal.observe().state);assertEquals(0,cipher.creates+cipher.destroys);
            }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void COORD_ambiguousWriteFenceNeverMintsDispatch()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();try(var original=f.attempt(40,0)){
                f.journal().prepare(original);fault(f.disk,mode);denied(()->f.journal().fenceDispatch(original));
                var candidate=new HashMap<>(f.disk.candidates.get(1));int encrypts=f.cipher.existing;
                denied(()->f.journal().prepare(original));clearFault(f.disk);
                denied(()->f.journal().fenceDispatch(original));
                assertEquals(candidate,f.disk.durable);assertEquals(candidate,f.disk.candidates.get(2));assertEquals(encrypts,f.cipher.existing);
                assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.journal().observe().state);
                int commits=f.disk.commits;denied(()->f.journal().fenceDispatch(original));assertEquals(commits,f.disk.commits);
            }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void COORD_ambiguousQueryFenceNeverMintsDispatch()throws Exception {
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();var disk=new Disk();var cipher=new ExistingCipher(AndroidRetainedQueryStore.AAD);
            try(var target=f.attempt(40,0);var query=NativeRetainedReadQuery.prepare(target,f.principal,7,f.credential,id(50),1791531601123L)){
                var journal=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();journal.prepare(query);
                fault(disk,mode);denied(()->journal.fenceDispatch(query));var candidate=new HashMap<>(disk.candidates.get(1));int encrypts=cipher.existing;
                clearFault(disk);var again=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
                denied(()->again.fenceDispatch(query));assertEquals(candidate,disk.durable);assertEquals(encrypts,cipher.existing);
                assertEquals(NativeRetainedQueryJournal.UNKNOWN,again.observe().state);
                int commits=disk.commits;denied(()->again.fenceDispatch(query));assertEquals(commits,disk.commits);
            }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
        }
    }
    @Test public void COORD_pendingRejectsForeignRowsAndClosedOriginal()throws Exception {
        var f=new Fixture();var original=f.attempt(40,0);f.disk.fail=true;denied(()->f.journal().prepare(original));
        clearFault(f.disk);f.disk.memory.put("index","foreign ciphertext");var before=new HashMap<>(f.disk.memory);
        int commits=f.disk.commits,encrypts=f.cipher.existing;denied(()->f.journal().prepare(original));
        assertEquals(before,f.disk.memory);assertEquals(commits,f.disk.commits);assertEquals(encrypts,f.cipher.existing);
        original.close();denied(()->f.journal().prepare(original));assertEquals(commits,f.disk.commits);
        Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);
    }
    @Test public void COORD_candidateRecommitWithoutReencryption()throws Exception {
        var f=new Fixture();try(var original=f.attempt(40,0)){
            f.disk.fail=true;denied(()->f.journal().prepare(original));int encrypts=f.cipher.existing;
            var candidate=new HashMap<>(f.disk.candidates.get(0));f.disk.fail=false;f.journal().prepare(original);
            assertEquals("original failed candidate must not be re-encrypted",encrypts,f.cipher.existing);
            assertEquals(candidate,f.disk.durable);
        }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
    }
    @Test public void COORD_sameThreadCallbackCannotReenterOriginalCommit()throws Exception {
        var f=new Fixture();try(var original=f.attempt(40,0)){
            int[] refused={0};f.disk.beforeCommit=()->{try{denied(()->f.journal().prepare(original));refused[0]++;}
                catch(Exception error){throw new AssertionError(error);}};
            f.journal().prepare(original);assertEquals(1,refused[0]);assertEquals(1,f.disk.commits);
            assertEquals(f.disk.memory,f.disk.durable);
        }finally{Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
    }
    @Test public void COORD_sharedMonitorSerializesOriginalWithOrdinaryWrite()throws Exception {
        var f=new Fixture();var disk=new Disk();var work=new AndroidProtectedWorkPreferences(disk.preferences());
        var entered=new java.util.concurrent.CountDownLatch(1);var release=new java.util.concurrent.CountDownLatch(1);
        var waiting=new java.util.concurrent.CountDownLatch(1);var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
        f.cipher.beforeEncrypt=()->{assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));entered.countDown();
            try{if(!release.await(3,java.util.concurrent.TimeUnit.SECONDS))throw new AssertionError("owned gate timeout");}
            catch(InterruptedException error){Thread.currentThread().interrupt();throw new AssertionError(error);}};
        try(var original=f.attempt(40,0)){
            var first=executor.submit(()->{f.journal().prepare(original);return true;});
            assertTrue(entered.await(3,java.util.concurrent.TimeUnit.SECONDS));
            var second=executor.submit(()->{waiting.countDown();return work.withOrdinaryWriteAdmission(()->{
                assertTrue(Thread.holdsLock(AndroidProviderCipher.STORE_LOCK));return true;});});
            assertTrue(waiting.await(3,java.util.concurrent.TimeUnit.SECONDS));assertFalse(second.isDone());
            release.countDown();assertTrue(first.get(5,java.util.concurrent.TimeUnit.SECONDS));assertTrue(second.get(5,java.util.concurrent.TimeUnit.SECONDS));
        }finally{release.countDown();executor.shutdown();assertTrue(executor.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS));
            Arrays.fill(f.credential,'\0');Arrays.fill(f.wire,(byte)0);}
    }

    @Test public void actualBytesAndHeadersAreEncryptedBeforeSingleUseFence() throws Exception {
        var f=new Fixture();var original=new HashMap<>(f.originals);
        try(var a=f.attempt(40,0)) {
            var j=f.journal();j.prepare(a);assertEquals(1,f.disk.commits);assertEquals(f.disk.memory,f.disk.durable);
            assertEquals(NativeRetainedAttemptJournal.PREPARED,j.observe().state);
            for(Object raw:f.disk.durable.values())assertFalse(raw.toString().contains(a.requestId));
            JSONObject body=new JSONObject(new String(a.body(),StandardCharsets.UTF_8));assertArrayEquals(f.wire,Base64.getDecoder().decode(body.getString("signed_wire_base64")));
            JSONArray transcript=new JSONArray().put(NativeAttestation.REQUEST_VERSION).put(id(3)).put("KIOSK_08").put("POST").put(NativeRetainedAttempt.PATH)
                .put(a.bodySha256).put(a.requestId).put(a.timestamp).put(a.nativeHeaders().get("X-Memphis-Native-Request-Attestation"));
            assertEquals(NativeRetainedAttempt.hash(transcript.toString().getBytes(StandardCharsets.UTF_8)),a.attestationDigest);
            try(var dispatch=j.fenceDispatch(a)) { assertEquals(NativeRetainedAttemptJournal.UNKNOWN,j.observe().state);
                AuthorizedRequest request=dispatch.takeRequest();assertArrayEquals(a.body(),request.body);assertEquals(a.nativeHeaders(),request.headers);Arrays.fill(request.body,(byte)0);denied(()->dispatch.takeRequest()); }
            denied(()->j.fenceDispatch(a));assertEquals(original,f.originals);assertEquals(0,f.cipher.creates);assertEquals(0,f.cipher.destroys);
        }
    }
    @Test public void restartedPreparedAttemptPreservesExactOriginalNonceTimestampAndBody() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.journal().prepare(a);var disk=new HashMap<>(f.disk.durable);f.disk.restart();
            try(var restored=f.restore(f.journal().observe())) { assertArrayEquals(a.body(),restored.body());assertEquals(a.record().toString(),restored.record().toString()); }
            assertEquals(disk,f.disk.durable);assertEquals(1,f.disk.commits); }
    }
    @Test public void falseMemoryOnlyPreparationNeedsExactCiphertextRecommit() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.disk.memoryOnly=true;denied(()->f.journal().prepare(a));assertTrue(f.disk.durable.isEmpty());
            var volatileCipher=new HashMap<>(f.disk.memory);f.disk.memoryOnly=false;f.journal().prepare(a);assertEquals(volatileCipher,f.disk.durable);assertEquals(2,f.disk.commits); }
    }
    @Test public void falsePreparationWithoutWriteDoesNotInventDurableSuccess() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.disk.fail=true;denied(()->f.journal().prepare(a));assertTrue(f.disk.memory.isEmpty());assertNull(f.journal().observe());f.disk.fail=false;f.journal().prepare(a); }
    }
    @Test public void falseMemoryOnlyDispatchReturnsNoCapabilityAndNeverResendsVolatileUnknown() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { var j=f.journal();j.prepare(a);f.disk.memoryOnly=true;denied(()->j.fenceDispatch(a));
            assertEquals(NativeRetainedAttemptJournal.UNKNOWN,j.observe().state);f.disk.memoryOnly=false;denied(()->f.journal().fenceDispatch(a));
            f.disk.restart();assertEquals(NativeRetainedAttemptJournal.PREPARED,f.journal().observe().state);
            // No transport handle was released in the failed attempt. A real
            // durable restart may safely fence this same original prepared body.
            try(var dispatch=f.journal().fenceDispatch(a)) { assertNotNull(dispatch.takeRequest()); } }
    }
    @Test public void durableUnknownSurvivesRestartAndLossOfResponseWithoutRewrite() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { var j=f.journal();j.prepare(a);try(var dispatch=j.fenceDispatch(a)) { dispatch.takeRequest(); }
            var disk=new HashMap<>(f.disk.durable);f.disk.restart();var restarted=f.journal();denied(()->restarted.prepare(a));denied(()->restarted.fenceDispatch(a));
            try(var prior=f.restore(restarted.observe())) { assertEquals(a.attestationDigest,prior.attestationDigest); }
            assertEquals(disk,f.disk.durable);assertEquals(2,f.disk.commits); }
    }
    @Test public void dispatchCommitFailureBeforeWriteReleasesNoHandle() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { var j=f.journal();j.prepare(a);f.disk.fail=true;denied(()->j.fenceDispatch(a));assertEquals(NativeRetainedAttemptJournal.PREPARED,j.observe().state);
            f.disk.fail=false;try(var d=j.fenceDispatch(a)) { assertNotNull(d.takeRequest()); } }
    }
    @Test public void existingAttemptCannotBeReplacedByFreshNonceOrChunk() throws Exception {
        var f=new Fixture();try(var first=f.attempt(40,0);var otherNonce=f.attempt(41,0);var otherChunk=f.attempt(42,1)) {
            var j=f.journal();j.prepare(first);var disk=new HashMap<>(f.disk.durable);denied(()->j.prepare(otherNonce));denied(()->j.prepare(otherChunk));assertEquals(disk,f.disk.durable); }
    }
    @Test public void fullPrincipalAndExactVaultRevisionCannotBeRebound() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) {
            for(String key:new String[]{"employee_id","credential_id","credential_operation_id","installation_seal","enrolled_at","assignment_epoch"}) {
                var p=NativeSeparationContextTest.principal().put(key,key.equals("assignment_epoch")?8:key.equals("installation_seal")?"different-seal-00000001":key.equals("enrolled_at")?"2026-08-01T00:00:00Z":id(99));
                denied(()->NativeRetainedAttempt.restore(a.record(),f.values,NativeProviderPrincipal.fromNativeJournal(p),7,f.credential));
            }
            denied(()->NativeRetainedAttempt.restore(a.record(),f.values,f.principal,8,f.credential));
        }
    }
    @Test public void changedValuesOrCredentialCannotResignOriginalAttempt() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { var changed=new HashMap<>(f.originals);changed.put("unknown-old-work","different opaque bytes");
            denied(()->NativeRetainedAttempt.restore(a.record(),NativeRetainedRecordValues.capture(changed),f.principal,7,f.credential));
            denied(()->NativeRetainedAttempt.restore(a.record(),f.values,f.principal,7,(id(3)+".wrong-secret").toCharArray())); }
    }
    @Test public void persistedNonceTimestampBodyAndDigestTamperingAreRefused() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) {
            for(String key:new String[]{"native_request_id","native_request_timestamp","request_body_sha256","attestation_digest","wire_sha256","native_request_attestation","body_base64"}) {
                JSONObject changed=a.record().put(key,key.equals("native_request_id")?id(99):key.equals("native_request_timestamp")?"2026-10-09T00:00:00.000Z":key.equals("body_base64")?"e30=":"a".repeat(64));
                denied(()->NativeRetainedAttempt.restore(changed,f.values,f.principal,7,f.credential));
            }
        }
    }
    @Test public void corruptEncryptedOrForeignNamespaceIsPreservedWithoutWrite() throws Exception {
        for(int variant=0;variant<3;variant++) { var f=new Fixture();try(var a=f.attempt(40,0)) { f.journal().prepare(a);
            if(variant==0)f.disk.memory.put("index","corrupt");else if(variant==1)f.disk.memory.put("part:0","corrupt");else f.disk.memory.put("foreign","preserved unknown");
            var before=new HashMap<>(f.disk.memory);denied(()->f.journal().observe());denied(()->f.journal().prepare(a));assertEquals(before,f.disk.memory);assertEquals(1,f.disk.commits); } }
    }
    @Test public void corruptedCommitReadbackNeverGrantsTransport() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.journal().prepare(a);f.disk.corruptReadback=true;denied(()->f.journal().fenceDispatch(a));
            assertEquals("preserve me",f.disk.memory.get("unknown-retained"));denied(()->f.journal().observe()); }
    }
    @Test public void lostExistingKeyCannotCreateAReplacementOrTouchDisk() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.cipher.missing=true;denied(()->f.journal().prepare(a));assertEquals(0,f.disk.commits);assertEquals(0,f.cipher.creates);assertEquals(0,f.cipher.destroys);
            f.cipher.missing=false;f.journal().prepare(a);f.cipher.missing=true;var before=new HashMap<>(f.disk.memory);denied(()->f.journal().observe());assertEquals(before,f.disk.memory); }
    }
    @Test public void onlyOneCompetingNativeInstanceCanFenceDispatch() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { f.journal().prepare(a);var pool=Executors.newFixedThreadPool(2);
            try { var one=pool.submit(()-> { try(var d=f.journal().fenceDispatch(a)) { d.takeRequest();return 1; } catch(VaultFailure expected) { return 0; } });
                var two=pool.submit(()-> { try(var d=f.journal().fenceDispatch(a)) { d.takeRequest();return 1; } catch(VaultFailure expected) { return 0; } });
                assertEquals(1,(int)one.get(2,TimeUnit.SECONDS)+(int)two.get(2,TimeUnit.SECONDS));assertEquals(2,f.disk.commits);
            } finally { pool.shutdownNow();assertTrue(pool.awaitTermination(2,TimeUnit.SECONDS)); } }
    }
    @Test public void chunkShapeLimitsAndCopiedRequestCannotMutateOwnedBody() throws Exception {
        var f=new Fixture();try(var a=f.attempt(40,0)) { byte[] body=a.body();body[0]=0;assertEquals('{',a.body()[0]);
            try { a.nativeHeaders().clear();fail(); } catch(UnsupportedOperationException expected) {}
            denied(()->f.attempt(40,-1));denied(()->f.attempt(40,9999));
            JSONObject b=new JSONObject(new String(a.body(),StandardCharsets.UTF_8));assertEquals("0",b.getString("chunk_index"));assertTrue(Integer.parseInt(b.getString("chunk_count"))>1);
            assertEquals(NativeRetainedAttempt.CHUNK_BYTES,Base64.getDecoder().decode(b.getString("chunk_base64")).length);
        }
    }
    @Test public void closureRevokesHandleAndNeverOpensWebViewRetentionRoute() throws Exception {
        var f=new Fixture();var a=f.attempt(40,0);f.journal().prepare(a);var dispatch=f.journal().fenceDispatch(a);dispatch.close();denied(()->dispatch.takeRequest());a.close();denied(()->a.body());
        denied(()->RequestPolicy.validate(new AuthorizedRequest(NativeRetainedAttempt.PATH,"POST",Map.of(),new byte[0]),"KIOSK_08"));
    }
    @Test public void journalPartsRemainBoundToTheirIndexAndRecord() throws Exception {
        var f=new Fixture();byte[] largerWire=(new String(f.wire,StandardCharsets.UTF_8)+" ".repeat(100000)).getBytes(StandardCharsets.UTF_8);
        try(var a=NativeRetainedAttempt.prepareChunk(largerWire,f.values,f.principal,7,f.credential,id(30),id(31),0,id(40),1791531600123L)) {
            f.journal().prepare(a);assertTrue(f.disk.memory.containsKey("part:1"));
            Object first=f.disk.memory.get("part:0");f.disk.memory.put("part:0",f.disk.memory.get("part:1"));f.disk.memory.put("part:1",first);
            var before=new HashMap<>(f.disk.memory);denied(()->f.journal().observe());assertEquals(before,f.disk.memory); }
    }
}
