package org.memphiszoo.custodial.vault;

/** Conditional native-only provider time owner. No default profile, no WebView
 * setter, no cleaning anchor and no authority from a server profile identifier.
 * Construction does not activate a factory. All callers use engine -> coordinator. */
final class NativeProviderClockOwner {
    private final VaultEngine engine;
    private final Object coordinator;
    private final NativeProviderJournal journal;
    private final NativeProviderAuthority authority;
    private final NativeProviderTime.Profiles profiles;
    private final NativeProviderTime.Platform platform;
    private final NativeProviderClockExchange.Readings readings;
    NativeProviderClockOwner(VaultEngine engine,Object coordinator,NativeProviderJournal journal,
        NativePrincipalJournal principals,NativeLegacyLineageJournal legacy,NativeProviderTime.Profiles profiles,
        NativeProviderTime.Platform platform,NativeProviderClockExchange.Readings readings) {
        if(engine==null||coordinator==null||journal==null||principals==null||legacy==null||profiles==null||platform==null||readings==null)
            throw new IllegalArgumentException("provider_clock_dependencies_required");
        this.engine=engine;this.coordinator=coordinator;this.journal=journal;this.profiles=profiles;this.platform=platform;this.readings=readings;
        authority=new NativeProviderAuthority(engine,principals,legacy,journal,coordinator);
    }
    /** Feed the exact result of registerWithClock/status after HTTP settles. Lost
     * responses cannot make a sample; a retry uses a fresh nonce and original registration. */
    boolean accept(NativeProviderClockExchange.Settlement result) throws VaultFailure {
        synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=authority.reconcile();
            if(result==null||current.principal==null||current.revision!=result.engineRevision
                ||!current.principal.digest.equals(result.principalDigest))throw stale();
            return journal.acceptClock(current.principal,current.revision,result.registration,result.providerEpoch,
                result.unqualifiedClock,profiles.select(platform),platform,readings.read());
        }}
    }
    NativeProviderJournal.Observation observe() throws VaultFailure {
        synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=authority.reconcile();
            NativeProviderClockExchange.Point point=readings.read();
            if(current.principal==null)return new NativeProviderJournal.Observation(null,point.elapsedMillis,point.bootCount);
            return journal.clockObservation(current.principal,current.revision,profiles.select(platform),platform,point);
        }}
    }
    /** Engine-only inventory settlement. Check ownership as well as full current
     * principal/revision; no caller-supplied profile or observation is accepted. */
    NativeProviderJournal.Observation inventory(VaultEngine expected,NativeProviderJournal expectedJournal,
        NativeProviderPrincipal principal,long revision,long epoch,NativeProviderClockExchange.Unqualified sample) throws VaultFailure {
        if(expected!=engine||expectedJournal!=journal||!Thread.holdsLock(engine))throw stale();
        synchronized(coordinator){
            NativeProviderAuthority.Current current=authority.reconcile();
            if(current.principal==null||!principal.same(current.principal)||current.revision!=revision)throw stale();
            NativeProviderTime.Profile profile=profiles.select(platform); NativeProviderClockExchange.Point point=readings.read();
            journal.acceptClock(principal,revision,journal.currentClockGeneration(principal),epoch,sample,profile,platform,point);
            return journal.clockObservation(principal,revision,profile,platform,point);
        }
    }
    private static VaultFailure stale(){return new VaultFailure("custodial_provider_clock_operation_stale");}
}
