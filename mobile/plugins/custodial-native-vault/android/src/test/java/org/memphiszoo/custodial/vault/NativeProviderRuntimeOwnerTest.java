package org.memphiszoo.custodial.vault;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual enrollment/principal/encrypted provider owners; synthetic storage, transport
 * and OS surface. These tests grant no clock profile or provider effect admission. */
public final class NativeProviderRuntimeOwnerTest {
    static final String OP = NativeProviderHttpTest.OP, RID = NativeProviderHttpTest.RID, DEVICE = NativeProviderHttpTest.DEVICE;
    @Test public void boundedOwnerLooksUpOriginalDecisionsBeforeRetryingExactlyThoseEvents() throws Exception {
        for(boolean legacy:new boolean[]{false,true}) {
            NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(legacy);
            NativeProviderHttpTest.admittedEvent(x.f);x.paths.clear();x.requests.clear();
            x.sync();
            int decision=x.paths.indexOf(NativeProviderEventDecisions.PATH),events=x.paths.indexOf("/employee-notifications-api/native-provider/events");
            assertTrue(decision>=0);assertEquals(decision+1,events);
            assertTrue(ProviderWireJson.same(x.requests.get(decision).getJSONArray("events"),x.requests.get(events).getJSONArray("events")));
            assertTrue(x.requests.get(decision).getJSONArray("events").length()<=16);
        }
    }
    @Test public void ambiguousDecisionNeverFallsBackToAdmissionAndSingleflightReleases() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderJournal.EventBatch original=NativeProviderHttpTest.admittedEvent(x.f);
        x.duringHttp=()->{if(x.paths.get(x.paths.size()-1).equals(NativeProviderEventDecisions.PATH))throw new java.io.IOException("synthetic loss");};
        ProviderRecordStoreTest.failure("custodial_provider_network_unavailable",x::sync);
        assertFalse(x.paths.contains("/employee-notifications-api/native-provider/events"));assertEquals(0,x.surface.shows);
        assertArrayEquals(original.body(),x.journal.pendingEvents(x.f.principal,16).body());
        x.duringHttp=null;x.sync();assertTrue(x.paths.contains("/employee-notifications-api/native-provider/events"));
    }
    @Test public void qualifiedProfileLossAfterLookupCannotAuthorizeOriginalRetryOrNewEffect() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderJournal.EventBatch original=NativeProviderHttpTest.admittedEvent(x.f);
        x.duringHttp=()->{if(x.paths.get(x.paths.size()-1).equals(NativeProviderEventDecisions.PATH))x.profile=null;};
        ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",x::sync);
        assertFalse(x.paths.contains("/employee-notifications-api/native-provider/events"));assertEquals(0,x.surface.shows);
        assertArrayEquals(original.body(),x.journal.pendingEvents(x.f.principal,16).body());
    }
    static final class Fixture {
        final NativeProviderHttpTest.Fixture f;
        final VaultEngine engine;
        final NativeProviderDisplayDriverTest.Surface surface = new NativeProviderDisplayDriverTest.Surface();
        NativeProviderRuntimeOwner owner;
        NativeProviderPayload payload;
        int gateCalls;
        boolean allowed = true;
        Fixture(boolean legacy) throws Exception {
            f = new NativeProviderHttpTest.Fixture(legacy); f.send(false, f.http());
            if (legacy) {
                // The old lineage fixture's FakeTransport has no enrollment row
                // for a migrated credential. Supply an exact synthetic removal
                // receipt while retaining the ACTUAL engine and protected snapshot.
                EnrollmentTransport transport = (EnrollmentTransport) Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(), new Class<?>[]{EnrollmentTransport.class}, (proxy, method, args) -> {
                    if (method.getName().equals("remove")) {
                        assertEquals(DEVICE, args[1]); assertEquals(NativeLegacyLineageJournalTest.OLD, new String((char[]) args[2]));
                        return new TerminalResult((String) args[0], false);
                    }
                    try { return method.invoke(f.legacy, args); } catch (InvocationTargetException failure) { throw failure.getCause(); }
                });
                engine = new VaultEngine(f.persistence, f.cipher, transport, f.legacy.legacy, f.legacy.seal, f.legacy.clock);
            } else engine = f.engine;
            payload = NativeProviderIngressTest.payload(f.prepared);
            f.provider.journal().recordArrival(f.principal, payload, NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 101, 7));
            owner = reconstruct();
        }
        NativeProviderRuntimeOwner reconstruct() {
            return new NativeProviderRuntimeOwner(engine, f.principalJournal, f.legacyJournal,
                f.provider.journal(), f.provider.storage.lock, surface);
        }
        NativeProviderRemovalCoordinator removal() {
            return new NativeProviderRemovalCoordinator(engine, new RemovalCoordinator(engine, (op, device) -> {
                assertFalse(Thread.holdsLock(engine)); assertFalse(Thread.holdsLock(f.provider.storage.lock));
                gateCalls++; return allowed;
            }), owner);
        }
        JSONObject meta() throws Exception { return f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal"); }
        JSONObject inbox() throws Exception { return f.provider.read(ProviderEnvelopeCrypto.Domain.INBOX, payload.recordId); }
        long events() throws Exception { return f.provider.storage.store().load().keys().stream().filter(k -> k.domain == ProviderEnvelopeCrypto.Domain.EVENT).count(); }
    }
    @Test public void bothLineagesShareExactNativeAuthorityWithoutClockOrEffects() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture x = new Fixture(legacy); int commits = x.f.provider.storage.memory.commits;
            x.owner.attach(this); x.owner.detach(this); x.owner.reconcile();
            Map<String,Object> status = x.owner.localStatus();
            assertEquals("SUSPENDED", status.get("state")); assertEquals(true, status.get("native_principal_available"));
            assertEquals("qualified_interval_effect_owner_required", status.get("reason"));
            assertEquals(commits, x.f.provider.storage.memory.commits); assertEquals(0, x.surface.shows);
            assertEquals(1, x.events()); assertFalse(status.toString().contains(x.f.principal.digest));
        }
    }
    @Test public void canceledNativePresenceDoesNotRetireActiveRecordsOrDestroyAnyKey() throws Exception {
        Fixture x = new Fixture(false); x.allowed = false;
        Map<String,Object> before = new HashMap<>(x.f.provider.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_native_removal_cancelled", () -> x.removal().remove(RID, DEVICE));
        assertEquals(1, x.gateCalls); assertEquals(before, x.f.provider.storage.memory.raw);
        assertEquals("AVAILABLE", x.meta().getString("availability")); assertEquals(0, x.f.cipher.destroyCalls);
        assertEquals(true, x.f.engine.getState().get("active"));
    }
    @Test public void originalRecordsFenceBeforeEnrollmentKeyDeletionAndSurviveReconstruction() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture x = new Fixture(legacy); Object providerKey = x.f.provider.storage.keys.value;
            String originalPrincipal = NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest;
            x.removal().remove(RID, DEVICE);
            assertEquals("REMOVED", x.meta().getString("availability"));
            assertEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
            assertTrue(x.inbox().getBoolean("os_cancel_pending")); assertEquals(0, x.f.cipher.destroyCalls);
            x.owner = x.reconstruct(); x.removal().finalizeRemoval(RID);
            assertEquals(1, x.f.cipher.destroyCalls); assertSame(providerKey, x.f.provider.storage.keys.value);
            assertEquals(originalPrincipal, NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest); assertEquals(1, x.events());
            assertEquals("EMPTY", x.f.engine.getState().get("state"));
            assertTrue(x.owner.reconcileLocalEffects()); assertEquals(0, x.surface.shows);
            assertEquals(java.util.List.of("mz-provider:" + x.payload.recordId), x.surface.tags);
        }
    }
    @Test public void durableFenceReadbackFailureBlocksFinalizationAndPreservesRetry() throws Exception {
        for (String failure : new String[]{"reject", "ambiguous", "read"}) {
            Fixture x = new Fixture(false); x.f.engine.removeEnrollment(RID, DEVICE);
            if (failure.equals("read")) x.f.provider.storage.memory.throwRead = true;
            else if (failure.equals("ambiguous")) x.f.provider.storage.memory.persistThenReject = true;
            else x.f.provider.storage.memory.reject = true;
            try { x.removal().finalizeRemoval(RID); fail(failure); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
            assertEquals(0, x.f.cipher.destroyCalls); assertEquals("REMOVAL_TOMBSTONE", x.f.engine.getState().get("state"));
            x.f.provider.storage.memory.throwRead = false; x.f.provider.storage.memory.persistThenReject = false; x.f.provider.storage.memory.reject = false;
            x.owner = x.reconstruct(); x.removal().finalizeRemoval(RID); assertEquals(1, x.f.cipher.destroyCalls);
            assertEquals("REMOVED", x.meta().getString("availability")); assertEquals(1, x.events());
        }
    }
    @Test public void failedRemovalKeepsItsOriginalErrorAndAddsFenceFailureWithoutPretendingSuccess() throws Exception {
        Fixture x = new Fixture(false); x.allowed = false; x.f.provider.storage.memory.throwRead = true;
        try { x.removal().remove(RID, DEVICE); fail(); }
        catch (VaultFailure expected) {
            assertEquals("custodial_native_removal_cancelled", expected.code); assertEquals(1, expected.getSuppressed().length);
        }
        assertEquals(0, x.f.cipher.destroyCalls); assertEquals(true, x.f.engine.getState().get("active"));
    }
    @Test public void nativeUnavailabilityPreservesOriginalRecordsRatherThanDeclaringRemoval() throws Exception {
        Fixture x = new Fixture(false); x.f.persistence.failLoads = 1;
        try { x.owner.reconcile(); fail(); } catch (VaultFailure expected) { assertEquals("test_load_failure", expected.code); }
        assertEquals("UNAVAILABLE", x.meta().getString("availability"));
        assertNotEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
        x.owner.reconcile(); assertEquals("AVAILABLE", x.meta().getString("availability"));
        assertEquals(1, x.events()); assertEquals(0, x.surface.shows);
    }
    @Test public void assignmentChangeWithoutVaultRevisionRetiresOriginalRecipient() throws Exception {
        Fixture x = new Fixture(false); long revision = x.f.persistence.current().revision;
        new NativePrincipalJournalTest().capture(x.f.principalJournal, x.f.engine.getState(), new NativePrincipalJournalTest().data()
            .put("credential_id", x.f.principal.json().get("credential_id")).put("assignment_epoch", 5));
        x.owner.reconcile(); assertEquals(revision, x.f.persistence.current().revision);
        assertEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
        assertEquals(x.f.principal.digest, NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest); assertEquals(1, x.events());
    }
    @Test public void failedExactCancellationSurvivesRestartAndNeverShowsOrCancelsUnrelatedTags() throws Exception {
        Fixture x = new Fixture(false); x.removal().remove(RID, DEVICE); x.removal().finalizeRemoval(RID);
        x.surface.active = NativeProviderDisplayDriver.Active.MATCH; x.surface.cancelWorks = false;
        ProviderRecordStoreTest.failure("custodial_provider_os_cancel_unconfirmed", () -> x.owner.reconcileLocalEffects());
        assertTrue(x.inbox().getBoolean("os_cancel_pending")); x.owner = x.reconstruct(); x.surface.cancelWorks = true;
        assertTrue(x.owner.reconcileLocalEffects()); assertFalse(x.inbox().getBoolean("os_cancel_pending"));
        assertEquals(2, x.surface.cancellations); assertEquals(0, x.surface.shows); assertEquals(1, x.events());
        for (String tag : x.surface.tags) assertEquals("mz-provider:" + x.payload.recordId, tag);
    }
    @Test public void authorityRejectsWrongLockOwnershipBeforeAnyJournalMutation() throws Exception {
        Fixture x = new Fixture(false);
        NativeProviderAuthority authority = new NativeProviderAuthority(x.f.engine, x.f.principalJournal, x.f.legacyJournal, x.f.provider.journal(), x.f.provider.storage.lock);
        int commits = x.f.provider.storage.memory.commits;
        ProviderRecordStoreTest.failure("custodial_provider_lock_owner_required", authority::reconcile);
        synchronized (x.f.engine) { ProviderRecordStoreTest.failure("custodial_provider_lock_owner_required", authority::reconcile); }
        assertEquals(commits, x.f.provider.storage.memory.commits);
    }
    @Test public void lostRemovalResponseFencesDurableIntentAndRetriesOriginalOperationWithoutReprompt() throws Exception {
        MutableClock clock = new MutableClock(NativeProviderHttpTest.NOW); FakeTransport transport = new FakeTransport(clock);
        MemoryPersistence persistence = new MemoryPersistence(); TestCipher cipher = new TestCipher();
        NativeProviderJournalTest.Fixture provider = new NativeProviderJournalTest.Fixture();
        VaultEngine[] engineRef = new VaultEngine[1];
        EnrollmentTransport guarded = (EnrollmentTransport) Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(), new Class<?>[]{EnrollmentTransport.class}, (proxy, method, args) -> {
            if (method.getName().equals("remove")) {
                // Capture/send/settle removes the inherited engine network lock;
                // the provider wrapper must not introduce a second one.
                assertFalse(Thread.holdsLock(engineRef[0])); assertFalse(Thread.holdsLock(provider.storage.lock));
            }
            try { return method.invoke(transport, args); } catch (InvocationTargetException failure) { throw failure.getCause(); }
        });
        VaultEngine engine = new VaultEngine(persistence, cipher, guarded, new FakeLegacySource(), new TestSealGenerator(), clock); engineRef[0] = engine;
        engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray()); engine.completeLocalBinding(OP); engine.confirmEnrollment(OP);
        NativePrincipalJournal principals = new NativePrincipalJournal(new NativePrincipalJournalTest.Memory());
        new NativePrincipalJournalTest().capture(principals, engine.getState(), new NativePrincipalJournalTest().data().put("credential_id", engine.getState().get("active_credential_id")));
        NativeLegacyLineageJournal legacy = new NativeLegacyLineageJournal(new NativeLegacyLineageJournalTest.Store());
        NativeProviderRuntimeOwner owner = new NativeProviderRuntimeOwner(engine, principals, legacy, provider.journal(), provider.storage.lock, new NativeProviderDisplayDriverTest.Surface());
        owner.reconcile(); provider.journal().captureToken("synthetic-only");
        int[] gates = {0}; RemovalCoordinator original = new RemovalCoordinator(engine, (op, device) -> { gates[0]++; return true; });
        NativeProviderRemovalCoordinator removal = new NativeProviderRemovalCoordinator(engine, original, owner);
        transport.loseRemoveAfterSuccess = 1;
        ProviderRecordStoreTest.failure("custodial_native_network_unavailable", () -> removal.remove(RID, DEVICE));
        assertEquals("REMOVAL_REQUESTED", engine.getState().get("state"));
        assertEquals("REMOVED", provider.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal").getString("availability"));
        ProviderRecordStoreTest.failure("custodial_native_removal_conflict", () -> removal.remove(OP, DEVICE));
        removal.remove(RID, DEVICE); removal.finalizeRemoval(RID);
        assertEquals(1, gates[0]); assertEquals(2, transport.removeCalls.get()); assertEquals(1, cipher.destroyCalls);
    }
}
