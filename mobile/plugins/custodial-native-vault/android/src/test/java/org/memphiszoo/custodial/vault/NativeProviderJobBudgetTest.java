package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderJobBudgetTest {
    static final String LIMIT = "custodial_provider_job_budget_exhausted";
    static final class Clock implements NativeProviderJobBudget.Clock { long time = 100; public long elapsed() { return time; } }
    @Test public void exactOperationPageByteAndMonotonicCapsAreIndependent() throws Exception {
        Clock clock = new Clock(); NativeProviderJobBudget budget = new NativeProviderJobBudget(clock);
        for (int i = 0; i < 8; i++) budget.beforeNetwork(true);
        ProviderRecordStoreTest.failure(LIMIT, () -> budget.beforeNetwork(true));
        for (int i = 8; i < 32; i++) budget.beforeNetwork(false);
        ProviderRecordStoreTest.failure(LIMIT, () -> budget.beforeNetwork(false)); assertEquals(32, budget.operations()); assertEquals(8, budget.pages());
        NativeProviderJobBudget bytes = new NativeProviderJobBudget(clock); bytes.received(2 * 1024 * 1024);
        assertEquals(0, bytes.responseAllowance()); ProviderRecordStoreTest.failure(LIMIT, () -> bytes.beforeNetwork(false));
        ProviderRecordStoreTest.failure(LIMIT, () -> bytes.received(1)); ProviderRecordStoreTest.failure(LIMIT, () -> bytes.received(-1));
        assertEquals(2 * 1024 * 1024, bytes.bytes());
    }
    @Test public void wallClockIsUnusedAndRollbackDeadlineCancellationOverflowCannotExtendRun() throws Exception {
        Clock clock = new Clock(); NativeProviderJobBudget budget = new NativeProviderJobBudget(clock);
        clock.time += 44999; assertEquals(1, budget.remainingMillis()); clock.time++;
        ProviderRecordStoreTest.failure(LIMIT, budget::remainingMillis); clock.time = 99; ProviderRecordStoreTest.failure(LIMIT, budget::remainingMillis);
        Clock stable = new Clock(); NativeProviderJobBudget canceled = new NativeProviderJobBudget(stable); canceled.cancel();
        ProviderRecordStoreTest.failure(LIMIT, () -> canceled.beforeNetwork(false));
        ProviderRecordStoreTest.failure(LIMIT, () -> new NativeProviderJobBudget(() -> Long.MAX_VALUE));
        ProviderRecordStoreTest.failure(LIMIT, () -> new NativeProviderJobBudget(() -> -1));
    }
    @Test public void actualHttpAdapterStopsBeforeOpeningThirtyThirdAttemptAndLeavesRegistrationPending() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); Clock clock = new Clock();
        NativeProviderJobBudget budget = new NativeProviderJobBudget(clock); NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt(budget);
        NativeProviderHttp http = new NativeProviderHttp(url -> {
            f.opened++; f.connection = new NativeProviderHttpTest.Connection(url, new byte[0]); f.connection.timeout = true; return f.connection;
        }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID);
        for (int i = 0; i < 32; i++) ProviderRecordStoreTest.failure("custodial_provider_network_unavailable", () ->
            f.engine.registerNativeProvider(f.prepared, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, false));
        ProviderRecordStoreTest.failure(LIMIT, () -> f.engine.registerNativeProvider(f.prepared, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, false));
        assertEquals(32, f.opened); assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
    }
    @Test public void actualResponseReadsAreChargedAndCannotSettleOversizedOrExhaustedAttempt() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); Clock clock = new Clock();
        NativeProviderJobBudget budget = new NativeProviderJobBudget(clock); NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt(budget);
        NativeProviderHttp http = new NativeProviderHttp(url -> {
            f.opened++; f.connection = new NativeProviderHttpTest.Connection(url, new byte[262144]); return f.connection;
        }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID);
        for (int i = 0; i < 8; i++) ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () ->
            f.engine.registerNativeProvider(f.prepared, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, false));
        assertEquals(2 * 1024 * 1024, budget.bytes());
        ProviderRecordStoreTest.failure(LIMIT, () -> f.engine.registerNativeProvider(f.prepared, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, false));
        assertEquals(8, f.opened); assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
    }
    @Test public void httpTimeoutsShrinkToRemainingRunAndLateResponseNeverConfirms() throws Exception {
        NativeProviderHttpTest.Fixture f = new NativeProviderHttpTest.Fixture(false); Clock clock = new Clock();
        NativeProviderJobBudget budget = new NativeProviderJobBudget(clock); clock.time += 44000;
        NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt(budget); byte[] response = f.response();
        NativeProviderHttp http = new NativeProviderHttp(url -> {
            f.connection = new NativeProviderHttpTest.Connection(url, response); f.connection.onResponse = () -> clock.time += 1000; return f.connection;
        }, () -> NativeProviderHttpTest.NOW, () -> NativeProviderHttpTest.RID);
        ProviderRecordStoreTest.failure(LIMIT, () -> f.engine.registerNativeProvider(f.prepared, f.principalJournal, f.legacyJournal, f.provider.journal(), http, attempt, false));
        assertEquals(1000, f.connection.getConnectTimeout()); assertEquals(1000, f.connection.getReadTimeout()); assertTrue(f.connection.disconnects > 0);
        assertFalse(f.provider.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
    }
    @Test public void cancelFencesBudgetAndConnectionTogether() throws Exception {
        Clock clock = new Clock(); NativeProviderJobBudget budget = new NativeProviderJobBudget(clock);
        NativeProviderHttp.Attempt attempt = new NativeProviderHttp.Attempt(budget); attempt.cancel();
        ProviderRecordStoreTest.failure("custodial_provider_network_canceled", attempt::check);
        ProviderRecordStoreTest.failure(LIMIT, () -> budget.beforeNetwork(false));
    }
}
