package org.memphiszoo.manager.vault;

interface LegacyVaultSource {
    LegacyMaterial read() throws VaultFailure;

    /** Idempotently removes legacy preference values and their key aliases. */
    void cleanup() throws VaultFailure;

    boolean isClean() throws VaultFailure;
}
