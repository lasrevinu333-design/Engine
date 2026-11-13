package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Normal Android default Runtime/Keystore/prefs/Plugin/WebView original transport
 * to Root's actually isolated SQL server. NFC UID/tech inputs and enrollment are
 * explicitly synthetic test prerequisites. NOT TLS, physical NFC, real manager
 * or a Dashboard receiver. No accepted row, native journal or purpose is seeded.
 */
@RunWith(AndroidJUnit4.class)
public final class NativeScanOriginalSqlAndroidRuntimeTest {
    private static final String DEVICE="KIOSK_08",LOCATION="SYNTHETIC_ACCEPTED_ORIGINAL";
    @Test(timeout=90_000) public void sameTagOriginalStartAndFinishConsumeActualSqlAndNativeJournal()throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        assertEquals("org.memphiszoo.custodial.vault.test",target.getPackageName());
        String value=InstrumentationRegistry.getArguments().getString("custodial.scanSqlPort","");
        assertTrue("Root-owned isolated loopback port required; no synthetic fallback",value.matches("[1-9][0-9]{0,4}"));
        try(var loan=new NativeScanSqlLoanHttpsFixture(Integer.parseInt(value))){
            loan.installBeforeDefaultRuntime();var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            String operation=UUID.randomUUID().toString();char[] code="12345678".toCharArray();
            try{engine.enroll(operation,DEVICE,"enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(operation);engine.confirmEnrollment(operation);
            CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            var host=new AtomicReference<BridgeSmokeActivity>();var sourceRef=new AtomicReference<NativeRecurringApplicationSource>();
            final long[] originalUntil={0};
            Throwable primaryFailure=null;
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                long until=SystemClock.elapsedRealtime()+20_000;originalUntil[0]=until;
                var sourceField=CustodialNativeRuntime.class.getDeclaredField("recurringApplication");sourceField.setAccessible(true);
                sourceRef.set((NativeRecurringApplicationSource)sourceField.get(runtime));assertNotNull(sourceRef.get());
                scenario.onActivity(activity->{host.set(activity);assertSame(plugin,activity.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                var activity=host.get();assertNotNull(activity);
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,activity,until,DEVICE);
                new NativeRecurringApplicationSourceAndroidRuntimeTest().captureInitialStatus(activity,until);
                assertNotNull(runtime.readNotificationMutationPrincipal());
                JSONObject snapshot=rpc(activity,until,"tool_get_offline_scan_authority_snapshot",new JSONObject().put("p_device_id",DEVICE));
                assertEquals("95000000-0000-4000-8000-000000000002",snapshot.getString("employee_id"));
                assertEquals("95000000-0000-4000-8000-000000000004",snapshot.getString("credential_id"));
                assertEquals(7,snapshot.getInt("assignment_epoch"));
                JSONObject anchor=call(activity,until,"anchorOfflineAuthoritySnapshot",new JSONObject().put("device_id",DEVICE)
                    .put("snapshot_id",snapshot.get("snapshot_id")).put("generated_at",snapshot.get("generated_at"))
                    .put("expires_at",snapshot.get("expires_at")).put("snapshot",snapshot));
                assertTrue(anchor.getBoolean("anchored"));
                assertTrue(call(activity,until,"authorizeOfflineNewWork",new JSONObject().put("device_id",DEVICE)
                    .put("snapshot_id",snapshot.get("snapshot_id"))).getBoolean("authorized"));
                String session=UUID.randomUUID().toString(),completion=UUID.randomUUID().toString();
                byte[] syntheticUid={4,1,2,3,4,5,6};
                String identity=PhysicalNfcTagIdentity.observe(syntheticUid,new String[]{"android.nfc.tech.NfcA","android.nfc.tech.Ndef"});
                assertFalse(identity.isEmpty());
                String startEntry=syntheticReaderInput(activity,until,runtime,target,identity);
                JSONObject startAttestation=call(activity,until,"attestOfflineStart",new JSONObject().put("device_id",DEVICE)
                    .put("location_code",LOCATION).put("client_session_id",session).put("entry_id",startEntry)
                    .put("snapshot_id",snapshot.get("snapshot_id")).put("snapshot_employee_id",snapshot.get("employee_id"))
                    .put("snapshot_assignment_epoch",snapshot.get("assignment_epoch")).put("snapshot_credential_id",snapshot.get("credential_id")));
                JSONObject startArgs=new JSONObject().put("p_device_id",DEVICE).put("p_location_code",LOCATION).put("p_client_session_id",session)
                    .put("p_snapshot_id",snapshot.get("snapshot_id")).put("p_snapshot_employee_id",snapshot.get("employee_id"))
                    .put("p_snapshot_assignment_epoch",snapshot.get("assignment_epoch")).put("p_snapshot_credential_id",snapshot.get("credential_id"));
                merge(startArgs,startAttestation);String started=startArgs.getString("p_client_started_at");
                JSONObject actualStart=rpc(activity,until,"tool_start_offline_occurrence",startArgs);
                assertEquals(session,actualStart.getString("client_session_id"));assertTrue(actualStart.getBoolean("native_start_attested"));
                assertTrue(actualStart.getString("submission_proof").matches("[a-f0-9]{64}"));
                String finishEntry=syntheticReaderInput(activity,until,runtime,target,identity);assertNotEquals(startEntry,finishEntry);
                JSONObject finishInput=new JSONObject().put("device_id",DEVICE).put("location_code",LOCATION).put("client_session_id",session)
                    .put("client_completion_id",completion).put("context_id",actualStart.get("context_id"))
                    .put("client_started_at",started).put("native_finish_scan_entry_id",finishEntry);
                // Normal capture retires the actual finish entry; the following
                // attestation consumes its preserved same-tag proof, not a fake flag.
                JSONObject captured=call(activity,until,"captureOfflineCompletionTime",finishInput);
                String ended=captured.getString("p_client_ended_at");
                JSONObject finishAttestation=call(activity,until,"attestOfflineCompletion",finishInput);
                assertEquals(ended,finishAttestation.getString("p_client_ended_at"));
                JSONObject answers=new JSONObject().put("work_result","full").put("services_performed",new JSONArray().put("Full cleaning services"))
                    .put("form_type","restroom").put("maintenance_issues_found",new JSONArray()).put("note","")
                    .put("__custodial_offline_reconciliation_v1",new JSONObject().put("context_id",actualStart.get("context_id"))
                        .put("submission_proof",actualStart.get("submission_proof")));
                JSONObject completionArgs=new JSONObject().put("p_device_id",DEVICE).put("p_location_code",LOCATION).put("p_client_session_id",session)
                    .put("p_client_completion_id",completion).put("p_client_started_at",started).put("p_client_ended_at",ended)
                    .put("p_response_json",answers).put("p_scan_evidence",new JSONArray().put(event("scan_start",started,startEntry))
                        .put(event("scan_finish",ended,finishEntry))).put("p_correlation_id","scan-commit:"+session+":"+completion);
                merge(completionArgs,finishAttestation);
                JSONObject actualCompletion=rpc(activity,until,"tool_commit_cleaning_workflow",completionArgs);
                assertEquals("closed",actualCompletion.getString("status"));assertEquals(session,actualCompletion.getString("client_session_id"));
                assertEquals(completion,actualCompletion.getString("client_completion_id"));
                // The actual Plugin persists acceptance BEFORE exposing a result
                // to WebView. This NEW reader independently opens the real native
                // encrypted journal; no constructor/store override or seed.
                JSONObject recovered=new NativeCompletionJournal(runtime.offlineStore).recover(DEVICE,completionArgs);
                assertNotNull(recovered);assertTrue(ProviderWireJson.same(actualCompletion,recovered));
                JSONObject browserRecovered=call(activity,until,"getAuthenticatedCompletion",new JSONObject().put("device_id",DEVICE)
                    .put("completion_payload",completionArgs));
                assertTrue(browserRecovered.getBoolean("found"));assertTrue(ProviderWireJson.same(recovered,browserRecovered.getJSONObject("result")));
                List<NativeScanSqlLoanHttpsFixture.Observation> observations=loan.observations();
                assertEquals(1L,observations.stream().filter(x->x.function.equals("tool_start_offline_occurrence")).count());
                assertEquals(1L,observations.stream().filter(x->x.function.equals("tool_commit_cleaning_workflow")).count());
                var last=observations.stream().filter(x->x.function.equals("tool_commit_cleaning_workflow")).findFirst().orElseThrow();
                assertEquals("/scan-api/rpc",last.path);assertEquals(200,last.status);
                assertTrue(SystemClock.elapsedRealtime()<until);
                System.out.println("CUSTODIAL_G13_ANDROID_SQL_ORIGINAL_CAPTURE "+new JSONObject()
                    .put("schema","custodial.test-android-original-sql-capture.v1").put("client_session_id",session)
                    .put("client_completion_id",completion).put("original_request_sha256",last.requestSha256)
                    .put("exact_received_response_sha256",last.responseSha256).put("native_journal_recovered",true)
                    .put("same_webview_plugin_consumer",true).put("physical_nfc",false).put("TLS",false).put("manager_receiver",false));
            }catch(Exception|Error failure){
                // Java try-with-resources has already preserved a body failure
                // with any close failure suppressed. Rethrow that same object.
                primaryFailure=failure;
                throw failure;
            }finally{BridgeSmokeActivity.install(null);
                if(host.get()!=null&&originalUntil[0]>0){
                    try{awaitActualTeardown(originalUntil[0],host.get(),sourceRef.get());}
                    catch(Exception|Error teardownFailure){
                        // Teardown remains mandatory under the ORIGINAL deadline.
                        // It must not replace a prior body/launch/close failure.
                        if(primaryFailure!=null){
                            if(teardownFailure!=primaryFailure)primaryFailure.addSuppressed(teardownFailure);
                        }else throw teardownFailure;
                    }
                }}
        }
    }
    private static String syntheticReaderInput(BridgeSmokeActivity activity,long until,CustodialNativeRuntime runtime,
        android.content.Context target,String identity)throws Exception {
        assertTrue(SystemClock.elapsedRealtime()<until);
        int boot=Settings.Global.getInt(target.getContentResolver(),"boot_count",-1);assertTrue(boot>=0);
        // Synthetic ReaderCallback DATA only, through existing durable native
        // record and normal opaque handoff claim. This is NOT a physical read.
        String handoff=NativeNfcScanHandoff.record(runtime.offlineStore,"memphiszoo://scan?code="+LOCATION,
            SystemClock.elapsedRealtime(),boot,identity);
        JSONObject entry=call(activity,until,"attestScanIntent",new JSONObject().put("url",
            "memphiszoo://scan?code="+LOCATION+"&"+NativeNfcScanHandoff.QUERY_PARAMETER+"="+handoff));
        assertEquals(LOCATION,entry.getString("location_code"));return entry.getString("entry_id");
    }
    private static void awaitActualTeardown(long until,BridgeSmokeActivity host,NativeRecurringApplicationSource source)throws Exception {
        assertNotNull(source);
        var destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        var retired=field(NativeRecurringApplicationSource.class,"diagnosticOwnerJavaRetired");
        var delegated=field(NativeRecurringApplicationSource.class,"diagnosticProviderDisposalDelegated");
        while(SystemClock.elapsedRealtime()<until){
            if(destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source)){
                assertFalse(field(NativeRecurringApplicationSource.class,"diagnosticProviderRemovalAttempted").getBoolean(source));
                System.out.println("CUSTODIAL_G13_SQL_TEARDOWN viewDestroyComplete=true ownerJavaRetired=true providerDisposalDelegated=true");return;
            }
            SystemClock.sleep(25);
        }
        throw new AssertionError("Actual normal Java/view teardown unresolved inside original20");
    }
    private static java.lang.reflect.Field field(Class<?> type,String name)throws Exception {
        var result=type.getDeclaredField(name);result.setAccessible(true);return result;
    }
    private static JSONObject event(String type,String at,String entry)throws Exception {
        return new JSONObject().put("client_event_id",entry).put("event_type",type).put("result","ok").put("notes",JSONObject.NULL)
            .put("scanned_at",at).put("payload_json",new JSONObject().put("entry_source","native-nfc"));
    }
    private static void merge(JSONObject into,JSONObject values)throws Exception {
        var keys=values.keys();while(keys.hasNext()){String key=keys.next();into.put(key,values.get(key));}
    }
    private static JSONObject rpc(BridgeSmokeActivity activity,long until,String fn,JSONObject args)throws Exception {
        byte[] bytes=new JSONObject().put("fn",fn).put("args",args).toString().getBytes(StandardCharsets.UTF_8);
        try{
            JSONObject response=call(activity,until,"authorizedRequest",new JSONObject().put("device_id",DEVICE).put("path","/scan-api/rpc")
                .put("method","POST").put("headers",new JSONObject().put("Content-Type","application/json"))
                .put("body_base64",Base64.encodeToString(bytes,Base64.NO_WRAP)));
            assertEquals("Actual SQL/native freshness or credential refusal is not success",200,response.getInt("status"));
            byte[] decoded=Base64.decode(response.getString("body_base64"),Base64.NO_WRAP);
            try{JSONObject original=ProviderWireJson.object(decoded,1_048_576);assertTrue(original.getBoolean("ok"));return original.getJSONObject("data");}
            finally{Arrays.fill(decoded,(byte)0);}
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private static JSONObject call(BridgeSmokeActivity activity,long until,String method,JSONObject args)throws Exception {
        assertTrue("Original20s phase, no restart",SystemClock.elapsedRealtime()<until);
        String key="__g13OriginalLoan"+UUID.randomUUID().toString().replace("-","");
        String script="(()=>{const k="+JSONObject.quote(key)+";if(Object.hasOwn(globalThis,k))throw Error('Existing test request');"
            +"const r={done:false};Object.defineProperty(globalThis,k,{value:r});Promise.resolve().then(()=>"
            +"Capacitor.nativePromise('CustodialNativeVault',"+JSONObject.quote(method)+","+args.toString()+"))"
            +".then(v=>{r.value=v;r.ok=true;r.done=true;},e=>{r.code=typeof e?.code==='string'?e.code:'NATIVE_REFUSED';r.ok=false;r.done=true;});})()";
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(script,null));
        while(SystemClock.elapsedRealtime()<until){
            CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(
                "JSON.stringify(globalThis["+JSONObject.quote(key)+"])",raw->{
                    try{Object decoded=new JSONTokener(raw).nextValue();if(decoded instanceof String)value.set((String)decoded);}
                    catch(Exception invalid){}finally{done.countDown();}
                }));
            long left=until-SystemClock.elapsedRealtime();assertTrue(left>0);assertTrue(done.await(Math.min(3_000L,left),TimeUnit.MILLISECONDS));
            if(value.get()!=null){JSONObject result=new JSONObject(value.get());if(result.optBoolean("done")){
                assertTrue("Actual native original "+method+" refused: "+result.optString("code"),result.getBoolean("ok"));
                assertTrue(SystemClock.elapsedRealtime()<until);return result.getJSONObject("value");}}
            SystemClock.sleep(25);
        }
        throw new AssertionError("Actual original native request unresolved; no retry");
    }
}
