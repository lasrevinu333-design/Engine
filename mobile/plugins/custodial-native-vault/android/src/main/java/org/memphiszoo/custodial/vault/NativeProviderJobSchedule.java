package org.memphiszoo.custodial.vault;

/** Does not replace an existing pending/running system job or erase its backoff. */
final class NativeProviderJobSchedule {
    static final int ID = 0x4D5A5001;
    static final String COMPONENT = "org.memphiszoo.custodial.vault.CustodialProviderSyncJobService";
    enum Existing { ABSENT, EXACT, CONFLICT }
    enum Outcome { QUIET, ALREADY_SCHEDULED, SCHEDULED, REJECTED }
    interface SystemJobs {
        Existing existing();
        boolean schedule();
    }
    static Outcome request(NativeProviderJobLifecycle.Result durableWork, SystemJobs jobs) throws VaultFailure {
        if (durableWork == null) throw new VaultFailure("custodial_provider_job_work_unknown");
        if (durableWork != NativeProviderJobLifecycle.Result.RETRY) return Outcome.QUIET;
        synchronized (jobs) {
            Existing existing = jobs.existing();
            if (existing == Existing.EXACT) return Outcome.ALREADY_SCHEDULED;
            if (existing != Existing.ABSENT) throw new VaultFailure("custodial_provider_job_identity_conflict");
            return jobs.schedule() ? Outcome.SCHEDULED : Outcome.REJECTED;
        }
    }
    private NativeProviderJobSchedule() {}
}
