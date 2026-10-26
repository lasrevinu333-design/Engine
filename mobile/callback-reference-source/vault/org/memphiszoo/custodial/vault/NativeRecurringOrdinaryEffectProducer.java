package org.memphiszoo.custodial.vault;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native-call DATA only. The private index is born at actual normal writer
 * seams, never from JS JSON, an OS identity list or a recovered journal DTO.
 * It is deliberately process-only: lost/old/opaque relevant provenance stays
 * UNKNOWN. No receipt, dispatch, alarm-delivery or historical-clean grant. */
final class NativeRecurringOrdinaryEffectProducer {
    private NativeRecurringOrdinaryEffectProducer(){}
    // Diagnostic-only candidate: fixed stage/count scalars, never raw fields,
    // exception text, keys, identifiers, stack or admission/settlement verdicts.
    private static int diagnosticCount;
    private static void diagnostic(String phase,int stage,Sequence sequence,int calls,int pending){
        if(diagnosticCount>=16)return;int ordinal=++diagnosticCount;
        try{
            int count=0,returned=0,terminal=0;String last="NONE";boolean unknown=false;
            if(sequence!=null){unknown=sequence.unknown;for(Sequence.Step step:sequence.steps){count++;if(step.returned)returned++;if(step.terminal)terminal++;last=step.operation.name();}}
            System.out.println("CUSTODIAL_NATIVE_EFFECT_DIAGNOSTIC ordinal="+ordinal+" phase="+phase+" stage="+stage
                +" unknown="+unknown+" steps="+count+" returned="+returned+" terminal="+terminal
                +" last="+last+" calls="+calls+" pending="+pending);
        }catch(Throwable diagnosticUnavailable){/* Diagnostic failure cannot alter the original operation. */}
    }
    private static void diagnostic(String phase,int stage,Entry entry){diagnostic(phase,stage,entry==null?null:entry.sequence,entry==null?0:entry.calls.size(),entry==null?0:entry.pending.size());}

