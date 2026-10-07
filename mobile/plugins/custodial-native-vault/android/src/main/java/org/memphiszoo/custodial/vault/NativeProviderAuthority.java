package org.memphiszoo.custodial.vault;

import java.util.Map;
import org.json.JSONObject;

/** Sole provider interpretation of the existing native enrollment/principal journals.
 * Caller owns engine -> coordinator. This grants identity only, NEVER time/effect authority. */
final class NativeProviderAuthority {
    static final class Current {
        final NativeProviderPrincipal principal;
        final long revision;
        final String phase;
        Current(NativeProviderPrincipal principal, long revision, String phase) {
            this.principal = principal; this.revision = revision; this.phase = phase;
        }
    }
    private final VaultEngine engine;
    private final NativePrincipalJournal principals;
    private final NativeLegacyLineageJournal legacy;
    private final NativeProviderJournal journal;
    private final Object coordinator;
    NativeProviderAuthority(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator) {
        if (engine == null || principals == null || legacy == null || journal == null || coordinator == null)
            throw new IllegalArgumentException("provider_authority_dependencies_required");
        this.engine = engine; this.principals = principals; this.legacy = legacy; this.journal = journal; this.coordinator = coordinator;
    }
    Current reconcile() throws VaultFailure {
        if (!Thread.holdsLock(engine) || !Thread.holdsLock(coordinator)) throw new VaultFailure("custodial_provider_lock_owner_required");
        Map<String, Object> state;
        try { state = engine.getState(); }
        catch (VaultFailure unreadable) { journal.observeUnavailable(); throw unreadable; }
        Object revision = state.get("revision");
        if (!(revision instanceof Number)) throw new VaultFailure("custodial_provider_native_state_invalid");
        String phase = String.valueOf(state.get("state"));
        if (!Boolean.TRUE.equals(state.get("active"))) {
            if ("EMPTY".equals(phase) || "REMOVAL_REQUESTED".equals(phase) || "REMOVAL_TOMBSTONE".equals(phase)) journal.observeRemoved();
            else journal.observeUnavailable();
            return new Current(null, ((Number) revision).longValue(), phase);
        }
        try {
            JSONObject value = NativeLegacyLineageJournal.applies(state) ? engine.readLegacyPrincipal(legacy) : principals.readFor(state);
            if (value == null) { journal.observeUnavailable(); return new Current(null, ((Number) revision).longValue(), phase); }
            NativeProviderPrincipal principal = NativeProviderPrincipal.fromNativeJournal(value);
            journal.observeActivePrincipal(principal);
            return new Current(principal, ((Number) revision).longValue(), phase);
        } catch (VaultFailure unavailable) { journal.observeUnavailable(); throw unavailable; }
    }
}
