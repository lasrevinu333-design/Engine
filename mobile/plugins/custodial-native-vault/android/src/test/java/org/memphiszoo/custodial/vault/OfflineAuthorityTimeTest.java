package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

public final class OfflineAuthorityTimeTest {
    private static final String DEVICE = "KIOSK_02";
    private static final String SNAPSHOT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String SESSION = "22222222-2222-4222-8222-222222222222";

    @Test
    public void timestampsUseServerAnchorAndElapsedRealtimeNotAdjustableWallClock() throws Exception {
        MemoryStore store = new MemoryStore();
        MutableMonotonicClock clock = new MutableMonotonicClock(1000L, 7);
        OfflineAuthorityTime time = new OfflineAuthorityTime(store, clock);
        time.acceptSnapshot(DEVICE, SNAPSHOT, "2026-08-13T12:00:00.000Z", "2026-08-13T12:10:00.000Z");

        clock.elapsed = 2_500L;
        clock.wallClockMillis = 0L; // Deliberately nonsensical: this field is never consulted.
        String started = time.beginOccurrence(DEVICE, "TETM", SESSION, SNAPSHOT);
        assertEquals("2026-08-13T12:00:01.500Z", started);

        clock.elapsed = 5_250L;
        clock.wallClockMillis = Long.MAX_VALUE;
        String completed = time.completeOccurrence(DEVICE, "TETM", SESSION, started);
        assertEquals("2026-08-13T12:00:04.250Z", completed);

        clock.elapsed = 500_000L;
        assertEquals("2026-08-13T12:00:04.250Z", time.completeOccurrence(DEVICE, "TETM", SESSION, started));
    }

    @Test
    public void rebootOrElapsedRollbackFailsClosedAndPreservesOccurrenceForRecovery() throws Exception {
        MemoryStore store = new MemoryStore();
        MutableMonotonicClock clock = new MutableMonotonicClock(1_000L, 7);
        OfflineAuthorityTime time = new OfflineAuthorityTime(store, clock);
        time.acceptSnapshot(DEVICE, SNAPSHOT, "2026-08-13T12:00:00.000Z", "2026-08-13T12:10:00.000Z");
        clock.elapsed = 2_000L;
        String started = time.beginOccurrence(DEVICE, "TETM", SESSION, SNAPSHOT);

        clock.elapsed = 100L;
        clock.boot = 8;
        expectCode("custodial_native_completion_recovery_required", () -> time.completeOccurrence(DEVICE, "TETM", SESSION, started));
        assertEquals(started, store.occurrences.get(SESSION).startedAt);
        assertEquals("", store.occurrences.get(SESSION).completedAt);
        expectCode("custodial_native_offline_anchor_refused", () -> time.beginOccurrence(
            DEVICE,
            "TETM",
            "33333333-3333-4333-8333-333333333333",
            SNAPSHOT
        ));
    }

    @Test
    public void snapshotMismatchAndExpiryCannotProduceATimestamp() throws Exception {
        MemoryStore store = new MemoryStore();
        MutableMonotonicClock clock = new MutableMonotonicClock(1_000L, 7);
        OfflineAuthorityTime time = new OfflineAuthorityTime(store, clock);
        time.acceptSnapshot(DEVICE, SNAPSHOT, "2026-08-13T12:00:00.000Z", "2026-08-13T12:00:02.000Z");
        expectCode("custodial_native_offline_anchor_refused", () -> time.beginOccurrence(
            DEVICE,
            "TETM",
            SESSION,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        ));
        clock.elapsed = 3_001L;
        expectCode("custodial_native_offline_anchor_expired", () -> time.beginOccurrence(DEVICE, "TETM", SESSION, SNAPSHOT));
    }

    private static void expectCode(String expected, ThrowingAction action) throws Exception {
        try {
            action.run();
            fail("Expected " + expected);
        } catch (VaultFailure error) {
            assertEquals(expected, error.code);
        }
    }

    @FunctionalInterface
    private interface ThrowingAction { void run() throws Exception; }

    private static final class MutableMonotonicClock implements OfflineAuthorityTime.MonotonicClock {
        long elapsed;
        long wallClockMillis;
        int boot;

        MutableMonotonicClock(long elapsed, int boot) {
            this.elapsed = elapsed;
            this.boot = boot;
        }

        @Override public long now() { return elapsed; }
        @Override public int bootCount() { return boot; }
    }

    private static final class MemoryStore implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
        OfflineAuthorityTime.OfflineAuthorityAnchor anchor;
        final Map<String, OfflineAuthorityTime.OfflineOccurrence> occurrences = new HashMap<>();

        @Override public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor() { return anchor; }
        @Override public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor value) { anchor = value; }
        @Override public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String session) { return occurrences.get(session); }
        @Override public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence occurrence) { occurrences.put(occurrence.clientSessionId, occurrence); }
    }
}
