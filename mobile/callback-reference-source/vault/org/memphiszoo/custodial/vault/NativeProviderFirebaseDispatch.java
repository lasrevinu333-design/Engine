package org.memphiszoo.custodial.vault;

import java.util.Map;

/** Ordering shared by real SDK entry points and focused tests. No JS-authoritative ingress. */
final class NativeProviderFirebaseDispatch {
    static void token(NativeProviderIngressRuntime runtime, String token, Runnable compatibility) throws VaultFailure {
        runtime.captureToken(token); // Exact encrypted commit/readback must succeed BEFORE plugin forwarding.
        try { runtime.requestReconcile(); } catch (VaultFailure schedulingUnavailable) { /* Token remains durable. */ }
        compatibility.run();
    }
    static void message(NativeProviderIngressRuntime runtime, String sdkSender, String projectNumber,
        boolean notification, Map<String, ?> data, Runnable compatibility) throws VaultFailure {
        if (!NativeProviderPayload.protectedTraffic(data)) { compatibility.run(); return; }
        // Protected malformed/suspended/foreign traffic never falls through to the old plugin.
        runtime.receive(NativeProviderPayload.fromFcm(sdkSender, projectNumber, notification, data));
        try { runtime.requestReconcile(); } catch (VaultFailure schedulingUnavailable) { /* Ingress remains durable. */ }
    }
    static void deleted(NativeProviderIngressRuntime runtime) throws VaultFailure {
        runtime.deletedMessages();
        try { runtime.requestReconcile(); } catch (VaultFailure schedulingUnavailable) { /* Recovery epoch is durable. */ }
    }
    private NativeProviderFirebaseDispatch() {}
}
