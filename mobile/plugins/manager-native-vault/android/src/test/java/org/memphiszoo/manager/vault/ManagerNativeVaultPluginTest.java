package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Map;
import org.junit.Test;

public final class ManagerNativeVaultPluginTest {
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";
    private static final String OPERATION = "22222222-2222-4222-8222-222222222222";

    @Test
    public void capacitorStatusProjectionNeverReturnsVaultCapabilities() throws Exception {
        Map<String, Object> projected = new ManagerNativeVaultPlugin().safeStatus(Map.<String, Object>ofEntries(
            Map.entry("schema_version", 2),
            Map.entry("state", "ACTIVE"),
            Map.entry("revision", 14),
            Map.entry("active", true),
            Map.entry("blocked", false),
            Map.entry("reason", ""),
            Map.entry("credential_present", true),
            Map.entry("legacy_seal", "do-not-expose-legacy-seal"),
            Map.entry("pending_operation_id", ""),
            Map.entry("pending_flow", ""),
            Map.entry("legacy_pending", false),
            Map.entry("removal_operation_id", ""),
            Map.entry("removal_pending", false),
            Map.entry("removal_finalized", false),
            Map.entry("installation", Map.of(
                "device_id", DEVICE,
                "installation_seal", "do-not-expose-installation-seal",
                "enrollment_operation_id", OPERATION
            )),
            Map.entry("pending_enrollment", VaultCollections.mapOf(
                "credential_id", "33333333-3333-4333-8333-333333333333"
            ))
        ));

        assertEquals(DEVICE, projected.get("device_id"));
        assertEquals("ACTIVE", projected.get("state"));
        assertTrue((Boolean) projected.get("active"));
        assertFalse(projected.containsKey("credential_present"));
        assertFalse(projected.containsKey("legacy_seal"));
        assertFalse(projected.containsKey("installation"));
        assertFalse(projected.containsKey("pending_enrollment"));
        assertFalse(projected.toString().contains("do-not-expose"));
        assertEquals("manager-device-auth.v2", projected.get("contract_version"));
        assertTrue(projected.containsKey("key_security_level"));
        assertEquals(16, projected.size());
    }

    @Test
    public void capacitorProjectionUsesOneCanonicalCrossPlatformRestartStateVocabulary() throws Exception {
        Map<String, String> expected = Map.ofEntries(
            Map.entry("ENROLLMENT_REQUESTED", "ENROLLING"),
            Map.entry("ENROLLMENT_DISPATCHED", "ENROLLING"),
            Map.entry("CREDENTIAL_STAGED", "ENROLLING"),
            Map.entry("PENDING_SERVER_CONFIRMATION", "PENDING_CONFIRMATION"),
            Map.entry("CANCEL_REQUESTED", "CANCELLING"),
            Map.entry("REMOVAL_REQUESTED", "REMOVING"),
            Map.entry("REMOVAL_TOMBSTONE", "REMOVING")
        );
        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Map<String, Object> projected = new ManagerNativeVaultPlugin().safeStatus(Map.ofEntries(
                Map.entry("state", entry.getKey()),
                Map.entry("revision", 1),
                Map.entry("active", false),
                Map.entry("blocked", false),
                Map.entry("reason", ""),
                Map.entry("pending_operation_id", entry.getValue().equals("REMOVING") ? "" : OPERATION),
                Map.entry("pending_flow", entry.getValue().equals("REMOVING") ? "" : "recovery"),
                Map.entry("removal_operation_id", entry.getValue().equals("REMOVING") ? OPERATION : ""),
                Map.entry("removal_pending", entry.getValue().equals("REMOVING"))
            ));
            assertEquals(entry.getValue(), projected.get("state"));
        }
        Map<String, Object> replacement = new ManagerNativeVaultPlugin().safeStatus(Map.ofEntries(
            Map.entry("state", "ENROLLMENT_DISPATCHED"),
            Map.entry("revision", 2),
            Map.entry("active", false),
            Map.entry("blocked", false),
            Map.entry("reason", ""),
            Map.entry("pending_operation_id", OPERATION),
            Map.entry("pending_flow", "replacement"),
            Map.entry("removal_operation_id", ""),
            Map.entry("removal_pending", false)
        ));
        assertEquals("replace", replacement.get("pending_flow"));
    }

    @Test
    public void legacyOnlyStatesRequireExplicitReplacementRatherThanUnauthenticatedRecovery() throws Exception {
        Map<String, Object> legacyPending = new ManagerNativeVaultPlugin().safeStatus(Map.ofEntries(
            Map.entry("state", "LEGACY_PENDING"),
            Map.entry("revision", 3),
            Map.entry("active", false),
            Map.entry("blocked", false),
            Map.entry("reason", ""),
            Map.entry("pending_operation_id", ""),
            Map.entry("pending_device_id", DEVICE),
            Map.entry("pending_flow", ""),
            Map.entry("removal_operation_id", ""),
            Map.entry("removal_pending", false)
        ));
        assertEquals("LEGACY_PENDING", legacyPending.get("state"));
        assertEquals("manager_native_replacement_required", legacyPending.get("reason"));

        Map<String, Object> legacyBlocked = new ManagerNativeVaultPlugin().safeStatus(Map.ofEntries(
            Map.entry("state", "BLOCKED"),
            Map.entry("revision", 4),
            Map.entry("active", false),
            Map.entry("blocked", true),
            Map.entry("reason", "legacy_vault_mismatch"),
            Map.entry("pending_operation_id", ""),
            Map.entry("pending_flow", ""),
            Map.entry("removal_operation_id", ""),
            Map.entry("removal_pending", false)
        ));
        assertEquals("manager_native_replacement_required", legacyBlocked.get("reason"));
    }

    @Test
    public void replacementRequiredReasonIsLimitedToLocalAuthorityFailures() {
        for (String code : new String[] {
            "manager_v2_active_keyset_missing",
            "manager_v2_operation_key_missing",
            "manager_v2_keystore_unavailable",
            "manager_native_vault_key_missing",
            "manager_native_vault_decrypt_failed",
            "native_security_capability_required"
        }) assertTrue(ManagerNativeVaultPlugin.replacementRequiredFor(code));
        for (String code : new String[] {
            "manager_native_network_unavailable",
            "manager_v2_session_failed",
            "manager_play_integrity_configuration_required",
            "manager_v2_key_registry_corrupt",
            "manager_native_vault_corrupt"
        }) assertFalse(ManagerNativeVaultPlugin.replacementRequiredFor(code));
    }
}
