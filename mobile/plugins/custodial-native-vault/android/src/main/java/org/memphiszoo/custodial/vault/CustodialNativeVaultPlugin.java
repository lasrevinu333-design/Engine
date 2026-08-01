package org.memphiszoo.custodial.vault;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;

/**
 * Deliberately thin WebView facade. It exposes exact operations, never raw
 * credential reads/writes or arbitrary vault mutation.
 */
@CapacitorPlugin(name = "CustodialNativeVault")
public final class CustodialNativeVaultPlugin extends Plugin {
    private VaultEngine engine;
    private CancellationCoordinator cancellation;
    private RemovalCoordinator removal;

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
