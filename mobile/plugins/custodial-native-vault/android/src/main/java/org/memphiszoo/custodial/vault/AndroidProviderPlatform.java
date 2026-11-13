package org.memphiszoo.custodial.vault;

import android.os.Build;

/** Exact native platform identity only; this does not provide an oscillator
 * guarantee, select a profile or turn Android documentation into qualification. */
final class AndroidProviderPlatform {
    static NativeProviderTime.Platform read() throws VaultFailure {
        return new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-"+Build.VERSION.SDK_INT,
            required(Build.FINGERPRINT),required(Build.MANUFACTURER)+"/"+required(Build.MODEL)+"/"+required(Build.DEVICE)+"/"+required(Build.HARDWARE));
    }
    private static String required(String value) throws VaultFailure {
        if(value==null||value.isEmpty()||"unknown".equals(value))throw new VaultFailure("custodial_provider_platform_unavailable");return value;
    }
    private AndroidProviderPlatform() {}
}
