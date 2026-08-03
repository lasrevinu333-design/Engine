package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public final class AuthorizedSessionOperationJournalTest {
    private static final String KEY = "11111111-1111-4111-8111-111111111111";
    private static final String OTHER_KEY = "22222222-2222-4222-8222-222222222222";
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";
    private static final long NOW = 1_800_000_000_000L;

    @Test
    public void exactOperationSurvivesRestartUntilAuthenticatedResponseCompletes() throws Exception {
        MemoryAuthorizedSessionOperationJournal storage = new MemoryAuthorizedSessionOperationJournal();
        SessionOperationRecord first = storage.acquire(KEY, DEVICE, NOW);
        SessionOperationRecord afterRestart = storage.acquire(KEY, DEVICE, NOW + 299_000L);
        assertEquals(first.operationId, afterRestart.operationId);
        assertEquals(1, storage.generations.get());

        storage.complete(first.operationId);
        assertNull(storage.load());
        SessionOperationRecord next = storage.acquire(KEY, DEVICE, NOW + 301_000L);
        assertFalse(first.operationId.equals(next.operationId));
        assertEquals(2, storage.generations.get());
    }

    @Test
    public void keyRotationAtomicallyReplacesObsoleteOperation() throws Exception {
        MemoryAuthorizedSessionOperationJournal storage = new MemoryAuthorizedSessionOperationJournal();
        SessionOperationRecord prior = storage.acquire(KEY, DEVICE, NOW);
        SessionOperationRecord replacement = storage.acquire(OTHER_KEY, DEVICE, NOW + 1L);
        assertFalse(prior.operationId.equals(replacement.operationId));
        assertEquals(OTHER_KEY, replacement.keyOperationId);
        assertEquals(replacement.operationId, storage.load().operationId);
        storage.clearKeyOperation(KEY);
        assertEquals(replacement.operationId, storage.load().operationId);
        storage.clearKeyOperation(OTHER_KEY);
        assertNull(storage.load());
    }

    @Test
    public void commitFailuresNeverReportOperationComplete() throws Exception {
        MemoryAuthorizedSessionOperationJournal storage = new MemoryAuthorizedSessionOperationJournal();
        SessionOperationRecord operation = storage.acquire(KEY, DEVICE, NOW);
        storage.failCompleteBefore = true;
        expect("test_session_journal_commit_failed", () -> storage.complete(operation.operationId));
        assertEquals(operation.operationId, storage.load().operationId);

        storage.failCompleteAfter = true;
        expect("test_session_journal_readback_failed", () -> storage.complete(operation.operationId));
        assertNull(storage.load());
        // A process restart safely creates a fresh operation after the durable
        // delete, while an undelivered delete preserves the original UUID.
        assertTrue(storage.acquire(KEY, DEVICE, NOW + 1L).operationId.length() == 36);
    }

    @Test
    public void malformedDurableRecordIsRejectedInsteadOfReset() throws Exception {
        expect("manager_v2_session_journal_corrupt", () -> SessionOperationRecord.fromJson(
            "{\"schema_version\":1,\"operation_id\":\"bad\"}"
        ));
    }

    private static void expect(String code, Throwing action) throws Exception {
        try {
            action.run();
            fail("Expected " + code);
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
        }
    }

    @FunctionalInterface
    private interface Throwing { void run() throws Exception; }
}

/** Process-recreatable test persistence with explicit commit-boundary faults. */
final class MemoryAuthorizedSessionOperationJournal implements AuthorizedSessionOperationJournal {
    SessionOperationRecord record;
    final AtomicInteger generations = new AtomicInteger();
    boolean failAcquireBefore;
    boolean failCompleteBefore;
    boolean failCompleteAfter;

    @Override
    public synchronized SessionOperationRecord acquire(
        String keyOperationId,
        String deviceId,
        long nowMillis
    ) throws VaultFailure {
        String key = VaultValidation.operationId(keyOperationId);
        String device = VaultValidation.deviceId(deviceId);
        if (record != null && record.matches(key, device)) return record;
        if (failAcquireBefore) {
            failAcquireBefore = false;
            throw new VaultFailure("test_session_journal_commit_failed");
        }
        record = new SessionOperationRecord(
            UUID.randomUUID().toString().toLowerCase(Locale.ROOT), key, device, nowMillis
        );
        generations.incrementAndGet();
        return record;
    }

    @Override
    public synchronized void complete(String operationId) throws VaultFailure {
        remove(operationId);
    }

    @Override
    public synchronized void abandon(String operationId) throws VaultFailure {
        remove(operationId);
    }

    @Override
    public synchronized void clearKeyOperation(String keyOperationId) throws VaultFailure {
        String key = VaultValidation.operationId(keyOperationId);
        if (record != null && record.keyOperationId.equals(key)) record = null;
    }

    @Override
    public synchronized SessionOperationRecord load() { return record; }

    private void remove(String operationId) throws VaultFailure {
        String operation = VaultValidation.operationId(operationId);
        if (record == null) return;
        if (!record.operationId.equals(operation)) throw new VaultFailure("manager_v2_session_journal_conflict");
        if (failCompleteBefore) {
            failCompleteBefore = false;
            throw new VaultFailure("test_session_journal_commit_failed");
        }
        record = null;
        if (failCompleteAfter) {
            failCompleteAfter = false;
            throw new VaultFailure("test_session_journal_readback_failed");
        }
    }
}
