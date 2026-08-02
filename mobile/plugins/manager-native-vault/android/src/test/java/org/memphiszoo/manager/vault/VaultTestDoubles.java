package org.memphiszoo.manager.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

final class MemoryPersistence implements VaultPersistence {
    private VaultSnapshot state;
    final AtomicInteger commitAttempts = new AtomicInteger();
    final Set<Integer> failBeforeCommits = ConcurrentHashMap.newKeySet();
    final Set<Integer> writeThenFailCommits = ConcurrentHashMap.newKeySet();
    volatile int failLoads;

    MemoryPersistence() throws VaultFailure {
        state = VaultSnapshot.empty();
    }

    @Override
    public synchronized VaultSnapshot load() throws VaultFailure {
        if (failLoads > 0) {
            failLoads -= 1;
            throw new VaultFailure("test_load_failure");
        }
        return state;
    }

    @Override
    public synchronized void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure {
        int attempt = commitAttempts.incrementAndGet();
        if (failBeforeCommits.remove(attempt)) throw new VaultFailure("test_commit_failure");
        if (state.revision != expectedRevision || next.revision != expectedRevision + 1) {
            throw new VaultFailure("manager_native_vault_concurrent_change");
        }
        state = next;
        if (writeThenFailCommits.remove(attempt)) throw new VaultFailure("test_readback_failure");
    }

    synchronized VaultSnapshot current() {
        return state;
    }
}

final class TestCipher implements CredentialCipher {
    int destroyCalls;
    int failEncrypts;
    int failDecrypts;

    @Override
    public synchronized EncryptedSecret encrypt(char[] cleartext) throws VaultFailure {
        if (failEncrypts > 0) {
            failEncrypts -= 1;
            throw new VaultFailure("test_encrypt_failure");
        }
        String encoded = java.util.Base64.getEncoder().encodeToString(new String(cleartext).getBytes(StandardCharsets.UTF_8));
        return new EncryptedSecret(encoded, "dGVzdC1pdi12Mg==");
    }

    @Override
    public synchronized char[] decrypt(EncryptedSecret secret) throws VaultFailure {
        if (failDecrypts > 0) {
            failDecrypts -= 1;
            throw new VaultFailure("test_decrypt_failure");
        }
        try {
            return new String(java.util.Base64.getDecoder().decode(secret.ciphertext), StandardCharsets.UTF_8).toCharArray();
        } catch (Exception error) {
            throw new VaultFailure("test_decrypt_failure", error);
        }
    }

    @Override
    public synchronized void destroyKey() {
        destroyCalls += 1;
    }
}

final class MutableClock implements VaultClock {
    long now;

    MutableClock(long now) {
        this.now = now;
    }

    @Override
    public long nowMillis() {
        return now;
    }
}

final class TestSealGenerator implements InstallationSealGenerator {
    final AtomicInteger calls = new AtomicInteger();
    int failures;

    @Override
    public String newSeal() throws VaultFailure {
        if (failures > 0) {
            failures -= 1;
            throw new VaultFailure("test_seal_failure");
        }
        return String.format(java.util.Locale.ROOT, "native-installation-seal-%04d", calls.incrementAndGet());
    }
}

final class FakeLegacySource implements LegacyVaultSource {
    private char[] credential;
    private InstallationBinding binding;
    private String seal;
    private boolean keysPresent;
    int failCleanupBefore;
    int failCleanupAfterValues;
    int cleanupCalls;

    FakeLegacySource() {}

    FakeLegacySource(char[] credential, InstallationBinding binding, String seal) {
        this.credential = credential.clone();
        this.binding = binding;
        this.seal = seal;
        this.keysPresent = true;
    }

    @Override
    public synchronized LegacyMaterial read() throws VaultFailure {
        return credential == null ? null : new LegacyMaterial(credential, binding, seal);
    }

    @Override
    public synchronized void cleanup() throws VaultFailure {
        cleanupCalls += 1;
        if (failCleanupBefore > 0) {
            failCleanupBefore -= 1;
            throw new VaultFailure("manager_native_legacy_cleanup_failed");
        }
        if (credential != null) Arrays.fill(credential, '\0');
        credential = null;
        binding = null;
        seal = "";
        if (failCleanupAfterValues > 0) {
            failCleanupAfterValues -= 1;
            throw new VaultFailure("manager_native_legacy_cleanup_failed");
        }
        keysPresent = false;
    }

