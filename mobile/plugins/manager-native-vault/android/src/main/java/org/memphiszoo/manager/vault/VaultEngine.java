package org.memphiszoo.manager.vault;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure, package-private authority for every vault transition. It has no Android,
 * Capacitor, JSON, or network implementation dependency.
 */
final class VaultEngine {
    private static final long REQUEST_TTL_MILLIS = 15L * 60L * 1000L;
    private static final long MAX_RESUME_TTL_MILLIS = 30L * 60L * 1000L;

    private final VaultPersistence persistence;
    private final CredentialCipher cipher;
    private final EnrollmentTransport transport;
    private final LegacyVaultSource legacy;
    private final InstallationSealGenerator sealGenerator;
    private final VaultClock clock;
    private final RecoveryJournal recovery;

    VaultEngine(
        VaultPersistence persistence,
        CredentialCipher cipher,
        EnrollmentTransport transport,
        LegacyVaultSource legacy,
        InstallationSealGenerator sealGenerator,
        VaultClock clock
    ) {
        this(persistence, cipher, transport, legacy, sealGenerator, clock, new NoopRecoveryJournal());
    }

    VaultEngine(
        VaultPersistence persistence,
        CredentialCipher cipher,
        EnrollmentTransport transport,
        LegacyVaultSource legacy,
        InstallationSealGenerator sealGenerator,
        VaultClock clock,
        RecoveryJournal recovery
    ) {
        this.persistence = persistence;
        this.cipher = cipher;
        this.transport = transport;
        this.legacy = legacy;
        this.sealGenerator = sealGenerator;
        this.clock = clock;
        this.recovery = recovery;
    }

    synchronized Map<String, Object> getState() throws VaultFailure {
        VaultSnapshot state = persistence.load();
        if (state.phase == VaultPhase.BLOCKED) return publicState(state);
        state = recoverState();
        state = recoverExpiry(state);
        if (state.phase == VaultPhase.ACTIVE && !state.operationId.isEmpty()) {
            transport.activateOperation(state.operationId);
            finalizeRecoveryJournal(state);
        }
        return publicState(state);
    }

    synchronized EnrollmentView enroll(
        String operationId,
        String deviceId,
        String flow,
        char[] enrollmentCode
    ) throws VaultFailure {
        EnrollmentRequest request = new EnrollmentRequest(operationId, deviceId, flow);
        if (enrollmentCode == null || enrollmentCode.length != 8 || !digits(enrollmentCode)) {
            throw new VaultFailure("manager_native_invalid_enrollment");
        }
        VaultSnapshot state = persistence.load();
        if (state.phase != VaultPhase.BLOCKED) state = recoverExpiry(recoverState());
        validateEnrollmentTransition(state, request);
        state = beginEnrollment(state, request, enrollmentCode);
        request = bindRecoveryAuthority(request);
        if (state.phase != VaultPhase.ENROLLMENT_REQUESTED && state.phase != VaultPhase.ENROLLMENT_DISPATCHED) {
            return enrollmentView(state, true);
        }
        return requestAndStage(state, request);
    }

