package org.memphiszoo.manager.vault;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

final class PlayIntegrityConfiguration {
    static final String CLOUD_PROJECT_METADATA = "org.memphiszoo.manager.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER";
    static final String CLOUD_PROJECT_METADATA_PREFIX = "play-integrity-cloud-project:";
    final long cloudProjectNumber;

    PlayIntegrityConfiguration(long cloudProjectNumber) throws VaultFailure {
        if (cloudProjectNumber < 1) throw new VaultFailure("manager_play_integrity_configuration_required");
        this.cloudProjectNumber = cloudProjectNumber;
    }

    static PlayIntegrityConfiguration fromApplication(Context context) throws VaultFailure {
        try {
            ApplicationInfo info = context.getPackageManager().getApplicationInfo(
                context.getPackageName(), PackageManager.GET_META_DATA
            );
            Object encoded = info.metaData == null ? null : info.metaData.get(CLOUD_PROJECT_METADATA);
            return fromMetadataValue(encoded);
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_play_integrity_configuration_required", error);
        }
    }

    static PlayIntegrityConfiguration fromMetadataValue(Object encoded) throws VaultFailure {
        if (!(encoded instanceof String value)
            || !value.matches("^" + CLOUD_PROJECT_METADATA_PREFIX + "[1-9][0-9]{5,18}$")) {
            throw new VaultFailure("manager_play_integrity_configuration_required");
        }
        try {
            return new PlayIntegrityConfiguration(Long.parseLong(
                value.substring(CLOUD_PROJECT_METADATA_PREFIX.length())
            ));
        } catch (NumberFormatException error) {
            throw new VaultFailure("manager_play_integrity_configuration_required", error);
        }
    }

    static String challenge(String value) throws VaultFailure {
        String clean = value == null ? "" : value;
        ManagerV2WireContract.decodeBase64url(clean, 32, "manager_play_integrity_challenge_refused");
        return clean;
    }
}
