package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual vault/journals/typed raw HTTP owner; SDK/connection/time are synthetic.
 * Runtime factory stays suspended. No token/provider acceptance or phone evidence. */
public final class NativeProviderRegistrationCoordinatorTest {
    static final class Fixture {
        final NativeProviderHttpTest.Fixture f;
        final Object lock;
        final NativeProviderJobLifecycleTest.Jobs jobs = new NativeProviderJobLifecycleTest.Jobs();
        NativeProviderRegistrationCoordinator owner;
        NativeProviderJournal.Observation observation = new NativeProviderJournal.Observation(null, 100, 7);
        Fixture(boolean legacy) throws Exception {
            f = new NativeProviderHttpTest.Fixture(legacy); lock = f.provider.storage.lock;
            owner = make(f.http());
        }
        NativeProviderRegistrationCoordinator make(NativeProviderHttp http) throws Exception {
            NativeProviderAppIdentity identity = NativeProviderJournalTest.app();
            return new NativeProviderRegistrationCoordinator(f.engine, f.principalJournal, f.legacyJournal, f.provider.journal(), lock,
                () -> identity, () -> observation, http, jobs);
        }
        JSONObject meta() throws Exception { return f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal"); }
        void changeAssignment() throws Exception {
            new NativePrincipalJournalTest().capture(f.principalJournal, f.engine.getState(), new NativePrincipalJournalTest().data()
                .put("credential_id", f.principal.json().get("credential_id")).put("assignment_epoch", 5));
        }
    }
    @Test public void bothNativeLineagesUseTypedRawBodyAndDoNotRepeatConfirmedToken() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture x = new Fixture(legacy);
            assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, x.owner.register(x.f.attempt, false));
            NativeProviderHttpTest.Connection c = x.f.connection;
            assertEquals("/employee-notifications-api/native-provider/register", c.getURL().getPath());
            JSONObject wire = ProviderWireJson.object(c.sent.toByteArray(), 65536);
            assertEquals(x.f.prepared.generationId, wire.getString("generation_id"));
            assertEquals("synthetic:opaque/token+é", wire.getString("token"));
            char[] credential = x.f.cipher.decrypt(x.f.persistence.current().secret);
            try {
                Map<String, String> headers = NativeAttestation.requestHeaders(new AuthorizedRequest(c.getURL().getPath(), "POST", Map.of(), c.sent.toByteArray()),
                    NativeProviderHttpTest.DEVICE, credential, NativeProviderHttpTest.RID, NativeProviderHttpTest.NOW);
                assertEquals(headers.get("X-Memphis-Native-Request-Attestation"), c.sentHeaders.get("X-Memphis-Native-Request-Attestation"));
            } finally { Arrays.fill(credential, '\0'); }
            assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.ALREADY_CONFIRMED, x.owner.register(new NativeProviderHttp.Attempt(), false));
            assertEquals(1, x.f.opened); assertTrue(c.disconnects > 0);
        }
    }
    @Test public void processReconstructionAndNewTokenPreserveOriginalPendingOperationForStatus() throws Exception {
        Fixture x = new Fixture(false); x.owner.captureToken("rotated-native-token");
        x.owner = x.make(x.f.http());
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, x.owner.register(x.f.attempt, true));
        JSONObject wire = ProviderWireJson.object(x.f.connection.sent.toByteArray(), 65536);
        assertEquals("/employee-notifications-api/native-provider/status", x.f.connection.getURL().getPath());
        assertEquals(x.f.prepared.operationId, wire.getString("operation_id")); assertFalse(wire.has("token"));
        NativeProviderJournal.Prepared next = x.f.provider.journal().prepareRegistration(x.f.principal, NativeProviderJournalTest.app());
        assertNotEquals(x.f.prepared.generationId, next.generationId);
        assertEquals(NativeProviderPrincipal.hash("rotated-native-token"), next.tokenDigest);
    }
    @Test public void transportTimeoutKeepsOriginalPendingOperationAndReleasesBusyOwner() throws Exception {
        Fixture x = new Fixture(false); final boolean[] timeout = {true};
        byte[] response = x.f.response();
        x.owner = x.make(new NativeProviderHttp(url -> {
            x.f.opened++; x.f.connection = new NativeProviderHttpTest.Connection(url, response);
            x.f.connection.timeout = timeout[0]; return x.f.connection;
        }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID, NativeProviderHttpTest.readings()));
        try { x.owner.register(new NativeProviderHttp.Attempt(), false); fail(); }
        catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
        assertEquals(x.f.prepared.generationId, x.meta().getString("pending_generation"));
        assertTrue(x.f.connection.disconnects > 0); timeout[0] = false;
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, x.owner.register(new NativeProviderHttp.Attempt(), true));
    }
    @Test public void noStorageMonitorSpansHttpAndParallelRegistrationCannotDuplicateRequest() throws Exception {
        Fixture x = new Fixture(false); x.f.onResponse = () -> {
            assertFalse(Thread.holdsLock(x.f.engine)); assertFalse(Thread.holdsLock(x.lock));
            assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.BUSY, x.owner.register(new NativeProviderHttp.Attempt(), false));
        }; x.owner = x.make(x.f.http());
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, x.owner.register(x.f.attempt, false));
        assertEquals(1, x.f.opened);
    }
    @Test public void removalDuringHttpCannotConfirmAndPersistsOriginalIdentityRetirement() throws Exception {
        Fixture x = new Fixture(false); x.f.onResponse = () -> x.f.engine.removeEnrollment(NativeProviderHttpTest.RID, NativeProviderHttpTest.DEVICE);
        x.owner = x.make(x.f.http());
        ProviderRecordStoreTest.failure("custodial_native_vault_concurrent_change", () -> x.owner.register(x.f.attempt, false));
        assertEquals("REMOVED", x.meta().getString("availability"));
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.WAITING_NATIVE_PRINCIPAL, x.owner.register(new NativeProviderHttp.Attempt(), false));
        assertEquals(1, x.f.opened);
    }
    @Test public void assignmentChangeWithoutEngineRevisionCannotRebindPendingRegistration() throws Exception {
        Fixture x = new Fixture(false); x.f.onResponse = x::changeAssignment; x.owner = x.make(x.f.http());
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> x.owner.register(x.f.attempt, false));
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.WAITING_NATIVE_TOKEN, x.owner.register(new NativeProviderHttp.Attempt(), false));
        assertEquals(1, x.f.opened);
    }
    @Test public void nativeTokenReadLeaseIsSingleUseAndCannotOvertakeNewSdkCallback() throws Exception {
        Fixture x = new Fixture(false); NativeProviderRegistrationCoordinator.TokenRead read = x.owner.beginTokenRead();
        long current = x.owner.captureToken("newer-callback");
        ProviderRecordStoreTest.failure("custodial_provider_token_read_stale", () -> x.owner.completeTokenRead(read, "older-read"));
        assertEquals(current, x.meta().getLong("capture_sequence"));
        NativeProviderRegistrationCoordinator.TokenRead fresh = x.owner.beginTokenRead();
        assertEquals(current + 1, x.owner.completeTokenRead(fresh, "current-read"));
        ProviderRecordStoreTest.failure("custodial_provider_token_read_stale", () -> x.owner.completeTokenRead(fresh, "again"));
    }
    @Test public void ambiguousEncryptedTokenCommitNeverForwardsUntilExactRetryReadback() throws Exception {
        Fixture x = new Fixture(false); final int[] forwarded = {0};
        x.f.provider.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> NativeProviderFirebaseDispatch.token(
            x.owner, "actual-native-callback", () -> forwarded[0]++));
        assertEquals(0, forwarded[0]); assertEquals(0, x.jobs.scheduled);
        x.f.provider.storage.memory.persistThenReject = false;
        long sequence = x.meta().getLong("capture_sequence");
        NativeProviderFirebaseDispatch.token(x.owner, "actual-native-callback", () -> forwarded[0]++);
        assertEquals(sequence, x.meta().getLong("capture_sequence")); assertEquals(1, forwarded[0]);
        assertFalse(x.f.provider.storage.memory.raw.toString().contains("actual-native-callback"));
    }
    @Test public void readOnlyCursorNeverCommitsAndMalformedTokenNeverReplacesExistingCapture() throws Exception {
        Fixture x = new Fixture(false); int commits = x.f.provider.storage.memory.commits;
        x.f.provider.journal().tokenCursor(); assertEquals(commits, x.f.provider.storage.memory.commits);
        long sequence = x.meta().getLong("capture_sequence");
        ProviderRecordStoreTest.failure("custodial_provider_token_invalid", () -> x.owner.captureToken("bad\nvalue"));
        assertEquals(sequence, x.meta().getLong("capture_sequence")); assertEquals(commits, x.f.provider.storage.memory.commits);
    }
    @Test public void tokenReadAbandonmentAndSuccessorUseObjectIdentity() throws Exception {
        Fixture x = new Fixture(false); NativeProviderRegistrationCoordinator.TokenRead old = x.owner.beginTokenRead(), fresh = x.owner.beginTokenRead();
        x.owner.abandonTokenRead(old);
        ProviderRecordStoreTest.failure("custodial_provider_token_read_stale", () -> x.owner.completeTokenRead(old, "old"));
        x.owner.completeTokenRead(fresh, "new");
        NativeProviderRegistrationCoordinator.TokenRead abandoned = x.owner.beginTokenRead(); x.owner.abandonTokenRead(abandoned);
        ProviderRecordStoreTest.failure("custodial_provider_token_read_stale", () -> x.owner.completeTokenRead(abandoned, "late"));
    }
    @Test public void tokenReadCannotSurviveRemovalAssignmentChangeOrJournalEpochRoundtrip() throws Exception {
        for (String transition : new String[]{"remove", "assignment", "unavailable", "token"}) {
            Fixture x = new Fixture(false); NativeProviderRegistrationCoordinator.TokenRead read = x.owner.beginTokenRead();
            if (transition.equals("remove")) x.f.engine.removeEnrollment(NativeProviderHttpTest.RID, NativeProviderHttpTest.DEVICE);
            else if (transition.equals("assignment")) x.changeAssignment();
            else if (transition.equals("unavailable")) { x.f.provider.journal().observeUnavailable(); x.f.provider.journal().observeActivePrincipal(x.f.principal); }
            else x.f.provider.journal().captureToken("other-native-owner");
            long before = x.meta().getLong("capture_sequence");
            ProviderRecordStoreTest.failure("custodial_provider_token_read_stale", () -> x.owner.completeTokenRead(read, "old-read"));
            assertEquals(before, x.meta().getLong("capture_sequence"));
        }
    }
    @Test public void unknownClockIngressOnlyQuarantinesAndNeverCreatesReceivedReceipt() throws Exception {
        Fixture x = new Fixture(false); x.owner.register(x.f.attempt, false);
        NativeProviderPayload payload = NativeProviderIngressTest.payload(x.f.prepared);
        x.owner.receive(payload); x.owner.receive(payload);
        JSONObject stored = x.f.provider.read(ProviderEnvelopeCrypto.Domain.QUARANTINE, payload.recordId);
        assertEquals("QUARANTINED", stored.getString("state"));
        assertTrue(stored.getJSONObject("received_observation").isNull("authenticated_at"));
        assertEquals(0, x.f.provider.storage.store().load().keys().stream().filter(key -> key.domain == ProviderEnvelopeCrypto.Domain.EVENT).count());
        assertEquals(0, x.f.provider.storage.store().load().keys().stream().filter(key -> key.domain == ProviderEnvelopeCrypto.Domain.INBOX).count());
    }
    @Test public void thisStageRejectsClaimedQualifiedClockBeforeAnyIngressWrite() throws Exception {
        Fixture x = new Fixture(false); x.observation = NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 100, 7);
        Map<String, Object> before = new java.util.HashMap<>(x.f.provider.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_clock_not_admitted", () -> x.owner.receive(NativeProviderIngressTest.payload(x.f.prepared)));
        assertEquals(before, x.f.provider.storage.memory.raw);
    }
    @Test public void recoveryAndSchedulerQuotaFailuresPreserveWorkWithoutDuplicateJobs() throws Exception {
        Fixture x = new Fixture(false); long before = x.meta().getLong("recovery_epoch");
        x.owner.deletedMessages(); assertEquals(before + 1, x.meta().getLong("recovery_epoch"));
        x.jobs.accepted = false; x.owner.requestReconcile(); assertEquals(1, x.jobs.scheduled);
        assertEquals(before + 1, x.meta().getLong("recovery_epoch"));
        x.jobs.accepted = true; x.owner.requestReconcile(); x.owner.requestReconcile(); assertEquals(2, x.jobs.scheduled);
        x.f.engine.removeEnrollment(NativeProviderHttpTest.RID, NativeProviderHttpTest.DEVICE); x.owner.requestReconcile();
        assertEquals(2, x.jobs.scheduled);
    }
    @Test public void canceledAttemptPerformsNoNetworkAndDoesNotLeakBusyLease() throws Exception {
        Fixture x = new Fixture(false); x.f.attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", () -> x.owner.register(x.f.attempt, false));
        assertEquals(0, x.f.opened);
        assertEquals(NativeProviderRegistrationCoordinator.RegistrationResult.CONFIRMED, x.owner.register(new NativeProviderHttp.Attempt(), false));
    }
}
