package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Map;
import java.util.HashSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Unmounted native-only attempt. No arbitrary body/path/header signer, credential
 * export, network, ACK or key-retirement API. The owner must validate its current
 * vault revision/full principal and frozen raw bytes before AND after preparation.
 * All actual wire bytes and native nonce/time are selected once, before persistence. */
final class NativeRetainedAttempt implements AutoCloseable {
    static final String PATH = "/device-auth/separation-evidence";
    static final String SCHEMA = "custodial.native-retained-prepared-attempt.v1";
    static final String FAILURE = "custodial_retained_attempt_preserved";
    static final int MAX_BODY = 393216, CHUNK_BYTES = 24576;
    final String principalDigest, operationId, generationId, requestId, timestamp;
    final String bodySha256, attestationDigest, wireSha256;
    final long engineRevision;
    private final byte[] body;
    private final Map<String,String> headers;
    private boolean closed;

    private NativeRetainedAttempt(byte[] body, Map<String,String> headers,
        NativeProviderPrincipal principal, long revision, String operation, String generation,
        String wireHash) throws VaultFailure {
        this.body=body.clone(); this.headers=VaultCollections.copyMap(headers);
        principalDigest=principal.digest; engineRevision=revision;
        operationId=operation; generationId=generation; wireSha256=wireHash;
        requestId=headers.get("X-Memphis-Native-Request-Id");
        timestamp=headers.get("X-Memphis-Native-Request-Timestamp");
        bodySha256=hash(body);
        try {
            // EXACT server request-binding digest, distinct from the HMAC transcript.
            JSONArray fields=new JSONArray().put(NativeAttestation.REQUEST_VERSION)
                .put(principal.json().getString("credential_id")).put(principal.json().getString("device_id"))
                .put("POST").put(PATH).put(bodySha256).put(requestId).put(timestamp)
                .put(headers.get("X-Memphis-Native-Request-Attestation"));
            attestationDigest=hash(fields.toString().getBytes(StandardCharsets.UTF_8));
        } catch(Exception error) { throw invalid(error); }
    }

