package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.Test;

public final class ManagerV2WireContractTest {
    private static final String OP = "11111111-1111-4111-8111-111111111111";
    private static final String CREDENTIAL = "22222222-2222-4222-8222-222222222222";
    private static final String MANAGER = "33333333-3333-4333-8333-333333333333";
    private static final String DEVICE = "ops-app-44444444-4444-4444-8444-444444444444";

    @Test
    public void canonicalFieldsAndActionDigestMatchBackendVectors() throws Exception {
        assertEquals("323ac3a9333ae78cab", hex(ManagerV2WireContract.lp("é", "猫")));
        assertEquals(
            "07fe12de0b1886f3c7809dc8262298cd75c6dda2ff657e261b0115bbaa64cff6",
            ManagerV2WireContract.actionBodyDigest(OP, "resume")
        );
        expect("manager_v2_invalid_field", () -> ManagerV2WireContract.lp("Cafe\u0301", "value"));
        expect("manager_v2_invalid_action", () -> ManagerV2WireContract.actionBodyDigest(OP, "remove"));
    }

    @Test
    public void opsSessionIsExactlyTwoBase64urlSegmentsWithinCanonicalBounds() throws Exception {
        String minimum = "A".repeat(15) + "." + "B".repeat(16);
        String maximum = "A".repeat(4095) + "." + "B".repeat(4096);
        assertEquals(ManagerV2WireContract.OPS_SESSION_MIN_BYTES, minimum.length());
        assertEquals(ManagerV2WireContract.OPS_SESSION_MAX_BYTES, maximum.length());
        assertEquals(minimum, ManagerV2WireContract.opsSession(minimum));
        assertEquals(maximum, ManagerV2WireContract.opsSession(maximum));
        for (String invalid : java.util.List.of(
            "A".repeat(14) + "." + "B".repeat(16),
            "A".repeat(4096) + "." + "B".repeat(4096),
            "." + "B".repeat(31),
            "A".repeat(31) + ".",
            "A".repeat(16) + ".." + "B".repeat(16),
            "A".repeat(16) + "." + "B".repeat(15) + "=",
            "A".repeat(16) + "." + "B".repeat(15) + "\n"
        )) expect("manager_v2_invalid_ops_session", () -> ManagerV2WireContract.opsSession(invalid));
    }

    @Test
    public void publicJwksAreExactP256AndRoleDistinct() throws Exception {
        KeyPair signing = pair();
        KeyPair wrapping = pair();
        Map<String, String> signingJwk = ManagerV2WireContract.publicJwk(signing.getPublic());
        assertEquals(java.util.Set.of("kty", "crv", "x", "y"), signingJwk.keySet());
        assertEquals(signingJwk, ManagerV2WireContract.publicJwk(ManagerV2WireContract.publicKey(signingJwk)));
        assertEquals(43, ManagerV2WireContract.thumbprint(signing.getPublic()).length());
        assertNotEquals(
            ManagerV2WireContract.thumbprint(signing.getPublic()),
            ManagerV2WireContract.thumbprint(wrapping.getPublic())
        );
        Map<String, String> extra = new LinkedHashMap<>(signingJwk);
        extra.put("d", "private");
        expect("manager_v2_invalid_public_key", () -> ManagerV2WireContract.publicKey(extra));
        Map<String, String> offCurve = new LinkedHashMap<>(signingJwk);
        offCurve.put("x", ManagerV2WireContract.base64url(new byte[32]));
        offCurve.put("y", ManagerV2WireContract.base64url(new byte[32]));
        expect("manager_v2_invalid_public_key", () -> ManagerV2WireContract.publicKey(offCurve));
    }

    @Test
    public void proofsUseFixedP1363LowSAndRejectMalleabilityAndPaths() throws Exception {
        KeyPair signing = pair();
        String nonce = ManagerV2WireContract.base64url(new byte[16]);
        byte[] input = ManagerV2WireContract.proofInput(
            "POST", "/manager-device-auth/v2/enrollment-operations", OP,
            1_785_661_200L, nonce, "a".repeat(64)
        );
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(signing.getPrivate());
        signer.update(input);
        byte[] der = signer.sign();
        byte[] p1363 = ManagerV2WireContract.derToP1363LowS(der);
        assertEquals(64, p1363.length);
        assertTrue(ManagerV2WireContract.verifyP1363(signing.getPublic(), input, p1363));
        BigInteger lowS = new BigInteger(1, Arrays.copyOfRange(p1363, 32, 64));
        assertTrue(lowS.compareTo(ManagerV2WireContract.P256_HALF_ORDER) <= 0);
        BigInteger highS = ManagerV2WireContract.P256_ORDER.subtract(lowS);
        byte[] high = Arrays.copyOf(p1363, 64);
        byte[] highBytes = unsigned32(highS);
        System.arraycopy(highBytes, 0, high, 32, 32);
        expect("manager_v2_invalid_signature", () -> ManagerV2WireContract.verifyP1363(signing.getPublic(), input, high));
        expect("manager_v2_invalid_signature", () -> ManagerV2WireContract.verifyP1363(signing.getPublic(), input, der));
        expect("manager_v2_invalid_path", () -> ManagerV2WireContract.proofInput(
            "POST", "/manager-device-auth/v2/../auth-api/ops/session", OP,
            1_785_661_200L, nonce, "a".repeat(64)
        ));
        expect("manager_v2_invalid_path", () -> ManagerV2WireContract.proofInput(
            "POST", "/manager-device-auth/v2/enrollment-operations%2f..%2fauth", OP,
            1_785_661_200L, nonce, "a".repeat(64)
        ));
    }

