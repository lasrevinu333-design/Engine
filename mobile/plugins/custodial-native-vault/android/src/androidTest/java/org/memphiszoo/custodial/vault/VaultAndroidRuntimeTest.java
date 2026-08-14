package org.memphiszoo.custodial.vault;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginResult;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class VaultAndroidRuntimeTest {
    private static final String OP = "11111111-1111-4111-8111-111111111111";
    private static final String REMOVE = "33333333-3333-4333-8333-333333333333";
    private static final String WRONG_REMOVE = "44444444-4444-4444-8444-444444444444";
    private static final String DEVICE = "KIOSK_02";
    private static final String LEGACY_SECURE_PREFERENCES = "WSSecureStorageSharedPreferences";
    private static final String LEGACY_CREDENTIAL_ALIAS = "capacitor-storage_memphis_zoo_custodial_device_credential";
    private static final String LEGACY_SEAL_ALIAS = "capacitor-storage_memphis_zoo_custodial_installation_seal";
    private static final String LEGACY_RECORD_ALIAS = "capacitor-storage_memphis_zoo_custodial_installation_record_v1";
    private static final String LEGACY_V1_ALIAS = "org.memphiszoo.custodial.native-vault.v1";
    private static final String LEGACY_SEAL = "legacy-instrumented-installation-seal-0002";
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
    public void androidKeystoreAndSingleSnapshotSurviveAdapterRecreation() throws Exception {
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, codec);
        AndroidKeystoreCipher cipher = new AndroidKeystoreCipher();
        char[] credential = InstrumentedTransport.CREDENTIAL.toCharArray();
        EncryptedSecret encrypted;
        try {
            encrypted = cipher.encrypt(credential);
        } finally {
            VaultValidation.wipe(credential);
        }
        InstallationBinding binding = new InstallationBinding(
            DEVICE,
            "native-instrumented-installation-seal",
            Instant.now().toString(),
            false,
            OP
        );
        VaultSnapshot staged = VaultSnapshot.empty().next(
            VaultPhase.CREDENTIAL_STAGED,
            SecretKind.DEVICE_CREDENTIAL,
            encrypted,
            OP,
            DEVICE,
            "enrollment",
            System.currentTimeMillis() + 600_000L,
            binding,
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
        persistence.commit(0, staged);

        VaultSnapshot restored = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load();
        assertEquals(staged, restored);
        char[] clear = new AndroidKeystoreCipher().decrypt(restored.secret);
        try {
            assertEquals(InstrumentedTransport.CREDENTIAL, new String(clear));
        } finally {
            VaultValidation.wipe(clear);
        }
        SharedPreferences raw = context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE);
        assertEquals(1, raw.getAll().size());
        assertFalse(String.valueOf(raw.getAll()).contains(InstrumentedTransport.CREDENTIAL));
    }

    @Test
    public void nativeCancelDialogMakesZeroPersistenceAndNetworkChanges() throws Exception {
        try (ActivityScenario<RemovalTestActivity> scenario = ActivityScenario.launch(RemovalTestActivity.class)) {
            AtomicReference<RemovalTestActivity> activity = new AtomicReference<>();
            scenario.onActivity(activity::set);
            VaultClock clock = System::currentTimeMillis;
            SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
            InstrumentedTransport transport = new InstrumentedTransport(clock);
            VaultEngine engine = activeEngine(persistence, transport, clock);
            String before = rawSnapshot();
            RemovalCoordinator coordinator = new RemovalCoordinator(
                engine,
                new AndroidRemovalAuthorizationGate(activity::get)
            );
            ExecutorService executor = Executors.newSingleThreadExecutor();
            Future<RemovalView> removal = executor.submit(() -> coordinator.remove(REMOVE, DEVICE));
            clickWhenVisible("Cancel");
            try {
                removal.get();
                fail("Expected native cancellation");
            } catch (ExecutionException error) {
                assertTrue(error.getCause() instanceof VaultFailure);
                assertEquals("custodial_native_removal_cancelled", ((VaultFailure) error.getCause()).code);
            } finally {
                executor.shutdownNow();
            }
            assertEquals(before, rawSnapshot());
            assertEquals(0, transport.removeCalls.get());
            assertEquals("ACTIVE", persistence.load().phase.name());
        }
    }

    @Test
    public void nativeEnrollmentCancelDialogMakesZeroPersistenceAndNetworkChanges() throws Exception {
        try (ActivityScenario<RemovalTestActivity> scenario = ActivityScenario.launch(RemovalTestActivity.class)) {
            AtomicReference<RemovalTestActivity> activity = new AtomicReference<>();
            scenario.onActivity(activity::set);
            VaultClock clock = System::currentTimeMillis;
            SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
            InstrumentedTransport transport = new InstrumentedTransport(clock);
            VaultEngine engine = stagedEngine(persistence, transport, clock);
            String before = rawSnapshot();
            CancellationCoordinator coordinator = new CancellationCoordinator(
                engine,
                new AndroidCancellationAuthorizationGate(activity::get)
            );
            ExecutorService executor = Executors.newSingleThreadExecutor();
            Future<Map<String, Object>> cancellation = executor.submit(() -> coordinator.cancel(OP));
            clickWhenVisible("Keep enrollment");
            try {
                cancellation.get();
                fail("Expected native enrollment cancellation refusal");
            } catch (ExecutionException error) {
                assertTrue(error.getCause() instanceof VaultFailure);
                assertEquals("custodial_native_cancellation_cancelled", ((VaultFailure) error.getCause()).code);
            } finally {
                executor.shutdownNow();
            }
            assertEquals(before, rawSnapshot());
            assertEquals(0, transport.cancelCalls.get());
            assertEquals(1, transport.activeCredentials());
            assertEquals("CREDENTIAL_STAGED", persistence.load().phase.name());
        }
    }

    @Test
    public void actualSecureStorageCredentialOnlyMigrationCleansSourceAndActivatesAfterVerification() throws Exception {
        writeLegacySecureValue(LEGACY_CREDENTIAL_ALIAS, InstrumentedTransport.CREDENTIAL);
        writeLegacySecureValue(LEGACY_SEAL_ALIAS, LEGACY_SEAL);
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = new VaultEngine(
            persistence,
            new AndroidKeystoreCipher(),
            transport,
            new AndroidLegacyVaultSource(context, clock),
            () -> "unused-native-installation-seal",
            clock
        );

        Map<String, Object> pending = engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertTrue((Boolean) pending.get("legacy_pending"));
        assertEquals(LEGACY_SEAL, pending.get("legacy_seal"));
        SharedPreferences old = context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE);
        assertFalse(old.contains(LEGACY_CREDENTIAL_ALIAS));
        assertFalse(old.contains(LEGACY_SEAL_ALIAS));
        KeyStore store = androidKeyStore();
        assertFalse(store.containsAlias(LEGACY_CREDENTIAL_ALIAS));
        assertFalse(store.containsAlias(LEGACY_SEAL_ALIAS));

        Map<String, Object> active = engine.completeLegacyBinding(DEVICE);
        assertEquals("ACTIVE", active.get("state"));
        Map<?, ?> installation = (Map<?, ?>) active.get("installation");
        assertEquals(DEVICE, installation.get("device_id"));
        assertEquals(LEGACY_SEAL, installation.get("installation_seal"));
        assertTrue((Boolean) installation.get("migrated_from_credential_only_state"));
        assertEquals(1, context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE).getAll().size());
    }

    @Test
    public void actualSecureStorageRecordAndCompatibilityAliasesMustExactlyAgree() throws Exception {
        writeLegacySecureValue(LEGACY_RECORD_ALIAS, legacyInstallationRecord(InstrumentedTransport.CREDENTIAL));
        writeLegacySecureValue(LEGACY_CREDENTIAL_ALIAS, InstrumentedTransport.CREDENTIAL);
        writeLegacySecureValue(LEGACY_SEAL_ALIAS, LEGACY_SEAL);
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        VaultEngine engine = new VaultEngine(
            persistence,
            new AndroidKeystoreCipher(),
            new InstrumentedTransport(clock),
            new AndroidLegacyVaultSource(context, clock),
            () -> "unused-native-installation-seal",
            clock
        );

        Map<String, Object> active = engine.getState();
        assertEquals("ACTIVE", active.get("state"));
        assertEquals(DEVICE, ((Map<?, ?>) active.get("installation")).get("device_id"));
        SharedPreferences old = context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE);
        assertFalse(old.contains(LEGACY_RECORD_ALIAS));
        assertFalse(old.contains(LEGACY_CREDENTIAL_ALIAS));
        assertFalse(old.contains(LEGACY_SEAL_ALIAS));
        KeyStore store = androidKeyStore();
        assertFalse(store.containsAlias(LEGACY_RECORD_ALIAS));
        assertFalse(store.containsAlias(LEGACY_CREDENTIAL_ALIAS));
        assertFalse(store.containsAlias(LEGACY_SEAL_ALIAS));
    }

    @Test
    public void actualSecureStorageMismatchedCompatibilityCredentialFailsClosedWithoutCleanup() throws Exception {
        writeLegacySecureValue(LEGACY_RECORD_ALIAS, legacyInstallationRecord(InstrumentedTransport.CREDENTIAL));
        writeLegacySecureValue(LEGACY_CREDENTIAL_ALIAS, "different-legacy-device-credential-0002");
        writeLegacySecureValue(LEGACY_SEAL_ALIAS, LEGACY_SEAL);
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        VaultEngine engine = new VaultEngine(
            persistence,
            new AndroidKeystoreCipher(),
            new InstrumentedTransport(clock),
            new AndroidLegacyVaultSource(context, clock),
            () -> "unused-native-installation-seal",
            clock
        );

        try {
            engine.getState();
            fail("Expected mismatched protected aliases to fail closed");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_legacy_vault_mismatch", error.code);
        }
        assertEquals(VaultPhase.BLOCKED, persistence.load().phase);
        SharedPreferences old = context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE);
        assertTrue(old.contains(LEGACY_RECORD_ALIAS));
        assertTrue(old.contains(LEGACY_CREDENTIAL_ALIAS));
        assertTrue(old.contains(LEGACY_SEAL_ALIAS));
        KeyStore store = androidKeyStore();
        assertTrue(store.containsAlias(LEGACY_RECORD_ALIAS));
        assertTrue(store.containsAlias(LEGACY_CREDENTIAL_ALIAS));
        assertTrue(store.containsAlias(LEGACY_SEAL_ALIAS));
    }

    @Test
    public void actualSecureStorageOrphanSealFailsClosedWithoutCleanup() throws Exception {
        writeLegacySecureValue(LEGACY_SEAL_ALIAS, LEGACY_SEAL);
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        VaultEngine engine = new VaultEngine(
            persistence,
            new AndroidKeystoreCipher(),
            new InstrumentedTransport(clock),
            new AndroidLegacyVaultSource(context, clock),
            () -> "unused-native-installation-seal",
            clock
        );

        try {
            engine.getState();
            fail("Expected orphan protected alias to fail closed");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_legacy_vault_invalid", error.code);
        }
        assertEquals(VaultPhase.BLOCKED, persistence.load().phase);
        SharedPreferences old = context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE);
        assertTrue(old.contains(LEGACY_SEAL_ALIAS));
        assertTrue(androidKeyStore().containsAlias(LEGACY_SEAL_ALIAS));
    }

    @Test
    public void actualSharedPreferencesFailBeforeStageCommitCompensatesWithoutOrphan() throws Exception {
        SharedPreferences raw = context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 3, false);
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec());
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = bareEngine(persistence, transport, clock);

        try {
            engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
            fail("Expected the injected SharedPreferences commit failure");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_vault_commit_failed", error.code);
        }

        assertEquals("CANCELLED", new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load().phase.name());
        assertEquals(1, transport.issuanceCount.get());
        assertEquals(1, transport.cancelCalls.get());
        assertEquals(0, transport.activeCredentials());
    }

    @Test
    public void actualSharedPreferencesWriteThenFailUsesExactReadbackWithoutCompensation() throws Exception {
        SharedPreferences raw = context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 3, true);
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec());
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = bareEngine(persistence, transport, clock);

        EnrollmentView enrolled = engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());

        assertEquals("CREDENTIAL_STAGED", enrolled.phase.name());
        assertEquals("CREDENTIAL_STAGED", new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load().phase.name());
        assertEquals(1, transport.issuanceCount.get());
        assertEquals(0, transport.cancelCalls.get());
        assertEquals(1, transport.activeCredentials());
    }

    @Test
    public void actualFinalizeCommitFailureKeepsExactTombstoneAndRestartCompletesIdempotently() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferences raw = context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(raw, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = activeEngine(persistence, transport, clock);
        engine.removeEnrollment(REMOVE, DEVICE);
        assertEquals("REMOVAL_TOMBSTONE", persistence.load().phase.name());

        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 1, false);
        VaultEngine interrupted = bareEngine(
            new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec()),
            transport,
            clock
        );
        try {
            interrupted.finalizeRemoval(REMOVE);
            fail("Expected final tombstone commit failure");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_vault_commit_failed", error.code);
        }
        assertEquals("REMOVAL_TOMBSTONE", persistence.load().phase.name());
        assertFalse(androidKeyStore().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));

        VaultEngine restarted = bareEngine(persistence, transport, clock);
        Map<String, Object> finalized = restarted.finalizeRemoval(REMOVE);
        assertEquals("EMPTY", finalized.get("state"));
        assertTrue((Boolean) finalized.get("removal_finalized"));
        assertEquals(REMOVE, finalized.get("removal_operation_id"));
        long revision = persistence.load().revision;
        assertEquals(finalized, bareEngine(persistence, transport, clock).finalizeRemoval(REMOVE));
        assertEquals(revision, persistence.load().revision);
        try {
            bareEngine(persistence, transport, clock).finalizeRemoval(WRONG_REMOVE);
            fail("Expected exact finalized-operation enforcement");
        } catch (VaultFailure error) {
            assertEquals("custodial_native_removal_not_complete", error.code);
        }
    }

    @Test
    public void capacitorCallAndResultSerializationExposeNoCredential() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = activeEngine(persistence, transport, clock);
        JSObject options = new JSObject();
        options.put("path", "/device-auth/status?device_id=KIOSK_02");
        options.put("method", "GET");
        options.put("device_id", DEVICE);
        options.put("headers", new JSObject());
        options.put("body_base64", "");
        PluginCall call = new PluginCall(null, "CustodialNativeVault", "runtime-test", "authorizedRequest", options);
        AuthorizedResponse response = engine.authorizedRequest(
            call.getString("device_id"),
            new AuthorizedRequest(
                call.getString("path"),
                call.getString("method"),
                Map.of(),
                new byte[0]
            )
        );
        JSObject result = new JSObject();
        result.put("status", response.status);
        result.put("headers", JSObject.fromJSONObject(new JSONObject(response.headers)));
        result.put("body_base64", android.util.Base64.encodeToString(response.body, android.util.Base64.NO_WRAP));
        String serialized = new PluginResult(result).toString();
        assertTrue(serialized.contains("body_base64"));
        assertFalse(serialized.contains(InstrumentedTransport.CREDENTIAL));
        assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("device_credential"));
    }

    @Test
    public void registeredCapacitorBridgeExecutesAuthenticatedPluginWithoutCredentialExposure() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = activeEngine(persistence, transport, clock);
        MutableRuntimeMonotonicClock monotonicClock = new MutableRuntimeMonotonicClock(1_000L, 7);
        CustodialNativeVaultPlugin plugin = new CustodialNativeVaultPlugin(
            engine,
            new CancellationCoordinator(engine, (operationId, deviceId) -> false),
            new RemovalCoordinator(engine, (operationId, deviceId) -> false),
            new OfflineAuthorityTime(new AndroidOfflineAuthorityTimeStore(context), monotonicClock)
        );
        String scanEntryId = String.valueOf(plugin.createScanEntry(
            "https://example.test/?code=TETM", "native-nfc"
        ).get("entry_id"));
        BridgeSmokeActivity.install(plugin);
        try (ActivityScenario<BridgeSmokeActivity> scenario = ActivityScenario.launch(BridgeSmokeActivity.class)) {
            AtomicReference<BridgeSmokeActivity> activity = new AtomicReference<>();
            scenario.onActivity(activity::set);
            String readiness = "";
            for (int attempt = 0; attempt < 50; attempt += 1) {
                readiness = unwrapEvaluation(evaluateJavascript(
                    activity.get(),
                    "typeof window.Capacitor !== 'undefined' && !!window.Capacitor.Plugins.CustodialNativeVault ? 'READY' : 'WAIT'"
                ));
                if (readiness.equals("READY")) break;
                Thread.sleep(100);
            }
            assertEquals("READY", readiness);
            evaluateJavascript(activity.get(), ("""
                window.__vaultSmokeResult = 'PENDING';
                (async () => {
                  try {
                    const plugin = window.Capacitor.Plugins.CustodialNativeVault;
                    const anchor = await plugin.anchorOfflineAuthoritySnapshot({
                      device_id: 'KIOSK_02',
                      snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                      generated_at: '2026-08-13T12:00:00.000Z',
                      expires_at: '2026-08-13T12:10:00.000Z'
                    });
                    let missingEntryRefused = false;
                    try {
                      await plugin.attestOfflineStart({
                        device_id: 'KIOSK_02', location_code: 'TETM',
                        client_session_id: '77777777-7777-4777-8777-777777777777',
                        snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        snapshot_employee_id: '33333333-3333-4333-8333-333333333333',
                        snapshot_assignment_epoch: 7,
                        snapshot_credential_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                      });
                    } catch (error) {
                      missingEntryRefused = error && error.code === 'custodial_native_scan_entry_missing';
                    }
                    let failedProofPreservedEntry = false;
                    try {
                      await plugin.attestOfflineStart({
                        device_id: 'KIOSK_02', location_code: 'TETM',
                        client_session_id: '22222222-2222-4222-8222-222222222222',
                        snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        snapshot_employee_id: '33333333-3333-4333-8333-333333333333',
                        snapshot_assignment_epoch: 7,
                        snapshot_credential_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                        entry_id: '%s'
                      });
                    } catch (error) {
                      const preserved = await plugin.verifyScanEntry({ entry_id: '%s' });
                      failedProofPreservedEntry = error && error.code === 'custodial_native_start_credential_mismatch'
                        && preserved.entry_id === '%s';
                    }
                    const started = await plugin.attestOfflineStart({
                      device_id: 'KIOSK_02', location_code: 'TETM',
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                      snapshot_employee_id: '33333333-3333-4333-8333-333333333333',
                      snapshot_assignment_epoch: 7,
                      snapshot_credential_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                      entry_id: '%s'
                    });
                    let successfulProofConsumedEntry = false;
                    try {
                      await plugin.verifyScanEntry({ entry_id: '%s' });
                    } catch (error) {
                      successfulProofConsumedEntry = error && error.code === 'custodial_native_scan_entry_missing';
                    }
                    const replayedStarted = await plugin.attestOfflineStart({
                      device_id: 'KIOSK_02', location_code: 'TETM',
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                      snapshot_employee_id: '33333333-3333-4333-8333-333333333333',
                      snapshot_assignment_epoch: 7,
                      snapshot_credential_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                      entry_id: '%s'
                    });
                    const captured = await plugin.captureOfflineCompletionTime({
                      device_id: 'KIOSK_02', location_code: 'TETM',
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      client_started_at: started.p_client_started_at
                    });
                    const completed = await plugin.attestOfflineCompletion({
                      device_id: 'KIOSK_02', location_code: 'TETM',
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      client_completion_id: '44444444-4444-4444-8444-444444444444',
                      context_id: '55555555-5555-4555-8555-555555555555',
                      client_started_at: started.p_client_started_at
                    });
                    const acknowledged = await plugin.acknowledgeOfflineCompletion({
                      device_id: 'KIOSK_02', location_code: 'TETM',
                      client_session_id: '22222222-2222-4222-8222-222222222222',
                      client_started_at: started.p_client_started_at,
                      client_ended_at: completed.p_client_ended_at
                    });
                    const authorized = await plugin.authorizedRequest({
                      path: '/device-auth/status?device_id=KIOSK_02',
                      method: 'GET',
                      device_id: 'KIOSK_02',
                      headers: {},
                      body_base64: ''
                    });
                    const state = await plugin.getState();
                    window.__vaultSmokeResult = JSON.stringify({
                      anchor, missingEntryRefused, failedProofPreservedEntry, successfulProofConsumedEntry,
                      started, replayedStarted, captured, completed, acknowledged, authorized, state
                    });
                  } catch (error) {
                    window.__vaultSmokeResult = JSON.stringify({ error: {
                      code: error && error.code,
                      message: error && error.message,
                      data: error && error.data
                    }});
                  }
                })();
                'STARTED';
                """).formatted(scanEntryId, scanEntryId, scanEntryId, scanEntryId, scanEntryId, scanEntryId));
            String serialized = "";
            for (int attempt = 0; attempt < 100; attempt += 1) {
                serialized = unwrapEvaluation(evaluateJavascript(activity.get(), "window.__vaultSmokeResult || ''"));
                if (!serialized.isEmpty() && !serialized.equals("PENDING")) break;
                Thread.sleep(100);
            }
            JSONObject result = new JSONObject(serialized);
            assertFalse(result.has("error"));
            assertTrue(result.getJSONObject("anchor").getBoolean("anchored"));
            assertTrue(result.getBoolean("missingEntryRefused"));
            assertTrue(result.getBoolean("failedProofPreservedEntry"));
            assertTrue(result.getBoolean("successfulProofConsumedEntry"));
            assertEquals("custodial-native-start.v1", result.getJSONObject("started").getString("p_native_start_attestation_version"));
            assertEquals(scanEntryId, result.getJSONObject("started").getString("p_native_scan_entry_id"));
            assertEquals(result.getJSONObject("started").toString(), result.getJSONObject("replayedStarted").toString());
            assertEquals("custodial-native-completion.v1", result.getJSONObject("completed").getString("p_native_completion_attestation_version"));
            assertEquals(result.getJSONObject("captured").getString("p_client_ended_at"), result.getJSONObject("completed").getString("p_client_ended_at"));
            assertTrue(result.getJSONObject("started").getString("p_native_start_attestation").matches("[0-9a-f]{64}"));
            assertTrue(result.getJSONObject("completed").getString("p_native_completion_attestation").matches("[0-9a-f]{64}"));
            assertTrue(result.getJSONObject("acknowledged").getBoolean("acknowledged"));
            JSONObject authorized = result.getJSONObject("authorized");
            assertEquals(200, authorized.getInt("status"));
            String clearBody = new String(
                android.util.Base64.decode(authorized.getString("body_base64"), android.util.Base64.NO_WRAP),
                StandardCharsets.UTF_8
            );
            assertTrue(new JSONObject(clearBody).getBoolean("ok"));
            assertTrue(result.getJSONObject("state").getBoolean("credential_present"));
            assertFalse(serialized.contains(InstrumentedTransport.CREDENTIAL));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("device_credential"));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("enrollment_code"));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("ciphertext"));
        }
    }

    @Test
    public void encryptedOfflineAuthorityJournalSurvivesProcessRecreationWithoutPlaintext() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        VaultEngine engine = activeEngine(persistence, new InstrumentedTransport(clock), clock);
        MutableRuntimeMonotonicClock monotonic = new MutableRuntimeMonotonicClock(1_000L, 7);
        OfflineAuthorityTime first = new OfflineAuthorityTime(new AndroidOfflineAuthorityTimeStore(context), monotonic);
        String snapshot = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        String session = "22222222-2222-4222-8222-222222222222";
        String entry = "33333333-3333-4333-8333-333333333333";
        first.acceptSnapshot(DEVICE, snapshot, "2026-08-13T12:00:00.000Z", "2026-08-13T12:10:00.000Z");
        monotonic.elapsed = 2_500L;
        String started = first.beginOccurrence(DEVICE, "TETM", session, snapshot, entry, true);
        assertEquals("2026-08-13T12:00:01.500Z", started);

        SharedPreferences raw = context.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1", Context.MODE_PRIVATE);
        String stored = String.valueOf(raw.getAll());
        assertTrue(stored.contains("ciphertext"));
        assertFalse(stored.contains("generated_at"));
        assertFalse(stored.contains("2026-08-13T12:00:00.000Z"));
        assertFalse(stored.contains(session));
        assertFalse(stored.contains(entry));

        OfflineAuthorityTime recreated = new OfflineAuthorityTime(new AndroidOfflineAuthorityTimeStore(context), monotonic);
        assertEquals(started, recreated.beginOccurrence(DEVICE, "TETM", session, snapshot, entry, false));
        monotonic.elapsed = 5_250L;
        String completed = recreated.completeOccurrence(DEVICE, "TETM", session, started);
        assertEquals("2026-08-13T12:00:04.250Z", completed);

        AndroidOfflineAuthorityTimeStore restartedStore = new AndroidOfflineAuthorityTimeStore(context);
        OfflineAuthorityTime restarted = new OfflineAuthorityTime(restartedStore, monotonic);
        assertEquals(completed, restarted.completeOccurrence(DEVICE, "TETM", session, started));
        monotonic.boot = 8;
        monotonic.elapsed = 10L;
        assertEquals(completed, restarted.completeOccurrence(DEVICE, "TETM", session, started));
        restarted.acknowledgeCompletedOccurrence(DEVICE, "TETM", session, started, completed);
        assertNull(restartedStore.loadOccurrence(session));
        assertEquals("ACTIVE", engine.getState().get("state"));
    }

    @Test
    public void concurrentScanBindAndCapacityEvictionAreAtomic() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = activeEngine(persistence, transport, clock);

        for (int iteration = 0; iteration < 100; iteration += 1) {
            CustodialNativeVaultPlugin plugin = new CustodialNativeVaultPlugin(
                engine,
                new CancellationCoordinator(engine, (operationId, deviceId) -> false),
                new RemovalCoordinator(engine, (operationId, deviceId) -> false)
            );
            String oldest = String.valueOf(plugin.createScanEntry("https://example.test/?code=TETM", "native-nfc").get("entry_id"));
            for (int index = 0; index < 3; index += 1) {
                plugin.createScanEntry("https://example.test/?code=TETM", "native-nfc");
            }
            String sessionId = UUID.randomUUID().toString();
            CountDownLatch start = new CountDownLatch(1);
            AtomicReference<String> bindResult = new AtomicReference<>("");
            AtomicReference<String> created = new AtomicReference<>("");
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                Future<?> bind = executor.submit(() -> {
                    try {
                        start.await();
                        plugin.bindScanEntryRecord(oldest, sessionId, "TETM", DEVICE, "start");
                        bindResult.set("bound");
                    } catch (VaultFailure error) {
                        bindResult.set(error.code);
                    } catch (InterruptedException error) {
                        Thread.currentThread().interrupt();
                        throw new AssertionError(error);
                    }
                });
                Future<?> create = executor.submit(() -> {
                    try {
                        start.await();
                        created.set(String.valueOf(plugin.createScanEntry(
                            "https://example.test/?code=TETM", "native-nfc"
                        ).get("entry_id")));
                    } catch (Exception error) {
                        throw new AssertionError(error);
                    }
                });
                start.countDown();
                bind.get(10, TimeUnit.SECONDS);
                create.get(10, TimeUnit.SECONDS);
            } finally {
                executor.shutdownNow();
            }
            assertFalse(created.get().isEmpty());
            if (bindResult.get().equals("bound")) {
                assertEquals(sessionId, plugin.requireScanEntry(oldest).get("client_session_id"));
            } else {
                assertEquals("custodial_native_scan_entry_missing", bindResult.get());
                try {
                    plugin.requireScanEntry(oldest);
                    fail("An entry reported missing by an atomic bind must remain absent.");
                } catch (VaultFailure error) {
                    assertEquals("custodial_native_scan_entry_missing", error.code);
                }
            }
        }
    }

    @Test
    public void adversarialDirectBridgeActivationRetainsExactSafeReconciliationProof() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = stagedEngine(persistence, transport, clock);
        CustodialNativeVaultPlugin plugin = new CustodialNativeVaultPlugin(
            engine,
            new CancellationCoordinator(engine, (operationId, deviceId) -> false),
            new RemovalCoordinator(engine, (operationId, deviceId) -> false)
        );
        BridgeSmokeActivity.install(plugin);
        try (ActivityScenario<BridgeSmokeActivity> scenario = ActivityScenario.launch(BridgeSmokeActivity.class)) {
            AtomicReference<BridgeSmokeActivity> activity = new AtomicReference<>();
            scenario.onActivity(activity::set);
            assertEquals("READY", waitForJavascriptValue(
                activity.get(),
                "typeof window.Capacitor !== 'undefined' && !!window.Capacitor.Plugins.CustodialNativeVault ? 'READY' : 'WAIT'",
                "WAIT",
                50
            ));
            evaluateJavascript(activity.get(), """
                window.__vaultActivationResult = 'PENDING';
                (async () => {
                  try {
                    const plugin = window.Capacitor.Plugins.CustodialNativeVault;
                    const bound = await plugin.completeLocalBinding({
                      operation_id: '11111111-1111-4111-8111-111111111111'
                    });
                    const activated = await plugin.confirmEnrollment({
                      operation_id: '11111111-1111-4111-8111-111111111111'
                    });
                    const state = await plugin.getState();
                    window.__vaultActivationResult = JSON.stringify({ bound, activated, state });
                  } catch (error) {
                    window.__vaultActivationResult = JSON.stringify({ error: {
                      code: error && error.code,
                      message: error && error.message,
                      data: error && error.data
                    }});
                  }
                })();
                'STARTED';
                """);
            String serialized = waitForJavascriptValue(
                activity.get(),
                "window.__vaultActivationResult || ''",
                "PENDING",
                100
            );
            JSONObject result = new JSONObject(serialized);
            assertFalse(result.has("error"));
            assertEquals("PENDING_SERVER_CONFIRMATION", result.getJSONObject("bound").getString("state"));
            assertEquals("ACTIVE", result.getJSONObject("activated").getString("state"));
            JSONObject state = result.getJSONObject("state");
            assertEquals("ACTIVE", state.getString("state"));
            assertEquals("enrollment", state.getString("active_enrollment_flow"));
            assertEquals("", state.getString("pending_operation_id"));
            JSONObject installation = state.getJSONObject("installation");
            assertEquals(OP, installation.getString("enrollment_operation_id"));
            assertEquals(DEVICE, installation.getString("device_id"));
            assertFalse(serialized.contains(InstrumentedTransport.CREDENTIAL));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("device_credential"));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("ciphertext"));
        }
    }

    private static String evaluateJavascript(BridgeSmokeActivity activity, String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("null");
        activity.runOnUiThread(() -> activity.getBridge().getWebView().evaluateJavascript(script, value -> {
            result.set(value);
            complete.countDown();
        }));
        assertTrue(complete.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private static void clickWhenVisible(String label) throws Exception {
        RuntimeException latest = null;
        for (int attempt = 0; attempt < 50; attempt += 1) {
            try {
                onView(withText(label)).perform(click());
                return;
            } catch (RuntimeException error) {
                latest = error;
                Thread.sleep(100);
            }
        }
        if (latest != null) throw latest;
        throw new AssertionError("Native confirmation did not appear: " + label);
    }

    private static String unwrapEvaluation(String encoded) throws Exception {
        Object value = new JSONTokener(encoded == null ? "null" : encoded).nextValue();
        return value == null || value == JSONObject.NULL ? "" : String.valueOf(value);
    }

    private static String waitForJavascriptValue(
        BridgeSmokeActivity activity,
        String expression,
        String pendingValue,
        int attempts
    ) throws Exception {
        String value = "";
        for (int attempt = 0; attempt < attempts; attempt += 1) {
            value = unwrapEvaluation(evaluateJavascript(activity, expression));
            if (!value.isEmpty() && !value.equals(pendingValue)) return value;
            Thread.sleep(100);
        }
        return value;
    }

    private VaultEngine activeEngine(
        SharedPreferencesVaultPersistence persistence,
        InstrumentedTransport transport,
        VaultClock clock
    ) throws Exception {
        VaultEngine engine = stagedEngine(persistence, transport, clock);
        engine.completeLocalBinding(OP);
        engine.confirmEnrollment(OP);
        return engine;
    }

    private VaultEngine stagedEngine(
        SharedPreferencesVaultPersistence persistence,
        InstrumentedTransport transport,
        VaultClock clock
    ) throws Exception {
        VaultEngine engine = bareEngine(persistence, transport, clock);
        engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
        return engine;
    }

    private VaultEngine bareEngine(
        SharedPreferencesVaultPersistence persistence,
        InstrumentedTransport transport,
        VaultClock clock
    ) {
        return new VaultEngine(
            persistence,
            new AndroidKeystoreCipher(),
            transport,
            new LegacyVaultSource() {
                @Override public LegacyMaterial read() { return null; }
                @Override public void cleanup() {}
                @Override public boolean isClean() { return true; }
            },
            () -> "native-instrumented-installation-seal",
            clock
        );
    }

    private String rawSnapshot() {
        return context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE)
            .getString("authoritative_snapshot", "");
    }

    private static String legacyInstallationRecord(String credential) throws Exception {
        JSONObject record = new JSONObject();
        record.put("schema_version", 1);
        record.put("credential", credential);
        record.put("device_id", DEVICE);
        record.put("installation_seal", LEGACY_SEAL);
        record.put("enrolled_at", "2026-08-01T01:00:00.000Z");
        record.put("migrated_from_credential_only_state", true);
        return record.toString();
    }

    private void clearRuntimeVault() throws Exception {
        context.getSharedPreferences("MemphisZooCustodialNativeVaultV2", Context.MODE_PRIVATE).edit().clear().commit();
        context.getSharedPreferences("MemphisZooCustodialNativeVaultV1", Context.MODE_PRIVATE).edit().clear().commit();
        context.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1", Context.MODE_PRIVATE).edit().clear().commit();
        context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE).edit().clear().commit();
        new AndroidKeystoreCipher().destroyKey();
        KeyStore store = androidKeyStore();
        for (String alias : new String[] {
            LEGACY_V1_ALIAS,
            LEGACY_RECORD_ALIAS,
            LEGACY_CREDENTIAL_ALIAS,
            LEGACY_SEAL_ALIAS
        }) {
            if (store.containsAlias(alias)) store.deleteEntry(alias);
        }
    }

    private void writeLegacySecureValue(String alias, String value) throws Exception {
        KeyStore store = androidKeyStore();
        if (store.containsAlias(alias)) store.deleteEntry(alias);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        SecretKey key = generator.generateKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] clear = JSONObject.quote(value).getBytes(StandardCharsets.UTF_8);
        byte[] encrypted = null;
        try {
            encrypted = cipher.doFinal(clear);
            String stored = Base64.encodeToString(encrypted, Base64.NO_PADDING | Base64.NO_WRAP)
                + '\u0010'
                + Base64.encodeToString(cipher.getIV(), Base64.NO_PADDING | Base64.NO_WRAP);
            assertTrue(context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(alias, stored)
                .commit());
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
        }
    }

    private static KeyStore androidKeyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    private static final class MutableRuntimeMonotonicClock implements OfflineAuthorityTime.MonotonicClock {
        private long elapsed;
        private int boot;

        MutableRuntimeMonotonicClock(long elapsed, int boot) {
            this.elapsed = elapsed;
            this.boot = boot;
        }

        @Override public long now() { return elapsed; }
        @Override public int bootCount() { return boot; }
    }

    /** Delegates real disk writes while injecting one exact commit boundary. */
    private static final class FaultInjectingSharedPreferences implements SharedPreferences {
        private final SharedPreferences delegate;
        private final int failingCommit;
        private final boolean writeBeforeFailure;
        private int commitCount;

        FaultInjectingSharedPreferences(
            SharedPreferences delegate,
            int failingCommit,
            boolean writeBeforeFailure
        ) {
            this.delegate = delegate;
            this.failingCommit = failingCommit;
            this.writeBeforeFailure = writeBeforeFailure;
        }

        @Override public Map<String, ?> getAll() { return delegate.getAll(); }
        @Override public String getString(String key, String fallback) { return delegate.getString(key, fallback); }
        @Override public Set<String> getStringSet(String key, Set<String> fallback) {
            return delegate.getStringSet(key, fallback);
        }
        @Override public int getInt(String key, int fallback) { return delegate.getInt(key, fallback); }
        @Override public long getLong(String key, long fallback) { return delegate.getLong(key, fallback); }
        @Override public float getFloat(String key, float fallback) { return delegate.getFloat(key, fallback); }
        @Override public boolean getBoolean(String key, boolean fallback) { return delegate.getBoolean(key, fallback); }
        @Override public boolean contains(String key) { return delegate.contains(key); }
        @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
            delegate.registerOnSharedPreferenceChangeListener(listener);
        }
        @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
            delegate.unregisterOnSharedPreferenceChangeListener(listener);
        }

        @Override
        public Editor edit() {
            return new FaultInjectingEditor(delegate.edit());
        }

        private final class FaultInjectingEditor implements Editor {
            private final Editor delegateEditor;

            FaultInjectingEditor(Editor delegateEditor) {
                this.delegateEditor = delegateEditor;
            }

            @Override public Editor putString(String key, String value) {
                delegateEditor.putString(key, value);
                return this;
            }
            @Override public Editor putStringSet(String key, Set<String> values) {
                delegateEditor.putStringSet(key, values);
                return this;
            }
            @Override public Editor putInt(String key, int value) {
                delegateEditor.putInt(key, value);
                return this;
            }
            @Override public Editor putLong(String key, long value) {
                delegateEditor.putLong(key, value);
                return this;
            }
            @Override public Editor putFloat(String key, float value) {
                delegateEditor.putFloat(key, value);
                return this;
            }
            @Override public Editor putBoolean(String key, boolean value) {
                delegateEditor.putBoolean(key, value);
                return this;
            }
            @Override public Editor remove(String key) {
                delegateEditor.remove(key);
                return this;
            }
            @Override public Editor clear() {
                delegateEditor.clear();
                return this;
            }
            @Override public void apply() { delegateEditor.apply(); }

            @Override
            public boolean commit() {
                commitCount += 1;
                if (commitCount != failingCommit) return delegateEditor.commit();
                if (writeBeforeFailure) delegateEditor.commit();
                return false;
            }
        }
    }
}
