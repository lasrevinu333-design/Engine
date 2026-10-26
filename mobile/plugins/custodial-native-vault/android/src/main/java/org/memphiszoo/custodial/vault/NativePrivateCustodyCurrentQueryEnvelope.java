package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

/** Encoding only. Main must first validate the actual original prepared QUERY,
 * issued QUERY_UNKNOWN witness and current native owner. This supplies no
 * signing, freshness, dispatch, acceptance, ACK or key-removal authority. */
final class NativePrivateCustodyCurrentQueryEnvelope {
    static final int MAX_ORIGINAL=393216,MAX_ENVELOPE=526336;
    static final String SCHEMA="custodial.original-private-custody-current-query.v1";
    private static final String QUERY_SCHEMA="custodial.original-native-private-custody-query.v1";
    private static final String FAILURE="custodial_native_private_custody_current_query_invalid";
    // Exact original flat STRING shape emitted by privateCustodyExpectedBody;
    // original IDs/proof/crypto and all field relationships remain Main-owned.
    private static final String[] QUERY_KEYS={"schema","operation_id","original_generation_id","principal_digest","engine_revision",
        "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","frame_bytes","chunk_count","chunk_index",
        "offset","chunk_bytes","chunk_sha256","write_id","attempt_id","read_query_id","owner_proof_base64",
        "original_signed_wire_base64","purpose_binding_sha256","purpose_attestation","target_native_request_id",
        "target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"};
    private NativePrivateCustodyCurrentQueryEnvelope(){}

    static byte[] encode(byte[] exactOriginalQueryBody,String originalQueryTimestamp,
        String originalHttpAttestation,String issuedQueryUnknownRecordSha256)throws VaultFailure {
        byte[] original=null,encoded=null;
        try{
            if(exactOriginalQueryBody==null||exactOriginalQueryBody.length==0||exactOriginalQueryBody.length>MAX_ORIGINAL
                ||originalQueryTimestamp==null||originalQueryTimestamp.length()!=24
                ||!originalQueryTimestamp.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z")
                ||!sha(originalHttpAttestation)||!sha(issuedQueryUnknownRecordSha256))throw invalid();
            // Calendar validity only: never compare an archived timestamp to a
            // current clock or renew it. Do not normalize the supplied string.
            VaultTimestamps.epochMillis(originalQueryTimestamp,FAILURE);
            original=exactOriginalQueryBody.clone();
            JSONObject query=ProviderWireJson.object(original,MAX_ORIGINAL);
            NativeRetainedAttempt.keys(query,QUERY_KEYS);
            if(!QUERY_SCHEMA.equals(query.get("schema")))throw invalid();
            for(String key:QUERY_KEYS)if(!(query.get(key) instanceof String)||((String)query.get(key)).isEmpty())throw invalid();
            encoded=new JSONObject().put("schema",SCHEMA)
                .put("original_query_body_base64",NativeRetainedAttempt.encodeBase64(original))
                .put("original_query_timestamp",originalQueryTimestamp)
                .put("original_query_http_attestation",originalHttpAttestation)
                .put("original_query_unknown_record_sha256",issuedQueryUnknownRecordSha256)
                .toString().getBytes(StandardCharsets.UTF_8);
            if(encoded.length>MAX_ENVELOPE)throw invalid();
            byte[] result=encoded;encoded=null;return result;
        }catch(Exception failure){
            if(failure instanceof VaultFailure&&FAILURE.equals(((VaultFailure)failure).code))throw (VaultFailure)failure;
            throw new VaultFailure(FAILURE,failure);
        }finally{
            if(original!=null)Arrays.fill(original,(byte)0);
            if(encoded!=null)Arrays.fill(encoded,(byte)0);
        }
    }
    private static boolean sha(String value){return value!=null&&value.length()==64&&value.matches("[a-f0-9]{64}");}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
