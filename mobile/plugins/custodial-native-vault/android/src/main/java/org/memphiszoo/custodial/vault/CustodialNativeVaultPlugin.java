package org.memphiszoo.custodial.vault;

import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONObject;

/**
 * Deliberately thin WebView facade. It exposes exact operations, never raw
 * credential reads/writes or arbitrary vault mutation.
 */
@CapacitorPlugin(name = "CustodialNativeVault")
public final class CustodialNativeVaultPlugin extends Plugin {
    private static final long SCAN_ENTRY_TTL_MS = 15L * 60L * 1000L;
    private static final int MAX_SCAN_ENTRIES = 4;
    private VaultEngine engine;
    private CancellationCoordinator cancellation;
    private RemovalCoordinator removal;
    private OfflineAuthorityTime offlineAuthorityTime;
    private OfflineAuthorityTime.OfflineAuthorityTimeStore offlineAuthorityStore;
    private final Map<String, Map<String, Object>> scanEntries = new ConcurrentHashMap<>();
    private final AtomicLong scanEntrySequence = new AtomicLong();
    private boolean scanJournalReady = true;

    public CustodialNativeVaultPlugin() {}

    /** Package-private managed-emulator seam; never callable from JavaScript. */
    CustodialNativeVaultPlugin(
        VaultEngine engine,
        CancellationCoordinator cancellation,
        RemovalCoordinator removal
    ) {
        this(engine, cancellation, removal, null);
    }

    /** Package-private managed-emulator seam; never callable from JavaScript. */
    CustodialNativeVaultPlugin(
        VaultEngine engine,
        CancellationCoordinator cancellation,
        RemovalCoordinator removal,
        OfflineAuthorityTime offlineAuthorityTime
    ) {
        this(engine, cancellation, removal, offlineAuthorityTime, null);
    }

    /** Package-private durable scan-journal seam for process-recreation tests. */
    CustodialNativeVaultPlugin(
        VaultEngine engine,
        CancellationCoordinator cancellation,
        RemovalCoordinator removal,
        OfflineAuthorityTime offlineAuthorityTime,
        OfflineAuthorityTime.OfflineAuthorityTimeStore offlineAuthorityStore
    ) {
        this.engine = engine;
        this.cancellation = cancellation;
        this.removal = removal;
        this.offlineAuthorityTime = offlineAuthorityTime;
        this.offlineAuthorityStore = offlineAuthorityStore;
        initializeScanJournal();
    }

    @Override
    public void load() {
        if (engine != null && cancellation != null && removal != null) return;
        VaultClock clock = System::currentTimeMillis;
        engine = new VaultEngine(
            new SharedPreferencesVaultPersistence(getContext(), new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),
            new HttpsEnrollmentTransport(),
            new AndroidLegacyVaultSource(getContext(), clock),
            new SecureInstallationSealGenerator(),
            clock
        );
        offlineAuthorityStore = new AndroidOfflineAuthorityTimeStore(getContext());
        offlineAuthorityTime = new OfflineAuthorityTime(
            offlineAuthorityStore,
            new OfflineAuthorityTime.MonotonicClock() {
                @Override public long now() { return SystemClock.elapsedRealtime(); }
                @Override public int bootCount() {
                    try {
                        return Settings.Global.getInt(getContext().getContentResolver(), "boot_count", -1);
                    } catch (RuntimeException error) {
                        return -1;
                    }
                }
            }
        );
        initializeScanJournal();
        cancellation = new CancellationCoordinator(
            engine,
            new AndroidCancellationAuthorizationGate(this::getActivity)
        );
        removal = new RemovalCoordinator(engine, new AndroidRemovalAuthorizationGate(this::getActivity));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        execute(call, () -> resolve(call, engine.getState()));
    }

    @PluginMethod
    public void attestScanIntent(PluginCall call) {
        execute(call, () -> {
            String requestedUrl = call.getString("url");
            if (requestedUrl == null || !(getActivity() instanceof NativeNfcScanAuthority)
                || !((NativeNfcScanAuthority) getActivity()).consumePhysicalNfcUrl(requestedUrl)) {
                throw new VaultFailure("custodial_native_scan_intent_refused");
            }
            resolve(call, createScanEntry(requestedUrl, "native-nfc"));
        });
    }

