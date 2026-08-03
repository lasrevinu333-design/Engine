package org.memphiszoo.manager.vault;

import java.security.PublicKey;

interface ManagerV2KeyRing {
    boolean hasSigningKey(String operationId) throws VaultFailure;
    boolean hasWrappingKey(String operationId) throws VaultFailure;
    void createSigningKey(String operationId) throws VaultFailure;
    void createWrappingKey(String operationId) throws VaultFailure;
    PublicKey signingPublicKey(String operationId) throws VaultFailure;
    PublicKey wrappingPublicKey(String operationId) throws VaultFailure;
    byte[] sign(String operationId, byte[] proofInput) throws VaultFailure;
    String securityLevel(String operationId) throws VaultFailure;
    byte[] decryptEnvelope(
        String operationId,
        PublicKey ephemeralPublicKey,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure;
    byte[] decryptSessionEnvelope(
        String keyOperationId,
        String sessionOperationId,
        PublicKey ephemeralPublicKey,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure;
    void destroy(String operationId) throws VaultFailure;
}
