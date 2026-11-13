package org.memphiszoo.custodial.vault;

import android.app.Activity;
import android.app.AlertDialog;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

final class AndroidCancellationAuthorizationGate implements CancellationAuthorizationGate {
    private static final long TIMEOUT_SECONDS = 120;
    private final Supplier<Activity> activitySupplier;
    private final AtomicBoolean promptActive = new AtomicBoolean();

    AndroidCancellationAuthorizationGate(Supplier<Activity> activitySupplier) {
        this.activitySupplier = activitySupplier;
    }

    @Override
    public boolean confirm(String operationId, String deviceId) throws VaultFailure {
        if (!promptActive.compareAndSet(false, true)) throw new VaultFailure("custodial_native_cancellation_confirmation_busy");
        Activity activity = activitySupplier.get();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            promptActive.set(false);
            throw new VaultFailure("custodial_native_cancellation_confirmation_unavailable");
        }
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<Boolean> decision = new AtomicReference<>(false);
        AtomicReference<AlertDialog> dialog = new AtomicReference<>();
        AtomicBoolean completed = new AtomicBoolean();
        activity.runOnUiThread(() -> {
            if (completed.get() || activity.isFinishing() || activity.isDestroyed()) {
                ready.countDown();
                return;
            }
            AlertDialog shown = new AlertDialog.Builder(activity)
                .setTitle("Cancel this enrollment?")
                .setMessage("Cancel the pending enrollment for " + deviceId + "? Any staged server credential will be revoked. Offline work stays on the phone.")
                .setNegativeButton("Keep enrollment", (ignored, which) -> {
                    completed.set(true);
                    ready.countDown();
                })
                .setPositiveButton("Cancel enrollment", (ignored, which) -> {
                    decision.set(true);
                    completed.set(true);
                    ready.countDown();
                })
                .setCancelable(false)
                .create();
            shown.setOnDismissListener(ignored -> {
                if (completed.compareAndSet(false, true)) ready.countDown();
            });
            dialog.set(shown);
            shown.show();
        });
        try {
            if (!ready.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                completed.set(true);
                AlertDialog shown = dialog.get();
                if (shown != null) activity.runOnUiThread(shown::dismiss);
                throw new VaultFailure("custodial_native_cancellation_confirmation_timeout");
            }
            return Boolean.TRUE.equals(decision.get());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new VaultFailure("custodial_native_cancellation_confirmation_interrupted", error);
        } finally {
            promptActive.set(false);
        }
    }
}
