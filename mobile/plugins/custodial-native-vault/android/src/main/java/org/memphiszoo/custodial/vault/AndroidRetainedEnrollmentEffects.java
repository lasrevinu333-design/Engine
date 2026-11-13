package org.memphiszoo.custodial.vault;

import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.Context;
import android.service.notification.StatusBarNotification;

/** Local presentation quiescence after the exact original vault is EMPTY and
 * its native/browser writers remain HELD. This does not edit any journal,
 * unregister a token, submit work, remove a key, or clear app data. Each cancel
 * names an actually observed notification owned by THIS Custodial package;
 * there is no global cancelAll or cancellation of another app's items. */
final class AndroidRetainedEnrollmentEffects {
    static void quiesce(CustodialEnrollmentApplication app,CustodialNativeRuntime runtime,
        VaultEngine.NativeOriginalInventoryFinalizationControl original,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(app==null||runtime==null||original==null||control==null
            ||!"org.memphiszoo.custodial".equals(app.getPackageName()))throw failure();
        original.requireRetainedEffectsOwner(runtime);control.check();
        // Existing original audio must already have released its actual host,
        // focus/player/utterance ownership. Do not create or play audio here.
        var idle=CustodialProviderAudioService.captureOrdinaryIdle();idle.requireCurrent();
        NotificationManager notices=(NotificationManager)app.getSystemService(Context.NOTIFICATION_SERVICE);
        JobScheduler scheduler=(JobScheduler)app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if(notices==null||scheduler==null)throw failure();
        StatusBarNotification[] active=notices.getActiveNotifications();
        if(active==null||active.length>4096)throw failure();
        for(StatusBarNotification notice:active){
            control.check();idle.requireCurrent();
            if(notice==null)throw failure();
            if(app.getPackageName().equals(notice.getPackageName()))notices.cancel(notice.getTag(),notice.getId());
        }
        var jobs=new AndroidProviderJobs(app);var pending=jobs.existing();
        if(pending==NativeProviderJobSchedule.Existing.CONFLICT)throw failure();
        if(pending==NativeProviderJobSchedule.Existing.EXACT)scheduler.cancel(NativeProviderJobSchedule.ID);
        if(jobs.existing()!=NativeProviderJobSchedule.Existing.ABSENT)throw failure();
        active=notices.getActiveNotifications();if(active==null||active.length>4096)throw failure();
        for(StatusBarNotification notice:active)if(notice==null||app.getPackageName().equals(notice.getPackageName()))throw failure();
        idle.requireCurrent();original.requireRetainedEffectsOwner(runtime);control.check();
    }
    private static VaultFailure failure(){return new VaultFailure("custodial_retained_enrollment_presentation_quiescence_unconfirmed");}
    private AndroidRetainedEnrollmentEffects(){}
}
