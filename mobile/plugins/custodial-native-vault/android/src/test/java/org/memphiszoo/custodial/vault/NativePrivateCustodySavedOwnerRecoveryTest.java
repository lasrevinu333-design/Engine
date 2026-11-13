package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.channels.FileChannel;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW saved-operation identity hint + complete native owner reconstruction.
 * Reused factory setup is not old test replay. Own host temp files, JCE keys,
 * prefs/auth/provider/HTTPS are SYNTHETIC; no actual Android process/phone/SQL. */
public final class NativePrivateCustodySavedOwnerRecoveryTest {
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--collector-retirement-only".equals(args[0])){
            if(!java.util.Set.of("COLLECTOR_RETIREMENT_largeVerifiedZeroHistoryReleasesBuffers",
                "COLLECTOR_RETIREMENT_olderUnwipedBufferNeverRetired",
                "COLLECTOR_RETIREMENT_overlappingActiveAndPartialWipesPreserved").contains(args[1]))throw new AssertionError("explicit collector retirement selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodySavedOwnerRecoveryTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError("collector_retirement_case_failed");
            }
            System.out.println("PASS_TEST_COLLECTOR "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--saved-current-only")){
            if(!java.util.Set.of("SAVED_CURRENT_freshEngineOwnsExactOriginalFrameAndRepeatCannotFreeResult",
                "SAVED_CURRENT_missingChangedHintAndAll8RefuseBeforeIO",
                "SAVED_CURRENT_ownerAndHintChangesDuringReplyRefuseAndPreserve").contains(args[1]))throw new AssertionError("explicit new saved current selector required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodySavedOwnerRecoveryTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures()){
                    var error=failure.getException();System.err.println("SAVED_CURRENT_FAILURE_CLASS "+error.getClass().getName());
                    for(var point:error.getStackTrace())System.err.println("SAVED_CURRENT_FAILURE_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
                }throw new AssertionError("saved_current_case_failed");
            }
            System.out.println("PASS_SOURCE_MOCK "+args[1]);return;
        }
        if(args.length==1&&"--saved-current-cold-descriptor-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
                NativePrivateCustodySavedOwnerRecoveryTest.class,
                "SAVED_CURRENT_coldOwnerRejectsStoredDescriptorAfterOriginalBatchCommit"));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError("saved_current_cold_descriptor_case_failed");
            }
            System.out.println("PASS_HOST_UNIT_COLD_SAVED_DESCRIPTOR_REFUSAL");return;
        }
        if(args.length==2&&"--saved-current-original-batch-outcome-only".equals(args[0])){
            if(!java.util.Set.of("SAVED_CURRENT_falseOriginalBatchInvalidatesGuardedRead",
                "SAVED_CURRENT_throwAfterOriginalBatchInvalidatesGuardedRead").contains(args[1]))
                throw new AssertionError("explicit new original batch outcome member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
                NativePrivateCustodySavedOwnerRecoveryTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError("saved_current_original_batch_outcome_failed");
            }
            System.out.println("PASS_HOST_UNIT_SAVED_ORIGINAL_WRITER_OUTCOME "+args[1]);return;
        }
        if(args.length==1&&args[0].equals("--saved-current-original-batch-only")){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
                NativePrivateCustodySavedOwnerRecoveryTest.class,
                "SAVED_CURRENT_sameByteOriginalBatchCommitInvalidatesGuardedRead"));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError("saved_current_original_batch_case_failed");
            }
            System.out.println("PASS_SOURCE_MOCK_SAME_BYTE_ORIGINAL_BATCH_COMMIT");return;
        }
        if(args.length!=1||!args[0].equals("--pending-local-lifecycle-only"))throw new AssertionError("new selector required");
        var test=new NativePrivateCustodySavedOwnerRecoveryTest();
        test.freshOwnerResumesSamePendingAndAliasWithoutCreatingTransport();System.out.println("PASS freshOwnerResumesSamePendingAndAliasWithoutCreatingTransport");
        test.missingForeignAndChangedNamespacesNeverPromotePendingOwner();System.out.println("PASS missingForeignAndChangedNamespacesNeverPromotePendingOwner");
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {NativePrivateCustodyOwnerTest.denied(action);}
    private static CredentialCipher[] collectorCiphers(){return new CredentialCipher[]{
        new NativeRetainedOwnerTest.TrackingCipher(),
        new NativeRetainedBatchOwnerTest.DomainCipher("TEST-buffer-retirement-only"),
        new NativeRetainedNamespaceCensusTest.CountingCipher(new TestCipher())};}
    private static java.util.List<char[]> collectorReads(CredentialCipher cipher){
        if(cipher instanceof NativeRetainedOwnerTest.TrackingCipher)return ((NativeRetainedOwnerTest.TrackingCipher)cipher).reads;
        if(cipher instanceof NativeRetainedBatchOwnerTest.DomainCipher)return ((NativeRetainedBatchOwnerTest.DomainCipher)cipher).clearReads;
        return ((NativeRetainedNamespaceCensusTest.CountingCipher)cipher).clearReads;
    }
    private static void collectorWiped(CredentialCipher cipher){
        if(cipher instanceof NativeRetainedOwnerTest.TrackingCipher)((NativeRetainedOwnerTest.TrackingCipher)cipher).wiped();
        else if(cipher instanceof NativeRetainedBatchOwnerTest.DomainCipher)((NativeRetainedBatchOwnerTest.DomainCipher)cipher).wiped();
        else ((NativeRetainedNamespaceCensusTest.CountingCipher)cipher).wiped();
    }
    private static int collectorRetained(CredentialCipher cipher){int count=0;for(char[] value:collectorReads(cipher))if(value!=null)count++;return count;}
    @Test public void COLLECTOR_RETIREMENT_largeVerifiedZeroHistoryReleasesBuffers()throws Exception {
        for(var cipher:collectorCiphers()){
            char[] payload=new char[512];Arrays.fill(payload,'x');var encrypted=cipher.encryptWithExistingKey(payload);
            for(int i=0;i<16384;i++){
                char[] borrowed=cipher.decrypt(encrypted);assertArrayEquals(payload,borrowed);
                // Simulated owning consumer, NOT collector-side erasure.
                VaultValidation.wipe(borrowed);
            }
            assertEquals(16384,collectorReads(cipher).size()); // Cumulative decrypt-count proof unchanged.
            assertTrue("already verified history retained buffers",collectorRetained(cipher)<=1);
            collectorWiped(cipher);assertEquals(0,collectorRetained(cipher));VaultValidation.wipe(payload);
        }
    }
    @Test public void COLLECTOR_RETIREMENT_olderUnwipedBufferNeverRetired()throws Exception {
        for(var cipher:collectorCiphers()){
            char[] payload="TEST-older-unwiped-buffer".toCharArray();var encrypted=cipher.encryptWithExistingKey(payload);
            char[] older=cipher.decrypt(encrypted);
            for(int i=0;i<16384;i++)VaultValidation.wipe(cipher.decrypt(encrypted));
            assertTrue(collectorReads(cipher).contains(older));assertArrayEquals(payload,older);
            assertEquals(16385,collectorReads(cipher).size());assertThrows(AssertionError.class,()->collectorWiped(cipher));
            assertArrayEquals(payload,older); // A failed assertion must not erase/evict it.
            VaultValidation.wipe(older);collectorWiped(cipher);assertEquals(0,collectorRetained(cipher));VaultValidation.wipe(payload);
        }
    }
    @Test public void COLLECTOR_RETIREMENT_overlappingActiveAndPartialWipesPreserved()throws Exception {
        for(var cipher:collectorCiphers()){
            char[] payload="TEST-overlapping-active-buffers".toCharArray();var encrypted=cipher.encryptWithExistingKey(payload);
            char[] first=cipher.decrypt(encrypted),second=cipher.decrypt(encrypted),partial=cipher.decrypt(encrypted);
            Arrays.fill(partial,0,partial.length-1,'\0');
            for(int i=0;i<4096;i++)VaultValidation.wipe(cipher.decrypt(encrypted));
            assertArrayEquals(payload,first);assertArrayEquals(payload,second);
            assertEquals(payload[payload.length-1],partial[partial.length-1]);
            for(char[] active:new char[][]{first,second,partial})assertTrue(collectorReads(cipher).contains(active));
            assertThrows(AssertionError.class,()->collectorWiped(cipher));
            VaultValidation.wipe(first);
            for(int i=0;i<4096;i++)VaultValidation.wipe(cipher.decrypt(encrypted));
            assertArrayEquals(payload,second);assertTrue(collectorReads(cipher).contains(second));assertTrue(collectorReads(cipher).contains(partial));
            assertThrows(AssertionError.class,()->collectorWiped(cipher));
            VaultValidation.wipe(second);assertThrows(AssertionError.class,()->collectorWiped(cipher));
            assertEquals(payload[payload.length-1],partial[partial.length-1]);
            VaultValidation.wipe(partial);collectorWiped(cipher);assertEquals(0,collectorRetained(cipher));VaultValidation.wipe(payload);
        }
    }
    // This issuer affects ONLY newly created disposable test originals. It is
    // restored before saved-owner reconstruction; no old bytes/key are rebound.
    private static final class SavedCurrentIssuer implements AutoCloseable {
        private static final String PROPERTY="custodial.fixture.backend-admissible-credential";
        private final String previous=System.getProperty(PROPERTY);
        SavedCurrentIssuer(){System.setProperty(PROPERTY,"true");}
        @Override public void close(){if(previous==null)System.clearProperty(PROPERTY);else System.setProperty(PROPERTY,previous);}
    }
    private static final class OriginalBatchIssuer implements AutoCloseable {
        private static final String PROPERTY="custodial.fixture.original-batch-before-capture";
        private final String previous=System.getProperty(PROPERTY);
        OriginalBatchIssuer(){System.setProperty(PROPERTY,"true");}
        @Override public void close(){if(previous==null)System.clearProperty(PROPERTY);else System.setProperty(PROPERTY,previous);}
    }
    static VaultEngine.NativePrivateCustodySavedReadOwner savedCurrent(VaultEngine engine,NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=census(x);var old=source.f.batch.old;
        return engine.prepareSavedOriginalPrivateCustodyCurrentRead(old.work,old.principal,null,
            new NativeProviderJournal(source.f.store.store(),source.f.store.lock),source.f.batch.journal,
            readers(source),x.f.store,x.store);
    }
    private static VaultEngine.NativePrivateCustodySavedReadOwner savedCurrentGuarded(
        VaultEngine engine,NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=census(x);var old=source.f.batch.old;
        Map<String,SharedPreferences> existing=new TreeMap<>();
        for(String name:source.unknown.keySet()){
            if(name.equals(NativeRetainedNamespaceCensus.WORK))existing.put(name,old.workDisk.preferences());
            else existing.put(name,(SharedPreferences)Proxy.newProxyInstance(
                NativePrivateCustodySavedOwnerRecoveryTest.class.getClassLoader(),
                new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                    if(method.getName().equals("getAll"))return new java.util.HashMap<>(source.raw(name));
                    throw new AssertionError("guarded saved read used "+method.getName());
                }));
        }
        return engine.prepareSavedOriginalPrivateCustodyCurrentRead(old.work,old.principal,null,
            new NativeProviderJournal(source.f.store.store(),source.f.store.lock),source.f.batch.journal,
            AndroidProtectedNamespaceReaders.bind(existing),x.f.store,x.store);
    }
    private static void savedCurrentMark(String phase){System.out.println("SAVED_CURRENT_PHASE "+phase);System.out.flush();}
    private static final class SavedCurrentFixture implements AutoCloseable {
        final NativePrivateCustodyReturnedPieceSetTest.Fixture original;
        final NativePrivateCustodyOperationTest.Fixture x;
        final VaultEngine engine;
        final JSONObject expectedPlan;
        final java.util.List<byte[]> originalQueries=new java.util.ArrayList<>(),responses=new java.util.ArrayList<>();
        final java.util.List<NativePrivateCustodyHttpOutcomeTest.Connection> connections=new java.util.ArrayList<>();
        NativePrivateCustodyHttpOutcomeTest.Hook beforeReply=()->{};
        SavedCurrentFixture()throws Exception {this(false);}
        SavedCurrentFixture(boolean originalBatchBeforeCapture)throws Exception {
            savedCurrentMark("new_original_fixture_begin");
            try(var issuer=new SavedCurrentIssuer();var batchIssuer=originalBatchBeforeCapture?new OriginalBatchIssuer():null){
                original=new NativePrivateCustodyReturnedPieceSetTest.Fixture();
            }
            x=original.f.x;expectedPlan=new JSONObject(original.f.plan.projection().toString());
            try{
                for(int i=0;i<original.queries.size();i++){
                    original.f.engine.fenceOriginalPrivateCustodyExchange(original.queries.get(i));
                    originalQueries.add(NativePrivateCustodyExchangeTest.body(original.queries.get(i)));
                    responses.add(NativePrivateCustodyReturnedPieceSetTest.Fixture.wire(original.data(i)));
                }
                // Close every previous volatile owner, retaining the fixture's
                // original installed synthetic JCE key and immutable files.
                for(var query:original.queries)query.close();original.queries.clear();
                original.f.plan.close();original.f.operation.close();x.frame.close();x.owner.close();x.f.h.close();
                original.f.clock.now+=86_400_000;engine=fresh(x);savedCurrentMark("fresh_engine_original_handles_closed");
            }catch(Exception|Error failed){close();throw failed;}
        }
        NativePrivateCustodyHttp http(){return new NativePrivateCustodyHttp(url->{
            assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
            assertFalse("HTTP under fresh Engine monitor",Thread.holdsLock(engine));
            int index=connections.size();assertTrue(index<responses.size());
            var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);
            connection.response=responses.get(index);connection.onReply=beforeReply;connections.add(connection);return connection;
        },original.f.clock);}
        VaultEngine.NativePrivateCustodyCurrentFrameRead read(VaultEngine.NativePrivateCustodySavedReadOwner owner)throws Exception {
            return engine.readSavedOriginalPrivateCustodyCurrentFrame(owner,original.f.journal,http(),new NativePrivateCustodyFrameReadControl());
        }
        void closedConnections(){for(var connection:connections)assertEquals(1,connection.disconnects);}
        @Override public void close(){for(byte[] bytes:responses)Arrays.fill(bytes,(byte)0);for(byte[] bytes:originalQueries)Arrays.fill(bytes,(byte)0);original.close();}
    }
    /** Bound, first-durable-original setup for this owning member only. The
     * legacy/default SavedCurrentFixture and all its callers remain unchanged.
     * No raw hint, private control, epoch token or HELD state is manufactured. */
    private static final class BoundSavedCurrentFixture implements AutoCloseable {
        final NativePrivateCustodyReturnedPieceSetTest.BrowserRestartCurrent original;
        final NativePrivateCustodyOperationTest.Fixture x;
        final VaultEngine engine;
        final JSONObject expectedPlan;
        final java.util.List<byte[]> originalQueries=new java.util.ArrayList<>(),responses=new java.util.ArrayList<>();
        final java.util.List<NativePrivateCustodyHttpOutcomeTest.Connection> connections=new java.util.ArrayList<>();
        NativePrivateCustodyHttpOutcomeTest.Hook beforeReply=()->{};
        BoundSavedCurrentFixture()throws Exception {
            savedCurrentMark("bound_saved_original_begin");
            original=new NativePrivateCustodyReturnedPieceSetTest.BrowserRestartCurrent(
                NativePrivateCustodyReturnedPieceSetTest.BrowserRestartCurrent.OriginalSetup.BOUND_DURABLE_FIRST_HOST_MODEL);
            x=original.f.x;expectedPlan=new JSONObject(original.f.plan.projection().toString());
            try {
                for(int index=0;index<original.queries.size();index++){
                    originalQueries.add(NativePrivateCustodyExchangeTest.body(original.queries.get(index)));
                    responses.add(original.replies.get(index).clone());
                }
                for(var query:original.queries)query.close();original.queries.clear();
                original.f.plan.close();original.f.operation.close();x.frame.close();x.owner.close();x.f.h.close();
                engine=fresh(x);assertNotSame(original.f.engine,engine);
                savedCurrentMark("bound_saved_fresh_engine_old_volatile_owners_closed");
            }catch(Exception|Error failure){close();throw failure;}
        }
        VaultEngine.NativePrivateCustodySavedReadOwner owner()throws Exception {
            var source=census(x);var old=source.f.batch.old;var bound=x.f.x.f;
            assertNotNull(bound.boundVaultPreferences);assertNotNull(bound.boundWorkPreferences);
            Map<String,SharedPreferences> existing=new TreeMap<>();
            for(String name:source.unknown.keySet()){
                if(name.equals(NativeVaultProviderReferenceCensus.VAULT))existing.put(name,bound.boundVaultPreferences);
                else if(name.equals(NativeRetainedNamespaceCensus.WORK))existing.put(name,bound.boundWorkPreferences);
                else existing.put(name,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                        if(!method.getName().equals("getAll"))throw new AssertionError("bound saved reader edited preferences");
                        return new java.util.HashMap<>(source.raw(name));
                    }));
            }
            return engine.prepareSavedOriginalPrivateCustodyCurrentRead(old.work,old.principal,null,
                new NativeProviderJournal(source.f.store.store(),source.f.store.lock),source.f.batch.journal,
                AndroidProtectedNamespaceReaders.bind(existing),x.f.store,x.store);
        }
        VaultEngine.NativePrivateCustodyCurrentFrameRead read(VaultEngine.NativePrivateCustodySavedReadOwner owner)throws Exception {
            int base=connections.size();
            var http=new NativePrivateCustodyHttp(url->{
                assertEquals(NativePrivateCustodyHttp.ORIGIN+"/device-auth/private-custody-current-read",url.toString());
                assertFalse(Thread.holdsLock(engine));int index=connections.size()-base;assertTrue(index<responses.size());
                var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);
                connection.response=responses.get(index);connection.onReply=beforeReply;connections.add(connection);return connection;
            },original.f.clock);
            return engine.readSavedOriginalPrivateCustodyCurrentFrame(owner,original.f.journal,http,new NativePrivateCustodyFrameReadControl());
        }
        long durableCounter()throws Exception {
            var journal=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(x.f.root.toFile());
            try(var current=journal.readCurrent()){journal.requireCurrent(current);return current.counter();}
        }
        void closedConnections(){for(var connection:connections)assertEquals(1,connection.disconnects);}
        @Override public void close(){for(byte[] bytes:responses)Arrays.fill(bytes,(byte)0);for(byte[] bytes:originalQueries)Arrays.fill(bytes,(byte)0);original.close();}
    }
    /** ONE new cold-Engine descriptor member; no old current-read body or
     * historical @Test setup is invoked. All actors/keys/storage are UNIT. */
    @Test public void SAVED_CURRENT_coldOwnerRejectsStoredDescriptorAfterOriginalBatchCommit()throws Exception {
        try(var x=new BoundSavedCurrentFixture()){
            var source=census(x.x);var batch=source.f.batch;
            var manifest=batch.journal.observe();var originalBody=body(x.x);
            assertEquals("DURABLE_ATTEMPT:0",originalBody.getString("original_native_mutation_stamp"));
            assertEquals(0,x.durableCounter());
            assertTrue(NativePrivateCustodyExchangeTest.field(batch.journal,"backend") instanceof AndroidRetainedBatchStore);
            var raw=new TreeMap<String,Map<String,Object>>();
            for(String name:source.unknown.keySet())raw.put(name,new java.util.HashMap<>(source.raw(name)));
            var durableWork=new java.util.HashMap<>(batch.old.workDisk.durable);
            var durableBatch=new java.util.HashMap<>(batch.root.durable);
            var operations=NativePrivateCustodyOwnerTest.files(x.x.dir);
            var queries=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            var capsules=NativePrivateCustodyOwnerTest.files(x.x.f.dir);
            Map<Path,Object> originalInodes=new java.util.HashMap<>();
            for(Path directory:new Path[]{x.x.dir,x.original.f.dir,x.x.f.dir}){
                originalInodes.put(directory,Files.readAttributes(directory,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                try(var entries=Files.newDirectoryStream(directory)){
                    for(Path entry:entries)originalInodes.put(entry,Files.readAttributes(entry,java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
            }
            int commits=batch.root.commits,workCommits=batch.old.workDisk.commits,ids=batch.ids,oldIds=batch.old.ids;
            int indexEncrypts=batch.indexCipher.encrypts;Map<String,Integer> domainEncrypts=new TreeMap<>();
            batch.domains.forEach((name,cipher)->domainEncrypts.put(name,cipher.encrypts));
            long processEpoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            byte[] oldEncoded;
            try(var oldOwner=x.owner()){
                var oldFrame=(VaultEngine.NativePrivateCustodyTransportFrame)NativePrivateCustodyExchangeTest.field(oldOwner,"frame");
                oldEncoded=(byte[])NativePrivateCustodyExchangeTest.field(oldFrame,"encoded");
                assertEquals("DURABLE_ATTEMPT:0",NativePrivateCustodyExchangeTest.field(oldFrame,"originalNativeMutationStamp"));
                savedCurrentMark("cold_descriptor_original0_bound");
                // Existing owning path: exact WORK reaffirmation followed by
                // the exact original native batch commit, neither a raw map
                // backend call nor a scalar/caller admission substitute.
                try(var generation=source.f.generation();var reaffirmed=source.f.prepare(generation)){
                    assertEquals(commits+1,batch.root.commits);assertEquals(workCommits+1,batch.old.workDisk.commits);
                    assertEquals(processEpoch+2,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
                    assertEquals("two successful protected original writers",2,x.durableCounter());
                    assertTrue(ProviderWireJson.same(manifest.json(),batch.journal.observe().json()));
                    assertEquals(durableWork,batch.old.workDisk.durable);assertEquals(durableBatch,batch.root.durable);
                }
                // Reading the immutable cached descriptor is not authority:
                // its real owning binding check must still refuse the stale
                // graph. No cached successful Source/currentness is accepted.
                assertEquals("DURABLE_ATTEMPT:0",NativePrivateCustodyExchangeTest.field(oldFrame,"originalNativeMutationStamp"));
                denied(oldFrame::operationBindingForFixedJournal);
                savedCurrentMark("cold_descriptor_real_WORK_and_batch_committed_live2_old_descriptor0");
            }
            for(byte value:oldEncoded)assertEquals(0,value);
            savedCurrentMark("cold_descriptor_old_volatile_owner_closed");
            var cold=fresh(x.x);assertNotSame(x.engine,cold);assertNotSame(batch.old.engine,cold);
            var bound=x.x.f.x.f;assertNotNull(bound.boundVaultPreferences);assertNotNull(bound.boundWorkPreferences);
            Map<String,SharedPreferences> existing=new TreeMap<>();
            for(String name:source.unknown.keySet()){
                if(name.equals(NativeVaultProviderReferenceCensus.VAULT))existing.put(name,bound.boundVaultPreferences);
                else if(name.equals(NativeRetainedNamespaceCensus.WORK))existing.put(name,bound.boundWorkPreferences);
                else existing.put(name,(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                        if(!method.getName().equals("getAll"))throw new AssertionError("cold saved reader edited preferences");
                        return new java.util.HashMap<>(source.raw(name));
                    }));
            }
            Path epochDirectory=x.x.f.root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var epochFiles=NativePrivateCustodyOwnerTest.files(epochDirectory);
            assertFalse(epochFiles.containsKey(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN));
            assertFalse(epochFiles.containsKey(NativePrivateMutationEpochStore.PENDING));
            assertFalse(epochFiles.containsKey(NativePrivateMutationEpochStore.PREVIOUS));
            Map<Path,Object> epochInodes=new java.util.HashMap<>();
            for(String name:epochFiles.keySet()){
                Path path=epochDirectory.resolve(name);epochInodes.put(path,Files.readAttributes(path,
                    java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }
            VaultFailure refused=null;
            try(var unexpected=cold.prepareSavedOriginalPrivateCustodyCurrentRead(batch.old.work,batch.old.principal,null,
                new NativeProviderJournal(source.f.store.store(),source.f.store.lock),batch.journal,
                AndroidProtectedNamespaceReaders.bind(existing),x.x.f.store,x.x.store)){
                fail("cold owner silently rebound saved descriptor0 to live epoch2");
            }catch(VaultFailure expected){refused=expected;}
            assertNotNull(refused);
            assertTrue("refusal must reach original saved operation binding, not earlier prerequisites",
                Arrays.stream(refused.getStackTrace()).anyMatch(point->point.getClassName().equals(VaultEngine.class.getName())
                    &&point.getMethodName().equals("recoverOriginalPrivateCustodyOperation")));
            assertEquals("DURABLE_ATTEMPT:0",body(x.x).getString("original_native_mutation_stamp"));
            assertTrue(ProviderWireJson.same(originalBody,body(x.x)));
            assertEquals(2,x.durableCounter());assertEquals(processEpoch+2,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
            assertEquals(commits+1,batch.root.commits);assertEquals(workCommits+1,batch.old.workDisk.commits);
            assertEquals(ids,batch.ids);assertEquals(oldIds,batch.old.ids);assertEquals(indexEncrypts,batch.indexCipher.encrypts);
            Map<String,Integer> afterEncrypts=new TreeMap<>();batch.domains.forEach((name,cipher)->afterEncrypts.put(name,cipher.encrypts));
            assertEquals(domainEncrypts,afterEncrypts);assertTrue(ProviderWireJson.same(manifest.json(),batch.journal.observe().json()));
            for(String name:raw.keySet())assertEquals("same original raw rows "+name,raw.get(name),source.raw(name));
            assertEquals(durableWork,batch.old.workDisk.durable);assertEquals(durableBatch,batch.root.durable);
            assertEquals("no HTTP or new current-read request",0,x.connections.size());
            NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(epochFiles,epochDirectory);
            for(var map:java.util.List.of(originalInodes,epochInodes))for(var entry:map.entrySet())assertEquals("same retained file identity",
                entry.getValue(),Files.readAttributes(entry.getKey(),java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            savedCurrentMark("cold_descriptor_fresh_engine_saved_binding_refused_no_HTTP_originals_retained");
        }
    }
    @Test public void SAVED_CURRENT_falseOriginalBatchInvalidatesGuardedRead()throws Exception {
        savedCurrentUnknownOriginalBatch(false);
    }
    @Test public void SAVED_CURRENT_throwAfterOriginalBatchInvalidatesGuardedRead()throws Exception {
        savedCurrentUnknownOriginalBatch(true);
    }
    /** Two NEW owning outcomes only. Faults are the existing UNIT backing's
     * ordinary storage controls, never native admission/epoch/control tokens. */
    private void savedCurrentUnknownOriginalBatch(boolean throwAfter)throws Exception {
        String outcome=throwAfter?"THROW_AFTER":"FALSE";
        try(var x=new BoundSavedCurrentFixture()){
            var source=census(x.x);var batch=source.f.batch;var originalManifest=batch.journal.observe();
            assertTrue(NativePrivateCustodyExchangeTest.field(batch.journal,"backend") instanceof AndroidRetainedBatchStore);
            assertFalse(batch.root.fail);assertFalse(batch.root.throwAfter);
            assertNull(AndroidProtectedWorkPreferences.pendingRetainedBatch(batch.root.preferences()));
            var raw=new TreeMap<String,Map<String,Object>>();
            for(String name:source.unknown.keySet())raw.put(name,new java.util.HashMap<>(source.raw(name)));
            var durableBatch=new java.util.HashMap<>(batch.root.durable);
            var durableWork=new java.util.HashMap<>(batch.old.workDisk.durable);
            var operations=NativePrivateCustodyOwnerTest.files(x.x.dir);
            var queries=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            var capsules=NativePrivateCustodyOwnerTest.files(x.x.f.dir);
            Map<Path,Object> originalInodes=new java.util.HashMap<>();
            for(Path directory:new Path[]{x.x.dir,x.original.f.dir,x.x.f.dir}){
                originalInodes.put(directory,Files.readAttributes(directory,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                try(var entries=Files.newDirectoryStream(directory)){
                    for(Path entry:entries)originalInodes.put(entry,Files.readAttributes(entry,java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
            }
            int ids=batch.ids,oldIds=batch.old.ids,commits=batch.root.commits,candidates=batch.root.candidates.size();
            int workCommits=batch.old.workDisk.commits,indexEncrypts=batch.indexCipher.encrypts;
            Map<String,Integer> domainEncrypts=new TreeMap<>();batch.domains.forEach((name,cipher)->domainEncrypts.put(name,cipher.encrypts));
            long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            long durableBefore=x.durableCounter(); // Known original baseline, not a post-UNKNOWN scalar guess.
            Path epochDirectory=x.x.f.root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            assertFalse(Files.exists(epochDirectory.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            final int[] beforeEdits={0},afterMemoryEdits={0};final boolean[] invoked={false},writerRefused={false};
            var originalBefore=batch.root.beforeCommit;var originalAfter=batch.root.afterCommit;
            batch.root.beforeCommit=()->{originalBefore.run();beforeEdits[0]++;
                assertEquals("normal original WORK reaffirmation reached before batch editor",workCommits+1,batch.old.workDisk.commits);};
            batch.root.afterCommit=()->{originalAfter.run();afterMemoryEdits[0]++;};
            try(var owner=x.owner()){
                assertEquals("owner reconstruction does not advance original durable baseline",durableBefore,x.durableCounter());
                byte[] ownedFrame=(byte[])NativePrivateCustodyExchangeTest.field(
                    NativePrivateCustodyExchangeTest.field(owner,"frame"),"encoded");
                x.beforeReply=()->{
                    assertFalse("only intended first reply",invoked[0]);invoked[0]=true;
                    batch.root.fail=!throwAfter;batch.root.throwAfter=throwAfter;
                    savedCurrentMark("outcome_"+outcome+"_actual_original_writer_begin");
                    try(var generation=source.f.generation();var reaffirmed=source.f.prepare(generation)){
                        fail("injected original batch outcome must not acknowledge a commit");
                    }catch(VaultFailure expected){writerRefused[0]=true;}
                    // A refusal before the real editor attempt cannot pass.
                    assertEquals("actual batch commit attempt",commits+1,batch.root.commits);
                    assertEquals(1,beforeEdits[0]);assertEquals(throwAfter?1:0,afterMemoryEdits[0]);
                    assertEquals(candidates+1,batch.root.candidates.size());
                    assertEquals("exact attempted ciphertext",raw.get(NativeRetainedNamespaceCensus.BATCH),batch.root.candidates.get(candidates));
                    assertEquals("WORK reaffirmation plus batch attempt",epoch+2,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
                    assertEquals(durableWork,batch.old.workDisk.durable);
                    assertEquals("UNKNOWN is not durable acknowledgement",durableBatch,batch.root.durable);
                    assertTrue(ProviderWireJson.same(originalManifest.json(),batch.journal.observe().json()));
                    var pending=AndroidProtectedWorkPreferences.pendingRetainedBatch(batch.root.preferences());
                    assertNotNull("same typed original remains pending",pending);assertEquals("prepare",pending.purpose);
                    assertTrue(ProviderWireJson.same(originalManifest.json(),pending.manifest.json()));
                    assertEquals(raw.get(NativeRetainedNamespaceCensus.BATCH),pending.expected);
                    assertTrue(Files.isRegularFile(epochDirectory.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    savedCurrentMark("outcome_"+outcome+"_actual_batch_attempt_UNKNOWN_pending_retained");
                    // Deliberately return the unchanged UNIT response, not the
                    // writer exception. The read must invalidate independently.
                };
                savedCurrentMark("outcome_"+outcome+"_saved_current_read_begin");
                denied(()->{try(var unexpected=x.read(owner)){fail("UNKNOWN writer allowed current read acceptance");}});
                assertTrue("first reply reached",invoked[0]);assertTrue("actual writer refusal captured",writerRefused[0]);
                assertEquals(1,x.connections.size());x.closedConnections();
                assertTrue((Boolean)NativePrivateCustodyExchangeTest.field(owner,"closed"));
                for(byte value:ownedFrame)assertEquals(0,value);
                var sent=ProviderWireJson.object(x.connections.get(0).sent.toByteArray(),526336);
                assertArrayEquals(x.originalQueries.get(0),java.util.Base64.getDecoder().decode(sent.getString("original_query_body_base64")));
                var signed=ProviderWireJson.object(x.originalQueries.get(0),393216);
                assertEquals(signed.get("read_query_id"),x.connections.get(0).headers.get("X-Memphis-Native-Request-Id"));
                assertEquals(ids,batch.ids);assertEquals(oldIds,batch.old.ids);assertEquals(indexEncrypts,batch.indexCipher.encrypts);
                Map<String,Integer> afterEncrypts=new TreeMap<>();batch.domains.forEach((name,cipher)->afterEncrypts.put(name,cipher.encrypts));
                assertEquals("no replacement cipher domain or IV",domainEncrypts,afterEncrypts);
                for(String name:raw.keySet())assertEquals("unchanged original rows "+name,raw.get(name),source.raw(name));
                var pending=AndroidProtectedWorkPreferences.pendingRetainedBatch(batch.root.preferences());assertNotNull(pending);
                var unknownFiles=NativePrivateCustodyOwnerTest.files(epochDirectory);
                assertTrue(unknownFiles.containsKey(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN));
                assertFalse(unknownFiles.containsKey(NativePrivateMutationEpochStore.PENDING));
                assertFalse(unknownFiles.containsKey(NativePrivateMutationEpochStore.PREVIOUS));
                Map<Path,Object> unknownInodes=new java.util.HashMap<>();
                for(String name:unknownFiles.keySet()){
                    Path path=epochDirectory.resolve(name);unknownInodes.put(path,Files.readAttributes(path,
                        java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
                denied(x::durableCounter); // Refuse UNKNOWN; never infer a completed next counter.
                // Clearing only the injected storage fault MUST NOT clear the
                // real typed pending or external UNKNOWN/durable fence state.
                batch.root.fail=false;batch.root.throwAfter=false;
                denied(()->{try(var unexpected=x.read(owner)){fail("closed stale read revived");}});
                denied(()->{try(var unexpected=x.owner()){fail("UNKNOWN original owner revived");}});
                denied(x::durableCounter);
                assertEquals(1,x.connections.size());assertEquals(commits+1,batch.root.commits);
                assertEquals(1,beforeEdits[0]);assertEquals(throwAfter?1:0,afterMemoryEdits[0]);
                assertSame(pending,AndroidProtectedWorkPreferences.pendingRetainedBatch(batch.root.preferences()));
                NativePrivateCustodyOwnerTest.sameFiles(unknownFiles,epochDirectory);
                for(var entry:unknownInodes.entrySet())assertEquals(entry.getValue(),Files.readAttributes(entry.getKey(),
                    java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                savedCurrentMark("outcome_"+outcome+"_stale_read_wiped_flags_cleared_pending_UNKNOWN_no_retry");
            }finally{
                batch.root.fail=false;batch.root.throwAfter=false;
                batch.root.beforeCommit=originalBefore;batch.root.afterCommit=originalAfter;
            }
            NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);
            NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);
            for(var entry:originalInodes.entrySet())assertEquals("same original file identity",entry.getValue(),
                Files.readAttributes(entry.getKey(),java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        }
    }
    @Test public void SAVED_CURRENT_sameByteOriginalBatchCommitInvalidatesGuardedRead()throws Exception {
        try(var x=new BoundSavedCurrentFixture()){
            var source=census(x.x);var batch=source.f.batch;
            var originalManifest=batch.journal.observe();
            var raw=new TreeMap<String,Map<String,Object>>();
            for(String name:source.unknown.keySet())raw.put(name,new java.util.HashMap<>(source.raw(name)));
            var operations=NativePrivateCustodyOwnerTest.files(x.x.dir);
            var queries=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            var capsules=NativePrivateCustodyOwnerTest.files(x.x.f.dir);
            Map<Path,Object> originalInodes=new java.util.HashMap<>();
            for(Path directory:new Path[]{x.x.dir,x.original.f.dir,x.x.f.dir})try(var entries=Files.newDirectoryStream(directory)){
                for(Path entry:entries)originalInodes.put(entry,Files.readAttributes(entry,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }
            int ids=batch.ids,oldIds=batch.old.ids,commits=batch.root.commits;
            long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
            long durableEpoch=x.durableCounter();
            assertTrue("actual product batch backend",NativePrivateCustodyExchangeTest.field(batch.journal,"backend") instanceof AndroidRetainedBatchStore);
            // A NEW affected saved-owner read, not a replay of the browser
            // fixture's @Tests. Reconstruct from saved originals after closure.
            try(var owner=x.owner();var result=x.read(owner)){
                var projection=result.projection();var crypto=projection.getJSONObject("crypto");
                for(String key:new String[]{"operation_id","original_generation_id","frame_sha256","record_sha256","plan_sha256"})
                    assertEquals(key,x.expectedPlan.get(key),crypto.get(key));
                assertTrue(crypto.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                assertTrue(crypto.getBoolean("exact_original_all8_values_compared_in_native_only"));
                for(String key:new String[]{"inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})
                    assertFalse(key,projection.getBoolean(key));
                assertEquals(x.originalQueries.size(),x.connections.size());
                for(int index=0;index<x.connections.size();index++){
                    var sent=ProviderWireJson.object(x.connections.get(index).sent.toByteArray(),526336);
                    assertArrayEquals(x.originalQueries.get(index),java.util.Base64.getDecoder().decode(sent.getString("original_query_body_base64")));
                }
            }
            x.closedConnections();assertEquals(epoch,AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture());
            assertEquals(durableEpoch,x.durableCounter());assertEquals(commits,batch.root.commits);
            NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);
            NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);
            for(String name:raw.keySet())assertEquals("original raw rows after fresh saved read "+name,raw.get(name),source.raw(name));
            savedCurrentMark("bound_saved_same_original_full_read_completed_without_write");
            int connectionBase=x.connections.size();
            final boolean[] invoked={false},committed={false};
            try(var owner=x.owner()){
                byte[] ownedFrame=(byte[])NativePrivateCustodyExchangeTest.field(
                    NativePrivateCustodyExchangeTest.field(owner,"frame"),"encoded");
                x.beforeReply=()->{
                    if(invoked[0])return;
                    invoked[0]=true;
                    try(var generation=source.f.generation();var reaffirmed=source.f.prepare(generation)){
                        assertTrue(ProviderWireJson.same(originalManifest.json(),batch.journal.observe().json()));
                        assertEquals("same original ciphertext",raw.get(NativeRetainedNamespaceCensus.BATCH),source.raw(NativeRetainedNamespaceCensus.BATCH));
                        assertEquals("actual batch commit",commits+1,batch.root.commits);
                        assertTrue("actual attempted-write epoch advanced",
                            AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture()>epoch);
                        // The owning Engine first reaffirms the SAME WORK
                        // freeze, then commits the SAME batch. Each real
                        // protected writer advances the durable journal once.
                        assertEquals("WORK reaffirmation and original batch durable commits",durableEpoch+2,x.durableCounter());
                        assertEquals("unchanged original durable batch rows",raw.get(NativeRetainedNamespaceCensus.BATCH),batch.root.durable);
                        committed[0]=true;
                        savedCurrentMark("bound_saved_actual_original_batch_commit_completed_durable_epoch_advanced");
                    }
                };
                savedCurrentMark("same_byte_original_batch_commit_during_reply_begin");
                denied(()->x.read(owner));
                assertTrue("first synthetic reply reached original batch",invoked[0]);
                assertTrue("exact original commit completed",committed[0]);
                assertEquals("no new batch ID",ids,batch.ids);
                assertEquals("no new original attempt ID",oldIds,batch.old.ids);
                for(String name:raw.keySet())assertEquals("same raw bytes "+name,raw.get(name),source.raw(name));
                assertEquals(connectionBase+1,x.connections.size());x.closedConnections();
                assertTrue((Boolean)NativePrivateCustodyExchangeTest.field(owner,"closed"));
                for(byte b:ownedFrame)assertEquals(0,b);
                denied(()->x.read(owner));assertEquals("no retry",connectionBase+1,x.connections.size());
            }
            NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);
            NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);
            for(var entry:originalInodes.entrySet())assertEquals("same original inode",entry.getValue(),
                Files.readAttributes(entry.getKey(),java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            savedCurrentMark("bound_saved_stale_read_refused_wiped_no_retry_originals_retained");
        }
    }
    @Test public void SAVED_CURRENT_freshEngineOwnsExactOriginalFrameAndRepeatCannotFreeResult()throws Exception {
        try(var x=new SavedCurrentFixture();var owner=savedCurrent(x.engine,x.x)){
            var operations=NativePrivateCustodyOwnerTest.files(x.x.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.x.f.dir);var queries=NativePrivateCustodyOwnerTest.files(x.original.f.dir);
            byte[] ownedFrame=(byte[])NativePrivateCustodyExchangeTest.field(NativePrivateCustodyExchangeTest.field(owner,"frame"),"encoded");
            assertEquals(x.expectedPlan.get("frame_sha256"),NativeRetainedAttempt.hash(ownedFrame));
            synchronized(x.engine){denied(()->x.read(owner));}assertEquals(0,x.connections.size());
            assertFalse((Boolean)NativePrivateCustodyExchangeTest.field(owner,"started"));
            savedCurrentMark("saved_owner_current_read_begin");
            var result=x.read(owner);byte[] returned=(byte[])NativePrivateCustodyExchangeTest.field(NativePrivateCustodyExchangeTest.field(result,"crypto"),"returned");
            try{
                var p=result.projection();assertEquals("custodial.native-current-original-frame-read.v1",p.get("schema"));
                var crypto=p.getJSONObject("crypto");
                for(String key:new String[]{"operation_id","original_generation_id","frame_sha256","record_sha256","plan_sha256"})assertEquals(key,x.expectedPlan.get(key),crypto.get(key));
                assertTrue(crypto.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                assertTrue(crypto.getBoolean("exact_original_all8_values_compared_in_native_only"));
                assertArrayEquals(ownedFrame,returned);
                for(String key:new String[]{"inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(p.getBoolean(key));
                assertEquals(x.originalQueries.size(),x.connections.size());
                for(int i=0;i<x.connections.size();i++){
                    var outer=ProviderWireJson.object(x.connections.get(i).sent.toByteArray(),526336);
                    assertArrayEquals(x.originalQueries.get(i),java.util.Base64.getDecoder().decode(outer.getString("original_query_body_base64")));
                    var originalBody=ProviderWireJson.object(x.originalQueries.get(i),393216);
                    assertEquals(originalBody.get("read_query_id"),x.connections.get(i).headers.get("X-Memphis-Native-Request-Id"));
                }
                denied(()->x.read(owner));synchronized(x.engine){denied(()->x.read(owner));}
                assertFalse((Boolean)NativePrivateCustodyExchangeTest.field(owner,"closed"));
                assertTrue(ProviderWireJson.same(p,result.projection()));assertEquals(x.originalQueries.size(),x.connections.size());
                x.closedConnections();savedCurrentMark("typed_read_survives_refused_repeat");
            }finally{result.close();}
            for(byte b:returned)assertEquals(0,b);for(byte b:ownedFrame)assertEquals(0,b);
            assertTrue((Boolean)NativePrivateCustodyExchangeTest.field(owner,"closed"));denied(result::projection);
            NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);
        }
    }
    @Test public void SAVED_CURRENT_missingChangedHintAndAll8RefuseBeforeIO()throws Exception {
        NativePrivateCustodyOperationTest.Fixture fixture;
        try(var issuer=new SavedCurrentIssuer()){fixture=new NativePrivateCustodyOperationTest.Fixture();}
        try(var x=fixture){
            var engine=fresh(x);final int[] opens={0};
            var http=new NativePrivateCustodyHttp(url->{opens[0]++;throw new AssertionError("saved precondition opened HTTP");},census(x).f.batch.old.clock);
            NativeOriginalGenerationObservationTest.Action attempt=()->{try(var owner=savedCurrent(engine,x)){
                engine.readSavedOriginalPrivateCustodyCurrentFrame(owner,VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile()),http,new NativePrivateCustodyFrameReadControl());}};
            denied(attempt);assertFalse(Files.exists(x.dir));
            try(var operation=x.prepare()){assertNotNull(operation.projection());}
            byte[] original=Files.readAllBytes(x.committed);
            try{
                Files.move(x.committed,x.pending);var pending=NativePrivateCustodyOwnerTest.files(x.dir);denied(attempt);NativePrivateCustodyOwnerTest.sameFiles(pending,x.dir);
                Files.move(x.pending,x.committed);
                byte[] altered=repack(body(x).put("frame_sha256","a".repeat(64)));
                try{Files.write(x.committed,altered);var changed=NativePrivateCustodyOwnerTest.files(x.dir);denied(attempt);NativePrivateCustodyOwnerTest.sameFiles(changed,x.dir);}
                finally{Arrays.fill(altered,(byte)0);Files.write(x.committed,original);}
                var operations=NativePrivateCustodyOwnerTest.files(x.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.f.dir);
                census(x).unknown.get("MemphisZooCustodialNativeVaultV1").put("saved-current-zero-io-owner-change","synthetic");
                denied(attempt);NativePrivateCustodyOwnerTest.sameFiles(operations,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsules,x.f.dir);
                assertEquals(0,opens[0]);assertFalse(Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void SAVED_CURRENT_ownerAndHintChangesDuringReplyRefuseAndPreserve()throws Exception {
        try(var x=new SavedCurrentFixture()){
            var source=census(x.x);var raw=source.unknown.get("MemphisZooCustodialNativeVaultV1");
            for(String fault:new String[]{"owner","hint"}){
                byte[] altered=null;var operations=NativePrivateCustodyOwnerTest.files(x.x.dir);var queries=NativePrivateCustodyOwnerTest.files(x.original.f.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.x.f.dir);
                if(fault.equals("hint"))altered=repack(body(x.x).put("frame_sha256","b".repeat(64)));
                final byte[] changed=altered;final Map<String,byte[]>[] afterFault=new Map[1];
                try(var owner=savedCurrent(x.engine,x.x)){
                    x.beforeReply=()->{if(fault.equals("owner"))raw.put("saved-current-reply-owner-change","synthetic");
                        else{Files.write(x.x.committed,changed);afterFault[0]=NativePrivateCustodyOwnerTest.files(x.x.dir);}};
                    denied(()->x.read(owner));assertEquals(1,x.connections.size());x.closedConnections();
                    assertTrue((Boolean)NativePrivateCustodyExchangeTest.field(owner,"closed"));
                    NativePrivateCustodyOwnerTest.sameFiles(queries,x.original.f.dir);NativePrivateCustodyOwnerTest.sameFiles(capsules,x.x.f.dir);
                    if(fault.equals("hint")){assertNotNull(afterFault[0]);NativePrivateCustodyOwnerTest.sameFiles(afterFault[0],x.x.dir);assertArrayEquals(changed,Files.readAllBytes(x.x.committed));}
                    else NativePrivateCustodyOwnerTest.sameFiles(operations,x.x.dir);
                }finally{if(altered!=null)Arrays.fill(altered,(byte)0);}
                if(fault.equals("owner")){raw.remove("saved-current-reply-owner-change");x.connections.clear();}
            }
        }
    }
    static NativeRetainedNamespaceCensusTest.Fixture census(NativePrivateCustodyOperationTest.Fixture x){return x.f.x.f.x;}
    static Map<String,NativeProtectedNamespaceObservation.Store> readers(NativeRetainedNamespaceCensusTest.Fixture source){
        var readers=new TreeMap<String,NativeProtectedNamespaceObservation.Store>();
        for(String name:source.unknown.keySet())readers.put(name,()->source.raw(name));return readers;
    }
    static JSONObject read(VaultEngine engine,NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=census(x);var old=source.f.batch.old;
        var provider=new NativeProviderJournal(source.f.store.store(),source.f.store.lock);
        var exchange=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile());
        return engine.recoverOriginalPrivateCustodyPiecesFromSavedOperation(old.work,old.principal,null,provider,source.f.batch.journal,readers(source),x.f.store,x.store,exchange);
    }
    static JSONObject resume(VaultEngine engine,NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=census(x);var old=source.f.batch.old;
        var provider=new NativeProviderJournal(source.f.store.store(),source.f.store.lock);
        var store=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(x.f.root.toFile());
        return engine.resumeSavedOriginalPendingPrivateCustodyOwner(old.work,old.principal,null,provider,
            source.f.batch.journal,readers(source),x.f.store,store);
    }
    static VaultEngine fresh(NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=census(x);var old=source.f.batch.old;var adapter=x.f.x.f.adapter;
        return new VaultEngine(new VaultPersistence(){
            public VaultSnapshot load()throws VaultFailure{return old.persistence.load();}
            public void commit(long revision,VaultSnapshot next){throw new AssertionError("local owner resume must not commit vault");}
            public boolean matchesCapturedOriginalSnapshot(Map<String,?> rows,VaultSnapshot original)throws VaultFailure{
                return adapter.matchesCapturedOriginalSnapshot(rows,original);}
        },old.vaultCipher,old.enrollment,new FakeLegacySource(),new TestSealGenerator(),old.clock);
    }
    @Test public void freshOwnerResumesSamePendingAndAliasWithoutCreatingTransport()throws Exception {
        for(boolean alias:new boolean[]{false,true})for(String capsulePhase:new String[]{"committed","pending","alias"})try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            JSONObject expected;try(var original=x.prepare()){expected=original.projection();}
            byte[] bytes=Files.readAllBytes(x.committed);
            if(alias)Files.createLink(x.pending,x.committed);else Files.move(x.committed,x.pending);
            var capsules=NativePrivateCustodyOwnerTest.files(x.f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(census(x));
            if(capsulePhase.equals("pending"))Files.move(x.f.committed,x.f.pending);
            if(capsulePhase.equals("alias"))Files.createLink(x.f.pending,x.f.committed);
            x.frame.close();x.owner.close();x.f.h.close();
            var value=resume(fresh(x),x);NativePrivateCustodyOperationTest.noAuthority(value);
            assertEquals("custodial.native-same-original-pending-owner-resume.v1",value.get("schema"));
            for(String field:new String[]{"operation_id","original_generation_id","frame_sha256","record_sha256",
                "journal_record_sha256","journal_record_bytes"})assertEquals(field,expected.get(field),value.get(field));
            assertEquals("COMMITTED",value.get("journal_phase"));assertTrue(value.getBoolean("local_operation_committed_observed"));
            assertTrue(value.getBoolean("original_pending_record_bytes_and_operation_identity_preserved"));
            assertTrue(value.getBoolean("full_native_original_owner_reconstructed_before_local_resume"));
            assertTrue(value.getBoolean("same_original_capsule_recovered_without_rebinding_operation"));
            for(String field:new String[]{"new_owner_generation_encryption_query_or_HTTP_created","manager_removal_or_reassignment_authority",
                "actual_Android_process_restart_or_power_loss_qualified"})assertFalse(value.getBoolean(field));
            assertArrayEquals(bytes,Files.readAllBytes(x.committed));assertFalse(Files.exists(x.pending));
            assertFalse(Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.f.dir);stable.check();Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void missingForeignAndChangedNamespacesNeverPromotePendingOwner()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            denied(()->resume(fresh(x),x));assertFalse(Files.exists(x.dir));
        }
        for(String fault:new String[]{"foreign_frame","foreign_frame_pending_capsule","changed_namespace"})try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            JSONObject oldBody;try(var original=x.prepare()){oldBody=body(x);}
            Files.move(x.committed,x.pending);
            if(fault.startsWith("foreign_frame")){
                byte[] encoded=repack(oldBody.put("frame_sha256","a".repeat(64)));
                try{Files.write(x.pending,encoded);}finally{Arrays.fill(encoded,(byte)0);}
            }else census(x).unknown.get("MemphisZooCustodialNativeVaultV1").put("new-foreign-row","retained");
            if(fault.equals("foreign_frame_pending_capsule"))Files.move(x.f.committed,x.f.pending);
            var files=NativePrivateCustodyOwnerTest.files(x.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(()->resume(fresh(x),x));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
            NativePrivateCustodyOwnerTest.sameFiles(capsules,x.f.dir);assertTrue(Files.exists(x.pending));assertFalse(Files.exists(x.committed));
        }
    }
    static void safe(JSONObject value)throws Exception {
        NativePrivateCustodyStoredPieceConsumerTest.safe(value);
        assertEquals("custodial.native-saved-original-private-custody-owner-recovery.v1",value.get("schema"));
        for(String field:new String[]{"original_generation_selected_from_existing_committed_operation_not_caller_or_latest","saved_hint_matched_full_original_frame_and_immutable_operation_record",
            "original_WORK_provider_all8_capsule_frame_bindings_reconstructed_in_native_only","original_owner_proof_deterministically_recomputed_AND_matches_saved_frame",
            "current_all8_rows_must_still_match_original_saved_capture"})assertTrue(field,value.getBoolean(field));
        for(String field:new String[]{"caller_selected_generation_operation_query_response_or_path","missing_original_owner_recreated_or_promoted",
            "fresh_WORK_request_timestamp_or_query_signature_created","actual_Android_process_restart_or_power_loss_qualified"})assertFalse(field,value.getBoolean(field));
    }
    static byte[] repack(JSONObject body)throws Exception {
        char[] clear=body.toString().toCharArray();
        try{var cipher=new AndroidKeystoreCipher(NativePrivateCustodyOperationStore.AAD,NativePrivateCustodyOperationStore.MAX_CLEAR);
            var secret=cipher.encryptWithExistingKey(clear);var method=NativePrivateCustodyOperationStore.class.getDeclaredMethod("encode",EncryptedSecret.class);method.setAccessible(true);return (byte[])method.invoke(null,secret);
        }finally{VaultValidation.wipe(clear);}
    }
    static JSONObject body(NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var method=x.store.getClass().getDeclaredMethod("readSavedIdentityFile");method.setAccessible(true);
        try(var original=(AutoCloseable)method.invoke(x.store)){return new JSONObject((String)NativePrivateCustodyExchangeTest.field(original,"body"));}
    }
    @Test public void freshEngineReconstructsOriginalOwnersFromSavedOperationAfterAllOldHandlesClosed()throws Exception {
        try(var fixture=new NativePrivateCustodyReturnedPieceSetTest.Fixture()){
            fixture.send(0,fixture.data(0));var x=fixture.f.x;var source=census(x);var old=source.f.batch.old;
            String generation=fixture.f.plan.projection().getString("original_generation_id"),operation=fixture.f.plan.projection().getString("operation_id");
            var capsuleFiles=NativePrivateCustodyOwnerTest.files(x.f.dir);var operationFiles=NativePrivateCustodyOwnerTest.files(x.dir);var exchanges=NativePrivateCustodyOwnerTest.files(fixture.f.dir);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            for(var query:fixture.queries)query.close();fixture.queries.clear();fixture.f.plan.close();fixture.f.operation.close();x.frame.close();x.owner.close();x.f.h.close();
            old.clock.now+=86400000;
            var adapter=x.f.x.f.adapter;
            var fresh=new VaultEngine(new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure{return old.persistence.load();}
                public void commit(long revision,VaultSnapshot next){throw new AssertionError("recovery must not commit vault");}
                public boolean matchesCapturedOriginalSnapshot(Map<String,?> rows,VaultSnapshot original)throws VaultFailure{return adapter.matchesCapturedOriginalSnapshot(rows,original);}
            },old.vaultCipher,old.enrollment,new FakeLegacySource(),new TestSealGenerator(),old.clock);
            var value=read(fresh,x);safe(value);assertEquals(generation,value.get("original_generation_id"));assertEquals(operation,value.get("operation_id"));
            assertEquals(1,value.getInt("historical_exact_original_returned_pieces"));assertFalse(value.getBoolean("all_original_returned_piece_bindings_present"));
            NativePrivateCustodyOwnerTest.sameFiles(capsuleFiles,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operationFiles,x.dir);NativePrivateCustodyOwnerTest.sameFiles(exchanges,fixture.f.dir);
            stable.check();assertEquals(1,fixture.x.opens);
        }
    }
    @Test public void absentPendingAndAliasOperationNeverBecomeFreshOriginalOwnerOrCommittedHint()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            denied(x.store::inspectSavedIdentityHint);denied(()->read(x.f.engine(),x));assertFalse(Files.exists(x.dir));
            try(var original=x.prepare()){assertNotNull(original.projection());}
            Files.move(x.committed,x.pending);var pending=NativePrivateCustodyOwnerTest.files(x.dir);
            denied(x.store::inspectSavedIdentityHint);denied(()->read(x.f.engine(),x));NativePrivateCustodyOwnerTest.sameFiles(pending,x.dir);
            Files.move(x.pending,x.committed);Files.createLink(x.pending,x.committed);var alias=NativePrivateCustodyOwnerTest.files(x.dir);
            denied(x.store::inspectSavedIdentityHint);denied(()->read(x.f.engine(),x));NativePrivateCustodyOwnerTest.sameFiles(alias,x.dir);
        }
    }
    @Test public void encryptedHintClosedSchemaRejectsMalformedIdentitiesTypesAndExtraFieldsWithoutRepair()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var expected=body(x);var cases=new java.util.ArrayList<JSONObject>();
            cases.add(new JSONObject(expected.toString()).put("unknown",false));cases.add(new JSONObject(expected.toString()).put("schema","unrecognized"));
            cases.add(new JSONObject(expected.toString()).put("original_generation_id","1-1-1-1-1"));
            cases.add(new JSONObject(expected.toString()).put("operation_id","00000000-0000-0000-0000-000000000000"));
            cases.add(new JSONObject(expected.toString()).put("frame_bytes","01"));cases.add(new JSONObject(expected.toString()).put("frame_bytes","9007199254740992"));
            cases.add(new JSONObject(expected.toString()).put("engine_revision",1));cases.add(new JSONObject(expected.toString()).put("principal_digest",true));
            cases.add(new JSONObject(expected.toString()).put("owner_binding_sha256","A".repeat(64)));
            for(var bad:cases){byte[] encoded=repack(bad);try{Files.write(x.committed,encoded);var saved=NativePrivateCustodyOwnerTest.files(x.dir);
                denied(x.store::inspectSavedIdentityHint);NativePrivateCustodyOwnerTest.sameFiles(saved,x.dir);}finally{Arrays.fill(encoded,(byte)0);}}
        }
    }
    @Test public void structurallyValidHintCannotReplaceFullOriginalFrameBinding()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var changed=body(x).put("frame_sha256","a".repeat(64));byte[] encoded=repack(changed);
            try{Files.write(x.committed,encoded);var files=NativePrivateCustodyOwnerTest.files(x.dir);
                try(var hint=x.store.inspectSavedIdentityHint()){assertNotNull(hint.generationForOwningEngine());}
                denied(()->read(x.f.engine(),x));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);assertFalse(Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            }finally{Arrays.fill(encoded,(byte)0);}
        }
    }
    @Test public void laterProviderGenerationDoesNotBecomeReplacementOriginalOwnerOrSavedCapsule()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var source=census(x);source.f.rotate();var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var operations=NativePrivateCustodyOwnerTest.files(x.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.f.dir);
            denied(()->read(x.f.engine(),x));stable.check();NativePrivateCustodyOwnerTest.sameFiles(operations,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsules,x.f.dir);
        }
    }
    @Test public void busyClosedAndChangedSavedHintsRefuseAndNormalFrameBoundReaderRemainsExact()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var files=NativePrivateCustodyOwnerTest.files(x.dir);
            try(var lock=FileChannel.open(x.dir.resolve(NativePrivateCustodyOperationStore.LOCK),StandardOpenOption.WRITE);var held=lock.lock()){
                denied(x.store::inspectSavedIdentityHint);NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
            }
            try(var hint=x.store.inspectSavedIdentityHint();var inspected=x.store.inspectOriginal(x.frame)){
                assertTrue(hint.matchesFullyVerifiedOperation(inspected));x.store.requireSavedIdentityHintCurrent(hint);
                var changed=body(x).put("proof_wire_sha256","b".repeat(64));byte[] encoded=repack(changed);
                try{Files.write(x.committed,encoded);var retained=NativePrivateCustodyOwnerTest.files(x.dir);denied(()->x.store.requireSavedIdentityHintCurrent(hint));
                    denied(()->x.store.inspectOriginal(x.frame));NativePrivateCustodyOwnerTest.sameFiles(retained,x.dir);}finally{Arrays.fill(encoded,(byte)0);}
            }
            // This handle is created from structurally valid altered metadata,
            // not credited as a verified frame or admission after closure.
            var closed=x.store.inspectSavedIdentityHint();closed.close();denied(closed::generationForOwningEngine);denied(()->x.store.requireSavedIdentityHintCurrent(closed));
        }
    }
}
