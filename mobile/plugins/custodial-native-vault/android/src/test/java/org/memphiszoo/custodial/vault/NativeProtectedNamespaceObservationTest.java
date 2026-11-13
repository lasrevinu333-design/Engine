package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;
import static org.junit.Assert.*;

/** New synthetic read-only namespace cases only; no Android process/store/key
 * execution or semantic/finalizer acceptance is represented by these tests. */
public final class NativeProtectedNamespaceObservationTest {
    public static void main(String[] args)throws Exception{
        if(args.length==2&&args[0].equals("--ordinary-namespace-retirement-only")){
            if(!Set.of("ORDINARY_RETIRE_rawMismatchCannotRevive",
                "ORDINARY_RETIRE_epochMismatchCannotRevive",
                "ORDINARY_RETIRE_readFailuresRetireAndPreserveFirstFailure").contains(args[1]))
                throw new AssertionError("new ordinary retirement member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedNamespaceObservationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_ORDINARY_NAMESPACE_RETIREMENT "+args[1]+"; synthetic read ports only, no durable all-writer/Android/ACK");return;
        }
        if(args.length==2&&args[0].equals("--fixed-family-read-boundary-only")){
            if(!Set.of("FIXED_READ_sameOriginalAllEightRemainUnchanged",
                "FIXED_READ_durableSameBytesDuringReadRefuses",
                "FIXED_READ_copyAttemptRefusesDespiteRestoredBytes",
                "FIXED_READ_sameBytesMetadataReplacementInsideReadRefuses",
                "FIXED_READ_genericAndMixedCallbacksKeepPreReadFence").contains(args[1]))
                throw new AssertionError("new fixed-family read member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedNamespaceObservationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_FIXED_FAMILY_READ "+args[1]+"; synthetic source/host metadata only, no durable freeze/Android/ACK");return;
        }
        if(args.length==2&&args[0].equals("--held-original-namespace-refusal-only")){
            if(!Set.of("HELD_NAMESPACE_nullAndAbsentNeverOpenOrProvision",
                "HELD_NAMESPACE_onlyExactFixedFamilyCanUseTypedPath",
                "HELD_NAMESPACE_v1AndPendingNeverBecomeOriginalHeld",
                "HELD_NAMESPACE_ordinaryGenericHeldStampStillRefuses").contains(args[1]))
                throw new AssertionError("new held namespace refusal member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedNamespaceObservationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_HELD_NAMESPACE_REFUSAL "+args[1]+"; no fabricated HELD/lease; positive/lifecycle/Android/ACK not qualified");return;
        }
        if(args.length==2&&args[0].equals("--fixed-owner-stamp-only")){
            if(!Set.of("FIXED_OWNER_STAMP_actualJournalAndSourceBoundaries",
                "FIXED_OWNER_STAMP_sameBytesMetadataReplacementStillRefuses",
                "FIXED_OWNER_STAMP_genericAndMixedFamiliesKeepAgreement").contains(args[1]))
                throw new AssertionError("new fixed owner stamp member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedNamespaceObservationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_FIXED_OWNER_STAMP "+args[1]+"; synthetic preferences/owner, real epoch metadata; no hold/all-writer/Android/ACK proof");return;
        }
        if(args.length==2&&args[0].equals("--durable-reader-only")){
            if(!Set.of("DURABLE_READER_installInvalidatesActualCapturedStamp",
                "DURABLE_READER_mixedOverflowAndChangedStampRefuse",
                "DURABLE_READER_actualCommitDuringReadRefusesCapture").contains(args[1]))throw new AssertionError("explicit new durable reader selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedNamespaceObservationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("DURABLE_READER_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("DURABLE_READER_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_DURABLE_READER "+args[1]);return;
        }
        if(args.length==1&&"--guarded-copy-epoch-only".equals(args[0])){
            new NativeProtectedNamespaceObservationTest().guardedEpochChangeDuringRawCopyIsRefused();
            System.out.println("NEW1 guarded raw-copy epoch case PASS; synthetic preferences only");return;
        }
        if(args.length==1&&"--guarded-epoch-only".equals(args[0])){
            var t=new NativeProtectedNamespaceObservationTest();
            t.guardedAndroidUnchangedUsesFixedCoordinatorAndReadStamp();
            t.guardedAndroidFalseAndThrowByteAbaInvalidatesOriginal();
            t.guardedLateReaderWriteAttemptRefusesCaptureAndRecheck();
            t.guardedMixedWrongAndChangingCoordinatorRefused();
            t.guardedInconsistentAndNegativeEpochRefused();
            t.guardedUnavailableReadPreservesOriginalFailure();
            t.guardedCurrentnessDoesNotAcquireObserverMonitor();
            System.out.println("NEW7 guarded all8 process-epoch cases PASS; synthetic preferences, no durable freeze/Android/ACK authority");return;
        }
        if(args.length!=1||!"--completion-cell-capacity-only".equals(args[0]))throw new IllegalArgumentException("focused selector required");
        new NativeProtectedNamespaceObservationTest().completionCiphertextCapacityRemainsLosslessAcrossBothCaptures();
        System.out.println("NEW owning completion cell capacity PASS; raw observation/retention only, not separation admission");
    }
    @Test public void ORDINARY_RETIRE_rawMismatchCannotRevive()throws Exception{
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            Fixture f=new Fixture();f.rows.get(name).put("original-unknown","opaque original");
            try(var observed=f.observe()){
                f.rows.get(name).put("original-unknown","changed observed bytes");assertFalse(observed.stillCurrent());
                f.rows.get(name).put("original-unknown","opaque original");
                int reads=f.calls.values().stream().mapToInt(AtomicInteger::get).sum();
                denied(observed::stillCurrent);denied(observed::originalMutationStampForOwningOperation);
                assertEquals(reads,f.calls.values().stream().mapToInt(AtomicInteger::get).sum());
                assertEquals("opaque original",f.rows.get(name).get("original-unknown"));noAuthority(observed);
            }
        }
    }
    @Test public void ORDINARY_RETIRE_epochMismatchCannotRevive()throws Exception{
        EpochFixture f=new EpochFixture();f.rows.get(WORK).put("original","retained bytes");
        try(var observed=f.observe()){
            f.epoch=1;assertFalse(observed.stillCurrent());
            f.epoch=0; // Synthetic source rewind only; never a real epoch reset.
            int reads=f.calls.values().stream().mapToInt(AtomicInteger::get).sum();
            denied(observed::stillCurrent);assertEquals(reads,f.calls.values().stream().mapToInt(AtomicInteger::get).sum());
            assertEquals("retained bytes",f.rows.get(WORK).get("original"));noAuthority(observed);
        }
    }
    @Test public void ORDINARY_RETIRE_readFailuresRetireAndPreserveFirstFailure()throws Exception{
        for(int kind=0;kind<3;kind++){
            Fixture f=new Fixture();AtomicInteger fail=new AtomicInteger(-1);int selected=kind;
            f.stores.put(BATCH,()->{
                if(fail.get()==0){
                    if(selected==0)throw new VaultFailure("original-private-reader-refusal");
                    if(selected==1)throw new IllegalStateException("original-private-runtime-refusal");
                    throw new AssertionError("original-private-error-refusal");
                }
                f.calls.get(BATCH).incrementAndGet();return f.rows.get(BATCH);
            });
            try(var observed=f.observe()){
                fail.set(0);
                if(kind==0)assertEquals("original-private-reader-refusal",assertThrows(VaultFailure.class,observed::stillCurrent).code);
                // Existing read() intentionally wraps RuntimeException as the
                // fixed unknown code. Retire without changing that contract.
                else if(kind==1)assertEquals(NativeProtectedNamespaceObservation.FAILURE,assertThrows(VaultFailure.class,observed::stillCurrent).code);
                else assertThrows(AssertionError.class,observed::stillCurrent);
                fail.set(-1);int reads=f.calls.values().stream().mapToInt(AtomicInteger::get).sum();
                denied(observed::stillCurrent);assertEquals(reads,f.calls.values().stream().mapToInt(AtomicInteger::get).sum());noAuthority(observed);
            }
        }
    }
    @Test public void FIXED_READ_sameOriginalAllEightRemainUnchanged()throws Exception{
        Fixture f=new Fixture();for(String name:f.rows.keySet())f.rows.get(name).put("original-unknown","opaque-"+name+"\ud800");
        var original=new java.util.TreeMap<String,Map<String,Object>>();
        for(String name:f.rows.keySet())original.put(name,new HashMap<>(f.rows.get(name)));
        var readers=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        synchronized(AndroidProtectedWorkPreferences.retainedCommitLock()){
            assertTrue(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(readers,AndroidProtectedWorkPreferences.retainedCommitLock()));
        }
        try(var fixed=NativeProtectedNamespaceObservation.observe(readers)){
            assertEquals(8,fixed.recordCount);assertEquals(8,fixed.recordCounts.size());noAuthority(fixed);
            for(String name:f.rows.keySet()){assertEquals(Integer.valueOf(1),fixed.recordCounts.get(name));assertEquals(3,f.calls.get(name).get());}
            try(var generic=f.observe()){assertEquals(generic.digest,fixed.digest);assertEquals(generic.recordCounts,fixed.recordCounts);}
            assertTrue(fixed.stillCurrent());noAuthority(fixed);
            for(String name:f.rows.keySet())assertEquals(7,f.calls.get(name).get());
        }
        assertEquals(original,f.rows);
    }
    @Test public void FIXED_READ_durableSameBytesDuringReadRefuses()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=x.raw();assertEquals(0,x.counter());AtomicInteger changes=new AtomicInteger();
            x.onRead=name->{if(name.equals(BATCH)&&changes.getAndIncrement()==0){
                assertTrue(Thread.holdsLock(x.engine));assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));
                try{x.reaffirm();}catch(Exception failure){throw new AssertionError(failure);}
            }};
            synchronized(x.engine){denied(()->NativeProtectedNamespaceObservation.observe(x.readers));}
            assertTrue(changes.get()>0);assertEquals(2,x.counter());assertEquals(original,x.raw());
        }
    }
    @Test public void FIXED_READ_copyAttemptRefusesDespiteRestoredBytes()throws Exception{
        Fixture f=new Fixture();f.rows.get(BATCH).put("original","unchanged original");
        var before=new HashMap<>(f.rows.get(WORK));var preferences=epochPreferences(f,1);
        long originalEpoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();AtomicInteger copied=new AtomicInteger();
        preferences.put(BATCH,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            assertEquals("getAll",method.getName());f.calls.get(BATCH).incrementAndGet();
            return new HashMap<String,Object>(f.rows.get(BATCH)){
                @Override public Set<Map.Entry<String,Object>> entrySet(){
                    if(copied.getAndIncrement()==0){
                        assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));
                        assertFalse(new AndroidProtectedWorkPreferences(preferences.get(WORK)).edit().putString("transient","attempt").commit());
                        f.rows.get(WORK).clear();f.rows.get(WORK).putAll(before);
                    }
                    return super.entrySet();
                }
            };
        }));
        var readers=AndroidProtectedNamespaceReaders.bind(preferences);
        denied(()->NativeProtectedNamespaceObservation.observe(readers));
        assertTrue(copied.get()>0);assertTrue(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>originalEpoch);
        assertEquals(before,f.rows.get(WORK));assertEquals("unchanged original",f.rows.get(BATCH).get("original"));
    }
    @Test public void FIXED_READ_sameBytesMetadataReplacementInsideReadRefuses()throws Exception{
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=x.raw();var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] bytes=java.nio.file.Files.readAllBytes(file);var held=x.root.resolve("fixed-read-original-current");
            var replacement=x.root.resolve("fixed-read-replacement-current");AtomicInteger replacements=new AtomicInteger();
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                assertTrue(observed.stillCurrent());noAuthority(observed);
                x.onRead=name->{if(name.equals(BATCH)&&replacements.getAndIncrement()==0)try{
                    assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));
                    java.nio.file.Files.createLink(held,file);java.nio.file.Files.copy(file,replacement);
                    java.nio.file.Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                    java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                    java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }catch(Exception failure){throw new AssertionError(failure);}};
                assertThrows(VaultFailure.class,observed::stillCurrent);assertTrue(replacements.get()>0);
                assertNotEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(file));
                x.onRead=name->{};
                java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(file));
                assertThrows(VaultFailure.class,observed::stillCurrent);assertEquals(original,x.raw());noAuthority(observed);
            }finally{
                x.onRead=name->{};
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void FIXED_READ_genericAndMixedCallbacksKeepPreReadFence()throws Exception{
        for(boolean mixed:new boolean[]{false,true}){
            Fixture f=new Fixture();var preferences=epochPreferences(f,1);
            Map<String,NativeProtectedNamespaceObservation.Store> readers=new HashMap<>(AndroidProtectedNamespaceReaders.bind(preferences));
            Object lock=AndroidProtectedWorkPreferences.retainedCommitLock();AtomicInteger postReadStamps=new AtomicInteger(),changes=new AtomicInteger();
            AtomicInteger readsAtWithdrawal=new AtomicInteger(-1),readsAfterWriterChecks=new AtomicInteger(-1);
            java.util.concurrent.atomic.AtomicBoolean arm=new java.util.concurrent.atomic.AtomicBoolean();
            var original=new HashMap<>(f.rows.get(WORK));
            for(String name:f.rows.keySet()){
                if(mixed&&!name.equals(BATCH))continue;
                readers.put(name,new NativeProtectedNamespaceObservation.GuardedStore(){
                    public Object commitCoordinator(){return lock;}
                    public long mutationEpochForReadOnlyCapture(){
                        assertTrue(Thread.holdsLock(lock));
                        if(arm.compareAndSet(true,false)){
                            readsAtWithdrawal.set(f.calls.values().stream().mapToInt(AtomicInteger::get).sum());
                            assertFalse(new AndroidProtectedWorkPreferences(preferences.get(WORK)).edit().putString("transient","attempt").commit());
                            f.rows.get(WORK).clear();f.rows.get(WORK).putAll(original);changes.incrementAndGet();
                            // The real editor performs its own getAll checks.
                            // Account for them, then forbid ANY following read.
                            readsAfterWriterChecks.set(f.calls.values().stream().mapToInt(AtomicInteger::get).sum());
                        }
                        return AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
                    }
                    public String durableMutationStampForReadOnlyCapture()throws VaultFailure{
                        assertTrue(Thread.holdsLock(lock));
                        int reads=f.calls.values().stream().mapToInt(AtomicInteger::get).sum();
                        if(name.equals(BATCH)&&reads==1&&postReadStamps.incrementAndGet()==2)arm.set(true);
                        return AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture();
                    }
                    public Map<String,?> readAll(){assertTrue(Thread.holdsLock(lock));f.calls.get(name).incrementAndGet();return new HashMap<>(f.rows.get(name));}
                });
            }
            synchronized(lock){assertFalse(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(readers,lock));}
            denied(()->NativeProtectedNamespaceObservation.observe(readers));
            assertEquals(1,changes.get());assertEquals(1,readsAtWithdrawal.get());
            assertTrue(readsAfterWriterChecks.get()>readsAtWithdrawal.get());
            assertEquals(readsAfterWriterChecks.get(),f.calls.values().stream().mapToInt(AtomicInteger::get).sum());
            assertEquals(original,f.rows.get(WORK));for(var row:f.rows.values())assertTrue(row.isEmpty());
        }
    }
    @Test public void DURABLE_READER_installInvalidatesActualCapturedStamp()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            assertTrue(x.namespaces.stillCurrent());var original=x.raw();x.install();
            assertFalse(x.namespaces.stillCurrent());noAuthority(x.namespaces);
            try(var fresh=NativeProtectedNamespaceObservation.observe(x.readers)){
                assertTrue(fresh.stillCurrent());noAuthority(fresh);assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            }
            assertEquals(original,x.raw());assertEquals(0,x.counter());
        }
    }
    @Test public void DURABLE_READER_mixedOverflowAndChangedStampRefuse()throws Exception {
        for(String mode:new String[]{"mixed","overflow","malformed","changing"}){
            Fixture source=new Fixture();Object coordinator=new Object();long[] stamp={0};
            String first=NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet().iterator().next();
            for(String name:source.rows.keySet())source.stores.put(name,new NativeProtectedNamespaceObservation.GuardedStore(){
                public Object commitCoordinator(){return coordinator;}
                public long mutationEpochForReadOnlyCapture(){assertTrue(Thread.holdsLock(coordinator));return 0;}
                public String durableMutationStampForReadOnlyCapture(){
                    assertTrue(Thread.holdsLock(coordinator));
                    if(mode.equals("mixed")&&name.equals(first))return "PROCESS_ONLY";
                    if(mode.equals("overflow"))return "DURABLE_ATTEMPT:9223372036854775808";
                    if(mode.equals("malformed"))return "DURABLE_ATTEMPT:00";
                    return "DURABLE_ATTEMPT:"+stamp[0];
                }
                public Map<String,?> readAll(){assertTrue(Thread.holdsLock(coordinator));if(mode.equals("changing"))stamp[0]=1;return source.rows.get(name);}
            });
            denied(source::observe);for(var row:source.rows.values())assertTrue(row.isEmpty());
        }
    }
    @Test public void DURABLE_READER_actualCommitDuringReadRefusesCapture()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var raw=x.raw();AtomicInteger effects=new AtomicInteger();
            String last=NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet().stream().reduce((a,b)->b).get();
            x.onRead=name->{if(name.equals(last)&&effects.getAndIncrement()==0){
                assertTrue(Thread.holdsLock(x.engine));assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));
                try{x.reaffirm();}catch(Exception error){throw new AssertionError(error);}
            }};
            synchronized(x.engine){denied(()->NativeProtectedNamespaceObservation.observe(x.readers));}
            assertTrue(effects.get()>0);assertEquals(2,x.counter());assertEquals(raw,x.raw());
        }
    }
    // One invocation of the existing private observation path, not an injected
    // stamp/provider or manufactured capability. Generic calls are counted in
    // their existing test GuardedStore implementation only.
    private static String fixedOwnerStampOnce(Map<String,NativeProtectedNamespaceObservation.Store> stores,Object coordinator)throws Exception {
        var method=NativeProtectedNamespaceObservation.class.getDeclaredMethod("readDurableStamp",Map.class,Object.class);
        method.setAccessible(true);synchronized(coordinator){
            try{return(String)method.invoke(null,stores,coordinator);}
            catch(java.lang.reflect.InvocationTargetException failure){
                if(failure.getCause() instanceof Exception)throw(Exception)failure.getCause();throw(Error)failure.getCause();
            }
        }
    }
    @Test public void FIXED_OWNER_STAMP_actualJournalAndSourceBoundaries()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=x.raw();Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
            byte[] metadata=java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT));
            Object inode=java.nio.file.Files.readAttributes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),
                java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
            synchronized(coordinator){assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(x.readers,coordinator));}
            assertEquals("DURABLE_ATTEMPT:0",fixedOwnerStampOnce(x.readers,coordinator));
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                noAuthority(observed);assertTrue(observed.stillCurrent());
                var backing=x.source.x.f.batch.root.memory;String key="fixed-owner-extra-retained-row";
                assertSame(backing,x.source.x.raw(BATCH));
                assertFalse(backing.containsKey(key));backing.put(key,"synthetic retained unknown bytes");
                try{assertFalse(observed.stillCurrent());}finally{backing.remove(key);}
                // A fixed-family stamp never replaces any actual namespace
                // read, its source exception, or post-read/copy revalidation.
                AtomicInteger withdrawals=new AtomicInteger();
                x.onRead=name->{if(name.equals(BATCH)){withdrawals.incrementAndGet();throw new IllegalStateException("synthetic source withdrawn");}};
                try{assertThrows(VaultFailure.class,observed::stillCurrent);assertTrue(withdrawals.get()>0);}
                finally{x.onRead=name->{};}
                noAuthority(observed);
                assertArrayEquals(metadata,java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                assertEquals(inode,java.nio.file.Files.readAttributes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),
                    java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }finally{java.util.Arrays.fill(metadata,(byte)0);}
            assertEquals(original,x.raw());assertEquals(0,x.counter());
        }
    }
    @Test public void FIXED_OWNER_STAMP_sameBytesMetadataReplacementStillRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var original=x.raw();Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] bytes=java.nio.file.Files.readAllBytes(file);var held=x.root.resolve("fixed-owner-genuine-current");
            var replacement=x.root.resolve("fixed-owner-replacement-current");
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                assertEquals("DURABLE_ATTEMPT:0",fixedOwnerStampOnce(x.readers,coordinator));
                java.nio.file.Files.createLink(held,file);java.nio.file.Files.copy(file,replacement);
                java.nio.file.Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                java.nio.file.Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertNotEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(file));
                assertThrows(VaultFailure.class,()->fixedOwnerStampOnce(x.readers,coordinator));
                assertThrows(VaultFailure.class,observed::stillCurrent);
                java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(file));
                // The rejected real journal Current was revoked, not cached or
                // silently refreshed by the fixed-family optimization.
                assertThrows(VaultFailure.class,()->fixedOwnerStampOnce(x.readers,coordinator));
                assertThrows(VaultFailure.class,observed::stillCurrent);noAuthority(observed);
                assertEquals(original,x.raw());
            }finally{
                if(java.nio.file.Files.exists(held))java.nio.file.Files.move(held,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                java.util.Arrays.fill(bytes,(byte)0);
            }
        }
    }
    @Test public void FIXED_OWNER_STAMP_genericAndMixedFamiliesKeepAgreement()throws Exception {
        Fixture f=new Fixture();Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
        var first=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        var second=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        synchronized(coordinator){assertEquals("PROCESS_ONLY",AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(first,coordinator));}
        var mixed=new HashMap<>(first);mixed.put(BATCH,second.get(BATCH));
        synchronized(coordinator){assertNull(AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(mixed,coordinator));}
        assertEquals("PROCESS_ONLY",fixedOwnerStampOnce(mixed,coordinator));
        var swapped=new HashMap<>(first);swapped.put(WORK,first.get(BATCH));swapped.put(BATCH,first.get(WORK));
        synchronized(coordinator){assertNull(AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(swapped,coordinator));}
        AtomicInteger calls=new AtomicInteger();String[] foreign={"PROCESS_ONLY"};
        for(String name:f.rows.keySet())f.stores.put(name,new NativeProtectedNamespaceObservation.GuardedStore(){
            public Object commitCoordinator(){return coordinator;}
            public long mutationEpochForReadOnlyCapture(){return AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();}
            public String durableMutationStampForReadOnlyCapture(){calls.incrementAndGet();return name.equals(BATCH)?foreign[0]:"PROCESS_ONLY";}
            public Map<String,?> readAll(){return f.rows.get(name);}
        });
        synchronized(coordinator){assertNull(AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(f.stores,coordinator));}
        assertEquals("PROCESS_ONLY",fixedOwnerStampOnce(f.stores,coordinator));assertEquals(8,calls.get());
        foreign[0]="DURABLE_ATTEMPT:1";assertThrows(VaultFailure.class,()->fixedOwnerStampOnce(f.stores,coordinator));
        foreign[0]="DURABLE_ATTEMPT:9223372036854775808";assertThrows(VaultFailure.class,()->fixedOwnerStampOnce(f.stores,coordinator));
        var claimed=new HashMap<>(first);claimed.put(BATCH,f.stores.get(BATCH));
        synchronized(coordinator){assertNull(AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(claimed,coordinator));}
        assertThrows(VaultFailure.class,()->fixedOwnerStampOnce(claimed,coordinator));
        for(var rows:f.rows.values())assertTrue(rows.isEmpty());
    }
    @Test public void HELD_NAMESPACE_nullAndAbsentNeverOpenOrProvision()throws Exception {
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        Fixture f=new Fixture();long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
        denied(()->NativeProtectedNamespaceObservation.observeHeldOriginal(null,null));
        denied(()->NativeProtectedNamespaceObservation.observeHeldOriginal(f.stores,null));
        var fixed=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        denied(()->NativeProtectedNamespaceObservation.observeHeldOriginal(fixed,null));
        assertThrows(VaultFailure.class,()->NativeProtectedNamespaceObservation.observeHeldOriginal(fixed,
            AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()));
        for(var calls:f.calls.values())assertEquals(0,calls.get());
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
        assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        try(var ordinary=f.observe()){
            assertTrue(ordinary.stillCurrent());assertFalse(ordinary.heldOriginalReconstructionOnly());noAuthority(ordinary);
        }
    }
    @Test public void HELD_NAMESPACE_onlyExactFixedFamilyCanUseTypedPath()throws Exception {
        Fixture f=new Fixture();Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
        var first=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        var second=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        var mixed=new HashMap<>(first);mixed.put(BATCH,second.get(BATCH));
        var swapped=new HashMap<>(first);swapped.put(WORK,first.get(BATCH));swapped.put(BATCH,first.get(WORK));
        var generic=new HashMap<String,NativeProtectedNamespaceObservation.Store>();AtomicInteger effects=new AtomicInteger();
        for(String name:f.rows.keySet())generic.put(name,new NativeProtectedNamespaceObservation.GuardedStore(){
            public Object commitCoordinator(){effects.incrementAndGet();return coordinator;}
            public long mutationEpochForReadOnlyCapture(){effects.incrementAndGet();return 0;}
            public String durableMutationStampForReadOnlyCapture(){effects.incrementAndGet();return "DURABLE_HELD:1";}
            public Map<String,?> readAll(){effects.incrementAndGet();return f.rows.get(name);}
        });
        var claimed=new HashMap<>(first);claimed.put(BATCH,generic.get(BATCH));
        synchronized(coordinator){
            assertTrue(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(first,coordinator));
            assertTrue(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(second,coordinator));
            assertFalse(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(first,new Object()));
            for(var foreign:java.util.List.of(mixed,swapped,generic,claimed))
                assertFalse(AndroidProtectedNamespaceReaders.isFixedOwnerFamily(foreign,coordinator));
        }
        // Identity predicate only. A valid HELD lease cannot be fabricated to
        // claim execution of the positive or foreign-family held observation.
        assertEquals(0,effects.get());for(var calls:f.calls.values())assertEquals(0,calls.get());
    }
    @Test public void HELD_NAMESPACE_v1AndPendingNeverBecomeOriginalHeld()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var raw=x.raw();long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            byte[] bytes=java.nio.file.Files.readAllBytes(file);
            Object inode=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
            try(var current=x.journal.readCurrent()){
                assertNull(current.heldOriginal());assertEquals(0,current.counter());
                assertThrows(VaultFailure.class,()->NativeProtectedNamespaceObservation.observeHeldOriginal(x.readers,
                    AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()));
                x.journal.requireCurrent(current);
                try(var pending=x.journal.prepareNext(current)){
                    var candidate=x.dir.resolve(NativePrivateMutationEpochStore.PENDING);
                    byte[] pendingBytes=java.nio.file.Files.readAllBytes(candidate);
                    Object pendingInode=java.nio.file.Files.readAttributes(candidate,java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
                    try{
                        assertThrows(VaultFailure.class,()->NativeProtectedNamespaceObservation.observeHeldOriginal(x.readers,
                            AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()));
                        assertArrayEquals(pendingBytes,java.nio.file.Files.readAllBytes(candidate));
                        assertEquals(pendingInode,java.nio.file.Files.readAttributes(candidate,java.nio.file.attribute.BasicFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                        assertEquals(1,pending.nextCounter());assertEquals(0,current.counter());
                    }finally{java.util.Arrays.fill(pendingBytes,(byte)0);}
                }
                assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(file));
                assertEquals(inode,java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());assertEquals(raw,x.raw());
            }finally{java.util.Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void HELD_NAMESPACE_ordinaryGenericHeldStampStillRefuses()throws Exception {
        for(String claimed:new String[]{"DURABLE_HELD:1","DURABLE_HELD:0","DURABLE_HELD:9223372036854775808"}){
            Fixture f=new Fixture();Object coordinator=new Object();AtomicInteger rawReads=new AtomicInteger();
            for(String name:f.rows.keySet())f.stores.put(name,new NativeProtectedNamespaceObservation.GuardedStore(){
                public Object commitCoordinator(){return coordinator;}
                public long mutationEpochForReadOnlyCapture(){return 0;}
                public String durableMutationStampForReadOnlyCapture(){return claimed;}
                public Map<String,?> readAll(){rawReads.incrementAndGet();return f.rows.get(name);}
            });
            denied(f::observe);assertEquals(0,rawReads.get());for(var rows:f.rows.values())assertTrue(rows.isEmpty());
        }
    }
    static final String BATCH="MemphisZooCustodialRetainedBatchV1";
    static final String WORK="MemphisZooCustodialOfflineAuthorityTimeV1";
    static final class Fixture {
        final Map<String,Map<String,Object>> rows=new HashMap<>();
        final Map<String,NativeProtectedNamespaceObservation.Store> stores=new HashMap<>();
        final Map<String,AtomicInteger> calls=new HashMap<>();
        Fixture(){for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            rows.put(name,new HashMap<>());calls.put(name,new AtomicInteger());
            stores.put(name,()->{calls.get(name).incrementAndGet();return rows.get(name);});
        }}
        NativeProtectedNamespaceObservation observe() throws VaultFailure{return NativeProtectedNamespaceObservation.observe(stores);}
    }
    interface Action{void run() throws Exception;}
    static void denied(Action action) throws Exception {
        try{action.run();fail("Missing/malformed/mutated input became an observation");}
        catch(VaultFailure expected){assertEquals(NativeProtectedNamespaceObservation.FAILURE,expected.code);}
    }
    static void noAuthority(NativeProtectedNamespaceObservation value){
        assertEquals("UNKNOWN",value.semanticInventoryState);assertEquals("UNKNOWN",value.browserInventoryState);
        assertFalse(value.frozen);assertFalse(value.accepted);assertFalse(value.inventoryAcknowledged);
        assertFalse(value.keyRemovalAllowed);assertFalse(value.phoneReleased);
    }
    @Test public void completionCiphertextCapacityRemainsLosslessAcrossBothCaptures()throws Exception{
        String key="authenticated_completion_receipt_sha256:"+"a".repeat(64);
        String original="x".repeat(2*1024*1024)+"\ud800";
        Fixture f=new Fixture();f.rows.get(WORK).put(key,original);
        NativeProtectedWorkSnapshot work=NativeProtectedWorkSnapshot.capture(f.rows.get(WORK));assertEquals(1,work.recordCount);
        try(var observed=f.observe();var values=NativeRetainedNamespaceValues.capture(new HashMap<>(f.rows),observed.digest)){
            noAuthority(observed);assertEquals(1,values.recordCount);assertTrue(values.byteCount>original.length()*2);
            assertTrue(values.matchesOriginal(new HashMap<>(f.rows),observed.digest));
            f.rows.get(WORK).put(key,original+"changed");assertFalse(observed.stillCurrent());
            assertFalse(values.matchesOriginal(new HashMap<>(f.rows),observed.digest));
        }
        Fixture other=new Fixture();other.rows.get(BATCH).put(key,original);denied(other::observe);
        other=new Fixture();other.rows.get(WORK).put("unrelated",original);denied(other::observe);
        Fixture tooLarge=new Fixture();tooLarge.rows.get(WORK).put(key,"x".repeat(4*1024*1024+1));denied(tooLarge::observe);
        assertEquals(original+"changed",f.rows.get(WORK).put(key,original)); // restore test fixture only
        assertEquals(original,f.rows.get(WORK).get(key));
    }
    @Test public void fixedEightStoresIncludeAllFiveSharedKeyUsers() throws Exception {
        assertEquals(8,NativeProtectedNamespaceObservation.KEY_FAMILIES.size());
        assertEquals(5,NativeProtectedNamespaceObservation.KEY_FAMILIES.values().stream().filter(NativeProtectedNamespaceObservation.SHARED_KEY::equals).count());
        assertEquals(NativeProtectedNamespaceObservation.SHARED_KEY,NativeProtectedNamespaceObservation.KEY_FAMILIES.get(BATCH));
        assertThrows(UnsupportedOperationException.class,()->NativeProtectedNamespaceObservation.KEY_FAMILIES.remove(BATCH));
    }
    @Test public void everyStoreIsReadThreeTimesAndEmptyStillGrantsNothing() throws Exception {
        Fixture f=new Fixture();try(var value=f.observe()){
            assertEquals(8,value.recordCounts.size());assertEquals(0,value.recordCount);noAuthority(value);
            for(var calls:f.calls.values())assertEquals(3,calls.get());
            assertTrue(value.stillCurrent());for(var calls:f.calls.values())assertEquals(4,calls.get());
            assertThrows(UnsupportedOperationException.class,()->value.recordCounts.put(BATCH,1));
        }
    }
    @Test public void omittedExtraOrNullReaderIsNotEmptyAndIsRejectedBeforeReading() throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            Fixture f=new Fixture();f.stores.remove(name);denied(f::observe);for(var count:f.calls.values())assertEquals(0,count.get());
        }
        Fixture extra=new Fixture();extra.stores.put("unreviewed-other-plugin",Map::of);denied(extra::observe);
        for(var count:extra.calls.values())assertEquals(0,count.get());
        Fixture nullReader=new Fixture();nullReader.stores.put(BATCH,null);denied(nullReader::observe);
    }
    @Test public void eachUnavailableNamespaceIsNotSilentlyAbsent() throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            Fixture f=new Fixture();f.stores.put(name,()->null);denied(f::observe);
            f.stores.put(name,()->{throw new VaultFailure("fixture-private-error-detail");});
            // Reader failure is not success/absence. Its original failure code
            // remains an exception, never a printable raw preference value.
            assertThrows(VaultFailure.class,f::observe);
        }
    }
    @Test public void corruptFreezeProbeAndUnknownRowsRemainCounted() throws Exception {
        Fixture f=new Fixture();f.rows.get(WORK).put("native_separation_freeze.v1","corrupt original ciphertext");
        f.rows.get(WORK).put("native_separation_probe.v1",false);
        f.rows.get(WORK).put("unknown-original-key","opaque value");
        f.rows.get(BATCH).put("unknown-slot-after-gap","opaque slot");
        try(var value=f.observe()){assertEquals(4,value.recordCount);assertEquals(Integer.valueOf(3),value.recordCounts.get(WORK));noAuthority(value);}
        assertEquals(false,f.rows.get(WORK).get("native_separation_probe.v1"));
    }
    @Test public void exactTypesRawFloatBitsMalformedUtf16AndNamespacesBindIdentity() throws Exception {
        Fixture f=new Fixture();Map<String,Object> work=f.rows.get(WORK);
        work.put("string","\ud800");work.put("int",1);work.put("long",1L);work.put("flag",true);
        work.put("float",Float.intBitsToFloat(0x7fc00001));work.put("set",new HashSet<>(Set.of("\udfff","plain")));
        String old;try(var value=f.observe()){old=value.digest;assertEquals(6,value.recordCount);noAuthority(value);}
        work.put("float",Float.intBitsToFloat(0x7fc00002));try(var value=f.observe()){assertNotEquals(old,value.digest);}
        work.put("float",Float.intBitsToFloat(0x7fc00001));work.put("int",1L);try(var value=f.observe()){assertNotEquals(old,value.digest);}
        work.put("int",1);work.put("string","\ufffd");try(var value=f.observe()){assertNotEquals(old,value.digest);}
        work.put("string","\ud800");f.rows.get(BATCH).putAll(work);work.clear();try(var value=f.observe()){assertNotEquals(old,value.digest);}
    }
    @Test public void orderingIsNotIdentityAndCopiedSetDoesNotFollowMutation() throws Exception {
        Fixture f=new Fixture();var set=new HashSet<>(Set.of("a","b"));f.rows.get(BATCH).put("z",set);f.rows.get(BATCH).put("a","first");
        try(var first=f.observe()){
            Map<String,Object> reordered=new LinkedHashMap<>();reordered.put("a","first");reordered.put("z",new HashSet<>(Set.of("b","a")));
            f.rows.put(BATCH,reordered);try(var second=f.observe()){assertEquals(first.digest,second.digest);}
            reordered.put("z",Set.of("a","b","c"));assertFalse(first.stillCurrent());noAuthority(first);
        }
    }
    @Test public void changesBetweenReadsAndDuringHashWindowAreRejected() throws Exception {
        for(int turn:new int[]{2,3}){
            Fixture f=new Fixture();AtomicInteger count=new AtomicInteger();
            f.stores.put(BATCH,()->{if(count.incrementAndGet()==turn)f.rows.get(BATCH).put("changed","new");return f.rows.get(BATCH);});
            denied(f::observe);assertEquals("new",f.rows.get(BATCH).get("changed"));
        }
    }
    @Test public void changedEarlierStoreWhileLaterStoreIsReadCannotBecomeStable() throws Exception {
        Fixture f=new Fixture();String last=NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet().stream().reduce((a,b)->b).get();
        f.stores.put(last,()->{if(f.calls.get(last).incrementAndGet()==1)f.rows.get(BATCH).put("changed","kept");return f.rows.get(last);});
        denied(f::observe);assertEquals("kept",f.rows.get(BATCH).get("changed"));
    }
    @Test public void unsupportedAndOversizeValuesOrBadKeysAreNotFiltered() throws Exception {
        for(Object raw:new Object[]{new Object(),1d,new byte[]{1},Set.of(1),"x".repeat(524289)}){
            Fixture f=new Fixture();f.rows.get(BATCH).put("unknown",raw);denied(f::observe);assertSame(raw,f.rows.get(BATCH).get("unknown"));
        }
        Fixture nullValue=new Fixture();nullValue.rows.get(BATCH).put("unknown",null);denied(nullValue::observe);
        Fixture badKey=new Fixture();badKey.rows.get(BATCH).put("","opaque");denied(badKey::observe);
        Fixture tooMany=new Fixture();for(int i=0;i<4097;i++)tooMany.rows.get(BATCH).put("key"+i,"opaque");denied(tooMany::observe);
    }
    @Test public void totalRawSizeBudgetAppliesAcrossNamespaces() throws Exception {
        Fixture f=new Fixture();for(String name:f.rows.keySet())for(int i=0;i<3;i++)f.rows.get(name).put("key"+i,"x".repeat(524288));
        denied(f::observe);assertEquals(3,f.rows.get(BATCH).size());
    }
    @Test public void closedObservationCannotRecheckAndDisclosesNoRawRows() throws Exception {
        Fixture f=new Fixture();var value=f.observe();value.close();denied(value::stillCurrent);noAuthority(value);
        for(var method:NativeProtectedNamespaceObservation.class.getDeclaredMethods())assertFalse("rawValues".equals(method.getName()));
    }
    @Test public void androidAdapterUsesOnlyGetAllOnAlreadyBoundPreferences() throws Exception {
        Fixture f=new Fixture();AtomicInteger reads=new AtomicInteger();Map<String,SharedPreferences> existing=new HashMap<>();
        for(String name:f.rows.keySet())existing.put(name,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            if(!"getAll".equals(method.getName()))throw new AssertionError("read-only adapter invoked "+method.getName());
            reads.incrementAndGet();return f.rows.get(name);
        }));
        var bound=AndroidProtectedNamespaceReaders.bind(existing);existing.clear();
        try(var value=NativeProtectedNamespaceObservation.observe(bound)){assertEquals(24,reads.get());noAuthority(value);}
        denied(()->AndroidProtectedNamespaceReaders.bind(existing));
    }
    @Test public void duplicateReaderOrAndroidBackingCannotStandInForDifferentNamespaces() throws Exception {
        Fixture f=new Fixture();var one=f.stores.get(BATCH);
        f.stores.replaceAll((name,reader)->one);denied(f::observe);
        for(var count:f.calls.values())assertEquals(0,count.get());
        AtomicInteger reads=new AtomicInteger();SharedPreferences oneBacking=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            reads.incrementAndGet();throw new AssertionError("binding must reject before reading");
        });
        Map<String,SharedPreferences> existing=new HashMap<>();for(String name:f.rows.keySet())existing.put(name,oneBacking);
        denied(()->AndroidProtectedNamespaceReaders.bind(existing));assertEquals(0,reads.get());
    }

    // Fixed Android API and actual protected writer, with only backing I/O synthetic.
    private static Map<String,SharedPreferences> epochPreferences(Fixture f,int failureMode){
        Map<String,SharedPreferences> preferences=new HashMap<>();
        for(String name:f.rows.keySet())preferences.put(name,(SharedPreferences)Proxy.newProxyInstance(
            NativeProtectedNamespaceObservationTest.class.getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                if("getAll".equals(method.getName())){
                    f.calls.get(name).incrementAndGet();return new HashMap<>(f.rows.get(name));
                }
                if("contains".equals(method.getName()))return f.rows.get(name).containsKey(args[0]);
                if("edit".equals(method.getName())){
                    Map<String,Object> next=new HashMap<>();
                    return Proxy.newProxyInstance(NativeProtectedNamespaceObservationTest.class.getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,op,values)->{
                        if("putString".equals(op.getName())){next.put((String)values[0],values[1]);return editor;}
                        if("commit".equals(op.getName())){
                            f.rows.get(name).putAll(next);
                            if(failureMode==2)throw new IllegalStateException("synthetic backing write failure");
                            return failureMode==0;
                        }
                        throw new AssertionError("unexpected editor operation "+op.getName());
                    });
                }
                throw new AssertionError("unexpected preferences operation "+method.getName());
            }));
        return preferences;
    }
    private static final class EpochFixture {
        final Fixture fixture=new Fixture();
        final Map<String,Map<String,Object>> rows=fixture.rows;
        final Map<String,NativeProtectedNamespaceObservation.Store> stores=fixture.stores;
        final Map<String,AtomicInteger> calls=fixture.calls;
        final Object lock=new Object();long epoch;
        EpochFixture(){for(String name:rows.keySet())stores.put(name,guard(name,lock,0));}
        NativeProtectedNamespaceObservation observe()throws VaultFailure{return fixture.observe();}
        NativeProtectedNamespaceObservation.GuardedStore guard(String name,Object coordinator,long offset){
            return new NativeProtectedNamespaceObservation.GuardedStore(){
                public Object commitCoordinator(){return coordinator;}
                public long mutationEpochForReadOnlyCapture(){assertTrue(Thread.holdsLock(coordinator));return epoch+offset;}
                public Map<String,?> readAll(){assertTrue(Thread.holdsLock(coordinator));calls.get(name).incrementAndGet();return rows.get(name);}
            };
        }
    }
    @Test public void guardedAndroidUnchangedUsesFixedCoordinatorAndReadStamp()throws Exception{
        Fixture f=new Fixture();f.rows.get(WORK).put("original",Set.of("opaque","rows"));
        var readers=AndroidProtectedNamespaceReaders.bind(epochPreferences(f,0));
        Object lock=AndroidProtectedWorkPreferences.retainedCommitLock();
        synchronized(lock){for(var reader:readers.values()){
            assertTrue(reader instanceof NativeProtectedNamespaceObservation.GuardedStore);
            var guard=(NativeProtectedNamespaceObservation.GuardedStore)reader;
            assertSame(lock,guard.commitCoordinator());
            assertEquals(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture(),guard.mutationEpochForReadOnlyCapture());
        }}
        try(var observed=NativeProtectedNamespaceObservation.observe(readers);var pure=f.observe()){
            assertTrue(observed.stillCurrent());assertEquals(pure.digest,observed.digest);
            assertEquals(pure.recordCounts,observed.recordCounts);noAuthority(observed);noAuthority(pure);
        }
    }
    @Test public void guardedAndroidFalseAndThrowByteAbaInvalidatesOriginal()throws Exception{
        for(int mode:new int[]{1,2}){
            Fixture f=new Fixture();f.rows.get(WORK).put("original","opaque original");
            var preferences=epochPreferences(f,mode);var rowsBefore=new HashMap<>(f.rows.get(WORK));
            try(var observed=NativeProtectedNamespaceObservation.observe(AndroidProtectedNamespaceReaders.bind(preferences));var pure=f.observe()){
                long before=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
                var editor=new AndroidProtectedWorkPreferences(preferences.get(WORK)).edit().putString("original","memory-only changed");
                if(mode==1)assertFalse(editor.commit());else assertThrows(IllegalStateException.class,editor::commit);
                assertTrue(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>before);
                f.rows.get(WORK).clear();f.rows.get(WORK).putAll(rowsBefore); // exact synthetic byte ABA after attempted write
                assertEquals(rowsBefore,f.rows.get(WORK));assertTrue(pure.stillCurrent());
                assertFalse(observed.stillCurrent());noAuthority(observed);noAuthority(pure);
            }
        }
    }
    @Test public void guardedLateReaderWriteAttemptRefusesCaptureAndRecheck()throws Exception{
        for(int read:new int[]{1,3,4}){
            Fixture f=new Fixture();var preferences=epochPreferences(f,1);
            String last=NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet().stream().reduce((a,b)->b).get();
            SharedPreferences originalLast=preferences.get(last);AtomicInteger calls=new AtomicInteger();
            preferences.put(last,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                assertEquals("getAll",method.getName());
                if(calls.incrementAndGet()==read){
                    var original=new HashMap<>(f.rows.get(WORK));
                    assertFalse(new AndroidProtectedWorkPreferences(preferences.get(WORK)).edit().putString("transient","attempt").commit());
                    f.rows.get(WORK).clear();f.rows.get(WORK).putAll(original);
                }
                return originalLast.getAll();
            }));
            var readers=AndroidProtectedNamespaceReaders.bind(preferences);
            if(read<4)denied(()->NativeProtectedNamespaceObservation.observe(readers));
            else try(var observation=NativeProtectedNamespaceObservation.observe(readers)){denied(observation::stillCurrent);noAuthority(observation);}
        }
    }
    @Test public void guardedMixedWrongAndChangingCoordinatorRefused()throws Exception{
        EpochFixture mixed=new EpochFixture();mixed.stores.put(BATCH,()->mixed.rows.get(BATCH));denied(mixed::observe);
        EpochFixture wrong=new EpochFixture();wrong.stores.put(BATCH,wrong.guard(BATCH,new Object(),0));denied(wrong::observe);
        for(var count:mixed.calls.values())assertEquals(0,count.get());for(var count:wrong.calls.values())assertEquals(0,count.get());
        EpochFixture changing=new EpochFixture();Object foreign=new Object();
        changing.stores.put(BATCH,new NativeProtectedNamespaceObservation.GuardedStore(){
            boolean changed;
            public Object commitCoordinator(){return changed?foreign:changing.lock;}
            public long mutationEpochForReadOnlyCapture(){return changing.epoch;}
            public Map<String,?> readAll(){changed=true;return changing.rows.get(BATCH);}
        });denied(changing::observe);
    }
    @Test public void guardedInconsistentAndNegativeEpochRefused()throws Exception{
        EpochFixture inconsistent=new EpochFixture();inconsistent.stores.put(BATCH,inconsistent.guard(BATCH,inconsistent.lock,1));denied(inconsistent::observe);
        EpochFixture negative=new EpochFixture();negative.epoch=-1;denied(negative::observe);
        for(var count:inconsistent.calls.values())assertEquals(0,count.get());for(var count:negative.calls.values())assertEquals(0,count.get());
    }
    @Test public void guardedUnavailableReadPreservesOriginalFailure()throws Exception{
        EpochFixture f=new EpochFixture();AtomicInteger calls=new AtomicInteger();
        f.stores.put(BATCH,new NativeProtectedNamespaceObservation.GuardedStore(){
            public Object commitCoordinator(){return f.lock;}
            public long mutationEpochForReadOnlyCapture(){return f.epoch;}
            public Map<String,?> readAll()throws VaultFailure{
                if(calls.incrementAndGet()>3)throw new VaultFailure("fixture-private-error-detail");return f.rows.get(BATCH);
            }
        });try(var value=f.observe()){
            assertEquals("fixture-private-error-detail",assertThrows(VaultFailure.class,value::stillCurrent).code);noAuthority(value);
        }
    }
    @Test public void guardedCurrentnessDoesNotAcquireObserverMonitor()throws Exception{
        EpochFixture f=new EpochFixture();try(var value=f.observe()){
            java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
            Thread reader=new Thread(()->{try{assertTrue(value.stillCurrent());}catch(Throwable error){failure.set(error);}},"owned-guarded-reader");
            synchronized(value){reader.start();reader.join(2000);}
            if(reader.isAlive()){reader.join(2000);fail("guarded currentness waited on unrelated observation monitor");}
            if(failure.get()!=null)throw new AssertionError(failure.get());
            noAuthority(value);
        }
    }
    @Test public void guardedEpochChangeDuringRawCopyIsRefused()throws Exception{
        Fixture f=new Fixture();f.rows.get(BATCH).put("original","unchanged original");
        var preferences=epochPreferences(f,1);AtomicInteger writes=new AtomicInteger();
        preferences.put(BATCH,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            assertEquals("getAll",method.getName());
            return new HashMap<String,Object>(f.rows.get(BATCH)){
                @Override public Set<Map.Entry<String,Object>> entrySet(){
                    if(writes.incrementAndGet()==1){
                        var original=new HashMap<>(f.rows.get(WORK));
                        assertFalse(new AndroidProtectedWorkPreferences(preferences.get(WORK)).edit().putString("transient","attempt").commit());
                        f.rows.get(WORK).clear();f.rows.get(WORK).putAll(original);
                    }
                    return super.entrySet();
                }
            };
        }));
        denied(()->NativeProtectedNamespaceObservation.observe(AndroidProtectedNamespaceReaders.bind(preferences)));
        assertTrue(writes.get()>0);assertEquals("unchanged original",f.rows.get(BATCH).get("original"));
    }
}
