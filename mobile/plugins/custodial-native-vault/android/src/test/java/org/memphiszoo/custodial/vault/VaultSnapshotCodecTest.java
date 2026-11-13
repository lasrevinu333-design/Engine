package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.time.Instant;
import java.util.Arrays;
import org.junit.Test;

public final class VaultSnapshotCodecTest {
    @Test
    public void exactSnapshotRoundTripsAsOneRecord() throws Exception {
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        InstallationBinding binding = new InstallationBinding(
            "KIOSK_02",
            "native-installation-seal-0001",
            Instant.ofEpochMilli(1_800_000_000_000L).toString(),
            false,
            "11111111-1111-4111-8111-111111111111"
        );
        VaultSnapshot state = VaultSnapshot.empty().next(
            VaultPhase.CREDENTIAL_STAGED,
            SecretKind.DEVICE_CREDENTIAL,
            new EncryptedSecret("Y2lwaGVydGV4dA==", "aW5pdGlhbGl6YXRpb24="),
            "11111111-1111-4111-8111-111111111111",
            "KIOSK_02",
            "enrollment",
            1_800_001_000_000L,
            binding,
            new EnrollmentMetadata("credential-id", "", "", "phone", "employee", "Employee"),
            "",
            "",
            false,
            ""
        );
        assertEquals(state, codec.decode(codec.encode(state)));
    }

    @Test
    public void corruptionTruncationAndTrailingDataFailClosed() throws Exception {
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        byte[] valid = codec.encode(VaultSnapshot.empty());
        for (byte[] invalid : new byte[][] {
            Arrays.copyOf(valid, valid.length - 1),
            append(valid, (byte) 1),
            mutate(valid, 0)
        }) {
            try {
                codec.decode(invalid);
                fail("Expected corrupt snapshot rejection");
            } catch (VaultFailure error) {
                assertEquals("custodial_native_vault_corrupt", error.code);
            }
        }
    }

    private static byte[] append(byte[] source, byte value) {
        byte[] result = Arrays.copyOf(source, source.length + 1);
        result[result.length - 1] = value;
        return result;
    }

    private static byte[] mutate(byte[] source, int index) {
        byte[] result = source.clone();
        result[index] ^= 0x7f;
        return result;
    }
}
