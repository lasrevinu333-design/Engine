package org.memphiszoo.manager.vault;

import java.util.Objects;
import org.json.JSONObject;

enum ManagerV2KeyPhase {
    PRECOMMITTED,
    SIGNING_READY,
    READY,
    BLOCKED
}

final class ManagerV2OperationRecord {
    static final int SCHEMA_VERSION = 1;
    final long revision;
    final String operationId;
    final ManagerV2KeyPhase phase;
    final String signingKeyId;
    final String wrappingKeyId;
    final long createdAtMillis;
    final String blockedReason;

    ManagerV2OperationRecord(
        long revision,
        String operationId,
        ManagerV2KeyPhase phase,
        String signingKeyId,
        String wrappingKeyId,
        long createdAtMillis,
        String blockedReason
    ) throws VaultFailure {
        if (revision < 0 || createdAtMillis < 1 || phase == null) throw new VaultFailure("manager_v2_operation_state_corrupt");
        this.revision = revision;
        this.operationId = ManagerV2WireContract.operationId(operationId);
        this.phase = phase;
        this.signingKeyId = normalizeKeyId(signingKeyId);
        this.wrappingKeyId = normalizeKeyId(wrappingKeyId);
        this.createdAtMillis = createdAtMillis;
        this.blockedReason = blockedReason == null ? "" : blockedReason.trim();
        if (this.blockedReason.length() > 96 || (!this.blockedReason.isEmpty() && !this.blockedReason.matches("^[a-z][a-z0-9_:-]{0,95}$"))) {
            throw new VaultFailure("manager_v2_operation_state_corrupt");
        }
        if (phase == ManagerV2KeyPhase.PRECOMMITTED && (!this.signingKeyId.isEmpty() || !this.wrappingKeyId.isEmpty())) {
            throw new VaultFailure("manager_v2_operation_state_corrupt");
        }
        if (phase == ManagerV2KeyPhase.SIGNING_READY && (this.signingKeyId.isEmpty() || !this.wrappingKeyId.isEmpty())) {
            throw new VaultFailure("manager_v2_operation_state_corrupt");
        }
        if (phase == ManagerV2KeyPhase.READY
            && (this.signingKeyId.isEmpty() || this.wrappingKeyId.isEmpty() || this.signingKeyId.equals(this.wrappingKeyId))) {
            throw new VaultFailure("manager_v2_operation_state_corrupt");
        }
        if (phase == ManagerV2KeyPhase.BLOCKED && this.blockedReason.isEmpty()) {
            throw new VaultFailure("manager_v2_operation_state_corrupt");
        }
    }

    static ManagerV2OperationRecord precommitted(String operationId, long createdAtMillis) throws VaultFailure {
        return new ManagerV2OperationRecord(1, operationId, ManagerV2KeyPhase.PRECOMMITTED, "", "", createdAtMillis, "");
    }

    ManagerV2OperationRecord signingReady(String keyId) throws VaultFailure {
        return new ManagerV2OperationRecord(revision + 1, operationId, ManagerV2KeyPhase.SIGNING_READY, keyId, "", createdAtMillis, "");
    }

    ManagerV2OperationRecord ready(String keyId) throws VaultFailure {
        return new ManagerV2OperationRecord(revision + 1, operationId, ManagerV2KeyPhase.READY, signingKeyId, keyId, createdAtMillis, "");
    }

    ManagerV2OperationRecord blocked(String reason) throws VaultFailure {
        return new ManagerV2OperationRecord(revision + 1, operationId, ManagerV2KeyPhase.BLOCKED, signingKeyId, wrappingKeyId, createdAtMillis, reason);
    }

    JSONObject toJson() throws VaultFailure {
        try {
            return new JSONObject()
                .put("schema_version", SCHEMA_VERSION)
                .put("revision", revision)
                .put("operation_id", operationId)
                .put("phase", phase.name())
                .put("signing_key_id", signingKeyId)
                .put("wrapping_key_id", wrappingKeyId)
                .put("created_at_millis", createdAtMillis)
                .put("blocked_reason", blockedReason);
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_operation_state_corrupt", error);
        }
    }

