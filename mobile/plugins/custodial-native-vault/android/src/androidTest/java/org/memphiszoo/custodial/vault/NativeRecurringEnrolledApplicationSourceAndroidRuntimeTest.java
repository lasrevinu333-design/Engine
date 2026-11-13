package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** FRESH process/target only. SAME default Engine is normally enrolled using
 * the existing synthetic one-attempt server. No TLS/SQL/live identity, OS
 * settlement, native purpose or receipt is asserted. Never run after EMPTY. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringEnrolledApplicationSourceAndroidRuntimeTest {
    @Test(timeout=90_000)
    public void actualEnrolledDefaultOwnerMountsFactoriesAndRetiresSameSource()throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture()){
            server.installBeforeDefaultRuntime(); // Once/process; no reset/adoption.
            var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();
            try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
            assertActive(engine.observeStateReadOnly(),server.credentialId);
            CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            AtomicReference<BridgeSmokeActivity> activity=new AtomicReference<>();
            var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();
            var originalUntil=new java.util.concurrent.atomic.AtomicLong();
            AtomicReference<NativeOriginalBrowserPreparation> cleanupSource=new AtomicReference<>();
            java.lang.reflect.Field[] hostFlags=fields(BridgeSmokeActivity.class,"activityDestroyStarted","viewRemovedBeforeDestroy","viewDestroyCompleted");
            java.lang.reflect.Field[] cleanupFlags=fields(NativeOriginalBrowserPreparation.class,"diagnosticOwnerJavaRetired","diagnosticProviderDisposalDelegated","diagnosticPhysicalCleanupStarted","diagnosticPhysicalCleanupFinished","diagnosticPhysicalCleanupPostRefused");
            try{
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                String stage="ENROLLED_ACTIVITY_BODY_BEGIN";
                // ONE20s browser origin includes initial settling, employee
                // factory birth, Source close and actual completed reload.
                long until=android.os.SystemClock.elapsedRealtime()+20_000;
                originalUntil.set(until);
                try{
                    NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    scenario.onActivity(value->{activity.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                    assertSame(runtime,CustodialNativeRuntime.get(target));assertSame(engine,runtime.engine);
                    var member=CustodialNativeRuntime.class.getDeclaredField("recurringApplication");member.setAccessible(true);
                    NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)member.get(runtime);assertNotNull(source);
                    queries.recordFailureSource(source);
                    var originalMember=CustodialNativeRuntime.class.getDeclaredField("originalBrowser");originalMember.setAccessible(true);
                    cleanupSource.set((NativeOriginalBrowserPreparation)originalMember.get(runtime));assertNotNull(cleanupSource.get());
                    stage="ENROLLED_SETTLE_AUTOMATIC_NAVIGATION";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,activity.get(),until,"KIOSK_08");
                    stage="ENROLLED_CAPTURE_ACTUAL_NATIVE_STATUS";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    int statusReadsBefore=server.statusReads;
                    queries.captureInitialStatus(activity.get(),until); // This explicit attempt still occurs ONCE.
                    assertTrue("Successful explicit status must advance actual HTTP count",server.statusReads>statusReadsBefore);
                    assertNotNull("Actual shipping Plugin status must capture native principal",runtime.readNotificationMutationPrincipal());
                    stage="ENROLLED_LOAD_EMPLOYEE";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(activity.get(),until,"https://localhost/employee-schedule.html","https://localhost/employee-schedule.html",false);
                    stage="ENROLLED_WAIT_FACTORY_COMMIT_BIRTH";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    JSONObject observed=null,nativeObserved=null;
                    while(android.os.SystemClock.elapsedRealtime()<until){
                        String raw=queries.readDocument(activity.get(),until);
                        if(raw!=null)try{
                            JSONObject value=new JSONObject(raw),nativeDocument=NativeRecurringApplicationSourceAndroidRuntimeTest.readNativeDocumentLifecycle(source);
                            if(android.os.SystemClock.elapsedRealtime()<until&&"https://localhost/employee-schedule.html".equals(value.optString("href"))
                                &&value.optBoolean("marker")&&value.optBoolean("mobile")&&value.optBoolean("security_initialized")
                                &&value.optBoolean("security_ready")&&value.optBoolean("security_available")
                                &&"enrolled".equals(value.optString("security_state"))&&"KIOSK_08".equals(value.optString("deviceId"))
                                &&!value.optBoolean("noPrincipal",true)&&"complete".equals(value.optString("readyState"))
                                &&nativeDocument.getBoolean("producerBirthObserved")&&nativeDocument.getBoolean("initialRegistrationAttempted")
                                &&nativeDocument.getLong("document")>0&&nativeDocument.getBoolean("documentCommitted")){
                                observed=value;nativeObserved=nativeDocument;break;
                            }
                        }catch(Exception notLoaded){}
                        android.os.SystemClock.sleep(25);
                    }
                    assertNotNull("Same ENROLLED employee document factories and actual native commit/birth required",observed);
                    assertNotNull(nativeObserved);assertSame(source,member.get(runtime));assertActive(engine.observeStateReadOnly(),server.credentialId);
                    double origin=observed.getDouble("timeOrigin");assertTrue(Double.isFinite(origin)&&origin>0);
                    stage="ENROLLED_CLOSE_SOURCE_AND_RELOAD_PLUGIN";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    scenario.onActivity(value->{source.close();plugin.load();});
                    var closed=NativeRecurringApplicationSource.class.getDeclaredField("closed");closed.setAccessible(true);
                    assertTrue(closed.getBoolean(source));assertSame(source,member.get(runtime));
                    stage="ENROLLED_RELOAD_SAME_EMPLOYEE";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(activity.get(),until,null,"https://localhost/employee-schedule.html",true);
                    stage="ENROLLED_WAIT_NEW_COMPLETE_ORIGINAL_DEADLINE";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                    queries.awaitCompleteDocument(activity.get(),until,"https://localhost/employee-schedule.html",origin,false);
                    assertTrue(closed.getBoolean(source));assertSame(source,member.get(runtime));assertSame(engine,runtime.engine);
                    assertActive(engine.observeStateReadOnly(),server.credentialId);assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                    stage="ENROLLED_ASSERTIONS_REACHED_END_BEFORE_SCENARIO_CLOSE";NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(stage);
                }catch(Exception|Error first){queries.diagnosticFailureSnapshot();NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticFirstThrowable(stage,first);throw first;}
            }
            // ActivityScenario.close has returned. Read ONLY captured objects'
            // volatile diagnostic fields; no Activity/WebView methods or UI work.
            String teardownStage="ENROLLED_AWAIT_ACTUAL_TEARDOWN_ORIGINAL_DEADLINE";
            NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage(teardownStage);
            try{
                long until=originalUntil.get();boolean[] host,cleanup;
                do{
                    host=flags(hostFlags,activity.get());cleanup=flags(cleanupFlags,cleanupSource.get());
                    if(host[2]&&cleanup[0]&&cleanup[1])break;
                    if(android.os.SystemClock.elapsedRealtime()>=until)break;
                    android.os.SystemClock.sleep(25);
                }while(true);
                long observed=android.os.SystemClock.elapsedRealtime();
                System.out.println("CUSTODIAL_APP_TEARDOWN_STATE elapsed="+observed+" originalUntil="+until
                    +" destroyStarted="+host[0]+" removed="+host[1]+" viewDestroyComplete="+host[2]
                    +" ownerJavaRetired="+cleanup[0]+" providerDisposalDelegated="+cleanup[1]
                    +" cleanupStarted="+cleanup[2]+" cleanupFinished="+cleanup[3]+" cleanupPostRefused="+cleanup[4]);
                assertTrue("Actual teardown must settle inside SAME original20s",until>0&&observed<until);
                assertTrue("Actual owner destroy and parent removal required",host[0]&&host[1]&&host[2]);
                assertTrue("Actual native owner Java retirement and delegated provider disposal required",cleanup[0]&&cleanup[1]);
                assertFalse("Owner-bound script removal must not run",cleanup[2]);
                assertFalse("No explicit provider removal completion is claimed",cleanup[3]);
                assertFalse("Owner-bound cleanup must not enqueue provider removal",cleanup[4]);
                NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticStage("ENROLLED_ACTUAL_VIEW_DESTROY_AND_OWNER_JAVA_RETIREMENT_OBSERVED");
            }catch(Exception|Error first){NativeRecurringApplicationSourceAndroidRuntimeTest.diagnosticFirstThrowable(teardownStage,first);throw first;}
            }finally{BridgeSmokeActivity.install(null);}
        }
        // Preserve attempted identities/UNKNOWN; no removal, reset or retry.
    }
    private static java.lang.reflect.Field[] fields(Class<?> owner,String... names)throws Exception{
        var result=new java.lang.reflect.Field[names.length];
        for(int i=0;i<names.length;i++){result[i]=owner.getDeclaredField(names[i]);result[i].setAccessible(true);}
        return result;
    }
    private static boolean[] flags(java.lang.reflect.Field[] fields,Object owner)throws Exception{
        assertNotNull(owner);boolean[] result=new boolean[fields.length];
        for(int i=0;i<fields.length;i++)result[i]=fields[i].getBoolean(owner);
        return result;
    }
    private static void assertActive(java.util.Map<String,Object> state,String credentialId){
        assertEquals(Boolean.TRUE,state.get("active"));assertEquals(Boolean.TRUE,state.get("credential_present"));
        assertEquals(Boolean.TRUE,state.get("credential_usable"));assertEquals(credentialId,state.get("active_credential_id"));
    }
}
