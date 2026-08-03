package org.memphiszoo.manager.vault;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
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
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
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
    private static final String DEVICE = "ops-app-11111111-1111-4111-8111-111111111111";
    private static final String LEGACY_SECURE_PREFERENCES = "WSSecureStorageSharedPreferences";
    private static final String LEGACY_CREDENTIAL_ALIAS = "capacitor-storage_memphis_zoo_ops_device_credential";
    private static final String LEGACY_SEAL_ALIAS = "capacitor-storage_memphis_zoo_ops_installation_seal";
    private static final String LEGACY_RECORD_ALIAS = "capacitor-storage_memphis_zoo_ops_installation_record_v1";
    private static final String LEGACY_V1_ALIAS = "org.memphiszoo.manager.native-vault.v1";
    private static final String LEGACY_SEAL = "legacy-instrumented-installation-seal-0002";
    private Context context;

    @Before
    public void setUp() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        SharedPreferencesRecoveryJournal.resetProcessPoisonForTests();
        SharedPreferencesManagerV2OperationPersistence.resetProcessPoisonForTests();
        clearRuntimeVault();
    }

    @After
    public void tearDown() throws Exception {
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        SharedPreferencesRecoveryJournal.resetProcessPoisonForTests();
        SharedPreferencesManagerV2OperationPersistence.resetProcessPoisonForTests();
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
        SharedPreferences raw = context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE);
        assertEquals(1, raw.getAll().size());
        assertFalse(String.valueOf(raw.getAll()).contains(InstrumentedTransport.CREDENTIAL));
    }

    @Test
    public void compiledInstrumentationManifestProvidesExactPlayIntegrityProjectMetadata() throws Exception {
        Context testApplication = InstrumentationRegistry.getInstrumentation().getContext();
        assertEquals(
            123456789012L,
            PlayIntegrityConfiguration.fromApplication(testApplication).cloudProjectNumber
        );
    }

    @Test
    public void managerV2ProofKeysAreNonExportableAndDurableAcrossAdapterRecreation() throws Exception {
        SharedPreferencesManagerV2OperationPersistence persistence =
            new SharedPreferencesManagerV2OperationPersistence(context);
        AndroidManagerV2KeyRing keyRing = new AndroidManagerV2KeyRing();
        ManagerV2KeyCoordinator coordinator = new ManagerV2KeyCoordinator(
            persistence,
            keyRing,
            () -> 1_785_661_200_000L
        );
        ManagerV2OperationRecord ready;
        try {
            ready = coordinator.prepare(OP);
        } catch (VaultFailure error) {
            assertManagedDeviceHardwareRefusal(error);
            return;
        }
        assertEquals(ManagerV2KeyPhase.READY, ready.phase);
        assertEquals(ready.signingKeyId, ManagerV2WireContract.thumbprint(keyRing.signingPublicKey(OP)));
        assertEquals(ready.wrappingKeyId, ManagerV2WireContract.thumbprint(keyRing.wrappingPublicKey(OP)));

        KeyStore store = androidKeyStore();
        PrivateKey signingPrivate = (PrivateKey) store.getKey(AndroidManagerV2KeyRing.SIGNING_PREFIX + OP, null);
        PrivateKey wrappingPrivate = (PrivateKey) store.getKey(AndroidManagerV2KeyRing.WRAPPING_PREFIX + OP, null);
        assertNotNull(signingPrivate);
        assertNotNull(wrappingPrivate);
        assertEquals("EC", signingPrivate.getAlgorithm());
        assertEquals("EC", wrappingPrivate.getAlgorithm());
        assertEquals(null, signingPrivate.getEncoded());
        assertEquals(null, wrappingPrivate.getEncoded());

        byte[] proofInput = ManagerV2WireContract.proofInput(
            "POST",
            "/manager-device-auth/v2/enrollment-operations",
            OP,
            1_785_661_200L,
            ManagerV2WireContract.base64url(new byte[16]),
            "a".repeat(64)
        );
        byte[] proof = keyRing.sign(OP, proofInput);
        assertEquals(64, proof.length);
        assertTrue(ManagerV2WireContract.verifyP1363(keyRing.signingPublicKey(OP), proofInput, proof));

        ManagerV2OperationRecord restored = new ManagerV2KeyCoordinator(
            new SharedPreferencesManagerV2OperationPersistence(context),
            new AndroidManagerV2KeyRing(),
            () -> 1_785_661_999_000L
        ).prepare(OP);
        assertEquals(ready, restored);
        String raw = String.valueOf(context.getSharedPreferences(
            SharedPreferencesManagerV2OperationPersistence.PREFERENCES,
            Context.MODE_PRIVATE
        ).getAll());
        assertFalse(raw.contains("credential"));
        assertFalse(raw.contains("private"));
        assertFalse(raw.contains("secret"));
    }

    @Test
    public void managerV2WrappingKeyDecryptsOnlyTheExactlyBoundDeviceEnvelope() throws Exception {
        AndroidManagerV2KeyRing keyRing = new AndroidManagerV2KeyRing();
        ManagerV2OperationRecord ready;
        try {
            ready = new ManagerV2KeyCoordinator(
                new SharedPreferencesManagerV2OperationPersistence(context),
                keyRing,
                () -> 1_785_661_200_000L
            ).prepare(OP);
        } catch (VaultFailure error) {
            assertManagedDeviceHardwareRefusal(error);
            return;
        }

        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair ephemeral = generator.generateKeyPair();
        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(ephemeral.getPrivate());
        agreement.doPhase(keyRing.wrappingPublicKey(OP), true);
        byte[] shared = agreement.generateSecret();
        byte[] salt = new byte[32];
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(salt);
        new SecureRandom().nextBytes(iv);
        byte[] key = ManagerV2WireContract.hkdf(
            shared,
            salt,
            ManagerV2WireContract.envelopeInfo(OP, ready.wrappingKeyId),
            32
        );
        Map<String, String> binding = Map.of(
            "operation_id", OP,
            "credential_id", "22222222-2222-4222-8222-222222222222",
            "device_id", DEVICE,
            "manager_id", "55555555-5555-4555-8555-555555555555",
            "credential_expires_at", "2026-08-03T07:00:00.000Z",
            "resume_expires_at", "2026-08-02T07:10:00.000Z",
            "wrapping_key_id", ready.wrappingKeyId,
            "ephemeral_key_id", ManagerV2WireContract.thumbprint(ephemeral.getPublic()),
            "salt", ManagerV2WireContract.base64url(salt),
            "iv", ManagerV2WireContract.base64url(iv)
        );
        byte[] aad = ManagerV2WireContract.envelopeAad(binding);
        byte[] plaintext = "{\"credential\":\"device-only-secret\"}".getBytes(StandardCharsets.UTF_8);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        cipher.updateAAD(aad);
        byte[] encrypted = cipher.doFinal(plaintext);
        byte[] ciphertext = Arrays.copyOf(encrypted, encrypted.length - 16);
        byte[] tag = Arrays.copyOfRange(encrypted, encrypted.length - 16, encrypted.length);

        byte[] clear = keyRing.decryptEnvelope(
            OP,
            ephemeral.getPublic(),
            ready.wrappingKeyId,
            salt,
            iv,
            ciphertext,
            tag,
            aad
        );
        assertTrue(Arrays.equals(plaintext, clear));
        byte[] wrongAad = aad.clone();
        wrongAad[wrongAad.length - 1] ^= 1;
        try {
            keyRing.decryptEnvelope(
                OP,
                ephemeral.getPublic(),
                ready.wrappingKeyId,
                salt,
                iv,
                ciphertext,
                tag,
                wrongAad
            );
            fail("Expected authenticated binding failure");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_envelope_authentication_failed", error.code);
        } finally {
            Arrays.fill(shared, (byte) 0);
            Arrays.fill(key, (byte) 0);
            Arrays.fill(plaintext, (byte) 0);
            Arrays.fill(encrypted, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            Arrays.fill(tag, (byte) 0);
            Arrays.fill(clear, (byte) 0);
        }
    }

    @Test
    public void managerV2ConcurrentAdapterInstancesRecoverOneDurableKeyPair() throws Exception {
        if (!managedDeviceHardwareKeysAvailable()) return;
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(8);
        List<Future<ManagerV2OperationRecord>> attempts = new ArrayList<>();
        try {
            for (int index = 0; index < 16; index += 1) {
                attempts.add(executor.submit(() -> {
                    start.await(10, TimeUnit.SECONDS);
                    try {
                        return new ManagerV2KeyCoordinator(
                            new SharedPreferencesManagerV2OperationPersistence(context),
                            new AndroidManagerV2KeyRing(),
                            () -> 1_785_661_200_000L
                        ).prepare(OP);
                    } catch (VaultFailure error) {
                        if (!"manager_v2_operation_concurrent_change".equals(error.code)) throw error;
                        return null;
                    }
                }));
            }
            start.countDown();
            for (Future<ManagerV2OperationRecord> attempt : attempts) attempt.get(30, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }

        ManagerV2OperationRecord ready = new ManagerV2KeyCoordinator(
            new SharedPreferencesManagerV2OperationPersistence(context),
            new AndroidManagerV2KeyRing(),
            () -> 1_785_661_999_000L
        ).prepare(OP);
        assertEquals(ManagerV2KeyPhase.READY, ready.phase);
        KeyStore store = androidKeyStore();
        assertTrue(store.containsAlias(AndroidManagerV2KeyRing.SIGNING_PREFIX + OP));
        assertTrue(store.containsAlias(AndroidManagerV2KeyRing.WRAPPING_PREFIX + OP));
        assertEquals(ready.signingKeyId, ManagerV2WireContract.thumbprint(
            store.getCertificate(AndroidManagerV2KeyRing.SIGNING_PREFIX + OP).getPublicKey()
        ));
        assertEquals(ready.wrappingKeyId, ManagerV2WireContract.thumbprint(
            store.getCertificate(AndroidManagerV2KeyRing.WRAPPING_PREFIX + OP).getPublicKey()
        ));
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
                assertEquals("manager_native_removal_cancelled", ((VaultFailure) error.getCause()).code);
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
                assertEquals("manager_native_cancellation_cancelled", ((VaultFailure) error.getCause()).code);
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
    public void actualSecureStorageCredentialOnlyMigrationCleansSourceAndRequiresV2Replacement() throws Exception {
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

        try {
            engine.enroll(OP, DEVICE, "recovery", "12345678".toCharArray());
            fail("Expected explicit replacement requirement");
        } catch (VaultFailure error) {
            assertEquals("manager_native_replacement_required", error.code);
        }
        engine.enroll(OP, DEVICE, "replacement", "12345678".toCharArray());
        engine.completeLocalBinding(OP);
        Map<String, Object> active = engine.confirmEnrollment(OP);
        assertEquals("ACTIVE", active.get("state"));
        Map<?, ?> installation = (Map<?, ?>) active.get("installation");
        assertEquals(DEVICE, installation.get("device_id"));
        assertFalse(LEGACY_SEAL.equals(installation.get("installation_seal")));
        assertFalse((Boolean) installation.get("migrated_from_credential_only_state"));
        assertEquals(1, context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE).getAll().size());
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

        Map<String, Object> pending = engine.getState();
        assertEquals("LEGACY_PENDING", pending.get("state"));
        assertEquals(DEVICE, pending.get("pending_device_id"));
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
            assertEquals("manager_native_legacy_vault_mismatch", error.code);
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
            assertEquals("manager_native_legacy_vault_invalid", error.code);
        }
        assertEquals(VaultPhase.BLOCKED, persistence.load().phase);
        SharedPreferences old = context.getSharedPreferences(LEGACY_SECURE_PREFERENCES, Context.MODE_PRIVATE);
        assertTrue(old.contains(LEGACY_SEAL_ALIAS));
        assertTrue(androidKeyStore().containsAlias(LEGACY_SEAL_ALIAS));
    }

    @Test
    public void sharedPreferencesMemoryUpdateWithFailedDiskCommitPoisonsProcessAndRestartsFromDispatched() throws Exception {
        SharedPreferences raw = context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 3, false, true);
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec());
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = bareEngine(persistence, transport, clock);

        try {
            engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
            fail("Expected the injected SharedPreferences commit failure");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_commit_uncertain", error.code);
        }

        try {
            persistence.load();
            fail("An uncertain in-process SharedPreferences image must be poisoned");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load();
            fail("A fresh adapter in the same process must remain poisoned");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_persistence_uncertain", error.code);
        }
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
        SharedPreferencesVaultPersistence restartedPersistence =
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        assertEquals("ENROLLMENT_DISPATCHED", restartedPersistence.load().phase.name());
        assertEquals(1, transport.issuanceCount.get());
        assertEquals(0, transport.cancelCalls.get());

        Map<String, Object> cancelled = bareEngine(
            restartedPersistence, transport, clock
        ).cancelEnrollment(OP);
        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(1, transport.issuanceCount.get());
        assertEquals(1, transport.cancelCalls.get());
        assertEquals(0, transport.activeCredentials());
    }

    @Test
    public void initialMemoryOnlyCommitFailureCannotDispatchBeforeProcessDeath() throws Exception {
        SharedPreferences raw = context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 1, false, true);
        SharedPreferencesVaultPersistence persistence =
            new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec());
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);

        try {
            bareEngine(persistence, transport, clock).enroll(
                OP, DEVICE, "enrollment", "12345678".toCharArray()
            );
            fail("Expected initial commit uncertainty");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_commit_uncertain", error.code);
        }

        assertEquals(0, transport.enrollCalls.get());
        assertEquals(0, transport.issuanceCount.get());
        try {
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load();
            fail("Same-process adapter recreation must remain poisoned");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_persistence_uncertain", error.code);
        }
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
        assertEquals(
            "EMPTY",
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec()).load().phase.name()
        );
    }

    @Test
    public void durableWriteReportedFailedIsNeverAcceptedUntilAdapterRecreation() throws Exception {
        SharedPreferences raw = context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE);
        SharedPreferences failing = new FaultInjectingSharedPreferences(raw, 3, true);
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(failing, new VaultSnapshotCodec());
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = bareEngine(persistence, transport, clock);

        try {
            engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray());
            fail("Expected uncertain commit even though the injected adapter wrote first");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_commit_uncertain", error.code);
        }

        try {
            persistence.load();
            fail("Poisoned adapter must refuse its own memory readback");
        } catch (VaultFailure error) {
            assertEquals("manager_native_vault_persistence_uncertain", error.code);
        }
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
        SharedPreferencesVaultPersistence restarted =
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        assertEquals("CREDENTIAL_STAGED", restarted.load().phase.name());
        assertEquals("CREDENTIAL_STAGED", bareEngine(restarted, transport, clock).resumeEnrollment(OP).phase.name());
        assertEquals(1, transport.issuanceCount.get());
        assertEquals(0, transport.cancelCalls.get());
        assertEquals(1, transport.activeCredentials());
    }

    @Test
    public void stagedServerCredentialCanBeCancelledAfterLocalAesKeyDestruction() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence =
            new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = stagedEngine(persistence, transport, clock);
        androidKeyStore().deleteEntry(AndroidKeystoreCipher.KEY_ALIAS);

        Map<String, Object> cancelled = engine.cancelEnrollment(OP);

        assertEquals("CANCELLED", cancelled.get("state"));
        assertEquals(1, transport.cancelCalls.get());
        assertEquals(0, transport.activeCredentials());
        assertEquals("CANCELLED", persistence.load().phase.name());
    }

    @Test
    public void actualFinalizeCommitFailureKeepsExactTombstoneAndRestartCompletesIdempotently() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferences raw = context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE);
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
            assertEquals("manager_native_vault_commit_uncertain", error.code);
        }
        SharedPreferencesVaultPersistence.resetProcessPoisonForTests();
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
            assertEquals("manager_native_removal_not_complete", error.code);
        }
    }

    @Test
    public void authorizedSessionJournalIsRestartSafeAtEverySharedPreferencesBoundary() throws Exception {
        SharedPreferences raw = context.getSharedPreferences(
            SharedPreferencesAuthorizedSessionOperationJournal.PREFERENCES,
            Context.MODE_PRIVATE
        );
        long now = System.currentTimeMillis();
        SharedPreferencesAuthorizedSessionOperationJournal durable =
            new SharedPreferencesAuthorizedSessionOperationJournal(raw);
        SessionOperationRecord first = durable.acquire(OP, DEVICE, now);
        assertEquals(
            first.operationId,
            new SharedPreferencesAuthorizedSessionOperationJournal(context).acquire(OP, DEVICE, now + 1L).operationId
        );

        SharedPreferences failDelete = new FaultInjectingSharedPreferences(raw, 1, false);
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(failDelete).complete(first.operationId);
            fail("Expected journal delete commit failure");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(context).load();
            fail("Same-process journal reads must fail closed after an uncertain commit");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        assertEquals(first.operationId, new SharedPreferencesAuthorizedSessionOperationJournal(context).load().operationId);

        SharedPreferences writeThenFailDelete = new FaultInjectingSharedPreferences(raw, 1, true);
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(writeThenFailDelete).complete(first.operationId);
            fail("Expected journal delete readback failure");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(context).load();
            fail("Same-process deleted journal image must not become authority");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        assertEquals(null, new SharedPreferencesAuthorizedSessionOperationJournal(context).load());

        SharedPreferences failWrite = new FaultInjectingSharedPreferences(raw, 1, false);
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(failWrite).acquire(OP, DEVICE, now + 2L);
            fail("Expected journal creation commit failure");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        assertEquals(null, new SharedPreferencesAuthorizedSessionOperationJournal(context).load());

        SharedPreferences memoryUpdatedDiskOldCreate = new FaultInjectingSharedPreferences(raw, 1, false, true);
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(memoryUpdatedDiskOldCreate).acquire(OP, DEVICE, now + 3L);
            fail("Expected memory-updated/disk-old journal creation failure");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesAuthorizedSessionOperationJournal(context).acquire(OP, DEVICE, now + 4L);
            fail("Same-process retry must not dispatch with a journal UUID that never reached disk");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_session_journal_persistence_uncertain", error.code);
        }
        SharedPreferencesAuthorizedSessionOperationJournal.resetProcessPoisonForTests();
        assertEquals(null, new SharedPreferencesAuthorizedSessionOperationJournal(context).load());
        SessionOperationRecord restarted = new SharedPreferencesAuthorizedSessionOperationJournal(context)
            .acquire(OP, DEVICE, now + 5L);
        assertNotNull(restarted);
        assertEquals(restarted.operationId, new SharedPreferencesAuthorizedSessionOperationJournal(context)
            .acquire(OP, DEVICE, now + 6L).operationId);
    }

    @Test
    public void everyAuthoritativeSharedPreferencesStorePoisonsMemoryUpdatedDiskOldCommits() throws Exception {
        SharedPreferences operationRaw = context.getSharedPreferences(
            SharedPreferencesManagerV2OperationPersistence.PREFERENCES,
            Context.MODE_PRIVATE
        );
        ManagerV2KeyRegistry empty = ManagerV2KeyRegistry.empty();
        ManagerV2KeyRegistry next = empty.next(null, null, null);
        SharedPreferences operationFault = new FaultInjectingSharedPreferences(
            operationRaw, 1, false, true
        );
        try {
            new SharedPreferencesManagerV2OperationPersistence(operationFault).commit(0, next);
            fail("Expected operation-registry memory-updated/disk-old refusal");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_operation_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesManagerV2OperationPersistence(context).load();
            fail("Same-process operation-registry read must fail closed");
        } catch (VaultFailure error) {
            assertEquals("manager_v2_operation_persistence_uncertain", error.code);
        }
        SharedPreferencesManagerV2OperationPersistence.resetProcessPoisonForTests();
        assertEquals(0L, new SharedPreferencesManagerV2OperationPersistence(context).load().revision);

        VaultSnapshot priorActive = new VaultSnapshot(
            1,
            VaultPhase.ACTIVE,
            SecretKind.DEVICE_CREDENTIAL,
            new EncryptedSecret("Y2lwaGVydGV4dA==", "aW5pdC12ZWN0b3I="),
            OP,
            DEVICE,
            "enrollment",
            0,
            new InstallationBinding(
                DEVICE,
                "native-instrumented-recovery-seal",
                Instant.ofEpochMilli(System.currentTimeMillis()).toString(),
                false,
                OP
            ),
            EnrollmentMetadata.empty(),
            "",
            "",
            false,
            ""
        );
        SharedPreferences recoveryRaw = context.getSharedPreferences(
            SharedPreferencesRecoveryJournal.PREFERENCES,
            Context.MODE_PRIVATE
        );
        SharedPreferences recoveryFault = new FaultInjectingSharedPreferences(
            recoveryRaw, 1, false, true
        );
        try {
            new SharedPreferencesRecoveryJournal(recoveryFault, new VaultSnapshotCodec()).save(
                new RecoveryRecord(REMOVE, priorActive)
            );
            fail("Expected recovery-journal memory-updated/disk-old refusal");
        } catch (VaultFailure error) {
            assertEquals("manager_native_recovery_journal_persistence_uncertain", error.code);
        }
        try {
            new SharedPreferencesRecoveryJournal(context, new VaultSnapshotCodec()).load();
            fail("Same-process recovery-journal read must fail closed");
        } catch (VaultFailure error) {
            assertEquals("manager_native_recovery_journal_persistence_uncertain", error.code);
        }
        SharedPreferencesRecoveryJournal.resetProcessPoisonForTests();
        assertEquals(null, new SharedPreferencesRecoveryJournal(context, new VaultSnapshotCodec()).load());
    }

    @Test
    public void capacitorCallAndResultSerializationExposeNoCredential() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = activeEngine(persistence, transport, clock);
        JSObject options = new JSObject();
        options.put("path", "/messaging-api/health");
        options.put("method", "GET");
        options.put("headers", new JSObject());
        options.put("body_base64", "");
        PluginCall call = new PluginCall(null, "ManagerNativeVault", "runtime-test", "authorizedRequest", options);
        AuthorizedResponse response = engine.authorizedRequest(
            DEVICE,
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
        ManagerNativeVaultPlugin plugin = new ManagerNativeVaultPlugin(
            engine,
            new CancellationCoordinator(engine, (operationId, deviceId) -> false),
            new RemovalCoordinator(engine, (operationId, deviceId) -> false)
        );
        BridgeSmokeActivity.install(plugin);
        try (ActivityScenario<BridgeSmokeActivity> scenario = ActivityScenario.launch(BridgeSmokeActivity.class)) {
            AtomicReference<BridgeSmokeActivity> activity = new AtomicReference<>();
            scenario.onActivity(activity::set);
            String readiness = "";
            for (int attempt = 0; attempt < 50; attempt += 1) {
                readiness = unwrapEvaluation(evaluateJavascript(
                    activity.get(),
                    "typeof window.Capacitor !== 'undefined' && !!window.Capacitor.Plugins.ManagerNativeVault ? 'READY' : 'WAIT'"
                ));
                if (readiness.equals("READY")) break;
                Thread.sleep(100);
            }
            assertEquals("READY", readiness);
            evaluateJavascript(activity.get(), """
                window.__vaultSmokeResult = 'PENDING';
                (async () => {
                  try {
                    const plugin = window.Capacitor.Plugins.ManagerNativeVault;
                    const authorized = await plugin.authorizedRequest({
                      path: '/messaging-api/health',
                      method: 'GET',
                      device_id: 'ops-app-22222222-2222-4222-8222-222222222222',
                      headers: {},
                      body_base64: ''
                    });
                    const state = await plugin.getStatus();
                    window.__vaultSmokeResult = JSON.stringify({ authorized, state });
                  } catch (error) {
                    window.__vaultSmokeResult = JSON.stringify({ error: {
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
                serialized = unwrapEvaluation(evaluateJavascript(activity.get(), "window.__vaultSmokeResult || ''"));
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
            assertTrue(new JSONObject(clearBody).getBoolean("ok"));
            JSONObject state = result.getJSONObject("state");
            assertTrue(state.getBoolean("active"));
            assertEquals(DEVICE, state.getString("device_id"));
            assertFalse(state.has("credential_present"));
            assertFalse(state.has("installation"));
            assertFalse(state.has("legacy_seal"));
            assertFalse(serialized.contains(InstrumentedTransport.CREDENTIAL));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("device_credential"));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("enrollment_code"));
            assertFalse(serialized.toLowerCase(java.util.Locale.ROOT).contains("ciphertext"));
        }
    }

    @Test
    public void adversarialDirectBridgeCannotInvokeInternalTransitionSteps() throws Exception {
        VaultClock clock = System::currentTimeMillis;
        SharedPreferencesVaultPersistence persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        VaultEngine engine = stagedEngine(persistence, transport, clock);
        ManagerNativeVaultPlugin plugin = new ManagerNativeVaultPlugin(
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
                "typeof window.Capacitor !== 'undefined' && !!window.Capacitor.Plugins.ManagerNativeVault ? 'READY' : 'WAIT'",
                "WAIT",
                50
            ));
            evaluateJavascript(activity.get(), """
                window.__vaultActivationResult = 'PENDING';
                (async () => {
                  const plugin = window.Capacitor.Plugins.ManagerNativeVault;
                  const invoke = (name) => typeof plugin[name] === 'function'
                    ? plugin[name]({ operation_id: '11111111-1111-4111-8111-111111111111' })
                    : Promise.reject(new Error(name + ' unavailable'));
                  const bound = await Promise.allSettled([
                    invoke('completeLocalBinding'),
                    invoke('confirmEnrollment')
                  ]);
                  const state = await plugin.getStatus();
                  window.__vaultActivationResult = JSON.stringify({
                    rejected: bound.map((entry) => entry.status),
                    state
                  });
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
            assertEquals("rejected", result.getJSONArray("rejected").getString(0));
            assertEquals("rejected", result.getJSONArray("rejected").getString(1));
            JSONObject state = result.getJSONObject("state");
            assertEquals("ENROLLING", state.getString("state"));
            assertEquals("enroll", state.getString("pending_flow"));
            assertFalse(state.getBoolean("active"));
            assertEquals(OP, state.getString("pending_operation_id"));
            assertEquals(DEVICE, state.getString("device_id"));
            assertFalse(state.has("installation"));
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

    private boolean managedDeviceHardwareKeysAvailable() throws Exception {
        AndroidManagerV2KeyRing keys = new AndroidManagerV2KeyRing();
        try {
            new ManagerV2KeyCoordinator(
                new SharedPreferencesManagerV2OperationPersistence(context),
                keys,
                () -> 1_785_661_200_000L
            ).prepare(OP);
            keys.destroy(OP);
            context.getSharedPreferences(
                SharedPreferencesManagerV2OperationPersistence.PREFERENCES,
                Context.MODE_PRIVATE
            ).edit().clear().commit();
            return true;
        } catch (VaultFailure error) {
            assertManagedDeviceHardwareRefusal(error);
            return false;
        }
    }

    private void assertManagedDeviceHardwareRefusal(VaultFailure error) throws Exception {
        assertEquals("native_security_capability_required", error.code);
        KeyStore store = androidKeyStore();
        assertFalse(store.containsAlias(AndroidManagerV2KeyRing.SIGNING_PREFIX + OP));
        assertFalse(store.containsAlias(AndroidManagerV2KeyRing.WRAPPING_PREFIX + OP));
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
        return context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE)
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
        context.getSharedPreferences("MemphisZooManagerNativeVaultV2", Context.MODE_PRIVATE).edit().clear().commit();
        context.getSharedPreferences("MemphisZooManagerNativeVaultV1", Context.MODE_PRIVATE).edit().clear().commit();
        context.getSharedPreferences(
            SharedPreferencesManagerV2OperationPersistence.PREFERENCES,
            Context.MODE_PRIVATE
        ).edit().clear().commit();
        context.getSharedPreferences(
            SharedPreferencesAuthorizedSessionOperationJournal.PREFERENCES,
            Context.MODE_PRIVATE
        ).edit().clear().commit();
        context.getSharedPreferences(
            SharedPreferencesRecoveryJournal.PREFERENCES,
            Context.MODE_PRIVATE
        ).edit().clear().commit();
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
        for (String alias : new String[] {
            AndroidManagerV2KeyRing.SIGNING_PREFIX + OP,
            AndroidManagerV2KeyRing.WRAPPING_PREFIX + OP
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

    /** Delegates real disk writes while injecting one exact commit boundary. */
    private static final class FaultInjectingSharedPreferences implements SharedPreferences {
        private final SharedPreferences delegate;
        private final int failingCommit;
        private final boolean writeBeforeFailure;
        private final boolean memoryOnlyBeforeFailure;
        private final java.util.concurrent.ConcurrentHashMap<String, Object> memoryOverlay =
            new java.util.concurrent.ConcurrentHashMap<>();
        private int commitCount;

        FaultInjectingSharedPreferences(
            SharedPreferences delegate,
            int failingCommit,
            boolean writeBeforeFailure
        ) {
            this(delegate, failingCommit, writeBeforeFailure, false);
        }

        FaultInjectingSharedPreferences(
            SharedPreferences delegate,
            int failingCommit,
            boolean writeBeforeFailure,
            boolean memoryOnlyBeforeFailure
        ) {
            this.delegate = delegate;
            this.failingCommit = failingCommit;
            this.writeBeforeFailure = writeBeforeFailure;
            this.memoryOnlyBeforeFailure = memoryOnlyBeforeFailure;
        }

        @Override public Map<String, ?> getAll() { return delegate.getAll(); }
        @Override public String getString(String key, String fallback) {
            Object overlaid = memoryOverlay.get(key);
            return overlaid instanceof String ? (String) overlaid : delegate.getString(key, fallback);
        }
        @Override public Set<String> getStringSet(String key, Set<String> fallback) {
            return delegate.getStringSet(key, fallback);
        }
        @Override public int getInt(String key, int fallback) { return delegate.getInt(key, fallback); }
        @Override public long getLong(String key, long fallback) { return delegate.getLong(key, fallback); }
        @Override public float getFloat(String key, float fallback) { return delegate.getFloat(key, fallback); }
        @Override public boolean getBoolean(String key, boolean fallback) { return delegate.getBoolean(key, fallback); }
        @Override public boolean contains(String key) { return memoryOverlay.containsKey(key) || delegate.contains(key); }
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
            private final java.util.LinkedHashMap<String, Object> pending = new java.util.LinkedHashMap<>();

            FaultInjectingEditor(Editor delegateEditor) {
                this.delegateEditor = delegateEditor;
            }

            @Override public Editor putString(String key, String value) {
                delegateEditor.putString(key, value);
                pending.put(key, value);
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
                else if (memoryOnlyBeforeFailure) memoryOverlay.putAll(pending);
                return false;
            }
        }
    }
}
