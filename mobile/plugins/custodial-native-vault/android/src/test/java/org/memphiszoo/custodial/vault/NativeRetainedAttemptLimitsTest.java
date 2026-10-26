package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.json.JSONObject;
import org.junit.Test;

/** Native wire/cipher/standard codec boundary cases. */
public final class NativeRetainedAttemptLimitsTest {
    @Test public void maximumOriginalWireFitsUnchangedBodyAndCipherBounds() throws Exception {
        var f=new NativeRetainedAttemptTest.Fixture();
        byte[] wire=(new String(f.wire,StandardCharsets.UTF_8)+" ".repeat(262144-f.wire.length)).getBytes(StandardCharsets.UTF_8);
        assertEquals(262144,wire.length);
        try(var a=NativeRetainedAttempt.prepareChunk(wire,f.values,f.principal,7,f.credential,
            NativeRetainedAttemptTest.id(30),NativeRetainedAttemptTest.id(31),0,NativeRetainedAttemptTest.id(40),1791531600123L)) {
            assertTrue(a.body().length<=393216);f.journal().prepare(a);assertTrue(f.disk.durable.size()>100);
            for(Object item:f.disk.durable.values()) {
                JSONObject envelope=new JSONObject(item.toString());assertTrue(envelope.getString("ciphertext").length()<=16384);
            }
            f.disk.restart();try(var restored=f.restore(f.journal().observe())) { assertArrayEquals(a.body(),restored.body()); }
            JSONObject body=new JSONObject(new String(a.body(),StandardCharsets.UTF_8));assertArrayEquals(wire,Base64.getDecoder().decode(body.getString("signed_wire_base64")));
            assertEquals(0,f.cipher.creates);assertEquals(0,f.cipher.destroys);
            System.out.println("MAXIMUM_WIRE_BOUND: wire="+wire.length+", body="+a.body().length+", protected_parts="+(f.disk.durable.size()-1));
        }
    }
    @Test public void oversizedWireAndNonCanonicalOperationNonceRefuseBeforeJournalWrite() throws Exception {
        var f=new NativeRetainedAttemptTest.Fixture();byte[] tooLarge=new byte[262145];
        NativeRetainedAttemptTest.denied(()->NativeRetainedAttempt.prepareChunk(tooLarge,f.values,f.principal,7,f.credential,
            NativeRetainedAttemptTest.id(30),NativeRetainedAttemptTest.id(31),0,NativeRetainedAttemptTest.id(40),1791531600123L));
        for(String invalid:new String[]{"not-a-UUID",NativeRetainedAttemptTest.id(40).toUpperCase(),"95000000-0000-6000-8000-000000000040"}) {
            // The upper-case fixture has no alphabetic characters; use a
            // genuinely noncanonical alphabetic UUID in that variation.
            String nonce=invalid.equals(NativeRetainedAttemptTest.id(40))?"ABCDEF00-0000-4000-8000-000000000040":invalid;
            NativeRetainedAttemptTest.denied(()->NativeRetainedAttempt.prepareChunk(f.wire,f.values,f.principal,7,f.credential,
                NativeRetainedAttemptTest.id(30),NativeRetainedAttemptTest.id(31),0,nonce,1791531600123L));
        }
        assertEquals(0,f.disk.commits);assertTrue(f.disk.durable.isEmpty());assertEquals(0,f.cipher.existing);
    }
    @Test public void nativePaddedCodecMatchesIndependentJdkAndRejectsAlternatePadBits() throws Exception {
        var random=new java.util.Random(20261009L);
        for(int length=1;length<=256;length++) {
            byte[] input=new byte[length];random.nextBytes(input);String oracle=Base64.getEncoder().encodeToString(input);
            assertEquals(oracle,NativeRetainedAttempt.encodeBase64(input));assertArrayEquals(input,NativeRetainedAttempt.base64(oracle,393216));
        }
        for(String invalid:new String[]{"Zg","Zg=","Zg===","Zh==","Zm9=","Zm9v\n","____","Zg==extra","","☃"})
            NativeRetainedAttemptTest.denied(()->NativeRetainedAttempt.base64(invalid,393216));
        NativeRetainedAttemptTest.denied(()->NativeRetainedAttempt.base64("Zm9v",2));
    }
}
