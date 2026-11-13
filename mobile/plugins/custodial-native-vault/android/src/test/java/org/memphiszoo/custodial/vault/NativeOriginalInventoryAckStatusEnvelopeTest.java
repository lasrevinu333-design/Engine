package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** Synthetic archived DATA and signature-shaped placeholders ONLY. These
 * tests mint no native issuer, credential, current clock or server authority. */
public final class NativeOriginalInventoryAckStatusEnvelopeTest {
    private static final String PURPOSE="REQUEST_EXACT_ORIGINAL_INVENTORY_ACK";
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed",
        "finalizer_allowed","key_removal","phone_released"};
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--inventory-status-envelope-only".equals(args[0])||!Set.of(
            "STATUS_exactArchivedBytesAndOwnedOutput","STATUS_oldTimestampAndGregorian",
            "STATUS_closedSavedTypesAndFlags","STATUS_rawBodyIntentAndTranscript",
            "STATUS_targetNonceAndHeldBindings","STATUS_strictParserAndBounds","APPROVAL_fixedReadPreservesArchivedOriginal").contains(args[1]))
            throw new IllegalArgumentException("Select one NEW status envelope DATA member");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalInventoryAckStatusEnvelopeTest.class,args[1]));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New status DATA case failed");
        System.out.println("PASS_STATUS_ENVELOPE_DATA_ONLY "+args[1]);
        System.out.println("SYNTHETIC_SIGNATURE_PLACEHOLDERS; NO_AUTH_HTTP_SQL_ACK_OR_PLATFORM_PROOF");
    }
    @Test public void APPROVAL_fixedReadPreservesArchivedOriginal()throws Exception {
        Fixture f=new Fixture();
        byte[] raw=bytes("\r\n"+f.body.toString()+"\t\n");f.wireBody(raw);
        byte[] original=f.document(),before=original.clone();
        byte[] encoded=NativeOriginalInventoryAckStatusEnvelope.encodeApprovalStatus(original);
        try{
            JSONObject envelope=ProviderWireJson.object(encoded,NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT);
            assertArrayEquals(before,original);
            assertEquals(5,envelope.length());
            assertEquals("custodial.original-native-inventory-separation-approval-status.v1",envelope.get("schema"));
            assertEquals("READ_CURRENT_EXACT_ORIGINAL_INVENTORY_SEPARATION_APPROVAL",envelope.get("purpose"));
            assertEquals("/device-auth/original-inventory-separation-approval-status",NativeOriginalInventoryAckStatusEnvelope.APPROVAL_PATH);
            assertArrayEquals(raw,bytes(envelope.getString("original_request_utf8")));
            assertEquals(f.saved.get("native_request_timestamp"),envelope.get("original_request_timestamp"));
            assertEquals(f.saved.get("request_attestation"),envelope.get("original_request_attestation"));
            for(String flag:EFFECTS)assertFalse(envelope.has(flag));
            Fixture changed=new Fixture();changed.saved.put("request_body_sha256",hex('f'));
            try{NativeOriginalInventoryAckStatusEnvelope.encodeApprovalStatus(changed.document());fail("changed original");}
            catch(VaultFailure failure){assertEquals(NativeOriginalInventoryAckStatusEnvelope.FAILURE,failure.code);}
        }finally{Arrays.fill(encoded,(byte)0);Arrays.fill(original,(byte)0);}
    }
    @Test public void STATUS_exactArchivedBytesAndOwnedOutput()throws Exception {
        Fixture f=new Fixture();
        String intent="\n"+f.intent.toString().replace("\"schema\"","\"\\u0073chema\"")+"\t";
        f.syncIntent(intent);
        byte[] raw=bytes("\r\n"+f.body.toString().replace("\"schema\"","\"\\u0073chema\"")+"\t\n");f.wireBody(raw);
        byte[] original=f.document(),before=original.clone();
        byte[] first=NativeOriginalInventoryAckStatusEnvelope.encode(original),second=NativeOriginalInventoryAckStatusEnvelope.encode(original);
        assertArrayEquals(before,original);assertArrayEquals(first,second);assertNotSame(first,second);
        JSONObject envelope=ProviderWireJson.object(first,NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT);
        assertArrayEquals(raw,bytes(envelope.getString("original_request_utf8")));
        assertEquals(intent,ProviderWireJson.object(bytes(envelope.getString("original_request_utf8")),65536).get("original_intent_utf8"));
        assertEquals(f.saved.get("native_request_timestamp"),envelope.get("original_request_timestamp"));
        assertEquals(f.saved.get("request_attestation"),envelope.get("original_request_attestation"));
        assertEquals(5,envelope.length());
        assertEquals("custodial.original-native-inventory-registration-status.v1",envelope.get("schema"));
        assertEquals("READ_EXACT_ORIGINAL_INVENTORY_REQUEST",envelope.get("purpose"));
        assertEquals("/device-auth/original-inventory-ack-status",NativeOriginalInventoryAckStatusEnvelope.PATH);
        assertFalse(envelope.has("native_request_id"));assertFalse(envelope.has("transaction_authority"));
        for(String flag:EFFECTS)assertFalse(envelope.has(flag));
        Arrays.fill(original,(byte)0);Arrays.fill(first,(byte)0);
        assertArrayEquals(raw,bytes(ProviderWireJson.object(second,196608).getString("original_request_utf8")));
        // Placeholder HMAC-shaped text passes representation checks only.
        assertEquals(hex('c'),envelope.get("original_request_attestation"));
    }
    @Test public void STATUS_oldTimestampAndGregorian()throws Exception {
        for(String time:new String[]{"0001-01-01T00:00:00.000Z","2000-02-29T12:00:00.123Z",
            "2020-01-01T00:00:00.000Z","9999-12-31T23:59:59.999Z"})accepted(new Fixture(time));
        for(String time:new String[]{"0000-01-01T00:00:00.000Z","2100-02-29T00:00:00.000Z",
            "2026-04-31T00:00:00.000Z","2026-10-16T24:00:00.000Z","2026-10-16T12:00:60.000Z",
            "2026-10-16T12:00:00.123000Z","2026-10-16T12:00:00.123+00:00"}){
            Fixture f=new Fixture();f.saved.put("native_request_timestamp",time);denied(f);
            f=new Fixture();f.intent.put("created_at",time);f.syncIntent();denied(f);
        }
        Fixture later=new Fixture();later.saved.put("native_request_timestamp","2026-10-16T12:00:00.124Z");accepted(later);
        Fixture reversed=new Fixture();reversed.saved.put("native_request_timestamp","2026-10-16T12:00:00.122Z");denied(reversed);
    }
    @Test public void STATUS_closedSavedTypesAndFlags()throws Exception {
        Fixture initial=new Fixture();for(var keys=initial.saved.keys();keys.hasNext();){Fixture f=new Fixture();f.saved.remove(keys.next());denied(f);}
        for(String key:new String[]{"schema","purpose","intent_disk_sha256","intent_document_sha256","native_request_id",
            "native_request_timestamp","request_body_base64","request_body_sha256","request_attestation"})
            for(Object nonString:new Object[]{1.0,1L,Boolean.FALSE,JSONObject.NULL,new JSONObject()}){
                Fixture f=new Fixture();f.saved.put(key,nonString);denied(f);
            }
        for(String flag:EFFECTS)for(Object wrong:new Object[]{true,"false",0L,0.0,JSONObject.NULL}){
            Fixture f=new Fixture();f.saved.put(flag,wrong);denied(f);
        }
        Fixture extra=new Fixture();extra.saved.put("retry_safe",false);denied(extra);
        Fixture schema=new Fixture();schema.saved.put("schema","custodial.native-inventory-ack.v1");denied(schema);
        Fixture purpose=new Fixture();purpose.saved.put("purpose","READ_EXACT_ORIGINAL_INVENTORY_REQUEST");denied(purpose);
        for(String key:new String[]{"request_attestation","request_body_sha256","intent_disk_sha256","intent_document_sha256"}){
            Fixture f=new Fixture();f.saved.put(key,hex('A'));denied(f);
        }
    }
    @Test public void STATUS_rawBodyIntentAndTranscript()throws Exception {
        Fixture hash=new Fixture();hash.saved.put("request_body_sha256",hex('f'));denied(hash);
        Fixture raw=new Fixture();raw.saved.put("request_body_base64",Base64.getEncoder().encodeToString(bytes(raw.body+" ")));denied(raw);
        Fixture intent=new Fixture();intent.body.put("original_intent_utf8",intent.intent+" ");intent.wireBody(bytes(intent.body.toString()));denied(intent);
        Fixture disk=new Fixture();disk.body.put("original_intent_disk_sha256",hex('f'));disk.rebind();denied(disk);
        Fixture doc=new Fixture();doc.body.put("original_intent_document_sha256",hex('f'));doc.rebind();denied(doc);
        Fixture binding=new Fixture();binding.body.put("purpose_binding_sha256",hex('f'));binding.rebind();denied(binding);
        Fixture order=new Fixture();order.body.put("purpose_binding_sha256",hash(String.join("\n",
            "custodial.native-original-inventory-ack-purpose.v1",order.body.getString("original_intent_document_sha256"),
            order.body.getString("original_intent_disk_sha256"),order.body.getString("original_preparation_native_request_id"),
            order.body.getString("original_preparation_request_body_sha256"),order.body.getString("original_preparation_http_attestation"))));order.rebind();denied(order);
        Fixture fields=new Fixture();for(var keys=fields.body.keys();keys.hasNext();){Fixture f=new Fixture();f.body.remove(keys.next());f.rebind();denied(f);}
        for(String key:new String[]{"original_preparation_native_request_id","purpose_attestation","original_preparation_http_attestation","original_intent_utf8"}){
            Fixture f=new Fixture();f.body.put(key,1.0);f.rebind();denied(f);
        }
        Fixture extra=new Fixture();extra.body.put("unknown",false);extra.rebind();denied(extra);
    }
    @Test public void STATUS_targetNonceAndHeldBindings()throws Exception {
        Fixture initial=new Fixture();for(var keys=initial.intent.keys();keys.hasNext();){Fixture f=new Fixture();f.intent.remove(keys.next());f.syncIntent();denied(f);}
        Fixture nonce=new Fixture();nonce.intent.put("intent_id",uuid('f'));nonce.syncIntent();denied(nonce);
        Fixture invalidId=new Fixture();invalidId.saved.put("native_request_id","aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa");denied(invalidId);
        for(String stamp:new String[]{"DURABLE_ATTEMPT:0","DURABLE_HELD:0","DURABLE_HELD:01","DURABLE_HELD:9223372036854775808"}){
            Fixture f=new Fixture();f.intent.put("native_held_stamp",stamp);f.syncIntent();denied(f);
        }
        for(String flag:EFFECTS){Fixture f=new Fixture();f.intent.put(flag,true);f.syncIntent();denied(f);}
        for(String key:new String[]{"browser_frame_sha256","browser_part_set_sha256"}){
            Fixture f=new Fixture();f.intent.put(key,hex('A'));f.syncIntent();denied(f);
        }
        for(String key:new String[]{"assignment_epoch","engine_revision"}){
            Fixture f=new Fixture();f.target.put(key,1.0);f.syncIntent();denied(f);
        }
        Fixture extra=new Fixture();extra.target.put("authority",false);extra.syncIntent();denied(extra);
        Fixture device=new Fixture();device.target.put("canonical_device_id","KIOSK_01");device.syncIntent();denied(device);
        Fixture missing=new Fixture();missing.target.remove("original_generation_id");missing.syncIntent();denied(missing);
    }
    @Test public void STATUS_strictParserAndBounds()throws Exception {
        denied((byte[])null);denied(new byte[0]);denied(new byte[131073]);
        Fixture f=new Fixture();accepted(pad(f.document(),131072));
        f.wireBody(pad(bytes(f.body.toString()),65536));accepted(f);
        f.wireBody(pad(bytes(f.body.toString()),65537));denied(f);
        f=new Fixture();f.syncIntent(new String(pad(bytes(f.intent.toString()),16384),StandardCharsets.UTF_8));accepted(f);
        f.syncIntent(new String(pad(bytes(f.intent.toString()),16385),StandardCharsets.UTF_8));denied(f);
        Fixture tabs=new Fixture();byte[] body=pad(bytes(tabs.body.toString()),65536);Arrays.fill(body,bytes(tabs.body.toString()).length,body.length,(byte)'\t');
        tabs.wireBody(body);byte[] encoded=NativeOriginalInventoryAckStatusEnvelope.encode(tabs.document());
        assertTrue(encoded.length<=NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT);assertArrayEquals(body,bytes(ProviderWireJson.object(encoded,196608).getString("original_request_utf8")));
        f=new Fixture();denied(bytes("{\"schema\":\""+f.saved.getString("schema")+"\","+f.saved.toString().substring(1)));
        f.syncIntent("{\"schema\":\""+f.intent.getString("schema")+"\","+f.intent.toString().substring(1));denied(f);
        f=new Fixture();f.wireBody(bytes("{\"schema\":\""+f.body.getString("schema")+"\","+f.body.toString().substring(1)));denied(f);
        f=new Fixture();f.syncIntent("{\"schema\":\"\\ud800\","+f.intent.toString().substring(1));denied(f);
        f=new Fixture();f.wireBody(new byte[]{'{','"','x','"',':','"',(byte)0xc3,(byte)0x28,'"','}'});denied(f);
        for(String text:new String[]{"[]","{}","{'schema':true}","{schema:true}","<html></html>",new Fixture().saved+" false"})denied(bytes(text));
        f=new Fixture();f.saved.put("request_body_base64",f.saved.getString("request_body_base64")+" ");denied(f);
        denied(new byte[]{'{','"','x','"',':','"',(byte)0xc3,(byte)0x28,'"','}'});
    }

    private static final class Fixture {
        final JSONObject target=new JSONObject(),intent=new JSONObject(),body=new JSONObject(),saved=new JSONObject();
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
                .put("native_request_id",uuid('a')).put("native_request_timestamp",timestamp).put("request_attestation",hex('c'));flags(saved);syncIntent();
        }
        void syncIntent()throws Exception{syncIntent(intent.toString());}
        void syncIntent(String raw)throws Exception {
            body.put("original_intent_utf8",raw).put("original_intent_document_sha256",hash(raw));
            body.put("purpose_binding_sha256",hash(String.join("\n","custodial.native-original-inventory-ack-purpose.v1",body.getString("original_intent_disk_sha256"),
                body.getString("original_intent_document_sha256"),body.getString("original_preparation_native_request_id"),body.getString("original_preparation_request_body_sha256"),body.getString("original_preparation_http_attestation"))));
            saved.put("intent_disk_sha256",body.getString("original_intent_disk_sha256")).put("intent_document_sha256",body.getString("original_intent_document_sha256"));rebind();
        }
        void rebind()throws Exception{wireBody(bytes(body.toString()));}
        void wireBody(byte[] raw)throws Exception{saved.put("request_body_base64",Base64.getEncoder().encodeToString(raw)).put("request_body_sha256",hash(raw));}
        byte[] document(){return bytes(saved.toString());}
    }
    private static JSONObject flags(JSONObject value)throws Exception{for(String key:EFFECTS)value.put(key,false);return value;}
    private static String uuid(char d){return (""+d).repeat(8)+"-"+(""+d).repeat(4)+"-4"+(""+d).repeat(3)+"-8"+(""+d).repeat(3)+"-"+(""+d).repeat(12);}
    private static String hex(char c){return (""+c).repeat(64);}
    private static byte[] bytes(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static String hash(String text)throws Exception{return hash(bytes(text));}
    private static String hash(byte[] bytes)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static byte[] pad(byte[] original,int size){if(size<original.length)throw new AssertionError("padding bound");byte[] result=Arrays.copyOf(original,size);Arrays.fill(result,original.length,size,(byte)' ');return result;}
    private static void accepted(Fixture f)throws Exception{accepted(f.document());}
    private static void accepted(byte[] original)throws Exception {
        byte[] before=original.clone(),encoded=NativeOriginalInventoryAckStatusEnvelope.encode(original);
        assertArrayEquals(before,original);assertTrue(encoded.length>0&&encoded.length<=196608);
        JSONObject envelope=ProviderWireJson.object(encoded,196608),saved=ProviderWireJson.object(original,131072);
        assertEquals(5,envelope.length());assertArrayEquals(Base64.getDecoder().decode(saved.getString("request_body_base64")),bytes(envelope.getString("original_request_utf8")));
        assertEquals(saved.get("native_request_timestamp"),envelope.get("original_request_timestamp"));assertEquals(saved.get("request_attestation"),envelope.get("original_request_attestation"));
    }
    private static void denied(Fixture f)throws Exception{denied(f.document());}
    private static void denied(byte[] original)throws Exception {
        byte[] before=original==null?null:original.clone();boolean rejected=false;
        try{NativeOriginalInventoryAckStatusEnvelope.encode(original);fail("Malformed archived DATA accepted");}
        catch(VaultFailure failure){assertEquals(NativeOriginalInventoryAckStatusEnvelope.FAILURE,failure.code);rejected=true;}
        assertTrue(rejected);assertArrayEquals(before,original);
    }
}
