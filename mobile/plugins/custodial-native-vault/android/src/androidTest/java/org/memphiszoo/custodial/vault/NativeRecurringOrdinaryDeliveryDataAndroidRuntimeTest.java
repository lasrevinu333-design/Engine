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

/** Actual normal employee program and default enrolled Runtime; server DATA is
 * explicitly synthetic. Native Source-born ordinary frames and Engine observations are DATA only.
 * No private holder/frame construction, OS/audio settlement or receipt grant. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringOrdinaryDeliveryDataAndroidRuntimeTest {
    @Test(timeout=90_000)
    public void genuineOrdinaryFramesJoinNativeScheduledAndBlockedPurposeData()throws Exception {
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
                // Explicit new synthetic unrelated WORK row through the SAME
                // maintained ordinary editor, never a forged purpose/frame or
                // installed native generation. No original row is overwritten.
                var raw=target.getApplicationContext().getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
                var editor=new AndroidProtectedWorkPreferences(raw);
                String historyKey="fixture_ordinary17_unrelated_"+java.util.UUID.randomUUID();
                String historyValue="Explicit synthetic historical WORK DATA preserved";
                assertFalse(raw.contains(historyKey));assertTrue(editor.edit().putString(historyKey,historyValue).commit());
                awaitNormalRender(host.get(),source,until,false);
                var scheduled=captureOrdinaryData(scenario,runtime,source,until);
                assertObservation(scheduled,server.recurringSchedule,false,runtime);
                assertEquals(historyValue,raw.getString(historyKey,null));
                assertTrue(server.recurringSchedule.scheduleReads>0);
                assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                server.recurringSchedule.changeToBlocked();
                // Existing normal consumer event. It only starts the real GET;
                // it supplies no target, snapshot, frame, owner or verdict.
                JSONObject event=query(host.get(),until,"(()=>{window.dispatchEvent(new Event('memphis:schedule-refresh'));return JSON.stringify({requested:true});})()");
                assertTrue(event.getBoolean("requested"));
                awaitNormalRender(host.get(),source,until,true);
                var blocked=captureOrdinaryData(scenario,runtime,source,until);
                assertObservation(blocked,server.recurringSchedule,true,runtime);
                assertEquals(historyValue,raw.getString(historyKey,null));
                assertTrue(server.recurringSchedule.blockedReads>0);
                assertNotEquals(server.recurringSchedule.scheduleTargetDigest,server.recurringSchedule.blockedTargetDigest);
                assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                System.out.println("CUSTODIAL_ORDINARY17_ANDROID_DATA scheduleObserved=true blockedObserved=true genuineInitialTerminalFrames=true sameDefaultEngine=true unrelatedWorkPreserved=true receiptEligible=false");
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
    private static NativeRecurringOrdinaryRenderData.Observation captureOrdinaryData(
        ActivityScenario<BridgeSmokeActivity> scenario,CustodialNativeRuntime runtime,
        NativeRecurringApplicationSource source,long until)throws Exception {
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
            assertNotNull(observed);assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            scenario.onActivity(value->{try{hold.release(source);}catch(VaultFailure failure){throw new AssertionError(failure);}});
            return observed;
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
        System.out.println("CUSTODIAL_ORDINARY17_ANDROID_TEARDOWN viewDestroyComplete=true ownerJavaRetired=true providerDisposalDelegated=true providerRemovalAttempted=false");
    }
}
