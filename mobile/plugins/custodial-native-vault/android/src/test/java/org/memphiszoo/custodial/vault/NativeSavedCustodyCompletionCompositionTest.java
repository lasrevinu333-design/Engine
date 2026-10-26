package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Arrays;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW saved-operation/application-decoder composition, not replay of the old
 * decoder or saved-owner suites. Actual host files, synthetic preferences,
 * enrollment, original generation and JCE key. No Android/runtime/SQL proof. */
public final class NativeSavedCustodyCompletionCompositionTest {
    static final class Fixture implements AutoCloseable {
        final NativeRetainedNamespaceCompletionJoinTest.Fixture source;
        final Path root,capsuleDir,operationDir,committed,pending;
        final NativePrivateCapsuleFileStore capsules;final NativePrivateCustodyOperationStore operations;
        final JSONObject original;
        Fixture(int mode)throws Exception {
            source=new NativeRetainedNamespaceCompletionJoinTest.Fixture(mode);
            String base=System.getProperty("custodial.custody.fixture.root");if(base==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(base),"saved-completion-case-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            capsuleDir=root.resolve(NativePrivateCapsuleFileStore.DIRECTORY);operationDir=root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);
            committed=operationDir.resolve(NativePrivateCustodyOperationStore.COMMITTED);pending=operationDir.resolve(NativePrivateCustodyOperationStore.PENDING);
            capsules=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root.toFile());operations=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(root.toFile());
            var owner=source.completion.owner;char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
            try{NativePrivateCustodyOwnerTest.testKey("installSynthetic",new Class<?>[]{EncryptedSecret.class,char[].class},owner.persistence.current().secret,credential);}
            finally{VaultValidation.wipe(credential);}
            try(var generation=source.generation();var namespaces=source.namespaces();
                var values=source.engine.observeOriginalRetainedNamespaceValues(generation,namespaces);
                var semantic=source.engine.inspectOriginalRetainedNamespaceSemantics(values,source.batch);
                var layout=source.engine.inspectOriginalRetainedNamespaceCustodyLayout(semantic);
                var prepared=source.engine.prepareOriginalRetainedNamespacePrivateCapsule(layout);
                var retained=source.engine.retainOriginalPrivateCustody(prepared,capsules);
                var frame=source.engine.prepareOriginalPrivateCustodyTransportFrame(retained);
                var operation=source.engine.prepareOriginalPrivateCustodyOperation(frame,operations)){
                original=operation.projection();NativePrivateCustodyOperationTest.noAuthority(original);
            }
        }
        Map<String,NativeProtectedNamespaceObservation.Store> readers(){
            var readers=new TreeMap<String,NativeProtectedNamespaceObservation.Store>();source.raw.forEach((name,rows)->readers.put(name,()->rows));return readers;
        }
        JSONObject read(NativeSeparationFreeze.Store work)throws Exception {
            return source.engine.inspectSavedOriginalPrivateCustodyCompletionSemantics(work,source.completion.owner.principal,null,
                source.provider,source.batch,readers(),capsules,operations);
        }
        JSONObject read()throws Exception{return read(source.work);}
        JSONObject body()throws Exception {
            var method=operations.getClass().getDeclaredMethod("readSavedIdentityFile");method.setAccessible(true);
            try(var saved=(AutoCloseable)method.invoke(operations)){return new JSONObject((String)NativePrivateCustodyExchangeTest.field(saved,"body"));}
        }
        @Override public void close(){try{NativePrivateCustodyOwnerTest.testKey("clearSynthetic",new Class<?>[]{});}catch(Exception error){throw new AssertionError(error);}}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception{NativePrivateCustodyOwnerTest.denied(action);}
    static Map<String,byte[]> files(Path root)throws Exception {
        var values=new TreeMap<String,byte[]>();try(var paths=Files.walk(root)){
            for(Path entry:paths.toList()){if(entry.equals(root))continue;assertFalse(Files.isSymbolicLink(entry));
                boolean directory=Files.isDirectory(entry);values.put((directory?"D:":"F:")+root.relativize(entry),directory?new byte[0]:Files.readAllBytes(entry));}
        }return values;
    }
    static void sameFiles(Map<String,byte[]> expected,Path root)throws Exception {
        var actual=files(root);assertEquals(expected.keySet(),actual.keySet());for(String name:expected.keySet())assertArrayEquals(name,expected.get(name),actual.get(name));
    }
    static JSONObject safe(Fixture f,JSONObject value)throws Exception {
        NativePrivateCustodyOperationTest.noAuthority(value);
        assertEquals("custodial.native-saved-original-private-custody-completion-semantics.v1",value.get("schema"));
        assertEquals("SAVED_ORIGINAL_OPERATION_WITH_LOCAL_COMPLETION_VALUES_NOT_SERVER_OR_INVENTORY_ACK",value.get("state"));
        for(String field:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","journal_record_sha256"})assertEquals(field,f.original.get(field),value.get(field));
        assertTrue(value.getBoolean("saved_original_operation_and_full_frame_verified_before_completion_decode"));
        assertTrue(value.getBoolean("completion_rows_bound_to_same_original_all8_values_and_source_join"));
        for(String field:new String[]{"original_layout_capsule_frame_operation_and_raw_rows_rewritten","browser_candidates_or_latest_generation_substituted","chunk_plan_query_or_transport_attempt_created",
            "historical_completion_values_are_current_SQL_acceptance","protected_manager_trigger_or_promotion_authority_established","actual_Android_process_restart_or_power_loss_qualified"})assertFalse(field,value.getBoolean(field));
        var joined=value.getJSONObject("original_all8_completion_semantics");NativeRetainedNamespaceCompletionJoinTest.noAuthority(joined);
        assertEquals(value.get("original_generation_id"),joined.get("original_generation_id"));assertEquals(value.get("principal_digest"),joined.get("principal_digest"));
        assertEquals(value.getLong("engine_revision"),joined.getLong("engine_revision"));return joined;
    }
    @Test public void committedOriginalFrameRecoversCompletionValuesThroughFixedSavedOwnerWithoutAnyWrites()throws Exception {
        try(var f=new Fixture(0)){
            var files=files(f.root);var raw=new TreeMap<String,Map<String,?>>();f.source.raw.forEach((n,r)->raw.put(n,new java.util.HashMap<>(r)));
            int encrypts=f.source.completion.owner.workCipher.delegate.existingKeyEncryptCalls,commits=f.source.completion.owner.workDisk.commits;
            var joined=safe(f,f.read());assertEquals(1,joined.getInt("matched_completion_count"));assertEquals(3,joined.getInt("completion_semantic_joined_record_count"));
            assertEquals(8,joined.getJSONArray("namespaces").length());assertTrue(joined.getInt("application_unresolved_record_count")>0);
            assertEquals(raw,f.source.raw);assertEquals(encrypts,f.source.completion.owner.workCipher.delegate.existingKeyEncryptCalls);assertEquals(commits,f.source.completion.owner.workDisk.commits);
            sameFiles(files,f.root);assertFalse(Files.exists(f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            assertEquals(0,f.source.completion.owner.opened);assertEquals(0,f.source.completion.owner.ids);f.source.completion.owner.wiped();
        }
    }
    @Test public void pendingAliasAndAbsentOriginalCannotBecomeCompletionAdmissionOrReplacement()throws Exception {
        try(var f=new Fixture(0)){
            Files.move(f.committed,f.pending);var files=files(f.root);denied(f::read);sameFiles(files,f.root);
            Files.move(f.pending,f.committed);Files.createLink(f.pending,f.committed);files=files(f.root);denied(f::read);sameFiles(files,f.root);
            // Own fault-fixture transition only; product does not delete.
            Files.delete(f.pending);Files.delete(f.committed);files=files(f.root);denied(f::read);sameFiles(files,f.root);
        }
    }
    @Test public void originalNamespaceChangeCannotBeReboundToOldCompletionOrSavedFrame()throws Exception {
        try(var f=new Fixture(0)){
            ((Map<String,Object>)f.source.raw.get("MemphisZooCustodialNativeVaultV1")).put("same-owner-late-row","must remain retained");
            var files=files(f.root);denied(f::read);sameFiles(files,f.root);
            assertEquals("must remain retained",f.source.raw.get("MemphisZooCustodialNativeVaultV1").get("same-owner-late-row"));
        }
    }
    @Test public void structurallyValidDifferentSavedOwnerCannotSelectOtherwiseValidCompletionRows()throws Exception {
        try(var f=new Fixture(0)){
            byte[] encoded=NativePrivateCustodySavedOwnerRecoveryTest.repack(f.body().put("owner_binding_sha256","c".repeat(64)));
            try{Files.write(f.committed,encoded);var files=files(f.root);
                try(var hint=f.operations.inspectSavedIdentityHint()){assertNotNull(hint.generationForOwningEngine());}
                denied(f::read);sameFiles(files,f.root);
            }finally{Arrays.fill(encoded,(byte)0);}
        }
    }
    @Test public void missingOwningDecoderCannotReturnEmptySemanticsOrAReadyInventory()throws Exception {
        try(var f=new Fixture(0)){
            var original=f.source.work;var readonly=new NativeSeparationFreeze.Store(){
                public Map<String,?> separationRawSnapshot()throws VaultFailure{return original.separationRawSnapshot();}
                public JSONObject readSeparationSnapshotEvidence(Map<String,?> raw)throws VaultFailure{return original.readSeparationSnapshotEvidence(raw);}
                public void prepareSeparationProbe(Map<String,?> raw){throw new AssertionError("no probe");}
                public void freezeSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence p){throw new AssertionError("no freeze");}
            };
            var files=files(f.root);denied(()->f.read(readonly));sameFiles(files,f.root);
            safe(f,f.read());
        }
    }
    @Test public void legacyOrOrphanCompletionAndMutableMetadataNeverAcquireAcceptanceAuthority()throws Exception {
        for(int mode:new int[]{1,2})try(var f=new Fixture(mode)){
            var files=files(f.root);var value=f.read();var joined=safe(f,value);
            assertEquals(0,joined.getInt("matched_completion_count"));assertEquals(0,joined.getInt("completion_semantic_joined_record_count"));
            String digest=joined.getString("completion_reconciliation_sha256");value.put("inventory_acknowledged",true);joined.put("current_server_readback",true);joined.getJSONArray("records").remove(0);
            var actual=safe(f,f.read());assertEquals(digest,actual.get("completion_reconciliation_sha256"));sameFiles(files,f.root);
        }
    }
}
