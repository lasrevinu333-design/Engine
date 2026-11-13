package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Fixed manifest-chunk response REPRESENTATION ONLY. Matching original bytes,
 * pins and digests cannot authenticate the native issuer, HMAC, TLS peer or
 * SQL transaction. No send, retry, currentness, ACK or finalizer capability. */
final class NativeOriginalInventoryManifestChunkWire {
    static final String FAILURE="native_original_inventory_manifest_chunk_wire_invalid";
    static final int MAX_BODY=65536,MAX_RESPONSE=65536,CHUNK_BYTES=32768;
    private static final int MAX_MANIFEST_BYTES=16777216,MAX_CHUNKS=512;
    private static final String REQUEST_SCHEMA="custodial.original-native-inventory-manifest-chunk.v1";
    private static final String PURPOSE="RETAIN_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK";
    private static final String PURPOSE_VERSION="custodial.native-original-inventory-manifest-chunk-purpose.v1";
    private static final String RECEIPT_SCHEMA="custodial.native-original-inventory-manifest-chunk-registration.v1";
    private static final String STATE="CHUNK_RETAINED_NOT_ACK";
    private static final String RECEIPT_VERSION="custodial.native-original-inventory-manifest-chunk-receipt.v1";
    private static final Pattern UUID=Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern SHA=Pattern.compile("[a-f0-9]{64}");
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released"};
    private NativeOriginalInventoryManifestChunkWire(){}

    /** Detached untrusted receipt DATA only; no authority is retained here.
     * close wipes our encoded buffer, not immutable Java strings or copies
     * that the caller already obtained from json(). */
    static final class UntrustedChunkRetention implements AutoCloseable {
        private byte[] encoded;
        private boolean closed;
        private UntrustedChunkRetention(JSONObject receipt)throws Exception {
            encoded=utf8(receipt.toString(),MAX_RESPONSE);
        }
        synchronized JSONObject json()throws VaultFailure {
            if(closed||encoded==null)throw invalid();
            byte[] copy=encoded.clone();
            try{return ProviderWireJson.object(copy,MAX_RESPONSE);}
            catch(Exception malformed){throw invalid();}
            finally{Arrays.fill(copy,(byte)0);}
        }
        @Override public synchronized void close(){
            closed=true;if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;
        }
    }

    static UntrustedChunkRetention decode(byte[] exactOriginalSentBody,String originalNativeRequestId,
        String originalNativeRequestTimestamp,int actualHttpStatus,byte[] actualResponse)throws VaultFailure {
        if(actualHttpStatus!=200||exactOriginalSentBody==null||actualResponse==null
            ||exactOriginalSentBody.length<1||exactOriginalSentBody.length>MAX_BODY
            ||actualResponse.length<1||actualResponse.length>MAX_RESPONSE)throw invalid();
        byte[] body=exactOriginalSentBody.clone(),response=actualResponse.clone();
        try{
            JSONObject request=validateOriginal(body,originalNativeRequestId,originalNativeRequestTimestamp);
            long issued=millisecondMicros(originalNativeRequestTimestamp);
            String parent=text(request,"inventory_native_request_id"),manifest=text(request,"manifest_sha256");
            String pieceSha=text(request,"chunk_sha256");
            String rawBodySha=NativeRetainedAttempt.hash(body);

            JSONObject wrapper=ProviderWireJson.object(response,MAX_RESPONSE);
            NativeRetainedAttempt.keys(wrapper,"ok","data");
            if(!Boolean.TRUE.equals(wrapper.get("ok")))throw invalid();
            JSONObject receipt=object(wrapper,"data");
            NativeRetainedAttempt.keys(receipt,"schema","state","inventory_native_request_id","manifest_sha256","manifest_chunk_index",
                "chunk_sha256","native_request_id","request_body_sha256","registered_at","receipt_sha256","limits");
            literal(receipt,"schema",RECEIPT_SCHEMA);literal(receipt,"state",STATE);
            if(!parent.equals(match(receipt,"inventory_native_request_id",UUID))
                ||!manifest.equals(match(receipt,"manifest_sha256",SHA))
                ||!text(request,"manifest_chunk_index").equals(text(receipt,"manifest_chunk_index"))
                ||!pieceSha.equals(match(receipt,"chunk_sha256",SHA))
                ||!originalNativeRequestId.equals(match(receipt,"native_request_id",UUID))
                ||!rawBodySha.equals(match(receipt,"request_body_sha256",SHA)))throw invalid();
            JSONObject limits=object(receipt,"limits");NativeRetainedAttempt.keys(limits,EFFECTS);
            for(String field:EFFECTS)if(!Boolean.FALSE.equals(limits.get(field)))throw invalid();
            String registeredText=text(receipt,"registered_at");
            long registered=NativeSameOriginalRecoveryPreparationWire.instantMicros(registeredText);
            if(registered<issued-30000000L||registered>issued+120000000L)throw invalid();
            if(!match(receipt,"receipt_sha256",SHA).equals(transcript(RECEIPT_VERSION,parent,manifest,
                text(request,"manifest_chunk_index"),pieceSha,originalNativeRequestId,rawBodySha,registeredText)))throw invalid();
            return new UntrustedChunkRetention(receipt);
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(body,(byte)0);Arrays.fill(response,(byte)0);
        }
    }

