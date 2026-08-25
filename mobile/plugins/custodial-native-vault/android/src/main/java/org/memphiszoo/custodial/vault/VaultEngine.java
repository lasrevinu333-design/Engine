package org.memphiszoo.custodial.vault;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure, package-private authority for every vault transition. It has no Android,
 * Capacitor, JSON, or network implementation dependency.
 */
final class VaultEngine {
    private static final long REQUEST_TTL_MILLIS = 15L * 60L * 1000L;
    private static final long MAX_RESUME_TTL_MILLIS = 30L * 60L * 1000L;
    private static final Object ENROLLMENT_TRANSPORT_MONITOR = new Object();

    private final VaultPersistence persistence;
    private final CredentialCipher cipher;
    private final EnrollmentTransport transport;
    private final LegacyVaultSource legacy;
    private final InstallationSealGenerator sealGenerator;
    private final VaultClock clock;

    VaultEngine(
        VaultPersistence persistence,
        CredentialCipher cipher,
        EnrollmentTransport transport,
        LegacyVaultSource legacy,
        InstallationSealGenerator sealGenerator,
        VaultClock clock
    ) {
        this.persistence = persistence;
        this.cipher = cipher;
        this.transport = transport;
        this.legacy = legacy;
        this.sealGenerator = sealGenerator;
        this.clock = clock;
    }

