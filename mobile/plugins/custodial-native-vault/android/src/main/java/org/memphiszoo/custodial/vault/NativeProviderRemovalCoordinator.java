package org.memphiszoo.custodial.vault;

import java.util.Map;

/** Wraps, never replaces, the existing native-presence removal coordinator.
 * A durable provider fence must read back before enrollment key deletion. No
 * provider key/queue deletion. This wrapper adds no monitor over removal network
 * I/O; the existing VaultEngine removal method remains synchronized internally. */
final class NativeProviderRemovalCoordinator {
    interface Fence { void reconcile() throws VaultFailure; }
    private final VaultEngine engine;
    private final RemovalCoordinator removal;
    private final Fence fence;
    NativeProviderRemovalCoordinator(VaultEngine engine, RemovalCoordinator removal, Fence fence) {
        if (engine == null || removal == null || fence == null) throw new IllegalArgumentException("provider_removal_dependencies_required");
        this.engine = engine; this.removal = removal; this.fence = fence;
    }
    RemovalView remove(String operationId, String deviceId) throws VaultFailure {
        Throwable original = null;
        try { return removal.remove(operationId, deviceId); }
        catch (VaultFailure | RuntimeException error) { original = error; throw error; }
        finally { reconcileFinally(original); }
    }
    Map<String, Object> finalizeRemoval(String operationId) throws VaultFailure {
        Throwable original = null;
        try {
            synchronized (engine) {
                // Same engine monitor prevents identity/phase change between the
                // journal readback and unchanged enrollment-only key destruction.
                fence.reconcile();
                return engine.finalizeRemoval(operationId);
            }
        } catch (VaultFailure | RuntimeException error) { original = error; throw error; }
        finally { reconcileFinally(original); }
    }
    private void reconcileFinally(Throwable original) throws VaultFailure {
        try { fence.reconcile(); }
        catch (VaultFailure | RuntimeException failure) {
            if (original == null) throw failure;
            original.addSuppressed(failure);
        }
    }
}
