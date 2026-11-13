package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;

import android.content.Context;
import android.os.Build;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Actual Android Bridge/WebView/document-start attachment and retirement.
 * This denied/lifecycle case deliberately has NO retained original tuple.
 * It never forges a private Source message, HELLO, token, native receipt,
 * manager result or ACK; it does NOT qualify successful original capture.
 * Run only in the isolated normal module instrumentation target/emulator. */
@RunWith(AndroidJUnit4.class)
public final class OriginalBrowserPreparationAndroidRuntimeTest {
    private static final String PAGE="https://localhost/index.html";
    private static final String UNAVAILABLE="custodial_original_browser_preparation_unavailable";

    @Test(timeout=45000)
    public void actualDocumentStartSourceRetiresBeforeNavigationWithoutInventingOriginal()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated instrumentation target required; never an enrolled app",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue("actual WebView WEB_MESSAGE_LISTENER required",WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue("actual WebView DOCUMENT_START_SCRIPT required",WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("existing fixture must be uninitialized; test never clears vault/enrollment",
            context.getSharedPreferences("MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originalStores=stores(context);
        VaultClock clock=System::currentTimeMillis;
        InstrumentedTransport transport=new InstrumentedTransport(clock);
        // BridgeSmokeActivity's existing injected-engine seam avoids automatic
        // runtime/provider attachment. Every vault admission below DENIES;
        // this Engine is never an original/authentication fixture or a writer.
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        AtomicReference<NativeOriginalBrowserPreparation> source=new AtomicReference<>();
        AtomicReference<Bridge> bridge=new AtomicReference<>();
        AtomicReference<WebView> view=new AtomicReference<>();
        BridgeSmokeActivity.install(plugin);
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
            NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
            Throwable primary=null;
            try{
                scenario.onActivity(activity->{
                    try{
                        Bridge actual=activity.getBridge();assertNotNull(actual);WebView web=actual.getWebView();assertNotNull(web);
                        bridge.set(actual);view.set(web);
                        requireShippingBootstrapAssets(activity);
                        // Explicit native TEST-host configuration, not a JSON
                        // claim/fallback or a change to product Bridge defaults.
                        // Production attach independently checks these settings.
                        web.getSettings().setSupportMultipleWindows(false);
                        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                        source.set(NativeOriginalBrowserPreparation.attach(activity,actual));
                        source.get().requireAttachedView(web);
                    }catch(Exception unavailable){throw new AssertionError("actual Source attach prerequisite unavailable; no substitute bootstrap",unavailable);}
                });
                loadExistingPackagedPage(scenario,bridge.get(),view.get(),PAGE+"?original_source_lifecycle=attached");
                assertEquals("true",evaluate(scenario,"typeof globalThis.custodialOriginalBrowserPreparation==='object'"
                    +" && typeof globalThis.custodialOriginalBrowserPreparation.postMessage==='function'"));
                assertEquals("true",evaluate(scenario,"typeof globalThis.installNativeOriginalBrowserPreparation==='undefined'"));
                source.get().requireAttachedView(view.get());
                String before=evaluate(scenario,"JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
                    +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])");
                // Missing original input is a denial, NOT a synthetic binding.
                // It cannot start a hold/capture or consume/reset an original.
                try(var unexpected=source.get().capture(null,control)){fail("missing original tuple accepted");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                String after=evaluate(scenario,"JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
                    +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])");
                assertTrue("denied capture changed existing local/session originals",before.equals(after));
                // Retire THIS actual attachment synchronously before navigating.
                // No second attach, forced reload API, new control or fresh
                // original is used to rearm a consumed/unknown capture budget.
                control.requestCancellation();
                scenario.onActivity(activity->{source.get().close();source.get().close();});
                try{source.get().requireAttachedView(view.get());fail("closed Source revived");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                try{source.get().reloadConsumedRecoveryDocument(control);fail("canceled closed Source reloaded");}
                catch(VaultFailure denied){assertEquals("custodial_private_custody_transport_outcome_unknown",denied.code);}
                loadExistingPackagedPage(scenario,bridge.get(),view.get(),PAGE+"?original_source_lifecycle=retired");
                assertEquals("true",evaluate(scenario,"typeof globalThis.custodialOriginalBrowserPreparation==='undefined'"));
                try{source.get().requireAttachedView(view.get());fail("navigation adopted a new document into closed Source");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{NativeOriginalBrowserPreparation original=source.get();if(original!=null)scenario.onActivity(activity->original.close());}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            }
        }finally{
            // Existing Activity destruction retires its plugin executor; never
            // clear preferences/WebStorage/custody originals or shared keys.
            BridgeSmokeActivity.install(null);
        }
        assertTrue("native original stores changed",originalStores.equals(stores(context)));
        assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.completionCalls.get());
        assertEquals(0,transport.cancelCalls.get());assertEquals(0,transport.removeCalls.get());
        assertFalse(transport.issued);assertFalse(transport.confirmed);
    }

    /** One real attached document, native proxy and binary DATA collection.
     * The literal binding is the existing host vector, NOT a manager/original
     * capability. Unknown local bytes never become completion arguments. */
    @Test(timeout=60000)
    public void actualDocumentStartSourceCollectsOriginalLocalDataWithoutAuthority()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated instrumentation target required",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("never clear an enrolled vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originalStores=stores(context);
        VaultClock clock=System::currentTimeMillis;
        InstrumentedTransport transport=new InstrumentedTransport(clock);
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        AtomicReference<NativeOriginalBrowserPreparation> source=new AtomicReference<>();
        AtomicReference<Bridge> bridge=new AtomicReference<>();
        AtomicReference<WebView> view=new AtomicReference<>();
        final String key="unit-original-browser-data-not-authority";
        final String value="UNIT retained DATA: {\"large\":9007199254740993,\"fraction\":0.12345678901234567890}; euro=\u20ac";
        final byte[] originalUtf8=value.getBytes(StandardCharsets.UTF_8);
        JSONObject binding=new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64))
            .put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
        BridgeSmokeActivity.install(plugin);
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
            NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
            Throwable primary=null;
            try{
                scenario.onActivity(activity->{
                    try{
                        Bridge actual=activity.getBridge();assertNotNull(actual);
                        WebView web=actual.getWebView();assertNotNull(web);bridge.set(actual);view.set(web);
                        requireShippingBootstrapAssets(activity);
                        // Same explicit no-vault TEST host as the existing member.
                        // Native attach still validates the actual packaged Source.
                        web.getSettings().setSupportMultipleWindows(false);
                        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                        source.set(NativeOriginalBrowserPreparation.attach(activity,actual));
                        source.get().requireAttachedView(web);
                    }catch(Exception unavailable){throw new AssertionError("actual Source attach unavailable; no substitute",unavailable);}
                });
                loadExistingPackagedPage(scenario,bridge.get(),view.get(),PAGE+"?original_source_data=unit");
                assertEquals("true",evaluate(scenario,"typeof globalThis.custodialOriginalBrowserPreparation==='object'"
                    +" && typeof globalThis.custodialOriginalBrowserPreparation.postMessage==='function'"));
                assertEquals("true",evaluate(scenario,"typeof globalThis.installNativeOriginalBrowserPreparation==='undefined'"));
                // Ordinary Storage API only, before capture. Never replace an
                // existing row, protected hold/epoch, port, callback or token.
                assertEquals("null",evaluate(scenario,"localStorage.getItem("+JSONObject.quote(key)+")"));
                assertEquals("true",evaluate(scenario,"(()=>{localStorage.setItem("+JSONObject.quote(key)+","
                    +JSONObject.quote(value)+");return localStorage.getItem("+JSONObject.quote(key)+")==="+JSONObject.quote(value)+"})()"));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertNotSame("native capture must not block WebView UI",android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                // Native-generated request/phase tokens, real ReplyProxy and
                // real binary chunks; this thread never fabricates a wire reply.
                try(var exchange=source.get().capture(binding,control)){
                    exchange.collectOriginalValues();
                    exchange.recheck();
                    var records=exchange.originalRecords();
                    JSONObject metadata=exchange.originalValueMetadata(),projection=exchange.projection();
                    assertEquals("MZBRV001",metadata.getString("encoding"));
                    assertEquals(records.frameSha256,metadata.getString("frame_sha256"));
                    assertEquals(records.observationSha256,metadata.getString("observation_sha256"));
                    assertEquals(records.recordCount,metadata.getInt("record_count"));
                    assertEquals(records.recordCount,records.originalRecords().size());
                    assertEquals(records.sessionStorageState,metadata.getString("session_storage_state"));
                    assertEquals(metadata.getInt("chunk_count"),metadata.getJSONArray("chunk_sha256").length());
                    assertTrue(metadata.getLong("byte_count")>0);
                    assertTrue(metadata.getInt("chunk_count")>0);
                    assertEquals("SAME_DOCUMENT_CAPTURE_RECHECKED_NOT_ACK",projection.getString("state"));
                    assertEquals(records.frameSha256,projection.getJSONObject("original_value_frame").getString("frame_sha256"));
                    assertEquals(records.recordCount,projection.getJSONObject("observation").getInt("record_count"));
                    int fixtureRows=0;
                    String keyHash=unitStorageStringDigest(key),bodyHash=unitStorageStringDigest(value);
                    for(var row:records.originalRecords()){
                        assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                        if("localStorage".equals(row.store)&&keyHash.equals(row.keySha256)){
                            fixtureRows++;assertEquals(bodyHash,row.bodySha256);
                            assertNull(row.database);assertNull(row.version);assertNull(row.objectStore);
                            assertEquals(row.ordinal,records.originalRecords().get(row.ordinal).ordinal);
                            JSONObject diagnostic=projection.getJSONObject("census").getJSONArray("records").getJSONObject(row.ordinal);
                            assertEquals(row.ordinal,diagnostic.getInt("capture_record_ordinal"));
                            assertEquals(keyHash,diagnostic.getString("key_sha256"));
                            assertEquals(bodyHash,diagnostic.getString("body_sha256"));
                            assertEquals("LOCAL_ORIGINAL_RETAINED_UNKNOWN",diagnostic.getString("state"));
                            assertEquals(Boolean.FALSE,diagnostic.get("source_authenticated"));
                            assertEquals(Boolean.FALSE,diagnostic.get("automatic_acceptance"));
                        }
                    }
                    assertEquals("exact seeded original in binary-validated rows",1,fixtureRows);
                    for(String flag:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})
                        assertEquals(Boolean.FALSE,metadata.get(flag));
                    for(String flag:new String[]{"original_value_bytes_durably_retained","browser_source_authenticated",
                        "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged",
                        "work_accepted","finalizer_allowed","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.get(flag));
                    for(String flag:new String[]{"native_authority","frozen","acknowledged","phone_released"})
                        assertEquals(Boolean.FALSE,projection.getJSONObject("observation").get(flag));
                    for(String flag:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory",
                        "current_server_readback","cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.getJSONObject("census").get(flag));
                    assertTrue(projection.getBoolean("all_declared_original_value_bytes_received_volatile_only"));
                    assertTrue(projection.getBoolean("private_document_start_source_bound"));
                    // No arbitrary-row byte loan is exposed by OriginalRecords:
                    // binary digest binds the original; these copied UTF-8 bytes
                    // are independently read from the ACTUAL Storage API, not
                    // presented as native custody or a journal-target capability.
                    assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                }
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                scenario.onActivity(activity->source.get().close());
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                // Deliberately no reset/recapture/navigation rearm or deletion
                // of retained unknown rows, hold metadata or native originals.
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{NativeOriginalBrowserPreparation original=source.get();if(original!=null)scenario.onActivity(activity->original.close());}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            }
        }finally{BridgeSmokeActivity.install(null);}
        assertTrue("native stores changed",originalStores.equals(stores(context)));
        assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.completionCalls.get());
        assertEquals(0,transport.cancelCalls.get());assertEquals(0,transport.removeCalls.get());
        assertFalse(transport.issued);assertFalse(transport.confirmed);
    }

    /** Real capture followed by retirement and an ordinary queued page write.
     * The persisted hold is observed, never manufactured/cleared by this test;
     * a receiver TypeError or an unavailable callback is NOT writer refusal. */
    @Test(timeout=60000)
    public void actualCollectedOriginalHoldRefusesQueuedPublicWriterAfterNativeRetirement()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated instrumentation target required",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("never clear an enrolled vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originalStores=stores(context);
        VaultClock clock=System::currentTimeMillis;
        InstrumentedTransport transport=new InstrumentedTransport(clock);
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        AtomicReference<NativeOriginalBrowserPreparation> source=new AtomicReference<>();
        AtomicReference<Bridge> bridge=new AtomicReference<>();
        AtomicReference<WebView> view=new AtomicReference<>();
        final String key="unit-original-held-writer-not-authority";
        final String value="UNIT original bytes retained; 9007199254740993; euro=\u20ac";
        final String replacement="UNIT forbidden queued replacement";
        final byte[] originalUtf8=value.getBytes(StandardCharsets.UTF_8);
        final String holdRead="localStorage.getItem('mz_custodial_protected_browser_hold.v1')";
        final String epochRead="localStorage.getItem('mz_custodial_protected_browser_mutation.v1')";
        final String allStorage="JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
            +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])";
        JSONObject binding=new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64))
            .put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
        BridgeSmokeActivity.install(plugin,source);
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
            NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
            Throwable primary=null;
            try{
                scenario.onActivity(activity->{
                    try{
                        Bridge actual=activity.getBridge();assertNotNull(actual);
                        WebView web=actual.getWebView();assertNotNull(web);bridge.set(actual);view.set(web);
                        requireShippingBootstrapAssets(activity);
                        assertFalse(web.getSettings().supportMultipleWindows());
                        assertFalse(web.getSettings().getJavaScriptCanOpenWindowsAutomatically());
                        assertNotNull(source.get());
                        source.get().requireAttachedView(web);
                    }catch(Exception unavailable){throw new AssertionError("actual Source attach unavailable; no substitute",unavailable);}
                });
                // This member requires the opt-in NORMAL full app asset set.
                // Its real shell can navigate to the normal legacy Home; a
                // blank smoke document cannot supply the public firewall.
                loadNormalCustodialApplication(scenario,bridge.get(),view.get(),true);
                assertEquals("true",evaluate(scenario,"typeof globalThis.custodialOriginalBrowserPreparation==='object'"
                    +" && typeof globalThis.custodialOriginalBrowserPreparation.postMessage==='function'"));
                // A prior retained capture is not a fresh test prerequisite.
                // Refuse it rather than deleting its hold or rearming it.
                assertEquals("null",evaluate(scenario,holdRead));
                assertEquals("null",evaluate(scenario,"localStorage.getItem("+JSONObject.quote(key)+")"));
                assertEquals("true",evaluate(scenario,"(()=>{localStorage.setItem("+JSONObject.quote(key)+","
                    +JSONObject.quote(value)+");return localStorage.getItem("+JSONObject.quote(key)+")==="+JSONObject.quote(value)+"})()"));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertNotSame(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                String originalHold,originalEpoch;
                try(var exchange=source.get().capture(binding,control)){
                    exchange.collectOriginalValues();exchange.recheck();
                    var records=exchange.originalRecords();
                    JSONObject metadata=exchange.originalValueMetadata(),projection=exchange.projection();
                    assertEquals(records.frameSha256,metadata.getString("frame_sha256"));
                    assertEquals(records.recordCount,metadata.getInt("record_count"));
                    assertEquals("SAME_DOCUMENT_CAPTURE_RECHECKED_NOT_ACK",projection.getString("state"));
                    int originals=0;
                    String keyHash=unitStorageStringDigest(key),bodyHash=unitStorageStringDigest(value);
                    for(var row:records.originalRecords()){
                        assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                        if("localStorage".equals(row.store)&&keyHash.equals(row.keySha256)){
                            originals++;assertEquals(bodyHash,row.bodySha256);
                        }
                    }
                    assertEquals("actual seeded original collected before withdrawal",1,originals);
                    for(String flag:new String[]{"original_value_bytes_durably_retained","browser_source_authenticated",
                        "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged",
                        "work_accepted","finalizer_allowed","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.get(flag));
                    originalHold=evaluate(scenario,holdRead);originalEpoch=evaluate(scenario,epochRead);
                    Object holdText=new JSONTokener(originalHold).nextValue();
                    assertTrue("capture must establish its real persisted hold",holdText instanceof String);
                    JSONObject actualHold=new JSONObject((String)holdText);
                    assertEquals("custodial.browser-preservation-hold.v1",actualHold.getString("schema"));
                    assertEquals(binding.getString("operation_id"),actualHold.getString("operation_id"));
                    assertEquals(Boolean.FALSE,actualHold.get("native_authority"));
                    assertTrue("actual epoch observation required",new JSONTokener(originalEpoch).nextValue() instanceof String);
                    // An ordinary page can dispatch a forged pagehide. It
                    // must retire its current private capture, never rearm
                    // that document or acquire a fresh native baseline.
                    // The native registration itself is not realm-violated.
                    assertEquals("true",evaluate(scenario,"dispatchEvent(new Event('pagehide'))"));
                    source.get().requireAttachedView(view.get());
                    try{exchange.recheck();fail("retired document remained usable");}
                    catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                    assertEquals(originalHold,evaluate(scenario,holdRead));
                    assertEquals(originalEpoch,evaluate(scenario,epochRead));
                } // This same exchange closes before the control and Source.
                control.close();
                scenario.onActivity(activity->source.get().close());
                try{source.get().requireAttachedView(view.get());fail("withdrawn native Source remained usable");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                assertEquals(originalHold,evaluate(scenario,holdRead));
                assertEquals(originalEpoch,evaluate(scenario,epochRead));
                String beforeQueuedWrite=evaluate(scenario,allStorage);
                assertTrue("native stores changed before writer attempt",originalStores.equals(stores(context)));
                // This is ordinary page scheduling after native withdrawal,
                // not a gate/port call, borrowed raw method or fake event.
                // The sole result field is test callback DATA, not authority.
                assertEquals("true",evaluate(scenario,"(()=>{"
                    +"if(Object.prototype.hasOwnProperty.call(globalThis,'__unitHeldWriterOutcomeV7'))throw Error('stale UNIT callback');"
                    +"Object.defineProperty(globalThis,'__unitHeldWriterOutcomeV7',{value:null,writable:true,configurable:false});"
                    +"setTimeout(()=>{try{localStorage.setItem("+JSONObject.quote(key)+","+JSONObject.quote(replacement)+");"
                    +"globalThis.__unitHeldWriterOutcomeV7={outcome:'WRITE_SUCCEEDED'};}"
                    +"catch(error){globalThis.__unitHeldWriterOutcomeV7={name:error.name,code:error.code,key:error.key};}},0);"
                    +"return true;})()"));
                JSONObject refused=awaitUnitHeldWriterOutcome(scenario);
                assertEquals("CustodialProtectedStateMutationError",refused.getString("name"));
                assertEquals("custodial_protected_state_read_only",refused.getString("code"));
                assertEquals(key,refused.getString("key"));
                assertFalse("successful mutation cannot be refusal",refused.has("outcome"));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertEquals("ordinary queued write changed public originals",beforeQueuedWrite,evaluate(scenario,allStorage));
                assertEquals(originalHold,evaluate(scenario,holdRead));
                assertEquals(originalEpoch,evaluate(scenario,epochRead));
                assertTrue("native stores changed by held writer",originalStores.equals(stores(context)));
                // No retry/capture/control replacement, hold/epoch clear,
                // navigation, private raw getter or second writer attempt.
            }catch(Exception|Error failure){
                android.util.Log.e("CustodialOriginalRuntime","Actual held-writer workflow did not complete",failure);
                primary=failure;throw failure;
            }
            finally{
                try{NativeOriginalBrowserPreparation original=source.get();if(original!=null)scenario.onActivity(activity->original.close());}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            }
        }finally{BridgeSmokeActivity.install(null);}
        assertTrue("native stores changed",originalStores.equals(stores(context)));
        assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.completionCalls.get());
        assertEquals(0,transport.cancelCalls.get());assertEquals(0,transport.removeCalls.get());
        assertFalse(transport.issued);assertFalse(transport.confirmed);
    }

    /** Six finite ordinary named-writer paths on the TWO actual public areas.
     * Real Source collection/retirement precedes the queued callback; no model
     * Storage, private raw receiver, replacement facade or gate is supplied. */
    @Test(timeout=60000)
    public void actualCollectedOriginalHoldRefusesNamedWritersInBothStorageAreas()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated instrumentation target required",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("never clear an enrolled vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originalStores=stores(context);
        VaultClock clock=System::currentTimeMillis;
        InstrumentedTransport transport=new InstrumentedTransport(clock);
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        AtomicReference<NativeOriginalBrowserPreparation> source=new AtomicReference<>();
        AtomicReference<Bridge> bridge=new AtomicReference<>();
        AtomicReference<WebView> view=new AtomicReference<>();
        final String localKey="unit-held-named-local-not-authority",sessionKey="unit-held-named-session-not-authority";
        final String localValue="UNIT local original; 9007199254740993; euro=\u20ac";
        final String sessionValue="UNIT session original; 0.12345678901234567890; euro=\u20ac";
        final byte[] localUtf8=localValue.getBytes(StandardCharsets.UTF_8),sessionUtf8=sessionValue.getBytes(StandardCharsets.UTF_8);
        final String holdRead="localStorage.getItem('mz_custodial_protected_browser_hold.v1')";
        final String epochRead="localStorage.getItem('mz_custodial_protected_browser_mutation.v1')";
        final String allStorage="JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
            +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])";
        JSONObject binding=new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64))
            .put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
        BridgeSmokeActivity.install(plugin);
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
            NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
            Throwable primary=null;
            try{
                scenario.onActivity(activity->{
                    try{
                        Bridge actual=activity.getBridge();assertNotNull(actual);
                        WebView web=actual.getWebView();assertNotNull(web);bridge.set(actual);view.set(web);
                        requireShippingBootstrapAssets(activity);
                        web.getSettings().setSupportMultipleWindows(false);
                        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                        source.set(NativeOriginalBrowserPreparation.attach(activity,actual));
                        source.get().requireAttachedView(web);
                    }catch(Exception unavailable){throw new AssertionError("actual Source attach unavailable; no substitute",unavailable);}
                });
                loadNormalCustodialApplication(scenario,bridge.get(),view.get());
                assertEquals("true",evaluate(scenario,"localStorage!==sessionStorage"));
                assertEquals("null",evaluate(scenario,holdRead));
                assertEquals("null",evaluate(scenario,"localStorage.getItem("+JSONObject.quote(localKey)+")"));
                assertEquals("null",evaluate(scenario,"sessionStorage.getItem("+JSONObject.quote(sessionKey)+")"));
                // Unknown fixed scalar DATA only, using normal public methods
                // before capture. Never overwrite a previous retained original.
                assertEquals("true",evaluate(scenario,"(()=>{localStorage.setItem("+JSONObject.quote(localKey)+","
                    +JSONObject.quote(localValue)+");sessionStorage.setItem("+JSONObject.quote(sessionKey)+","+JSONObject.quote(sessionValue)+");"
                    +"return localStorage.getItem("+JSONObject.quote(localKey)+")==="+JSONObject.quote(localValue)
                    +"&&sessionStorage.getItem("+JSONObject.quote(sessionKey)+")==="+JSONObject.quote(sessionValue)+"})()"));
                assertArrayEquals(localUtf8,readUnitLocalData(scenario,localKey));
                assertArrayEquals(sessionUtf8,readUnitSessionData(scenario,sessionKey));
                assertNotSame(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                String originalHold,originalEpoch;
                try(var exchange=source.get().capture(binding,control)){
                    exchange.collectOriginalValues();exchange.recheck();
                    var records=exchange.originalRecords();
                    JSONObject metadata=exchange.originalValueMetadata(),projection=exchange.projection();
                    assertEquals(records.frameSha256,metadata.getString("frame_sha256"));
                    assertEquals(records.recordCount,metadata.getInt("record_count"));
                    assertEquals("CAPTURED_READ_ONLY_NOT_AUTHENTICATED",records.sessionStorageState);
                    int localOriginals=0,sessionOriginals=0;
                    for(var row:records.originalRecords()){
                        assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                        if("localStorage".equals(row.store)&&unitStorageStringDigest(localKey).equals(row.keySha256)){
                            localOriginals++;assertEquals(unitStorageStringDigest(localValue),row.bodySha256);
                        }
                        if("sessionStorage".equals(row.store)&&unitStorageStringDigest(sessionKey).equals(row.keySha256)){
                            sessionOriginals++;assertEquals(unitStorageStringDigest(sessionValue),row.bodySha256);
                        }
                    }
                    assertEquals("actual local original collected",1,localOriginals);
                    assertEquals("actual session original collected",1,sessionOriginals);
                    for(String flag:new String[]{"original_value_bytes_durably_retained","browser_source_authenticated",
                        "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged",
                        "work_accepted","finalizer_allowed","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.get(flag));
                    originalHold=evaluate(scenario,holdRead);originalEpoch=evaluate(scenario,epochRead);
                    Object holdText=new JSONTokener(originalHold).nextValue();
                    assertTrue("capture must establish its real persisted hold",holdText instanceof String);
                    JSONObject actualHold=new JSONObject((String)holdText);
                    assertEquals("custodial.browser-preservation-hold.v1",actualHold.getString("schema"));
                    assertEquals(binding.getString("operation_id"),actualHold.getString("operation_id"));
                    assertEquals(Boolean.FALSE,actualHold.get("native_authority"));
                    assertTrue("actual epoch observation required",new JSONTokener(originalEpoch).nextValue() instanceof String);
                }
                control.close();
                scenario.onActivity(activity->source.get().close());
                try{source.get().requireAttachedView(view.get());fail("withdrawn Source remained usable");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                assertEquals(originalHold,evaluate(scenario,holdRead));assertEquals(originalEpoch,evaluate(scenario,epochRead));
                String beforeWriters=evaluate(scenario,allStorage);
                assertTrue("native originals changed before queued writers",originalStores.equals(stores(context)));
                String queuedWriters="""
                    (()=>{
                      if(Object.prototype.hasOwnProperty.call(globalThis,'__unitHeldNamedWriterOutcomesV10'))throw Error('stale UNIT callback');
                      Object.defineProperty(globalThis,'__unitHeldNamedWriterOutcomesV10',{value:null,writable:true,configurable:false});
                      const localKey=__LOCAL_KEY_JSON__,sessionKey=__SESSION_KEY_JSON__;
                      const replacement='UNIT forbidden named writer replacement';
                      const paths=[
                        ['localStorage','named-assignment',()=>{localStorage[localKey]=replacement;}],
                        ['localStorage','defineProperty',()=>{Object.defineProperty(localStorage,localKey,{value:replacement,enumerable:true,configurable:true,writable:true});}],
                        ['localStorage','delete',()=>{delete localStorage[localKey];}],
                        ['sessionStorage','named-assignment',()=>{sessionStorage[sessionKey]=replacement;}],
                        ['sessionStorage','defineProperty',()=>{Object.defineProperty(sessionStorage,sessionKey,{value:replacement,enumerable:true,configurable:true,writable:true});}],
                        ['sessionStorage','delete',()=>{delete sessionStorage[sessionKey];}]
                      ];
                      setTimeout(()=>{
                        const results=[];
                        for(const [area,path,mutate] of paths){
                          let observed;
                          try{mutate();observed={area,path,outcome:'MUTATION_RETURNED'};}
                          catch(error){observed={area,path,name:error?.name,code:error?.code,key:error?.key};}
                          results.push(observed);
                          // Stop on the FIRST unexpected outcome, never retry
                          // or repair a row just to exercise subsequent paths.
                          const key=area==='localStorage'?localKey:sessionKey;
                          if(observed.name!=='CustodialProtectedStateMutationError'
                            ||observed.code!=='custodial_protected_state_read_only'||observed.key!==key)break;
                        }
                        globalThis.__unitHeldNamedWriterOutcomesV10=results;
                      },0);
                      return true;
                    })()
                    """.replace("__LOCAL_KEY_JSON__",JSONObject.quote(localKey)).replace("__SESSION_KEY_JSON__",JSONObject.quote(sessionKey));
                assertEquals("true",evaluate(scenario,queuedWriters));
                org.json.JSONArray outcomes=awaitUnitHeldNamedWriterOutcomes(scenario);
                String[] areas={"localStorage","localStorage","localStorage","sessionStorage","sessionStorage","sessionStorage"};
                String[] paths={"named-assignment","defineProperty","delete","named-assignment","defineProperty","delete"};
                assertTrue("actual queued callback returned no attempt",outcomes.length()>0);
                assertTrue("unbounded or duplicate writer attempts",outcomes.length()<=areas.length);
                for(int i=0;i<outcomes.length();i++){
                    JSONObject refused=outcomes.getJSONObject(i);
                    assertEquals(areas[i],refused.getString("area"));assertEquals(paths[i],refused.getString("path"));
                    assertFalse("mutation returned instead of shipping refusal: "+refused,refused.has("outcome"));
                    assertEquals("CustodialProtectedStateMutationError",refused.getString("name"));
                    assertEquals("custodial_protected_state_read_only",refused.getString("code"));
                    assertEquals(i<3?localKey:sessionKey,refused.getString("key"));
                }
                assertEquals("all six distinct actual public paths must refuse",areas.length,outcomes.length());
                assertArrayEquals(localUtf8,readUnitLocalData(scenario,localKey));
                assertArrayEquals(sessionUtf8,readUnitSessionData(scenario,sessionKey));
                assertEquals("queued writers changed public originals",beforeWriters,evaluate(scenario,allStorage));
                assertEquals(originalHold,evaluate(scenario,holdRead));assertEquals(originalEpoch,evaluate(scenario,epochRead));
                assertTrue("queued writers changed native originals",originalStores.equals(stores(context)));
                // Retain unknown data/hold; no reset, raw getter, rearm,
                // new control/Source, second callback or confirmation path.
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{NativeOriginalBrowserPreparation original=source.get();if(original!=null)scenario.onActivity(activity->original.close());}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            }
        }finally{BridgeSmokeActivity.install(null);}
        assertTrue("native stores changed",originalStores.equals(stores(context)));
        assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.completionCalls.get());
        assertEquals(0,transport.cancelCalls.get());assertEquals(0,transport.removeCalls.get());
        assertFalse(transport.issued);assertFalse(transport.confirmed);
    }

    /** Persisted hold across ONE real Home document reload, with no new
     * private Source/control/capture on the successor document. Fixture DATA
     * is not native original, manager, SQL or effect authority. */
    @Test(timeout=60000)
    public void actualPersistedOriginalHoldRefusesPublicWriterAfterHomeReload()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated instrumentation target required",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("never clear an enrolled vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originalStores=stores(context);
        VaultClock clock=System::currentTimeMillis;
        InstrumentedTransport transport=new InstrumentedTransport(clock);
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        AtomicReference<NativeOriginalBrowserPreparation> source=new AtomicReference<>();
        AtomicReference<Bridge> bridge=new AtomicReference<>();
        AtomicReference<WebView> view=new AtomicReference<>();
        final String key="unit-held-home-reload-not-authority";
        final String value="UNIT retained across Home reload; 9007199254740993; euro=\u20ac";
        final byte[] originalUtf8=value.getBytes(StandardCharsets.UTF_8);
        final String holdRead="localStorage.getItem('mz_custodial_protected_browser_hold.v1')";
        final String epochRead="localStorage.getItem('mz_custodial_protected_browser_mutation.v1')";
        final String allStorage="JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
            +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])";
        JSONObject binding=new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64))
            .put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
        BridgeSmokeActivity.install(plugin);
        try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
            NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
            Throwable primary=null;
            try{
                scenario.onActivity(activity->{
                    try{
                        Bridge actual=activity.getBridge();assertNotNull(actual);
                        WebView web=actual.getWebView();assertNotNull(web);bridge.set(actual);view.set(web);
                        requireShippingBootstrapAssets(activity);
                        web.getSettings().setSupportMultipleWindows(false);
                        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                        source.set(NativeOriginalBrowserPreparation.attach(activity,actual));
                        source.get().requireAttachedView(web);
                    }catch(Exception unavailable){throw new AssertionError("actual Source attach unavailable; no substitute",unavailable);}
                });
                loadNormalCustodialApplication(scenario,bridge.get(),view.get());
                scenario.onActivity(activity->assertEquals("fixed packaged Home required before capture",PAGE,view.get().getUrl()));
                assertEquals("true",evaluate(scenario,"location.href==='https://localhost/index.html'"));
                assertEquals("null",evaluate(scenario,holdRead));
                assertEquals("null",evaluate(scenario,"localStorage.getItem("+JSONObject.quote(key)+")"));
                assertEquals("true",evaluate(scenario,"(()=>{localStorage.setItem("+JSONObject.quote(key)+","
                    +JSONObject.quote(value)+");return localStorage.getItem("+JSONObject.quote(key)+")==="+JSONObject.quote(value)+"})()"));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertNotSame(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                String originalHold,originalEpoch;
                try(var exchange=source.get().capture(binding,control)){
                    exchange.collectOriginalValues();exchange.recheck();
                    var records=exchange.originalRecords();
                    JSONObject metadata=exchange.originalValueMetadata(),projection=exchange.projection();
                    assertEquals(records.frameSha256,metadata.getString("frame_sha256"));
                    assertEquals(records.recordCount,metadata.getInt("record_count"));
                    assertEquals("SAME_DOCUMENT_CAPTURE_RECHECKED_NOT_ACK",projection.getString("state"));
                    int originals=0;
                    String keyHash=unitStorageStringDigest(key),bodyHash=unitStorageStringDigest(value);
                    for(var row:records.originalRecords()){
                        assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                        if("localStorage".equals(row.store)&&keyHash.equals(row.keySha256)){
                            originals++;assertEquals(bodyHash,row.bodySha256);
                        }
                    }
                    assertEquals("actual original collected before retirement",1,originals);
                    for(String flag:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})
                        assertEquals(Boolean.FALSE,metadata.get(flag));
                    for(String flag:new String[]{"original_value_bytes_durably_retained","browser_source_authenticated",
                        "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged",
                        "work_accepted","finalizer_allowed","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.get(flag));
                    for(String flag:new String[]{"native_authority","frozen","acknowledged","phone_released"})
                        assertEquals(Boolean.FALSE,projection.getJSONObject("observation").get(flag));
                    for(String flag:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory",
                        "current_server_readback","cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"})
                        assertEquals(Boolean.FALSE,projection.getJSONObject("census").get(flag));
                    originalHold=evaluate(scenario,holdRead);originalEpoch=evaluate(scenario,epochRead);
                    Object holdText=new JSONTokener(originalHold).nextValue();
                    assertTrue("actual persisted hold required",holdText instanceof String);
                    JSONObject actualHold=new JSONObject((String)holdText);
                    assertEquals("custodial.browser-preservation-hold.v1",actualHold.getString("schema"));
                    assertEquals(binding.getString("operation_id"),actualHold.getString("operation_id"));
                    assertEquals(Boolean.FALSE,actualHold.get("native_authority"));
                    assertTrue("actual epoch observation required",new JSONTokener(originalEpoch).nextValue() instanceof String);
                }
                control.close();
                scenario.onActivity(activity->source.get().close());
                try{source.get().requireAttachedView(view.get());fail("retired Source remained usable before reload");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                assertEquals(originalHold,evaluate(scenario,holdRead));assertEquals(originalEpoch,evaluate(scenario,epochRead));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertTrue("native originals changed before reload",originalStores.equals(stores(context)));
                // Fixed same-view reload only. No normal-loader call here:
                // that would request another shell/Home navigation sequence.
                reloadHeldNormalHomeOnce(scenario,bridge.get(),view.get());
                try{source.get().requireAttachedView(view.get());fail("old Source rebound after Home reload");}
                catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
                assertEquals(originalHold,evaluate(scenario,holdRead));assertEquals(originalEpoch,evaluate(scenario,epochRead));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertTrue("native originals changed across document reload",originalStores.equals(stores(context)));
                String beforeWrite=evaluate(scenario,allStorage);
                // Reuse only the existing bounded callback reader. Its V7
                // field name is test DATA on THIS new document, not a Source
                // token, reused capture or an invocation of the old @Test.
                String queuedWriter="""
                    (()=>{
                      if(Object.prototype.hasOwnProperty.call(globalThis,'__unitHeldWriterOutcomeV7'))throw Error('stale UNIT callback');
                      Object.defineProperty(globalThis,'__unitHeldWriterOutcomeV7',{value:null,writable:true,configurable:false});
                      setTimeout(()=>{
                        try{localStorage.setItem(__KEY_JSON__,'UNIT forbidden post-reload replacement');
                          globalThis.__unitHeldWriterOutcomeV7={outcome:'WRITE_SUCCEEDED'};}
                        catch(error){globalThis.__unitHeldWriterOutcomeV7={name:error?.name,code:error?.code,key:error?.key};}
                      },0);
                      return true;
                    })()
                    """.replace("__KEY_JSON__",JSONObject.quote(key));
                assertEquals("true",evaluate(scenario,queuedWriter));
                JSONObject refused=awaitUnitHeldWriterOutcome(scenario);
                assertFalse("post-reload mutation returned instead of refusing",refused.has("outcome"));
                assertEquals("CustodialProtectedStateMutationError",refused.getString("name"));
                assertEquals("custodial_protected_state_read_only",refused.getString("code"));
                assertEquals(key,refused.getString("key"));
                assertArrayEquals(originalUtf8,readUnitLocalData(scenario,key));
                assertEquals(originalHold,evaluate(scenario,holdRead));assertEquals(originalEpoch,evaluate(scenario,epochRead));
                assertEquals("held write changed successor document Storage",beforeWrite,evaluate(scenario,allStorage));
                assertTrue("held write changed native originals",originalStores.equals(stores(context)));
                // No second reload, Source/control/capture, retry or hold/epoch
                // clear. The original unknown row remains recoverably held.
            }catch(Exception|Error failure){primary=failure;throw failure;}
            finally{
                try{NativeOriginalBrowserPreparation original=source.get();if(original!=null)scenario.onActivity(activity->original.close());}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            }
        }finally{BridgeSmokeActivity.install(null);}
        assertTrue("native originals changed",originalStores.equals(stores(context)));
        assertEquals(0,transport.enrollCalls.get());assertEquals(0,transport.completionCalls.get());
        assertEquals(0,transport.cancelCalls.get());assertEquals(0,transport.removeCalls.get());
        assertFalse(transport.issued);assertFalse(transport.confirmed);
    }

    private static void reloadHeldNormalHomeOnce(ActivityScenario<BridgeSmokeActivity> scenario,Bridge bridge,WebView view)throws Exception{
        java.util.concurrent.atomic.AtomicBoolean started=new java.util.concurrent.atomic.AtomicBoolean();
        com.getcapacitor.WebViewListener observer=new com.getcapacitor.WebViewListener(){
            @Override public void onPageStarted(WebView actual){if(actual==view)started.set(true);}
        };
        Throwable primary=null;JSONObject last=null;
        final long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        try{
            scenario.onActivity(activity->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
                assertEquals("reload must target current fixed Home only",PAGE,view.getUrl());
                bridge.addWebViewListener(observer);view.reload();
            });
            do{
                CountDownLatch completed=new CountDownLatch(1);
                AtomicReference<String> nativeUrl=new AtomicReference<>(),callback=new AtomicReference<>();
                scenario.onActivity(activity->{
                    assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());nativeUrl.set(view.getUrl());
                    view.evaluateJavascript("JSON.stringify({href:location.href,origin:location.origin,state:document.readyState,"
                        +"home:document.title==='Memphis Zoo Custodial'&&document.body?.getAttribute('data-memphis-context')==='employee'"
                        +"&&!!document.getElementById('home')&&!!document.getElementById('boot'),"
                        +"navigationType:(()=>{const n=performance.getEntriesByType('navigation');return n.length===1?n[0].type:null;})(),"
                        +"security:typeof globalThis.MemphisCustodialSecurity==='object'&&globalThis.MemphisCustodialSecurity?.native===true"
                        +"&&typeof globalThis.MemphisCustodialSecurity?.getStatus==='function',"
                        +"facade:(()=>{const p=Object.getOwnPropertyDescriptor(globalThis,'localStorage');return !!p"
                        +"&&Object.prototype.hasOwnProperty.call(p,'value')&&!p.get&&!p.set&&p.configurable===false&&p.writable===false;})(),"
                        +"sourceAbsent:typeof globalThis.custodialOriginalBrowserPreparation==='undefined'})",
                        result->{callback.set(result);completed.countDown();});
                });
                long remaining=deadline-System.nanoTime();
                assertTrue("reload document callback exceeded original five-second budget",
                    remaining>0&&completed.await(remaining,TimeUnit.NANOSECONDS));
                assertNotNull("actual reload callback missing",callback.get());
                Object data=new JSONTokener(callback.get()).nextValue();
                assertTrue("actual reload document DATA required",data instanceof String);last=new JSONObject((String)data);
                if(started.get()&&PAGE.equals(nativeUrl.get())&&PAGE.equals(last.getString("href"))
                    &&"https://localhost".equals(last.getString("origin"))&&"complete".equals(last.getString("state"))
                    &&"reload".equals(last.optString("navigationType"))&&last.getBoolean("home")
                    &&last.getBoolean("security")&&last.getBoolean("facade")&&last.getBoolean("sourceAbsent"))return;
                remaining=deadline-System.nanoTime();
                if(remaining>0)TimeUnit.NANOSECONDS.sleep(Math.min(remaining,TimeUnit.MILLISECONDS.toNanos(25)));
            }while(System.nanoTime()<deadline);
            throw new AssertionError("same-view Home reload/normal runtime/absent Source not observed: "+last);
        }catch(Exception|Error failure){primary=failure;throw failure;}
        finally{
            try{scenario.onActivity(activity->bridge.removeWebViewListener(observer));}
            catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
        }
    }

    private static org.json.JSONArray awaitUnitHeldNamedWriterOutcomes(ActivityScenario<BridgeSmokeActivity> scenario)throws Exception{
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        do{
            String callback=evaluate(scenario,"globalThis.__unitHeldNamedWriterOutcomesV10===null?null:JSON.stringify(globalThis.__unitHeldNamedWriterOutcomesV10)");
            Object result=new JSONTokener(callback).nextValue();
            if(result!=JSONObject.NULL){assertTrue("actual queued callback shape",result instanceof String);return new org.json.JSONArray((String)result);}
            Thread.sleep(25);
        }while(System.nanoTime()<deadline);
        throw new AssertionError("actual named-writer callback unavailable; no refusal proof");
    }
    private static byte[] readUnitSessionData(ActivityScenario<BridgeSmokeActivity> scenario,String key)throws Exception{
        Object original=new JSONTokener(evaluate(scenario,"sessionStorage.getItem("+JSONObject.quote(key)+")")).nextValue();
        assertTrue("actual original session Storage string missing",original instanceof String);
        return ((String)original).getBytes(StandardCharsets.UTF_8);
    }

    private static JSONObject awaitUnitHeldWriterOutcome(ActivityScenario<BridgeSmokeActivity> scenario)throws Exception{
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        do{
            String callback=evaluate(scenario,"globalThis.__unitHeldWriterOutcomeV7===null?null:JSON.stringify(globalThis.__unitHeldWriterOutcomeV7)");
            Object result=new JSONTokener(callback).nextValue();
            if(result!=JSONObject.NULL){assertTrue("actual queued callback shape",result instanceof String);return new JSONObject((String)result);}
            Thread.sleep(25);
        }while(System.nanoTime()<deadline);
        throw new AssertionError("actual queued public writer callback unavailable; no refusal proof");
    }

    static void loadNormalCustodialApplication(ActivityScenario<BridgeSmokeActivity> scenario,Bridge bridge,WebView view)throws Exception{
        loadNormalCustodialApplication(scenario,bridge,view,false);
    }
    static void loadNormalCustodialApplication(ActivityScenario<BridgeSmokeActivity> scenario,Bridge bridge,WebView view,
        boolean sourceAttachedBeforeFirstNavigation)throws Exception{
        final String entry="https://localhost/app-shell.html";
        android.util.Log.i("CustodialOriginalRuntime","Observing normal packaged app startup before capture");
        // BridgeActivity has ALREADY started its normal appUrl navigation in
        // onCreate. Settle that real initial navigation before requesting the
        // document-start Source-owned load; do not overlap two native loads.
        // Both setup phases share the SAME original 20s budget. This native
        // URL/progress observation grants no Source or capture authority.
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(20);
        ProtectedRecoveryEntryAndroidRuntimeTest.observeProcessForNativeStartup("NORMAL_APP_SETUP_AFTER_ACTIVITY");
        AtomicReference<String> initialUrl=new AtomicReference<>();
        java.util.concurrent.atomic.AtomicInteger initialProgress=new java.util.concurrent.atomic.AtomicInteger();
        String settledUrl=null;int settledTurns=0;
        do{
            scenario.onActivity(activity->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
                initialUrl.set(view.getUrl());initialProgress.set(view.getProgress());
            });
            String actual=initialUrl.get();android.net.Uri uri=actual==null?null:android.net.Uri.parse(actual);
            boolean fixed=uri!=null&&"https".equals(uri.getScheme())&&"localhost".equals(uri.getHost())
                &&uri.getPort()==-1&&uri.getUserInfo()==null&&uri.getFragment()==null
                &&("/app-shell.html".equals(uri.getPath())||"/index.html".equals(uri.getPath()));
            if(fixed&&initialProgress.get()==100){
                settledTurns=actual.equals(settledUrl)?settledTurns+1:1;settledUrl=actual;
                if(settledTurns>=2)break;
            }else{settledUrl=null;settledTurns=0;}
            Thread.sleep(25);
        }while(System.nanoTime()<deadline);
        assertTrue("Original automatic navigation did not settle within startup budget: url="+initialUrl.get()
            +"; progress="+initialProgress.get(),settledTurns>=2&&System.nanoTime()<deadline);
        android.util.Log.i("CustodialOriginalRuntime","Initial automatic app navigation settled: "+settledUrl);
        if(!sourceAttachedBeforeFirstNavigation)scenario.onActivity(activity->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
                assertEquals("The generated test profile must use the normal fixed app entry",entry,bridge.getAppUrl());
                view.loadUrl(entry);
            });
        // This is initial full-application setup, not the old tiny smoke
        // page, protected capture lifetime, recovery reload or work clock.
        // The failed run showed host cleanup while Home scripts were still
        // loading; a five-second smoke window is not a full-app startup
        // observation. Keep setup bounded inside
        // the unchanged 60-second test; no capture/control deadline changes.
        AtomicReference<String> nativeUrl=new AtomicReference<>();JSONObject last=null;
        do{
            scenario.onActivity(activity->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());nativeUrl.set(view.getUrl());
            });
            Object callback=new JSONTokener(evaluate(scenario,
                "JSON.stringify({href:location.href,origin:location.origin,state:document.readyState,body:!!document.body,"
                    +"security:typeof globalThis.MemphisCustodialSecurity==='object'"
                    +"&&globalThis.MemphisCustodialSecurity?.native===true"
                    +"&&typeof globalThis.MemphisCustodialSecurity?.getStatus==='function',"
                    +"facade:(()=>{const p=Object.getOwnPropertyDescriptor(globalThis,'localStorage');"
                    +"return !!p&&Object.prototype.hasOwnProperty.call(p,'value')&&!p.get&&!p.set"
                    +"&&p.configurable===false&&p.writable===false;})()})")).nextValue();
            assertTrue("Actual application callback must contain document DATA",callback instanceof String);
            last=new JSONObject((String)callback);
            String href=last.getString("href");android.net.Uri uri=android.net.Uri.parse(href);
            boolean fixedLocalDocument="https".equals(uri.getScheme())&&"localhost".equals(uri.getHost())
                &&uri.getPort()==-1&&uri.getUserInfo()==null&&uri.getFragment()==null
                &&("/index.html".equals(uri.getPath())||!sourceAttachedBeforeFirstNavigation&&"/app-shell.html".equals(uri.getPath()));
            if(href.equals(nativeUrl.get())&&fixedLocalDocument&&"https://localhost".equals(last.getString("origin"))
                &&"complete".equals(last.getString("state"))&&last.getBoolean("body")
                &&last.getBoolean("security")&&last.getBoolean("facade")){
                android.util.Log.i("CustodialOriginalRuntime","Actual normal app and public Storage facade observed before capture");
                if(sourceAttachedBeforeFirstNavigation)BridgeSmokeActivity.observeOriginalSourceLifecycle();
                return;
            }
            Thread.sleep(25);
        }while(System.nanoTime()<deadline);
        String unavailable="Normal Custodial app/firewall unavailable: native="+nativeUrl.get()+"; document="+last;
        android.util.Log.e("CustodialOriginalRuntime",unavailable);
        throw new AssertionError(unavailable);
    }

    private static byte[] readUnitLocalData(ActivityScenario<BridgeSmokeActivity> scenario,String key)throws Exception{
        // Only unwrap Android evaluateJavascript's real callback envelope.
        Object original=new JSONTokener(evaluate(scenario,"localStorage.getItem("+JSONObject.quote(key)+")")).nextValue();
        assertTrue("actual original Storage string missing",original instanceof String);
        return ((String)original).getBytes(StandardCharsets.UTF_8);
    }
    private static String unitStorageStringDigest(String original)throws Exception{
        // Fixed Storage-string transcript used by the binary reader's Sink:
        // quoted JSON code units, UTF-16BE without BOM; NOT a fake frame/reply.
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(JSONObject.quote(original).getBytes(StandardCharsets.UTF_16BE));
        StringBuilder hex=new StringBuilder();for(byte b:digest)hex.append(String.format(Locale.ROOT,"%02x",b&255));
        return hex.toString();
    }

    private static VaultFailure noVaultAdmission(){return new VaultFailure("instrumentation_browser_lifecycle_has_no_vault_admission");}
    private static Map<String,Map<String,?>> stores(Context context){
        Map<String,Map<String,?>> rows=new TreeMap<>();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
            rows.put(name,new HashMap<>(context.getSharedPreferences(name,Context.MODE_PRIVATE).getAll()));
        return rows; // Read-only comparison, not a complete inventory/fence.
    }
    private static void requireShippingBootstrapAssets(Context context)throws Exception{
        // attach itself validates edition/build metadata/exact script digest.
        // Missing packaged assets are a prerequisite failure, NEVER skip/PASS.
        for(String name:new String[]{"public/build.json","public/memphis-custodial-original-browser.js"})
            try(var input=context.getAssets().open(name)){assertTrue("missing/empty shipping asset: "+name,input.read()!=-1);}
    }
    private static void loadExistingPackagedPage(ActivityScenario<BridgeSmokeActivity> scenario,Bridge bridge,WebView view,String page)throws Exception{
        // Capacitor's listener drops the failing request URL/main-frame bit
        // and can report a cancelled earlier navigation or a missing icon.
        // Neither that unscoped error nor callback ordering proves which
        // document loaded. Read the SAME actual view and selected document;
        // an error page, alternate URL or missing packaged body cannot pass.
        scenario.onActivity(activity->{
            assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());view.loadUrl(page);
        });
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        AtomicReference<String> nativeUrl=new AtomicReference<>();JSONObject last=null;
        do{
            scenario.onActivity(activity->{
                assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());nativeUrl.set(view.getUrl());
            });
            Object callback=new JSONTokener(evaluate(scenario,
                "JSON.stringify({href:location.href,origin:location.origin,state:document.readyState,"
                    +"text:document.getElementById('ready')?.textContent||''})")).nextValue();
            assertTrue("actual page callback must contain document DATA",callback instanceof String);
            last=new JSONObject((String)callback);
            if(page.equals(nativeUrl.get())&&page.equals(last.getString("href"))
                &&"https://localhost".equals(last.getString("origin"))
                &&"complete".equals(last.getString("state"))&&"ready".equals(last.getString("text")))return;
            Thread.sleep(25);
        }while(System.nanoTime()<deadline);
        throw new AssertionError("Selected packaged document unavailable: native="+nativeUrl.get()+"; document="+last);
    }
    private static String evaluate(ActivityScenario<BridgeSmokeActivity> scenario,String expression)throws Exception{
        CountDownLatch completed=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->activity.getBridge().getWebView().evaluateJavascript(expression,value->{result.set(value);completed.countDown();}));
        assertTrue("actual WebView callback unavailable",completed.await(5,TimeUnit.SECONDS));assertNotNull(result.get());return result.get();
    }

    /** Actual App intent delivery and Android Back input; no capture/auth grant. */
    @Test(timeout=60000)
    public void actualNormalShellHardwareBackPopsDetailAndKeepsCustodialRoot()throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context context=instrumentation.getTargetContext();
        assertTrue("isolated target only",context.getPackageName().endsWith(".test"));
        assertEquals(context.getApplicationInfo().uid,android.os.Process.myUid());
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue("never clear/enroll an existing vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originals=stores(context);
        var calls=new java.util.concurrent.atomic.AtomicInteger();
        // Existing no-admission Engine seam. Every transport attempt, including
        // a failed confirm, is counted and DENIED; no fixture credential issued.
        EnrollmentTransport transport=new EnrollmentTransport(){
            public EnrollmentResult enroll(EnrollmentRequest r,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult confirm(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult remove(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public ActiveCredentialStatus verifyActiveCredential(String d,String i,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public String reportAssignedActivation(String o,String d,char[] c,Map<String,Object> r)throws VaultFailure{throw noBackTransport(calls);}
            public NativeLegacyLineageJournal.Binding resolveLegacyLineage(NativeLegacyLineageJournal.Context c,char[] k)throws VaultFailure{throw noBackTransport(calls);}
            public NativeLegacyLineageJournal.Terminal reportLegacyActivation(NativeLegacyLineageJournal.Context c,
                NativeLegacyLineageJournal.Binding b,JSONObject r,char[] k)throws VaultFailure{throw noBackTransport(calls);}
        };
        VaultClock clock=System::currentTimeMillis;
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        CustodialNativeVaultPlugin plugin=new CustodialNativeVaultPlugin(engine,
            new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
        final String shell="https://localhost/app-shell.html?shell=stay";
        var component=new android.content.ComponentName(context,BridgeSmokeActivity.class);
        var monitor=androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance();
        var owned=new AtomicReference<BridgeSmokeActivity>();
        var bridge=new AtomicReference<Bridge>();var view=new AtomicReference<WebView>();
        var created=new java.util.concurrent.CopyOnWriteArrayList<BridgeSmokeActivity>();
        var trackForeground=new java.util.concurrent.atomic.AtomicBoolean();
        var foregroundLoss=new java.util.concurrent.atomic.AtomicInteger();
        var documentStarts=new java.util.concurrent.atomic.AtomicInteger();
        androidx.test.runner.lifecycle.ActivityLifecycleCallback lifecycle=(activity,stage)->{
            if(!(activity instanceof BridgeSmokeActivity)||!component.equals(activity.getComponentName()))return;
            var actual=(BridgeSmokeActivity)activity;if(!created.contains(actual))created.add(actual);
            if(trackForeground.get()&&actual==owned.get()
                &&(stage==androidx.test.runner.lifecycle.Stage.PAUSED||stage==androidx.test.runner.lifecycle.Stage.STOPPED
                    ||stage==androidx.test.runner.lifecycle.Stage.DESTROYED))foregroundLoss.incrementAndGet();
        };
        com.getcapacitor.WebViewListener documentObserver=new com.getcapacitor.WebViewListener(){
            @Override public void onPageStarted(WebView actual){if(actual==view.get())documentStarts.incrementAndGet();}
        };
        Throwable primary=null;boolean monitorAttempted=false,pluginInstalled=false;
        try{
            monitorAttempted=true;
            instrumentation.runOnMainSync(()->{
                for(var stage:androidx.test.runner.lifecycle.Stage.values()){
                    if(stage==androidx.test.runner.lifecycle.Stage.DESTROYED)continue;
                    for(var existing:monitor.getActivitiesInStage(stage))
                        assertFalse("never reuse another test Activity",existing instanceof BridgeSmokeActivity);
                }
                monitor.addLifecycleCallback(lifecycle);
            });
            pluginInstalled=true;BridgeSmokeActivity.install(plugin);
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                Throwable operationFailure=null;
                try{
                    scenario.onActivity(activity->{
                        owned.set(activity);bridge.set(activity.getBridge());assertNotNull(bridge.get());
                        view.set(bridge.get().getWebView());assertNotNull(view.get());
                        assertEquals("normal full-app profile required","https://localhost/app-shell.html",bridge.get().getAppUrl());
                        bridge.get().addWebViewListener(documentObserver);
                    });
                    JSONObject build=normalBackBuild(context);
                    long startupDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(20);
                    scenario.onActivity(activity->{assertSame(owned.get(),activity);view.get().loadUrl(shell);});
                    JSONObject home=awaitNormalBackRoute(scenario,owned.get(),bridge.get(),view.get(),
                        shell,"Home",build.getString("build_id"),null,startupDeadline);
                    String document=home.getString("time_origin");int starts=documentStarts.get();
                    String storageBefore=evaluate(scenario,normalBackStorageRead());
                    assertTrue("startup changed native originals",originals.equals(stores(context)));
                    assertEquals("no transport, including confirm/authorized completion",0,calls.get());
                    // One Android-delivered, explicit-component test-UID input.
                    // URL hash does NOT drive native MemoryRouter; no private callback.
                    scenario.onActivity(activity->{
                        assertSame(owned.get(),activity);assertTrue(activity.hasWindowFocus());
                        assertEquals(androidx.test.runner.lifecycle.Stage.RESUMED,monitor.getLifecycleStageOf(activity));
                        var intent=new android.content.Intent(android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse("memphiszoo-custodial://route/custodial.schedule"));
                        intent.setComponent(component);intent.addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        assertNull(intent.getSelector());assertNull(intent.getClipData());assertNull(intent.getExtras());
                        activity.startActivity(intent);
                    });
                    awaitNormalBackRoute(scenario,owned.get(),bridge.get(),view.get(),shell,"Schedule",
                        build.getString("build_id"),document,System.nanoTime()+TimeUnit.SECONDS.toNanos(5));
                    assertEquals("SINGLE_TOP must retain the original Activity",1,created.size());
                    assertSame(owned.get(),created.get(0));assertEquals(starts,documentStarts.get());
                    assertTrue("intent changed local/session originals",storageBefore.equals(evaluate(scenario,normalBackStorageRead())));
                    assertTrue("intent changed native originals",originals.equals(stores(context)));
                    trackForeground.set(true);
                    assertNotSame(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                    instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
                    awaitNormalBackRoute(scenario,owned.get(),bridge.get(),view.get(),shell,"Home",
                        build.getString("build_id"),document,System.nanoTime()+TimeUnit.SECONDS.toNanos(5));
                    assertEquals("detail Back left the foreground app",0,foregroundLoss.get());
                    assertEquals(starts,documentStarts.get());assertEquals(1,created.size());
                    assertTrue("detail Back changed Storage originals",storageBefore.equals(evaluate(scenario,normalBackStorageRead())));
                    assertTrue("detail Back changed native originals",originals.equals(stores(context)));
                    instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
                    // Observe the actual delivered root event without retrying it.
                    long rootDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(1);
                    do{
                        // The observation horizon is not this IPC's resource
                        // deadline: a final sample may start near the horizon.
                        JSONObject current=readNormalBackDocument(scenario,owned.get(),bridge.get(),view.get(),
                            System.nanoTime()+TimeUnit.SECONDS.toNanos(5),false);
                        requireNormalBackRoute(current,shell,"Home",build.getString("build_id"),document);
                        assertEquals("Custodial root Back minimized/retired the owned app",0,foregroundLoss.get());
                        assertEquals(1,created.size());assertEquals(starts,documentStarts.get());
                        long remaining=rootDeadline-System.nanoTime();
                        if(remaining>0)TimeUnit.NANOSECONDS.sleep(Math.min(remaining,TimeUnit.MILLISECONDS.toNanos(25)));
                    }while(System.nanoTime()<rootDeadline);
                    assertTrue("root Back changed Storage originals",storageBefore.equals(evaluate(scenario,normalBackStorageRead())));
                    assertTrue("root Back changed native originals",originals.equals(stores(context)));
                    requireNormalBackRoute(readNormalBackDocument(scenario,owned.get(),bridge.get(),view.get(),
                        System.nanoTime()+TimeUnit.SECONDS.toNanos(5),false),shell,"Home",build.getString("build_id"),document);
                    assertEquals(0,foregroundLoss.get());assertEquals(1,created.size());assertEquals(starts,documentStarts.get());
                    assertEquals(0,calls.get());
                }catch(Exception|Error failure){operationFailure=failure;throw failure;}
                finally{
                    trackForeground.set(false);
                    try{if(bridge.get()!=null)instrumentation.runOnMainSync(()->bridge.get().removeWebViewListener(documentObserver));}
                    catch(RuntimeException|Error cleanup){if(operationFailure!=null)operationFailure.addSuppressed(cleanup);else throw cleanup;}
                }
            }
        }catch(Exception|Error failure){primary=failure;throw failure;}
        finally{
            Throwable cleanupFailure=null;trackForeground.set(false);
            try{
                // Only instances observed after this test's launch are owned.
                instrumentation.runOnMainSync(()->{for(var activity:created)
                    if(!activity.isDestroyed()&&!activity.isFinishing())activity.finish();});
                long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
                var retired=new java.util.concurrent.atomic.AtomicBoolean();
                do{
                    instrumentation.runOnMainSync(()->retired.set(created.stream().allMatch(android.app.Activity::isDestroyed)));
                    if(!retired.get())Thread.sleep(25);
                }while(!retired.get()&&System.nanoTime()<deadline);
                assertTrue("owned Activity cleanup incomplete",retired.get());
            }catch(Exception|Error cleanup){cleanupFailure=cleanup;}
            try{
                if(monitorAttempted)instrumentation.runOnMainSync(()->monitor.removeLifecycleCallback(lifecycle));
                assertTrue("native originals changed after teardown",originals.equals(stores(context)));
                assertEquals("no transport method may run",0,calls.get());
            }catch(Exception|Error cleanup){if(cleanupFailure==null)cleanupFailure=cleanup;else cleanupFailure.addSuppressed(cleanup);}
            if(pluginInstalled)BridgeSmokeActivity.install(null);
            if(cleanupFailure!=null){if(primary!=null)primary.addSuppressed(cleanupFailure);
                else if(cleanupFailure instanceof Exception)throw (Exception)cleanupFailure;else throw (Error)cleanupFailure;}
        }
    }

    private static VaultFailure noBackTransport(java.util.concurrent.atomic.AtomicInteger calls){
        calls.incrementAndGet();return noVaultAdmission();
    }

    private static JSONObject normalBackBuild(Context context)throws Exception{
        requireShippingBootstrapAssets(context);
        JSONObject build;
        try(var input=context.getAssets().open("public/build.json")){
            build=new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));
        }
        assertEquals("custodial",build.getString("edition"));assertTrue(build.getBoolean("source_commit_exact"));
        assertTrue(build.getString("source_commit").matches("[0-9a-f]{40}"));
        assertTrue(build.getString("source_tree").matches("[0-9a-f]{40}"));
        assertFalse(build.getString("build_id").isBlank());
        var bootstrap=build.getJSONObject("native_original_browser_bootstrap");
        assertEquals("custodial.native-original-browser-bootstrap-asset.v1",bootstrap.getString("schema"));
        assertEquals("memphis-custodial-original-browser.js",bootstrap.getString("asset"));
        try(var input=context.getAssets().open("public/memphis-custodial-original-browser.js")){
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(input.readAllBytes());
            StringBuilder text=new StringBuilder();for(byte b:digest)text.append(String.format(Locale.ROOT,"%02x",b&255));
            String hash=text.toString();
            assertEquals("48f017980abc524656e18249b733a2beff4e14ed0607190d3f874705df6c3ac5",hash);
            assertEquals(hash,bootstrap.getString("sha256"));
        }
        return build;
    }

    private static String normalBackStorageRead(){
        return "JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),"
            +"Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])";
    }

    private static JSONObject readNormalBackDocument(ActivityScenario<BridgeSmokeActivity> scenario,BridgeSmokeActivity owned,
        Bridge bridge,WebView view,long deadline,boolean startup)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> callback=new AtomicReference<>(),nativeUrl=new AtomicReference<>();
        var foreground=new java.util.concurrent.atomic.AtomicBoolean();
        scenario.onActivity(activity->{
            assertSame("Activity replaced",owned,activity);assertSame(bridge,activity.getBridge());assertSame(view,bridge.getWebView());
            assertEquals(android.os.Process.myUid(),activity.getApplicationInfo().uid);
            assertEquals(InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName(),activity.getPackageName());
            foreground.set(!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus()
                &&androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(activity)
                    ==androidx.test.runner.lifecycle.Stage.RESUMED);
            nativeUrl.set(view.getUrl());
            view.evaluateJavascript("JSON.stringify({href:location.href,origin:location.origin,state:document.readyState,"
                +"time_origin:String(performance.timeOrigin),title:document.title,"
                +"role:document.querySelector('.shellFrame')?.getAttribute('data-role-marker'),"
                +"edition:document.querySelector('.shellFrame')?.getAttribute('data-edition'),"
                +"route:document.getElementById('route-title')?.textContent,"
                +"back:document.querySelectorAll('.shellBack').length,fatal:!!document.querySelector('.shellFatal'),"
                +"facts:Object.fromEntries(Array.from(document.querySelectorAll('.shellFacts>div')).map(e=>[e.querySelector('dt')?.textContent,e.querySelector('dd')?.textContent])),"
                +"native:globalThis.Capacitor?.isNativePlatform?.()===true,platform:globalThis.Capacitor?.getPlatform?.(),"
                +"app:globalThis.Capacitor?.isPluginAvailable?.('App')===true&&typeof globalThis.Capacitor?.Plugins?.App?.addListener==='function',"
                +"network:globalThis.Capacitor?.isPluginAvailable?.('Network')===true&&typeof globalThis.Capacitor?.Plugins?.Network?.getStatus==='function',"
                +"storage:location.origin==='https://localhost'&&typeof localStorage.getItem==='function'&&typeof sessionStorage.getItem==='function'})",
                result->{callback.set(result);done.countDown();});
        });
        long remaining=deadline-System.nanoTime();
        assertTrue("normal shell callback deadline exceeded",remaining>0&&done.await(remaining,TimeUnit.NANOSECONDS));
        assertNotNull("normal shell callback missing",callback.get());
        Object data=new JSONTokener(callback.get()).nextValue();
        // Navigation may replace the initial blank document before its callback.
        // No DATA is not readiness; only initial setup may keep observing it.
        if(startup&&data==JSONObject.NULL)return null;
        assertTrue("actual document DATA required",data instanceof String);
        JSONObject result=new JSONObject((String)data);result.put("native_url",nativeUrl.get());result.put("foreground",foreground.get());
        return result;
    }

    private static JSONObject awaitNormalBackRoute(ActivityScenario<BridgeSmokeActivity> scenario,BridgeSmokeActivity owned,
        Bridge bridge,WebView view,String shell,String route,String build,String document,long deadline)throws Exception{
        JSONObject last=null;
        do{
            last=readNormalBackDocument(scenario,owned,bridge,view,deadline,document==null);
            if(last==null){
                long remaining=deadline-System.nanoTime();
                if(remaining>0)TimeUnit.NANOSECONDS.sleep(Math.min(remaining,TimeUnit.MILLISECONDS.toNanos(25)));
                continue;
            }
            assertFalse("existing ShellErrorBoundary refused normal setup",last.getBoolean("fatal"));
            if(route.equals(last.optString("route"))&&last.optBoolean("foreground")&&"complete".equals(last.optString("state"))
                &&build.equals(last.optJSONObject("facts")==null?null:last.getJSONObject("facts").optString("Build"))){
                requireNormalBackRoute(last,shell,route,build,document);
                // Normal compositor observation, NOT a Back-listener-ready flag.
                CountDownLatch visible=new CountDownLatch(1);
                scenario.onActivity(activity->{
                    assertSame(owned,activity);assertSame(view,activity.getBridge().getWebView());
                    view.postVisualStateCallback(18L,new WebView.VisualStateCallback(){
                        @Override public void onComplete(long request){visible.countDown();}
                    });
                });
                long remaining=deadline-System.nanoTime();
                assertTrue("normal shell visual state deadline exceeded",remaining>0&&visible.await(remaining,TimeUnit.NANOSECONDS));
                return last;
            }
            long remaining=deadline-System.nanoTime();
            if(remaining>0)TimeUnit.NANOSECONDS.sleep(Math.min(remaining,TimeUnit.MILLISECONDS.toNanos(25)));
        }while(System.nanoTime()<deadline);
        throw new AssertionError("normal shell route/foreground/build unavailable: "+route);
    }

    private static void requireNormalBackRoute(JSONObject actual,String shell,String route,String build,String document)throws Exception{
        assertEquals(shell,actual.getString("href"));assertEquals(shell,actual.getString("native_url"));
        assertEquals("https://localhost",actual.getString("origin"));assertEquals("complete",actual.getString("state"));
        assertTrue(actual.getBoolean("foreground"));assertFalse(actual.getBoolean("fatal"));
        assertEquals("Memphis Zoo Custodial",actual.getString("title"));
        assertEquals("MZ_ROLE_CUSTODIAL_ONLY",actual.getString("role"));assertEquals("custodial",actual.getString("edition"));
        assertEquals(route,actual.getString("route"));assertEquals("Home".equals(route)?0:1,actual.getInt("back"));
        assertTrue(actual.getBoolean("native"));assertEquals("android",actual.getString("platform"));
        assertTrue("real installed App missing",actual.getBoolean("app"));assertTrue("real installed Network missing",actual.getBoolean("network"));
        assertTrue("actual public Storage missing",actual.getBoolean("storage"));
        assertEquals(build,actual.getJSONObject("facts").getString("Build"));
        String access=actual.getJSONObject("facts").getString("Access");
        assertTrue("empty fixture cannot grant authenticated/enrolled access",java.util.Set.of(
            "unknown","unenrolled","unavailable","quarantined").contains(access));
        assertTrue("actual document time origin missing",actual.getString("time_origin").matches("[0-9]+(?:\\.[0-9]+)?"));
        if(document!=null)assertEquals("document replaced",document,actual.getString("time_origin"));
    }

    /** One captured hold, then genuine Activity/Bridge/WebView retirement and
     * a fresh normal host in the SAME UID. No sessionStorage durability claim. */
    @Test(timeout=60000)
    public void actualPersistedOriginalHoldRefusesWriterInFreshActivity()throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context context=instrumentation.getTargetContext();
        assertTrue("isolated target only",context.getPackageName().endsWith(".test"));
        assertEquals(context.getApplicationInfo().uid,android.os.Process.myUid());
        assertTrue("managed emulator prerequisite",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
        assertTrue("never clear an enrolled vault",context.getSharedPreferences(
            "MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE).getAll().isEmpty());
        Map<String,Map<String,?>> originals=stores(context);
        var transportCalls=new java.util.concurrent.atomic.AtomicInteger();
        var firstActivity=new AtomicReference<BridgeSmokeActivity>();
        var firstBridge=new AtomicReference<Bridge>();var firstView=new AtomicReference<WebView>();
        var secondActivity=new AtomicReference<BridgeSmokeActivity>();
        var secondBridge=new AtomicReference<Bridge>();var secondView=new AtomicReference<WebView>();
        var source=new AtomicReference<NativeOriginalBrowserPreparation>();
        var detached=new java.util.concurrent.atomic.AtomicBoolean();
        android.view.View.OnAttachStateChangeListener detachObserver=new android.view.View.OnAttachStateChangeListener(){
            public void onViewAttachedToWindow(android.view.View actual){}
            public void onViewDetachedFromWindow(android.view.View actual){if(actual==firstView.get())detached.set(true);}
        };
        final String key="unit-held-fresh-activity-not-authority";
        final String value="UNIT original across Activity retirement; 9007199254740993; euro=\u20ac";
        final byte[] utf8=value.getBytes(StandardCharsets.UTF_8);
        final String holdRead="localStorage.getItem('mz_custodial_protected_browser_hold.v1')";
        final String epochRead="localStorage.getItem('mz_custodial_protected_browser_mutation.v1')";
        final String localRead="JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))";
        JSONObject binding=new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64))
            .put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
        final String originalBinding=binding.toString();
        String hold,epoch;
        Throwable primary=null;boolean pluginInstalled=false;
        try{
            instrumentation.runOnMainSync(()->{
                var monitor=androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance();
                for(var stage:androidx.test.runner.lifecycle.Stage.values()){
                    if(stage==androidx.test.runner.lifecycle.Stage.DESTROYED)continue;
                    for(var existing:monitor.getActivitiesInStage(stage))
                        assertFalse("never reuse another test Activity",existing instanceof BridgeSmokeActivity);
                }
            });
            CustodialNativeVaultPlugin firstPlugin=freshHeldActivityPlugin(context,transportCalls);
            pluginInstalled=true;BridgeSmokeActivity.install(firstPlugin);
            try(ActivityScenario<BridgeSmokeActivity> first=ActivityScenario.launch(BridgeSmokeActivity.class);
                NativePrivateCustodyFrameReadControl control=new NativePrivateCustodyFrameReadControl()){
                Throwable firstFailure=null;
                try{
                    first.onActivity(activity->{
                        firstActivity.set(activity);firstBridge.set(activity.getBridge());assertNotNull(firstBridge.get());
                        WebView web=firstBridge.get().getWebView();assertNotNull(web);firstView.set(web);
                        web.addOnAttachStateChangeListener(detachObserver);
                        requireHeldActivityIdentity(activity);
                        try{
                            requireShippingBootstrapAssets(activity);
                            web.getSettings().setSupportMultipleWindows(false);
                            web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                            source.set(NativeOriginalBrowserPreparation.attach(activity,firstBridge.get()));
                            source.get().requireAttachedView(web);
                        }catch(Exception unavailable){throw new AssertionError("original Source attach unavailable; no substitute",unavailable);}
                    });
                    loadNormalCustodialApplication(first,firstBridge.get(),firstView.get());
                    requireFreshHeldHome(first,firstActivity.get(),firstBridge.get(),firstView.get(),false);
                    normalBackBuild(context);
                    assertEquals("null",evaluate(first,holdRead));
                    assertEquals("null",evaluate(first,"localStorage.getItem("+JSONObject.quote(key)+")"));
                    assertEquals("true",evaluate(first,"(()=>{localStorage.setItem("+JSONObject.quote(key)+","
                        +JSONObject.quote(value)+");return localStorage.getItem("+JSONObject.quote(key)+")==="+JSONObject.quote(value)+"})()"));
                    assertArrayEquals(utf8,readUnitLocalData(first,key));
                    assertNotSame(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                    // Exactly ONE capture. Literal tuple is existing UNIT DATA,
                    // not a native original, manager credential or effect grant.
                    try(var exchange=source.get().capture(binding,control)){
                        exchange.collectOriginalValues();exchange.recheck();exchange.requireOriginalBinding(binding);
                        var records=exchange.originalRecords();
                        JSONObject metadata=exchange.originalValueMetadata(),projection=exchange.projection();
                        assertEquals(records.frameSha256,metadata.getString("frame_sha256"));
                        assertEquals(records.recordCount,metadata.getInt("record_count"));
                        assertEquals("SAME_DOCUMENT_CAPTURE_RECHECKED_NOT_ACK",projection.getString("state"));
                        int found=0;String keyHash=unitStorageStringDigest(key),bodyHash=unitStorageStringDigest(value);
                        for(var row:records.originalRecords()){
                            assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                            if("localStorage".equals(row.store)&&keyHash.equals(row.keySha256)){
                                found++;assertEquals(bodyHash,row.bodySha256);
                            }
                        }
                        assertEquals("actual seeded original collected",1,found);
                        for(String flag:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})
                            assertEquals(Boolean.FALSE,metadata.get(flag));
                        for(String flag:new String[]{"original_value_bytes_durably_retained","browser_source_authenticated",
                            "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged",
                            "work_accepted","finalizer_allowed","key_removal","phone_released"})
                            assertEquals(Boolean.FALSE,projection.get(flag));
                        for(String flag:new String[]{"native_authority","frozen","acknowledged","phone_released"})
                            assertEquals(Boolean.FALSE,projection.getJSONObject("observation").get(flag));
                        for(String flag:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory",
                            "current_server_readback","cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"})
                            assertEquals(Boolean.FALSE,projection.getJSONObject("census").get(flag));
                        hold=evaluate(first,holdRead);epoch=evaluate(first,epochRead);
                        Object raw=new JSONTokener(hold).nextValue();assertTrue("actual hold required",raw instanceof String);
                        JSONObject marker=new JSONObject((String)raw);
                        assertEquals("custodial.browser-preservation-hold.v1",marker.getString("schema"));
                        assertEquals(binding.getString("operation_id"),marker.getString("operation_id"));
                        assertEquals(Boolean.FALSE,marker.get("native_authority"));
                        Object rawEpoch=new JSONTokener(epoch).nextValue();
                        assertTrue("actual persisted epoch required",rawEpoch instanceof String);
                        assertTrue(((String)rawEpoch).matches("[1-9][0-9]{0,18}"));
                    }
                    control.close();
                    first.onActivity(activity->source.get().close());
                    requireRetiredHeldSource(source.get(),firstView.get());
                    assertEquals(hold,evaluate(first,holdRead));assertEquals(epoch,evaluate(first,epochRead));
                    assertArrayEquals(utf8,readUnitLocalData(first,key));
                    assertTrue("native originals changed before retirement",originals.equals(stores(context)));
                    assertEquals(0,transportCalls.get());
                }catch(Exception|Error failure){firstFailure=failure;throw failure;}
                finally{
                    try{if(source.get()!=null)instrumentation.runOnMainSync(()->source.get().close());}
                    catch(RuntimeException|Error cleanup){if(firstFailure!=null)firstFailure.addSuppressed(cleanup);else throw cleanup;}
                }
            }
            // ActivityScenario.close drives the normal Bridge onDestroy and
            // window-detach path (which destroys its WebView). Do NOT invoke
            // bridge/view.destroy or scenario.recreate as a substitute.
            awaitHeldActivityDestroyed(firstActivity.get(),firstView.get(),detached);
            requireRetiredHeldSource(source.get(),firstView.get());
            assertTrue("native originals changed during destruction",originals.equals(stores(context)));
            // onDestroy clears BridgeSmokeActivity's fixture plugin. Construct
            // a NEW rejection-only Engine/plugin; never rearm original Source.
            CustodialNativeVaultPlugin secondPlugin=freshHeldActivityPlugin(context,transportCalls);
            assertNotSame(firstPlugin,secondPlugin);BridgeSmokeActivity.install(secondPlugin);
            try(ActivityScenario<BridgeSmokeActivity> second=ActivityScenario.launch(BridgeSmokeActivity.class)){
                second.onActivity(activity->{
                    secondActivity.set(activity);secondBridge.set(activity.getBridge());assertNotNull(secondBridge.get());
                    secondView.set(secondBridge.get().getWebView());assertNotNull(secondView.get());
                    assertNotSame(firstActivity.get(),activity);assertNotSame(firstBridge.get(),secondBridge.get());
                    assertNotSame(firstView.get(),secondView.get());requireHeldActivityIdentity(activity);
                });
                // Existing fixed normal full-app/Home loader only; never a
                // second Source attach, capture, control, marker or epoch seed.
                loadNormalCustodialApplication(second,secondBridge.get(),secondView.get());
                requireFreshHeldHome(second,secondActivity.get(),secondBridge.get(),secondView.get(),true);
                normalBackBuild(context);
                requireRetiredHeldSource(source.get(),secondView.get());
                assertEquals("original tuple DATA must not change",originalBinding,binding.toString());
                // Hold format stores operation_id, NOT generation authority.
                // Its entire original bytes and epoch must remain unchanged.
                assertEquals(hold,evaluate(second,holdRead));assertEquals(epoch,evaluate(second,epochRead));
                assertArrayEquals(utf8,readUnitLocalData(second,key));
                assertTrue("fresh host changed native originals",originals.equals(stores(context)));
                assertEquals(0,transportCalls.get());
                String beforeWrite=evaluate(second,localRead);
                String queuedWriter="""
                    (()=>{
                      if(Object.prototype.hasOwnProperty.call(globalThis,'__unitHeldWriterOutcomeV7'))throw Error('stale UNIT callback');
                      Object.defineProperty(globalThis,'__unitHeldWriterOutcomeV7',{value:null,writable:true,configurable:false});
                      setTimeout(()=>{
                        try{localStorage.setItem(__KEY_JSON__,'UNIT forbidden fresh-Activity replacement');
                          globalThis.__unitHeldWriterOutcomeV7={outcome:'WRITE_SUCCEEDED'};}
                        catch(error){globalThis.__unitHeldWriterOutcomeV7={name:error?.name,code:error?.code,key:error?.key};}
                      },0);
                      return true;
                    })()
                    """.replace("__KEY_JSON__",JSONObject.quote(key));
                assertEquals("true",evaluate(second,queuedWriter));
                JSONObject refused=awaitUnitHeldWriterOutcome(second);
                assertFalse("fresh host mutation returned",refused.has("outcome"));
                assertEquals("CustodialProtectedStateMutationError",refused.getString("name"));
                assertEquals("custodial_protected_state_read_only",refused.getString("code"));
                assertEquals(key,refused.getString("key"));
                assertEquals(beforeWrite,evaluate(second,localRead));
                assertArrayEquals(utf8,readUnitLocalData(second,key));
                assertEquals(hold,evaluate(second,holdRead));assertEquals(epoch,evaluate(second,epochRead));
                requireRetiredHeldSource(source.get(),secondView.get());
                assertTrue("refused writer changed native originals",originals.equals(stores(context)));
                assertEquals(0,transportCalls.get());
            }
            awaitHeldActivityDestroyed(secondActivity.get(),secondView.get(),null);
        }catch(Exception|Error failure){primary=failure;throw failure;}
        finally{
            Throwable cleanupFailure=null;
            try{if(source.get()!=null)instrumentation.runOnMainSync(()->source.get().close());}
            catch(RuntimeException|Error cleanup){cleanupFailure=cleanup;}
            try{
                if(firstActivity.get()!=null&&firstView.get()!=null)
                    awaitHeldActivityDestroyed(firstActivity.get(),firstView.get(),detached);
                if(secondActivity.get()!=null&&secondView.get()!=null)
                    awaitHeldActivityDestroyed(secondActivity.get(),secondView.get(),null);
            }catch(Exception|Error cleanup){if(cleanupFailure==null)cleanupFailure=cleanup;else cleanupFailure.addSuppressed(cleanup);}
            try{if(firstView.get()!=null)instrumentation.runOnMainSync(()->firstView.get().removeOnAttachStateChangeListener(detachObserver));}
            catch(RuntimeException|Error cleanup){if(cleanupFailure==null)cleanupFailure=cleanup;else cleanupFailure.addSuppressed(cleanup);}
            if(pluginInstalled)BridgeSmokeActivity.install(null);
            try{
                assertTrue("native originals changed after own teardown",originals.equals(stores(context)));
                assertEquals("no enrollment/auth/transport effect allowed",0,transportCalls.get());
            }catch(RuntimeException|Error cleanup){if(cleanupFailure==null)cleanupFailure=cleanup;else cleanupFailure.addSuppressed(cleanup);}
            if(cleanupFailure!=null){if(primary!=null)primary.addSuppressed(cleanupFailure);
                else if(cleanupFailure instanceof Exception)throw (Exception)cleanupFailure;else throw (Error)cleanupFailure;}
        }
    }

    private static CustodialNativeVaultPlugin freshHeldActivityPlugin(Context context,
        java.util.concurrent.atomic.AtomicInteger calls)throws Exception{
        EnrollmentTransport transport=new EnrollmentTransport(){
            public EnrollmentResult enroll(EnrollmentRequest r,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult confirm(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public TerminalResult remove(String o,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public ActiveCredentialStatus verifyActiveCredential(String d,String i,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c)throws VaultFailure{throw noBackTransport(calls);}
            public String reportAssignedActivation(String o,String d,char[] c,Map<String,Object> r)throws VaultFailure{throw noBackTransport(calls);}
            public NativeLegacyLineageJournal.Binding resolveLegacyLineage(NativeLegacyLineageJournal.Context c,char[] k)throws VaultFailure{throw noBackTransport(calls);}
            public NativeLegacyLineageJournal.Terminal reportLegacyActivation(NativeLegacyLineageJournal.Context c,
                NativeLegacyLineageJournal.Binding b,JSONObject r,char[] k)throws VaultFailure{throw noBackTransport(calls);}
        };
        VaultClock clock=System::currentTimeMillis;
        VaultEngine engine=new VaultEngine(new SharedPreferencesVaultPersistence(context,new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),transport,new LegacyVaultSource(){
                public LegacyMaterial read()throws VaultFailure{throw noVaultAdmission();}
                public void cleanup()throws VaultFailure{throw noVaultAdmission();}
                public boolean isClean()throws VaultFailure{throw noVaultAdmission();}
            },()->{throw noVaultAdmission();},clock,()->{throw noVaultAdmission();});
        return new CustodialNativeVaultPlugin(engine,new CancellationCoordinator(engine,(operation,device)->false),
            new RemovalCoordinator(engine,(operation,device)->false));
    }

    private static void requireRetiredHeldSource(NativeOriginalBrowserPreparation source,WebView view)throws Exception{
        assertNotNull(source);assertNotNull(view);
        try{source.requireAttachedView(view);fail("retired original Source rebound to a view");}
        catch(VaultFailure denied){assertEquals(UNAVAILABLE,denied.code);}
    }

    private static void requireHeldActivityIdentity(BridgeSmokeActivity activity){
        assertEquals(android.os.Process.myUid(),activity.getApplicationInfo().uid);
        assertEquals(InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName(),activity.getPackageName());
        assertEquals(androidx.test.runner.lifecycle.Stage.RESUMED,
            androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(activity));
        assertFalse(activity.isDestroyed());assertFalse(activity.isFinishing());
    }

    private static void awaitHeldActivityDestroyed(BridgeSmokeActivity activity,WebView view,
        java.util.concurrent.atomic.AtomicBoolean detached)throws Exception{
        assertNotNull(activity);assertNotNull(view);
        var retired=new java.util.concurrent.atomic.AtomicBoolean();
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        do{
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->retired.set(activity.isDestroyed()
                &&!view.isAttachedToWindow()&&(detached==null||detached.get())
                &&androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(activity)
                    ==androidx.test.runner.lifecycle.Stage.DESTROYED));
            if(!retired.get())Thread.sleep(25);
        }while(!retired.get()&&System.nanoTime()<deadline);
        assertTrue("original host destruction/window detach not observed",retired.get());
    }

    private static void requireFreshHeldHome(ActivityScenario<BridgeSmokeActivity> scenario,BridgeSmokeActivity owned,
        Bridge bridge,WebView view,boolean sourceAbsent)throws Exception{
        scenario.onActivity(activity->{assertSame(owned,activity);assertSame(bridge,activity.getBridge());
            assertSame(view,bridge.getWebView());requireHeldActivityIdentity(activity);});
        assertEquals("true",evaluate(scenario,"location.href==='https://localhost/index.html'"
            +"&&location.origin==='https://localhost'&&document.readyState==='complete'"
            +"&&document.title==='Memphis Zoo Custodial'&&document.body?.getAttribute('data-memphis-context')==='employee'"
            +"&&!!document.getElementById('home')&&!!document.getElementById('boot')"
            +"&&globalThis.Capacitor?.isNativePlatform?.()===true&&globalThis.Capacitor?.getPlatform?.()==='android'"
            +"&&globalThis.Capacitor?.isPluginAvailable?.('App')===true&&globalThis.Capacitor?.isPluginAvailable?.('Network')===true"));
        if(sourceAbsent)assertEquals("true",evaluate(scenario,"typeof globalThis.custodialOriginalBrowserPreparation==='undefined'"));
    }
}
