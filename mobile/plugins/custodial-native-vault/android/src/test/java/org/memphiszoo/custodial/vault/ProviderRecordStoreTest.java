package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import org.junit.Test;
import static org.junit.Assert.*;

public final class ProviderRecordStoreTest {
    private static final ProviderEnvelopeCrypto.Domain TOKEN = ProviderEnvelopeCrypto.Domain.TOKEN;
    private static final ProviderEnvelopeCrypto.Domain INBOX = ProviderEnvelopeCrypto.Domain.INBOX;
    private static final ProviderEnvelopeCrypto.Domain EVENT = ProviderEnvelopeCrypto.Domain.EVENT;
    static final class Memory implements ProviderRecordStore.Backend {
        Map<String, Object> raw = new HashMap<>();
        int commits;
        boolean reject, persistThenReject, alterReadback, throwRead;
        @Override public Map<String, ?> readAll() throws Exception {
            if (throwRead) throw new Exception("synthetic disk failure");
            return new HashMap<>(raw);
        }
        @Override public boolean replace(Map<String, String> next) {
            commits++;
            if (reject) return false;
            raw = new HashMap<>(next);
            if (alterReadback) raw.put("stray", "preserved corruption");
            return !persistThenReject;
        }
    }
    static final class Keys implements ProviderEnvelopeCrypto.Keys {
        SecretKey value;
        int creations;
        @Override public SecretKey existing() { return value; }
        @Override public SecretKey createInEmptyNamespace() throws Exception {
            creations++; value = KeyGenerator.getInstance("AES").generateKey(); return value;
        }
    }
    static final class Fixture {
        final Object lock = new Object();
        final Memory memory = new Memory();
        final Keys keys = new Keys();
        ProviderRecordStore store() {
            return new ProviderRecordStore(memory, new ProviderEnvelopeCrypto(keys, () -> memory.readAll().isEmpty(), lock), lock);
        }
    }
    static ProviderRecordStore.Key key(ProviderEnvelopeCrypto.Domain domain, String id) { return ProviderRecordStore.key(domain, id); }
    static Map<ProviderRecordStore.Key, char[]> values(ProviderRecordStore.Key key, String value) {
        Map<ProviderRecordStore.Key, char[]> result = new HashMap<>(); result.put(key, value.toCharArray()); return result;
    }
    interface Attempt { void run() throws Exception; }
    static void failure(String code, Attempt attempt) throws Exception {
        try { attempt.run(); fail("Expected " + code); } catch (VaultFailure error) { assertEquals(code, error.code); }
    }

