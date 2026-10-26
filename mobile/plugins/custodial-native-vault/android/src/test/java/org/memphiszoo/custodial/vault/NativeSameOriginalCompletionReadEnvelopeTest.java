package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** New codec-only cases. All QUERY/proof strings are synthetic syntax data,
 * not an authenticated native owner or accepted completion. No old suites run.
 */
public final class NativeSameOriginalCompletionReadEnvelopeTest {
    private static final String TIME="2000-02-29T12:34:56.007Z",SHA="a".repeat(64),OTHER_SHA="b".repeat(64);
    private static final String[] QUERY_FIELDS={"operation_id","original_generation_id","principal_digest","engine_revision",
        "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","frame_bytes","chunk_count","chunk_index",
        "offset","chunk_bytes","chunk_sha256","write_id","attempt_id","read_query_id","owner_proof_base64",
        "original_signed_wire_base64","purpose_binding_sha256","purpose_attestation","target_native_request_id",
        "target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"};
    private static byte[] raw(String s){return s.getBytes(StandardCharsets.UTF_8);}
    private static byte[] raw(JSONObject o){return raw(o.toString());}
    private static byte[] query(){
        StringBuilder s=new StringBuilder("{\"schema\":\"custodial.original-native-private-custody-query.v1\"");
        for(String k:QUERY_FIELDS)s.append(",\"").append(k).append("\":\"v\"");
        return raw(s.append('}').toString());
    }
    private static byte[] current(byte[] original){
        return raw("{\"schema\":\"custodial.original-private-custody-current-query.v1\",\"original_query_body_base64\":\""
            +Base64.getEncoder().encodeToString(original)+"\",\"original_query_timestamp\":\""+TIME
            +"\",\"original_query_http_attestation\":\""+SHA+"\",\"original_query_unknown_record_sha256\":\""+OTHER_SHA+"\"}");
    }
    private static byte[] current(){return current(query());}
    private static JSONObject object(byte[] bytes)throws Exception{return ProviderWireJson.object(bytes,8*1024*1024);}
    private static byte[] encode(byte[] q,byte[] a)throws Exception{return NativeSameOriginalCompletionReadEnvelope.encode(q,a);}
    private static void refuses(byte[] q,byte[] a)throws Exception{
        byte[] qb=q==null?null:q.clone(),ab=a==null?null:a.clone();
        try{encode(q,a);fail("codec must refuse");}
        catch(VaultFailure failure){assertEquals(NativeSameOriginalCompletionReadEnvelope.FAILURE,failure.code);}
        if(q!=null)assertArrayEquals(qb,q);if(a!=null)assertArrayEquals(ab,a);
    }

