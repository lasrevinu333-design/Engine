package org.memphiszoo.custodial.vault;

import java.util.concurrent.atomic.AtomicBoolean;
import org.memphiszoo.custodial.vault.NativeProviderAuthority.Current;

/** Actual native token -> journal -> typed engine HTTP owner, not yet production-admitted.
 * All local transitions use engine -> provider order; neither lock spans network I/O.
 * This stage may quarantine ingress, never establish a provider clock or display receipt. */
final class NativeProviderRegistrationCoordinator implements NativeProviderIngressRuntime {
    interface AppIdentity { NativeProviderAppIdentity read() throws VaultFailure; }
    interface Observation { NativeProviderJournal.Observation read() throws VaultFailure; }
    enum RegistrationResult { CONFIRMED, ALREADY_CONFIRMED, WAITING_NATIVE_PRINCIPAL, WAITING_NATIVE_TOKEN, BUSY }
    private final VaultEngine engine;
    private final NativePrincipalJournal principalJournal;
    private final NativeLegacyLineageJournal legacyJournal;
    private final NativeProviderJournal journal;
    private final Object coordinator;
    private final AppIdentity appIdentity;
    private final Observation observation;
    private final NativeProviderHttp http;
    private final NativeProviderJobSchedule.SystemJobs jobs;
    private final NativeProviderAuthority authority;
    private final AtomicBoolean registrationRunning = new AtomicBoolean();
    private TokenRead activeTokenRead;

