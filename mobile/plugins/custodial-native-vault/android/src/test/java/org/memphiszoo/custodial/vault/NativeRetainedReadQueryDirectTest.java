package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** New direct lifecycle/identity cases for PREP-NEW-010. Actual unmounted
 * query source and synthetic original principal/HMAC only; no journal, HTTP,
 * SQL, Android runtime, semantic acceptance, inventory ACK or key authority. */
public final class NativeRetainedReadQueryDirectTest {
    static final long WRITE_AT=1791531600123L, QUERY_AT=WRITE_AT+1000;
    interface Checked { void run() throws Exception; }
    static void denied(Checked work) throws Exception {
        try { work.run(); fail("query refusal required"); }
        catch(VaultFailure expected) { assertEquals(NativeRetainedAttempt.FAILURE,expected.code); }
    }
    static void deniedCode(String code,Checked work) throws Exception {
        try { work.run(); fail("query refusal required"); }
        catch(VaultFailure expected) { assertEquals(code,expected.code); }
    }
    static String id(int n) { return NativeSeparationContextTest.id(n); }
    static final class Fixture implements AutoCloseable {
        final char[] credential=(id(3)+".synthetic-direct-query-secret").toCharArray();
        final NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(NativeSeparationContextTest.principal());
        final Map<String,Object> originals=new HashMap<>();
        final NativeRetainedRecordValues values;
        final byte[] wire;
        Fixture() throws Exception {
            originals.put("unknown-old-work","synthetic opaque original");
            originals.put("negative-zero",-0f);
            originals.put("set",Set.of("Spanish ñ","unpaired\ud800"));
            originals.put("large-opaque","x".repeat(20000));
            values=NativeRetainedRecordValues.capture(originals);
            var proof=NativeSeparationEvidence.sign(NativeSeparationContextTest.read(NativeSeparationContextTest.data()),values.snapshot(),credential);
            wire=(" \n"+proof.json().toString()+"\t ").getBytes(StandardCharsets.UTF_8);
        }
        NativeRetainedAttempt target(int nonce,int chunk) throws Exception {
            return NativeRetainedAttempt.prepareChunk(wire,values,principal,7,credential,id(30),id(31),chunk,id(nonce),WRITE_AT);
        }
        NativeRetainedReadQuery query(NativeRetainedAttempt target) throws Exception {
            return NativeRetainedReadQuery.prepare(target,principal,7,credential,id(50),QUERY_AT);
        }
        NativeRetainedReadQuery restore(JSONObject record,NativeRetainedAttempt target) throws Exception {
            return NativeRetainedReadQuery.restore(record,target,principal,7,credential);
        }
        public void close() { Arrays.fill(credential,'\0');Arrays.fill(wire,(byte)0); }
    }
    @Test public void directPreparationSeparatesFreshQueryFromExactOriginalWriteAndWire() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            var original=target.record().toString();var body=new JSONObject(new String(q.body(),StandardCharsets.UTF_8));
            assertEquals(7,body.length());assertEquals("custodial.original-native-evidence-readback.v1",body.getString("schema"));
            assertEquals(id(30),body.getString("operation_id"));assertEquals(id(31),body.getString("generation_id"));
            assertEquals(target.requestId,body.getString("native_request_id"));assertEquals(target.bodySha256,body.getString("request_body_sha256"));
            assertEquals(target.attestationDigest,body.getString("attestation_digest"));
            assertArrayEquals(f.wire,NativeRetainedAttempt.base64(body.getString("signed_wire_base64"),262144));
            assertEquals(id(50),q.requestId);assertNotEquals(target.requestId,q.requestId);assertNotEquals(target.timestamp,q.timestamp);
            assertEquals(q.requestId,q.nativeHeaders().get("X-Memphis-Native-Request-Id"));
            assertEquals(target.wireSha256,q.targetWireSha256);assertEquals(original,target.record().toString());
            assertTrue(ProviderWireJson.same(q.targetEnvelope(),new JSONObject(new String(target.body(),StandardCharsets.UTF_8))));
            assertTrue(ProviderWireJson.same(q.targetManifest(),new JSONObject(new JSONObject(new String(f.wire,StandardCharsets.UTF_8)).getString("manifest_body"))));
        }
    }
    @Test public void directRestorePreservesExactBodyHeadersTargetRecordAndDoesNotRenewStaleQuery() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            var record=q.record();String before=record.toString();
            try(var restored=f.restore(record,target)) {
                assertArrayEquals(q.body(),restored.body());assertEquals(q.nativeHeaders(),restored.nativeHeaders());
                assertEquals(q.record().toString(),restored.record().toString());assertEquals(q.attestationDigest,restored.attestationDigest);
                assertEquals(q.timestamp,restored.timestamp);assertEquals(q.requestId,restored.requestId);
                denied(()->restored.requireFresh(QUERY_AT+120001));
            }
            assertEquals(before,record.toString());
        }
    }
    @Test public void directRecordHasExactTenFieldsAndStrictStringAndIntegerTypes() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            JSONObject record=q.record();assertEquals(10,record.length());
            for(var keys=record.keys();keys.hasNext();) {
                String key=keys.next();
                var missing=q.record();missing.remove(key);denied(()->f.restore(missing,target));
                if(!key.equals("engine_revision")) for(Object bad:new Object[]{7,true,JSONObject.NULL}) {
                    var changed=q.record().put(key,bad);denied(()->f.restore(changed,target));
                }
            }
            for(Object bad:new Object[]{7.0,"7",true,JSONObject.NULL,8,-1}) {
                var changed=q.record().put("engine_revision",bad);denied(()->f.restore(changed,target));
            }
            denied(()->f.restore(q.record().put("unexpected",true),target));
        }
    }
    @Test public void directPrepareAndRestoreRequireFullOriginalPrincipalAndExactRevision() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            for(String key:new String[]{"employee_id","credential_id","credential_operation_id","installation_seal","enrolled_at","assignment_epoch"}) {
                var p=NativeSeparationContextTest.principal().put(key,key.equals("assignment_epoch")?8:key.equals("installation_seal")?"different-seal-00000001":key.equals("enrolled_at")?"2026-08-01T00:00:00Z":id(99));
                var other=NativeProviderPrincipal.fromNativeJournal(p);
                denied(()->NativeRetainedReadQuery.prepare(target,other,7,f.credential,id(50),QUERY_AT));
                denied(()->NativeRetainedReadQuery.restore(q.record(),target,other,7,f.credential));
            }
            for(long revision:new long[]{-1,6,8}) {
                denied(()->NativeRetainedReadQuery.prepare(target,f.principal,revision,f.credential,id(50),QUERY_AT));
                denied(()->NativeRetainedReadQuery.restore(q.record(),target,f.principal,revision,f.credential));
            }
        }
    }
    @Test public void directPrepareRefusesMissingClosedTargetAndInvalidOrReusedQueryNonce() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0)) {
            for(String nonce:new String[]{null,target.requestId,"","not-a-uuid","95000000-0000-0000-8000-000000000050"})
                denied(()->NativeRetainedReadQuery.prepare(target,f.principal,7,f.credential,nonce,QUERY_AT));
            denied(()->NativeRetainedReadQuery.prepare(null,f.principal,7,f.credential,id(50),QUERY_AT));
            denied(()->NativeRetainedReadQuery.prepare(target,null,7,f.credential,id(50),QUERY_AT));
            target.close();denied(()->f.query(target));
        }
    }
    @Test public void directRestoreCannotSubstituteAnotherOriginalNonceChunkOrOperation() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target);
            var nonce=f.target(41,0);var chunk=f.target(42,1);
            var operation=NativeRetainedAttempt.prepareChunk(f.wire,f.values,f.principal,7,f.credential,id(32),id(31),0,id(43),WRITE_AT)) {
            for(var other:new NativeRetainedAttempt[]{nonce,chunk,operation}) denied(()->f.restore(q.record(),other));
            denied(()->f.restore(q.record().put("target_record_sha256","0".repeat(64)),target));
        }
    }
    @Test public void directRestoreRejectsEveryPersistedIdentityBodyTimeDigestAndHmacTamper() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            for(String key:new String[]{"schema","principal_digest","target_record_sha256","native_request_id","native_request_timestamp","native_request_attestation","request_body_sha256","attestation_digest","body_base64"}) {
                var changed=q.record().put(key,key.equals("native_request_id")?id(99):key.equals("native_request_timestamp")?target.timestamp:key.equals("body_base64")?"e30=":"0".repeat(64));
                String before=changed.toString();denied(()->f.restore(changed,target));assertEquals(before,changed.toString());
            }
            denied(()->f.restore(q.record().put("native_request_id",target.requestId),target));
            denied(()->f.restore(q.record().put("native_request_timestamp","2026-10-09T08:00:01.123+00:00"),target));
        }
    }
    @Test public void directRestoreRejectsChangedCredentialWithoutResigningSavedQuery() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            char[][] variants={(id(3)+".wrong-secret").toCharArray(),(id(99)+".wrong-secret").toCharArray(),new char[0]};
            String[] codes={NativeRetainedAttempt.FAILURE,"custodial_native_credential_binding_mismatch","custodial_native_attestation_credential_refused"};
            for(int i=0;i<variants.length;i++) {
                char[] bad=variants[i];String code=codes[i];
                try { deniedCode(code,()->NativeRetainedReadQuery.restore(q.record(),target,f.principal,7,bad)); }
                finally { Arrays.fill(bad,'\0'); }
            }
            deniedCode("custodial_native_attestation_credential_refused",()->NativeRetainedReadQuery.restore(q.record(),target,f.principal,7,null));
        }
    }
    @Test public void directBodyEnvelopeManifestRecordAndHeadersCannotMutateOwnedCopies() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            byte[] body=q.body();String record=q.record().toString(),original=target.record().toString();
            byte[] copy=q.body();Arrays.fill(copy,(byte)0);q.record().put("native_request_id",id(99));
            q.targetEnvelope().put("operation_id",id(99));q.targetManifest().put("unexpected",true);
            try { q.nativeHeaders().clear();fail("headers mutable"); } catch(UnsupportedOperationException expected) {}
            assertArrayEquals(body,q.body());assertEquals(record,q.record().toString());assertEquals(original,target.record().toString());
        }
    }
    @Test public void directRestoreRejectsMalformedUnknownDuplicateAndTrailingQueryBodies() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            String valid=new String(q.body(),StandardCharsets.UTF_8);
            String[] bodies={new JSONObject(valid).put("unexpected",true).toString(),
                valid.replace("\"schema\":", "\"schema\":\"duplicate\",\"schema\":"),valid+" trailing","{'schema':'v1'}",
                new JSONObject(valid).put("native_request_id",id(99)).toString()};
            String[] codes={NativeRetainedAttempt.FAILURE,"custodial_provider_wire_json_invalid","custodial_provider_wire_json_invalid","custodial_provider_wire_json_invalid",NativeRetainedAttempt.FAILURE};
            for(int i=0;i<bodies.length;i++) {
                String body=bodies[i],code=codes[i];
                var changed=q.record().put("body_base64",NativeRetainedAttempt.encodeBase64(body.getBytes(StandardCharsets.UTF_8)));
                deniedCode(code,()->f.restore(changed,target));
            }
            denied(()->f.restore(q.record().put("body_base64",q.record().getString("body_base64")+"\n"),target));
        }
    }
    @Test public void directFreshnessUsesInclusiveOriginalWindowWithoutExtensionOrOverflow() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0);var q=f.query(target)) {
            q.requireFresh(QUERY_AT-15000);q.requireFresh(QUERY_AT+120000);
            denied(()->q.requireFresh(QUERY_AT-15001));denied(()->q.requireFresh(QUERY_AT+120001));
            denied(()->q.requireFresh(Long.MIN_VALUE));denied(()->q.requireFresh(Long.MAX_VALUE));
        }
    }
    @Test public void directClosureRevokesAllQueryReadHandlesButLeavesOriginalTargetUntouched() throws Exception {
        try(var f=new Fixture();var target=f.target(40,0)) {
            String original=target.record().toString();var q=f.query(target);q.close();q.close();
            denied(()->q.record());denied(()->q.body());denied(()->q.nativeHeaders());
            denied(()->q.targetEnvelope());denied(()->q.targetManifest());denied(()->q.requireOpen());denied(()->q.requireFresh(QUERY_AT));
            assertEquals(original,target.record().toString());assertTrue(target.body().length>0);
        }
    }
}
