package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.memphiszoo.custodial.MainActivity;

/**
 * App-level acceptance compiled only into the generated instrumentation APK.
 * The production bridge keeps plugin registration automatic while normalizing NFC entry intents.
 */
@RunWith(AndroidJUnit4.class)
public final class GeneratedCustodialNativeVaultTest {
    private static final String CUSTODIAL_PLUGIN_ID = "CustodialNativeVault";
    private static final String CUSTODIAL_PLUGIN_CLASS =
        "org.memphiszoo.custodial.vault.CustodialNativeVaultPlugin";
    private static final String OPERATION_ID = "11111111-1111-4111-8111-111111111111";
    private static final String DEVICE_ID = "KIOSK_02";
    private static final String CREDENTIAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    private static final String CREDENTIAL = CREDENTIAL_ID + ".generated-app-test-device-credential-0001";
    private Context context;

    @Before
    public void setUp() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        clearRuntimeVault();
    }

    @After
    public void tearDown() throws Exception {
        clearRuntimeVault();
    }

    @Test
    public void cleanGeneratedMainActivityAutoRegistersAndExecutesVaultJavaScriptBoundary() throws Exception {
        assertGeneratedPluginManifestAsset();
        ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
        try {
            AtomicReference<MainActivity> activity = new AtomicReference<>();
            AtomicReference<CustodialNativeVaultPlugin> plugin = new AtomicReference<>();
            scenario.onActivity(value -> {
                activity.set(value);
                assertSame(BridgeActivity.class, MainActivity.class.getSuperclass());
                Set<String> methods = new HashSet<>();
                for (Method method : MainActivity.class.getDeclaredMethods()) methods.add(method.getName());
                assertEquals(
                    new HashSet<>(Arrays.asList("recordPhysicalNfcHandoff", "dispatchPhysicalNfcUrlFromReader", "readPhysicalNfcUrl", "normalizeExternalIntent", "onCreate", "onNewIntent", "onResume", "onPause", "onTagDiscovered")),
                    methods
                );
                PluginHandle handle = value.getBridge().getPlugin(CUSTODIAL_PLUGIN_ID);
                assertNotNull("Generated Capacitor bridge did not auto-register the native vault", handle);
                assertEquals(CUSTODIAL_PLUGIN_ID, handle.getId());
                assertEquals(CUSTODIAL_PLUGIN_CLASS, handle.getPluginClass().getName());
                assertSame(CustodialNativeVaultPlugin.class, handle.getPluginClass());
                assertTrue(handle.getInstance() instanceof CustodialNativeVaultPlugin);
                plugin.set((CustodialNativeVaultPlugin) handle.getInstance());
            });

            VaultClock clock = System::currentTimeMillis;
            GeneratedAppTransport transport = new GeneratedAppTransport(clock);
            VaultEngine engine = createTestEngine(transport, clock);
            scenario.onActivity(ignored -> installTestOnlyRuntime(plugin.get(), engine));
            activateTestEngine(engine);

            waitForGeneratedVaultBridge(activity.get());
            evaluateJavascript(activity.get(), "location.replace('/index.html'); 'NAVIGATING';");
            waitForGeneratedHomeBridge(activity.get());

            evaluateJavascript(activity.get(), """
                window.__generatedVaultAcceptance = 'PENDING';
                (async () => {
                  try {
                    const plugin = window.Capacitor.Plugins.CustodialNativeVault;
                    const authorized = await plugin.authorizedRequest({
                      path: '/feedback-api/generated-app-native-vault-acceptance?device_id=KIOSK_02',
                      method: 'GET',
                      device_id: 'KIOSK_02',
                      headers: {},
                      body_base64: ''
                    });
                    const state = await plugin.getState();
                    window.__generatedVaultAcceptance = JSON.stringify({
                      authorized,
                      state,
                      state_keys: Object.keys(state).sort()
                    });
                  } catch (error) {
                    window.__generatedVaultAcceptance = JSON.stringify({ error: {
                      code: error && error.code,
                      message: error && error.message,
                      data: error && error.data
                    }});
                  }
                })();
                'STARTED';
                """);

            String serialized = "";
            for (int attempt = 0; attempt < 100; attempt += 1) {
                serialized = unwrapEvaluation(evaluateJavascript(
                    activity.get(),
                    "window.__generatedVaultAcceptance || ''"
                ));
                if (!serialized.isEmpty() && !serialized.equals("PENDING")) break;
                Thread.sleep(100);
            }

            JSONObject result = new JSONObject(serialized);
            assertFalse(result.has("error"));
            JSONObject authorized = result.getJSONObject("authorized");
            assertEquals(200, authorized.getInt("status"));
            String clearBody = new String(
                android.util.Base64.decode(authorized.getString("body_base64"), android.util.Base64.NO_WRAP),
                StandardCharsets.UTF_8
            );
            JSONObject body = new JSONObject(clearBody);
            assertTrue(body.getBoolean("ok"));
            assertTrue(body.getJSONObject("data").getBoolean("authenticated"));

            JSONObject state = result.getJSONObject("state");
            assertEquals("ACTIVE", state.getString("state"));
            assertTrue(state.getBoolean("credential_present"));
            assertTrue(state.getBoolean("credential_usable"));
            assertFalse(state.getBoolean("recovery_required"));
            assertFalse(state.has("credential"));
            assertFalse(state.has("device_credential"));
            assertFalse(state.has("enrollment_code"));
            String lower = serialized.toLowerCase(java.util.Locale.ROOT);
            assertFalse(serialized.contains(CREDENTIAL));
            assertFalse(serialized.contains(android.util.Base64.encodeToString(
                CREDENTIAL.getBytes(StandardCharsets.UTF_8),
                android.util.Base64.NO_WRAP
            )));
            assertFalse(lower.contains("device_credential"));
            assertFalse(lower.contains("enrollment_code"));
            assertFalse(lower.contains("ciphertext"));
            assertFalse(lower.contains("refresh_secret"));
            assertEquals(1, transport.authorizedCalls.get());

            // In-process instrumentation seam represents ReaderCallback only;
            // no intent action, Tag, or NdefMessage can invoke it cross-app.
            AtomicReference<String> physicalHandoffUrl = new AtomicReference<>();
            scenario.onActivity(value -> {
                String url = "memphiszoo://scan?code=GENERATED_APP_NATIVE_PROOF";
                physicalHandoffUrl.set(invokeReaderBoundary(value, url).getDataString());
            });
            evaluateJavascript(activity.get(), """
                window.__generatedScanAttestation = 'PENDING';
                (async () => {
                  try {
                    const plugin = window.Capacitor.Plugins.CustodialNativeVault;
                    const attested = await plugin.attestScanIntent({
                      url: %s
                    });
                    const duplicate = await plugin.attestScanIntent({ url: %s });
                    const verified = await plugin.verifyScanEntry({ entry_id: attested.entry_id });
                    const bound = await plugin.bindScanEntry({
                      entry_id: attested.entry_id,
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      location_code: 'GENERATED_APP_NATIVE_PROOF',
                      action: 'start',
                      device_id: 'KIOSK_02'
                    });
                    let cross_location_code = '';
                    try {
                      await plugin.consumeScanEntry({
                        entry_id: attested.entry_id,
                        client_session_id: '22222222-2222-4222-8222-222222222222',
                        location_code: 'ANOTHER_LOCATION',
                        action: 'start',
                        device_id: 'KIOSK_02'
                      });
                    } catch (error) { cross_location_code = error && error.code; }
                    const consumed = await plugin.consumeScanEntry({
                      entry_id: attested.entry_id,
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      location_code: 'GENERATED_APP_NATIVE_PROOF',
                      action: 'start',
                      device_id: 'KIOSK_02'
                    });
                    let consumed_replay_code = '';
                    try {
                      await plugin.consumeScanEntry({
                        entry_id: attested.entry_id,
                        client_session_id: '22222222-2222-4222-8222-222222222222',
                        location_code: 'GENERATED_APP_NATIVE_PROOF',
                        action: 'start',
                        device_id: 'KIOSK_02'
                      });
                    } catch (error) { consumed_replay_code = error && error.code; }
                    let replay_code = '';
                    try {
                      await plugin.attestScanIntent({
                        url: %s
                      });
                    } catch (error) { replay_code = error && error.code; }
                    window.__generatedScanAttestation = JSON.stringify({
                      attested, duplicate, verified, bound, consumed, cross_location_code,
                      consumed_replay_code, replay_code
                    });
                  } catch (error) {
                    window.__generatedScanAttestation = JSON.stringify({ error: error && error.code });
                  }
                })();
                'STARTED';
                """.formatted(
                    JSONObject.quote(physicalHandoffUrl.get()),
                    JSONObject.quote(physicalHandoffUrl.get()),
                    JSONObject.quote(physicalHandoffUrl.get())
                ));
            JSONObject scanAttestation = pollJson(activity.get(), "window.__generatedScanAttestation || ''");
            assertFalse(scanAttestation.has("error"));
            JSONObject attested = scanAttestation.getJSONObject("attested");
            assertEquals("native-nfc", attested.getString("entry_source"));
            assertEquals(DEVICE_ID, attested.getString("device_id"));
            assertEquals(attested.getString("entry_id"), scanAttestation.getJSONObject("duplicate").getString("entry_id"));
            assertEquals(attested.getString("entry_id"), scanAttestation.getJSONObject("verified").getString("entry_id"));
            assertTrue(scanAttestation.getJSONObject("bound").getBoolean("bound"));
            assertTrue(scanAttestation.getJSONObject("consumed").getBoolean("consumed"));
            assertEquals("custodial_native_scan_consumption_refused", scanAttestation.getString("cross_location_code"));
            assertEquals("custodial_native_scan_entry_missing", scanAttestation.getString("consumed_replay_code"));
            assertEquals("custodial_native_nfc_handoff_replayed", scanAttestation.getString("replay_code"));

            String firstAbandonedEntry = "";
            String newestEntry = "";
            for (int index = 0; index < 5; index += 1) {
                String url = "memphiszoo://scan?code=ABANDONED_" + index;
                AtomicReference<String> abandonedHandoffUrl = new AtomicReference<>();
                scenario.onActivity(value -> abandonedHandoffUrl.set(invokeReaderBoundary(value, url).getDataString()));
                evaluateJavascript(activity.get(), """
                    window.__generatedAbandonedScan = 'PENDING';
                    (async () => {
                      try {
                        const result = await window.Capacitor.Plugins.CustodialNativeVault.attestScanIntent({
                          url: '%s'
                        });
                        window.__generatedAbandonedScan = JSON.stringify(result);
                      } catch (error) {
                        window.__generatedAbandonedScan = JSON.stringify({ error: error && error.code });
                      }
                    })();
                    'STARTED';
                    """.formatted(abandonedHandoffUrl.get()));
                JSONObject abandoned = pollJson(activity.get(), "window.__generatedAbandonedScan || ''");
                assertFalse(abandoned.has("error"));
                if (index == 0) firstAbandonedEntry = abandoned.getString("entry_id");
                if (index == 4) newestEntry = abandoned.getString("entry_id");
            }
            evaluateJavascript(activity.get(), """
                window.__generatedSaturationRecovery = 'PENDING';
                (async () => {
                  const plugin = window.Capacitor.Plugins.CustodialNativeVault;
                  let oldest_code = '';
                  try { await plugin.verifyScanEntry({ entry_id: '%s' }); }
                  catch (error) { oldest_code = error && error.code; }
                  try {
                    const newest = await plugin.verifyScanEntry({ entry_id: '%s' });
                    window.__generatedSaturationRecovery = JSON.stringify({ oldest_code, newest });
                  } catch (error) {
                    window.__generatedSaturationRecovery = JSON.stringify({ error: error && error.code });
                  }
                })();
                'STARTED';
                """.formatted(firstAbandonedEntry, newestEntry));
            JSONObject saturation = pollJson(activity.get(), "window.__generatedSaturationRecovery || ''");
            assertFalse(saturation.has("error"));
            assertEquals("custodial_native_scan_entry_missing", saturation.getString("oldest_code"));
            assertEquals(newestEntry, saturation.getJSONObject("newest").getString("entry_id"));

            scenario.onActivity(GeneratedCustodialNativeVaultTest::verifyWarmScanIntents);
        } finally {
            // Managed devices do not reliably report DESTROYED for a singleTask activity.
            scenario.onActivity(MainActivity::finishAndRemoveTask);
        }
    }

    @Test
    public void forgeableAndIncompleteScanIntentsNeverMintNativeNfcProof() {
        Uri url = Uri.parse("memphiszoo://scan?code=GENERATED_APP_TEST");
        NdefMessage matchingMessage = new NdefMessage(NdefRecord.createUri(url));
        Intent[] forged = new Intent[] {
            new Intent(context, MainActivity.class)
                .setAction("memphiszoo.custodial.NFC_SCAN")
                .setData(url),
            new Intent(context, MainActivity.class)
                .setAction("android.nfc.action.NDEF_DISCOVERED")
                .setData(url),
            new Intent(context, MainActivity.class)
                .setAction("android.nfc.action.NDEF_DISCOVERED")
                .setData(url)
                .putExtra("android.nfc.extra.NDEF_MESSAGES", new NdefMessage[] { matchingMessage }),
            new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(url),
        };
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                for (Intent scan : forged) {
                    String originalAction = scan.getAction();
                    Intent normalized = invokePrivateIntentMethod(activity, "normalizeExternalIntent", scan);
                    assertSame(scan, normalized);
                    assertEquals(originalAction, normalized.getAction());
                    assertEquals(scan.getData(), normalized.getData());
                    assertFalse(normalized.getData().getQueryParameterNames().contains(NativeNfcScanHandoff.QUERY_PARAMETER));
                }
            });
        }
    }

    @Test
    public void physicalReaderBoundaryRoutesTheBundledBridgeWithOneDurableEntryId() throws Exception {
        ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
        try {
            AtomicReference<MainActivity> activity = new AtomicReference<>();
            AtomicReference<CustodialNativeVaultPlugin> plugin = new AtomicReference<>();
            scenario.onActivity(value -> {
                activity.set(value);
                plugin.set((CustodialNativeVaultPlugin) value.getBridge()
                    .getPlugin(CUSTODIAL_PLUGIN_ID).getInstance());
            });
            VaultClock clock = System::currentTimeMillis;
            VaultEngine engine = createTestEngine(new GeneratedAppTransport(clock), clock);
            scenario.onActivity(ignored -> installTestOnlyRuntime(plugin.get(), engine));
            activateTestEngine(engine);
            waitForGeneratedVaultBridge(activity.get());

            AtomicReference<Intent> emitted = new AtomicReference<>();
            scenario.onActivity(value -> emitted.set(dispatchReaderBoundary(
                value, "memphiszoo://scan?code=GENERATED_FULL_CHAIN"
            )));
            assertNotNull(emitted.get());

            JSONObject destination = null;
            for (int attempt = 0; attempt < 100; attempt += 1) {
                String serialized = unwrapEvaluation(evaluateJavascript(activity.get(), """
                    JSON.stringify({
                      path: location.pathname,
                      code: new URL(location.href).searchParams.get('code'),
                      source: new URL(location.href).searchParams.get('source'),
                      entry_id: new URL(location.href).searchParams.get('entry_id'),
                      handoff: new URL(location.href).searchParams.get('mz_nfc_handoff')
                    })
                    """));
                JSONObject candidate = new JSONObject(serialized);
                if (candidate.optString("entry_id").matches("^[0-9a-f-]{36}$")) {
                    destination = candidate;
                    break;
                }
                Thread.sleep(100);
            }
            if (destination == null) {
                String diagnostic = unwrapEvaluation(evaluateJavascript(activity.get(), """
                    JSON.stringify({
                      href: location.href,
                      handoff_state: window.MemphisNativeScanHandoffState || null,
                      native_offline_time_authority: window.MemphisMobile?.nativeOfflineTimeAuthority ?? null,
                      capacitor_platform: window.Capacitor?.getPlatform?.() || null,
                      capacitor_native: window.Capacitor?.isNativePlatform?.() ?? null,
                      mobile_status: window.MemphisMobile?.securityStatus?.() || null,
                      security_status: window.MemphisCustodialSecurity?.getStatus?.() || null
                    })
                    """));
                throw new AssertionError(
                    "Bundled bridge did not complete the physical NFC handoff; activity_intent="
                        + activity.get().getIntent().getDataString() + "; state=" + diagnostic
                );
            }
            assertTrue(destination.getString("path").endsWith("/scan.html"));
            assertEquals("GENERATED_FULL_CHAIN", destination.getString("code"));
            assertEquals("native-nfc", destination.getString("source"));
            assertTrue(destination.isNull("handoff"));
            assertEquals(
                destination.getString("entry_id"),
                plugin.get().requireScanEntry(destination.getString("entry_id")).get("entry_id")
            );
        } finally {
            scenario.onActivity(MainActivity::finishAndRemoveTask);
        }
    }

    private static void verifyWarmScanIntents(MainActivity activity) {
        for (String action : new String[] {
            "android.nfc.action.NDEF_DISCOVERED",
            "memphiszoo.custodial.NFC_SCAN",
            Intent.ACTION_VIEW,
        }) {
            Intent scan = new Intent(activity, MainActivity.class)
                .setAction(action)
                .setData(Uri.parse("memphiszoo://scan?code=GENERATED_APP_WARM_TEST"))
                ;
            invokePrivateIntentMethod(activity, "onNewIntent", scan);
            assertEquals(action, activity.getIntent().getAction());
            assertEquals(scan.getData(), activity.getIntent().getData());
            assertFalse(activity.getIntent().getData().getQueryParameterNames().contains(NativeNfcScanHandoff.QUERY_PARAMETER));
        }
    }

    private static Intent invokePrivateIntentMethod(MainActivity activity, String name, Intent intent) {
        try {
            Method method = MainActivity.class.getDeclaredMethod(name, Intent.class);
            method.setAccessible(true);
            Object result = method.invoke(activity, intent);
            return result instanceof Intent ? (Intent) result : activity.getIntent();
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("Generated MainActivity intent invocation failed for " + name, error);
        }
    }

    private static Intent invokeReaderBoundary(MainActivity activity, String url) {
        try {
            Method method = MainActivity.class.getDeclaredMethod("recordPhysicalNfcHandoff", String.class);
            String handoffId = String.valueOf(method.invoke(activity, url));
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url).buildUpon()
                .appendQueryParameter(NativeNfcScanHandoff.QUERY_PARAMETER, handoffId)
                .build());
            assertNotNull(intent);
            assertEquals(Intent.ACTION_VIEW, intent.getAction());
            assertNotNull(intent.getData().getQueryParameter(NativeNfcScanHandoff.QUERY_PARAMETER));
            return intent;
        } catch (ReflectiveOperationException error) { throw new AssertionError("Reader boundary invocation failed", error); }
    }

    private static Intent dispatchReaderBoundary(MainActivity activity, String url) {
        try {
            Method method = MainActivity.class.getDeclaredMethod("dispatchPhysicalNfcUrlFromReader", String.class);
            method.setAccessible(true);
            return (Intent) method.invoke(activity, url);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("Reader dispatch invocation failed", error);
        }
    }

    private void assertGeneratedPluginManifestAsset() throws Exception {
        String source;
        try (InputStream input = context.getAssets().open("capacitor.plugins.json")) {
            source = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        JSONArray manifest = new JSONArray(source);
        int expected = 0;
        int packageEntries = 0;
        int classEntries = 0;
        for (int index = 0; index < manifest.length(); index += 1) {
            JSONObject entry = manifest.getJSONObject(index);
            String packageName = entry.optString("pkg", "");
            String className = entry.optString("classpath", "");
            if (packageName.equals("@memphis-zoo/custodial-native-vault")) packageEntries += 1;
            if (className.equals(CUSTODIAL_PLUGIN_CLASS)) classEntries += 1;
            if (
                packageName.equals("@memphis-zoo/custodial-native-vault")
                && className.equals(CUSTODIAL_PLUGIN_CLASS)
            ) expected += 1;
            assertFalse(packageName.equals("@aparajita/capacitor-secure-storage"));
            assertFalse(className.equals("com.aparajita.capacitor.securestorage.SecureStorage"));
        }
        assertEquals(1, expected);
        assertEquals(1, packageEntries);
        assertEquals(1, classEntries);
    }

    private VaultEngine createTestEngine(GeneratedAppTransport transport, VaultClock clock) {
        return new VaultEngine(
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(),
            transport,
            new LegacyVaultSource() {
                @Override public LegacyMaterial read() { return null; }
                @Override public void cleanup() {}
                @Override public boolean isClean() { return true; }
            },
            () -> "generated-app-test-installation-seal-0001",
            clock
        );
    }

    private static void activateTestEngine(VaultEngine engine) throws Exception {
        char[] code = "12345678".toCharArray();
        try {
            engine.enroll(OPERATION_ID, DEVICE_ID, "enrollment", code);
        } finally {
            VaultValidation.wipe(code);
        }
        engine.completeLocalBinding(OPERATION_ID);
        engine.confirmEnrollment(OPERATION_ID);
    }

    private static void installTestOnlyRuntime(CustodialNativeVaultPlugin plugin, VaultEngine engine) {
        assertNotNull(plugin);
        setPrivateField(plugin, "engine", engine);
        setPrivateField(
            plugin,
            "cancellation",
            new CancellationCoordinator(engine, (operationId, deviceId) -> false)
        );
        setPrivateField(
            plugin,
            "removal",
            new RemovalCoordinator(engine, (operationId, deviceId) -> false)
        );
    }

    private static void setPrivateField(Object target, String name, Object value) {
        try {
            Field field = CustodialNativeVaultPlugin.class.getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("Test-only native-vault injection failed for " + name, error);
        }
    }

    private static String evaluateJavascript(MainActivity activity, String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("null");
        activity.runOnUiThread(() -> activity.getBridge().getWebView().evaluateJavascript(script, value -> {
            result.set(value);
            complete.countDown();
        }));
        assertTrue("Generated-app JavaScript evaluation timed out", complete.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private static void waitForGeneratedVaultBridge(MainActivity activity) throws Exception {
        waitForGeneratedVaultBridge(activity, false);
    }

    private static void waitForGeneratedHomeBridge(MainActivity activity) throws Exception {
        waitForGeneratedVaultBridge(activity, true);
    }

    private static void waitForGeneratedVaultBridge(MainActivity activity, boolean requireHome) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        JSONObject lastState = null;
        do {
            String serialized = unwrapEvaluation(evaluateJavascript(activity, """
                JSON.stringify({
                  document_state: document.readyState,
                  location: window.location.href,
                  local_https_origin: window.location.origin === 'https://localhost',
                  home: window.location.pathname.endsWith('/index.html'),
                  approved_entrypoint: ['/app-shell.html', '/index.html'].some(
                    path => window.location.pathname.endsWith(path)
                  ),
                  capacitor: typeof window.Capacitor !== 'undefined',
                  plugin: typeof window.Capacitor !== 'undefined' &&
                    !!window.Capacitor.Plugins.CustodialNativeVault
                })
                """));
            lastState = new JSONObject(serialized);
            if (
                "complete".equals(lastState.optString("document_state")) &&
                lastState.optBoolean("local_https_origin") &&
                lastState.optBoolean("approved_entrypoint") &&
                (!requireHome || lastState.optBoolean("home")) &&
                lastState.optBoolean("capacitor") &&
                lastState.optBoolean("plugin")
            ) return;
            Thread.sleep(250);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("Generated-app bridge did not become ready: " + lastState);
    }

    private static String unwrapEvaluation(String encoded) throws Exception {
        Object value = new JSONTokener(encoded == null ? "null" : encoded).nextValue();
        return value == null || value == JSONObject.NULL ? "" : String.valueOf(value);
    }

    private static JSONObject pollJson(MainActivity activity, String script) throws Exception {
        String serialized = "";
        for (int attempt = 0; attempt < 100; attempt += 1) {
            serialized = unwrapEvaluation(evaluateJavascript(activity, script));
            if (!serialized.isEmpty() && !serialized.equals("PENDING")) return new JSONObject(serialized);
            Thread.sleep(100);
        }
        throw new AssertionError("Generated-app JavaScript result timed out");
    }

    private void clearRuntimeVault() throws Exception {
        context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit();
        context.getSharedPreferences("MemphisZooCustodialNativeVaultV1", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit();
        context.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit();
        new AndroidKeystoreCipher().destroyKey();
    }

    private static final class GeneratedAppTransport implements EnrollmentTransport {
        private final VaultClock clock;
        private volatile boolean confirmed;
        private final AtomicInteger authorizedCalls = new AtomicInteger();

        GeneratedAppTransport(VaultClock clock) {
            this.clock = clock;
        }

        @Override
        public EnrollmentResult enroll(EnrollmentRequest request, char[] enrollmentCode) throws VaultFailure {
            return new EnrollmentResult(
                request.operationId,
                request.deviceId,
                request.flow,
                CREDENTIAL.toCharArray(),
                new EnrollmentMetadata(
                    CREDENTIAL_ID,
                    Instant.ofEpochMilli(clock.nowMillis() + 86_400_000L).toString(),
                    Instant.ofEpochMilli(clock.nowMillis() + 20L * 60L * 1000L).toString(),
                    "Generated app test phone",
                    "employee-generated-test",
                    "Generated Test Employee"
                ),
                false
            );
        }

        @Override
        public TerminalResult confirm(String operationId, String deviceId, char[] credential) throws VaultFailure {
            requireCredential(credential);
            confirmed = true;
            return new TerminalResult(operationId, false);
        }

        @Override
        public TerminalResult cancel(String operationId, String deviceId, char[] credential) throws VaultFailure {
            requireCredential(credential);
            return new TerminalResult(operationId, false);
        }

        @Override
        public TerminalResult remove(String operationId, String deviceId, char[] credential) throws VaultFailure {
            requireCredential(credential);
            return new TerminalResult(operationId, false);
        }

        @Override
        public String verifyLegacyIdentity(String candidateDeviceId, char[] credential) throws VaultFailure {
            requireCredential(credential);
            return VaultValidation.deviceId(candidateDeviceId);
        }

        @Override
        public ActiveCredentialStatus verifyActiveCredential(
            String deviceId,
            String expectedCredentialId,
            char[] credential
        ) throws VaultFailure {
            requireCredential(credential);
            if (
                !confirmed
                || !DEVICE_ID.equals(deviceId)
                || !CREDENTIAL_ID.equals(expectedCredentialId)
            ) {
                throw new VaultFailure("generated_app_test_credential_revalidation_refused", 401);
            }
            return ActiveCredentialStatus.ACCEPTED;
        }

        @Override
        public AuthorizedResponse authorized(
            AuthorizedRequest request,
            String deviceId,
            char[] credential
        ) throws VaultFailure {
            requireCredential(credential);
            if (!confirmed || !DEVICE_ID.equals(deviceId)) {
                throw new VaultFailure("generated_app_test_not_active", 401);
            }
            if (
                request.path.equals("/device-auth/status?device_id=KIOSK_02")
                && request.method.equals("GET")
                && request.headers.isEmpty()
                && request.body.length == 0
            ) {
                return new AuthorizedResponse(
                    200,
                    Map.of("content-type", "application/json"),
                    ("{\"ok\":true,\"data\":{\"authenticated\":true,"
                        + "\"enrollment_required\":false,\"policy_mode\":\"enforced\","
                        + "\"requested_device_id\":\"KIOSK_02\",\"canonical_device_id\":\"KIOSK_02\","
                        + "\"device_name\":\"Generated app test phone\","
                        + "\"employee_name\":\"Generated Test Employee\","
                        + "\"credential_id\":\"" + CREDENTIAL_ID + "\"}}").getBytes(StandardCharsets.UTF_8)
                );
            }
            if (
                !request.path.equals("/feedback-api/generated-app-native-vault-acceptance?device_id=KIOSK_02")
                || !request.method.equals("GET")
                || !request.headers.isEmpty()
                || request.body.length != 0
            ) {
                throw new VaultFailure("generated_app_test_request_mismatch", 400);
            }
            authorizedCalls.incrementAndGet();
            return new AuthorizedResponse(
                200,
                Map.of("content-type", "application/json"),
                "{\"ok\":true,\"data\":{\"authenticated\":true}}".getBytes(StandardCharsets.UTF_8)
            );
        }

        private static void requireCredential(char[] supplied) throws VaultFailure {
            char[] expected = CREDENTIAL.toCharArray();
            try {
                if (!VaultValidation.sameSecret(expected, supplied)) {
                    throw new VaultFailure("generated_app_test_credential_mismatch", 401);
                }
            } finally {
                VaultValidation.wipe(expected);
            }
        }
    }
}
