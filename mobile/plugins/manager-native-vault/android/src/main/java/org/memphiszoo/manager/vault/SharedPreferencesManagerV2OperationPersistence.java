package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.SharedPreferences;

/** One crash-atomic registry for active, pending, and retiring P-256 keysets. */
final class SharedPreferencesManagerV2OperationPersistence implements ManagerV2OperationPersistence {
    static final String PREFERENCES = "MemphisZooManagerNativeVaultV2AsymmetricOperation";
    private static final String REGISTRY = "key_registry_v2";
    private static final Object PROCESS_LOCK = new Object();
    private static volatile boolean processCommitUncertain;
    private final SharedPreferences preferences;

    SharedPreferencesManagerV2OperationPersistence(Context context) {
        this(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE));
    }

    SharedPreferencesManagerV2OperationPersistence(SharedPreferences preferences) {
        this.preferences = preferences;
    }

    @Override
    public ManagerV2KeyRegistry load() throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            return loadLocked();
        }
    }

    @Override
    public void commit(long expectedRevision, ManagerV2KeyRegistry next) throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            ManagerV2KeyRegistry current = loadLocked();
            if (current.revision != expectedRevision || next == null || next.revision != expectedRevision + 1) {
                throw new VaultFailure("manager_v2_operation_concurrent_change");
            }
            String encoded = next.toJson().toString();
            if (!preferences.edit().putString(REGISTRY, encoded).commit()) {
                poisonProcessState();
            }
            ManagerV2KeyRegistry restored = loadLocked();
            if (!encoded.equals(restored.toJson().toString())) {
                poisonProcessState();
            }
        }
    }

    private static void requireCertainProcessState() throws VaultFailure {
        if (processCommitUncertain) {
            throw new VaultFailure("manager_v2_operation_persistence_uncertain");
        }
    }

    private static void poisonProcessState() throws VaultFailure {
        processCommitUncertain = true;
        throw new VaultFailure("manager_v2_operation_persistence_uncertain");
    }

    /** Test-only process-death seam; production WebView callers cannot reach package-private Java. */
    static void resetProcessPoisonForTests() {
        synchronized (PROCESS_LOCK) {
            processCommitUncertain = false;
        }
    }

    private ManagerV2KeyRegistry loadLocked() throws VaultFailure {
        String value = preferences.getString(REGISTRY, "");
        return value == null || value.isEmpty() ? ManagerV2KeyRegistry.empty() : ManagerV2KeyRegistry.fromJson(value);
    }
}
