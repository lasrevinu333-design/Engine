package org.memphiszoo.custodial.vault;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

/** Actual normal native producer only. This immutable value describes an
 * observed raw vendor store and actual active OS notification IDENTITIES.
 * It does not assert displayed content/effects, absence authority, browser
 * settlement, current document, a receipt, or permission to retry anything. */
final class NativeNotificationOriginalFrame {
    private static final String SCHEMA="custodial.native-notification-original-frame-data.v1";
    private static final String SCOPE="RAW_VENDOR_AND_ACTIVE_IDENTITIES_NOT_SETTLEMENT";
    private final NativeProviderPrincipal principal;
    private final String generation;
    private boolean consumed;
    private final String rawDigest,activeDigest;
    private final int rawCount,activeCount;
    private NativeNotificationOriginalFrame(NativeProviderPrincipal principal,String generation,Observation observation){
        this.generation=generation;
        this.principal=principal;rawDigest=observation.rawDigest;activeDigest=observation.activeDigest;
        rawCount=observation.raw.size();activeCount=observation.activeCount;
    }
    static NativeNotificationOriginalFrame capture(Context context,String generation)throws VaultFailure {
        requireWriterFence();NativeNfcOriginalWriteAttempt.uuid(generation);
        try {
            Context app=context==null?null:context.getApplicationContext();
            if(app==null||!("org.memphiszoo.custodial".equals(app.getPackageName())
                ||"org.memphiszoo.custodial.vault.test".equals(app.getPackageName())))throw invalid();
            // Fixed normal Runtime factory, not a caller-supplied observer or
            // a second Native owner. No browser Boolean participates.
            CustodialNativeRuntime runtime=CustodialNativeRuntime.get(app);
            NativeProviderPrincipal original=runtime.readNotificationMutationPrincipal();
            if(original==null)throw invalid();
            Observation first=observe(app);
            if(!original.same(runtime.readNotificationMutationPrincipal()))throw invalid();
            // Last whole raw/OS reread follows the LAST native owner/key
            // callback; same vendor writers remain excluded by the monitor.
            Observation terminal=observe(app);
            if(!first.same(terminal))throw invalid();
            return new NativeNotificationOriginalFrame(original,generation,terminal);
        }catch(VaultFailure refused){throw refused;}
        catch(Exception unavailable){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
    private static Observation observe(Context app)throws VaultFailure {
        requireWriterFence();
        try {
            Map<String,?> source=app.getSharedPreferences("NOTIFICATION_STORE",Context.MODE_PRIVATE).getAll();
            if(source==null||source.size()>4096)throw invalid();
            Map<String,Object> raw=new LinkedHashMap<>();
            for(var entry:source.entrySet()) {
                if(entry.getKey()==null)throw invalid();Object value=entry.getValue();
                // Own mutable containers before hashing/terminal comparison.
                // Unsupported raw types are refused, never silently omitted.
                if(value instanceof Set<?>)value=Set.copyOf((Set<?>)value);
                raw.put(entry.getKey(),value);
            }
            String rawDigest=NativeProtectedWorkSnapshot.capture(raw).digest;
            NotificationManager manager=app.getSystemService(NotificationManager.class);
            if(manager==null)throw invalid();StatusBarNotification[] sourceActive=manager.getActiveNotifications();
            if(sourceActive==null||sourceActive.length>256)throw invalid();
            Map<String,Object> active=new LinkedHashMap<>();active.put("count",sourceActive.length);
            Map<String,Map<String,Object>> originalIdentities=new LinkedHashMap<>();
            Set<String> seen=new java.util.HashSet<>();
            for(StatusBarNotification row:sourceActive) {
                if(row==null||row.getNotification()==null||row.getUid()!=app.getApplicationInfo().uid
                    ||!app.getPackageName().equals(row.getPackageName())||row.getKey()==null)throw invalid();
                String key=row.getKey();if(!seen.add(key))throw invalid();
                // Snapshot raw UTF-16 through the existing exact native DATA
                // snapshot codec; no JSON/string-coercion numeric roundtrip.
                Map<String,Object> identity=new LinkedHashMap<>();
                Notification notification=row.getNotification();
                identity.put("key",key);identity.put("package",row.getPackageName());
                identity.put("uid",row.getUid());identity.put("id",row.getId());
                nullable(identity,"tag",row.getTag());nullable(identity,"group",notification.getGroup());
                nullable(identity,"sort",notification.getSortKey());nullable(identity,"category",notification.category);
                nullable(identity,"channel",Build.VERSION.SDK_INT>=26?notification.getChannelId():null);
                identity.put("post_time",row.getPostTime());identity.put("when",notification.when);
                identity.put("flags",notification.flags);identity.put("number",notification.number);
                identity.put("ongoing",row.isOngoing());identity.put("clearable",row.isClearable());
                String digest=NativeProtectedWorkSnapshot.capture(identity).digest;
                active.put("notification:"+key,digest);
                originalIdentities.put(key,Collections.unmodifiableMap(identity));
            }
            // This is an IDENTITY frame; arbitrary extras, actions and Pending-
            // Intents are not serialized or misrepresented as full OS effects.
            String activeDigest=NativeProtectedWorkSnapshot.capture(active).digest;
            return new Observation(Collections.unmodifiableMap(raw),Collections.unmodifiableMap(active),rawDigest,activeDigest,sourceActive.length,Collections.unmodifiableMap(originalIdentities));
        }catch(VaultFailure refused){throw refused;}
        catch(Exception unavailable){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,unavailable);}
    }
    private static void nullable(Map<String,Object> map,String key,String value){map.put(key+":null",value==null);map.put(key,value==null?"":value);}
    private static final class Observation {
        final Map<String,Object> raw,active;final Map<String,Map<String,Object>> identities;final String rawDigest,activeDigest;final int activeCount;
        Observation(Map<String,Object> raw,Map<String,Object> active,String rawDigest,String activeDigest,int count,Map<String,Map<String,Object>> identities){this.raw=raw;this.active=active;this.rawDigest=rawDigest;this.activeDigest=activeDigest;activeCount=count;this.identities=identities;}
        boolean same(Observation next)throws VaultFailure {return rawDigest.equals(next.rawDigest)&&activeDigest.equals(next.activeDigest)
            &&activeCount==next.activeCount&&NativeProtectedWorkSnapshot.exactRawEquals(raw,next.raw)
            &&NativeProtectedWorkSnapshot.exactRawEquals(active,next.active)&&sameIdentities(next);}
        private boolean sameIdentities(Observation next)throws VaultFailure {
            if(!identities.keySet().equals(next.identities.keySet()))return false;
            for(String key:identities.keySet())if(!NativeProtectedWorkSnapshot.exactRawEquals(identities.get(key),next.identities.get(key)))return false;
            return true;
        }
    }
    synchronized JSONObject data(NativeProviderPrincipal expected,String expectedGeneration)throws VaultFailure {
        requireWriterFence();if(consumed||expected==null||!expected.same(principal)||!generation.equals(expectedGeneration))throw invalid();
        consumed=true;
        try{return new JSONObject().put("schema",SCHEMA).put("scope",SCOPE).put("principal_sha256",principal.digest)
            .put("generation",generation).put("raw_vendor_sha256",rawDigest).put("active_identity_sha256",activeDigest)
            .put("raw_record_count",rawCount).put("active_count",activeCount).put("receipt_eligible",false);}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    static void requireDescriptor(JSONObject row,NativeProviderPrincipal principal,String generation)throws VaultFailure {
        try {
            NativeRetainedAttempt.keys(row,"schema","scope","principal_sha256","generation","raw_vendor_sha256","active_identity_sha256","raw_record_count","active_count","receipt_eligible");
            if(!SCHEMA.equals(row.get("schema"))||!SCOPE.equals(row.get("scope"))||!Boolean.FALSE.equals(row.get("receipt_eligible"))
                ||!principal.digest.equals(row.get("principal_sha256"))||!generation.equals(row.get("generation")))throw invalid();
            NativeNfcOriginalWriteAttempt.uuid(generation);
            for(String field:new String[]{"principal_sha256","raw_vendor_sha256","active_identity_sha256"})if(!row.getString(field).matches("[a-f0-9]{64}"))throw invalid();
            for(String field:new String[]{"raw_record_count","active_count"}) {
                Object count=row.get(field);int max=field.equals("active_count")?256:4096;
                if(!(count instanceof Integer||count instanceof Long)||((Number)count).longValue()<0||((Number)count).longValue()>max)throw invalid();
            }
        }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    private static void requireWriterFence()throws VaultFailure {if(!Thread.holdsLock(CustodialNativeNotificationWriter.class))throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(NativeRecurringTargetJournal.FAILURE);}
}
