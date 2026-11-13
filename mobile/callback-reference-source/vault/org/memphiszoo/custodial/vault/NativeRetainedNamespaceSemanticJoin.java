package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED original-owner source join. The exact lossless volatile values,
 * journal witnesses and existing vault/provider classifiers must describe the
 * SAME original eight-domain capture. Every raw row gets one joined record;
 * unknown/legacy/corrupt rows are retained, never inferred absent or accepted.
 * This does NOT implement server custody, complete application semantics,
 * browser inventory, all-writer freeze/ABA, ACK, transport or key retirement.
 * No caller-supplied JSON, raw getter or generic callback is an input seam.
 */
final class NativeRetainedNamespaceSemanticJoin {
    static final String SCHEMA="custodial.native-retained-eight-namespace-semantic-join.v1";
    static final String FAILURE="custodial_native_retained_namespace_semantic_join_unknown";
    private static final String[] DENIED={"complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard",
        "current_server_readback","clock_profile_qualified","inventory_acknowledged","work_accepted",
        "new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"};
    /** Detached structural source data only. Even source-classified rows are
     * unresolved application semantics, never acceptance or effect authority. */
    static final class OriginalRecord {
        final String namespace,keyFamily,rawKey,rawType,rawIdentitySha256;
        final String journalSourceState,vaultProviderSourceState,localSourceClassification;
        final boolean sourceClassified;
        final String semanticDisposition="UNRESOLVED_RETAINED";
        private OriginalRecord(String namespace,String family,String key,String type,String identity,
            String journal,String references,String local,boolean classified){
            this.namespace=namespace;keyFamily=family;rawKey=key;rawType=type;rawIdentitySha256=identity;
            journalSourceState=journal;vaultProviderSourceState=references;localSourceClassification=local;sourceClassified=classified;
        }
    }
    static final class Observation {
        final int recordCount,sourceClassifiedCount,unresolvedCount;
        final String sourceCaptureSha256,valuesSha256,joinSha256,principalDigest,originalGenerationId;
        final long engineRevision;
        final boolean semanticInventoryComplete=false,durable=false,currentServerReadback=false,
            workAccepted=false,inventoryAcknowledged=false,resendAllowed=false,finalizerAllowed=false,keyRemovalAllowed=false;
        private final String encoded;
        private final java.util.List<OriginalRecord> originals;
        private Observation(JSONObject value,int count,int classified,String capture,String values,String digest,
            String principal,String generation,long revision,java.util.List<OriginalRecord> originals) throws Exception {
            recordCount=count;sourceClassifiedCount=classified;unresolvedCount=count-classified;
            sourceCaptureSha256=capture;valuesSha256=values;joinSha256=digest;
            principalDigest=principal;originalGenerationId=generation;engineRevision=revision;
            this.originals=java.util.List.copyOf(originals);if(this.originals.size()!=count)throw invalid();
            encoded=value.toString();if(encoded.length()>16*1024*1024)throw invalid();
        }
        java.util.List<OriginalRecord> originalRecords(){return originals;}
        JSONObject json() throws VaultFailure {try{return new JSONObject(encoded);}catch(Exception error){throw invalid();}}
    }
    static Observation inspect(Map<String,Map<String,?>> raw,String captureDigest,NativeRetainedNamespaceValues values,
        NativeRetainedWorkCapture work,NativeProviderPrincipal principal,long revision,String generation,
        NativeRetainedNamespaceCensus.Observation journal,NativeVaultProviderReferenceCensus.Observation references) throws VaultFailure {
        try {
            long started=System.nanoTime();
            if(raw==null||values==null||work==null||principal==null||journal==null||references==null
                ||!raw.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                ||!values.matchesOriginal(raw,captureDigest)||values.recordCount!=journal.recordCount
                ||values.recordCount!=references.recordCount)throw invalid();
            JSONObject j=journal.json(),v=references.json();
            binding(j,NativeRetainedNamespaceCensus.SCHEMA,captureDigest,principal.digest,revision,generation);
            binding(v,"custodial.native-vault-provider-reference-census.v1",captureDigest,principal.digest,revision,generation);
            if(!Boolean.TRUE.equals(v.get("owning_vault_snapshot_bound")))throw invalid();
            Map<String,JSONObject> jr=rows(j,raw),vr=rows(v,raw);
            JSONArray records=new JSONArray(),names=new JSONArray(),families=new JSONArray();
            java.util.List<OriginalRecord> originals=new java.util.ArrayList<>();
            Map<String,Integer> familyCounts=new TreeMap<>();int count=0,classified=0;
            MessageDigest hash=MessageDigest.getInstance("SHA-256");
            text(hash,SCHEMA);text(hash,captureDigest);text(hash,values.valuesSha256);text(hash,work.values.sha256);
            text(hash,principal.digest);text(hash,generation);text(hash,Long.toString(revision));
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
                requireTime(started);Map<String,?> source=raw.get(name);String family=NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name);
                if(source==null||values.recordCounts.get(name)==null||values.recordCounts.get(name)!=source.size())throw invalid();
                familyCounts.merge(family,source.size(),Integer::sum);text(hash,name);text(hash,Integer.toString(source.size()));
                names.put(new JSONObject().put("namespace",name).put("key_family",family).put("record_count",source.size())
                    .put("semantic_inventory_state","UNKNOWN").put("durable_retention",false).put("empty_is_not_key_removal_authority",true));
                for(var row:new TreeMap<>(source).entrySet()){
                    requireTime(started);String identity=NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,row.getKey(),row.getValue());
                    String key=key(name,identity);JSONObject a=jr.remove(key),b=vr.remove(key);if(a==null||b==null)throw invalid();
                    String jt=state(a),vt=state(b),type=primitive(a,"raw_type");if(!type.equals(rawType(row.getValue())))throw invalid();
                    String local=NativeVaultProviderReferenceCensus.VAULT.equals(name)||NativeVaultProviderReferenceCensus.PROVIDER.equals(name)?vt:
                        NativeRetainedNamespaceCensus.WORK.equals(name)||NativeRetainedNamespaceCensus.WRITE.equals(name)
                        ||NativeRetainedNamespaceCensus.QUERY.equals(name)||NativeRetainedNamespaceCensus.BATCH.equals(name)?jt:vt;
                    // A readable retained WRITE/QUERY row is not source-bound
                    // when its original batch manifest failed validation. Its
                    // owning census explicitly says UNBOUND (not UNRESOLVED);
                    // do not count that spelling as a classified witness.
                    boolean sourceKnown=!local.contains("UNRESOLVED")
                        &&!"UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED".equals(local);
                    if(sourceKnown)classified++;
                    originals.add(new OriginalRecord(name,family,row.getKey(),type,identity,jt,vt,local,sourceKnown));
                    text(hash,identity);text(hash,type);text(hash,jt);text(hash,vt);text(hash,local);
                    records.put(new JSONObject().put("namespace",name).put("key_family",family).put("raw_identity_sha256",identity)
                        .put("raw_type",type).put("journal_source_state",jt).put("vault_provider_source_state",vt)
                        .put("local_source_classification",local).put("local_source_classified",sourceKnown)
                        .put("application_semantic_disposition","UNKNOWN_RETAINED")
                        .put("current_server_readback",false).put("inventory_acknowledged",false).put("work_accepted",false)
                        .put("resend_allowed",false).put("finalizer_allowed",false).put("key_removal",false));count++;
                }
            }
            if(!jr.isEmpty()||!vr.isEmpty()||count!=values.recordCount)throw invalid();
            // Preserve each original fixed chunk/witness exactly. It refers to
            // the prior WORK wire, NOT the new eight-domain binary. Historical
            // cached readback must never attest new full-value server custody.
            JSONArray chunks=j.getJSONArray("chunks");
            text(hash,primitive(j,"batch_owner_state"));scalar(hash,j.get("batch_operation_id"));
            for(int i=0;i<chunks.length();i++){
                JSONObject chunk=chunks.getJSONObject(i);
                if(integral(chunk.get("chunk_index"))!=i)throw invalid();
                for(String field:new String[]{"chunk_index","state","write_journal_state","query_journal_state",
                    "original_write_hmac_validated","original_target_query_hmac_validated","cached_original_observation_validated",
                    "ambiguous_request_identity","cached_status","original_write_request_id","original_query_request_id",
                    "original_write_body_sha256","original_query_body_sha256"}){text(hash,field);scalar(hash,chunk.get(field));}
                for(String flag:new String[]{"current_server_readback","resend_allowed","work_accepted"})
                    if(!Boolean.FALSE.equals(chunk.get(flag)))throw invalid();
            }
            for(var family:familyCounts.entrySet())families.put(new JSONObject().put("key_family",family.getKey())
                .put("source_declared_raw_rows_to_preserve",family.getValue()).put("possible_undeclared_references","UNKNOWN")
                .put("all_writer_durable_freeze_or_ABA_guard",false).put("current_server_reconciliation",false)
                .put("zero_rows_is_not_key_removal_authority",true).put("finalizer_allowed",false).put("key_removal",false));
            String digest=hex(hash.digest());
            JSONObject result=new JSONObject().put("schema",SCHEMA).put("state","EXACT_ALL8_VALUES_AND_LOCAL_OWNER_SOURCE_CLASSIFICATIONS_JOINED_NOT_CUSTODY_OR_ACCEPTANCE")
                .put("source_capture_sha256",captureDigest).put("values_sha256",values.valuesSha256).put("semantic_join_sha256",digest)
                .put("original_frozen_work_sha256",work.values.sha256).put("original_generation_id",generation)
                .put("principal_digest",principal.digest).put("engine_revision",revision).put("record_count",count)
                .put("source_classified_record_count",classified).put("unresolved_source_record_count",count-classified)
                .put("namespaces",names).put("key_family_references",families).put("records",records)
                .put("original_work_journal_chunks",chunks).put("batch_owner_state",j.get("batch_owner_state"))
                .put("original_work_batch_operation_id",j.get("batch_operation_id"))
                .put("all_fixed_work_chunks_have_original_cached_observations",j.get("all_fixed_chunks_have_original_cached_observations"))
                .put("work_witnesses_do_not_cover_all8_values",true).put("cached_observations_are_historical_local_only",true)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("durable_retention",false).put("all8_backend_writer_bound",false).put("absence_proves_no_late_commit",false);
            for(String flag:DENIED)result.put(flag,false);
            Observation value=new Observation(result,count,classified,captureDigest,values.valuesSha256,digest,
                principal.digest,generation,revision,originals);
            if(!values.matchesOriginal(raw,captureDigest))throw invalid();requireTime(started);return value;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static void binding(JSONObject value,String schema,String capture,String principal,long revision,String generation) throws Exception {
        if(!schema.equals(primitive(value,"schema"))||!capture.equals(primitive(value,"source_capture_sha256"))
            ||!principal.equals(primitive(value,"principal_digest"))||!generation.equals(primitive(value,"original_generation_id"))
            ||revision!=integral(value.get("engine_revision"))||!"UNKNOWN".equals(value.get("native_semantic_inventory_state"))
            ||!"UNKNOWN".equals(value.get("browser_inventory_state")))throw invalid();
        for(String flag:DENIED)if(!Boolean.FALSE.equals(value.get(flag)))throw invalid();
    }
    private static Map<String,JSONObject> rows(JSONObject value,Map<String,Map<String,?>> raw) throws Exception {
        JSONArray source=value.getJSONArray("records"),names=value.getJSONArray("namespaces");
        Map<String,JSONObject> result=new TreeMap<>();Set<String> seen=new java.util.HashSet<>();
        if(names.length()!=8)throw invalid();
        for(int i=0;i<names.length();i++){
            JSONObject n=names.getJSONObject(i);String name=primitive(n,"namespace"),family=NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name);
            if(family==null||!seen.add(name)||!family.equals(primitive(n,"key_family"))
                ||integral(n.get("record_count"))!=raw.get(name).size()||!"UNKNOWN".equals(n.get("semantic_inventory_state")))throw invalid();
        }
        if(!seen.equals(raw.keySet())||integral(value.get("record_count"))!=source.length())throw invalid();
        for(int i=0;i<source.length();i++){
            JSONObject row=source.getJSONObject(i);String name=primitive(row,"namespace"),id=primitive(row,"raw_identity_sha256"),family=NativeProtectedNamespaceObservation.KEY_FAMILIES.get(name);
            if(family==null||!family.equals(primitive(row,"key_family"))||!id.matches("[a-f0-9]{64}")
                ||!Boolean.FALSE.equals(row.get("inventory_acknowledged"))||!Boolean.FALSE.equals(row.get("key_removal"))
                ||result.put(key(name,id),row)!=null)throw invalid();
        }
        return result;
    }
    private static String rawType(Object value) throws VaultFailure {if(value instanceof String)return "STRING";if(value instanceof Integer)return "INTEGER";
        if(value instanceof Long)return "LONG";if(value instanceof Boolean)return "BOOLEAN";if(value instanceof Float)return "FLOAT_RAW_BITS";
        if(value instanceof Set<?>)return "STRING_SET";throw invalid();}
    private static String primitive(JSONObject value,String key) throws Exception {Object text=value.get(key);if(!(text instanceof String))throw invalid();return (String)text;}
    private static String state(JSONObject row) throws Exception {String value=primitive(row,"state");if(!value.matches("[A-Z0-9_]{1,160}"))throw invalid();return value;}
    private static long integral(Object value) throws VaultFailure {if(!(value instanceof Integer||value instanceof Long))throw invalid();return ((Number)value).longValue();}
    private static String key(String name,String identity){return name+"\u0000"+identity;}
    private static void scalar(MessageDigest hash,Object value) throws VaultFailure {
        if(value==JSONObject.NULL){text(hash,"NULL");return;}if(value instanceof String){text(hash,"STRING");text(hash,(String)value);return;}
        if(value instanceof Boolean){text(hash,"BOOLEAN");text(hash,value.toString());return;}
        text(hash,"INTEGER");text(hash,Long.toString(integral(value)));
    }
    private static void text(MessageDigest hash,String value){int n=value.length();for(int shift=24;shift>=0;shift-=8)hash.update((byte)(n>>>shift));
        for(int i=0;i<n;i++){char c=value.charAt(i);hash.update((byte)(c>>>8));hash.update((byte)c);}}
    private static String hex(byte[] bytes){StringBuilder value=new StringBuilder(64);for(byte b:bytes){value.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));}return value.toString();}
    private static void requireTime(long started) throws VaultFailure {if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
