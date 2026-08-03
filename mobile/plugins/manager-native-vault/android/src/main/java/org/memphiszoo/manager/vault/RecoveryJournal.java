package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

final class RecoveryRecord {
    final String pendingOperationId;
    final VaultSnapshot priorActive;

    RecoveryRecord(String pendingOperationId, VaultSnapshot priorActive) throws VaultFailure {
        this.pendingOperationId = VaultValidation.operationId(pendingOperationId);
        if (priorActive == null || priorActive.phase != VaultPhase.ACTIVE || !priorActive.hasCredential()
            || priorActive.operationId.isEmpty() || priorActive.operationId.equals(this.pendingOperationId)) {
            throw new VaultFailure("manager_native_recovery_journal_corrupt");
        }
        this.priorActive = priorActive;
    }
}

interface RecoveryJournal {
    RecoveryRecord load() throws VaultFailure;
    void save(RecoveryRecord record) throws VaultFailure;
    void clear(String pendingOperationId) throws VaultFailure;
}

final class NoopRecoveryJournal implements RecoveryJournal {
    public RecoveryRecord load() { return null; }
    public void save(RecoveryRecord record) throws VaultFailure { throw new VaultFailure("manager_native_recovery_journal_required"); }
    public void clear(String pendingOperationId) {}
}

final class SharedPreferencesRecoveryJournal implements RecoveryJournal {
    static final String PREFERENCES = "MemphisZooManagerNativeVaultV2Recovery";
    private static final String RECORD = "recovery_record";
    private static final Object LOCK = new Object();
    private static volatile boolean processCommitUncertain;
    private final SharedPreferences preferences;
    private final VaultSnapshotCodec codec;

    SharedPreferencesRecoveryJournal(Context context, VaultSnapshotCodec codec) {
        this(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE), codec);
    }

    SharedPreferencesRecoveryJournal(SharedPreferences preferences, VaultSnapshotCodec codec) {
        this.preferences = preferences;
        this.codec = codec;
    }

    @Override
    public RecoveryRecord load() throws VaultFailure {
        synchronized (LOCK) {
            requireCertainProcessState();
            return loadLocked();
        }
    }

    @Override
    public void save(RecoveryRecord record) throws VaultFailure {
        synchronized (LOCK) {
            requireCertainProcessState();
            RecoveryRecord current = loadLocked();
            if (current != null) {
                if (current.pendingOperationId.equals(record.pendingOperationId)
                    && current.priorActive.equals(record.priorActive)) return;
                throw new VaultFailure("manager_native_recovery_operation_conflict");
            }
            byte[] snapshot = codec.encode(record.priorActive);
            try {
                String encoded = new JSONObject()
                    .put("schema_version", 1)
                    .put("pending_operation_id", record.pendingOperationId)
                    .put("prior_active", Base64.encodeToString(snapshot, Base64.NO_WRAP))
                    .toString();
                if (!preferences.edit().putString(RECORD, encoded).commit()) {
                    poisonProcessState();
                }
                RecoveryRecord restored = loadLocked();
                if (restored == null || !restored.pendingOperationId.equals(record.pendingOperationId)
                    || !restored.priorActive.equals(record.priorActive)) {
                    poisonProcessState();
                }
            } catch (VaultFailure error) {
                throw error;
            } catch (Exception error) {
                throw new VaultFailure("manager_native_recovery_journal_commit_failed", error);
            } finally {
                Arrays.fill(snapshot, (byte) 0);
            }
        }
    }

    @Override
    public void clear(String pendingOperationId) throws VaultFailure {
        synchronized (LOCK) {
            requireCertainProcessState();
            RecoveryRecord current = loadLocked();
            if (current == null) return;
            if (!current.pendingOperationId.equals(VaultValidation.operationId(pendingOperationId))) {
                throw new VaultFailure("manager_native_recovery_operation_conflict");
            }
            if (!preferences.edit().remove(RECORD).commit()) poisonProcessState();
            if (loadLocked() != null) poisonProcessState();
        }
    }

    private static void requireCertainProcessState() throws VaultFailure {
        if (processCommitUncertain) {
            throw new VaultFailure("manager_native_recovery_journal_persistence_uncertain");
        }
    }

    private static void poisonProcessState() throws VaultFailure {
        processCommitUncertain = true;
        throw new VaultFailure("manager_native_recovery_journal_persistence_uncertain");
    }

    /** Test-only process-death seam; production WebView callers cannot reach package-private Java. */
    static void resetProcessPoisonForTests() {
        synchronized (LOCK) {
            processCommitUncertain = false;
        }
    }

    private RecoveryRecord loadLocked() throws VaultFailure {
        String encoded = preferences.getString(RECORD, "");
        if (encoded == null || encoded.isEmpty()) return null;
        try {
            JSONObject value = new JSONObject(encoded);
            if (value.length() != 3 || value.getInt("schema_version") != 1
                || !value.has("pending_operation_id") || !value.has("prior_active")) {
                throw new VaultFailure("manager_native_recovery_journal_corrupt");
            }
            byte[] snapshot = Base64.decode(value.getString("prior_active"), Base64.NO_WRAP);
            try {
                return new RecoveryRecord(value.getString("pending_operation_id"), codec.decode(snapshot));
            } finally {
                Arrays.fill(snapshot, (byte) 0);
            }
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_recovery_journal_corrupt", error);
        }
    }
}