    @Test
    public void hkdfMatchesRfc5869Sha256CaseOne() throws Exception {
        byte[] ikm = new byte[22];
        Arrays.fill(ikm, (byte) 0x0b);
        byte[] salt = bytes("000102030405060708090a0b0c");
        byte[] info = bytes("f0f1f2f3f4f5f6f7f8f9");
        assertEquals(
            "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
            hex(ManagerV2WireContract.hkdf(ikm, salt, info, 42))
        );
    }

    @Test
    public void deviceOnlyEnvelopeKeyDecryptsAuthenticatedBindings() throws Exception {
        KeyPair wrapping = pair();
        KeyPair ephemeral = pair();
        String wrappingId = ManagerV2WireContract.thumbprint(wrapping.getPublic());
        String ephemeralId = ManagerV2WireContract.thumbprint(ephemeral.getPublic());
        byte[] salt = new byte[32];
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(salt);
        new SecureRandom().nextBytes(iv);
        Map<String, String> binding = Map.ofEntries(
            Map.entry("operation_id", OP),
            Map.entry("credential_id", CREDENTIAL),
            Map.entry("device_id", DEVICE),
            Map.entry("manager_id", MANAGER),
            Map.entry("credential_expires_at", "2030-01-02T03:04:05.000Z"),
            Map.entry("resume_expires_at", "2030-01-01T03:34:05.000Z"),
            Map.entry("wrapping_key_id", wrappingId),
            Map.entry("ephemeral_key_id", ephemeralId),
            Map.entry("salt", ManagerV2WireContract.base64url(salt)),
            Map.entry("iv", ManagerV2WireContract.base64url(iv))
        );
        byte[] aad = ManagerV2WireContract.envelopeAad(binding);
        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(ephemeral.getPrivate());
        agreement.doPhase(wrapping.getPublic(), true);
        byte[] shared = agreement.generateSecret();
        byte[] aesKey = ManagerV2WireContract.hkdf(shared, salt, ManagerV2WireContract.envelopeInfo(OP, wrappingId), 32);
        byte[] cleartext = ("{\"contract_version\":\"manager-device-auth.v2\",\"operation_id\":\"" + OP
            + "\",\"credential_id\":\"" + CREDENTIAL + "\",\"device_credential\":\"" + CREDENTIAL
            + ".secret\"}").getBytes(StandardCharsets.UTF_8);
        Cipher encrypt = Cipher.getInstance("AES/GCM/NoPadding");
        encrypt.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(aesKey, "AES"), new GCMParameterSpec(128, iv));
        encrypt.updateAAD(aad);
        byte[] sealed = encrypt.doFinal(cleartext);
        byte[] ciphertext = Arrays.copyOf(sealed, sealed.length - 16);
        byte[] tag = Arrays.copyOfRange(sealed, sealed.length - 16, sealed.length);
        assertArrayEquals(cleartext, ManagerV2WireContract.decryptEnvelope(
            wrapping.getPrivate(), ephemeral.getPublic(), OP, wrappingId,
            salt, iv, ciphertext, tag, aad
        ));
        byte[] wrongAad = Arrays.copyOf(aad, aad.length);
        wrongAad[wrongAad.length - 1] ^= 1;
        expect("manager_v2_envelope_authentication_failed", () -> ManagerV2WireContract.decryptEnvelope(
            wrapping.getPrivate(), ephemeral.getPublic(), OP, wrappingId,
            salt, iv, ciphertext, tag, wrongAad
        ));
        Arrays.fill(shared, (byte) 0);
        Arrays.fill(aesKey, (byte) 0);
        Arrays.fill(cleartext, (byte) 0);
    }

    private static KeyPair pair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private static byte[] unsigned32(BigInteger value) {
        byte[] raw = value.toByteArray();
        int start = raw.length == 33 && raw[0] == 0 ? 1 : 0;
        byte[] result = new byte[32];
        System.arraycopy(raw, start, result, 32 - (raw.length - start), raw.length - start);
        return result;
    }

    private static byte[] bytes(String value) {
        byte[] result = new byte[value.length() / 2];
        for (int index = 0; index < result.length; index += 1) {
            result[index] = (byte) Integer.parseInt(value.substring(index * 2, index * 2 + 2), 16);
        }
        return result;
    }

    private static String hex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte item : value) result.append(String.format("%02x", item & 0xff));
        return result.toString();
    }

    private static void expect(String code, Throwing action) throws Exception {
        try {
            action.run();
            fail("Expected " + code);
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
        }
    }

    @FunctionalInterface
    private interface Throwing { void run() throws Exception; }
}
