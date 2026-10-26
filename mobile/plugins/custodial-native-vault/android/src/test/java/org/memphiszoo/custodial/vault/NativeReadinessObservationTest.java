package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real native engine/principal/clock rules; immutable synthetic store snapshots.
 * Every ordinary outcome asserts retained byte identities and zero mutations. */
public final class NativeReadinessObservationTest {
    static final String DEVICE="KIOSK_08", ID="a".repeat(64), START="2026-09-24T12:00:00.000Z", END="2026-09-24T12:15:00.000Z";
    interface Hook { void run() throws Exception; }
    static class Data implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
        OfflineAuthorityTime.OfflineAuthorityAnchor anchor;
        boolean pending, unfinished, fence, quarantine, scans, broken, frozen;
        int writes;
        Data() {}
        Data(Data from) { anchor=from.anchor;pending=from.pending;unfinished=from.unfinished;fence=from.fence;quarantine=from.quarantine;scans=from.scans;broken=from.broken;frozen=from.frozen; }
        String bytes() { return (anchor==null?"none":anchor.deviceId+anchor.snapshotId+anchor.generatedAt+anchor.expiresAt+anchor.clockBaseAt+anchor.snapshotJson+anchor.anchorElapsedRealtimeMillis+anchor.bootCount+anchor.newWorkAuthorized)+pending+unfinished+fence+quarantine+scans+broken+frozen; }
        public void requireWorkAdmission() throws VaultFailure { if(frozen)throw new VaultFailure("custodial_native_protected_work_frozen"); }
        public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor() throws VaultFailure { if(broken)throw new VaultFailure("custodial_native_offline_anchor_refused");return anchor; }
        private void refuse() { writes++;throw new AssertionError("read-only observation attempted mutation"); }
        public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor a){refuse();}
        public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String id){return null;}
        public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence o){refuse();}
        public void deleteOccurrence(String id){refuse();}
        public boolean hasOccurrences(){return pending;}
        public boolean hasUnfinishedOccurrences(){return unfinished;}
        public OfflineAuthorityTime.RollbackFence loadRollbackFence(){return fence?new OfflineAuthorityTime.RollbackFence(DEVICE,"synthetic-fence"):null;}
        public void saveRollbackFence(OfflineAuthorityTime.RollbackFence f){refuse();}
        public void deleteRollbackFence(){refuse();}
        public Map<String,Object> loadScanJournalQuarantine(){return quarantine?Map.of("protected","retained"):Map.of();}
        public Map<String,Map<String,Object>> loadScanEntries(){return scans?Map.of("original",Map.of("retained",true)):Map.of();}
    }
    static final class Clock implements OfflineAuthorityTime.MonotonicClock {
        long elapsed=2000;int boot=7,reads;Hook hook;boolean fail;
        public long now(){if(fail)throw new IllegalStateException("synthetic unavailable");if(hook!=null){Hook once=hook;hook=null;try{once.run();}catch(Exception e){throw new IllegalStateException(e);}}return elapsed;}
        public int bootCount(){reads++;return boot;}
    }
    static final class Fixture {
        final NativeProviderHttpTest.Fixture f;
        final Data data=new Data();final Clock clock=new Clock();
        String identity;int captures;Hook onSecond;boolean unstable;
        Fixture(boolean legacy)throws Exception{
            f=new NativeProviderHttpTest.Fixture(legacy);identity=f.principal.json().toString();
            JSONObject snapshot=new JSONObject().put("schema_version","offline-scan-snapshot.v2").put("contract_version","scan.v4.snapshot-bound-authority")
                .put("canonical_device_id",DEVICE).put("snapshot_id",ID).put("generated_at",START).put("expires_at",END);
            for(String key:new String[]{"employee_id","credential_id","assignment_epoch"})snapshot.put(key,f.principal.json().get(key));
            data.anchor=new OfflineAuthorityTime.OfflineAuthorityAnchor(DEVICE,ID,START,END,START,1000,7,false,snapshot.toString());
        }
        NativeReadinessObservation observer(){return new NativeReadinessObservation(f.engine,()->{
            captures++;if(captures==2&&onSecond!=null)try{onSecond.run();}catch(Exception e){throw new VaultFailure("synthetic_race",e);}
            Data frozen=new Data(data);String original=frozen.bytes();
            String principal=f.principalMemory.value;Map<String,String> legacy=f.legacy==null?Map.of():new HashMap<>(f.legacy.store.records);
            NativePrincipalJournal p=new NativePrincipalJournal(new NativePrincipalJournal.Store(){public String loadPrincipal(){return principal;}public void savePrincipal(String s){throw new AssertionError("write");}});
            NativeLegacyLineageJournal l=new NativeLegacyLineageJournal(new NativeLegacyLineageJournal.Store(){public String loadLegacyRecord(String k){return legacy.get(k);}public void saveLegacyRecord(String k,String v){throw new AssertionError("write");}});
            return new NativeReadinessObservation.Snapshot(new OfflineAuthorityTime(frozen,clock),p,l,frozen.frozen,
                ()->!unstable&&original.equals(data.bytes())&&java.util.Objects.equals(principal,f.principalMemory.value)
                    &&legacy.equals(f.legacy==null?Map.of():f.legacy.store.records));
        });}
        Map<String,Object> unchanged()throws Exception{
            byte[] vault=new VaultSnapshotCodec().encode(f.persistence.current());String bytes=data.bytes(),principal=f.principalMemory.value;
            Map<String,String> legacy=f.legacy==null?Map.of():new HashMap<>(f.legacy.store.records);
            Map<String,Object> provider=new HashMap<>(f.provider.storage.memory.raw);int commits=f.persistence.commitAttempts.get(),encrypts=f.cipher.existingKeyEncryptCalls;
            Map<String,Object> result=observer().observe(DEVICE,identity);
            assertArrayEquals(vault,new VaultSnapshotCodec().encode(f.persistence.current()));assertEquals(bytes,data.bytes());
            assertEquals(principal,f.principalMemory.value);assertEquals(legacy,f.legacy==null?Map.of():f.legacy.store.records);
            assertEquals(provider,f.provider.storage.memory.raw);assertEquals(commits,f.persistence.commitAttempts.get());
            assertEquals(encrypts,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);assertEquals(0,data.writes);
            assertEquals(true,result.get("read_only"));assertEquals(14,result.size());return result;
        }
    }
    @Test public void bothFullPrincipalGrammarsObserveOriginalClockWithoutSettingAuthorization()throws Exception{
        for(boolean legacy:new boolean[]{false,true}){Fixture x=new Fixture(legacy);Map<String,Object> r=x.unchanged();
            assertEquals("CONFIRMED",r.get("observation"));assertEquals(ID,r.get("snapshot_id"));assertEquals(x.identity,r.get("principal_identity"));
            assertEquals(2000L,r.get("observed_elapsed_realtime_ms"));assertEquals(7,r.get("observed_boot_count"));assertFalse(x.data.anchor.newWorkAuthorized);
            assertFalse(r.toString().contains("installation_binding_sha256="));assertEquals(2,x.captures);
        }
    }
    @Test public void missingExpiredRebootRetreatAndUnavailableClockNeverPromote()throws Exception{
        for(String fault:new String[]{"missing","expired","reboot","retreat","unavailable","negative"}){
            Fixture x=new Fixture(false);
            if(fault.equals("missing"))x.data.anchor=null;else if(fault.equals("expired"))x.clock.elapsed=901001;
            else if(fault.equals("reboot"))x.clock.boot=8;else if(fault.equals("retreat"))x.clock.elapsed=999;
            else if(fault.equals("negative"))x.clock.elapsed=-1;else x.clock.fail=true;
            Map<String,Object> r=x.unchanged();assertNotEquals(fault,"CONFIRMED",r.get("observation"));
            if(fault.equals("expired"))assertEquals("EXPIRED",r.get("native_clock_continuity"));
        }
    }
    @Test public void originalUnfinishedCompletedRollbackQuarantineAndPendingScanRemainDistinct()throws Exception{
        for(String state:new String[]{"unfinished","completed","rollback","quarantine","scan","frozen","corrupt"}){
            Fixture x=new Fixture(false);x.data.pending=state.equals("unfinished")||state.equals("completed");x.data.unfinished=state.equals("unfinished");
            x.data.fence=state.equals("rollback");x.data.quarantine=state.equals("quarantine");x.data.scans=state.equals("scan");x.data.frozen=state.equals("frozen");x.data.broken=state.equals("corrupt");
            Map<String,Object> r=x.unchanged();assertNotEquals(state,"CONFIRMED",r.get("observation"));
            if(state.equals("unfinished"))assertEquals("original_finish_pending",r.get("reason"));
            if(state.equals("completed"))assertEquals("original_receipt_pending",r.get("reason"));
            if(state.equals("rollback"))assertEquals(true,r.get("rollback_fence_active"));
            if(state.equals("frozen"))assertEquals("RECOVERY_REQUIRED",r.get("protected_work_admission"));
        }
    }
    @Test public void wrongMissingAndStaleExpectedPrincipalNeverAuthorizesOrMutates()throws Exception{
        for(String wrong:new String[]{"missing","employee","epoch","extra","duplicate"}){
            Fixture x=new Fixture(false);JSONObject identity=new JSONObject(x.identity);
            if(wrong.equals("employee"))identity.put("employee_id",NativePrincipalJournalTest.NEW);
            if(wrong.equals("epoch"))identity.put("assignment_epoch",5);if(wrong.equals("extra"))identity.put("fake",true);
            x.identity=wrong.equals("missing")?"{}":wrong.equals("duplicate")?x.identity.replaceFirst("\\{","{\"schema_version\":\"bad\","):identity.toString();
            assertEquals("UNKNOWN",x.unchanged().get("observation"));
        }
    }
    @Test public void snapshotEmployeeCredentialAndEpochMustMatchCurrentNativePrincipal()throws Exception{
        for(String key:new String[]{"employee_id","credential_id","assignment_epoch","canonical_device_id","snapshot_id"}){
            Fixture x=new Fixture(false);JSONObject snapshot=new JSONObject(x.data.anchor.snapshotJson);
            snapshot.put(key,key.equals("assignment_epoch")?5:key.equals("canonical_device_id")?"KIOSK_09":key.equals("snapshot_id")?"b".repeat(64):NativePrincipalJournalTest.NEW);
            x.data.anchor=new OfflineAuthorityTime.OfflineAuthorityAnchor(DEVICE,ID,START,END,START,1000,7,false,snapshot.toString());
            assertNotEquals("CONFIRMED",x.unchanged().get("observation"));
        }
    }
    @Test public void missingStorageOrReadFailureIsUnknownNotAnEmptyQueue()throws Exception{
        Fixture x=new Fixture(false);x.f.persistence.failLoads=1;Map<String,Object> r=x.unchanged();
        assertEquals("UNKNOWN",r.get("observation"));assertNull(r.get("pending_occurrences"));assertNull(r.get("principal_identity"));
        assertEquals("UNKNOWN",new NativeReadinessObservation(x.f.engine,()->{throw new VaultFailure("unavailable");}).observe(DEVICE,x.identity).get("observation"));
    }
    @Test public void readonlyEngineCannotTriggerLegacyRecoveryOrPendingExpiry()throws Exception{
        MutableClock c=new MutableClock(NativeProviderHttpTest.NOW);MemoryPersistence p=new MemoryPersistence();TestCipher cipher=new TestCipher();
        FakeTransport t=new FakeTransport(c);FakeLegacySource legacy=new FakeLegacySource("retained-legacy".toCharArray(),null,"original-seal-00000001");
        VaultEngine engine=new VaultEngine(p,cipher,t,legacy,new TestSealGenerator(),c);byte[] before=new VaultSnapshotCodec().encode(p.current());
        assertEquals("EMPTY",engine.observeStateReadOnly().get("state"));assertArrayEquals(before,new VaultSnapshotCodec().encode(p.current()));assertEquals(0,p.commitAttempts.get());
        assertFalse(legacy.isClean());assertEquals(0,cipher.destroyCalls);assertEquals(0,t.enrollCalls.get());
        MemoryPersistence pending=new MemoryPersistence();FakeTransport transport=new FakeTransport(c);
        VaultEngine pendingEngine=new VaultEngine(pending,new TestCipher(),transport,new FakeLegacySource(),new TestSealGenerator(),c);
        pendingEngine.enroll(NativeProviderHttpTest.OP,DEVICE,"enrollment","12345678".toCharArray());
        byte[] staged=new VaultSnapshotCodec().encode(pending.current());int commits=pending.commitAttempts.get();String phase=pending.current().phase.name();
        c.now+=24*60*60*1000L;assertEquals(phase,pendingEngine.observeStateReadOnly().get("state"));
        assertArrayEquals(staged,new VaultSnapshotCodec().encode(pending.current()));assertEquals(commits,pending.commitAttempts.get());
    }
    @Test public void exactExistingExpiryBoundaryAndUnavailableEnrollmentStayTruthful()throws Exception{
        Fixture boundary=new Fixture(false);boundary.clock.elapsed=901000;assertEquals("CONFIRMED",boundary.unchanged().get("observation"));
        boundary.clock.elapsed=901001;assertEquals("EXPIRED",boundary.unchanged().get("native_clock_continuity"));
        for(boolean unreadable:new boolean[]{false,true}){Fixture x=new Fixture(false);
            if(unreadable)x.f.cipher.makeUnreadable(x.f.persistence.current().secret);else x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,DEVICE);
            Map<String,Object> r=x.unchanged();assertEquals("NEEDS_MANAGER",r.get("observation"));assertNull(r.get("pending_occurrences"));assertNull(r.get("principal_identity"));
        }
    }
    @Test public void changedRawSnapshotDuringClockReadReturnsUnknownUsingOriginalFrozenDecode()throws Exception{
        Fixture x=new Fixture(false);x.clock.hook=()->x.data.pending=true;
        Map<String,Object> r=x.observer().observe(DEVICE,x.identity);assertEquals("UNKNOWN",r.get("observation"));assertEquals("observation_changed",r.get("reason"));
        assertNull(r.get("pending_occurrences"));assertTrue(x.data.pending);assertEquals(0,x.data.writes);
    }
    @Test public void sameVaultRevisionReassignmentBetweenCapturesCannotPromote()throws Exception{
        Fixture x=new Fixture(false);long rev=x.f.persistence.current().revision;
        x.onSecond=()->new NativePrincipalJournalTest().capture(x.f.principalJournal,x.f.engine.observeStateReadOnly(),new NativePrincipalJournalTest().data()
            .put("credential_id",x.f.principal.json().get("credential_id")).put("assignment_epoch",5));
        assertEquals("UNKNOWN",x.observer().observe(DEVICE,x.identity).get("observation"));assertEquals(rev,x.f.persistence.current().revision);assertEquals(0,x.data.writes);
    }
    @Test public void admissionDispositionOrEnrollmentChangingMidObservationCannotPromote()throws Exception{
        for(boolean remove:new boolean[]{false,true}){Fixture x=new Fixture(false);
            x.clock.hook=()->{if(remove)x.f.engine.removeEnrollment(NativeProviderHttpTest.RID,DEVICE);else x.data.frozen=true;};
            assertEquals("UNKNOWN",x.observer().observe(DEVICE,x.identity).get("observation"));assertEquals(0,x.data.writes);
        }
    }
    @Test public void immutableAndroidViewRefusesEveryWriteListenerAndMutableAlias()throws Exception{
        Map<String,Object> raw=new HashMap<>();java.util.Set<String> set=new java.util.HashSet<>(java.util.List.of("original"));raw.put("s",set);raw.put("key","bytes");
        AndroidReadOnlyPreferences view=new AndroidReadOnlyPreferences(raw);raw.put("key","changed");set.add("changed");
        assertEquals("bytes",view.getString("key",null));assertEquals(java.util.Set.of("original"),view.getStringSet("s",null));
        for(Runnable action:java.util.List.<Runnable>of(()->view.edit(),()->view.registerOnSharedPreferenceChangeListener(null),()->view.unregisterOnSharedPreferenceChangeListener(null),
            ()->view.getAll().clear(),()->view.getStringSet("s",null).clear())){
            try{action.run();fail();}catch(UnsupportedOperationException expected){}
        }
    }
    @Test public void actualAndroidEncryptedStoreCaptureUsesFrozenBytesAndPerformsNoCommit()throws Exception{
        for(String fault:new String[]{"none","expired","reboot","fence","corrupt","changed"}){
            Fixture x=new Fixture(false);AndroidProviderAdapterTest.Preferences raw=new AndroidProviderAdapterTest.Preferences();
            android.content.SharedPreferences delegate=raw.object();
            android.content.SharedPreferences prefs=(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
                getClass().getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                    if(method.getName().equals("getString"))return raw.disk.getOrDefault(args[0],args[1]);
                    if(method.getName().equals("contains"))return raw.disk.containsKey(args[0]);
                    try{return method.invoke(delegate,args);}catch(java.lang.reflect.InvocationTargetException e){throw e.getCause();}
                });
            TestCipher cipher=new TestCipher();AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(prefs,cipher);
            store.savePrincipal(x.f.principalMemory.value);store.saveAnchor(x.data.anchor);
            if(fault.equals("expired"))x.clock.elapsed=901001;if(fault.equals("reboot"))x.clock.boot=8;
            if(fault.equals("fence"))raw.disk.put(AndroidProtectedWorkPreferences.FENCE_KEY,"unreadable retained original fence");
            if(fault.equals("corrupt"))raw.disk.put("offline_authority_anchor","corrupt retained bytes");
            if(fault.equals("changed"))x.clock.hook=()->raw.disk.put("retained:changed","race");
            Map<String,Object> before=new HashMap<>(raw.disk);int commits=raw.commits,encrypts=cipher.existingKeyEncryptCalls;
            OfflineAuthorityTime time=new OfflineAuthorityTime(store,x.clock);
            Map<String,Object> result=new NativeReadinessObservation(x.f.engine,()->store.captureReadinessObservation(time)).observe(DEVICE,x.identity);
            if(fault.equals("none"))assertEquals("CONFIRMED",result.get("observation"));else assertNotEquals(fault,"CONFIRMED",result.get("observation"));
            if(fault.equals("changed"))before.put("retained:changed","race");
            assertEquals(before,raw.disk);assertEquals(commits,raw.commits);assertEquals(encrypts,cipher.existingKeyEncryptCalls);assertEquals(0,cipher.destroyCalls);
            assertEquals(0,raw.clears);assertEquals(0,raw.applies);
        }
    }
    @Test public void actualAtomicDispositionDetectsRawChangesAndImmutableCopyCannotAlias()throws Exception{
        Map<String,Object> disk=new HashMap<>();disk.put("original","ciphertext");
        android.content.SharedPreferences prefs=(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(p,m,a)->{
            if(m.getName().equals("getAll"))return new HashMap<>(disk);
            if(m.getName().equals("contains"))return disk.containsKey(a[0]);throw new AssertionError("unexpected non-read operation");
        });
        AndroidProtectedWorkPreferences protectedPrefs=new AndroidProtectedWorkPreferences(prefs);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original=protectedPrefs.observeReadOnly();assertFalse(original.frozen);assertTrue(protectedPrefs.matchesReadOnly(original));
        disk.put(AndroidProtectedWorkPreferences.PROBE_KEY,"original pending ciphertext");assertFalse(protectedPrefs.matchesReadOnly(original));
        AndroidProtectedWorkPreferences.ReadOnlyObservation pending=protectedPrefs.observeReadOnly();assertTrue(pending.frozen);assertTrue(protectedPrefs.matchesReadOnly(pending));
        assertEquals(Map.of("original","ciphertext"),original.values);
        try{original.values.clear();fail();}catch(UnsupportedOperationException expected){}
    }
}
