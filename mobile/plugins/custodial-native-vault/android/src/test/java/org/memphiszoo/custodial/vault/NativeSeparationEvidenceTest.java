package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeSeparationEvidenceTest {
    static String independentlySigned(String secret,String credentialId,String body)throws Exception{
        byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
        String hash=java.util.HexFormat.of().formatHex(digest);
        Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return java.util.HexFormat.of().formatHex(mac.doFinal((NativeSeparationEvidence.VERSION+"\n"+credentialId+"\n"+hash).getBytes(StandardCharsets.UTF_8)));
    }
    static NativeSeparationContext context()throws Exception{return NativeSeparationContextTest.read(NativeSeparationContextTest.data());}
    static char[] credential(){return(NativeSeparationContextTest.id(3)+".synthetic-test-secret").toCharArray();}
    @Test public void exactBodyAndEveryRecordAreCoveredByPurposeSeparatedProof()throws Exception{
        char[] secret=credential();try{
            var evidence=NativeSeparationEvidence.sign(context(),NativeProtectedWorkSnapshot.capture(Map.of("saved","original encrypted record")),secret);
            assertEquals(independentlySigned("synthetic-test-secret",NativeSeparationContextTest.id(3),evidence.body),evidence.signature);
            assertEquals(NativeProviderPrincipal.hash(evidence.body),evidence.bodySha256);
            var changed=NativeSeparationEvidence.sign(context(),NativeProtectedWorkSnapshot.capture(Map.of("saved","changed record")),secret);
            assertNotEquals(evidence.signature,changed.signature);
            var m=new JSONObject(evidence.body);assertEquals("UNKNOWN",m.getString("browser_inventory_state"));
            assertEquals("UNKNOWN",m.getString("native_semantic_inventory_state"));assertFalse(m.getBoolean("phone_released"));
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void cutoffMicrosecondsAndOriginalInstallationAreIncluded()throws Exception{
        char[] secret=credential();try{
            var snapshot=NativeProtectedWorkSnapshot.capture(Map.of());var first=NativeSeparationEvidence.sign(context(),snapshot,secret);
            var later=NativeSeparationContextTest.read(NativeSeparationContextTest.data().put("cutoff_at","2026-09-27T08:00:00.123457Z"));
            assertNotEquals(first.signature,NativeSeparationEvidence.sign(later,snapshot,secret).signature);
            var body=new JSONObject(first.body);assertEquals("original-seal-00000001",body.getJSONObject("original_principal").getString("installation_seal"));
            assertEquals("2026-07-31T21:52:04.123456Z",body.getJSONObject("original_principal").getString("enrolled_at"));
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void wrongRetainedCredentialNeverSigns()throws Exception{
        char[] secret=(NativeSeparationContextTest.id(99)+".synthetic-test-secret").toCharArray();
        try{NativeSeparationEvidence.sign(context(),NativeProtectedWorkSnapshot.capture(Map.of()),secret);fail();}
        catch(VaultFailure expected){}finally{VaultValidation.wipe(secret);}
    }
    @Test public void returnedWireObjectCannotAlterSignedBody()throws Exception{
        char[] secret=credential();try{
            var evidence=NativeSeparationEvidence.sign(context(),NativeProtectedWorkSnapshot.capture(Map.of()),secret);
            var wire=evidence.json();wire.put("manifest_body","forged");wire.put("attestation","forged");
            assertEquals(evidence.body,evidence.json().getString("manifest_body"));assertEquals(evidence.signature,evidence.json().getString("attestation"));
            assertEquals(4,evidence.json().length());
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void actualNativeEngineChecksFullOriginalPrincipalWithoutMutation()throws Exception{
        var f=new NativeSeparationTransportTest.Fixture();var context=f.read();var before=f.engine.getState();String principal=f.store.value;
        var snapshot=NativeProtectedWorkSnapshot.capture(Map.of("unknown","original"));
        var evidence=f.engine.attestNativeSeparationSnapshot(context,snapshot,f.principal,null);
        assertEquals(before,f.engine.getState());assertEquals(principal,f.store.value);assertEquals(0,f.cipher.destroyCalls);
        char[] credential=f.cipher.decrypt(f.persistence.current().secret);
        try{String raw=new String(credential);int dot=raw.indexOf('.');assertEquals(independentlySigned(raw.substring(dot+1),raw.substring(0,dot),evidence.body),evidence.signature);}
        finally{VaultValidation.wipe(credential);}
        f.capture(NativeSeparationContextTest.id(99),8);
        try{f.engine.attestNativeSeparationSnapshot(context,snapshot,f.principal,null);fail();}catch(VaultFailure expected){}
        assertEquals(1,f.calls); // Signing is local, not another HTTP/enrollment.
    }
    @Test public void retainedWireVerifierRejectsBodyDigestSignaturePrincipalAndMissingFields()throws Exception{
        char[] secret=credential();try{
            var snapshot=NativeProtectedWorkSnapshot.capture(Map.of("saved","original protected bytes"));
            var proof=NativeSeparationEvidence.sign(context(),snapshot,secret);
            var principal=NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal());
            assertEquals(proof.body,NativeSeparationEvidence.restore(proof.json(),principal,snapshot,secret).body);
            for(String field:new String[]{"attestation_version","manifest_body","manifest_sha256","attestation"}){
                for(Object invalid:new Object[]{"changed",org.json.JSONObject.NULL,7}){
                    var changed=proof.json().put(field,invalid);
                    AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(changed,principal,snapshot,secret));
                }
                var missing=proof.json();missing.remove(field);
                AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(missing,principal,snapshot,secret));
            }
            AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(proof.json().put("extra",true),principal,snapshot,secret));
            var otherSnapshot=NativeProtectedWorkSnapshot.capture(Map.of("saved","different original bytes"));
            AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(proof.json(),principal,otherSnapshot,secret));
            for(String field:new String[]{"employee_id","credential_id","assignment_epoch","installation_seal","enrolled_at","credential_operation_id"}){
                var changed=NativeSeparationContextTest.principal().put(field,field.equals("assignment_epoch")?8:field.equals("installation_seal")?"other-installation-seal":field.equals("enrolled_at")?"2026-08-01T00:00:00Z":NativeSeparationContextTest.id(99));
                var otherPrincipal=NativeProviderPrincipal.fromNativeJournal(changed);
                AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(proof.json(),otherPrincipal,snapshot,secret));
            }
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void evenCorrectlySignedSemanticallyChangedManifestCannotClaimEmptyOrReleased()throws Exception{
        char[] secret=credential();try{
            var snapshot=NativeProtectedWorkSnapshot.capture(Map.of("saved","original protected bytes"));
            var proof=NativeSeparationEvidence.sign(context(),snapshot,secret);
            var principal=NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal());
            for(String field:new String[]{"native_semantic_inventory_state","browser_inventory_state","new_work_allowed","phone_released","record_count"}){
                var body=new JSONObject(proof.body).put(field,field.endsWith("state")?"VERIFIED_EMPTY":field.equals("record_count")?0:true);
                String encoded=body.toString();var wire=proof.json().put("manifest_body",encoded).put("manifest_sha256",NativeProviderPrincipal.hash(encoded))
                    .put("attestation",independentlySigned("synthetic-test-secret",NativeSeparationContextTest.id(3),encoded));
                AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationEvidence.restore(wire,principal,snapshot,secret));
            }
        }finally{VaultValidation.wipe(secret);}
    }
}
