package org.memphiszoo.custodial.vault;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

final class RequestPolicy {
    static final int MAX_REQUEST_BYTES = 4 * 1024 * 1024;
    private static final Set<String> METHODS = VaultCollections.setOf("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE");
    private static final List<String> ALLOWED_PREFIXES = VaultCollections.listOf(
        "/employee-notifications-api/",
        "/messaging-api/",
        "/schedule-api/",
        "/scan-api/",
        "/feedback-api/"
    );
    private static final Set<String> ALLOWED_EXACT = VaultCollections.setOf("/device-auth/status");
    private static final List<String> CREDENTIAL_MANAGEMENT_PREFIXES = VaultCollections.listOf(
        "/custodial-device-auth/",
        "/device-auth/enroll",
        "/device-auth/logout",
        "/device-auth/credential",
        "/device-auth/revoke",
        "/device-auth/rotate"
    );
    private static final Set<String> IDENTITY_NAMES = VaultCollections.setOf(
        "device",
        "deviceid",
        "assigneddeviceid",
        "canonicaldeviceid",
        "pdeviceid",
        "deviceidentifier",
        "pdeviceidentifier"
    );
    private static final Set<String> FORBIDDEN_HEADERS = VaultCollections.setOf(
        "authorization",
        "connection",
        "content-length",
        "cookie",
        "host",
        "origin",
        "proxy-authorization",
        "set-cookie",
        "transfer-encoding",
        "x-device-credential",
        "x-memphis-device-credential",
        "x-memphis-native-attestation-version",
        "x-memphis-native-request-id",
        "x-memphis-native-request-timestamp",
        "x-memphis-native-request-attestation"
    );
    private static final Pattern CANONICAL_PATH = Pattern.compile("^/[A-Za-z0-9._~-]+(?:/[A-Za-z0-9._~-]+)*$");

    private RequestPolicy() {}

    static AuthorizedRequest validate(AuthorizedRequest request, String authoritativeDeviceId) throws VaultFailure {
        String deviceId = VaultValidation.deviceId(authoritativeDeviceId);
        String method = request.method == null ? "" : request.method.trim().toUpperCase(Locale.ROOT);
        if (!METHODS.contains(method)) throw new VaultFailure("custodial_native_method_refused");
        if (request.body.length > MAX_REQUEST_BYTES) throw new VaultFailure("custodial_native_request_too_large");
        if ((method.equals("GET") || method.equals("HEAD")) && request.body.length != 0) {
            throw new VaultFailure("custodial_native_body_refused");
        }

        URI uri = strictUri(request.path);
        String pathname = uri.getRawPath();
        if (CREDENTIAL_MANAGEMENT_PREFIXES.stream().anyMatch(pathname::startsWith)) {
            throw new VaultFailure("custodial_native_credential_path_refused");
        }
        if (!ALLOWED_EXACT.contains(pathname) && ALLOWED_PREFIXES.stream().noneMatch(pathname::startsWith)) {
            throw new VaultFailure("custodial_native_path_refused");
        }

        inspectQueryIdentity(uri.getRawQuery(), deviceId);
        inspectHeaders(request.headers, deviceId);
        inspectBodyIdentity(request.body, request.headers, deviceId);
        return new AuthorizedRequest(request.path, method, request.headers, request.body);
    }