    @Override
    public synchronized boolean isClean() {
        return credential == null && !keysPresent;
    }

    synchronized void replaceCredential(char[] replacement) {
        if (credential != null) Arrays.fill(credential, '\0');
        credential = replacement.clone();
    }
}

final class FakeTransport implements EnrollmentTransport {
    private final MutableClock clock;
    private final Map<String, Operation> operations = new ConcurrentHashMap<>();
    private final Map<String, String> activeOperationByDevice = new ConcurrentHashMap<>();
    final AtomicInteger enrollCalls = new AtomicInteger();
    final AtomicInteger issuanceCount = new AtomicInteger();
    final AtomicInteger confirmCalls = new AtomicInteger();
    final AtomicInteger cancelCalls = new AtomicInteger();
    final AtomicInteger removeCalls = new AtomicInteger();
    volatile int loseEnrollAfterSuccess;
    volatile int loseConfirmAfterSuccess;
    volatile int loseCancelAfterSuccess;
    volatile int loseRemoveAfterSuccess;
    volatile int confirmHttpFailure;
    volatile int enrollHttpFailure;
    volatile String enrollRemoteReason = "";
    volatile int failEnrollBeforeIssueNetwork;
    String legacyCredential = "legacy-device-credential";
    String legacyDeviceId = "ops-app-11111111-1111-4111-8111-111111111111";
    volatile CountDownLatch authorizedStarted;
    volatile CountDownLatch releaseAuthorized;
    final AtomicInteger authorizedInFlight = new AtomicInteger();
    final AtomicInteger maximumAuthorizedInFlight = new AtomicInteger();

    FakeTransport(MutableClock clock) {
        this.clock = clock;
    }

