package org.memphiszoo.manager.vault;

import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.json.JSONObject;

/** Minimal, secret-free Capacitor facade for the Manager native authority. */
@CapacitorPlugin(name = "ManagerNativeVault")
public final class ManagerNativeVaultPlugin extends Plugin {
    private VaultEngine engine;
    private HttpsEnrollmentTransport nativeTransport;
    private ManagerV2KeyCoordinator keyCoordinator;
    private CancellationCoordinator cancellation;
    private RemovalCoordinator removal;

    public ManagerNativeVaultPlugin() {}

    /** Package-private managed-emulator seam; never callable from JavaScript. */
    ManagerNativeVaultPlugin(VaultEngine engine, CancellationCoordinator cancellation, RemovalCoordinator removal) {
        this.engine = engine;
        this.cancellation = cancellation;
        this.removal = removal;
    }

    @Override
    public void load() {
        if (engine != null && cancellation != null && removal != null) return;
        try {
            VaultClock clock = System::currentTimeMillis;
            VaultSnapshotCodec codec = new VaultSnapshotCodec();
            ManagerV2KeyRing keys = new AndroidManagerV2KeyRing();
            keyCoordinator = new ManagerV2KeyCoordinator(
                new SharedPreferencesManagerV2OperationPersistence(getContext()), keys, clock
            );
            nativeTransport = new HttpsEnrollmentTransport(
                keyCoordinator, keys, new PlayIntegrityAttestation(getContext()), clock, nativeDeviceLabel(),
                new SharedPreferencesAuthorizedSessionOperationJournal(getContext())
            );
            engine = new VaultEngine(
                new SharedPreferencesVaultPersistence(getContext(), codec),
                new AndroidKeystoreCipher(),
                nativeTransport,
                new AndroidLegacyVaultSource(getContext(), clock),
                new SecureInstallationSealGenerator(),
                clock,
                new SharedPreferencesRecoveryJournal(getContext(), codec)
            );
            cancellation = new CancellationCoordinator(engine, new AndroidCancellationAuthorizationGate(this::getActivity));
            removal = new RemovalCoordinator(engine, new AndroidRemovalAuthorizationGate(this::getActivity));
        } catch (Exception error) {
            engine = null;
            nativeTransport = null;
            keyCoordinator = null;
            cancellation = null;
            removal = null;
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        execute(call, () -> resolve(call, safeStatus(engine().getState())));
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        String operationId;
        String flow;
        String codeValue;
        try {
            operationId = VaultValidation.operationId(call.getString("operation_id"));
            flow = publicFlow(call.getString("flow"));
            codeValue = WebViewInputPolicy.enrollmentCode(call.getString("enrollment_code"));
            requireFullAccess(call.getString("requested_access_level"));
            WebViewInputPolicy.deviceLabel(call.getString("device_label"));
        } catch (VaultFailure error) {
            reject(call, error);
            return;
        }
        execute(call, () -> {
            char[] code = codeValue.toCharArray();
            try {
                EnrollmentView view = engine().enroll(
                    operationId, enrollmentDeviceId(flow), engineFlow(flow), code
                );
                resolve(call, mutation(operationId, view.replayed, finishLocalStage(operationId)));
            } finally {
                VaultValidation.wipe(code);
            }
        });
    }

    @PluginMethod
    public void resumeEnrollment(PluginCall call) {
        execute(call, () -> {
            String operationId = VaultValidation.operationId(call.getString("operation_id"));
            EnrollmentView view = engine().resumeEnrollment(operationId);
            resolve(call, mutation(operationId, view.replayed, finishLocalStage(operationId)));
        });
    }

    @PluginMethod
    public void confirmEnrollment(PluginCall call) {
        execute(call, () -> {
            String operationId = exactPendingOperation(call.getString("operation_id"));
            resolve(call, mutation(operationId, false, engine().confirmEnrollment(operationId)));
        });
    }

    @PluginMethod
    public void cancelEnrollment(PluginCall call) {
        execute(call, () -> {
            String operationId = exactPendingOperation(call.getString("operation_id"));
            resolve(call, mutation(operationId, false, cancellation().cancel(operationId)));
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        execute(call, () -> {
            String operationId = VaultValidation.operationId(call.getString("operation_id"));
            String deviceId = authoritativeDeviceId();
            Map<String, Object> before = engine().getState();
            String durable = String.valueOf(before.getOrDefault("removal_operation_id", ""));
            if (!durable.isEmpty() && !durable.equals(operationId)) {
                throw new VaultFailure("manager_native_removal_conflict");
            }
            removal().remove(operationId, deviceId);
            resolve(call, mutation(operationId, !durable.isEmpty(), engine().finalizeRemoval(operationId)));
        });
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
            try {
                AuthorizedRequest request = new AuthorizedRequest(
                    call.getString("path"), call.getString("method"),
                    stringHeaders(call.getObject("headers", new JSObject())), body
                );
                AuthorizedResponse response = engine().authorizedRequest(authoritativeDeviceId(), request);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("status", response.status);
                result.put("headers", response.headers);
                result.put("body_base64", Base64.encodeToString(response.body, Base64.NO_WRAP));
                resolve(call, VaultCollections.copyMap(result));
            } finally {
                Arrays.fill(body, (byte) 0);
            }
        });
    }

    private Map<String, Object> finishLocalStage(String operationId) throws VaultFailure {
        Map<String, Object> state = engine().getState();
        if ("CREDENTIAL_STAGED".equals(String.valueOf(state.get("state")))) {
            state = engine().completeLocalBinding(operationId);
        }
        return state;
    }

    private String exactPendingOperation(String value) throws VaultFailure {
        String requested = VaultValidation.operationId(value);
        Map<String, Object> state = engine().getState();
        if (!requested.equals(String.valueOf(state.getOrDefault("pending_operation_id", "")))) {
            throw new VaultFailure("manager_native_enrollment_conflict");
        }
        return requested;
    }

    private String enrollmentDeviceId(String flow) throws VaultFailure {
        Map<String, Object> state = engine().getState();
        String pending = String.valueOf(state.getOrDefault("pending_device_id", ""));
        if (!pending.isEmpty()) return VaultValidation.deviceId(pending);
        Object installation = state.get("installation");
        if (installation instanceof Map<?, ?> binding) {
            String deviceId = VaultValidation.deviceId(String.valueOf(binding.get("device_id")));
            if (!flow.equals("recover") && !flow.equals("replace")) {
                throw new VaultFailure("manager_native_enrollment_conflict");
            }
            return deviceId;
        }
        return VaultValidation.deviceId("ops-app-" + UUID.randomUUID().toString().toLowerCase(Locale.ROOT));
    }

    private String authoritativeDeviceId() throws VaultFailure {
        Map<String, Object> state = engine().getState();
        Object installation = state.get("installation");
        if (installation instanceof Map<?, ?> binding) {
            return VaultValidation.deviceId(String.valueOf(binding.get("device_id")));
        }
        String removalDevice = String.valueOf(state.getOrDefault("removal_device_id", ""));
        if (!removalDevice.isEmpty()) return VaultValidation.deviceId(removalDevice);
        throw new VaultFailure("manager_native_device_binding_missing");
    }

    Map<String, Object> safeStatus(Map<String, Object> state) throws VaultFailure {
        Map<String, Object> session = nativeTransport == null ? VaultCollections.mapOf() : nativeTransport.safeSessionState();
        String publicState = publicStateName(state.get("state"));
        boolean active = Boolean.TRUE.equals(state.get("active"));
        boolean blocked = Boolean.TRUE.equals(state.get("blocked"));
        String reason = String.valueOf(state.getOrDefault("reason", ""));
        if (publicState.equals("LEGACY_PENDING")
            || (publicState.equals("BLOCKED")
                && Set.of("legacy_vault_invalid", "legacy_vault_mismatch").contains(reason))) {
            reason = "manager_native_replacement_required";
        }
        String keySecurityLevel;
        try {
            String activeAuthorityOperation = active && engine != null
                ? engine.verifyActiveAuthorityReadable()
                : "";
            keySecurityLevel = safeKeySecurityLevel(state, activeAuthorityOperation);
        } catch (VaultFailure error) {
            if (!active || !publicState.equals("ACTIVE") || !replacementRequiredFor(error.code)) throw error;
            publicState = "BLOCKED";
            active = false;
            blocked = true;
            reason = "manager_native_replacement_required";
            keySecurityLevel = "";
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("schema_version", 2);
        result.put("contract_version", ManagerV2WireContract.CONTRACT);
        result.put("state", publicState);
        Object revision = state.get("revision");
        result.put("revision", revision instanceof Number ? ((Number) revision).longValue() : 0L);
        result.put("active", active);
        result.put("blocked", blocked);
        result.put("reason", reason);
        result.put("device_id", safeDeviceId(state));
        result.put("manager_id", String.valueOf(session.getOrDefault("manager_id", safeManagerId(state))));
        Object roles = session.get("roles");
        result.put("roles", roles instanceof List<?> ? List.copyOf((List<?>) roles) : List.of());
        result.put("access_level", String.valueOf(session.getOrDefault("access_level", "")));
        result.put("key_security_level", keySecurityLevel);
        result.put("pending_operation_id", safeOptionalOperation(state.get("pending_operation_id")));
        result.put("pending_flow", publicOptionalFlow(state.get("pending_flow")));
        result.put("removal_operation_id", safeOptionalOperation(state.get("removal_operation_id")));
        result.put("removal_pending", Boolean.TRUE.equals(state.get("removal_pending")));
        return VaultCollections.copyMap(result);
    }

    static boolean replacementRequiredFor(String code) {
        return Set.of(
            "manager_v2_active_keyset_missing",
            "manager_v2_operation_key_missing",
            "manager_v2_keystore_unavailable",
            "manager_native_vault_key_missing",
            "manager_native_vault_decrypt_failed",
            "native_security_capability_required"
        ).contains(String.valueOf(code == null ? "" : code));
    }

    private String safeKeySecurityLevel(
        Map<String, Object> state,
        String activeAuthorityOperation
    ) throws VaultFailure {
        if (keyCoordinator == null) return "";
        String operation = safeOptionalOperation(activeAuthorityOperation);
        if (operation.isEmpty() && "ENROLLMENT_REQUESTED".equals(String.valueOf(state.get("state")))) {
            // The durable request is intentionally written before native key
            // generation. A failed preflight must remain inspectable/cancellable.
            return "";
        }
        if (operation.isEmpty()) operation = safeOptionalOperation(state.get("pending_operation_id"));
        if (operation.isEmpty()) {
            Object installation = state.get("installation");
            if (installation instanceof Map<?, ?> binding) {
                operation = safeOptionalOperation(binding.get("enrollment_operation_id"));
            }
        }
        return operation.isEmpty() ? "" : keyCoordinator.securityLevel(operation);
    }

    private static String safeDeviceId(Map<String, Object> state) throws VaultFailure {
        Object installation = state.get("installation");
        String value = installation instanceof Map<?, ?> binding
            ? String.valueOf(binding.containsKey("device_id") ? binding.get("device_id") : "") : "";
        if (value.isEmpty()) value = String.valueOf(state.getOrDefault("pending_device_id", ""));
        if (value.isEmpty()) value = String.valueOf(state.getOrDefault("removal_device_id", ""));
        return value.isEmpty() ? "" : VaultValidation.deviceId(value);
    }

    private static String safeManagerId(Map<String, Object> state) {
        Object metadata = state.get("metadata");
        if (!(metadata instanceof Map<?, ?> record)) return "";
        Object manager = record.get("manager");
        return manager instanceof Map<?, ?> person ? String.valueOf(person.containsKey("id") ? person.get("id") : "") : "";
    }

    private static String safeOptionalOperation(Object value) throws VaultFailure {
        String operation = String.valueOf(value == null ? "" : value).trim();
        return operation.isEmpty() ? "" : VaultValidation.operationId(operation);
    }

    private static String publicOptionalFlow(Object value) throws VaultFailure {
        String flow = String.valueOf(value == null ? "" : value).trim();
        if (flow.isEmpty()) return "";
        return flow.equals("recovery") ? "recover"
            : flow.equals("replacement") ? "replace"
            : flow.equals("enrollment") ? "enroll"
            : publicFlow(flow);
    }

    private static String publicStateName(Object value) throws VaultFailure {
        return switch (String.valueOf(value == null ? "BLOCKED" : value).trim().toUpperCase(Locale.ROOT)) {
            case "EMPTY" -> "EMPTY";
            case "ENROLLMENT_REQUESTED", "ENROLLMENT_DISPATCHED", "CREDENTIAL_STAGED" -> "ENROLLING";
            case "PENDING_SERVER_CONFIRMATION" -> "PENDING_CONFIRMATION";
            case "ACTIVE" -> "ACTIVE";
            case "CANCEL_REQUESTED" -> "CANCELLING";
            case "CANCELLED" -> "CANCELLED";
            case "REMOVAL_REQUESTED", "REMOVAL_TOMBSTONE" -> "REMOVING";
            case "LEGACY_PENDING" -> "LEGACY_PENDING";
            case "BLOCKED" -> "BLOCKED";
            default -> throw new VaultFailure("manager_native_state_invalid");
        };
    }

    private static String publicFlow(String value) throws VaultFailure {
        String flow = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
        if (!flow.equals("enroll") && !flow.equals("recover") && !flow.equals("replace")) {
            throw new VaultFailure("manager_native_invalid_enrollment");
        }
        return flow;
    }

    private static String engineFlow(String flow) {
        return flow.equals("recover") ? "recovery" : flow.equals("replace") ? "replacement" : "enrollment";
    }

    private static void requireFullAccess(String value) throws VaultFailure {
        if (!"full_access".equals(String.valueOf(value == null ? "" : value).trim())) {
            throw new VaultFailure("manager_native_access_level_refused");
        }
    }

    private Map<String, Object> mutation(
        String operationId,
        boolean replayed,
        Map<String, Object> state
    ) throws VaultFailure {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("operation_id", VaultValidation.operationId(operationId));
        result.put("replayed", replayed);
        result.put("vault_state", safeStatus(state));
        return VaultCollections.copyMap(result);
    }

    private static String nativeDeviceLabel() {
        String value = (String.valueOf(Build.MANUFACTURER) + " " + String.valueOf(Build.MODEL) + " · Memphis Zoo Ops")
            .replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        return value.length() > 150 ? value.substring(0, 150) : value;
    }

    private VaultEngine engine() throws VaultFailure {
        if (engine == null) throw new VaultFailure("manager_native_security_unavailable");
        return engine;
    }
    private CancellationCoordinator cancellation() throws VaultFailure {
        if (cancellation == null) throw new VaultFailure("manager_native_security_unavailable");
        return cancellation;
    }
    private RemovalCoordinator removal() throws VaultFailure {
        if (removal == null) throw new VaultFailure("manager_native_security_unavailable");
        return removal;
    }

    private void execute(PluginCall call, VaultAction action) {
        super.execute(() -> {
            try { action.run(); }
            catch (Exception error) { reject(call, error); }
        });
    }

    private static void resolve(PluginCall call, Map<String, ?> value) throws Exception {
        call.resolve(JSObject.fromJSONObject(new JSONObject(value)));
    }

    private static Map<String, String> stringHeaders(JSObject source) throws VaultFailure {
        if (source.length() > 64) throw new VaultFailure("manager_native_headers_refused");
        Map<String, String> result = new LinkedHashMap<>();
        java.util.Iterator<String> keys = source.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = source.opt(key);
            if (!(value instanceof String text)) throw new VaultFailure("manager_native_headers_refused");
            WebViewInputPolicy.validateHeader(key, text);
            result.put(key, text);
        }
        return VaultCollections.copyMap(result);
    }

    private static void reject(PluginCall call, Exception error) {
        VaultFailure failure = error instanceof VaultFailure ? (VaultFailure) error : null;
        String code = failure == null ? "manager_native_security_unavailable" : failure.code;
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
    private interface VaultAction { void run() throws Exception; }
}