    @PluginMethod
    public void verifyScanEntry(PluginCall call) {
        execute(call, () -> resolve(call, publicScanEntry(requireScanEntry(call.getString("entry_id")))));
    }

    @PluginMethod
    public void bindScanEntry(PluginCall call) {
        execute(call, () -> {
            bindScanEntryRecord(
                call.getString("entry_id"),
                call.getString("client_session_id"),
                call.getString("location_code"),
                call.getString("device_id"),
                call.getString("action")
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("bound", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void consumeScanEntry(PluginCall call) {
        execute(call, () -> {
            String sessionId = canonicalUuid(call.getString("client_session_id"));
            String locationCode = canonicalLocationCode(call.getString("location_code"));
            String deviceId = canonicalDeviceId(call.getString("device_id"));
            String action = canonicalScanAction(call.getString("action"));
            synchronized (scanEntries) {
                Map<String, Object> record = requireScanEntry(call.getString("entry_id"));
                Map<String, Map<String, Object>> previous = copyScanEntriesLocked();
                if (sessionId.isEmpty() || locationCode.isEmpty() || deviceId.isEmpty() || action.isEmpty()
                    || !sessionId.equals(String.valueOf(record.get("client_session_id")))
                    || !locationCode.equals(record.get("location_code"))
                    || !deviceId.equals(record.get("device_id"))
                    || !action.equals(record.get("action"))) {
                    throw new VaultFailure("custodial_native_scan_consumption_refused");
                }
                if (!scanEntries.remove(String.valueOf(record.get("entry_id")), record)) {
                    throw new VaultFailure("custodial_native_scan_entry_missing");
                }
                persistScanEntriesLocked(previous);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("consumed", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void attestOfflineStart(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            String locationCode = call.getString("location_code");
            String sessionId = call.getString("client_session_id");
            String entryId = canonicalUuid(call.getString("entry_id"));
            synchronized (scanEntries) {
                Map<String, Object> record = null;
                try {
                    bindScanEntryRecord(entryId, sessionId, locationCode, deviceId, "start");
                    record = requireScanEntry(entryId);
                } catch (VaultFailure error) {
                    if (!"custodial_native_scan_entry_missing".equals(error.code)) throw error;
                }
                String startedAt = requireOfflineAuthorityTime().beginOccurrence(
                    deviceId,
                    locationCode,
                    sessionId,
                    call.getString("snapshot_id"),
                    entryId,
                    record != null
                );
                Map<String, Object> attestation = engine.attestOfflineStart(
                    deviceId,
                    locationCode,
                    sessionId,
                    call.getString("snapshot_id"),
                    call.getString("snapshot_employee_id"),
                    exactPositiveInteger(
                        call.getData().opt("snapshot_assignment_epoch"),
                        "custodial_native_start_attestation_refused"
                    ),
                    call.getString("snapshot_credential_id"),
                    entryId,
                    startedAt
                );
                Map<String, Map<String, Object>> previous = copyScanEntriesLocked();
                if (record != null && !scanEntries.remove(entryId, record)) {
                    throw new VaultFailure("custodial_native_scan_consumption_refused");
                }
                if (record != null) persistScanEntriesLocked(previous);
                resolve(call, attestation);
            }
        });
    }

    @PluginMethod
    public void acknowledgeOfflineCompletion(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            requireOfflineAuthorityTime().acknowledgeCompletedOccurrence(
                deviceId,
                call.getString("location_code"),
                call.getString("client_session_id"),
                call.getString("client_started_at"),
                call.getString("client_ended_at")
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("acknowledged", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void captureOfflineCompletionTime(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            String endedAt = requireOfflineAuthorityTime().completeOccurrence(
                deviceId,
                call.getString("location_code"),
                call.getString("client_session_id"),
                call.getString("client_started_at")
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("p_client_ended_at", endedAt);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void attestOfflineCompletion(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            String endedAt = requireOfflineAuthorityTime().completeOccurrence(
                deviceId,
                call.getString("location_code"),
                call.getString("client_session_id"),
                call.getString("client_started_at")
            );
            resolve(call, engine.attestOfflineCompletion(
                deviceId,
                call.getString("location_code"),
                call.getString("client_session_id"),
                call.getString("client_completion_id"),
                call.getString("context_id"),
                call.getString("client_started_at"),
                endedAt
            ));
        });
    }

    @PluginMethod
    public void anchorOfflineAuthoritySnapshot(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            JSObject snapshot = call.getObject("snapshot", null);
            String snapshotId = call.getString("snapshot_id");
            String generatedAt = call.getString("generated_at");
            String expiresAt = call.getString("expires_at");
            String snapshotJson = canonicalOfflineSnapshotJson(
                snapshot,
                deviceId,
                snapshotId,
                generatedAt,
                expiresAt
            );
            requireOfflineAuthorityTime().acceptSnapshot(
                deviceId,
                snapshotId,
                generatedAt,
                expiresAt,
                snapshotJson
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("anchored", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void loadOfflineAuthoritySnapshot(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            String snapshotJson = requireOfflineAuthorityTime().loadSnapshotJson(deviceId);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("snapshot", snapshotJson.isEmpty() ? null : new JSONObject(snapshotJson));
            resolve(call, result);
        });
    }

    @PluginMethod
    public void authorizeOfflineNewWork(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            requireOfflineAuthorityTime().authorizeNewWork(deviceId, call.getString("snapshot_id"));
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("authorized", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void getOfflineAuthorityState(PluginCall call) {
        execute(call, () -> {
            engine.requireActiveDevice(call.getString("device_id"));
            OfflineAuthorityTime.RollbackFence fence = requireOfflineAuthorityTime().rollbackFence();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("occurrences_awaiting_acknowledgement", requireOfflineAuthorityTime().hasOccurrencesAwaitingAcknowledgement());
            result.put("rollback_fence_active", fence != null);
            result.put("rollback_fence_id", fence == null ? null : fence.fenceId);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void beginRollbackFence(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            OfflineAuthorityTime.RollbackFence fence = requireOfflineAuthorityTime().beginRollbackFence(deviceId);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("rollback_fence_active", true);
            result.put("rollback_fence_id", fence.fenceId);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void clearRollbackFence(PluginCall call) {
        execute(call, () -> {
            String deviceId = engine.requireActiveDevice(call.getString("device_id"));
            requireOfflineAuthorityTime().clearRollbackFence(deviceId, call.getString("rollback_fence_id"));
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("cleared", true);
            resolve(call, result);
        });
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        String operationId = call.getString("operation_id");
        String deviceId = call.getString("device_id");
        String flow = call.getString("flow");
        final String codeValue;
        try {
            codeValue = WebViewInputPolicy.enrollmentCode(call.getString("enrollment_code"));
        } catch (VaultFailure error) {
            reject(call, error);
            return;
        }
        execute(call, () -> {
            char[] code = codeValue.toCharArray();
            try {
                resolve(call, success(engine.enroll(operationId, deviceId, flow, code).safeData()));
            } finally {
                VaultValidation.wipe(code);
            }
        });
    }

    @PluginMethod
    public void resumeEnrollment(PluginCall call) {
        execute(call, () -> resolve(
            call,
            success(engine.resumeEnrollment(call.getString("operation_id")).safeData())
        ));
    }

    @PluginMethod
    public void completeLocalBinding(PluginCall call) {
        execute(call, () -> resolve(call, engine.completeLocalBinding(call.getString("operation_id"))));
    }

    @PluginMethod
    public void completeLegacyBinding(PluginCall call) {
        execute(call, () -> resolve(call, engine.completeLegacyBinding(call.getString("device_id"))));
    }

    @PluginMethod
    public void confirmEnrollment(PluginCall call) {
        execute(call, () -> resolve(call, engine.confirmEnrollment(call.getString("operation_id"))));
    }

    @PluginMethod
    public void cancelEnrollment(PluginCall call) {
        execute(call, () -> resolve(call, cancellation.cancel(call.getString("operation_id"))));
    }

    @PluginMethod
    public void authorizedRequest(PluginCall call) {
        execute(call, () -> {
            String encoded = call.getString("body_base64");
            if (encoded == null) encoded = "";
            WebViewInputPolicy.validateBodyBase64(encoded);
            byte[] body;
            try {
                body = encoded.isEmpty() ? new byte[0] : Base64.decode(encoded, Base64.NO_WRAP);
            } catch (IllegalArgumentException error) {
                throw new VaultFailure("custodial_native_body_refused", error);
            }
            AuthorizedRequest request = new AuthorizedRequest(
                call.getString("path"),
                call.getString("method"),
                stringHeaders(call.getObject("headers", new JSObject())),
                body
            );
            AuthorizedResponse response = engine.authorizedRequest(call.getString("device_id"), request);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", response.status);
            result.put("headers", response.headers);
            result.put("body_base64", Base64.encodeToString(response.body, Base64.NO_WRAP));
            resolve(call, result);
        });
    }

    @PluginMethod
    public void removeEnrollment(PluginCall call) {
        execute(call, () -> resolve(call, success(removal.remove(
            call.getString("operation_id"),
            call.getString("device_id")
        ).safeData())));
    }

    @PluginMethod
    public void finalizeRemoval(PluginCall call) {
        execute(call, () -> resolve(call, engine.finalizeRemoval(call.getString("operation_id"))));
    }

    Map<String, Object> requireScanEntry(String value) throws VaultFailure {
        synchronized (scanEntries) {
            requireScanJournalReady();
            String entryId = canonicalUuid(value);
            long elapsed = SystemClock.elapsedRealtime();
            int bootCount = currentBootCount();
            Map<String, Map<String, Object>> previous = copyScanEntriesLocked();
            boolean changed = purgeInvalidScanEntriesLocked(elapsed, bootCount);
            if (changed) persistScanEntriesLocked(previous);
            Map<String, Object> record = scanEntries.get(entryId);
            if (entryId.isEmpty() || record == null) {
                throw new VaultFailure("custodial_native_scan_entry_missing");
            }
            return record;
        }
    }

    void bindScanEntryRecord(
        String entryId,
        String clientSessionId,
        String requestedLocationCode,
        String requestedDeviceId,
        String requestedAction
    ) throws VaultFailure {
        String sessionId = canonicalUuid(clientSessionId);
        String locationCode = canonicalLocationCode(requestedLocationCode);
        String deviceId = canonicalDeviceId(requestedDeviceId);
        String action = canonicalScanAction(requestedAction);
        synchronized (scanEntries) {
            Map<String, Map<String, Object>> previous = copyScanEntriesLocked();
            Map<String, Object> record = requireScanEntry(entryId);
            String existing = String.valueOf(record.get("client_session_id"));
            if (sessionId.isEmpty() || locationCode.isEmpty() || deviceId.isEmpty() || action.isEmpty()
                || !locationCode.equals(record.get("location_code"))
                || !deviceId.equals(record.get("device_id"))
                || (!"null".equals(existing) && !sessionId.equals(existing))
                || (record.get("action") != null && !action.equals(record.get("action")))) {
                throw new VaultFailure("custodial_native_scan_binding_refused");
            }
            record.put("client_session_id", sessionId);
            record.put("action", action);
            persistScanEntriesLocked(previous);
        }
    }

    Map<String, Object> createScanEntry(String value, String source) throws VaultFailure {
        Map<String, Object> state = engine.getState();
        Object installationValue = state.get("installation");
        if (!Boolean.TRUE.equals(state.get("active")) || !(installationValue instanceof Map)) {
            throw new VaultFailure("custodial_native_binding_missing");
        }
        Object deviceValue = ((Map<?, ?>) installationValue).get("device_id");
        String deviceId = deviceValue == null ? "" : deviceValue.toString();
        long now = System.currentTimeMillis();
        long elapsed = SystemClock.elapsedRealtime();
        int bootCount = currentBootCount();
        String locationCode = locationCodeFromScanUrl(value);
        if (locationCode.isEmpty()) throw new VaultFailure("custodial_native_scan_intent_refused");
        String entryId = UUID.randomUUID().toString();
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("schema_version", "scan-entry-attestation.v1");
        record.put("entry_id", entryId);
        record.put("entry_source", source);
        record.put("device_id", deviceId);
        record.put("location_code", locationCode);
        record.put("url", value);
        record.put("created_at", VaultTimestamps.fromEpochMillisExact(now));
        record.put("created_elapsed_ms", elapsed);
        record.put("created_sequence", scanEntrySequence.incrementAndGet());
        record.put("expires_at", VaultTimestamps.fromEpochMillisExact(now + SCAN_ENTRY_TTL_MS));
        record.put("expires_elapsed_ms", elapsed + SCAN_ENTRY_TTL_MS);
        record.put("boot_count", bootCount);
        record.put("client_session_id", null);
        record.put("action", null);
        synchronized (scanEntries) {
            requireScanJournalReady();
            Map<String, Map<String, Object>> previous = copyScanEntriesLocked();
            purgeInvalidScanEntriesLocked(elapsed, bootCount);
            if (scanEntries.size() >= MAX_SCAN_ENTRIES) {
                Map.Entry<String, Map<String, Object>> oldest = scanEntries.entrySet().stream()
                    .filter(entry -> entry.getValue().get("client_session_id") == null)
                    .min(java.util.Comparator
                        .comparingLong((Map.Entry<String, Map<String, Object>> entry) -> number(entry.getValue().get("created_sequence")))
                        .thenComparing(Map.Entry::getKey))
                    .orElse(null);
                if (oldest == null || !scanEntries.remove(oldest.getKey(), oldest.getValue())) {
                    throw new VaultFailure("custodial_native_scan_capacity_reached");
                }
            }
            scanEntries.put(entryId, record);
            persistScanEntriesLocked(previous);
        }
        return publicScanEntry(record);
    }

    private static Map<String, Object> publicScanEntry(Map<String, Object> record) {
        Map<String, Object> result = new LinkedHashMap<>(record);
        result.remove("created_elapsed_ms");
        result.remove("created_sequence");
        result.remove("expires_elapsed_ms");
        result.remove("boot_count");
        return result;
    }

    private void initializeScanJournal() {
        if (offlineAuthorityStore == null) return;
        synchronized (scanEntries) {
            scanEntries.clear();
            scanEntrySequence.set(0L);
            try {
                scanEntries.putAll(offlineAuthorityStore.loadScanEntries());
                long elapsed = SystemClock.elapsedRealtime();
                int bootCount = currentBootCount();
                boolean changed = purgeInvalidScanEntriesLocked(elapsed, bootCount);
                for (Map<String, Object> record : scanEntries.values()) {
                    scanEntrySequence.set(Math.max(scanEntrySequence.get(), number(record.get("created_sequence"))));
                }
                if (changed) offlineAuthorityStore.saveScanEntries(copyScanEntriesLocked());
                scanJournalReady = true;
            } catch (VaultFailure error) {
                scanEntries.clear();
                try {
                    offlineAuthorityStore.saveScanEntries(copyScanEntriesLocked());
                    scanJournalReady = true;
                } catch (VaultFailure persistenceFailure) {
                    scanJournalReady = false;
                }
            }
        }
    }

    private int currentBootCount() throws VaultFailure {
        final android.content.Context context;
        try {
            context = getContext();
        } catch (NullPointerException missingTestBridge) {
            return 0;
        }
        if (context == null) return 0;
        try {
            int value = Settings.Global.getInt(context.getContentResolver(), "boot_count", -1);
            if (value < 0) throw new VaultFailure("custodial_native_monotonic_clock_unavailable");
            return value;
        } catch (VaultFailure error) {
            throw error;
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_monotonic_clock_unavailable", error);
        }
    }

    private void requireScanJournalReady() throws VaultFailure {
        if (!scanJournalReady) throw new VaultFailure("custodial_native_scan_journal_refused");
    }

    private boolean purgeInvalidScanEntriesLocked(long elapsed, int bootCount) {
        return scanEntries.entrySet().removeIf(entry -> !validScanEntry(
            entry.getKey(),
            entry.getValue(),
            elapsed,
            bootCount
        ));
    }

    private static boolean validScanEntry(
        String entryId,
        Map<String, Object> record,
        long elapsed,
        int bootCount
    ) {
        if (record == null || record.size() != 14) return false;
        String sessionId = record.get("client_session_id") == null
            ? ""
            : canonicalUuid(String.valueOf(record.get("client_session_id")));
        String action = record.get("action") == null ? "" : canonicalScanAction(String.valueOf(record.get("action")));
        long createdElapsed = number(record.get("created_elapsed_ms"));
        long expiresElapsed = number(record.get("expires_elapsed_ms"));
        return !entryId.isEmpty()
            && entryId.equals(canonicalUuid(String.valueOf(record.get("entry_id"))))
            && "scan-entry-attestation.v1".equals(record.get("schema_version"))
            && "native-nfc".equals(record.get("entry_source"))
            && !canonicalDeviceId(String.valueOf(record.get("device_id"))).isEmpty()
            && !canonicalLocationCode(String.valueOf(record.get("location_code"))).isEmpty()
            && canonicalLocationCode(String.valueOf(record.get("location_code"))).equals(
                locationCodeFromScanUrl(String.valueOf(record.get("url")))
            )
            && String.valueOf(record.get("created_at")).matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$")
            && String.valueOf(record.get("expires_at")).matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$")
            && createdElapsed >= 0L
            && expiresElapsed - createdElapsed == SCAN_ENTRY_TTL_MS
            && number(record.get("created_sequence")) > 0L
            && number(record.get("boot_count")) == bootCount
            && elapsed >= createdElapsed
            && elapsed < expiresElapsed
            && (record.get("client_session_id") == null || !sessionId.isEmpty())
            && (record.get("action") == null || !action.isEmpty());
    }

    private Map<String, Map<String, Object>> copyScanEntriesLocked() {
        Map<String, Map<String, Object>> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Object>> entry : scanEntries.entrySet()) {
            copy.put(entry.getKey(), new LinkedHashMap<>(entry.getValue()));
        }
        return copy;
    }

    private void persistScanEntriesLocked(Map<String, Map<String, Object>> previous) throws VaultFailure {
        if (offlineAuthorityStore == null) return;
        try {
            offlineAuthorityStore.saveScanEntries(copyScanEntriesLocked());
        } catch (VaultFailure error) {
            scanEntries.clear();
            scanEntries.putAll(previous);
            throw error;
        }
    }

    private static String canonicalOfflineSnapshotJson(
        JSObject snapshot,
        String deviceId,
        String snapshotId,
        String generatedAt,
        String expiresAt
    ) throws VaultFailure {
        if (snapshot == null
            || !"offline-scan-snapshot.v2".equals(snapshot.optString("schema_version", ""))
            || !"scan.v4.snapshot-bound-authority".equals(snapshot.optString("contract_version", ""))
            || !deviceId.equals(canonicalDeviceId(snapshot.optString("canonical_device_id", "")))
            || !String.valueOf(snapshotId).equals(snapshot.optString("snapshot_id", ""))
            || !String.valueOf(generatedAt).equals(snapshot.optString("generated_at", ""))
            || !String.valueOf(expiresAt).equals(snapshot.optString("expires_at", ""))
            || canonicalUuid(snapshot.optString("employee_id", "")).isEmpty()
            || canonicalUuid(snapshot.optString("credential_id", "")).isEmpty()) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        exactPositiveInteger(snapshot.opt("assignment_epoch"), "custodial_native_offline_anchor_refused");
        String encoded = snapshot.toString();
        if (encoded.length() > 65_536) throw new VaultFailure("custodial_native_offline_anchor_refused");
        return encoded;
    }

    private static String canonicalUuid(String value) {
        try { return UUID.fromString(String.valueOf(value)).toString(); }
        catch (IllegalArgumentException error) { return ""; }
    }

    private static String canonicalDeviceId(String value) {
        String candidate = String.valueOf(value).trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_');
        if (!candidate.matches("KIOSK_(0[2-9]|10)")) return "";
        return candidate;
    }

    private static String canonicalScanAction(String value) {
        String candidate = String.valueOf(value).trim().toLowerCase(java.util.Locale.ROOT);
        return "start".equals(candidate) || "finish".equals(candidate) ? candidate : "";
    }

    private static String canonicalLocationCode(String value) {
        String candidate = String.valueOf(value).trim().toUpperCase(java.util.Locale.ROOT);
        if (candidate.equals("TETON") || candidate.equals("TETON_EXHIBIT")) return "TETX";
        if (candidate.equals("TETON_RR") || candidate.equals("TETON_RESTROOMS")
            || candidate.equals("TETON_MENS") || candidate.equals("TETON_MEN")
            || candidate.equals("TETON_MENS_RESTROOM") || candidate.equals("TETON_MENS_RESTROOMS")
            || candidate.equals("TETON_MEN_RESTROOM") || candidate.equals("TETON_MEN_RESTROOMS")) return "TETM";
        return candidate.matches("[A-Z0-9._:-]{1,100}") ? candidate : "";
    }

    private static String locationCodeFromScanUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            String location = uri.getQueryParameter("code");
            if (location == null || location.isEmpty()) location = uri.getQueryParameter("location");
            if (location == null || location.isEmpty()) location = uri.getQueryParameter("loc");
            if ((location == null || location.isEmpty()) && "scan".equalsIgnoreCase(uri.getHost())) {
                location = uri.getPath();
                if (location != null) location = location.replaceFirst("^/+", "");
            }
            return canonicalLocationCode(location);
        } catch (RuntimeException error) {
            return "";
        }
    }

    private static long number(Object value) {
        return value instanceof Number ? ((Number) value).longValue() : 0L;
    }

    private static long exactPositiveInteger(Object value, String code) throws VaultFailure {
        if (!(value instanceof Number)) throw new VaultFailure(code);
        try {
            long exact = new BigDecimal(value.toString()).longValueExact();
            if (exact < 1L) throw new VaultFailure(code);
            return exact;
        } catch (ArithmeticException | NumberFormatException error) {
            throw new VaultFailure(code, error);
        }
    }

    private OfflineAuthorityTime requireOfflineAuthorityTime() throws VaultFailure {
        if (offlineAuthorityTime == null) throw new VaultFailure("custodial_native_offline_anchor_refused");
        return offlineAuthorityTime;
    }

    private void execute(PluginCall call, VaultAction action) {
        super.execute(() -> {
            try {
                action.run();
            } catch (Exception error) {
                reject(call, error);
            }
        });
    }

    private static void resolve(PluginCall call, Map<String, ?> value) throws Exception {
        call.resolve(JSObject.fromJSONObject(new JSONObject(value)));
    }

    private static Map<String, Object> success(Map<String, ?> data) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ok", true);
        payload.put("data", data);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", 200);
        result.put("payload", payload);
        return VaultCollections.copyMap(result);
    }

    private static Map<String, String> stringHeaders(JSObject source) throws VaultFailure {
        if (source.length() > 64) throw new VaultFailure("custodial_native_headers_refused");
        Map<String, String> result = new LinkedHashMap<>();
        java.util.Iterator<String> keys = source.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = source.opt(key);
            if (!(value instanceof String)) throw new VaultFailure("custodial_native_headers_refused");
            WebViewInputPolicy.validateHeader(key, (String) value);
            result.put(key, (String) value);
        }
        return VaultCollections.copyMap(result);
    }

    private static void reject(PluginCall call, Exception error) {
        VaultFailure failure = error instanceof VaultFailure ? (VaultFailure) error : null;
        String code = failure != null
            ? failure.code
            : "custodial_native_security_unavailable";
        if (failure != null && failure.httpStatus != 0) {
            JSObject safe = new JSObject();
            safe.put("status", failure.httpStatus);
            if (!failure.remoteReason.isEmpty()) safe.put("reason", failure.remoteReason);
            call.reject("Protected Custodial device security is unavailable.", code, safe);
        } else {
            call.reject("Protected Custodial device security is unavailable.", code);
        }
    }

    @FunctionalInterface
    private interface VaultAction {
        void run() throws Exception;
    }
}
