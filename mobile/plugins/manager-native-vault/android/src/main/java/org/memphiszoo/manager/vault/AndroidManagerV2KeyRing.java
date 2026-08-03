package org.memphiszoo.manager.vault;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import java.security.KeyPairGenerator;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;

final class AndroidManagerV2KeyRing implements ManagerV2KeyRing {
    static final String SIGNING_PREFIX = "org.memphiszoo.manager.v2.signing.";
    static final String WRAPPING_PREFIX = "org.memphiszoo.manager.v2.wrapping.";

    @Override
    public boolean hasSigningKey(String operationId) throws VaultFailure {
        return contains(signingAlias(operationId));
    }

    @Override
    public boolean hasWrappingKey(String operationId) throws VaultFailure {
        return contains(wrappingAlias(operationId));
    }

    @Override
    public void createSigningKey(String operationId) throws VaultFailure {
        requireApi31();
        String alias = signingAlias(operationId);
        if (contains(alias)) return;
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build());
            generator.generateKeyPair();
            assertNonExportable(alias);
        } catch (Exception error) {
            destroyAlias(alias);
            throw new VaultFailure("native_security_capability_required", error);
        }
    }

    @Override
    public void createWrappingKey(String operationId) throws VaultFailure {
        requireApi31();
        String alias = wrappingAlias(operationId);
        if (contains(alias)) return;
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_AGREE_KEY)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setUserAuthenticationRequired(false)
                .build());
            generator.generateKeyPair();
            assertNonExportable(alias);
        } catch (Exception error) {
            destroyAlias(alias);
            throw new VaultFailure("native_security_capability_required", error);
        }
    }

    @Override
    public PublicKey signingPublicKey(String operationId) throws VaultFailure {
        return publicKey(signingAlias(operationId));
    }

    @Override
    public PublicKey wrappingPublicKey(String operationId) throws VaultFailure {
        return publicKey(wrappingAlias(operationId));
    }

    @Override
    public byte[] sign(String operationId, byte[] proofInput) throws VaultFailure {
        if (proofInput == null || proofInput.length < 1 || proofInput.length > 16_384) {
            throw new VaultFailure("manager_v2_invalid_proof_input");
        }
        try {
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(privateKey(signingAlias(operationId)));
            signature.update(proofInput);
            return ManagerV2WireContract.derToP1363LowS(signature.sign());
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_signing_failed", error);
        }
    }

    @Override
    public String securityLevel(String operationId) throws VaultFailure {
        String signing = keySecurityLevel(signingAlias(operationId));
        String wrapping = keySecurityLevel(wrappingAlias(operationId));
        if (!signing.equals(wrapping)) throw new VaultFailure("native_security_capability_required");
        return signing;
    }

    @Override
    public byte[] decryptEnvelope(
        String operationId,
        PublicKey ephemeralPublicKey,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure {
        return ManagerV2WireContract.decryptEnvelope(
            privateKey(wrappingAlias(operationId)), ephemeralPublicKey, operationId,
            wrappingKeyId, salt, iv, ciphertext, tag, aad
        );
    }

    @Override
    public byte[] decryptSessionEnvelope(
        String keyOperationId,
        String sessionOperationId,
        PublicKey ephemeralPublicKey,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure {
        return ManagerV2WireContract.decryptSessionEnvelope(
            privateKey(wrappingAlias(keyOperationId)), ephemeralPublicKey, sessionOperationId,
            wrappingKeyId, salt, iv, ciphertext, tag, aad
        );
    }

    @Override
    public void destroy(String operationId) throws VaultFailure {
        destroyAlias(signingAlias(operationId));
        destroyAlias(wrappingAlias(operationId));
    }

    private static void requireApi31() throws VaultFailure {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            throw new VaultFailure("native_security_capability_required");
        }
    }

    private static String signingAlias(String operationId) throws VaultFailure {
        return SIGNING_PREFIX + ManagerV2WireContract.operationId(operationId);
    }

    private static String wrappingAlias(String operationId) throws VaultFailure {
        return WRAPPING_PREFIX + ManagerV2WireContract.operationId(operationId);
    }

    private static KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    private static boolean contains(String alias) throws VaultFailure {
        try {
            return keyStore().containsAlias(alias);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_keystore_unavailable", error);
        }
    }

    private static PrivateKey privateKey(String alias) throws VaultFailure {
        try {
            PrivateKey key = (PrivateKey) keyStore().getKey(alias, null);
            if (key == null || key.getEncoded() != null) throw new VaultFailure("native_security_capability_required");
            return key;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_keystore_unavailable", error);
        }
    }

    private static PublicKey publicKey(String alias) throws VaultFailure {
        try {
            java.security.cert.Certificate certificate = keyStore().getCertificate(alias);
            if (certificate == null) throw new VaultFailure("manager_v2_operation_key_missing");
            return certificate.getPublicKey();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_keystore_unavailable", error);
        }
    }

    private static void assertNonExportable(String alias) throws VaultFailure {
        PrivateKey key = privateKey(alias);
        if (!"EC".equalsIgnoreCase(key.getAlgorithm())) {
            destroyAlias(alias);
            throw new VaultFailure("native_security_capability_required");
        }
        keySecurityLevel(alias);
    }

    private static String keySecurityLevel(String alias) throws VaultFailure {
        try {
            PrivateKey key = privateKey(alias);
            KeyInfo info = KeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore")
                .getKeySpec(key, KeyInfo.class);
            return ManagerKeySecurityPolicy.requireHardware(
                info.getSecurityLevel(), info.isInsideSecureHardware(), key.getEncoded()
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("native_security_capability_required", error);
        }
    }

    private static void destroyAlias(String alias) throws VaultFailure {
        try {
            KeyStore store = keyStore();
            if (store.containsAlias(alias)) store.deleteEntry(alias);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_keystore_cleanup_failed", error);
        }
    }
}
