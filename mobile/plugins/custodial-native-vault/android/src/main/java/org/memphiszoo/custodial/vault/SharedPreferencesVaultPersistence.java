package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.Map;

/**
 * Android persistence adapter.  The entire authoritative state is one encoded
 * value, so a process can never observe a credential without its matching
 * phase, operation, device, and installation binding.
 */
final class SharedPreferencesVaultPersistence implements VaultPersistence {
    private static final Object COMMIT_LOCK = new Object();
    private static final String PREFERENCES = "MemphisZooCustodialNativeVaultV2";
    private static final String SNAPSHOT = "authoritative_snapshot";
    private static final String DURABILITY_UNCONFIRMED = "custodial_native_vault_durability_unconfirmed";
    private static final Map<SharedPreferences, PendingCommit> UNCERTAIN = new IdentityHashMap<>();

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
            return loadLocked();
        }
    }

    @Override
    public void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            byte[] encoded = codec.encode(next);
            try {
                String value = Base64.encodeToString(encoded, Base64.NO_WRAP);
                PendingCommit pending = UNCERTAIN.get(preferences);
                if (pending != null) {
                    if (pending.expectedRevision != expectedRevision || !pending.encodedValue.equals(value)) {
                        throw new VaultFailure(DURABILITY_UNCONFIRMED);
                    }
                    commitAndVerifyLocked(value, encoded, next);
                    UNCERTAIN.remove(preferences);
                    return;
                }
                VaultSnapshot current = loadLocked();
                if (current.revision != expectedRevision || next.revision != expectedRevision + 1) {
                    throw new VaultFailure("custodial_native_vault_concurrent_change");
                }
                UNCERTAIN.put(preferences, new PendingCommit(expectedRevision, value));
                commitAndVerifyLocked(value, encoded, next);
                UNCERTAIN.remove(preferences);
            } finally {
                Arrays.fill(encoded, (byte) 0);
            }
        }
    }

    private void commitAndVerifyLocked(String value, byte[] encoded, VaultSnapshot next) throws VaultFailure {
        if (!preferences.edit().putString(SNAPSHOT, value).commit()) {
            throw new VaultFailure("custodial_native_vault_commit_failed");
        }
        String stored = preferences.getString(SNAPSHOT, null);
        if (stored == null || !stored.equals(value)) {
            throw new VaultFailure("custodial_native_vault_readback_failed");
        }
        byte[] readback = null;
        try {
            readback = Base64.decode(stored, Base64.NO_WRAP);
            if (!Arrays.equals(encoded, readback) || !codec.decode(readback).equals(next)) {
                throw new VaultFailure("custodial_native_vault_readback_failed");
            }
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_vault_readback_failed", error);
        } finally {
            if (readback != null) Arrays.fill(readback, (byte) 0);
        }
    }

    private VaultSnapshot loadLocked() throws VaultFailure {
        if (UNCERTAIN.containsKey(preferences)) throw new VaultFailure(DURABILITY_UNCONFIRMED);
        String stored = preferences.getString(SNAPSHOT, null);
        if (stored == null) return VaultSnapshot.empty();
        if (stored.trim().isEmpty() || stored.length() > 100_000) {
            throw new VaultFailure("custodial_native_vault_corrupt");
        }
        byte[] encoded;
        try {
            encoded = Base64.decode(stored, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_vault_corrupt", error);
        }
        try {
            return codec.decode(encoded);
        } finally {
            Arrays.fill(encoded, (byte) 0);
        }
    }

    private static final class PendingCommit {
        final long expectedRevision;
        final String encodedValue;
        PendingCommit(long expectedRevision, String encodedValue) {
            this.expectedRevision = expectedRevision;
            this.encodedValue = encodedValue;
        }
    }
}
