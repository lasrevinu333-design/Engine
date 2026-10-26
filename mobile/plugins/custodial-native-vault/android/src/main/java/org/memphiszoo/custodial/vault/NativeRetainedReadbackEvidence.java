package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONObject;

/** Closed original-target query-result grammar. No raw value/signature/token
 * return, work/new-work acceptance, semantic inventory ACK, key deletion, phone
 * reuse or resend authority. Missing is UNKNOWN, never absence of a late commit. */
final class NativeRetainedReadbackEvidence {
    static final String SCHEMA="custodial.native-retained-readback-observation.v1";
    private static final String[] BASE={"schema","operation_id","query_native_request_id","native_request_id","request_body_sha256",
        "query_completed","write_performed","resend_allowed","absence_proves_no_late_commit","native_semantic_inventory_state",
        "browser_inventory_state","inventory_acknowledged","automatic_acceptance","work_accepted","new_work_allowed","phone_released","key_removal"};
    private static final String[] RECEIPT={"assignment_epoch","authority_revision","automatic_acceptance","browser_inventory_state","canonical_device_id",
        "credential_id","cutoff_at","device_id","employee_id","generation_id","inventory_acknowledged","manifest_sha256","native_semantic_inventory_state",
        "new_work_allowed","operation_id","payload_coverage","phone_released","raw_snapshot_sha256","receipt_sha256","record_count","record_values_retained",
        "retained_at","schema","separation_id","status","wire_bytes","wire_sha256","work_accepted"};
    final String status,queryRequestId,targetRequestId;
    final boolean requestReadbackConfirmed,rawValuesRetained;
    final boolean workAccepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false,resendAllowed=false,absenceProvesNoLateCommit=false;
    private final String stored;
    private NativeRetainedReadbackEvidence(String status,NativeRetainedReadQuery query,boolean request,boolean values,JSONObject chunk)throws Exception{
        this.status=status;queryRequestId=query.requestId;targetRequestId=query.targetRequestId;requestReadbackConfirmed=request;rawValuesRetained=values;
        stored=new JSONObject().put("schema",SCHEMA).put("query_native_request_id",query.requestId).put("query_body_sha256",query.bodySha256)
            .put("operation_id",query.operationId).put("generation_id",query.generationId).put("native_request_id",query.targetRequestId)
            .put("request_body_sha256",query.targetBodySha256).put("attestation_digest",query.targetAttestationDigest)
            .put("wire_sha256",query.targetWireSha256).put("status",status).put("request_readback_confirmed",request)
            .put("record_values_retained",values).put("value_chunk",chunk==null?JSONObject.NULL:chunk)
            .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
            .put("inventory_acknowledged",false).put("work_accepted",false).put("new_work_allowed",false).put("phone_released",false)
            .put("key_removal",false).put("resend_allowed",false).put("absence_proves_no_late_commit",false).toString();
    }
    static NativeRetainedReadbackEvidence verify(NativeRetainedReadQuery query,NativeRetainedHttp.Exchange exchange)throws VaultFailure{
        byte[] bytes=null;
        try{
            if(query==null||exchange==null||exchange.status!=200||!query.requestId.equals(exchange.nativeRequestId)
                ||!query.bodySha256.equals(exchange.bodySha256))throw invalid();query.requireOpen();
            bytes=exchange.response();JSONObject envelope=ProviderWireJson.object(bytes,NativeRetainedHttp.MAX_RESPONSE);
            NativeRetainedAttempt.keys(envelope,"ok","data");if(!Boolean.TRUE.equals(envelope.get("ok"))||!(envelope.get("data") instanceof JSONObject))throw invalid();
            JSONObject data=envelope.getJSONObject("data");String status=data.getString("status");
            boolean missing="OUTCOME_UNKNOWN".equals(status),hasChunk=data.has("value_chunk");
            List<String> keys=new ArrayList<>(Arrays.asList(BASE));keys.addAll(Arrays.asList("status","requested_attempt_retained","request_readback_confirmed","record_values_retained"));
            if(!missing){keys.add("receipt");keys.add("chunk_bytes_readback_confirmed");if(hasChunk)keys.add("value_chunk");}
            NativeRetainedAttempt.keys(data,keys.toArray(new String[0]));
            require(data,"schema","custodial.original-native-evidence-readback-result.v1");require(data,"operation_id",query.operationId);
            require(data,"query_native_request_id",query.requestId);require(data,"native_request_id",query.targetRequestId);require(data,"request_body_sha256",query.targetBodySha256);
            require(data,"query_completed",true);
            for(String field:new String[]{"write_performed","resend_allowed","absence_proves_no_late_commit","inventory_acknowledged","automatic_acceptance","work_accepted","new_work_allowed","phone_released","key_removal"})require(data,field,false);
            require(data,"native_semantic_inventory_state","UNKNOWN");require(data,"browser_inventory_state","UNKNOWN");
            if(missing){require(data,"requested_attempt_retained",JSONObject.NULL);require(data,"request_readback_confirmed",false);require(data,"record_values_retained",JSONObject.NULL);
                return new NativeRetainedReadbackEvidence(status,query,false,false,null);}
            require(data,"requested_attempt_retained",true);require(data,"request_readback_confirmed",true);
            validateReceipt(data.getJSONObject("receipt"),query);
            if(!hasChunk){require(data,"status","REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION");require(data,"record_values_retained",false);require(data,"chunk_bytes_readback_confirmed",false);
                return new NativeRetainedReadbackEvidence(status,query,true,false,null);}
            JSONObject chunk=data.getJSONObject("value_chunk"),target=query.targetEnvelope();
            NativeRetainedAttempt.keys(chunk,"value_bytes","value_sha256","chunk_index","chunk_count","chunk_sha256","stored_chunk_count","record_values_retained");
            for(String field:new String[]{"value_bytes","chunk_index","chunk_count"})if(number(chunk,field)!=Long.parseLong(target.getString(field)))throw invalid();
            require(chunk,"value_sha256",target.getString("value_sha256"));require(chunk,"chunk_sha256",target.getString("chunk_sha256"));
            long count=number(chunk,"chunk_count"),storedCount=number(chunk,"stored_chunk_count");if(storedCount<1||storedCount>count)throw invalid();
            Object flag=chunk.get("record_values_retained");if(!(flag instanceof Boolean))throw invalid();boolean all=(Boolean)flag;
            if(all&&storedCount!=count)throw invalid();
            require(data,"record_values_retained",all);require(data,"chunk_bytes_readback_confirmed",true);
            require(data,"status",all?"RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION":"CHUNK_RETAINED_INCOMPLETE_VALUES");
            return new NativeRetainedReadbackEvidence(status,query,true,all,new JSONObject(chunk.toString()));
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
        finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    }
    /** Validate ONLY a cached, authenticated query-journal observation. This
     * is not a new HTTP exchange, freshness witness, current SQL assertion or
     * writer/ACK capability. Journal owns the exact-ciphertext durability gate. */
    static JSONObject validateStoredObservation(NativeRetainedReadQuery query,NativeRetainedQueryJournal.Observation observed)throws VaultFailure{
        try{
            if(query==null||observed==null||!NativeRetainedQueryJournal.OBSERVED.equals(observed.state))throw invalid();
            query.requireOpen();if(!ProviderWireJson.same(query.record(),observed.record()))throw invalid();
            JSONObject data=observed.evidence();if(data==null)throw invalid();
            NativeRetainedAttempt.keys(data,"schema","query_native_request_id","query_body_sha256","operation_id","generation_id",
                "native_request_id","request_body_sha256","attestation_digest","wire_sha256","status","request_readback_confirmed",
                "record_values_retained","value_chunk","native_semantic_inventory_state","browser_inventory_state","inventory_acknowledged",
                "work_accepted","new_work_allowed","phone_released","key_removal","resend_allowed","absence_proves_no_late_commit");
            require(data,"schema",SCHEMA);require(data,"query_native_request_id",query.requestId);require(data,"query_body_sha256",query.bodySha256);
            require(data,"operation_id",query.operationId);require(data,"generation_id",query.generationId);require(data,"native_request_id",query.targetRequestId);
            require(data,"request_body_sha256",query.targetBodySha256);require(data,"attestation_digest",query.targetAttestationDigest);require(data,"wire_sha256",query.targetWireSha256);
            for(String field:new String[]{"inventory_acknowledged","work_accepted","new_work_allowed","phone_released","key_removal","resend_allowed","absence_proves_no_late_commit"})require(data,field,false);
            require(data,"native_semantic_inventory_state","UNKNOWN");require(data,"browser_inventory_state","UNKNOWN");
            Object state=data.get("status");if(!(state instanceof String))throw invalid();String status=(String)state;
            boolean missing="OUTCOME_UNKNOWN".equals(status),digest="REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION".equals(status),partial="CHUNK_RETAINED_INCOMPLETE_VALUES".equals(status),complete="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION".equals(status);
            if(!missing&&!digest&&!partial&&!complete)throw invalid();
            require(data,"request_readback_confirmed",!missing);require(data,"record_values_retained",complete);
            if(missing||digest)require(data,"value_chunk",JSONObject.NULL);
            else{
                Object raw=data.get("value_chunk");if(!(raw instanceof JSONObject))throw invalid();JSONObject chunk=(JSONObject)raw,target=query.targetEnvelope();
                NativeRetainedAttempt.keys(chunk,"value_bytes","value_sha256","chunk_index","chunk_count","chunk_sha256","stored_chunk_count","record_values_retained");
                for(String field:new String[]{"value_bytes","chunk_index","chunk_count"})if(number(chunk,field)!=Long.parseLong(target.getString(field)))throw invalid();
                require(chunk,"value_sha256",target.getString("value_sha256"));require(chunk,"chunk_sha256",target.getString("chunk_sha256"));
                long count=number(chunk,"chunk_count"),stored=number(chunk,"stored_chunk_count");if(stored<1||stored>count||complete&&stored!=count)throw invalid();
                require(chunk,"record_values_retained",complete);
            }
            // New diagnostic type is deliberately incompatible with both fresh
            // HTTP and stored observation grammars. UNKNOWN never becomes false
            // proof of absence simply because the old local format used false.
            return new JSONObject(data.toString()).put("schema","custodial.native-retained-cached-observation.v1")
                .put("proof_source","AUTHENTICATED_LOCAL_QUERY_JOURNAL").put("current_server_readback",false)
                .put("fresh_query_performed",false).put("request_renewed",false).put("write_performed",false)
                .put("automatic_acceptance",false).put("record_values_retained",missing?JSONObject.NULL:complete);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
    }
    private static void validateReceipt(JSONObject receipt,NativeRetainedReadQuery query)throws Exception{
        NativeRetainedAttempt.keys(receipt,RECEIPT);JSONObject manifest=query.targetManifest(),context=manifest.getJSONObject("separation_context"),target=query.targetEnvelope();
        require(receipt,"schema","custodial.retained-original-native-evidence-receipt.v1");require(receipt,"status","RETAINED_ONLY_PENDING_RECONCILIATION");
        require(receipt,"operation_id",query.operationId);require(receipt,"generation_id",query.generationId);require(receipt,"wire_sha256",query.targetWireSha256);
        byte[] wire=NativeRetainedAttempt.base64(target.getString("signed_wire_base64"),262144);
        try{JSONObject signed=ProviderWireJson.object(wire,262144);require(receipt,"manifest_sha256",signed.getString("manifest_sha256"));if(number(receipt,"wire_bytes")!=wire.length)throw invalid();}
        finally{Arrays.fill(wire,(byte)0);}
        require(receipt,"raw_snapshot_sha256",manifest.getString("raw_snapshot_sha256"));if(number(receipt,"record_count")!=number(manifest,"record_count"))throw invalid();
        for(String field:new String[]{"separation_id","device_id","canonical_device_id","credential_id","employee_id","cutoff_at"})require(receipt,field,context.get(field));
        for(String field:new String[]{"assignment_epoch","authority_revision"})if(number(receipt,field)!=number(context,field))throw invalid();
        for(String field:new String[]{"record_values_retained","inventory_acknowledged","automatic_acceptance","work_accepted","new_work_allowed","phone_released"})require(receipt,field,false);
        require(receipt,"payload_coverage","MANIFEST_AND_RECORD_DIGESTS_ONLY");require(receipt,"native_semantic_inventory_state","UNKNOWN");require(receipt,"browser_inventory_state","UNKNOWN");
        if(!(receipt.get("receipt_sha256") instanceof String)||!receipt.getString("receipt_sha256").matches("[a-f0-9]{64}"))throw invalid();
        String retained=exactTime(receipt.get("retained_at")),cutoff=exactTime(receipt.get("cutoff_at"));if(retained.compareTo(cutoff)<0)throw invalid();
    }
    private static String exactTime(Object value)throws VaultFailure{
        if(!(value instanceof String)||!((String)value).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9]\\.[0-9]{6}Z")||((String)value).startsWith("0000"))throw invalid();
        try{Instant.parse((String)value);return (String)value;}catch(Exception error){throw invalid();}
    }
    private static long number(JSONObject value,String key)throws Exception{
        Object n=value.get(key);if(!(n instanceof Integer||n instanceof Long))throw invalid();long result=((Number)n).longValue();if(result<0||result>9007199254740991L)throw invalid();return result;
    }
    private static void require(JSONObject object,String field,Object expected)throws Exception{
        Object actual=object.get(field);if(expected instanceof Number){if(number(object,field)!=((Number)expected).longValue())throw invalid();}
        else if(!expected.equals(actual))throw invalid();
    }
    JSONObject storage(NativeRetainedReadQuery query)throws VaultFailure{
        try{JSONObject result=new JSONObject(stored);if(!query.requestId.equals(result.get("query_native_request_id"))||!query.bodySha256.equals(result.get("query_body_sha256")))throw invalid();return result;}
        catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
    }
    private static VaultFailure invalid(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
}
