package org.memphiszoo.custodial.vault;

import java.util.Map;

/** Requires native user presence exactly once, before the durable intent. */
final class RemovalCoordinator {
    private final VaultEngine engine;
    private final RemovalAuthorizationGate gate;

    RemovalCoordinator(VaultEngine engine, RemovalAuthorizationGate gate) {
        this.engine = engine;
        this.gate = gate;
    }

    RemovalView remove(String operationId, String deviceId) throws VaultFailure {
        String operation = VaultValidation.operationId(operationId);
        String device = VaultValidation.deviceId(deviceId);
        Map<String, Object> state = engine.getState();
        boolean durableIntent = Boolean.TRUE.equals(state.get("removal_pending"));
        if (durableIntent) {
            if (!operation.equals(state.get("removal_operation_id")) || !device.equals(state.get("removal_device_id"))) {
                throw new VaultFailure("custodial_native_removal_conflict");
            }
            return engine.removeEnrollment(operation, device);
        }
        if (!Boolean.TRUE.equals(state.get("active"))) throw new VaultFailure("custodial_native_removal_conflict");
        Object installationValue = state.get("installation");
        if (!(installationValue instanceof Map<?, ?> installation) || !device.equals(installation.get("device_id"))) {
            throw new VaultFailure("custodial_native_device_binding_mismatch");
        }
        if (!gate.confirm(operation, device)) throw new VaultFailure("custodial_native_removal_cancelled");
        return engine.removeEnrollment(operation, device);
    }
}