    public static void main(String[] args)throws Exception{
        if(args.length==1&&"--original-completion-response-only".equals(args[0])){
            for(String name:new String[]{"RESPONSE_unresolvedNeverParsesOpaqueArguments","RESPONSE_acceptedOriginalBindingAndSnapshot",
                "RESPONSE_expectedOriginalPinsAndHashRefuse","RESPONSE_originalActorAndClientBindingsRefuse",
                "RESPONSE_optionalPinsMatchWithoutSnapshotContextMapping","RESPONSE_closedWrapperDataAndEffectsRefuse",
                "RESPONSE_closedFifteenStringsAndEightUuids","RESPONSE_canonicalCivilTimesNoSubmissionOrdering",
                "RESPONSE_epochFingerprintAndOriginalMilliseconds","RESPONSE_duplicatesUtf8AndNullsRefuse",
                "RESPONSE_boundsAndFreshDetachedProjection","RESPONSE_exactRawArgumentsAndCallerPreservation"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalCompletionReadEnvelopeTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_UNTRUSTED_RESPONSE_ONLY "+name);
            }
            System.out.println("NEW_RESPONSE_12_ONLY_NO_AUTHENTICATION_SQL_HTTP_ACK_OR_EFFECTS");return;
        }
        if(args.length!=1||!"--original-completion-read-envelope-only".equals(args[0]))
            throw new IllegalArgumentException("new_original_completion_read_codec_only");
        for(String name:new String[]{"READ_closedStringsPreserveExactOpaqueOriginals","READ_crossLanguageExactBytes",
            "READ_maximumBothInputsAndPurposeOnlyBound","READ_outerClosedStringsOnly","READ_originalQueryValidatorReused",
            "READ_fatalUtf8DuplicateBomAndTrailingRefuse","READ_originalCalendarAndHashesNotRenewed",
            "READ_originalBase64CanonicalAndBounded","READ_freshOutputAndFailurePreserveCallers","READ_nullEmptyAndOversizeRefuse"}){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalCompletionReadEnvelopeTest.class,name));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError(name);
            }
            System.out.println("PASS_REPRESENTATION_ONLY "+name);
        }
        System.out.println("NEW_COMPLETION_READ_10_ONLY_NO_AUTHENTICATION_HTTP_ACK_OR_EFFECTS");
    }

    @Test public void READ_closedStringsPreserveExactOpaqueOriginals()throws Exception{
        byte[] q=raw(" \n"+new String(current(),StandardCharsets.UTF_8).replace("\"schema\"","\"\\u0073chema\"")+"\t ");
        // Not valid JSON or even valid UTF-8: completion arguments are OPAQUE.
        byte[] a={(byte)0xff,0,10,(byte)0xc3,40,34,92};
        JSONObject out=object(encode(q,a));
        assertEquals(Set.of("schema","current_original_query_envelope_base64","original_completion_arguments_base64"),out.keySet());
        for(String key:out.keySet())assertTrue(out.get(key) instanceof String);
        assertEquals("custodial.same-original-completion-read.v1",out.get("schema"));
        assertArrayEquals(q,Base64.getDecoder().decode(out.getString("current_original_query_envelope_base64")));
        assertArrayEquals(a,Base64.getDecoder().decode(out.getString("original_completion_arguments_base64")));
        assertEquals(Base64.getEncoder().encodeToString(q),out.get("current_original_query_envelope_base64"));
        assertEquals(Base64.getEncoder().encodeToString(a),out.get("original_completion_arguments_base64"));
        assertEquals("/device-auth/private-custody-original-completion-read",NativeSameOriginalCompletionReadEnvelope.PATH);
    }

    @Test public void READ_crossLanguageExactBytes()throws Exception{
        // Independent Node22 Buffer/JSON.stringify reference, tool receipt
        // 1f7612: query684/current1269/output1841 bytes; args AAECf4D/.
        byte[] out=encode(current(),new byte[]{0,1,2,127,(byte)128,(byte)255});
        assertEquals(1841,out.length);
        assertEquals("2034f385c0e59b6ac1dffdf9b2d9cb0286b6bb842b46cabf10f84dbca6483f57",
            java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(out)));
        assertEquals("AAECf4D/",object(out).get("original_completion_arguments_base64"));
    }

    @Test public void READ_maximumBothInputsAndPurposeOnlyBound()throws Exception{
        byte[] original=Arrays.copyOf(query(),393216);Arrays.fill(original,query().length,original.length,(byte)' ');
        byte[] q0=current(original),q=Arrays.copyOf(q0,526336);Arrays.fill(q,q0.length,q.length,(byte)' ');
        byte[] a=new byte[4*1024*1024];for(int i=0;i<a.length;i++)a[i]=(byte)i;
        byte[] out=encode(q,a);assertTrue(out.length<=8*1024*1024);assertTrue(out.length>4*1024*1024);
        JSONObject parsed=object(out);
        assertArrayEquals(q,Base64.getDecoder().decode(parsed.getString("current_original_query_envelope_base64")));
        assertArrayEquals(a,Base64.getDecoder().decode(parsed.getString("original_completion_arguments_base64")));
        assertEquals(393216,NativePrivateCustodyCurrentQueryEnvelope.MAX_ORIGINAL);
        assertEquals(526336,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
        assertEquals(393216,NativeRetainedAttempt.MAX_BODY);
    }

    @Test public void READ_outerClosedStringsOnly()throws Exception{
        for(String key:new String[]{"schema","original_query_body_base64","original_query_timestamp","original_query_http_attestation","original_query_unknown_record_sha256"}){
            JSONObject missing=object(current());missing.remove(key);refuses(raw(missing),new byte[]{1});
            refuses(raw(object(current()).put(key,JSONObject.NULL)),new byte[]{1});
            refuses(raw(object(current()).put(key,7)),new byte[]{1});
        }
        refuses(raw(object(current()).put("extra",false)),new byte[]{1});
        refuses(raw(object(current()).put("schema","foreign.v1")),new byte[]{1});
        refuses(raw("[]"),new byte[]{1});
    }

    @Test public void READ_originalQueryValidatorReused()throws Exception{
        JSONObject q=object(query());q.remove("read_query_id");refuses(current(raw(q)),new byte[]{1});
        for(JSONObject bad:new JSONObject[]{object(query()).put("schema","custodial.original-native-private-custody-write.v1"),
            object(query()).put("engine_revision",0),object(query()).put("owner_proof_base64",""),object(query()).put("extra","v")})
            refuses(current(raw(bad)),new byte[]{1});
        // Syntactically nonempty strings alone do NOT establish real IDs,
        // HMACs, proof, currentness or an accepted completion.
        assertNotNull(encode(current(),new byte[]{1}));
    }

    @Test public void READ_fatalUtf8DuplicateBomAndTrailingRefuse()throws Exception{
        byte[] q=current();q[10]=(byte)0xff;refuses(q,new byte[]{1});
        String text=new String(current(),StandardCharsets.UTF_8);
        for(String bad:new String[]{"\ufeff"+text,text+" {}","{\"schema\":\"duplicate\","+text.substring(1),
            "{\"\\u0073chema\":\"duplicate\","+text.substring(1)})refuses(raw(bad),new byte[]{1});
        byte[] original=query();original[10]=(byte)0xff;refuses(current(original),new byte[]{1});
        String inner=new String(query(),StandardCharsets.UTF_8);
        for(String bad:new String[]{"\ufeff"+inner,inner+" {}","{\"schema\":\"duplicate\","+inner.substring(1),
            "{\"\\u0073chema\":\"duplicate\","+inner.substring(1),inner.replace("\"v\"","\"\\ud800\"")})
            refuses(current(raw(bad)),new byte[]{1});
    }

    @Test public void READ_originalCalendarAndHashesNotRenewed()throws Exception{
        for(String time:new String[]{"2026-02-29T12:34:56.007Z","2000-02-29T12:34:60.007Z","2000-02-29T12:34:56.007000Z",
            "2000-02-29T12:34:56.007+00:00",TIME+"\n"})
            refuses(raw(object(current()).put("original_query_timestamp",time)),new byte[]{1});
        for(String key:new String[]{"original_query_http_attestation","original_query_unknown_record_sha256"})
            for(String hash:new String[]{"A".repeat(64),"a".repeat(63),SHA+"\n"})refuses(raw(object(current()).put(key,hash)),new byte[]{1});
        byte[] q=current();assertArrayEquals(q,Base64.getDecoder().decode(object(encode(q,new byte[]{1})).getString("current_original_query_envelope_base64")));
        // Year2000 remains exactly archived, not newly current/fresh.
    }

    @Test public void READ_originalBase64CanonicalAndBounded()throws Exception{
        for(String bad:new String[]{"","!","Zh==","e30= ","-_==","e30"})
            refuses(raw(object(current()).put("original_query_body_base64",bad)),new byte[]{1});
        byte[] large=Arrays.copyOf(query(),393217);Arrays.fill(large,query().length,large.length,(byte)' ');
        refuses(current(large),new byte[]{1});
    }

    @Test public void READ_freshOutputAndFailurePreserveCallers()throws Exception{
        byte[] q=current(),a={3,0,(byte)255},qb=q.clone(),ab=a.clone();
        byte[] first=encode(q,a),second=encode(q,a);assertNotSame(first,second);
        assertArrayEquals(first,second);Arrays.fill(first,(byte)0);assertNotEquals(0,second[0]);
        assertArrayEquals(qb,q);assertArrayEquals(ab,a);
        refuses(raw(object(current()).put("extra",true)),a);
        Arrays.fill(q,(byte)0);Arrays.fill(a,(byte)0);
        assertArrayEquals(qb,Base64.getDecoder().decode(object(second).getString("current_original_query_envelope_base64")));
        assertArrayEquals(ab,Base64.getDecoder().decode(object(second).getString("original_completion_arguments_base64")));
    }

    private static final String OP="a1000000-0000-4000-8000-000000000001",GEN="a1000000-0000-4000-8000-000000000002";
    private static final String EMP="a1000000-0000-4000-8000-000000000003",CRED="a1000000-0000-4000-8000-000000000004";
    private static final String CTX="a1000000-0000-4000-8000-000000000005",OCC="a1000000-0000-4000-8000-000000000006";
    private static final String END="2000-02-29T12:35:56.008Z";
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
    private static NativeProviderPrincipal principal()throws Exception{
        // Existing typed factory, SYNTHETIC journal syntax only, not actual
        // native provenance/authentication or a caller-facing constructor.
        return NativeProviderPrincipal.fromNativeJournal(new JSONObject().put("schema_version","custodial-protected-principal.v1")
            .put("device_id","KIOSK_08").put("employee_id",EMP).put("credential_id",CRED).put("assignment_epoch",7)
            .put("credential_operation_id",OP).put("installation_seal","synthetic-seal-only").put("enrolled_at",TIME));
    }
    private static JSONObject completion()throws Exception{
        return new JSONObject().put("p_device_id","KIOSK_08").put("p_client_session_id","original-client-session")
            .put("p_client_completion_id","original-client-completion").put("p_client_started_at",TIME).put("p_client_ended_at",END)
            .put("p_response_json",new JSONObject().put("__custodial_offline_reconciliation_v1",new JSONObject().put("context_id",CTX).put("submission_proof",SHA)));
    }
    private static JSONObject accepted()throws Exception{
        return new JSONObject().put("reconciliation_id",OP).put("context_id",CTX).put("occurrence_id",OCC).put("session_id",GEN)
            .put("completion_response_id",CRED).put("client_session_id","original-client-session").put("client_completion_id","original-client-completion")
            .put("employee_id",EMP).put("credential_id",CRED).put("assignment_epoch","7").put("payload_fingerprint",SHA)
            .put("started_at","2000-02-29T12:34:56.007000Z").put("ended_at","2000-02-29T12:35:56.008000Z")
            .put("submitted_at","0001-01-01T00:00:00.000001Z").put("location_id",OP);
    }
    private static JSONObject response(byte[] args,boolean found)throws Exception{
        JSONObject limits=new JSONObject();for(String k:EFFECTS)limits.put(k,false);
        return new JSONObject().put("ok",true).put("data",new JSONObject()
            .put("schema","custodial.same-original-completion-SQL-read.v1").put("state","CURRENT_EXACT_ORIGINAL_COMPLETION_DISPOSITION_NOT_ACK")
            .put("operation_id",OP).put("original_generation_id",GEN).put("argument_values_sha256",NativeRetainedAttempt.hash(args))
            .put("disposition",found?"ACCEPTED_EXACT_ORIGINAL":"UNRESOLVED_RETAINED").put("result",found?accepted():JSONObject.NULL)
            .put("transaction_authority",false).put("limits",limits));
    }
    private static NativeSameOriginalCompletionReadEnvelope.UntrustedReadback decode(byte[] body,byte[] args)throws Exception{
        return NativeSameOriginalCompletionReadEnvelope.decodeResponse(body,OP,GEN,args,principal());
    }
    private static void rejectResponse(byte[] body,byte[] args)throws Exception{
        byte[] b=body==null?null:body.clone(),a=args==null?null:args.clone();
        try{decode(body,args);fail("response must refuse");}catch(VaultFailure e){assertEquals(NativeSameOriginalCompletionReadEnvelope.FAILURE,e.code);}
        if(body!=null)assertArrayEquals(b,body);if(args!=null)assertArrayEquals(a,args);
    }
    @Test public void RESPONSE_unresolvedNeverParsesOpaqueArguments()throws Exception{
        byte[] a={(byte)255,0,1,(byte)128};
        JSONObject out=decode(raw(response(a,false)),a).json();assertSame(JSONObject.NULL,out.get("result"));
        assertEquals("UNRESOLVED_RETAINED",out.get("disposition"));
        byte[] maximum=new byte[4*1024*1024];Arrays.fill(maximum,(byte)255);
        assertEquals("UNRESOLVED_RETAINED",decode(raw(response(maximum,false)),maximum).json().get("disposition"));
        rejectResponse(raw(response(a,true)),a);
    }
    @Test public void RESPONSE_acceptedOriginalBindingAndSnapshot()throws Exception{
        byte[] a=raw(completion());JSONObject out=decode(raw(response(a,true)),a).json();
        assertEquals(15,out.getJSONObject("result").length());assertEquals(9,out.length());
        assertFalse(out.getBoolean("transaction_authority"));for(String k:EFFECTS)assertSame(Boolean.FALSE,out.getJSONObject("limits").get(k));
        assertEquals("ACCEPTED_EXACT_ORIGINAL",out.get("disposition"));
        // Accepted state is untrusted server representation, NOT a grant.
    }
    @Test public void RESPONSE_expectedOriginalPinsAndHashRefuse()throws Exception{
        byte[] a=raw(completion());
        for(String key:new String[]{"operation_id","original_generation_id","argument_values_sha256","schema","state","disposition"}){
            JSONObject body=response(a,true);body.getJSONObject("data").put(key,key.equals("argument_values_sha256")?OTHER_SHA:OP+"x");rejectResponse(raw(body),a);
        }
        for(String bad:new String[]{null,"not-uuid",OP.toUpperCase(),OP+"\n"}){
            try{NativeSameOriginalCompletionReadEnvelope.decodeResponse(raw(response(a,true)),bad,GEN,a,principal());fail();}catch(VaultFailure expected){}
            try{NativeSameOriginalCompletionReadEnvelope.decodeResponse(raw(response(a,true)),OP,bad,a,principal());fail();}catch(VaultFailure expected){}
        }
    }
    @Test public void RESPONSE_originalActorAndClientBindingsRefuse()throws Exception{
        for(String key:new String[]{"p_device_id","p_client_session_id","p_client_completion_id"}){
            byte[] a=raw(completion().put(key,"successor"));rejectResponse(raw(response(a,true)),a);
        }
        byte[] a=raw(completion());for(String k:new String[]{"employee_id","credential_id","client_session_id","client_completion_id","context_id"}){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put(k,k.startsWith("client")?"successor":GEN);rejectResponse(raw(b),a);
        }
        try{NativeSameOriginalCompletionReadEnvelope.decodeResponse(raw(response(a,false)),OP,GEN,a,null);fail();}catch(VaultFailure expected){}
    }
    @Test public void RESPONSE_optionalPinsMatchWithoutSnapshotContextMapping()throws Exception{
        JSONObject args=completion().put("p_context_id",CTX).put("p_occurrence_id",OCC).put("p_snapshot_employee_id",EMP)
            .put("p_snapshot_credential_id",CRED).put("p_snapshot_assignment_epoch",7).put("p_snapshot_id",OTHER_SHA).put("p_submission_proof",SHA);
        byte[] a=raw(args);assertNotNull(decode(raw(response(a,true)),a));
        for(String k:new String[]{"p_context_id","p_occurrence_id","p_snapshot_employee_id","p_snapshot_credential_id","p_snapshot_assignment_epoch","p_snapshot_id","p_submission_proof"}){
            JSONObject bad=new JSONObject(args.toString()).put(k,k.endsWith("epoch")?8:k.equals("p_snapshot_id")?CTX:GEN);
            a=raw(bad);rejectResponse(raw(response(a,true)),a);
            JSONObject absent=new JSONObject(args.toString()).put(k,JSONObject.NULL);a=raw(absent);assertNotNull(decode(raw(response(a,true)),a));
        }
        a=raw(new JSONObject(args.toString()).put("p_snapshot_assignment_epoch","7"));rejectResponse(raw(response(a,true)),a);
        a=raw(new JSONObject(args.toString()).put("p_snapshot_assignment_epoch",7.5));rejectResponse(raw(response(a,true)),a);
    }
    @Test public void RESPONSE_closedWrapperDataAndEffectsRefuse()throws Exception{
        byte[] a=raw(completion());
        for(Object bad:new Object[]{false,"true",JSONObject.NULL,1})rejectResponse(raw(response(a,true).put("ok",bad)),a);
        rejectResponse(raw(response(a,true).put("extra",false)),a);JSONObject missing=response(a,true);missing.remove("ok");rejectResponse(raw(missing),a);
        for(String k:new String[]{"schema","state","operation_id","original_generation_id","argument_values_sha256","disposition","result","transaction_authority","limits"}){
            JSONObject b=response(a,true);b.getJSONObject("data").remove(k);rejectResponse(raw(b),a);
        }
        JSONObject b=response(a,true);b.getJSONObject("data").put("extra",false);rejectResponse(raw(b),a);
        for(Object bad:new Object[]{true,"false",JSONObject.NULL,0}){b=response(a,true);b.getJSONObject("data").put("transaction_authority",bad);rejectResponse(raw(b),a);}
        for(String k:EFFECTS){b=response(a,true);b.getJSONObject("data").getJSONObject("limits").put(k,true);rejectResponse(raw(b),a);
            b=response(a,true);b.getJSONObject("data").getJSONObject("limits").remove(k);rejectResponse(raw(b),a);}
        b=response(a,true);b.getJSONObject("data").getJSONObject("limits").put("extra",false);rejectResponse(raw(b),a);
        b=response(a,false);b.getJSONObject("data").put("result",accepted());rejectResponse(raw(b),a);
    }
    @Test public void RESPONSE_closedFifteenStringsAndEightUuids()throws Exception{
        byte[] a=raw(completion());for(String k:accepted().keySet()){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").remove(k);rejectResponse(raw(b),a);
            b=response(a,true);b.getJSONObject("data").getJSONObject("result").put(k,7);rejectResponse(raw(b),a);
        }
        JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("extra",false);rejectResponse(raw(b),a);
        for(String k:new String[]{"reconciliation_id","context_id","occurrence_id","session_id","completion_response_id","employee_id","credential_id","location_id"}){
            b=response(a,true);b.getJSONObject("data").getJSONObject("result").put(k,OP.toUpperCase());rejectResponse(raw(b),a);
        }
    }
    @Test public void RESPONSE_canonicalCivilTimesNoSubmissionOrdering()throws Exception{
        byte[] a=raw(completion());for(String time:new String[]{"0000-01-01T00:00:00.000000Z","1900-02-29T00:00:00.000000Z",
            "2000-02-29T24:00:00.000000Z","2000-02-29T12:34:60.000000Z",TIME,"2000-02-29T12:34:56.007000+00:00","infinity"}){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("submitted_at",time);rejectResponse(raw(b),a);
        }
        for(String time:new String[]{"0001-01-01T00:00:00.000001Z","9999-12-31T23:59:59.999999Z"}){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("submitted_at",time);assertNotNull(decode(raw(b),a));
        }
        for(String time:new String[]{"2000-02-29T12:34:56.007000Z","2000-02-29T12:34:56.006999Z"}){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("ended_at",time);rejectResponse(raw(b),a);
        }
    }
    @Test public void RESPONSE_epochFingerprintAndOriginalMilliseconds()throws Exception{
        byte[] a=raw(completion());for(String epoch:new String[]{"0","07","+7","7.0","9007199254740992","8"}){
            JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("assignment_epoch",epoch);rejectResponse(raw(b),a);
        }
        JSONObject b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("payload_fingerprint",SHA.toUpperCase());rejectResponse(raw(b),a);
        for(String time:new String[]{"2000-02-29T12:34:56.007000Z","2000-02-29T12:34:56.007+00:00","1900-02-29T12:34:56.007Z"}){
            a=raw(completion().put("p_client_started_at",time));rejectResponse(raw(response(a,true)),a);
        }
        a=raw(completion());b=response(a,true);b.getJSONObject("data").getJSONObject("result").put("started_at","2000-02-29T12:34:56.007001Z");rejectResponse(raw(b),a);
    }
    @Test public void RESPONSE_duplicatesUtf8AndNullsRefuse()throws Exception{
        byte[] a=raw(completion()),b=raw(response(a,true));b[5]=(byte)255;rejectResponse(b,a);
        String body=response(a,true).toString();for(String bad:new String[]{"\ufeff"+body,body+" {}","{\"ok\":true,"+body.substring(1),
            body.replace("\"assignment_epoch\":\"7\"","\"assignment_epoch\":\"7\",\"\\u0061ssignment_epoch\":\"7\"")})rejectResponse(raw(bad),a);
        rejectResponse(null,a);rejectResponse(new byte[0],a);rejectResponse(raw(response(a,true)),null);rejectResponse(raw(response(a,true)),new byte[0]);
        a=raw(new String(raw(completion()),StandardCharsets.UTF_8).replace("\"p_device_id\":\"KIOSK_08\"","\"p_device_id\":\"KIOSK_08\",\"p_device_id\":\"KIOSK_08\""));
        rejectResponse(raw(response(a,true)),a);
    }
    @Test public void RESPONSE_boundsAndFreshDetachedProjection()throws Exception{
        byte[] a=raw(completion()),b=raw(response(a,true));byte[] padded=Arrays.copyOf(b,131072);Arrays.fill(padded,b.length,padded.length,(byte)' ');
        var out=decode(padded,a);out.json().getJSONObject("result").put("employee_id",GEN);out.json().getJSONObject("limits").put("work_accepted",true);
        assertEquals(EMP,out.json().getJSONObject("result").get("employee_id"));assertFalse(out.json().getJSONObject("limits").getBoolean("work_accepted"));
        rejectResponse(Arrays.copyOf(padded,131073),a);rejectResponse(b,new byte[4*1024*1024+1]);
        JSONObject huge=response(a,true);huge.getJSONObject("data").getJSONObject("result").put("client_session_id","x".repeat(65536));rejectResponse(raw(huge),a);
        assertTrue(Arrays.stream(NativeSameOriginalCompletionReadEnvelope.UntrustedReadback.class.getDeclaredConstructors())
            .allMatch(c->java.lang.reflect.Modifier.isPrivate(c.getModifiers())));
    }
    @Test public void RESPONSE_exactRawArgumentsAndCallerPreservation()throws Exception{
        byte[] a=raw(" \n"+completion().toString()+"\t"),b=raw(response(a,true)),ac=a.clone(),bc=b.clone();
        var out=decode(b,a);assertArrayEquals(ac,a);assertArrayEquals(bc,b);
        byte[] changed=raw(completion());rejectResponse(b,changed);Arrays.fill(a,(byte)0);Arrays.fill(b,(byte)0);
        assertEquals(NativeRetainedAttempt.hash(ac),out.json().get("argument_values_sha256"));
        assertEquals("ACCEPTED_EXACT_ORIGINAL",out.json().get("disposition"));
    }

    @Test public void READ_nullEmptyAndOversizeRefuse()throws Exception{
        refuses(null,new byte[]{1});refuses(new byte[0],new byte[]{1});refuses(current(),null);refuses(current(),new byte[0]);
        refuses(new byte[526337],new byte[]{1});refuses(current(),new byte[4*1024*1024+1]);
    }
}