    static ManagerV2OperationRecord fromJson(String encoded) throws VaultFailure {
        try {
            JSONObject value = new JSONObject(encoded);
            if (value.length() != 8 || value.getInt("schema_version") != SCHEMA_VERSION) {
                throw new VaultFailure("manager_v2_operation_state_corrupt");
            }
            for (String key : new String[] {
                "schema_version", "revision", "operation_id", "phase", "signing_key_id",
                "wrapping_key_id", "created_at_millis", "blocked_reason"
            }) if (!value.has(key)) throw new VaultFailure("manager_v2_operation_state_corrupt");
            return new ManagerV2OperationRecord(
                value.getLong("revision"),
                value.getString("operation_id"),
                ManagerV2KeyPhase.valueOf(value.getString("phase")),
                value.getString("signing_key_id"),
                value.getString("wrapping_key_id"),
                value.getLong("created_at_millis"),
                value.getString("blocked_reason")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_operation_state_corrupt", error);
        }
    }

    private static String normalizeKeyId(String value) throws VaultFailure {
        String clean = value == null ? "" : value.trim();
        if (clean.isEmpty()) return "";
        ManagerV2WireContract.decodeBase64url(clean, 32, "manager_v2_operation_state_corrupt");
        return clean;
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof ManagerV2OperationRecord record)) return false;
        return revision == record.revision
            && operationId.equals(record.operationId)
            && phase == record.phase
            && signingKeyId.equals(record.signingKeyId)
            && wrappingKeyId.equals(record.wrappingKeyId)
            && createdAtMillis == record.createdAtMillis
            && blockedReason.equals(record.blockedReason);
    }

    @Override
    public int hashCode() {
        return Objects.hash(revision, operationId, phase, signingKeyId, wrappingKeyId, createdAtMillis, blockedReason);
    }
}

final class ManagerV2KeyRegistry {
    static final int SCHEMA_VERSION = 2;
    final long revision;
    final ManagerV2OperationRecord active;
    final ManagerV2OperationRecord pending;
    final ManagerV2OperationRecord retiring;

    ManagerV2KeyRegistry(
        long revision,
        ManagerV2OperationRecord active,
        ManagerV2OperationRecord pending,
        ManagerV2OperationRecord retiring
    ) throws VaultFailure {
        if (revision < 0) throw new VaultFailure("manager_v2_key_registry_corrupt");
        this.revision = revision;
        this.active = active;
        this.pending = pending;
        this.retiring = retiring;
        java.util.Set<String> operations = new java.util.HashSet<>();
        for (ManagerV2OperationRecord record : new ManagerV2OperationRecord[] { active, pending, retiring }) {
            if (record != null && !operations.add(record.operationId)) throw new VaultFailure("manager_v2_key_registry_corrupt");
        }
        if (active != null && active.phase != ManagerV2KeyPhase.READY) throw new VaultFailure("manager_v2_key_registry_corrupt");
        if (retiring != null && retiring.phase != ManagerV2KeyPhase.READY) throw new VaultFailure("manager_v2_key_registry_corrupt");
    }

    static ManagerV2KeyRegistry empty() throws VaultFailure {
        return new ManagerV2KeyRegistry(0, null, null, null);
    }

    ManagerV2KeyRegistry next(
        ManagerV2OperationRecord nextActive,
        ManagerV2OperationRecord nextPending,
        ManagerV2OperationRecord nextRetiring
    ) throws VaultFailure {
        return new ManagerV2KeyRegistry(revision + 1, nextActive, nextPending, nextRetiring);
    }

    JSONObject toJson() throws VaultFailure {
        try {
            return new JSONObject()
                .put("schema_version", SCHEMA_VERSION)
                .put("revision", revision)
                .put("active", active == null ? JSONObject.NULL : active.toJson())
                .put("pending", pending == null ? JSONObject.NULL : pending.toJson())
                .put("retiring", retiring == null ? JSONObject.NULL : retiring.toJson());
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_key_registry_corrupt", error);
        }
    }

    static ManagerV2KeyRegistry fromJson(String encoded) throws VaultFailure {
        try {
            JSONObject value = new JSONObject(encoded);
            if (value.length() != 5 || value.getInt("schema_version") != SCHEMA_VERSION) {
                throw new VaultFailure("manager_v2_key_registry_corrupt");
            }
            for (String name : new String[] {"schema_version", "revision", "active", "pending", "retiring"}) {
                if (!value.has(name)) throw new VaultFailure("manager_v2_key_registry_corrupt");
            }
            return new ManagerV2KeyRegistry(
                value.getLong("revision"),
                record(value, "active"),
                record(value, "pending"),
                record(value, "retiring")
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_v2_key_registry_corrupt", error);
        }
    }

    private static ManagerV2OperationRecord record(JSONObject value, String name) throws Exception {
        Object item = value.get(name);
        return item == JSONObject.NULL ? null : ManagerV2OperationRecord.fromJson(((JSONObject) item).toString());
    }
}

interface ManagerV2OperationPersistence {
    ManagerV2KeyRegistry load() throws VaultFailure;
    void commit(long expectedRevision, ManagerV2KeyRegistry next) throws VaultFailure;
}
