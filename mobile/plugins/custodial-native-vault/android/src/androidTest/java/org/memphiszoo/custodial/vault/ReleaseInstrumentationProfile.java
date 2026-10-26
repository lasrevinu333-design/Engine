package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.InstrumentationInfo;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.system.Os;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.KeyStore;

/** Test-only generated-build profile selection. No caller argument, received
 * DATA, device setting, production key or native authority is accepted. */
final class ReleaseInstrumentationProfile {
    private static final String TEST_PACKAGE="org.memphiszoo.custodial.vault.test";
    static Context requireFreshIsolatedTarget() throws Exception {
        final Class<?> config;
        final java.lang.reflect.Field field;
        try {
            config=Class.forName(TEST_PACKAGE+".BuildConfig",false,ReleaseInstrumentationProfile.class.getClassLoader());
            field=config.getField("CUSTODIAL_RELEASE_INSTRUMENTATION");
        }catch(ClassNotFoundException|NoSuchFieldException absent) {
            // Existing default builds may omit BuildConfig or only this field.
            return requireDefaultDebugTarget();
        }
        int modifiers=field.getModifiers();
        assertSame(ReleaseInstrumentationProfile.class.getClassLoader(),config.getClassLoader());
        assertEquals(boolean.class,field.getType());
        assertTrue(java.lang.reflect.Modifier.isPublic(modifiers)&&java.lang.reflect.Modifier.isStatic(modifiers)
            &&java.lang.reflect.Modifier.isFinal(modifiers));
        if(!field.getBoolean(null))return requireDefaultDebugTarget();
        return requireFreshReleaseTarget();
    }
    private static Context requireDefaultDebugTarget() throws Exception {
        // A missing/false build flag cannot turn a nondebuggable misbuild into
        // the old guard's assumption skip. Normal debug still uses that exact guard.
        Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("RELEASE_PROFILE_REFUSED: nondebuggable target lacks the generated release profile",
            (target.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        return RetainedOriginalKeyAndroidRuntimeTest.requireFreshIsolatedTarget();
    }
    private static Context requireFreshReleaseTarget() throws Exception {
        assertTrue("RELEASE_PROFILE_REFUSED: durable NIO fixture requires API26+", Build.VERSION.SDK_INT >= 26);
        // Existing runtime fixture's local-emulator restriction is additional;
        // it is NOT substituted for the UID/package proof below.
        assertTrue("RELEASE_PROFILE_REFUSED: local emulator fixture required", Build.FINGERPRINT.contains("generic")
            || Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE));
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context target = instrumentation.getTargetContext(), test = instrumentation.getContext();
        assertTrue("RELEASE_PROFILE_REFUSED: exact manifest test/target package required",
            TEST_PACKAGE.equals(target.getPackageName()) && TEST_PACKAGE.equals(test.getPackageName()));
        var manager = target.getPackageManager();
        PackageInfo installed = manager.getPackageInfo(TEST_PACKAGE, 0);
        ApplicationInfo application = manager.getApplicationInfo(TEST_PACKAGE, 0);
        InstrumentationInfo runner = manager.getInstrumentationInfo(instrumentation.getComponentName(), 0);
        var signing = manager.getPackageInfo(TEST_PACKAGE, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES).signingInfo;
        assertNotNull("RELEASE_PROFILE_REFUSED: actual installed signer unavailable",signing);
        assertFalse("RELEASE_PROFILE_REFUSED: multiple signers",signing.hasMultipleSigners());
        var signers=signing.getApkContentsSigners();
        assertNotNull(signers);assertEquals(1,signers.length);
        assertEquals("RELEASE_PROFILE_REFUSED: normal owned test signer changed",
            "fabf0d9572d846048e257cdcde3fb80de9f07de74c8bad3ce4a58a91b4525d48",
            NativeRetainedAttempt.hash(signers[0].toByteArray()));
        int uid = Process.myUid();
        assertTrue("RELEASE_PROFILE_REFUSED: exact installed runner/target required", TEST_PACKAGE.equals(runner.packageName)
            && TEST_PACKAGE.equals(runner.targetPackage) && "androidx.test.runner.AndroidJUnitRunner".equals(runner.name));
        assertTrue("RELEASE_PROFILE_REFUSED: isolated non-system test UID required", uid >= 10_000 && application.uid == uid
            && test.getApplicationInfo().uid == uid && target.getApplicationInfo().uid == uid
            && installed.sharedUserId == null && (application.flags & ApplicationInfo.FLAG_SYSTEM) == 0
            && (application.flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0);
        String[] packages = manager.getPackagesForUid(uid);
        assertTrue("RELEASE_PROFILE_REFUSED: UID must own ONLY the pinned test package",
            packages != null && packages.length == 1 && TEST_PACKAGE.equals(packages[0]));
        Path data = target.getDataDir().toPath();
        assertTrue("RELEASE_PROFILE_REFUSED: unexpected test data root", data.toFile().getCanonicalPath().equals(new java.io.File(application.dataDir).getCanonicalPath())
            && !Files.isSymbolicLink(data) && Os.stat(data.toString()).st_uid == uid);
        // Installed androidx.test monitor 1.8.0 creates this private directory
        // before the selected test and pins dexmaker.dexcache to its path.
        // Recognize ONLY that exact runner-owned EMPTY directory, never an
        // arbitrary app_* cache, populated cache, old WORK or existing key.
        Path runnerCache = data.resolve("app_dxmaker_cache");
        assertTrue("RELEASE_PROFILE_REFUSED: runner cache property does not match exact test-owned path",
            runnerCache.toString().equals(System.getProperty("dexmaker.dexcache")));
        assertTrue("RELEASE_PROFILE_REFUSED: runner cache is not a real directory",
            !Files.isSymbolicLink(runnerCache) && Files.isDirectory(runnerCache, LinkOption.NOFOLLOW_LINKS));
        var cacheStat = Os.stat(runnerCache.toString());
        assertTrue("RELEASE_PROFILE_REFUSED: runner cache UID/GID is not the exclusive test UID",
            cacheStat.st_uid == uid && cacheStat.st_gid == uid);
        // Android ContextImpl.getDir(MODE_PRIVATE) creates 0771, not 0700.
        // Group rights belong to the SAME exclusive app UID; other UIDs have
        // no read/write permission. Do not chmod or adopt any unexpected mode.
        int cacheMode = cacheStat.st_mode & 0777;
        assertTrue("RELEASE_PROFILE_REFUSED: unexpected runner cache mode " + Integer.toOctalString(cacheMode),
            cacheMode == 0771 || cacheMode == 0700);
        try (var entries = Files.newDirectoryStream(data)) {
            for (Path entry : entries) assertTrue("RELEASE_PROFILE_REFUSED: unknown application data retained: "
                + entry.getFileName() + " (symlink=" + Files.isSymbolicLink(entry) + ")",
                java.util.Set.of("cache", "code_cache", "files", "no_backup", "shared_prefs", "databases", "app_dxmaker_cache")
                    .contains(entry.getFileName().toString()));
        }
        // No clearing/adoption of old work. Also rejects unknown DB/files and
        // prior selected-test roots; a second invocation is intentionally NOT_RUN.
        for (String child : new String[]{"shared_prefs", "databases", "files", "no_backup", "app_dxmaker_cache"}) {
            Path existing = data.resolve(child);
            if (Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) {
                assertTrue("RELEASE_PROFILE_REFUSED: unsafe existing storage", !Files.isSymbolicLink(existing)
                    && Files.isDirectory(existing, LinkOption.NOFOLLOW_LINKS) && Os.stat(existing.toString()).st_uid == uid);
                try (var entries = Files.newDirectoryStream(existing)) {
                    assertTrue("RELEASE_PROFILE_REFUSED: preexisting saved/unknown data retained in " + child, !entries.iterator().hasNext());
                }
            }
        }
        KeyStore keys = keyStore();
        assertTrue("RELEASE_PROFILE_REFUSED: preexisting fixed alias retained", !keys.containsAlias(AndroidKeystoreCipher.KEY_ALIAS));
        assertTrue("RELEASE_PROFILE_REFUSED: unknown test-UID key material retained", !keys.aliases().hasMoreElements());
        // Require a real readable boot counter before the first cipher can run.
        assertTrue("RELEASE_PROFILE_REFUSED: boot counter unavailable", Settings.Global.getInt(target.getContentResolver(), Settings.Global.BOOT_COUNT) >= 0);
        ReleaseArtInstallProfile.requireIfSelected(target);
        return target;
    }

    private static KeyStore keyStore() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);return store;
    }
}
