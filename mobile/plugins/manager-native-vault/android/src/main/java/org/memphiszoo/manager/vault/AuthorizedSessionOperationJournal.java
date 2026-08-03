package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Locale;
import java.util.UUID;
import org.json.JSONObject;

/**
 * Durable, non-secret idempotency journal for native authorized-session
 * creation. A response lost after the backend commits must be retried with the
 * same operation UUID, including after Android kills and recreates the process.
 */
interface AuthorizedSessionOperationJournal {
    SessionOperationRecord acquire(String keyOperationId, String deviceId, long nowMillis) throws VaultFailure;

    void complete(String operationId) throws VaultFailure;

    void abandon(String operationId) throws VaultFailure;

    void clearKeyOperation(String keyOperationId) throws VaultFailure;

    SessionOperationRecord load() throws VaultFailure;
}

final class SessionOperationRecord {
    static final int SCHEMA_VERSION = 1;
    final String operationId;
    final String keyOperationId;
    final String deviceId;
    final long startedAtMillis;

    SessionOperationRecord(
        String operationId,
        String keyOperationId,
        String deviceId,
        long startedAtMillis
    ) throws VaultFailure {
        this.operationId = VaultValidation.operationId(operationId);
        this.keyOperationId = VaultValidation.operationId(keyOperationId);
        this.deviceId = VaultValidation.deviceId(deviceId);
        if (startedAtMillis <= 0) throw new VaultFailure("manager_v2_session_journal_corrupt");
        this.startedAtMillis = startedAtMillis;
    }

    boolean matches(String keyOperationId, String deviceId) {
        return this.keyOperationId.equals(keyOperationId) && this.deviceId.equals(deviceId);
    }

    JSONObject toJson() throws VaultFailure {
        try {
            return new JSONObject()
                .put("schema_version", SCHEMA_VERSION)
                .put("operation_id", operationId)
                .put("key_operation_id", keyOperationId)
                .put("device_id", deviceId)
                .put("started_at_millis", startedAtMillis);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_session_journal_corrupt", error);
        }
    }

    static SessionOperationRecord fromJson(String encoded) throws VaultFailure {
        try {
            JSONObject value = new JSONObject(encoded);
            if (value.length() != 5
                || value.optInt("schema_version", -1) != SCHEMA_VERSION
                || !value.has("operation_id")
                || !value.has("key_operation_id")
                || !value.has("device_id")
                || !value.has("started_at_millis")) {
                throw new VaultFailure("manager_v2_session_journal_corrupt");
            }
            return new SessionOperationRecord(
                value.getString("operation_id"),
                value.getString("key_operation_id"),
                value.getString("device_id"),
                value.getLong("started_at_millis")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_session_journal_corrupt", error);
        }
    }
}

/** One crash-atomic SharedPreferences value; it never contains a secret. */
final class SharedPreferencesAuthorizedSessionOperationJournal implements AuthorizedSessionOperationJournal {
    static final String PREFERENCES = "MemphisZooManagerNativeVaultV2AuthorizedSession";
    private static final String RECORD = "pending_authorized_session_operation_v1";
    private static final Object PROCESS_LOCK = new Object();
    private static volatile boolean processCommitUncertain;
    private final SharedPreferences preferences;

    SharedPreferencesAuthorizedSessionOperationJournal(Context context) {
        this(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE));
    }

    SharedPreferencesAuthorizedSessionOperationJournal(SharedPreferences preferences) {
        this.preferences = preferences;
    }

    @Override
    public SessionOperationRecord acquire(
        String keyOperationId,
        String deviceId,
        long nowMillis
    ) throws VaultFailure {
        String keyOperation = VaultValidation.operationId(keyOperationId);
        String device = VaultValidation.deviceId(deviceId);
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            SessionOperationRecord current = loadLocked();
            if (current != null && current.matches(keyOperation, device)) return current;
            SessionOperationRecord next = new SessionOperationRecord(
                UUID.randomUUID().toString().toLowerCase(Locale.ROOT),
                keyOperation,
                device,
                nowMillis
            );
            writeLocked(next);
            return next;
        }
    }

    @Override
    public void complete(String operationId) throws VaultFailure {
        removeExact(operationId, "manager_v2_session_journal_conflict");
    }

    @Override
    public void abandon(String operationId) throws VaultFailure {
        removeExact(operationId, "manager_v2_session_journal_conflict");
    }

    @Override
    public void clearKeyOperation(String keyOperationId) throws VaultFailure {
        String keyOperation = VaultValidation.operationId(keyOperationId);
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            SessionOperationRecord current = loadLocked();
            if (current != null && current.keyOperationId.equals(keyOperation)) removeLocked();
        }
    }

    @Override
    public SessionOperationRecord load() throws VaultFailure {
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            return loadLocked();
        }
    }

    private void removeExact(String operationId, String conflictCode) throws VaultFailure {
        String operation = VaultValidation.operationId(operationId);
        synchronized (PROCESS_LOCK) {
            requireCertainProcessState();
            SessionOperationRecord current = loadLocked();
            if (current == null) return;
            if (!current.operationId.equals(operation)) throw new VaultFailure(conflictCode);
            removeLocked();
        }
    }

    private void writeLocked(SessionOperationRecord next) throws VaultFailure {
        String encoded = next.toJson().toString();
        if (!preferences.edit().putString(RECORD, encoded).commit()) {
            poisonProcessState();
        }
        SessionOperationRecord restored = loadLocked();
        if (restored == null || !encoded.equals(restored.toJson().toString())) {
            poisonProcessState();
        }
    }

    private void removeLocked() throws VaultFailure {
        if (!preferences.edit().remove(RECORD).commit()) poisonProcessState();
        if (preferences.contains(RECORD)) poisonProcessState();
    }

    private static void requireCertainProcessState() throws VaultFailure {
        if (processCommitUncertain) {
            throw new VaultFailure("manager_v2_session_journal_persistence_uncertain");
        }
    }

    private static void poisonProcessState() throws VaultFailure {
        processCommitUncertain = true;
        throw new VaultFailure("manager_v2_session_journal_persistence_uncertain");
    }

    /** Test-only process-death seam; production WebView callers cannot reach package-private Java. */
    static void resetProcessPoisonForTests() {
        synchronized (PROCESS_LOCK) {
            processCommitUncertain = false;
        }
    }

    private SessionOperationRecord loadLocked() throws VaultFailure {
        String encoded = preferences.getString(RECORD, "");
        return encoded == null || encoded.isEmpty() ? null : SessionOperationRecord.fromJson(encoded);
    }
}
