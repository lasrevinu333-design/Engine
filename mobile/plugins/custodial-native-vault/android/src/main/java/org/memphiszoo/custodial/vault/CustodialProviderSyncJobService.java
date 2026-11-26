package org.memphiszoo.custodial.vault;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** System-owned bounded worker. Completion is never a provider delivery receipt. */
public final class CustodialProviderSyncJobService extends JobService {
    private Handler main;
    private NativeProviderJobLifecycle lifecycle;
    private Run active;
    private JobParameters deferredRecovery;
    private static final class Run {
        final JobParameters parameters;
        final NativeProviderComponentRuntime runtime;
        final NativeProviderJobLifecycle.Invocation invocation;
        final ExecutorService executor;
        Future<?> future;
        Runnable deadline;
        Run(JobParameters parameters, NativeProviderComponentRuntime runtime, NativeProviderJobLifecycle.Invocation invocation) {
            this.parameters = parameters; this.runtime = runtime; this.invocation = invocation;
            executor = Executors.newSingleThreadExecutor(task -> new Thread(task, "CustodialProviderSync"));
        }
    }

    @Override public void onCreate() {
        super.onCreate(); main = new Handler(Looper.getMainLooper());
        lifecycle = new NativeProviderJobLifecycle(new NativeProviderJobLifecycle.Effects() {
            @Override public void release(Object owner) {
                Run run = active;
                if (run == null || run.parameters != owner) return;
                active = null;
                if (run.deadline != null) main.removeCallbacks(run.deadline);
                // The lifecycle has already canceled the attempt and disconnected
                // its HTTP connection. An interrupt can make an in-flight Android
                // preferences commit report failure after staging protected data.
                // Let that write settle; the existing attempt checks still fence later work.
                if (run.future != null) run.future.cancel(false);
                run.executor.shutdown();
            }
            @Override public void finished(Object owner, boolean retry) {
                JobParameters parameters = (JobParameters) owner;
                jobFinished(parameters, retry && parameters.getJobId() == NativeProviderJobSchedule.ID);
                finishDeferredRecovery();
            }
        });
    }

    @Override public boolean onStartJob(JobParameters parameters) {
        if (parameters == null) return false;
        int id = parameters.getJobId();
        if (id != NativeProviderJobSchedule.ID &&
            (id != NativeProviderJobSchedule.MESSAGE_ARRIVAL_ID || Build.VERSION.SDK_INT < 31 || !parameters.isExpeditedJob()))
            return false;
        if (active != null) {
            // Preserve the regular recovery job when Android starts it during an urgent pass.
            if (id == NativeProviderJobSchedule.ID && active.parameters.getJobId() == NativeProviderJobSchedule.MESSAGE_ARRIVAL_ID
                && deferredRecovery == null) {
                deferredRecovery = parameters;
                return true;
            }
            return false;
        }
        final NativeProviderComponentRuntime runtime = CustodialNativeRuntime.providerComponents(getApplicationContext());
        if (pendingWork(runtime,id) != NativeProviderJobLifecycle.Result.RETRY) return false;
        try {
            NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(parameters, SystemClock::elapsedRealtime);
            Run run = new Run(parameters, runtime, invocation); active = run;
            run.deadline = () -> {
                if (active == run) diagnostic("native_sync_deadline", null);
                lifecycle.deadline(invocation);
            };
            if (!main.postDelayed(run.deadline, NativeProviderJobBudget.MAX_MILLIS)) {
                lifecycle.stop(parameters, NativeProviderJobLifecycle.Result.RETRY); return false;
            }
            run.future = run.executor.submit(() -> {
                NativeProviderJobLifecycle.Result result;
                try {
                    invocation.attempt.check();
                    result = runtime.synchronize(invocation);
                    if (result == null) result = NativeProviderJobLifecycle.Result.RETRY;
                } catch (Exception failure) {
                    diagnostic("native_sync_refused", failure);
                    result = pendingWork(runtime,id) == NativeProviderJobLifecycle.Result.SUSPEND
                        ? NativeProviderJobLifecycle.Result.SUSPEND : NativeProviderJobLifecycle.Result.RETRY;
                }
                if (result == NativeProviderJobLifecycle.Result.SUSPEND) diagnostic("native_sync_suspended", null);
                final NativeProviderJobLifecycle.Result completion = result;
                main.post(() -> lifecycle.complete(invocation, completion));
            });
            return true;
        } catch (RuntimeException | VaultFailure unavailable) {
            diagnostic("native_sync_start_refused", unavailable);
            // No successful start was returned: Android owns this callback's completion.
            lifecycle.stop(parameters, NativeProviderJobLifecycle.Result.RETRY); return false;
        }
    }

    private static NativeProviderJobLifecycle.Result pendingWork(NativeProviderComponentRuntime runtime, int id) {
        return id == NativeProviderJobSchedule.ID ? runtime.pendingPersistedRecovery() : runtime.pendingWork();
    }

    private static void diagnostic(String event, Throwable failure) {
        // Only private constant call sites supply event. Diagnostic loss cannot
        // change the original completion, cancellation, retry or storage state.
        try { Log.w("CustodialProvider", event + (failure == null ? "" : " " + NativeProviderFailureDisposition.diagnostic(failure))); }
        catch (RuntimeException unavailable) { }
    }

    private void finishDeferredRecovery() {
        JobParameters pending = deferredRecovery;
        deferredRecovery = null;
        if (pending != null) jobFinished(pending, true);
    }

    @Override public boolean onStopJob(JobParameters parameters) {
        if (parameters == null) return false;
        int id = parameters.getJobId();
        if (id == NativeProviderJobSchedule.ID && deferredRecovery != null) {
            deferredRecovery = null;
            return true;
        }
        Run run = active;
        // JobParameters may be reconstructed across Binder. Resolve the fixed
        // ID to the invocation that actually received onStartJob.
        if (run == null || run.parameters.getJobId() != id) return false;
        boolean retry = lifecycle.stop(run.parameters, pendingWork(run.runtime,id) == NativeProviderJobLifecycle.Result.SUSPEND
            ? NativeProviderJobLifecycle.Result.SUSPEND : NativeProviderJobLifecycle.Result.RETRY);
        finishDeferredRecovery();
        return retry && id == NativeProviderJobSchedule.ID;
    }
    @Override public void onDestroy() {
        if (lifecycle != null) lifecycle.destroy();
        finishDeferredRecovery();
        super.onDestroy();
    }
}
