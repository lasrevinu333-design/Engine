package org.memphiszoo.manager.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import android.security.keystore.KeyProperties;
import org.junit.Test;

public final class ManagerKeySecurityPolicyTest {
    @Test
    public void admitsOnlyNonExportableHardwareSecurityLevels() throws Exception {
        assertEquals("trusted_environment", ManagerKeySecurityPolicy.requireHardware(
            KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT, true, null
        ));
        assertEquals("strongbox", ManagerKeySecurityPolicy.requireHardware(
            KeyProperties.SECURITY_LEVEL_STRONGBOX, true, null
        ));
        assertThrows(VaultFailure.class, () -> ManagerKeySecurityPolicy.requireHardware(
            KeyProperties.SECURITY_LEVEL_SOFTWARE, false, null
        ));
        assertThrows(VaultFailure.class, () -> ManagerKeySecurityPolicy.requireHardware(
            KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT, true, new byte[] {1}
        ));
    }
}
