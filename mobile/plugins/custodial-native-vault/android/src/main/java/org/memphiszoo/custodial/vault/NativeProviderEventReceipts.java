package org.memphiszoo.custodial.vault;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Exact item admission after typed authenticated HTTPS; no JS/FCM settlement path.
 * Missing/rejected/mismatched items remain pending. Duplicate IDs invalidate an ambiguous batch. */
final class NativeProviderEventReceipts {
    static final String SCHEMA = "custodial.native-provider-event-receipt.v1";
    private final NativeProviderJournal.EventBatch batch;
    private final Map<String, String> admitted;
    private NativeProviderEventReceipts(NativeProviderJournal.EventBatch batch, Map<String, String> admitted) {
        this.batch = batch; this.admitted = Collections.unmodifiableMap(new HashMap<>(admitted));
    }
    static NativeProviderEventReceipts validateResponse(NativeProviderJournal.EventBatch batch, AuthorizedResponse response) throws VaultFailure {
        try {
            if (batch == null || response == null || response.status < 200 || response.status >= 300) throw invalid();
            int types = 0; String contentType = "";
            for (Map.Entry<String, String> header : response.headers.entrySet()) if ("content-type".equalsIgnoreCase(header.getKey())) { types++; contentType = header.getValue(); }
            if (types != 1 || contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).matches("application/json(?:\\s*;\\s*charset=utf-8)?")) throw invalid();
            JSONObject envelope = ProviderWireJson.object(response.body, 262144); exact(envelope, "ok", "data");
            if (!Boolean.TRUE.equals(envelope.get("ok"))) throw invalid();
            JSONObject data = envelope.getJSONObject("data"); exact(data, "schema", "results");
            if (!"custodial.native-provider-event-receipts.v1".equals(data.get("schema"))) throw invalid();
            JSONArray rows = data.getJSONArray("results"); if (rows.length() > 16) throw invalid();
            Map<String, String> admitted = new HashMap<>(); Set<String> seen = new HashSet<>();
            for (int i = 0; i < rows.length(); i++) {
                Object row = rows.get(i); if (!(row instanceof JSONObject)) continue;
                JSONObject result = (JSONObject) row; Object id = result.opt("event_id");
                if (!(id instanceof String)) continue;
                if (!seen.add((String) id)) throw invalid();
                NativeProviderJournal.PendingEvent expected = batch.events.get(id); if (expected == null) continue;
                if (matches(expected, result)) admitted.put((String) id, result.toString());
            }
            return new NativeProviderEventReceipts(batch, admitted);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_event_receipt_invalid", error); }
    }
    static boolean matches(NativeProviderJournal.PendingEvent expected, JSONObject result) {
        try {
            JSONObject wire = expected.wire(); Set<String> fields = keys(wire);
            Collections.addAll(fields, "admitted_state", "server_received_at", "replayed");
            if (!keys(result).equals(fields) || !SCHEMA.equals(result.get("schema")) || !"ACCEPTED".equals(result.get("admitted_state"))
                || !(result.get("replayed") instanceof Boolean)) return false;
            if (!(result.get("server_received_at") instanceof String)) return false;
            NativeProviderPayload.timestamp(result.getString("server_received_at"));
            strictInteger(result.get("receipt_assignment_epoch"), true);
            JSONObject observation = result.getJSONObject("original_observation"); exact(observation, "authenticated_at", "elapsed_realtime_ms", "boot_count");
            for (String field : new String[]{"elapsed_realtime_ms", "boot_count"})
                if (observation.get(field) != JSONObject.NULL) strictInteger(observation.get(field), false);
            if (observation.get("authenticated_at") != JSONObject.NULL) {
                if (observation.get("elapsed_realtime_ms") == JSONObject.NULL || observation.get("boot_count") == JSONObject.NULL) return false;
                if (!(observation.get("authenticated_at") instanceof String)) return false;
                NativeProviderPayload.timestamp(observation.getString("authenticated_at"));
            }
            JSONObject reduced = new JSONObject(result.toString());
            reduced.remove("admitted_state"); reduced.remove("server_received_at"); reduced.remove("replayed"); reduced.put("schema", wire.get("schema"));
            return NativeLegacyLineageJournal.same(reduced, wire);
        } catch (Exception rejected) { return false; }
    }
    private static void strictInteger(Object value, boolean positive) throws VaultFailure {
        if (!(value instanceof Integer || value instanceof Long) || ((Number) value).longValue() < (positive ? 1 : 0)
            || ((Number) value).longValue() > 9007199254740991L) throw invalid();
    }
    Set<String> admittedIds() { return admitted.keySet(); }
    JSONObject receipt(String eventId) throws VaultFailure {
        try { if (!admitted.containsKey(eventId)) throw invalid(); return new JSONObject(admitted.get(eventId)); }
        catch (Exception error) { throw invalid(); }
    }
    void requireBatch(NativeProviderJournal.EventBatch expected) throws VaultFailure { if (expected != batch) throw invalid(); }
    private static Set<String> keys(JSONObject value) { Set<String> result = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) result.add(it.next()); return result; }
    private static void exact(JSONObject value, String... keys) throws VaultFailure { if (!keys(value).equals(new HashSet<>(java.util.Arrays.asList(keys)))) throw invalid(); }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_event_receipt_invalid"); }
}
