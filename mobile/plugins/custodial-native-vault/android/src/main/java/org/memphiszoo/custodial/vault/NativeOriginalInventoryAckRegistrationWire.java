package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Strict registration-response REPRESENTATION ONLY. Matching bytes/digests
 * cannot authenticate a native issuer, HMAC, TLS peer, manager or transaction.
 * No currentness, send, ACK, finalizer, credential or key capability is minted.
 */
final class NativeOriginalInventoryAckRegistrationWire {
    static final String FAILURE="native_original_inventory_registration_wire_invalid";
    static final int MAX_ORIGINAL=131072,MAX_RESPONSE=131072;
    private static final String SCHEMA="custodial.native-original-inventory-request-registration.v1";
    private static final String STATE="REGISTERED_REQUEST_ONLY_NOT_ACK";
    private static final String DIGEST_VERSION="custodial.native-original-inventory-request-registration-digest.v1";
    private static final String PURPOSE_VERSION="custodial.native-original-inventory-ack-purpose.v1";
    private static final Pattern UUID=Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern SHA=Pattern.compile("[a-f0-9]{64}");
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released"};
    private NativeOriginalInventoryAckRegistrationWire(){}

    /** A detached DATA receipt, deliberately not usable as private evidence. */
    static final class UntrustedRegistration implements AutoCloseable {
        private byte[] fields;
        private volatile boolean closed;
        private UntrustedRegistration(JSONObject value)throws Exception {
            fields=utf8(value.toString(),MAX_RESPONSE);
        }
        JSONObject json()throws VaultFailure {
            byte[] owned=fields;
            if(closed||owned==null)throw invalid();
            byte[] snapshot=owned.clone();
            try{JSONObject detached=ProviderWireJson.object(snapshot,MAX_RESPONSE);if(closed)throw invalid();return detached;}
            catch(Exception malformed){throw invalid();}
            finally{Arrays.fill(snapshot,(byte)0);}
        }
        @Override public void close(){closed=true;if(fields!=null)Arrays.fill(fields,(byte)0);fields=null;}
    }

    static UntrustedRegistration decode(byte[] originalSavedRequestDocument,int actualHttpStatus,byte[] response)throws VaultFailure {
        if(actualHttpStatus!=200||originalSavedRequestDocument==null||response==null
            ||originalSavedRequestDocument.length<1||originalSavedRequestDocument.length>MAX_ORIGINAL
            ||response.length<1||response.length>MAX_RESPONSE)throw invalid();
        byte[] original=originalSavedRequestDocument.clone(),raw=response.clone(),body=null,intentBytes=null,targetBytes=null;
        try {
            JSONObject saved=ProviderWireJson.object(original,MAX_ORIGINAL);
            NativeRetainedAttempt.keys(saved,"schema","purpose","intent_disk_sha256","intent_document_sha256",
                "native_request_id","native_request_timestamp","request_body_base64","request_body_sha256","request_attestation",
                "inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released");
            literal(saved,"schema",VaultEngine.NativeOriginalInventoryAckRequestControl.SCHEMA);
            literal(saved,"purpose",VaultEngine.NativeOriginalInventoryAckRequestControl.PURPOSE);
            String id=match(saved,"native_request_id",UUID);
            String bodySha=match(saved,"request_body_sha256",SHA);
            String intentSha=match(saved,"intent_document_sha256",SHA),intentDisk=match(saved,"intent_disk_sha256",SHA);
            match(saved,"request_attestation",SHA);effects(saved);
            long issued=millisecondMicros(text(saved,"native_request_timestamp"));
            body=NativeRetainedAttempt.base64(text(saved,"request_body_base64"),VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_BODY);
            if(!bodySha.equals(NativeRetainedAttempt.hash(body)))throw invalid();
            JSONObject request=ProviderWireJson.object(body,VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_BODY);
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
            String purposeBinding=match(request,"purpose_binding_sha256",SHA);
            match(request,"purpose_attestation",SHA); // shape only; no credential/HMAC authentication here
            if(!purposeBinding.equals(hashTranscript(PURPOSE_VERSION,intentDisk,intentSha,preparation,preparationBody,preparationAttestation)))throw invalid();
            // These exact UTF8 bytes are the original intent string, not a
            // JSONObject reserialization. The body hash above uses raw bytes too.
            intentBytes=utf8(text(request,"original_intent_utf8"),16384);
            if(!intentSha.equals(NativeRetainedAttempt.hash(intentBytes)))throw invalid();
            JSONObject intent=ProviderWireJson.object(intentBytes,16384);
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
            // Only closed target shape validation uses a detached structural
            // encoding. It never replaces original request/intent bytes or hashes.
            targetBytes=utf8(object(intent,"original_target").toString(),65536);
            JSONObject target=NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes).json();
            String operation=text(target,"operation_id"),generation=text(target,"original_generation_id");

            JSONObject wrapper=ProviderWireJson.object(raw,MAX_RESPONSE);
            NativeRetainedAttempt.keys(wrapper,"ok","data");
            if(!Boolean.TRUE.equals(wrapper.get("ok")))throw invalid();
            JSONObject receipt=object(wrapper,"data");
            NativeRetainedAttempt.keys(receipt,"schema","state","native_request_id","operation_id","original_generation_id",
                "request_body_sha256","intent_document_sha256","intent_disk_sha256","registered_at","receipt_sha256","limits");
            literal(receipt,"schema",SCHEMA);literal(receipt,"state",STATE);
            if(!id.equals(match(receipt,"native_request_id",UUID))
                ||!operation.equals(match(receipt,"operation_id",UUID))
                ||!generation.equals(match(receipt,"original_generation_id",UUID))
                ||!bodySha.equals(match(receipt,"request_body_sha256",SHA))
                ||!intentSha.equals(match(receipt,"intent_document_sha256",SHA))
                ||!intentDisk.equals(match(receipt,"intent_disk_sha256",SHA)))throw invalid();
            JSONObject limits=object(receipt,"limits");NativeRetainedAttempt.keys(limits,EFFECTS);effects(limits);
            String registeredText=text(receipt,"registered_at");
            long registered=NativeSameOriginalRecoveryPreparationWire.instantMicros(registeredText);
            if(registered<issued-30000000L||registered>issued+120000000L)throw invalid();
            String digest=hashTranscript(DIGEST_VERSION,id,operation,generation,bodySha,intentSha,intentDisk,registeredText);
            if(!digest.equals(match(receipt,"receipt_sha256",SHA)))throw invalid();
            return new UntrustedRegistration(receipt);
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(original,(byte)0);Arrays.fill(raw,(byte)0);
            if(body!=null)Arrays.fill(body,(byte)0);if(intentBytes!=null)Arrays.fill(intentBytes,(byte)0);
            if(targetBytes!=null)Arrays.fill(targetBytes,(byte)0);
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