    static NativeRetainedAttempt prepareChunk(byte[] exactSignedWire, NativeRetainedRecordValues values,
        NativeProviderPrincipal principal, long engineRevision, char[] credential,
        String operationId, String generationId, int chunkIndex, String actualNonce, long actualMillis)
        throws VaultFailure {
        byte[] all=null, part=null, body=null;
        try {
            if(values==null || principal==null || engineRevision<0 || exactSignedWire==null
                || exactSignedWire.length<1 || exactSignedWire.length>262144) throw invalid();
            uuid(operationId); uuid(generationId); uuid(actualNonce);
            JSONObject wire=ProviderWireJson.object(exactSignedWire,262144);
            // Parsing a wire or a principal alone never admits a record. Verify the
            // original signed manifest against the exact native snapshot/credential.
            NativeSeparationEvidence.restore(wire,principal,values.snapshot(),credential);
            all=values.bytes();
            int count=(all.length+CHUNK_BYTES-1)/CHUNK_BYTES;
            if(all.length<1 || all.length>NativeRetainedRecordValues.MAX_BYTES || chunkIndex<0 || chunkIndex>=count) throw invalid();
            part=Arrays.copyOfRange(all,chunkIndex*CHUNK_BYTES,Math.min(all.length,(chunkIndex+1)*CHUNK_BYTES));
            JSONObject envelope=new JSONObject().put("schema","custodial.original-native-value-chunk-intake.v1")
                .put("operation_id",operationId).put("generation_id",generationId)
                .put("signed_wire_base64",encodeBase64(exactSignedWire))
                .put("value_bytes",Integer.toString(all.length)).put("value_sha256",values.sha256)
                .put("chunk_index",Integer.toString(chunkIndex)).put("chunk_count",Integer.toString(count))
                .put("chunk_base64",encodeBase64(part)).put("chunk_sha256",hash(part));
            body=envelope.toString().getBytes(StandardCharsets.UTF_8);
            if(body.length>MAX_BODY) throw invalid();
            AuthorizedRequest request=new AuthorizedRequest(PATH,"POST",Map.of(),body);
            Map<String,String> headers;
            try { headers=NativeAttestation.requestHeaders(request,principal.json().getString("device_id"),credential,actualNonce,actualMillis); }
            finally { Arrays.fill(request.body,(byte)0); }
            return new NativeRetainedAttempt(body,headers,principal,engineRevision,operationId,generationId,hash(exactSignedWire));
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
        finally { wipe(all); wipe(part); wipe(body); }
    }

    /** Revalidate exact persisted body, original manifest/values and actual old
     * HMAC; never reserialize that body, mint a nonce or refresh its timestamp. */
    static NativeRetainedAttempt restore(JSONObject record, NativeRetainedRecordValues values,
        NativeProviderPrincipal principal, long revision, char[] credential) throws VaultFailure {
        byte[] body=null, wire=null, expectedPart=null, all=null;
        try {
            keys(record,"schema","principal_digest","engine_revision","operation_id","generation_id",
                "native_request_id","native_request_timestamp","request_body_sha256","attestation_digest",
                "wire_sha256","native_request_attestation","body_base64");
            if(!SCHEMA.equals(record.get("schema")) || values==null || principal==null
                || !principal.digest.equals(record.get("principal_digest")) || revision<0
                || !(record.get("engine_revision") instanceof Integer || record.get("engine_revision") instanceof Long)
                || record.getLong("engine_revision")!=revision) throw invalid();
            for(String key:names(record)) if(!key.equals("engine_revision") && !(record.get(key) instanceof String)) throw invalid();
            String operation=record.getString("operation_id"),generation=record.getString("generation_id"),nonce=record.getString("native_request_id");
            uuid(operation);uuid(generation);uuid(nonce);
            String stamp=record.getString("native_request_timestamp");
            long millis=VaultTimestamps.epochMillis(stamp,FAILURE);
            if(!VaultTimestamps.fromEpochMillisExact(millis).equals(stamp)) throw invalid();
            body=base64(record.getString("body_base64"),MAX_BODY);
            JSONObject envelope=ProviderWireJson.object(body,MAX_BODY);
            keys(envelope,"schema","operation_id","generation_id","signed_wire_base64","value_bytes","value_sha256",
                "chunk_index","chunk_count","chunk_base64","chunk_sha256");
            for(String key:names(envelope)) if(!(envelope.get(key) instanceof String)) throw invalid();
            if(!"custodial.original-native-value-chunk-intake.v1".equals(envelope.get("schema"))
                || !operation.equals(envelope.get("operation_id")) || !generation.equals(envelope.get("generation_id"))) throw invalid();
            wire=base64(envelope.getString("signed_wire_base64"),262144);
            NativeSeparationEvidence.restore(ProviderWireJson.object(wire,262144),principal,values.snapshot(),credential);
            all=values.bytes();int count=(all.length+CHUNK_BYTES-1)/CHUNK_BYTES;
            String indexText=envelope.getString("chunk_index");
            if(!indexText.matches("(?:0|[1-9][0-9]{0,7})")) throw invalid();
            int index=Integer.parseInt(indexText);
            if(index>=count || !Integer.toString(all.length).equals(envelope.get("value_bytes"))
                || !values.sha256.equals(envelope.get("value_sha256")) || !Integer.toString(count).equals(envelope.get("chunk_count"))) throw invalid();
            expectedPart=Arrays.copyOfRange(all,index*CHUNK_BYTES,Math.min(all.length,(index+1)*CHUNK_BYTES));
            if(!encodeBase64(expectedPart).equals(envelope.get("chunk_base64"))
                || !hash(expectedPart).equals(envelope.get("chunk_sha256")) || !hash(wire).equals(record.get("wire_sha256"))) throw invalid();
            AuthorizedRequest request=new AuthorizedRequest(PATH,"POST",Map.of(),body);
            Map<String,String> actual;
            try { actual=NativeAttestation.requestHeaders(request,principal.json().getString("device_id"),credential,nonce,millis); }
            finally { wipe(request.body); }
            if(!equal(actual.get("X-Memphis-Native-Request-Attestation"),record.getString("native_request_attestation"))) throw invalid();
            NativeRetainedAttempt restored=new NativeRetainedAttempt(body,actual,principal,revision,operation,generation,hash(wire));
            if(!restored.bodySha256.equals(record.get("request_body_sha256")) || !restored.attestationDigest.equals(record.get("attestation_digest"))) {
                restored.close();throw invalid();
            }
            return restored;
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
        finally { wipe(body);wipe(wire);wipe(expectedPart);wipe(all); }
    }

    JSONObject record() throws VaultFailure {
        requireOpen();
        try { return new JSONObject().put("schema",SCHEMA).put("principal_digest",principalDigest).put("engine_revision",engineRevision)
            .put("operation_id",operationId).put("generation_id",generationId).put("native_request_id",requestId)
            .put("native_request_timestamp",timestamp).put("request_body_sha256",bodySha256).put("attestation_digest",attestationDigest)
            .put("wire_sha256",wireSha256).put("native_request_attestation",headers.get("X-Memphis-Native-Request-Attestation"))
            .put("body_base64",encodeBase64(body)); }
        catch(Exception error) { throw invalid(error); }
    }
    byte[] body() throws VaultFailure { requireOpen();return body.clone(); }
    Map<String,String> nativeHeaders() throws VaultFailure { requireOpen();return headers; }
    int chunkIndex() throws VaultFailure {
        requireOpen();try{return Integer.parseInt(ProviderWireJson.object(body,MAX_BODY).getString("chunk_index"));}
        catch(Exception error){throw invalid(error);}
    }
    void requireFresh(long nowMillis) throws VaultFailure {
        requireOpen();requireFresh(timestamp,nowMillis);
    }
    static void requireFresh(String timestamp,long nowMillis) throws VaultFailure {
        try {long age=Math.subtractExact(nowMillis,VaultTimestamps.epochMillis(timestamp,FAILURE));
            // Same server freshness window. Client check never renews/extends
            // it or supplies provider clock/physical qualification authority.
            if(age>120000L || age< -15000L)throw invalid();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
    }
    void requireOpen() throws VaultFailure { if(closed) throw invalid(); }
    @Override public void close() { Arrays.fill(body,(byte)0);closed=true; }
    static void keys(JSONObject value,String... required) throws VaultFailure {
        if(value==null || !names(value).equals(new HashSet<>(Arrays.asList(required)))) throw invalid();
    }
    private static java.util.Set<String> names(JSONObject value) {
        java.util.Set<String> out=new HashSet<>();for(java.util.Iterator<String> it=value.keys();it.hasNext();) out.add(it.next());return out;
    }
    // RFC4648 standard padded ASCII codec, without a new Android/JDK library
    // dependency. Decoding rejects whitespace, alternate alphabets/pad bits.
    private static final String ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    static String encodeBase64(byte[] input) {
        char[] out=new char[4*((input.length+2)/3)];int at=0;
        for(int i=0;i<input.length;i+=3) {
            int a=input[i]&255,b=i+1<input.length?input[i+1]&255:0,c=i+2<input.length?input[i+2]&255:0;
            out[at++]=ALPHABET.charAt(a>>>2);out[at++]=ALPHABET.charAt(((a&3)<<4)|(b>>>4));
            out[at++]=i+1<input.length?ALPHABET.charAt(((b&15)<<2)|(c>>>6)):'=';
            out[at++]=i+2<input.length?ALPHABET.charAt(c&63):'=';
        }
        return new String(out);
    }
    static byte[] base64(String value,int cap) throws VaultFailure {
        if(cap<1 || cap>MAX_BODY || value==null || value.length()<1 || value.length()>4*((cap+2)/3)
            || (value.length()&3)!=0 || !value.matches("[A-Za-z0-9+/]+={0,2}")) throw invalid();
        int padding=value.endsWith("==")?2:value.endsWith("=")?1:0;
        int size=(value.length()/4)*3-padding;if(size<1 || size>cap)throw invalid();byte[] bytes=new byte[size];int at=0;
        for(int i=0;i<value.length();i+=4) {
            int a=ALPHABET.indexOf(value.charAt(i)),b=ALPHABET.indexOf(value.charAt(i+1));
            int c=value.charAt(i+2)=='='?0:ALPHABET.indexOf(value.charAt(i+2)),d=value.charAt(i+3)=='='?0:ALPHABET.indexOf(value.charAt(i+3));
            bytes[at++]=(byte)((a<<2)|(b>>>4));
            if(at<size)bytes[at++]=(byte)((b<<4)|(c>>>2));if(at<size)bytes[at++]=(byte)((c<<6)|d);
        }
        if(!encodeBase64(bytes).equals(value)) { wipe(bytes);throw invalid(); }return bytes;
    }
    private static void uuid(String value) throws VaultFailure {
        if(value==null || !value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")) throw invalid();
    }
    static String hash(byte[] bytes) throws VaultFailure {
        try { byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder out=new StringBuilder(64);
            for(byte b:digest) out.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));return out.toString();
        } catch(Exception error) { throw invalid(error); }
    }
    private static boolean equal(String first,String second) { return first!=null && second!=null && MessageDigest.isEqual(
        first.getBytes(StandardCharsets.US_ASCII),second.getBytes(StandardCharsets.US_ASCII)); }
    private static void wipe(byte[] bytes) { if(bytes!=null) Arrays.fill(bytes,(byte)0); }
    private static VaultFailure invalid() { return new VaultFailure(FAILURE); }
    private static VaultFailure invalid(Exception error) { return new VaultFailure(FAILURE,error); }
}
