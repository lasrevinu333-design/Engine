package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Each method requires its OWN fresh process/managed target. Real default
 * Runtime, Plugin, Bridge, Source and AndroidX registrations; no enrollment,
 * HTTP fixture, fake Source, owner-field write, retry or receipt assertion.
 * Prepared only: never select the whole class in one reused process. */
@RunWith(AndroidJUnit4.class)
public final class NativeOriginalOwnerCleanupAndroidRuntimeTest {
    @Test(timeout=90_000) public void genericCloseDefersThenActualOwnerDrains()throws Exception {owningCase(0);}
    @Test(timeout=90_000) public void alreadyDetachedOwnerStillDrainsPendingCleanup()throws Exception {owningCase(1);}
    @Test(timeout=90_000) public void foreignOwnerCannotDetachOrDrainActualSource()throws Exception {owningCase(2);}
    @Test(timeout=90_000) public void sameViewCannotReplacePendingDetachedCleanup()throws Exception {owningCase(3);}

    @Test(timeout=90_000) public void boundCleanupCannotBeAdoptedByAnotherConstructor()throws Exception {owningCase(4);}

    private static void owningCase(int mode)throws Exception {
        var target=ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
        var runtime=CustodialNativeRuntime.get(target);
        NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(runtime.engine.observeStateReadOnly());
        var plugin=new CustodialNativeVaultPlugin();BridgeSmokeActivity.install(plugin);
        AtomicReference<BridgeSmokeActivity> host=new AtomicReference<>();
        AtomicReference<NativeOriginalBrowserPreparation> original=new AtomicReference<>();
        AtomicReference<Runnable> queued=new AtomicReference<>();
        final Field sourceField=field(CustodialNativeRuntime.class,"originalBrowser");
        final Field recordsField=field(CustodialNativeRuntime.class,"originalBrowserCleanups");
        final Field taskField=field(NativeOriginalBrowserPreparation.class,"physicalCleanup");
        final Field started=field(NativeOriginalBrowserPreparation.class,"diagnosticPhysicalCleanupStarted");
        final Field finished=field(NativeOriginalBrowserPreparation.class,"diagnosticPhysicalCleanupFinished");
        final Field claimed=field(NativeOriginalBrowserPreparation.class,"physicalCleanupClaimed");
        final Field ownerRetired=field(NativeOriginalBrowserPreparation.class,"diagnosticOwnerJavaRetired");
        final Field delegated=field(NativeOriginalBrowserPreparation.class,"diagnosticProviderDisposalDelegated");
        final Field closed=field(NativeOriginalBrowserPreparation.class,"closed");
        final Field hostDestroyed=field(BridgeSmokeActivity.class,"viewDestroyCompleted");
        long until=android.os.SystemClock.elapsedRealtime()+20_000;
        try {
            try(ActivityScenario<BridgeSmokeActivity> scenario=ActivityScenario.launch(BridgeSmokeActivity.class)){
                scenario.onActivity(activity->{
                    try {
                        host.set(activity);assertSame(plugin,activity.getBridge().getPlugin("CustodialNativeVault").getInstance());
                        var source=(NativeOriginalBrowserPreparation)sourceField.get(runtime);assertNotNull(source);original.set(source);
                        var view=activity.getBridge().getWebView();
                        Object record=((Map<?,?>)recordsField.get(runtime)).get(view);assertNotNull(record);
                        assertFalse(closed.getBoolean(source));
                        if(mode==2){
                            // Real unregistered foreign Plugin cannot affect
                            // either the authority registration or cleanup map.
                            runtime.detachOriginalBrowser(new CustodialNativeVaultPlugin());
                            assertSame(source,sourceField.get(runtime));assertFalse(closed.getBoolean(source));
                            var permit=record.getClass().getDeclaredMethod("permitsOwnerDestruction",NativeOriginalBrowserPreparation.class,
                                com.getcapacitor.Bridge.class,android.webkit.WebView.class);permit.setAccessible(true);
                            assertEquals(Boolean.FALSE,permit.invoke(record,source,activity.getBridge(),view));
                            assertEquals(Boolean.FALSE,permit.invoke(record,null,activity.getBridge(),view));
                            assertEquals(Boolean.FALSE,permit.invoke(record,source,null,view));
                            assertEquals(Boolean.FALSE,permit.invoke(record,source,activity.getBridge(),null));
                        }
                        if(mode==4){
                            // Invoke the REAL Source constructor with the
                            // already bound native record. Its first binding
                            // guard must refuse BEFORE installing/removing APIs.
                            try {NativeOriginalBrowserPreparation.attach(target,activity.getBridge(),
                                (CustodialNativeRuntime.OriginalBrowserCleanup)record);
                                fail("Already bound cleanup identity must not be adopted");}
                            catch(VaultFailure expected){assertEquals("custodial_original_browser_preparation_unavailable",expected.code);}
                            assertSame(source,sourceField.get(runtime));assertFalse(closed.getBoolean(source));
                            assertSame(record,((Map<?,?>)recordsField.get(runtime)).get(view));
                            assertNull(taskField.get(source));
                        }
                        if(mode==1||mode==3){
                            runtime.detachOriginalBrowser(plugin);assertNull(sourceField.get(runtime));
                            assertSame(record,((Map<?,?>)recordsField.get(runtime)).get(view));
                            if(mode==3){
                                try {runtime.attachOriginalBrowser(plugin,activity.getBridge());fail("Pending old same-view cleanup must refuse replacement");}
                                catch(VaultFailure expected){assertEquals("custodial_original_browser_preparation_unavailable",expected.code);}
                                assertNull(sourceField.get(runtime));assertSame(record,((Map<?,?>)recordsField.get(runtime)).get(view));
                            }
                        }else source.close();
                        // Still in SAME actual UI callback: generic close may
                        // not synchronously delete its injected native object.
                        assertTrue(closed.getBoolean(source));assertFalse(started.getBoolean(source));
                        queued.set((Runnable)taskField.get(source));assertNotNull(queued.get());
                        if(mode==1||mode==3){
                            // Owner-bound physical registrations are retained,
                            // not posted for removal. Run the ACTUAL captured
                            // task now: it must be a no-op, leaving custody for
                            // the actual owner lifecycle and WebView destroy.
                            queued.get().run();
                            assertFalse(started.getBoolean(source));
                            assertSame(record,((Map<?,?>)recordsField.get(runtime)).get(view));
                        }
                    }catch(Exception error){throw new AssertionError(error);}
                });
                assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            }
            // ONLY captured volatile/scalar DATA after close. No Activity,
            // Bridge, WebView or AndroidX method is invoked below.
            while(!hostDestroyed.getBoolean(host.get())&&android.os.SystemClock.elapsedRealtime()<until)
                android.os.SystemClock.sleep(25);
            assertTrue("Same original20s includes actual destroy",android.os.SystemClock.elapsedRealtime()<until);
            assertTrue(hostDestroyed.getBoolean(host.get()));
            assertTrue(ownerRetired.getBoolean(original.get()));assertTrue(delegated.getBoolean(original.get()));
            assertFalse("No owner-bound provider removal attempt",started.getBoolean(original.get()));
            assertFalse("No explicit removal-success claim",finished.getBoolean(original.get()));
            assertTrue(claimed.getBoolean(original.get()));assertNull(sourceField.get(runtime));
            assertTrue(((Map<?,?>)recordsField.get(runtime)).isEmpty());
            // Execute the ACTUAL captured task after owner destruction. Its
            // one-claim gate must return before any removed-view API call.
            queued.get().run();queued.get().run();
            assertNull(taskField.get(original.get()));assertFalse(started.getBoolean(original.get()));
            assertFalse(finished.getBoolean(original.get()));
            assertTrue(android.os.SystemClock.elapsedRealtime()<until);
            NativeRecurringApplicationSourceAndroidRuntimeTest.assertNativeEmpty(runtime.engine.observeStateReadOnly());
            System.out.println("CUSTODIAL_OWNER_CLEANUP_CASE mode="+mode+" actualViewDestroyed=true ownerJavaRetired=true providerDisposalDelegated=true explicitProviderRemoval=false lateTaskNoThrow=true receiptEligible=false");
        }finally {BridgeSmokeActivity.install(null);}
    }
    private static Field field(Class<?> owner,String name)throws Exception {
        Field value=owner.getDeclaredField(name);value.setAccessible(true);return value;
    }
}
