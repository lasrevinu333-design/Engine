package org.memphiszoo.manager.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

enum VaultPhase {
    EMPTY,
    ENROLLMENT_REQUESTED,
    ENROLLMENT_DISPATCHED,
    CREDENTIAL_STAGED,
    PENDING_SERVER_CONFIRMATION,
    ACTIVE,
    CANCEL_REQUESTED,
    CANCELLED,
    REMOVAL_REQUESTED,
    REMOVAL_TOMBSTONE,
    LEGACY_CLEANUP_PENDING,
    LEGACY_PENDING,
    BLOCKED
}

enum SecretKind {
    NONE,
    ENROLLMENT_CODE,
    DEVICE_CREDENTIAL
}

final class EncryptedSecret {
    final String ciphertext;
    final String iv;

    EncryptedSecret(String ciphertext, String iv) throws VaultFailure {
        this.ciphertext = VaultValidation.bounded(ciphertext, 8, 16_384, "manager_native_vault_corrupt");
        this.iv = VaultValidation.bounded(iv, 8, 1024, "manager_native_vault_corrupt");
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof EncryptedSecret
            && ciphertext.equals(((EncryptedSecret) other).ciphertext)
            && iv.equals(((EncryptedSecret) other).iv);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ciphertext, iv);
    }
}

final class InstallationBinding {
    final String deviceId;
    final String installationSeal;
    final String enrolledAt;
    final boolean migratedFromCredentialOnlyState;
    final String enrollmentOperationId;

    InstallationBinding(
        String deviceId,
        String installationSeal,
        String enrolledAt,
        boolean migratedFromCredentialOnlyState,
        String enrollmentOperationId
    ) throws VaultFailure {
        this.deviceId = VaultValidation.deviceId(deviceId);
        this.installationSeal = VaultValidation.bindingSeal(installationSeal);
        this.enrolledAt = VaultValidation.timestamp(enrolledAt, "manager_native_invalid_binding");
        this.migratedFromCredentialOnlyState = migratedFromCredentialOnlyState;
        this.enrollmentOperationId = enrollmentOperationId == null || enrollmentOperationId.trim().isEmpty()
            ? ""
            : VaultValidation.operationId(enrollmentOperationId);
        if (!migratedFromCredentialOnlyState && this.enrollmentOperationId.isEmpty()) {
            throw new VaultFailure("manager_native_invalid_binding");
        }
    }

    Map<String, Object> safeRecord() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("schema_version", 1);
        result.put("device_id", deviceId);
        result.put("installation_seal", installationSeal);
        result.put("enrolled_at", enrolledAt);
        result.put("migrated_from_credential_only_state", migratedFromCredentialOnlyState);
        if (!enrollmentOperationId.isEmpty()) result.put("enrollment_operation_id", enrollmentOperationId);
        return VaultCollections.copyMap(result);
    }

    boolean sameBinding(InstallationBinding other) {
        return other != null
            && deviceId.equals(other.deviceId)
            && installationSeal.equals(other.installationSeal);
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof InstallationBinding)) return false;
        InstallationBinding value = (InstallationBinding) other;
        return deviceId.equals(value.deviceId)
            && installationSeal.equals(value.installationSeal)
            && enrolledAt.equals(value.enrolledAt)
            && migratedFromCredentialOnlyState == value.migratedFromCredentialOnlyState
            && enrollmentOperationId.equals(value.enrollmentOperationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(deviceId, installationSeal, enrolledAt, migratedFromCredentialOnlyState, enrollmentOperationId);
    }
}

final class EnrollmentMetadata {
    final String credentialId;
    final String credentialExpiresAt;
    final String resumeExpiresAt;
    final String deviceName;
    final String managerId;
    final String managerName;
    final String recoveryId;

