package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.InstrumentationInfo;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.provider.Settings;
import android.system.Os;
import android.system.OsConstants;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileDescriptor;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** One explicitly selected Android test, never an enrolled-app cleanup recipe.
 * Manifest package/target are pinned, but manifest evidence is NOT UID proof.
 * Runtime isolation/blank-state checks precede all key creation. Any unknown
 * originals cause NOT_RUN; no @Before/@After clears data or deletes aliases.
 * Real AndroidKeyStore is used; enrollment transport/snapshot/work identifiers
 * are existing instrumented fixture DATA, not server approval or ACK authority.
 * Reopen means new adapters plus an independently reopened durable ciphertext
 * file, NOT fresh-process/Android power-loss/full all8 custody qualification.
 */
@RunWith(AndroidJUnit4.class)
public final class RetainedOriginalKeyAndroidRuntimeTest {
    // processDebugAndroidTestManifest SHA256:
    // 29e038aca2f2e36732966bc56265d7cde04c71fcf4c2cde2455f2e49f0f04f52
    private static final String TEST_PACKAGE = "org.memphiszoo.custodial.vault.test";
    private static final String VAULT = "MemphisZooCustodialNativeVaultV2";
    private static final String WORK = "MemphisZooCustodialOfflineAuthorityTimeV1";
    private static final String WORK_AAD = "org.memphiszoo.custodial.native-vault.offline-authority-time.v1";

