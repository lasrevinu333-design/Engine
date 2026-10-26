package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/** UNMOUNTED native-only lossless byte encoder. The caller must supply the exact
 * existing protected-work snapshot, not a broader store or WebView input.
 * It does not read preferences, decrypt/sign values, send HTTP, save/ACK work,
 * remove keys or classify an unknown inventory. Opaque ciphertext stays opaque.
 */
final class NativeRetainedRecordValues {
    static final String SCHEMA = "custodial.retained-native-record-values.v1";
    static final String FAILURE = "custodial_native_retained_record_values_invalid";
    static final int MAX_BYTES = 40 * 1024 * 1024;
    private final byte[] encoded;
    private final NativeProtectedWorkSnapshot originalSnapshot;
    final String sha256;
    final int byteCount;

    private NativeRetainedRecordValues(byte[] encoded, NativeProtectedWorkSnapshot original) throws Exception {
        this.encoded = encoded.clone();
        originalSnapshot = original;
        byteCount = encoded.length;
        sha256 = hex(MessageDigest.getInstance("SHA-256").digest(encoded));
    }

    static NativeRetainedRecordValues capture(Map<String, ?> original) throws VaultFailure {
        try {
            // Snapshot the same supported raw types once. Never convert an
            // unknown type, decode an encrypted record or silently drop a key.
            Map<String, ?> copy = immutableCopy(original);
            NativeProtectedWorkSnapshot identity = NativeProtectedWorkSnapshot.capture(copy);
            Output out = new Output();
            out.ascii("{\"schema\":\"" + SCHEMA + "\",\"records\":[");
            boolean first = true;
            for (String key : new TreeSet<>(copy.keySet())) {
                if (!first) out.ascii(",");
                first = false;
                out.ascii("["); out.stringHex(key);
                Object value = copy.get(key);
                if (value instanceof String) {
                    out.ascii(",\"string\","); out.stringHex((String) value);
                } else if (value instanceof Integer) {
                    out.ascii(",\"int32\",\""); out.ascii(value.toString()); out.ascii("\"");
                } else if (value instanceof Long) {
                    out.ascii(",\"int64\",\""); out.ascii(value.toString()); out.ascii("\"");
                } else if (value instanceof Boolean) {
                    out.ascii(",\"boolean\","); out.ascii((Boolean) value ? "true" : "false");
                } else if (value instanceof Float) {
                    // Exact RAW bits, including signed zero and NaN payloads.
                    String bits = Integer.toUnsignedString(Float.floatToRawIntBits((Float) value), 16);
                    out.ascii(",\"float32\",\"");
                    for (int i = bits.length(); i < 8; i++) out.ascii("0");
                    out.ascii(bits); out.ascii("\"");
                } else if (value instanceof Set<?>) {
                    out.ascii(",\"string-set\",[");
                    TreeSet<String> sorted = new TreeSet<>();
                    for (Object item : (Set<?>) value) {
                        if (!(item instanceof String)) throw invalid();
                        sorted.add((String) item);
                    }
                    boolean firstItem = true;
                    for (String item : sorted) {
                        if (!firstItem) out.ascii(",");
                        firstItem = false; out.stringHex(item);
                    }
                    out.ascii("]");
                } else throw invalid();
                out.ascii("]");
            }
            out.ascii("]}");
            // A caller mutation cannot silently replace the captured source.
            // Owning storage must still perform its original signed/frozen CAS.
            if (!NativeProtectedWorkSnapshot.exactRawEquals(copy, original)) throw invalid();
            return new NativeRetainedRecordValues(out.bytes(), identity);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    byte[] bytes() { return encoded.clone(); }
    NativeProtectedWorkSnapshot snapshot() { return originalSnapshot; }

    private static Map<String, ?> immutableCopy(Map<String, ?> source) throws VaultFailure {
        if (source == null || source.size() > 4096) throw invalid();
        Map<String, Object> copy = new HashMap<>();
        int entries = 0;
        for (Map.Entry<String, ?> entry : source.entrySet()) {
            if (++entries > 4096) throw invalid();
            String key = entry.getKey(); Object value = entry.getValue();
            if (key == null || copy.containsKey(key)) throw invalid();
            if (value instanceof Set<?>) {
                if (((Set<?>) value).size() > 4096) throw invalid();
                HashSet<String> items = new HashSet<>();
                int count = 0;
                for (Object item : (Set<?>) value) {
                    if (++count > 4096 || !(item instanceof String) || !items.add((String) item)) throw invalid();
                }
                if (items.size() != ((Set<?>) value).size()) throw invalid();
                value = Collections.unmodifiableSet(items);
            }
            copy.put(key, value);
        }
        if (copy.size() != source.size()) throw invalid();
        return Collections.unmodifiableMap(copy);
    }

    private static final class Output {
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private void put(int value) throws VaultFailure {
            if (bytes.size() >= MAX_BYTES || value < 32 || value > 126) throw invalid();
            bytes.write(value);
        }
        void ascii(String text) throws VaultFailure {
            for (int i = 0; i < text.length(); i++) put(text.charAt(i));
        }
        void stringHex(String text) throws VaultFailure {
            put('"');
            for (int i = 0; i < text.length(); i++) {
                char value = text.charAt(i);
                for (int shift = 12; shift >= 0; shift -= 4) put(Character.forDigit((value >>> shift) & 15, 16));
            }
            put('"');
        }
        byte[] bytes() { return bytes.toByteArray(); }
    }
    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(Character.forDigit((value & 255) >>> 4, 16)).append(Character.forDigit(value & 15, 16));
        return result.toString();
    }
    private static VaultFailure invalid() { return new VaultFailure(FAILURE); }
}
