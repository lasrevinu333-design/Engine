package org.memphiszoo.manager.vault;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
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
    /**
     * Full-match method/path registry for the Manager app.  A WebView cannot
     * turn a permitted family into an arbitrary backend request by changing
     * the verb or appending a path.  Dynamic identifiers are deliberately
     * limited to one canonical URI segment.
     */
    private static final List<RouteRule> ROUTES = List.of(
        rule("GET", "/admin-api/(?:health|device-auth/summary|device-security/session)"),
        rule("POST", "/admin-api/(?:attendance-update|bundle|close-ticket|force-close-session|device-auth/enrollment-code|device-auth/mode|device-security/lock|device-security/unlock|device-security/sessions/revoke-all)"),
        rule("POST", "/admin-api/device-auth/(?:codes|credentials)/[A-Za-z0-9._~-]+/revoke"),
        rule("GET", "/admin-api/events(?:/(?:location-groups|event-venues|coverage-locations))?"),
        rule("POST", "/admin-api/events(?:/parse-ai)?"),
        rule("PUT", "/admin-api/events/[A-Za-z0-9._~-]+"),
        rule("DELETE", "/admin-api/events/[A-Za-z0-9._~-]+"),
        rule("GET", "/auth-api/ops/trusted-devices"),
        rule("PATCH", "/auth-api/ops/trusted-devices/[A-Za-z0-9._~-]+"),
        rule("POST", "/auth-api/ops/trusted-devices/(?:revoke-all|[A-Za-z0-9._~-]+/(?:rename|revoke))"),
        rule("GET", "/dashboard-api/(?:canary|current-attendance|events|guest-cleanliness-issues|health|summary|system-feedback|work-session-alerts)"),
        rule("POST", "/dashboard-api/(?:close-ticket|guest-cleanliness-issues/[A-Za-z0-9._~-]+/resolve|system-feedback/[A-Za-z0-9._~-]+/status)"),
        rule("GET", "/feedback-api/(?:health|acknowledge/[A-Za-z0-9._~-]+|image/[A-Za-z0-9._~-]+)"),
        rule("POST", "/feedback-api/(?:acknowledge/[A-Za-z0-9._~-]+|reminders/run|submit)"),
        rule("GET", "/leadership-api/(?:health|phone-assignments|roster)"),
        rule("POST", "/leadership-api/(?:managers/[A-Za-z0-9._~-]+/enrollment-code|phone-assignments/[A-Za-z0-9._~-]+(?:/enrollment-code)?)"),
        rule("GET", "/manager-notifications-api/(?:health|preferences|client-config/[A-Za-z0-9._~-]+)"),
        rule("POST", "/manager-notifications-api/(?:register|test)"),
        rule("PUT", "/manager-notifications-api/preferences"),
        rule("DELETE", "/manager-notifications-api/register"),
        rule("GET", "/analytics-api/(?:cleaning-performance|inspection-coverage|inspections|session-facts|ticket-trends)"),
        rule("POST", "/analytics-api/inspections"),
        rule("GET", "/messaging-api/(?:health|me/by-device|users|threads|threads/updates|device-event-reminders|device-location-status-reminders|thread/[A-Za-z0-9._~-]+/(?:updates|messages))"),
        rule("POST", "/messaging-api/(?:device-notifications/ack|thread/(?:direct|group|team)|thread/[A-Za-z0-9._~-]+/(?:message|delete|admin-tombstone|read)|thread/[A-Za-z0-9._~-]+/message/[A-Za-z0-9._~-]+/delete|memphis/(?:thread|diagnose|message)|broadcast)"),
        rule("GET", "/moxie-mobile-api/workspace"),
        rule("POST", "/moxie-mobile-api/chat"),
        rule("PUT", "/moxie-mobile-api/chat-state"),
        rule("POST", "/moxie-mobile-api/(?:notes|reminders|contacts)"),
        rule("DELETE", "/moxie-mobile-api/(?:notes|reminders|contacts)/[A-Za-z0-9._~-]+"),
        rule("GET", "/scan-api/health"),
        rule("POST", "/scan-api/rpc"),
        rule("GET", "/events-api(?:/(?:health|location-groups|event-venues|coverage-locations))?"),
        rule("POST", "/events-api(?:/parse-ai)?"),
        rule("PUT", "/events-api/[A-Za-z0-9._~-]+"),
        rule("DELETE", "/events-api/[A-Za-z0-9._~-]+"),
        rule("GET", "/gemini-api/(?:health|conversations|search|attachments/[A-Za-z0-9._~-]+|conversations/[A-Za-z0-9._~-]+/(?:messages|repair-state))"),
        rule("POST", "/gemini-api/(?:conversations|conversations/[A-Za-z0-9._~-]+/(?:attachments|messages/stream)|messages/[A-Za-z0-9._~-]+/cancel)"),
        rule("PATCH", "/gemini-api/conversations/[A-Za-z0-9._~-]+"),
        rule("DELETE", "/gemini-api/(?:conversations|attachments)/[A-Za-z0-9._~-]+"),
        rule("GET", "/schedule-api/(?:health|audit/day|work-status|today|day|my-day|my-day-summary|my-schedule|settings/close-time|employees|employee-aliases|shift-templates|pto|coverall/slots|coverall/assignment|location-groups|audit|coverage-templates/export[.]csv|locations/workload-settings|current-owner|sch2/runs|sch2/explain|generation-window|restroom-rebalance/status)"),
        rule("POST", "/schedule-api/(?:settings/close-time|employee-aliases|pto/(?:import|import-report|parse-report)|coverall/(?:slots|links|links/revoke)|ai/(?:recommendations|audit)|locations/[A-Za-z0-9._~-]+/workload-settings|generate-daily|sch2/(?:preview|publish|rollback)|generate-range|manual-absences/(?:publish|return)|absence-(?:preview|publish)|restroom-rebalance/run)"),
        rule("PATCH", "/schedule-api/(?:employee-aliases/[A-Za-z0-9._~-]+|shift-templates/metadata)")
    );
    private static final List<String> CREDENTIAL_MANAGEMENT_PREFIXES = VaultCollections.listOf(
        "/manager-device-auth/",
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
    private static final Set<String> FORBIDDEN_BODY_NAMES = VaultCollections.setOf(
        "authorization",
        "accesstoken",
        "bearer",
        "bearertoken",
        "cookie",
        "csrftoken",
        "devicecredential",
        "devicesecuritycsrf",
        "memphisdevicecredential",
        "proxyauthorization",
        "refreshtoken",
        "sessiontoken",
        "xdevicecredential",
        "xmemphisdevicecredential"
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
        "x-csrf-token",
        "x-device-security-csrf",
        "x-device-credential",
        "x-memphis-device-credential"
    );
    private static final Pattern CANONICAL_PATH = Pattern.compile("^/[A-Za-z0-9._~-]+(?:/[A-Za-z0-9._~-]+)*$");

    private RequestPolicy() {}

    static AuthorizedRequest validate(AuthorizedRequest request, String authoritativeDeviceId) throws VaultFailure {
        String deviceId = VaultValidation.deviceId(authoritativeDeviceId);
        String method = request.method == null ? "" : request.method.trim().toUpperCase(Locale.ROOT);
        if (!METHODS.contains(method)) throw new VaultFailure("manager_native_method_refused");
        if (request.body.length > MAX_REQUEST_BYTES) throw new VaultFailure("manager_native_request_too_large");
        if ((method.equals("GET") || method.equals("HEAD")) && request.body.length != 0) {
            throw new VaultFailure("manager_native_body_refused");
        }

        URI uri = strictUri(request.path);
        String pathname = uri.getRawPath();
        if (CREDENTIAL_MANAGEMENT_PREFIXES.stream().anyMatch(pathname::startsWith)) {
            throw new VaultFailure("manager_native_credential_path_refused");
        }
        if (ROUTES.stream().noneMatch((route) -> route.matches(method, pathname))) {
            throw new VaultFailure("manager_native_path_refused");
        }

        Map<String, String> sanitizedHeaders = inspectHeaders(request.headers, deviceId);
        boolean callerIdentityBound = callerIdentityBound(pathname);
        inspectQuery(uri.getRawQuery(), deviceId, callerIdentityBound);
        inspectBody(request.body, sanitizedHeaders, deviceId, callerIdentityBound);
        return new AuthorizedRequest(request.path, method, sanitizedHeaders, request.body);
    }

    private static boolean callerIdentityBound(String path) {
        return path.startsWith("/messaging-api/")
            || path.startsWith("/manager-notifications-api/")
            || path.startsWith("/scan-api/")
            || path.equals("/feedback-api/submit");
    }

    private static RouteRule rule(String method, String pathExpression) {
        return new RouteRule(method, pathExpression, Pattern.compile("^(?:" + pathExpression + ")$"));
    }

    static List<String> routeInventory() {
        List<String> inventory = new ArrayList<>();
        for (RouteRule route : ROUTES) inventory.add(route.method + "\t" + route.expression);
        return List.copyOf(inventory);
    }

    private static final class RouteRule {
        private final String method;
        private final String expression;
        private final Pattern path;

        private RouteRule(String method, String expression, Pattern path) {
            this.method = method;
            this.expression = expression;
            this.path = path;
        }

        private boolean matches(String candidateMethod, String candidatePath) {
            return method.equals(candidateMethod) && path.matcher(candidatePath).matches();
        }
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
            throw new VaultFailure("manager_native_origin_refused");
        }
        final URI uri;
        try {
            uri = new URI(raw);
        } catch (Exception error) {
            throw new VaultFailure("manager_native_path_refused", error);
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
            throw new VaultFailure("manager_native_path_refused");
        }
        for (String segment : path.substring(1).split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) {
                throw new VaultFailure("manager_native_path_refused");
            }
        }
        String reconstructed = path + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        if (!reconstructed.equals(raw)) throw new VaultFailure("manager_native_path_refused");
        return uri;
    }

    private static Map<String, String> inspectHeaders(Map<String, String> headers, String deviceId) throws VaultFailure {
        if (headers.size() > 64) throw new VaultFailure("manager_native_headers_refused");
        Set<String> normalizedNames = new HashSet<>();
        Map<String, String> sanitized = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String name = entry.getKey() == null ? "" : entry.getKey().trim();
            String lower = name.toLowerCase(Locale.ROOT);
            String value = entry.getValue() == null ? "" : entry.getValue().trim();
            if (!name.matches("^[A-Za-z0-9-]{1,80}$") || value.length() > 8192 || value.contains("\r") || value.contains("\n")) {
                throw new VaultFailure("manager_native_headers_refused");
            }
            if (FORBIDDEN_HEADERS.contains(lower)) throw new VaultFailure("manager_native_headers_refused");
            if (!normalizedNames.add(lower)) throw new VaultFailure("manager_native_headers_refused");
            if (lower.equals("x-device-id") && !VaultValidation.deviceId(value).equals(deviceId)) {
                throw new VaultFailure("manager_native_device_binding_mismatch");
            }
            if (lower.equals("x-memphis-app-edition") && !value.equals("manager")) {
                throw new VaultFailure("manager_native_headers_refused");
            }
            if (!lower.equals("x-device-id") && !lower.equals("x-memphis-app-edition")) {
                sanitized.put(name, value);
            }
        }
        return VaultCollections.copyMap(sanitized);
    }

    private static void inspectQuery(String rawQuery, String deviceId, boolean enforceCallerIdentity) throws VaultFailure {
        if (rawQuery == null || rawQuery.isEmpty()) return;
        if (rawQuery.length() > 16_384) throw new VaultFailure("manager_native_query_refused");
        for (String item : rawQuery.split("&", -1)) {
            if (item.isEmpty()) continue;
            String[] parts = item.split("=", 2);
            String name = decodeQuery(parts[0]);
            String value = decodeQuery(parts.length == 2 ? parts[1] : "");
            String normalized = normalizedName(name);
            if (FORBIDDEN_BODY_NAMES.contains(normalized)) throw new VaultFailure("manager_native_query_refused");
            if (enforceCallerIdentity && IDENTITY_NAMES.contains(normalized)) requireMatchingIdentity(value, deviceId);
        }
    }

    private static String decodeQuery(String value) throws VaultFailure {
        for (int index = 0; index < value.length(); index += 1) {
            if (value.charAt(index) != '%') continue;
            if (index + 2 >= value.length() || hex(value.charAt(index + 1)) < 0 || hex(value.charAt(index + 2)) < 0) {
                throw new VaultFailure("manager_native_query_refused");
            }
            index += 2;
        }
        try {
            String decoded = URLDecoder.decode(value, "UTF-8");
            if (decoded.indexOf('\0') >= 0 || decoded.contains("\r") || decoded.contains("\n")) {
                throw new VaultFailure("manager_native_query_refused");
            }
            return decoded;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_query_refused", error);
        }
    }

    private static int hex(char value) {
        if (value >= '0' && value <= '9') return value - '0';
        if (value >= 'a' && value <= 'f') return value - 'a' + 10;
        if (value >= 'A' && value <= 'F') return value - 'A' + 10;
        return -1;
    }

    private static void inspectBody(
        byte[] body,
        Map<String, String> headers,
        String deviceId,
        boolean enforceCallerIdentity
    ) throws VaultFailure {
        if (body.length == 0) return;
        String contentType = header(headers, "content-type").toLowerCase(Locale.ROOT);
        String source = strictUtf8(body).trim();
        boolean json = contentType.startsWith("application/json") || source.startsWith("{") || source.startsWith("[");
        if (json) {
            try {
                JSONTokener parser = new JSONTokener(source);
                Object root = parser.nextValue();
                if (parser.nextClean() != 0) throw new VaultFailure("manager_native_body_refused");
                inspectJson(root, deviceId, enforceCallerIdentity);
            } catch (VaultFailure error) {
                throw error;
            } catch (Exception error) {
                throw new VaultFailure("manager_native_body_refused", error);
            }
            return;
        }
        if (contentType.startsWith("application/x-www-form-urlencoded")) {
            inspectQuery(source, deviceId, enforceCallerIdentity);
            return;
        }
        throw new VaultFailure("manager_native_body_refused");
    }

    private static String strictUtf8(byte[] body) throws VaultFailure {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(body))
                .toString();
        } catch (CharacterCodingException error) {
            throw new VaultFailure("manager_native_body_refused", error);
        }
    }

    private static void inspectJson(Object root, String deviceId, boolean enforceCallerIdentity) throws VaultFailure {
        Deque<Node> pending = new ArrayDeque<>();
        pending.add(new Node(root, 0));
        int seen = 0;
        while (!pending.isEmpty()) {
            Node node = pending.removeFirst();
            if (++seen > 10_000 || node.depth > 32) throw new VaultFailure("manager_native_body_refused");
            if (node.value instanceof JSONObject object) {
                Iterator<String> keys = object.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = object.opt(key);
                    String normalized = normalizedName(key);
                    if (FORBIDDEN_BODY_NAMES.contains(normalized)) {
                        throw new VaultFailure("manager_native_body_refused");
                    }
                    if (enforceCallerIdentity && IDENTITY_NAMES.contains(normalized)) {
                        if (!(value instanceof String)) throw new VaultFailure("manager_native_device_binding_mismatch");
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
                throw new VaultFailure("manager_native_body_refused");
            }
        }
    }

    private static void requireMatchingIdentity(String candidate, String deviceId) throws VaultFailure {
        try {
            if (!VaultValidation.deviceId(candidate).equals(deviceId)) {
                throw new VaultFailure("manager_native_device_binding_mismatch");
            }
        } catch (VaultFailure error) {
            throw new VaultFailure("manager_native_device_binding_mismatch", error);
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
