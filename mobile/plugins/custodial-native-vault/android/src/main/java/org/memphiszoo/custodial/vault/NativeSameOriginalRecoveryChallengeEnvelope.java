package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

/** Purpose-local body encoding ONLY. Neither an authority object nor a sender.
 * Main must durably own the exact original intent, verify native source/current
 * credential/QUERY witnesses and authenticate this NEW path/body purpose.
 * An untrusted target, matching pins or formatted intent ID is not provenance.
 * No IDs, times, keys, IVs, HMACs, permission flags or effects are created here.
 */
final class NativeSameOriginalRecoveryChallengeEnvelope {
    static final String SCHEMA="custodial.same-original-recovery-native-challenge.v1";
    static final String PATH="/device-auth/same-original-recovery/challenge";
    static final String FAILURE="custodial_same_original_recovery_challenge_envelope_invalid";
    static final int MAX_OUTPUT=786432;
    static final String STATUS_PATH="/device-auth/same-original-recovery/challenge-status";
    static final String STATUS_SCHEMA="custodial.same-original-recovery-native-status.v1";
    static final String MANAGER_PREPARATION_PATH="/device-auth/same-original-recovery/manager-preparation";
    static final int MAX_STATUS=1050624;
    private static final String[] CURRENT_FIELDS={"schema","original_query_body_base64","original_query_timestamp",
        "original_query_http_attestation","original_query_unknown_record_sha256"};
    private static final String[] TARGET_PINS={"operation_id","original_generation_id","principal_digest","engine_revision",
        "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"};
    private static final String UUID="[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
    private NativeSameOriginalRecoveryChallengeEnvelope(){}

    /** Only the NEW saved challenge body has this larger bound. The legacy
     * NativeRetainedAttempt decoder and original QUERY cap stay unchanged. */
    static byte[] decodeOriginalRequestBytes(String text)throws VaultFailure {
        byte[] decoded=null;
        try{
            if(text==null||text.length()==0||text.length()>4*((MAX_OUTPUT+2)/3)||text.length()%4!=0
                ||!text.matches("[A-Za-z0-9+/]+={0,2}"))throw invalid();
            decoded=java.util.Base64.getDecoder().decode(text);
            if(decoded.length==0||decoded.length>MAX_OUTPUT||!java.util.Base64.getEncoder().encodeToString(decoded).equals(text))throw invalid();
            byte[] result=decoded;decoded=null;return result;
        }catch(Exception failure){throw invalid();}
        finally{if(decoded!=null)Arrays.fill(decoded,(byte)0);}
    }

