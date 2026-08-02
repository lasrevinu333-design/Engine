package org.memphiszoo.manager.vault;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Arrays;
import java.util.UUID;
import org.json.JSONObject;

/**
 * Deliberately thin WebView facade. It exposes exact operations, never raw
 * credential reads/writes or arbitrary vault mutation.
 */
@CapacitorPlugin(name = "ManagerNativeVault")
public final class ManagerNativeVaultPlugin extends Plugin {
    private VaultEngine engine;
    private CancellationCoordinator cancellation;
    private RemovalCoordinator removal;

    public ManagerNativeVaultPlugin() {}

    /** Package-private managed-emulator seam; never callable from JavaScript. */
    ManagerNativeVaultPlugin(
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
        execute(call, () -> resolve(call, safeStatus(engine.getState())));
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        String operationId = call.getString("operation_id");
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
                resolve(call, success(finishEnrollment(
                    operationId,
                    engine.enroll(operationId, enrollmentDeviceId(flow), flow, code)
                )));
            } finally {
                VaultValidation.wipe(code);
            }
        });
    }

    @PluginMethod
    public void resumeEnrollment(PluginCall call) {
        execute(call, () -> {
            String operationId = call.getString("operation_id");
            resolve(call, success(finishEnrollment(operationId, engine.resumeEnrollment(operationId))));
        });
    }

    @PluginMethod
    public void migrateLegacyEnrollment(PluginCall call) {
        execute(call, () -> resolve(call, safeStatus(engine.completeLegacyBinding(call.getString("device_id")))));
    }

    @PluginMethod
    public void cancelEnrollment(PluginCall call) {
        execute(call, () -> resolve(call, safeStatus(cancellation.cancel(call.getString("operation_id")))));
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
                throw new VaultFailure("manager_native_body_refused", error);
            }
            AuthorizedRequest request = new AuthorizedRequest(
                call.getString("path"),
                call.getString("method"),
                stringHeaders(call.getObject("headers", new JSObject())),
                body
            );
            try {
                AuthorizedResponse response = engine.authorizedRequest(authoritativeDeviceId(), request);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("status", response.status);
                result.put("headers", response.headers);
                result.put("body_base64", Base64.encodeToString(response.body, Base64.NO_WRAP));
                resolve(call, result);
            } finally {
                Arrays.fill(body, (byte) 0);
            }
        });
    }

    @PluginMethod
    public void removeEnrollment(PluginCall call) {
        execute(call, () -> {
            String operationId = call.getString("operation_id");
            removal.remove(operationId, authoritativeDeviceId());
            resolve(call, successState(engine.finalizeRemoval(operationId)));
        });
    }

    private Map<String, Object> finishEnrollment(String operationId, EnrollmentView initial) throws VaultFailure {
        Map<String, Object> state = engine.getState();
        String phase = String.valueOf(state.get("state"));
        if (phase.equals(VaultPhase.CREDENTIAL_STAGED.name())) {
            state = engine.completeLocalBinding(operationId);
            phase = String.valueOf(state.get("state"));
        }
        if (phase.equals(VaultPhase.PENDING_SERVER_CONFIRMATION.name())) {
            state = engine.confirmEnrollment(operationId);
        }
        if (!Boolean.TRUE.equals(state.get("active"))) {
            throw new VaultFailure("manager_native_enrollment_not_active");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("operation_id", VaultValidation.operationId(operationId));
        data.put("replayed", initial.replayed);
        data.put("vault_state", safeStatus(state));
        return VaultCollections.copyMap(data);
    }

    private String enrollmentDeviceId(String flowValue) throws VaultFailure {
        String flow = VaultValidation.flow(flowValue);
        Map<String, Object> state = engine.getState();
        String pending = String.valueOf(state.getOrDefault("pending_device_id", ""));
        if (!pending.isEmpty()) return VaultValidation.deviceId(pending);
        if (Boolean.TRUE.equals(state.get("active"))) {
            if (!flow.equals("recovery")) throw new VaultFailure("manager_native_enrollment_conflict");
            return authoritativeDeviceId();
        }
        return VaultValidation.deviceId("ops-app-" + UUID.randomUUID().toString().toLowerCase(java.util.Locale.ROOT));
    }

    /**
     * The engine's public diagnostic state is intentionally richer than the
     * Capacitor boundary.  In particular, installation seals and transition
     * metadata are useful to native recovery tests but are capabilities that a
     * WebView must never receive.  Keep this projection explicit and small.
     */
    static Map<String, Object> safeStatus(Map<String, Object> state) throws VaultFailure {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("schema_version", 2);
        result.put("state", String.valueOf(state.getOrDefault("state", "BLOCKED")));
        Object revision = state.get("revision");
        result.put("revision", revision instanceof Number ? ((Number) revision).longValue() : 0L);
        result.put("active", Boolean.TRUE.equals(state.get("active")));
        result.put("blocked", Boolean.TRUE.equals(state.get("blocked")));
        result.put("reason", String.valueOf(state.getOrDefault("reason", "")));
        result.put("device_id", safeDeviceId(state));
        result.put("pending_operation_id", safeOptionalOperation(state.get("pending_operation_id")));
        result.put("pending_flow", safeOptionalFlow(state.get("pending_flow")));
        result.put("legacy_pending", Boolean.TRUE.equals(state.get("legacy_pending")));
        result.put("removal_operation_id", safeOptionalOperation(state.get("removal_operation_id")));
        result.put("removal_pending", Boolean.TRUE.equals(state.get("removal_pending")));
        result.put("removal_finalized", Boolean.TRUE.equals(state.get("removal_finalized")));
        return VaultCollections.copyMap(result);
    }

    private static Map<String, Object> successState(Map<String, Object> state) throws VaultFailure {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("vault_state", safeStatus(state));
        return success(VaultCollections.copyMap(data));
    }

    private static String safeDeviceId(Map<String, Object> state) throws VaultFailure {
        Object installation = state.get("installation");
        String value = installation instanceof Map<?, ?> binding
            ? String.valueOf(binding.containsKey("device_id") ? binding.get("device_id") : "")
            : "";
        if (value.isEmpty()) value = String.valueOf(state.getOrDefault("pending_device_id", ""));
        if (value.isEmpty()) value = String.valueOf(state.getOrDefault("removal_device_id", ""));
        return value.isEmpty() ? "" : VaultValidation.deviceId(value);
    }

    private static String safeOptionalOperation(Object value) throws VaultFailure {
        String operationId = String.valueOf(value == null ? "" : value).trim();
        return operationId.isEmpty() ? "" : VaultValidation.operationId(operationId);
    }

    private static String safeOptionalFlow(Object value) throws VaultFailure {
        String flow = String.valueOf(value == null ? "" : value).trim();
        return flow.isEmpty() ? "" : VaultValidation.flow(flow);
    }

    @SuppressWarnings("unchecked")
    private String authoritativeDeviceId() throws VaultFailure {
        Map<String, Object> state = engine.getState();
        Object installation = state.get("installation");
        if (installation instanceof Map<?, ?> binding) {
            return VaultValidation.deviceId(String.valueOf(binding.get("device_id")));
        }
        String pending = String.valueOf(state.getOrDefault("pending_device_id", ""));
        if (!pending.isEmpty()) return VaultValidation.deviceId(pending);
        String removalDevice = String.valueOf(state.getOrDefault("removal_device_id", ""));
        if (!removalDevice.isEmpty()) return VaultValidation.deviceId(removalDevice);
        throw new VaultFailure("manager_native_device_binding_missing");
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
        if (source.length() > 64) throw new VaultFailure("manager_native_headers_refused");
        Map<String, String> result = new LinkedHashMap<>();
        java.util.Iterator<String> keys = source.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = source.opt(key);
            if (!(value instanceof String)) throw new VaultFailure("manager_native_headers_refused");
            WebViewInputPolicy.validateHeader(key, (String) value);
            result.put(key, (String) value);
        }
        return VaultCollections.copyMap(result);
    }

    private static void reject(PluginCall call, Exception error) {
        VaultFailure failure = error instanceof VaultFailure ? (VaultFailure) error : null;
        String code = failure != null
            ? failure.code
            : "manager_native_security_unavailable";
        if (failure != null && failure.httpStatus != 0) {
            JSObject safe = new JSObject();
            safe.put("status", failure.httpStatus);
            if (!failure.remoteReason.isEmpty()) safe.put("reason", failure.remoteReason);
            call.reject("Protected Manager device security is unavailable.", code, safe);
        } else {
            call.reject("Protected Manager device security is unavailable.", code);
        }
    }

    @FunctionalInterface
    private interface VaultAction {
        void run() throws Exception;
    }
}
