package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Rect;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import androidx.webkit.WebViewFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real managed-device entry/Bridge/WebView integration, not manager admission,
 * original capture, currentness, SQL, ACK or finalization proof. Reuses the
 * existing empty smoke document, with the NORMAL packaged bootstrap bytes.
 * No private controls, synthetic manager, keystore reset or enrollment setup.
 */
@RunWith(AndroidJUnit4.class)
public final class ProtectedRecoveryEntryAndroidRuntimeTest {
    @Test(timeout = 15_000)
    public void normalAndroidContextCanObserveAbsentMutationJournalWithoutProvisioningAuthority() throws Exception {
        Context application = InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        java.io.File originalRoot = application.getNoBackupFilesDir();
        java.io.File canonicalRoot = originalRoot.getCanonicalFile();
        java.io.File journal = new java.io.File(originalRoot, NativePrivateMutationEpochStore.DIRECTORY);
        var originalAttributes = java.nio.file.Files.readAttributes(originalRoot.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(originalAttributes.fileKey());
        assertFalse("The final original root component is not itself a symbolic link", originalAttributes.isSymbolicLink());
        assertFalse("This original disposable application has no established mutation journal", journal.exists());
        String[] custodyDirectories = {
            NativePrivateCustodyOperationStore.DIRECTORY,
            NativePrivateCapsuleFileStore.DIRECTORY,
            VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY
        };
        for (String directory : custodyDirectories) {
            assertTrue("This disposable original has no private custody directory",
                java.nio.file.Files.notExists(originalRoot.toPath().resolve(directory), java.nio.file.LinkOption.NOFOLLOW_LINKS));
        }
        assertFalse("Ordinary Context presence inspection must observe no pending original",
            AndroidPrivateCustodyOperationStore.pendingOriginalPresent(application));
        for (String directory : custodyDirectories) {
            assertTrue("Presence inspection must not provision an operation, capsule or exchange journal",
                java.nio.file.Files.notExists(originalRoot.toPath().resolve(directory), java.nio.file.LinkOption.NOFOLLOW_LINKS));
        }
        assertEquals("Only the original Context may observe its canonical platform root",
            canonicalRoot, NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
        assertThrows(VaultFailure.class, () -> NativePrivateMutationEpochStore.originalContextNoBackupRoot(null));
        if (!originalRoot.getAbsoluteFile().equals(canonicalRoot)) {
            // The same platform alias is still UNTRUSTED when supplied as a
            // raw File. Absence must not make that separate API permissive.
            VaultFailure rawRefused = assertThrows(VaultFailure.class,
                () -> NativePrivateMutationEpochStore.existingFromNativeNoBackupRootOrAbsent(originalRoot));
            assertEquals(NativePrivateMutationEpochStore.FAILURE, rawRefused.code);
        }
        try {
            assertNull("Observing absence is not authority to mint a zero epoch",
                NativePrivateMutationEpochStore.existingFromContextOrAbsent(application));
        } catch (VaultFailure refused) {
            throw new AssertionError("Actual Android application root refused by the existing-journal reader: raw="
                + originalRoot + "; canonical=" + canonicalRoot + "; raw_equals_canonical="
                + originalRoot.getAbsoluteFile().equals(canonicalRoot), refused);
        }
        assertNull("Existing-metadata recovery may not bootstrap an absent journal",
            NativePrivateMutationEpochStore.recoverExistingFromContextOrAbsent(application));
        assertEquals("The same application root must remain the observed original",
            canonicalRoot, NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
        var currentAttributes = java.nio.file.Files.readAttributes(originalRoot.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertEquals(originalAttributes.fileKey(), currentAttributes.fileKey());
        assertEquals(originalAttributes.owner(), currentAttributes.owner());
        assertFalse("Read-only absence must not provision any mutation journal or baseline", journal.exists());
    }

    @Test(timeout = 45_000)
    public void protectedEntryAndOriginalBrowserWiringRetireWithTheirRealActivity() throws Exception {
        assertTrue("The normal managed device must provide original launch identity", Build.VERSION.SDK_INT >= 34);
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context target = instrumentation.getTargetContext();
        ComponentName entry = new ComponentName(target, NativeProtectedRecoveryPreparationActivity.class);
        ActivityInfo info = target.getPackageManager().getActivityInfo(entry, 0);
        assertTrue(info.exported);
        assertEquals("android.permission.DUMP", info.permission);
        assertTrue((info.flags & ActivityInfo.FLAG_NO_HISTORY) != 0);
        assertTrue((info.flags & ActivityInfo.FLAG_EXCLUDE_FROM_RECENTS) != 0);
        Intent advertised = new Intent(NativeProtectedRecoveryPreparationActivity.ACTION).setPackage(target.getPackageName());
        var matches = target.getPackageManager().queryIntentActivities(advertised, 0);
        assertEquals(1, matches.size());
        assertEquals(entry.getClassName(), matches.get(0).activityInfo.name);
        assertTrue(target.getPackageManager().queryIntentActivities(
            new Intent(advertised).addCategory(Intent.CATEGORY_BROWSABLE), 0).isEmpty());

        // Normal same-UID entry is a real rejection path, not a test-granted
        // shell/manager launch. Never adopt shell DUMP permissions here.
        try (ActivityScenario<NativeProtectedRecoveryPreparationActivity> rejected = ActivityScenario.launch(
            new Intent(target, NativeProtectedRecoveryPreparationActivity.class)
                .setAction(NativeProtectedRecoveryPreparationActivity.ACTION))) {
            assertEquals("Same-app launch must finish without exposing maintenance controls",
                Lifecycle.State.DESTROYED, rejected.getState());
        }

        // The existing native fixture registers the actual default plugin.
        // In contrast to old injected-engine tests, production load/attachment
        // must run, and a refused runtime must NOT be replaced by a fake owner.
        CustodialNativeVaultPlugin plugin = new CustodialNativeVaultPlugin();
        BridgeSmokeActivity.install(plugin);
        AtomicReference<BridgeSmokeActivity> activity = new AtomicReference<>();
        try (ActivityScenario<BridgeSmokeActivity> scenario = ActivityScenario.launch(BridgeSmokeActivity.class)) {
            scenario.onActivity(value -> {
                activity.set(value);
                assertNotNull(value.getBridge());
                assertSame(plugin, value.getBridge().getPlugin("CustodialNativeVault").getInstance());
                assertNotNull(value.getBridge().getWebView());
                assertTrue("WEB_MESSAGE_LISTENER is required by the shipping Source",
                    WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER));
                assertTrue("DOCUMENT_START_SCRIPT is required by the shipping Source",
                    WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT));
                assertFalse(value.getBridge().getWebView().getSettings().supportMultipleWindows());
                // Observe the real first-load policy; the test does not
                // supply a constrained view or perform startup repair.
                assertFalse("Shipping browser-preparation refuses JavaScriptCanOpenWindowsAutomatically=true; "
                    + "the normal Custodial startup must supply the constrained view",
                    value.getBridge().getWebView().getSettings().getJavaScriptCanOpenWindowsAutomatically());
            });
            verifyNormalBootstrapAssets(activity.get());
            JSONObject document = awaitLocalDocument(activity.get());
            assertEquals("https://localhost", document.getString("origin"));
            assertEquals("ready", document.getString("text"));
            assertEquals("Real default plugin must install its shipping document-start listener; "
                + "missing assets/runtime/source are not success", "object", document.getString("source"));
            scenario.onActivity(value -> {
                // Negative currentness DATA only: an app-side withdrawal must
                // not be repaired by invoking load again. Do NOT restore these
                // settings or perform a capture after this deliberate change.
                var settings = value.getBridge().getWebView().getSettings();
                settings.setSupportMultipleWindows(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                plugin.load();
                assertTrue("Repeated load must not reset withdrawn window policy", settings.supportMultipleWindows());
                assertTrue("Repeated load must not reset withdrawn JavaScript window policy",
                    settings.getJavaScriptCanOpenWindowsAutomatically());
            });
            scenario.moveToState(Lifecycle.State.CREATED);
            assertEquals(Lifecycle.State.CREATED, scenario.getState());
        } finally {
            // The existing fixture clears this onDestroy; also release its
            // test-only reference if Activity launch failed before onCreate.
            BridgeSmokeActivity.install(null);
        }
        instrumentation.waitForIdleSync();
        assertNotNull(activity.get());
        assertTrue("The actual Bridge Activity must be destroyed on scenario close", activity.get().isDestroyed());
    }

    @Test(timeout = 45_000)
    public void normalShellProtectedEntryReadsOnlyUnavailableStatusAndClosesWithoutProvisioning() throws Exception {
        assertTrue("Original platform launch UID is required", Build.VERSION.SDK_INT >= 34);
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context application = instrumentation.getTargetContext().getApplicationContext();
        java.io.File root = application.getNoBackupFilesDir();
        assertNotNull(root);
        java.io.File canonicalRoot = root.getCanonicalFile();
        var rootBefore = java.nio.file.Files.readAttributes(root.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(rootBefore.fileKey());
        assertFalse(rootBefore.isSymbolicLink());
        requireShellStatusArtifactsAbsent(root);
        ComponentName entry = new ComponentName(application, NativeProtectedRecoveryPreparationActivity.class);
        assertTrue("Only the fixed explicit component may enter the shell command",
            entry.flattenToString().matches("[a-zA-Z0-9_.]+/[a-zA-Z0-9_.]+"));
        var monitor = ActivityLifecycleMonitorRegistry.getInstance();
        AtomicReference<NativeProtectedRecoveryPreparationActivity> owned = new AtomicReference<>();
        AtomicReference<NativeProtectedRecoveryPreparationActivity> unexpected = new AtomicReference<>();
        CountDownLatch resumed = new CountDownLatch(1);
        CountDownLatch destroyed = new CountDownLatch(1);
        ActivityLifecycleCallback callback = (activity, stage) -> {
            if (!(activity instanceof NativeProtectedRecoveryPreparationActivity)
                || !entry.equals(activity.getComponentName())) return;
            var actual = (NativeProtectedRecoveryPreparationActivity) activity;
            if (!owned.compareAndSet(null, actual) && owned.get() != actual) {
                unexpected.compareAndSet(null, actual);
                return;
            }
            if (stage == Stage.RESUMED) resumed.countDown();
            if (stage == Stage.DESTROYED) destroyed.countDown();
        };
        boolean registered = false;
        Throwable primary = null;
        var automation = instrumentation.getUiAutomation();
        try {
            requireShellStatusCommandUid(automation);
            instrumentation.runOnMainSync(() -> {
                for (Stage stage : Stage.values()) {
                    if (stage == Stage.DESTROYED) continue;
                    for (android.app.Activity existing : monitor.getActivitiesInStage(stage))
                        assertFalse("Never reuse or close another maintenance Activity",
                            existing instanceof NativeProtectedRecoveryPreparationActivity);
                }
                monitor.addLifecycleCallback(callback);
            });
            registered = true;
            // UiAutomation executes this as the REAL platform shell. No
            // adopted permission identity, same-UID startActivity or extras.
            try (ParcelFileDescriptor shell = automation.executeShellCommand(
                "am start -W -a " + NativeProtectedRecoveryPreparationActivity.ACTION
                    + " -n " + entry.flattenToString())) {
                assertNotNull(shell);
                if (!resumed.await(10, TimeUnit.SECONDS)) {
                    // Preserve available NORMAL command diagnostics on a
                    // refused launch; never block reading an unfinished pipe.
                    try (var output = new ParcelFileDescriptor.AutoCloseInputStream(shell)) {
                        int available = Math.min(output.available(), 4096);
                        String diagnostic = new String(output.readNBytes(available), StandardCharsets.UTF_8);
                        fail("The actual shell-launched maintenance screen did not resume; shell output: " + diagnostic);
                    }
                }
                NativeProtectedRecoveryPreparationActivity activity = owned.get();
                assertNotNull(activity);
                assertNull("A replacement Activity is not the original launch", unexpected.get());
                long focusDeadline = SystemClock.uptimeMillis() + 5_000;
                java.util.concurrent.atomic.AtomicBoolean focused = new java.util.concurrent.atomic.AtomicBoolean();
                do {
                    instrumentation.runOnMainSync(() -> focused.set(
                        !activity.isFinishing() && !activity.isDestroyed() && activity.hasWindowFocus()
                            && monitor.getLifecycleStageOf(activity) == Stage.RESUMED));
                    if (!focused.get()) SystemClock.sleep(25);
                } while (!focused.get() && SystemClock.uptimeMillis() < focusDeadline);
                assertTrue("The original maintenance screen is not foreground/current", focused.get());
                instrumentation.runOnMainSync(() -> {
                    // Ordinary cross-UID am start does not opt into identity
                    // sharing. This public observation is UNAVAILABLE, not
                    // the shell-route UID or manager/effect authority.
                    assertEquals("Non-sharing launch must honestly withhold caller identity",
                        android.os.Process.INVALID_UID, activity.getLaunchedFromUid());
                    System.out.println("ACTIVITY_CALLER_IDENTITY=UNAVAILABLE; no caller or manager authority");
                    Intent original = activity.getIntent();
                    assertEquals(entry, original.getComponent());
                    assertEquals(NativeProtectedRecoveryPreparationActivity.ACTION, original.getAction());
                    assertNull(original.getData());
                    assertNull(original.getClipData());
                    assertNull(original.getSelector());
                    assertTrue(original.getExtras() == null || original.getExtras().isEmpty());
                    assertNotNull(findShellStatusText(activity.getWindow().getDecorView(),
                        "Same-original protected recovery"));
                    Button read = requireShellStatusButton(activity,
                        "Read retained local finalization status; no repeat write");
                    read.requestRectangleOnScreen(new Rect(0, 0, read.getWidth(), read.getHeight()), true);
                });
                instrumentation.waitForIdleSync();
                instrumentation.runOnMainSync(() -> {
                    assertTrue(activity.hasWindowFocus());
                    assertFalse(activity.isFinishing());
                    assertEquals(Stage.RESUMED, monitor.getLifecycleStageOf(activity));
                    Button read = requireShellStatusButton(activity,
                        "Read retained local finalization status; no repeat write");
                    assertTrue(read.isEnabled());
                    assertTrue(read.getGlobalVisibleRect(new Rect()));
                    assertTrue("Only the actual read-only status action is clicked", read.performClick());
                    assertFalse("The one explicit status attempt must be consumed", read.isEnabled());
                });
                String unavailable = "Outcome unconfirmed. The original remains retained. No resend, replacement intent, reset, "
                    + "or native action is authorized.";
                String absent = "No local finalization intent was observed. This is not permission to repeat a write or create another operation.";
                AtomicReference<String> observed = new AtomicReference<>();
                long statusDeadline = SystemClock.uptimeMillis() + 8_000;
                do {
                    instrumentation.runOnMainSync(() -> {
                        assertTrue("A stale/nonforeground screen is not status proof", activity.hasWindowFocus());
                        assertFalse(activity.isFinishing());
                        assertEquals(Stage.RESUMED, monitor.getLifecycleStageOf(activity));
                        View decor = activity.getWindow().getDecorView();
                        if (findShellStatusText(decor, unavailable) != null) observed.set("UNAVAILABLE_OR_REFUSED");
                        else if (findShellStatusText(decor, absent) != null) observed.set("NO_LOCAL_INTENT_OBSERVED");
                        else observed.set(null);
                    });
                    if (observed.get() == null) SystemClock.sleep(25);
                } while (observed.get() == null && SystemClock.uptimeMillis() < statusDeadline);
                assertNotNull("Fresh unenrolled status must be explicitly absent/unconfirmed, never readiness or success",
                    observed.get());
                System.out.println("SHELL_STATUS_OBSERVATION=" + observed.get()
                    + "; not manager, ACK or readiness proof");
                requireShellStatusArtifactsAbsent(root);
                instrumentation.runOnMainSync(() -> {
                    assertTrue(activity.hasWindowFocus());
                    assertFalse(activity.isFinishing());
                    assertEquals(Stage.RESUMED, monitor.getLifecycleStageOf(activity));
                    assertEquals("Non-sharing caller identity must remain unavailable",
                        android.os.Process.INVALID_UID, activity.getLaunchedFromUid());
                    Button close = requireShellStatusButton(activity, "Close maintenance");
                    close.requestRectangleOnScreen(new Rect(0, 0, close.getWidth(), close.getHeight()), true);
                });
                instrumentation.waitForIdleSync();
                instrumentation.runOnMainSync(() -> {
                    assertTrue(activity.hasWindowFocus());
                    assertFalse(activity.isFinishing());
                    assertEquals(Stage.RESUMED, monitor.getLifecycleStageOf(activity));
                    Button close = requireShellStatusButton(activity, "Close maintenance");
                    assertTrue(close.isEnabled());
                    assertTrue(close.getGlobalVisibleRect(new Rect()));
                    assertTrue("Normal retirement must use the actual Close action", close.performClick());
                });
                assertTrue("Close must retire the original Activity", destroyed.await(8, TimeUnit.SECONDS));
                assertTrue(activity.isDestroyed());
                assertNull("No replacement Activity may be accepted", unexpected.get());
            }
        } catch (Exception | Error failed) {
            primary = failed;
            throw failed;
        } finally {
            Throwable cleanupFailure = null;
            try {
                // Failure cleanup ONLY for references observed after this
                // test's explicit shell launch. Never a successful Close proof.
                instrumentation.runOnMainSync(() -> {
                    if (owned.get() != null && !owned.get().isDestroyed()) owned.get().finish();
                    if (unexpected.get() != null && !unexpected.get().isDestroyed()) unexpected.get().finish();
                });
                if (owned.get() != null)
                    assertTrue("Owned shell Activity did not retire", destroyed.await(5, TimeUnit.SECONDS));
                if (unexpected.get() != null) {
                    long cleanupDeadline = SystemClock.uptimeMillis() + 5_000;
                    java.util.concurrent.atomic.AtomicBoolean retired = new java.util.concurrent.atomic.AtomicBoolean();
                    do {
                        instrumentation.runOnMainSync(() -> retired.set(unexpected.get().isDestroyed()));
                        if (!retired.get()) SystemClock.sleep(25);
                    } while (!retired.get() && SystemClock.uptimeMillis() < cleanupDeadline);
                    assertTrue("Unexpected same-launch replacement did not retire during failure cleanup", retired.get());
                }
            } catch (Exception | Error cleanup) { cleanupFailure = cleanup; }
            try {
                if (registered) instrumentation.runOnMainSync(() -> monitor.removeLifecycleCallback(callback));
                requireShellStatusArtifactsAbsent(root);
                assertEquals(canonicalRoot, root.getCanonicalFile());
                var rootAfter = java.nio.file.Files.readAttributes(root.toPath(),
                    java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(rootBefore.fileKey(), rootAfter.fileKey());
                assertEquals(rootBefore.owner(), rootAfter.owner());
            } catch (Exception | Error cleanup) {
                if (cleanupFailure == null) cleanupFailure = cleanup;
                else cleanupFailure.addSuppressed(cleanup);
            }
            if (cleanupFailure != null) {
                if (primary != null) primary.addSuppressed(cleanupFailure);
                else if (cleanupFailure instanceof Exception) throw (Exception) cleanupFailure;
                else throw (Error) cleanupFailure;
            }
        }
    }

    @Test(timeout = 35_000)
    public void normalShellProtectedEntryRejectsBenignExtraBeforeMaintenanceWithoutProvisioning() throws Exception {
        assertTrue("Original platform launch observation requires API34+", Build.VERSION.SDK_INT >= 34);
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context application = instrumentation.getTargetContext().getApplicationContext();
        java.io.File root = application.getNoBackupFilesDir();
        assertNotNull(root);
        java.io.File canonicalRoot = root.getCanonicalFile();
        var rootBefore = java.nio.file.Files.readAttributes(root.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(rootBefore.fileKey());
        assertFalse(rootBefore.isSymbolicLink());
        requireShellStatusArtifactsAbsent(root);
        ComponentName entry = new ComponentName(application, NativeProtectedRecoveryPreparationActivity.class);
        assertTrue(entry.flattenToString().matches("[a-zA-Z0-9_.]+/[a-zA-Z0-9_.]+"));
        var automation = instrumentation.getUiAutomation();
        var monitor = ActivityLifecycleMonitorRegistry.getInstance();
        AtomicReference<NativeProtectedRecoveryPreparationActivity> owned = new AtomicReference<>();
        AtomicReference<NativeProtectedRecoveryPreparationActivity> unexpected = new AtomicReference<>();
        AtomicReference<Throwable> observationFailure = new AtomicReference<>();
        CountDownLatch created = new CountDownLatch(1);
        CountDownLatch destroyed = new CountDownLatch(1);
        CountDownLatch unexpectedDestroyed = new CountDownLatch(1);
        ActivityLifecycleCallback callback = (activity, stage) -> {
            if (!(activity instanceof NativeProtectedRecoveryPreparationActivity)
                || !entry.equals(activity.getComponentName())) return;
            Intent original = activity.getIntent();
            // Match this actual command's benign DATA only for observation
            // and cleanup. Never adopt another Activity or infer authority.
            if (original == null || !NativeProtectedRecoveryPreparationActivity.ACTION.equals(original.getAction())
                || !"UNIT_REJECT_ONLY".equals(original.getStringExtra("refused_payload"))) return;
            var actual = (NativeProtectedRecoveryPreparationActivity) activity;
            if (!owned.compareAndSet(null, actual) && owned.get() != actual) {
                unexpected.compareAndSet(null, actual);
                observationFailure.compareAndSet(null, new AssertionError("A replacement is not the original forbidden-extra launch"));
                if (unexpected.get() == actual && stage == Stage.DESTROYED) unexpectedDestroyed.countDown();
                return;
            }
            if (stage == Stage.CREATED) {
                try {
                    assertEquals(entry, original.getComponent());
                    assertEquals(NativeProtectedRecoveryPreparationActivity.ACTION, original.getAction());
                    assertNull(original.getData());
                    assertNull(original.getClipData());
                    assertNull(original.getSelector());
                    assertNotNull(original.getExtras());
                    assertEquals("Only the one fixed benign forbidden extra is submitted", 1, original.getExtras().size());
                    assertEquals("UNIT_REJECT_ONLY", original.getStringExtra("refused_payload"));
                    assertEquals("Non-sharing public caller identity remains unavailable, not authority",
                        android.os.Process.INVALID_UID, actual.getLaunchedFromUid());
                    assertTrue("The actual guard must finish during onCreate before maintenance admission", actual.isFinishing());
                    assertNotNull(actual.getWindow());
                    View decor = actual.getWindow().peekDecorView();
                    if (decor != null) {
                        View content = decor.findViewById(android.R.id.content);
                        if (content != null) {
                            assertTrue(content instanceof ViewGroup);
                            assertEquals("Rejected input must not install application content", 0,
                                ((ViewGroup) content).getChildCount());
                        }
                        assertNull(findShellStatusText(decor, "Same-original protected recovery"));
                        assertNull(findShellStatusText(decor, "Read retained local finalization status; no repeat write"));
                        assertNull(findShellStatusText(decor, "Close maintenance"));
                    }
                } catch (Exception | Error failed) {
                    observationFailure.compareAndSet(null, failed);
                } finally {
                    created.countDown();
                }
            }
            if (stage == Stage.DESTROYED) destroyed.countDown();
        };
        boolean registered = false;
        Throwable primary = null;
        try {
            requireShellStatusCommandUid(automation);
            instrumentation.runOnMainSync(() -> {
                for (Stage stage : Stage.values()) {
                    if (stage == Stage.DESTROYED) continue;
                    for (android.app.Activity existing : monitor.getActivitiesInStage(stage))
                        assertFalse("Never reuse or close a pre-existing maintenance Activity",
                            existing instanceof NativeProtectedRecoveryPreparationActivity);
                }
                monitor.addLifecycleCallback(callback);
            });
            registered = true;
            try (ParcelFileDescriptor shell = automation.executeShellCommand(
                "am start -W -a " + NativeProtectedRecoveryPreparationActivity.ACTION
                    + " -n " + entry.flattenToString() + " --es refused_payload UNIT_REJECT_ONLY")) {
                assertNotNull(shell);
                if (!created.await(10, TimeUnit.SECONDS)) {
                    try (var output = new ParcelFileDescriptor.AutoCloseInputStream(shell)) {
                        int available = Math.min(output.available(), 4096);
                        String diagnostic = new String(output.readNBytes(available), StandardCharsets.UTF_8);
                        fail("No actual owning Activity creation was observed; refusal is unproved. Shell output: " + diagnostic);
                    }
                }
                Throwable observed = observationFailure.get();
                if (observed instanceof Exception) throw (Exception) observed;
                if (observed != null) throw (Error) observed;
                assertNotNull("A shell error or absent Activity is not guard proof", owned.get());
                assertTrue("The original forbidden-extra Activity must retire itself",
                    destroyed.await(8, TimeUnit.SECONDS));
                assertTrue(owned.get().isDestroyed());
                assertNull("A replacement Activity may not supply refusal proof", unexpected.get());
                requireShellStatusArtifactsAbsent(root);
                System.out.println("FORBIDDEN_EXTRA_OBSERVATION=ORIGINAL_CREATED_FINISHING_THEN_DESTROYED; "
                    + "no maintenance UI or action admitted; not manager or effect authority");
            }
        } catch (Exception | Error failed) {
            primary = failed;
            throw failed;
        } finally {
            Throwable cleanupFailure = null;
            try {
                // Failure cleanup is NOT the expected guard retirement proof.
                // Only exact callback-observed instances of this input qualify.
                instrumentation.runOnMainSync(() -> {
                    if (owned.get() != null && !owned.get().isDestroyed()) owned.get().finish();
                    if (unexpected.get() != null && !unexpected.get().isDestroyed()) unexpected.get().finish();
                });
                if (owned.get() != null)
                    assertTrue("Owned forbidden-extra Activity did not retire", destroyed.await(5, TimeUnit.SECONDS));
                if (unexpected.get() != null)
                    assertTrue("Owned replacement did not retire during failure cleanup",
                        unexpectedDestroyed.await(5, TimeUnit.SECONDS));
            } catch (Exception | Error cleanup) { cleanupFailure = cleanup; }
            try {
                if (registered) instrumentation.runOnMainSync(() -> monitor.removeLifecycleCallback(callback));
                requireShellStatusArtifactsAbsent(root);
                assertEquals(canonicalRoot, root.getCanonicalFile());
                var rootAfter = java.nio.file.Files.readAttributes(root.toPath(),
                    java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(rootBefore.fileKey(), rootAfter.fileKey());
                assertEquals(rootBefore.owner(), rootAfter.owner());
            } catch (Exception | Error cleanup) {
                if (cleanupFailure == null) cleanupFailure = cleanup;
                else cleanupFailure.addSuppressed(cleanup);
            }
            if (cleanupFailure != null) {
                if (primary != null) primary.addSuppressed(cleanupFailure);
                else if (cleanupFailure instanceof Exception) throw (Exception) cleanupFailure;
                else throw (Error) cleanupFailure;
            }
        }
    }

    private static void requireShellStatusCommandUid(android.app.UiAutomation automation) throws Exception {
        // Fixed READ ONLY command on the SAME actual UiAutomation route as
        // am start. Its UID observation is never supplied to the Activity.
        assertNotNull("The normal UI automation shell route is unavailable", automation);
        try (ParcelFileDescriptor descriptor = automation.executeShellCommand("id -u")) {
            assertNotNull("The normal shell identity route is unavailable", descriptor);
            try (var output = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
                var poll = new android.system.StructPollfd();
                poll.fd = descriptor.getFileDescriptor();
                poll.events = (short) android.system.OsConstants.POLLIN;
                byte[] bytes = new byte[32];
                int count = 0;
                boolean ended = false;
                long deadline = SystemClock.elapsedRealtime() + 3_000;
                while (!ended) {
                    long remaining = deadline - SystemClock.elapsedRealtime();
                    assertTrue("The normal shell identity read did not reach bounded EOF", remaining > 0);
                    poll.revents = 0;
                    int ready = android.system.Os.poll(new android.system.StructPollfd[] {poll}, (int) remaining);
                    if (ready == 0) continue; // Same read wait, never another command.
                    assertEquals("The shell identity descriptor failed", 0,
                        poll.revents & (android.system.OsConstants.POLLERR | android.system.OsConstants.POLLNVAL));
                    assertTrue("The shell identity pipe has no readable/closed observation",
                        (poll.revents & (android.system.OsConstants.POLLIN | android.system.OsConstants.POLLHUP)) != 0);
                    int read = output.read(bytes, count, bytes.length - count);
                    if (read == -1) ended = true;
                    else {
                        assertTrue("The shell identity read made no progress", read > 0);
                        count += read;
                        assertTrue("The fixed shell identity response exceeded its bound", count < bytes.length);
                    }
                }
                assertEquals("The normal command route must actually run as shell",
                    "2000\n", new String(bytes, 0, count, StandardCharsets.US_ASCII));
                System.out.println("SHELL_COMMAND_ROUTE=UID_2000_OBSERVED; not Activity identity or manager authority");
            }
        }
    }

    private static void requireShellStatusArtifactsAbsent(java.io.File root) {
        for (String directory : new String[] {
            NativePrivateMutationEpochStore.DIRECTORY,
            NativePrivateCustodyOperationStore.DIRECTORY,
            NativePrivateCapsuleFileStore.DIRECTORY,
            VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,
            NativeOriginalInventoryAckIntentJournal.DIRECTORY,
            NativeOriginalInventoryAckRequestJournal.DIRECTORY,
            NativeOriginalInventoryAckUnknownJournal.DIRECTORY
        }) {
            assertTrue("Read-only shell status must not provision protected artifacts: " + directory,
                java.nio.file.Files.notExists(root.toPath().resolve(directory), java.nio.file.LinkOption.NOFOLLOW_LINKS));
        }
    }

    private static Button requireShellStatusButton(android.app.Activity activity, String text) {
        TextView view = findShellStatusText(activity.getWindow().getDecorView(), text);
        assertTrue("The actual maintenance button is missing: " + text, view instanceof Button);
        assertTrue(view.isShown());
        return (Button) view;
    }

    private static TextView findShellStatusText(View view, String text) {
        if (view instanceof TextView && text.contentEquals(((TextView) view).getText())) return (TextView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) {
                TextView found = findShellStatusText(group.getChildAt(index), text);
                if (found != null) return found;
            }
        }
        return null;
    }

    private static void verifyNormalBootstrapAssets(Context context) throws Exception {
        byte[] declaration;
        byte[] bootstrap;
        try (var input = context.getAssets().open("public/build.json")) { declaration = input.readAllBytes(); }
        try (var input = context.getAssets().open("public/memphis-custodial-original-browser.js")) { bootstrap = input.readAllBytes(); }
        JSONObject build = new JSONObject(new String(declaration, StandardCharsets.UTF_8));
        assertEquals("custodial", build.getString("edition"));
        JSONObject source = build.getJSONObject("native_original_browser_bootstrap");
        assertEquals("custodial.native-original-browser-bootstrap-asset.v1", source.getString("schema"));
        assertEquals("memphis-custodial-original-browser.js", source.getString("asset"));
        StringBuilder digest = new StringBuilder();
        for (byte value : MessageDigest.getInstance("SHA-256").digest(bootstrap)) {
            digest.append(Character.forDigit((value & 255) >>> 4, 16));
            digest.append(Character.forDigit(value & 15, 16));
        }
        assertEquals(source.getString("sha256"), digest.toString());
    }

    private static JSONObject awaitLocalDocument(BridgeSmokeActivity activity) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 8_000;
        JSONObject last = null;
        do {
            CountDownLatch received = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();
            activity.runOnUiThread(() -> activity.getBridge().getWebView().evaluateJavascript(
                "JSON.stringify({state:document.readyState,origin:location.origin,"
                    + "text:document.getElementById('ready')?.textContent||'',"
                    + "source:typeof window.custodialOriginalBrowserPreparation})",
                value -> { result.set(value); received.countDown(); }));
            assertTrue("WebView evaluation did not settle", received.await(2, TimeUnit.SECONDS));
            Object unwrapped = new org.json.JSONTokener(result.get()).nextValue();
            assertTrue("The native evaluation must return serialized DATA", unwrapped instanceof String);
            last = new JSONObject((String) unwrapped);
            if ("complete".equals(last.getString("state")) && "ready".equals(last.getString("text"))) return last;
            SystemClock.sleep(25); // bounded readiness polling, not authority or a renewed capture lifetime
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("The actual local Bridge document did not load: " + last);
    }

    /** Native platform root profile DATA only; never bootstrap admission. */
    @Test(timeout = 15_000)
    public void originalContextNoBackupRootModeObservationDoesNotProvisionAuthority() throws Exception {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Context application = target.getApplicationContext();
        assertNotNull(application);
        assertSame(application, application.getApplicationContext());
        assertTrue("Only the disposable test application is in scope", application.getPackageName().endsWith(".test"));
        assertEquals(target.getPackageName(), application.getPackageName());
        assertEquals(android.os.Process.myUid(), application.getApplicationInfo().uid);
        assertTrue("Managed emulator prerequisite", Build.FINGERPRINT.contains("generic")
            || (Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE)));
        java.io.File original = application.getNoBackupFilesDir();
        assertNotNull(original);
        assertTrue(original.isAbsolute());
        java.io.File canonical = original.getCanonicalFile();
        var before = java.nio.file.Files.readAttributes(original.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeBefore = android.system.Os.lstat(original.getAbsolutePath());
        var canonicalBefore = java.nio.file.Files.readAttributes(canonical.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeCanonical = android.system.Os.lstat(canonical.getAbsolutePath());
        assertTrue(before.isDirectory());
        assertFalse("Final original root component must not be a symlink", before.isSymbolicLink());
        assertTrue(android.system.OsConstants.S_ISDIR(nativeBefore.st_mode));
        assertFalse(android.system.OsConstants.S_ISLNK(nativeBefore.st_mode));
        assertTrue(canonicalBefore.isDirectory());assertFalse(canonicalBefore.isSymbolicLink());
        assertNotNull(before.fileKey());assertNotNull(before.owner());assertNotNull(before.group());
        assertEquals(before.fileKey(), canonicalBefore.fileKey());
        assertEquals(before.owner(), canonicalBefore.owner());assertEquals(before.group(), canonicalBefore.group());
        assertEquals(before.permissions(), canonicalBefore.permissions());
        assertEquals(nativeBefore.st_dev, nativeCanonical.st_dev);assertEquals(nativeBefore.st_ino, nativeCanonical.st_ino);
        assertEquals(android.os.Process.myUid(), nativeBefore.st_uid);
        assertEquals(nativeBefore.st_uid, nativeCanonical.st_uid);assertEquals(nativeBefore.st_gid, nativeCanonical.st_gid);
        final int mode = nativeBefore.st_mode & 07777;
        assertEquals(mode, nativeCanonical.st_mode & 07777);
        var childNames = new java.util.TreeSet<String>();
        try (var children = java.nio.file.Files.newDirectoryStream(original.toPath())) {
            for (var child : children) {
                assertTrue("Disposable root enumeration must remain bounded", childNames.size() < 256);
                childNames.add(child.getFileName().toString());
            }
        }
        requireShellStatusArtifactsAbsent(original);

        // The ONLY shipping root observation. It cannot establish a journal,
        // counter/baseline, root permission requirement or bootstrap owner.
        java.io.File observed = NativePrivateMutationEpochStore.originalContextNoBackupRoot(application);
        assertTrue("Shipping observation must return the original canonical root", canonical.equals(observed));
        assertSame(application, target.getApplicationContext());
        assertSame(application, application.getApplicationContext());
        assertEquals(android.os.Process.myUid(), application.getApplicationInfo().uid);
        assertTrue("Same Context must retain its original root", original.equals(application.getNoBackupFilesDir()));
        assertTrue("Same Context must retain its canonical root", canonical.equals(application.getNoBackupFilesDir().getCanonicalFile()));
        var after = java.nio.file.Files.readAttributes(original.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeAfter = android.system.Os.lstat(original.getAbsolutePath());
        var observedAfter = java.nio.file.Files.readAttributes(observed.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeObserved = android.system.Os.lstat(observed.getAbsolutePath());
        assertTrue(after.isDirectory());assertFalse(after.isSymbolicLink());
        assertTrue(observedAfter.isDirectory());assertFalse(observedAfter.isSymbolicLink());
        assertEquals(before.fileKey(), after.fileKey());assertEquals(before.fileKey(), observedAfter.fileKey());
        assertEquals(before.owner(), after.owner());assertEquals(before.owner(), observedAfter.owner());
        assertEquals(before.group(), after.group());assertEquals(before.group(), observedAfter.group());
        assertEquals(before.permissions(), after.permissions());assertEquals(before.permissions(), observedAfter.permissions());
        assertEquals(nativeBefore.st_dev, nativeAfter.st_dev);assertEquals(nativeBefore.st_ino, nativeAfter.st_ino);
        assertEquals(nativeBefore.st_dev, nativeObserved.st_dev);assertEquals(nativeBefore.st_ino, nativeObserved.st_ino);
        assertEquals(nativeBefore.st_mode, nativeAfter.st_mode);assertEquals(nativeBefore.st_mode, nativeObserved.st_mode);
        assertEquals(nativeBefore.st_uid, nativeAfter.st_uid);assertEquals(nativeBefore.st_uid, nativeObserved.st_uid);
        assertEquals(nativeBefore.st_gid, nativeAfter.st_gid);assertEquals(nativeBefore.st_gid, nativeObserved.st_gid);
        var currentNames = new java.util.TreeSet<String>();
        try (var children = java.nio.file.Files.newDirectoryStream(observed.toPath())) {
            for (var child : children) {
                assertTrue("Disposable root enumeration must remain bounded", currentNames.size() < 256);
                currentNames.add(child.getFileName().toString());
            }
        }
        assertTrue("Read-only root observation changed children", childNames.equals(currentNames));
        requireShellStatusArtifactsAbsent(observed);
        // Report actual native mode, without assuming 0700/0771 or logging
        // any path, child name, inode, principal, key or original value.
        System.out.println("UNIT_ORIGINAL_CONTEXT_NO_BACKUP_ROOT_PROFILE mode="
            + String.format(java.util.Locale.ROOT, "%04o", mode)
            + " uid=" + nativeBefore.st_uid + " gid=" + nativeBefore.st_gid
            + " exact0700=" + (mode == 0700) + "; READ_ONLY_NOT_BOOTSTRAP_AUTHORITY");
    }

    /** Actual Context provenance through the shipping absent-journal recovery
     * caller; never a bootstrap, HELD lease or scalar admission fixture. */
    @Test(timeout = 15_000)
    public void contextRootProvenanceSurvivesReadOnlyAbsentJournalRecovery() throws Exception {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Context application = target.getApplicationContext();
        assertNotNull(application);assertSame(application, application.getApplicationContext());
        assertTrue("Only the disposable test application is in scope", application.getPackageName().endsWith(".test"));
        assertEquals(target.getPackageName(), application.getPackageName());
        assertEquals(android.os.Process.myUid(), application.getApplicationInfo().uid);
        assertTrue("Managed emulator prerequisite", Build.FINGERPRINT.contains("generic")
            || (Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE)));
        java.io.File root = application.getNoBackupFilesDir();assertNotNull(root);assertTrue(root.isAbsolute());
        java.io.File canonical = root.getCanonicalFile();
        var before = java.nio.file.Files.readAttributes(root.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeBefore = android.system.Os.lstat(root.getAbsolutePath());
        var canonicalBefore = java.nio.file.Files.readAttributes(canonical.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(before.isDirectory());assertFalse(before.isSymbolicLink());assertNotNull(before.fileKey());
        assertTrue(canonicalBefore.isDirectory());assertFalse(canonicalBefore.isSymbolicLink());
        assertEquals(before.fileKey(), canonicalBefore.fileKey());assertEquals(before.owner(), canonicalBefore.owner());
        assertEquals(android.os.Process.myUid(), nativeBefore.st_uid);
        assertTrue(android.system.OsConstants.S_ISDIR(nativeBefore.st_mode));
        assertFalse(android.system.OsConstants.S_ISLNK(nativeBefore.st_mode));
        var childrenBefore = new java.util.TreeSet<String>();
        try (var children = java.nio.file.Files.newDirectoryStream(root.toPath())) {
            for (var child : children) {
                assertTrue("Disposable root enumeration must remain bounded", childrenBefore.size() < 256);
                childrenBefore.add(child.getFileName().toString());
            }
        }
        requireShellStatusArtifactsAbsent(root);
        java.util.Map<String, java.util.Map<String, ?>> preferencesBefore = new java.util.TreeMap<>();
        for (String name : NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
            preferencesBefore.put(name, new java.util.HashMap<>(application.getSharedPreferences(name, Context.MODE_PRIVATE).getAll()));

        // Main-owned typed API: a private-constructor provenance observation,
        // NOT a File/permission/profile, epoch, baseline or effect token.
        NativePrivateMutationEpochStore.ContextRoot provenance =
            NativePrivateMutationEpochStore.observeOriginalContextRoot(application);
        provenance.requireCurrent();
        VaultFailure nullRoot = assertThrows(VaultFailure.class,
            () -> NativePrivateMutationEpochStore.observeOriginalContextRoot(null));
        assertEquals(NativePrivateMutationEpochStore.FAILURE, nullRoot.code);
        VaultFailure nullRecovery = assertThrows(VaultFailure.class,
            () -> AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournal((Context) null));
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, nullRecovery.code);
        VaultFailure absentBefore = assertThrows(VaultFailure.class, () -> {
            try (var unexpected = AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()) {
                fail("Absent original journal must not issue a HELD read");
            }
        });
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, absentBefore.code);

        // Exactly ONE actual nonnull-Context recovery. Its existing internal
        // process rejection epoch may advance; no durable epoch is invented.
        AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournal(application);
        provenance.requireCurrent();
        VaultFailure absentAfter = assertThrows(VaultFailure.class, () -> {
            try (var unexpected = AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()) {
                fail("Read-only absence recovery must not mint a HELD lease");
            }
        });
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, absentAfter.code);
        assertSame(application, target.getApplicationContext());assertSame(application, application.getApplicationContext());
        assertEquals(android.os.Process.myUid(), application.getApplicationInfo().uid);
        assertTrue("Original Context root changed", root.equals(application.getNoBackupFilesDir()));
        assertTrue("Original canonical root changed", canonical.equals(application.getNoBackupFilesDir().getCanonicalFile()));
        var after = java.nio.file.Files.readAttributes(root.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var nativeAfter = android.system.Os.lstat(root.getAbsolutePath());
        var canonicalAfter = java.nio.file.Files.readAttributes(canonical.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(after.isDirectory());assertFalse(after.isSymbolicLink());
        assertTrue(canonicalAfter.isDirectory());assertFalse(canonicalAfter.isSymbolicLink());
        assertEquals(before.fileKey(), after.fileKey());assertEquals(before.fileKey(), canonicalAfter.fileKey());
        assertEquals(before.owner(), after.owner());assertEquals(before.owner(), canonicalAfter.owner());
        assertEquals(before.group(), after.group());assertEquals(before.group(), canonicalAfter.group());
        assertEquals(before.permissions(), after.permissions());assertEquals(before.permissions(), canonicalAfter.permissions());
        assertEquals(nativeBefore.st_dev, nativeAfter.st_dev);assertEquals(nativeBefore.st_ino, nativeAfter.st_ino);
        assertEquals(nativeBefore.st_uid, nativeAfter.st_uid);assertEquals(nativeBefore.st_gid, nativeAfter.st_gid);
        assertEquals("Observe original mode without imposing or changing a permission profile", nativeBefore.st_mode, nativeAfter.st_mode);
        var childrenAfter = new java.util.TreeSet<String>();
        try (var children = java.nio.file.Files.newDirectoryStream(root.toPath())) {
            for (var child : children) {
                assertTrue("Disposable root enumeration must remain bounded", childrenAfter.size() < 256);
                childrenAfter.add(child.getFileName().toString());
            }
        }
        assertTrue("Recovery changed original children", childrenBefore.equals(childrenAfter));
        requireShellStatusArtifactsAbsent(root);
        java.util.Map<String, java.util.Map<String, ?>> preferencesAfter = new java.util.TreeMap<>();
        for (String name : NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
            preferencesAfter.put(name, new java.util.HashMap<>(application.getSharedPreferences(name, Context.MODE_PRIVATE).getAll()));
        assertTrue("Read-only recovery changed original native preferences", preferencesBefore.equals(preferencesAfter));
        provenance.requireCurrent();
    }

    /** Actual Context/all8 initial rejection metadata, with SYNTHETIC53
     * provider admission INPUT only. Not installed-app/server/ACK authority. */
    @Test(timeout = 120_000)
    public void initialNativeContextBaselinePreservesOriginalAllEightOwners() throws Exception {
        var fixture = new InitialNativeFixture();
        var application = fixture.application;
        var root = fixture.root;
        var rootBefore = fixture.rootBefore;
        var posixBefore = fixture.posixBefore;
        var originalRootChildren = fixture.originalRootChildren;
        var provenance = fixture.provenance;
        var unit = fixture.unit;
        var enrolls = fixture.enrolls;
        var confirms = fixture.confirms;
        var unexpected = fixture.unexpected;
        var persistence = fixture.persistence;
        var work = fixture.work;
        var principalJournal = fixture.principalJournal;
        var legacy = fixture.legacy;
        var cipher = fixture.cipher;
        var engine = fixture.engine;
        var providerCoordinator = fixture.providerCoordinator;
        var proof = fixture.proof;
        var owners = fixture.owners;
        var originalPayload = fixture.originalPayload;
        var originalVault = fixture.originalVault;
        var originalPrincipal = fixture.originalPrincipal;
        var aliases = fixture.aliases;
        assertTrue(aliases.contains(AndroidKeystoreCipher.KEY_ALIAS));assertTrue(aliases.contains(AndroidProviderCipher.KEY_ALIAS));
        requireShellStatusArtifactsAbsent(root);provenance.requireCurrent();
        assertEquals("PROCESS_ONLY", AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        // Real fixed Context readers only; no imported/same-count reader model.
        try (var prior = NativeProtectedNamespaceObservation.observe(AndroidProtectedNamespaceReaders.bind(owners));
            var control = new NativePrivateCustodyFrameReadControl()) {
            assertTrue(prior.stillCurrent());assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet(), prior.recordCounts.keySet());
            assertFalse(prior.accepted);assertFalse(prior.inventoryAcknowledged);assertFalse(prior.keyRemovalAllowed);assertFalse(prior.phoneReleased);
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(application, engine, work,
                principalJournal, legacy, providerCoordinator, control);
            control.check();provenance.requireCurrent();
            assertFalse("Baseline must invalidate the old PROCESS_ONLY capture, not promote it", prior.stillCurrent());
            assertEquals("DURABLE_ATTEMPT:0", AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        }
        java.nio.file.Path directory = root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        initialBootstrapMode(directory, 0700, true);
        assertEquals(java.util.Set.of(NativePrivateMutationEpochStore.LOCK, NativePrivateMutationEpochStore.BASELINE,
            NativePrivateMutationEpochStore.CURRENT), initialBootstrapChildNames(directory));
        java.util.Map<String, byte[]> metadataBytes = new java.util.TreeMap<>();
        java.util.Map<String, Object> metadataKeys = new java.util.TreeMap<>();
        try {
            for (String name : initialBootstrapChildNames(directory)) {
                var file = directory.resolve(name);initialBootstrapMode(file, 0600, false);
                assertTrue("Fixed initial metadata size bound", java.nio.file.Files.size(file) <= 4096);
                metadataBytes.put(name, java.nio.file.Files.readAllBytes(file));
                metadataKeys.put(name, java.nio.file.Files.readAttributes(file,
                    java.nio.file.attribute.BasicFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                assertNotNull(metadataKeys.get(name));
            }
            // Existing typed native validation, not a test baseline decoder.
            var journal = NativePrivateMutationEpochStore.fromContext(application);
            try (var current = journal.readCurrent()) {
                assertEquals(0L, current.counter());assertNull(current.heldOriginal());journal.requireCurrent(current);
            }
            assertTrue("All8 original payload must stay exact", initialBootstrapSameRaw(originalPayload, initialBootstrapRawOwners(owners)));
            assertEquals(originalVault, persistence.load());assertEquals(originalPrincipal, work.loadPrincipal());
            assertEquals(proof.body, NativeSeparationFreeze.restore(engine, work, principalJournal, legacy).body);
            assertEquals(proof.signature, NativeSeparationFreeze.restore(engine, work, principalJournal, legacy).signature);
            char[] expected = InstrumentedTransport.CREDENTIAL.toCharArray(), retained = null;
            try {retained = cipher.decrypt(persistence.load().secret);assertArrayEquals(expected, retained);}
            finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
            assertEquals("No key retirement/replacement or new alias", aliases, initialBootstrapAliases());
            var expectedChildren = new java.util.TreeSet<>(originalRootChildren);expectedChildren.add(NativePrivateMutationEpochStore.DIRECTORY);
            assertTrue("Only initial metadata directory may be added", expectedChildren.equals(initialBootstrapChildNames(root.toPath())));
            for (String name : new String[] {NativePrivateCustodyOperationStore.DIRECTORY, NativePrivateCapsuleFileStore.DIRECTORY,
                VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY, NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                NativeOriginalInventoryAckRequestJournal.DIRECTORY, NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                assertTrue("No custody or inventory/ACK artifacts", java.nio.file.Files.notExists(root.toPath().resolve(name), java.nio.file.LinkOption.NOFOLLOW_LINKS));
            VaultFailure noHeld = assertThrows(VaultFailure.class, () -> {
                try (var unexpectedHeld = AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()) {fail("Initial baseline is not HELD/ACK authority");}
            });
            assertEquals(AndroidProtectedWorkPreferences.FAILURE, noHeld.code);
            assertEquals(AndroidProtectedWorkPreferences.FAILURE, assertThrows(VaultFailure.class, work::requireWorkAdmission).code);
            var rootAfter = android.system.Os.lstat(root.getAbsolutePath());
            var posixAfter = java.nio.file.Files.readAttributes(root.toPath(),
                java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertEquals(rootBefore.st_mode, rootAfter.st_mode);assertEquals(rootBefore.st_uid, rootAfter.st_uid);assertEquals(rootBefore.st_gid, rootAfter.st_gid);
            assertEquals(rootBefore.st_dev, rootAfter.st_dev);assertEquals(rootBefore.st_ino, rootAfter.st_ino);
            assertEquals(posixBefore.fileKey(), posixAfter.fileKey());assertEquals(posixBefore.owner(), posixAfter.owner());
            assertEquals(posixBefore.group(), posixAfter.group());assertEquals(posixBefore.permissions(), posixAfter.permissions());provenance.requireCurrent();
            for (String name : metadataBytes.keySet()) {
                var file = directory.resolve(name);initialBootstrapMode(file, 0600, false);
                assertArrayEquals(metadataBytes.get(name), java.nio.file.Files.readAllBytes(file));
                assertEquals(metadataKeys.get(name), java.nio.file.Files.readAttributes(file,
                    java.nio.file.attribute.BasicFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }
            assertEquals(1, enrolls.get());assertEquals(1, confirms.get());assertEquals(0, unexpected.get());
            assertEquals(0, unit.completionCalls.get());assertEquals(0, unit.cancelCalls.get());assertEquals(0, unit.removeCalls.get());
        } finally {
            // Leave ALL original aliases/payloads/WORK hold and metadata on disk
            // after every outcome. Wipe only this test's volatile byte copies.
            for (byte[] bytes : metadataBytes.values()) java.util.Arrays.fill(bytes, (byte) 0);
        }
    }

    private static AuthorizedResponse initialBootstrapUnitResponse(JSONObject data) throws Exception {
        return new AuthorizedResponse(200, java.util.Map.of("Content-Type", "application/json"),
            new JSONObject().put("ok", true).put("data", data).toString().getBytes(StandardCharsets.UTF_8));
    }

    private static java.util.Set<String> initialBootstrapChildNames(java.nio.file.Path root) throws Exception {
        java.util.Set<String> result = new java.util.TreeSet<>();
        try (var children = java.nio.file.Files.newDirectoryStream(root)) {
            for (var child : children) {assertTrue("UNIT child observation bound", result.size() < 256);result.add(child.getFileName().toString());}
        }
        return result;
    }

    private static java.util.Map<String, java.util.Map<String, ?>> initialBootstrapRawOwners(
        java.util.Map<String, android.content.SharedPreferences> owners) {
        java.util.Map<String, java.util.Map<String, ?>> raw = new java.util.TreeMap<>();
        for (String name : NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()) raw.put(name, new java.util.HashMap<>(owners.get(name).getAll()));
        return raw;
    }

    private static boolean initialBootstrapSameRaw(java.util.Map<String, java.util.Map<String, ?>> a,
        java.util.Map<String, java.util.Map<String, ?>> b) throws VaultFailure {
        if (!a.keySet().equals(b.keySet())) return false;
        for (String name : a.keySet()) if (!NativeProtectedWorkSnapshot.exactRawEquals(a.get(name), b.get(name))) return false;
        return true;
    }

    private static java.util.Set<String> initialBootstrapAliases() throws Exception {
        var store = java.security.KeyStore.getInstance("AndroidKeyStore");store.load(null);
        return new java.util.TreeSet<>(java.util.Collections.list(store.aliases()));
    }

    private static void initialBootstrapMode(java.nio.file.Path path, int mode, boolean directory) throws Exception {
        var attributes = java.nio.file.Files.readAttributes(path, java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);
        var actual = android.system.Os.lstat(path.toString());
        assertFalse(attributes.isSymbolicLink());assertEquals(directory, attributes.isDirectory());
        if (!directory) assertTrue(attributes.isRegularFile());
        assertEquals(android.os.Process.myUid(), actual.st_uid);assertEquals(mode, actual.st_mode & 07777);
    }

    /** Test-local arrangement extracted ONLY from the latest N0 member. No
     * public authority, fake reader family or baseline/retention call. */
    /** Normal pre-freeze Android WORK/signature/receipt producers. All civil
     * values and response DATA here are UNIT input, not qualified clock/SQL.
     * No recorded original is replaced, transplanted, or signed after freeze. */
    private static String initialBrowserCompletionInput(Context application,VaultEngine engine,
        AndroidOfflineAuthorityTimeStore work) throws Exception {
        work.requireWorkAdmission();
        final String device="KIOSK_02",session="95000000-0000-4000-8000-000000000201",
            completion="95000000-0000-4000-8000-000000000202",finish="95000000-0000-4000-8000-000000000203",
            context="95000000-0000-4000-8000-000000000204",scan="95000000-0000-4000-8000-000000000205";
        long now=System.currentTimeMillis();
        String start=VaultTimestamps.fromEpochMillisExact(now-2000),end=VaultTimestamps.fromEpochMillisExact(now-1000);
        int boot=android.provider.Settings.Global.getInt(application.getContentResolver(),android.provider.Settings.Global.BOOT_COUNT,-1);
        assertTrue("Actual Android boot observation unavailable",boot>=0);
        var occurrence=new OfflineAuthorityTime.OfflineOccurrence(session,device,"NOCX","a".repeat(64),
            VaultTimestamps.fromEpochMillisExact(now-3000),VaultTimestamps.fromEpochMillisExact(now+60000),
            VaultTimestamps.fromEpochMillisExact(now-3000),SystemClock.elapsedRealtime(),boot,scan,start,end);
        assertNull(work.loadOccurrence(session));work.saveOccurrence(occurrence);work.saveFinishEntryId(occurrence,finish);
        assertEquals(finish,work.loadFinishEntryId(work.loadOccurrence(session)));
        var args=new JSONObject().put("p_device_id",device).put("p_location_code","NOCX")
            .put("p_client_session_id",session).put("p_client_completion_id",completion)
            .put("p_correlation_id","scan-commit:"+session+":"+completion).put("p_native_finish_scan_entry_id",finish)
            .put("p_client_started_at",start).put("p_client_ended_at",end)
            .put("p_response_json",new JSONObject().put("services_performed",new org.json.JSONArray().put("Full cleaning services"))
                .put("__custodial_offline_reconciliation_v1",new JSONObject().put("context_id",context).put("submission_proof","c".repeat(64))))
            .put("p_scan_evidence",new org.json.JSONArray().put(new JSONObject().put("client_event_id",finish)));
        for(var field:engine.attestOfflineCompletion(device,"NOCX",session,completion,context,finish,start,end,null,null).entrySet())
            args.put(field.getKey(),field.getValue());
        byte[] body=new JSONObject().put("device_id",device).put("fn","tool_commit_cleaning_workflow").put("args",args)
            .toString().getBytes(StandardCharsets.UTF_8);
        var request=new AuthorizedRequest("/scan-api/rpc","POST",java.util.Map.of(),body);AuthorizedResponse response=null;
        try {
            response=engine.authorizedRequest(device,request);
            new NativeCompletionJournal(work).captureAuthenticatedResponse(device,request,response);
            var receipts=new java.util.ArrayList<String>();
            for(String key:work.separationRawSnapshot().keySet())if(key.startsWith("authenticated_completion_receipt_sha256:"))receipts.add(key);
            assertEquals("One normal original receipt before freeze",1,receipts.size());
            String key=receipts.get(0).substring("authenticated_completion_receipt_sha256:".length());
            String retainedArguments;
            try(var saved=NativeCompletionJournal.inspectRetainedOriginalRequest(device,key,work.loadCompletionReceipt(key))) {
                assertTrue(saved.originalValuesAvailable);byte[] original=saved.originalBody();
                try{assertArrayEquals(request.body,original);}finally{java.util.Arrays.fill(original,(byte)0);}
                assertTrue(ProviderWireJson.same(args,saved.originalArgs()));
                retainedArguments=saved.originalArgs().toString();
            }
            work.requireWorkAdmission();return retainedArguments;
        } finally {
            java.util.Arrays.fill(body,(byte)0);java.util.Arrays.fill(request.body,(byte)0);
            if(response!=null)java.util.Arrays.fill(response.body,(byte)0);
        }
    }

    static final class InitialNativeFixture {
        final Context application;
        final java.io.File root;
        final android.system.StructStat rootBefore;
        final java.nio.file.attribute.PosixFileAttributes posixBefore;
        final java.util.Set<String> originalRootChildren;
        final NativePrivateMutationEpochStore.ContextRoot provenance;
        final InstrumentedTransport unit;
        final java.util.concurrent.atomic.AtomicInteger enrolls;
        final java.util.concurrent.atomic.AtomicInteger confirms;
        final java.util.concurrent.atomic.AtomicInteger unexpected;
        final SharedPreferencesVaultPersistence persistence;
        final AndroidOfflineAuthorityTimeStore work;
        final NativePrincipalJournal principalJournal;
        final NativeLegacyLineageJournal legacy;
        final AndroidKeystoreCipher cipher;
        final VaultEngine engine;
        final Object providerCoordinator;
        final NativeSeparationEvidence proof;
        final java.util.Map<String, android.content.SharedPreferences> owners;
        final java.util.Map<String, java.util.Map<String, ?>> originalPayload;
        final VaultSnapshot originalVault;
        final String originalPrincipal;
        final java.util.Set<String> aliases;
        final String generationId;
        final String unitCompletionArguments;
        InitialNativeFixture() throws Exception {this(false);}
        InitialNativeFixture(boolean completionInput) throws Exception {this(completionInput,null);}
        InitialNativeFixture(boolean completionInput,java.util.function.UnaryOperator<Context> beforeCaptureContext) throws Exception {
        // Exact existing UID/manifest/alias/blank-state guard BEFORE any key
        // or fixture record creation. Unknown originals are NOT_RUN, not reset.
        Context context = ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        // NEW selector only: one deterministic test wrapper selected BEFORE
        // any original prefs/adapter/capture. No owner replacement after birth.
        Context application = beforeCaptureContext==null?context.getApplicationContext():
            java.util.Objects.requireNonNull(beforeCaptureContext.apply(context.getApplicationContext()));
        assertSame(application,application.getApplicationContext());
        VaultFailure realIdentityRefused = assertThrows(VaultFailure.class,
            () -> AndroidProviderAppIdentity.read(application));
        assertEquals("custodial_provider_native_build_identity_invalid", realIdentityRefused.code);
        java.io.File root = application.getNoBackupFilesDir();
        var rootBefore = android.system.Os.lstat(root.getAbsolutePath());
        var posixBefore = java.nio.file.Files.readAttributes(root.toPath(),
            java.nio.file.attribute.PosixFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(posixBefore.isDirectory());assertFalse(posixBefore.isSymbolicLink());assertNotNull(posixBefore.fileKey());
        assertEquals(android.os.Process.myUid(), rootBefore.st_uid);
        requireShellStatusArtifactsAbsent(root);
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        var originalRootChildren = initialBootstrapChildNames(root.toPath());
        NativePrivateMutationEpochStore.ContextRoot provenance = NativePrivateMutationEpochStore.observeOriginalContextRoot(application);

        // Existing Android fixture's normal Engine enrollment/binding path,
        // LOCAL UNIT transport only: exactly one enroll/confirm during setup.
        // Every other request (and all requests after setup) must refuse.
        VaultClock clock = System::currentTimeMillis;
        InstrumentedTransport unit = new InstrumentedTransport(clock);
        unit.serveCompletion=completionInput;
        var completionSetup=new java.util.concurrent.atomic.AtomicBoolean(completionInput);
        var setup = new java.util.concurrent.atomic.AtomicBoolean(true);
        var enrolls = new java.util.concurrent.atomic.AtomicInteger();
        var confirms = new java.util.concurrent.atomic.AtomicInteger();
        var unexpected = new java.util.concurrent.atomic.AtomicInteger();
        final String operation = "95000000-0000-4000-8000-000000000004", device = "KIOSK_02";
        EnrollmentTransport local = new EnrollmentTransport() {
            private VaultFailure refused() {unexpected.incrementAndGet();return new VaultFailure("UNIT_bootstrap_unexpected_transport");}
            public EnrollmentResult enroll(EnrollmentRequest r, char[] code) throws VaultFailure {
                if (!setup.get() || !operation.equals(r.operationId) || !device.equals(r.deviceId)
                    || !"enrollment".equals(r.flow) || enrolls.incrementAndGet() != 1) throw refused();
                return unit.enroll(r, code);
            }
            public TerminalResult confirm(String o, String d, char[] c) throws VaultFailure {
                if (!setup.get() || !operation.equals(o) || !device.equals(d) || confirms.incrementAndGet() != 1) throw refused();
                return unit.confirm(o, d, c);
            }
            public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure {throw refused();}
            public TerminalResult remove(String o,String d,char[] c)throws VaultFailure {throw refused();}
            public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure {throw refused();}
            public ActiveCredentialStatus verifyActiveCredential(String d,String i,char[] c)throws VaultFailure {throw refused();}
            public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c)throws VaultFailure {
                if(!completionSetup.compareAndSet(true,false)||!"/scan-api/rpc".equals(r.path)||!"POST".equals(r.method))throw refused();
                return unit.authorized(r,d,c);
            }
            public String reportAssignedActivation(String o,String d,char[] c,java.util.Map<String,Object> r)throws VaultFailure {throw refused();}
            public NativeLegacyLineageJournal.Binding resolveLegacyLineage(NativeLegacyLineageJournal.Context c,char[] k)throws VaultFailure {throw refused();}
            public NativeLegacyLineageJournal.Terminal reportLegacyActivation(NativeLegacyLineageJournal.Context c,
                NativeLegacyLineageJournal.Binding b,JSONObject r,char[] k)throws VaultFailure {throw refused();}
        };
        var persistence = new SharedPreferencesVaultPersistence(application, new VaultSnapshotCodec());
        var work = new AndroidOfflineAuthorityTimeStore(application);
        var principalJournal = new NativePrincipalJournal(work);
        var legacy = new NativeLegacyLineageJournal(work);
        var cipher = new AndroidKeystoreCipher();
        var engine = new VaultEngine(persistence, cipher, local, new LegacyVaultSource() {
            public LegacyMaterial read() {return null;}
            public void cleanup() {throw new AssertionError("UNIT setup must not clean legacy records");}
            public boolean isClean() {return true;}
        }, () -> "unit-initial-baseline-installation-seal", clock, work);
        char[] enrollmentCode = "12345678".toCharArray();
        try {engine.enroll(operation, device, "enrollment", enrollmentCode);}
        finally {VaultValidation.wipe(enrollmentCode);}
        engine.completeLocalBinding(operation);engine.confirmEnrollment(operation);setup.set(false);
        assertEquals(1, enrolls.get());assertEquals(1, confirms.get());assertEquals(0, unexpected.get());
        var state = engine.observeStateReadOnly();assertEquals("ACTIVE", state.get("state"));
        String credentialId = (String) state.get("active_credential_id");
        JSONObject statusData = new JSONObject().put("authenticated", true).put("canonical_device_id", device)
            .put("employee_id", "95000000-0000-4000-8000-000000000002").put("assignment_epoch", 7)
            .put("credential_id", credentialId);
        // Existing pure journal capture recipe; NO live HTTP or manager status.
        principalJournal.capture(state, new AuthorizedRequest("/device-auth/status", "GET", java.util.Map.of(), new byte[0]),
            initialBootstrapUnitResponse(statusData));
        NativeProviderPrincipal principal = NativeProviderPrincipal.fromNativeJournal(principalJournal.readFor(state));
        // Initial UNIT input ONLY, before the first freeze/capture; this SAME
        // Android owner signs and retains its own one original completion.
        String unitCompletionArguments=completionInput?initialBrowserCompletionInput(application,engine,work):null;
        assertEquals(completionInput?1:0,unit.completionCalls.get());unit.serveCompletion=false;

        // EXACT expressly authorized synthetic53 pure-value recipe. These
        // a/b/c/source_commit_exact literals are NOT current build/release pins.
        JSONObject synthetic53 = new JSONObject().put("edition", "custodial").put("native_build_number", 53L)
            .put("source_commit_exact", true).put("source_commit", "a".repeat(40)).put("source_tree", "b".repeat(40))
            .put("custodial_native_vault_source_sha256", "c".repeat(64))
            .put("build_id", "synthetic.custodial." + "a".repeat(12));
        var nativeAppUnitValue = NativeProviderAppIdentity.fromPackaged(NativeProviderAppIdentity.PACKAGE,
            "0.0.0-synthetic", 53, synthetic53);
        final Object providerCoordinator = AndroidProviderCipher.STORE_LOCK;
        var provider = new NativeProviderJournal(new AndroidProviderStore(application).records(), providerCoordinator);
        provider.observeActivePrincipal(principal);provider.captureToken("UNIT-only-initial-baseline-provider-token");
        var prepared = provider.prepareRegistration(principal, nativeAppUnitValue);
        var unitInstant = java.time.Instant.ofEpochMilli(clock.nowMillis());
        var micros = new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter();
        String activated = micros.format(unitInstant), cutoff = micros.format(unitInstant.plusSeconds(60));
        JSONObject p = prepared.json().getJSONObject("principal");
        // Existing pure registration-admission response recipe, bound to this
        // ONE Prepared. Not validateExchange, live admission or time/profile.
        JSONObject admission = new JSONObject().put("schema", NativeProviderRegistrationReceipt.SCHEMA)
            .put("operation_id", prepared.operationId).put("generation_id", prepared.generationId)
            .put("registration_id", "95000000-0000-4000-8000-000000000088")
            .put("principal_digest", prepared.principalDigest).put("token_digest", prepared.tokenDigest)
            .put("device_id", p.get("device_id")).put("credential_id", p.get("credential_id"))
            .put("employee_id", p.get("employee_id")).put("assignment_epoch", p.get("assignment_epoch"))
            .put("native_app", prepared.json().getJSONObject("native_app")).put("activated_at", activated)
            .put("prior_generation_id", JSONObject.NULL).put("prior_dispatch_retired_at", JSONObject.NULL)
            .put("server_now", activated).put("admitted_state", "ACTIVE").put("replayed", false);
        var confirmed = provider.confirmRegistration(principal, prepared,
            NativeProviderRegistrationReceipt.validateResponse(prepared, initialBootstrapUnitResponse(admission)));
        assertEquals(prepared.generationId, confirmed.generationId);assertTrue(confirmed.confirmed);

        JSONObject contextData = new JSONObject().put("schema", "custodial.separation-context.v1")
            .put("separation_id", "95000000-0000-4000-8000-000000000005").put("authority_revision", 42)
            .put("device_id", "95000000-0000-4000-8000-000000000001").put("canonical_device_id", device)
            .put("employee_id", p.get("employee_id")).put("credential_id", p.get("credential_id"))
            .put("assignment_epoch", p.get("assignment_epoch")).put("cutoff_at", cutoff)
            .put("state", "PENDING_RECONCILIATION").put("native_inventory_state", "UNKNOWN")
            .put("new_work_allowed", false).put("phone_released", false).put("purpose", "SEPARATION_STATUS_ONLY")
            .put("server_known_open_sessions", new org.json.JSONArray());
        // Structural UNIT context plus original Engine-credential signature;
        // NOT a genuine separation API response or original inventory ACK.
        NativeSeparationContext contextUnitValue = NativeSeparationContext.validateRetainedData(contextData, principal);
        var rawWork = work.separationRawSnapshot();
        NativeSeparationEvidence proof = engine.attestNativeSeparationSnapshot(contextUnitValue,
            NativeProtectedWorkSnapshot.capture(rawWork), principalJournal, legacy);
        work.freezeSeparationSnapshot(rawWork, proof);
        assertEquals(proof.body, NativeSeparationFreeze.restore(engine, work, principalJournal, legacy).body);
        var manifest = new JSONObject(proof.body);
        assertFalse(manifest.getBoolean("new_work_allowed"));assertFalse(manifest.getBoolean("phone_released"));
        VaultFailure frozen = assertThrows(VaultFailure.class, work::requireWorkAdmission);
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, frozen.code);

        java.util.Map<String, android.content.SharedPreferences> owners = new java.util.TreeMap<>();
        for (String name : NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
            owners.put(name, application.getSharedPreferences(name, Context.MODE_PRIVATE));
        var originalPayload = initialBootstrapRawOwners(owners);
        var originalVault = persistence.load();String originalPrincipal = work.loadPrincipal();
        var aliases = initialBootstrapAliases();
            this.application = application;
            this.unitCompletionArguments=unitCompletionArguments;
            this.root = root;
            this.rootBefore = rootBefore;
            this.posixBefore = posixBefore;
            this.originalRootChildren = originalRootChildren;
            this.provenance = provenance;
            this.unit = unit;
            this.enrolls = enrolls;
            this.confirms = confirms;
            this.unexpected = unexpected;
            this.persistence = persistence;
            this.work = work;
            this.principalJournal = principalJournal;
            this.legacy = legacy;
            this.cipher = cipher;
            this.engine = engine;
            this.providerCoordinator = providerCoordinator;
            this.proof = proof;
            this.owners = owners;
            this.originalPayload = originalPayload;
            this.originalVault = originalVault;
            this.originalPrincipal = originalPrincipal;
            this.aliases = aliases;
            generationId = confirmed.generationId;
        }
    }

    /** N1 is a new explicit invocation AFTER its arrange-only baseline.
     * Retains local encrypted originals, never sends or creates an ACK. */
    @Test(timeout = 420_000)
    public void initialLocalOriginalRetentionReconstructsSameEncryptedOperationWithoutDispatch() throws Exception {
        var f = new InitialNativeFixture();
        requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
        assertEquals("PROCESS_ONLY", AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
        try (var baselineControl = new NativePrivateCustodyFrameReadControl()) {
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application, f.engine, f.work,
                f.principalJournal, f.legacy, f.providerCoordinator, baselineControl);
            baselineControl.check();
        } // Original baseline invocation ended. It is never reused/renewed.
        var epochDirectory = f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        initialBootstrapMode(epochDirectory, 0700, true);
        assertEquals(java.util.Set.of(NativePrivateMutationEpochStore.LOCK, NativePrivateMutationEpochStore.BASELINE,
            NativePrivateMutationEpochStore.CURRENT), initialBootstrapChildNames(epochDirectory));
        var journal = NativePrivateMutationEpochStore.fromContext(f.application);
        try (var current = journal.readCurrent()) {assertEquals(0L, current.counter());assertNull(current.heldOriginal());}
        String baselineStamp = AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture();
        assertEquals("DURABLE_ATTEMPT:0", baselineStamp);
        java.nio.file.Path baseline = epochDirectory.resolve(NativePrivateMutationEpochStore.BASELINE);
        String baselineDigest = initialRetentionFileDigest(baseline);
        Object baselineKey = java.nio.file.Files.readAttributes(baseline,
            java.nio.file.attribute.BasicFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
        assertTrue(initialBootstrapSameRaw(f.originalPayload, initialBootstrapRawOwners(f.owners)));
        f.provenance.requireCurrent();

        JSONObject local;
        try (var retentionControl = new NativePrivateCustodyFrameReadControl()) {
            local = AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application, f.engine, f.work,
                f.principalJournal, f.legacy, f.providerCoordinator, retentionControl);
            retentionControl.check();
        } // Exactly ONE first-retention attempt; no retry/resume on failure.
        assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY", local.getString("state"));
        assertTrue(local.getBoolean("local_operation_committed_observed"));assertEquals("COMMITTED", local.getString("journal_phase"));
        assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.size(), local.getInt("original_eight_namespaces_count"));
        assertEquals(new java.util.HashSet<>(NativeProtectedNamespaceObservation.KEY_FAMILIES.values()).size(), local.getInt("original_key_family_count"));
        assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.size() + 2, local.getInt("source_declared_native_domain_count"));
        assertEquals(f.generationId, local.getString("original_generation_id"));
        assertInitialRetentionNoEffects(local);
        // Read the actual typed current counter, not a guessed zero after IO.
        // The returned original descriptor must match the actual current stamp.
        try (var current = journal.readCurrent()) {
            journal.requireCurrent(current);assertNull(current.heldOriginal());
            assertEquals("DURABLE_ATTEMPT:" + current.counter(), local.getString("original_native_mutation_stamp"));
        }
        assertEquals(local.getString("original_native_mutation_stamp"),
            AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());

        var capsuleDirectory = f.root.toPath().resolve(NativePrivateCapsuleFileStore.DIRECTORY);
        var operationDirectory = f.root.toPath().resolve(NativePrivateCustodyOperationStore.DIRECTORY);
        initialBootstrapMode(capsuleDirectory, 0700, true);initialBootstrapMode(operationDirectory, 0700, true);
        assertEquals(java.util.Set.of(NativePrivateCapsuleFileStore.COMMITTED, NativePrivateCapsuleFileStore.LOCK), initialBootstrapChildNames(capsuleDirectory));
        assertEquals(java.util.Set.of(NativePrivateCustodyOperationStore.COMMITTED, NativePrivateCustodyOperationStore.LOCK), initialBootstrapChildNames(operationDirectory));
        var capsuleFile = capsuleDirectory.resolve(NativePrivateCapsuleFileStore.COMMITTED);
        var operationFile = operationDirectory.resolve(NativePrivateCustodyOperationStore.COMMITTED);
        java.util.Map<java.nio.file.Path, String> digests = new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path, Object> identities = new java.util.HashMap<>();
        for (var directory : java.util.List.of(epochDirectory, capsuleDirectory, operationDirectory)) {
            for (String name : initialBootstrapChildNames(directory)) {
                var file = directory.resolve(name);initialBootstrapMode(file, 0600, false);
                digests.put(file, initialRetentionFileDigest(file));
                Object key = java.nio.file.Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(key);identities.put(file, key);
            }
        }
        assertEquals(local.getString("journal_record_sha256"), digests.get(operationFile));
        var operations = AndroidPrivateCustodyOperationStore.fromNativeContext(f.application);
        var capsules = AndroidPrivateCapsuleFileStore.fromNativeContext(f.application);
        try (var hint = operations.inspectSavedIdentityHint(); var capsule = capsules.inspectExisting()) {
            assertEquals("COMMITTED", hint.phaseForOwningEngine());operations.requireSavedIdentityHintCurrent(hint);
            assertTrue(capsule.hasOriginalEncryptedRecord());
            JSONObject encrypted = capsule.originalEncryptedRecord().metadata();
            assertEquals(local.getString("record_sha256"), encrypted.getString("record_sha256"));
            assertEquals(digests.get(capsuleFile), encrypted.getString("record_sha256"));
            assertEquals(java.nio.file.Files.size(capsuleFile), encrypted.getLong("record_bytes"));
            assertFalse(encrypted.getBoolean("durably_stored"));assertFalse(encrypted.getBoolean("current_server_readback"));

            // Existing-only consumer confirmed in Source: fixed saved hint ->
            // WORK/provider/all8/capsule/frame/operation reconstruction, then
            // reads existing QUERY slots. No prepare/send/resume/repair branch;
            // absent exchange directory stays absent (no T7 exporter required).
            JSONObject reconstructed = AndroidPrivateCustodyOwnerRecovery.observeOriginal(f.application, f.engine, f.work,
                f.principalJournal, f.legacy, f.providerCoordinator);
            for (String name : new String[] {"operation_id", "frame_sha256", "record_sha256", "journal_record_sha256",
                "original_generation_id", "principal_digest", "engine_revision", "original_frozen_work_sha256"})
                assertEquals("Saved original binding changed: " + name, local.get(name), reconstructed.get(name));
            assertEquals(local.getString("frame_bytes"), Integer.toString(reconstructed.getInt("frame_bytes")));
            assertTrue(reconstructed.getBoolean("saved_hint_matched_full_original_frame_and_immutable_operation_record"));
            assertTrue(reconstructed.getBoolean("original_WORK_provider_all8_capsule_frame_bindings_reconstructed_in_native_only"));
            assertTrue(reconstructed.getBoolean("original_generation_selected_from_existing_committed_operation_not_caller_or_latest"));
            assertTrue(reconstructed.getBoolean("owning_consumer_reads_existing_original_query_slots_only"));
            assertEquals(0, reconstructed.getInt("historical_exact_original_returned_pieces"));
            assertFalse(reconstructed.getBoolean("missing_original_owner_recreated_or_promoted"));
            assertFalse(reconstructed.getBoolean("fresh_WORK_request_timestamp_or_query_signature_created"));
            assertFalse(reconstructed.getBoolean("current_SQL_snapshot_frame_readback"));
            assertInitialRetentionNoEffects(reconstructed);operations.requireSavedIdentityHintCurrent(hint);
        }
        for (var file : digests.keySet()) {
            initialBootstrapMode(file, 0600, false);assertEquals(digests.get(file), initialRetentionFileDigest(file));
            assertEquals(identities.get(file), java.nio.file.Files.readAttributes(file,
                java.nio.file.attribute.BasicFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        }
        assertEquals(baselineDigest, initialRetentionFileDigest(baseline));
        assertEquals(baselineKey, java.nio.file.Files.readAttributes(baseline,
            java.nio.file.attribute.BasicFileAttributes.class, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        assertTrue("All8 original payloads changed", initialBootstrapSameRaw(f.originalPayload, initialBootstrapRawOwners(f.owners)));
        assertEquals(f.originalVault, f.persistence.load());assertEquals(f.originalPrincipal, f.work.loadPrincipal());
        var restoredWork = NativeSeparationFreeze.restore(f.engine, f.work, f.principalJournal, f.legacy);
        assertEquals(f.proof.body, restoredWork.body);assertEquals(f.proof.signature, restoredWork.signature);
        assertEquals(f.aliases, initialBootstrapAliases());
        char[] expected = InstrumentedTransport.CREDENTIAL.toCharArray(), retained = null;
        try {retained = f.cipher.decrypt(f.persistence.load().secret);assertArrayEquals(expected, retained);}
        finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
        for (String name : new String[] {VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,
            NativeOriginalInventoryAckIntentJournal.DIRECTORY, NativeOriginalInventoryAckRequestJournal.DIRECTORY,
            NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
            assertTrue("No exchange/WRITE/QUERY/ACK may be created", java.nio.file.Files.notExists(f.root.toPath().resolve(name), java.nio.file.LinkOption.NOFOLLOW_LINKS));
        var expectedChildren = new java.util.TreeSet<>(f.originalRootChildren);
        expectedChildren.addAll(java.util.List.of(NativePrivateMutationEpochStore.DIRECTORY,
            NativePrivateCapsuleFileStore.DIRECTORY, NativePrivateCustodyOperationStore.DIRECTORY));
        assertTrue(expectedChildren.equals(initialBootstrapChildNames(f.root.toPath())));
        var rootAfter = android.system.Os.lstat(f.root.getAbsolutePath());
        assertEquals(f.rootBefore.st_mode, rootAfter.st_mode);assertEquals(f.rootBefore.st_uid, rootAfter.st_uid);assertEquals(f.rootBefore.st_gid, rootAfter.st_gid);
        assertEquals(f.rootBefore.st_dev, rootAfter.st_dev);assertEquals(f.rootBefore.st_ino, rootAfter.st_ino);f.provenance.requireCurrent();
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, assertThrows(VaultFailure.class, f.work::requireWorkAdmission).code);
        assertEquals(1, f.enrolls.get());assertEquals(1, f.confirms.get());assertEquals(0, f.unexpected.get());
        assertEquals(0, f.unit.completionCalls.get());assertEquals(0, f.unit.cancelCalls.get());assertEquals(0, f.unit.removeCalls.get());
        // All aliases/WORK/original files remain after success OR failure.
        // No cleanup deletion, second retention, resume, resend or clear.
    }

    private static void assertInitialRetentionNoEffects(JSONObject projection) throws Exception {
        for (String flag : new String[] {"network_dispatch_allowed", "writer_authority", "durable_retention",
            "current_server_readback", "complete_namespace_inventory", "all_writer_durable_freeze_or_ABA_guard",
            "inventory_acknowledged", "work_accepted", "new_work_allowed", "resend_allowed", "finalizer_allowed",
            "key_removal", "phone_released", "actual_Android_storage_qualified", "actual_Android_keystore_qualified"})
            assertEquals("Source no-effect flag changed: " + flag, Boolean.FALSE, projection.get(flag));
    }

    private static String initialRetentionFileDigest(java.nio.file.Path file) throws Exception {
        var before = java.nio.file.Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(before.isRegularFile());assertFalse(before.isSymbolicLink());assertNotNull(before.fileKey());
        assertTrue(before.size() <= NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES);
        byte[] bytes = java.nio.file.Files.readAllBytes(file);
        try {
            assertEquals(before.size(), (long) bytes.length);
            var after = java.nio.file.Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertEquals(before.fileKey(), after.fileKey());assertEquals(before.size(), after.size());
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            try {
                StringBuilder text = new StringBuilder();
                for (byte b : digest) text.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
                return text.toString();
            } finally {java.util.Arrays.fill(digest, (byte) 0);}
        } finally {java.util.Arrays.fill(bytes, (byte) 0);}
    }

    /** Fresh Java owners in the SAME process/UID, not OS restart, remote
     * custody, current manager, ACK or finalizer qualification. */
    @Test(timeout = 420_000)
    public void savedOriginalReconstructsThroughFreshNativeOwnersWithoutDispatch() throws Exception {
        Context application;
        java.io.File root;
        NativePrivateMutationEpochStore.ContextRoot provenance;
        android.system.StructStat originalRoot;
        JSONObject local;
        VaultSnapshot originalVault;
        String originalPrincipal, originalWorkBody, originalWorkSignature;
        java.util.Set<String> aliases, expectedRootChildren;
        java.util.Map<String, java.util.Map<String, ?>> originalPayload;
        java.util.concurrent.atomic.AtomicInteger setupEnrolls, setupConfirms, setupUnexpected;
        {
            var f = new InitialNativeFixture();
            // The existing strict fresh-target/alias guard and packaged.test
            // identity refusal run BEFORE fixture keys or records are created.
            requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
            try (var baselineControl = new NativePrivateCustodyFrameReadControl()) {
                AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application, f.engine, f.work,
                    f.principalJournal, f.legacy, f.providerCoordinator, baselineControl);
                baselineControl.check();
            }
            try (var retentionControl = new NativePrivateCustodyFrameReadControl()) {
                local = AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application, f.engine, f.work,
                    f.principalJournal, f.legacy, f.providerCoordinator, retentionControl);
                retentionControl.check();
            }
            assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY", local.getString("state"));
            assertTrue(local.getBoolean("local_operation_committed_observed"));assertEquals("COMMITTED", local.getString("journal_phase"));
            assertEquals(f.generationId, local.getString("original_generation_id"));assertInitialRetentionNoEffects(local);
            assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.size(), local.getInt("original_eight_namespaces_count"));
            assertEquals(new java.util.HashSet<>(NativeProtectedNamespaceObservation.KEY_FAMILIES.values()).size(), local.getInt("original_key_family_count"));
            assertTrue(initialBootstrapSameRaw(f.originalPayload, initialBootstrapRawOwners(f.owners)));
            assertEquals(f.originalVault, f.persistence.load());assertEquals(f.originalPrincipal, f.work.loadPrincipal());
            assertEquals(f.proof.body, NativeSeparationFreeze.restore(f.engine, f.work, f.principalJournal, f.legacy).body);
            assertEquals(f.proof.signature, NativeSeparationFreeze.restore(f.engine, f.work, f.principalJournal, f.legacy).signature);
            assertEquals(f.aliases, initialBootstrapAliases());
            assertEquals(1, f.enrolls.get());assertEquals(1, f.confirms.get());assertEquals(0, f.unexpected.get());
            assertEquals(0, f.unit.completionCalls.get());assertEquals(0, f.unit.cancelCalls.get());assertEquals(0, f.unit.removeCalls.get());
            application=f.application;root=f.root;provenance=f.provenance;originalRoot=f.rootBefore;
            originalVault=f.originalVault;originalPrincipal=f.originalPrincipal;
            originalWorkBody=f.proof.body;originalWorkSignature=f.proof.signature;
            originalPayload=f.originalPayload;aliases=f.aliases;
            setupEnrolls=f.enrolls;setupConfirms=f.confirms;setupUnexpected=f.unexpected;
            expectedRootChildren=new java.util.TreeSet<>(f.originalRootChildren);
            expectedRootChildren.addAll(java.util.List.of(NativePrivateMutationEpochStore.DIRECTORY,
                NativePrivateCapsuleFileStore.DIRECTORY, NativePrivateCustodyOperationStore.DIRECTORY));
        } // Both finite controls closed. Engine/adapters have no close API;
          // their scope ends here. Only detached DATA/Context observations
          // survive; no prior Engine/provider/reader is passed to the re-open.

        var reopenedCalls = new java.util.concurrent.atomic.AtomicInteger();
        java.util.Map<java.nio.file.Path, byte[]> originalFiles = new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path, Object> originalFileKeys = new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path, java.nio.file.attribute.PosixFileAttributes> originalDirectories = new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path, java.util.Set<String>> originalChildren = new java.util.HashMap<>();
        Throwable primary = null;
        try {
            provenance.requireCurrent();assertSame(application, application.getApplicationContext());
            assertEquals(android.os.Process.myUid(), application.getApplicationInfo().uid);
            assertTrue(expectedRootChildren.equals(initialBootstrapChildNames(root.toPath())));
            var epochDirectory=root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var capsuleDirectory=root.toPath().resolve(NativePrivateCapsuleFileStore.DIRECTORY);
            var operationDirectory=root.toPath().resolve(NativePrivateCustodyOperationStore.DIRECTORY);
            assertEquals(java.util.Set.of(NativePrivateMutationEpochStore.LOCK, NativePrivateMutationEpochStore.BASELINE,
                NativePrivateMutationEpochStore.CURRENT), initialBootstrapChildNames(epochDirectory));
            assertEquals(java.util.Set.of(NativePrivateCapsuleFileStore.COMMITTED, NativePrivateCapsuleFileStore.LOCK), initialBootstrapChildNames(capsuleDirectory));
            assertEquals(java.util.Set.of(NativePrivateCustodyOperationStore.COMMITTED, NativePrivateCustodyOperationStore.LOCK), initialBootstrapChildNames(operationDirectory));
            for (var directory : java.util.List.of(epochDirectory, capsuleDirectory, operationDirectory)) {
                initialBootstrapMode(directory, 0700, true);
                var attributes=java.nio.file.Files.readAttributes(directory, java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(attributes.fileKey());
                originalDirectories.put(directory, attributes);
                var children=initialBootstrapChildNames(directory);originalChildren.put(directory, children);
                for (String name : children) {
                    var file=directory.resolve(name);initialBootstrapMode(file, 0600, false);
                    assertTrue(java.nio.file.Files.size(file) <= NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES);
                    Object key=java.nio.file.Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(key);originalFileKeys.put(file,key);
                    originalFiles.put(file,java.nio.file.Files.readAllBytes(file));
                    assertEquals(key,java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
            }
            assertEquals(local.getString("record_sha256"), initialRetentionFileDigest(capsuleDirectory.resolve(NativePrivateCapsuleFileStore.COMMITTED)));
            assertEquals(local.getString("journal_record_sha256"), initialRetentionFileDigest(operationDirectory.resolve(NativePrivateCustodyOperationStore.COMMITTED)));

            // Every verb refuses/counts; no enroll/refresh/confirm/HTTP route
            // can supply the re-open with a new generation or approval.
            EnrollmentTransport refusedTransport = new EnrollmentTransport() {
                private VaultFailure refused() {reopenedCalls.incrementAndGet();return new VaultFailure("UNIT_fresh_original_owner_unexpected_transport");}
                public EnrollmentResult enroll(EnrollmentRequest r,char[] c)throws VaultFailure {throw refused();}
                public TerminalResult confirm(String o,String d,char[] c)throws VaultFailure {throw refused();}
                public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure {throw refused();}
                public TerminalResult remove(String o,String d,char[] c)throws VaultFailure {throw refused();}
                public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure {throw refused();}
                public ActiveCredentialStatus verifyActiveCredential(String d,String i,char[] c)throws VaultFailure {throw refused();}
                public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c)throws VaultFailure {throw refused();}
                public String reportAssignedActivation(String o,String d,char[] c,java.util.Map<String,Object> r)throws VaultFailure {throw refused();}
                public NativeLegacyLineageJournal.Binding resolveLegacyLineage(NativeLegacyLineageJournal.Context c,char[] k)throws VaultFailure {throw refused();}
                public NativeLegacyLineageJournal.Terminal reportLegacyActivation(NativeLegacyLineageJournal.Context c,
                    NativeLegacyLineageJournal.Binding b,JSONObject r,char[] k)throws VaultFailure {throw refused();}
            };
            var reopenedPersistence=new SharedPreferencesVaultPersistence(application,new VaultSnapshotCodec());
            var reopenedCipher=new AndroidKeystoreCipher();
            var reopenedWork=new AndroidOfflineAuthorityTimeStore(application);
            var reopenedPrincipal=new NativePrincipalJournal(reopenedWork);
            var reopenedLegacy=new NativeLegacyLineageJournal(reopenedWork);
            final Object reopenedCoordinator=AndroidProviderCipher.STORE_LOCK;
            var reopenedEngine=new VaultEngine(reopenedPersistence,reopenedCipher,refusedTransport,new LegacyVaultSource() {
                public LegacyMaterial read() {return null;}
                public void cleanup() {throw new AssertionError("Fresh original read must not clean legacy data");}
                public boolean isClean() {return true;}
            },()->"unit-initial-baseline-installation-seal",System::currentTimeMillis,reopenedWork);
            assertEquals(originalVault,reopenedPersistence.load());assertEquals(originalPrincipal,reopenedWork.loadPrincipal());
            assertEquals("Read-only local UNIT vault state, not current remote admission", "ACTIVE", reopenedEngine.observeStateReadOnly().get("state"));
            assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,reopenedWork::requireWorkAdmission).code);

            // This exact existing-only factory creates its OWN fresh fixed
            // AndroidProviderStore/NativeProviderJournal and all8 readers.
            // No caller generation/operation, old scope or response is input.
            JSONObject saved=AndroidPrivateCustodyOwnerRecovery.observeOriginal(application,reopenedEngine,reopenedWork,
                reopenedPrincipal,reopenedLegacy,reopenedCoordinator);
            for (String name : new String[] {"operation_id","frame_sha256","record_sha256","journal_record_sha256",
                "original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256"})
                assertEquals("Fresh Java owner must reconstruct SAME saved original: "+name,local.get(name),saved.get(name));
            assertEquals(local.getString("frame_bytes"),Integer.toString(saved.getInt("frame_bytes")));
            assertTrue(saved.getBoolean("saved_hint_matched_full_original_frame_and_immutable_operation_record"));
            assertTrue(saved.getBoolean("original_WORK_provider_all8_capsule_frame_bindings_reconstructed_in_native_only"));
            assertTrue(saved.getBoolean("original_generation_selected_from_existing_committed_operation_not_caller_or_latest"));
            assertTrue(saved.getBoolean("owning_consumer_reads_existing_original_query_slots_only"));
            assertEquals(0,saved.getInt("historical_exact_original_returned_pieces"));assertInitialRetentionNoEffects(saved);
            assertEquals("PENDING_ORIGINAL_QUERY_PIECES_NOT_RESEND_AUTHORITY",saved.getString("state"));
            assertFalse(saved.getBoolean("all_original_returned_piece_bindings_present"));
            assertEquals(0,saved.getJSONArray("original_query_and_observation_artifacts").length());
            assertEquals(0,saved.getJSONArray("bounded_original_piece_digests").length());
            for (String flag : new String[] {"missing_original_owner_recreated_or_promoted",
                "fresh_WORK_request_timestamp_or_query_signature_created","current_SQL_snapshot_frame_readback",
                "missing_query_preparation_or_pending_promotion_performed","original_saved_records_or_queries_modified",
                "replacement_key_IV_signature_operation_or_query_created","actual_Android_process_restart_or_power_loss_qualified",
                "application_values_applied_or_semantically_accepted","transport_origin_authenticated","actual_native_TLS_runtime_qualified",
                "separate_durable_chunk_plan_record","original_operation_record_rewritten","actual_write_attempt_query_witnesses_bound",
                "frame_request_attestation_bound","caller_selected_query_list_range_response_or_pins",
                "caller_selected_generation_operation_query_response_or_path"})
                assertFalse("Fresh in-process owner read is not an effect or OS-restart proof: "+flag,saved.getBoolean(flag));
            assertEquals(local.getString("original_native_mutation_stamp"),AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
            var reopenedEpoch=NativePrivateMutationEpochStore.fromContext(application);
            try(var current=reopenedEpoch.readCurrent()) {
                reopenedEpoch.requireCurrent(current);assertNull(current.heldOriginal());
                assertEquals(local.getString("original_native_mutation_stamp"),"DURABLE_ATTEMPT:"+current.counter());
            }
            java.util.Map<String,android.content.SharedPreferences> reopenedOwners=new java.util.TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                reopenedOwners.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            assertTrue(initialBootstrapSameRaw(originalPayload,initialBootstrapRawOwners(reopenedOwners)));
            assertEquals(originalVault,reopenedPersistence.load());assertEquals(originalPrincipal,reopenedWork.loadPrincipal());
            var restored=NativeSeparationFreeze.restore(reopenedEngine,reopenedWork,reopenedPrincipal,reopenedLegacy);
            assertEquals(originalWorkBody,restored.body);assertEquals(originalWorkSignature,restored.signature);
            assertEquals(aliases,initialBootstrapAliases());
            char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
            try {retained=reopenedCipher.decrypt(reopenedPersistence.load().secret);assertArrayEquals(expected,retained);}
            finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
            assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,reopenedWork::requireWorkAdmission).code);
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                for(var file:originalFiles.keySet()) {
                    initialBootstrapMode(file,0600,false);
                    byte[] after=java.nio.file.Files.readAllBytes(file);
                    try {assertArrayEquals("Read-only re-open changed saved bytes",originalFiles.get(file),after);}
                    finally {java.util.Arrays.fill(after,(byte)0);}
                    assertEquals(originalFileKeys.get(file),java.nio.file.Files.readAttributes(file,
                        java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
                for(var directory:originalDirectories.keySet()) {
                    initialBootstrapMode(directory,0700,true);
                    var before=originalDirectories.get(directory);
                    var after=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.owner(),after.owner());
                    assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                    assertTrue(originalChildren.get(directory).equals(initialBootstrapChildNames(directory)));
                }
                assertTrue(expectedRootChildren.equals(initialBootstrapChildNames(root.toPath())));
                for(String name:new String[] {VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,
                    NativeOriginalInventoryAckIntentJournal.DIRECTORY,NativeOriginalInventoryAckRequestJournal.DIRECTORY,
                    NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No exchange/WRITE/QUERY/ACK may be created",java.nio.file.Files.notExists(root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var after=android.system.Os.lstat(root.getAbsolutePath());
                assertEquals(originalRoot.st_mode,after.st_mode);assertEquals(originalRoot.st_uid,after.st_uid);assertEquals(originalRoot.st_gid,after.st_gid);
                assertEquals(originalRoot.st_dev,after.st_dev);assertEquals(originalRoot.st_ino,after.st_ino);provenance.requireCurrent();
                assertEquals(1,setupEnrolls.get());assertEquals(1,setupConfirms.get());assertEquals(0,setupUnexpected.get());
                assertEquals("Every fresh-owner transport verb must remain unused",0,reopenedCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {for(byte[] bytes:originalFiles.values())java.util.Arrays.fill(bytes,(byte)0);}
            // No native store, alias, WORK hold or original file is removed.
        }
    }

    /** One typed ordinary rejection-counter transaction on actual Context
     * metadata. Not payload writer admission, all-writer ABA, ACK or restart. */
    @Test(timeout = 420_000)
    public void ordinaryNativeCounterWithdrawsSamePayloadOriginalCaptureWithoutWorkAdmission() throws Exception {
        var f = new InitialNativeFixture();
        requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
        try (var baselineControl = new NativePrivateCustodyFrameReadControl()) {
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
            baselineControl.check();
        } // No N1 retention, old @Test invocation or renewal of this control.
        var directory=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        initialBootstrapMode(directory,0700,true);
        var steadyNames=java.util.Set.of(NativePrivateMutationEpochStore.LOCK,NativePrivateMutationEpochStore.BASELINE,
            NativePrivateMutationEpochStore.CURRENT);
        assertEquals(steadyNames,initialBootstrapChildNames(directory));
        var directoryBefore=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(directoryBefore.fileKey());
        var baseline=directory.resolve(NativePrivateMutationEpochStore.BASELINE);
        var lock=directory.resolve(NativePrivateMutationEpochStore.LOCK);
        initialBootstrapMode(baseline,0600,false);initialBootstrapMode(lock,0600,false);
        assertTrue(java.nio.file.Files.size(baseline)<=4096);assertEquals(0L,java.nio.file.Files.size(lock));
        Object baselineKey=java.nio.file.Files.readAttributes(baseline,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(baselineKey);
        Object lockKey=java.nio.file.Files.readAttributes(lock,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(lockKey);
        var journal=NativePrivateMutationEpochStore.fromContext(f.application);
        byte[] baselineBytes=java.nio.file.Files.readAllBytes(baseline);
        Throwable primary=null;
        try (var before=journal.readCurrent();
            var original=NativeProtectedNamespaceObservation.observe(AndroidProtectedNamespaceReaders.bind(f.owners))) {
            journal.requireCurrent(before);long predecessor=before.counter();
            assertEquals(0L,predecessor);assertNull(before.heldOriginal());
            assertTrue("Actual original all8 capture must be current BEFORE the counter attempt",original.stillCurrent());
            assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet(),original.recordCounts.keySet());
            assertFalse(original.frozen);assertFalse(original.accepted);assertFalse(original.inventoryAcknowledged);
            assertFalse(original.keyRemovalAllowed);assertFalse(original.phoneReleased);
            assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
            assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
            long expectedNext=Math.addExact(predecessor,1L);

            // The actual owning chain is attempted ONCE. Any prepare/commit
            // exception escapes unchanged: it is NOT an expected-refusal PASS.
            // Never readPreparedForResume/recover, retry or manually finish it.
            try (var prepared=journal.prepareNext(before)) {
                assertEquals(predecessor,prepared.predecessorCounter());assertEquals(expectedNext,prepared.nextCounter());
                try (var next=journal.commitPrepared(prepared)) {
                    journal.requireCurrent(next);assertEquals(expectedNext,next.counter());assertNull(next.heldOriginal());
                    assertEquals(steadyNames,initialBootstrapChildNames(directory));
                    assertTrue(java.nio.file.Files.notExists(directory.resolve(NativePrivateMutationEpochStore.PENDING),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    assertTrue(java.nio.file.Files.notExists(directory.resolve(NativePrivateMutationEpochStore.PREVIOUS),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    for(String name:steadyNames)initialBootstrapMode(directory.resolve(name),0600,false);

                    // These are POST-SUCCESS stale-handle assertions only.
                    // No owning prepare/commit failure is caught by them.
                    VaultFailure stale=assertThrows(VaultFailure.class,()->journal.requireCurrent(before));
                    assertEquals(NativePrivateMutationEpochStore.FAILURE,stale.code);
                    try {
                        assertFalse("Identical payload cannot revive the old counter-bound all8 capture",original.stillCurrent());
                    } catch(VaultFailure withdrawn) {
                        // Current fixed Android readers still bind the old
                        // installed counter; fresh Core read below does NOT
                        // adopt/renew that token or fabricate a live stamp.
                        assertEquals(NativePrivateMutationEpochStore.FAILURE,withdrawn.code);
                    }
                    assertTrue("All eight raw payloads deliberately remain byte/type exact",
                        initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                    var reopened=NativePrivateMutationEpochStore.fromContext(f.application);
                    assertNotSame(journal,reopened);
                    try(var current=reopened.readCurrent()) {
                        reopened.requireCurrent(current);assertEquals(expectedNext,current.counter());assertNull(current.heldOriginal());
                    }
                    journal.requireCurrent(next);assertEquals(expectedNext,next.counter());
                }
            }
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                // Assert originals on success OR failure, but never remove,
                // rewrite or classify a partial transition as steady/current.
                initialBootstrapMode(directory,0700,true);initialBootstrapMode(baseline,0600,false);initialBootstrapMode(lock,0600,false);
                byte[] after=java.nio.file.Files.readAllBytes(baseline);
                try {assertArrayEquals(baselineBytes,after);}
                finally {java.util.Arrays.fill(after,(byte)0);}
                assertEquals(baselineKey,java.nio.file.Files.readAttributes(baseline,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                assertEquals(lockKey,java.nio.file.Files.readAttributes(lock,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());assertEquals(0L,java.nio.file.Files.size(lock));
                var directoryAfter=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directoryBefore.fileKey(),directoryAfter.fileKey());assertEquals(directoryBefore.owner(),directoryAfter.owner());
                assertEquals(directoryBefore.group(),directoryAfter.group());assertEquals(directoryBefore.permissions(),directoryAfter.permissions());
                var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);expectedRoot.add(NativePrivateMutationEpochStore.DIRECTORY);
                assertTrue(expectedRoot.equals(initialBootstrapChildNames(f.root.toPath())));
                for(String name:new String[] {NativePrivateCapsuleFileStore.DIRECTORY,NativePrivateCustodyOperationStore.DIRECTORY,
                    VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No custody/WRITE/QUERY/ACK artifacts",java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var rootAfter=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,rootAfter.st_mode);assertEquals(f.rootBefore.st_uid,rootAfter.st_uid);assertEquals(f.rootBefore.st_gid,rootAfter.st_gid);
                assertEquals(f.rootBefore.st_dev,rootAfter.st_dev);assertEquals(f.rootBefore.st_ino,rootAfter.st_ino);f.provenance.requireCurrent();
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.originalVault,f.persistence.load());assertEquals(f.originalPrincipal,f.work.loadPrincipal());
                var proof=NativeSeparationFreeze.restore(f.engine,f.work,f.principalJournal,f.legacy);
                assertEquals(f.proof.body,proof.body);assertEquals(f.proof.signature,proof.signature);
                assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.persistence.load().secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {java.util.Arrays.fill(baselineBytes,(byte)0);}
            // Pending/previous/current and every original/alias are retained.
            // Closing typed handles wipes only volatile metadata copies.
        }
    }

    /** Closed unknown-target workflow, not an injected publisher step,
     * raced IO, successful counter transition or power-loss qualification. */
    @Test(timeout = 420_000)
    public void unknownPredecessorDestinationRefusesCounterCommitWithoutReplacingOriginals() throws Exception {
        var f=new InitialNativeFixture();
        requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
        try(var baselineControl=new NativePrivateCustodyFrameReadControl()) {
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
            baselineControl.check();
        }
        var directory=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        initialBootstrapMode(directory,0700,true);
        var directoryBefore=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(directoryBefore.fileKey());
        var journal=NativePrivateMutationEpochStore.fromContext(f.application);
        var previous=directory.resolve(NativePrivateMutationEpochStore.PREVIOUS);
        byte[] sentinel="UNIT_UNKNOWN_PREVIOUS_NOT_COUNTER_OR_AUTHORITY\n".getBytes(StandardCharsets.UTF_8);
        assertTrue("Opaque negative input cannot be a complete counter record",sentinel.length<NativePrivateMutationEpochStore.RECORD_BYTES);
        java.util.Map<java.nio.file.Path,byte[]> bytesBefore=new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> attributesBefore=new java.util.HashMap<>();
        java.util.Set<String> expectedNames=null;
        Throwable primary=null;
        try(var current=journal.readCurrent()) {
            journal.requireCurrent(current);assertEquals(0L,current.counter());assertNull(current.heldOriginal());
            assertTrue(java.nio.file.Files.notExists(previous,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            // Only real prepareNext may create the candidate/Prepared. No
            // expected-refusal catch includes this owning preparation call.
            try(var prepared=journal.prepareNext(current)) {
                assertEquals(0L,prepared.predecessorCounter());assertEquals(1L,prepared.nextCounter());
                expectedNames=new java.util.TreeSet<>(java.util.Set.of(NativePrivateMutationEpochStore.BASELINE,
                    NativePrivateMutationEpochStore.CURRENT,NativePrivateMutationEpochStore.PENDING,NativePrivateMutationEpochStore.LOCK));
                assertEquals(expectedNames,initialBootstrapChildNames(directory));
                for(String name:expectedNames) {
                    var file=directory.resolve(name);initialBootstrapMode(file,0600,false);
                    var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertNotNull(attributes.fileKey());assertTrue(attributes.size()<=4096);
                    attributesBefore.put(file,attributes);bytesBefore.put(file,java.nio.file.Files.readAllBytes(file));
                    assertEquals(attributes.size(),(long)bytesBefore.get(file).length);
                    assertEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                }
                assertTrue(java.nio.file.Files.notExists(previous,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                // The ONLY test-authored metadata input is this deliberately
                // malformed UNIT sentinel in a formerly ABSENT fixed slot.
                // CREATE_NEW refuses collision; no original is opened to edit.
                try(var output=java.nio.channels.FileChannel.open(previous,java.util.Set.of(java.nio.file.StandardOpenOption.WRITE,
                    java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.LinkOption.NOFOLLOW_LINKS),
                    java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")))) {
                    expectedNames.add(NativePrivateMutationEpochStore.PREVIOUS);
                    var buffer=java.nio.ByteBuffer.wrap(sentinel);
                    for(int writes=0;buffer.hasRemaining();writes++) {
                        assertTrue("Bounded opaque sentinel write",writes<sentinel.length);assertTrue(output.write(buffer)>0);
                    }
                    output.force(true);
                }
                initialBootstrapMode(previous,0600,false);
                var opaque=java.nio.file.Files.readAttributes(previous,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(opaque.fileKey());
                attributesBefore.put(previous,opaque);bytesBefore.put(previous,java.nio.file.Files.readAllBytes(previous));
                assertArrayEquals(sentinel,bytesBefore.get(previous));assertEquals((long)sentinel.length,opaque.size());
                assertEquals(expectedNames,initialBootstrapChildNames(directory));

                // Exactly ONE negative commit attempt, only AFTER genuine
                // prepare and exact unknown-input readback. The public guard
                // may refuse before publisher entry; do not claim that step.
                VaultFailure refused=assertThrows(VaultFailure.class,()->{
                    try(var unexpected=journal.commitPrepared(prepared)) {
                        fail("Unknown predecessor destination must not be replaced or accepted");
                    }
                });
                assertEquals(NativePrivateMutationEpochStore.FAILURE,refused.code);
                assertEquals("Unknown input must remain opaque, not counter1 success",expectedNames,initialBootstrapChildNames(directory));
            }
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                // No recover/resume/readPrepared/second commit. Compare only
                // existing files; leave originals, sentinel and partial state.
                for(var file:bytesBefore.keySet()) {
                    initialBootstrapMode(file,0600,false);
                    var before=attributesBefore.get(file);
                    byte[] afterBytes=java.nio.file.Files.readAllBytes(file);
                    try {assertArrayEquals("Unknown commit changed original/sentinel bytes",bytesBefore.get(file),afterBytes);}
                    finally {java.util.Arrays.fill(afterBytes,(byte)0);}
                    var after=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());
                    assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                }
                if(expectedNames!=null)assertEquals(expectedNames,initialBootstrapChildNames(directory));
                initialBootstrapMode(directory,0700,true);
                var directoryAfter=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directoryBefore.fileKey(),directoryAfter.fileKey());assertEquals(directoryBefore.owner(),directoryAfter.owner());
                assertEquals(directoryBefore.group(),directoryAfter.group());assertEquals(directoryBefore.permissions(),directoryAfter.permissions());
                var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);expectedRoot.add(NativePrivateMutationEpochStore.DIRECTORY);
                assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
                for(String name:new String[] {NativePrivateCapsuleFileStore.DIRECTORY,NativePrivateCustodyOperationStore.DIRECTORY,
                    VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No custody/WRITE/QUERY/ACK artifacts",java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var rootAfter=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,rootAfter.st_mode);assertEquals(f.rootBefore.st_uid,rootAfter.st_uid);assertEquals(f.rootBefore.st_gid,rootAfter.st_gid);
                assertEquals(f.rootBefore.st_dev,rootAfter.st_dev);assertEquals(f.rootBefore.st_ino,rootAfter.st_ino);f.provenance.requireCurrent();
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.originalVault,f.persistence.load());assertEquals(f.originalPrincipal,f.work.loadPrincipal());
                var proof=NativeSeparationFreeze.restore(f.engine,f.work,f.principalJournal,f.legacy);
                assertEquals(f.proof.body,proof.body);assertEquals(f.proof.signature,proof.signature);assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.persistence.load().secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {java.util.Arrays.fill(sentinel,(byte)0);for(byte[] bytes:bytesBefore.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }

    /** Actual external counter/UNKNOWN ownership with a NO-OP UNIT callback,
     * not an admitted WORK writer, auth, all-writer, HELD or restart proof. */
    @Test(timeout = 420_000)
    public void ordinaryExternalNoOpOwnsUnknownMarkerAndWithdrawsSamePayloadOriginal() throws Exception {
        var f=new InitialNativeFixture();
        requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
        try(var baselineControl=new NativePrivateCustodyFrameReadControl()) {
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
            baselineControl.check();
        }
        var directory=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        var marker=directory.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN);
        var steadyNames=java.util.Set.of(NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT,
            NativePrivateMutationEpochStore.LOCK);
        initialBootstrapMode(directory,0700,true);assertEquals(steadyNames,initialBootstrapChildNames(directory));
        var directoryBefore=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(directoryBefore.fileKey());
        var baseline=directory.resolve(NativePrivateMutationEpochStore.BASELINE);
        var lock=directory.resolve(NativePrivateMutationEpochStore.LOCK);
        initialBootstrapMode(baseline,0600,false);initialBootstrapMode(lock,0600,false);
        assertTrue(java.nio.file.Files.size(baseline)<=4096);assertEquals(0L,java.nio.file.Files.size(lock));
        Object baselineKey=java.nio.file.Files.readAttributes(baseline,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(baselineKey);
        Object lockKey=java.nio.file.Files.readAttributes(lock,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(lockKey);
        var journal=NativePrivateMutationEpochStore.fromContext(f.application);
        var callbackCalls=new java.util.concurrent.atomic.AtomicInteger();
        byte[] baselineBytes=java.nio.file.Files.readAllBytes(baseline);
        Throwable primary=null;
        try(var before=journal.readCurrent();
            var original=NativeProtectedNamespaceObservation.observe(AndroidProtectedNamespaceReaders.bind(f.owners))) {
            journal.requireCurrent(before);long predecessor=before.counter();
            assertEquals(0L,predecessor);assertNull(before.heldOriginal());
            assertTrue(original.stillCurrent());assertEquals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet(),original.recordCounts.keySet());
            assertFalse(original.frozen);assertFalse(original.accepted);assertFalse(original.inventoryAcknowledged);
            assertFalse(original.keyRemovalAllowed);assertFalse(original.phoneReleased);
            assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
            assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
            assertTrue(java.nio.file.Files.notExists(marker,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            long expectedNext=Math.addExact(predecessor,1L);

            // ONE genuine API call, not an expected-refusal positive test.
            // Marker bytes/key/owner and publication are created only by Core.
            var completed=journal.commitOrdinaryExternalWrite(before,()->{
                assertEquals("Exactly one no-op callback",1,callbackCalls.incrementAndGet());
                try {
                    initialBootstrapMode(marker,0600,false);
                    var observed=java.nio.file.Files.readAttributes(marker,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertTrue(observed.isRegularFile());assertFalse(observed.isSymbolicLink());assertNotNull(observed.fileKey());
                    assertTrue("API-owned nonempty bounded UNKNOWN marker",observed.size()>0&&observed.size()<=2048);
                    var during=new java.util.TreeSet<>(steadyNames);during.add(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN);
                    assertEquals(during,initialBootstrapChildNames(directory));
                    // Normal reader only; no reentrant recovery/restore or
                    // private external-scope bypass is available to callback.
                    VaultFailure blocked=assertThrows(VaultFailure.class,()->{
                        try(var unexpected=journal.readCurrent()) {fail("Ordinary reader must refuse during UNKNOWN");}
                    });
                    assertEquals(NativePrivateMutationEpochStore.FAILURE,blocked.code);
                    var after=java.nio.file.Files.readAttributes(marker,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(observed.fileKey(),after.fileKey());assertEquals(observed.size(),after.size());
                    assertEquals(observed.owner(),after.owner());assertEquals(observed.group(),after.group());
                    assertEquals(observed.permissions(),after.permissions());
                    return "UNIT_NO_OP_EXTERNAL_COUNTER_DATA";
                } catch(VaultFailure failure) {throw failure;}
                catch(Exception failure) {throw new VaultFailure(NativePrivateMutationEpochStore.FAILURE,failure);}
            });
            assertNotNull(completed);
            try(var next=completed.current) {
                assertNotNull(next);assertEquals("UNIT_NO_OP_EXTERNAL_COUNTER_DATA",completed.value);assertEquals(1,callbackCalls.get());
                journal.requireCurrent(next);assertEquals(expectedNext,next.counter());assertNull(next.heldOriginal());
                assertEquals(steadyNames,initialBootstrapChildNames(directory));
                for(String name:new String[] {NativePrivateMutationEpochStore.PENDING,NativePrivateMutationEpochStore.PREVIOUS,
                    NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN})
                    assertTrue("Only terminal success may clear UNKNOWN/staged metadata",java.nio.file.Files.notExists(directory.resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                for(String name:steadyNames)initialBootstrapMode(directory.resolve(name),0600,false);
                VaultFailure stale=assertThrows(VaultFailure.class,()->journal.requireCurrent(before));
                assertEquals(NativePrivateMutationEpochStore.FAILURE,stale.code);
                try {assertFalse("Same payload must not revive prior all8 capture",original.stillCurrent());}
                catch(VaultFailure withdrawn) {assertEquals(NativePrivateMutationEpochStore.FAILURE,withdrawn.code);}
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                var reopened=NativePrivateMutationEpochStore.fromContext(f.application);assertNotSame(journal,reopened);
                try(var current=reopened.readCurrent()) {
                    reopened.requireCurrent(current);assertEquals(expectedNext,current.counter());assertNull(current.heldOriginal());
                }
                journal.requireCurrent(next);assertEquals(expectedNext,next.counter());
            }
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                // Do not require marker/pending absence after a failed API,
                // and never unlink/resume/repair its unknown external state.
                initialBootstrapMode(directory,0700,true);initialBootstrapMode(baseline,0600,false);initialBootstrapMode(lock,0600,false);
                byte[] after=java.nio.file.Files.readAllBytes(baseline);
                try {assertArrayEquals(baselineBytes,after);}
                finally {java.util.Arrays.fill(after,(byte)0);}
                assertEquals(baselineKey,java.nio.file.Files.readAttributes(baseline,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
                assertEquals(lockKey,java.nio.file.Files.readAttributes(lock,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());assertEquals(0L,java.nio.file.Files.size(lock));
                var directoryAfter=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directoryBefore.fileKey(),directoryAfter.fileKey());assertEquals(directoryBefore.owner(),directoryAfter.owner());
                assertEquals(directoryBefore.group(),directoryAfter.group());assertEquals(directoryBefore.permissions(),directoryAfter.permissions());
                var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);expectedRoot.add(NativePrivateMutationEpochStore.DIRECTORY);
                assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
                for(String name:new String[] {NativePrivateCapsuleFileStore.DIRECTORY,NativePrivateCustodyOperationStore.DIRECTORY,
                    VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No custody/WRITE/QUERY/ACK artifacts",java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var rootAfter=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,rootAfter.st_mode);assertEquals(f.rootBefore.st_uid,rootAfter.st_uid);assertEquals(f.rootBefore.st_gid,rootAfter.st_gid);
                assertEquals(f.rootBefore.st_dev,rootAfter.st_dev);assertEquals(f.rootBefore.st_ino,rootAfter.st_ino);f.provenance.requireCurrent();
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.originalVault,f.persistence.load());assertEquals(f.originalPrincipal,f.work.loadPrincipal());
                var proof=NativeSeparationFreeze.restore(f.engine,f.work,f.principalJournal,f.legacy);
                assertEquals(f.proof.body,proof.body);assertEquals(f.proof.signature,proof.signature);assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.persistence.load().secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {java.util.Arrays.fill(baselineBytes,(byte)0);}
            // Typed handles close only volatile copies. All partial/original
            // metadata, keys and frozen payload remain after every outcome.
        }
    }

    /** One failed external callback retains UNKNOWN; not a payload write,
     * delivery, replay permission, all-writer, HELD or restart proof. */
    @Test(timeout = 420_000)
    public void failedExternalCallbackRetainsOriginalUnknownMarkerAndBlocksOrdinaryReads() throws Exception {
        var f=new InitialNativeFixture();
        requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
        try(var baselineControl=new NativePrivateCustodyFrameReadControl()) {
            AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
            baselineControl.check();
        }
        var directory=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
        var marker=directory.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN);
        var lock=directory.resolve(NativePrivateMutationEpochStore.LOCK);
        var steadyNames=java.util.Set.of(NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT,
            NativePrivateMutationEpochStore.LOCK);
        var unknownNames=new java.util.TreeSet<>(steadyNames);unknownNames.add(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN);
        initialBootstrapMode(directory,0700,true);assertEquals(steadyNames,initialBootstrapChildNames(directory));
        var directoryBefore=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(directoryBefore.fileKey());
        var journal=NativePrivateMutationEpochStore.fromContext(f.application);
        var callbackCalls=new java.util.concurrent.atomic.AtomicInteger();
        var callbackFailure=new VaultFailure("UNIT_external_callback_expected_failure");
        java.util.Map<java.nio.file.Path,byte[]> originalBytes=new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> originalAttributes=new java.util.HashMap<>();
        Throwable primary=null;
        try(var before=journal.readCurrent()) {
            journal.requireCurrent(before);assertEquals(0L,before.counter());assertNull(before.heldOriginal());
            assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
            assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
            for(String name:steadyNames) {
                var file=directory.resolve(name);initialBootstrapMode(file,0600,false);
                var attributes=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);assertNotNull(attributes.fileKey());assertTrue(attributes.size()<=4096);
                originalAttributes.put(file,attributes);originalBytes.put(file,java.nio.file.Files.readAllBytes(file));
                assertEquals(attributes.size(),(long)originalBytes.get(file).length);
                assertEquals(attributes.fileKey(),java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }
            assertTrue(java.nio.file.Files.notExists(marker,java.nio.file.LinkOption.NOFOLLOW_LINKS));

            try {
                // Exactly ONE API invocation. Only Core creates/forces its
                // marker; callback observes it, writes no payload, then fails.
                var unexpected=journal.<String>commitOrdinaryExternalWrite(before,()->{
                    assertEquals("Exactly one failed callback",1,callbackCalls.incrementAndGet());
                    try {
                        initialBootstrapMode(marker,0600,false);
                        var observed=java.nio.file.Files.readAttributes(marker,java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertTrue(observed.isRegularFile());assertFalse(observed.isSymbolicLink());assertNotNull(observed.fileKey());
                        assertTrue("Bounded actual API-created UNKNOWN",observed.size()>0&&observed.size()<=2048);
                        originalAttributes.put(marker,observed);originalBytes.put(marker,java.nio.file.Files.readAllBytes(marker));
                        assertEquals(observed.size(),(long)originalBytes.get(marker).length);
                        var after=java.nio.file.Files.readAttributes(marker,java.nio.file.attribute.PosixFileAttributes.class,
                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                        assertEquals(observed.fileKey(),after.fileKey());assertEquals(observed.size(),after.size());
                        assertEquals(observed.owner(),after.owner());assertEquals(observed.group(),after.group());
                        assertEquals(observed.permissions(),after.permissions());assertEquals(unknownNames,initialBootstrapChildNames(directory));
                    } catch(VaultFailure failure) {throw failure;}
                    catch(Exception failure) {throw new VaultFailure(NativePrivateMutationEpochStore.FAILURE,failure);}
                    throw callbackFailure;
                });
                try(var unaccepted=unexpected==null?null:unexpected.current) {
                    fail("A failed callback must not return an accepted counter result");
                }
            } catch(VaultFailure failure) {
                // An earlier owning/IO failure is NOT the intended callback
                // outcome. Preserve it and unexpected suppressed close errors.
                if(failure!=callbackFailure||failure.getSuppressed().length!=0)throw failure;
            }
            assertEquals(1,callbackCalls.get());assertNotNull(originalAttributes.get(marker));assertNotNull(originalBytes.get(marker));
            assertEquals(unknownNames,initialBootstrapChildNames(directory));
            for(String name:new String[] {NativePrivateMutationEpochStore.PENDING,NativePrivateMutationEpochStore.PREVIOUS})
                assertTrue("Callback failure must not create a counter candidate",java.nio.file.Files.notExists(directory.resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));

            // Actual fixture lock can be acquired AFTER Core unwound. It is
            // never supplied to a private issuer; this does not mutate a file.
            try(var channel=java.nio.channels.FileChannel.open(lock,java.nio.file.StandardOpenOption.WRITE,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                var held=channel.tryLock()) {
                assertNotNull("Epoch lock must not leak after callback failure",held);assertTrue(held.isValid());assertSame(channel,held.channel());
            }
            VaultFailure blocked=assertThrows(VaultFailure.class,()->{
                try(var forbidden=journal.readCurrent()) {fail("Retained UNKNOWN must block ordinary read");}
            });
            assertEquals(NativePrivateMutationEpochStore.FAILURE,blocked.code);
            VaultFailure freshBlocked=assertThrows(VaultFailure.class,()->{
                // Factory may refuse before readCurrent; either is the actual
                // normal closed route, not a recovery/adoption opportunity.
                var fresh=NativePrivateMutationEpochStore.fromContext(f.application);
                try(var forbidden=fresh.readCurrent()) {fail("Fresh owner must not adopt UNKNOWN as current");}
            });
            assertEquals(NativePrivateMutationEpochStore.FAILURE,freshBlocked.code);
            assertEquals(1,callbackCalls.get());
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                for(var file:originalBytes.keySet()) {
                    initialBootstrapMode(file,0600,false);
                    byte[] afterBytes=java.nio.file.Files.readAllBytes(file);
                    try {assertArrayEquals("Original counter/marker bytes changed",originalBytes.get(file),afterBytes);}
                    finally {java.util.Arrays.fill(afterBytes,(byte)0);}
                    var before=originalAttributes.get(file);
                    var after=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());
                    assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                }
                // Only assert this failure shape after the intended callback
                // was observed. Earlier owning failures keep their own state.
                if(originalBytes.containsKey(marker))assertEquals(unknownNames,initialBootstrapChildNames(directory));
                initialBootstrapMode(directory,0700,true);
                var directoryAfter=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directoryBefore.fileKey(),directoryAfter.fileKey());assertEquals(directoryBefore.owner(),directoryAfter.owner());
                assertEquals(directoryBefore.group(),directoryAfter.group());assertEquals(directoryBefore.permissions(),directoryAfter.permissions());
                var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);expectedRoot.add(NativePrivateMutationEpochStore.DIRECTORY);
                assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
                for(String name:new String[] {NativePrivateCapsuleFileStore.DIRECTORY,NativePrivateCustodyOperationStore.DIRECTORY,
                    VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No custody/WRITE/QUERY/ACK artifacts",java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var rootAfter=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,rootAfter.st_mode);assertEquals(f.rootBefore.st_uid,rootAfter.st_uid);assertEquals(f.rootBefore.st_gid,rootAfter.st_gid);
                assertEquals(f.rootBefore.st_dev,rootAfter.st_dev);assertEquals(f.rootBefore.st_ino,rootAfter.st_ino);f.provenance.requireCurrent();
                // Exact raw encrypted all8 maps retain vault/principal/frozen
                // WORK ciphertext. Do NOT bypass a high-level UNKNOWN guard
                // to restore/read/sign a new HMAC or manufacture live status.
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.originalVault.secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {for(byte[] bytes:originalBytes.values())java.util.Arrays.fill(bytes,(byte)0);}
            // Leave UNKNOWN, original records, payloads and all aliases. No
            // second callback/commit, resume, marker unlink or permission fix.
        }
    }

    /** First saved-original WRITE loses only its first synthetic response.
     * Durable UNKNOWN is retained DATA, not server custody or ACK evidence. */
    @Test(timeout = 420_000)
    public void firstSavedOriginalCustodyWriteLostResponseRetainsExactDurableUnknown() throws Exception {
        firstSavedOriginalLostResponse(false);
    }

    /** Same actual first WRITE as setup, followed by the NEW pending exchange
     * publication branch. Crash arrangement moves only the two original real
     * ciphertext inodes. A proven expired local invocation may be followed by
     * ONE separate explicit local invocation, never a transport or Activity
     * retry. Only an actual complete returned result can qualify this member. */
    @Test(timeout = 600_000)
    public void actualPendingWriteAndUnknownResumePreservesBothOriginalInodesWithoutRedispatch() throws Exception {
        firstSavedOriginalLostResponse(true);
    }

    /** One first QUERY after the original WRITE_UNKNOWN. Both lost replies
     * are UNIT transport boundaries, never server custody or ACK evidence. */
    @Test(timeout = 600_000)
    public void firstSavedOriginalCustodyQueryLostResponseRetainsBothDurableUnknowns() throws Exception {
        firstSavedOriginalLostResponse(false,true);
    }

    /** Three explicit UNIT transports: first WRITE, first QUERY, then a
     * read-only outer request over that exact archived original QUERY. */
    @Test(timeout = 900_000)
    public void savedOriginalCurrentQueryReadLostResponsePreservesAllOriginalRecords() throws Exception {
        firstSavedOriginalLostResponse(false,true,true);
    }

    /** Bounded explicit actions on ONE real multi-chunk original. Empty UNIT
     * 200 replies are transport DATA only. An expired action may be followed
     * only after actual forward original-slot progress; UNKNOWN is never resent.
     * The final read loses its response, and supplies no frame/receipt/ACK. */
    @Test(timeout = 1_900_000)
    public void actualMultiChunkOriginalCurrentReadRequiresEveryIssuedSlotWithoutResend() throws Exception {
        var f=new InitialNativeFixture();
        var files=new java.util.HashMap<java.nio.file.Path,byte[]>();
        var identities=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var directories=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var children=new java.util.HashMap<java.nio.file.Path,java.util.Set<String>>();
        var exchange=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
        var transcripts=new java.util.HashMap<String,byte[]>();
        var headersBySlot=new java.util.HashMap<String,java.util.Map<String,String>>();
        var responses=new java.util.HashSet<String>();
        var withheldAtActionStart=new AtomicReference<java.util.Set<String>>(java.util.Set.of());
        var expiries=new java.util.ArrayList<VaultFailure>();
        var observationFailure=new AtomicReference<Throwable>();
        var lost=new java.net.SocketTimeoutException("UNIT_multichunk_current_read_response_lost");
        var lostIssued=new java.util.concurrent.atomic.AtomicBoolean();
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var readOpens=new java.util.concurrent.atomic.AtomicInteger();
        var chunkCount=new java.util.concurrent.atomic.AtomicInteger();
        var actions=new java.util.concurrent.atomic.AtomicInteger();
        final int maximum=1_200_000;
        class Sent extends java.io.ByteArrayOutputStream {
            boolean closed;
            @Override public void close(){closed=true;}
            void wipe(){java.util.Arrays.fill(buf,(byte)0);reset();}
        }
        // These witnesses are bounded raw DATA, never parsed private records or
        // source capabilities. An old witness is never replaced by a new read.
        class Witnesses {
            void observe() throws Exception {
                firstCustodyLostSameFiles(files,identities);
                if(java.nio.file.Files.notExists(exchange,java.nio.file.LinkOption.NOFOLLOW_LINKS))return;
                initialBootstrapMode(exchange,0700,true);
                var a=java.nio.file.Files.readAttributes(exchange,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                if(!directories.containsKey(exchange))directories.put(exchange,a);
                var d=directories.get(exchange);
                assertEquals(d.fileKey(),a.fileKey());assertEquals(d.owner(),a.owner());
                assertEquals(d.group(),a.group());assertEquals(d.permissions(),a.permissions());
                var names=initialBootstrapChildNames(exchange);assertTrue(names.contains("exchange.lock"));
                for(String name:names) {
                    if(!name.equals("exchange.lock")) {
                        assertTrue("Only fixed committed originals/transport observations; no pending/foreign adoption",
                            name.matches("(?:write|write_unknown|write_observation|query|query_unknown|query_observation)-[0-3]\\.bin"));
                        int index=Integer.parseInt(name.substring(name.lastIndexOf('-')+1,name.length()-4));
                        if(chunkCount.get()!=0)assertTrue("No surplus original index",index<chunkCount.get());
                    }
                    var path=exchange.resolve(name);
                    if(!files.containsKey(path))firstCustodyLostSnapshot(path,maximum,files,identities);
                    if(name.equals("exchange.lock"))assertEquals(0,files.get(path).length);
                    else assertTrue("Normal encrypted original must be nonempty",files.get(path).length>=64);
                }
                for(var path:files.keySet())if(path.getParent().equals(exchange))assertTrue(names.contains(path.getFileName().toString()));
                firstCustodyLostSameFiles(files,identities);
            }
            int criticalSlots() {
                int count=0;
                for(var path:files.keySet())if(path.getParent().equals(exchange)
                    &&path.getFileName().toString().matches("(?:write|write_unknown|query|query_unknown)-[0-3]\\.bin"))count++;
                return count;
            }
            int firstMissing() {
                for(int i=0;i<chunkCount.get();i++)for(String kind:new String[]{"write","write_unknown","query","query_unknown"})
                    if(!files.containsKey(exchange.resolve(kind+"-"+i+".bin")))return i;
                return chunkCount.get();
            }
            boolean complete(){return chunkCount.get()>0&&firstMissing()==chunkCount.get();}
            void requireRetained() throws Exception {
                firstCustodyLostSameFiles(files,identities);
                for(var directory:directories.keySet()) {
                    initialBootstrapMode(directory,0700,true);
                    var before=directories.get(directory);
                    var now=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),now.fileKey());assertEquals(before.owner(),now.owner());
                    assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                    if(children.containsKey(directory))assertEquals(children.get(directory),initialBootstrapChildNames(directory));
                }
                f.provenance.requireCurrent();
                var now=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,now.st_mode);assertEquals(f.rootBefore.st_uid,now.st_uid);
                assertEquals(f.rootBefore.st_gid,now.st_gid);assertEquals(f.rootBefore.st_dev,now.st_dev);assertEquals(f.rootBefore.st_ino,now.st_ino);
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertTrue("Original aliases retained",f.aliases.equals(initialBootstrapAliases()));
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
                for(String name:new String[]{NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue(java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
            }
            void reportSlots() {
                // Ordinals/outcomes only: no IDs, hashes, ciphertext or headers.
                for(int i=0;i<chunkCount.get();i++)for(String kind:new String[]{"write","query"}) {
                    String slot=kind+"-"+i;
                    String state=!files.containsKey(exchange.resolve(slot+".bin"))?"MISSING_PREPARED"
                        :!files.containsKey(exchange.resolve(kind+"_unknown-"+i+".bin"))?"MISSING_UNKNOWN"
                        :responses.contains(slot)?"EMPTY_200_RESPONSE_BOUNDARY_OBSERVED_UNVERIFIED_DATA"
                        :transcripts.containsKey(slot)?"OBSERVED_HTTP_BODY_NO_COMPLETED_DATA_RESPONSE":"UNKNOWN_NOT_OBSERVED_AT_HTTP";
                    System.out.println("UNIT_MULTICHUNK_SLOT="+slot+"; "+state);
                }
                System.out.println("UNIT_MULTICHUNK_FIRST_MISSING_INDEX="+firstMissing()+"; count="+chunkCount.get()
                    +"; explicit_actions_including_N0_N1="+actions.get());
            }
        }
        var witnesses=new Witnesses();
        JSONObject local=null;
        var retainedLocal=new AtomicReference<JSONObject>();
        class Connection extends javax.net.ssl.HttpsURLConnection {
            final Sent sent=new Sent();final java.util.Map<String,String> headers=new java.util.HashMap<>();
            final NativePrivateCustodyFrameReadControl control;
            int outputs,replies,disconnects;boolean emptyReply;
            Connection(java.net.URL url,NativePrivateCustodyFrameReadControl control){super(url);this.control=control;}
            @Override public void setRequestProperty(String k,String v){headers.put(k,v);}
            @Override public java.io.OutputStream getOutputStream(){assertEquals(1,++outputs);return sent;}
            void requireHeaders(byte[] body) throws Exception {
                control.check();assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                assertTrue(sent.closed);assertEquals(body.length,fixedContentLength);assertTrue(body.length>0);
                assertEquals("POST",getRequestMethod());assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                assertTrue(getConnectTimeout()>0);assertTrue(getReadTimeout()>0);
                assertTrue("application/json; charset=utf-8".equals(headers.get("Content-Type")));
                assertTrue("application/json".equals(headers.get("Accept")));assertTrue("identity".equals(headers.get("Accept-Encoding")));
                assertTrue("https://localhost".equals(headers.get("Origin")));assertTrue("custodial".equals(headers.get("X-Memphis-App-Edition")));
                assertTrue(NativeAttestation.REQUEST_VERSION.equals(headers.get("X-Memphis-Native-Attestation-Version")));
                assertTrue(f.originalVault.deviceId.equals(headers.get("X-Device-Id")));
                assertTrue(InstrumentedTransport.CREDENTIAL.equals(headers.get("X-Device-Credential")));
                assertTrue(InstrumentedTransport.CREDENTIAL.equals(headers.get("X-Memphis-Device-Credential")));
                assertTrue(("Device "+InstrumentedTransport.CREDENTIAL).equals(headers.get("Authorization")));
                assertTrue(headers.get("X-Memphis-Native-Request-Id")!=null);
                assertTrue(headers.get("X-Memphis-Native-Request-Attestation")!=null
                    &&headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                String time=headers.get("X-Memphis-Native-Request-Timestamp");assertNotNull(time);
                assertTrue(time.equals(VaultTimestamps.fromEpochMillisExact(VaultTimestamps.epochMillis(time,NativeRetainedAttempt.FAILURE))));
            }
            void requireCommon(JSONObject actual) throws Exception {
                var original=retainedLocal.get();assertNotNull(original);
                var expectedKeys=new java.util.TreeSet<>(java.util.List.of("schema","operation_id","original_generation_id",
                    "principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256",
                    "frame_bytes","chunk_count","chunk_index","offset","chunk_bytes","chunk_sha256","write_id","attempt_id","read_query_id",
                    "owner_proof_base64","original_signed_wire_base64","purpose_binding_sha256","purpose_attestation"));
                boolean write="custodial.original-native-private-custody-write.v1".equals(actual.getString("schema"));
                if(write)expectedKeys.add("chunk_base64");
                else {
                    assertTrue("custodial.original-native-private-custody-query.v1".equals(actual.getString("schema")));
                    expectedKeys.addAll(java.util.List.of("target_native_request_id","target_request_body_sha256","target_attestation_digest",
                        "target_prepared_record_sha256","target_unknown_record_sha256"));
                }
                var actualKeys=new java.util.TreeSet<String>();
                for(var keys=actual.keys();keys.hasNext();) {String key=keys.next();actualKeys.add(key);assertTrue(actual.get(key) instanceof String);}
                assertEquals(expectedKeys,actualKeys);
                for(String name:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision",
                    "original_frozen_work_sha256","frame_sha256","record_sha256","frame_bytes"})
                    assertTrue("Normal producer must retain the local original binding",original.get(name).toString().equals(actual.getString(name)));
                assertEquals(chunkCount.get(),Integer.parseInt(actual.getString("chunk_count")));
                assertTrue(actual.getString("plan_sha256").matches("[a-f0-9]{64}"));
                int index=Integer.parseInt(actual.getString("chunk_index"));assertTrue(index>=0&&index<chunkCount.get());
                int frameBytes=Integer.parseInt(actual.getString("frame_bytes"));
                int chunkBytes=VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES;
                assertTrue(frameBytes>0);assertEquals((frameBytes+chunkBytes-1)/chunkBytes,chunkCount.get());
                assertTrue(Integer.toString(index*chunkBytes).equals(actual.getString("offset")));
                int length=Math.min(chunkBytes,frameBytes-index*chunkBytes);assertTrue(length>0);
                assertTrue(Integer.toString(length).equals(actual.getString("chunk_bytes")));
                assertTrue(actual.getString("chunk_sha256").matches("[a-f0-9]{64}"));
                if(write) {
                    byte[] piece=java.util.Base64.getDecoder().decode(actual.getString("chunk_base64"));
                    try {
                        assertEquals(length,piece.length);
                        assertTrue(java.util.Base64.getEncoder().encodeToString(piece).equals(actual.getString("chunk_base64")));
                        assertTrue(NativeRetainedAttempt.hash(piece).equals(actual.getString("chunk_sha256")));
                    } finally{java.util.Arrays.fill(piece,(byte)0);}
                }
                byte[] first=transcripts.get("write-0");
                if(first!=null) {
                    var firstBody=ProviderWireJson.object(first,NativeRetainedAttempt.MAX_BODY);
                    for(String name:new String[]{"plan_sha256","owner_proof_base64","original_signed_wire_base64"})
                        assertTrue("All chunks of the same original",firstBody.getString(name).equals(actual.getString(name)));
                }
            }
            void requireQuery(JSONObject query,int index) throws Exception {
                requireCommon(query);assertTrue("custodial.original-native-private-custody-query.v1".equals(query.getString("schema")));
                assertEquals(index,Integer.parseInt(query.getString("chunk_index")));
                assertTrue(query.getString("purpose_binding_sha256").matches("[a-f0-9]{64}"));
                assertTrue(query.getString("purpose_attestation").matches("[a-f0-9]{64}"));
                var write=exchange.resolve("write-"+index+".bin");var unknown=exchange.resolve("write_unknown-"+index+".bin");
                assertTrue(files.containsKey(write));assertTrue(files.containsKey(unknown));
                assertTrue(NativeRetainedAttempt.hash(files.get(write)).equals(query.getString("target_prepared_record_sha256")));
                assertTrue(NativeRetainedAttempt.hash(files.get(unknown)).equals(query.getString("target_unknown_record_sha256")));
                assertTrue(query.getString("attempt_id").equals(query.getString("target_native_request_id")));
                assertTrue(query.getString("target_request_body_sha256").matches("[a-f0-9]{64}"));
                assertTrue(query.getString("target_attestation_digest").matches("[a-f0-9]{64}"));
                byte[] writeBody=transcripts.get("write-"+index);
                if(writeBody!=null) {
                    var issued=ProviderWireJson.object(writeBody,NativeRetainedAttempt.MAX_BODY);
                    var expectedKeys=new java.util.TreeSet<String>();
                    for(var keys=issued.keys();keys.hasNext();) {
                        String key=keys.next();expectedKeys.add(key);
                        if(!java.util.Set.of("schema","chunk_base64","purpose_binding_sha256","purpose_attestation").contains(key))
                            assertTrue("QUERY retains actual WRITE metadata",issued.getString(key).equals(query.getString(key)));
                    }
                    expectedKeys.remove("chunk_base64");expectedKeys.addAll(java.util.List.of("target_native_request_id",
                        "target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"));
                    var actualKeys=new java.util.TreeSet<String>();
                    for(var keys=query.keys();keys.hasNext();) {String key=keys.next();actualKeys.add(key);assertTrue(query.get(key) instanceof String);}
                    assertEquals(expectedKeys,actualKeys);
                    var prior=headersBySlot.get("write-"+index);
                    assertTrue(prior.get("X-Memphis-Native-Request-Id").equals(query.getString("target_native_request_id")));
                    String sha=NativeRetainedAttempt.hash(writeBody);assertTrue(sha.equals(query.getString("target_request_body_sha256")));
                    byte[] transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION)
                        .put(new JSONObject(f.originalPrincipal).getString("credential_id")).put(prior.get("X-Device-Id"))
                        .put("POST").put(VaultEngine.NativePrivateCustodyPreparedExchange.PATH).put(sha)
                        .put(prior.get("X-Memphis-Native-Request-Id")).put(prior.get("X-Memphis-Native-Request-Timestamp"))
                        .put(prior.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8);
                    try{assertTrue(NativeRetainedAttempt.hash(transcript).equals(query.getString("target_attestation_digest")));}
                    finally{java.util.Arrays.fill(transcript,(byte)0);}
                } // No imaginary WRITE transcript for an UNKNOWN never observed
                // at HTTP. The normal producer authenticates that stored target.
            }
            @Override public int getResponseCode() throws java.io.IOException {
                assertEquals(1,++replies);byte[] body=sent.toByteArray(),archived=null;
                try {
                    requireHeaders(body);witnesses.observe();
                    if(getURL().getPath().equals(VaultEngine.NativePrivateCustodyPreparedExchange.PATH)) {
                        assertTrue(body.length<=NativeRetainedAttempt.MAX_BODY);
                        var actual=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);
                        String schema=actual.getString("schema");boolean write="custodial.original-native-private-custody-write.v1".equals(schema);
                        assertTrue(write||"custodial.original-native-private-custody-query.v1".equals(schema));
                        int index=Integer.parseInt(actual.getString("chunk_index"));
                        if(chunkCount.get()==0) {
                            assertTrue("Count must come from real FIRST WRITE, not a local guess",write&&index==0);
                            int count=Integer.parseInt(actual.getString("chunk_count"));
                            assertTrue("Missing bounded owning prerequisite: actual chunk_count outside 1..4",count>=1&&count<=4);
                            chunkCount.set(count);assertTrue(actions.get()<=2*count+3);
                        }
                        assertTrue(index>=0&&index<chunkCount.get());requireCommon(actual);
                        String kind=write?"write":"query",slot=kind+"-"+index;
                        assertFalse("An issued UNKNOWN may NEVER be resent",transcripts.containsKey(slot));
                        assertFalse("Even an unsent UNKNOWN from an earlier action forbids transport",withheldAtActionStart.get().contains(slot));
                        assertTrue(opens.get()<=2*chunkCount.get());
                        assertTrue(files.containsKey(exchange.resolve(slot+".bin")));
                        assertTrue(files.containsKey(exchange.resolve(kind+"_unknown-"+index+".bin")));
                        assertTrue(actual.getString(write?"attempt_id":"read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                        if(!write)requireQuery(actual,index);
                        transcripts.put(slot,body.clone());headersBySlot.put(slot,new java.util.HashMap<>(headers));
                        control.check();witnesses.requireRetained();
                        responses.add(slot);emptyReply=true;
                        return 200; // EMPTY synthetic transport DATA. No receipt,
                        // custody, current readback, acceptance or ACK supplied.
                    }
                    assertTrue(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH.equals(getURL().getPath()));
                    assertTrue("Full-frame prerequisite: every actual original slot",witnesses.complete());
                    assertEquals(1,readOpens.get());assertFalse(lostIssued.get());
                    assertTrue(body.length<=526336);
                    var envelope=ProviderWireJson.object(body,526336);var keys=new java.util.TreeSet<String>();
                    for(var it=envelope.keys();it.hasNext();) {String key=it.next();keys.add(key);assertTrue(envelope.get(key) instanceof String);}
                    assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp",
                        "original_query_http_attestation","original_query_unknown_record_sha256"),keys);
                    assertTrue("custodial.original-private-custody-current-query.v1".equals(envelope.getString("schema")));
                    String encoded=envelope.getString("original_query_body_base64");
                    archived=java.util.Base64.getDecoder().decode(encoded);assertTrue(archived.length>0&&archived.length<=NativeRetainedAttempt.MAX_BODY);
                    assertTrue(encoded.equals(java.util.Base64.getEncoder().encodeToString(archived)));
                    var query=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
                    int index=Integer.parseInt(query.getString("chunk_index"));assertTrue(index>=0&&index<chunkCount.get());
                    requireQuery(query,index);
                    assertTrue("Current outer ID is SAME original QUERY ID",query.getString("read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                    String time=envelope.getString("original_query_timestamp"),attestation=envelope.getString("original_query_http_attestation");
                    assertTrue(time.equals(VaultTimestamps.fromEpochMillisExact(VaultTimestamps.epochMillis(time,NativeRetainedAttempt.FAILURE))));
                    assertTrue(attestation.matches("[a-f0-9]{64}"));
                    String slot="query-"+index;
                    if(transcripts.containsKey(slot)) {
                        assertTrue("Exact archived original QUERY bytes",java.util.Arrays.equals(transcripts.get(slot),archived));
                        assertTrue(headersBySlot.get(slot).get("X-Memphis-Native-Request-Timestamp").equals(time));
                        assertTrue(headersBySlot.get(slot).get("X-Memphis-Native-Request-Attestation").equals(attestation));
                    } // Otherwise the normal authenticated reader first exposes
                    // these old bytes/time/HMAC; never invent a prior send.
                    assertTrue(NativeRetainedAttempt.hash(files.get(exchange.resolve("query_unknown-"+index+".bin")))
                        .equals(envelope.getString("original_query_unknown_record_sha256")));
                    assertEquals(children.get(exchange),initialBootstrapChildNames(exchange));
                    witnesses.requireRetained();control.check();
                } catch(Exception|Error failure) {
                    observationFailure.set(failure);throw new java.io.IOException("UNIT_multichunk_observation_failed",failure);
                } finally {java.util.Arrays.fill(body,(byte)0);if(archived!=null)java.util.Arrays.fill(archived,(byte)0);}
                lostIssued.set(true);throw lost;
            }
            @Override public java.io.InputStream getInputStream(){assertTrue(emptyReply);return new java.io.ByteArrayInputStream(new byte[0]);}
            @Override public java.io.InputStream getErrorStream(){throw new AssertionError("No UNIT error response");}
            @Override public java.util.Map<String,java.util.List<String>> getHeaderFields(){assertTrue(emptyReply);return java.util.Map.of("Content-Type",java.util.List.of("application/json"));}
            @Override public void disconnect(){disconnects++;}
            @Override public boolean usingProxy(){return false;}
            @Override public void connect(){throw new AssertionError("UNIT seam must never open a socket");}
            @Override public String getCipherSuite(){throw new AssertionError("No TLS proof");}
            @Override public java.security.cert.Certificate[] getLocalCertificates(){throw new AssertionError("No TLS proof");}
            @Override public java.security.cert.Certificate[] getServerCertificates(){throw new AssertionError("No TLS proof");}
            void wipe(){sent.wipe();headers.clear();}
        }
        var connections=new java.util.ArrayList<Connection>();
        Throwable primary=null;
        try {
            requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
            actions.incrementAndGet();
            try(var control=new NativePrivateCustodyFrameReadControl()) {
                AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,control);control.check();
            }
            actions.incrementAndGet();
            try(var control=new NativePrivateCustodyFrameReadControl()) {
                local=AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,control);control.check();
            }
            retainedLocal.set(local);assertInitialRetentionNoEffects(local);
            assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY",local.getString("state"));
            assertTrue(local.getBoolean("local_operation_committed_observed"));
            for(String name:new String[]{NativePrivateMutationEpochStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
                NativePrivateCustodyOperationStore.DIRECTORY}) {
                var directory=f.root.toPath().resolve(name);initialBootstrapMode(directory,0700,true);
                directories.put(directory,java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS));children.put(directory,initialBootstrapChildNames(directory));
                for(String child:children.get(directory))firstCustodyLostSnapshot(directory.resolve(child),
                    NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES,files,identities);
            }
            assertTrue(java.nio.file.Files.notExists(exchange,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            while(!lostIssued.get()) {
                // N0 + N1, at most one advancing action per WRITE/QUERY,
                // then ONE separate read-only action if the last producer's
                // original control expired after retaining its final UNKNOWN.
                // This does not renew that old action, resend or bypass any
                // missing original. The production180s/30s bounds stay fixed.
                int limit=chunkCount.get()==0?3:2*chunkCount.get()+3;
                assertTrue("Missing bounded owning prerequisite: retainSavedOriginalCurrentFrame/readSavedOriginalCurrentFrame"
                    +" cannot progress further; count="+chunkCount.get()+", first_missing_index="+witnesses.firstMissing()
                    +", explicit_actions="+actions.get()+"; no further invocation",actions.get()<limit);
                boolean readOnly=witnesses.complete();int beforeSlots=witnesses.criticalSlots();
                var priorUnknowns=new java.util.HashSet<String>();
                for(int index=0;index<chunkCount.get();index++)for(String kind:new String[]{"write","query"})
                    if(files.containsKey(exchange.resolve(kind+"_unknown-"+index+".bin")))priorUnknowns.add(kind+"-"+index);
                withheldAtActionStart.set(java.util.Set.copyOf(priorUnknowns));
                if(readOnly) {
                    // Fixed current reader has ALL original slots. Freeze the
                    // exact pre-read child sets; no record may be added by READ.
                    children.put(exchange,initialBootstrapChildNames(exchange));
                }
                actions.incrementAndGet();VaultFailure deadline=null;
                try(var control=new NativePrivateCustodyFrameReadControl()) {
                    long constructedAfter=System.nanoTime();
                    var http=new NativePrivateCustodyHttp(url->{
                        assertFalse(lostIssued.get());assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                        boolean current=(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH).equals(url.toString());
                        assertTrue(current||(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH).equals(url.toString()));
                        if(current) {
                            witnesses.observe();assertTrue("No partial-frame current request",witnesses.complete());
                            assertEquals(1,readOpens.incrementAndGet());
                            children.put(exchange,initialBootstrapChildNames(exchange));
                            System.out.println(readOnly?"UNIT_MULTICHUNK_CURRENT_READER_ENTRY=SEPARATE_EXPLICIT_READ_ONLY_ACTION"
                                :"UNIT_MULTICHUNK_CURRENT_READER_ENTRY=NORMAL_RETAIN_PRODUCER_FINAL_READ_PHASE");
                        } else {assertFalse(readOnly);assertTrue(opens.incrementAndGet()<=2*4);}
                        var connection=new Connection(url,control);connections.add(connection);return connection;
                    },System::currentTimeMillis);
                    try(var unexpected=readOnly?AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                        f.principalJournal,f.legacy,f.providerCoordinator,http,control)
                        :AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                            f.principalJournal,f.legacy,f.providerCoordinator,http,control)) {
                        fail("No positive frame or server response may be returned by this UNIT case");
                    } catch(VaultFailure failure) {
                        if(observationFailure.get()!=null)failure.addSuppressed(observationFailure.get());
                        var trace=failure.getStackTrace();
                        boolean transport=lostIssued.get()&&readOpens.get()==1&&failure.getCause()==null&&failure.getSuppressed().length==0
                            &&"custodial_private_custody_transport_outcome_unknown".equals(failure.code)&&trace.length>=2
                            &&NativePrivateCustodyHttp.class.getName().equals(trace[0].getClassName())&&"unknown".equals(trace[0].getMethodName())
                            &&NativePrivateCustodyHttp.class.getName().equals(trace[1].getClassName())&&"sendOwned".equals(trace[1].getMethodName());
                        if(!transport) {
                            // Narrowly classified STILL-OPEN original deadline,
                            // not any same-code HTTP/preparation failure.
                            try {
                                assertFalse(Thread.currentThread().isInterrupted());assertFalse(lostIssued.get());
                                assertTrue(System.nanoTime()-constructedAfter>=180_000_000_000L);
                                assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                                assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);assertTrue(trace.length>=3);
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[0].getClassName());assertEquals("failure",trace[0].getMethodName());
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[1].getClassName());assertEquals("check",trace[1].getMethodName());
                                assertTrue(java.util.Arrays.stream(trace).anyMatch(frame->
                                    (VaultEngine.class.getName().equals(frame.getClassName())
                                        &&(frame.getMethodName().equals("retainSavedOriginalPrivateCustodyFrame")||frame.getMethodName().equals("readCurrentOriginalPrivateCustodyFrame")))
                                    ||(AndroidPrivateCustodyOwnerRecovery.class.getName().equals(frame.getClassName())&&frame.getMethodName().equals("savedOriginalCurrentFrame"))));
                                VaultFailure withdrawn=assertThrows(VaultFailure.class,control::check);
                                assertEquals(failure.code,withdrawn.code);assertNull(withdrawn.getCause());assertEquals(0,withdrawn.getSuppressed().length);
                                failure.addSuppressed(withdrawn);deadline=failure;
                            } catch(Exception|Error evidence) {if(evidence!=failure)failure.addSuppressed(evidence);throw failure;}
                        }
                    }
                }
                witnesses.observe();witnesses.requireRetained();witnesses.reportSlots();
                if(lostIssued.get())break;
                assertNotNull(deadline);
                // Actual first WRITE body is mandatory, even if another slot
                // reached UNKNOWN before its HTTP. No inferred count or resend.
                if(chunkCount.get()==0||witnesses.criticalSlots()<=beforeSlots||readOnly) {
                    deadline.addSuppressed(new AssertionError("Missing bounded saved-original producer progress: count="+chunkCount.get()
                        +", first_missing_index="+witnesses.firstMissing()+"; no repeat/resend/recovery attempted"));
                    throw deadline;
                }
                expiries.add(deadline);
                System.out.println("UNIT_MULTICHUNK_SETTLED_ACTION=ORIGINAL_CONTROL_EXPIRED_WITH_NEW_ORIGINAL_SLOTS; NOT_HTTP_SUCCESS_OR_ACTIVITY_READMISSION");
                deadline.printStackTrace(System.out); // Classified fixed control
                // failure/withdrawal stack only; no original request/ID bytes.
                // Separate explicit action only after exact forward DATA and
                // original retained-state observation. Not an old scope renewal.
            }
            assertTrue(lostIssued.get());assertTrue(witnesses.complete());assertEquals(1,readOpens.get());
            assertEquals(transcripts.size(),opens.get());assertEquals(responses.size(),transcripts.size());
            assertTrue(actions.get()<=2*chunkCount.get()+3);
            for(var connection:connections){assertEquals(1,connection.outputs);assertEquals(1,connection.replies);assertEquals(1,connection.disconnects);}
            witnesses.requireRetained();assertEquals(children.get(exchange),initialBootstrapChildNames(exchange));
            var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);
            expectedRoot.addAll(java.util.List.of(NativePrivateMutationEpochStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
                NativePrivateCustodyOperationStore.DIRECTORY,VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
            assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
            System.out.println("UNIT_MULTICHUNK_CURRENT_READ_RESPONSE_LOST; all original slots observed; EMPTY_200_DATA_NOT_CUSTODY_ACK; no returned frame");
        } catch(Exception|Error failure) {
            primary=failure;for(var expiry:expiries)if(expiry!=failure)failure.addSuppressed(expiry);throw failure;
        } finally {
            try {
                witnesses.requireRetained();
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try{retained=f.cipher.decrypt(f.originalVault.secret);assertTrue("Original ciphertext still decrypts with the same key",java.util.Arrays.equals(expected,retained));}
                finally{VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
            } catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {
                for(var connection:connections)connection.wipe();
                for(var body:transcripts.values())java.util.Arrays.fill(body,(byte)0);
                for(var header:headersBySlot.values())header.clear();
                for(var bytes:files.values())java.util.Arrays.fill(bytes,(byte)0);
                // Original/UNKNOWN/observation files, partials and keys remain.
            }
        }
    }

    /** New real Android current reconstruction from observed WRITE chunks only.
     * All replies below are SYNTHETIC DATA, never real server/manager/ACK evidence.
     * Setup may advance only after exact original-slot progress; one final
     * same-control full read must return successfully or this member FAILS. */
    @Test(timeout = 2_200_000)
    public void actualMultiChunkOriginalCurrentFrameReconstructsEveryObservedWriteWithoutEffects() throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(false);
    }

    /** Android app-private/Keystore composition with synthetic response DATA,
     * never genuine manager, server, ACK or protected-Activity admission. */
    @Test(timeout = 2_200_000)
    public void actualReturnedOriginalCurrentFrameOwnsFirstChallengeAndStatusWithoutEffects() throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(true);
    }

    @Test(timeout = 3_000_000)
    public void actualSavedBrowserManagerStatusReopensSameCapturedOriginalWithoutResend() throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(true,true);
    }

    private void fullCurrentFrameWithOptionalOriginalChallenge(boolean challengeJoin) throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(challengeJoin,false);
    }
    private void fullCurrentFrameWithOptionalOriginalChallenge(boolean challengeJoin,boolean savedBrowserJoin) throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(challengeJoin,savedBrowserJoin,null);
    }
    /** Opt-in diagnostic callback only. It receives no native authority or
     * request data, and is absent from every existing runtime selector. */
    interface BrowserActionDiagnostic { AutoCloseable begin(Context app)throws Exception; }
    static void withFirstBrowserActionDiagnostic(BrowserActionDiagnostic diagnostic)throws Exception {
        if(diagnostic==null)throw new IllegalArgumentException("diagnostic callback required");
        new ProtectedRecoveryEntryAndroidRuntimeTest().fullCurrentFrameWithOptionalOriginalChallenge(
            true,true,null,null,diagnostic);
    }
    interface OriginalInventoryAndroidProducer {
        void afterPreservation(InitialNativeFixture fixture,int action,
            VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyHttp http,
            NativePrivateCustodyFrameReadControl control,NativeOriginalBrowserPreparation source,
            java.util.Map<java.nio.file.Path,byte[]> files,
            java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities,
            java.util.Map<java.nio.file.Path,java.util.Set<String>> children)throws Exception;
        java.util.Map<String,java.util.Map<String,?>> expectedRaw(InitialNativeFixture fixture)throws Exception;
        void requireInventoryDirectories(InitialNativeFixture fixture)throws Exception;
    }
    static void withActualOriginalInventoryAndroidProducer(OriginalInventoryAndroidProducer producer)throws Exception {
        withActualOriginalInventoryAndroidProducer(producer,null);
    }
    static void withActualOriginalInventoryAndroidProducer(OriginalInventoryAndroidProducer producer,
        java.util.function.UnaryOperator<Context> beforeCaptureContext)throws Exception {
        if(producer==null)throw new IllegalArgumentException("actual original producer required");
        new ProtectedRecoveryEntryAndroidRuntimeTest().fullCurrentFrameWithOptionalOriginalChallenge(true,true,producer,beforeCaptureContext);
    }
    private void fullCurrentFrameWithOptionalOriginalChallenge(boolean challengeJoin,boolean savedBrowserJoin,
        OriginalInventoryAndroidProducer inventoryProducer) throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(challengeJoin,savedBrowserJoin,inventoryProducer,null);
    }
    private void fullCurrentFrameWithOptionalOriginalChallenge(boolean challengeJoin,boolean savedBrowserJoin,
        OriginalInventoryAndroidProducer inventoryProducer,java.util.function.UnaryOperator<Context> beforeCaptureContext) throws Exception {
        fullCurrentFrameWithOptionalOriginalChallenge(challengeJoin,savedBrowserJoin,inventoryProducer,beforeCaptureContext,null);
    }
    private void fullCurrentFrameWithOptionalOriginalChallenge(boolean challengeJoin,boolean savedBrowserJoin,
        OriginalInventoryAndroidProducer inventoryProducer,java.util.function.UnaryOperator<Context> beforeCaptureContext,
        BrowserActionDiagnostic diagnostic) throws Exception {
        if(diagnostic!=null&&(!challengeJoin||!savedBrowserJoin||inventoryProducer!=null))throw new IllegalArgumentException("first action diagnostic only");
        if(savedBrowserJoin&&!challengeJoin)throw new IllegalArgumentException("saved browser requires original challenge arrangement");
        if(savedBrowserJoin)observeProcessForNativeStartup("BEFORE_NATIVE_FIXTURE");
        boolean retentionStageReturned=false;
        var browserFixture=new AtomicReference<SavedBrowserFixture>();
        var f=new InitialNativeFixture(savedBrowserJoin,beforeCaptureContext);
        if(savedBrowserJoin)observeProcessForNativeStartup("AFTER_NATIVE_FIXTURE");
        var files=new java.util.HashMap<java.nio.file.Path,byte[]>();
        var identities=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var directories=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var children=new java.util.HashMap<java.nio.file.Path,java.util.Set<String>>();
        var exchange=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
        var transcripts=new java.util.HashMap<String,byte[]>();
        var headersBySlot=new java.util.HashMap<String,java.util.Map<String,String>>();
        var responses=new java.util.HashSet<String>();
        var withheldAtActionStart=new AtomicReference<java.util.Set<String>>(java.util.Set.of());
        var expiries=new java.util.ArrayList<VaultFailure>();
        var observationFailure=new AtomicReference<Throwable>();
        var completed=new java.util.concurrent.atomic.AtomicBoolean();
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var readOpens=new java.util.concurrent.atomic.AtomicInteger();
        var chunkCount=new java.util.concurrent.atomic.AtomicInteger();
        var currentIndices=new java.util.HashSet<Integer>();
        var finalReadControl=new AtomicReference<NativePrivateCustodyFrameReadControl>();
        var recoveryStage=new AtomicReference<String>();
        var recoveryEnvelope=new AtomicReference<byte[]>();
        var recoveryReceipt=new AtomicReference<JSONObject>();
        var recoveryBody=new AtomicReference<byte[]>();
        var recoveryHeaders=new AtomicReference<java.util.Map<String,String>>();
        var recoveryCounts=new java.util.HashMap<String,Integer>();
        var actions=new java.util.concurrent.atomic.AtomicInteger();
        final int maximum=1_200_000;
        class Sent extends java.io.ByteArrayOutputStream {
            boolean closed;
            @Override public void close(){closed=true;}
            void wipe(){java.util.Arrays.fill(buf,(byte)0);reset();}
        }
        // These witnesses are bounded raw DATA, never parsed private records or
        // source capabilities. An old witness is never replaced by a new read.
        class Witnesses {
            void observe() throws Exception {
                firstCustodyLostSameFiles(files,identities);
                if(java.nio.file.Files.notExists(exchange,java.nio.file.LinkOption.NOFOLLOW_LINKS))return;
                initialBootstrapMode(exchange,0700,true);
                var a=java.nio.file.Files.readAttributes(exchange,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                if(!directories.containsKey(exchange))directories.put(exchange,a);
                var d=directories.get(exchange);
                assertEquals(d.fileKey(),a.fileKey());assertEquals(d.owner(),a.owner());
                assertEquals(d.group(),a.group());assertEquals(d.permissions(),a.permissions());
                var names=initialBootstrapChildNames(exchange);assertTrue(names.contains("exchange.lock"));
                for(String name:names) {
                    if(!name.equals("exchange.lock")) {
                        boolean recovery=challengeJoin&&recoveryStage.get()!=null
                            &&!"TARGET".equals(recoveryStage.get())
                            &&name.matches("recovery_(?:intent|request|unknown|observation)-0\\.bin");
                        assertTrue("Only fixed committed originals/transport observations; no pending/foreign adoption",
                            recovery||name.matches("(?:write|write_unknown|write_observation|query|query_unknown|query_observation)-[0-3]\\.bin"));
                        if(recovery&&"PREPARE".equals(recoveryStage.get()))
                            assertTrue(name.equals("recovery_intent-0.bin")||name.equals("recovery_request-0.bin"));
                        int index=Integer.parseInt(name.substring(name.lastIndexOf('-')+1,name.length()-4));
                        if(chunkCount.get()!=0)assertTrue("No surplus original index",index<chunkCount.get());
                    }
                    var path=exchange.resolve(name);
                    if(!files.containsKey(path))firstCustodyLostSnapshot(path,maximum,files,identities);
                    if(name.equals("exchange.lock"))assertEquals(0,files.get(path).length);
                    else assertTrue("Normal encrypted original must be nonempty",files.get(path).length>=64);
                }
                for(var path:files.keySet())if(path.getParent().equals(exchange))assertTrue(names.contains(path.getFileName().toString()));
                firstCustodyLostSameFiles(files,identities);
            }
            int criticalSlots() {
                int count=0;
                for(var path:files.keySet())if(path.getParent().equals(exchange)
                    &&path.getFileName().toString().matches("(?:write|write_unknown|query|query_unknown)-[0-3]\\.bin"))count++;
                return count;
            }
            int firstMissing() {
                for(int i=0;i<chunkCount.get();i++)for(String kind:new String[]{"write","write_unknown","query","query_unknown"})
                    if(!files.containsKey(exchange.resolve(kind+"-"+i+".bin")))return i;
                return chunkCount.get();
            }
            boolean complete(){return chunkCount.get()>0&&firstMissing()==chunkCount.get();}
            void requireRetained() throws Exception {
                firstCustodyLostSameFiles(files,identities);
                for(var directory:directories.keySet()) {
                    initialBootstrapMode(directory,0700,true);
                    var before=directories.get(directory);
                    var now=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),now.fileKey());assertEquals(before.owner(),now.owner());
                    assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                    if(children.containsKey(directory)) {
                        var expected=new java.util.TreeSet<>(children.get(directory));
                        if(challengeJoin&&directory.equals(exchange))for(var path:files.keySet())
                            if(path.getParent().equals(exchange)&&path.getFileName().toString().startsWith("recovery_"))
                                expected.add(path.getFileName().toString());
                        assertEquals(expected,initialBootstrapChildNames(directory));
                    }
                }
                f.provenance.requireCurrent();
                var now=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,now.st_mode);assertEquals(f.rootBefore.st_uid,now.st_uid);
                assertEquals(f.rootBefore.st_gid,now.st_gid);assertEquals(f.rootBefore.st_dev,now.st_dev);assertEquals(f.rootBefore.st_ino,now.st_ino);
                assertTrue(initialBootstrapSameRaw(inventoryProducer==null?f.originalPayload:inventoryProducer.expectedRaw(f),initialBootstrapRawOwners(f.owners)));
                assertTrue("Original aliases retained",f.aliases.equals(initialBootstrapAliases()));
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(savedBrowserJoin?1:0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
                if(inventoryProducer==null)for(String name:new String[]{NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue(java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                else inventoryProducer.requireInventoryDirectories(f);
            }
            void reportSlots() {
                // Ordinals/outcomes only: no IDs, hashes, ciphertext or headers.
                for(int i=0;i<chunkCount.get();i++)for(String kind:new String[]{"write","query"}) {
                    String slot=kind+"-"+i;
                    String state=!files.containsKey(exchange.resolve(slot+".bin"))?"MISSING_PREPARED"
                        :!files.containsKey(exchange.resolve(kind+"_unknown-"+i+".bin"))?"MISSING_UNKNOWN"
                        :responses.contains(slot)?"EMPTY_200_RESPONSE_BOUNDARY_OBSERVED_UNVERIFIED_DATA"
                        :transcripts.containsKey(slot)?"OBSERVED_HTTP_BODY_NO_COMPLETED_DATA_RESPONSE":"UNKNOWN_NOT_OBSERVED_AT_HTTP";
                    System.out.println("UNIT_FULL_FRAME_SLOT="+slot+"; "+state);
                }
                System.out.println("UNIT_FULL_FRAME_FIRST_MISSING_INDEX="+firstMissing()+"; count="+chunkCount.get()
                    +"; explicit_actions_including_N0_N1="+actions.get());
            }
        }
        var witnesses=new Witnesses();
        JSONObject local=null;
        var retainedLocal=new AtomicReference<JSONObject>();
        class Connection extends javax.net.ssl.HttpsURLConnection {
            final Sent sent=new Sent();final java.util.Map<String,String> headers=new java.util.HashMap<>();
            final NativePrivateCustodyFrameReadControl control;
            byte[] ownedRecoveryRequest;
            int outputs,replies,disconnects;byte[] reply=new byte[0];
            Connection(java.net.URL url,NativePrivateCustodyFrameReadControl control){super(url);this.control=control;}
            @Override public void setRequestProperty(String k,String v){headers.put(k,v);}
            @Override public java.io.OutputStream getOutputStream(){
                assertEquals(1,++outputs);
                if(!challengeJoin||recoveryStage.get()==null)return sent;
                return new java.io.OutputStream(){
                    @Override public void write(int value){throw new AssertionError("Original request array required");}
                    @Override public void write(byte[] bytes,int offset,int length){
                        assertNull(ownedRecoveryRequest);assertEquals(0,offset);assertEquals(bytes.length,length);
                        ownedRecoveryRequest=bytes;sent.write(bytes,offset,length);
                    }
                    @Override public void close(){sent.close();}
                };
            }
            void requireHeaders(byte[] body) throws Exception {
                control.check();assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                assertTrue(sent.closed);assertEquals(body.length,fixedContentLength);assertTrue(body.length>0);
                assertEquals("POST",getRequestMethod());assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                assertTrue(getConnectTimeout()>0);assertTrue(getReadTimeout()>0);
                assertTrue("application/json; charset=utf-8".equals(headers.get("Content-Type")));
                assertTrue("application/json".equals(headers.get("Accept")));assertTrue("identity".equals(headers.get("Accept-Encoding")));
                assertTrue("https://localhost".equals(headers.get("Origin")));assertTrue("custodial".equals(headers.get("X-Memphis-App-Edition")));
                assertTrue(NativeAttestation.REQUEST_VERSION.equals(headers.get("X-Memphis-Native-Attestation-Version")));
                assertTrue(f.originalVault.deviceId.equals(headers.get("X-Device-Id")));
                assertTrue(InstrumentedTransport.CREDENTIAL.equals(headers.get("X-Device-Credential")));
                assertTrue(InstrumentedTransport.CREDENTIAL.equals(headers.get("X-Memphis-Device-Credential")));
                assertTrue(("Device "+InstrumentedTransport.CREDENTIAL).equals(headers.get("Authorization")));
                assertTrue(headers.get("X-Memphis-Native-Request-Id")!=null);
                assertTrue(headers.get("X-Memphis-Native-Request-Attestation")!=null
                    &&headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                String time=headers.get("X-Memphis-Native-Request-Timestamp");assertNotNull(time);
                assertTrue(time.equals(VaultTimestamps.fromEpochMillisExact(VaultTimestamps.epochMillis(time,NativeRetainedAttempt.FAILURE))));
            }
            void requireCommon(JSONObject actual) throws Exception {
                var original=retainedLocal.get();assertNotNull(original);
                var expectedKeys=new java.util.TreeSet<>(java.util.List.of("schema","operation_id","original_generation_id",
                    "principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256",
                    "frame_bytes","chunk_count","chunk_index","offset","chunk_bytes","chunk_sha256","write_id","attempt_id","read_query_id",
                    "owner_proof_base64","original_signed_wire_base64","purpose_binding_sha256","purpose_attestation"));
                boolean write="custodial.original-native-private-custody-write.v1".equals(actual.getString("schema"));
                if(write)expectedKeys.add("chunk_base64");
                else {
                    assertTrue("custodial.original-native-private-custody-query.v1".equals(actual.getString("schema")));
                    expectedKeys.addAll(java.util.List.of("target_native_request_id","target_request_body_sha256","target_attestation_digest",
                        "target_prepared_record_sha256","target_unknown_record_sha256"));
                }
                var actualKeys=new java.util.TreeSet<String>();
                for(var keys=actual.keys();keys.hasNext();) {String key=keys.next();actualKeys.add(key);assertTrue(actual.get(key) instanceof String);}
                assertEquals(expectedKeys,actualKeys);
                for(String name:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision",
                    "original_frozen_work_sha256","frame_sha256","record_sha256","frame_bytes"})
                    assertTrue("Normal producer must retain the local original binding",original.get(name).toString().equals(actual.getString(name)));
                assertEquals(chunkCount.get(),Integer.parseInt(actual.getString("chunk_count")));
                assertTrue(actual.getString("plan_sha256").matches("[a-f0-9]{64}"));
                int index=Integer.parseInt(actual.getString("chunk_index"));assertTrue(index>=0&&index<chunkCount.get());
                int frameBytes=Integer.parseInt(actual.getString("frame_bytes"));
                int chunkBytes=VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES;
                assertTrue(frameBytes>0);assertEquals((frameBytes+chunkBytes-1)/chunkBytes,chunkCount.get());
                assertTrue(Integer.toString(index*chunkBytes).equals(actual.getString("offset")));
                int length=Math.min(chunkBytes,frameBytes-index*chunkBytes);assertTrue(length>0);
                assertTrue(Integer.toString(length).equals(actual.getString("chunk_bytes")));
                assertTrue(actual.getString("chunk_sha256").matches("[a-f0-9]{64}"));
                if(write) {
                    byte[] piece=java.util.Base64.getDecoder().decode(actual.getString("chunk_base64"));
                    try {
                        assertEquals(length,piece.length);
                        assertTrue(java.util.Base64.getEncoder().encodeToString(piece).equals(actual.getString("chunk_base64")));
                        assertTrue(NativeRetainedAttempt.hash(piece).equals(actual.getString("chunk_sha256")));
                    } finally{java.util.Arrays.fill(piece,(byte)0);}
                }
                byte[] first=transcripts.get("write-0");
                if(first!=null) {
                    var firstBody=ProviderWireJson.object(first,NativeRetainedAttempt.MAX_BODY);
                    for(String name:new String[]{"plan_sha256","owner_proof_base64","original_signed_wire_base64"})
                        assertTrue("All chunks of the same original",firstBody.getString(name).equals(actual.getString(name)));
                }
            }
            void requireQuery(JSONObject query,int index) throws Exception {
                requireCommon(query);assertTrue("custodial.original-native-private-custody-query.v1".equals(query.getString("schema")));
                assertEquals(index,Integer.parseInt(query.getString("chunk_index")));
                assertTrue(query.getString("purpose_binding_sha256").matches("[a-f0-9]{64}"));
                assertTrue(query.getString("purpose_attestation").matches("[a-f0-9]{64}"));
                var write=exchange.resolve("write-"+index+".bin");var unknown=exchange.resolve("write_unknown-"+index+".bin");
                assertTrue(files.containsKey(write));assertTrue(files.containsKey(unknown));
                assertTrue(NativeRetainedAttempt.hash(files.get(write)).equals(query.getString("target_prepared_record_sha256")));
                assertTrue(NativeRetainedAttempt.hash(files.get(unknown)).equals(query.getString("target_unknown_record_sha256")));
                assertTrue(query.getString("attempt_id").equals(query.getString("target_native_request_id")));
                assertTrue(query.getString("target_request_body_sha256").matches("[a-f0-9]{64}"));
                assertTrue(query.getString("target_attestation_digest").matches("[a-f0-9]{64}"));
                byte[] writeBody=transcripts.get("write-"+index);
                if(writeBody!=null) {
                    var issued=ProviderWireJson.object(writeBody,NativeRetainedAttempt.MAX_BODY);
                    var expectedKeys=new java.util.TreeSet<String>();
                    for(var keys=issued.keys();keys.hasNext();) {
                        String key=keys.next();expectedKeys.add(key);
                        if(!java.util.Set.of("schema","chunk_base64","purpose_binding_sha256","purpose_attestation").contains(key))
                            assertTrue("QUERY retains actual WRITE metadata",issued.getString(key).equals(query.getString(key)));
                    }
                    expectedKeys.remove("chunk_base64");expectedKeys.addAll(java.util.List.of("target_native_request_id",
                        "target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"));
                    var actualKeys=new java.util.TreeSet<String>();
                    for(var keys=query.keys();keys.hasNext();) {String key=keys.next();actualKeys.add(key);assertTrue(query.get(key) instanceof String);}
                    assertEquals(expectedKeys,actualKeys);
                    var prior=headersBySlot.get("write-"+index);
                    assertTrue(prior.get("X-Memphis-Native-Request-Id").equals(query.getString("target_native_request_id")));
                    String sha=NativeRetainedAttempt.hash(writeBody);assertTrue(sha.equals(query.getString("target_request_body_sha256")));
                    byte[] transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION)
                        .put(new JSONObject(f.originalPrincipal).getString("credential_id")).put(prior.get("X-Device-Id"))
                        .put("POST").put(VaultEngine.NativePrivateCustodyPreparedExchange.PATH).put(sha)
                        .put(prior.get("X-Memphis-Native-Request-Id")).put(prior.get("X-Memphis-Native-Request-Timestamp"))
                        .put(prior.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8);
                    try{assertTrue(NativeRetainedAttempt.hash(transcript).equals(query.getString("target_attestation_digest")));}
                    finally{java.util.Arrays.fill(transcript,(byte)0);}
                } // No imaginary WRITE transcript for an UNKNOWN never observed
                // at HTTP. The normal producer authenticates that stored target.
            }
            @Override public int getResponseCode() throws java.io.IOException {
                assertEquals(1,++replies);
                long savedRegisteredAt=savedBrowserJoin&&"CHALLENGE".equals(recoveryStage.get())?System.currentTimeMillis():0;
                byte[] body=sent.toByteArray(),archived=null;
                try {
                    requireHeaders(body);witnesses.observe();
                    if(challengeJoin&&recoveryStage.get()!=null) {
                        String role=recoveryStage.get();assertSame(finalReadControl.get(),control);
                        control.check();assertFalse(Thread.holdsLock(control));
                        assertThrows("Exact IO piece is still owned at response",VaultFailure.class,control::beginPiece);
                        assertNotNull(ownedRecoveryRequest);assertArrayEquals(body,ownedRecoveryRequest);
                        String credentialId=new JSONObject(f.originalPrincipal).getString("credential_id");
                        if("TARGET".equals(role)) {
                            assertEquals(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH,getURL().getPath());
                            assertNotNull(recoveryEnvelope.get());assertArrayEquals(recoveryEnvelope.get(),body);
                            var envelope=ProviderWireJson.object(body,526336);
                            archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                            var query=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);requireQuery(query,0);
                            assertEquals(query.getString("read_query_id"),headers.get("X-Memphis-Native-Request-Id"));
                            assertEquals(NativeRetainedAttempt.hash(files.get(exchange.resolve("query_unknown-0.bin"))),
                                envelope.getString("original_query_unknown_record_sha256"));
                            reply=androidOriginalChallengeTargetData(envelope,body,new JSONObject(f.originalPrincipal));
                        } else if("CHALLENGE".equals(role)) {
                            assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.PATH,getURL().getPath());
                            var actual=ProviderWireJson.object(body,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);
                            // Compare the actual native request/intent and
                            // durable files, not an extra observer projection
                            // inserted into the shipping action's time budget.
                            assertEquals(actual.getString("native_challenge_intent_id"),headers.get("X-Memphis-Native-Request-Id"));
                            assertTrue(files.containsKey(exchange.resolve("recovery_request-0.bin")));
                            assertEquals(NativeRetainedAttempt.hash(files.get(exchange.resolve("recovery_intent-0.bin"))),
                                actual.getString("native_challenge_intent_record_sha256"));
                            assertTrue(files.containsKey(exchange.resolve("recovery_unknown-0.bin")));
                            assertFalse(files.containsKey(exchange.resolve("recovery_observation-0.bin")));
                            var current=ProviderWireJson.object(recoveryEnvelope.get(),526336);
                            archived=java.util.Base64.getDecoder().decode(actual.getString("current_original_query_envelope_base64"));
                            assertArrayEquals(recoveryEnvelope.get(),archived);
                            assertEquals("custodial.original-private-custody-current-query.v1",current.getString("schema"));
                            assertNull(recoveryBody.get());recoveryBody.set(body.clone());
                            recoveryHeaders.set(new java.util.HashMap<>(headers));
                            recoveryReceipt.set(savedBrowserJoin?androidSavedBrowserRegistrationData(body,headers,credentialId,savedRegisteredAt)
                                :androidOriginalChallengeRegistrationData(body,headers,credentialId));
                            reply=androidOriginalChallengeWire(recoveryReceipt.get());
                        } else {
                            assertEquals("STATUS",role);
                            assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH,getURL().getPath());
                            var actual=ProviderWireJson.object(body,NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS);
                            assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.STATUS_SCHEMA,actual.getString("schema"));
                            archived=java.util.Base64.getDecoder().decode(actual.getString("original_challenge_body_base64"));
                            assertArrayEquals(recoveryBody.get(),archived);
                            var original=recoveryHeaders.get();assertNotNull(original);
                            assertEquals(original.get("X-Memphis-Native-Request-Id"),headers.get("X-Memphis-Native-Request-Id"));
                            assertEquals(original.get("X-Memphis-Native-Request-Timestamp"),actual.getString("original_challenge_timestamp"));
                            assertEquals(original.get("X-Memphis-Native-Request-Attestation"),actual.getString("original_challenge_http_attestation"));
                            reply=androidOriginalChallengeWire(recoveryReceipt.get());
                        }
                        assertTrue(reply.length>0&&reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);
                        witnesses.requireRetained();control.check();return 200; // Synthetic untrusted wire DATA, not approval.
                    }
                    if(getURL().getPath().equals(VaultEngine.NativePrivateCustodyPreparedExchange.PATH)) {
                        assertTrue(body.length<=NativeRetainedAttempt.MAX_BODY);
                        var actual=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);
                        String schema=actual.getString("schema");boolean write="custodial.original-native-private-custody-write.v1".equals(schema);
                        assertTrue(write||"custodial.original-native-private-custody-query.v1".equals(schema));
                        int index=Integer.parseInt(actual.getString("chunk_index"));
                        if(chunkCount.get()==0) {
                            assertTrue("Count must come from real FIRST WRITE, not a local guess",write&&index==0);
                            int count=Integer.parseInt(actual.getString("chunk_count"));
                            assertTrue("Missing bounded owning prerequisite: actual chunk_count outside 1..4",count>=1&&count<=4);
                            chunkCount.set(count);assertTrue(actions.get()<=2*count+3);
                        }
                        assertTrue(index>=0&&index<chunkCount.get());requireCommon(actual);
                        String kind=write?"write":"query",slot=kind+"-"+index;
                        assertFalse("An issued UNKNOWN may NEVER be resent",transcripts.containsKey(slot));
                        assertFalse("Even an unsent UNKNOWN from an earlier action forbids transport",withheldAtActionStart.get().contains(slot));
                        assertTrue(opens.get()<=2*chunkCount.get());
                        assertTrue(files.containsKey(exchange.resolve(slot+".bin")));
                        assertTrue(files.containsKey(exchange.resolve(kind+"_unknown-"+index+".bin")));
                        assertTrue(actual.getString(write?"attempt_id":"read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                        if(!write)requireQuery(actual,index);
                        transcripts.put(slot,body.clone());headersBySlot.put(slot,new java.util.HashMap<>(headers));
                        control.check();witnesses.requireRetained();
                        responses.add(slot);
                        return 200; // EMPTY synthetic transport DATA. No receipt,
                        // custody, current readback, acceptance or ACK supplied.
                    }
                    assertTrue(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH.equals(getURL().getPath()));
                    assertTrue("Full-frame prerequisite: every actual original slot",witnesses.complete());
                    assertTrue(readOpens.get()>0&&readOpens.get()<=chunkCount.get());assertFalse(completed.get());
                    for(int required=0;required<chunkCount.get();required++)
                        assertTrue("Missing actual WRITE HTTP chunk; no private frame substitute",transcripts.containsKey("write-"+required));
                    assertTrue(body.length<=526336);
                    var envelope=ProviderWireJson.object(body,526336);var keys=new java.util.TreeSet<String>();
                    for(var it=envelope.keys();it.hasNext();) {String key=it.next();keys.add(key);assertTrue(envelope.get(key) instanceof String);}
                    assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp",
                        "original_query_http_attestation","original_query_unknown_record_sha256"),keys);
                    assertTrue("custodial.original-private-custody-current-query.v1".equals(envelope.getString("schema")));
                    String encoded=envelope.getString("original_query_body_base64");
                    archived=java.util.Base64.getDecoder().decode(encoded);assertTrue(archived.length>0&&archived.length<=NativeRetainedAttempt.MAX_BODY);
                    assertTrue(encoded.equals(java.util.Base64.getEncoder().encodeToString(archived)));
                    var query=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
                    int index=Integer.parseInt(query.getString("chunk_index"));assertTrue(index>=0&&index<chunkCount.get());
                    requireQuery(query,index);
                    assertEquals("Fixed current-read order",readOpens.get()-1,index);
                    assertFalse("Each current index is returned once",currentIndices.contains(index));
                    assertTrue("Current outer ID is SAME original QUERY ID",query.getString("read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                    String time=envelope.getString("original_query_timestamp"),attestation=envelope.getString("original_query_http_attestation");
                    assertTrue(time.equals(VaultTimestamps.fromEpochMillisExact(VaultTimestamps.epochMillis(time,NativeRetainedAttempt.FAILURE))));
                    assertTrue(attestation.matches("[a-f0-9]{64}"));
                    String slot="query-"+index;
                    if(transcripts.containsKey(slot)) {
                        assertTrue("Exact archived original QUERY bytes",java.util.Arrays.equals(transcripts.get(slot),archived));
                        assertTrue(headersBySlot.get(slot).get("X-Memphis-Native-Request-Timestamp").equals(time));
                        assertTrue(headersBySlot.get(slot).get("X-Memphis-Native-Request-Attestation").equals(attestation));
                    } // Otherwise the normal authenticated reader first exposes
                    // these old bytes/time/HMAC; never invent a prior send.
                    assertTrue(NativeRetainedAttempt.hash(files.get(exchange.resolve("query_unknown-"+index+".bin")))
                        .equals(envelope.getString("original_query_unknown_record_sha256")));
                    assertEquals(children.get(exchange),initialBootstrapChildNames(exchange));
                    witnesses.requireRetained();control.check();
                    if(challengeJoin&&index==0) {
                        assertNull(recoveryEnvelope.get());recoveryEnvelope.set(body.clone());
                    }
                    reply=fullCurrentFramePieceData(envelope,transcripts.get("write-"+index),headersBySlot.get("write-"+index),
                        new JSONObject(f.originalPrincipal).getString("credential_id"));
                    assertTrue(reply.length>0&&reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);
                    currentIndices.add(index);return 200; // Untrusted synthetic response DATA only.
                } catch(Exception|Error failure) {
                    observationFailure.set(failure);throw new java.io.IOException("UNIT_multichunk_observation_failed",failure);
                } finally {java.util.Arrays.fill(body,(byte)0);if(archived!=null)java.util.Arrays.fill(archived,(byte)0);}
            }
            @Override public java.io.InputStream getInputStream(){return new java.io.ByteArrayInputStream(reply);}
            @Override public java.io.InputStream getErrorStream(){throw new AssertionError("No UNIT error response");}
            @Override public java.util.Map<String,java.util.List<String>> getHeaderFields(){return java.util.Map.of("Content-Type",java.util.List.of("application/json"));}
            @Override public void disconnect(){
                if(ownedRecoveryRequest!=null) {
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                    assertFalse(Thread.holdsLock(control));
                    try{control.check();}catch(VaultFailure failure){throw new AssertionError("Original frame withdrew before disconnect",failure);}
                    assertThrows("Exact IO loan cannot retire before disconnect",VaultFailure.class,control::beginPiece);
                    byte[] copy=sent.toByteArray();try{assertArrayEquals(copy,ownedRecoveryRequest);}
                    finally{java.util.Arrays.fill(copy,(byte)0);}
                }
                disconnects++;
            }
            @Override public boolean usingProxy(){return false;}
            @Override public void connect(){throw new AssertionError("UNIT seam must never open a socket");}
            @Override public String getCipherSuite(){throw new AssertionError("No TLS proof");}
            @Override public java.security.cert.Certificate[] getLocalCertificates(){throw new AssertionError("No TLS proof");}
            @Override public java.security.cert.Certificate[] getServerCertificates(){throw new AssertionError("No TLS proof");}
            void wipe(){sent.wipe();headers.clear();java.util.Arrays.fill(reply,(byte)0);}
        }
        var connections=new java.util.ArrayList<Connection>();
        Throwable primary=null;
        try {
            requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
            actions.incrementAndGet();
            try(var control=new NativePrivateCustodyFrameReadControl()) {
                AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,control);control.check();
            }
            actions.incrementAndGet();
            try(var control=new NativePrivateCustodyFrameReadControl()) {
                local=AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,control);control.check();
            }
            retainedLocal.set(local);assertInitialRetentionNoEffects(local);
            assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY",local.getString("state"));
            assertTrue(local.getBoolean("local_operation_committed_observed"));
            for(String name:new String[]{NativePrivateMutationEpochStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
                NativePrivateCustodyOperationStore.DIRECTORY}) {
                var directory=f.root.toPath().resolve(name);initialBootstrapMode(directory,0700,true);
                directories.put(directory,java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS));children.put(directory,initialBootstrapChildNames(directory));
                for(String child:children.get(directory))firstCustodyLostSnapshot(directory.resolve(child),
                    NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES,files,identities);
            }
            assertTrue(java.nio.file.Files.notExists(exchange,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            while(!completed.get()) {
                // N0 + N1, at most one advancing action per WRITE/QUERY,
                // then ONE separate read-only action if the last producer's
                // original control expired after retaining its final UNKNOWN.
                // This does not renew that old action, resend or bypass any
                // missing original. The production180s/30s bounds stay fixed.
                int limit=chunkCount.get()==0?3:2*chunkCount.get()+3;
                assertTrue("Missing bounded owning prerequisite: retainSavedOriginalCurrentFrame/readSavedOriginalCurrentFrame"
                    +" cannot progress further; count="+chunkCount.get()+", first_missing_index="+witnesses.firstMissing()
                    +", explicit_actions="+actions.get()+"; no further invocation",actions.get()<limit);
                boolean readOnly=witnesses.complete();int beforeSlots=witnesses.criticalSlots();
                if(savedBrowserJoin&&readOnly&&browserFixture.get()==null){
                    // Normal app attachment/startup precedes protected STAGE.
                    // Do not spend the NEW challenge's finite interval loading
                    // this test's Activity or packaged document. No current
                    // frame control, target, challenge intent or receipt exists
                    // for the following read-only action at this frontier.
                    assertNull(finalReadControl.get());assertNull(recoveryBody.get());
                    assertNull(recoveryReceipt.get());assertNull(recoveryHeaders.get());
                    assertTrue(recoveryCounts.isEmpty());
                    witnesses.requireRetained();
                    browserFixture.set(new SavedBrowserFixture(f));
                    witnesses.requireRetained();assertNull(finalReadControl.get());
                    assertNull(recoveryBody.get());assertNull(recoveryReceipt.get());
                    assertTrue(recoveryCounts.isEmpty());
                }
                var priorUnknowns=new java.util.HashSet<String>();
                for(int index=0;index<chunkCount.get();index++)for(String kind:new String[]{"write","query"})
                    if(files.containsKey(exchange.resolve(kind+"_unknown-"+index+".bin")))priorUnknowns.add(kind+"-"+index);
                withheldAtActionStart.set(java.util.Set.copyOf(priorUnknowns));
                if(readOnly) {
                    // Fixed current reader has ALL original slots. Freeze the
                    // exact pre-read child sets; no record may be added by READ.
                    children.put(exchange,initialBootstrapChildNames(exchange));
                }
                actions.incrementAndGet();VaultFailure deadline=null;
                try(var control=new NativePrivateCustodyFrameReadControl()) {
                    long constructedAfter=System.nanoTime();
                    var http=new NativePrivateCustodyHttp(url->{
                        assertFalse(completed.get());assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                        if(challengeJoin&&recoveryStage.get()!=null) {
                            assertSame(finalReadControl.get(),control);assertEquals(chunkCount.get(),readOpens.get());
                            String role=recoveryStage.get();String path=switch(role) {
                                case "TARGET" -> VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH;
                                case "CHALLENGE" -> NativeSameOriginalRecoveryChallengeEnvelope.PATH;
                                case "STATUS" -> NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH;
                                default -> throw new AssertionError("No further recovery transport allowed");
                            };
                            assertEquals(NativePrivateCustodyHttp.ORIGIN+path,url.toString());
                            assertEquals("One fixed owning transport per stage",1,(int)recoveryCounts.merge(role,1,Integer::sum));
                            var connection=new Connection(url,control);connections.add(connection);return connection;
                        }
                        boolean current=(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH).equals(url.toString());
                        assertTrue(current||(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH).equals(url.toString()));
                        if(current) {
                            witnesses.observe();assertTrue("No partial-frame current request",witnesses.complete());
                            assertTrue("Exactly one current transport per original chunk",readOpens.incrementAndGet()<=chunkCount.get());
                            if(finalReadControl.get()==null)finalReadControl.set(control);
                            else assertSame("All current pieces use SAME original frame control",finalReadControl.get(),control);
                            if(!children.containsKey(exchange))children.put(exchange,initialBootstrapChildNames(exchange));
                            else assertEquals(children.get(exchange),initialBootstrapChildNames(exchange));
                            System.out.println(readOnly?"UNIT_FULL_FRAME_CURRENT_READER_ENTRY=SEPARATE_EXPLICIT_READ_ONLY_ACTION"
                                :"UNIT_FULL_FRAME_CURRENT_READER_ENTRY=NORMAL_RETAIN_PRODUCER_FINAL_READ_PHASE");
                        } else {assertFalse(readOnly);assertTrue(opens.incrementAndGet()<=2*4);}
                        var connection=new Connection(url,control);connections.add(connection);return connection;
                    },System::currentTimeMillis);
                    try {
                    if(savedBrowserJoin&&!readOnly){
                        // This is the actual new protected transport stage,
                        // not a successful-current-read substitute. Its normal
                        // control closes before a separate existing-only READ.
                        var staged=AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalRequests(f.application,f.engine,f.work,
                            f.principalJournal,f.legacy,f.providerCoordinator,http,control);
                        control.check();assertNull(observationFailure.get());assertEquals(0,readOpens.get());
                        NativeRetainedAttempt.keys(staged,"schema","state","operation_id","original_generation_id","frame_sha256","plan_sha256",
                            "current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released");
                        assertEquals("custodial.native-original-custody-retention-stage.v1",staged.get("schema"));
                        assertEquals("ORIGINAL_REQUEST_PHASE_RETURNED_CURRENT_READ_NOT_RUN",staged.get("state"));
                        for(String key:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                            assertEquals(Boolean.FALSE,staged.get(key));
                        String text=NativeManagerPreparationPresentation.originalRequestsRetained(staged);
                        assertTrue(text.contains("Current server readback has NOT run"));control.check();retentionStageReturned=true;
                    }else try(var result=readOnly?AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                        f.principalJournal,f.legacy,f.providerCoordinator,http,control)
                        :AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                            f.principalJournal,f.legacy,f.providerCoordinator,http,control)) {
                        assertNull(observationFailure.get());assertTrue(witnesses.complete());
                        assertEquals(chunkCount.get(),readOpens.get());assertEquals(chunkCount.get(),currentIndices.size());
                        assertSame(control,finalReadControl.get());
                        // Expected frame bytes come ONLY from observed normal WRITE transports.
                        var assembled=new Sent();byte[] expectedFrame=null;
                        try {
                            for(int index=0;index<chunkCount.get();index++) {
                                assertTrue("Every original WRITE must actually reach HTTP",transcripts.containsKey("write-"+index));
                                var write=ProviderWireJson.object(transcripts.get("write-"+index),NativeRetainedAttempt.MAX_BODY);
                                byte[] piece=java.util.Base64.getDecoder().decode(write.getString("chunk_base64"));
                                try{assertEquals(assembled.size(),Integer.parseInt(write.getString("offset")));assembled.write(piece,0,piece.length);}
                                finally{java.util.Arrays.fill(piece,(byte)0);}
                            }
                            expectedFrame=assembled.toByteArray();String expectedSha=NativeRetainedAttempt.hash(expectedFrame);
                            assertTrue(local.getString("frame_sha256").equals(expectedSha));
                            assertEquals(local.getInt("frame_bytes"),expectedFrame.length);
                            // The separate full-frame case retains every
                            // projection assertion below. The challenge join
                            // follows the shipping typed chain directly: its
                            // owners still perform all mandatory live checks.
                            if(!challengeJoin){
                            var projection=result.projection();var crypto=projection.getJSONObject("crypto");
                            assertEquals("CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK",projection.getString("state"));
                            assertEquals(chunkCount.get(),projection.getInt("current_transport_piece_count"));
                            assertEquals(chunkCount.get(),crypto.getInt("chunk_count"));
                            assertEquals(expectedFrame.length,crypto.getInt("returned_frame_bytes"));
                            assertTrue(expectedSha.equals(crypto.getString("returned_frame_sha256")));
                            for(String name:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision",
                                "original_frozen_work_sha256","frame_sha256","record_sha256","frame_bytes"})
                                assertTrue(local.get(name).toString().equals(crypto.get(name).toString()));
                            assertTrue(crypto.getBoolean("exact_original_owner_proof_bytes_match"));
                            assertTrue(crypto.getBoolean("exact_original_saved_encrypted_record_match"));
                            assertTrue(crypto.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
                            assertTrue(crypto.getBoolean("exact_original_all8_values_compared_in_native_only"));
                            for(String key:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged",
                                "work_accepted","finalizer_allowed","key_removal","phone_released"})assertFalse(key,projection.getBoolean(key));
                            for(String key:new String[]{"network_dispatch_allowed","writer_authority","durable_retention","current_server_readback",
                                "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted",
                                "new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(key,crypto.getBoolean(key));
                            }
                            if(challengeJoin) {
                                // SAME successful Android returned read/control; no
                                // fresh action, renewed frame, raw key or capability.
                                control.check();witnesses.requireRetained();recoveryStage.set("TARGET");
                                try(var target=result.takeOriginalRecoveryTarget(http)) {
                                    assertEquals(1,(int)recoveryCounts.getOrDefault("TARGET",0));
                                    recoveryStage.set("PREPARE");
                                    try(VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent=savedBrowserJoin?null:target.takeOriginalPreparationIntent()) {
                                        if(!savedBrowserJoin){witnesses.observe();assertTrue(files.containsKey(exchange.resolve("recovery_intent-0.bin")));}
                                        // The shipping FIRST path owns one local
                                        // purpose-pair birth, not a returned
                                        // intermediate intent. Legacy cases keep
                                        // their original separate owners.
                                        try(var prepared=savedBrowserJoin?target.takeFirstOriginalChallengeRequest():intent.takeOriginalChallengeRequest()) {
                                            witnesses.observe();assertTrue(files.containsKey(exchange.resolve("recovery_request-0.bin")));
                                            assertTrue(files.containsKey(exchange.resolve("recovery_intent-0.bin")));
                                            assertFalse(files.containsKey(exchange.resolve("recovery_unknown-0.bin")));
                                            recoveryStage.set("CHALLENGE");
                                            var sent=f.engine.sendOriginalRecoveryChallenge(prepared,http,control);
                                            androidOriginalChallengeNoEffects(sent);assertTrue(sent.getBoolean("native_receipt_metadata_validated"));
                                            assertEquals(1,(int)recoveryCounts.getOrDefault("CHALLENGE",0));witnesses.observe();
                                            assertTrue(files.containsKey(exchange.resolve("recovery_unknown-0.bin")));
                                            recoveryStage.set("STATUS");
                                            var status=f.engine.readOriginalRecoveryChallengeStatus(prepared,http,control);
                                            androidOriginalChallengeNoEffects(status);assertTrue(status.getBoolean("native_receipt_metadata_validated"));
                                            assertEquals(1,(int)recoveryCounts.getOrDefault("STATUS",0));witnesses.observe();
                                            var appended=new java.util.TreeSet<>(initialBootstrapChildNames(exchange));appended.removeAll(children.get(exchange));
                                            assertEquals(java.util.Set.of("recovery_intent-0.bin","recovery_request-0.bin",
                                                "recovery_unknown-0.bin","recovery_observation-0.bin"),appended);
                                            control.check();witnesses.requireRetained();
                                            for(var connection:connections)if(connection.ownedRecoveryRequest!=null)
                                                assertArrayEquals("Owning HTTP cleanup wipes only its transient request",new byte[connection.ownedRecoveryRequest.length],connection.ownedRecoveryRequest);
                                            int countBefore=connections.size();recoveryStage.set("NO_MORE_HTTP");
                                            assertEquals(NativeRetainedAttempt.FAILURE,assertThrows("Same original UNKNOWN cannot resend",
                                                VaultFailure.class,()->f.engine.sendOriginalRecoveryChallenge(prepared,http,control)).code);
                                            control.check();assertEquals(countBefore,connections.size());witnesses.requireRetained();
                                        }
                                    }
                                }
                                assertNull(observationFailure.get());
                                System.out.println("UNIT_ANDROID_RETURNED_FRAME_ORIGINAL_CHALLENGE_STATUS_JOIN; synthetic DATA only; no manager ACK or release authority");
                            }
                            witnesses.requireRetained();control.check();completed.set(true);
                        } finally{assembled.wipe();if(expectedFrame!=null)java.util.Arrays.fill(expectedFrame,(byte)0);}
                    }
                    } catch(VaultFailure failure) {
                        if(observationFailure.get()!=null)failure.addSuppressed(observationFailure.get());
                        // A current-read failure is ALWAYS a failure, even after some pieces.
                        // Only a settled producer with new durable slots and NO current HTTP
                        // may be classified as setup progress under its expired original scope.
                        if(readOpens.get()!=0||readOnly||completed.get())throw failure;
                        var trace=failure.getStackTrace();
                        {
                            // Narrowly classified STILL-OPEN original deadline,
                            // not any same-code HTTP/preparation failure.
                            try {
                                assertFalse(Thread.currentThread().isInterrupted());assertFalse(completed.get());
                                assertTrue(System.nanoTime()-constructedAfter>=180_000_000_000L);
                                assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                                assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);assertTrue(trace.length>=3);
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[0].getClassName());assertEquals("failure",trace[0].getMethodName());
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[1].getClassName());assertEquals("check",trace[1].getMethodName());
                                assertTrue(java.util.Arrays.stream(trace).anyMatch(frame->
                                    (VaultEngine.class.getName().equals(frame.getClassName())
                                        &&(frame.getMethodName().equals("retainSavedOriginalPrivateCustodyFrame")||frame.getMethodName().equals("readCurrentOriginalPrivateCustodyFrame")))
                                    ||(AndroidPrivateCustodyOwnerRecovery.class.getName().equals(frame.getClassName())&&frame.getMethodName().equals("savedOriginalCurrentFrame"))
                                    ||(savedBrowserJoin&&((VaultEngine.class.getName().equals(frame.getClassName())&&frame.getMethodName().equals("retainSavedOriginalPrivateCustodyRequests"))
                                        ||(AndroidPrivateCustodyOwnerRecovery.class.getName().equals(frame.getClassName())&&frame.getMethodName().equals("retainSavedOriginalRequests"))))));
                                VaultFailure withdrawn=assertThrows(VaultFailure.class,control::check);
                                assertEquals(failure.code,withdrawn.code);assertNull(withdrawn.getCause());assertEquals(0,withdrawn.getSuppressed().length);
                                failure.addSuppressed(withdrawn);deadline=failure;
                            } catch(Exception|Error evidence) {if(evidence!=failure)failure.addSuppressed(evidence);throw failure;}
                        }
                    }
                }
                // Retain the original action failure BEFORE any later
                // witness/HTTP-presence assertion can become the primary.
                if(deadline!=null)expiries.add(deadline);
                witnesses.observe();witnesses.requireRetained();witnesses.reportSlots();
                for(int index=0;index<chunkCount.get();index++)
                    if(files.containsKey(exchange.resolve("write_unknown-"+index+".bin")))
                        assertTrue("Missing actual WRITE HTTP chunk at index "+index+"; UNKNOWN forbids resend or private-frame substitution",transcripts.containsKey("write-"+index));
                if(completed.get())break;
                if(savedBrowserJoin&&retentionStageReturned){
                    assertTrue("The next READ cannot substitute for missing original slots",witnesses.complete());
                    assertEquals(0,readOpens.get());witnesses.requireRetained();
                    System.out.println("UNIT_FULL_FRAME_SETTLED_ACTION=ORIGINAL_TRANSPORT_PHASE_RETURNED_CURRENT_READ_NOT_RUN; SEPARATE_EXPLICIT_READ_FOLLOWS_WITH_SAME_ORIGINALS");
                    continue;
                }
                assertNotNull(deadline);
                // Actual first WRITE body is mandatory, even if another slot
                // reached UNKNOWN before its HTTP. No inferred count or resend.
                if(chunkCount.get()==0||witnesses.criticalSlots()<=beforeSlots||readOnly) {
                    deadline.addSuppressed(new AssertionError("Missing bounded saved-original producer progress: count="+chunkCount.get()
                        +", first_missing_index="+witnesses.firstMissing()+"; no repeat/resend/recovery attempted"));
                    throw deadline;
                }
                System.out.println("UNIT_FULL_FRAME_SETTLED_ACTION=ORIGINAL_CONTROL_EXPIRED_WITH_NEW_ORIGINAL_SLOTS; NOT_HTTP_SUCCESS_OR_ACTIVITY_READMISSION");
                deadline.printStackTrace(System.out); // Classified fixed control
                // failure/withdrawal stack only; no original request/ID bytes.
                // Separate explicit action only after exact forward DATA and
                // original retained-state observation. Not an old scope renewal.
            }
            assertTrue("Requires returned full current frame, not slots/expiry/per-piece counts",completed.get());
            assertTrue(witnesses.complete());assertEquals(chunkCount.get(),readOpens.get());assertEquals(chunkCount.get(),currentIndices.size());
            assertEquals(transcripts.size(),opens.get());assertEquals(responses.size(),transcripts.size());
            assertTrue(actions.get()<=2*chunkCount.get()+3);
            for(var connection:connections){assertEquals(1,connection.outputs);assertEquals(1,connection.replies);assertEquals(1,connection.disconnects);}
            witnesses.requireRetained();
            if(!challengeJoin)assertEquals(children.get(exchange),initialBootstrapChildNames(exchange));
            else assertEquals(java.util.Map.of("TARGET",1,"CHALLENGE",1,"STATUS",1),recoveryCounts);
            var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);
            expectedRoot.addAll(java.util.List.of(NativePrivateMutationEpochStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
                NativePrivateCustodyOperationStore.DIRECTORY,VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
            assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
            System.out.println("UNIT_FULL_CURRENT_FRAME_RETURNED_AND_NATIVE_VERIFIED; synthetic response DATA only; no server SQL manager ACK or release authority");
            if(savedBrowserJoin)androidSavedBrowserManagerContinuation(f,transcripts,headersBySlot,
                recoveryBody.get(),recoveryHeaders.get(),recoveryReceipt.get(),files,identities,children,inventoryProducer,diagnostic,
                browserFixture.get());
        } catch(Exception|Error failure) {
            primary=failure;for(var expiry:expiries)if(expiry!=failure)failure.addSuppressed(expiry);throw failure;
        } finally {
            try{
                if(browserFixture.get()!=null)browserFixture.get().close();
            }catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
            finally {
            try {
                witnesses.requireRetained();
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try{retained=f.cipher.decrypt(f.originalVault.secret);assertTrue("Original ciphertext still decrypts with the same key",java.util.Arrays.equals(expected,retained));}
                finally{VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
            } catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {
                for(var connection:connections)connection.wipe();
                for(var body:transcripts.values())java.util.Arrays.fill(body,(byte)0);
                for(var header:headersBySlot.values())header.clear();
                if(recoveryEnvelope.get()!=null)java.util.Arrays.fill(recoveryEnvelope.get(),(byte)0);
                if(recoveryBody.get()!=null)java.util.Arrays.fill(recoveryBody.get(),(byte)0);
                if(recoveryHeaders.get()!=null)recoveryHeaders.get().clear();
                for(var bytes:files.values())java.util.Arrays.fill(bytes,(byte)0);
                // Original/UNKNOWN/observation files, partials and keys remain.
            }
        }
            }
    }

    /** Test-only already-started packaged browser. No challenge/approval,
     * original read control, capture or currentness verdict is created here. */
    private static final class SavedBrowserFixture implements AutoCloseable {
        final String row="UNIT_saved_browser_original_before_first_hold",value="UNIT_UNKNOWN_BROWSER_DATA_NOT_AUTHORITY";
        final CustodialNativeVaultPlugin plugin;
        final AtomicReference<NativeOriginalBrowserPreparation> attached=new AtomicReference<>();
        final AtomicReference<BridgeSmokeActivity> activity=new AtomicReference<>();
        private ActivityScenario<BridgeSmokeActivity> scenario;
        final String existing;
        private boolean closed;
        SavedBrowserFixture(InitialNativeFixture f)throws Exception {
            plugin=new CustodialNativeVaultPlugin(f.engine,new CancellationCoordinator(f.engine,(o,d)->false),
                new RemovalCoordinator(f.engine,(o,d)->false));
            try{
                observeProcessForNativeStartup("BEFORE_INITIAL_BROWSER_ACTIVITY");
                BridgeSmokeActivity.install(plugin,attached);
                scenario=ActivityScenario.launch(BridgeSmokeActivity.class);
                scenario.onActivity(actual->{
                    try {
                        activity.set(actual);verifyNormalBootstrapAssets(actual);
                        var bridge=actual.getBridge();assertNotNull(bridge);var view=bridge.getWebView();assertNotNull(view);
                        assertSame(plugin,bridge.getPlugin("CustodialNativeVault").getInstance());
                        // The fixture attaches the actual Source during plugin
                        // registration, before Bridge's automatic first load.
                        // This remains injected-engine, not shipping startup proof.
                        assertFalse(view.getSettings().supportMultipleWindows());
                        assertFalse(view.getSettings().getJavaScriptCanOpenWindowsAutomatically());
                        assertNotNull(attached.get());attached.get().requireAttachedView(view);
                        // Install the actual Source before loading the normal
                        // packaged application below. Blank smoke HTML cannot
                        // supply the required policy or public Storage firewall.
                    } catch(Exception failure){throw new AssertionError("Normal attached browser producer unavailable",failure);}
                });
                var ownedActivity=activity.get();var ownedBridge=ownedActivity.getBridge();
                OriginalBrowserPreparationAndroidRuntimeTest.loadNormalCustodialApplication(scenario,ownedBridge,ownedBridge.getWebView(),true);
                assertEquals("true",androidSavedBrowserEvaluate(ownedActivity,"typeof globalThis.custodialOriginalBrowserPreparation==='object'"));
                assertEquals("true",androidSavedBrowserEvaluate(activity.get(),"(()=>{const k="+JSONObject.quote(row)+";if(localStorage.getItem(k)!==null)return false;localStorage.setItem(k,"+JSONObject.quote(value)+");return localStorage.getItem(k)==="+JSONObject.quote(value)+"})()"));
                // Include the actual extra unknown row in the pre-hold
                // witness. FIRST hold legitimately advances its existing
                // rejection epoch ONCE; every other original byte must remain.
                existing=androidSavedBrowserEvaluate(activity.get(),"JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])");
            }catch(Exception|Error failure){
                try{close();}catch(Exception|Error cleanup){failure.addSuppressed(cleanup);}throw failure;
            }
        }
        @Override public void close()throws Exception {
            if(closed)return;closed=true;Throwable primary=null;
            // Logical Source withdrawal is thread-safe and must not depend
            // on an ActivityScenario callback surviving destruction.
            try{if(attached.get()!=null)attached.get().close();}
            catch(RuntimeException|Error failure){primary=failure;throw failure;}
            finally{
                try{if(scenario!=null)scenario.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
                finally{BridgeSmokeActivity.install(null);}
            }
        }
    }

    /** Two distinct settled protected local actions after the one original
     * challenge. First normal attached capture retains browser DATA; second
     * normal existing-only restore reaches the saved-manager STATUS guards.
     * No private journal/capability reflection or captured-row seeding. */
    private static void androidSavedBrowserManagerContinuation(InitialNativeFixture f,
        java.util.Map<String,byte[]> writes,java.util.Map<String,java.util.Map<String,String>> oldHeaders,
        byte[] challenge,java.util.Map<String,String> challengeHeaders,JSONObject registration,
        java.util.Map<java.nio.file.Path,byte[]> files,
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities,
        java.util.Map<java.nio.file.Path,java.util.Set<String>> children,OriginalInventoryAndroidProducer inventoryProducer,
        BrowserActionDiagnostic browserDiagnostic,SavedBrowserFixture browserFixture) throws Exception {
        assertNotNull(f.unitCompletionArguments);assertNotNull(challenge);assertNotNull(challengeHeaders);assertNotNull(registration);
        var exchange=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
        var originalNames=initialBootstrapChildNames(exchange);
        assertFalse(originalNames.contains("browser_frame-0.bin"));
        if(browserFixture==null||browserFixture.closed)throw new AssertionError("Already-started same browser fixture required");
        final String row=browserFixture.row,value=browserFixture.value,existing=browserFixture.existing;
        var plugin=browserFixture.plugin;var attached=browserFixture.attached;var activity=browserFixture.activity;
        var scenario=browserFixture.scenario;
        var ownedActivity=activity.get();var ownedBridge=ownedActivity.getBridge();
        var wipes=new java.util.ArrayList<Runnable>();
        var observationFailure=new AtomicReference<Throwable>();
        var stageCounts=new java.util.HashMap<String,Integer>();
        var expectedTarget=new AtomicReference<JSONObject>();
        final String originalRegistration=registration.toString();
        var originalApproval=new AtomicReference<String>();
        String afterFirstStorage=null;Throwable primary=null;
        try {
                try(var diagnosticScope=browserDiagnostic==null?null:browserDiagnostic.begin(f.application)) {
                for(int action=0;action<(browserDiagnostic!=null?1:inventoryProducer==null?2:4);action++) {
                    // Old action/control has fully settled before the next is
                    // created. No expired scope, status or timestamp is reset.
                    final int ordinal=action;
                    var counts=new java.util.HashMap<String,Integer>();
                    try(var control=new NativePrivateCustodyFrameReadControl()) {
                        if(inventoryProducer!=null&&ordinal>=2){
                            attached.get().reloadConsumedRecoveryDocument(control);
                            OriginalBrowserPreparationAndroidRuntimeTest.loadNormalCustodialApplication(scenario,ownedBridge,ownedBridge.getWebView(),true);
                        }
                        final long actionStarted=System.nanoTime();
                        class BrowserConnection extends javax.net.ssl.HttpsURLConnection {
                            final java.util.Map<String,String> headers=new java.util.HashMap<>();
                            byte[] reply=new byte[0],owned,copy;boolean outputClosed;int disconnects,replies;
                            BrowserConnection(java.net.URL url){super(url);}
                            @Override public void setRequestProperty(String k,String v){headers.put(k,v);}
                            @Override public java.io.OutputStream getOutputStream(){return new java.io.OutputStream(){
                                @Override public void write(int b){throw new AssertionError("Original native request array required");}
                                @Override public void write(byte[] bytes,int off,int len){assertNull(owned);assertEquals(0,off);assertEquals(bytes.length,len);owned=bytes;copy=bytes.clone();}
                                @Override public void close(){outputClosed=true;}
                            };}
                            @Override public int getResponseCode() throws java.io.IOException {
                                assertEquals(1,++replies);
                                observedBrowserStage("HTTP:"+getURL().getPath(),control,actionStarted,null);
                                long observedAt=getURL().getPath().equals(NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH)?System.currentTimeMillis():0;
                                byte[] archived=null,args=null,current=null;
                                try {
                                    control.check();assertTrue(outputClosed);assertNotNull(copy);assertEquals(copy.length,fixedContentLength);
                                    assertEquals("POST",getRequestMethod());assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));assertFalse(Thread.holdsLock(control));
                                    assertThrows("Exact loan must survive response await",VaultFailure.class,control::beginPiece);
                                    assertEquals(f.originalVault.deviceId,headers.get("X-Device-Id"));
                                    assertEquals(InstrumentedTransport.CREDENTIAL,headers.get("X-Device-Credential"));
                                    assertEquals(NativeAttestation.REQUEST_VERSION,headers.get("X-Memphis-Native-Attestation-Version"));
                                    assertEquals("https://localhost",headers.get("Origin"));assertEquals("custodial",headers.get("X-Memphis-App-Edition"));
                                    assertEquals("application/json; charset=utf-8",headers.get("Content-Type"));assertEquals("identity",headers.get("Accept-Encoding"));
                                    assertTrue(headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                                    firstCustodyLostSameFiles(files,identities);
                                    String path=getURL().getPath();var body=ProviderWireJson.object(copy,786432);
                                    if(path.equals(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH)
                                        ||path.equals(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH)) {
                                        assertEquals(NativePrivateCustodyCurrentQueryEnvelope.SCHEMA,body.getString("schema"));
                                        NativeRetainedAttempt.keys(body,"schema","original_query_body_base64","original_query_timestamp","original_query_http_attestation","original_query_unknown_record_sha256");
                                        archived=java.util.Base64.getDecoder().decode(body.getString("original_query_body_base64"));
                                        var q=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);int index=Integer.parseInt(q.getString("chunk_index"));
                                        var write=ProviderWireJson.object(writes.get("write-"+index),NativeRetainedAttempt.MAX_BODY);
                                        for(String key:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_count","chunk_index"})
                                            assertEquals(write.get(key),q.get(key));
                                        assertEquals(q.getString("read_query_id"),headers.get("X-Memphis-Native-Request-Id"));
                                        assertEquals(NativeRetainedAttempt.hash(files.get(exchange.resolve("query_unknown-"+index+".bin"))),body.getString("original_query_unknown_record_sha256"));
                                        if(index==0)assertEquals(ProviderWireJson.object(challenge,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT)
                                            .getString("current_original_query_envelope_base64"),java.util.Base64.getEncoder().encodeToString(copy));
                                        if(writes.containsKey("query-"+index)){
                                            assertArrayEquals(writes.get("query-"+index),archived);
                                            assertEquals(oldHeaders.get("query-"+index).get("X-Memphis-Native-Request-Timestamp"),body.getString("original_query_timestamp"));
                                            assertEquals(oldHeaders.get("query-"+index).get("X-Memphis-Native-Request-Attestation"),body.getString("original_query_http_attestation"));
                                        }
                                        if(path.equals(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH)) {
                                            assertEquals(index,(int)counts.getOrDefault("CURRENT",0));counts.merge("CURRENT",1,Integer::sum);
                                            reply=fullCurrentFramePieceData(body,writes.get("write-"+index),oldHeaders.get("write-"+index),new JSONObject(f.originalPrincipal).getString("credential_id"));
                                        } else {
                                            assertEquals(0,index);assertEquals(1,(int)counts.merge("TARGET",1,Integer::sum));
                                            reply=androidOriginalChallengeTargetData(body,copy,new JSONObject(f.originalPrincipal));
                                            var target=new JSONObject(new String(reply,StandardCharsets.UTF_8)).getJSONObject("data").getJSONObject("original_target");
                                            if(expectedTarget.get()==null)expectedTarget.set(target);else assertTrue(ProviderWireJson.same(expectedTarget.get(),target));
                                        }
                                    } else if(path.equals(NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH)) {
                                        assertEquals("custodial.same-original-manager-preparation-native-read.v1",body.getString("schema"));
                                        archived=java.util.Base64.getDecoder().decode(body.getString("original_challenge_body_base64"));assertArrayEquals(challenge,archived);
                                        assertEquals(challengeHeaders.get("X-Memphis-Native-Request-Id"),headers.get("X-Memphis-Native-Request-Id"));
                                        assertEquals(challengeHeaders.get("X-Memphis-Native-Request-Timestamp"),body.getString("original_challenge_timestamp"));
                                        assertEquals(challengeHeaders.get("X-Memphis-Native-Request-Attestation"),body.getString("original_challenge_http_attestation"));
                                        assertTrue(counts.merge("MANAGER",1,Integer::sum)<=2);
                                        if(originalApproval.get()==null) {
                                            assertEquals("Only the FIRST manager READ may issue fixture approval",0,ordinal);
                                            assertEquals(1,(int)counts.get("MANAGER"));
                                            String approval=androidSavedBrowserApprovalData(registration,expectedTarget.get(),observedAt).toString();
                                            assertTrue(originalApproval.compareAndSet(null,approval));
                                        }
                                        reply=androidOriginalChallengeWire(androidSavedBrowserManagerData(originalRegistration,originalApproval.get(),observedAt));
                                    } else {
                                        assertEquals("No WRITE/QUERY/challenge resend, status or extra endpoint",NativeSameOriginalCompletionReadEnvelope.PATH,path);
                                        assertEquals(NativeSameOriginalCompletionReadEnvelope.SCHEMA,body.getString("schema"));
                                        NativeRetainedAttempt.keys(body,"schema","current_original_query_envelope_base64","original_completion_arguments_base64");
                                        args=java.util.Base64.getDecoder().decode(body.getString("original_completion_arguments_base64"));
                                        assertTrue("Nonempty exact initial completion, never empty-group success",args.length>0);
                                        assertEquals(f.unitCompletionArguments,new String(args,StandardCharsets.UTF_8));
                                        current=java.util.Base64.getDecoder().decode(body.getString("current_original_query_envelope_base64"));
                                        assertEquals(ProviderWireJson.object(challenge,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT)
                                            .getString("current_original_query_envelope_base64"),java.util.Base64.getEncoder().encodeToString(current));
                                        var envelope=ProviderWireJson.object(current,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
                                        archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));var q=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
                                        assertEquals(q.getString("read_query_id"),headers.get("X-Memphis-Native-Request-Id"));
                                        assertEquals(NativeRetainedAttempt.hash(files.get(exchange.resolve("query_unknown-0.bin"))),envelope.getString("original_query_unknown_record_sha256"));
                                        assertEquals(1,(int)counts.merge("COMPLETION",1,Integer::sum));
                                        reply=androidOriginalChallengeWire(new JSONObject().put("schema","custodial.same-original-completion-SQL-read.v1")
                                            .put("state","CURRENT_EXACT_ORIGINAL_COMPLETION_DISPOSITION_NOT_ACK").put("operation_id",q.get("operation_id"))
                                            .put("original_generation_id",q.get("original_generation_id")).put("argument_values_sha256",NativeRetainedAttempt.hash(args))
                                            .put("disposition","UNRESOLVED_RETAINED").put("result",JSONObject.NULL).put("transaction_authority",false).put("limits",androidOriginalChallengeLimits()));
                                    }
                                    assertTrue(reply.length>0&&reply.length<=NativePrivateCustodyHttp.MAX_RESPONSE);control.check();return 200;
                                } catch(Exception|Error failure){observationFailure.compareAndSet(null,failure);throw new java.io.IOException("UNIT_saved_browser_wire_observation",failure);}
                                finally{for(byte[] bytes:new byte[][]{archived,args,current})if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);}
                            }
                            @Override public java.io.InputStream getInputStream(){return new java.io.ByteArrayInputStream(reply);}
                            @Override public java.io.InputStream getErrorStream(){throw new AssertionError("No error fixture");}
                            @Override public java.util.Map<String,java.util.List<String>> getHeaderFields(){return java.util.Map.of("Content-Type",java.util.List.of("application/json"));}
                            @Override public void disconnect(){
                                assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));assertFalse(Thread.holdsLock(control));
                                assertNotNull(owned);assertArrayEquals(copy,owned);assertThrows("No premature piece retirement",VaultFailure.class,control::beginPiece);disconnects++;
                            }
                            @Override public boolean usingProxy(){return false;}
                            @Override public void connect(){throw new AssertionError("Synthetic Connections never opens a socket");}
                            @Override public String getCipherSuite(){throw new AssertionError("No TLS proof");}
                            @Override public java.security.cert.Certificate[] getLocalCertificates(){return null;}
                            @Override public java.security.cert.Certificate[] getServerCertificates(){return null;}
                            void wipe(){if(copy!=null)java.util.Arrays.fill(copy,(byte)0);if(owned!=null)java.util.Arrays.fill(owned,(byte)0);java.util.Arrays.fill(reply,(byte)0);headers.clear();}
                        }
                        var actionConnections=new java.util.ArrayList<BrowserConnection>();
                        var http=new NativePrivateCustodyHttp(url->{
                            assertTrue(url.toString().startsWith(NativePrivateCustodyHttp.ORIGIN+"/"));
                            String path=url.getPath();assertTrue(java.util.Set.of(VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,
                                VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH,NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH,
                                NativeSameOriginalCompletionReadEnvelope.PATH).contains(path));
                            assertEquals(NativePrivateCustodyHttp.ORIGIN+path,url.toString());
                            var c=new BrowserConnection(url);actionConnections.add(c);wipes.add(c::wipe);return c;
                        },System::currentTimeMillis);
                        try(var read=observedBrowserStage("READ",control,actionStarted,
                                inventoryProducer!=null&&ordinal>=2?
                                    AndroidPrivateCustodyOwnerRecovery.readHeldSavedOriginalCurrentFrameForBrowserPreparation(f.application,f.engine,f.work,
                                        f.principalJournal,f.legacy,f.providerCoordinator,http,control):
                                    AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrameForBrowserPreparation(f.application,f.engine,f.work,
                                        f.principalJournal,f.legacy,f.providerCoordinator,http,control));
                            var target=observedBrowserStage("TARGET",control,actionStarted,read.takeOriginalRecoveryTarget(http));
                            var intent=observedBrowserStage("INTENT",control,actionStarted,target.takeExistingOriginalPreparationIntent());
                            var prepared=observedBrowserStage("PREPARED",control,actionStarted,intent.takeOriginalChallengeRequest())) {
                            JSONObject result;
                            long preservationStarted=System.nanoTime();
                            try{
                                result=f.engine.preserveOriginalBrowserUnderCurrentManager(prepared,http,control,
                                    ordinal==0||inventoryProducer!=null&&ordinal>=2?attached.get():null);
                            }catch(VaultFailure failure){
                                // Keep the actual selected fixture observation
                                // if HTTP deliberately sanitizes its exception.
                                var observed=observationFailure.get();
                                if(observed!=null&&observed!=failure)failure.addSuppressed(observed);
                                // Read actual transient test control timing; never change its
                                // deadline, cancellation, owner, Source inputs or authority.
                                try{
                                    var deadlineField=NativePrivateCustodyFrameReadControl.class.getDeclaredField("deadline");
                                    deadlineField.setAccessible(true);
                                    long deadline=deadlineField.getLong(control),failedAt=System.nanoTime();
                                    android.util.Log.e("CustodialRecoveryTest","BROWSER_MANAGER_CONTROL ordinal="+ordinal
                                        +" callMillis="+((failedAt-preservationStarted)/1_000_000L)
                                        +" remainingAtCallMillis="+((deadline-preservationStarted)/1_000_000L)
                                        +" remainingAtFailureMillis="+((deadline-failedAt)/1_000_000L));
                                    var exchangeField=prepared.getClass().getDeclaredField("browserPreparationExchange");
                                    exchangeField.setAccessible(true);var actualExchange=exchangeField.get(prepared);
                                    if(actualExchange!=null){
                                        var pendingField=actualExchange.getClass().getDeclaredField("pending");pendingField.setAccessible(true);
                                        var actualPending=pendingField.get(actualExchange);
                                        var startedField=actualPending.getClass().getDeclaredField("startedNanos");startedField.setAccessible(true);
                                        android.util.Log.e("CustodialRecoveryTest","BROWSER_CAPTURE_TIMING ordinal="+ordinal
                                            +" ageAtFailureMillis="+((failedAt-startedField.getLong(actualPending))/1_000_000L));
                                    }
                                    var source=attached.get();
                                    if(source!=null){
                                        var monitorField=NativeOriginalBrowserPreparation.class.getDeclaredField("monitor");monitorField.setAccessible(true);
                                        synchronized(monitorField.get(source)){
                                            var state=new StringBuilder("BROWSER_SOURCE_STATE ordinal=").append(ordinal);
                                            for(String name:new String[]{"closed","ready","documentUsed","document","documentProxy","pending","recoveryReload"}){
                                                var field=NativeOriginalBrowserPreparation.class.getDeclaredField(name);field.setAccessible(true);
                                                Object fieldValue=field.get(source);
                                                state.append(' ').append(name).append('=').append(field.getType().isPrimitive()?fieldValue:fieldValue!=null);
                                            }
                                            android.util.Log.e("CustodialRecoveryTest",state.toString());
                                        }
                                    }
                                }catch(Exception diagnostic){failure.addSuppressed(diagnostic);}
                                throw failure;
                            }
                            // The first action preserves and witnesses the
                            // actual injected browser original. A separate
                            // unheld read restores that SAME saved DATA through
                            // the normal null-Source path and fresh manager
                            // checks before the denial-only durable HELD step.
                            // Later ACK actions still require the actual live
                            // held-browser Source with its unchanged lifetime.
                            if(inventoryProducer!=null&&ordinal>0){
                                observedBrowserStage("PRESERVED_BEFORE_INVENTORY",control,actionStarted,result);
                                inventoryProducer.afterPreservation(f,ordinal-1,prepared,http,control,
                                    ordinal==1?null:attached.get(),files,identities,children);
                            }
                            androidOriginalChallengeNoEffects(result);assertEquals("custodial.native-current-original-browser-preparation.v3",result.getString("schema"));
                            var manager=result.getJSONObject("manager_preparation_observation");assertFalse(manager.getBoolean("transaction_authority"));
                            androidOriginalChallengeNoEffects(manager.getJSONObject("limits"));
                            assertEquals(ordinal==0?"CURRENT_MANAGER_AND_LOCAL_BROWSER_CUSTODY_OBSERVED_NOT_ACK":
                                inventoryProducer!=null&&ordinal>=2?"CURRENT_MANAGER_AND_EXISTING_HELD_BROWSER_DATA_MATCHED_NOT_ACK":
                                "CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY",result.getString("state"));
                            var completed=result.getJSONObject("current_original_completion_read_observation");androidOriginalChallengeNoEffects(completed);
                            assertEquals(1,completed.getInt("selected_argument_count"));assertEquals(1,completed.getInt("unresolved_selected_count"));assertEquals(0,completed.getInt("accepted_count"));
                            assertEquals(2,(int)counts.getOrDefault("MANAGER",0));assertEquals(1,(int)counts.getOrDefault("COMPLETION",0));assertEquals(1,(int)counts.getOrDefault("TARGET",0));
                            assertEquals(Integer.parseInt(ProviderWireJson.object(writes.get("write-0"),NativeRetainedAttempt.MAX_BODY).getString("chunk_count")),(int)counts.getOrDefault("CURRENT",0));
                            firstCustodyLostSameFiles(files,identities);assertNull(observationFailure.get());control.check();
                            var names=initialBootstrapChildNames(exchange);var added=new java.util.TreeSet<>(names);added.removeAll(originalNames);
                            assertTrue(added.contains("browser_frame-0.bin"));assertTrue(added.contains("browser_chunk-0.bin"));
                            for(String name:added)assertTrue(name.matches("browser_(?:frame-0|chunk-[0-9]+)\\.bin")
                                ||inventoryProducer!=null&&ordinal>0&&name.matches("inventory_(?:frame|chunk|unknown|observation|decision|finalization_intent)-[0-9]+\\.bin"));
                            if(ordinal==0) {
                                for(String name:added)firstCustodyLostSnapshot(exchange.resolve(name),3_200_000,files,identities);
                                // Admit ONLY newly normal-produced browser files,
                                // never change any earlier native witness.
                                children.put(exchange,new java.util.TreeSet<>(names));
                                var storage=androidSavedBrowserEvaluate(activity.get(),"JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])");
                                androidSavedBrowserOriginalRows(existing,storage,
                                    result.getJSONObject("original_browser_local_custody").getString("operation_id"));afterFirstStorage=storage;
                                assertEquals(JSONObject.quote(value),androidSavedBrowserEvaluate(activity.get(),"localStorage.getItem("+JSONObject.quote(row)+")"));
                            } else if(inventoryProducer==null||ordinal==1) {
                                assertEquals(children.get(exchange),names);firstCustodyLostSameFiles(files,identities);
                                assertEquals(afterFirstStorage,androidSavedBrowserEvaluate(activity.get(),"JSON.stringify([Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])])"));
                                assertEquals("SAVED_ORIGINAL_TYPED_DATA_RESTORED_NOT_CURRENT_BROWSER_AUTHORITY",result.getJSONObject("original_browser_local_custody").getString("state"));
                                assertTrue("Actual saved original browser DATA is nonempty",result.getJSONObject("original_browser_local_custody").getInt("record_count")>=1);
                            }
                            for(var c:actionConnections){assertEquals(1,c.disconnects);assertArrayEquals(new byte[c.owned.length],c.owned);}
                            stageCounts.put("ACTION_"+ordinal,1);
                        }
                    }
                }
                assertEquals(browserDiagnostic!=null?java.util.Map.of("ACTION_0",1):inventoryProducer==null?java.util.Map.of("ACTION_0",1,"ACTION_1",1):java.util.Map.of("ACTION_0",1,"ACTION_1",1,"ACTION_2",1,"ACTION_3",1),stageCounts);assertNull(observationFailure.get());
                } // diagnostic trace closes after the exact original action's normal witnesses
                firstCustodyLostSameFiles(files,identities);assertTrue(initialBootstrapSameRaw(inventoryProducer==null?f.originalPayload:inventoryProducer.expectedRaw(f),initialBootstrapRawOwners(f.owners)));
                assertEquals(f.aliases,initialBootstrapAliases());assertEquals(1,f.unit.completionCalls.get());
                System.out.println(browserDiagnostic!=null?
                    "UNIT_ANDROID_FIRST_BROWSER_ACTION_DIAGNOSTIC_ONLY; no saved-manager second action, private ACK or release acceptance":inventoryProducer==null?
                    "UNIT_ANDROID_ATTACHED_BROWSER_THEN_SAVED_MANAGER_STATUS_RETURNED; synthetic DATA only; no manager SQL ACK release authority":
                    "UNIT_ANDROID_REAL_HELD_BROWSER_TYPED_INVENTORY_CONSUMERS_RETURNED; synthetic server DATA; no genuine SQL manager or physical readiness proof");
        }catch(Exception|Error failure){primary=failure;throw failure;}
        finally{
            try{browserFixture.close();}
            catch(Exception|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally{for(var wipe:wipes)wipe.run();}
        }
    }

    /** Read-only diagnostic DATA, never admission/currentness or a repair.
     * No GC, setting, native/browse owner, control or deadline is changed. */
    static void observeProcessForNativeStartup(String stage){
        try{
            var runtime=Runtime.getRuntime();var value=new JSONObject().put("stage",stage)
                .put("pid",android.os.Process.myPid()).put("java_heap_used",runtime.totalMemory()-runtime.freeMemory())
                .put("java_heap_committed",runtime.totalMemory()).put("java_heap_max",runtime.maxMemory())
                .put("native_heap_allocated",android.os.Debug.getNativeHeapAllocatedSize())
                .put("native_heap_size",android.os.Debug.getNativeHeapSize());
            int count=0;
            try(var descriptors=java.nio.file.Files.newDirectoryStream(java.nio.file.Path.of("/proc/self/fd"))){
                for(var ignored:descriptors){count++;if(count>=16384)break;}
            }
            value.put("observed_fd_count_including_this_probe",count);
            String status=new String(java.nio.file.Files.readAllBytes(java.nio.file.Path.of("/proc/self/status")),StandardCharsets.UTF_8);
            if(status.length()>16384)throw new IllegalStateException("Bounded own process status required");
            for(String line:status.split("\n")){
                int colon=line.indexOf(':');if(colon<0)continue;String key=line.substring(0,colon);
                if(java.util.Set.of("FDSize","VmPeak","VmSize","VmRSS","RssAnon","RssFile","RssShmem","Threads").contains(key))
                    value.put(key,line.substring(colon+1).trim());
            }
            android.util.Log.i("CustodialProcessObservation",value.toString());
        }catch(Exception unavailable){
            android.util.Log.w("CustodialProcessObservation","Read-only observation unavailable at "+stage+": "+unavailable.getClass().getSimpleName());
        }
    }
    private static String androidSavedBrowserEvaluate(BridgeSmokeActivity activity,String script) throws Exception {
        var done=new CountDownLatch(1);var result=new AtomicReference<String>();
        activity.runOnUiThread(()->activity.getBridge().getWebView().evaluateJavascript(script,v->{result.set(v);done.countDown();}));
        assertTrue("Bounded real WebView evaluation did not settle",done.await(5,TimeUnit.SECONDS));assertNotNull(result.get());return result.get();
    }
    /** Diagnostic only: return the SAME already-produced resource, without a
     * constructor, callback, field write, new control or changed close order.
     * Even diagnostic failure cannot replace the operation's result. */
    private static <T> T observedBrowserStage(String stage,NativePrivateCustodyFrameReadControl control,long started,T actual){
        try{
            var field=NativePrivateCustodyFrameReadControl.class.getDeclaredField("deadline");field.setAccessible(true);
            long now=System.nanoTime(),deadline=field.getLong(control);
            android.util.Log.i("CustodialRecoveryTest","BROWSER_STAGE "+stage+" elapsedMillis="+((now-started)/1_000_000L)
                +" remainingMillis="+((deadline-now)/1_000_000L));
        }catch(Exception diagnostic){
            try{android.util.Log.w("CustodialRecoveryTest","BROWSER_STAGE diagnostic unavailable");}catch(Exception ignored){}
        }
        return actual;
    }
    private static void androidSavedBrowserOriginalRows(String old,String current,String operationId) throws Exception {
        var before=new org.json.JSONArray((String)new org.json.JSONTokener(old).nextValue());
        var after=new org.json.JSONArray((String)new org.json.JSONTokener(current).nextValue());
        final String epochKey="mz_custodial_protected_browser_mutation.v1",holdKey="mz_custodial_protected_browser_hold.v1";
        assertEquals(2,before.length());assertEquals(2,after.length());
        assertEquals("Only the FIRST hold marker may be added",before.getJSONArray(0).length()+1,after.getJSONArray(0).length());
        assertEquals("Session membership is unchanged",before.getJSONArray(1).length(),after.getJSONArray(1).length());
        boolean epochObserved=false,holdObserved=false;
        for(int storage=0;storage<2;storage++)for(int row=0;row<before.getJSONArray(storage).length();row++) {
            var expected=before.getJSONArray(storage).getJSONArray(row);boolean found=false;
            assertFalse("FIRST cannot replace a prior hold",storage==0&&holdKey.equals(expected.getString(0)));
            for(int n=0;n<after.getJSONArray(storage).length();n++) {
                var actual=after.getJSONArray(storage).getJSONArray(n);
                if(expected.getString(0).equals(actual.getString(0))){
                    if(storage==0&&epochKey.equals(expected.getString(0))){
                        assertFalse(epochObserved);epochObserved=true;
                        assertTrue(expected.getString(1).matches("[1-9][0-9]{0,18}"));
                        assertEquals("FIRST hold advances exactly one original rejection epoch",
                            new java.math.BigInteger(expected.getString(1)).add(java.math.BigInteger.ONE).toString(),actual.getString(1));
                    }else assertEquals("Original browser bytes for "+expected.getString(0),expected.get(1),actual.get(1));
                    assertFalse("Original keys cannot be duplicated",found);found=true;
                }
            }
            assertTrue("Preexisting unknown browser row retained",found);
        }
        for(int n=0;n<after.getJSONArray(0).length();n++){
            var actual=after.getJSONArray(0).getJSONArray(n);
            if(holdKey.equals(actual.getString(0))){
                assertFalse(holdObserved);holdObserved=true;var marker=new JSONObject(actual.getString(1));
                NativeRetainedAttempt.keys(marker,"schema","operation_id","native_authority");
                assertEquals("custodial.browser-preservation-hold.v1",marker.getString("schema"));
                assertEquals(operationId,marker.getString("operation_id"));assertFalse(marker.getBoolean("native_authority"));
            }
        }
        assertTrue("Original mutation epoch must be witnessed",epochObserved);
        assertTrue("Actual operation-bound hold must remain",holdObserved);
    }

    /** New selected case ONLY: actual sampled test-server registration,
     * same240s duration and exact public original-request transcript math. */
    private static JSONObject androidSavedBrowserRegistrationData(byte[] actualBody,
        java.util.Map<String,String> headers,String credentialId,long registeredAt) throws Exception {
        byte[] transcript=null,bindingBytes=null;
        try {
            var body=ProviderWireJson.object(actualBody,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);
            assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA,body.getString("schema"));
            String id=headers.get("X-Memphis-Native-Request-Id");assertEquals(id,body.getString("native_challenge_intent_id"));
            long original=VaultTimestamps.epochMillis(headers.get("X-Memphis-Native-Request-Timestamp"),NativeRetainedAttempt.FAILURE);
            // Actual test-server receive sample, never clipped to client time.
            assertTrue("Actual registration receive is outside the existing -30s/+120s client window",
                registeredAt>=Math.subtractExact(original,30000L)&&registeredAt<=Math.addExact(original,120000L));
            long expiry=Math.addExact(registeredAt,240000L);
            // The wire ALSO caps expiry at original-client+300s. With the
            // unchanged240s duration a receive delay above60s MUST refuse,
            // not shorten/renew the receipt or fabricate an earlier sample.
            assertTrue("Actual registration cannot carry240s within original-client+300s max",
                expiry<=Math.addExact(original,300000L));
            String registered=VaultTimestamps.fromEpochMillisExact(registeredAt),expires=VaultTimestamps.fromEpochMillisExact(expiry);
            var data=new JSONObject().put("schema","custodial.same-original-recovery-native-challenge-receipt.v1")
                .put("state","ORIGINAL_CHALLENGE_RECORDED_PREPARATION_ONLY").put("challenge_id",id)
                .put("original_target_sha256",body.get("original_target_sha256")).put("native_challenge_intent_id",id)
                .put("native_challenge_intent_record_sha256",body.get("native_challenge_intent_record_sha256"))
                .put("registered_at",registered.substring(0,registered.length()-1)+"000Z")
                .put("expires_at",expires.substring(0,expires.length()-1)+"000Z")
                .put("retry_safe",false).put("limits",androidOriginalChallengeLimits());
            transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION).put(credentialId)
                .put(headers.get("X-Device-Id")).put("POST").put(NativeSameOriginalRecoveryChallengeEnvelope.PATH)
                .put(NativeRetainedAttempt.hash(actualBody)).put(id).put(headers.get("X-Memphis-Native-Request-Timestamp"))
                .put(headers.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8);
            String binding="custodial.same-original-native-challenge-binding.v1\n"+id+'\n'
                +NativeRetainedAttempt.hash(actualBody)+'\n'+NativeRetainedAttempt.hash(transcript)+'\n'
                +data.getString("native_challenge_intent_record_sha256")+'\n'+data.getString("original_target_sha256")+'\n'
                +data.getString("registered_at")+'\n'+data.getString("expires_at");
            bindingBytes=binding.getBytes(StandardCharsets.UTF_8);data.put("challenge_sha256",NativeRetainedAttempt.hash(bindingBytes));return data;
        } finally {
            if(transcript!=null)java.util.Arrays.fill(transcript,(byte)0);
            if(bindingBytes!=null)java.util.Arrays.fill(bindingBytes,(byte)0);
        }
    }

    // Public canonical WireTest DATA/math only, not manager admission.
    // Pure document math from the canonical public wire grammar; NOT signing,
    // admission, controller approval, a manager identity or a capability API.
    private static String androidSavedBrowserCanonical(JSONObject value)throws Exception{
        var out=new StringBuilder("{");boolean first=true;
        var names=new java.util.TreeSet<String>();for(var keys=value.keys();keys.hasNext();)names.add(keys.next());
        for(String name:names){
            if(!first)out.append(',');first=false;Object item=value.get(name);
            String encoded;
            if(item instanceof JSONObject)encoded=androidSavedBrowserCanonical((JSONObject)item);
            else{
                // Android's platform JSONObject has no valueToString API.
                // These fixed wire documents contain only scalar leaves.
                assertTrue(item==JSONObject.NULL||item instanceof String||item instanceof Boolean||item instanceof Number);
                String scalar=new org.json.JSONArray().put(item).toString();encoded=scalar.substring(1,scalar.length()-1);
            }
            out.append(JSONObject.quote(name)).append(':').append(encoded);
        }return out.append('}').toString();
    }
    private static String androidSavedBrowserHashText(String value)throws Exception{
        byte[] bytes=value.getBytes(StandardCharsets.UTF_8);try{return NativeRetainedAttempt.hash(bytes);}finally{java.util.Arrays.fill(bytes,(byte)0);}
    }
    private static String androidSavedBrowserDocument(String kind,JSONObject value)throws Exception{
        var copy=new JSONObject(value.toString());if(kind.equals("receipt"))copy.remove("receipt_sha256");
        return androidSavedBrowserHashText("custodial.same-original-recovery-"+kind+".v1\n"+androidSavedBrowserCanonical(copy));
    }
    private static String androidSavedBrowserMicros(long millis)throws Exception{
        String time=VaultTimestamps.fromEpochMillisExact(millis);return time.substring(0,time.length()-1)+"000Z";
    }
    private static JSONObject androidSavedBrowserApprovalData(JSONObject registration,JSONObject target,long issuedAt)throws Exception{
        var preview=new JSONObject().put("schema","custodial.same-original-recovery-review.v1").put("state","ORIGINAL_BINDING_REVIEW_ONLY")
            .put("purpose",NativeSameOriginalRecoveryPreparationWire.PURPOSE).put("challenge_id",registration.get("challenge_id"))
            .put("challenge_sha256",registration.get("challenge_sha256")).put("original_target",target)
            .put("expires_at",registration.get("expires_at")).put("limits",androidOriginalChallengeLimits());
        String previewSha=androidSavedBrowserDocument("preview",preview);
        // EXACT existing WireTest UNIT issuer literals, never a real manager.
        String manager="95000000-0000-4000-8000-000000000031",credential="95000000-0000-4000-8000-000000000032";
        var request=new JSONObject().put("schema","custodial.same-original-recovery-approval-request.v1")
            .put("request_id","95000000-0000-4000-8000-000000000033").put("challenge_id",registration.get("challenge_id"))
            .put("expected_challenge_sha256",registration.get("challenge_sha256")).put("expected_preview_sha256",previewSha)
            .put("expected_manager_id",manager).put("expected_manager_credential_id",credential).put("expected_manager_device_id","manager-fixture")
            .put("decision",NativeSameOriginalRecoveryPreparationWire.PURPOSE).put("manager_confirmation","CONFIRM_THIS_SAME_ORIGINAL_ONLY");
        long registeredAt=VaultTimestamps.epochMillis(registration.getString("registered_at"),NativeRetainedAttempt.FAILURE);
        long registrationExpiry=VaultTimestamps.epochMillis(registration.getString("expires_at"),NativeRetainedAttempt.FAILURE);
        assertTrue("Actual first approval must follow registration and precede its original expiry",issuedAt>=registeredAt&&issuedAt<registrationExpiry);
        long approvalExpiry=Math.min(registrationExpiry,Math.addExact(issuedAt,180000L));
        var approval=new JSONObject().put("schema","custodial.same-original-recovery-approval-receipt.v1").put("state","APPROVAL_RECORDED_ONLY")
            .put("approval_id","95000000-0000-4000-8000-000000000034").put("original_request",request)
            .put("original_request_sha256",androidSavedBrowserDocument("request",request))
            .put("issuer",new JSONObject().put("manager_id",manager).put("manager_credential_id",credential).put("manager_device_id","manager-fixture"))
            .put("challenge_sha256",registration.get("challenge_sha256")).put("preview_sha256",previewSha).put("original_target",target)
            .put("purpose_admission_id",NativeSameOriginalRecoveryPreparationWire.ADMISSION).put("issued_at",androidSavedBrowserMicros(issuedAt))
            .put("expires_at",androidSavedBrowserMicros(approvalExpiry)).put("retry_safe",false).put("limits",androidOriginalChallengeLimits());
        approval.put("receipt_sha256",androidSavedBrowserDocument("receipt",approval));
        return approval;
    }
    /** Reuse BOTH exact original receipt strings. Only this READ's sampled
     * observed_at/current_until change; neither original expiry is renewed. */
    private static JSONObject androidSavedBrowserManagerData(String registrationUtf8,String approvalUtf8,long observedAt)throws Exception{
        var registration=new JSONObject(registrationUtf8);var approval=new JSONObject(approvalUtf8);
        long registeredAt=VaultTimestamps.epochMillis(registration.getString("registered_at"),NativeRetainedAttempt.FAILURE);
        long registrationExpiry=VaultTimestamps.epochMillis(registration.getString("expires_at"),NativeRetainedAttempt.FAILURE);
        long issuedAt=VaultTimestamps.epochMillis(approval.getString("issued_at"),NativeRetainedAttempt.FAILURE);
        long approvalExpiry=VaultTimestamps.epochMillis(approval.getString("expires_at"),NativeRetainedAttempt.FAILURE);
        if(!(issuedAt>=registeredAt&&observedAt>=issuedAt&&observedAt>=registeredAt&&observedAt<approvalExpiry&&observedAt<registrationExpiry))
            android.util.Log.e("CustodialRecoveryTest","MANAGER_ORIGINAL_WINDOW_EXPIRED registrationAgeMillis="+(observedAt-registeredAt)
                +" registrationRemainingMillis="+(registrationExpiry-observedAt)+" approvalAgeMillis="+(observedAt-issuedAt)
                +" approvalRemainingMillis="+(approvalExpiry-observedAt));
        assertTrue("Actual current observation cannot precede admission or survive either original expiry",
            issuedAt>=registeredAt&&observedAt>=issuedAt&&observedAt>=registeredAt&&observedAt<approvalExpiry&&observedAt<registrationExpiry);
        long currentUntil=Math.min(Math.min(approvalExpiry,registrationExpiry),Math.addExact(observedAt,120000L));
        return new JSONObject().put("schema",NativeSameOriginalRecoveryManagerPreparationWire.SCHEMA)
            .put("state",NativeSameOriginalRecoveryManagerPreparationWire.STATE).put("purpose_admission_id",NativeSameOriginalRecoveryPreparationWire.ADMISSION)
            .put("original_registration_utf8",registrationUtf8).put("original_approval_receipt_utf8",approvalUtf8)
            .put("observed_at",androidSavedBrowserMicros(observedAt)).put("current_until",androidSavedBrowserMicros(currentUntil))
            .put("transaction_authority",false).put("limits",androidOriginalChallengeLimits());
    }

    private static void androidOriginalChallengeNoEffects(JSONObject value) throws Exception {
        for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
            assertFalse(name,value.getBoolean(name));
    }

    private static JSONObject androidOriginalChallengeLimits() throws Exception {
        var limits=new JSONObject();
        for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
            limits.put(name,false);
        return limits;
    }

    private static byte[] androidOriginalChallengeWire(JSONObject data) throws Exception {
        return new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);
    }

    /** Pure public-wire TEST DATA from the actual authenticated archived QUERY
     * and SAME Android principal. Four server mapping literals are explicitly
     * synthetic; they are not independent native/manager/SQL approval evidence. */
    private static byte[] androidOriginalChallengeTargetData(JSONObject envelope,byte[] actualTargetBody,JSONObject principal) throws Exception {
        byte[] archived=null,proofBytes=null,targetBytes=null;
        try {
            archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
            var query=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
            proofBytes=java.util.Base64.getDecoder().decode(query.getString("owner_proof_base64"));
            var proof=ProviderWireJson.object(proofBytes,262144);var target=new JSONObject();
            for(String name:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision",
                "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256"})target.put(name,query.get(name));
            for(String name:new String[]{"credential_id","original_wire_sha256","capsule_sha256","aad_binding_sha256",
                "source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"})target.put(name,proof.get(name));
            target.put("employee_id",principal.getString("employee_id")).put("assignment_epoch",principal.get("assignment_epoch").toString())
                .put("canonical_device_id",principal.getString("device_id"))
                .put("separation_id","95000000-0000-4000-8000-000000000101")
                .put("separation_authority_revision","7").put("canonical_device_pk","95000000-0000-4000-8000-000000000102")
                .put("original_credential_secret_key_id","c".repeat(64));
            targetBytes=target.toString().getBytes(StandardCharsets.UTF_8);
            return androidOriginalChallengeWire(new JSONObject().put("schema","custodial.same-original-recovery-target-observation.v1")
                .put("state","ORIGINAL_TARGET_DESCRIPTOR_ONLY").put("original_target",target)
                .put("original_target_sha256",NativeSameOriginalRecoveryPreparationWire.decodeTarget(targetBytes).documentSha256())
                .put("original_read_query_id",query.get("read_query_id")).put("original_query_body_sha256",NativeRetainedAttempt.hash(archived))
                .put("original_query_unknown_record_sha256",envelope.get("original_query_unknown_record_sha256"))
                .put("current_request_body_sha256",NativeRetainedAttempt.hash(actualTargetBody)).put("limits",androidOriginalChallengeLimits()));
        } finally {
            for(byte[] bytes:new byte[][]{archived,proofBytes,targetBytes})if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);
        }
    }

    /** Canonical registration receipt TEST DATA/document math only. All old
     * request fields come from the actual fixed challenge HTTP boundary; no
     * HMAC/key/time/ID is created or renewed by this public wire encoder. */
    private static JSONObject androidOriginalChallengeRegistrationData(byte[] actualBody,
        java.util.Map<String,String> headers,String credentialId) throws Exception {
        byte[] transcript=null,bindingBytes=null;
        try {
            var body=ProviderWireJson.object(actualBody,NativeSameOriginalRecoveryChallengeEnvelope.MAX_OUTPUT);
            assertEquals(NativeSameOriginalRecoveryChallengeEnvelope.SCHEMA,body.getString("schema"));
            String id=headers.get("X-Memphis-Native-Request-Id");assertEquals(id,body.getString("native_challenge_intent_id"));
            long original=VaultTimestamps.epochMillis(headers.get("X-Memphis-Native-Request-Timestamp"),NativeRetainedAttempt.FAILURE);
            String registered=VaultTimestamps.fromEpochMillisExact(original),expires=VaultTimestamps.fromEpochMillisExact(original+240000);
            var data=new JSONObject().put("schema","custodial.same-original-recovery-native-challenge-receipt.v1")
                .put("state","ORIGINAL_CHALLENGE_RECORDED_PREPARATION_ONLY").put("challenge_id",id)
                .put("original_target_sha256",body.get("original_target_sha256")).put("native_challenge_intent_id",id)
                .put("native_challenge_intent_record_sha256",body.get("native_challenge_intent_record_sha256"))
                .put("registered_at",registered.substring(0,registered.length()-1)+"000Z")
                .put("expires_at",expires.substring(0,expires.length()-1)+"000Z")
                .put("retry_safe",false).put("limits",androidOriginalChallengeLimits());
            transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION).put(credentialId)
                .put(headers.get("X-Device-Id")).put("POST").put(NativeSameOriginalRecoveryChallengeEnvelope.PATH)
                .put(NativeRetainedAttempt.hash(actualBody)).put(id).put(headers.get("X-Memphis-Native-Request-Timestamp"))
                .put(headers.get("X-Memphis-Native-Request-Attestation")).toString().getBytes(StandardCharsets.UTF_8);
            String binding="custodial.same-original-native-challenge-binding.v1\n"+id+'\n'
                +NativeRetainedAttempt.hash(actualBody)+'\n'+NativeRetainedAttempt.hash(transcript)+'\n'
                +data.getString("native_challenge_intent_record_sha256")+'\n'+data.getString("original_target_sha256")+'\n'
                +data.getString("registered_at")+'\n'+data.getString("expires_at");
            bindingBytes=binding.getBytes(StandardCharsets.UTF_8);data.put("challenge_sha256",NativeRetainedAttempt.hash(bindingBytes));return data;
        } finally {
            if(transcript!=null)java.util.Arrays.fill(transcript,(byte)0);
            if(bindingBytes!=null)java.util.Arrays.fill(bindingBytes,(byte)0);
        }
    }

    /** Pure untrusted response DATA, not a capability/receipt factory. Inputs
     * are copied from actual normal WRITE HTTP and authenticated current-read
     * envelope observations. No source getter, signer, key, ID or time is minted.
     * Affirmative wire snapshot fields below are the existing parser's fixture
     * grammar ONLY; native crypto independently verifies every original byte. */
    private static byte[] fullCurrentFramePieceData(JSONObject envelope,byte[] writeBytes,
        java.util.Map<String,String> writeHeaders,String credentialId) throws Exception {
        assertNotNull(writeBytes);assertNotNull(writeHeaders);assertNotNull(credentialId);
        byte[] archived=null,piece=null,transcript=null;
        try {
            archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
            var query=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
            var write=ProviderWireJson.object(writeBytes,NativeRetainedAttempt.MAX_BODY);
            assertEquals("custodial.original-native-private-custody-write.v1",write.getString("schema"));
            assertEquals("custodial.original-native-private-custody-query.v1",query.getString("schema"));
            for(String key:new String[]{"operation_id","original_generation_id","principal_digest","engine_revision",
                "original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","frame_bytes","chunk_count",
                "chunk_index","offset","chunk_bytes","chunk_sha256","attempt_id","read_query_id"})
                assertTrue(write.getString(key).equals(query.getString(key)));
            assertTrue(writeHeaders.get("X-Memphis-Native-Request-Id").equals(query.getString("target_native_request_id")));
            assertTrue(NativeRetainedAttempt.hash(writeBytes).equals(query.getString("target_request_body_sha256")));
            piece=java.util.Base64.getDecoder().decode(write.getString("chunk_base64"));
            assertEquals(Integer.parseInt(query.getString("chunk_bytes")),piece.length);
            assertTrue(NativeRetainedAttempt.hash(piece).equals(query.getString("chunk_sha256")));
            assertTrue(java.util.Base64.getEncoder().encodeToString(piece).equals(write.getString("chunk_base64")));
            transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION).put(credentialId)
                .put(writeHeaders.get("X-Device-Id")).put("POST").put(VaultEngine.NativePrivateCustodyPreparedExchange.PATH)
                .put(NativeRetainedAttempt.hash(archived)).put(query.getString("read_query_id"))
                .put(envelope.getString("original_query_timestamp")).put(envelope.getString("original_query_http_attestation"))
                .toString().getBytes(StandardCharsets.UTF_8);
            // Required six fractional digits represent the SAME observed WRITE
            // timestamp, not a new clock sample, historical send or server fact.
            String oldTime=writeHeaders.get("X-Memphis-Native-Request-Timestamp");
            assertNotNull(oldTime);assertTrue(oldTime.matches(".*\\.[0-9]{3}Z"));
            var row=new JSONObject().put("schema","custodial.private-custody-chunk-readback.v1")
                .put("state","OPAQUE_CHUNK_READ_ONLY_PENDING_RECONCILIATION")
                .put("operation_id",write.get("operation_id")).put("generation_id",write.get("original_generation_id"))
                .put("chunk_index",Integer.parseInt(write.getString("chunk_index")))
                .put("native_request_id",writeHeaders.get("X-Memphis-Native-Request-Id"))
                .put("request_body_sha256",NativeRetainedAttempt.hash(writeBytes))
                .put("attestation_digest",query.get("target_attestation_digest"))
                .put("chunk_bytes",piece.length).put("received_at",oldTime.substring(0,oldTime.length()-1)+"000Z")
                .put("frame_complete_syntax_verified",false);
            for(String key:new String[]{"frame_sha256","record_sha256","plan_sha256","chunk_sha256"})row.put(key,write.get(key));
            for(String key:new String[]{"inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed",
                "finalizer_allowed","key_removal","phone_released"})row.put(key,false);
            var data=new JSONObject().put("schema","custodial.private-custody-original-frame-piece.v1")
                .put("state","CURRENT_SQL_ORIGINAL_ENCRYPTED_PIECE_NOT_NATIVE_OR_SEMANTIC_ACK")
                .put("generation_id",query.get("original_generation_id"))
                .put("encrypted_piece_base64",write.get("chunk_base64")).put("readback",row)
                .put("query_witness",new JSONObject().put("native_request_id",query.get("read_query_id"))
                    .put("request_body_sha256",NativeRetainedAttempt.hash(archived))
                    .put("attestation_digest",NativeRetainedAttempt.hash(transcript))
                    .put("purpose_binding_sha256",query.get("purpose_binding_sha256"))
                    .put("target_prepared_record_sha256",query.get("target_prepared_record_sha256"))
                    .put("target_unknown_record_sha256",query.get("target_unknown_record_sha256")));
            for(String key:new String[]{"operation_id","principal_digest","original_frozen_work_sha256","frame_sha256",
                "record_sha256","plan_sha256","chunk_sha256"})data.put(key,query.get(key));
            for(String key:new String[]{"engine_revision","frame_bytes","chunk_count","chunk_index","offset","chunk_bytes"})
                data.put(key,Long.parseLong(query.getString(key)));
            for(String key:new String[]{"current_SQL_snapshot_frame_readback","frame_complete_syntax_verified",
                "exact_authenticated_original_owner_proof_bytes_match","read_snapshot_is_not_future_acceptance_or_transaction_write_authority"})data.put(key,true);
            for(String key:new String[]{"original_device_key_GCM_server_verified","raw_namespace_values_recovered",
                "complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","inventory_acknowledged","work_accepted",
                "new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})data.put(key,false);
            byte[] response=new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);
            if(response.length>NativePrivateCustodyHttp.MAX_RESPONSE){java.util.Arrays.fill(response,(byte)0);throw new AssertionError("UNIT piece exceeds fixed response cap");}
            return response;
        } finally{for(byte[] bytes:new byte[][]{archived,piece,transcript})if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);}
    }

    private void firstSavedOriginalLostResponse(boolean resumePendingExchange) throws Exception {
        firstSavedOriginalLostResponse(resumePendingExchange,false);
    }

    private void firstSavedOriginalLostResponse(boolean resumePendingExchange,boolean firstQuery) throws Exception {
        firstSavedOriginalLostResponse(resumePendingExchange,firstQuery,false);
    }

    private void firstSavedOriginalLostResponse(boolean resumePendingExchange,boolean firstQuery,boolean currentRead) throws Exception {
        var f=new InitialNativeFixture();
        java.util.Map<java.nio.file.Path,byte[]> originals=new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities=new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> directories=new java.util.HashMap<>();
        java.util.Map<java.nio.file.Path,java.util.Set<String>> originalDirectoryChildren=new java.util.HashMap<>();
        var opens=new java.util.concurrent.atomic.AtomicInteger();
        var lostIssued=new java.util.concurrent.atomic.AtomicBoolean();
        var observationFailure=new AtomicReference<Exception>();
        var lost=new java.net.SocketTimeoutException("UNIT_first_original_response_lost");
        var exchangeDirectory=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
        var firstExchangeNames=java.util.Set.of("exchange.lock","write-0.bin","write_unknown-0.bin");
        var retainedExchangeNames=new java.util.TreeSet<String>(firstExchangeNames);
        boolean pendingArrangementStarted=false;
        final int exchangeMaximum=1_200_000; // Existing fixed WRITE/UNKNOWN file budget.
        class SentBody extends java.io.ByteArrayOutputStream {
            boolean closed;
            @Override public void close() {closed=true;}
            void wipe() {java.util.Arrays.fill(buf,(byte)0);reset();}
        }
        class LostFirstConnection extends javax.net.ssl.HttpsURLConnection {
            final SentBody sent=new SentBody();
            final java.util.Map<String,String> headers=new java.util.HashMap<>();
            final java.util.concurrent.atomic.AtomicInteger replies=new java.util.concurrent.atomic.AtomicInteger();
            final java.util.concurrent.atomic.AtomicInteger disconnects=new java.util.concurrent.atomic.AtomicInteger();
            int outputRequests;
            final JSONObject local;
            final NativePrivateCustodyFrameReadControl control;
            LostFirstConnection(java.net.URL url,JSONObject local,NativePrivateCustodyFrameReadControl control) {
                super(url);this.local=local;this.control=control;
            }
            @Override public void setRequestProperty(String key,String value) {headers.put(key,value);}
            @Override public java.io.OutputStream getOutputStream() {
                assertEquals(1,++outputRequests);return sent;
            }
            @Override public int getResponseCode() throws java.io.IOException {
                assertEquals("Only the first response boundary may be reached",1,replies.incrementAndGet());
                byte[] body=sent.toByteArray();
                try {
                    control.check();assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                    assertTrue("Original body must be completely written/closed before lost reply",sent.closed);
                    assertTrue(body.length>0&&body.length<=NativeRetainedAttempt.MAX_BODY);
                    assertEquals(body.length,fixedContentLength);assertEquals("POST",getRequestMethod());
                    assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                    assertTrue(getConnectTimeout()>0);assertTrue(getReadTimeout()>0);
                    assertTrue("Actual Content-Type pin", "application/json; charset=utf-8".equals(headers.get("Content-Type")));
                    assertTrue("Actual Accept pin","application/json".equals(headers.get("Accept")));
                    assertTrue("Actual encoding pin","identity".equals(headers.get("Accept-Encoding")));
                    assertTrue("Actual Origin pin", "https://localhost".equals(headers.get("Origin")));
                    assertTrue("Actual edition pin", "custodial".equals(headers.get("X-Memphis-App-Edition")));
                    assertTrue("Actual attestation version pin",NativeAttestation.REQUEST_VERSION.equals(headers.get("X-Memphis-Native-Attestation-Version")));
                    for(String name:new String[] {"X-Memphis-Native-Request-Id","X-Memphis-Native-Request-Timestamp",
                        "X-Memphis-Native-Request-Attestation","X-Device-Id","Authorization","X-Device-Credential","X-Memphis-Device-Credential"})
                        assertTrue("Missing actual native request pin",headers.get(name)!=null&&!headers.get(name).isEmpty());
                    assertTrue("Original credential pin only, never logged",InstrumentedTransport.CREDENTIAL.equals(headers.get("X-Device-Credential")));
                    assertTrue("Original device pin only, never logged",f.originalVault.deviceId.equals(headers.get("X-Device-Id")));
                    assertTrue("Original authorization pin only, never logged",("Device "+InstrumentedTransport.CREDENTIAL).equals(headers.get("Authorization")));
                    assertTrue("Same original credential header",headers.get("X-Device-Credential").equals(headers.get("X-Memphis-Device-Credential")));
                    assertTrue("Original HMAC is observed, not signed by this test",headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                    JSONObject actual=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);
                    assertTrue("Actual owning first WRITE schema","custodial.original-native-private-custody-write.v1".equals(actual.getString("schema")));
                    for(String name:new String[] {"operation_id","original_generation_id","principal_digest","engine_revision",
                        "original_frozen_work_sha256","frame_sha256","record_sha256","frame_bytes"})
                        assertTrue("Actual WRITE must bind the retained original",local.get(name).toString().equals(actual.getString(name)));
                    assertTrue("First original piece index","0".equals(actual.getString("chunk_index")));
                    assertTrue("Actual original request ID binds this WRITE",actual.getString("attempt_id").equals(headers.get("X-Memphis-Native-Request-Id")));

                    // Observe fixed committed paths + absence of pending aliases,
                    // without decoding/rebuilding private encrypted metadata.
                    // The owning sender has already authenticated both records.
                    initialBootstrapMode(exchangeDirectory,0700,true);
                    assertEquals(firstExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                    directories.put(exchangeDirectory,java.nio.file.Files.readAttributes(exchangeDirectory,
                        java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    for(String name:firstExchangeNames) {
                        var file=exchangeDirectory.resolve(name);
                        firstCustodyLostSnapshot(file,exchangeMaximum,originals,identities);
                        if(!name.equals("exchange.lock"))assertTrue("Actual committed ciphertext must be nonempty",originals.get(file).length>=64);
                        else assertEquals(0,originals.get(file).length);
                    }
                    firstCustodyLostSameFiles(originals,identities);
                    assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                    f.provenance.requireCurrent();control.check();
                } catch(Exception failure) {
                    observationFailure.set(failure);throw new java.io.IOException("UNIT_first_response_observation_failed",failure);
                } finally {java.util.Arrays.fill(body,(byte)0);}
                lostIssued.set(true);throw lost; // ONE preallocated lost response; no HTTP result supplied.
            }
            @Override public void disconnect() {disconnects.incrementAndGet();}
            @Override public boolean usingProxy() {return false;}
            @Override public void connect() {throw new AssertionError("UNIT seam must never open a socket");}
            @Override public String getCipherSuite() {throw new AssertionError("No UNIT TLS claim");}
            @Override public java.security.cert.Certificate[] getLocalCertificates() {throw new AssertionError("No UNIT TLS claim");}
            @Override public java.security.cert.Certificate[] getServerCertificates() {throw new AssertionError("No UNIT TLS claim");}
            @Override public java.io.InputStream getInputStream() {throw new AssertionError("No response may be fabricated");}
            @Override public java.io.InputStream getErrorStream() {throw new AssertionError("No response may be fabricated");}
            @Override public java.util.Map<String,java.util.List<String>> getHeaderFields() {throw new AssertionError("No response headers may be fabricated");}
            void wipe() {sent.wipe();headers.clear();}
        }
        var used=new AtomicReference<LostFirstConnection>();
        Throwable primary=null;
        try {
            requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
            try(var baselineControl=new NativePrivateCustodyFrameReadControl()) {
                AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
                baselineControl.check();
            }
            JSONObject local;
            try(var retentionControl=new NativePrivateCustodyFrameReadControl()) {
                local=AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,retentionControl);
                retentionControl.check();
            }
            assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY",local.getString("state"));
            assertTrue(local.getBoolean("local_operation_committed_observed"));assertInitialRetentionNoEffects(local);
            var epochDirectory=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var capsuleDirectory=f.root.toPath().resolve(NativePrivateCapsuleFileStore.DIRECTORY);
            var operationDirectory=f.root.toPath().resolve(NativePrivateCustodyOperationStore.DIRECTORY);
            assertEquals(java.util.Set.of(NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT,
                NativePrivateMutationEpochStore.LOCK),initialBootstrapChildNames(epochDirectory));
            assertEquals(java.util.Set.of(NativePrivateCapsuleFileStore.COMMITTED,NativePrivateCapsuleFileStore.LOCK),initialBootstrapChildNames(capsuleDirectory));
            assertEquals(java.util.Set.of(NativePrivateCustodyOperationStore.COMMITTED,NativePrivateCustodyOperationStore.LOCK),initialBootstrapChildNames(operationDirectory));
            for(var directory:java.util.List.of(epochDirectory,capsuleDirectory,operationDirectory)) {
                initialBootstrapMode(directory,0700,true);
                directories.put(directory,java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS));
                originalDirectoryChildren.put(directory,initialBootstrapChildNames(directory));
                for(String name:initialBootstrapChildNames(directory))firstCustodyLostSnapshot(directory.resolve(name),
                    NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES,originals,identities);
            }
            assertTrue(java.nio.file.Files.notExists(exchangeDirectory,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
            try(var dispatchControl=new NativePrivateCustodyFrameReadControl()) {
                var http=new NativePrivateCustodyHttp(url->{
                    assertEquals("Exactly one original connection",1,opens.incrementAndGet());
                    assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                    assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                    var connection=new LostFirstConnection(url,local,dispatchControl);used.set(connection);return connection;
                },System::currentTimeMillis);
                try(var unexpected=AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,http,dispatchControl)) {
                    fail("Lost first response must not return a current frame or acceptance");
                } catch(VaultFailure failure) {
                    if(observationFailure.get()!=null)failure.addSuppressed(observationFailure.get());
                    // The current sender sanitizes IOException to this code.
                    // Code alone is NOT proof: require our exact throw boundary,
                    // one body/response and no hidden earlier/cleanup failure.
                    if(!lostIssued.get()||opens.get()!=1||used.get()==null||used.get().replies.get()!=1
                        ||!"custodial_private_custody_transport_outcome_unknown".equals(failure.code)
                        ||failure.getSuppressed().length!=0)throw failure;
                }
            }
            assertTrue(lostIssued.get());assertEquals(1,opens.get());
            assertEquals(1,used.get().outputRequests);assertEquals(1,used.get().replies.get());assertEquals(1,used.get().disconnects.get());
            assertEquals(firstExchangeNames,initialBootstrapChildNames(exchangeDirectory));
            firstCustodyLostSameFiles(originals,identities);
            if(firstQuery) {
                var queryOpens=new java.util.concurrent.atomic.AtomicInteger();
                var queryLostIssued=new java.util.concurrent.atomic.AtomicBoolean();
                var queryObservationFailure=new AtomicReference<Exception>();
                var queryLost=new java.net.SocketTimeoutException("UNIT_first_original_QUERY_response_lost");
                var originalWrite=used.get();
                var queryExchangeNames=java.util.Set.of("exchange.lock","write-0.bin","write_unknown-0.bin",
                    "query-0.bin","query_unknown-0.bin");
                class LostQueryConnection extends LostFirstConnection {
                    LostQueryConnection(java.net.URL url,JSONObject local,NativePrivateCustodyFrameReadControl control) {
                        super(url,local,control);
                    }
                    @Override public int getResponseCode() throws java.io.IOException {
                        assertEquals("Only the FIRST QUERY response boundary may be reached",1,replies.incrementAndGet());
                        byte[] body=sent.toByteArray(),writeBody=originalWrite.sent.toByteArray(),transcript=null;
                        try {
                            control.check();assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                            assertTrue("Original QUERY body must be closed before the lost reply",sent.closed);
                            assertTrue(body.length>0&&body.length<=NativeRetainedAttempt.MAX_BODY);
                            assertEquals(body.length,fixedContentLength);assertEquals("POST",getRequestMethod());
                            assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                            assertTrue(getConnectTimeout()>0);assertTrue(getReadTimeout()>0);
                            assertEquals("No header or credential pin may be dropped",originalWrite.headers.keySet(),headers.keySet());
                            for(String name:originalWrite.headers.keySet()) {
                                if(!java.util.Set.of("X-Memphis-Native-Request-Id","X-Memphis-Native-Request-Timestamp",
                                    "X-Memphis-Native-Request-Attestation").contains(name))
                                    assertTrue("Same original native/HTTP header pin",originalWrite.headers.get(name).equals(headers.get(name)));
                            }
                            for(String name:new String[]{"X-Memphis-Native-Request-Id","X-Memphis-Native-Request-Timestamp",
                                "X-Memphis-Native-Request-Attestation"})
                                assertTrue("Missing actual QUERY native request pin",headers.get(name)!=null&&!headers.get(name).isEmpty());
                            assertTrue("Engine owns QUERY request attestation",headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                            JSONObject write=ProviderWireJson.object(writeBody,NativeRetainedAttempt.MAX_BODY);
                            JSONObject actual=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);
                            assertTrue("This is the first original QUERY, never WRITE replay/current-read",
                                "custodial.original-native-private-custody-query.v1".equals(actual.getString("schema")));
                            var expectedKeys=new java.util.TreeSet<String>();
                            for(var keys=write.keys();keys.hasNext();) {
                                String key=keys.next();expectedKeys.add(key);
                                if(!java.util.Set.of("schema","chunk_base64","purpose_binding_sha256","purpose_attestation").contains(key))
                                    assertTrue("QUERY retains each actual WRITE original field",write.getString(key).equals(actual.getString(key)));
                            }
                            expectedKeys.remove("chunk_base64");
                            expectedKeys.addAll(java.util.List.of("target_native_request_id","target_request_body_sha256",
                                "target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"));
                            var actualKeys=new java.util.TreeSet<String>();for(var keys=actual.keys();keys.hasNext();)actualKeys.add(keys.next());
                            assertEquals("Exact original QUERY body shape",expectedKeys,actualKeys);
                            assertTrue("QUERY uses the originally planned read ID",write.getString("read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                            assertFalse("QUERY cannot resend the WRITE attempt",headers.get("X-Memphis-Native-Request-Id").equals(originalWrite.headers.get("X-Memphis-Native-Request-Id")));
                            assertTrue(actual.getString("purpose_binding_sha256").matches("[a-f0-9]{64}"));
                            assertTrue(actual.getString("purpose_attestation").matches("[a-f0-9]{64}"));
                            assertTrue("Actual original WRITE target ID",originalWrite.headers.get("X-Memphis-Native-Request-Id").equals(actual.getString("target_native_request_id")));
                            String writeBodySha=NativeRetainedAttempt.hash(writeBody);
                            assertTrue("Actual original WRITE body target",writeBodySha.equals(actual.getString("target_request_body_sha256")));
                            // DATA-only digest of the already emitted original
                            // request transcript. No signature/key is generated.
                            transcript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION)
                                .put(new JSONObject(f.originalPrincipal).getString("credential_id"))
                                .put(originalWrite.headers.get("X-Device-Id")).put("POST")
                                .put(VaultEngine.NativePrivateCustodyPreparedExchange.PATH).put(writeBodySha)
                                .put(originalWrite.headers.get("X-Memphis-Native-Request-Id"))
                                .put(originalWrite.headers.get("X-Memphis-Native-Request-Timestamp"))
                                .put(originalWrite.headers.get("X-Memphis-Native-Request-Attestation"))
                                .toString().getBytes(StandardCharsets.UTF_8);
                            assertTrue("Actual original WRITE attestation target",NativeRetainedAttempt.hash(transcript).equals(actual.getString("target_attestation_digest")));
                            firstCustodyLostSameFiles(originals,identities);
                            assertTrue("Actual original prepared ciphertext target",NativeRetainedAttempt.hash(originals.get(exchangeDirectory.resolve("write-0.bin")))
                                .equals(actual.getString("target_prepared_record_sha256")));
                            assertTrue("Actual original durable UNKNOWN target",NativeRetainedAttempt.hash(originals.get(exchangeDirectory.resolve("write_unknown-0.bin")))
                                .equals(actual.getString("target_unknown_record_sha256")));
                            initialBootstrapMode(exchangeDirectory,0700,true);
                            assertEquals(queryExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                            // The owning native sender has authenticated and
                            // committed both QUERY records BEFORE opening HTTP.
                            // Observe those actual ciphertexts, never seed them.
                            for(String name:java.util.List.of("query-0.bin","query_unknown-0.bin")) {
                                var file=exchangeDirectory.resolve(name);
                                firstCustodyLostSnapshot(file,exchangeMaximum,originals,identities);
                                assertTrue("Actual QUERY ciphertext is nonempty",originals.get(file).length>=64);
                            }
                            retainedExchangeNames.addAll(queryExchangeNames);
                            firstCustodyLostSameFiles(originals,identities);
                            assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                            f.provenance.requireCurrent();control.check();
                        } catch(Exception failure) {
                            queryObservationFailure.set(failure);throw new java.io.IOException("UNIT_QUERY_response_observation_failed",failure);
                        } finally {
                            java.util.Arrays.fill(body,(byte)0);java.util.Arrays.fill(writeBody,(byte)0);
                            if(transcript!=null)java.util.Arrays.fill(transcript,(byte)0);
                        }
                        queryLostIssued.set(true);throw queryLost;
                    }
                }
                var queryUsed=new AtomicReference<LostQueryConnection>();
                boolean queryExpiredBeforeHttp=false;
                VaultFailure queryDeadlineFailure=null;
                try {
                    // Separate explicit saved-original invocation, with its
                    // own unchanged finite control. Existing WRITE_UNKNOWN
                    // skips WRITE transport; only the FIRST QUERY may open.
                    try(var queryControl=new NativePrivateCustodyFrameReadControl()) {
                        long queryControlConstructedAfter=currentRead?System.nanoTime():0L;
                        var http=new NativePrivateCustodyHttp(url->{
                            assertEquals("Exactly one first QUERY connection",1,queryOpens.incrementAndGet());
                            assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                            assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                            var connection=new LostQueryConnection(url,local,queryControl);queryUsed.set(connection);return connection;
                        },System::currentTimeMillis);
                        try(var unexpected=AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                            f.principalJournal,f.legacy,f.providerCoordinator,http,queryControl)) {
                            fail("Lost FIRST QUERY must not return a current frame or acceptance");
                        } catch(VaultFailure failure) {
                            if(queryObservationFailure.get()!=null)failure.addSuppressed(queryObservationFailure.get());
                            if(currentRead&&queryOpens.get()==0&&!queryLostIssued.get()) {
                                try {
                                    assertNull(queryUsed.get());assertNull(queryObservationFailure.get());
                                    assertFalse(Thread.currentThread().isInterrupted());
                                    assertTrue("The actual original control deadline must have elapsed",
                                        System.nanoTime()-queryControlConstructedAfter>=180_000_000_000L);
                                    assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                                    assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);
                                    var origin=failure.getStackTrace();assertTrue(origin.length>=3);
                                    assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),origin[0].getClassName());
                                    assertEquals("failure",origin[0].getMethodName());
                                    assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),origin[1].getClassName());
                                    assertEquals("check",origin[1].getMethodName());
                                    assertEquals(VaultEngine.class.getName(),origin[2].getClassName());
                                    assertEquals("sendOriginalPrivateCustodyExchangeOwned",origin[2].getMethodName());
                                    boolean firstQueryOwner=false;
                                    for(var frame:origin)if(VaultEngine.class.getName().equals(frame.getClassName())
                                        &&"retainSavedOriginalPrivateCustodyFrame".equals(frame.getMethodName()))firstQueryOwner=true;
                                    assertTrue(firstQueryOwner);
                                    // SAME still-open control, before normal
                                    // close; no renewal or second QUERY call.
                                    VaultFailure withdrawn=assertThrows(VaultFailure.class,queryControl::check);
                                    assertEquals(failure.code,withdrawn.code);assertNull(withdrawn.getCause());
                                    assertEquals(0,withdrawn.getSuppressed().length);
                                    firstCustodyLostSameFiles(originals,identities);
                                    initialBootstrapMode(exchangeDirectory,0700,true);
                                    assertEquals(queryExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                                    for(String name:java.util.List.of("query-0.bin","query_unknown-0.bin")) {
                                        var file=exchangeDirectory.resolve(name);
                                        firstCustodyLostSnapshot(file,exchangeMaximum,originals,identities);
                                        assertTrue("Native-created QUERY ciphertext must be nonempty",originals.get(file).length>=64);
                                    }
                                    retainedExchangeNames.addAll(queryExchangeNames);
                                    firstCustodyLostSameFiles(originals,identities);
                                    f.provenance.requireCurrent();
                                    assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                                    assertEquals(f.aliases,initialBootstrapAliases());
                                    failure.addSuppressed(withdrawn);queryDeadlineFailure=failure;queryExpiredBeforeHttp=true;
                                } catch(Exception|Error evidence) {if(evidence!=failure)failure.addSuppressed(evidence);throw failure;}
                            } else {
                            if(!queryLostIssued.get()||queryOpens.get()!=1||queryUsed.get()==null||queryUsed.get().replies.get()!=1
                                ||!"custodial_private_custody_transport_outcome_unknown".equals(failure.code)
                                ||failure.getCause()!=null||failure.getSuppressed().length!=0)throw failure;
                            // The current HTTP sender sanitizes this exact IO
                            // boundary. A later control/owner failure with the
                            // same code cannot stand in for the lost QUERY.
                            var origin=failure.getStackTrace();
                            if(origin.length<2||!NativePrivateCustodyHttp.class.getName().equals(origin[0].getClassName())
                                ||!"unknown".equals(origin[0].getMethodName())
                                ||!NativePrivateCustodyHttp.class.getName().equals(origin[1].getClassName())
                                ||!"sendOwned".equals(origin[1].getMethodName()))throw failure;
                            }
                        }
                    }
                    if(!queryExpiredBeforeHttp) {
                    assertTrue(queryLostIssued.get());assertEquals(1,queryOpens.get());
                    assertEquals(1,queryUsed.get().outputRequests);assertEquals(1,queryUsed.get().replies.get());assertEquals(1,queryUsed.get().disconnects.get());
                    assertEquals("Only the original WRITE plus its FIRST QUERY",2,opens.get()+queryOpens.get());
                    assertEquals(1,used.get().outputRequests);assertEquals(1,used.get().replies.get());assertEquals(1,used.get().disconnects.get());
                    } else {
                        assertTrue(currentRead);assertEquals(0,queryOpens.get());assertNull(queryUsed.get());assertFalse(queryLostIssued.get());
                    }
                    assertEquals(queryExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                    firstCustodyLostSameFiles(originals,identities);
                    if(currentRead) {
                        final boolean queryWasSent=!queryExpiredBeforeHttp;
                        System.out.println(queryWasSent?"UNIT_CURRENT_READ_PREREQUISITE=QUERY_HTTP_RESPONSE_LOST"
                            :"UNIT_CURRENT_READ_PREREQUISITE=QUERY_PRE_HTTP_CONTROL_EXPIRED_NOT_SENT; exact_ciphertext_observed");
                        var currentOpens=new java.util.concurrent.atomic.AtomicInteger();
                        var currentLostIssued=new java.util.concurrent.atomic.AtomicBoolean();
                        var currentObservationFailure=new AtomicReference<Exception>();
                        var currentLost=new java.net.SocketTimeoutException("UNIT_current_original_QUERY_read_response_lost");
                        var originalQuery=queryUsed.get();
                        byte[] issuedQueryBody=queryWasSent?originalQuery.sent.toByteArray():null;
                        byte[] originalWriteBody=originalWrite.sent.toByteArray();
                        try {
                            // The shipping read preflights ALL original QUERY
                            // slots before HTTP. This arrangement issued only
                            // chunk0; a larger actual original remains unmet.
                            var issued=ProviderWireJson.object(originalWriteBody,NativeRetainedAttempt.MAX_BODY);
                            assertTrue("Current-read prerequisite: the actual original has one issued chunk",
                                "1".equals(issued.getString("chunk_count"))&&"0".equals(issued.getString("chunk_index")));
                            firstCustodyLostSameFiles(originals,identities);
                            var readDirectoryWitnesses=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
                            var readDirectoryChildren=new java.util.HashMap<java.nio.file.Path,java.util.Set<String>>();
                            var readDirectories=new java.util.ArrayList<java.nio.file.Path>(directories.keySet());readDirectories.add(f.root.toPath());
                            for(var directory:readDirectories) {
                                var attributes=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                assertTrue(attributes.isDirectory());assertFalse(attributes.isSymbolicLink());assertNotNull(attributes.fileKey());
                                readDirectoryWitnesses.put(directory,attributes);readDirectoryChildren.put(directory,initialBootstrapChildNames(directory));
                            }
                            var rootBeforeRead=android.system.Os.lstat(f.root.getAbsolutePath());
                            f.provenance.requireCurrent();assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                            assertEquals(f.aliases,initialBootstrapAliases());
                            class LostCurrentReadConnection extends LostFirstConnection {
                                LostCurrentReadConnection(java.net.URL url,JSONObject local,NativePrivateCustodyFrameReadControl control) {
                                    super(url,local,control);
                                }
                                void requireReadOnlyOriginals() throws Exception {
                                    firstCustodyLostSameFiles(originals,identities);
                                    assertEquals(queryExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                                    for(var directory:readDirectoryWitnesses.keySet()) {
                                        var before=readDirectoryWitnesses.get(directory);
                                        var now=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                                            java.nio.file.LinkOption.NOFOLLOW_LINKS);
                                        assertTrue(now.isDirectory());assertFalse(now.isSymbolicLink());
                                        assertEquals(before.fileKey(),now.fileKey());assertEquals(before.owner(),now.owner());
                                        assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                                        assertEquals(before.size(),now.size());assertEquals(before.lastModifiedTime(),now.lastModifiedTime());
                                        assertEquals(readDirectoryChildren.get(directory),initialBootstrapChildNames(directory));
                                    }
                                    var rootNow=android.system.Os.lstat(f.root.getAbsolutePath());
                                    assertEquals(rootBeforeRead.st_mode,rootNow.st_mode);assertEquals(rootBeforeRead.st_uid,rootNow.st_uid);
                                    assertEquals(rootBeforeRead.st_gid,rootNow.st_gid);assertEquals(rootBeforeRead.st_dev,rootNow.st_dev);
                                    assertEquals(rootBeforeRead.st_ino,rootNow.st_ino);f.provenance.requireCurrent();
                                    assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                                    assertEquals(f.aliases,initialBootstrapAliases());
                                }
                                @Override public int getResponseCode() throws java.io.IOException {
                                    assertEquals("Only the FIRST current-read response boundary may be reached",1,replies.incrementAndGet());
                                    byte[] body=sent.toByteArray(),archived=null,writeTranscript=null;
                                    try {
                                        control.check();assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                                        assertTrue("Current-read body must be completely written/closed",sent.closed);
                                        assertTrue(body.length>0&&body.length<=NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
                                        assertEquals(body.length,fixedContentLength);assertEquals("POST",getRequestMethod());
                                        assertFalse(getInstanceFollowRedirects());assertFalse(getUseCaches());
                                        assertTrue(getConnectTimeout()>0);assertTrue(getReadTimeout()>0);
                                        var originalPins=queryWasSent?originalQuery.headers:originalWrite.headers;
                                        assertEquals("Same original native/HTTP header set",originalPins.keySet(),headers.keySet());
                                        for(String name:originalPins.keySet()) {
                                            if(!java.util.Set.of("X-Memphis-Native-Request-Id","X-Memphis-Native-Request-Timestamp","X-Memphis-Native-Request-Attestation").contains(name))
                                                assertTrue("Current read preserves original device/credential/version pins",originalPins.get(name).equals(headers.get(name)));
                                        }
                                        assertTrue("Current outer request uses SAME original read_query_id",
                                            issued.getString("read_query_id").equals(headers.get("X-Memphis-Native-Request-Id")));
                                        assertTrue(headers.get("X-Memphis-Native-Request-Timestamp")!=null&&!headers.get("X-Memphis-Native-Request-Timestamp").isEmpty());
                                        assertTrue(headers.get("X-Memphis-Native-Request-Attestation")!=null
                                            &&headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                                        // Outer signing is owned by the Engine.
                                        // No inner/outer time inequality is assumed.
                                        var envelope=ProviderWireJson.object(body,NativePrivateCustodyCurrentQueryEnvelope.MAX_ENVELOPE);
                                        var keys=new java.util.TreeSet<String>();
                                        for(var names=envelope.keys();names.hasNext();) {
                                            String name=names.next();keys.add(name);assertTrue(envelope.get(name) instanceof String);
                                        }
                                        assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp",
                                            "original_query_http_attestation","original_query_unknown_record_sha256"),keys);
                                        assertTrue("Exact fixed current-read envelope schema",
                                            "custodial.original-private-custody-current-query.v1".equals(envelope.getString("schema")));
                                        archived=java.util.Base64.getDecoder().decode(envelope.getString("original_query_body_base64"));
                                        var archivedQuery=ProviderWireJson.object(archived,NativeRetainedAttempt.MAX_BODY);
                                        assertTrue("Authenticated producer exposes the archived original QUERY",
                                            "custodial.original-native-private-custody-query.v1".equals(archivedQuery.getString("schema")));
                                        var expectedQueryKeys=new java.util.TreeSet<String>();
                                        for(var names=issued.keys();names.hasNext();) {
                                            String name=names.next();expectedQueryKeys.add(name);
                                            if(!java.util.Set.of("schema","chunk_base64","purpose_binding_sha256","purpose_attestation").contains(name))
                                                assertTrue("Archived QUERY shares the actual original WRITE fields",issued.getString(name).equals(archivedQuery.getString(name)));
                                        }
                                        expectedQueryKeys.remove("chunk_base64");
                                        expectedQueryKeys.addAll(java.util.List.of("target_native_request_id","target_request_body_sha256",
                                            "target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"));
                                        var actualQueryKeys=new java.util.TreeSet<String>();
                                        for(var names=archivedQuery.keys();names.hasNext();) {
                                            String name=names.next();actualQueryKeys.add(name);assertTrue(archivedQuery.get(name) instanceof String);
                                        }
                                        assertEquals(expectedQueryKeys,actualQueryKeys);
                                        assertTrue(archivedQuery.getString("purpose_binding_sha256").matches("[a-f0-9]{64}"));
                                        assertTrue(archivedQuery.getString("purpose_attestation").matches("[a-f0-9]{64}"));
                                        assertTrue("Archived QUERY retains the actual WRITE request target",originalWrite.headers.get("X-Memphis-Native-Request-Id")
                                            .equals(archivedQuery.getString("target_native_request_id")));
                                        String writeBodySha=NativeRetainedAttempt.hash(originalWriteBody);
                                        assertTrue(writeBodySha.equals(archivedQuery.getString("target_request_body_sha256")));
                                        writeTranscript=new org.json.JSONArray().put(NativeAttestation.REQUEST_VERSION)
                                            .put(new JSONObject(f.originalPrincipal).getString("credential_id"))
                                            .put(originalWrite.headers.get("X-Device-Id")).put("POST")
                                            .put(VaultEngine.NativePrivateCustodyPreparedExchange.PATH).put(writeBodySha)
                                            .put(originalWrite.headers.get("X-Memphis-Native-Request-Id"))
                                            .put(originalWrite.headers.get("X-Memphis-Native-Request-Timestamp"))
                                            .put(originalWrite.headers.get("X-Memphis-Native-Request-Attestation"))
                                            .toString().getBytes(StandardCharsets.UTF_8);
                                        assertTrue(NativeRetainedAttempt.hash(writeTranscript).equals(archivedQuery.getString("target_attestation_digest")));
                                        assertTrue(NativeRetainedAttempt.hash(originals.get(exchangeDirectory.resolve("write-0.bin")))
                                            .equals(archivedQuery.getString("target_prepared_record_sha256")));
                                        assertTrue(NativeRetainedAttempt.hash(originals.get(exchangeDirectory.resolve("write_unknown-0.bin")))
                                            .equals(archivedQuery.getString("target_unknown_record_sha256")));
                                        String archivedTime=envelope.getString("original_query_timestamp");
                                        String archivedAttestation=envelope.getString("original_query_http_attestation");
                                        assertTrue(archivedTime.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));
                                        assertTrue(archivedTime.equals(VaultTimestamps.fromEpochMillisExact(
                                            VaultTimestamps.epochMillis(archivedTime,NativeRetainedAttempt.FAILURE))));
                                        assertTrue(archivedAttestation.matches("[a-f0-9]{64}"));
                                        if(queryWasSent) {
                                            assertTrue("Exact actual prior QUERY bytes, without JSON reconstruction",java.util.Arrays.equals(issuedQueryBody,archived));
                                            assertTrue("Exact historical QUERY native timestamp",originalQuery.headers.get("X-Memphis-Native-Request-Timestamp").equals(archivedTime));
                                            assertTrue("Exact historical QUERY HTTP attestation",originalQuery.headers.get("X-Memphis-Native-Request-Attestation").equals(archivedAttestation));
                                            assertTrue(originalQuery.headers.get("X-Memphis-Native-Request-Id").equals(headers.get("X-Memphis-Native-Request-Id")));
                                        } // Otherwise these are first exposed by
                                        // the normal authenticated current-read
                                        // producer, not a nonexistent prior send.
                                        assertTrue("Actual original encrypted QUERY_UNKNOWN disk hash",
                                            NativeRetainedAttempt.hash(originals.get(exchangeDirectory.resolve("query_unknown-0.bin")))
                                                .equals(envelope.getString("original_query_unknown_record_sha256")));
                                        requireReadOnlyOriginals();control.check();
                                    } catch(Exception failure) {
                                        currentObservationFailure.set(failure);throw new java.io.IOException("UNIT_current_read_response_observation_failed",failure);
                                    } finally {
                                        java.util.Arrays.fill(body,(byte)0);if(archived!=null)java.util.Arrays.fill(archived,(byte)0);
                                        if(writeTranscript!=null)java.util.Arrays.fill(writeTranscript,(byte)0);
                                    }
                                    currentLostIssued.set(true);throw currentLost;
                                }
                            }
                            var currentUsed=new AtomicReference<LostCurrentReadConnection>();
                            try {
                                try(var currentControl=new NativePrivateCustodyFrameReadControl()) {
                                    var http=new NativePrivateCustodyHttp(url->{
                                        assertEquals("Exactly one current-read connection",1,currentOpens.incrementAndGet());
                                        assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,url.toString());
                                        assertFalse(Thread.holdsLock(f.engine));assertFalse(Thread.holdsLock(f.providerCoordinator));
                                        var connection=new LostCurrentReadConnection(url,local,currentControl);currentUsed.set(connection);return connection;
                                    },System::currentTimeMillis);
                                    try(var unexpected=AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrame(f.application,f.engine,f.work,
                                        f.principalJournal,f.legacy,f.providerCoordinator,http,currentControl)) {
                                        fail("Lost current read must not return a current frame, acceptance or ACK");
                                    } catch(VaultFailure failure) {
                                        if(currentObservationFailure.get()!=null)failure.addSuppressed(currentObservationFailure.get());
                                        if(!currentLostIssued.get()||currentOpens.get()!=1||currentUsed.get()==null||currentUsed.get().replies.get()!=1
                                            ||!"custodial_private_custody_transport_outcome_unknown".equals(failure.code)
                                            ||failure.getCause()!=null||failure.getSuppressed().length!=0)throw failure;
                                        var origin=failure.getStackTrace();
                                        if(origin.length<2||!NativePrivateCustodyHttp.class.getName().equals(origin[0].getClassName())
                                            ||!"unknown".equals(origin[0].getMethodName())
                                            ||!NativePrivateCustodyHttp.class.getName().equals(origin[1].getClassName())
                                            ||!"sendOwned".equals(origin[1].getMethodName()))throw failure;
                                    }
                                }
                                assertTrue(currentLostIssued.get());assertEquals(1,currentOpens.get());
                                assertEquals(1,currentUsed.get().outputRequests);assertEquals(1,currentUsed.get().replies.get());assertEquals(1,currentUsed.get().disconnects.get());
                                assertEquals("WRITE + current READ, plus QUERY only if it actually opened",queryWasSent?3:2,opens.get()+queryOpens.get()+currentOpens.get());
                                assertEquals(1,used.get().outputRequests);assertEquals(1,used.get().replies.get());assertEquals(1,used.get().disconnects.get());
                                if(queryWasSent) {
                                    assertEquals(1,queryOpens.get());assertEquals(1,queryUsed.get().outputRequests);
                                    assertEquals(1,queryUsed.get().replies.get());assertEquals(1,queryUsed.get().disconnects.get());
                                } else {assertEquals(0,queryOpens.get());assertNull(queryUsed.get());assertFalse(queryLostIssued.get());}
                                currentUsed.get().requireReadOnlyOriginals();
                            } finally {if(currentUsed.get()!=null)currentUsed.get().wipe();}
                        } finally {
                            if(issuedQueryBody!=null)java.util.Arrays.fill(issuedQueryBody,(byte)0);
                            java.util.Arrays.fill(originalWriteBody,(byte)0);
                        }
                    }
                } catch(Exception|Error failure) {
                    if(queryDeadlineFailure!=null&&failure!=queryDeadlineFailure)failure.addSuppressed(queryDeadlineFailure);
                    throw failure;
                } finally {if(queryUsed.get()!=null)queryUsed.get().wipe();}
                // No third invocation or current-read/QUERY retry after this
                // durable ambiguous response. Both original UNKNOWNs remain.
            }
            if(resumePendingExchange) {
                pendingArrangementStarted=true;
                // REAL Engine produced both encrypted records above. Moving
                // them models an interrupted old publication; it does not
                // construct a positive owner, record, signature or token.
                for(String name:java.util.List.of("write-0","write_unknown-0")) {
                    var committed=exchangeDirectory.resolve(name+".bin");
                    var pending=exchangeDirectory.resolve(name+".pending");
                    assertTrue(java.nio.file.Files.notExists(pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    java.nio.file.Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                    originals.put(pending,originals.remove(committed));identities.put(pending,identities.remove(committed));
                    retainedExchangeNames.remove(name+".bin");retainedExchangeNames.add(name+".pending");
                    assertTrue(java.nio.file.Files.notExists(committed,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    firstCustodyLostSameFiles(originals,identities);
                }
                assertEquals(retainedExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                VaultFailure firstExpiry=null;
                try {
                    JSONObject resumed=null;int expectedRecovered=2;
                    try(var resumeControl=new NativePrivateCustodyFrameReadControl()) {
                        // Constructor's private fixed deadline is no later than
                        // this observation + 180s. No clock/control is replaced.
                        long constructedAfter=System.nanoTime();
                        try {
                            resumed=AndroidPrivateCustodyOwnerRecovery.resumeSavedOriginalPieceJournals(
                                f.application,f.engine,f.work,f.principalJournal,f.legacy,f.providerCoordinator,resumeControl);
                            resumeControl.check();
                        } catch(VaultFailure failure) {
                            try {
                                assertFalse("Thread interruption is not this explicit local deadline case",Thread.currentThread().isInterrupted());
                                assertTrue("Actual original 180s deadline must have elapsed",System.nanoTime()-constructedAfter>=180_000_000_000L);
                                assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                                assertNull(failure.getCause());assertEquals(0,failure.getSuppressed().length);
                                var trace=failure.getStackTrace();assertTrue(trace.length>=2);
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[0].getClassName());assertEquals("failure",trace[0].getMethodName());
                                assertEquals(NativePrivateCustodyFrameReadControl.class.getName(),trace[1].getClassName());assertEquals("check",trace[1].getMethodName());
                                // Check the SAME still-open original control,
                                // before its normal close can itself withdraw it.
                                VaultFailure withdrawn=assertThrows(VaultFailure.class,resumeControl::check);
                                assertEquals(failure.code,withdrawn.code);assertNull(withdrawn.getCause());assertEquals(0,withdrawn.getSuppressed().length);
                                failure.addSuppressed(withdrawn);firstExpiry=failure;resumed=null;
                            } catch(Exception|Error evidence) {if(evidence!=failure)failure.addSuppressed(evidence);throw failure;}
                        }
                    }
                    int pendingOriginals=firstCustodyLostFollowExchangePublication(exchangeDirectory,directories.get(exchangeDirectory),
                        originals,identities,retainedExchangeNames);
                    firstCustodyLostSameFiles(originals,identities);
                    if(firstExpiry!=null) {
                        // Retained DATA and withdrawn scope are not completion.
                        // Log only this verified fixed control error/stack, not
                        // original bytes, IDs, paths, credentials or metadata.
                        System.out.println("UNIT_LOCAL_PENDING_RESUME_PARTIAL_ORIGINAL_CONTROL_EXPIRED; exact originals observed; not Activity/readmission/ACK");
                        firstExpiry.printStackTrace(System.out);
                        for(var directory:directories.keySet()) {
                            initialBootstrapMode(directory,0700,true);
                            var before=directories.get(directory);
                            var now=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            assertEquals(before.fileKey(),now.fileKey());assertEquals(before.owner(),now.owner());
                            assertEquals(before.group(),now.group());assertEquals(before.permissions(),now.permissions());
                            if(originalDirectoryChildren.containsKey(directory))assertEquals(originalDirectoryChildren.get(directory),initialBootstrapChildNames(directory));
                        }
                        f.provenance.requireCurrent();assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                        assertEquals(f.aliases,initialBootstrapAliases());assertFalse(Thread.currentThread().isInterrupted());
                        expectedRecovered=pendingOriginals;
                        // A distinct explicit LOCAL invocation reconstructs its
                        // own current saved owner. No rearm/reset of the expired
                        // scope, old request, transport, keys or Activity admission.
                        try(var continuationControl=new NativePrivateCustodyFrameReadControl()) {
                            resumed=AndroidPrivateCustodyOwnerRecovery.resumeSavedOriginalPieceJournals(
                                f.application,f.engine,f.work,f.principalJournal,f.legacy,f.providerCoordinator,continuationControl);
                            continuationControl.check();
                        }
                    }
                    assertNotNull("PARTIAL is not a successful local completion",resumed);
                    assertEquals("custodial.native-saved-original-piece-journal-resume.v2",resumed.getString("schema"));
                    assertEquals(14,resumed.length());
                    assertEquals("EXISTING_ORIGINAL_PIECE_JOURNALS_LOCALLY_RECOVERED_NO_TRANSPORT_OR_ACK",resumed.getString("state"));
                    assertEquals(2,resumed.getInt("existing_records_observed"));
                    assertEquals(expectedRecovered,resumed.getInt("pending_or_alias_records_recovered"));
                    for(String key:new String[]{"missing_records_created","network_dispatch_allowed",
                        "remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted",
                        "resend_allowed","finalizer_allowed","key_removal","phone_released"})
                        assertFalse("Local recovery never creates effect authority",resumed.getBoolean(key));
                    assertEquals(0,firstCustodyLostFollowExchangePublication(exchangeDirectory,directories.get(exchangeDirectory),
                        originals,identities,retainedExchangeNames));
                    firstCustodyLostSameFiles(originals,identities);
                    assertEquals(firstExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                    assertEquals(1,opens.get());assertEquals(1,used.get().outputRequests);
                    assertEquals(1,used.get().replies.get());assertEquals(1,used.get().disconnects.get());
                } catch(Exception|Error failure) {
                    if(firstExpiry!=null&&failure!=firstExpiry){firstExpiry.addSuppressed(failure);throw firstExpiry;}
                    throw failure;
                }
            }
            // No second transport, QUERY, HTTP readback or marker cleanup.
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                if(resumePendingExchange&&pendingArrangementStarted)
                    firstCustodyLostFollowExchangePublication(exchangeDirectory,directories.get(exchangeDirectory),originals,identities,retainedExchangeNames);
                firstCustodyLostSameFiles(originals,identities);
                for(var directory:directories.keySet()) {
                    initialBootstrapMode(directory,0700,true);
                    var before=directories.get(directory);
                    var after=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,
                        java.nio.file.LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());assertEquals(before.owner(),after.owner());
                    assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
                    if(originalDirectoryChildren.containsKey(directory))assertEquals(originalDirectoryChildren.get(directory),initialBootstrapChildNames(directory));
                }
                if(lostIssued.get()) {
                    assertEquals(retainedExchangeNames,initialBootstrapChildNames(exchangeDirectory));
                    var expectedRoot=new java.util.TreeSet<>(f.originalRootChildren);
                    expectedRoot.addAll(java.util.List.of(NativePrivateMutationEpochStore.DIRECTORY,NativePrivateCapsuleFileStore.DIRECTORY,
                        NativePrivateCustodyOperationStore.DIRECTORY,VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY));
                    assertEquals(expectedRoot,initialBootstrapChildNames(f.root.toPath()));
                } // An earlier failure keeps its actual partial files, not a fabricated steady state.
                for(String name:new String[] {NativeOriginalInventoryAckIntentJournal.DIRECTORY,NativeOriginalInventoryAckRequestJournal.DIRECTORY,
                    NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue("No ACK/finalizer artifacts",java.nio.file.Files.notExists(f.root.toPath().resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var rootAfter=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,rootAfter.st_mode);assertEquals(f.rootBefore.st_uid,rootAfter.st_uid);assertEquals(f.rootBefore.st_gid,rootAfter.st_gid);
                assertEquals(f.rootBefore.st_dev,rootAfter.st_dev);assertEquals(f.rootBefore.st_ino,rootAfter.st_ino);f.provenance.requireCurrent();
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.originalVault.secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {
                if(used.get()!=null)used.get().wipe();
                for(byte[] bytes:originals.values())java.util.Arrays.fill(bytes,(byte)0);
            }
            // All keys/originals/partial journal/UNKNOWN files remain untouched.
        }
    }

    /** Follow only these two original inodes monotonically PENDING -> COMMITTED.
     * This is raw retained DATA, never an authenticated completion/result. All
     * comparisons use the OLD witnesses; observed contents never become expected. */
    private static int firstCustodyLostFollowExchangePublication(java.nio.file.Path directory,
        java.nio.file.attribute.PosixFileAttributes directoryIdentity,
        java.util.Map<java.nio.file.Path,byte[]> originals,
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities,
        java.util.Set<String> retainedNames) throws Exception {
        initialBootstrapMode(directory,0700,true);assertNotNull(directoryIdentity);
        var before=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertEquals(directoryIdentity.fileKey(),before.fileKey());assertEquals(directoryIdentity.owner(),before.owner());
        assertEquals(directoryIdentity.group(),before.group());assertEquals(directoryIdentity.permissions(),before.permissions());
        var observedNames=new java.util.TreeSet<String>();observedNames.add("exchange.lock");
        var selected=new java.util.HashMap<java.nio.file.Path,java.nio.file.Path>();int pendingOriginals=0;
        for(String name:java.util.List.of("write-0","write_unknown-0")) {
            var pending=directory.resolve(name+".pending");var committed=directory.resolve(name+".bin");
            assertTrue("Exactly one OLD original witness must be retained",originals.containsKey(pending)^originals.containsKey(committed));
            var expected=originals.containsKey(pending)?pending:committed;
            assertNotNull(identities.get(expected));
            java.nio.file.attribute.PosixFileAttributes pendingAttributes=null,committedAttributes=null;
            try{pendingAttributes=java.nio.file.Files.readAttributes(pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);}
            catch(java.nio.file.NoSuchFileException absent){/* Fixed slot absent only; other errors propagate. */}
            try{committedAttributes=java.nio.file.Files.readAttributes(committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);}
            catch(java.nio.file.NoSuchFileException absent){/* An empty/foreign target is not absence or adoption authority. */}
            assertTrue("Original must exist at exactly one fixed name; unknown twins remain a failure",(pendingAttributes==null)^(committedAttributes==null));
            if(expected.equals(committed))assertNull("An observed committed original must not regress",pendingAttributes);
            var actual=pendingAttributes!=null?pending:committed;
            var bytes=new java.util.HashMap<java.nio.file.Path,byte[]>();
            var current=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
            try {
                firstCustodyLostSnapshot(actual,originals.get(expected).length,bytes,current);
                assertArrayEquals("Original ciphertext must remain exact across atomic progress",originals.get(expected),bytes.get(actual));
                var original=identities.get(expected);var now=current.get(actual);
                assertEquals(original.fileKey(),now.fileKey());assertEquals(original.size(),now.size());
                assertEquals(original.lastModifiedTime(),now.lastModifiedTime());assertEquals(original.owner(),now.owner());
                assertEquals(original.group(),now.group());assertEquals(original.permissions(),now.permissions());
            } finally {for(byte[] value:bytes.values())java.util.Arrays.fill(value,(byte)0);}
            selected.put(expected,actual);observedNames.add(actual.getFileName().toString());if(actual.equals(pending))pendingOriginals++;
        }
        assertEquals("No surplus, QUERY, replacement or unknown target may be adopted",observedNames,initialBootstrapChildNames(directory));
        var after=java.nio.file.Files.readAttributes(directory,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertEquals(before.fileKey(),after.fileKey());assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());
        assertEquals(before.permissions(),after.permissions());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
        for(var move:selected.entrySet())if(!move.getKey().equals(move.getValue())) {
            // Relabel only OLD expected bytes/identity, never a new observation.
            assertFalse(originals.containsKey(move.getValue()));assertFalse(identities.containsKey(move.getValue()));
            originals.put(move.getValue(),originals.remove(move.getKey()));identities.put(move.getValue(),identities.remove(move.getKey()));
        }
        retainedNames.clear();retainedNames.addAll(observedNames);return pendingOriginals;
    }

    /** Test-local bounded raw observation only; no private codec or recovery. */
    // Test DATA witness only; never a native/browser admission or capability.
    static void firstCustodyLostSnapshot(java.nio.file.Path file,int maximum,
        java.util.Map<java.nio.file.Path,byte[]> bytes,
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities) throws Exception {
        assertFalse(bytes.containsKey(file));initialBootstrapMode(file,0600,false);
        var before=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(before.fileKey());assertTrue(before.size()>=0&&before.size()<=maximum);
        byte[] copied=new byte[(int)before.size()];boolean transferred=false;
        try {
            try(var channel=java.nio.channels.FileChannel.open(file,java.nio.file.StandardOpenOption.READ,java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                assertEquals(before.size(),channel.size());var buffer=java.nio.ByteBuffer.wrap(copied);
                while(buffer.hasRemaining())assertTrue("Bounded original read reached premature EOF",channel.read(buffer)>0);
                assertEquals(-1,channel.read(java.nio.ByteBuffer.allocate(1)));
            }
            var after=java.nio.file.Files.readAttributes(file,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
            assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
            identities.put(file,before);bytes.put(file,copied);transferred=true;
        } finally {if(!transferred)java.util.Arrays.fill(copied,(byte)0);}
    }

    static void firstCustodyLostSameFiles(java.util.Map<java.nio.file.Path,byte[]> originals,
        java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> identities) throws Exception {
        for(var file:originals.keySet()) {
            java.util.Map<java.nio.file.Path,byte[]> now=new java.util.HashMap<>();
            java.util.Map<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes> current=new java.util.HashMap<>();
            try {
                firstCustodyLostSnapshot(file,originals.get(file).length,now,current);
                assertArrayEquals("Retained original ciphertext/metadata changed",originals.get(file),now.get(file));
                var before=identities.get(file);var after=current.get(file);
                assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
                assertEquals(before.owner(),after.owner());assertEquals(before.group(),after.group());assertEquals(before.permissions(),after.permissions());
            } finally {for(byte[] bytes:now.values())java.util.Arrays.fill(bytes,(byte)0);}
        }
    }

    /** Only a disposable crash arrangement of REAL Engine-created ciphertext.
     * No token/counter/approval/record bytes are manufactured or rewritten. */
    @Test(timeout = 420_000)
    public void actualPendingCapsuleAndOperationResumePreservesBothOriginalInodesWithoutDispatch() throws Exception {
        var f=new InitialNativeFixture();
        var root=f.root.toPath();
        var capsule=root.resolve(NativePrivateCapsuleFileStore.DIRECTORY);
        var operation=root.resolve(NativePrivateCustodyOperationStore.DIRECTORY);
        var originals=new java.util.HashMap<java.nio.file.Path,byte[]>();
        var identities=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var originalRecords=new java.util.HashMap<java.nio.file.Path,byte[]>();
        var originalRecordIdentities=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
        var committed=java.util.List.of(capsule.resolve(NativePrivateCapsuleFileStore.COMMITTED),
            operation.resolve(NativePrivateCustodyOperationStore.COMMITTED));
        var pending=java.util.List.of(capsule.resolve(NativePrivateCapsuleFileStore.PENDING),
            operation.resolve(NativePrivateCustodyOperationStore.PENDING));
        Throwable primary=null;
        try {
            requireShellStatusArtifactsAbsent(f.root);f.provenance.requireCurrent();
            try(var baselineControl=new NativePrivateCustodyFrameReadControl()) {
                AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,baselineControl);
                baselineControl.check();
            }
            JSONObject local;
            try(var retentionControl=new NativePrivateCustodyFrameReadControl()) {
                local=AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(f.application,f.engine,f.work,
                    f.principalJournal,f.legacy,f.providerCoordinator,retentionControl);
                retentionControl.check();
            }
            assertInitialRetentionNoEffects(local);
            assertEquals("ORIGINAL_LOCAL_OPERATION_ONLY_NOT_TRANSPORT_OR_SERVER_CUSTODY",local.getString("state"));
            var epoch=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            for(var directory:java.util.List.of(epoch,capsule,operation)) {
                initialBootstrapMode(directory,0700,true);
                for(String name:initialBootstrapChildNames(directory)) {
                    var file=directory.resolve(name);
                    if(committed.contains(file))firstCustodyLostSnapshot(file,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES,
                        originalRecords,originalRecordIdentities);
                    else firstCustodyLostSnapshot(file,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES,originals,identities);
                }
            }
            assertEquals(2,originalRecords.size());
            for(int i=0;i<2;i++) {
                assertTrue(java.nio.file.Files.notExists(pending.get(i),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                // Move ONLY the just Engine-created original in this guarded
                // .test UID to its fixed legacy pending name. No new bytes,
                // key, IV, signature, valid counter or authorization are seeded.
                java.nio.file.Files.move(committed.get(i),pending.get(i));
                var before=originalRecordIdentities.get(committed.get(i));
                var after=java.nio.file.Files.readAttributes(pending.get(i),java.nio.file.attribute.PosixFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());
                assertEquals(before.lastModifiedTime(),after.lastModifiedTime());assertEquals(before.permissions(),after.permissions());
                assertTrue(java.nio.file.Files.notExists(committed.get(i),java.nio.file.LinkOption.NOFOLLOW_LINKS));
            }
            // ONE actual fixed owner resume. It reconstructs the full original
            // generation/all8/capsule/frame/operation and mints its own control.
            // No helper/private constructor, signer, HTTP or fallback is used.
            JSONObject resumed=AndroidPrivateCustodyOwnerRecovery.resumePendingOriginal(f.application,f.engine,f.work,
                f.principalJournal,f.legacy,f.providerCoordinator);
            assertEquals("custodial.native-same-original-pending-owner-resume.v1",resumed.getString("schema"));
            assertEquals("SAME_PENDING_ORIGINAL_OPERATION_LOCALLY_RESUMED_NO_TRANSPORT_OR_ACK",resumed.getString("state"));
            for(String field:new String[] {"operation_id","frame_sha256","record_sha256","journal_record_sha256",
                "original_generation_id","principal_digest","engine_revision","original_frozen_work_sha256"})
                assertEquals("Same original binding must survive both promotions",local.get(field).toString(),resumed.get(field).toString());
            assertTrue(resumed.getBoolean("original_pending_record_bytes_and_operation_identity_preserved"));
            assertTrue(resumed.getBoolean("full_native_original_owner_reconstructed_before_local_resume"));
            assertTrue(resumed.getBoolean("same_original_capsule_recovered_without_rebinding_operation"));
            assertFalse(resumed.getBoolean("new_owner_generation_encryption_query_or_HTTP_created"));
            assertFalse(resumed.getBoolean("manager_removal_or_reassignment_authority"));
            assertFalse(resumed.getBoolean("actual_Android_process_restart_or_power_loss_qualified"));
            assertInitialRetentionNoEffects(resumed);
            for(int i=0;i<2;i++) {
                assertTrue(java.nio.file.Files.notExists(pending.get(i),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                assertTrue(java.nio.file.Files.exists(committed.get(i),java.nio.file.LinkOption.NOFOLLOW_LINKS));
            }
        } catch(Exception|Error failure) {primary=failure;throw failure;}
        finally {
            try {
                firstCustodyLostSameFiles(originals,identities);
                // On failure an owned empty reservation may coexist with the
                // original pending inode. Retain BOTH, and require that the
                // original still exists byte-for-byte under one fixed name.
                for(int i=0;i<2;i++)if(originalRecords.containsKey(committed.get(i))) {
                    var expected=originalRecordIdentities.get(committed.get(i));java.nio.file.Path retained=null;
                    for(var candidate:java.util.List.of(pending.get(i),committed.get(i)))
                        if(java.nio.file.Files.exists(candidate,java.nio.file.LinkOption.NOFOLLOW_LINKS)) {
                            var actual=java.nio.file.Files.readAttributes(candidate,java.nio.file.attribute.PosixFileAttributes.class,
                                java.nio.file.LinkOption.NOFOLLOW_LINKS);
                            if(expected.fileKey().equals(actual.fileKey()))retained=candidate;
                        }
                    assertNotNull("Original ciphertext inode must remain after every outcome",retained);
                    var bytes=new java.util.HashMap<java.nio.file.Path,byte[]>();
                    var actual=new java.util.HashMap<java.nio.file.Path,java.nio.file.attribute.PosixFileAttributes>();
                    try {
                        firstCustodyLostSnapshot(retained,originalRecords.get(committed.get(i)).length,bytes,actual);
                        assertArrayEquals(originalRecords.get(committed.get(i)),bytes.get(retained));
                        var after=actual.get(retained);assertEquals(expected.size(),after.size());
                        assertEquals(expected.lastModifiedTime(),after.lastModifiedTime());assertEquals(expected.owner(),after.owner());
                        assertEquals(expected.group(),after.group());assertEquals(expected.permissions(),after.permissions());
                    } finally {for(byte[] value:bytes.values())java.util.Arrays.fill(value,(byte)0);}
                }
                assertTrue(initialBootstrapSameRaw(f.originalPayload,initialBootstrapRawOwners(f.owners)));
                assertEquals(f.aliases,initialBootstrapAliases());
                char[] expected=InstrumentedTransport.CREDENTIAL.toCharArray(),retained=null;
                try {retained=f.cipher.decrypt(f.originalVault.secret);assertArrayEquals(expected,retained);}
                finally {VaultValidation.wipe(expected);VaultValidation.wipe(retained);}
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,assertThrows(VaultFailure.class,f.work::requireWorkAdmission).code);
                for(String name:new String[] {VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY,NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                    NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY})
                    assertTrue(java.nio.file.Files.notExists(root.resolve(name),java.nio.file.LinkOption.NOFOLLOW_LINKS));
                var after=android.system.Os.lstat(f.root.getAbsolutePath());
                assertEquals(f.rootBefore.st_mode,after.st_mode);assertEquals(f.rootBefore.st_uid,after.st_uid);assertEquals(f.rootBefore.st_gid,after.st_gid);
                assertEquals(f.rootBefore.st_dev,after.st_dev);assertEquals(f.rootBefore.st_ino,after.st_ino);f.provenance.requireCurrent();
                assertEquals(1,f.enrolls.get());assertEquals(1,f.confirms.get());assertEquals(0,f.unexpected.get());
                assertEquals(0,f.unit.completionCalls.get());assertEquals(0,f.unit.cancelCalls.get());assertEquals(0,f.unit.removeCalls.get());
            } catch(Exception|Error cleanup) {if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            finally {
                for(byte[] value:originals.values())java.util.Arrays.fill(value,(byte)0);
                for(byte[] value:originalRecords.values())java.util.Arrays.fill(value,(byte)0);
            }
        }
    }
}
