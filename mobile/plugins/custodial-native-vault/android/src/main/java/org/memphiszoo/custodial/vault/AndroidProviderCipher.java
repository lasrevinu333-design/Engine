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

    AndroidProviderCipher(ProviderEnvelopeCrypto.Namespace namespace) {
        crypto = new ProviderEnvelopeCrypto(new ProviderKeys(), namespace, STORE_LOCK);
    }
    @Override public void initialize() throws VaultFailure { crypto.initialize(); }
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
