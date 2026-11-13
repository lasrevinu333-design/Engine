package org.memphiszoo.custodial.vault;

/** SDK-only ingress boundary, not a PluginMethod or enrollment authority. */
interface NativeProviderIngressRuntime {
    long captureToken(String token) throws VaultFailure;
    void receive(NativeProviderPayload payload) throws VaultFailure;
    void deletedMessages() throws VaultFailure;
    void requestReconcile() throws VaultFailure;

    NativeProviderIngressRuntime SUSPENDED = new NativeProviderIngressRuntime() {
        private VaultFailure denied() { return new VaultFailure("custodial_provider_runtime_not_admitted"); }
        @Override public long captureToken(String token) throws VaultFailure { throw denied(); }
        @Override public void receive(NativeProviderPayload payload) throws VaultFailure { throw denied(); }
        @Override public void deletedMessages() throws VaultFailure { throw denied(); }
        @Override public void requestReconcile() throws VaultFailure { throw denied(); }
    };
}
