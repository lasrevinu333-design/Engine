package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED typed source census, not complete protected-data semantics.
 * Every captured native row is represented. Only the three owning retained
 * journals are decoded, using their EXISTING cipher/AAD and exact original
 * owner, frozen WORK values, generation, bodies/HMACs and query witnesses.
 * Vault/provider/legacy and WORK record semantics remain UNKNOWN; repeated
 * memory reads are not durable disk custody, atomic freeze or ABA protection.
 * No writer/recovery/transport/signer/key/delete/ACK endpoint is provided.
 */
final class NativeRetainedNamespaceCensus {
    static final String WORK="MemphisZooCustodialOfflineAuthorityTimeV1";
    static final String WRITE="MemphisZooCustodialRetainedAttemptV1";
    static final String QUERY="MemphisZooCustodialRetainedReadQueryV1";
    static final String BATCH="MemphisZooCustodialRetainedBatchV1";
    static final String SCHEMA="custodial.native-retained-namespace-census.v1";
    private static final int MAX_DIAGNOSTIC_CHARACTERS=8*1024*1024;
    static final class Observation {
        final int recordCount,chunkCount,originalWriteCount,originalQueryCount,cachedObservationCount,unresolvedChunkCount;
        final boolean completeNamespaceInventory=false,currentServerReadback=false,workAccepted=false,
            inventoryAcknowledged=false,keyRemovalAllowed=false,phoneReleased=false,resendAllowed=false;
        private final String encoded;
        private Observation(JSONObject value,int records,List<Chunk> chunks) throws Exception {
            recordCount=records;chunkCount=chunks.size();int writes=0,queries=0,cached=0,unresolved=0;
            for(Chunk chunk:chunks){if(chunk.write)writes++;if(chunk.query)queries++;if(chunk.cached)cached++;if(!chunk.joined())unresolved++;}
            originalWriteCount=writes;originalQueryCount=queries;cachedObservationCount=cached;unresolvedChunkCount=unresolved;
            value.put("record_count",records).put("chunk_count",chunkCount).put("original_write_count",writes)
                .put("original_query_count",queries).put("cached_observation_count",cached).put("unresolved_chunk_count",unresolved)
                .put("all_fixed_chunks_have_original_cached_observations",!chunks.isEmpty()&&unresolved==0);
            encoded=value.toString();if(encoded.length()>MAX_DIAGNOSTIC_CHARACTERS)throw invalid();
        }
        JSONObject json() throws VaultFailure {try{return new JSONObject(encoded);}catch(Exception error){throw invalid();}}
    }
    private static final class Chunk {
        final int index;
        String state="ORIGINAL_WRITE_MISSING_CACHED_OUTCOME_UNKNOWN",writeState="MISSING",queryState="MISSING",
            writeId,queryId,writeHash,queryHash,cachedStatus="UNKNOWN";
        boolean write,query,cached,ambiguous;
        Chunk(int index){this.index=index;}
        boolean joined(){return write&&query&&cached&&!ambiguous&&!"OUTCOME_UNKNOWN".equals(cachedStatus);}
        JSONObject json() throws Exception {
            return new JSONObject().put("chunk_index",index).put("state",state).put("write_journal_state",writeState)
                .put("query_journal_state",queryState).put("original_write_hmac_validated",write)
                .put("original_target_query_hmac_validated",query).put("cached_original_observation_validated",cached)
                .put("ambiguous_request_identity",ambiguous).put("cached_status",cachedStatus)
                .put("original_write_request_id",writeId==null?JSONObject.NULL:writeId)
                .put("original_query_request_id",queryId==null?JSONObject.NULL:queryId)
                .put("original_write_body_sha256",writeHash==null?JSONObject.NULL:writeHash)
                .put("original_query_body_sha256",queryHash==null?JSONObject.NULL:queryHash)
                .put("current_server_readback",false).put("resend_allowed",false).put("work_accepted",false);
        }
    }
    static Observation inspect(Map<String,Map<String,?>> all,String captureDigest,NativeRetainedWorkCapture capture,
        NativeProviderPrincipal principal,long revision,String originalGeneration,NativeRetainedBatchJournal journal,
        char[] credential) throws VaultFailure {
        try {
            final long started=System.nanoTime();
            if(all==null||!all.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                ||capture==null||principal==null||journal==null||credential==null||originalGeneration==null)throw invalid();
            NativeRetainedBatchJournal.Manifest manifest=null;
            String manifestState=all.get(BATCH).isEmpty()?"EMPTY_NO_BATCH_OWNER":"BATCH_OWNER_UNRESOLVED_RETAINED";
            try {
                manifest=journal.observeCaptured(all.get(BATCH),capture,principal,revision);
                if(manifest!=null){
                    if(!originalGeneration.equals(manifest.generationId))throw invalid();
                    manifestState="ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT";
                }
            } catch(VaultFailure unresolved) {manifest=null;}
            // An invalid/absent manifest does not invent later slots or erase
            // their raw rows. Chunk zero can only be joined with a VALID owning
            // manifest; every invalid batch row remains explicitly unresolved.
            List<Chunk> chunks=new ArrayList<>();
            if(manifest!=null)for(int index=0;index<manifest.count;index++){
                requireTime(started);chunks.add(inspectChunk(index,manifest,journal,capture,principal,revision,credential,all));
            }
            Map<String,Integer> uses=new HashMap<>();
            for(Chunk chunk:chunks){if(chunk.writeId!=null)uses.merge(chunk.writeId,1,Integer::sum);if(chunk.queryId!=null)uses.merge(chunk.queryId,1,Integer::sum);}
            for(Chunk chunk:chunks)if((chunk.writeId!=null&&uses.get(chunk.writeId)>1)||(chunk.queryId!=null&&uses.get(chunk.queryId)>1)){
                chunk.ambiguous=true;chunk.state="AMBIGUOUS_ORIGINAL_REQUEST_IDENTITIES_RETAINED";
            }
            JSONArray rows=new JSONArray(),namespaces=new JSONArray(),chunkRows=new JSONArray();int count=0;
            for(Chunk chunk:chunks)chunkRows.put(chunk.json());
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
                Map<String,?> values=all.get(name);
                namespaces.put(new JSONObject().put("namespace",name).put("key_family",NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name))
                    .put("record_count",values.size()).put("semantic_inventory_state","UNKNOWN")
                    .put("empty_is_not_absence_or_key_removal_authority",true));
                for(var entry:new TreeMap<>(values).entrySet()){
                    requireTime(started);
                    String state="NAMESPACE_SEMANTICS_UNRESOLVED_RETAINED";
                    if(WORK.equals(name))state="ORIGINAL_FROZEN_WORK_ROW_BOUND_SEMANTICS_UNRESOLVED";
                    else if(BATCH.equals(name)){
                        if(manifest==null)state="BATCH_OWNER_UNRESOLVED_RETAINED";
                        else if(NativeRetainedBatchJournal.INDEX.equals(entry.getKey()))state=manifestState;
                        else state=batchRowState(entry.getKey(),chunks);
                    }else if(WRITE.equals(name)||QUERY.equals(name)){
                        if(manifest!=null)state=chunkRowState(chunks.get(0),QUERY.equals(name));
                        else state="UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED";
                    }
                    rows.put(new JSONObject().put("namespace",name).put("key_family",NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name))
                        .put("raw_identity_sha256",NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,entry.getKey(),entry.getValue()))
                        .put("raw_type",rawType(entry.getValue())).put("state",state)
                        .put("inventory_acknowledged",false).put("key_removal",false));count++;
                }
            }
            JSONObject value=new JSONObject().put("schema",SCHEMA).put("state","READ_ONLY_ORIGINAL_JOURNAL_SOURCE_JOIN_OTHER_SEMANTICS_UNRESOLVED")
                .put("source_capture_sha256",captureDigest).put("original_generation_id",originalGeneration)
                .put("principal_digest",principal.digest).put("engine_revision",revision).put("batch_owner_state",manifestState)
                .put("batch_operation_id",manifest==null?JSONObject.NULL:manifest.operationId)
                .put("namespaces",namespaces).put("records",rows).put("chunks",chunkRows)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("complete_namespace_inventory",false).put("current_server_readback",false)
                .put("cached_observations_are_historical_local_only",true).put("all_writer_durable_freeze_or_ABA_guard",false)
                .put("clock_profile_qualified",false).put("inventory_acknowledged",false).put("work_accepted",false)
                .put("new_work_allowed",false).put("resend_allowed",false).put("absence_proves_no_late_commit",false)
                .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
            Observation result=new Observation(value,count,chunks);requireTime(started);return result;
        } catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static Chunk inspectChunk(int index,NativeRetainedBatchJournal.Manifest manifest,NativeRetainedBatchJournal journal,
        NativeRetainedWorkCapture capture,NativeProviderPrincipal principal,long revision,char[] credential,
        Map<String,Map<String,?>> all) {
        Chunk chunk=new Chunk(index);
        try {
            var writes=journal.writes(manifest,index);var reads=journal.reads(manifest,index);
            Map<String,?> writeRaw=index==0?all.get(WRITE):slot(all.get(BATCH),false,index);
            Map<String,?> queryRaw=index==0?all.get(QUERY):slot(all.get(BATCH),true,index);
            NativeRetainedAttemptJournal.Observation observed=writes.observeCaptured(writeRaw);
            if(observed==null){
                if(!queryRaw.isEmpty())chunk.state="ORPHAN_QUERY_WITHOUT_ORIGINAL_WRITE_RETAINED";
                return chunk;
            }
            chunk.writeState=observed.state;
            try(var target=NativeRetainedAttempt.restore(observed.record(),capture.values,principal,revision,credential)){
                if(target.chunkIndex()!=index||!manifest.operationId.equals(target.operationId)||!manifest.generationId.equals(target.generationId)
                    ||!manifest.wireHash.equals(target.wireSha256))throw invalid();
                chunk.write=true;chunk.writeId=target.requestId;chunk.writeHash=target.bodySha256;
                chunk.state="ORIGINAL_WRITE_HMAC_VALID_QUERY_MISSING_OUTCOME_UNKNOWN";
                NativeRetainedQueryJournal.Observation queried=reads.observeCaptured(queryRaw);
                if(queried==null)return chunk;
                chunk.queryState=queried.state;
                try(var query=NativeRetainedReadQuery.restore(queried.record(),target,principal,revision,credential)){
                    chunk.query=true;chunk.queryId=query.requestId;chunk.queryHash=query.bodySha256;
                    chunk.state="ORIGINAL_TARGET_QUERY_HMAC_VALID_CACHED_OUTCOME_UNKNOWN";
                    if(!NativeRetainedQueryJournal.OBSERVED.equals(queried.state))return chunk;
                    JSONObject cached=NativeRetainedReadbackEvidence.validateStoredObservation(query,queried);
                    chunk.cachedStatus=cached.getString("status");chunk.cached=true;
                    chunk.state="OUTCOME_UNKNOWN".equals(chunk.cachedStatus)?"CACHED_ORIGINAL_OUTCOME_UNKNOWN_NOT_ABSENCE":
                        "ORIGINAL_HMAC_AND_CACHED_LOCAL_WITNESS_JOINED_NOT_CURRENT_SERVER";
                }
            }
        }catch(Exception unresolved){chunk.state="ORIGINAL_JOURNAL_BINDING_UNRESOLVED_RETAINED";}
        return chunk;
    }
    private static Map<String,?> slot(Map<String,?> all,boolean query,int index) {
        // Called ONLY after the owning batch validates the COMPLETE raw layout.
        String prefix=(query?"query:":"write:")+index+":";Map<String,Object> rows=new TreeMap<>();
        for(var entry:all.entrySet())if(entry.getKey().startsWith(prefix))rows.put(entry.getKey().substring(prefix.length()),entry.getValue());
        return rows;
    }
    private static String batchRowState(String key,List<Chunk> chunks) throws VaultFailure {
        String[] parts=key.split(":",3);
        if(parts.length!=3||(!"write".equals(parts[0])&&!"query".equals(parts[0])))throw invalid();
        try {int index=Integer.parseInt(parts[1]);if(index<=0||index>=chunks.size())throw invalid();
            return chunkRowState(chunks.get(index),"query".equals(parts[0]));
        }catch(NumberFormatException error){throw invalid();}
    }
    private static String chunkRowState(Chunk chunk,boolean query) {
        if(chunk.ambiguous)return "AMBIGUOUS_ORIGINAL_REQUEST_IDENTITIES_RETAINED";
        if(query)return chunk.cached?"CACHED_ORIGINAL_TARGET_WITNESS_LOCAL_ONLY":chunk.query?
            "ORIGINAL_QUERY_HMAC_VALID_CACHED_OUTCOME_UNKNOWN":"QUERY_ROWS_UNRESOLVED_RETAINED";
        return chunk.write?"ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED":"WRITE_ROWS_UNRESOLVED_RETAINED";
    }
    private static String rawType(Object value) throws VaultFailure {
        if(value instanceof String)return "STRING";if(value instanceof Integer)return "INTEGER";
        if(value instanceof Long)return "LONG";if(value instanceof Boolean)return "BOOLEAN";if(value instanceof Float)return "FLOAT_RAW_BITS";
        if(value instanceof Set<?>)return "STRING_SET";throw invalid();
    }
    private static void requireTime(long started) throws VaultFailure {
        if(System.nanoTime()-started>30_000_000_000L)throw invalid();
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_native_retained_namespace_census_unknown");}
}
