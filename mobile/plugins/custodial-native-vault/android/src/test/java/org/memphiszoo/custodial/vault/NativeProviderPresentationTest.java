package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Journal/opaque-claim ownership with synthetic OS observation and native clock edges.
 * No NotificationManager, Activity, real audio, Fully or physical acceptance credited. */
public final class NativeProviderPresentationTest {
    static final String NOW = NativeProviderIngressTest.NOW;
    static NativeProviderJournal.Observation observed() throws Exception { return NativeProviderIngressTest.observation(NOW, 101, 7); }
    static final class Fixture {
        final NativeProviderIngressTest.Fixture f;
        final NativeProviderPrincipal principal;
        final NativeProviderJournal.Presentation presentation;
        Fixture() throws Exception {
            f = new NativeProviderIngressTest.Fixture(true, false); f.arrive(NOW); principal = f.r.principal;
            presentation = journal().presentation(principal, f.payload.recordId);
        }
        NativeProviderJournal journal() { return f.r.f.journal(); }
        JSONObject record() throws Exception { return f.read(ProviderEnvelopeCrypto.Domain.INBOX); }
        long events() throws Exception { return f.count(ProviderEnvelopeCrypto.Domain.EVENT); }
        void action(String action) throws Exception { journal().applyPresentationAction(principal, presentation, action, observed()); }
    }
    @Test public void osIntentIsDurableBeforeEffectAndRestartKeepsExactUncertaintyIdentity() throws Exception {
        Fixture f = new Fixture(); int before = f.f.r.f.storage.memory.commits;
        NativeProviderJournal.OsDisplayIntent intent = f.journal().prepareOsDisplay(f.principal, f.presentation, observed());
        assertEquals(before + 1, f.f.r.f.storage.memory.commits); assertEquals("DISPLAY_UNCERTAIN", f.record().getString("display_state"));
        assertEquals(1, f.events()); assertTrue(f.record().isNull("displayed_event_id"));
        NativeProviderJournal.OsDisplayIntent restarted = f.journal().prepareOsDisplay(f.principal, f.journal().presentation(f.principal, f.f.payload.recordId), observed());
        assertEquals(intent.attemptId, restarted.attemptId); assertEquals("mz-provider:" + f.f.payload.recordId, restarted.tag);
        assertEquals(before + 1, f.f.r.f.storage.memory.commits);
    }
    @Test public void osObservationAndMirrorMakeExactlyOneDisplayEventWithOriginalBinding() throws Exception {
        for (boolean mirrorFirst : new boolean[]{false, true}) {
            Fixture f = new Fixture(); NativeProviderJournal.OsDisplayIntent intent = f.journal().prepareOsDisplay(f.principal, f.presentation, observed());
            if (mirrorFirst) f.action("displayed");
            f.journal().confirmOsDisplayed(f.principal, intent, observed()); f.action("displayed");
            String id = f.record().getString("displayed_event_id"); JSONObject event = f.f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, id);
            assertEquals("displayed", event.getString("action")); assertEquals(f.f.payload.generationId, event.getString("generation_id"));
            assertEquals(f.f.payload.contentHash, event.getString("content_sha256")); assertEquals(2, f.events()); assertTrue(f.record().getBoolean("mirror_rendered"));
            int commits = f.f.r.f.storage.memory.commits; f.action("displayed"); f.journal().confirmOsDisplayed(f.principal, intent, observed());
            assertEquals(commits, f.f.r.f.storage.memory.commits); assertNull(f.journal().prepareOsDisplay(f.principal, f.presentation, observed()));
        }
    }
    @Test public void failedOrAmbiguousDisplayWriteNeverReturnsConfirmedAndRetryDoesNotDuplicate() throws Exception {
        Fixture f = new Fixture(); NativeProviderJournal.OsDisplayIntent intent = f.journal().prepareOsDisplay(f.principal, f.presentation, observed());
        Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw); f.f.r.f.storage.memory.reject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.journal().confirmOsDisplayed(f.principal, intent, observed()));
        assertEquals(before, f.f.r.f.storage.memory.raw); f.f.r.f.storage.memory.reject = false; f.f.r.f.storage.memory.persistThenReject = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.journal().confirmOsDisplayed(f.principal, intent, observed()));
        f.f.r.f.storage.memory.persistThenReject = false; int commits = f.f.r.f.storage.memory.commits;
        f.journal().confirmOsDisplayed(f.principal, intent, observed()); assertEquals(commits, f.f.r.f.storage.memory.commits); assertEquals(2, f.events());
    }
    @Test public void deniedPermissionNeedsNoDisplayEventAndCancellationDoesNotInventOne() throws Exception {
        Fixture f = new Fixture(); assertEquals("PENDING_DISPLAY", f.record().getString("display_state"));
        // Adapter must avoid notify/confirmation when blocked. Uncertain old item may be canceled exactly.
        f.journal().prepareOsDisplay(f.principal, f.presentation, observed()); f.journal().requestOsCancellation(f.principal, f.presentation);
        NativeProviderJournal.OsCancellation cancel = f.journal().pendingOsCancellations().get(0);
        f.journal().confirmOsCanceled(cancel); assertEquals("PENDING_DISPLAY", f.record().getString("display_state"));
        assertTrue(f.record().isNull("os_attempt_id")); assertEquals(1, f.events());
    }
    @Test public void unknownOrExpiredTimeCannotCreateDisplayButAlreadyRecordedOfflineOpenRemainsDurable() throws Exception {
        for (String time : new String[]{null, NativeProviderPayloadTest.END}) {
            Fixture f = new Fixture(); NativeProviderJournal.Observation observation = NativeProviderIngressTest.observation(time, 500, 7);
            f.action("opened"); // The original action is durable while live, not first authorized after expiry.
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
            ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable", () -> f.journal().prepareOsDisplay(f.principal, f.presentation, observation));
            ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable", () -> f.journal().applyPresentationAction(f.principal, f.presentation, "displayed", observation));
            f.journal().applyPresentationAction(f.principal, f.presentation, "opened", observation);
            assertEquals(before, f.f.r.f.storage.memory.raw);
            assertTrue(f.record().getBoolean("navigation_pending")); assertEquals(2, f.events());
            NativeProviderClaims claims = new NativeProviderClaims(f.journal()); Object owner = new Object(); claims.attach(owner);
            NativeProviderClaims.Claim claim = claims.claimNext(owner, f.principal, observation);
            assertTrue(claim.data().getBoolean("historical")); assertTrue(claim.data().getBoolean("navigation_pending"));
            // Navigation is to original locally bundled route, not a claim of active borrowed duty.
            assertEquals(f.f.payload.get("route"), claim.data().getJSONObject("payload").getString("route"));
            assertTrue(f.record().isNull("displayed_event_id"));
            claims.apply(owner, f.principal, claim.id, "navigation_completed", observation);
            assertFalse(f.record().getBoolean("navigation_pending")); assertEquals(2, f.events());
        }
    }
    static NativeProviderJournal.Observation[] unavailableActionTimes(Fixture f) throws Exception {
        return new NativeProviderJournal.Observation[]{
            NativeProviderIngressTest.observation(null, 500, 7),
            NativeProviderTimeTest.observation(f.f.payload.validUntil, 500, 7),
            NativeProviderTimeTest.observation(f.f.payload.validUntil.minusNanos(1000), 500, 7),
            NativeProviderTimeTest.observation(f.f.payload.validUntil.minusNanos(2000), 500, 7),
            NativeProviderTimeTest.observation(f.f.payload.reservedAt.minusNanos(1000), 500, 7)
        }; // UNKNOWN, expired, straddling, latest == expiry, earliest < reservation.
    }
    static void assertNewActionsRequireLive(String surface) throws Exception {
        for (String action : new String[]{"opened", "acknowledged"}) {
            Fixture f = new Fixture(); Object owner = new Object(); NativeProviderClaims claims = new NativeProviderClaims(f.journal());
            NativeProviderJournal.OsDisplayIntent intent = f.journal().prepareOsDisplay(f.principal, f.presentation, observed());
            f.journal().confirmOsDisplayed(f.principal, intent, observed());
            claims.attach(owner); NativeProviderClaims.Claim claim = claims.claimNext(owner, f.principal, observed());
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw); int commits = f.f.r.f.storage.memory.commits;
            for (NativeProviderJournal.Observation time : unavailableActionTimes(f)) {
                ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable", () -> {
                    if ("claim".equals(surface)) claims.apply(owner, f.principal, claim.id, action, time);
                    else if ("os".equals(surface)) f.journal().applyOsAction(f.principal, f.f.payload.recordId, intent.attemptId, action, time);
                    else f.journal().applyPresentationAction(f.principal, f.presentation, action, time);
                });
                assertEquals(surface + "/" + action, before, f.f.r.f.storage.memory.raw);
                assertEquals(commits, f.f.r.f.storage.memory.commits);
                assertTrue(f.record().isNull(action + "_event_id")); assertFalse(f.record().getBoolean("navigation_pending"));
            }
        }
    }
    @Test public void newJournalOpenAckNeedFreshBoundsWithoutAnyStoreMutation() throws Exception { assertNewActionsRequireLive("journal"); }
    @Test public void existingOpaqueClaimCannotMintNewOpenAckAfterFreshnessLoss() throws Exception { assertNewActionsRequireLive("claim"); }
    @Test public void existingOsActionCannotMintNewOpenAckAfterFreshnessLoss() throws Exception { assertNewActionsRequireLive("os"); }
    @Test public void newActionsAcceptReservationEqualityAndStrictlyBeforeExpiry() throws Exception {
        for (String action : new String[]{"opened", "acknowledged"}) for (boolean lastValid : new boolean[]{false, true}) {
            Fixture f = new Fixture(); Instant earliest = lastValid ? f.f.payload.validUntil.minusNanos(3000) : f.f.payload.reservedAt;
            NativeProviderJournal.Observation time = NativeProviderTimeTest.observation(earliest, 500, 7);
            assertTrue(NativeProviderTime.live(time.bounds, f.f.payload.reservedAt, f.f.payload.validUntil));
            f.journal().applyPresentationAction(f.principal, f.presentation, action, time);
            assertEquals(2, f.events()); assertFalse(f.record().isNull(action + "_event_id"));
            assertTrue(ProviderWireJson.same(time.json(), f.f.r.f.read(ProviderEnvelopeCrypto.Domain.EVENT, f.record().getString(action + "_event_id")).getJSONObject("original_observation")));
        }
    }
    @Test public void originalOpenAckReplayAndExactReceiptsSurviveExpiryAndSamePrincipalRotation() throws Exception {
        for (boolean rotate : new boolean[]{false, true}) {
            Fixture f = new Fixture(); f.action("opened"); f.action("acknowledged");
            String opened = f.record().getString("opened_event_id"), ack = f.record().getString("acknowledged_event_id");
            NativeProviderJournal.EventBatch original = f.journal().pendingEvents(f.principal, 16);
            if (rotate) {
                f.journal().captureToken("synthetic-action-successor");
                NativeProviderJournal.Prepared next = f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app());
                f.journal().confirmRegistration(f.principal, next, NativeProviderRegistrationReceipt.validateResponse(next,
                    NativeProviderRegistrationReceiptTest.response(NativeProviderRegistrationReceiptTest.data(next, f.f.r.prepared.generationId, NativeProviderIngressTest.RETIRE))));
            }
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw); int commits = f.f.r.f.storage.memory.commits;
            for (NativeProviderJournal.Observation time : unavailableActionTimes(f)) for (String action : new String[]{"opened", "acknowledged"})
                f.journal().applyPresentationAction(f.principal, f.presentation, action, time);
            assertEquals(before, f.f.r.f.storage.memory.raw); assertEquals(commits, f.f.r.f.storage.memory.commits);
            NativeProviderJournal.EventBatch pending = f.journal().pendingEvents(f.principal, 16);
            assertArrayEquals(original.body(), pending.body()); assertEquals(3, pending.events.size());
            org.json.JSONArray exact = new org.json.JSONArray();
            for (NativeProviderJournal.PendingEvent event : pending.events.values()) {
                assertEquals(f.f.r.prepared.generationId, event.wire().getString("generation_id"));
                exact.put(NativeProviderEventReceiptsTest.receipt(event));
            }
            assertEquals(3, f.journal().settleEvents(f.principal, pending, NativeProviderEventReceipts.validateResponse(pending, NativeProviderEventReceiptsTest.response(exact))));
            assertTrue(f.journal().pendingEvents(f.principal, 16).events.isEmpty());
            assertEquals(opened, f.record().getString("opened_event_id")); assertEquals(ack, f.record().getString("acknowledged_event_id"));
            assertTrue(f.record().getBoolean("navigation_pending"));
        }
    }
    @Test public void uncertainActionCommitRetriesOriginalButUncommittedActionGetsNoLateAuthority() throws Exception {
        for (String action : new String[]{"opened", "acknowledged"}) for (boolean persisted : new boolean[]{false, true}) {
            Fixture f = new Fixture(); Map<String, Object> original = new HashMap<>(f.f.r.f.storage.memory.raw);
            f.f.r.f.storage.memory.reject = !persisted; f.f.r.f.storage.memory.persistThenReject = persisted;
            ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> f.action(action));
            f.f.r.f.storage.memory.reject = false; f.f.r.f.storage.memory.persistThenReject = false;
            if (!persisted) assertEquals(original, f.f.r.f.storage.memory.raw);
            Map<String, Object> beforeRetry = new HashMap<>(f.f.r.f.storage.memory.raw); int commits = f.f.r.f.storage.memory.commits;
            for (NativeProviderJournal.Observation time : unavailableActionTimes(f)) {
                if (persisted) f.journal().applyPresentationAction(f.principal, f.presentation, action, time);
                else ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable", () -> f.journal().applyPresentationAction(f.principal, f.presentation, action, time));
                assertEquals(beforeRetry, f.f.r.f.storage.memory.raw); assertEquals(commits, f.f.r.f.storage.memory.commits);
            }
            assertEquals(persisted ? 2 : 1, f.events());
        }
    }
    @Test public void oneOriginalActionDoesNotAuthorizeDifferentNewActionAfterExpiry() throws Exception {
        for (String original : new String[]{"opened", "acknowledged"}) {
            Fixture f = new Fixture(); f.action(original); String other = "opened".equals(original) ? "acknowledged" : "opened";
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
            for (NativeProviderJournal.Observation time : unavailableActionTimes(f))
                ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable", () -> f.journal().applyPresentationAction(f.principal, f.presentation, other, time));
            assertEquals(before, f.f.r.f.storage.memory.raw); assertEquals(2, f.events()); assertTrue(f.record().isNull(other + "_event_id"));
        }
    }
    @Test public void originalEventIdempotencyNeverBypassesRemovalOrRetiredClaimFence() throws Exception {
        for (String action : new String[]{"opened", "acknowledged"}) for (boolean removed : new boolean[]{false, true}) {
            Fixture f = new Fixture(); f.action(action);
            if (removed) f.journal().observeRemoved(); else { f.journal().observeUnavailable(); f.journal().observeActivePrincipal(f.principal); }
            Map<String, Object> before = new HashMap<>(f.f.r.f.storage.memory.raw);
            NativeProviderJournal.Observation unknown = NativeProviderIngressTest.observation(null, 500, 7);
            ProviderRecordStoreTest.failure(removed ? "custodial_provider_waiting_native_principal" : "custodial_provider_operation_stale",
                () -> f.journal().applyPresentationAction(f.principal, f.presentation, action, unknown));
            assertEquals(before, f.f.r.f.storage.memory.raw);
        }
    }
    @Test public void openAckAreDistinctAtomicEventsAndIdempotentWithoutCleanBaselineMutation() throws Exception {
        Fixture f = new Fixture(); JSONObject payload = f.record().getJSONObject("payload"); int before = f.f.r.f.storage.memory.commits;
        f.action("opened"); assertEquals(before + 1, f.f.r.f.storage.memory.commits); assertTrue(f.record().getBoolean("navigation_pending"));
        assertTrue(f.record().getBoolean("os_cancel_pending")); String opened = f.record().getString("opened_event_id");
        f.action("acknowledged"); String ack = f.record().getString("acknowledged_event_id"); assertNotEquals(opened, ack); assertEquals(3, f.events());
        before = f.f.r.f.storage.memory.commits; f.action("opened"); f.action("acknowledged"); assertEquals(before, f.f.r.f.storage.memory.commits);
        assertTrue(ProviderWireJson.same(payload, f.record().getJSONObject("payload")));
        f.action("navigation_completed"); assertFalse(f.record().getBoolean("navigation_pending")); f.action("opened");
        assertFalse(f.record().getBoolean("navigation_pending")); assertEquals(3, f.events());
    }
    @Test public void dismissIsLocalOnlyAndDoesNotStopAnAlreadyStartedTwoCyclePresentation() throws Exception {
        Fixture f = new Fixture(); f.action("displayed"); f.action("audio_started");
        f.journal().applyPresentationAction(f.principal, f.presentation, "dismissed", NativeProviderIngressTest.observation(null, 500, 7));
        assertTrue(f.record().getBoolean("card_dismissed")); assertEquals("IN_PROGRESS", f.record().getString("audio_state"));
        assertEquals(2, f.events()); f.action("audio_completed"); assertEquals("COMPLETED", f.record().getString("audio_state"));
        assertTrue(f.record().isNull("acknowledged_event_id")); assertEquals(2, f.events());
    }
    @Test public void arbitraryActionsAndAudioCompletionWithoutStartNeverChangeRecord() throws Exception {
        Fixture f = new Fixture(); Map<String, Object> original = new HashMap<>(f.f.r.f.storage.memory.raw);
        for (String action : new String[]{"received", "sent", "server_accepted", "clear", "inspected", "audio_completed", "navigation_completed", "open", "", "DISPLAYED"}) {
            ProviderRecordStoreTest.failure("custodial_provider_action_invalid", () -> f.action(action)); assertEquals(action, original, f.f.r.f.storage.memory.raw);
        }
    }
    @Test public void removalRetainsExactCancellationIntentsAndOldDisplayCallbacksCannotAffectSuccessor() throws Exception {
        Fixture f = new Fixture(); NativeProviderJournal.OsDisplayIntent intent = f.journal().prepareOsDisplay(f.principal, f.presentation, observed());
        f.journal().observeRemoved(); NativeProviderJournal.OsCancellation cancellation = f.journal().pendingOsCancellations().get(0);
        ProviderRecordStoreTest.failure("custodial_provider_waiting_native_principal", () -> f.journal().confirmOsDisplayed(f.principal, intent, observed()));
        f.journal().confirmOsCanceled(cancellation); assertTrue(f.journal().pendingOsCancellations().isEmpty());
        assertEquals("REVOKED_OR_FOREIGN", f.record().getString("authority_state")); assertEquals(1, f.events());
    }
    @Test public void oldCancellationReadbackCannotConsumeNewCancellationSequence() throws Exception {
        Fixture f = new Fixture(); f.journal().requestOsCancellation(f.principal, f.presentation);
        NativeProviderJournal.OsCancellation old = f.journal().pendingOsCancellations().get(0); f.journal().confirmOsCanceled(old);
        f.journal().prepareOsDisplay(f.principal, f.presentation, observed()); f.journal().requestOsCancellation(f.principal, f.presentation);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> f.journal().confirmOsCanceled(old));
        assertEquals(1, f.journal().pendingOsCancellations().size());
    }
    @Test public void processDeathAndAttachmentReplacementNeverReviveClaimsOrOriginalCallbacks() throws Exception {
        Fixture f = new Fixture(); Object owner = new Object(), nextOwner = new Object(); NativeProviderClaims claims = new NativeProviderClaims(f.journal()); claims.attach(owner);
        NativeProviderClaims.Claim first = claims.claimNext(owner, f.principal, observed()); assertNotNull(first); assertNull(claims.claimNext(owner, f.principal, observed()));
        JSONObject exposed = first.data(); exposed.getJSONObject("payload").put("body", "modified browser buffer");
        assertNotEquals("modified browser buffer", first.data().getJSONObject("payload").getString("body"));
        assertFalse(first.data().has("principal")); assertFalse(first.data().has("installation_seal"));
        claims.detach(owner); ProviderRecordStoreTest.failure("custodial_provider_claim_invalid", () -> claims.apply(owner, f.principal, first.id, "opened", observed()));
        NativeProviderClaims restarted = new NativeProviderClaims(f.journal()); restarted.attach(nextOwner);
        assertFalse(restarted.isCurrent(nextOwner, f.principal, first.id)); NativeProviderClaims.Claim next = restarted.claimNext(nextOwner, f.principal, observed());
        assertNotEquals(first.id, next.id); assertEquals(first.presentation.payload.recordId, next.presentation.payload.recordId);
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid", () -> restarted.apply(nextOwner, f.principal, "made-up-claim", "opened", observed()));
    }
    @Test public void unavailableThenSamePrincipalKeepsRecordButRetiresCallbackPermanently() throws Exception {
        Fixture f = new Fixture(); Object owner = new Object(); NativeProviderClaims claims = new NativeProviderClaims(f.journal()); claims.attach(owner);
        NativeProviderClaims.Claim first = claims.claimNext(owner, f.principal, observed()); f.journal().observeUnavailable(); f.journal().observeActivePrincipal(f.principal);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale", () -> claims.apply(owner, f.principal, first.id, "opened", observed()));
        NativeProviderClaims.Claim next = claims.claimNext(owner, f.principal, observed()); assertNotEquals(first.id, next.id);
        assertFalse(claims.isCurrent(owner, f.principal, first.id)); assertTrue(f.record().isNull("opened_event_id"));
    }
    @Test public void retiredVisualClaimAllowsOnlyOneAudioCompletionAndNoOpenAckOrDisplay() throws Exception {
        Fixture f = new Fixture(); Object owner = new Object(); NativeProviderClaims claims = new NativeProviderClaims(f.journal()); claims.attach(owner);
        NativeProviderClaims.Claim claim = claims.claimNext(owner, f.principal, observed());
        claims.apply(owner, f.principal, claim.id, "displayed", observed()); claims.apply(owner, f.principal, claim.id, "audio_started", observed());
        claims.apply(owner, f.principal, claim.id, "dismissed", observed()); claims.retire(owner, f.principal, claim.id); assertFalse(claims.isCurrent(owner, f.principal, claim.id));
        for (String action : new String[]{"opened", "acknowledged", "displayed", "navigation_completed", "audio_started"})
            ProviderRecordStoreTest.failure("custodial_provider_claim_invalid", () -> claims.apply(owner, f.principal, claim.id, action, observed()));
        claims.apply(owner, f.principal, claim.id, "audio_completed", observed());
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid", () -> claims.apply(owner, f.principal, claim.id, "audio_completed", observed()));
        assertEquals(2, f.events()); assertNull(claims.claimNext(owner, f.principal, observed()));
    }
    @Test public void audioCompletedIsDurableWhileUnhandledVisualSurvivesRebind() throws Exception {
        Fixture f = new Fixture(); Object owner = new Object(); NativeProviderClaims claims = new NativeProviderClaims(f.journal()); claims.attach(owner);
        NativeProviderClaims.Claim claim = claims.claimNext(owner, f.principal, observed()); claims.apply(owner, f.principal, claim.id, "displayed", observed());
        claims.apply(owner, f.principal, claim.id, "audio_started", observed()); claims.apply(owner, f.principal, claim.id, "audio_completed", observed());
        claims.detach(owner); claims.attach(owner); NativeProviderClaims.Claim restored=claims.claimNext(owner, f.principal, observed());
        assertNotNull(restored);assertFalse(restored.data().getBoolean("play_audio"));
        claims.detach(owner);claims.attach(owner);
        // Actual OS Open after prior completed presentation creates durable local navigation, without another audio round.
        f.action("opened"); NativeProviderClaims.Claim navigation = claims.claimNext(owner, f.principal, observed());
        assertNotNull(navigation); assertTrue(navigation.data().getBoolean("navigation_pending")); assertFalse(navigation.data().getBoolean("play_audio"));
    }
}
