package org.memphiszoo.custodial.vault;

import android.content.Context;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Native application facade over the retained credential vault.
 *
 * <p>The facade deliberately exposes identity metadata and authorized HTTP,
 * never the raw credential, encrypted secret, installation seal, or direct
 * persistence mutation.</p>
 */
public final class NativeVaultClient {
    private final VaultPersistence persistence;
    private final VaultEngine engine;

    public NativeVaultClient(Context context) {
        Context appContext = context.getApplicationContext();
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence store = new SharedPreferencesVaultPersistence(
            appContext,
            new VaultSnapshotCodec()
        );
        persistence = store;
        engine = new VaultEngine(
            store,
            new AndroidKeystoreCipher(),
            new HttpsEnrollmentTransport(),
            new AndroidLegacyVaultSource(appContext, clock),
            new SecureInstallationSealGenerator(),
            clock
        );
    }

    NativeVaultClient(VaultPersistence persistence, VaultEngine engine) {
        if (persistence == null || engine == null) throw new IllegalArgumentException("vault components are required");
        this.persistence = persistence;
        this.engine = engine;
    }

    public State state() throws Failure {
        try {
            Map<String, Object> safe = engine.getState();
            VaultSnapshot snapshot = persistence.load();
            boolean active = Boolean.TRUE.equals(safe.get("active"));
            InstallationBinding installation = snapshot.installation;
            EnrollmentMetadata metadata = snapshot.metadata;
            String installationId = installation == null
                ? ""
                : installationNamespace(snapshot.deviceId, installation.installationSeal);
            return new State(
                stringValue(safe.get("state")),
                numberValue(safe.get("revision"), snapshot.revision),
                active,
                Boolean.TRUE.equals(safe.get("blocked")),
                Boolean.TRUE.equals(safe.get("recovery_required")),
                stringValue(safe.get("reason")),
                stringValue(safe.get("recovery_reason")),
                snapshot.deviceId,
                installationId,
                metadata.employeeId,
                metadata.employeeName,
                metadata.credentialId,
                metadata.credentialExpiresAt,
                metadata.deviceName,
                installation != null && installation.migratedFromCredentialOnlyState
            );
        } catch (VaultFailure failure) {
            throw Failure.from(failure);
        }
    }

    public State completeLegacyBinding(String deviceId) throws Failure {
        try {
            engine.completeLegacyBinding(deviceId);
            return state();
        } catch (VaultFailure failure) {
            throw Failure.from(failure);
        }
    }

    public HttpResponse authorized(
        String expectedDeviceId,
        String path,
        String method,
        Map<String, String> headers,
        byte[] body
    ) throws Failure {
        try {
            AuthorizedResponse response = engine.authorizedRequest(
                expectedDeviceId,
                new AuthorizedRequest(
                    path,
                    method,
                    headers == null ? Collections.emptyMap() : headers,
                    body == null ? new byte[0] : body
                )
            );
            return new HttpResponse(response.status, response.headers, response.body);
        } catch (VaultFailure failure) {
            throw Failure.from(failure);
        }
    }

    public Map<String, Object> attestOfflineStart(
        String expectedDeviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId,
        String snapshotEmployeeId,
        long assignmentEpoch,
        String snapshotCredentialId,
        String nativeScanEntryId,
        String startedAt,
        String originalAttestationVersion,
        String originalAttestation
    ) throws Failure {
        try {
            return immutableMap(engine.attestOfflineStart(
                expectedDeviceId,
                locationCode,
                clientSessionId,
                snapshotId,
                snapshotEmployeeId,
                assignmentEpoch,
                snapshotCredentialId,
                nativeScanEntryId,
                startedAt,
                originalAttestationVersion,
                originalAttestation
            ));
        } catch (VaultFailure failure) {
            throw Failure.from(failure);
        }
    }

    public Map<String, Object> attestOfflineCompletion(
        String expectedDeviceId,
        String locationCode,
        String clientSessionId,
        String clientCompletionId,
        String contextId,
        String nativeFinishScanEntryId,
        String startedAt,
        String endedAt,
        String originalAttestationVersion,
        String originalAttestation
    ) throws Failure {
        try {
            return immutableMap(engine.attestOfflineCompletion(
                expectedDeviceId,
                locationCode,
                clientSessionId,
                clientCompletionId,
                contextId,
                nativeFinishScanEntryId,
                startedAt,
                endedAt,
                originalAttestationVersion,
                originalAttestation
            ));
        } catch (VaultFailure failure) {
            throw Failure.from(failure);
        }
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }

    private static String installationNamespace(String deviceId, String installationSeal) throws VaultFailure {
        try {
            String input = "custodial-installation-v1|" + deviceId + "|" + installationSeal;
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            long most = 0L;
            long least = 0L;
            for (int index = 0; index < 8; index += 1) most = (most << 8) | (digest[index] & 0xffL);
            for (int index = 8; index < 16; index += 1) least = (least << 8) | (digest[index] & 0xffL);
            most = (most & 0xffffffffffff0fffL) | 0x0000000000005000L;
            least = (least & 0x3fffffffffffffffL) | 0x8000000000000000L;
            return new UUID(most, least).toString();
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_installation_identity_unavailable", error);
        }
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static long numberValue(Object value, long fallback) {
        return value instanceof Number ? ((Number) value).longValue() : fallback;
    }

    public static final class State {
        public final String phase;
        public final long revision;
        public final boolean active;
        public final boolean blocked;
        public final boolean recoveryRequired;
        public final String reason;
        public final String recoveryReason;
        public final String deviceId;
        public final String installationId;
        public final String employeeId;
        public final String employeeName;
        public final String credentialId;
        public final String credentialExpiresAt;
        public final String deviceName;
        public final boolean migratedFromCredentialOnlyState;

        State(
            String phase,
            long revision,
            boolean active,
            boolean blocked,
            boolean recoveryRequired,
            String reason,
            String recoveryReason,
            String deviceId,
            String installationId,
            String employeeId,
            String employeeName,
            String credentialId,
            String credentialExpiresAt,
            String deviceName,
            boolean migratedFromCredentialOnlyState
        ) {
            this.phase = phase;
            this.revision = revision;
            this.active = active;
            this.blocked = blocked;
            this.recoveryRequired = recoveryRequired;
            this.reason = reason;
            this.recoveryReason = recoveryReason;
            this.deviceId = deviceId;
            this.installationId = installationId;
            this.employeeId = employeeId;
            this.employeeName = employeeName;
            this.credentialId = credentialId;
            this.credentialExpiresAt = credentialExpiresAt;
            this.deviceName = deviceName;
            this.migratedFromCredentialOnlyState = migratedFromCredentialOnlyState;
        }
    }

    public static final class HttpResponse {
        public final int status;
        public final Map<String, String> headers;
        private final byte[] body;

        HttpResponse(int status, Map<String, String> headers, byte[] body) {
            this.status = status;
            this.headers = Collections.unmodifiableMap(new LinkedHashMap<>(headers));
            this.body = body.clone();
        }

        public byte[] body() {
            return body.clone();
        }

        public String bodyUtf8() {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    public static final class Failure extends Exception {
        public final String code;
        public final int httpStatus;
        public final String remoteReason;

        private Failure(String code, int httpStatus, String remoteReason, Throwable cause) {
            super(code, cause);
            this.code = code;
            this.httpStatus = httpStatus;
            this.remoteReason = remoteReason == null ? "" : remoteReason;
        }

        static Failure from(VaultFailure failure) {
            return new Failure(failure.code, failure.httpStatus, failure.remoteReason, failure);
        }
    }
}
