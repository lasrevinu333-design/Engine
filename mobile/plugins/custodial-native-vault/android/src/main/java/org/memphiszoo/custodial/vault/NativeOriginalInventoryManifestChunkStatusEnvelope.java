package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

/** Fixed READ envelope DATA only. Original signature shape is not proof of
 * HMAC validity, current principal, registration, ACK or dispatch authority. */
final class NativeOriginalInventoryManifestChunkStatusEnvelope {
    static final String PATH="/device-auth/original-inventory-manifest-chunk-status";
    static final int MAX_OUTPUT=196608;
    private static final String SCHEMA="custodial.original-native-inventory-manifest-chunk-status.v1";
    private static final String PURPOSE="READ_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK";
    private NativeOriginalInventoryManifestChunkStatusEnvelope(){}

    static byte[] encode(byte[] exactOriginalSentBody,String originalNativeRequestId,
        String originalNativeRequestTimestamp,String originalRequestAttestation)throws VaultFailure {
        if(exactOriginalSentBody==null||exactOriginalSentBody.length<1
            ||exactOriginalSentBody.length>NativeOriginalInventoryManifestChunkWire.MAX_BODY)throw invalid();
        byte[] original=exactOriginalSentBody.clone();ByteBuffer encoded=null;
        try{
            if(originalRequestAttestation==null||!originalRequestAttestation.matches("[a-f0-9]{64}"))throw invalid();
            // One closed original parser, including target, piece, purpose
            // transcript, archived ID and Gregorian original timestamp.
            NativeOriginalInventoryManifestChunkWire.validateOriginal(original,originalNativeRequestId,originalNativeRequestTimestamp);
            String exactText=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(original)).toString();
            // Do NOT reserialize the parsed original. Whitespace/escape spelling
            // and the original timestamp/signature are kept byte-for-byte DATA.
            String document=new JSONObject().put("schema",SCHEMA).put("purpose",PURPOSE)
                .put("original_request_utf8",exactText).put("original_request_timestamp",originalNativeRequestTimestamp)
                .put("original_request_attestation",originalRequestAttestation).toString();
            encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(document));
            if(encoded.remaining()<1||encoded.remaining()>MAX_OUTPUT)throw invalid();
            byte[] result=new byte[encoded.remaining()];encoded.get(result);return result;
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(original,(byte)0);
            if(encoded!=null&&encoded.hasArray())Arrays.fill(encoded.array(),(byte)0);
        }
    }
    private static VaultFailure invalid(){return new VaultFailure(NativeOriginalInventoryManifestChunkWire.FAILURE);}
}
