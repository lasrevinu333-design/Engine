package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED, native-only one-completion semantic observation. The owning
 * engine authenticates the original frozen work/principal/HMAC before calling
 * this captured-record decoder, then rechecks its complete owner afterwards.
 * Browser argument values are still unauthenticated, even when receipt binding,
 * native occurrence/Finish and ORIGINAL credential signature match. Time
 * relations are reported exactly, not converted into cutoff eligibility.
 * This neither authenticates a historical schedule/clock profile nor checks a
 * current server row, every namespace, physical NFC, ACK or key retirement.
 */
final class NativeRetainedCompletionSemantics {
    static final String FAILURE="custodial_native_retained_completion_semantics_unknown";
    private static final String RECEIPT="authenticated_completion_receipt_sha256:",
        OCCURRENCE="offline_occurrence_sha256:",FINISH="offline_finish_proof_sha256:";
    interface Decoder { NativeProtectedWorkInventory.Decoded decode(String key,Object raw)throws VaultFailure; }
    static final class Observation {
        final String state="ORIGINAL_NATIVE_SIGNATURE_AND_SESSION_VALUES_MATCH_NOT_COMPLETE_INVENTORY";
        final String argumentSha256,receiptBindingSha256,occurrenceSha256,finishSha256;
        final String startCutoffRelation,finishCutoffRelation;
        final boolean originalCompletionSignatureMatches=true,nativeSessionValuesMatch=true;
        final boolean browserSourceAuthenticated=false,historicalSnapshotPrincipalVerified=false,clockProfileQualified=false;
        final boolean cutoffEligible=false,currentServerReadback=false,workAccepted=false,inventoryAcknowledged=false;
        final boolean keyRemovalAllowed=false,phoneReleased=false;
        private Observation(NativeCompletionJournal.RetainedArgumentMatch match,
            NativeProtectedWorkInventory.Decoded start,NativeProtectedWorkInventory.Decoded finish,
            String startRelation,String finishRelation) {
            argumentSha256=match.candidateArgumentsSha256;receiptBindingSha256=match.receiptBindingSha256;
            occurrenceSha256=start.plaintextDigest;finishSha256=finish.plaintextDigest;
            startCutoffRelation=startRelation;finishCutoffRelation=finishRelation;
        }
    }
    static Observation inspect(Map<String,?> original,NativeSeparationEvidence proof,String receiptKey,
        byte[] browserCandidate,char[] originalCredential,Decoder decoder)throws VaultFailure {
        byte[] candidate=browserCandidate==null?null:browserCandidate.clone();
        try {
            if(original==null||proof==null||candidate==null||decoder==null||receiptKey==null||!receiptKey.matches("[a-f0-9]{64}")
                ||!NativeProtectedWorkSnapshot.capture(original).digest.equals(proof.rawSnapshotDigest))throw invalid();
            JSONObject manifest=ProviderWireJson.object(proof.body.getBytes(StandardCharsets.UTF_8),131072);
            JSONObject principal=manifest.getJSONObject("original_principal"),context=manifest.getJSONObject("separation_context");
            String device=text(principal,"device_id");NativeAttestation.requireStoredCredentialId(originalCredential,text(principal,"credential_id"));
            NativeProtectedWorkInventory.Decoded receipt=decode(original,RECEIPT+receiptKey,decoder);
            NativeRetainedAttempt.keys(receipt.value,"receipt");
            NativeCompletionJournal.RetainedArgumentMatch match=NativeCompletionJournal.compareRetainedArgumentValues(
                device,receiptKey,text(receipt.value,"receipt"),candidate);
            if(!match.semanticArgumentsMatch)throw invalid(); // Never continue using merely readable or digest-only receipt values.
            JSONObject args=ProviderWireJson.object(candidate,RequestPolicy.MAX_REQUEST_BYTES);
            String session=uuid(args,"p_client_session_id"),startKey=OCCURRENCE+NativeProviderPrincipal.hash(session),
                finishKey=FINISH+NativeProviderPrincipal.hash(session);
            NativeProtectedWorkInventory.Decoded start=decode(original,startKey,decoder),finish=decode(original,finishKey,decoder);
            Map<String,NativeProtectedWorkInventory.Decoded> selected=new HashMap<>();selected.put(startKey,start);selected.put(finishKey,finish);
            JSONArray links=NativeProtectedSessionInventory.inspect(Set.of(startKey,finishKey),selected,principal);
            if(links.length()!=1||!"LINKED_UNVERIFIED".equals(links.getJSONObject(0).get("state")))throw invalid();
            for(String[] fields:new String[][]{{"p_device_id","device_id"},{"p_location_code","location_code"},
                {"p_client_session_id","client_session_id"},{"p_client_started_at","started_at"},{"p_client_ended_at","completed_at"}})
                if(!text(args,fields[0]).equals(text(start.value,fields[1])))throw invalid();
            if(!uuid(args,"p_native_finish_scan_entry_id").equals(uuid(finish.value,"entry_id")))throw invalid();
            // Original work-context ID, not the later separation ID. No context,
            // timestamp, signature or actor is invented/rewritten for recovery.
            JSONObject reconciliation=args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1");
            String originalContext=uuid(reconciliation,"context_id"),started=text(args,"p_client_started_at"),ended=text(args,"p_client_ended_at");
            Map<String,Object> expected=NativeAttestation.offlineCompletion(device,text(args,"p_location_code"),session,
                uuid(args,"p_client_completion_id"),originalContext,uuid(args,"p_native_finish_scan_entry_id"),started,originalCredential,ended);
            // Existing purpose-specific HMAC computation stays inside native
            // code for comparison only. It is never emitted/persisted or used
            // as a new signature, credential, transport or submission.
            for(String field:new String[]{"p_client_ended_at","p_native_finish_scan_entry_id","p_native_completion_attestation_version"})
                if(!expected.get(field).equals(args.get(field)))throw invalid();
            String signature=text(args,"p_native_completion_attestation");
            if(!signature.matches("[a-f0-9]{64}")||!MessageDigest.isEqual(signature.getBytes(StandardCharsets.US_ASCII),
                ((String)expected.get("p_native_completion_attestation")).getBytes(StandardCharsets.US_ASCII)))throw invalid();
            String cutoff=text(context,"cutoff_at");
            Observation result=new Observation(match,start,finish,relation(started,cutoff),relation(ended,cutoff));
            if(!Arrays.equals(candidate,browserCandidate)||!NativeProtectedWorkSnapshot.capture(original).digest.equals(proof.rawSnapshotDigest))throw invalid();
            return result;
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(candidate!=null)Arrays.fill(candidate,(byte)0);}
    }
    private static NativeProtectedWorkInventory.Decoded decode(Map<String,?> original,String key,Decoder decoder)throws VaultFailure {
        if(!original.containsKey(key))throw invalid();NativeProtectedWorkInventory.Decoded result=decoder.decode(key,original.get(key));
        if(result==null||result.value==null||result.plaintextDigest==null||!result.plaintextDigest.matches("[a-f0-9]{64}"))throw invalid();return result;
    }
    private static String relation(String value,String cutoff)throws VaultFailure {
        int result=VaultTimestamps.compareInstants(value,cutoff,FAILURE);return result<0?"BEFORE":result==0?"EQUAL":"AFTER";
    }
    private static String text(JSONObject row,String field)throws Exception {
        Object value=row.get(field);if(!(value instanceof String))throw invalid();return(String)value;
    }
    private static String uuid(JSONObject row,String field)throws Exception {
        String value=text(row,field);if(!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw invalid();return value;
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
    private NativeRetainedCompletionSemantics(){}
}
