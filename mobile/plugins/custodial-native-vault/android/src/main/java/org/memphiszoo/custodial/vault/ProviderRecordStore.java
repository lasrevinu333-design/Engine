package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;

/** Storage only: journal owns admission, removal fences and safe compaction.
 * No WebView API, enrollment key, token registration or notification effects. */
final class ProviderRecordStore {
    static final long MAX_NAMESPACE_BYTES = 8L * 1024 * 1024;
    static final long MAX_DIAGNOSTIC_BYTES = 64L * 1024;
    static final String INDEX = "index";
    private static final String INDEX_SCHEMA = "custodial.provider-index.v1";
    private static final int MAX_WIRE_CHARS = 2 * (ProviderEnvelopeCrypto.MAX_RECORD_BYTES + 28) + 1;
    static final Key DIAGNOSTIC = key(ProviderEnvelopeCrypto.Domain.METADATA, "recovery-diagnostic");

    interface Backend {
        Map<String, ?> readAll() throws Exception;
        /** ONE atomic commit, removing only previous provider-owned keys. */
        boolean replace(Map<String, String> next) throws Exception;
    }
    interface Crypto {
        void initialize() throws VaultFailure;
        ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain, String id, char[] value) throws VaultFailure;
        char[] decrypt(ProviderEnvelopeCrypto.Domain domain, String id, ProviderEnvelopeCrypto.Envelope value) throws VaultFailure;
    }
    static final class Key implements Comparable<Key> {
        final ProviderEnvelopeCrypto.Domain domain;
        final String id;
        private Key(ProviderEnvelopeCrypto.Domain domain, String id) {
            if (domain == null || id == null || !id.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
                throw new IllegalArgumentException("custodial_provider_record_identity_invalid");
            }
            this.domain = domain; this.id = id;
        }
        String storageName() { return domain.name() + ":" + id; }
        @Override public int compareTo(Key other) { return storageName().compareTo(other.storageName()); }
        @Override public boolean equals(Object other) { return other instanceof Key && compareTo((Key) other) == 0; }
        @Override public int hashCode() { return storageName().hashCode(); }
    }
    static Key key(ProviderEnvelopeCrypto.Domain domain, String id) { return new Key(domain, id); }

    static final class Snapshot {
        final long revision;
        private final Map<Key, String> encrypted;
        private final Crypto crypto;
        private Snapshot(long revision, Map<Key, String> encrypted, Crypto crypto) {
            this.revision = revision;
            this.encrypted = Collections.unmodifiableMap(new TreeMap<>(encrypted));
            this.crypto = crypto;
        }
        Set<Key> keys() { return encrypted.keySet(); }
        /** Caller owns and wipes returned chars; absence is distinct from decryption failure. */
        char[] read(Key key) throws VaultFailure {
            String wire = encrypted.get(key);
            return wire == null ? null : crypto.decrypt(key.domain, key.id, parseWire(wire));
        }
    }

    private final Backend backend;
    private final Crypto crypto;
    private final Object lock;
    ProviderRecordStore(Backend backend, Crypto crypto, Object lock) {
        if (backend == null || crypto == null || lock == null) throw new IllegalArgumentException("provider_store_dependencies_required");
        this.backend = backend; this.crypto = crypto; this.lock = lock;
    }

    Snapshot load() throws VaultFailure {
        synchronized (lock) {
            crypto.initialize(); // Missing key with ANY retained preferences must fail closed.
            return decode(readRaw());
        }
    }

    Snapshot commit(long expectedRevision, Map<Key, char[]> writes, Set<Key> removals) throws VaultFailure {
        if (writes == null || removals == null || !Collections.disjoint(writes.keySet(), removals)) {
            throw new VaultFailure("custodial_provider_transaction_invalid");
        }
        synchronized (lock) {
            Snapshot current = load();
            if (expectedRevision < 0 || current.revision != expectedRevision || expectedRevision == Long.MAX_VALUE) {
                throw new VaultFailure("custodial_provider_concurrent_change");
            }
            Map<Key, String> next = new TreeMap<>(current.encrypted);
            for (Key key : removals) {
                if (key == null || !next.containsKey(key)) throw new VaultFailure("custodial_provider_remove_unknown");
                next.remove(key);
            }
            for (Map.Entry<Key, char[]> entry : writes.entrySet()) {
                Key key = entry.getKey();
                if (key == null) throw new VaultFailure("custodial_provider_transaction_invalid");
                next.put(key, wire(crypto.encrypt(key.domain, key.id, entry.getValue())));
            }
            enforceCounts(next);
            Map<String, String> raw = rawRecords(next);
            char[] index;
            try { index = new JSONObject().put("schema", INDEX_SCHEMA).put("revision", expectedRevision + 1)
                .put("digest", digest(raw)).toString().toCharArray(); }
            catch (Exception error) { throw new VaultFailure("custodial_provider_index_failed", error); }
            try { raw.put(INDEX, wire(crypto.encrypt(ProviderEnvelopeCrypto.Domain.METADATA, INDEX, index))); }
            finally { Arrays.fill(index, '\0'); }
            enforceBytes(raw);
            try {
                if (!backend.replace(Collections.unmodifiableMap(raw))) throw new VaultFailure("custodial_provider_commit_failed_preserved");
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_commit_failed_preserved", error); }
            Map<String, String> readback = readRaw();
            if (!raw.equals(readback)) throw new VaultFailure("custodial_provider_readback_failed_preserved");
            Snapshot accepted = decode(readback); // Authenticate index AND every record before caller effects.
            if (accepted.revision != expectedRevision + 1) throw new VaultFailure("custodial_provider_readback_failed_preserved");
            return accepted;
        }
    }

    private Map<String, String> readRaw() throws VaultFailure {
        try {
            Map<String, ?> values = backend.readAll();
            if (values == null) throw new IllegalArgumentException("null namespace");
            Map<String, String> result = new TreeMap<>();
            for (Map.Entry<String, ?> entry : values.entrySet()) {
                if (entry.getKey() == null || entry.getKey().length() > 150 || !(entry.getValue() instanceof String)
                    || ((String) entry.getValue()).length() > MAX_WIRE_CHARS) throw new IllegalArgumentException("invalid provider value");
                result.put(entry.getKey(), (String) entry.getValue());
            }
            enforceBytes(result);
            return result;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_corrupt_preserved", error); }
    }
    private Snapshot decode(Map<String, String> raw) throws VaultFailure {
        if (raw.isEmpty()) return new Snapshot(0, Collections.emptyMap(), crypto);
        char[] plain = null;
        try {
            String encodedIndex = raw.get(INDEX);
            if (encodedIndex == null) throw new IllegalArgumentException("missing index");
            plain = crypto.decrypt(ProviderEnvelopeCrypto.Domain.METADATA, INDEX, parseWire(encodedIndex));
            JSONObject index = new JSONObject(new String(plain));
            Object revision = index.get("revision");
            if (index.length() != 3 || !INDEX_SCHEMA.equals(index.get("schema"))
                || !(revision instanceof Long || revision instanceof Integer) || ((Number) revision).longValue() <= 0
                || !(index.get("digest") instanceof String)) throw new IllegalArgumentException("invalid index");
            Map<String, String> records = new TreeMap<>(raw); records.remove(INDEX);
            if (!digest(records).equals(index.getString("digest"))) throw new IllegalArgumentException("index binding mismatch");
            Map<Key, String> values = new TreeMap<>();
            for (Map.Entry<String, String> entry : records.entrySet()) {
                int boundary = entry.getKey().indexOf(':');
                if (boundary <= 0) throw new IllegalArgumentException("invalid record key");
                Key key = key(ProviderEnvelopeCrypto.Domain.valueOf(entry.getKey().substring(0, boundary)), entry.getKey().substring(boundary + 1));
                char[] record = crypto.decrypt(key.domain, key.id, parseWire(entry.getValue()));
                Arrays.fill(record, '\0');
                values.put(key, entry.getValue());
            }
            enforceCounts(values);
            return new Snapshot(((Number) revision).longValue(), values, crypto);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_corrupt_preserved", error); }
        finally { if (plain != null) Arrays.fill(plain, '\0'); }
    }
    private static Map<String, String> rawRecords(Map<Key, String> values) {
        Map<String, String> raw = new TreeMap<>();
        for (Map.Entry<Key, String> value : values.entrySet()) raw.put(value.getKey().storageName(), value.getValue());
        return raw;
    }
    private static void enforceCounts(Map<Key, String> values) throws VaultFailure {
        int generations = 0, inbox = 0, events = 0, tombstones = 0;
        for (Key key : values.keySet()) switch (key.domain) {
            case GENERATION: generations++; break;
            case INBOX: case QUARANTINE: inbox++; break;
            case EVENT: events++; break;
            case TOMBSTONE: tombstones++; break;
            default: break;
        }
        if (generations > 32 || inbox > 256 || events > 1536 || tombstones > 1024) throw new VaultFailure("custodial_provider_capacity_preserved");
    }
    private static void enforceBytes(Map<String, String> raw) throws VaultFailure {
        long normal = 0, diagnostic = 0;
        for (Map.Entry<String, String> value : raw.entrySet()) {
            // Conservatively budget UTF-8 XML storage including a per-entry framing allowance.
            long bytes = value.getKey().getBytes(StandardCharsets.UTF_8).length
                + value.getValue().getBytes(StandardCharsets.UTF_8).length + 64L;
            if (DIAGNOSTIC.storageName().equals(value.getKey())) diagnostic += bytes; else normal += bytes;
        }
        if (normal > MAX_NAMESPACE_BYTES || diagnostic > MAX_DIAGNOSTIC_BYTES) throw new VaultFailure("custodial_provider_capacity_preserved");
    }
    private static String digest(Map<String, String> raw) throws VaultFailure {
        try {
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            for (Map.Entry<String, String> entry : new TreeMap<>(raw).entrySet()) {
                for (String field : new String[]{entry.getKey(), entry.getValue()}) {
                    byte[] bytes = field.getBytes(StandardCharsets.UTF_8);
                    hash.update(ByteBuffer.allocate(4).putInt(bytes.length).array()); hash.update(bytes);
                }
            }
            return hex(hash.digest());
        } catch (Exception error) { throw new VaultFailure("custodial_provider_index_failed", error); }
    }
    private static String wire(ProviderEnvelopeCrypto.Envelope value) { return hex(value.iv()) + "." + hex(value.ciphertext()); }
    private static ProviderEnvelopeCrypto.Envelope parseWire(String value) throws VaultFailure {
        if (value == null || value.length() > MAX_WIRE_CHARS || value.length() < 59
            || value.charAt(24) != '.' || value.indexOf('.', 25) != -1) throw new VaultFailure("custodial_provider_envelope_invalid");
        return new ProviderEnvelopeCrypto.Envelope(unhex(value.substring(0, 24)), unhex(value.substring(25)));
    }
    private static String hex(byte[] bytes) {
        char[] out = new char[bytes.length * 2]; String alphabet = "0123456789abcdef";
        for (int i = 0; i < bytes.length; i++) { out[i * 2] = alphabet.charAt((bytes[i] & 255) >>> 4); out[i * 2 + 1] = alphabet.charAt(bytes[i] & 15); }
        return new String(out);
    }
    private static byte[] unhex(String value) throws VaultFailure {
        if ((value.length() & 1) != 0 || !value.matches("[0-9a-f]+")) throw new VaultFailure("custodial_provider_envelope_invalid");
        byte[] bytes = new byte[value.length() / 2];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) ((Character.digit(value.charAt(i * 2), 16) << 4) | Character.digit(value.charAt(i * 2 + 1), 16));
        return bytes;
    }
}
