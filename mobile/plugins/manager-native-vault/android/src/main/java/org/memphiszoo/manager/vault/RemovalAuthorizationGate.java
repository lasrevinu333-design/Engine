package org.memphiszoo.manager.vault;

interface RemovalAuthorizationGate {
    boolean confirm(String operationId, String deviceId) throws VaultFailure;
}
