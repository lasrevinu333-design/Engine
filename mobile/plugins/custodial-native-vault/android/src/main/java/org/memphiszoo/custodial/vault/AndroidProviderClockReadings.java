package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.SystemClock;
import android.provider.Settings;

/** Platform observations, NOT a calibrated/qualified time authority. Missing boot
 * identity fails closed; wall clock, NFC anchors and JS values are not fallbacks. */
final class AndroidProviderClockReadings implements NativeProviderClockExchange.Readings {
    private final Context application;
    AndroidProviderClockReadings(Context context) {
        if (context == null || context.getApplicationContext() == null) throw new IllegalArgumentException("provider_application_context_required");
        application = context.getApplicationContext();
    }
    @Override public NativeProviderClockExchange.Point read() throws VaultFailure {
        try {
            int before = Settings.Global.getInt(application.getContentResolver(), Settings.Global.BOOT_COUNT);
            long elapsed = SystemClock.elapsedRealtime();
            int after = Settings.Global.getInt(application.getContentResolver(), Settings.Global.BOOT_COUNT);
            if (before != after) throw new VaultFailure("custodial_provider_clock_context_invalid");
            return new NativeProviderClockExchange.Point(elapsed, after);
        } catch (Exception error) { throw new VaultFailure("custodial_provider_clock_context_unavailable", error); }
    }
}