    synchronized EnrollmentView resumeEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverState());
        requireSameOperation(state, requested);
        return switch (state.phase) {
            case ENROLLMENT_REQUESTED, ENROLLMENT_DISPATCHED -> requestAndStage(
                state,
                bindRecoveryAuthority(new EnrollmentRequest(state.operationId, state.deviceId, state.flow))
            );
            case CREDENTIAL_STAGED, PENDING_SERVER_CONFIRMATION, ACTIVE -> enrollmentView(state, true);
            case CANCEL_REQUESTED -> {
                finishCancel(state);
                throw new VaultFailure("manager_native_enrollment_cancelled");
            }
            case CANCELLED -> throw new VaultFailure("manager_native_enrollment_cancelled");
            default -> throw new VaultFailure("manager_native_enrollment_resume_refused");
        };
    }

    synchronized Map<String, Object> completeLocalBinding(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverState());
        if (state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION && state.operationId.equals(requested)) {
            return publicState(state);
        }
        if (state.phase != VaultPhase.CREDENTIAL_STAGED || !state.operationId.equals(requested)) {
            throw new VaultFailure("manager_native_binding_state_refused");
        }
        VaultSnapshot next = state.next(
            VaultPhase.PENDING_SERVER_CONFIRMATION,
            SecretKind.DEVICE_CREDENTIAL,
            state.secret,
            state.operationId,
            state.deviceId,
            state.flow,
            state.expiresAtMillis,
            state.installation,
            state.metadata,
            "",
            "",
            false,
            ""
        );
        return publicState(commit(state, next));
    }

    synchronized Map<String, Object> confirmEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverState());
        if (state.phase == VaultPhase.ACTIVE && state.operationId.equals(requested)) return publicState(state);
        if (state.phase != VaultPhase.PENDING_SERVER_CONFIRMATION || !state.operationId.equals(requested)) {
            throw new VaultFailure("manager_native_confirmation_refused");
        }
        char[] credential = cipher.decrypt(state.secret);
        try {
            TerminalResult result = transport.confirm(state.operationId, state.deviceId, credential);
            if (!result.operationId.equals(state.operationId)) throw invalidResponse();
            if (result.outcome == TerminalOutcome.EXPIRED) {
                VaultSnapshot latest = persistence.load();
                if (!sameRevisionAndPhase(latest, state)) throw concurrent();
                commitCancelledOrRestore(latest);
                throw new VaultFailure("manager_native_enrollment_expired");
            }
            if (result.outcome != TerminalOutcome.CONFIRMED) throw invalidResponse();
        } finally {
            VaultValidation.wipe(credential);
        }
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.ACTIVE && latest.operationId.equals(requested)) return publicState(latest);
        if (!sameRevisionAndPhase(latest, state)) throw concurrent();
        VaultSnapshot next = latest.next(
            VaultPhase.ACTIVE,
            SecretKind.DEVICE_CREDENTIAL,
            latest.secret,
            latest.operationId,
            latest.deviceId,
            latest.flow,
            0,
            latest.installation,
            latest.metadata,
            "",
            "",
            false,
            ""
        );
        VaultSnapshot committed = commit(latest, next);
        transport.activateOperation(committed.operationId);
        finalizeRecoveryJournal(committed);
        return publicState(committed);
    }

    synchronized Map<String, Object> cancelEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverState();
        requireSameOperation(state, requested);
        if (state.phase == VaultPhase.CANCELLED) {
            cleanupCancelledKey(state.operationId);
            return publicState(state);
        }
        if (state.phase == VaultPhase.ACTIVE) throw new VaultFailure("manager_native_removal_required");
        if (state.phase == VaultPhase.ENROLLMENT_REQUESTED) {
            VaultSnapshot terminal = commitCancelledOrRestore(state);
            return publicState(terminal);
        }
        if (state.phase == VaultPhase.ENROLLMENT_DISPATCHED
            || state.phase == VaultPhase.CREDENTIAL_STAGED
            || state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION) {
            state = markCancellationRequested(state);
        }
        if (state.phase != VaultPhase.CANCEL_REQUESTED) {
            throw new VaultFailure("manager_native_cancellation_refused");
        }
        return publicState(finishCancel(state));
    }

    AuthorizedResponse authorizedRequest(
        String expectedDeviceId,
        AuthorizedRequest rawRequest
    ) throws VaultFailure {
        final VaultSnapshot state;
        final VaultSnapshot authority;
        final AuthorizedRequest request;
        final char[] credential;
        synchronized (this) {
            state = recoverExpiry(recoverState());
            RecoveryRecord journal = recovery.load();
            authority = activeAuthority(state, journal);
            if (authority.phase != VaultPhase.ACTIVE || !authority.hasCredential()) {
                throw new VaultFailure("manager_native_pending_state_refused");
            }
            String expected = VaultValidation.deviceId(expectedDeviceId);
            if (!authority.deviceId.equals(expected)) throw new VaultFailure("manager_native_device_binding_mismatch");
            request = RequestPolicy.validate(rawRequest, authority.deviceId);
            VaultSnapshot immediate = persistence.load();
            if (!sameRevisionAndPhase(immediate, state)) throw concurrent();
            credential = cipher.decrypt(authority.secret);
        }
        try {
            AuthorizedResponse response = transport.authorized(
                request, authority.operationId, authority.deviceId, credential
            );
            synchronized (this) {
                VaultSnapshot after = persistence.load();
                if (!sameRevisionAndPhase(after, state)) throw concurrent();
                return response;
            }
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    synchronized String verifyActiveAuthorityReadable() throws VaultFailure {
        VaultSnapshot state = recoverExpiry(recoverState());
        RecoveryRecord journal = recovery.load();
        VaultSnapshot authority = activeAuthority(state, journal);
        if (authority.phase != VaultPhase.ACTIVE || !authority.hasCredential()) {
            throw new VaultFailure("manager_native_pending_state_refused");
        }
        char[] credential = cipher.decrypt(authority.secret);
        try {
            if (credential.length < 16 || credential.length > 4096) {
                throw new VaultFailure("manager_native_credential_missing");
            }
            transport.verifyAuthority(authority.operationId);
            return authority.operationId;
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    synchronized RemovalView removeEnrollment(String operationId, String expectedDeviceId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        String expected = VaultValidation.deviceId(expectedDeviceId);
        VaultSnapshot state = recoverState();
        if (state.phase == VaultPhase.REMOVAL_TOMBSTONE) {
            if (!state.removalOperationId.equals(requested) || !state.deviceId.equals(expected)) throw removalConflict();
            return new RemovalView(state.removalOperationId, state.deviceId, true, true);
        }
        if (state.phase == VaultPhase.ACTIVE) {
            if (!state.deviceId.equals(expected)) throw new VaultFailure("manager_native_device_binding_mismatch");
            VaultSnapshot next = state.next(
                VaultPhase.REMOVAL_REQUESTED,
                SecretKind.DEVICE_CREDENTIAL,
                state.secret,
                state.operationId,
                state.deviceId,
                "",
                0,
                state.installation,
                state.metadata,
                requested,
                "",
                false,
                ""
            );
            state = commit(state, next);
        } else if (
            state.phase != VaultPhase.REMOVAL_REQUESTED
            || !state.removalOperationId.equals(requested)
            || !state.deviceId.equals(expected)
        ) {
            throw removalConflict();
        }
        char[] credential = cipher.decrypt(state.secret);
        TerminalResult result;
        try {
            result = transport.remove(state.operationId, state.removalOperationId, state.deviceId, credential);
        } finally {
            VaultValidation.wipe(credential);
        }
        if (!result.operationId.equals(state.removalOperationId)) throw invalidResponse();
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.REMOVAL_TOMBSTONE && latest.removalOperationId.equals(requested)) {
            return new RemovalView(requested, expected, true, true);
        }
        if (!sameRevisionAndPhase(latest, state)) throw concurrent();
        VaultSnapshot tombstone = latest.next(
            VaultPhase.REMOVAL_TOMBSTONE,
            SecretKind.NONE,
            null,
            latest.operationId,
            latest.deviceId,
            "",
            0,
            null,
            EnrollmentMetadata.empty(),
            latest.removalOperationId,
            "",
            false,
            ""
        );
        commit(latest, tombstone);
        return new RemovalView(requested, expected, true, result.replayed);
    }

    synchronized Map<String, Object> finalizeRemoval(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverState();
        if (state.phase == VaultPhase.EMPTY) {
            if (!state.removalOperationId.equals(requested)) {
                throw new VaultFailure("manager_native_removal_not_complete");
            }
            return publicState(state);
        }
        if (state.phase != VaultPhase.REMOVAL_TOMBSTONE || !state.removalOperationId.equals(requested)) {
            throw new VaultFailure("manager_native_removal_not_complete");
        }
        cipher.destroyKey();
        transport.cleanupOperation(state.operationId);
        VaultSnapshot empty = state.next(
            VaultPhase.EMPTY,
            SecretKind.NONE,
            null,
            "",
            state.deviceId,
            "",
            0,
            null,
            EnrollmentMetadata.empty(),
            state.removalOperationId,
            "",
            false,
            ""
        );
        try {
            return publicState(commit(state, empty));
        } catch (VaultFailure error) {
            // The key was intentionally destroyed before the final tombstone
            // transition. A persistence adapter that can prove the exact EMPTY
            // snapshot may complete idempotently; uncertain Android commits
            // poison load() and therefore cannot enter this branch.
            try {
                VaultSnapshot actual = persistence.load();
                if (actual.equals(empty)) return publicState(actual);
            } catch (VaultFailure ignored) {
                // Preserve the exact commit failure when readback is uncertain.
            }
            throw error;
        }
    }

    private VaultSnapshot beginEnrollment(
        VaultSnapshot state,
        EnrollmentRequest request,
        char[] code
    ) throws VaultFailure {
        if (state.pendingEnrollment()) {
            requireSameEnrollment(state, request);
            if (state.phase == VaultPhase.ENROLLMENT_REQUESTED || state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
                char[] storedCode = cipher.decrypt(state.secret);
                try {
                    if (!VaultValidation.sameSecret(storedCode, code)) {
                        throw new VaultFailure("manager_native_enrollment_conflict");
                    }
                } finally {
                    VaultValidation.wipe(storedCode);
                }
            }
            return state;
        }
        if (state.phase == VaultPhase.ACTIVE) {
            if (!(request.flow.equals("recovery") || request.flow.equals("replacement"))
                || !state.deviceId.equals(request.deviceId)) {
                throw new VaultFailure("manager_native_enrollment_conflict");
            }
            recovery.save(new RecoveryRecord(request.operationId, state));
        } else if (state.phase == VaultPhase.LEGACY_PENDING) {
            if (request.flow.equals("recovery")) {
                throw new VaultFailure("manager_native_replacement_required");
            }
            if (!request.flow.equals("replacement")
                || (!state.deviceId.isEmpty() && !state.deviceId.equals(request.deviceId))) {
                throw new VaultFailure("manager_native_enrollment_conflict");
            }
        } else if (state.phase == VaultPhase.BLOCKED) {
            prepareBlockedLegacyRecovery(state, request);
        } else if (!(state.phase == VaultPhase.EMPTY || state.phase == VaultPhase.CANCELLED)) {
            throw new VaultFailure("manager_native_enrollment_state_refused");
        }
        if (state.phase == VaultPhase.CANCELLED) cleanupCancelledKey(state.operationId);
        EncryptedSecret encryptedCode = cipher.encrypt(code);
        VaultSnapshot requested = state.next(
            VaultPhase.ENROLLMENT_REQUESTED,
            SecretKind.ENROLLMENT_CODE,
            encryptedCode,
            request.operationId,
            request.deviceId,
            request.flow,
            clock.nowMillis() + REQUEST_TTL_MILLIS,
            null,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
        try {
            return commit(state, requested);
        } catch (VaultFailure error) {
            final VaultSnapshot current;
            try {
                current = persistence.load();
            } catch (VaultFailure ignored) {
                // Commit uncertainty poisons this process. Keep any recovery
                // journal intact so the reopened disk snapshot can reconcile.
                throw error;
            }
            if (current.pendingEnrollment()) {
                requireSameEnrollment(current, request);
                return current;
            }
            RecoveryRecord journal = recovery.load();
            if (state.phase == VaultPhase.ACTIVE && journal != null
                && journal.pendingOperationId.equals(request.operationId)) {
                recovery.clear(request.operationId);
            }
            throw error;
        }
    }

    private void validateEnrollmentTransition(
        VaultSnapshot state,
        EnrollmentRequest request
    ) throws VaultFailure {
        if (state.pendingEnrollment()) {
            requireSameEnrollment(state, request);
            return;
        }
        if (state.phase == VaultPhase.ACTIVE) {
            if (!(request.flow.equals("recovery") || request.flow.equals("replacement"))
                || !state.deviceId.equals(request.deviceId)) {
                throw new VaultFailure("manager_native_enrollment_conflict");
            }
            return;
        }
        if (state.phase == VaultPhase.LEGACY_PENDING) {
            if (request.flow.equals("recovery")) {
                throw new VaultFailure("manager_native_replacement_required");
            }
            if (!request.flow.equals("replacement")
                || (!state.deviceId.isEmpty() && !state.deviceId.equals(request.deviceId))) {
                throw new VaultFailure("manager_native_enrollment_conflict");
            }
            return;
        }
        if (state.phase == VaultPhase.BLOCKED) {
            boolean legacyOnlyBlock = state.blockedReason.equals("legacy_vault_invalid")
                || state.blockedReason.equals("legacy_vault_mismatch");
            if (request.flow.equals("recovery") && legacyOnlyBlock) {
                throw new VaultFailure("manager_native_replacement_required");
            }
            if (!request.flow.equals("replacement")
                || !legacyOnlyBlock
                || !state.operationId.isEmpty()
                || !state.removalOperationId.isEmpty()
                || recovery.load() != null) {
                throw new VaultFailure("manager_native_vault_blocked");
            }
            return;
        }
        if (state.phase == VaultPhase.EMPTY || state.phase == VaultPhase.CANCELLED) {
            if (!request.flow.equals("enrollment")) {
                throw new VaultFailure("manager_native_enrollment_state_refused");
            }
            return;
        }
        throw new VaultFailure("manager_native_enrollment_state_refused");
    }

    private void prepareBlockedLegacyRecovery(
        VaultSnapshot state,
        EnrollmentRequest request
    ) throws VaultFailure {
        boolean legacyOnlyBlock = state.blockedReason.equals("legacy_vault_invalid")
            || state.blockedReason.equals("legacy_vault_mismatch");
        if (request.flow.equals("recovery") && legacyOnlyBlock) {
            throw new VaultFailure("manager_native_replacement_required");
        }
        if (!request.flow.equals("replacement")
            || !legacyOnlyBlock
            || !state.operationId.isEmpty()
            || !state.removalOperationId.isEmpty()
            || recovery.load() != null) {
            throw new VaultFailure("manager_native_vault_blocked");
        }
        // A new manager-issued replacement code is the only authority allowed
        // to leave these legacy-only blocked states. Remove and verify the retired
        // source before a v2 operation can be persisted or dispatched; a
        // cleanup/commit failure leaves the durable BLOCKED record retryable.
        legacy.cleanup();
        if (!legacy.isClean()) throw new VaultFailure("manager_native_legacy_cleanup_failed");
    }

    private DispatchTransition markEnrollmentDispatched(VaultSnapshot state) throws VaultFailure {
        if (state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
            return new DispatchTransition(state, true);
        }
        if (state.phase != VaultPhase.ENROLLMENT_REQUESTED) {
            throw new VaultFailure("manager_native_enrollment_state_refused");
        }
        VaultSnapshot dispatched = state.next(
            VaultPhase.ENROLLMENT_DISPATCHED,
            SecretKind.ENROLLMENT_CODE,
            state.secret,
            state.operationId,
            state.deviceId,
            state.flow,
            state.expiresAtMillis,
            null,
            state.metadata,
            "",
            "",
            false,
            ""
        );
        try {
            return new DispatchTransition(commit(state, dispatched), false);
        } catch (VaultFailure error) {
            try {
                VaultSnapshot actual = persistence.load();
                if (actual.phase == VaultPhase.ENROLLMENT_DISPATCHED
                    && actual.operationId.equals(state.operationId)
                    && actual.deviceId.equals(state.deviceId)
                    && actual.flow.equals(state.flow)) {
                    // A peer engine won this durable revision and may already
                    // have consumed the one-time code.
                    return new DispatchTransition(actual, true);
                }
            } catch (VaultFailure ignored) {
                // Preserve commit uncertainty; only a process restart may read it.
            }
            throw error;
        }
    }

    private VaultSnapshot localTerminalNoCredential(VaultSnapshot state) throws VaultFailure {
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.CANCELLED && latest.operationId.equals(state.operationId)) return latest;
        if (!sameRevisionAndPhase(latest, state)) throw concurrent();
        return commitCancelledOrRestore(latest);
    }

    private static boolean authoritativeNoCredential(VaultFailure failure, boolean priorAmbiguity) {
        // A generic 400 can prove that a first request was rejected before
        // issuance, but it cannot prove that an earlier dispatched request did
        // not already consume the code and create a credential.
        if (failure.httpStatus == 400) return !priorAmbiguity;
        if (
            failure.httpStatus == 401
            && !priorAmbiguity
            && (failure.remoteReason.equals("invalid_enrollment_code") || failure.remoteReason.equals("device_not_eligible"))
        ) return true;
        return failure.httpStatus == 409 && (
            failure.remoteReason.equals("operation_cancelled")
            || failure.remoteReason.equals("operation_expired")
            || failure.remoteReason.equals("credential_unavailable")
        );
    }

    private EnrollmentView requestAndStage(VaultSnapshot requested, EnrollmentRequest request) throws VaultFailure {
        if (requested.phase != VaultPhase.ENROLLMENT_REQUESTED && requested.phase != VaultPhase.ENROLLMENT_DISPATCHED) {
            return enrollmentView(requested, true);
        }
        boolean priorAmbiguity = requested.phase == VaultPhase.ENROLLMENT_DISPATCHED;
        if (!priorAmbiguity) transport.prepareEnrollment(request);
        DispatchTransition dispatch = markEnrollmentDispatched(requested);
        priorAmbiguity = priorAmbiguity || dispatch.priorNetworkAmbiguity;
        VaultSnapshot dispatched = dispatch.snapshot;
        char[] code = cipher.decrypt(dispatched.secret);
        EnrollmentResult received;
        try {
            received = transport.enroll(request, code);
        } catch (VaultFailure remoteFailure) {
            if (request.flow.equals("recovery")
                && remoteFailure.code.equals("manager_native_replacement_required")) {
                RecoveryRecord journal = recovery.load();
                if (journal == null || !journal.pendingOperationId.equals(dispatched.operationId)) {
                    throw new VaultFailure("manager_native_recovery_journal_corrupt", remoteFailure);
                }
                restorePriorActive(dispatched, journal);
                throw remoteFailure;
            }
            if (authoritativeNoCredential(remoteFailure, priorAmbiguity)) {
                localTerminalNoCredential(dispatched);
                throw new VaultFailure(
                    "manager_native_enrollment_terminal",
                    remoteFailure.httpStatus,
                    remoteFailure.remoteReason,
                    remoteFailure
                );
            }
            throw remoteFailure;
        }
        try (EnrollmentResult result = received) {
            validateEnrollmentResult(request, result);
            VaultSnapshot staged = null;
            try {
                EncryptedSecret credential = cipher.encrypt(result.credential);
                long fallback = Math.min(dispatched.expiresAtMillis, clock.nowMillis() + MAX_RESUME_TTL_MILLIS);
                long expiresAt = result.metadata.resumeExpiryMillis(fallback);
                if (expiresAt <= clock.nowMillis() || expiresAt > clock.nowMillis() + MAX_RESUME_TTL_MILLIS) {
                    throw invalidResponse();
                }
                InstallationBinding binding = new InstallationBinding(
                    request.deviceId,
                    sealGenerator.newSeal(),
                    normalizedTimestamp(null),
                    false,
                    request.operationId
                );
                VaultSnapshot latest = persistence.load();
                if (latest.phase == VaultPhase.CREDENTIAL_STAGED && latest.operationId.equals(request.operationId)) {
                    return enrollmentView(latest, true);
                }
                if (!sameRevisionAndPhase(latest, dispatched)) throw concurrent();
                staged = latest.next(
                    VaultPhase.CREDENTIAL_STAGED,
                    SecretKind.DEVICE_CREDENTIAL,
                    credential,
                    request.operationId,
                    request.deviceId,
                    request.flow,
                    expiresAt,
                    binding,
                    result.metadata,
                    "",
                    "",
                    false,
                    ""
                );
                VaultSnapshot committed = commit(latest, staged);
                return enrollmentView(committed, result.replayed);
            } catch (VaultFailure commitError) {
                compensateFailedCredentialStage(dispatched, staged, result);
                try {
                    VaultSnapshot recovered = persistence.load();
                    if (recovered.phase == VaultPhase.CREDENTIAL_STAGED && recovered.operationId.equals(request.operationId)) {
                        return enrollmentView(recovered, true);
                    }
                } catch (VaultFailure ignored) {}
                throw commitError;
            }
        } finally {
            VaultValidation.wipe(code);
        }
    }

    private void compensateFailedCredentialStage(
        VaultSnapshot requested,
        VaultSnapshot staged,
        EnrollmentResult result
    ) throws VaultFailure {
        VaultSnapshot current;
        try {
            current = persistence.load();
            if (
                (staged != null && current.equals(staged))
                || (current.phase == VaultPhase.CREDENTIAL_STAGED && current.operationId.equals(requested.operationId))
            ) {
                return;
            }
        } catch (VaultFailure ignored) {
            current = requested;
        }
        boolean cancellationJournaled = current.phase == VaultPhase.CANCEL_REQUESTED;
        try {
            EncryptedSecret encrypted = cipher.encrypt(result.credential);
            if (sameRevisionAndPhase(current, requested)) {
                VaultSnapshot cancelling = current.next(
                    VaultPhase.CANCEL_REQUESTED,
                    SecretKind.DEVICE_CREDENTIAL,
                    encrypted,
                    current.operationId,
                    current.deviceId,
                    current.flow,
                    current.expiresAtMillis,
                    null,
                    result.metadata,
                    "",
                    "",
                    false,
                    ""
                );
                try {
                    current = commit(current, cancelling);
                    cancellationJournaled = true;
                } catch (VaultFailure ignored) {
                    // The durable ENROLLMENT_REQUESTED journal still contains
                    // the exact encrypted code and operation for restart.
                }
            }
        } catch (VaultFailure ignored) {
            // The enrollment request journal remains resumable.
        }
        // Never make an external terminal change without first recording the
        // credential and cancellation intent. If local persistence is still
        // failing, the server's idempotent result remains resumable on restart.
        if (!cancellationJournaled) return;
        try {
            TerminalResult cancelled = transport.cancel(requested.operationId, requested.deviceId);
            if (!cancelled.operationId.equals(requested.operationId)
                || (cancelled.outcome != TerminalOutcome.CANCELLED && cancelled.outcome != TerminalOutcome.EXPIRED)) {
                throw invalidResponse();
            }
            VaultSnapshot durable = persistence.load();
            if (durable.operationId.equals(requested.operationId) && durable.phase != VaultPhase.CANCELLED) {
                commitCancelledOrRestore(durable);
            }
        } catch (VaultFailure ignored) {
            // CANCEL_REQUESTED or ENROLLMENT_REQUESTED remains replayable.
        }
    }

    private VaultSnapshot markCancellationRequested(VaultSnapshot state) throws VaultFailure {
        if (state.phase == VaultPhase.CANCEL_REQUESTED) return state;
        if (state.phase != VaultPhase.ENROLLMENT_DISPATCHED
            && state.phase != VaultPhase.CREDENTIAL_STAGED
            && state.phase != VaultPhase.PENDING_SERVER_CONFIRMATION) {
            throw new VaultFailure("manager_native_cancellation_refused");
        }
        // Cancellation is authorized by the pending hardware signing key. Keep
        // whichever encrypted local secret is already durable, but never decrypt
        // or replay a one-time enrollment code merely to cancel a possibly issued
        // server operation after response loss.
        VaultSnapshot cancelling = state.next(
            VaultPhase.CANCEL_REQUESTED,
            state.secretKind,
            state.secret,
            state.operationId,
            state.deviceId,
            state.flow,
            state.expiresAtMillis,
            state.installation,
            state.metadata,
            "",
            "",
            false,
            ""
        );
        return commit(state, cancelling);
    }

    private VaultSnapshot finishCancel(VaultSnapshot cancelling) throws VaultFailure {
        TerminalResult result = transport.cancel(cancelling.operationId, cancelling.deviceId);
        if (!result.operationId.equals(cancelling.operationId)
            || (result.outcome != TerminalOutcome.CANCELLED && result.outcome != TerminalOutcome.EXPIRED)) {
            throw invalidResponse();
        }
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.CANCELLED && latest.operationId.equals(cancelling.operationId)) return latest;
        if (!sameRevisionAndPhase(latest, cancelling)) throw concurrent();
        return commitCancelledOrRestore(latest);
    }

    private VaultSnapshot recoverLegacy() throws VaultFailure {
        VaultSnapshot state = persistence.load();
        if (state.phase == VaultPhase.BLOCKED) throw new VaultFailure("manager_native_vault_blocked");
        if (state.phase == VaultPhase.LEGACY_CLEANUP_PENDING) return finishLegacyCleanup(state);
        if (state.phase != VaultPhase.EMPTY) return state;

        LegacyMaterial material;
        try {
            material = legacy.read();
        } catch (VaultFailure error) {
            block(state, "legacy_vault_invalid");
            throw error;
        }
        if (material == null) return state;
        try (material) {
            EncryptedSecret encrypted = cipher.encrypt(material.credential);
            VaultSnapshot pending = state.next(
                VaultPhase.LEGACY_CLEANUP_PENDING,
                SecretKind.DEVICE_CREDENTIAL,
                encrypted,
                material.binding == null ? "" : material.binding.enrollmentOperationId,
                material.binding == null ? "" : material.binding.deviceId,
                "",
                0,
                material.binding,
                EnrollmentMetadata.empty(),
                "",
                "",
                material.binding != null,
                material.legacySeal
            );
            state = commit(state, pending);
        }
        return finishLegacyCleanup(state);
    }

    private VaultSnapshot finishLegacyCleanup(VaultSnapshot pending) throws VaultFailure {
        LegacyMaterial current = legacy.read();
        if (current != null) {
            try (current) {
                char[] protectedCredential = cipher.decrypt(pending.secret);
                try {
                    boolean bindingMatches = pending.installation == null
                        ? current.binding == null
                        : pending.installation.sameBinding(current.binding);
                    if (!VaultValidation.sameSecret(protectedCredential, current.credential) || !bindingMatches) {
                        block(pending, "legacy_vault_mismatch");
                        throw new VaultFailure("manager_native_legacy_vault_mismatch");
                    }
                } finally {
                    VaultValidation.wipe(protectedCredential);
                }
            }
        }
        legacy.cleanup();
        if (!legacy.isClean()) throw new VaultFailure("manager_native_legacy_cleanup_failed");
        VaultSnapshot latest = persistence.load();
        if (latest.phase != VaultPhase.LEGACY_CLEANUP_PENDING) return latest;
        VaultSnapshot completed = latest.next(
            VaultPhase.LEGACY_PENDING,
            SecretKind.DEVICE_CREDENTIAL,
            latest.secret,
            "",
            latest.legacyHadBinding ? latest.deviceId : "",
            "",
            0,
            latest.legacyHadBinding ? latest.installation : null,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            latest.legacyHadBinding ? "" : latest.legacySeal
        );
        return commit(latest, completed);
    }

    private VaultSnapshot recoverExpiry(VaultSnapshot state) throws VaultFailure {
        if (!state.pendingEnrollment() || state.expiresAtMillis <= 0 || state.expiresAtMillis > clock.nowMillis()) return state;
        if (state.phase == VaultPhase.ENROLLMENT_REQUESTED) {
            // No network request can have happened before the durable dispatched
            // marker. Expiry is therefore a local-only terminal transition.
            return commitCancelledOrRestore(state);
        }
        if (state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
            // A response may have been lost after issuance. The pending hardware
            // signing key can cancel that exact operation without decrypting or
            // re-consuming the one-time code.
            state = markCancellationRequested(state);
        }
        if (state.phase != VaultPhase.CANCEL_REQUESTED) {
            state = markCancellationRequested(state);
        }
        return finishCancel(state);
    }

    private VaultSnapshot commit(VaultSnapshot expected, VaultSnapshot next) throws VaultFailure {
        persistence.commit(expected.revision, next);
        return next;
    }

    private void block(VaultSnapshot state, String reason) throws VaultFailure {
        commit(state, state.blocked(reason));
    }

    private VaultSnapshot recoverState() throws VaultFailure {
        VaultSnapshot state = recoverLegacy();
        RecoveryRecord journal = recovery.load();
        if (journal == null) return state;
        if (state.pendingEnrollment() && state.operationId.equals(journal.pendingOperationId)) return state;
        if (state.phase == VaultPhase.ACTIVE && state.operationId.equals(journal.priorActive.operationId)) {
            transport.cleanupOperation(journal.pendingOperationId);
            recovery.clear(journal.pendingOperationId);
            return state;
        }
        if (state.phase == VaultPhase.ACTIVE && state.operationId.equals(journal.pendingOperationId)) return state;
        if (state.phase == VaultPhase.CANCELLED && state.operationId.equals(journal.pendingOperationId)) {
            return restorePriorActive(state, journal);
        }
        throw new VaultFailure("manager_native_recovery_journal_corrupt");
    }

    private void finalizeRecoveryJournal(VaultSnapshot active) throws VaultFailure {
        RecoveryRecord journal = recovery.load();
        if (journal == null) return;
        if (active.phase != VaultPhase.ACTIVE || !active.operationId.equals(journal.pendingOperationId)) {
            throw new VaultFailure("manager_native_recovery_journal_corrupt");
        }
        recovery.clear(journal.pendingOperationId);
    }

    private VaultSnapshot commitCancelledOrRestore(VaultSnapshot latest) throws VaultFailure {
        RecoveryRecord journal = recovery.load();
        if (journal != null && journal.pendingOperationId.equals(latest.operationId)) {
            VaultSnapshot restored = restoreAtRevision(journal.priorActive, latest.revision + 1);
            VaultSnapshot committed = commit(latest, restored);
            transport.cleanupOperation(journal.pendingOperationId);
            recovery.clear(journal.pendingOperationId);
            return committed;
        }
        VaultSnapshot cancelled = latest.next(
            VaultPhase.CANCELLED,
            SecretKind.NONE,
            null,
            latest.operationId,
            latest.deviceId,
            latest.flow,
            0,
            null,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
        VaultSnapshot committed = commit(latest, cancelled);
        cleanupCancelledKey(committed.operationId);
        return committed;
    }

    private VaultSnapshot restorePriorActive(VaultSnapshot state, RecoveryRecord journal) throws VaultFailure {
        VaultSnapshot restored = restoreAtRevision(journal.priorActive, state.revision + 1);
        VaultSnapshot committed = commit(state, restored);
        transport.cleanupOperation(journal.pendingOperationId);
        recovery.clear(journal.pendingOperationId);
        return committed;
    }

    private static VaultSnapshot restoreAtRevision(VaultSnapshot prior, long revision) throws VaultFailure {
        return new VaultSnapshot(
            revision,
            prior.phase,
            prior.secretKind,
            prior.secret,
            prior.operationId,
            prior.deviceId,
            prior.flow,
            prior.expiresAtMillis,
            prior.installation,
            prior.metadata,
            prior.removalOperationId,
            prior.blockedReason,
            prior.legacyHadBinding,
            prior.legacySeal
        );
    }

    private void cleanupCancelledKey(String operationId) throws VaultFailure {
        cipher.destroyKey();
        transport.cleanupOperation(operationId);
    }

    private EnrollmentRequest bindRecoveryAuthority(EnrollmentRequest request) throws VaultFailure {
        if (!request.flow.equals("recovery")) return request;
        RecoveryRecord journal = recovery.load();
        if (journal == null || !journal.pendingOperationId.equals(request.operationId)) {
            throw new VaultFailure("manager_native_replacement_required");
        }
        return new EnrollmentRequest(
            request.operationId,
            request.deviceId,
            request.flow,
            journal.priorActive.operationId
        );
    }

    private EnrollmentView enrollmentView(VaultSnapshot state, boolean replayed) throws VaultFailure {
        if (!SetLike.enrollmentResultPhase(state.phase)) {
            throw new VaultFailure("manager_native_enrollment_state_refused");
        }
        return new EnrollmentView(
            state.operationId,
            state.deviceId,
            state.flow,
            state.metadata,
            state.installation,
            replayed,
            state.phase
        );
    }

    private Map<String, Object> publicState(VaultSnapshot state) throws VaultFailure {
        Map<String, Object> result = new LinkedHashMap<>();
        RecoveryRecord recoveryAuthority = recovery.load();
        VaultSnapshot authority = activeAuthority(state, recoveryAuthority);
        boolean authorityActive = authority.phase == VaultPhase.ACTIVE && authority.hasCredential();
        result.put("schema_version", VaultSnapshot.SCHEMA_VERSION);
        result.put("state", state.phase.name());
        result.put("revision", state.revision);
        result.put("active", authorityActive);
        result.put("blocked", state.phase == VaultPhase.BLOCKED);
        result.put("reason", state.blockedReason);
        result.put("credential_present", authorityActive);
        result.put("legacy_pending", state.phase == VaultPhase.LEGACY_PENDING);
        result.put("legacy_seal", state.phase == VaultPhase.LEGACY_PENDING ? state.legacySeal : "");
        result.put("pending_operation_id", state.pendingEnrollment() ? state.operationId : "");
        // A full legacy record may contribute only its non-secret device identity.
        // It never becomes v2 authority: the app must complete a manager-approved
        // recovery operation that creates fresh hardware keys and a v2 credential.
        result.put(
            "pending_device_id",
            state.pendingEnrollment() || state.phase == VaultPhase.LEGACY_PENDING ? state.deviceId : ""
        );
        result.put("pending_flow", state.pendingEnrollment() ? state.flow : "");
        result.put("pending_server_confirmation", state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION);
        result.put("active_enrollment_flow", state.phase == VaultPhase.ACTIVE ? state.flow : "");
        boolean enrollmentTerminal = state.phase == VaultPhase.CANCELLED;
        result.put("enrollment_terminal", enrollmentTerminal);
        result.put("cancelled_operation_id", enrollmentTerminal ? state.operationId : "");
        result.put("cancelled_device_id", enrollmentTerminal ? state.deviceId : "");
        if (enrollmentTerminal) {
            result.put("cancelled_enrollment", VaultCollections.mapOf(
                "operation_id", state.operationId,
                "device_id", state.deviceId,
                "flow", state.flow,
                "status", "cancelled"
            ));
        }
        result.put("removal_operation_id", state.removalOperationId);
        boolean removalPending = state.phase == VaultPhase.REMOVAL_REQUESTED || state.phase == VaultPhase.REMOVAL_TOMBSTONE;
        boolean removalFinalized = state.phase == VaultPhase.EMPTY && !state.removalOperationId.isEmpty();
        result.put("removal_pending", removalPending);
        result.put("removal_finalized", removalFinalized);
        result.put("removal_device_id", removalPending || removalFinalized ? state.deviceId : "");
        result.put("removal_remote_complete", state.phase == VaultPhase.REMOVAL_TOMBSTONE || removalFinalized);
        if (removalPending || removalFinalized) {
            Map<String, Object> removal = new LinkedHashMap<>();
            removal.put("operation_id", state.removalOperationId);
            removal.put("device_id", state.deviceId);
            removal.put("remote_complete", state.phase == VaultPhase.REMOVAL_TOMBSTONE || removalFinalized);
            removal.put("finalized", removalFinalized);
            result.put("removal", VaultCollections.copyMap(removal));
        }
        if (state.pendingEnrollment()) {
            result.put("pending_enrollment", state.metadata.safeStateRecord(state.operationId, state.flow, state.deviceId));
        }
        if (
            state.installation != null
            && (
                state.phase == VaultPhase.CREDENTIAL_STAGED
                || state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION
                || state.phase == VaultPhase.ACTIVE
                || state.phase == VaultPhase.REMOVAL_REQUESTED
            )
        ) {
            result.put("installation", state.installation.safeRecord());
        }
        return VaultCollections.copyMap(result);
    }

    private static VaultSnapshot activeAuthority(
        VaultSnapshot state,
        RecoveryRecord journal
    ) {
        boolean pendingAuthorityTransition = state.pendingEnrollment()
            && (state.flow.equals("recovery") || state.flow.equals("replacement"));
        return pendingAuthorityTransition
                && journal != null
                && journal.pendingOperationId.equals(state.operationId)
            ? journal.priorActive
            : state;
    }

    private static void validateEnrollmentResult(EnrollmentRequest request, EnrollmentResult result) throws VaultFailure {
        if (
            !request.operationId.equals(result.operationId)
            || !request.deviceId.equals(result.deviceId)
            || !request.flow.equals(result.flow)
        ) throw invalidResponse();
    }

    private static void requireSameEnrollment(VaultSnapshot state, EnrollmentRequest request) throws VaultFailure {
        if (
            !state.operationId.equals(request.operationId)
            || !state.deviceId.equals(request.deviceId)
            || !state.flow.equals(request.flow)
        ) throw new VaultFailure("manager_native_enrollment_conflict");
    }

    private static void requireSameOperation(VaultSnapshot state, String operationId) throws VaultFailure {
        if (!state.operationId.equals(operationId)) throw new VaultFailure("manager_native_enrollment_conflict");
    }

    private static boolean sameRevisionAndPhase(VaultSnapshot first, VaultSnapshot second) {
        return first.revision == second.revision && first.phase == second.phase;
    }

    private static boolean digits(char[] value) {
        for (char character : value) if (character < '0' || character > '9') return false;
        return true;
    }

    private String normalizedTimestamp(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        return clean.isEmpty()
            ? VaultTimestamps.fromEpochMillis(clock.nowMillis())
            : VaultValidation.timestamp(clean, "manager_native_invalid_binding");
    }

    private static VaultFailure concurrent() {
        return new VaultFailure("manager_native_vault_concurrent_change");
    }

    private static VaultFailure invalidResponse() {
        return new VaultFailure("manager_native_invalid_enrollment_response");
    }

    private static VaultFailure removalConflict() {
        return new VaultFailure("manager_native_removal_conflict");
    }

    private static final class SetLike {
        static boolean enrollmentResultPhase(VaultPhase phase) {
            return phase == VaultPhase.CREDENTIAL_STAGED
                || phase == VaultPhase.PENDING_SERVER_CONFIRMATION
                || phase == VaultPhase.ACTIVE;
        }
    }

    private static final class DispatchTransition {
        final VaultSnapshot snapshot;
        final boolean priorNetworkAmbiguity;

        DispatchTransition(VaultSnapshot snapshot, boolean priorNetworkAmbiguity) {
            this.snapshot = snapshot;
            this.priorNetworkAmbiguity = priorNetworkAmbiguity;
        }
    }
}

final class EnrollmentView {
    final String operationId;
    final String deviceId;
    final String flow;
    final EnrollmentMetadata metadata;
    final InstallationBinding installation;
    final boolean replayed;
    final VaultPhase phase;

    EnrollmentView(
        String operationId,
        String deviceId,
        String flow,
        EnrollmentMetadata metadata,
        InstallationBinding installation,
        boolean replayed,
        VaultPhase phase
    ) {
        this.operationId = operationId;
        this.deviceId = deviceId;
        this.flow = flow;
        this.metadata = metadata;
        this.installation = installation;
        this.replayed = replayed;
        this.phase = phase;
    }

    Map<String, Object> safeData() {
        Map<String, Object> safe = new LinkedHashMap<>(metadata.safeRecord(operationId, flow, deviceId, replayed));
        if (installation != null) safe.put("installation", installation.safeRecord());
        return VaultCollections.copyMap(safe);
    }
}

final class RemovalView {
    final String operationId;
    final String deviceId;
    final boolean removed;
    final boolean replayed;

    RemovalView(String operationId, String deviceId, boolean removed, boolean replayed) {
        this.operationId = operationId;
        this.deviceId = deviceId;
        this.removed = removed;
        this.replayed = replayed;
    }

    Map<String, Object> safeData() {
        return VaultCollections.mapOf(
            "operation_id", operationId,
            "device_id", deviceId,
            "removed", removed,
            "replayed", replayed
        );
    }
}