    @Test public void emptyStartCreatesOnceAndRetainsKeyAfterLogicalEmpty() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore store = f.store();
        assertEquals(0, store.load().revision); assertEquals(1, f.keys.creations);
        ProviderRecordStore.Key token = key(TOKEN, "capture-1");
        store.commit(0, values(token, "synthetic-token"), Collections.emptySet());
        store.commit(1, Collections.emptyMap(), Collections.singleton(token));
        assertTrue(f.store().load().keys().isEmpty()); assertEquals(2, f.store().load().revision);
        assertFalse(f.memory.raw.isEmpty()); assertEquals(1, f.keys.creations);
    }
    @Test public void atomicInboxAndEventSurviveRestartWithoutPlaintext() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore.Key inbox = key(INBOX, "delivery-1"), event = key(EVENT, "received-1");
        Map<ProviderRecordStore.Key, char[]> writes = values(inbox, "synthetic immutable content");
        writes.put(event, "synthetic received event".toCharArray());
        f.store().commit(0, writes, Collections.emptySet());
        assertEquals(1, f.memory.commits); assertEquals(3, f.memory.raw.size());
        assertFalse(f.memory.raw.toString().contains("synthetic"));
        ProviderRecordStore.Snapshot restarted = f.store().load();
        assertEquals(1, restarted.revision); assertEquals(2, restarted.keys().size());
        assertArrayEquals(writes.get(inbox), restarted.read(inbox)); assertArrayEquals(writes.get(event), restarted.read(event));
    }
    @Test public void staleRevisionNeverWritesAndSnapshotsStayImmutable() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore store = f.store(); ProviderRecordStore.Snapshot before = store.load();
        store.commit(0, values(key(TOKEN, "a"), "a"), Collections.emptySet());
        Map<String, Object> saved = new HashMap<>(f.memory.raw);
        failure("custodial_provider_concurrent_change", () -> store.commit(0, values(key(TOKEN, "b"), "b"), Collections.emptySet()));
        assertEquals(saved, f.memory.raw); assertTrue(before.keys().isEmpty()); assertEquals(1, f.memory.commits);
    }
    @Test public void missingKeyAfterDataNeverRegeneratesOrClears() throws Exception {
        Fixture f = new Fixture(); f.store().commit(0, values(key(TOKEN, "a"), "retained"), Collections.emptySet());
        Map<String, Object> saved = new HashMap<>(f.memory.raw); f.keys.value = null;
        failure("custodial_provider_key_missing_preserved", () -> f.store().load());
        assertEquals(saved, f.memory.raw); assertEquals(1, f.keys.creations);
    }
    @Test public void unknownPreexistingPreferencePreventsFirstKeyCreation() throws Exception {
        Fixture f = new Fixture(); f.memory.raw.put("unknown", 7);
        failure("custodial_provider_key_missing_preserved", () -> f.store().load());
        assertEquals(0, f.keys.creations); assertEquals(7, f.memory.raw.get("unknown"));
    }
    @Test public void missingIndexOrMissingExtraMutatedRecordFailsWithoutWrite() throws Exception {
        for (String mutation : new String[]{"index", "record", "extra", "tamper", "type"}) {
            Fixture f = new Fixture(); ProviderRecordStore.Key k = key(INBOX, "a");
            f.store().commit(0, values(k, "keep"), Collections.emptySet());
            switch (mutation) {
                case "index": f.memory.raw.remove("index"); break;
                case "record": f.memory.raw.remove(k.storageName()); break;
                case "extra": f.memory.raw.put("TOKEN:stray", f.memory.raw.get(k.storageName())); break;
                case "tamper": f.memory.raw.put(k.storageName(), "00" + f.memory.raw.get(k.storageName())); break;
                case "type": f.memory.raw.put(k.storageName(), 1); break;
                default: throw new AssertionError();
            }
            Map<String, Object> saved = new HashMap<>(f.memory.raw);
            failure("custodial_provider_corrupt_preserved", () -> f.store().load());
            assertEquals(saved, f.memory.raw); assertEquals(1, f.memory.commits);
        }
    }
    @Test public void recordFromPriorRevisionCannotReplaceCurrentRecord() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore.Key k = key(TOKEN, "a");
        f.store().commit(0, values(k, "old"), Collections.emptySet()); Object old = f.memory.raw.get(k.storageName());
        f.store().commit(1, values(k, "new"), Collections.emptySet()); f.memory.raw.put(k.storageName(), old);
        failure("custodial_provider_corrupt_preserved", () -> f.store().load());
    }
    @Test public void commitFailureRetainsPreviousStateAndNoAcceptedSnapshot() throws Exception {
        Fixture f = new Fixture(); f.store().commit(0, values(key(TOKEN, "a"), "old"), Collections.emptySet());
        Map<String, Object> saved = new HashMap<>(f.memory.raw); f.memory.reject = true;
        failure("custodial_provider_commit_failed_preserved", () -> f.store().commit(1, values(key(TOKEN, "b"), "new"), Collections.emptySet()));
        assertEquals(saved, f.memory.raw); assertEquals(1, f.store().load().revision);
    }
    @Test public void ambiguousCommitPreservedAndDiscoveredByRestartNotBlindReplay() throws Exception {
        Fixture f = new Fixture(); f.memory.persistThenReject = true;
        failure("custodial_provider_commit_failed_preserved", () -> f.store().commit(0, values(key(EVENT, "a"), "event"), Collections.emptySet()));
        f.memory.persistThenReject = false;
        assertEquals(1, f.store().load().revision); assertEquals(1, f.store().load().keys().size());
        failure("custodial_provider_concurrent_change", () -> f.store().commit(0, Collections.emptyMap(), Collections.emptySet()));
    }
    @Test public void mismatchedReadbackFailsButDoesNotEraseUncertainBytes() throws Exception {
        Fixture f = new Fixture(); f.memory.alterReadback = true;
        failure("custodial_provider_readback_failed_preserved", () -> f.store().commit(0, values(key(EVENT, "a"), "event"), Collections.emptySet()));
        assertTrue(f.memory.raw.containsKey("EVENT:a")); assertEquals("preserved corruption", f.memory.raw.get("stray"));
    }
    @Test public void unavailableNamespaceDoesNotCreateKeyOrInventEmpty() throws Exception {
        Fixture f = new Fixture(); f.memory.throwRead = true;
        failure("custodial_provider_key_unavailable_preserved", () -> f.store().load());
        assertEquals(0, f.keys.creations); assertEquals(0, f.memory.commits);
    }
    @Test public void domainCapacitiesAndCombinedInboxQuarantineAreExact() throws Exception {
        ProviderEnvelopeCrypto.Domain[] domains = {ProviderEnvelopeCrypto.Domain.GENERATION, INBOX, EVENT, ProviderEnvelopeCrypto.Domain.TOMBSTONE};
        int[] limits = {32, 256, 1536, 1024};
        for (int d = 0; d < domains.length; d++) {
            Fixture f = new Fixture(); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
            for (int i = 0; i < limits[d]; i++) writes.put(key(domains[d], "r" + i), new char[]{'x'});
            f.store().commit(0, writes, Collections.emptySet());
            assertEquals(limits[d], f.store().load().keys().size());
            ProviderEnvelopeCrypto.Domain overflow = domains[d] == INBOX ? ProviderEnvelopeCrypto.Domain.QUARANTINE : domains[d];
            Map<String, Object> saved = new HashMap<>(f.memory.raw);
            failure("custodial_provider_capacity_preserved", () -> f.store().commit(1, values(key(overflow, "overflow"), "x"), Collections.emptySet()));
            assertEquals(saved, f.memory.raw); assertEquals(1, f.memory.commits);
        }
    }
    @Test public void byteCapacityPreservesRecordsAndReservedDiagnosticRemainsWritable() throws Exception {
        Fixture f = new Fixture(); Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>();
        char[] block = new char[ProviderEnvelopeCrypto.MAX_RECORD_BYTES]; Arrays.fill(block, 'x');
        for (int i = 0; i < 15; i++) writes.put(key(INBOX, "large" + i), block);
        f.store().commit(0, writes, Collections.emptySet());
        Map<String, Object> saved = new HashMap<>(f.memory.raw);
        Map<ProviderRecordStore.Key, char[]> extra = new HashMap<>(); extra.put(key(INBOX, "overflow"), block);
        failure("custodial_provider_capacity_preserved", () -> f.store().commit(1, extra, Collections.emptySet()));
        assertEquals(saved, f.memory.raw);
        f.store().commit(1, values(ProviderRecordStore.DIAGNOSTIC, "recovery-needed:capacity"), Collections.emptySet());
        assertEquals(16, f.store().load().keys().size());
        assertEquals("recovery-needed:capacity", new String(f.store().load().read(ProviderRecordStore.DIAGNOSTIC)));
    }
    @Test public void reservedDiagnosticCannotConsumeUnboundedExtraStorage() throws Exception {
        Fixture f = new Fixture(); char[] huge = new char[33 * 1024]; Arrays.fill(huge, 'x');
        Map<ProviderRecordStore.Key, char[]> writes = new HashMap<>(); writes.put(ProviderRecordStore.DIAGNOSTIC, huge);
        failure("custodial_provider_capacity_preserved", () -> f.store().commit(0, writes, Collections.emptySet()));
        assertEquals(0, f.memory.commits); assertTrue(f.memory.raw.isEmpty());
    }
    @Test public void deletionsRequirePresentExactKeyAndNoSimultaneousReplacement() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore.Key k = key(EVENT, "a");
        failure("custodial_provider_remove_unknown", () -> f.store().commit(0, Collections.emptyMap(), Collections.singleton(k)));
        failure("custodial_provider_transaction_invalid", () -> f.store().commit(0, values(k, "a"), Collections.singleton(k)));
        assertEquals(0, f.memory.commits);
    }
    @Test public void twoStoreInstancesCannotBothCommitSameRevision() throws Exception {
        Fixture f = new Fixture(); ProviderRecordStore one = f.store(), two = f.store();
        assertEquals(0, one.load().revision); assertEquals(0, two.load().revision);
        one.commit(0, values(key(EVENT, "a"), "a"), Collections.emptySet());
        failure("custodial_provider_concurrent_change", () -> two.commit(0, values(key(EVENT, "b"), "b"), Collections.emptySet()));
        assertEquals(1, two.load().keys().size());
    }
}
