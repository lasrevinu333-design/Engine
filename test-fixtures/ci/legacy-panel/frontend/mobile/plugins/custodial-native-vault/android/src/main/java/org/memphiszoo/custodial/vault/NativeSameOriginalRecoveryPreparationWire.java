package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Purpose-local REPRESENTATION ONLY, not an authority/capability constructor.
 * Every result remains untrusted until Main's owning fixed transport, original
 * source, issuer authorization and transaction/currentness checks admit it.
 * No clock, credential, challenge, permission, IO or effect is supplied here.
 */
final class NativeSameOriginalRecoveryPreparationWire {
    static final String PURPOSE="AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION";
    static final String ADMISSION="same-original-preparation.v1";
    static final String FAILURE="same_original_recovery_wire_invalid";
    static final int MAX_DOCUMENT_BYTES=65536,MAX_REQUEST_BYTES=8192;
    private static final long MAX_DECIMAL=9007199254740991L;
    private static final Pattern UUID=Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern SHA=Pattern.compile("[a-f0-9]{64}");
    private static final Pattern DEVICE=Pattern.compile("KIOSK_0[2-9]|KIOSK_10");
    private static final Pattern MANAGER_DEVICE=Pattern.compile("[A-Za-z0-9_-]{1,128}");
    private static final Set<String> TARGET=Set.of("operation_id","separation_id","separation_authority_revision",
        "canonical_device_pk","canonical_device_id","employee_id","credential_id","assignment_epoch",
        "original_generation_id","original_credential_secret_key_id","principal_digest","engine_revision",
        "original_wire_sha256","original_frozen_work_sha256","capsule_sha256","record_sha256","frame_sha256",
        "plan_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256");
    private static final Set<String> UUID_TARGET=Set.of("operation_id","separation_id","canonical_device_pk",
        "employee_id","credential_id","original_generation_id");
    private static final Set<String> REQUEST=Set.of("schema","request_id","challenge_id","expected_challenge_sha256",
        "expected_preview_sha256","expected_manager_id","expected_manager_credential_id","expected_manager_device_id",
        "decision","manager_confirmation");
    private static final Set<String> RECEIPT=Set.of("schema","state","approval_id","original_request","original_request_sha256",
        "issuer","challenge_sha256","preview_sha256","original_target","purpose_admission_id","issued_at","expires_at",
        "receipt_sha256","retry_safe","limits");
    private static final Set<String> ISSUER=Set.of("manager_id","manager_credential_id","manager_device_id");
    private static final Set<String> LIMITS=Set.of("inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released");
    private NativeSameOriginalRecoveryPreparationWire(){}

    static final class UntrustedTarget {
        private final Map<String,Object> fields;
        private UntrustedTarget(Map<String,Object> fields){this.fields=fields;}
        JSONObject json()throws VaultFailure{return detached(fields);}
        byte[] documentBytes()throws VaultFailure{return bytes("target",fields);}
        String documentSha256()throws VaultFailure{return digest("target",fields);}
    }
    static final class UntrustedApprovalRequest {
        private final Map<String,Object> fields;
        private UntrustedApprovalRequest(Map<String,Object> fields){this.fields=fields;}
        JSONObject json()throws VaultFailure{return detached(fields);}
        byte[] documentBytes()throws VaultFailure{return bytes("request",fields);}
        String documentSha256()throws VaultFailure{return digest("request",fields);}
    }
    static final class UntrustedPreparationReceipt {
        private final Map<String,Object> fields;
        private UntrustedPreparationReceipt(Map<String,Object> fields){this.fields=fields;}
        JSONObject json()throws VaultFailure{return detached(fields);}
        byte[] documentBytes()throws VaultFailure{return bytes("receipt",fields);}
        String documentSha256()throws VaultFailure{return digest("receipt",fields);}
        UntrustedTarget originalTarget()throws VaultFailure{return new UntrustedTarget(object(fields,"original_target"));}
        UntrustedApprovalRequest originalRequest()throws VaultFailure{return new UntrustedApprovalRequest(object(fields,"original_request"));}
    }

