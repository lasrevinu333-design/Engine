package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

/** Server acceptance captured only at the native, authenticated HTTPS boundary. */
final class NativeCompletionJournal {
    static final String FAILURE = "custodial_native_server_receipt_required";
    private static final String LEGACY_RECEIPT_SCHEMA = "native-server-completion.v2";
    private static final String RECEIPT_SCHEMA = "native-server-completion.v3";
    static final String FIXED_READ_CAPTURE_PROTOCOL = "native-server-completion-fixed-read.v1";
    private static final String FIXED_READ_RECEIPT_SCHEMA = FIXED_READ_CAPTURE_PROTOCOL;
    static final String FIXED_READ_PATH = "/scan-api/original-completion";
    private static final String SERVER_READ_SCHEMA = "custodial.original-completion-readback.v1";
    // Lossless bounded envelope: UTF-8 request, base64 expansion, result and
    // fixed-read response all have separate bounds. Legacy receipts still read.
    static final int MAX_RECORD = 1024*1024;
    static final int MAX_BODY_BYTES = 256*1024;
    static final int MAX_RESULT_BYTES = 64*1024;
    static final String CAPACITY = "custodial_native_server_receipt_capacity";
    /** Main's lexical actual-TLS owner only: no PluginMethod/JSON factory.
     * requireCurrent returns the independently private native principal after
     * checking the captured active vault revision and ordinary WORK admission.
     * requireAuthenticatedRead binds THESE actual request/response objects to
     * that same HTTPS operation. Main must hold its engine lock across capture;
     * a name/implementation of this interface alone is NOT authentication. */
    interface FixedReadOwner {
        NativeProviderPrincipal requireCurrent() throws VaultFailure;
        void requireAuthenticatedRead(AuthorizedRequest request,AuthorizedResponse response) throws VaultFailure;
    }
    /** Feature version ONLY. Main must supply its genuinely mounted lexical
     * owner; this cannot prove TLS/acceptance or substitute for capture. */
    static String fixedReadCaptureProtocol(FixedReadOwner mountedOwner){
        try{return mountedOwner!=null&&mountedOwner.requireCurrent()!=null?FIXED_READ_CAPTURE_PROTOCOL:null;}
        catch(VaultFailure unavailable){return null;}
    }
    interface Store {
        String loadCompletionReceipt(String key) throws VaultFailure;
        void saveCompletionReceipt(String key, String value) throws VaultFailure;
        void deleteCompletionReceipt(String key) throws VaultFailure;
        default void requireCompletionCapacity(String key,int maximumReceiptCharacters) throws VaultFailure {
            throw new VaultFailure(CAPACITY);
        }
    }
    private final Store store;
    NativeCompletionJournal(Store store) { this.store = store; }

    // Called by the native dispatcher before HTTPS, not after remote acceptance.
    // This is only storage capacity, never server acceptance or resend authority.
    synchronized void preflight(String device,AuthorizedRequest request)throws VaultFailure {
        if(!isCompletionRequest(request))return;
        try {
            if(request.body.length>MAX_BODY_BYTES)throw new VaultFailure(CAPACITY);
            JSONObject wire=ProviderWireJson.object(request.body,MAX_BODY_BYTES);
            JSONObject args=wire.getJSONObject(FIXED_READ_PATH.equals(request.path)?"completion_payload":"args");
            if(!FIXED_READ_PATH.equals(request.path))requireRequestEnvelope(wire,device);
            String sourceKey=key(device,args);
            if(store.loadCompletionReceipt(sourceKey)!=null)return; // valid old receipt is not re-sized or replaced
            // Reserve for both exact base64 bodies, escaped result and metadata.
            int maximum=2*((request.body.length+2)/3*4)+4*MAX_RESULT_BYTES+32768;
            if(maximum>MAX_RECORD)throw new VaultFailure(CAPACITY);
            store.requireCompletionCapacity(sourceKey,maximum);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(CAPACITY,e);}
    }

    static boolean isCompletionRequest(AuthorizedRequest request) {
        if (request!=null && FIXED_READ_PATH.equals(request.path) && "POST".equals(request.method)) return true;
        if (!"/scan-api/rpc".equals(request.path) || !"POST".equalsIgnoreCase(request.method)) return false;
        try { return "tool_commit_cleaning_workflow".equals(new JSONObject(
            new String(request.body,StandardCharsets.UTF_8)).optString("fn")); }
        catch (Exception error) { return false; }
    }

