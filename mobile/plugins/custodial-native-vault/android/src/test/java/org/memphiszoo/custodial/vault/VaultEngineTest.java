package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public final class VaultEngineTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String OP1 = "11111111-1111-4111-8111-111111111111";
    private static final String OP2 = "22222222-2222-4222-8222-222222222222";
    private static final String REMOVE = "33333333-3333-4333-8333-333333333333";
    private static final String DEVICE = "KIOSK_02";
    private static final String SEAL = "installation-seal-0002";

    /** Changed private pins/binding copies must not cache a successful owner
     * verdict. Existing committed originals and real file-identity guards run;
     * only the host credential/clock/HTTP reply are synthetic test DATA. */
    @Test public void OWNER_COPY_boundUnknownReplacementDuringReplyStillRefusesOnce() throws Exception {
        try(var f=NativePrivateCustodyExchangeTest.GuardedIdentityFixture.boundDurableFirstOriginalForHostModel();
            var write=f.write(0)) {
            var row=NativePrivateCustodyReplySetTest.readback(write);
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)) {
                f.engine.fenceOriginalPrivateCustodyExchange(query);
                // Existing test reply recipe only: no Engine/private control,
                // manager, ACK, writer or finalization factory is invoked.
                var recipe=NativePrivateCustodyHttpOutcomeTest.class.getDeclaredMethod("identityPieceReply",
                    NativePrivateCustodyExchangeTest.GuardedIdentityFixture.class,
                    VaultEngine.NativePrivateCustodyPreparedExchange.class,org.json.JSONObject.class,int.class);
                recipe.setAccessible(true);
                byte[] reply=(byte[])recipe.invoke(null,f,query,row,0);
                var originals=NativePrivateCustodyOwnerTest.files(f.dir);
                final int[] opens={0};
                final NativePrivateCustodyHttpOutcomeTest.Connection[] used={null};
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)) {
                    var http=new NativePrivateCustodyHttp(url->{
                        assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                        assertFalse(Thread.holdsLock(f.engine));opens[0]++;
                        used[0]=new NativePrivateCustodyHttpOutcomeTest.Connection(url);used[0].response=reply;
                        used[0].onReply=()->NativePrivateCustodyExchangeTest.replaceIdentityOriginal(
                            f,"query_unknown-0.bin","owner-copy-current-query-unknown");
                        return used[0];
                    },f.clock);
                    org.junit.Assert.assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalPrivateCustodyQuery(
                        dispatch,http,new NativeRetainedHttp.Attempt()));
                    assertEquals(1,opens[0]);assertEquals(1,used[0].disconnects);
                    NativePrivateCustodyOwnerTest.sameFiles(originals,f.dir);
                    assertFalse(java.nio.file.Files.exists(f.dir.resolve("query_observation-0.bin")));
                    assertFalse(java.nio.file.Files.exists(f.dir.resolve("write_observation-0.bin")));
                    // Restoring the original bytes cannot revive this same
                    // refused/closed dispatch or open a second connection.
                    org.junit.Assert.assertThrows(VaultFailure.class,()->f.engine.readCurrentOriginalPrivateCustodyQuery(
                        dispatch,http,new NativeRetainedHttp.Attempt()));
                    assertEquals(1,opens[0]);NativePrivateCustodyOwnerTest.sameFiles(originals,f.dir);
                } finally {
                    java.util.Arrays.fill(reply,(byte)0);NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(originals);
                }
            }
        }
    }

    /** Only the newly affected entry refusal, never the historical suite. */
    public static void main(String[] args) throws Exception {
        if(args.length==1&&"--owner-copy-currentness-only".equals(args[0])) {
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,
                "OWNER_COPY_boundUnknownReplacementDuringReplyStillRefusesOnce"));
            if(result.getRunCount()!=1||!result.wasSuccessful()) {
                for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);
                throw new AssertionError("new bound owning currentness member failed");
            }
            System.out.println("PASS_NEW_OWNER_COPY_BOUND_UNKNOWN_REPLACEMENT zero acceptance, one read, no retry");
            System.out.println("HOST_DATA_IDENTITY_ONLY_NOT_ANDROID_SQL_ACK_FINALIZATION_OR_A2_PROOF");return;
        }
        if(args.length==1&&"--protected-enrollment-separation-entry-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,
                "PROTECTED_SEPARATION_typedEntryRetainsMissingAndLockedOriginals"));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError("protected separation entry");
            System.out.println("PASS_NEW_PROTECTED_SEPARATION_ENTRY; null/locked/closed original zero effects; positive ACK/commit/restart/Android NOT_RUN");return;
        }
        if(args.length==2&&"--original-one-shot-finalization-entry-only".equals(args[0])){
            if(!java.util.Set.of("ONE_SHOT_FINALIZATION_missingOriginalNeverActs",
                "ONE_SHOT_FINALIZATION_lockedEntryNeverActs","ONE_SHOT_FINALIZATION_closedAckHasNoDataFactory").contains(args[1]))
                throw new IllegalArgumentException("new one-shot finalization boundary member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,args[1]));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError(args[1]);
            System.out.println("PASS_NEW_ONE_SHOT_FINALIZATION_BOUNDARY "+args[1]+"; positive owning ACK/commit/restart/Android NOT_RUN");return;
        }
        if(args.length==2&&"--logical-separation-admission-entry-only".equals(args[0])){
            if(!java.util.Set.of("LOGICAL_ADMISSION_missingOriginalHasZeroEffects","LOGICAL_ADMISSION_lockedOrIncompleteEntryRefuses",
                "LOGICAL_ADMISSION_noPublicReceiptFactory").contains(args[1]))throw new IllegalArgumentException("new logical admission entry member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,args[1]));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError("logical admission entry failed");
            System.out.println("PASS_NEW_LOGICAL_ADMISSION_ENTRY "+args[1]+"; valid private admission/finalizer/Android NOT_RUN");return;
        }
        if(args.length==2&&"--inventory-manifest-entry-only".equals(args[0])){
            if(!java.util.Set.of("MANIFEST_missingOriginalHasZeroEffects","MANIFEST_engineMonitorRefusesBeforeIO",
                "MANIFEST_missingTypedSignerAndDispatchCannotOpenNetwork").contains(args[1]))throw new IllegalArgumentException("new manifest entry member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,args[1]));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError("manifest owning entry refused incorrectly");
            System.out.println("PASS_NEW_MANIFEST_ENTRY_REFUSAL "+args[1]+"; valid current manifest publication/crash recovery NOT_RUN");return;
        }
        if(args.length==1&&"--inventory-ack-request-entry-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,
                "inventoryAckRequestMissingOriginalCannotSignOrOpenRemoval"));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError("inventory request entry refusal failed");
            System.out.println("PASS_NEW_MISSING_ORIGINAL_REQUEST_AND_PURPOSE_SIGNER_REFUSAL; valid signing/journal/transport/ACK NOT_RUN");return;
        }
        if(args.length==1&&"--inventory-ack-intent-entry-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,
                "inventoryAckIntentMissingOriginalCannotMintOrOpenLegacyRemoval"));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError("inventory ACK intent entry refusal failed");
            System.out.println("PASS_NEW_LOCAL_ACK_INTENT_MISSING_ORIGINAL_REFUSAL; valid issuer/journal/ACK/finalizer NOT_RUN");return;
        }
        if(args.length==2&&"--enrollment-existing-fence-only".equals(args[0])){
            if(!java.util.Set.of("ENROLL_FENCE_requestedStopsDispatchCommit",
                "ENROLL_FENCE_dispatchedStopsEnrollmentTransport",
                "ENROLL_FENCE_dispatchedStopsCancellationTransport",
                "ENROLL_FENCE_uncertainDispatchCannotReadBackPastDenial",
                "ENROLL_FENCE_priorDispatchCannotReplayPastDenial",
                "ENROLL_FENCE_readbackDenialCannotBecomeCompensation",
                "ENROLL_FENCE_allowedExactUncertainDispatchStagesOnce").contains(args[1]))
                throw new IllegalArgumentException("new enrollment fence member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,args[1]));
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            if(result.getRunCount()!=1||!result.wasSuccessful())throw new AssertionError(args[1]);
            System.out.println("PASS_SOURCE_MEMORY_ENROLLMENT_FENCE "+args[1]);return;
        }
        if(args.length!=1||!"--g08-reentrant-challenge-only".equals(args[0]))throw new IllegalArgumentException("new owning selector required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(VaultEngineTest.class,
            "originalRecoveryChallengeRejectsExternallyHeldEngineBeforeAnyEffects"));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful())throw new AssertionError("new original challenge lock refusal failed");
        System.out.println("PASS_NEW_SOURCE_REENTRANT_ENGINE_REFUSAL_NO_AUTHENTICATED_DISPATCH_OR_ANDROID_PROOF");
    }

    private static java.lang.reflect.Method originalOneShotEntry()throws Exception {
        var method=VaultEngine.class.getDeclaredMethod("finalizeOriginalInventoryPreservingWork",
            VaultEngine.NativeOriginalInventoryAckRequestControl.class,NativeOriginalInventoryAckRequestJournal.Result.class,
            NativePrivateCustodyHttp.class,NativePrivateCustodyFrameReadControl.class);
        assertTrue(java.lang.reflect.Modifier.isPrivate(method.getModifiers()));method.setAccessible(true);return method;
    }
    private static void invokeOriginalOneShot(VaultEngine engine,NativePrivateCustodyHttp http,
        NativePrivateCustodyFrameReadControl control)throws Exception {
        try{originalOneShotEntry().invoke(engine,null,null,http,control);}
        catch(java.lang.reflect.InvocationTargetException failure){
            if(failure.getCause() instanceof VaultFailure)throw (VaultFailure)failure.getCause();throw failure;
        }
    }
    @Test public void PROTECTED_SEPARATION_typedEntryRetainsMissingAndLockedOriginals()throws Exception {
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("unowned protected entry opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.separateHeldOriginalEnrollmentKeepingWork(null,null,http,control));
            synchronized(f.engine){expectCode("custodial_native_vault_concurrent_change",
                ()->f.engine.separateHeldOriginalEnrollmentKeepingWork(null,null,http,control));}
            control.close();
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.separateHeldOriginalEnrollmentKeepingWork(null,null,http,control));
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
        expectCode("custodial_native_removal_inventory_admission_required",f.engine::requireOriginalRemovalAdmission);
        var runtime=CustodialNativeRuntime.class.getDeclaredMethod("separateHeldOriginalEnrollmentKeepingWork",NativePrivateCustodyFrameReadControl.class);
        assertFalse(java.lang.reflect.Modifier.isPublic(runtime.getModifiers()));
        assertEquals(org.json.JSONObject.class,runtime.getReturnType());
        assertTrue(java.util.Arrays.equals(new Class<?>[]{NativePrivateCustodyFrameReadControl.class},runtime.getParameterTypes()));
    }

    @Test public void ONE_SHOT_FINALIZATION_missingOriginalNeverActs()throws Exception {
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("missing original opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            expectCode(NativeRetainedAttempt.FAILURE,()->invokeOriginalOneShot(f.engine,http,control));
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
        expectCode("custodial_native_removal_inventory_admission_required",f.engine::requireOriginalRemovalAdmission);
    }
    @Test public void ONE_SHOT_FINALIZATION_lockedEntryNeverActs()throws Exception {
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("locked entry opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            synchronized(f.engine){expectCode("custodial_native_vault_concurrent_change",()->invokeOriginalOneShot(f.engine,http,control));}
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void ONE_SHOT_FINALIZATION_closedAckHasNoDataFactory()throws Exception {
        Class<?> ack=java.util.Arrays.stream(VaultEngine.class.getDeclaredClasses())
            .filter(type->type.getSimpleName().equals("NativeOriginalInventoryAcknowledgement")).findFirst().orElseThrow();
        assertTrue(java.lang.reflect.Modifier.isPrivate(ack.getModifiers()));
        assertEquals(1,ack.getDeclaredConstructors().length);
        var constructor=ack.getDeclaredConstructors()[0];assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        assertTrue(java.util.Arrays.equals(new Class<?>[]{VaultEngine.NativeOriginalInventoryDecisionReadLease.class},constructor.getParameterTypes()));
        for(var method:ack.getDeclaredMethods()){
            if(method.getName().equals("close"))continue;
            assertTrue(java.lang.reflect.Modifier.isPrivate(method.getModifiers()));
        }
        var factory=VaultEngine.class.getDeclaredMethod("prepareOriginalInventoryFinalization",ack);
        assertTrue(java.lang.reflect.Modifier.isPrivate(factory.getModifiers()));
        assertEquals(VaultEngine.NativeOriginalInventoryFinalizationControl.class,factory.getReturnType());
        for(var method:VaultEngine.class.getDeclaredMethods())if(method.getName().equals("prepareOriginalInventoryFinalization"))
            assertTrue(java.util.Arrays.equals(new Class<?>[]{ack},method.getParameterTypes()));
        // Reflection inspects API shape only. Never construct or patch a
        // private ACK, Source owner, current manager or finalization control.
    }

    @Test public void LOGICAL_ADMISSION_missingOriginalHasZeroEffects()throws Exception{
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("unowned logical admission opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.readOriginalInventoryDecisionLease(null,null,http,control));
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.retainOriginalInventoryManagerDecisionObservation(null,null,http,control));
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
        assertEquals(0,f.transport.enrollCalls.get());assertEquals(0,f.transport.issuanceCount.get());
        expectCode("custodial_native_removal_inventory_admission_required",f.engine::requireOriginalRemovalAdmission);
    }
    @Test public void LOGICAL_ADMISSION_lockedOrIncompleteEntryRefuses()throws Exception{
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("incomplete logical admission opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            synchronized(f.engine){expectCode("custodial_native_vault_concurrent_change",
                ()->f.engine.readOriginalInventoryDecisionLease(null,null,http,control));}
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.readOriginalInventoryDecisionLease(null,null,null,control));
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.readOriginalInventoryDecisionLease(null,null,http,null));
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void LOGICAL_ADMISSION_noPublicReceiptFactory()throws Exception{
        Class<?> type=VaultEngine.NativeOriginalInventoryDecisionReadLease.class;
        for(var constructor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        for(var method:type.getDeclaredMethods()){
            assertFalse(java.lang.reflect.Modifier.isStatic(method.getModifiers()));
            assertFalse(java.lang.reflect.Modifier.isPublic(method.getModifiers())&&!"close".equals(method.getName()));
            assertFalse("A decision read must not grant finalizer effects",method.getName().equals("beginLocalFinalization"));
            assertTrue("Read lease methods expose no admission/effect operation",
                java.util.Set.of("requireCurrent","projection","close").contains(method.getName()));
        }
        var entry=VaultEngine.class.getDeclaredMethod("readOriginalInventoryDecisionLease",
            VaultEngine.NativeOriginalInventoryAckRequestControl.class,NativeOriginalInventoryAckRequestJournal.Result.class,
            NativePrivateCustodyHttp.class,NativePrivateCustodyFrameReadControl.class);
        assertFalse(java.lang.reflect.Modifier.isPublic(entry.getModifiers()));
        assertEquals(type,entry.getReturnType());
    }
    @Test public void MANIFEST_missingOriginalHasZeroEffects()throws Exception{
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("missing original opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            expectCode(NativeRetainedAttempt.FAILURE,()->f.engine.advanceOriginalInventoryManifest(null,null,http,control));
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);assertEquals(0,opens.get());
        assertEquals(0,f.transport.enrollCalls.get());assertEquals(0,f.transport.issuanceCount.get());
        expectCode("custodial_native_removal_inventory_admission_required",f.engine::requireOriginalRemovalAdmission);
    }
    @Test public void MANIFEST_engineMonitorRefusesBeforeIO()throws Exception{
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("locked original opened HTTP");},f.clock);
        try(var control=new NativePrivateCustodyFrameReadControl()){
            synchronized(f.engine){expectCode("custodial_native_vault_concurrent_change",()->f.engine.advanceOriginalInventoryManifest(null,null,http,control));}
        }
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void MANIFEST_missingTypedSignerAndDispatchCannotOpenNetwork()throws Exception{
        Fixture f=new Fixture();var before=f.persistence.load();var opens=new java.util.concurrent.atomic.AtomicInteger();
        expectCode(NativeRetainedAttempt.FAILURE,()->NativeAttestation.originalInventoryManifestChunkPurposeSignature(null,null));
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("unbound dispatcher opened HTTP");},f.clock);
        try{http.exchangeOriginalInventoryManifestChunk(null,"KIOSK_02",new char[0],new NativeRetainedHttp.Attempt());fail("unbound dispatch accepted");}
        catch(VaultFailure refused){assertEquals("custodial_private_custody_transport_outcome_unknown",refused.code);}
        assertTrue(before==f.persistence.load());assertEquals(0,f.persistence.commitAttempts.get());assertEquals(0,opens.get());
        assertEquals(0,f.cipher.existingKeyEncryptCalls);assertEquals(0,f.cipher.destroyCalls);
    }

    @Test
    public void inventoryAckIntentMissingOriginalCannotMintOrOpenLegacyRemoval()throws Exception{
        Fixture fixture=new Fixture();var before=fixture.persistence.load();
        expectCode(NativeRetainedAttempt.FAILURE,()->fixture.engine.prepareOriginalInventoryAckIntentControl(null,null));
        try(var control=new NativePrivateCustodyFrameReadControl()){
            expectCode(NativeRetainedAttempt.FAILURE,()->fixture.engine.prepareOriginalInventoryAckIntentControl(null,control));
        }
        expectCode("custodial_native_removal_inventory_admission_required",fixture.engine::requireOriginalRemovalAdmission);
        assertEquals(before,fixture.persistence.load());
        assertEquals(0,fixture.transport.enrollCalls.get());assertEquals(0,fixture.cipher.destroyCalls);
    }

    @Test
    public void inventoryAckRequestMissingOriginalCannotSignOrOpenRemoval()throws Exception{
        Fixture fixture=new Fixture();var before=fixture.persistence.load();
        expectCode(NativeRetainedAttempt.FAILURE,()->fixture.engine.prepareOriginalInventoryAckRequestControl(null,null));
        expectCode(NativeRetainedAttempt.FAILURE,()->NativeAttestation.originalInventoryAckRequestPurposeSignature(null,null));
        expectCode("custodial_native_removal_inventory_admission_required",fixture.engine::requireOriginalRemovalAdmission);
        assertTrue(before==fixture.persistence.load());assertEquals(0,fixture.persistence.commitAttempts.get());
        assertEquals(0,fixture.cipher.existingKeyEncryptCalls);assertEquals(0,fixture.cipher.destroyCalls);
        assertEquals(0,fixture.transport.enrollCalls.get());assertEquals(0,fixture.transport.issuanceCount.get());
    }

    @Test
    public void originalRecoveryChallengeRejectsExternallyHeldEngineBeforeAnyEffects() throws Exception {
        Fixture fixture=new Fixture();var before=fixture.persistence.load();
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var http=new NativePrivateCustodyHttp(url->{opens.incrementAndGet();throw new AssertionError("locked caller opened network");},fixture.clock);
        synchronized(fixture.engine){
            expectCode("custodial_native_vault_concurrent_change",()->fixture.engine.sendOriginalRecoveryChallenge(
                null,http,new NativeRetainedHttp.Attempt()));
        }
        // The lock refusal precedes even missing-input inspection; no prepared
        // capability is minted merely to exercise this entry boundary.
        assertTrue(before==fixture.persistence.load());assertEquals(0,fixture.persistence.commitAttempts.get());
        assertEquals(0,fixture.cipher.existingKeyEncryptCalls);assertEquals(0,fixture.cipher.destroyCalls);
        assertEquals(0,fixture.transport.enrollCalls.get());assertEquals(0,fixture.transport.issuanceCount.get());assertEquals(0,opens.get());
    }

    private static final String FENCE_DENIED="test_ordinary_vault_admission_denied";
    private static VaultEngine withEnrollmentFence(Fixture f,NativeSeparationFreeze.OrdinaryVaultAdmission admission){
        return new VaultEngine(f.persistence,f.cipher,f.transport,f.legacy,f.seals,f.clock,admission);
    }
    /** Admission can only refuse. These are actual MemoryPersistence commits
     * and FakeTransport calls, never a reflected private positive capability. */
    @Test public void ENROLL_FENCE_requestedStopsDispatchCommit()throws Exception {
        Fixture f=new Fixture();AtomicReference<VaultSnapshot> requested=new AtomicReference<>();
        f.engine=withEnrollmentFence(f,()->{
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_REQUESTED){
                requested.set(f.persistence.current());throw new VaultFailure(FENCE_DENIED);
            }
        });
        VaultFailure failure=null;
        try{f.engine.enroll(OP1,DEVICE,"enrollment",code());}catch(VaultFailure error){failure=error;}
        assertEquals("Only the original REQUESTED commit is admitted",1,f.persistence.commitAttempts.get());
        assertEquals(0,f.transport.enrollCalls.get());assertEquals(0,f.transport.issuanceCount.get());
        assertNotNull(failure);assertEquals(FENCE_DENIED,failure.code);
        assertTrue(requested.get()==f.persistence.current());assertEquals(OP1,f.persistence.current().operationId);
        assertEquals(SecretKind.ENROLLMENT_CODE,f.persistence.current().secretKind);assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void ENROLL_FENCE_dispatchedStopsEnrollmentTransport()throws Exception {
        Fixture f=new Fixture();var dispatchedChecks=new java.util.concurrent.atomic.AtomicInteger();
        f.engine=withEnrollmentFence(f,()->{
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_DISPATCHED&&dispatchedChecks.incrementAndGet()>1)
                throw new VaultFailure(FENCE_DENIED);
        });
        VaultFailure failure=null;
        try{f.engine.enroll(OP1,DEVICE,"enrollment",code());}catch(VaultFailure error){failure=error;}
        assertEquals("Admission withdrawal must precede actual enroll transport",0,f.transport.enrollCalls.get());
        assertEquals(0,f.transport.issuanceCount.get());assertNotNull(failure);assertEquals(FENCE_DENIED,failure.code);
        assertEquals(VaultPhase.ENROLLMENT_DISPATCHED,f.persistence.current().phase);
        assertEquals(2,f.persistence.commitAttempts.get());assertEquals(OP1,f.persistence.current().operationId);
        assertEquals(SecretKind.ENROLLMENT_CODE,f.persistence.current().secretKind);assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void ENROLL_FENCE_dispatchedStopsCancellationTransport()throws Exception {
        Fixture f=new Fixture();f.persistence.failBeforeCommits.add(2);
        expectCode("test_commit_failure",()->f.engine.enroll(OP1,DEVICE,"enrollment",code()));
        VaultSnapshot requested=f.persistence.current();assertEquals(VaultPhase.ENROLLMENT_REQUESTED,requested.phase);
        var dispatchedChecks=new java.util.concurrent.atomic.AtomicInteger();
        f.engine=withEnrollmentFence(f,()->{
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_DISPATCHED&&dispatchedChecks.incrementAndGet()>1)
                throw new VaultFailure(FENCE_DENIED);
        });
        VaultFailure failure=null;
        try{f.engine.cancelEnrollment(OP1);}catch(VaultFailure error){failure=error;}
        assertEquals("Cancellation recovery cannot enroll behind the fence",0,f.transport.enrollCalls.get());
        assertEquals(0,f.transport.issuanceCount.get());assertEquals(0,f.transport.cancelCalls.get());
        assertNotNull(failure);assertEquals(FENCE_DENIED,failure.code);
        assertEquals(VaultPhase.ENROLLMENT_DISPATCHED,f.persistence.current().phase);
        assertTrue(requested.secret==f.persistence.current().secret);assertEquals(OP1,f.persistence.current().operationId);
    }
    @Test public void ENROLL_FENCE_uncertainDispatchCannotReadBackPastDenial()throws Exception {
        Fixture f=new Fixture();f.persistence.writeThenFailCommits.add(2);
        f.engine=withEnrollmentFence(f,()->{
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_DISPATCHED)throw new VaultFailure(FENCE_DENIED);
        });
        VaultFailure failure=null;
        try{f.engine.enroll(OP1,DEVICE,"enrollment",code());}catch(VaultFailure error){failure=error;}
        assertEquals("Exact landed bytes do not re-admit transport",0,f.transport.enrollCalls.get());
        assertNotNull(failure);assertEquals(FENCE_DENIED,failure.code);
        assertEquals(2,f.persistence.commitAttempts.get());assertEquals(VaultPhase.ENROLLMENT_DISPATCHED,f.persistence.current().phase);
        assertEquals(OP1,f.persistence.current().operationId);assertEquals(SecretKind.ENROLLMENT_CODE,f.persistence.current().secretKind);
        assertEquals(0,f.transport.issuanceCount.get());assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void ENROLL_FENCE_priorDispatchCannotReplayPastDenial()throws Exception {
        Fixture f=new Fixture();f.transport.failEnrollBeforeIssueNetwork=1;
        expectCode("custodial_native_network_unavailable",()->f.engine.enroll(OP1,DEVICE,"enrollment",code()));
        VaultSnapshot original=f.persistence.current();assertEquals(VaultPhase.ENROLLMENT_DISPATCHED,original.phase);
        var checks=new java.util.concurrent.atomic.AtomicInteger();
        f.engine=withEnrollmentFence(f,()->{
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_DISPATCHED&&checks.incrementAndGet()>1)
                throw new VaultFailure(FENCE_DENIED);
        });
        VaultFailure failure=null;
        try{f.engine.resumeEnrollment(OP1);}catch(VaultFailure error){failure=error;}
        assertEquals("The original failed dispatch must not be retried behind admission",1,f.transport.enrollCalls.get());
        assertEquals(0,f.transport.issuanceCount.get());assertTrue(original==f.persistence.current());
        assertNotNull(failure);assertEquals(FENCE_DENIED,failure.code);
    }
    @Test public void ENROLL_FENCE_allowedExactUncertainDispatchStagesOnce()throws Exception {
        Fixture f=new Fixture();f.persistence.writeThenFailCommits.add(2);
        f.engine=withEnrollmentFence(f,()->{});
        EnrollmentView view=f.engine.enroll(OP1,DEVICE,"enrollment",code());
        assertEquals(VaultPhase.CREDENTIAL_STAGED,view.phase);assertEquals(OP1,f.persistence.current().operationId);
        assertEquals(1,f.transport.enrollCalls.get());assertEquals(1,f.transport.issuanceCount.get());
        int attempts=f.persistence.commitAttempts.get();
        assertEquals(VaultPhase.CREDENTIAL_STAGED,f.engine.resumeEnrollment(OP1).phase);
        assertEquals(attempts,f.persistence.commitAttempts.get());assertEquals(1,f.transport.enrollCalls.get());
        assertEquals(0,f.cipher.destroyCalls);
    }
    @Test public void ENROLL_FENCE_readbackDenialCannotBecomeCompensation()throws Exception {
        Fixture f=new Fixture();var checks=new java.util.concurrent.atomic.AtomicInteger();
        var denied=new VaultFailure("custodial_native_vault_concurrent_change");
        f.engine=withEnrollmentFence(f,()->{
            // Allow the mark postcheck, pretransport check, and received-result
            // check. Refuse the actual staging readback once; later allowance
            // cannot reclassify this denial as a persistence failure.
            if(f.persistence.current().phase==VaultPhase.ENROLLMENT_DISPATCHED&&checks.incrementAndGet()==4)throw denied;
        });
        VaultFailure failure=null;
        try{f.engine.enroll(OP1,DEVICE,"enrollment",code());}catch(VaultFailure error){failure=error;}
        assertEquals("An admission denial cannot enter compensating transport",0,f.transport.cancelCalls.get());
        assertTrue(failure==denied);assertEquals(1,f.transport.enrollCalls.get());assertEquals(1,f.transport.issuanceCount.get());
        assertEquals(VaultPhase.ENROLLMENT_DISPATCHED,f.persistence.current().phase);
        assertEquals(SecretKind.ENROLLMENT_CODE,f.persistence.current().secretKind);assertEquals(2,f.persistence.commitAttempts.get());
    }

    @Test
    public void fullLifecycleKeepsGenericTransportActiveOnlyAndEndsEmpty() throws Exception {
        Fixture fixture = new Fixture();
        assertEquals("EMPTY", fixture.engine.getState().get("state"));

        EnrollmentView enrolled = fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        assertEquals("CREDENTIAL_STAGED", enrolled.phase.name());
        assertFalse(enrolled.safeData().containsKey("device_credential"));
        expectCode("custodial_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ));

        Map<String, Object> pending = fixture.engine.completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", pending.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) pending.get("installation")).get("device_id"));
        assertFalse(pending.containsKey("device_credential"));

        Map<String, Object> active = fixture.engine.confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals("enrollment", active.get("active_enrollment_flow"));
        assertEquals(OP1, ((Map<?, ?>) active.get("installation")).get("enrollment_operation_id"));
        AuthorizedResponse response = fixture.engine.authorizedRequest(DEVICE, request("/device-auth/status?device_id=KIOSK_02"));
        assertEquals(200, response.status);

        RemovalView removal = fixture.engine.removeEnrollment(REMOVE, DEVICE);
        assertTrue(removal.removed);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        assertFalse(fixture.persistence.current().hasCredential());
        Map<String, Object> empty = fixture.engine.finalizeRemoval(REMOVE);
        assertEquals("EMPTY", empty.get("state"));
        assertEquals(1, fixture.cipher.destroyCalls);
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void assignedActivationSecretCompletesProtectedEnrollmentWithoutEmployeeCode() throws Exception {
        Fixture fixture = new Fixture();
        char[] activation = ("A".repeat(42) + "_").toCharArray();
        EnrollmentView staged = fixture.engine.enroll(OP1, DEVICE, "enrollment", activation);
        VaultValidation.wipe(activation);
        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        fixture.engine.completeLocalBinding(OP1);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(DEVICE, fixture.engine.requireActiveDevice(DEVICE));
        assertEquals(1, fixture.transport.issuanceCount.get());
    }

    @Test
    public void malformedAssignedActivationNeverReachesEnrollmentTransport() throws Exception {
        Fixture fixture = new Fixture();
        expectCode("custodial_native_invalid_enrollment", () -> fixture.engine.enroll(
            OP1, DEVICE, "enrollment", ("A".repeat(42) + "+").toCharArray()
        ));
        assertEquals(0, fixture.transport.enrollCalls.get());
        assertEquals("EMPTY", fixture.persistence.current().phase.name());
    }

    @Test
    public void assignedReceiverOperationDerivesInitialAndRecoveryFlow() throws Exception {
        Fixture fixture = new Fixture();
        char[] token = ("A".repeat(42) + "_").toCharArray();
        assertEquals("ACTIVE", fixture.engine.activateAssignedDevice(OP1, DEVICE, token).get("state"));
        InstallationBinding original = fixture.persistence.current().installation;
        assertEquals("enrollment", fixture.persistence.current().flow);
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        assertEquals("ACTIVE", fixture.restart().activateAssignedDevice(OP2, DEVICE, token).get("state"));
        assertEquals("recovery", fixture.persistence.current().flow);
        assertEquals(original, fixture.persistence.current().installation);
        int issued = fixture.transport.issuanceCount.get();
        assertEquals("ACTIVE", fixture.restart().activateAssignedDevice(OP2, DEVICE, token).get("state"));
        assertEquals(issued, fixture.transport.issuanceCount.get());
    }

    @Test
    public void assignedReceiverRequiresAuthoritativeRecoveryAndExactDevice() throws Exception {
        Fixture fixture = activeFixture();
        int commits=fixture.persistence.commitAttempts.get();
        assertEquals(OP1, fixture.engine.activateAssignedDevice(OP2, DEVICE, code()).get("active_enrollment_operation_id"));
        assertEquals(commits,fixture.persistence.commitAttempts.get());
        assertEquals(1,fixture.transport.issuanceCount.get());
        fixture.transport.activeCredentialStatus = ActiveCredentialStatus.ENROLLMENT_REQUIRED;
        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.activateAssignedDevice(OP2, "KIOSK_03", code()));
        assertEquals("ACTIVE", fixture.engine.activateAssignedDevice(OP2, DEVICE, code()).get("state"));
        assertEquals("recovery", fixture.persistence.current().flow);
        assertEquals(2, fixture.transport.issuanceCount.get());
    }

    @Test
    public void assignedHealthyDecisionDoesNotGuessOnNetworkFailure() throws Exception {
        Fixture fixture=activeFixture();
        fixture.transport.activeCredentialVerificationHttpFailure=503;
        int commits=fixture.persistence.commitAttempts.get();
        expectCode("custodial_native_credential_revalidation_failed",()->fixture.engine.activateAssignedDevice(OP2,DEVICE,code()));
        assertEquals(commits,fixture.persistence.commitAttempts.get());
        assertEquals(1,fixture.transport.issuanceCount.get());
    }

    @Test
    public void nativeReceiptBindsCredentialAndOriginalLineageAndSurvivesLostResponse() throws Exception {
        Fixture fixture=activeFixture();String digest="a".repeat(64);
        fixture.transport.loseAssignedReceipt=true;
        expectCode("custodial_native_network_unavailable",()->fixture.engine.reportAssignedActivation(OP1,DEVICE,OP1,OP1,digest));
        assertEquals("native_active",fixture.restart().reportAssignedActivation(OP1,DEVICE,OP1,OP1,digest));
        assertEquals(2,fixture.transport.assignedReceiptCalls);
        assertEquals(OP1,fixture.transport.assignedReceipt.get("lineage_operation_id"));
        assertEquals(OP1,fixture.transport.assignedReceipt.get("credential_id"));
        assertFalse(fixture.transport.assignedReceipt.containsKey("installation_seal"));
        assertEquals(1,fixture.transport.issuanceCount.get());
        expectCode("custodial_assigned_activation_proof_invalid",()->fixture.engine.reportAssignedActivation(OP1,DEVICE,OP2,OP1,digest));
        expectCode("custodial_assigned_activation_proof_invalid",()->fixture.engine.reportAssignedActivation(OP1,DEVICE,OP1,OP2,digest));
        assertEquals(2,fixture.transport.assignedReceiptCalls);
    }
    @Test
    public void healthyNativeReceiptReportsNoChangeUnderOriginalCredential() throws Exception {
        Fixture fixture=activeFixture();
        fixture.engine.activateAssignedDevice(OP2,DEVICE,code());
        assertEquals("not_required",fixture.engine.reportAssignedActivation(OP2,DEVICE,OP1,OP1,"b".repeat(64)));
        assertEquals(Boolean.FALSE,fixture.transport.assignedReceipt.get("changed"));
        assertEquals(OP2,fixture.transport.assignedReceipt.get("operation_id"));
        assertEquals(OP1,fixture.transport.assignedReceipt.get("lineage_operation_id"));
        assertEquals(1,fixture.transport.issuanceCount.get());
    }

    @Test
    public void assignedReceiverResumesExactOperationAfterResponseLoss() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.activateAssignedDevice(OP2, DEVICE, code()));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.restart().activateAssignedDevice(REMOVE, DEVICE, code()));
        assertEquals("ACTIVE", fixture.restart().activateAssignedDevice(OP2, DEVICE, code()).get("state"));
        assertEquals(original, fixture.persistence.current().installation);
        assertEquals(2, fixture.transport.issuanceCount.get());
    }

    @Test
    public void activeCredentialCannotBeOverwrittenByDirectRecoveryEnrollment() throws Exception {
        Fixture fixture = activeFixture();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        int enrollCallsBefore = fixture.transport.enrollCalls.get();

        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "00000000".toCharArray()
        ));

        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(enrollCallsBefore, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.transport.activeCredentialVerificationCalls.get());
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ).status);
    }

    @Test
    public void exactServerEnrollmentRequiredProofAllowsOneActiveCredentialRecovery() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.activeCredentialStatus = ActiveCredentialStatus.ENROLLMENT_REQUIRED;

        EnrollmentView recovered = fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "87654321".toCharArray()
        );

        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.activeCredentialVerificationCalls.get());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(2, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        fixture.engine.completeLocalBinding(OP2);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP2);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals("recovery", active.get("active_enrollment_flow"));
        assertEquals(OP2, fixture.persistence.current().operationId);
        assertEquals(OP1, ((Map<?, ?>) active.get("installation")).get("enrollment_operation_id"));
    }

    @Test
    public void boundedServerClockLeadCannotCancelValidRecovery() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.resumeTtlMillis = 30L * 60L * 1000L + 1_500L;

        EnrollmentView staged = fixture.engine.enroll(OP1, DEVICE, "recovery", code());

        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        assertEquals(NOW + 30L * 60L * 1000L, fixture.persistence.current().expiresAtMillis);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertFalse(fixture.transport.cancelled(OP1));
    }

    @Test
    public void excessiveServerClockLeadFailsClosedAndCancelsIssuedCredential() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.resumeTtlMillis = 32L * 60L * 1000L + 1L;

        expectCode("custodial_native_invalid_enrollment_response", () ->
            fixture.engine.enroll(OP1, DEVICE, "recovery", code())
        );

        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
        assertTrue(fixture.transport.cancelled(OP1));
    }

    @Test
    public void migratedActiveCredentialWithoutMetadataIdUsesProtectedCredentialIdForRecovery() throws Exception {
        Fixture fixture = activeFixture();
        VaultSnapshot current = fixture.persistence.current();
        VaultSnapshot migrated = current.next(
            current.phase,
            current.secretKind,
            current.secret,
            current.operationId,
            current.deviceId,
            current.flow,
            current.expiresAtMillis,
            current.installation,
            EnrollmentMetadata.empty(),
            current.removalOperationId,
            current.blockedReason,
            current.legacyHadBinding,
            current.legacySeal
        );
        fixture.persistence.commit(current.revision, migrated);
        fixture.restart();
        fixture.transport.activeCredentialStatus = ActiveCredentialStatus.ENROLLMENT_REQUIRED;

        Map<String, Object> before = fixture.engine.getState();
        assertEquals("ACTIVE", before.get("state"));
        assertEquals(true, before.get("credential_usable"));

        EnrollmentView recovered = fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "87654321".toCharArray()
        );

        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.activeCredentialVerificationCalls.get());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(2, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void serverRequiredRecoveryCommitFailureKeepsTheCurrentVaultReadable() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.activeCredentialStatus = ActiveCredentialStatus.ENROLLMENT_REQUIRED;
        fixture.persistence.failBeforeCommits.add(fixture.persistence.commitAttempts.get() + 1);

        expectCode("test_commit_failure", () -> fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "87654321".toCharArray()
        ));

        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ).status);
    }

    @Test
    public void ambiguousServerCredentialRevalidationPreservesTheCurrentVault() throws Exception {
        Fixture fixture = activeFixture();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        int enrollCallsBefore = fixture.transport.enrollCalls.get();
        fixture.transport.activeCredentialVerificationHttpFailure = 503;

        VaultFailure failure = expectCode(
            "custodial_native_credential_revalidation_failed",
            () -> fixture.engine.enroll(OP2, DEVICE, "recovery", "87654321".toCharArray())
        );

        assertEquals(503, failure.httpStatus);
        assertEquals(1, fixture.transport.activeCredentialVerificationCalls.get());
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(enrollCallsBefore, fixture.transport.enrollCalls.get());
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ).status);
    }

    @Test
    public void corruptCredentialRecoveryDoesNotDestroyTheSharedWorkKey() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        EncryptedSecret work = fixture.cipher.encrypt("retained-offline-test-record".toCharArray());
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        EnrollmentView result = fixture.engine.enroll(OP2, DEVICE, "recovery", code());
        assertEquals("CREDENTIAL_STAGED", result.phase.name());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(1, fixture.cipher.existingKeyEncryptCalls);
        assertEquals("retained-offline-test-record", new String(fixture.cipher.decrypt(work)));
        assertEquals(original, fixture.persistence.current().installation);
        fixture.restart().completeLocalBinding(OP2);
        fixture.restart().confirmEnrollment(OP2);
        assertEquals(original.safeRecord(), fixture.engine.getState().get("installation"));
        assertEquals(1, fixture.seals.calls.get());
    }

    @Test
    public void recoveryLineageSurvivesLostResponseAndCodecRestart() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP2, DEVICE, "recovery", code()));
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        assertEquals(original, codec.decode(codec.encode(fixture.persistence.current())).installation);
        fixture.restart().resumeEnrollment(OP2);
        fixture.engine.completeLocalBinding(OP2);
        fixture.restart().confirmEnrollment(OP2);
        assertEquals(original, fixture.persistence.current().installation);
    }

    @Test
    public void recoveryLineageSurvivesCancellationAndExactDeviceRetry() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        fixture.engine.enroll(OP2, DEVICE, "recovery", code());
        fixture.engine.cancelEnrollment(OP2);
        assertEquals(original, fixture.persistence.current().installation);
        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(REMOVE, "KIOSK_03", "recovery", code()));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(REMOVE, DEVICE, "enrollment", code()));
        fixture.restart().enroll(REMOVE, DEVICE, "recovery", code());
        fixture.engine.completeLocalBinding(REMOVE);
        fixture.engine.confirmEnrollment(REMOVE);
        assertEquals(original, fixture.persistence.current().installation);
        assertEquals(1, fixture.seals.calls.get());
        assertEquals(0, fixture.cipher.destroyCalls);
    }

    @Test
    public void recoveryLineageSurvivesStageCommitCompensation() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        fixture.persistence.failBeforeCommits.add(fixture.persistence.commitAttempts.get() + 3);
        expectCode("test_commit_failure", () -> fixture.engine.enroll(OP2, DEVICE, "recovery", code()));
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(original, fixture.persistence.current().installation);
        fixture.restart().activateAssignedDevice(REMOVE, DEVICE, code());
        assertEquals(original, fixture.persistence.current().installation);
        assertEquals(1, fixture.seals.calls.get());
    }

    @Test
    public void failedRecoveryEncryptionPreservesKeyAndOriginalRevision() throws Exception {
        Fixture fixture = activeFixture();
        VaultSnapshot original = fixture.persistence.current();
        fixture.cipher.makeUnreadable(original.secret);
        fixture.cipher.failEncrypts = 1;
        int requests = fixture.transport.enrollCalls.get();
        expectCode("test_encrypt_failure", () -> fixture.engine.enroll(OP2, DEVICE, "recovery", code()));
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(original.revision, fixture.persistence.current().revision);
        assertEquals(requests, fixture.transport.enrollCalls.get());
    }

    @Test
    public void missingExistingKeyDoesNotSilentlyCreateOrRotateAReplacement() throws Exception {
        Fixture fixture = activeFixture();
        VaultSnapshot original = fixture.persistence.current();
        fixture.cipher.makeUnreadable(original.secret);
        fixture.cipher.existingKeyUnavailable = true;
        int requests = fixture.transport.enrollCalls.get();
        expectCode("test_existing_key_unavailable", () -> fixture.engine.enroll(OP2, DEVICE, "recovery", code()));
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(original.revision, fixture.persistence.current().revision);
        assertEquals(requests, fixture.transport.enrollCalls.get());
    }

    @Test
    public void retryAfterCancelledRecoveryDoesNotDestroyTheSharedWorkKey() throws Exception {
        Fixture fixture = activeFixture();
        InstallationBinding original = fixture.persistence.current().installation;
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);
        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        expectCode("custodial_native_enrollment_terminal", () -> fixture.engine.enroll(OP2, DEVICE, "recovery", code()));
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(original, fixture.persistence.current().installation);
        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        assertEquals("CREDENTIAL_STAGED", fixture.engine.enroll(REMOVE, DEVICE, "recovery", code()).phase.name());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(original, fixture.persistence.current().installation);
    }

    @Test
    public void unusableActiveCredentialFailsReadinessAndAllowsOnlyExactRecovery() throws Exception {
        Fixture fixture = activeFixture();
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);

        Map<String, Object> unhealthy = fixture.engine.getState();
        assertEquals("RECOVERY_REQUIRED", unhealthy.get("state"));
        assertEquals(false, unhealthy.get("active"));
        assertEquals(false, unhealthy.get("credential_present"));
        assertEquals(false, unhealthy.get("credential_usable"));
        assertEquals(true, unhealthy.get("recovery_required"));
        assertEquals(DEVICE, unhealthy.get("recovery_device_id"));
        assertEquals("test_decrypt_failure", unhealthy.get("recovery_reason"));

        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            DEVICE,
            "enrollment",
            "87654321".toCharArray()
        ));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            "KIOSK_03",
            "recovery",
            "87654321".toCharArray()
        ));

        EnrollmentView recovered = fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "87654321".toCharArray()
        );
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(2, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        fixture.engine.completeLocalBinding(OP2);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP2);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(true, active.get("credential_usable"));
        assertEquals(false, active.get("recovery_required"));
    }

    @Test
    public void enrollmentResponseLossResumesAfterProcessRestartWithOneCredential() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        VaultEngine restarted = fixture.restart();
        EnrollmentView resumed = restarted.resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", resumed.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(2, fixture.transport.enrollCalls.get());
    }

    @Test
    public void authoritativeInvalidCodeRetiresOperationAndCorrectedCodeCanStartFresh() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        VaultFailure invalid = expectCode("custodial_native_enrollment_terminal", () -> fixture.engine.enroll(
            OP1,
            DEVICE,
            "enrollment",
            code()
        ));
        assertEquals(401, invalid.httpStatus);
        assertEquals("invalid_enrollment_code", invalid.remoteReason);
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        Map<String, Object> terminal = fixture.engine.getState();
        assertTrue((Boolean) terminal.get("enrollment_terminal"));
        assertEquals(OP1, terminal.get("cancelled_operation_id"));
        assertEquals(0, fixture.transport.issuanceCount.get());

        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        EnrollmentView corrected = fixture.engine.enroll(OP2, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", corrected.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
    }

    @Test
    public void ambiguousAttemptNeverTreatsLaterBadCodeAsNoIssuanceProof() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.failEnrollBeforeIssueNetwork = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        expectCode("custodial_native_enrollment_failed", () -> fixture.restart().resumeEnrollment(OP1));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        expectCode("custodial_native_enrollment_failed", () -> fixture.restart().cancelEnrollment(OP1));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        fixture.transport.enrollHttpFailure = 409;
        fixture.transport.enrollRemoteReason = "operation_expired";
        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(OP1, cancelled.get("cancelled_operation_id"));
    }

    @Test
    public void ambiguousDispatchFollowedByGeneric400RemainsResumable() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(
            OP1,
            DEVICE,
            "enrollment",
            code()
        ));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 400;
        fixture.transport.enrollRemoteReason = "malformed_request";
        VaultFailure rejected = expectCode(
            "custodial_native_enrollment_failed",
            () -> fixture.restart().resumeEnrollment(OP1)
        );
        assertEquals(400, rejected.httpStatus);
        assertEquals("malformed_request", rejected.remoteReason);
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        EnrollmentView recovered = fixture.restart().resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void failedCredentialCommitDurablyCompensatesBeforeRemoteCancel() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.failBeforeCommits.add(3);
        expectCode("test_commit_failure", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void failedCompensationJournalLeavesServerResultResumable() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.failBeforeCommits.add(3);
        fixture.persistence.failBeforeCommits.add(4);
        expectCode("test_commit_failure", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertFalse(fixture.transport.cancelled(OP1));

        EnrollmentView recovered = fixture.restart().resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void writeThenThrowIsRecognizedByExactReadback() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.writeThenFailCommits.add(3);
        EnrollmentView view = fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        assertEquals("CREDENTIAL_STAGED", view.phase.name());
        assertFalse(fixture.transport.cancelled(OP1));
        assertEquals(1, fixture.transport.issuanceCount.get());
    }

    @Test
    public void localBindingCommitFailureRetriesWithoutAnotherEnrollment() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.persistence.failBeforeCommits.add(4);
        expectCode("test_commit_failure", () -> fixture.engine.completeLocalBinding(OP1));
        assertEquals("CREDENTIAL_STAGED", fixture.persistence.current().phase.name());

        Map<String, Object> state = fixture.restart().completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", state.get("state"));
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void processDeathAfterNativeBindingExposesExactReconciliationProof() throws Exception {
        Fixture fixture = new Fixture();
        EnrollmentView enrolled = fixture.engine.enroll(OP1, DEVICE, "recovery", code());
        Map<?, ?> nativeInstallation = (Map<?, ?>) enrolled.safeData().get("installation");
        assertNotNull(nativeInstallation);
        fixture.engine.completeLocalBinding(OP1);

        Map<String, Object> recovered = fixture.restart().getState();
        assertEquals("PENDING_SERVER_CONFIRMATION", recovered.get("state"));
        assertEquals(OP1, recovered.get("pending_operation_id"));
        assertEquals(DEVICE, recovered.get("pending_device_id"));
        assertEquals("recovery", recovered.get("pending_flow"));
        assertEquals(nativeInstallation, recovered.get("installation"));
        Map<?, ?> pending = (Map<?, ?>) recovered.get("pending_enrollment");
        assertEquals(OP1, pending.get("operation_id"));
        assertEquals("recovery", pending.get("flow"));
        assertEquals(DEVICE, pending.get("device_id"));
        assertFalse(pending.containsKey("device_credential"));
    }

    @Test
    public void bindingAndEnrollmentReplaysMustMatchExactIdentity() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        EnrollmentView replay = fixture.engine.enroll(OP1, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", replay.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        fixture.engine.completeLocalBinding(OP1);
        Map<String, Object> replayed = fixture.engine.completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", replayed.get("state"));
        expectCode("custodial_native_binding_state_refused", () -> fixture.engine.completeLocalBinding(OP2));
    }

    @Test
    public void confirmationResponseLossAndRestartReplaySafely() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.loseConfirmAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.confirmEnrollment(OP1));
        assertTrue(fixture.transport.confirmed(OP1));
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());

        Map<String, Object> active = fixture.restart().confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(2, fixture.transport.confirmCalls.get());
    }

    @Test
    public void revokedConfirmationCarriesSafe401AndRemainsQuarantined() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.confirmHttpFailure = 401;
        VaultFailure failure = expectCode("custodial_native_terminal_request_failed", () -> fixture.engine.confirmEnrollment(OP1));
        assertEquals(401, failure.httpStatus);
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());
        expectCode("custodial_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ));
    }

    @Test
    public void cancellationResponseLossReplaysFromDurableIntent() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.cancelEnrollment(OP1));
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(2, fixture.transport.cancelCalls.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void expiredResponseLossJournalRecoversCredentialThenCancels() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        fixture.clock.now += 16L * 60L * 1000L;

        Map<String, Object> state = fixture.restart().getState();
        assertEquals("CANCELLED", state.get("state"));
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void removalResponseLossAndFinalizeFailureAreRestartSafe() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseRemoveAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.removeEnrollment(REMOVE, DEVICE));
        assertEquals("REMOVAL_REQUESTED", fixture.persistence.current().phase.name());
        Map<String, Object> restartState = fixture.restart().getState();
        assertEquals(REMOVE, restartState.get("removal_operation_id"));
        assertEquals(DEVICE, restartState.get("removal_device_id"));
        assertTrue((Boolean) restartState.get("removal_pending"));

        RemovalView removed = fixture.restart().removeEnrollment(REMOVE, DEVICE);
        assertTrue(removed.removed);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        fixture.persistence.failBeforeCommits.add(fixture.persistence.commitAttempts.get() + 1);
        expectCode("test_commit_failure", () -> fixture.restart().finalizeRemoval(REMOVE));
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        fixture.persistence.writeThenFailCommits.add(fixture.persistence.commitAttempts.get() + 1);
        Map<String, Object> finalState = fixture.restart().finalizeRemoval(REMOVE);
        assertEquals("EMPTY", finalState.get("state"));
        assertTrue((Boolean) finalState.get("removal_finalized"));
        assertTrue((Boolean) finalState.get("removal_remote_complete"));
        assertEquals(REMOVE, finalState.get("removal_operation_id"));
        assertEquals(DEVICE, finalState.get("removal_device_id"));
        assertTrue(fixture.cipher.destroyCalls >= 2);

        int destroysAfterFinalization = fixture.cipher.destroyCalls;
        long revisionAfterFinalization = fixture.persistence.current().revision;
        Map<String, Object> replayed = fixture.restart().finalizeRemoval(REMOVE);
        assertEquals("EMPTY", replayed.get("state"));
        assertEquals(revisionAfterFinalization, fixture.persistence.current().revision);
        assertEquals(destroysAfterFinalization, fixture.cipher.destroyCalls);
        expectCode("custodial_native_removal_not_complete", () -> fixture.restart().finalizeRemoval(OP2));

        EnrollmentView reenrolled = fixture.restart().enroll(OP2, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", reenrolled.phase.name());
        assertEquals("", fixture.engine.getState().get("removal_operation_id"));
        assertFalse((Boolean) fixture.engine.getState().get("removal_finalized"));
    }

    @Test
    public void nativeRemovalCancellationMakesNoPersistenceOrNetworkChange() throws Exception {
        Fixture fixture = activeFixture();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestRemovalGate gate = new TestRemovalGate(false);
        RemovalCoordinator coordinator = new RemovalCoordinator(fixture.engine, gate);
        expectCode("custodial_native_removal_cancelled", () -> coordinator.remove(REMOVE, DEVICE));
        assertEquals(1, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.removeCalls.get());
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
    }

    @Test
    public void deniedNativeEnrollmentCancellationMakesNoPersistenceOrNetworkChange() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestCancellationGate gate = new TestCancellationGate(false);
        CancellationCoordinator coordinator = new CancellationCoordinator(fixture.engine, gate);

        expectCode("custodial_native_cancellation_cancelled", () -> coordinator.cancel(OP1));

        assertEquals(1, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
        assertEquals("CREDENTIAL_STAGED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void pendingServerConfirmationCannotBeCancelledAndNeverPrompts() throws Exception {
        Fixture fixture = stagedAndBound();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestCancellationGate gate = new TestCancellationGate(true);
        CancellationCoordinator coordinator = new CancellationCoordinator(fixture.engine, gate);

        expectCode("custodial_native_cancellation_refused", () -> coordinator.cancel(OP1));

        assertEquals(0, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void approvedCancellationJournalsConsentAndRestartReplaysWithoutAnotherPrompt() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        TestCancellationGate approved = new TestCancellationGate(true);

        expectCode(
            "custodial_native_network_unavailable",
            () -> new CancellationCoordinator(fixture.engine, approved).cancel(OP1)
        );
        assertEquals(1, approved.calls);
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());

        TestCancellationGate denied = new TestCancellationGate(false);
        Map<String, Object> cancelled = new CancellationCoordinator(fixture.restart(), denied).cancel(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(0, denied.calls);
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));

        Map<String, Object> replayed = new CancellationCoordinator(fixture.restart(), denied).cancel(OP1);
        assertEquals("CANCELLED", replayed.get("state"));
        assertEquals(0, denied.calls);
    }

    @Test
    public void approvedDurableRemovalReplayDoesNotPromptTwice() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseRemoveAfterSuccess = 1;
        TestRemovalGate approved = new TestRemovalGate(true);
        expectCode("custodial_native_network_unavailable", () -> new RemovalCoordinator(fixture.engine, approved).remove(REMOVE, DEVICE));
        assertEquals(1, approved.calls);
        assertEquals("REMOVAL_REQUESTED", fixture.persistence.current().phase.name());

        TestRemovalGate denied = new TestRemovalGate(false);
        RemovalView replay = new RemovalCoordinator(fixture.restart(), denied).remove(REMOVE, DEVICE);
        assertTrue(replay.removed);
        assertEquals(0, denied.calls);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
    }

    @Test
    public void parallelLongPollsDoNotBlockTrafficOrRemovalAndStaleResponsesAreRefused() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.authorizedStarted = new CountDownLatch(3);
        fixture.transport.releaseAuthorized = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<AuthorizedResponse>> requests = new ArrayList<>();
        try {
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/messaging-api/long-poll?device_id=KIOSK_02")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/messaging-api/long-poll?device_id=KIOSK_02")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/schedule-api/my-day-summary?device_id=KIOSK_02")
            )));
            assertTrue(fixture.transport.authorizedStarted.await(2, TimeUnit.SECONDS));
            assertEquals(3, fixture.transport.maximumAuthorizedInFlight.get());

            Future<RemovalView> removal = pool.submit(() -> fixture.engine.removeEnrollment(REMOVE, DEVICE));
            assertTrue(removal.get(2, TimeUnit.SECONDS).removed);
            assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
            fixture.transport.releaseAuthorized.countDown();

            for (Future<AuthorizedResponse> pending : requests) {
                try {
                    pending.get(2, TimeUnit.SECONDS);
                    fail("Expected stale native response refusal");
                } catch (ExecutionException error) {
                    assertTrue(error.getCause() instanceof VaultFailure);
                    assertEquals("custodial_native_vault_concurrent_change", ((VaultFailure) error.getCause()).code);
                }
            }
        } finally {
            fixture.transport.releaseAuthorized.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    public void concurrentDuplicateEnrollmentHasOneIssuanceAndConflictsFailClosed() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> firstResult = pool.submit(
                () -> first.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<EnrollmentView> secondResult = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return second.enroll(OP1, DEVICE, "enrollment", code());
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "requestAndStage");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            assertEquals("CREDENTIAL_STAGED", firstResult.get(2, TimeUnit.SECONDS).phase.name());
            assertEquals("CREDENTIAL_STAGED", secondResult.get(2, TimeUnit.SECONDS).phase.name());
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.restart().enroll(OP2, DEVICE, "enrollment", code()));
    }

    @Test
    public void concurrentDuplicateCancellationConvergesOnTerminalState() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.persistence.pauseCommits(3, VaultPhase.CANCEL_REQUESTED, 2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Map<String, Object>> firstResult = pool.submit(() -> {
                start.await();
                return first.cancelEnrollment(OP1);
            });
            Future<Map<String, Object>> secondResult = pool.submit(() -> {
                start.await();
                return second.cancelEnrollment(OP1);
            });
            start.countDown();
            assertTrue(fixture.persistence.awaitPausedCommits(2, TimeUnit.SECONDS));
            fixture.persistence.releasePausedCommits();
            assertEquals("CANCELLED", firstResult.get(2, TimeUnit.SECONDS).get("state"));
            assertEquals("CANCELLED", secondResult.get(2, TimeUnit.SECONDS).get("state"));
        } finally {
            fixture.persistence.releasePausedCommits();
            pool.shutdownNow();
        }
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void concurrentTerminalRejectionCompletesBeforeFollowerCanIssue() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.transport.enrollHttpFailure = 400;
        fixture.transport.enrollRemoteReason = "malformed_request";
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> firstResult = pool.submit(
                () -> first.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<EnrollmentView> secondResult = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return second.enroll(OP1, DEVICE, "enrollment", code());
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "requestAndStage");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            try {
                firstResult.get(2, TimeUnit.SECONDS);
                fail("Expected terminal enrollment rejection");
            } catch (ExecutionException error) {
                assertEquals(
                    "custodial_native_enrollment_terminal",
                    ((VaultFailure) error.getCause()).code
                );
            }
            try {
                secondResult.get(2, TimeUnit.SECONDS);
                fail("Expected terminal follower refusal");
            } catch (ExecutionException error) {
                assertEquals(
                    "custodial_native_enrollment_cancelled",
                    ((VaultFailure) error.getCause()).code
                );
            }
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void concurrentCancelUsesStagedCredentialWithoutResubmittingItAsCode() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine enrolling = fixture.engine;
        VaultEngine cancelling = fixture.restart();
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> staged = pool.submit(
                () -> enrolling.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<Map<String, Object>> cancelled = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return cancelling.cancelEnrollment(OP1);
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "recoverCredentialForCancellation");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            assertEquals("CREDENTIAL_STAGED", staged.get(2, TimeUnit.SECONDS).phase.name());
            assertEquals("CANCELLED", cancelled.get(2, TimeUnit.SECONDS).get("state"));
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void fullLegacyUpgradeSurvivesCleanupCrashAndBecomesActive() throws Exception {
        InstallationBinding binding = new InstallationBinding(
            DEVICE,
            SEAL,
            Instant.ofEpochMilli(NOW).toString(),
            true,
            ""
        );
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), binding, SEAL);
        legacy.failCleanupAfterValues = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("custodial_native_legacy_cleanup_failed", fixture.engine::getState);
        assertEquals("LEGACY_CLEANUP_PENDING", fixture.persistence.current().phase.name());

        Map<String, Object> active = fixture.restart().getState();
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) active.get("installation")).get("device_id"));
        assertFalse((Boolean) active.get("legacy_pending"));
    }

    @Test
    public void credentialOnlyLegacyUpgradeRequiresExactBindingThenAtomicallyActivates() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        Fixture fixture = new Fixture(legacy);
        Map<String, Object> pending = fixture.engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertTrue((Boolean) pending.get("legacy_pending"));
        expectCode("custodial_native_legacy_identity_unverified", () -> fixture.engine.completeLegacyBinding("KIOSK_03"));

        Map<String, Object> active = fixture.restart().completeLegacyBinding(DEVICE);
        assertEquals("ACTIVE", active.get("state"));
        assertFalse((Boolean) active.get("legacy_pending"));
    }

    @Test
    public void changedLegacySourceAfterJournalBlocksWithoutPromoting() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        legacy.failCleanupBefore = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("custodial_native_legacy_cleanup_failed", fixture.engine::getState);
        legacy.replaceCredential("different-device-credential".toCharArray());
        expectCode("custodial_native_legacy_vault_mismatch", fixture.restart()::getState);
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());
        assertTrue((Boolean) fixture.engine.getState().get("blocked"));
    }

    private static Fixture stagedAndBound() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.engine.completeLocalBinding(OP1);
        return fixture;
    }

    private static Fixture activeFixture() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.engine.confirmEnrollment(OP1);
        return fixture;
    }

    private static AuthorizedRequest request(String path) {
        return new AuthorizedRequest(path, "GET", Map.of(), new byte[0]);
    }

    private static char[] code() {
        return "12345678".toCharArray();
    }

    private static VaultFailure expectCode(String code, ThrowingAction action) throws Exception {
        try {
            action.run();
            fail("Expected " + code);
            throw new AssertionError();
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
            return error;
        }
    }

    private static void awaitBlockedAt(
        AtomicReference<Thread> workerReference,
        String methodName
    ) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (System.nanoTime() < deadline) {
            Thread worker = workerReference.get();
            if (worker != null && worker.getState() == Thread.State.BLOCKED) {
                for (StackTraceElement frame : worker.getStackTrace()) {
                    if (
                        frame.getClassName().equals(VaultEngine.class.getName())
                        && frame.getMethodName().equals(methodName)
                    ) return;
                }
            }
            Thread.onSpinWait();
        }
        fail("Worker did not block at VaultEngine." + methodName);
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }

    private static final class Fixture {
        final MemoryPersistence persistence;
        final TestCipher cipher;
        final MutableClock clock;
        final FakeTransport transport;
        final FakeLegacySource legacy;
        final TestSealGenerator seals;
        VaultEngine engine;

        Fixture() throws VaultFailure {
            this(new FakeLegacySource());
        }

        Fixture(FakeLegacySource legacy) throws VaultFailure {
            persistence = new MemoryPersistence();
            cipher = new TestCipher();
            clock = new MutableClock(NOW);
            transport = new FakeTransport(clock);
            this.legacy = legacy;
            seals = new TestSealGenerator();
            engine = restart();
        }

        VaultEngine restart() {
            engine = new VaultEngine(persistence, cipher, transport, legacy, seals, clock);
            return engine;
        }
    }

    private static final class TestRemovalGate implements RemovalAuthorizationGate {
        final boolean decision;
        int calls;

        TestRemovalGate(boolean decision) {
            this.decision = decision;
        }

        @Override
        public boolean confirm(String operationId, String deviceId) {
            calls += 1;
            return decision;
        }
    }

    private static final class TestCancellationGate implements CancellationAuthorizationGate {
        final boolean decision;
        int calls;

        TestCancellationGate(boolean decision) {
            this.decision = decision;
        }

        @Override
        public boolean confirm(String operationId, String deviceId) {
            calls += 1;
            return decision;
        }
    }
}