    enum Operation { NOTIFY, ALARM_SET, ALARM_SET_IDLE, ALARM_EXACT, ALARM_EXACT_IDLE, CANCEL_NOTIFICATION, CANCEL_ALARM, PENDING_INTENT_FACTORY }
    private static boolean diagnosticKeyCensusDone;
    // Fixed literals independently extracted from the pinned normal framework
    // and AndroidX Notification classes. Caller-created keys are never logged.
    private static final java.util.Set<String> DIAGNOSTIC_FRAMEWORK_EXTRA_NAMES=java.util.Set.of("android.answerColor","android.answerIntent","android.appInfo","android.audioContents","android.backgroundImageUri","android.bigText","android.callIsVideo","android.callPerson","android.callPersonCompat","android.callType","android.car.EXTENSIONS","android.chronometerCountDown","android.colorized","android.compactActions","android.conversationTitle","android.declineColor","android.declineIntent","android.hangUpIntent","android.hiddenConversationTitle","android.icon","android.infoText","android.intent.category.NOTIFICATION_PREFERENCES","android.intent.extra.CHANNEL_GROUP_ID","android.intent.extra.CHANNEL_ID","android.intent.extra.NOTIFICATION_ID","android.intent.extra.NOTIFICATION_TAG","android.isGroupConversation","android.largeIcon","android.largeIcon.big","android.mediaSession","android.messages","android.messages.historic","android.messagingStyleUser","android.messagingUser","android.people","android.people.list","android.picture","android.pictureContentDescription","android.pictureIcon","android.progress","android.progressEndIcon","android.progressIndeterminate","android.progressMax","android.progressPoints","android.progressSegments","android.progressStartIcon","android.progressTrackerIcon","android.reduced.images","android.remoteInputDraft","android.remoteInputHistory","android.requestPromotedOngoing","android.selfDisplayName","android.shortCriticalText","android.showBigPictureWhenCollapsed","android.showChronometer","android.showWhen","android.styledByProgress","android.subText","android.summaryText","android.support.BIND_NOTIFICATION_SIDE_CHANNEL","android.support.action.semanticAction","android.support.action.showsUserInterface","android.support.actionExtras","android.support.allowGeneratedReplies","android.support.dataRemoteInputs","android.support.groupKey","android.support.isGroupSummary","android.support.localOnly","android.support.remoteInputs","android.support.sortKey","android.support.useSideChannel","android.template","android.text","android.textLines","android.title","android.title.big","android.tv.EXTENSIONS","android.verificationIcon","android.verificationIconCompat","android.verificationText","android.wearable.EXTENSIONS","androidx.core.app.extra.COMPAT_TEMPLATE");
    private static void notificationKeyCensus(Notification notification){
        if(diagnosticKeyCensusDone)return;diagnosticKeyCensusDone=true;
        try{
            Bundle extras=notification==null?null:notification.extras;
            if(extras==null){System.out.println("CUSTODIAL_NATIVE_NOTIFICATION_KEY_CENSUS count=0 overflow=false");return;}
            int count=extras.size();
            System.out.println("CUSTODIAL_NATIVE_NOTIFICATION_KEY_CENSUS count="+Math.min(count,32)+" overflow="+(count>32));
            if(count>32)return; // Do not enumerate/sort an already over-bound Bundle.
            var keys=new java.util.TreeSet<>(extras.keySet());
            int index=0;for(String key:keys){if(index>=32)break;
                Object value=extras.get(key);
                String name=DIAGNOSTIC_FRAMEWORK_EXTRA_NAMES.contains(key)?key:"OTHER";
                String kind=value==null?"NULL":value instanceof String?"STRING":value instanceof Boolean?"BOOLEAN":value instanceof Integer?"INTEGER":value instanceof Long?"LONG"
                    :value instanceof Number?"NUMBER":value instanceof CharSequence?"CHAR_SEQUENCE":value instanceof Bundle?"BUNDLE"
                    :value instanceof android.os.Parcelable?"PARCELABLE":value.getClass().isArray()?"ARRAY":"OTHER";
                System.out.println("CUSTODIAL_NATIVE_NOTIFICATION_KEY_CENSUS index="+(index++)+" name="+name+" kind="+kind);
            }
        }catch(Throwable censusUnavailable){/* Diagnostic only: original refusal still propagates. */}
    }
    private static void notificationDiagnostic(int stage,Notification notification,String key,Object value){
        if(diagnosticCount>=16)return;int ordinal=++diagnosticCount;
        try{
            String field="NONE";
            if(key!=null)field=switch(key){
                case "android.largeIcon"->"LARGE_ICON";case "android.largeIcon.big"->"LARGE_ICON_BIG";
                case "android.appInfo"->"APP_INFO";case "android.template"->"TEMPLATE";
                case "android.title"->"TITLE";case "android.text"->"TEXT";case "android.bigText"->"BIG_TEXT";
                case "android.title.big"->"TITLE_BIG";case "android.subText"->"SUB_TEXT";
                case "android.summaryText"->"SUMMARY_TEXT";case "android.infoText"->"INFO_TEXT";
                case "android.people"->"PEOPLE";case "android.people.list"->"PEOPLE_LIST";
                case "android.picture"->"PICTURE";case "android.pictureIcon"->"PICTURE_ICON";
                case "android.colorized"->"COLORIZED";case "android.showWhen"->"SHOW_WHEN";
                case "android.support.localOnly"->"SUPPORT_LOCAL_ONLY";case "android.support.groupKey"->"SUPPORT_GROUP_KEY";
                case "android.support.isGroupSummary"->"SUPPORT_GROUP_SUMMARY";case "android.support.useSideChannel"->"SUPPORT_SIDE_CHANNEL";
                case "androidx.core.app.extra.COMPAT_TEMPLATE"->"COMPAT_TEMPLATE";
                default->"OTHER";
            };
            String kind=value==null?"NULL":value instanceof String?"STRING":value instanceof Boolean?"BOOLEAN":value instanceof Integer?"INTEGER":value instanceof Long?"LONG"
                :value instanceof Number?"NUMBER":value instanceof CharSequence?"CHAR_SEQUENCE":value instanceof Bundle?"BUNDLE"
                :value instanceof android.os.Parcelable?"PARCELABLE":value.getClass().isArray()?"ARRAY":"OTHER";
            int views=notification==null?0:(notification.contentView!=null?1:0)|(notification.bigContentView!=null?2:0)
                |(notification.headsUpContentView!=null?4:0)|(notification.tickerView!=null?8:0)|(notification.publicVersion!=null?16:0);
            System.out.println("CUSTODIAL_NATIVE_NOTIFICATION_FIELDS_DIAGNOSTIC ordinal="+ordinal+" stage="+stage
                +" field="+field+" kind="+kind+" customViewsMask="+views);
        }catch(Throwable diagnosticUnavailable){/* Preserve the original failure/catch path. */}
    }
    private static final int MAX_OWNERS=4,MAX_GENERATIONS=1024,MAX_CALLS=32,MAX_RETAINED_CHARACTERS=4*1024*1024,MAX_SCOPE_CHARACTERS=1024*1024;
    private static final Map<CustodialNativeRuntime,Integer> retainedCharacters=new IdentityHashMap<>();
    private static void reserve(CustodialNativeRuntime owner,int count)throws VaultFailure {int previous=retainedCharacters.getOrDefault(owner,0);if(count<0||count>MAX_RETAINED_CHARACTERS-previous)throw unavailable();retainedCharacters.put(owner,previous+count);}
    private static final Map<CustodialNativeRuntime,Map<String,Entry>> owners=new IdentityHashMap<>();
    private static void monitor(){if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native notification writer fence missing");}
    private static VaultFailure unavailable(){return new VaultFailure(NativeRecurringTargetJournal.FAILURE);}

    private static final Map<CustodialNativeRuntime,Map<String,ScopeFence>> scopedOwners=new IdentityHashMap<>();
    private static final class ScopeFence {
        private volatile long revision;private volatile boolean unknown;
        void advance(){if(revision==Long.MAX_VALUE)unknown=true;else revision++;}
        void require(long expected)throws VaultFailure {if(unknown||revision!=expected)throw unavailable();}
    }
    private static ScopeFence scopeFence(CustodialNativeRuntime owner,NativeProviderPrincipal principal,String day)throws VaultFailure {
        monitor();Map<String,ScopeFence> scopes=scopedOwners.get(owner);
        if(scopes==null){if(scopedOwners.size()>=MAX_OWNERS)throw unavailable();scopes=new LinkedHashMap<>();scopedOwners.put(owner,scopes);}
        String key=principal.digest+":"+day;ScopeFence fence=scopes.get(key);
        if(fence==null){if(scopes.size()>=MAX_GENERATIONS)throw unavailable();fence=new ScopeFence();scopes.put(key,fence);}return fence;
    }
    static void beforeGeneration(CustodialNativeRuntime owner,NativeProviderPrincipal principal,String raw){
        monitor();if(owner==null||principal==null||raw==null)return;boolean owned=false;
        try {JSONObject notification=new JSONObject(raw);if(!notification.optString("group").startsWith("mz-custodial-owned:"))return;owned=true;
            JSONObject extra=notification.getJSONObject("extra");NativeProviderPrincipal claimed=NativeProviderPrincipal.fromNativeJournal(new JSONObject(extra.getString("native_presentation_principal")));
            if(!principal.same(claimed))return;String day=extra.getString("service_date");java.time.LocalDate.parse(day);
            scopeFence(owner,principal,day).advance();
        }catch(Exception unclassifiable){if(!owned)return;Map<String,ScopeFence> scopes=scopedOwners.get(owner);if(scopes!=null)for(ScopeFence fence:scopes.values())fence.unknown=true;}
    }

    /** Pure bounded sequence DATA. Native provenance is the separate private
     * Entry/Call constructors below, not this state model or its tests. */
    static final class Sequence {
        private volatile long revision;
        private volatile boolean unknown;
        private final ScopeFence scope;
        Sequence(){scope=null;}
        private Sequence(ScopeFence scope){this.scope=scope;}
        private void advancing(){if(scope!=null)scope.advance();}
        private final List<Step> steps=new ArrayList<>();
        static final class Step {
            final Operation operation;final long born;
            boolean returned,terminal;
            private Step(Operation operation,long born){this.operation=operation;this.born=born;}
        }
        Step before(Operation operation)throws VaultFailure {
            if(operation==null||unknown||steps.size()>=MAX_CALLS||revision==Long.MAX_VALUE){unknown=true;throw unavailable();}
            advancing();Step step=new Step(operation,++revision);steps.add(step);return step;
        }
        void returned(Step step)throws VaultFailure {
            if(unknown||step==null||!steps.contains(step)||step.returned){unknown=true;throw unavailable();}
            advancing();step.returned=true;if(revision==Long.MAX_VALUE){unknown=true;throw unavailable();}revision++;
        }
        void terminal()throws VaultFailure {
            if(unknown||steps.isEmpty())throw unavailable();
            for(Step step:steps)if(!step.returned){unknown=true;throw unavailable();}
            advancing();for(Step step:steps)step.terminal=true;
            if(revision==Long.MAX_VALUE){unknown=true;throw unavailable();}revision++;
        }
        void requireSettled(long expected)throws VaultFailure {
            if(unknown||revision!=expected||steps.isEmpty()){diagnostic("CAPTURE_SEQUENCE",0,this,0,0);throw unavailable();}
            for(Step step:steps)if(!step.returned||!step.terminal)throw unavailable();
        }
        void changed()throws VaultFailure {if(unknown||revision==Long.MAX_VALUE){unknown();throw unavailable();}advancing();revision++;}
        long revision(){return revision;}
        void unknown(){advancing();unknown=true;if(revision!=Long.MAX_VALUE)revision++;}
        void requireReadOnly(long expected)throws VaultFailure {if(unknown||revision!=expected)throw unavailable();}
    }
    private static final class Entry {
        final CustodialNativeRuntime owner;
        final NativeRecurringTargetJournal.BornEffect original;
        final Sequence sequence;final List<Call> calls=new ArrayList<>();
        final Map<PendingIntent,PendingOrigin> pending=new java.util.LinkedHashMap<>();
        NativeRecurringTargetJournal.KnownEffect terminal;
        Entry(CustodialNativeRuntime owner,NativeRecurringTargetJournal.BornEffect original,ScopeFence scope){this.owner=owner;this.original=original;sequence=new Sequence(scope);}
    }
    enum IntentKind { ACTIVITY_ACTION, DELETE_BROADCAST, ALARM_BROADCAST }
    private static final class PendingOrigin {
        final PendingIntent actual;final String data;
        private PendingOrigin(PendingIntent actual,String data){this.actual=actual;this.data=data;}
    }
    static final class PendingCreation {
        private final Entry entry;private final Sequence.Step step;private final Thread thread=Thread.currentThread();
        private final int id,requestCode,flags;private final IntentKind kind;private final android.content.Intent intent;
        private final String planned;private boolean recorded;
        private PendingCreation(Entry entry,Sequence.Step step,int id,android.content.Intent intent,int requestCode,int flags,IntentKind kind,String planned){
            this.entry=entry;this.step=step;this.id=id;this.intent=intent;this.requestCode=requestCode;this.flags=flags;this.kind=kind;this.planned=planned;
        }
    }
    static PendingCreation pendingIntentStarting(CustodialNativeRuntime owner,String generation,int id,android.content.Intent intent,int requestCode,int flags,IntentKind kind){
        monitor();if(owner==null||generation==null)return null;Entry entry=null;int diagnosticStage=0;
        try {
            entry=entry(owner,generation);diagnosticStage=1;entry.sequence.changed();entry.terminal=null;
            if(entry.original.id!=id||intent==null||intent.getClass()!=android.content.Intent.class||intent.getComponent()==null)throw unavailable();
            diagnosticStage=2;String planned=describeIntent(entry,generation,id,intent,requestCode,flags,kind);
            diagnosticStage=3;if(planned.length()>32768)throw unavailable();
            // A pending step exists BEFORE getActivity/getBroadcast. A throw,
            // null return, missing record or duplicate never settles it later.
            diagnosticStage=4;return new PendingCreation(entry,entry.sequence.before(Operation.PENDING_INTENT_FACTORY),id,intent,requestCode,flags,kind,planned);
        }catch(Exception unsupported){diagnostic("PI_START",diagnosticStage,entry);if(entry!=null)entry.sequence.unknown();return null;}
    }
    private static String describeIntent(Entry entry,String generation,int id,android.content.Intent intent,int requestCode,int flags,IntentKind kind)throws Exception {
        Bundle extras=intent.getExtras();if(extras==null||extras.getInt("LocalNotificationId",Integer.MIN_VALUE)!=id)throw unavailable();
        java.util.Set<String> keys=new java.util.TreeSet<>(extras.keySet());JSONObject payload=new JSONObject();
        if(kind==IntentKind.ACTIVITY_ACTION){
            if(!keys.equals(java.util.Set.of("LocalNotificationId","LocalNotficationObject","LocalNotificationUserAction","LocalNotificationRepeating"))
                ||!entry.original.rawNotification.equals(extras.get("LocalNotficationObject"))
                ||!(extras.get("LocalNotificationUserAction") instanceof String)||!(extras.get("LocalNotificationRepeating") instanceof Boolean))throw unavailable();
            payload.put("action",extras.get("LocalNotificationUserAction")).put("removable",extras.get("LocalNotificationRepeating"))
                .put("raw_sha256",NativeProviderPrincipal.hash(entry.original.rawNotification));
        }else if(kind==IntentKind.DELETE_BROADCAST){
            if(!keys.equals(java.util.Set.of("LocalNotificationId","LocalNotificationUserAction","LocalNotificationRepeating"))
                ||!"dismiss".equals(extras.get("LocalNotificationUserAction"))||!(extras.get("LocalNotificationRepeating") instanceof Boolean)
                ||!"com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver".equals(intent.getComponent().getClassName()))throw unavailable();
            payload.put("action","dismiss").put("removable",extras.get("LocalNotificationRepeating"));
        }else {
            if(!keys.equals(java.util.Set.of("LocalNotificationId",CustodialNativeNotificationWriter.GENERATION_EXTRA,"NotificationPublisher.notification"))
                ||!generation.equals(extras.get(CustodialNativeNotificationWriter.GENERATION_EXTRA))
                ||!"com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher".equals(intent.getComponent().getClassName()))throw unavailable();
            Object notification=extras.get("NotificationPublisher.notification");if(!(notification instanceof Notification))throw unavailable();
            payload.put("generation",generation).put("notification",NotificationFields.capture((Notification)notification).data);
        }
        JSONArray categories=new JSONArray();if(intent.getCategories()!=null){if(intent.getCategories().size()>16)throw unavailable();for(String category:new java.util.TreeSet<>(intent.getCategories()))categories.put(category);}
        String data=new JSONObject().put("kind",kind.name()).put("request_code",requestCode).put("pending_flags",flags)
            .put("component",intent.getComponent().flattenToString()).put("intent_flags",intent.getFlags())
            .put("action",intent.getAction()==null?JSONObject.NULL:intent.getAction()).put("categories",categories)
            .put("data_uri",intent.getDataString()==null?JSONObject.NULL:intent.getDataString()).put("payload",payload).toString();
        return data;
    }
    static void recordIntent(PendingCreation creation,PendingIntent actual) {
        monitor();if(creation==null)return;Entry entry=creation.entry;int diagnosticStage=0;
        try {
            if(creation.recorded||creation.thread!=Thread.currentThread()||actual==null||actual.getCreatorUid()!=android.os.Process.myUid())throw unavailable();
            diagnosticStage=1;creation.recorded=true;
            String data=describeIntent(entry,entry.original.generation,creation.id,creation.intent,creation.requestCode,creation.flags,creation.kind);
            diagnosticStage=2;if(!creation.planned.equals(data))throw unavailable();PendingOrigin prior=entry.pending.get(actual);
            if(prior!=null&&!prior.data.equals(data)||prior==null&&entry.pending.size()>=64)throw unavailable();
            diagnosticStage=3;if(prior==null)reserve(entry.owner,data.length()+256);entry.sequence.changed();entry.pending.put(actual,new PendingOrigin(actual,data));
            diagnosticStage=4;entry.sequence.returned(creation.step);entry.terminal=null;
        }catch(Exception unsupported){diagnostic("PI_RETURN",diagnosticStage,entry);entry.sequence.unknown();}
    }
    static final class Call {
        private final Entry entry;private final Sequence.Step step;private final Thread thread=Thread.currentThread();
        private final NotificationFields notification;private final Notification originalNotification;private final PendingIntent alarmIntent;
        private final int alarmType,pendingIntentFlags;private final long trigger;
        private Call(Entry entry,Sequence.Step step,NotificationFields notification,Notification originalNotification,PendingIntent alarmIntent,int alarmType,long trigger,int flags){
            this.entry=entry;this.step=step;this.notification=notification;this.originalNotification=originalNotification;this.alarmIntent=alarmIntent;this.alarmType=alarmType;this.trigger=trigger;pendingIntentFlags=flags;
        }
    }
    static void observeGeneration(CustodialNativeRuntime owner,NativeRecurringTargetJournal.BornEffect actual) {
        monitor();if(owner==null||actual==null)return;String generation=actual.generation;
        try {
            Map<String,Entry> index=owners.get(owner);
            if(index==null){if(owners.size()>=MAX_OWNERS)return;index=new LinkedHashMap<>();owners.put(owner,index);}
            if(index.containsKey(generation)){index.get(generation).sequence.unknown();return;}
            if(index.size()>=MAX_GENERATIONS)return;
            reserve(owner,actual.rawNotification.length()+2048);ScopeFence fence=scopeFence(owner,actual.principal,actual.serviceDate);fence.advance();index.put(generation,new Entry(owner,actual,fence));
        }catch(Exception absentOrUnknown){/* Additional DATA never changes the original operation. Missing index refuses later. */}
    }
    private static Entry entry(CustodialNativeRuntime owner,String generation)throws VaultFailure {
        monitor();Map<String,Entry> index=owners.get(owner);Entry entry=index==null?null:index.get(generation);
        if(entry==null||entry.owner!=owner)throw unavailable();return entry;
    }
    static int idForGeneration(CustodialNativeRuntime owner,String generation)throws VaultFailure {return entry(owner,generation).original.id;}
    static String generationForId(CustodialNativeRuntime owner,int id) {
        monitor();Map<String,Entry> index=owners.get(owner);if(index==null)return null;String found=null;
        for(Entry entry:index.values())if(entry.original.id==id){if(found!=null)return null;found=entry.original.generation;}
        return found;
    }
    static Call before(CustodialNativeRuntime owner,String generation,int id,Operation operation,Notification notification,
        PendingIntent alarmIntent,int alarmType,long trigger,int flags) {
        monitor();if(generation==null||owner==null)return null;Entry entry=null;int diagnosticStage=0;
        try {
            entry=entry(owner,generation);diagnosticStage=1;if(entry.original.id!=id)throw unavailable();
            // No new persistence/principal callbacks between the ORIGINAL last
            // normal guard and its API. Final DATA capture rereads actual rows.

            diagnosticStage=2;NotificationFields fields=notification==null?null:NotificationFields.capture(notification);
            diagnosticStage=3;if(fields!=null)for(PendingIntent intent:fields.intents)if(!entry.pending.containsKey(intent))throw unavailable();
            if(alarmIntent!=null&&operation!=Operation.CANCEL_ALARM&&!entry.pending.containsKey(alarmIntent))throw unavailable();
            diagnosticStage=4;boolean alarm=operation==Operation.ALARM_SET||operation==Operation.ALARM_SET_IDLE||operation==Operation.ALARM_EXACT||operation==Operation.ALARM_EXACT_IDLE;
            if(operation==Operation.NOTIFY&&fields==null||alarm&&(fields==null||alarmIntent==null||trigger<1)
                ||operation==Operation.CANCEL_ALARM&&alarmIntent==null)throw unavailable();
            diagnosticStage=5;reserve(owner,(fields==null?0:fields.data.length())+512);Call call=new Call(entry,entry.sequence.before(operation),fields,notification,alarmIntent,alarmType,trigger,flags);entry.calls.add(call);entry.terminal=null;
            return call; // Installed BEFORE the actual original API, never afterwards.
        }catch(Exception unsupported){diagnostic("CALL_START",diagnosticStage,entry);if(entry!=null)entry.sequence.unknown();return null;}
    }
    static void returned(Call call) {
        monitor();if(call==null)return;
        int diagnosticStage=0;
        try{if(call.thread!=Thread.currentThread()||call.notification!=null&&!call.notification.same(NotificationFields.capture(call.originalNotification)))throw unavailable();diagnosticStage=1;call.entry.sequence.returned(call.step);}
        catch(Exception unknown){diagnostic("CALL_RETURN",diagnosticStage,call.entry);call.entry.sequence.unknown();}
    }
    static void requireCallCoverage(String state,Operation last)throws VaultFailure {
        boolean alarm=last==Operation.ALARM_SET||last==Operation.ALARM_SET_IDLE||last==Operation.ALARM_EXACT||last==Operation.ALARM_EXACT_IDLE;
        if(("SCHEDULE_CALLED".equals(state)||"RESTORE_CALLED".equals(state))&&alarm)return;
        if("DISPATCH_CALLED".equals(state)&&last==Operation.NOTIFY)return;
        if("CANCEL_CALLED".equals(state)&&(last==Operation.CANCEL_NOTIFICATION||last==Operation.CANCEL_ALARM))return;
        throw unavailable();
    }
    static void terminal(CustodialNativeRuntime owner,String generation) {
        monitor();if(owner==null||generation==null)return;Entry entry=null;int diagnosticStage=0;
        try {
            entry=entry(owner,generation);diagnosticStage=1;NativeRecurringTargetJournal.KnownEffect actual=owner.notificationMutationJournal().readKnownEffect(entry.original.principal,entry.original.serviceDate,generation);
            diagnosticStage=2;if(!entry.original.sameOriginal(actual)||!actual.state.endsWith("_CALLED")
                ||!actual.principal.same(owner.readNotificationMutationPrincipal()))throw unavailable();
            // Last normal journal/principal callbacks have already returned.
            // Read exact durable original once more before retaining DATA.
            diagnosticStage=3;NativeRecurringTargetJournal.KnownEffect last=owner.notificationMutationJournal().readKnownEffect(entry.original.principal,entry.original.serviceDate,generation);
            if(!actual.recordText.equals(last.recordText)||!actual.targetText.equals(last.targetText))throw unavailable();
            diagnosticStage=4;if(entry.calls.isEmpty())throw unavailable();requireCallCoverage(actual.state,entry.calls.get(entry.calls.size()-1).step.operation);
            diagnosticStage=5;entry.sequence.terminal();entry.terminal=last;
        }catch(Exception unknown){diagnostic("TERMINAL",diagnosticStage,entry);if(entry!=null)entry.sequence.unknown();}
    }
    /** Immutable one-use read, not an exclusion lease. Future18b must retain its
     * exact17 owner and recheck this after callbacks, then its native scalar
     * Source/issue fence. No monitor may be held across UI/HTTP. */
    static final class ScopeRead implements AutoCloseable {
        private final CustodialNativeRuntime owner;private final NativeProviderPrincipal principal;
        private final String day,data;private final Map<Entry,Long> versions;private final Map<String,String> originalRows;private volatile boolean consumed,retired;
        private final ScopeFence fence;private final long fenceRevision;
        private final NativeRecurringApplicationSource source;private final NativeRecurringApplicationSource.CallbackHold hold;
        private ScopeRead(CustodialNativeRuntime owner,NativeProviderPrincipal principal,String day,String data,Map<Entry,Long> versions,Map<String,String> originalRows,ScopeFence fence,long fenceRevision,NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold){
            this.owner=owner;this.principal=principal;this.day=day;this.data=data;this.versions=Collections.unmodifiableMap(versions);this.originalRows=Map.copyOf(originalRows);this.fence=fence;this.fenceRevision=fenceRevision;this.source=source;this.hold=hold;
        }
        Map<String,String> originalRows(){return originalRows;} // DATA only; final18b Store fence must use the actual protected observation.
        String consumeData()throws VaultFailure {monitor();if(consumed||retired)throw unavailable();consumed=true;requireNativeFenceReadOnly();requireVersions();return data;}
        /** Callback-free/no Writer monitor acquisition: safe for a later Engine
         * scalar fence, NEVER a lease or check-to-CAS exclusion guarantee. */
        void requireNativeFenceReadOnly()throws VaultFailure {if(!consumed||retired)throw unavailable();hold.requireNativeWriterLeaseLifetime(source);fence.require(fenceRevision);for(var version:versions.entrySet())version.getKey().sequence.requireReadOnly(version.getValue());}
        void requireUnchanged(Context context,NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold)throws VaultFailure {
            monitor();if(source!=this.source||hold!=this.hold)throw unavailable();requireNativeFenceReadOnly();requireVersions();
            ScopeRead fresh=capture(context,owner,principal,day,source,hold);
            if(!data.equals(fresh.data))throw unavailable();requireVersions();requireNativeFenceReadOnly();
        }
        @Override public void close(){retired=true;}
        private void requireVersions()throws VaultFailure {for(var version:versions.entrySet())version.getKey().sequence.requireSettled(version.getValue());}
    }
    static ScopeRead capture(Context context,CustodialNativeRuntime owner,NativeProviderPrincipal principal,String day,
        NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold)throws VaultFailure {
        monitor();try {
            if(context==null||owner==null||principal==null||source==null||hold==null||Thread.holdsLock(owner.engine)
                ||CustodialNativeRuntime.get(context.getApplicationContext())!=owner)throw unavailable();
            hold.requireNativeWriterLeaseLifetime(source);
            if(!principal.same(owner.readNotificationMutationPrincipal()))throw unavailable();
            ScopeFence fence=scopeFence(owner,principal,day);long fenceRevision=fence.revision;
            Map<String,NativeRecurringTargetJournal.KnownEffect> scope=owner.notificationMutationJournal().readOrdinaryEffectScope(principal,day);
            // Every already-born relevant native entry must remain represented.
            // Removing its durable row cannot manufacture an empty first use.
            Map<String,Entry> indexed=owners.get(owner);
            if(indexed!=null)for(Entry existing:indexed.values())if(principal.same(existing.original.principal)
                &&day.equals(existing.original.serviceDate)&&!scope.containsKey(existing.original.generation))throw unavailable();
            // Empty is a bounded CURRENT observation, never historical alarm
            // inventory. The installed18a03 publisher refuses old owned null
            // generations; nonnull callbacks retain all old durable guards.
            boolean emptyCurrent=scope.isEmpty();
            Map<Entry,Long> versions=new IdentityHashMap<>();Map<Integer,Entry> relevant=new TreeMap<>();JSONArray generations=new JSONArray();
            for(var actual:scope.values()) {
                Entry entry=entry(owner,actual.generation);long revision=entry.sequence.revision();entry.sequence.requireSettled(revision);
                if(!entry.original.sameOriginal(actual)||entry.terminal==null||!entry.terminal.recordText.equals(actual.recordText)
                    ||!entry.terminal.targetText.equals(actual.targetText)||relevant.put(actual.id,entry)!=null)throw unavailable();
                versions.put(entry,revision);JSONArray calls=new JSONArray();
                for(Call call:entry.calls)calls.put(new JSONObject().put("operation",call.step.operation.name())
                    .put("returned",true).put("notification",call.notification==null?JSONObject.NULL:call.notification.data)
                    .put("alarm_type",call.alarmType).put("trigger",call.trigger).put("pending_intent_flags",call.pendingIntentFlags)
                    .put("pending_intent_creator_uid",call.alarmIntent==null?JSONObject.NULL:call.alarmIntent.getCreatorUid())
                    .put("alarm_delivery_proven",false));
                JSONArray pendingOrigins=new JSONArray();for(PendingOrigin pending:entry.pending.values())pendingOrigins.put(pending.data);
                generations.put(new JSONObject().put("generation",actual.generation).put("id",actual.id).put("group",actual.group)
                    .put("raw_sha256",NativeProviderPrincipal.hash(actual.rawNotification)).put("target_reference",actual.targetReference)
                    .put("record_sha256",NativeProviderPrincipal.hash(actual.recordText)).put("state",actual.state).put("calls",calls).put("original_pending_intents",pendingOrigins));
            }
            String visible=observeVisible(context,owner,principal,day,relevant);
            if(!principal.same(owner.readNotificationMutationPrincipal()))throw unavailable();
            Map<String,NativeRecurringTargetJournal.KnownEffect> last=owner.notificationMutationJournal().readOrdinaryEffectScope(principal,day);
            if(!sameRows(scope,last)||!visible.equals(observeVisible(context,owner,principal,day,relevant)))throw unavailable();
            hold.requireNativeWriterLeaseLifetime(source);
            for(var version:versions.entrySet())version.getKey().sequence.requireSettled(version.getValue());fence.require(fenceRevision);
            JSONObject observed=new JSONObject().put("schema",emptyCurrent?"custodial.native-ordinary-empty-current-observation.v1":"custodial.native-ordinary-effect-call-data.v1")
                .put("principal_sha256",principal.digest).put("service_date",day).put("generations",generations).put("visible",new JSONObject(visible))
                .put("alarm_scope",emptyCurrent?"CURRENT_OWNED_PUBLISHER_GENERATION_GUARDS_NOT_HISTORICAL_ALARM_INVENTORY":
                    "ORIGINAL_REGISTRATION_RETURN_AND_UNMUTATED_KNOWN_GENERATION_NOT_DELIVERY_OR_FULL_ALARM_INVENTORY")
                .put("receipt_eligible",false);
            if(emptyCurrent)observed.put("empty_current_observation",true).put("historical_alarm_inventory_proven",false)
                .put("alarm_delivery_proven",false).put("legacy_owned_generationless_dispatch","REFUSED_BY_CURRENT_REGISTERED_NATIVE_RUNTIME_PUBLISHER");
            String data=observed.toString();
            if(data.length()>MAX_SCOPE_CHARACTERS)throw unavailable();
            Map<String,String> rows=new TreeMap<>();for(var known:scope.values()){rows.put(NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(known.generation),known.recordText);rows.put(known.targetReference,known.targetText);}
            return new ScopeRead(owner,principal,day,data,versions,rows,fence,fenceRevision,source,hold);
        }catch(VaultFailure refused){throw refused;}catch(Exception unknown){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,unknown);}
    }
    private static boolean sameRows(Map<String,NativeRecurringTargetJournal.KnownEffect> a,Map<String,NativeRecurringTargetJournal.KnownEffect> b){
        if(!a.keySet().equals(b.keySet()))return false;for(String key:a.keySet())if(!a.get(key).recordText.equals(b.get(key).recordText)
            ||!a.get(key).targetText.equals(b.get(key).targetText))return false;return true;
    }
    private static String observeVisible(Context context,CustodialNativeRuntime owner,NativeProviderPrincipal principal,String day,Map<Integer,Entry> relevant)throws Exception {
        Map<String,?> raw=context.getSharedPreferences("NOTIFICATION_STORE",Context.MODE_PRIVATE).getAll();if(raw.size()>4096)throw unavailable();
        JSONObject retained=new JSONObject();
        for(var value:new TreeMap<>(raw).entrySet()) {
            Entry entry=null;try{entry=relevant.get(Integer.valueOf(value.getKey()));}catch(NumberFormatException foreign){}
            if(entry!=null){if(!(value.getValue() instanceof String)||!entry.original.rawNotification.equals(value.getValue()))throw unavailable();retained.put(value.getKey(),value.getValue());continue;}
            if(!(value.getValue() instanceof String))throw unavailable();
            JSONObject row=new JSONObject((String)value.getValue());
            if(!row.optString("group").startsWith("mz-custodial-owned:"))continue;
            JSONObject extra=row.getJSONObject("extra");NativeProviderPrincipal other=NativeProviderPrincipal.fromNativeJournal(new JSONObject(extra.getString("native_presentation_principal")));
            if(principal.same(other)&&day.equals(extra.getString("service_date")))throw unavailable(); // Relevant old raw with no genuine index.
        }
        for(Entry entry:relevant.values())if(("SCHEDULE_CALLED".equals(entry.terminal.state)||"RESTORE_CALLED".equals(entry.terminal.state))
            &&!retained.has(String.valueOf(entry.original.id)))throw unavailable();
        NotificationManager manager=context.getSystemService(NotificationManager.class);if(manager==null)throw unavailable();
        var active=manager.getActiveNotifications();if(active==null||active.length>256)throw unavailable();
        for(var row:active)if(row==null)throw unavailable();
        java.util.Arrays.sort(active,java.util.Comparator.comparingInt(android.service.notification.StatusBarNotification::getId)
            .thenComparing(row->row.getTag()==null?"":row.getTag()));JSONObject visible=new JSONObject();
        for(var row:active){
            if(row==null||row.getNotification()==null||row.getUid()!=context.getApplicationInfo().uid||!context.getPackageName().equals(row.getPackageName()))throw unavailable();
            Entry entry=relevant.get(row.getId());
            if(entry==null){if(row.getNotification().getGroup()!=null&&row.getNotification().getGroup().startsWith("mz-custodial-owned:")
                &&!knownOtherScope(owner,principal,day,row.getId(),row.getNotification().getGroup()))throw unavailable();continue;}
            if(row.getTag()!=null||!entry.original.group.equals(row.getNotification().getGroup()))throw unavailable();
            Call last=null;for(Call call:entry.calls)if(call.step.operation==Operation.NOTIFY||call.step.operation==Operation.CANCEL_NOTIFICATION)last=call;
            if(last==null||last.step.operation!=Operation.NOTIFY||last.notification==null)throw unavailable();
            NotificationFields actual=NotificationFields.capture(row.getNotification());if(!last.notification.same(actual))throw unavailable();
            if(visible.has(String.valueOf(row.getId())))throw unavailable();visible.put(String.valueOf(row.getId()),actual.data);
        }
        // A returned notify must have an actual semantic readback; cancellation
        // must be absent. User/service mutation makes this unavailable, not retryable.
        for(Entry entry:relevant.values()){
            Call last=null;for(Call call:entry.calls)if(call.step.operation==Operation.NOTIFY||call.step.operation==Operation.CANCEL_NOTIFICATION)last=call;
            if(last!=null&&last.step.operation==Operation.NOTIFY&&!visible.has(String.valueOf(entry.original.id)))throw unavailable();
        }
        android.app.AlarmManager alarms=context.getSystemService(android.app.AlarmManager.class);if(alarms==null)throw unavailable();
        boolean exactAllowed=android.os.Build.VERSION.SDK_INT<31||alarms.canScheduleExactAlarms();
        return new JSONObject().put("raw",retained).put("active",visible).put("native_notifications_enabled",manager.areNotificationsEnabled())
            .put("exact_alarm_permission_current",exactAllowed).toString();
    }
    private static boolean knownOtherScope(CustodialNativeRuntime owner,NativeProviderPrincipal principal,String day,int id,String group){
        Map<String,Entry> index=owners.get(owner);if(index==null)return false;
        for(Entry entry:index.values())if(entry.original.id==id&&entry.original.group.equals(group))return !principal.same(entry.original.principal)||!day.equals(entry.original.serviceDate);
        return false;
    }

