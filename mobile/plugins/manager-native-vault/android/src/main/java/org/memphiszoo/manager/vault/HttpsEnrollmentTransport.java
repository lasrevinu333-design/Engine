package org.memphiszoo.manager.vault;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Native-only Manager v2 transport. Device credentials, Play Integrity
 * evidence, result envelopes, and bearer sessions terminate here and are
 * scrubbed before any Capacitor response can be resolved.
 */
final class HttpsEnrollmentTransport implements EnrollmentTransport {
    static final String API_BASE = "https://memphis-zoo-mcp.onrender.com";
    static final String APP_ID = "org.memphiszoo.ops";
    private static final String NATIVE_ORIGIN = "https://localhost";
    private static final String ACCESS_LEVEL = "full_access";
    private static final String PLATFORM = "android";
    private static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    private static final long SESSION_SKEW_MILLIS = 30_000L;
    private static final Set<String> SAFE_RESPONSE_HEADERS = VaultCollections.setOf(
        "cache-control", "content-language", "content-type", "etag", "expires",
        "last-modified", "retry-after", "x-correlation-id", "x-request-id"
    );

    private final ManagerV2KeyCoordinator keyCoordinator;
    private final ManagerV2KeyRing keys;
    private final ManagerV2ProofFactory proofs;
    private final ManagerAppAttestation attestation;
    private final VaultClock clock;
    private final String deviceLabel;
    private final NativeHttpClient http;
    private final AuthorizedSessionOperationJournal sessionOperations;
    private SessionCache session;
    private char[] deviceSecurityCsrf;
    private char[] deviceSecurityCookie;

    HttpsEnrollmentTransport(
        ManagerV2KeyCoordinator keyCoordinator,
        ManagerV2KeyRing keys,
        ManagerAppAttestation attestation,
        VaultClock clock,
        String deviceLabel,
        AuthorizedSessionOperationJournal sessionOperations
    ) throws VaultFailure {
        this(
            keyCoordinator, keys, attestation, clock, deviceLabel,
            sessionOperations, HttpsEnrollmentTransport::executeNetwork
        );
    }

    HttpsEnrollmentTransport(
        ManagerV2KeyCoordinator keyCoordinator,
        ManagerV2KeyRing keys,
        ManagerAppAttestation attestation,
        VaultClock clock,
        String deviceLabel,
        AuthorizedSessionOperationJournal sessionOperations,
        NativeHttpClient http
    ) throws VaultFailure {
        this.keyCoordinator = keyCoordinator;
        this.keys = keys;
        this.attestation = attestation;
        this.clock = clock;
        if (http == null) throw new VaultFailure("manager_native_network_unavailable");
        if (sessionOperations == null) throw new VaultFailure("manager_v2_session_journal_unavailable");
        this.http = http;
        this.sessionOperations = sessionOperations;
        this.proofs = new ManagerV2ProofFactory(keys, clock);
        this.deviceLabel = VaultValidation.safeText(deviceLabel, 160, "manager_v2_invalid_device_label");
        if (this.deviceLabel.isEmpty()) throw new VaultFailure("manager_v2_invalid_device_label");
    }

    @Override
    public void prepareEnrollment(EnrollmentRequest request) throws VaultFailure {
        String flow = wireEnrollmentFlow(request.flow);
        if (flow.equals("recover")) {
            if (request.authorityOperationId.isEmpty()) {
                throw new VaultFailure("manager_native_replacement_required");
            }
            try {
                keyCoordinator.requireActive(request.authorityOperationId);
            } catch (VaultFailure error) {
                if (recoverAuthorityRequiresReplacement(error.code)) {
                    throw new VaultFailure("manager_native_replacement_required", error);
                }
                throw error;
            }
        }
        keyCoordinator.preparePending(request.operationId);
    }

