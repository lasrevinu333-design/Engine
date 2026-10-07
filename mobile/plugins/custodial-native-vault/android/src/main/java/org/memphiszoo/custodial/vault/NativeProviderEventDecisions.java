package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Read back only original accepted events. No clock sample, terminal denial,
 * new observation, effect or cleanup authority is produced by this contract. */
final class NativeProviderEventDecisions {
    static final String PATH = "/employee-notifications-api/native-provider/event-decisions";
    static final class Query implements AutoCloseable {
        final NativeProviderJournal.EventBatch batch;
        final NativeProviderJournal.Prepared current;
        private final String requester;
        private final byte[] bytes;
        final String bodySha256;
        private boolean closed;
        private Query(NativeProviderJournal.EventBatch batch, NativeProviderJournal.Prepared current) throws Exception {
            if (batch == null || batch.events.isEmpty() || batch.events.size() > 16 || current == null || !current.confirmed) throw invalid();
            this.batch = batch; this.current = current;
            JSONObject principal = current.json().getJSONObject("principal");
            if (!batch.principal.same(NativeProviderPrincipal.fromNativeJournal(principal))) throw invalid();
            JSONObject who = new JSONObject().put("current_generation_id", current.generationId)
                .put("principal_digest", current.principalDigest).put("token_digest", current.tokenDigest);
            for (String key : new String[]{"credential_id", "employee_id", "device_id", "assignment_epoch"}) who.put(key, principal.get(key));
            requester = who.toString();
            JSONArray events = new JSONArray();
            for (NativeProviderJournal.PendingEvent event : batch.events.values()) events.put(event.wire());
            bytes = new JSONObject().put("schema", "custodial.native-provider-event-decision-query.v1")
                .put("requester", who).put("events", events).toString().getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 65536) { Arrays.fill(bytes, (byte) 0); throw invalid(); }
            bodySha256 = sha256(bytes);
        }
        static Query fromJournal(NativeProviderJournal.EventBatch batch, NativeProviderJournal.Prepared current) throws VaultFailure {
            try { return new Query(batch, current); }
            catch (VaultFailure failure) { throw failure; }
            catch (Exception failure) { throw new VaultFailure("custodial_provider_event_decision_invalid", failure); }
        }
        JSONObject requester() throws Exception { return new JSONObject(requester); }
        synchronized AuthorizedRequest request() throws VaultFailure {
            if (closed) throw new VaultFailure("custodial_provider_operation_closed");
            return new AuthorizedRequest(PATH, "POST", Collections.singletonMap("Content-Type", "application/json; charset=utf-8"), bytes);
        }
        @Override public synchronized void close() { closed = true; Arrays.fill(bytes, (byte) 0); }
    }
    /** Fresh transport correlation only, deliberately not a clock exchange. */
    static final class Exchange {
        final AuthorizedResponse response;
        final String requestId, bodySha256;
        Exchange(AuthorizedResponse response, String requestId, String path, String bodySha256) throws VaultFailure {
            if (response == null || requestId == null || !requestId.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}")
                || !PATH.equals(path) || bodySha256 == null || !bodySha256.matches("[0-9a-f]{64}")) throw invalid();
            this.response = response; this.requestId = requestId; this.bodySha256 = bodySha256;
        }
    }
    static NativeProviderEventReceipts validate(Query query, Exchange exchange) throws VaultFailure {
        try {
            if (query == null || exchange == null || exchange.response.status != 200 || !query.bodySha256.equals(exchange.bodySha256)) throw invalid();
            AuthorizedResponse response = exchange.response;
            int types = 0; String contentType = null;
            for (Map.Entry<String, String> header : response.headers.entrySet()) if ("content-type".equalsIgnoreCase(header.getKey())) { types++; contentType = header.getValue(); }
            if (types != 1 || contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).matches("application/json(?:\\s*;\\s*charset=utf-8)?")) throw invalid();
            JSONObject envelope = ProviderWireJson.object(response.body, 262144); exact(envelope, "ok", "data");
            if (!Boolean.TRUE.equals(envelope.get("ok"))) throw invalid();
            JSONObject data = envelope.getJSONObject("data"); exact(data, "schema", "native_request_id", "request_body_sha256", "requester", "results");
            if (!"custodial.native-provider-event-decisions.v1".equals(data.get("schema")) || !exchange.requestId.equals(data.get("native_request_id"))
                || !exchange.bodySha256.equals(data.get("request_body_sha256")) || !ProviderWireJson.same(query.requester(), data.getJSONObject("requester"))) throw invalid();
            JSONArray results = data.getJSONArray("results"); if (results.length() > 16) throw invalid();
            Set<String> seen = new HashSet<>(); Map<String, JSONObject> accepted = new HashMap<>();
            for (int i = 0; i < results.length(); i++) {
                JSONObject result = results.getJSONObject(i); Object id = result.get("event_id");
                if (!(id instanceof String) || !query.batch.events.containsKey(id) || !seen.add((String) id)) throw invalid();
                if ("UNRESOLVED".equals(result.get("decision"))) exact(result, "event_id", "decision");
                else {
                    exact(result, "event_id", "decision", "receipt");
                    if (!"ORIGINAL_ACCEPTED".equals(result.get("decision"))) throw invalid();
                    accepted.put((String) id, result.getJSONObject("receipt"));
                }
            }
            return NativeProviderEventReceipts.originalAcceptances(query.batch, accepted);
        } catch (VaultFailure failure) { throw failure; }
        catch (Exception failure) { throw new VaultFailure("custodial_provider_event_decision_invalid", failure); }
    }
    private static String sha256(byte[] bytes) throws Exception {
        StringBuilder value = new StringBuilder(); for (byte b : java.security.MessageDigest.getInstance("SHA-256").digest(bytes)) value.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return value.toString();
    }
    private static void exact(JSONObject value, String... expected) throws VaultFailure {
        Set<String> keys = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) keys.add(it.next());
        if (!keys.equals(new HashSet<>(Arrays.asList(expected)))) throw invalid();
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_event_decision_invalid"); }
}
