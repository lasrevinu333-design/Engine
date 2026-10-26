package org.memphiszoo.custodial.vault;

import android.content.Context;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Native short-CAS lifetime only. This type is not an OS/audio settlement,
 * receipt/transport capability, installed Current or public admission factory.
 * Its only birth consumes the actual native18a read and fixed Engine17 owner. */
final class NativeRecurringOrdinaryCommitPermit {
    private static NativeRecurringOrdinaryCommitPermit active;
    private final CustodialNativeRuntime runtime;
    private final NativeRecurringApplicationSource source;
    private final NativeRecurringApplicationSource.CallbackHold hold;
    private final NativeRecurringOrdinaryEffectProducer.ScopeRead effects;
    private final String originalNativeData,principalSha,day;
    private final Set<Integer> ids=new HashSet<>();
    private final Set<String> generations=new HashSet<>();
    private boolean poisoned,retired;
    private NativeRecurringOrdinaryCommitPermit(CustodialNativeRuntime runtime,
        NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold,
        NativeRecurringOrdinaryEffectProducer.ScopeRead effects,String nativeData)throws VaultFailure {
        this.runtime=runtime;this.source=source;this.hold=hold;this.effects=effects;originalNativeData=nativeData;
        try {
            JSONObject value=ProviderWireJson.object(nativeData.getBytes(java.nio.charset.StandardCharsets.UTF_8),1048576);
            if(!java.util.Set.of("custodial.native-ordinary-effect-call-data.v1","custodial.native-ordinary-empty-current-observation.v1").contains(value.get("schema"))
                ||!Boolean.FALSE.equals(value.get("receipt_eligible")))throw pending();
            principalSha=value.getString("principal_sha256");day=value.getString("service_date");
            if(!principalSha.matches("[a-f0-9]{64}")||!day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw pending();
            java.time.LocalDate.parse(day);var rows=value.getJSONArray("generations");
            if(rows.length()>1024)throw pending();
            for(int n=0;n<rows.length();n++){
                JSONObject row=rows.getJSONObject(n);Object id=row.get("id");
                if(!(id instanceof Integer||id instanceof Long)||((Number)id).longValue()<1||((Number)id).longValue()>Integer.MAX_VALUE
                    ||!ids.add(((Number)id).intValue())||!generations.add(row.getString("generation")))throw pending();
            }
        }catch(VaultFailure failure){throw failure;}catch(Exception unknown){throw pending();}
    }
    /** Fixed actual native call; no callback/Runnable or caller supplied ready
     * verdict. Caller must finish asynchronous UI work before entering here. */
    static VaultEngine.NativeOrdinaryRecurringAttempt retain(Context context,CustodialNativeRuntime runtime,
        VaultEngine.NativeOrdinaryRecurringRead read,NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold,NativeRecurringOrdinaryEffectProducer.ScopeRead effects)throws VaultFailure {
        if(context==null||runtime==null||read==null||source==null||hold==null||effects==null
            ||Thread.holdsLock(runtime.engine))throw pending();
        synchronized(CustodialNativeNotificationWriter.class){
            if(active!=null||CustodialNativeRuntime.get(context.getApplicationContext())!=runtime)throw pending();
            CustodialNativeNotificationWriter.requireOrdinaryCommitQuiescent();
            String data=effects.consumeData();effects.requireUnchanged(context,source,hold);
            NativeRecurringOrdinaryCommitPermit permit=new NativeRecurringOrdinaryCommitPermit(runtime,source,hold,effects,data);
            active=permit;
            try {
                // Fixed Engine implementation must independently require its
                // actual17 owner and semantic effects before durable retention.
                return runtime.engine.retainOrdinaryRecurringAttemptData(read,permit);
            }finally{permit.retired=true;if(active==permit)active=null;}
        }
    }
    void requireCurrent()throws VaultFailure {
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class)||active!=this||retired||poisoned)throw pending();
        hold.requireNativeWriterLeaseLifetime(source);effects.requireNativeFenceReadOnly();
        if(active!=this||retired||poisoned)throw pending();
    }
    String nativeData()throws VaultFailure {requireCurrent();return originalNativeData;}
    java.util.Map<String,String> originalRows()throws VaultFailure {requireCurrent();return effects.originalRows();}
    void requireOriginal(CustodialNativeRuntime expected,NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold,String principal,String day)throws VaultFailure {
        requireCurrent();if(runtime!=expected||this.source!=source||this.hold!=hold||!principalSha.equals(principal)||!this.day.equals(day))throw pending();
    }
    /** The existing generic vendor entry has not parsed its target set yet.
     * During this short native CAS only, such a reentrant unknown set conflicts.
     * No monitor is held across UI/HTTP; unrelated WORK/NFC is never frozen. */
    static void beforeUnclassifiedEntry()throws VaultFailure {
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native notification writer fence missing");
        NativeRecurringOrdinaryCommitPermit permit=active;if(permit==null||permit.retired)return;
        try{permit.hold.requireNativeWriterLeaseLifetime(permit.source);}
        catch(VaultFailure withdrawn){permit.poisoned=true;permit.retired=true;return;}
        permit.poisoned=true;throw pending();
    }
    /** Actual native hooks call before journal/PI/API mutation. Relevant and
     * unclassifiable entry poison before throwing; catches cannot undo it. */
    static void beforeMutation(CustodialNativeRuntime owner,Integer id,String generation,String rawNotification,boolean unknownSet)throws VaultFailure {
        if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw new IllegalStateException("native notification writer fence missing");
        NativeRecurringOrdinaryCommitPermit permit=active;if(permit==null||permit.runtime!=owner)return;
        // Source retirement ends exclusion, never the ordinary application.
        // The fixed Engine return still observes sticky poison/retirement.
        if(permit.retired)return;
        try{permit.hold.requireNativeWriterLeaseLifetime(permit.source);}
        catch(VaultFailure withdrawn){permit.poisoned=true;permit.retired=true;return;}
        boolean conflict=unknownSet||id!=null&&permit.ids.contains(id)||generation!=null&&permit.generations.contains(generation);
        if(!conflict&&rawNotification!=null){
            try {
                JSONObject row=ProviderWireJson.object(rawNotification.getBytes(java.nio.charset.StandardCharsets.UTF_8),131072);
                Object rawId=row.opt("id");if(rawId instanceof Integer||rawId instanceof Long){long number=((Number)rawId).longValue();if(number>0&&number<=Integer.MAX_VALUE&&permit.ids.contains((int)number))conflict=true;}
                if(!conflict&&row.optString("group").startsWith("mz-custodial-owned:")){
                    JSONObject extra=row.getJSONObject("extra");var principal=NativeProviderPrincipal.fromNativeJournal(new JSONObject(extra.getString("native_presentation_principal")));
                    conflict=permit.principalSha.equals(principal.digest)&&permit.day.equals(extra.getString("service_date"));
                }
            }catch(Exception unclassifiable){conflict=true;}
        }
        if(conflict){permit.poisoned=true;throw pending();}
    }
    private static VaultFailure pending(){return NativeRecurringOrdinaryAttemptJournal.invalid();}
}