    NativeProviderRegistrationCoordinator(VaultEngine engine, NativePrincipalJournal principalJournal,
        NativeLegacyLineageJournal legacyJournal, NativeProviderJournal journal, Object coordinator,
        AppIdentity appIdentity, Observation observation, NativeProviderHttp http, NativeProviderJobSchedule.SystemJobs jobs) {
        if (engine == null || principalJournal == null || legacyJournal == null || journal == null || coordinator == null
            || appIdentity == null || observation == null || http == null || jobs == null) throw new IllegalArgumentException("provider_registration_dependencies_required");
        this.engine = engine; this.principalJournal = principalJournal; this.legacyJournal = legacyJournal;
        this.journal = journal; this.coordinator = coordinator; this.appIdentity = appIdentity;
        this.observation = observation; this.http = http; this.jobs = jobs;
        this.authority = new NativeProviderAuthority(engine, principalJournal, legacyJournal, journal, coordinator);
    }
    /** Call only while holding engine THEN coordinator; same native sources as runtime. */
    private Current reconcile() throws VaultFailure {
        return authority.reconcile();
    }
    @Override public long captureToken(String token) throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            reconcile(); activeTokenRead = null;
            return journal.captureToken(token);
        } }
    }
    static final class TokenRead {
        private final NativeProviderPrincipal principal;
        private final long engineRevision;
        private final NativeProviderJournal.TokenCursor cursor;
        private TokenRead(Current current, NativeProviderJournal.TokenCursor cursor) {
            principal = current.principal; engineRevision = current.revision; this.cursor = cursor;
        }
    }
    TokenRead beginTokenRead() throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            Current current = reconcile();
            activeTokenRead = new TokenRead(current, journal.tokenCursor()); return activeTokenRead;
        } }
    }
    long completeTokenRead(TokenRead expected, String token) throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            if (expected == null || activeTokenRead != expected) throw staleTokenRead();
            activeTokenRead = null; Current current = reconcile();
            boolean samePrincipal = expected.principal == null ? current.principal == null : expected.principal.same(current.principal);
            if (!samePrincipal || current.revision != expected.engineRevision || !expected.cursor.same(journal.tokenCursor())) throw staleTokenRead();
            return journal.captureToken(token);
        } }
    }
    void abandonTokenRead(TokenRead expected) {
        synchronized (engine) { synchronized (coordinator) { if (activeTokenRead == expected) activeTokenRead = null; } }
    }
    private static VaultFailure staleTokenRead() { return new VaultFailure("custodial_provider_token_read_stale"); }

    @Override public void receive(NativeProviderPayload payload) throws VaultFailure {
        // Capture native elapsed/boot at entry, not after waiting on a local storage lock.
        NativeProviderJournal.Observation received = observation.read();
        if (received == null || received.bounds != null) throw new VaultFailure("custodial_provider_clock_not_admitted");
        synchronized (engine) { synchronized (coordinator) {
            Current current = reconcile();
            if (current.principal == null) throw new VaultFailure("custodial_provider_waiting_native_principal");
            journal.recordArrival(current.principal, payload, received); // Unknown time is durably QUARANTINED.
        } }
    }
    @Override public void deletedMessages() throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) { reconcile(); journal.requestRecovery(); } }
    }
    @Override public void requestReconcile() throws VaultFailure {
        NativeProviderJobLifecycle.Result pending;
        synchronized (engine) { synchronized (coordinator) {
            pending = reconcile().principal == null ? NativeProviderJobLifecycle.Result.SUSPEND : NativeProviderJobLifecycle.Result.RETRY;
        } }
        NativeProviderJobSchedule.request(pending, jobs); // Quota failure never retires durable state.
    }

    /** statusOnly is an INTERNAL recovery choice, never accepted from the WebView. Register
     * retries are the same persisted operation/token, including after process death. */
    RegistrationResult register(NativeProviderHttp.Attempt attempt, boolean statusOnly) throws VaultFailure {
        return registerWithClock(attempt, statusOnly).status;
    }
    static final class ExchangeResult {
        final RegistrationResult status;
        final NativeProviderClockExchange.Settlement settlement;
        private ExchangeResult(RegistrationResult status, NativeProviderClockExchange.Settlement settlement) { this.status = status; this.settlement = settlement; }
    }
    /** Callable internal transport prerequisite. The result carries UNQUALIFIED
     * evidence only; no durable clock owner consumes it while runtime is suspended.
     * statusOnly=true refreshes the exact current confirmed registration as well. */
    ExchangeResult registerWithClock(NativeProviderHttp.Attempt attempt, boolean statusOnly) throws VaultFailure {
        if (attempt == null) throw new VaultFailure("custodial_provider_request_invalid");
        if (!registrationRunning.compareAndSet(false, true)) return new ExchangeResult(RegistrationResult.BUSY, null);
        Throwable failure = null;
        try {
            attempt.check(); NativeProviderJournal.Prepared prepared;
            synchronized (engine) { synchronized (coordinator) {
                Current current = reconcile();
                if (current.principal == null) return new ExchangeResult(RegistrationResult.WAITING_NATIVE_PRINCIPAL, null);
                try { prepared = journal.prepareRegistration(current.principal, appIdentity.read()); }
                catch (VaultFailure absent) {
                    if ("custodial_provider_fresh_native_token_required".equals(absent.code)) return new ExchangeResult(RegistrationResult.WAITING_NATIVE_TOKEN, null);
                    throw absent;
                }
                if (prepared.confirmed && !statusOnly) return new ExchangeResult(RegistrationResult.ALREADY_CONFIRMED, null);
            } }
            // Existing engine signs the exact typed raw bytes and checks native revision,
            // original principal and provider epoch again before durable confirmation.
            NativeProviderClockExchange.Settlement settlement = engine.registerNativeProvider(prepared, principalJournal, legacyJournal, journal, http, attempt, statusOnly);
            return new ExchangeResult(RegistrationResult.CONFIRMED, settlement);
        } catch (VaultFailure | RuntimeException rejected) {
            failure = rejected; throw rejected;
        } finally {
            try { synchronized (engine) { synchronized (coordinator) { reconcile(); } } }
            catch (VaultFailure | RuntimeException cleanup) {
                if (failure == null) throw cleanup;
                failure.addSuppressed(cleanup);
            }
            finally { registrationRunning.set(false); }
        }
    }
}
