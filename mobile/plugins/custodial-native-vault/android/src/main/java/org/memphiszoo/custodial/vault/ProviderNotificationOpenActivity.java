package org.memphiszoo.custodial.vault;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Private PendingIntent Activity, never a receiver/service notification trampoline.
 * Only an already committed native Open may bring the existing Custodial task forward. */
public final class ProviderNotificationOpenActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            NativeProviderActionIntent action = AndroidProviderActionIntent.read(this, getIntent(), true);
            NativeProviderComponentRuntime runtime = CustodialNativeRuntime.providerComponents(getApplicationContext());
            runtime.applyAction(action); // Original opened event + navigation request persisted/read back first.
            runtime.openCommitted(action, () -> startActivity(new Intent()
                .setClassName(this, NativeProviderActionIntent.PACKAGE + ".MainActivity")
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)));
            // No external URI, data, extras, arbitrary package, task reset or Lock Task change.
            // MainActivity/bridge must drain the original native journal after activation.
        } catch (VaultFailure | RuntimeException denied) {
            // Preserve the original record/pending action; never substitute a browser route.
        } finally { finish(); }
    }
}
