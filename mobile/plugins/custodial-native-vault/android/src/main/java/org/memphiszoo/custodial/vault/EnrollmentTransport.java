package org.memphiszoo.custodial.vault;

import java.util.Map;

interface EnrollmentTransport {
    EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure;

    TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure;

    TerminalResult cancel(String operationId, String deviceId, char[] credential) throws VaultFailure;

    TerminalResult remove(String operationId, String deviceId, char[] credential) throws VaultFailure;

    String verifyLegacyIdentity(String candidateDeviceId, char[] credential) throws VaultFailure;

    ActiveCredentialStatus verifyActiveCredential(
        String deviceId,
        String expectedCredentialId,
        char[] credential
    ) throws VaultFailure;

    AuthorizedResponse authorized(AuthorizedRequest request, String deviceId, char[] credential) throws VaultFailure;
}

enum ActiveCredentialStatus {
    ACCEPTED,
    ENROLLMENT_REQUIRED
}

final class EnrollmentRequest {
    final String operationId;
    final String deviceId;
    final String flow;

    EnrollmentRequest(String operationId, String deviceId, String flow) throws VaultFailure {
        this.operationId = VaultValidation.operationId(operationId);
        this.deviceId = VaultValidation.deviceId(deviceId);
        this.flow = VaultValidation.flow(flow);
    }
}

final class EnrollmentResult implements AutoCloseable {
    final String operationId;
    final String deviceId;
    final String flow;
    final char[] credential;
    final EnrollmentMetadata metadata;
    final boolean replayed;

    EnrollmentResult(
        String operationId,
        String deviceId,
        String flow,
        char[] credential,
        EnrollmentMetadata metadata,
        boolean replayed
    ) throws VaultFailure {
        this.operationId = VaultValidation.operationId(operationId);
        this.deviceId = VaultValidation.deviceId(deviceId);
        this.flow = VaultValidation.flow(flow);
        if (credential == null || credential.length < 16 || credential.length > 4096) {
            throw new VaultFailure("custodial_native_invalid_enrollment_response");
        }
        this.credential = credential.clone();
        this.metadata = metadata == null ? EnrollmentMetadata.empty() : metadata;
        this.replayed = replayed;
    }

    @Override
    public void close() {
        VaultValidation.wipe(credential);
    }
}

final class TerminalResult {
    final String operationId;
    final boolean replayed;

    TerminalResult(String operationId, boolean replayed) throws VaultFailure {
        this.operationId = VaultValidation.operationId(operationId);
        this.replayed = replayed;
    }
}

final class AuthorizedRequest {
    final String path;
    final String method;
    final Map<String, String> headers;
    final byte[] body;

    AuthorizedRequest(String path, String method, Map<String, String> headers, byte[] body) {
        this.path = path;
        this.method = method;
        this.headers = VaultCollections.copyMap(headers);
        this.body = body.clone();
    }
}

final class AuthorizedResponse {
    final int status;
    final Map<String, String> headers;
    final byte[] body;

    AuthorizedResponse(int status, Map<String, String> headers, byte[] body) throws VaultFailure {
        if (status < 100 || status > 599 || headers == null || body == null) {
            throw new VaultFailure("custodial_native_invalid_response");
        }
        this.status = status;
        this.headers = VaultCollections.copyMap(headers);
        this.body = body.clone();
    }
}
