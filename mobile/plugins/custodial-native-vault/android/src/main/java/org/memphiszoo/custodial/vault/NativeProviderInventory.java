package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded native keyset recovery contract. Cursors are pagination, never authority.
 * Only the typed authenticated HTTPS owner may validate a Page for a journal Request. */
final class NativeProviderInventory {
    static final class Request {
        final NativeProviderPrincipal principal;
        final long invalidationEpoch;
        final String recoveryId;
        private final String scan;
        Request(NativeProviderPrincipal principal, long invalidationEpoch, String recoveryId, JSONObject scan) {
            this.principal = principal; this.invalidationEpoch = invalidationEpoch; this.recoveryId = recoveryId; this.scan = scan.toString();
        }
        JSONObject scan() throws Exception { return new JSONObject(scan); }
        byte[] body() throws VaultFailure {
            try {
                JSONObject original = scan(), p = principal.json();
                JSONObject body = new JSONObject().put("schema", "custodial.native-provider-inventory-request.v1")
                    .put("principal_digest", principal.digest).put("limit", 32);
                for (String field : new String[]{"device_id", "credential_id", "employee_id", "assignment_epoch"}) body.put(field, p.get(field));
                for (String field : new String[]{"scan_id", "generation_ids", "cursor", "ceiling", "server_now"}) body.put(field, original.get(field));
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                if (bytes.length > 65536) { Arrays.fill(bytes, (byte) 0); throw invalid(); } return bytes;
            } catch (Exception error) { throw new VaultFailure("custodial_provider_inventory_invalid", error); }
        }
    }
    static final class Page {
        private final Request request;
        private final String data;
        final List<NativeProviderPayload> rows;
        final boolean hasMore;
        private Page(Request request, JSONObject data, List<NativeProviderPayload> rows) throws Exception {
            this.request = request; this.data = data.toString(); this.rows = Collections.unmodifiableList(rows); hasMore = data.getBoolean("has_more");
        }
        void requireRequest(Request expected) throws VaultFailure { if (request != expected) throw invalid(); }
        JSONObject data() throws Exception { return new JSONObject(data); }
    }
    static final class CursorRejection {
        private final Request request;
        private CursorRejection(Request request) { this.request = request; }
        void requireRequest(Request expected) throws VaultFailure { if (request != expected) throw invalid(); }
    }
    /** Only this exact authenticated error for a checkpointed cursor permits restart.
     * Generic 400/timeout/malformed replies leave the original scan intact. */
    static CursorRejection validateCursorRejection(Request request, AuthorizedResponse response) throws VaultFailure {
        try {
            if (request == null || response == null || response.status != 409 || request.scan().isNull("cursor")) throw invalid();
            requireContentType(response);
            JSONObject error = ProviderWireJson.object(response.body, 262144);
            exact(error, "ok", "error", "schema", "scan_id", "principal_digest", "cursor", "ceiling", "server_now", "generation_ids");
            if (!Boolean.FALSE.equals(error.get("ok")) || !"custodial_native_provider_cursor_invalid".equals(error.get("error"))
                || !"custodial.native-provider-inventory-restart.v1".equals(error.get("schema"))
                || !request.principal.digest.equals(error.get("principal_digest"))) throw invalid();
            for (String field : new String[]{"scan_id", "cursor", "ceiling", "server_now", "generation_ids"})
                if (!ProviderWireJson.same(request.scan().get(field), error.get(field))) throw invalid();
            return new CursorRejection(request);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_inventory_invalid", error); }
    }
    static Page validateResponse(Request request, AuthorizedResponse response) throws VaultFailure {
        try {
            if (request == null || response == null || response.status < 200 || response.status >= 300) throw invalid();
            requireContentType(response);
            JSONObject envelope = ProviderWireJson.object(response.body, 262144); exact(envelope, "ok", "data");
            if (!Boolean.TRUE.equals(envelope.get("ok"))) throw invalid();
            JSONObject data = envelope.getJSONObject("data"), scan = request.scan(), principal = request.principal.json(); validateScanBounds(scan);
            exact(data, "schema", "scan_id", "principal_digest", "device_id", "credential_id", "employee_id", "assignment_epoch",
                "generation_ids", "cursor", "ceiling", "server_now", "has_more", "rows");
            if (!"custodial.native-provider-inventory.v1".equals(data.get("schema")) || !scan.get("scan_id").equals(data.get("scan_id"))
                || !request.principal.digest.equals(data.get("principal_digest")) || !(data.get("has_more") instanceof Boolean)) throw invalid();
            for (String field : new String[]{"device_id", "credential_id", "employee_id"}) if (!principal.get(field).equals(data.get(field))) throw invalid();
            if (!(data.get("assignment_epoch") instanceof Integer || data.get("assignment_epoch") instanceof Long)
                || data.getLong("assignment_epoch") != principal.getLong("assignment_epoch")) throw invalid();
            JSONArray generations = data.getJSONArray("generation_ids"), expected = scan.getJSONArray("generation_ids");
            if (generations.length() < 1 || generations.length() > 32 || generations.length() != expected.length()) throw invalid();
            Set<String> allowed = new HashSet<>();
            for (int i = 0; i < generations.length(); i++) {
                if (!(generations.get(i) instanceof String) || !generations.get(i).equals(expected.get(i)) || !allowed.add(generations.getString(i))) throw invalid();
            }
            if (!(data.get("server_now") instanceof String)) throw invalid();
            Instant serverNow = NativeProviderPayload.timestamp(data.getString("server_now"));
            if (scan.get("server_now") != JSONObject.NULL && !scan.get("server_now").equals(data.get("server_now"))) throw invalid();
            JSONObject ceiling = tuple(data.get("ceiling")), cursor = tuple(data.get("cursor")), previous = tuple(scan.get("cursor"));
            if (scan.get("ceiling") != JSONObject.NULL && !sameTuple(tuple(scan.get("ceiling")), ceiling)) throw invalid();
            if (ceiling != null && NativeProviderPayload.timestamp(ceiling.getString("reservation_at")).isAfter(serverNow)) throw invalid();
            if (previous != null && (ceiling == null || compare(previous, ceiling) > 0)) throw invalid();
            JSONArray entries = data.getJSONArray("rows"); if (entries.length() > 32 || (entries.length() == 0 && data.getBoolean("has_more"))) throw invalid();
            List<NativeProviderPayload> rows = new ArrayList<>(); JSONObject last = previous;
            for (int i = 0; i < entries.length(); i++) {
                JSONObject row = entries.getJSONObject(i); exact(row, "payload", "provider_outcome");
                if (!Arrays.asList("prepared", "delivery_outcome_unknown", "provider_accepted").contains(row.get("provider_outcome"))) throw invalid();
                NativeProviderPayload payload = NativeProviderPayload.fromInventory(row.getJSONObject("payload")); payload.requirePrincipal(request.principal);
                if (!allowed.contains(payload.generationId) || payload.reservedAt.isAfter(serverNow) || !payload.validUntil.isAfter(serverNow)) throw invalid();
                JSONObject current = new JSONObject().put("reservation_at", payload.get("reservation_at")).put("job_id", payload.jobId);
                if (ceiling == null || compare(current, ceiling) > 0 || (last != null && compare(current, last) <= 0)) throw invalid();
                last = current; rows.add(payload);
            }
            if (!sameTuple(last, cursor) || (data.getBoolean("has_more") && (ceiling == null || cursor == null || compare(cursor, ceiling) >= 0))) throw invalid();
            return new Page(request, data, rows);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_inventory_invalid", error); }
    }
    private static void requireContentType(AuthorizedResponse response) throws VaultFailure {
        int types = 0; String contentType = "";
        for (Map.Entry<String, String> header : response.headers.entrySet()) if ("content-type".equalsIgnoreCase(header.getKey())) { types++; contentType = header.getValue(); }
        if (types != 1 || contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).matches("application/json(?:\\s*;\\s*charset=utf-8)?")) throw invalid();
    }
    static void validateScanBounds(JSONObject scan) throws Exception {
        JSONObject cursor = tuple(scan.get("cursor")), ceiling = tuple(scan.get("ceiling")); Object now = scan.get("server_now");
        if (now == JSONObject.NULL) {
            if (cursor != null || ceiling != null || scan.getLong("pages") != 0) throw invalid();
        } else {
            if (!(now instanceof String) || scan.getLong("pages") < 1 || (cursor != null && (ceiling == null || compare(cursor, ceiling) > 0))) throw invalid();
            Instant serverNow = NativeProviderPayload.timestamp((String) now);
            if (ceiling != null && NativeProviderPayload.timestamp(ceiling.getString("reservation_at")).isAfter(serverNow)) throw invalid();
        }
    }
    private static JSONObject tuple(Object value) throws Exception {
        if (value == JSONObject.NULL) return null; if (!(value instanceof JSONObject)) throw invalid(); JSONObject tuple = (JSONObject) value;
        exact(tuple, "reservation_at", "job_id");
        if (!(tuple.get("reservation_at") instanceof String) || !(tuple.get("job_id") instanceof String)) throw invalid();
        NativeProviderPayload.timestamp(tuple.getString("reservation_at")); NativeLegacyLineageJournal.uuid(tuple.getString("job_id")); return tuple;
    }
    private static boolean sameTuple(JSONObject a, JSONObject b) throws Exception { return a == null ? b == null : b != null && NativeLegacyLineageJournal.same(a, b); }
    private static int compare(JSONObject a, JSONObject b) throws Exception {
        int time = a.getString("reservation_at").compareTo(b.getString("reservation_at")); return time == 0 ? a.getString("job_id").compareTo(b.getString("job_id")) : time;
    }
    private static void exact(JSONObject value, String... fields) throws VaultFailure {
        Set<String> keys = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) keys.add(it.next());
        if (!keys.equals(new HashSet<>(Arrays.asList(fields)))) throw invalid();
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_inventory_invalid"); }
}