    @Override
    public EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        enrollCalls.incrementAndGet();
        if (failEnrollBeforeIssueNetwork > 0) {
            failEnrollBeforeIssueNetwork -= 1;
            throw new VaultFailure("manager_native_network_unavailable");
        }
        if (enrollHttpFailure != 0) {
            throw new VaultFailure("manager_native_enrollment_failed", enrollHttpFailure, enrollRemoteReason);
        }
        String code = new String(enrollmentCode);
        Operation operation;
        synchronized (this) {
            operation = operations.get(request.operationId);
            if (operation == null) {
                operation = new Operation(
                    request.operationId,
                    request.deviceId,
                    request.flow,
                    code,
                    "device-credential-" + request.operationId
                );
                operations.put(request.operationId, operation);
                activeOperationByDevice.put(request.deviceId, request.operationId);
                issuanceCount.incrementAndGet();
            } else if (
                !operation.deviceId.equals(request.deviceId)
                || !operation.flow.equals(request.flow)
                || !operation.code.equals(code)
            ) {
                throw new VaultFailure("fake_idempotency_conflict", 409);
            }
            if (operation.cancelled) throw new VaultFailure("fake_operation_cancelled", 409);
            if (loseEnrollAfterSuccess > 0) {
                loseEnrollAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return result(operation, enrollCalls.get() > 1);
    }

    @Override
    public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
        confirmCalls.incrementAndGet();
        if (confirmHttpFailure != 0) throw new VaultFailure("manager_native_terminal_request_failed", confirmHttpFailure);
        Operation operation = require(operationId, deviceId, credential, true);
        boolean replayed;
        synchronized (this) {
            replayed = operation.confirmed;
            operation.confirmed = true;
            if (loseConfirmAfterSuccess > 0) {
                loseConfirmAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return new TerminalResult(operationId, replayed);
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId, char[] credential) throws VaultFailure {
        cancelCalls.incrementAndGet();
        Operation operation = require(operationId, deviceId, credential, false);
        boolean replayed;
        synchronized (this) {
            replayed = operation.cancelled;
            operation.cancelled = true;
            activeOperationByDevice.remove(deviceId, operationId);
            if (loseCancelAfterSuccess > 0) {
                loseCancelAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return new TerminalResult(operationId, replayed);
    }

    @Override
    public TerminalResult remove(String operationId, String deviceId, char[] credential) throws VaultFailure {
        removeCalls.incrementAndGet();
        Operation enrollment = requireByCredential(deviceId, credential);
        boolean replayed;
        synchronized (this) {
            replayed = enrollment.removed;
            enrollment.removed = true;
            activeOperationByDevice.remove(deviceId, enrollment.operationId);
            if (loseRemoveAfterSuccess > 0) {
                loseRemoveAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return new TerminalResult(operationId, replayed);
    }

    @Override
    public String verifyLegacyIdentity(String candidateDeviceId, char[] credential) throws VaultFailure {
        char[] expected = legacyCredential.toCharArray();
        try {
            if (!candidateDeviceId.equals(legacyDeviceId) || !VaultValidation.sameSecret(expected, credential)) {
                throw new VaultFailure("manager_native_legacy_identity_unverified", 401);
            }
            return legacyDeviceId;
        } finally {
            VaultValidation.wipe(expected);
        }
    }

    @Override
    public AuthorizedResponse authorized(AuthorizedRequest request, String deviceId, char[] credential) throws VaultFailure {
        Operation operation = requireByCredential(deviceId, credential);
        if (!operation.confirmed || operation.cancelled || operation.removed) {
            throw new VaultFailure("fake_credential_not_active", 401);
        }
        AuthorizedResponse response = new AuthorizedResponse(
            200,
            Map.of("content-type", "application/json"),
            "{\"ok\":true}".getBytes(StandardCharsets.UTF_8)
        );
        CountDownLatch started = authorizedStarted;
        CountDownLatch release = releaseAuthorized;
        if (started != null && release != null) {
            int concurrent = authorizedInFlight.incrementAndGet();
            maximumAuthorizedInFlight.accumulateAndGet(concurrent, Math::max);
            started.countDown();
            try {
                if (!release.await(10, TimeUnit.SECONDS)) throw new VaultFailure("fake_authorized_timeout");
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                throw new VaultFailure("fake_authorized_interrupted", error);
            } finally {
                authorizedInFlight.decrementAndGet();
            }
        }
        return response;
    }

    synchronized int activeCredentials(String deviceId) {
        String operationId = activeOperationByDevice.get(deviceId);
        if (operationId == null) return 0;
        Operation operation = operations.get(operationId);
        return operation != null && !operation.cancelled && !operation.removed ? 1 : 0;
    }

    synchronized boolean confirmed(String operationId) {
        Operation operation = operations.get(operationId);
        return operation != null && operation.confirmed;
    }

    synchronized boolean cancelled(String operationId) {
        Operation operation = operations.get(operationId);
        return operation != null && operation.cancelled;
    }

    private EnrollmentResult result(Operation operation, boolean replayed) throws VaultFailure {
        char[] credential = operation.credential.toCharArray();
        try {
            return new EnrollmentResult(
                operation.operationId,
                operation.deviceId,
                operation.flow,
                credential,
                new EnrollmentMetadata(
                    "credential-id-" + operation.deviceId,
                    Instant.ofEpochMilli(clock.now + 86_400_000L).toString(),
                    Instant.ofEpochMilli(clock.now + 20L * 60L * 1000L).toString(),
                    operation.deviceId + " phone",
                    "manager-1",
                    "Manager One"
                ),
                replayed
            );
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private synchronized Operation require(
        String operationId,
        String deviceId,
        char[] credential,
        boolean allowConfirmed
    ) throws VaultFailure {
        Operation operation = operations.get(operationId);
        if (operation == null || !operation.deviceId.equals(deviceId)) {
            throw new VaultFailure("fake_credential_rejected", 401);
        }
        char[] expected = operation.credential.toCharArray();
        try {
            if (!VaultValidation.sameSecret(expected, credential)) throw new VaultFailure("fake_credential_rejected", 401);
        } finally {
            VaultValidation.wipe(expected);
        }
        if (!allowConfirmed && operation.removed) return operation;
        return operation;
    }

    private synchronized Operation requireByCredential(String deviceId, char[] credential) throws VaultFailure {
        for (Operation operation : operations.values()) {
            char[] expected = operation.credential.toCharArray();
            try {
                if (operation.deviceId.equals(deviceId) && VaultValidation.sameSecret(expected, credential)) return operation;
            } finally {
                VaultValidation.wipe(expected);
            }
        }
        throw new VaultFailure("fake_credential_rejected", 401);
    }

    private static final class Operation {
        final String operationId;
        final String deviceId;
        final String flow;
        final String code;
        final String credential;
        boolean confirmed;
        boolean cancelled;
        boolean removed;

        Operation(String operationId, String deviceId, String flow, String code, String credential) {
            this.operationId = operationId;
            this.deviceId = deviceId;
            this.flow = flow;
            this.code = code;
            this.credential = credential;
        }
    }
}