    EnrollmentMetadata(
        String credentialId,
        String credentialExpiresAt,
        String resumeExpiresAt,
        String deviceName,
        String managerId,
        String managerName
    ) throws VaultFailure {
        this(credentialId, credentialExpiresAt, resumeExpiresAt, deviceName, managerId, managerName, "");
    }

    EnrollmentMetadata(
        String credentialId,
        String credentialExpiresAt,
        String resumeExpiresAt,
        String deviceName,
        String managerId,
        String managerName,
        String recoveryId
    ) throws VaultFailure {
        this.credentialId = VaultValidation.safeText(credentialId, 160, "manager_native_invalid_enrollment_response");
        this.credentialExpiresAt = optionalTimestamp(credentialExpiresAt);
        this.resumeExpiresAt = optionalTimestamp(resumeExpiresAt);
        this.deviceName = VaultValidation.safeText(deviceName, 200, "manager_native_invalid_enrollment_response");
        this.managerId = VaultValidation.safeText(managerId, 160, "manager_native_invalid_enrollment_response");
        this.managerName = VaultValidation.safeText(managerName, 200, "manager_native_invalid_enrollment_response");
        this.recoveryId = VaultValidation.safeText(recoveryId, 160, "manager_native_invalid_enrollment_response");
    }

    static EnrollmentMetadata empty() throws VaultFailure {
        return new EnrollmentMetadata("", "", "", "", "", "");
    }

    private static String optionalTimestamp(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        return clean.isEmpty() ? "" : VaultValidation.timestamp(clean, "manager_native_invalid_enrollment_response");
    }

    long resumeExpiryMillis(long fallback) throws VaultFailure {
        if (resumeExpiresAt.isEmpty()) return fallback;
        return VaultTimestamps.epochMillis(resumeExpiresAt, "manager_native_invalid_enrollment_response");
    }

    Map<String, Object> safeRecord(String operationId, String flow, String deviceId, boolean replayed) {
        Map<String, Object> result = new LinkedHashMap<>(safeStateRecord(operationId, flow, deviceId));
        result.put("replayed", replayed);
        return VaultCollections.copyMap(result);
    }

    Map<String, Object> safeStateRecord(String operationId, String flow, String deviceId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("operation_id", operationId);
        result.put("flow", flow);
        result.put("device_id", deviceId);
        if (!resumeExpiresAt.isEmpty()) result.put("resume_expires_at", resumeExpiresAt);
        if (!credentialId.isEmpty()) result.put("credential_id", credentialId);
        if (!recoveryId.isEmpty()) result.put("recovery_id", recoveryId);
        if (!credentialExpiresAt.isEmpty()) result.put("credential_expires_at", credentialExpiresAt);
        if (!deviceName.isEmpty()) result.put("device_name", deviceName);
        if (!managerId.isEmpty() || !managerName.isEmpty()) {
            Map<String, Object> manager = new LinkedHashMap<>();
            if (!managerId.isEmpty()) manager.put("id", managerId);
            if (!managerName.isEmpty()) manager.put("name", managerName);
            result.put("manager", VaultCollections.copyMap(manager));
        }
        return VaultCollections.copyMap(result);
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof EnrollmentMetadata)) return false;
        EnrollmentMetadata value = (EnrollmentMetadata) other;
        return credentialId.equals(value.credentialId)
            && credentialExpiresAt.equals(value.credentialExpiresAt)
            && resumeExpiresAt.equals(value.resumeExpiresAt)
            && deviceName.equals(value.deviceName)
            && managerId.equals(value.managerId)
            && managerName.equals(value.managerName)
            && recoveryId.equals(value.recoveryId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(credentialId, credentialExpiresAt, resumeExpiresAt, deviceName, managerId, managerName, recoveryId);
    }
}

final class LegacyMaterial implements AutoCloseable {
    final char[] credential;
    final InstallationBinding binding;
    final String legacySeal;

