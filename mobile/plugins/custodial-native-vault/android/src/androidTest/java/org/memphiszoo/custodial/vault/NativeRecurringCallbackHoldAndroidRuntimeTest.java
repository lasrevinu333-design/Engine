package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Fresh isolated process only; actual normal factories + default Engine.
 * Callback-lifetime DATA only: no WORK/OS settlement or receipt eligibility.
 * Requires the reviewed09-r3 JS overlay and its normally generated asset. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringCallbackHoldAndroidRuntimeTest {
    @Test(timeout=90_000)
    public void actualNativeCallbackHoldTransfersSameDocumentDataOnlyOnce()throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture()){
            server.installBeforeDefaultRuntime();
            var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();
            try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
            CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            AtomicReference<BridgeSmokeActivity> activity=new AtomicReference<>();
            AtomicReference<NativeRecurringApplicationSource.CallbackHold> original=new AtomicReference<>();
            var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();
            var originalUntil=new java.util.concurrent.atomic.AtomicLong();
            AtomicReference<NativeRecurringApplicationSource> teardownSource=new AtomicReference<>();
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                // ONE original20s origin: startup, normal status, factories and
                // both channel phases. No extra capture or timeout renewal.
                long until=android.os.SystemClock.elapsedRealtime()+20_000;
                originalUntil.set(until);
                scenario.onActivity(value->{activity.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                var member=CustodialNativeRuntime.class.getDeclaredField("recurringApplication");member.setAccessible(true);
                NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)member.get(runtime);assertNotNull(source);
                queries.recordFailureSource(source);teardownSource.set(source);
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,activity.get(),until,"KIOSK_08");
                int statusBefore=server.statusReads;queries.captureInitialStatus(activity.get(),until);
                assertTrue(server.statusReads>statusBefore);assertNotNull(runtime.readNotificationMutationPrincipal());
                NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(activity.get(),until,
                    "https://localhost/employee-schedule.html","https://localhost/employee-schedule.html",false);
                boolean born=false;
                while(android.os.SystemClock.elapsedRealtime()<until){
                    String raw=queries.readDocument(activity.get(),until);
                    if(raw!=null){JSONObject data=new JSONObject(raw);
                        JSONObject nativeData=NativeRecurringApplicationSourceAndroidRuntimeTest.readNativeDocumentLifecycle(source);
                        if(data.optBoolean("marker")&&data.optBoolean("mobile")&&data.optBoolean("security_initialized")
                            &&data.optBoolean("security_ready")&&data.optBoolean("security_available")
                            &&"enrolled".equals(data.optString("security_state"))&&"KIOSK_08".equals(data.optString("deviceId"))
                            &&!data.optBoolean("noPrincipal",true)&&"complete".equals(data.optString("readyState"))
                            &&nativeData.getBoolean("producerBirthObserved")&&nativeData.getBoolean("initialRegistrationAttempted")
                            &&nativeData.getBoolean("documentCommitted")&&nativeData.getLong("document")>0){born=true;break;}}
                    android.os.SystemClock.sleep(25);
                }
                assertTrue("Actual normal owner birth/commit inside original bound",born);
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                NativeRecurringCallbackProtocolAndroidSupport.awaitWriterQuiescence(scenario,source,until);
                scenario.onActivity(value->{try{original.set(source.beginCallbackWriterHold());}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}});
                var hold=original.get();assertNotNull(hold);
                AtomicReference<NativeRecurringApplicationSource.CallbackRead> first=new AtomicReference<>();
                scenario.onActivity(value->{assertThrows(VaultFailure.class,()->hold.initialRead(null));
                    try{first.set(hold.initialRead(source));}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}
                    assertThrows(VaultFailure.class,()->hold.beginTerminalRead(source));
                    assertThrows(VaultFailure.class,source::beginDocumentDataRead);
                    assertThrows(VaultFailure.class,source::beginCallbackWriterHold);});
                awaitReply(first.get(),until);
                AtomicReference<byte[]> initial=new AtomicReference<>(),terminal=new AtomicReference<>();
                try{
                    scenario.onActivity(value->{assertThrows(VaultFailure.class,()->first.get().takeRawData(null));
                        try{initial.set(first.get().takeRawData(source));}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}
                        assertThrows(VaultFailure.class,()->first.get().takeRawData(source));});
                    JSONObject before=assertRaw(initial.get());
                    AtomicReference<NativeRecurringApplicationSource.CallbackRead> last=new AtomicReference<>();
                    scenario.onActivity(value->{try{last.set(hold.beginTerminalRead(source));}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}
                        assertThrows(VaultFailure.class,()->hold.beginTerminalRead(source));});
                    awaitReply(last.get(),until);
                    scenario.onActivity(value->{try{terminal.set(last.get().takeRawData(source));}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}
                        assertThrows(VaultFailure.class,()->last.get().takeRawData(source));});
                    JSONObject after=assertRaw(terminal.get());
                    assertEquals(before.getLong("writer_epoch"),after.getLong("writer_epoch"));
                    assertEquals(before.getJSONArray("failed_callback_terminals").toString(),after.getJSONArray("failed_callback_terminals").toString());
                    assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                    scenario.onActivity(value->{try{hold.release(source);}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}
                        assertThrows(VaultFailure.class,()->hold.release(source));
                        assertThrows(VaultFailure.class,()->hold.initialRead(source));
                        source.close();assertThrows(VaultFailure.class,source::beginCallbackWriterHold);});
                    assertTrue(android.os.SystemClock.elapsedRealtime()<until);
                    assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                }finally{if(initial.get()!=null)Arrays.fill(initial.get(),(byte)0);if(terminal.get()!=null)Arrays.fill(terminal.get(),(byte)0);}
            }finally{if(original.get()!=null)original.get().close();BridgeSmokeActivity.install(null);}
            awaitActualRecurringTeardown(originalUntil.get(),activity.get(),teardownSource.get());
        }
    }
    private static void awaitActualRecurringTeardown(long originalUntil,BridgeSmokeActivity host,
        NativeRecurringApplicationSource source)throws Exception {
        assertNotNull(host);assertNotNull(source);
        var destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        var started=field(BridgeSmokeActivity.class,"activityDestroyStarted");
        var removed=field(BridgeSmokeActivity.class,"viewRemovedBeforeDestroy");
        var retired=field(NativeRecurringApplicationSource.class,"diagnosticOwnerJavaRetired");
        var delegated=field(NativeRecurringApplicationSource.class,"diagnosticProviderDisposalDelegated");
        var explicit=field(NativeRecurringApplicationSource.class,"diagnosticProviderRemovalAttempted");
        // Captured objects' scalar fields ONLY after Scenario.close/finalizers.
        // No Activity/WebView/API call and no renewed deadline or queued task.
        while(android.os.SystemClock.elapsedRealtime()<originalUntil
            &&!(destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source)))
            android.os.SystemClock.sleep(25);
        long observed=android.os.SystemClock.elapsedRealtime();
        System.out.println("CUSTODIAL_RECURRING_TEARDOWN_STATE elapsed="+observed+" originalUntil="+originalUntil
            +" destroyStarted="+started.getBoolean(host)+" removed="+removed.getBoolean(host)
            +" viewDestroyComplete="+destroyed.getBoolean(host)+" ownerJavaRetired="+retired.getBoolean(source)
            +" providerDisposalDelegated="+delegated.getBoolean(source)+" providerRemovalAttempted="+explicit.getBoolean(source));
        assertTrue("Actual teardown inside SAME original20s",originalUntil>0&&observed<originalUntil);
        assertTrue(started.getBoolean(host)&&removed.getBoolean(host)&&destroyed.getBoolean(host));
        assertTrue(retired.getBoolean(source)&&delegated.getBoolean(source));
        assertFalse("Owner-bound provider unregister must not run",explicit.getBoolean(source));
    }
    private static java.lang.reflect.Field field(Class<?> type,String name)throws Exception {
        var value=type.getDeclaredField(name);value.setAccessible(true);return value;
    }
    private static void awaitReply(NativeRecurringApplicationSource.CallbackRead read,long originalUntil){
        long until=Math.min(originalUntil,android.os.SystemClock.elapsedRealtime()+3_000);
        while(android.os.SystemClock.elapsedRealtime()<until&&!read.hasReply()&&!read.hasTerminalRefusal())android.os.SystemClock.sleep(25);
        assertFalse("Actual same-phase native refusal: "+read.terminalRefusalKind(),read.hasTerminalRefusal());
        assertTrue("Same original native callback reply inside original remainder",android.os.SystemClock.elapsedRealtime()<until&&read.hasReply());
    }
    private static JSONObject assertRaw(byte[] bytes)throws Exception {
        assertNotNull(bytes);JSONObject raw=new JSONObject(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));
        NativeRetainedAttempt.keys(raw,"schema","receipt_eligible","writer_epoch","failed_callback_terminals","document_data");
        assertEquals("custodial.native-recurring-callback-native-data.v1",raw.getString("schema"));assertFalse(raw.getBoolean("receipt_eligible"));
        assertTrue(raw.getLong("writer_epoch")>=0);assertTrue(raw.getJSONArray("failed_callback_terminals").length()<=128);
        JSONObject document=raw.getJSONObject("document_data");assertFalse(document.getBoolean("receipt_eligible"));
        assertEquals("custodial.native-recurring-document-raw-data.v1",document.getString("schema"));
        for(String owner:new String[]{"employee","presenter","scheduler","reminder"})assertFalse(document.getJSONObject(owner).getBoolean("receipt_eligible"));
        return raw;
    }
}
