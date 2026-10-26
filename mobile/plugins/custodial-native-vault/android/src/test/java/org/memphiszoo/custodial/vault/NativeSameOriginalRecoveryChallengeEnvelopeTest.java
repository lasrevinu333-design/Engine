package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** NEW encoder composition, using structural TEST data only. No original
 * owner, real intent/credential/proof, HMAC, transport or authority is minted.
 */
public final class NativeSameOriginalRecoveryChallengeEnvelopeTest {
    private static final String ID="95000000-0000-4000-8000-000000000041";
    private static final String OTHER="95000000-0000-4000-8000-000000000042";
    private static final String SHA="a".repeat(64),OTHER_SHA="b".repeat(64);
    private static final String TIME="2000-02-29T12:34:56.007Z";
    private static final String[] PINS={"operation_id","original_generation_id","principal_digest","engine_revision",
        "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"};
    private static byte[] raw(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static byte[] raw(JSONObject value){return raw(value.toString());}
    private static JSONObject targetJson()throws Exception {
        JSONObject value=new JSONObject();
        for(String key:new String[]{"operation_id","separation_id","canonical_device_pk","employee_id","credential_id","original_generation_id"})value.put(key,ID);
        for(String key:new String[]{"original_credential_secret_key_id","principal_digest","original_wire_sha256","original_frozen_work_sha256",
            "capsule_sha256","record_sha256","frame_sha256","plan_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})value.put(key,SHA);
        return value.put("separation_authority_revision","7").put("assignment_epoch","7").put("engine_revision","0").put("canonical_device_id","KIOSK_08");
    }
    private static NativeSameOriginalRecoveryPreparationWire.UntrustedTarget target()throws Exception {
        return NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(targetJson()));
    }
    private static JSONObject query()throws Exception {
        JSONObject value=new JSONObject().put("schema","custodial.original-native-private-custody-query.v1");
        for(String key:new String[]{"operation_id","original_generation_id","write_id","attempt_id","read_query_id","target_native_request_id"})value.put(key,ID);
        for(String key:new String[]{"principal_digest","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_sha256",
            "purpose_binding_sha256","purpose_attestation","target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"})value.put(key,SHA);
        return value.put("engine_revision","0").put("frame_bytes","64").put("chunk_count","1").put("chunk_index","0")
            .put("offset","0").put("chunk_bytes","64").put("owner_proof_base64","e30=").put("original_signed_wire_base64","e30=");
    }
    private static JSONObject outer(byte[] original)throws Exception {
        return new JSONObject().put("schema",NativePrivateCustodyCurrentQueryEnvelope.SCHEMA)
            .put("original_query_body_base64",NativeRetainedAttempt.encodeBase64(original)).put("original_query_timestamp",TIME)
            .put("original_query_http_attestation",SHA).put("original_query_unknown_record_sha256",OTHER_SHA);
    }
    private static byte[] current()throws Exception {
        return NativePrivateCustodyCurrentQueryEnvelope.encode(raw(query()),TIME,SHA,OTHER_SHA);
    }
    private static byte[] encode(byte[] current)throws Exception {return NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target(),OTHER,SHA);}
    private interface Checked {void run()throws Exception;}
    private static void refuses(Checked body)throws Exception {
        try{body.run();fail("invalid challenge envelope accepted");}
        catch(VaultFailure failure){assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.FAILURE,failure.code);}
    }
    private static void rejectCurrent(byte[] value)throws Exception {
        byte[] before=value.clone();refuses(()->encode(value));assertArrayEquals(before,value);
    }
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--challenge-status-envelope-only".equals(args[0])){
            for(String name:new String[]{"STATUS_closedFiveStringsPreserveExactArchivedBytes","STATUS_originalChallengeShapePurposeAndPinsRefuse",
                "STATUS_nestedCurrentQueryValidationRefuses","STATUS_calendarAndAttestationCanonicalOnly",
                "STATUS_fatalUtf8DuplicateBomTrailingRefuse","STATUS_detachedAndCallerPrecisionPreserved","STATUS_maximumAndMissingInputsRefuse"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryChallengeEnvelopeTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_STATUS_REPRESENTATION_ONLY "+name);
            }
            System.out.println("NEW_STATUS_7_ONLY_NO_AUTH_CLOCK_SIGNING_HTTP_OR_EFFECTS");return;
        }
        if(args.length==1&&"--saved-body-decode-new".equals(args[0])){
            new NativeSameOriginalRecoveryChallengeEnvelopeTest().SAVED_BODY_newPurposeBoundWithoutLegacyWidening();
            System.out.println("PASS_NEW_SAVED_BODY_BOUNDS_ONLY_NO_REQUEST_AUTH_OR_EFFECTS");return;
        }
        if(args.length!=1||!"--challenge-envelope-only".equals(args[0]))throw new IllegalArgumentException("new_challenge_encoder_only");
        for(String name:new String[]{"CHALLENGE_exactClosedBodyPreservesNestedOriginalBytes","CHALLENGE_eachMixedTargetPinRefuses",
            "CHALLENGE_outerDuplicateForeignTypesAndFieldsRefuse","CHALLENGE_originalQueryDuplicateMissingTypeAndWriteRefuse",
            "CHALLENGE_archiveCalendarAndHashesNotRenewed","CHALLENGE_intentIdentityIsInputOnly",
            "CHALLENGE_fatalUtf8BomTrailingAndBase64Refuse","CHALLENGE_exactMaximumSizesAndOversizeRefusal",
            "CHALLENGE_detachedOutputAndFailurePreserveCallerData","CHALLENGE_missingInputsRefuseWithoutDefaultIdentity"}){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryChallengeEnvelopeTest.class,name));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
            }
            System.out.println("PASS_ENCODER_REPRESENTATION_ONLY "+name);
        }
        System.out.println("NEW_CHALLENGE_10_ONLY_NO_DURABLE_INTENT_AUTH_HTTP_OR_EFFECTS");
    }
    private static byte[] challenge()throws Exception {return encode(current());}
    private static JSONObject challengeJson()throws Exception {return ProviderWireJson.object(challenge(),786432);}
    private static byte[] status(byte[] original)throws Exception {return NativeSameOriginalRecoveryChallengeEnvelope.encodeStatus(original,TIME,SHA);}
    private static void rejectStatus(byte[] original)throws Exception {
        byte[] before=original==null?null:original.clone();refuses(()->status(original));
        if(original!=null)assertArrayEquals(before,original);
    }
    @Test public void STATUS_closedFiveStringsPreserveExactArchivedBytes()throws Exception {
        byte[] original=raw(" \n"+challengeJson().toString().replace("native_challenge_intent_id","\\u006eative_challenge_intent_id")+"\t ");
        byte[] before=original.clone(),encoded=status(original);
        var body=ProviderWireJson.object(encoded,NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS);
        assertEquals(Set.of("schema","purpose","original_challenge_body_base64","original_challenge_timestamp","original_challenge_http_attestation"),body.keySet());
        for(String key:body.keySet())assertTrue(body.get(key) instanceof String);
        assertEquals("custodial.same-original-recovery-native-status.v1",body.get("schema"));
        assertEquals("OBSERVE_ORIGINAL_REGISTRATION_ONLY",body.get("purpose"));assertEquals(TIME,body.get("original_challenge_timestamp"));
        assertEquals(SHA,body.get("original_challenge_http_attestation"));
        assertArrayEquals(original,java.util.Base64.getDecoder().decode(body.getString("original_challenge_body_base64")));
        assertEquals(java.util.Base64.getEncoder().encodeToString(original),body.get("original_challenge_body_base64"));
        assertArrayEquals(before,original);assertEquals("/device-auth/same-original-recovery/challenge-status",NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH);
        // Historical input stays historical. Encoding never renews a read,
        // authenticates archived HMAC, creates an intent or grants effects.
        for(String key:new String[]{"native_request_id","approved","retry_safe","work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(body.has(key));
    }
    @Test public void STATUS_originalChallengeShapePurposeAndPinsRefuse()throws Exception {
        String original=new String(challenge(),StandardCharsets.UTF_8);
        rejectStatus(raw("{\"schema\":\""+NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA+"\","+original.substring(1)));
        rejectStatus(raw("{\"\\u0073chema\":\""+NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA+"\","+original.substring(1)));
        for(JSONObject bad:new JSONObject[]{challengeJson().put("schema","foreign.v1"),challengeJson().put("purpose","OBSERVE_ORIGINAL_REGISTRATION_ONLY"),
            challengeJson().put("extra",false),challengeJson().put("native_challenge_intent_id",1),challengeJson().put("native_challenge_intent_id","bad-id"),
            challengeJson().put("native_challenge_intent_record_sha256","A".repeat(64)),challengeJson().put("original_target_sha256",OTHER_SHA),
            challengeJson().put("original_target",JSONObject.NULL),challengeJson().put("original_target_sha256",1)})rejectStatus(raw(bad));
        var missing=challengeJson();missing.remove("native_challenge_intent_record_sha256");rejectStatus(raw(missing));
        for(String key:PINS){var changed=targetJson();changed.put(key,key.equals("engine_revision")?"1":
            key.equals("operation_id")||key.equals("original_generation_id")?OTHER:OTHER_SHA);
            var foreign=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(changed));
            rejectStatus(raw(challengeJson().put("original_target",foreign.json()).put("original_target_sha256",foreign.documentSha256())));
        }
        var badTarget=targetJson().put("assignment_epoch",7);rejectStatus(raw(challengeJson().put("original_target",badTarget)));
    }
    @Test public void STATUS_nestedCurrentQueryValidationRefuses()throws Exception {
        for(String bad:new String[]{"","!","AB==","e30= ","-_=="})rejectStatus(raw(challengeJson().put("current_original_query_envelope_base64",bad)));
        for(JSONObject bad:new JSONObject[]{outer(raw(query())).put("schema","foreign.v1"),outer(raw(query())).put("original_query_timestamp",1),
            outer(raw(query())).put("extra",true),outer(raw(query())).put("original_query_unknown_record_sha256","A".repeat(64)),
            outer(raw(query().put("schema","custodial.original-native-private-custody-write.v1"))),
            outer(raw(query().put("read_query_id","bad-id"))),outer(raw(query().put("engine_revision",0)))})
            rejectStatus(raw(challengeJson().put("current_original_query_envelope_base64",NativeRetainedAttempt.encodeBase64(raw(bad)))));
        byte[] oversized=Arrays.copyOf(current(),526337);Arrays.fill(oversized,current().length,oversized.length,(byte)' ');
        rejectStatus(raw(challengeJson().put("current_original_query_envelope_base64",NativeRetainedAttempt.encodeBase64(oversized))));
        byte[] malformed=current();malformed[10]=(byte)0xff;
        rejectStatus(raw(challengeJson().put("current_original_query_envelope_base64",NativeRetainedAttempt.encodeBase64(malformed))));
        String query=query().toString();byte[] duplicate=raw(outer(raw("{\"operation_id\":\""+ID+"\","+query.substring(1))));
        rejectStatus(raw(challengeJson().put("current_original_query_envelope_base64",NativeRetainedAttempt.encodeBase64(duplicate))));
    }
    @Test public void STATUS_calendarAndAttestationCanonicalOnly()throws Exception {
        byte[] original=challenge(),before=original.clone();
        for(String time:new String[]{null,"","0000-01-01T00:00:00.000Z","1900-02-29T12:34:56.007Z","2026-02-29T12:34:56.007Z",
            "2026-10-14T12:34:56.007000Z","2026-10-14T12:34:56.007+00:00",TIME+"\n"," "+TIME})
            refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encodeStatus(original,time,SHA));
        for(String hmac:new String[]{null,"","A".repeat(64),"a".repeat(63),"a".repeat(65),"g".repeat(64),SHA+"\n"})
            refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encodeStatus(original,TIME,hmac));
        var historical=ProviderWireJson.object(status(original),1050624);assertEquals(TIME,historical.get("original_challenge_timestamp"));
        assertArrayEquals(before,original);
    }
    @Test public void STATUS_fatalUtf8DuplicateBomTrailingRefuse()throws Exception {
        byte[] bad=challenge();bad[10]=(byte)0xff;rejectStatus(bad);
        rejectStatus(raw("\ufeff"+new String(challenge(),StandardCharsets.UTF_8)));rejectStatus(raw(new String(challenge(),StandardCharsets.UTF_8)+" {}"));
        var body=challengeJson();String nested=body.getJSONObject("original_target").toString();
        String badTarget="{\"operation_id\":\""+ID+"\","+nested.substring(1);
        rejectStatus(raw(body.toString().replace(nested,badTarget)));
        rejectStatus(raw(outer(raw(query())))); // Wrong purpose/shape is not adopted as a challenge.
    }
    @Test public void STATUS_detachedAndCallerPrecisionPreserved()throws Exception {
        var query=query().put("engine_revision","9007199254740991");var target=targetJson().put("engine_revision","9007199254740991");
        byte[] current=NativePrivateCustodyCurrentQueryEnvelope.encode(raw(query),TIME,SHA,OTHER_SHA);
        byte[] original=NativeSameOriginalRecoveryChallengeEnvelope.encode(current,NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target)),OTHER,SHA),before=original.clone();
        byte[] first=status(original),second=status(original);assertNotSame(first,second);Arrays.fill(first,(byte)0);
        var body=ProviderWireJson.object(second,1050624);byte[] preserved=java.util.Base64.getDecoder().decode(body.getString("original_challenge_body_base64"));
        assertArrayEquals(before,preserved);assertArrayEquals(before,original);
        assertEquals("9007199254740991",ProviderWireJson.object(preserved,786432).getJSONObject("original_target").get("engine_revision"));
        Arrays.fill(second,(byte)0);assertArrayEquals(before,original);
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encodeStatus(original,TIME,"bad"));assertArrayEquals(before,original);
    }
    @Test public void STATUS_maximumAndMissingInputsRefuse()throws Exception {
        byte[] encoded=challenge(),maximum=Arrays.copyOf(encoded,786432);Arrays.fill(maximum,encoded.length,maximum.length,(byte)' ');
        byte[] body=status(maximum);assertTrue(body.length<=1050624);assertEquals(1050624,NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS);
        assertArrayEquals(maximum,java.util.Base64.getDecoder().decode(ProviderWireJson.object(body,1050624).getString("original_challenge_body_base64")));
        rejectStatus(null);rejectStatus(new byte[0]);rejectStatus(new byte[]{'{'});
        byte[] oversized=Arrays.copyOf(maximum,786433);oversized[oversized.length-1]=' ';rejectStatus(oversized);
        assertArrayEquals(encoded,Arrays.copyOf(maximum,encoded.length));
    }
    @Test public void SAVED_BODY_newPurposeBoundWithoutLegacyWidening()throws Exception {
        for(int length:new int[]{1,393217,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT}){
            byte[] original=new byte[length];for(int i=0;i<length;i++)original[i]=(byte)(i%251);
            String encoded=java.util.Base64.getEncoder().encodeToString(original);
            byte[] decoded=NativeSameOriginalRecoveryChallengeEnvelope.decodeOriginalRequestBytes(encoded);
            assertArrayEquals(original,decoded);decoded[0]^=1;assertNotEquals(original[0],decoded[0]);
            Arrays.fill(original,(byte)0);Arrays.fill(decoded,(byte)0);
        }
        for(String invalid:new String[]{null,"","AA","AB==","A===","_w==","AA==\n"," AA=="}){
            try{NativeSameOriginalRecoveryChallengeEnvelope.decodeOriginalRequestBytes(invalid);fail("ambiguous saved body accepted");}
            catch(VaultFailure failure){assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.FAILURE,failure.code);}
        }
        byte[] oversized=new byte[NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT+1];
        try{NativeSameOriginalRecoveryChallengeEnvelope.decodeOriginalRequestBytes(java.util.Base64.getEncoder().encodeToString(oversized));fail("oversized body accepted");}
        catch(VaultFailure failure){assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.FAILURE,failure.code);}
        finally{Arrays.fill(oversized,(byte)0);}
        // The observed legacy refusal is STILL mandatory. Only the new fixed
        // preparation decoder supports786432; old WORK/QUERY never widen.
        try{NativeRetainedAttempt.base64("AA==",NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);fail("legacy cap widened");}
        catch(VaultFailure failure){assertEquals(NativeRetainedAttempt.FAILURE,failure.code);}
    }
    @Test public void CHALLENGE_exactClosedBodyPreservesNestedOriginalBytes()throws Exception {
        byte[] original=raw(" \n"+query().toString().replace("operation_id","\\u006fperation_id")+"\t ");
        byte[] current=raw(" \n"+outer(original)+"\t "),before=current.clone();
        var target=target();byte[] result=NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,OTHER,SHA);
        var body=ProviderWireJson.object(result,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);
        assertEquals(Set.of("schema","purpose","native_challenge_intent_id","native_challenge_intent_record_sha256",
            "current_original_query_envelope_base64","original_target","original_target_sha256"),body.keySet());
        assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA,body.get("schema"));
        assertEquals(NativeSameOriginalRecoveryPreparationWire.PURPOSE,body.get("purpose"));
        assertEquals(OTHER,body.get("native_challenge_intent_id"));assertEquals(SHA,body.get("native_challenge_intent_record_sha256"));
        assertArrayEquals(current,java.util.Base64.getDecoder().decode(body.getString("current_original_query_envelope_base64")));
        assertArrayEquals(original,NativeRetainedAttempt.base64(outer(original).getString("original_query_body_base64"),393216));
        assertTrue(ProviderWireJson.same(target.json(),body.getJSONObject("original_target")));
        assertEquals(target.documentSha256(),body.get("original_target_sha256"));assertArrayEquals(before,current);
        assertEquals("/device-auth/same-original-recovery/challenge",NativeSameOriginalRecoveryChallengeEnvelope.PATH);
        for(String key:new String[]{"approved","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(body.has(key));
    }
    @Test public void CHALLENGE_eachMixedTargetPinRefuses()throws Exception {
        byte[] current=current(),before=current.clone();
        for(String key:PINS){JSONObject changed=targetJson();changed.put(key,key.equals("engine_revision")?"1":
            key.equals("operation_id")||key.equals("original_generation_id")?OTHER:OTHER_SHA);
            var foreign=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(changed));
            refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,foreign,OTHER,SHA));
        }
        assertArrayEquals(before,current);
    }
    @Test public void CHALLENGE_outerDuplicateForeignTypesAndFieldsRefuse()throws Exception {
        String text=new String(current(),StandardCharsets.UTF_8);
        rejectCurrent(raw("{\"schema\":\""+NativePrivateCustodyCurrentQueryEnvelope.SCHEMA+"\","+text.substring(1)));
        rejectCurrent(raw("{\""+"\\"+"u0073chema\":\""+NativePrivateCustodyCurrentQueryEnvelope.SCHEMA+"\","+text.substring(1)));
        for(JSONObject bad:new JSONObject[]{outer(raw(query())).put("schema","foreign.v1"),outer(raw(query())).put("extra",false),
            outer(raw(query())).put("original_query_timestamp",1),outer(raw(query())).put("original_query_http_attestation",JSONObject.NULL)})rejectCurrent(raw(bad));
        JSONObject missing=outer(raw(query()));missing.remove("original_query_unknown_record_sha256");rejectCurrent(raw(missing));
    }
    @Test public void CHALLENGE_originalQueryDuplicateMissingTypeAndWriteRefuse()throws Exception {
        String text=query().toString();
        rejectCurrent(raw(outer(raw("{\"operation_id\":\""+ID+"\","+text.substring(1)))));
        rejectCurrent(raw(outer(raw("{\""+"\\"+"u006fperation_id\":\""+ID+"\","+text.substring(1)))));
        JSONObject missing=query();missing.remove("owner_proof_base64");rejectCurrent(raw(outer(raw(missing))));
        rejectCurrent(raw(outer(raw(query().put("schema","custodial.original-native-private-custody-write.v1")))));
        rejectCurrent(raw(outer(raw(query().put("engine_revision",0)))));
        rejectCurrent(raw(outer(raw(query().put("unexpected",SHA)))));
        rejectCurrent(raw(outer(raw(query().put("read_query_id","")))));
        rejectCurrent(raw(outer(raw(query().put("read_query_id","not-a-canonical-UUID")))));
        rejectCurrent(raw(outer(raw(query().put("purpose_attestation","A".repeat(64))))));
    }
    @Test public void CHALLENGE_archiveCalendarAndHashesNotRenewed()throws Exception {
        var result=ProviderWireJson.object(encode(current()),786432);
        var nested=ProviderWireJson.object(java.util.Base64.getDecoder().decode(result.getString("current_original_query_envelope_base64")),526336);
        assertEquals(TIME,nested.get("original_query_timestamp")); // Historical2000 remains historical, not fresh authority.
        for(String time:new String[]{"2026-02-29T12:34:56.007Z","2026-10-14T12:34:56.007000Z","2026-10-14T12:34:56.007+00:00"})
            rejectCurrent(raw(outer(raw(query())).put("original_query_timestamp",time)));
        rejectCurrent(raw(outer(raw(query())).put("original_query_http_attestation","A".repeat(64))));
        rejectCurrent(raw(outer(raw(query())).put("original_query_unknown_record_sha256","a".repeat(63))));
    }
    @Test public void CHALLENGE_intentIdentityIsInputOnly()throws Exception {
        byte[] current=current();var target=target();
        for(String id:new String[]{"95000000-0000-0000-8000-000000000042","95000000-0000-4000-7000-000000000042",OTHER+"\n","not-an-original-intent"})
            refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,id,SHA));
        for(String hash:new String[]{"A".repeat(64),"a".repeat(63),SHA+"\n"})refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,OTHER,hash));
        var body=ProviderWireJson.object(NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,ID,OTHER_SHA),786432);
        assertEquals(ID,body.get("native_challenge_intent_id"));assertEquals(OTHER_SHA,body.get("native_challenge_intent_record_sha256"));
        // Formatted original inputs are carried, NOT proved durable/authenticated by encoding.
    }
    @Test public void CHALLENGE_fatalUtf8BomTrailingAndBase64Refuse()throws Exception {
        byte[] bad=current();bad[10]=(byte)0xff;rejectCurrent(bad);
        rejectCurrent(raw("\ufeff"+new String(current(),StandardCharsets.UTF_8)));
        rejectCurrent(raw(new String(current(),StandardCharsets.UTF_8)+" {}"));
        for(String b64:new String[]{"","!","Zh==","e30= ","-_=="})rejectCurrent(raw(outer(raw(query())).put("original_query_body_base64",b64)));
        byte[] queryBad=raw(query());queryBad[10]=(byte)0xff;rejectCurrent(raw(outer(queryBad)));
    }
    @Test public void CHALLENGE_exactMaximumSizesAndOversizeRefusal()throws Exception {
        byte[] query=raw(query());byte[] original=Arrays.copyOf(query,393216);Arrays.fill(original,query.length,original.length,(byte)' ');
        byte[] envelope=NativePrivateCustodyCurrentQueryEnvelope.encode(original,TIME,SHA,OTHER_SHA);
        byte[] maximum=Arrays.copyOf(envelope,526336);Arrays.fill(maximum,envelope.length,maximum.length,(byte)' ');
        byte[] encoded=encode(maximum);assertTrue(encoded.length<=786432);
        var body=ProviderWireJson.object(encoded,786432);
        assertArrayEquals(maximum,java.util.Base64.getDecoder().decode(body.getString("current_original_query_envelope_base64")));
        rejectCurrent(Arrays.copyOf(maximum,526337));
        byte[] tooBig=Arrays.copyOf(original,393217);tooBig[tooBig.length-1]=' ';rejectCurrent(raw(outer(tooBig)));
    }
    @Test public void CHALLENGE_detachedOutputAndFailurePreserveCallerData()throws Exception {
        byte[] input=current(),before=input.clone();byte[] first=encode(input),second=encode(input);assertNotSame(first,second);
        Arrays.fill(first,(byte)0);assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA,ProviderWireJson.object(second,786432).get("schema"));
        assertArrayEquals(before,input);byte[] bad=raw(outer(raw(query())).put("extra",true));rejectCurrent(bad);
    }
    @Test public void CHALLENGE_missingInputsRefuseWithoutDefaultIdentity()throws Exception {
        var target=target();byte[] current=current();
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(null,target,OTHER,SHA));
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(new byte[0],target,OTHER,SHA));
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,null,OTHER,SHA));
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,null,SHA));
        refuses(()->NativeSameOriginalRecoveryChallengeEnvelope.encode(current,target,OTHER,null));
    }
}
