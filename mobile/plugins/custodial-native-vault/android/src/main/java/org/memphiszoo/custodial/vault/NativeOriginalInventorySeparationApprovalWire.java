package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Closed receipt REPRESENTATION ONLY. Even ACK/finalizer fields below are
 * untrusted server-reported DATA, not effect admission. This codec has no
 * current-manager/clock/HMAC/SQL authentication and cannot mint a capability.
 * The original manager command's raw UTF8 is unavailable: its digest is shape
 * checked, NEVER recomputed by serializing the nested original_request object.
 */
final class NativeOriginalInventorySeparationApprovalWire {
    static final String FAILURE="native_original_inventory_separation_approval_wire_invalid";
    static final int MAX_TARGET=65536,MAX_RESPONSE=24576;
    private static final String PURPOSE="AUTHORIZE_EXACT_ORIGINAL_RETAINED_INVENTORY_SEPARATION";
    private static final String CONFIRMATION="CONFIRM_LOGICAL_SEPARATION_KEEP_ALL_ORIGINAL_WORK_AND_KEYS";
    private static final Pattern UUID=Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern SHA=Pattern.compile("[a-f0-9]{64}");
    private static final Pattern DEVICE=Pattern.compile("[A-Za-z0-9_-]{1,128}");
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released"};
    private NativeOriginalInventorySeparationApprovalWire(){}

