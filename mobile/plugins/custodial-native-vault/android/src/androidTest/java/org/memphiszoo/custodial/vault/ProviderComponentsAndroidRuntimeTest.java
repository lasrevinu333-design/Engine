package org.memphiszoo.custodial.vault;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Run only against the generated Custodial app; never clears vault, keys or enrollment.
 * These checks do not activate provider authority, post notifications, or assert delivery. */
@RunWith(AndroidJUnit4.class)
public final class ProviderComponentsAndroidRuntimeTest {
    private Context context() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("requires generated Custodial target", NativeProviderActionIntent.PACKAGE, context.getPackageName());
        return context;
    }
    @Test public void installedPrivateComponentsHaveExactProtectionAndSameProcess() throws Exception {
        Context context = context(); PackageManager manager = context.getPackageManager();
        ActivityInfo open = manager.getActivityInfo(new ComponentName(context, ProviderNotificationOpenActivity.class), 0);
        assertFalse(open.exported); assertFalse(open.directBootAware);
        assertEquals(context.getPackageName(), open.processName);
        assertTrue((open.flags & ActivityInfo.FLAG_NO_HISTORY) != 0);
        assertTrue((open.flags & ActivityInfo.FLAG_EXCLUDE_FROM_RECENTS) != 0);
        ActivityInfo receiver = manager.getReceiverInfo(new ComponentName(context, ProviderNotificationActionReceiver.class), 0);
        assertFalse(receiver.exported); assertFalse(receiver.directBootAware);
        assertEquals(context.getPackageName(), receiver.processName);
        ServiceInfo service = manager.getServiceInfo(new ComponentName(context, CustodialProviderSyncJobService.class), 0);
        assertFalse(service.exported); assertFalse(service.directBootAware);
        assertEquals("android.permission.BIND_JOB_SERVICE", service.permission);
        assertEquals(context.getPackageName(), service.processName);
    }
    @Test public void actualAndroidIntentAdapterRejectsExtraPayloadAndWrongSurface() throws Exception {
        Context context = context();
        Intent exact = new Intent().setClass(context, ProviderNotificationOpenActivity.class)
            .setAction(NativeProviderActionIntent.ACTION_PREFIX + "opened")
            .setData(Uri.parse("mz-custodial-provider://notification/" + "a".repeat(64)
                + "/12345678-1234-4234-8234-123456789abc/opened"));
        assertEquals("opened", AndroidProviderActionIntent.read(context, exact, true).action);
        for (Intent forged : new Intent[]{new Intent(exact).putExtra("principal", "foreign"),
            new Intent(exact).setClass(context, ProviderNotificationActionReceiver.class),
            new Intent(exact).setData(Uri.parse(exact.getDataString() + "?route=scan"))}) {
            try { AndroidProviderActionIntent.read(context, forged, true); fail("forged action accepted"); }
            catch (VaultFailure denied) { assertEquals("custodial_provider_action_intent_invalid", denied.code); }
        }
    }
    @Test public void registeredComponentsDoNotImplyRuntimeAdmission() {
        Context context = context();
        assertSame(NativeProviderComponentRuntime.SUSPENDED, CustodialNativeRuntime.providerComponents(context));
        assertEquals(NativeProviderJobLifecycle.Result.SUSPEND, CustodialNativeRuntime.providerComponents(context).pendingWork());
    }
}
