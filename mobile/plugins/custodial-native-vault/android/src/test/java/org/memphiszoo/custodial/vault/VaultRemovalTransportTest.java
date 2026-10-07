package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import org.junit.Test;

/** Synthetic removal transport only. No provider, phone, or clock qualification. */
public final class VaultRemovalTransportTest {
    static final String OP = "44000000-0000-4000-8000-000000000001";
    static final String REMOVE = "44000000-0000-4000-8000-000000000002";
    static final String OTHER = "44000000-0000-4000-8000-000000000003";
    static final String DEVICE = "KIOSK_08";
    interface Hook { TerminalResult run(String operation, String device, char[] credential) throws Throwable; }
    interface Attempt { void run() throws Exception; }
    static void fails(String code, Attempt attempt) throws Exception {
        try { attempt.run(); fail("expected " + code); }
        catch (VaultFailure failure) { assertEquals(code, failure.code); }
    }
    static final class Fixture {
        final MemoryPersistence memory = new MemoryPersistence();
        final TestCipher cipher = new TestCipher();
        final MutableClock clock = new MutableClock(1_800_000_000_000L);
        final FakeTransport server = new FakeTransport(clock);
        final List<VaultEngine> engines = new ArrayList<>();
        final List<char[]> secrets = new ArrayList<>();
        final VaultPersistence persistence;
        final CredentialCipher recordingCipher;
        final EnrollmentTransport transport;
        final VaultEngine engine;
        volatile VaultSnapshot observed;
        volatile boolean failAfterDecrypt;
        volatile Hook hook = server::remove;
        Fixture() throws Exception {
            persistence = new VaultPersistence() {
                public VaultSnapshot load() throws VaultFailure { return observed != null ? observed : memory.load(); }
                public void commit(long revision, VaultSnapshot next) throws VaultFailure { memory.commit(revision, next); }
            };
            recordingCipher = new CredentialCipher() {
                public EncryptedSecret encrypt(char[] value) throws VaultFailure { return cipher.encrypt(value); }
                public char[] decrypt(EncryptedSecret value) throws VaultFailure {
                    char[] clear = cipher.decrypt(value); secrets.add(clear);
                    if (failAfterDecrypt) { failAfterDecrypt = false; memory.failLoads = 1; }
                    return clear;
                }
                public void destroyKey() throws VaultFailure { cipher.destroyKey(); }
            };
            transport = (EnrollmentTransport) Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(),
                new Class<?>[]{EnrollmentTransport.class}, (proxy, method, args) -> {
                    if (method.getName().equals("remove")) {
                        for (VaultEngine owner : engines) assertFalse("engine monitor absent", Thread.holdsLock(owner));
                        java.lang.reflect.Field registry = VaultEngine.class.getDeclaredField("REMOVAL_FLIGHTS");
                        registry.setAccessible(true); assertFalse("flight registry absent", Thread.holdsLock(registry.get(null)));
                        assertEquals(REMOVE, args[0]); assertEquals(DEVICE, args[1]);
                        assertEquals(VaultPhase.REMOVAL_REQUESTED, memory.current().phase);
                        return hook.run((String) args[0], (String) args[1], (char[]) args[2]);
                    }
                    try { return method.invoke(server, args); }
                    catch (InvocationTargetException failure) { throw failure.getCause(); }
                });
            engine = restart();
            engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
            engine.completeLocalBinding(OP); engine.confirmEnrollment(OP);
            secrets.clear();
        }
        VaultEngine restart() {
            VaultEngine value = new VaultEngine(persistence, recordingCipher, transport,
                new FakeLegacySource(), new TestSealGenerator(), clock);
            engines.add(value); return value;
        }
        void wiped() { for (char[] secret : secrets) assertArrayEquals(new char[secret.length], secret); }
        void retry() throws Exception {
            hook = server::remove; observed = null;
            assertTrue(restart().removeEnrollment(REMOVE, DEVICE).removed); wiped();
        }
    }
    static VaultSnapshot tombstone(VaultSnapshot state) throws Exception {
        return state.next(VaultPhase.REMOVAL_TOMBSTONE, SecretKind.NONE, null, state.operationId,
            state.deviceId, "", 0, null, EnrollmentMetadata.empty(), state.removalOperationId, "", false, "");
    }
    static VaultSnapshot replace(VaultSnapshot state, long revision, String operation, String device,
        EncryptedSecret secret, EnrollmentMetadata metadata, String removal) throws Exception {
        return new VaultSnapshot(revision, state.phase, state.secretKind, secret, operation, device,
            state.flow, state.expiresAtMillis, state.installation, metadata, removal, state.blockedReason,
            state.legacyHadBinding, state.legacySeal);
    }

    @Test public void pendingHttpReleasesEngineAndSingleflightRefusesSecondEngineOrOperation() throws Exception {
        Fixture f = new Fixture(); VaultEngine second = f.restart();
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        f.hook = (op, device, credential) -> {
            entered.countDown(); assertTrue(release.await(10, TimeUnit.SECONDS)); return f.server.remove(op, device, credential);
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<RemovalView> network = pool.submit(() -> f.engine.removeEnrollment(REMOVE, DEVICE));
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            Future<?> concurrent = pool.submit(() -> {
                assertEquals("REMOVAL_REQUESTED", f.engine.observeStateReadOnly().get("state"));
                fails("custodial_native_vault_concurrent_change", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
                fails("custodial_native_vault_concurrent_change", () -> second.removeEnrollment(REMOVE, DEVICE));
                fails("custodial_native_removal_conflict", () -> second.removeEnrollment(OTHER, DEVICE));
                fails("custodial_native_removal_conflict", () -> second.removeEnrollment(REMOVE, "KIOSK_09"));
                fails("custodial_native_removal_not_complete", () -> f.engine.finalizeRemoval(REMOVE));
                fails("custodial_native_enrollment_state_refused", () -> second.activateAssignedDevice(OTHER, DEVICE, "12345678".toCharArray()));
                assertEquals(0, f.cipher.destroyCalls); return null;
            });
            concurrent.get(3, TimeUnit.SECONDS);
            release.countDown(); assertTrue(network.get(5, TimeUnit.SECONDS).removed);
            assertEquals(1, f.server.removeCalls.get()); f.wiped();
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS)); }
    }

    @Test public void externalReentrantEngineMonitorFailsBeforeDurableIntentOrHttp() throws Exception {
        Fixture f = new Fixture(); VaultSnapshot before = f.memory.current();
        synchronized (f.engine) { fails("custodial_native_vault_concurrent_change", () -> f.engine.removeEnrollment(REMOVE, DEVICE)); }
        assertEquals(before, f.memory.current()); assertEquals(0, f.server.removeCalls.get()); f.retry();
    }
    @Test public void lostResponseRetriesOnlyOriginalDurableOperationAfterRestart() throws Exception {
        Fixture f = new Fixture(); f.server.loseRemoveAfterSuccess = 1;
        fails("custodial_native_network_unavailable", () -> f.engine.removeEnrollment(REMOVE, DEVICE)); f.wiped();
        VaultSnapshot pending = f.memory.current(); assertEquals(VaultPhase.REMOVAL_REQUESTED, pending.phase);
        fails("custodial_native_removal_conflict", () -> f.restart().removeEnrollment(OTHER, DEVICE));
        assertEquals(pending, f.memory.current()); assertTrue(f.restart().removeEnrollment(REMOVE, DEVICE).replayed);
        assertEquals(2, f.server.removeCalls.get()); f.wiped();
    }
    @Test public void intentFailureBeforeWriteNeverSendsAndReleasesFlight() throws Exception {
        Fixture f = new Fixture(); VaultSnapshot before = f.memory.current();
        f.memory.failBeforeCommits.add(f.memory.commitAttempts.get() + 1);
        fails("test_commit_failure", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
        assertEquals(before, f.memory.current()); assertEquals(0, f.server.removeCalls.get()); f.retry();
    }
    @Test public void intentWriteThenReadbackFailureUsesExactCommittedIntent() throws Exception {
        Fixture f = new Fixture(); f.memory.writeThenFailCommits.add(f.memory.commitAttempts.get() + 1);
        f.retry(); assertEquals(1, f.server.removeCalls.get());
    }
    @Test public void decryptFailureRetainsIntentAndReleasesFlight() throws Exception {
        Fixture f = new Fixture(); f.cipher.failDecrypts = 1;
        fails("test_decrypt_failure", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
        assertEquals(VaultPhase.REMOVAL_REQUESTED, f.memory.current().phase);
        assertEquals(0, f.server.removeCalls.get()); f.retry();
    }
    @Test public void captureReadFailureWipesBeforeAnyHttpAndKeepsOriginalIntent() throws Exception {
        Fixture f = new Fixture(); f.failAfterDecrypt = true;
        fails("test_load_failure", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
        f.wiped(); assertEquals(0, f.server.removeCalls.get()); f.retry();
    }
    @Test public void settlementReadFailureWipesAndOriginalReceiptCanBeReplayed() throws Exception {
        Fixture f = new Fixture(); f.hook = (op, device, credential) -> {
            TerminalResult result = f.server.remove(op, device, credential); f.memory.failLoads = 1; return result;
        };
        fails("test_load_failure", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
        f.wiped(); f.retry(); assertEquals(2, f.server.removeCalls.get());
    }
    @Test public void terminalCommitFailureBeforeWriteRetainsOriginalAttempt() throws Exception {
        Fixture f = new Fixture(); f.memory.failBeforeCommits.add(f.memory.commitAttempts.get() + 2);
        fails("test_commit_failure", () -> f.engine.removeEnrollment(REMOVE, DEVICE)); f.wiped();
        f.retry(); assertEquals(2, f.server.removeCalls.get());
    }
    @Test public void terminalCommitWriteThenFailureRecoversExactTombstoneWithoutResend() throws Exception {
        Fixture f = new Fixture(); f.memory.writeThenFailCommits.add(f.memory.commitAttempts.get() + 2);
        assertTrue(f.engine.removeEnrollment(REMOVE, DEVICE).removed); f.wiped();
        assertTrue(f.restart().removeEnrollment(REMOVE, DEVICE).replayed); assertEquals(1, f.server.removeCalls.get());
    }
    @Test public void malformedOrMissingTerminalResultNeverCommitsAndWipes() throws Exception {
        for (boolean missing : new boolean[]{false, true}) {
            Fixture f = new Fixture(); f.hook = (op, device, credential) -> missing ? null : new TerminalResult(OTHER, false);
            fails("custodial_native_invalid_enrollment_response", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
            assertEquals(VaultPhase.REMOVAL_REQUESTED, f.memory.current().phase); f.wiped(); f.retry();
        }
    }
    @Test public void uncheckedTransportFailureReleasesFlightAndWipes() throws Exception {
        Fixture f = new Fixture(); f.hook = (op, device, credential) -> { throw new IllegalStateException("synthetic"); };
        try { f.engine.removeEnrollment(REMOVE, DEVICE); fail(); } catch (IllegalStateException expected) { assertEquals("synthetic", expected.getMessage()); }
        f.wiped(); f.retry();
    }
    @Test public void interruptedTransportRetainsIntentWipesAndAllowsOriginalRetry() throws Exception {
        Fixture f = new Fixture(); CountDownLatch entered = new CountDownLatch(1);
        f.hook = (op, device, credential) -> {
            entered.countDown();
            try { new CountDownLatch(1).await(); throw new AssertionError(); }
            catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new VaultFailure("synthetic_interrupted", failure); }
        };
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> work = pool.submit(() -> { fails("synthetic_interrupted", () -> f.engine.removeEnrollment(REMOVE, DEVICE)); return null; });
            assertTrue(entered.await(5, TimeUnit.SECONDS)); work.cancel(true);
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS)); }
        f.wiped(); assertEquals(VaultPhase.REMOVAL_REQUESTED, f.memory.current().phase); f.retry();
    }
    @Test public void sameRevisionOrPhaseCannotReattributeChangedCredentialPrincipalOrOperation() throws Exception {
        for (int kind = 0; kind < 5; kind++) {
            Fixture f = new Fixture(); final int mutation = kind;
            f.hook = (op, device, credential) -> {
                VaultSnapshot original = f.memory.current();
                f.observed = replace(original, original.revision + (mutation == 0 ? 1 : 0),
                    mutation == 1 ? OTHER : original.operationId, original.deviceId,
                    mutation == 2 ? f.cipher.encrypt("other-synthetic-credential".toCharArray()) : original.secret,
                    mutation == 3 ? new EnrollmentMetadata("other", "", "", "", "other", "other") : original.metadata,
                    mutation == 4 ? OTHER : original.removalOperationId);
                return f.server.remove(op, device, credential);
            };
            fails("custodial_native_vault_concurrent_change", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
            assertEquals(VaultPhase.REMOVAL_REQUESTED, f.memory.current().phase); f.wiped(); f.retry();
        }
    }
    @Test public void exactOriginalSuccessorTombstoneIsIdempotent() throws Exception {
        Fixture f = new Fixture(); f.hook = (op, device, credential) -> {
            TerminalResult receipt = f.server.remove(op, device, credential); VaultSnapshot original = f.memory.current();
            f.memory.commit(original.revision, tombstone(original)); return receipt;
        };
        assertTrue(f.engine.removeEnrollment(REMOVE, DEVICE).replayed); f.wiped();
        int calls = f.server.removeCalls.get(); assertTrue(f.restart().removeEnrollment(REMOVE, DEVICE).replayed);
        assertEquals(calls, f.server.removeCalls.get());
    }
    @Test public void foreignDeviceLineageRevisionOrOperationTombstoneIsNotAcknowledged() throws Exception {
        for (int kind = 0; kind < 4; kind++) {
            Fixture f = new Fixture(); final int mutation = kind;
            f.hook = (op, device, credential) -> {
                VaultSnapshot terminal = tombstone(f.memory.current());
                f.observed = replace(terminal, terminal.revision + (mutation == 0 ? 1 : 0),
                    mutation == 1 ? OTHER : terminal.operationId, mutation == 2 ? "KIOSK_09" : terminal.deviceId,
                    null, terminal.metadata, mutation == 3 ? OTHER : terminal.removalOperationId);
                return f.server.remove(op, device, credential);
            };
            fails("custodial_native_vault_concurrent_change", () -> f.engine.removeEnrollment(REMOVE, DEVICE)); f.wiped(); f.retry();
        }
    }
    @Test public void sameRevisionDeviceAndInstallationChangesAreNotAdmitted() throws Exception {
        Fixture f = new Fixture(); f.hook = (op, device, credential) -> {
            VaultSnapshot s = f.memory.current();
            InstallationBinding binding = new InstallationBinding("KIOSK_09", s.installation.installationSeal,
                s.installation.enrolledAt, s.installation.migratedFromCredentialOnlyState, s.installation.enrollmentOperationId);
            f.observed = new VaultSnapshot(s.revision, s.phase, s.secretKind, s.secret, s.operationId,
                "KIOSK_09", s.flow, s.expiresAtMillis, binding, s.metadata, s.removalOperationId,
                s.blockedReason, s.legacyHadBinding, s.legacySeal);
            return f.server.remove(op, device, credential);
        };
        fails("custodial_native_vault_concurrent_change", () -> f.engine.removeEnrollment(REMOVE, DEVICE));
        f.wiped(); f.retry();
    }
    @Test public void removalFinalizationStillDeletesOnlyAfterOriginalTerminalReceipt() throws Exception {
        Fixture f = new Fixture(); f.engine.removeEnrollment(REMOVE, DEVICE); f.wiped();
        assertEquals(0, f.cipher.destroyCalls);
        fails("custodial_native_removal_not_complete", () -> f.engine.finalizeRemoval(OTHER));
        assertEquals(0, f.cipher.destroyCalls);
        assertEquals("EMPTY", f.engine.finalizeRemoval(REMOVE).get("state"));
        assertEquals(1, f.cipher.destroyCalls);
        assertEquals("EMPTY", f.restart().finalizeRemoval(REMOVE).get("state"));
        assertEquals(1, f.cipher.destroyCalls);
    }
}
