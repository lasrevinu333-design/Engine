package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import org.json.JSONObject;

/** Fixed-reader REPRESENTATION ONLY. This parser neither authenticates a
 * manager/session nor admits a transaction, native capability or effect.
 * Main's owning transport/currentness code must admit the original source.
 */
final class NativeSameOriginalRecoveryManagerPreparationWire {
    static final String SCHEMA="custodial.same-original-current-manager-preparation.v1";
    static final String STATE="CURRENT_MANAGER_PREPARATION_OBSERVED_NO_EFFECT_RIGHTS";
    static final String FAILURE="same_original_manager_preparation_wire_invalid";
    static final int MAX_SQL_BYTES=65536,MAX_RESPONSE_BYTES=131072,MAX_RECEIPT_BYTES=24576;
    private static final Set<String> FIELDS=Set.of("schema","state","purpose_admission_id",
        "original_registration_utf8","original_approval_receipt_utf8","observed_at","current_until",
        "transaction_authority","limits");
    private static final Set<String> LIMITS=Set.of("inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released");
    private NativeSameOriginalRecoveryManagerPreparationWire(){}

    /** Detached data only; there is deliberately no permission/currentness API. */
    static final class UntrustedObservation {
        private final String originalRepresentation;
        private UntrustedObservation(String originalRepresentation){this.originalRepresentation=originalRepresentation;}
        JSONObject json()throws VaultFailure {
            byte[] bytes=originalRepresentation.getBytes(StandardCharsets.UTF_8);
            try{return ProviderWireJson.object(bytes,MAX_SQL_BYTES);}
            finally{Arrays.fill(bytes,(byte)0);}
        }
    }

