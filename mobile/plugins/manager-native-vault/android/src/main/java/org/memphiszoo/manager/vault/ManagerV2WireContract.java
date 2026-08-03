package org.memphiszoo.manager.vault;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECFieldFp;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

final class ManagerV2WireContract {
    static final String CONTRACT = "manager-device-auth.v2";
    static final String PROOF_ALGORITHM = "ES256-P1363";
    static final String ENVELOPE_ALGORITHM = "ECDH-P256-HKDF-SHA256+A256GCM";
    static final String PROOF_PREFIX = "MEMPHIS-MANAGER-DEVICE-AUTH-PROOF-V2";
    static final String AAD_PREFIX = "MEMPHIS-MANAGER-DEVICE-AUTH-RESULT-AAD-V2";
    static final String SESSION_AAD_PREFIX = "MEMPHIS-MANAGER-DEVICE-AUTH-SESSION-AAD-V2";
    static final int OPS_SESSION_MIN_BYTES = 32;
    static final int OPS_SESSION_MAX_BYTES = 8192;
    static final BigInteger P256_ORDER = new BigInteger("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16);
    static final BigInteger P256_HALF_ORDER = P256_ORDER.shiftRight(1);

    private static final Pattern UUID = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    private static final Pattern DEVICE = Pattern.compile("^ops-app-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    private static final Pattern BASE64URL = Pattern.compile("^[A-Za-z0-9_-]+$");
    private static final Pattern OPS_SESSION = Pattern.compile("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$");
    private static final Pattern HEX64 = Pattern.compile("^[a-f0-9]{64}$");

    private ManagerV2WireContract() {}

    static String operationId(String value) throws VaultFailure {
        String clean = canonical(value, 36, "manager_v2_invalid_operation_id");
        if (!UUID.matcher(clean).matches()) throw new VaultFailure("manager_v2_invalid_operation_id");
        return clean;
    }

    static String deviceId(String value) throws VaultFailure {
        String clean = canonical(value, 44, "manager_v2_invalid_device_id");
        if (!DEVICE.matcher(clean).matches()) throw new VaultFailure("manager_v2_invalid_device_id");
        return clean;
    }

    static String opsSession(String value) throws VaultFailure {
        String clean = canonical(value, OPS_SESSION_MAX_BYTES, "manager_v2_invalid_ops_session");
        if (clean.getBytes(StandardCharsets.UTF_8).length < OPS_SESSION_MIN_BYTES
            || !OPS_SESSION.matcher(clean).matches()) {
            throw new VaultFailure("manager_v2_invalid_ops_session");
        }
        return clean;
    }

    static byte[] lp(String name, String value) throws VaultFailure {
        String field = canonical(name, 128, "manager_v2_invalid_field");
        String content = canonical(value, 16_384, "manager_v2_invalid_field");
        byte[] fieldBytes = field.getBytes(StandardCharsets.UTF_8);
        byte[] valueBytes = content.getBytes(StandardCharsets.UTF_8);
        byte[] prefix = (fieldBytes.length + ":" + field + valueBytes.length + ":").getBytes(StandardCharsets.UTF_8);
        return concat(prefix, valueBytes);
    }

    static byte[] fields(String[][] values) throws VaultFailure {
        if (values == null || values.length == 0) throw new VaultFailure("manager_v2_invalid_fields");
        byte[][] encoded = new byte[values.length][];
        for (int index = 0; index < values.length; index += 1) {
            if (values[index] == null || values[index].length != 2) throw new VaultFailure("manager_v2_invalid_fields");
            encoded[index] = lp(values[index][0], values[index][1]);
        }
        return concat(encoded);
    }

    static String sha256Hex(byte[] value) throws VaultFailure {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest) result.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            Arrays.fill(digest, (byte) 0);
            return result.toString();
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        }
    }