    LegacyMaterial(char[] credential, InstallationBinding binding, String legacySeal) throws VaultFailure {
        if (credential == null || credential.length < 1 || credential.length > 4096) {
            throw new VaultFailure("manager_native_legacy_vault_invalid");
        }
        this.credential = credential.clone();
        this.binding = binding;
        this.legacySeal = legacySeal == null || legacySeal.trim().isEmpty()
            ? ""
            : VaultValidation.bindingSeal(legacySeal);
    }

    @Override
    public void close() {
        VaultValidation.wipe(credential);
    }
}

final class VaultSnapshot {
    static final int SCHEMA_VERSION = 2;

    final long revision;
    final VaultPhase phase;
    final SecretKind secretKind;
    final EncryptedSecret secret;
    final String operationId;
    final String deviceId;
    final String flow;
    final long expiresAtMillis;
    final InstallationBinding installation;
    final EnrollmentMetadata metadata;
    final String removalOperationId;
    final String blockedReason;
    final boolean legacyHadBinding;
    final String legacySeal;

    VaultSnapshot(
        long revision,
        VaultPhase phase,
        SecretKind secretKind,
        EncryptedSecret secret,
        String operationId,
        String deviceId,
        String flow,
        long expiresAtMillis,
        InstallationBinding installation,
        EnrollmentMetadata metadata,
        String removalOperationId,
        String blockedReason,
        boolean legacyHadBinding,
        String legacySeal
    ) throws VaultFailure {
        if (revision < 0 || phase == null || secretKind == null) {
            throw new VaultFailure("manager_native_vault_corrupt");
        }
        this.revision = revision;
        this.phase = phase;
        this.secretKind = secretKind;
        this.secret = secret;
        this.operationId = operationId == null ? "" : operationId;
        this.deviceId = deviceId == null ? "" : deviceId;
        this.flow = flow == null ? "" : flow;
        this.expiresAtMillis = expiresAtMillis;
        this.installation = installation;
        this.metadata = metadata == null ? EnrollmentMetadata.empty() : metadata;
        this.removalOperationId = removalOperationId == null ? "" : removalOperationId;
        this.blockedReason = blockedReason == null ? "" : blockedReason;
        this.legacyHadBinding = legacyHadBinding;
        this.legacySeal = legacySeal == null ? "" : legacySeal;
        validate();
    }

