package org.memphiszoo.custodial.vault;

import android.net.Uri;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
    private final Map<String, Map<String, Object>> scanEntries = new ConcurrentHashMap<>();
    private final AtomicLong scanEntrySequence = new AtomicLong();

    public CustodialNativeVaultPlugin() {}

    /** Package-private managed-emulator seam; never callable from JavaScript. */
    CustodialNativeVaultPlugin(
        VaultEngine engine,
        CancellationCoordinator cancellation,
        RemovalCoordinator removal
    ) {
        this.engine = engine;
        this.cancellation = cancellation;
        this.removal = removal;
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
            Map<String, Object> record = requireScanEntry(call.getString("entry_id"));
            String sessionId = canonicalUuid(call.getString("client_session_id"));
            String locationCode = canonicalLocationCode(call.getString("location_code"));
            String deviceId = canonicalDeviceId(call.getString("device_id"));
            String action = canonicalScanAction(call.getString("action"));
            synchronized (record) {
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
            }
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
            Map<String, Object> record = requireScanEntry(call.getString("entry_id"));
            synchronized (record) {
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
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("consumed", true);
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

    private Map<String, Object> requireScanEntry(String value) throws VaultFailure {
        String entryId = canonicalUuid(value);
        Map<String, Object> record = scanEntries.get(entryId);
        if (entryId.isEmpty() || record == null || number(record.get("expires_at_ms")) <= System.currentTimeMillis()) {
            if (!entryId.isEmpty()) scanEntries.remove(entryId);
            throw new VaultFailure("custodial_native_scan_entry_missing");
        }
        return record;
    }

    private Map<String, Object> createScanEntry(String value, String source) throws VaultFailure {
        Map<String, Object> state = engine.getState();
        Object installationValue = state.get("installation");
        if (!Boolean.TRUE.equals(state.get("active")) || !(installationValue instanceof Map)) {
            throw new VaultFailure("custodial_native_binding_missing");
        }
        Object deviceValue = ((Map<?, ?>) installationValue).get("device_id");
        String deviceId = deviceValue == null ? "" : deviceValue.toString();
        long now = System.currentTimeMillis();
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
        record.put("created_at", VaultTimestamps.fromEpochMillis(now));
        record.put("created_at_ms", now);
        record.put("created_sequence", scanEntrySequence.incrementAndGet());
        record.put("expires_at", VaultTimestamps.fromEpochMillis(now + SCAN_ENTRY_TTL_MS));
        record.put("expires_at_ms", now + SCAN_ENTRY_TTL_MS);
        record.put("client_session_id", null);
        record.put("action", null);
        synchronized (scanEntries) {
            scanEntries.entrySet().removeIf(entry -> number(entry.getValue().get("expires_at_ms")) <= now);
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
        }
        return publicScanEntry(record);
    }

    private static Map<String, Object> publicScanEntry(Map<String, Object> record) {
        Map<String, Object> result = new LinkedHashMap<>(record);
        result.remove("created_at_ms");
        result.remove("created_sequence");
        result.remove("expires_at_ms");
        return result;
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
