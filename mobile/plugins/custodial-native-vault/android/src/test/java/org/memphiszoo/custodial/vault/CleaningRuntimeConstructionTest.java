package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual compiled runtime constructor with synthetic Android Context/preferences.
 * Not AndroidKeyStore, real process restart, device preference I/O or NFC proof. */
public final class CleaningRuntimeConstructionTest {
    private Field singleton;
    private Object previous;
    @Before public void isolateProcessSingleton() throws Exception {
        singleton = CustodialNativeRuntime.class.getDeclaredField("instance");
        singleton.setAccessible(true); previous = singleton.get(null); singleton.set(null, null);
    }
    @After public void restoreTestSingleton() throws Exception { singleton.set(null, previous); }

    static final class Application extends ContextWrapper {
        final List<String> opened = new ArrayList<>();
        int preferenceOperations;
        boolean denyCore;
        Application() { super(null); }
        @Override public Context getApplicationContext() { return this; }
        @Override public SharedPreferences getSharedPreferences(String name, int mode) {
            opened.add(name);
            if (name.equals("MemphisZooCustodialNativeProviderV1"))
                throw new IllegalStateException("synthetic deferred provider namespace unavailable");
            if (denyCore) throw new IllegalStateException("synthetic protected cleaning store unavailable");
            assertEquals(Context.MODE_PRIVATE, mode);
            return (SharedPreferences) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{SharedPreferences.class}, (proxy, method, args) -> {
                    preferenceOperations++;
                    throw new AssertionError("Construction must not read/write/reconcile: " + method.getName());
                });
        }
    }
    static Context activity(Application application) {
        return new ContextWrapper(null) {
            @Override public Context getApplicationContext() { return application; }
            @Override public SharedPreferences getSharedPreferences(String n, int mode) {
                throw new AssertionError("Activity must not own native persistence");
            }
        };
    }
    @Test public void cleaningStartsWithoutOpeningUnavailableProviderNamespace() {
        Application application = new Application();
        CustodialNativeRuntime runtime = CustodialNativeRuntime.get(activity(application));
        assertNotNull(runtime.engine); assertNotNull(runtime.offlineTime);
        assertNotNull(runtime.principalJournal); assertNotNull(runtime.legacyJournal);
        assertEquals(Arrays.asList("MemphisZooCustodialNativeVaultV2", "MemphisZooCustodialOfflineAuthorityTimeV1"), application.opened);
        assertEquals(0, application.preferenceOperations);
    }
    @Test public void pluginAndReceiverShareExactlyOneEngineAndStore() {
        Application application = new Application();
        CustodialNativeRuntime plugin = CustodialNativeRuntime.get(activity(application));
        CustodialNativeRuntime receiver = CustodialNativeRuntime.get(application);
        assertSame(plugin, receiver); assertSame(plugin.engine, receiver.engine);
        assertSame(plugin.offlineStore, receiver.offlineStore);
        assertEquals(2, application.opened.size()); assertEquals(0, application.preferenceOperations);
    }
    @Test public void missingApplicationDoesNotInventAnOwner() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> CustodialNativeRuntime.get(null));
        assertThrows(IllegalArgumentException.class, () -> CustodialNativeRuntime.get(new ContextWrapper(null) {
            @Override public Context getApplicationContext() { return null; }
        }));
        assertNull(singleton.get(null));
    }
    @Test public void failedProtectedStoreDoesNotCreateAFallbackOrPartialSingleton() throws Exception {
        Application application = new Application(); application.denyCore = true;
        assertThrows(IllegalStateException.class, () -> CustodialNativeRuntime.get(application));
        assertNull(singleton.get(null)); assertEquals(0, application.preferenceOperations);
        application.denyCore = false;
        assertNotNull(CustodialNativeRuntime.get(application));
        assertEquals(0, application.preferenceOperations);
    }
}
