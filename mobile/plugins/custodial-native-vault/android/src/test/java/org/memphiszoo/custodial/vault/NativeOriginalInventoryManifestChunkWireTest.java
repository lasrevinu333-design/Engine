package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Prepared synthetic codec DATA only. Placeholder attestation is NOT a
 * native issuer, HMAC, current credential, SQL receipt or complete manifest.
 * No private Control, signer, transport, disk or real clock is constructed. */
public final class NativeOriginalInventoryManifestChunkWireTest {
    private static final String SCHEMA="custodial.native-original-inventory-manifest-chunk-registration.v1";
    private static final String PURPOSE_VERSION="custodial.native-original-inventory-manifest-chunk-purpose.v1";
    private static final String RECEIPT_VERSION="custodial.native-original-inventory-manifest-chunk-receipt.v1";
    private static final String ID="22222222-2222-4222-8222-222222222222",PARENT="11111111-1111-4111-8111-111111111111";
    private static final String ISSUED="2026-10-16T12:00:00.123Z";
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
    // Independently prepared SHA256 vectors of these exact literal UTF8 bytes
    // (including leading newline/space and final newline/tab); not test execution.
    private static final String GOLDEN_BODY="\n {\"schema\":\"custodial.original-native-inventory-manifest-chunk.v1\",\"purpose\":\"RETAIN_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK\",\"inventory_native_request_id\":\"11111111-1111-4111-8111-111111111111\",\"registration_request_body_sha256\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"intent_document_sha256\":\"2222222222222222222222222222222222222222222222222222222222222222\",\"intent_disk_sha256\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"original_target\":{\"operation_id\":\"33333333-3333-4333-8333-333333333333\",\"separation_id\":\"44444444-4444-4444-8444-444444444444\",\"separation_authority_revision\":\"1\",\"canonical_device_pk\":\"55555555-5555-4555-8555-555555555555\",\"canonical_device_id\":\"KIOSK_02\",\"employee_id\":\"66666666-6666-4666-8666-666666666666\",\"credential_id\":\"77777777-7777-4777-8777-777777777777\",\"assignment_epoch\":\"1\",\"original_generation_id\":\"88888888-8888-4888-8888-888888888888\",\"original_credential_secret_key_id\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"principal_digest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"engine_revision\":\"0\",\"original_wire_sha256\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"original_frozen_work_sha256\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"capsule_sha256\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\",\"record_sha256\":\"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"frame_sha256\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"plan_sha256\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"aad_binding_sha256\":\"2222222222222222222222222222222222222222222222222222222222222222\",\"source_capture_sha256\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"values_sha256\":\"4444444444444444444444444444444444444444444444444444444444444444\",\"semantic_join_sha256\":\"5555555555555555555555555555555555555555555555555555555555555555\",\"layout_sha256\":\"6666666666666666666666666666666666666666666666666666666666666666\"},\"manifest_sha256\":\"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb\",\"manifest_byte_count\":\"1\",\"manifest_chunk_count\":\"1\",\"manifest_chunk_index\":\"0\",\"chunk_base64\":\"YQ==\",\"chunk_sha256\":\"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb\",\"purpose_binding_sha256\":\"ff6cce42c2cecb6e55faec3167b552a3826116a5bbd65bd010b775dfc6522460\",\"purpose_attestation\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\"}\n\t";
    private static final String GOLDEN_BODY_SHA="aa7f677e41c088518655eab264935cffd4db0bd5fefa0de28ddba9b0a1a334dd";
    private static final String GOLDEN_BINDING="ff6cce42c2cecb6e55faec3167b552a3826116a5bbd65bd010b775dfc6522460";
    private static final String GOLDEN_RECEIPT="4a3063980cfebb51d35c03b8dc5b5a66ba2be6eeee6d69c1efbd18843cc64084";

    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--manifest-chunk-wire-only".equals(args[0])||!Set.of(
            "CHUNK_goldenRawWhitespaceAndReceipt","CHUNK_pieceAndDecimalBoundaries",
            "CHUNK_exactOriginalBindings","CHUNK_microsecondWindowAndGregorian",
            "CHUNK_closedShapesAndSixFalse","CHUNK_strictParserAndBounds",
            "CHUNK_transcriptOrderAndUntrustedLimits","CHUNK_ownedDetachedCloseWipes",
            "CHUNK_STATUS_sharedOriginalValidationAndReceipt").contains(args[1]))
            throw new IllegalArgumentException("Select one NEW manifest chunk DATA member");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalInventoryManifestChunkWireTest.class,args[1]));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New manifest chunk codec member failed");
        System.out.println("PASS_MANIFEST_CHUNK_DATA_ONLY "+args[1]);
        System.out.println("SYNTHETIC_DATA_NOT_NATIVE_HMAC_SQL_BROWSER_ACK_OR_CURRENT_AUTHORITY");
    }

    @Test public void CHUNK_goldenRawWhitespaceAndReceipt()throws Exception {
        Fixture f=new Fixture();
        assertEquals(15,f.body.length());assertEquals(11,f.receipt.length());
        assertEquals(GOLDEN_BODY_SHA,hash(f.raw));assertEquals(GOLDEN_BINDING,f.body.get("purpose_binding_sha256"));
        assertEquals(GOLDEN_RECEIPT,f.receipt.get("receipt_sha256"));accepted(f);
        // A raw whitespace change with the old receipt is not the same body.
        denied(bytes(f.body.toString()),f.id,f.timestamp,200,f.response());
        f.wireBody(bytes("\t"+f.body.toString()+"\n "));accepted(f);
        assertNotEquals(GOLDEN_BODY_SHA,f.receipt.get("request_body_sha256"));
        byte[] canonical=bytes(f.body.toString());
        denied(canonical,f.id,f.timestamp,200,f.response()); // old padded-body SHA
    }

    @Test public void CHUNK_pieceAndDecimalBoundaries()throws Exception {
        for(int[] pair:new int[][]{{1,0},{32768,0},{32769,0},{32769,1},{65536,1},{16777216,0},{16777216,511}})accepted(new Fixture(pair[0],pair[1]));
        // Full manifest hash remains declared DATA: this decoder sees one piece,
        // not a complete 16MiB inventory or an authenticated source.
        for(String key:new String[]{"manifest_byte_count","manifest_chunk_count","manifest_chunk_index"}){
            for(Object bad:new Object[]{"","01","-1","+1","1.0","1e0","1 "," 1","999999999","000",1L,1.0,JSONObject.NULL}){
                Fixture f=new Fixture();f.body.put(key,bad);f.sealRequest();denied(f);
            }
        }
        for(String[] change:new String[][]{{"manifest_byte_count","0"},{"manifest_byte_count","16777217"},
            {"manifest_chunk_count","0"},{"manifest_chunk_count","513"},{"manifest_chunk_index","1"},{"manifest_chunk_index","512"}}){
            Fixture f=new Fixture();f.body.put(change[0],change[1]);f.sealRequest();denied(f);
        }
        Fixture count=new Fixture(32769,1);count.body.put("manifest_chunk_count","1");count.sealRequest();denied(count);
        Fixture shortPart=new Fixture(32768,0);shortPart.piece(new byte[32767]);denied(shortPart);
        Fixture longTail=new Fixture(32769,1);longTail.piece(new byte[2]);denied(longTail);
        for(String bad:new String[]{"","YQ","YQ== "," YQ==","YR==","_w==","YQ===","===="}){
            Fixture f=new Fixture();f.body.put("chunk_base64",bad);f.sealRequest();denied(f);
        }
        Fixture overflow=new Fixture();byte[] over=new byte[32769];overflow.body.put("chunk_base64",java.util.Base64.getEncoder().encodeToString(over));
        overflow.body.put("chunk_sha256",hash(over));overflow.sealRequest();denied(overflow);
        Fixture badSha=new Fixture();badSha.body.put("chunk_sha256",hex('f'));badSha.sealRequest();denied(badSha);
    }

    @Test public void CHUNK_exactOriginalBindings()throws Exception {
        for(String key:new String[]{"inventory_native_request_id","manifest_sha256","manifest_chunk_index","chunk_sha256","native_request_id","request_body_sha256"}){
            Fixture f=new Fixture();f.receipt.put(key,key.endsWith("_id")?uuid('f'):key.equals("manifest_chunk_index")?"1":hex('f'));
            f.sealReceipt();denied(f); // Valid recomputed digest does not fix a foreign original.
        }
        Fixture sameId=new Fixture();denied(sameId.raw,PARENT,sameId.timestamp,200,sameId.response());
        for(String bad:new String[]{null,"",uuid('a').toUpperCase(),"aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa","not-a-native-id"}){
            Fixture f=new Fixture();denied(f.raw,bad,f.timestamp,200,f.response());
        }
        for(String key:new String[]{"registration_request_body_sha256","intent_document_sha256","intent_disk_sha256","manifest_sha256"}){
            Fixture f=new Fixture();f.body.put(key,hex('e'));f.wireBody(bytes(f.body.toString()));denied(f); // purpose still pins old text
        }
        Fixture newIndex=new Fixture(32769,1);newIndex.receipt.put("manifest_chunk_index","01");newIndex.sealReceipt();denied(newIndex);
        for(String field:new String[]{"operation_id","original_generation_id","canonical_device_pk","employee_id","credential_id","separation_id"}){
            Fixture f=new Fixture();f.body.getJSONObject("original_target").put(field,1L);f.sealRequest();denied(f);
        }
        for(Object value:new Object[]{1L,1.0,"9007199254740992","01","-1"}){
            Fixture f=new Fixture();f.body.getJSONObject("original_target").put("assignment_epoch",value);f.sealRequest();denied(f);
        }
        Fixture device=new Fixture();device.body.getJSONObject("original_target").put("canonical_device_id","KIOSK_01");device.sealRequest();denied(device);
        Fixture targetExtra=new Fixture();targetExtra.body.getJSONObject("original_target").put("grant",true);targetExtra.sealRequest();denied(targetExtra);
        Fixture targetMissing=new Fixture();targetMissing.body.getJSONObject("original_target").remove("layout_sha256");targetMissing.sealRequest();denied(targetMissing);
    }

    @Test public void CHUNK_microsecondWindowAndGregorian()throws Exception {
        Fixture f=new Fixture();f.registered("2026-10-16T11:59:30.123000Z");accepted(f);
        f.registered("2026-10-16T12:02:00.123000Z");accepted(f);
        f.registered("2026-10-16T11:59:30.122999Z");denied(f);
        f.registered("2026-10-16T12:02:00.123001Z");denied(f);
        for(String bad:new String[]{"2026-10-16T12:00:00.123Z","2026-10-16T12:00:00.1230000Z","2026-10-16T12:00:00.123000+00:00",
            "2026-10-16T12:00:60.123000Z","2026-10-16T24:00:00.123000Z","2026-04-31T12:00:00.123000Z","2100-02-29T12:00:00.123000Z",
            "0000-10-16T12:00:00.123000Z"}){
            Fixture changed=new Fixture();changed.registered(bad);denied(changed);
        }
        for(String valid:new String[]{"0001-01-01T00:01:00.000Z","2000-02-29T12:00:00.123Z","9999-12-31T23:59:00.000Z"}){
            Fixture changed=new Fixture();changed.timestamp=valid;changed.registered(valid.substring(0,valid.length()-1)+"000Z");accepted(changed);
        }
        for(String bad:new String[]{null,"","0000-01-01T00:00:00.000Z","2026-02-29T12:00:00.123Z","2026-10-16T12:00:00.123000Z",
            "2026-10-16T12:00:00Z","2026-10-16T12:00:00.123+00:00","2026-10-16T12:00:60.123Z","2026-10-16t12:00:00.123z"}){
            Fixture changed=new Fixture();denied(changed.raw,changed.id,bad,200,changed.response());
        }
    }

    @Test public void CHUNK_closedShapesAndSixFalse()throws Exception {
        Fixture good=new Fixture();
        for(int status:new int[]{0,201,204,301,302,400,401,403,409,500})denied(good.raw,good.id,good.timestamp,status,good.response());
        for(String key:names(good.body)){
            Fixture f=new Fixture();f.body.remove(key);denied(bytes(f.body.toString()),f.id,f.timestamp,200,f.response());
        }
        for(String key:names(good.receipt)){Fixture f=new Fixture();f.receipt.remove(key);denied(f);}
        for(String flag:EFFECTS){
            Fixture f=new Fixture();f.receipt.getJSONObject("limits").put(flag,true);f.sealReceipt();denied(f);
            f=new Fixture();f.receipt.getJSONObject("limits").remove(flag);denied(f);
        }
        for(Object v:new Object[]{"false",0L,0.0,JSONObject.NULL}){
            Fixture f=new Fixture();f.receipt.getJSONObject("limits").put("phone_released",v);denied(f);
        }
        for(String key:new String[]{"schema","purpose","purpose_attestation","manifest_sha256","inventory_native_request_id"}){
            Fixture f=new Fixture();f.body.put(key,1.0);denied(bytes(f.body.toString()),f.id,f.timestamp,200,f.response());
        }
        Fixture extra=new Fixture();extra.body.put("inventory_acknowledged",false);extra.sealRequest();denied(extra);
        Fixture receiptExtra=new Fixture();receiptExtra.receipt.put("retry_safe",false);denied(receiptExtra);
        Fixture limitsExtra=new Fixture();limitsExtra.receipt.getJSONObject("limits").put("current",false);denied(limitsExtra);
        Fixture wrongState=new Fixture();wrongState.receipt.put("state","INVENTORY_ACKNOWLEDGED");wrongState.sealReceipt();denied(wrongState);
        Fixture wrongSchema=new Fixture();wrongSchema.receipt.put("schema","custodial.inventory-ack.v1");wrongSchema.sealReceipt();denied(wrongSchema);
        for(Object ok:new Object[]{false,"true",1L,1.0,JSONObject.NULL}){
            denied(good.raw,good.id,good.timestamp,200,bytes(new JSONObject().put("ok",ok).put("data",good.receipt).toString()));
        }
        denied(good.raw,good.id,good.timestamp,200,bytes(new JSONObject().put("ok",true).put("data",good.receipt).put("state","COMPLETE").toString()));
        denied(good.raw,good.id,good.timestamp,200,bytes(new JSONObject().put("ok",true).put("data",new JSONArray()).toString()));
        Fixture numberIndex=new Fixture();numberIndex.receipt.put("manifest_chunk_index",0L);denied(numberIndex);
        Fixture upper=new Fixture();upper.receipt.put("chunk_sha256",hex('A'));denied(upper);
    }

    @Test public void CHUNK_strictParserAndBounds()throws Exception {
        Fixture f=new Fixture();
        denied(null,f.id,f.timestamp,200,f.response());denied(f.raw,f.id,f.timestamp,200,null);
        denied(new byte[0],f.id,f.timestamp,200,f.response());denied(f.raw,f.id,f.timestamp,200,new byte[0]);
        denied(new byte[65537],f.id,f.timestamp,200,f.response());denied(f.raw,f.id,f.timestamp,200,new byte[65537]);
        f.wireBody(pad(f.raw,65536));try(var d=decode(f,pad(f.response(),65536))){assertEquals(SCHEMA,d.json().get("schema"));}
        Fixture duplicate=new Fixture();String raw=new String(duplicate.raw,StandardCharsets.UTF_8).trim();
        denied(bytes("{\"schema\":\"custodial.original-native-inventory-manifest-chunk.v1\","+raw.substring(1)),duplicate.id,duplicate.timestamp,200,duplicate.response());
        // Escaped key alias is still a duplicate in the strict original parser.
        denied(bytes("{\"\\u0073chema\":\"custodial.original-native-inventory-manifest-chunk.v1\","+raw.substring(1)),duplicate.id,duplicate.timestamp,200,duplicate.response());
        denied(duplicate.raw,duplicate.id,duplicate.timestamp,200,bytes("{\"ok\":true,\"ok\":true,\"data\":"+duplicate.receipt+"}"));
        denied(duplicate.raw,duplicate.id,duplicate.timestamp,200,bytes("{\"ok\":true,\"data\":{\"schema\":\""+SCHEMA+"\","+duplicate.receipt.toString().substring(1)+"}"));
        for(String malformed:new String[]{"[]","{ok:true}","{'ok':true}","<html>200</html>",new String(duplicate.response(),StandardCharsets.UTF_8)+" false"}){
            denied(duplicate.raw,duplicate.id,duplicate.timestamp,200,bytes(malformed));
        }
        byte[] invalidUtf8={'{','"','x','"',':','"',(byte)0xc3,(byte)0x28,'"','}'};
        denied(invalidUtf8,duplicate.id,duplicate.timestamp,200,duplicate.response());denied(duplicate.raw,duplicate.id,duplicate.timestamp,200,invalidUtf8);
        String badSurrogate="{\"ok\":true,\"data\":"+duplicate.receipt.toString().replace("CHUNK_RETAINED_NOT_ACK","\\ud800")+"}";
        denied(duplicate.raw,duplicate.id,duplicate.timestamp,200,bytes(badSurrogate));
        Fixture numeric=new Fixture();String numericIndex=new String(numeric.raw,StandardCharsets.UTF_8).replace("\"manifest_chunk_index\":\"0\"","\"manifest_chunk_index\":0e0");
        denied(bytes(numericIndex),numeric.id,numeric.timestamp,200,numeric.response());
        Fixture wrongTargetType=new Fixture();wrongTargetType.body.put("original_target",new JSONArray());wrongTargetType.sealRequest();denied(wrongTargetType);
    }

    @Test public void CHUNK_transcriptOrderAndUntrustedLimits()throws Exception {
        Fixture f=new Fixture();accepted(f);assertEquals(GOLDEN_RECEIPT,hash(f.receiptTranscript()));
        f.receipt.put("receipt_sha256",hash(f.receiptTranscript()+"\n"));denied(f);
        f.receipt.put("receipt_sha256",hash(f.receiptTranscript().replace(RECEIPT_VERSION,RECEIPT_VERSION+"-foreign")));denied(f);
        Fixture ordered=new Fixture(32769,0); // Manifest/piece hashes deliberately differ.
        ordered.receipt.put("receipt_sha256",hash(String.join("\n",RECEIPT_VERSION,PARENT,ordered.receipt.getString("chunk_sha256"),"0",
            ordered.receipt.getString("manifest_sha256"),ordered.id,ordered.receipt.getString("request_body_sha256"),ordered.receipt.getString("registered_at"))));denied(ordered);
        Fixture purpose=new Fixture();purpose.body.put("purpose_binding_sha256",hash(purpose.purposeTranscript()+"\n"));purpose.wireBody(bytes(purpose.body.toString()));denied(purpose);
        Fixture swapped=new Fixture();swapped.body.put("purpose_binding_sha256",hash(swapped.purposeTranscript().replace(hex('2')+"\n"+hex('3'),hex('3')+"\n"+hex('2'))));
        swapped.wireBody(bytes(swapped.body.toString()));denied(swapped);
        // A different canonical placeholder remains untrusted shape-only DATA.
        Fixture placeholder=new Fixture();placeholder.body.put("purpose_attestation",hex('0'));placeholder.sealRequest();accepted(placeholder);
        Fixture malformed=new Fixture();malformed.body.put("purpose_attestation",hex('A'));malformed.sealRequest();denied(malformed);
        try(var d=decode(placeholder,placeholder.response())){
            JSONObject json=d.json();assertEquals("CHUNK_RETAINED_NOT_ACK",json.get("state"));assertEquals(11,json.length());
            assertFalse(json.has("authenticated"));assertFalse(json.has("transaction_authority"));assertFalse(json.has("current"));
        }
    }

    @Test public void CHUNK_ownedDetachedCloseWipes()throws Exception {
        Fixture f=new Fixture();byte[] raw=f.raw.clone(),response=f.response(),original=raw.clone(),reply=response.clone();
        var d=NativeOriginalInventoryManifestChunkWire.decode(raw,f.id,f.timestamp,200,response);
        assertArrayEquals(original,raw);assertArrayEquals(reply,response);
        Arrays.fill(raw,(byte)0);Arrays.fill(response,(byte)0);
        JSONObject a=d.json();a.put("state","COMPLETE");a.getJSONObject("limits").put("key_removal",true);
        JSONObject b=d.json();assertEquals("CHUNK_RETAINED_NOT_ACK",b.get("state"));
        for(String field:EFFECTS)assertEquals(Boolean.FALSE,b.getJSONObject("limits").get(field));
        // Read-only reflection on THIS untrusted DATA buffer, not a native
        // capability constructor, field mutation or positive issuer seam.
        var buffer=NativeOriginalInventoryManifestChunkWire.UntrustedChunkRetention.class.getDeclaredField("encoded");
        buffer.setAccessible(true);byte[] owned=(byte[])buffer.get(d);assertNotNull(owned);assertTrue(owned.length>0);
        for(var constructor:NativeOriginalInventoryManifestChunkWire.UntrustedChunkRetention.class.getDeclaredConstructors())
            assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        d.close();d.close();assertNull(buffer.get(d));
        for(byte value:owned)assertEquals(0,value);
        boolean closed=false;try{d.json();}catch(VaultFailure failure){closed=true;assertEquals(NativeOriginalInventoryManifestChunkWire.FAILURE,failure.code);}assertTrue(closed);
    }

    /** New affected extraction check only; the eight prior members remain
     * unchanged and are not selected by this qualification. */
    @Test public void CHUNK_STATUS_sharedOriginalValidationAndReceipt()throws Exception {
        Fixture f=new Fixture();byte[] original=f.raw.clone();
        JSONObject parsed=NativeOriginalInventoryManifestChunkWire.validateOriginal(f.raw,f.id,f.timestamp);
        assertEquals(15,parsed.length());assertEquals(PARENT,parsed.getString("inventory_native_request_id"));
        parsed.put("purpose","FOREIGN_DETACHED_DATA");
        assertEquals("RETAIN_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK",
            NativeOriginalInventoryManifestChunkWire.validateOriginal(f.raw,f.id,f.timestamp).getString("purpose"));
        try(var decoded=decode(f,f.response())){assertEquals(GOLDEN_RECEIPT,decoded.json().getString("receipt_sha256"));}
        assertArrayEquals(original,f.raw);
        f.body.put("purpose_binding_sha256",hex('0'));f.wireBody(bytes(f.body.toString()));
        boolean refused=false;
        try{NativeOriginalInventoryManifestChunkWire.validateOriginal(f.raw,f.id,f.timestamp);}
        catch(VaultFailure expected){refused=true;assertEquals(NativeOriginalInventoryManifestChunkWire.FAILURE,expected.code);}
        assertTrue(refused);denied(f);
    }

    /** Synthetic signed-body DATA loan, not an issuer or a signature key. */
    static byte[] statusOriginalBodyFixture(){return bytes(GOLDEN_BODY);}

    private static final class Fixture {
        final JSONObject body,receipt=new JSONObject();
        byte[] raw;String id=ID,timestamp=ISSUED;
        Fixture()throws Exception{
            body=new JSONObject(GOLDEN_BODY);
            receipt.put("schema",SCHEMA).put("state","CHUNK_RETAINED_NOT_ACK").put("registered_at","2026-10-16T12:00:00.123000Z").put("limits",flags());
            wireBody(bytes(GOLDEN_BODY));
        }
        Fixture(int bytes,int index)throws Exception{
            this();body.put("manifest_byte_count",Integer.toString(bytes)).put("manifest_chunk_count",Integer.toString((bytes+32767)/32768)).put("manifest_chunk_index",Integer.toString(index));
            body.put("manifest_sha256",hex('e'));byte[] piece=new byte[Math.min(32768,bytes-index*32768)];Arrays.fill(piece,(byte)'x');piece(piece);
        }
        void piece(byte[] piece)throws Exception{
            body.put("chunk_base64",java.util.Base64.getEncoder().encodeToString(piece)).put("chunk_sha256",hash(piece));sealRequest();
        }
        void sealRequest()throws Exception{body.put("purpose_binding_sha256",hash(purposeTranscript()));wireBody(bytes(body.toString()));}
        // Deliberately stringify malformed test-only scalar values here so
        // typed-count refusals reach the shipping decoder, not getString in
        // this fixture. No production coercion or authority is introduced.
        String purposeTranscript()throws Exception{return String.join("\n",PURPOSE_VERSION,String.valueOf(body.get("inventory_native_request_id")),
            String.valueOf(body.get("registration_request_body_sha256")),String.valueOf(body.get("intent_document_sha256")),String.valueOf(body.get("intent_disk_sha256")),String.valueOf(body.get("manifest_sha256")),
            String.valueOf(body.get("manifest_byte_count")),String.valueOf(body.get("manifest_chunk_count")),String.valueOf(body.get("manifest_chunk_index")),String.valueOf(body.get("chunk_sha256")));}
        void wireBody(byte[] original)throws Exception{
            raw=original.clone();receipt.put("inventory_native_request_id",body.get("inventory_native_request_id")).put("manifest_sha256",body.get("manifest_sha256"))
                .put("manifest_chunk_index",body.get("manifest_chunk_index")).put("chunk_sha256",body.get("chunk_sha256")).put("native_request_id",id)
                .put("request_body_sha256",hash(raw));sealReceipt();
        }
        void registered(String value)throws Exception{receipt.put("registered_at",value);sealReceipt();}
        String receiptTranscript()throws Exception{return String.join("\n",RECEIPT_VERSION,String.valueOf(receipt.get("inventory_native_request_id")),String.valueOf(receipt.get("manifest_sha256")),
            String.valueOf(receipt.get("manifest_chunk_index")),String.valueOf(receipt.get("chunk_sha256")),String.valueOf(receipt.get("native_request_id")),String.valueOf(receipt.get("request_body_sha256")),String.valueOf(receipt.get("registered_at")));}
        void sealReceipt()throws Exception{receipt.put("receipt_sha256",hash(receiptTranscript()));}
        byte[] response()throws Exception{return bytes(new JSONObject().put("ok",true).put("data",receipt).toString());}
    }
    private static JSONObject flags()throws Exception{JSONObject v=new JSONObject();for(String key:EFFECTS)v.put(key,false);return v;}
    private static String uuid(char c){return (""+c).repeat(8)+"-"+(""+c).repeat(4)+"-4"+(""+c).repeat(3)+"-8"+(""+c).repeat(3)+"-"+(""+c).repeat(12);}
    private static String hex(char c){return (""+c).repeat(64);}
    private static byte[] bytes(String s){return s.getBytes(StandardCharsets.UTF_8);}
    private static String hash(String s)throws Exception{return hash(bytes(s));}
    private static String hash(byte[] b)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));}
    private static String[] names(JSONObject value){java.util.ArrayList<String> out=new java.util.ArrayList<>();for(var it=value.keys();it.hasNext();)out.add(it.next());return out.toArray(new String[0]);}
    private static byte[] pad(byte[] raw,int length){if(raw.length>length)throw new AssertionError("padding bound");byte[] out=Arrays.copyOf(raw,length);Arrays.fill(out,raw.length,length,(byte)' ');return out;}
    private static NativeOriginalInventoryManifestChunkWire.UntrustedChunkRetention decode(Fixture f,byte[] response)throws VaultFailure{
        return NativeOriginalInventoryManifestChunkWire.decode(f.raw,f.id,f.timestamp,200,response);
    }
    private static void accepted(Fixture f)throws Exception{try(var d=decode(f,f.response())){assertEquals(SCHEMA,d.json().get("schema"));}}
    private static void denied(Fixture f)throws Exception{denied(f.raw,f.id,f.timestamp,200,f.response());}
    private static void denied(byte[] raw,String id,String timestamp,int status,byte[] response)throws Exception{
        byte[] a=raw==null?null:raw.clone(),b=response==null?null:response.clone();boolean refused=false;
        try(var ignored=NativeOriginalInventoryManifestChunkWire.decode(raw,id,timestamp,status,response)){fail("Malformed or foreign chunk DATA accepted");}
        catch(VaultFailure failure){refused=true;assertEquals(NativeOriginalInventoryManifestChunkWire.FAILURE,failure.code);}
        assertTrue(refused);assertArrayEquals(a,raw);assertArrayEquals(b,response);
    }
}
