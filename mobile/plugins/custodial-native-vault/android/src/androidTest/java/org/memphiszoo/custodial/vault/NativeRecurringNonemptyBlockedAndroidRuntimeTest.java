package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual normal employee program and default enrolled Runtime; server DATA is
 * explicitly synthetic. Native Source-born raw frames are observations only.
 * No private holder/frame construction, OS/audio settlement or receipt grant. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringNonemptyBlockedAndroidRuntimeTest {
    @Test(timeout=90_000)
    public void nonemptyScheduleThenBlockedRendersNormalPageAndNativeOwnerData()throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture(true)){
            server.installBeforeDefaultRuntime();var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();
            try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            var host=new AtomicReference<BridgeSmokeActivity>();var captured=new AtomicReference<NativeRecurringApplicationSource>();
            var originalUntil=new AtomicLong();var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                final long until=android.os.SystemClock.elapsedRealtime()+20_000;originalUntil.set(until);
                scenario.onActivity(value->{host.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                var member=field(CustodialNativeRuntime.class,"recurringApplication");
                NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)member.get(runtime);assertNotNull(source);
                captured.set(source);queries.recordFailureSource(source);
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,host.get(),until,"KIOSK_08");
                int beforeStatus=server.statusReads;queries.captureInitialStatus(host.get(),until);
                assertTrue(server.statusReads>beforeStatus);assertNotNull(runtime.readNotificationMutationPrincipal());
                NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(host.get(),until,
                    "https://localhost/employee-schedule.html","https://localhost/employee-schedule.html",false);
                awaitNormalRender(host.get(),source,until,false);
                JSONObject scheduled=captureNativeFrame(scenario,source,until);
                assertRendered(scheduled,server.recurringSchedule,false);
                assertTrue(server.recurringSchedule.scheduleReads>0);
                assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                server.recurringSchedule.changeToBlocked();
                // Existing normal consumer event. It only starts the real GET;
                // it supplies no target, snapshot, frame, owner or verdict.
                JSONObject event=query(host.get(),until,"(()=>{window.dispatchEvent(new Event('memphis:schedule-refresh'));return JSON.stringify({requested:true});})()");
                assertTrue(event.getBoolean("requested"));
                awaitNormalRender(host.get(),source,until,true);
                JSONObject blocked=captureNativeFrame(scenario,source,until);
                assertRendered(blocked,server.recurringSchedule,true);
                assertTrue(server.recurringSchedule.blockedReads>0);
                assertNotEquals(server.recurringSchedule.scheduleTargetDigest,server.recurringSchedule.blockedTargetDigest);
                assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                System.out.println("CUSTODIAL_NONEMPTY_BLOCKED_DATA scheduleObserved=true blockedObserved=true sameSource=true sameEngine=true receiptEligible=false");
            }finally{BridgeSmokeActivity.install(null);}
            awaitActualTeardown(originalUntil.get(),host.get(),captured.get());
        }
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
    private static JSONObject captureNativeFrame(ActivityScenario<BridgeSmokeActivity> scenario,NativeRecurringApplicationSource source,long until)throws Exception {
        NativeRecurringCallbackProtocolAndroidSupport.awaitWriterQuiescence(scenario,source,until);
        var owner=new AtomicReference<NativeRecurringApplicationSource.CallbackHold>();
        scenario.onActivity(value->{try{owner.set(source.beginCallbackWriterHold());}catch(VaultFailure failure){throw new AssertionError(failure);}});
        var hold=owner.get();assertNotNull(hold);byte[] firstBytes=null,lastBytes=null;
        try{
            var first=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{first.set(hold.initialRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            awaitReply(first.get(),until);var bytes=new AtomicReference<byte[]>();
            scenario.onActivity(value->{try{bytes.set(first.get().takeRawData(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            firstBytes=bytes.get();JSONObject initial=new JSONObject(new String(firstBytes,StandardCharsets.UTF_8));
            var last=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{last.set(hold.beginTerminalRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            awaitReply(last.get(),until);bytes.set(null);
            scenario.onActivity(value->{try{bytes.set(last.get().takeRawData(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            lastBytes=bytes.get();JSONObject terminal=new JSONObject(new String(lastBytes,StandardCharsets.UTF_8));
            assertEquals(initial.getLong("writer_epoch"),terminal.getLong("writer_epoch"));
            assertTrue(ProviderWireJson.same(initial.getJSONObject("document_data"),terminal.getJSONObject("document_data")));
            scenario.onActivity(value->{try{hold.release(source);}catch(VaultFailure failure){throw new AssertionError(failure);}});
            return terminal;
        }finally{if(firstBytes!=null)Arrays.fill(firstBytes,(byte)0);if(lastBytes!=null)Arrays.fill(lastBytes,(byte)0);hold.close();}
    }
    private static void assertRendered(JSONObject frame,NativeRecurringScheduleReplyFixture fixture,boolean blocked)throws Exception {
        assertEquals("custodial.native-recurring-callback-native-data.v1",frame.getString("schema"));assertFalse(frame.getBoolean("receipt_eligible"));
        JSONObject document=frame.getJSONObject("document_data"),employee=document.getJSONObject("employee");
        for(String name:new String[]{"employee","presenter","scheduler","reminder"})assertFalse(document.getJSONObject(name).getBoolean("receipt_eligible"));
        JSONObject typed=employee.getJSONObject("original_typed_render"),data=typed.getJSONObject("original_source");
        assertEquals("custodial.native-recurring-original-render-data.v1",typed.getString("schema"));assertFalse(typed.getBoolean("receipt_eligible"));
        assertFalse(typed.getBoolean("offline"));assertFalse(typed.getBoolean("cache_warning"));
        assertEquals(blocked?"RECURRING_TERMINAL":"RECURRING_SCHEDULE",data.getString("schedule_delivery_mode"));
        assertEquals(fixture.date,data.getString("service_date"));assertEquals(fixture.databaseDevice,data.getString("canonical_device_pk"));
        assertEquals("KIOSK_08",data.getString("canonical_device_id"));
        JSONObject delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        assertEquals(blocked?fixture.blockedIntent:fixture.scheduleIntent,delivery.getString("intentId"));
        assertEquals(blocked?fixture.blockedTargetDigest:fixture.scheduleTargetDigest,delivery.getString("targetDigest"));
        assertEquals(fixture.databaseDevice,target.getString("deviceId"));assertEquals(blocked?2:1,target.getInt("authorityRevision"));
        JSONObject elements=employee.getJSONObject("elements");assertEquals(blocked,elements.getJSONObject("content").getBoolean("hidden"));
        if(blocked){assertEquals("BLOCKED_RECURRING_AUTHORITY",target.getString("targetType"));
            assertTrue(delivery.isNull("view")&&delivery.isNull("viewJsonText"));assertFalse(delivery.getBoolean("replacementCoverageReady"));
            assertEquals("",elements.getJSONObject("areas").getString("html"));assertFalse(elements.getJSONObject("notice").getBoolean("hidden"));
        }else{assertEquals("SCHEDULE",target.getString("targetType"));assertEquals(fixture.viewDigest,target.getString("viewDigest"));
            JSONObject view=new JSONObject(delivery.getString("viewJsonText"));assertEquals(1,view.getJSONArray("raw_items").length());
            assertEquals(NativeRecurringScheduleReplyFixture.AREA,view.getJSONArray("raw_items").getJSONObject(0).getString("name"));
            assertTrue(elements.getJSONObject("areas").getString("text").contains(NativeRecurringScheduleReplyFixture.AREA));
        }
        // Historical pending/unknown presenter/scheduler/reminder DATA remain
        // intact. No empty-map assertion or OS/audio cancellation inference.
        assertEquals("custodial.native-presenter-raw-data.v1",document.getJSONObject("presenter").getString("schema"));
        assertEquals("custodial.native-scheduler-raw-data.v1",document.getJSONObject("scheduler").getString("schema"));
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
        System.out.println("CUSTODIAL_NONEMPTY_BLOCKED_TEARDOWN viewDestroyComplete=true ownerJavaRetired=true providerDisposalDelegated=true providerRemovalAttempted=false");
    }
}
