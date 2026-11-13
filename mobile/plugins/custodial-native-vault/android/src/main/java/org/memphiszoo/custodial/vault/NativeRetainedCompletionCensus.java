package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED completion census over EVERY row of an authenticated original
 * frozen work map. Native v3 values come from the exact captured encrypted
 * receipt, not reconstructed browser/header/wire evidence. Legacy v2 requires
 * an unambiguous supplied argument candidate and remains source-unauthenticated.
 * Other native stores, clock/snapshot principals, server acceptance and browser
 * admission/quiescence are NOT qualified here. Every unrelated/corrupt row and
 * orphan/duplicate candidate stays represented and unresolved. No writes,
 * transport, signature output, inventory ACK, finalizer or key authority.
 */
final class NativeRetainedCompletionCensus {
    static final String FAILURE="custodial_native_completion_census_unknown";
    static final String RECEIPT="authenticated_completion_receipt_sha256:";
    private static final String OCCURRENCE="offline_occurrence_sha256:",FINISH="offline_finish_proof_sha256:";
    static final int MAX_CANDIDATES=4096,MAX_TOTAL_BYTES=8*1024*1024;
    static final class Observation {
        private final String encoded;
        final int recordCount,matchedCompletionCount,completionJoinedRecordCount,unresolvedRecordCount,unresolvedCandidateCount;
        final boolean browserSourceAuthenticated=false,completeNamespaceInventory=false,currentServerReadback=false;
        final boolean cutoffEligible=false,workAccepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false,phoneReleased=false;
        private Observation(JSONObject value,int records,int matches,int covered,int unresolvedCandidates)throws VaultFailure {
            encoded=value.toString();if(encoded.length()>1048576)throw invalid();
            recordCount=records;matchedCompletionCount=matches;completionJoinedRecordCount=covered;
            unresolvedRecordCount=records-covered;unresolvedCandidateCount=unresolvedCandidates;
        }
        JSONObject json()throws VaultFailure {try{return new JSONObject(encoded);}catch(Exception error){throw new VaultFailure(FAILURE,error);}}
    }
    private static final class Candidate {
        final byte[] bytes;final String digest,key;String state="UNMATCHED_ARGUMENT_CANDIDATE_RETAINED";
        Candidate(byte[] bytes,String device)throws VaultFailure {
            this.bytes=bytes;digest=NativeRetainedAttempt.hash(bytes);String selected;
            try{selected=sourceKey(device,ProviderWireJson.object(bytes,RequestPolicy.MAX_REQUEST_BYTES));}catch(Exception error){selected=null;}
            key=selected;if(key==null)state="UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED";
        }
    }
    private static final class Match {
        final String receiptKey,sessionKey,argumentHash,provenance;final NativeRetainedCompletionSemantics.Observation semantic;
        final Candidate candidate;final JSONObject row;
        Match(String key,String session,String hash,String provenance,NativeRetainedCompletionSemantics.Observation semantic,Candidate candidate,JSONObject row){
            receiptKey=key;sessionKey=session;argumentHash=hash;this.provenance=provenance;this.semantic=semantic;this.candidate=candidate;this.row=row;
        }
    }
    static List<byte[]> copyCandidates(List<byte[]> values)throws VaultFailure {
        List<byte[]> copy=new ArrayList<>();boolean complete=false;
        try{
            if(values==null)throw invalid();int total=0,count=values.size();if(count<0||count>MAX_CANDIDATES)throw invalid();
            for(int i=0;i<count;i++){byte[] bytes=values.get(i);if(bytes==null||bytes.length>RequestPolicy.MAX_REQUEST_BYTES||(total+=bytes.length)>MAX_TOTAL_BYTES)throw invalid();copy.add(bytes.clone());}
            if(values.size()!=count)throw invalid();complete=true;return copy;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(!complete)wipe(copy);}
    }
    static boolean sameCandidates(List<byte[]> copy,List<byte[]> original)throws VaultFailure {
        try{if(original==null||copy.size()!=original.size())return false;for(int i=0;i<copy.size();i++)if(!Arrays.equals(copy.get(i),original.get(i)))return false;return copy.size()==original.size();}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    static void wipe(List<byte[]> values){if(values!=null)for(byte[] bytes:values)if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    static Observation inspect(Map<String,?> original,NativeSeparationEvidence proof,List<byte[]> arguments,char[] credential,
        NativeRetainedCompletionSemantics.Decoder decoder)throws VaultFailure {
        List<byte[]> copied=null;
        try{
            if(original==null||proof==null||decoder==null)throw invalid();
            NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(original);
            if(!snapshot.digest.equals(proof.rawSnapshotDigest))throw invalid();
            JSONObject manifest=ProviderWireJson.object(proof.body.getBytes(StandardCharsets.UTF_8),131072);
            String device=manifest.getJSONObject("original_principal").getString("device_id");
            NativeAttestation.requireStoredCredentialId(credential,manifest.getJSONObject("original_principal").getString("credential_id"));
            copied=copyCandidates(arguments);List<Candidate> candidates=new ArrayList<>();Map<String,List<Candidate>> selected=new HashMap<>();
            for(byte[] bytes:copied){Candidate candidate=new Candidate(bytes,device);candidates.add(candidate);if(candidate.key!=null)selected.computeIfAbsent(candidate.key,k->new ArrayList<>()).add(candidate);}
            JSONArray identities=snapshot.recordRows();Map<String,JSONObject> rows=new TreeMap<>();Map<String,Match> matches=new TreeMap<>();int index=0;
            for(String key:new TreeSet<>(original.keySet())){
                JSONObject row=new JSONObject().put("raw_identity_sha256",NativeProviderPrincipal.hash(identities.getJSONArray(index++).toString()))
                    .put("kind",NativeProtectedWorkInventory.kind(key)).put("state","UNRECONCILED_RECORD_RETAINED").put("automatic_acceptance",false);
                rows.put(key,row);if(!key.startsWith(RECEIPT))continue;
                String receiptKey=key.substring(RECEIPT.length());if(!receiptKey.matches("[a-f0-9]{64}")){row.put("state","MALFORMED_RECEIPT_KEY_RETAINED");continue;}
                List<Candidate> found=selected.getOrDefault(receiptKey,List.of());
                if(found.size()>1){row.put("state","AMBIGUOUS_BROWSER_ARGUMENT_ROWS_RETAINED");for(Candidate candidate:found)candidate.state="AMBIGUOUS_ARGUMENT_CANDIDATE_RETAINED";continue;}
                Candidate browser=found.isEmpty()?null:found.get(0);byte[] nativeArgs=null;
                try{
                    NativeProtectedWorkInventory.Decoded decoded=decoder.decode(key,original.get(key));
                    if(decoded==null||decoded.value==null||decoded.plaintextDigest==null||!decoded.plaintextDigest.matches("[a-f0-9]{64}"))throw invalid();
                    NativeRetainedAttempt.keys(decoded.value,"receipt");Object encoded=decoded.value.get("receipt");if(!(encoded instanceof String))throw invalid();
                    String provenance;
                    try(NativeCompletionJournal.RetainedOriginalRequest receipt=NativeCompletionJournal.inspectRetainedOriginalRequest(device,receiptKey,(String)encoded)){
                        if(receipt.originalValuesAvailable){nativeArgs=argumentBytes(receipt.originalArgs());provenance="CAPTURED_NATIVE_ORIGINAL_V3_VALUES";}
                        else if(receipt.fixedReadValuesAvailable){
                            // The existing authenticated native READ retained
                            // these argument values, not an original WRITE wire.
                            // Keep that distinction through the additive census;
                            // current SQL/eligibility/ACK still require their
                            // separate owning admission and are never inferred.
                            if(!receipt.fixedReadMatchesOriginalPrincipal(NativeProviderPrincipal.fromNativeJournal(
                                manifest.getJSONObject("original_principal"))))throw invalid();
                            nativeArgs=argumentBytes(receipt.fixedReadArgs());
                            provenance="CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN";
                        }
                        else if(browser!=null){nativeArgs=browser.bytes.clone();provenance="BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE";}
                        else{row.put("state","LEGACY_ORIGINAL_VALUES_UNAVAILABLE_RETAINED");continue;}
                    }
                    if(nativeArgs.length>RequestPolicy.MAX_REQUEST_BYTES)throw invalid();
                    NativeRetainedCompletionSemantics.Observation semantic=NativeRetainedCompletionSemantics.inspect(original,proof,receiptKey,nativeArgs,credential,decoder);
                    if(browser!=null&&!NativeCompletionJournal.compareRetainedArgumentValues(device,receiptKey,(String)encoded,browser.bytes).semanticArgumentsMatch){
                        row.put("state","BROWSER_ARGUMENT_VALUES_MISMATCH_RETAINED");browser.state="ARGUMENT_VALUES_MISMATCH_RETAINED";continue;
                    }
                    JSONObject args=ProviderWireJson.object(nativeArgs,RequestPolicy.MAX_REQUEST_BYTES);String session=uuid(args,"p_client_session_id");
                    matches.put(key,new Match(receiptKey,session,NativeRetainedAttempt.hash(nativeArgs),provenance,semantic,browser,row));
                }catch(VaultFailure error){row.put("state","INVALID_OR_UNREADABLE_COMPLETION_RETAINED");if(browser!=null)browser.state="NATIVE_COMPLETION_UNRESOLVED_RETAINED";}
                catch(Exception error){row.put("state","INVALID_OR_UNREADABLE_COMPLETION_RETAINED");if(browser!=null)browser.state="NATIVE_COMPLETION_UNRESOLVED_RETAINED";}
                finally{if(nativeArgs!=null)Arrays.fill(nativeArgs,(byte)0);}
            }
            Map<String,Integer> sessions=new HashMap<>();for(Match match:matches.values())sessions.merge(match.sessionKey,1,Integer::sum);
            Set<String> covered=new HashSet<>();int matched=0;
            for(var entry:matches.entrySet()){
                Match match=entry.getValue();if(sessions.get(match.sessionKey)!=1){match.row.put("state","AMBIGUOUS_SESSION_COMPLETIONS_RETAINED");if(match.candidate!=null)match.candidate.state="AMBIGUOUS_SESSION_ARGUMENT_RETAINED";continue;}
                String start=OCCURRENCE+NativeProviderPrincipal.hash(match.sessionKey),finish=FINISH+NativeProviderPrincipal.hash(match.sessionKey);
                if(!rows.containsKey(start)||!rows.containsKey(finish))throw invalid(); // Existing specific inspector must have established BOTH captured rows.
                match.row.put("state","ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE").put("argument_provenance",match.provenance)
                    .put("argument_values_sha256",match.argumentHash).put("receipt_binding_sha256",match.semantic.receiptBindingSha256)
                    .put("start_cutoff_relation",match.semantic.startCutoffRelation).put("finish_cutoff_relation",match.semantic.finishCutoffRelation);
                rows.get(start).put("state","ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY");rows.get(finish).put("state","ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY");
                covered.add(entry.getKey());covered.add(start);covered.add(finish);matched++;
                if(match.candidate!=null)match.candidate.state="ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE";
            }
            JSONArray recordRows=new JSONArray();for(JSONObject row:rows.values())recordRows.put(row);JSONArray inputRows=new JSONArray();int unresolved=0;
            for(Candidate candidate:candidates){if(!"ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE".equals(candidate.state))unresolved++;
                inputRows.put(new JSONObject().put("argument_values_sha256",candidate.digest).put("state",candidate.state).put("source_authenticated",false));}
            if(!NativeProtectedWorkSnapshot.capture(original).digest.equals(proof.rawSnapshotDigest)||!sameCandidates(copied,arguments))throw invalid();
            JSONObject value=new JSONObject().put("schema","custodial.native-frozen-completion-census.v1")
                .put("state","COMPLETION_CENSUS_NOT_COMPLETE_NAMESPACE_INVENTORY").put("raw_snapshot_sha256",snapshot.digest).put("signed_manifest_sha256",proof.bodySha256)
                .put("record_count",rows.size()).put("matched_completion_count",matched).put("completion_joined_record_count",covered.size())
                .put("unresolved_record_count",rows.size()-covered.size()).put("argument_candidate_count",candidates.size()).put("unresolved_argument_candidate_count",unresolved)
                .put("records",recordRows).put("argument_candidates",inputRows).put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("browser_source_authenticated",false).put("complete_namespace_inventory",false).put("current_server_readback",false).put("cutoff_eligible",false)
                .put("work_accepted",false).put("inventory_acknowledged",false).put("key_removal",false).put("phone_released",false);
            return new Observation(value,rows.size(),matched,covered.size(),unresolved);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{wipe(copied);} // Drops/wipes owned bytes; does not promise erasure of Java/JSON strings.
    }
    /** Derived argument VALUES for a NEW purpose-specific fixed READ only.
     * Never returns/recreates the old WRITE body or any acceptance capability.
     * No browser candidates: only known native-derived matches are selected.
     * Main MUST carry the separate complete census with ALL unresolved rows;
     * a partial/empty list is never complete inventory or empty-work proof.
     * Main must hold/recheck the actual original typed owner and lifetime;
     * this raw-map/proof interface cannot establish current Engine authority.
     */
    static final class NativeReadGroup implements AutoCloseable {
        final String receiptKey,startKey,finishKey;
        final String receiptRawIdentitySha256,startRawIdentitySha256,finishRawIdentitySha256;
        final String argumentSha256,receiptBindingSha256,occurrenceSha256,finishSha256;
        final String startCutoffRelation,finishCutoffRelation,rawSnapshotSha256,signedManifestSha256,argumentProvenance;
        private byte[] arguments;
        private NativeReadGroup(String key,String start,String finish,Map<String,String> identities,
            NativeRetainedCompletionSemantics.Observation specific,NativeSeparationEvidence proof,String provenance,byte[] bytes)throws VaultFailure{
            receiptKey=key;startKey=start;finishKey=finish;
            receiptRawIdentitySha256=identities.get(key);startRawIdentitySha256=identities.get(start);finishRawIdentitySha256=identities.get(finish);
            if(receiptRawIdentitySha256==null||startRawIdentitySha256==null||finishRawIdentitySha256==null)throw invalid();
            argumentSha256=specific.argumentSha256;receiptBindingSha256=specific.receiptBindingSha256;
            occurrenceSha256=specific.occurrenceSha256;finishSha256=specific.finishSha256;
            startCutoffRelation=specific.startCutoffRelation;finishCutoffRelation=specific.finishCutoffRelation;
            rawSnapshotSha256=proof.rawSnapshotDigest;signedManifestSha256=proof.bodySha256;argumentProvenance=provenance;
            arguments=bytes;
        }
        synchronized byte[] argumentsCopy()throws VaultFailure{
            if(arguments==null)throw invalid();return arguments.clone();
        }
        @Override public synchronized void close(){if(arguments!=null){Arrays.fill(arguments,(byte)0);arguments=null;}}
    }
    /** Structural, exact original source groups, NOT current owner/SQL/ACK authority.
     * The separate full census retains every unresolved/foreign/legacy row. */
    static List<NativeReadGroup> collectNativeReadGroups(Map<String,?> original,NativeSeparationEvidence proof,char[] credential,
        NativeRetainedCompletionSemantics.Decoder decoder)throws VaultFailure{
        List<NativeReadGroup> collected=new ArrayList<>();char[] secret=credential==null?null:credential.clone();boolean complete=false;
        try{
            if(original==null||proof==null||decoder==null)throw invalid();
            JSONObject manifest=ProviderWireJson.object(proof.body.getBytes(StandardCharsets.UTF_8),131072);
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(manifest.getJSONObject("original_principal"));
            String device=principal.json().getString("device_id");
            NativeProtectedWorkSnapshot snapshot=requireReadSource(original,proof,principal,secret,credential);
            Map<String,String> identities=readRawIdentities(original,snapshot);
            Observation census=inspect(original,proof,List.of(),secret,decoder);
            JSONArray rows=census.json().getJSONArray("records");int rowIndex=0,total=0;
            for(String key:new TreeSet<>(original.keySet())){
                JSONObject row=rows.getJSONObject(rowIndex++);
                if(!identities.get(key).equals(row.get("raw_identity_sha256")))throw invalid();
                if(!key.startsWith(RECEIPT)||!"ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE".equals(row.opt("state")))continue;
                String provenance=row.optString("argument_provenance",""),receiptKey=key.substring(RECEIPT.length());byte[] bytes=null;
                try{
                    bytes=readNativeArguments(original,key,device,principal,provenance,decoder);
                    String hash=NativeRetainedAttempt.hash(bytes);
                    JSONObject args=ProviderWireJson.object(bytes,RequestPolicy.MAX_REQUEST_BYTES);
                    if(bytes.length<1||!hash.equals(row.get("argument_values_sha256"))||!receiptKey.equals(sourceKey(device,args)))throw invalid();
                    NativeRetainedCompletionSemantics.Observation specific=NativeRetainedCompletionSemantics.inspect(original,proof,receiptKey,bytes,secret,decoder);
                    if(!hash.equals(specific.argumentSha256)||!specific.receiptBindingSha256.equals(row.get("receipt_binding_sha256"))
                        ||!specific.startCutoffRelation.equals(row.get("start_cutoff_relation"))
                        ||!specific.finishCutoffRelation.equals(row.get("finish_cutoff_relation")))throw invalid();
                    String session=uuid(args,"p_client_session_id"),start=OCCURRENCE+NativeProviderPrincipal.hash(session),finish=FINISH+NativeProviderPrincipal.hash(session);
                    if(collected.size()>=MAX_CANDIDATES||bytes.length>MAX_TOTAL_BYTES-total)throw invalid();
                    total+=bytes.length;collected.add(new NativeReadGroup(key,start,finish,identities,specific,proof,provenance,bytes));bytes=null;
                }finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}
            }
            if(rowIndex!=rows.length()||collected.size()!=census.matchedCompletionCount)throw invalid();
            // Re-read the SAME decoded native values and semantic three-row
            // binding after complete selection; never adopt changed bytes.
            for(NativeReadGroup group:collected){
                byte[] bytes=null;
                try{
                    bytes=readNativeArguments(original,group.receiptKey,device,principal,group.argumentProvenance,decoder);
                    if(!Arrays.equals(bytes,group.arguments)||!NativeRetainedAttempt.hash(bytes).equals(group.argumentSha256))throw invalid();
                    NativeRetainedCompletionSemantics.Observation checked=NativeRetainedCompletionSemantics.inspect(original,proof,
                        group.receiptKey.substring(RECEIPT.length()),bytes,secret,decoder);
                    if(!checked.receiptBindingSha256.equals(group.receiptBindingSha256)||!checked.occurrenceSha256.equals(group.occurrenceSha256)
                        ||!checked.finishSha256.equals(group.finishSha256)||!checked.startCutoffRelation.equals(group.startCutoffRelation)
                        ||!checked.finishCutoffRelation.equals(group.finishCutoffRelation))throw invalid();
                    JSONObject args=ProviderWireJson.object(bytes,RequestPolicy.MAX_REQUEST_BYTES);String session=uuid(args,"p_client_session_id");
                    if(!group.startKey.equals(OCCURRENCE+NativeProviderPrincipal.hash(session))
                        ||!group.finishKey.equals(FINISH+NativeProviderPrincipal.hash(session)))throw invalid();
                }finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}
            }
            NativeProtectedWorkSnapshot after=requireReadSource(original,proof,principal,secret,credential);
            if(!identities.equals(readRawIdentities(original,after)))throw invalid();
            List<NativeReadGroup> result=List.copyOf(collected);complete=true;return result;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(secret!=null)Arrays.fill(secret,'\0');if(!complete)for(NativeReadGroup group:collected)group.close();}
    }
    static List<byte[]> collectNativeReadArguments(Map<String,?> original,NativeSeparationEvidence proof,char[] credential,
        NativeRetainedCompletionSemantics.Decoder decoder)throws VaultFailure{
        List<NativeReadGroup> groups=null;List<byte[]> copies=new ArrayList<>();boolean complete=false;
        try{
            groups=collectNativeReadGroups(original,proof,credential,decoder);
            for(NativeReadGroup group:groups)copies.add(group.argumentsCopy());
            List<byte[]> result=List.copyOf(copies);complete=true;return result;
        }finally{if(groups!=null)for(NativeReadGroup group:groups)group.close();if(!complete)wipe(copies);}
    }
    private static NativeProtectedWorkSnapshot requireReadSource(Map<String,?> original,NativeSeparationEvidence proof,
        NativeProviderPrincipal principal,char[] secret,char[] credential)throws VaultFailure{
        if(!Arrays.equals(secret,credential))throw invalid();
        NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(original);
        if(!snapshot.digest.equals(proof.rawSnapshotDigest))throw invalid();
        NativeSeparationEvidence.restore(proof.json(),principal,snapshot,secret);
        if(!Arrays.equals(secret,credential))throw invalid();return snapshot;
    }
    private static Map<String,String> readRawIdentities(Map<String,?> original,NativeProtectedWorkSnapshot snapshot)throws Exception{
        JSONArray rows=snapshot.recordRows();Map<String,String> identities=new TreeMap<>();int i=0;
        for(String key:new TreeSet<>(original.keySet()))identities.put(key,NativeProviderPrincipal.hash(rows.getJSONArray(i++).toString()));
        if(i!=rows.length())throw invalid();return identities;
    }
    private static byte[] readNativeArguments(Map<String,?> original,String key,String device,NativeProviderPrincipal principal,
        String provenance,NativeRetainedCompletionSemantics.Decoder decoder)throws Exception{
        if(!original.containsKey(key))throw invalid();
        NativeProtectedWorkInventory.Decoded decoded=decoder.decode(key,original.get(key));
        if(decoded==null||decoded.value==null||decoded.plaintextDigest==null||!decoded.plaintextDigest.matches("[a-f0-9]{64}"))throw invalid();
        NativeRetainedAttempt.keys(decoded.value,"receipt");Object encoded=decoded.value.get("receipt");
        if(!(encoded instanceof String))throw invalid();
        try(NativeCompletionJournal.RetainedOriginalRequest receipt=NativeCompletionJournal.inspectRetainedOriginalRequest(device,key.substring(RECEIPT.length()),(String)encoded)){
            if("CAPTURED_NATIVE_ORIGINAL_V3_VALUES".equals(provenance)&&receipt.originalValuesAvailable)return argumentBytes(receipt.originalArgs());
            if("CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN".equals(provenance)
                &&receipt.fixedReadValuesAvailable&&receipt.fixedReadMatchesOriginalPrincipal(principal))return argumentBytes(receipt.fixedReadArgs());
            throw invalid();
        }
    }
    private static String sourceKey(String device,JSONObject args)throws VaultFailure {
        if(!device.equals(args.opt("p_device_id")))throw invalid();return NativeProviderPrincipal.hash(device+"|"+uuid(args,"p_client_session_id")+"|"+uuid(args,"p_client_completion_id"));
    }
    private static byte[] argumentBytes(JSONObject args)throws Exception {
        java.nio.ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
            .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(args.toString()));
        try{if(encoded.remaining()>RequestPolicy.MAX_REQUEST_BYTES)throw invalid();byte[] bytes=new byte[encoded.remaining()];encoded.get(bytes);return bytes;}
        finally{if(encoded.hasArray())Arrays.fill(encoded.array(),(byte)0);}
    }
    private static String uuid(JSONObject args,String field)throws VaultFailure {
        Object value=args.opt(field);if(!(value instanceof String)||!((String)value).matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw invalid();return(String)value;
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
    private NativeRetainedCompletionCensus(){}
}
