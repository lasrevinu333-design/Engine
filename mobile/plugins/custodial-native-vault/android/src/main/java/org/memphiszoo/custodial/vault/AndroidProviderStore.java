package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;

/** A separate credential-encrypted preference namespace, never enrollment/NFC storage. */
final class AndroidProviderStore {
    static final String PREFERENCES = "MemphisZooCustodialNativeProviderV1";
    private final ProviderRecordStore records;

    AndroidProviderStore(Context context) {
        this(context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE));
    }
    AndroidProviderStore(SharedPreferences preferences) {
        this(preferences, null);
    }
    /** Package-private compiled adapter test seam; production always uses the fixed provider cipher. */
    AndroidProviderStore(SharedPreferences preferences, ProviderRecordStore.Crypto testCrypto) {
        PreferencesBackend backend = new PreferencesBackend(preferences);
        ProviderRecordStore.Crypto crypto = testCrypto != null ? testCrypto
            : new AndroidProviderCipher(() -> backend.readAll().isEmpty());
        records = new ProviderRecordStore(backend, crypto, AndroidProviderCipher.STORE_LOCK);
    }
    ProviderRecordStore records() { return records; }

    private static final class PreferencesBackend implements ProviderRecordStore.Backend {
        private final SharedPreferences preferences;
        PreferencesBackend(SharedPreferences preferences) {
            if (preferences == null) throw new IllegalArgumentException("provider_preferences_required");
            this.preferences = preferences;
        }
        @Override public Map<String, ?> readAll() { return new HashMap<>(preferences.getAll()); }
        @Override public boolean replace(Map<String, String> next) {
            SharedPreferences.Editor editor = preferences.edit();
            for (String key : preferences.getAll().keySet()) if (!next.containsKey(key)) editor.remove(key);
            for (Map.Entry<String, String> entry : next.entrySet()) editor.putString(entry.getKey(), entry.getValue());
            return editor.commit(); // Never apply(), clear(), another preference file or a second transaction.
        }
    }
}
