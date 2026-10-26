package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual EMPTY default owner follows shipping guarded recovery.
 * Stable enrolled employee factories are qualified by a separate fresh class.
 * No enrollment, schedule transport, OS settlement or receipt is asserted. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringApplicationSourceAndroidRuntimeTest {
    private int diagnosticUiQueryCount;
    private volatile JSONObject diagnosticLastDocument;
    private NativeRecurringApplicationSource diagnosticFailureSource;
    void recordFailureSource(NativeRecurringApplicationSource source){diagnosticFailureSource=source;}

    private static void diagnosticQueryStage(String stage,int query) {
        if(query>8)return;
        System.out.println("CUSTODIAL_RECURRING_DOCUMENT_QUERY stage="+stage+" query="+query
            +" elapsed="+android.os.SystemClock.elapsedRealtime()
            +" ui="+(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()));
    }
    @Test(timeout=90_000)
    public void actualEmptyRuntimeRecoversWithoutPrincipalAndNeverReplacesRetiredSource() throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();
        BridgeSmokeActivity.install(plugin);
        AtomicReference<BridgeSmokeActivity> activity=new AtomicReference<>();
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)) {
            String diagnosticStage="ACTIVITY_BODY_BEGIN";
            // ONE original browser budget includes automatic startup, guarded
            // recovery, explicit Source retirement and actual completed reload.
            long until=android.os.SystemClock.elapsedRealtime()+20_000;
            try {
                diagnosticStage(diagnosticStage);
                scenario.onActivity(value->{activity.set(value);
                    assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                var runtime=CustodialNativeRuntime.get(target);
                assertNativeEmpty(runtime.engine.observeStateReadOnly());
                var member=CustodialNativeRuntime.class.getDeclaredField("recurringApplication");member.setAccessible(true);
                NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)member.get(runtime);
                assertNotNull("Normal default plugin must mount actual packaged Source",source);
                recordFailureSource(source);
                diagnosticStage="SETTLE_ORIGINAL_AUTOMATIC_NAVIGATION";diagnosticStage(diagnosticStage);
                settleInitialNavigation(scenario,activity.get(),until,"");
                diagnosticStage="LOAD_NORMAL_EMPLOYEE_DOCUMENT";diagnosticStage(diagnosticStage);
                awaitExpectedNavigation(activity.get(),until,"https://localhost/employee-schedule.html","https://localhost/index.html?protected_recovery=1",false);
                diagnosticStage="WAIT_EMPTY_GUARDED_RECOVERY_ORIGINAL_DEADLINE";diagnosticStage(diagnosticStage);
                JSONObject recovered=awaitCompleteDocument(activity.get(),until,"https://localhost/index.html?protected_recovery=1",Double.NaN,true);
                assertEquals("unenrolled",recovered.getString("security_state"));
                assertEquals("",recovered.getString("deviceId"));
                assertTrue("EMPTY recovery must expose no principal",recovered.getBoolean("noPrincipal"));
                assertNativeEmpty(runtime.engine.observeStateReadOnly());assertSame(source,member.get(runtime));
                JSONObject nativeDocument=readNativeDocumentLifecycle(source);
                assertTrue("Normal initial Source registration must complete",nativeDocument.getBoolean("initialRegistrationAttempted"));
                assertTrue("Actual initial page-start callback required",nativeDocument.getLong("document")>0);
                // No employee birth assertion on an EMPTY owner: shipping
                // initialized+unenrolled security MUST leave that document.
                diagnosticStage="CLOSE_SOURCE_AND_RELOAD_PLUGIN";diagnosticStage(diagnosticStage);
                scenario.onActivity(value->{source.close();plugin.load();});
                assertSame("Later load cannot replace retired exact native Source",source,member.get(runtime));
                var closed=NativeRecurringApplicationSource.class.getDeclaredField("closed");closed.setAccessible(true);
                assertTrue(closed.getBoolean(source));
                double priorTimeOrigin=recovered.getDouble("timeOrigin");
                diagnosticStage="RELOAD_REAL_RECOVERY_WEBVIEW";diagnosticStage(diagnosticStage);
                awaitExpectedNavigation(activity.get(),until,null,"https://localhost/index.html?protected_recovery=1",true);
                diagnosticStage="WAIT_NEW_COMPLETE_RECOVERY_ORIGINAL_DEADLINE";diagnosticStage(diagnosticStage);
                JSONObject reloaded=awaitCompleteDocument(activity.get(),until,"https://localhost/index.html?protected_recovery=1",priorTimeOrigin,true);
                assertEquals("unenrolled",reloaded.getString("security_state"));assertEquals("",reloaded.getString("deviceId"));
                assertTrue(reloaded.getBoolean("noPrincipal"));assertTrue(closed.getBoolean(source));
                assertSame(source,member.get(runtime));assertNativeEmpty(runtime.engine.observeStateReadOnly());
                diagnosticStage="ASSERTIONS_REACHED_END_BEFORE_SCENARIO_CLOSE";diagnosticStage(diagnosticStage);
            }catch(Exception|Error firstFailure){diagnosticFailureSnapshot();diagnosticFirstThrowable(diagnosticStage,firstFailure);throw firstFailure;}
        }finally{BridgeSmokeActivity.install(null);}
    }
    /** Observe the actual terminal shell handoff, not an arbitrary stable
     * interval in the transient app-shell document. Both callback facts were
     * captured by the existing host listener from its original startup. */
    static void settleInitialNavigation(ActivityScenario<BridgeSmokeActivity> scenario,BridgeSmokeActivity owner,long until,String expectedDevice)throws Exception {
        java.util.concurrent.atomic.AtomicBoolean completed=new java.util.concurrent.atomic.AtomicBoolean();
        while(android.os.SystemClock.elapsedRealtime()<until){
            scenario.onActivity(value->{assertSame(owner,value);completed.set(value.hasCompletedInitialLegacyHome(expectedDevice));});
            if(completed.get()&&android.os.SystemClock.elapsedRealtime()<until)return;
            android.os.SystemClock.sleep(25);
        }
        fail("Original shell handoff must commit and load terminal Home inside original20s bound");
    }
    /** Observe this actual navigation before any JavaScript query. Loading
     * may legitimately exceed the query3s bound; it still spends ONLY the
     * original browser20s remainder. This is not a Source/currentness grant. */
    static void awaitExpectedNavigation(BridgeSmokeActivity activity,long until,String requested,String expected,boolean reload)throws Exception {
        var bridge=activity.getBridge();var view=bridge.getWebView();assertNotNull(view);
        CountDownLatch loaded=new CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean committed=new java.util.concurrent.atomic.AtomicBoolean();
        java.util.concurrent.atomic.AtomicBoolean observedLoaded=new java.util.concurrent.atomic.AtomicBoolean();
        var observer=new com.getcapacitor.WebViewListener(){
            @Override public void onPageStarted(android.webkit.WebView actual){if(actual==view){committed.set(false);observedLoaded.set(false);}}
            private void completeIfReady(android.webkit.WebView actual){
                if(actual==view&&committed.get()&&observedLoaded.get()&&expected.equals(view.getUrl())&&view.getProgress()==100)loaded.countDown();
            }
            @Override public void onPageCommitVisible(android.webkit.WebView actual,String url){
                if(actual==view&&expected.equals(url)&&expected.equals(view.getUrl())){committed.set(true);completeIfReady(actual);}
            }
            @Override public void onPageLoaded(android.webkit.WebView actual){
                if(actual==view&&expected.equals(view.getUrl())){observedLoaded.set(true);completeIfReady(actual);}
            }
        };
        try{
            assertTrue("Expected navigation must start inside original20s",android.os.SystemClock.elapsedRealtime()<until);
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
                bridge.addWebViewListener(observer); // BEFORE actual load/reload.
                if(reload){assertNull(requested);assertEquals(expected,view.getUrl());view.reload();}
                else{assertNotNull(requested);view.loadUrl(requested);}
            });
            long remaining=until-android.os.SystemClock.elapsedRealtime();
            assertTrue("Expected navigation requires original20s remainder",remaining>0);
            assertTrue("Actual same-view expected document must commit and load inside original20s",loaded.await(remaining,TimeUnit.MILLISECONDS));
            assertTrue("Actual navigation callback must precede original20s expiry",android.os.SystemClock.elapsedRealtime()<until);
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
                assertTrue("Expected commit must remain observed",committed.get());
                assertTrue("Expected load must remain observed",observedLoaded.get());
                assertEquals(expected,view.getUrl());assertEquals(100,view.getProgress());
            });
            assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        }finally{
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->bridge.removeWebViewListener(observer));
        }
    }
    /** Same actual registered Plugin/HTTPS status capture as normal vendor
     * qualification. One attempt only, no response DATA/principal injection.
     * Every readiness observation and callback spends the ORIGINAL deadline. */
    void captureInitialStatus(BridgeSmokeActivity activity,long until)throws Exception {
        boolean ready=false;
        while(android.os.SystemClock.elapsedRealtime()<until){
            String raw=readDocument(activity,until);
            if(raw!=null&&new JSONObject(raw).optBoolean("nativePromise")
                &&android.os.SystemClock.elapsedRealtime()<until){ready=true;break;}
            android.os.SystemClock.sleep(25);
        }
        assertTrue("Actual normal nativePromise must be ready inside original20s",ready);
        String key="__custodialInitialStatusQualifier"+java.util.UUID.randomUUID().toString().replace("-","");
        String js="(()=>{const key="+JSONObject.quote(key)+";if(Object.hasOwn(globalThis,key))throw Error('Existing qualifier owner');"
            +"const r={done:false};Object.defineProperty(globalThis,key,{value:r});"
            +"Promise.resolve().then(()=>Capacitor.nativePromise('CustodialNativeVault','authorizedRequest',"
            +"{device_id:'KIOSK_08',path:'/device-auth/status?device_id=KIOSK_08',method:'GET',headers:{},body_base64:''}))"
            +".then(()=>{r.ok=true;r.done=true;},()=>{r.ok=false;r.done=true;});})()";
        assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(js,null));
        while(android.os.SystemClock.elapsedRealtime()<until){
            CountDownLatch done=new CountDownLatch(1);AtomicReference<String> raw=new AtomicReference<>();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(
                "JSON.stringify(globalThis["+JSONObject.quote(key)+"])",value->{
                    try{Object parsed=new org.json.JSONTokener(value).nextValue();if(parsed instanceof String)raw.set((String)parsed);}
                    catch(Exception malformed){}finally{done.countDown();}
                }));
            long remaining=until-android.os.SystemClock.elapsedRealtime();
            assertTrue("Status query requires original20s remainder",remaining>0);
            assertTrue("Status query must settle",done.await(Math.min(3000L,remaining),TimeUnit.MILLISECONDS));
            if(raw.get()!=null){JSONObject result=new JSONObject(raw.get());
                if(result.optBoolean("done")&&android.os.SystemClock.elapsedRealtime()<until){
                    assertTrue("Actual original status Plugin request refused; never retry",result.getBoolean("ok"));return;
                }
            }
            android.os.SystemClock.sleep(25);
        }
        throw new AssertionError("Original status attempt unresolved inside original20s; no retry or UNKNOWN cleanup");
    }
    JSONObject awaitCompleteDocument(BridgeSmokeActivity activity,long until,String href,double previousOrigin,boolean requireEmpty)throws Exception {
        while(android.os.SystemClock.elapsedRealtime()<until){
            String raw=readDocument(activity,until);
            if(raw!=null)try{
                JSONObject value=new JSONObject(raw);double origin=value.optDouble("timeOrigin",Double.NaN);
                boolean state=!requireEmpty||(value.optBoolean("mobile")&&value.optBoolean("security_initialized")
                    &&"unenrolled".equals(value.optString("security_state"))&&"".equals(value.optString("deviceId"))&&value.optBoolean("noPrincipal"));
                if(android.os.SystemClock.elapsedRealtime()<until&&href.equals(value.optString("href"))
                    &&"complete".equals(value.optString("readyState"))&&Double.isFinite(origin)&&origin>0
                    &&(!Double.isFinite(previousOrigin)||origin!=previousOrigin)&&state)return value;
            }catch(Exception notCommitted){}
            android.os.SystemClock.sleep(25);
        }
        throw new AssertionError("Actual complete document and required state did not settle inside original20s bound");
    }
    /** FAILURE ONLY. Last completed UI scalar observation and separately
     * failure-time native fields are DATA, not an atomic/currentness snapshot. */
    void diagnosticFailureSnapshot(){
        JSONObject last=diagnosticLastDocument,nativeData=null;
        try{if(diagnosticFailureSource!=null)nativeData=readNativeDocumentLifecycle(diagnosticFailureSource);}
        catch(Exception unavailable){} // No raw exception/input export.
        String href=last==null?null:last.optString("href",null);
        String hrefKind="https://localhost/employee-schedule.html".equals(href)?"EMPLOYEE":
            "https://localhost/index.html?protected_recovery=1".equals(href)?"PROTECTED_RECOVERY":
            "https://localhost/index.html".equals(href)?"INDEX":
            "https://localhost/app-shell.html".equals(href)?"APP_SHELL":"OTHER_OR_UNKNOWN";
        String state=last==null?null:last.optString("security_state",null);
        String stateKind=java.util.Set.of("enrolled","unenrolled","unchecked","quarantined","unavailable","removing").contains(state==null?"":state)?state:"OTHER_OR_UNKNOWN";
        String ready=last==null?null:last.optString("readyState",null);
        String readyKind=java.util.Set.of("complete","interactive","loading").contains(ready==null?"":ready)?ready:"OTHER_OR_UNKNOWN";
        System.out.println("CUSTODIAL_RECURRING_FAILURE_LAST_UI available="+(last!=null)+" hrefKind="+hrefKind+" securityState="+stateKind
            +" readyState="+readyKind+" marker="+diagnosticFlag(last,"marker")+" mobile="+diagnosticFlag(last,"mobile")
            +" initialized="+diagnosticFlag(last,"security_initialized")+" ready="+diagnosticFlag(last,"security_ready")
            +" availableFlag="+diagnosticFlag(last,"security_available")+" noPrincipal="+diagnosticFlag(last,"noPrincipal"));
        System.out.println("CUSTODIAL_RECURRING_FAILURE_NATIVE_AT_FAILURE available="+(nativeData!=null)
            +" initialRegistrationAttempted="+diagnosticFlag(nativeData,"initialRegistrationAttempted")
            +" producerBirthObserved="+diagnosticFlag(nativeData,"producerBirthObserved")
            +" documentCommitted="+diagnosticFlag(nativeData,"documentCommitted")
            +" document="+(nativeData==null?"UNKNOWN":String.valueOf(nativeData.optLong("document",-1))));
    }
    private static String diagnosticFlag(JSONObject value,String key){
        Object flag=value==null?null:value.opt(key);return flag instanceof Boolean?String.valueOf(flag):"UNKNOWN";
    }
    // Fixed bounded diagnostic DATA only. Retain the original throwable before
    // ActivityScenario.close can obscure it with a secondary renderer failure.
    static void diagnosticStage(String stage) {
        System.out.println("CUSTODIAL_RECURRING_MOUNT_STAGE "+stage);
    }
    static void diagnosticFirstThrowable(String stage,Throwable first) {
        System.out.println("CUSTODIAL_RECURRING_MOUNT_FIRST_THROWABLE stage="+stage);
        Throwable current=first;
        for(int cause=0;current!=null&&cause<4;cause++) {
            String message=String.valueOf(current.getMessage()).replace('\n',' ').replace('\r',' ');
            System.out.println("cause="+cause+" type="+current.getClass().getName()+" message="
                +message.substring(0,Math.min(message.length(),512)));
            StackTraceElement[] stack=current.getStackTrace();
            for(int i=0;i<Math.min(stack.length,64);i++)System.out.println("  at "+stack[i]);
            current=current.getCause();
        }
    }
    static JSONObject readNativeDocumentLifecycle(NativeRecurringApplicationSource source)throws Exception {
        // Read only real existing native fields under their same owner monitor.
        // No field write, Source creation, provider injection or readiness DTO.
        JSONObject value=new JSONObject();
        synchronized(source){
            for(String name:new String[]{"producerBirthObserved","initialRegistrationAttempted","documentCommitted"}){
                var field=NativeRecurringApplicationSource.class.getDeclaredField(name);field.setAccessible(true);
                value.put(name,field.getBoolean(source));
            }
            var field=NativeRecurringApplicationSource.class.getDeclaredField("document");field.setAccessible(true);
            value.put("document",field.getLong(source));
        }
        return value;
    }
    static void assertNativeEmpty(java.util.Map<String,Object> observed) {
        assertEquals("EMPTY",observed.get("state"));
        assertEquals(Boolean.FALSE,observed.get("active"));
        assertEquals(Boolean.FALSE,observed.get("credential_present"));
        assertEquals(Boolean.FALSE,observed.get("credential_usable"));
        assertEquals("",observed.get("active_credential_id"));
    }
    String readDocument(BridgeSmokeActivity activity,long originalUntil)throws Exception {
        assertTrue("Actual document query must start inside the original20s bound",
            android.os.SystemClock.elapsedRealtime()<originalUntil);
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> raw=new AtomicReference<>();
        final int diagnosticQuery=++diagnosticUiQueryCount;
        diagnosticQueryStage("ENQUEUE_BEFORE",diagnosticQuery);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            diagnosticQueryStage("UI_EVALUATE_BEFORE",diagnosticQuery);
            activity.getBridge().getWebView().evaluateJavascript(
            "(()=>{const status=window.MemphisCustodialSecurity?.getStatus?.();return JSON.stringify({"
            +"href:location.href,marker:!!Object.getOwnPropertyDescriptor(globalThis,'custodialNativeNormalApplicationOwner'),"
            +"mobile:!!window.MemphisMobile,nativePromise:typeof globalThis.Capacitor?.nativePromise==='function',security_initialized:status?.initialized===true,security_ready:status?.ready===true,security_available:status?.available===true,security_state:status?.state??null,"
            +"deviceId:status?.deviceId??null,noPrincipal:status?.principal===null,"
            +"timeOrigin:performance.timeOrigin,readyState:document.readyState});})()",value->{
                diagnosticQueryStage("CALLBACK_BEFORE",diagnosticQuery);
                try{raw.set((String)new org.json.JSONTokener(value).nextValue());
                    try{diagnosticLastDocument=new JSONObject(raw.get());}catch(Exception notObject){}
                }catch(Exception malformed){}finally{done.countDown();}
                diagnosticQueryStage("CALLBACK_AFTER",diagnosticQuery);
            });
            diagnosticQueryStage("UI_EVALUATE_AFTER",diagnosticQuery);
        });
        diagnosticQueryStage("ENQUEUE_AFTER",diagnosticQuery);
        long remaining=originalUntil-android.os.SystemClock.elapsedRealtime();
        assertTrue("Actual document query requires remainder of the original20s bound",remaining>0);
        assertTrue("Actual WebView document query must settle",done.await(Math.min(3000L,remaining),TimeUnit.MILLISECONDS));return raw.get();
    }
}
