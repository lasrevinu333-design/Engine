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
    static final String STATUS_ACTION = "org.memphiszoo.custodial.ASSIGNED_ACTIVATION_STATUS";
    static final String EXTRA_DEVICE_ID = "device_id";
    static final String EXTRA_ACTIVATION_TOKEN = "activation_token";
    static final String EXTRA_OPERATION_ID = "operation_id";
    private static final String TAG = "CustodialActivation";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !(ACTION.equals(intent.getAction()) || STATUS_ACTION.equals(intent.getAction()))) return;
        final boolean statusOnly = STATUS_ACTION.equals(intent.getAction());
        final boolean ordered = isOrderedBroadcast();
        final PendingResult pending = goAsync();
        final Context application = context.getApplicationContext();
        final String rawDevice = intent.getStringExtra(EXTRA_DEVICE_ID);
        final String rawToken = intent.getStringExtra(EXTRA_ACTIVATION_TOKEN);
        final String rawOperation = intent.getStringExtra(EXTRA_OPERATION_ID);
        intent.removeExtra(EXTRA_ACTIVATION_TOKEN);
        Thread worker = new Thread(() -> {
            char[] activationSecret = null;
            String deviceId="",operationId="";
            try {
                deviceId = VaultValidation.deviceId(rawDevice);
                operationId = VaultValidation.operationId(rawOperation);
                CustodialNativeRuntime runtime = CustodialNativeRuntime.get(application);
                VaultEngine engine = runtime.engine;
                AndroidOfflineAuthorityTimeStore protectedStore = runtime.offlineStore;
                NativeAssignedActivationJournal journal=new NativeAssignedActivationJournal(protectedStore);
                NativeLegacyLineageJournal legacyJournal=new NativeLegacyLineageJournal(protectedStore);
                if(statusOnly){
                    Map<String,Object> state=engine.getState();
                    engine.requireActiveDevice(deviceId);
                    String observed=NativeLegacyLineageJournal.applies(state)
                        ?engine.legacyActivationResult(operationId,deviceId,legacyJournal):journal.transportResultFor(operationId,state);
                    result(pending,ordered,operationId,deviceId,observed,null);
                    return;
                }
                activationSecret = WebViewInputPolicy.activationSecret(rawToken).toCharArray();
                Map<String, Object> state = engine.activateAssignedDevice(operationId, deviceId, activationSecret);
                if (!Boolean.TRUE.equals(state.get("active")) || !deviceId.equals(engine.requireActiveDevice(deviceId))) {
                    throw new VaultFailure("custodial_assigned_activation_not_active");
                }
                String accepted;
                if(NativeLegacyLineageJournal.applies(state)){
                    accepted=engine.completeLegacyAssignedActivation(operationId,deviceId,legacyJournal);
                }else{
                    journal.captureConfirmed(state);
                    accepted=engine.reportAssignedActivation(operationId,deviceId,
                        String.valueOf(state.get("active_enrollment_operation_id")),String.valueOf(state.get("active_credential_id")),journal.digestFor(state));
                    journal.captureTransportResult(operationId,state,accepted);
                }
                result(pending,ordered,operationId,deviceId,accepted,null);
                Log.i(TAG, "assigned_activation result=" + accepted);
            } catch (Exception error) {
                String code = error instanceof VaultFailure ? ((VaultFailure) error).code : "custodial_assigned_activation_failed";
                result(pending,ordered,operationId,deviceId,"delivery_unknown",code);
                Log.e(TAG, "assigned_activation result=failed code=" + code);
            } finally {
                VaultValidation.wipe(activationSecret);
                pending.finish();
            }
        }, "CustodialAssignedActivation");
        worker.setDaemon(true);
        worker.start();
    }

    private static void result(PendingResult pending,boolean ordered,String operation,String device,String state,String error){
        if(!ordered)return;
        try{
            org.json.JSONObject body=new org.json.JSONObject().put("schema_version","custodial.activation-result.v1")
                .put("operation_id",operation).put("device_id",device).put("state",state)
                .put("error_code",error==null?org.json.JSONObject.NULL:error);
            pending.setResultCode("native_active".equals(state)||"not_required".equals(state)?-1:0);
            pending.setResultData(body.toString());
        }catch(Exception ignored){pending.setResultCode(0);pending.setResultData("custodial_activation_result_unavailable");}
    }
}
