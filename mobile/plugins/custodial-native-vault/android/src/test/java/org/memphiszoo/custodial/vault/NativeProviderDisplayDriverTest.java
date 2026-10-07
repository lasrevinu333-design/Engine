package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual effect driver plus encrypted journal; synthetic NotificationManager observation only. */
public final class NativeProviderDisplayDriverTest {
    interface Hook { void run() throws Exception; }
    static final class Surface implements NativeProviderDisplayDriver.Surface {
        boolean enabled = true, visibleAfterShow = true, cancelWorks = true;
        NativeProviderDisplayDriver.Active active = NativeProviderDisplayDriver.Active.ABSENT;
        int shows, cancellations; List<String> tags = new ArrayList<>(); Hook onShow;
        public boolean enabled(NativeProviderPayload payload) { return enabled; }
        public NativeProviderDisplayDriver.Active active(NativeProviderJournal.OsDisplayIntent intent) { return active; }
        public void show(NativeProviderJournal.OsDisplayIntent intent) throws Exception {
            shows++; tags.add(intent.tag); if (visibleAfterShow) active = NativeProviderDisplayDriver.Active.MATCH;
            if (onShow != null) onShow.run();
        }
        public void cancel(String tag) { cancellations++; tags.add(tag); if (cancelWorks) active = NativeProviderDisplayDriver.Active.ABSENT; }
        public boolean absent(String tag) { return active == NativeProviderDisplayDriver.Active.ABSENT; }
    }
    static final class Fixture {
        final NativeProviderPresentationTest.Fixture f = new NativeProviderPresentationTest.Fixture();
        final Surface surface = new Surface();
        final NativeProviderDisplayDriver driver = new NativeProviderDisplayDriver(f.journal(), surface);
        Fixture() throws Exception { }
        NativeProviderDisplayDriver.Guard guard() { return () -> {
            f.journal().requirePresentationCurrent(f.principal, f.presentation);
            try { return NativeProviderPresentationTest.observed(); } catch (Exception error) { throw new VaultFailure("synthetic_time_error", error); }
        }; }
        boolean show() throws Exception { return driver.display(f.principal, f.presentation, guard()); }
    }
    @Test public void exactActiveObservationIsRequiredAfterNotifyAndOnlyExactTagCanBeCanceled() throws Exception {
        Fixture f = new Fixture(); assertTrue(f.show()); assertEquals(1, f.surface.shows); assertEquals(2, f.f.events());
        assertFalse(f.show()); assertEquals(1, f.surface.shows); assertEquals(2, f.f.events()); f.f.action("acknowledged");
        assertEquals(1, f.driver.cancelPending(32)); assertFalse(f.f.record().getBoolean("os_cancel_pending"));
        for (String tag : f.surface.tags) assertEquals("mz-provider:" + f.f.f.payload.recordId, tag);
    }
    @Test public void disabledPermissionDoesNotCreateDisplayIntentOrEventAndKeepsMirrorAvailable() throws Exception {
        Fixture f = new Fixture(); f.surface.enabled = false; assertFalse(f.show()); assertEquals(0, f.surface.shows);
        assertEquals("PENDING_DISPLAY", f.f.record().getString("display_state")); assertEquals(1, f.f.events());
        f.f.action("displayed"); assertEquals(2, f.f.events()); assertTrue(f.f.record().getBoolean("mirror_rendered"));
    }
    @Test public void notifySuccessWithoutActiveItemIsNotDisplayAndIsCanceledWithUncertaintyPreserved() throws Exception {
        Fixture f = new Fixture(); f.surface.visibleAfterShow = false;
        ProviderRecordStoreTest.failure("custodial_provider_os_display_unconfirmed", f::show);
        assertEquals(1, f.surface.shows); assertEquals(1, f.surface.cancellations); assertEquals(1, f.f.events());
        assertTrue(f.f.record().getBoolean("os_cancel_pending")); assertEquals("DISPLAY_UNCERTAIN", f.f.record().getString("display_state"));
        assertEquals(1, f.driver.cancelPending(32)); assertEquals("PENDING_DISPLAY", f.f.record().getString("display_state"));
    }
    @Test public void processRestartReconcilesExistingExactItemWithoutAnotherNotify() throws Exception {
        Fixture f = new Fixture(); f.f.journal().prepareOsDisplay(f.f.principal, f.f.presentation, NativeProviderPresentationTest.observed());
        f.surface.active = NativeProviderDisplayDriver.Active.MATCH;
        assertTrue(new NativeProviderDisplayDriver(f.f.journal(), f.surface).display(f.f.principal, f.f.presentation, f.guard()));
        assertEquals(0, f.surface.shows); assertEquals(2, f.f.events());
    }
    @Test public void wrongActiveContentCannotBecomeDisplayedAndCancellationMustBeObserved() throws Exception {
        Fixture f = new Fixture(); f.surface.active = NativeProviderDisplayDriver.Active.CONFLICT; f.surface.cancelWorks = false;
        ProviderRecordStoreTest.failure("custodial_provider_os_item_conflict", f::show); assertEquals(0, f.surface.shows); assertEquals(1, f.f.events());
        ProviderRecordStoreTest.failure("custodial_provider_os_cancel_unconfirmed", () -> f.driver.cancelPending(32));
        assertTrue(f.f.record().getBoolean("os_cancel_pending")); f.surface.cancelWorks = true; assertEquals(1, f.driver.cancelPending(32));
    }
    @Test public void failureAfterActualNotifyCancelsExactItemAndNeverCreditsMissingFinalWrite() throws Exception {
        for (boolean ambiguous : new boolean[]{false, true}) {
            Fixture f = new Fixture(); f.surface.onShow = () -> {
                if (ambiguous) f.f.f.r.f.storage.memory.persistThenReject = true; else f.f.f.r.f.storage.memory.reject = true;
            };
            ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", f::show);
            assertEquals(1, f.surface.shows); assertTrue(f.surface.cancellations > 0); assertEquals(NativeProviderDisplayDriver.Active.ABSENT, f.surface.active);
            assertEquals(ambiguous ? 2 : 1, f.f.events()); // Persisted display fact may exist; caller did not claim success.
            f.f.f.r.f.storage.memory.reject = false; f.f.f.r.f.storage.memory.persistThenReject = false;
            if (ambiguous) { assertEquals(1, f.driver.cancelPending(32)); assertEquals(2, f.f.events()); }
            else { assertEquals("DISPLAY_UNCERTAIN", f.f.record().getString("display_state")); }
        }
    }
    @Test public void removalDuringOsEffectFencesDisplayReceiptAndPreservesCancelForExactOldItem() throws Exception {
        Fixture f = new Fixture(); f.surface.onShow = () -> f.f.journal().observeRemoved();
        ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", f::show);
        assertEquals(1, f.f.events()); assertEquals("REVOKED_OR_FOREIGN", f.f.record().getString("authority_state"));
        assertEquals(1, f.driver.cancelPending(32)); assertFalse(f.f.record().getBoolean("os_cancel_pending"));
    }
    @Test public void oldOrForgedOsAttemptCannotOpenButExactAttemptCommitsBeforeNavigation() throws Exception {
        Fixture f = new Fixture(); assertTrue(f.show()); String attempt = f.f.record().getString("os_attempt_id"), id = f.f.f.payload.recordId;
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.f.journal().applyOsAction(f.f.principal, id, "forged", "opened", NativeProviderPresentationTest.observed()));
        ProviderRecordStoreTest.failure("custodial_provider_action_invalid", () -> f.f.journal().applyOsAction(f.f.principal, id, attempt, "displayed", NativeProviderPresentationTest.observed()));
        f.f.journal().applyOsAction(f.f.principal, id, attempt, "opened", NativeProviderPresentationTest.observed());
        assertTrue(f.f.record().getBoolean("navigation_pending")); assertEquals(3, f.f.events()); assertEquals(1, f.driver.cancelPending(32));
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.f.journal().applyOsAction(f.f.principal, id, attempt, "opened", NativeProviderPresentationTest.observed()));
    }
}
