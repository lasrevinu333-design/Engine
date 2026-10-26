package org.memphiszoo.custodial.vault;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Private Acknowledge/Delete entry. Only bounded local persistence; no Activity or HTTP. */
public final class ProviderNotificationActionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            NativeProviderActionIntent action = AndroidProviderActionIntent.read(context, intent, false);
            NativeProviderComponentRuntime runtime = CustodialNativeRuntime.providerComponents(context.getApplicationContext());
            // Admission is nonblocking and does not open any native store. Do not create a
            // thread for a suspended component or treat a parsed locator as accepted work.
            if (runtime == NativeProviderComponentRuntime.SUSPENDED) return;
            PendingResult pending = goAsync();
            Thread worker = new Thread(() -> {
                try { runtime.applyAction(action); }
                catch (VaultFailure | RuntimeException denied) { /* Original pending record retained. */ }
                finally { pending.finish(); }
            }, "CustodialProviderAction");
            try { worker.start(); }
            catch (RuntimeException unavailable) { pending.finish(); }
        } catch (VaultFailure | RuntimeException denied) {
            // Unknown/forged actions never open stores, mint receipts or navigate.
        }
    }
}
