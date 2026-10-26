package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeSeparationEvidenceTest {
    public static void main(String[] args)throws Exception {
        if(args.length!=1||!args[0].equals("--work-wire-copy-only"))throw new AssertionError("NEW selector required");
        var test=new NativeSeparationEvidenceTest();
        for(String name:new String[]{"capturedStringProofKeepsExactBodySignatureAndDetachedObject",
            "callerAndReturnedWireMutationCannotCacheAuthentication","opaqueAndInvalidProofsKeepOriginalParserAndVerifierBehavior",
            "detachedWirePreservesRawMapsAndLiveSetChangeRefusal"}) {
            try{NativeSeparationEvidenceTest.class.getMethod(name).invoke(test);System.out.println("PASS "+name);}
            catch(java.lang.reflect.InvocationTargetException e){System.out.println("FAIL "+name+" "+e.getCause().getClass().getSimpleName());throw e;}
        }
    }
    private static Map<String,Object> rawWork() {
        Map<String,Object> raw=new java.util.LinkedHashMap<>();raw.put(NativeRetainedWorkCapture.FENCE,"preserved original fence");
        raw.put("saved\"\\\n\uD83D\uDE80","original opaque work bytes");
        raw.put("original-set",new java.util.HashSet<>(java.util.List.of("alpha","quoted\"\\value")));return raw;
    }
    private static JSONObject proofFor(Map<String,Object> raw,char[] secret)throws Exception {
        var original=new java.util.HashMap<>(raw);original.remove(NativeRetainedWorkCapture.FENCE);
        return NativeSeparationEvidence.sign(context(),NativeProtectedWorkSnapshot.capture(original),secret).json();
    }
    private static NativeSeparationFreeze.Store store(Map<String,Object> raw,JSONObject proof) {
        return new NativeSeparationFreeze.Store() {
            public Map<String,?> separationRawSnapshot(){return new java.util.HashMap<>(raw);}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> captured)throws VaultFailure{assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(raw,captured));return proof;}
            public void prepareSeparationProbe(Map<String,?> original){fail("capture must not prepare");}
            public void freezeSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence evidence){fail("capture must not write");}
        };
    }
    private static NativeSeparationEvidence restoreWire(NativeRetainedWorkCapture capture,JSONObject wire,char[] secret)throws Exception {
        return NativeSeparationEvidence.restore(wire,NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal()),capture.values.snapshot(),secret);
    }
    private static String refusal(NativeRetainedWorkCapture capture,JSONObject wire,char[] secret)throws Exception {
        try{restoreWire(capture,wire,secret);fail("invalid proof accepted");return "unreachable";}catch(VaultFailure failure){return failure.code;}
    }
    @Test public void capturedStringProofKeepsExactBodySignatureAndDetachedObject()throws Exception {
        char[] secret=credential();try {
            var raw=rawWork();var proof=proofFor(raw,secret);String serialized=proof.toString();var source=store(raw,proof);
            var capture=NativeRetainedWorkCapture.capture(source);var first=capture.wire();var second=capture.wire();assertNotSame(first,second);
            assertSame(first.get("manifest_body"),second.get("manifest_body")); // Immutable scalar reused, outer JSON parser removed.
            assertArrayEquals(new JSONObject(serialized).toString().getBytes(StandardCharsets.UTF_8),first.toString().getBytes(StandardCharsets.UTF_8));
            var restored=restoreWire(capture,first,secret);assertEquals(proof.get("manifest_body"),restored.body);
            assertEquals(proof.get("manifest_sha256"),restored.bodySha256);assertEquals(proof.get("attestation"),restored.signature);
            assertEquals(independentlySigned("synthetic-test-secret",NativeSeparationContextTest.id(3),restored.body),restored.signature);
            capture.requireUnchanged(source);assertEquals(raw.size(),capture.frozen.size());assertEquals(raw.size()-1,capture.original.size());
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void callerAndReturnedWireMutationCannotCacheAuthentication()throws Exception {
        char[] secret=credential();char[] wrong=(NativeSeparationContextTest.id(3)+".wrong-synthetic-secret").toCharArray();try {
            var raw=rawWork();var proof=proofFor(raw,secret);String expected=new JSONObject(proof.toString()).toString();
            var capture=NativeRetainedWorkCapture.capture(store(raw,proof));proof.put("manifest_body","caller forged").put("attestation","caller forged").put("unknown",true);
            assertEquals(expected,capture.wire().toString());restoreWire(capture,capture.wire(),secret);
            var returned=capture.wire();returned.put("manifest_body","{}").put("attestation","0".repeat(64));
            assertEquals(NativeProtectedWorkSnapshot.FAILURE,refusal(capture,returned,secret));
            assertEquals(expected,capture.wire().toString());restoreWire(capture,capture.wire(),secret);
            assertEquals(NativeProtectedWorkSnapshot.FAILURE,refusal(capture,capture.wire(),wrong));
            assertEquals(expected,capture.wire().toString());restoreWire(capture,capture.wire(),secret);
        }finally{VaultValidation.wipe(secret);VaultValidation.wipe(wrong);}
    }
    @Test public void opaqueAndInvalidProofsKeepOriginalParserAndVerifierBehavior()throws Exception {
        char[] secret=credential();try {
            var raw=rawWork();var original=proofFor(raw,secret);
            var variations=new java.util.ArrayList<JSONObject>();variations.add(new JSONObject(original.toString()).put("unknown",new org.json.JSONArray().put(new JSONObject().put("keep",true))));
            variations.add(new JSONObject(original.toString()).put("manifest_body",new JSONObject().put("opaque","preserved")));
            variations.add(new JSONObject(original.toString()).put("manifest_sha256",7));variations.add(new JSONObject(original.toString()).put("attestation",JSONObject.NULL));
            var missing=new JSONObject(original.toString());missing.remove("attestation");variations.add(missing);
            for(String key:new String[]{"attestation_version","manifest_body","manifest_sha256","attestation"})variations.add(new JSONObject(original.toString()).put(key,"invalid string"));
            for(JSONObject invalid:variations){String serialized=invalid.toString();var capture=NativeRetainedWorkCapture.capture(store(raw,invalid));var parsed=new JSONObject(serialized);
                assertEquals(parsed.toString(),capture.wire().toString());assertEquals(refusal(capture,parsed,secret),refusal(capture,capture.wire(),secret));
                var returned=capture.wire();returned.put("returned-only","mutation");assertEquals(parsed.toString(),capture.wire().toString());
                invalid.put("caller-only","mutation");assertEquals(parsed.toString(),capture.wire().toString());
            }
            for(String serialized:new String[]{"{",null}){
                JSONObject malformed=new JSONObject(){@Override public String toString(){return serialized;}};
                var capture=NativeRetainedWorkCapture.capture(store(raw,malformed)); // Preserve deferred parser failure.
                Class<?> expected;try{new JSONObject(serialized);fail("malformed fixture parsed");expected=null;}catch(Exception error){expected=error.getClass();}
                try{capture.wire();fail("malformed wire accepted");}catch(VaultFailure error){assertEquals(NativeRetainedAttempt.FAILURE,error.code);assertEquals(expected,error.getCause().getClass());}
            }
        }finally{VaultValidation.wipe(secret);}
    }
    @Test public void detachedWirePreservesRawMapsAndLiveSetChangeRefusal()throws Exception {
        char[] secret=credential();try {
            var raw=rawWork();var proof=proofFor(raw,secret);var source=store(raw,proof);var capture=NativeRetainedWorkCapture.capture(source);
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(raw,capture.frozen));var original=new java.util.HashMap<>(raw);original.remove(NativeRetainedWorkCapture.FENCE);
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(original,capture.original));capture.requireUnchanged(source);
            @SuppressWarnings("unchecked") var live=(java.util.Set<String>)raw.get("original-set");var frozen=new java.util.HashSet<>(live);
            assertNotSame(live,capture.frozen.get("original-set"));live.add("late original data");
            assertEquals(frozen,capture.frozen.get("original-set"));assertEquals(frozen,capture.original.get("original-set"));
            try{capture.requireUnchanged(source);fail("changed live namespace accepted");}catch(VaultFailure error){assertEquals(NativeRetainedAttempt.FAILURE,error.code);}
            assertEquals(proof.toString(),capture.wire().toString());restoreWire(capture,capture.wire(),secret);
        }finally{VaultValidation.wipe(secret);}
    }
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
