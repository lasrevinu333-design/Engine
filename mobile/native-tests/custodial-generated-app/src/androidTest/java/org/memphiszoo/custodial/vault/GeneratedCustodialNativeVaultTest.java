package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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
    private static final String CREDENTIAL = "generated-app-test-device-credential-0001";
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
                    new HashSet<>(Arrays.asList("normalizeExternalIntent", "onCreate", "onNewIntent")),
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

            String readiness = "";
            for (int attempt = 0; attempt < 100; attempt += 1) {
                readiness = unwrapEvaluation(evaluateJavascript(
                    activity.get(),
                    "document.readyState === 'complete' && typeof window.Capacitor !== 'undefined' && "
                        + "!!window.Capacitor.Plugins.CustodialNativeVault ? 'READY' : 'WAIT'"
                ));
                if (readiness.equals("READY")) break;
                Thread.sleep(100);
            }
            assertEquals("READY", readiness);

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

            scenario.onActivity(GeneratedCustodialNativeVaultTest::verifyWarmScanIntents);
        } finally {
            // Managed devices do not reliably report DESTROYED for a singleTask activity.
            scenario.onActivity(MainActivity::finishAndRemoveTask);
        }
    }

    @Test
    public void ndefAndCompatibilityIntentsNormalizeWithoutLaunchingASecondTask() {
        for (String action : new String[] {
            "android.nfc.action.NDEF_DISCOVERED",
            "memphiszoo.custodial.NFC_SCAN",
        }) {
            Intent scan = new Intent(context, MainActivity.class)
                .setAction(action)
                .setData(Uri.parse("memphiszoo://scan?code=GENERATED_APP_TEST"));
            Intent normalized = invokePrivateIntentMethod("normalizeExternalIntent", scan);
            assertSame(scan, normalized);
            assertEquals(Intent.ACTION_VIEW, normalized.getAction());
            assertEquals(scan.getData(), normalized.getData());
        }
    }

    private static void verifyWarmScanIntents(MainActivity activity) {
        for (String action : new String[] {
            "android.nfc.action.NDEF_DISCOVERED",
            "android.nfc.action.NDEF_DISCOVERED",
            "memphiszoo.custodial.NFC_SCAN",
        }) {
            Intent scan = new Intent(activity, MainActivity.class)
                .setAction(action)
                .setData(Uri.parse("memphiszoo://scan?code=GENERATED_APP_WARM_TEST"));
            invokePrivateIntentMethod(activity, "onNewIntent", scan);
            assertEquals(Intent.ACTION_VIEW, activity.getIntent().getAction());
            assertEquals(scan.getData(), activity.getIntent().getData());
        }
    }

    private static Intent invokePrivateIntentMethod(String name, Intent intent) {
        return invokePrivateIntentMethod(null, name, intent);
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

    private static String unwrapEvaluation(String encoded) throws Exception {
        Object value = new JSONTokener(encoded == null ? "null" : encoded).nextValue();
        return value == null || value == JSONObject.NULL ? "" : String.valueOf(value);
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
                    "generated-app-test-credential-id",
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
