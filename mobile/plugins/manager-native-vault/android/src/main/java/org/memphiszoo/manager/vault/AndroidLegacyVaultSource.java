package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Read-once adapter for both historical stores. Cleanup removes preference
 * values before deleting keys, making every crash point safely retryable.
 */
final class AndroidLegacyVaultSource implements LegacyVaultSource {
    private static final String V1_PREFERENCES = "MemphisZooManagerNativeVaultV1";
    private static final String V1_ALIAS = "org.memphiszoo.manager.native-vault.v1";
    private static final String V1_SECRET = "credential_ciphertext";
    private static final String V1_IV = "credential_iv";
    private static final String V1_RECORD = "installation_record";
    private static final String V1_ACTIVE = "installation_active";
    private static final String V1_PENDING_OPERATION = "pending_operation_id";
    private static final String V1_PENDING_DEVICE = "pending_device_id";
    private static final String V1_REMOVAL_OPERATION = "removal_operation_id";
    private static final String V1_REMOVAL_COMPLETE = "removal_remote_complete";
    private static final String V1_BLOCKED = "blocked_reason";
    private static final String V1_LEGACY_SEAL = "legacy_seal";

    private static final String SECURE_PREFERENCES = "WSSecureStorageSharedPreferences";
    // The retired Manager app stored this credential through Aparajita
    // SecureStorage.  It had no authoritative installation record, so the V2
    // engine imports it only as LEGACY_PENDING. It can never become v2
    // authority; a manager-approved recovery creates fresh hardware keys and
    // a v2 credential before activation.
    private static final String SECURE_RECORD = "capacitor-storage_memphis_zoo_ops_installation_record_v1";
    private static final String SECURE_CREDENTIAL = "capacitor-storage_memphis_zoo_ops_device_credential";
    private static final String SECURE_SEAL = "capacitor-storage_memphis_zoo_ops_installation_seal";
    private static final List<String> SECURE_ALIASES = VaultCollections.listOf(SECURE_RECORD, SECURE_CREDENTIAL, SECURE_SEAL);
    private static final char SECURE_SEPARATOR = '\u0010';
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final Set<String> RECORD_KEYS = VaultCollections.setOf(
        "schema_version",
        "credential",
        "device_id",
        "installation_seal",
        "enrolled_at",
        "migrated_from_credential_only_state",
        "enrollment_operation_id"
    );

    private final Context context;
    private final VaultClock clock;
    private KeyStore keyStore;

    AndroidLegacyVaultSource(Context context, VaultClock clock) {
        this.context = context.getApplicationContext();
        this.clock = clock;
    }

    @Override
    public synchronized LegacyMaterial read() throws VaultFailure {
        LegacyMaterial firstParty = readFirstPartyV1();
        LegacyMaterial secureStorage;
        try {
            secureStorage = readSecureStorage();
        } catch (VaultFailure error) {
            if (firstParty != null) firstParty.close();
            throw error;
        }
        if (firstParty == null) return secureStorage;
        if (secureStorage == null) return firstParty;
        try {
            if (
                !VaultValidation.sameSecret(firstParty.credential, secureStorage.credential)
                || !sameBinding(firstParty.binding, secureStorage.binding)
            ) {
                throw new VaultFailure("manager_native_legacy_vault_mismatch");
            }
            secureStorage.close();
            return firstParty;
        } catch (VaultFailure error) {
            firstParty.close();
            secureStorage.close();
            throw error;
        }
    }

