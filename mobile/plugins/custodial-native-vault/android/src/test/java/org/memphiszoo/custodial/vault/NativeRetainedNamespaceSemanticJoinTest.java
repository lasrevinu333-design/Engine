package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW all8 exact closure/join cases ONLY. Old factories are compiled, not
 * rerun. AES/prefs/enrollment/clock/provider admission/HTTP are synthetic;
 * no actual Android fsync/server SQL/browser/device/keys/credentials are used.
 * Reflection below mutates ONLY synthetic private immutable observations to
 * exercise defensive closure validation, not a production JSON input seam. */
public final class NativeRetainedNamespaceSemanticJoinTest {
    public static void main(String[] args)throws Exception{
        if(args.length==1&&"--host-bound-original-prefs-only".equals(args[0])){
            new NativeRetainedNamespaceSemanticJoinTest().HOST_MODEL_sameOriginalBoundPreferencesPreserveTypedCensus();
            System.out.println("PASS_HOST_MODEL_BOUND_ORIGINAL_PREFS_ONLY no_private_ACK_or_Android_fsync_claim");return;
        }
        if(args.length!=2||!"--original-records-only".equals(args[0])||!java.util.Set.of(
            "RECORDS_exactAll8RowsAndBindings","RECORDS_detachedListRejectsDisplayAndListMutation",
            "RECORDS_unavailableAndMalformedRemainRetained","RECORDS_privateConstructionAndForeignLists").contains(args[1]))
            throw new IllegalArgumentException("new original-record member required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeRetainedNamespaceSemanticJoinTest.class,args[1]));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
        }
        System.out.println("PASS_NEW_STRUCTURAL_ORIGINAL_RECORDS_ONLY "+args[1]);
    }
    static final class Fixture {
        final NativeRetainedNamespaceCensusTest.Fixture x;
        final SharedPreferencesVaultPersistence adapter;
        // Test construction only, sampled before this fixture is captured by
        // any generation observation/frame/HELD factory. Never epoch/ACK/control
        // authority. The original no-property route keeps its throwing facade.
        private enum PersistenceMode { READ_ONLY_JOIN, ORIGINAL_PREFS_HOST_MODEL }
        private static PersistenceMode requestedPersistence(){
            String mode=System.getProperty("custodial.fixture.semantic-join-persistence");
            if(mode==null)return PersistenceMode.READ_ONLY_JOIN;
            if(!"original-bound-prefs-host-model".equals(mode))throw new IllegalArgumentException("unknown_semantic_join_persistence_fixture");
            return PersistenceMode.ORIGINAL_PREFS_HOST_MODEL;
        }
        final NativeRetainedOwnerTest.WorkDisk boundVaultDisk;
        final SharedPreferences boundVaultPreferences,boundWorkPreferences;
        final AndroidProtectedWorkPreferences boundWorkAdmission;
        Fixture() throws Exception {this(requestedPersistence());}
        static Fixture boundOriginalPreferencesForHostModel()throws Exception {
            return new Fixture(PersistenceMode.ORIGINAL_PREFS_HOST_MODEL);
        }
        private Fixture(PersistenceMode mode) throws Exception {
            this(new NativeRetainedNamespaceCensusTest.Fixture(),mode);
        }
        Fixture(NativeRetainedNamespaceCensusTest.Fixture original)throws Exception {
            this(original,requestedPersistence());
        }
        private Fixture(NativeRetainedNamespaceCensusTest.Fixture original,PersistenceMode mode) throws Exception {
            x=java.util.Objects.requireNonNull(original);
            var owner=x.f.batch.old;var vault=x.unknown.get(NativeVaultProviderReferenceCensus.VAULT);
            byte[] bytes=new VaultSnapshotCodec().encode(owner.persistence.current());
            try{vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,Base64.getEncoder().encodeToString(bytes));}finally{Arrays.fill(bytes,(byte)0);}
            if(mode==PersistenceMode.ORIGINAL_PREFS_HOST_MODEL){
                // WorkDisk's existing editor mutates THIS original map in place.
                // No clear/re-enrollment or replacement census map is created.
                boundVaultDisk=new NativeRetainedOwnerTest.WorkDisk();
                boundVaultDisk.memory=vault;boundVaultDisk.durable=new HashMap<>(vault);
                boundVaultPreferences=boundVaultDisk.preferences();
                // The original WORK disk, not a copied/fresh WORK namespace.
                boundWorkPreferences=owner.workDisk.preferences();
                boundWorkAdmission=new AndroidProtectedWorkPreferences(boundWorkPreferences);
                adapter=new SharedPreferencesVaultPersistence(boundVaultPreferences,new VaultSnapshotCodec(),boundWorkAdmission);
                owner.engine=new VaultEngine(adapter,owner.vaultCipher,owner.enrollment,new FakeLegacySource(),new TestSealGenerator(),owner.clock,owner.work);
                return;
            }
            boundVaultDisk=null;boundVaultPreferences=null;boundWorkPreferences=null;boundWorkAdmission=null;
            SharedPreferences prefs=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(p,m,a)->{
                if(!m.getName().equals("getAll"))throw new AssertionError("join cannot use preference writer: "+m.getName());return new HashMap<>(vault);
            });
            adapter=new SharedPreferencesVaultPersistence(prefs,new VaultSnapshotCodec());
            owner.engine=new VaultEngine(new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure{return owner.persistence.load();}
                public void commit(long e,VaultSnapshot n){throw new AssertionError("join cannot commit vault");}
                public boolean matchesCapturedOriginalSnapshot(Map<String,?> raw,VaultSnapshot original)throws VaultFailure{return adapter.matchesCapturedOriginalSnapshot(raw,original);}
            },owner.vaultCipher,owner.enrollment,new FakeLegacySource(),new TestSealGenerator(),owner.clock);
        }
        private void requireBoundOriginalPreferences(){
            if(boundVaultPreferences==null||boundVaultDisk.memory!=x.unknown.get(NativeVaultProviderReferenceCensus.VAULT))
                throw new AssertionError("original bound host preferences fixture required");
        }
        // Cold DATA readback against the same preferences OBJECT as the live
        // adapter: uncertainty is not escaped by constructing a new raw handle.
        VaultSnapshot coldOriginalVaultSnapshot()throws VaultFailure {
            requireBoundOriginalPreferences();
            return new SharedPreferencesVaultPersistence(boundVaultPreferences,new VaultSnapshotCodec(),boundWorkAdmission).load();
        }
        Map<String,?> coldOriginalVaultValues(){
            requireBoundOriginalPreferences();Map<String,Object> values=new HashMap<>();
            for(var row:boundVaultPreferences.getAll().entrySet()){
                Object value=row.getValue();
                if(value instanceof Set<?>)value=java.util.Collections.unmodifiableSet(new HashSet<>((Set<?>)value));
                values.put(row.getKey(),value);
            }
            return java.util.Collections.unmodifiableMap(values);
        }
        VaultEngine engine(){return x.f.batch.old.engine;}
        Map<String,Map<String,?>> all(){var all=new TreeMap<String,Map<String,?>>();for(String name:x.unknown.keySet())all.put(name,x.raw(name));return all;}
        VaultEngine.NativeRetainedNamespaceValueObservation values(VaultEngine.NativeRetainedGenerationObservation g,NativeProtectedNamespaceObservation n)throws Exception {
            return engine().observeOriginalRetainedNamespaceValues(g,n);
        }
        VaultEngine.NativeRetainedNamespaceSemanticObservation join(VaultEngine.NativeRetainedNamespaceValueObservation v)throws Exception{
            return engine().inspectOriginalRetainedNamespaceSemantics(v,x.f.batch.journal);
        }
        JSONObject inspect()throws Exception {
            var stable=new NativeRetainedNamespaceCensusTest.Stable(x);
            try(var g=x.f.generation();var n=x.observe();var v=values(g,n);var s=join(v)){
                var p=s.projection();noAuthority(p);assertEquals(x.total(),p.getInt("record_count"));assertEquals(v.projection().get("values_sha256"),p.get("values_sha256"));
                stable.check();return p;
            }finally{x.f.preserved();}
        }
    }
    /** NEW owning adapter construction only. Still HOST-MODEL preferences,
     * enrollment/provider facts and keys; no private control is manufactured. */
    @Test public void HOST_MODEL_sameOriginalBoundPreferencesPreserveTypedCensus()throws Exception {
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        var f=Fixture.boundOriginalPreferencesForHostModel();var owner=f.x.f.batch.old;
        try{
            var vault=f.x.unknown.get(NativeVaultProviderReferenceCensus.VAULT);
            vault.put("host-original-int",17);vault.put("host-original-long",9007199254740993L);
            vault.put("host-original-boolean",true);vault.put("host-original-zero",-0.0f);
            vault.put("host-original-nan",Float.intBitsToFloat(0x7fc12345));
            vault.put("host-original-text","exact-unpaired-\ud800");vault.put("host-original-set",Set.of("ñ","original-\ud800"));
            // Fixture seed only, before ANY observation. Not an Android fsync.
            f.boundVaultDisk.durable=new HashMap<>(vault);
            assertSame(vault,f.boundVaultDisk.memory);assertSame(vault,f.x.raw(NativeVaultProviderReferenceCensus.VAULT));
            assertEquals(SharedPreferencesVaultPersistence.class,f.adapter.getClass());
            var snapshot=owner.persistence.current();assertEquals(snapshot,f.adapter.load());assertEquals(snapshot,f.coldOriginalVaultSnapshot());
            var cold=f.coldOriginalVaultValues();assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(vault,cold));
            assertEquals(Long.class,cold.get("host-original-long").getClass());assertEquals(Integer.class,cold.get("host-original-int").getClass());
            assertEquals(0x80000000,Float.floatToRawIntBits((Float)cold.get("host-original-zero")));
            assertEquals(0x7fc12345,Float.floatToRawIntBits((Float)cold.get("host-original-nan")));
            assertThrows(UnsupportedOperationException.class,cold::clear);
            assertNotSame(vault.get("host-original-set"),cold.get("host-original-set"));
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(owner.workDisk.memory,f.boundWorkPreferences.getAll()));
            assertEquals(0,f.boundVaultDisk.commits);AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
            try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
                noAuthority(s.projection());assertEquals(f.x.total(),v.projection().getInt("record_count"));
                assertTrue(f.adapter.matchesCapturedOriginalSnapshot(f.x.raw(NativeVaultProviderReferenceCensus.VAULT),snapshot));
                assertEquals(snapshot.revision,f.engine().observeStateReadOnly().get("revision"));
                assertThrows(VaultFailure.class,()->f.adapter.commitOriginalInventoryFinalization(null));
                stable.check();assertEquals(0,f.boundVaultDisk.commits);
                assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(vault,f.boundVaultDisk.durable));
                assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(vault,f.coldOriginalVaultValues()));
            }
            AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        }finally{f.x.f.preserved();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativeOriginalGenerationObservationTest.denied(a);}
    static void noAuthority(JSONObject p)throws Exception {
        for(String flag:new String[]{"complete_namespace_inventory","durable_retention","all8_backend_writer_bound","all_writer_durable_freeze_or_ABA_guard",
            "current_server_readback","clock_profile_qualified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed",
            "absence_proves_no_late_commit","finalizer_allowed","key_removal","phone_released"})assertEquals(flag,false,p.get(flag));
        assertEquals("UNKNOWN",p.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",p.get("browser_inventory_state"));
        assertEquals(8,p.getJSONArray("namespaces").length());assertEquals(4,p.getJSONArray("key_family_references").length());
        assertEquals(p.getInt("record_count"),p.getInt("source_classified_record_count")+p.getInt("unresolved_source_record_count"));
        assertEquals(p.getInt("record_count"),p.getJSONArray("records").length());Set<String> ids=new HashSet<>();
        for(int i=0;i<p.getJSONArray("records").length();i++){
            var row=p.getJSONArray("records").getJSONObject(i);assertTrue(ids.add(row.getString("namespace")+row.getString("raw_identity_sha256")));
            assertEquals("UNKNOWN_RETAINED",row.get("application_semantic_disposition"));
            for(String flag:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal"})assertFalse(row.getBoolean(flag));
        }
        for(String secret:new String[]{"body_base64","manifest_body","ciphertext","installation_seal","synthetic-batch-token-one","opaque original","authoritative_snapshot","native_separation_freeze"})
            assertFalse(secret,p.toString().contains(secret));
    }
    static JSONObject chunk(JSONObject p,int i)throws Exception{return p.getJSONArray("original_work_journal_chunks").getJSONObject(i);}
    @Test public void exactAllEightRawRowsAndThreeOriginalChunksJoinUnderSameCaptureWithoutEffects()throws Exception {
        var f=new Fixture();f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var p=f.inspect();
        assertEquals(3,p.getJSONArray("original_work_journal_chunks").length());assertTrue(p.getBoolean("all_fixed_work_chunks_have_original_cached_observations"));
        assertTrue(p.getBoolean("work_witnesses_do_not_cover_all8_values"));assertTrue(p.getInt("unresolved_source_record_count")>0);
        for(int i=0;i<3;i++){assertTrue(chunk(p,i).getBoolean("original_write_hmac_validated"));assertTrue(chunk(p,i).getBoolean("cached_original_observation_validated"));}
        assertEquals(f.x.f.original.generationId,p.get("original_generation_id"));assertEquals(f.x.f.principal.digest,p.get("principal_digest"));
        var states=new HashSet<String>();for(int i=0;i<p.getJSONArray("records").length();i++)states.add(p.getJSONArray("records").getJSONObject(i).getString("local_source_classification"));
        assertTrue(states.contains("EXACT_ORIGINAL_OWNING_VAULT_SNAPSHOT_CODEC_BYTES_BOUND"));assertTrue(states.contains("ORIGINAL_GENERATION_ADMISSION_AND_EXACT_TOKEN_CAPTURE_REFERENCE_LOCAL_ONLY"));
    }
    @Test public void emptyBatchAndLegacyStoresNeverInventGenerationChunksAbsenceOrKeyAuthority()throws Exception {
        var f=new Fixture();f.x.unknown.get("MemphisZooCustodialNativeVaultV1").clear();f.x.unknown.get("WSSecureStorageSharedPreferences").clear();var p=f.inspect();
        assertEquals(0,p.getJSONArray("original_work_journal_chunks").length());assertFalse(p.getBoolean("all_fixed_work_chunks_have_original_cached_observations"));
        assertEquals("EMPTY_NO_BATCH_OWNER",p.get("batch_owner_state"));assertSame(JSONObject.NULL,p.get("original_work_batch_operation_id"));
        for(int i=0;i<4;i++)assertTrue(p.getJSONArray("key_family_references").getJSONObject(i).getBoolean("zero_rows_is_not_key_removal_authority"));
    }
    @Test public void missingMiddleWriteAndOrphanQueryPreserveLaterWitnessAndEveryRawRow()throws Exception {
        var f=new Fixture();f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");f.x.removeSlot(false,1);var p=f.inspect();
        assertEquals(3,p.getJSONArray("original_work_journal_chunks").length());assertEquals("ORPHAN_QUERY_WITHOUT_ORIGINAL_WRITE_RETAINED",chunk(p,1).get("state"));
        assertTrue(chunk(p,2).getBoolean("cached_original_observation_validated"));assertFalse(p.getBoolean("all_fixed_work_chunks_have_original_cached_observations"));
    }
    @Test public void cachedOutcomeUnknownAndDigestOnlyWorkReadbacksDoNotCoverNewBinaryValues()throws Exception {
        for(String status:new String[]{"OUTCOME_UNKNOWN","REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION"}){
            var f=new Fixture();f.x.complete(status);var p=f.inspect();assertEquals(status,chunk(p,2).get("cached_status"));
            assertTrue(p.getBoolean("work_witnesses_do_not_cover_all8_values"));assertFalse(p.getBoolean("durable_retention"));
        }
    }
    @Test public void corruptOriginalWriteAndMissingExistingKeyRemainUnresolvedWithoutReplacement()throws Exception {
        for(boolean missing:new boolean[]{false,true}){
            var f=new Fixture();f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
            if(missing)f.x.f.batch.old.journalCipher.missing=true;else f.x.f.batch.old.journalDisk.memory.put("part:0","corrupt-original-retained");
            var p=f.inspect();assertFalse(chunk(p,0).getBoolean("original_write_hmac_validated"));assertTrue(chunk(p,2).getBoolean("cached_original_observation_validated"));
            assertEquals(0,f.x.f.batch.old.journalCipher.creates);assertEquals(0,f.x.f.batch.old.journalCipher.destroys);
        }
    }
    @Test public void unknownBatchLayoutKeepsRawRowsAndDoesNotBorrowValidAdjacentSlots()throws Exception {
        var f=new Fixture();f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");f.x.f.batch.root.memory.put("foreign-layout-row","untouched");
        var p=f.inspect();assertEquals(0,p.getJSONArray("original_work_journal_chunks").length());assertEquals("BATCH_OWNER_UNRESOLVED_RETAINED",p.get("batch_owner_state"));
        assertEquals("untouched",f.x.f.batch.root.memory.get("foreign-layout-row"));
    }
    @Test public void foreignClosedMissingCaptureAndMissingJournalFailBeforeAnyEffect()throws Exception {
        var f=new Fixture();var other=new Fixture();
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var og=other.x.f.generation();var on=other.x.observe();var ov=other.values(og,on)){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(()->f.join(null));denied(()->f.join(ov));
            denied(()->f.engine().inspectOriginalRetainedNamespaceSemantics(v,null));v.close();denied(()->f.join(v));stable.check();
        }f.x.f.preserved();other.x.f.preserved();
    }
    @Test public void changesInEachNativeDomainInvalidateJoinAndExistingProjectionWithoutRecapture()throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
                @SuppressWarnings("unchecked") var raw=(Map<String,Object>)f.x.raw(name);raw.put("late-unknown-original","preserve-change");
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(s::projection);denied(()->f.join(v));stable.check();assertEquals("preserve-change",raw.get("late-unknown-original"));
            }f.x.f.preserved();
        }
    }
    @Test public void closingJoinDoesNotCloseOriginalCaptureGenerationOrNamespaceOwner()throws Exception {
        var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n)){
            var s=f.join(v);s.close();denied(s::projection);assertNotNull(v.projection());assertNotNull(g.projection());assertTrue(n.stillCurrent());
            try(var fresh=f.join(v)){noAuthority(fresh.projection());}v.close();assertNotNull(g.projection());assertTrue(n.stillCurrent());
        }f.x.f.preserved();
    }
    @Test public void closedGenerationNamespaceAndCaptureInvalidatePreviouslyJoinedProjection()throws Exception {
        for(int kind=0;kind<3;kind++){
            var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
                if(kind==0)g.close();if(kind==1)n.close();if(kind==2)v.close();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(s::projection);stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void originalVaultRevisionAndProviderRotationInvalidateJoinedCapabilities()throws Exception {
        for(boolean rotate:new boolean[]{false,true}){
            var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
                if(rotate)f.x.f.provider.captureToken("new-synthetic-capture");else f.x.f.batch.old.bumpVault();
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);denied(s::projection);denied(()->f.join(v));stable.check();
            }f.x.f.preserved();
        }
    }
    @Test public void joinedProjectionIsImmutableAndCannotAuthorizeWritesOrLeakRawValues()throws Exception {
        var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
            var p=s.projection();String original=p.getString("semantic_join_sha256");p.put("work_accepted",true);p.getJSONArray("records").remove(0);
            var again=s.projection();noAuthority(again);assertEquals(f.x.total(),again.getJSONArray("records").length());assertEquals(original,again.get("semantic_join_sha256"));
            for(var method:NativeRetainedNamespaceSemanticJoin.class.getDeclaredMethods())if(!Modifier.isPrivate(method.getModifiers()))assertNotEquals(byte[].class,method.getReturnType());
        }f.x.f.preserved();
    }
    interface Mutation {void apply(JSONObject j)throws Exception;}
    static void mutate(Object observation,Mutation change)throws Exception {
        Field encoded=observation.getClass().getDeclaredField("encoded");encoded.setAccessible(true);var json=new JSONObject((String)encoded.get(observation));change.apply(json);encoded.set(observation,json.toString());
    }
    static void invalidJoin(Mutation journalMutation,Mutation referenceMutation)throws Exception {
        var f=new Fixture();try(var g=f.x.f.generation();var n=f.x.observe()){
            var engine=f.engine();var j=engine.inspectRetainedCapturedJournalCensus(g,n,f.x.f.batch.journal);var r=engine.inspectOriginalCapturedVaultProviderReferences(g,n);
            if(journalMutation!=null)mutate(j,journalMutation);if(referenceMutation!=null)mutate(r,referenceMutation);
            var capture=NativeRetainedWorkCapture.capture(f.x.f.batch.old.work);
            try(var values=NativeRetainedNamespaceValues.capture(f.all(),n.digest)){
                var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
                denied(()->NativeRetainedNamespaceSemanticJoin.inspect(f.all(),n.digest,values,capture,f.x.f.principal,
                    f.x.f.batch.old.persistence.current().revision,f.x.f.original.generationId,j,r));stable.check();
            }
        }f.x.f.preserved();
    }
    @Test public void mismatchedCapturePrincipalGenerationRevisionAndSchemaCannotCrossJoin()throws Exception {
        for(String field:new String[]{"schema","source_capture_sha256","principal_digest","original_generation_id","engine_revision"}){
            invalidJoin(j->j.put(field,field.equals("engine_revision")?999:"f".repeat(64)),null);
            invalidJoin(null,r->r.put(field,field.equals("engine_revision")?999:"f".repeat(64)));
        }
    }
    @Test public void absentDuplicateRelocatedForeignRowsAndWrongRawTypesRefuseWholeJoin()throws Exception {
        invalidJoin(j->j.getJSONArray("records").remove(0),null);
        invalidJoin(null,r->r.getJSONArray("records").put(r.getJSONArray("records").getJSONObject(0)));
        invalidJoin(j->j.getJSONArray("records").getJSONObject(0).put("namespace",NativeRetainedNamespaceCensus.BATCH),null);
        invalidJoin(null,r->r.getJSONArray("records").getJSONObject(0).put("raw_identity_sha256","f".repeat(64)));
        invalidJoin(j->j.getJSONArray("records").getJSONObject(0).put("raw_type","BOOLEAN"),null);
    }
    @Test public void namesCountsKeyFamiliesAndVaultBindingMustBeExactNotMerelyTotalCounts()throws Exception {
        invalidJoin(j->j.getJSONArray("namespaces").getJSONObject(0).put("record_count",999),null);
        invalidJoin(null,r->r.getJSONArray("namespaces").getJSONObject(0).put("namespace","foreign-store"));
        invalidJoin(j->j.getJSONArray("records").getJSONObject(0).put("key_family","wrong-shared-family"),null);
        invalidJoin(null,r->r.put("owning_vault_snapshot_bound",false));
    }
    @Test public void coercedTypesAndAnyInheritedAuthorityFlagRefuseWholeJoin()throws Exception {
        invalidJoin(j->j.put("source_capture_sha256",new org.json.JSONArray().put(j.get("source_capture_sha256"))),null);
        invalidJoin(null,r->r.put("engine_revision","1"));
        for(String flag:new String[]{"inventory_acknowledged","current_server_readback","work_accepted","key_removal","complete_namespace_inventory"})
            invalidJoin(j->j.put(flag,true),null);
    }
    @Test public void joinDigestBindsOpaqueTypedValuesAndIsStableOnlyForSameOriginalCapture()throws Exception {
        var f=new Fixture();String initial=f.inspect().getString("semantic_join_sha256");assertEquals(initial,f.inspect().getString("semantic_join_sha256"));
        f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("legacy-new-unknown",17L);var changed=f.inspect();assertNotEquals(initial,changed.getString("semantic_join_sha256"));
        f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("legacy-new-unknown",17);assertNotEquals(changed.get("semantic_join_sha256"),f.inspect().get("semantic_join_sha256"));
    }

    /** Read the actual private Engine composition result, never materialize
     * original records from diagnostic JSON or construct a native capability. */
    static NativeRetainedNamespaceSemanticJoin.Observation structural(VaultEngine.NativeRetainedNamespaceSemanticObservation source)throws Exception{
        source.projection();var field=source.getClass().getDeclaredField("joined");field.setAccessible(true);
        return (NativeRetainedNamespaceSemanticJoin.Observation)field.get(source);
    }
    static String recordType(Object value){
        if(value instanceof String)return "STRING";if(value instanceof Integer)return "INTEGER";if(value instanceof Long)return "LONG";
        if(value instanceof Boolean)return "BOOLEAN";if(value instanceof Float)return "FLOAT_RAW_BITS";if(value instanceof Set<?>)return "STRING_SET";
        throw new AssertionError("unsupported original raw type");
    }
    static void listRefuses(Runnable effect){
        try{effect.run();fail("private detached list must not accept injected records");}catch(UnsupportedOperationException expected){}
    }
    @Test public void RECORDS_exactAll8RowsAndBindings()throws Exception{
        var f=new Fixture();
        // Same raw key in distinct real domains must remain distinct, and
        // exact UTF-16 key units must not be normalized into another key.
        String exactKey="original-duplicate-key-\ud800";
        f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put(exactKey,17L);
        f.x.unknown.get("WSSecureStorageSharedPreferences").put(exactKey,17);
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
            var observation=structural(s);var records=observation.originalRecords();JSONObject diagnostic=s.projection();String exact=diagnostic.toString();
            noAuthority(diagnostic);assertEquals(f.x.total(),records.size());assertEquals(observation.recordCount,records.size());
            assertEquals(diagnostic.get("source_capture_sha256"),observation.sourceCaptureSha256);
            assertEquals(diagnostic.get("values_sha256"),observation.valuesSha256);
            assertEquals(f.x.f.principal.digest,observation.principalDigest);
            assertEquals(f.x.f.original.generationId,observation.originalGenerationId);
            assertEquals(f.x.f.batch.old.persistence.current().revision,observation.engineRevision);
            Set<String> seen=new HashSet<>();int at=0,classified=0,duplicateKeyCount=0;
            for(String namespace:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())for(var raw:new TreeMap<>(f.x.raw(namespace)).entrySet()){
                var record=records.get(at);var display=diagnostic.getJSONArray("records").getJSONObject(at++);
                assertTrue(seen.add(namespace+"\u0000"+raw.getKey()));
                assertEquals(namespace,record.namespace);assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.get(namespace),record.keyFamily);
                assertEquals(raw.getKey(),record.rawKey);assertEquals(recordType(raw.getValue()),record.rawType);
                assertEquals(NativeProtectedNamespaceObservation.retainedCensusRowIdentity(namespace,raw.getKey(),raw.getValue()),record.rawIdentitySha256);
                assertEquals(display.get("raw_identity_sha256"),record.rawIdentitySha256);
                assertEquals(display.get("journal_source_state"),record.journalSourceState);
                assertEquals(display.get("vault_provider_source_state"),record.vaultProviderSourceState);
                assertEquals(display.get("local_source_classification"),record.localSourceClassification);
                assertEquals(display.get("local_source_classified"),record.sourceClassified);
                assertEquals("UNRESOLVED_RETAINED",record.semanticDisposition);
                if(record.sourceClassified)classified++;if(exactKey.equals(record.rawKey))duplicateKeyCount++;
            }
            assertEquals(2,duplicateKeyCount);assertEquals(records.size(),at);assertEquals(observation.sourceClassifiedCount,classified);
            assertEquals(observation.unresolvedCount,records.size()-classified);assertEquals(exact,s.projection().toString());
            assertFalse(diagnostic.has("original_records"));stable.check();
        }finally{f.x.f.preserved();}
    }
    @Test public void RECORDS_detachedListRejectsDisplayAndListMutation()throws Exception{
        var f=new Fixture();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
            var observation=structural(s);var records=observation.originalRecords();assertFalse(records.isEmpty());
            var first=records.get(0);String binding=observation.joinSha256;int count=records.size();
            listRefuses(records::clear);listRefuses(()->records.add(first));listRefuses(()->records.set(0,first));
            listRefuses(()->records.remove(0));listRefuses(()->records.add(null));
            var display=observation.json();display.getJSONArray("records").getJSONObject(0).put("raw_identity_sha256","f".repeat(64)).put("work_accepted",true);
            display.getJSONArray("records").put(new JSONObject().put("namespace","foreign").put("rawKey","caller-created"));
            display.put("record_count",999).put("inventory_acknowledged",true);
            assertEquals(count,observation.originalRecords().size());assertSame(first,observation.originalRecords().get(0));
            assertEquals(binding,observation.joinSha256);noAuthority(s.projection());stable.check();
            String rawKey=first.rawKey,identity=first.rawIdentitySha256;
            // A detached row is not a still-current owner lease. Source
            // withdrawal invalidates the actual Engine wrapper, not history.
            f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("withdrawn-after-capture","different retained source");
            denied(s::projection);assertSame(first,records.get(0));assertEquals(rawKey,first.rawKey);assertEquals(identity,first.rawIdentitySha256);
            assertEquals("UNRESOLVED_RETAINED",first.semanticDisposition);
        }finally{f.x.f.preserved();}
    }
    @Test public void RECORDS_unavailableAndMalformedRemainRetained()throws Exception{
        var f=new Fixture();f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        f.x.f.batch.old.journalDisk.memory.put("orphan-invalid-record","opaque retained invalid ciphertext");
        f.x.f.batch.old.journalCipher.missing=true;
        f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("unknown-malformed-unicode","\ud800-retained");
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v)){
            var observation=structural(s);var records=observation.originalRecords();assertEquals(f.x.total(),records.size());
            int orphan=0,unknown=0;for(var record:records){
                assertEquals("UNRESOLVED_RETAINED",record.semanticDisposition);
                if(record.rawKey.equals("orphan-invalid-record")){assertEquals(NativeRetainedNamespaceCensus.WRITE,record.namespace);orphan++;}
                if(record.rawKey.equals("unknown-malformed-unicode")){assertEquals("MemphisZooCustodialNativeVaultV1",record.namespace);unknown++;}
            }
            assertEquals(1,orphan);assertEquals(1,unknown);assertTrue(observation.unresolvedCount>0);
            noAuthority(s.projection());stable.check();
        }finally{f.x.f.preserved();}
    }
    @Test public void RECORDS_privateConstructionAndForeignLists()throws Exception{
        assertTrue(Modifier.isFinal(NativeRetainedNamespaceSemanticJoin.OriginalRecord.class.getModifiers()));
        for(var constructor:NativeRetainedNamespaceSemanticJoin.OriginalRecord.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        for(var field:NativeRetainedNamespaceSemanticJoin.OriginalRecord.class.getDeclaredFields()){
            assertTrue(Modifier.isFinal(field.getModifiers()));assertTrue(field.getType()==String.class||field.getType()==boolean.class);
        }
        var f=new Fixture();var other=new Fixture();other.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("foreign-capture-only",true);
        var firstStable=new NativeRetainedNamespaceCensusTest.Stable(f.x);var otherStable=new NativeRetainedNamespaceCensusTest.Stable(other.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);
            var og=other.x.f.generation();var on=other.x.observe();var ov=other.values(og,on);var os=other.join(ov)){
            var original=structural(s);var foreign=structural(os);
            assertNotEquals(original.sourceCaptureSha256,foreign.sourceCaptureSha256);
            assertNotEquals(original.valuesSha256,foreign.valuesSha256);
            var records=original.originalRecords();var injected=foreign.originalRecords().get(0);
            listRefuses(()->records.add(injected));listRefuses(()->records.set(0,injected));listRefuses(()->records.addAll(foreign.originalRecords()));
            assertFalse(records.contains(injected));assertEquals(f.x.total(),records.size());
            for(var row:records)assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
            noAuthority(s.projection());noAuthority(os.projection());firstStable.check();otherStable.check();
        }finally{f.x.f.preserved();other.x.f.preserved();}
    }
}
