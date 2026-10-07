package org.memphiszoo.custodial.vault;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** System-owned bounded worker. Completion is never a provider delivery receipt. */
public final class CustodialProviderSyncJobService extends JobService {
    private Handler main;
    private NativeProviderJobLifecycle lifecycle;
    private Run active;
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
                if (run.future != null) run.future.cancel(true);
                run.executor.shutdownNow();
            }
            @Override public void finished(Object owner, boolean retry) { jobFinished((JobParameters) owner, retry); }
        });
    }

    @Override public boolean onStartJob(JobParameters parameters) {
        if (parameters == null || parameters.getJobId() != NativeProviderJobSchedule.ID || active != null) return false;
        final NativeProviderComponentRuntime runtime = CustodialNativeRuntime.providerComponents(getApplicationContext());
        if (runtime.pendingWork() != NativeProviderJobLifecycle.Result.RETRY) return false;
        try {
            NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(parameters, SystemClock::elapsedRealtime);
            Run run = new Run(parameters, runtime, invocation); active = run;
            run.deadline = () -> lifecycle.deadline(invocation);
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
                    result = runtime.pendingWork() == NativeProviderJobLifecycle.Result.SUSPEND
                        ? NativeProviderJobLifecycle.Result.SUSPEND : NativeProviderJobLifecycle.Result.RETRY;
                }
                final NativeProviderJobLifecycle.Result completion = result;
                main.post(() -> lifecycle.complete(invocation, completion));
            });
            return true;
        } catch (RuntimeException | VaultFailure unavailable) {
            // No successful start was returned: Android owns this callback's completion.
            lifecycle.stop(parameters, NativeProviderJobLifecycle.Result.RETRY); return false;
        }
    }

    @Override public boolean onStopJob(JobParameters parameters) {
        Run run = active;
        // Android may reconstruct JobParameters across its Binder callback. Resolve its
        // one fixed job to OUR original invocation object; never compare parcel identity.
        if (run == null || parameters == null || parameters.getJobId() != NativeProviderJobSchedule.ID) return false;
        return lifecycle.stop(run.parameters, run.runtime.pendingWork() == NativeProviderJobLifecycle.Result.SUSPEND
            ? NativeProviderJobLifecycle.Result.SUSPEND : NativeProviderJobLifecycle.Result.RETRY);
    }
    @Override public void onDestroy() {
        if (lifecycle != null) lifecycle.destroy();
        super.onDestroy();
    }
}
