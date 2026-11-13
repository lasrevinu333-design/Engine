package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.lang.reflect.Modifier;
import java.security.MessageDigest;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** NEW closed saved-record/source recovery cases. Synthetic original values,
 * AES key and a volatile encrypted "disk" copy only; no actual file/storage,
 * Android effect, credential/key access, network or prior test method replay. */
public final class NativeRetainedNamespaceSavedLocalRecordTest {
    static byte[] bytes(NativeRetainedNamespacePrivateCapsule.SavedLocalRecord r)throws Exception {
        return (byte[])NativeRetainedNamespacePrivateCapsuleTest.field(r,"encoded");
    }
    static NativeRetainedNamespacePrivateCapsule restore(NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record,
        VaultEngine.NativeRetainedNamespaceValueObservation v,VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l,int key)throws Exception {
        return NativeRetainedNamespacePrivateCapsule.restoreSavedLocalRecord(NativeRetainedNamespaceCustodyLayoutTest.values(v),
            NativeRetainedNamespaceCustodyLayoutTest.bytes(v),NativeRetainedNamespacePrivateCapsuleTest.layout(l),record,NativeRetainedNamespacePrivateCapsuleTest.key(key));
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception{NativeRetainedNamespacePrivateCapsuleTest.denied(action);}
    static byte[] checksum(byte[] encrypted)throws Exception {
        byte[] payload=Arrays.copyOf(encrypted,encrypted.length-32),sha=MessageDigest.getInstance("SHA-256").digest(payload);
        try{System.arraycopy(sha,0,encrypted,encrypted.length-32,32);return encrypted;}finally{Arrays.fill(payload,(byte)0);Arrays.fill(sha,(byte)0);}
    }
    static int[] fields(byte[] encrypted)throws Exception {
        DataInputStream in=new DataInputStream(new ByteArrayInputStream(encrypted));in.readInt();
        for(int i=0;i<2;i++){int n=in.readInt();in.skipBytes(n*2);}int bindLengthOffset=encrypted.length-in.available(),n=in.readInt(),bindingOffset=encrypted.length-in.available();
        in.skipBytes(n);n=in.readInt();in.skipBytes(n*2);int countOffset=encrypted.length-in.available();in.readInt();
        int indexOffset=encrypted.length-in.available();in.readInt();in.readInt();in.readInt();n=in.readInt();in.skipBytes(n*2);
        n=in.readInt();int ivOffset=encrypted.length-in.available();in.skipBytes(n);in.readInt();int ciphertextOffset=encrypted.length-in.available();
        return new int[]{bindLengthOffset,bindingOffset,countOffset,indexOffset,ivOffset,ciphertextOffset};
    }
    static void int32(byte[] b,int offset,int value){for(int shift=24;shift>=0;shift-=8)b[offset++]=(byte)(value>>>shift);}
    @Test public void savedCiphertextRestoresExactOriginalCapsuleAndReencodesIdenticallyAfterProducerClose()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
            var capsule=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));
            String identity=capsule.metadata().getString("capsule_sha256");byte[] saved;
            try(var record=capsule.savedLocalRecord()){saved=bytes(record).clone();}capsule.close();
            try(var record=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(saved);var recovered=restore(record,v,l,1);var again=recovered.savedLocalRecord()){
                assertEquals(identity,recovered.metadata().get("capsule_sha256"));assertArrayEquals(saved,bytes(again));NativeRetainedNamespacePrivateCapsuleTest.noAuthority(recovered.metadata());
                assertFalse(record.metadata().getBoolean("durably_stored"));stable.check();
            }finally{Arrays.fill(saved,(byte)0);}
        }f.x.f.preserved();
    }
    @Test public void framingContainsNoOriginalPrivateCleartextAndExposesNoByteGetterOrStreamCallback()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] encrypted=bytes(r);String raw=new String(encrypted,java.nio.charset.StandardCharsets.ISO_8859_1);
            for(String secret:new String[]{"synthetic-batch-token-one","opaque original","installation_seal"})assertFalse(raw.contains(secret));
            byte[] privateBytes=NativeRetainedNamespaceCustodyLayoutTest.bytes(v);assertFalse(Arrays.equals(privateBytes,encrypted));
            for(var method:NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.class.getDeclaredMethods())if(!Modifier.isPrivate(method.getModifiers())){
                assertNotEquals(byte[].class,method.getReturnType());for(Class<?> type:method.getParameterTypes())assertFalse(java.io.OutputStream.class.isAssignableFrom(type));
            }
        }f.x.f.preserved();
    }
    @Test public void nullEmptyOversizedTruncatedAndChecksumDamagedRecordsCannotBeRestoredOrPromoted()throws Exception {
        denied(()->NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(null));
        denied(()->NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(new byte[0]));
        denied(()->NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(new byte[NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES+1]));
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] original=bytes(r).clone();for(int length:new int[]{1,64,original.length/2,original.length-1}){
                byte[] partial=Arrays.copyOf(original,length);denied(()->NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(partial));
            }
            byte[] bad=original.clone();bad[bad.length-1]^=1;denied(()->NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(bad));assertArrayEquals(original,bytes(r));
        }f.x.f.preserved();
    }
    @Test public void validChecksumDoesNotAuthorizeUnknownHeaderLengthCountGeometryOrTrailingBytes()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] original=bytes(r).clone();int[] positions=fields(original);
            for(int offset:new int[]{0,4,positions[0],positions[2],positions[3]}){
                byte[] bad=original.clone();int32(bad,offset,Integer.MAX_VALUE);checksum(bad);
                try(var captured=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(bad)){
                    denied(()->restore(captured,v,l,1));assertArrayEquals(bad,bytes(captured));
                }assertArrayEquals(original,bytes(r));
            }
            byte[] tail=new byte[original.length+1];System.arraycopy(original,0,tail,0,original.length-32);tail[original.length-32]=17;checksum(tail);
            try(var captured=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(tail)){denied(()->restore(captured,v,l,1));}
        }f.x.f.preserved();
    }
    @Test public void savedBindingIvAndCiphertextTamperingFailEvenWithRecomputedContainerChecksum()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] original=bytes(r).clone();int[] positions=fields(original);
            for(int offset:new int[]{positions[1],positions[4],positions[5]}){
                byte[] bad=original.clone();bad[offset]^=1;checksum(bad);
                try(var captured=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(bad)){
                    var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->restore(captured,v,l,1));assertArrayEquals(bad,bytes(captured));stable.check();
                }
            }assertArrayEquals(original,bytes(r));
        }f.x.f.preserved();
    }
    @Test public void missingMiddleOrTruncatedCompletePrefixNeverBecomesSuccessfulCapsuleRecovery()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] original=bytes(r).clone();assertTrue(c.metadata().getInt("chunk_count")>1);
            int[] positions=fields(original);byte[] prefix=original.clone();int32(prefix,positions[2],c.metadata().getInt("chunk_count")-1);checksum(prefix);
            try(var captured=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(prefix)){denied(()->restore(captured,v,l,1));}
            byte[] partial=Arrays.copyOf(original,original.length/2);checksum(partial);
            try(var captured=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(partial)){denied(()->restore(captured,v,l,1));}
            assertArrayEquals(original,bytes(r));
        }f.x.f.preserved();
    }
    @Test public void replacementKeyOrDifferentOriginalActorCannotRecoverSavedRecordByRetargeting()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var of=other.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord();
            var og=of.x.f.generation();var on=of.x.observe();var ov=of.values(og,on);var os=of.join(ov);var ol=other.layout(os)){
            byte[] original=bytes(r).clone();denied(()->restore(r,v,l,2));denied(()->restore(r,ov,ol,1));assertArrayEquals(original,bytes(r));
            try(var recovered=restore(r,v,l,1)){NativeRetainedNamespacePrivateCapsuleTest.noAuthority(recovered.metadata());}
        }f.x.f.preserved();of.x.f.preserved();
    }
    @Test public void closedRecordOrCaptureCannotRecoverAndClosingCopyPreservesSimulatedSavedData()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            byte[] saved=bytes(r).clone(),snapshot=saved.clone();var copy=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(saved);byte[] owned=bytes(copy);
            copy.close();copy.close();assertArrayEquals(new byte[owned.length],owned);assertArrayEquals(snapshot,saved);denied(()->restore(copy,v,l,1));assertNotNull(l.projection());
            v.close();denied(()->restore(r,v,l,1));assertArrayEquals(snapshot,saved);Arrays.fill(saved,(byte)0);Arrays.fill(snapshot,(byte)0);
        }f.x.f.preserved();
    }
    @Test public void metadataMutationAndStoredInputMutationCannotAlterPrivateRecordOrInventDurability()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var r=c.savedLocalRecord()){
            JSONObject p=r.metadata();String sha=p.getString("record_sha256");p.put("durably_stored",true);assertFalse(r.metadata().getBoolean("durably_stored"));
            byte[] saved=bytes(r).clone();try(var copy=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(saved)){
                saved[0]^=1;assertEquals(sha,copy.metadata().get("record_sha256"));try(var recovered=restore(copy,v,l,1)){assertEquals(c.metadata().get("capsule_sha256"),recovered.metadata().get("capsule_sha256"));}
            }assertEquals(sha,r.metadata().get("record_sha256"));Arrays.fill(saved,(byte)0);
        }f.x.f.preserved();
    }
}
