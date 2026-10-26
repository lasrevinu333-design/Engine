package org.memphiszoo.custodial.vault;

interface CancellationAuthorizationGate {
    boolean confirm(String operationId, String deviceId) throws VaultFailure;
}
