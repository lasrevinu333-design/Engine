package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.TreeSet;
import org.json.JSONObject;
import org.junit.Test;

/** NEW synthetic wire vectors only. Digests here are document math, never
 * authenticated manager/native evidence, currentness or effect authority. */
public final class NativeSameOriginalRecoveryManagerPreparationWireTest {
    private static final String ID="95000000-0000-4000-8000-000000000021";
    private static final String RECORD="a".repeat(64),BODY="b".repeat(64),ATTESTATION="c".repeat(64);
    private static final String ORIGINAL="2026-10-14T00:00:00.123Z";
    private static final String[] MEMBERS={"MANAGER_PREPARATION_exactOriginalStringsDetached",
        "MANAGER_PREPARATION_expectedTargetAndNativePinsRefuse","MANAGER_PREPARATION_crossReceiptChallengeAndPreviewRefuse",
        "MANAGER_PREPARATION_issuerRequestAndDocumentDigestsRefuse","MANAGER_PREPARATION_closedShapesPurposeAndFalseTypes",
        "MANAGER_PREPARATION_duplicateOuterSqlAndOriginalReceipts","MANAGER_PREPARATION_fatalUtf8AndCivilTimes",
        "MANAGER_PREPARATION_originalReceiptByteCapsBeforeDecode","MANAGER_PREPARATION_sqlAndHttpExactByteCaps",
        "MANAGER_PREPARATION_observationAndAllCarriedExpiryCeilings","MANAGER_PREPARATION_stringDecimalsRemainExact",
        "MANAGER_PREPARATION_noPermissionOrPublicConstructor"};
    public static void main(String[] args)throws Exception {
        if(args.length!=1||!"--manager-preparation-wire-only".equals(args[0]))throw new IllegalArgumentException("new_manager_preparation_wire_selector_required");
        for(String name:MEMBERS){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryManagerPreparationWireTest.class,name));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
            }
            System.out.println("PASS_UNTRUSTED_MANAGER_PREPARATION_ONLY "+name);
        }
    }
    private static byte[] raw(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static byte[] raw(JSONObject value){return raw(value.toString());}
    private static JSONObject limits()throws Exception {
        var value=new JSONObject();for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})value.put(key,false);return value;
    }
    private static JSONObject target()throws Exception {
        var value=new JSONObject();for(String key:new String[]{"operation_id","separation_id","canonical_device_pk","employee_id","credential_id","original_generation_id"})
            value.put(key,"95000000-0000-4000-8000-000000000001");
        value.put("separation_authority_revision","7").put("canonical_device_id","KIOSK_08").put("assignment_epoch","7").put("engine_revision","0");
        for(String key:new String[]{"original_credential_secret_key_id","principal_digest","original_wire_sha256","original_frozen_work_sha256",
            "capsule_sha256","record_sha256","frame_sha256","plan_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})value.put(key,"a".repeat(64));
        return value;
    }
    // Test-only independent canonical document math; no production signing.
    private static String canonical(JSONObject value)throws Exception {
        var names=new TreeSet<String>(value.keySet());var out=new StringBuilder("{");boolean first=true;
        for(String name:names){if(!first)out.append(',');first=false;Object item=value.get(name);
            out.append(JSONObject.quote(name)).append(':').append(item instanceof JSONObject?canonical((JSONObject)item):JSONObject.valueToString(item));}
        return out.append('}').toString();
    }
    private static String hash(String value)throws Exception {
        byte[] input=raw(value),digest=MessageDigest.getInstance("SHA-256").digest(input);
        try{var out=new StringBuilder(64);for(byte b:digest){out.append(Character.forDigit((b>>>4)&15,16));out.append(Character.forDigit(b&15,16));}return out.toString();}
        finally{Arrays.fill(input,(byte)0);Arrays.fill(digest,(byte)0);}
    }
    private static String document(String kind,JSONObject value)throws Exception {
        var copy=new JSONObject(value.toString());if(kind.equals("receipt"))copy.remove("receipt_sha256");if(kind.equals("preview"))copy.remove("preview_sha256");
        return hash("custodial.same-original-recovery-"+kind+".v1\n"+canonical(copy));
    }
    private static void rehashApproval(JSONObject value)throws Exception {
        value.put("original_request_sha256",document("request",value.getJSONObject("original_request")));
        value.put("receipt_sha256",document("receipt",value));
    }
    private static final class Vector {
        final NativeSameOriginalRecoveryPreparationWire.UntrustedTarget expected;
        final String targetSha;final JSONObject registration,approval,representation;
        Vector()throws Exception{this(target());}
        Vector(JSONObject target)throws Exception {
            expected=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target));targetSha=expected.documentSha256();
            registration=new JSONObject().put("schema","custodial.same-original-recovery-native-challenge-receipt.v1")
                .put("state","ORIGINAL_CHALLENGE_RECORDED_PREPARATION_ONLY").put("challenge_id",ID)
                .put("original_target_sha256",targetSha).put("native_challenge_intent_id",ID)
                .put("native_challenge_intent_record_sha256",RECORD).put("registered_at","2026-10-14T00:00:10.123000Z")
                .put("expires_at","2026-10-14T00:04:00.123000Z").put("retry_safe",false).put("limits",limits());
            String binding="custodial.same-original-native-challenge-binding.v1\n"+ID+'\n'+BODY+'\n'+ATTESTATION+'\n'+RECORD+'\n'
                +targetSha+'\n'+registration.getString("registered_at")+'\n'+registration.getString("expires_at");
            registration.put("challenge_sha256",hash(binding));
            var preview=new JSONObject().put("schema","custodial.same-original-recovery-review.v1").put("state","ORIGINAL_BINDING_REVIEW_ONLY")
                .put("purpose","AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION").put("challenge_id",ID)
                .put("challenge_sha256",registration.get("challenge_sha256")).put("original_target",target)
                .put("expires_at",registration.get("expires_at")).put("limits",limits());
            String previewSha=document("preview",preview);String manager="95000000-0000-4000-8000-000000000031",credential="95000000-0000-4000-8000-000000000032";
            var request=new JSONObject().put("schema","custodial.same-original-recovery-approval-request.v1")
                .put("request_id","95000000-0000-4000-8000-000000000033").put("challenge_id",ID)
                .put("expected_challenge_sha256",registration.get("challenge_sha256")).put("expected_preview_sha256",previewSha)
                .put("expected_manager_id",manager).put("expected_manager_credential_id",credential).put("expected_manager_device_id","manager-fixture")
                .put("decision","AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION").put("manager_confirmation","CONFIRM_THIS_SAME_ORIGINAL_ONLY");
            approval=new JSONObject().put("schema","custodial.same-original-recovery-approval-receipt.v1").put("state","APPROVAL_RECORDED_ONLY")
                .put("approval_id","95000000-0000-4000-8000-000000000034").put("original_request",request)
                .put("issuer",new JSONObject().put("manager_id",manager).put("manager_credential_id",credential).put("manager_device_id","manager-fixture"))
                .put("challenge_sha256",registration.get("challenge_sha256")).put("preview_sha256",previewSha).put("original_target",target)
                .put("purpose_admission_id","same-original-preparation.v1").put("issued_at","2026-10-14T00:00:20.123001Z")
                .put("expires_at","2026-10-14T00:03:00.123000Z").put("retry_safe",false).put("limits",limits());rehashApproval(approval);
            representation=new JSONObject().put("schema",NativeSameOriginalRecoveryManagerPreparationWire.SCHEMA)
                .put("state",NativeSameOriginalRecoveryManagerPreparationWire.STATE).put("purpose_admission_id","same-original-preparation.v1")
                .put("original_registration_utf8",registration.toString()).put("original_approval_receipt_utf8",approval.toString())
                .put("observed_at","2026-10-14T00:00:30.123456Z").put("current_until","2026-10-14T00:02:30.000000Z")
                .put("transaction_authority",false).put("limits",limits());
        }
        void updateApproval()throws Exception{rehashApproval(approval);representation.put("original_approval_receipt_utf8",approval.toString());}
        byte[] bytes()throws Exception{return raw(new JSONObject().put("ok",true).put("data",representation));}
        NativeSameOriginalRecoveryManagerPreparationWire.UntrustedObservation decode(byte[] bytes)throws Exception {
            return NativeSameOriginalRecoveryManagerPreparationWire.decodeResponse(bytes,ID,RECORD,targetSha,BODY,ATTESTATION,ORIGINAL,expected);
        }
    }
    private interface Checked {void run()throws Exception;}
    private static void refuses(Checked action)throws Exception {
        try{action.run();fail("invalid untrusted representation accepted");}
        catch(VaultFailure failure){assertEquals(NativeSameOriginalRecoveryManagerPreparationWire.FAILURE,failure.code);}
    }
    @Test public void MANAGER_PREPARATION_exactOriginalStringsDetached()throws Exception {
        var v=new Vector();String registration=" \n"+v.registration.toString()+"\t ",approval="{ \n"+v.approval.toString().substring(1);
        v.representation.put("original_registration_utf8",registration).put("original_approval_receipt_utf8",approval);
        byte[] bytes=v.bytes(),before=bytes.clone();var result=v.decode(bytes);assertArrayEquals(before,bytes);Arrays.fill(bytes,(byte)0);
        var json=result.json();assertEquals(registration,json.get("original_registration_utf8"));assertEquals(approval,json.get("original_approval_receipt_utf8"));
        json.put("transaction_authority",true);json.getJSONObject("limits").put("key_removal",true);
        assertFalse(result.json().getBoolean("transaction_authority"));assertFalse(result.json().getJSONObject("limits").getBoolean("key_removal"));
    }
    @Test public void MANAGER_PREPARATION_expectedTargetAndNativePinsRefuse()throws Exception {
        var v=new Vector();var foreign=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target().put("engine_revision","1")));
        refuses(()->NativeSameOriginalRecoveryManagerPreparationWire.decodeResponse(v.bytes(),ID,RECORD,foreign.documentSha256(),BODY,ATTESTATION,ORIGINAL,foreign));
        for(String field:new String[]{"intent","record","body","attestation","timestamp"}){
            String intent=field.equals("intent")?"95000000-0000-4000-8000-000000000022":ID,record=field.equals("record")?"e".repeat(64):RECORD;
            String body=field.equals("body")?"e".repeat(64):BODY,attestation=field.equals("attestation")?"e".repeat(64):ATTESTATION;
            String timestamp=field.equals("timestamp")?"2026-10-14T00:02:00.123Z":ORIGINAL;
            refuses(()->NativeSameOriginalRecoveryManagerPreparationWire.decodeResponse(v.bytes(),intent,record,v.targetSha,body,attestation,timestamp,v.expected));
        }
        refuses(()->NativeSameOriginalRecoveryManagerPreparationWire.decodeResponse(v.bytes(),ID,RECORD,v.targetSha,BODY,ATTESTATION,ORIGINAL,null));
    }
    @Test public void MANAGER_PREPARATION_crossReceiptChallengeAndPreviewRefuse()throws Exception {
        for(String field:new String[]{"challenge_id","challenge_sha256","preview_sha256","original_target"}){
            var v=new Vector();var request=v.approval.getJSONObject("original_request");
            if(field.equals("challenge_id"))request.put(field,"95000000-0000-4000-8000-000000000099");
            else if(field.equals("original_target"))v.approval.getJSONObject(field).put("engine_revision","1");
            else{v.approval.put(field,"e".repeat(64));request.put("expected_"+field,"e".repeat(64));}
            v.updateApproval();refuses(()->v.decode(v.bytes()));
        }
    }
    @Test public void MANAGER_PREPARATION_issuerRequestAndDocumentDigestsRefuse()throws Exception {
        for(String field:new String[]{"manager_id","manager_credential_id","manager_device_id"}){
            var v=new Vector();v.approval.getJSONObject("issuer").put(field,field.equals("manager_device_id")?"other-manager-device":"95000000-0000-4000-8000-000000000099");
            v.updateApproval();refuses(()->v.decode(v.bytes()));
        }
        for(String field:new String[]{"receipt_sha256","original_request_sha256"}){
            var v=new Vector();v.approval.put(field,"e".repeat(64));v.representation.put("original_approval_receipt_utf8",v.approval.toString());refuses(()->v.decode(v.bytes()));
        }
    }
    @Test public void MANAGER_PREPARATION_closedShapesPurposeAndFalseTypes()throws Exception {
        for(String field:new String[]{"schema","state","purpose_admission_id"}){var v=new Vector();v.representation.put(field,"foreign");refuses(()->v.decode(v.bytes()));}
        for(Object flag:new Object[]{true,"false",0,JSONObject.NULL}){
            var v=new Vector();v.representation.put("transaction_authority",flag);refuses(()->v.decode(v.bytes()));
            var w=new Vector();w.representation.getJSONObject("limits").put("key_removal",flag);refuses(()->w.decode(w.bytes()));
        }
        var v=new Vector();v.representation.put("extra",false);refuses(()->v.decode(v.bytes()));
        var w=new Vector();w.representation.remove("observed_at");refuses(()->w.decode(w.bytes()));
        refuses(()->v.decode(raw("{\"ok\":\"true\",\"data\":"+new Vector().representation+"}")));
    }
    @Test public void MANAGER_PREPARATION_duplicateOuterSqlAndOriginalReceipts()throws Exception {
        var v=new Vector();refuses(()->v.decode(raw("{\"ok\":true,\"ok\":true,\"data\":"+v.representation+"}")));
        refuses(()->v.decode(raw("{\"ok\":true,\"data\":{\"schema\":\"x\","+v.representation.toString().substring(1)+"}")));
        for(String field:new String[]{"original_registration_utf8","original_approval_receipt_utf8"}){
            var w=new Vector();String receipt=w.representation.getString(field),key=field.equals("original_registration_utf8")?"challenge_id":"approval_id";
            w.representation.put(field,"{\""+key+"\":\""+ID+"\","+receipt.substring(1));refuses(()->w.decode(w.bytes()));
        }
    }
    @Test public void MANAGER_PREPARATION_fatalUtf8AndCivilTimes()throws Exception {
        var v=new Vector();byte[] bad=v.bytes();bad[5]=(byte)0xff;refuses(()->v.decode(bad));
        refuses(()->v.decode(raw("\ufeff"+new String(v.bytes(),StandardCharsets.UTF_8))));
        for(String time:new String[]{"0000-01-01T00:00:00.000000Z","2026-02-29T00:00:00.000000Z","2026-10-14T00:00:30.123Z","2026-10-14T00:00:60.000000Z"}){
            var w=new Vector();w.representation.put("observed_at",time);refuses(()->w.decode(w.bytes()));
        }
        var w=new Vector();w.representation.put("original_approval_receipt_utf8",w.approval.toString().replace("manager-fixture","\\ud800"));refuses(()->w.decode(w.bytes()));
    }
    @Test public void MANAGER_PREPARATION_originalReceiptByteCapsBeforeDecode()throws Exception {
        for(String field:new String[]{"original_registration_utf8","original_approval_receipt_utf8"}){
            var v=new Vector();String original=v.representation.getString(field);int bytes=raw(original).length;
            v.representation.put(field," ".repeat(24576-bytes)+original);assertNotNull(v.decode(v.bytes()));
            v.representation.put(field," ".repeat(24577-bytes)+original);refuses(()->v.decode(v.bytes()));
        }
    }
    @Test public void MANAGER_PREPARATION_sqlAndHttpExactByteCaps()throws Exception {
        var v=new Vector();String sql=v.representation.toString();int size=raw(sql).length;
        String exact=sql.substring(0,sql.length()-1)+" ".repeat(65536-size)+"}";
        assertNotNull(v.decode(raw("{\"ok\":true,\"data\":"+exact+"}")));
        refuses(()->v.decode(raw("{\"ok\":true,\"data\":"+exact.substring(0,exact.length()-1)+" }"+"}")));
        byte[] normal=v.bytes();String text=new String(normal,StandardCharsets.UTF_8);
        assertNotNull(v.decode(raw(text+" ".repeat(131072-normal.length))));
        refuses(()->v.decode(raw(text+" ".repeat(131073-normal.length))));
    }
    @Test public void MANAGER_PREPARATION_observationAndAllCarriedExpiryCeilings()throws Exception {
        for(String until:new String[]{"2026-10-14T00:00:30.123456Z","2026-10-14T00:00:30.123455Z","2026-10-14T00:03:00.123001Z","2026-10-14T00:04:00.123001Z"}){
            var v=new Vector();v.representation.put("current_until",until);refuses(()->v.decode(v.bytes()));
        }
        var v=new Vector();v.representation.put("current_until",v.approval.get("expires_at"));assertNotNull(v.decode(v.bytes()));
        var w=new Vector();w.representation.put("observed_at","2026-10-14T00:00:20.123000Z");refuses(()->w.decode(w.bytes()));
        var x=new Vector();x.approval.put("expires_at","2026-10-14T00:04:00.123001Z");x.updateApproval();refuses(()->x.decode(x.bytes()));
    }
    @Test public void MANAGER_PREPARATION_stringDecimalsRemainExact()throws Exception {
        var v=new Vector(target().put("engine_revision","9007199254740991").put("assignment_epoch","9007199254740991"));
        String rawApproval=v.representation.getString("original_approval_receipt_utf8");assertNotNull(v.decode(v.bytes()));
        assertEquals(rawApproval,v.decode(v.bytes()).json().get("original_approval_receipt_utf8"));
    }
    @Test public void MANAGER_PREPARATION_noPermissionOrPublicConstructor()throws Exception {
        var result=new Vector();assertFalse(result.decode(result.bytes()).json().getBoolean("transaction_authority"));
        for(var constructor:NativeSameOriginalRecoveryManagerPreparationWire.UntrustedObservation.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        for(var method:NativeSameOriginalRecoveryManagerPreparationWire.UntrustedObservation.class.getDeclaredMethods())assertEquals("json",method.getName());
        refuses(()->result.decode(null));refuses(()->result.decode(new byte[0]));
    }
}
