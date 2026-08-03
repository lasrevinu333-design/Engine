package org.memphiszoo.manager.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

final class InstrumentedTransport implements EnrollmentTransport {
    static final String CREDENTIAL = "instrumented-device-credential-0002";
    private final VaultClock clock;
    boolean confirmed;
    boolean issued;
    boolean cancelled;
    boolean removed;
    final AtomicInteger enrollCalls = new AtomicInteger();
    final AtomicInteger issuanceCount = new AtomicInteger();
    final AtomicInteger cancelCalls = new AtomicInteger();
    final AtomicInteger removeCalls = new AtomicInteger();

    InstrumentedTransport(VaultClock clock) {
        this.clock = clock;
    }

    @Override
    public void prepareEnrollment(EnrollmentRequest request) {}

    @Override
    public synchronized EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        enrollCalls.incrementAndGet();
        boolean replayed = issued;
        if (!issued) {
            issued = true;
            issuanceCount.incrementAndGet();
        }
        if (cancelled) throw new VaultFailure("instrumented_operation_cancelled", 409, "operation_cancelled");
        return new EnrollmentResult(
            request.operationId,
            request.deviceId,
            request.flow,
            CREDENTIAL.toCharArray(),
            new EnrollmentMetadata(
                "instrumented-credential-id",
                Instant.ofEpochMilli(clock.nowMillis() + 86_400_000L).toString(),
                Instant.ofEpochMilli(clock.nowMillis() + 20L * 60L * 1000L).toString(),
                "Instrumented phone",
                "manager-test",
                "Instrumented Manager"
            ),
            replayed
        );
    }

    @Override
    public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        confirmed = true;
        return new TerminalResult(operationId, TerminalOutcome.CONFIRMED, false);
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId) throws VaultFailure {
        cancelCalls.incrementAndGet();
        boolean replayed = cancelled;
        cancelled = true;
        return new TerminalResult(operationId, TerminalOutcome.CANCELLED, replayed);
    }

    @Override
    public TerminalResult remove(String keyOperationId, String operationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        removeCalls.incrementAndGet();
        removed = true;
        return new TerminalResult(operationId, TerminalOutcome.REMOVED, false);
    }

    @Override
    public void activateOperation(String operationId) {}

    @Override
    public void cleanupOperation(String operationId) {}

    @Override
    public synchronized void verifyAuthority(String keyOperationId) throws VaultFailure {
        if (!confirmed || cancelled || removed) throw new VaultFailure("manager_v2_active_keyset_missing");
    }

    @Override
    public AuthorizedResponse authorized(AuthorizedRequest request, String keyOperationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        if (!confirmed || cancelled || removed) throw new VaultFailure("instrumented_not_active", 401);
        return new AuthorizedResponse(
            200,
            Map.of("content-type", "application/json"),
            "{\"ok\":true,\"data\":{\"authenticated\":true}}".getBytes(StandardCharsets.UTF_8)
        );
    }

    private static void requireCredential(char[] supplied) throws VaultFailure {
        char[] expected = CREDENTIAL.toCharArray();
        try {
            if (!VaultValidation.sameSecret(expected, supplied)) throw new VaultFailure("instrumented_credential_mismatch");
        } finally {
            VaultValidation.wipe(expected);
        }
    }

    synchronized int activeCredentials() {
        return issued && !cancelled && !removed ? 1 : 0;
    }
}
