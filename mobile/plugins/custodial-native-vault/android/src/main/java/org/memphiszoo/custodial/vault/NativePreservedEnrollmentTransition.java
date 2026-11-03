package org.memphiszoo.custodial.vault;

/** Orchestration of ALREADY-owned effects only; no admission/JSON/receipt
 * factory. Production ports stay private inside the actual native Engine
 * continuation and recheck its closed ACK/GCM/HELD/all8 owners at each effect.
 * Unit ports model ordering/failures only and cannot create those owners. */
final class NativePreservedEnrollmentTransition {
    interface OwnedEffects<T> {
        void settleOriginalEnrollment() throws VaultFailure;
        void verifyRetainedBrowserOutsideMonitor() throws VaultFailure;
        T publishRetainedPartitionOutsideMonitor() throws VaultFailure;
        void verifyRetainedSuccessor() throws VaultFailure;
    }
    static <T> T complete(Object monitor,NativePrivateCustodyFrameReadControl control,OwnedEffects<T> effects)throws VaultFailure {
        if(monitor==null||control==null||effects==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        if(Thread.holdsLock(monitor))throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();
        synchronized(monitor){control.check();effects.settleOriginalEnrollment();effects.verifyRetainedSuccessor();}
        control.check();effects.verifyRetainedBrowserOutsideMonitor();control.check();
        T result=effects.publishRetainedPartitionOutsideMonitor();
        synchronized(monitor){control.check();effects.verifyRetainedSuccessor();}
        return result;
    }
    private NativePreservedEnrollmentTransition(){}
}
