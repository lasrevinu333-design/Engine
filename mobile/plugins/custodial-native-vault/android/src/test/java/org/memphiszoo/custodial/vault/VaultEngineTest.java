package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public final class VaultEngineTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String OP1 = "11111111-1111-4111-8111-111111111111";
    private static final String OP2 = "22222222-2222-4222-8222-222222222222";
    private static final String REMOVE = "33333333-3333-4333-8333-333333333333";
    private static final String DEVICE = "KIOSK_02";
    private static final String SEAL = "installation-seal-0002";

    @Test
    public void fullLifecycleKeepsGenericTransportActiveOnlyAndEndsEmpty() throws Exception {
        Fixture fixture = new Fixture();
        assertEquals("EMPTY", fixture.engine.getState().get("state"));

        EnrollmentView enrolled = fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        assertEquals("CREDENTIAL_STAGED", enrolled.phase.name());
        assertFalse(enrolled.safeData().containsKey("device_credential"));
        expectCode("custodial_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ));

        Map<String, Object> pending = fixture.engine.completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", pending.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) pending.get("installation")).get("device_id"));
        assertFalse(pending.containsKey("device_credential"));

        Map<String, Object> active = fixture.engine.confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals("enrollment", active.get("active_enrollment_flow"));
        assertEquals(OP1, ((Map<?, ?>) active.get("installation")).get("enrollment_operation_id"));
        AuthorizedResponse response = fixture.engine.authorizedRequest(DEVICE, request("/device-auth/status?device_id=KIOSK_02"));
        assertEquals(200, response.status);

        RemovalView removal = fixture.engine.removeEnrollment(REMOVE, DEVICE);
        assertTrue(removal.removed);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        assertFalse(fixture.persistence.current().hasCredential());
        Map<String, Object> empty = fixture.engine.finalizeRemoval(REMOVE);
        assertEquals("EMPTY", empty.get("state"));
        assertEquals(1, fixture.cipher.destroyCalls);
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void activeCredentialCannotBeOverwrittenByDirectRecoveryEnrollment() throws Exception {
        Fixture fixture = activeFixture();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        int enrollCallsBefore = fixture.transport.enrollCalls.get();

        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "00000000".toCharArray()
        ));

        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(enrollCallsBefore, fixture.transport.enrollCalls.get());
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ).status);
    }

    @Test
    public void unusableActiveCredentialFailsReadinessAndAllowsOnlyExactRecovery() throws Exception {
        Fixture fixture = activeFixture();
        fixture.cipher.makeUnreadable(fixture.persistence.current().secret);

        Map<String, Object> unhealthy = fixture.engine.getState();
        assertEquals("RECOVERY_REQUIRED", unhealthy.get("state"));
        assertEquals(false, unhealthy.get("active"));
        assertEquals(false, unhealthy.get("credential_present"));
        assertEquals(false, unhealthy.get("credential_usable"));
        assertEquals(true, unhealthy.get("recovery_required"));
        assertEquals(DEVICE, unhealthy.get("recovery_device_id"));
        assertEquals("test_decrypt_failure", unhealthy.get("recovery_reason"));

        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            DEVICE,
            "enrollment",
            "87654321".toCharArray()
        ));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.engine.enroll(
            OP2,
            "KIOSK_03",
            "recovery",
            "87654321".toCharArray()
        ));

        EnrollmentView recovered = fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            "87654321".toCharArray()
        );
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.cipher.destroyCalls);
        assertEquals(2, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        fixture.engine.completeLocalBinding(OP2);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP2);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(true, active.get("credential_usable"));
        assertEquals(false, active.get("recovery_required"));
    }

    @Test
    public void enrollmentResponseLossResumesAfterProcessRestartWithOneCredential() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        VaultEngine restarted = fixture.restart();
        EnrollmentView resumed = restarted.resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", resumed.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(2, fixture.transport.enrollCalls.get());
    }

    @Test
    public void authoritativeInvalidCodeRetiresOperationAndCorrectedCodeCanStartFresh() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        VaultFailure invalid = expectCode("custodial_native_enrollment_terminal", () -> fixture.engine.enroll(
            OP1,
            DEVICE,
            "enrollment",
            code()
        ));
        assertEquals(401, invalid.httpStatus);
        assertEquals("invalid_enrollment_code", invalid.remoteReason);
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        Map<String, Object> terminal = fixture.engine.getState();
        assertTrue((Boolean) terminal.get("enrollment_terminal"));
        assertEquals(OP1, terminal.get("cancelled_operation_id"));
        assertEquals(0, fixture.transport.issuanceCount.get());

        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        EnrollmentView corrected = fixture.engine.enroll(OP2, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", corrected.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
    }

    @Test
    public void ambiguousAttemptNeverTreatsLaterBadCodeAsNoIssuanceProof() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.failEnrollBeforeIssueNetwork = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        expectCode("custodial_native_enrollment_failed", () -> fixture.restart().resumeEnrollment(OP1));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        expectCode("custodial_native_enrollment_failed", () -> fixture.restart().cancelEnrollment(OP1));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        fixture.transport.enrollHttpFailure = 409;
        fixture.transport.enrollRemoteReason = "operation_expired";
        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(OP1, cancelled.get("cancelled_operation_id"));
    }

    @Test
    public void ambiguousDispatchFollowedByGeneric400RemainsResumable() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(
            OP1,
            DEVICE,
            "enrollment",
            code()
        ));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 400;
        fixture.transport.enrollRemoteReason = "malformed_request";
        VaultFailure rejected = expectCode(
            "custodial_native_enrollment_failed",
            () -> fixture.restart().resumeEnrollment(OP1)
        );
        assertEquals(400, rejected.httpStatus);
        assertEquals("malformed_request", rejected.remoteReason);
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        EnrollmentView recovered = fixture.restart().resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void failedCredentialCommitDurablyCompensatesBeforeRemoteCancel() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.failBeforeCommits.add(3);
        expectCode("test_commit_failure", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void failedCompensationJournalLeavesServerResultResumable() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.failBeforeCommits.add(3);
        fixture.persistence.failBeforeCommits.add(4);
        expectCode("test_commit_failure", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertFalse(fixture.transport.cancelled(OP1));

        EnrollmentView recovered = fixture.restart().resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void writeThenThrowIsRecognizedByExactReadback() throws Exception {
        Fixture fixture = new Fixture();
        fixture.persistence.writeThenFailCommits.add(3);
        EnrollmentView view = fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        assertEquals("CREDENTIAL_STAGED", view.phase.name());
        assertFalse(fixture.transport.cancelled(OP1));
        assertEquals(1, fixture.transport.issuanceCount.get());
    }

    @Test
    public void localBindingCommitFailureRetriesWithoutAnotherEnrollment() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.persistence.failBeforeCommits.add(4);
        expectCode("test_commit_failure", () -> fixture.engine.completeLocalBinding(OP1));
        assertEquals("CREDENTIAL_STAGED", fixture.persistence.current().phase.name());

        Map<String, Object> state = fixture.restart().completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", state.get("state"));
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void processDeathAfterNativeBindingExposesExactReconciliationProof() throws Exception {
        Fixture fixture = new Fixture();
        EnrollmentView enrolled = fixture.engine.enroll(OP1, DEVICE, "recovery", code());
        Map<?, ?> nativeInstallation = (Map<?, ?>) enrolled.safeData().get("installation");
        assertNotNull(nativeInstallation);
        fixture.engine.completeLocalBinding(OP1);

        Map<String, Object> recovered = fixture.restart().getState();
        assertEquals("PENDING_SERVER_CONFIRMATION", recovered.get("state"));
        assertEquals(OP1, recovered.get("pending_operation_id"));
        assertEquals(DEVICE, recovered.get("pending_device_id"));
        assertEquals("recovery", recovered.get("pending_flow"));
        assertEquals(nativeInstallation, recovered.get("installation"));
        Map<?, ?> pending = (Map<?, ?>) recovered.get("pending_enrollment");
        assertEquals(OP1, pending.get("operation_id"));
        assertEquals("recovery", pending.get("flow"));
        assertEquals(DEVICE, pending.get("device_id"));
        assertFalse(pending.containsKey("device_credential"));
    }

    @Test
    public void bindingAndEnrollmentReplaysMustMatchExactIdentity() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        EnrollmentView replay = fixture.engine.enroll(OP1, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", replay.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        fixture.engine.completeLocalBinding(OP1);
        Map<String, Object> replayed = fixture.engine.completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", replayed.get("state"));
        expectCode("custodial_native_binding_state_refused", () -> fixture.engine.completeLocalBinding(OP2));
    }

    @Test
    public void confirmationResponseLossAndRestartReplaySafely() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.loseConfirmAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.confirmEnrollment(OP1));
        assertTrue(fixture.transport.confirmed(OP1));
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());

        Map<String, Object> active = fixture.restart().confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(2, fixture.transport.confirmCalls.get());
    }

    @Test
    public void revokedConfirmationCarriesSafe401AndRemainsQuarantined() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.confirmHttpFailure = 401;
        VaultFailure failure = expectCode("custodial_native_terminal_request_failed", () -> fixture.engine.confirmEnrollment(OP1));
        assertEquals(401, failure.httpStatus);
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());
        expectCode("custodial_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/device-auth/status?device_id=KIOSK_02")
        ));
    }

    @Test
    public void cancellationResponseLossReplaysFromDurableIntent() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.cancelEnrollment(OP1));
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(2, fixture.transport.cancelCalls.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void expiredResponseLossJournalRecoversCredentialThenCancels() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        fixture.clock.now += 16L * 60L * 1000L;

        Map<String, Object> state = fixture.restart().getState();
        assertEquals("CANCELLED", state.get("state"));
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void removalResponseLossAndFinalizeFailureAreRestartSafe() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseRemoveAfterSuccess = 1;
        expectCode("custodial_native_network_unavailable", () -> fixture.engine.removeEnrollment(REMOVE, DEVICE));
        assertEquals("REMOVAL_REQUESTED", fixture.persistence.current().phase.name());
        Map<String, Object> restartState = fixture.restart().getState();
        assertEquals(REMOVE, restartState.get("removal_operation_id"));
        assertEquals(DEVICE, restartState.get("removal_device_id"));
        assertTrue((Boolean) restartState.get("removal_pending"));

        RemovalView removed = fixture.restart().removeEnrollment(REMOVE, DEVICE);
        assertTrue(removed.removed);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        fixture.persistence.failBeforeCommits.add(fixture.persistence.commitAttempts.get() + 1);
        expectCode("test_commit_failure", () -> fixture.restart().finalizeRemoval(REMOVE));
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
        fixture.persistence.writeThenFailCommits.add(fixture.persistence.commitAttempts.get() + 1);
        Map<String, Object> finalState = fixture.restart().finalizeRemoval(REMOVE);
        assertEquals("EMPTY", finalState.get("state"));
        assertTrue((Boolean) finalState.get("removal_finalized"));
        assertTrue((Boolean) finalState.get("removal_remote_complete"));
        assertEquals(REMOVE, finalState.get("removal_operation_id"));
        assertEquals(DEVICE, finalState.get("removal_device_id"));
        assertTrue(fixture.cipher.destroyCalls >= 2);

        int destroysAfterFinalization = fixture.cipher.destroyCalls;
        long revisionAfterFinalization = fixture.persistence.current().revision;
        Map<String, Object> replayed = fixture.restart().finalizeRemoval(REMOVE);
        assertEquals("EMPTY", replayed.get("state"));
        assertEquals(revisionAfterFinalization, fixture.persistence.current().revision);
        assertEquals(destroysAfterFinalization, fixture.cipher.destroyCalls);
        expectCode("custodial_native_removal_not_complete", () -> fixture.restart().finalizeRemoval(OP2));

        EnrollmentView reenrolled = fixture.restart().enroll(OP2, DEVICE, "enrollment", "87654321".toCharArray());
        assertEquals("CREDENTIAL_STAGED", reenrolled.phase.name());
        assertEquals("", fixture.engine.getState().get("removal_operation_id"));
        assertFalse((Boolean) fixture.engine.getState().get("removal_finalized"));
    }

    @Test
    public void nativeRemovalCancellationMakesNoPersistenceOrNetworkChange() throws Exception {
        Fixture fixture = activeFixture();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestRemovalGate gate = new TestRemovalGate(false);
        RemovalCoordinator coordinator = new RemovalCoordinator(fixture.engine, gate);
        expectCode("custodial_native_removal_cancelled", () -> coordinator.remove(REMOVE, DEVICE));
        assertEquals(1, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.removeCalls.get());
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
    }

    @Test
    public void deniedNativeEnrollmentCancellationMakesNoPersistenceOrNetworkChange() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestCancellationGate gate = new TestCancellationGate(false);
        CancellationCoordinator coordinator = new CancellationCoordinator(fixture.engine, gate);

        expectCode("custodial_native_cancellation_cancelled", () -> coordinator.cancel(OP1));

        assertEquals(1, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
        assertEquals("CREDENTIAL_STAGED", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void pendingServerConfirmationCannotBeCancelledAndNeverPrompts() throws Exception {
        Fixture fixture = stagedAndBound();
        int commitsBefore = fixture.persistence.commitAttempts.get();
        TestCancellationGate gate = new TestCancellationGate(true);
        CancellationCoordinator coordinator = new CancellationCoordinator(fixture.engine, gate);

        expectCode("custodial_native_cancellation_refused", () -> coordinator.cancel(OP1));

        assertEquals(0, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void approvedCancellationJournalsConsentAndRestartReplaysWithoutAnotherPrompt() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        TestCancellationGate approved = new TestCancellationGate(true);

        expectCode(
            "custodial_native_network_unavailable",
            () -> new CancellationCoordinator(fixture.engine, approved).cancel(OP1)
        );
        assertEquals(1, approved.calls);
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());

        TestCancellationGate denied = new TestCancellationGate(false);
        Map<String, Object> cancelled = new CancellationCoordinator(fixture.restart(), denied).cancel(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(0, denied.calls);
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));

        Map<String, Object> replayed = new CancellationCoordinator(fixture.restart(), denied).cancel(OP1);
        assertEquals("CANCELLED", replayed.get("state"));
        assertEquals(0, denied.calls);
    }

    @Test
    public void approvedDurableRemovalReplayDoesNotPromptTwice() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseRemoveAfterSuccess = 1;
        TestRemovalGate approved = new TestRemovalGate(true);
        expectCode("custodial_native_network_unavailable", () -> new RemovalCoordinator(fixture.engine, approved).remove(REMOVE, DEVICE));
        assertEquals(1, approved.calls);
        assertEquals("REMOVAL_REQUESTED", fixture.persistence.current().phase.name());

        TestRemovalGate denied = new TestRemovalGate(false);
        RemovalView replay = new RemovalCoordinator(fixture.restart(), denied).remove(REMOVE, DEVICE);
        assertTrue(replay.removed);
        assertEquals(0, denied.calls);
        assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
    }

    @Test
    public void parallelLongPollsDoNotBlockTrafficOrRemovalAndStaleResponsesAreRefused() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.authorizedStarted = new CountDownLatch(3);
        fixture.transport.releaseAuthorized = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<AuthorizedResponse>> requests = new ArrayList<>();
        try {
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/messaging-api/long-poll?device_id=KIOSK_02")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/messaging-api/long-poll?device_id=KIOSK_02")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/schedule-api/my-day-summary?device_id=KIOSK_02")
            )));
            assertTrue(fixture.transport.authorizedStarted.await(2, TimeUnit.SECONDS));
            assertEquals(3, fixture.transport.maximumAuthorizedInFlight.get());

            Future<RemovalView> removal = pool.submit(() -> fixture.engine.removeEnrollment(REMOVE, DEVICE));
            assertTrue(removal.get(2, TimeUnit.SECONDS).removed);
            assertEquals("REMOVAL_TOMBSTONE", fixture.persistence.current().phase.name());
            fixture.transport.releaseAuthorized.countDown();

            for (Future<AuthorizedResponse> pending : requests) {
                try {
                    pending.get(2, TimeUnit.SECONDS);
                    fail("Expected stale native response refusal");
                } catch (ExecutionException error) {
                    assertTrue(error.getCause() instanceof VaultFailure);
                    assertEquals("custodial_native_vault_concurrent_change", ((VaultFailure) error.getCause()).code);
                }
            }
        } finally {
            fixture.transport.releaseAuthorized.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    public void concurrentDuplicateEnrollmentHasOneIssuanceAndConflictsFailClosed() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> firstResult = pool.submit(
                () -> first.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<EnrollmentView> secondResult = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return second.enroll(OP1, DEVICE, "enrollment", code());
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "requestAndStage");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            assertEquals("CREDENTIAL_STAGED", firstResult.get(2, TimeUnit.SECONDS).phase.name());
            assertEquals("CREDENTIAL_STAGED", secondResult.get(2, TimeUnit.SECONDS).phase.name());
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        expectCode("custodial_native_enrollment_conflict", () -> fixture.restart().enroll(OP2, DEVICE, "enrollment", code()));
    }

    @Test
    public void concurrentDuplicateCancellationConvergesOnTerminalState() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.persistence.pauseCommits(3, VaultPhase.CANCEL_REQUESTED, 2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Map<String, Object>> firstResult = pool.submit(() -> {
                start.await();
                return first.cancelEnrollment(OP1);
            });
            Future<Map<String, Object>> secondResult = pool.submit(() -> {
                start.await();
                return second.cancelEnrollment(OP1);
            });
            start.countDown();
            assertTrue(fixture.persistence.awaitPausedCommits(2, TimeUnit.SECONDS));
            fixture.persistence.releasePausedCommits();
            assertEquals("CANCELLED", firstResult.get(2, TimeUnit.SECONDS).get("state"));
            assertEquals("CANCELLED", secondResult.get(2, TimeUnit.SECONDS).get("state"));
        } finally {
            fixture.persistence.releasePausedCommits();
            pool.shutdownNow();
        }
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void concurrentTerminalRejectionCompletesBeforeFollowerCanIssue() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine first = fixture.engine;
        VaultEngine second = fixture.restart();
        fixture.transport.enrollHttpFailure = 400;
        fixture.transport.enrollRemoteReason = "malformed_request";
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> firstResult = pool.submit(
                () -> first.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<EnrollmentView> secondResult = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return second.enroll(OP1, DEVICE, "enrollment", code());
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "requestAndStage");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            try {
                firstResult.get(2, TimeUnit.SECONDS);
                fail("Expected terminal enrollment rejection");
            } catch (ExecutionException error) {
                assertEquals(
                    "custodial_native_enrollment_terminal",
                    ((VaultFailure) error.getCause()).code
                );
            }
            try {
                secondResult.get(2, TimeUnit.SECONDS);
                fail("Expected terminal follower refusal");
            } catch (ExecutionException error) {
                assertEquals(
                    "custodial_native_enrollment_cancelled",
                    ((VaultFailure) error.getCause()).code
                );
            }
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void concurrentCancelUsesStagedCredentialWithoutResubmittingItAsCode() throws Exception {
        Fixture fixture = new Fixture();
        VaultEngine enrolling = fixture.engine;
        VaultEngine cancelling = fixture.restart();
        fixture.transport.enrollStarted = new CountDownLatch(1);
        fixture.transport.releaseEnroll = new CountDownLatch(1);
        AtomicReference<Thread> followerThread = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<EnrollmentView> staged = pool.submit(
                () -> enrolling.enroll(OP1, DEVICE, "enrollment", code())
            );
            assertTrue(fixture.transport.enrollStarted.await(2, TimeUnit.SECONDS));
            fixture.persistence.observeLoads(VaultPhase.ENROLLMENT_DISPATCHED, 1);
            Future<Map<String, Object>> cancelled = pool.submit(() -> {
                followerThread.set(Thread.currentThread());
                return cancelling.cancelEnrollment(OP1);
            });
            assertTrue(fixture.persistence.awaitObservedLoads(2, TimeUnit.SECONDS));
            awaitBlockedAt(followerThread, "recoverCredentialForCancellation");
            assertEquals(1, fixture.transport.enrollCalls.get());
            fixture.transport.releaseEnroll.countDown();
            assertEquals("CREDENTIAL_STAGED", staged.get(2, TimeUnit.SECONDS).phase.name());
            assertEquals("CANCELLED", cancelled.get(2, TimeUnit.SECONDS).get("state"));
        } finally {
            fixture.transport.releaseEnroll.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.enrollCalls.get());
        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void fullLegacyUpgradeSurvivesCleanupCrashAndBecomesActive() throws Exception {
        InstallationBinding binding = new InstallationBinding(
            DEVICE,
            SEAL,
            Instant.ofEpochMilli(NOW).toString(),
            true,
            ""
        );
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), binding, SEAL);
        legacy.failCleanupAfterValues = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("custodial_native_legacy_cleanup_failed", fixture.engine::getState);
        assertEquals("LEGACY_CLEANUP_PENDING", fixture.persistence.current().phase.name());

        Map<String, Object> active = fixture.restart().getState();
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) active.get("installation")).get("device_id"));
        assertFalse((Boolean) active.get("legacy_pending"));
    }

    @Test
    public void credentialOnlyLegacyUpgradeRequiresExactBindingThenAtomicallyActivates() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        Fixture fixture = new Fixture(legacy);
        Map<String, Object> pending = fixture.engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertTrue((Boolean) pending.get("legacy_pending"));
        expectCode("custodial_native_legacy_identity_unverified", () -> fixture.engine.completeLegacyBinding("KIOSK_03"));

        Map<String, Object> active = fixture.restart().completeLegacyBinding(DEVICE);
        assertEquals("ACTIVE", active.get("state"));
        assertFalse((Boolean) active.get("legacy_pending"));
    }

    @Test
    public void changedLegacySourceAfterJournalBlocksWithoutPromoting() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        legacy.failCleanupBefore = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("custodial_native_legacy_cleanup_failed", fixture.engine::getState);
        legacy.replaceCredential("different-device-credential".toCharArray());
        expectCode("custodial_native_legacy_vault_mismatch", fixture.restart()::getState);
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());
        assertTrue((Boolean) fixture.engine.getState().get("blocked"));
    }

    private static Fixture stagedAndBound() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.engine.completeLocalBinding(OP1);
        return fixture;
    }

    private static Fixture activeFixture() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.engine.confirmEnrollment(OP1);
        return fixture;
    }

    private static AuthorizedRequest request(String path) {
        return new AuthorizedRequest(path, "GET", Map.of(), new byte[0]);
    }

    private static char[] code() {
        return "12345678".toCharArray();
    }

    private static VaultFailure expectCode(String code, ThrowingAction action) throws Exception {
        try {
            action.run();
            fail("Expected " + code);
            throw new AssertionError();
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
            return error;
        }
    }

    private static void awaitBlockedAt(
        AtomicReference<Thread> workerReference,
        String methodName
    ) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (System.nanoTime() < deadline) {
            Thread worker = workerReference.get();
            if (worker != null && worker.getState() == Thread.State.BLOCKED) {
                for (StackTraceElement frame : worker.getStackTrace()) {
                    if (
                        frame.getClassName().equals(VaultEngine.class.getName())
                        && frame.getMethodName().equals(methodName)
                    ) return;
                }
            }
            Thread.onSpinWait();
        }
        fail("Worker did not block at VaultEngine." + methodName);
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }

    private static final class Fixture {
        final MemoryPersistence persistence;
        final TestCipher cipher;
        final MutableClock clock;
        final FakeTransport transport;
        final FakeLegacySource legacy;
        final TestSealGenerator seals;
        VaultEngine engine;

        Fixture() throws VaultFailure {
            this(new FakeLegacySource());
        }

        Fixture(FakeLegacySource legacy) throws VaultFailure {
            persistence = new MemoryPersistence();
            cipher = new TestCipher();
            clock = new MutableClock(NOW);
            transport = new FakeTransport(clock);
            this.legacy = legacy;
            seals = new TestSealGenerator();
            engine = restart();
        }

        VaultEngine restart() {
            engine = new VaultEngine(persistence, cipher, transport, legacy, seals, clock);
            return engine;
        }
    }

    private static final class TestRemovalGate implements RemovalAuthorizationGate {
        final boolean decision;
        int calls;

        TestRemovalGate(boolean decision) {
            this.decision = decision;
        }

        @Override
        public boolean confirm(String operationId, String deviceId) {
            calls += 1;
            return decision;
        }
    }

    private static final class TestCancellationGate implements CancellationAuthorizationGate {
        final boolean decision;
        int calls;

        TestCancellationGate(boolean decision) {
            this.decision = decision;
        }

        @Override
        public boolean confirm(String operationId, String deviceId) {
            calls += 1;
            return decision;
        }
    }
}
