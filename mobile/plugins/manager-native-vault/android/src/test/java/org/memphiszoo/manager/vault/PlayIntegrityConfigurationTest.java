package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.util.Base64;
import org.junit.Test;

public final class PlayIntegrityConfigurationTest {
    @Test
    public void challengeIsExactCanonicalThirtyTwoByteBase64url() throws Exception {
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        assertEquals(challenge, PlayIntegrityConfiguration.challenge(challenge));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.challenge(challenge + "="));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.challenge("short"));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.challenge(" " + challenge));
    }

    @Test
    public void productionCloudProjectNumberFailsClosed() {
        assertThrows(VaultFailure.class, () -> new PlayIntegrityConfiguration(0));
        assertThrows(VaultFailure.class, () -> new PlayIntegrityConfiguration(-1));
    }

    @Test
    public void manifestProjectNumberIsExplicitStringAndOverflowSafe() throws Exception {
        assertEquals(
            123456789012L,
            PlayIntegrityConfiguration.fromMetadataValue(
                "play-integrity-cloud-project:123456789012"
            ).cloudProjectNumber
        );
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.fromMetadataValue(123456789));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.fromMetadataValue("123456789012"));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.fromMetadataValue("play-integrity-cloud-project:12345"));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.fromMetadataValue("play-integrity-cloud-project:9999999999999999999"));
        assertThrows(VaultFailure.class, () -> PlayIntegrityConfiguration.fromMetadataValue("play-integrity-cloud-project:123456789012\n"));
    }
}
