package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Server acceptance captured only at the native, authenticated HTTPS boundary. */
final class NativeCompletionJournal {
    static final String FAILURE = "custodial_native_server_receipt_required";
    private static final String RECEIPT_SCHEMA = "native-server-completion.v2";
    interface Store {
        String loadCompletionReceipt(String key) throws VaultFailure;
        void saveCompletionReceipt(String key, String value) throws VaultFailure;
        void deleteCompletionReceipt(String key) throws VaultFailure;
    }
    private final Store store;
    NativeCompletionJournal(Store store) { this.store = store; }

    static boolean isCompletionRequest(AuthorizedRequest request) {
        if (!"/scan-api/rpc".equals(request.path) || !"POST".equalsIgnoreCase(request.method)) return false;
        try { return "tool_commit_cleaning_workflow".equals(new JSONObject(
            new String(request.body,StandardCharsets.UTF_8)).optString("fn")); }
        catch (Exception error) { return false; }
    }

    // Never expose this method as a PluginMethod. Its response comes from VaultEngine.
    synchronized void captureAuthenticatedResponse(String device, AuthorizedRequest request,
            AuthorizedResponse response) throws VaultFailure {
        if (!"/scan-api/rpc".equals(request.path)
            || !"POST".equalsIgnoreCase(request.method) || response.status < 200 || response.status >= 300) return;
        try {
            JSONObject envelope = new JSONObject(new String(request.body, StandardCharsets.UTF_8));
            if (!"tool_commit_cleaning_workflow".equals(envelope.optString("fn"))) return;
            JSONObject received = new JSONObject(new String(response.body, StandardCharsets.UTF_8));
            if (!Boolean.TRUE.equals(received.opt("ok"))) return;
            JSONObject result = received.optJSONObject("data");
            if (result == null || !"closed".equals(result.optString("status"))) return;
            JSONObject args = envelope.getJSONObject("args");
            requireResult(args, result);
            JSONObject record = new JSONObject();
            record.put("schema_version", RECEIPT_SCHEMA);
            record.put("binding_sha256", binding(device, args));
            record.put("result", result);
            String encoded = canonical(record);
            if (encoded.length() > 65536) throw new VaultFailure(FAILURE);
            String key = key(device, args);
            String prior = store.loadCompletionReceipt(key);
            if (prior != null) {
                JSONObject existing = new JSONObject(prior);
                if (!RECEIPT_SCHEMA.equals(existing.optString("schema_version"))
                    || !record.getString("binding_sha256").equals(existing.optString("binding_sha256")))
                    throw new VaultFailure(FAILURE);
                requireResult(args, existing.getJSONObject("result"));
                return; // Preserve the first authenticated receipt, including its original times.
            }
            store.saveCompletionReceipt(key, encoded);
            if (!encoded.equals(store.loadCompletionReceipt(key))) throw new VaultFailure(FAILURE);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    synchronized JSONObject recover(String device, JSONObject args) throws VaultFailure {
        try {
            String encoded = store.loadCompletionReceipt(key(device, args));
            if (encoded == null) return null;
            JSONObject receipt = new JSONObject(encoded);
            if (!RECEIPT_SCHEMA.equals(receipt.optString("schema_version"))) throw new VaultFailure(FAILURE);
            String expectedBinding = binding(device, args);
            if (!expectedBinding.equals(receipt.optString("binding_sha256"))) throw new VaultFailure(FAILURE);
            JSONObject result = receipt.getJSONObject("result");
            requireResult(args, result);
            return new JSONObject(result.toString());
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    synchronized void requireAccepted(String device, JSONObject args) throws VaultFailure {
        if (recover(device, args) == null) throw new VaultFailure(FAILURE);
    }

    synchronized void retireAfterQueueRemoval(String device, JSONObject args) throws VaultFailure {
        if (recover(device, args) == null) return;
        store.deleteCompletionReceipt(key(device, args));
        if (store.loadCompletionReceipt(key(device, args)) != null) throw new VaultFailure(FAILURE);
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
