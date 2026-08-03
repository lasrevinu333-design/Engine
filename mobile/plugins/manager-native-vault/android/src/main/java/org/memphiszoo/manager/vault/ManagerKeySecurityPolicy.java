package org.memphiszoo.manager.vault;

import android.security.keystore.KeyProperties;

final class ManagerKeySecurityPolicy {
    private ManagerKeySecurityPolicy() {}

    static String requireHardware(int securityLevel, boolean insideSecureHardware, byte[] encoded) throws VaultFailure {
        if (encoded != null || !insideSecureHardware) throw new VaultFailure("native_security_capability_required");
        if (securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX) return "strongbox";
        if (securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) return "trusted_environment";
        throw new VaultFailure("native_security_capability_required");
    }
}
