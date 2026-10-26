package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLStreamHandler;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

public final class HttpsEnrollmentTransportTest {
    private static final String DEVICE = "KIOSK_08";
    private static final String CREDENTIAL = "80000000-0000-4000-8000-000000000008";

    // Focus only newly affected methods; no old parser/authority suites replayed.
    public static void main(String[] methods) throws Exception {
        if (methods.length == 0) throw new IllegalArgumentException("Select new LIFETIME methods explicitly");
        for (String method : methods) {
            if (!method.startsWith("LIFETIME_")) throw new IllegalArgumentException("Not a new owning lifetime case");
            org.junit.runner.Result result = new org.junit.runner.JUnitCore().run(
                org.junit.runner.Request.method(HttpsEnrollmentTransportTest.class, method));
            for (org.junit.runner.notification.Failure failure : result.getFailures()) {
                System.err.println(failure.getTrace());
            }
            if (!result.wasSuccessful() || result.getRunCount() != 1) System.exit(1);
            System.out.println("PASS_SOURCE_MOCK " + method);
        }
        System.out.println("SOURCE_ONLY_NO_REAL_HTTP_SDK_AUTH_CLOCK_OR_PHONE_PROOF");
    }

    private static final AtomicReference<LifetimeConnection> NEXT = new AtomicReference<>();
    private static boolean mockHandlerInstalled;
    private static synchronized void mockConnection(LifetimeConnection next) {
        if (!mockHandlerInstalled) {
            URL.setURLStreamHandlerFactory(protocol -> "https".equals(protocol) ? new URLStreamHandler() {
                @Override protected java.net.URLConnection openConnection(URL url) throws IOException {
                    LifetimeConnection connection = NEXT.getAndSet(null);
                    if (connection == null || !"memphis-zoo-mcp.onrender.com".equals(url.getHost()))
                        throw new IOException("No intended synthetic connection");
                    connection.observedUrl = url.toExternalForm();
                    return connection;
                }
            } : null);
            mockHandlerInstalled = true;
        }
        assertTrue("One serial synthetic connection", NEXT.compareAndSet(null, next));
    }

    private static HttpsEnrollmentTransport.HttpResult lifetimeExchange(LifetimeConnection connection, long millis) throws Exception {
        mockConnection(connection);
        Method execute = HttpsEnrollmentTransport.class.getDeclaredMethod("execute", String.class, String.class,
            Map.class, byte[].class, char[].class, String.class, long.class);
        execute.setAccessible(true); // Private finite test budget, not a public timeout/factory.
        try {
            return (HttpsEnrollmentTransport.HttpResult) execute.invoke(null, "/employee-notifications-api/original?synthetic=1", "POST",
                Map.of("X-Memphis-Native-Request-Id", CREDENTIAL, "Content-Type", "application/json"),
                connection.originalBody, null, DEVICE, TimeUnit.MILLISECONDS.toNanos(millis));
        } catch (InvocationTargetException failure) {
            if (failure.getCause() instanceof Exception cause) throw cause;
            throw failure;
        }
    }

    private static void awaitGate(CountDownLatch gate) {
        boolean interrupted = false;
        for (;;) { try { gate.await(); break; } catch (InterruptedException pending) { interrupted = true; } }
        if (interrupted) Thread.currentThread().interrupt();
    }