    @Override
    public EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        String flow = wireEnrollmentFlow(request.flow);
        String challengeProofOperationId = request.operationId;
        if (flow.equals("recover")) {
            if (request.authorityOperationId.isEmpty()) {
                throw new VaultFailure("manager_native_replacement_required");
            }
            try {
                challengeProofOperationId = keyCoordinator.requireActive(request.authorityOperationId).operationId;
            } catch (VaultFailure error) {
                if (recoverAuthorityRequiresReplacement(error.code)) {
                    throw new VaultFailure("manager_native_replacement_required", error);
                }
                throw error;
            }
        }
        ManagerV2OperationRecord keyState = keyCoordinator.preparePending(request.operationId);
        String code = new String(enrollmentCode);
        try {
            Challenge challenge = challenge(
                challengeProofOperationId, request.operationId, flow, request.deviceId, keyState, null
            );
            String token = attestation.token(challenge.challenge);
            try {
                String evidenceDigest = ManagerV2WireContract.playIntegrityEvidenceDigest(APP_ID, token);
                String digest = ManagerV2WireContract.enrollmentBodyDigest(
                    request.operationId, flow, code, request.deviceId, deviceLabel, PLATFORM,
                    ACCESS_LEVEL, keyState.signingKeyId, keyState.wrappingKeyId,
                    attestation.provider(), challenge.challengeId, evidenceDigest
                );
                String path = "/manager-device-auth/v2/enrollment-operations";
                JSONObject body = baseEnrollmentBody(request, flow, code, keyState);
                body.put("attestation", new JSONObject()
                    .put("provider", attestation.provider())
                    .put("challenge_id", challenge.challengeId)
                    .put("app_id", APP_ID)
                    .put("token", token));
                body.put("proof", new JSONObject(proofs.create(request.operationId, request.operationId, path, digest)));
                JSONObject data = requireSuccessData(executeJson(path, body, request.operationId, null, request.deviceId), "manager_v2_enrollment_failed");
                return unsealEnrollment(request, keyState, data);
            } finally {
                token = "";
            }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_enrollment_failed", error);
        } finally {
            code = "";
        }
    }

    static String wireEnrollmentFlow(String localFlow) throws VaultFailure {
        return switch (VaultValidation.flow(localFlow)) {
            case "recovery" -> "recover";
            case "enrollment", "replacement" -> "enroll";
            default -> throw new VaultFailure("manager_native_invalid_enrollment");
        };
    }

    private static boolean recoverAuthorityRequiresReplacement(String code) {
        return Set.of(
            "manager_v2_active_keyset_missing",
            "manager_v2_operation_key_missing",
            "manager_v2_keystore_unavailable",
            "native_security_capability_required"
        ).contains(String.valueOf(code == null ? "" : code));
    }

    @Override
    public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
        return enrollmentAction(operationId, deviceId, "confirm", credential);
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId) throws VaultFailure {
        return enrollmentAction(operationId, deviceId, "cancel", null);
    }

    @Override
    public TerminalResult remove(
        String keyOperationId,
        String removalOperationId,
        String deviceId,
        char[] credential
    ) throws VaultFailure {
        ManagerV2OperationRecord keyState = keyCoordinator.requireActive(keyOperationId);
        String path = "/manager-device-auth/v2/removal-operations";
        String digest = ManagerV2WireContract.removeBodyDigest(removalOperationId, deviceId);
        try {
            JSONObject body = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", removalOperationId)
                .put("device_id", deviceId)
                .put("action", "remove")
                .put("proof", new JSONObject(proofs.create(keyOperationId, removalOperationId, path, digest)));
            JSONObject data = requireSuccessData(executeJson(path, body, removalOperationId, credential, deviceId), "manager_v2_removal_failed");
            requireContractOperation(data, removalOperationId);
            if (!"removed".equals(data.optString("status")) || !deviceId.equals(data.optString("device_id"))) {
                throw invalidResponse();
            }
            clearSession();
            return new TerminalResult(removalOperationId, TerminalOutcome.REMOVED, data.optBoolean("replayed", false));
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_removal_failed", error);
        }
    }

    @Override
    public synchronized void activateOperation(String operationId) throws VaultFailure {
        String activated = ManagerV2WireContract.operationId(operationId);
        keyCoordinator.promote(activated);
        if (session != null && !session.keyOperationId.equals(activated)) clearSession();
        SessionOperationRecord pendingSession = sessionOperations.load();
        if (pendingSession != null && !pendingSession.keyOperationId.equals(activated)) {
            sessionOperations.clearKeyOperation(pendingSession.keyOperationId);
        }
    }

    @Override
    public void cleanupOperation(String operationId) throws VaultFailure {
        keyCoordinator.destroy(operationId);
        sessionOperations.clearKeyOperation(operationId);
        clearSession();
    }

    @Override
    public void verifyAuthority(String keyOperationId) throws VaultFailure {
        keyCoordinator.requireActive(keyOperationId);
    }

    @Override
    public AuthorizedResponse authorized(
        AuthorizedRequest request,
        String keyOperationId,
        String deviceId,
        char[] credential
    ) throws VaultFailure {
        AuthorizedResponse first = authorizedOnce(
            request, keyOperationId, deviceId, credential
        );
        if (first.status != 401) return first;

        // A rejected bearer is never reused.  Drop both its in-memory secret
        // and any durable non-secret session-operation journal before creating
        // one fresh session and replaying the exact canonical request once.
        // No other application status is retried, and a second 401 clears the
        // replacement session before the sanitized response is returned.
        Arrays.fill(first.body, (byte) 0);
        rejectSession(keyOperationId);
        AuthorizedResponse retry = authorizedOnce(
            request, keyOperationId, deviceId, credential
        );
        if (retry.status == 401) rejectSession(keyOperationId);
        return retry;
    }

    private AuthorizedResponse authorizedOnce(
        AuthorizedRequest request,
        String keyOperationId,
        String deviceId,
        char[] credential
    ) throws VaultFailure {
        SessionProof proof = session(keyOperationId, deviceId, credential);
        char[] priorCsrf = null;
        char[] priorCookie = null;
        char[] currentCsrf = null;
        char[] currentCookie = null;
        try {
            Map<String, String> internalHeaders = new LinkedHashMap<>(request.headers);
            synchronized (this) {
                priorCsrf = deviceSecurityCsrf == null ? null : deviceSecurityCsrf.clone();
                priorCookie = deviceSecurityCookie == null ? null : deviceSecurityCookie.clone();
                if (requiresDeviceSecurityCapability(request.path)) {
                    if (deviceSecurityCsrf == null || deviceSecurityCookie == null) {
                        throw new VaultFailure("manager_native_device_security_locked");
                    }
                    internalHeaders.put("X-Device-Security-CSRF", new String(deviceSecurityCsrf));
                    internalHeaders.put("Cookie", new String(deviceSecurityCookie));
                }
            }
            HttpResult response = execute(
                request.path, request.method, VaultCollections.copyMap(internalHeaders), request.body,
                null, proof.token, deviceId
            );
            if (request.path.equals("/admin-api/device-security/unlock") && response.status >= 200 && response.status < 300) {
                captureDeviceSecurityCapability(response);
            }
            synchronized (this) {
                currentCsrf = deviceSecurityCsrf == null ? null : deviceSecurityCsrf.clone();
                currentCookie = deviceSecurityCookie == null ? null : deviceSecurityCookie.clone();
            }
            if (request.path.equals("/admin-api/device-security/lock") && response.status >= 200 && response.status < 300) {
                clearDeviceSecurityCapability();
            }
            Map<String, String> headers = safeResponseHeaders(
                response.headers, credential, proof.token,
                priorCsrf, priorCookie, currentCsrf, currentCookie
            );
            byte[] safeBody = scrubAuthorizedResponseBody(
                request.path, response.body, headers.getOrDefault("content-type", ""), credential, proof.token,
                priorCsrf, priorCookie, currentCsrf, currentCookie
            );
            return new AuthorizedResponse(response.status, headers, safeBody);
        } finally {
            VaultValidation.wipe(priorCsrf);
            VaultValidation.wipe(priorCookie);
            VaultValidation.wipe(currentCsrf);
            VaultValidation.wipe(currentCookie);
            proof.close();
        }
    }

    private synchronized void rejectSession(String keyOperationId) throws VaultFailure {
        clearSession();
        sessionOperations.clearKeyOperation(keyOperationId);
    }

    synchronized Map<String, Object> safeSessionState() {
        return session == null ? VaultCollections.mapOf() : VaultCollections.copyMap(session.safeState);
    }

    private JSONObject baseEnrollmentBody(
        EnrollmentRequest request,
        String flow,
        String code,
        ManagerV2OperationRecord keyState
    ) throws Exception {
        return new JSONObject()
            .put("contract_version", ManagerV2WireContract.CONTRACT)
            .put("operation_id", request.operationId)
            .put("flow", flow)
            .put("code", code)
            .put("device_id", request.deviceId)
            .put("device_label", deviceLabel)
            .put("platform", PLATFORM)
            .put("requested_access_level", ACCESS_LEVEL)
            .put("signing_public_key_jwk", new JSONObject(ManagerV2WireContract.publicJwk(keys.signingPublicKey(request.operationId))))
            .put("wrapping_public_key_jwk", new JSONObject(ManagerV2WireContract.publicJwk(keys.wrappingPublicKey(request.operationId))));
    }

    Challenge challenge(
        String keyOperationId,
        String requestOperationId,
        String purpose,
        String deviceId,
        ManagerV2OperationRecord keyState,
        char[] activeCredential
    ) throws VaultFailure {
        String path = "/manager-device-auth/v2/attestation-challenges";
        try {
            String digest = ManagerV2WireContract.challengeBodyDigest(
                requestOperationId, purpose, deviceId, deviceLabel, PLATFORM,
                keyState.signingKeyId, keyState.wrappingKeyId
            );
            JSONObject body = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", requestOperationId)
                .put("purpose", purpose)
                .put("device_id", deviceId)
                .put("device_label", deviceLabel)
                .put("platform", PLATFORM)
                .put("signing_public_key_jwk", new JSONObject(ManagerV2WireContract.publicJwk(keys.signingPublicKey(keyState.operationId))))
                .put("wrapping_public_key_jwk", new JSONObject(ManagerV2WireContract.publicJwk(keys.wrappingPublicKey(keyState.operationId))))
                .put("proof", new JSONObject(proofs.create(keyOperationId, requestOperationId, path, digest)));
            JSONObject data = requireSuccessData(
                executeJson(path, body, requestOperationId, activeCredential, deviceId),
                "manager_v2_challenge_failed"
            );
            requireContractOperation(data, requestOperationId);
            String provider = data.optString("provider", "");
            String challengeId = ManagerV2WireContract.operationId(data.optString("challenge_id", ""));
            String challenge = data.optString("challenge", "");
            ManagerV2WireContract.decodeBase64url(challenge, 32, "manager_v2_invalid_challenge");
            VaultValidation.timestamp(data.optString("expires_at", ""), "manager_v2_invalid_challenge");
            if (!provider.equals(attestation.provider()) || data.optString("policy_version", "").isEmpty()) {
                throw invalidResponse();
            }
            return new Challenge(challengeId, challenge);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_challenge_failed", error);
        }
    }

    private static boolean terminalMissingCancellation(VaultFailure error) {
        if (error == null) return false;
        return (error.httpStatus == 409 || error.httpStatus == 410) && Set.of(
            "manager_v2_operation_cancelled", "manager_v2_operation_expired"
        ).contains(error.remoteReason);
    }

    private EnrollmentResult unsealEnrollment(
        EnrollmentRequest request,
        ManagerV2OperationRecord keyState,
        JSONObject data
    ) throws VaultFailure {
        requireContractOperation(data, request.operationId);
        try {
            if (!"pending_confirmation".equals(data.optString("status"))) throw invalidResponse();
            String credentialId = ManagerV2WireContract.operationId(data.getString("credential_id"));
            String deviceId = ManagerV2WireContract.deviceId(data.getString("device_id"));
            String managerId = ManagerV2WireContract.operationId(data.getString("manager_id"));
            if (!deviceId.equals(request.deviceId)) throw invalidResponse();
            String credentialExpiresAt = VaultValidation.timestamp(data.getString("credential_expires_at"), "manager_v2_invalid_enrollment_response");
            String resumeExpiresAt = VaultValidation.timestamp(data.getString("resume_expires_at"), "manager_v2_invalid_enrollment_response");
            JSONObject envelope = exactEnvelope(data.getJSONObject("result_envelope"), keyState.wrappingKeyId);
            byte[] plaintext = decryptEnvelope(
                request.operationId, request.operationId, envelope,
                ManagerV2WireContract.envelopeAad(stringMap(
                    "operation_id", request.operationId,
                    "credential_id", credentialId,
                    "device_id", deviceId,
                    "manager_id", managerId,
                    "credential_expires_at", credentialExpiresAt,
                    "resume_expires_at", resumeExpiresAt,
                    "wrapping_key_id", envelope.getString("wrapping_key_id"),
                    "ephemeral_key_id", envelope.getString("ephemeral_key_id"),
                    "salt", envelope.getString("salt"),
                    "iv", envelope.getString("iv")
                )),
                false
            );
            char[] credential = null;
            try {
                JSONObject secret = exactJsonObject(plaintext, Set.of(
                    "contract_version", "operation_id", "credential_id", "device_credential",
                    "device_id", "manager_id", "credential_expires_at"
                ));
                if (!ManagerV2WireContract.CONTRACT.equals(secret.getString("contract_version"))
                    || !request.operationId.equals(secret.getString("operation_id"))
                    || !credentialId.equals(secret.getString("credential_id"))
                    || !deviceId.equals(secret.getString("device_id"))
                    || !managerId.equals(secret.getString("manager_id"))
                    || !credentialExpiresAt.equals(secret.getString("credential_expires_at"))) throw invalidResponse();
                String value = secret.getString("device_credential");
                if (!value.matches("^" + java.util.regex.Pattern.quote(credentialId) + "[.][A-Za-z0-9_-]{32,256}$")) {
                    throw invalidResponse();
                }
                credential = value.toCharArray();
                return new EnrollmentResult(
                    request.operationId, deviceId, request.flow, credential,
                    new EnrollmentMetadata(
                        credentialId, credentialExpiresAt, resumeExpiresAt, deviceLabel,
                        managerId, ""
                    ),
                    data.optBoolean("replayed", false)
                );
            } finally {
                VaultValidation.wipe(credential);
                Arrays.fill(plaintext, (byte) 0);
            }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_enrollment_response", error);
        }
    }

    private TerminalResult enrollmentAction(
        String operationId,
        String deviceId,
        String action,
        char[] credential
    ) throws VaultFailure {
        ManagerV2OperationRecord keyState = keyCoordinator.requirePending(operationId);
        String path = "/manager-device-auth/v2/enrollment-operations/" + operationId + "/" + action;
        String digest = ManagerV2WireContract.actionBodyDigest(operationId, action);
        try {
            JSONObject body = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", operationId)
                .put("action", action)
                .put("proof", new JSONObject(proofs.create(operationId, operationId, path, digest)));
            JSONObject data = requireSuccessData(executeJson(path, body, operationId, credential, deviceId), "manager_v2_" + action + "_failed");
            requireContractOperation(data, operationId);
            String status = data.optString("status", "");
            TerminalOutcome outcome = switch (status) {
                case "confirmed" -> TerminalOutcome.CONFIRMED;
                case "cancelled" -> TerminalOutcome.CANCELLED;
                case "expired" -> TerminalOutcome.EXPIRED;
                default -> throw invalidResponse();
            };
            if (action.equals("confirm") && outcome == TerminalOutcome.CANCELLED) throw invalidResponse();
            if (action.equals("cancel") && outcome == TerminalOutcome.CONFIRMED) throw invalidResponse();
            return new TerminalResult(operationId, outcome, data.optBoolean("replayed", false));
        } catch (VaultFailure error) {
            if (action.equals("cancel") && terminalMissingCancellation(error)) {
                TerminalOutcome outcome = error.remoteReason.contains("cancelled")
                    ? TerminalOutcome.CANCELLED
                    : TerminalOutcome.EXPIRED;
                return new TerminalResult(operationId, outcome, true);
            }
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_" + action + "_failed", error);
        }
    }

    private synchronized SessionProof session(
        String keyOperationId,
        String deviceId,
        char[] credential
    ) throws VaultFailure {
        if (session != null && session.expiresAtMillis - SESSION_SKEW_MILLIS > clock.nowMillis()
            && session.deviceId.equals(deviceId)
            && session.keyOperationId.equals(keyOperationId)) {
            return session.copyProof();
        }
        clearSession();
        return establishSession(keyOperationId, deviceId, credential, true);
    }

    private SessionProof establishSession(
        String keyOperationId,
        String deviceId,
        char[] credential,
        boolean allowTerminalRetry
    ) throws VaultFailure {
        ManagerV2OperationRecord keyState = keyCoordinator.requireActive(keyOperationId);
        SessionOperationRecord operation = sessionOperations.acquire(
            keyOperationId, deviceId, clock.nowMillis()
        );
        String operationId = operation.operationId;
        String token = "";
        try {
            Challenge challenge = challenge(
                keyOperationId, operationId, "authorized_session", deviceId, keyState, credential
            );
            token = attestation.token(challenge.challenge);
            String evidenceDigest = ManagerV2WireContract.playIntegrityEvidenceDigest(APP_ID, token);
            String digest = ManagerV2WireContract.authorizedSessionBodyDigest(
                operationId, deviceId, ACCESS_LEVEL, attestation.provider(), challenge.challengeId, evidenceDigest
            );
            String path = "/manager-device-auth/v2/authorized-sessions";
            JSONObject body = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", operationId)
                .put("device_id", deviceId)
                .put("requested_access_level", ACCESS_LEVEL)
                .put("attestation", new JSONObject()
                    .put("provider", attestation.provider())
                    .put("challenge_id", challenge.challengeId)
                    .put("app_id", APP_ID)
                    .put("token", token))
                .put("proof", new JSONObject(proofs.create(keyOperationId, operationId, path, digest)));
            JSONObject data = requireSuccessData(executeJson(path, body, operationId, credential, deviceId), "manager_v2_session_failed");
            requireContractOperation(data, operationId);
            String sessionId = ManagerV2WireContract.operationId(data.getString("session_id"));
            String credentialId = ManagerV2WireContract.operationId(data.getString("credential_id"));
            String responseDevice = ManagerV2WireContract.deviceId(data.getString("device_id"));
            String managerId = ManagerV2WireContract.operationId(data.getString("manager_id"));
            String access = data.getString("access_level");
            if (!"authorized".equals(data.optString("status")) || !ACCESS_LEVEL.equals(access) || !responseDevice.equals(deviceId)
                || !new String(credential).startsWith(credentialId + ".")) throw invalidResponse();
            String expiresAt = VaultValidation.timestamp(data.getString("session_expires_at"), "manager_v2_invalid_session_response");
            long expiresAtMillis = VaultTimestamps.epochMillis(expiresAt, "manager_v2_invalid_session_response");
            if (expiresAtMillis - SESSION_SKEW_MILLIS <= clock.nowMillis()) {
                throw new VaultFailure("manager_v2_session_operation_expired");
            }
            List<String> roles = safeRoles(data.getJSONArray("roles"));
            String rolesBinding = String.join(",", roles);
            JSONObject envelope = exactEnvelope(data.getJSONObject("result_envelope"), keyState.wrappingKeyId);
            byte[] plaintext = decryptEnvelope(
                keyOperationId, operationId, envelope,
                ManagerV2WireContract.sessionEnvelopeAad(stringMap(
                    "operation_id", operationId,
                    "session_id", sessionId,
                    "credential_id", credentialId,
                    "device_id", deviceId,
                    "manager_id", managerId,
                    "roles", rolesBinding,
                    "access_level", access,
                    "session_expires_at", expiresAt,
                    "wrapping_key_id", envelope.getString("wrapping_key_id"),
                    "ephemeral_key_id", envelope.getString("ephemeral_key_id"),
                    "salt", envelope.getString("salt"),
                    "iv", envelope.getString("iv")
                )),
                true
            );
            char[] bearer = null;
            try {
                bearer = parseAuthorizedSessionSecret(
                    plaintext, operationId, sessionId, deviceId, managerId,
                    roles, access, expiresAt
                );
                Map<String, Object> safe = new LinkedHashMap<>();
                safe.put("manager_id", managerId);
                safe.put("roles", roles);
                safe.put("access_level", access);
                safe.put("expires_at", expiresAt);
                safe.put("native_authenticated", true);
                // The bearer is deliberately memory-only. Clear the durable
                // non-secret operation only after the complete response has
                // authenticated and decrypted; a failed clear leaves no bearer
                // cached and forces a safe same-operation replay after restart.
                sessionOperations.complete(operationId);
                session = new SessionCache(
                    keyOperationId, deviceId, expiresAtMillis, bearer,
                    VaultCollections.copyMap(safe)
                );
                return session.copyProof();
            } finally {
                VaultValidation.wipe(bearer);
                Arrays.fill(plaintext, (byte) 0);
            }
        } catch (VaultFailure error) {
            if (allowTerminalRetry && terminalSessionOperation(error)) {
                sessionOperations.abandon(operationId);
                return establishSession(keyOperationId, deviceId, credential, false);
            }
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_session_failed", error);
        } finally {
            token = "";
        }
    }

    private static boolean terminalSessionOperation(VaultFailure error) {
        if (error == null) return false;
        if (error.code.equals("manager_v2_session_operation_expired")) return true;
        return (error.httpStatus == 409 || error.httpStatus == 410) && Set.of(
            "operation_expired", "operation_cancelled", "session_expired"
        ).contains(error.remoteReason);
    }

    private byte[] decryptEnvelope(
        String keyOperationId,
        String envelopeOperationId,
        JSONObject envelope,
        byte[] aad,
        boolean sessionEnvelope
    ) throws Exception {
        Map<String, String> jwk = jwk(envelope.getJSONObject("ephemeral_public_key_jwk"));
        PublicKey ephemeral = ManagerV2WireContract.publicKey(jwk);
        if (!ManagerV2WireContract.thumbprint(ephemeral).equals(envelope.getString("ephemeral_key_id"))) {
            throw invalidResponse();
        }
        byte[] salt = decode(envelope.getString("salt"), 32, 32);
        byte[] iv = decode(envelope.getString("iv"), 12, 12);
        byte[] ciphertext = decode(envelope.getString("ciphertext"), 1, 64 * 1024);
        byte[] tag = decode(envelope.getString("tag"), 16, 16);
        try {
            return sessionEnvelope
                ? keys.decryptSessionEnvelope(
                    keyOperationId, envelopeOperationId, ephemeral, envelope.getString("wrapping_key_id"),
                    salt, iv, ciphertext, tag, aad
                )
                : keys.decryptEnvelope(
                    keyOperationId, ephemeral, envelope.getString("wrapping_key_id"),
                    salt, iv, ciphertext, tag, aad
                );
        } finally {
            Arrays.fill(salt, (byte) 0);
            Arrays.fill(iv, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            Arrays.fill(tag, (byte) 0);
            Arrays.fill(aad, (byte) 0);
        }
    }

    private static JSONObject exactEnvelope(JSONObject value, String wrappingKeyId) throws Exception {
        requireExactKeys(value, Set.of(
            "algorithm", "ephemeral_public_key_jwk", "ephemeral_key_id", "wrapping_key_id",
            "salt", "iv", "ciphertext", "tag"
        ), "manager_v2_invalid_envelope");
        if (!ManagerV2WireContract.ENVELOPE_ALGORITHM.equals(value.getString("algorithm"))
            || !wrappingKeyId.equals(value.getString("wrapping_key_id"))) throw invalidResponse();
        ManagerV2WireContract.decodeBase64url(value.getString("ephemeral_key_id"), 32, "manager_v2_invalid_envelope");
        return value;
    }

    private static Map<String, String> jwk(JSONObject value) throws VaultFailure {
        try {
            requireExactKeys(value, Set.of("kty", "crv", "x", "y"), "manager_v2_invalid_public_key");
            Map<String, String> result = new LinkedHashMap<>();
            for (String key : List.of("kty", "crv", "x", "y")) result.put(key, value.getString(key));
            return Map.copyOf(result);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_public_key", error);
        }
    }

    private static Map<String, String> stringMap(String... values) throws VaultFailure {
        if (values == null || values.length == 0 || values.length % 2 != 0) throw invalidResponse();
        Map<String, String> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            String prior = result.put(values[index], values[index + 1]);
            if (prior != null) throw invalidResponse();
        }
        return VaultCollections.copyMap(result);
    }

    private static List<String> safeRoles(JSONArray value) throws VaultFailure {
        List<String> canonical = List.of(
            "OPS_MANAGER", "CUSTODIAL_MANAGER", "DIRECTOR", "SECURITY_ADMIN"
        );
        if (value.length() < 1 || value.length() > canonical.size()) throw invalidResponse();
        List<String> roles = new ArrayList<>();
        int priorOrder = -1;
        for (int index = 0; index < value.length(); index += 1) {
            String role = value.optString(index, "");
            int order = canonical.indexOf(role);
            if (order <= priorOrder) throw invalidResponse();
            roles.add(role);
            priorOrder = order;
        }
        if (!roles.get(0).equals("OPS_MANAGER")) throw invalidResponse();
        return List.copyOf(roles);
    }

    static char[] parseAuthorizedSessionSecret(
        byte[] plaintext,
        String operationId,
        String sessionId,
        String deviceId,
        String managerId,
        List<String> roles,
        String access,
        String expiresAt
    ) throws VaultFailure {
        try {
            JSONObject secret = exactJsonObject(plaintext, Set.of(
                "contract_version", "operation_id", "session_id", "ops_session",
                "device_id", "manager_id", "roles", "access_level", "expires_at"
            ));
            if (!ManagerV2WireContract.CONTRACT.equals(secret.getString("contract_version"))
                || !operationId.equals(secret.getString("operation_id"))
                || !sessionId.equals(secret.getString("session_id"))
                || !deviceId.equals(secret.getString("device_id"))
                || !managerId.equals(secret.getString("manager_id"))
                || !roles.equals(safeRoles(secret.getJSONArray("roles")))
                || !access.equals(secret.getString("access_level"))
                || !expiresAt.equals(secret.getString("expires_at"))) throw invalidResponse();
            return ManagerV2WireContract.opsSession(secret.getString("ops_session")).toCharArray();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_envelope_plaintext", error);
        }
    }

    private static void requireContractOperation(JSONObject data, String operationId) throws VaultFailure {
        if (!ManagerV2WireContract.CONTRACT.equals(data.optString("contract_version"))
            || !operationId.equals(data.optString("operation_id"))) throw invalidResponse();
    }

    private static void requireExactKeys(JSONObject object, Set<String> expected, String code) throws VaultFailure {
        if (object == null || object.length() != expected.size()) throw new VaultFailure(code);
        for (String key : expected) if (!object.has(key)) throw new VaultFailure(code);
    }

    private static JSONObject exactJsonObject(byte[] bytes, Set<String> keys) throws VaultFailure {
        try {
            Object value = strictJson(bytes);
            if (!(value instanceof JSONObject object)) throw invalidResponse();
            requireExactKeys(object, keys, "manager_v2_invalid_envelope_plaintext");
            return object;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_invalid_envelope_plaintext", error);
        }
    }

    private static byte[] decode(String value, int minimum, int maximum) throws VaultFailure {
        if (value == null || value.isEmpty() || value.contains("=")) throw invalidResponse();
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(value);
            if (decoded.length < minimum || decoded.length > maximum
                || !Base64.getUrlEncoder().withoutPadding().encodeToString(decoded).equals(value)) throw invalidResponse();
            return decoded;
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("manager_v2_invalid_envelope", error);
        }
    }

    private HttpResult executeJson(
        String path,
        JSONObject body,
        String idempotencyKey,
        char[] credential,
        String deviceId
    ) throws VaultFailure {
        return execute(
            path, "POST",
            VaultCollections.mapOf("Idempotency-Key", idempotencyKey, "Content-Type", "application/json"),
            body.toString().getBytes(StandardCharsets.UTF_8), credential, null, deviceId
        );
    }

    static JSONObject requireSuccessData(HttpResult response, String code) throws VaultFailure {
        if (response.status < 200 || response.status >= 300) {
            String remoteReason = "";
            try {
                Object errorPayload = strictJson(response.body);
                if (errorPayload instanceof JSONObject object) {
                    String candidate = object.optString("code", "").trim().toLowerCase(Locale.ROOT);
                    if (candidate.matches("^[a-z][a-z0-9_:-]{0,95}$")) remoteReason = candidate;
                }
            } catch (VaultFailure ignored) {}
            throw new VaultFailure(code, response.status, remoteReason);
        }
        try {
            Object parsed = strictJson(response.body);
            if (!(parsed instanceof JSONObject payload) || !payload.optBoolean("ok", false)) throw new VaultFailure(code);
            requireExactKeys(payload, Set.of("ok", "data"), code);
            JSONObject data = payload.optJSONObject("data");
            if (data == null) throw new VaultFailure(code);
            return data;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        }
    }

    private HttpResult execute(
        String path,
        String method,
        Map<String, String> suppliedHeaders,
        byte[] body,
        char[] credential,
        char[] bearerToken,
        String deviceId
    ) throws VaultFailure {
        return http.execute(path, method, suppliedHeaders, body, credential, bearerToken, deviceId);
    }

    private static HttpResult executeNetwork(
        String path,
        String method,
        Map<String, String> suppliedHeaders,
        byte[] body,
        char[] credential,
        char[] bearerToken,
        String deviceId
    ) throws VaultFailure {
        HttpURLConnection connection = null;
        String credentialHeader = credential == null ? null : new String(credential);
        String bearerHeader = bearerToken == null ? null : new String(bearerToken);
        try {
            connection = (HttpURLConnection) new URL(API_BASE + path).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(60_000);
            connection.setUseCaches(false);
            connection.setRequestMethod(method);
            for (Map.Entry<String, String> entry : suppliedHeaders.entrySet()) {
                connection.setRequestProperty(entry.getKey(), entry.getValue());
            }
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Origin", NATIVE_ORIGIN);
            connection.setRequestProperty("X-Memphis-App-Edition", "manager");
            connection.setRequestProperty("X-Device-Id", deviceId);
            if (credentialHeader != null) connection.setRequestProperty("Authorization", "Device " + credentialHeader);
            if (bearerHeader != null) connection.setRequestProperty("Authorization", "Bearer " + bearerHeader);
            if (body.length > 0) {
                connection.setDoOutput(true);
                connection.getOutputStream().write(body);
                connection.getOutputStream().close();
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new VaultFailure("manager_native_redirect_refused", status);
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            return new HttpResult(status, connection.getHeaderFields(), readBounded(stream, MAX_RESPONSE_BYTES));
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_network_unavailable", error);
        } finally {
            credentialHeader = null;
            bearerHeader = null;
            if (connection != null) connection.disconnect();
        }
    }

    private static byte[] readBounded(InputStream stream, int maximum) throws VaultFailure {
        if (stream == null) return new byte[0];
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16_384];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > maximum) throw new VaultFailure("manager_native_response_too_large");
                output.write(buffer, 0, count);
            }
            Arrays.fill(buffer, (byte) 0);
            return output.toByteArray();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_network_unavailable", error);
        }
    }

    static Map<String, String> safeResponseHeaders(
        Map<String, List<String>> raw,
        char[]... secrets
    ) {
        Map<String, String> safe = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) continue;
            String normalized = entry.getKey().toLowerCase(Locale.ROOT);
            if (!SAFE_RESPONSE_HEADERS.contains(normalized) || SecretScrubber.secretKey(normalized)) continue;
            String value = String.join(", ", entry.getValue());
            if (value.length() <= 8192 && !value.contains("\r") && !value.contains("\n")
                && !containsExactSecret(value, secrets)) safe.put(normalized, value);
        }
        return VaultCollections.copyMap(safe);
    }

    private static boolean containsExactSecret(String value, char[]... secrets) {
        if (value == null || value.isEmpty() || secrets == null) return false;
        for (char[] secret : secrets) {
            if (secret != null && secret.length > 0 && value.contains(new String(secret))) return true;
        }
        return false;
    }

    static byte[] scrubResponseBody(byte[] raw, String contentType, char[]... secrets) throws VaultFailure {
        return scrubResponseBody(raw, contentType, Set.of(), secrets);
    }

    static byte[] scrubAuthorizedResponseBody(
        String path,
        byte[] raw,
        String contentType,
        char[]... secrets
    ) throws VaultFailure {
        Set<String> disclosedSecretKeys = "/admin-api/device-auth/enrollment-code".equals(path)
            ? Set.of("enrollmentcode")
            : Set.of();
        return scrubResponseBody(raw, contentType, disclosedSecretKeys, secrets);
    }

    private static byte[] scrubResponseBody(
        byte[] raw,
        String contentType,
        Set<String> disclosedSecretKeys,
        char[]... secrets
    ) throws VaultFailure {
        if (raw.length == 0) return raw;
        String source = new String(raw, StandardCharsets.UTF_8);
        String trimmed = source.trim();
        boolean json = contentType.toLowerCase(Locale.ROOT).contains("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
        if (!json) {
            for (char[] secret : secrets) if (secret != null && source.contains(new String(secret))) {
                throw new VaultFailure("manager_native_secret_response_refused");
            }
            return raw.clone();
        }
        Object parsed = strictJson(raw);
        Object scrubbed = SecretScrubber.scrub(parsed, null, disclosedSecretKeys);
        for (char[] secret : secrets) {
            if (secret != null) scrubbed = SecretScrubber.scrub(scrubbed, secret, disclosedSecretKeys);
        }
        String encoded;
        if (scrubbed instanceof Map<?, ?> map) encoded = new JSONObject(map).toString();
        else if (scrubbed instanceof List<?> list) encoded = new JSONArray(list).toString();
        else if (scrubbed == null) encoded = "null";
        else if (scrubbed instanceof String) encoded = JSONObject.quote((String) scrubbed);
        else if (scrubbed instanceof Number || scrubbed instanceof Boolean) encoded = String.valueOf(scrubbed);
        else throw new VaultFailure("manager_native_invalid_response");
        return encoded.getBytes(StandardCharsets.UTF_8);
    }

    static Object strictJson(byte[] bytes) throws VaultFailure {
        try {
            String source = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                .decode(java.nio.ByteBuffer.wrap(bytes)).toString();
            JSONTokener parser = new JSONTokener(source);
            Object value = parser.nextValue();
            if (parser.nextClean() != 0) throw new VaultFailure("manager_native_invalid_response");
            return value;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_invalid_response", error);
        }
    }

    private static boolean requiresDeviceSecurityCapability(String path) {
        if (!path.startsWith("/admin-api/")) return false;
        return !path.equals("/admin-api/health")
            && !path.equals("/admin-api/device-auth/summary")
            && !path.equals("/admin-api/device-security/session")
            && !path.equals("/admin-api/device-security/unlock");
    }

    private synchronized void captureDeviceSecurityCapability(HttpResult response) throws VaultFailure {
        JSONObject data = requireSuccessData(response, "manager_native_device_security_unlock_failed");
        String csrf = data.optString("csrf_token", "").trim();
        String cookie = firstCookie(response.headers);
        if (csrf.length() < 24 || csrf.length() > 1024 || cookie.length() < 8 || cookie.length() > 4096
            || csrf.contains("\r") || csrf.contains("\n") || cookie.contains("\r") || cookie.contains("\n")) {
            throw new VaultFailure("manager_native_device_security_capability_invalid");
        }
        clearDeviceSecurityCapability();
        deviceSecurityCsrf = csrf.toCharArray();
        deviceSecurityCookie = cookie.toCharArray();
    }

    private static String firstCookie(Map<String, List<String>> headers) {
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            if (entry.getKey() == null || !entry.getKey().equalsIgnoreCase("set-cookie") || entry.getValue() == null) continue;
            for (String raw : entry.getValue()) {
                String first = String.valueOf(raw).split(";", 2)[0].trim();
                if (!first.isEmpty()) return first;
            }
        }
        return "";
    }

    private synchronized void clearSession() {
        if (session != null) session.close();
        session = null;
        clearDeviceSecurityCapability();
    }

    private synchronized void clearDeviceSecurityCapability() {
        VaultValidation.wipe(deviceSecurityCsrf);
        VaultValidation.wipe(deviceSecurityCookie);
        deviceSecurityCsrf = null;
        deviceSecurityCookie = null;
    }

    private static VaultFailure invalidResponse() {
        return new VaultFailure("manager_v2_invalid_response");
    }

    static final class HttpResult {
        final int status;
        final Map<String, List<String>> headers;
        final byte[] body;
        HttpResult(int status, Map<String, List<String>> headers, byte[] body) {
            this.status = status;
            this.headers = headers == null ? Map.of() : headers;
            this.body = body == null ? new byte[0] : body;
        }
    }

    interface NativeHttpClient {
        HttpResult execute(
            String path,
            String method,
            Map<String, String> headers,
            byte[] body,
            char[] credential,
            char[] bearerToken,
            String deviceId
        ) throws VaultFailure;
    }

    record Challenge(String challengeId, String challenge) {}

    private static final class SessionCache implements AutoCloseable {
        final String keyOperationId;
        final String deviceId;
        final long expiresAtMillis;
        final char[] token;
        final Map<String, Object> safeState;
        SessionCache(
            String keyOperationId,
            String deviceId,
            long expiresAtMillis,
            char[] token,
            Map<String, Object> safeState
        ) {
            this.keyOperationId = keyOperationId;
            this.deviceId = deviceId;
            this.expiresAtMillis = expiresAtMillis;
            this.token = token.clone();
            this.safeState = safeState;
        }
        SessionProof copyProof() { return new SessionProof(token); }
        public void close() { VaultValidation.wipe(token); }
    }

    private static final class SessionProof implements AutoCloseable {
        final char[] token;
        SessionProof(char[] token) { this.token = token.clone(); }
        public void close() { VaultValidation.wipe(token); }
    }
}
