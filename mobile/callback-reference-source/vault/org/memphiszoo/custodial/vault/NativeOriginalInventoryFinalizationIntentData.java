package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

/** Archived finalization DATA only. Authentication of the actual GCM file,
 * original root/HELD owner and current/terminal namespaces remains external.
 * Parsing never mints a control, retries a write, or grants any effect. */
final class NativeOriginalInventoryFinalizationIntentData implements AutoCloseable {
    static final String FAILURE = "custodial_native_original_inventory_finalization_restore_data_invalid";
    static final int MAX_DOCUMENT = 600000;
    private static final int MAX_SNAPSHOT = 64 * 1024;
    final String operationId, planSha256, originalGenerationId, valuesSha256;
    final String nativeFrameSha256, browserFrameSha256, browserPartSetSha256, deviceId, credentialId, employeeId, separationId, principalDigest;
    final long originalRevision, terminalRevision;
    private VaultSnapshot original, terminal;

    private NativeOriginalInventoryFinalizationIntentData(JSONObject target, JSONObject fixed,
        VaultSnapshot original, VaultSnapshot terminal) throws Exception {
        operationId = text(target, "operation_id");planSha256 = text(target, "plan_sha256");
        originalGenerationId = text(target, "original_generation_id");valuesSha256 = text(target, "values_sha256");
        nativeFrameSha256 = text(target, "frame_sha256");
        browserFrameSha256 = text(fixed, "original_browser_frame_sha256");
        browserPartSetSha256 = text(fixed, "original_browser_part_set_sha256");
        deviceId = text(target, "canonical_device_id");credentialId = text(target, "credential_id");
        employeeId = text(target, "employee_id");separationId = text(target, "separation_id");
        principalDigest = text(target, "principal_digest");
        originalRevision = original.revision;terminalRevision = terminal.revision;
        this.original = original;this.terminal = terminal;
    }