    static UntrustedTarget decodeTarget(byte[] raw)throws VaultFailure {
        var fields=parse(raw,MAX_DOCUMENT_BYTES);target(fields);return new UntrustedTarget(fields);
    }
    static UntrustedApprovalRequest decodeRequest(byte[] raw)throws VaultFailure {
        var fields=parse(raw,MAX_REQUEST_BYTES);request(fields);return new UntrustedApprovalRequest(fields);
    }
    static UntrustedPreparationReceipt decodeReceipt(byte[] raw)throws VaultFailure {
        var fields=parse(raw,MAX_DOCUMENT_BYTES);receipt(fields);
        if(!text(fields,"original_request_sha256").equals(digest("request",object(fields,"original_request")))
            ||!text(fields,"receipt_sha256").equals(digest("receipt",fields)))throw invalid();
        return new UntrustedPreparationReceipt(fields);
    }
    /** Exact content comparison ONLY. These expected representations are also
     * untrusted; passing them does not authenticate their original source. */
    static UntrustedPreparationReceipt decodeReceipt(byte[] raw,UntrustedTarget expectedTarget,
        UntrustedApprovalRequest expectedRequest)throws VaultFailure {
        if(expectedTarget==null||expectedRequest==null)throw invalid();
        var result=decodeReceipt(raw);
        if(!object(result.fields,"original_target").equals(expectedTarget.fields)
            ||!object(result.fields,"original_request").equals(expectedRequest.fields))throw invalid();
        return result;
    }

