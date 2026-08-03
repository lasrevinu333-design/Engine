package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
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
import org.junit.Test;

public final class VaultEngineTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String OP1 = "11111111-1111-4111-8111-111111111111";
    private static final String OP2 = "22222222-2222-4222-8222-222222222222";
    private static final String REMOVE = "33333333-3333-4333-8333-333333333333";
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";
    private static final String SEAL = "installation-seal-0002";

    @Test
    public void fullLifecycleKeepsGenericTransportActiveOnlyAndEndsEmpty() throws Exception {
        Fixture fixture = new Fixture();
        assertEquals("EMPTY", fixture.engine.getState().get("state"));

        EnrollmentView enrolled = fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        assertEquals("CREDENTIAL_STAGED", enrolled.phase.name());
        assertFalse(enrolled.safeData().containsKey("device_credential"));
        expectCode("manager_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/messaging-api/health")
        ));

        Map<String, Object> pending = fixture.engine.completeLocalBinding(OP1);
        assertEquals("PENDING_SERVER_CONFIRMATION", pending.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) pending.get("installation")).get("device_id"));
        assertFalse(pending.containsKey("device_credential"));

        Map<String, Object> active = fixture.engine.confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals("enrollment", active.get("active_enrollment_flow"));
        assertEquals(OP1, ((Map<?, ?>) active.get("installation")).get("enrollment_operation_id"));
        AuthorizedResponse response = fixture.engine.authorizedRequest(DEVICE, request("/messaging-api/health"));
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
    public void statusProbeReadsAndWipesAuthorityAndProjectsOnlyLocalKeyFailureAsReplacement() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.verifyActiveAuthorityReadable();
        assertNotNull(fixture.cipher.lastDecrypted);
        for (char value : fixture.cipher.lastDecrypted) assertEquals(0, value);

        Map<String, Object> active = fixture.engine.getState();
        fixture.cipher.decryptFailureCode = "manager_native_vault_decrypt_failed";
        fixture.cipher.failDecrypts = 1;
        Map<String, Object> projected = new ManagerNativeVaultPlugin(
            fixture.engine, null, null
        ).safeStatus(active);
        assertEquals("BLOCKED", projected.get("state"));
        assertFalse((Boolean) projected.get("active"));
        assertTrue((Boolean) projected.get("blocked"));
        assertEquals("manager_native_replacement_required", projected.get("reason"));
        assertEquals("", projected.get("key_security_level"));
        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
    }

    @Test
    public void activeRecoveryKeepsPriorCredentialUsableUntilExplicitTransition() throws Exception {
        Fixture fixture = activeFixture();
        int enrollCallsBefore = fixture.transport.enrollCalls.get();

        EnrollmentView pending = fixture.engine.enroll(
            OP2,
            DEVICE,
            "recovery",
            code()
        );

        assertEquals("CREDENTIAL_STAGED", pending.phase.name());
        assertEquals(enrollCallsBefore + 1, fixture.transport.enrollCalls.get());
        assertEquals(OP2, fixture.recovery.current.pendingOperationId);
        assertEquals(OP1, fixture.recovery.current.priorActive.operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertTrue((Boolean) fixture.engine.getState().get("active"));
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE,
            request("/messaging-api/health")
        ).status);

        Map<String, Object> restored = new CancellationCoordinator(
            fixture.engine, new TestCancellationGate(true)
        ).cancel(OP2);
        assertEquals("ACTIVE", restored.get("state"));
        assertEquals(OP1, ((Map<?, ?>) restored.get("installation")).get("enrollment_operation_id"));
        assertNull(fixture.recovery.current);
    }

    @Test
    public void missingCurrentRecoveryProofAuthorityRollsBackLocallyAndRequiresExplicitReplacement() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseActiveTransportAuthority(DEVICE);

        expectCode("manager_native_replacement_required", () -> fixture.engine.enroll(
            OP2, DEVICE, "recovery", code()
        ));

        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertNull(fixture.recovery.current);
        assertEquals(1, fixture.transport.issuanceCount.get());
        expectCode("manager_v2_active_keyset_missing", fixture.engine::verifyActiveAuthorityReadable);

        EnrollmentView replacement = fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", replacement.phase.name());
        assertEquals("replacement", replacement.flow);
    }

    @Test
    public void replacementUsesFreshEnrollmentButCancelRestoresPriorAuthority() throws Exception {
        Fixture fixture = activeFixture();
        EnrollmentView pending = fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", pending.phase.name());
        Map<String, Object> state = fixture.engine.getState();
        assertEquals("replacement", state.get("pending_flow"));
        assertTrue((Boolean) state.get("active"));
        assertTrue((Boolean) state.get("credential_present"));
        assertEquals(OP1, fixture.recovery.current.priorActive.operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
        assertEquals(OP1, fixture.transport.lastAuthorizedKeyOperation);

        Map<String, Object> restored = new CancellationCoordinator(
            fixture.engine, new TestCancellationGate(true)
        ).cancel(OP2);
        assertEquals("ACTIVE", restored.get("state"));
        assertEquals(OP1, ((Map<?, ?>) restored.get("installation")).get("enrollment_operation_id"));
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
    }

    @Test
    public void confirmedReplacementAtomicallyPromotesNewAuthority() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        fixture.engine.completeLocalBinding(OP2);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP2);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(OP2, ((Map<?, ?>) active.get("installation")).get("enrollment_operation_id"));
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
        assertEquals(200, fixture.engine.authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
        assertEquals(OP2, fixture.transport.lastAuthorizedKeyOperation);
    }

    @Test
    public void invalidInitialFlowsAreRejectedBeforeAnyMutationOrNativePreflight() throws Exception {
        Fixture fixture = new Fixture();
        long emptyRevision = fixture.persistence.current().revision;
        int emptyEncrypts = fixture.cipher.encryptCalls;
        for (String flow : List.of("recovery", "replacement")) {
            expectCode("manager_native_enrollment_state_refused", () -> fixture.engine.enroll(
                OP1, DEVICE, flow, code()
            ));
        }
        assertEquals(emptyRevision, fixture.persistence.current().revision);
        assertEquals(emptyEncrypts, fixture.cipher.encryptCalls);
        assertEquals(0, fixture.transport.prepareEnrollmentCalls.get());
        assertEquals(0, fixture.transport.enrollCalls.get());

        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.engine.cancelEnrollment(OP1);
        VaultSnapshot cancelled = fixture.persistence.current();
        int cancelledEncrypts = fixture.cipher.encryptCalls;
        int cancelledPreflights = fixture.transport.prepareEnrollmentCalls.get();
        int cancelledEnrolls = fixture.transport.enrollCalls.get();
        for (String flow : List.of("recovery", "replacement")) {
            expectCode("manager_native_enrollment_state_refused", () -> fixture.engine.enroll(
                OP2, DEVICE, flow, code()
            ));
        }
        assertEquals(cancelled, fixture.persistence.current());
        assertEquals(cancelledEncrypts, fixture.cipher.encryptCalls);
        assertEquals(cancelledPreflights, fixture.transport.prepareEnrollmentCalls.get());
        assertEquals(cancelledEnrolls, fixture.transport.enrollCalls.get());
    }

    @Test
    public void failedNativeKeyPreflightLeavesInspectableLocallyCancellableRequest() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.failPrepareEnrollment = 1;

        expectCode("manager_v2_operation_key_missing", () -> fixture.engine.enroll(
            OP1, DEVICE, "enrollment", code()
        ));

        Map<String, Object> requested = fixture.engine.getState();
        assertEquals("ENROLLMENT_REQUESTED", requested.get("state"));
        assertEquals(OP1, requested.get("pending_operation_id"));
        assertEquals(1, fixture.transport.prepareEnrollmentCalls.get());
        assertEquals(0, fixture.transport.enrollCalls.get());
        assertEquals(0, fixture.transport.issuanceCount.get());

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(0, fixture.transport.cancelCalls.get());
    }

    @Test
    public void expiredUndispatchedRequestCancelsLocallyWithoutNetworkAmbiguity() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.failPrepareEnrollment = 1;
        expectCode("manager_v2_operation_key_missing", () -> fixture.engine.enroll(
            OP1, DEVICE, "enrollment", code()
        ));
        fixture.clock.now += 16L * 60L * 1000L;

        Map<String, Object> state = fixture.restart().getState();
        assertEquals("CANCELLED", state.get("state"));
        assertEquals(0, fixture.transport.enrollCalls.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
    }

    @Test
    public void enrollmentResponseLossResumesAfterProcessRestartWithOneCredential() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        VaultEngine restarted = fixture.restart();
        EnrollmentView resumed = restarted.resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", resumed.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
        assertEquals(2, fixture.transport.enrollCalls.get());
    }

    @Test
    public void authoritativeInvalidCodeRetiresOperationAndCorrectedCodeCanStartFresh() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        VaultFailure invalid = expectCode("manager_native_enrollment_terminal", () -> fixture.engine.enroll(
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
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());

        fixture.transport.enrollHttpFailure = 401;
        fixture.transport.enrollRemoteReason = "invalid_enrollment_code";
        expectCode("manager_native_enrollment_failed", () -> fixture.restart().resumeEnrollment(OP1));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        int enrollCalls = fixture.transport.enrollCalls.get();
        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(OP1, cancelled.get("cancelled_operation_id"));
        assertEquals(enrollCalls, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.transport.cancelCalls.get());
    }

    @Test
    public void ambiguousDispatchFollowedByGeneric400RemainsResumable() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(
            OP1,
            DEVICE,
            "enrollment",
            code()
        ));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 400;
        fixture.transport.enrollRemoteReason = "malformed_request";
        VaultFailure rejected = expectCode(
            "manager_native_enrollment_failed",
            () -> fixture.restart().resumeEnrollment(OP1)
        );
        assertEquals(400, rejected.httpStatus);
        assertEquals("malformed_request", rejected.remoteReason);
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));

        fixture.transport.enrollHttpFailure = 0;
        fixture.transport.enrollRemoteReason = "";
        EnrollmentView recovered = fixture.restart().resumeEnrollment(OP1);
        assertEquals("CREDENTIAL_STAGED", recovered.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
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
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
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
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void processDeathAfterNativeBindingExposesExactReconciliationProof() throws Exception {
        Fixture fixture = activeFixture();
        EnrollmentView enrolled = fixture.engine.enroll(OP2, DEVICE, "recovery", code());
        Map<?, ?> nativeInstallation = (Map<?, ?>) enrolled.safeData().get("installation");
        assertNotNull(nativeInstallation);
        fixture.engine.completeLocalBinding(OP2);

        Map<String, Object> recovered = fixture.restart().getState();
        assertEquals("PENDING_SERVER_CONFIRMATION", recovered.get("state"));
        assertEquals(OP2, recovered.get("pending_operation_id"));
        assertEquals(DEVICE, recovered.get("pending_device_id"));
        assertEquals("recovery", recovered.get("pending_flow"));
        assertEquals(nativeInstallation, recovered.get("installation"));
        Map<?, ?> pending = (Map<?, ?>) recovered.get("pending_enrollment");
        assertEquals(OP2, pending.get("operation_id"));
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
        expectCode("manager_native_binding_state_refused", () -> fixture.engine.completeLocalBinding(OP2));
    }

    @Test
    public void confirmationResponseLossAndRestartReplaySafely() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.loseConfirmAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.confirmEnrollment(OP1));
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
        VaultFailure failure = expectCode("manager_native_terminal_request_failed", () -> fixture.engine.confirmEnrollment(OP1));
        assertEquals(401, failure.httpStatus);
        assertEquals("PENDING_SERVER_CONFIRMATION", fixture.persistence.current().phase.name());
        expectCode("manager_native_pending_state_refused", () -> fixture.engine.authorizedRequest(
            DEVICE,
            request("/messaging-api/health")
        ));
    }

    @Test
    public void expiredInitialConfirmationNeverActivatesCredential() throws Exception {
        Fixture fixture = stagedAndBound();
        fixture.transport.confirmExpired = 1;

        expectCode("manager_native_enrollment_expired", () -> fixture.engine.confirmEnrollment(OP1));

        assertEquals("CANCELLED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
        assertFalse(fixture.transport.confirmed(OP1));
        assertEquals("CANCELLED", fixture.restart().getState().get("state"));
    }

    @Test
    public void expiredReplacementConfirmationRestoresPriorAuthorityAcrossRestart() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        fixture.engine.completeLocalBinding(OP2);
        fixture.transport.confirmExpired = 1;

        expectCode("manager_native_enrollment_expired", () -> fixture.engine.confirmEnrollment(OP2));

        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
        assertEquals(200, fixture.restart().authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
        assertEquals(OP1, fixture.transport.lastAuthorizedKeyOperation);
    }

    @Test
    public void expiredRecoveryConfirmationRestoresPriorAuthorityAcrossRestart() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "recovery", code());
        fixture.engine.completeLocalBinding(OP2);
        fixture.transport.confirmExpired = 1;

        expectCode("manager_native_enrollment_expired", () -> fixture.engine.confirmEnrollment(OP2));

        assertEquals("ACTIVE", fixture.persistence.current().phase.name());
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
        assertEquals(200, fixture.restart().authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
    }

    @Test
    public void cancellationResponseLossReplaysFromDurableIntent() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.cancelEnrollment(OP1));
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());
        assertTrue(fixture.transport.cancelled(OP1));

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(2, fixture.transport.cancelCalls.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void stagedCancellationDoesNotRequireCredentialDecryption() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.cipher.failDecrypts = 1;

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);

        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(1, fixture.cipher.failDecrypts);
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void stagedReplacementCancellationSurvivesDestroyedCredentialKey() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        fixture.cipher.failDecrypts = 1;

        Map<String, Object> restored = fixture.restart().cancelEnrollment(OP2);

        assertEquals("ACTIVE", restored.get("state"));
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertEquals(1, fixture.cipher.failDecrypts);
        assertTrue(fixture.transport.cancelled(OP2));
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
    }

    @Test
    public void responseLossCancellationUsesPendingSigningKeyWithoutDecryptOrRedispatch() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        int enrollCalls = fixture.transport.enrollCalls.get();
        fixture.cipher.failDecrypts = 1;

        Map<String, Object> state = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", state.get("state"));
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(enrollCalls, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.cipher.failDecrypts);
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void cancellation404KeepsDurableIntentAndPendingKeyUntilServerCanProveTerminalState() throws Exception {
        Fixture fixture = new Fixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(
            OP1, DEVICE, "enrollment", code()
        ));
        int enrollCalls = fixture.transport.enrollCalls.get();
        fixture.transport.cancelHttpFailure = 404;
        fixture.transport.cancelRemoteReason = "manager_v2_operation_not_found";

        VaultFailure notYetAuthoritative = expectCode(
            "manager_v2_cancel_failed",
            () -> fixture.restart().cancelEnrollment(OP1)
        );

        assertEquals(404, notYetAuthoritative.httpStatus);
        assertEquals("manager_v2_operation_not_found", notYetAuthoritative.remoteReason);
        assertEquals("CANCEL_REQUESTED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.cipher.destroyCalls);
        assertEquals(enrollCalls, fixture.transport.enrollCalls.get());

        fixture.transport.cancelHttpFailure = 0;
        fixture.transport.cancelRemoteReason = "";
        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertTrue(fixture.transport.cancelled(OP1));
        assertEquals(enrollCalls, fixture.transport.enrollCalls.get());
    }

    @Test
    public void replacementResponseLossCancellationPreservesPriorAuthorityWithoutDecryptOrRedispatch() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseEnrollAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.enroll(
            OP2, DEVICE, "replacement", code()
        ));
        assertEquals("ENROLLMENT_DISPATCHED", fixture.persistence.current().phase.name());
        int enrollCalls = fixture.transport.enrollCalls.get();
        fixture.cipher.failDecrypts = 1;

        Map<String, Object> state = fixture.restart().cancelEnrollment(OP2);

        assertEquals("ACTIVE", state.get("state"));
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertTrue(fixture.transport.cancelled(OP2));
        assertEquals(enrollCalls, fixture.transport.enrollCalls.get());
        assertEquals(1, fixture.cipher.failDecrypts);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
    }

    @Test
    public void expiredInitialCancellationIsTerminalAcrossRestart() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.cancelExpired = 1;

        Map<String, Object> cancelled = fixture.restart().cancelEnrollment(OP1);

        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
        assertEquals("CANCELLED", fixture.restart().getState().get("state"));
    }

    @Test
    public void expiredReplacementCancellationRestoresExactlyOnePriorAuthorityAcrossRestart() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "replacement", code());
        fixture.transport.cancelExpired = 1;

        Map<String, Object> restored = fixture.restart().cancelEnrollment(OP2);

        assertEquals("ACTIVE", restored.get("state"));
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
        assertEquals(200, fixture.restart().authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
        assertEquals(OP1, fixture.transport.lastAuthorizedKeyOperation);
    }

    @Test
    public void expiredRecoveryCancellationRestoresExactlyOnePriorAuthorityAcrossRestart() throws Exception {
        Fixture fixture = activeFixture();
        fixture.engine.enroll(OP2, DEVICE, "recovery", code());
        fixture.transport.cancelExpired = 1;

        Map<String, Object> restored = fixture.restart().cancelEnrollment(OP2);

        assertEquals("ACTIVE", restored.get("state"));
        assertEquals(OP1, fixture.persistence.current().operationId);
        assertEquals(1, fixture.transport.activeCredentials(DEVICE));
        assertNull(fixture.recovery.current);
        assertEquals(200, fixture.restart().authorizedRequest(
            DEVICE, request("/messaging-api/health")
        ).status);
        assertEquals(OP1, fixture.transport.lastAuthorizedKeyOperation);
    }

    @Test
    public void removalResponseLossAndFinalizeFailureAreRestartSafe() throws Exception {
        Fixture fixture = activeFixture();
        fixture.transport.loseRemoveAfterSuccess = 1;
        expectCode("manager_native_network_unavailable", () -> fixture.engine.removeEnrollment(REMOVE, DEVICE));
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
        expectCode("manager_native_removal_not_complete", () -> fixture.restart().finalizeRemoval(OP2));

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
        expectCode("manager_native_removal_cancelled", () -> coordinator.remove(REMOVE, DEVICE));
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

        expectCode("manager_native_cancellation_cancelled", () -> coordinator.cancel(OP1));

        assertEquals(1, gate.calls);
        assertEquals(commitsBefore, fixture.persistence.commitAttempts.get());
        assertEquals(0, fixture.transport.cancelCalls.get());
        assertEquals("CREDENTIAL_STAGED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void pendingServerConfirmationCanBeExplicitlyCancelledBeforeActivation() throws Exception {
        Fixture fixture = stagedAndBound();
        TestCancellationGate gate = new TestCancellationGate(true);
        CancellationCoordinator coordinator = new CancellationCoordinator(fixture.engine, gate);

        Map<String, Object> cancelled = coordinator.cancel(OP1);

        assertEquals(1, gate.calls);
        assertEquals(1, fixture.transport.cancelCalls.get());
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
    }

    @Test
    public void approvedCancellationJournalsConsentAndRestartReplaysWithoutAnotherPrompt() throws Exception {
        Fixture fixture = new Fixture();
        fixture.engine.enroll(OP1, DEVICE, "enrollment", code());
        fixture.transport.loseCancelAfterSuccess = 1;
        TestCancellationGate approved = new TestCancellationGate(true);

        expectCode(
            "manager_native_network_unavailable",
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
        expectCode("manager_native_network_unavailable", () -> new RemovalCoordinator(fixture.engine, approved).remove(REMOVE, DEVICE));
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
                request("/messaging-api/threads/updates?device_id=ops-app-11111111-1111-4111-8111-111111111111")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/messaging-api/threads/updates?device_id=ops-app-11111111-1111-4111-8111-111111111111")
            )));
            requests.add(pool.submit(() -> fixture.engine.authorizedRequest(
                DEVICE,
                request("/schedule-api/my-day-summary?device_id=ops-app-11111111-1111-4111-8111-111111111111")
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
                    assertEquals("manager_native_vault_concurrent_change", ((VaultFailure) error.getCause()).code);
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
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<EnrollmentView>> results = new ArrayList<>();
            results.add(pool.submit(() -> { start.await(); return first.enroll(OP1, DEVICE, "enrollment", code()); }));
            results.add(pool.submit(() -> { start.await(); return second.enroll(OP1, DEVICE, "enrollment", code()); }));
            start.countDown();
            for (Future<EnrollmentView> result : results) assertEquals("CREDENTIAL_STAGED", result.get().phase.name());
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, fixture.transport.issuanceCount.get());
        assertEquals(0, fixture.transport.activeCredentials(DEVICE));
        expectCode("manager_native_enrollment_conflict", () -> fixture.restart().enroll(OP2, DEVICE, "enrollment", code()));
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
        expectCode("manager_native_legacy_cleanup_failed", fixture.engine::getState);
        assertEquals("LEGACY_CLEANUP_PENDING", fixture.persistence.current().phase.name());

        Map<String, Object> pending = fixture.restart().getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertTrue((Boolean) pending.get("legacy_pending"));
    }

    @Test
    public void credentialOnlyLegacyUpgradeRequiresExplicitV2ReplacementAndNeverActivatesLegacyAuthority() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        Fixture fixture = new Fixture(legacy);
        Map<String, Object> pending = fixture.engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertTrue((Boolean) pending.get("legacy_pending"));
        assertEquals("", pending.get("pending_device_id"));

        expectCode("manager_native_replacement_required", () -> fixture.restart().enroll(
            OP1, DEVICE, "recovery", code()
        ));
        EnrollmentView staged = fixture.restart().enroll(OP1, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        fixture.engine.completeLocalBinding(OP1);
        Map<String, Object> active = fixture.engine.confirmEnrollment(OP1);
        assertEquals("ACTIVE", active.get("state"));
        assertEquals("", active.get("pending_operation_id"));
        assertFalse((Boolean) active.get("legacy_pending"));
    }

    @Test
    public void fullLegacyUpgradeExposesOnlyDeviceIdentityAndRequiresFreshV2Replacement() throws Exception {
        InstallationBinding binding = new InstallationBinding(
            DEVICE,
            SEAL,
            Instant.ofEpochMilli(NOW).toString(),
            true,
            ""
        );
        Fixture fixture = new Fixture(new FakeLegacySource(
            "legacy-device-credential".toCharArray(), binding, SEAL
        ));
        Map<String, Object> pending = fixture.engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertEquals(DEVICE, pending.get("pending_device_id"));

        expectCode("manager_native_replacement_required", () -> fixture.engine.enroll(
            OP1, DEVICE, "recovery", code()
        ));
        EnrollmentView staged = fixture.engine.enroll(OP1, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        fixture.engine.completeLocalBinding(OP1);
        assertEquals("ACTIVE", fixture.engine.confirmEnrollment(OP1).get("state"));
    }

    @Test
    public void changedLegacySourceAfterJournalBlocksWithoutPromoting() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        legacy.failCleanupBefore = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("manager_native_legacy_cleanup_failed", fixture.engine::getState);
        legacy.replaceCredential("different-device-credential".toCharArray());
        expectCode("manager_native_legacy_vault_mismatch", fixture.restart()::getState);
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());
        assertTrue((Boolean) fixture.engine.getState().get("blocked"));
    }

    @Test
    public void managerApprovedReplacementCanReplaceOnlyLegacyBlockedState() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        legacy.failCleanupBefore = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("manager_native_legacy_cleanup_failed", fixture.engine::getState);
        legacy.replaceCredential("different-device-credential".toCharArray());
        expectCode("manager_native_legacy_vault_mismatch", fixture.restart()::getState);
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());

        expectCode("manager_native_replacement_required", () -> fixture.restart().enroll(
            OP1, DEVICE, "recovery", code()
        ));
        EnrollmentView staged = fixture.restart().enroll(OP1, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        assertTrue(legacy.isClean());
        assertEquals(1, fixture.transport.issuanceCount.get());
        fixture.engine.completeLocalBinding(OP1);
        assertEquals("ACTIVE", fixture.engine.confirmEnrollment(OP1).get("state"));
    }

    @Test
    public void blockedReplacementCleanupAndCommitFailuresNeverDispatchAndRemainRetryable() throws Exception {
        FakeLegacySource legacy = new FakeLegacySource("legacy-device-credential".toCharArray(), null, "legacy-seal-0002");
        legacy.failCleanupBefore = 1;
        Fixture fixture = new Fixture(legacy);
        expectCode("manager_native_legacy_cleanup_failed", fixture.engine::getState);
        legacy.replaceCredential("different-device-credential".toCharArray());
        expectCode("manager_native_legacy_vault_mismatch", fixture.restart()::getState);

        legacy.failCleanupBefore = 1;
        expectCode("manager_native_replacement_required", () -> fixture.restart().enroll(OP1, DEVICE, "recovery", code()));
        legacy.failCleanupBefore = 1;
        expectCode("manager_native_legacy_cleanup_failed", () -> fixture.restart().enroll(OP1, DEVICE, "replacement", code()));
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.enrollCalls.get());
        expectCode("manager_native_vault_blocked", () -> fixture.restart().enroll(OP1, DEVICE, "enrollment", code()));
        assertEquals(0, fixture.transport.enrollCalls.get());

        fixture.persistence.failBeforeCommits.add(fixture.persistence.commitAttempts.get() + 1);
        expectCode("test_commit_failure", () -> fixture.restart().enroll(OP1, DEVICE, "replacement", code()));
        assertEquals("BLOCKED", fixture.persistence.current().phase.name());
        assertEquals(0, fixture.transport.enrollCalls.get());

        EnrollmentView staged = fixture.restart().enroll(OP1, DEVICE, "replacement", code());
        assertEquals("CREDENTIAL_STAGED", staged.phase.name());
        assertEquals(1, fixture.transport.issuanceCount.get());
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
        final MemoryRecoveryJournal recovery;
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
            recovery = new MemoryRecoveryJournal();
            engine = restart();
        }

        VaultEngine restart() {
            engine = new VaultEngine(persistence, cipher, transport, legacy, seals, clock, recovery);
            return engine;
        }
    }

    private static final class MemoryRecoveryJournal implements RecoveryJournal {
        RecoveryRecord current;

        @Override public synchronized RecoveryRecord load() { return current; }

        @Override
        public synchronized void save(RecoveryRecord record) throws VaultFailure {
            if (current == null) {
                current = record;
                return;
            }
            if (!current.pendingOperationId.equals(record.pendingOperationId)
                || !current.priorActive.equals(record.priorActive)) {
                throw new VaultFailure("manager_native_recovery_operation_conflict");
            }
        }

        @Override
        public synchronized void clear(String operationId) throws VaultFailure {
            if (current == null) return;
            if (!current.pendingOperationId.equals(VaultValidation.operationId(operationId))) {
                throw new VaultFailure("manager_native_recovery_operation_conflict");
            }
            current = null;
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