    private static final class LifetimeConnection extends HttpURLConnection {
        final byte[] originalBody = "{\"synthetic_original\":true}".getBytes(StandardCharsets.UTF_8);
        final CountDownLatch writeEntered = new CountDownLatch(1), writeRelease = new CountDownLatch(1),
            disconnected = new CountDownLatch(1), disconnectRelease = new CountDownLatch(1),
            responseEntered = new CountDownLatch(1), responseRelease = new CountDownLatch(1),
            inputCloseEntered = new CountDownLatch(1), inputCloseRelease = new CountDownLatch(1);
        final AtomicInteger disconnects = new AtomicInteger(), reads = new AtomicInteger(), responses = new AtomicInteger(),
            outputAcquisitions = new AtomicInteger(), outputCloses = new AtomicInteger(), inputCloses = new AtomicInteger();
        volatile String observedUrl;
        volatile byte[] written;
        boolean blockWrite, unblockWriteOnDisconnect, blockDisconnect, blockResponse, blockInputClose;
        int trickleDelayMillis, lastReadTimeout = Integer.MAX_VALUE;
        LifetimeConnection() throws Exception { super(new URL("https://memphis-zoo-mcp.onrender.com")); }
        @Override public void connect() { connected = true; }
        @Override public boolean usingProxy() { return false; }
        @Override public void disconnect() {
            int call = disconnects.incrementAndGet();
            disconnected.countDown();
            if (unblockWriteOnDisconnect) writeRelease.countDown();
            if (blockDisconnect && call == 1) awaitGate(disconnectRelease);
        }
        @Override public void setReadTimeout(int millis) { super.setReadTimeout(millis); lastReadTimeout = millis; }
        @Override public OutputStream getOutputStream() {
            outputAcquisitions.incrementAndGet();
            return new OutputStream() {
                @Override public void write(int value) { throw new AssertionError("Original array write required"); }
                @Override public void write(byte[] value) {
                    written = value.clone(); writeEntered.countDown();
                    if (blockWrite) awaitGate(writeRelease);
                }
                @Override public void close() { outputCloses.incrementAndGet(); }
            };
        }
        @Override public int getResponseCode() {
            responses.incrementAndGet(); responseEntered.countDown();
            if (blockResponse) awaitGate(responseRelease);
            return 200;
        }
        @Override public Map<String, List<String>> getHeaderFields() { return Map.of("content-type", List.of("application/json")); }
        @Override public InputStream getInputStream() {
            return new InputStream() {
                @Override public int read() { throw new AssertionError("Bounded array read required"); }
                @Override public int read(byte[] buffer, int offset, int length) throws IOException {
                    int call = reads.incrementAndGet();
                    if (trickleDelayMillis > 0) {
                        try { Thread.sleep(trickleDelayMillis); } catch (InterruptedException error) { throw new IOException(error); }
                        if (disconnects.get() != 0) throw new IOException("Only this synthetic connection disconnected");
                        buffer[offset] = 'x'; return 1;
                    }
                    if (call > 1) return -1;
                    byte[] response = "{}".getBytes(StandardCharsets.UTF_8);
                    System.arraycopy(response, 0, buffer, offset, response.length); return response.length;
                }
                @Override public void close() {
                    inputCloseEntered.countDown();
                    if (blockInputClose) awaitGate(inputCloseRelease);
                    inputCloses.incrementAndGet();
                }
            };
        }
        void settleOwnGates() {
            writeRelease.countDown(); disconnectRelease.countDown(); responseRelease.countDown(); inputCloseRelease.countDown();
        }
    }

    private static final class PendingLifetime implements AutoCloseable {
        final CountDownLatch returned = new CountDownLatch(1);
        final LifetimeConnection connection;
        final Thread caller;
        volatile Throwable failure;
        volatile HttpsEnrollmentTransport.HttpResult response;
        volatile boolean interruptedAfter;
        PendingLifetime(LifetimeConnection connection) {
            this.connection = connection;
            caller = new Thread(() -> {
                try { response = lifetimeExchange(connection, 120); }
                catch (Throwable error) { failure = error; }
                finally { interruptedAfter = Thread.currentThread().isInterrupted(); returned.countDown(); }
            }, "synthetic-original-http-caller");
            caller.start();
        }
        void assertExpiredAfterSettlement() throws Exception {
            assertTrue(returned.await(3, TimeUnit.SECONDS));
            assertTrue(failure instanceof VaultFailure);
            assertEquals("custodial_native_network_unavailable", ((VaultFailure) failure).code);
            assertTrue(response == null);
        }
        @Override public void close() throws Exception {
            connection.settleOwnGates(); caller.join(3000);
            assertFalse("Synthetic caller must actually settle", caller.isAlive());
            NEXT.compareAndSet(connection, null);
        }
    }

    @Test public void LIFETIME_originalBytesHeadersAndSingleConnectionStayExact() throws Exception {
        LifetimeConnection c = new LifetimeConnection();
        HttpsEnrollmentTransport.HttpResult result = lifetimeExchange(c, 1000);
        assertEquals(200, result.status); assertEquals("{}", new String(result.body, StandardCharsets.UTF_8));
        assertEquals("https://memphis-zoo-mcp.onrender.com/employee-notifications-api/original?synthetic=1", c.observedUrl);
        assertEquals("POST", c.getRequestMethod()); assertFalse(c.getInstanceFollowRedirects()); assertFalse(c.getUseCaches());
        assertEquals(CREDENTIAL, c.getRequestProperty("X-Memphis-Native-Request-Id"));
        assertEquals("https://localhost", c.getRequestProperty("Origin")); assertEquals(DEVICE, c.getRequestProperty("X-Device-Id"));
        org.junit.Assert.assertArrayEquals(c.originalBody, c.written);
        assertEquals(1, c.outputAcquisitions.get()); assertEquals(1, c.outputCloses.get()); assertEquals(1, c.inputCloses.get());
        assertEquals(1, c.disconnects.get()); assertTrue(c.lastReadTimeout <= 1000);
    }

