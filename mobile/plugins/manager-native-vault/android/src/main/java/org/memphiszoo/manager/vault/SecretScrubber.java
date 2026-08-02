package org.memphiszoo.manager.vault;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class SecretScrubber {
    private static final Set<String> SECRET_KEYS = VaultCollections.setOf(
        "authorization",
        "cookie",
        "setcookie",
        "credential",
        "devicecredential",
        "xdevicecredential",
        "xmemphisdevicecredential",
        "credentialsecret",
        "secret",
        "token",
        "sessiontoken",
        "accesstoken",
        "refreshtoken",
        "csrftoken",
        "devicesecuritycsrf",
        "password",
        "managercode",
        "enrollmentcode",
        "ciphertext",
        "iv"
    );

    private SecretScrubber() {}

    static Object scrub(Object value) {
        return scrub(value, null);
    }

    static Object scrub(Object value, char[] exactSecret) {
        return scrub(value, exactSecret == null ? null : new String(exactSecret), 0);
    }

    private static Object scrub(Object value, String exactSecret, int depth) {
        if (depth > 32) return null;
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> safe = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (secretKey(key) || containsExactSecret(key, exactSecret)) continue;
                safe.put(key, scrub(entry.getValue(), exactSecret, depth + 1));
            }
            return Collections.unmodifiableMap(safe);
        }
        if (value instanceof List<?> list) {
            List<Object> safe = new ArrayList<>();
            for (Object item : list) safe.add(scrub(item, exactSecret, depth + 1));
            return Collections.unmodifiableList(safe);
        }
        if (value instanceof JSONObject object) {
            Map<String, Object> safe = new LinkedHashMap<>();
            java.util.Iterator<String> keys = object.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (secretKey(key) || containsExactSecret(key, exactSecret)) continue;
                safe.put(key, scrub(object.opt(key), exactSecret, depth + 1));
            }
            return Collections.unmodifiableMap(safe);
        }
        if (value instanceof JSONArray array) {
            List<Object> safe = new ArrayList<>();
            for (int index = 0; index < array.length(); index += 1) safe.add(scrub(array.opt(index), exactSecret, depth + 1));
            return Collections.unmodifiableList(safe);
        }
        if (value == JSONObject.NULL) return null;
        if (value instanceof String && containsExactSecret((String) value, exactSecret)) return null;
        if (value instanceof String || value instanceof Number || value instanceof Boolean || value == null) return value;
        String encoded = String.valueOf(value);
        return containsExactSecret(encoded, exactSecret) ? null : encoded;
    }

    private static boolean containsExactSecret(String value, String exactSecret) {
        return exactSecret != null && !exactSecret.isEmpty() && value != null && value.contains(exactSecret);
    }

    static boolean secretKey(String key) {
        String normalized = key == null ? "" : key.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return SECRET_KEYS.contains(normalized);
    }
}
