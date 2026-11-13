package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Unmounted native read-only query. Target old write identity is immutable and
 * distinct from the fresh query's actual nonce/time/body. No signer/path/body
 * selection for WebView, Supabase key, writer, retry or semantic ACK authority. */
final class NativeRetainedReadQuery implements AutoCloseable {
    static final String SCHEMA="custodial.native-retained-prepared-read-query.v1";
    final String principalDigest,requestId,timestamp,bodySha256,attestationDigest;
    final String targetRequestId,targetBodySha256,targetAttestationDigest,targetWireSha256,operationId,generationId;
    final long engineRevision;
    private final String targetRecord;
    private final byte[] body;
    private final Map<String,String> headers;
    private boolean closed;
    private NativeRetainedReadQuery(byte[] body,Map<String,String> headers,NativeRetainedAttempt target,NativeProviderPrincipal principal,long revision)throws VaultFailure{
        this.body=body.clone();this.headers=VaultCollections.copyMap(headers);principalDigest=principal.digest;engineRevision=revision;
        requestId=headers.get("X-Memphis-Native-Request-Id");timestamp=headers.get("X-Memphis-Native-Request-Timestamp");
        targetRequestId=target.requestId;targetBodySha256=target.bodySha256;targetAttestationDigest=target.attestationDigest;
        targetWireSha256=target.wireSha256;operationId=target.operationId;generationId=target.generationId;
        targetRecord=target.record().toString();bodySha256=NativeRetainedAttempt.hash(body);
        try{attestationDigest=NativeRetainedAttempt.hash(new JSONArray().put(NativeAttestation.REQUEST_VERSION)
            .put(principal.json().getString("credential_id")).put(principal.json().getString("device_id")).put("POST")
            .put(NativeRetainedAttempt.PATH).put(bodySha256).put(requestId).put(timestamp)
            .put(headers.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8));}
        catch(Exception error){throw invalid(error);}
    }
    static NativeRetainedReadQuery prepare(NativeRetainedAttempt target,NativeProviderPrincipal principal,long revision,
        char[] credential,String queryNonce,long queryMillis)throws VaultFailure{
        byte[] oldBody=null,body=null;
        try{
            if(target==null||principal==null||revision<0||!target.principalDigest.equals(principal.digest)
                ||target.engineRevision!=revision||queryNonce==null||queryNonce.equals(target.requestId)
                ||!queryNonce.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw invalid();
            oldBody=target.body();JSONObject old=ProviderWireJson.object(oldBody,NativeRetainedAttempt.MAX_BODY);
            JSONObject query=new JSONObject().put("schema","custodial.original-native-evidence-readback.v1")
                .put("operation_id",target.operationId).put("generation_id",target.generationId)
                .put("signed_wire_base64",old.getString("signed_wire_base64"))
                .put("native_request_id",target.requestId).put("request_body_sha256",target.bodySha256)
                .put("attestation_digest",target.attestationDigest);
            body=query.toString().getBytes(StandardCharsets.UTF_8);if(body.length>NativeRetainedAttempt.MAX_BODY)throw invalid();
            NativeAttestation.requireStoredCredentialId(credential,principal.json().getString("credential_id"));
            AuthorizedRequest request=new AuthorizedRequest(NativeRetainedAttempt.PATH,"POST",Map.of(),body);
            Map<String,String> signed;
            try{signed=NativeAttestation.requestHeaders(request,principal.json().getString("device_id"),credential,queryNonce,queryMillis);}
            finally{Arrays.fill(request.body,(byte)0);}
            return new NativeRetainedReadQuery(body,signed,target,principal,revision);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
        finally{wipe(oldBody);wipe(body);}
    }
    /** Restore exact old query body/HMAC. Never renew nonce/time or copy the
     * target into a new writer. Owner must separately verify target's original
     * signed manifest/current frozen raw values and original credential. */
    static NativeRetainedReadQuery restore(JSONObject record,NativeRetainedAttempt target,NativeProviderPrincipal principal,
        long revision,char[] credential)throws VaultFailure{
        byte[] body=null,oldBody=null;
        try{
            NativeRetainedAttempt.keys(record,"schema","principal_digest","engine_revision","target_record_sha256",
                "native_request_id","native_request_timestamp","native_request_attestation","request_body_sha256","attestation_digest","body_base64");
            for(java.util.Iterator<String> it=record.keys();it.hasNext();){String key=it.next();if(!"engine_revision".equals(key)&&!(record.get(key) instanceof String))throw invalid();}
            if(!SCHEMA.equals(record.get("schema"))||target==null||principal==null||revision<0
                ||!principal.digest.equals(record.get("principal_digest"))||!target.principalDigest.equals(principal.digest)
                ||target.engineRevision!=revision||!(record.get("engine_revision") instanceof Integer||record.get("engine_revision") instanceof Long)
                ||record.getLong("engine_revision")!=revision||!NativeRetainedAttempt.hash(target.record().toString().getBytes(StandardCharsets.UTF_8)).equals(record.get("target_record_sha256")))throw invalid();
            String nonce=record.getString("native_request_id"),timestamp=record.getString("native_request_timestamp");
            if(nonce.equals(target.requestId))throw invalid();long millis=VaultTimestamps.epochMillis(timestamp,NativeRetainedAttempt.FAILURE);
            if(!VaultTimestamps.fromEpochMillisExact(millis).equals(timestamp))throw invalid();
            body=NativeRetainedAttempt.base64(record.getString("body_base64"),NativeRetainedAttempt.MAX_BODY);
            JSONObject query=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);oldBody=target.body();
            JSONObject old=ProviderWireJson.object(oldBody,NativeRetainedAttempt.MAX_BODY);
            NativeRetainedAttempt.keys(query,"schema","operation_id","generation_id","signed_wire_base64","native_request_id","request_body_sha256","attestation_digest");
            JSONObject expected=new JSONObject().put("schema","custodial.original-native-evidence-readback.v1").put("operation_id",target.operationId)
                .put("generation_id",target.generationId).put("signed_wire_base64",old.getString("signed_wire_base64"))
                .put("native_request_id",target.requestId).put("request_body_sha256",target.bodySha256).put("attestation_digest",target.attestationDigest);
            if(!ProviderWireJson.same(expected,query))throw invalid();
            NativeAttestation.requireStoredCredentialId(credential,principal.json().getString("credential_id"));
            AuthorizedRequest request=new AuthorizedRequest(NativeRetainedAttempt.PATH,"POST",Map.of(),body);Map<String,String> signed;
            try{signed=NativeAttestation.requestHeaders(request,principal.json().getString("device_id"),credential,nonce,millis);}
            finally{wipe(request.body);}
            if(!signed.get("X-Memphis-Native-Request-Attestation").equals(record.get("native_request_attestation")))throw invalid();
            NativeRetainedReadQuery restored=new NativeRetainedReadQuery(body,signed,target,principal,revision);
            if(!restored.bodySha256.equals(record.get("request_body_sha256"))||!restored.attestationDigest.equals(record.get("attestation_digest"))){restored.close();throw invalid();}
            return restored;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
        finally{wipe(body);wipe(oldBody);}
    }
    JSONObject record()throws VaultFailure{
        requireOpen();try{return new JSONObject().put("schema",SCHEMA).put("principal_digest",principalDigest).put("engine_revision",engineRevision)
            .put("target_record_sha256",NativeRetainedAttempt.hash(targetRecord.getBytes(StandardCharsets.UTF_8)))
            .put("native_request_id",requestId).put("native_request_timestamp",timestamp)
            .put("native_request_attestation",headers.get("X-Memphis-Native-Request-Attestation"))
            .put("request_body_sha256",bodySha256).put("attestation_digest",attestationDigest)
            .put("body_base64",NativeRetainedAttempt.encodeBase64(body));}catch(Exception error){throw invalid(error);}
    }
    JSONObject targetEnvelope()throws VaultFailure{
        requireOpen();byte[] bytes=null;try{bytes=NativeRetainedAttempt.base64(new JSONObject(targetRecord).getString("body_base64"),NativeRetainedAttempt.MAX_BODY);
            return ProviderWireJson.object(bytes,NativeRetainedAttempt.MAX_BODY);}catch(Exception error){throw invalid(error);}finally{wipe(bytes);}
    }
    JSONObject targetManifest()throws VaultFailure{
        byte[] bytes=null;try{bytes=NativeRetainedAttempt.base64(targetEnvelope().getString("signed_wire_base64"),262144);
            return ProviderWireJson.object(ProviderWireJson.object(bytes,262144).getString("manifest_body").getBytes(StandardCharsets.UTF_8),131072);
        }catch(Exception error){throw invalid(error);}finally{wipe(bytes);}
    }
    byte[] body()throws VaultFailure{requireOpen();return body.clone();}
    Map<String,String> nativeHeaders()throws VaultFailure{requireOpen();return headers;}
    void requireFresh(long millis)throws VaultFailure{requireOpen();NativeRetainedAttempt.requireFresh(timestamp,millis);}
    void requireOpen()throws VaultFailure{if(closed)throw invalid();}
    @Override public void close(){Arrays.fill(body,(byte)0);closed=true;}
    private static void wipe(byte[] bytes){if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    private static VaultFailure invalid(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
    private static VaultFailure invalid(Exception error){return new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
}
