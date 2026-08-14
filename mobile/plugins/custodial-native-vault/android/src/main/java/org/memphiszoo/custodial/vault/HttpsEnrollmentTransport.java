package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/** HTTPS adapter. Credential-management routes are reachable only through the
 * typed state-machine methods, never through generic authorized transport. */
final class HttpsEnrollmentTransport implements EnrollmentTransport {
    private static final String API_BASE = "https://memphis-zoo-mcp.onrender.com";
    private static final String NATIVE_ORIGIN = "https://localhost";
    private static final String EDITION = "custodial";
    private static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    private static final Set<String> SAFE_RESPONSE_HEADERS = VaultCollections.setOf(
        "cache-control",
        "content-language",
        "content-type",
        "etag",
        "expires",
        "last-modified",
        "retry-after",
        "x-correlation-id",
        "x-request-id"
    );
    private final VaultClock clock;
    private final RequestIdGenerator requestIds;

    HttpsEnrollmentTransport() {
        this(System::currentTimeMillis, () -> UUID.randomUUID().toString());
    }

    HttpsEnrollmentTransport(VaultClock clock, RequestIdGenerator requestIds) {
        this.clock = clock;
        this.requestIds = requestIds;
    }

    @Override
    public EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
        String code = new String(enrollmentCode);
        try {
            JSONObject body = new JSONObject();
            body.put("operation_id", request.operationId);
            body.put("flow", request.flow);
            body.put("device_id", request.deviceId);
            body.put("enrollment_code", code);
            body.put("device_label", request.deviceId + " Memphis Zoo Custodial");
            String endpoint = request.flow.equals("recovery")
                ? "/custodial-device-auth/recover"
                : "/custodial-device-auth/enroll";
            HttpResult response = execute(
                endpoint,
                "POST",
                VaultCollections.mapOf("Idempotency-Key", request.operationId, "Content-Type", "application/json"),
                body.toString().getBytes(StandardCharsets.UTF_8),
                null,
                request.deviceId
            );
            JSONObject data = requireSuccessData(response, "custodial_native_enrollment_failed");
            JSONObject employee = data.optJSONObject("employee");
            String operationId = data.optString("operation_id", "");
            String deviceId = data.optString("device_id", "");
            String flow = data.optString("flow", "");
            char[] credential = data.optString("device_credential", "").toCharArray();
            try {
                return new EnrollmentResult(
                    operationId,
                    deviceId,
                    flow,
                    credential,
                    new EnrollmentMetadata(
                        data.optString("credential_id", ""),
                        data.optString("credential_expires_at", ""),
                        data.optString("resume_expires_at", ""),
                        data.optString("device_name", ""),
                        employee == null ? "" : employee.optString("id", ""),
                        employee == null ? "" : employee.optString("name", ""),
                        data.optString("recovery_id", "")
                    ),
                    data.optBoolean("replayed", false)
                );
            } finally {
                VaultValidation.wipe(credential);
            }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_enrollment_failed", error);
        } finally {
            // Java Strings are unavoidable at the HTTP/JSON boundary; do not
            // retain the value in fields, logs, errors, or returned objects.
            code = "";
        }
    }

    @Override
    public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
        return terminal(
            "/custodial-device-auth/enrollment-operations/" + operationId + "/confirm",
            operationId,
            deviceId,
            credential
        );
    }

    @Override
    public TerminalResult cancel(String operationId, String deviceId, char[] credential) throws VaultFailure {
        return terminal(
            "/custodial-device-auth/enrollment-operations/" + operationId + "/cancel",
            operationId,
            deviceId,
            credential
        );
    }

    @Override
    public TerminalResult remove(String operationId, String deviceId, char[] credential) throws VaultFailure {
        return terminal("/custodial-device-auth/remove", operationId, deviceId, credential);
    }

    @Override
    public String verifyLegacyIdentity(String candidateDeviceId, char[] credential) throws VaultFailure {
        String candidate = VaultValidation.deviceId(candidateDeviceId);
        HttpResult response = execute(
            "/device-auth/status?device_id=" + candidate,
            "GET",
            VaultCollections.mapOf(),
            new byte[0],
            credential,
            candidate
        );
        JSONObject data = requireSuccessData(response, "custodial_native_legacy_identity_unverified");
        if (!data.optBoolean("authenticated", false)) {
            throw new VaultFailure("custodial_native_legacy_identity_unverified", 401);
        }
        String verified = VaultValidation.deviceId(data.optString("canonical_device_id", ""));
        if (!candidate.equals(verified)) throw new VaultFailure("custodial_native_legacy_binding_mismatch");
        return verified;
    }

    @Override
    public AuthorizedResponse authorized(AuthorizedRequest request, String deviceId, char[] credential) throws VaultFailure {
        Map<String, String> nativeHeaders = new LinkedHashMap<>(request.headers);
        nativeHeaders.putAll(NativeAttestation.requestHeaders(
            request,
            deviceId,
            credential,
            requestIds.next(),
            clock.nowMillis()
        ));
        HttpResult response = execute(request.path, request.method, nativeHeaders, request.body, credential, deviceId);
        Map<String, String> headers = safeResponseHeaders(response.headers);
        byte[] safeBody = scrubResponseBody(response.body, headers.getOrDefault("content-type", ""), credential);
        return new AuthorizedResponse(response.status, headers, safeBody);
    }

    private TerminalResult terminal(
        String path,
        String operationId,
        String deviceId,
        char[] credential
    ) throws VaultFailure {
        try {
            JSONObject body = new JSONObject();
            body.put("operation_id", operationId);
            body.put("device_id", deviceId);
            HttpResult response = execute(
                path,
                "POST",
                VaultCollections.mapOf("Idempotency-Key", operationId, "Content-Type", "application/json"),
                body.toString().getBytes(StandardCharsets.UTF_8),
                credential,
                deviceId
            );
            JSONObject data = requireSuccessData(response, "custodial_native_terminal_request_failed");
            return new TerminalResult(data.optString("operation_id", ""), data.optBoolean("replayed", false));
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_terminal_request_failed", error);
        }
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
            if (!(parsed instanceof JSONObject payload) || !payload.optBoolean("ok", false)) {
                throw new VaultFailure(code);
            }
            JSONObject data = payload.optJSONObject("data");
            if (data == null) throw new VaultFailure(code);
            return data;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        }
    }

    private static HttpResult execute(
        String path,
        String method,
        Map<String, String> suppliedHeaders,
        byte[] body,
        char[] credential,
        String deviceId
    ) throws VaultFailure {
        HttpURLConnection connection = null;
        String credentialHeader = credential == null ? null : new String(credential);
        try {
            connection = (HttpURLConnection) new URL(API_BASE + path).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(35_000);
            connection.setUseCaches(false);
            connection.setRequestMethod(method);
            for (Map.Entry<String, String> entry : suppliedHeaders.entrySet()) {
                connection.setRequestProperty(entry.getKey(), entry.getValue());
            }
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Origin", NATIVE_ORIGIN);
            connection.setRequestProperty("X-Memphis-App-Edition", EDITION);
            connection.setRequestProperty("X-Device-Id", deviceId);
            if (credentialHeader != null) {
                connection.setRequestProperty("Authorization", "Device " + credentialHeader);
                connection.setRequestProperty("X-Device-Credential", credentialHeader);
                connection.setRequestProperty("X-Memphis-Device-Credential", credentialHeader);
            }
            if (body.length > 0) {
                connection.setDoOutput(true);
                connection.getOutputStream().write(body);
                connection.getOutputStream().close();
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            byte[] responseBody = readBounded(stream, MAX_RESPONSE_BYTES);
            return new HttpResult(status, connection.getHeaderFields(), responseBody);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_network_unavailable", error);
        } finally {
            credentialHeader = null;
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
                if (total > maximum) throw new VaultFailure("custodial_native_response_too_large");
                output.write(buffer, 0, count);
            }
            Arrays.fill(buffer, (byte) 0);
            return output.toByteArray();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_network_unavailable", error);
        }
    }

    private static Map<String, String> safeResponseHeaders(Map<String, List<String>> raw) {
        Map<String, String> safe = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) continue;
            String normalized = entry.getKey().toLowerCase(Locale.ROOT);
            if (!SAFE_RESPONSE_HEADERS.contains(normalized) || SecretScrubber.secretKey(normalized)) continue;
            String value = joinHeaderValues(entry.getValue());
            if (value == null) continue;
            if (value.length() <= 8192 && !value.contains("\r") && !value.contains("\n")) safe.put(normalized, value);
        }
        return VaultCollections.copyMap(safe);
    }

    static byte[] scrubResponseBody(byte[] raw, String contentType, char[] credential) throws VaultFailure {
        if (raw.length == 0) return raw;
        String source = new String(raw, StandardCharsets.UTF_8);
        String trimmed = source.trim();
        boolean json = contentType.toLowerCase(Locale.ROOT).contains("json")
            || trimmed.startsWith("{")
            || trimmed.startsWith("[");
        if (!json) {
            if (credential != null && source.contains(new String(credential))) {
                throw new VaultFailure("custodial_native_secret_response_refused");
            }
            return raw.clone();
        }
        Object parsed = strictJson(raw);
        Object scrubbed = SecretScrubber.scrub(parsed, credential);
        String encoded;
        if (scrubbed instanceof Map<?, ?> map) encoded = new JSONObject(map).toString();
        else if (scrubbed instanceof List<?> list) encoded = new JSONArray(list).toString();
        else if (scrubbed == null) encoded = "null";
        else if (scrubbed instanceof String) encoded = JSONObject.quote((String) scrubbed);
        else if (scrubbed instanceof Number || scrubbed instanceof Boolean) encoded = String.valueOf(scrubbed);
        else throw new VaultFailure("custodial_native_invalid_response");
        return encoded.getBytes(StandardCharsets.UTF_8);
    }

    private static String joinHeaderValues(List<String> values) {
        StringBuilder joined = new StringBuilder();
        for (String value : values) {
            if (value == null) return null;
            if (joined.length() > 0) joined.append(", ");
            joined.append(value);
            if (joined.length() > 8192) return joined.toString();
        }
        return joined.toString();
    }

    private static Object strictJson(byte[] raw) throws VaultFailure {
        try {
            String source = new String(raw, StandardCharsets.UTF_8);
            JSONTokener tokener = new JSONTokener(source);
            Object parsed = tokener.nextValue();
            if (tokener.nextClean() != 0) throw new VaultFailure("custodial_native_invalid_response");
            return parsed;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_invalid_response", error);
        }
    }

    static final class HttpResult {
        final int status;
        final Map<String, List<String>> headers;
        final byte[] body;

        HttpResult(int status, Map<String, List<String>> headers, byte[] body) {
            this.status = status;
            this.headers = headers;
            this.body = body;
        }
    }

    @FunctionalInterface
    interface RequestIdGenerator {
        String next();
    }
}
