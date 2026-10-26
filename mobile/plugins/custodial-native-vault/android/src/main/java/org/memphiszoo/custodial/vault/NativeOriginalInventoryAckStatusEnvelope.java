package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Fixed same-original status READ envelope DATA only. Representation and
 * digest checks do not authenticate a native owner, HMAC, current principal,
 * TLS peer or transaction. No clock, signer, send, retry or ACK authority. */
final class NativeOriginalInventoryAckStatusEnvelope {
    static final String PATH="/device-auth/original-inventory-ack-status";
    static final String APPROVAL_PATH="/device-auth/original-inventory-separation-approval-status";
    static final int MAX_OUTPUT=196608;
    static final String FAILURE="native_original_inventory_status_envelope_invalid";
    private static final int MAX_ORIGINAL=131072,MAX_BODY=65536,MAX_INTENT=16384;
    private static final String SCHEMA="custodial.original-native-inventory-registration-status.v1";
    private static final String PURPOSE="READ_EXACT_ORIGINAL_INVENTORY_REQUEST";
    private static final String PURPOSE_VERSION="custodial.native-original-inventory-ack-purpose.v1";
    private static final Pattern UUID=Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern SHA=Pattern.compile("[a-f0-9]{64}");
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released"};
    private NativeOriginalInventoryAckStatusEnvelope(){}