    /** Plausibility from the owning read's observations ONLY, not proof of a
     * genuine clock/current manager/SQL decision or any native effect right. */
    static UntrustedApproval decodeCurrent(byte[] expectedOriginalTargetUtf8,String expectedInventoryNativeRequestId,
            String expectedManifestSha256,String expectedRegistrationReceiptSha256,
            int actualHttpStatus,byte[] responseUtf8,long readStartedEpochMillis,
            long elapsedNanos,long observedEpochMillis)throws VaultFailure {
        UntrustedApproval result=decode(expectedOriginalTargetUtf8,expectedInventoryNativeRequestId,
            expectedManifestSha256,expectedRegistrationReceiptSha256,actualHttpStatus,responseUtf8);
        boolean returned=false;
        try{
            if(elapsedNanos<0||observedEpochMillis<readStartedEpochMillis)throw invalid();
            long started=civilMicros(readStartedEpochMillis),observed=civilMicros(observedEpochMillis);
            // Flooring nanos to micros preserves exact interval membership:
            // both receipt boundaries are integer microseconds. In particular
            // 999ns is still before .000001, whereas 1000ns is exactly there.
            long anchored=Math.addExact(started,elapsedNanos/1000L);
            long current=Math.max(observed,anchored);
            if(current>NativeSameOriginalRecoveryPreparationWire.instantMicros("9999-12-31T23:59:59.999999Z"))throw invalid();
            JSONObject receipt=result.json();
            long approved=NativeSameOriginalRecoveryPreparationWire.instantMicros(text(receipt,"approved_at"));
            long expires=NativeSameOriginalRecoveryPreparationWire.instantMicros(text(receipt,"expires_at"));
            if(approved>current||current>=expires)throw invalid();
            returned=true;return result;
        }catch(Exception malformed){throw invalid();}
        finally{if(!returned)result.close();}
    }
    private static long civilMicros(long epochMillis)throws Exception {
        // The existing instantMicros uses Gregorian year 1, NOT Unix epoch.
        // Fixed UTC formatting is lossless for integer millisecond inputs and
        // the existing parser rejects year 0/extended/unrepresentable years.
        String timestamp=DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSSSS'Z'",Locale.ROOT)
            .withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(epochMillis));
        return NativeSameOriginalRecoveryPreparationWire.instantMicros(timestamp);
    }

    static final class UntrustedApproval implements AutoCloseable {
        private byte[] fields;
        private UntrustedApproval(byte[] receipt){fields=receipt;}
        synchronized JSONObject json()throws VaultFailure {
            if(fields==null)throw invalid();
            byte[] copy=fields.clone();
            try{return ProviderWireJson.object(copy,MAX_RESPONSE);}
            catch(Exception malformed){throw invalid();}
            finally{Arrays.fill(copy,(byte)0);}
        }
        @Override public synchronized void close(){
            if(fields!=null){Arrays.fill(fields,(byte)0);fields=null;}
        }
    }

    static UntrustedApproval decode(byte[] expectedOriginalTargetUtf8,String expectedInventoryNativeRequestId,
            String expectedManifestSha256,String expectedRegistrationReceiptSha256,
            int actualHttpStatus,byte[] responseUtf8)throws VaultFailure {
        if(actualHttpStatus!=200||expectedOriginalTargetUtf8==null||responseUtf8==null
            ||expectedOriginalTargetUtf8.length<1||expectedOriginalTargetUtf8.length>MAX_TARGET
            ||responseUtf8.length<1||responseUtf8.length>MAX_RESPONSE
            ||!matches(expectedInventoryNativeRequestId,UUID)||!matches(expectedManifestSha256,SHA)
            ||!matches(expectedRegistrationReceiptSha256,SHA))throw invalid();
        byte[] target=expectedOriginalTargetUtf8.clone(),response=responseUtf8.clone(),actualTarget=null,retained=null;
        try{
            JSONObject expected=NativeSameOriginalRecoveryPreparationWire.decodeTarget(target).json();
            JSONObject wrapper=ProviderWireJson.object(response,MAX_RESPONSE);
            NativeRetainedAttempt.keys(wrapper,"ok","data");
            if(!Boolean.TRUE.equals(wrapper.get("ok")))throw invalid();
            JSONObject receipt=object(wrapper,"data");
            NativeRetainedAttempt.keys(receipt,"schema","state","approval_id","original_request","original_request_sha256",
                "original_target","issuer","inventory_manifest_sha256","registration_receipt_sha256",
                "approved_at","expires_at","receipt_sha256","limits","purpose_admission_id","retry_safe");
            literal(receipt,"schema","custodial.original-inventory-separation-receipt.v1");
            literal(receipt,"state","INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY");
            literal(receipt,"purpose_admission_id","exact-original-retained-inventory-separation.v1");
            if(!Boolean.FALSE.equals(receipt.get("retry_safe")))throw invalid();
            match(receipt,"approval_id",UUID);
            match(receipt,"original_request_sha256",SHA); // raw command bytes are NOT present
            match(receipt,"receipt_sha256",SHA); // existing wire defines representation, not an authenticated transcript
            if(!expectedManifestSha256.equals(match(receipt,"inventory_manifest_sha256",SHA))
                ||!expectedRegistrationReceiptSha256.equals(match(receipt,"registration_receipt_sha256",SHA)))throw invalid();
            actualTarget=utf8(object(receipt,"original_target").toString(),MAX_TARGET);
            JSONObject received=NativeSameOriginalRecoveryPreparationWire.decodeTarget(actualTarget).json();
            for(var it=expected.keys();it.hasNext();){
                String key=it.next();if(!expected.get(key).equals(received.get(key)))throw invalid();
            }
            JSONObject command=object(receipt,"original_request");
            NativeRetainedAttempt.keys(command,"schema","request_id","native_request_id","expected_review_sha256",
                "expected_inventory_manifest_sha256","expected_registration_receipt_sha256","expected_separation_authority_revision",
                "expected_manager_id","expected_manager_credential_id","expected_manager_device_id","decision","manager_confirmation");
            literal(command,"schema","custodial.original-inventory-separation-request.v1");
            literal(command,"decision",PURPOSE);literal(command,"manager_confirmation",CONFIRMATION);
            match(command,"request_id",UUID);match(command,"expected_review_sha256",SHA);
            if(!expectedInventoryNativeRequestId.equals(match(command,"native_request_id",UUID))
                ||!expectedManifestSha256.equals(match(command,"expected_inventory_manifest_sha256",SHA))
                ||!expectedRegistrationReceiptSha256.equals(match(command,"expected_registration_receipt_sha256",SHA))
                ||!text(expected,"separation_authority_revision").equals(text(command,"expected_separation_authority_revision")))throw invalid();
            JSONObject issuer=object(receipt,"issuer");
            NativeRetainedAttempt.keys(issuer,"manager_id","manager_credential_id","manager_device_id");
            for(String key:new String[]{"manager_id","manager_credential_id","manager_device_id"}){
                Pattern pattern=key.equals("manager_device_id")?DEVICE:UUID;
                if(!match(command,"expected_"+key,pattern).equals(match(issuer,key,pattern)))throw invalid();
            }
            long approved=NativeSameOriginalRecoveryPreparationWire.instantMicros(text(receipt,"approved_at"));
            long expires=NativeSameOriginalRecoveryPreparationWire.instantMicros(text(receipt,"expires_at"));
            if(expires<=approved||expires-approved>300000000L)throw invalid();
            JSONObject limits=object(receipt,"limits");NativeRetainedAttempt.keys(limits,EFFECTS);
            for(String key:EFFECTS){
                Boolean value=key.equals("inventory_acknowledged")||key.equals("finalizer_allowed")?Boolean.TRUE:Boolean.FALSE;
                if(!value.equals(limits.get(key)))throw invalid();
            }
            retained=utf8(receipt.toString(),MAX_RESPONSE);
            UntrustedApproval result=new UntrustedApproval(retained);retained=null;return result;
        }catch(Exception malformed){throw invalid();}
        finally{
            Arrays.fill(target,(byte)0);Arrays.fill(response,(byte)0);
            if(actualTarget!=null)Arrays.fill(actualTarget,(byte)0);
            if(retained!=null)Arrays.fill(retained,(byte)0);
        }
    }
    private static boolean matches(String value,Pattern pattern){return value!=null&&pattern.matcher(value).matches();}
    private static String text(JSONObject value,String key)throws Exception {
        Object raw=value.get(key);if(!(raw instanceof String))throw invalid();return (String)raw;
    }
    private static JSONObject object(JSONObject value,String key)throws Exception {
        Object raw=value.get(key);if(!(raw instanceof JSONObject))throw invalid();return (JSONObject)raw;
    }
    private static String match(JSONObject value,String key,Pattern pattern)throws Exception {
        String raw=text(value,key);if(!matches(raw,pattern))throw invalid();return raw;
    }
    private static void literal(JSONObject value,String key,String expected)throws Exception {
        if(!expected.equals(text(value,key)))throw invalid();
    }
    private static byte[] utf8(String value,int maximum)throws Exception {
        if(value==null||value.length()>maximum)throw invalid();
        ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(value));
        try{
            if(encoded.remaining()<1||encoded.remaining()>maximum)throw invalid();
            byte[] owned=new byte[encoded.remaining()];encoded.get(owned);return owned;
        }finally{if(encoded.hasArray())Arrays.fill(encoded.array(),(byte)0);}
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
