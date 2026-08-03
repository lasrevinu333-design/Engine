package org.memphiszoo.manager.vault;

/** Native attestation seam. Production is Play Integrity; tests inject a fake. */
interface ManagerAppAttestation {
    String provider();
    String token(String challenge) throws VaultFailure;
}
