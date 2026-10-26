package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** Synthetic original/signature DATA only. No live native control, HMAC key,
 * registration, server, clock, network, currentness or ACK is manufactured. */
public final class NativeOriginalInventoryManifestChunkStatusEnvelopeTest {
    private static final String ID="22222222-2222-4222-8222-222222222222";
    private static final String PARENT="11111111-1111-4111-8111-111111111111";
    private static final String TIME="2026-10-16T12:00:00.123Z",SIGNATURE="d".repeat(64);
    public static void main(String[] args)throws Exception{
        if(args.length!=1||!"--manifest-chunk-status-only".equals(args[0]))throw new IllegalArgumentException();
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
            NativeOriginalInventoryManifestChunkStatusEnvelopeTest.class,"STATUS_exactOriginalEnvelopeAndRefusals"));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New chunk status DATA member failed");
        System.out.println("PASS_MANIFEST_CHUNK_STATUS_DATA_ONLY");
    }
    @Test public void STATUS_exactOriginalEnvelopeAndRefusals()throws Exception{
        byte[] raw=NativeOriginalInventoryManifestChunkWireTest.statusOriginalBodyFixture(),before=raw.clone();
        assertEquals("/device-auth/original-inventory-manifest-chunk-status",NativeOriginalInventoryManifestChunkStatusEnvelope.PATH);
        assertEquals(196608,NativeOriginalInventoryManifestChunkStatusEnvelope.MAX_OUTPUT);
        verify(raw,TIME,SIGNATURE);assertArrayEquals(before,raw);
        // JSON escape spelling and raw whitespace, not a regenerated original.
        String escaped=new String(raw,StandardCharsets.UTF_8).replace("\"schema\"","\"\\u0073chema\"")
            .replace("KIOSK_02","KIOSK_0\\u0032");
        byte[] unicodeEscapes=escaped.getBytes(StandardCharsets.UTF_8);verify(unicodeEscapes,TIME,SIGNATURE);
        assertFalse(Arrays.equals(raw,unicodeEscapes));
        // Original data may be old: there is deliberately NO fresh clock API.
        verify(raw,"0001-01-01T00:00:00.000Z","0".repeat(64));
        verify(raw,"9999-12-31T23:59:59.999Z","f".repeat(64));
        // Largest valid original. Each tab expands during envelope escaping;
        // the READ output must not inherit the 65536 original-body ceiling.
        byte[] maximum=Arrays.copyOf(raw,65536);Arrays.fill(maximum,raw.length,maximum.length,(byte)'\t');
        byte[] envelope=verify(maximum,TIME,SIGNATURE);
        assertTrue(envelope.length>65536);assertTrue(envelope.length<=196608);
        // Caller/output buffers are detached, not a shared cached envelope.
        byte[] original=raw.clone(),one=NativeOriginalInventoryManifestChunkStatusEnvelope.encode(raw,ID,TIME,SIGNATURE);
        Arrays.fill(one,(byte)0);assertArrayEquals(original,raw);
        byte[] second=verify(raw,TIME,SIGNATURE);Arrays.fill(raw,(byte)0);
        assertArrayEquals(original,new JSONObject(new String(second,StandardCharsets.UTF_8))
            .getString("original_request_utf8").getBytes(StandardCharsets.UTF_8));

        raw=before;
        denied(null,ID,TIME,SIGNATURE);denied(new byte[0],ID,TIME,SIGNATURE);
        denied(new byte[65537],ID,TIME,SIGNATURE);
        for(String bad:new String[]{null,"","not-uuid",PARENT,"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"})
            denied(raw,bad,TIME,SIGNATURE);
        for(String bad:new String[]{null,"","0000-01-01T00:00:00.000Z","2026-02-29T12:00:00.123Z",
            "2026-10-16T12:00:00.123000Z","2026-10-16T12:00:00Z","2026-10-16T12:00:00.123+00:00"})
            denied(raw,ID,bad,SIGNATURE);
        for(String bad:new String[]{null,"","f".repeat(63),"f".repeat(65),"A".repeat(64)," "+SIGNATURE})
            denied(raw,ID,TIME,bad);
        JSONObject body=new JSONObject(new String(raw,StandardCharsets.UTF_8));
        for(String key:new String[]{"schema","purpose","purpose_attestation","purpose_binding_sha256","chunk_base64","chunk_sha256",
            "manifest_chunk_count","manifest_chunk_index","manifest_byte_count","inventory_native_request_id","original_target"}){
            JSONObject changed=new JSONObject(body.toString());changed.remove(key);denied(bytes(changed.toString()),ID,TIME,SIGNATURE);
        }
        for(String key:new String[]{"purpose","schema","purpose_binding_sha256","chunk_sha256"}){
            JSONObject changed=new JSONObject(body.toString());changed.put(key,"FOREIGN");denied(bytes(changed.toString()),ID,TIME,SIGNATURE);
        }
        JSONObject typed=new JSONObject(body.toString());typed.put("manifest_chunk_index",0);denied(bytes(typed.toString()),ID,TIME,SIGNATURE);
        JSONObject extra=new JSONObject(body.toString());extra.put("phone_released",false);denied(bytes(extra.toString()),ID,TIME,SIGNATURE);
        String trimmed=new String(raw,StandardCharsets.UTF_8).trim();
        denied(bytes("{\"purpose\":\"RETAIN_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK\","+trimmed.substring(1)),ID,TIME,SIGNATURE);
        denied(bytes(trimmed+" true"),ID,TIME,SIGNATURE);
        denied(new byte[]{'{','"',(byte)0xc3,(byte)0x28,'"','}',},ID,TIME,SIGNATURE);
        // Unicode values outside the fixed target/purpose grammar stay refused;
        // lone surrogate escapes must not silently turn into replacement bytes.
        for(String text:new String[]{trimmed.replace("KIOSK_02","KIOSK_\ud83d\ude03"),
            trimmed.replace("KIOSK_02","KIOSK_\\ud800"),trimmed.replace("KIOSK_02","KIOSK_\\udc00")})
            denied(bytes(text),ID,TIME,SIGNATURE);
        JSONObject foreignTarget=new JSONObject(body.toString());foreignTarget.getJSONObject("original_target").put("grant",true);
        denied(bytes(foreignTarget.toString()),ID,TIME,SIGNATURE);
    }
    private static byte[] verify(byte[] raw,String timestamp,String signature)throws Exception{
        byte[] before=raw.clone();
        byte[] encoded=NativeOriginalInventoryManifestChunkStatusEnvelope.encode(raw,ID,timestamp,signature);
        assertArrayEquals(before,raw);assertNotSame(raw,encoded);
        JSONObject envelope=ProviderWireJson.object(encoded,196608);
        NativeRetainedAttempt.keys(envelope,"schema","purpose","original_request_utf8","original_request_timestamp","original_request_attestation");
        assertEquals(5,envelope.length());assertEquals("custodial.original-native-inventory-manifest-chunk-status.v1",envelope.get("schema"));
        assertEquals("READ_EXACT_ORIGINAL_INVENTORY_MANIFEST_CHUNK",envelope.get("purpose"));
        assertArrayEquals(raw,envelope.getString("original_request_utf8").getBytes(StandardCharsets.UTF_8));
        assertEquals(timestamp,envelope.get("original_request_timestamp"));assertEquals(signature,envelope.get("original_request_attestation"));
        assertFalse(envelope.has("native_request_id"));assertFalse(envelope.has("inventory_acknowledged"));
        return encoded;
    }
    private static byte[] bytes(String value){return value.getBytes(StandardCharsets.UTF_8);}
    private static void denied(byte[] raw,String id,String time,String signature)throws Exception{
        byte[] before=raw==null?null:raw.clone();boolean refused=false;
        try{NativeOriginalInventoryManifestChunkStatusEnvelope.encode(raw,id,time,signature);}
        catch(VaultFailure failure){refused=true;assertEquals(NativeOriginalInventoryManifestChunkWire.FAILURE,failure.code);}
        assertTrue("Malformed/foreign original must refuse",refused);assertArrayEquals(before,raw);
    }
}
