package org.memphiszoo.custodial.vault;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import java.util.Map;

/**
 * Manager-maintenance bootstrap for an already-assigned Custodial kiosk.
 * Export is protected by android.permission.DUMP, which is held by the Android
 * shell/system but not ordinary third-party applications. The one-time secret
 * is never logged or persisted outside the native encrypted vault.
 */
public final class AssignedDeviceActivationReceiver extends BroadcastReceiver {
    static final String ACTION = "org.memphiszoo.custodial.ACTIVATE_ASSIGNED_DEVICE";
    static final String EXTRA_DEVICE_ID = "device_id";
    static final String EXTRA_ACTIVATION_TOKEN = "activation_token";
    static final String EXTRA_OPERATION_ID = "operation_id";
    private static final String TAG = "CustodialActivation";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;
        final PendingResult pending = goAsync();
        final Context application = context.getApplicationContext();
        final String rawDevice = intent.getStringExtra(EXTRA_DEVICE_ID);
        final String rawToken = intent.getStringExtra(EXTRA_ACTIVATION_TOKEN);
        final String rawOperation = intent.getStringExtra(EXTRA_OPERATION_ID);
        Thread worker = new Thread(() -> {
            char[] activationSecret = null;
            try {
                String deviceId = VaultValidation.deviceId(rawDevice);
                String token = WebViewInputPolicy.activationSecret(rawToken);
                String operationId = VaultValidation.operationId(rawOperation);
                activationSecret = token.toCharArray();
                VaultClock clock = System::currentTimeMillis;
                VaultEngine engine = new VaultEngine(
                    new SharedPreferencesVaultPersistence(application, new VaultSnapshotCodec()),
                    new AndroidKeystoreCipher(),
                    new HttpsEnrollmentTransport(),
                    new AndroidLegacyVaultSource(application, clock),
                    new SecureInstallationSealGenerator(),
                    clock
                );
                engine.enroll(operationId, deviceId, "enrollment", activationSecret);
                engine.completeLocalBinding(operationId);
                Map<String, Object> state = engine.confirmEnrollment(operationId);
                if (!Boolean.TRUE.equals(state.get("active")) || !deviceId.equals(engine.requireActiveDevice(deviceId))) {
                    throw new VaultFailure("custodial_assigned_activation_not_active");
                }
                Log.i(TAG, "assigned_activation result=active device=" + deviceId);
            } catch (Exception error) {
                String code = error instanceof VaultFailure ? ((VaultFailure) error).code : "custodial_assigned_activation_failed";
                Log.e(TAG, "assigned_activation result=failed code=" + code);
            } finally {
                VaultValidation.wipe(activationSecret);
                pending.finish();
            }
        }, "CustodialAssignedActivation");
        worker.setDaemon(true);
        worker.start();
    }
}
