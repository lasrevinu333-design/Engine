package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.List;
import java.net.URL;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderJobLifecycleTest {
    static final class Effects implements NativeProviderJobLifecycle.Effects {
        final List<Object> released = new ArrayList<>(), finished = new ArrayList<>();
        final List<Boolean> retry = new ArrayList<>();
        boolean failRelease;
        public void release(Object owner) { released.add(owner); if (failRelease) throw new IllegalStateException("synthetic cleanup failure"); }
        public void finished(Object owner, boolean needsRetry) { finished.add(owner); retry.add(needsRetry); }
    }
    @Test public void completionFencesBeforeReleaseAndFinishesExactInvocationOnce() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        Object owner = new Object(); NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(owner, () -> 100);
        assertTrue(lifecycle.owns(invocation)); assertTrue(lifecycle.complete(invocation, NativeProviderJobLifecycle.Result.DRAINED));
        assertFalse(lifecycle.owns(invocation)); assertFalse(lifecycle.complete(invocation, NativeProviderJobLifecycle.Result.RETRY));
        assertFalse(lifecycle.deadline(invocation)); assertEquals(1, effects.released.size()); assertEquals(1, effects.finished.size());
        assertSame(owner, effects.finished.get(0)); assertFalse(effects.retry.get(0));
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", invocation.attempt::check);
    }
    @Test public void stoppedWorkerAndLateTimerCannotFinishOrCancelSuccessor() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        Object old = new Object(), current = new Object(); NativeProviderJobLifecycle.Invocation first = lifecycle.begin(old, () -> 100);
        assertTrue(lifecycle.stop(old, NativeProviderJobLifecycle.Result.RETRY)); assertTrue(effects.finished.isEmpty());
        NativeProviderJobLifecycle.Invocation second = lifecycle.begin(current, () -> 200);
        assertFalse(lifecycle.complete(first, NativeProviderJobLifecycle.Result.DRAINED)); assertFalse(lifecycle.deadline(first));
        assertFalse(lifecycle.stop(old, NativeProviderJobLifecycle.Result.RETRY)); second.attempt.check(); assertTrue(lifecycle.owns(second));
        assertTrue(lifecycle.complete(second, NativeProviderJobLifecycle.Result.RETRY)); assertEquals(1, effects.finished.size());
        assertSame(current, effects.finished.get(0)); assertTrue(effects.retry.get(0));
    }
    @Test public void deadlineDisconnectsActualHttpAttemptThenRequestsSystemBackoff() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(new Object(), () -> 100);
        NativeProviderHttpTest.Connection connection = new NativeProviderHttpTest.Connection(new URL("https://example.invalid/"), new byte[0]);
        invocation.attempt.attach(connection); assertTrue(lifecycle.deadline(invocation));
        assertEquals(1, connection.disconnects); assertTrue(effects.retry.get(0));
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", invocation.attempt::check);
        assertFalse(lifecycle.deadline(invocation)); assertEquals(1, connection.disconnects);
    }
    @Test public void suspendedOrDrainedWorkDoesNotRetryOnSystemStop() throws Exception {
        for (NativeProviderJobLifecycle.Result result : new NativeProviderJobLifecycle.Result[]{NativeProviderJobLifecycle.Result.DRAINED, NativeProviderJobLifecycle.Result.SUSPEND}) {
            Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects); Object owner = new Object();
            lifecycle.begin(owner, () -> 100); assertFalse(lifecycle.stop(owner, result)); assertTrue(effects.finished.isEmpty());
            assertEquals(1, effects.released.size()); lifecycle.destroy(); assertEquals(1, effects.released.size());
        }
    }
    @Test public void unknownCompletionCannotPretendDrainedAndParallelStartIsRejected() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(new Object(), () -> 100);
        assertFalse(lifecycle.complete(invocation, null)); assertTrue(lifecycle.owns(invocation));
        ProviderRecordStoreTest.failure("custodial_provider_job_already_active", () -> lifecycle.begin(new Object(), () -> 100));
        lifecycle.destroy(); assertTrue(effects.finished.isEmpty()); assertEquals(1, effects.released.size());
    }
    @Test public void releaseFailureCannotLeaveLiveAuthorityOrCauseDoubleFinish() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(new Object(), () -> 100); effects.failRelease = true;
        try { lifecycle.complete(invocation, NativeProviderJobLifecycle.Result.RETRY); fail(); }
        catch (IllegalStateException expected) { assertEquals("synthetic cleanup failure", expected.getMessage()); }
        assertFalse(lifecycle.owns(invocation)); assertEquals(1, effects.finished.size()); assertFalse(lifecycle.deadline(invocation));
    }
    static final class Jobs implements NativeProviderJobSchedule.SystemJobs {
        NativeProviderJobSchedule.Existing state = NativeProviderJobSchedule.Existing.ABSENT;
        boolean accepted = true; int inspected, scheduled;
        public NativeProviderJobSchedule.Existing existing() { inspected++; return state; }
        public boolean schedule() { scheduled++; if (accepted) state = NativeProviderJobSchedule.Existing.EXACT; return accepted; }
    }
    @Test public void repeatedWakeupsDoNotReplacePendingJobOrEraseItsBackoff() throws Exception {
        Jobs jobs = new Jobs(); assertEquals(NativeProviderJobSchedule.Outcome.SCHEDULED, NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY, jobs));
        for (int i = 0; i < 20; i++) assertEquals(NativeProviderJobSchedule.Outcome.ALREADY_SCHEDULED,
            NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY, jobs));
        assertEquals(1, jobs.scheduled);
    }
    @Test public void quotaFailurePreservesPendingClassificationAndPermitsLaterWakeup() throws Exception {
        Jobs jobs = new Jobs(); jobs.accepted = false;
        assertEquals(NativeProviderJobSchedule.Outcome.REJECTED, NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY, jobs));
        assertEquals(NativeProviderJobSchedule.Existing.ABSENT, jobs.state); jobs.accepted = true;
        assertEquals(NativeProviderJobSchedule.Outcome.SCHEDULED, NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY, jobs));
    }
    @Test public void conflictUnknownCorruptionAndQuietWorkCannotCreateReplacementJobs() throws Exception {
        Jobs jobs = new Jobs(); jobs.state = NativeProviderJobSchedule.Existing.CONFLICT;
        ProviderRecordStoreTest.failure("custodial_provider_job_identity_conflict", () -> NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY, jobs));
        ProviderRecordStoreTest.failure("custodial_provider_job_work_unknown", () -> NativeProviderJobSchedule.request(null, jobs));
        assertEquals(NativeProviderJobSchedule.Outcome.QUIET, NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.SUSPEND, jobs));
        assertEquals(NativeProviderJobSchedule.Outcome.QUIET, NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.DRAINED, jobs));
        assertEquals(0, jobs.scheduled); assertEquals(1, jobs.inspected);
    }
    @Test public void identityUsesActualParameterObjectNotAttackerControlledEquality() throws Exception {
        Effects effects = new Effects(); NativeProviderJobLifecycle lifecycle = new NativeProviderJobLifecycle(effects);
        Object owner = new Object(), lookalike = new Object() { @Override public boolean equals(Object ignored) { return true; } };
        NativeProviderJobLifecycle.Invocation invocation = lifecycle.begin(owner, () -> 100);
        assertFalse(lifecycle.stop(lookalike, NativeProviderJobLifecycle.Result.RETRY)); assertTrue(lifecycle.owns(invocation));
        lifecycle.destroy(); assertTrue(effects.finished.isEmpty());
    }
}