    @Override
    public synchronized void cleanup() throws VaultFailure {
        SharedPreferences v1 = context.getSharedPreferences(V1_PREFERENCES, Context.MODE_PRIVATE);
        // Always issue the durable clear, even when Android's in-process map
        // already appears empty. commit() may return false after updating that
        // memory map while leaving the disk image unchanged; an unconditional
        // retry is what makes the next cleanup attempt repair that ambiguity.
        if (!v1.edit().clear().commit()) {
            throw new VaultFailure("manager_native_legacy_cleanup_failed");
        }
        SharedPreferences secure = context.getSharedPreferences(SECURE_PREFERENCES, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = secure.edit();
        for (String alias : SECURE_ALIASES) editor.remove(alias);
        if (!editor.commit()) throw new VaultFailure("manager_native_legacy_cleanup_failed");

        try {
            KeyStore store = store();
            for (String alias : SECURE_ALIASES) if (store.containsAlias(alias)) store.deleteEntry(alias);
            if (store.containsAlias(V1_ALIAS)) store.deleteEntry(V1_ALIAS);
        } catch (Exception error) {
            throw new VaultFailure("manager_native_legacy_cleanup_failed", error);
        }
    }

    @Override
    public synchronized boolean isClean() throws VaultFailure {
        SharedPreferences v1 = context.getSharedPreferences(V1_PREFERENCES, Context.MODE_PRIVATE);
        SharedPreferences secure = context.getSharedPreferences(SECURE_PREFERENCES, Context.MODE_PRIVATE);
        if (!v1.getAll().isEmpty()) return false;
        for (String alias : SECURE_ALIASES) if (secure.contains(alias)) return false;
        try {
            KeyStore store = store();
            if (store.containsAlias(V1_ALIAS)) return false;
            for (String alias : SECURE_ALIASES) if (store.containsAlias(alias)) return false;
            return true;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_legacy_cleanup_failed", error);
        }
    }

    private LegacyMaterial readFirstPartyV1() throws VaultFailure {
        SharedPreferences prefs = context.getSharedPreferences(V1_PREFERENCES, Context.MODE_PRIVATE);
        String ciphertext = prefs.getString(V1_SECRET, "");
        String iv = prefs.getString(V1_IV, "");
        if (ciphertext.isEmpty() && iv.isEmpty()) {
            if (!prefs.getAll().isEmpty()) throw new VaultFailure("manager_native_legacy_vault_invalid");
            return null;
        }
        if (ciphertext.isEmpty() || iv.isEmpty() || !prefs.getString(V1_BLOCKED, "").isEmpty()) {
            throw new VaultFailure("manager_native_legacy_vault_invalid");
        }
        // Transitional V1 journals cannot be proven equivalent to the V2
        // protocol because V1 never persisted the flow or response lease. Fail
        // closed instead of silently promoting or deleting a server credential.
        if (
            !prefs.getString(V1_PENDING_OPERATION, "").isEmpty()
            || !prefs.getString(V1_PENDING_DEVICE, "").isEmpty()
            || !prefs.getString(V1_REMOVAL_OPERATION, "").isEmpty()
            || prefs.getBoolean(V1_REMOVAL_COMPLETE, false)
        ) throw new VaultFailure("manager_native_legacy_journal_requires_recovery");

        char[] credential = decrypt(V1_ALIAS, ciphertext, iv, true);
        try {
            InstallationBinding binding = null;
            if (prefs.getBoolean(V1_ACTIVE, false)) {
                String record = prefs.getString(V1_RECORD, "");
                if (record.isEmpty()) throw new VaultFailure("manager_native_legacy_vault_invalid");
                binding = parseBinding(new JSONObject(record));
            } else if (!prefs.getString(V1_RECORD, "").isEmpty()) {
                throw new VaultFailure("manager_native_legacy_vault_invalid");
            }
            return new LegacyMaterial(credential, binding, prefs.getString(V1_LEGACY_SEAL, ""));
        } catch (VaultFailure error) {
            VaultValidation.wipe(credential);
            throw error;
        } catch (Exception error) {
            VaultValidation.wipe(credential);
            throw new VaultFailure("manager_native_legacy_vault_invalid", error);
        }
    }

    private LegacyMaterial readSecureStorage() throws VaultFailure {
        String recordRaw = readSecureValue(SECURE_RECORD);
        String credentialRaw = readSecureValue(SECURE_CREDENTIAL);
        String sealRaw = readSecureValue(SECURE_SEAL);
        if (recordRaw != null) {
            LegacyMaterial recordMaterial = null;
            try {
                Object unwrapped = strictJsonValue(recordRaw);
                String json = unwrapped instanceof String ? (String) unwrapped : recordRaw;
                Object parsedRecord = strictJsonValue(json);
                if (!(parsedRecord instanceof JSONObject)) {
                    throw new VaultFailure("manager_native_legacy_vault_invalid");
                }
                JSONObject record = (JSONObject) parsedRecord;
                String clear = record.optString("credential", "").trim();
                if (clear.isEmpty()) throw new VaultFailure("manager_native_legacy_vault_invalid");
                char[] credential = clear.toCharArray();
                try {
                    recordMaterial = new LegacyMaterial(
                        credential,
                        parseBinding(record),
                        record.optString("installation_seal", "")
                    );
                } finally {
                    VaultValidation.wipe(credential);
                }
                requireMatchingSecureAliases(recordMaterial, credentialRaw, sealRaw);
                return recordMaterial;
            } catch (VaultFailure error) {
                if (recordMaterial != null) recordMaterial.close();
                throw error;
            } catch (Exception error) {
                if (recordMaterial != null) recordMaterial.close();
                throw new VaultFailure("manager_native_legacy_vault_invalid", error);
            }
        }

        if (credentialRaw == null) {
            if (sealRaw != null) throw new VaultFailure("manager_native_legacy_vault_invalid");
            return null;
        }
        String clear = unwrapString(credentialRaw).trim();
        if (clear.isEmpty()) throw new VaultFailure("manager_native_legacy_vault_invalid");
        char[] credential = clear.toCharArray();
        try {
            return new LegacyMaterial(credential, null, sealRaw == null ? "" : unwrapString(sealRaw).trim());
        } finally {
            VaultValidation.wipe(credential);
        }
    }

    private static void requireMatchingSecureAliases(
        LegacyMaterial recordMaterial,
        String credentialRaw,
        String sealRaw
    ) throws VaultFailure {
        if (credentialRaw != null) {
            char[] credential = unwrapString(credentialRaw).trim().toCharArray();
            try {
                if (!VaultValidation.sameSecret(recordMaterial.credential, credential)) {
                    throw new VaultFailure("manager_native_legacy_vault_mismatch");
                }
            } finally {
                VaultValidation.wipe(credential);
            }
        }
        if (sealRaw != null) {
            String seal = unwrapString(sealRaw).trim();
            if (recordMaterial.binding == null || !recordMaterial.binding.installationSeal.equals(seal)) {
                throw new VaultFailure("manager_native_legacy_vault_mismatch");
            }
        }
    }

    private String readSecureValue(String alias) throws VaultFailure {
        String stored = context.getSharedPreferences(SECURE_PREFERENCES, Context.MODE_PRIVATE).getString(alias, null);
        if (stored == null) return null;
        String[] parts = stored.split(Pattern.quote(String.valueOf(SECURE_SEPARATOR)), -1);
        if (parts.length != 2) throw new VaultFailure("manager_native_legacy_vault_invalid");
        char[] clear = decrypt(alias, parts[0], parts[1], false);
        try {
            return new String(clear);
        } finally {
            VaultValidation.wipe(clear);
        }
    }

    private char[] decrypt(String alias, String ciphertext, String iv, boolean aad) throws VaultFailure {
        byte[] encrypted = null;
        byte[] initializationVector = null;
        byte[] clear = null;
        try {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(alias, null);
            if (entry == null) throw new VaultFailure("manager_native_legacy_vault_invalid");
            encrypted = Base64.decode(ciphertext, Base64.NO_PADDING | Base64.NO_WRAP);
            initializationVector = Base64.decode(iv, Base64.NO_PADDING | Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, entry.getSecretKey(), new GCMParameterSpec(128, initializationVector));
            if (aad) cipher.updateAAD(alias.getBytes(StandardCharsets.UTF_8));
            clear = cipher.doFinal(encrypted);
            return new String(clear, StandardCharsets.UTF_8).toCharArray();
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_legacy_vault_invalid", error);
        } finally {
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
            if (initializationVector != null) Arrays.fill(initializationVector, (byte) 0);
            if (clear != null) Arrays.fill(clear, (byte) 0);
        }
    }

    private InstallationBinding parseBinding(JSONObject record) throws VaultFailure {
        java.util.Iterator<String> keys = record.keys();
        while (keys.hasNext()) {
            if (!RECORD_KEYS.contains(keys.next())) throw new VaultFailure("manager_native_legacy_vault_invalid");
        }
        if (record.optInt("schema_version", 0) != 1) throw new VaultFailure("manager_native_legacy_vault_invalid");
        String operation = record.optString("enrollment_operation_id", "").trim();
        boolean migrated = record.optBoolean("migrated_from_credential_only_state", false) || operation.isEmpty();
        String enrolledAt = record.optString("enrolled_at", "").trim();
        if (enrolledAt.isEmpty()) enrolledAt = VaultTimestamps.fromEpochMillis(clock.nowMillis());
        return new InstallationBinding(
            record.optString("device_id", ""),
            record.optString("installation_seal", ""),
            enrolledAt,
            migrated,
            migrated ? "" : operation
        );
    }

    private static boolean sameBinding(InstallationBinding first, InstallationBinding second) {
        return first == null ? second == null : first.sameBinding(second);
    }

    private static String unwrapString(String raw) throws VaultFailure {
        Object parsed = strictJsonValue(raw);
        return parsed instanceof String ? (String) parsed : raw;
    }

    private static Object strictJsonValue(String raw) throws VaultFailure {
        try {
            JSONTokener tokener = new JSONTokener(raw);
            Object parsed = tokener.nextValue();
            if (tokener.nextClean() != 0) throw new VaultFailure("manager_native_legacy_vault_invalid");
            return parsed;
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_legacy_vault_invalid", error);
        }
    }

    private KeyStore store() throws Exception {
        if (keyStore == null) {
            keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
        }
        return keyStore;
    }
}