    @Test public void LIFETIME_trickleUsesOneBudgetNotFreshReadTimeouts() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.trickleDelayMillis = 20;
        try { lifetimeExchange(c, 120); fail("Trickle must not become a complete response"); }
        catch (VaultFailure failure) { assertEquals("custodial_native_network_unavailable", failure.code); }
        assertTrue(c.reads.get() > 1); assertEquals(1, c.inputCloses.get()); assertTrue(c.disconnects.get() >= 1);
        assertEquals(1, c.responses.get()); assertTrue(c.lastReadTimeout < 120);
    }

    @Test public void LIFETIME_publicAuthorizedPreservesSingleOriginalSignatureAndBody() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); mockConnection(c);
        AtomicInteger ids = new AtomicInteger(); long originalTimestamp = 1791734400000L;
        HttpsEnrollmentTransport transport = new HttpsEnrollmentTransport(() -> originalTimestamp, () -> {
            ids.incrementAndGet(); return CREDENTIAL;
        });
        AuthorizedRequest request = new AuthorizedRequest("/employee-notifications-api?synthetic=1", "POST",
            Map.of("Content-Type", "application/json"), c.originalBody);
        char[] syntheticCredential = (CREDENTIAL + ".synthetic-transport-lifetime-secret-0123456789").toCharArray();
        try {
            AuthorizedResponse response = transport.authorized(request, DEVICE, syntheticCredential);
            assertEquals(200, response.status); assertEquals(1, ids.get());
            org.junit.Assert.assertArrayEquals(request.body, c.written);
            for (Map.Entry<String, String> header : NativeAttestation.requestHeaders(
                request, DEVICE, syntheticCredential, CREDENTIAL, originalTimestamp).entrySet())
                assertEquals(header.getValue(), c.getRequestProperty(header.getKey()));
            assertEquals(1, c.outputAcquisitions.get()); assertEquals(1, c.responses.get()); assertEquals(1, c.disconnects.get());
        } finally { java.util.Arrays.fill(syntheticCredential, '\0'); NEXT.compareAndSet(c, null); }
    }

    @Test public void LIFETIME_blockedWriteCanSettleByOnlyItsConnectionDisconnect() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockWrite = true; c.unblockWriteOnDisconnect = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.writeEntered.await(2, TimeUnit.SECONDS)); assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            p.assertExpiredAfterSettlement(); assertEquals(1, c.outputCloses.get()); assertEquals(0, c.responses.get());
            org.junit.Assert.assertArrayEquals(c.originalBody, c.written);
        }
    }

    @Test public void LIFETIME_ignoredDisconnectKeepsCallerUntilWriteActuallySettles() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockWrite = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.writeEntered.await(2, TimeUnit.SECONDS)); assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            assertFalse("No caller lease release while original writer lives", p.returned.await(30, TimeUnit.MILLISECONDS));
            assertEquals(0, c.outputCloses.get()); c.writeRelease.countDown();
            p.assertExpiredAfterSettlement(); assertEquals(1, c.outputCloses.get()); assertEquals(0, c.responses.get());
        }
    }

    @Test public void LIFETIME_watchdogDisconnectAndInterruptedJoinMustActuallySettle() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockWrite = true; c.blockDisconnect = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.writeEntered.await(2, TimeUnit.SECONDS)); assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            c.writeRelease.countDown(); p.caller.interrupt();
            assertFalse("No early caller return while its watchdog owns unresolved disconnect", p.returned.await(30, TimeUnit.MILLISECONDS));
            c.disconnectRelease.countDown(); p.assertExpiredAfterSettlement(); assertTrue(p.interruptedAfter);
        }
    }

    @Test public void LIFETIME_late2xxResponseIsUnknownWithoutResend() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockResponse = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.responseEntered.await(2, TimeUnit.SECONDS)); assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            assertFalse(p.returned.await(30, TimeUnit.MILLISECONDS)); c.responseRelease.countDown();
            p.assertExpiredAfterSettlement(); assertEquals(1, c.responses.get()); assertEquals(1, c.outputAcquisitions.get());
        }
    }

    @Test public void LIFETIME_inputCloseCannotReturnOrFreeOwnershipAtExpiry() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockInputClose = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.inputCloseEntered.await(2, TimeUnit.SECONDS)); assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            assertFalse(p.returned.await(30, TimeUnit.MILLISECONDS)); c.inputCloseRelease.countDown();
            p.assertExpiredAfterSettlement(); assertEquals(1, c.inputCloses.get()); assertEquals(1, c.responses.get());
        }
    }

    @Test public void LIFETIME_cleanupAfterDeadlineCannotAcceptCompleted2xx() throws Exception {
        LifetimeConnection c = new LifetimeConnection(); c.blockDisconnect = true;
        try (PendingLifetime p = new PendingLifetime(c)) {
            assertTrue(c.disconnected.await(2, TimeUnit.SECONDS));
            assertFalse("Unsettled cleanup is not a completed exchange", p.returned.await(180, TimeUnit.MILLISECONDS));
            c.disconnectRelease.countDown(); p.assertExpiredAfterSettlement();
            assertEquals(1, c.responses.get()); assertEquals(1, c.inputCloses.get());
        }
    }

    @Test public void assignedReceiptRequiresExactAuthenticatedResponseNotHttpSuccessAlone() throws Exception {
        JSONObject receipt=new JSONObject().put("operation_id",CREDENTIAL).put("device_id",DEVICE)
            .put("credential_id",CREDENTIAL).put("flow","enrollment").put("outcome","active").put("changed",true)
            .put("journal_schema","native-assigned-activation.v1").put("journal_binding_sha256","a".repeat(64)).put("lineage_operation_id",CREDENTIAL);
        JSONObject data=new JSONObject().put("operation_id",CREDENTIAL).put("device_id",DEVICE).put("state","native_active").put("native_receipt",receipt);
        assertEquals("native_active",HttpsEnrollmentTransport.classifyAssignedActivationResponse(activationResponse(data),CREDENTIAL,DEVICE,receipt));
        for(String key:new String[]{"operation_id","device_id","state","native_receipt"}){
            JSONObject altered=new JSONObject(data.toString());altered.put(key,"wrong");
            try{HttpsEnrollmentTransport.classifyAssignedActivationResponse(activationResponse(altered),CREDENTIAL,DEVICE,receipt);fail();}catch(VaultFailure expected){}
        }
        for(java.util.Iterator<String> keys=receipt.keys();keys.hasNext();){
            String key=keys.next();JSONObject altered=new JSONObject(data.toString());altered.getJSONObject("native_receipt").put(key,"wrong");
            try{HttpsEnrollmentTransport.classifyAssignedActivationResponse(activationResponse(altered),CREDENTIAL,DEVICE,receipt);fail();}catch(VaultFailure expected){}
        }
    }
    private HttpsEnrollmentTransport.HttpResult activationResponse(JSONObject data)throws Exception{
        return new HttpsEnrollmentTransport.HttpResult(200,Map.of(),new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8));
    }

    @Test
    public void assignedActivationUsesOpaqueTokenFieldWithoutLegacyEmployeeCode() throws Exception {
        EnrollmentRequest request = new EnrollmentRequest(
            "11111111-1111-4111-8111-111111111111", DEVICE, "enrollment"
        );
        JSONObject body = HttpsEnrollmentTransport.enrollmentBody(request, "A".repeat(42) + "_");
        assertTrue(body.has("activation_token"));
        assertFalse(body.has("enrollment_code"));
        assertEquals("A".repeat(42) + "_", body.getString("activation_token"));
    }

    @Test
    public void legacyEightDigitProofRemainsTransportCompatibleButIsNotRequiredByNewBootstrap() throws Exception {
        EnrollmentRequest request = new EnrollmentRequest(
            "11111111-1111-4111-8111-111111111111", DEVICE, "enrollment"
        );
        JSONObject body = HttpsEnrollmentTransport.enrollmentBody(request, "12345678");
        assertTrue(body.has("enrollment_code"));
        assertFalse(body.has("activation_token"));
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
            assertEquals("custodial_native_secret_response_refused", error.code);
        }
    }

    @Test
    public void remoteFailureCarriesOnlyValidatedStatus() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = new HttpsEnrollmentTransport.HttpResult(
            401,
            Map.of("set-cookie", List.of("secret")),
            "{\"ok\":false,\"code\":\"invalid_enrollment_code\",\"error\":\"unsafe body\"}".getBytes(StandardCharsets.UTF_8)
        );
        try {
            HttpsEnrollmentTransport.requireSuccessData(response, "custodial_native_terminal_request_failed");
            fail("Expected failure");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_terminal_request_failed", error.code);
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
    public void productionEnrollmentShapePreservesPostgresTimestampsAndEmployeeName() throws Exception {
        JSONObject data = new JSONObject("""
            {
              "operation_id":"c1b452ef-b5f3-4664-aa4c-2ebbb2f9c40b",
              "device_id":"KIOSK_08",
              "flow":"recovery",
              "device_credential":"773f2200-5ee9-4bb0-8c90-314334eb9833.synthetic-recovery-secret-1234567890",
              "credential_id":"773f2200-5ee9-4bb0-8c90-314334eb9833",
              "credential_expires_at":"2036-08-23T13:56:42.682000+00:00",
              "resume_expires_at":"2026-08-26T14:26:42.682000+00:00",
              "device_name":"Karen Robinson",
              "employee":{
                "id":"3da709bb-2223-4e15-8e3a-db02e3f32e97",
                "employee_code":"EMP007",
                "display_name":"Karen Robinson"
              },
              "replayed":false
            }
            """);
        try (EnrollmentResult result = HttpsEnrollmentTransport.parseEnrollmentResult(data)) {
            assertEquals("c1b452ef-b5f3-4664-aa4c-2ebbb2f9c40b", result.operationId);
            assertEquals("KIOSK_08", result.deviceId);
            assertEquals("recovery", result.flow);
            assertEquals("2026-08-26T14:26:42.682Z", result.metadata.resumeExpiresAt);
            assertEquals("2036-08-23T13:56:42.682Z", result.metadata.credentialExpiresAt);
            assertEquals("Karen Robinson", result.metadata.employeeName);
        }
    }

    @Test
    public void activeCredentialStatusAcceptsOnlyExactAuthenticatedIdentity() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":true,
              "enrollment_required":false,
              "recovery_required":false,
              "policy_mode":"enforce",
              "canonical_device_id":"KIOSK_08",
              "credential_id":"80000000-0000-4000-8000-000000000008"
            }}
            """);
        assertEquals(
            ActiveCredentialStatus.ACCEPTED,
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL)
        );
    }

    @Test
    public void activeCredentialStatusRejectsGenericEnforcementWithoutExactRecovery() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":false,
              "enrollment_required":true,
              "recovery_required":false,
              "policy_mode":"enforce",
              "canonical_device_id":"KIOSK_08",
              "credential_id":null
            }}
            """);
        try {
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL);
            fail("Fleet enforcement alone must not identify an unknown credential as recoverable");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_credential_revalidation_refused", error.code);
        }
    }

    @Test
    public void activeCredentialStatusAcceptsExplicitRecoveryDuringObserveRollout() throws Exception {
        HttpsEnrollmentTransport.HttpResult response = statusResponse(200, """
            {"ok":true,"data":{
              "authenticated":false,
              "enrollment_required":true,
              "recovery_required":true,
              "policy_mode":"observe",
              "canonical_device_id":"KIOSK_08",
              "credential_id":null
            }}
            """);
        assertEquals(
            ActiveCredentialStatus.ENROLLMENT_REQUIRED,
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(response, DEVICE, CREDENTIAL)
        );
    }

    @Test
    public void activeCredentialStatusRefusesAmbiguousOrMismatchedResponses() throws Exception {
        for (String body : List.of(
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":true,\"recovery_required\":false,\"policy_mode\":\"observe\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":false,\"enrollment_required\":true,\"recovery_required\":true,\"policy_mode\":\"unknown\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":null}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":true,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":\"80000000-0000-4000-8000-000000000008\"}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_09\",\"credential_id\":\"80000000-0000-4000-8000-000000000008\"}}",
            "{\"ok\":true,\"data\":{\"authenticated\":true,\"enrollment_required\":false,\"recovery_required\":false,\"policy_mode\":\"enforce\",\"canonical_device_id\":\"KIOSK_08\",\"credential_id\":\"90000000-0000-4000-8000-000000000009\"}}"
        )) {
            try {
                HttpsEnrollmentTransport.classifyActiveCredentialStatus(statusResponse(200, body), DEVICE, CREDENTIAL);
                fail("Expected exact active-credential proof refusal");
            } catch (VaultFailure error) {
                assertEquals("custodial_native_credential_revalidation_refused", error.code);
            }
        }
    }

    @Test
    public void activeCredentialStatusPreservesUnavailableServerClass() throws Exception {
        try {
            HttpsEnrollmentTransport.classifyActiveCredentialStatus(
                statusResponse(503, "{\"ok\":false,\"code\":\"device_auth_unavailable\"}"),
                DEVICE,
                CREDENTIAL
            );
            fail("Expected server-unavailable refusal");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_credential_revalidation_failed", error.code);
            assertEquals(503, error.httpStatus);
            assertEquals("device_auth_unavailable", error.remoteReason);
        }
    }

    private static HttpsEnrollmentTransport.HttpResult statusResponse(int status, String body) {
        return new HttpsEnrollmentTransport.HttpResult(
            status,
            Map.of("content-type", List.of("application/json")),
            body.getBytes(StandardCharsets.UTF_8)
        );
    }
}
