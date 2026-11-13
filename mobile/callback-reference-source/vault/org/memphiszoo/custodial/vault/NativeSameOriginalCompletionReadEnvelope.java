package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import org.json.JSONObject;

/** Purpose-specific representation ONLY, not a sender or authenticated owner.
 * Main must authenticate/bind the actual original QUERY and completion before
 * dispatch. Opaque completion bytes are never parsed, normalized or accepted
 * here. No clock, ID, signature, credential, ACK or other effect is created.
 */
final class NativeSameOriginalCompletionReadEnvelope {
    static final String PATH="/device-auth/private-custody-original-completion-read";
    static final String SCHEMA="custodial.same-original-completion-read.v1";
    static final int MAX_ARGUMENTS=4*1024*1024,MAX_OUTPUT=8*1024*1024;
    static final String FAILURE="custodial_same_original_completion_read_envelope_invalid";
    private static final String[] CURRENT_FIELDS={"schema","original_query_body_base64","original_query_timestamp",
        "original_query_http_attestation","original_query_unknown_record_sha256"};
    private static final byte[] PREFIX=("{\"schema\":\""+SCHEMA+"\",\"current_original_query_envelope_base64\":\"")
        .getBytes(StandardCharsets.US_ASCII);
    private static final byte[] BETWEEN="\",\"original_completion_arguments_base64\":\"".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] SUFFIX="\"}".getBytes(StandardCharsets.US_ASCII);

    private NativeSameOriginalCompletionReadEnvelope(){}

    static byte[] encode(byte[] exactCurrentOriginalQueryEnvelope,byte[] exactOriginalCompletionArguments)throws VaultFailure {
        byte[] query=null,arguments=null,original=null,checked=null,queryBase64=null,argumentsBase64=null,output=null;
        try{
            if(exactCurrentOriginalQueryEnvelope==null||exactCurrentOriginalQueryEnvelope.length==0
                ||exactCurrentOriginalQueryEnvelope.length>NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE
                ||exactOriginalCompletionArguments==null||exactOriginalCompletionArguments.length==0
                ||exactOriginalCompletionArguments.length>MAX_ARGUMENTS)throw invalid();
            query=exactCurrentOriginalQueryEnvelope.clone();
            arguments=exactOriginalCompletionArguments.clone();
            JSONObject current=ProviderWireJson.object(query,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
            NativeRetainedAttempt.keys(current,CURRENT_FIELDS);
            for(String key:CURRENT_FIELDS)if(!(current.get(key) instanceof String))throw invalid();
            if(!NativePrivateCustodyCurrentQueryEnvelope.SCHEMA.equals(current.get("schema")))throw invalid();
            original=NativeRetainedAttempt.base64(current.getString("original_query_body_base64"),
                NativePrivateCustodyCurrentQueryEnvelope.MAX_ORIGINAL);
            // Existing closed QUERY/string/calendar validator, used ONLY for
            // validation. Never substitute its reserialization for input bytes.
            checked=NativePrivateCustodyCurrentQueryEnvelope.encode(original,current.getString("original_query_timestamp"),
                current.getString("original_query_http_attestation"),current.getString("original_query_unknown_record_sha256"));
            queryBase64=Base64.getEncoder().encode(query);
            argumentsBase64=Base64.getEncoder().encode(arguments);
            int size=PREFIX.length+queryBase64.length+BETWEEN.length+argumentsBase64.length+SUFFIX.length;
            if(size>MAX_OUTPUT)throw invalid();
            output=new byte[size];int at=0;
            // Only fixed ASCII literals and standard Base64 bytes enter this
            // closed three-string JSON body; no caller JSON/toString hooks.
            for(byte[] part:new byte[][]{PREFIX,queryBase64,BETWEEN,argumentsBase64,SUFFIX}){
                System.arraycopy(part,0,output,at,part.length);at+=part.length;
            }
            byte[] result=output;output=null;return result;
        }catch(Exception failure){throw invalid();}
        finally{
            for(byte[] owned:new byte[][]{query,arguments,original,checked,queryBase64,argumentsBase64,output})
                if(owned!=null)Arrays.fill(owned,(byte)0);
            // Immutable parser strings are not claimed wiped. Caller arrays
            // and the successful fresh returned body remain caller-owned.
        }
    }
    static final int MAX_RESPONSE=131072,MAX_READBACK=65536;
    private static final String READ_SCHEMA="custodial.same-original-completion-SQL-read.v1";
    private static final String READ_STATE="CURRENT_EXACT_ORIGINAL_COMPLETION_DISPOSITION_NOT_ACK";
    private static final String UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final String[] READ_FIELDS={"schema","state","operation_id","original_generation_id","argument_values_sha256",
        "disposition","result","transaction_authority","limits"};
    private static final String[] LIMITS={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
    private static final String[] RESULT_FIELDS={"reconciliation_id","context_id","occurrence_id","session_id","completion_response_id",
        "client_session_id","client_completion_id","employee_id","credential_id","assignment_epoch","payload_fingerprint",
        "started_at","ended_at","submitted_at","location_id"};
    private static final String[] RESULT_UUIDS={"reconciliation_id","context_id","occurrence_id","session_id","completion_response_id",
        "employee_id","credential_id","location_id"};

    /** Detached matching representation ONLY, not source authentication,
     * currentness, ACK or an effect capability. No caller JSON constructor. */
    static final class UntrustedReadback {
        private final String encoded;
        private UntrustedReadback(String validated){encoded=validated;}
        JSONObject json()throws VaultFailure{
            try{return new JSONObject(encoded);}catch(Exception failure){throw invalid();}
        }
    }

    static UntrustedReadback decodeResponse(byte[] actualHttpResponse,String expectedOperationId,String expectedGenerationId,
        byte[] exactOriginalArguments,NativeProviderPrincipal originalPrincipal)throws VaultFailure {
        byte[] response=null,arguments=null,projection=null;
        try{
            if(actualHttpResponse==null||actualHttpResponse.length==0||actualHttpResponse.length>MAX_RESPONSE
                ||exactOriginalArguments==null||exactOriginalArguments.length==0||exactOriginalArguments.length>MAX_ARGUMENTS
                ||originalPrincipal==null)throw invalid();
            uuid(expectedOperationId);uuid(expectedGenerationId);
            response=actualHttpResponse.clone();arguments=exactOriginalArguments.clone();
            JSONObject wrapper=ProviderWireJson.object(response,MAX_RESPONSE);
            NativeRetainedAttempt.keys(wrapper,"ok","data");
            if(!Boolean.TRUE.equals(wrapper.get("ok")))throw invalid();
            JSONObject data=wrapper.getJSONObject("data");NativeRetainedAttempt.keys(data,READ_FIELDS);
            projection=data.toString().getBytes(StandardCharsets.UTF_8);
            if(projection.length>MAX_READBACK)throw invalid();
            if(!READ_SCHEMA.equals(text(data,"schema"))||!READ_STATE.equals(text(data,"state"))
                ||!expectedOperationId.equals(text(data,"operation_id"))||!expectedGenerationId.equals(text(data,"original_generation_id"))
                ||!NativeRetainedAttempt.hash(arguments).equals(text(data,"argument_values_sha256"))
                ||!Boolean.FALSE.equals(data.get("transaction_authority")))throw invalid();
            JSONObject limits=data.getJSONObject("limits");NativeRetainedAttempt.keys(limits,LIMITS);
            for(String name:LIMITS)if(!Boolean.FALSE.equals(limits.get(name)))throw invalid();
            String disposition=text(data,"disposition");
            if("UNRESOLVED_RETAINED".equals(disposition)){
                // Deliberately do NOT parse, normalize or rewrite opaque args.
                if(data.get("result")!=JSONObject.NULL)throw invalid();
            }else if("ACCEPTED_EXACT_ORIGINAL".equals(disposition)){
                requireAccepted(data.getJSONObject("result"),arguments,originalPrincipal);
            }else throw invalid();
            return new UntrustedReadback(new String(projection,StandardCharsets.UTF_8));
        }catch(Exception failure){throw invalid();}
        finally{for(byte[] owned:new byte[][]{response,arguments,projection})if(owned!=null)Arrays.fill(owned,(byte)0);}
    }
    private static void requireAccepted(JSONObject result,byte[] original,NativeProviderPrincipal principal)throws Exception{
        NativeRetainedAttempt.keys(result,RESULT_FIELDS);
        for(String key:RESULT_FIELDS)if(text(result,key).isEmpty())throw invalid();
        for(String key:RESULT_UUIDS)uuid(text(result,key));
        String epoch=text(result,"assignment_epoch");
        if(!epoch.matches("[1-9][0-9]{0,15}")||Long.parseLong(epoch)>9007199254740991L
            ||!text(result,"payload_fingerprint").matches("[a-f0-9]{64}"))throw invalid();
        for(String key:new String[]{"started_at","ended_at","submitted_at"})micros(text(result,key));
        if(VaultTimestamps.compareInstants(text(result,"started_at"),text(result,"ended_at"),FAILURE)>=0)throw invalid();
        // No submission-time ordering/freshness rule relative to start/end.
        JSONObject args=ProviderWireJson.object(original,MAX_ARGUMENTS),actor=principal.json();
        if(!text(args,"p_device_id").equals(text(actor,"device_id"))
            ||!text(result,"employee_id").equals(text(actor,"employee_id"))
            ||!text(result,"credential_id").equals(text(actor,"credential_id"))
            ||Long.parseLong(epoch)!=originalEpoch(actor,"assignment_epoch")
            ||!text(result,"client_session_id").equals(text(args,"p_client_session_id"))
            ||!text(result,"client_completion_id").equals(text(args,"p_client_completion_id")))throw invalid();
        JSONObject control=args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1");
        if(!text(result,"context_id").equals(text(control,"context_id"))
            ||!text(result,"started_at").equals(millisecondsAsMicros(text(args,"p_client_started_at")))
            ||!text(result,"ended_at").equals(millisecondsAsMicros(text(args,"p_client_ended_at"))))throw invalid();
        for(String[] pin:new String[][]{{"p_context_id","context_id"},{"p_occurrence_id","occurrence_id"},
            {"p_snapshot_employee_id","employee_id"},{"p_snapshot_credential_id","credential_id"}})
            if(present(args,pin[0])&&!text(args,pin[0]).equals(text(result,pin[1])))throw invalid();
        if(present(args,"p_snapshot_assignment_epoch")&&originalEpoch(args,"p_snapshot_assignment_epoch")!=Long.parseLong(epoch))throw invalid();
        // Existing snapshot identifier is a SHA256, NOT a context UUID.
        if(present(args,"p_snapshot_id")&&!text(args,"p_snapshot_id").matches("[a-f0-9]{64}"))throw invalid();
        if(present(args,"p_submission_proof")&&!text(args,"p_submission_proof").equals(text(control,"submission_proof")))throw invalid();
    }
    private static boolean present(JSONObject value,String key){return value.has(key)&&value.opt(key)!=JSONObject.NULL;}
    private static String text(JSONObject value,String key)throws Exception{
        Object raw=value.get(key);if(!(raw instanceof String))throw invalid();return (String)raw;
    }
    private static long originalEpoch(JSONObject value,String key)throws Exception{
        Object raw=value.get(key);if(!(raw instanceof Integer||raw instanceof Long))throw invalid();
        long n=((Number)raw).longValue();if(n<1||n>9007199254740991L)throw invalid();return n;
    }
    private static void uuid(String value)throws VaultFailure{if(value==null||!value.matches(UUID))throw invalid();}
    private static void micros(String value)throws VaultFailure{
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z"))throw invalid();
        VaultTimestamps.epochMillis(value,FAILURE); // Calendar only, no clock.
    }
    private static String millisecondsAsMicros(String value)throws VaultFailure{
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"))throw invalid();
        VaultTimestamps.epochMillis(value,FAILURE);return value.substring(0,23)+"000Z";
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
