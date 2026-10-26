package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import android.os.Looper;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual default Runtime, normal authenticated GET/employee and automatic
 * coordinator. Only HTTPS server DATA/outcomes are synthetic; no Source/frame/
 * native permit or completion is fabricated. Not SQL acceptance or OS/audio proof. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringOrdinaryCommitAndroidRuntimeTest {
    @Test(timeout=90_000) public void emptyPlanPostsOriginalAfterProcessedReleaseAndOnlyQueriesLostOutcome()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.ORIGINAL_LOST_RESPONSE);
    }
    @Test(timeout=90_000) public void staleOriginalPlanCannotPostForActualCurrentTarget()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.STALE_TARGET_PLAN);
    }
    @Test(timeout=90_000) public void mismatchedNativePlanWireNeverPosts()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.MISMATCHED_WIRE);
    }
    @Test(timeout=90_000) public void realSourceRetirementAfterDurableAttemptPreventsPost()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.RETIRE_AFTER_ATTEMPT);
    }
    @Test(timeout=90_000) public void genuineNonemptyV2PlanCannotInventOriginalNativeProviderCompletion()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.V2_NONEMPTY_MISSING_ORIGINAL);
    }
    @Test(timeout=90_000) public void authenticatedReassignmentCannotAdoptOrReplayDurableUnknownOriginal()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.ORIGINAL_LOST_RESPONSE,true);
    }
    @Test(timeout=90_000) public void synchronousOriginalWriterAbortRetiresActualHoldAndPreservesNormalRead()throws Exception {
        run(NativeRecurringOrdinaryCommitReplyFixture.Mode.STALE_TARGET_PLAN,false,true);
    }
    private static void run(NativeRecurringOrdinaryCommitReplyFixture.Mode mode)throws Exception {
        run(mode,false);
    }
    private static void run(NativeRecurringOrdinaryCommitReplyFixture.Mode mode,boolean reassignAfterUnknown)throws Exception {
        run(mode,reassignAfterUnknown,false);
    }
    private static void run(NativeRecurringOrdinaryCommitReplyFixture.Mode mode,boolean reassignAfterUnknown,boolean abortOriginalWriter)throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        // Same existing normal semantic profile setup, ONLY this guarded fresh
        // disposable GMD test package. No actual employee/global setting.
        assertEquals("org.memphiszoo.custodial.vault.test",target.getPackageName());
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getUiAutomation()
            .grantRuntimePermission(target.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
        assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,
            target.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS));
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture(true)){
            var recorder=new NativeRecurringOrdinaryCommitReplyFixture(mode);server.ordinaryCommit=recorder;
            server.installBeforeDefaultRuntime();var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();
            try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            var host=new AtomicReference<BridgeSmokeActivity>();var sourceRef=new AtomicReference<NativeRecurringApplicationSource>();
            var untilRef=new AtomicLong();var retireError=new AtomicReference<Throwable>();var retiredAttempt=new AtomicReference<NativeRecurringOrdinaryAttemptJournal.Data>();
            SharedPreferences raw=target.getApplicationContext().getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
            SharedPreferences.OnSharedPreferenceChangeListener listener=(preferences,key)->{
                if(mode!=NativeRecurringOrdinaryCommitReplyFixture.Mode.RETIRE_AFTER_ATTEMPT||key==null
                    ||!key.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX)||retiredAttempt.get()!=null)return;
                NativeRecurringOrdinaryAttemptJournal.Data actual;
                try{actual=runtime.offlineStore.readOrdinaryRecurringAttempt(key,runtime.readNotificationMutationPrincipal());}
                catch(VaultFailure notAnAttempt){return;}
                if(actual==null)return; // Valid PREPARED reads return null; retirement requires actual ATTEMPTED.
                try{
                    assertSame("Actual preference callback must use the UI queue",Looper.getMainLooper(),Looper.myLooper());
                    assertEquals(key,actual.key);
                    JSONObject actualAttempt=NativeRecurringOrdinaryAttemptJournal.requireData(key,actual.record);
                    assertEquals("ATTEMPTED",actualAttempt.getString("state"));
                    var actualPrincipal=runtime.readNotificationMutationPrincipal();assertNotNull(actualPrincipal);
                    assertEquals(7L,actualPrincipal.json().getLong("assignment_epoch"));
                    assertTrue(ProviderWireJson.same(actualPrincipal.json(),
                        NativeRecurringOrdinaryAttemptJournal.originalPrepared(key,actual.record).getJSONObject("principal")));
                    String originalAttemptCipher=raw.getString(key,null);assertNotNull(originalAttemptCipher);
                    assertEquals(actual.record,runtime.offlineStore.readOrdinaryRecurringAttempt(key,actualPrincipal).record);
                    assertEquals(originalAttemptCipher,raw.getString(key,null));
                    NativeRecurringApplicationSource source=sourceRef.get();assertNotNull(source);
                    retiredAttempt.set(actual);source.close(); // Genuine supported logical retirement, no private writes.
                }catch(Throwable failure){retireError.set(failure);}
            };
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                long until=android.os.SystemClock.elapsedRealtime()+20_000;untilRef.set(until);
                scenario.onActivity(value->{host.set(value);assertSame(plugin,value.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                NativeRecurringApplicationSource source=(NativeRecurringApplicationSource)field(CustodialNativeRuntime.class,"recurringApplication").get(runtime);
                assertNotNull(source);sourceRef.set(source);var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();queries.recordFailureSource(source);
                NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,host.get(),until,"KIOSK_08");
                int before=server.statusReads;queries.captureInitialStatus(host.get(),until);
                assertTrue(server.statusReads>before);assertNotNull(runtime.readNotificationMutationPrincipal());
                raw.registerOnSharedPreferenceChangeListener(listener);
                int exchanges=server.authorizedExchanges;
                assertThrows(VaultFailure.class,()->engine.authorizedRequest("KIOSK_08",new AuthorizedRequest(
                    NativeRecurringOrdinaryDeliveryWire.PATH,"POST",Map.of("Content-Type","application/json"),"{}".getBytes(StandardCharsets.UTF_8))));
                assertEquals(exchanges,server.authorizedExchanges);
                NativeRecurringApplicationSourceAndroidRuntimeTest.awaitExpectedNavigation(host.get(),until,
                    "https://localhost/employee-schedule.html","https://localhost/employee-schedule.html",false);
                awaitRender(host.get(),until);
                String key=awaitPurposeKey(raw,until);
                if(mode==NativeRecurringOrdinaryCommitReplyFixture.Mode.ORIGINAL_LOST_RESPONSE){
                    await(until,()->recorder.posts==1&&recorder.outcomes==1&&coordinatorIdle(runtime),"Actual automatic original POST and one outcome-only GET");
                    var first=runtime.offlineStore.readOrdinaryRecurringAttempt(key,runtime.readNotificationMutationPrincipal());
                    assertEquals("NO_RECORDED_RECEIPT",NativeRecurringOrdinaryAttemptJournal.requireData(key,first.record).getJSONObject("outcome").getString("kind"));
                    byte[] original=first.originalBody();assertArrayEquals(recorder.originalPost(),original);
                    assertEquals(recorder.originalIssuedPlan().getString("plan_read_id"),recorder.originalHeader());
                    JSONObject six=ProviderWireJson.object(original,16384),plan=recorder.originalIssuedPlan();
                    assertEquals(plan.get("intent_id"),six.get("intent_id"));assertEquals(plan.get("target_digest"),six.get("target_digest"));
                    assertEquals(plan.get("rendered_digest"),six.get("rendered_digest"));
                    assertEquals(6,six.length());assertFalse(first.retryAuthorized());
                    if(reassignAfterUnknown){
                        // Actual old native principal retained as HISTORY DATA,
                        // not reconstructed from server/browser JSON or granted
                        // authority to resend/query under a new assignment.
                        NativeProviderPrincipal oldPrincipal=runtime.readNotificationMutationPrincipal();assertNotNull(oldPrincipal);
                        String oldCipher=raw.getString(key,null);assertNotNull(oldCipher);
                        var originalRows=new java.util.HashMap<String,Object>();
                        for(var entry:raw.getAll().entrySet())if(entry.getKey().startsWith("native_recurring_target_sha256:")
                            ||entry.getKey().startsWith("native_recurring_view_chunk_sha256:")||entry.getKey().startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX))
                            originalRows.put(entry.getKey(),entry.getValue());
                        String otherEmployee="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8";
                        assertNotEquals(otherEmployee,oldPrincipal.json().getString("employee_id"));
                        int statuses=server.statusReads;server.reassignOwnedStatus(otherEmployee,8);
                        queries.captureInitialStatus(host.get(),until);assertTrue(server.statusReads>statuses);
                        NativeProviderPrincipal current=runtime.readNotificationMutationPrincipal();assertNotNull(current);assertFalse(oldPrincipal.same(current));
                        assertEquals(otherEmployee,current.json().getString("employee_id"));assertEquals(8L,current.json().getLong("assignment_epoch"));
                        assertEquals(oldPrincipal.json().getString("device_id"),current.json().getString("device_id"));
                        for(String fixed:new String[]{"credential_id","credential_operation_id","installation_seal","enrolled_at"})
                            assertEquals("Only authenticated assignment changed",oldPrincipal.json().get(fixed),current.json().get(fixed));
                        var selection=runtime.offlineStore.observeOrdinaryRecoveryOriginals(current);
                        assertTrue(selection.originalKeys.isEmpty());assertEquals(0,selection.unavailable);assertFalse(selection.observationUnavailable);
                        int transports=server.authorizedExchanges,posts=recorder.posts,outcomes=recorder.outcomes;
                        VaultFailure refused=assertThrows(VaultFailure.class,()->runtime.resolveOrdinaryRecurringOutcome(key));
                        assertEquals("custodial_recurring_ordinary_attempt_pending",refused.code);
                        assertEquals("Refusal must precede actual HTTP",transports,server.authorizedExchanges);
                        assertEquals(1,posts);assertEquals(posts,recorder.posts);assertEquals(1,outcomes);assertEquals(outcomes,recorder.outcomes);
                        assertEquals(oldCipher,raw.getString(key,null));
                        for(var entry:originalRows.entrySet())assertEquals("Original history bytes retained",entry.getValue(),raw.getAll().get(entry.getKey()));
                        var history=runtime.offlineStore.readOrdinaryRecurringAttempt(key,oldPrincipal);
                        assertEquals(first.record,history.record);assertArrayEquals(original,history.originalBody());assertFalse(history.retryAuthorized());
                        assertEquals("NO_RECORDED_RECEIPT",NativeRecurringOrdinaryAttemptJournal.requireData(key,history.record).getJSONObject("outcome").getString("kind"));
                        java.util.Arrays.fill(original,(byte)0);
                        System.out.println("CUSTODIAL_ORDINARY_G15_REASSIGN actualNativeStatus=true epoch8=true employeeChanged=true originalCipherPreserved=true originalSixUnchanged=true foreignOriginalSelectionEmpty=true queryRefusedBeforeHTTP=true postCount=1 noResend=true syntheticAssignmentOnly=true");
                    }else{
                    String originalRead=recorder.originalHeader(),originalIntent=recorder.latestDelivery().getString("intentId");
                    int reads=server.recurringSchedule.scheduleReads;
                    query(host.get(),until,"(()=>{window.dispatchEvent(new Event('memphis:schedule-refresh'));return JSON.stringify({requested:true});})()");
                    await(until,()->server.recurringSchedule.scheduleReads>reads&&recorder.outcomes==2&&coordinatorIdle(runtime),"Later genuine GET performs only original outcome query");
                    assertEquals("Maintained recurring fixture intentionally keeps same intent on a refresh",originalIntent,recorder.latestDelivery().getString("intentId"));
                    assertNotEquals("Every later actual server read has a fresh immutable issuance token",originalRead,recorder.latestIssuedPlan().getString("plan_read_id"));
                    assertEquals("Original POST binding must survive later issuance",originalRead,recorder.originalIssuedPlan().getString("plan_read_id"));
                    var resolved=runtime.offlineStore.readOrdinaryRecurringAttempt(key,runtime.readNotificationMutationPrincipal());
                    assertArrayEquals(original,resolved.originalBody());assertEquals(1,recorder.posts);
                    assertEquals("RECEIPT_RECORDED",NativeRecurringOrdinaryAttemptJournal.requireData(key,resolved.record).getJSONObject("outcome").getString("kind"));
                    assertFalse(resolved.retryAuthorized());java.util.Arrays.fill(original,(byte)0);
                    System.out.println("CUSTODIAL_ORDINARY18C_EMPTY originalPost=true fixedSix=true originalPlanHeader=true actualProcessedReleaseRequired=true originalOutcomeOnly=true noResend=true syntheticServer=true");
                    }
                }else if(mode==NativeRecurringOrdinaryCommitReplyFixture.Mode.V2_NONEMPTY_MISSING_ORIGINAL){
                    await(until,()->coordinatorWasScheduledAndIsIdle(runtime),"Actual nonempty v2 worker refusal completed");
                    assertEquals(0,recorder.posts);assertEquals(0,recorder.outcomes);
                    assertV2OriginalProviderUnavailable(scenario,runtime,source,recorder,raw,key,until);
                }else if(mode==NativeRecurringOrdinaryCommitReplyFixture.Mode.RETIRE_AFTER_ATTEMPT){
                    await(until,()->retiredAttempt.get()!=null&&coordinatorIdle(runtime),"Real native Source retirement after actual durable ATTEMPTED");
                    if(retireError.get()!=null)throw new AssertionError("Actual retirement listener failed",retireError.get());
                    assertEquals(0,recorder.posts);assertNotNull(retiredAttempt.get());
                    var saved=runtime.offlineStore.readOrdinaryRecurringAttempt(key,runtime.readNotificationMutationPrincipal());
                    assertArrayEquals(retiredAttempt.get().originalBody(),saved.originalBody());
                    String kind=NativeRecurringOrdinaryAttemptJournal.requireData(key,saved.record).getJSONObject("outcome").getString("kind");
                    assertTrue("UNKNOWN".equals(kind)||"NO_RECORDED_RECEIPT".equals(kind));assertFalse(saved.retryAuthorized());
                    System.out.println("CUSTODIAL_ORDINARY18C_RELEASE_REFUSED actualDurableAttempt=true realSourceClosed=true postCount=0 outcomeOnly=true syntheticServer=true");
                }else{
                    await(until,()->coordinatorWasScheduledAndIsIdle(runtime),"Actual worker completed strict bad-plan refusal");
                    assertEquals(0,recorder.posts);assertEquals(0,recorder.outcomes);
                    // The real read API returns null for a strictly validated
                    // same-principal PREPARED row; only malformed/foreign rows
                    // throw. Pin actual row presence/bytes so missing storage
                    // cannot accidentally satisfy this no-ATTEMPTED assertion.
                    String originalPreparedCipher=raw.getString(key,null);assertNotNull(originalPreparedCipher);
                    var actualPrincipal=runtime.readNotificationMutationPrincipal();assertNotNull(actualPrincipal);
                    assertNull(runtime.offlineStore.readOrdinaryRecurringAttempt(key,actualPrincipal));
                    assertEquals(originalPreparedCipher,raw.getString(key,null));
                    if(abortOriginalWriter)assertOriginalWriterAbort(scenario,host.get(),runtime,source,server,recorder,raw,key,until);
                    System.out.println("CUSTODIAL_ORDINARY18C_PLAN_REFUSED kind="+mode.name()+" actualGET=true actualNormalRender=true actualWorker=true postCount=0");
                }
                assertEquals(1,server.enrolls);assertEquals(1,server.confirms);assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            }finally{raw.unregisterOnSharedPreferenceChangeListener(listener);BridgeSmokeActivity.install(null);}
            awaitActualTeardown(untilRef.get(),host.get(),sourceRef.get());
        }
    }
    /** Actual original bootstrap/JavaScriptInterface/Engine/Source, with only
     * existing synthetic HTTPS enrollment+GET DATA. No private grant/frame or
     * native authority is forged. One genuine online event invokes the SAME
     * normal load wrapper; no event is presented as physical input. */
    private static void assertOriginalWriterAbort(ActivityScenario<BridgeSmokeActivity> scenario,BridgeSmokeActivity host,
        CustodialNativeRuntime runtime,NativeRecurringApplicationSource source,
        NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture server,NativeRecurringOrdinaryCommitReplyFixture recorder,
        SharedPreferences raw,String key,long until)throws Exception {
        NativeRecurringCallbackProtocolAndroidSupport.awaitWriterQuiescence(scenario,source,until);
        var holder=new AtomicReference<NativeRecurringApplicationSource.CallbackHold>();
        scenario.onActivity(value->{try{holder.set(source.beginOrdinaryDeliveryWriterHold());}catch(VaultFailure failure){throw new AssertionError(failure);}});
        try(var hold=holder.get()){
            var readRef=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{readRef.set(hold.initialRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            await(Math.min(until,android.os.SystemClock.elapsedRealtime()+3_000),readRef.get()::hasReply,"Actual initial held frame before original abort");
            var frameRef=new AtomicReference<NativeRecurringApplicationSource.OrdinaryCallbackFrame>();
            scenario.onActivity(value->{try{frameRef.set(readRef.get().takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            try(var initial=frameRef.get()){
                assertNotNull(initial.copyData(source,hold));
                // A public object name without the private native tokens can
                // only return false; it must not retire this valid original.
                JSONObject rejected=query(host,until,"JSON.stringify({value:window.custodialRecurringOriginalWriterAbort.abort('wrong-grant','wrong-reply')})");
                assertFalse(rejected.getBoolean("value"));
                var lastRef=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
                scenario.onActivity(value->{try{lastRef.set(hold.beginTerminalRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
                await(Math.min(until,android.os.SystemClock.elapsedRealtime()+3_000),lastRef.get()::hasReply,"Actual terminal frame remains valid after forged abort");
                frameRef.set(null);
                scenario.onActivity(value->{try{frameRef.set(lastRef.get().takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
                try(var terminal=frameRef.get()){
                    var completed=hold.captureCompletedDocumentLifetime(source);completed.requireCurrent(source);
                    String originalCipher=raw.getString(key,null);assertNotNull(originalCipher);
                    int before=recorder.issues,posts=recorder.posts,outcomes=recorder.outcomes;
                    JSONObject fired=query(host,until,"(()=>{window.dispatchEvent(new Event('online'));return JSON.stringify({dispatched:true});})()");
                    assertTrue(fired.getBoolean("dispatched"));
                    await(until,()->recorder.issues>before,"Exact normal original GET survives authentic held-writer abort");
                    assertEquals("Exactly one new normal GET",before+1,recorder.issues);
                    assertThrows(VaultFailure.class,()->completed.requireCurrent(source));
                    assertThrows(VaultFailure.class,()->hold.requireNativeWriterLeaseLifetime(source));
                    assertThrows(VaultFailure.class,()->terminal.copyData(source,hold));
                    assertThrows(VaultFailure.class,()->initial.copyData(source,hold));
                    assertEquals(posts,recorder.posts);assertEquals(outcomes,recorder.outcomes);assertEquals(0,posts);
                    assertEquals("Existing PREPARED cipher/history preserved",originalCipher,raw.getString(key,null));
                    assertNull(runtime.offlineStore.readOrdinaryRecurringAttempt(key,runtime.readNotificationMutationPrincipal()));
                    awaitRender(host,until);
                    System.out.println("CUSTODIAL_ORIGINAL_WRITER_ABORT actualJavaInterface=true authenticatedOriginal=true forgedAbortRefused=true exactNormalGET=true oldFrameRetired=true completedDocumentRetired=true posts=0 syntheticServer=true");
                }
            }
        }
    }
    /** Actual private Source frame transport/copy, not a frame constructor or
     * reconstructed native capability. Requirements stay DATA throughout. */
    private static void assertV2OriginalProviderUnavailable(ActivityScenario<BridgeSmokeActivity> scenario,
        CustodialNativeRuntime runtime,NativeRecurringApplicationSource source,NativeRecurringOrdinaryCommitReplyFixture recorder,
        SharedPreferences raw,String key,long until)throws Exception {
        NativeRecurringCallbackProtocolAndroidSupport.awaitWriterQuiescence(scenario,source,until);
        var holder=new AtomicReference<NativeRecurringApplicationSource.CallbackHold>();
        scenario.onActivity(value->{try{holder.set(source.beginOrdinaryDeliveryWriterHold());}catch(VaultFailure failure){throw new AssertionError(failure);}});
        JSONObject expected;
        try(var hold=holder.get()){
            var firstRef=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
            scenario.onActivity(value->{try{firstRef.set(hold.initialRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            var first=firstRef.get();long firstUntil=Math.min(until,android.os.SystemClock.elapsedRealtime()+3_000);
            await(firstUntil,first::hasReply,"Actual v2 initial Source reply");
            var frameRef=new AtomicReference<NativeRecurringApplicationSource.OrdinaryCallbackFrame>();
            scenario.onActivity(value->{try{frameRef.set(first.takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
            byte[] initialBytes=null,terminalBytes=null;
            try(var initial=frameRef.get()){
                initialBytes=initial.copyData(source,hold);
                var terminalRef=new AtomicReference<NativeRecurringApplicationSource.CallbackRead>();
                scenario.onActivity(value->{try{terminalRef.set(hold.beginTerminalRead(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
                var last=terminalRef.get();long lastUntil=Math.min(until,android.os.SystemClock.elapsedRealtime()+3_000);
                await(lastUntil,last::hasReply,"Actual v2 terminal Source reply");frameRef.set(null);
                scenario.onActivity(value->{try{frameRef.set(last.takeOriginalOrdinaryFrame(source));}catch(VaultFailure failure){throw new AssertionError(failure);}});
                try(var terminal=frameRef.get()){
                    terminalBytes=terminal.copyData(source,hold);
                    assertArrayEquals("Same actual held writer data",initialBytes,terminalBytes);
                    JSONObject nativeData=ProviderWireJson.object(initialBytes,1_048_576),document=nativeData.getJSONObject("document_data");
                    expected=document.getJSONObject("reminder").getJSONObject("raw_owner_state").getJSONObject("expected_plan");
                    assertEquals("custodial.normal-expected-notification-plan.v2",expected.getString("schema"));assertTrue(expected.getBoolean("complete"));
                    assertFalse(expected.getBoolean("receipt_eligible"));assertEquals(1,expected.getJSONArray("required_effects").length());
                    assertEquals(1,expected.getJSONArray("required_audio").length());
                    JSONObject derived=expected.getJSONObject("normal_derivation").getJSONArray("effects").getJSONObject(0);
                    assertEquals("location:normal:due",derived.getString("notification_key"));assertTrue(derived.getBoolean("required_audio"));
                    JSONObject envelope=expected.getJSONObject("source_envelope"),body=envelope.getJSONObject("body");
                    assertEquals("custodial.recurring-current-notification-plan-envelope.v2",envelope.getString("schema"));
                    assertEquals(NativeProviderPrincipal.hash(envelope.getString("bodyJsonText")),envelope.getString("bodyDigest"));
                    assertEquals(recorder.latestIssuedPlan().toString(),body.toString());
                    assertEquals(recorder.latestDelivery().getString("targetDigest"),body.getString("target_digest"));
                    JSONObject binding=body.getJSONObject("delivery_bindings").getJSONArray("entries").getJSONObject(0);
                    assertEquals(12,binding.length());assertEquals("ORIGINAL_NATIVE_JOB",binding.getString("audio_origin"));
                    assertNotEquals("Normal renderer words remain independent",NativeProviderPrincipal.hash(derived.getString("speech_text")),binding.getString("speech_sha256"));
                }
            }finally{if(initialBytes!=null)java.util.Arrays.fill(initialBytes,(byte)0);if(terminalBytes!=null)java.util.Arrays.fill(terminalBytes,(byte)0);}
        }
        // Fixed cached actual native owner entry only. No Current/owner/row/
        // SDK proof is manufactured from the copied requirements above.
        JSONObject original=expected.getJSONObject("source_envelope").getJSONObject("body");
        NativeProviderPrincipal principal=runtime.readNotificationMutationPrincipal();assertNotNull(principal);
        VaultFailure missing=assertThrows(VaultFailure.class,()->runtime.captureOrdinaryOriginalJobs(principal,
            original.getString("plan_read_id"),original.getString("semantic_digest"),original.getString("target_digest"),
            original.getJSONObject("delivery_bindings").toString()));
        assertEquals("custodial_provider_original_job_unavailable",missing.code);
        String prepared=raw.getString(key,null);assertNotNull(prepared);
        assertNull(runtime.offlineStore.readOrdinaryRecurringAttempt(key,principal));assertEquals(prepared,raw.getString(key,null));
        assertEquals(0,recorder.posts);assertEquals(0,recorder.outcomes);assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        System.out.println("CUSTODIAL_ORDINARY18F_V2_REFUSED actualNativeGET=true actualNormalV2Plan=true genuineSourceFrames=true nonemptyEffectsRetained=true requiredAudioRetained=true originalNativeJobUnavailable=true noAttempt=true postCount=0 syntheticMetadataOnly=true");
    }
    private interface Check {boolean ready()throws Exception;}
    private static void await(long until,Check check,String message)throws Exception {
        boolean done=false;while(android.os.SystemClock.elapsedRealtime()<until){if(check.ready()){done=true;break;}android.os.SystemClock.sleep(25);}
        assertTrue(message,done&&android.os.SystemClock.elapsedRealtime()<until);
    }
    private static boolean coordinatorIdle(CustodialNativeRuntime runtime)throws Exception {
        synchronized(runtime){return field(CustodialNativeRuntime.class,"ordinaryCoordinatorCurrent").get(runtime)==null
            &&field(CustodialNativeRuntime.class,"ordinaryCoordinatorPending").get(runtime)==null;}
    }
    private static boolean coordinatorWasScheduledAndIsIdle(CustodialNativeRuntime runtime)throws Exception {
        synchronized(runtime){return field(CustodialNativeRuntime.class,"ordinaryCoordinatorLastTrigger").get(runtime)!=null&&coordinatorIdle(runtime);}
    }
    private static String awaitPurposeKey(SharedPreferences raw,long until)throws Exception {
        var selected=new AtomicReference<String>();await(until,()->{
            var keys=raw.getAll().keySet().stream().filter(k->k.startsWith(NativeRecurringOrdinaryPurposeJournal.PREFIX)).toList();
            assertTrue("No unrelated purpose may be adopted",keys.size()<=1);if(keys.size()==1){selected.set(keys.get(0));return true;}return false;
        },"Actual native GET/PREPARED purpose birth");return selected.get();
    }
    private static void awaitRender(BridgeSmokeActivity host,long until)throws Exception {
        await(until,()->query(host,until,"(()=>{const c=document.getElementById('content'),a=document.getElementById('areas');return JSON.stringify({ready:document.readyState==='complete'&&!!c&&!c.hidden&&!!a&&a.textContent.includes('Synthetic owned North Loop')});})()").getBoolean("ready"),"Actual normal nonempty schedule render");
    }
    private static JSONObject query(BridgeSmokeActivity host,long originalUntil,String script)throws Exception {
        long until=Math.min(originalUntil,android.os.SystemClock.elapsedRealtime()+3_000);CountDownLatch done=new CountDownLatch(1);var raw=new AtomicReference<String>();
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(()->host.getBridge().getWebView().evaluateJavascript(script,value->{raw.set(value);done.countDown();}));
        long left=until-android.os.SystemClock.elapsedRealtime();assertTrue(left>0&&done.await(left,TimeUnit.MILLISECONDS));assertTrue(android.os.SystemClock.elapsedRealtime()<until);
        Object decoded=new JSONTokener(raw.get()).nextValue();assertTrue(decoded instanceof String);return new JSONObject((String)decoded);
    }
    private static java.lang.reflect.Field field(Class<?> type,String name)throws Exception {var f=type.getDeclaredField(name);f.setAccessible(true);return f;}
    private static void awaitActualTeardown(long until,BridgeSmokeActivity host,NativeRecurringApplicationSource source)throws Exception {
        assertNotNull(host);assertNotNull(source);var destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        var retired=field(NativeRecurringApplicationSource.class,"diagnosticOwnerJavaRetired");var delegated=field(NativeRecurringApplicationSource.class,"diagnosticProviderDisposalDelegated");
        await(until,()->destroyed.getBoolean(host)&&retired.getBoolean(source)&&delegated.getBoolean(source),"Actual Java retirement/delegated provider disposal/view destruction inside original20");
        assertFalse(field(NativeRecurringApplicationSource.class,"diagnosticProviderRemovalAttempted").getBoolean(source));
        System.out.println("CUSTODIAL_ORDINARY18C_TEARDOWN viewDestroyComplete=true ownerJavaRetired=true providerDisposalDelegated=true providerRemovalAttempted=false");
    }
}
