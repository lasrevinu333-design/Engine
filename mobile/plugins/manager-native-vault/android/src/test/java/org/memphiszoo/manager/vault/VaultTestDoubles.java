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
    int encryptCalls;
    int decryptCalls;
    int failEncrypts;
    int failDecrypts;
    String decryptFailureCode = "test_decrypt_failure";
    char[] lastDecrypted;

    @Override
    public synchronized EncryptedSecret encrypt(char[] cleartext) throws VaultFailure {
        encryptCalls += 1;
        if (failEncrypts > 0) {
            failEncrypts -= 1;
            throw new VaultFailure("test_encrypt_failure");
        }
        String encoded = java.util.Base64.getEncoder().encodeToString(new String(cleartext).getBytes(StandardCharsets.UTF_8));
        return new EncryptedSecret(encoded, "dGVzdC1pdi12Mg==");
    }

    @Override
    public synchronized char[] decrypt(EncryptedSecret secret) throws VaultFailure {
        decryptCalls += 1;
        if (failDecrypts > 0) {
            failDecrypts -= 1;
            throw new VaultFailure(decryptFailureCode);
        }
        try {
            lastDecrypted = new String(
                java.util.Base64.getDecoder().decode(secret.ciphertext), StandardCharsets.UTF_8
            ).toCharArray();
            return lastDecrypted;
        } catch (Exception error) {
            throw new VaultFailure(decryptFailureCode, error);
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
    volatile int confirmExpired;
    volatile int cancelHttpFailure;
    volatile String cancelRemoteReason = "";
    volatile int cancelExpired;
    volatile int enrollHttpFailure;
    volatile String enrollRemoteReason = "";
    volatile int failEnrollBeforeIssueNetwork;
    volatile int failPrepareEnrollment;
    final AtomicInteger prepareEnrollmentCalls = new AtomicInteger();
    String legacyCredential = "legacy-device-credential";
    String legacyDeviceId = "ops-app-11111111-1111-4111-8111-111111111111";
    volatile CountDownLatch authorizedStarted;
    volatile CountDownLatch releaseAuthorized;
    final AtomicInteger authorizedInFlight = new AtomicInteger();
    final AtomicInteger maximumAuthorizedInFlight = new AtomicInteger();
    volatile String lastAuthorizedKeyOperation = "";

    FakeTransport(MutableClock clock) {
        this.clock = clock;
    }

    @Override
    public void prepareEnrollment(EnrollmentRequest request) throws VaultFailure {
        prepareEnrollmentCalls.incrementAndGet();
        if (failPrepareEnrollment > 0) {
            failPrepareEnrollment -= 1;
            throw new VaultFailure("manager_v2_operation_key_missing");
        }
    }

    @Override
    public EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        enrollCalls.incrementAndGet();
        if (request.flow.equals("recovery")) {
            String activeAuthority = activeOperationByDevice.get(request.deviceId);
            if (activeAuthority == null || !activeAuthority.equals(request.authorityOperationId)) {
                throw new VaultFailure("manager_native_replacement_required");
            }
        } else if (!request.authorityOperationId.isEmpty()) {
            throw new VaultFailure("manager_native_enrollment_conflict");
        }
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
            if (confirmExpired > 0) {
                confirmExpired -= 1;
                operation.cancelled = true;
                activeOperationByDevice.remove(deviceId, operationId);
                return new TerminalResult(operationId, TerminalOutcome.EXPIRED, replayed);
            }
            operation.confirmed = true;
            activeOperationByDevice.put(deviceId, operationId);
            if (loseConfirmAfterSuccess > 0) {
                loseConfirmAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return new TerminalResult(operationId, TerminalOutcome.CONFIRMED, replayed);
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId) throws VaultFailure {
        cancelCalls.incrementAndGet();
        if (cancelHttpFailure != 0) {
            throw new VaultFailure("manager_v2_cancel_failed", cancelHttpFailure, cancelRemoteReason);
        }
        Operation operation = operations.get(operationId);
        if (operation == null) {
            return new TerminalResult(operationId, TerminalOutcome.EXPIRED, true);
        }
        if (!operation.deviceId.equals(deviceId)) throw new VaultFailure("fake_operation_rejected", 401);
        boolean replayed;
        synchronized (this) {
            replayed = operation.cancelled;
            operation.cancelled = true;
            activeOperationByDevice.remove(deviceId, operationId);
            if (cancelExpired > 0) {
                cancelExpired -= 1;
                return new TerminalResult(operationId, TerminalOutcome.EXPIRED, replayed);
            }
            if (loseCancelAfterSuccess > 0) {
                loseCancelAfterSuccess -= 1;
                throw new VaultFailure("manager_native_network_unavailable");
            }
        }
        return new TerminalResult(operationId, TerminalOutcome.CANCELLED, replayed);
    }

    @Override
    public TerminalResult remove(String keyOperationId, String operationId, String deviceId, char[] credential) throws VaultFailure {
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
        return new TerminalResult(operationId, TerminalOutcome.REMOVED, replayed);
    }

    @Override
    public void activateOperation(String operationId) {}

    @Override
    public void cleanupOperation(String operationId) {}

    @Override
    public void verifyAuthority(String keyOperationId) throws VaultFailure {
        if (!activeOperationByDevice.containsValue(VaultValidation.operationId(keyOperationId))) {
            throw new VaultFailure("manager_v2_active_keyset_missing");
        }
    }

    @Override
    public AuthorizedResponse authorized(AuthorizedRequest request, String keyOperationId, String deviceId, char[] credential) throws VaultFailure {
        Operation operation = requireByCredential(deviceId, credential);
        lastAuthorizedKeyOperation = VaultValidation.operationId(keyOperationId);
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

    synchronized void loseActiveTransportAuthority(String deviceId) {
        activeOperationByDevice.remove(deviceId);
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

    private synchronized Operation requireOperation(String operationId, String deviceId) throws VaultFailure {
        Operation operation = operations.get(operationId);
        if (operation == null || !operation.deviceId.equals(deviceId)) {
            throw new VaultFailure("fake_operation_rejected", 401);
        }
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
