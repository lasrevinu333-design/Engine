package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Canonical native-only attestations. Credential material never leaves this class. */
final class NativeAttestation {
    static final String START_VERSION = "custodial-native-start.v1";
    static final String COMPLETION_VERSION = "custodial-native-completion.v2";
    static final String START_TRANSPORT_VERSION = "custodial-native-start-transport.v1";
    static final String COMPLETION_TRANSPORT_VERSION = "custodial-native-completion-transport.v1";
    static final String REQUEST_VERSION = "custodial-native-request.v1";
    private static final String EDITION = "custodial";

    private NativeAttestation() {}

    static Map<String, Object> offlineStart(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId,
        String snapshotEmployeeId,
        long assignmentEpoch,
        String snapshotCredentialId,
        String nativeScanEntryId,
        char[] credential,
        String startedAt
    ) throws VaultFailure {
        String storedCredentialId = credentialId(credential);
        String timestamp = exactMillisecondsTimestamp(startedAt, "custodial_native_start_attestation_refused");
        String message = String.join("\n",
            START_VERSION,
            storedCredentialId,
            canonicalDeviceId(deviceId),
            canonicalLocationCode(locationCode),
            exactIdentifier(clientSessionId, "custodial_native_start_attestation_refused"),
            canonicalHex(snapshotId, "custodial_native_start_attestation_refused"),
            canonicalUuid(snapshotEmployeeId, "custodial_native_start_attestation_refused"),
            canonicalEpoch(assignmentEpoch),
            canonicalUuid(snapshotCredentialId, "custodial_native_start_attestation_refused"),
            canonicalUuid(nativeScanEntryId, "custodial_native_start_attestation_refused"),
            timestamp
        );
        if (!storedCredentialId.equals(canonicalUuid(snapshotCredentialId, "custodial_native_start_attestation_refused"))) {
            throw new VaultFailure("custodial_native_start_credential_mismatch");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("p_client_started_at", timestamp);
        result.put("p_native_scan_entry_id", canonicalUuid(nativeScanEntryId, "custodial_native_start_attestation_refused"));
        result.put("p_native_start_attestation_version", START_VERSION);
        result.put("p_native_start_attestation", hmac(credential, message));
        return VaultCollections.copyMap(result);
    }

    static Map<String, Object> offlineStartTransport(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId,
        String snapshotEmployeeId,
        long assignmentEpoch,
        String snapshotCredentialId,
        String nativeScanEntryId,
        String startedAt,
        String originalVersion,
        String originalSignature,
        char[] currentCredential
    ) throws VaultFailure {
        String timestamp = exactMillisecondsTimestamp(startedAt, "custodial_native_start_transport_attestation_refused");
        String exactOriginalVersion = START_VERSION.equals(originalVersion) ? START_VERSION : "";
        String exactOriginalSignature = canonicalSignature(originalSignature, "custodial_native_start_transport_attestation_refused");
        if (exactOriginalVersion.isEmpty()) throw new VaultFailure("custodial_native_start_transport_attestation_refused");
        String message = String.join("\n",
            START_TRANSPORT_VERSION,
            credentialId(currentCredential),
            canonicalDeviceId(deviceId),
            canonicalLocationCode(locationCode),
            exactIdentifier(clientSessionId, "custodial_native_start_transport_attestation_refused"),
            canonicalHex(snapshotId, "custodial_native_start_transport_attestation_refused"),
            canonicalUuid(snapshotEmployeeId, "custodial_native_start_transport_attestation_refused"),
            canonicalEpoch(assignmentEpoch),
            canonicalUuid(snapshotCredentialId, "custodial_native_start_transport_attestation_refused"),
            canonicalUuid(nativeScanEntryId, "custodial_native_start_transport_attestation_refused"),
            timestamp,
            exactOriginalVersion,
            exactOriginalSignature
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("p_client_started_at", timestamp);
        result.put("p_native_scan_entry_id", canonicalUuid(nativeScanEntryId, "custodial_native_start_transport_attestation_refused"));
        result.put("p_native_start_attestation_version", exactOriginalVersion);
        result.put("p_native_start_attestation", exactOriginalSignature);
        result.put("p_native_start_transport_attestation_version", START_TRANSPORT_VERSION);
        result.put("p_native_start_transport_attestation", hmac(currentCredential, message));
        return VaultCollections.copyMap(result);
    }

    static Map<String, Object> offlineCompletion(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String clientCompletionId,
        String contextId,
        String nativeFinishScanEntryId,
        String startedAt,
        char[] credential,
        String endedAt
    ) throws VaultFailure {
        String canonicalStartedAt = exactMillisecondsTimestamp(startedAt, "custodial_native_completion_attestation_refused");
        String timestamp = exactMillisecondsTimestamp(endedAt, "custodial_native_completion_attestation_refused");
        if (
            VaultTimestamps.epochMillis(timestamp, "custodial_native_completion_attestation_refused")
                < VaultTimestamps.epochMillis(canonicalStartedAt, "custodial_native_completion_attestation_refused")
        ) throw new VaultFailure("custodial_native_completion_attestation_refused");
        String message = String.join("\n",
            COMPLETION_VERSION,
            credentialId(credential),
            canonicalDeviceId(deviceId),
            canonicalLocationCode(locationCode),
            exactIdentifier(clientSessionId, "custodial_native_completion_attestation_refused"),
            canonicalUuid(clientCompletionId, "custodial_native_completion_attestation_refused"),
            canonicalUuid(contextId, "custodial_native_completion_attestation_refused"),
            canonicalUuid(nativeFinishScanEntryId, "custodial_native_completion_attestation_refused"),
            canonicalStartedAt,
            timestamp
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("p_client_ended_at", timestamp);
        result.put("p_native_finish_scan_entry_id", canonicalUuid(nativeFinishScanEntryId, "custodial_native_completion_attestation_refused"));
        result.put("p_native_completion_attestation_version", COMPLETION_VERSION);
        result.put("p_native_completion_attestation", hmac(credential, message));
        return VaultCollections.copyMap(result);
    }

    static Map<String, Object> offlineCompletionTransport(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String clientCompletionId,
        String contextId,
        String nativeFinishScanEntryId,
        String startedAt,
        String endedAt,
        String originalVersion,
        String originalSignature,
        char[] currentCredential
    ) throws VaultFailure {
        String canonicalStartedAt = exactMillisecondsTimestamp(startedAt, "custodial_native_completion_transport_attestation_refused");
        String timestamp = exactMillisecondsTimestamp(endedAt, "custodial_native_completion_transport_attestation_refused");
        if (VaultTimestamps.epochMillis(timestamp, "custodial_native_completion_transport_attestation_refused")
            < VaultTimestamps.epochMillis(canonicalStartedAt, "custodial_native_completion_transport_attestation_refused")) {
            throw new VaultFailure("custodial_native_completion_transport_attestation_refused");
        }
        String exactOriginalVersion = COMPLETION_VERSION.equals(originalVersion) ? COMPLETION_VERSION : "";
        String exactOriginalSignature = canonicalSignature(originalSignature, "custodial_native_completion_transport_attestation_refused");
        if (exactOriginalVersion.isEmpty()) throw new VaultFailure("custodial_native_completion_transport_attestation_refused");
        String message = String.join("\n",
            COMPLETION_TRANSPORT_VERSION,
            credentialId(currentCredential),
            canonicalDeviceId(deviceId),
            canonicalLocationCode(locationCode),
            exactIdentifier(clientSessionId, "custodial_native_completion_transport_attestation_refused"),
            canonicalUuid(clientCompletionId, "custodial_native_completion_transport_attestation_refused"),
            canonicalUuid(contextId, "custodial_native_completion_transport_attestation_refused"),
            canonicalUuid(nativeFinishScanEntryId, "custodial_native_completion_transport_attestation_refused"),
            canonicalStartedAt,
            timestamp,
            exactOriginalVersion,
            exactOriginalSignature
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("p_client_ended_at", timestamp);
        result.put("p_native_finish_scan_entry_id", canonicalUuid(nativeFinishScanEntryId, "custodial_native_completion_transport_attestation_refused"));
        result.put("p_native_completion_attestation_version", exactOriginalVersion);
        result.put("p_native_completion_attestation", exactOriginalSignature);
        result.put("p_native_completion_transport_attestation_version", COMPLETION_TRANSPORT_VERSION);
        result.put("p_native_completion_transport_attestation", hmac(currentCredential, message));
        return VaultCollections.copyMap(result);
    }

    static Map<String, String> requestHeaders(
        AuthorizedRequest request,
        String deviceId,
        char[] credential,
        String requestId,
        long nowMillis
    ) throws VaultFailure {
        String timestamp = VaultTimestamps.fromEpochMillisExact(nowMillis);
        String canonicalRequestId = canonicalUuid(requestId, "custodial_native_request_attestation_refused");
        String message = String.join("\n",
            REQUEST_VERSION,
            credentialId(credential),
            canonicalDeviceId(deviceId),
            request.method.toUpperCase(Locale.ROOT),
            request.path,
            sha256(request.body),
            canonicalRequestId,
            timestamp,
            EDITION
        );
        Map<String, String> result = new LinkedHashMap<>();
        result.put("X-Memphis-Native-Attestation-Version", REQUEST_VERSION);
        result.put("X-Memphis-Native-Request-Id", canonicalRequestId);
        result.put("X-Memphis-Native-Request-Timestamp", timestamp);
        result.put("X-Memphis-Native-Request-Attestation", hmac(credential, message));
        return VaultCollections.copyMap(result);
    }

    static void requireStoredCredentialId(char[] credential, String expectedCredentialId) throws VaultFailure {
        String expected = expectedCredentialId == null ? "" : expectedCredentialId.trim();
        if (expected.isEmpty()) return;
        if (!credentialId(credential).equals(canonicalUuid(expected, "custodial_native_credential_binding_mismatch"))) {
            throw new VaultFailure("custodial_native_credential_binding_mismatch");
        }
    }

    static String resolveStoredCredentialId(char[] credential, String expectedCredentialId) throws VaultFailure {
        String stored = credentialId(credential);
        String expected = expectedCredentialId == null ? "" : expectedCredentialId.trim();
        if (
            !expected.isEmpty()
            && !stored.equals(canonicalUuid(expected, "custodial_native_credential_binding_mismatch"))
        ) {
            throw new VaultFailure("custodial_native_credential_binding_mismatch");
        }
        return stored;
    }

    private static String hmac(char[] credential, String message) throws VaultFailure {
        CredentialParts parts = credentialParts(credential);
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(parts.secret, "HmacSHA256"));
            return hexadecimal(mac.doFinal(messageBytes));
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_attestation_unavailable", error);
        } finally {
            Arrays.fill(parts.secret, (byte) 0);
            Arrays.fill(messageBytes, (byte) 0);
        }
    }

    private static String sha256(byte[] body) throws VaultFailure {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return hexadecimal(digest.digest(body));
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_attestation_unavailable", error);
        }
    }

    private static String credentialId(char[] credential) throws VaultFailure {
        CredentialParts parts = credentialParts(credential);
        Arrays.fill(parts.secret, (byte) 0);
        return parts.credentialId;
    }

    private static CredentialParts credentialParts(char[] credential) throws VaultFailure {
        if (credential == null || credential.length < 3 || credential.length > 4096) {
            throw new VaultFailure("custodial_native_attestation_credential_refused");
        }
        String raw = new String(credential);
        try {
            int separator = raw.indexOf('.');
            if (separator <= 0 || separator == raw.length() - 1) {
                throw new VaultFailure("custodial_native_attestation_credential_refused");
            }
            String id = canonicalUuid(raw.substring(0, separator), "custodial_native_attestation_credential_refused");
            byte[] secret = raw.substring(separator + 1).getBytes(StandardCharsets.UTF_8);
            if (secret.length == 0) throw new VaultFailure("custodial_native_attestation_credential_refused");
            return new CredentialParts(id, secret);
        } finally {
            raw = "";
        }
    }

    private static String canonicalDeviceId(String value) throws VaultFailure {
        return VaultValidation.deviceId(value);
    }

    private static String canonicalLocationCode(String value) throws VaultFailure {
        String candidate = String.valueOf(value).trim().toUpperCase(Locale.ROOT);
        if (candidate.equals("TETON") || candidate.equals("TETON_EXHIBIT")) return "TETX";
        if (candidate.equals("TETON_RR") || candidate.equals("TETON_RESTROOMS")
            || candidate.equals("TETON_MENS") || candidate.equals("TETON_MEN")
            || candidate.equals("TETON_MENS_RESTROOM") || candidate.equals("TETON_MENS_RESTROOMS")
            || candidate.equals("TETON_MEN_RESTROOM") || candidate.equals("TETON_MEN_RESTROOMS")) return "TETM";
        if (!candidate.matches("[A-Z0-9._:-]{1,100}")) {
            throw new VaultFailure("custodial_native_attestation_location_refused");
        }
        return candidate;
    }

    private static String canonicalUuid(String value, String code) throws VaultFailure {
        try {
            return UUID.fromString(String.valueOf(value)).toString();
        } catch (IllegalArgumentException error) {
            throw new VaultFailure(code, error);
        }
    }

    private static String canonicalHex(String value, String code) throws VaultFailure {
        String clean = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (!clean.matches("[0-9a-f]{64}")) throw new VaultFailure(code);
        return clean;
    }

    private static String canonicalSignature(String value, String code) throws VaultFailure {
        return canonicalHex(value, code);
    }

    private static String canonicalEpoch(long value) throws VaultFailure {
        if (value < 1L) throw new VaultFailure("custodial_native_start_attestation_refused");
        return Long.toString(value);
    }

    private static String exactIdentifier(String value, String code) throws VaultFailure {
        if (value == null || value.isEmpty() || value.length() > 200 || value.indexOf('\0') >= 0
            || value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0) {
            throw new VaultFailure(code);
        }
        return value;
    }

    private static String exactMillisecondsTimestamp(String value, String code) throws VaultFailure {
        String candidate = value == null ? "" : value;
        if (!candidate.matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$")) {
            throw new VaultFailure(code);
        }
        VaultTimestamps.epochMillis(candidate, code);
        return candidate;
    }

    private static String hexadecimal(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        Arrays.fill(value, (byte) 0);
        return result.toString();
    }

    private static final class CredentialParts {
        final String credentialId;
        final byte[] secret;

        CredentialParts(String credentialId, byte[] secret) {
            this.credentialId = credentialId;
            this.secret = secret;
        }
    }
}
