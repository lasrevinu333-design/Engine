package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native-only, read-only discovery of records in an already verified frozen
 * snapshot. Readability and discovered identifiers are NOT semantic validity,
 * server acceptance, cutoff eligibility, empty-queue authority or an ACK.
 * Every raw record remains represented, including corruption/unknown types.
 * No mounted plugin method, browser input, mutation, or finalizer uses this yet.
 */
final class NativeProtectedWorkInventory {
    interface Decoder { Decoded decode(String key,Object raw)throws VaultFailure; }
    static final class Decoded {
        final JSONObject value;
        final String plaintextDigest;
        Decoded(JSONObject value,String digest){this.value=value;plaintextDigest=digest;}
    }
    private static final String OCCURRENCE="offline_occurrence_sha256:",FINISH="offline_finish_proof_sha256:";
    private static final String RECEIPT="authenticated_completion_receipt_sha256:";
    private static final String MUTATION_EPOCH="native_work_mutation_epoch.v1";
    private static final Set<String> METADATA=Set.of("offline_authority_anchor","rollback_fence","authenticated_principal",
        "assigned_activation_proof","assigned_activation_transport","offline_scan_journal_quarantine_active","offline_scan_journal_disposition_latest");
    private final String encoded;
    private NativeProtectedWorkInventory(JSONObject value)throws VaultFailure{
        encoded=value.toString();if(encoded.length()>1048576)throw invalid();
    }
    JSONObject json()throws VaultFailure{
        try{return new JSONObject(encoded);}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    static NativeProtectedWorkInventory inspect(Map<String,?> raw,NativeSeparationEvidence proof,Decoder decoder)throws VaultFailure{
        try{
            NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(raw);
            if(proof==null||decoder==null||!snapshot.digest.equals(proof.rawSnapshotDigest))throw invalid();
            JSONObject signed=new JSONObject(proof.body),principal=signed.getJSONObject("original_principal");
            JSONArray rows=snapshot.recordRows(),entries=new JSONArray();int index=0,unreadable=0;
            Map<String,Decoded> decodedRecords=new HashMap<>();
            for(String key:new TreeSet<>(raw.keySet())){
                JSONArray identity=rows.getJSONArray(index++);String kind=kind(key);
                JSONObject item=new JSONObject()
                    .put("raw_identity_sha256",NativeProviderPrincipal.hash(identity.toString())).put("kind",kind)
                    .put("state","UNKNOWN").put("automatic_acceptance",false);
                if("MUTATION_EPOCH_METADATA".equals(kind)){
                    // The owning preferences writer stores this exact cell as
                    // a raw decimal String, never an encrypted JSON record.
                    // Signed raw identity is already bound above; this is not
                    // work, a receipt, a generation claim or an ACK.
                    if(validMutationEpoch(raw.get(key)))item.put("state","READABLE_UNVERIFIED");
                }else if(!"UNRECOGNIZED".equals(kind))try{
                    Decoded decoded=decoder.decode(key,raw.get(key));
                    if(decoded==null||decoded.value==null||decoded.plaintextDigest==null
                        ||!decoded.plaintextDigest.matches("[a-f0-9]{64}"))throw invalid();
                    decodedRecords.put(key,decoded);
                    JSONArray ids=identifiers(key,kind,decoded.value,principal);
                    if("COMPLETION_RECEIPT".equals(kind))try(NativeCompletionJournal.RetainedOriginalRequest original=
                        NativeCompletionJournal.inspectRetainedOriginalRequest(principal.getString("device_id"),key.substring(RECEIPT.length()),decoded.value.getString("receipt"))){
                        item.put("original_request_values_state",original.state).put("original_request_values_available",original.originalValuesAvailable);
                        if(original.originalValuesAvailable)item.put("original_request_body_sha256",original.requestBodySha256);
                    }
                    item.put("state","READABLE_UNVERIFIED").put("record_sha256",decoded.plaintextDigest).put("identifiers",ids);
                }catch(VaultFailure error){ /* Preserve exact raw identity; never substitute empty decoded records. */ }
                if("UNKNOWN".equals(item.getString("state")))unreadable++;
                entries.put(item);
            }
            return new NativeProtectedWorkInventory(new JSONObject().put("schema","custodial.native-protected-work-discovery.v1")
                .put("separation_id",signed.getJSONObject("separation_context").getString("separation_id"))
                .put("original_principal",principal).put("signed_manifest_sha256",proof.bodySha256)
                .put("raw_snapshot_sha256",snapshot.digest).put("record_count",snapshot.recordCount)
                .put("unknown_record_count",unreadable).put("records",entries)
                .put("session_links",NativeProtectedSessionInventory.inspect(raw.keySet(),decodedRecords,principal))
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("new_work_allowed",false).put("phone_released",false));
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    static String kind(String key){
        if(MUTATION_EPOCH.equals(key))return "MUTATION_EPOCH_METADATA";
        if(key.startsWith(OCCURRENCE))return "OCCURRENCE";
        if(key.startsWith(FINISH))return "FINISH_PROOF";
        if(key.startsWith(RECEIPT))return "COMPLETION_RECEIPT";
        if(key.matches("native_recurring_target_sha256:[a-f0-9]{64}"))return "RECURRING_TARGET_DATA";
        if(key.matches("native_recurring_view_chunk_sha256:[a-f0-9]{64}"))return "RECURRING_VIEW_DATA";
        if(key.matches("native_notification_mutation_sha256:[a-f0-9]{64}"))return "NOTIFICATION_MUTATION_DATA";
        if(key.matches("native_recurring_purpose_sha256:[a-f0-9]{64}"))return "RECURRING_ORDINARY_PURPOSE_DATA";
        if(key.equals("offline_scan_entries"))return "SCAN_ENTRIES";
        if(key.equals("native_nfc_handoffs"))return "NFC_HANDOFFS";
        if(key.startsWith("legacy_lineage:"))return "LEGACY_LINEAGE";
        if(METADATA.contains(key)||key.startsWith("offline_authority_anchor_quarantine_record:")
            ||key.startsWith("offline_authority_anchor_quarantine_metadata:")||key.startsWith("offline_scan_journal_quarantine_record:")
            ||key.startsWith("offline_scan_journal_disposition:"))return "PROTECTED_METADATA";
        return "UNRECOGNIZED";
    }
    private static boolean validMutationEpoch(Object raw){
        if(!(raw instanceof String)||!((String)raw).matches("[1-9][0-9]{0,18}"))return false;
        try{return Long.parseLong((String)raw)>0;}catch(NumberFormatException error){return false;}
    }
    private static JSONArray identifiers(String key,String kind,JSONObject record,JSONObject principal)throws VaultFailure{
        try{
            JSONArray ids=new JSONArray();
            if(kind.equals("RECURRING_ORDINARY_PURPOSE_DATA")) {
                JSONObject prepared="custodial.native-recurring-ordinary-attempt.v1".equals(record.opt("schema"))
                    ?NativeRecurringOrdinaryAttemptJournal.originalPrepared(key,record.toString())
                    :NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,record.toString());
                if(!NativeProviderPrincipal.fromNativeJournal(principal).same(
                    NativeProviderPrincipal.fromNativeJournal(prepared.getJSONObject("principal"))))throw invalid();
                ids.put(new JSONObject().put("intent_id",prepared.get("intent_id")));
            }else if(kind.equals("RECURRING_TARGET_DATA")||kind.equals("RECURRING_VIEW_DATA")||kind.equals("NOTIFICATION_MUTATION_DATA")) {
                if(!Boolean.FALSE.equals(record.get("receipt_eligible")))throw invalid();
                JSONObject retainedPrincipal=record.getJSONObject("principal");
                if(!NativeProviderPrincipal.fromNativeJournal(principal).same(NativeProviderPrincipal.fromNativeJournal(retainedPrincipal)))throw invalid();
                if(kind.equals("RECURRING_TARGET_DATA")) {
                    String intent=uuid(record,"intent_id");
                    if(!key.equals(NativeRecurringTargetJournal.TARGET_PREFIX+NativeProviderPrincipal.hash(
                        NativeProviderPrincipal.fromNativeJournal(retainedPrincipal).digest+":"+intent)))throw invalid();
                    ids.put(new JSONObject().put("intent_id",intent));
                } else if(kind.equals("RECURRING_VIEW_DATA")) {
                    String intent=uuid(record,"intent_id");Object index=record.get("index");
                    if(!(index instanceof Integer||index instanceof Long)||((Number)index).longValue()<0||((Number)index).longValue()>=256
                        ||!key.equals(NativeRecurringTargetJournal.viewKey(NativeProviderPrincipal.fromNativeJournal(retainedPrincipal),intent,((Number)index).intValue())))throw invalid();
                    ids.put(new JSONObject().put("intent_id",intent).put("index",index));
                } else {
                    String generation=uuid(record,"generation");
                    if(!key.equals(NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(generation)))throw invalid();
                    ids.put(new JSONObject().put("generation",generation));
                }
            }else if(kind.equals("OCCURRENCE")||kind.equals("FINISH_PROOF")){
                String session=uuid(record,"client_session_id"),prefix=kind.equals("OCCURRENCE")?OCCURRENCE:FINISH;
                if(!key.equals(prefix+NativeProviderPrincipal.hash(session))
                    ||!principal.getString("device_id").equals(record.get("device_id")))throw invalid();
                ids.put(new JSONObject().put("client_session_id",session)
                    .put("entry_id",uuid(record,kind.equals("OCCURRENCE")?"native_scan_entry_id":"entry_id")));
            }else if(kind.equals("SCAN_ENTRIES")||kind.equals("NFC_HANDOFFS")){
                String field=kind.equals("SCAN_ENTRIES")?"entries":"handoffs";
                if(record.length()!=1)throw invalid();JSONArray records=record.getJSONArray(field);
                if(records.length()>4)throw invalid();Set<String> seen=new TreeSet<>();
                for(int i=0;i<records.length();i++){
                    JSONObject row=records.getJSONObject(i);String entry=uuid(row,"entry_id");
                    String identity=kind.equals("SCAN_ENTRIES")?entry:uuid(row,"handoff_id");
                    if(!seen.add(identity))throw invalid();
                    JSONObject item=new JSONObject().put("entry_id",entry);
                    if(kind.equals("NFC_HANDOFFS"))item.put("handoff_id",identity);ids.put(item);
                }
            }else if(kind.equals("COMPLETION_RECEIPT")){
                if(!key.substring(RECEIPT.length()).matches("[a-f0-9]{64}")||record.length()!=1||!(record.get("receipt") instanceof String))throw invalid();
                try(NativeCompletionJournal.RetainedOriginalRequest original=NativeCompletionJournal.inspectRetainedOriginalRequest(
                    principal.getString("device_id"),key.substring(RECEIPT.length()),record.getString("receipt"))){
                    if(original.originalValuesAvailable){
                        JSONObject args=original.originalArgs();ids.put(new JSONObject().put("client_session_id",uuid(args,"p_client_session_id"))
                            .put("client_completion_id",uuid(args,"p_client_completion_id")).put("finish_entry_id",uuid(args,"p_native_finish_scan_entry_id")));
                    }
                }
                // Original values are now discoverable for v3; legacy v2 never
                // invents them. Neither structural join grants server/cutoff/
                // full original principal proof or inventory/cleanup authority.
            }else if(kind.equals("LEGACY_LINEAGE")){
                if(record.length()!=2||!key.substring("legacy_lineage:".length()).equals(record.get("key"))
                    ||!(record.get("value") instanceof String))throw invalid();
            }
            return ids;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    private static String uuid(JSONObject row,String key)throws Exception{
        Object value=row.get(key);if(!(value instanceof String)||!((String)value).matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw invalid();return(String)value;
    }
    private static VaultFailure invalid(){return new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);}
}