    @Test(timeout=120000)
    public void isolatedOriginalWorkSurvivesAdapterReopenAndSharedKeyRetirementRefusal() throws Exception {
        Context context = requireFreshIsolatedTarget();
        // The only newly created directory is owned by this selected test. It
        // and the fixed WORK/vault namespaces below remain after EVERY outcome.
        Path root = Files.createDirectory(context.getNoBackupFilesDir().toPath()
            .resolve("retained-original-key-" + UUID.randomUUID()),
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
        assertEquals(Process.myUid(), Os.stat(root.toString()).st_uid);
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport transport = new InstrumentedTransport(clock);
        String operation = UUID.randomUUID().toString();
        String session = UUID.randomUUID().toString();
        String device = "KIOSK_02";
        char[] credential = InstrumentedTransport.CREDENTIAL.toCharArray();
        VaultSnapshot original;
        try {
            synchronized (AndroidProtectedWorkPreferences.retainedCommitLock()) {
                // Recheck actual alias absence at the ordinary key-creation
                // coordinator; never replace/adopt an alias found meanwhile.
                assumeTrue("NOT_RUN: fixed alias already exists", !keyStore().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
                var persistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
                assumeTrue("NOT_RUN: fixed WORK namespace is not empty",
                    context.getSharedPreferences(WORK, Context.MODE_PRIVATE).getAll().isEmpty());
                assumeTrue("NOT_RUN: fixed vault namespace has unknown rows",
                    context.getSharedPreferences(VAULT, Context.MODE_PRIVATE).getAll().isEmpty());
                assumeTrue("NOT_RUN: vault is not empty", persistence.load().equals(VaultSnapshot.empty()));
                var encrypted = new AndroidKeystoreCipher().encrypt(credential);
                original = VaultSnapshot.empty().next(
                    VaultPhase.CREDENTIAL_STAGED, SecretKind.DEVICE_CREDENTIAL,
                    encrypted, operation, device, "enrollment", clock.nowMillis() + 600_000L,
                    new InstallationBinding(device, "instrumented-retained-" + operation,
                        Instant.now().toString(), false, operation),
                    EnrollmentMetadata.empty(), "", "", false, "");
                persistence.commit(0, original);
            }
        } finally { VaultValidation.wipe(credential); }

        AndroidOfflineAuthorityTimeStore work = new AndroidOfflineAuthorityTimeStore(context);
        OfflineAuthorityTime time = new OfflineAuthorityTime(work, new OfflineAuthorityTime.MonotonicClock() {
            @Override public long now() { return SystemClock.elapsedRealtime(); }
            @Override public int bootCount() {
                try { return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT); }
                catch (Settings.SettingNotFoundException unavailable) { throw new IllegalStateException(unavailable); }
            }
        });
        // Existing shipping anchor contract requires EXACT millisecond text.
        // Device wall time here is fixture DATA, not a genuine server clock.
        long fixtureNow = clock.nowMillis();
        String generatedAt = VaultTimestamps.fromEpochMillisExact(fixtureNow);
        time.acceptSnapshot(device, "a".repeat(64), generatedAt,
            VaultTimestamps.fromEpochMillisExact(Math.addExact(fixtureNow, 600_000L)));
        time.authorizeNewWork(device, "a".repeat(64));
        String startedAt = time.beginOccurrence(device, "NOCX", session, "a".repeat(64));
        // Do not complete, acknowledge, delete, quarantine or repair this work.
        var occurrence = work.loadOccurrence(session);
        assertNotNull(occurrence);assertEquals(startedAt, occurrence.startedAt);
        assertEquals("", occurrence.completedAt);

        SharedPreferences workPreferences = context.getSharedPreferences(WORK, Context.MODE_PRIVATE);
        SharedPreferences vaultPreferences = context.getSharedPreferences(VAULT, Context.MODE_PRIVATE);
        Map<String, ?> originalWork = new HashMap<>(workPreferences.getAll());
        Map<String, ?> originalVault = new HashMap<>(vaultPreferences.getAll());
        String rowKey = "offline_occurrence_sha256:" + hex(MessageDigest.getInstance("SHA-256")
            .digest(session.getBytes(StandardCharsets.UTF_8)));
        String envelope = workPreferences.getString(rowKey, null);
        assertNotNull(envelope);
        byte[] originalBytes = envelope.getBytes(StandardCharsets.UTF_8);
        Path retained = root.resolve("original-work.encrypted.json");
        // Exact shipping WORK envelope, not a new decoder/alternate work store.
        // This durable test-owned copy is DATA only; actual WORK is also kept.
        try (FileChannel file = FileChannel.open(retained,
            java.util.Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE),
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")))) {
            ByteBuffer buffer = ByteBuffer.wrap(originalBytes);
            while (buffer.hasRemaining()) assertTrue(file.write(buffer) > 0);
            file.force(true);
        }
        forceDirectory(root);
        Object retainedIdentity = identity(retained);
        Path workXml = context.getDataDir().toPath().resolve("shared_prefs/" + WORK + ".xml");
        Path vaultXml = context.getDataDir().toPath().resolve("shared_prefs/" + VAULT + ".xml");
        Object workIdentity = identity(workXml), vaultIdentity = identity(vaultXml);
        byte[] workBytes = Files.readAllBytes(workXml), vaultBytes = Files.readAllBytes(vaultXml);
        char[] originalClear = null, reopenedClear = null, afterRefusal = null;
        try {
            originalClear = decryptOriginalFile(retained);
            JSONObject decoded = new JSONObject(new String(originalClear));
            assertEquals(session, decoded.getString("client_session_id"));
            assertEquals(startedAt, decoded.getString("started_at"));
            assertEquals("", decoded.getString("completed_at"));

            // Recreate SHIPPING persistence/cipher/Engine/store objects. No
            // getState()/legacy recovery, resend, new enrollment or expiry fix.
            var reopenedPersistence = new SharedPreferencesVaultPersistence(context, new VaultSnapshotCodec());
            assertEquals(original, reopenedPersistence.load());
            var reopenedEngine = new VaultEngine(reopenedPersistence, new AndroidKeystoreCipher(), transport,
                new LegacyVaultSource() {
                    @Override public LegacyMaterial read() { return null; }
                    @Override public void cleanup() { fail("read-only reopen must not clean legacy data"); }
                    @Override public boolean isClean() { return true; }
                }, () -> "unused-instrumented-seal", clock, new AndroidOfflineAuthorityTimeStore(context));
            assertEquals("CREDENTIAL_STAGED", reopenedEngine.observeStateReadOnly().get("state"));
            char[] reopenedCredential = new AndroidKeystoreCipher().decrypt(reopenedPersistence.load().secret);
            try { assertArrayEquals(InstrumentedTransport.CREDENTIAL.toCharArray(), reopenedCredential); }
            finally { VaultValidation.wipe(reopenedCredential); }
            var reopenedWork = new AndroidOfflineAuthorityTimeStore(context);
            assertEquals(session, reopenedWork.loadOccurrence(session).clientSessionId);
            assertEquals(startedAt, reopenedWork.loadOccurrence(session).startedAt);
            assertTrue(reopenedWork.hasOccurrences());assertTrue(reopenedWork.hasUnfinishedOccurrences());
            reopenedClear = decryptOriginalFile(retained);
            assertArrayEquals(originalClear, reopenedClear);

            try { new AndroidKeystoreCipher().destroyKey(); fail("shared-key retirement must refuse"); }
            catch (VaultFailure refused) { assertEquals("custodial_native_shared_key_retirement_refused", refused.code); }
            assertTrue(keyStore().containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
            afterRefusal = decryptOriginalFile(retained);
            assertArrayEquals(originalClear, afterRefusal);
            char[] retainedCredential = new AndroidKeystoreCipher().decrypt(reopenedPersistence.load().secret);
            try { assertArrayEquals(InstrumentedTransport.CREDENTIAL.toCharArray(), retainedCredential); }
            finally { VaultValidation.wipe(retainedCredential); }
            assertEquals(original, reopenedPersistence.load());
            assertEquals(startedAt, new AndroidOfflineAuthorityTimeStore(context).loadOccurrence(session).startedAt);
        } finally {
            // Preserve actual on-disk originals, alias and preferences even on
            // assertion/KeyStore failure. Wipe owned plaintext/byte copies only.
            try {
                assertArrayEquals(originalBytes, Files.readAllBytes(retained));assertEquals(retainedIdentity, identity(retained));
                assertArrayEquals(workBytes, Files.readAllBytes(workXml));assertEquals(workIdentity, identity(workXml));
                assertArrayEquals(vaultBytes, Files.readAllBytes(vaultXml));assertEquals(vaultIdentity, identity(vaultXml));
                assertEquals(originalWork, workPreferences.getAll());assertEquals(originalVault, vaultPreferences.getAll());
                assertEquals(0, transport.enrollCalls.get());assertEquals(0, transport.confirmed ? 1 : 0);
                assertEquals(0, transport.cancelCalls.get());assertEquals(0, transport.removeCalls.get());
                assertEquals(0, transport.completionCalls.get());
            } finally {
                VaultValidation.wipe(originalClear);VaultValidation.wipe(reopenedClear);VaultValidation.wipe(afterRefusal);
                Arrays.fill(originalBytes, (byte) 0);Arrays.fill(workBytes, (byte) 0);Arrays.fill(vaultBytes, (byte) 0);
            }
        }
    }

    static Context requireFreshIsolatedTarget() throws Exception {
        assumeTrue("NOT_RUN: durable NIO fixture requires API26+", Build.VERSION.SDK_INT >= 26);
        // Existing runtime fixture's local-emulator restriction is additional;
        // it is NOT substituted for the UID/package proof below.
        assumeTrue("NOT_RUN: local emulator fixture required", Build.FINGERPRINT.contains("generic")
            || Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE));
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context target = instrumentation.getTargetContext(), test = instrumentation.getContext();
        assumeTrue("NOT_RUN: exact manifest test/target package required",
            TEST_PACKAGE.equals(target.getPackageName()) && TEST_PACKAGE.equals(test.getPackageName()));
        var manager = target.getPackageManager();
        PackageInfo installed = manager.getPackageInfo(TEST_PACKAGE, 0);
        ApplicationInfo application = manager.getApplicationInfo(TEST_PACKAGE, 0);
        InstrumentationInfo runner = manager.getInstrumentationInfo(instrumentation.getComponentName(), 0);
        int uid = Process.myUid();
        assumeTrue("NOT_RUN: exact installed runner/target required", TEST_PACKAGE.equals(runner.packageName)
            && TEST_PACKAGE.equals(runner.targetPackage) && "androidx.test.runner.AndroidJUnitRunner".equals(runner.name));
        assumeTrue("NOT_RUN: isolated non-system test UID required", uid >= 10_000 && application.uid == uid
            && test.getApplicationInfo().uid == uid && target.getApplicationInfo().uid == uid
            && installed.sharedUserId == null && (application.flags & ApplicationInfo.FLAG_SYSTEM) == 0
            && (application.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        String[] packages = manager.getPackagesForUid(uid);
        assumeTrue("NOT_RUN: UID must own ONLY the pinned test package",
            packages != null && packages.length == 1 && TEST_PACKAGE.equals(packages[0]));
        Path data = target.getDataDir().toPath();
        assumeTrue("NOT_RUN: unexpected test data root", data.toFile().getCanonicalPath().equals(new java.io.File(application.dataDir).getCanonicalPath())
            && !Files.isSymbolicLink(data) && Os.stat(data.toString()).st_uid == uid);
        // Installed androidx.test monitor 1.8.0 creates this private directory
        // before the selected test and pins dexmaker.dexcache to its path.
        // Recognize ONLY that exact runner-owned EMPTY directory, never an
        // arbitrary app_* cache, populated cache, old WORK or existing key.
        Path runnerCache = data.resolve("app_dxmaker_cache");
        assumeTrue("NOT_RUN: runner cache property does not match exact test-owned path",
            runnerCache.toString().equals(System.getProperty("dexmaker.dexcache")));
        assumeTrue("NOT_RUN: runner cache is not a real directory",
            !Files.isSymbolicLink(runnerCache) && Files.isDirectory(runnerCache, LinkOption.NOFOLLOW_LINKS));
        var cacheStat = Os.stat(runnerCache.toString());
        assumeTrue("NOT_RUN: runner cache UID/GID is not the exclusive test UID",
            cacheStat.st_uid == uid && cacheStat.st_gid == uid);
        // Android ContextImpl.getDir(MODE_PRIVATE) creates 0771, not 0700.
        // Group rights belong to the SAME exclusive app UID; other UIDs have
        // no read/write permission. Do not chmod or adopt any unexpected mode.
        int cacheMode = cacheStat.st_mode & 0777;
        assumeTrue("NOT_RUN: unexpected runner cache mode " + Integer.toOctalString(cacheMode),
            cacheMode == 0771 || cacheMode == 0700);
        try (var entries = Files.newDirectoryStream(data)) {
            for (Path entry : entries) assumeTrue("NOT_RUN: unknown application data retained: "
                + entry.getFileName() + " (symlink=" + Files.isSymbolicLink(entry) + ")",
                java.util.Set.of("cache", "code_cache", "files", "no_backup", "shared_prefs", "databases", "app_dxmaker_cache")
                    .contains(entry.getFileName().toString()));
        }
        // No clearing/adoption of old work. Also rejects unknown DB/files and
        // prior selected-test roots; a second invocation is intentionally NOT_RUN.
        for (String child : new String[]{"shared_prefs", "databases", "files", "no_backup", "app_dxmaker_cache"}) {
            Path existing = data.resolve(child);
            if (Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) {
                assumeTrue("NOT_RUN: unsafe existing storage", !Files.isSymbolicLink(existing)
                    && Files.isDirectory(existing, LinkOption.NOFOLLOW_LINKS) && Os.stat(existing.toString()).st_uid == uid);
                try (var entries = Files.newDirectoryStream(existing)) {
                    assumeTrue("NOT_RUN: preexisting saved/unknown data retained in " + child, !entries.iterator().hasNext());
                }
            }
        }
        KeyStore keys = keyStore();
        assumeTrue("NOT_RUN: preexisting fixed alias retained", !keys.containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
        assumeTrue("NOT_RUN: unknown test-UID key material retained", !keys.aliases().hasMoreElements());
        // Require a real readable boot counter before the first cipher can run.
        assumeTrue("NOT_RUN: boot counter unavailable", Settings.Global.getInt(target.getContentResolver(), Settings.Global.BOOT_COUNT) >= 0);
        return target;
    }

    private static KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");store.load(null);return store;
    }
    private static char[] decryptOriginalFile(Path file) throws Exception {
        byte[] encoded = Files.readAllBytes(file);
        try {
            JSONObject envelope = new JSONObject(new String(encoded, StandardCharsets.UTF_8));
            assertEquals(2, envelope.length());
            return new AndroidKeystoreCipher(WORK_AAD, 131_072).decrypt(
                new EncryptedSecret(envelope.getString("ciphertext"), envelope.getString("iv")));
        } finally { Arrays.fill(encoded, (byte) 0); }
    }
    private static Object identity(Path file) throws Exception {
        assertFalse(Files.isSymbolicLink(file));
        var attributes = Files.readAttributes(file, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        assertTrue(attributes.isRegularFile());assertNotNull(attributes.fileKey());return attributes.fileKey();
    }
    private static void forceDirectory(Path directory) throws Exception {
        FileDescriptor descriptor = Os.open(directory.toString(), OsConstants.O_RDONLY | OsConstants.O_NOFOLLOW, 0);
        try {
            assertTrue("opened descriptor must be an actual directory", OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode));
            Os.fsync(descriptor);
        } finally { Os.close(descriptor); }
    }
    private static String hex(byte[] digest) {
        try {
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            return result.toString();
        } finally { Arrays.fill(digest, (byte) 0); }
    }
}
