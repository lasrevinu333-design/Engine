package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Keystore-protected durable state for monotonic offline work time. */
final class AndroidOfflineAuthorityTimeStore implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
    private static final String PREFERENCES = "MemphisZooCustodialOfflineAuthorityTimeV1";
    private static final String ANCHOR_KEY = "offline_authority_anchor";
    private static final String ROLLBACK_FENCE_KEY = "rollback_fence";
    private static final String SCAN_ENTRIES_KEY = "offline_scan_entries";
    private static final String NFC_HANDOFFS_KEY = "native_nfc_handoffs";
    private static final String OCCURRENCE_PREFIX = "offline_occurrence_sha256:";
    private static final String PROTECTION_AAD = "org.memphiszoo.custodial.native-vault.offline-authority-time.v1";
    private static final int MAX_PROTECTED_RECORD_CHARACTERS = 131_072;
    private final SharedPreferences preferences;
    private final CredentialCipher cipher;

    AndroidOfflineAuthorityTimeStore(Context context) {
        this(
            context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE),
            new AndroidKeystoreCipher(PROTECTION_AAD, MAX_PROTECTED_RECORD_CHARACTERS)
        );
    }

    /** Package-private fault-injection seam for the encrypted journal adapter. */
    AndroidOfflineAuthorityTimeStore(SharedPreferences preferences, CredentialCipher cipher) {
        this.preferences = preferences;
        this.cipher = cipher;
    }

    @Override
    public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor() throws VaultFailure {
        try {
            JSONObject value = load(ANCHOR_KEY, "custodial_native_offline_anchor_refused");
            if (value == null) return null;
            Set<String> keys = keys(value);
            Set<String> legacyKeys = setOf(
                "device_id", "snapshot_id", "generated_at", "expires_at",
                "anchor_elapsed_realtime_ms", "boot_count"
            );
            Set<String> currentKeys = setOf(
                "device_id", "snapshot_id", "generated_at", "expires_at", "clock_base_at",
                "anchor_elapsed_realtime_ms", "boot_count", "new_work_authorized", "snapshot_json"
            );
            if (!keys.equals(legacyKeys) && !keys.equals(currentKeys)) {
                throw new VaultFailure("custodial_native_offline_anchor_refused");
            }
            boolean legacy = keys.equals(legacyKeys);
            return new OfflineAuthorityTime.OfflineAuthorityAnchor(
                value.getString("device_id"),
                value.getString("snapshot_id"),
                value.getString("generated_at"),
                value.getString("expires_at"),
                legacy ? value.getString("generated_at") : value.getString("clock_base_at"),
                value.getLong("anchor_elapsed_realtime_ms"),
                value.getInt("boot_count"),
                !legacy && value.getBoolean("new_work_authorized"),
                legacy ? "" : value.getString("snapshot_json")
            );
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    @Override
    public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor anchor) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("device_id", anchor.deviceId);
            value.put("snapshot_id", anchor.snapshotId);
            value.put("generated_at", anchor.generatedAt);
            value.put("expires_at", anchor.expiresAt);
            value.put("clock_base_at", anchor.clockBaseAt);
            value.put("anchor_elapsed_realtime_ms", anchor.anchorElapsedRealtimeMillis);
            value.put("boot_count", anchor.bootCount);
            value.put("new_work_authorized", anchor.newWorkAuthorized);
            value.put("snapshot_json", anchor.snapshotJson);
            save(ANCHOR_KEY, value, "custodial_native_offline_anchor_refused");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    @Override
    public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String clientSessionId) throws VaultFailure {
        try {
            JSONObject value = load(occurrenceKey(clientSessionId), "custodial_native_offline_occurrence_mismatch");
            if (value == null) return null;
            Set<String> legacyKeys = setOf(
                "client_session_id",
                "device_id",
                "location_code",
                "snapshot_id",
                "generated_at",
                "expires_at",
                "anchor_elapsed_realtime_ms",
                "boot_count",
                "native_scan_entry_id",
                "started_at",
                "completed_at"
            );
            Set<String> currentKeys = new HashSet<>(legacyKeys);
            currentKeys.add("clock_base_at");
            Set<String> actualKeys = keys(value);
            if (!actualKeys.equals(legacyKeys) && !actualKeys.equals(currentKeys)) {
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            }
            boolean legacy = actualKeys.equals(legacyKeys);
            if (!clientSessionId.equals(value.getString("client_session_id"))) {
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            }
            return new OfflineAuthorityTime.OfflineOccurrence(
                value.getString("client_session_id"),
                value.getString("device_id"),
                value.getString("location_code"),
                value.getString("snapshot_id"),
                value.getString("generated_at"),
                value.getString("expires_at"),
                legacy ? value.getString("generated_at") : value.getString("clock_base_at"),
                value.getLong("anchor_elapsed_realtime_ms"),
                value.getInt("boot_count"),
                value.getString("native_scan_entry_id"),
                value.getString("started_at"),
                value.getString("completed_at")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        }
    }

    @Override
    public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence occurrence) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("client_session_id", occurrence.clientSessionId);
            value.put("device_id", occurrence.deviceId);
            value.put("location_code", occurrence.locationCode);
            value.put("snapshot_id", occurrence.snapshotId);
            value.put("generated_at", occurrence.generatedAt);
            value.put("expires_at", occurrence.expiresAt);
            value.put("clock_base_at", occurrence.clockBaseAt);
            value.put("anchor_elapsed_realtime_ms", occurrence.anchorElapsedRealtimeMillis);
            value.put("boot_count", occurrence.bootCount);
            value.put("native_scan_entry_id", occurrence.nativeScanEntryId);
            value.put("started_at", occurrence.startedAt);
            value.put("completed_at", occurrence.completedAt);
            save(occurrenceKey(occurrence.clientSessionId), value, "custodial_native_offline_occurrence_mismatch");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        }
    }

    @Override
    public void deleteOccurrence(String clientSessionId) throws VaultFailure {
        String key = occurrenceKey(clientSessionId);
        if (!preferences.edit().remove(key).commit() || preferences.contains(key)) {
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
    }

    @Override
    public OfflineAuthorityTime.RollbackFence loadRollbackFence() throws VaultFailure {
        try {
            JSONObject value = load(ROLLBACK_FENCE_KEY, "custodial_native_rollback_fence_mismatch");
            if (value == null) return null;
            requireKeys(value, "custodial_native_rollback_fence_mismatch", "device_id", "fence_id");
            return new OfflineAuthorityTime.RollbackFence(
                VaultValidation.deviceId(value.getString("device_id")),
                value.getString("fence_id")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_rollback_fence_mismatch", error);
        }
    }

    @Override
    public void saveRollbackFence(OfflineAuthorityTime.RollbackFence fence) throws VaultFailure {
        try {
            JSONObject value = new JSONObject();
            value.put("device_id", fence.deviceId);
            value.put("fence_id", fence.fenceId);
            save(ROLLBACK_FENCE_KEY, value, "custodial_native_rollback_fence_mismatch");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_rollback_fence_mismatch", error);
        }
    }

    @Override
    public void deleteRollbackFence() throws VaultFailure {
        if (!preferences.edit().remove(ROLLBACK_FENCE_KEY).commit() || preferences.contains(ROLLBACK_FENCE_KEY)) {
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
    }

    @Override
    public boolean hasOccurrences() {
        for (String key : preferences.getAll().keySet()) {
            if (key.startsWith(OCCURRENCE_PREFIX)) return true;
        }
        return false;
    }

    @Override
    public Map<String, Map<String, Object>> loadScanEntries() throws VaultFailure {
        try {
            JSONObject value = load(SCAN_ENTRIES_KEY, "custodial_native_scan_journal_refused");
            if (value == null) return new LinkedHashMap<>();
            requireKeys(value, "custodial_native_scan_journal_refused", "entries");
            JSONArray entries = value.getJSONArray("entries");
            if (entries.length() > 4) throw new VaultFailure("custodial_native_scan_journal_refused");
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            for (int index = 0; index < entries.length(); index += 1) {
                JSONObject record = entries.getJSONObject(index);
                Map<String, Object> converted = new LinkedHashMap<>();
                java.util.Iterator<String> iterator = record.keys();
                while (iterator.hasNext()) {
                    String key = iterator.next();
                    Object item = record.get(key);
                    converted.put(key, item == JSONObject.NULL ? null : item);
                }
                String entryId = record.getString("entry_id");
                if (result.put(entryId, converted) != null) {
                    throw new VaultFailure("custodial_native_scan_journal_refused");
                }
            }
            return result;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_refused", error);
        }
    }

    @Override
    public void saveScanEntries(Map<String, Map<String, Object>> entries) throws VaultFailure {
        if (entries == null || entries.size() > 4) throw new VaultFailure("custodial_native_scan_journal_refused");
        try {
            JSONArray encodedEntries = new JSONArray();
            for (Map.Entry<String, Map<String, Object>> entry : entries.entrySet()) {
                if (!entry.getKey().equals(String.valueOf(entry.getValue().get("entry_id")))) {
                    throw new VaultFailure("custodial_native_scan_journal_refused");
                }
                encodedEntries.put(new JSONObject(entry.getValue()));
            }
            JSONObject value = new JSONObject();
            value.put("entries", encodedEntries);
            save(SCAN_ENTRIES_KEY, value, "custodial_native_scan_journal_refused");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_scan_journal_refused", error);
        }
    }

    Map<String, Map<String, Object>> loadNfcHandoffs() throws VaultFailure {
        try {
            JSONObject value = load(NFC_HANDOFFS_KEY, "custodial_native_nfc_handoff_refused");
            if (value == null) return new LinkedHashMap<>();
            requireKeys(value, "custodial_native_nfc_handoff_refused", "handoffs");
            JSONArray handoffs = value.getJSONArray("handoffs");
            if (handoffs.length() > 4) throw new VaultFailure("custodial_native_nfc_handoff_refused");
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            for (int index = 0; index < handoffs.length(); index += 1) {
                JSONObject record = handoffs.getJSONObject(index);
                Map<String, Object> converted = new LinkedHashMap<>();
                java.util.Iterator<String> iterator = record.keys();
                while (iterator.hasNext()) {
                    String key = iterator.next();
                    Object item = record.get(key);
                    converted.put(key, item == JSONObject.NULL ? null : item);
                }
                String handoffId = record.getString("handoff_id");
                if (result.put(handoffId, converted) != null) {
                    throw new VaultFailure("custodial_native_nfc_handoff_refused");
                }
            }
            return result;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
    }

    void saveNfcHandoffs(Map<String, Map<String, Object>> handoffs) throws VaultFailure {
        if (handoffs == null || handoffs.size() > 4) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused");
        }
        try {
            JSONArray encodedHandoffs = new JSONArray();
            for (Map.Entry<String, Map<String, Object>> entry : handoffs.entrySet()) {
                if (!entry.getKey().equals(String.valueOf(entry.getValue().get("handoff_id")))) {
                    throw new VaultFailure("custodial_native_nfc_handoff_refused");
                }
                encodedHandoffs.put(new JSONObject(entry.getValue()));
            }
            JSONObject value = new JSONObject();
            value.put("handoffs", encodedHandoffs);
            save(NFC_HANDOFFS_KEY, value, "custodial_native_nfc_handoff_refused");
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
    }

    private JSONObject load(String key, String code) throws VaultFailure {
        String encoded = preferences.getString(key, null);
        if (encoded == null || encoded.isEmpty()) return null;
        char[] clear = null;
        try {
            JSONObject envelope = new JSONObject(encoded);
            requireKeys(envelope, code, "ciphertext", "iv");
            clear = cipher.decrypt(new EncryptedSecret(
                envelope.getString("ciphertext"),
                envelope.getString("iv")
            ));
            String value = String.valueOf(clear);
            if (value.length() > MAX_PROTECTED_RECORD_CHARACTERS) throw new VaultFailure(code);
            return new JSONObject(value);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        } finally {
            if (clear != null) VaultValidation.wipe(clear);
        }
    }

    private void save(String key, JSONObject value, String code) throws VaultFailure {
        String encodedValue = value.toString();
        if (encodedValue.length() > MAX_PROTECTED_RECORD_CHARACTERS) throw new VaultFailure(code);
        char[] clear = encodedValue.toCharArray();
        try {
            EncryptedSecret protectedValue = cipher.encrypt(clear);
            JSONObject envelope = new JSONObject();
            envelope.put("ciphertext", protectedValue.ciphertext);
            envelope.put("iv", protectedValue.iv);
            String encoded = envelope.toString();
            if (!preferences.edit().putString(key, encoded).commit()) {
                throw new VaultFailure("custodial_native_offline_time_persistence_failed");
            }
            if (!encoded.equals(preferences.getString(key, null))) {
                throw new VaultFailure("custodial_native_offline_time_persistence_failed");
            }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure(code, error);
        } finally {
            VaultValidation.wipe(clear);
        }
    }

    private static String occurrenceKey(String clientSessionId) throws VaultFailure {
        if (clientSessionId == null || clientSessionId.isEmpty()) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        byte[] clear = clientSessionId.getBytes(StandardCharsets.UTF_8);
        byte[] digest = null;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(clear);
            StringBuilder encoded = new StringBuilder(digest.length * 2);
            for (byte value : digest) encoded.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return OCCURRENCE_PREFIX + encoded;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (digest != null) Arrays.fill(digest, (byte) 0);
        }
    }

    private static void requireKeys(JSONObject value, String code, String... expected) throws VaultFailure {
        Set<String> keys = keys(value);
        Set<String> allowed = setOf(expected);
        if (!keys.equals(allowed)) throw new VaultFailure(code);
    }

    private static Set<String> keys(JSONObject value) {
        Set<String> keys = new HashSet<>();
        java.util.Iterator<String> iterator = value.keys();
        while (iterator.hasNext()) keys.add(iterator.next());
        return keys;
    }

    private static Set<String> setOf(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }
}
