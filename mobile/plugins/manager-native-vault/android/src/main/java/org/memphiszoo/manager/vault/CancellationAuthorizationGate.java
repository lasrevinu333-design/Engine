package org.memphiszoo.manager.vault;

interface CancellationAuthorizationGate {
    boolean confirm(String operationId, String deviceId) throws VaultFailure;
}
