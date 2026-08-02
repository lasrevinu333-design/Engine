package org.memphiszoo.manager.vault;

import android.util.Base64;
import java.security.SecureRandom;
import java.util.Arrays;

final class SecureInstallationSealGenerator implements InstallationSealGenerator {
    private final SecureRandom random = new SecureRandom();

    @Override
    public synchronized String newSeal() throws VaultFailure {
        byte[] bytes = new byte[32];
        try {
            random.nextBytes(bytes);
            return VaultValidation.bindingSeal(Base64.encodeToString(
                bytes,
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
            ));
        } catch (Exception error) {
            throw new VaultFailure("manager_native_binding_generation_failed", error);
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }
}
