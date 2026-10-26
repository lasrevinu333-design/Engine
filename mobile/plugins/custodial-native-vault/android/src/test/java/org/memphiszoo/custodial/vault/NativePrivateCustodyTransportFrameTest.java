package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** NEW6 closed-frame source cases ONLY. Reflection is explicitly TEST-only
 * access to a synthetic owned frame for interoperability/wipe assertions;
 * it is not a product byte getter, network interface or runtime qualification. */
public final class NativePrivateCustodyTransportFrameTest {
    static byte[] ownedTestCopy(VaultEngine.NativePrivateCustodyTransportFrame frame)throws Exception {
        var field=frame.getClass().getDeclaredField("encoded");field.setAccessible(true);return ((byte[])field.get(frame)).clone();
    }
    @Test public void exactCurrentFrameContainsOnlyOriginalSavedRecordAndProofNoNewIdentities()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);var files=NativePrivateCustodyOwnerTest.files(f.dir);
            try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner);var again=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                byte[] bytes=ownedTestCopy(frame),repeated=ownedTestCopy(again);
                try {assertArrayEquals(bytes,repeated);assertEquals(frame.metadata().toString(),again.metadata().toString());
                    ByteBuffer b=ByteBuffer.wrap(bytes);assertEquals(0x4d5a5431,b.getInt());assertEquals(VaultEngine.NativePrivateCustodyTransportFrame.SCHEMA.length(),b.getInt());
                    for(char c:VaultEngine.NativePrivateCustodyTransportFrame.SCHEMA.toCharArray())assertEquals(c,b.getChar());
                    int proofLength=b.getInt();assertTrue(proofLength>0&&proofLength<=8192);byte[] proofBytes=new byte[proofLength];b.get(proofBytes);
                    try {var proof=new JSONObject(new String(proofBytes,java.nio.charset.StandardCharsets.UTF_8));assertEquals(20,proof.length());
                        int recordLength=b.getInt();byte[] record=new byte[recordLength];b.get(record);
                        try {assertArrayEquals(Files.readAllBytes(f.committed),record);assertEquals(proof.getString("record_sha256"),NativeRetainedAttempt.hash(record));}
                        finally{Arrays.fill(record,(byte)0);}
                        assertEquals(32,b.remaining());assertEquals(proof.getString("record_sha256"),frame.metadata().getString("record_sha256"));
                    }finally{Arrays.fill(proofBytes,(byte)0);}
                    assertEquals(NativeRetainedAttempt.hash(bytes),frame.metadata().getString("frame_sha256"));
                    for(String flag:new String[]{"durable_operation_id_bound","original_chunk_write_attempt_read_query_identities_bound","frame_request_attestation_bound","network_dispatch_allowed",
                        "writer_authority","durable_retention","inventory_acknowledged","resend_allowed","finalizer_allowed","key_removal"})assertFalse(frame.metadata().getBoolean(flag));
                    stable.check();NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
                }finally{Arrays.fill(bytes,(byte)0);Arrays.fill(repeated,(byte)0);}
            }
        }
    }
    @Test public void absentClosedNullAndForeignOwnerNeverPrepareFrame()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture();var absent=f.inspect()){
            NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyTransportFrame(null));
            NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyTransportFrame(absent));assertFalse(Files.exists(f.dir));
            absent.close();NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyTransportFrame(absent));
        }
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();try(var owner=f.inspect()){
            var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();NativePrivateCustodyOwnerTest.denied(()->other.f.engine().prepareOriginalPrivateCustodyTransportFrame(owner));other.f.x.f.preserved();
        }}
    }
    @Test public void closeWipesOwnEncodedFrameWithoutDeletingOrClosingOriginalOwner()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var owner=f.inspect()){
            var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner);var field=frame.getClass().getDeclaredField("encoded");field.setAccessible(true);
            byte[] retainedOwnedReference=(byte[])field.get(frame);frame.close();assertNull(field.get(frame));assertArrayEquals(new byte[retainedOwnedReference.length],retainedOwnedReference);
            NativePrivateCustodyOwnerTest.denied(frame::metadata);owner.projection();NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
            try(var fresh=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){fresh.metadata();}
        }}
    }
    @Test public void changedOriginalNamespaceInvalidatesPreparedFrameWithoutRepairOrResign()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);
            try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("new-frame-unknown-source","synthetic");
                NativePrivateCustodyOwnerTest.denied(frame::metadata);NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
            }
        }
    }
    @Test public void changedExistingOriginalKeyRefusesFrameAuthorityAndPreservesCiphertext()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);
            try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);NativePrivateCustodyOwnerTest.denied(frame::metadata);
                NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
            }
        }
    }
    @Test public void changedSavedCiphertextRefusesFrameAndNeverDiscardsForeignBytes()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
            byte[] bad=Files.readAllBytes(f.committed);bad[bad.length-1]^=1;Files.write(f.committed,bad);
            NativePrivateCustodyOwnerTest.denied(frame::metadata);assertArrayEquals(bad,Files.readAllBytes(f.committed));Arrays.fill(bad,(byte)0);
        }}
    }
}
