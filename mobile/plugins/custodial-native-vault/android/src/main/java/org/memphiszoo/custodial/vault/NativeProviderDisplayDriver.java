package org.memphiszoo.custodial.vault;

/** One synchronous bounded effect transaction under runtime engine/coordinator ownership.
 * Durable journal and exact OS observation are separate boundaries, never an atomic claim. */
final class NativeProviderDisplayDriver {
    enum Active { ABSENT, MATCH, CONFLICT }
    interface Surface {
        boolean enabled(NativeProviderPayload payload) throws Exception;
        Active active(NativeProviderJournal.OsDisplayIntent intent) throws Exception;
        void show(NativeProviderJournal.OsDisplayIntent intent) throws Exception;
        void cancel(String exactOwnedTag) throws Exception;
        boolean absent(String exactOwnedTag) throws Exception;
    }
    interface Guard {
        /** Actual native principal/engine state check; never a boolean from JS. */
        NativeProviderJournal.Observation current() throws VaultFailure;
    }
    private final NativeProviderJournal journal;
    private final Surface surface;
    NativeProviderDisplayDriver(NativeProviderJournal journal, Surface surface) { this.journal = journal; this.surface = surface; }
    boolean display(NativeProviderPrincipal principal, NativeProviderJournal.Presentation presentation, Guard guard) throws VaultFailure {
        NativeProviderJournal.OsDisplayIntent intent = null;
        try {
            NativeProviderJournal.Observation observation = guard.current(); journal.requirePresentationCurrent(principal, presentation);
            if (!surface.enabled(presentation.payload)) return false;
            intent = journal.prepareOsDisplay(principal, presentation, observation); if (intent == null) return false;
            guard.current(); journal.requirePresentationCurrent(principal, presentation);
            Active active = surface.active(intent);
            if (active == Active.CONFLICT) throw new VaultFailure("custodial_provider_os_item_conflict");
            if (active == Active.ABSENT) surface.show(intent);
            observation = guard.current(); journal.requirePresentationCurrent(principal, presentation);
            if (!surface.enabled(presentation.payload) || surface.active(intent) != Active.MATCH)
                throw new VaultFailure("custodial_provider_os_display_unconfirmed");
            journal.confirmOsDisplayed(principal, intent, observation); return true;
        } catch (Exception error) {
            if (intent != null) {
                // Persistence can fail after actual notify. Always cancel ONLY that exact item;
                // its journal uncertainty remains until exact absence/readback is reconciled.
                try { journal.requestOsCancellation(principal, presentation); } catch (Exception preserved) { }
                try { surface.cancel(intent.tag); } catch (Exception uncertain) { }
            }
            if (error instanceof VaultFailure) throw (VaultFailure) error;
            throw new VaultFailure("custodial_provider_os_display_failed", error);
        }
    }
    int cancelPending(int limit) throws VaultFailure {
        if (limit < 1 || limit > 32) throw new VaultFailure("custodial_provider_cancel_limit_invalid");
        int count = 0;
        try {
            for (NativeProviderJournal.OsCancellation cancellation : journal.pendingOsCancellations()) {
                if (count == limit) break;
                surface.cancel(cancellation.tag);
                if (!surface.absent(cancellation.tag)) throw new VaultFailure("custodial_provider_os_cancel_unconfirmed");
                journal.confirmOsCanceled(cancellation); count++;
            }
            return count;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_os_cancel_failed", error); }
    }
}
