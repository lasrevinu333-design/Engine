package org.memphiszoo.custodial.vault;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Closed, bounded native parser for the existing private writer/reader DTO.
 * Matching a persisted HTTP reply is HISTORICAL field evidence, never current
 * SQL custody, namespace semantics, acceptance, retry or key-removal authority.
 * Expected pins come from the owning native original request, not this reply.
 */
final class NativePrivateCustodyReadback {
    static final int MAX_RESPONSE=262144,CHUNK_BYTES=24576;
    enum Mode { WRITE,QUERY }
    private static final String[] AUTHORITY={"inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"};
    private static final String[] READBACK={"schema","state","operation_id","generation_id","chunk_index","native_request_id","request_body_sha256","attestation_digest","frame_sha256","record_sha256","plan_sha256","chunk_sha256","chunk_bytes","received_at",
        "frame_complete_syntax_verified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"};
    static final class Expected {
        final String operation,generation,writeRequest,bodySha,attestationSha,frameSha,recordSha,planSha,chunkSha;
        final int chunkIndex,chunkBytes;
        Expected(String operation,String generation,String writeRequest,String bodySha,String attestationSha,String frameSha,String recordSha,String planSha,String chunkSha,int chunkIndex,int chunkBytes)throws VaultFailure {
            if(!uuid(operation,4)||!uuid(generation,4)||!uuid(writeRequest,5)||chunkIndex<0||chunkBytes<1||chunkBytes>CHUNK_BYTES)throw invalid();
            for(String value:new String[]{bodySha,attestationSha,frameSha,recordSha,planSha,chunkSha})if(value==null||!value.matches("[0-9a-f]{64}"))throw invalid();
            this.operation=operation;this.generation=generation;this.writeRequest=writeRequest;this.bodySha=bodySha;this.attestationSha=attestationSha;this.frameSha=frameSha;this.recordSha=recordSha;this.planSha=planSha;this.chunkSha=chunkSha;this.chunkIndex=chunkIndex;this.chunkBytes=chunkBytes;
        }
    }
    static final class Verified {
        private final String readback;final Mode mode;final boolean reportedAmbiguousWriteReconciled;
        private Verified(JSONObject row,Mode mode,boolean ambiguous){readback=row.toString();this.mode=mode;reportedAmbiguousWriteReconciled=ambiguous;}
        JSONObject fields()throws VaultFailure {try{return new JSONObject(readback);}catch(Exception e){throw invalid();}}
    }
    /** A valid unresolved QUERY or non-200 reply yields no matching row. It
     * never creates a replacement query/write or authority from planned IDs. */
    static Verified verify(int status,byte[] body,Mode mode,Expected expected)throws VaultFailure {
        if(status<100||status>599||body==null||body.length>MAX_RESPONSE||mode==null||expected==null)throw invalid();
        if(status!=200)return null;
        try {
            JSONObject wrapper=ProviderWireJson.object(body,MAX_RESPONSE);keys(wrapper,"ok","data");truth(wrapper,"ok",true);Object dataValue=wrapper.get("data");if(!(dataValue instanceof JSONObject))throw invalid();JSONObject data=(JSONObject)dataValue;
            if(mode==Mode.QUERY&&"NO_MATCHING_ORIGINAL_WRITE_READBACK".equals(data.opt("state"))){
                keys(data,"schema","state","current_server_readback","write_outcome_unresolved","resend_allowed","inventory_acknowledged","work_accepted","new_work_allowed","finalizer_allowed","key_removal","phone_released");
                text(data,"schema","custodial.private-custody-read-result.v1");truth(data,"current_server_readback",false);truth(data,"write_outcome_unresolved",true);noAuthority(data);return null;
            }
            boolean ambiguous=false;
            if(mode==Mode.WRITE){keys(data,"schema","state","current_transaction_private_writer_called","commit_readback_confirmed","original_request_readback_confirmed","ambiguous_write_reconciled","readback","frame_complete_syntax_verified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released");
                text(data,"schema","custodial.private-custody-write-result.v1");text(data,"state","OPAQUE_CHUNK_COMMIT_AND_EXACT_READBACK_ONLY_NOT_SEMANTIC_ACK");
                truth(data,"current_transaction_private_writer_called",true);truth(data,"commit_readback_confirmed",true);truth(data,"original_request_readback_confirmed",true);truth(data,"frame_complete_syntax_verified",false);
                if(!(data.get("ambiguous_write_reconciled") instanceof Boolean))throw invalid();ambiguous=(Boolean)data.get("ambiguous_write_reconciled");
            }else{keys(data,"schema","state","readback","current_server_readback","write_outcome_unresolved","resend_allowed","inventory_acknowledged","work_accepted","new_work_allowed","finalizer_allowed","key_removal","phone_released");
                text(data,"schema","custodial.private-custody-read-result.v1");text(data,"state","EXACT_OPAQUE_CHUNK_READBACK_ONLY_NOT_SEMANTIC_ACK");truth(data,"current_server_readback",true);truth(data,"write_outcome_unresolved",false);
            }
            noAuthority(data);Object rowValue=data.get("readback");if(!(rowValue instanceof JSONObject))throw invalid();JSONObject row=(JSONObject)rowValue;keys(row,READBACK);
            text(row,"schema","custodial.private-custody-chunk-readback.v1");text(row,"state","OPAQUE_CHUNK_READ_ONLY_PENDING_RECONCILIATION");text(row,"operation_id",expected.operation);text(row,"generation_id",expected.generation);
            text(row,"native_request_id",expected.writeRequest);text(row,"request_body_sha256",expected.bodySha);text(row,"attestation_digest",expected.attestationSha);text(row,"frame_sha256",expected.frameSha);text(row,"record_sha256",expected.recordSha);text(row,"plan_sha256",expected.planSha);text(row,"chunk_sha256",expected.chunkSha);
            integer(row,"chunk_index",expected.chunkIndex);integer(row,"chunk_bytes",expected.chunkBytes);truth(row,"frame_complete_syntax_verified",false);noAuthority(row);
            Object received=row.get("received_at");if(!(received instanceof String)||!((String)received).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z"))throw invalid();
            LocalDateTime.parse(((String)received).substring(0,((String)received).length()-1));return new Verified(row,mode,ambiguous);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    private static boolean uuid(String value,int version){return value!=null&&value.matches("[0-9a-f]{8}-[0-9a-f]{4}-"+version+"[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");}
    private static void text(JSONObject value,String key,String expected)throws Exception{Object actual=value.get(key);if(!(actual instanceof String)||!expected.equals(actual))throw invalid();}
    private static void integer(JSONObject value,String key,int expected)throws Exception{Object actual=value.get(key);if(!(actual instanceof Integer||actual instanceof Long)||((Number)actual).longValue()!=expected)throw invalid();}
    private static void truth(JSONObject value,String key,boolean expected)throws Exception{if(!Boolean.valueOf(expected).equals(value.get(key)))throw invalid();}
    private static void noAuthority(JSONObject value)throws Exception{for(String key:AUTHORITY)truth(value,key,false);}
    private static void keys(JSONObject value,String... wanted)throws Exception{Set<String> names=new HashSet<>();for(var it=value.keys();it.hasNext();)names.add(it.next());if(!names.equals(Set.of(wanted)))throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure("custodial_private_custody_original_reply_preserved");}
}
