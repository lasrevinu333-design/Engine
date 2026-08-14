package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONObject;

/** Keystore-protected durable state for monotonic offline work time. */
final class AndroidOfflineAuthorityTimeStore implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
    private static final String PREFERENCES = "MemphisZooCustodialOfflineAuthorityTimeV1";
    private static final String ANCHOR_KEY = "offline_authority_anchor";
    private static final String OCCURRENCE_PREFIX = "offline_occurrence_sha256:";
    private static final String PROTECTION_AAD = "org.memphiszoo.custodial.native-vault.offline-authority-time.v1";
    private final SharedPreferences preferences;
    private final CredentialCipher cipher;

    AndroidOfflineAuthorityTimeStore(Context context) {
        this(
            context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE),
            new AndroidKeystoreCipher(PROTECTION_AAD)
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
            requireKeys(value, "custodial_native_offline_anchor_refused", "device_id", "snapshot_id", "generated_at", "expires_at", "anchor_elapsed_realtime_ms", "boot_count");
            return new OfflineAuthorityTime.OfflineAuthorityAnchor(
                value.getString("device_id"),
                value.getString("snapshot_id"),
                value.getString("generated_at"),
                value.getString("expires_at"),
                value.getLong("anchor_elapsed_realtime_ms"),
                value.getInt("boot_count")
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
            value.put("anchor_elapsed_realtime_ms", anchor.anchorElapsedRealtimeMillis);
            value.put("boot_count", anchor.bootCount);
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
            requireKeys(
                value,
                "custodial_native_offline_occurrence_mismatch",
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
            if (value.length() > 16_384) throw new VaultFailure(code);
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
        char[] clear = value.toString().toCharArray();
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
        Set<String> keys = new HashSet<>();
        java.util.Iterator<String> iterator = value.keys();
        while (iterator.hasNext()) keys.add(iterator.next());
        Set<String> allowed = new HashSet<>(Arrays.asList(expected));
        if (!keys.equals(allowed)) throw new VaultFailure(code);
    }
}
