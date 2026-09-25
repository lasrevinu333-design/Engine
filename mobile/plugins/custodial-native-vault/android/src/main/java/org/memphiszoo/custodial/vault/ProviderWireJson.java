package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded RFC8259 wire parser. Android JSONTokener alone allows duplicate keys,
 * single quotes, unquoted keys and trailing separators. Authority routes do not. */
final class ProviderWireJson {
    private final String source;
    private int cursor, values;
    private ProviderWireJson(String source) { this.source = source; }
    /** Exact structural equality for native persisted protocol snapshots, including ordered
     * arrays and lossless integers. No JSON string-order or double-rounding comparison. */
    static boolean same(Object a, Object b) throws Exception {
        if (a instanceof JSONObject && b instanceof JSONObject) {
            JSONObject x = (JSONObject) a, y = (JSONObject) b; if (x.length() != y.length()) return false;
            for (java.util.Iterator<String> it = x.keys(); it.hasNext();) {
                String key = it.next(); if (!y.has(key) || !same(x.get(key), y.get(key))) return false;
            }
            return true;
        }
        if (a instanceof JSONArray && b instanceof JSONArray) {
            JSONArray x = (JSONArray) a, y = (JSONArray) b; if (x.length() != y.length()) return false;
            for (int i = 0; i < x.length(); i++) if (!same(x.get(i), y.get(i))) return false; return true;
        }
        boolean integerA = a instanceof Long || a instanceof Integer, integerB = b instanceof Long || b instanceof Integer;
        if (integerA || integerB) return integerA && integerB && ((Number) a).longValue() == ((Number) b).longValue();
        return a != null && a.equals(b);
    }
    static JSONObject object(byte[] bytes, int maximum) throws VaultFailure {
        if (bytes == null || maximum < 1 || maximum > 262144 || bytes.length == 0 || bytes.length > maximum) throw invalid();
        try {
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            ProviderWireJson parser = new ProviderWireJson(text); Object result = parser.value(0); parser.space();
            if (!(result instanceof JSONObject) || parser.cursor != text.length()) throw invalid();
            return (JSONObject) result;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_wire_json_invalid", error); }
    }
    private Object value(int depth) throws Exception {
        if (++values > 10000 || depth > 16) throw invalid(); space();
        char next = peek();
        if (next == '{') {
            cursor++; JSONObject object = new JSONObject(); Set<String> names = new HashSet<>(); space();
            if (take('}')) return object;
            while (true) {
                space(); if (peek() != '"') throw invalid(); String key = string();
                if (!names.add(key)) throw invalid(); space(); require(':'); object.put(key, value(depth + 1)); space();
                if (take('}')) return object; require(',');
            }
        }
        if (next == '[') {
            cursor++; JSONArray array = new JSONArray(); space(); if (take(']')) return array;
            while (true) { array.put(value(depth + 1)); space(); if (take(']')) return array; require(','); }
        }
        if (next == '"') return string();
        if (source.startsWith("true", cursor)) { cursor += 4; return Boolean.TRUE; }
        if (source.startsWith("false", cursor)) { cursor += 5; return Boolean.FALSE; }
        if (source.startsWith("null", cursor)) { cursor += 4; return JSONObject.NULL; }
        int start = cursor;
        while (cursor < source.length() && "-+0123456789.eE".indexOf(source.charAt(cursor)) >= 0) cursor++;
        String raw = source.substring(start, cursor);
        if (raw.length() > 64 || !raw.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?")) throw invalid();
        if (raw.indexOf('.') < 0 && raw.indexOf('e') < 0 && raw.indexOf('E') < 0) return Long.valueOf(raw);
        Double number = Double.valueOf(raw);
        if (!Double.isFinite(number)) throw invalid();
        return number; // Keep decimal/exponent type: a typed integer field must reject 1.0/1e0.
    }
    private String string() throws Exception {
        require('"'); StringBuilder result = new StringBuilder(); boolean closed = false;
        while (cursor < source.length()) {
            char next = source.charAt(cursor++);
            if (next == '"') { closed = true; break; }
            if (next < 0x20) throw invalid();
            if (next == '\\') {
                if (cursor >= source.length()) throw invalid(); char escaped = source.charAt(cursor++);
                switch (escaped) {
                    case '"': case '\\': case '/': result.append(escaped); break;
                    case 'b': result.append('\b'); break;
                    case 'f': result.append('\f'); break;
                    case 'n': result.append('\n'); break;
                    case 'r': result.append('\r'); break;
                    case 't': result.append('\t'); break;
                    case 'u':
                        if (cursor + 4 > source.length()) throw invalid();
                        String digits = source.substring(cursor, cursor + 4);
                        if (!digits.matches("[0-9A-Fa-f]{4}")) throw invalid();
                        result.append((char) Integer.parseInt(digits, 16)); cursor += 4; break;
                    default: throw invalid();
                }
            } else result.append(next);
        }
        if (!closed) throw invalid();
        for (int i = 0; i < result.length(); i++) {
            char character = result.charAt(i);
            if (Character.isHighSurrogate(character)) {
                if (++i >= result.length() || !Character.isLowSurrogate(result.charAt(i))) throw invalid();
            } else if (Character.isLowSurrogate(character)) throw invalid();
        }
        return result.toString();
    }
    private void space() { while (cursor < source.length() && " \t\r\n".indexOf(source.charAt(cursor)) >= 0) cursor++; }
    private char peek() throws VaultFailure { if (cursor >= source.length()) throw invalid(); return source.charAt(cursor); }
    private boolean take(char expected) { if (cursor < source.length() && source.charAt(cursor) == expected) { cursor++; return true; } return false; }
    private void require(char expected) throws VaultFailure { if (!take(expected)) throw invalid(); }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_wire_json_invalid"); }
}