    static UntrustedObservation decodeResponse(byte[] raw,String expectedIntentId,String expectedIntentRecordSha,
        String expectedTargetSha,String expectedBodySha,String expectedAttestationDigest,String expectedOriginalTimestamp,
        NativeSameOriginalRecoveryPreparationWire.UntrustedTarget expectedTarget)throws VaultFailure {
        if(raw==null||raw.length<1||raw.length>MAX_RESPONSE_BYTES||expectedTarget==null)throw invalid();
        byte[] snapshot=raw.clone(),representation=null,registration=null,approval=null,registrationResponse=null;
        try{
            if(!expectedTarget.documentSha256().equals(expectedTargetSha))throw invalid();
            var wrapper=ProviderWireJson.object(snapshot,MAX_RESPONSE_BYTES);shape(wrapper,Set.of("ok","data"));
            if(!Boolean.TRUE.equals(wrapper.get("ok")))throw invalid();
            var value=object(wrapper,"data");shape(value,FIELDS);
            // Sole depth-two object is data, established by the closed wrapper.
            // Measure its ORIGINAL byte span, never reserialized JSON length.
            representation=dataBytes(snapshot);
            literal(value,"schema",SCHEMA);literal(value,"state",STATE);
            literal(value,"purpose_admission_id",NativeSameOriginalRecoveryPreparationWire.ADMISSION);
            if(!Boolean.FALSE.equals(value.get("transaction_authority")))throw invalid();
            var limits=object(value,"limits");shape(limits,LIMITS);
            for(String key:LIMITS)if(!Boolean.FALSE.equals(limits.get(key)))throw invalid();
            registration=receiptBytes(text(value,"original_registration_utf8"));
            approval=receiptBytes(text(value,"original_approval_receipt_utf8"));
            // Existing registration decoder receives EXACT original receipt
            // bytes, including whitespace, not JSONObject.toString() output.
            byte[] prefix="{\"ok\":true,\"data\":".getBytes(StandardCharsets.US_ASCII);
            registrationResponse=new byte[prefix.length+registration.length+1];
            System.arraycopy(prefix,0,registrationResponse,0,prefix.length);
            System.arraycopy(registration,0,registrationResponse,prefix.length,registration.length);
            registrationResponse[registrationResponse.length-1]='}';
            var registered=NativeSameOriginalRecoveryPreparationWire.decodeNativeRegistrationResponse(registrationResponse,
                expectedIntentId,expectedIntentRecordSha,expectedTargetSha,expectedBodySha,
                expectedAttestationDigest,expectedOriginalTimestamp).json();
            var parsedApproval=NativeSameOriginalRecoveryPreparationWire.decodeReceipt(approval);
            var approved=parsedApproval.json();var request=parsedApproval.originalRequest().json();
            if(!ProviderWireJson.same(expectedTarget.json(),parsedApproval.originalTarget().json())
                ||!expectedTargetSha.equals(parsedApproval.originalTarget().documentSha256())
                ||!expectedIntentId.equals(text(request,"challenge_id"))
                ||!text(registered,"challenge_sha256").equals(text(approved,"challenge_sha256")))throw invalid();
            // decodeReceipt already checks request/receipt document SHA and
            // exact issuer↔original-request fields. Registration has no manager
            // issuer: no trusted actor is invented from its native principal.
            String preview=originalPreviewSha(registered,expectedTarget);
            if(!preview.equals(text(approved,"preview_sha256"))
                ||!preview.equals(text(request,"expected_preview_sha256")))throw invalid();
            long observed=time(value,"observed_at"),until=time(value,"current_until");
            long registeredAt=time(registered,"registered_at"),registrationExpiry=time(registered,"expires_at");
            long issued=time(approved,"issued_at"),approvalExpiry=time(approved,"expires_at");
            if(issued<registeredAt||approvalExpiry>registrationExpiry||observed<issued||observed<registeredAt
                ||observed>=until||until>registrationExpiry||until>approvalExpiry)throw invalid();
            // Preserve the exact original receipt STRINGS and representation.
            // No local clock, expiry renewal, signing, IO or accepted flag.
            return new UntrustedObservation(utf8(representation));
        }catch(Exception failure){throw invalid();}
        finally{for(byte[] bytes:new byte[][]{snapshot,representation,registration,approval,registrationResponse})
            if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    }

    private static byte[] dataBytes(byte[] raw)throws VaultFailure {
        boolean quoted=false,escaped=false;int depth=0,start=-1;
        for(int i=0;i<raw.length;i++){
            int b=raw[i]&255;
            if(quoted){if(escaped)escaped=false;else if(b=='\\')escaped=true;else if(b=='"')quoted=false;continue;}
            if(b=='"'){quoted=true;continue;}
            if(b=='{'){depth++;if(depth==2)start=i;}
            else if(b=='}'){if(depth==2&&start>=0){if(i-start+1>MAX_SQL_BYTES)throw invalid();return Arrays.copyOfRange(raw,start,i+1);}depth--;}
        }
        throw invalid();
    }
    private static byte[] receiptBytes(String raw)throws VaultFailure {
        byte[] bytes=raw.getBytes(StandardCharsets.UTF_8);
        if(bytes.length<1||bytes.length>MAX_RECEIPT_BYTES){Arrays.fill(bytes,(byte)0);throw invalid();}
        return bytes;
    }
    /** Fixed SQL273 preview transcript, not a general canonical serializer.
     * Original-target canonical bytes come from the existing wire module.
     * All other dynamic values were validated UUID/SHA/civil strings above.
     */
    private static String originalPreviewSha(JSONObject registration,
        NativeSameOriginalRecoveryPreparationWire.UntrustedTarget target)throws Exception {
        byte[] targetBytes=target.documentBytes(),input=null,hash=null;
        try{
            String encoded=utf8(targetBytes),prefix="custodial.same-original-recovery-target.v1\n";
            if(!encoded.startsWith(prefix))throw invalid();
            String transcript="custodial.same-original-recovery-preview.v1\n{\"challenge_id\":\""+text(registration,"challenge_id")
                +"\",\"challenge_sha256\":\""+text(registration,"challenge_sha256")+"\",\"expires_at\":\""+text(registration,"expires_at")
                +"\",\"limits\":{\"finalizer_allowed\":false,\"inventory_acknowledged\":false,\"key_removal\":false,\"phone_released\":false,\"replay_allowed\":false,\"work_accepted\":false},\"original_target\":"
                +encoded.substring(prefix.length())+",\"purpose\":\"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION\",\"schema\":\"custodial.same-original-recovery-review.v1\",\"state\":\"ORIGINAL_BINDING_REVIEW_ONLY\"}";
            input=transcript.getBytes(StandardCharsets.UTF_8);hash=MessageDigest.getInstance("SHA-256").digest(input);
            var hex=new StringBuilder(64);for(byte b:hash){hex.append(Character.forDigit((b>>>4)&15,16));hex.append(Character.forDigit(b&15,16));}
            return hex.toString();
        }finally{Arrays.fill(targetBytes,(byte)0);if(input!=null)Arrays.fill(input,(byte)0);if(hash!=null)Arrays.fill(hash,(byte)0);}
    }
    private static String utf8(byte[] raw)throws Exception {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(raw)).toString();
    }
    private static void shape(JSONObject value,Set<String> keys)throws VaultFailure {
        var names=new java.util.HashSet<String>();var iterator=value.keys();
        while(iterator.hasNext()){var key=iterator.next();if(!keys.contains(key)||!names.add(key))throw invalid();}
        if(!names.equals(keys))throw invalid();
    }
    private static JSONObject object(JSONObject value,String key)throws VaultFailure {
        Object item=value.opt(key);if(!(item instanceof JSONObject))throw invalid();return (JSONObject)item;
    }
    private static String text(JSONObject value,String key)throws VaultFailure {
        Object item=value.opt(key);if(!(item instanceof String))throw invalid();return (String)item;
    }
    private static void literal(JSONObject value,String key,String literal)throws VaultFailure {if(!literal.equals(text(value,key)))throw invalid();}
    private static long time(JSONObject value,String key)throws VaultFailure {return NativeSameOriginalRecoveryPreparationWire.instantMicros(text(value,key));}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
