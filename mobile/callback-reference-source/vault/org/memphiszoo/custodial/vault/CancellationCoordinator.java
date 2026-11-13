package org.memphiszoo.custodial.vault;

import java.util.Map;

/** Prevents arbitrary WebView JavaScript from revoking a staged credential. */
final class CancellationCoordinator {
    private final VaultEngine engine;
    private final CancellationAuthorizationGate gate;

    CancellationCoordinator(VaultEngine engine, CancellationAuthorizationGate gate) {
        this.engine = engine;
        this.gate = gate;
    }

    Map<String, Object> cancel(String operationId) throws VaultFailure {
        String operation = VaultValidation.operationId(operationId);
        Map<String, Object> state = engine.getState();
        if (Boolean.TRUE.equals(state.get("enrollment_terminal"))) {
            if (!operation.equals(state.get("cancelled_operation_id"))) {
                throw new VaultFailure("custodial_native_enrollment_conflict");
            }
            return engine.cancelEnrollment(operation);
        }
        if (!operation.equals(state.get("pending_operation_id"))) {
            throw new VaultFailure("custodial_native_enrollment_conflict");
        }
        if ("CANCEL_REQUESTED".equals(state.get("state"))) {
            return engine.cancelEnrollment(operation);
        }
        if ("PENDING_SERVER_CONFIRMATION".equals(state.get("state"))) {
            throw new VaultFailure("custodial_native_cancellation_refused");
        }
        String deviceId = VaultValidation.deviceId(String.valueOf(state.get("pending_device_id")));
        if (!gate.confirm(operation, deviceId)) throw new VaultFailure("custodial_native_cancellation_cancelled");
        return engine.cancelEnrollment(operation);
    }
}
