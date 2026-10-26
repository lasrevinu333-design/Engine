package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

/** Newly affected owning removal paths only. Synthetic persistence, transport
 * and cipher; no Android, manager session, custody ACK or successful removal. */
public final class NativeOriginalRemovalAdmissionBarrierTest {
    static final String OP = "44000000-0000-4000-8000-000000000001";
    static final String REMOVE = "44000000-0000-4000-8000-000000000002";
    static final String DEVICE = "KIOSK_08";
    static final String REFUSED = "custodial_native_removal_inventory_admission_required";
    interface Attempt { void run() throws Exception; }

    static void refused(Attempt attempt) throws Exception {
        try { attempt.run(); fail("legacy removal must require original inventory admission"); }
        catch (VaultFailure failure) { assertEquals(REFUSED, failure.code); }
    }
    static final class Fixture {
        final MemoryPersistence memory = new MemoryPersistence();
        final TestCipher cipher = new TestCipher();
        final MutableClock clock = new MutableClock(1_800_000_000_000L);
        final FakeTransport transport = new FakeTransport(clock);
        final FakeLegacySource legacy;
        final AtomicInteger loads = new AtomicInteger(), decrypts = new AtomicInteger(), legacyReads = new AtomicInteger();
        final VaultPersistence persistence = new VaultPersistence() {
            public VaultSnapshot load() throws VaultFailure { loads.incrementAndGet(); return memory.load(); }
            public void commit(long revision, VaultSnapshot next) throws VaultFailure { memory.commit(revision, next); }
        };
        final CredentialCipher recordingCipher = new CredentialCipher() {
            public EncryptedSecret encrypt(char[] value) throws VaultFailure { return cipher.encrypt(value); }
            public EncryptedSecret encryptWithExistingKey(char[] value) throws VaultFailure { return cipher.encryptWithExistingKey(value); }
            public char[] decrypt(EncryptedSecret value) throws VaultFailure { decrypts.incrementAndGet(); return cipher.decrypt(value); }
            public void destroyKey() throws VaultFailure { cipher.destroyKey(); }
        };
        final LegacyVaultSource recordingLegacy = new LegacyVaultSource() {
            public LegacyMaterial read() throws VaultFailure { legacyReads.incrementAndGet(); return legacy.read(); }
            public void cleanup() throws VaultFailure { legacy.cleanup(); }
            public void cleanupAfterRead(LegacyMaterial original) throws VaultFailure { legacy.cleanupAfterRead(original); }
            public boolean isClean() { return legacy.isClean(); }
        };
        VaultEngine engine;
        Fixture(boolean active) throws Exception {
            legacy = active ? new FakeLegacySource() : new FakeLegacySource("synthetic-retained-legacy".toCharArray(), null, "");
            engine = restart();
            if (active) {
                engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
                engine.completeLocalBinding(OP); engine.confirmEnrollment(OP);
            }
        }
        VaultEngine restart() {
            return new VaultEngine(persistence, recordingCipher, transport, recordingLegacy, new TestSealGenerator(), clock);
        }
        void phase(VaultPhase phase) throws Exception {
            VaultSnapshot old = memory.current(); boolean retained = phase == VaultPhase.REMOVAL_REQUESTED;
            VaultSnapshot next = old.next(phase, retained ? SecretKind.DEVICE_CREDENTIAL : SecretKind.NONE,
                retained ? old.secret : null, phase == VaultPhase.EMPTY ? "" : old.operationId,
                old.deviceId, "", 0, retained ? old.installation : null,
                retained ? old.metadata : EnrollmentMetadata.empty(), REMOVE, "", false, "");
            memory.commit(old.revision, next);
        }
        int[] counters() { return new int[]{loads.get(), decrypts.get(), legacyReads.get(), memory.commitAttempts.get(),
            transport.removeCalls.get(), cipher.destroyCalls, legacy.cleanupCalls, cipher.existingKeyEncryptCalls}; }
        void unchanged(VaultSnapshot before, int[] counts) {
            assertEquals("original credential/identity/revision/phase retained", before, memory.current());
            assertArrayEquals("no load/recovery/decrypt/commit/HTTP/key/provider authority", counts, counters());
        }
    }