    static VaultSnapshot empty() throws VaultFailure {
        return new VaultSnapshot(
            0,
            VaultPhase.EMPTY,
            SecretKind.NONE,
            null,
            "",
            "",
            "",
            0,
            null,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
    }

    VaultSnapshot next(
        VaultPhase nextPhase,
        SecretKind nextSecretKind,
        EncryptedSecret nextSecret,
        String nextOperationId,
        String nextDeviceId,
        String nextFlow,
        long nextExpiresAtMillis,
        InstallationBinding nextInstallation,
        EnrollmentMetadata nextMetadata,
        String nextRemovalOperationId,
        String nextBlockedReason,
        boolean nextLegacyHadBinding,
        String nextLegacySeal
    ) throws VaultFailure {
        return new VaultSnapshot(
            revision + 1,
            nextPhase,
            nextSecretKind,
            nextSecret,
            nextOperationId,
            nextDeviceId,
            nextFlow,
            nextExpiresAtMillis,
            nextInstallation,
            nextMetadata,
            nextRemovalOperationId,
            nextBlockedReason,
            nextLegacyHadBinding,
            nextLegacySeal
        );
    }

    VaultSnapshot blocked(String reason) throws VaultFailure {
        return next(
            VaultPhase.BLOCKED,
            secretKind,
            secret,
            operationId,
            deviceId,
            flow,
            expiresAtMillis,
            installation,
            metadata,
            removalOperationId,
            VaultValidation.reason(reason),
            legacyHadBinding,
            legacySeal
        );
    }

    boolean hasCredential() {
        return secretKind == SecretKind.DEVICE_CREDENTIAL && secret != null;
    }

    boolean pendingEnrollment() {
        return switch (phase) {
            case ENROLLMENT_REQUESTED, ENROLLMENT_DISPATCHED, CREDENTIAL_STAGED, PENDING_SERVER_CONFIRMATION, CANCEL_REQUESTED -> true;
            default -> false;
        };
    }

    private void validate() throws VaultFailure {
        boolean hasSecret = secret != null;
        if ((secretKind == SecretKind.NONE) != !hasSecret) throw corrupt();
        if (!operationId.isEmpty()) VaultValidation.operationId(operationId);
        if (!removalOperationId.isEmpty()) VaultValidation.operationId(removalOperationId);
        if (!deviceId.isEmpty()) VaultValidation.deviceId(deviceId);
        if (!flow.isEmpty()) VaultValidation.flow(flow);
        if (!blockedReason.isEmpty()) VaultValidation.reason(blockedReason);
        if (!legacySeal.isEmpty()) VaultValidation.bindingSeal(legacySeal);
        if (installation != null && !deviceId.isEmpty() && !installation.deviceId.equals(deviceId)) throw corrupt();

        switch (phase) {
            case EMPTY -> require(
                secretKind == SecretKind.NONE && operationId.isEmpty()
                    && (deviceId.isEmpty() == removalOperationId.isEmpty())
                    && flow.isEmpty() && installation == null
                    && blockedReason.isEmpty() && legacySeal.isEmpty()
            );
            case ENROLLMENT_REQUESTED, ENROLLMENT_DISPATCHED -> requireEnrollment(SecretKind.ENROLLMENT_CODE, false);
            case CREDENTIAL_STAGED -> requireEnrollment(SecretKind.DEVICE_CREDENTIAL, true);
            case PENDING_SERVER_CONFIRMATION -> requireEnrollment(SecretKind.DEVICE_CREDENTIAL, true);
            case ACTIVE -> require(
                secretKind == SecretKind.DEVICE_CREDENTIAL && installation != null && !deviceId.isEmpty()
                    && (!operationId.isEmpty() || installation.migratedFromCredentialOnlyState)
                    && removalOperationId.isEmpty() && blockedReason.isEmpty()
            );
            case CANCEL_REQUESTED -> requireEnrollment(SecretKind.DEVICE_CREDENTIAL, installation != null);
            case CANCELLED -> require(
                secretKind == SecretKind.NONE && !operationId.isEmpty() && !deviceId.isEmpty()
                    && installation == null && removalOperationId.isEmpty() && blockedReason.isEmpty()
            );
            case REMOVAL_REQUESTED -> require(
                secretKind == SecretKind.DEVICE_CREDENTIAL && installation != null
                    && !deviceId.isEmpty() && !removalOperationId.isEmpty() && blockedReason.isEmpty()
            );
            case REMOVAL_TOMBSTONE -> require(
                secretKind == SecretKind.NONE && installation == null && !deviceId.isEmpty()
                    && !removalOperationId.isEmpty() && blockedReason.isEmpty()
            );
            case LEGACY_CLEANUP_PENDING -> require(
                secretKind == SecretKind.DEVICE_CREDENTIAL && operationId.isEmpty()
                    && removalOperationId.isEmpty() && blockedReason.isEmpty()
            );
            case LEGACY_PENDING -> require(
                secretKind == SecretKind.DEVICE_CREDENTIAL && operationId.isEmpty()
                    && deviceId.isEmpty() && installation == null && removalOperationId.isEmpty()
                    && blockedReason.isEmpty()
            );
            case BLOCKED -> require(!blockedReason.isEmpty());
        }
    }

    private void requireEnrollment(SecretKind expectedSecret, boolean requiresInstallation) throws VaultFailure {
        require(
            secretKind == expectedSecret && !operationId.isEmpty() && !deviceId.isEmpty()
                && !flow.isEmpty() && expiresAtMillis > 0
                && (requiresInstallation == (installation != null))
                && removalOperationId.isEmpty() && blockedReason.isEmpty()
        );
    }

    private static void require(boolean condition) throws VaultFailure {
        if (!condition) throw corrupt();
    }

    private static VaultFailure corrupt() {
        return new VaultFailure("manager_native_vault_corrupt");
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof VaultSnapshot)) return false;
        VaultSnapshot value = (VaultSnapshot) other;
        return revision == value.revision
            && phase == value.phase
            && secretKind == value.secretKind
            && Objects.equals(secret, value.secret)
            && operationId.equals(value.operationId)
            && deviceId.equals(value.deviceId)
            && flow.equals(value.flow)
            && expiresAtMillis == value.expiresAtMillis
            && Objects.equals(installation, value.installation)
            && metadata.equals(value.metadata)
            && removalOperationId.equals(value.removalOperationId)
            && blockedReason.equals(value.blockedReason)
            && legacyHadBinding == value.legacyHadBinding
            && legacySeal.equals(value.legacySeal);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
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
    }
}

