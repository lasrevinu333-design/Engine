package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

/** NEW read-to-cleanup boundary cases. Actual adapter source with PC-only
 * raw preferences fixtures. Reads are empty or invalid BEFORE decrypt;
 * every cleanup aborts BEFORE KeyStore. Not Android, disk, key, credential,
 * migration acceptance, durable all-writer freeze or ABA qualification. */
public final class LegacyReadBoundCleanupTest {
    public static void main(String[] args)throws Exception{
        if(args.length!=1||!args[0].equals("--legacy-work-one-use-only"))throw new AssertionError("new owning selector required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(LegacyReadBoundCleanupTest.class,"workAdmissionRefusalConsumesExactReadWitness"));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures()){
                var error=failure.getException();System.err.println("LEGACY_READ_WORK_FAILURE "+error.getClass().getName());
                for(var point:error.getStackTrace())System.err.println("LEGACY_READ_WORK_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
            }throw new AssertionError("one-use read witness");
        }System.out.println("PASS_SOURCE_HOST_LEGACY_WORK_ONE_USE");
    }
    static final String SECURE="capacitor-storage_memphis_zoo_custodial_device_credential";
    static final class Fixture {
        final Map<String,Object> v1=new HashMap<>(),secure=new HashMap<>();
        final NativeRetainedOwnerTest.WorkDisk workDisk=new NativeRetainedOwnerTest.WorkDisk();
        final AndroidProtectedWorkPreferences work=new AndroidProtectedWorkPreferences(workDisk.preferences());
        int firstEdits,secureEdits,firstCommits,secureCommits,firstReads,secureReads;
        boolean secureResult=false; // abort every reached secure commit before key access
        Runnable afterFirstRead=()->{},afterSecureRead=()->{};
        final AndroidLegacyVaultSource adapter=new AndroidLegacyVaultSource(preferences(true),preferences(false),()->0L,work);
        SharedPreferences preferences(boolean first){
            Map<String,Object> raw=first?v1:secure;
            return(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                switch(method.getName()){
                    case "getAll": {
                        Map<String,Object> copy=new HashMap<>(raw);
                        if(first){firstReads++;afterFirstRead.run();}else{secureReads++;afterSecureRead.run();}
                        return copy;
                    }
                    case "getString": return raw.getOrDefault((String)args[0],args[1]);
                    case "getBoolean": return raw.getOrDefault((String)args[0],args[1]);
                    case "contains": return raw.containsKey((String)args[0]);
                    case "edit": break;
                    default: throw new AssertionError("unexpected getter: "+method.getName());
                }
                if(first)firstEdits++;else secureEdits++;Set<String> removals=new HashSet<>();
                return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,write,values)->{
                    if(write.getName().equals("remove")){removals.add((String)values[0]);return editor;}
                    if(write.getName().equals("clear"))throw new AssertionError("namespace clear forbidden");
                    if(!write.getName().equals("commit"))throw new AssertionError("unexpected write: "+write.getName());
                    removals.forEach(raw::remove);
                    if(first){firstCommits++;return true;}secureCommits++;return secureResult;
                });
            });
        }
        void readEmpty()throws Exception{assertNull(adapter.read());}
        void cleanupDenied()throws Exception{denied(()->adapter.cleanupAfterRead(null));}
        void noEditors(){assertEquals(0,firstEdits);assertEquals(0,secureEdits);}
    }
    @Test public void workAdmissionRefusalConsumesExactReadWitness()throws Exception{
        var f=new Fixture();f.readEmpty();f.workDisk.memory.put(AndroidProtectedWorkPreferences.PROBE_KEY,"original pending hold");
        assertThrows(VaultFailure.class,()->f.adapter.cleanupAfterRead(null));f.noEditors();
        var keys=AndroidLegacyVaultSource.class.getDeclaredField("keyStore");keys.setAccessible(true);assertNull(keys.get(f.adapter));
        f.workDisk.memory.remove(AndroidProtectedWorkPreferences.PROBE_KEY); // synthetic fixture only, not a product thaw
        f.cleanupDenied();f.noEditors();assertTrue(f.v1.isEmpty());assertTrue(f.secure.isEmpty());
    }
    interface Checked {void run()throws Exception;}
    static void denied(Checked action)throws Exception{
        try{action.run();fail("cleanup/read boundary must refuse");}
        catch(VaultFailure expected){assertEquals("custodial_native_legacy_cleanup_failed",expected.code);}
    }
    @Test public void cleanupWithoutSuccessfulReadCannotMintCurrentRowsWitness()throws Exception{
        var f=new Fixture();f.v1.put("legacy_seal","SYNTHETIC_NEW");f.cleanupDenied();f.noEditors();
        assertEquals("SYNTHETIC_NEW",f.v1.get("legacy_seal"));
    }
    @Test public void knownCiphertextAppearingAfterEmptyReadSurvivesBeforeAnyEditor()throws Exception{
        var f=new Fixture();f.readEmpty();f.v1.put("credential_ciphertext","SYNTHETIC_NEW_ORIGINAL");
        f.cleanupDenied();f.noEditors();assertEquals("SYNTHETIC_NEW_ORIGINAL",f.v1.get("credential_ciphertext"));
    }
    @Test public void knownSecureAliasAppearingAfterEmptyReadIsNotRemoved()throws Exception{
        var f=new Fixture();f.readEmpty();f.secure.put(SECURE,"SYNTHETIC_NEW_ORIGINAL");
        f.cleanupDenied();f.noEditors();assertEquals("SYNTHETIC_NEW_ORIGINAL",f.secure.get(SECURE));
    }
    @Test public void twoKnownStoresChangedAfterReadAreRetainedTogether()throws Exception{
        var f=new Fixture();f.readEmpty();f.v1.put("installation_active",false);f.secure.put(SECURE,"SYNTHETIC");
        f.cleanupDenied();f.noEditors();assertEquals(Map.of("installation_active",false),f.v1);assertEquals(Map.of(SECURE,"SYNTHETIC"),f.secure);
    }
    @Test public void failedReadInvalidatesAnEarlierSuccessfulReadEvenIfRowsRevert()throws Exception{
        var f=new Fixture();f.readEmpty();f.v1.put("unknown-original",17L);denied(f.adapter::read);
        f.v1.clear(); // synthetic fixture reversion, NOT product or real data deletion
        f.cleanupDenied();f.noEditors();
    }
    @Test public void changedRowsDuringReadRecheckCannotAuthorizeLaterCleanup()throws Exception{
        var f=new Fixture();f.afterSecureRead=()->{if(f.secureReads==1)f.v1.put("legacy_seal","LATE_SYNTHETIC");};
        // The first original capture is empty, then the old owning read detects
        // a nonempty V1 without credential. Its original error is retained.
        try{f.adapter.read();fail("changed original must refuse");}
        catch(VaultFailure expected){assertEquals("custodial_native_legacy_vault_invalid",expected.code);}
        f.cleanupDenied();f.noEditors();assertEquals("LATE_SYNTHETIC",f.v1.get("legacy_seal"));
    }
    @Test public void changeAfterOwningReadBeforeCaptureReadbackRefusesWithoutRebinding()throws Exception{
        var f=new Fixture();f.afterFirstRead=()->{if(f.firstReads==2)f.v1.put("legacy_seal","AFTER_READ_SYNTHETIC");};
        denied(f.adapter::read);f.cleanupDenied();f.noEditors();assertEquals("AFTER_READ_SYNTHETIC",f.v1.get("legacy_seal"));
    }
    @Test public void failedCleanupConsumesReadWitnessSoReversionCannotReplayIt()throws Exception{
        var f=new Fixture();f.readEmpty();f.v1.put("legacy_seal","SYNTHETIC_NEW");f.cleanupDenied();
        f.v1.clear();f.cleanupDenied();f.noEditors();
    }
    @Test public void freshEmptyReadAfterFailureCanReachOnlyExistingCommitFailureBoundary()throws Exception{
        var f=new Fixture();f.readEmpty();f.v1.put("legacy_seal","SYNTHETIC_NEW");f.cleanupDenied();f.v1.clear();
        f.readEmpty();f.cleanupDenied();assertEquals(0,f.firstEdits);assertEquals(1,f.secureEdits);assertEquals(1,f.secureCommits);
        f.cleanupDenied();assertEquals(1,f.secureEdits); // one-use even when commit denied
    }
    @Test public void lateKnownRowDuringCleanupReadbackSurvivesAndStopsSecureEditor()throws Exception{
        var f=new Fixture();f.readEmpty();int boundary=f.secureReads+1;
        f.afterSecureRead=()->{if(f.secureReads==boundary)f.v1.put("legacy_seal","LATE_SYNTHETIC");};
        f.cleanupDenied();f.noEditors();assertEquals("LATE_SYNTHETIC",f.v1.get("legacy_seal"));
    }
    @Test public void unboundCleanupAlwaysRefusesEvenAfterSuccessfulEmptyRead()throws Exception{
        var f=new Fixture();f.readEmpty();denied(f.adapter::cleanup);f.noEditors();
    }
    @Test public void interveningMaterialIdentityCannotReplaceTheReadComparedByEngine()throws Exception{
        var f=new Fixture();f.readEmpty();
        try(var first=new LegacyMaterial("SYNTHETIC_A".toCharArray(),null,"");var second=new LegacyMaterial("SYNTHETIC_B".toCharArray(),null,"")){
            var identity=AndroidLegacyVaultSource.class.getDeclaredField("lastSuccessfulReadMaterial");identity.setAccessible(true);
            identity.set(f.adapter,second); // test-only competing-read identity, never decrypt
            denied(()->f.adapter.cleanupAfterRead(first));f.noEditors();
        }
    }
    @Test public void equalCredentialCloneStillCannotClaimAnotherReadIdentity()throws Exception{
        var f=new Fixture();f.readEmpty();
        try(var first=new LegacyMaterial("SYNTHETIC_A".toCharArray(),null,"");var clone=new LegacyMaterial("SYNTHETIC_A".toCharArray(),null,"")){
            var identity=AndroidLegacyVaultSource.class.getDeclaredField("lastSuccessfulReadMaterial");identity.setAccessible(true);identity.set(f.adapter,first);
            denied(()->f.adapter.cleanupAfterRead(clone));f.noEditors();
        }
    }
    @Test public void nullReadCannotClaimAnInterveningNonemptyRead()throws Exception{
        var f=new Fixture();f.readEmpty();
        try(var material=new LegacyMaterial("SYNTHETIC_A".toCharArray(),null,"")){
            var identity=AndroidLegacyVaultSource.class.getDeclaredField("lastSuccessfulReadMaterial");identity.setAccessible(true);identity.set(f.adapter,material);
            f.cleanupDenied();f.noEditors();
        }
    }
    @Test public void exactClosedReadIdentityReachesOnlyExistingCommitFailureBoundary()throws Exception{
        var f=new Fixture();f.readEmpty();var material=new LegacyMaterial("SYNTHETIC_A".toCharArray(),null,"");
        var identity=AndroidLegacyVaultSource.class.getDeclaredField("lastSuccessfulReadMaterial");identity.setAccessible(true);identity.set(f.adapter,material);
        material.close();denied(()->f.adapter.cleanupAfterRead(material));assertEquals(1,f.secureCommits);assertEquals(0,f.firstEdits);
        denied(()->f.adapter.cleanupAfterRead(material));assertEquals(1,f.secureCommits);
    }
}
