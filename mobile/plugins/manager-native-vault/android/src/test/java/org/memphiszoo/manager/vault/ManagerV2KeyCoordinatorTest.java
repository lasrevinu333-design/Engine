package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public final class ManagerV2KeyCoordinatorTest {
    private static final String OP = "11111111-1111-4111-8111-111111111111";
    private static final String OTHER = "22222222-2222-4222-8222-222222222222";

    @Test
    public void registryCommitsBeforeAnyKeyCreation() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        persistence.failNextBefore();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        expect("test_manager_v2_commit_failure", () -> coordinator(persistence, keys).preparePending(OP));
        assertEquals(0, keys.signingCreates.get());
        assertEquals(0, keys.wrappingCreates.get());
        assertEquals(0, persistence.state.revision);
        assertNull(persistence.state.pending);
    }

    @Test
    public void signingCommitFailureRecoversWithoutMultiplyingKeys() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        persistence.failBefore.add(2);
        expect("test_manager_v2_commit_failure", () -> coordinator(persistence, keys).preparePending(OP));
        assertEquals(ManagerV2KeyPhase.PRECOMMITTED, persistence.state.pending.phase);
        assertEquals(1, keys.signingCreates.get());
        assertEquals(0, keys.wrappingCreates.get());

        ManagerV2OperationRecord recovered = coordinator(persistence, keys).preparePending(OP);
        assertEquals(ManagerV2KeyPhase.READY, recovered.phase);
        assertEquals(1, keys.signingCreates.get());
        assertEquals(1, keys.wrappingCreates.get());
        assertEquals("trusted_environment", coordinator(persistence, keys).securityLevel(OP));
    }

    @Test
    public void concurrentDuplicatePreparationConvergesOnOnePendingKeyset() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        ExecutorService executor = Executors.newFixedThreadPool(8);
        try {
            @SuppressWarnings("unchecked")
            Future<ManagerV2OperationRecord>[] futures = new Future[16];
            for (int index = 0; index < futures.length; index += 1) {
                futures[index] = executor.submit(() -> coordinator.preparePending(OP));
            }
            String signing = null;
            String wrapping = null;
            for (Future<ManagerV2OperationRecord> future : futures) {
                ManagerV2OperationRecord result = future.get();
                if (signing == null) {
                    signing = result.signingKeyId;
                    wrapping = result.wrappingKeyId;
                }
                assertEquals(signing, result.signingKeyId);
                assertEquals(wrapping, result.wrappingKeyId);
            }
        } finally {
            executor.shutdownNow();
        }
        assertEquals(1, keys.signingCreates.get());
        assertEquals(1, keys.wrappingCreates.get());
        assertEquals(2, keys.keyCount());
        expect("manager_v2_operation_conflict", () -> coordinator.preparePending(OTHER));
    }

    @Test
    public void recoveryKeepsActiveAndPendingAuthoritiesSeparate() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        coordinator.preparePending(OP);
        coordinator.promote(OP);

        coordinator.preparePending(OTHER);
        assertEquals(OP, persistence.state.active.operationId);
        assertEquals(OTHER, persistence.state.pending.operationId);
        assertEquals(4, keys.keyCount());
        coordinator.requireActive(OP);
        coordinator.requirePending(OTHER);

        coordinator.cancelPending(OTHER);
        assertEquals(OP, persistence.state.active.operationId);
        assertNull(persistence.state.pending);
        assertTrue(keys.hasSigningKey(OP));
        assertFalse(keys.hasSigningKey(OTHER));
    }

    @Test
    public void failedPromotionCommitPreservesOldAuthorityAndPendingRetry() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        coordinator.preparePending(OTHER);
        persistence.failNextBefore();

        expect("test_manager_v2_commit_failure", () -> coordinator.promote(OTHER));
        assertEquals(OP, persistence.state.active.operationId);
        assertEquals(OTHER, persistence.state.pending.operationId);
        assertNull(persistence.state.retiring);
        assertTrue(keys.hasSigningKey(OP));
        assertTrue(keys.hasSigningKey(OTHER));

        coordinator(persistence, keys).promote(OTHER);
        assertEquals(OTHER, persistence.state.active.operationId);
        assertFalse(keys.hasSigningKey(OP));
        assertTrue(keys.hasSigningKey(OTHER));
    }

    @Test
    public void processDeathAfterPromotionIsRecoveredBeforeFurtherUse() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        coordinator.preparePending(OTHER);
        persistence.writeThenFailNext();

        expect("test_manager_v2_readback_failure", () -> coordinator.promote(OTHER));
        assertEquals(OTHER, persistence.state.active.operationId);
        assertEquals(OP, persistence.state.retiring.operationId);
        assertTrue(keys.hasSigningKey(OP));

        ManagerV2KeyCoordinator restarted = coordinator(persistence, keys);
        restarted.requireActive(OTHER);
        assertNull(persistence.state.retiring);
        assertFalse(keys.hasSigningKey(OP));
        assertEquals(2, keys.keyCount());
    }

    @Test
    public void cleanupFailureLeavesDurableRetiringMarkerForRestart() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        coordinator.preparePending(OTHER);
        keys.failDestroyOnce.add(OP);

        expect("test_manager_v2_destroy_failure", () -> coordinator.promote(OTHER));
        assertNotNull(persistence.state.retiring);
        assertEquals(OP, persistence.state.retiring.operationId);
        coordinator(persistence, keys).requireActive(OTHER);
        assertNull(persistence.state.retiring);
        assertFalse(keys.hasSigningKey(OP));
    }

    @Test
    public void keyLossAndSoftwareSecurityLevelFailClosed() throws Exception {
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = coordinator(persistence, keys);
        coordinator.preparePending(OP);
        keys.signing.remove(OP);
        expect("manager_v2_operation_key_missing", () -> coordinator.requirePending(OP));
        keys.createSigningKey(OP);
        expect("manager_v2_operation_key_missing", () -> coordinator.requirePending(OP));

        MemoryManagerV2Persistence secondPersistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing softwareKeys = new FakeManagerV2KeyRing();
        softwareKeys.securityLevel = "software";
        expect("native_security_capability_required", () -> coordinator(secondPersistence, softwareKeys).preparePending(OTHER));
    }

    private static ManagerV2KeyCoordinator coordinator(MemoryManagerV2Persistence persistence, FakeManagerV2KeyRing keys) {
        return new ManagerV2KeyCoordinator(persistence, keys, () -> 1_785_661_200_000L);
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

final class MemoryManagerV2Persistence implements ManagerV2OperationPersistence {
    ManagerV2KeyRegistry state;
    final AtomicInteger attempts = new AtomicInteger();
    final Set<Integer> failBefore = ConcurrentHashMap.newKeySet();
    final Set<Integer> writeThenFail = ConcurrentHashMap.newKeySet();

    MemoryManagerV2Persistence() throws VaultFailure {
        state = ManagerV2KeyRegistry.empty();
    }

    void failNextBefore() { failBefore.add(attempts.get() + 1); }
    void writeThenFailNext() { writeThenFail.add(attempts.get() + 1); }

    @Override
    public synchronized ManagerV2KeyRegistry load() { return state; }

    @Override
    public synchronized void commit(long expectedRevision, ManagerV2KeyRegistry next) throws VaultFailure {
        int attempt = attempts.incrementAndGet();
        if (failBefore.remove(attempt)) throw new VaultFailure("test_manager_v2_commit_failure");
        if (state.revision != expectedRevision || next.revision != expectedRevision + 1) {
            throw new VaultFailure("manager_v2_operation_concurrent_change");
        }
        state = next;
        if (writeThenFail.remove(attempt)) throw new VaultFailure("test_manager_v2_readback_failure");
    }
}

final class FakeManagerV2KeyRing implements ManagerV2KeyRing {
    final Map<String, KeyPair> signing = new ConcurrentHashMap<>();
    final Map<String, KeyPair> wrapping = new ConcurrentHashMap<>();
    final AtomicInteger signingCreates = new AtomicInteger();
    final AtomicInteger wrappingCreates = new AtomicInteger();
    final Set<String> failDestroyOnce = ConcurrentHashMap.newKeySet();
    final Map<String, byte[]> sessionPlaintexts = new ConcurrentHashMap<>();
    final java.util.List<String> signOperationIds = new java.util.concurrent.CopyOnWriteArrayList<>();
    String securityLevel = "trusted_environment";

    @Override public boolean hasSigningKey(String operationId) { return signing.containsKey(operationId); }
    @Override public boolean hasWrappingKey(String operationId) { return wrapping.containsKey(operationId); }

    @Override
    public synchronized void createSigningKey(String operationId) throws VaultFailure {
        if (!signing.containsKey(operationId)) {
            signing.put(operationId, pair());
            signingCreates.incrementAndGet();
        }
    }

    @Override
    public synchronized void createWrappingKey(String operationId) throws VaultFailure {
        if (!wrapping.containsKey(operationId)) {
            wrapping.put(operationId, pair());
            wrappingCreates.incrementAndGet();
        }
    }

    @Override public PublicKey signingPublicKey(String operationId) throws VaultFailure {
        KeyPair value = signing.get(operationId);
        if (value == null) throw new VaultFailure("manager_v2_operation_key_missing");
        return value.getPublic();
    }
    @Override public PublicKey wrappingPublicKey(String operationId) throws VaultFailure {
        KeyPair value = wrapping.get(operationId);
        if (value == null) throw new VaultFailure("manager_v2_operation_key_missing");
        return value.getPublic();
    }

    @Override
    public byte[] sign(String operationId, byte[] proofInput) throws VaultFailure {
        try {
            signOperationIds.add(operationId);
            Signature value = Signature.getInstance("SHA256withECDSA");
            value.initSign(signing.get(operationId).getPrivate());
            value.update(proofInput);
            return ManagerV2WireContract.derToP1363LowS(value.sign());
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_signing_failed", error);
        }
    }

    @Override public String securityLevel(String operationId) { return securityLevel; }

    @Override
    public byte[] decryptEnvelope(String operationId, PublicKey ephemeralPublicKey, String wrappingKeyId, byte[] salt, byte[] iv, byte[] ciphertext, byte[] tag, byte[] aad) throws VaultFailure {
        return ManagerV2WireContract.decryptEnvelope(wrapping.get(operationId).getPrivate(), ephemeralPublicKey, operationId, wrappingKeyId, salt, iv, ciphertext, tag, aad);
    }

    @Override
    public byte[] decryptSessionEnvelope(String keyOperationId, String sessionOperationId, PublicKey ephemeralPublicKey, String wrappingKeyId, byte[] salt, byte[] iv, byte[] ciphertext, byte[] tag, byte[] aad) throws VaultFailure {
        byte[] fixture = sessionPlaintexts.get(sessionOperationId);
        if (fixture != null) return fixture.clone();
        return ManagerV2WireContract.decryptSessionEnvelope(wrapping.get(keyOperationId).getPrivate(), ephemeralPublicKey, sessionOperationId, wrappingKeyId, salt, iv, ciphertext, tag, aad);
    }

    @Override
    public synchronized void destroy(String operationId) throws VaultFailure {
        if (failDestroyOnce.remove(operationId)) throw new VaultFailure("test_manager_v2_destroy_failure");
        signing.remove(operationId);
        wrapping.remove(operationId);
    }

    int keyCount() { return signing.size() + wrapping.size(); }

    private static KeyPair pair() throws VaultFailure {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_crypto_unavailable", error);
        }
    }
}
