package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW original-owner reference census only. Source Android preference reads
 * are proxied; authoritative engine load, AES/admission/auth/clock/disk are
 * synthetic. No old suites rerun, real keys, SQL/phone or runtime admission. */
public final class NativeVaultProviderReferenceCensusTest {
    static final class Fixture {
        final NativeOriginalGenerationObservationTest.Fixture old=new NativeOriginalGenerationObservationTest.Fixture();
        final Map<String,Map<String,Object>> other=new TreeMap<>();
        final Map<String,Object> vault=new HashMap<>();
        final VaultSnapshotCodec codec=new VaultSnapshotCodec();
        final SharedPreferences preferences;
        final SharedPreferencesVaultPersistence adapter;
        int reads;
        Fixture() throws Exception {
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())other.put(name,new HashMap<>());
            byte[] encoded=codec.encode(old.nativeOwner.persistence.current());
            try{vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,Base64.getEncoder().encodeToString(encoded));}
            finally{Arrays.fill(encoded,(byte)0);}
            vault.put("unknown-extra-vault",true);
            other.get("MemphisZooCustodialNativeVaultV1").put("old-private-binding","opaque historical original");
            other.get("WSSecureStorageSharedPreferences").put("old-alias",Set.of("opaque","original"));
            preferences=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                if(!method.getName().equals("getAll"))throw new AssertionError("census cannot write/open/get credential: "+method.getName());
                reads++;return new HashMap<>(vault);
            });
            adapter=new SharedPreferencesVaultPersistence(preferences,codec);
            var owner=old.nativeOwner;
            owner.engine=new VaultEngine(new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure{return owner.persistence.load();}
                public void commit(long expected,VaultSnapshot next){throw new AssertionError("census cannot commit");}
                public boolean matchesCapturedOriginalSnapshot(Map<String,?> raw,VaultSnapshot original)throws VaultFailure{
                    return adapter.matchesCapturedOriginalSnapshot(raw,original);
                }
            },owner.vaultCipher,owner.enrollment,new FakeLegacySource(),new TestSealGenerator(),owner.clock);
        }
        Map<String,?> raw(String name){
            if(NativeVaultProviderReferenceCensus.VAULT.equals(name))return vault;
            if(NativeVaultProviderReferenceCensus.PROVIDER.equals(name))return old.providerStore.memory.raw;
            if(NativeRetainedNamespaceCensus.WORK.equals(name))return old.nativeOwner.workDisk.memory;
            if(NativeRetainedNamespaceCensus.WRITE.equals(name))return old.nativeOwner.journalDisk.memory;
            return other.get(name);
        }
        NativeProtectedNamespaceObservation observe() throws Exception {
            Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
            for(String name:other.keySet())readers.put(name,()->raw(name));
            return NativeProtectedNamespaceObservation.observe(readers);
        }
        NativeVaultProviderReferenceCensus.Observation inspect()throws Exception{return inspect(old.generation.generationId);}
        NativeVaultProviderReferenceCensus.Observation inspect(String generationId)throws Exception{
            var stable=new Stable(this);
            try(var generation=old.observe(generationId);var namespaces=observe()){
                var value=old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces);
                stable.check();noAuthority(value);assertEquals(total(),value.recordCount);return value;
            }finally{old.wiped();}
        }
        int total(){return other.keySet().stream().mapToInt(name->raw(name).size()).sum();}
        JSONObject record(ProviderRecordStore.Key key)throws Exception{
            char[] clear=old.providerStore.store().loadRetained().read(key);
            try{return new JSONObject(new String(clear));}finally{Arrays.fill(clear,'\0');}
        }
        void put(ProviderRecordStore.Key key,JSONObject value)throws Exception{
            char[] clear=value.toString().toCharArray();var store=old.providerStore.store();
            try{store.commit(store.loadRetained().revision,Map.of(key,clear),Set.of());}finally{Arrays.fill(clear,'\0');}
        }
        ProviderRecordStore.Key token(){return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOKEN,"capture-1");}
    }
    static final class Stable {
        final Fixture f;final Map<String,Map<String,?>> all=new TreeMap<>();
        final int providerCommits,keys,workCommits,vaultCommits,ids,opened;
        Stable(Fixture f){
            this.f=f;for(String name:f.other.keySet())all.put(name,new HashMap<>(f.raw(name)));
            providerCommits=f.old.providerStore.memory.commits;keys=f.old.providerStore.keys.creations;
            workCommits=f.old.nativeOwner.workDisk.commits;vaultCommits=f.old.nativeOwner.persistence.commitAttempts.get();
            ids=f.old.nativeOwner.ids;opened=f.old.nativeOwner.opened;
        }
        void check(){
            for(String name:all.keySet())assertEquals(name,all.get(name),f.raw(name));
            assertEquals(providerCommits,f.old.providerStore.memory.commits);assertEquals(keys,f.old.providerStore.keys.creations);
            assertEquals(workCommits,f.old.nativeOwner.workDisk.commits);assertEquals(vaultCommits,f.old.nativeOwner.persistence.commitAttempts.get());
            assertEquals(ids,f.old.nativeOwner.ids);assertEquals(opened,f.old.nativeOwner.opened);f.old.nativeOwner.wiped();
        }
    }
    static void noAuthority(NativeVaultProviderReferenceCensus.Observation value)throws Exception{
        assertFalse(value.completeNamespaceInventory);assertFalse(value.currentServerReadback);assertFalse(value.workAccepted);
        assertFalse(value.inventoryAcknowledged);assertFalse(value.keyRemovalAllowed);assertFalse(value.phoneReleased);
        var json=value.json();assertEquals("UNKNOWN",json.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",json.get("browser_inventory_state"));
        assertEquals(value.recordCount,json.getJSONArray("records").length());assertEquals(8,json.getJSONArray("namespaces").length());
        assertEquals(4,json.getJSONArray("key_family_references").length());assertEquals(value.recordCount-value.vaultBoundRows-value.providerClassifiedRows,value.unresolvedRows);
        for(String flag:new String[]{"complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","current_server_readback","clock_profile_qualified",
            "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertEquals(flag,false,json.get(flag));
        for(int i=0;i<json.getJSONArray("key_family_references").length();i++){
            var row=json.getJSONArray("key_family_references").getJSONObject(i);assertEquals("UNKNOWN",row.get("possible_undeclared_references"));
            assertFalse(row.getBoolean("key_removal"));assertTrue(row.getBoolean("zero_rows_is_not_key_removal_authority"));
        }
        for(String secret:new String[]{"token_digest","native_app","ciphertext","iv\":","installation_seal","principal\":","manifest_body",
            "synthetic-provider-token","opaque historical original","authoritative_snapshot"})assertFalse(secret,json.toString().contains(secret));
    }
    static long stateCount(NativeVaultProviderReferenceCensus.Observation value,String wanted)throws Exception{
        var rows=value.json().getJSONArray("records");long count=0;
        for(int i=0;i<rows.length();i++)if(wanted.equals(rows.getJSONObject(i).get("state")))count++;return count;
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception{NativeOriginalGenerationObservationTest.denied(action);}

    @Test public void exactVaultCodecAndFourProviderRowsUseOriginalOwnerWithoutKeyInitializationOrEffects()throws Exception{
        var f=new Fixture();var result=f.inspect();assertEquals(1,result.vaultBoundRows);assertEquals(4,result.providerClassifiedRows);
        assertTrue(result.unresolvedRows>0);assertTrue(f.reads>0);
    }
    @Test public void unknownExtraVaultAndLegacyRowsStayRepresentedNotOwnedBySnapshot()throws Exception{
        var f=new Fixture();f.vault.put("unknown-typed-original",17L);var result=f.inspect();
        assertEquals(1,result.vaultBoundRows);assertEquals(f.total(),result.recordCount);
        assertTrue(stateCount(result,"NATIVE_ROW_SEMANTICS_UNRESOLVED_RETAINED")>=4);
    }
    @Test public void missingTypedMalformedAndDifferentVaultSnapshotNeverFallBackToEmptyOrCurrent()throws Exception{
        for(int variant=0;variant<4;variant++){
            var f=new Fixture();if(variant==0)f.vault.remove(NativeVaultProviderReferenceCensus.SNAPSHOT);
            if(variant==1)f.vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,17);
            if(variant==2)f.vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,"invalid canonical base64");
            if(variant==3)f.vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,Base64.getEncoder().encodeToString(new byte[]{1,2,3}));
            var result=f.inspect();assertEquals(0,result.vaultBoundRows);assertEquals(4,result.providerClassifiedRows);
        }
    }
    @Test public void unsupportedPersistenceCannotAuthenticateAnOtherwiseMatchingRawVaultReader()throws Exception{
        var f=new Fixture();var n=f.old.nativeOwner;
        n.engine=new VaultEngine(n.persistence,n.vaultCipher,n.enrollment,new FakeLegacySource(),new TestSealGenerator(),n.clock);
        var result=f.inspect();assertEquals(0,result.vaultBoundRows);assertEquals(4,result.providerClassifiedRows);
    }
    @Test public void malformedTokenClosedFieldsKeepTokenAndDependentGenerationUnresolved()throws Exception{
        for(String field:new String[]{"unknown","capture_epoch","capture_sequence","token_digest","token"}){
            var f=new Fixture();var token=f.record(f.token());
            token.put(field,field.equals("capture_epoch")?999:field.equals("capture_sequence")?2:field.equals("token_digest")?"f".repeat(64):"bad\u0000token");
            f.put(f.token(),token);var result=f.inspect();assertEquals(2,result.providerClassifiedRows);
            assertEquals(1,stateCount(result,"TOKEN_CAPTURE_SEMANTICS_UNRESOLVED_RETAINED"));
            assertEquals(1,stateCount(result,"GENERATION_REFERENCE_SEMANTICS_UNRESOLVED_RETAINED"));
        }
    }
    @Test public void missingExactTokenCaptureIsNotBorrowedFromAnotherValidTokenWithSameBody()throws Exception{
        var f=new Fixture();var token=f.record(f.token());
        f.old.provider.captureToken("synthetic-new-original-token");
        var store=f.old.providerStore.store();var snapshot=store.loadRetained();
        char[] clear=new JSONObject(token.toString()).put("capture_sequence",2).toString().toCharArray();
        try{store.commit(snapshot.revision,Map.of(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOKEN,"capture-2"),clear),Set.of(f.token()));}
        finally{Arrays.fill(clear,'\0');}
        var result=f.inspect();assertEquals(3,result.providerClassifiedRows);
        assertEquals(1,stateCount(result,"GENERATION_REFERENCE_SEMANTICS_UNRESOLVED_RETAINED"));
    }
    @Test public void futurePreparedOrPostCutoffGenerationIsRetainedNotChosenAsOriginalAdmission()throws Exception{
        var f=new Fixture();String original=f.old.generation.generationId;f.old.rotate("2026-09-28T08:00:00.123456Z");
        var result=f.inspect(original);assertEquals(1,stateCount(result,"GENERATION_REFERENCE_SEMANTICS_UNRESOLVED_RETAINED"));
        assertEquals(original,result.json().get("original_generation_id"));
    }
    @Test public void encryptedUnknownDomainRowsAndDiagnosticMetadataAreNotSilentlyDropped()throws Exception{
        var f=new Fixture();
        for(var domain:new ProviderEnvelopeCrypto.Domain[]{ProviderEnvelopeCrypto.Domain.INBOX,ProviderEnvelopeCrypto.Domain.QUARANTINE,
            ProviderEnvelopeCrypto.Domain.EVENT,ProviderEnvelopeCrypto.Domain.TOMBSTONE,ProviderEnvelopeCrypto.Domain.METADATA})
            f.put(ProviderRecordStore.key(domain,"unknown-source-record"),new JSONObject().put("schema","custodial.native-provider-journal.v1").put("unknown_private","unchanged body"));
        var result=f.inspect();assertEquals(4,result.providerClassifiedRows);
        assertEquals(5,stateCount(result,"PROVIDER_RECORD_SEMANTICS_UNRESOLVED_RETAINED"));
    }
    @Test public void returnedDiagnosticsDoNotMutatePrivateSnapshotOrGrantKeyCleanup()throws Exception{
        var f=new Fixture();var result=f.inspect();var json=result.json();json.put("key_removal",true);json.getJSONArray("records").remove(0);
        assertFalse(result.json().getBoolean("key_removal"));assertEquals(result.recordCount,result.json().getJSONArray("records").length());
    }
    @Test public void privateProviderCaptureCannotBeSubstitutedByDifferentSameCountReader()throws Exception{
        var f=new Fixture();Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
        for(String name:f.other.keySet())readers.put(name,()->{
            Map<String,Object> copy=new HashMap<>(f.raw(name));
            if(NativeVaultProviderReferenceCensus.PROVIDER.equals(name))copy.put("index","different source same count");return copy;
        });
        try(var generation=f.old.observe();var namespaces=NativeProtectedNamespaceObservation.observe(readers)){
            var stable=new Stable(f);denied(()->f.old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));stable.check();
        }f.old.wiped();
    }
    @Test public void unknownSourceChangeAndClosedOrForeignCapabilitiesPreventPublication()throws Exception{
        for(int variant=0;variant<3;variant++){
            var f=new Fixture();try(var generation=f.old.observe();var namespaces=f.observe()){
                if(variant==0)generation.close();if(variant==1)namespaces.close();
                if(variant==2)f.other.get("WSSecureStorageSharedPreferences").put("late-original",17L);
                var stable=new Stable(f);denied(()->f.old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));stable.check();
            }f.old.wiped();
        }
        var f=new Fixture();var other=new Fixture();
        try(var generation=other.old.observe();var namespaces=f.observe()){
            var stable=new Stable(f);denied(()->f.old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));stable.check();
        }f.old.wiped();other.old.wiped();
    }
    @Test public void zeroDeclaredLegacyRowsStillDoNotPermitDeletingEitherLegacyKeyFamily()throws Exception{
        var f=new Fixture();f.other.get("MemphisZooCustodialNativeVaultV1").clear();f.other.get("WSSecureStorageSharedPreferences").clear();
        var result=f.inspect();var families=result.json().getJSONArray("key_family_references");int empty=0;
        for(int i=0;i<families.length();i++)if(families.getJSONObject(i).getInt("source_declared_raw_rows_to_preserve")==0)empty++;
        assertEquals(2,empty);assertFalse(result.keyRemovalAllowed);
    }
}
