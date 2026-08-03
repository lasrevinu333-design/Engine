package org.memphiszoo.manager.vault;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.nio.charset.StandardCharsets;

/** Deterministic, bounded codec for the single SharedPreferences snapshot. */
final class VaultSnapshotCodec {
    private static final int MAGIC = 0x4d5a5632; // MZV2
    private static final int MAX_SNAPSHOT_BYTES = 64 * 1024;
    private static final int MAX_STRING_BYTES = 16 * 1024;

    byte[] encode(VaultSnapshot state) throws VaultFailure {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (DataOutputStream output = new DataOutputStream(bytes)) {
                output.writeInt(MAGIC);
                output.writeInt(VaultSnapshot.SCHEMA_VERSION);
                output.writeLong(state.revision);
                write(output, state.phase.name());
                write(output, state.secretKind.name());
                write(output, state.secret == null ? "" : state.secret.ciphertext);
                write(output, state.secret == null ? "" : state.secret.iv);
                write(output, state.operationId);
                write(output, state.deviceId);
                write(output, state.flow);
                output.writeLong(state.expiresAtMillis);
                writeInstallation(output, state.installation);
                writeMetadata(output, state.metadata);
                write(output, state.removalOperationId);
                write(output, state.blockedReason);
                output.writeBoolean(state.legacyHadBinding);
                write(output, state.legacySeal);
            }
            byte[] encoded = bytes.toByteArray();
            if (encoded.length > MAX_SNAPSHOT_BYTES) throw corrupt();
            return encoded;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_vault_encode_failed", error);
        }
    }

    VaultSnapshot decode(byte[] encoded) throws VaultFailure {
        if (encoded == null || encoded.length == 0 || encoded.length > MAX_SNAPSHOT_BYTES) throw corrupt();
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(encoded))) {
            if (input.readInt() != MAGIC || input.readInt() != VaultSnapshot.SCHEMA_VERSION) throw corrupt();
            long revision = input.readLong();
            VaultPhase phase = enumValue(VaultPhase.class, read(input));
            SecretKind secretKind = enumValue(SecretKind.class, read(input));
            String ciphertext = read(input);
            String iv = read(input);
            EncryptedSecret secret = ciphertext.isEmpty() && iv.isEmpty() ? null : new EncryptedSecret(ciphertext, iv);
            if ((ciphertext.isEmpty() && !iv.isEmpty()) || (!ciphertext.isEmpty() && iv.isEmpty())) throw corrupt();
            String operationId = read(input);
            String deviceId = read(input);
            String flow = read(input);
            long expiresAtMillis = input.readLong();
            InstallationBinding installation = readInstallation(input);
            EnrollmentMetadata metadata = readMetadata(input);
            String removalOperationId = read(input);
            String blockedReason = read(input);
            boolean legacyHadBinding = input.readBoolean();
            String legacySeal = read(input);
            if (input.read() != -1) throw corrupt();
            return new VaultSnapshot(
                revision,
                phase,
                secretKind,
                secret,
                operationId,
                deviceId,
                flow,
                expiresAtMillis,
                installation,
                metadata,
                removalOperationId,
                blockedReason,
                legacyHadBinding,
                legacySeal
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (EOFException error) {
            throw corrupt(error);
        } catch (Exception error) {
            throw corrupt(error);
        }
    }

    private static void writeInstallation(DataOutputStream output, InstallationBinding binding) throws Exception {
        output.writeBoolean(binding != null);
        if (binding == null) return;
        write(output, binding.deviceId);
        write(output, binding.installationSeal);
        write(output, binding.enrolledAt);
        output.writeBoolean(binding.migratedFromCredentialOnlyState);
        write(output, binding.enrollmentOperationId);
    }

    private static InstallationBinding readInstallation(DataInputStream input) throws Exception {
        if (!input.readBoolean()) return null;
        return new InstallationBinding(read(input), read(input), read(input), input.readBoolean(), read(input));
    }

    private static void writeMetadata(DataOutputStream output, EnrollmentMetadata metadata) throws Exception {
        write(output, metadata.credentialId);
        write(output, metadata.credentialExpiresAt);
        write(output, metadata.resumeExpiresAt);
        write(output, metadata.deviceName);
        write(output, metadata.managerId);
        write(output, metadata.managerName);
        write(output, metadata.recoveryId);
    }

    private static EnrollmentMetadata readMetadata(DataInputStream input) throws Exception {
        return new EnrollmentMetadata(read(input), read(input), read(input), read(input), read(input), read(input), read(input));
    }

    private static void write(DataOutputStream output, String value) throws Exception {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_STRING_BYTES) throw corrupt();
        output.writeInt(bytes.length);
        output.write(bytes);
    }

    private static String read(DataInputStream input) throws Exception {
        int length = input.readInt();
        if (length < 0 || length > MAX_STRING_BYTES) throw corrupt();
        byte[] bytes = new byte[length];
        input.readFully(bytes);
        String value = new String(bytes, StandardCharsets.UTF_8);
        if (!java.util.Arrays.equals(bytes, value.getBytes(StandardCharsets.UTF_8))) throw corrupt();
        return value;
    }

    private static <T extends Enum<T>> T enumValue(Class<T> type, String value) throws VaultFailure {
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException error) {
            throw corrupt(error);
        }
    }

    private static VaultFailure corrupt() {
        return new VaultFailure("manager_native_vault_corrupt");
    }

    private static VaultFailure corrupt(Throwable cause) {
        return new VaultFailure("manager_native_vault_corrupt", cause);
    }
}
