package org.memphiszoo.custodial.vault;

interface CredentialCipher {
    EncryptedSecret encrypt(char[] cleartext) throws VaultFailure;

    /** Never generates, deletes, or rotates a key. Unsupported adapters fail closed. */
    default EncryptedSecret encryptWithExistingKey(char[] cleartext) throws VaultFailure {
        throw new VaultFailure("custodial_native_vault_existing_key_encryption_unavailable");
    }

    char[] decrypt(EncryptedSecret encrypted) throws VaultFailure;

    /** Idempotently removes an orphaned vault key after ciphertext is gone. */
    void destroyKey() throws VaultFailure;
}
