package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.time.Instant;
import org.json.JSONObject;

/** Registration and ingress slice of the accepted provider journal.
 * Not wired to runtime yet. Confirmation is a typed receipt transition only;
 * no HTTPS origin, ingress, display or action authority is established here.
 * Inbox/event/removal-effect extensions must be complete before runtime wiring. */
final class NativeProviderJournal {
    private static final String SCHEMA = "custodial.native-provider-journal.v1";
    private static final ProviderRecordStore.Key META = ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA, "journal");
    private final ProviderRecordStore store;
    private final Object lock;

    NativeProviderJournal(ProviderRecordStore store, Object lock) {
        if (store == null || lock == null) throw new IllegalArgumentException("provider_journal_dependencies_required");
        this.store = store; this.lock = lock;
    }
    static final class Prepared {
        private final String encoded;
        final String operationId, generationId, principalDigest, tokenDigest;
        final boolean confirmed;
        final long captureSequence;
        Prepared(JSONObject record) throws org.json.JSONException {
            encoded = record.toString(); operationId = record.getString("operation_id"); generationId = record.getString("generation_id");
            principalDigest = record.getString("principal_digest"); tokenDigest = record.getString("token_digest"); captureSequence = record.getLong("capture_sequence");
            confirmed = "CONFIRMED".equals(record.getString("state"));
        }
        JSONObject json() throws org.json.JSONException { return new JSONObject(encoded); }
    }

    /** Native-only immutable typed request. No caller path/header/body or WebView constructor. */
    static final class Registration implements AutoCloseable {
        final Prepared prepared;
        final long invalidationEpoch;
        private final byte[] body;
        private final String path;
        private boolean closed;
        private Registration(Prepared prepared, long invalidationEpoch, boolean status, char[] token) throws Exception {
            this.prepared = prepared; this.invalidationEpoch = invalidationEpoch;
            path = "/employee-notifications-api/native-provider/" + (status ? "status" : "register");
            JSONObject p = prepared.json(), principal = p.getJSONObject("principal");
            JSONObject value = new JSONObject().put("schema", status ? "custodial.native-provider-status.v1" : "custodial.native-provider-register.v1")
                .put("operation_id", prepared.operationId).put("generation_id", prepared.generationId)
                .put("principal_digest", prepared.principalDigest).put("token_digest", prepared.tokenDigest).put("native_app", p.getJSONObject("native_app"));
            for (String field : new String[]{"device_id", "employee_id", "credential_id", "assignment_epoch"}) value.put(field, principal.get(field));
            if (!status) value.put("token", new String(token));
            body = value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (body.length > 65536) { Arrays.fill(body, (byte) 0); throw new VaultFailure("custodial_provider_request_too_large"); }
        }
        synchronized AuthorizedRequest request() throws VaultFailure {
            if (closed) throw new VaultFailure("custodial_provider_operation_closed");
            return new AuthorizedRequest(path, "POST", Collections.singletonMap("Content-Type", "application/json; charset=utf-8"), body);
        }
        @Override public synchronized void close() { closed = true; Arrays.fill(body, (byte) 0); }
    }

    Registration registrationRequest(NativeProviderPrincipal current, Prepared expected, boolean status) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            char[] token = tokenForPrepared(current, expected);
            try { return new Registration(expected, number(meta, "invalidation_epoch"), status, token); }
            finally { Arrays.fill(token, '\0'); }
        });
    }
    void requireRegistrationCurrent(NativeProviderPrincipal current, Registration operation) throws VaultFailure {
        transition(() -> {
            if (operation == null) throw new VaultFailure("custodial_provider_operation_stale");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (number(meta, "invalidation_epoch") != operation.invalidationEpoch) throw new VaultFailure("custodial_provider_operation_stale");
            char[] token = tokenForPrepared(current, operation.prepared); Arrays.fill(token, '\0'); return null;
        });
    }

    /** Original native observation. Time may be unknown; never substitute Android/browser wall time.
     * Runtime must supply authenticated OfflineAuthorityTime plus actual monotonic boot/elapsed values. */
    static final class Observation {
        final Instant authenticatedAt;
        final long elapsedRealtimeMillis;
        final int bootCount;
        Observation(Instant authenticatedAt, long elapsedRealtimeMillis, int bootCount) throws VaultFailure {
            if (elapsedRealtimeMillis < -1 || bootCount < -1 || (authenticatedAt != null
                && (elapsedRealtimeMillis < 0 || bootCount < 0 || authenticatedAt.getNano() % 1000 != 0)))
                throw new VaultFailure("custodial_provider_observation_invalid");
            this.authenticatedAt = authenticatedAt; this.elapsedRealtimeMillis = elapsedRealtimeMillis; this.bootCount = bootCount;
        }
        JSONObject json() throws Exception {
            return new JSONObject().put("authenticated_at", authenticatedAt == null ? JSONObject.NULL : canonicalTime(authenticatedAt))
                .put("elapsed_realtime_ms", elapsedRealtimeMillis < 0 ? JSONObject.NULL : elapsedRealtimeMillis)
                .put("boot_count", bootCount < 0 ? JSONObject.NULL : bootCount);
        }
    }
    static final class Arrival {
        final String recordId, state;
        final boolean newlyAdmitted;
        Arrival(String recordId, String state, boolean newlyAdmitted) { this.recordId = recordId; this.state = state; this.newlyAdmitted = newlyAdmitted; }
    }

    static final class PendingEvent {
        final String id;
        private final String original, wire;
        private PendingEvent(JSONObject event) throws Exception {
            id = event.getString("event_id"); original = event.toString();
            JSONObject value = new JSONObject().put("schema", "custodial.native-provider-event.v1");
            for (String field : new String[]{"event_id", "record_id", "action", "generation_id", "content_sha256", "receipt_job_id", "notification_key",
                "receipt_credential_id", "receipt_employee_id", "receipt_device_id", "principal_digest", "token_digest", "original_observation", "admitted_at"})
                value.put(field, event.get(field));
            // Strict payload already verified this exact decimal. HTTP contract uses an actual integer.
            value.put("receipt_assignment_epoch", Long.parseLong(event.getString("receipt_assignment_epoch")));
            wire = value.toString();
        }
        JSONObject original() throws Exception { return new JSONObject(original); }
        JSONObject wire() throws Exception { return new JSONObject(wire); }
    }
    static final class EventBatch {
        final long invalidationEpoch;
        final NativeProviderPrincipal principal;
        final Map<String, PendingEvent> events;
        private EventBatch(long invalidationEpoch, NativeProviderPrincipal principal, Map<String, PendingEvent> events) {
            this.invalidationEpoch = invalidationEpoch; this.principal = principal;
            this.events = Collections.unmodifiableMap(new java.util.LinkedHashMap<>(events));
        }
        byte[] body() throws VaultFailure {
            try {
                org.json.JSONArray list = new org.json.JSONArray(); for (PendingEvent event : events.values()) list.put(event.wire());
                byte[] bytes = new JSONObject().put("schema", "custodial.native-provider-events.v1").put("events", list).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                if (bytes.length > 65536) { Arrays.fill(bytes, (byte) 0); throw new VaultFailure("custodial_provider_request_too_large"); } return bytes;
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_event_invalid", error); }
        }
    }
    EventBatch pendingEvents(NativeProviderPrincipal current, int limit) throws VaultFailure {
        return transition(() -> {
            if (limit < 1 || limit > 16) throw new VaultFailure("custodial_provider_event_batch_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            Map<String, PendingEvent> result = new java.util.LinkedHashMap<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.EVENT) {
                JSONObject event = required(snapshot, key);
                if (!"CURRENT".equals(event.getString("authority_state")) || !"PENDING".equals(event.getString("state"))) continue;
                if (!current.same(NativeProviderPrincipal.fromNativeJournal(event.getJSONObject("principal")))) continue;
                requireEventGeneration(snapshot, current, event);
                PendingEvent pending = new PendingEvent(event);
                if (!key.id.equals(pending.id) || result.put(pending.id, pending) != null) throw corrupt();
                if (result.size() == limit) break;
            }
            EventBatch batch = new EventBatch(number(meta, "invalidation_epoch"), current, result);
            byte[] bounded = batch.body(); Arrays.fill(bounded, (byte) 0); return batch;
        });
    }
    void requireEventBatchCurrent(NativeProviderPrincipal current, EventBatch batch) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (batch == null || !current.same(batch.principal) || batch.invalidationEpoch != number(meta, "invalidation_epoch"))
                throw new VaultFailure("custodial_provider_operation_stale");
            for (PendingEvent expected : batch.events.values()) {
                JSONObject event = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, expected.id));
                requireEventGeneration(snapshot, current, event);
                if (!"CURRENT".equals(event.getString("authority_state")) || !"PENDING".equals(event.getString("state"))
                    || !NativeLegacyLineageJournal.same(event, expected.original())) throw new VaultFailure("custodial_provider_operation_stale");
            }
            return null;
        });
    }
    int settleEvents(NativeProviderPrincipal current, EventBatch batch, NativeProviderEventReceipts receipts) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (batch == null || receipts == null || !current.same(batch.principal) || batch.invalidationEpoch != number(meta, "invalidation_epoch"))
                throw new VaultFailure("custodial_provider_operation_stale");
            receipts.requireBatch(batch); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            for (String eventId : receipts.admittedIds()) {
                PendingEvent expected = batch.events.get(eventId); ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.EVENT, eventId);
                JSONObject event = required(snapshot, key); requireEventGeneration(snapshot, current, event);
                if (!"CURRENT".equals(event.getString("authority_state"))) throw new VaultFailure("custodial_provider_operation_stale");
                JSONObject admission = receipts.receipt(eventId);
                if ("SETTLED".equals(event.getString("state"))) {
                    JSONObject original = new JSONObject(event.toString()); original.put("state", "PENDING"); original.remove("admission");
                    if (!NativeLegacyLineageJournal.same(original, expected.original()) || !sameEventReceipt(event.getJSONObject("admission"), admission))
                        throw new VaultFailure("custodial_provider_event_receipt_invalid");
                    continue;
                }
                if (!"PENDING".equals(event.getString("state")) || !NativeLegacyLineageJournal.same(event, expected.original()))
                    throw new VaultFailure("custodial_provider_operation_stale");
                event.put("state", "SETTLED").put("admission", admission); put(writes, key, event);
            }
            if (!writes.isEmpty()) commit(snapshot, writes);
            return receipts.admittedIds().size(); // No record deletion, display change, cleaning reset or false partial-batch settlement.
        });
    }
    private static void requireEventGeneration(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, JSONObject event) throws Exception {
        if (!current.same(NativeProviderPrincipal.fromNativeJournal(event.getJSONObject("principal")))) throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject generation = required(snapshot, generationKey(event.getString("generation_id")));
        if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
            || !event.getString("token_digest").equals(generation.getString("token_digest"))
            || !event.getString("principal_digest").equals(current.digest)) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static boolean sameEventReceipt(JSONObject left, JSONObject right) throws Exception {
        JSONObject a = new JSONObject(left.toString()), b = new JSONObject(right.toString()); a.remove("replayed"); b.remove("replayed");
        return NativeLegacyLineageJournal.same(a, b);
    }

    /** SDK deletion/lifecycle wakeup: persist need without inventing message IDs or authority. */
    long requestRecovery() throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            long epoch = increment(number(meta, "recovery_epoch")); meta.put("recovery_epoch", epoch);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, META, meta); commit(snapshot, writes); return epoch;
        });
    }

    /** One frozen scan per full-principal binding. New wakeups coalesce behind its ceiling.
     * Null means this captured need was completely checkpointed, not that OS effects ran. */
    NativeProviderInventory.Request prepareInventory(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            String id = "recovery-" + meta.getString("binding_id"); ProviderRecordStore.Key key = recoveryKey(id);
            JSONObject recovery = snapshot.keys().contains(key) ? requiredRecovery(snapshot, key, current)
                : new JSONObject().put("schema", SCHEMA).put("authority_state", "CURRENT").put("principal", current.json())
                    .put("completed_epoch", 0).put("scan", JSONObject.NULL).put("completed_scan", JSONObject.NULL).put("last_restarted_scan", JSONObject.NULL);
            if (recovery.get("scan") != JSONObject.NULL)
                return new NativeProviderInventory.Request(current, number(meta, "invalidation_epoch"), id, recovery.getJSONObject("scan"));
            if (number(recovery, "completed_epoch") == number(meta, "recovery_epoch")) return null;
            if (number(recovery, "completed_epoch") > number(meta, "recovery_epoch")) throw corrupt();
            org.json.JSONArray generations = new org.json.JSONArray();
            for (ProviderRecordStore.Key candidate : snapshot.keys()) if (candidate.domain == ProviderEnvelopeCrypto.Domain.GENERATION) {
                JSONObject generation = required(snapshot, candidate);
                if (Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
                    && current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))) generations.put(candidate.id);
            }
            if (generations.length() == 0) throw new VaultFailure("custodial_provider_recovery_waiting_confirmation");
            if (generations.length() > 32) throw corrupt();
            JSONObject scan = new JSONObject().put("scan_id", UUID.randomUUID().toString()).put("captured_epoch", number(meta, "recovery_epoch"))
                .put("generation_ids", generations).put("cursor", JSONObject.NULL).put("ceiling", JSONObject.NULL)
                .put("server_now", JSONObject.NULL).put("pages", 0);
            recovery.put("scan", scan); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, key, recovery); commit(snapshot, writes);
            return new NativeProviderInventory.Request(current, number(meta, "invalidation_epoch"), id, scan);
        });
    }

    void requireInventoryCurrent(NativeProviderPrincipal current, NativeProviderInventory.Request request) throws VaultFailure {
        transition(() -> { requireInventory(store.load(), current, request); return null; });
    }
    void restartInventory(NativeProviderPrincipal current, NativeProviderInventory.Request request,
        NativeProviderInventory.CursorRejection rejection) throws VaultFailure {
        transition(() -> {
            if (rejection == null) throw new VaultFailure("custodial_provider_inventory_invalid"); rejection.requireRequest(request);
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject recovery = requireInventory(snapshot, current, request);
            recovery.put("last_restarted_scan", request.scan()).put("scan", JSONObject.NULL);
            // completed_epoch is untouched: no clearing of recovery need or accepted record.
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recoveryKey(request.recoveryId), recovery); commit(snapshot, writes); return null;
        });
    }

    /** Every row is durable BEFORE advancing its cursor. A crash after any row just dedupes
     * those original records on retry. Errors never clear need or fabricate device receipts. */
    int consumeInventory(NativeProviderPrincipal current, NativeProviderInventory.Request request,
        NativeProviderInventory.Page page, Observation observation) throws VaultFailure {
        return transition(() -> {
            if (page == null || observation == null) throw new VaultFailure("custodial_provider_inventory_invalid");
            page.requireRequest(request); requireInventory(store.load(), current, request);
            for (NativeProviderPayload payload : page.rows) recordArrival(current, payload, observation);
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject recovery = requireInventory(snapshot, current, request);
            JSONObject scan = request.scan(), data = page.data();
            scan.put("cursor", data.get("cursor")).put("ceiling", data.get("ceiling")).put("server_now", data.get("server_now"))
                .put("pages", increment(number(scan, "pages")));
            if (page.hasMore) recovery.put("scan", scan);
            else recovery.put("completed_epoch", number(scan, "captured_epoch")).put("completed_scan", scan).put("scan", JSONObject.NULL);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recoveryKey(request.recoveryId), recovery); commit(snapshot, writes);
            return page.rows.size();
        });
    }
    private static JSONObject requireInventory(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current,
        NativeProviderInventory.Request request) throws Exception {
        JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
        if (request == null || !current.same(request.principal) || request.invalidationEpoch != number(meta, "invalidation_epoch")
            || !request.recoveryId.equals("recovery-" + meta.getString("binding_id"))) throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject recovery = requiredRecovery(snapshot, recoveryKey(request.recoveryId), current);
        if (recovery.get("scan") == JSONObject.NULL || !ProviderWireJson.same(recovery.getJSONObject("scan"), request.scan()))
            throw new VaultFailure("custodial_provider_operation_stale");
        org.json.JSONArray generations = request.scan().getJSONArray("generation_ids");
        for (int i = 0; i < generations.length(); i++) {
            JSONObject generation = required(snapshot, generationKey(generations.getString(i)));
            if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.getString("state"))
                || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal"))))
                throw new VaultFailure("custodial_provider_operation_stale");
        }
        return recovery;
    }
    private static JSONObject requiredRecovery(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key,
        NativeProviderPrincipal current) throws Exception {
        JSONObject value = required(snapshot, key);
        if (value.length() != 7 || !"CURRENT".equals(value.get("authority_state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(value.getJSONObject("principal")))) throw corrupt();
        number(value, "completed_epoch");
        for (String field : new String[]{"scan", "completed_scan", "last_restarted_scan"}) if (value.get(field) != JSONObject.NULL) {
            JSONObject scan = value.getJSONObject(field);
            if (scan.length() != 7) throw corrupt();
            NativeLegacyLineageJournal.uuid(scan.getString("scan_id")); number(scan, "captured_epoch"); number(scan, "pages");
            org.json.JSONArray generations = scan.getJSONArray("generation_ids");
            if (generations.length() < 1 || generations.length() > 32) throw corrupt();
            java.util.HashSet<String> unique = new java.util.HashSet<>();
            for (int i = 0; i < generations.length(); i++) {
                String id = NativeLegacyLineageJournal.uuid(generations.getString(i)); if (!unique.add(id)) throw corrupt();
            }
            NativeProviderInventory.validateScanBounds(scan);
        }
        return value;
    }
    private static ProviderRecordStore.Key recoveryKey(String id) { return recordKey(ProviderEnvelopeCrypto.Domain.METADATA, id); }

    /** Native-owned immutable identity for one already-admitted record. Never accepts JS payload. */
    static final class Presentation {
        final NativeProviderPrincipal principal;
        final NativeProviderPayload payload;
        final long invalidationEpoch;
        private final String record;
        private Presentation(NativeProviderPrincipal principal, long epoch, JSONObject record) throws Exception {
            this.principal = principal; invalidationEpoch = epoch; this.record = record.toString();
            payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload"));
        }
        JSONObject record() throws Exception { return new JSONObject(record); }
    }
    static final class OsDisplayIntent {
        final Presentation presentation;
        final String attemptId, tag;
        private OsDisplayIntent(Presentation presentation, String attemptId) {
            this.presentation = presentation; this.attemptId = attemptId; tag = "mz-provider:" + presentation.payload.recordId;
        }
    }
    static final class OsCancellation {
        final String recordId, contentHash, tag;
        final long sequence;
        private OsCancellation(JSONObject record) throws Exception {
            recordId = record.getString("record_id"); contentHash = record.getString("content_sha256");
            tag = "mz-provider:" + recordId; sequence = number(record, "cancel_sequence");
        }
    }
    Presentation presentation(NativeProviderPrincipal current, String recordId) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            JSONObject record = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, recordId));
            NativeProviderPayload payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload"));
            requireRecordBinding(record, current, payload); requirePresentationGeneration(snapshot, current, payload);
            if (!"ADMITTED".equals(record.getString("state")) || !payload.recordId.equals(recordId)) throw corrupt();
            return new Presentation(current, number(meta, "invalidation_epoch"), record);
        });
    }
    java.util.List<String> admittedRecordIds(NativeProviderPrincipal current) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); requireAvailable(metadata(snapshot), current);
            java.util.List<String> ids = new java.util.ArrayList<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                JSONObject record = required(snapshot, key);
                if ("CURRENT".equals(record.getString("authority_state")) && current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) ids.add(key.id);
            }
            return Collections.unmodifiableList(ids);
        });
    }
    void requirePresentationCurrent(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> { requirePresentation(store.load(), current, expected); return null; });
    }
    OsDisplayIntent prepareOsDisplay(NativeProviderPrincipal current, Presentation expected, Observation observation) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            requireLive(expected.payload, observation);
            if (!record.isNull("displayed_event_id") || record.getBoolean("card_dismissed") || !record.isNull("opened_event_id")
                || !record.isNull("acknowledged_event_id") || record.getBoolean("os_cancel_pending")) return null;
            if ("DISPLAY_UNCERTAIN".equals(record.getString("display_state")))
                return new OsDisplayIntent(expected, record.getString("os_attempt_id")); // Inspect exact active item before re-notify.
            if (!"PENDING_DISPLAY".equals(record.getString("display_state")) || !record.isNull("os_attempt_id")) throw corrupt();
            String id = UUID.randomUUID().toString(); record.put("display_state", "DISPLAY_UNCERTAIN").put("os_attempt_id", id);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record);
            commit(snapshot, writes); return new OsDisplayIntent(expected, id); // Persist/readback BEFORE notify.
        });
    }
    /** OS adapter calls only after matching the exact tagged active item and enabled channel.
     * A successful notify() call alone MUST NOT call this transition. */
    void confirmOsDisplayed(NativeProviderPrincipal current, OsDisplayIntent intent, Observation observation) throws VaultFailure {
        transition(() -> {
            if (intent == null) throw new VaultFailure("custodial_provider_display_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, intent.presentation);
            requireLive(intent.presentation.payload, observation);
            if (!intent.attemptId.equals(record.get("os_attempt_id")) || record.getBoolean("os_cancel_pending")
                || record.getBoolean("card_dismissed") || !record.isNull("opened_event_id") || !record.isNull("acknowledged_event_id"))
                throw new VaultFailure("custodial_provider_operation_stale");
            if (!record.isNull("displayed_event_id")) return null;
            if (!"DISPLAY_UNCERTAIN".equals(record.getString("display_state"))) throw corrupt();
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); appendPresentationEvent(record, intent.presentation.payload, "displayed", observation, writes);
            record.put("display_state", "DISPLAYED"); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, intent.presentation.payload.recordId), record);
            commit(snapshot, writes); return null;
        });
    }
    /** Finite internal mirror/action transitions. Bridge must additionally require an opaque
     * current native claim; Android action components obtain identity ONLY from native inbox. */
    void applyPresentationAction(NativeProviderPrincipal current, Presentation expected, String action, Observation observation) throws VaultFailure {
        transition(() -> {
            if (!Arrays.asList("displayed", "opened", "acknowledged", "dismissed", "audio_started", "audio_completed", "navigation_completed").contains(action)
                || observation == null) throw new VaultFailure("custodial_provider_action_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if ("displayed".equals(action)) {
                requireLive(expected.payload, observation);
                if (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id")) throw new VaultFailure("custodial_provider_operation_stale");
                if (record.getBoolean("mirror_rendered")) return null;
                if (record.isNull("displayed_event_id")) appendPresentationEvent(record, expected.payload, action, observation, writes);
                record.put("display_state", "DISPLAYED").put("mirror_rendered", true);
            } else if ("opened".equals(action) || "acknowledged".equals(action)) {
                if (!record.isNull(action + "_event_id")) return null;
                appendPresentationEvent(record, expected.payload, action, observation, writes); queueOsCancel(record); record.put("mirror_retire_pending", true);
                if ("opened".equals(action)) record.put("navigation_pending", true); // Durable BEFORE Activity launch or JS navigation.
            } else if ("dismissed".equals(action)) {
                if (record.getBoolean("card_dismissed")) return null;
                record.put("card_dismissed", true).put("mirror_retire_pending", true); queueOsCancel(record);
                // Local only: no backend acknowledgment, no interruption of the existing audio sequence.
            } else if ("audio_started".equals(action)) {
                if ("COMPLETED".equals(record.getString("audio_state")) || "IN_PROGRESS".equals(record.getString("audio_state"))) return null;
                if (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id")) throw new VaultFailure("custodial_provider_operation_stale");
                if (!record.getBoolean("navigation_pending")) requireLive(expected.payload, observation);
                record.put("audio_state", "IN_PROGRESS");
            } else if ("audio_completed".equals(action)) {
                if ("COMPLETED".equals(record.getString("audio_state"))) return null;
                if (!"IN_PROGRESS".equals(record.getString("audio_state"))) throw new VaultFailure("custodial_provider_action_invalid");
                record.put("audio_state", "COMPLETED");
            } else {
                if (record.isNull("opened_event_id")) throw new VaultFailure("custodial_provider_action_invalid");
                if (!record.getBoolean("navigation_pending")) return null;
                record.put("navigation_pending", false);
            }
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void requestOsCancellation(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            if (record.getBoolean("os_cancel_pending")) return null;
            queueOsCancel(record); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void confirmMirrorRetired(NativeProviderPrincipal current, Presentation expected) throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject record = requirePresentation(snapshot, current, expected);
            if (!record.getBoolean("mirror_retire_pending")) return null;
            record.put("mirror_retire_pending", false); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            put(writes, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId), record); commit(snapshot, writes); return null;
        });
    }
    void applyOsAction(NativeProviderPrincipal current, String recordId, String attemptId, String action, Observation observation) throws VaultFailure {
        transition(() -> {
            if (!Arrays.asList("opened", "acknowledged", "dismissed").contains(action)) throw new VaultFailure("custodial_provider_action_invalid");
            Presentation presentation = presentation(current, recordId);
            JSONObject record = requirePresentation(store.load(), current, presentation);
            if (attemptId == null || !attemptId.equals(record.get("os_attempt_id"))) throw new VaultFailure("custodial_provider_operation_stale");
            applyPresentationAction(current, presentation, action, observation); return null;
        });
    }
    java.util.List<OsCancellation> pendingOsCancellations() throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); metadata(snapshot); java.util.List<OsCancellation> result = new java.util.ArrayList<>();
            for (ProviderRecordStore.Key key : snapshot.keys()) if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                JSONObject record = required(snapshot, key); if (record.getBoolean("os_cancel_pending")) result.add(new OsCancellation(record));
            }
            return Collections.unmodifiableList(result);
        });
    }
    /** Exact cancellation may finish AFTER removal; never needs the successor's credential.
     * Caller proves exact tagged item absent, not merely that cancel() returned. */
    void confirmOsCanceled(OsCancellation expected) throws VaultFailure {
        transition(() -> {
            if (expected == null) throw new VaultFailure("custodial_provider_action_invalid"); ProviderRecordStore.Snapshot snapshot = store.load();
            ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.recordId); JSONObject record = required(snapshot, key);
            if (!expected.contentHash.equals(record.get("content_sha256")) || expected.sequence != number(record, "cancel_sequence"))
                throw new VaultFailure("custodial_provider_operation_stale");
            if (!record.getBoolean("os_cancel_pending")) return null;
            record.put("os_cancel_pending", false).put("os_attempt_id", JSONObject.NULL);
            if (record.isNull("displayed_event_id")) record.put("display_state", "PENDING_DISPLAY");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, key, record); commit(snapshot, writes); return null;
        });
    }
    private static void queueOsCancel(JSONObject record) throws Exception {
        if (!record.getBoolean("os_cancel_pending")) record.put("cancel_sequence", increment(number(record, "cancel_sequence"))).put("os_cancel_pending", true);
    }
    private static JSONObject requirePresentation(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, Presentation expected) throws Exception {
        JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
        if (expected == null || expected.invalidationEpoch != number(meta, "invalidation_epoch") || !current.same(expected.principal))
            throw new VaultFailure("custodial_provider_operation_stale");
        JSONObject record = required(snapshot, recordKey(ProviderEnvelopeCrypto.Domain.INBOX, expected.payload.recordId));
        requireRecordBinding(record, current, expected.payload); requirePresentationGeneration(snapshot, current, expected.payload);
        if (!"ADMITTED".equals(record.get("state"))) throw corrupt(); return record;
    }
    private static void requirePresentationGeneration(ProviderRecordStore.Snapshot snapshot, NativeProviderPrincipal current, NativeProviderPayload payload) throws Exception {
        JSONObject generation = required(snapshot, generationKey(payload.generationId));
        if (!Arrays.asList("CONFIRMED", "DISPATCH_RETIRED_ARRIVAL_DRAINING").contains(generation.get("state"))
            || !current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
            || !payload.tokenDigest.equals(generation.get("token_digest"))) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static void requireLive(NativeProviderPayload payload, Observation observation) throws VaultFailure {
        if (observation == null || observation.authenticatedAt == null || observation.authenticatedAt.isBefore(payload.reservedAt)
            || !observation.authenticatedAt.isBefore(payload.validUntil)) throw new VaultFailure("custodial_provider_display_time_unavailable");
    }
    private static void appendPresentationEvent(JSONObject record, NativeProviderPayload payload, String action, Observation observation,
        Map<ProviderRecordStore.Key, char[]> writes) throws Exception {
        String id = UUID.randomUUID().toString(); record.put(action + "_event_id", id);
        JSONObject event = new JSONObject().put("schema", SCHEMA).put("event_id", id).put("record_id", payload.recordId)
            .put("state", "PENDING").put("authority_state", "CURRENT").put("action", action).put("principal", record.getJSONObject("principal"))
            .put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
            .put("original_observation", observation.json()).put("admitted_at", record.getString("accepted_at"));
        for (String field : new String[]{"receipt_job_id", "notification_key", "receipt_credential_id", "receipt_employee_id", "receipt_device_id",
            "receipt_assignment_epoch", "principal_digest", "token_digest"}) event.put(field, payload.get(field));
        put(writes, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, id), event);
    }

    /** Bounded safe compaction only; unresolved, foreign, corrupt or uncertain records are
     * never evicted. Original NFC/cleaning/enrollment namespaces are not accessed. */
    int compactSettledRecords(NativeProviderPrincipal current, Observation observation, int limit) throws VaultFailure {
        return transition(() -> {
            if (limit < 1 || limit > 16 || observation == null || observation.authenticatedAt == null)
                throw new VaultFailure("custodial_provider_compaction_unavailable");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); Set<ProviderRecordStore.Key> removals = new java.util.HashSet<>(); int compacted = 0;
            for (ProviderRecordStore.Key key : snapshot.keys()) {
                if (compacted == limit) break;
                if (key.domain == ProviderEnvelopeCrypto.Domain.TOMBSTONE) {
                    JSONObject tombstone = requiredTombstone(snapshot, key);
                    if (!"CURRENT".equals(tombstone.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(tombstone.getJSONObject("principal")))) continue;
                    if (!observation.authenticatedAt.isBefore(NativeProviderPayload.timestamp(tombstone.getString("dedupe_until")))) { removals.add(key); compacted++; }
                    continue;
                }
                if (key.domain != ProviderEnvelopeCrypto.Domain.INBOX) continue;
                JSONObject record = required(snapshot, key);
                if (!"CURRENT".equals(record.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) continue;
                NativeProviderPayload payload = NativeProviderPayload.fromInventory(record.getJSONObject("payload")); requireRecordBinding(record, current, payload);
                if (observation.authenticatedAt.isBefore(payload.validUntil) || !"DISPLAYED".equals(record.get("display_state"))
                    || record.getBoolean("os_cancel_pending") || !record.isNull("os_attempt_id") || record.getBoolean("mirror_retire_pending")
                    || record.getBoolean("navigation_pending") || (record.getBoolean("mirror_rendered") && !"COMPLETED".equals(record.get("audio_state")))) continue;
                if (!record.getBoolean("card_dismissed") && record.isNull("opened_event_id") && record.isNull("acknowledged_event_id")) continue;
                Map<String, String> eventActions = new HashMap<>();
                for (String action : new String[]{"received", "displayed", "opened", "acknowledged"}) if (!record.isNull(action + "_event_id"))
                    eventActions.put(record.getString(action + "_event_id"), action);
                if (!eventActions.containsValue("received") || !eventActions.containsValue("displayed")) throw corrupt();
                Set<ProviderRecordStore.Key> ownedEvents = new java.util.HashSet<>(); org.json.JSONArray admissions = new org.json.JSONArray(); boolean pending = false;
                for (ProviderRecordStore.Key eventKey : snapshot.keys()) if (eventKey.domain == ProviderEnvelopeCrypto.Domain.EVENT) {
                    JSONObject event = required(snapshot, eventKey); if (!payload.recordId.equals(event.get("record_id"))) continue;
                    if (!eventKey.id.equals(event.get("event_id")) || !eventActions.containsKey(eventKey.id) || !eventActions.get(eventKey.id).equals(event.get("action"))) throw corrupt();
                    requireEventGeneration(snapshot, current, event);
                    if (!"CURRENT".equals(event.get("authority_state")) || !payload.contentHash.equals(event.get("content_sha256"))) throw corrupt();
                    ownedEvents.add(eventKey);
                    if ("PENDING".equals(event.get("state"))) { pending = true; continue; }
                    if (!"SETTLED".equals(event.get("state")) || !NativeProviderEventReceipts.matches(new PendingEvent(event), event.getJSONObject("admission"))) throw corrupt();
                    admissions.put(new JSONObject().put("event_id", eventKey.id).put("action", event.get("action"))
                        .put("server_received_at", event.getJSONObject("admission").get("server_received_at")));
                }
                if (ownedEvents.size() != eventActions.size()) throw corrupt(); if (pending) continue;
                ProviderRecordStore.Key tombstoneKey = recordKey(ProviderEnvelopeCrypto.Domain.TOMBSTONE, key.id);
                if (snapshot.keys().contains(tombstoneKey)) throw corrupt();
                JSONObject tombstone = new JSONObject().put("schema", SCHEMA).put("authority_state", "CURRENT").put("state", "EXPIRED_SETTLED")
                    .put("record_id", payload.recordId).put("generation_id", payload.generationId).put("principal", current.json())
                    .put("content_sha256", payload.contentHash).put("token_digest", payload.tokenDigest).put("receipt_job_id", payload.jobId)
                    .put("notification_key", payload.notificationKey).put("valid_until", payload.get("valid_until"))
                    .put("dedupe_until", canonicalTime(payload.validUntil.plusSeconds(48 * 3600))).put("admissions", admissions);
                put(writes, tombstoneKey, tombstone); removals.add(key); removals.addAll(ownedEvents); compacted++;
            }
            if (compacted > 0) {
                meta.put("recovery_epoch", increment(number(meta, "recovery_epoch"))); put(writes, META, meta); commit(snapshot, writes, removals);
            }
            return compacted;
        });
    }
    private static JSONObject requiredTombstone(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key) throws Exception {
        JSONObject record = required(snapshot, key);
        if (record.length() != 13 || !"EXPIRED_SETTLED".equals(record.get("state")) || !key.id.equals(record.get("record_id"))) throw corrupt();
        String generation = NativeLegacyLineageJournal.uuid(record.getString("generation_id")), job = NativeLegacyLineageJournal.uuid(record.getString("receipt_job_id"));
        NativeLegacyLineageJournal.hex(record.getString("content_sha256")); NativeLegacyLineageJournal.hex(record.getString("token_digest"));
        NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"));
        if (!NativeProviderPrincipal.hash(generation + "\n" + job + "\n" + record.getString("notification_key")).equals(key.id)
            || !canonicalTime(NativeProviderPayload.timestamp(record.getString("valid_until")).plusSeconds(48 * 3600)).equals(record.get("dedupe_until"))) throw corrupt();
        org.json.JSONArray rows = record.getJSONArray("admissions"); Set<String> actions = new java.util.HashSet<>(), ids = new java.util.HashSet<>();
        if (rows.length() < 2 || rows.length() > 4) throw corrupt();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i); String action = row.getString("action");
            if (row.length() != 3 || !Arrays.asList("received", "displayed", "opened", "acknowledged").contains(action)
                || !actions.add(action) || !ids.add(NativeLegacyLineageJournal.uuid(row.getString("event_id")))) throw corrupt();
            NativeProviderPayload.timestamp(row.getString("server_received_at"));
        }
        if (!actions.contains("received") || !actions.contains("displayed")) throw corrupt(); return record;
    }

    /** Call only with an SDK-origin or authenticated inventory payload, under runtime principal fencing.
     * Result describes journal state, NOT permission to notify/navigate. Effects revalidate separately. */
    Arrival recordArrival(NativeProviderPrincipal current, NativeProviderPayload payload, Observation observation) throws VaultFailure {
        return transition(() -> {
            if (payload == null || observation == null) throw new VaultFailure("custodial_provider_observation_invalid");
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            payload.requirePrincipal(current);
            ProviderRecordStore.Key tombstoneKey = recordKey(ProviderEnvelopeCrypto.Domain.TOMBSTONE, payload.recordId);
            if (snapshot.keys().contains(tombstoneKey)) {
                JSONObject tombstone = requiredTombstone(snapshot, tombstoneKey);
                if (!current.same(NativeProviderPrincipal.fromNativeJournal(tombstone.getJSONObject("principal")))
                    || !"CURRENT".equals(tombstone.get("authority_state"))) throw new VaultFailure("custodial_provider_generation_refused");
                if (!payload.contentHash.equals(tombstone.get("content_sha256")) || !payload.get("valid_until").equals(tombstone.get("valid_until")))
                    throw new VaultFailure("custodial_provider_payload_conflict");
                throw new VaultFailure("custodial_provider_payload_expired"); // Never reconstruct an inbox/event from a compacted identity.
            }
            ProviderRecordStore.Key generationKey = generationKey(payload.generationId);
            if (!snapshot.keys().contains(generationKey)) throw new VaultFailure("custodial_provider_generation_unknown");
            JSONObject generation = required(snapshot, generationKey);
            if (!current.same(NativeProviderPrincipal.fromNativeJournal(generation.getJSONObject("principal")))
                || !payload.principalDigest.equals(generation.get("principal_digest")) || !payload.tokenDigest.equals(generation.get("token_digest"))
                || "REVOKED_OR_FOREIGN".equals(generation.getString("state"))) throw new VaultFailure("custodial_provider_generation_refused");
            ProviderRecordStore.Key inboxKey = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, payload.recordId);
            ProviderRecordStore.Key quarantineKey = recordKey(ProviderEnvelopeCrypto.Domain.QUARANTINE, payload.recordId);
            if (snapshot.keys().contains(inboxKey) && snapshot.keys().contains(quarantineKey)) throw corrupt();
            JSONObject existing = snapshot.keys().contains(inboxKey) ? required(snapshot, inboxKey)
                : snapshot.keys().contains(quarantineKey) ? required(snapshot, quarantineKey) : null;
            if (existing != null) {
                requireRecordBinding(existing, current, payload);
                if ("ADMITTED".equals(existing.getString("state"))) return new Arrival(payload.recordId, "ADMITTED", false);
                if (!"QUARANTINED".equals(existing.getString("state"))) throw corrupt();
            }
            String reason = admissionWaitReason(meta, generation, payload, observation.authenticatedAt);
            if (observation.authenticatedAt != null && !observation.authenticatedAt.isBefore(payload.validUntil))
                throw new VaultFailure("custodial_provider_payload_expired");
            if (existing != null && reason != null) return new Arrival(payload.recordId, "QUARANTINED", false);
            JSONObject record = existing == null ? new JSONObject().put("schema", SCHEMA).put("record_id", payload.recordId)
                .put("principal", current.json()).put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
                .put("payload", payload.json()).put("authority_state", "CURRENT").put("received_observation", observation.json()) : existing;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); Set<ProviderRecordStore.Key> removals = Collections.emptySet();
            if (reason != null) {
                record.put("state", "QUARANTINED").put("quarantine_reason", reason);
                put(writes, quarantineKey, record); commit(snapshot, writes);
                return new Arrival(payload.recordId, "QUARANTINED", false);
            }
            String eventId = UUID.randomUUID().toString();
            record.put("state", "ADMITTED").put("quarantine_reason", JSONObject.NULL).put("accepted_at", canonicalTime(observation.authenticatedAt))
                .put("received_event_id", eventId).put("display_state", "PENDING_DISPLAY")
                .put("os_tag", "mz-provider:" + payload.recordId).put("os_cancel_pending", false).put("mirror_retire_pending", false)
                .put("os_attempt_id", JSONObject.NULL).put("cancel_sequence", 0).put("displayed_event_id", JSONObject.NULL)
                .put("opened_event_id", JSONObject.NULL).put("acknowledged_event_id", JSONObject.NULL)
                .put("card_dismissed", false).put("mirror_rendered", false).put("audio_state", "PENDING").put("navigation_pending", false);
            JSONObject event = new JSONObject().put("schema", SCHEMA).put("event_id", eventId).put("record_id", payload.recordId)
                .put("state", "PENDING").put("authority_state", "CURRENT").put("action", "received")
                .put("principal", current.json()).put("generation_id", payload.generationId).put("content_sha256", payload.contentHash)
                .put("original_observation", record.getJSONObject("received_observation")).put("admitted_at", canonicalTime(observation.authenticatedAt));
            for (String field : new String[]{"receipt_job_id", "notification_key", "receipt_credential_id", "receipt_employee_id", "receipt_device_id",
                "receipt_assignment_epoch", "principal_digest", "token_digest"}) event.put(field, payload.get(field));
            put(writes, inboxKey, record); put(writes, recordKey(ProviderEnvelopeCrypto.Domain.EVENT, eventId), event);
            if (existing != null) removals = Collections.singleton(quarantineKey);
            commit(snapshot, writes, removals);
            return new Arrival(payload.recordId, "ADMITTED", true);
        });
    }

    /** Re-read original quarantine, never substitute caller content/observation on confirmation or restart. */
    Arrival drainQuarantine(NativeProviderPrincipal current, String recordId, Observation currentObservation) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); requireAvailable(metadata(snapshot), current);
            ProviderRecordStore.Key key = recordKey(ProviderEnvelopeCrypto.Domain.QUARANTINE, recordId);
            if (!snapshot.keys().contains(key)) {
                key = recordKey(ProviderEnvelopeCrypto.Domain.INBOX, recordId);
                if (!snapshot.keys().contains(key)) throw new VaultFailure("custodial_provider_quarantine_missing");
            }
            JSONObject record = required(snapshot, key);
            return recordArrival(current, NativeProviderPayload.fromInventory(record.getJSONObject("payload")), currentObservation);
        });
    }
    private static String admissionWaitReason(JSONObject meta, JSONObject generation, NativeProviderPayload payload, Instant now) throws Exception {
        String state = generation.getString("state");
        if ("PREPARED_QUARANTINE".equals(state)) {
            if (!payload.generationId.equals(meta.get("pending_generation"))) throw corrupt();
            return "GENERATION_UNCONFIRMED";
        }
        if (!"CONFIRMED".equals(state) && !"DISPATCH_RETIRED_ARRIVAL_DRAINING".equals(state)) throw new VaultFailure("custodial_provider_generation_refused");
        if (payload.reservedAt.isBefore(NativeProviderPayload.timestamp(generation.getString("activated_at"))))
            throw new VaultFailure("custodial_provider_reservation_refused");
        if ("DISPATCH_RETIRED_ARRIVAL_DRAINING".equals(state)
            && payload.reservedAt.isAfter(NativeProviderPayload.timestamp(generation.getString("dispatch_retired_at"))))
            throw new VaultFailure("custodial_provider_reservation_refused");
        if ("CONFIRMED".equals(state) && meta.get("pending_generation") != JSONObject.NULL) return "RETIREMENT_UNCONFIRMED";
        if (now == null || now.isBefore(payload.reservedAt)) return "AUTHENTICATED_TIME_UNCERTAIN";
        return null;
    }
    private static void requireRecordBinding(JSONObject record, NativeProviderPrincipal current, NativeProviderPayload payload) throws Exception {
        if (!"CURRENT".equals(record.get("authority_state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal"))))
            throw new VaultFailure("custodial_provider_generation_refused");
        if (!payload.recordId.equals(record.get("record_id")) || !payload.contentHash.equals(record.get("content_sha256"))
            || !NativeLegacyLineageJournal.same(payload.json(), record.getJSONObject("payload"))) throw new VaultFailure("custodial_provider_payload_conflict");
    }
    private static String canonicalTime(Instant value) { return new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(value); }
    private static ProviderRecordStore.Key recordKey(ProviderEnvelopeCrypto.Domain domain, String id) { return ProviderRecordStore.key(domain, id); }

    /** Exact native Firebase observation, durable before scheduling/legacy forwarding. */
    long captureToken(String token) throws VaultFailure {
        if (token == null || token.length() < 1 || token.length() > 4096 || token.codePoints().anyMatch(Character::isISOControl))
            throw new VaultFailure("custodial_provider_token_invalid");
        // SDK token is opaque; do not invent an alphabet or normalize its bytes.
        byte[] utf8 = token.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
            if (utf8.length > 4096 || !token.equals(new String(utf8, java.nio.charset.StandardCharsets.UTF_8)))
                throw new VaultFailure("custodial_provider_token_invalid");
        } finally { Arrays.fill(utf8, (byte) 0); }
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            long previous = number(meta, "capture_sequence");
            String digest = NativeProviderPrincipal.hash(token);
            if (previous > number(meta, "retired_capture_sequence")) {
                JSONObject old = required(snapshot, tokenKey(previous));
                if ("UNBOUND_TOKEN".equals(old.getString("state")) && digest.equals(old.getString("token_digest")) && token.equals(old.getString("token"))) return previous;
            }
            long sequence = increment(previous);
            JSONObject record = new JSONObject().put("schema", SCHEMA).put("state", "UNBOUND_TOKEN")
                .put("capture_sequence", sequence).put("capture_epoch", number(meta, "invalidation_epoch"))
                .put("token", token).put("token_digest", digest);
            meta.put("capture_sequence", sequence);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, tokenKey(sequence), record); put(writes, META, meta);
            commit(snapshot, writes); return sequence;
        });
    }

    /** Runtime must observe engine/native journal under engine-before-provider ordering. */
    void observeActivePrincipal(NativeProviderPrincipal principal) throws VaultFailure {
        if (principal == null) throw new VaultFailure("custodial_provider_principal_required");
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            NativeProviderPrincipal previous = principal(meta);
            boolean changed = previous != null ? !previous.same(principal) : meta.getBoolean("ever_bound");
            if (!changed && previous != null && "AVAILABLE".equals(meta.getString("availability"))) return null;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if (changed) retireRegistrationRecords(snapshot, meta, writes);
            if (previous == null || changed) meta.put("binding_id", UUID.randomUUID().toString());
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch")))
                .put("recovery_epoch", increment(number(meta, "recovery_epoch")))
                .put("availability", "AVAILABLE").put("principal", principal.json()).put("ever_bound", true);
            put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    /** Transient absence denies authority and retires claims, not stored identity or original work. */
    void observeUnavailable() throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            if (!"AVAILABLE".equals(meta.getString("availability"))) return null;
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch"))).put("availability", "UNAVAILABLE");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    /** Called only after actual inactive/removal engine state, never a user-canceled ACTIVE gate.
     * Pure fence/intent only: production finalizeRemoval still requires OS/mirror runtime integration. */
    void observeRemoved() throws VaultFailure {
        transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            if (!meta.getBoolean("ever_bound")) return null; // Initial unbound Firebase token is retained.
            if ("REMOVED".equals(meta.getString("availability"))
                && number(meta, "retired_capture_sequence") == number(meta, "capture_sequence")) return null;
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); retireRegistrationRecords(snapshot, meta, writes);
            meta.put("invalidation_epoch", increment(number(meta, "invalidation_epoch")))
                .put("availability", "REMOVED").put("principal", JSONObject.NULL);
            put(writes, META, meta); commit(snapshot, writes); return null;
        });
    }

    Prepared prepareRegistration(NativeProviderPrincipal current, NativeProviderAppIdentity nativeApp) throws VaultFailure {
        if (nativeApp == null) throw new VaultFailure("custodial_provider_native_build_identity_invalid");
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot);
            requireAvailable(meta, current);
            Object pending = meta.get("pending_generation");
            if (pending != JSONObject.NULL) {
                JSONObject existing = required(snapshot, generationKey((String) pending));
                requirePrepared(existing, current);
                return new Prepared(existing); // Resolve original operation BEFORE a newer token.
            }
            long sequence = number(meta, "capture_sequence");
            if (sequence <= number(meta, "retired_capture_sequence")) throw new VaultFailure("custodial_provider_fresh_native_token_required");
            JSONObject token = required(snapshot, tokenKey(sequence));
            if (!"UNBOUND_TOKEN".equals(token.getString("state")) || sequence != number(token, "capture_sequence")) throw corrupt();
            String digest = token.getString("token_digest");
            if (!digest.equals(NativeProviderPrincipal.hash(token.getString("token")))) throw corrupt();
            if (meta.get("current_generation") != JSONObject.NULL) {
                JSONObject active = required(snapshot, generationKey(meta.getString("current_generation")));
                if (!"CONFIRMED".equals(active.getString("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(active.getJSONObject("principal")))) throw corrupt();
                if (digest.equals(active.getString("token_digest"))) return new Prepared(active); // Already confirmed, no new register HTTP.
            }
            String operation = UUID.randomUUID().toString(), generation = UUID.randomUUID().toString();
            JSONObject record = new JSONObject().put("schema", SCHEMA).put("state", "PREPARED_QUARANTINE")
                .put("generation_id", generation).put("operation_id", operation).put("principal", current.json())
                .put("principal_digest", current.digest).put("token_digest", digest).put("capture_sequence", sequence)
                .put("prepared_epoch", number(meta, "invalidation_epoch")).put("native_app", nativeApp.json());
            meta.put("pending_generation", generation);
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); put(writes, generationKey(generation), record); put(writes, META, meta);
            commit(snapshot, writes); return new Prepared(record);
        });
    }

    /** Called only after the typed HTTPS owner validates its exact response and rechecks
     * the current native principal. Pure tests inject that external boundary explicitly. */
    Prepared confirmRegistration(NativeProviderPrincipal current, Prepared expected, NativeProviderRegistrationReceipt receipt) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (expected == null || receipt == null) throw new VaultFailure("custodial_provider_registration_receipt_invalid");
            receipt.requireExpected(expected);
            JSONObject record = required(snapshot, generationKey(expected.generationId));
            if (!current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))) throw new VaultFailure("custodial_provider_operation_stale");
            if ("CONFIRMED".equals(record.getString("state")) && expected.generationId.equals(meta.get("current_generation"))) {
                JSONObject original = new JSONObject(record.toString()); original.put("state", "PREPARED_QUARANTINE");
                for (String added : new String[]{"registration_id", "activated_at", "admission"}) original.remove(added);
                if (!NativeLegacyLineageJournal.same(original, expected.json())
                    || !sameCommittedReceipt(record.getJSONObject("admission"), receipt.json())) throw new VaultFailure("custodial_provider_registration_receipt_invalid");
                return new Prepared(record); // Lost local readback, no second transition/effect.
            }
            if (!expected.generationId.equals(meta.get("pending_generation")) || !NativeLegacyLineageJournal.same(record, expected.json()))
                throw new VaultFailure("custodial_provider_operation_stale");
            requirePrepared(record, current);
            Object previous = meta.get("current_generation");
            if (previous == JSONObject.NULL ? receipt.priorGenerationId != null : !previous.equals(receipt.priorGenerationId))
                throw new VaultFailure("custodial_provider_generation_chain_mismatch");
            Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            if (previous != JSONObject.NULL) {
                JSONObject old = required(snapshot, generationKey((String) previous));
                if (!"CONFIRMED".equals(old.get("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(old.getJSONObject("principal")))
                    || java.time.Instant.parse(old.getString("activated_at")).isAfter(java.time.Instant.parse(receipt.priorRetiredAt)))
                    throw new VaultFailure("custodial_provider_generation_chain_mismatch");
                old.put("state", "DISPATCH_RETIRED_ARRIVAL_DRAINING").put("dispatch_retired_at", receipt.priorRetiredAt);
                put(writes, generationKey((String) previous), old);
            }
            record.put("state", "CONFIRMED").put("registration_id", receipt.registrationId)
                .put("activated_at", receipt.activatedAt).put("admission", receipt.json());
            meta.put("pending_generation", JSONObject.NULL).put("current_generation", expected.generationId)
                .put("recovery_epoch", increment(number(meta, "recovery_epoch")));
            put(writes, generationKey(expected.generationId), record); put(writes, META, meta);
            commit(snapshot, writes); return new Prepared(record);
        });
    }

    private static boolean sameCommittedReceipt(JSONObject left, JSONObject right) throws VaultFailure {
        try {
            JSONObject a = new JSONObject(left.toString()), b = new JSONObject(right.toString());
            for (String field : new String[]{"replayed", "server_now"}) { a.remove(field); b.remove(field); }
            return NativeLegacyLineageJournal.same(a, b);
        } catch (Exception error) { throw new VaultFailure("custodial_provider_registration_receipt_invalid", error); }
    }

    /** Token is released only to the internal typed transport for an exact still-pending record. */
    char[] tokenForPrepared(NativeProviderPrincipal current, Prepared expected) throws VaultFailure {
        return transition(() -> {
            ProviderRecordStore.Snapshot snapshot = store.load(); JSONObject meta = metadata(snapshot); requireAvailable(meta, current);
            if (expected == null || !expected.generationId.equals(meta.get("pending_generation"))) throw new VaultFailure("custodial_provider_operation_stale");
            JSONObject record = required(snapshot, generationKey(expected.generationId)); requirePrepared(record, current);
            if (!NativeLegacyLineageJournal.same(record, expected.json())) throw new VaultFailure("custodial_provider_operation_stale");
            JSONObject token = required(snapshot, tokenKey(number(record, "capture_sequence")));
            if (!"UNBOUND_TOKEN".equals(token.getString("state")) || !record.getString("token_digest").equals(token.getString("token_digest"))
                || !record.getString("token_digest").equals(NativeProviderPrincipal.hash(token.getString("token")))) throw corrupt();
            return token.getString("token").toCharArray();
        });
    }

    private static void requireAvailable(JSONObject meta, NativeProviderPrincipal current) throws VaultFailure, org.json.JSONException {
        if (!"AVAILABLE".equals(meta.getString("availability")) || current == null || !current.same(principal(meta)))
            throw new VaultFailure("custodial_provider_waiting_native_principal");
    }
    private static void requirePrepared(JSONObject record, NativeProviderPrincipal current) throws VaultFailure, org.json.JSONException {
        if (!"PREPARED_QUARANTINE".equals(record.getString("state")) || !current.same(NativeProviderPrincipal.fromNativeJournal(record.getJSONObject("principal")))
            || !current.digest.equals(record.getString("principal_digest"))) throw new VaultFailure("custodial_provider_operation_stale");
    }
    private static NativeProviderPrincipal principal(JSONObject meta) throws VaultFailure, org.json.JSONException {
        return meta.get("principal") == JSONObject.NULL ? null : NativeProviderPrincipal.fromNativeJournal(meta.getJSONObject("principal"));
    }
    private static void retireRegistrationRecords(ProviderRecordStore.Snapshot snapshot, JSONObject meta, Map<ProviderRecordStore.Key, char[]> writes) throws Exception {
        for (ProviderRecordStore.Key key : snapshot.keys()) {
            if (key.domain == ProviderEnvelopeCrypto.Domain.TOKEN || key.domain == ProviderEnvelopeCrypto.Domain.GENERATION) {
                JSONObject record = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(record.getString("state"))) {
                    record.put("state", "REVOKED_OR_FOREIGN"); put(writes, key, record);
                }
            } else if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX || key.domain == ProviderEnvelopeCrypto.Domain.QUARANTINE
                || key.domain == ProviderEnvelopeCrypto.Domain.EVENT || key.domain == ProviderEnvelopeCrypto.Domain.TOMBSTONE) {
                JSONObject record = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(record.getString("authority_state"))) {
                    // Preserve payload, original identity, event state and all action facts.
                    record.put("authority_state", "REVOKED_OR_FOREIGN");
                    if (key.domain == ProviderEnvelopeCrypto.Domain.INBOX) {
                        queueOsCancel(record); record.put("mirror_retire_pending", true);
                    }
                    put(writes, key, record);
                }
            } else if (key.domain == ProviderEnvelopeCrypto.Domain.METADATA && key.id.startsWith("recovery-")
                && !key.equals(ProviderRecordStore.DIAGNOSTIC)) {
                NativeLegacyLineageJournal.uuid(key.id.substring("recovery-".length()));
                JSONObject recovery = required(snapshot, key);
                if (!"REVOKED_OR_FOREIGN".equals(recovery.getString("authority_state"))) {
                    recovery.put("authority_state", "REVOKED_OR_FOREIGN"); put(writes, key, recovery);
                }
            } else if (!key.equals(META) && !key.equals(ProviderRecordStore.DIAGNOSTIC)) {
                // Refuse incomplete fence ownership, rather than ignoring future inbox/events.
                throw new VaultFailure("custodial_provider_removal_slice_incomplete");
            }
        }
        meta.put("retired_capture_sequence", number(meta, "capture_sequence")).put("pending_generation", JSONObject.NULL).put("current_generation", JSONObject.NULL);
    }
    private static JSONObject metadata(ProviderRecordStore.Snapshot snapshot) throws VaultFailure, org.json.JSONException {
        if (snapshot.keys().isEmpty() && snapshot.revision == 0) return new JSONObject().put("schema", SCHEMA)
            .put("invalidation_epoch", 0).put("capture_sequence", 0).put("retired_capture_sequence", 0)
            .put("binding_id", JSONObject.NULL).put("recovery_epoch", 0)
            .put("availability", "UNAVAILABLE").put("principal", JSONObject.NULL).put("ever_bound", false)
            .put("pending_generation", JSONObject.NULL).put("current_generation", JSONObject.NULL);
        JSONObject meta = required(snapshot, META);
        if (meta.length() != 11 || !(meta.get("ever_bound") instanceof Boolean)
            || !(meta.get("pending_generation") == JSONObject.NULL || meta.get("pending_generation") instanceof String)
            || !(meta.get("current_generation") == JSONObject.NULL || meta.get("current_generation") instanceof String)
            || !java.util.Arrays.asList("UNAVAILABLE", "AVAILABLE", "REMOVED").contains(meta.get("availability"))) throw corrupt();
        number(meta, "invalidation_epoch"); number(meta, "recovery_epoch");
        if (meta.get("binding_id") != JSONObject.NULL) NativeLegacyLineageJournal.uuid(meta.getString("binding_id"));
        else if (meta.getBoolean("ever_bound")) throw corrupt();
        if (number(meta, "retired_capture_sequence") > number(meta, "capture_sequence")) throw corrupt();
        principal(meta); return meta;
    }
    private static JSONObject required(ProviderRecordStore.Snapshot snapshot, ProviderRecordStore.Key key) throws VaultFailure {
        char[] text = snapshot.read(key);
        if (text == null) throw corrupt();
        try {
            JSONObject result = new JSONObject(new String(text));
            if (!SCHEMA.equals(result.get("schema"))) throw corrupt(); return result;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_journal_corrupt_preserved", error); }
        finally { Arrays.fill(text, '\0'); }
    }
    private static ProviderRecordStore.Key tokenKey(long sequence) { return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-" + sequence); }
    private static ProviderRecordStore.Key generationKey(String id) { return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.GENERATION, id); }
    private static long number(JSONObject value, String field) throws VaultFailure {
        Object number = value.opt(field);
        if (!(number instanceof Integer || number instanceof Long) || ((Number) number).longValue() < 0) throw corrupt();
        return ((Number) number).longValue();
    }
    private static long increment(long value) throws VaultFailure {
        if (value == Long.MAX_VALUE) throw new VaultFailure("custodial_provider_sequence_exhausted"); return value + 1;
    }
    private static void put(Map<ProviderRecordStore.Key, char[]> writes, ProviderRecordStore.Key key, JSONObject value) {
        char[] old = writes.put(key, value.toString().toCharArray()); if (old != null) Arrays.fill(old, '\0');
    }
    private void commit(ProviderRecordStore.Snapshot previous, Map<ProviderRecordStore.Key, char[]> writes) throws VaultFailure {
        commit(previous, writes, Collections.emptySet());
    }
    private void commit(ProviderRecordStore.Snapshot previous, Map<ProviderRecordStore.Key, char[]> writes, Set<ProviderRecordStore.Key> removals) throws VaultFailure {
        try { store.commit(previous.revision, writes, removals); }
        catch (VaultFailure error) {
            if ("custodial_provider_capacity_preserved".equals(error.code)) {
                // No rejected write was committed. Preserve every unresolved record and mark bounded recovery.
                char[] diagnostic = ("{\"schema\":\"" + SCHEMA + "\",\"recovery_needed\":true,\"reason\":\"CAPACITY_PRESERVED\"}").toCharArray();
                try { store.commit(previous.revision, Collections.singletonMap(ProviderRecordStore.DIAGNOSTIC, diagnostic), Collections.emptySet()); }
                finally { Arrays.fill(diagnostic, '\0'); }
            }
            throw error;
        }
        finally { for (char[] value : writes.values()) Arrays.fill(value, '\0'); }
    }
    private interface Transition<T> { T run() throws Exception; }
    private <T> T transition(Transition<T> action) throws VaultFailure {
        synchronized (lock) {
            try { return action.run(); }
            catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_journal_corrupt_preserved", error); }
        }
    }
    private static VaultFailure corrupt() { return new VaultFailure("custodial_provider_journal_corrupt_preserved"); }
}
