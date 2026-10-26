package org.memphiszoo.custodial.vault;

import android.content.Context;

/** Normal native vendor source coordination only. There is deliberately no
 * caller callback registry, JS interface, receipt factory or admission flag.
 * All actual patched plugin/manager/receivers synchronize on THIS class, and
 * every method below refuses calls outside that same critical section. */
public final class CustodialNativeNotificationWriter {
    public static final String GENERATION_EXTRA="org.memphiszoo.custodial.native-notification-generation.v1";
    /** Only expected journal/principal refusals BEFORE an effect use this type.
     * Post-effect recording failures deliberately remain ordinary exceptions:
     * callers must preserve their original UNKNOWN outcome. */
    public static final class BeforeEffectRefusal extends IllegalStateException {
        private BeforeEffectRefusal(VaultFailure unavailable) {
            super(NativeRecurringTargetJournal.FAILURE,unavailable);
        }
    }
    private CustodialNativeNotificationWriter(){}
    // A private native owner may hold exclusion across asynchronous UI DATA
    // reads. The monitor itself is NEVER retained across a UI wait.
    private static CallbackWriterLease activeCallbackLease;
    private static int activeMutationDepth;
    private static long mutationEpoch;
    private static boolean unexpectedMutationUnknown;
    static final class CallbackWriterLease implements AutoCloseable {
        private final CustodialNativeRuntime originalRuntime;
        private final NativeRecurringApplicationSource originalSource;
        private final NativeRecurringApplicationSource.CallbackHold originalHold;
        private final NativeProviderPrincipal originalPrincipal;
        private final NativeRecurringTargetJournal.KnownWriterFrame originalFrame;
        private final long originalMutationEpoch;
        private boolean retired,poisoned;
        private CallbackWriterLease(CustodialNativeRuntime runtime,NativeRecurringApplicationSource source,
            NativeRecurringApplicationSource.CallbackHold hold,NativeProviderPrincipal principal,
            NativeRecurringTargetJournal.KnownWriterFrame frame){
            originalRuntime=runtime;originalSource=source;originalHold=hold;originalPrincipal=principal;originalFrame=frame;originalMutationEpoch=mutationEpoch;
        }
        void requireCurrent()throws VaultFailure {
            requireMonitor();
            if(activeCallbackLease!=this||retired||poisoned||unexpectedMutationUnknown||activeMutationDepth!=0||originalMutationEpoch!=mutationEpoch)throw pending();
            originalHold.requireNativeWriterLeaseLifetime(originalSource);
            if(!originalPrincipal.same(originalRuntime.readNotificationMutationPrincipal()))throw pending();
            // Last raw journal reread follows the LAST principal/key callback.
            originalRuntime.notificationMutationJournal().requireKnownWriterFrame(originalFrame);
            originalHold.requireNativeWriterLeaseLifetime(originalSource);
            if(activeCallbackLease!=this||retired||poisoned||unexpectedMutationUnknown||activeMutationDepth!=0||originalMutationEpoch!=mutationEpoch)throw pending();
        }
        @Override public void close(){synchronized(CustodialNativeNotificationWriter.class){
            retired=true;if(activeCallbackLease==this)activeCallbackLease=null;
        }}
    }
    static CallbackWriterLease beginCallbackWriterLease(Context context,NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold)throws VaultFailure {
        requireMonitor();
        if(source==null||hold==null||activeCallbackLease!=null||activeMutationDepth!=0||unexpectedMutationUnknown)throw pending();
        hold.claimNativeWriterLeaseBirth(source);long originalEpoch=mutationEpoch;
        CustodialNativeRuntime owner=runtime(context);if(owner==null)throw pending();
        NativeProviderPrincipal principal=owner.readNotificationMutationPrincipal();if(principal==null)throw pending();
        NativeRecurringTargetJournal.KnownWriterFrame frame=owner.notificationMutationJournal().captureKnownWriterFrame();
        if(!principal.same(owner.readNotificationMutationPrincipal()))throw pending();
        owner.notificationMutationJournal().requireKnownWriterFrame(frame);
        hold.requireNativeWriterLeaseBirth(source);
        if(originalEpoch!=mutationEpoch||activeMutationDepth!=0||unexpectedMutationUnknown)throw pending();
        CallbackWriterLease lease=new CallbackWriterLease(owner,source,hold,principal,frame);activeCallbackLease=lease;
        return lease; // Exclusion only; no semantic OS/target/WORK receipt grant.
    }
    /** Only actual pinned vendor bodies participate; no JS registry/callback
     * mints a lease. Throw/UNKNOWN poisons eligibility but never retries work. */
    public static final class MutationScope implements AutoCloseable {
        private final Thread originalThread=Thread.currentThread();private boolean closed;
        private MutationScope(){}
        public void originalFailed(){requireMonitor();if(closed||Thread.currentThread()!=originalThread)throw new IllegalStateException("native writer scope mismatch");unexpectedMutationUnknown=true;}
        public void originalAsyncUnresolved(){requireMonitor();if(closed||Thread.currentThread()!=originalThread)throw new IllegalStateException("native writer scope mismatch");unexpectedMutationUnknown=true;}
        @Override public void close(){requireMonitor();if(closed||Thread.currentThread()!=originalThread)throw new IllegalStateException("native writer scope mismatch");closed=true;activeMutationDepth--;}
    }
    public static MutationScope beginVendorMutation(){
        requireMonitor();
        try{NativeRecurringOrdinaryCommitPermit.beforeUnclassifiedEntry();}
        catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
        CallbackWriterLease lease=activeCallbackLease;
        if(lease!=null){
            try{lease.originalHold.requireNativeWriterLeaseLifetime(lease.originalSource);}
            catch(VaultFailure withdrawn){lease.poisoned=true;lease.close();lease=null;}
            if(lease!=null){lease.poisoned=true;throw new BeforeEffectRefusal(pending());}
        }
        if(activeMutationDepth==Integer.MAX_VALUE){unexpectedMutationUnknown=true;throw new BeforeEffectRefusal(pending());}
        if(mutationEpoch==Long.MAX_VALUE)unexpectedMutationUnknown=true;else mutationEpoch++;
        activeMutationDepth++;return new MutationScope();
    }
    static void requireOrdinaryCommitQuiescent()throws VaultFailure {requireMonitor();if(activeMutationDepth!=0)throw pending();}
    private static void requireMonitor(){if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native notification writer fence missing");}
    private static VaultFailure pending(){return new VaultFailure(NativeRecurringTargetJournal.FAILURE);}

    private static CustodialNativeRuntime runtime(Context context) {
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native notification writer fence missing");
        if(context==null)throw new IllegalArgumentException("native notification context missing");
        String name=context.getApplicationContext().getPackageName();
        if(!"org.memphiszoo.custodial".equals(name)&&!"org.memphiszoo.custodial.vault.test".equals(name))return null;
        return CustodialNativeRuntime.get(context.getApplicationContext());
    }
    public static String beforeSchedule(Context context,int id,String original) {
        try {
            var runtime=runtime(context);if(runtime==null)return null;
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,null,original,false);
            var principal=runtime.readNotificationMutationPrincipal();
            if(principal==null){runtime.notificationMutationJournal().requireUntrackedId(id);return null;}
            NativeRecurringOrdinaryEffectProducer.beforeGeneration(runtime,principal,original);
            var originalJournal=runtime.notificationMutationJournal();
            String generation=originalJournal.beforeSchedule(principal,id,original);
            NativeRecurringOrdinaryEffectProducer.observeGeneration(runtime,originalJournal.takeOriginalEffectBirth(generation));
            if(!principal.same(runtime.readNotificationMutationPrincipal()))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return generation;
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    /** Native lexical effect DATA. No Plugin method exposes these types and
     * no call/return mints a receipt, Source frame or dispatch capability. */
    public static final class SemanticCall {
        private final NativeRecurringOrdinaryEffectProducer.Call original;
        private SemanticCall(NativeRecurringOrdinaryEffectProducer.Call original){this.original=original;}
    }
    private static SemanticCall semanticBefore(Context context,String generation,int id,NativeRecurringOrdinaryEffectProducer.Operation operation,
        android.app.Notification notification,android.app.PendingIntent intent,int type,long trigger,int flags){
        requireMonitor();
        try{NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime(context),id,generation,null,false);}
        catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
        try{var owner=runtime(context);if(generation==null&&owner!=null)generation=NativeRecurringOrdinaryEffectProducer.generationForId(owner,id);
            var call=NativeRecurringOrdinaryEffectProducer.before(owner,generation,id,operation,notification,intent,type,trigger,flags);
            return call==null?null:new SemanticCall(call);
        }catch(Exception unavailable){return null;} // Additional observation never retries/suppresses the original API.
    }
    public static final class SemanticIntent {
        private final NativeRecurringOrdinaryEffectProducer.PendingCreation original;
        private SemanticIntent(NativeRecurringOrdinaryEffectProducer.PendingCreation original){this.original=original;}
    }
    private static SemanticIntent semanticIntentStarting(Context context,String generation,int id,android.content.Intent intent,int requestCode,int flags,NativeRecurringOrdinaryEffectProducer.IntentKind kind){
        requireMonitor();
        try{NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime(context),id,generation,null,false);}
        catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
        try{var creation=NativeRecurringOrdinaryEffectProducer.pendingIntentStarting(runtime(context),generation,id,intent,requestCode,flags,kind);
            return creation==null?null:new SemanticIntent(creation);
        }catch(Exception unavailable){return null;}
    }
    public static SemanticIntent semanticActivityIntentStarting(Context context,String generation,int id,android.content.Intent intent,int requestCode,int flags){
        return semanticIntentStarting(context,generation,id,intent,requestCode,flags,NativeRecurringOrdinaryEffectProducer.IntentKind.ACTIVITY_ACTION);
    }
    public static SemanticIntent semanticDeleteIntentStarting(Context context,String generation,int id,android.content.Intent intent,int requestCode,int flags){
        return semanticIntentStarting(context,generation,id,intent,requestCode,flags,NativeRecurringOrdinaryEffectProducer.IntentKind.DELETE_BROADCAST);
    }
    public static SemanticIntent semanticAlarmIntentStarting(Context context,String generation,int id,android.content.Intent intent,int requestCode,int flags){
        return semanticIntentStarting(context,generation,id,intent,requestCode,flags,NativeRecurringOrdinaryEffectProducer.IntentKind.ALARM_BROADCAST);
    }
    public static void semanticIntentReturned(SemanticIntent creation,android.app.PendingIntent actual){
        requireMonitor();if(creation!=null)NativeRecurringOrdinaryEffectProducer.recordIntent(creation.original,actual);
    }
    public static SemanticCall semanticBeforeNotify(Context context,String generation,int id,android.app.Notification notification){
        return semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY,notification,null,0,0,0);
    }
    public static SemanticCall semanticBeforeAlarmSet(Context context,String generation,int id,android.app.Notification notification,android.app.PendingIntent intent,long trigger,int flags){
        return semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.ALARM_SET,notification,intent,android.app.AlarmManager.RTC,trigger,flags);
    }
    public static SemanticCall semanticBeforeAlarmSetIdle(Context context,String generation,int id,android.app.Notification notification,android.app.PendingIntent intent,long trigger,int flags){
        return semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.ALARM_SET_IDLE,notification,intent,android.app.AlarmManager.RTC_WAKEUP,trigger,flags);
    }
    public static SemanticCall semanticBeforeAlarmExact(Context context,String generation,int id,android.app.Notification notification,android.app.PendingIntent intent,long trigger,int flags){
        return semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.ALARM_EXACT,notification,intent,android.app.AlarmManager.RTC,trigger,flags);
    }
    public static SemanticCall semanticBeforeAlarmExactIdle(Context context,String generation,int id,android.app.Notification notification,android.app.PendingIntent intent,long trigger,int flags){
        return semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.ALARM_EXACT_IDLE,notification,intent,android.app.AlarmManager.RTC_WAKEUP,trigger,flags);
    }
    public static SemanticCall semanticBeforeNotificationCancel(Context context,int id){
        return semanticBefore(context,null,id,NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_NOTIFICATION,null,null,0,0,0);
    }
    public static SemanticCall semanticBeforeAlarmCancel(Context context,int id,android.app.PendingIntent intent,int flags){
        return semanticBefore(context,null,id,NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_ALARM,null,intent,0,0,flags);
    }
    public static java.util.List<SemanticCall> semanticBeforeDeliveredCancelAll(Context context,java.util.List<String> generations){
        requireMonitor();java.util.List<SemanticCall> calls=new java.util.ArrayList<>();
        for(String generation:generations)try{var owner=runtime(context);int id=NativeRecurringOrdinaryEffectProducer.idForGeneration(owner,generation);
            SemanticCall call=semanticBefore(context,generation,id,NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_NOTIFICATION,null,null,0,0,0);
            if(call!=null)calls.add(call);
        }catch(Exception unavailable){}return java.util.List.copyOf(calls);
    }
    public static void semanticReturned(SemanticCall call){requireMonitor();if(call!=null)NativeRecurringOrdinaryEffectProducer.returned(call.original);}
    public static void semanticTerminal(Context context,String generation){
        requireMonitor();try{NativeRecurringOrdinaryEffectProducer.terminal(runtime(context),generation);}catch(Exception unavailable){}
    }
    public static void scheduleCalled(Context context,String generation) {
        if(generation==null)return;
        try {var runtime=runtime(context);if(runtime==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().scheduleCalled(generation,NativeNotificationOriginalFrame.capture(context,generation));
        }catch(VaultFailure unavailable){throw new IllegalStateException(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
    public static String beforeCancel(Context context,int id) {
        try {var runtime=runtime(context);if(runtime==null)return null;
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,null,null,false);
            var principal=runtime.readNotificationMutationPrincipal();
            if(principal==null){runtime.notificationMutationJournal().requireUntrackedId(id);return null;}
            java.util.Map<String,?> raw=context.getSharedPreferences("NOTIFICATION_STORE",Context.MODE_PRIVATE).getAll();
            Object stored=raw.get(String.valueOf(id));
            if(stored==null&&!raw.containsKey(String.valueOf(id)))return beforeDeliveredCancel(context,id,null);
            String generation=runtime.notificationMutationJournal().beforeCancel(principal,id,stored instanceof String?(String)stored:null);
            if(!principal.same(runtime.readNotificationMutationPrincipal()))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return generation;
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static String beforeDeliveredCancel(Context context,int id,String tag) {
        try {var runtime=runtime(context);if(runtime==null)return null;
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,null,null,false);
            var principal=runtime.readNotificationMutationPrincipal();
            if(principal==null||tag!=null){runtime.notificationMutationJournal().requireUntrackedId(id);return null;}
            var manager=context.getSystemService(android.app.NotificationManager.class);
            if(manager==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            String group=null;boolean found=false;
            for(var active:manager.getActiveNotifications()) {
                if(active.getId()!=id||!java.util.Objects.equals(active.getTag(),tag))continue;
                if(found||active.getNotification()==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                found=true;group=active.getNotification().getGroup();
            }
            if(!found){runtime.notificationMutationJournal().requireUntrackedId(id);return null;}
            String generation=runtime.notificationMutationJournal().beforeDeliveredCancel(principal,id,group);
            if(!principal.same(runtime.readNotificationMutationPrincipal()))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return generation;
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static java.util.List<String> beforeCancelAll(Context context) {
        try {var runtime=runtime(context);if(runtime==null)return java.util.List.of();
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,null,null,null,true);
            var original=runtime.readNotificationMutationPrincipal();
            var manager=context.getSystemService(android.app.NotificationManager.class);
            if(manager==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            var active=manager.getActiveNotifications();
            if(active==null||active.length>256)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            java.util.List<String> generations=new java.util.ArrayList<>();
            for(var row:active){
                if(row==null||row.getUid()!=context.getApplicationInfo().uid||!context.getPackageName().equals(row.getPackageName())
                    ||row.getNotification()==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                String generation=beforeDeliveredCancel(context,row.getId(),row.getTag());
                if(generation!=null){if(generations.contains(generation))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);generations.add(generation);}
            }
            var terminal=runtime.readNotificationMutationPrincipal();
            if(original==null?terminal!=null:!original.same(terminal))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return java.util.List.copyOf(generations);
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static void cancelAllCalled(Context context,java.util.List<String> generations) {
        if(generations==null)throw new IllegalArgumentException("Actual original cancellation set missing");
        for(String generation:generations)cancelCalled(context,generation);
    }
    private static String actualOriginalRaw(Context context,int id) {
        Object raw=context.getSharedPreferences("NOTIFICATION_STORE",Context.MODE_PRIVATE).getAll().get(String.valueOf(id));
        return raw instanceof String?(String)raw:null;
    }
    public static void requireRestoreCandidate(Context context,String originalKey) {
        if(originalKey==null||!originalKey.matches("[1-9][0-9]{0,9}"))return;
        long parsed=Long.parseLong(originalKey);if(parsed>Integer.MAX_VALUE)return;int id=(int)parsed;
        try {var runtime=runtime(context);if(runtime==null)return;
            var principal=runtime.readNotificationMutationPrincipal();
            runtime.notificationMutationJournal().requireRestoreCandidate(principal,id,actualOriginalRaw(context,id),System.currentTimeMillis());
            var terminal=runtime.readNotificationMutationPrincipal();
            if(principal==null?terminal!=null:!principal.same(terminal))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static String beforeRestore(Context context,int id,String original,long actualDeadline) {
        try {var runtime=runtime(context);if(runtime==null)return null;
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,null,original,false);
            var principal=runtime.readNotificationMutationPrincipal();
            String actual=actualOriginalRaw(context,id);
            if(!java.util.Objects.equals(actual,original)){runtime.notificationMutationJournal().requireUntrackedId(id);return null;}
            String generation=runtime.notificationMutationJournal().beforeRestore(principal,id,actual,actualDeadline,System.currentTimeMillis());
            var terminal=runtime.readNotificationMutationPrincipal();
            if(principal==null?terminal!=null:!principal.same(terminal))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return generation;
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static void requireRestoreCurrent(Context context,String generation,int id,String original,long actualDeadline) {
        if(generation==null)throw new BeforeEffectRefusal(new VaultFailure(NativeRecurringTargetJournal.FAILURE));
        try {var runtime=runtime(context);if(runtime==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,generation,original,false);
            var principal=runtime.readNotificationMutationPrincipal();
            if(!java.util.Objects.equals(actualOriginalRaw(context,id),original))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().requireRestoreCurrent(principal,generation,id,original,actualDeadline,System.currentTimeMillis());
            if(principal==null||!principal.same(runtime.readNotificationMutationPrincipal()))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            // Actual original raw/state/deadline reread AFTER the last native
            // principal/key callback, immediately before the fixed Alarm call.
            if(!java.util.Objects.equals(actualOriginalRaw(context,id),original))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().requireRestoreCurrent(principal,generation,id,original,actualDeadline,System.currentTimeMillis());
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static void restoreCalled(Context context,String generation) {
        if(generation==null)return;
        try {var runtime=runtime(context);if(runtime==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().restoreCalled(generation,NativeNotificationOriginalFrame.capture(context,generation));
        }catch(VaultFailure unavailable){throw new IllegalStateException(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
    public static void cancelCalled(Context context,String generation) {
        if(generation==null)return;
        try {var runtime=runtime(context);if(runtime==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().cancelCalled(generation,NativeNotificationOriginalFrame.capture(context,generation));
        }catch(VaultFailure unavailable){throw new IllegalStateException(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
    /** Internal owned groups never borrow generation-less legacy delivery.
     * This classifies the actual Notification.getGroup value passed by the
     * real receiver. It neither cancels an alarm nor invents a journal row. */
    static boolean requiresOriginalGeneration(String group){
        return group!=null&&group.startsWith("mz-custodial-owned:");
    }
    private static void requireOwnedDispatchGeneration(String generation,String group)throws VaultFailure {
        if(generation==null&&requiresOriginalGeneration(group))throw pending();
    }
    public static boolean beforeDispatch(Context context,String generation,int id,String group) {
        try {var runtime=runtime(context);if(runtime==null){if(generation!=null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);return true;}
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,generation,null,false);
            requireOwnedDispatchGeneration(generation,group);
            if(generation==null){runtime.notificationMutationJournal().requireUntrackedId(id);return true;}
            var principal=runtime.readNotificationMutationPrincipal();if(principal==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            boolean admitted=runtime.notificationMutationJournal().beforeDispatch(principal,generation,id,group);
            if(!principal.same(runtime.readNotificationMutationPrincipal()))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            return admitted;
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    /** No second dispatch attempt: fresh original-state/principal guard after
     * the actual fireReceived callback, immediately before normal notify. */
    public static void requireDispatchCurrent(Context context,String generation,int id,String group) {
        try {var runtime=runtime(context);if(runtime==null){if(generation!=null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);return;}
            NativeRecurringOrdinaryCommitPermit.beforeMutation(runtime,id,generation,null,false);
            requireOwnedDispatchGeneration(generation,group);
            var principal=runtime.readNotificationMutationPrincipal();
            runtime.notificationMutationJournal().requireDispatchCurrent(principal,generation,id,group);
            var terminal=runtime.readNotificationMutationPrincipal();
            if(principal==null?terminal!=null:!principal.same(terminal))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            // No state transition/retry: catch changed original WORK after the
            // last native principal callback before the actual notify call.
            runtime.notificationMutationJournal().requireDispatchCurrent(principal,generation,id,group);
        }catch(VaultFailure unavailable){throw new BeforeEffectRefusal(unavailable);}
    }
    public static void dispatchCalled(Context context,String generation) {
        if(generation==null)return;
        try {var runtime=runtime(context);if(runtime==null)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            runtime.notificationMutationJournal().dispatchCalled(generation,NativeNotificationOriginalFrame.capture(context,generation));
        }catch(VaultFailure unavailable){throw new IllegalStateException(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
}
