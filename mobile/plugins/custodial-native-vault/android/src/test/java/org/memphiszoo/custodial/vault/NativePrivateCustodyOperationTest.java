package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.channels.FileChannel;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW operation-journal source cases. Original owner/key/actor are synthetic;
 * host private-file effects are real. Pending moves/aliases are fault fixtures,
 * NOT process-restart/Android power-loss or all-writer/ABA qualification. */
public final class NativePrivateCustodyOperationTest {
    // Only the new original-preparation failure selectors are invoked by this
    // bounded source/mock entry point. No old @Test group is replayed.
    public static void main(String[] args)throws Exception {
        if(args.length==2&&args[0].equals("--operation-terminal-source-raw-only")){
            if(!java.util.Set.of("OPERATION_CURRENT_unchangedOriginalReopensWithoutEffects",
                "OPERATION_CURRENT_lastSourceChangedCiphertextRefusesAndCannotRevive").contains(args[1]))
                throw new AssertionError("affected original operation read member required");
            NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyOperationTest.class,args[1]);return;
        }
        if(args.length==2&&args[0].equals("--pending-operation-publication-only")){
            if(!java.util.Set.of("PENDING_OPERATION_normalPublicationPreservesOriginalInodeAndBinding",
                "PENDING_OPERATION_unknownTargetRefusesWithoutOverwrite").contains(args[1]))
                throw new AssertionError("new pending operation publication member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("PENDING_OPERATION_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("PENDING_OPERATION_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("SOURCE_HOST_PENDING_OPERATION "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--operation-writer-fence-only")){
            if(!java.util.Set.of("OPERATION_WRITER_liveFramePreservesPrepareInspectAndResume",
                "OPERATION_WRITER_closedEntryCreatesNoArtifacts",
                "OPERATION_WRITER_closedPendingRetainsOriginalWithoutResumeIo").contains(args[1]))
                throw new AssertionError("new operation writer fence member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("OPERATION_WRITER_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("OPERATION_WRITER_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_OPERATION_WRITER "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--first-operation-invocation-only")){
            if(!java.util.Set.of("FIRST_INVOCATION_sameControlRetainsExactOriginal",
                "FIRST_INVOCATION_preentryCancelRunsNoWriter",
                "FIRST_INVOCATION_cancelAfterPendingForceKeepsPending",
                "FIRST_INVOCATION_cancelAfterLinkKeepsBothAliases",
                "FIRST_INVOCATION_cancelledLeaseCannotReleaseSuccessor").contains(args[1]))throw new AssertionError("new first invocation member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    Throwable error=failure.getException();System.err.println("FIRST_INVOCATION_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("FIRST_INVOCATION_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_FIRST_INVOCATION "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--observed-operation-file-identity-only")){
            if(!java.util.Set.of("OBSERVED_OPERATION_unchangedReadbackAndVolatileCandidate",
                "OBSERVED_OPERATION_sameBytesReplacementRefusesSavedHint",
                "OBSERVED_OPERATION_rootDirectoryAndLockIdentityRefuse",
                "OBSERVED_OPERATION_pendingReplacementRefusesBeforeForce",
                "OBSERVED_OPERATION_exactAliasReadAndResumeRemainBound").contains(args[1]))throw new AssertionError("new observed identity member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    Throwable error=failure.getException();System.err.println("OBSERVED_IDENTITY_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("OBSERVED_IDENTITY_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_OBSERVED_OPERATION_IDENTITY "+args[1]);return;
        }
        if(args.length==1&&args[0].equals("--captured-operation-file-identity-only")){
            new NativePrivateCustodyOperationTest().capturedOperationRefusesSameBytesReplacementInode();
            System.out.println("PASS_SOURCE_HOST_CAPTURED_OPERATION_FILE_IDENTITY");return;
        }
        if(args.length==2&&args[0].equals("--first-original-reservation-transfer-only")){
            if(!java.util.Set.of("FIRST_RETENTION_closedLeaseCannotReleaseSuccessor",
                "FIRST_RETENTION_refusalConsumesOnlyOwnedReservation",
                "FIRST_RETENTION_changedRootAndOriginalPresenceRefuse",
                "FIRST_RETENTION_sameReservationRetainsWithoutGap",
                "FIRST_RETENTION_foreignAndClosedFrameRefuse",
                "FIRST_RETENTION_changedCurrentnessPreservesCapsule",
                "FIRST_RETENTION_partialUnknownNeverReplacesOriginal").contains(args[1]))throw new AssertionError("new transfer member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    Throwable error=failure.getException();
                    // Type/positions only, never private row/credential messages.
                    for(int depth=0;error!=null&&depth<8;depth++,error=error.getCause()){
                        System.err.println("FIRST_RETENTION_FAILURE "+error.getClass().getName());
                        for(var point:error.getStackTrace())System.err.println("FIRST_RETENTION_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                    }
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_FIRST_RETENTION "+args[1]);return;
        }
        if(args.length==1&&args[0].equals("--initial-baseline-absence-only")){
            for(String name:new String[]{"INITIAL_BASELINE_ABSENCE_privateSourceLeaseSerializesWithoutFiles",
                "INITIAL_BASELINE_ABSENCE_anyOriginalPresenceRemainsRetained",
                "INITIAL_BASELINE_ABSENCE_changedRootOrCreatedDirectoryRefuses"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_SOURCE_HOST_INITIAL_ABSENCE "+name);
            }return;
        }
        if(args.length==2&&args[0].equals("--original-operation-jce-unit-only")){
            if(!java.util.Set.of("OPERATION_UNIT_encryptedFreshReopenKeepsExactOriginal","OPERATION_UNIT_processOnlyBaselineCannotAdoptOldOperation",
                "OPERATION_UNIT_durableChangeWithSameRawRefusesOldOperation","OPERATION_UNIT_legacyEncryptedOriginalIsHeldUnchanged",
                "CAPSULE_INSPECT_changedExistingKeyRefusesFreshRead","CAPSULE_INSPECT_changedOriginalRawRefusesFreshRead",
                "CAPSULE_INSPECT_changedCapsuleWithValidChecksumRefusesFreshRead",
                "FRAME_INSPECT_changedExistingKeyRefusesStaleOwnerAndMetadata","FRAME_INSPECT_changedOriginalRawRefusesStaleOwnerAndMetadata",
                "FRAME_INSPECT_changedFixedCapsuleRefusesStaleOwnerAndMetadata",
                "SIGNER_ID_keyChangeAfterImmutableLookupCannotAuthorizeSignature").contains(args[1]))throw new AssertionError("new JCE UNIT selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("JCE_UNIT_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("JCE_UNIT_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }System.out.println("PASS_SYNTHETIC_JCE_UNIT "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--original-operation-stamp-only")){
            if(!java.util.Set.of("OPERATION_STAMP_closedOriginalSchemaAndLegacyRefusal","OPERATION_STAMP_actualCapturedStampBindsSourceOnlyRecord",
                "OPERATION_STAMP_normalFrameFixturePrerequisite").contains(args[1]))throw new AssertionError("new owning stamp selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("OPERATION_STAMP_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("OPERATION_STAMP_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }System.out.println("PASS_SOURCE_HOST_OPERATION_STAMP "+args[1]);return;
        }
        if(args.length==1&&args[0].equals("--work-observation-durable-stamp-only")){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,"WORK_OBSERVATION_actualDurableInstallAndUnavailableCounterRefuse"));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("WORK_OBSERVATION_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("WORK_OBSERVATION_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError("new WORK durable observation case");
            }
            System.out.println("PASS_SOURCE_HOST_WORK_DURABLE_OBSERVATION");return;
        }
        if(args.length==2&&args[0].equals("--durable-writer-reader-only")){
            if(!java.util.Set.of("DURABLE_JOIN_originalSameByteCommitFollowsDurableCounter",
                "DURABLE_JOIN_forceFailureDeniesPreferences","DURABLE_JOIN_partialFailureDeniesPreferences",
                "DURABLE_JOIN_closedTokenRefusesBeforeEffects","DURABLE_JOIN_foreignTokenRefusesRegistry",
                "DURABLE_JOIN_secondInstallRefusesBeforeFiles").contains(args[1]))throw new AssertionError("explicit new owning join selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("DURABLE_JOIN_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("DURABLE_JOIN_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_OWNING_JOIN "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--existing-epoch-reattachment-only")){
            if(!java.util.Set.of("REATTACH_absentLegacyRootHasNoEffects","REATTACH_progressedOriginalReopensExactCounter",
                "REATTACH_partialCorruptAndReplacedMetadataRefuse","REATTACH_parentSymlinkAndForeignRootRefuse",
                "REATTACH_currentReplacementObservationBoundary").contains(args[1]))throw new AssertionError("new reattachment selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,args[1]));
            if(!result.wasSuccessful()||result.getRunCount()!=1){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("REATTACH_FAILURE "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("REATTACH_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_REATTACH "+args[1]);return;
        }
        if((args.length==1||args.length==2)&&args[0].equals("--mutation-epoch-bootstrap-only")){
            if(args.length==2&&!java.util.Set.of("BOOTSTRAP_actualOwnerBaselineFreshReadAndExactRetry","BOOTSTRAP_conflictingLegacyAndForeignRootRefuse",
                "BOOTSTRAP_closedChangedAndWrongMonitorRefuseBeforeEffects","BOOTSTRAP_partialForceAndCompleteRetryPreserveOriginal",
                "BOOTSTRAP_sourceChangeDuringEffectRemainsUnavailable").contains(args[1]))throw new AssertionError("explicit newly affected baseline selector required");
            for(String name:new String[]{"BOOTSTRAP_actualOwnerBaselineFreshReadAndExactRetry",
                "BOOTSTRAP_closedChangedAndWrongMonitorRefuseBeforeEffects",
                "BOOTSTRAP_partialForceAndCompleteRetryPreserveOriginal",
                "BOOTSTRAP_conflictingLegacyAndForeignRootRefuse",
                "BOOTSTRAP_sourceChangeDuringEffectRemainsUnavailable"}){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,name));
                if(!result.wasSuccessful()||result.getRunCount()!=1){for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);}
                System.out.println("PASS_SOURCE_HOST_BOOTSTRAP "+name);
            }return;
        }
        if(args.length==1&&args[0].equals("--mutation-epoch-only")){
            for(String name:new String[]{"EPOCH_durablePrepareCommitAndFreshRead","EPOCH_exactInterruptedPendingAndAliasResume",
                "EPOCH_forceAndPartialWriteFailuresPreserve","EPOCH_promotionFaultsRetainRecoverableOriginal",
                "EPOCH_malformedConflictingAndChangedIdentitiesRefuse","EPOCH_overflowMissingBootstrapAndLockRefuse"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOperationTest.class,name));
                if(!result.wasSuccessful()||result.getRunCount()!=1){for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);}
                System.out.println("PASS_SOURCE_HOST_FILES "+name);
            }return;
        }
        if(args.length==1&&args[0].equals("--restart-resume-force-only")) {
            var test=new NativePrivateCustodyOperationTest();
            for(String name:new String[]{"restartResumeForcesExactPendingBeforeLink","restartForceFailuresPreservePendingOriginal",
                "restartLinkFailuresPreserveRecoverableOriginal","restartCurrentnessChangeAfterForceRefusesPromotion",
                "restartMissingForeignAndAmbiguousPendingRefuseBeforeForce"}) {
                try{NativePrivateCustodyOperationTest.class.getMethod(name).invoke(test);System.out.println("PASS "+name);}
                catch(java.lang.reflect.InvocationTargetException e){System.out.println("FAIL "+name+" "+e.getCause().getClass().getSimpleName());throw e;}
            }return;
        }
        if(args.length==1&&args[0].equals("--prepared-original-followup-only")) {
            var test=new NativePrivateCustodyOperationTest();
            test.memoryOnlyWriterOutcomeRetainsOriginalWithoutInventingDurability();System.out.println("PASS memoryOnlyWriterOutcomeRetainsOriginalWithoutInventingDurability");
            test.forceAmbiguousPendingDirectResumeStillUsesOriginalAndClosesCandidate();System.out.println("PASS forceAmbiguousPendingDirectResumeStillUsesOriginalAndClosesCandidate");return;
        }
        if(args.length==1&&args[0].equals("--prepared-original-create-repro-only")) {
            new NativePrivateCustodyOperationTest().createFailureRetainsOriginalAcrossSameRootAdapters();System.out.println("PASS createFailureRetainsOriginalAcrossSameRootAdapters");return;
        }
        if(args.length!=1||!args[0].equals("--prepared-original-failures-only"))throw new AssertionError("selector required");
        var test=new NativePrivateCustodyOperationTest();
        for(String name:new String[]{"createFailureRetainsOriginalAcrossSameRootAdapters","completeWriteBeforeForceKeepsPendingAndRequiresExplicitResume",
            "partialWriteIsUnknownAndNeverRepairedOrReencrypted","changedKeyCannotWriteRetainedPreparation","foreignValidPendingCannotReplaceFirstPreparedOriginal",
            "replacedLockIdentityCannotRevivePreparedOriginal","reentrantPreparationCannotAllocateCompetingOriginal"}) {
            try{NativePrivateCustodyOperationTest.class.getMethod(name).invoke(test);System.out.println("PASS "+name);}
            catch(java.lang.reflect.InvocationTargetException e){System.out.println("FAIL "+name+" "+e.getCause().getClass().getSimpleName());throw e;}
        }
    }
    private interface FirstInvocationCase {
        void run(NativePrivateCustodyOwnerTest.Fixture f,NativePrivateCustodyOperationStore store,
            NativePrivateCustodyOperationStore.InitialMutationBaselineAbsence lease,
            VaultEngine.NativePrivateCustodyTransportFrame frame,NativePrivateCustodyFrameReadControl control)throws Exception;
    }
    // Existing owning first-retention setup, with one original finite control
    // created before the original prefix. No caller JSON/epoch or fake frame.
    private static void firstInvocationCase(FirstInvocationCase body)throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new NativePrivateCustodyOwnerTest.Fixture()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            var lease=store.acquireInitialMutationBaselineAbsence();
            try{
                f.commit();var capsule=saved(f.dir);
                try(var namespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                    var values=f.x.f.values(f.h.g,namespaces);var semantics=f.x.f.join(values);
                    var layout=f.x.layout(semantics);var owner=f.engine().inspectOriginalPrivateCustody(layout,f.store);
                    var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                    frame.requireFirstOriginalReservation(lease);body.run(f,store,lease,frame,control);
                }same(capsule,f.dir);
            }finally{lease.close();}
        }
    }
    private static void originalPendingWrite(Object normal,NativePrivateCustodyOperationStore.Existing candidate)throws Exception {
        var method=normal.getClass().getDeclaredMethod("write",NativePrivateCustodyOperationStore.Existing.class);method.setAccessible(true);
        try{method.invoke(normal,candidate);}catch(java.lang.reflect.InvocationTargetException failed){throw(Exception)failed.getCause();}
    }
    @Test public void FIRST_INVOCATION_sameControlRetainsExactOriginal()throws Exception {
        firstInvocationCase((f,store,lease,frame,control)->{
            Path directory=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);
            assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,null));assertFalse(Files.exists(directory));
            try(var retained=lease.retainFirstOriginal(frame,control);var now=store.inspectOriginal(frame)){
                control.check();assertTrue(retained.sameObservedOriginal(now));
                assertEquals("COMMITTED",retained.metadata().getString("journal_phase"));
                assertTrue(retained.metadata().getBoolean("local_operation_committed_observed"));
                byte[] bytes=encoded(retained);
                try{assertArrayEquals(bytes,Files.readAllBytes(directory.resolve(NativePrivateCustodyOperationStore.COMMITTED)));}
                finally{Arrays.fill(bytes,(byte)0);}
                assertFalse(Files.exists(directory.resolve(NativePrivateCustodyOperationStore.PENDING)));
                try(var recovered=f.engine().recoverOriginalPrivateCustodyOperation(frame,store)){noAuthority(recovered.projection());}
            }
        });
    }
    @Test public void FIRST_INVOCATION_preentryCancelRunsNoWriter()throws Exception {
        firstInvocationCase((f,store,lease,frame,control)->{
            int[] writes={0};writer(store,candidate->{writes[0]++;throw new AssertionError("cancelled first-entry writer ran");});
            control.cancel();assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,control));
            assertEquals(0,writes[0]);assertFalse(Files.exists(f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY)));
            assertThrows(VaultFailure.class,lease::requireCurrent);
        });
    }
    @Test public void FIRST_INVOCATION_cancelAfterPendingForceKeepsPending()throws Exception {
        firstInvocationCase((f,store,lease,frame,control)->{
            Path directory=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY),pending=directory.resolve(NativePrivateCustodyOperationStore.PENDING);
            var bytes=new java.util.concurrent.atomic.AtomicReference<byte[]>();int[] writes={0};Object[] normal={null};
            normal[0]=writer(store,candidate->{
                writes[0]++;bytes.set(encoded(candidate));originalPendingWrite(normal[0],candidate);
                assertArrayEquals(bytes.get(),Files.readAllBytes(pending));control.cancel();
            });
            try{
                assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,control));
                assertEquals(1,writes[0]);assertArrayEquals(bytes.get(),Files.readAllBytes(pending));
                assertFalse(Files.exists(directory.resolve(NativePrivateCustodyOperationStore.COMMITTED)));
                var saved=saved(directory);lease.close();assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,control));
                same(saved,directory);assertEquals(1,writes[0]);
            }finally{if(bytes.get()!=null)Arrays.fill(bytes.get(),(byte)0);}
        });
    }
    @Test public void FIRST_INVOCATION_cancelAfterLinkKeepsBothAliases()throws Exception {
        firstInvocationCase((f,store,lease,frame,control)->{
            Path directory=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY),pending=directory.resolve(NativePrivateCustodyOperationStore.PENDING),
                committed=directory.resolve(NativePrivateCustodyOperationStore.COMMITTED);
            int[] links={0};var original=new java.util.concurrent.atomic.AtomicReference<byte[]>();
            resumeFault(store,(action,normal)->{
                assertEquals("linkPending",action);links[0]++;original.set(Files.readAllBytes(pending));normalResumeIo(normal,action);
                assertTrue(Files.isSameFile(committed,pending));control.cancel();
            });
            try{
                assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,control));assertEquals(1,links[0]);
                assertTrue(Files.isSameFile(committed,pending));assertArrayEquals(original.get(),Files.readAllBytes(pending));
                assertArrayEquals(original.get(),Files.readAllBytes(committed));var saved=saved(directory);
                lease.close();assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame,control));same(saved,directory);
            }finally{if(original.get()!=null)Arrays.fill(original.get(),(byte)0);}
        });
    }
    @Test public void FIRST_INVOCATION_cancelledLeaseCannotReleaseSuccessor()throws Exception {
        // Pure reservation negative: canceled entry is checked before even a
        // missing frame, without native capture/key/UUID/body creation.
        Path root=initialBaselineAbsenceRoot();
        try(var control=new NativePrivateCustodyFrameReadControl()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var previous=store.acquireInitialMutationBaselineAbsence();control.cancel();
            try{
                assertThrows(VaultFailure.class,()->previous.retainFirstOriginal(null,control));
                try(var next=other.acquireInitialMutationBaselineAbsence()){
                    previous.close();assertThrows(VaultFailure.class,()->previous.retainFirstOriginal(null,control));
                    previous.close();next.requireCurrent();assertThrows(VaultFailure.class,store::acquireInitialMutationBaselineAbsence);
                    try(var files=Files.list(root)){assertEquals(0,files.count());}
                }
            }finally{previous.close();}
        }finally{Files.delete(root);}
    }
    // New tests use the existing authenticated guarded-reader frame fixture,
    // real host files and the existing synthetic key backend only. This is not
    // Android/inode durability, all-writer fencing, or the pending Engine join.
    private static Path replaceObservedOperationFile(Fixture f,Path file)throws Exception {
        Path preserved=f.f.root.resolve("synthetic-observed-original-"+file.getFileName()),
            replacement=f.f.root.resolve("synthetic-observed-replacement-"+file.getFileName());
        Object before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
        Files.createLink(preserved,file);Files.copy(file,replacement);
        Files.setPosixFilePermissions(replacement,PosixFilePermissions.fromString("rw-------"));
        Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        assertNotEquals(before,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        return preserved;
    }
    private static void copyObservedOperationDirectory(Path original,Path replacement)throws Exception {
        Files.createDirectory(replacement,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        try(var files=Files.list(original)){
            for(Path file:files.toList()){
                Path copy=replacement.resolve(file.getFileName());Files.copy(file,copy);
                Files.setPosixFilePermissions(copy,PosixFilePermissions.fromString("rw-------"));
            }
        }
    }
    @Test public void OBSERVED_OPERATION_unchangedReadbackAndVolatileCandidate()throws Exception {
        try(var f=new Fixture(true);var operation=f.prepare();var first=f.store.inspectOriginal(f.frame);
            var second=f.store.inspectOriginal(f.frame);var hint=f.store.inspectSavedIdentityHint()){
            assertTrue(first.sameOriginal(second));assertTrue(first.sameObservedOriginal(second));
            assertTrue(second.sameObservedOriginal(first));assertTrue(hint.matchesFullyVerifiedOperation(first));
            f.store.requireSavedIdentityHintCurrent(hint);var files=saved(f.dir);
            byte[] bytes=encoded(first);
            try{
                var body=first.getClass().getDeclaredField("body");body.setAccessible(true);
                var constructor=NativePrivateCustodyOperationStore.Existing.class.getDeclaredConstructor(byte[].class,String.class,String.class);
                constructor.setAccessible(true);
                try(var candidate=constructor.newInstance(bytes,(String)body.get(first),"COMMITTED")){
                    assertTrue(first.sameOriginal(candidate));assertTrue(candidate.sameOriginal(first));
                    assertFalse(first.sameObservedOriginal(candidate));assertFalse(candidate.sameObservedOriginal(first));
                    assertFalse(candidate.sameObservedOriginal(candidate));assertFalse(hint.matchesFullyVerifiedOperation(candidate));
                }
            }finally{Arrays.fill(bytes,(byte)0);}
            first.close();assertThrows(VaultFailure.class,()->first.sameObservedOriginal(second));same(files,f.dir);
        }
    }
    @Test public void OBSERVED_OPERATION_sameBytesReplacementRefusesSavedHint()throws Exception {
        try(var f=new Fixture(true);var operation=f.prepare();var original=f.store.inspectOriginal(f.frame);
            var hint=f.store.inspectSavedIdentityHint()){
            byte[] bytes=Files.readAllBytes(f.committed);
            try{
                Path preserved=replaceObservedOperationFile(f,f.committed);
                try(var now=f.store.inspectOriginal(f.frame)){
                    assertTrue(original.sameOriginal(now));assertFalse(original.sameObservedOriginal(now));
                    assertFalse(hint.matchesFullyVerifiedOperation(now));
                }
                assertThrows(VaultFailure.class,()->f.store.requireSavedIdentityHintCurrent(hint));
                assertArrayEquals(bytes,Files.readAllBytes(f.committed));assertArrayEquals(bytes,Files.readAllBytes(preserved));
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void OBSERVED_OPERATION_rootDirectoryAndLockIdentityRefuse()throws Exception {
        for(String fault:new String[]{"lock","directory","root"})try(var f=new Fixture(true);var operation=f.prepare();
            var hint=f.store.inspectSavedIdentityHint()){
            String generation=hint.generationForOwningEngine();byte[] original=Files.readAllBytes(f.committed);
            try{
                if(fault.equals("lock"))replaceObservedOperationFile(f,f.dir.resolve(NativePrivateCustodyOperationStore.LOCK));
                else if(fault.equals("directory")){
                    Path preserved=f.f.root.resolve("synthetic-observed-original-directory");Files.move(f.dir,preserved);
                    copyObservedOperationDirectory(preserved,f.dir);
                }else{
                    Path preserved=f.f.root.resolveSibling(f.f.root.getFileName()+"-synthetic-observed-original-root");
                    Files.move(f.f.root,preserved);
                    Files.createDirectory(f.f.root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    copyObservedOperationDirectory(preserved.resolve(NativePrivateCustodyOperationStore.DIRECTORY),f.dir);
                }
                // A newly read hint is still not frame/auth/admission authority;
                // the original hint must not adopt its byte-equal successor.
                try(var now=f.store.inspectSavedIdentityHint()){assertEquals(generation,now.generationForOwningEngine());}
                assertThrows(VaultFailure.class,()->f.store.requireSavedIdentityHintCurrent(hint));
                assertArrayEquals(original,Files.readAllBytes(f.committed));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void OBSERVED_OPERATION_pendingReplacementRefusesBeforeForce()throws Exception {
        try(var f=new Fixture(true)){
            byte[] original=pendingBeforeForce(f);var store=resetOwnership(f);int[] calls={0};
            try(var captured=store.inspectOriginal(f.frame);var hint=store.inspectPendingIdentityHint()){
                Path preserved=replaceObservedOperationFile(f,f.pending);
                try(var now=store.inspectOriginal(f.frame)){
                    assertTrue(captured.sameOriginal(now));assertFalse(captured.sameObservedOriginal(now));
                    assertFalse(hint.matchesFullyVerifiedOperation(now));
                }
                assertThrows(VaultFailure.class,()->store.requirePendingIdentityHintCurrent(hint));
                resumeFault(store,(action,normal)->{calls[0]++;throw new java.io.IOException("synthetic forbidden force after inode change");});
                assertThrows(VaultFailure.class,()->store.resumeOriginal(f.frame,captured));
                assertEquals(0,calls[0]);assertFalse(Files.exists(f.committed));
                assertArrayEquals(original,Files.readAllBytes(f.pending));assertArrayEquals(original,Files.readAllBytes(preserved));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void OBSERVED_OPERATION_exactAliasReadAndResumeRemainBound()throws Exception {
        try(var f=new Fixture(true)){
            byte[] original=pendingBeforeForce(f);var store=resetOwnership(f);var calls=new java.util.ArrayList<String>();
            try{
                Files.createLink(f.committed,f.pending);
                try(var captured=store.inspectOriginal(f.frame);var hint=store.inspectPendingIdentityHint()){
                    assertTrue(hint.matchesFullyVerifiedOperation(captured));store.requirePendingIdentityHintCurrent(hint);
                    assertEquals("COMMITTED_PENDING_ALIAS",captured.metadata().getString("journal_phase"));
                    resumeFault(store,(action,normal)->{calls.add(action);normalResumeIo(normal,action);});
                    try(var completed=store.resumeOriginal(f.frame,captured);var now=store.inspectOriginal(f.frame)){
                        assertTrue(completed.sameObservedOriginal(now));assertTrue(completed.sameOriginal(now));
                        assertEquals("COMMITTED",completed.metadata().getString("journal_phase"));
                    }
                }
                assertEquals(java.util.List.of("forceOriginal"),calls);assertFalse(Files.exists(f.pending));
                assertArrayEquals(original,Files.readAllBytes(f.committed));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void capturedOperationRefusesSameBytesReplacementInode()throws Exception {
        try(var f=new Fixture(true);var captured=f.prepare()){
            byte[] original=Files.readAllBytes(f.committed);
            try{
                Object before=Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                Path preserved=f.f.root.resolve("synthetic-preserved-operation-inode"),replacement=f.f.root.resolve("synthetic-operation-replacement");
                Files.createLink(preserved,f.committed);Files.copy(f.committed,replacement);
                Files.setPosixFilePermissions(replacement,PosixFilePermissions.fromString("rw-------"));
                Files.move(replacement,f.committed,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertArrayEquals(original,Files.readAllBytes(f.committed));
                assertNotEquals(before,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertThrows(VaultFailure.class,captured::projection);
                assertArrayEquals(original,Files.readAllBytes(preserved));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void FIRST_RETENTION_closedLeaseCannotReleaseSuccessor()throws Exception {
        Path root=initialBaselineAbsenceRoot();
        try{
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var first=store.acquireInitialMutationBaselineAbsence();first.close();
            try(var next=other.acquireInitialMutationBaselineAbsence()){
                assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));first.close();first.close();
                next.requireCurrent();assertThrows(VaultFailure.class,store::acquireInitialMutationBaselineAbsence);
                try(var files=Files.list(root)){assertEquals(0,files.count());}
            }
        }finally{Files.delete(root);}
    }
    @Test public void FIRST_RETENTION_refusalConsumesOnlyOwnedReservation()throws Exception {
        Path root=initialBaselineAbsenceRoot(),foreign=initialBaselineAbsenceRoot();
        try{
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var foreignStore=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(foreign.toFile());
            try(var other=foreignStore.acquireInitialMutationBaselineAbsence()){
                var first=store.acquireInitialMutationBaselineAbsence();
                assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));first.close();
                other.requireCurrent();assertThrows(VaultFailure.class,first::requireCurrent);
                try(var next=store.acquireInitialMutationBaselineAbsence()){
                    assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));first.close();next.requireCurrent();
                }
            }
            var mismatch=store.acquireInitialMutationBaselineAbsence();
            Object key=Files.readAttributes(foreign,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            assertThrows(VaultFailure.class,()->mismatch.requireSameNativeRoot(foreign,key));
            Object own=Files.readAttributes(root,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            assertThrows(VaultFailure.class,()->mismatch.requireSameNativeRoot(root,own));
            assertThrows(VaultFailure.class,()->mismatch.retainFirstOriginal(null));mismatch.close();
            try(var next=store.acquireInitialMutationBaselineAbsence()){next.requireCurrent();}
        }finally{Files.delete(root);Files.delete(foreign);}
    }
    @Test public void FIRST_RETENTION_changedRootAndOriginalPresenceRefuse()throws Exception {
        Path root=initialBaselineAbsenceRoot(),moved=root.resolveSibling(root.getFileName()+"-preserved");
        try{
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            try(var first=store.acquireInitialMutationBaselineAbsence()){
                Files.move(root,moved);Files.createDirectory(root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));
                Files.delete(root);Files.move(moved,root);
                assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));
            }
            for(String domain:new String[]{NativePrivateCustodyOperationStore.DIRECTORY,VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY}){
                var first=store.acquireInitialMutationBaselineAbsence();Path dir=root.resolve(domain),file=dir.resolve("unknown-original");
                byte[] original={7,3,1};
                try{
                    Files.createDirectory(dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    writeFault(file,original,original.length,true);
                    assertThrows(VaultFailure.class,()->first.retainFirstOriginal(null));first.close();
                    assertArrayEquals(original,Files.readAllBytes(file));assertThrows(VaultFailure.class,store::acquireInitialMutationBaselineAbsence);
                }finally{first.close();Files.delete(file);Files.delete(dir);Arrays.fill(original,(byte)0);}
            }
        }finally{Files.delete(root);if(Files.exists(moved))Files.delete(moved);}
    }
    @Test public void FIRST_RETENTION_sameReservationRetainsWithoutGap()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            var lease=store.acquireInitialMutationBaselineAbsence();
            try{
                f.commit();var capsule=saved(f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
                try(var namespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                    var values=f.x.f.values(f.h.g,namespaces);
                    var semantics=f.x.f.join(values);
                    var layout=f.x.layout(semantics);
                    var owner=f.engine().inspectOriginalPrivateCustody(layout,f.store);
                    var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                    frame.requireFirstOriginalReservation(lease);
                    int[] writes={0};Object[] normal={null};
                    normal[0]=writer(store,candidate->{
                        writes[0]++;assertThrows(VaultFailure.class,other::acquireInitialMutationBaselineAbsence);
                        assertThrows(VaultFailure.class,()->other.prepareOriginal(frame));
                        assertThrows(VaultFailure.class,()->other.inspectOriginal(frame));
                        assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));
                        lease.close();assertThrows(VaultFailure.class,()->other.prepareOriginal(frame));
                        var method=normal[0].getClass().getDeclaredMethod("write",NativePrivateCustodyOperationStore.Existing.class);method.setAccessible(true);
                        try{method.invoke(normal[0],candidate);}catch(java.lang.reflect.InvocationTargetException failure){throw(Exception)failure.getCause();}
                    });
                    try(var retained=lease.retainFirstOriginal(frame)){
                        assertEquals("COMMITTED",retained.metadata().getString("journal_phase"));assertEquals(1,writes[0]);
                        String id=retained.metadata().getString("operation_id"),sha=retained.metadata().getString("journal_record_sha256");
                        try(var recovered=f.engine().recoverOriginalPrivateCustodyOperation(frame,other)){
                            var projection=recovered.projection();noAuthority(projection);
                            assertEquals(id,projection.getString("operation_id"));assertEquals(sha,projection.getString("journal_record_sha256"));
                        }
                        var files=saved(f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY));
                        assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));lease.close();same(files,f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY));
                    }
                }same(capsule,f.dir);stable.check();
            }finally{lease.close();}
        }
    }
    @Test public void FIRST_RETENTION_foreignAndClosedFrameRefuse()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            var lease=store.acquireInitialMutationBaselineAbsence();Path foreign=initialBaselineAbsenceRoot();
            try{
                f.commit();var capsule=saved(f.dir);
                try(var namespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                    var values=f.x.f.values(f.h.g,namespaces);
                    var semantics=f.x.f.join(values);
                    var layout=f.x.layout(semantics);
                    var owner=f.engine().inspectOriginalPrivateCustody(layout,f.store);
                    var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                    var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(foreign.toFile());
                    var wrong=other.acquireInitialMutationBaselineAbsence();Path fakePresence=foreign.resolve(NativePrivateCapsuleFileStore.DIRECTORY);
                    try{
                        // Exact synthetic ciphertext copied into another root
                        // still cannot change the frame's actual owning store.
                        Files.createDirectory(fakePresence,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                        for(var entry:capsule.entrySet()){
                            byte[] bytes=entry.getValue();writeFault(fakePresence.resolve(entry.getKey()),bytes,bytes.length,true);
                            assertArrayEquals(bytes,Files.readAllBytes(fakePresence.resolve(entry.getKey())));
                        }
                        assertThrows(VaultFailure.class,()->wrong.retainFirstOriginal(frame));wrong.close();
                        assertFalse(Files.exists(foreign.resolve(NativePrivateCustodyOperationStore.DIRECTORY)));
                    }finally{
                        wrong.close();for(String name:capsule.keySet())Files.deleteIfExists(fakePresence.resolve(name));Files.delete(fakePresence);
                    }
                    frame.close();assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));
                    assertFalse(Files.exists(f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY)));
                }same(capsule,f.dir);
            }finally{lease.close();Files.delete(foreign);}
        }
    }
    @Test public void FIRST_RETENTION_changedCurrentnessPreservesCapsule()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());var lease=store.acquireInitialMutationBaselineAbsence();
            try{
                f.commit();var capsule=saved(f.dir);
                try(var namespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                    var values=f.x.f.values(f.h.g,namespaces);
                    var semantics=f.x.f.join(values);
                    var layout=f.x.layout(semantics);
                    var owner=f.engine().inspectOriginalPrivateCustody(layout,f.store);
                    var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                    var source=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");source.put("first-retain-withdrawal","synthetic original source changed");
                    try{assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));assertFalse(Files.exists(f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY)));}
                    finally{source.remove("first-retain-withdrawal");}
                    assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));same(capsule,f.dir);
                }
            }finally{lease.close();}
        }
    }
    @Test public void FIRST_RETENTION_partialUnknownNeverReplacesOriginal()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());var lease=store.acquireInitialMutationBaselineAbsence();
            try{
                f.commit();var capsule=saved(f.dir);
                try(var namespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                    var values=f.x.f.values(f.h.g,namespaces);
                    var semantics=f.x.f.join(values);
                    var layout=f.x.layout(semantics);
                    var owner=f.engine().inspectOriginalPrivateCustody(layout,f.store);
                    var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                    var candidate=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();int[] writes={0};
                    Path dir=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY),pending=dir.resolve(NativePrivateCustodyOperationStore.PENDING);
                    writer(store,original->{candidate.set(original);writes[0]++;byte[] bytes=encoded(original);
                        try{writeFault(pending,bytes,17,true);}finally{Arrays.fill(bytes,(byte)0);}throw new java.io.IOException("synthetic first-original partial outcome");});
                    assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));lease.close();
                    byte[] original=encoded(candidate.get());
                    try{
                        var files=saved(dir);var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
                        assertThrows(VaultFailure.class,()->lease.retainFirstOriginal(frame));
                        assertThrows(VaultFailure.class,store::acquireInitialMutationBaselineAbsence);
                        assertThrows(VaultFailure.class,()->other.prepareOriginal(frame));assertThrows(VaultFailure.class,()->other.inspectOriginal(frame));
                        same(files,dir);same(capsule,f.dir);assertEquals(1,writes[0]);
                        byte[] retained=encoded(candidate.get());
                        try{assertArrayEquals(original,retained);}finally{Arrays.fill(retained,(byte)0);}
                        assertFalse(Files.exists(dir.resolve(NativePrivateCustodyOperationStore.COMMITTED)));
                    }finally{Arrays.fill(original,(byte)0);}
                }
            }finally{lease.close();}
        }
    }
    private static Path initialBaselineAbsenceRoot()throws Exception {
        String parent=System.getProperty("custodial.custody.fixture.root");if(parent==null)throw new AssertionError("owned fixture required");
        return Files.createTempDirectory(Path.of(parent),"initial-absence-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
    }
    @Test public void INITIAL_BASELINE_ABSENCE_privateSourceLeaseSerializesWithoutFiles()throws Exception {
        Path root=initialBaselineAbsenceRoot();
        try{
            var owner=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var first=owner.acquireInitialMutationBaselineAbsence();
            try{first.requireCurrent();assertThrows(VaultFailure.class,other::acquireInitialMutationBaselineAbsence);first.requireCurrent();
                try(var files=Files.list(root)){assertEquals(0,files.count());}
            }finally{first.close();}
            assertThrows(VaultFailure.class,first::requireCurrent);
            try(var next=other.acquireInitialMutationBaselineAbsence()){next.requireCurrent();first.close();next.requireCurrent();}
            try(var files=Files.list(root)){assertEquals(0,files.count());}
        }finally{Files.delete(root);}
    }
    @Test public void INITIAL_BASELINE_ABSENCE_anyOriginalPresenceRemainsRetained()throws Exception {
        for(String domain:new String[]{NativePrivateCustodyOperationStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
            VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY})for(String name:new String[]{"empty",NativePrivateCustodyOperationStore.COMMITTED,NativePrivateCustodyOperationStore.PENDING,"unknown-original"}){
            Path root=initialBaselineAbsenceRoot(),directory=root.resolve(domain);
            byte[] original="HOST_SYNTHETIC_ORIGINAL_NEVER_A_CREDENTIAL".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try{
                Files.createDirectory(directory);Path file=directory.resolve(name);
                if(!name.equals("empty"))Files.write(file,original);
                var owner=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
                assertThrows(VaultFailure.class,owner::acquireInitialMutationBaselineAbsence);
                if(!name.equals("empty")){assertArrayEquals(original,Files.readAllBytes(file));Files.delete(file);}
            }finally{Files.delete(directory);Files.delete(root);}
        }
    }
    @Test public void INITIAL_BASELINE_ABSENCE_changedRootOrCreatedDirectoryRefuses()throws Exception {
        Path root=initialBaselineAbsenceRoot(),moved=root.resolveSibling(root.getFileName()+"-original");
        try{
            var owner=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            try(var lease=owner.acquireInitialMutationBaselineAbsence()){
                Path directory=root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);Files.createDirectory(directory);
                assertThrows(VaultFailure.class,lease::requireCurrent);Files.delete(directory);
                assertThrows(VaultFailure.class,lease::requireCurrent); // Absence cannot thaw an observed change.
            }
            try(var lease=owner.acquireInitialMutationBaselineAbsence()){
                Files.move(root,moved);Files.createDirectory(root);
                assertThrows(VaultFailure.class,lease::requireCurrent);
            }
        }finally{Files.delete(root);if(Files.exists(moved))Files.delete(moved);}
    }
    /** Actual Engine source token, Android registry and fixed all8 readers.
     * Separate JVM per registry case; never reset production static ownership. */
    static final class DurableJoinFixture implements AutoCloseable {
        final NativeRetainedNamespaceSemanticJoinTest.Fixture source=new NativeRetainedNamespaceSemanticJoinTest.Fixture();
        final VaultEngine engine=source.engine();
        final Map<String,NativeProtectedNamespaceObservation.Store> readers;
        final VaultEngine.NativeRetainedGenerationObservation generation;
        final NativeProtectedNamespaceObservation namespaces;
        final VaultEngine.NativeRetainedNamespaceValueObservation values;
        final VaultEngine.NativeOriginalMutationEpochBootstrap token;
        final Path root,dir;
        NativePrivateMutationEpochStore journal;int batchEditors;
        Runnable beforeBatchEditor=()->{};
        java.util.function.Consumer<String> onRead=name->{};
        DurableJoinFixture()throws Exception{this(false);}
        DurableJoinFixture(boolean differentOriginal)throws Exception {
            var batch=source.x.f.batch;var backing=batch.root.preferences();
            android.content.SharedPreferences counted=(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
                getClass().getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                    if(method.getName().equals("edit")){beforeBatchEditor.run();batchEditors++;}
                    try{return method.invoke(backing,args);}catch(java.lang.reflect.InvocationTargetException failed){throw failed.getCause();}
                });
            batch.journal=new AndroidRetainedBatchStore(counted,batch.indexCipher,(query,index)->{
                String domain=AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index;
                return batch.domains.computeIfAbsent(domain,NativeRetainedBatchOwnerTest.DomainCipher::new);
            },batch.old.journal,batch.queryZero).journal();
            try(var original=source.x.f.generation();var prepared=source.x.f.prepare(original)){assertNotNull(batch.journal.observe());}
            if(differentOriginal)source.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("different-original-source","retained source binding");
            Map<String,android.content.SharedPreferences> existing=new java.util.TreeMap<>();
            for(String name:source.x.unknown.keySet())existing.put(name,(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
                getClass().getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                    if(!method.getName().equals("getAll"))throw new AssertionError("reader edited preferences");
                    onRead.accept(name);return new java.util.HashMap<>(source.x.raw(name));
                }));
            readers=AndroidProtectedNamespaceReaders.bind(existing);
            generation=source.x.f.generation();namespaces=NativeProtectedNamespaceObservation.observe(readers);
            values=source.values(generation,namespaces);token=engine.prepareOriginalMutationEpochBootstrap(values);
            String parent=System.getProperty("custodial.custody.fixture.root");if(parent==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(parent),"durable-join-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            dir=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
        }
        void bootstrap()throws Exception {synchronized(engine){journal=NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(root.toFile(),token);}}
        void install()throws Exception {
            bootstrap();synchronized(engine){var current=journal.readCurrent();boolean transferred=false;
                try{AndroidProtectedWorkPreferences.bindOriginalMutationEpochJournal(journal,current,token);transferred=true;}
                finally{if(!transferred)current.close();}}
        }
        long counter()throws Exception{try(var current=journal.readCurrent()){return current.counter();}}
        Map<String,Map<String,Object>> raw(){var all=new java.util.TreeMap<String,Map<String,Object>>();for(String name:source.x.unknown.keySet())all.put(name,new java.util.HashMap<>(source.x.raw(name)));return all;}
        void reaffirm()throws Exception{try(var original=source.x.f.generation();var batch=source.x.f.prepare(original)){assertNotNull(batch);}}
        @Override public void close(){token.close();values.close();namespaces.close();generation.close();source.x.f.preserved();}
    }
    // Actual closed production parser; these synthetic cleartext rows are NOT
    // encrypted operation/frame provenance or admissions.
    private static JSONObject stampBody(String stamp)throws Exception {
        return new JSONObject().put("schema",NativePrivateCustodyOperationStore.SCHEMA)
            .put("operation_id",NativeSeparationContextTest.id(110)).put("frame_sha256","a".repeat(64)).put("frame_bytes","64")
            .put("record_sha256","b".repeat(64)).put("proof_wire_sha256","c".repeat(64)).put("owner_binding_sha256","d".repeat(64))
            .put("principal_digest","e".repeat(64)).put("original_generation_id",NativeSeparationContextTest.id(111)).put("engine_revision","1")
            .put("original_frozen_work_sha256","f".repeat(64)).put("original_native_mutation_stamp",stamp);
    }
    private static JSONObject checkedStampBody(String text,JSONObject binding)throws Exception {
        var method=NativePrivateCustodyOperationStore.class.getDeclaredMethod("originalBody",binding==null?new Class<?>[]{String.class}:new Class<?>[]{String.class,JSONObject.class});
        method.setAccessible(true);try{return(JSONObject)(binding==null?method.invoke(null,text):method.invoke(null,text,binding));}
        catch(java.lang.reflect.InvocationTargetException failure){throw(Exception)failure.getCause();}
    }
    private static JSONObject stampBinding(JSONObject original)throws Exception {
        JSONObject binding=new JSONObject(original.toString());binding.remove("schema");binding.remove("operation_id");return binding;
    }
    @Test public void OPERATION_STAMP_closedOriginalSchemaAndLegacyRefusal()throws Exception {
        for(String stamp:new String[]{"PROCESS_ONLY","DURABLE_ATTEMPT:0","DURABLE_ATTEMPT:1","DURABLE_ATTEMPT:9223372036854775807"}){
            var original=stampBody(stamp);String text=original.toString();
            assertEquals(text,checkedStampBody(text,null).toString());assertEquals(text,checkedStampBody(text,stampBinding(original)).toString());
        }
        for(Object stamp:new Object[]{"","PROCESS_ONLY ","process_only","DURABLE_ATTEMPT:","DURABLE_ATTEMPT:-1","DURABLE_ATTEMPT:+1",
            "DURABLE_ATTEMPT:01","DURABLE_ATTEMPT:9223372036854775808","DURABLE_ATTEMPT:1.0",1,JSONObject.NULL}){
            var original=stampBody("PROCESS_ONLY").put("original_native_mutation_stamp",stamp);String text=original.toString();
            assertThrows(VaultFailure.class,()->checkedStampBody(text,null));assertThrows(VaultFailure.class,()->checkedStampBody(text,stampBinding(original)));assertEquals(text,original.toString());
        }
        for(String fault:new String[]{"legacy","legacyWithStamp","missing","extra","wrongFrame","wrongGeneration","wrongHash"}){
            var original=stampBody("DURABLE_ATTEMPT:1");
            if(fault.startsWith("legacy")){original.put("schema","custodial.native-private-eight-custody-operation.v1");if(fault.equals("legacy"))original.remove("original_native_mutation_stamp");}
            if(fault.equals("missing"))original.remove("original_native_mutation_stamp");
            if(fault.equals("extra"))original.put("accepted","true");
            if(fault.equals("wrongFrame"))original.put("frame_bytes","63");
            if(fault.equals("wrongGeneration"))original.put("original_generation_id","not-an-original-uuid");
            if(fault.equals("wrongHash"))original.put("frame_sha256","A".repeat(64));
            String text=original.toString();assertThrows(Exception.class,()->checkedStampBody(text,null));assertThrows(Exception.class,()->checkedStampBody(text,stampBinding(original)));assertEquals(text,original.toString());
        }
    }
    @Test public void OPERATION_STAMP_actualCapturedStampBindsSourceOnlyRecord()throws Exception {
        try(var x=new DurableJoinFixture()){
            var raw=x.raw();String original=x.namespaces.originalMutationStampForOwningOperation();assertEquals("PROCESS_ONLY",original);
            var processRow=stampBody(original);String first=processRow.toString();assertEquals(first,checkedStampBody(first,stampBinding(processRow)).toString());
            x.install();assertEquals(raw,x.raw());assertThrows(VaultFailure.class,x.namespaces::originalMutationStampForOwningOperation);
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                String captured=observed.originalMutationStampForOwningOperation();assertEquals("DURABLE_ATTEMPT:0",captured);
                var durableRow=stampBody(captured);String body=durableRow.toString();assertEquals(body,checkedStampBody(body,stampBinding(durableRow)).toString());
                assertThrows(VaultFailure.class,()->checkedStampBody(first,stampBinding(durableRow)));
                x.reaffirm();assertEquals(raw,x.raw());assertThrows(VaultFailure.class,observed::originalMutationStampForOwningOperation);
                try(var later=NativeProtectedNamespaceObservation.observe(x.readers)){
                    String next=later.originalMutationStampForOwningOperation();assertEquals("DURABLE_ATTEMPT:2",next);
                    var changed=stampBinding(durableRow).put("original_native_mutation_stamp",next);
                    assertThrows(VaultFailure.class,()->checkedStampBody(body,changed));assertEquals(body,durableRow.toString());
                }
            }
        }
    }
    @Test public void OPERATION_STAMP_normalFrameFixturePrerequisite()throws Exception {
        // Deliberately does NOT convert a missing current platform-key fixture
        // into PASS. No compatibility adapter or forged frame is substituted.
        try(var x=new Fixture(true)){
            var binding=x.frame.operationBindingForFixedJournal();
            String parsed=new JSONObject(binding.toString()).put("schema",NativePrivateCustodyOperationStore.SCHEMA)
                .put("operation_id",NativeSeparationContextTest.id(112)).toString();
            checkedStampBody(parsed,binding); // exact owning frame shape before encryption
            try(var original=x.prepare()){
            String stamp=original.projection().getString("original_native_mutation_stamp");
            assertTrue(stamp.equals("PROCESS_ONLY")||stamp.startsWith("DURABLE_ATTEMPT:"));
            var before=saved(x.dir);
            try(var recovered=x.recover()){
                assertEquals(original.projection().getString("operation_id"),recovered.projection().getString("operation_id"));
                assertEquals(original.projection().getString("journal_record_sha256"),recovered.projection().getString("journal_record_sha256"));
            }
            same(before,x.dir);
            }
        }
    }
    private static Fixture unitFixture(boolean originalBatch)throws Exception {
        if(!originalBatch)return new Fixture(true);
        String property="custodial.fixture.original-batch-before-capture",previous=System.getProperty(property);
        try{System.setProperty(property,"true");return new Fixture(true);}
        finally{if(previous==null)System.clearProperty(property);else System.setProperty(property,previous);}
    }
    private static Fixture durableUnitFixtureWithoutInitialFrame()throws Exception {
        String property="custodial.fixture.original-batch-before-capture",previous=System.getProperty(property);
        try{System.setProperty(property,"true");return new Fixture(true,true);}
        finally{if(previous==null)System.clearProperty(property);else System.setProperty(property,previous);}
    }
    private static void installUnitBaseline(Fixture x)throws Exception {
        try(var token=x.f.engine().prepareOriginalMutationEpochBootstrap(x.guardedValues)){
            synchronized(x.f.engine()){
                var journal=NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(x.f.root.toFile(),token);
                var current=journal.readCurrent();boolean installed=false;
                try{AndroidProtectedWorkPreferences.bindOriginalMutationEpochJournal(journal,current,token);installed=true;}
                finally{if(!installed)current.close();}
            }
        }
    }
    // FIRST-only host construction: the real root absence reservation remains
    // held through bootstrap, fresh reconstruction and the one original write.
    // No saved PROCESS_ONLY operation/capsule may enter this setup.
    private static void installFirstUnitBaseline(Fixture x,
        VaultEngine.NativeRetainedNamespaceValueObservation values,
        NativePrivateCustodyOperationStore.InitialMutationBaselineAbsence absence,
        NativePrivateCustodyFrameReadControl control)throws Exception {
        var engine=x.f.engine();
        if(!Thread.holdsLock(engine))throw new AssertionError("original Engine monitor required");
        control.check();absence.requireCurrent();AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        try(var token=engine.prepareOriginalMutationEpochBootstrap(values)){
            var journal=NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(x.f.root.toFile(),token,control);
            control.check();absence.requireCurrent();
            var current=journal.readCurrent();boolean transferred=false;
            try{
                if(current.counter()!=0)throw new AssertionError("first original durable counter differs");
                control.check();absence.requireCurrent();
                AndroidProtectedWorkPreferences.bindOriginalMutationEpochJournal(journal,current,token);transferred=true;
            }finally{if(!transferred)current.close();}
            control.check();absence.requireCurrent();
        }
    }
    private static Map<String,NativeProtectedNamespaceObservation.Store> owningBoundGuardedReaders(
        NativeRetainedNamespaceSemanticJoinTest.Fixture source)throws Exception {
        if(source.boundVaultPreferences==null||source.boundWorkPreferences==null)
            throw new AssertionError("original bound host preferences required");
        var existing=new java.util.TreeMap<String,android.content.SharedPreferences>();
        for(String name:source.x.unknown.keySet()){
            if(name.equals(NativeVaultProviderReferenceCensus.VAULT))existing.put(name,source.boundVaultPreferences);
            else if(name.equals(NativeRetainedNamespaceCensus.WORK))existing.put(name,source.boundWorkPreferences);
            else existing.put(name,(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
                NativePrivateCustodyOperationTest.class.getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                    if(!method.getName().equals("getAll"))throw new AssertionError("guarded original reader edited source");
                    return new java.util.HashMap<>(source.x.raw(name));
                }));
        }
        return AndroidProtectedNamespaceReaders.bind(existing);
    }
    /** Uses the actual original generation selector and fixed guarded readers,
     * not an arbitrary caller stamp/actor/acceptance or replacement frame. */
    private static final class UnitReconstruction implements AutoCloseable {
        private static int sequence;
        private static void step(int attempt,String stage,long start){
            System.out.println("JCE_UNIT_RECONSTRUCTION attempt="+attempt+" stage="+stage+" elapsed_nanos="+(System.nanoTime()-start));
        }
        private static void buffers(int attempt,String name,java.util.List<char[]> reads){
            int live=0,zero=0;long characters=0;
            for(char[] value:reads){
                if(value==null)continue;live++;characters+=value.length;
                boolean wiped=true;for(char c:value)if(c!='\0'){wiped=false;break;}
                if(wiped)zero++;
            }
            System.out.println("JCE_UNIT_RECONSTRUCTION_BUFFERS attempt="+attempt+" collector="+name+" slots="+reads.size()+" live_arrays="+live+" live_characters="+characters+" verified_zero_arrays="+zero);
        }
        VaultEngine.NativeRetainedGenerationObservation generation;
        NativeProtectedNamespaceObservation namespaces;
        VaultEngine.NativeRetainedNamespaceValueObservation values;
        VaultEngine.NativeRetainedNamespaceSemanticObservation semantics;
        VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation layout;
        VaultEngine.NativePrivateCustodyObservation owner;
        VaultEngine.NativePrivateCustodyTransportFrame frame;
        UnitReconstruction(Fixture x,String originalGeneration)throws Exception {
            this(x,originalGeneration,null,null);
        }
        private UnitReconstruction(Fixture x,String originalGeneration,
            NativePrivateCustodyOperationStore.InitialMutationBaselineAbsence first,
            NativePrivateCustodyFrameReadControl control)throws Exception {
            var source=x.f.x.f.x;var old=source.f.batch.old;var engine=x.f.engine();
            int attempt=++sequence;long started=System.nanoTime();
            step(attempt,"begin",started);
            buffers(attempt,"vault",old.vaultCipher.reads);buffers(attempt,"work",old.workCipher.reads);buffers(attempt,"query",source.queryCipher.clearReads);
            try{
                step(attempt,"original_generation_begin",started);
                generation=engine.observeOriginalNativeRetainedGeneration(old.work,old.principal,null,
                    new NativeProviderJournal(source.f.store.store(),source.f.store.lock),originalGeneration);
                step(attempt,"original_generation_done",started);
                step(attempt,"guarded_readers_begin",started);
                var readers=first==null?owningGuardedReaders(source):owningBoundGuardedReaders(x.f.x.f);
                step(attempt,"guarded_readers_done",started);
                step(attempt,"namespaces_begin",started);
                namespaces=NativeProtectedNamespaceObservation.observe(readers);
                step(attempt,"namespaces_done",started);
                step(attempt,"values_begin",started);
                values=engine.observeOriginalRetainedNamespaceValues(generation,namespaces);
                step(attempt,"values_done",started);
                step(attempt,"semantics_begin",started);
                semantics=engine.inspectOriginalRetainedNamespaceSemantics(values,source.f.batch.journal);
                step(attempt,"semantics_done",started);
                step(attempt,"layout_begin",started);
                layout=engine.inspectOriginalRetainedNamespaceCustodyLayout(semantics);
                step(attempt,"layout_done",started);
                step(attempt,"capsule_begin",started);
                if(first==null)owner=engine.inspectOriginalPrivateCustody(layout,x.f.store);
                else{
                    control.check();first.requireCurrent();
                    if(!"DURABLE_ATTEMPT:0".equals(namespaces.originalMutationStampForOwningOperation()))
                        throw new AssertionError("fresh durable original observation required");
                    try(var candidate=engine.prepareOriginalRetainedNamespacePrivateCapsule(layout)){
                        control.check();first.requireCurrent();
                        owner=engine.retainOriginalPrivateCustody(candidate,x.f.store,control);
                    }
                    control.check();
                }
                step(attempt,"capsule_done",started);
                step(attempt,"frame_begin",started);
                frame=engine.prepareOriginalPrivateCustodyTransportFrame(owner);
                if(first!=null){control.check();frame.requireFirstOriginalReservation(first);}
                step(attempt,"frame_done",started);
                buffers(attempt,"vault",old.vaultCipher.reads);buffers(attempt,"work",old.workCipher.reads);buffers(attempt,"query",source.queryCipher.clearReads);
            }catch(Exception failure){close();throw failure;}
            catch(Error failure){if(first!=null)close();throw failure;}
        }
        @Override public void close(){
            if(frame!=null)frame.close();if(owner!=null)owner.close();if(layout!=null)layout.close();
            if(semantics!=null)semantics.close();if(values!=null)values.close();if(namespaces!=null)namespaces.close();if(generation!=null)generation.close();
        }
    }
    @Test public void OPERATION_UNIT_encryptedFreshReopenKeepsExactOriginal()throws Exception {
        try(var x=unitFixture(false);var original=x.prepare()){
            var before=saved(x.dir);var capsule=saved(x.f.dir);var p=original.projection();noAuthority(p);
            assertEquals("PROCESS_ONLY",p.getString("original_native_mutation_stamp"));
            var fresh=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
            try(var hint=fresh.inspectSavedIdentityHint();var current=new UnitReconstruction(x,hint.generationForOwningEngine());
                var recovered=x.f.engine().recoverOriginalPrivateCustodyOperation(current.frame,fresh)){
                var q=recovered.projection();noAuthority(q);assertEquals(p.getString("operation_id"),q.getString("operation_id"));
                assertEquals(p.getString("journal_record_sha256"),q.getString("journal_record_sha256"));
                assertEquals(p.getString("frame_sha256"),q.getString("frame_sha256"));assertEquals(p.getString("original_generation_id"),q.getString("original_generation_id"));
                fresh.requireSavedIdentityHintCurrent(hint);
            }same(before,x.dir);same(capsule,x.f.dir);
        }
    }
    @Test public void OPERATION_UNIT_processOnlyBaselineCannotAdoptOldOperation()throws Exception {
        try(var x=unitFixture(false);var original=x.prepare()){
            var before=saved(x.dir);var capsule=saved(x.f.dir);String originalFrame=original.projection().getString("frame_sha256");
            installUnitBaseline(x);assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            denied(x::recover);
            try(var hint=x.store.inspectSavedIdentityHint();var current=new UnitReconstruction(x,hint.generationForOwningEngine())){
                assertEquals(originalFrame,current.frame.metadata().getString("frame_sha256"));
                assertEquals("DURABLE_ATTEMPT:0",current.frame.operationBindingForFixedJournal().getString("original_native_mutation_stamp"));
                denied(()->x.f.engine().recoverOriginalPrivateCustodyOperation(current.frame,x.store));
                denied(()->x.f.engine().prepareOriginalPrivateCustodyOperation(current.frame,x.store));
            }same(before,x.dir);same(capsule,x.f.dir);
        }
    }
    private static void requireSameByteOriginalRecommit(NativeRetainedNamespaceCensusTest.Stable before){
        var owner=before.owner;var f=owner.f;
        for(String name:before.raw.keySet())assertEquals(name,before.raw.get(name),owner.raw(name));
        assertEquals(before.workCommits+1,f.batch.old.workDisk.commits);
        assertEquals(before.batchCommits+1,f.batch.root.commits);
        assertEquals(before.ids,f.batch.ids);assertEquals(before.opened,f.batch.old.opened);
        assertEquals(before.writeCommits,f.batch.old.journalDisk.commits);
        assertEquals(before.queryCommits,f.batch.queryZeroDisk.commits);assertEquals(before.providerCommits,f.store.memory.commits);
        assertEquals(before.indexEncrypts,f.batch.indexCipher.encrypts);assertEquals(before.queryEncrypts,owner.queryCipher.encrypts);owner.queryCipher.wiped();
        assertEquals(before.writeEncrypts,f.batch.old.journalCipher.existing);
        for(var row:f.batch.domains.entrySet())assertEquals((int)before.domainEncrypts.getOrDefault(row.getKey(),0),row.getValue().encrypts);
    }
    @Test public void OPERATION_UNIT_durableChangeWithSameRawRefusesOldOperation()throws Exception {
        long started=System.nanoTime();
        // Existing production coordination budget, not a clock/profile or
        // signing/acceptance capability. Earlier 60-second harness failures
        // remain failures; no production timeout is changed here.
        try(var control=new NativePrivateCustodyFrameReadControl()){
        control.check();
        System.out.println("JCE_UNIT_STAGE fixture_begin");
        try(var x=durableUnitFixtureWithoutInitialFrame()){
            control.check();
            System.out.println("JCE_UNIT_STAGE fixture_ready");
            assertNull(x.frame);
            // guardedValues was captured from this SAME owning generation.
            // Its validated original witness, not a throwaway signed frame,
            // supplies the unchanged original generation before bootstrap.
            String generation=x.f.h.g.projection().getString("generation_id");control.check();installUnitBaseline(x);control.check();
            System.out.println("JCE_UNIT_STAGE baseline_ready");
            try(var zero=new UnitReconstruction(x,generation);var original=x.f.engine().prepareOriginalPrivateCustodyOperation(zero.frame,x.store)){
                control.check();
                System.out.println("JCE_UNIT_STAGE zero_operation_ready");
                var p=original.projection();noAuthority(p);assertEquals("DURABLE_ATTEMPT:0",p.getString("original_native_mutation_stamp"));
                control.check();
                var before=saved(x.dir);var capsule=saved(x.f.dir);var source=x.f.x.f.x;var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
                // prepareOriginalPrivateCustodyOperation already returned a
                // committed, owning-validated zero-stamp original above. Exact
                // same-stamp fresh reopen is separately qualified; do not repeat
                // that unchanged graph before the participating writer here.
                System.out.println("JCE_UNIT_STAGE typed_commit_begin");
                control.check();
                try(var current=source.f.generation();var batch=source.f.prepare(current)){assertNotNull(batch);}
                assertEquals("DURABLE_ATTEMPT:2",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());requireSameByteOriginalRecommit(stable);
                control.check();
                System.out.println("JCE_UNIT_STAGE typed_commit_complete");
                assertThrows(VaultFailure.class,zero.frame::metadata);
                control.check();
                System.out.println("JCE_UNIT_STAGE new_capture_begin");
                try(var hint=x.store.inspectSavedIdentityHint();var next=new UnitReconstruction(x,hint.generationForOwningEngine())){
                    control.check();
                    System.out.println("JCE_UNIT_STAGE new_capture_ready");
                    assertEquals(p.getString("frame_sha256"),next.frame.metadata().getString("frame_sha256"));
                    assertEquals("DURABLE_ATTEMPT:2",next.frame.operationBindingForFixedJournal().getString("original_native_mutation_stamp"));
                    control.check();
                    System.out.println("JCE_UNIT_STAGE fixed_read_begin");
                    denied(()->x.f.engine().recoverOriginalPrivateCustodyOperation(next.frame,x.store));
                    control.check();
                    System.out.println("JCE_UNIT_STAGE fixed_read_refused");
                    denied(()->x.f.engine().prepareOriginalPrivateCustodyOperation(next.frame,x.store));
                    control.check();
                    System.out.println("JCE_UNIT_STAGE fixed_prepare_refused");
                }same(before,x.dir);same(capsule,x.f.dir);requireSameByteOriginalRecommit(stable);
                control.check();
                System.out.println("JCE_UNIT_STAGE originals_preserved");
            }
        }
        control.check();
        System.out.println("JCE_UNIT_STAGE final_control_check_passed");
        }finally{System.out.println("JCE_UNIT_TOTAL_ELAPSED_NANOS "+(System.nanoTime()-started));}
    }
    @Test public void CAPSULE_INSPECT_changedExistingKeyRefusesFreshRead()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();var files=saved(f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);
            denied(f::inspect);same(files,f.dir);stable.check();
        }
    }
    @Test public void CAPSULE_INSPECT_changedOriginalRawRefusesFreshRead()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();var files=saved(f.dir);
            f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("capsule-inspect-source-change","synthetic retained changed raw");
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            denied(f::inspect);same(files,f.dir);stable.check();
        }
    }
    @Test public void CAPSULE_INSPECT_changedCapsuleWithValidChecksumRefusesFreshRead()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            Path preserved=f.root.resolve("synthetic-preserved-original-capsule.bin");Files.copy(f.committed,preserved);
            byte[] original=Files.readAllBytes(preserved),changed=original.clone();byte[] checksum=null;
            try{
                changed[changed.length-33]^=1;
                var digest=java.security.MessageDigest.getInstance("SHA-256");digest.update(changed,0,changed.length-32);checksum=digest.digest();
                System.arraycopy(checksum,0,changed,changed.length-32,32);Files.write(f.committed,changed);
                // The outer checksum is valid, but is not same-key original
                // capsule authentication or an owning read capability.
                try(var record=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(changed)){assertNotNull(record.metadata());}
                var files=saved(f.dir);denied(f::inspect);same(files,f.dir);stable.check();
                assertArrayEquals(original,Files.readAllBytes(preserved));assertArrayEquals(changed,Files.readAllBytes(f.committed));
            }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);if(checksum!=null)Arrays.fill(checksum,(byte)0);}
        }
    }
    @Test public void FRAME_INSPECT_changedExistingKeyRefusesStaleOwnerAndMetadata()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                var files=saved(f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
                NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);
                denied(frame::metadata);denied(()->{try(var refused=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){}});
                same(files,f.dir);stable.check();
            }
        }
    }
    @Test public void FRAME_INSPECT_changedOriginalRawRefusesStaleOwnerAndMetadata()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                var files=saved(f.dir);
                f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("frame-inspect-source-change","synthetic retained changed raw");
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
                denied(frame::metadata);denied(()->{try(var refused=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){}});
                same(files,f.dir);stable.check();
            }
        }
    }
    @Test public void FRAME_INSPECT_changedFixedCapsuleRefusesStaleOwnerAndMetadata()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
                Path preserved=f.root.resolve("synthetic-preserved-frame-capsule.bin");Files.copy(f.committed,preserved);
                byte[] original=Files.readAllBytes(preserved),changed=original.clone();byte[] checksum=null;
                try{
                    changed[changed.length-33]^=1;var digest=java.security.MessageDigest.getInstance("SHA-256");
                    digest.update(changed,0,changed.length-32);checksum=digest.digest();System.arraycopy(checksum,0,changed,changed.length-32,32);
                    Files.write(f.committed,changed);var files=saved(f.dir);
                    denied(frame::metadata);denied(()->{try(var refused=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){}});
                    same(files,f.dir);stable.check();assertArrayEquals(original,Files.readAllBytes(preserved));
                    assertArrayEquals(changed,Files.readAllBytes(f.committed));
                }finally{Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);if(checksum!=null)Arrays.fill(checksum,(byte)0);}
            }
        }
    }
    @Test public void SIGNER_ID_keyChangeAfterImmutableLookupCannotAuthorizeSignature()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){
            f.commit();try(var owner=f.inspect();var proof=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)){
                var source=f.x.f.x.f.batch.old;
                char[] credential=source.vaultCipher.decrypt(source.persistence.current().secret);
                try{
                    String originalId=proof.credentialForFixedNativeSigner();NativeAttestation.requireStoredCredentialId(credential,originalId);
                    var files=saved(f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
                    NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);
                    // A preserved immutable ID is deliberately not currentness
                    // or permission to sign with this now-foreign key source.
                    assertEquals(originalId,proof.credentialForFixedNativeSigner());
                    denied(proof::messageForFixedNativeSigner);
                    denied(()->NativeAttestation.privateCustodyOwnerSignature(proof,credential));
                    same(files,f.dir);stable.check();
                    proof.close();denied(proof::credentialForFixedNativeSigner);
                }finally{VaultValidation.wipe(credential);}
            }
        }
    }
    @Test public void OPERATION_UNIT_legacyEncryptedOriginalIsHeldUnchanged()throws Exception {
        try(var x=unitFixture(false)){
            String operation;try(var original=x.prepare()){operation=original.projection().getString("operation_id");}
            JSONObject legacy=x.frame.operationBindingForFixedJournal();legacy.remove("original_native_mutation_stamp");
            legacy.put("schema","custodial.native-private-eight-custody-operation.v1").put("operation_id",operation);
            // SETUP of a synthetic prior encrypted original only. Recovery
            // itself must neither encrypt/reissue nor rewrite these bytes.
            String text=legacy.toString();char[] clear=text.toCharArray();byte[] bytes;
            try{
                var cipher=new AndroidKeystoreCipher(NativePrivateCustodyOperationStore.AAD,NativePrivateCustodyOperationStore.MAX_CLEAR);
                var secret=cipher.encryptWithExistingKey(clear);var encode=NativePrivateCustodyOperationStore.class.getDeclaredMethod("encode",EncryptedSecret.class);encode.setAccessible(true);
                bytes=(byte[])encode.invoke(null,secret);char[] restored=cipher.decrypt(secret);
                try{assertEquals(text,new String(restored));}finally{VaultValidation.wipe(restored);}
            }finally{VaultValidation.wipe(clear);}
            Files.move(x.committed,x.f.root.resolve("synthetic-original-v2.bin"));writeFault(x.committed,bytes,bytes.length,true);Arrays.fill(bytes,(byte)0);
            var before=saved(x.dir);var capsule=saved(x.f.dir);String originalText=legacy.toString();
            assertThrows(Exception.class,()->checkedStampBody(originalText,null));denied(x.store::inspectSavedIdentityHint);denied(x::recover);denied(x::prepare);
            same(before,x.dir);same(capsule,x.f.dir);assertEquals(originalText,legacy.toString());
        }
    }
    @Test public void WORK_OBSERVATION_actualDurableInstallAndUnavailableCounterRefuse()throws Exception {
        try(var x=new DurableJoinFixture()){
            var work=new AndroidProtectedWorkPreferences(x.source.x.f.batch.old.workDisk.preferences());
            var raw=x.raw();long process=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            var before=work.observeReadOnly();assertTrue(work.matchesReadOnly(before));
            x.install();assertEquals(process,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());assertEquals(raw,x.raw());
            assertFalse("durable installation invalidates unchanged WORK observation",work.matchesReadOnly(before));
            var currentObservation=work.observeReadOnly();assertTrue(work.matchesReadOnly(currentObservation));
            try(var current=x.journal.readCurrent();var pending=x.journal.prepareNext(current)){
                var pendingBytes=saved(x.dir);
                assertThrows(VaultFailure.class,()->work.matchesReadOnly(currentObservation));
                assertThrows(IllegalStateException.class,work::observeReadOnly);same(pendingBytes,x.dir);
                assertEquals(process,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());assertEquals(raw,x.raw());
                try(var next=x.journal.commitPrepared(pending)){assertEquals(1,next.counter());}
                // The registry still owns the previous typed Current. No test
                // resets/adopts it; storage-only advancement remains unavailable.
                assertThrows(VaultFailure.class,()->work.matchesReadOnly(currentObservation));
                assertThrows(IllegalStateException.class,work::observeReadOnly);
            }
            assertEquals(process,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());assertEquals(raw,x.raw());
        }
    }
    @Test public void DURABLE_JOIN_originalSameByteCommitFollowsDurableCounter()throws Exception {
        try(var x=new DurableJoinFixture()){
            x.install();assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            var raw=x.raw();var batch=x.source.x.f.batch;int batchBefore=batch.root.commits,workBefore=batch.old.workDisk.commits,editors=x.batchEditors,ids=batch.ids;
            int[] effects={0};long[] last={0};Runnable beforeCommit=()->{try{
                assertEquals("counter is durable BEFORE actual preferences commit",last[0]+1,x.counter());last[0]=x.counter();effects[0]++;
            }catch(Exception error){throw new AssertionError(error);}};
            batch.root.beforeCommit=beforeCommit;batch.old.workDisk.afterCommit=beforeCommit::run;
            x.beforeBatchEditor=()->{try{assertEquals("durable counter before actual batch editor",last[0]+1,x.counter());}catch(Exception error){throw new AssertionError(error);}};
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                x.reaffirm();assertFalse(observed.stillCurrent());
            }
            assertEquals(batchBefore+1,batch.root.commits);assertEquals(workBefore+1,batch.old.workDisk.commits);
            assertEquals(editors+1,x.batchEditors);assertEquals(2,effects[0]);assertEquals(2,x.counter());assertEquals(ids,batch.ids);
            assertEquals(raw,x.raw());assertEquals("DURABLE_ATTEMPT:2",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        }
    }
    private void durableJoinFailure(boolean partial)throws Exception {
        try(var x=new DurableJoinFixture()){
            x.install();var raw=x.raw();var batch=x.source.x.f.batch;int commits=batch.root.commits,workCommits=batch.old.workDisk.commits,editors=x.batchEditors;
            long process=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            if(partial){var field=x.journal.getClass().getDeclaredField("pendingWriter");field.setAccessible(true);
                field.set(x.journal,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
                    byte[] bytes=(byte[])args[0];writeFault(x.dir.resolve(NativePrivateMutationEpochStore.PENDING),bytes,7,false);throw new java.io.IOException("synthetic partial counter");}));
            }else epochIo(x.journal,(operation,normal,args)->{if(operation.equals("forceFile"))throw new java.io.IOException("synthetic counter force unknown");epochNormalIo(normal,operation,args);});
            try(var observed=NativeProtectedNamespaceObservation.observe(x.readers)){
                denied(x::reaffirm);assertTrue(AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>process);
                assertFalse(observed.stillCurrent());assertThrows(VaultFailure.class,()->NativeProtectedNamespaceObservation.observe(x.readers));
            }
            assertEquals(commits,batch.root.commits);assertEquals(workCommits,batch.old.workDisk.commits);assertEquals(editors,x.batchEditors);assertEquals(raw,x.raw());
            assertTrue(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.PENDING)));var retained=saved(x.dir);
            assertThrows(VaultFailure.class,x.journal::readCurrent);same(retained,x.dir);
        }
    }
    @Test public void DURABLE_JOIN_forceFailureDeniesPreferences()throws Exception{durableJoinFailure(false);}
    @Test public void DURABLE_JOIN_partialFailureDeniesPreferences()throws Exception{durableJoinFailure(true);}
    @Test public void DURABLE_JOIN_closedTokenRefusesBeforeEffects()throws Exception {
        try(var x=new DurableJoinFixture()){
            x.bootstrap();var before=saved(x.dir);x.token.close();
            try(var current=x.journal.readCurrent()){synchronized(x.engine){denied(()->AndroidProtectedWorkPreferences.bindOriginalMutationEpochJournal(x.journal,current,x.token));}}
            assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());same(before,x.dir);
        }
    }
    @Test public void DURABLE_JOIN_foreignTokenRefusesRegistry()throws Exception {
        try(var original=new DurableJoinFixture()){
            original.bootstrap();var before=saved(original.dir);String originalDigest;
            synchronized(original.engine){originalDigest=original.token.originalValuesSha256();}
            try(var foreign=new DurableJoinFixture(true)){
            synchronized(foreign.engine){assertNotEquals(originalDigest,foreign.token.originalValuesSha256());
                try(var current=original.journal.readCurrent()){denied(()->AndroidProtectedWorkPreferences.bindOriginalMutationEpochJournal(original.journal,current,foreign.token));}
            }
            assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());same(before,original.dir);
            }
        }
    }
    @Test public void DURABLE_JOIN_secondInstallRefusesBeforeFiles()throws Exception {
        try(var x=new DurableJoinFixture()){
            x.install();var before=saved(x.dir);assertThrows(VaultFailure.class,()->x.engine.establishOriginalMutationEpochBaseline(null,x.values));
            same(before,x.dir);assertEquals("DURABLE_ATTEMPT:0",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        }
    }
    private static final class EpochBootstrapFixture implements AutoCloseable {
        final NativeRetainedNamespaceSemanticJoinTest.Fixture source=new NativeRetainedNamespaceSemanticJoinTest.Fixture();
        final VaultEngine engine=source.engine();
        final VaultEngine.NativeRetainedGenerationObservation generation=source.x.f.generation();
        final NativeProtectedNamespaceObservation namespaces=source.x.observe();
        final VaultEngine.NativeRetainedNamespaceValueObservation values=source.values(generation,namespaces);
        final VaultEngine.NativeOriginalMutationEpochBootstrap token=engine.prepareOriginalMutationEpochBootstrap(values);
        final Path root,dir;
        EpochBootstrapFixture()throws Exception {
            String parent=System.getProperty("custodial.custody.fixture.root");if(parent==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(parent),"epoch-bootstrap-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            dir=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
        }
        NativePrivateMutationEpochStore bootstrap()throws Exception {
            synchronized(engine){return NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(root.toFile(),token);}
        }
        @Override public void close(){token.close();values.close();namespaces.close();generation.close();source.x.f.preserved();}
    }
    @Test public void REATTACH_absentLegacyRootHasNoEffects()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            Files.setPosixFilePermissions(x.root,PosixFilePermissions.fromString("rwxr-xr-x"));
            Object key=Files.readAttributes(x.root,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            assertNull(NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));
            assertFalse(Files.exists(x.dir));
            assertEquals(key,Files.readAttributes(x.root,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            assertEquals(PosixFilePermissions.fromString("rwxr-xr-x"),Files.getPosixFilePermissions(x.root));
            try(var entries=Files.newDirectoryStream(x.root)){assertFalse(entries.iterator().hasNext());}
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(null));
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(new java.io.File("relative-root")));
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.resolve("missing-parent").toFile()));
        }
    }
    @Test public void REATTACH_progressedOriginalReopensExactCounter()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            var store=x.bootstrap();try(var original=store.readCurrent();var prepared=store.prepareNext(original);var next=store.commitPrepared(prepared)){assertEquals(1,next.counter());}
            var before=saved(x.dir);var keys=new java.util.HashMap<String,Object>();
            for(String name:before.keySet())keys.put(name,Files.readAttributes(x.dir.resolve(name),java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            var fresh=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());assertNotNull(fresh);
            try(var current=fresh.readCurrent()){assertEquals(1,current.counter());fresh.requireCurrent(current);}
            same(before,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),Files.readAttributes(x.dir.resolve(name),java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        }
    }
    @Test public void REATTACH_partialCorruptAndReplacedMetadataRefuse()throws Exception {
        for(String fault:new String[]{"empty","bootstrap","pending","corrupt","baseline","lock","unknown"})try(var x=new EpochBootstrapFixture()){
            if(fault.equals("empty"))Files.createDirectory(x.dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            else{
                x.bootstrap();
                if(fault.equals("bootstrap"))writeFault(x.dir.resolve(NativePrivateMutationEpochStore.BOOTSTRAP),new byte[64],64,true);
                else if(fault.equals("pending")){
                    var bytes=epochBytes(1);writeFault(x.dir.resolve(NativePrivateMutationEpochStore.PENDING),bytes,bytes.length,true);
                }else if(fault.equals("corrupt")){
                    Path path=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);byte[] bytes=Files.readAllBytes(path);bytes[50]^=1;Files.write(path,bytes);
                }else if(fault.equals("unknown"))writeFault(x.dir.resolve("foreign.bin"),new byte[]{1},1,true);
                else{
                    Path path=x.dir.resolve(fault.equals("baseline")?NativePrivateMutationEpochStore.BASELINE:NativePrivateMutationEpochStore.LOCK);
                    byte[] bytes=Files.readAllBytes(path);Files.move(path,x.root.resolve("original-"+fault));writeFault(path,bytes,bytes.length,true);
                }
            }
            var before=saved(x.dir);denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));same(before,x.dir);
        }
    }
    @Test public void REATTACH_parentSymlinkAndForeignRootRefuse()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            x.bootstrap();var before=saved(x.dir);
            Path link=x.root.resolveSibling(x.root.getFileName()+"-link");Files.createSymbolicLink(link,x.root);
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(link.toFile()));same(before,x.dir);
            Path foreign=x.root.resolveSibling(x.root.getFileName()+"-copy");Files.createDirectory(foreign,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            Path child=foreign.resolve(NativePrivateMutationEpochStore.DIRECTORY);Files.createSymbolicLink(child,x.dir);
            denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(foreign.toFile()));same(before,x.dir);
            Files.delete(child);Files.createDirectory(child,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            for(String name:before.keySet()){byte[] bytes=before.get(name);writeFault(child.resolve(name),bytes,bytes.length,true);}
            var copied=saved(child);denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(foreign.toFile()));same(copied,child);
            var observed=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
            Path previous=x.root.resolveSibling(x.root.getFileName()+"-original");Files.move(x.root,previous);
            Files.createDirectory(x.root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            Files.move(previous.resolve(NativePrivateMutationEpochStore.DIRECTORY),x.dir);
            denied(observed::readCurrent);denied(()->NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile()));same(before,x.dir);
        }
    }
    @Test public void REATTACH_currentReplacementObservationBoundary()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            x.bootstrap();var store=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
            try(var current=store.readCurrent()){
                Path path=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);byte[] bytes=Files.readAllBytes(path);
                Files.move(path,x.root.resolve("original-current"));writeFault(path,bytes,bytes.length,true);
                denied(()->store.requireCurrent(current));
                // No persistent original-current inode witness exists. A new
                // observation validates current storage, not historical identity.
                var fresh=NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(x.root.toFile());
                try(var newCurrent=fresh.readCurrent()){assertEquals(0,newCurrent.counter());}
                assertArrayEquals(bytes,Files.readAllBytes(path));
            }
        }
    }
    private interface BootstrapFault {Object apply(java.lang.reflect.Method method,Object normal,Object[] args)throws Exception;}
    private static Object bootstrapIo(BootstrapFault fault)throws Exception {
        var field=NativePrivateMutationEpochStore.class.getDeclaredField("bootstrapIo");field.setAccessible(true);Object normal=field.get(null);
        field.set(null,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},
            (proxy,method,args)->fault.apply(method,normal,args)));return normal;
    }
    private static Object bootstrapNormalIo(java.lang.reflect.Method method,Object normal,Object[] args)throws Exception {
        method.setAccessible(true);try{return method.invoke(normal,args);}catch(java.lang.reflect.InvocationTargetException failed){throw (Exception)failed.getCause();}
    }
    private static void restoreBootstrapIo(Object normal)throws Exception {
        var field=NativePrivateMutationEpochStore.class.getDeclaredField("bootstrapIo");field.setAccessible(true);field.set(null,normal);
    }
    @Test public void BOOTSTRAP_actualOwnerBaselineFreshReadAndExactRetry()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            denied(()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile()));assertFalse(Files.exists(x.dir));
            var store=x.bootstrap();try(var current=store.readCurrent()){assertEquals(0,current.counter());}
            assertFalse(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.BOOTSTRAP)));
            var original=saved(x.dir);var keys=new java.util.HashMap<String,Object>();
            for(String name:original.keySet())keys.put(name,Files.readAttributes(x.dir.resolve(name),java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            synchronized(x.engine){
                var digest=NativePrivateMutationEpochStore.class.getDeclaredMethod("baselineDigest",byte[].class);digest.setAccessible(true);
                assertEquals(x.token.originalValuesSha256(),digest.invoke(null,(Object)original.get(NativePrivateMutationEpochStore.BASELINE)));
            }
            try(var input=new java.io.DataInputStream(new java.io.ByteArrayInputStream(original.get(NativePrivateMutationEpochStore.BASELINE)))){
                input.readInt();input.readInt();input.readUTF();for(int i=0;i<5;i++)input.readUTF();
                assertEquals(String.valueOf(Files.getAttribute(x.root,"unix:uid")),input.readUTF());
            }
            x.bootstrap();same(original,x.dir);for(String name:keys.keySet())assertEquals(keys.get(name),Files.readAttributes(x.dir.resolve(name),java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            var fresh=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile());
            try(var current=fresh.readCurrent();var next=fresh.prepareNext(current);var committed=fresh.commitPrepared(next)){assertEquals(1,committed.counter());}
            var advanced=saved(x.dir);denied(x::bootstrap);same(advanced,x.dir); // No resetting a legitimate progressed journal.
        }
    }
    @Test public void BOOTSTRAP_closedChangedAndWrongMonitorRefuseBeforeEffects()throws Exception {
        for(String fault:new String[]{"monitor","closed","changed"})try(var x=new EpochBootstrapFixture()){
            var raw=x.source.x.unknown.get("MemphisZooCustodialNativeVaultV1");
            try{
                if(fault.equals("closed"))x.token.close();
                if(fault.equals("changed"))raw.put("bootstrap-original-change","retained");
                if(fault.equals("monitor"))denied(()->NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(x.root.toFile(),x.token));
                else denied(x::bootstrap);
                assertFalse(Files.exists(x.dir));
            }finally{raw.remove("bootstrap-original-change");}
        }
    }
    @Test public void BOOTSTRAP_partialForceAndCompleteRetryPreserveOriginal()throws Exception {
        for(String fault:new String[]{"partial","earlyForce","directoryForce","completeForce","markerUnlink"})try(var x=new EpochBootstrapFixture()){
            int[] forces={0};Object normal=bootstrapIo((method,delegate,args)->{
                if(fault.equals("partial")&&method.getName().equals("write")){
                    var source=(java.nio.ByteBuffer)args[1];var prefix=source.slice();prefix.limit(Math.min(9,prefix.remaining()));
                    ((FileChannel)args[0]).write(prefix);throw new java.io.IOException("synthetic partial baseline");
                }
                if(fault.equals("directoryForce")&&method.getName().equals("forceDirectory"))throw new java.io.IOException("synthetic root force unknown");
                if(fault.equals("markerUnlink")&&method.getName().equals("removeMarker"))throw new java.io.IOException("synthetic marker removal unknown");
                if(method.getName().equals("forceFile")&&(fault.equals("earlyForce")||fault.equals("completeForce"))){
                    forces[0]++;int at=fault.equals("earlyForce")?1:4;
                    if(forces[0]==at){bootstrapNormalIo(method,delegate,args);throw new java.io.IOException("synthetic initial force outcome unknown");}
                }
                return bootstrapNormalIo(method,delegate,args);
            });
            try{denied(x::bootstrap);}finally{restoreBootstrapIo(normal);}
            var retained=saved(x.dir);denied(()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile()));same(retained,x.dir);
            if(fault.equals("completeForce")||fault.equals("markerUnlink")){
                assertTrue(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.BOOTSTRAP)));
                var resumed=x.bootstrap();try(var current=resumed.readCurrent()){assertEquals(0,current.counter());}
                for(String name:new String[]{NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT,NativePrivateMutationEpochStore.LOCK})
                    assertArrayEquals(retained.get(name),Files.readAllBytes(x.dir.resolve(name)));
            }else{denied(x::bootstrap);same(retained,x.dir);}
        }
    }
    @Test public void BOOTSTRAP_conflictingLegacyAndForeignRootRefuse()throws Exception {
        for(String fault:new String[]{"foreign","legacy","copied","corrupt"})try(var x=new EpochBootstrapFixture()){
            if(fault.equals("copied")||fault.equals("corrupt")){
                x.bootstrap();
                if(fault.equals("copied")){
                    Path old=x.root.resolveSibling(x.root.getFileName()+"-original");Files.move(x.root,old);
                    Files.createDirectory(x.root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    Files.createDirectory(x.dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    try(var files=Files.newDirectoryStream(old.resolve(NativePrivateMutationEpochStore.DIRECTORY))){for(Path path:files){Files.copy(path,x.dir.resolve(path.getFileName()));Files.setPosixFilePermissions(x.dir.resolve(path.getFileName()),PosixFilePermissions.fromString("rw-------"));}}
                }else{
                    Path path=x.dir.resolve(NativePrivateMutationEpochStore.BASELINE);byte[] bytes=Files.readAllBytes(path);bytes[10]^=1;Files.write(path,bytes);
                }
            }else{
                Files.createDirectory(x.dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                if(fault.equals("foreign"))writeFault(x.dir.resolve("foreign-preserved"),new byte[]{7},1,true);
                else{writeFault(x.dir.resolve(NativePrivateMutationEpochStore.LOCK),new byte[0],0,true);byte[] bytes=epochBytes(0);writeFault(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT),bytes,bytes.length,true);}
            }
            var before=saved(x.dir);denied(x::bootstrap);same(before,x.dir);denied(()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.root.toFile()));same(before,x.dir);
        }
    }
    @Test public void BOOTSTRAP_sourceChangeDuringEffectRemainsUnavailable()throws Exception {
        try(var x=new EpochBootstrapFixture()){
            var raw=x.source.x.unknown.get("MemphisZooCustodialNativeVaultV1");Object normal=bootstrapIo((method,delegate,args)->{
                Object result=bootstrapNormalIo(method,delegate,args);
                if(method.getName().equals("write"))raw.put("bootstrap-effect-original-change","preserved");return result;
            });
            try{denied(x::bootstrap);assertFalse(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));}
            finally{restoreBootstrapIo(normal);raw.remove("bootstrap-effect-original-change");}
            var retained=saved(x.dir);denied(x::bootstrap);same(retained,x.dir);
        }
    }
    /** Explicit test-only bootstrap bytes; production has no initialization API.
     * These cases never construct the older Engine/JCE/private-capsule fixture. */
    private static final class EpochFixture {
        final Path root,dir,current,pending,previous,lock;
        final NativePrivateMutationEpochStore store;
        EpochFixture(long counter)throws Exception {
            String parent=System.getProperty("custodial.custody.fixture.root");if(parent==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(parent),"epoch-case-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            dir=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);Files.createDirectory(dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            current=dir.resolve(NativePrivateMutationEpochStore.CURRENT);pending=dir.resolve(NativePrivateMutationEpochStore.PENDING);
            previous=dir.resolve(NativePrivateMutationEpochStore.PREVIOUS);lock=dir.resolve(NativePrivateMutationEpochStore.LOCK);
            writeFault(lock,new byte[0],0,true);byte[] seed=epochBytes(counter);writeFault(current,seed,seed.length,true);
            try(var channel=FileChannel.open(dir,StandardOpenOption.READ)){channel.force(true);}
            store=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(root.toFile());
        }
        NativePrivateMutationEpochStore fresh()throws Exception{return NativePrivateMutationEpochStore.fromNativeNoBackupRoot(root.toFile());}
    }
    private static byte[] epochBytes(long counter)throws Exception {
        byte[] bytes=new byte[NativePrivateMutationEpochStore.RECORD_BYTES];
        java.nio.ByteBuffer.wrap(bytes).putInt(NativePrivateMutationEpochStore.MAGIC).putInt(1).putLong(counter==0?-1:counter-1).putLong(counter);
        byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(Arrays.copyOf(bytes,24));System.arraycopy(hash,0,bytes,24,32);return bytes;
    }
    private interface EpochFault {void apply(String operation,Object normal,Object[] args)throws Exception;}
    private static Object epochIo(NativePrivateMutationEpochStore store,EpochFault fault)throws Exception {
        var field=store.getClass().getDeclaredField("io");field.setAccessible(true);Object normal=field.get(store);
        field.set(store,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},
            (proxy,method,args)->{fault.apply(method.getName(),normal,args);return null;}));return normal;
    }
    private static void epochNormalIo(Object normal,String operation,Object[] args)throws Exception {
        var method=normal.getClass().getDeclaredMethod(operation,args==null?new Class<?>[]{}:new Class<?>[]{FileChannel.class});method.setAccessible(true);
        try{method.invoke(normal,args);}catch(java.lang.reflect.InvocationTargetException failed){throw (Exception)failed.getCause();}
    }
    private static void epochRestoreIo(NativePrivateMutationEpochStore store,Object normal)throws Exception {
        var field=store.getClass().getDeclaredField("io");field.setAccessible(true);field.set(store,normal);
    }
    @Test public void EPOCH_durablePrepareCommitAndFreshRead()throws Exception {
        var x=new EpochFixture(7);
        try(var original=x.store.readCurrent()){
            assertEquals(7,original.counter());byte[] before=Files.readAllBytes(x.current);
            try(var prepared=x.store.prepareNext(original)){
                assertEquals(7,prepared.predecessorCounter());assertEquals(8,prepared.nextCounter());
                byte[] candidate=Files.readAllBytes(x.pending);assertArrayEquals(before,Files.readAllBytes(x.current));
                denied(x.store::readCurrent);denied(()->x.store.requireCurrent(original));denied(()->x.store.prepareNext(original));
                try(var committed=x.store.commitPrepared(prepared)){assertEquals(8,committed.counter());x.store.requireCurrent(committed);}
                assertFalse(Files.exists(x.pending));assertFalse(Files.exists(x.previous));assertArrayEquals(candidate,Files.readAllBytes(x.current));
                denied(()->x.store.requireCurrent(original));try(var fresh=x.fresh().readCurrent()){assertEquals(8,fresh.counter());}
            }
        }
        try(var current=x.store.readCurrent();var next=x.store.prepareNext(current);var committed=x.store.commitPrepared(next)){assertEquals(9,committed.counter());}
    }
    @Test public void EPOCH_exactInterruptedPendingAndAliasResume()throws Exception {
        for(int phase=0;phase<4;phase++){
            var x=new EpochFixture(2);byte[] candidate;Object pendingKey;
            try(var original=x.store.readCurrent();var prepared=x.store.prepareNext(original)){
                candidate=Files.readAllBytes(x.pending);pendingKey=Files.readAttributes(x.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            }
            if(phase==3)Files.createLink(x.previous,x.current);
            else if(phase>0)Files.move(x.current,x.previous,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            if(phase==2)Files.createLink(x.current,x.pending);
            var restarted=x.fresh();var order=new java.util.ArrayList<String>();
            epochIo(restarted,(operation,normal,args)->{order.add(operation);epochNormalIo(normal,operation,args);});
            try(var prepared=restarted.readPreparedForResume();var committed=restarted.commitPrepared(prepared)){
                assertEquals(3,committed.counter());assertEquals(2,prepared.predecessorCounter());
            }
            assertEquals("forceFile",order.get(0));assertTrue(order.indexOf("forceDirectory")<order.indexOf("unlinkPending"));
            assertArrayEquals(candidate,Files.readAllBytes(x.current));
            assertEquals(pendingKey,Files.readAttributes(x.current,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            assertFalse(Files.exists(x.pending));assertFalse(Files.exists(x.previous));
        }
    }
    @Test public void EPOCH_forceAndPartialWriteFailuresPreserve()throws Exception {
        for(String fault:new String[]{"forceFile","forceDirectory","partial"}){
            var x=new EpochFixture(4);byte[] predecessor=Files.readAllBytes(x.current);
            if(fault.equals("partial")){
                var field=x.store.getClass().getDeclaredField("pendingWriter");field.setAccessible(true);
                field.set(x.store,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
                    byte[] bytes=(byte[])args[0];writeFault(x.pending,bytes,9,false);throw new java.io.IOException("synthetic partial original");}));
            }else epochIo(x.store,(operation,normal,args)->{if(operation.equals(fault))throw new java.io.IOException("synthetic force unknown");epochNormalIo(normal,operation,args);});
            try(var original=x.store.readCurrent()){denied(()->x.store.prepareNext(original));}
            assertArrayEquals(predecessor,Files.readAllBytes(x.current));assertTrue(Files.exists(x.pending));var retained=saved(x.dir);
            denied(x.store::readCurrent);same(retained,x.dir);
            if(fault.equals("partial")){denied(()->x.fresh().readPreparedForResume());same(retained,x.dir);}
            else{var fresh=x.fresh();try(var resumed=fresh.readPreparedForResume();var committed=fresh.commitPrepared(resumed)){assertEquals(5,committed.counter());}}
        }
    }
    @Test public void EPOCH_promotionFaultsRetainRecoverableOriginal()throws Exception {
        for(String operation:new String[]{"linkPredecessor","unlinkPredecessorCurrent","linkCandidate","unlinkPending","unlinkPrevious"})for(boolean after:new boolean[]{false,true}){
            var x=new EpochFixture(8);byte[] candidate;
            try(var current=x.store.readCurrent();var prepared=x.store.prepareNext(current)){
                candidate=Files.readAllBytes(x.pending);
                epochIo(x.store,(method,normal,args)->{
                    if(method.equals(operation)){if(after)epochNormalIo(normal,method,args);throw new java.io.IOException("synthetic promotion outcome unknown");}
                    epochNormalIo(normal,method,args);
                });denied(()->x.store.commitPrepared(prepared));
            }
            // An already completed cleanup may have only the promoted original.
            // Every other phase keeps a typed transition, never a replacement.
            var fresh=x.fresh();if(operation.equals("unlinkPrevious")&&after){try(var current=fresh.readCurrent()){assertEquals(9,current.counter());}}
            else try(var original=fresh.readPreparedForResume();var current=fresh.commitPrepared(original)){assertEquals(9,current.counter());}
            assertArrayEquals(candidate,Files.readAllBytes(x.current));assertFalse(Files.exists(x.pending));assertFalse(Files.exists(x.previous));
        }
    }
    @Test public void EPOCH_malformedConflictingAndChangedIdentitiesRefuse()throws Exception {
        for(String fault:new String[]{"checksum","duplicate","foreign","symlink","replacedCurrent","replacedLock","replacedDirectory","replacedRoot"}){
            var x=new EpochFixture(1);
            try(var original=x.store.readCurrent()){
                if(fault.equals("checksum")){byte[] bad=epochBytes(2);bad[50]^=1;writeFault(x.pending,bad,bad.length,true);}
                if(fault.equals("duplicate")){byte[] same=Files.readAllBytes(x.current);writeFault(x.pending,same,same.length,true);}
                if(fault.equals("foreign"))writeFault(x.dir.resolve("foreign-original"),new byte[]{1},1,true);
                if(fault.equals("symlink"))Files.createSymbolicLink(x.pending,x.current);
                if(fault.equals("replacedCurrent")){byte[] same=Files.readAllBytes(x.current);Files.move(x.current,x.root.resolve("old-current"));writeFault(x.current,same,same.length,true);}
                if(fault.equals("replacedLock")){Files.move(x.lock,x.root.resolve("old-lock"));writeFault(x.lock,new byte[0],0,true);}
                if(fault.equals("replacedDirectory")){Files.move(x.dir,x.root.resolve("old-directory"));Files.createDirectory(x.dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));}
                if(fault.equals("replacedRoot")){Path old=x.root.resolveSibling(x.root.getFileName()+"-old");Files.move(x.root,old);Files.createDirectory(x.root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));}
                denied(()->x.store.requireCurrent(original));denied(()->x.store.prepareNext(original));
                if(!fault.equals("replacedCurrent"))denied(x.store::readCurrent);
            }
        }
        var x=new EpochFixture(2);try(var original=x.store.readCurrent();var prepared=x.store.prepareNext(original)){
            Files.move(x.current,x.previous);Files.copy(x.pending,x.current);Files.setPosixFilePermissions(x.current,PosixFilePermissions.fromString("rw-------"));
            var before=saved(x.dir);denied(()->x.store.commitPrepared(prepared));denied(x.store::readPreparedForResume);same(before,x.dir);
        }
    }
    @Test public void EPOCH_overflowMissingBootstrapAndLockRefuse()throws Exception {
        var x=new EpochFixture(Long.MAX_VALUE);var before=saved(x.dir);
        try(var current=x.store.readCurrent()){assertEquals(Long.MAX_VALUE,current.counter());denied(()->x.store.prepareNext(current));}same(before,x.dir);
        Files.delete(x.current);denied(x.store::readCurrent);assertFalse(Files.exists(x.pending));
        var locked=new EpochFixture(0);try(var channel=FileChannel.open(locked.lock,StandardOpenOption.WRITE);var held=channel.lock()){
            denied(locked.store::readCurrent);assertArrayEquals(epochBytes(0),Files.readAllBytes(locked.current));
        }
        var missing=new EpochFixture(0);Files.delete(missing.current);Files.delete(missing.lock);Files.delete(missing.dir);
        denied(()->NativePrivateMutationEpochStore.fromNativeNoBackupRoot(missing.root.toFile()));assertFalse(Files.exists(missing.dir));
        var other=new EpochFixture(1);var foreign=new EpochFixture(1);try(var current=other.store.readCurrent()){denied(()->foreign.store.prepareNext(current));current.close();denied(current::counter);}
    }
    private interface FixedFault {void apply(NativePrivateCustodyOperationStore.Existing original)throws Exception;}
    private static Object writer(NativePrivateCustodyOperationStore store,FixedFault fault)throws Exception {
        var field=NativePrivateCustodyOperationStore.class.getDeclaredField("pendingWriter");field.setAccessible(true);Object normal=field.get(store);
        Object injected=java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
            if(!method.getName().equals("write"))throw new AssertionError("fixed write only");fault.apply((NativePrivateCustodyOperationStore.Existing)args[0]);return null;});
        field.set(store,injected);return normal;
    }
    private static byte[] encoded(NativePrivateCustodyOperationStore.Existing record)throws Exception {
        var field=record.getClass().getDeclaredField("encoded");field.setAccessible(true);byte[] bytes=(byte[])field.get(record);return bytes==null?null:bytes.clone();
    }
    private static void writeFault(Path path,byte[] bytes,int length,boolean force)throws Exception {
        try(var output=FileChannel.open(path,java.util.Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,java.nio.file.LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))) {
            var buffer=java.nio.ByteBuffer.wrap(bytes,0,length);while(buffer.hasRemaining())assertTrue(output.write(buffer)>0);if(force)output.force(true);
        }
    }
    private interface ResumeFault {void apply(String operation,Object normal)throws Exception;}
    private static void resumeFault(NativePrivateCustodyOperationStore store,ResumeFault fault)throws Exception {
        var field=NativePrivateCustodyOperationStore.class.getDeclaredField("resumeIo");field.setAccessible(true);Object normal=field.get(store);
        field.set(store,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
            if(!method.getName().equals("forceOriginal")&&!method.getName().equals("linkPending"))throw new AssertionError("fixed resume I/O only");
            fault.apply(method.getName(),normal);return null;}));
    }
    private static void normalResumeIo(Object normal,String operation)throws Exception {
        var method=normal.getClass().getDeclaredMethod(operation);method.setAccessible(true);
        try{method.invoke(normal);}catch(java.lang.reflect.InvocationTargetException e){throw (Exception)e.getCause();}
    }
    // Model only loss of the process ownership map, keeping actual host files.
    // This does not simulate Android restart, cache eviction or power loss.
    private static NativePrivateCustodyOperationStore resetOwnership(Fixture x)throws Exception {
        var field=NativePrivateCustodyOperationStore.class.getDeclaredField("PREPARATIONS");field.setAccessible(true);
        var states=(Map<?,?>)field.get(null);Object state=states.remove(x.f.root);
        if(state!=null){var originalField=state.getClass().getDeclaredField("original");originalField.setAccessible(true);Object original=originalField.get(state);
            if(original!=null){var recordField=original.getClass().getDeclaredField("record");recordField.setAccessible(true);
                var record=(NativePrivateCustodyOperationStore.Existing)recordField.get(original);if(record!=null)record.close();}}
        return NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
    }
    private static byte[] pendingBeforeForce(Fixture x)throws Exception {
        var bytes=new java.util.concurrent.atomic.AtomicReference<byte[]>();
        writer(x.store,record->{bytes.set(encoded(record));writeFault(x.pending,bytes.get(),bytes.get().length,false);
            throw new java.io.IOException("synthetic before initial force");});
        denied(x::prepare);assertFalse(Files.exists(x.committed));assertArrayEquals(bytes.get(),Files.readAllBytes(x.pending));return bytes.get();
    }
    private static void sameOperation(JSONObject original,JSONObject resumed)throws Exception {
        noAuthority(resumed);assertEquals(original.length(),resumed.length());
        for(var keys=original.keys();keys.hasNext();){String key=keys.next();assertTrue(resumed.has(key));
            if(!key.equals("journal_phase")&&!key.equals("local_operation_committed_observed"))assertEquals(key,original.get(key),resumed.get(key));}
        assertEquals("COMMITTED",resumed.getString("journal_phase"));assertTrue(resumed.getBoolean("local_operation_committed_observed"));
    }
    @Test public void restartResumeForcesExactPendingBeforeLink()throws Exception {try(var x=new Fixture()){
        byte[] original=pendingBeforeForce(x);var store=resetOwnership(x);var order=new java.util.ArrayList<String>();
        Object inode=Files.readAttributes(x.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
        resumeFault(store,(operation,normal)->{order.add(operation);assertFalse(Files.exists(x.committed));assertArrayEquals(original,Files.readAllBytes(x.pending));
            if(operation.equals("linkPending"))assertEquals(java.util.List.of("forceOriginal","linkPending"),order);normalResumeIo(normal,operation);});
        try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,store)) {
            JSONObject metadata=pending.projection();assertEquals("PENDING",metadata.getString("journal_phase"));noAuthority(metadata);
            try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){sameOperation(metadata,resumed.projection());}
        }
        assertEquals(java.util.List.of("forceOriginal","linkPending"),order);assertFalse(Files.exists(x.pending));assertArrayEquals(original,Files.readAllBytes(x.committed));
        assertEquals(inode,Files.readAttributes(x.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());Arrays.fill(original,(byte)0);
    }}
    @Test public void restartForceFailuresPreservePendingOriginal()throws Exception {
        for(boolean after:new boolean[]{false,true})try(var x=new Fixture()){
            byte[] original=pendingBeforeForce(x);var store=resetOwnership(x);var files=saved(x.dir);var calls=new java.util.concurrent.atomic.AtomicInteger();
            resumeFault(store,(operation,normal)->{assertEquals("forceOriginal",operation);calls.incrementAndGet();
                if(after)normalResumeIo(normal,operation);throw new java.io.IOException("synthetic original force boundary");});
            JSONObject metadata;try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,store)) {
                metadata=pending.projection();denied(()->x.f.engine().resumeOriginalPrivateCustodyOperation(pending));}
            assertEquals(1,calls.get());same(files,x.dir);assertFalse(Files.exists(x.committed));
            var recoveredStore=resetOwnership(x);try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,recoveredStore);
                var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){sameOperation(metadata,resumed.projection());}
            assertArrayEquals(original,Files.readAllBytes(x.committed));assertFalse(Files.exists(x.pending));Arrays.fill(original,(byte)0);
        }
    }
    @Test public void restartLinkFailuresPreserveRecoverableOriginal()throws Exception {
        for(boolean after:new boolean[]{false,true})try(var x=new Fixture()){
            byte[] original=pendingBeforeForce(x);var store=resetOwnership(x);var order=new java.util.ArrayList<String>();
            resumeFault(store,(operation,normal)->{order.add(operation);if(operation.equals("forceOriginal")){normalResumeIo(normal,operation);return;}
                assertEquals(java.util.List.of("forceOriginal","linkPending"),order);if(after)normalResumeIo(normal,operation);
                throw new java.io.IOException("synthetic original link boundary");});
            JSONObject metadata;try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,store)) {
                metadata=pending.projection();denied(()->x.f.engine().resumeOriginalPrivateCustodyOperation(pending));}
            assertEquals(java.util.List.of("forceOriginal","linkPending"),order);assertTrue(Files.exists(x.pending));assertArrayEquals(original,Files.readAllBytes(x.pending));
            assertEquals(after,Files.exists(x.committed));if(after){assertTrue(Files.isSameFile(x.committed,x.pending));assertArrayEquals(original,Files.readAllBytes(x.committed));}
            var recoveredStore=resetOwnership(x);var retry=new java.util.ArrayList<String>();
            resumeFault(recoveredStore,(operation,normal)->{retry.add(operation);assertTrue(Files.exists(x.pending));normalResumeIo(normal,operation);});
            try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,recoveredStore)) {
                assertEquals(after?"COMMITTED_PENDING_ALIAS":"PENDING",pending.projection().getString("journal_phase"));
                try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){sameOperation(metadata,resumed.projection());}}
            assertEquals(after?java.util.List.of("forceOriginal"):java.util.List.of("forceOriginal","linkPending"),retry);
            assertArrayEquals(original,Files.readAllBytes(x.committed));assertFalse(Files.exists(x.pending));Arrays.fill(original,(byte)0);
        }
    }
    @Test public void restartCurrentnessChangeAfterForceRefusesPromotion()throws Exception {try(var x=new Fixture()){
        byte[] original=pendingBeforeForce(x);var store=resetOwnership(x);var files=saved(x.dir);var calls=new java.util.concurrent.atomic.AtomicInteger();
        resumeFault(store,(operation,normal)->{assertEquals("forceOriginal",operation);calls.incrementAndGet();normalResumeIo(normal,operation);
            x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("restart-source-mutation","synthetic");});
        try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,store)) {
            denied(()->x.f.engine().resumeOriginalPrivateCustodyOperation(pending));}
        assertEquals(1,calls.get());same(files,x.dir);assertFalse(Files.exists(x.committed));assertArrayEquals(original,Files.readAllBytes(x.pending));Arrays.fill(original,(byte)0);
    }}
    @Test public void restartMissingForeignAndAmbiguousPendingRefuseBeforeForce()throws Exception {
        for(String fault:new String[]{"absent","foreign","ambiguous"})try(var x=new Fixture()){
            byte[] original=pendingBeforeForce(x);var store=resetOwnership(x);var calls=new java.util.concurrent.atomic.AtomicInteger();
            resumeFault(store,(operation,normal)->{calls.incrementAndGet();throw new AssertionError("invalid original cannot reach resume I/O");});
            try(var pending=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,store)) {
                if(fault.equals("absent"))Files.delete(x.pending);
                else if(fault.equals("ambiguous")){Files.copy(x.pending,x.committed);Files.setPosixFilePermissions(x.committed,PosixFilePermissions.fromString("rw-------"));}
                else {
                    var recordField=pending.getClass().getDeclaredField("record");recordField.setAccessible(true);var record=(NativePrivateCustodyOperationStore.Existing)recordField.get(pending);
                    var bodyField=record.getClass().getDeclaredField("body");bodyField.setAccessible(true);
                    char[] clear=new JSONObject((String)bodyField.get(record)).put("operation_id",java.util.UUID.randomUUID().toString()).toString().toCharArray();
                    byte[] foreign=null;try {var cipher=new AndroidKeystoreCipher(NativePrivateCustodyOperationStore.AAD,NativePrivateCustodyOperationStore.MAX_CLEAR);
                        var encode=NativePrivateCustodyOperationStore.class.getDeclaredMethod("encode",EncryptedSecret.class);encode.setAccessible(true);
                        foreign=(byte[])encode.invoke(null,cipher.encryptWithExistingKey(clear));Files.write(x.pending,foreign);
                    }finally{VaultValidation.wipe(clear);if(foreign!=null)Arrays.fill(foreign,(byte)0);}
                }
                var files=saved(x.dir);denied(()->x.f.engine().resumeOriginalPrivateCustodyOperation(pending));same(files,x.dir);
            }
            assertEquals(0,calls.get());Arrays.fill(original,(byte)0);
        }
    }
    @Test public void createFailureRetainsOriginalAcrossSameRootAdapters()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();var bytes=new java.util.concurrent.atomic.AtomicReference<byte[]>();
        var id=new java.util.concurrent.atomic.AtomicReference<String>();
        writer(x.store,record->{first.set(record);bytes.set(encoded(record));id.set(record.metadata().getString("operation_id"));throw new java.io.IOException("synthetic before create");});
        denied(x::prepare);assertFalse(Files.exists(x.pending));
        var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
        try(var result=x.f.engine().prepareOriginalPrivateCustodyOperation(x.frame,other)){
            var p=result.projection();noAuthority(p);assertEquals(id.get(),p.getString("operation_id"));assertTrue(p.getBoolean("local_operation_committed_observed"));
            assertArrayEquals(bytes.get(),Files.readAllBytes(x.committed));assertNull(encoded(first.get()));
        }Arrays.fill(bytes.get(),(byte)0);
    }}
    @Test public void completeWriteBeforeForceKeepsPendingAndRequiresExplicitResume()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();var bytes=new java.util.concurrent.atomic.AtomicReference<byte[]>();
        writer(x.store,record->{first.set(record);byte[] original=encoded(record);bytes.set(original);writeFault(x.pending,original,original.length,false);
            throw new java.io.IOException("synthetic force unknown");});
        denied(x::prepare);assertFalse(Files.exists(x.committed));String id=first.get().metadata().getString("operation_id");
        try(var result=x.prepare()) {var p=result.projection();noAuthority(p);assertEquals(id,p.getString("operation_id"));assertEquals("PENDING",p.getString("journal_phase"));
            assertFalse(p.getBoolean("local_operation_committed_observed"));assertFalse(Files.exists(x.committed));assertArrayEquals(bytes.get(),Files.readAllBytes(x.pending));
            assertNull(encoded(first.get()));try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(result)){
                noAuthority(resumed.projection());assertEquals(id,resumed.projection().getString("operation_id"));assertArrayEquals(bytes.get(),Files.readAllBytes(x.committed));
            }
        }Arrays.fill(bytes.get(),(byte)0);
    }}
    @Test public void partialWriteIsUnknownAndNeverRepairedOrReencrypted()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();var calls=new java.util.concurrent.atomic.AtomicInteger();
        writer(x.store,record->{first.set(record);calls.incrementAndGet();byte[] original=encoded(record);
            try{writeFault(x.pending,original,17,true);}finally{Arrays.fill(original,(byte)0);}throw new java.io.IOException("synthetic partial");});
        denied(x::prepare);var files=saved(x.dir);byte[] original=encoded(first.get());
        denied(x::prepare);denied(x::recover);var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
        denied(()->x.f.engine().prepareOriginalPrivateCustodyOperation(x.frame,other));denied(other::inspectPendingIdentityHint);
        same(files,x.dir);assertEquals(1,calls.get());assertArrayEquals(original,encoded(first.get()));Arrays.fill(original,(byte)0);
    }}
    @Test public void changedKeyCannotWriteRetainedPreparation()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();var calls=new java.util.concurrent.atomic.AtomicInteger();
        writer(x.store,record->{first.set(record);calls.incrementAndGet();throw new java.io.IOException("synthetic before create");});
        denied(x::prepare);byte[] original=encoded(first.get());NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);
        denied(x::prepare);assertFalse(Files.exists(x.pending));assertFalse(Files.exists(x.committed));assertEquals(1,calls.get());
        assertArrayEquals(original,encoded(first.get()));Arrays.fill(original,(byte)0);
    }}
    @Test public void foreignValidPendingCannotReplaceFirstPreparedOriginal()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();
        writer(x.store,record->{first.set(record);throw new java.io.IOException("synthetic before create");});denied(x::prepare);
        var field=first.get().getClass().getDeclaredField("body");field.setAccessible(true);
        String body=new JSONObject((String)field.get(first.get())).put("operation_id",java.util.UUID.randomUUID().toString()).toString();char[] clear=body.toCharArray();byte[] foreign=null;
        try{var cipher=new AndroidKeystoreCipher(NativePrivateCustodyOperationStore.AAD,NativePrivateCustodyOperationStore.MAX_CLEAR);
            var encode=NativePrivateCustodyOperationStore.class.getDeclaredMethod("encode",EncryptedSecret.class);encode.setAccessible(true);
            foreign=(byte[])encode.invoke(null,cipher.encryptWithExistingKey(clear));writeFault(x.pending,foreign,foreign.length,true);
        }finally{VaultValidation.wipe(clear);if(foreign!=null)Arrays.fill(foreign,(byte)0);}
        var files=saved(x.dir);byte[] original=encoded(first.get());denied(x::prepare);denied(x::recover);denied(x.store::inspectPendingIdentityHint);
        same(files,x.dir);assertArrayEquals(original,encoded(first.get()));Arrays.fill(original,(byte)0);
    }}
    @Test public void replacedLockIdentityCannotRevivePreparedOriginal()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();
        writer(x.store,record->{first.set(record);throw new java.io.IOException("synthetic before create");});denied(x::prepare);byte[] original=encoded(first.get());
        Path lock=x.dir.resolve(NativePrivateCustodyOperationStore.LOCK);Files.move(lock,x.f.root.resolve("synthetic-preserved-lock"));
        Files.createFile(lock,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));var files=saved(x.dir);
        denied(x::prepare);same(files,x.dir);assertArrayEquals(original,encoded(first.get()));assertFalse(Files.exists(x.pending));Arrays.fill(original,(byte)0);
    }}
    @Test public void reentrantPreparationCannotAllocateCompetingOriginal()throws Exception {try(var x=new Fixture()){
        var calls=new java.util.concurrent.atomic.AtomicInteger();var normal=new java.util.concurrent.atomic.AtomicReference<Object>();
        normal.set(writer(x.store,record->{calls.incrementAndGet();var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
            denied(()->x.f.engine().prepareOriginalPrivateCustodyOperation(x.frame,other));denied(()->other.inspectOriginal(x.frame));
            var method=normal.get().getClass().getDeclaredMethod("write",NativePrivateCustodyOperationStore.Existing.class);method.setAccessible(true);
            try{method.invoke(normal.get(),record);}catch(java.lang.reflect.InvocationTargetException e){throw (Exception)e.getCause();}
        }));
        try(var result=x.prepare()){noAuthority(result.projection());assertTrue(result.projection().getBoolean("local_operation_committed_observed"));assertEquals(1,calls.get());}
    }}
    @Test public void memoryOnlyWriterOutcomeRetainsOriginalWithoutInventingDurability()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();
        writer(x.store,record->first.set(record));denied(x::prepare);assertFalse(Files.exists(x.pending));assertFalse(Files.exists(x.committed));
        String id=first.get().metadata().getString("operation_id");byte[] bytes=encoded(first.get());
        var other=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
        try(var result=x.f.engine().prepareOriginalPrivateCustodyOperation(x.frame,other)) {
            noAuthority(result.projection());assertEquals(id,result.projection().getString("operation_id"));assertArrayEquals(bytes,Files.readAllBytes(x.committed));
            assertNull(encoded(first.get()));
        }Arrays.fill(bytes,(byte)0);
    }}
    @Test public void forceAmbiguousPendingDirectResumeStillUsesOriginalAndClosesCandidate()throws Exception {try(var x=new Fixture()){
        var first=new java.util.concurrent.atomic.AtomicReference<NativePrivateCustodyOperationStore.Existing>();var bytes=new java.util.concurrent.atomic.AtomicReference<byte[]>();
        writer(x.store,record->{first.set(record);bytes.set(encoded(record));writeFault(x.pending,bytes.get(),bytes.get().length,false);
            throw new java.io.IOException("synthetic before force");});denied(x::prepare);String id=first.get().metadata().getString("operation_id");
        try(var pending=x.recover()) {
            noAuthority(pending.projection());assertEquals("PENDING",pending.projection().getString("journal_phase"));assertNotNull(encoded(first.get()));
            try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){
                noAuthority(resumed.projection());assertEquals(id,resumed.projection().getString("operation_id"));assertTrue(resumed.projection().getBoolean("local_operation_committed_observed"));
                assertArrayEquals(bytes.get(),Files.readAllBytes(x.committed));assertNull(encoded(first.get()));
            }
        }Arrays.fill(bytes.get(),(byte)0);
    }}
    /** Ordinary frames come from the existing owning factory. These members
     * do NOT manufacture a HELD reconstruction or qualify HELD denial. */
    @Test public void OPERATION_WRITER_liveFramePreservesPrepareInspectAndResume()throws Exception {
        try(var x=new Fixture(true)){
            x.frame.requireOrdinaryOperationWriter();
            assertEquals("PROCESS_ONLY",x.frame.operationBindingForFixedJournal().getString("original_native_mutation_stamp"));
            String operationId;
            try(var original=x.store.prepareOriginal(x.frame);var inspected=x.store.inspectOriginal(x.frame)){
                assertTrue(original.sameObservedOriginal(inspected));
                operationId=original.metadata().getString("operation_id");
            }
            byte[] bytes=Files.readAllBytes(x.committed);
            Object inode=Files.readAttributes(x.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try{
                // Existing host fault fixture only: move the same original
                // ciphertext into its fixed pending slot, never replace it.
                Files.move(x.committed,x.pending);
                try(var pending=x.store.inspectOriginal(x.frame)){
                    assertEquals("PENDING",pending.metadata().getString("journal_phase"));
                    try(var resumed=x.store.resumeOriginal(x.frame,pending);var read=x.store.inspectOriginal(x.frame)){
                        assertTrue(resumed.sameObservedOriginal(read));
                        assertEquals(operationId,resumed.metadata().getString("operation_id"));
                        assertEquals("COMMITTED",resumed.metadata().getString("journal_phase"));
                    }
                }
                assertFalse(Files.exists(x.pending));assertArrayEquals(bytes,Files.readAllBytes(x.committed));
                assertEquals(inode,Files.readAttributes(x.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void OPERATION_WRITER_closedEntryCreatesNoArtifacts()throws Exception {
        try(var x=new Fixture(true)){
            var capsule=saved(x.f.dir);var writes=new java.util.concurrent.atomic.AtomicInteger();
            writer(x.store,record->{writes.incrementAndGet();throw new AssertionError("closed frame reached pending writer");});
            x.frame.close();denied(x.frame::requireOrdinaryOperationWriter);
            denied(()->x.store.prepareOriginal(x.frame));denied(()->x.store.prepareOriginal(null));
            denied(()->x.store.resumeOriginal(x.frame,null));denied(()->x.store.resumeOriginal(null,null));
            assertFalse(Files.exists(x.dir));assertEquals(0,writes.get());same(capsule,x.f.dir);
        }
    }
    @Test public void OPERATION_WRITER_closedPendingRetainsOriginalWithoutResumeIo()throws Exception {
        try(var x=new Fixture(true)){
            try(var original=x.store.prepareOriginal(x.frame)){original.metadata();}
            Files.move(x.committed,x.pending);
            try(var pending=x.store.inspectOriginal(x.frame)){
                var files=saved(x.dir);Object inode=Files.readAttributes(x.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                var io=new java.util.concurrent.atomic.AtomicInteger();
                resumeFault(x.store,(operation,normal)->{io.incrementAndGet();throw new AssertionError("closed frame reached resume I/O");});
                x.frame.close();denied(()->x.store.resumeOriginal(x.frame,pending));denied(()->x.store.prepareOriginal(x.frame));
                assertEquals(0,io.get());assertFalse(Files.exists(x.committed));same(files,x.dir);
                assertEquals(inode,Files.readAttributes(x.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            }
        }
    }
    @Test public void OPERATION_CURRENT_unchangedOriginalReopensWithoutEffects()throws Exception{
        try(var x=new Fixture(true);var original=x.prepare()){
            var saved=NativePrivateCustodyOwnerTest.files(x.dir);var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);
            var identity=Files.readAttributes(x.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try(var reopened=x.f.engine().recoverOriginalPrivateCustodyOperation(x.frame,x.store);
                var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(reopened)){
                var before=original.projection();var after=reopened.projection();
                assertEquals(before.toString(),after.toString());assertTrue(plan.projection().getInt("chunk_count")>1);
                assertEquals(before.getString("operation_id"),plan.projection().getString("operation_id"));
                assertFalse(after.getBoolean("inventory_acknowledged"));assertFalse(after.getBoolean("key_removal"));
            }
            NativePrivateCustodyOwnerTest.sameFiles(saved,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);
            assertEquals(identity,Files.readAttributes(x.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        }
    }
    @Test public void OPERATION_CURRENT_lastSourceChangedCiphertextRefusesAndCannotRevive()throws Exception{
        try(var x=new Fixture(true);var original=x.prepare()){
            var before=Files.readAttributes(x.committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] saved=Files.readAllBytes(x.committed),changed=saved.clone();changed[changed.length/2]^=1;
            String namespace="MemphisZooCustodialNativeVaultV1";var maps=x.f.x.f.x.unknown;var source=maps.get(namespace);
            var fired=new java.util.concurrent.atomic.AtomicBoolean();
            maps.put(namespace,new java.util.HashMap<String,Object>(source){
                @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                    var stack=Thread.currentThread().getStackTrace();
                    if(!fired.get()&&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(NativePrivateCustodyOperationStore.class.getName())&&s.getMethodName().equals("currentFrameResult"))
                        &&Arrays.stream(stack).anyMatch(s->s.getClassName().equals(NativePrivateCustodyOperationStore.class.getName())&&s.getMethodName().equals("inspectOriginal"))
                        &&fired.compareAndSet(false,true))try{
                        Files.write(x.committed,changed);Files.setLastModifiedTime(x.committed,before.lastModifiedTime());
                    }catch(Exception failure){throw new AssertionError("Actual terminal operation Source mutation prerequisite",failure);}
                    return super.entrySet();
                }
            });
            try{
                VaultFailure failure=null;
                try{original.projection();}catch(VaultFailure refused){failure=refused;}
                maps.put(namespace,source);assertTrue("Actual terminal Source callback reached",fired.get());
                assertArrayEquals("The actual same-inode file changed during terminal Source",changed,Files.readAllBytes(x.committed));
                System.out.println("OPERATION_TERMINAL_SOURCE_INJECTION_FIRED_ACTUAL_FILE_CHANGED");
                assertNotNull("Last Source callback cannot leave changed operation bytes outside the current read",failure);
                assertEquals(NativePrivateCustodyOperationStore.FAILURE,failure.code);
                assertTrue(Arrays.stream(failure.getStackTrace()).anyMatch(s->s.getClassName().equals(NativePrivateCustodyOperationStore.class.getName())&&s.getMethodName().equals("currentFrameResult")));
                assertArrayEquals(changed,Files.readAllBytes(x.committed));
                var after=Files.readAttributes(x.committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                Files.write(x.committed,saved);Files.setLastModifiedTime(x.committed,before.lastModifiedTime());
                assertThrows("Restoring bytes cannot revive this refused observed operation",VaultFailure.class,original::projection);
                assertArrayEquals(saved,Files.readAllBytes(x.committed));
            }finally{maps.put(namespace,source);Files.write(x.committed,saved);Files.setLastModifiedTime(x.committed,before.lastModifiedTime());Arrays.fill(saved,(byte)0);Arrays.fill(changed,(byte)0);}
        }
    }
    static final class Fixture implements AutoCloseable {
        final NativePrivateCustodyOwnerTest.Fixture f;
        final NativePrivateCustodyOperationStore store;
        final Path dir,committed,pending;
        final VaultEngine.NativePrivateCustodyObservation owner;final VaultEngine.NativePrivateCustodyTransportFrame frame;
        final NativeProtectedNamespaceObservation guardedNamespaces;
        final VaultEngine.NativeRetainedNamespaceValueObservation guardedValues;
        final VaultEngine.NativeRetainedNamespaceSemanticObservation guardedSemantics;
        final VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation guardedLayout;
        private enum DurableFirstOriginal { BOUND_PREFS_HOST_MODEL }
        private UnitReconstruction durableOriginal;
        Fixture()throws Exception{this(false);}
        Fixture(boolean guarded)throws Exception {this(guarded,false);}
        private Fixture(boolean guarded,boolean deferInitialFrame)throws Exception {
            this(new NativePrivateCustodyOwnerTest.Fixture(),guarded,deferInitialFrame);
        }
        Fixture(NativePrivateCustodyOwnerTest.Fixture original,boolean guarded)throws Exception {
            this(original,guarded,false);
        }
        private Fixture(NativePrivateCustodyOwnerTest.Fixture original,boolean guarded,boolean deferInitialFrame)throws Exception {
            f=java.util.Objects.requireNonNull(original);
            store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            dir=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);committed=dir.resolve(NativePrivateCustodyOperationStore.COMMITTED);pending=dir.resolve(NativePrivateCustodyOperationStore.PENDING);
            if(deferInitialFrame&&!guarded)throw new AssertionError("deferred fixture requires owning guarded values");
            f.commit();
            if(guarded){
                guardedNamespaces=NativeProtectedNamespaceObservation.observe(owningGuardedReaders(f.x.f.x));
                guardedValues=f.x.f.values(f.h.g,guardedNamespaces);guardedSemantics=f.x.f.join(guardedValues);guardedLayout=f.x.layout(guardedSemantics);
                owner=f.engine().inspectOriginalPrivateCustody(guardedLayout,f.store);
            }else{guardedNamespaces=null;guardedValues=null;guardedSemantics=null;guardedLayout=null;owner=f.inspect();}
            frame=deferInitialFrame?null:f.engine().prepareOriginalPrivateCustodyTransportFrame(owner);
        }
        static Fixture boundDurableFirstOriginalForHostModel()throws Exception {
            // Existing test construction profile only; no option installs an
            // epoch, ACK, private control or HELD state by itself.
            if(System.getProperty("custodial.custody.fixture.root")==null
                ||!Boolean.getBoolean("custodial.fixture.original-batch-before-capture")
                ||!"original-bound-prefs-host-model".equals(System.getProperty("custodial.fixture.semantic-join-persistence")))
                throw new AssertionError("owned root, original batch and bound preferences host profile required");
            AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
            return new Fixture(DurableFirstOriginal.BOUND_PREFS_HOST_MODEL);
        }
        private Fixture(DurableFirstOriginal setup)throws Exception {
            f=new NativePrivateCustodyOwnerTest.Fixture();
            store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.root.toFile());
            dir=f.root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);committed=dir.resolve(NativePrivateCustodyOperationStore.COMMITTED);pending=dir.resolve(NativePrivateCustodyOperationStore.PENDING);
            UnitReconstruction current=null;
            try{
                if(setup!=DurableFirstOriginal.BOUND_PREFS_HOST_MODEL)throw new AssertionError("fixed first-original setup required");
                var source=f.x.f;var old=source.x.f.batch.old;
                if(source.boundVaultPreferences==null||source.boundWorkPreferences==null
                    ||source.boundVaultDisk.memory!=source.x.unknown.get(NativeVaultProviderReferenceCensus.VAULT)
                    ||!NativeProtectedWorkSnapshot.exactRawEquals(old.workDisk.memory,source.boundWorkPreferences.getAll()))
                    throw new AssertionError("same original bound VAULT/WORK preferences required");
                var stable=new NativeRetainedNamespaceCensusTest.Stable(source.x);
                synchronized(f.engine()){
                    try(var control=new NativePrivateCustodyFrameReadControl();
                        var absence=store.acquireInitialMutationBaselineAbsence()){
                        control.check();absence.requireCurrent();String originalGeneration;
                        try(var namespaces=NativeProtectedNamespaceObservation.observe(owningBoundGuardedReaders(source));
                            var values=source.values(f.h.g,namespaces)){
                            originalGeneration=f.h.g.projection().getString("generation_id");
                            installFirstUnitBaseline(this,values,absence,control);
                            assertThrows(VaultFailure.class,namespaces::originalMutationStampForOwningOperation);
                        }
                        // Bootstrap invalidates these PROCESS_ONLY observations;
                        // never rebind/adopt them, even though raw rows match.
                        f.h.close();control.check();absence.requireCurrent();stable.check();
                        current=new UnitReconstruction(this,originalGeneration,absence,control);
                        try(var original=absence.retainFirstOriginal(current.frame,control)){
                            control.check();assertEquals("COMMITTED",original.metadata().getString("journal_phase"));
                        }
                        stable.check();control.check();
                    }
                }
                durableOriginal=current;owner=current.owner;frame=current.frame;
                guardedNamespaces=current.namespaces;guardedValues=current.values;
                guardedSemantics=current.semantics;guardedLayout=current.layout;
            }catch(Exception|Error failure){
                if(current!=null)current.close();
                try{f.close();}catch(Exception|Error cleanup){failure.addSuppressed(cleanup);}
                throw failure;
            }
        }
        VaultEngine.NativePrivateCustodyOperationObservation prepare()throws Exception{return f.engine().prepareOriginalPrivateCustodyOperation(frame,store);}
        VaultEngine.NativePrivateCustodyOperationObservation recover()throws Exception{return f.engine().recoverOriginalPrivateCustodyOperation(frame,store);}
        @Override public void close(){if(durableOriginal!=null){durableOriginal.close();f.close();return;}if(frame!=null)frame.close();owner.close();if(guardedLayout!=null){guardedLayout.close();guardedSemantics.close();guardedValues.close();guardedNamespaces.close();}f.close();}
    }
    private static Map<String,NativeProtectedNamespaceObservation.Store> owningGuardedReaders(NativeRetainedNamespaceCensusTest.Fixture source)throws Exception {
        var existing=new java.util.TreeMap<String,android.content.SharedPreferences>();
        for(String name:source.unknown.keySet())existing.put(name,(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
            NativePrivateCustodyOperationTest.class.getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                if(!method.getName().equals("getAll"))throw new AssertionError("guarded original reader edited source");
                return new java.util.HashMap<>(source.raw(name));
            }));
        return AndroidProtectedNamespaceReaders.bind(existing);
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {NativePrivateCustodyOwnerTest.denied(action);}
    static void same(Map<String,byte[]> files,Path dir)throws Exception {NativePrivateCustodyOwnerTest.sameFiles(files,dir);}
    static Map<String,byte[]> saved(Path dir)throws Exception{return NativePrivateCustodyOwnerTest.files(dir);}
    static void noAuthority(JSONObject p)throws Exception {
        assertEquals(10,p.getInt("source_declared_native_domain_count"));assertEquals(8,p.getInt("original_eight_namespaces_count"));assertEquals(4,p.getInt("original_key_family_count"));
        assertEquals("SHARED_VAULT_V2",p.getString("key_family"));assertEquals(NativePrivateCustodyOperationStore.DIRECTORY,p.get("protected_storage_domain"));
        assertEquals(4,java.util.UUID.fromString(p.getString("operation_id")).version());
        for(String flag:new String[]{"original_chunk_write_attempt_read_query_identities_bound","frame_request_attestation_bound","network_dispatch_allowed","writer_authority","durable_retention",
            "current_server_readback","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified",
            "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,p.getBoolean(flag));
        for(String forbidden:new String[]{"ciphertext","body_base64","installation_seal","SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER"})assertFalse(p.toString().contains(forbidden));
    }
    @Test public void missingRecoveryNeverCreatesStorageOrReplacementOperation()throws Exception {try(var x=new Fixture()){
        denied(x::recover);assertFalse(Files.exists(x.dir));x.frame.metadata();x.owner.projection();}}
    @Test public void originalOperationAndCiphertextSurviveFreshFrameRecoveryWithoutOldStoreWrites()throws Exception {try(var x=new Fixture()){
        var old=saved(x.f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(x.f.x.f.x);
        try(var operation=x.prepare()){var p=operation.projection();noAuthority(p);assertTrue(p.getBoolean("local_operation_committed_observed"));
            assertEquals(x.frame.metadata().get("frame_sha256"),p.get("frame_sha256"));var files=saved(x.dir);
            try(var frame=x.f.engine().prepareOriginalPrivateCustodyTransportFrame(x.owner);var recovered=x.f.engine().recoverOriginalPrivateCustodyOperation(frame,x.store);var repeated=x.prepare()){
                assertEquals(p.toString(),recovered.projection().toString());assertEquals(p.toString(),repeated.projection().toString());same(files,x.dir);
            }same(old,x.f.dir);stable.check();
        }}}
    @Test public void exactPendingRecoveryRequiresExplicitResumeAndKeepsOriginalIvAndId()throws Exception {try(var x=new Fixture()){
        String id;try(var op=x.prepare()){id=op.projection().getString("operation_id");}byte[] bytes=Files.readAllBytes(x.committed);Files.move(x.committed,x.pending);
        try(var pending=x.recover();var repeated=x.prepare()){assertEquals("PENDING",pending.projection().get("journal_phase"));assertFalse(pending.projection().getBoolean("local_operation_committed_observed"));
            assertEquals(id,repeated.projection().get("operation_id"));assertFalse(Files.exists(x.committed));assertArrayEquals(bytes,Files.readAllBytes(x.pending));
            try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){assertEquals(id,resumed.projection().get("operation_id"));assertTrue(resumed.projection().getBoolean("local_operation_committed_observed"));
                assertArrayEquals(bytes,Files.readAllBytes(x.committed));assertFalse(Files.exists(x.pending));}denied(pending::projection);}
        Arrays.fill(bytes,(byte)0);
    }}
    @Test public void sameInodeAliasRequiresExplicitResumeWithoutReplacingCommittedOriginal()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}byte[] original=Files.readAllBytes(x.committed);Files.createLink(x.pending,x.committed);
        try(var pending=x.recover()){assertEquals("COMMITTED_PENDING_ALIAS",pending.projection().get("journal_phase"));assertFalse(pending.projection().getBoolean("local_operation_committed_observed"));
            try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending)){assertTrue(resumed.projection().getBoolean("local_operation_committed_observed"));assertArrayEquals(original,Files.readAllBytes(x.committed));}}
        assertFalse(Files.exists(x.pending));Arrays.fill(original,(byte)0);
    }}
    @Test public void differentInodePendingEvenSameBytesIsUnknownAndPreserved()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}Files.copy(x.committed,x.pending);Files.setPosixFilePermissions(x.pending,PosixFilePermissions.fromString("rw-------"));var files=saved(x.dir);
        denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void truncatedRecordCannotBeRegeneratedOrReplaced()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}Files.write(x.committed,new byte[]{1,2,3});var files=saved(x.dir);denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void recomputedChecksumDoesNotAuthenticateAlteredGcmCiphertext()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}byte[] bytes=Files.readAllBytes(x.committed);bytes[25]^=1;
        var digest=java.security.MessageDigest.getInstance("SHA-256");digest.update(bytes,0,bytes.length-32);byte[] sum=digest.digest();System.arraycopy(sum,0,bytes,bytes.length-32,32);
        Files.write(x.committed,bytes);var files=saved(x.dir);denied(x::recover);denied(x::prepare);same(files,x.dir);Arrays.fill(bytes,(byte)0);Arrays.fill(sum,(byte)0);
    }}
    @Test public void unexpectedArtifactIsPreservedAndNoAuthorityIsProduced()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}Files.writeString(x.dir.resolve("unreviewed.bin"),"synthetic unknown");var files=saved(x.dir);denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void nonPrivateRecordAndDirectoryModesRefuseWithoutChmodRepair()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}Files.setPosixFilePermissions(x.committed,PosixFilePermissions.fromString("rw-r--r--"));denied(x::recover);denied(x::prepare);
        assertEquals(PosixFilePermissions.fromString("rw-r--r--"),Files.getPosixFilePermissions(x.committed));Files.setPosixFilePermissions(x.committed,PosixFilePermissions.fromString("rw-------"));
        Files.setPosixFilePermissions(x.dir,PosixFilePermissions.fromString("rwxr-xr-x"));denied(x::recover);denied(x::prepare);assertEquals(PosixFilePermissions.fromString("rwxr-xr-x"),Files.getPosixFilePermissions(x.dir));
    }}
    @Test public void symlinkRecordIsNeverFollowedOrReplaced()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}Path target=x.f.root.resolve("synthetic-preserved-original.bin");Files.move(x.committed,target);byte[] bytes=Files.readAllBytes(target);
        Files.createSymbolicLink(x.committed,target);denied(x::recover);denied(x::prepare);assertTrue(Files.isSymbolicLink(x.committed));assertArrayEquals(bytes,Files.readAllBytes(target));Arrays.fill(bytes,(byte)0);
    }}
    @Test public void busyLockRefusesWithoutMutationOrCompetingOperation()throws Exception {try(var x=new Fixture()){
        try(var op=x.prepare()){op.projection();}var files=saved(x.dir);
        try(var channel=FileChannel.open(x.dir.resolve(NativePrivateCustodyOperationStore.LOCK),StandardOpenOption.WRITE);var lock=channel.lock()){denied(x::recover);denied(x::prepare);same(files,x.dir);}
        try(var original=x.recover()){noAuthority(original.projection());}
    }}
    @Test public void closedForeignAndNullOwnerCapabilitiesCannotAuthorizeJournal()throws Exception {try(var x=new Fixture()){
        denied(()->x.f.engine().prepareOriginalPrivateCustodyOperation(null,x.store));assertFalse(Files.exists(x.dir));
        var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();denied(()->other.f.engine().prepareOriginalPrivateCustodyOperation(x.frame,x.store));assertFalse(Files.exists(x.dir));other.f.x.f.preserved();
        try(var op=x.prepare()){var files=saved(x.dir);op.close();denied(op::projection);same(files,x.dir);}x.frame.close();var files=saved(x.dir);denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void changedOriginalNamespaceInvalidatesOperationAndPreservesJournal()throws Exception {try(var x=new Fixture();var op=x.prepare()){
        var files=saved(x.dir);x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("operation-source-mutation","synthetic");denied(op::projection);denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void changedOriginalKeyCannotDecryptAuthorizeOrReplaceOperation()throws Exception {try(var x=new Fixture();var op=x.prepare()){
        var files=saved(x.dir);NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);denied(op::projection);denied(x::recover);denied(x::prepare);same(files,x.dir);
    }}
    @Test public void closeWipesOnlyOwnedEncryptedJournalObservationAndLeavesOriginalRecoverable()throws Exception {try(var x=new Fixture()){
        var op=x.prepare();var files=saved(x.dir);var field=op.getClass().getDeclaredField("record");field.setAccessible(true);Object record=field.get(op);
        var encoded=record.getClass().getDeclaredField("encoded");encoded.setAccessible(true);byte[] owned=(byte[])encoded.get(record);String id=op.projection().getString("operation_id");op.close();
        assertNull(encoded.get(record));assertArrayEquals(new byte[owned.length],owned);denied(op::projection);same(files,x.dir);x.frame.metadata();x.owner.projection();
        try(var recovered=x.recover()){assertEquals(id,recovered.projection().get("operation_id"));}
    }}

    @Test public void PENDING_OPERATION_normalPublicationPreservesOriginalInodeAndBinding()throws Exception {
        try(var x=new Fixture(true)){
            JSONObject original;
            try(var created=x.prepare()){original=created.projection();noAuthority(original);}
            // HOST crash arrangement moves ONLY an actual Engine-created
            // immutable ciphertext inode, not a seeded format/admission/token.
            Files.move(x.committed,x.pending);
            var pending=Files.readAttributes(x.pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var directory=Files.readAttributes(x.dir,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            Path lock=x.dir.resolve(NativePrivateCustodyOperationStore.LOCK);
            var lockBefore=Files.readAttributes(lock,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] bytes=Files.readAllBytes(x.pending);assertNotNull(pending.fileKey());
            var stable=new NativeRetainedNamespaceCensusTest.Stable(x.f.x.f.x);
            try {
                assertTrue(Files.notExists(x.committed,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                try(var recovered=x.recover()){
                    assertEquals("PENDING",recovered.projection().getString("journal_phase"));
                    try(var promoted=x.f.engine().resumeOriginalPrivateCustodyOperation(recovered)){
                        var actual=promoted.projection();noAuthority(actual);
                        assertEquals("COMMITTED",actual.getString("journal_phase"));assertTrue(actual.getBoolean("local_operation_committed_observed"));
                        for(String key:new String[] {"operation_id","frame_sha256","record_sha256","original_generation_id","principal_digest",
                            "engine_revision","original_frozen_work_sha256","original_native_mutation_stamp","journal_record_sha256"})
                            assertEquals(original.get(key),actual.get(key));
                    }
                }
                assertTrue(Files.notExists(x.pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                byte[] readback=Files.readAllBytes(x.committed);
                try {assertArrayEquals(bytes,readback);}finally{Arrays.fill(readback,(byte)0);}
                var after=Files.readAttributes(x.committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(pending.fileKey(),after.fileKey());assertEquals(pending.size(),after.size());assertEquals(pending.lastModifiedTime(),after.lastModifiedTime());
                assertEquals(pending.owner(),after.owner());assertEquals(pending.group(),after.group());assertEquals(pending.permissions(),after.permissions());
                assertEquals(PosixFilePermissions.fromString("rw-------"),after.permissions());
                var names=new java.util.HashSet<String>();
                try(var files=Files.newDirectoryStream(x.dir)){for(Path file:files)names.add(file.getFileName().toString());}
                assertEquals(java.util.Set.of(NativePrivateCustodyOperationStore.COMMITTED,NativePrivateCustodyOperationStore.LOCK),names);
                var lockAfter=Files.readAttributes(lock,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(lockBefore.fileKey(),lockAfter.fileKey());assertEquals(0L,lockAfter.size());assertEquals(lockBefore.permissions(),lockAfter.permissions());
                var directoryAfter=Files.readAttributes(x.dir,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directory.fileKey(),directoryAfter.fileKey());assertEquals(directory.owner(),directoryAfter.owner());
                assertEquals(directory.group(),directoryAfter.group());assertEquals(directory.permissions(),directoryAfter.permissions());stable.check();
            } finally {Arrays.fill(bytes,(byte)0);}
        } // No file/key deletion, second resume or replacement operation.
    }

    @Test public void PENDING_OPERATION_unknownTargetRefusesWithoutOverwrite()throws Exception {
        try(var x=new Fixture(true)){
            try(var original=x.prepare()){noAuthority(original.projection());}
            Files.move(x.committed,x.pending);
            try(var pending=x.store.inspectOriginal(x.frame)){
                // Only opaque negative input: preexisting empty committed is
                // NOT the private publisher's own reservation or a valid record.
                try(var unknown=FileChannel.open(x.committed,java.util.Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS),PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                    assertEquals(0L,unknown.size());
                }
                var before=saved(x.dir);var keys=new java.util.HashMap<String,Object>();
                for(String name:before.keySet())keys.put(name,Files.readAttributes(x.dir.resolve(name),
                    java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                var stable=new NativeRetainedNamespaceCensusTest.Stable(x.f.x.f.x);
                try {
                    VaultFailure refused=assertThrows(VaultFailure.class,()->{try(var unexpected=x.store.resumeOriginal(x.frame,pending)){
                        fail("Unknown preexisting target must not be adopted or replaced");}});
                    assertEquals(NativePrivateCustodyOperationStore.FAILURE,refused.code);
                    for(String name:before.keySet()){
                        Path file=x.dir.resolve(name);byte[] after=Files.readAllBytes(file);
                        try {assertArrayEquals(before.get(name),after);}finally{Arrays.fill(after,(byte)0);}
                        assertEquals(keys.get(name),Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                    }
                    assertEquals(0L,Files.size(x.committed));assertTrue(Files.exists(x.pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));stable.check();
                } finally {for(byte[] bytes:before.values())Arrays.fill(bytes,(byte)0);}
            } // Existing outer phase/alias guard may refuse before publisher;
        }     // not a raced-IO proof. Leave both unknown and original files.
    }
}
