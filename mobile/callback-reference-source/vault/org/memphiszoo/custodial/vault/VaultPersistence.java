package org.memphiszoo.custodial.vault;

interface VaultPersistence {
    VaultSnapshot load() throws VaultFailure;

    /** Native-only read-only census seam. Unsupported persistence must not
     * pretend a source namespace belongs to its authoritative snapshot. */
    default boolean matchesCapturedOriginalSnapshot(java.util.Map<String,?> raw,VaultSnapshot original) throws VaultFailure {
        return false;
    }

    /**
     * Atomically replaces the complete authoritative snapshot. Implementations
     * must compare {@code expectedRevision}, durably commit exactly one record,
     * and verify the committed bytes before returning.
     */
    void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure;

    /** Fixed native logical-enrollment successor only. Ordinary commit remains
     * fenced. Unsupported adapters refuse before touching any namespace; no
     * operation ID, JSON receipt or caller revision substitutes for the private
     * current Engine control. This does not unhold work or remove shared keys.
     */
    default void commitOriginalInventoryFinalization(VaultEngine.NativeOriginalInventoryFinalizationControl control)
        throws VaultFailure {
        throw new VaultFailure("custodial_native_original_inventory_finalization_persistence_unavailable");
    }
    /** Only the actual installed HELD epoch scope can supply this loan.
     * Unsupported persistence refuses; no ordinary or caller-owned callback. */
    default void commitOriginalInventoryFinalizationUnderHeldEpoch(
        VaultEngine.NativeOriginalInventoryFinalizationControl control,
        NativePrivateMutationEpochStore.OriginalEnrollmentCommit held)throws VaultFailure {
        throw new VaultFailure("custodial_native_original_inventory_finalization_persistence_unavailable");
    }

    /** Existing-only read classification. It must NOT clear uncertainty or
     * replay a commit, even when exact successor bytes are already present.
     * Whole native/browser/auth/key reconciliation belongs to the owner. */
    default VaultEngine.OriginalInventoryFinalizationStoredState readOriginalInventoryFinalizationSnapshot(
        VaultEngine.NativeOriginalInventoryFinalizationRestoredRead original)throws VaultFailure {
        throw new VaultFailure("custodial_native_original_inventory_finalization_readback_unavailable");
    }
}