    synchronized Map<String, Object> getState() throws VaultFailure {
        VaultSnapshot state = persistence.load();
        if (state.phase == VaultPhase.BLOCKED) return publicState(state);
        state = recoverLegacy();
        state = recoverExpiry(state);
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
            throw new VaultFailure("custodial_native_invalid_enrollment");
        }
        VaultSnapshot state = recoverExpiry(recoverLegacy());
        state = beginEnrollment(state, request, enrollmentCode);
        if (state.phase != VaultPhase.ENROLLMENT_REQUESTED && state.phase != VaultPhase.ENROLLMENT_DISPATCHED) {
            return enrollmentView(state, true);
        }
        return requestAndStage(state, request);
    }

    synchronized EnrollmentView resumeEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverLegacy());
        requireSameOperation(state, requested);
        return switch (state.phase) {
            case ENROLLMENT_REQUESTED, ENROLLMENT_DISPATCHED -> requestAndStage(
                state,
                new EnrollmentRequest(state.operationId, state.deviceId, state.flow)
            );
            case CREDENTIAL_STAGED, PENDING_SERVER_CONFIRMATION, ACTIVE -> enrollmentView(state, true);
            case CANCEL_REQUESTED -> {
                finishCancel(state);
                throw new VaultFailure("custodial_native_enrollment_cancelled");
            }
            case CANCELLED -> throw new VaultFailure("custodial_native_enrollment_cancelled");
            default -> throw new VaultFailure("custodial_native_enrollment_resume_refused");
        };
    }

    synchronized Map<String, Object> completeLocalBinding(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverLegacy());
        if (state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION && state.operationId.equals(requested)) {
            return publicState(state);
        }
        if (state.phase != VaultPhase.CREDENTIAL_STAGED || !state.operationId.equals(requested)) {
            throw new VaultFailure("custodial_native_binding_state_refused");
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

    synchronized Map<String, Object> completeLegacyBinding(String deviceId) throws VaultFailure {
        VaultSnapshot state = recoverLegacy();
        String expectedDevice = VaultValidation.deviceId(deviceId);
        if (
            state.phase == VaultPhase.ACTIVE
            && state.installation != null
            && state.installation.migratedFromCredentialOnlyState
            && state.deviceId.equals(expectedDevice)
        ) return publicState(state);
        if (state.phase != VaultPhase.LEGACY_PENDING) throw new VaultFailure("custodial_native_legacy_binding_refused");
        char[] credential = cipher.decrypt(state.secret);
        String verifiedDevice;
        try {
            verifiedDevice = transport.verifyLegacyIdentity(expectedDevice, credential);
        } finally {
            VaultValidation.wipe(credential);
        }
        if (!expectedDevice.equals(VaultValidation.deviceId(verifiedDevice))) {
            throw new VaultFailure("custodial_native_legacy_binding_mismatch");
        }
        String seal = state.legacySeal.isEmpty() ? sealGenerator.newSeal() : state.legacySeal;
        InstallationBinding binding = new InstallationBinding(
            expectedDevice,
            seal,
            normalizedTimestamp(null),
            true,
            ""
        );
        VaultSnapshot next = state.next(
            VaultPhase.ACTIVE,
            SecretKind.DEVICE_CREDENTIAL,
            state.secret,
            "",
            binding.deviceId,
            "",
            0,
            binding,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
        return publicState(commit(state, next));
    }

    synchronized Map<String, Object> confirmEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverExpiry(recoverLegacy());
        if (state.phase == VaultPhase.ACTIVE && state.operationId.equals(requested)) return publicState(state);
        if (state.phase != VaultPhase.PENDING_SERVER_CONFIRMATION || !state.operationId.equals(requested)) {
            throw new VaultFailure("custodial_native_confirmation_refused");
        }
        char[] credential = cipher.decrypt(state.secret);
        try {
            TerminalResult result = transport.confirm(state.operationId, state.deviceId, credential);
            if (!result.operationId.equals(state.operationId)) throw invalidResponse();
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
        return publicState(commit(latest, next));
    }

    synchronized Map<String, Object> cancelEnrollment(String operationId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        VaultSnapshot state = recoverLegacy();
        requireSameOperation(state, requested);
        if (state.phase == VaultPhase.CANCELLED) {
            cleanupCancelledKey();
            return publicState(state);
        }
        if (state.phase == VaultPhase.ENROLLMENT_REQUESTED || state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
            state = recoverCredentialForCancellation(state);
        }
        if (state.phase == VaultPhase.CANCELLED) {
            cleanupCancelledKey();
            return publicState(state);
        }
        if (state.phase == VaultPhase.ACTIVE) throw new VaultFailure("custodial_native_removal_required");
        if (state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION) {
            throw new VaultFailure("custodial_native_cancellation_refused");
        }
        if (state.phase == VaultPhase.CREDENTIAL_STAGED) state = markCancellationRequested(state);
        if (state.phase == VaultPhase.CANCELLED) {
            cleanupCancelledKey();
            return publicState(state);
        }
        if (state.phase != VaultPhase.CANCEL_REQUESTED) {
            throw new VaultFailure("custodial_native_cancellation_refused");
        }
        return publicState(finishCancel(state));
    }

    AuthorizedResponse authorizedRequest(
        String expectedDeviceId,
        AuthorizedRequest rawRequest
    ) throws VaultFailure {
        final VaultSnapshot state;
        final AuthorizedRequest request;
        final char[] credential;
        synchronized (this) {
            state = recoverExpiry(recoverLegacy());
            if (state.phase != VaultPhase.ACTIVE || !state.hasCredential()) {
                throw new VaultFailure("custodial_native_pending_state_refused");
            }
            String expected = VaultValidation.deviceId(expectedDeviceId);
            if (!state.deviceId.equals(expected)) throw new VaultFailure("custodial_native_device_binding_mismatch");
            request = RequestPolicy.validate(rawRequest, state.deviceId);
            VaultSnapshot immediate = persistence.load();
            if (!sameRevisionAndPhase(immediate, state)) throw concurrent();
            credential = cipher.decrypt(state.secret);
        }
        try {
            AuthorizedResponse response = transport.authorized(request, state.deviceId, credential);
            synchronized (this) {
                VaultSnapshot after = persistence.load();
                if (!sameRevisionAndPhase(after, state)) throw concurrent();
                return response;
            }
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    synchronized Map<String, Object> attestOfflineStart(
        String expectedDeviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId,
        String snapshotEmployeeId,
        long assignmentEpoch,
        String snapshotCredentialId,
        String nativeScanEntryId,
        String startedAt
    ) throws VaultFailure {
        VaultSnapshot state = activeSnapshotForDevice(expectedDeviceId);
        char[] credential = cipher.decrypt(state.secret);
        try {
            NativeAttestation.requireStoredCredentialId(credential, state.metadata.credentialId);
            return NativeAttestation.offlineStart(
                state.deviceId,
                locationCode,
                clientSessionId,
                snapshotId,
                snapshotEmployeeId,
                assignmentEpoch,
                snapshotCredentialId,
                nativeScanEntryId,
                credential,
                startedAt
            );
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    synchronized Map<String, Object> attestOfflineCompletion(
        String expectedDeviceId,
        String locationCode,
        String clientSessionId,
        String clientCompletionId,
        String contextId,
        String nativeFinishScanEntryId,
        String startedAt,
        String endedAt
    ) throws VaultFailure {
        VaultSnapshot state = activeSnapshotForDevice(expectedDeviceId);
        char[] credential = cipher.decrypt(state.secret);
        try {
            NativeAttestation.requireStoredCredentialId(credential, state.metadata.credentialId);
            return NativeAttestation.offlineCompletion(
                state.deviceId,
                locationCode,
                clientSessionId,
                clientCompletionId,
                contextId,
                nativeFinishScanEntryId,
                startedAt,
                credential,
                endedAt
            );
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private VaultSnapshot activeSnapshotForDevice(String expectedDeviceId) throws VaultFailure {
        VaultSnapshot state = recoverExpiry(recoverLegacy());
        if (state.phase != VaultPhase.ACTIVE || !state.hasCredential()) {
            throw new VaultFailure("custodial_native_pending_state_refused");
        }
        String expected = VaultValidation.deviceId(expectedDeviceId);
        if (!state.deviceId.equals(expected)) throw new VaultFailure("custodial_native_device_binding_mismatch");
        return state;
    }

    synchronized String requireActiveDevice(String expectedDeviceId) throws VaultFailure {
        return activeSnapshotForDevice(expectedDeviceId).deviceId;
    }

    synchronized RemovalView removeEnrollment(String operationId, String expectedDeviceId) throws VaultFailure {
        String requested = VaultValidation.operationId(operationId);
        String expected = VaultValidation.deviceId(expectedDeviceId);
        VaultSnapshot state = recoverLegacy();
        if (state.phase == VaultPhase.REMOVAL_TOMBSTONE) {
            if (!state.removalOperationId.equals(requested) || !state.deviceId.equals(expected)) throw removalConflict();
            return new RemovalView(state.removalOperationId, state.deviceId, true, true);
        }
        if (state.phase == VaultPhase.ACTIVE) {
            if (!state.deviceId.equals(expected)) throw new VaultFailure("custodial_native_device_binding_mismatch");
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
            result = transport.remove(state.removalOperationId, state.deviceId, credential);
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
        VaultSnapshot state = recoverLegacy();
        if (state.phase == VaultPhase.EMPTY) {
            if (!state.removalOperationId.equals(requested)) {
                throw new VaultFailure("custodial_native_removal_not_complete");
            }
            return publicState(state);
        }
        if (state.phase != VaultPhase.REMOVAL_TOMBSTONE || !state.removalOperationId.equals(requested)) {
            throw new VaultFailure("custodial_native_removal_not_complete");
        }
        cipher.destroyKey();
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
        return publicState(commit(state, empty));
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
                        throw new VaultFailure("custodial_native_enrollment_conflict");
                    }
                } finally {
                    VaultValidation.wipe(storedCode);
                }
            }
            return state;
        }
        if (state.phase == VaultPhase.ACTIVE) {
            VaultFailure credentialFailure = activeCredentialFailure(state);
            if (
                !"recovery".equals(request.flow)
                || !state.deviceId.equals(request.deviceId)
            ) throw new VaultFailure("custodial_native_enrollment_conflict");
            if (credentialFailure == null && !activeCredentialRequiresEnrollment(state)) {
                throw new VaultFailure("custodial_native_enrollment_conflict");
            }
            // The server recovery operation atomically revokes the prior
            // credential and issues one replacement. The old secret is either
            // locally unusable or has just failed a native, exact-device status
            // check with ENROLLMENT_REQUIRED. Replace it only with the durable,
            // exact-operation manager-code journal needed to recover safely.
            return beginCredentialRecovery(state, request, code);
        }
        if (!(state.phase == VaultPhase.EMPTY || state.phase == VaultPhase.CANCELLED)) {
            throw new VaultFailure("custodial_native_enrollment_state_refused");
        }
        if (state.phase == VaultPhase.CANCELLED) cleanupCancelledKey();
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
            if (!error.code.equals("custodial_native_vault_concurrent_change")) throw error;
            VaultSnapshot current = persistence.load();
            if (current.pendingEnrollment()) {
                requireSameEnrollment(current, request);
                return current;
            }
            throw error;
        }
    }

    private VaultSnapshot beginCredentialRecovery(
        VaultSnapshot active,
        EnrollmentRequest request,
        char[] code
    ) throws VaultFailure {
        // A permanently invalidated AndroidKeyStore key cannot encrypt the
        // recovery journal either. The active secret has already failed an
        // authenticated decrypt/binding check, so retire that unusable key
        // before creating the exact recovery operation under a fresh key.
        cipher.destroyKey();
        EncryptedSecret encryptedCode = cipher.encrypt(code);
        VaultSnapshot requested = active.next(
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
            return commit(active, requested);
        } catch (VaultFailure error) {
            if (!error.code.equals("custodial_native_vault_concurrent_change")) throw error;
            VaultSnapshot current = persistence.load();
            if (current.pendingEnrollment()) {
                requireSameEnrollment(current, request);
                return current;
            }
            throw error;
        }
    }

    private boolean activeCredentialRequiresEnrollment(VaultSnapshot state) throws VaultFailure {
        char[] credential = cipher.decrypt(state.secret);
        try {
            ActiveCredentialStatus result = transport.verifyActiveCredential(
                state.deviceId,
                state.metadata.credentialId,
                credential
            );
            return result == ActiveCredentialStatus.ENROLLMENT_REQUIRED;
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private DispatchTransition markEnrollmentDispatched(VaultSnapshot state) throws VaultFailure {
        if (state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
            VaultSnapshot current = persistence.load();
            requireSameEnrollment(
                current,
                new EnrollmentRequest(state.operationId, state.deviceId, state.flow)
            );
            if (
                current.phase == VaultPhase.ENROLLMENT_DISPATCHED
                || SetLike.enrollmentResultPhase(current.phase)
                || current.phase == VaultPhase.CANCEL_REQUESTED
                || current.phase == VaultPhase.CANCELLED
            ) return new DispatchTransition(current, true);
            throw concurrent();
        }
        if (state.phase != VaultPhase.ENROLLMENT_REQUESTED) {
            throw new VaultFailure("custodial_native_enrollment_state_refused");
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
            persistence.commit(state.revision, dispatched);
            return new DispatchTransition(dispatched, false);
        } catch (VaultFailure commitError) {
            VaultSnapshot current;
            try {
                current = persistence.load();
            } catch (VaultFailure ignored) {
                throw commitError;
            }
            // Preserve crash-atomic exact readback behavior even if the
            // persistence adapter reported failure after the write landed.
            // Treat the provenance as ambiguous because a peer may have won
            // the byte-identical write.
            if (current.equals(dispatched)) return new DispatchTransition(current, true);
            if (!commitError.code.equals("custodial_native_vault_concurrent_change")) throw commitError;

            // Multiple WebView calls or a process restart can create distinct
            // VaultEngine instances over the same durable journal. Converge
            // only on monotonic states for this exact enrollment identity.
            requireSameEnrollment(
                current,
                new EnrollmentRequest(state.operationId, state.deviceId, state.flow)
            );
            if (
                current.phase == VaultPhase.ENROLLMENT_DISPATCHED
                || SetLike.enrollmentResultPhase(current.phase)
                || current.phase == VaultPhase.CANCEL_REQUESTED
                || current.phase == VaultPhase.CANCELLED
            ) return new DispatchTransition(current, true);
            throw commitError;
        }
    }

    private VaultSnapshot markCancellationRequested(VaultSnapshot state) throws VaultFailure {
        if (state.phase == VaultPhase.CANCEL_REQUESTED || state.phase == VaultPhase.CANCELLED) return state;
        if (state.phase != VaultPhase.CREDENTIAL_STAGED) {
            throw new VaultFailure("custodial_native_cancellation_refused");
        }
        VaultSnapshot cancelling = state.next(
            VaultPhase.CANCEL_REQUESTED,
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
        return commitCancellationRequested(state, cancelling);
    }

    private VaultSnapshot commitCancellationRequested(
        VaultSnapshot expected,
        VaultSnapshot cancelling
    ) throws VaultFailure {
        try {
            return commit(expected, cancelling);
        } catch (VaultFailure commitError) {
            if (!commitError.code.equals("custodial_native_vault_concurrent_change")) throw commitError;
            VaultSnapshot current = persistence.load();
            requireSameEnrollment(
                current,
                new EnrollmentRequest(expected.operationId, expected.deviceId, expected.flow)
            );
            if (current.phase == VaultPhase.CANCEL_REQUESTED || current.phase == VaultPhase.CANCELLED) {
                return current;
            }
            if (current.phase == VaultPhase.CREDENTIAL_STAGED) return markCancellationRequested(current);
            if (current.phase == VaultPhase.ACTIVE) throw new VaultFailure("custodial_native_removal_required");
            if (current.phase == VaultPhase.PENDING_SERVER_CONFIRMATION) {
                throw new VaultFailure("custodial_native_cancellation_refused");
            }
            throw commitError;
        }
    }

    private VaultSnapshot localTerminalNoCredential(VaultSnapshot state) throws VaultFailure {
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.CANCELLED && latest.operationId.equals(state.operationId)) return latest;
        if (!sameRevisionAndPhase(latest, state)) throw concurrent();
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
        cleanupCancelledKey();
        return committed;
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
        synchronized (ENROLLMENT_TRANSPORT_MONITOR) {
            return requestAndStageExclusive(requested, request);
        }
    }

    private EnrollmentView requestAndStageExclusive(
        VaultSnapshot requested,
        EnrollmentRequest request
    ) throws VaultFailure {
        if (requested.phase != VaultPhase.ENROLLMENT_REQUESTED && requested.phase != VaultPhase.ENROLLMENT_DISPATCHED) {
            return enrollmentView(requested, true);
        }
        DispatchTransition transition = markEnrollmentDispatched(requested);
        VaultSnapshot dispatched = transition.state;
        if (SetLike.enrollmentResultPhase(dispatched.phase)) {
            return enrollmentView(dispatched, true);
        }
        if (dispatched.phase == VaultPhase.CANCEL_REQUESTED || dispatched.phase == VaultPhase.CANCELLED) {
            throw new VaultFailure("custodial_native_enrollment_cancelled");
        }
        if (dispatched.phase != VaultPhase.ENROLLMENT_DISPATCHED) throw concurrent();
        boolean priorAmbiguity = transition.priorAmbiguity;
        char[] code = cipher.decrypt(dispatched.secret);
        EnrollmentResult received;
        try {
            received = transport.enroll(request, code);
        } catch (VaultFailure remoteFailure) {
            if (authoritativeNoCredential(remoteFailure, priorAmbiguity)) {
                localTerminalNoCredential(dispatched);
                throw new VaultFailure(
                    "custodial_native_enrollment_terminal",
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
                if (latest.phase == VaultPhase.CREDENTIAL_STAGED) {
                    requireSameEnrollment(latest, request);
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
                if (!commitError.code.equals("custodial_native_vault_concurrent_change")) throw commitError;
                VaultSnapshot recovered = null;
                try {
                    recovered = persistence.load();
                } catch (VaultFailure ignored) {}
                if (recovered != null && recovered.phase == VaultPhase.CREDENTIAL_STAGED) {
                    requireSameEnrollment(recovered, request);
                    return enrollmentView(recovered, true);
                }
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
        EnrollmentRequest enrollment = new EnrollmentRequest(
            requested.operationId,
            requested.deviceId,
            requested.flow
        );
        VaultSnapshot current;
        try {
            current = persistence.load();
        } catch (VaultFailure ignored) {
            current = requested;
        }
        if (staged != null && current.equals(staged)) return;
        if (current.phase == VaultPhase.CREDENTIAL_STAGED) {
            requireSameEnrollment(current, enrollment);
            return;
        }
        boolean cancellationJournaled = false;
        if (current.phase == VaultPhase.CANCEL_REQUESTED) {
            requireSameEnrollment(current, enrollment);
            cancellationJournaled = true;
        } else if (current.phase == VaultPhase.CANCELLED) {
            requireSameEnrollment(current, enrollment);
            return;
        }
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
            TerminalResult cancelled = transport.cancel(requested.operationId, requested.deviceId, result.credential);
            if (!cancelled.operationId.equals(requested.operationId)) throw invalidResponse();
            VaultSnapshot durable = persistence.load();
            requireSameEnrollment(durable, enrollment);
            if (durable.phase == VaultPhase.CANCELLED) return;
            if (durable.phase == VaultPhase.CANCEL_REQUESTED) {
                VaultSnapshot terminal = durable.next(
                    VaultPhase.CANCELLED,
                    SecretKind.NONE,
                    null,
                    durable.operationId,
                    durable.deviceId,
                    durable.flow,
                    0,
                    null,
                    EnrollmentMetadata.empty(),
                    "",
                    "",
                    false,
                    ""
                );
                commit(durable, terminal);
                cleanupCancelledKey();
            }
        } catch (VaultFailure ignored) {
            // CANCEL_REQUESTED or ENROLLMENT_REQUESTED remains replayable.
        }
    }

    private VaultSnapshot recoverCredentialForCancellation(VaultSnapshot requested) throws VaultFailure {
        synchronized (ENROLLMENT_TRANSPORT_MONITOR) {
            return recoverCredentialForCancellationExclusive(requested);
        }
    }

    private VaultSnapshot recoverCredentialForCancellationExclusive(VaultSnapshot requested) throws VaultFailure {
        DispatchTransition transition = markEnrollmentDispatched(requested);
        requested = transition.state;
        if (requested.phase == VaultPhase.CREDENTIAL_STAGED) return markCancellationRequested(requested);
        if (requested.phase == VaultPhase.CANCEL_REQUESTED || requested.phase == VaultPhase.CANCELLED) {
            return requested;
        }
        if (requested.phase == VaultPhase.ACTIVE) throw new VaultFailure("custodial_native_removal_required");
        if (requested.phase == VaultPhase.PENDING_SERVER_CONFIRMATION) {
            throw new VaultFailure("custodial_native_cancellation_refused");
        }
        if (requested.phase != VaultPhase.ENROLLMENT_DISPATCHED) throw concurrent();
        boolean priorAmbiguity = transition.priorAmbiguity;
        EnrollmentRequest request = new EnrollmentRequest(requested.operationId, requested.deviceId, requested.flow);
        char[] code = cipher.decrypt(requested.secret);
        EnrollmentResult received;
        try {
            received = transport.enroll(request, code);
        } catch (VaultFailure remoteFailure) {
            if (authoritativeNoCredential(remoteFailure, priorAmbiguity)) return localTerminalNoCredential(requested);
            throw remoteFailure;
        }
        try (EnrollmentResult result = received) {
            validateEnrollmentResult(request, result);
            EncryptedSecret encrypted = cipher.encrypt(result.credential);
            VaultSnapshot latest = persistence.load();
            requireSameEnrollment(latest, request);
            if (latest.phase == VaultPhase.CANCEL_REQUESTED || latest.phase == VaultPhase.CANCELLED) return latest;
            if (latest.phase == VaultPhase.CREDENTIAL_STAGED) return markCancellationRequested(latest);
            if (latest.phase == VaultPhase.ACTIVE) throw new VaultFailure("custodial_native_removal_required");
            if (latest.phase == VaultPhase.PENDING_SERVER_CONFIRMATION) {
                throw new VaultFailure("custodial_native_cancellation_refused");
            }
            if (!sameRevisionAndPhase(latest, requested)) throw concurrent();
            VaultSnapshot cancelling = latest.next(
                VaultPhase.CANCEL_REQUESTED,
                SecretKind.DEVICE_CREDENTIAL,
                encrypted,
                latest.operationId,
                latest.deviceId,
                latest.flow,
                latest.expiresAtMillis,
                null,
                result.metadata,
                "",
                "",
                false,
                ""
            );
            return commitCancellationRequested(latest, cancelling);
        } finally {
            VaultValidation.wipe(code);
        }
    }

    private VaultSnapshot finishCancel(VaultSnapshot cancelling) throws VaultFailure {
        char[] credential = cipher.decrypt(cancelling.secret);
        TerminalResult result;
        try {
            result = transport.cancel(cancelling.operationId, cancelling.deviceId, credential);
        } finally {
            VaultValidation.wipe(credential);
        }
        if (!result.operationId.equals(cancelling.operationId)) throw invalidResponse();
        VaultSnapshot latest = persistence.load();
        if (latest.phase == VaultPhase.CANCELLED && latest.operationId.equals(cancelling.operationId)) return latest;
        if (!sameRevisionAndPhase(latest, cancelling)) throw concurrent();
        VaultSnapshot terminal = latest.next(
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
        VaultSnapshot committed = commit(latest, terminal);
        cleanupCancelledKey();
        return committed;
    }

    private VaultSnapshot recoverLegacy() throws VaultFailure {
        VaultSnapshot state = persistence.load();
        if (state.phase == VaultPhase.BLOCKED) throw new VaultFailure("custodial_native_vault_blocked");
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
                        throw new VaultFailure("custodial_native_legacy_vault_mismatch");
                    }
                } finally {
                    VaultValidation.wipe(protectedCredential);
                }
            }
        }
        legacy.cleanup();
        if (!legacy.isClean()) throw new VaultFailure("custodial_native_legacy_cleanup_failed");
        VaultSnapshot latest = persistence.load();
        if (latest.phase != VaultPhase.LEGACY_CLEANUP_PENDING) return latest;
        VaultPhase completedPhase = latest.legacyHadBinding ? VaultPhase.ACTIVE : VaultPhase.LEGACY_PENDING;
        VaultSnapshot completed = latest.next(
            completedPhase,
            SecretKind.DEVICE_CREDENTIAL,
            latest.secret,
            latest.legacyHadBinding ? latest.operationId : "",
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
        if (state.phase == VaultPhase.ENROLLMENT_REQUESTED || state.phase == VaultPhase.ENROLLMENT_DISPATCHED) {
            // A network response may have been lost after the server consumed
            // the code. Replay the exact operation to recover the credential,
            // then terminally cancel it; never drop the only compensation path.
            state = recoverCredentialForCancellation(state);
            if (state.phase == VaultPhase.CANCELLED) return state;
        }
        if (state.phase != VaultPhase.CANCEL_REQUESTED) {
            VaultSnapshot cancelling = state.next(
                VaultPhase.CANCEL_REQUESTED,
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
            state = commit(state, cancelling);
        }
        return finishCancel(state);
    }

    private VaultSnapshot commit(VaultSnapshot expected, VaultSnapshot next) throws VaultFailure {
        try {
            persistence.commit(expected.revision, next);
            return next;
        } catch (VaultFailure error) {
            try {
                VaultSnapshot actual = persistence.load();
                if (actual.equals(next)) return actual;
            } catch (VaultFailure ignored) {
                // Preserve the original exact failure code.
            }
            throw error;
        }
    }

    private void block(VaultSnapshot state, String reason) throws VaultFailure {
        commit(state, state.blocked(reason));
    }

    private void cleanupCancelledKey() throws VaultFailure {
        cipher.destroyKey();
    }

    private EnrollmentView enrollmentView(VaultSnapshot state, boolean replayed) throws VaultFailure {
        if (!SetLike.enrollmentResultPhase(state.phase)) {
            throw new VaultFailure("custodial_native_enrollment_state_refused");
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

    private VaultFailure activeCredentialFailure(VaultSnapshot state) {
        if (state.phase != VaultPhase.ACTIVE) return null;
        char[] credential = null;
        try {
            credential = cipher.decrypt(state.secret);
            NativeAttestation.requireStoredCredentialId(credential, state.metadata.credentialId);
            return null;
        } catch (VaultFailure error) {
            return error;
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private Map<String, Object> publicState(VaultSnapshot state) {
        VaultFailure credentialFailure = activeCredentialFailure(state);
        boolean recoveryRequired = credentialFailure != null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("schema_version", VaultSnapshot.SCHEMA_VERSION);
        result.put("state", recoveryRequired ? "RECOVERY_REQUIRED" : state.phase.name());
        result.put("revision", state.revision);
        result.put("active", state.phase == VaultPhase.ACTIVE && !recoveryRequired);
        result.put("blocked", state.phase == VaultPhase.BLOCKED);
        result.put("reason", state.blockedReason);
        result.put("credential_present", state.hasCredential() && !recoveryRequired);
        result.put("credential_usable", state.phase == VaultPhase.ACTIVE && !recoveryRequired);
        result.put("recovery_required", recoveryRequired);
        result.put("recovery_device_id", recoveryRequired ? state.deviceId : "");
        result.put("recovery_reason", recoveryRequired ? credentialFailure.code : "");
        result.put("legacy_pending", state.phase == VaultPhase.LEGACY_PENDING);
        result.put("legacy_seal", state.phase == VaultPhase.LEGACY_PENDING ? state.legacySeal : "");
        result.put("pending_operation_id", state.pendingEnrollment() ? state.operationId : "");
        result.put("pending_device_id", state.pendingEnrollment() ? state.deviceId : "");
        result.put("pending_flow", state.pendingEnrollment() ? state.flow : "");
        result.put("pending_server_confirmation", state.phase == VaultPhase.PENDING_SERVER_CONFIRMATION);
        result.put("active_enrollment_flow", state.phase == VaultPhase.ACTIVE && !recoveryRequired ? state.flow : "");
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
        ) throw new VaultFailure("custodial_native_enrollment_conflict");
    }

    private static void requireSameOperation(VaultSnapshot state, String operationId) throws VaultFailure {
        if (!state.operationId.equals(operationId)) throw new VaultFailure("custodial_native_enrollment_conflict");
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
            : VaultValidation.timestamp(clean, "custodial_native_invalid_binding");
    }

    private static VaultFailure concurrent() {
        return new VaultFailure("custodial_native_vault_concurrent_change");
    }

    private static VaultFailure invalidResponse() {
        return new VaultFailure("custodial_native_invalid_enrollment_response");
    }

    private static VaultFailure removalConflict() {
        return new VaultFailure("custodial_native_removal_conflict");
    }

    private static final class SetLike {
        static boolean enrollmentResultPhase(VaultPhase phase) {
            return phase == VaultPhase.CREDENTIAL_STAGED
                || phase == VaultPhase.PENDING_SERVER_CONFIRMATION
                || phase == VaultPhase.ACTIVE;
        }
    }

    private static final class DispatchTransition {
        final VaultSnapshot state;
        final boolean priorAmbiguity;

        DispatchTransition(VaultSnapshot state, boolean priorAmbiguity) {
            this.state = state;
            this.priorAmbiguity = priorAmbiguity;
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
