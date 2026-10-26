package org.memphiszoo.custodial.vault;

import org.json.JSONObject;

/** Immutable native-only signed RAW snapshot evidence, not a semantic inventory
 * ACK, eligibility proof or permission to finalize/reuse a phone. The body is
 * transported/persisted byte-for-byte; verifiers hash it without reserialization.
 */
final class NativeSeparationEvidence {
    static final String VERSION="custodial-native-protected-snapshot.v1";
    final String body,bodySha256,signature,rawSnapshotDigest;
    private NativeSeparationEvidence(String body,String digest,String signature,String rawDigest){
        this.body=body;bodySha256=digest;this.signature=signature;rawSnapshotDigest=rawDigest;
    }
    static NativeSeparationEvidence sign(NativeSeparationContext context,NativeProtectedWorkSnapshot snapshot,
        char[] credential)throws VaultFailure{
        try{
            if(context==null||snapshot==null)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            String body=snapshot.manifest(context).toString();
            if(body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>131072)
                throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            String digest=NativeProviderPrincipal.hash(body);
            return new NativeSeparationEvidence(body,digest,
                NativeAttestation.protectedSnapshotSignature(context,digest,credential),snapshot.digest);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    /** Read-only restart validation. No HTTP result is fabricated and no record
     * is re-signed/rebound. Parsing alone is never retained authority. */
    static NativeSeparationEvidence restore(JSONObject wire,NativeProviderPrincipal principal,
        NativeProtectedWorkSnapshot snapshot,char[] credential)throws VaultFailure{
        try{
            if(wire==null||wire.length()!=4||principal==null||snapshot==null
                ||!VERSION.equals(wire.get("attestation_version")))throw invalid();
            for(String key:new String[]{"manifest_body","manifest_sha256","attestation"})
                if(!(wire.get(key) instanceof String))throw invalid();
            String body=(String)wire.get("manifest_body"),digest=(String)wire.get("manifest_sha256"),signature=(String)wire.get("attestation");
            if(!digest.matches("[a-f0-9]{64}")||!signature.matches("[a-f0-9]{64}"))throw invalid();
            byte[] bytes=body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            JSONObject manifest=ProviderWireJson.object(bytes,131072);
            if(!digest.equals(NativeProviderPrincipal.hash(body)))throw invalid();
            NativeSeparationContext context=NativeSeparationContext.validateRetainedData(manifest.getJSONObject("separation_context"),principal);
            if(!ProviderWireJson.same(manifest,snapshot.manifest(context)))throw invalid();
            String expected=NativeAttestation.protectedSnapshotSignature(context,digest,credential);
            if(!java.security.MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                signature.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))throw invalid();
            return new NativeSeparationEvidence(body,digest,signature,snapshot.digest);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    JSONObject json()throws VaultFailure{
        try{return new JSONObject().put("attestation_version",VERSION).put("manifest_body",body)
            .put("manifest_sha256",bodySha256).put("attestation",signature);}
        catch(Exception error){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,error);}
    }
    private static VaultFailure invalid(){return new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);}
}
