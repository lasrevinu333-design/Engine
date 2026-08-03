package org.memphiszoo.manager.vault;

import java.security.SecureRandom;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

final class ManagerV2ProofFactory {
    interface NonceSource { void nextBytes(byte[] value); }

    private final ManagerV2KeyRing keys;
    private final VaultClock clock;
    private final NonceSource nonceSource;

    ManagerV2ProofFactory(ManagerV2KeyRing keys, VaultClock clock) {
        SecureRandom random = new SecureRandom();
        this.keys = keys;
        this.clock = clock;
        this.nonceSource = random::nextBytes;
    }

    ManagerV2ProofFactory(ManagerV2KeyRing keys, VaultClock clock, NonceSource nonceSource) {
        this.keys = keys;
        this.clock = clock;
        this.nonceSource = nonceSource;
    }

    Map<String, Object> create(
        String keyOperationId,
        String requestOperationId,
        String path,
        String bodySha256
    ) throws VaultFailure {
        byte[] nonce = new byte[16];
        byte[] input = null;
        byte[] signature = null;
        try {
            nonceSource.nextBytes(nonce);
            String encodedNonce = ManagerV2WireContract.base64url(nonce);
            long issuedAt = clock.nowMillis() / 1000L;
            input = ManagerV2WireContract.proofInput(
                "POST", path, requestOperationId, issuedAt, encodedNonce, bodySha256
            );
            signature = keys.sign(keyOperationId, input);
            if (signature.length != 64) throw new VaultFailure("manager_v2_signing_failed");
            Map<String, Object> proof = new LinkedHashMap<>();
            proof.put("algorithm", ManagerV2WireContract.PROOF_ALGORITHM);
            proof.put("issued_at", issuedAt);
            proof.put("nonce", encodedNonce);
            proof.put("signature", ManagerV2WireContract.base64url(signature));
            return VaultCollections.copyMap(proof);
        } finally {
            Arrays.fill(nonce, (byte) 0);
            if (input != null) Arrays.fill(input, (byte) 0);
            if (signature != null) Arrays.fill(signature, (byte) 0);
        }
    }
}
