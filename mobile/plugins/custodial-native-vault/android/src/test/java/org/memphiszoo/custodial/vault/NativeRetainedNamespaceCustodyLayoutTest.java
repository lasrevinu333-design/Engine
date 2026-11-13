package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW fixed private-buffer layout/owner cases. Only synthetic private fixture
 * bytes are inspected by reflection; no production getter, real keystore,
 * crypto setup, ciphertext write, credentials/server/phone or old suites. */
public final class NativeRetainedNamespaceCustodyLayoutTest {
    static final class Fixture {
        final NativeRetainedNamespaceSemanticJoinTest.Fixture f;
        Fixture()throws Exception{this(new NativeRetainedNamespaceSemanticJoinTest.Fixture());}
        Fixture(NativeRetainedNamespaceSemanticJoinTest.Fixture original)throws Exception{
            f=java.util.Objects.requireNonNull(original);
        }
        VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation layout(VaultEngine.NativeRetainedNamespaceSemanticObservation semantic)throws Exception {
            return f.engine().inspectOriginalRetainedNamespaceCustodyLayout(semantic);
        }
        JSONObject inspect()throws Exception {
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=layout(s)){
                JSONObject p=l.projection();noAuthority(p);assertEquals(v.projection().get("values_sha256"),p.get("values_sha256"));
                assertEquals(s.projection().get("semantic_join_sha256"),p.get("semantic_join_sha256"));stable.check();return p;
            }finally{f.x.f.preserved();}
        }
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativeOriginalGenerationObservationTest.denied(a);}
    static Object privateField(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    static NativeRetainedNamespaceValues values(VaultEngine.NativeRetainedNamespaceValueObservation owner)throws Exception{return (NativeRetainedNamespaceValues)privateField(owner,"values");}
    static byte[] bytes(VaultEngine.NativeRetainedNamespaceValueObservation owner)throws Exception{return (byte[])privateField(values(owner),"encoded");}
    static void noAuthority(JSONObject p)throws Exception {
        for(String flag:new String[]{"raw_transport_allowed","transport_allowed","body_prepared","confidentiality_contract_verified","recovery_contract_verified",
            "all8_typed_backend_contract_bound","durable_retention","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","current_server_readback",
            "clock_profile_qualified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","absence_proves_no_late_commit",
            "finalizer_allowed","key_removal","phone_released"})assertEquals(flag,false,p.get(flag));
        assertEquals("UNKNOWN",p.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",p.get("browser_inventory_state"));
        assertTrue(p.getBoolean("unresolved_rows_may_contain_private_credentials"));assertTrue(p.getBoolean("reviewed_confidentiality_and_recovery_required"));
        assertSame(JSONObject.NULL,p.get("writer_path"));assertSame(JSONObject.NULL,p.get("new_custody_operation_id"));
        assertEquals(8,p.getJSONArray("native_namespaces").length());assertEquals(4,p.getJSONArray("key_family_references").length());
        for(int i=0;i<p.getJSONArray("chunks").length();i++){
            var c=p.getJSONArray("chunks").getJSONObject(i);assertSame(JSONObject.NULL,c.get("custody_request_id"));assertSame(JSONObject.NULL,c.get("encrypted_capsule_sha256"));
            assertFalse(c.getBoolean("body_prepared"));assertFalse(c.getBoolean("durably_stored"));assertFalse(c.getBoolean("server_readback"));
        }
        for(String secret:new String[]{"body_base64","manifest_body","ciphertext","installation_seal","synthetic-batch-token-one","opaque original","authoritative_snapshot","native_separation_freeze"})assertFalse(secret,p.toString().contains(secret));
    }
    @Test public void exactPrivateAll8BytesJoinOriginalIdentityAndFixedCompleteChunkHashesWithoutEffects()throws Exception {
        var x=new Fixture();var f=x.f;f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
            JSONObject p=l.projection();noAuthority(p);byte[] original=bytes(v);assertEquals(original.length,p.getInt("byte_count"));
            var chunks=p.getJSONArray("chunks");int offset=0;
            for(int i=0;i<chunks.length();i++){
                var c=chunks.getJSONObject(i);int length=Math.min(24576,original.length-offset);assertEquals(i,c.getInt("chunk_index"));assertEquals(offset,c.getInt("byte_offset"));
                assertEquals(length,c.getInt("chunk_bytes"));byte[] part=Arrays.copyOfRange(original,offset,offset+length);
                try{assertEquals(NativeRetainedAttempt.hash(part),c.get("chunk_sha256"));}finally{Arrays.fill(part,(byte)0);}offset+=length;
            }
            assertEquals(original.length,offset);assertEquals(values(v).valuesSha256,p.get("values_sha256"));
            assertEquals(f.x.f.original.generationId,p.get("original_generation_id"));assertEquals(f.x.f.principal.digest,p.get("principal_digest"));
            assertEquals(s.projection().get("semantic_join_sha256"),p.get("original_work_witness_join_sha256"));stable.check();
        }f.x.f.preserved();
    }
    @Test public void fixedChunkBoundaryMathIsBoundedNoZeroOverflowOmissionOrCallerChunkSize()throws Exception {
        assertEquals(1,NativeRetainedNamespaceCustodyLayout.countForBytes(1));assertEquals(1,NativeRetainedNamespaceCustodyLayout.countForBytes(24576));
        assertEquals(2,NativeRetainedNamespaceCustodyLayout.countForBytes(24577));assertEquals(2,NativeRetainedNamespaceCustodyLayout.countForBytes(49152));
        int max=NativeRetainedNamespaceValues.MAX_BYTES;assertEquals((max+24575)/24576,NativeRetainedNamespaceCustodyLayout.countForBytes(max));
        for(int size:new int[]{0,-1,max+1,Integer.MAX_VALUE,Integer.MIN_VALUE})denied(()->NativeRetainedNamespaceCustodyLayout.countForBytes(size));
    }
    @Test public void historicalWorkCompleteReadbackNeverMintsAll8CustodyOperationBodyNonceOrKeyAuthority()throws Exception {
        var x=new Fixture();x.f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var p=x.inspect();
        assertTrue(p.getBoolean("work_witnesses_do_not_cover_all8_values"));assertEquals(NativeRetainedNamespaceValues.SCHEMA,p.get("values_schema"));
        assertNotEquals("custodial.original-native-value-chunk-intake.v1",p.get("schema"));
        assertNotEquals("/device-auth/separation-evidence",p.opt("writer_path"));
    }
    @Test public void noBatchWitnessStillPreservesAll8LayoutWithoutInterpretingEmptyStoresAsAbsence()throws Exception {
        var x=new Fixture();var p=x.inspect();assertTrue(p.getInt("record_count")>0);assertTrue(p.getInt("chunk_count")>0);
        assertFalse(p.getBoolean("all8_typed_backend_contract_bound"));
    }
    @Test public void missingForeignAndClosedSemanticCapabilityCannotPlanCustody()throws Exception {
        var x=new Fixture();var other=new Fixture();var f=x.f;var of=other.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var og=of.x.f.generation();var on=of.x.observe();var ov=of.values(og,on);var os=of.join(ov)){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->x.layout(null));denied(()->x.layout(os));s.close();denied(()->x.layout(s));stable.check();
        }f.x.f.preserved();of.x.f.preserved();
    }
    @Test public void anyDeclaredDomainChangeInvalidatesPreviouslyBoundLayoutWithoutRewritingOriginals()throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
                @SuppressWarnings("unchecked") var raw=(Map<String,Object>)f.x.raw(name);raw.put("new-unresolved-original-row","kept");
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(l::projection);denied(()->x.layout(s));stable.check();assertEquals("kept",raw.get("new-unresolved-original-row"));
            }f.x.f.preserved();
        }
    }
    @Test public void closingLayoutPreservesAllOtherOwnersAndDiagnosticMutationDoesNotChangeIt()throws Exception {
        var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
            var l=x.layout(s);var p=l.projection();String digest=p.getString("layout_sha256");p.put("raw_transport_allowed",true);p.getJSONArray("chunks").remove(0);
            noAuthority(l.projection());assertEquals(digest,l.projection().get("layout_sha256"));l.close();denied(l::projection);
            assertNotNull(s.projection());assertNotNull(v.projection());assertNotNull(g.projection());assertTrue(n.stillCurrent());
            try(var next=x.layout(s)){assertEquals(digest,next.projection().get("layout_sha256"));}
        }f.x.f.preserved();
    }
    @Test public void closedOriginalGenerationNamespaceValuesOrJoinInvalidatesLayoutProjection()throws Exception {
        for(int kind=0;kind<4;kind++){
            var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
                if(kind==0)g.close();if(kind==1)n.close();if(kind==2)v.close();if(kind==3)s.close();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(l::projection);stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void originalRevisionOrProviderRotationRefusesExistingLayoutWithoutRetargetingGeneration()throws Exception {
        for(boolean rotate:new boolean[]{false,true}){
            var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
                if(rotate)f.x.f.provider.captureToken("new-original-provider-capture");else f.x.f.batch.old.bumpVault();
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(l::projection);denied(()->x.layout(s));stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void privateBufferMutationIsDetectedWithoutRawGetterOrSourceStoreDeletion()throws Exception {
        var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s)){
            byte[] original=bytes(v);original[original.length-1]^=1;var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
            denied(l::projection);denied(()->x.layout(s));stable.check();
        }f.x.f.preserved();
        for(var method:NativeRetainedNamespaceValues.class.getDeclaredMethods())if(!Modifier.isPrivate(method.getModifiers()))assertNotEquals(byte[].class,method.getReturnType());
        for(var method:VaultEngine.class.getDeclaredMethods())if(method.getName().equals("inspectOriginalRetainedNamespaceCustodyLayout")){
            assertArrayEquals(new Class<?>[]{VaultEngine.NativeRetainedNamespaceSemanticObservation.class},method.getParameterTypes());
        }
    }
    @Test public void mismatchedSemanticMetadataAndAuthorityCannotCrossBindToPrivateAll8Layout()throws Exception {
        for(String field:new String[]{"schema","source_capture_sha256","values_sha256","semantic_join_sha256","principal_digest","original_generation_id",
            "original_frozen_work_sha256","engine_revision","record_count","work_accepted","raw_transport_allowed"}){
            var x=new Fixture();var f=x.f;try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
                Object joined=privateField(s,"joined");
                NativeRetainedNamespaceSemanticJoinTest.mutate(joined,j->j.put(field,field.equals("engine_revision")||field.equals("record_count")?999:field.equals("work_accepted")?true:"f".repeat(64)));
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
                if(field.equals("raw_transport_allowed")){
                    // Unknown external transport flags cannot authorize anything:
                    // the typed output always sets all transport fields false.
                    try(var layout=x.layout(s)){noAuthority(layout.projection());}
                }else denied(()->x.layout(s));stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void samePrivateOriginalLayoutStableButNewTypedLegacyValueNeedsDifferentBinding()throws Exception {
        var x=new Fixture();String old=x.inspect().getString("layout_sha256");assertEquals(old,x.inspect().getString("layout_sha256"));
        x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("new-legacy-raw",17L);var next=x.inspect();assertNotEquals(old,next.get("layout_sha256"));
        x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("new-legacy-raw",17);assertNotEquals(next.get("layout_sha256"),x.inspect().get("layout_sha256"));
    }
}