    static byte[] encode(byte[] currentOriginalQueryEnvelope,
        NativeSameOriginalRecoveryPreparationWire.UntrustedTarget originalTarget,
        String originalChallengeIntentId,String originalChallengeIntentRecordSha256)throws VaultFailure {
        byte[] snapshot=null,original=null,checked=null,encoded=null;
        try {
            if(currentOriginalQueryEnvelope==null||currentOriginalQueryEnvelope.length==0
                ||currentOriginalQueryEnvelope.length>NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE
                ||originalTarget==null||originalChallengeIntentId==null
                ||!originalChallengeIntentId.matches(UUID)
                ||originalChallengeIntentRecordSha256==null||!originalChallengeIntentRecordSha256.matches("[a-f0-9]{64}"))throw invalid();
            snapshot=currentOriginalQueryEnvelope.clone();
            JSONObject current=ProviderWireJson.object(snapshot,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
            NativeRetainedAttempt.keys(current,CURRENT_FIELDS);
            for(String key:CURRENT_FIELDS)if(!(current.get(key) instanceof String))throw invalid();
            if(!NativePrivateCustodyCurrentQueryEnvelope.SCHEMA.equals(current.get("schema")))throw invalid();
            original=NativeRetainedAttempt.base64(current.getString("original_query_body_base64"),NativePrivateCustodyCurrentQueryEnvelope.MAX_ORIGINAL);
            // Reuse the existing original flat v1 QUERY shape/string/calendar
            // validator. Its re-encoded bytes are NEVER substituted for the
            // original envelope or query; no freshness or proof is asserted.
            checked=NativePrivateCustodyCurrentQueryEnvelope.encode(original,current.getString("original_query_timestamp"),
                current.getString("original_query_http_attestation"),current.getString("original_query_unknown_record_sha256"));
            JSONObject query=ProviderWireJson.object(original,NativePrivateCustodyCurrentQueryEnvelope.MAX_ORIGINAL);
            for(String key:new String[]{"operation_id","original_generation_id","write_id","attempt_id","read_query_id","target_native_request_id"})
                if(!query.getString(key).matches(UUID))throw invalid();
            for(String key:new String[]{"principal_digest","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_sha256",
                "purpose_binding_sha256","purpose_attestation","target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"})
                if(!query.getString(key).matches("[a-f0-9]{64}"))throw invalid();
            JSONObject target=originalTarget.json();
            for(String key:TARGET_PINS)if(!query.get(key).equals(target.get(key)))throw invalid();
            encoded=new JSONObject().put("schema",SCHEMA).put("purpose",NativeSameOriginalRecoveryPreparationWire.PURPOSE)
                .put("native_challenge_intent_id",originalChallengeIntentId)
                .put("native_challenge_intent_record_sha256",originalChallengeIntentRecordSha256)
                .put("current_original_query_envelope_base64",NativeRetainedAttempt.encodeBase64(snapshot))
                .put("original_target",target).put("original_target_sha256",originalTarget.documentSha256())
                .toString().getBytes(StandardCharsets.UTF_8);
            if(encoded.length>MAX_OUTPUT)throw invalid();
            byte[] result=encoded;encoded=null;return result;
        }catch(Exception failure){throw invalid();}
        finally{
            if(snapshot!=null)Arrays.fill(snapshot,(byte)0);if(original!=null)Arrays.fill(original,(byte)0);
            if(checked!=null)Arrays.fill(checked,(byte)0);if(encoded!=null)Arrays.fill(encoded,(byte)0);
        }
    }
    /** Observation body ONLY. The archived challenge bytes/time/HMAC are
     * carried unchanged, not signed, renewed, registered or sent again.
     * Main owns historical-HMAC authentication and the fresh outer status
     * read; structural validation here supplies no currentness or authority.
     */
    static byte[] encodeStatus(byte[] originalChallengeBody,String originalTimestamp,
        String originalHttpAttestation)throws VaultFailure {
        return encodeOriginalRead(originalChallengeBody,originalTimestamp,originalHttpAttestation,false);
    }
    static byte[] encodeManagerPreparationRead(byte[] originalChallengeBody,String originalTimestamp,
        String originalHttpAttestation)throws VaultFailure {
        return encodeOriginalRead(originalChallengeBody,originalTimestamp,originalHttpAttestation,true);
    }
    private static byte[] encodeOriginalRead(byte[] originalChallengeBody,String originalTimestamp,String originalHttpAttestation,
        boolean managerPreparation)throws VaultFailure {
        byte[] snapshot=null,current=null,targetBytes=null,checked=null,encoded=null;
        try{
            if(originalChallengeBody==null||originalChallengeBody.length==0||originalChallengeBody.length>MAX_OUTPUT
                ||originalTimestamp==null||originalTimestamp.length()!=24
                ||!originalTimestamp.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z")
                ||originalHttpAttestation==null||!originalHttpAttestation.matches("[a-f0-9]{64}"))throw invalid();
            long millis=VaultTimestamps.epochMillis(originalTimestamp,FAILURE);
            if(!originalTimestamp.equals(VaultTimestamps.fromEpochMillisExact(millis)))throw invalid();
            snapshot=originalChallengeBody.clone();
            var challenge=ProviderWireJson.object(snapshot,MAX_OUTPUT);
            NativeRetainedAttempt.keys(challenge,"schema","purpose","native_challenge_intent_id","native_challenge_intent_record_sha256",
                "current_original_query_envelope_base64","original_target","original_target_sha256");
            for(String key:new String[]{"schema","purpose","native_challenge_intent_id","native_challenge_intent_record_sha256",
                "current_original_query_envelope_base64","original_target_sha256"})
                if(!(challenge.get(key) instanceof String))throw invalid();
            if(!SCHEMA.equals(challenge.get("schema"))||!NativeSameOriginalRecoveryPreparationWire.PURPOSE.equals(challenge.get("purpose")))throw invalid();
            targetBytes=challenge.getJSONObject("original_target").toString().getBytes(StandardCharsets.UTF_8);
            var target=NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes);
            if(!target.documentSha256().equals(challenge.getString("original_target_sha256")))throw invalid();
            current=decodeOriginalRequestBytes(challenge.getString("current_original_query_envelope_base64"));
            if(current.length>NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE)throw invalid();
            // Reuse the existing closed QUERY/target/pin/intent validation.
            // Its reconstructed bytes are validation scratch ONLY: never
            // substitute them for the saved original challenge body.
            checked=encode(current,target,challenge.getString("native_challenge_intent_id"),
                challenge.getString("native_challenge_intent_record_sha256"));
            encoded=new JSONObject().put("schema",managerPreparation?"custodial.same-original-manager-preparation-native-read.v1":STATUS_SCHEMA)
                .put("purpose",managerPreparation?"READ_CURRENT_ORIGINAL_MANAGER_PREPARATION_ONLY":"OBSERVE_ORIGINAL_REGISTRATION_ONLY")
                .put("original_challenge_body_base64",NativeRetainedAttempt.encodeBase64(snapshot))
                .put("original_challenge_timestamp",originalTimestamp).put("original_challenge_http_attestation",originalHttpAttestation)
                .toString().getBytes(StandardCharsets.UTF_8);
            if(encoded.length>MAX_STATUS)throw invalid();
            byte[] result=encoded;encoded=null;return result;
        }catch(Exception failure){throw invalid();}
        finally{
            for(byte[] value:new byte[][]{snapshot,current,targetBytes,checked,encoded})if(value!=null)Arrays.fill(value,(byte)0);
        }
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
