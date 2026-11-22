package org.memphiszoo.custodial.vault;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

/** Exact persisted job adapter. Construction/scheduling is not wired until runtime admission. */
final class AndroidProviderJobs implements NativeProviderJobSchedule.SystemJobs {
    private static final Object LOCK = new Object();
    private final JobScheduler scheduler;
    private final ComponentName component;
    AndroidProviderJobs(Context context) {
        scheduler = (JobScheduler) context.getApplicationContext().getSystemService(Context.JOB_SCHEDULER_SERVICE);
        component = new ComponentName(context.getApplicationContext(), NativeProviderJobSchedule.COMPONENT);
    }
    @Override public NativeProviderJobSchedule.Existing existing() {
        if (scheduler == null) return NativeProviderJobSchedule.Existing.CONFLICT;
        JobInfo info = scheduler.getPendingJob(NativeProviderJobSchedule.ID);
        if (info == null) return NativeProviderJobSchedule.Existing.ABSENT;
        return exact(info) ? NativeProviderJobSchedule.Existing.EXACT : NativeProviderJobSchedule.Existing.CONFLICT;
    }
    private boolean exact(JobInfo info) {
        return component.equals(info.getService()) && info.isPersisted() && !info.isPeriodic()
            && info.getNetworkType() == JobInfo.NETWORK_TYPE_ANY && !info.isRequireCharging() && !info.isRequireDeviceIdle()
            && info.getBackoffPolicy() == JobInfo.BACKOFF_POLICY_EXPONENTIAL && info.getInitialBackoffMillis() == 30000;
    }
    @Override public boolean scheduleMessageArrival() {
        if (scheduler == null || Build.VERSION.SDK_INT < 31) return false;
        synchronized (LOCK) {
            int id = NativeProviderJobSchedule.MESSAGE_ARRIVAL_ID;
            JobInfo existing = scheduler.getPendingJob(id);
            if (existing != null) return component.equals(existing.getService()) && existing.isExpedited()
                && !existing.isPersisted() && !existing.isPeriodic() && existing.getNetworkType() == JobInfo.NETWORK_TYPE_ANY
                && !existing.isRequireCharging() && !existing.isRequireDeviceIdle();
            JobInfo urgent = new JobInfo.Builder(id, component)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setExpedited(true).build();
            return scheduler.schedule(urgent) == JobScheduler.RESULT_SUCCESS;
        }
    }
    @Override public boolean schedule() {
        // All adapter instances use this exact lock. Recheck after the caller's observation,
        // including a competing callback that already scheduled the same job.
        synchronized (LOCK) {
            NativeProviderJobSchedule.Existing existing = existing();
            if (existing == NativeProviderJobSchedule.Existing.EXACT) return true;
            if (existing != NativeProviderJobSchedule.Existing.ABSENT) return false;
            JobInfo info = new JobInfo.Builder(NativeProviderJobSchedule.ID, component)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
                .setBackoffCriteria(30000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build();
            return scheduler.schedule(info) == JobScheduler.RESULT_SUCCESS;
        }
    }
}
