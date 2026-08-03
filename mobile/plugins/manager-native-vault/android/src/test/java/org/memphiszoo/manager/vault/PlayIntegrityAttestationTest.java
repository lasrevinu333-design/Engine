package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

public final class PlayIntegrityAttestationTest {
    private static final String CHALLENGE = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
    private static final String TOKEN = "verified-play-integrity-token-0123456789abcdef";

    @Test
    public void invalidProviderIsRepreparedOnceAfterExactBackoff() throws Exception {
        AtomicInteger prepares = new AtomicInteger();
        AtomicInteger requests = new AtomicInteger();
        List<Long> sleeps = new ArrayList<>();
        PlayIntegrityAttestation attestation = new PlayIntegrityAttestation(project -> {
            int generation = prepares.incrementAndGet();
            return requestHash -> {
                requests.incrementAndGet();
                assertEquals(CHALLENGE, requestHash);
                if (generation == 1) throw new IllegalStateException("provider invalid");
                return TOKEN;
            };
        }, 123456L, sleeps::add);

        assertEquals(TOKEN, attestation.token(CHALLENGE));
        assertEquals(2, prepares.get());
        assertEquals(2, requests.get());
        assertEquals(List.of(PlayIntegrityAttestation.RETRY_BACKOFF_MILLIS), sleeps);
    }

    @Test
    public void persistentFailureIsBoundedAndFailsClosed() throws Exception {
        AtomicInteger prepares = new AtomicInteger();
        List<Long> sleeps = new ArrayList<>();
        PlayIntegrityAttestation attestation = new PlayIntegrityAttestation(project -> {
            prepares.incrementAndGet();
            return requestHash -> { throw new IllegalStateException("provider invalid"); };
        }, 123456L, sleeps::add);
        try {
            attestation.token(CHALLENGE);
            fail("expected fail closed");
        } catch (VaultFailure error) {
            assertEquals("manager_play_integrity_unavailable", error.code);
        }
        assertEquals(2, prepares.get());
        assertEquals(List.of(PlayIntegrityAttestation.RETRY_BACKOFF_MILLIS), sleeps);
    }
}
