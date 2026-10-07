package org.memphiszoo.custodial.vault;

/** System-job invocation ownership only. This object is not a worker or a timer.
 * The Android service must call these methods on its lifecycle thread and deliver
 * worker/deadline callbacks there. No journal receipt is created by completion. */
final class NativeProviderJobLifecycle {
    enum Result { DRAINED, RETRY, SUSPEND }
    interface Effects {
        /** Cancel only this invocation's deadline/executor; never another job. */
        void release(Object owner);
        /** Android JobService.jobFinished for the exact still-active parameters. */
        void finished(Object owner, boolean retry);
    }
    static final class Invocation {
        final NativeProviderJobBudget budget;
        final NativeProviderHttp.Attempt attempt;
        private final Object owner;
        private Invocation(Object owner, NativeProviderJobBudget.Clock clock) throws VaultFailure {
            this.owner = owner; budget = new NativeProviderJobBudget(clock); attempt = new NativeProviderHttp.Attempt(budget);
        }
    }
    private final Effects effects;
    private Invocation active;
    NativeProviderJobLifecycle(Effects effects) { this.effects = effects; }
    synchronized Invocation begin(Object exactParameters, NativeProviderJobBudget.Clock clock) throws VaultFailure {
        if (exactParameters == null || active != null) throw new VaultFailure("custodial_provider_job_already_active");
        active = new Invocation(exactParameters, clock); return active;
    }
    synchronized boolean owns(Invocation invocation) { return invocation != null && active == invocation; }

    /** Fence first, then disconnect and release. A stale callback cannot finish a successor. */
    synchronized boolean complete(Invocation invocation, Result result) {
        if (!owns(invocation) || result == null) return false;
        active = null;
        try { invocation.attempt.cancel(); }
        finally {
            try { effects.release(invocation.owner); }
            finally { effects.finished(invocation.owner, result == Result.RETRY); }
        }
        return true;
    }
    synchronized boolean deadline(Invocation invocation) { return complete(invocation, Result.RETRY); }

    /** onStopJob: system owns rescheduling; never call jobFinished after this fence.
     * pending is the durable work classification, not a successful HTTP return. */
    synchronized boolean stop(Object exactParameters, Result pending) {
        if (active == null || active.owner != exactParameters) return false;
        Invocation invocation = active; active = null;
        try { invocation.attempt.cancel(); } finally { effects.release(invocation.owner); }
        return pending == Result.RETRY;
    }
    synchronized void destroy() {
        if (active != null) stop(active.owner, Result.SUSPEND);
    }
}
