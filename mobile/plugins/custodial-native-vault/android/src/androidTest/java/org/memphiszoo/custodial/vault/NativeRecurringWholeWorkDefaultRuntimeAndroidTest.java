package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** ONE fresh managed process/target. SAME actual default Runtime and native
 * WORK preferences, normal synthetic enrollment/status transport only.
 * PROCESS_ONLY raw DATA is not installed native generation or completion
 * authority. No journal/current construction, fake generation, private writes,
 * namespace capture replay, reconciliation, WORK lease or receipt activation. */
@RunWith(AndroidJUnit4.class)
public final class NativeRecurringWholeWorkDefaultRuntimeAndroidTest {
    @Test(timeout=90_000)
    public void processOnlyDefaultOwnerRefusesNativeJoinAndOrdinaryWritesInvalidateWholeData()throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        try(var server=new NativeRecurringNormalVendorAndroidRuntimeTest.OwnedHttpsFixture()){
            server.installBeforeDefaultRuntime();
            var runtime=CustodialNativeRuntime.get(target);var engine=runtime.engine;
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(engine.observeStateReadOnly());
            char[] code="12345678".toCharArray();
            try{engine.enroll(server.operation,"KIOSK_08","enrollment",code);}finally{VaultValidation.wipe(code);}
            engine.completeLocalBinding(server.operation);engine.confirmEnrollment(server.operation);
            assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
            var plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
            AtomicReference<BridgeSmokeActivity> host=new AtomicReference<>();
            AtomicReference<NativeOriginalBrowserPreparation> original=new AtomicReference<>();
            long originalUntil=0;
            Field destroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
            Field retired=field(NativeOriginalBrowserPreparation.class,"diagnosticOwnerJavaRetired");
            Field delegated=field(NativeOriginalBrowserPreparation.class,"diagnosticProviderDisposalDelegated");
            Field physicalStarted=field(NativeOriginalBrowserPreparation.class,"diagnosticPhysicalCleanupStarted");
            var queries=new NativeRecurringApplicationSourceAndroidRuntimeTest();
            try{
                try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                    // Same ONE original20s includes normal navigation/status,
                    // WORK observations/mutations and actual teardown.
                    originalUntil=android.os.SystemClock.elapsedRealtime()+20_000;
                    scenario.onActivity(activity->{host.set(activity);assertSame(plugin,activity.getBridge().getPlugin("CustodialNativeVault").getInstance());});
                    Field source=field(CustodialNativeRuntime.class,"originalBrowser");
                    original.set((NativeOriginalBrowserPreparation)source.get(runtime));assertNotNull(original.get());
                    NativeRecurringApplicationSourceAndroidRuntimeTest.settleInitialNavigation(scenario,host.get(),originalUntil,"KIOSK_08");
                    int statusBefore=server.statusReads;queries.captureInitialStatus(host.get(),originalUntil);
                    assertTrue(server.statusReads>statusBefore);assertNotNull(runtime.readNotificationMutationPrincipal());
                    assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
                    var raw=target.getApplicationContext().getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
                    var editor=new AndroidProtectedWorkPreferences(raw);
                    Map<String,?> before=raw.getAll();
                    String key="fixture_whole_work13_"+java.util.UUID.randomUUID();assertFalse(before.containsKey(key));
                    try(var read=runtime.offlineStore.captureWholeWorkRead()){
                        read.requireReadOnlyCurrent(runtime.offlineStore);
                        assertThrows(VaultFailure.class,()->read.requireInstalledNativeGeneration(runtime.offlineStore));
                        read.requireReadOnlyCurrent(runtime.offlineStore);
                        assertTrue(editor.edit().putString(key,"A").commit());
                        assertThrows(VaultFailure.class,()->read.requireReadOnlyCurrent(runtime.offlineStore));
                    }
                    try(var aba=runtime.offlineStore.captureWholeWorkRead()){
                        aba.requireReadOnlyCurrent(runtime.offlineStore);
                        assertTrue(editor.edit().putString(key,"B").commit());
                        assertTrue(editor.edit().putString(key,"A").commit());
                        assertEquals("A",raw.getString(key,null));
                        assertThrows(VaultFailure.class,()->aba.requireReadOnlyCurrent(runtime.offlineStore));
                    }
                    try(var noop=runtime.offlineStore.captureWholeWorkRead()){
                        noop.requireReadOnlyCurrent(runtime.offlineStore);
                        assertTrue(editor.edit().putString(key,"A").commit());
                        assertThrows(VaultFailure.class,()->noop.requireReadOnlyCurrent(runtime.offlineStore));
                    }
                    try(var fresh=runtime.offlineStore.captureWholeWorkRead()){
                        fresh.requireReadOnlyCurrent(runtime.offlineStore);
                        assertThrows(VaultFailure.class,()->fresh.requireInstalledNativeGeneration(runtime.offlineStore));
                    }
                    // Preserve every pre-existing raw row. Only the new explicit
                    // synthetic cell and ordinary mutation metadata may differ.
                    Map<String,Object> left=new HashMap<>(before),right=new HashMap<>(raw.getAll());
                    left.remove(AndroidProtectedWorkPreferences.MUTATION_KEY);
                    right.remove(AndroidProtectedWorkPreferences.MUTATION_KEY);right.remove(key);
                    assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(left,right));
                    assertEquals("A",raw.getString(key,null));
                    assertEquals("PROCESS_ONLY",AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture());
                    assertSame(engine,runtime.engine);assertEquals(1,server.enrolls);assertEquals(1,server.confirms);
                    assertTrue(android.os.SystemClock.elapsedRealtime()<originalUntil);
                }
                // Field-only post-close observation, no Activity/WebView call.
                while(android.os.SystemClock.elapsedRealtime()<originalUntil
                    &&!(destroyed.getBoolean(host.get())&&retired.getBoolean(original.get())&&delegated.getBoolean(original.get())))
                    android.os.SystemClock.sleep(25);
                assertTrue("Actual teardown inside SAME original20s",originalUntil>0&&android.os.SystemClock.elapsedRealtime()<originalUntil);
                assertTrue(destroyed.getBoolean(host.get()));assertTrue(retired.getBoolean(original.get()));assertTrue(delegated.getBoolean(original.get()));
                assertFalse("No owner-bound explicit provider removal",physicalStarted.getBoolean(original.get()));
                System.out.println("CUSTODIAL_WHOLE_WORK13_DEFAULT_RUNTIME processOnly=true nativeGenerationPositive=false ordinaryMutationRefused=true abaRefused=true noopRefused=true actualViewDestroyed=true receiptEligible=false");
            }finally{BridgeSmokeActivity.install(null);}
            // Preserve synthetic credential/WORK rows; no clear/remove/reset.
        }
    }
    private static Field field(Class<?> owner,String key)throws Exception {
        Field value=owner.getDeclaredField(key);value.setAccessible(true);return value;
    }
}