    static NativeOriginalInventoryFinalizationIntentData decode(byte[] originalUtf8) throws VaultFailure {
        if (originalUtf8 == null || originalUtf8.length == 0 || originalUtf8.length > MAX_DOCUMENT) throw invalid();
        byte[] owned = originalUtf8.clone(), targetBytes = null, originalBytes = null, terminalBytes = null;
        byte[] originalCanonical = null, terminalCanonical = null;
        try {
            JSONObject document = ProviderWireJson.object(owned, MAX_DOCUMENT);
            NativeRetainedAttempt.keys(document, "schema", "entry_key", "plan_sha256", "operation_id", "finalization");
            literal(document, "schema", "custodial.native-private-custody-exchange-evidence.v1");
            literal(document, "entry_key", "inventory_finalization_intent-0");
            Object value = document.get("finalization");
            if (!(value instanceof JSONObject)) throw invalid();
            JSONObject fixed = (JSONObject)value;
            NativeRetainedAttempt.keys(fixed, "schema", "state", "original_target",
                "inventory_manifest_sha256", "registration_receipt_sha256", "original_decision_disk_sha256",
                "original_decision_document_sha256", "original_decision_response_sha256",
                "original_vault_revision", "terminal_vault_revision",
                "original_vault_snapshot_sha256", "terminal_vault_snapshot_sha256",
                "original_vault_snapshot_base64", "terminal_vault_snapshot_base64",
                "original_native_values_sha256", "original_browser_frame_sha256", "original_browser_part_set_sha256",
                "keep_all_original_work", "keep_all_existing_keys", "work_accepted", "resend_allowed", "phone_released");
            literal(fixed, "schema", "custodial.original-inventory-enrollment-finalization-intent.v2");
            literal(fixed, "state", "ORIGINAL_LOCAL_ENROLLMENT_TRANSITION_OUTCOME_UNKNOWN");
            for (String key : new String[]{"keep_all_original_work", "keep_all_existing_keys"})
                if (!Boolean.TRUE.equals(fixed.get(key))) throw invalid();
            for (String key : new String[]{"work_accepted", "resend_allowed", "phone_released"})
                if (!Boolean.FALSE.equals(fixed.get(key))) throw invalid();
            for (String key : new String[]{"inventory_manifest_sha256", "registration_receipt_sha256",
                "original_decision_disk_sha256", "original_decision_document_sha256", "original_decision_response_sha256",
                "original_vault_snapshot_sha256", "terminal_vault_snapshot_sha256", "original_native_values_sha256",
                "original_browser_frame_sha256", "original_browser_part_set_sha256"}) sha(fixed, key);
            sha(document, "plan_sha256");
            Object targetValue = fixed.get("original_target");
            if (!(targetValue instanceof JSONObject)) throw invalid();
            // Strict parse already rejected duplicate/trailing/UTF8 errors.
            // This serialization is ONLY input to the existing closed target
            // DATA parser, never a signed/raw-command digest substitute.
            targetBytes = targetValue.toString().getBytes(StandardCharsets.UTF_8);
            JSONObject target = NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes).json();
            if (!text(document, "operation_id").equals(text(target, "operation_id"))
                || !text(document, "plan_sha256").equals(text(target, "plan_sha256"))
                || !text(fixed, "original_native_values_sha256").equals(text(target, "values_sha256"))) throw invalid();
            long originalRevision = revision(fixed, "original_vault_revision");
            long terminalRevision = revision(fixed, "terminal_vault_revision");
            if (originalRevision == Long.MAX_VALUE || terminalRevision != originalRevision + 1
                || originalRevision != revision(target, "engine_revision")) throw invalid();
            originalBytes = NativeRetainedAttempt.base64(text(fixed, "original_vault_snapshot_base64"), MAX_SNAPSHOT);
            terminalBytes = NativeRetainedAttempt.base64(text(fixed, "terminal_vault_snapshot_base64"), MAX_SNAPSHOT);
            if (!NativeRetainedAttempt.hash(originalBytes).equals(text(fixed, "original_vault_snapshot_sha256"))
                || !NativeRetainedAttempt.hash(terminalBytes).equals(text(fixed, "terminal_vault_snapshot_sha256"))) throw invalid();
            VaultSnapshotCodec codec = new VaultSnapshotCodec();
            VaultSnapshot original = codec.decode(originalBytes), terminal = codec.decode(terminalBytes);
            originalCanonical = codec.encode(original);terminalCanonical = codec.encode(terminal);
            if (!Arrays.equals(originalBytes, originalCanonical) || !Arrays.equals(terminalBytes, terminalCanonical)
                || original.phase != VaultPhase.ACTIVE || !original.hasCredential()
                || original.revision != originalRevision || terminal.revision != terminalRevision
                || !original.deviceId.equals(text(target, "canonical_device_id"))
                || !original.metadata.credentialId.equals(text(target, "credential_id"))
                || !original.metadata.employeeId.equals(text(target, "employee_id"))) throw invalid();
            VaultSnapshot expected = original.next(VaultPhase.EMPTY, SecretKind.NONE, null, "", original.deviceId,
                "", 0, null, EnrollmentMetadata.empty(), text(target, "operation_id"), "", false, "");
            if (!expected.equals(terminal)) throw invalid();
            return new NativeOriginalInventoryFinalizationIntentData(target, fixed, original, terminal);
        } catch (Exception failure) { throw invalid(); }
        finally {
            Arrays.fill(owned, (byte)0);
            if (targetBytes != null) Arrays.fill(targetBytes, (byte)0);
            if (originalBytes != null) Arrays.fill(originalBytes, (byte)0);
            if (terminalBytes != null) Arrays.fill(terminalBytes, (byte)0);
            if (originalCanonical != null) Arrays.fill(originalCanonical, (byte)0);
            if (terminalCanonical != null) Arrays.fill(terminalCanonical, (byte)0);
        }
    }

    synchronized VaultSnapshot originalSnapshotForOwningRead() throws VaultFailure {
        if (original == null || terminal == null) throw invalid();return original;
    }
    synchronized VaultSnapshot terminalSnapshotForOwningRead() throws VaultFailure {
        if (original == null || terminal == null) throw invalid();return terminal;
    }
    @Override public synchronized void close() {
        // Immutable strings/typed DATA previously returned cannot be erased.
        original = null;terminal = null;
    }
    private static String text(JSONObject object, String key) throws Exception {
        Object value = object.get(key);if (!(value instanceof String)) throw invalid();return (String)value;
    }
    private static void literal(JSONObject object, String key, String expected) throws Exception {
        if (!expected.equals(text(object, key))) throw invalid();
    }
    private static void sha(JSONObject object, String key) throws Exception {
        if (!text(object, key).matches("[0-9a-f]{64}")) throw invalid();
    }
    private static long revision(JSONObject object, String key) throws Exception {
        String value = text(object, key);
        if (value.length() > 19 || !value.matches("0|[1-9][0-9]*")) throw invalid();
        try { return Long.parseLong(value); } catch (NumberFormatException failure) { throw invalid(); }
    }
    private static VaultFailure invalid() { return new VaultFailure(FAILURE); }
}
