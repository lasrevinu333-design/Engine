package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual normal employee page/opaque17 frames and default Runtime plus
 * installed normal vendor notify/alarm/receiver calls. Server and notification
 * content are explicit synthetic DATA. No receipt/purpose application, sound,
 * physical audibility or complete historical alarm inventory is claimed.
 * Each method requires its own fresh process/target selector. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringSemanticProducerAndroidRuntimeTest {
    private static final int IMMEDIATE=181301,FUTURE=181302;
    @Test(timeout=90_000) public void realNormalVendorEffectsBindToGenuineSourceAndWithdraw()throws Exception {run(false);}
    @Test(timeout=90_000) public void realPendingFactoryWithoutReturnInvalidatesGenuineScope()throws Exception {run(true);}
    private void run(boolean pendingFactory)throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        assertEquals("org.memphiszoo.custodial.vault.test",target.getPackageName());
        requireOwnFreshExactAlarmAllowance(target); // bounded setup BEFORE original browser20 origin

        assertTrue(Class.forName("org.memphiszoo.custodial.vault.test.BuildConfig").getField("CUSTODIAL_NOTIFICATION_RUNTIME").getBoolean(null));
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
        var os=target.getSystemService(android.app.NotificationManager.class);assertNotNull(os);assertEquals(0,os.getActiveNotifications().length);
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture(true)){
            server.installBeforeDefaultRuntime();var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            var plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            var host=new AtomicReference<BridgeSmokeActivity>();var captured=new AtomicReference<NativeRecurringApplicationSource>();
            var origin=new AtomicLong();var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                final long until=android.os.SystemClock.elapsedRealtime()+20_000;origin.set(until);
                scenario.onActivity(value->{host.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)field(CustodialNativeRuntime.class,"recurringApplication").get(runtime);
                assertNotNull(source);captured.set(source);queries.recordFailureSource(source);
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,host.get(),until,"KIOSK_08");
                int before=server.statusReads;queries.captureInitialStatus(host.get(),until);assertTrue(server.statusReads>before);
                NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(host.get(),until,"https://localhost/employee-schedule.html","https://localhost/employee-schedule.html",false);
                awaitNormalRender(host.get(),source,until,false);assertTrue(server.recurringSchedule.scheduleReads>0);
                NativeProviderPrincipal principal=runtime.readNotificationMutationPrincipal();assertNotNull(principal);
                invokeSchedule(host.get(),notification(IMMEDIATE,principal,server.recurringSchedule,null),until);
                assertEquals("DISPATCH_CALLED",mutation(runtime,IMMEDIATE).getString("state"));assertVisible(os,IMMEDIATE);
                if(!pendingFactory){
                    String at=java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",java.util.Locale.ROOT).withZone(java.time.ZoneOffset.UTC)
                        .format(java.time.Instant.ofEpochMilli(System.currentTimeMillis()+1_200));
                    invokeSchedule(host.get(),notification(FUTURE,principal,server.recurringSchedule,at),until);
                    // Actual system AlarmManager delivery, no manual receiver
                    // payload or forged generation. SCHEDULE_CALLED may have
                    // advanced already; all waits spend this original20 only.
                    while(android.os.SystemClock.elapsedRealtime()<until&&!("DISPATCH_CALLED".equals(mutation(runtime,FUTURE).getString("state"))
                        &&java.util.Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==FUTURE)))android.os.SystemClock.sleep(25);
                    assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                    assertEquals("DISPATCH_CALLED",mutation(runtime,FUTURE).getString("state"));assertVisible(os,FUTURE);
                }
                captureNativeEffects(scenario,runtime,source,target,server.recurringSchedule,until,pendingFactory);
                assertSame(engine,runtime.engine);assertSame(runtime,CustodialNativeRuntime.get(target));
                assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                System.out.println("CUSTODIAL_SEMANTIC_PRODUCER_RESULT normalPage=true genuine17Frames=true actualNormalNotify=true actualSystemAlarm="+!pendingFactory
                    +" scopedRead=true unrelatedWorkPreserved=true pendingFactoryCase="+pendingFactory+" receiptEligible=false");
            }finally{BridgeSmokeActivity.install(null);}
            awaitActualTeardown(origin.get(),host.get(),captured.get());
        }
    }
    /** Fixture-only setting for the already-proved EMPTY disposable GMD UID.
     * No Activity, credential, key, Runtime or native authority is touched.
     * Never issues the command twice after timeout/error/ambiguous completion. */
    private static void requireOwnFreshExactAlarmAllowance(android.content.Context context)throws Exception {
        assertEquals("org.memphiszoo.custodial.vault.test",context.getPackageName());
        assertTrue("Fresh own GMD user0 UID required",android.os.Process.myUid()>=10_000&&android.os.Process.myUid()<100_000);
        assertTrue("Only local emulator fixture may change own test app-op",android.os.Build.FINGERPRINT.contains("generic")
            ||android.os.Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk")&&"ranchu".equals(android.os.Build.HARDWARE));
        var alarms=context.getSystemService(android.app.AlarmManager.class);assertNotNull(alarms);
        if(android.os.Build.VERSION.SDK_INT>=31){
            var info=context.getPackageManager().getPackageInfo(context.getPackageName(),android.content.pm.PackageManager.GET_PERMISSIONS);
            assertNotNull(info.requestedPermissions);assertTrue(java.util.Arrays.asList(info.requestedPermissions).contains("android.permission.SCHEDULE_EXACT_ALARM"));
            if(!alarms.canScheduleExactAlarms()){
                final long setupUntil=android.os.SystemClock.elapsedRealtime()+3_000;
                android.os.ParcelFileDescriptor descriptor=null;
                var reader=java.util.concurrent.Executors.newSingleThreadExecutor(task->new Thread(task,"custodial-own-exact-fixture"));
                try{
                    descriptor=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(
                        "cmd appops set --user 0 org.memphiszoo.custodial.vault.test SCHEDULE_EXACT_ALARM allow");
                    assertNotNull(descriptor);final var actual=descriptor;
                    var read=reader.submit(()->{try(var input=new android.os.ParcelFileDescriptor.AutoCloseInputStream(actual)){
                        int bytes=0;byte[] buffer=new byte[512];for(int count;(count=input.read(buffer))!=-1;){bytes+=count;if(bytes>4096)throw new java.io.IOException("Fixed setup output bound exceeded");}
                        return bytes;}});
                    long remaining=setupUntil-android.os.SystemClock.elapsedRealtime();assertTrue("Own setup requires original3s remainder",remaining>0);
                    assertTrue(read.get(remaining,TimeUnit.MILLISECONDS)<=4096);
                    assertTrue("Fixed own allowance command must finish within original3s",android.os.SystemClock.elapsedRealtime()<setupUntil);
                }finally{
                    // Closing the exact owned FD wakes a blocked read; no
                    // second command, broad signals or unknown reader adoption.
                    try{if(descriptor!=null)descriptor.close();}
                    finally{reader.shutdownNow();assertTrue("Exact owned setup reader must terminate",reader.awaitTermination(250,TimeUnit.MILLISECONDS));}
                }
            }
            assertTrue("Actual installed own package exact-alarm allowance required",alarms.canScheduleExactAlarms());
        }
        System.out.println("CUSTODIAL_SEMANTIC_EXACT_ALARM_PREFLIGHT sdk="+android.os.Build.VERSION.SDK_INT+" user=0 ownTestPackage=true exactAllowed="
            +(android.os.Build.VERSION.SDK_INT<31||alarms.canScheduleExactAlarms()));
    }
    private static JSONObject notification(int id,NativeProviderPrincipal principal,NativeRecurringScheduleReplyFixture original,String at)throws Exception {
        JSONObject value=new JSONObject().put("id",id).put("title","Owned normal semantic qualifier").put("body","Synthetic current target native effect")
            .put("group","mz-custodial-owned:"+java.util.UUID.randomUUID()).put("extra",new JSONObject().put("native_presentation_id",String.valueOf(id))
                .put("native_presentation_principal",principal.json().toString()).put("service_date",original.date).put("schedule_authority_revision",1)
                .put("publication_id",original.publication));
        if(at!=null)value.put("schedule",new JSONObject().put("at",at));return value;
    }
    private static JSONObject mutation(CustodialNativeRuntime runtime,int id)throws Exception {
        JSONObject found=null;for(var entry:runtime.offlineStore.recurringRecords().entrySet())if(entry.getKey().startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)){
            JSONObject row=new JSONObject(entry.getValue());if(row.getInt("id")==id){assertNull(found);found=row;}}
        assertNotNull(found);assertFalse(found.getBoolean("receipt_eligible"));assertFalse(found.isNull("target_reference"));return found;
    }
    private static void assertVisible(android.app.NotificationManager os,int id){assertTrue(java.util.Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==id));}
    private static void invokeSchedule(BridgeSmokeActivity host,JSONObject notification,long until)throws Exception {
        String key="__custodialSemanticSchedule"+java.util.UUID.randomUUID().toString().replace("-","");
        String script="(()=>{const key="+JSONObject.quote(key)+";if(Object.hasOwn(globalThis,key))throw Error('Existing test owner');const r={done:false};Object.defineProperty(globalThis,key,{value:r});"
            +"Promise.resolve().then(()=>Capacitor.nativePromise('LocalNotifications','schedule',"+new JSONObject().put("notifications",new org.json.JSONArray().put(notification))+"))"
            +".then(()=>{r.ok=true;r.done=true},()=>{r.ok=false;r.done=true});return JSON.stringify({requested:true});})()";
        assertTrue(query(host,until,script).getBoolean("requested"));
        while(android.os.SystemClock.elapsedRealtime()<until){JSONObject state=query(host,until,"JSON.stringify(globalThis["+JSONObject.quote(key)+"])");
            if(state.optBoolean("done")){assertTrue(state.getBoolean("ok"));assertTrue(android.os.SystemClock.elapsedRealtime()<until);return;}android.os.SystemClock.sleep(25);}
        throw new AssertionError("Original normal schedule attempt unresolved; no resubmit");
    }
    private static void awaitNormalRender(BridgeSmokeActivity activity,NativeRecurringApplicationSource source,long until,boolean blocked)throws Exception {
        boolean ready=false;
        while(android.os.SystemClock.elapsedRealtime()<until){
            JSONObject dom=query(activity,until,"(()=>{const content=document.getElementById('content'),areas=document.getElementById('areas'),notice=document.getElementById('notice');return JSON.stringify({complete:document.readyState==='complete',schedule:!!content&&!content.hidden&&!!areas&&areas.textContent.includes('Synthetic owned North Loop'),blocked:!!content&&content.hidden&&!!areas&&areas.innerHTML===''&&!!notice&&!notice.hidden&&notice.textContent.includes('Your schedule needs a manager')});})()");
            JSONObject nativeState=NativeRecurringApplicationSourceAndroidRuntimeTest.readNativeDocumentLifecycle(source);
            if(dom.getBoolean("complete")&&dom.getBoolean(blocked?"blocked":"schedule")
                &&nativeState.getBoolean("initialRegistrationAttempted")&&nativeState.getBoolean("producerBirthObserved")
                &&nativeState.getBoolean("documentCommitted")&&nativeState.getLong("document")>0){ready=true;break;}
            android.os.SystemClock.sleep(25);
        }
        assertTrue("Actual normal render/commit inside SAME original20s",ready&&android.os.SystemClock.elapsedRealtime()<until);
    }
    private static void captureNativeEffects(
        ActivityScenario<BridgeSmokeActivity> scenario,CustodialNativeRuntime runtime,
        NativeRecurringApplicationSource source,android.content.Context context,NativeRecurringScheduleReplyFixture fixture,long until,boolean pendingFactory)throws Exception {
        NativeRecurringCallbackProtocolAndroidSupport.awaitWriterQuiescence(scenario,source,until);
        var owner=new AtomicReference<NativeRecurringApplicationSource.CallbackHold>();
        scenario.onActivity(value->{try{owner.set(source.beginOrdinaryDeliveryWriterHold());}catch(VaultFailure failure){throw new AssertionError(failure);}});
        var hold=owner.get();assertNotNull(hold);
        NativeRecurringApplicationSource.OrdinaryCallbackFrame initial=null,terminal=null;
        VaultEngine.NativeOrdinaryRecurringRead actual=null;
        try{
            var first=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{first.set(hold.initialRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            awaitReply(first.get(),until);
            var frame=new AtomicReference<NativeRecurringApplicationSource.OrdinaryCallbackFrame>();
            scenario.onActivity(value->{try{frame.set(first.get().takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            initial=frame.get();assertNotNull(initial);
            // Actual Runtime entry consumes the actual latest completed native
            // GET/PREPARED birth before callbacks. No UI wait under its locks.
            actual=runtime.claimOrdinaryRecurringRead(source,hold,initial);assertNotNull(actual);
            var last=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{last.set(hold.beginTerminalRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            awaitReply(last.get(),until);frame.set(null);
            scenario.onActivity(value->{try{frame.set(last.get().takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            terminal=frame.get();assertNotNull(terminal);
            actual.verifyTerminal(terminal);
            // Read only the result of the real private native consumer. Never
            // write a holder, supply JSON as a frame or construct its owner.
            var observed=(NativeRecurringOrdinaryRenderData.Observation)field(VaultEngine.NativeOrdinaryRecurringRead.class,"observation").get(actual);
            assertNotNull(observed);assertObservation(observed,fixture,false,runtime);assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            NativeProviderPrincipal principal=runtime.readNotificationMutationPrincipal();assertNotNull(principal);
            NativeRecurringOrdinaryEffectProducer.ScopeRead nativeRead;
            synchronized(CustodialNativeNotificationWriter.class){
                nativeRead=NativeRecurringOrdinaryEffectProducer.capture(context,runtime,principal,observed.serviceDate,source,hold);
                String data=nativeRead.consumeData();JSONObject retained=new JSONObject(data);
                assertEquals("custodial.native-ordinary-effect-call-data.v1",retained.getString("schema"));
                assertEquals(principal.digest,retained.getString("principal_sha256"));assertEquals(observed.serviceDate,retained.getString("service_date"));
                assertFalse(retained.getBoolean("receipt_eligible"));
                assertEquals(pendingFactory?1:2,retained.getJSONArray("generations").length());
                assertTrue(retained.getJSONObject("visible").getJSONObject("active").has(String.valueOf(IMMEDIATE)));
                if(!pendingFactory)assertTrue(retained.getJSONObject("visible").getJSONObject("active").has(String.valueOf(FUTURE)));
                if(!pendingFactory){
                    boolean exactCalled=false;
                    for(int i=0;i<retained.getJSONArray("generations").length();i++){
                        JSONObject generation=retained.getJSONArray("generations").getJSONObject(i);if(generation.getInt("id")!=FUTURE)continue;
                        for(int k=0;k<generation.getJSONArray("calls").length();k++){
                            JSONObject call=generation.getJSONArray("calls").getJSONObject(k);
                            if("ALARM_EXACT".equals(call.getString("operation"))){assertTrue(call.getBoolean("returned"));assertFalse(call.getBoolean("alarm_delivery_proven"));exactCalled=true;}
                        }
                    }
                    assertTrue("Actual normal exact API branch and return required",exactCalled);
                }
                assertThrows(VaultFailure.class,nativeRead::consumeData);
                nativeRead.requireUnchanged(context,source,hold);
            }
            try {
                // A genuine unrelated ordinary WORK write remains live. It is
                // neither decoded into the scoped producer nor blocked/reset.
                var raw=context.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
                String key="fixture18a_unrelated_"+java.util.UUID.randomUUID();assertFalse(raw.contains(key));
                assertTrue(new AndroidProtectedWorkPreferences(raw).edit().putString(key,"retained_unrelated_DATA").commit());
                synchronized(CustodialNativeNotificationWriter.class){nativeRead.requireUnchanged(context,source,hold);}
                assertEquals("retained_unrelated_DATA",raw.getString(key,null));
                if(pendingFactory){
                    JSONObject row=mutation(runtime,IMMEDIATE);String generation=row.getString("generation");
                    android.content.Intent intent=new android.content.Intent(context,com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver.class)
                        .setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        .putExtra("LocalNotificationId",IMMEDIATE).putExtra("LocalNotificationUserAction","dismiss").putExtra("LocalNotificationRepeating",true);
                    synchronized(CustodialNativeNotificationWriter.class){
                        // Exact native semantic wrapper on the actual born
                        // generation creates a private pending token. No
                        // private constructor, successful PI return or fake OS
                        // effect is supplied: the factory is deliberately NOT
                        // invoked and this pending record must never settle.
                        var token=CustodialNativeNotificationWriter.semanticDeleteIntentStarting(context,generation,IMMEDIATE,intent,IMMEDIATE,android.app.PendingIntent.FLAG_MUTABLE);
                        assertNotNull(token);
                        assertThrows(VaultFailure.class,nativeRead::requireNativeFenceReadOnly);
                        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.capture(context,runtime,principal,observed.serviceDate,source,hold));
                    }
                    assertEquals(row.toString(),mutation(runtime,IMMEDIATE).toString());
                    scenario.onActivity(value->{try{hold.release(source);}catch(VaultFailure failure){throw new AssertionError(failure);}});
                }else{
                    scenario.onActivity(value->source.close());
                    synchronized(CustodialNativeNotificationWriter.class){assertThrows(VaultFailure.class,nativeRead::requireNativeFenceReadOnly);}
                }
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            }finally{nativeRead.close();}

        }finally{
            if(actual!=null)actual.close();if(initial!=null)initial.close();if(terminal!=null)terminal.close();hold.close();
        }
    }
    private static void assertObservation(NativeRecurringOrdinaryRenderData.Observation observed,
        NativeRecurringScheduleReplyFixture fixture,boolean blocked,CustodialNativeRuntime runtime)throws Exception {
        assertNotNull(observed);
        assertEquals(blocked?fixture.blockedIntent:fixture.scheduleIntent,observed.intentId);
        assertEquals(blocked?fixture.blockedTargetDigest:fixture.scheduleTargetDigest,observed.targetDigest);
        assertEquals(blocked?fixture.blockedTargetDigest:fixture.viewDigest,observed.renderedDigest);
        assertEquals(fixture.date,observed.serviceDate);
        NativeProviderPrincipal current=runtime.readNotificationMutationPrincipal();assertNotNull(current);
        assertTrue(current.same(NativeProviderPrincipal.fromNativeJournal(
            ProviderWireJson.object(observed.principalIdentity.getBytes(StandardCharsets.UTF_8),16384))));
        JSONObject presenter=new JSONObject(observed.presenter),scheduler=new JSONObject(observed.scheduler),reminder=new JSONObject(observed.reminder);
        assertEquals("custodial.native-presenter-ordinary-target-data.v1",presenter.getString("schema"));
        assertEquals("custodial.native-scheduler-ordinary-target-data.v1",scheduler.getString("schema"));
        assertEquals("custodial.native-reminder-ordinary-target-data.v1",reminder.getString("schema"));
        for(JSONObject data:new JSONObject[]{presenter,scheduler,reminder}){
            assertFalse(data.getBoolean("receipt_eligible"));JSONObject selector=data.getJSONObject("selector");
            assertEquals(observed.principalIdentity,selector.getString("principal"));assertEquals(observed.serviceDate,selector.getString("service_date"));
            assertEquals(observed.intentId,selector.getString("intent_id"));assertEquals(observed.targetDigest,selector.getString("target_digest"));
        }
        // Retain failure history and all related/unrelated raw owner DATA.
        // Empty counts are not interpreted as audio/OS/effect settlement.
        assertNotNull(observed.failedCallbackTerminals);
    }
    private static JSONObject query(BridgeSmokeActivity host,long originalUntil,String script)throws Exception {
        long until=Math.min(originalUntil,android.os.SystemClock.elapsedRealtime()+3_000);CountDownLatch done=new CountDownLatch(1);var raw=new AtomicReference<String>();
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(()->host.getBridge().getWebView().evaluateJavascript(script,value->{raw.set(value);done.countDown();}));
        long remaining=until-android.os.SystemClock.elapsedRealtime();assertTrue(remaining>0&&done.await(remaining,TimeUnit.MILLISECONDS));
        assertTrue(android.os.SystemClock.elapsedRealtime()<until);Object decoded=new JSONTokener(raw.get()).nextValue();assertTrue(decoded instanceof String);return new JSONObject((String)decoded);
    }
    private static void awaitReply(NativeRecurringApplicationSource.CallbackRead read,long originalUntil){
        long until=Math.min(originalUntil,android.os.SystemClock.elapsedRealtime()+3_000);
        while(android.os.SystemClock.elapsedRealtime()<until&&!read.hasReply()&&!read.hasTerminalRefusal())android.os.SystemClock.sleep(25);
        assertFalse("Actual native refusal: "+read.terminalRefusalKind(),read.hasTerminalRefusal());
        assertTrue(android.os.SystemClock.elapsedRealtime()<until&&read.hasReply());
    }
    private static java.lang.reflect.Field field(Class<?> type,String name)throws Exception {var f=type.getDeclaredField(name);f.setAccessible(true);return f;}
    private static void awaitActualTeardown(long until,BridgeSmokeActivity host,NativeRecurringApplicationSource source)throws Exception {
        assertNotNull(host);assertNotNull(source);var destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        var retired=field(NativeRecurringApplicationSource.class,"diagnosticOwnerJavaRetired");var delegated=field(NativeRecurringApplicationSource.class,"diagnosticProviderDisposalDelegated");
        while(android.os.SystemClock.elapsedRealtime()<until&&!(destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source)))android.os.SystemClock.sleep(25);
        assertTrue(until>0&&android.os.SystemClock.elapsedRealtime()<until);assertTrue(destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source));
        assertFalse(field(NativeRecurringApplicationSource.class,"diagnosticProviderRemovalAttempted").getBoolean(source));
        System.out.println("CUSTODIAL_SEMANTIC_PRODUCER_TEARDOWN viewDestroyComplete=true ownerJavaRetired=true providerDisposalDelegated=true providerRemovalAttempted=false");
    }
}
