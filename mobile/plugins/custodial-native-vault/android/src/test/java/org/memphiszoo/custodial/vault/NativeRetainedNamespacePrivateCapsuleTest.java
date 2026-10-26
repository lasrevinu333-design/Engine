package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;

/** NEW pure-JCE synthetic-key cases. Original factories compiled but their
 * tests NOT executed. Reflection sees only synthetic private buffers/chunks.
 * No actual Android key/preference/disk, backend, network, credential or phone.
 */
public final class NativeRetainedNamespacePrivateCapsuleTest {
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--private-values-duplicate-hash-only".equals(args[0])
            ||!java.util.Set.of("HASH_sameOwnedAndDetachedOriginalsPreserveCapsuleBinding",
                "HASH_detachedNullLengthAndChangedBytesRefuseWithoutEffects",
                "HASH_changedOwnedBufferCannotUseAliasFastPath",
                "HASH_closedValuesAndForeignLayoutRefuse").contains(args[1]))
            throw new IllegalArgumentException("new duplicate-hash member required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
            NativeRetainedNamespacePrivateCapsuleTest.class,args[1]));
        System.out.println("PRIVATE_VALUES_HASH_CASE "+args[1]+" tests="+result.getRunCount()+" failures="+result.getFailureCount());
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures())System.err.println(failure.getTrace());
            throw new AssertionError("new duplicate-hash member failed");
        }
    }

    static SecretKey key(int variant){byte[] bytes=new byte[32];Arrays.fill(bytes,(byte)variant);return new SecretKeySpec(bytes,"AES");}
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativeOriginalGenerationObservationTest.denied(a);}
    static Object field(Object owner,String name)throws Exception{return NativeRetainedNamespaceCustodyLayoutTest.privateField(owner,name);}
    static NativeRetainedNamespaceCustodyLayout.Observation layout(VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l)throws Exception {
        return (NativeRetainedNamespaceCustodyLayout.Observation)field(l,"layout");
    }
    static NativeRetainedNamespacePrivateCapsule capsule(VaultEngine.NativeRetainedNamespaceValueObservation v,
        VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l,SecretKey key)throws Exception {
        return NativeRetainedNamespacePrivateCapsule.prepare(NativeRetainedNamespaceCustodyLayoutTest.values(v),NativeRetainedNamespaceCustodyLayoutTest.bytes(v),layout(l),key);
    }
    static void verify(NativeRetainedNamespacePrivateCapsule c,VaultEngine.NativeRetainedNamespaceValueObservation v,
        VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l,SecretKey key)throws Exception {
        c.verify(NativeRetainedNamespaceCustodyLayoutTest.values(v),NativeRetainedNamespaceCustodyLayoutTest.bytes(v),layout(l),key);
    }
    static void noAuthority(JSONObject p)throws Exception {
        for(String flag:new String[]{"raw_transport_allowed","transport_allowed","body_prepared","durable_retention","all8_typed_backend_contract_bound",
            "actual_Android_keystore_qualified","key_loss_recovery","cross_device_recovery","complete_application_recovery","complete_namespace_inventory",
            "all_writer_durable_freeze_or_ABA_guard","current_server_readback","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed",
            "absence_proves_no_late_commit","finalizer_allowed","key_removal","phone_released"})assertEquals(flag,false,p.get(flag));
        assertTrue(p.getBoolean("local_same_key_exact_roundtrip_checked"));assertTrue(p.getBoolean("all_original_key_families_must_survive"));
        assertTrue(p.getBoolean("same_device_key_survival_required"));assertTrue(p.getBoolean("work_witnesses_do_not_cover_all8_values"));
        assertSame(JSONObject.NULL,p.get("writer_path"));assertSame(JSONObject.NULL,p.get("new_custody_operation_id"));
        assertEquals("UNKNOWN",p.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",p.get("browser_inventory_state"));
        assertFalse(p.has("ciphertext"));assertFalse(p.has("iv"));assertFalse(p.has("raw_values"));
        for(String secret:new String[]{"body_base64","manifest_body","installation_seal","synthetic-batch-token-one","opaque original"})assertFalse(p.toString().contains(secret));
    }
    @Test public void multiChunkAll8ExactExistingKeyRoundtripHasMetadataOnlyAndNoOriginalEffects()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
            verify(c,v,l,key(1));JSONObject p=c.metadata();noAuthority(p);assertTrue(p.getInt("chunk_count")>1);
            assertEquals(v.projection().get("values_sha256"),p.get("values_sha256"));assertEquals(l.projection().get("layout_sha256"),p.get("layout_sha256"));
            int count=0;for(int i=0;i<p.getJSONArray("chunks").length();i++){
                var chunk=p.getJSONArray("chunks").getJSONObject(i);assertEquals(i,chunk.getInt("chunk_index"));assertEquals(count,chunk.getInt("byte_offset"));
                count+=chunk.getInt("cleartext_bytes");assertEquals(chunk.getInt("cleartext_bytes")+16,chunk.getInt("encrypted_bytes"));
                assertFalse(chunk.has("ciphertext"));assertFalse(chunk.has("iv"));
            }assertEquals(p.getInt("byte_count"),count);assertEquals(4,p.getJSONArray("key_family_references").length());stable.check();
        }f.x.f.preserved();
    }
    @Test public void emptyWorkBatchStillRetainsUnknownNativeRowsAndDoesNotGrantKeyRetirement()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
            noAuthority(c.metadata());assertTrue(c.metadata().getInt("record_count")>0);verify(c,v,l,key(1));
        }f.x.f.preserved();
    }
    @Test public void freshGcmIvPerPreparationDoesNotMintOperationOrChangeOriginalBinding()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var a=capsule(v,l,key(1));var b=capsule(v,l,key(1))){
            assertNotEquals(a.metadata().get("capsule_sha256"),b.metadata().get("capsule_sha256"));
            assertNotEquals(a.metadata().getJSONArray("chunks").getJSONObject(0).get("iv_sha256"),b.metadata().getJSONArray("chunks").getJSONObject(0).get("iv_sha256"));
            assertEquals(a.metadata().get("aad_binding_sha256"),b.metadata().get("aad_binding_sha256"));noAuthority(a.metadata());noAuthority(b.metadata());
        }f.x.f.preserved();
    }
    @Test public void missingWrongAlgorithmAndChangedKeyRefuseNoCreateFallbackOrPlaintextResult()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->capsule(v,l,null));denied(()->capsule(v,l,new SecretKeySpec(new byte[32],"HmacSHA256")));
            denied(()->verify(c,v,l,key(2)));verify(c,v,l,key(1));stable.check();
        }f.x.f.preserved();
    }
    @Test public void everyCiphertextOrIvMutationRefusesRecoveryAndMetadataWithoutDeletingOriginals()throws Exception {
        for(String name:new String[]{"encrypted","iv"}){
            var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
                Object chunk=((List<?>)field(c,"chunks")).get(0);byte[] bytes=(byte[])field(chunk,name);bytes[0]^=1;
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->verify(c,v,l,key(1)));denied(c::metadata);stable.check();assertNotNull(v.projection());
            }f.x.f.preserved();
        }
    }
    @Test public void fixedAadMutationOrForeignTypedLayoutCannotBorrowValidCapsule()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var other=x.layout(s);var c=capsule(v,l,key(1))){
            denied(()->verify(c,v,other,key(1)));byte[] binding=(byte[])field(c,"binding");binding[0]^=1;
            denied(()->verify(c,v,l,key(1)));denied(c::metadata);
        }f.x.f.preserved();
    }
    @Test public void privateValueMutationAndClosedValuesCannotPassLocalRecovery()throws Exception {
        for(boolean close:new boolean[]{false,true}){
            var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
                if(close)v.close();else {byte[] original=NativeRetainedNamespaceCustodyLayoutTest.bytes(v);original[original.length-1]^=1;}
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->verify(c,v,l,key(1)));stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void closeWipesOnlyOwnedCapsuleBuffersNotCapturedValuesLayoutOrKeyFamilies()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
            var c=capsule(v,l,key(1));Object chunk=((List<?>)field(c,"chunks")).get(0);byte[] iv=(byte[])field(chunk,"iv"),encrypted=(byte[])field(chunk,"encrypted"),binding=(byte[])field(c,"binding");
            c.close();c.close();assertArrayEquals(new byte[iv.length],iv);assertArrayEquals(new byte[encrypted.length],encrypted);assertArrayEquals(new byte[binding.length],binding);
            denied(c::metadata);denied(()->verify(c,v,l,key(1)));assertNotNull(l.projection());assertNotNull(s.projection());assertNotNull(v.projection());assertTrue(n.stillCurrent());
        }f.x.f.preserved();
    }
    @Test public void immutableMetadataNeverChangesPrivateCapsuleAndNoPublicRawOrCiphertextGetterExists()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);var c=capsule(v,l,key(1))){
            String identity=c.metadata().getString("capsule_sha256");JSONObject p=c.metadata();p.put("transport_allowed",true);p.getJSONArray("chunks").remove(0);
            assertEquals(identity,c.metadata().get("capsule_sha256"));noAuthority(c.metadata());verify(c,v,l,key(1));
        }f.x.f.preserved();
        for(var method:NativeRetainedNamespacePrivateCapsule.class.getDeclaredMethods())if(!Modifier.isPrivate(method.getModifiers()))assertNotEquals(byte[].class,method.getReturnType());
        for(var method:VaultEngine.class.getDeclaredMethods())if(method.getName().equals("prepareOriginalRetainedNamespacePrivateCapsule"))
            assertArrayEquals(new Class<?>[]{VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation.class},method.getParameterTypes());
    }
    @Test public void malformedChunkCoordinatesDigestOrAuthorityRefuseBeforeAnyCapsule()throws Exception {
        for(String name:new String[]{"byte_offset","chunk_bytes","chunk_sha256","transport_allowed"}){
            var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
                NativeRetainedNamespaceSemanticJoinTest.mutate(layout(l),p->{if(name.equals("transport_allowed"))p.put(name,true);
                    else p.getJSONArray("chunks").getJSONObject(0).put(name,name.equals("chunk_sha256")?"f".repeat(64):999);});
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->capsule(v,l,key(1)));stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void familyCountsUnknownReferencesAndRetirementFlagsCannotBeCoercedOrDropped()throws Exception {
        for(String name:new String[]{"key_family","source_declared_raw_rows_to_preserve","zero_rows_is_not_key_removal_authority","key_removal"}){
            var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
                NativeRetainedNamespaceSemanticJoinTest.mutate(layout(l),p->p.getJSONArray("key_family_references").getJSONObject(0)
                    .put(name,name.equals("key_family")?"FOREIGN":name.equals("source_declared_raw_rows_to_preserve")?"0":name.equals("key_removal")));
                denied(()->capsule(v,l,key(1)));
            }f.x.f.preserved();
        }
    }
    @Test public void missingForeignClosedOrStaleEngineOwnerRefusesBeforeFixedKeyAdapter()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;var of=other.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var og=of.x.f.generation();var on=of.x.observe();var ov=of.values(og,on);var os=of.join(ov);var ol=other.layout(os)){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->f.engine().prepareOriginalRetainedNamespacePrivateCapsule(null));
            denied(()->f.engine().prepareOriginalRetainedNamespacePrivateCapsule(ol));l.close();denied(()->f.engine().prepareOriginalRetainedNamespacePrivateCapsule(l));stable.check();
        }f.x.f.preserved();of.x.f.preserved();
    }

    @Test public void HASH_sameOwnedAndDetachedOriginalsPreserveCapsuleBinding()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=capsule(v,l,key(1))){
            var values=NativeRetainedNamespaceCustodyLayoutTest.values(v);var originalLayout=layout(l);
            byte[] owned=NativeRetainedNamespaceCustodyLayoutTest.bytes(v),detached=owned.clone(),before=owned.clone();
            try {
                assertNotSame(owned,detached);String metadata=c.metadata().toString();
                values.requireCustodyLayoutAndOriginalValues(owned,originalLayout);
                values.requireCustodyLayoutAndOriginalValues(detached,originalLayout);
                c.verify(values,owned,originalLayout,key(1));
                c.verify(values,detached,originalLayout,key(1));
                assertArrayEquals(before,owned);assertArrayEquals(before,detached);
                assertEquals(metadata,c.metadata().toString());noAuthority(c.metadata());
                assertFalse(values.durable);assertFalse(values.semanticInventoryComplete);assertFalse(values.currentServerReadback);
                assertFalse(values.workAccepted);assertFalse(values.inventoryAcknowledged);assertFalse(values.resendAllowed);
                assertFalse(values.finalizerAllowed);assertFalse(values.keyRemovalAllowed);stable.check();
            }finally{Arrays.fill(detached,(byte)0);Arrays.fill(before,(byte)0);}
        }finally{f.x.f.preserved();}
    }
    @Test public void HASH_detachedNullLengthAndChangedBytesRefuseWithoutEffects()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=capsule(v,l,key(1))){
            var values=NativeRetainedNamespaceCustodyLayoutTest.values(v);var originalLayout=layout(l);
            byte[] owned=NativeRetainedNamespaceCustodyLayoutTest.bytes(v),before=owned.clone(),changed=owned.clone();
            byte[] shorter=Arrays.copyOf(owned,owned.length-1),longer=Arrays.copyOf(owned,owned.length+1);
            changed[changed.length-1]^=1;
            try {
                for(byte[] invalid:new byte[][]{null,new byte[0],shorter,longer,changed}){
                    VaultFailure failure=assertThrows(VaultFailure.class,()->values.requireCustodyLayoutAndOriginalValues(invalid,originalLayout));
                    assertEquals(NativeRetainedNamespacePrivateCapsule.FAILURE,failure.code);
                    denied(()->c.verify(values,invalid,originalLayout,key(1)));
                    assertArrayEquals(before,owned);
                }
                denied(()->NativeRetainedNamespacePrivateCapsule.prepare(null,owned,originalLayout,key(1)));
                denied(()->NativeRetainedNamespacePrivateCapsule.prepare(values,owned,null,key(1)));
                values.requireCustodyLayoutAndOriginalValues(owned,originalLayout);
                verify(c,v,l,key(1));noAuthority(c.metadata());stable.check();
            }finally{for(byte[] bytes:new byte[][]{before,changed,shorter,longer})Arrays.fill(bytes,(byte)0);}
        }finally{f.x.f.preserved();}
    }
    @Test public void HASH_changedOwnedBufferCannotUseAliasFastPath()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=capsule(v,l,key(1))){
            var values=NativeRetainedNamespaceCustodyLayoutTest.values(v);var originalLayout=layout(l);
            byte[] owned=NativeRetainedNamespaceCustodyLayoutTest.bytes(v),original=owned.clone();
            try {
                owned[owned.length-1]^=1;
                VaultFailure failure=assertThrows(VaultFailure.class,()->values.requireCustodyLayoutAndOriginalValues(owned,originalLayout));
                assertEquals(NativeRetainedNamespaceValues.FAILURE,failure.code);
                denied(()->values.requireCustodyLayoutAndOriginalValues(original,originalLayout));
                denied(()->c.verify(values,owned,originalLayout,key(1)));
                denied(()->c.verify(values,original,originalLayout,key(1)));
            }finally{System.arraycopy(original,0,owned,0,original.length);Arrays.fill(original,(byte)0);}
            values.requireCustodyLayoutAndOriginalValues(owned,originalLayout);
            verify(c,v,l,key(1));noAuthority(c.metadata());stable.check();
        }finally{f.x.f.preserved();}
    }
    @Test public void HASH_closedValuesAndForeignLayoutRefuse()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=capsule(v,l,key(1));
            var foreign=NativeRetainedNamespaceValues.capture(f.all(),"b".repeat(64))){
            var values=NativeRetainedNamespaceCustodyLayoutTest.values(v);var originalLayout=layout(l);
            byte[] owned=NativeRetainedNamespaceCustodyLayoutTest.bytes(v),detached=owned.clone();
            byte[] foreignOwned=(byte[])field(foreign,"encoded");
            try {
                assertNotEquals(values.sourceCaptureSha256,foreign.sourceCaptureSha256);
                denied(()->foreign.requireCustodyLayoutAndOriginalValues(foreignOwned,originalLayout));
                denied(()->values.requireCustodyLayoutAndOriginalValues(owned,null));
                denied(()->c.verify(foreign,foreignOwned,originalLayout,key(1)));
                values.requireCustodyLayoutAndOriginalValues(owned,originalLayout);
                values.close();
                assertArrayEquals(new byte[owned.length],owned);
                denied(()->values.requireCustodyLayoutAndOriginalValues(owned,originalLayout));
                denied(()->values.requireCustodyLayoutAndOriginalValues(detached,originalLayout));
                denied(()->c.verify(values,detached,originalLayout,key(1)));
                foreign.requireOpen();stable.check();
            }finally{Arrays.fill(detached,(byte)0);}
        }finally{f.x.f.preserved();}
    }
}
