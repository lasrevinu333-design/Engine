package org.memphiszoo.custodial.vault;

interface VaultPersistence {
    VaultSnapshot load() throws VaultFailure;

    /**
     * Atomically replaces the complete authoritative snapshot. Implementations
     * must compare {@code expectedRevision}, durably commit exactly one record,
     * and verify the committed bytes before returning.
     */
    void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure;
}
