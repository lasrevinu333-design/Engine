package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real installed receiver/default Runtime/normal Plugin guards. The HTTPS
 * server and directly supplied receiver Notification are explicit synthetic
 * DATA. This tests receiver admission/actual notify, not normal-built semantic
 * settlement, system alarm delivery, audio or receipt eligibility. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringLegacyPublisherAndroidRuntimeTest {
    private static final int VALID=181201,CANCELLED=181202,FOREIGN=181203,LEGACY=181204;
    @Test(timeout=90_000)
    public void currentReceiverFencesOwnedLegacyAndPreservesUnrelatedLegacy()throws Exception {
        Context target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        assertEquals("org.memphiszoo.custodial.vault.test",target.getPackageName());
        assertTrue(Class.forName("org.memphiszoo.custodial.vault.test.BuildConfig").getField("CUSTODIAL_NOTIFICATION_RUNTIME").getBoolean(null));
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager os=target.getSystemService(NotificationManager.class);assertNotNull(os);assertEquals(0,os.getActiveNotifications().length);
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture(true)){
            server.installBeforeDefaultRuntime();var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            var plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            AtomicReference<BridgeSmokeActivity> activity=new AtomicReference<>();AtomicReference<NativeRecurringApplicationSource> source=new AtomicReference<>();
            var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();long until=android.os.SystemClock.elapsedRealtime()+20_000;
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                scenario.onActivity(value->{activity.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                var member=CustodialNativeRuntime.class.getDeclaredField("recurringApplication");member.setAccessible(true);
                source.set((NativeRecurringApplicationSource)member.get(runtime));assertNotNull(source.get());
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,activity.get(),until,"KIOSK_08");
                int previous=server.statusReads;queries.captureInitialStatus(activity.get(),until);assertTrue(server.statusReads>previous);
                var principal=runtime.readNotificationMutationPrincipal();assertNotNull(principal);
                invoke(activity.get(),"CustodialNativeVault","authorizedRequest",new JSONObject().put("device_id","KIOSK_08")
                    .put("path","/schedule-api/my-day-summary?device_id=KIOSK_08").put("method","GET")
                    .put("headers",new JSONObject()).put("body_base64",""),until);
                assertTrue(server.recurringSchedule.scheduleReads>0);
                JSONObject raw=notification(VALID,principal,server.recurringSchedule.date);
                invoke(activity.get(),"LocalNotifications","schedule",new JSONObject().put("notifications",new JSONArray().put(raw)),until);
                JSONObject original=mutation(runtime,VALID);assertEquals("SCHEDULE_CALLED",original.getString("state"));
                String generation=original.getString("generation");assertFalse(original.isNull("target_reference"));
                String group=raw.getString("group");
                Notification supplied=notificationData(target,group); // Explicit receiver test DATA; no private native object construction.
                rejectWithoutEffects(target,runtime,os,delivery(target,FOREIGN,group,null,supplied),until);
                rejectWithoutEffects(target,runtime,os,delivery(target,FOREIGN,group,UUID.randomUUID().toString(),supplied),until);
                rejectWithoutEffects(target,runtime,os,delivery(target,FOREIGN,group,generation,supplied),until);
                String mismatchedGroup="mz-custodial-owned:"+UUID.randomUUID();
                rejectWithoutEffects(target,runtime,os,delivery(target,VALID,mismatchedGroup,generation,
                    notificationData(target,mismatchedGroup)),until);
                // Actual known generation/receiver positive, not a system alarm
                // callback claim. The original guard creates DISPATCH_ATTEMPTED
                // before the real NotificationManager.notify and called record.
                receive(target,delivery(target,VALID,group,generation,supplied),until);
                assertEquals("DISPATCH_CALLED",mutation(runtime,VALID).getString("state"));assertActive(os,VALID,true);
                rejectWithoutEffects(target,runtime,os,delivery(target,VALID,group,generation,supplied),until); // consumed/duplicate
                JSONObject second=notification(CANCELLED,principal,server.recurringSchedule.date);
                invoke(activity.get(),"LocalNotifications","schedule",new JSONObject().put("notifications",new JSONArray().put(second)),until);
                String cancelled=mutation(runtime,CANCELLED).getString("generation");
                invoke(activity.get(),"LocalNotifications","cancel",new JSONObject().put("notifications",new JSONArray().put(new JSONObject().put("id",CANCELLED))),until);
                assertEquals("CANCEL_CALLED",mutation(runtime,CANCELLED).getString("state"));
                rejectWithoutEffects(target,runtime,os,delivery(target,CANCELLED,second.getString("group"),cancelled,
                    notificationData(target,second.getString("group"))),until);
                // Unrelated generation-less compatibility remains admitted.
                // The exact same current receiver produces a real visible OS
                // notification, while protected recurring WORK stays byte exact.
                Map<String,String> work=Map.copyOf(runtime.offlineStore.recurringRecords());
                receive(target,delivery(target,LEGACY,"legacy-unrelated",null,notificationData(target,"legacy-unrelated")),until);
                assertActive(os,LEGACY,true);assertEquals(work,runtime.offlineStore.recurringRecords());
                assertSame(engine,runtime.engine);assertSame(runtime,CustodialNativeRuntime.get(target));
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                System.out.println("CUSTODIAL_LEGACY_RECEIVER_RESULT knownPositive=true missing=true mismatch=true cancelled=true duplicate=true ownedNullRefused=true unrelatedNullUnchanged=true receiptEligible=false");
            }finally{BridgeSmokeActivity.install(null);}
            awaitTeardown(activity.get(),source.get(),until);
        }
    }
    private static JSONObject notification(int id,NativeProviderPrincipal principal,String day)throws Exception {
        return new JSONObject().put("id",id).put("title","Disposable owned receiver qualifier").put("body","Synthetic receiver DATA")
            .put("group","mz-custodial-owned:"+UUID.randomUUID()).put("schedule",new JSONObject().put("at",java.time.Instant.ofEpochMilli(System.currentTimeMillis()+600_000).toString()))
            .put("extra",new JSONObject().put("native_presentation_id",String.valueOf(id)).put("native_presentation_principal",principal.json().toString())
                .put("service_date",day).put("schedule_authority_revision",1));
    }
    private static Notification notificationData(Context context,String group){
        // Actual fixed test package owns this test-only channel and icon.
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new android.app.NotificationChannel("custodial-receiver-test","Disposable receiver qualifier",NotificationManager.IMPORTANCE_DEFAULT));
        return new Notification.Builder(context,"custodial-receiver-test").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Synthetic receiver qualifier").setContentText("No receipt or semantic proof").setGroup(group).build();
    }
    private static Intent delivery(Context context,int id,String group,String generation,Notification actual){
        assertEquals(group,actual.getGroup());Intent intent=new Intent(context,com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher.class)
            .putExtra(com.capacitorjs.plugins.localnotifications.LocalNotificationManager.NOTIFICATION_INTENT_KEY,id)
            .putExtra(com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher.NOTIFICATION_KEY,actual);
        if(generation!=null)intent.putExtra(CustodialNativeNotificationWriter.GENERATION_EXTRA,generation);return intent;
    }
    private static void receive(Context context,Intent intent,long until){
        assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->new com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher().onReceive(context,intent));
        assertTrue(android.os.SystemClock.elapsedRealtime()<until);
    }
    private static void rejectWithoutEffects(Context context,CustodialNativeRuntime runtime,NotificationManager manager,Intent intent,long until)throws Exception {
        Map<String,String> original=Map.copyOf(runtime.offlineStore.recurringRecords());String active=active(manager);
        receive(context,intent,until);assertEquals(original,runtime.offlineStore.recurringRecords());assertEquals(active,active(manager));
    }
    private static String active(NotificationManager manager){
        var rows=new ArrayList<String>();for(var row:manager.getActiveNotifications())rows.add(row.getId()+":"+row.getTag()+":"+row.getPostTime()+":"+row.getNotification().getGroup());
        Collections.sort(rows);return String.join("|",rows);
    }
    private static void assertActive(NotificationManager manager,int id,boolean expected){assertEquals(expected,Arrays.stream(manager.getActiveNotifications()).anyMatch(row->row.getId()==id));}
    private static JSONObject mutation(CustodialNativeRuntime runtime,int id)throws Exception {
        JSONObject found=null;for(var entry:runtime.offlineStore.recurringRecords().entrySet())if(entry.getKey().startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)){
            JSONObject row=new JSONObject(entry.getValue());if(row.getInt("id")==id){assertNull(found);found=row;}}
        assertNotNull(found);return found;
    }
    private static void invoke(BridgeSmokeActivity activity,String plugin,String method,JSONObject args,long until)throws Exception {
        String key="__custodialLegacyReceiver"+UUID.randomUUID().toString().replace("-","");
        String script="(()=>{const key="+JSONObject.quote(key)+";if(Object.hasOwn(globalThis,key))throw Error('Existing test owner');const r={done:false};Object.defineProperty(globalThis,key,{value:r});"
            +"Promise.resolve().then(()=>Capacitor.nativePromise("+JSONObject.quote(plugin)+","+JSONObject.quote(method)+","+args+"))"
            +".then(()=>{r.ok=true;r.done=true},()=>{r.ok=false;r.done=true});})()";
        assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(script,null));
        while(android.os.SystemClock.elapsedRealtime()<until){
            CountDownLatch done=new CountDownLatch(1);AtomicReference<String> raw=new AtomicReference<>();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript("JSON.stringify(globalThis["+JSONObject.quote(key)+"])",value->{
                try{Object parsed=new JSONTokener(value).nextValue();if(parsed instanceof String)raw.set((String)parsed);}catch(Exception malformed){}finally{done.countDown();}}));
            long remaining=until-android.os.SystemClock.elapsedRealtime();assertTrue(remaining>0);assertTrue(done.await(Math.min(3000,remaining),TimeUnit.MILLISECONDS));
            if(raw.get()!=null){JSONObject result=new JSONObject(raw.get());if(result.optBoolean("done")){assertTrue(result.getBoolean("ok"));assertTrue(android.os.SystemClock.elapsedRealtime()<until);return;}}
            android.os.SystemClock.sleep(25);
        }throw new AssertionError("Original receiver fixture Plugin attempt unresolved; no retry");
    }
    private static java.lang.reflect.Field field(Class<?> type,String name)throws Exception {var member=type.getDeclaredField(name);member.setAccessible(true);return member;}
    private static void awaitTeardown(BridgeSmokeActivity host,NativeRecurringApplicationSource source,long until)throws Exception {
        assertNotNull(host);assertNotNull(source);var destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        var started=field(BridgeSmokeActivity.class,"activityDestroyStarted");var removed=field(BridgeSmokeActivity.class,"viewRemovedBeforeDestroy");
        var retired=field(NativeRecurringApplicationSource.class,"diagnosticOwnerJavaRetired");var delegated=field(NativeRecurringApplicationSource.class,"diagnosticProviderDisposalDelegated");
        var explicit=field(NativeRecurringApplicationSource.class,"diagnosticProviderRemovalAttempted");
        while(android.os.SystemClock.elapsedRealtime()<until&&!(destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source)))android.os.SystemClock.sleep(25);
        long observed=android.os.SystemClock.elapsedRealtime();assertTrue("Actual teardown inside original20",observed<until);
        assertTrue(started.getBoolean(host)&&removed.getBoolean(host)&&destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source));assertFalse(explicit.getBoolean(source));
        System.out.println("CUSTODIAL_LEGACY_RECEIVER_TEARDOWN complete=true ownerRetired=true delegated=true providerRemovalAttempted=false elapsed="+observed+" originalUntil="+until);
    }
}