    private static URI strictUri(String value) throws VaultFailure {
        String raw = value == null ? "" : value.trim();
        if (
            raw.isEmpty()
            || raw.length() > 4096
            || !raw.startsWith("/")
            || raw.startsWith("//")
            || raw.indexOf('\\') >= 0
            || raw.indexOf('\0') >= 0
            || raw.chars().anyMatch(character -> character < 0x20 || character == 0x7f)
        ) {
            throw new VaultFailure("custodial_native_origin_refused");
        }
        final URI uri;
        try {
            uri = new URI(raw);
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_path_refused", error);
        }
        String path = uri.getRawPath();
        if (
            uri.isAbsolute()
            || uri.getRawAuthority() != null
            || uri.getRawFragment() != null
            || path == null
            || path.indexOf('%') >= 0
            || path.contains("//")
            || !CANONICAL_PATH.matcher(path).matches()
        ) {
            throw new VaultFailure("custodial_native_path_refused");
        }
        for (String segment : path.substring(1).split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) {
                throw new VaultFailure("custodial_native_path_refused");
            }
        }
        String reconstructed = path + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        if (!reconstructed.equals(raw)) throw new VaultFailure("custodial_native_path_refused");
        return uri;
    }

    private static void inspectHeaders(Map<String, String> headers, String deviceId) throws VaultFailure {
        if (headers.size() > 64) throw new VaultFailure("custodial_native_headers_refused");
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String name = entry.getKey() == null ? "" : entry.getKey().trim();
            String lower = name.toLowerCase(Locale.ROOT);
            String value = entry.getValue() == null ? "" : entry.getValue().trim();
            if (!name.matches("^[A-Za-z0-9-]{1,80}$") || value.length() > 8192 || value.contains("\r") || value.contains("\n")) {
                throw new VaultFailure("custodial_native_headers_refused");
            }
            if (FORBIDDEN_HEADERS.contains(lower)) throw new VaultFailure("custodial_native_headers_refused");
            if (lower.equals("x-device-id") && !VaultValidation.deviceId(value).equals(deviceId)) {
                throw new VaultFailure("custodial_native_device_binding_mismatch");
            }
            if (lower.equals("x-memphis-app-edition") && !value.equals("custodial")) {
                throw new VaultFailure("custodial_native_headers_refused");
            }
        }
    }

    private static void inspectQueryIdentity(String rawQuery, String deviceId) throws VaultFailure {
        if (rawQuery == null || rawQuery.isEmpty()) return;
        if (rawQuery.length() > 16_384) throw new VaultFailure("custodial_native_query_refused");
        for (String item : rawQuery.split("&", -1)) {
            if (item.isEmpty()) continue;
            String[] parts = item.split("=", 2);
            String name = decodeQuery(parts[0]);
            String value = decodeQuery(parts.length == 2 ? parts[1] : "");
            if (IDENTITY_NAMES.contains(normalizedName(name))) requireMatchingIdentity(value, deviceId);
        }
    }

    private static String decodeQuery(String value) throws VaultFailure {
        for (int index = 0; index < value.length(); index += 1) {
            if (value.charAt(index) != '%') continue;
            if (index + 2 >= value.length() || hex(value.charAt(index + 1)) < 0 || hex(value.charAt(index + 2)) < 0) {
                throw new VaultFailure("custodial_native_query_refused");
            }
            index += 2;
        }
        try {
            String decoded = URLDecoder.decode(value, "UTF-8");
            if (decoded.indexOf('\0') >= 0 || decoded.contains("\r") || decoded.contains("\n")) {
                throw new VaultFailure("custodial_native_query_refused");
            }
            return decoded;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_query_refused", error);
        }
    }

    private static int hex(char value) {
        if (value >= '0' && value <= '9') return value - '0';
        if (value >= 'a' && value <= 'f') return value - 'a' + 10;
        if (value >= 'A' && value <= 'F') return value - 'A' + 10;
        return -1;
    }

    private static void inspectBodyIdentity(byte[] body, Map<String, String> headers, String deviceId) throws VaultFailure {
        if (body.length == 0) return;
        String contentType = header(headers, "content-type").toLowerCase(Locale.ROOT);
        String source = strictUtf8(body).trim();
        boolean json = contentType.startsWith("application/json") || source.startsWith("{") || source.startsWith("[");
        if (json) {
            try {
                JSONTokener parser = new JSONTokener(source);
                Object root = parser.nextValue();
                if (parser.nextClean() != 0) throw new VaultFailure("custodial_native_body_refused");
                inspectJson(root, deviceId);
            } catch (VaultFailure error) {
                throw error;
            } catch (Exception error) {
                throw new VaultFailure("custodial_native_body_refused", error);
            }
            return;
        }
        if (contentType.startsWith("application/x-www-form-urlencoded")) {
            inspectQueryIdentity(source, deviceId);
            return;
        }
        throw new VaultFailure("custodial_native_body_refused");
    }

    private static String strictUtf8(byte[] body) throws VaultFailure {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(body))
                .toString();
        } catch (CharacterCodingException error) {
            throw new VaultFailure("custodial_native_body_refused", error);
        }
    }

    private static void inspectJson(Object root, String deviceId) throws VaultFailure {
        Deque<Node> pending = new ArrayDeque<>();
        pending.add(new Node(root, 0));
        int seen = 0;
        while (!pending.isEmpty()) {
            Node node = pending.removeFirst();
            if (++seen > 10_000 || node.depth > 32) throw new VaultFailure("custodial_native_body_refused");
            if (node.value instanceof JSONObject object) {
                Iterator<String> keys = object.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = object.opt(key);
                    if (IDENTITY_NAMES.contains(normalizedName(key))) {
                        if (!(value instanceof String)) throw new VaultFailure("custodial_native_device_binding_mismatch");
                        requireMatchingIdentity((String) value, deviceId);
                    } else if (value instanceof JSONObject || value instanceof JSONArray) {
                        pending.addLast(new Node(value, node.depth + 1));
                    }
                }
            } else if (node.value instanceof JSONArray array) {
                for (int index = 0; index < array.length(); index += 1) {
                    Object value = array.opt(index);
                    if (value instanceof JSONObject || value instanceof JSONArray) {
                        pending.addLast(new Node(value, node.depth + 1));
                    }
                }
            } else {
                throw new VaultFailure("custodial_native_body_refused");
            }
        }
    }

    private static void requireMatchingIdentity(String candidate, String deviceId) throws VaultFailure {
        try {
            if (!VaultValidation.deviceId(candidate).equals(deviceId)) {
                throw new VaultFailure("custodial_native_device_binding_mismatch");
            }
        } catch (VaultFailure error) {
            throw new VaultFailure("custodial_native_device_binding_mismatch", error);
        }
    }

    private static String normalizedName(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static String header(Map<String, String> headers, String wanted) {
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(wanted)) return entry.getValue() == null ? "" : entry.getValue();
        }
        return "";
    }

    private static final class Node {
        final Object value;
        final int depth;

        Node(Object value, int depth) {
            this.value = value;
            this.depth = depth;
        }
    }
}
