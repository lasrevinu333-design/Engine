package org.memphiszoo.custodial.vault;

interface LegacyVaultSource {
    LegacyMaterial read() throws VaultFailure;

    /** Historical unbound entrypoint; the Android owner refuses it. */
    void cleanup() throws VaultFailure;

    /** Exact result of the owning read compared by VaultEngine, including null
     * for an observed empty legacy source. No generic latest-read substitution.
     * A source without this typed boundary must refuse, not fall back to cleanup. */
    default void cleanupAfterRead(LegacyMaterial original) throws VaultFailure {
        throw new VaultFailure("custodial_native_legacy_cleanup_failed");
    }

    boolean isClean() throws VaultFailure;
}
