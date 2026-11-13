package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

final class InstrumentedTransport implements EnrollmentTransport {
    static final String CREDENTIAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.instrumented-device-credential-0002";
    private final VaultClock clock;
    boolean confirmed;
    boolean issued;
    boolean cancelled;
    boolean removed;
    boolean serveCompletion;
    final AtomicInteger completionCalls = new AtomicInteger();
    final AtomicInteger enrollCalls = new AtomicInteger();
    final AtomicInteger issuanceCount = new AtomicInteger();
    final AtomicInteger cancelCalls = new AtomicInteger();
    final AtomicInteger removeCalls = new AtomicInteger();

    InstrumentedTransport(VaultClock clock) {
        this.clock = clock;
    }

    @Override
    public synchronized EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        enrollCalls.incrementAndGet();
        boolean replayed = issued;
        if (!issued) {
            issued = true;
            issuanceCount.incrementAndGet();
        }
        if (cancelled) throw new VaultFailure("instrumented_operation_cancelled", 409, "operation_cancelled");
        return new EnrollmentResult(
            request.operationId,
            request.deviceId,
            request.flow,
            CREDENTIAL.toCharArray(),
            new EnrollmentMetadata(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                Instant.ofEpochMilli(clock.nowMillis() + 86_400_000L).toString(),
                Instant.ofEpochMilli(clock.nowMillis() + 20L * 60L * 1000L).toString(),
                "Instrumented phone",
                "employee-test",
                "Instrumented Employee"
            ),
            replayed
        );
    }

    @Override
    public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        confirmed = true;
        return new TerminalResult(operationId, false);
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        cancelCalls.incrementAndGet();
        boolean replayed = cancelled;
        cancelled = true;
        return new TerminalResult(operationId, replayed);
    }

    @Override
    public TerminalResult remove(String operationId, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        removeCalls.incrementAndGet();
        removed = true;
        return new TerminalResult(operationId, false);
    }

    @Override
    public String verifyLegacyIdentity(String candidateDeviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        return VaultValidation.deviceId(candidateDeviceId);
    }

    @Override
    public ActiveCredentialStatus verifyActiveCredential(
        String deviceId,
        String expectedCredentialId,
        char[] credential
    ) throws VaultFailure {
        requireCredential(credential);
        VaultValidation.deviceId(deviceId);
        if (!"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".equals(expectedCredentialId)) {
            throw new VaultFailure("instrumented_credential_id_mismatch");
        }
        return confirmed && !cancelled && !removed
            ? ActiveCredentialStatus.ACCEPTED
            : ActiveCredentialStatus.ENROLLMENT_REQUIRED;
    }

    @Override
    public AuthorizedResponse authorized(AuthorizedRequest request, String deviceId, char[] credential) throws VaultFailure {
        requireCredential(credential);
        if (!confirmed || cancelled || removed) throw new VaultFailure("instrumented_not_active", 401);
        if (serveCompletion && "/scan-api/rpc".equals(request.path) && "POST".equals(request.method)) {
            try {
                org.json.JSONObject envelope = new org.json.JSONObject(new String(request.body,StandardCharsets.UTF_8));
                if (!"tool_commit_cleaning_workflow".equals(envelope.getString("fn"))) throw new VaultFailure("instrumented_unexpected_function");
                org.json.JSONObject args=envelope.getJSONObject("args");
                org.json.JSONObject result=new org.json.JSONObject().put("status","closed")
                    .put("client_session_id",args.getString("p_client_session_id"))
                    .put("client_completion_id",args.getString("p_client_completion_id"));
                completionCalls.incrementAndGet();
                return new AuthorizedResponse(200,Map.of("content-type","application/json"),
                    new org.json.JSONObject().put("ok",true).put("data",result).toString().getBytes(StandardCharsets.UTF_8));
            } catch(VaultFailure error) { throw error; }
            catch(Exception error) { throw new VaultFailure("instrumented_invalid_completion",error); }
        }

        return new AuthorizedResponse(
            200,
            Map.of("content-type", "application/json"),
            "{\"ok\":true,\"data\":{\"authenticated\":true}}".getBytes(StandardCharsets.UTF_8)
        );
    }

    private static void requireCredential(char[] supplied) throws VaultFailure {
        char[] expected = CREDENTIAL.toCharArray();
        try {
            if (!VaultValidation.sameSecret(expected, supplied)) throw new VaultFailure("instrumented_credential_mismatch");
        } finally {
            VaultValidation.wipe(expected);
        }
    }

    synchronized int activeCredentials() {
        return issued && !cancelled && !removed ? 1 : 0;
    }
}