    private static Map<String,Object> parse(byte[] raw,int maximum)throws VaultFailure {
        if(raw==null||raw.length==0||raw.length>maximum)throw invalid();
        byte[] snapshot=raw.clone();
        try{return freeze(ProviderWireJson.object(snapshot,maximum));}
        catch(Exception failure){throw invalid();}
        finally{Arrays.fill(snapshot,(byte)0);}
    }
    private static Map<String,Object> freeze(JSONObject value)throws Exception {
        var result=new TreeMap<String,Object>();
        for(var it=value.keys();it.hasNext();){String key=it.next();Object item=value.get(key);
            if(item instanceof JSONObject)item=freeze((JSONObject)item);
            else if(!(item instanceof String)&&!(item instanceof Boolean))throw invalid();
            result.put(key,item);
        }
        return Collections.unmodifiableMap(result);
    }
    private static JSONObject detached(Map<String,Object> value)throws VaultFailure {
        try{var result=new JSONObject();for(var entry:value.entrySet())result.put(entry.getKey(),
            entry.getValue() instanceof Map?detached(asObject(entry.getValue())):entry.getValue());return result;}
        catch(Exception failure){throw invalid();}
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> asObject(Object item)throws VaultFailure {
        if(!(item instanceof Map))throw invalid();return (Map<String,Object>)item;
    }
    private static Map<String,Object> object(Map<String,Object> value,String key)throws VaultFailure{return asObject(value.get(key));}
    private static String text(Map<String,Object> value,String key)throws VaultFailure {
        Object item=value.get(key);if(!(item instanceof String))throw invalid();return (String)item;
    }
    private static void shape(Map<String,Object> value,Set<String> fields)throws VaultFailure {
        if(!value.keySet().equals(fields))throw invalid();
    }
    private static void match(Map<String,Object> value,String key,Pattern pattern)throws VaultFailure {
        if(!pattern.matcher(text(value,key)).matches())throw invalid();
    }
    private static void literal(Map<String,Object> value,String key,String expected)throws VaultFailure {
        if(!expected.equals(text(value,key)))throw invalid();
    }
    private static void decimal(Map<String,Object> value,String key,boolean zero)throws VaultFailure {
        String s=text(value,key);
        if(s.length()>16||!s.matches(zero?"0|[1-9][0-9]*":"[1-9][0-9]*"))throw invalid();
        try{if(Long.parseLong(s)>MAX_DECIMAL)throw invalid();}catch(NumberFormatException failure){throw invalid();}
    }
    private static void target(Map<String,Object> value)throws VaultFailure {
        shape(value,TARGET);
        for(String key:TARGET){
            if(UUID_TARGET.contains(key))match(value,key,UUID);
            else if(key.equals("assignment_epoch")||key.equals("separation_authority_revision"))decimal(value,key,false);
            else if(key.equals("engine_revision"))decimal(value,key,true);
            else match(value,key,key.equals("canonical_device_id")?DEVICE:SHA);
        }
    }
    private static void request(Map<String,Object> value)throws VaultFailure {
        shape(value,REQUEST);literal(value,"schema","custodial.same-original-recovery-approval-request.v1");
        literal(value,"decision",PURPOSE);literal(value,"manager_confirmation","CONFIRM_THIS_SAME_ORIGINAL_ONLY");
        for(String key:Set.of("request_id","challenge_id","expected_manager_id","expected_manager_credential_id"))match(value,key,UUID);
        for(String key:Set.of("expected_challenge_sha256","expected_preview_sha256"))match(value,key,SHA);
        match(value,"expected_manager_device_id",MANAGER_DEVICE);
    }
    private static void receipt(Map<String,Object> value)throws VaultFailure {
        shape(value,RECEIPT);literal(value,"schema","custodial.same-original-recovery-approval-receipt.v1");
        literal(value,"state","APPROVAL_RECORDED_ONLY");literal(value,"purpose_admission_id",ADMISSION);
        if(!Boolean.FALSE.equals(value.get("retry_safe")))throw invalid();match(value,"approval_id",UUID);
        var r=object(value,"original_request");request(r);target(object(value,"original_target"));
        for(String key:Set.of("original_request_sha256","challenge_sha256","preview_sha256","receipt_sha256"))match(value,key,SHA);
        var i=object(value,"issuer");shape(i,ISSUER);match(i,"manager_id",UUID);match(i,"manager_credential_id",UUID);match(i,"manager_device_id",MANAGER_DEVICE);
        for(String key:ISSUER)if(!text(i,key).equals(text(r,"expected_"+key)))throw invalid();
        for(String key:Set.of("challenge_sha256","preview_sha256"))if(!text(value,key).equals(text(r,"expected_"+key)))throw invalid();
        long issued=instantMicros(text(value,"issued_at")),expires=instantMicros(text(value,"expires_at"));
        if(expires<=issued||expires-issued>300000000L)throw invalid();
        var limits=object(value,"limits");shape(limits,LIMITS);for(String key:LIMITS)if(!Boolean.FALSE.equals(limits.get(key)))throw invalid();
    }
    /** Civil representation parity with Node's ordinal microseconds. Does not
     * read a clock, prove freshness or renew any original expiry. */
    static long instantMicros(String value)throws VaultFailure {
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z"))throw invalid();
        try{int year=Integer.parseInt(value.substring(0,4));if(year<1)throw invalid();
            long day=LocalDate.of(year,Integer.parseInt(value.substring(5,7)),Integer.parseInt(value.substring(8,10))).toEpochDay()
                -LocalDate.of(1,1,1).toEpochDay();
            int h=Integer.parseInt(value.substring(11,13)),m=Integer.parseInt(value.substring(14,16)),s=Integer.parseInt(value.substring(17,19));
            if(h>23||m>59||s>59)throw invalid();
            return (day*86400L+h*3600L+m*60L+s)*1000000L+Integer.parseInt(value.substring(20,26));
        }catch(Exception failure){throw invalid();}
    }
    private static byte[] bytes(String kind,Map<String,Object> value)throws VaultFailure {
        var copy=new TreeMap<>(value);if(kind.equals("receipt"))copy.remove("receipt_sha256");
        return ("custodial.same-original-recovery-"+kind+".v1\n"+canonical(copy)).getBytes(StandardCharsets.UTF_8);
    }
    private static String digest(String kind,Map<String,Object> value)throws VaultFailure {
        byte[] input=bytes(kind,value);
        try{byte[] digest=MessageDigest.getInstance("SHA-256").digest(input);var out=new StringBuilder(64);
            for(byte b:digest){out.append(Character.forDigit((b>>>4)&15,16));out.append(Character.forDigit(b&15,16));}return out.toString();
        }catch(Exception failure){throw invalid();}finally{Arrays.fill(input,(byte)0);}
    }
    private static String canonical(Map<String,Object> value)throws VaultFailure {
        var out=new StringBuilder("{");boolean first=true;
        for(var entry:new TreeMap<>(value).entrySet()){
            if(!first)out.append(',');first=false;out.append(quote(entry.getKey())).append(':');Object item=entry.getValue();
            if(item instanceof Map)out.append(canonical(asObject(item)));
            else if(item instanceof String)out.append(quote((String)item));
            else if(item instanceof Boolean)out.append(item.toString());else throw invalid();
        }
        return out.append('}').toString();
    }
    private static String quote(String value)throws VaultFailure {
        var out=new StringBuilder("\"");
        for(int n=0;n<value.length();n++){char c=value.charAt(n);
            if(Character.isHighSurrogate(c)){if(n+1>=value.length()||!Character.isLowSurrogate(value.charAt(n+1)))throw invalid();out.append(c).append(value.charAt(++n));}
            else if(Character.isLowSurrogate(c))throw invalid();
            else switch(c){case '"':out.append("\\\"");break;case '\\':out.append("\\\\");break;
                case '\b':out.append("\\b");break;case '\f':out.append("\\f");break;case '\n':out.append("\\n");break;
                case '\r':out.append("\\r");break;case '\t':out.append("\\t");break;
                default:if(c<32)out.append(String.format(java.util.Locale.ROOT,"\\u%04x",(int)c));else out.append(c);}
        }
        return out.append('"').toString();
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
