package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.util.Arrays;

/**
 * Android persistence adapter.  The entire authoritative state is one encoded
 * value, so a process can never observe a credential without its matching
 * phase, operation, device, and installation binding.
 */
final class SharedPreferencesVaultPersistence implements VaultPersistence {
    private static final Object COMMIT_LOCK = new Object();
    private static final String PREFERENCES = "MemphisZooManagerNativeVaultV2";
    private static final String SNAPSHOT = "authoritative_snapshot";
    private static volatile boolean processCommitUncertain;

    private final SharedPreferences preferences;
    private final VaultSnapshotCodec codec;

    SharedPreferencesVaultPersistence(Context context, VaultSnapshotCodec codec) {
        this(
            context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE),
            codec
        );
    }

    /** Package-private fault-injection seam for compiled Android adapter tests. */
    SharedPreferencesVaultPersistence(SharedPreferences preferences, VaultSnapshotCodec codec) {
        this.preferences = preferences;
        this.codec = codec;
    }

    @Override
    public VaultSnapshot load() throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            requireCertainProcessState();
            return loadLocked();
        }
    }

    @Override
    public void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            requireCertainProcessState();
            VaultSnapshot current = loadLocked();
            if (current.revision != expectedRevision || next.revision != expectedRevision + 1) {
                throw new VaultFailure("manager_native_vault_concurrent_change");
            }
            byte[] encoded = codec.encode(next);
            try {
                String value = Base64.encodeToString(encoded, Base64.NO_WRAP);
                if (!preferences.edit().putString(SNAPSHOT, value).commit()) {
                    // Android may update SharedPreferences' in-process map even
                    // when its durable disk write returns false. Never permit a
                    // later request in this process to treat that memory image
                    // as authority. A new process must reopen the disk state.
                    processCommitUncertain = true;
                    throw new VaultFailure("manager_native_vault_commit_uncertain");
                }
                String stored = preferences.getString(SNAPSHOT, null);
                if (stored == null || !stored.equals(value)) {
                    processCommitUncertain = true;
                    throw new VaultFailure("manager_native_vault_readback_failed");
                }
                byte[] readback;
                try {
                    readback = Base64.decode(stored, Base64.NO_WRAP);
                } catch (IllegalArgumentException error) {
                    processCommitUncertain = true;
                    throw new VaultFailure("manager_native_vault_readback_failed", error);
                }
                try {
                    if (!Arrays.equals(encoded, readback) || !codec.decode(readback).equals(next)) {
                        processCommitUncertain = true;
                        throw new VaultFailure("manager_native_vault_readback_failed");
                    }
                } finally {
                    Arrays.fill(readback, (byte) 0);
                }
            } finally {
                Arrays.fill(encoded, (byte) 0);
            }
        }
    }

    private void requireCertainProcessState() throws VaultFailure {
        if (processCommitUncertain) throw new VaultFailure("manager_native_vault_persistence_uncertain");
    }

    /** Test-only process-death seam; production callers cannot reach package-private Java. */
    static void resetProcessPoisonForTests() {
        synchronized (COMMIT_LOCK) {
            processCommitUncertain = false;
        }
    }

    private VaultSnapshot loadLocked() throws VaultFailure {
        String stored = preferences.getString(SNAPSHOT, null);
        if (stored == null) return VaultSnapshot.empty();
        if (stored.trim().isEmpty() || stored.length() > 100_000) {
            throw new VaultFailure("manager_native_vault_corrupt");
        }
        byte[] encoded;
        try {
            encoded = Base64.decode(stored, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("manager_native_vault_corrupt", error);
        }
        try {
            return codec.decode(encoded);
        } finally {
            Arrays.fill(encoded, (byte) 0);
        }
    }
}