final class VaultValidation {
    /**
     * Manager installations are app-owned UUID identities and must never be
     * accepted as caller-selected arbitrary labels.
     */
    private static final java.util.regex.Pattern DEVICE = java.util.regex.Pattern.compile(
        "^ops-app-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$",
        java.util.regex.Pattern.CASE_INSENSITIVE
    );
    private static final java.util.regex.Pattern OPERATION = java.util.regex.Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        java.util.regex.Pattern.CASE_INSENSITIVE
    );
    private static final java.util.regex.Pattern SEAL = java.util.regex.Pattern.compile("^[A-Za-z0-9._:-]{8,512}$");
    private static final java.util.regex.Pattern REASON = java.util.regex.Pattern.compile("^[a-z][a-z0-9_:-]{0,95}$");

    private VaultValidation() {}

    static String deviceId(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        java.util.regex.Matcher match = DEVICE.matcher(clean);
        if (!match.matches()) throw new VaultFailure("manager_native_invalid_device");
        return "ops-app-" + match.group(1).toLowerCase(java.util.Locale.ROOT);
    }

    static String operationId(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        if (!OPERATION.matcher(clean).matches()) throw new VaultFailure("manager_native_invalid_operation");
        return clean.toLowerCase(java.util.Locale.ROOT);
    }

    static String flow(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
        if (!clean.equals("enrollment") && !clean.equals("recovery")) {
            throw new VaultFailure("manager_native_invalid_enrollment");
        }
        return clean;
    }

    static String bindingSeal(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        if (!SEAL.matcher(clean).matches()) throw new VaultFailure("manager_native_invalid_binding");
        return clean;
    }

    static String timestamp(String value, String code) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        return VaultTimestamps.normalize(clean, code);
    }

    static String safeText(String value, int maximum, String code) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        if (clean.length() > maximum || clean.indexOf('\0') >= 0 || clean.contains("\r") || clean.contains("\n")) {
            throw new VaultFailure(code);
        }
        return clean;
    }

    static String bounded(String value, int minimum, int maximum, String code) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        if (clean.length() < minimum || clean.length() > maximum) throw new VaultFailure(code);
        return clean;
    }

    static String reason(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
        if (!REASON.matcher(clean).matches()) throw new VaultFailure("manager_native_vault_corrupt");
        return clean;
    }

    static boolean sameSecret(char[] first, char[] second) {
        if (first == null || second == null) return first == null && second == null;
        byte[] a = new String(first).getBytes(StandardCharsets.UTF_8);
        byte[] b = new String(second).getBytes(StandardCharsets.UTF_8);
        try {
            return MessageDigest.isEqual(a, b);
        } finally {
            Arrays.fill(a, (byte) 0);
            Arrays.fill(b, (byte) 0);
        }
    }

    static void wipe(char[] value) {
        if (value != null) Arrays.fill(value, '\0');
    }
}
