package org.memphiszoo.custodial.vault;

interface RemovalAuthorizationGate {
    boolean confirm(String operationId, String deviceId) throws VaultFailure;
}
