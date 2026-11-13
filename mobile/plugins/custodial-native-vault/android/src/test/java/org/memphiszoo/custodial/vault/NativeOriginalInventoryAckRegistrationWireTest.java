package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** NEW codec DATA fixtures only. Hex placeholders are NOT genuine signatures,
 * credentials, a native control, current clock, server receipt or transaction.
 */
public final class NativeOriginalInventoryAckRegistrationWireTest {
    private static final String VERSION="custodial.native-original-inventory-request-registration-digest.v1";
    private static final String SCHEMA="custodial.native-original-inventory-request-registration.v1";
    private static final String PURPOSE="REQUEST_EXACT_ORIGINAL_INVENTORY_ACK";
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--registration-wire-only".equals(args[0])||!Set.of(
            "WIRE_exactOwnedDetachedData","WIRE_microsecondWindowAndGregorian","WIRE_sameOriginalBindings",
            "WIRE_closedReceiptShapeAndEffects","WIRE_originalChainAndTargetRefusals",
            "WIRE_strictParserAndBounds","WIRE_transcriptOrderAndSyntheticNoAuth").contains(args[1]))
            throw new IllegalArgumentException("Select one new registration DATA member");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalInventoryAckRegistrationWireTest.class,args[1]));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New registration codec case failed");
        System.out.println("PASS_REGISTRATION_DATA_ONLY "+args[1]);
        System.out.println("SYNTHETIC_SIGNATURE_PLACEHOLDERS; NO_NATIVE_AUTH_HTTP_SQL_ACK_OR_PLATFORM_PROOF");
    }
    @Test public void WIRE_exactOwnedDetachedData()throws Exception {
        Fixture f=new Fixture();byte[] original=f.document(),response=f.response(),a=original.clone(),b=response.clone();
        try(var decoded=NativeOriginalInventoryAckRegistrationWire.decode(original,200,response)){
            assertArrayEquals(a,original);assertArrayEquals(b,response);
            Arrays.fill(original,(byte)0);Arrays.fill(response,(byte)0);
            JSONObject first=decoded.json();assertEquals(11,first.length());assertEquals(f.receipt.getString("receipt_sha256"),first.get("receipt_sha256"));
            first.put("state","COMPLETE");first.getJSONObject("limits").put("key_removal",true);
            JSONObject second=decoded.json();assertEquals("REGISTERED_REQUEST_ONLY_NOT_ACK",second.get("state"));
            for(String flag:EFFECTS)assertEquals(Boolean.FALSE,second.getJSONObject("limits").get(flag));
            decoded.close();boolean closed=false;try{decoded.json();}catch(VaultFailure failure){closed=true;assertEquals(NativeOriginalInventoryAckRegistrationWire.FAILURE,failure.code);}assertTrue(closed);
        }
    }
    @Test public void WIRE_microsecondWindowAndGregorian()throws Exception {
        Fixture f=new Fixture();f.registered("2026-10-16T11:59:30.123000Z");accepted(f);
        f.registered("2026-10-16T12:02:00.123000Z");accepted(f);
        f.registered("2026-10-16T11:59:30.122999Z");denied(f);
        f.registered("2026-10-16T12:02:00.123001Z");denied(f);
        for(String bad:new String[]{"2026-10-16T12:00:00.123Z","2026-10-16T12:00:00.1230000Z","2026-10-16T12:00:00.123000+00:00",
            "2026-10-16T12:00:60.123000Z","2026-10-16T24:00:00.123000Z","2026-13-16T12:00:00.123000Z","0000-10-16T12:00:00.123000Z"}){f.registered(bad);denied(f);}
        accepted(new Fixture("2000-02-29T12:00:00.123Z"));accepted(new Fixture("0001-01-01T00:01:00.000Z"));
        accepted(new Fixture("9999-12-31T23:59:00.000Z"));
        Fixture century=new Fixture("2100-02-28T23:59:59.999Z");century.registered("2100-02-29T00:00:00.000000Z");denied(century);
        Fixture days=new Fixture("2026-04-30T23:59:59.999Z");days.registered("2026-04-31T00:00:00.000000Z");denied(days);
        denied(new Fixture("0000-01-01T00:01:00.000Z"));
    }
    @Test public void WIRE_sameOriginalBindings()throws Exception {
        for(String field:new String[]{"native_request_id","operation_id","original_generation_id","request_body_sha256","intent_document_sha256","intent_disk_sha256"}){
            Fixture f=new Fixture();f.receipt.put(field,field.endsWith("id")?uuid('f'):hex('f'));f.seal();denied(f);
        }
        Fixture same=new Fixture();same.saved.put("native_request_id",uuid('f'));same.receipt.put("native_request_id",uuid('f'));same.seal();denied(same);
        Fixture alteredBody=new Fixture();byte[] original=alteredBody.body.toString().getBytes(StandardCharsets.UTF_8);
        alteredBody.saved.put("request_body_base64",java.util.Base64.getEncoder().encodeToString(pad(original,original.length+1)));denied(alteredBody);
        // Reordered/whitespace wire BODY may only pass with its exact own hash.
        Fixture exactBody=new Fixture();exactBody.wireBody(pad(bytes(exactBody.body.toString()),bytes(exactBody.body.toString()).length+1));accepted(exactBody);
    }
    @Test public void WIRE_closedReceiptShapeAndEffects()throws Exception {
        for(int status:new int[]{0,201,204,302,400,403,500}){Fixture f=new Fixture();denied(f.document(),status,f.response());}
        Fixture base=new Fixture();for(var it=base.receipt.keys();it.hasNext();){Fixture f=new Fixture();f.receipt.remove(it.next());denied(f);}
        for(String flag:EFFECTS){Fixture f=new Fixture();f.receipt.getJSONObject("limits").put(flag,true);f.seal();denied(f);}
        for(Object falseLookalike:new Object[]{"false",0L,0.0,JSONObject.NULL}){Fixture f=new Fixture();f.receipt.getJSONObject("limits").put("phone_released",falseLookalike);denied(f);}
        Fixture missing=new Fixture();missing.receipt.getJSONObject("limits").remove("key_removal");denied(missing);
        Fixture extraLimit=new Fixture();extraLimit.receipt.getJSONObject("limits").put("retry_safe",false);denied(extraLimit);
        Fixture extra=new Fixture();extra.receipt.put("retry_safe",false);denied(extra);
        Fixture state=new Fixture();state.receipt.put("state","COMPLETE");state.seal();denied(state);
        Fixture schema=new Fixture();schema.receipt.put("schema","custodial.inventory-ack.v1");schema.seal();denied(schema);
        Fixture number=new Fixture();number.receipt.put("native_request_id",1.0);denied(number);
        Fixture hashCase=new Fixture();hashCase.receipt.put("intent_disk_sha256",hex('A'));hashCase.seal();denied(hashCase);
        Fixture wrapper=new Fixture();denied(wrapper.document(),200,bytes(new JSONObject().put("ok",true).put("data",wrapper.receipt).put("state","COMPLETE").toString()));
        denied(wrapper.document(),200,bytes(new JSONObject().put("ok","true").put("data",wrapper.receipt).toString()));
        denied(wrapper.document(),200,bytes(new JSONObject().put("ok",1.0).put("data",wrapper.receipt).toString()));
    }
    @Test public void WIRE_originalChainAndTargetRefusals()throws Exception {
        Fixture extra=new Fixture();extra.saved.put("extra",false);denied(extra);
        Fixture number=new Fixture();number.saved.put("request_attestation",1.0);denied(number);
        Fixture flags=new Fixture();flags.saved.put("inventory_acknowledged",true);denied(flags);
        Fixture timestamp=new Fixture();timestamp.saved.put("native_request_timestamp","2026-10-16T12:00:00.123000Z");denied(timestamp);
        Fixture bodyExtra=new Fixture();bodyExtra.body.put("extra",false);bodyExtra.wireBody(bytes(bodyExtra.body.toString()));denied(bodyExtra);
        Fixture purpose=new Fixture();purpose.body.put("purpose_binding_sha256",hex('0'));purpose.wireBody(bytes(purpose.body.toString()));denied(purpose);
        Fixture intentHash=new Fixture();intentHash.body.put("original_intent_utf8",intentHash.intent.toString()+" ");intentHash.wireBody(bytes(intentHash.body.toString()));denied(intentHash);
        for(String field:new String[]{"assignment_epoch","engine_revision"}){Fixture f=new Fixture();f.target.put(field,1.0);f.syncIntent();denied(f);}
        Fixture overflow=new Fixture();overflow.target.put("assignment_epoch","9007199254740992");overflow.syncIntent();denied(overflow);
        Fixture device=new Fixture();device.target.put("canonical_device_id","KIOSK_01");device.syncIntent();denied(device);
        Fixture targetExtra=new Fixture();targetExtra.target.put("unknown",hex('e'));targetExtra.syncIntent();denied(targetExtra);
        Fixture wrongUuid=new Fixture();wrongUuid.target.put("original_generation_id","aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa");wrongUuid.syncIntent();denied(wrongUuid);
        Fixture intentExtra=new Fixture();intentExtra.intent.put("unknown",false);intentExtra.syncIntent();denied(intentExtra);
        Fixture intentFlag=new Fixture();intentFlag.intent.put("replay_allowed",true);intentFlag.syncIntent();denied(intentFlag);
        Fixture held=new Fixture();held.intent.put("native_held_stamp","DURABLE_ATTEMPT:0");held.syncIntent();denied(held);
        Fixture maxHeld=new Fixture();maxHeld.intent.put("native_held_stamp","DURABLE_HELD:9223372036854775808");maxHeld.syncIntent();denied(maxHeld);
        Fixture future=new Fixture();future.intent.put("created_at","2026-10-16T12:00:00.124Z");future.syncIntent();denied(future);
        Fixture nonce=new Fixture();nonce.intent.put("intent_id",uuid('f'));nonce.syncIntent();denied(nonce);
    }
    @Test public void WIRE_strictParserAndBounds()throws Exception {
        Fixture f=new Fixture();denied(null,200,f.response());denied(f.document(),200,null);
        denied(new byte[0],200,f.response());denied(f.document(),200,new byte[0]);
        denied(new byte[131073],200,f.response());denied(f.document(),200,new byte[131073]);
        try(var d=NativeOriginalInventoryAckRegistrationWire.decode(pad(f.document(),131072),200,pad(f.response(),131072))){assertEquals(SCHEMA,d.json().get("schema"));}
        Fixture bodyLimit=new Fixture();bodyLimit.wireBody(pad(bytes(bodyLimit.body.toString()),65536));accepted(bodyLimit);
        bodyLimit.wireBody(pad(bytes(bodyLimit.body.toString()),65537));denied(bodyLimit);
        Fixture intentLimit=new Fixture();intentLimit.syncIntent(new String(pad(bytes(intentLimit.intent.toString()),16384),StandardCharsets.UTF_8));accepted(intentLimit);
        intentLimit.syncIntent(new String(pad(bytes(intentLimit.intent.toString()),16385),StandardCharsets.UTF_8));denied(intentLimit);
        denied(f.document(),200,bytes("{\"ok\":true,\"ok\":true,\"data\":"+f.receipt+"}"));
        denied(f.document(),200,bytes("{\"ok\":true,\"data\":{\"schema\":\""+SCHEMA+"\","+f.receipt.toString().substring(1)+"}"));
        denied(f.document(),200,bytes("{\"ok\":true,\"data\":"+f.receipt+",\"junk\":\"\\ud800\"}"));
        denied(f.document(),200,new byte[]{'{','"','x','"',':','"',(byte)0xc3,(byte)0x28,'"','}'});
        for(String raw:new String[]{"[]","{ok:true}","{'ok':true}","<html>200</html>",new String(f.response(),StandardCharsets.UTF_8)+" false"})denied(f.document(),200,bytes(raw));
        Fixture duplicateRequest=new Fixture();denied(bytes("{\"schema\":\""+duplicateRequest.saved.getString("schema")+"\","+duplicateRequest.saved.toString().substring(1)),200,duplicateRequest.response());
        Fixture duplicateIntent=new Fixture();duplicateIntent.syncIntent("{\"schema\":\""+duplicateIntent.intent.getString("schema")+"\","+duplicateIntent.intent.toString().substring(1));denied(duplicateIntent);
        Fixture base64=new Fixture();base64.saved.put("request_body_base64",base64.saved.getString("request_body_base64")+" ");denied(base64);
    }
    @Test public void WIRE_transcriptOrderAndSyntheticNoAuth()throws Exception {
        Fixture f=new Fixture();accepted(f); // literal placeholder HMACs are DATA only
        String transcript=f.transcript();assertEquals(hash(transcript),f.receipt.get("receipt_sha256"));
        f.receipt.put("receipt_sha256",hash(transcript+"\n"));denied(f);
        f.receipt.put("receipt_sha256",hash(transcript.replace(VERSION,VERSION+"-foreign")));denied(f);
        String swap=String.join("\n",VERSION,f.receipt.getString("native_request_id"),f.receipt.getString("operation_id"),f.receipt.getString("original_generation_id"),
            f.receipt.getString("request_body_sha256"),f.receipt.getString("intent_disk_sha256"),f.receipt.getString("intent_document_sha256"),f.receipt.getString("registered_at"));
        f.receipt.put("receipt_sha256",hash(swap));denied(f);
        f.seal();try(var data=NativeOriginalInventoryAckRegistrationWire.decode(f.document(),200,f.response())){
            assertEquals("REGISTERED_REQUEST_ONLY_NOT_ACK",data.json().get("state"));assertFalse(data.json().has("authenticated"));assertFalse(data.json().has("transaction_authority"));
        }
    }

    private static final class Fixture {
        final JSONObject target=new JSONObject(),intent=new JSONObject(),body=new JSONObject(),saved=new JSONObject(),receipt=new JSONObject();
        Fixture()throws Exception{this("2026-10-16T12:00:00.123Z");}
        Fixture(String timestamp)throws Exception {
            String[] targets={"operation_id","separation_id","separation_authority_revision","canonical_device_pk","canonical_device_id","employee_id","credential_id","assignment_epoch",
                "original_generation_id","original_credential_secret_key_id","principal_digest","engine_revision","original_wire_sha256","original_frozen_work_sha256","capsule_sha256",
                "record_sha256","frame_sha256","plan_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"};
            for(String key:targets)target.put(key,hex('e'));
            for(String key:new String[]{"operation_id","separation_id","canonical_device_pk","employee_id","credential_id","original_generation_id"})target.put(key,uuid((char)('a'+Arrays.asList(targets).indexOf(key)%5)));
            target.put("canonical_device_id","KIOSK_02").put("separation_authority_revision","1").put("assignment_epoch","1").put("engine_revision","0");
            intent.put("schema","custodial.native-original-inventory-ack-intent.v1").put("purpose","PREPARE_EXACT_ORIGINAL_INVENTORY_ACK")
                .put("intent_id",uuid('a')).put("original_target",target).put("native_held_stamp","DURABLE_HELD:1")
                .put("browser_frame_sha256",hex('a')).put("browser_part_set_sha256",hex('b')).put("created_at",timestamp);flags(intent);
            body.put("schema","custodial.original-native-inventory-ack-request.v1").put("purpose",PURPOSE)
                .put("original_intent_disk_sha256",hex('1')).put("original_preparation_native_request_id",uuid('b'))
                .put("original_preparation_request_body_sha256",hex('a')).put("original_preparation_http_attestation",hex('b')).put("purpose_attestation",hex('d'));
            saved.put("schema","custodial.native-original-inventory-ack-request-record.v1").put("purpose",PURPOSE)
                .put("native_request_id",uuid('a')).put("native_request_timestamp",timestamp).put("request_attestation",hex('c'));flags(saved);
            receipt.put("schema",SCHEMA).put("state","REGISTERED_REQUEST_ONLY_NOT_ACK").put("limits",flags(new JSONObject()))
                .put("registered_at",timestamp.substring(0,timestamp.length()-1)+"000Z");syncIntent();
        }
        void syncIntent()throws Exception{syncIntent(intent.toString());}
        void syncIntent(String original)throws Exception {
            body.put("original_intent_utf8",original).put("original_intent_document_sha256",hash(original));
            body.put("purpose_binding_sha256",hash(String.join("\n","custodial.native-original-inventory-ack-purpose.v1",body.getString("original_intent_disk_sha256"),
                body.getString("original_intent_document_sha256"),body.getString("original_preparation_native_request_id"),body.getString("original_preparation_request_body_sha256"),body.getString("original_preparation_http_attestation"))));
            saved.put("intent_disk_sha256",body.getString("original_intent_disk_sha256")).put("intent_document_sha256",body.getString("original_intent_document_sha256"));
            wireBody(bytes(body.toString()));
        }
        void wireBody(byte[] raw)throws Exception {
            saved.put("request_body_base64",java.util.Base64.getEncoder().encodeToString(raw)).put("request_body_sha256",hash(raw));
            receipt.put("native_request_id",saved.get("native_request_id")).put("operation_id",target.get("operation_id"))
                .put("original_generation_id",target.get("original_generation_id")).put("request_body_sha256",saved.get("request_body_sha256"))
                .put("intent_document_sha256",saved.get("intent_document_sha256")).put("intent_disk_sha256",saved.get("intent_disk_sha256"));seal();
        }
        void registered(String text)throws Exception{receipt.put("registered_at",text);seal();}
        String transcript()throws Exception{return String.join("\n",VERSION,receipt.getString("native_request_id"),receipt.getString("operation_id"),receipt.getString("original_generation_id"),
            receipt.getString("request_body_sha256"),receipt.getString("intent_document_sha256"),receipt.getString("intent_disk_sha256"),receipt.getString("registered_at"));}
        void seal()throws Exception{receipt.put("receipt_sha256",hash(transcript()));}
        byte[] document(){return bytes(saved.toString());}
        byte[] response()throws Exception{return bytes(new JSONObject().put("ok",true).put("data",receipt).toString());}
    }
    private static JSONObject flags(JSONObject value)throws Exception{for(String key:EFFECTS)value.put(key,false);return value;}
    private static String uuid(char digit){return (""+digit).repeat(8)+"-"+(""+digit).repeat(4)+"-4"+(""+digit).repeat(3)+"-8"+(""+digit).repeat(3)+"-"+(""+digit).repeat(12);}
    private static String hex(char c){return (""+c).repeat(64);}
    private static byte[] bytes(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static String hash(String text)throws Exception{return hash(bytes(text));}
    private static String hash(byte[] bytes)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static byte[] pad(byte[] original,int size){if(size<original.length)throw new AssertionError("padding bound");byte[] result=Arrays.copyOf(original,size);Arrays.fill(result,original.length,size,(byte)' ');return result;}
    private static void accepted(Fixture f)throws Exception{try(var result=NativeOriginalInventoryAckRegistrationWire.decode(f.document(),200,f.response())){assertEquals(SCHEMA,result.json().get("schema"));}}
    private static void denied(Fixture f)throws Exception{denied(f.document(),200,f.response());}
    private static void denied(byte[] original,int status,byte[] response)throws Exception {
        byte[] a=original==null?null:original.clone(),b=response==null?null:response.clone();boolean denied=false;
        try(var ignored=NativeOriginalInventoryAckRegistrationWire.decode(original,status,response)){fail("Untrusted malformed/binding-changed DATA was accepted");}
        catch(VaultFailure failure){assertEquals(NativeOriginalInventoryAckRegistrationWire.FAILURE,failure.code);denied=true;}
        assertTrue(denied);assertArrayEquals(a,original);assertArrayEquals(b,response);
    }
}