    /** Exact selected Notification semantics + actual PendingIntent identities.
     * Unsupported custom views/actions remain UNKNOWN; there is no raw JSON
     * constructor or arbitrary Parcelable/Bundle serializer. */
    private static final class NotificationFields {
        final String data;final List<PendingIntent> intents;
        private NotificationFields(String data,List<PendingIntent> intents){this.data=data;this.intents=List.copyOf(intents);}
        boolean same(NotificationFields other){return other!=null&&data.equals(other.data)&&intents.equals(other.intents);}
        static NotificationFields capture(Notification n)throws Exception {
            int fieldStage=0;String fieldKey=null;Object fieldValue=null;
            try{
            if(n==null||n.getClass()!=Notification.class||n.contentView!=null||n.bigContentView!=null||n.headsUpContentView!=null||n.tickerView!=null||n.publicVersion!=null)throw unavailable();
            fieldStage=1;List<PendingIntent> intents=new ArrayList<>();JSONObject v=new JSONObject();
            java.util.Set<String> selected=java.util.Set.of("android.title","android.text","android.bigText","android.subText","android.summaryText","android.infoText");
            fieldStage=2;if(n.extras!=null){if(n.extras.size()>32)throw unavailable();for(String key:new java.util.TreeSet<>(n.extras.keySet())){
                fieldStage=3;fieldKey=key;if(selected.contains(key))continue;Object value=n.extras.get(key);fieldValue=value;
                // The normal compatibility builder writes an explicit null
                // largeIcon. Absent and null both mean no icon; a real icon
                // remains unsupported here AND in getLargeIcon() below.
                if("android.largeIcon".equals(key)){if(value!=null)throw unavailable();continue;}
                // The normal framework builder records null remote-input history.
                // Absent and null both mean no history; every nonnull value
                // remains unsupported rather than being dropped or serialized.
                if("android.remoteInputHistory".equals(key)){if(value!=null)throw unavailable();continue;}
                if("android.appInfo".equals(key)){if(value==null||value.getClass()!=android.content.pm.ApplicationInfo.class)throw unavailable();continue;}
                if("android.template".equals(key)){if(!(value instanceof String)||((String)value).length()>256)throw unavailable();v.put(key,value);continue;}
                if("android.reduced.images".equals(key)||"android.showWhen".equals(key)||"android.showChronometer".equals(key)||"android.chronometerCountDown".equals(key)||"android.progressIndeterminate".equals(key)){
                    if(!(value instanceof Boolean))throw unavailable();v.put(key,value);continue;
                }
                if("android.progress".equals(key)||"android.progressMax".equals(key)){if(!(value instanceof Integer))throw unavailable();v.put(key,value);continue;}
                if("android.textLines".equals(key)){
                    if(!(value instanceof CharSequence[])||((CharSequence[])value).length>32)throw unavailable();JSONArray lines=new JSONArray();
                    for(CharSequence line:(CharSequence[])value){if(line==null||line.getClass()!=String.class||line.length()>4096)throw unavailable();lines.put(line.toString());}v.put(key,lines);continue;
                }
                // A bitmap/Parcelable/custom style is not silently reduced to
                // an identity digest or retained as an unbounded object graph.
                throw unavailable();
            }}
            fieldStage=4;fieldKey=null;fieldValue=null;for(String key:new String[]{"android.title","android.text","android.bigText","android.subText","android.summaryText","android.infoText"}){
                fieldKey=key;Object value=n.extras==null?null:n.extras.get(key);fieldValue=value;if(value!=null&&value.getClass()!=String.class&&value.getClass()!=android.text.SpannedString.class&&value.getClass()!=android.text.SpannableString.class)throw unavailable();
                String text=value==null?null:value.toString();if(text!=null&&text.length()>16384)throw unavailable();v.put(key,text==null?JSONObject.NULL:text);
            }
            fieldStage=5;fieldKey=null;fieldValue=null;v.put("group",n.getGroup()).put("sort_key",n.getSortKey()).put("channel",n.getChannelId()).put("category",n.category)
                .put("flags",n.flags).put("priority",n.priority).put("visibility",n.visibility).put("color",n.color).put("number",n.number)
                .put("when",n.when).put("sound",n.sound==null?JSONObject.NULL:n.sound.toString()).put("defaults",n.defaults);
            fieldStage=6;JSONArray vibrate=new JSONArray();if(n.vibrate!=null){if(n.vibrate.length>64)throw unavailable();for(long value:n.vibrate)vibrate.put(value);}v.put("vibrate",vibrate);
            fieldStage=7;putIntent(v,"content",n.contentIntent,intents);putIntent(v,"delete",n.deleteIntent,intents);putIntent(v,"fullscreen",n.fullScreenIntent,intents);
            fieldStage=8;JSONArray actions=new JSONArray();if(n.actions!=null){if(n.actions.length>16)throw unavailable();for(Notification.Action action:n.actions){
                if(action==null||action.title==null||action.title.getClass()!=String.class&&action.title.getClass()!=android.text.SpannedString.class&&action.title.getClass()!=android.text.SpannableString.class||action.title.length()>4096||action.getRemoteInputs()!=null&&action.getRemoteInputs().length!=0)throw unavailable();
                JSONObject a=new JSONObject().put("title",action.title.toString()).put("semantic",action.getSemanticAction()).put("generated_replies",action.getAllowGeneratedReplies());
                putIntent(a,"action",action.actionIntent,intents);actions.put(a);
            }}v.put("actions",actions);
            fieldStage=9;if(n.audioAttributes!=null)v.put("audio_usage",n.audioAttributes.getUsage()).put("audio_content_type",n.audioAttributes.getContentType()).put("audio_flags",n.audioAttributes.getFlags());
            fieldStage=10;if(n.getSmallIcon()!=null){var icon=n.getSmallIcon();if(icon.getType()!=android.graphics.drawable.Icon.TYPE_RESOURCE)throw unavailable();v.put("small_icon_package",icon.getResPackage()).put("small_icon_id",icon.getResId());}
            fieldStage=11;if(n.getLargeIcon()!=null)throw unavailable();
            fieldStage=12;String encoded=v.toString();if(encoded.length()>65536)throw unavailable();return new NotificationFields(encoded,intents);
            }catch(Exception originalFailure){notificationKeyCensus(n);notificationDiagnostic(fieldStage,n,fieldKey,fieldValue);throw originalFailure;}
        }
        private static void putIntent(JSONObject value,String key,PendingIntent intent,List<PendingIntent> intents)throws Exception {
            if(intent==null){value.put(key,JSONObject.NULL);return;}
            int index=intents.size();intents.add(intent);value.put(key,new JSONObject().put("index",index).put("creator_uid",intent.getCreatorUid()).put("creator_package",intent.getCreatorPackage()).put("immutable",intent.isImmutable()));
        }
    }
}
