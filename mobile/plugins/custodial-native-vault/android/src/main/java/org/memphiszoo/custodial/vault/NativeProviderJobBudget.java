package org.memphiszoo.custodial.vault;

/** One invocation's monotonic limits. System JobService still owns cancellation timer,
 * executor, network disconnect and exactly-once jobFinished; this is not a background loop. */
final class NativeProviderJobBudget {
    interface Clock { long elapsed(); }
    static final int MAX_OPERATIONS = 32, MAX_INVENTORY_PAGES = 8, MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    static final long MAX_MILLIS = 45000;
    private final Clock clock;
    private final long start;
    private int operations, pages, bytes;
    private boolean canceled;
    NativeProviderJobBudget(Clock clock) throws VaultFailure {
        this.clock = clock; start = clock.elapsed(); if (start < 0 || start > Long.MAX_VALUE - MAX_MILLIS) throw invalid();
    }
    synchronized void cancel() { canceled = true; }
    synchronized long remainingMillis() throws VaultFailure {
        long now = clock.elapsed();
        if (canceled || now < start || now - start >= MAX_MILLIS) throw invalid();
        return MAX_MILLIS - (now - start);
    }
    synchronized void beforeNetwork(boolean inventory) throws VaultFailure {
        remainingMillis();
        if (operations >= MAX_OPERATIONS || bytes >= MAX_RESPONSE_BYTES || (inventory && pages >= MAX_INVENTORY_PAGES)) throw invalid();
        operations++; if (inventory) pages++;
    }
    synchronized int responseAllowance() throws VaultFailure {
        remainingMillis(); return Math.min(NativeProviderHttp.MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES - bytes);
    }
    synchronized void received(int count) throws VaultFailure {
        remainingMillis(); if (count < 0 || count > MAX_RESPONSE_BYTES - bytes) throw invalid(); bytes += count;
    }
    synchronized int operations() { return operations; }
    synchronized int pages() { return pages; }
    synchronized int bytes() { return bytes; }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_job_budget_exhausted"); }
}
