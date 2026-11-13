package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.nio.channels.FileChannel;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** NEW pending/alias provenance only, never automatic commit or query. Own
 * synthetic JCE/actor/prefs and host temp files are not Android lifecycle,
 * authenticated manager, actual SQL or physical/install evidence. */
public final class NativePrivateCustodyPendingOwnerTest {
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {NativePrivateCustodyOwnerTest.denied(action);}
    static JSONObject read(NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        var source=NativePrivateCustodySavedOwnerRecoveryTest.census(x);var old=source.f.batch.old;
        var provider=new NativeProviderJournal(source.f.store.store(),source.f.store.lock);
        return x.f.engine().inspectPendingOriginalPrivateCustodyOwner(old.work,old.principal,null,provider,source.f.batch.journal,
            NativePrivateCustodySavedOwnerRecoveryTest.readers(source),x.f.store,x.store);
    }
    static void safe(JSONObject value,String phase)throws Exception {
        NativePrivateCustodyOperationTest.noAuthority(value);
        assertEquals("custodial.native-pending-original-private-custody-owner-observation.v1",value.get("schema"));
        assertEquals("ORIGINAL_PENDING_OPERATION_PROVENANCE_BOUND_NO_PROMOTION_OR_QUERY_AUTHORITY",value.get("state"));
        assertEquals(phase,value.get("pending_original_phase"));assertFalse(value.getBoolean("local_operation_committed_observed"));
        for(String field:new String[]{"original_generation_from_pending_saved_record_not_caller_or_latest","pending_original_matches_full_WORK_provider_all8_capsule_frame_bindings","original_pending_bytes_preserved_unmodified"})assertTrue(field,value.getBoolean(field));
        for(String field:new String[]{"chunk_plan_query_or_transport_attempt_minted_from_pending_operation","pending_original_promoted_or_repaired","missing_original_owner_created",
            "protected_manager_trigger_or_promotion_authority_established","actual_Android_process_restart_or_power_loss_qualified"})assertFalse(field,value.getBoolean(field));
    }
    @Test public void pendingOriginalReconstructsFullSourceProvenanceWithoutPromotionPlanQueryOrStoreChange()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            String generation,operation;try(var original=x.prepare()){var value=original.projection();generation=value.getString("original_generation_id");operation=value.getString("operation_id");}
            Files.move(x.committed,x.pending);var files=NativePrivateCustodyOwnerTest.files(x.dir);var capsules=NativePrivateCustodyOwnerTest.files(x.f.dir);
            var source=NativePrivateCustodySavedOwnerRecoveryTest.census(x);var stable=new NativeRetainedNamespaceCensusTest.Stable(source);
            var value=read(x);safe(value,"PENDING");assertEquals(generation,value.get("original_generation_id"));assertEquals(operation,value.get("operation_id"));
            stable.check();NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsules,x.f.dir);
            assertFalse(Files.exists(x.committed));assertFalse(Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            denied(x.store::inspectSavedIdentityHint);
        }
    }
    @Test public void sameInodeAliasIsReadableOriginalProvenanceButNotCommittedOrQueryAuthority()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            Files.createLink(x.pending,x.committed);var files=NativePrivateCustodyOwnerTest.files(x.dir);
            var value=read(x);safe(value,"COMMITTED_PENDING_ALIAS");assertTrue(Files.isSameFile(x.pending,x.committed));
            NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);denied(x.store::inspectSavedIdentityHint);
            assertFalse(Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
        }
    }
    @Test public void absentAndCommittedOnlyStatesDoNotBecomePendingOrFallbackOwner()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            denied(x.store::inspectPendingIdentityHint);denied(()->read(x));assertFalse(Files.exists(x.dir));
            try(var original=x.prepare();var strict=x.store.inspectSavedIdentityHint();var observed=x.store.inspectOriginal(x.frame)){
                assertEquals("COMMITTED",strict.phaseForOwningEngine());assertTrue(strict.matchesFullyVerifiedOperation(observed));x.store.requireSavedIdentityHintCurrent(strict);
                var files=NativePrivateCustodyOwnerTest.files(x.dir);denied(x.store::inspectPendingIdentityHint);denied(()->read(x));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
            }
        }
    }
    @Test public void differentInodeAliasSymlinkAndTruncatedPendingStayAmbiguousAndPreserved()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            byte[] bytes=Files.readAllBytes(x.committed);
            try{Files.copy(x.committed,x.pending,java.nio.file.StandardCopyOption.COPY_ATTRIBUTES);assertFalse(Files.isSameFile(x.committed,x.pending));
                var files=NativePrivateCustodyOwnerTest.files(x.dir);denied(x.store::inspectPendingIdentityHint);NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
                // Own fault-fixture transitions only; the product reader never removes any file.
                Files.delete(x.pending);Files.createSymbolicLink(x.pending,x.committed);denied(x.store::inspectPendingIdentityHint);assertTrue(Files.isSymbolicLink(x.pending));
                Files.delete(x.pending);Files.move(x.committed,x.pending);Files.write(x.pending,new byte[]{1,2,3});var truncated=NativePrivateCustodyOwnerTest.files(x.dir);
                denied(x.store::inspectPendingIdentityHint);NativePrivateCustodyOwnerTest.sameFiles(truncated,x.dir);
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void structurallyValidPendingHintStillRequiresExactOriginalFrameAndOwnerBinding()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var changed=NativePrivateCustodySavedOwnerRecoveryTest.body(x).put("owner_binding_sha256","a".repeat(64));byte[] encoded=NativePrivateCustodySavedOwnerRecoveryTest.repack(changed);
            try{Files.write(x.committed,encoded);Files.move(x.committed,x.pending);var files=NativePrivateCustodyOwnerTest.files(x.dir);
                try(var hint=x.store.inspectPendingIdentityHint()){assertEquals("PENDING",hint.phaseForOwningEngine());}
                denied(()->read(x));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);assertFalse(Files.exists(x.committed));
            }finally{Arrays.fill(encoded,(byte)0);}
        }
    }
    @Test public void closedChangedAndBusyPendingHintsDoNotPromoteOrRefreshTheOriginal()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var original=x.prepare()){
            var body=NativePrivateCustodySavedOwnerRecoveryTest.body(x);Files.move(x.committed,x.pending);var files=NativePrivateCustodyOwnerTest.files(x.dir);
            try(var lock=FileChannel.open(x.dir.resolve(NativePrivateCustodyOperationStore.LOCK),StandardOpenOption.WRITE);var held=lock.lock()){
                denied(x.store::inspectPendingIdentityHint);NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
            }
            try(var hint=x.store.inspectPendingIdentityHint()){
                x.store.requirePendingIdentityHintCurrent(hint);var changed=body.put("proof_wire_sha256","b".repeat(64));byte[] encoded=NativePrivateCustodySavedOwnerRecoveryTest.repack(changed);
                try{Files.write(x.pending,encoded);var retained=NativePrivateCustodyOwnerTest.files(x.dir);denied(()->x.store.requirePendingIdentityHintCurrent(hint));NativePrivateCustodyOwnerTest.sameFiles(retained,x.dir);}finally{Arrays.fill(encoded,(byte)0);}
            }
            var closed=x.store.inspectPendingIdentityHint();closed.close();denied(closed::phaseForOwningEngine);denied(()->x.store.requirePendingIdentityHintCurrent(closed));assertFalse(Files.exists(x.committed));
        }
    }
}
