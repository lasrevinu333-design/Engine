package org.memphiszoo.custodial.vault;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Process;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Explicit returned-phone maintenance. DUMP protects external launch; the
 * original sender UID also excludes same-app/plugin launches. Only an existing
 * original operation may be selected, never a path, body, credential, actor or
 * replacement identity. No startup, ongoing service or automatic work replay. */
public final class RetainedEnrollmentMaintenanceReceiver extends BroadcastReceiver {
    static final String FINISH="org.memphiszoo.custodial.FINISH_RETAINED_ENROLLMENT";
    static final String VERIFY="org.memphiszoo.custodial.VERIFY_RETAINED_ENROLLMENT";
    static final String REPORT="org.memphiszoo.custodial.REPORT_RETAINED_ENROLLMENT";
    static final AtomicBoolean FLIGHT=new AtomicBoolean();
    /** A broadcast must expose its original sender identity. The historical
     * Activity's unknown-launch filter is not sufficient for a new receiver;
     * an unshared/same-app sender must never become operator maintenance. The
     * OS DUMP gate remains independently mandatory. */
    static boolean permitsOriginalSender(int sdk,int sender,int own,boolean clean){
        return sender>=0&&NativeProtectedPreparationEntryPolicy.permits(sdk,sender,own,clean);
    }
    @Override public void onReceive(Context context,Intent intent){
        if(intent==null||!Set.of(VERIFY,REPORT,FINISH).contains(intent.getAction()))return;
        boolean admitted;
        try{
            int sender=Build.VERSION.SDK_INT>=34?getSentFromUid():Process.myUid();
            var extras=intent.getExtras();
            boolean clean=intent.getData()==null&&intent.getClipData()==null&&intent.getSelector()==null&&intent.getType()==null
                &&(intent.getCategories()==null||intent.getCategories().isEmpty())
                &&(extras==null||extras.keySet().stream().allMatch(k->Set.of("operation_id","device_id").contains(k)&&extras.get(k) instanceof String));
            admitted=permitsOriginalSender(Build.VERSION.SDK_INT,sender,Process.myUid(),clean);
        }catch(RuntimeException e){admitted=false;}
        if(!admitted||!FLIGHT.compareAndSet(false,true)){if(isOrderedBroadcast()){setResultCode(0);setResultData("custodial_retained_enrollment_maintenance_refused");}return;}
        final boolean ordered=isOrderedBroadcast(),report=REPORT.equals(intent.getAction()),finish=FINISH.equals(intent.getAction());
        final String originalOperation=intent.getStringExtra("operation_id"),device=intent.getStringExtra("device_id");
        final PendingResult pending=goAsync();
        Thread worker=new Thread(()->{
            char[] credential=null;
            try(var control=new NativePrivateCustodyFrameReadControl()){
                var app=CustodialEnrollmentApplication.actual(context);
                if(finish){
                    VaultValidation.operationId(originalOperation);
                    if(app.findRetainedState(originalOperation,control::check)==null){
                        var runtime=CustodialNativeRuntime.forProtectedHeldOriginalVerification(context,control);
                        JSONObject result=runtime.completeExistingRetainedEnrollmentPartition(control,originalOperation);
                        control.check();if(ordered){pending.setResultCode(-1);pending.setResultData(result.toString());}return;
                    }
                }
                try(var retained=NativeLocalEnrollmentRetentionReport.fromNativeApplication(app,control,originalOperation)){
                    if(device!=null&&!VaultValidation.deviceId(device).equals(retained.deviceForFixedTransport()))throw new VaultFailure("custodial_native_device_binding_mismatch");
                    JSONObject result;
                    if(report){
                        credential=retained.originalCredentialForFixedTransport();
                        result=new NativePrivateCustodyHttp().reportLocalEnrollmentRetention(retained,credential,control);
                    }else result=retained.verifyRetainedOriginals();
                    control.check();if(ordered){pending.setResultCode(-1);pending.setResultData(result.toString());}
                }
            }catch(Exception e){
                if(ordered){pending.setResultCode(0);try{pending.setResultData(new JSONObject().put("ok",false)
                    .put("code",e instanceof VaultFailure?((VaultFailure)e).code:"custodial_retained_enrollment_maintenance_unknown")
                    .put("work_accepted",false).put("key_removal",false).put("phone_assignment_changed",false).toString());}
                    catch(Exception ignored){pending.setResultData("custodial_retained_enrollment_maintenance_unknown");}}
            }finally{VaultValidation.wipe(credential);FLIGHT.set(false);pending.finish();}
        },"CustodialRetainedEnrollmentMaintenance");
        worker.setDaemon(true);
        try{worker.start();}catch(RuntimeException|Error e){FLIGHT.set(false);pending.finish();throw e;}
    }
}
