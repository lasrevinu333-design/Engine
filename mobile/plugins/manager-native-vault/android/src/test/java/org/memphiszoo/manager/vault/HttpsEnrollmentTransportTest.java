package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Test;

public final class HttpsEnrollmentTransportTest {
    private static final String OP = "11111111-1111-4111-8111-111111111111";
    private static final String OTHER = "22222222-2222-4222-8222-222222222222";
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";
    private static final long NOW = 1_800_000_000_000L;

    @Test
    public void localReplacementUsesFreshWireEnrollmentWithoutOverloadingRecovery() throws Exception {
        assertEquals("enroll", HttpsEnrollmentTransport.wireEnrollmentFlow("enrollment"));
        assertEquals("enroll", HttpsEnrollmentTransport.wireEnrollmentFlow("replacement"));
        assertEquals("recover", HttpsEnrollmentTransport.wireEnrollmentFlow("recovery"));
    }

    @Test
    public void everyCanonicalSecretKeyIsRemovedBeforeNativeResponseCrossesWebView() throws Exception {
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(
            "manager-secret-key-names-v2.json"
        )) {
            if (input == null) fail("missing manager-secret-key-names-v2.json");
            JSONObject contract = new JSONObject(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            assertEquals("manager-secret-key-names.v2", contract.getString("contract_version"));
            Set<String> expected = new java.util.LinkedHashSet<>();
            org.json.JSONArray keys = contract.getJSONArray("normalized_keys");
            for (int index = 0; index < keys.length(); index += 1) expected.add(keys.getString(index));
            assertEquals(expected, SecretScrubber.secretKeyInventory());
            for (String key : expected) {
                byte[] raw = new JSONObject()
                    .put("ok", true)
                    .put(key, "unknown_native_secret.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
                    .toString().getBytes(StandardCharsets.UTF_8);
                byte[] safe = HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
                    "/messaging-api/health", raw, "application/json"
                );
                JSONObject value = new JSONObject(new String(safe, StandardCharsets.UTF_8));
                assertTrue(value.getBoolean("ok"));
                assertFalse("secret key crossed native boundary: " + key, value.has(key));
            }
        }
    }

    @Test
    public void everyAllowedResponseHeaderDropsCredentialBearerCsrfAndCookieEchoes() throws Exception {
        List<String> allowed = List.of(
            "cache-control", "content-language", "content-type", "etag", "expires",
            "last-modified", "retry-after", "x-correlation-id", "x-request-id"
        );
        char[][] secrets = new char[][] {
            "credential-id.device-secret-value-0123456789".toCharArray(),
            "native_session_secret.signature_0123456789abcdef".toCharArray(),
            "csrf-secret-value-0123456789abcdef".toCharArray(),
            "device-security-cookie-secret-value".toCharArray(),
        };
        for (String header : allowed) {
            for (char[] secret : secrets) {
                Map<String, String> safe = HttpsEnrollmentTransport.safeResponseHeaders(
                    Map.of(header, List.of("prefix-" + new String(secret) + "-suffix")),
                    secrets
                );
                assertFalse("secret response header crossed native boundary: " + header, safe.containsKey(header));
            }
        }
        assertEquals(
            Map.of("etag", "safe-public-validator"),
            HttpsEnrollmentTransport.safeResponseHeaders(
                Map.of("etag", List.of("safe-public-validator")), secrets
            )
        );
    }

    @Test
    public void recoverChallengeUsesCurrentProofKeyWhileBindingFreshPendingPublicKeys() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        ManagerV2OperationRecord pending = coordinator.preparePending(OTHER);
        RotatingChallengeHttp http = new RotatingChallengeHttp(clock);

        transport(coordinator, keys, clock, http).challenge(
            OP, OTHER, "recover", DEVICE, pending, null
        );

