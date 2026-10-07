package org.memphiszoo.custodial.vault;

/** Native-only component boundary. No setter, reflection, bridge or preference enables it.
 * Activation requires the reviewed provider clock, journal/removal fence, transport and
 * presentation owners together. Component registration alone supplies none of those. */
interface NativeProviderComponentRuntime {
    /** Nonblocking native admission classification. Never returns DRAINED for unknown state. */
    NativeProviderJobLifecycle.Result pendingWork();
    /** Work runs only under the supplied cancellable invocation and its budget. */
    NativeProviderJobLifecycle.Result synchronize(NativeProviderJobLifecycle.Invocation invocation) throws VaultFailure;
    /** Bounded local commit/readback only; preserves original journal identity; no HTTP. */
    void applyAction(NativeProviderActionIntent action) throws VaultFailure;
    /** Revalidate original pending Open under engine -> coordinator ownership immediately
     * before invoking the same-app launch. Never authorizes navigation from Intent extras. */
    void openCommitted(NativeProviderActionIntent action, Runnable launchMain) throws VaultFailure;

    NativeProviderComponentRuntime SUSPENDED = new NativeProviderComponentRuntime() {
        @Override public NativeProviderJobLifecycle.Result pendingWork() { return NativeProviderJobLifecycle.Result.SUSPEND; }
        @Override public NativeProviderJobLifecycle.Result synchronize(NativeProviderJobLifecycle.Invocation invocation) {
            return NativeProviderJobLifecycle.Result.SUSPEND;
        }
        @Override public void applyAction(NativeProviderActionIntent action) throws VaultFailure { throw unavailable(); }
        @Override public void openCommitted(NativeProviderActionIntent action, Runnable launchMain) throws VaultFailure { throw unavailable(); }
        private VaultFailure unavailable() { return new VaultFailure("custodial_provider_runtime_not_admitted"); }
    };
}