    static Map<String, String> publicJwk(PublicKey value) throws VaultFailure {
        if (!(value instanceof ECPublicKey key)) throw new VaultFailure("manager_v2_invalid_public_key");
        ECParameterSpec expected = p256Parameters();
        if (!sameCurve(key.getParams(), expected) || !pointIsOnCurve(key.getW(), expected)) {
            throw new VaultFailure("manager_v2_invalid_public_key");
        }
        Map<String, String> result = new LinkedHashMap<>();
        result.put("kty", "EC");
        result.put("crv", "P-256");
        result.put("x", base64url(unsigned32(key.getW().getAffineX())));
        result.put("y", base64url(unsigned32(key.getW().getAffineY())));
        return Map.copyOf(result);
    }

    static PublicKey publicKey(Map<String, String> jwk) throws VaultFailure {
        if (jwk == null || jwk.size() != 4 || !jwk.keySet().containsAll(java.util.Set.of("kty", "crv", "x", "y"))) {
            throw new VaultFailure("manager_v2_invalid_public_key");
        }
        if (!"EC".equals(jwk.get("kty")) || !"P-256".equals(jwk.get("crv"))) {
            throw new VaultFailure("manager_v2_invalid_public_key");
        }
        byte[] x = decodeBase64url(jwk.get("x"), 32, "manager_v2_invalid_public_key");
        byte[] y = decodeBase64url(jwk.get("y"), 32, "manager_v2_invalid_public_key");
        try {
            ECParameterSpec curve = p256Parameters();
            ECPoint point = new ECPoint(new BigInteger(1, x), new BigInteger(1, y));
            if (!pointIsOnCurve(point, curve)) throw new VaultFailure("manager_v2_invalid_public_key");
            PublicKey key = KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(
                point, curve
            ));
            Map<String, String> normalized = publicJwk(key);
            if (!normalized.equals(jwk)) throw new VaultFailure("manager_v2_invalid_public_key");
            return key;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_public_key", error);
        } finally {
            Arrays.fill(x, (byte) 0);
            Arrays.fill(y, (byte) 0);
        }
    }

    private static ECParameterSpec p256Parameters() throws VaultFailure {
        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            return parameters.getParameterSpec(ECParameterSpec.class);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        }
    }

    private static boolean sameCurve(ECParameterSpec actual, ECParameterSpec expected) {
        if (actual == null || expected == null) return false;
        return actual.getCofactor() == expected.getCofactor()
            && actual.getOrder().equals(expected.getOrder())
            && actual.getGenerator().equals(expected.getGenerator())
            && actual.getCurve().getA().equals(expected.getCurve().getA())
            && actual.getCurve().getB().equals(expected.getCurve().getB())
            && actual.getCurve().getField().equals(expected.getCurve().getField());
    }

    private static boolean pointIsOnCurve(ECPoint point, ECParameterSpec parameters) {
        if (point == null || ECPoint.POINT_INFINITY.equals(point)
            || !(parameters.getCurve().getField() instanceof ECFieldFp field)) return false;
        BigInteger prime = field.getP();
        BigInteger x = point.getAffineX();
        BigInteger y = point.getAffineY();
        if (x == null || y == null || x.signum() < 0 || y.signum() < 0
            || x.compareTo(prime) >= 0 || y.compareTo(prime) >= 0) return false;
        BigInteger left = y.multiply(y).mod(prime);
        BigInteger right = x.multiply(x).multiply(x)
            .add(parameters.getCurve().getA().multiply(x))
            .add(parameters.getCurve().getB())
            .mod(prime);
        return left.equals(right);
    }

    static String thumbprint(PublicKey value) throws VaultFailure {
        Map<String, String> jwk = publicJwk(value);
        String canonical = "{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":\"" + jwk.get("x")
            + "\",\"y\":\"" + jwk.get("y") + "\"}";
        try {
            return base64url(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        }
    }

    static String initialBodyDigest(
        String operationId,
        String flow,
        String code,
        String deviceId,
        String deviceLabel,
        String platform,
        String signingKeyId,
        String wrappingKeyId
    ) throws VaultFailure {
        String normalizedFlow = canonical(flow, 7, "manager_v2_invalid_flow");
        if (!normalizedFlow.equals("enroll") && !normalizedFlow.equals("recover")) throw new VaultFailure("manager_v2_invalid_flow");
        String normalizedCode = canonical(code, 8, "manager_v2_invalid_code");
        if (!normalizedCode.matches("^\\d{8}$")) throw new VaultFailure("manager_v2_invalid_code");
        String normalizedPlatform = canonical(platform, 7, "manager_v2_invalid_platform");
        if (!normalizedPlatform.equals("android") && !normalizedPlatform.equals("ios")) throw new VaultFailure("manager_v2_invalid_platform");
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"flow", normalizedFlow},
            {"code_sha256", sha256Hex(normalizedCode.getBytes(StandardCharsets.UTF_8))},
            {"device_id", deviceId(deviceId)},
            {"device_label", canonical(deviceLabel, 160, "manager_v2_invalid_device_label")},
            {"platform", normalizedPlatform},
            {"signing_key_id", keyId(signingKeyId)},
            {"wrapping_key_id", keyId(wrappingKeyId)},
        }));
    }

    static String challengeBodyDigest(
        String operationId,
        String purpose,
        String deviceId,
        String deviceLabel,
        String platform,
        String signingKeyId,
        String wrappingKeyId
    ) throws VaultFailure {
        String normalizedPurpose = canonical(purpose, 32, "manager_v2_invalid_purpose");
        if (!java.util.Set.of("enroll", "recover", "authorized_session").contains(normalizedPurpose)) {
            throw new VaultFailure("manager_v2_invalid_purpose");
        }
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"purpose", normalizedPurpose},
            {"device_id", deviceId(deviceId)},
            {"device_label", canonical(deviceLabel, 160, "manager_v2_invalid_device_label")},
            {"platform", platform(platform)},
            {"signing_key_id", keyId(signingKeyId)},
            {"wrapping_key_id", keyId(wrappingKeyId)},
        }));
    }

    static String enrollmentBodyDigest(
        String operationId,
        String flow,
        String code,
        String deviceId,
        String deviceLabel,
        String platform,
        String requestedAccessLevel,
        String signingKeyId,
        String wrappingKeyId,
        String attestationProvider,
        String attestationChallengeId,
        String attestationEvidenceSha256
    ) throws VaultFailure {
        String normalizedFlow = canonical(flow, 7, "manager_v2_invalid_flow");
        if (!normalizedFlow.equals("enroll") && !normalizedFlow.equals("recover")) {
            throw new VaultFailure("manager_v2_invalid_flow");
        }
        String normalizedCode = canonical(code, 8, "manager_v2_invalid_code");
        if (!normalizedCode.matches("^\\d{8}$")) throw new VaultFailure("manager_v2_invalid_code");
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"flow", normalizedFlow},
            {"code_sha256", sha256Hex(normalizedCode.getBytes(StandardCharsets.UTF_8))},
            {"device_id", deviceId(deviceId)},
            {"device_label", canonical(deviceLabel, 160, "manager_v2_invalid_device_label")},
            {"platform", platform(platform)},
            {"requested_access_level", accessLevel(requestedAccessLevel)},
            {"signing_key_id", keyId(signingKeyId)},
            {"wrapping_key_id", keyId(wrappingKeyId)},
            {"attestation_provider", attestationProvider(attestationProvider)},
            {"attestation_challenge_id", operationId(attestationChallengeId)},
            {"attestation_evidence_sha256", digest(attestationEvidenceSha256, "manager_v2_invalid_attestation")},
        }));
    }

    static String actionBodyDigest(String operationId, String action) throws VaultFailure {
        String value = canonical(action, 7, "manager_v2_invalid_action");
        if (!java.util.Set.of("resume", "confirm", "cancel").contains(value)) throw new VaultFailure("manager_v2_invalid_action");
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"action", value},
        }));
    }

    static String removeBodyDigest(String operationId, String deviceId) throws VaultFailure {
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"device_id", deviceId(deviceId)},
            {"action", "remove"},
        }));
    }

    static String authorizedSessionBodyDigest(
        String operationId,
        String deviceId,
        String requestedAccessLevel,
        String attestationProvider,
        String attestationChallengeId,
        String attestationEvidenceSha256
    ) throws VaultFailure {
        return sha256Hex(fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"device_id", deviceId(deviceId)},
            {"requested_access_level", accessLevel(requestedAccessLevel)},
            {"attestation_provider", attestationProvider(attestationProvider)},
            {"attestation_challenge_id", operationId(attestationChallengeId)},
            {"attestation_evidence_sha256", digest(attestationEvidenceSha256, "manager_v2_invalid_attestation")},
        }));
    }

    static String playIntegrityEvidenceDigest(String appId, String token) throws VaultFailure {
        String packageName = canonical(appId, 255, "manager_v2_invalid_attestation_app_id");
        if (!packageName.matches("^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$")) {
            throw new VaultFailure("manager_v2_invalid_attestation_app_id");
        }
        return sha256Hex(fields(new String[][] {
            {"app_id", packageName},
            {"token", canonical(token, 32_768, "manager_v2_invalid_attestation")},
        }));
    }

    static byte[] proofInput(
        String method,
        String path,
        String operationId,
        long issuedAt,
        String nonce,
        String bodySha256
    ) throws VaultFailure {
        if (!"POST".equals(method)) throw new VaultFailure("manager_v2_invalid_method");
        String canonicalPath = canonical(path, 256, "manager_v2_invalid_path");
        if (!canonicalPath.startsWith("/manager-device-auth/v2/")
            || canonicalPath.contains("%") || canonicalPath.contains("?") || canonicalPath.contains("#")
            || canonicalPath.contains("\\") || canonicalPath.contains("/.") || canonicalPath.contains("./")) {
            throw new VaultFailure("manager_v2_invalid_path");
        }
        if (issuedAt < 0) throw new VaultFailure("manager_v2_invalid_issued_at");
        decodeBase64url(nonce, 16, "manager_v2_invalid_nonce");
        if (!HEX64.matcher(bodySha256).matches()) throw new VaultFailure("manager_v2_invalid_body_sha256");
        return concat(PROOF_PREFIX.getBytes(StandardCharsets.UTF_8), fields(new String[][] {
            {"method", method},
            {"path", canonicalPath},
            {"operation_id", operationId(operationId)},
            {"issued_at", Long.toString(issuedAt)},
            {"nonce", nonce},
            {"body_sha256", bodySha256},
        }));
    }

    static byte[] derToP1363LowS(byte[] der) throws VaultFailure {
        try {
            DerReader reader = new DerReader(der);
            byte[] sequence = reader.read(0x30);
            if (!reader.done()) throw new VaultFailure("manager_v2_invalid_signature");
            DerReader values = new DerReader(sequence);
            BigInteger r = positiveInteger(values.read(0x02));
            BigInteger s = positiveInteger(values.read(0x02));
            if (!values.done() || r.signum() <= 0 || r.compareTo(P256_ORDER) >= 0
                || s.signum() <= 0 || s.compareTo(P256_ORDER) >= 0) {
                throw new VaultFailure("manager_v2_invalid_signature");
            }
            if (s.compareTo(P256_HALF_ORDER) > 0) s = P256_ORDER.subtract(s);
            return concat(unsigned32(r), unsigned32(s));
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_signature", error);
        }
    }

    static boolean verifyP1363(PublicKey key, byte[] input, byte[] p1363) throws VaultFailure {
        if (p1363 == null || p1363.length != 64) throw new VaultFailure("manager_v2_invalid_signature");
        BigInteger r = new BigInteger(1, Arrays.copyOfRange(p1363, 0, 32));
        BigInteger s = new BigInteger(1, Arrays.copyOfRange(p1363, 32, 64));
        if (r.signum() <= 0 || r.compareTo(P256_ORDER) >= 0 || s.signum() <= 0 || s.compareTo(P256_HALF_ORDER) > 0) {
            throw new VaultFailure("manager_v2_invalid_signature");
        }
        try {
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(key);
            verifier.update(input);
            return verifier.verify(p1363ToDer(r, s));
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        }
    }

    static byte[] envelopeInfo(String operationId, String wrappingKeyId) throws VaultFailure {
        return fields(new String[][] {
            {"contract_version", CONTRACT},
            {"operation_id", operationId(operationId)},
            {"wrapping_key_id", keyId(wrappingKeyId)},
        });
    }

    static byte[] sessionEnvelopeInfo(String operationId, String wrappingKeyId) throws VaultFailure {
        return fields(new String[][] {
            {"contract_version", CONTRACT},
            {"purpose", "authorized_session"},
            {"operation_id", operationId(operationId)},
            {"wrapping_key_id", keyId(wrappingKeyId)},
        });
    }

    static byte[] envelopeAad(Map<String, String> values) throws VaultFailure {
        if (values == null || !values.keySet().equals(java.util.Set.of(
            "operation_id", "credential_id", "device_id", "manager_id", "credential_expires_at",
            "resume_expires_at", "wrapping_key_id", "ephemeral_key_id", "salt", "iv"
        ))) throw new VaultFailure("manager_v2_invalid_envelope_binding");
        String credentialId = operationId(values.get("credential_id"));
        String managerId = operationId(values.get("manager_id"));
        decodeBase64url(values.get("salt"), 32, "manager_v2_invalid_envelope_binding");
        decodeBase64url(values.get("iv"), 12, "manager_v2_invalid_envelope_binding");
        return concat(AAD_PREFIX.getBytes(StandardCharsets.UTF_8), fields(new String[][] {
            {"operation_id", operationId(values.get("operation_id"))},
            {"credential_id", credentialId},
            {"device_id", deviceId(values.get("device_id"))},
            {"manager_id", managerId},
            {"credential_expires_at", canonical(values.get("credential_expires_at"), 40, "manager_v2_invalid_envelope_binding")},
            {"resume_expires_at", canonical(values.get("resume_expires_at"), 40, "manager_v2_invalid_envelope_binding")},
            {"wrapping_key_id", keyId(values.get("wrapping_key_id"))},
            {"ephemeral_key_id", keyId(values.get("ephemeral_key_id"))},
            {"salt", values.get("salt")},
            {"iv", values.get("iv")},
        }));
    }

    static byte[] sessionEnvelopeAad(Map<String, String> values) throws VaultFailure {
        if (values == null || !values.keySet().equals(java.util.Set.of(
            "operation_id", "session_id", "credential_id", "device_id", "manager_id", "roles", "access_level",
            "session_expires_at", "wrapping_key_id", "ephemeral_key_id", "salt", "iv"
        ))) throw new VaultFailure("manager_v2_invalid_envelope_binding");
        decodeBase64url(values.get("salt"), 32, "manager_v2_invalid_envelope_binding");
        decodeBase64url(values.get("iv"), 12, "manager_v2_invalid_envelope_binding");
        return concat(SESSION_AAD_PREFIX.getBytes(StandardCharsets.UTF_8), fields(new String[][] {
            {"operation_id", operationId(values.get("operation_id"))},
            {"session_id", operationId(values.get("session_id"))},
            {"credential_id", operationId(values.get("credential_id"))},
            {"device_id", deviceId(values.get("device_id"))},
            {"manager_id", operationId(values.get("manager_id"))},
            {"roles", canonical(values.get("roles"), 192, "manager_v2_invalid_envelope_binding")},
            {"access_level", accessLevel(values.get("access_level"))},
            {"session_expires_at", canonical(values.get("session_expires_at"), 40, "manager_v2_invalid_envelope_binding")},
            {"wrapping_key_id", keyId(values.get("wrapping_key_id"))},
            {"ephemeral_key_id", keyId(values.get("ephemeral_key_id"))},
            {"salt", values.get("salt")},
            {"iv", values.get("iv")},
        }));
    }

    static byte[] decryptEnvelope(
        PrivateKey wrappingPrivateKey,
        PublicKey ephemeralPublicKey,
        String operationId,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure {
        return decryptEnvelopeWithInfo(
            wrappingPrivateKey, ephemeralPublicKey, envelopeInfo(operationId, wrappingKeyId),
            salt, iv, ciphertext, tag, aad
        );
    }

    static byte[] decryptSessionEnvelope(
        PrivateKey wrappingPrivateKey,
        PublicKey ephemeralPublicKey,
        String operationId,
        String wrappingKeyId,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure {
        return decryptEnvelopeWithInfo(
            wrappingPrivateKey, ephemeralPublicKey, sessionEnvelopeInfo(operationId, wrappingKeyId),
            salt, iv, ciphertext, tag, aad
        );
    }

    private static byte[] decryptEnvelopeWithInfo(
        PrivateKey wrappingPrivateKey,
        PublicKey ephemeralPublicKey,
        byte[] info,
        byte[] salt,
        byte[] iv,
        byte[] ciphertext,
        byte[] tag,
        byte[] aad
    ) throws VaultFailure {
        if (salt.length != 32 || iv.length != 12 || tag.length != 16 || ciphertext.length < 1) {
            throw new VaultFailure("manager_v2_invalid_envelope");
        }
        byte[] shared = null;
        byte[] key = null;
        byte[] combined = null;
        try {
            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(wrappingPrivateKey);
            agreement.doPhase(ephemeralPublicKey, true);
            shared = agreement.generateSecret();
            key = hkdf(shared, salt, info, 32);
            combined = concat(ciphertext, tag);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            cipher.updateAAD(aad);
            return cipher.doFinal(combined);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_envelope_authentication_failed", error);
        } finally {
            if (shared != null) Arrays.fill(shared, (byte) 0);
            if (key != null) Arrays.fill(key, (byte) 0);
            if (combined != null) Arrays.fill(combined, (byte) 0);
        }
    }

    static byte[] hkdf(byte[] input, byte[] salt, byte[] info, int length) throws VaultFailure {
        if (length < 1 || length > 32 * 255) throw new VaultFailure("manager_v2_invalid_hkdf_length");
        byte[] prk = null;
        byte[] prior = new byte[0];
        byte[] output = new byte[length];
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            prk = mac.doFinal(input);
            int offset = 0;
            int counter = 1;
            while (offset < length) {
                mac.init(new SecretKeySpec(prk, "HmacSHA256"));
                mac.update(prior);
                mac.update(info);
                mac.update((byte) counter);
                byte[] block = mac.doFinal();
                Arrays.fill(prior, (byte) 0);
                prior = block;
                int count = Math.min(block.length, length - offset);
                System.arraycopy(block, 0, output, offset, count);
                offset += count;
                counter += 1;
            }
            return output;
        } catch (Exception error) {
            Arrays.fill(output, (byte) 0);
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        } finally {
            if (prk != null) Arrays.fill(prk, (byte) 0);
            Arrays.fill(prior, (byte) 0);
        }
    }

    static String base64url(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    static byte[] decodeBase64url(String value, int bytes, String code) throws VaultFailure {
        if (value == null || value.contains("=") || !BASE64URL.matcher(value).matches()) throw new VaultFailure(code);
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(value);
            if (decoded.length != bytes || !base64url(decoded).equals(value)) throw new VaultFailure(code);
            return decoded;
        } catch (IllegalArgumentException error) {
            throw new VaultFailure(code, error);
        }
    }

    private static String keyId(String value) throws VaultFailure {
        decodeBase64url(value, 32, "manager_v2_invalid_key_id");
        return value;
    }

    private static String digest(String value, String code) throws VaultFailure {
        String clean = canonical(value, 64, code);
        if (!HEX64.matcher(clean).matches()) throw new VaultFailure(code);
        return clean;
    }

    private static String platform(String value) throws VaultFailure {
        String clean = canonical(value, 7, "manager_v2_invalid_platform");
        if (!clean.equals("android") && !clean.equals("ios")) throw new VaultFailure("manager_v2_invalid_platform");
        return clean;
    }

    private static String accessLevel(String value) throws VaultFailure {
        String clean = canonical(value, 16, "manager_v2_invalid_access_level");
        if (!clean.equals("full_access") && !clean.equals("read_only")) throw new VaultFailure("manager_v2_invalid_access_level");
        return clean;
    }

    private static String attestationProvider(String value) throws VaultFailure {
        String clean = canonical(value, 32, "manager_v2_invalid_attestation_provider");
        if (!clean.equals("play_integrity") && !clean.equals("apple_app_attest")) {
            throw new VaultFailure("manager_v2_invalid_attestation_provider");
        }
        return clean;
    }

    private static String canonical(String value, int maximumBytes, String code) throws VaultFailure {
        if (value == null || value.isEmpty()) throw new VaultFailure(code);
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFC);
        if (!normalized.equals(value) || normalized.getBytes(StandardCharsets.UTF_8).length > maximumBytes) throw new VaultFailure(code);
        for (int index = 0; index < normalized.length(); index += 1) {
            if (Character.isISOControl(normalized.charAt(index))) throw new VaultFailure(code);
        }
        return normalized;
    }

    private static byte[] unsigned32(BigInteger value) throws VaultFailure {
        byte[] encoded = value.toByteArray();
        int start = encoded.length == 33 && encoded[0] == 0 ? 1 : 0;
        int length = encoded.length - start;
        if (value.signum() < 0 || length > 32) throw new VaultFailure("manager_v2_invalid_public_key");
        byte[] result = new byte[32];
        System.arraycopy(encoded, start, result, 32 - length, length);
        return result;
    }

    private static BigInteger positiveInteger(byte[] encoded) throws VaultFailure {
        if (encoded.length < 1 || (encoded[0] & 0x80) != 0) throw new VaultFailure("manager_v2_invalid_signature");
        if (encoded.length > 1 && encoded[0] == 0 && (encoded[1] & 0x80) == 0) throw new VaultFailure("manager_v2_invalid_signature");
        return new BigInteger(1, encoded);
    }

    private static byte[] p1363ToDer(BigInteger r, BigInteger s) {
        byte[] rBytes = positiveDer(r);
        byte[] sBytes = positiveDer(s);
        byte[] result = new byte[2 + 2 + rBytes.length + 2 + sBytes.length];
        int offset = 0;
        result[offset++] = 0x30;
        result[offset++] = (byte) (result.length - 2);
        result[offset++] = 0x02;
        result[offset++] = (byte) rBytes.length;
        System.arraycopy(rBytes, 0, result, offset, rBytes.length);
        offset += rBytes.length;
        result[offset++] = 0x02;
        result[offset++] = (byte) sBytes.length;
        System.arraycopy(sBytes, 0, result, offset, sBytes.length);
        return result;
    }

    private static byte[] positiveDer(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if ((bytes[0] & 0x80) == 0) return bytes;
        return concat(new byte[] {0}, bytes);
    }

    private static byte[] concat(byte[]... values) {
        int length = 0;
        for (byte[] value : values) length += value.length;
        ByteBuffer result = ByteBuffer.allocate(length);
        for (byte[] value : values) result.put(value);
        return result.array();
    }

    private static final class DerReader {
        private final byte[] value;
        private int offset;

        DerReader(byte[] value) throws VaultFailure {
            if (value == null) throw new VaultFailure("manager_v2_invalid_signature");
            this.value = value;
        }

        byte[] read(int tag) throws VaultFailure {
            if (offset >= value.length || (value[offset++] & 0xff) != tag) throw new VaultFailure("manager_v2_invalid_signature");
            if (offset >= value.length) throw new VaultFailure("manager_v2_invalid_signature");
            int length = value[offset++] & 0xff;
            if ((length & 0x80) != 0) {
                int octets = length & 0x7f;
                if (octets < 1 || octets > 2 || offset + octets > value.length) throw new VaultFailure("manager_v2_invalid_signature");
                length = 0;
                for (int index = 0; index < octets; index += 1) length = (length << 8) | (value[offset++] & 0xff);
            }
            if (length < 0 || offset + length > value.length) throw new VaultFailure("manager_v2_invalid_signature");
            byte[] result = Arrays.copyOfRange(value, offset, offset + length);
            offset += length;
            return result;
        }

        boolean done() { return offset == value.length; }
    }
}
