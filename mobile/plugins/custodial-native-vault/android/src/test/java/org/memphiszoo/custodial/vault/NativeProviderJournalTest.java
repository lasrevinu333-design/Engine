package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Registration-only journal proof using the EXISTING actual V1/V2 native journal fixtures.
 * No authenticated registration result, Firebase, Android process, OS or backend proof. */
public final class NativeProviderJournalTest {
    static NativeProviderAppIdentity app() throws Exception { return NativeProviderAppIdentityTest.identity(53); }
    static NativeProviderPrincipal v1() throws Exception {
        NativePrincipalJournalTest fixture = new NativePrincipalJournalTest(); NativePrincipalJournalTest.Memory memory = new NativePrincipalJournalTest.Memory();
        NativePrincipalJournal journal = new NativePrincipalJournal(memory);
        Map<String, Object> state = fixture.state(); fixture.capture(journal, state, fixture.data());
        return NativeProviderPrincipal.fromNativeJournal(journal.readFor(state));
    }
    static NativeProviderPrincipal v2() throws Exception {
        NativeLegacyLineageJournalTest.Fixture fixture = new NativeLegacyLineageJournalTest.Fixture(true);
        fixture.activate(NativeLegacyLineageJournalTest.OP); fixture.finish(NativeLegacyLineageJournalTest.OP);
        return NativeProviderPrincipal.fromNativeJournal(fixture.engine().readLegacyPrincipal(fixture.journal()));
    }
    static final class Fixture {
        final ProviderRecordStoreTest.Fixture storage = new ProviderRecordStoreTest.Fixture();
        NativeProviderJournal journal() { return new NativeProviderJournal(storage.store(), storage.lock); }
        JSONObject read(ProviderEnvelopeCrypto.Domain domain, String id) throws Exception {
            char[] value = storage.store().load().read(ProviderRecordStore.key(domain, id));
            try { return new JSONObject(new String(value)); } finally { Arrays.fill(value, '\0'); }
        }
    }
    static void failure(String code, ProviderRecordStoreTest.Attempt operation) throws Exception { ProviderRecordStoreTest.failure(code, operation); }

