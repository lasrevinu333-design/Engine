package org.memphiszoo.custodial.vault;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual engine + native journals + typed HTTPS adapter, synthetic HttpsURLConnection only.
 * Does not prove live TLS, network/backend routing, SQL or Android background execution. */
public final class NativeProviderHttpTest {
    static final String DEVICE = "KIOSK_08", OP = "44000000-0000-4000-8000-000000000001", RID = "44000000-0000-4000-8000-000000000002";
    static final long NOW = 1800000000000L;
    interface Hook { void run() throws Exception; }
    static final class Connection extends HttpsURLConnection {
        final Map<String, String> sentHeaders = new HashMap<>(); final ByteArrayOutputStream sent = new ByteArrayOutputStream();
        Map<String, List<String>> responseHeaders = Map.of("Content-Type", List.of("application/json; charset=utf-8"));
        byte[] response; int status = 200, disconnects; boolean timeout;
        Hook onResponse, beforeOutput;
        Connection(URL url, byte[] response) { super(url); this.response = response; }
        @Override public void setRequestProperty(String key, String value) { sentHeaders.put(key, value); }
        @Override public OutputStream getOutputStream() throws java.io.IOException {
            try { if (beforeOutput != null) beforeOutput.run(); } catch (Exception error) { throw new java.io.IOException(error); } return sent;
        }
        @Override public int getResponseCode() throws java.io.IOException {
            try { if (onResponse != null) onResponse.run(); } catch (Exception error) { throw new java.io.IOException(error); }
            if (timeout) throw new java.net.SocketTimeoutException("synthetic timeout"); return status;
        }
        @Override public Map<String, List<String>> getHeaderFields() { return responseHeaders; }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(response); }
        @Override public InputStream getErrorStream() { return getInputStream(); }
        @Override public void disconnect() { disconnects++; }
        @Override public void connect() { }
        @Override public boolean usingProxy() { return false; }
        @Override public String getCipherSuite() { return "synthetic-only"; }
        @Override public Certificate[] getLocalCertificates() { return null; }
        @Override public Certificate[] getServerCertificates() { return null; }
    }
    static final class Fixture {
        final NativePrincipalJournalTest.Memory principalMemory = new NativePrincipalJournalTest.Memory();
        final NativePrincipalJournal principalJournal = new NativePrincipalJournal(principalMemory);
        final NativeLegacyLineageJournalTest.Fixture legacy;
        final NativeLegacyLineageJournal legacyJournal;
        final VaultEngine engine;
        final TestCipher cipher;
        final MemoryPersistence persistence;
        final NativeProviderJournalTest.Fixture provider = new NativeProviderJournalTest.Fixture();
        final NativeProviderPrincipal principal;
        final NativeProviderJournal.Prepared prepared;
        final NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt();
        Connection connection; int opened;
        Hook onResponse, beforeOutput;
        Fixture(boolean v2) throws Exception {
            if (v2) {
                legacy = new NativeLegacyLineageJournalTest.Fixture(true); legacy.activate(NativeLegacyLineageJournalTest.OP); legacy.finish(NativeLegacyLineageJournalTest.OP);
                engine = legacy.engine(); legacyJournal = legacy.journal(); cipher = legacy.cipher; persistence = legacy.persistence;
                principal = NativeProviderPrincipal.fromNativeJournal(engine.readLegacyPrincipal(legacyJournal));
            } else {
                legacy = null; legacyJournal = new NativeLegacyLineageJournal(new NativeLegacyLineageJournalTest.Store());
                MutableClock clock = new MutableClock(NOW); cipher = new TestCipher(); persistence = new MemoryPersistence();
                engine = new VaultEngine(persistence, cipher, new FakeTransport(clock), new FakeLegacySource(), new TestSealGenerator(), clock);
                engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray()); engine.completeLocalBinding(OP); engine.confirmEnrollment(OP);
                Map<String, Object> state = engine.getState();
                new NativePrincipalJournalTest().capture(principalJournal, state, new NativePrincipalJournalTest().data().put("credential_id", state.get("active_credential_id")));
                principal = NativeProviderPrincipal.fromNativeJournal(principalJournal.readFor(state));
            }
            provider.journal().observeActivePrincipal(principal); provider.journal().captureToken("synthetic:opaque/token+é");
            prepared = provider.journal().prepareRegistration(principal, NativeProviderJournalTest.app());
        }
        byte[] response() throws Exception { return NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(prepared, null, NativeProviderRegistrationReceiptTest.TIME)).body; }
        NativeProviderHttp http() throws Exception {
            byte[] body = response();
            return new NativeProviderHttp(url -> {
                opened++; connection = new Connection(url, body); connection.onResponse = onResponse; connection.beforeOutput = beforeOutput; return connection;
            }, () -> NOW, () -> RID);
        }
        NativeProviderJournal.Prepared send(boolean status, NativeProviderHttp http) throws Exception {
            return engine.registerNativeProvider(prepared, principalJournal, legacyJournal, provider.journal(), http, attempt, status);
        }
    }
    @Test public void bothActualNativePrincipalShapesSignExactBytesAndConfirmOnlyOriginalOperation() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture f = new Fixture(legacy); assertTrue(f.send(false, f.http()).confirmed); Connection c = f.connection;
            assertEquals("https://memphis-zoo-mcp.onrender.com/employee-notifications-api/native-provider/register", c.getURL().toString());
            assertEquals("POST", c.getRequestMethod()); assertEquals(5000, c.getConnectTimeout()); assertEquals(10000, c.getReadTimeout()); assertFalse(c.getInstanceFollowRedirects());
            JSONObject wire = ProviderWireJson.object(c.sent.toByteArray(), 65536);
            assertEquals("synthetic:opaque/token+é", wire.getString("token")); assertEquals(f.prepared.generationId, wire.getString("generation_id"));
            assertEquals(f.principal.digest, wire.getString("principal_digest")); assertFalse(wire.has("principal")); assertFalse(wire.has("installation_seal"));
            char[] credential = f.cipher.decrypt(f.persistence.current().secret);
            try {
                Map<String, String> expected = NativeAttestation.requestHeaders(new AuthorizedRequest(c.getURL().getPath(), "POST", Map.of(), c.sent.toByteArray()), DEVICE, credential, RID, NOW);
                for (String header : expected.keySet()) assertEquals(expected.get(header), c.sentHeaders.get(header));
                byte[] altered = (new String(c.sent.toByteArray(), StandardCharsets.UTF_8) + " ").getBytes(StandardCharsets.UTF_8);
                assertNotEquals(expected.get("X-Memphis-Native-Request-Attestation"), NativeAttestation.requestHeaders(new AuthorizedRequest(c.getURL().getPath(), "POST", Map.of(), altered), DEVICE, credential, RID, NOW).get("X-Memphis-Native-Request-Attestation"));
            } finally { Arrays.fill(credential, '\0'); }
            assertTrue(c.disconnects > 0); assertEquals(1, f.opened);
        }
    }
    @Test public void typedStatusOmitsTokenAndGenericBridgeStillCannotReachEitherRoute() throws Exception {
        Fixture f = new Fixture(false); assertTrue(f.send(true, f.http()).confirmed);
        assertEquals("/employee-notifications-api/native-provider/status", f.connection.getURL().getPath());
        JSONObject wire = ProviderWireJson.object(f.connection.sent.toByteArray(), 65536); assertFalse(wire.has("token")); assertEquals(f.prepared.tokenDigest, wire.getString("token_digest"));
        ProviderRecordStoreTest.failure("custodial_native_provider_path_refused", () -> RequestPolicy.validate(new AuthorizedRequest(f.connection.getURL().getPath(), "POST", Map.of(), new byte[0]), DEVICE));
    }
    @Test public void nativeUnavailabilityAndReturnDuringHttpRetireThatResponseButAllowExactStatusRetry() throws Exception {
        Fixture f = new Fixture(false); f.onResponse = () -> { f.provider.journal().observeUnavailable(); f.provider.journal().observeActivePrincipal(f.principal); };
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.send(false, f.http()));
        assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
        f.onResponse = null; assertTrue(f.send(true, f.http()).confirmed); assertEquals(2, f.opened);
    }
    @Test public void fullPrincipalChangeWithoutEngineRevisionChangeStillRejectsHttpSettlement() throws Exception {
        Fixture f = new Fixture(false); long revision = f.persistence.current().revision;
        f.onResponse = () -> new NativePrincipalJournalTest().capture(f.principalJournal, f.engine.getState(),
            new NativePrincipalJournalTest().data().put("credential_id", f.principal.json().get("credential_id")).put("assignment_epoch", 5));
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.send(false, f.http()));
        assertEquals(revision, f.persistence.current().revision); assertTrue(f.connection.disconnects > 0);
    }
    @Test public void engineRemovalDuringNetworkIsNotLockedOutAndResponseCannotConfirm() throws Exception {
        Fixture f = new Fixture(false); f.onResponse = () -> {
            Thread removal = new Thread(() -> { try { f.engine.removeEnrollment(RID, DEVICE); } catch (Exception error) { throw new AssertionError(error); } });
            removal.start(); removal.join(1500); assertFalse("HTTP must not hold engine monitor", removal.isAlive());
        };
        ProviderRecordStoreTest.failure("custodial_native_vault_concurrent_change", () -> f.send(false, f.http()));
        assertTrue(f.connection.disconnects > 0); assertFalse(f.engine.getState().get("active").equals(true));
    }
    @Test public void canceledBeforeAndDuringNetworkNeverWritesOrConfirms() throws Exception {
        Fixture before = new Fixture(true); before.attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", () -> before.send(false, before.http())); assertEquals(0, before.opened);
        Fixture during = new Fixture(true); during.beforeOutput = () -> during.attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", () -> during.send(false, during.http()));
        assertEquals(0, during.connection.sent.size()); assertTrue(during.connection.disconnects > 0);
        Fixture after = new Fixture(false); after.onResponse = () -> after.attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", () -> after.send(false, after.http()));
        assertFalse(after.provider.journal().prepareRegistration(after.principal, NativeProviderJournalTest.app()).confirmed);
    }
    @Test public void timeoutOversizeDuplicateHeaderRedirectOrMalformed200LeaveOriginalOperationPending() throws Exception {
        for (String fault : new String[]{"timeout", "oversize", "duplicate_header", "redirect", "html", "wrong_generation", "duplicate_json"}) {
            Fixture f = new Fixture(false); byte[] good = f.response();
            NativeProviderHttp http = new NativeProviderHttp(url -> {
                f.opened++; f.connection = new Connection(url, good);
                switch (fault) {
                    case "timeout": f.connection.timeout = true; break;
                    case "oversize": f.connection.response = new byte[NativeProviderHttp.MAX_RESPONSE_BYTES + 1]; break;
                    case "duplicate_header": f.connection.responseHeaders = Map.of("content-type", List.of("application/json", "application/json")); break;
                    case "redirect": f.connection.status = 302; break;
                    case "html": f.connection.response = "<html>OK</html>".getBytes(StandardCharsets.UTF_8); break;
                    case "wrong_generation": f.connection.response = new String(good, StandardCharsets.UTF_8).replace(f.prepared.generationId, RID).getBytes(StandardCharsets.UTF_8); break;
                    case "duplicate_json": f.connection.response = new String(good, StandardCharsets.UTF_8).replace("\"ok\":true", "\"ok\":false,\"ok\":true").getBytes(StandardCharsets.UTF_8); break;
                }
                return f.connection;
            }, () -> NOW, () -> RID);
            try { f.send(false, http); fail(fault); } catch (VaultFailure expected) { assertTrue(fault, expected.code.startsWith("custodial_provider_")); }
            assertEquals(1, f.opened); assertTrue(f.connection.disconnects > 0);
            NativeProviderJournal.Prepared pending = f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
            assertFalse(pending.confirmed); assertEquals(f.prepared.operationId, pending.operationId);
        }
    }
    @Test public void closedNativeOperationCannotReuseItsTokenBodyAndNoArbitraryConstructorExists() throws Exception {
        Fixture f = new Fixture(false);
        NativeProviderJournal.Registration operation = f.provider.journal().registrationRequest(f.principal, f.prepared, false);
        operation.close(); ProviderRecordStoreTest.failure("custodial_provider_operation_closed", operation::request);
        for (java.lang.reflect.Constructor<?> constructor : NativeProviderJournal.Registration.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
    }
    static NativeProviderJournal.EventBatch admittedEvent(Fixture f) throws Exception {
        f.send(false, f.http()); NativeProviderPayload p = NativeProviderPayloadTest.accept(NativeProviderPayloadTest.lunch(f.prepared));
        f.provider.journal().recordArrival(f.principal, p, NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 100, 7));
        return f.provider.journal().pendingEvents(f.principal, 16);
    }
    static int sendEvents(Fixture f, NativeProviderJournal.EventBatch batch, NativeProviderHttp http) throws Exception {
        return f.engine.sendNativeProviderEvents(batch, f.principalJournal, f.legacyJournal, f.provider.journal(), http, f.attempt);
    }
    @Test public void eventRouteUsesTypedNativeBatchAndExactRawBodyAttestationThenCommittedReceipt() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture f = new Fixture(legacy); NativeProviderJournal.EventBatch batch = admittedEvent(f);
            byte[] response = NativeProviderEventReceiptsTest.response(new org.json.JSONArray().put(NativeProviderEventReceiptsTest.receipt(batch.events.values().iterator().next()))).body;
            NativeProviderHttp http = new NativeProviderHttp(url -> { f.opened++; f.connection = new Connection(url, response); return f.connection; }, () -> NOW, () -> RID);
            assertEquals(1, sendEvents(f, batch, http)); assertEquals("/employee-notifications-api/native-provider/events", f.connection.getURL().getPath());
            assertArrayEquals(batch.body(), f.connection.sent.toByteArray()); assertEquals(0, f.provider.journal().pendingEvents(f.principal, 16).events.size());
            char[] credential = f.cipher.decrypt(f.persistence.current().secret);
            try {
                assertEquals(NativeAttestation.requestHeaders(new AuthorizedRequest(f.connection.getURL().getPath(), "POST", Map.of(), batch.body()), DEVICE, credential, RID, NOW)
                    .get("X-Memphis-Native-Request-Attestation"), f.connection.sentHeaders.get("X-Memphis-Native-Request-Attestation"));
            } finally { Arrays.fill(credential, '\0'); }
            int opened = f.opened; assertEquals(0, sendEvents(f, f.provider.journal().pendingEvents(f.principal, 16), http)); assertEquals(opened, f.opened);
        }
    }
    @Test public void canceledOrUnavailableEventTransportNeverSettlesPendingBytes() throws Exception {
        for (boolean cancel : new boolean[]{true, false}) {
            Fixture f = new Fixture(false); NativeProviderJournal.EventBatch batch = admittedEvent(f);
            byte[] response = NativeProviderEventReceiptsTest.response(new org.json.JSONArray().put(NativeProviderEventReceiptsTest.receipt(batch.events.values().iterator().next()))).body;
            NativeProviderHttp http = new NativeProviderHttp(url -> {
                f.connection = new Connection(url, response); f.connection.onResponse = () -> {
                    if (cancel) f.attempt.cancel(); else { f.provider.journal().observeUnavailable(); f.provider.journal().observeActivePrincipal(f.principal); }
                }; return f.connection;
            }, () -> NOW, () -> RID);
            ProviderRecordStoreTest.failure(cancel ? "custodial_provider_network_canceled" : "custodial_provider_operation_stale", () -> sendEvents(f, batch, http));
            assertEquals(1, f.provider.journal().pendingEvents(f.principal, 16).events.size()); assertTrue(f.connection.disconnects > 0);
        }
    }
}
