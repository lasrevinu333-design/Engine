package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED original-owner source reference classification, not acceptance.
 * No raw snapshot, provider token, answer, signature, seal or key leaves this
 * class. The four key families remain protected even when a declared store
 * appears empty: other stores/files/realms and durable/ABA custody are open.
 */
final class NativeVaultProviderReferenceCensus {
    static final String VAULT="MemphisZooCustodialNativeVaultV2",PROVIDER="MemphisZooCustodialNativeProviderV1";
    static final String SNAPSHOT="authoritative_snapshot";
    static final class Observation {
        final int recordCount,vaultBoundRows,providerClassifiedRows,unresolvedRows;
        final boolean completeNamespaceInventory=false,currentServerReadback=false,inventoryAcknowledged=false,
            workAccepted=false,keyRemovalAllowed=false,phoneReleased=false;
        private final String encoded;
        private Observation(JSONObject value,int count,int vault,int provider) throws Exception {
            recordCount=count;vaultBoundRows=vault;providerClassifiedRows=provider;unresolvedRows=count-vault-provider;
            encoded=value.put("record_count",count).put("vault_snapshot_bound_rows",vault).put("provider_reference_classified_rows",provider)
                .put("unresolved_record_count",unresolvedRows).toString();
            if(encoded.length()>8*1024*1024)throw invalid();
        }
        JSONObject json() throws VaultFailure {try{return new JSONObject(encoded);}catch(Exception error){throw invalid();}}
    }
    static Observation inspect(Map<String,Map<String,?>> all,String captureDigest,VaultPersistence persistence,VaultSnapshot original,
        NativeProviderJournal provider,NativeProviderPrincipal principal,NativeSeparationContext context,
        NativeProviderJournal.OriginalGeneration generation) throws VaultFailure {
        try {
            long started=System.nanoTime();
            if(all==null||!all.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                ||persistence==null||original==null||provider==null||principal==null||context==null||generation==null)throw invalid();
            boolean vaultBound=persistence.matchesCapturedOriginalSnapshot(all.get(VAULT),original);
            Map<String,String> providerStates=provider.inspectCapturedOriginalReferenceRows(principal,context,generation,all.get(PROVIDER),original.revision);
            JSONArray records=new JSONArray(),namespaces=new JSONArray(),families=new JSONArray();
            Map<String,Integer> familyCounts=new TreeMap<>();int count=0,boundVault=0,classifiedProvider=0;
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
                Map<String,?> raw=all.get(name);String family=NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name);
                familyCounts.merge(family,raw.size(),Integer::sum);
                namespaces.put(new JSONObject().put("namespace",name).put("key_family",family).put("record_count",raw.size())
                    .put("semantic_inventory_state","UNKNOWN").put("inventory_acknowledged",false).put("key_removal",false));
                for(var row:new TreeMap<>(raw).entrySet()){
                    requireTime(started);String state="NATIVE_ROW_SEMANTICS_UNRESOLVED_RETAINED";
                    if(VAULT.equals(name)&&SNAPSHOT.equals(row.getKey())&&vaultBound){
                        state="EXACT_ORIGINAL_OWNING_VAULT_SNAPSHOT_CODEC_BYTES_BOUND";boundVault++;
                    }else if(PROVIDER.equals(name)){
                        state=providerStates.get(row.getKey());if(state==null)throw invalid();
                        if(!state.contains("UNRESOLVED"))classifiedProvider++;
                    }
                    records.put(new JSONObject().put("namespace",name).put("key_family",family)
                        .put("raw_identity_sha256",NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,row.getKey(),row.getValue()))
                        .put("state",state).put("inventory_acknowledged",false).put("key_removal",false));count++;
                }
            }
            for(var family:familyCounts.entrySet())families.put(new JSONObject().put("key_family",family.getKey())
                .put("source_declared_raw_rows_to_preserve",family.getValue()).put("possible_undeclared_references","UNKNOWN")
                .put("zero_rows_is_not_key_removal_authority",true).put("current_server_reconciliation",false)
                .put("finalizer_allowed",false).put("key_removal",false));
            JSONObject value=new JSONObject().put("schema","custodial.native-vault-provider-reference-census.v1")
                .put("state","ORIGINAL_VAULT_AND_BOUNDED_PROVIDER_SOURCE_REFERENCES_NOT_COMPLETE_SEMANTICS")
                .put("source_capture_sha256",captureDigest).put("original_generation_id",generation.generationId)
                .put("principal_digest",principal.digest).put("engine_revision",original.revision)
                .put("owning_vault_snapshot_bound",vaultBound).put("provider_reference_states_are_local_only",true)
                .put("namespaces",namespaces).put("records",records).put("key_family_references",families)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("complete_namespace_inventory",false).put("all_writer_durable_freeze_or_ABA_guard",false)
                .put("current_server_readback",false).put("clock_profile_qualified",false).put("inventory_acknowledged",false)
                .put("work_accepted",false).put("new_work_allowed",false).put("resend_allowed",false)
                .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
            Observation result=new Observation(value,count,boundVault,classifiedProvider);requireTime(started);return result;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static void requireTime(long started) throws VaultFailure {if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure("custodial_native_vault_provider_census_unknown");}
}
