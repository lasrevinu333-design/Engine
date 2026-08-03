package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Map;
import org.junit.Test;

public final class ManagerV2ProofFactoryTest {
    private static final String OP = "22222222-2222-4222-8222-222222222222";

    @Test
    public void proofIsLowSAndBoundToExactSemanticDigest() throws Exception {
        ProofKeyRing keys = new ProofKeyRing();
        ManagerV2ProofFactory factory = new ManagerV2ProofFactory(keys, () -> 1_722_614_400_123L, bytes -> {
            for (int index = 0; index < bytes.length; index += 1) bytes[index] = (byte) index;
        });
        String digest = ManagerV2WireContract.actionBodyDigest(OP, "resume");
        Map<String, Object> proof = factory.create(OP, OP, "/manager-device-auth/v2/enrollment-operations/" + OP + "/resume", digest);
        assertEquals("ES256-P1363", proof.get("algorithm"));
        assertEquals(1_722_614_400L, proof.get("issued_at"));
        byte[] input = ManagerV2WireContract.proofInput(
            "POST", "/manager-device-auth/v2/enrollment-operations/" + OP + "/resume", OP,
            1_722_614_400L, String.valueOf(proof.get("nonce")), digest
        );
        byte[] signature = Base64.getUrlDecoder().decode(String.valueOf(proof.get("signature")));
        assertTrue(ManagerV2WireContract.verifyP1363(keys.key.getPublic(), input, signature));
    }

    private static final class ProofKeyRing implements ManagerV2KeyRing {
        final KeyPair key;
        ProofKeyRing() throws Exception {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            key = generator.generateKeyPair();
        }
        public boolean hasSigningKey(String operationId) { return true; }
        public boolean hasWrappingKey(String operationId) { return true; }
        public void createSigningKey(String operationId) {}
        public void createWrappingKey(String operationId) {}
        public PublicKey signingPublicKey(String operationId) { return key.getPublic(); }
        public PublicKey wrappingPublicKey(String operationId) { return key.getPublic(); }
        public byte[] sign(String operationId, byte[] input) throws VaultFailure {
            try {
                Signature signature = Signature.getInstance("SHA256withECDSA");
                signature.initSign(key.getPrivate());
                signature.update(input);
                return ManagerV2WireContract.derToP1363LowS(signature.sign());
            } catch (Exception error) { throw new VaultFailure("test", error); }
        }
        public String securityLevel(String operationId) { return "trusted_environment"; }
        public byte[] decryptEnvelope(String operationId, PublicKey key, String keyId, byte[] salt, byte[] iv, byte[] ciphertext, byte[] tag, byte[] aad) { return new byte[0]; }
        public byte[] decryptSessionEnvelope(String keyOperationId, String sessionOperationId, PublicKey key, String keyId, byte[] salt, byte[] iv, byte[] ciphertext, byte[] tag, byte[] aad) { return new byte[0]; }
        public void destroy(String operationId) {}
    }
}
