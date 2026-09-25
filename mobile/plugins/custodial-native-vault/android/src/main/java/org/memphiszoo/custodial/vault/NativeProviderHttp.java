package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.net.ssl.HttpsURLConnection;

/** Internal bounded HTTPS adapter. No configurable host, arbitrary route/body or JS signing.
 * Normal platform TLS, no redirects, exactly serialized attestation body, cancelable connection. */
final class NativeProviderHttp {
    private static final String ORIGIN = "https://memphis-zoo-mcp.onrender.com";
    static final int MAX_RESPONSE_BYTES = 262144;
    interface Connections { HttpsURLConnection open(URL exactUrl) throws Exception; }
    private final Connections connections;
    private final VaultClock clock;
    private final HttpsEnrollmentTransport.RequestIdGenerator requestIds;
    NativeProviderHttp() { this(url -> (HttpsURLConnection) url.openConnection(), System::currentTimeMillis, () -> UUID.randomUUID().toString()); }
    /** Package-private synthetic network seam; never a plugin API or alternative production origin. */
    NativeProviderHttp(Connections connections, VaultClock clock, HttpsEnrollmentTransport.RequestIdGenerator requestIds) {
        this.connections = connections; this.clock = clock; this.requestIds = requestIds;
    }

    static final class Attempt {
        private final NativeProviderJobBudget budget;
        private HttpsURLConnection active;
        private boolean canceled;
        Attempt() { this(null); }
        Attempt(NativeProviderJobBudget budget) { this.budget = budget; }
        synchronized void check() throws VaultFailure {
            if (canceled || Thread.currentThread().isInterrupted()) throw new VaultFailure("custodial_provider_network_canceled");
            if (budget != null) budget.remainingMillis();
        }
        void beforeNetwork(String path) throws VaultFailure { check(); if (budget != null) budget.beforeNetwork(path.endsWith("/inventory")); }
        int timeout(int maximum) throws VaultFailure { check(); return budget == null ? maximum : (int) Math.min(maximum, budget.remainingMillis()); }
        int allowance() throws VaultFailure { check(); return budget == null ? MAX_RESPONSE_BYTES : budget.responseAllowance(); }
        void received(int bytes) throws VaultFailure { check(); if (budget != null) budget.received(bytes); }
        synchronized void attach(HttpsURLConnection connection) throws VaultFailure {
            check(); if (active != null) throw new VaultFailure("custodial_provider_network_already_active"); active = connection;
        }
        synchronized void detach(HttpsURLConnection connection) { if (active == connection) active = null; }
        void cancel() {
            HttpsURLConnection connection;
            synchronized (this) { canceled = true; if (budget != null) budget.cancel(); connection = active; }
            if (connection != null) connection.disconnect();
        }
    }
    AuthorizedResponse registration(NativeProviderJournal.Registration operation, String deviceId, char[] credential, Attempt attempt) throws VaultFailure {
        if (operation == null || attempt == null) throw new VaultFailure("custodial_provider_request_invalid");
        return execute(operation.request(), deviceId, credential, attempt);
    }
    AuthorizedResponse events(NativeProviderJournal.EventBatch batch, String deviceId, char[] credential, Attempt attempt) throws VaultFailure {
        if (batch == null || batch.events.isEmpty() || attempt == null) throw new VaultFailure("custodial_provider_request_invalid");
        byte[] body = batch.body();
        try {
            return execute(new AuthorizedRequest("/employee-notifications-api/native-provider/events", "POST",
                java.util.Collections.singletonMap("Content-Type", "application/json; charset=utf-8"), body), deviceId, credential, attempt);
        } finally { Arrays.fill(body, (byte) 0); }
    }
    AuthorizedResponse inventory(NativeProviderInventory.Request request, String deviceId, char[] credential, Attempt attempt) throws VaultFailure {
        if (request == null || attempt == null) throw new VaultFailure("custodial_provider_request_invalid");
        byte[] body = request.body();
        try {
            return execute(new AuthorizedRequest("/employee-notifications-api/native-provider/inventory", "POST",
                java.util.Collections.singletonMap("Content-Type", "application/json; charset=utf-8"), body), deviceId, credential, attempt);
        } finally { Arrays.fill(body, (byte) 0); }
    }
    private AuthorizedResponse execute(AuthorizedRequest request, String deviceId, char[] credential, Attempt attempt) throws VaultFailure {
        HttpsURLConnection connection = null; byte[] received = null;
        try {
            attempt.check();
            if (!"POST".equals(request.method) || !(request.path.equals("/employee-notifications-api/native-provider/register")
                || request.path.equals("/employee-notifications-api/native-provider/status")
                || request.path.equals("/employee-notifications-api/native-provider/events")
                || request.path.equals("/employee-notifications-api/native-provider/inventory")) || request.body.length > 65536)
                throw new VaultFailure("custodial_provider_request_invalid");
            Map<String, String> headers = new LinkedHashMap<>(request.headers);
            headers.putAll(NativeAttestation.requestHeaders(request, deviceId, credential, requestIds.next(), clock.nowMillis()));
            attempt.beforeNetwork(request.path);
            connection = connections.open(new URL(ORIGIN + request.path)); attempt.attach(connection);
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(attempt.timeout(5000)); connection.setReadTimeout(attempt.timeout(10000));
            connection.setUseCaches(false); connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(request.body.length);
            for (Map.Entry<String, String> header : headers.entrySet()) connection.setRequestProperty(header.getKey(), header.getValue());
            connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Origin", "https://localhost");
            connection.setRequestProperty("X-Memphis-App-Edition", "custodial"); connection.setRequestProperty("X-Device-Id", deviceId);
            // Same existing native credential auth boundary; Strings are unavoidable at HTTP header boundary.
            String header = new String(credential);
            connection.setRequestProperty("Authorization", "Device " + header);
            connection.setRequestProperty("X-Device-Credential", header); connection.setRequestProperty("X-Memphis-Device-Credential", header);
            header = null; attempt.check();
            try (OutputStream output = connection.getOutputStream()) { attempt.check(); output.write(request.body); }
            attempt.check(); int status = connection.getResponseCode();
            Map<String, String> responseHeaders = new LinkedHashMap<>(); int types = 0;
            for (Map.Entry<String, List<String>> item : connection.getHeaderFields().entrySet()) {
                if (item.getKey() != null && item.getKey().toLowerCase(Locale.ROOT).equals("content-type")) {
                    if (++types != 1 || item.getValue() == null || item.getValue().size() != 1) throw new VaultFailure("custodial_provider_response_headers_invalid");
                    responseHeaders.put("content-type", item.getValue().get(0));
                }
            }
            InputStream raw = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            received = read(raw, attempt); attempt.check();
            return new AuthorizedResponse(status, responseHeaders, received);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { attempt.check(); throw new VaultFailure("custodial_provider_network_unavailable", error); }
        finally {
            Arrays.fill(request.body, (byte) 0); if (received != null) Arrays.fill(received, (byte) 0);
            if (connection != null) { attempt.detach(connection); connection.disconnect(); }
        }
    }
    private static byte[] read(InputStream stream, Attempt attempt) throws Exception {
        if (stream == null) return new byte[0]; byte[] buffer = new byte[8192];
        try (InputStream input = stream; WipedBuffer out = new WipedBuffer()) {
            int read; while (true) {
                attempt.check(); int available = Math.min(MAX_RESPONSE_BYTES - out.size(), attempt.allowance());
                // A one-byte overflow probe distinguishes EOF from truncated success; never retain excess data.
                read = input.read(buffer, 0, Math.min(buffer.length, available + 1)); if (read == -1) break;
                if (read > MAX_RESPONSE_BYTES - out.size()) throw new VaultFailure("custodial_provider_response_too_large");
                attempt.received(read);
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        } finally { Arrays.fill(buffer, (byte) 0); }
    }
    private static final class WipedBuffer extends ByteArrayOutputStream {
        @Override public void close() { Arrays.fill(buf, (byte) 0); reset(); }
    }
}
