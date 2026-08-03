package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import org.junit.Test;

public final class VaultTimestampsTest {
    @Test
    public void normalizesOffsetsAndPreservesNanosecondPrecision() throws Exception {
        assertEquals(
            "2026-08-01T20:04:05.123456789Z",
            VaultTimestamps.normalize("2026-08-01T15:04:05.123456789-05:00", "bad_timestamp")
        );
        assertEquals(
            "2026-08-01T20:04:05Z",
            VaultTimestamps.normalize("2026-08-01T20:04:05.000Z", "bad_timestamp")
        );
    }

    @Test
    public void epochMillisUsesNormalizedInstantAndTruncatesSubmillisecondPrecision() throws Exception {
        assertEquals(
            1_801_421_045_987L,
            VaultTimestamps.epochMillis("2027-01-31T18:44:05.987654321Z", "bad_timestamp")
        );
        assertEquals(
            "2027-01-31T18:44:05.987Z",
            VaultTimestamps.fromEpochMillis(1_801_421_045_987L)
        );
    }

    @Test
    public void rejectsInvalidCalendarDatesAndOffsets() throws Exception {
        expectInvalid("2026-02-29T12:00:00Z");
        expectInvalid("2026-01-01T24:00:00Z");
        expectInvalid("2026-01-01T12:00:00+18:01");
        expectInvalid("2026-01-01T12:00:00+19:00");
    }

    @Test
    public void roundTripsNegativeEpochMillis() throws Exception {
        assertEquals("1969-12-31T23:59:59.999Z", VaultTimestamps.fromEpochMillis(-1L));
        assertEquals(-1L, VaultTimestamps.epochMillis("1969-12-31T23:59:59.999Z", "bad_timestamp"));
    }

    private static void expectInvalid(String value) throws Exception {
        try {
            VaultTimestamps.normalize(value, "bad_timestamp");
            fail("Expected invalid timestamp: " + value);
        } catch (VaultFailure error) {
            assertEquals("bad_timestamp", error.code);
        }
    }
}