    /** Own a bounded snapshot and preserve the archived raw HTTP body, its
     * original timestamp and signature exactly. A fresh outer READ signature
     * belongs to Main's typed transport, never to this DATA encoder. */
    static byte[] encode(byte[] originalSavedRequestDocument)throws VaultFailure {
        return encodeFixed(originalSavedRequestDocument,false);
    }
    static byte[] encodeApprovalStatus(byte[] originalSavedRequestDocument)throws VaultFailure {
        return encodeFixed(originalSavedRequestDocument,true);
    }
    private static byte[] encodeFixed(byte[] originalSavedRequestDocument,boolean approval)throws VaultFailure {
        if(originalSavedRequestDocument==null||originalSavedRequestDocument.length<1
            ||originalSavedRequestDocument.length>MAX_ORIGINAL)throw invalid();
        byte[] original=originalSavedRequestDocument.clone(),body=null,intentBytes=null,targetBytes=null;
        try{
            JSONObject saved=ProviderWireJson.object(original,MAX_ORIGINAL);
            NativeRetainedAttempt.keys(saved,"schema","purpose","intent_disk_sha256","intent_document_sha256",
                "native_request_id","native_request_timestamp","request_body_base64","request_body_sha256","request_attestation",
                "inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released");
            literal(saved,"schema",VaultEngine.NativeOriginalInventoryAckRequestControl.SCHEMA);
            literal(saved,"purpose",VaultEngine.NativeOriginalInventoryAckRequestControl.PURPOSE);
            String id=match(saved,"native_request_id",UUID),timestamp=text(saved,"native_request_timestamp");
            long issued=millisecondMicros(timestamp);
            String bodySha=match(saved,"request_body_sha256",SHA),attestation=match(saved,"request_attestation",SHA);
            String intentSha=match(saved,"intent_document_sha256",SHA),intentDisk=match(saved,"intent_disk_sha256",SHA);
            effects(saved);
            body=NativeRetainedAttempt.base64(text(saved,"request_body_base64"),MAX_BODY);
            if(!bodySha.equals(NativeRetainedAttempt.hash(body)))throw invalid();
            JSONObject request=ProviderWireJson.object(body,MAX_BODY);
            NativeRetainedAttempt.keys(request,"schema","purpose","original_intent_utf8","original_intent_disk_sha256",
                "original_intent_document_sha256","original_preparation_native_request_id","original_preparation_request_body_sha256",
                "original_preparation_http_attestation","purpose_binding_sha256","purpose_attestation");
            literal(request,"schema","custodial.original-native-inventory-ack-request.v1");
            literal(request,"purpose",VaultEngine.NativeOriginalInventoryAckRequestControl.PURPOSE);
            if(!intentDisk.equals(match(request,"original_intent_disk_sha256",SHA))
                ||!intentSha.equals(match(request,"original_intent_document_sha256",SHA)))throw invalid();
            String preparation=match(request,"original_preparation_native_request_id",UUID);
            String preparationBody=match(request,"original_preparation_request_body_sha256",SHA);
            String preparationAttestation=match(request,"original_preparation_http_attestation",SHA);
            match(request,"purpose_attestation",SHA); // shape only, NEVER HMAC authentication
            if(!match(request,"purpose_binding_sha256",SHA).equals(hashTranscript(
                PURPOSE_VERSION,intentDisk,intentSha,preparation,preparationBody,preparationAttestation)))throw invalid();
            // Hash the exact original intent text, not a normalized object.
            intentBytes=utf8(text(request,"original_intent_utf8"),MAX_INTENT);
            if(!intentSha.equals(NativeRetainedAttempt.hash(intentBytes)))throw invalid();
            JSONObject intent=ProviderWireJson.object(intentBytes,MAX_INTENT);
            NativeRetainedAttempt.keys(intent,"schema","purpose","intent_id","original_target","native_held_stamp",
                "browser_frame_sha256","browser_part_set_sha256","created_at","inventory_acknowledged","work_accepted",
                "replay_allowed","finalizer_allowed","key_removal","phone_released");
            literal(intent,"schema",VaultEngine.NativeOriginalInventoryAckIntentControl.SCHEMA);
            literal(intent,"purpose",VaultEngine.NativeOriginalInventoryAckIntentControl.PURPOSE);
            if(!id.equals(match(intent,"intent_id",UUID)))throw invalid();
            match(intent,"browser_frame_sha256",SHA);match(intent,"browser_part_set_sha256",SHA);effects(intent);
            String held=text(intent,"native_held_stamp");
            if(!held.matches("DURABLE_HELD:[1-9][0-9]{0,18}")||Long.parseLong(held.substring(13))<1)throw invalid();
            if(millisecondMicros(text(intent,"created_at"))>issued)throw invalid();
            // Only detached target-shape DATA is structurally encoded. This
            // cannot replace the original intent or original HTTP body bytes.
            targetBytes=utf8(object(intent,"original_target").toString(),65536);
            NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes);
            String rawBody=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(body)).toString();
            JSONObject envelope=new JSONObject().put("schema",approval?
                "custodial.original-native-inventory-separation-approval-status.v1":SCHEMA)
                .put("purpose",approval?"READ_CURRENT_EXACT_ORIGINAL_INVENTORY_SEPARATION_APPROVAL":PURPOSE)
                .put("original_request_utf8",rawBody).put("original_request_timestamp",timestamp)
                .put("original_request_attestation",attestation);
            return utf8(envelope.toString(),MAX_OUTPUT);
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(original,(byte)0);if(body!=null)Arrays.fill(body,(byte)0);
            if(intentBytes!=null)Arrays.fill(intentBytes,(byte)0);if(targetBytes!=null)Arrays.fill(targetBytes,(byte)0);
        }
    }

    private static String text(JSONObject value,String key)throws Exception {
        Object raw=value.get(key);if(!(raw instanceof String))throw invalid();return (String)raw;
    }
    private static JSONObject object(JSONObject value,String key)throws Exception {
        Object raw=value.get(key);if(!(raw instanceof JSONObject))throw invalid();return (JSONObject)raw;
    }
    private static String match(JSONObject value,String key,Pattern pattern)throws Exception {
        String raw=text(value,key);if(!pattern.matcher(raw).matches())throw invalid();return raw;
    }
    private static void literal(JSONObject value,String key,String expected)throws Exception {
        if(!expected.equals(text(value,key)))throw invalid();
    }
    private static void effects(JSONObject value)throws Exception {
        for(String key:EFFECTS)if(!Boolean.FALSE.equals(value.get(key)))throw invalid();
    }
    private static long millisecondMicros(String text)throws VaultFailure {
        if(text==null||!text.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"))throw invalid();
        return NativeSameOriginalRecoveryPreparationWire.instantMicros(text.substring(0,text.length()-1)+"000Z");
    }
    private static byte[] utf8(String text,int maximum)throws Exception {
        if(text==null||text.length()>maximum)throw invalid();
        ByteBuffer buffer=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(text));
        try{if(buffer.remaining()<1||buffer.remaining()>maximum)throw invalid();byte[] bytes=new byte[buffer.remaining()];buffer.get(bytes);return bytes;}
        finally{if(buffer.hasArray())Arrays.fill(buffer.array(),(byte)0);}
    }
    private static String hashTranscript(String... fields)throws Exception {
        byte[] bytes=utf8(String.join("\n",fields),MAX_ORIGINAL);
        try{return NativeRetainedAttempt.hash(bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
