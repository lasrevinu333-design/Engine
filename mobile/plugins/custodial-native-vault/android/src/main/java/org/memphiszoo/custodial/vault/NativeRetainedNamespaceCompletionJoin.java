package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Original all8 lossless row closure joined to the existing owning native
 * completion/session/signature census. Native v3 and fixed-read values retain
 * their provenance; legacy browser bindings remain source-unverified and
 * unaccepted. Corrupt/orphan/ambiguous rows stay unresolved. This is an
 * ADDITIVE semantic observation, never a replacement of saved capsule/layout
 * identities, current server reconciliation, eligibility, acceptance or key
 * retirement. Browser candidate metadata never authenticates its source. */
final class NativeRetainedNamespaceCompletionJoin {
    static final String SCHEMA="custodial.native-all8-original-completion-reconciliation.v1";
    static final String FAILURE="custodial_native_all8_completion_reconciliation_unknown";
    private static final String RECEIPT="ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE",
        PAIR="ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY";
    private static final String[] DENIED={"complete_namespace_inventory","current_server_readback","cutoff_eligible",
        "work_accepted","inventory_acknowledged","key_removal","phone_released","browser_source_authenticated"};
    static final class Observation {
        final int recordCount,completionJoinedRecordCount,matchedCompletionCount;
        private final String encoded;
        private Observation(JSONObject value,int records,int joined,int matched)throws VaultFailure {
            recordCount=records;completionJoinedRecordCount=joined;matchedCompletionCount=matched;encoded=value.toString();
            if(encoded.length()>16*1024*1024)throw invalid();
        }
        JSONObject json()throws VaultFailure{try{return new JSONObject(encoded);}catch(Exception error){throw invalid();}}
    }
    static Observation inspect(Map<String,Map<String,?>> raw,String captureDigest,NativeRetainedWorkCapture work,
        NativeRetainedNamespaceValues values,NativeRetainedNamespaceSemanticJoin.Observation source,
        NativeRetainedCompletionCensus.Observation completions,NativeSeparationEvidence proof,
        NativeProviderPrincipal principal,long revision,String generation)throws VaultFailure {
        try {
            long started=System.nanoTime();
            if(raw==null||work==null||values==null||source==null||completions==null||proof==null||principal==null
                ||!raw.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                ||!values.matchesOriginal(raw,captureDigest)||!NativeProtectedWorkSnapshot.exactRawEquals(
                    raw.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
            JSONObject s=source.json(),c=completions.json();NativeProtectedWorkSnapshot snapshot=work.values.snapshot();
            if(!NativeRetainedNamespaceSemanticJoin.SCHEMA.equals(text(s,"schema"))
                ||!captureDigest.equals(text(s,"source_capture_sha256"))||!values.valuesSha256.equals(text(s,"values_sha256"))
                ||!source.joinSha256.equals(text(s,"semantic_join_sha256"))||!principal.digest.equals(text(s,"principal_digest"))
                ||!generation.equals(text(s,"original_generation_id"))||revision!=integer(s,"engine_revision")
                ||!work.values.sha256.equals(text(s,"original_frozen_work_sha256"))
                ||!"custodial.native-frozen-completion-census.v1".equals(text(c,"schema"))
                ||!snapshot.digest.equals(proof.rawSnapshotDigest)||!snapshot.digest.equals(text(c,"raw_snapshot_sha256"))
                ||!proof.bodySha256.equals(text(c,"signed_manifest_sha256"))||integer(c,"record_count")!=snapshot.recordCount
                )throw invalid();
            JSONArray candidates=argumentCandidates(c,completions);
            for(String flag:DENIED)if(!Boolean.FALSE.equals(c.get(flag)))throw invalid();
            for(String flag:new String[]{"complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard",
                "current_server_readback","durable_retention","inventory_acknowledged","work_accepted","resend_allowed",
                "finalizer_allowed","key_removal","phone_released"})if(!Boolean.FALSE.equals(s.get(flag)))throw invalid();
            if(!"UNKNOWN".equals(c.get("native_semantic_inventory_state"))||!"UNKNOWN".equals(c.get("browser_inventory_state")))throw invalid();
            Map<String,JSONObject> sourceRows=sourceRows(s,raw);Map<String,JSONObject> byWorkIdentity=new HashMap<>();
            JSONArray censusRows=c.getJSONArray("records"),identities=snapshot.recordRows();
            for(int i=0;i<censusRows.length();i++){
                JSONObject row=censusRows.getJSONObject(i);String id=text(row,"raw_identity_sha256");
                if(!id.matches("[a-f0-9]{64}")||!Boolean.FALSE.equals(row.get("automatic_acceptance"))
                    ||byWorkIdentity.put(id,row)!=null)throw invalid();
            }
            if(byWorkIdentity.size()!=snapshot.recordCount)throw invalid();
            Map<String,JSONObject> keyedWork=new TreeMap<>();int index=0,joined=0,matched=0;
            for(String key:new TreeSet<>(work.original.keySet())){
                requireTime(started);JSONObject row=byWorkIdentity.remove(NativeProviderPrincipal.hash(identities.getJSONArray(index++).toString()));
                if(row==null||!NativeProtectedWorkInventory.kind(key).equals(text(row,"kind")))throw invalid();
                String state=text(row,"state");if(!state.matches("[A-Z0-9_]{1,160}"))throw invalid();
                if(RECEIPT.equals(state)){
                    if(!key.startsWith(NativeRetainedCompletionCensus.RECEIPT)||!Set.of("CAPTURED_NATIVE_ORIGINAL_V3_VALUES",
                        "CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN",
                        "BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE").contains(text(row,"argument_provenance")))throw invalid();
                    for(String hash:new String[]{"argument_values_sha256","receipt_binding_sha256"})
                        if(!text(row,hash).matches("[a-f0-9]{64}"))throw invalid();
                    for(String relation:new String[]{"start_cutoff_relation","finish_cutoff_relation"})
                        if(!Set.of("BEFORE","EQUAL","AFTER").contains(text(row,relation)))throw invalid();
                    joined++;matched++;
                }else if(PAIR.equals(state)){
                    if(!key.matches("(?:offline_occurrence_sha256:|offline_finish_proof_sha256:)[a-f0-9]{64}"))throw invalid();joined++;
                }
                keyedWork.put(key,row);
            }
            if(!byWorkIdentity.isEmpty()||joined!=3*matched||matched!=completions.matchedCompletionCount
                ||joined!=completions.completionJoinedRecordCount||matched!=integer(c,"matched_completion_count")
                ||joined!=integer(c,"completion_joined_record_count")||snapshot.recordCount-joined!=integer(c,"unresolved_record_count"))throw invalid();
            MessageDigest hash=MessageDigest.getInstance("SHA-256");
            for(String pin:new String[]{SCHEMA,captureDigest,values.valuesSha256,source.joinSha256,proof.bodySha256,
                principal.digest,generation,Long.toString(revision)})hashText(hash,pin);
            JSONArray rows=new JSONArray();int count=0;
            for(String namespace:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())for(var entry:new TreeMap<>(raw.get(namespace)).entrySet()){
                requireTime(started);String id=NativeProtectedNamespaceObservation.retainedCensusRowIdentity(namespace,entry.getKey(),entry.getValue());
                JSONObject row=sourceRows.remove(namespace+"\u0000"+id);if(row==null)throw invalid();
                String state=localJournalDisposition(namespace,row);
                if(NativeRetainedNamespaceCensus.WORK.equals(namespace)){
                    if(NativeRetainedWorkCapture.FENCE.equals(entry.getKey()))state="ORIGINAL_AUTHENTICATED_WORK_FREEZE_MARKER_RETAINED";
                    else{JSONObject completion=keyedWork.remove(entry.getKey());if(completion==null)throw invalid();state=text(completion,"state");
                        row.put("native_completion_semantics",completion);}
                }
                row.put("application_semantic_disposition",state).put("cutoff_eligible",false).put("browser_source_authenticated",false);
                hashText(hash,namespace);hashText(hash,id);hashText(hash,state);
                if(row.has("native_completion_semantics")){
                    JSONObject completion=row.getJSONObject("native_completion_semantics");
                    Set<String> fields=new TreeSet<>();completion.keys().forEachRemaining(fields::add);
                    for(String field:fields){hashText(hash,field);hashText(hash,completion.get(field).toString());}
                }
                rows.put(row);count++;
            }
            if(!sourceRows.isEmpty()||!keyedWork.isEmpty()||count!=values.recordCount||count!=source.recordCount)throw invalid();
            // Empty-candidate output and hash remain exactly the original v1.
            // Nonempty ordered metadata is retained, not source authentication.
            if(candidates.length()>0){
                hashText(hash,"browser_argument_candidates.v1");
                hashText(hash,Long.toString(integer(c,"argument_candidate_count")));
                hashText(hash,Long.toString(integer(c,"unresolved_argument_candidate_count")));
                for(int i=0;i<candidates.length();i++){
                    JSONObject candidate=candidates.getJSONObject(i);
                    hashText(hash,text(candidate,"argument_values_sha256"));hashText(hash,text(candidate,"state"));hashText(hash,"false");
                }
            }
            StringBuilder hexadecimal=new StringBuilder(64);for(byte b:hash.digest())hexadecimal.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));
            String digest=hexadecimal.toString();
            JSONObject result=new JSONObject().put("schema",SCHEMA).put("state","ALL8_EXACT_ROWS_WITH_ORIGINAL_NATIVE_COMPLETION_SEMANTICS_NOT_ACCEPTANCE")
                .put("source_capture_sha256",captureDigest).put("values_sha256",values.valuesSha256).put("original_source_join_sha256",source.joinSha256)
                .put("completion_reconciliation_sha256",digest).put("original_signed_manifest_sha256",proof.bodySha256)
                .put("original_generation_id",generation).put("principal_digest",principal.digest).put("engine_revision",revision)
                .put("record_count",count).put("completion_semantic_joined_record_count",joined).put("matched_completion_count",matched)
                .put("application_unresolved_record_count",count-joined).put("records",rows).put("namespaces",s.getJSONArray("namespaces"))
                .put("key_family_references",s.getJSONArray("key_family_references")).put("original_work_journal_chunks",s.getJSONArray("original_work_journal_chunks"))
                .put("saved_source_join_layout_capsule_identity_rewritten",false).put("native_semantic_inventory_state","UNKNOWN")
                .put("browser_inventory_state","UNKNOWN").put("historical_snapshot_principal_verified",false).put("clock_profile_qualified",false)
                .put("durable_retention",false).put("all_writer_durable_freeze_or_ABA_guard",false).put("resend_allowed",false)
                .put("new_work_allowed",false).put("finalizer_allowed",false);
            for(String flag:DENIED)result.put(flag,false);
            if(candidates.length()>0)result.put("argument_candidate_count",candidates.length())
                .put("unresolved_argument_candidate_count",completions.unresolvedCandidateCount).put("argument_candidates",candidates);
            if(!values.matchesOriginal(raw,captureDigest))throw invalid();requireTime(started);return new Observation(result,count,joined,matched);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static JSONArray argumentCandidates(JSONObject census,NativeRetainedCompletionCensus.Observation original)throws Exception {
        long count=integer(census,"argument_candidate_count"),unresolved=integer(census,"unresolved_argument_candidate_count");
        if(count>NativeRetainedCompletionCensus.MAX_CANDIDATES||unresolved>count||unresolved!=original.unresolvedCandidateCount)throw invalid();
        Object value=census.get("argument_candidates");if(!(value instanceof JSONArray))throw invalid();
        JSONArray rows=(JSONArray)value;if(rows.length()!=count)throw invalid();int actualUnresolved=0;
        for(int i=0;i<rows.length();i++){
            Object valueRow=rows.get(i);if(!(valueRow instanceof JSONObject))throw invalid();JSONObject row=(JSONObject)valueRow;
            if(row.length()!=3||!text(row,"argument_values_sha256").matches("[a-f0-9]{64}")
                ||!Boolean.FALSE.equals(row.get("source_authenticated")))throw invalid();
            String state=text(row,"state");
            if(!Set.of("UNMATCHED_ARGUMENT_CANDIDATE_RETAINED","UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED",
                "AMBIGUOUS_ARGUMENT_CANDIDATE_RETAINED","ARGUMENT_VALUES_MISMATCH_RETAINED",
                "NATIVE_COMPLETION_UNRESOLVED_RETAINED","AMBIGUOUS_SESSION_ARGUMENT_RETAINED",
                "ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE").contains(state))throw invalid();
            if(!"ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE".equals(state))actualUnresolved++;
        }
        if(actualUnresolved!=unresolved)throw invalid();return rows;
    }
    /** Preserve only the owning typed source join's exact local journal facts.
     * These remain unresolved for completion counts and confer no authority. */
    private static String localJournalDisposition(String namespace,JSONObject row)throws Exception {
        if(Boolean.TRUE.equals(row.get("local_source_classified"))){
            String state=text(row,"local_source_classification");
            if(state.equals(text(row,"journal_source_state"))){
                if(NativeRetainedNamespaceCensus.WRITE.equals(namespace)
                    &&"ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED".equals(state))return state;
                if((NativeRetainedNamespaceCensus.QUERY.equals(namespace)||NativeRetainedNamespaceCensus.BATCH.equals(namespace))
                    &&Set.of("ORIGINAL_QUERY_HMAC_VALID_CACHED_OUTCOME_UNKNOWN","CACHED_ORIGINAL_TARGET_WITNESS_LOCAL_ONLY").contains(state))return state;
                if(NativeRetainedNamespaceCensus.BATCH.equals(namespace)
                    &&"ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT".equals(state))return state;
                if(NativeRetainedNamespaceCensus.BATCH.equals(namespace)
                    &&"ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED".equals(state))return state;
            }
        }
        return "UNRECONCILED_RECORD_RETAINED";
    }
    private static Map<String,JSONObject> sourceRows(JSONObject source,Map<String,Map<String,?>> raw)throws Exception {
        Map<String,JSONObject> result=new TreeMap<>();JSONArray rows=source.getJSONArray("records");
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);String namespace=text(row,"namespace"),id=text(row,"raw_identity_sha256");
            if(!raw.containsKey(namespace)||!id.matches("[a-f0-9]{64}")
                ||!NativeProtectedNamespaceObservation.KEY_FAMILIES.get(namespace).equals(text(row,"key_family"))
                ||!"UNKNOWN_RETAINED".equals(text(row,"application_semantic_disposition")))throw invalid();
            for(String flag:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal"})
                if(!Boolean.FALSE.equals(row.get(flag)))throw invalid();
            if(result.put(namespace+"\u0000"+id,row)!=null)throw invalid();
        }
        if(result.size()!=integer(source,"record_count"))throw invalid();return result;
    }
    private static long integer(JSONObject value,String key)throws Exception {Object raw=value.get(key);if(!(raw instanceof Integer||raw instanceof Long))throw invalid();long n=((Number)raw).longValue();if(n<0)throw invalid();return n;}
    private static String text(JSONObject value,String key)throws Exception {Object raw=value.get(key);if(!(raw instanceof String))throw invalid();return (String)raw;}
    private static void hashText(MessageDigest hash,String value){int n=value.length();for(int shift=24;shift>=0;shift-=8)hash.update((byte)(n>>>shift));for(int i=0;i<n;i++){char c=value.charAt(i);hash.update((byte)(c>>>8));hash.update((byte)c);}}
    private static void requireTime(long started)throws VaultFailure {if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
