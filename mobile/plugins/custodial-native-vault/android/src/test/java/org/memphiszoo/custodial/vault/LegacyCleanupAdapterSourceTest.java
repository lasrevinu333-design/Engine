package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

/** Eight AFFECTED owning cleanup negative compositions under an explicitly PC-only
 * raw preferences fixture and synthetic SharedPreferences maps. No Android/fsync/process
 * durability, enrolled actor or actual migration/key deletion proof. A seeded
 * private original-read witness isolates these downstream cleanup guards; actual
 * read-to-cleanup binding is qualified separately by LegacyReadBoundCleanupTest.
 * This reflection is test-only, never an application/runtime caller. Each case
 * exits BEFORE store()/KeyStore access; no key provider is installed or queried.
 */
public final class LegacyCleanupAdapterSourceTest {
    public static void main(String[] args)throws Exception{
        if(args.length!=2||!args[0].equals("--legacy-work-admission-only")||!Set.of(
            "pendingAndFrozenWorkDenyLegacyCleanupBeforeEffects","bothScopedLegacyEditsAdvanceWorkBeforeEditor",
            "pendingWorkAfterFirstScopedEditStopsRemainingCleanup","durableForceFailurePreservesBothLegacyOriginals").contains(args[1]))throw new AssertionError("new owning cleanup selector required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(LegacyCleanupAdapterSourceTest.class,args[1]));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures()){
                var error=failure.getException();System.err.println("LEGACY_WORK_FAILURE "+error.getClass().getName());
                for(var point:error.getStackTrace())System.err.println("LEGACY_WORK_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
            }throw new AssertionError(args[1]);
        }System.out.println("PASS_SOURCE_HOST_LEGACY_WORK "+args[1]);
    }
    static final class Fixture {
        final Map<String,Object> v1=LegacyCleanupSnapshotGuardTest.first(),secure=LegacyCleanupSnapshotGuardTest.second();
        final NativeRetainedOwnerTest.WorkDisk workDisk=new NativeRetainedOwnerTest.WorkDisk();
        final AndroidProtectedWorkPreferences work=new AndroidProtectedWorkPreferences(workDisk.preferences());
        int firstEdits,secureEdits,firstCommits,secureCommits,clears,firstReads;
        boolean firstResult=true,secureResult=true;
        Runnable beforeRead=()->{},beforeFirstEditor=()->{},beforeSecureEditor=()->{},afterFirstCommit=()->{},afterSecureCommit=()->{};
        final AndroidLegacyVaultSource adapter=new AndroidLegacyVaultSource(preferences(true),preferences(false),()->0L,work);
        SharedPreferences preferences(boolean first){
            Map<String,Object> raw=first?v1:secure;
            return(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                if(method.getName().equals("getAll")){if(first){firstReads++;beforeRead.run();}return new HashMap<>(raw);}
                if(!method.getName().equals("edit"))throw new AssertionError("unexpected preference/key read: "+method.getName());
                if(first){beforeFirstEditor.run();firstEdits++;}else{beforeSecureEditor.run();secureEdits++;}Set<String> removals=new HashSet<>();
                return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,write,values)->{
                    if(write.getName().equals("remove")){removals.add((String)values[0]);return editor;}
                    if(write.getName().equals("clear")){clears++;throw new AssertionError("namespace clear is forbidden");}
                    if(!write.getName().equals("commit"))throw new AssertionError("unexpected write: "+write.getName());
                    removals.forEach(raw::remove);
                    if(first){firstCommits++;afterFirstCommit.run();return firstResult;}
                    secureCommits++;afterSecureCommit.run();return secureResult;
                });
            });
        }
        void seedOriginal()throws Exception{
            var witness=AndroidLegacyVaultSource.class.getDeclaredField("lastSuccessfulRead");
            witness.setAccessible(true);witness.set(adapter,LegacyCleanupSnapshotGuard.capture(
                LegacyCleanupSnapshotGuardTest.first(),LegacyCleanupSnapshotGuardTest.second()));
        }
        void noKeyAccess()throws Exception{
            var keys=AndroidLegacyVaultSource.class.getDeclaredField("keyStore");keys.setAccessible(true);assertNull(keys.get(adapter));
        }
        void refusedBeforeKeys()throws Exception{
            seedOriginal();
            LegacyCleanupSnapshotGuardTest.denied(()->adapter.cleanupAfterRead(null));assertEquals(0,clears);
            // Every fixture must retain a row or reject a commit/readback so
            // requireEmpty/commit checks abort before Java KeyStore access.
        }
    }
    @Test public void pendingAndFrozenWorkDenyLegacyCleanupBeforeEffects()throws Exception{
        for(String marker:new String[]{AndroidProtectedWorkPreferences.PROBE_KEY,AndroidProtectedWorkPreferences.FENCE_KEY}){
            var f=new Fixture();f.seedOriginal();f.workDisk.memory.put(marker,"original protected hold");
            var first=new HashMap<>(f.v1);var secure=new HashMap<>(f.secure);var work=new HashMap<>(f.workDisk.memory);
            long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            assertThrows(VaultFailure.class,()->f.adapter.cleanupAfterRead(null));
            assertEquals(0,f.firstEdits);assertEquals(0,f.secureEdits);f.noKeyAccess();
            assertEquals(first,f.v1);assertEquals(secure,f.secure);assertEquals(work,f.workDisk.memory);
            assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
        }
    }
    @Test public void bothScopedLegacyEditsAdvanceWorkBeforeEditor()throws Exception{
        var f=new Fixture();f.seedOriginal();f.secureResult=false;
        long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
        f.beforeFirstEditor=()->{assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));assertTrue(Thread.holdsLock(f.adapter));assertEquals(epoch+1,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());};
        f.beforeSecureEditor=()->assertEquals(epoch+2,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
        assertThrows(VaultFailure.class,()->f.adapter.cleanupAfterRead(null));
        assertEquals(1,f.firstEdits);assertEquals(1,f.secureEdits);assertEquals(1,f.firstCommits);assertEquals(1,f.secureCommits);assertEquals(0,f.clears);f.noKeyAccess();
    }
    @Test public void pendingWorkAfterFirstScopedEditStopsRemainingCleanup()throws Exception{
        var f=new Fixture();f.seedOriginal();var originalSecure=new HashMap<>(f.secure);
        f.afterFirstCommit=()->f.workDisk.memory.put(AndroidProtectedWorkPreferences.PROBE_KEY,"new protected pending hold");
        assertThrows(VaultFailure.class,()->f.adapter.cleanupAfterRead(null));
        assertEquals(1,f.firstCommits);assertEquals(0,f.secureEdits);assertEquals(originalSecure,f.secure);f.noKeyAccess();
        assertEquals("new protected pending hold",f.workDisk.memory.get(AndroidProtectedWorkPreferences.PROBE_KEY));
    }
    @Test public void durableForceFailurePreservesBothLegacyOriginals()throws Exception{
        try(var original=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            original.install();var f=new Fixture();f.seedOriginal();
            var first=new HashMap<>(f.v1);var secure=new HashMap<>(f.secure);int[] forced={0};
            var field=NativePrivateMutationEpochStore.class.getDeclaredField("io");field.setAccessible(true);Object normal=field.get(original.journal);
            field.set(original.journal,Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
                if(method.getName().equals("forceFile")){forced[0]++;throw new java.io.IOException("synthetic counter force unknown");}
                method.setAccessible(true);try{return method.invoke(normal,args);}catch(java.lang.reflect.InvocationTargetException failure){throw failure.getCause();}
            }));
            assertThrows(VaultFailure.class,()->f.adapter.cleanupAfterRead(null));assertEquals(1,forced[0]);
            assertEquals(0,f.firstEdits);assertEquals(0,f.secureEdits);assertEquals(first,f.v1);assertEquals(secure,f.secure);f.noKeyAccess();
            var pending=original.dir.resolve(NativePrivateMutationEpochStore.PENDING);assertTrue(java.nio.file.Files.exists(pending));byte[] retained=java.nio.file.Files.readAllBytes(pending);
            assertThrows(VaultFailure.class,original.journal::readCurrent);assertArrayEquals(retained,java.nio.file.Files.readAllBytes(pending));
        }
    }
    @Test public void originalUnknownV1StopsOwningAdapterBeforeAnyEditor()throws Exception{
        var f=new Fixture();f.v1.put("unknown-protected-original",23L);Map<String,Object> first=new HashMap<>(f.v1),second=new HashMap<>(f.secure);
        f.refusedBeforeKeys();assertEquals(0,f.firstEdits);assertEquals(0,f.secureEdits);assertEquals(first,f.v1);assertEquals(second,f.secure);
    }
    @Test public void originalUnknownSecureStopsOwningAdapterBeforeFirstPartyMutation()throws Exception{
        var f=new Fixture();f.secure.put("unknown-other-plugin","SYNTHETIC");Map<String,Object> first=new HashMap<>(f.v1),second=new HashMap<>(f.secure);
        f.refusedBeforeKeys();assertEquals(0,f.firstEdits);assertEquals(0,f.secureEdits);assertEquals(first,f.v1);assertEquals(second,f.secure);
    }
    @Test public void lateUnknownBeforeOriginalRecheckStopsBeforeEditors()throws Exception{
        var f=new Fixture();f.beforeRead=()->{if(f.firstReads==1)f.v1.put("late-original",17L);};
        f.refusedBeforeKeys();assertEquals(0,f.firstEdits);assertEquals(0,f.secureEdits);assertEquals(17L,f.v1.get("late-original"));
    }
    @Test public void lateUnknownInsideFirstCommitSurvivesScopedRemovalAndStopsSecureEdit()throws Exception{
        var f=new Fixture();f.afterFirstCommit=()->f.v1.put("late-protected-original",31L);
        f.refusedBeforeKeys();assertEquals(1,f.firstCommits);assertEquals(0,f.secureEdits);
        assertEquals(Map.of("late-protected-original",31L),f.v1);assertEquals(LegacyCleanupSnapshotGuardTest.second(),f.secure);
    }
    @Test public void changedSecureKnownValueAfterFirstRemovalIsNotRemovedOrRebound()throws Exception{
        var f=new Fixture();f.afterFirstCommit=()->f.secure.put(LegacyCleanupSnapshotGuardTest.ALIAS,"CHANGED_SYNTHETIC_ORIGINAL");
        f.refusedBeforeKeys();assertEquals(0,f.secureEdits);assertEquals("CHANGED_SYNTHETIC_ORIGINAL",f.secure.get(LegacyCleanupSnapshotGuardTest.ALIAS));
    }
    @Test public void rejectedFirstCommitDoesNotProceedToSecureOrKeyStage()throws Exception{
        var f=new Fixture();f.firstResult=false;f.refusedBeforeKeys();assertEquals(1,f.firstCommits);assertEquals(0,f.secureEdits);
        assertEquals(LegacyCleanupSnapshotGuardTest.second(),f.secure);
    }
    @Test public void rejectedSecureCommitAbortsBeforeKeyAccess()throws Exception{
        var f=new Fixture();f.secureResult=false;f.refusedBeforeKeys();assertEquals(1,f.firstCommits);assertEquals(1,f.secureCommits);
    }
    @Test public void lateUnknownAfterSecureCommitSurvivesAndStopsBeforeKeyAccess()throws Exception{
        var f=new Fixture();f.afterSecureCommit=()->f.secure.put("late-other-original","SYNTHETIC_KEPT");
        f.refusedBeforeKeys();assertEquals(1,f.secureCommits);assertEquals(Map.of("late-other-original","SYNTHETIC_KEPT"),f.secure);
    }
}