        assertEquals(List.of(OP), keys.signOperationIds);
        JSONObject request = http.requests.get(0);
        JSONObject actualSigning = request.getJSONObject("signing_public_key_jwk");
        JSONObject expectedSigning = new JSONObject(
            ManagerV2WireContract.publicJwk(keys.signingPublicKey(OTHER))
        );
        JSONObject actualWrapping = request.getJSONObject("wrapping_public_key_jwk");
        JSONObject expectedWrapping = new JSONObject(
            ManagerV2WireContract.publicJwk(keys.wrappingPublicKey(OTHER))
        );
        for (String field : List.of("kty", "crv", "x", "y")) {
            assertEquals(expectedSigning.getString(field), actualSigning.getString(field));
            assertEquals(expectedWrapping.getString(field), actualWrapping.getString(field));
        }
        JSONObject activeSigning = new JSONObject(
            ManagerV2WireContract.publicJwk(keys.signingPublicKey(OP))
        );
        assertFalse(actualSigning.getString("x").equals(activeSigning.getString("x"))
            && actualSigning.getString("y").equals(activeSigning.getString("y")));
    }

    @Test
    public void recoverWithoutCurrentSigningAuthorityRequiresExplicitReplaceBeforeCreatingPendingKeys() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        RotatingChallengeHttp http = new RotatingChallengeHttp(clock);
        try {
            transport(coordinator, keys, clock, http).enroll(
                new EnrollmentRequest(OP, DEVICE, "recovery"), "12345678".toCharArray()
            );
            fail("expected explicit replacement requirement");
        } catch (VaultFailure error) {
            assertEquals("manager_native_replacement_required", error.code);
        }
        assertEquals(0, keys.keyCount());
        assertEquals(0, http.calls.get());
        assertEquals(null, persistence.state.pending);
    }

    @Test
    public void completeRecoverDispatchSignsChallengeWithActiveKeyAndEnrollmentWithPendingKey() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        RotatingChallengeHttp challengeHttp = new RotatingChallengeHttp(clock);
        HttpsEnrollmentTransport.NativeHttpClient http = (path, method, headers, body, credential, bearer, deviceId) -> {
            if (path.equals("/manager-device-auth/v2/attestation-challenges")) {
                return challengeHttp.execute(path, method, headers, body, credential, bearer, deviceId);
            }
            assertEquals("/manager-device-auth/v2/enrollment-operations", path);
            return new HttpsEnrollmentTransport.HttpResult(
                409,
                Map.of("content-type", List.of("application/json")),
                "{\"ok\":false,\"code\":\"test_terminal\"}".getBytes(StandardCharsets.UTF_8)
            );
        };
        try {
            transport(coordinator, keys, clock, http).enroll(
                new EnrollmentRequest(OTHER, DEVICE, "recovery", OP),
                "12345678".toCharArray()
            );
            fail("expected terminal test response");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_enrollment_failed", error.code);
            assertEquals(409, error.httpStatus);
        }
        assertEquals(List.of(OP, OTHER), keys.signOperationIds);
        assertEquals(1, challengeHttp.calls.get());
    }

    @Test
    public void recursivelyScrubsCredentialKeysAndEveryCredentialSubstring() throws Exception {
        char[] credential = "device-credential-secret-123456".toCharArray();
        String source = """
            {
              "ok": false,
              "credential_active": true,
              "device_credential": "device-credential-secret-123456",
              "message": "Device device-credential-secret-123456 rejected",
              "nested": {
                "array": [
                  "prefix-device-credential-secret-123456-suffix",
                  {"safe":"preserved","token":"hidden"}
                ],
                "key-device-credential-secret-123456": "hidden"
              }
            }
            """;
        byte[] safe = HttpsEnrollmentTransport.scrubResponseBody(
            source.getBytes(StandardCharsets.UTF_8),
            "application/json",
            credential
        );
        String encoded = new String(safe, StandardCharsets.UTF_8);
        assertFalse(encoded.contains(new String(credential)));
        assertFalse(encoded.contains("device_credential"));
        assertFalse(encoded.contains("\"token\""));
        assertTrue(encoded.contains("credential_active"));
        assertTrue(encoded.contains("preserved"));
    }

    @Test
    public void nonJsonCredentialEchoIsRefused() throws Exception {
        char[] credential = "device-credential-secret-123456".toCharArray();
        try {
            HttpsEnrollmentTransport.scrubResponseBody(
                "Error: device-credential-secret-123456".getBytes(StandardCharsets.UTF_8),
                "text/plain",
                credential
            );
            fail("Expected secret echo refusal");
        } catch (VaultFailure error) {
            assertEquals("manager_native_secret_response_refused", error.code);
        }
    }

    @Test
    public void employeeEnrollmentCodeDisclosureIsExactRouteOnlyAndNeverDisclosesAuthority() throws Exception {
        byte[] source = """
            {"ok":true,"data":{
              "enrollment_code":"12345678",
              "device_credential":"must-not-cross",
              "session_token":"must-not-cross",
              "csrf_token":"must-not-cross"
            }}
            """.getBytes(StandardCharsets.UTF_8);
        byte[] allowed = HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
            "/admin-api/device-auth/enrollment-code", source, "application/json"
        );
        String disclosed = new String(allowed, StandardCharsets.UTF_8);
        assertTrue(disclosed.contains("\"enrollment_code\":\"12345678\""));
        assertFalse(disclosed.contains("device_credential"));
        assertFalse(disclosed.contains("session_token"));
        assertFalse(disclosed.contains("csrf_token"));
        String refused = new String(HttpsEnrollmentTransport.scrubAuthorizedResponseBody(
            "/admin-api/device-auth/summary", source, "application/json"
        ), StandardCharsets.UTF_8);
        assertFalse(refused.contains("enrollment_code"));
        assertFalse(refused.contains("12345678"));
    }

    @Test
    public void remoteFailureCarriesOnlyValidatedStatus() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = new HttpsEnrollmentTransport.HttpResult(
            401,
            Map.of("set-cookie", List.of("secret")),
            "{\"ok\":false,\"code\":\"invalid_enrollment_code\",\"error\":\"unsafe body\"}".getBytes(StandardCharsets.UTF_8)
        );
        try {
            HttpsEnrollmentTransport.requireSuccessData(response, "manager_native_terminal_request_failed");
            fail("Expected failure");
        } catch (VaultFailure error) {
            assertEquals("manager_native_terminal_request_failed", error.code);
            assertEquals(401, error.httpStatus);
            assertEquals("invalid_enrollment_code", error.remoteReason);
            assertFalse(error.getMessage().contains("unsafe body"));
        }
    }

    @Test
    public void successParserRequiresOkObjectAndData() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = new HttpsEnrollmentTransport.HttpResult(
            200,
            Map.of(),
            "{\"ok\":true,\"data\":{\"operation_id\":\"safe\"}}".getBytes(StandardCharsets.UTF_8)
        );
        JSONObject data = HttpsEnrollmentTransport.requireSuccessData(response, "failure");
        assertEquals("safe", data.getString("operation_id"));
    }

    @Test
    public void stableOperationRechecksChallengeAt299AndRotatesAfter301AcrossRestart() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        ManagerV2OperationRecord active = coordinator.preparePending(OP);
        coordinator.promote(OP);
        RotatingChallengeHttp http = new RotatingChallengeHttp(clock);
        char[] credential = "credential-id.device-secret-value-0123456789".toCharArray();

        HttpsEnrollmentTransport first = transport(coordinator, keys, clock, http);
        HttpsEnrollmentTransport.Challenge initial = first.challenge(
            OP, OTHER, "authorized_session", DEVICE, active, credential
        );
        clock.now = NOW + 299_000L;
        HttpsEnrollmentTransport restarted = transport(coordinator, keys, clock, http);
        HttpsEnrollmentTransport.Challenge beforeExpiry = restarted.challenge(
            OP, OTHER, "authorized_session", DEVICE, active, credential
        );
        clock.now = NOW + 301_000L;
        HttpsEnrollmentTransport.Challenge afterExpiry = transport(coordinator, keys, clock, http).challenge(
            OP, OTHER, "authorized_session", DEVICE, active, credential
        );

        assertEquals(initial, beforeExpiry);
        assertFalse(initial.equals(afterExpiry));
        assertEquals(3, http.calls.get());
        assertEquals(3, new java.util.HashSet<>(http.proofNonces).size());
        assertEquals(List.of(new String(credential), new String(credential), new String(credential)), http.credentials);
        assertEquals(List.of(OTHER, OTHER, OTHER), http.operationIds);
    }

    @Test
    public void enrollmentChallengeIsPublicButAuthorizedChallengeRequiresNativeCredential() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        ManagerV2OperationRecord pending = coordinator.preparePending(OP);
        RotatingChallengeHttp http = new RotatingChallengeHttp(clock);
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, http);

        transport.challenge(OP, OP, "enroll", DEVICE, pending, null);
        assertEquals(1, http.credentials.size());
        assertEquals(null, http.credentials.get(0));

        http.deniedStatus = 401;
        try {
            transport.challenge(OP, OTHER, "authorized_session", DEVICE, pending, "revoked.secret".toCharArray());
            fail("expected revoked credential denial");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_challenge_failed", error.code);
            assertEquals(401, error.httpStatus);
        }
    }

    @Test
    public void backendKeyBindingConflictFailsClosed() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        ManagerV2OperationRecord pending = coordinator.preparePending(OP);
        RotatingChallengeHttp http = new RotatingChallengeHttp(clock);
        http.deniedStatus = 409;
        try {
            transport(coordinator, keys, clock, http).challenge(
                OP, OTHER, "authorized_session", DEVICE, pending, "active.secret".toCharArray()
            );
            fail("expected key binding denial");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_challenge_failed", error.code);
            assertEquals(409, error.httpStatus);
        }
    }

    @Test
    public void terminalPostsBindExactPathBodyIdempotencyAndCredentialAuthority() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        RecordingTerminalHttp http = new RecordingTerminalHttp();
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, http);
        char[] credential = "credential-id.device-secret-value-0123456789".toCharArray();

        expectTransportFailure("manager_v2_confirm_failed", () -> transport.confirm(OP, DEVICE, credential));
        expectTransportFailure("manager_v2_cancel_failed", () -> transport.cancel(OP, DEVICE));
        coordinator.promote(OP);
        expectTransportFailure("manager_v2_removal_failed", () -> transport.remove(OP, OTHER, DEVICE, credential));

        assertEquals(3, http.calls.size());
        http.calls.get(0).assertExact(
            "/manager-device-auth/v2/enrollment-operations/" + OP + "/confirm",
            OP, "confirm", DEVICE, true
        );
        http.calls.get(1).assertExact(
            "/manager-device-auth/v2/enrollment-operations/" + OP + "/cancel",
            OP, "cancel", DEVICE, false
        );
        http.calls.get(2).assertExact(
            "/manager-device-auth/v2/removal-operations",
            OTHER, "remove", DEVICE, true
        );
    }

    @Test
    public void terminalTransportPreservesExpiredOutcomeInsteadOfReportingConfirmation() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        HttpsEnrollmentTransport.NativeHttpClient http = (
            path, method, headers, body, credential, bearer, deviceId
        ) -> new HttpsEnrollmentTransport.HttpResult(
            200,
            Map.of("content-type", List.of("application/json")),
            ("{\"ok\":true,\"data\":{\"contract_version\":\"manager-device-auth.v2\","
                + "\"operation_id\":\"" + OP + "\",\"status\":\"expired\",\"replayed\":true}}")
                .getBytes(StandardCharsets.UTF_8)
        );
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, http);

        TerminalResult confirm = transport.confirm(
            OP, DEVICE, "credential-id.device-secret-value-0123456789".toCharArray()
        );
        TerminalResult cancel = transport.cancel(OP, DEVICE);

        assertEquals(TerminalOutcome.EXPIRED, confirm.outcome);
        assertEquals(TerminalOutcome.EXPIRED, cancel.outcome);
        assertTrue(confirm.replayed);
        assertTrue(cancel.replayed);
    }

    @Test
    public void authoritativeTerminalCancellationIsSafeIdempotentExpiry() throws Exception {
        for (Map.Entry<Integer, String> response : Map.of(
            409, "manager_v2_operation_expired",
            410, "manager_v2_operation_cancelled"
        ).entrySet()) {
            MutableClock clock = new MutableClock(NOW);
            MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
            FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
            ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
            coordinator.preparePending(OP);
            HttpsEnrollmentTransport.NativeHttpClient http = (
                path, method, headers, body, credential, bearer, deviceId
            ) -> new HttpsEnrollmentTransport.HttpResult(
                response.getKey(),
                Map.of("content-type", List.of("application/json")),
                ("{\"ok\":false,\"code\":\"" + response.getValue() + "\"}")
                    .getBytes(StandardCharsets.UTF_8)
            );

            TerminalResult terminal = transport(coordinator, keys, clock, http).cancel(OP, DEVICE);

            assertTrue(terminal.replayed);
            assertTrue(terminal.outcome == TerminalOutcome.EXPIRED || terminal.outcome == TerminalOutcome.CANCELLED);
        }
    }

    @Test
    public void operationNotFoundCancellationIsNeverTreatedAsTerminalWithoutServerTombstoneProof() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        HttpsEnrollmentTransport.NativeHttpClient http = (
            path, method, headers, body, credential, bearer, deviceId
        ) -> new HttpsEnrollmentTransport.HttpResult(
            404,
            Map.of("content-type", List.of("application/json")),
            "{\"ok\":false,\"code\":\"manager_v2_operation_not_found\"}"
                .getBytes(StandardCharsets.UTF_8)
        );

        try {
            transport(coordinator, keys, clock, http).cancel(OP, DEVICE);
            fail("A 404 cannot prove an in-flight enrollment will not commit later");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_cancel_failed", error.code);
            assertEquals(404, error.httpStatus);
            assertEquals("manager_v2_operation_not_found", error.remoteReason);
        }
    }

    @Test
    public void lostAuthorizedSessionResponseReplaysSameDurableOperationAcrossRestart() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        MemoryAuthorizedSessionOperationJournal journal = new MemoryAuthorizedSessionOperationJournal();
        ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
        char[] credential = (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray();

        HttpsEnrollmentTransport first = transport(coordinator, keys, clock, journal, http);
        http.loseFirstSessionResponse = true;
        try {
            first.authorized(
                new AuthorizedRequest("/dashboard-api/health", "GET", Map.of(), new byte[0]),
                OP, DEVICE, credential
            );
            fail("expected simulated response loss");
        } catch (VaultFailure error) {
            assertEquals("manager_native_network_unavailable", error.code);
        }
        String pendingOperation = journal.load().operationId;

        AuthorizedResponse response = transport(coordinator, keys, clock, journal, http).authorized(
            new AuthorizedRequest("/dashboard-api/health", "GET", Map.of(), new byte[0]),
            OP, DEVICE, credential
        );
        assertEquals(200, response.status);
        assertEquals(null, journal.load());
        assertEquals(List.of(pendingOperation, pendingOperation), http.sessionOperationIds);
        assertEquals(List.of(pendingOperation, pendingOperation), http.challengeOperationIds);
        assertEquals(1, http.durableSessionResponses.size());
        assertEquals(http.lastIssuedBearer, http.applicationBearer);
        assertEquals(1, journal.generations.get());
    }

    @Test
    public void application401CreatesOneFreshSessionAndRetriesExactRequestOnce() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        MemoryAuthorizedSessionOperationJournal journal = new MemoryAuthorizedSessionOperationJournal();
        ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
        http.applicationStatuses = List.of(401, 200);
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, journal, http);
        AuthorizedRequest request = new AuthorizedRequest(
            "/dashboard-api/health?source=native", "POST",
            Map.of("Content-Type", "application/json"),
            "{\"probe\":true}".getBytes(StandardCharsets.UTF_8)
        );

        AuthorizedResponse response = transport.authorized(
            request, OP, DEVICE,
            (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray()
        );

        assertEquals(200, response.status);
        assertEquals(2, http.applicationRequests.size());
        assertEquals(http.applicationRequests.get(0), http.applicationRequests.get(1));
        assertEquals(2, http.sessionOperationIds.size());
        assertFalse(http.sessionOperationIds.get(0).equals(http.sessionOperationIds.get(1)));
        assertEquals(2, http.challengeOperationIds.size());
        assertEquals(null, journal.load());
        assertEquals(true, transport.safeSessionState().get("native_authenticated"));
    }

    @Test
    public void secondApplication401ClearsReplacementSessionAndNeverRetriesThirdTime() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        MemoryAuthorizedSessionOperationJournal journal = new MemoryAuthorizedSessionOperationJournal();
        ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
        http.applicationStatuses = List.of(401, 401, 200);
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, journal, http);

        AuthorizedResponse response = transport.authorized(
            new AuthorizedRequest("/dashboard-api/health", "GET", Map.of(), new byte[0]),
            OP, DEVICE,
            (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray()
        );

        assertEquals(401, response.status);
        assertEquals(2, http.applicationRequests.size());
        assertEquals(2, http.sessionOperationIds.size());
        assertEquals(Map.of(), transport.safeSessionState());
        assertEquals(null, journal.load());
    }

    @Test
    public void non401ApplicationFailureIsReturnedWithoutSessionRetry() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
        http.applicationStatuses = List.of(403, 200);
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, http);

        AuthorizedResponse response = transport.authorized(
            new AuthorizedRequest("/dashboard-api/health", "GET", Map.of(), new byte[0]),
            OP, DEVICE,
            (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray()
        );

        assertEquals(403, response.status);
        assertEquals(1, http.applicationRequests.size());
        assertEquals(1, http.sessionOperationIds.size());
        assertEquals(true, transport.safeSessionState().get("native_authenticated"));
    }

    @Test
    public void promotedKeyAuthorityNeverReusesPriorAuthorityBearerForSameDevice() throws Exception {
        MutableClock clock = new MutableClock(NOW);
        MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
        FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
        coordinator.preparePending(OP);
        coordinator.promote(OP);
        MemoryAuthorizedSessionOperationJournal journal = new MemoryAuthorizedSessionOperationJournal();
        ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
        HttpsEnrollmentTransport transport = transport(coordinator, keys, clock, journal, http);
        char[] credential = (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray();
        AuthorizedRequest request = new AuthorizedRequest(
            "/dashboard-api/health", "GET", Map.of(), new byte[0]
        );

        assertEquals(200, transport.authorized(request, OP, DEVICE, credential).status);
        String priorBearer = http.applicationBearers.get(0);
        String priorSessionOperation = http.sessionOperationIds.get(0);

        coordinator.preparePending(OTHER);
        transport.activateOperation(OTHER);
        http.keyState = coordinator.requireActive(OTHER);
        assertEquals(200, transport.authorized(request, OTHER, DEVICE, credential).status);

        assertEquals(2, http.applicationBearers.size());
        assertFalse(priorBearer.equals(http.applicationBearers.get(1)));
        assertEquals(2, http.sessionOperationIds.size());
        assertFalse(priorSessionOperation.equals(http.sessionOperationIds.get(1)));
        assertEquals(null, journal.load());
    }

    @Test
    public void authorizedSessionRolesRequireOpsManagerAndCanonicalOrder() throws Exception {
        for (List<String> invalidRoles : List.of(
            List.of("CUSTODIAL_MANAGER"),
            List.of("OPS_MANAGER", "DIRECTOR", "CUSTODIAL_MANAGER"),
            List.of("OPS_MANAGER", "CUSTODIAL_MANAGER", "CUSTODIAL_MANAGER"),
            List.of("OPS_MANAGER", "UNKNOWN_ROLE")
        )) {
            MutableClock clock = new MutableClock(NOW);
            MemoryManagerV2Persistence persistence = new MemoryManagerV2Persistence();
            FakeManagerV2KeyRing keys = new FakeManagerV2KeyRing();
            ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(persistence, keys, clock);
            coordinator.preparePending(OP);
            coordinator.promote(OP);
            ReplayableSessionHttp http = new ReplayableSessionHttp(clock, keys, coordinator.requireActive(OP));
            http.roles = invalidRoles;
            try {
                transport(coordinator, keys, clock, http).authorized(
                    new AuthorizedRequest("/dashboard-api/health", "GET", Map.of(), new byte[0]),
                    OP, DEVICE,
                    (ReplayableSessionHttp.CREDENTIAL_ID + ".device-secret-value-0123456789").toCharArray()
                );
                fail("expected invalid role projection refusal: " + invalidRoles);
            } catch (VaultFailure error) {
                assertEquals("manager_v2_invalid_response", error.code);
            }
        }
    }

    private static HttpsEnrollmentTransport transport(
        ManagerV2KeyCoordinator coordinator,
        ManagerV2KeyRing keys,
        VaultClock clock,
        HttpsEnrollmentTransport.NativeHttpClient http
    ) throws VaultFailure {
        return transport(
            coordinator, keys, clock, new MemoryAuthorizedSessionOperationJournal(), http
        );
    }

    private static HttpsEnrollmentTransport transport(
        ManagerV2KeyCoordinator coordinator,
        ManagerV2KeyRing keys,
        VaultClock clock,
        AuthorizedSessionOperationJournal journal,
        HttpsEnrollmentTransport.NativeHttpClient http
    ) throws VaultFailure {
        ManagerAppAttestation attestation = new ManagerAppAttestation() {
            public String provider() { return "play_integrity"; }
            public String token(String challenge) { return "unused-attestation-token-0123456789"; }
        };
        return new HttpsEnrollmentTransport(
            coordinator, keys, attestation, clock, "Managed Pixel",
            journal, http
        );
    }

    private static void expectTransportFailure(String code, ThrowingCall call) throws Exception {
        try {
            call.run();
            fail("expected " + code);
        } catch (VaultFailure error) {
            assertEquals(code, error.code);
            assertEquals(409, error.httpStatus);
        }
    }

    private interface ThrowingCall {
        void run() throws Exception;
    }

    private static final class RecordingTerminalHttp implements HttpsEnrollmentTransport.NativeHttpClient {
        final List<TerminalCall> calls = new ArrayList<>();

        @Override
        public HttpsEnrollmentTransport.HttpResult execute(
            String path,
            String method,
            Map<String, String> headers,
            byte[] body,
            char[] credential,
            char[] bearer,
            String deviceId
        ) {
            calls.add(new TerminalCall(
                path, method, Map.copyOf(headers), new String(body, StandardCharsets.UTF_8),
                credential == null ? null : new String(credential),
                bearer == null ? null : new String(bearer), deviceId
            ));
            return new HttpsEnrollmentTransport.HttpResult(
                409,
                Map.of("content-type", List.of("application/json")),
                "{\"ok\":false,\"code\":\"operation_conflict\"}".getBytes(StandardCharsets.UTF_8)
            );
        }
    }

    private record TerminalCall(
        String path,
        String method,
        Map<String, String> headers,
        String body,
        String credential,
        String bearer,
        String deviceId
    ) {
        void assertExact(
            String expectedPath,
            String operationId,
            String action,
            String expectedDeviceId,
            boolean credentialRequired
        ) throws Exception {
            assertEquals(expectedPath, path);
            assertEquals("POST", method);
            assertEquals(operationId, headers.get("Idempotency-Key"));
            assertEquals("application/json", headers.get("Content-Type"));
            assertEquals(2, headers.size());
            assertEquals(expectedDeviceId, deviceId);
            assertEquals(null, bearer);
            if (credentialRequired) assertTrue(credential != null && credential.endsWith("device-secret-value-0123456789"));
            else assertEquals(null, credential);
            JSONObject payload = new JSONObject(body);
            assertEquals(ManagerV2WireContract.CONTRACT, payload.getString("contract_version"));
            assertEquals(operationId, payload.getString("operation_id"));
            assertEquals(action, payload.getString("action"));
            assertTrue(payload.getJSONObject("proof").length() > 0);
            if ("remove".equals(action)) assertEquals(expectedDeviceId, payload.getString("device_id"));
            else assertFalse(payload.has("device_id"));
        }
    }

    private static final class ReplayableSessionHttp implements HttpsEnrollmentTransport.NativeHttpClient {
        static final String CREDENTIAL_ID = "77777777-7777-4777-8777-777777777777";
        static final String SESSION_ID = "99999999-9999-4999-8999-999999999999";
        static final String MANAGER_ID = "88888888-8888-4888-8888-888888888888";
        private static final String CHALLENGE_ID = "33333333-3333-4333-8333-333333333333";
        private static final String CHALLENGE = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        final MutableClock clock;
        final FakeManagerV2KeyRing keys;
        ManagerV2OperationRecord keyState;
        final KeyPair ephemeral;
        final List<String> challengeOperationIds = new ArrayList<>();
        final List<String> sessionOperationIds = new ArrayList<>();
        final List<String> applicationRequests = new ArrayList<>();
        final List<String> applicationBearers = new ArrayList<>();
        final Map<String, byte[]> durableSessionResponses = new HashMap<>();
        List<String> roles = List.of(
            "OPS_MANAGER", "CUSTODIAL_MANAGER", "DIRECTOR", "SECURITY_ADMIN"
        );
        boolean loseFirstSessionResponse;
        List<Integer> applicationStatuses = List.of(200);
        String applicationBearer = "";
        String lastIssuedBearer = "";

        ReplayableSessionHttp(
            MutableClock clock,
            FakeManagerV2KeyRing keys,
            ManagerV2OperationRecord keyState
        ) throws Exception {
            this.clock = clock;
            this.keys = keys;
            this.keyState = keyState;
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            this.ephemeral = generator.generateKeyPair();
        }

        @Override
        public HttpsEnrollmentTransport.HttpResult execute(
            String path,
            String method,
            Map<String, String> headers,
            byte[] body,
            char[] credential,
            char[] bearer,
            String deviceId
        ) throws VaultFailure {
            try {
                if (path.equals("/manager-device-auth/v2/attestation-challenges")) {
                    JSONObject request = new JSONObject(new String(body, StandardCharsets.UTF_8));
                    String operationId = request.getString("operation_id");
                    assertEquals(operationId, headers.get("Idempotency-Key"));
                    challengeOperationIds.add(operationId);
                    assertTrue(credential != null && new String(credential).startsWith(CREDENTIAL_ID + "."));
                    JSONObject data = new JSONObject()
                        .put("contract_version", ManagerV2WireContract.CONTRACT)
                        .put("operation_id", operationId)
                        .put("challenge_id", CHALLENGE_ID)
                        .put("provider", "play_integrity")
                        .put("challenge", CHALLENGE)
                        .put("expires_at", Instant.ofEpochMilli(clock.now + 300_000L).toString())
                        .put("policy_version", "manager-play-integrity-v2");
                    return json(200, new JSONObject().put("ok", true).put("data", data));
                }
                if (path.equals("/manager-device-auth/v2/authorized-sessions")) {
                    JSONObject request = new JSONObject(new String(body, StandardCharsets.UTF_8));
                    String operationId = request.getString("operation_id");
                    assertEquals(operationId, headers.get("Idempotency-Key"));
                    sessionOperationIds.add(operationId);
                    assertTrue(credential != null && new String(credential).startsWith(CREDENTIAL_ID + "."));
                    byte[] response = durableSessionResponses.get(operationId);
                    if (response == null) {
                        response = sessionResponse(operationId);
                        durableSessionResponses.put(operationId, response);
                    }
                    if (loseFirstSessionResponse) {
                        loseFirstSessionResponse = false;
                        throw new VaultFailure("manager_native_network_unavailable");
                    }
                    return new HttpsEnrollmentTransport.HttpResult(
                        200, Map.of("content-type", List.of("application/json")), response
                    );
                }
                if (path.startsWith("/dashboard-api/health")) {
                    assertEquals(null, credential);
                    applicationBearer = bearer == null ? "" : new String(bearer);
                    applicationBearers.add(applicationBearer);
                    applicationRequests.add(
                        method + "\n" + path + "\n" + new java.util.TreeMap<>(headers)
                            + "\n" + Base64.getEncoder().encodeToString(body)
                    );
                    int index = applicationRequests.size() - 1;
                    int status = applicationStatuses.get(Math.min(index, applicationStatuses.size() - 1));
                    return json(status, status == 200
                        ? new JSONObject().put("ok", true).put("data", new JSONObject().put("healthy", true))
                        : new JSONObject().put("ok", false).put("code", "session_rejected"));
                }
                throw new VaultFailure("test_unexpected_path");
            } catch (VaultFailure error) {
                throw error;
            } catch (Exception error) {
                throw new VaultFailure("test_http_failure", error);
            }
        }

        private byte[] sessionResponse(String operationId) throws Exception {
            String expiresAt = Instant.ofEpochMilli(clock.now + 600_000L).toString();
            String ephemeralId = ManagerV2WireContract.thumbprint(ephemeral.getPublic());
            byte[] salt = new byte[32];
            byte[] iv = new byte[12];
            byte[] tag = new byte[16];
            Arrays.fill(salt, (byte) 4);
            Arrays.fill(iv, (byte) 5);
            Arrays.fill(tag, (byte) 6);
            lastIssuedBearer = "native_session_" + keyState.operationId.replace("-", "")
                + ".signature_0123456789abcdef";
            JSONObject secret = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", operationId)
                .put("session_id", SESSION_ID)
                .put("ops_session", lastIssuedBearer)
                .put("device_id", DEVICE)
                .put("manager_id", MANAGER_ID)
                .put("roles", new org.json.JSONArray(roles))
                .put("access_level", "full_access")
                .put("expires_at", expiresAt);
            keys.sessionPlaintexts.put(operationId, secret.toString().getBytes(StandardCharsets.UTF_8));
            JSONObject envelope = new JSONObject()
                .put("algorithm", ManagerV2WireContract.ENVELOPE_ALGORITHM)
                .put("ephemeral_public_key_jwk", new JSONObject(ManagerV2WireContract.publicJwk(ephemeral.getPublic())))
                .put("ephemeral_key_id", ephemeralId)
                .put("wrapping_key_id", keyState.wrappingKeyId)
                .put("salt", ManagerV2WireContract.base64url(salt))
                .put("iv", ManagerV2WireContract.base64url(iv))
                .put("ciphertext", ManagerV2WireContract.base64url(new byte[] {1}))
                .put("tag", ManagerV2WireContract.base64url(tag));
            JSONObject data = new JSONObject()
                .put("contract_version", ManagerV2WireContract.CONTRACT)
                .put("operation_id", operationId)
                .put("status", "authorized")
                .put("session_id", SESSION_ID)
                .put("credential_id", CREDENTIAL_ID)
                .put("device_id", DEVICE)
                .put("manager_id", MANAGER_ID)
                .put("roles", new org.json.JSONArray(roles))
                .put("access_level", "full_access")
                .put("session_expires_at", expiresAt)
                .put("result_envelope", envelope)
                .put("replayed", false);
            return new JSONObject().put("ok", true).put("data", data).toString().getBytes(StandardCharsets.UTF_8);
        }

        private static HttpsEnrollmentTransport.HttpResult json(int status, JSONObject value) {
            return new HttpsEnrollmentTransport.HttpResult(
                status, Map.of("content-type", List.of("application/json")),
                value.toString().getBytes(StandardCharsets.UTF_8)
            );
        }
    }

    private static final class RotatingChallengeHttp implements HttpsEnrollmentTransport.NativeHttpClient {
        private static final String CHALLENGE_1 = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        private static final String CHALLENGE_2 = Base64.getUrlEncoder().withoutPadding().encodeToString(filled());
        final MutableClock clock;
        final AtomicInteger calls = new AtomicInteger();
        final List<String> credentials = new ArrayList<>();
        final List<String> operationIds = new ArrayList<>();
        final List<String> proofNonces = new ArrayList<>();
        final List<JSONObject> requests = new ArrayList<>();
        int deniedStatus;

        RotatingChallengeHttp(MutableClock clock) { this.clock = clock; }

        @Override
        public HttpsEnrollmentTransport.HttpResult execute(
            String path,
            String method,
            Map<String, String> headers,
            byte[] body,
            char[] credential,
            char[] bearer,
            String deviceId
        ) throws VaultFailure {
            try {
                calls.incrementAndGet();
                credentials.add(credential == null ? null : new String(credential));
                JSONObject request = new JSONObject(new String(body, StandardCharsets.UTF_8));
                requests.add(new JSONObject(request.toString()));
                String operationId = request.getString("operation_id");
                assertEquals(operationId, headers.get("Idempotency-Key"));
                operationIds.add(operationId);
                proofNonces.add(request.getJSONObject("proof").getString("nonce"));
                if (deniedStatus != 0) {
                    return json(deniedStatus, new JSONObject().put("ok", false).put("code", "binding_refused"));
                }
                boolean expired = clock.now > NOW + 300_000L;
                JSONObject data = new JSONObject()
                    .put("contract_version", ManagerV2WireContract.CONTRACT)
                    .put("operation_id", operationId)
                    .put("challenge_id", expired
                        ? "44444444-4444-4444-8444-444444444444"
                        : "33333333-3333-4333-8333-333333333333")
                    .put("provider", "play_integrity")
                    .put("challenge", expired ? CHALLENGE_2 : CHALLENGE_1)
                    .put("expires_at", Instant.ofEpochMilli(expired ? clock.now + 300_000L : NOW + 300_000L).toString())
                    .put("policy_version", "manager-play-integrity-v2");
                return json(200, new JSONObject().put("ok", true).put("data", data));
            } catch (Exception error) {
                throw error instanceof VaultFailure ? (VaultFailure) error : new VaultFailure("test_http_failure", error);
            }
        }

        private static HttpsEnrollmentTransport.HttpResult json(int status, JSONObject value) {
            return new HttpsEnrollmentTransport.HttpResult(
                status, Map.of("content-type", List.of("application/json")),
                value.toString().getBytes(StandardCharsets.UTF_8)
            );
        }

        private static byte[] filled() {
            byte[] value = new byte[32];
            java.util.Arrays.fill(value, (byte) 7);
            return value;
        }
    }
}
