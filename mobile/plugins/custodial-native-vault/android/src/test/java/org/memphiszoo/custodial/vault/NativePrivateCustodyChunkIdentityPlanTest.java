package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Test;

/** NEW12 typed original chunk identity-plan cases only. Metadata/UUID/hash
 * planning is not an actual write/attempt/query witness, dispatch or ACK.
 * All owner/key/body sources are synthetic; owned host file effects only. */
public final class NativePrivateCustodyChunkIdentityPlanTest {
    /** Only the changed constructor-entry members; historical cases stay retained. */
    public static void main(String[] names)throws Exception {
        if(names.length!=1||!java.util.Set.of("PLAN_ENTRY_originalBindingsAndFilesRemainExact",
            "PLAN_ENTRY_nullForeignAndClosedOperationRefuse",
            "PLAN_ENTRY_sameBytesSuccessorOperationRefuses").contains(names[0]))
            throw new IllegalArgumentException("affected plan entry member required");
        NativePrivateCustodyExchangeTest.identityMemberResult(NativePrivateCustodyChunkIdentityPlanTest.class,names[0]);
    }
    @Test public void PLAN_ENTRY_originalBindingsAndFilesRemainExact()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var op=x.prepare()){
            var journal=NativePrivateCustodyOwnerTest.files(x.dir);var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);
            try {
                var original=op.projection();
                try(var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
                    var p=plan.projection();noAuthority(p);
                    for(String key:new String[]{"operation_id","frame_sha256","record_sha256","journal_record_sha256",
                        "original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256"})
                        assertEquals(key,original.get(key).toString(),p.get(key).toString());
                    assertEquals(original.getInt("frame_bytes"),p.getInt("frame_bytes"));
                    assertEquals(0,plan.chunkMetadata(0).getInt("chunk_index"));
                    assertTrue(p.getInt("chunk_count")>0);
                }
                NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);
                assertEquals(original.toString(),op.projection().toString());
            }finally{NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(journal);NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(capsule);}
        }
    }
    @Test public void PLAN_ENTRY_nullForeignAndClosedOperationRefuse()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var op=x.prepare()){
            var journal=NativePrivateCustodyOwnerTest.files(x.dir);
            try {
                denied(()->x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(null));
                try(var foreign=new NativePrivateCustodyOperationTest.Fixture(true)){
                    denied(()->foreign.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op));
                }
                op.close();denied(()->x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op));
                NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);
            }finally{NativePrivateCustodyExchangeTest.wipeIdentitySnapshot(journal);}
        }
    }
    @Test public void PLAN_ENTRY_sameBytesSuccessorOperationRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var op=x.prepare()){
            byte[] original=Files.readAllBytes(x.committed);var predecessor=x.f.root.resolve("plan-entry-original-predecessor.retained");
            var permissions=Files.getPosixFilePermissions(x.committed);var modified=Files.getLastModifiedTime(x.committed);
            try {
                Files.move(x.committed,predecessor);Files.write(x.committed,original,java.nio.file.StandardOpenOption.CREATE_NEW);
                Files.setPosixFilePermissions(x.committed,permissions);Files.setLastModifiedTime(x.committed,modified);
                assertFalse(Files.isSameFile(predecessor,x.committed));
                assertEquals(permissions,Files.getPosixFilePermissions(x.committed));assertEquals(modified,Files.getLastModifiedTime(x.committed));
                denied(()->x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op));
                assertArrayEquals(original,Files.readAllBytes(x.committed));assertArrayEquals(original,Files.readAllBytes(predecessor));
                assertFalse(Files.exists(x.pending));
            }finally{Arrays.fill(original,(byte)0);}
        }
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativePrivateCustodyOwnerTest.denied(a);}
    static void noAuthority(JSONObject p)throws Exception {
        assertTrue(p.getBoolean("fixed_per_chunk_identity_plan_bound"));assertTrue(p.getBoolean("IDs_derived_from_original_committed_operation_and_exact_frame"));
        for(String k:new String[]{"separate_durable_chunk_plan_record","original_operation_record_rewritten","actual_write_attempt_query_witnesses_bound","uuid_naming_hash_is_authentication",
            "frame_request_attestation_bound","network_dispatch_allowed","writer_authority","durable_retention","current_server_readback","complete_namespace_inventory",
            "all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified","inventory_acknowledged","work_accepted","new_work_allowed",
            "resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(k,p.getBoolean(k));
        for(String text:new String[]{"ciphertext","body_base64","installation_seal","SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER"})assertFalse(p.toString().contains(text));
    }
    @Test public void everyBoundedOriginalFrameSliceHasFixedDistinctPurposeIdsAndExactDigest()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var old=NativePrivateCustodyOwnerTest.files(x.f.dir);var journal=NativePrivateCustodyOwnerTest.files(x.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(x.f.x.f.x);
            var p=plan.projection();noAuthority(p);byte[] bytes=NativePrivateCustodyTransportFrameTest.ownedTestCopy(x.frame);
            try {assertTrue(p.getInt("chunk_count")>1);assertEquals(bytes.length,p.getInt("frame_bytes"));assertEquals(24576,p.getInt("chunk_bytes"));
                HashSet<String> distinct=new HashSet<>();distinct.add(p.getString("operation_id"));int offset=0;
                for(int i=0;i<p.getInt("chunk_count");i++){var row=plan.chunkMetadata(i);assertEquals(i,row.getInt("chunk_index"));assertEquals(offset,row.getInt("offset"));
                    int length=Math.min(24576,bytes.length-offset);assertEquals(length,row.getInt("chunk_bytes"));byte[] slice=Arrays.copyOfRange(bytes,offset,offset+length);
                    try{assertEquals(NativeRetainedAttempt.hash(slice),row.getString("chunk_sha256"));}finally{Arrays.fill(slice,(byte)0);}
                    for(String key:new String[]{"write_id","attempt_id","read_query_id"}){String id=row.getString(key);assertTrue(distinct.add(id));assertEquals(5,UUID.fromString(id).version());assertEquals(2,UUID.fromString(id).variant());}
                    offset+=length;
                }assertEquals(bytes.length,offset);assertEquals(1+3*p.getInt("chunk_count"),distinct.size());
            }finally{Arrays.fill(bytes,(byte)0);}NativePrivateCustodyOwnerTest.sameFiles(old,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);stable.check();
        }
    }
    @Test public void freshFrameAndRecoveredOriginalOperationReconstructExactlySamePlanAndJournal()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var first=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var journal=NativePrivateCustodyOwnerTest.files(x.dir);
            try(var frame=x.f.engine().prepareOriginalPrivateCustodyTransportFrame(x.owner);var recovered=x.f.engine().recoverOriginalPrivateCustodyOperation(frame,x.store);
                var again=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(recovered)){
                assertEquals(first.projection().toString(),again.projection().toString());for(int i=0;i<first.projection().getInt("chunk_count");i++)assertEquals(first.chunkMetadata(i).toString(),again.chunkMetadata(i).toString());
                NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);
            }
        }
    }
    @Test public void invalidIndicesNullAndForeignOperationCapabilitiesNeverYieldIds()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            denied(()->plan.chunkMetadata(-1));denied(()->plan.chunkMetadata(plan.projection().getInt("chunk_count")));denied(()->plan.chunkMetadata(Integer.MAX_VALUE));
            denied(()->x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(null));var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();
            denied(()->other.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op));other.f.x.f.preserved();noAuthority(plan.projection());
        }
    }
    @Test public void pendingOperationCannotYieldPlanUntilExplicitOriginalResume()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture()){
            try(var op=x.prepare()){op.projection();}byte[] original=Files.readAllBytes(x.committed);Files.move(x.committed,x.pending);
            try(var pending=x.recover()){denied(()->x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(pending));assertFalse(Files.exists(x.committed));assertArrayEquals(original,Files.readAllBytes(x.pending));
                try(var resumed=x.f.engine().resumeOriginalPrivateCustodyOperation(pending);var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(resumed)){noAuthority(plan.projection());assertArrayEquals(original,Files.readAllBytes(x.committed));}}
            Arrays.fill(original,(byte)0);
        }
    }
    @Test public void closeOnlyClearsOwnPlanWithoutClosingOriginalOperationFrameOrFiles()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare()){
            var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op);var field=plan.getClass().getDeclaredField("chunks");field.setAccessible(true);String[] owned=(String[])field.get(plan);
            var files=NativePrivateCustodyOwnerTest.files(x.dir);plan.close();assertNull(field.get(plan));for(String value:owned)assertNull(value);denied(plan::projection);denied(()->plan.chunkMetadata(0));
            op.projection();x.frame.metadata();x.owner.projection();NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
        }
    }
    @Test public void returnedMetadataIsAnUnbrandedCopyNotMutableAuthority()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            String original=plan.chunkMetadata(0).toString(),projection=plan.projection().toString();var row=plan.chunkMetadata(0);row.put("write_id",UUID.randomUUID().toString()).put("chunk_sha256","forged");
            var p=plan.projection();p.put("network_dispatch_allowed",true).put("operation_id",UUID.randomUUID().toString());assertEquals(original,plan.chunkMetadata(0).toString());assertEquals(projection,plan.projection().toString());
        }
    }
    @Test public void changedOwnedPlanMetadataRefusesInsteadOfInventingReplacementIds()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var files=NativePrivateCustodyOwnerTest.files(x.dir);var field=plan.getClass().getDeclaredField("chunks");field.setAccessible(true);String[] rows=(String[])field.get(plan);
            rows[0]=new JSONObject(rows[0]).put("attempt_id",UUID.randomUUID().toString()).toString();denied(plan::projection);denied(()->plan.chunkMetadata(0));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);op.projection();
        }
    }
    @Test public void changedOriginalJournalRefusesCachedPlanAndPreservesForeignBytes()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            byte[] bytes=Files.readAllBytes(x.committed);bytes[bytes.length-1]^=1;Files.write(x.committed,bytes);denied(plan::projection);denied(()->plan.chunkMetadata(0));assertArrayEquals(bytes,Files.readAllBytes(x.committed));Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void changedOriginalNamespaceInvalidatesPlanWithoutAnyJournalRepair()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var files=NativePrivateCustodyOwnerTest.files(x.dir);x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("chunk-plan-new-unknown","synthetic");denied(plan::projection);denied(()->plan.chunkMetadata(0));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
        }
    }
    @Test public void changedExistingOriginalKeyRefusesPlanAndPreservesJournalAndCapsule()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var journal=NativePrivateCustodyOwnerTest.files(x.dir);var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);
            NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);denied(plan::projection);denied(()->plan.chunkMetadata(0));NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);
        }
    }
    @Test public void changedOriginalSavedCiphertextInvalidatesPlanWithoutDiscard()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var journal=NativePrivateCustodyOwnerTest.files(x.dir);byte[] bytes=Files.readAllBytes(x.f.committed);bytes[bytes.length-1]^=1;Files.write(x.f.committed,bytes);
            denied(plan::projection);denied(()->plan.chunkMetadata(0));assertArrayEquals(bytes,Files.readAllBytes(x.f.committed));NativePrivateCustodyOwnerTest.sameFiles(journal,x.dir);Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void closedOriginalFrameOrOperationRevokesPlanObservationWithoutNewIds()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var files=NativePrivateCustodyOwnerTest.files(x.dir);op.close();denied(plan::projection);denied(()->plan.chunkMetadata(0));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
        }
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            var files=NativePrivateCustodyOwnerTest.files(x.dir);x.frame.close();denied(plan::projection);denied(()->plan.chunkMetadata(0));NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
        }
    }
}