    /** Detached original-body REPRESENTATION only, shared with fixed READ
     * envelopes. Caller IDs/time attestations are not authenticated here.
     * No signing, source/currentness or dispatch capability is returned. */
    static JSONObject validateOriginal(byte[] exactOriginalSentBody,String originalNativeRequestId,
        String originalNativeRequestTimestamp)throws VaultFailure {
        if(exactOriginalSentBody==null||exactOriginalSentBody.length<1||exactOriginalSentBody.length>MAX_BODY)throw invalid();
        byte[] body=exactOriginalSentBody.clone(),piece=null,targetBytes=null;
        try{
            if(originalNativeRequestId==null||!UUID.matcher(originalNativeRequestId).matches())throw invalid();
            millisecondMicros(originalNativeRequestTimestamp);
            JSONObject request=ProviderWireJson.object(body,MAX_BODY);
            NativeRetainedAttempt.keys(request,"schema","purpose","inventory_native_request_id","registration_request_body_sha256",
                "intent_document_sha256","intent_disk_sha256","original_target","manifest_sha256","manifest_byte_count",
                "manifest_chunk_count","manifest_chunk_index","chunk_base64","chunk_sha256","purpose_binding_sha256","purpose_attestation");
            literal(request,"schema",REQUEST_SCHEMA);literal(request,"purpose",PURPOSE);
            String parent=match(request,"inventory_native_request_id",UUID);
            if(parent.equals(originalNativeRequestId))throw invalid();
            String registrationBody=match(request,"registration_request_body_sha256",SHA);
            String intentDocument=match(request,"intent_document_sha256",SHA),intentDisk=match(request,"intent_disk_sha256",SHA);
            String manifest=match(request,"manifest_sha256",SHA),pieceSha=match(request,"chunk_sha256",SHA);
            String purposeBinding=match(request,"purpose_binding_sha256",SHA);
            match(request,"purpose_attestation",SHA); // Representation ONLY, not an HMAC check.
            // Encoding is solely for the existing closed typed target parser.
            // Never substitute it for exactOriginalSentBody or its raw SHA.
            targetBytes=utf8(object(request,"original_target").toString(),MAX_BODY);
            NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes);
            int bytes=count(request,"manifest_byte_count",MAX_MANIFEST_BYTES,false);
            int parts=count(request,"manifest_chunk_count",MAX_CHUNKS,false);
            int index=count(request,"manifest_chunk_index",MAX_CHUNKS-1,true);
            if(parts!=(bytes+CHUNK_BYTES-1)/CHUNK_BYTES||index>=parts)throw invalid();
            piece=NativeRetainedAttempt.base64(text(request,"chunk_base64"),CHUNK_BYTES);
            if(piece.length!=Math.min(CHUNK_BYTES,bytes-index*CHUNK_BYTES)
                ||!pieceSha.equals(NativeRetainedAttempt.hash(piece)))throw invalid();
            if(!purposeBinding.equals(transcript(PURPOSE_VERSION,parent,registrationBody,intentDocument,intentDisk,
                manifest,text(request,"manifest_byte_count"),text(request,"manifest_chunk_count"),text(request,"manifest_chunk_index"),pieceSha)))throw invalid();
            return request;
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(body,(byte)0);
            if(piece!=null)Arrays.fill(piece,(byte)0);if(targetBytes!=null)Arrays.fill(targetBytes,(byte)0);
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
    private static int count(JSONObject value,String key,int maximum,boolean zero)throws Exception {
        String raw=text(value,key);
        if(raw.length()>8||!raw.matches(zero?"0|[1-9][0-9]*":"[1-9][0-9]*"))throw invalid();
        int number=Integer.parseInt(raw);if(number>maximum)throw invalid();return number;
    }
    private static long millisecondMicros(String value)throws VaultFailure {
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"))throw invalid();
        return NativeSameOriginalRecoveryPreparationWire.instantMicros(value.substring(0,value.length()-1)+"000Z");
    }
    private static byte[] utf8(String text,int maximum)throws Exception {
        if(text==null||text.length()>maximum)throw invalid();
        ByteBuffer buffer=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(text));
        try{if(buffer.remaining()<1||buffer.remaining()>maximum)throw invalid();byte[] out=new byte[buffer.remaining()];buffer.get(out);return out;}
        finally{if(buffer.hasArray())Arrays.fill(buffer.array(),(byte)0);}
    }
    private static String transcript(String... fields)throws Exception {
        byte[] bytes=utf8(String.join("\n",fields),MAX_BODY);
        try{return NativeRetainedAttempt.hash(bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
