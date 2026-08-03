package org.memphiszoo.manager.vault;

import android.app.Activity;
import android.app.AlertDialog;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/** Native, explicit user-presence boundary that WebView JavaScript cannot click. */
final class AndroidRemovalAuthorizationGate implements RemovalAuthorizationGate {
    private static final long TIMEOUT_SECONDS = 120;
    private final Supplier<Activity> activitySupplier;
    private final AtomicBoolean promptActive = new AtomicBoolean();

    AndroidRemovalAuthorizationGate(Supplier<Activity> activitySupplier) {
        this.activitySupplier = activitySupplier;
    }

    @Override
    public boolean confirm(String operationId, String deviceId) throws VaultFailure {
        if (!promptActive.compareAndSet(false, true)) throw new VaultFailure("manager_native_removal_confirmation_busy");
        Activity activity = activitySupplier.get();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            promptActive.set(false);
            throw new VaultFailure("manager_native_removal_confirmation_unavailable");
        }
        CountDownLatch decisionReady = new CountDownLatch(1);
        AtomicReference<Boolean> decision = new AtomicReference<>(false);
        AtomicReference<AlertDialog> dialog = new AtomicReference<>();
        AtomicBoolean completed = new AtomicBoolean();
        activity.runOnUiThread(() -> {
            if (completed.get() || activity.isFinishing() || activity.isDestroyed()) {
                decisionReady.countDown();
                return;
            }
            AlertDialog shown = new AlertDialog.Builder(activity)
                .setTitle("Remove this phone's enrollment?")
                .setMessage("Remove " + deviceId + " from Manager access? Offline work stays on the phone, but server access stops until a manager enrolls it again.")
                .setNegativeButton("Cancel", (ignored, which) -> {
                    decision.set(false);
                    completed.set(true);
                    decisionReady.countDown();
                })
                .setPositiveButton("Remove enrollment", (ignored, which) -> {
                    decision.set(true);
                    completed.set(true);
                    decisionReady.countDown();
                })
                .setCancelable(false)
                .create();
            shown.setOnDismissListener(ignored -> {
                if (completed.compareAndSet(false, true)) decisionReady.countDown();
            });
            dialog.set(shown);
            shown.show();
        });
        try {
            if (!decisionReady.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                completed.set(true);
                AlertDialog shown = dialog.get();
                if (shown != null) activity.runOnUiThread(shown::dismiss);
                throw new VaultFailure("manager_native_removal_confirmation_timeout");
            }
            return Boolean.TRUE.equals(decision.get());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new VaultFailure("manager_native_removal_confirmation_interrupted", error);
        } finally {
            promptActive.set(false);
        }
    }
}
