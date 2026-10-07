package org.memphiszoo.custodial.vault;

/** One application-owned conditional composition; no activation switch. Exact same
 * engine/journal/claims own local removal, typed transports and native effects.
 * Missing native profile suspends before token/network/new presentation. */
final class NativeProviderRuntimeOwner implements NativeProviderRemovalCoordinator.Fence,
    NativeProviderComponentRuntime, NativeProviderIngressRuntime {
    interface Tokens { void refresh(NativeProviderRegistrationCoordinator registration, NativeProviderHttp.Attempt attempt) throws VaultFailure; }
    static final class Delivery {
        final NativeProviderTime.Profiles profiles;
        final NativeProviderTime.Platform platform;
        final NativeProviderClockExchange.Readings readings;
        final NativeProviderRegistrationCoordinator.AppIdentity app;
        final NativeProviderHttp http;
        final NativeProviderJobSchedule.SystemJobs jobs;
        final Tokens tokens;
        Delivery(NativeProviderTime.Profiles profiles,NativeProviderTime.Platform platform,NativeProviderClockExchange.Readings readings,
            NativeProviderRegistrationCoordinator.AppIdentity app,NativeProviderHttp http,NativeProviderJobSchedule.SystemJobs jobs,Tokens tokens) {
            if(profiles==null||platform==null||readings==null||app==null||http==null||jobs==null||tokens==null)
                throw new IllegalArgumentException("provider_delivery_dependencies_required");
            this.profiles=profiles;this.platform=platform;this.readings=readings;this.app=app;this.http=http;this.jobs=jobs;this.tokens=tokens;
        }
    }
    private final VaultEngine engine;
    private final Object coordinator;
    private final NativeProviderAuthority authority;
    private final NativeProviderJournal journal;
    private final NativeProviderClaims claims;
    private final NativeProviderDisplayDriver display;
    private final NativePrincipalJournal principals;
    private final NativeLegacyLineageJournal legacy;
    private final Delivery delivery;
    private final NativeProviderClockOwner clock;
    private final NativeProviderRegistrationCoordinator registration;
    private final java.util.concurrent.atomic.AtomicBoolean synchronizing = new java.util.concurrent.atomic.AtomicBoolean();
    private NativeProviderAuthority.Current last;
    private NativeProviderMirrorAttachment mirror;
    private final String mirrorIncarnation=java.util.UUID.randomUUID().toString();

    NativeProviderRuntimeOwner(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator, NativeProviderDisplayDriver.Surface surface) {
        this(engine,principals,legacy,journal,coordinator,surface,null);
    }
    NativeProviderRuntimeOwner(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator, NativeProviderDisplayDriver.Surface surface, Delivery delivery) {
        if (surface == null) throw new IllegalArgumentException("provider_local_surface_required");
        this.engine = engine; this.coordinator = coordinator; this.journal = journal;
        this.principals=principals;this.legacy=legacy;this.delivery=delivery;
        authority = new NativeProviderAuthority(engine, principals, legacy, journal, coordinator);
        claims = new NativeProviderClaims(journal); display = new NativeProviderDisplayDriver(journal, surface);
        clock=delivery==null?null:new NativeProviderClockOwner(engine,coordinator,journal,principals,legacy,delivery.profiles,delivery.platform,delivery.readings);
        registration=delivery==null?null:new NativeProviderRegistrationCoordinator(engine,principals,legacy,journal,coordinator,delivery.app,()->{
            NativeProviderClockExchange.Point point=delivery.readings.read();
            return new NativeProviderJournal.Observation(null,point.elapsedMillis,point.bootCount);
        },delivery.http,delivery.jobs);
    }
    @Override public void reconcile() throws VaultFailure {
        try{synchronized (engine) { synchronized (coordinator) { reconcileLocked(); } }}finally{publishMirrorHint();}
    }
    private NativeProviderAuthority.Current reconcileLocked() throws VaultFailure {
        try {
            NativeProviderAuthority.Current current = authority.reconcile();
            if (current.principal == null || last == null || last.principal == null || !last.principal.same(current.principal)
                || last.revision != current.revision) {claims.invalidate();invalidateMirrorLocked();}
            last = current; return current;
        } catch (VaultFailure | RuntimeException failure) { claims.invalidate();invalidateMirrorLocked(); last = null; throw failure; }
    }
    /** Bounded cancellation only AFTER the durable fence readback. Failure retains
     * exact cancellation intents and ciphertext; it never becomes global cancelAll. */
    boolean reconcileLocalEffects() throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            reconcileLocked(); display.cancelPending(32);
            return journal.pendingOsCancellations().isEmpty();
        } }
    }
    void attach(Object attachment) throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) { invalidateMirrorLocked();reconcileLocked(); claims.attach(attachment); } }
    }
    void detach(Object attachment) {
        synchronized (engine) { synchronized (coordinator) {
            if(mirror!=null&&mirror.plugin==attachment)invalidateMirrorLocked();claims.detach(attachment);
        } }
    }
    private void invalidateMirrorLocked(){
        if(mirror!=null){NativeProviderMirrorAttachment old=mirror;mirror=null;old.invalidate();claims.detach(old.claimsOwner);
            try{old.publish(journal.presentationRevision());}catch(VaultFailure|RuntimeException unavailable){/* No hint is authority. */}}
    }
    private void publishMirrorHint(){
        synchronized(engine){synchronized(coordinator){if(mirror!=null)try{mirror.publish(journal.presentationRevision());}
            catch(VaultFailure|RuntimeException unavailable){/* Durable journal is recovered by bounded foreground pull. */}}}
    }
    java.util.Map<String,Object> mirrorAttach(Object plugin,NativeProviderMirrorAttachment.Hint hint)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){
            invalidateMirrorLocked();reconcileLocked();mirror=new NativeProviderMirrorAttachment(mirrorIncarnation,plugin,hint);claims.attach(mirror.claimsOwner);
            long revision=journal.presentationRevision();mirror.publish(revision);return mirror.snapshot(revision,supportedProfile());
        }}
    }
    private NativeProviderMirrorAttachment requireMirror(Object plugin,String id)throws VaultFailure{
        if(mirror==null)throw NativeProviderMirrorAttachment.invalid();mirror.require(plugin,id);return mirror;
    }
    void mirrorStopped(Object plugin,String id)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){requireMirror(plugin,id).stopped(plugin,id);}}
    }
    void mirrorDetach(Object plugin,String id)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){requireMirror(plugin,id);invalidateMirrorLocked();}}
    }
    org.json.JSONObject mirrorClaimNext(Object plugin,String id)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){NativeProviderMirrorAttachment attached=requireMirror(plugin,id);attached.requireReady(plugin,id);
            NativeProviderClaims.Claim claim=claimNext(attached.claimsOwner);try{return claim==null?null:claim.data();}
            catch(Exception invalid){throw new VaultFailure("custodial_provider_claim_invalid",invalid);}}}
    }
    org.json.JSONObject mirrorClaimState(Object plugin,String id,String claim)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){
            NativeProviderMirrorAttachment attached=requireMirror(plugin,id);claims.requireClaim(attached.claimsOwner,claim);
            requireDelivery();NativeProviderAuthority.Current current=reconcileLocked();
            if(current.principal==null){
                if("EMPTY".equals(current.phase)||"REMOVAL_REQUESTED".equals(current.phase)||"REMOVAL_TOMBSTONE".equals(current.phase))
                    return NativeProviderClaims.retiredState();
                throw new VaultFailure("custodial_provider_waiting_native_principal");
            }
            if(mirror!=attached)return NativeProviderClaims.retiredState(); // Existing exact native principal/revision fence.
            return claims.state(attached.claimsOwner,current.principal,claim,clock.observe());
        }}
    }
    void mirrorApply(Object plugin,String id,String claim,String action)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){NativeProviderMirrorAttachment attached=requireMirror(plugin,id);attached.requireReady(plugin,id);
            applyClaim(attached.claimsOwner,claim,action);}}
    }
    void mirrorRetire(Object plugin,String id,String claim)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){retireClaim(requireMirror(plugin,id).claimsOwner,claim);}}
    }
    /** Non-authoritative local status only. No principal/token/content or invented readiness. */
    java.util.Map<String, Object> localStatus() throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            NativeProviderAuthority.Current current = reconcileLocked();
            java.util.Map<String, Object> value = new java.util.LinkedHashMap<>();
            value.put("state", "SUSPENDED"); value.put("reason", "qualified_interval_effect_owner_required");
            value.put("native_principal_available", current.principal != null);
            value.put("pending_exact_cancellations", journal.pendingOsCancellations().size());
            value.put("last_local_failure",journal.lastLocalFailure(current.principal,current.revision));
            return value;
        } }
    }

    private boolean supportedProfile() {
        if(delivery==null)return false;
        try { NativeProviderTime.Profile p=delivery.profiles.select(delivery.platform);return p!=null&&p.matches(delivery.platform); }
        catch(RuntimeException unavailable){return false;}
    }
    private void requireDelivery() throws VaultFailure {
        if(!supportedProfile())throw new VaultFailure("custodial_provider_clock_unqualified");
    }
    private NativeProviderAuthority.Current currentLocked() throws VaultFailure {
        requireDelivery();
        NativeProviderAuthority.Current current=reconcileLocked();
        if(current.principal==null)throw new VaultFailure("custodial_provider_waiting_native_principal");return current;
    }
    @Override public NativeProviderJobLifecycle.Result pendingWork() {
        if(!supportedProfile())return NativeProviderJobLifecycle.Result.SUSPEND;
        try { synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=currentLocked();NativeProviderJournal.Work work=journal.pendingWork(current.principal);
            if(work.networkPending()||!work.quarantined.isEmpty())return NativeProviderJobLifecycle.Result.RETRY;
            return journal.pendingOsCancellations().isEmpty()?NativeProviderJobLifecycle.Result.DRAINED:NativeProviderJobLifecycle.Result.RETRY;
        }}} catch(VaultFailure|RuntimeException unavailable){return NativeProviderJobLifecycle.Result.SUSPEND;}
    }
    @Override public long captureToken(String token) throws VaultFailure { requireDelivery();return registration.captureToken(token); }
    @Override public void receive(NativeProviderPayload payload) throws VaultFailure {
        requireDelivery();
        synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=currentLocked();
            journal.recordArrival(current.principal,payload,clock.observe());
        }}
        NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY,delivery.jobs);
        publishMirrorHint();
    }
    @Override public void deletedMessages() throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){currentLocked();journal.requestRecovery();}}
    }
    @Override public void requestReconcile() throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){currentLocked();journal.requestRecovery();}}
        NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY,delivery.jobs);
    }
    /** One bounded pass, never a detached thread or polling loop. Every network
     * call receives the exact system invocation budget and neither monitor is held.
     * A next pass is the same persisted system job, not a second FCM attempt. */
    @Override public NativeProviderJobLifecycle.Result synchronize(NativeProviderJobLifecycle.Invocation invocation) throws VaultFailure {
        if(!supportedProfile())return NativeProviderJobLifecycle.Result.SUSPEND;
        if(invocation==null)throw new VaultFailure("custodial_provider_invocation_required");
        if(Thread.holdsLock(engine)||Thread.holdsLock(coordinator))throw new VaultFailure("custodial_provider_network_lock_held");
        if(!synchronizing.compareAndSet(false,true))return NativeProviderJobLifecycle.Result.RETRY;
        NativeProviderJournal.MaintenanceScope maintenance=null;
        try {
            invocation.attempt.check();
            synchronized(engine){synchronized(coordinator){
                NativeProviderAuthority.Current current=reconcileLocked();
                if(current.principal==null)return NativeProviderJobLifecycle.Result.SUSPEND;
                maintenance=journal.maintenanceScope(current.principal,current.revision);
            }}
            NativeProviderRegistrationCoordinator.ExchangeResult registered=registration.registerWithClock(invocation.attempt,false);
            requireDelivery();
            if(registered.status==NativeProviderRegistrationCoordinator.RegistrationResult.WAITING_NATIVE_TOKEN){
                invocation.attempt.beforeNetwork("native-firebase-token");delivery.tokens.refresh(registration,invocation.attempt);
                requireDelivery();
                registered=registration.registerWithClock(invocation.attempt,false);
            }
            if(registered.status==NativeProviderRegistrationCoordinator.RegistrationResult.WAITING_NATIVE_PRINCIPAL
                ||registered.status==NativeProviderRegistrationCoordinator.RegistrationResult.WAITING_NATIVE_TOKEN)return NativeProviderJobLifecycle.Result.SUSPEND;
            if(registered.status==NativeProviderRegistrationCoordinator.RegistrationResult.BUSY)return NativeProviderJobLifecycle.Result.RETRY;
            if(registered.settlement!=null)clock.accept(registered.settlement);
            if(clock.observe().bounds==null){
                registered=registration.registerWithClock(invocation.attempt,true);
                if(registered.settlement==null||!clock.accept(registered.settlement))return NativeProviderJobLifecycle.Result.SUSPEND;
            }
            NativeProviderInventory.Request inventory;
            synchronized(engine){synchronized(coordinator){
                NativeProviderAuthority.Current current=currentLocked();NativeProviderJournal.Work work=journal.pendingWork(current.principal);
                if(work.initialRecovery)journal.requestRecovery();
                inventory=journal.prepareInventory(current.principal);
            }}
            if(inventory!=null)engine.recoverNativeProviderInventory(inventory,principals,legacy,journal,delivery.http,invocation.attempt,clock);
            boolean quarantineWaiting=false;
            synchronized(engine){synchronized(coordinator){
                NativeProviderAuthority.Current current=currentLocked();
                java.util.List<String> pending=journal.pendingWork(current.principal).quarantined;
                // The encrypted inventory is already capped at 256. Inspect that
                // finite set without a restart-at-zero prefix limit: retained
                // expired rows must not starve a later valid original record.
                for(String id:pending){
                    invocation.attempt.check();currentLocked();
                    try { if(!"ADMITTED".equals(journal.drainQuarantine(current.principal,id,clock.observe()).state))quarantineWaiting=true; }
                    catch(VaultFailure expired){if(!"custodial_provider_payload_expired".equals(expired.code))throw expired;}
                }
            }}
            NativeProviderJournal.EventBatch batch;
            synchronized(engine){synchronized(coordinator){batch=journal.pendingEvents(currentLocked().principal,16);}}
            if(!batch.events.isEmpty()){requireDelivery();batch=engine.lookupNativeProviderEventDecisions(batch,principals,legacy,journal,delivery.http,invocation.attempt);}
            if(!batch.events.isEmpty()){requireDelivery();engine.sendNativeProviderEvents(batch,principals,legacy,journal,delivery.http,invocation.attempt);}
            synchronized(engine){synchronized(coordinator){
                NativeProviderAuthority.Current current=currentLocked();NativeProviderJournal.Observation now=clock.observe();
                display.cancelPending(32);int shown=0;
                for(String id:journal.admittedRecordIds(current.principal)){
                    if(shown==8)break;invocation.attempt.check();NativeProviderJournal.Presentation presentation=journal.presentation(current.principal,id);
                    if(NativeProviderTime.live(now.bounds,presentation.payload.reservedAt,presentation.payload.validUntil))
                        if(display.display(current.principal,presentation,()->{currentLocked();return clock.observe();}))shown++;
                }
                // Re-read after effects: an earlier display observation must not become
                // cleanup authority after its own horizon expires. Predicates stay in
                // the sole journal owner; no expiry guesses or uncertain-work eviction.
                invocation.attempt.check();current=currentLocked();NativeProviderJournal.Observation cleanup=clock.observe();
                if(cleanup.bounds!=null)journal.compactSettledRecords(current.principal,cleanup,16);
                NativeProviderJournal.Work remaining=journal.pendingWork(current.principal);
                return remaining.networkPending()||quarantineWaiting||!journal.pendingOsCancellations().isEmpty()
                    ?NativeProviderJobLifecycle.Result.RETRY:NativeProviderJobLifecycle.Result.DRAINED;
            }}
        } catch(VaultFailure|RuntimeException failure) {
            if(maintenance!=null)try{synchronized(engine){synchronized(coordinator){
                NativeProviderAuthority.Current current=reconcileLocked();
                journal.recordMaintenanceFailure(current.principal,current.revision,maintenance,NativeProviderFailureDisposition.of(failure));
            }}}catch(VaultFailure|RuntimeException unavailable){failure.addSuppressed(unavailable);}
            // Preserve the exact original failure and attempt. A diagnostic neither
            // fabricates remote revocation nor settles/suppresses pending work.
            throw failure;
        } finally { synchronizing.set(false); publishMirrorHint(); }
    }
    @Override public void applyAction(NativeProviderActionIntent action) throws VaultFailure {
        requireDelivery();if(action==null)throw new VaultFailure("custodial_provider_action_invalid");
        synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=currentLocked();
            journal.applyOsAction(current.principal,action.recordId,action.attemptId,action.action,clock.observe());
            if(!"opened".equals(action.action))display.cancelPending(32);
        }}
        // OpenActivity immediately calls openCommitted. Do not race a job's
        // cancellation against that exact durable Open -> same-app launch.
        if(!"opened".equals(action.action))NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY,delivery.jobs);
        publishMirrorHint();
    }
    @Override public void openCommitted(NativeProviderActionIntent action,Runnable launchMain) throws VaultFailure {
        requireDelivery();if(action==null||!"opened".equals(action.action)||launchMain==null)throw new VaultFailure("custodial_provider_action_invalid");
        synchronized(engine){synchronized(coordinator){
            NativeProviderAuthority.Current current=currentLocked();
            journal.applyOsAction(current.principal,action.recordId,action.attemptId,action.action,clock.observe());
            NativeProviderJournal.Presentation record=journal.presentation(current.principal,action.recordId);
            try { if(!record.record().getBoolean("navigation_pending"))throw new VaultFailure("custodial_provider_operation_stale"); }
            catch(VaultFailure stale){throw stale;}
            catch(Exception invalid){throw new VaultFailure("custodial_provider_action_invalid",invalid);}
            currentLocked();journal.requirePresentationCurrent(current.principal,record);launchMain.run();
            currentLocked();display.cancelPending(32);
        }}
        NativeProviderJobSchedule.request(NativeProviderJobLifecycle.Result.RETRY,delivery.jobs);
    }
    /** Native-only attachment contract; plugin/JS exports and foreground observer
     * wiring are a separate source gate. No caller-supplied payload/time/identity. */
    NativeProviderClaims.Claim claimNext(Object attachment) throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){
            return claims.claimNext(attachment,currentLocked().principal,clock.observe());
        }}
    }
    void applyClaim(Object attachment,String claim,String action) throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){
            claims.apply(attachment,currentLocked().principal,claim,action,clock.observe());display.cancelPending(32);
        }}
        NativeProviderJobSchedule.request(pendingWork(),delivery.jobs);
        publishMirrorHint();
    }
    void retireClaim(Object attachment,String claim) throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){claims.retire(attachment,currentLocked().principal,claim);}}
    }
}
