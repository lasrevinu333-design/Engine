package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;

/** A separate credential-encrypted preference namespace, never enrollment/NFC storage. */
final class AndroidProviderStore {
    static final String PREFERENCES = "MemphisZooCustodialNativeProviderV1";
    private final ProviderRecordStore records;

    /** Read-only namespace presence check: never creates/replaces a key or index.
     * Runtime owns engine -> coordinator before deciding to open local recovery. */
    static boolean hasRetainedState(Context context) {
        synchronized (AndroidProviderCipher.STORE_LOCK) {
            return !context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getAll().isEmpty();
        }
    }

    AndroidProviderStore(Context context) {
        this(context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE),
            AndroidOfflineAuthorityTimeStore.bindOrdinaryAdmission(context), null);
    }
    /** Package-private compiled adapter test seam; production always uses the fixed provider cipher. */
    AndroidProviderStore(SharedPreferences preferences, AndroidProtectedWorkPreferences work,
        ProviderRecordStore.Crypto testCrypto) {
        if (work == null) throw new IllegalArgumentException("provider_work_admission_required");
        PreferencesBackend backend = new PreferencesBackend(preferences, work);
        ProviderRecordStore.Crypto fixedCrypto = testCrypto != null ? testCrypto
            : new AndroidProviderCipher(() -> backend.readAll().isEmpty(), work);
        // ProviderRecordStore holds STORE_LOCK before entering the existing WORK
        // boundary. Read-only retained decrypts never initialize or create a key.
        ProviderRecordStore.Crypto crypto = new ProviderRecordStore.Crypto() {
            @Override public void initialize() throws VaultFailure {
                work.withOrdinaryWorkAdmission(() -> { fixedCrypto.initialize(); return null; });
            }
            @Override public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,
                String id, char[] value) throws VaultFailure {
                return work.withOrdinaryWorkAdmission(() -> fixedCrypto.encrypt(domain, id, value));
            }
            @Override public char[] decrypt(ProviderEnvelopeCrypto.Domain domain, String id,
                ProviderEnvelopeCrypto.Envelope value) throws VaultFailure {
                return fixedCrypto.decrypt(domain, id, value);
            }
        };
        records = new ProviderRecordStore(backend, crypto, AndroidProviderCipher.STORE_LOCK);
    }
    ProviderRecordStore records() { return records; }

    private static final class PreferencesBackend implements ProviderRecordStore.Backend {
        private final SharedPreferences preferences;
        private final AndroidProtectedWorkPreferences work;
        PreferencesBackend(SharedPreferences preferences, AndroidProtectedWorkPreferences work) {
            if (preferences == null) throw new IllegalArgumentException("provider_preferences_required");
            this.preferences = preferences;
            this.work = work;
        }
        @Override public Map<String, ?> readAll() { return new HashMap<>(preferences.getAll()); }
        @Override public Object retainedSourceIdentity() { return preferences; }
        @Override public boolean replace(Map<String, String> next) throws VaultFailure {
            // Check and synchronous replacement share the WORK probe/freeze
            // lock. A check followed by an unlocked commit would admit a race.
            // A failed commit may still change Android's in-memory map. The
            // shared attempted-write epoch must invalidate prior observations
            // before any editor effect, including an A -> B -> A sequence.
            return work.withOrdinaryWriteAdmission(() -> {
                SharedPreferences.Editor editor = preferences.edit();
                for (String key : preferences.getAll().keySet()) if (!next.containsKey(key)) editor.remove(key);
                for (Map.Entry<String, String> entry : next.entrySet()) editor.putString(entry.getKey(), entry.getValue());
                return editor.commit(); // Never apply(), clear() or a second transaction.
            });
        }
    }
}