    @Test public void bothRealNativePrincipalShapesBindWholeOriginalIdentity() throws Exception {
        for (NativeProviderPrincipal principal : new NativeProviderPrincipal[]{v1(), v2()}) {
            Fixture f = new Fixture(); f.journal().captureToken("synthetic:token"); f.journal().observeActivePrincipal(principal);
            NativeProviderJournal.Prepared prepared = f.journal().prepareRegistration(principal, app());
            assertEquals(principal.digest, prepared.principalDigest);
            assertTrue(NativeLegacyLineageJournal.same(principal.json(), prepared.json().getJSONObject("principal")));
            assertArrayEquals("synthetic:token".toCharArray(), f.journal().tokenForPrepared(principal, prepared));
            assertEquals("PREPARED_QUARANTINE", prepared.json().getString("state"));
        }
    }
    @Test public void originalPrincipalReorderingIsStableButEveryFieldIsBound() throws Exception {
        for (NativeProviderPrincipal original : new NativeProviderPrincipal[]{v1(), v2()}) {
            JSONObject source = original.json(); JSONObject reordered = new JSONObject();
            java.util.List<String> names = new java.util.ArrayList<>(); source.keys().forEachRemaining(names::add); Collections.reverse(names);
            for (String field : names) reordered.put(field, source.get(field));
            assertTrue(original.same(NativeProviderPrincipal.fromNativeJournal(reordered)));
            for (String field : names) {
                JSONObject changed = original.json(); Object value = changed.get(field);
                switch (field) {
                    case "schema_version": changed.put(field, "invalid"); break;
                    case "device_id": changed.put(field, "KIOSK_09"); break;
                    case "assignment_epoch": changed.put(field, ((Number) value).longValue() + 1); break;
                    case "enrolled_at": changed.put(field, "2026-07-31T21:52:04.123456Z"); break;
                    case "installation_seal": changed.put(field, value + "different"); break;
                    case "legacy_binding_kind": changed.put(field, NativeLegacyLineageJournal.CONFIRMED); break;
                    default: changed.put(field, field.endsWith("sha256") ? "f".repeat(64) : "99000000-0000-4000-8000-000000000001");
                }
                try { assertFalse(field, original.same(NativeProviderPrincipal.fromNativeJournal(changed))); }
                catch (VaultFailure invalid) { assertEquals("custodial_provider_principal_invalid", invalid.code); }
            }
        }
    }
    @Test public void reducedBrowserTupleWrongTypesAndUnknownFieldsAreNotFullPrincipal() throws Exception {
        JSONObject full = v1().json();
        for (JSONObject invalid : new JSONObject[]{new JSONObject().put("device_id", "KIOSK_08"),
            new JSONObject(full.toString()).put("assignment_epoch", "4"), new JSONObject(full.toString()).put("assignment_epoch", 4.0),
            new JSONObject(full.toString()).put("extra", true), new JSONObject(full.toString()).put("device_id", "kiosk08"),
            new JSONObject(full.toString()).put("installation_seal", " short ")})
            failure("custodial_provider_principal_invalid", () -> NativeProviderPrincipal.fromNativeJournal(invalid));
    }
    @Test public void tokenWithoutPrincipalSurvivesButCannotPrepare() throws Exception {
        Fixture f = new Fixture(); assertEquals(1, f.journal().captureToken("synthetic-token")); f.journal().observeRemoved();
        assertEquals("UNBOUND_TOKEN", f.read(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-1").getString("state"));
        failure("custodial_provider_waiting_native_principal", () -> f.journal().prepareRegistration(v1(), app()));
        assertEquals(2, f.storage.store().load().keys().size());
    }
    @Test public void sameTokenObservationCoalescesButRotationKeepsOriginalPendingOperation() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal principal = v1();
        f.journal().observeActivePrincipal(principal); assertEquals(1, f.journal().captureToken("old-token"));
        assertEquals(1, f.journal().captureToken("old-token")); NativeProviderJournal.Prepared original = f.journal().prepareRegistration(principal, app());
        assertEquals(2, f.journal().captureToken("new-token")); NativeProviderJournal.Prepared replay = f.journal().prepareRegistration(principal, app());
        assertEquals(original.operationId, replay.operationId); assertEquals(original.generationId, replay.generationId); assertEquals(1, replay.captureSequence);
        assertArrayEquals("old-token".toCharArray(), f.journal().tokenForPrepared(principal, original));
        assertEquals("new-token", f.read(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-2").getString("token"));
    }
    @Test public void lostPrepareReadbackRecoversSameOperationFromEncryptedStore() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal principal = v2(); f.journal().captureToken("token"); f.journal().observeActivePrincipal(principal);
        f.storage.memory.persistThenReject = true;
        failure("custodial_provider_commit_failed_preserved", () -> f.journal().prepareRegistration(principal, app()));
        f.storage.memory.persistThenReject = false;
        String generation = f.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal").getString("pending_generation");
        String operation = f.read(ProviderEnvelopeCrypto.Domain.GENERATION, generation).getString("operation_id");
        NativeProviderJournal.Prepared recovered = f.journal().prepareRegistration(principal, app());
        assertEquals(generation, recovered.generationId); assertEquals(operation, recovered.operationId);
        assertEquals(3, f.storage.memory.commits);
    }
    @Test public void transientAbsenceDeniesTransportButPreservesOriginalOperation() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal principal = v1(); f.journal().captureToken("token"); f.journal().observeActivePrincipal(principal);
        NativeProviderJournal.Prepared original = f.journal().prepareRegistration(principal, app());
        f.journal().observeUnavailable();
        failure("custodial_provider_waiting_native_principal", () -> f.journal().tokenForPrepared(principal, original));
        failure("custodial_provider_waiting_native_principal", () -> f.journal().prepareRegistration(principal, app()));
        f.journal().observeActivePrincipal(principal);
        assertEquals(original.operationId, f.journal().prepareRegistration(principal, app()).operationId);
        assertEquals(3, f.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal").getLong("invalidation_epoch"));
    }
    @Test public void principalAToBToANeverRevivesOrRebindsOldOperation() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal a = v1(), b = NativeProviderPrincipal.fromNativeJournal(a.json().put("assignment_epoch", 5));
        f.journal().captureToken("same-token"); f.journal().observeActivePrincipal(a); NativeProviderJournal.Prepared old = f.journal().prepareRegistration(a, app());
        f.journal().observeActivePrincipal(b);
        assertEquals("REVOKED_OR_FOREIGN", f.read(ProviderEnvelopeCrypto.Domain.GENERATION, old.generationId).getString("state"));
        assertTrue(NativeLegacyLineageJournal.same(a.json(), f.read(ProviderEnvelopeCrypto.Domain.GENERATION, old.generationId).getJSONObject("principal")));
        failure("custodial_provider_fresh_native_token_required", () -> f.journal().prepareRegistration(b, app()));
        f.journal().observeActivePrincipal(a);
        failure("custodial_provider_fresh_native_token_required", () -> f.journal().prepareRegistration(a, app()));
        f.journal().captureToken("same-token"); NativeProviderJournal.Prepared fresh = f.journal().prepareRegistration(a, app());
        assertNotEquals(old.operationId, fresh.operationId); assertNotEquals(old.generationId, fresh.generationId);
        failure("custodial_provider_operation_stale", () -> f.journal().tokenForPrepared(a, old));
    }
    @Test public void removalIsIdempotentRetainsBytesAndRequiresNewTokenObservation() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal principal = v2(); f.journal().captureToken("token"); f.journal().observeActivePrincipal(principal);
        NativeProviderJournal.Prepared old = f.journal().prepareRegistration(principal, app()); f.journal().observeRemoved();
        int commits = f.storage.memory.commits; f.journal().observeRemoved(); assertEquals(commits, f.storage.memory.commits);
        JSONObject saved = f.read(ProviderEnvelopeCrypto.Domain.GENERATION, old.generationId);
        assertEquals("REVOKED_OR_FOREIGN", saved.getString("state")); assertEquals(old.principalDigest, saved.getString("principal_digest"));
        assertEquals("token", f.read(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-1").getString("token"));
        f.journal().observeActivePrincipal(principal);
        failure("custodial_provider_fresh_native_token_required", () -> f.journal().prepareRegistration(principal, app()));
        assertEquals(2, f.journal().captureToken("token")); assertNotEquals(old.generationId, f.journal().prepareRegistration(principal, app()).generationId);
    }
    @Test public void observationBetweenRemovalAndNewPrincipalCannotBecomeItsToken() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal p = v1(); f.journal().captureToken("old"); f.journal().observeActivePrincipal(p);
        f.journal().prepareRegistration(p, app()); f.journal().observeRemoved(); f.journal().captureToken("between");
        f.journal().observeActivePrincipal(p);
        failure("custodial_provider_fresh_native_token_required", () -> f.journal().prepareRegistration(p, app()));
        assertEquals("REVOKED_OR_FOREIGN", f.read(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-2").getString("state"));
        assertEquals(3, f.journal().captureToken("between")); assertEquals(3, f.journal().prepareRegistration(p, app()).captureSequence);
    }
    @Test public void opaqueTokenBytesArePreservedAndInvalidUtf8IsRejectedBeforeWrites() throws Exception {
        Fixture f = new Fixture(); String token = "synthetic+opaque/=é";
        f.journal().captureToken(token); assertEquals(token, f.read(ProviderEnvelopeCrypto.Domain.TOKEN, "capture-1").getString("token"));
        int commits = f.storage.memory.commits;
        for (String invalid : new String[]{"", "\uD800", "has\nnewline", "x".repeat(4097), "é".repeat(2049)})
            failure("custodial_provider_token_invalid", () -> f.journal().captureToken(invalid));
        assertEquals(commits, f.storage.memory.commits);
    }
    @Test public void failedRemovalCommitNeverReportsFenceComplete() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal p = v1(); f.journal().captureToken("t"); f.journal().observeActivePrincipal(p);
        f.journal().prepareRegistration(p, app()); Map<String, Object> before = new HashMap<>(f.storage.memory.raw); f.storage.memory.reject = true;
        failure("custodial_provider_commit_failed_preserved", () -> f.journal().observeRemoved());
        assertEquals(before, f.storage.memory.raw);
    }
    @Test public void corruptRetainedInboxStillRefusesRemovalWithoutChangingBytes() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal p = v1(); f.journal().observeActivePrincipal(p);
        ProviderRecordStore store = f.storage.store(); store.commit(store.load().revision,
            ProviderRecordStoreTest.values(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.INBOX, "future"), "future retained inbox"), Collections.emptySet());
        Map<String, Object> before = new HashMap<>(f.storage.memory.raw);
        failure("custodial_provider_journal_corrupt_preserved", () -> f.journal().observeRemoved()); assertEquals(before, f.storage.memory.raw);
    }
    @Test public void exposedPreparedJsonCannotMutateOriginalOperation() throws Exception {
        Fixture f = new Fixture(); NativeProviderPrincipal p = v1(); f.journal().captureToken("t"); f.journal().observeActivePrincipal(p);
        NativeProviderJournal.Prepared prepared = f.journal().prepareRegistration(p, app()); prepared.json().put("operation_id", "forged");
        assertEquals(prepared.operationId, f.journal().prepareRegistration(p, app()).operationId);
        assertArrayEquals(new char[]{'t'}, f.journal().tokenForPrepared(p, prepared));
    }
}
