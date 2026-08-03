package org.memphiszoo.manager.vault;

/**
 * Crash-recoverable active/pending key authority. Pending keys are promoted in
 * one registry commit; the prior active keyset is retained as a durable
 * retiring record until AndroidKeyStore deletion is verified and journaled.
 */
final class ManagerV2KeyCoordinator {
    private static final Object PROCESS_LOCK = new Object();
    private final ManagerV2OperationPersistence persistence;
    private final ManagerV2KeyRing keys;
    private final VaultClock clock;

    ManagerV2KeyCoordinator(ManagerV2OperationPersistence persistence, ManagerV2KeyRing keys, VaultClock clock) {
        this.persistence = persistence;
        this.keys = keys;
        this.clock = clock;
    }

    ManagerV2OperationRecord preparePending(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.active != null && registry.active.operationId.equals(operationId)) {
                throw new VaultFailure("manager_v2_operation_already_active");
            }
            ManagerV2OperationRecord state = registry.pending;
            if (state == null) {
                state = ManagerV2OperationRecord.precommitted(operationId, clock.nowMillis());
                registry = commit(registry, registry.next(registry.active, state, null));
            } else if (!state.operationId.equals(operationId)) {
                throw new VaultFailure("manager_v2_operation_conflict");
            }
            state = prepareKeysLocked(registry, state);
            return state;
        }
    }

    ManagerV2OperationRecord requirePending(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.pending == null || !registry.pending.operationId.equals(operationId)) {
                throw new VaultFailure("manager_v2_pending_keyset_missing");
            }
            requireReady(registry.pending);
            return registry.pending;
        }
    }

    ManagerV2OperationRecord requireActive(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.active == null || !registry.active.operationId.equals(operationId)) {
                throw new VaultFailure("manager_v2_active_keyset_missing");
            }
            requireReady(registry.active);
            return registry.active;
        }
    }

    String securityLevel(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            ManagerV2OperationRecord record = registry.active != null
                    && registry.active.operationId.equals(operationId)
                ? registry.active
                : registry.pending != null && registry.pending.operationId.equals(operationId)
                    ? registry.pending
                    : null;
            if (record == null) throw new VaultFailure("manager_v2_operation_key_missing");
            requireReady(record);
            return requireHardwareSecurityLevel(operationId);
        }
    }

    ManagerV2OperationRecord promote(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.active != null && registry.active.operationId.equals(operationId) && registry.pending == null) {
                requireReady(registry.active);
                return registry.active;
            }
            if (registry.pending == null || !registry.pending.operationId.equals(operationId)) {
                throw new VaultFailure("manager_v2_pending_keyset_missing");
            }
            requireReady(registry.pending);
            ManagerV2OperationRecord promoted = registry.pending;
            registry = commit(registry, registry.next(promoted, null, registry.active));
            cleanupRetiringLocked();
            return promoted;
        }
    }

    void cancelPending(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.pending == null) return;
            if (!registry.pending.operationId.equals(operationId)) throw new VaultFailure("manager_v2_operation_conflict");
            registry = commit(registry, registry.next(registry.active, null, registry.pending));
            cleanupRetiringLocked();
        }
    }

    void removeActive(String requestedOperationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            cleanupRetiringLocked();
            String operationId = ManagerV2WireContract.operationId(requestedOperationId);
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.active == null) return;
            if (!registry.active.operationId.equals(operationId)) throw new VaultFailure("manager_v2_operation_conflict");
            if (registry.pending != null) throw new VaultFailure("manager_v2_pending_operation_exists");
            registry = commit(registry, registry.next(null, null, registry.active));
            cleanupRetiringLocked();
        }
    }

    /** Compatibility alias retained only for pure crypto tests. */
    ManagerV2OperationRecord prepare(String operationId) throws VaultFailure {
        return preparePending(operationId);
    }

    /** Cleanup is state-sensitive: pending cancellation never removes active. */
    void destroy(String operationId) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            ManagerV2KeyRegistry registry = persistence.load();
            if (registry.pending != null && registry.pending.operationId.equals(operationId)) {
                cancelPending(operationId);
                return;
            }
            if (registry.active != null && registry.active.operationId.equals(operationId)) {
                removeActive(operationId);
                return;
            }
            cleanupRetiringLocked();
        }
    }

    private ManagerV2OperationRecord prepareKeysLocked(
        ManagerV2KeyRegistry registry,
        ManagerV2OperationRecord state
    ) throws VaultFailure {
        if (state.phase == ManagerV2KeyPhase.BLOCKED) throw new VaultFailure(state.blockedReason);
        if (state.phase == ManagerV2KeyPhase.PRECOMMITTED) {
            if (!keys.hasSigningKey(state.operationId)) keys.createSigningKey(state.operationId);
            String signingKeyId = ManagerV2WireContract.thumbprint(keys.signingPublicKey(state.operationId));
            ManagerV2OperationRecord next = state.signingReady(signingKeyId);
            registry = commit(registry, registry.next(registry.active, next, registry.retiring));
            state = next;
        }
        requireSigning(state);
        if (state.phase == ManagerV2KeyPhase.SIGNING_READY) {
            if (!keys.hasWrappingKey(state.operationId)) keys.createWrappingKey(state.operationId);
            String wrappingKeyId = ManagerV2WireContract.thumbprint(keys.wrappingPublicKey(state.operationId));
            ManagerV2OperationRecord next = state.ready(wrappingKeyId);
            registry = commit(registry, registry.next(registry.active, next, registry.retiring));
            state = next;
        }
        requireReady(state);
        return state;
    }

    private void requireReady(ManagerV2OperationRecord state) throws VaultFailure {
        if (state.phase != ManagerV2KeyPhase.READY) throw new VaultFailure("manager_v2_operation_state_corrupt");
        requireSigning(state);
        if (!keys.hasWrappingKey(state.operationId)
            || !ManagerV2WireContract.thumbprint(keys.wrappingPublicKey(state.operationId)).equals(state.wrappingKeyId)) {
            throw new VaultFailure("manager_v2_operation_key_missing");
        }
        requireHardwareSecurityLevel(state.operationId);
    }

    private String requireHardwareSecurityLevel(String operationId) throws VaultFailure {
        String level = keys.securityLevel(operationId);
        if (!"trusted_environment".equals(level) && !"strongbox".equals(level)) {
            throw new VaultFailure("native_security_capability_required");
        }
        return level;
    }

    private void requireSigning(ManagerV2OperationRecord state) throws VaultFailure {
        if (!keys.hasSigningKey(state.operationId)
            || !ManagerV2WireContract.thumbprint(keys.signingPublicKey(state.operationId)).equals(state.signingKeyId)) {
            throw new VaultFailure("manager_v2_operation_key_missing");
        }
    }

    private void cleanupRetiringLocked() throws VaultFailure {
        ManagerV2KeyRegistry registry = persistence.load();
        if (registry.retiring == null) return;
        keys.destroy(registry.retiring.operationId);
        ManagerV2KeyRegistry latest = persistence.load();
        if (latest.revision != registry.revision || latest.retiring == null
            || !latest.retiring.operationId.equals(registry.retiring.operationId)) {
            throw new VaultFailure("manager_v2_operation_concurrent_change");
        }
        commit(latest, latest.next(latest.active, latest.pending, null));
    }

    private ManagerV2KeyRegistry commit(ManagerV2KeyRegistry expected, ManagerV2KeyRegistry next) throws VaultFailure {
        persistence.commit(expected.revision, next);
        return next;
    }
}
