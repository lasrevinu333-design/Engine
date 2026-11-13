package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** NEW affected generation-bound coordinator cases, not a rerun of old batch
 * passes. Keys, identities, prefs/disk, admission and HTTPS are synthetic. */
public final class NativeGenerationBoundBatchTest {

    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--pending-prepared-restoration-only".equals(args[0])){
            var test=new NativeGenerationBoundBatchTest();
            for(String name:new String[]{"RESTORE_batchPreparedSlotsRetainExactOriginalIdentities","RESTORE_batchWritingUnknownObservedAndDriftAreNeverAbsent"}){
                try{NativeGenerationBoundBatchTest.class.getMethod(name).invoke(test);}
                catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
                System.out.println("PASS_SOURCE_MOCK "+name);
            }
            System.out.println("PRIVATE_BATCH_RESTORED_ORIGINAL_ONLY_NO_RAW_DURABLE_DISPATCH_OR_RELEASE_AUTHORITY");return;
        }
        if(args.length!=1||!("--journal-coordination-only".equals(args[0])||"--journal-observed-recovery-only".equals(args[0])
            ||"--journal-unseen-observed-recovery-only".equals(args[0])))
            throw new IllegalArgumentException("new focused cases required");
        var test=new NativeGenerationBoundBatchTest();
        for(String name:new String[]{"COORD_batchPreparationRetriesExactOriginalAcrossInstances","COORD_slotWriteRetriesExactOriginalAndRejectsForeignBinding",
            "COORD_slotQueryAndAmbiguousFencePreserveOriginal","COORD_coordinatorOrderAndChangedGenerationFailClosed",
            "COORD_zeroChunkUsesSameMonitorWhileWorkHeld","COORD_observedQueryRecommitsExactEvidenceCandidate",
            "COORD_cachedObservedRecoveryWhenMemoryUnchanged"}) {
            if("--journal-observed-recovery-only".equals(args[0])&&!name.equals("COORD_observedQueryRecommitsExactEvidenceCandidate"))continue;
            if("--journal-unseen-observed-recovery-only".equals(args[0])&&!name.equals("COORD_cachedObservedRecoveryWhenMemoryUnchanged"))continue;
            try{NativeGenerationBoundBatchTest.class.getMethod(name).invoke(test);}
            catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(name,error.getCause());}
            System.out.println("PASS_SOURCE_MOCK "+name);
        }
        System.out.println("SOURCE_ONLY_SYNTHETIC_ORIGINAL_GENERATION_NO_REAL_AUTH_SQL_HTTP_ANDROID_OR_PHONE_PROOF");
    }
    private static void fault(NativeRetainedAttemptTest.Disk disk,int mode) {
        disk.fail=mode==0;disk.memoryOnly=mode==1;disk.throwBefore=mode==2;disk.throwAfter=mode==3;
    }
    private static void clearFault(NativeRetainedAttemptTest.Disk disk) {
        disk.fail=false;disk.memoryOnly=false;disk.throwBefore=false;disk.throwAfter=false;
    }
    /** Existing constructors only; no predecessor @Test method is invoked. */
    private static final class CoordinationContext implements AutoCloseable {
        final Fixture f=new Fixture();final NativeRetainedWorkCapture capture;final char[] credential;final byte[] wire;
        final NativeProviderJournal.OriginalGeneration generation;final long revision;
        CoordinationContext()throws Exception {
            revision=f.batch.old.persistence.current().revision;credential=f.batch.old.vaultCipher.decrypt(f.batch.old.persistence.current().secret);
            capture=NativeRetainedWorkCapture.capture(f.batch.old.work);wire=capture.wire().toString().getBytes(StandardCharsets.UTF_8);
            var context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),
                NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(NativeSeparationContextTest.data()
                    .put("credential_id",f.principal.json().getString("credential_id")))),f.principal);
            generation=f.provider.observeOriginalGeneration(f.principal,context,f.original.generationId);
        }
        NativeRetainedBatchJournal.Manifest prepare()throws Exception {
            return f.batch.journal.prepare(capture,f.principal,revision,credential,generation,f.batch::nextId);
        }
        NativeRetainedAttempt original(NativeRetainedBatchJournal.Manifest manifest,int index,int nonce,long revision)throws Exception {
            return NativeRetainedAttempt.prepareChunk(wire,capture.values,f.principal,revision,credential,
                manifest.operationId,manifest.generationId,index,id(nonce),f.batch.old.clock.now);
        }
        @Override public void close(){java.util.Arrays.fill(credential,'\0');java.util.Arrays.fill(wire,(byte)0);}
        void preserved(){close();f.preserved();}
    }

    @Test public void RESTORE_batchPreparedSlotsRetainExactOriginalIdentities()throws Exception {
        for(int mode=0;mode<4;mode++)try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();var write=f.batch.journal.writes(manifest,1);
            assertNull(write.restorePendingPreparedOriginal(c.capture.values,f.principal,c.revision,c.credential,1));
            var original=c.original(manifest,1,9101,c.revision);byte[] body=original.body();
            try {
                fault(f.batch.root,mode);denied(()->write.prepare(original));original.close();
                var candidate=new HashMap<>(f.batch.root.candidates.get(1));var before=new HashMap<>(f.batch.root.memory);
                int commits=f.batch.root.commits;var cipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":write:1");int encrypts=cipher.encrypts;
                clearFault(f.batch.root);f.batch.bind();var rebuiltWrite=f.batch.journal.writes(manifest,1);
                denied(()->f.batch.journal.writes(manifest,2).restorePendingPreparedOriginal(c.capture.values,f.principal,c.revision,c.credential,2));
                try(var restored=rebuiltWrite.restorePendingPreparedOriginal(c.capture.values,f.principal,c.revision,c.credential,1)){
                    assertEquals(manifest.operationId,restored.operationId);assertEquals(manifest.generationId,restored.generationId);assertEquals(id(9101),restored.requestId);
                    byte[] actual=restored.body();try{assertArrayEquals(body,actual);}finally{java.util.Arrays.fill(actual,(byte)0);}
                    denied(()->f.batch.journal.reads(manifest,1).restorePendingPreparedOriginal(restored,f.principal,c.revision,c.credential));
                    assertEquals(before,f.batch.root.memory);assertEquals(commits,f.batch.root.commits);assertEquals(encrypts,cipher.encrypts);
                    rebuiltWrite.prepare(restored);assertEquals(candidate,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                    var read=f.batch.journal.reads(manifest,1);
                    var query=NativeRetainedReadQuery.prepare(restored,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now);
                    byte[] queryBody=query.body();try{
                        fault(f.batch.root,mode);denied(()->read.prepare(query));query.close();
                        var queryCandidate=new HashMap<>(f.batch.root.candidates.get(3));var queryCipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":query:1");
                        int queryEncrypts=queryCipher.encrypts,queryCommits=f.batch.root.commits;before=new HashMap<>(f.batch.root.memory);
                        clearFault(f.batch.root);f.batch.bind();var restoredRead=f.batch.journal.reads(manifest,1);
                        denied(()->f.batch.journal.reads(manifest,2).restorePendingPreparedOriginal(restored,f.principal,c.revision,c.credential));
                        try(var recovered=restoredRead.restorePendingPreparedOriginal(restored,f.principal,c.revision,c.credential)){
                            assertEquals(id(9201),recovered.requestId);byte[] actualQuery=recovered.body();
                            try{assertArrayEquals(queryBody,actualQuery);}finally{java.util.Arrays.fill(actualQuery,(byte)0);}
                            assertEquals(before,f.batch.root.memory);assertEquals(queryCommits,f.batch.root.commits);assertEquals(queryEncrypts,queryCipher.encrypts);
                            restoredRead.prepare(recovered);assertEquals(queryCandidate,f.batch.root.durable);assertEquals(queryEncrypts,queryCipher.encrypts);
                        }
                    }finally{query.close();java.util.Arrays.fill(queryBody,(byte)0);}
                }
            }finally{original.close();java.util.Arrays.fill(body,(byte)0);}
            assertEquals(1,f.batch.ids);assertEquals(0,f.batch.old.opened);c.preserved();
        }
    }
    @Test public void RESTORE_batchWritingUnknownObservedAndDriftAreNeverAbsent()throws Exception {
        try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();var write=f.batch.journal.writes(manifest,1);
            try(var target=c.original(manifest,1,9101,c.revision)){
                int[] refused={0};f.batch.root.beforeCommit=()->{
                    assertTrue(Thread.holdsLock(c.generation.originalCommitCoordinator()));
                    assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));
                    try{denied(()->write.restorePendingPreparedOriginal(c.capture.values,f.principal,c.revision,c.credential,1));refused[0]++;}
                    catch(Exception error){throw new AssertionError(error);}
                };
                f.batch.root.fail=true;synchronized(c.generation.originalCommitCoordinator()){denied(()->write.prepare(target));}
                assertEquals(1,refused[0]);f.batch.root.beforeCommit=()->{};clearFault(f.batch.root);
                try(var recovered=write.restorePendingPreparedOriginal(c.capture.values,f.principal,c.revision,c.credential,1)){write.prepare(recovered);}
                var read=f.batch.journal.reads(manifest,1);
                try(var query=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now)){
                    read.prepare(query);f.batch.root.fail=true;denied(()->read.fenceDispatch(query));clearFault(f.batch.root);
                    int commits=f.batch.root.commits;var stable=new HashMap<>(f.batch.root.memory);
                    denied(()->read.restorePendingPreparedOriginal(target,f.principal,c.revision,c.credential));
                    assertEquals(commits,f.batch.root.commits);assertEquals(stable,f.batch.root.memory);
                    // Settle only the same original UNKNOWN candidate, without a
                    // dispatch handle, then exercise a distinct original OBSERVED
                    // pending phase through the normal recording-client seam.
                    denied(()->read.fenceDispatch(query));
                }
            }
        }
        try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();
            try(var target=c.original(manifest,1,9101,c.revision);
                var query=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now)){
                var read=f.batch.journal.reads(manifest,1);read.prepare(query);
                var connection=new NativeRetainedOwnerTest.Connection(new java.net.URL(NativeRetainedHttp.ORIGIN+NativeRetainedAttempt.PATH));
                connection.response=unknownReply(query).toString().getBytes(StandardCharsets.UTF_8);
                var http=new NativeRetainedHttp(url->connection,()->f.batch.old.clock.now);NativeRetainedReadbackEvidence evidence;
                try(var dispatch=read.fenceDispatch(query);var exchange=http.query(dispatch,f.principal.json().getString("device_id"),c.credential,new NativeRetainedHttp.Attempt())){
                    evidence=NativeRetainedReadbackEvidence.verify(query,exchange);
                }
                f.batch.root.fail=true;denied(()->read.observeReadback(query,evidence));clearFault(f.batch.root);
                var stable=new HashMap<>(f.batch.root.memory);int commits=f.batch.root.commits;
                denied(()->read.restorePendingPreparedOriginal(target,f.principal,c.revision,c.credential));
                assertEquals(stable,f.batch.root.memory);assertEquals(commits,f.batch.root.commits);
                f.batch.root.memory.put("unknown-original-row","do not delete");stable=new HashMap<>(f.batch.root.memory);
                denied(()->read.restorePendingPreparedOriginal(target,f.principal,c.revision,c.credential));
                assertEquals(stable,f.batch.root.memory);assertEquals(commits,f.batch.root.commits);
            }
        }
    }

    @Test public void COORD_batchPreparationRetriesExactOriginalAcrossInstances()throws Exception {
        for(int mode=0;mode<4;mode++)try(var c=new CoordinationContext()){
            var f=c.f;fault(f.batch.root,mode);denied(c::prepare);
            int encrypts=f.batch.indexCipher.encrypts,ids=f.batch.ids;
            var candidate=new HashMap<>(f.batch.root.candidates.get(0));
            assertEquals(1,ids);clearFault(f.batch.root);f.batch.bind();var manifest=c.prepare();
            assertEquals(candidate,f.batch.root.durable);assertEquals(candidate,f.batch.root.candidates.get(1));
            assertEquals(encrypts,f.batch.indexCipher.encrypts);assertEquals(ids,f.batch.ids);
            assertEquals(f.original.generationId,manifest.generationId);assertEquals(f.batch.frozen,f.batch.old.workDisk.durable);
            assertEquals(0,f.batch.old.opened);c.preserved();
        }
    }
    @Test public void COORD_slotWriteRetriesExactOriginalAndRejectsForeignBinding()throws Exception {
        for(int mode=0;mode<4;mode++)try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();
            try(var original=c.original(manifest,1,9101,c.revision);var foreign=c.original(manifest,1,9101,c.revision+1)){
                fault(f.batch.root,mode);denied(()->f.batch.journal.writes(manifest,1).prepare(original));
                var candidate=new HashMap<>(f.batch.root.candidates.get(1));
                var cipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":write:1");int encrypts=cipher.encrypts,commits=f.batch.root.commits;
                denied(()->f.batch.journal.writes(manifest,1).prepare(foreign));
                assertEquals(commits,f.batch.root.commits);assertEquals(encrypts,cipher.encrypts);
                clearFault(f.batch.root);f.batch.bind();f.batch.journal.writes(manifest,1).prepare(original);
                assertEquals(candidate,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                assertEquals(NativeRetainedAttemptJournal.PREPARED,f.batch.journal.writes(manifest,1).observe().state);
                assertEquals(0,f.batch.old.opened);c.preserved();
            }
        }
    }
    @Test public void COORD_slotQueryAndAmbiguousFencePreserveOriginal()throws Exception {
        for(int mode=0;mode<4;mode++)try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();
            try(var target=c.original(manifest,1,9101,c.revision);
                var query=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now)){
                fault(f.batch.root,mode);denied(()->f.batch.journal.reads(manifest,1).prepare(query));
                var candidate=new HashMap<>(f.batch.root.candidates.get(1));
                var cipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":query:1");int encrypts=cipher.encrypts;
                clearFault(f.batch.root);f.batch.bind();f.batch.journal.reads(manifest,1).prepare(query);
                assertEquals(candidate,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                fault(f.batch.root,mode);denied(()->f.batch.journal.reads(manifest,1).fenceDispatch(query));
                var unknown=new HashMap<>(f.batch.root.candidates.get(3));encrypts=cipher.encrypts;
                clearFault(f.batch.root);f.batch.bind();denied(()->f.batch.journal.reads(manifest,1).fenceDispatch(query));
                assertEquals(unknown,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.batch.journal.reads(manifest,1).observe().state);
                assertEquals(0,f.batch.old.opened);c.preserved();
            }
        }
    }
    @Test public void COORD_coordinatorOrderAndChangedGenerationFailClosed()throws Exception {
        try(var c=new CoordinationContext()){
            var f=c.f;int[] marks={0};f.batch.root.beforeCommit=()->{
                assertTrue(Thread.holdsLock(c.generation.originalCommitCoordinator()));
                assertTrue(Thread.holdsLock(AndroidProtectedWorkPreferences.retainedCommitLock()));marks[0]++;
            };
            f.batch.root.fail=true;denied(c::prepare);assertEquals(1,marks[0]);
            var original=new HashMap<>(f.batch.root.memory);int commits=f.batch.root.commits,ids=f.batch.ids,encrypts=f.batch.indexCipher.encrypts;
            f.rotate();clearFault(f.batch.root);denied(c::prepare);
            assertEquals(original,f.batch.root.memory);assertEquals(commits,f.batch.root.commits);
            assertEquals(ids,f.batch.ids);assertEquals(encrypts,f.batch.indexCipher.encrypts);assertEquals(0,f.batch.old.opened);
        }
    }
    @Test public void COORD_zeroChunkUsesSameMonitorWhileWorkHeld()throws Exception {
        try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();int[] encrypts={0};
            f.batch.old.journalCipher.beforeEncrypt=()->{assertTrue(Thread.holdsLock(AndroidProviderCipher.STORE_LOCK));encrypts[0]++;};
            try(var original=c.original(manifest,0,9100,c.revision)){
                synchronized(AndroidProtectedWorkPreferences.retainedCommitLock()){
                    f.batch.journal.writes(manifest,0).prepare(original);
                }
            }
            assertTrue(encrypts[0]>0);assertEquals(f.batch.frozen,f.batch.old.workDisk.durable);
            assertEquals(0,f.batch.old.journalCipher.creates+f.batch.old.journalCipher.destroys);assertEquals(0,f.batch.old.opened);
        }
    }
    private static JSONObject unknownReply(NativeRetainedReadQuery query)throws Exception {
        return new JSONObject().put("ok",true).put("data",new JSONObject()
            .put("schema","custodial.original-native-evidence-readback-result.v1").put("operation_id",query.operationId)
            .put("query_native_request_id",query.requestId).put("native_request_id",query.targetRequestId)
            .put("request_body_sha256",query.targetBodySha256).put("query_completed",true)
            .put("status","OUTCOME_UNKNOWN").put("requested_attempt_retained",JSONObject.NULL)
            .put("request_readback_confirmed",false).put("record_values_retained",JSONObject.NULL)
            .put("write_performed",false).put("resend_allowed",false).put("absence_proves_no_late_commit",false)
            .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
            .put("inventory_acknowledged",false).put("automatic_acceptance",false).put("work_accepted",false)
            .put("new_work_allowed",false).put("phone_released",false).put("key_removal",false));
    }
    @Test public void COORD_observedQueryRecommitsExactEvidenceCandidate()throws Exception {
        for(int mode:new int[]{0,1,2,3})try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();
            try(var target=c.original(manifest,1,9101,c.revision);
                var query=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now)){
                var journal=f.batch.journal.reads(manifest,1);journal.prepare(query);
                var connection=new NativeRetainedOwnerTest.Connection(new java.net.URL(NativeRetainedHttp.ORIGIN+NativeRetainedAttempt.PATH));
                connection.response=unknownReply(query).toString().getBytes(StandardCharsets.UTF_8);
                var http=new NativeRetainedHttp(url->connection,()->f.batch.old.clock.now);
                NativeRetainedReadbackEvidence evidence;
                try(var dispatch=journal.fenceDispatch(query);
                    var exchange=http.query(dispatch,f.principal.json().getString("device_id"),c.credential,new NativeRetainedHttp.Attempt())){
                    evidence=NativeRetainedReadbackEvidence.verify(query,exchange);
                }
                fault(f.batch.root,mode);denied(()->journal.observeReadback(query,evidence));
                var candidate=new HashMap<>(f.batch.root.candidates.get(3));
                var cipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":query:1");int encrypts=cipher.encrypts;
                clearFault(f.batch.root);f.batch.bind();var again=f.batch.journal.reads(manifest,1);
                if(mode==1||mode==3){
                    var cached=again.recoverObserved(query);assertFalse(cached.currentServerReadback);assertFalse(cached.resendAllowed);
                    assertFalse(cached.workAccepted);assertFalse(cached.inventoryAcknowledged);assertFalse(cached.keyRemovalAllowed);
                }else again.observeReadback(query,evidence);
                assertEquals(candidate,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                assertEquals(NativeRetainedQueryJournal.OBSERVED,again.observe().state);assertEquals(0,f.batch.old.opened);
            }
        }
    }
    @Test public void COORD_cachedObservedRecoveryWhenMemoryUnchanged()throws Exception {
        for(int mode=0;mode<4;mode++)try(var c=new CoordinationContext()){
            var f=c.f;var manifest=c.prepare();
            try(var target=c.original(manifest,1,9101,c.revision);
                var query=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9201),f.batch.old.clock.now);
                var foreign=NativeRetainedReadQuery.prepare(target,f.principal,c.revision,c.credential,id(9202),f.batch.old.clock.now)){
                var journal=f.batch.journal.reads(manifest,1);journal.prepare(query);
                var connection=new NativeRetainedOwnerTest.Connection(new java.net.URL(NativeRetainedHttp.ORIGIN+NativeRetainedAttempt.PATH));
                connection.response=unknownReply(query).toString().getBytes(StandardCharsets.UTF_8);
                var http=new NativeRetainedHttp(url->connection,()->f.batch.old.clock.now);
                NativeRetainedReadbackEvidence evidence;
                try(var dispatch=journal.fenceDispatch(query);
                    var exchange=http.query(dispatch,f.principal.json().getString("device_id"),c.credential,new NativeRetainedHttp.Attempt())){
                    evidence=NativeRetainedReadbackEvidence.verify(query,exchange);
                }
                fault(f.batch.root,mode);denied(()->journal.observeReadback(query,evidence));
                var candidate=new HashMap<>(f.batch.root.candidates.get(3));
                var cipher=f.batch.domains.get(AndroidRetainedBatchStore.AAD+":query:1");int encrypts=cipher.encrypts,commits=f.batch.root.commits;
                clearFault(f.batch.root);f.batch.bind();var again=f.batch.journal.reads(manifest,1);
                denied(()->again.recoverObserved(foreign));assertEquals(commits,f.batch.root.commits);
                // No verified HTTP evidence is supplied to this cached-recovery
                // boundary, only the actual authenticated restored original query.
                try(var restored=NativeRetainedReadQuery.restore(query.record(),target,f.principal,c.revision,c.credential)){
                    var cached=again.recoverObserved(restored);assertEquals("OUTCOME_UNKNOWN",cached.status);
                    assertFalse(cached.currentServerReadback);assertFalse(cached.freshQueryPerformed);assertFalse(cached.resendAllowed);
                    assertFalse(cached.workAccepted);assertFalse(cached.inventoryAcknowledged);assertFalse(cached.keyRemovalAllowed);
                }
                assertEquals(candidate,f.batch.root.durable);assertEquals(encrypts,cipher.encrypts);
                assertEquals(NativeRetainedQueryJournal.OBSERVED,again.observe().state);assertEquals(0,f.batch.old.opened);
            }
        }
    }

    static void denied(NativeOriginalGenerationObservationTest.Action action) throws Exception { NativeOriginalGenerationObservationTest.denied(action); }
    static String id(int n) { return NativeSeparationContextTest.id(n); }
    static final class Fixture {
        final NativeRetainedBatchOwnerTest.Fixture batch;
        final ProviderRecordStoreTest.Fixture store=new ProviderRecordStoreTest.Fixture();
        final NativeProviderJournal provider=new NativeProviderJournal(store.store(),store.lock);
        final NativeProviderPrincipal principal;
        NativeProviderJournal.Prepared original;
        Fixture() throws Exception {this(new NativeRetainedBatchOwnerTest.Fixture());}
        Fixture(NativeRetainedBatchOwnerTest.Fixture initialBatch) throws Exception {
            batch=java.util.Objects.requireNonNull(initialBatch);
            principal=NativeProviderPrincipal.fromNativeJournal(batch.old.principal.readFor(batch.old.engine.getState()));
            provider.observeActivePrincipal(principal);provider.captureToken("synthetic-batch-token-one");
            original=provider.prepareRegistration(principal,NativeOriginalGenerationObservationTest.app());
            original=provider.confirmRegistration(principal,original,NativeProviderRegistrationReceipt.validateResponse(original,
                NativeOriginalGenerationObservationTest.response(NativeOriginalGenerationObservationTest.admission(original,null,NativeOriginalGenerationObservationTest.BEFORE))));
        }
        /** NEW Source/SQL owner join: the caller captured this typed native
         * principal while ordinary admission was still open. Never call the
         * ordinary getState reader after the real context freeze. The retained
         * Engine generation API still revalidates the actual frozen evidence,
         * current principal journal and this normal provider registration. */
        Fixture(NativeRetainedBatchOwnerTest.Fixture initialBatch,NativeProviderPrincipal beforeFreeze)throws Exception {
            batch=java.util.Objects.requireNonNull(initialBatch);
            principal=java.util.Objects.requireNonNull(beforeFreeze);
            provider.observeActivePrincipal(principal);provider.captureToken("synthetic-batch-token-one");
            original=provider.prepareRegistration(principal,NativeOriginalGenerationObservationTest.app());
            original=provider.confirmRegistration(principal,original,NativeProviderRegistrationReceipt.validateResponse(original,
                NativeOriginalGenerationObservationTest.response(NativeOriginalGenerationObservationTest.admission(original,null,NativeOriginalGenerationObservationTest.BEFORE))));
        }
        VaultEngine.NativeRetainedGenerationObservation generation() throws Exception { return generation(original.generationId); }
        VaultEngine.NativeRetainedGenerationObservation generation(String id) throws Exception {
            return batch.old.engine.observeOriginalNativeRetainedGeneration(batch.old.work,batch.old.principal,null,provider,id);
        }
        VaultEngine.NativeRetainedBatchOperation prepare(VaultEngine.NativeRetainedGenerationObservation g) throws Exception {
            return batch.old.engine.prepareNativeRetainedBatch(g,batch.journal,batch::nextId);
        }
        void rotate() throws Exception {
            String prior=original.generationId;provider.captureToken("synthetic-batch-token-two");
            var next=provider.prepareRegistration(principal,NativeOriginalGenerationObservationTest.app());
            original=provider.confirmRegistration(principal,next,NativeProviderRegistrationReceipt.validateResponse(next,
                NativeOriginalGenerationObservationTest.response(NativeOriginalGenerationObservationTest.admission(next,prior,"2026-09-26T08:00:00.123456Z"))));
        }
        void preserved() { batch.preserved();assertEquals(1,store.keys.creations); }
    }
    static final class Stable {
        final Fixture f;final Map<String,Object> root,zero,query,provider,work;final int ids,opened,commits,keys;
        Stable(Fixture f) {this.f=f;root=new HashMap<>(f.batch.root.memory);zero=new HashMap<>(f.batch.old.journalDisk.memory);
            query=new HashMap<>(f.batch.queryZeroDisk.memory);provider=new HashMap<>(f.store.memory.raw);work=new HashMap<>(f.batch.old.workDisk.memory);
            ids=f.batch.ids;opened=f.batch.old.opened;commits=f.store.memory.commits;keys=f.store.keys.creations;}
        void check() {assertEquals(root,f.batch.root.memory);assertEquals(zero,f.batch.old.journalDisk.memory);assertEquals(query,f.batch.queryZeroDisk.memory);
            assertEquals(provider,f.store.memory.raw);assertEquals(work,f.batch.old.workDisk.memory);assertEquals(ids,f.batch.ids);assertEquals(opened,f.batch.old.opened);
            assertEquals(commits,f.store.memory.commits);assertEquals(keys,f.store.keys.creations);}
    }
    @Test public void threeAffectedChunksUseAdmittedOriginalGenerationAndOnlyOneNewOperation() throws Exception {
        var f=new Fixture();Set<String> nonces=new HashSet<>();var provider=new HashMap<>(f.store.memory.raw);
        try(var generation=f.generation();var batch=f.prepare(generation)) {
            assertEquals(f.original.generationId,batch.generationId());assertEquals(1,f.batch.ids);assertEquals(3,batch.chunkCount());
            Map<String,Object> originalZero=null;
            for(int i=0;i<3;i++) {
                f.batch.sendWrite(batch,i);var write=f.batch.write(i).observe().record();
                assertEquals(f.original.generationId,write.get("generation_id"));assertEquals(batch.operationId(),write.get("operation_id"));assertTrue(nonces.add(write.getString("native_request_id")));
                f.batch.observe(batch,i,i==2?"RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION":"CHUNK_RETAINED_INCOMPLETE_VALUES");
                var query=f.batch.read(i).observe().record();assertEquals(f.original.generationId,NativeRetainedBatchOwnerTest.Fixture.body(query).get("generation_id"));assertTrue(nonces.add(query.getString("native_request_id")));
                if(i==0)originalZero=new HashMap<>(f.batch.old.journalDisk.durable);else assertEquals(originalZero,f.batch.old.journalDisk.durable);
            }
            assertEquals(7,f.batch.ids);assertEquals(6,nonces.size());assertEquals(6,f.batch.old.opened);
            var progress=f.batch.old.engine.inspectNativeRetainedBatch(batch);NativeRetainedBatchOwnerTest.diagnostic(progress);
            assertEquals("CACHED_ALL_CHUNKS_OBSERVED",progress.state);assertEquals(3,progress.observedPrefix);denied(()->f.batch.next(batch));
        }assertEquals(provider,f.store.memory.raw);f.preserved();
    }
    @Test public void obsoleteUnboundInterfaceRefusesBeforeIdsStorageOrFreeze() throws Exception {
        var f=new Fixture();var stable=new Stable(f);int workCommits=f.batch.old.workDisk.commits;
        try {f.batch.old.engine.prepareNativeRetainedBatch(f.batch.old.work,f.batch.old.principal,null,f.batch.journal,f.batch::nextId);fail("unbound generation must be refused");}
        catch(VaultFailure failure){assertEquals("custodial_native_original_generation_required",failure.code);}
        stable.check();assertEquals(workCommits,f.batch.old.workDisk.commits);f.preserved();
    }
    @Test public void missingClosedForeignAndStaleObservationCannotReserveBatch() throws Exception {
        var f=new Fixture();denied(()->f.prepare(null));var other=new Fixture();
        try(var foreign=other.generation()) {var stable=new Stable(f);denied(()->f.prepare(foreign));stable.check();}
        try(var closed=f.generation()) {closed.close();var stable=new Stable(f);denied(()->f.prepare(closed));stable.check();}
        try(var stale=f.generation()) {f.provider.captureToken("synthetic-revision-change");var stable=new Stable(f);denied(()->f.prepare(stale));stable.check();}
        assertTrue(f.batch.root.memory.isEmpty());f.preserved();other.preserved();
    }
    @Test public void closedOrRotatedWitnessDeniesExistingBatchWithoutRetargeting() throws Exception {
        for(boolean close:new boolean[]{true,false}) {
            var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation)) {
                if(close)generation.close();else f.rotate();var stable=new Stable(f);
                denied(()->f.batch.old.engine.inspectNativeRetainedBatch(batch));denied(()->f.batch.next(batch));stable.check();
            }f.preserved();
        }
    }
    @Test public void providerChangeDuringIndexCommitPreservesOriginalManifestForExactRebind() throws Exception {
        var f=new Fixture();var backing=new AndroidRetainedBatchStore(f.batch.root.preferences(),f.batch.indexCipher,(q,i)->new NativeRetainedBatchOwnerTest.DomainCipher("synthetic-unused"),f.batch.old.journal,f.batch.queryZero);
        f.batch.journal=new NativeRetainedBatchJournal(new NativeRetainedBatchJournal.Backend(){
            public Map<String,?> readAll()throws Exception{return backing.readAll();}
            public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next)throws Exception {
                boolean result=backing.compareAndCommit(expected,next);f.provider.captureToken("changed-during-index-commit");return result;
            }
        },f.batch.indexCipher,(q,i)->new NativeRetainedBatchOwnerTest.DomainCipher("synthetic-unused"),new Object(),f.batch.old.journal,f.batch.queryZero);
        try(var generation=f.generation()){denied(()->f.prepare(generation));}
        var exact=new HashMap<>(f.batch.root.durable);assertEquals(1,f.batch.ids);assertFalse(exact.isEmpty());assertEquals(f.original.generationId,f.batch.index().get("generation_id"));
        f.batch.bind();try(var fresh=f.generation();var batch=f.prepare(fresh)){assertEquals(exact,f.batch.root.durable);assertEquals(1,f.batch.ids);assertEquals(f.original.generationId,batch.generationId());}
        assertEquals(0,f.batch.old.opened);f.preserved();
    }
    @Test public void falseIndexCommitRecommitsExactCiphertextWithoutNewGenerationOrOperation() throws Exception {
        var f=new Fixture();f.batch.root.memoryOnly=true;try(var generation=f.generation()) {
            denied(()->f.prepare(generation));var volatileCipher=new HashMap<>(f.batch.root.memory);assertTrue(f.batch.root.durable.isEmpty());assertEquals(1,f.batch.ids);
            f.batch.root.memoryOnly=false;try(var batch=f.prepare(generation)){assertEquals(volatileCipher,f.batch.root.durable);assertEquals(1,f.batch.ids);assertEquals(f.original.generationId,batch.generationId());}
        }f.preserved();
    }
    @Test public void matchingOriginalZeroAndPreparedQueryAreAdoptedWithoutNonceRenewal() throws Exception {
        var f=new Fixture();int[] ids={0};String operation=id(900),nonce=id(901);String[] savedIds={operation,f.original.generationId,nonce};
        try(var write=f.batch.old.engine.prepareNativeRetainedChunk(f.batch.old.work,f.batch.old.principal,null,f.batch.old.journal,()->savedIds[ids[0]++],0);var response=f.batch.old.send(write)){}
        try(var query=f.batch.old.engine.prepareNativeRetainedQuery(f.batch.old.work,f.batch.old.principal,null,f.batch.old.journal,f.batch.queryZero,()->id(902))){}
        var zero=new HashMap<>(f.batch.old.journalDisk.durable);var query=new HashMap<>(f.batch.queryZeroDisk.durable);
        try(var generation=f.generation();var batch=f.prepare(generation)) {
            assertEquals(operation,batch.operationId());assertEquals(f.original.generationId,batch.generationId());assertEquals(0,f.batch.ids);
            assertEquals("PREPARED_QUERY_ONLY",f.batch.old.engine.inspectNativeRetainedBatch(batch).state);
        }assertEquals(zero,f.batch.old.journalDisk.durable);assertEquals(query,f.batch.queryZeroDisk.durable);f.preserved();
    }
    @Test public void mismatchedExistingZeroIsPreservedNotRewrittenToAdmittedGeneration() throws Exception {
        var f=new Fixture();try(var unrelated=f.batch.old.prepare()){}var stable=new Stable(f);
        try(var generation=f.generation()){denied(()->f.prepare(generation));}
        stable.check();assertTrue(f.batch.root.memory.isEmpty());assertNotEquals(f.original.generationId,f.batch.old.journal.observe().record().get("generation_id"));f.preserved();
    }
    @Test public void mismatchedSavedBatchCannotBeRecommittedOrSwitchedToCurrentGeneration() throws Exception {
        var f=new Fixture();try(var original=f.generation();var batch=f.prepare(original)){}
        JSONObject index=f.batch.index();index.put("generation_id",id(99));f.batch.replaceIndex(index);var stable=new Stable(f);
        try(var generation=f.generation()){denied(()->f.prepare(generation));}stable.check();f.preserved();
    }
    @Test public void restartedOwnerRestoresSavedOperationBodyAndGenerationWithoutIdsOrEncryption() throws Exception {
        var f=new Fixture();String op,body,nonce;try(var generation=f.generation();var batch=f.prepare(generation);var write=f.batch.next(batch)) {
            op=batch.operationId();nonce=write.requestId();body=write.bodySha256();
        }
        var root=new HashMap<>(f.batch.root.durable);var zero=new HashMap<>(f.batch.old.journalDisk.durable);int ids=f.batch.ids,encrypts=f.batch.indexCipher.encrypts;
        f.batch.restart();try(var generation=f.generation();var batch=f.prepare(generation);var write=f.batch.next(batch)) {
            assertEquals(op,batch.operationId());assertEquals(f.original.generationId,batch.generationId());assertEquals(nonce,write.requestId());assertEquals(body,write.bodySha256());
        }assertEquals(ids,f.batch.ids);assertEquals(encrypts,f.batch.indexCipher.encrypts);assertEquals(root,f.batch.root.durable);assertEquals(zero,f.batch.old.journalDisk.durable);assertEquals(0,f.batch.old.opened);f.preserved();
    }
    @Test public void providerChangeDuringNonceAllocationGrantsNoPreparedChunkOrTransport() throws Exception {
        var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation)) {
            var root=new HashMap<>(f.batch.root.durable);denied(()->f.batch.old.engine.prepareNextNativeRetainedBatchChunk(batch,()->{try{f.provider.captureToken("nonce-race");}catch(Exception e){throw new AssertionError(e);}return f.batch.nextId();}));
            assertEquals(root,f.batch.root.durable);assertTrue(f.batch.old.journalDisk.memory.isEmpty());assertEquals(0,f.batch.old.opened);
        }f.preserved();
    }
    @Test public void providerChangeAfterWriteDispatchPreservesUnknownNotAcceptanceOrResend() throws Exception {
        var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation);var write=f.batch.next(batch)) {
            String nonce=write.requestId();f.batch.old.onReply=()->f.provider.captureToken("after-already-dispatched");denied(()->f.batch.old.send(write));
            assertEquals(1,f.batch.old.opened);assertTrue(f.batch.old.connection.sent.size()>0);assertTrue(f.batch.old.connection.disconnects>0);
            assertEquals(NativeRetainedAttemptJournal.UNKNOWN,f.batch.write(0).observe().state);assertEquals(nonce,f.batch.write(0).observe().record().get("native_request_id"));
            var stable=new Stable(f);denied(()->f.batch.next(batch));stable.check();
        }f.preserved();
    }
    @Test public void lostOriginalReplyAndFreshWitnessNeverAuthorizeBlindWriteRetry() throws Exception {
        var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation);var write=f.batch.next(batch)) {
            f.batch.old.loseReply=true;denied(()->f.batch.old.send(write));f.batch.old.loseReply=false;
        }
        var stable=new Stable(f);try(var generation=f.generation();var batch=f.prepare(generation)) {
            assertEquals("WRITE_OUTCOME_REQUIRES_QUERY",f.batch.old.engine.inspectNativeRetainedBatch(batch).state);denied(()->f.batch.next(batch));
        }stable.check();f.preserved();
    }
    @Test public void providerChangeDuringQueryReplyRetainsOriginalUnknownQueryNotObservedResult() throws Exception {
        var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation)) {
            f.batch.sendWrite(batch,0);
            try(var query=f.batch.old.engine.prepareNativeRetainedBatchQuery(batch,0,f.batch::nextId)) {
                String nonce=query.requestId();f.batch.old.onReply=()->{f.batch.old.connection.response=f.batch.reply(0,nonce,"CHUNK_RETAINED_INCOMPLETE_VALUES").toString().getBytes(StandardCharsets.UTF_8);f.provider.captureToken("query-reply-race");};
                denied(()->f.batch.old.engine.readNativeRetainedQuery(query,f.batch.old.http(),new NativeRetainedHttp.Attempt()));
                assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.batch.read(0).observe().state);assertEquals(nonce,f.batch.read(0).observe().record().get("native_request_id"));
                assertEquals(2,f.batch.old.opened);assertTrue(f.batch.old.connection.disconnects>0);
            }
        }f.preserved();
    }
    @Test public void failedOriginalFreezeCreatesNoBatchIdsOrProviderWrites() throws Exception {
        var f=new Fixture();try(var generation=f.generation()) {f.batch.old.workDisk.fail=true;var stable=new Stable(f);denied(()->f.prepare(generation));stable.check();}
        assertTrue(f.batch.root.memory.isEmpty());assertEquals(0,f.batch.ids);f.preserved();
    }
    @Test public void laterChunkGenerationSubstitutionCannotAdvanceBoundOwner() throws Exception {
        var f=new Fixture();try(var generation=f.generation();var batch=f.prepare(generation)) {
            f.batch.completeZero(batch);f.batch.inject(1,batch.operationId(),id(99));var stable=new Stable(f);denied(()->f.batch.next(batch));stable.check();
        }f.preserved();
    }
}
