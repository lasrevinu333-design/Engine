package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual Android adapter and offline store; synthetic durable preferences and
 * TestCipher only. Not AndroidKeyStore, disk fsync, process death or phone proof. */
public final class AndroidProtectedWorkPreferencesTest {
    interface Hook { void run() throws Exception; }
    static final class Preferences {
        Map<String,Object> disk=new HashMap<>(),durableDisk=new HashMap<>();int commits,applies,clears;boolean fail,persistThenFail,corruptReadback;
        private SharedPreferences instance;
        Hook beforeCommit=()->{},afterCommit=()->{};
        SharedPreferences object(){if(instance!=null)return instance;instance=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            switch(method.getName()){
                case "getAll":return new HashMap<>(disk);
                case "contains":return disk.containsKey(args[0]);
                case "getString":case "getStringSet":case "getInt":case "getLong":case "getFloat":case "getBoolean":return disk.getOrDefault(args[0],args[1]);
                case "registerOnSharedPreferenceChangeListener":case "unregisterOnSharedPreferenceChangeListener":return null;
                case "edit":break;
                default:throw new AssertionError(method.getName());
            }
            Map<String,Object> puts=new HashMap<>();Set<String> removes=new HashSet<>();
            return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,action,input)->{
                if(action.getName().startsWith("put")){if(input[1]==null){removes.add((String)input[0]);puts.remove(input[0]);}else{puts.put((String)input[0],input[1]);removes.remove(input[0]);}return editor;}
                switch(action.getName()){
                    case "remove":removes.add((String)input[0]);puts.remove(input[0]);return editor;
                    case "clear":clears++;throw new AssertionError("namespace clear");
                    case "apply":applies++;throw new AssertionError("async persistence");
                    case "commit":
                        commits++;beforeCommit.run();if(fail)return false;
                        Map<String,Object> next=new HashMap<>(disk);for(String key:removes)next.remove(key);next.putAll(puts);disk=next;
                        if(corruptReadback)disk.put("stray","unknown preserved bytes");afterCommit.run();
                        if(!persistThenFail)durableDisk=new HashMap<>(disk);return !persistThenFail;
                    default:throw new AssertionError(action.getName());
                }
            });
        });return instance;}
    }
    interface Attempt{void run()throws Exception;}
    static void denied(Attempt attempt)throws Exception{try{attempt.run();fail("expected refusal");}catch(VaultFailure expected){}}
    static AndroidProtectedWorkPreferences adapter(Preferences p){return new AndroidProtectedWorkPreferences(p.object());}
    @Test public void normalExactWritesRemainAvailableBeforeFence(){
        Preferences p=new Preferences();var a=adapter(p);
        assertTrue(a.edit().putString("occurrence","original").putLong("number",4L).commit());
        assertEquals("original",a.getString("occurrence",null));assertEquals(4,a.getLong("number",0));assertFalse(a.frozen());
        assertTrue(a.edit().remove("number").commit());assertEquals(2,p.commits);assertEquals(0,p.applies);assertEquals(0,p.clears);
    }
    @Test public void exactFreezeRetainsOriginalBytesAndOldStagedEditorCannotCommit()throws Exception{
        Preferences p=new Preferences();p.disk.put("occurrence","unreadable-original-ciphertext");
        var a=adapter(p);var b=adapter(p);var original=a.protectedSnapshot();var stale=b.edit().putString("occurrence","overwrite");
        a.freeze(original,"protected-context-fixture");assertEquals(1,p.commits);assertTrue(b.frozen());
        assertFalse(stale.commit());assertFalse(b.edit().remove("occurrence").commit());assertFalse(b.edit().putString("new-occurrence","new").commit());
        assertEquals("unreadable-original-ciphertext",p.disk.get("occurrence"));assertEquals(2,p.disk.size());
        b.freeze(original,"protected-context-fixture");assertEquals(2,p.commits); // Recommit identical fence, never replace original records.
        denied(()->b.freeze(original,"different-context"));assertEquals(2,p.commits);
    }
    @Test public void changedSnapshotNeverFreezesStaleInventory()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var before=a.protectedSnapshot();
        assertTrue(adapter(p).edit().putString("pending","new protected work").commit());
        denied(()->a.freeze(before,"context"));assertFalse(a.frozen());assertEquals(1,p.commits);
        a.freeze(a.protectedSnapshot(),"context");assertTrue(a.frozen());assertEquals("new protected work",p.disk.get("pending"));
    }
    @Test public void failedAndAmbiguousCommitRetainBytesAndExactRetry()throws Exception{
        for(boolean ambiguous:new boolean[]{false,true}){
            Preferences p=new Preferences();p.disk.put("draft","original");var a=adapter(p);var before=a.protectedSnapshot();
            p.fail=!ambiguous;p.persistThenFail=ambiguous;denied(()->a.freeze(before,"context"));
            assertEquals("original",p.disk.get("draft"));assertEquals(ambiguous,a.frozen());
            p.fail=false;p.persistThenFail=false;adapter(p).freeze(before,"context");assertTrue(a.frozen());
            assertEquals(2,p.commits);assertEquals(0,p.clears);
        }
    }
    @Test public void corruptReadbackPreservesUnknownAndDoesNotAcknowledge()throws Exception{
        Preferences p=new Preferences();p.disk.put("draft","original");var a=adapter(p);var before=a.protectedSnapshot();
        p.corruptReadback=true;denied(()->a.freeze(before,"context"));assertTrue(a.frozen());
        assertEquals("original",p.disk.get("draft"));assertEquals("unknown preserved bytes",p.disk.get("stray"));
        denied(()->adapter(p).freeze(before,"context"));assertEquals(1,p.commits);
    }
    @Test public void malformedExistingFenceStillBlocksAndCannotBeRemoved(){
        Preferences p=new Preferences();p.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,7);
        var a=adapter(p);assertTrue(a.frozen());assertFalse(a.edit().remove(AndroidProtectedWorkPreferences.FENCE_KEY).commit());
        assertFalse(a.edit().putString("new","work").commit());assertEquals(7,p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));assertEquals(0,p.commits);
    }
    @Test public void ordinaryEditorCannotMintFenceClearOrApply(){
        Preferences p=new Preferences();var a=adapter(p);
        assertFalse(a.edit().putString(AndroidProtectedWorkPreferences.FENCE_KEY,"forged").commit());assertFalse(a.edit().clear().commit());
        try{a.edit().putString("draft","x").apply();fail();}catch(IllegalStateException expected){}
        assertTrue(p.disk.isEmpty());assertEquals(0,p.commits);assertEquals(0,p.clears);assertEquals(0,p.applies);
    }
    @Test public void snapshotAndSetCopiesCannotMutateOriginalStore(){
        Preferences p=new Preferences();p.disk.put("set",new HashSet<>(Set.of("original")));var a=adapter(p);
        try{a.protectedSnapshot().clear();fail();}catch(UnsupportedOperationException expected){}
        a.getStringSet("set",null).clear();assertEquals(Set.of("original"),p.disk.get("set"));
    }
    @Test public void actualOfflineStoreAllInstancesRespectFenceWithoutDeletingSavedWork()throws Exception{
        Preferences p=new Preferences();TestCipher cipher=new TestCipher();
        var first=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);var second=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        first.savePrincipal("{\"synthetic\":\"original principal\"}");first.saveCompletionReceipt("a".repeat(64),"exact original receipt");
        first.saveLegacyRecord("principal","exact original legacy record");var original=new HashMap<>(p.disk);
        var gate=adapter(p);gate.freeze(gate.protectedSnapshot(),"protected context fixture");int count=p.commits;
        denied(()->second.savePrincipal("{\"synthetic\":\"replacement\"}"));
        denied(()->second.saveCompletionReceipt("b".repeat(64),"new receipt"));
        denied(()->second.deleteCompletionReceipt("a".repeat(64)));
        denied(()->second.saveLegacyRecord("principal","replacement"));
        for(var entry:original.entrySet())assertEquals(entry.getValue(),p.disk.get(entry.getKey()));assertEquals(count,p.commits);
        assertEquals("exact original receipt",second.loadCompletionReceipt("a".repeat(64)));
        assertEquals("exact original legacy record",second.loadLegacyRecord("principal"));assertEquals(0,cipher.destroyCalls);
    }
    @Test public void differentInstancesSerializeInFlightCommitAndFreeze()throws Exception{
        Preferences p=new Preferences();var a=adapter(p);var b=adapter(p);var prior=a.protectedSnapshot();
        CountDownLatch inCommit=new CountDownLatch(1),release=new CountDownLatch(1),attempted=new CountDownLatch(1);
        p.beforeCommit=()->{inCommit.countDown();if(!release.await(2,TimeUnit.SECONDS))throw new AssertionError("bounded release");};
        var pool=Executors.newFixedThreadPool(2);
        try{
            var writer=pool.submit(()->a.edit().putString("occurrence","arrived first").commit());assertTrue(inCommit.await(2,TimeUnit.SECONDS));
            var freezing=pool.submit(()->{attempted.countDown();denied(()->b.freeze(prior,"context"));return true;});
            assertTrue(attempted.await(2,TimeUnit.SECONDS));assertFalse(freezing.isDone());release.countDown();
            assertTrue(writer.get(2,TimeUnit.SECONDS));assertTrue(freezing.get(2,TimeUnit.SECONDS));assertFalse(a.frozen());
            p.beforeCommit=()->{};b.freeze(b.protectedSnapshot(),"context");assertEquals("arrived first",p.disk.get("occurrence"));
        }finally{release.countDown();pool.shutdownNow();assertTrue(pool.awaitTermination(2,TimeUnit.SECONDS));}
    }
    @Test public void rawCasRejectsDistinctFloatNaNPayloadsAcrossProbeFreezeAndCancel()throws Exception{
        float first=Float.intBitsToFloat(0x7fc00001),second=Float.intBitsToFloat(0x7fc00002);
        Preferences p=new Preferences();p.disk.put("float",first);p.durableDisk=new HashMap<>(p.disk);
        var a=adapter(p);Map<String,?> stale=a.protectedSnapshot();
        assertFalse(NativeProtectedWorkSnapshot.exactRawEquals(stale,Map.of("float",second)));
        p.disk.put("float",second);p.durableDisk=new HashMap<>(p.disk);
        denied(()->a.prepareProbe(stale,"pending"));denied(()->a.freeze(stale,"context"));
        Map<String,?> current=a.protectedSnapshot();a.prepareProbe(current,"pending");
        denied(()->a.cancelProbe(stale,"pending"));
        assertEquals("pending",p.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY));
        assertEquals(0x7fc00002,Float.floatToRawIntBits((Float)p.disk.get("float")));
    }

    @Test public void failedVaultCommitCannotPromoteVolatileStateAndFreshRestartSeesDurableTruth()throws Exception{
        Preferences p=new Preferences();SharedPreferencesVaultPersistence storage=
            new SharedPreferencesVaultPersistence(p.object(),new VaultSnapshotCodec());
        VaultSnapshot current=VaultSnapshot.empty();
        VaultSnapshot next=current.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,
            EnrollmentMetadata.empty(),"","",false,"");
        p.persistThenFail=true;
        try{storage.commit(current.revision,next);fail();}catch(VaultFailure expected){
            assertEquals("custodial_native_vault_commit_failed",expected.code);
        }
        assertTrue(p.durableDisk.isEmpty());
        try{storage.load();fail();}catch(VaultFailure expected){
            assertEquals("custodial_native_vault_durability_unconfirmed",expected.code);
        }
        Preferences restarted=new Preferences();restarted.disk=new HashMap<>(p.durableDisk);restarted.durableDisk=new HashMap<>(p.durableDisk);
        assertEquals(current,new SharedPreferencesVaultPersistence(restarted.object(),new VaultSnapshotCodec()).load());
        p.persistThenFail=false;storage.commit(current.revision,next);
        assertEquals(next,storage.load());assertFalse(p.durableDisk.isEmpty());
    }

    static final String DEVICE="KIOSK_08", SNAPSHOT="a".repeat(64), SESSION="22222222-2222-4222-8222-222222222222", ENTRY="33333333-3333-4333-8333-333333333333";
    static final String GENERATED="2026-09-27T08:00:00.000Z", EXPIRY="2026-09-27T09:00:00.000Z";
    static final class WorkFixture {
        final Preferences p=new Preferences();final TestCipher cipher=new TestCipher();
        final AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        Hook clockRead=()->{};
        final OfflineAuthorityTime time=new OfflineAuthorityTime(store,new OfflineAuthorityTime.MonotonicClock(){
            public long now(){try{clockRead.run();}catch(Exception e){throw new IllegalStateException(e);}return 1000;}
            public int bootCount(){return 7;}
        });
        WorkFixture()throws Exception{time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY);time.authorizeNewWork(DEVICE,SNAPSHOT);}
        void freeze()throws Exception{var gate=adapter(p);gate.freeze(gate.protectedSnapshot(),"protected context fixture");}
    }
    @Test public void frozenAnchorCannotAuthorizeByNoWriteRetryAndRetainsReadOnlyEvidence()throws Exception{
        for(boolean malformed:new boolean[]{false,true}){
            var f=new WorkFixture();var before=new HashMap<>(f.p.disk);
            if(malformed)f.p.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,7);else f.freeze();
            int commits=f.p.commits;
            denied(()->f.time.authorizeNewWork(DEVICE,SNAPSHOT));
            denied(()->f.time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY));
            var restarted=new OfflineAuthorityTime(new AndroidOfflineAuthorityTimeStore(f.p.object(),f.cipher),new OfflineAuthorityTime.MonotonicClock(){public long now(){return 1000;}public int bootCount(){return 7;}});
            denied(()->restarted.authorizeNewWork(DEVICE,SNAPSHOT));
            assertNotNull(f.store.loadAnchor());assertNotNull(f.time.providerObservation(DEVICE));
            for(var e:before.entrySet())assertEquals(e.getValue(),f.p.disk.get(e.getKey()));assertEquals(commits,f.p.commits);
        }
    }
    @Test public void frozenExactStartAndFinishRetriesCannotReturnOrdinaryWorkAuthority()throws Exception{
        var f=new WorkFixture();String started=f.time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);
        f.time.completeOccurrenceFromScan(DEVICE,"TETM",SESSION,started,ENTRY,true);
        var before=new HashMap<>(f.p.disk);f.freeze();int commits=f.p.commits;
        denied(()->f.time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT));
        denied(()->f.time.completeOccurrence(DEVICE,"TETM",SESSION,started));
        denied(()->f.time.completeOccurrenceFromScan(DEVICE,"TETM",SESSION,started,ENTRY,true));
        assertNotNull(f.store.loadOccurrence(SESSION));
        for(var e:before.entrySet())assertEquals(e.getValue(),f.p.disk.get(e.getKey()));assertEquals(commits,f.p.commits);
    }
    @Test public void fenceArrivingDuringReadOnlyAdmissionCannotEscapeThroughCachedSuccess()throws Exception{
        for(boolean authorize:new boolean[]{false,true}){
            var f=new WorkFixture();f.clockRead=()->{f.clockRead=()->{};f.freeze();};
            if(authorize)denied(()->f.time.authorizeNewWork(DEVICE,SNAPSHOT));
            else denied(()->f.time.acceptSnapshot(DEVICE,SNAPSHOT,GENERATED,EXPIRY));
            assertTrue(adapter(f.p).frozen());assertNotNull(f.store.loadAnchor());assertEquals(0,f.cipher.destroyCalls);
        }
    }
    @Test public void retryMustEstablishDurabilityAfterFailedCommitChangedOnlyMemory()throws Exception{
        var p=new Preferences();var a=adapter(p);assertTrue(a.edit().putString("draft","original").commit());
        var before=a.protectedSnapshot();p.persistThenFail=true;denied(()->a.freeze(before,"context"));
        assertTrue(a.frozen());assertFalse(p.durableDisk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        p.persistThenFail=false;adapter(p).freeze(before,"context");
        // A successful retry must survive a new process, not just see old volatile bytes.
        p.disk=new HashMap<>(p.durableDisk);assertTrue(adapter(p).frozen());assertEquals("original",p.disk.get("draft"));
    }
    static NativeSeparationEvidence proof(Map<String,?> original)throws Exception{
        char[] secret=NativeSeparationEvidenceTest.credential();
        try{return NativeSeparationEvidence.sign(NativeSeparationEvidenceTest.context(),NativeProtectedWorkSnapshot.capture(original),secret);}
        finally{VaultValidation.wipe(secret);}
    }
    @Test public void actualStoreFreezesEncryptedSignedSnapshotAndRetainsEveryOriginalByte()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");p.disk.put("unreadable","corrupt protected original");
        var original=store.separationRawSnapshot();var evidence=proof(original);int existing=cipher.existingKeyEncryptCalls;
        store.freezeSeparationSnapshot(original,evidence);assertEquals(existing+1,cipher.existingKeyEncryptCalls);
        String encrypted=(String)p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        assertFalse(encrypted.contains("manifest_body"));assertFalse(encrypted.contains(evidence.signature));
        var restarted=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);restarted.freezeSeparationSnapshot(original,evidence);
        assertEquals(encrypted,p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY));assertEquals(existing+1,cipher.existingKeyEncryptCalls);
        denied(()->restarted.requireWorkAdmission());assertEquals(original.size()+1,p.disk.size());
        for(var entry:original.entrySet())assertEquals(entry.getValue(),p.disk.get(entry.getKey()));assertEquals(0,cipher.destroyCalls);
        assertTrue(restarted.separationRawSnapshot().containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
    }
    @Test public void signedSnapshotMismatchInterveningWriterAndMissingKeyCannotFreezeWrongWork()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");var original=store.separationRawSnapshot();var evidence=proof(original);
        denied(()->store.freezeSeparationSnapshot(Map.of("other","wrong"),evidence));assertFalse(adapter(p).frozen());
        store.savePrincipal("{\"new\":true}");denied(()->store.freezeSeparationSnapshot(original,evidence));assertFalse(adapter(p).frozen());
        var captured=store.separationRawSnapshot();var signed=proof(captured);cipher.existingKeyUnavailable=true;
        denied(()->store.freezeSeparationSnapshot(captured,signed));
        assertFalse(adapter(p).frozen());assertEquals(0,cipher.destroyCalls);
    }
    @Test public void signedFreezeRetryReusesExactCiphertextAndEstablishesDurability()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.object(),cipher);
        store.savePrincipal("{\"synthetic\":\"retained\"}");var original=store.separationRawSnapshot();var evidence=proof(original);p.persistThenFail=true;
        denied(()->store.freezeSeparationSnapshot(original,evidence));String retained=(String)p.disk.get(AndroidProtectedWorkPreferences.FENCE_KEY);
        int encryptions=cipher.existingKeyEncryptCalls;p.persistThenFail=false;
        new AndroidOfflineAuthorityTimeStore(p.object(),cipher).freezeSeparationSnapshot(original,evidence);
        assertEquals(encryptions,cipher.existingKeyEncryptCalls);assertEquals(retained,p.durableDisk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
        p.disk=new HashMap<>(p.durableDisk);denied(()->new AndroidOfflineAuthorityTimeStore(p.object(),cipher).requireWorkAdmission());
    }
    @Test public void pendingProbeBlocksEveryOrdinaryWriterAndReservedMutation()throws Exception{
        var p=new Preferences();p.disk.put("draft","exact original saved draft");var a=adapter(p);var b=adapter(p);
        var original=a.protectedSnapshot();var staged=b.edit().putString("draft","overwritten");
        assertFalse(a.edit().putString(AndroidProtectedWorkPreferences.PROBE_KEY,"forged check").commit());
        a.prepareProbe(original,"encrypted pending check");assertTrue(a.frozen());assertTrue(b.frozen());
        assertFalse(staged.commit());assertFalse(b.edit().remove(AndroidProtectedWorkPreferences.PROBE_KEY).commit());
        assertEquals("exact original saved draft",p.disk.get("draft"));assertEquals(p.disk,p.durableDisk);
        denied(()->b.freeze(original,"encrypted final context"));
        b.freeze(original,"encrypted final context","encrypted pending check");
        assertFalse(p.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));assertEquals("encrypted final context",p.durableDisk.get(AndroidProtectedWorkPreferences.FENCE_KEY));
    }
    @Test public void corruptOrChangedProbeCannotBecomeOrdinaryAdmissionOrBeReplaced()throws Exception{
        for(Object value:new Object[]{"unreadable guard",7,null}){
            var p=new Preferences();p.disk.put("work","original");p.disk.put(AndroidProtectedWorkPreferences.PROBE_KEY,value);
            var a=adapter(p);assertTrue(a.frozen());var before=new HashMap<>(p.disk);
            denied(()->a.prepareProbe(Map.of("work","original"),"different pending"));assertEquals(before,p.disk);
            assertFalse(a.edit().putString("ordinary","new work").commit());assertEquals(before,p.disk);
        }
    }
}