    // Never expose this method as a PluginMethod. Its response comes from VaultEngine.
    synchronized void captureAuthenticatedResponse(String device, AuthorizedRequest request,
            AuthorizedResponse response) throws VaultFailure {
        if (FIXED_READ_PATH.equals(request.path)) throw new VaultFailure(FAILURE); // no private owner in this old signature
        if (!"/scan-api/rpc".equals(request.path)
            || !"POST".equalsIgnoreCase(request.method) || response.status < 200 || response.status >= 300) return;
        byte[] originalBody = request.body.clone();
        try {
            JSONObject envelope = ProviderWireJson.object(originalBody, RequestPolicy.MAX_REQUEST_BYTES);
            if (!"tool_commit_cleaning_workflow".equals(envelope.optString("fn"))) return;
            JSONObject received = ProviderWireJson.object(response.body, 8*1024*1024); // Owning HTTPS response bound, not a new smaller gate.
            if (!Boolean.TRUE.equals(received.opt("ok"))) return;
            JSONObject result = received.optJSONObject("data");
            if (result == null || !"closed".equals(result.optString("status"))) return;
            JSONObject args = envelope.getJSONObject("args");
            requireRequestEnvelope(envelope, device);
            requireResult(args, result);
            if(canonical(result).getBytes(StandardCharsets.UTF_8).length>MAX_RESULT_BYTES)throw new VaultFailure(CAPACITY);
            String expectedBinding=binding(device,args), key=key(device,args), prior=store.loadCompletionReceipt(key);
            if (prior != null) {
                // Existing exact v2/v3 receipts are resolved BEFORE new-body
                // capacity checks. Never break a valid legacy replay because
                // its original request values were not retained by that schema.
                try (RetainedOriginalRequest existing = inspectRetainedOriginalRequest(device, key, prior)) {
                    if (!expectedBinding.equals(existing.binding)) throw new VaultFailure(FAILURE);
                    requireResult(args, existing.result());
                }
                if (!Arrays.equals(originalBody, request.body)) throw new VaultFailure(FAILURE);
                return; // First receipt/body and original times stay byte-identical.
            }
            if(originalBody.length>MAX_BODY_BYTES)throw new VaultFailure(CAPACITY); // Never truncate an original.
            JSONObject record = new JSONObject();
            record.put("schema_version", RECEIPT_SCHEMA);
            record.put("binding_sha256", expectedBinding);
            record.put("result", result);
            // Preserve actual original values/representation, not just a digest.
            // This is the native captured BODY, NOT generated transport headers,
            // credential values, a new signature or current server-row proof.
            record.put("original_request_body_base64", NativeRetainedAttempt.encodeBase64(originalBody));
            record.put("original_request_body_sha256", NativeRetainedAttempt.hash(originalBody));
            String encoded = canonical(record);
            if (encoded.length() > MAX_RECORD || !Arrays.equals(originalBody, request.body)) throw new VaultFailure(FAILURE);
            if (!Arrays.equals(originalBody, request.body)) throw new VaultFailure(FAILURE);
            store.saveCompletionReceipt(key, encoded);
            if (!encoded.equals(store.loadCompletionReceipt(key)) || !Arrays.equals(originalBody, request.body)) throw new VaultFailure(FAILURE);
        } catch (VaultFailure error) { if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error); }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
        finally { Arrays.fill(originalBody, (byte) 0); }
    }

    synchronized void captureAuthenticatedResponse(String device,AuthorizedRequest request,AuthorizedResponse response,
            FixedReadOwner owner)throws VaultFailure {
        if(request==null||response==null)throw new VaultFailure(FAILURE);
        if(!FIXED_READ_PATH.equals(request.path)){captureAuthenticatedResponse(device,request,response);return;}
        byte[] body=null,reply=null;
        try{
            if(!"POST".equals(request.method))throw new VaultFailure(FAILURE);
            if(response.status!=200)return;
            body=request.body.clone();reply=response.body.clone();
            NativeProviderPrincipal principal=requireReadOwner(owner,device);
            owner.requireAuthenticatedRead(request,response);
            JSONObject read=ProviderWireJson.object(body,1024*1024);
            NativeRetainedAttempt.keys(read,"completion_payload");
            JSONObject args=read.getJSONObject("completion_payload");
            JSONObject wire=ProviderWireJson.object(reply,8*1024*1024);NativeRetainedAttempt.keys(wire,"ok","data");
            if(!Boolean.TRUE.equals(wire.opt("ok")))return;
            JSONObject data=wire.getJSONObject("data");
            if(Boolean.FALSE.equals(data.opt("found"))){NativeRetainedAttempt.keys(data,"found");return;}
            NativeRetainedAttempt.keys(data,"schema","found","result","readback");
            if(!SERVER_READ_SCHEMA.equals(data.get("schema"))||!Boolean.TRUE.equals(data.get("found")))throw new VaultFailure(FAILURE);
            JSONObject result=data.getJSONObject("result"),readback=data.getJSONObject("readback");
            requireFixedReadRelationship(device,args,result,readback,principal);
            String expected=binding(device,args),sourceKey=key(device,args),prior=store.loadCompletionReceipt(sourceKey);
            if(prior!=null){
                try(RetainedOriginalRequest existing=inspectRetainedOriginalRequest(device,sourceKey,prior)){
                    if(!expected.equals(existing.binding))throw new VaultFailure(FAILURE);
                    requireResult(args,existing.result());
                    if(existing.fixedReadValuesAvailable&&!existing.readPrincipal.same(principal))throw new VaultFailure(FAILURE);
                }
                requireSameReadOwner(owner,principal,device,request,response);
                requireUnchangedRead(body,reply,request,response);
                return; // Never upgrade/replace old v2/v3 or alter first acceptance times.
            }
            if(body.length>MAX_BODY_BYTES||reply.length>MAX_BODY_BYTES
                ||canonical(result).getBytes(StandardCharsets.UTF_8).length>MAX_RESULT_BYTES)throw new VaultFailure(CAPACITY);
            JSONObject provenance=new JSONObject().put("purpose","AUTHENTICATED_FIXED_ORIGINAL_COMPLETION_READ")
                .put("path",FIXED_READ_PATH).put("method","POST").put("original_write_wire_state","UNKNOWN");
            JSONObject record=new JSONObject().put("schema_version",FIXED_READ_RECEIPT_SCHEMA).put("binding_sha256",expected)
                .put("result",result).put("readback",readback).put("native_principal",principal.json()).put("provenance",provenance)
                .put("read_request_body_base64",NativeRetainedAttempt.encodeBase64(body)).put("read_request_body_sha256",NativeRetainedAttempt.hash(body))
                .put("read_response_body_base64",NativeRetainedAttempt.encodeBase64(reply)).put("read_response_body_sha256",NativeRetainedAttempt.hash(reply));
            String encoded=canonical(record);if(encoded.length()>MAX_RECORD)throw new VaultFailure(FAILURE);
            requireSameReadOwner(owner,principal,device,request,response);
            requireUnchangedRead(body,reply,request,response);
            store.saveCompletionReceipt(sourceKey,encoded);
            if(!encoded.equals(store.loadCompletionReceipt(sourceKey)))throw new VaultFailure(FAILURE);
            requireUnchangedRead(body,reply,request,response);
            if(!principal.same(requireReadOwner(owner,device)))throw new VaultFailure(FAILURE);
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(body!=null)Arrays.fill(body,(byte)0);if(reply!=null)Arrays.fill(reply,(byte)0);}
    }
    private static NativeProviderPrincipal requireReadOwner(FixedReadOwner owner,String device)throws VaultFailure {
        if(owner==null)throw new VaultFailure(FAILURE);
        NativeProviderPrincipal principal=owner.requireCurrent();
        if(principal==null||!VaultValidation.deviceId(device).equals(principal.json().opt("device_id")))throw new VaultFailure(FAILURE);
        return principal;
    }
    private static void requireSameReadOwner(FixedReadOwner owner,NativeProviderPrincipal principal,String device,
            AuthorizedRequest request,AuthorizedResponse response)throws VaultFailure {
        if(!principal.same(requireReadOwner(owner,device)))throw new VaultFailure(FAILURE);
        owner.requireAuthenticatedRead(request,response);
    }
    private static void requireUnchangedRead(byte[] body,byte[] reply,AuthorizedRequest request,AuthorizedResponse response)throws VaultFailure {
        if(!Arrays.equals(body,request.body)||!Arrays.equals(reply,response.body))throw new VaultFailure(FAILURE);
    }

    synchronized JSONObject recover(String device, JSONObject args) throws VaultFailure {
        return recover(device,args,null);
    }
    synchronized JSONObject recover(String device,JSONObject args,FixedReadOwner owner)throws VaultFailure {
        try {
            String sourceKey = key(device, args), encoded = store.loadCompletionReceipt(sourceKey);
            if (encoded == null) return null;
            NativeProviderPrincipal current=owner==null?null:requireReadOwner(owner,device);
            try (RetainedOriginalRequest receipt = inspectRetainedOriginalRequest(device, sourceKey, encoded)) {
                if(receipt.fixedReadValuesAvailable&&(current==null||!receipt.readPrincipal.same(current)))throw new VaultFailure(FAILURE);
                String expectedBinding = binding(device, args);
                if (!expectedBinding.equals(receipt.binding)) throw new VaultFailure(FAILURE);
                JSONObject result = receipt.result(); requireResult(args, result);
                if(receipt.fixedReadValuesAvailable&&!current.same(requireReadOwner(owner,device)))throw new VaultFailure(FAILURE);
                return result;
            }
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    synchronized void requireAccepted(String device, JSONObject args) throws VaultFailure {
        if (recover(device, args) == null) throw new VaultFailure(FAILURE);
    }
    synchronized void requireAccepted(String device,JSONObject args,FixedReadOwner owner)throws VaultFailure {
        if(recover(device,args,owner)==null)throw new VaultFailure(FAILURE);
    }

    synchronized void retireAfterQueueRemoval(String device, JSONObject args) throws VaultFailure {
        if (recover(device, args) == null) return;
        store.deleteCompletionReceipt(key(device, args));
        if (store.loadCompletionReceipt(key(device, args)) != null) throw new VaultFailure(FAILURE);
    }

    synchronized void retireAfterQueueRemoval(String device,JSONObject args,FixedReadOwner owner)throws VaultFailure {
        if(recover(device,args,owner)==null)return;
        store.deleteCompletionReceipt(key(device,args));
        if(store.loadCompletionReceipt(key(device,args))!=null)throw new VaultFailure(FAILURE);
    }

    /** Purpose-specific native value observation, NOT an acceptance capability.
     * Use only with a receiver-owned captured/decrypted receipt. Shape/digest
     * validation cannot authenticate caller JSON or prove current SQL, cutoff,
     * original employee/credential or semantic inventory. No PluginMethod. */
    static final class RetainedOriginalRequest implements AutoCloseable {
        private byte[] body;
        private byte[] readBody,readReply;
        private NativeProviderPrincipal readPrincipal;
        private final String resultEncoded;
        private boolean closed;
        private final String binding;
        final String state, requestBodySha256;
        final boolean originalValuesAvailable;
        final boolean fixedReadValuesAvailable;
        final String readRequestBodySha256,readResponseBodySha256;
        final boolean workAccepted=false, inventoryAcknowledged=false, keyRemovalAllowed=false;
        private RetainedOriginalRequest(String binding, JSONObject result, byte[] body, String bodyHash) {
            this.binding=binding;resultEncoded=result.toString();this.body=body==null?null:body.clone();requestBodySha256=bodyHash;
            originalValuesAvailable=body!=null;
            fixedReadValuesAvailable=false;readRequestBodySha256=null;readResponseBodySha256=null;
            state=originalValuesAvailable?"ORIGINAL_REQUEST_VALUES_RETAINED_UNVERIFIED":"LEGACY_BINDING_ONLY_ORIGINAL_REQUEST_UNAVAILABLE";
        }
        private RetainedOriginalRequest(String binding,JSONObject result,byte[] readBody,byte[] readReply,
                NativeProviderPrincipal principal,String readHash,String replyHash){
            this.binding=binding;resultEncoded=result.toString();body=null;requestBodySha256=null;originalValuesAvailable=false;
            this.readBody=readBody.clone();this.readReply=readReply.clone();this.readPrincipal=principal;
            fixedReadValuesAvailable=true;readRequestBodySha256=readHash;readResponseBodySha256=replyHash;
            state="FIXED_READ_VALUES_RETAINED_ORIGINAL_WRITE_WIRE_UNKNOWN";
        }
        synchronized byte[] fixedReadBody()throws VaultFailure{if(closed||readBody==null)throw new VaultFailure(FAILURE);return readBody.clone();}
        synchronized byte[] fixedReadResponseBody()throws VaultFailure{if(closed||readReply==null)throw new VaultFailure(FAILURE);return readReply.clone();}
        synchronized JSONObject fixedReadArgs()throws VaultFailure{
            if(closed||readBody==null)throw new VaultFailure(FAILURE);
            try{return ProviderWireJson.object(readBody,MAX_RECORD).getJSONObject("completion_payload");}
            catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        /** Rejection-only comparison against the authenticated frozen owner.
         * Does not return a principal, refresh a read or grant acceptance. */
        synchronized boolean fixedReadMatchesOriginalPrincipal(NativeProviderPrincipal original)throws VaultFailure {
            if(closed||!fixedReadValuesAvailable||readPrincipal==null||original==null)throw new VaultFailure(FAILURE);
            return readPrincipal.same(original);
        }
        synchronized byte[] originalBody() throws VaultFailure { requireValues(); return body.clone(); }
        synchronized JSONObject originalArgs() throws VaultFailure {
            requireValues();try{return ProviderWireJson.object(body,MAX_RECORD).getJSONObject("args");}
            catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        private synchronized JSONObject result() throws VaultFailure {
            if(closed)throw new VaultFailure(FAILURE);try{return new JSONObject(resultEncoded);}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        private void requireValues() throws VaultFailure { if(closed||body==null)throw new VaultFailure(FAILURE); }
        public synchronized void close() { if(body!=null)Arrays.fill(body,(byte)0);if(readBody!=null)Arrays.fill(readBody,(byte)0);
            if(readReply!=null)Arrays.fill(readReply,(byte)0);body=null;readBody=null;readReply=null;readPrincipal=null;closed=true; }
    }
    static RetainedOriginalRequest inspectRetainedOriginalRequest(String device,String sourceKey,String encoded) throws VaultFailure {
        byte[] body=null,recordBytes=null;
        try {
            if(sourceKey==null||!sourceKey.matches("[a-f0-9]{64}")||encoded==null||encoded.length()>MAX_RECORD)throw new VaultFailure(FAILURE);
            if(!device.equals(VaultValidation.deviceId(device)))throw new VaultFailure(FAILURE);
            java.nio.ByteBuffer bytes=StandardCharsets.UTF_8.newEncoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(encoded));
            try{recordBytes=new byte[bytes.remaining()];bytes.get(recordBytes);}finally{if(bytes.hasArray())Arrays.fill(bytes.array(),(byte)0);}
            JSONObject record=ProviderWireJson.object(recordBytes,4*MAX_RECORD);
            if(FIXED_READ_RECEIPT_SCHEMA.equals(record.opt("schema_version")))return inspectFixedReadRecord(device,sourceKey,record);
            boolean original=RECEIPT_SCHEMA.equals(record.get("schema_version"));
            if(!(original||LEGACY_RECEIPT_SCHEMA.equals(record.get("schema_version"))))throw new VaultFailure(FAILURE);
            if(original)NativeRetainedAttempt.keys(record,"schema_version","binding_sha256","result","original_request_body_base64","original_request_body_sha256");
            else NativeRetainedAttempt.keys(record,"schema_version","binding_sha256","result");
            String binding=text(record,"binding_sha256");if(!binding.matches("[a-f0-9]{64}"))throw new VaultFailure(FAILURE);
            JSONObject result=record.getJSONObject("result");
            if(!"closed".equals(result.get("status")))throw new VaultFailure(FAILURE);
            String session=uuid(result,"client_session_id"),completion=uuid(result,"client_completion_id");
            if(!sourceKey.equals(sha256(device+"|"+session+"|"+completion)))throw new VaultFailure(FAILURE);
            String bodyHash=null;
            if(original) {
                String exact=text(record,"original_request_body_base64");body=NativeRetainedAttempt.base64(exact,MAX_BODY_BYTES);
                bodyHash=text(record,"original_request_body_sha256");
                if(!bodyHash.matches("[a-f0-9]{64}")||!bodyHash.equals(NativeRetainedAttempt.hash(body)))throw new VaultFailure(FAILURE);
                JSONObject request=ProviderWireJson.object(body,MAX_RECORD);requireRequestEnvelope(request,device);
                JSONObject args=request.getJSONObject("args");
                if(!sourceKey.equals(key(device,args))||!binding.equals(binding(device,args)))throw new VaultFailure(FAILURE);
                requireResult(args,result);
            }
            return new RetainedOriginalRequest(binding,result,body,bodyHash);
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(body!=null)Arrays.fill(body,(byte)0);if(recordBytes!=null)Arrays.fill(recordBytes,(byte)0);}
    }
    private static RetainedOriginalRequest inspectFixedReadRecord(String device,String sourceKey,JSONObject record)throws VaultFailure {
        byte[] read=null,reply=null;
        try{
            NativeRetainedAttempt.keys(record,"schema_version","binding_sha256","result","readback","native_principal","provenance",
                "read_request_body_base64","read_request_body_sha256","read_response_body_base64","read_response_body_sha256");
            JSONObject provenance=record.getJSONObject("provenance");
            NativeRetainedAttempt.keys(provenance,"purpose","path","method","original_write_wire_state");
            if(!"AUTHENTICATED_FIXED_ORIGINAL_COMPLETION_READ".equals(provenance.get("purpose"))
                ||!FIXED_READ_PATH.equals(provenance.get("path"))||!"POST".equals(provenance.get("method"))
                ||!"UNKNOWN".equals(provenance.get("original_write_wire_state")))throw new VaultFailure(FAILURE);
            read=NativeRetainedAttempt.base64(text(record,"read_request_body_base64"),MAX_BODY_BYTES);
            reply=NativeRetainedAttempt.base64(text(record,"read_response_body_base64"),MAX_BODY_BYTES);
            String readHash=text(record,"read_request_body_sha256"),replyHash=text(record,"read_response_body_sha256");
            if(!readHash.equals(NativeRetainedAttempt.hash(read))||!replyHash.equals(NativeRetainedAttempt.hash(reply)))throw new VaultFailure(FAILURE);
            JSONObject request=ProviderWireJson.object(read,MAX_RECORD);NativeRetainedAttempt.keys(request,"completion_payload");
            JSONObject wire=ProviderWireJson.object(reply,MAX_RECORD);NativeRetainedAttempt.keys(wire,"ok","data");
            if(!Boolean.TRUE.equals(wire.get("ok")))throw new VaultFailure(FAILURE);
            JSONObject data=wire.getJSONObject("data");NativeRetainedAttempt.keys(data,"schema","found","result","readback");
            if(!SERVER_READ_SCHEMA.equals(data.get("schema"))||!Boolean.TRUE.equals(data.get("found")))throw new VaultFailure(FAILURE);
            JSONObject args=request.getJSONObject("completion_payload"),result=record.getJSONObject("result"),readback=record.getJSONObject("readback");
            if(!canonical(result).equals(canonical(data.getJSONObject("result")))||!canonical(readback).equals(canonical(data.getJSONObject("readback"))))throw new VaultFailure(FAILURE);
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("native_principal"));
            requireFixedReadRelationship(device,args,result,readback,principal);
            String binding=text(record,"binding_sha256");
            if(!sourceKey.equals(key(device,args))||!binding.equals(binding(device,args)))throw new VaultFailure(FAILURE);
            return new RetainedOriginalRequest(binding,result,read,reply,principal,readHash,replyHash);
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(read!=null)Arrays.fill(read,(byte)0);if(reply!=null)Arrays.fill(reply,(byte)0);}
    }
    private static void requireFixedReadRelationship(String device,JSONObject args,JSONObject result,JSONObject readback,
            NativeProviderPrincipal principal)throws VaultFailure {
        try{
            if(principal==null)throw new VaultFailure(FAILURE);
            java.util.Set<String> allowed=java.util.Set.of("p_device_id","p_client_session_id","p_client_completion_id","p_location_code",
                "p_client_started_at","p_client_ended_at","p_response_json","p_scan_evidence","p_correlation_id",
                "p_native_finish_scan_entry_id","p_native_completion_attestation_version","p_native_completion_attestation",
                "p_native_completion_transport_attestation_version","p_native_completion_transport_attestation",
                "p_context_id","p_occurrence_id","p_submission_proof","p_snapshot_id","p_snapshot_employee_id",
                "p_snapshot_assignment_epoch","p_snapshot_credential_id");
            for(java.util.Iterator<String> keys=args.keys();keys.hasNext();)if(!allowed.contains(keys.next()))throw new VaultFailure(FAILURE);
            binding(device,args);requireResult(args,result);
            NativeRetainedAttempt.keys(readback,"reconciliation_id","context_id","occurrence_id","original_employee_id","original_credential_id",
                "device_id","location_id","client_session_id","client_completion_id","assignment_epoch","payload_fingerprint","submitted_at");
            for(String name:new String[]{"reconciliation_id","context_id","occurrence_id","original_employee_id","original_credential_id",
                "device_id","location_id","client_session_id","client_completion_id"})uuid(readback,name);
            JSONObject nativePrincipal=principal.json();
            if(!device.equals(nativePrincipal.get("device_id"))||!nativePrincipal.get("employee_id").equals(readback.get("original_employee_id"))
                ||!nativePrincipal.get("credential_id").equals(readback.get("original_credential_id"))
                ||epoch(nativePrincipal,"assignment_epoch")!=epoch(readback,"assignment_epoch"))throw new VaultFailure(FAILURE);
            JSONObject control=args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1");
            if(!uuid(control,"context_id").equals(readback.get("context_id"))||!text(control,"submission_proof").matches("[a-f0-9]{64}")
                ||!"custodial-native-completion.v2".equals(args.get("p_native_completion_attestation_version"))
                ||!text(args,"p_native_completion_attestation").matches("[a-f0-9]{64}"))throw new VaultFailure(FAILURE);
            for(String[] pair:new String[][]{{"p_context_id","context_id"},{"p_occurrence_id","occurrence_id"},
                {"p_snapshot_employee_id","original_employee_id"},{"p_snapshot_credential_id","original_credential_id"}})
                if(args.has(pair[0])&&args.get(pair[0])!=JSONObject.NULL&&!uuid(args,pair[0]).equals(readback.get(pair[1])))throw new VaultFailure(FAILURE);
            if(args.has("p_snapshot_assignment_epoch")&&args.get("p_snapshot_assignment_epoch")!=JSONObject.NULL
                &&epoch(args,"p_snapshot_assignment_epoch")!=epoch(readback,"assignment_epoch"))throw new VaultFailure(FAILURE);
            if(args.has("p_snapshot_id")&&args.get("p_snapshot_id")!=JSONObject.NULL&&!text(args,"p_snapshot_id").matches("[a-f0-9]{64}"))throw new VaultFailure(FAILURE);
            if(args.has("p_submission_proof")&&args.get("p_submission_proof")!=JSONObject.NULL&&!text(args,"p_submission_proof").equals(control.get("submission_proof")))throw new VaultFailure(FAILURE);
            if(!uuid(args,"p_client_session_id").equals(readback.get("client_session_id"))
                ||!uuid(args,"p_client_completion_id").equals(readback.get("client_completion_id"))
                ||!uuid(result,"occurrence_id").equals(readback.get("occurrence_id"))
                ||!uuid(result,"original_employee_id").equals(readback.get("original_employee_id"))
                ||!text(readback,"payload_fingerprint").matches("[a-f0-9]{64}"))throw new VaultFailure(FAILURE);
            uuid(result,"session_uuid");uuid(result,"completion_response_id");
            String started=text(args,"p_client_started_at"),ended=text(args,"p_client_ended_at");
            if(VaultTimestamps.compareInstants(started,ended,FAILURE)>=0
                ||VaultTimestamps.compareInstants(started,text(result,"started_at"),FAILURE)!=0
                ||VaultTimestamps.compareInstants(ended,text(result,"ended_at"),FAILURE)!=0)throw new VaultFailure(FAILURE);
            String submitted=text(readback,"submitted_at");
            if(submitted.length()>64||!submitted.equals(submitted.trim()))throw new VaultFailure(FAILURE);
            VaultTimestamps.epochMillis(submitted,FAILURE); // retain exact first string; not a current-clock/profile claim
            if(args.has("p_correlation_id")&&args.get("p_correlation_id")!=JSONObject.NULL&&!(args.get("p_correlation_id") instanceof String))throw new VaultFailure(FAILURE);
            String correlation=args.optString("p_correlation_id","");
            if(correlation.isEmpty())correlation="scan-commit:"+uuid(args,"p_client_session_id")+":"+uuid(args,"p_client_completion_id");
            correlation=correlation.trim();Object receivedCorrelation=result.opt("correlation_id");
            if(correlation.isEmpty()?receivedCorrelation!=null&&receivedCorrelation!=JSONObject.NULL:!correlation.equals(receivedCorrelation))throw new VaultFailure(FAILURE);
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static long epoch(JSONObject value,String key)throws VaultFailure {
        Object raw=value.opt(key);
        if(!(raw instanceof Integer||raw instanceof Long))throw new VaultFailure(FAILURE);
        long n=((Number)raw).longValue();if(n<1||n>9007199254740991L)throw new VaultFailure(FAILURE);return n;
    }
    private static void requireRequestEnvelope(JSONObject envelope,String device) throws VaultFailure {
        try {
            if(envelope.has("device_id")) {NativeRetainedAttempt.keys(envelope,"device_id","fn","args");if(!device.equals(envelope.get("device_id")))throw new VaultFailure(FAILURE);}
            else NativeRetainedAttempt.keys(envelope,"fn","args");
            if(!"tool_commit_cleaning_workflow".equals(envelope.get("fn"))||!(envelope.get("args") instanceof JSONObject))throw new VaultFailure(FAILURE);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    /** Exact SEMANTIC argument value comparison only. No body reconstruction,
     * new signing, schema backfill, receipt mutation, replay or acceptance. A
     * browser candidate is not authenticated by matching this old binding. */
    static final class RetainedArgumentMatch {
        final String state,sourceKey,candidateArgumentsSha256,receiptBindingSha256;
        final boolean semanticArgumentsMatch;
        final boolean browserSourceAuthenticated=false,originalWireRecovered=false,cutoffEligible=false;
        final boolean workAccepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false,phoneReleased=false;
        private RetainedArgumentMatch(String key,String candidateHash,String binding,boolean match) {
            sourceKey=key;candidateArgumentsSha256=candidateHash;receiptBindingSha256=binding;semanticArgumentsMatch=match;
            state=match?"EXACT_ARGUMENT_VALUES_MATCH_ORIGINAL_BINDING_UNVERIFIED_SOURCE":"ARGUMENT_VALUES_MISMATCH_RETAINED";
        }
    }
    static RetainedArgumentMatch compareRetainedArgumentValues(String device,String sourceKey,String encoded,byte[] originalCandidate) throws VaultFailure {
        byte[] candidate=originalCandidate==null?null:originalCandidate.clone();
        try(RetainedOriginalRequest receipt=inspectRetainedOriginalRequest(device,sourceKey,encoded)) {
            if(candidate==null)throw new VaultFailure(FAILURE);
            JSONObject args=ProviderWireJson.object(candidate,RequestPolicy.MAX_REQUEST_BYTES);
            String expectedKey=key(device,args),expectedBinding=binding(device,args);
            boolean match=sourceKey.equals(expectedKey)&&receipt.binding.equals(expectedBinding);
            if(match)requireResult(args,receipt.result());
            if(!Arrays.equals(candidate,originalCandidate))throw new VaultFailure(FAILURE);
            return new RetainedArgumentMatch(sourceKey,NativeRetainedAttempt.hash(candidate),receipt.binding,match);
        }catch(VaultFailure error){if(FAILURE.equals(error.code))throw error;throw new VaultFailure(FAILURE,error);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
        finally{if(candidate!=null)Arrays.fill(candidate,(byte)0);}
    }

    private static String key(String device, JSONObject args) throws VaultFailure {
        return sha256(VaultValidation.deviceId(device) + "|" + uuid(args, "p_client_session_id")
            + "|" + uuid(args, "p_client_completion_id"));
    }

    private static String binding(String device, JSONObject args) throws VaultFailure {
        try {
            String expected = VaultValidation.deviceId(device);
            if (!expected.equals(args.opt("p_device_id"))) throw new VaultFailure(FAILURE);
            uuid(args, "p_client_session_id");
            uuid(args, "p_client_completion_id");
            uuid(args, "p_native_finish_scan_entry_id");
            String location = text(args, "p_location_code");
            if (!location.matches("[A-Z0-9._:-]{1,100}")) throw new VaultFailure(FAILURE);
            for (String name : new String[]{"p_client_started_at", "p_client_ended_at"}) {
                String time = text(args, name);
                VaultTimestamps.epochMillis(time, FAILURE);
            }
            JSONObject answers = args.optJSONObject("p_response_json");
            if (answers == null) throw new VaultFailure(FAILURE);
            Object evidence = args.opt("p_scan_evidence");
            if (!(evidence instanceof JSONArray)) throw new VaultFailure(FAILURE);
            JSONObject semantic = new JSONObject(args.toString());
            // Only the current-credential replay proof may legitimately rotate.
            // Request-auth headers are outside args and therefore outside this binding.
            semantic.remove("p_native_completion_transport_attestation_version");
            semantic.remove("p_native_completion_transport_attestation");
            return sha256(canonical(semantic));
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    private static void requireResult(JSONObject args, JSONObject result) throws VaultFailure {
        if (!"closed".equals(result.opt("status"))
            || !uuid(args,"p_client_session_id").equals(uuid(result,"client_session_id"))
            || !uuid(args,"p_client_completion_id").equals(uuid(result,"client_completion_id")))
            throw new VaultFailure(FAILURE);
        Object context = result.opt("occurrence_id");
        if (context != null && context != JSONObject.NULL) uuid(result, "occurrence_id");
    }
    private static String text(JSONObject json, String key) throws VaultFailure {
        Object value = json.opt(key);
        if (!(value instanceof String)) throw new VaultFailure(FAILURE);
        return (String)value;
    }
    private static String uuid(JSONObject json, String key) throws VaultFailure {
        String value = text(json, key);
        if (!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))
            throw new VaultFailure(FAILURE);
        return value;
    }
    private static String sha256(String value) throws VaultFailure {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format(java.util.Locale.ROOT,"%02x",b & 255));
            return out.toString();
        } catch (Exception error) { throw new VaultFailure(FAILURE,error); }
    }
    private static String canonical(Object value) throws Exception { return canonical(value,0); }
    private static String canonical(Object value,int depth) throws Exception {
        if (depth > 32) throw new VaultFailure(FAILURE);
        if (value instanceof JSONObject json) {
            List<String> keys = new ArrayList<>(); json.keys().forEachRemaining(keys::add);
            Collections.sort(keys); List<String> members = new ArrayList<>();
            for (String key : keys) members.add(JSONObject.quote(key)+":"+canonical(json.get(key),depth+1));
            return "{"+String.join(",",members)+"}";
        }
        if (value instanceof JSONArray array) {
            List<String> items = new ArrayList<>();
            for(int i=0;i<array.length();i++) items.add(canonical(array.get(i),depth+1));
            return "["+String.join(",",items)+"]";
        }
        if(value==null || value==JSONObject.NULL) return "null";
        if(value instanceof String) return JSONObject.quote((String)value);
        if(value instanceof Number) return JSONObject.numberToString((Number)value);
        if(value instanceof Boolean) return value.toString();
        throw new VaultFailure(FAILURE);
    }
}
