package org.memphiszoo.custodial.vault;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Fixed app-lifetime provider key; deliberately NOT a CredentialCipher. */
final class AndroidProviderCipher implements ProviderRecordStore.Crypto {
    static final String KEY_ALIAS = "org.memphiszoo.custodial.native-provider.v1";
    static final Object STORE_LOCK = new Object();
    private final ProviderEnvelopeCrypto crypto;
    private boolean creationRefused;

    AndroidProviderCipher(ProviderEnvelopeCrypto.Namespace namespace, AndroidProtectedWorkPreferences work) {
        this(new ProviderKeys(), namespace, work);
    }
    /** Existing synthetic Keys port only; production always supplies the
     * fixed private alias and the SAME provider namespace/WORK owner. */
    AndroidProviderCipher(ProviderEnvelopeCrypto.Keys keys, ProviderEnvelopeCrypto.Namespace namespace,
        AndroidProtectedWorkPreferences work) {
        if (keys == null || namespace == null || work == null)
            throw new IllegalArgumentException("provider_key_work_dependencies_required");
        ProviderEnvelopeCrypto.Keys guarded = new ProviderEnvelopeCrypto.Keys() {
            @Override public SecretKey existing() throws Exception { return keys.existing(); }
            @Override public SecretKey createInEmptyNamespace() throws Exception {
                if (creationRefused) throw new VaultFailure("custodial_provider_key_unavailable_preserved");
                try {
                    return work.withOrdinaryWriteAdmission(() -> {
                        try {
                            // Recheck INSIDE the actual retained epoch lock.
                            // A concurrently supplied key is never replaced.
                            SecretKey prior = keys.existing();
                            if (prior != null) return prior;
                            if (!namespace.isEmpty()) throw new VaultFailure("custodial_provider_key_missing_preserved");
                            SecretKey created = keys.createInEmptyNamespace();
                            SecretKey readback = keys.existing();
                            if (created == null || readback == null)
                                throw new VaultFailure("custodial_provider_key_creation_failed");
                            return readback;
                        } catch (VaultFailure failure) { throw failure; }
                        catch (Exception failure) {
                            throw new VaultFailure("custodial_provider_key_unavailable_preserved", failure);
                        }
                    });
                } catch (VaultFailure | RuntimeException | Error failure) {
                    // Never regenerate/replay this uncertain creation attempt.
                    // The actual epoch owner retains its durable UNKNOWN.
                    creationRefused = true;
                    throw failure;
                }
            }
        };
        crypto = new ProviderEnvelopeCrypto(guarded, namespace, STORE_LOCK);
    }
    @Override public void initialize() throws VaultFailure {
        synchronized (STORE_LOCK) {
            if (creationRefused) throw new VaultFailure("custodial_provider_key_unavailable_preserved");
            crypto.initialize();
        }
    }
    @Override public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain, String recordId, char[] value) throws VaultFailure {
        return crypto.encrypt(domain, recordId, value);
    }
    @Override public char[] decrypt(ProviderEnvelopeCrypto.Domain domain, String recordId, ProviderEnvelopeCrypto.Envelope value) throws VaultFailure {
        return crypto.decrypt(domain, recordId, value);
    }

    private static final class ProviderKeys implements ProviderEnvelopeCrypto.Keys {
        private KeyStore store;
        private KeyStore store() throws Exception {
            if (store == null) { store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); }
            return store;
        }
        @Override public SecretKey existing() throws Exception {
            KeyStore.Entry entry = store().getEntry(KEY_ALIAS, null);
            if (entry == null) return null;
            if (!(entry instanceof KeyStore.SecretKeyEntry)) throw new VaultFailure("custodial_provider_key_type_invalid_preserved");
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        @Override public SecretKey createInEmptyNamespace() throws Exception {
            SecretKey prior = existing();
            if (prior != null) return prior;
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());
            return generator.generateKey();
        }
    }
    // No key deletion/rotation/export, enrollment fallback, or caller alias.
}
