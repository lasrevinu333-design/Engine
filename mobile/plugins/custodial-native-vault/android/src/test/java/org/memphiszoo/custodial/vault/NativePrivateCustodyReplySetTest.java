package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;
import org.junit.Test;

/** NEW engine/journal composition with synthetic original values, host files,
 * JCE adapter and injected TLS connection. Not actual SQL/HTTP/Android/ACK. */
public final class NativePrivateCustodyReplySetTest {
    static void mark(String stage){System.out.println("NEW_REPLY_SET_PHASE "+stage);System.out.flush();}
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception{NativePrivateCustodyOwnerTest.denied(action);}
    static void noAuthority(JSONObject value)throws Exception {for(String key:new String[]{"writer_authority","durable_retention","current_server_readback","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified","frame_complete_syntax_verified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(key,value.getBoolean(key));
        for(String forbidden:new String[]{"response_base64","body_base64","owner_proof_base64","original_signed_wire_base64","native_request_attestation","SYNTHETIC_LONG_DEVICE_SECRET"})assertFalse(value.toString().contains(forbidden));}
    static JSONObject readback(VaultEngine.NativePrivateCustodyPreparedExchange p)throws Exception {byte[] bytes=NativePrivateCustodyExchangeTest.body(p);try{var body=ProviderWireJson.object(bytes,NativeRetainedAttempt.MAX_BODY);var projection=p.projection();
        var row=new JSONObject().put("schema","custodial.private-custody-chunk-readback.v1").put("state","OPAQUE_CHUNK_READ_ONLY_PENDING_RECONCILIATION").put("operation_id",body.get("operation_id")).put("generation_id",body.get("original_generation_id")).put("chunk_index",Integer.parseInt(body.getString("chunk_index")))
            .put("native_request_id",projection.get("native_request_id")).put("request_body_sha256",projection.get("request_body_sha256")).put("attestation_digest",projection.get("attestation_digest")).put("frame_sha256",body.get("frame_sha256")).put("record_sha256",body.get("record_sha256")).put("plan_sha256",body.get("plan_sha256")).put("chunk_sha256",body.get("chunk_sha256")).put("chunk_bytes",Integer.parseInt(body.getString("chunk_bytes")))
            .put("received_at","2026-10-10T23:10:33.954956Z").put("frame_complete_syntax_verified",false);for(String key:NativePrivateCustodyReadbackTest.FLAGS)row.put(key,false);return row;
    }finally{java.util.Arrays.fill(bytes,(byte)0);}}
    static byte[] reply(JSONObject row,boolean query)throws Exception {var data=new JSONObject().put("schema",query?"custodial.private-custody-read-result.v1":"custodial.private-custody-write-result.v1").put("state",query?"EXACT_OPAQUE_CHUNK_READBACK_ONLY_NOT_SEMANTIC_ACK":"OPAQUE_CHUNK_COMMIT_AND_EXACT_READBACK_ONLY_NOT_SEMANTIC_ACK").put("readback",row);
        for(String key:NativePrivateCustodyReadbackTest.FLAGS)data.put(key,false);if(query)data.put("current_server_readback",true).put("write_outcome_unresolved",false);else data.put("current_transaction_private_writer_called",true).put("commit_readback_confirmed",true).put("original_request_readback_confirmed",true).put("ambiguous_write_reconciled",false).put("frame_complete_syntax_verified",false);
        return new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);}
    @Test public void missingEvidenceAndPlannedIdsDoNotWriteOrCreateAuthority()throws Exception {mark("missing_begin");try(var f=new NativePrivateCustodyExchangeTest.Fixture()){
        var before=NativePrivateCustodyOwnerTest.files(f.x.f.dir);assertFalse(Files.exists(f.dir));try(var empty=f.engine.observeOriginalPrivateCustodyReplySet(f.plan,List.of())){var seen=empty.projection();noAuthority(seen);assertEquals(0,seen.getInt("historical_exact_original_chunk_replies"));assertFalse(seen.getBoolean("all_original_chunk_reply_bindings_present"));}
        assertFalse(Files.exists(f.dir));try(var p=f.write(0)){var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var missing=f.engine.observeOriginalPrivateCustodyReplySet(f.plan,List.of(p))){var value=missing.projection();noAuthority(value);assertEquals(0,value.getInt("historical_exact_original_chunk_replies"));assertEquals("ABSENT",value.getJSONArray("original_request_and_observation_artifacts").getJSONObject(0).get("observation_phase"));}
            denied(()->f.engine.observeOriginalPrivateCustodyReplySet(f.plan,List.of(p,p)));denied(()->f.engine.observeOriginalPrivateCustodyReplySet(null,List.of(p)));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}
        NativePrivateCustodyOwnerTest.sameFiles(before,f.x.f.dir); // Original preexisting capsule stays byte-identical; preparation intentionally adds one protected write.
    }mark("missing_complete");}
    @Test public void allOriginalChunkRepliesAndMatchingQueryStayHistoricalAndOwnerBound()throws Exception {mark("all_begin");try(var x=new NativePrivateCustodyHttpOutcomeTest.Fixture()){
        var f=x.f;var originals=new ArrayList<VaultEngine.NativePrivateCustodyPreparedExchange>();JSONObject first=null;
        try{int count=f.plan.projection().getInt("chunk_count");assertTrue(count>=2);
            for(int i=0;i<count;i++){var p=f.write(i);originals.add(p);var row=readback(p);if(i==0)first=new JSONObject(row.toString());final byte[] response=reply(row,false);x.configure=()->x.connection.response=response;
                x.send(p);mark("durable_original_reply_"+i);}
            var query=f.query(0);originals.add(query);final byte[] queryReply=reply(first,true);x.configure=()->x.connection.response=queryReply;x.send(query);mark("original_query_reply");
            var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var set=f.engine.observeOriginalPrivateCustodyReplySet(f.plan,originals)){var value=set.projection();noAuthority(value);assertEquals(count,value.getInt("historical_exact_original_chunk_replies"));assertEquals(count,value.getInt("expected_original_chunks"));assertTrue(value.getBoolean("all_original_chunk_reply_bindings_present"));
                assertEquals(count+1,value.getJSONArray("original_request_and_observation_artifacts").length());assertEquals(count+1,x.opens);value.put("key_removal",true);assertFalse(set.projection().getBoolean("key_removal"));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
                originals.get(0).close();denied(set::projection);assertEquals(count+1,x.opens);}
            denied(()->f.engine.observeOriginalPrivateCustodyReplySet(f.plan,originals));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
        }finally{for(var p:originals)p.close();}
    }mark("all_complete");}
}