    @Test public void activeOriginalIsRefusedBeforeIntentHttpOrCredentialDiscard() throws Exception {
        Fixture f = new Fixture(true); VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> f.engine.removeEnrollment(REMOVE, DEVICE)); f.unchanged(before, counts);
        char[] clear = f.cipher.decrypt(before.secret);
        try { assertTrue("retained original remains readable with the same synthetic key", clear.length > 0); }
        finally { Arrays.fill(clear, '\0'); }
    }
    @Test public void oldDurableRemovalIntentCannotResendAfterRestart() throws Exception {
        Fixture f = new Fixture(true); f.phase(VaultPhase.REMOVAL_REQUESTED);
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> f.restart().removeEnrollment(REMOVE, DEVICE));
        refused(() -> f.restart().removeEnrollment(REMOVE, DEVICE)); f.unchanged(before, counts);
    }
    @Test public void historicalTombstoneDoesNotMintAReplayedRemovalAcknowledgement() throws Exception {
        Fixture f = new Fixture(true); f.phase(VaultPhase.REMOVAL_TOMBSTONE);
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> f.engine.removeEnrollment(REMOVE, DEVICE)); f.unchanged(before, counts);
    }
    @Test public void historicalTombstoneCannotReachEvenAPermissiveSyntheticKeyDestroyer() throws Exception {
        Fixture f = new Fixture(true); f.phase(VaultPhase.REMOVAL_TOMBSTONE);
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> f.engine.finalizeRemoval(REMOVE)); f.unchanged(before, counts);
    }
    @Test public void historicalEmptyOperationCannotMintFinalizerSuccess() throws Exception {
        Fixture f = new Fixture(true); f.phase(VaultPhase.EMPTY);
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> f.restart().finalizeRemoval(REMOVE)); f.unchanged(before, counts);
    }
    @Test public void presenceCoordinatorCannotRecoverLegacyOrPromptForMissingInventoryAuthority() throws Exception {
        Fixture f = new Fixture(false); int[] prompts = {0};
        RemovalCoordinator coordinator = new RemovalCoordinator(f.engine, (op, device) -> { prompts[0]++; return true; });
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> coordinator.remove(REMOVE, DEVICE));
        f.unchanged(before, counts); assertEquals(0, prompts[0]); assertFalse(f.legacy.isClean());
    }
    @Test public void providerWrapperCannotReconcileOrCancelInFinallyAfterUnadmittedCall() throws Exception {
        Fixture f = new Fixture(true); int[] prompts = {0}, providerEffects = {0};
        RemovalCoordinator presence = new RemovalCoordinator(f.engine, (op, device) -> { prompts[0]++; return true; });
        NativeProviderRemovalCoordinator coordinator = new NativeProviderRemovalCoordinator(f.engine, presence, () -> providerEffects[0]++);
        VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        refused(() -> coordinator.remove(REMOVE, DEVICE));
        refused(() -> coordinator.finalizeRemoval(REMOVE));
        f.unchanged(before, counts); assertEquals(0, prompts[0]); assertEquals(0, providerEffects[0]);
    }
    @Test public void existingMalformedAndReentrantGuardsRemainBeforeEffects() throws Exception {
        Fixture f = new Fixture(true); VaultSnapshot before = f.memory.current(); int[] counts = f.counters();
        try { f.engine.removeEnrollment("invalid", DEVICE); fail(); }
        catch (VaultFailure failure) { assertNotEquals(REFUSED, failure.code); }
        synchronized (f.engine) {
            try { f.engine.removeEnrollment(REMOVE, DEVICE); fail(); }
            catch (VaultFailure failure) { assertEquals("custodial_native_vault_concurrent_change", failure.code); }
        }
        f.unchanged(before, counts);
    }
}
