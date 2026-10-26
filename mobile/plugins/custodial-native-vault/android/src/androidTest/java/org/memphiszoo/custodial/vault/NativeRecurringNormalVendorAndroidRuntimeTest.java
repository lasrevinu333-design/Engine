package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.net.ssl.HttpsURLConnection;
import org.json.*;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual SAME default Runtime/Engine and normal installed vendor/OS calls.
 * Server DATA is synthetic, not TLS/SQL/live enrollment. All receipt flags
 * remain false; no browser/OS settlement or typed delivery receipt is proved. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringNormalVendorAndroidRuntimeTest {
    private static final String DEVICE="KIOSK_08",EMPLOYEE="95000000-0000-4000-8000-000000000002";
    private static final int IMMEDIATE=180081,FUTURE=180082;
    @Test(timeout=90_000)
    public void actualDefaultOwnerNormalVendorRetainsOriginalsWithoutReceipt()throws Exception {
        boolean selected=false;
        try {selected=Class.forName("org.memphiszoo.custodial.vault.test.BuildConfig").getField("CUSTODIAL_NOTIFICATION_RUNTIME").getBoolean(null);}
        catch(ClassNotFoundException|NoSuchFieldException defaultProfile){}
        Assume.assumeTrue("Explicit normal vendor qualification APK required",selected);
        Context target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        assertEquals("org.memphiszoo.custodial.vault.test",target.getPackageName());assertReceivers(target);
        // Resolve the ACTUAL manifest owner before enrollment/first OS effect.
        // No fabricated Intent or vendor null fallback may hide profile drift.
        Intent launch=target.getPackageManager().getLaunchIntentForPackage(target.getPackageName());
        assertNotNull("Normal vendor profile requires an actual launcher Intent",launch);
        assertNotNull("Actual launcher component required",launch.getComponent());
        assertEquals(Intent.ACTION_MAIN,launch.getAction());
        assertNotNull("Actual launcher category required",launch.getCategories());
        assertTrue(launch.getCategories().contains(Intent.CATEGORY_LAUNCHER));
        assertEquals(target.getPackageName(),launch.getComponent().getPackageName());
        assertEquals(BridgeSmokeActivity.class.getName(),launch.getComponent().getClassName());
        NotificationManager os=target.getSystemService(NotificationManager.class);assertNotNull(os);
        assertEquals(0,os.getActiveNotifications().length);
        // ONLY the freshly guarded disposable own test package, never a real
        // installation or global setting. Root reviews this before execution.
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
        assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,target.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS));
        try(OwnedHttpsFixture server=new OwnedHttpsFixture()) {
            server.installBeforeDefaultRuntime(); // Existing factory => hard refusal, never reset/adopt.
            CustodialNativeRuntime runtime=CustodialNativeRuntime.get(target);VaultEngine engine=runtime.engine;
            assertEquals("EMPTY",engine.observeStateReadOnly().get("state"));
            char[] code="12345678".toCharArray();
            try {engine.enroll(server.operation,DEVICE,"enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
            assertTrue(Boolean.TRUE.equals(engine.observeStateReadOnly().get("active")));
            assertSame(runtime,CustodialNativeRuntime.get(target));
            CustodialNativeVaultPlugin vault=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(vault);
            AtomicReference<BridgeSmokeActivity> actual=new AtomicReference<>();
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)) {
                scenario.onActivity(activity->{actual.set(activity);
                    assertSame(vault,activity.getBridge().getPlugin("CustodialNativeVault").getInstance());
                    var vendor=activity.getBridge().getPlugin("LocalNotifications");assertNotNull(vendor);
                    assertEquals(com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin.class,vendor.getInstance().getClass());
                });
                requireCommittedNormalBridgeDocument(actual.get());
                // Actual registered normal Plugin route produces native journal
                // from its actual authorized response. No principal store write.
                call(actual.get(),"CustodialNativeVault","authorizedRequest",new JSONObject().put("device_id",DEVICE)
                    .put("path","/device-auth/status?device_id="+DEVICE).put("method","GET")
                    .put("headers",new JSONObject()).put("body_base64",""));
                NativeProviderPrincipal principal=runtime.readNotificationMutationPrincipal();assertNotNull(principal);
                assertTrue(server.statusReads>0);assertSame(engine,runtime.engine);
                assertEquals(server.credentialId,engine.observeStateReadOnly().get("active_credential_id"));
                call(actual.get(),"LocalNotifications","schedule",new JSONObject().put("notifications",new JSONArray().put(notification(IMMEDIATE,principal,null))));
                JSONObject sent=mutation(runtime,IMMEDIATE);assertEquals("DISPATCH_CALLED",sent.getString("state"));
                assertFalse(sent.getBoolean("receipt_eligible"));assertNotNull(sent.getJSONObject("post_effect_frame"));
                assertTrue(Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==IMMEDIATE));
                call(actual.get(),"LocalNotifications","removeAllDeliveredNotifications",new JSONObject());
                assertEquals("CANCEL_CALLED",mutation(runtime,IMMEDIATE).getString("state"));
                assertFalse(Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==IMMEDIATE));
                String at=DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT).withZone(ZoneOffset.UTC)
                    .format(Instant.ofEpochMilli(System.currentTimeMillis()+600_000));
                JSONObject future=notification(FUTURE,principal,at);
                call(actual.get(),"LocalNotifications","schedule",new JSONObject().put("notifications",new JSONArray().put(future)));
                JSONObject before=mutation(runtime,FUTURE);String generation=before.getString("generation"),original=before.getString("raw_notification");
                assertEquals("SCHEDULE_CALLED",before.getString("state"));
                // Actual normal receiver owner path; explicit invocation is NOT
                // a system reboot/boot-broadcast/hardware delivery claim.
                new com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver().onReceive(target,
                    new Intent(target,com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver.class));
                JSONObject restored=mutation(runtime,FUTURE);assertEquals(generation,restored.getString("generation"));
                assertEquals("RESTORE_CALLED",restored.getString("state"));assertTrue("Original notification DATA changed",original.equals(restored.getString("raw_notification")));
                assertFalse(restored.getBoolean("receipt_eligible"));
                call(actual.get(),"LocalNotifications","cancel",new JSONObject().put("notifications",new JSONArray().put(new JSONObject().put("id",FUTURE))));
                JSONObject cancelled=mutation(runtime,FUTURE);assertEquals(generation,cancelled.getString("generation"));
                assertEquals("CANCEL_CALLED",cancelled.getString("state"));
                Map<String,String> retained=Map.copyOf(runtime.offlineStore.recurringRecords());
                rejected(actual.get(),"LocalNotifications","schedule",new JSONObject().put("notifications",new JSONArray().put(future)));
                assertTrue("Exact original WORK frame changed",retained.equals(runtime.offlineStore.recurringRecords()));
                assertFalse(Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==FUTURE));
                rejected(actual.get(),"LocalNotifications","cancel",new JSONObject().put("notifications",new JSONArray().put(new JSONObject().put("id",FUTURE))));
                rejected(actual.get(),"LocalNotifications","removeDeliveredNotifications",new JSONObject().put("notifications",new JSONArray().put(new JSONObject().put("id",FUTURE))));
                assertTrue("Rejected original calls changed recurring WORK",retained.equals(runtime.offlineStore.recurringRecords()));
                // Real receiver, cancelled-generation false path: no notify or
                // new attempt. A foreign generation also refuses before effect.
                android.app.Notification cancelledNotification=new android.app.Notification.Builder(target)
                    .setGroup(future.getString("group")).build();
                Intent cancelledDelivery=new Intent(target,com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher.class)
                    .putExtra(com.capacitorjs.plugins.localnotifications.LocalNotificationManager.NOTIFICATION_INTENT_KEY,FUTURE)
                    .putExtra(com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher.NOTIFICATION_KEY,cancelledNotification)
                    .putExtra(CustodialNativeNotificationWriter.GENERATION_EXTRA,generation);
                new com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher().onReceive(target,cancelledDelivery);
                cancelledDelivery.putExtra(CustodialNativeNotificationWriter.GENERATION_EXTRA,java.util.UUID.randomUUID().toString());
                new com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher().onReceive(target,cancelledDelivery);
                assertTrue("Rejected receiver changed recurring WORK",retained.equals(runtime.offlineStore.recurringRecords()));
                assertFalse(Arrays.stream(os.getActiveNotifications()).anyMatch(row->row.getId()==FUTURE));
                int exchanges=server.authorizedExchanges;
                assertThrows(VaultFailure.class,()->engine.authorizedRequest(DEVICE,new AuthorizedRequest(
                    "/schedule-api/my-day-summary/delivery-receipt","POST",Map.of("Content-Type","application/json"),"{}".getBytes(StandardCharsets.UTF_8))));
                assertEquals(exchanges,server.authorizedExchanges);assertTrue("Exact original WORK frame changed",retained.equals(runtime.offlineStore.recurringRecords()));
                assertSame(engine,runtime.engine);assertSame(runtime,CustodialNativeRuntime.get(target));
                System.out.println("CUSTODIAL_NORMAL_VENDOR_RESULT tracked=2 dispatchCalled=1 cancelCalled=2 sameRuntime=true sameEngine=true receiptEligible=false retainedRows="+retained.size());
            } finally {BridgeSmokeActivity.install(null);}
        }
        // No blanket cancellation, enrollment removal or key/store clearing on
        // failure. Root preserves receipts before retiring this own test target.
    }
    /** Stabilize only the existing normal instrumentation bridge document.
     * No custom HTML, new server URL, native source revival or readiness grant.
     * This qualifier claims actual plugin/OS owners, not normal employee UI. */
    private static void requireCommittedNormalBridgeDocument(BridgeSmokeActivity activity)throws Exception {
        final String expected="https://localhost/bridge-smoke.html";
        var view=activity.getBridge().getWebView();CountDownLatch commit=new CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean failed=new java.util.concurrent.atomic.AtomicBoolean();
        var observer=new com.getcapacitor.WebViewListener(){
            @Override public void onPageCommitVisible(android.webkit.WebView actual,String url){
                if(actual==view&&expected.equals(url))commit.countDown();
            }
            @Override public void onReceivedError(android.webkit.WebView actual){if(actual==view){failed.set(true);commit.countDown();}}
            @Override public void onReceivedHttpError(android.webkit.WebView actual){if(actual==view){failed.set(true);commit.countDown();}}
        };
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                activity.getBridge().addWebViewListener(observer);view.loadUrl(expected);
            });
            assertTrue("Exact normal bridge document must commit",commit.await(20,TimeUnit.SECONDS));
            assertFalse("Normal document navigation failed",failed.get());
            long until=android.os.SystemClock.elapsedRealtime()+20_000;
            while(android.os.SystemClock.elapsedRealtime()<until){
                String raw=query(activity,"JSON.stringify({href:location.href,complete:document.readyState==='complete',nativePromise:typeof Capacitor?.nativePromise==='function'})");
                if(raw!=null){JSONObject value=new JSONObject(raw);
                    if(expected.equals(value.optString("href"))&&value.optBoolean("complete")&&value.optBoolean("nativePromise"))return;
                }
                android.os.SystemClock.sleep(25);
            }
            throw new AssertionError("Actual normal native bridge document unavailable; no plugin attempt issued");
        } finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().removeWebViewListener(observer));}
    }
    private static void assertReceivers(Context context)throws Exception {
        for(Class<?> type:new Class<?>[]{com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher.class,
            com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver.class,
            com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver.class}) {
            var info=context.getPackageManager().getReceiverInfo(new android.content.ComponentName(context,type),0);
            assertTrue(info.enabled);assertEquals(context.getApplicationInfo().uid,info.applicationInfo.uid);
        }
    }
    private static JSONObject notification(int id,NativeProviderPrincipal principal,String at)throws Exception {
        JSONObject n=new JSONObject().put("id",id).put("title","Disposable normal native qualifier").put("body","Synthetic fixture notification")
            .put("group","mz-custodial-owned:"+UUID.randomUUID()).put("extra",new JSONObject().put("native_presentation_id",String.valueOf(id))
                .put("native_presentation_principal",principal.json().toString()));
        if(at!=null)n.put("schedule",new JSONObject().put("at",at));return n;
    }
    private static JSONObject mutation(CustodialNativeRuntime runtime,int id)throws Exception {
        JSONObject found=null;
        for(var entry:runtime.offlineStore.recurringRecords().entrySet())if(entry.getKey().startsWith(NativeRecurringTargetJournal.MUTATION_PREFIX)) {
            JSONObject row=new JSONObject(entry.getValue());if(row.getInt("id")!=id)continue;
            assertTrue("One original native generation only",found==null);found=row;
        }
        assertNotNull("Actual native mutation generation missing",found);return found;
    }
    private static JSONObject call(BridgeSmokeActivity a,String p,String m,JSONObject args)throws Exception {
        JSONObject r=once(a,p,m,args);assertTrue("Actual normal Plugin operation refused",r.getBoolean("ok"));return r;
    }
    private static void rejected(BridgeSmokeActivity a,String p,String m,JSONObject args)throws Exception {
        JSONObject result=once(a,p,m,args);
        assertFalse("Known original must refuse resubmission",result.getBoolean("ok"));
        assertEquals("Actual PluginCall must reject the fixed expected refusal",
            "custodial_native_recurring_journal_pending",result.getString("error"));
    }
    private static JSONObject once(BridgeSmokeActivity activity,String plugin,String method,JSONObject args)throws Exception {
        String key="__custodialOwnedVendorQualifier"+UUID.randomUUID().toString().replace("-","");
        String js="(()=>{const key="+JSONObject.quote(key)+";if(Object.hasOwn(globalThis,key))throw Error('Existing qualifier owner');"
            +"const r={done:false};Object.defineProperty(globalThis,key,{value:r});"
            +"Promise.resolve().then(()=>Capacitor.nativePromise("+JSONObject.quote(plugin)+","+JSONObject.quote(method)+","+args.toString()+"))"
            +".then(()=>{r.ok=true;r.done=true;},e=>{r.ok=false;r.error=typeof e?.message==='string'?e.message:null;r.done=true;});})()";
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(js,null));
        long end=android.os.SystemClock.elapsedRealtime()+20_000;
        while(android.os.SystemClock.elapsedRealtime()<end) {
            String raw=query(activity,"JSON.stringify(globalThis["+JSONObject.quote(key)+"])");
            if(raw!=null){JSONObject result=new JSONObject(raw);if(result.optBoolean("done"))return result;}
            android.os.SystemClock.sleep(25);
        }
        throw new AssertionError("Original plugin attempt unresolved; no resubmit or cleanup of unknown work");
    }
    private static String query(BridgeSmokeActivity a,String script)throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> raw=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->a.getBridge().getWebView().evaluateJavascript(script,value->{
            try{Object p=new JSONTokener(value).nextValue();if(p instanceof String)raw.set((String)p);}catch(Exception malformed){}finally{done.countDown();}
        }));
        assertTrue("Actual WebView query must settle",done.await(3,TimeUnit.SECONDS));return raw.get();
    }
    static final class OwnedHttpsFixture implements AutoCloseable {
        final String operation=UUID.randomUUID().toString(),credentialId=UUID.randomUUID().toString();
        private final char[] credential=(credentialId+"."+UUID.randomUUID()+UUID.randomUUID()).toCharArray();
        private final Set<String> ids=new HashSet<>();private boolean installed;private volatile boolean closed;
        volatile int enrolls,confirms,statusReads,authorizedExchanges;
        final NativeRecurringScheduleReplyFixture recurringSchedule;
        NativeRecurringOrdinaryCommitReplyFixture ordinaryCommit;
        private JSONObject ownedStatusAssignment; // Explicit synthetic server state, never a native principal setter.
        synchronized void reassignOwnedStatus(String employee,long epoch)throws Exception {
            if(ownedStatusAssignment!=null||employee==null||!employee.matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")
                ||EMPLOYEE.equals(employee)||epoch!=8)throw new AssertionError("Only one fixed synthetic assignment transition");
            ownedStatusAssignment=new JSONObject().put("employee_id",employee).put("assignment_epoch",epoch);
        }
        OwnedHttpsFixture(){this(false);}
        OwnedHttpsFixture(boolean withRecurringSchedule){
            recurringSchedule=withRecurringSchedule?new NativeRecurringScheduleReplyFixture():null;
        }
        void installBeforeDefaultRuntime(){assertFalse(installed);installed=true;
            URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){
                @Override protected URLConnection openConnection(URL url)throws IOException {
                    if(closed||!"https".equals(url.getProtocol())||!"memphis-zoo-mcp.onrender.com".equals(url.getHost())
                        ||url.getPort()!=-1||url.getUserInfo()!=null)throw new IOException("Owned fixed HTTPS route refused");
                    return new Connection(url);
                }
            }:null);
        }
        @Override public synchronized void close(){
            closed=true;VaultValidation.wipe(credential);
            // Keep attempted identities/unknown outcomes for this original owner.
        }
        private static final class WipeBuffer extends ByteArrayOutputStream {void wipe(){Arrays.fill(buf,(byte)0);reset();}}
        private final class Connection extends HttpsURLConnection {
            private final Map<String,String> headers=new HashMap<>();private final WipeBuffer sent=new WipeBuffer();
            private byte[] response;private int status;private boolean attempted;
            Connection(URL url){super(url);}
            @Override public void setRequestProperty(String k,String v){headers.put(k,v);}
            @Override public OutputStream getOutputStream(){return sent;}
            @Override public int getResponseCode()throws IOException {synchronized(OwnedHttpsFixture.this){
                if(attempted||closed)throw new IOException("Original fixture exchange already attempted or unknown");attempted=true;
                byte[] body=sent.toByteArray();try {
                    if(!"https://localhost".equals(headers.get("Origin"))||!"custodial".equals(headers.get("X-Memphis-App-Edition"))
                        ||!DEVICE.equals(headers.get("X-Device-Id")))throw new IOException("Actual native owner headers differ");
                    String path=url.getPath();JSONObject data;
                    if("/custodial-device-auth/enroll".equals(path)&&"POST".equals(getRequestMethod())) {
                        if(++enrolls!=1)throw new IOException("Original enrollment reused");JSONObject q=ProviderWireJson.object(body,65536);
                        if(!operation.equals(q.get("operation_id"))||!DEVICE.equals(q.get("device_id"))||!"enrollment".equals(q.get("flow"))
                            ||!"12345678".equals(q.get("enrollment_code")))throw new IOException("Original enrollment differs");
                        data=new JSONObject().put("operation_id",operation).put("device_id",DEVICE).put("flow","enrollment")
                            .put("device_credential",new String(credential)).put("credential_id",credentialId)
                            .put("credential_expires_at",Instant.ofEpochMilli(System.currentTimeMillis()+86_400_000).toString())
                            .put("resume_expires_at",Instant.ofEpochMilli(System.currentTimeMillis()+600_000).toString())
                            .put("device_name","Synthetic owned qualifier").put("employee",new JSONObject().put("id",EMPLOYEE).put("name","Synthetic employee"));
                    }else {
                        if(!("Device "+new String(credential)).equals(headers.get("Authorization"))||!new String(credential).equals(headers.get("X-Device-Credential")))
                            throw new IOException("Actual native synthetic credential header differs");
                        if(("/custodial-device-auth/enrollment-operations/"+operation+"/confirm").equals(path)&&"POST".equals(getRequestMethod())) {
                            if(++confirms!=1)throw new IOException("Original confirmation reused");JSONObject q=ProviderWireJson.object(body,65536);
                            if(!operation.equals(q.get("operation_id"))||!DEVICE.equals(q.get("device_id")))throw new IOException("Original confirmation differs");
                            data=new JSONObject().put("operation_id",operation);
                        }else {
                            authorizedExchanges++;String id=headers.get("X-Memphis-Native-Request-Id");
                            if(id==null||!ids.add(id))throw new IOException("Native original request reused");
                            if(recurringSchedule!=null&&"/schedule-api/my-day-summary".equals(path)
                                &&"GET".equals(getRequestMethod())&&body.length==0){
                                // Fixed synthetic backend DATA only, AFTER the
                                // unchanged actual credential/request-id checks.
                                String expected="device_id="+DEVICE;
                                if(!expected.equals(url.getQuery()))throw new IOException("Fixed schedule query differs");
                                status=200;response=recurringSchedule.response(DEVICE,EMPLOYEE,credentialId);
                                if(ordinaryCommit!=null)response=ordinaryCommit.issue(response);
                                return status;
                            }
                            if(ordinaryCommit!=null&&NativeRecurringOrdinaryDeliveryWire.PATH.equals(path)){
                                status=ordinaryCommit.exchange(getRequestMethod(),url.getQuery(),headers,body);
                                response=ordinaryCommit.response();return status;
                            }
                            if(!"/device-auth/status".equals(path)||!"GET".equals(getRequestMethod())||body.length!=0)
                                throw new IOException("Unserved original route unresolved; no real network fallback");
                            statusReads++;data=new JSONObject().put("authenticated",true).put("canonical_device_id",DEVICE)
                                .put("credential_id",credentialId).put("employee_id",EMPLOYEE).put("assignment_epoch",7);
                            if(ownedStatusAssignment!=null)data.put("employee_id",ownedStatusAssignment.get("employee_id"))
                                .put("assignment_epoch",ownedStatusAssignment.get("assignment_epoch"));
                        }
                    }
                    status=200;response=new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);return status;
                }catch(IOException e){throw e;}catch(Exception e){throw new IOException("Owned synthetic response DATA refused");}
                finally{Arrays.fill(body,(byte)0);sent.wipe();}
            }}
            @Override public Map<String,List<String>> getHeaderFields(){return Map.of("Content-Type",List.of("application/json;charset=utf-8"));}
            @Override public InputStream getInputStream(){return new ByteArrayInputStream(response);}
            @Override public InputStream getErrorStream(){return getInputStream();}
            @Override public void disconnect(){headers.clear();sent.wipe();if(response!=null)Arrays.fill(response,(byte)0);response=null;}
            @Override public boolean usingProxy(){return false;}@Override public void connect(){}
            @Override public String getCipherSuite(){return "OWNED_SYNTHETIC_NOT_TLS";}
            @Override public Certificate[] getLocalCertificates(){return null;}@Override public Certificate[] getServerCertificates(){return null;}
        }
    }
}
