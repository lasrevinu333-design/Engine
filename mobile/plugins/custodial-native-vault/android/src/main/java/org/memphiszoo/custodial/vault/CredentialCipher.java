package org.memphiszoo.custodial.vault;

interface CredentialCipher {
    EncryptedSecret encrypt(char[] cleartext) throws VaultFailure;

    char[] decrypt(EncryptedSecret encrypted) throws VaultFailure;

    /** Idempotently removes an orphaned vault key after ciphertext is gone. */
    void destroyKey() throws VaultFailure;
}
