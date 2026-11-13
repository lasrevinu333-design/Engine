package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderFirebaseDispatchTest {
    static final class Runtime implements NativeProviderIngressRuntime {
        final List<String> trace = new ArrayList<>(); boolean failCommit, failSchedule;
        public long captureToken(String token) throws VaultFailure { trace.add("token"); commit(); return 1; }
        public void receive(NativeProviderPayload payload) throws VaultFailure { trace.add("receive"); commit(); }
        public void deletedMessages() throws VaultFailure { trace.add("deleted"); commit(); }
        public void requestReconcile() throws VaultFailure { trace.add("schedule"); if (failSchedule) throw new VaultFailure("synthetic_quota"); }
        void commit() throws VaultFailure { if (failCommit) throw new VaultFailure("synthetic_commit"); }
    }
    @Test public void tokenCommitPrecedesSchedulingAndLegacyForwarding() throws Exception {
        Runtime r = new Runtime(); NativeProviderFirebaseDispatch.token(r, "opaque", () -> r.trace.add("legacy"));
        assertEquals(List.of("token", "schedule", "legacy"), r.trace);
        r.trace.clear(); r.failSchedule = true; NativeProviderFirebaseDispatch.token(r, "opaque", () -> r.trace.add("legacy"));
        assertEquals(List.of("token", "schedule", "legacy"), r.trace);
    }
    @Test public void commitFailureNeverSchedulesOrForwardsToken() throws Exception {
        Runtime r = new Runtime(); r.failCommit = true;
        ProviderRecordStoreTest.failure("synthetic_commit", () -> NativeProviderFirebaseDispatch.token(r, "opaque", () -> r.trace.add("legacy")));
        assertEquals(List.of("token"), r.trace);
    }
    @Test public void unrelatedMessageAloneUsesCompatibilityPath() throws Exception {
        Runtime r = new Runtime(); NativeProviderFirebaseDispatch.message(r, null, null, true, Map.of("kind", "legacy"), () -> r.trace.add("legacy"));
        assertEquals(List.of("legacy"), r.trace);
    }
    @Test public void validProtectedMessageNeverForwardsAndSchedulesOnlyAfterCommit() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); Runtime r = new Runtime();
        NativeProviderFirebaseDispatch.message(r, NativeProviderPayloadTest.PROJECT, NativeProviderPayloadTest.PROJECT, false,
            NativeProviderPayloadTest.lunch(f.prepared), () -> r.trace.add("legacy"));
        assertEquals(List.of("receive", "schedule"), r.trace);
        r.trace.clear(); r.failCommit = true;
        ProviderRecordStoreTest.failure("synthetic_commit", () -> NativeProviderFirebaseDispatch.message(r,
            NativeProviderPayloadTest.PROJECT, NativeProviderPayloadTest.PROJECT, false, NativeProviderPayloadTest.lunch(f.prepared), () -> r.trace.add("legacy")));
        assertEquals(List.of("receive"), r.trace);
    }
    @Test public void malformedNotificationOrForeignSenderNeverFallThrough() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false);
        for (String fault : List.of("schema", "sender", "notification", "project")) {
            Runtime r = new Runtime(); Map<String, String> data = new java.util.TreeMap<>(NativeProviderPayloadTest.lunch(f.prepared));
            if (fault.equals("schema")) data.remove("schema");
            try {
                NativeProviderFirebaseDispatch.message(r, fault.equals("sender") ? "999999999999" : NativeProviderPayloadTest.PROJECT,
                    fault.equals("project") ? null : NativeProviderPayloadTest.PROJECT, fault.equals("notification"), data, () -> r.trace.add("legacy"));
                fail(fault);
            } catch (VaultFailure expected) { assertTrue(r.trace.isEmpty()); }
        }
    }
    @Test public void deletedMessageRecoveryIsDurableBeforeScheduling() throws Exception {
        Runtime r = new Runtime(); r.failSchedule = true; NativeProviderFirebaseDispatch.deleted(r);
        assertEquals(List.of("deleted", "schedule"), r.trace); r.trace.clear(); r.failCommit = true;
        ProviderRecordStoreTest.failure("synthetic_commit", () -> NativeProviderFirebaseDispatch.deleted(r)); assertEquals(List.of("deleted"), r.trace);
    }
    @Test public void hardSuspendedRuntimeRefusesAllNativeIngressWithoutCompatibilityFallback() throws Exception {
        List<String> trace = new ArrayList<>(); NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false);
        ProviderRecordStoreTest.failure("custodial_provider_runtime_not_admitted", () -> NativeProviderFirebaseDispatch.token(
            NativeProviderIngressRuntime.SUSPENDED, "opaque", () -> trace.add("legacy")));
        ProviderRecordStoreTest.failure("custodial_provider_runtime_not_admitted", () -> NativeProviderFirebaseDispatch.message(
            NativeProviderIngressRuntime.SUSPENDED, NativeProviderPayloadTest.PROJECT, NativeProviderPayloadTest.PROJECT, false,
            NativeProviderPayloadTest.lunch(f.prepared), () -> trace.add("legacy")));
        ProviderRecordStoreTest.failure("custodial_provider_runtime_not_admitted", () -> NativeProviderFirebaseDispatch.deleted(NativeProviderIngressRuntime.SUSPENDED));
        assertTrue(trace.isEmpty());
    }
}
