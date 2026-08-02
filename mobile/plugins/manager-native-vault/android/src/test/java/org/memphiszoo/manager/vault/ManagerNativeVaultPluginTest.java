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
        Map<String, Object> projected = ManagerNativeVaultPlugin.safeStatus(Map.<String, Object>ofEntries(
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
        assertEquals(13, projected.size());
    }
}
