package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.lang.reflect.Constructor;
import java.util.*;
import org.junit.Test;
/** NEW current owning vault/actual WORK guard cases. Preference delegates,
 * enrollment, keys and a reconstructed runtime are synthetic. A recreated
 * adapter is not actual Android reboot/fsync or all8/browser atomic fencing.
 * The reflection fallback runs ONLY the one old-source defect reproduction. */
public final class NativeVaultOriginalWorkAdmissionTest {
    interface Action {void run() throws Exception;}
    static void refused(Action a)throws Exception {try{a.run();fail("ordinary vault must refuse preexisting work guard");}
        catch(VaultFailure e){assertEquals(AndroidProtectedWorkPreferences.FAILURE,e.code);}}
    static final String OP="00000000-0000-4000-8000-000000000004",DEVICE="KIOSK_08";
    static final class Cipher implements CredentialCipher {
        int encrypts,decrypts,destroys; final TestCipher delegate=new TestCipher();
        Runnable afterDecrypt=()->{};final List<char[]> reads=new ArrayList<>();
        public EncryptedSecret encrypt(char[] x)throws VaultFailure{encrypts++;return delegate.encrypt(x);}
        public EncryptedSecret encryptWithExistingKey(char[] x)throws VaultFailure{encrypts++;return delegate.encryptWithExistingKey(x);}
        public char[] decrypt(EncryptedSecret x)throws VaultFailure{decrypts++;char[] r=delegate.decrypt(x);reads.add(r);afterDecrypt.run();return r;}
        public void destroyKey(){destroys++;}
        void wiped(){for(char[] x:reads)assertArrayEquals(new char[x.length],x);}
    }
    static final class Fixture {
        final AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();
        final MemoryPersistence memory=new MemoryPersistence();final Cipher cipher=new Cipher();
        final MutableClock clock=new MutableClock(1800000000000L);final TestSealGenerator seals=new TestSealGenerator();
        final FakeTransport transport=new FakeTransport(clock);int loads,legacyReads,legacyCleanups;
        final VaultPersistence persistence=new VaultPersistence(){public VaultSnapshot load()throws VaultFailure{loads++;return memory.load();}
            public void commit(long r,VaultSnapshot n)throws VaultFailure{memory.commit(r,n);}};
        final LegacyVaultSource legacy=new LegacyVaultSource(){public LegacyMaterial read(){legacyReads++;return null;}
            public void cleanup(){legacyCleanups++;} public void cleanupAfterRead(LegacyMaterial r){legacyCleanups++;}
            public boolean isClean(){return true;}};
        final AndroidOfflineAuthorityTimeStore work=new AndroidOfflineAuthorityTimeStore(raw,cipher);
        VaultEngine engine;
        Fixture(String marker)throws Exception {if(marker!=null)raw.values.put(marker,"synthetic persisted original guard");engine=bound(persistence,cipher,transport,legacy,seals,clock,work);}
        void noEffects(){assertEquals(0,loads);assertEquals(0,memory.commitAttempts.get());assertEquals(0,legacyReads);assertEquals(0,legacyCleanups);
            assertEquals(0,cipher.encrypts);assertEquals(0,cipher.decrypts);assertEquals(0,cipher.destroys);assertEquals(0,raw.commits);
            assertEquals(0,seals.calls.get());assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.confirmCalls.get());assertEquals(0,transport.cancelCalls.get());}
    }
    static VaultEngine bound(VaultPersistence p,CredentialCipher c,EnrollmentTransport t,LegacyVaultSource l,
        InstallationSealGenerator s,VaultClock k,NativeSeparationFreeze.OrdinaryVaultAdmission work)throws Exception {
        try{Constructor<VaultEngine> ctor=VaultEngine.class.getDeclaredConstructor(VaultPersistence.class,CredentialCipher.class,EnrollmentTransport.class,
            LegacyVaultSource.class,InstallationSealGenerator.class,VaultClock.class,NativeSeparationFreeze.OrdinaryVaultAdmission.class);
            return ctor.newInstance(p,c,t,l,s,k,work);
        }catch(NoSuchMethodException baselineOnly){return new VaultEngine(p,c,t,l,s,k);}
    }
    @Test public void recreatedOwnerMustHonorPersistedWorkFenceBeforeLegacyRecovery()throws Exception {
        var f=new Fixture(AndroidProtectedWorkPreferences.FENCE_KEY);var before=new HashMap<>(f.raw.values);
        refused(f.engine::getState);f.noEffects();assertEquals(before,f.raw.values);
        var recreated=new AndroidOfflineAuthorityTimeStore(f.raw,f.cipher);
        f.engine=bound(f.persistence,f.cipher,f.transport,f.legacy,f.seals,f.clock,recreated);
        refused(f.engine::getState);f.noEffects();assertEquals(before,f.raw.values);
    }
    @Test public void pendingAndMalformedMarkersDenyEnrollmentBeforeKeyOrPrimitiveAccess()throws Exception {
        for(String marker:new String[]{AndroidProtectedWorkPreferences.PROBE_KEY,AndroidProtectedWorkPreferences.FENCE_KEY})
            for(Object value:new Object[]{"unverified marker",Boolean.FALSE,42}){
                var f=new Fixture(marker);f.raw.values.put(marker,value);var before=new HashMap<>(f.raw.values);
                refused(()->f.engine.enroll(OP,DEVICE,"enrollment","12345678".toCharArray()));f.noEffects();assertEquals(before,f.raw.values);
            }
    }
    @Test public void ordinaryActivationBindingConfirmationCancellationAndResumeRefuseSameProbe()throws Exception {
        var f=new Fixture(AndroidProtectedWorkPreferences.PROBE_KEY);var before=new HashMap<>(f.raw.values);
        for(Action a:List.<Action>of(()->f.engine.activateAssignedDevice(OP,DEVICE,"12345678".toCharArray()),
            ()->f.engine.resumeEnrollment(OP),()->f.engine.completeLocalBinding(OP),()->f.engine.completeLegacyBinding(DEVICE),
            ()->f.engine.confirmEnrollment(OP),()->f.engine.cancelEnrollment(OP),
            ()->f.engine.completeLegacyAssignedActivation(OP,DEVICE,null),
            ()->f.engine.reportAssignedActivation(OP,DEVICE,OP,OP,"a".repeat(64))))refused(a);
        f.noEffects();assertEquals(before,f.raw.values);
    }
    @Test public void ordinaryRequestAndStartFinishAttestationCannotBorrowFrozenCredential()throws Exception {
        var f=new Fixture(AndroidProtectedWorkPreferences.FENCE_KEY);
        refused(()->f.engine.authorizedRequest(DEVICE,new AuthorizedRequest("/device-auth/status","GET",Map.of(),new byte[0])));
        refused(()->f.engine.requireActiveDevice(DEVICE));
        refused(()->f.engine.attestOfflineStart(DEVICE,"LOBBY",OP,OP,OP,1,OP,OP,"2026-10-11T00:00:00.000000Z",null,null));
        refused(()->f.engine.attestOfflineCompletion(DEVICE,"LOBBY",OP,OP,OP,OP,"2026-10-11T00:00:00.000000Z","2026-10-11T00:01:00.000000Z",null,null));
        f.noEffects();
    }
    @Test public void explicitReadOnlyDiagnosticIsStillReadableAndDoesNotRecoverLegacy()throws Exception {
        var f=new Fixture(AndroidProtectedWorkPreferences.FENCE_KEY);var before=new HashMap<>(f.raw.values);
        assertFalse((Boolean)f.engine.observeStateReadOnly().get("active"));
        assertEquals(1,f.loads);assertEquals(0,f.legacyReads);assertEquals(0,f.memory.commitAttempts.get());
        assertEquals(0,f.cipher.encrypts);assertEquals(0,f.cipher.destroys);assertEquals(before,f.raw.values);
    }
    @Test public void noExistingHoldKeepsOrdinaryReadBehaviorWithoutFalseFencing()throws Exception {
        var f=new Fixture(null);assertFalse((Boolean)f.engine.getState().get("active"));assertTrue(f.loads>0);assertEquals(1,f.legacyReads);
        assertEquals(0,f.memory.commitAttempts.get());assertEquals(0,f.raw.commits);assertEquals(0,f.cipher.encrypts);
    }
    @Test public void uncertainProbeCancellationDeniesVaultEvenWhenGuardVanishedInMemory()throws Exception {
        var f=new Fixture(null);var prefs=new AndroidProtectedWorkPreferences(f.raw);var original=prefs.protectedSnapshot();
        prefs.prepareProbe(original,"synthetic original same pending guard");f.raw.failNext=true;
        try{prefs.cancelProbe(original,"synthetic original same pending guard");fail("fixture must be uncertain");}catch(VaultFailure expected){}
        assertFalse(f.raw.values.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
        refused(f.engine::getState);assertEquals(0,f.loads);assertEquals(0,f.memory.commitAttempts.get());assertEquals(0,f.cipher.encrypts);
    }
    @Test public void ordinaryHttpRechecksAfterDecryptAndAfterReplyWithoutAcceptingLateResponse()throws Exception {
        for(boolean afterReply:new boolean[]{false,true}){
            var old=new NativeRetainedOwnerTest.Fixture();var raw=new AndroidProtectedWorkReadOnlyAbaTest.MemoryPreferences();var cipher=new Cipher();
            var work=new AndroidOfflineAuthorityTimeStore(raw,cipher);int[] http={0};
            var transport=(EnrollmentTransport)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{EnrollmentTransport.class},(p,m,a)->{
                if(!m.getName().equals("authorized"))throw new AssertionError("new test cannot use "+m.getName());
                http[0]++;raw.values.put(AndroidProtectedWorkPreferences.PROBE_KEY,"late same-store pending");
                return new AuthorizedResponse(200,Map.of("Content-Type","application/json"),"{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            });
            if(!afterReply)cipher.afterDecrypt=()->raw.values.put(AndroidProtectedWorkPreferences.PROBE_KEY,"pending before HTTP");
            var engine=bound(old.persistence,cipher,transport,new FakeLegacySource(),new TestSealGenerator(),old.clock,work);
            var original=old.persistence.current();int commits=old.persistence.commitAttempts.get();
            refused(()->engine.authorizedRequest(DEVICE,new AuthorizedRequest("/device-auth/status","GET",Map.of(),new byte[0])));
            assertEquals(afterReply?1:0,http[0]);assertEquals(original,old.persistence.current());assertEquals(commits,old.persistence.commitAttempts.get());
            assertEquals(0,cipher.encrypts);assertEquals(0,cipher.destroys);cipher.wiped();old.wiped();
        }
    }
    @Test public void originalTypedFrozenRecoveryStillRestoresSameSignedValuesWithoutOrdinaryAdmission()throws Exception {
        var old=new NativeRetainedOwnerTest.Fixture();var before=new HashMap<>(old.workDisk.memory);var vault=old.persistence.current();
        var engine=bound(old.persistence,old.vaultCipher,old.enrollment,new FakeLegacySource(),new TestSealGenerator(),old.clock,old.work);
        refused(engine::getState);
        var restored=NativeSeparationFreeze.restore(engine,old.work,old.principal,null);
        assertEquals(vault,old.persistence.current());assertEquals(before,old.workDisk.memory);
        assertEquals(NativeProtectedWorkSnapshot.capture(old.workDisk.memory.entrySet().stream()
            .filter(e->!e.getKey().equals(NativeRetainedWorkCapture.FENCE)).collect(java.util.stream.Collectors.toMap(Map.Entry::getKey,Map.Entry::getValue))).digest,restored.rawSnapshotDigest);
        old.wiped();
    }
}

