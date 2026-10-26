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
        final NativeProviderAudioSequence.Surface audioSurface;
        final NativeProviderAudioSequence.Scheduler audioScheduler;
        final NativeProviderAudioPolicy originalAudioPolicy;
        Delivery(NativeProviderTime.Profiles profiles,NativeProviderTime.Platform platform,NativeProviderClockExchange.Readings readings,
            NativeProviderRegistrationCoordinator.AppIdentity app,NativeProviderHttp http,NativeProviderJobSchedule.SystemJobs jobs,Tokens tokens) {
            this(profiles,platform,readings,app,http,jobs,tokens,null,null);
        }
        Delivery(NativeProviderTime.Profiles profiles,NativeProviderTime.Platform platform,NativeProviderClockExchange.Readings readings,
            NativeProviderRegistrationCoordinator.AppIdentity app,NativeProviderHttp http,NativeProviderJobSchedule.SystemJobs jobs,Tokens tokens,
            NativeProviderAudioSequence.Surface audioSurface,NativeProviderAudioSequence.Scheduler audioScheduler) {
            this(profiles,platform,readings,app,http,jobs,tokens,audioSurface,audioScheduler,null);
        }
        Delivery(NativeProviderTime.Profiles profiles,NativeProviderTime.Platform platform,NativeProviderClockExchange.Readings readings,
            NativeProviderRegistrationCoordinator.AppIdentity app,NativeProviderHttp http,NativeProviderJobSchedule.SystemJobs jobs,Tokens tokens,
            NativeProviderAudioSequence.Surface audioSurface,NativeProviderAudioSequence.Scheduler audioScheduler,NativeProviderAudioPolicy originalAudioPolicy) {
            if(profiles==null||platform==null||readings==null||app==null||http==null||jobs==null||tokens==null)
                throw new IllegalArgumentException("provider_delivery_dependencies_required");
            this.profiles=profiles;this.platform=platform;this.readings=readings;this.app=app;this.http=http;this.jobs=jobs;this.tokens=tokens;
            if((audioSurface==null)!=(audioScheduler==null))throw new IllegalArgumentException("provider_audio_pair_required");
            this.audioSurface=audioSurface;this.audioScheduler=audioScheduler;
            if(originalAudioPolicy!=null&&audioSurface==null)throw new IllegalArgumentException("provider_original_audio_surface_required");
            this.originalAudioPolicy=originalAudioPolicy;
        }
    }
    private final VaultEngine engine;
    private final Object coordinator;
    private final NativeProviderAuthority authority;
    private final NativeProviderJournal journal;
    private final NativeProviderClaims claims;
    private final NativeProviderClaims.AttachmentFence attachmentFence;
    private final NativeProviderDisplayDriver display;
    private final NativePrincipalJournal principals;
    private final NativeLegacyLineageJournal legacy;
    private final Delivery delivery;
    private final NativeProviderClockOwner clock;
    private final NativeProviderRegistrationCoordinator registration;
    private final NativeProviderAudioSequence audio;
    // Retain actual ORIGINAL provider completions only; never a second player.
    // No evictions/overwrites or history reconstruction after process restart.
    private final java.util.LinkedHashMap<String,OriginalJobFact> ordinaryOriginalFacts=new java.util.LinkedHashMap<>();
    private long ordinaryOriginalRevision;private boolean ordinaryOriginalUnknown;private long ordinaryOriginalBytes;
    private void originalReadChanged(){if(ordinaryOriginalRevision==Long.MAX_VALUE)ordinaryOriginalUnknown=true;else ordinaryOriginalRevision++;}
    private static VaultFailure originalJobUnavailable(){return new VaultFailure("custodial_provider_original_job_unavailable");}
    private final class OriginalJobFact {
        final NativeProviderJournal.Presentation presentation;
        final NativeProviderAudioSequence.Owner actualOwner;
        final NativeProviderAudioSequence.ReleasedCompletion actualRelease;
        final NativeProviderJournal.OriginalAudioState originalAttempt,completed;
        final NativeProviderAudioPolicy policy;final String profileFingerprint;
        private OriginalJobFact(NativeProviderJournal.Presentation presentation,NativeProviderAudioSequence.Owner actualOwner,
            NativeProviderAudioSequence.ReleasedCompletion actualRelease,NativeProviderJournal.OriginalAudioState originalAttempt,
            NativeProviderJournal.OriginalAudioState completed,NativeProviderAudioPolicy policy,String profileFingerprint)throws VaultFailure {
            if(presentation==null||actualOwner==null||actualRelease==null||originalAttempt==null||completed==null||policy==null
                ||originalAttempt.admissionOrdinal!=completed.admissionOrdinal
                ||!originalAttempt.registrationId.equals(completed.registrationId))throw originalJobUnavailable();
            this.presentation=presentation;this.actualOwner=actualOwner;this.actualRelease=actualRelease;
            this.originalAttempt=originalAttempt;this.completed=completed;this.policy=policy;this.profileFingerprint=profileFingerprint;
        }
    }
    /** Native-owned observation only; private constructor requires the existing
     * protected provider/journal and retained actual SDK completion facts. */
    final class OrdinaryOriginalJobRead {
        private final CustodialNativeRuntime runtime;private final NativeProviderPrincipal principal;
        final String planReadId,semanticDigest,targetDigest;
        private final java.util.List<OriginalJobFact> facts;private final java.util.List<String> bindings;
        private NativeProviderAuthority.Current current;private long revision;
        private NativeProviderAudioSequence.OrdinaryIdleRead idle;private NativeProviderJournal.OrdinaryReadFence journalRead;
        private ProviderRecordStore.RetainedNativeRead originalStoreRead;private boolean claimed,valid;
        private OrdinaryOriginalJobRead(CustodialNativeRuntime runtime,NativeProviderPrincipal principal,String planReadId,String semanticDigest,
            String targetDigest,java.util.List<OriginalJobFact> facts,java.util.List<String> bindings){
            this.runtime=runtime;this.principal=principal;this.planReadId=planReadId;this.semanticDigest=semanticDigest;this.targetDigest=targetDigest;
            this.facts=java.util.Collections.unmodifiableList(facts);this.bindings=java.util.Collections.unmodifiableList(bindings);
        }
        int size(){return facts.size();}
        String originalBindingJson(int index)throws VaultFailure {index(index);return bindings.get(index);}
        NativeProviderPayload originalPayload(int index)throws VaultFailure {index(index);return facts.get(index).presentation.payload;}
        String originalSpeechText(int index)throws VaultFailure {return originalPayload(index).get("body");}
        String originalAttemptSha256(int index)throws VaultFailure {index(index);return facts.get(index).originalAttempt.recordSha256;}
        String originalCompletedSha256(int index)throws VaultFailure {index(index);return facts.get(index).completed.recordSha256;}
        String originalProfileFingerprint(int index)throws VaultFailure {index(index);return facts.get(index).profileFingerprint;}
        long originalAdmissionOrdinal(int index)throws VaultFailure {index(index);return facts.get(index).originalAttempt.admissionOrdinal;}
        String originalAudioPolicyDigest(int index)throws VaultFailure {index(index);NativeProviderAudioPolicy p=facts.get(index).policy;
            return NativeProviderPrincipal.hash(p.engine+"\n"+p.voice+"\n"+p.rateMilli+"\n"+p.toneSha256+"\n"+p.evidenceSha256);}
        private void index(int index)throws VaultFailure {if(index<0||index>=facts.size())throw originalJobUnavailable();}
        void claimOriginal(CustodialNativeRuntime actual,NativeProviderPrincipal original,String readId,String semantic,String target)throws VaultFailure {
            requireNativeCurrentReadOnly();
            if(claimed||actual!=runtime||original==null||!principal.same(original)||!planReadId.equals(readId)
                ||!semanticDigest.equals(semantic)||!targetDigest.equals(target))throw originalJobUnavailable();claimed=true;
        }
        /** Real current/qualified-time/journal/OS observations. Must run before
         * the final callback-free fence; performs no notify/audio/HTTP/write. */
        void requireCurrent()throws VaultFailure {synchronized(engine){synchronized(coordinator){refreshOriginalJobRead(this);}}}
        void requireNativeCurrentReadOnly()throws VaultFailure {
            if(!Thread.holdsLock(engine))throw originalJobUnavailable(); // Reject BEFORE acquiring the coordinator.
            synchronized(coordinator){
            if(!runtime.ownsOrdinaryOriginalProvider(NativeProviderRuntimeOwner.this)
                ||!valid||originalStoreRead==null||ordinaryOriginalUnknown||revision!=ordinaryOriginalRevision||last!=current||last==null
                ||last.principal==null||!principal.same(last.principal)||idle==null||journalRead==null)throw originalJobUnavailable();
            originalStoreRead.requireCurrent();idle.requireCurrent();journalRead.requireCurrent();
        }}
        void requireNativeCurrentReadOnly(CustodialNativeRuntime actual)throws VaultFailure {if(actual!=runtime)throw originalJobUnavailable();requireNativeCurrentReadOnly();}
    }
    OrdinaryOriginalJobRead captureOrdinaryOriginalJobs(CustodialNativeRuntime runtime,NativeProviderPrincipal expected,String readId,
        String semanticDigest,String targetDigest,String bindingText)throws VaultFailure {
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator)||runtime==null||!runtime.ownsOrdinaryOriginalProvider(this)
            ||expected==null||readId==null||!readId.matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")
            ||semanticDigest==null||!semanticDigest.matches("[a-f0-9]{64}")||targetDigest==null||!targetDigest.matches("[a-f0-9]{64}")
            ||bindingText==null)throw originalJobUnavailable();
        try{
            org.json.JSONObject binding=ProviderWireJson.object(bindingText.getBytes(java.nio.charset.StandardCharsets.UTF_8),196608);
            NativeRetainedAttempt.keys(binding,"schema","state","entries");
            if(!"custodial.recurring-original-native-delivery-bindings.v1".equals(binding.get("schema"))
                ||!"ORIGINAL_NATIVE_RESERVATIONS".equals(binding.get("state")))throw originalJobUnavailable();
            org.json.JSONArray entries=binding.getJSONArray("entries");if(entries.length()<1||entries.length()>1024)throw originalJobUnavailable();
            java.util.List<OriginalJobFact> facts=new java.util.ArrayList<>();java.util.List<String> projected=new java.util.ArrayList<>();
            java.util.HashSet<String> distinct=new java.util.HashSet<>();
            for(int i=0;i<entries.length();i++){
                org.json.JSONObject b=entries.getJSONObject(i);NativeRetainedAttempt.keys(b,"notification_key","receipt_job_id","generation_id",
                    "registration_id","principal_digest","token_digest","reservation_at","valid_until","content_sha256","native_kind","audio_origin","speech_sha256");
                for(java.util.Iterator<String> it=b.keys();it.hasNext();)if(!(b.get(it.next()) instanceof String))throw originalJobUnavailable();
                String key=b.getString("notification_key");if(!distinct.add(key))throw originalJobUnavailable();OriginalJobFact selected=null;
                for(OriginalJobFact fact:ordinaryOriginalFacts.values()){
                    NativeProviderPayload payload=fact.presentation.payload;
                    if(!key.equals(payload.notificationKey)||!expected.same(fact.presentation.principal))continue;
                    if(selected!=null)throw originalJobUnavailable();selected=fact;
                }
                if(selected==null)throw originalJobUnavailable();NativeProviderPayload payload=selected.presentation.payload;
                for(String field:new String[]{"notification_key","receipt_job_id","generation_id","principal_digest","token_digest","reservation_at","valid_until","content_sha256"})
                    if(!payload.get(field).equals(b.getString(field)))throw originalJobUnavailable();
                if(!selected.originalAttempt.registrationId.equals(b.getString("registration_id")))throw originalJobUnavailable();
                if(!payload.get("kind").equals(b.getString("native_kind"))||!"ORIGINAL_NATIVE_JOB".equals(b.getString("audio_origin"))
                    ||!NativeProviderPrincipal.hash(payload.get("body")).equals(b.getString("speech_sha256")))throw originalJobUnavailable();
                facts.add(selected);projected.add(b.toString()); // Fixed nonsecret identity/digest DATA only; no original payload/secret exported.
            }
            OrdinaryOriginalJobRead result=new OrdinaryOriginalJobRead(runtime,expected,readId,semanticDigest,targetDigest,facts,projected);
            refreshOriginalJobRead(result);return result;
        }catch(VaultFailure unavailable){throw unavailable;}catch(Exception unavailable){throw originalJobUnavailable();}
    }
    private NativeProviderJournal.Observation originalJobCurrent(NativeProviderJournal.Presentation presentation)throws VaultFailure {
        NativeProviderAuthority.Current current=currentLocked();
        if(!presentation.principal.same(current.principal))throw originalJobUnavailable();journal.requirePresentationCurrent(current.principal,presentation);
        try{if(!journal.presentation(current.principal,presentation.payload.recordId).record().isNull("acknowledged_event_id"))throw originalJobUnavailable();}
        catch(VaultFailure unavailable){throw unavailable;}catch(Exception unavailable){throw originalJobUnavailable();}
        NativeProviderJournal.Observation now=clock.observe();
        if(!NativeProviderTime.live(now.bounds,presentation.payload.reservedAt,presentation.payload.validUntil))throw originalJobUnavailable();
        return now;
    }
    private void refreshOriginalJobRead(OrdinaryOriginalJobRead read)throws VaultFailure {
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator))throw originalJobUnavailable();
        read.valid=false; // A failed refresh must never leave an older snapshot usable.
        if(ordinaryOriginalUnknown||audio==null||delivery==null
            ||delivery.originalAudioPolicy==null||!read.runtime.ownsOrdinaryOriginalProvider(this))throw originalJobUnavailable();
        // Retain the native STORE epoch BEFORE every semantic/current/profile/OS
        // callback. Journal entry counters intentionally advance on our own reads;
        // a freshly captured tail epoch must not adopt a changed original row.
        ProviderRecordStore.RetainedNativeRead originalStoreRead=journal.captureOriginalStoreRead();
        NativeProviderAuthority.Current current=currentLocked();if(!read.principal.same(current.principal))throw originalJobUnavailable();
        NativeProviderTime.Profile profile=delivery.profiles.select(delivery.platform);
        if(profile==null||!profile.matches(delivery.platform))throw originalJobUnavailable();
        String fingerprint=profile.fingerprint();
        for(OriginalJobFact fact:read.facts){
            // Same compiled policy and qualified release profile, not merely a
            // currently available voice or a similarly labelled platform.
            NativeProviderAudioPolicy policy=delivery.originalAudioPolicy;
            if(!fact.profileFingerprint.equals(fingerprint)||!fact.policy.engine.equals(policy.engine)
                ||!fact.policy.voice.equals(policy.voice)||fact.policy.rateMilli!=policy.rateMilli
                ||!fact.policy.toneSha256.equals(policy.toneSha256)||!fact.policy.evidenceSha256.equals(policy.evidenceSha256))throw originalJobUnavailable();
            if(ordinaryOriginalFacts.get(fact.presentation.payload.recordId)!=fact||!read.principal.same(fact.presentation.principal))throw originalJobUnavailable();
            NativeProviderJournal.OriginalAudioState completed=journal.observeOriginalAudioCompletion(read.principal,fact.presentation,originalJobCurrent(fact.presentation));
            if(completed.admissionOrdinal!=fact.originalAttempt.admissionOrdinal
                ||!completed.registrationId.equals(fact.originalAttempt.registrationId))throw originalJobUnavailable();
            display.requireOriginalDisplayed(read.principal,fact.presentation,()->originalJobCurrent(fact.presentation));
        }
        current=currentLocked();if(!read.principal.same(current.principal))throw originalJobUnavailable();
        // Capture last, AFTER every callback-bearing original observation.
        read.idle=audio.captureOrdinaryIdle();read.journalRead=journal.captureOrdinaryReadFence();
        originalStoreRead.requireCurrent();
        read.originalStoreRead=originalStoreRead;read.current=current;read.revision=ordinaryOriginalRevision;read.valid=true;
        try{read.requireNativeCurrentReadOnly();}catch(VaultFailure refused){read.valid=false;throw refused;}
    }
    private final java.util.concurrent.atomic.AtomicBoolean synchronizing = new java.util.concurrent.atomic.AtomicBoolean();
    private NativeProviderAuthority.Current last;
    private NativeProviderMirrorAttachment mirror;
    private Object mirrorAttachmentEpoch;
    private final String mirrorIncarnation=java.util.UUID.randomUUID().toString();

    NativeProviderRuntimeOwner(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator, NativeProviderDisplayDriver.Surface surface) {
        this(engine,principals,legacy,journal,coordinator,surface,null);
    }
    NativeProviderRuntimeOwner(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator, NativeProviderDisplayDriver.Surface surface, Delivery delivery) {
        this(engine,principals,legacy,journal,coordinator,surface,delivery,owner->owner);
    }
    NativeProviderRuntimeOwner(VaultEngine engine, NativePrincipalJournal principals, NativeLegacyLineageJournal legacy,
        NativeProviderJournal journal, Object coordinator, NativeProviderDisplayDriver.Surface surface, Delivery delivery,
        NativeProviderClaims.AttachmentFence attachmentFence) {
        if (surface == null) throw new IllegalArgumentException("provider_local_surface_required");
        if(attachmentFence==null)throw new IllegalArgumentException("native_attachment_fence_required");
        this.engine = engine; this.coordinator = coordinator; this.journal = journal;
        this.attachmentFence=attachmentFence;
        this.principals=principals;this.legacy=legacy;this.delivery=delivery;
        authority = new NativeProviderAuthority(engine, principals, legacy, journal, coordinator);
        audio=delivery==null||delivery.audioSurface==null?null:new NativeProviderAudioSequence(engine,coordinator,delivery.audioSurface,delivery.audioScheduler);
        // A mirror's private claim owner is an alias of its ACTUAL plugin,
        // never a separately authorized UI identity or caller-provided epoch.
        claims = new NativeProviderClaims(journal,audio==null,owner->attachmentEpoch(
            mirror!=null&&mirror.claimsOwner==owner?mirror.plugin:owner));
        display = new NativeProviderDisplayDriver(journal, surface);
        clock=delivery==null?null:new NativeProviderClockOwner(engine,coordinator,journal,principals,legacy,delivery.profiles,delivery.platform,delivery.readings);
        registration=delivery==null?null:new NativeProviderRegistrationCoordinator(engine,principals,legacy,journal,coordinator,delivery.app,()->{
            NativeProviderClockExchange.Point point=delivery.readings.read();
            return new NativeProviderJournal.Observation(null,point.elapsedMillis,point.bootCount);
        },delivery.http,delivery.jobs);
    }
    NativeProviderAudioSequence.OrdinaryIdleRead captureOrdinaryAudioIdle()throws VaultFailure {
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator))throw new IllegalStateException("provider_lock_owner_required");
        // No audio object means this exact cached owner never constructed an
        // audio sequence/surface. The separate real service read is mandatory.
        return audio==null?null:audio.captureOrdinaryIdle();
    }
    @Override public void reconcile() throws VaultFailure {
        try{synchronized (engine) { synchronized (coordinator) {
            try{reconcileLocked();}
            catch(VaultFailure|RuntimeException failure){
                reconcileAudioAfterFailure(failure);throw failure;
            }
            if(audio!=null)audio.reconcile();
        } }}finally{publishMirrorHint();}
    }
    private NativeProviderAuthority.Current reconcileLocked() throws VaultFailure {
        try {
            NativeProviderAuthority.Current current = authority.reconcile();
            if (current.principal == null || last == null || last.principal == null || !last.principal.same(current.principal)
                || last.revision != current.revision) {originalReadChanged();claims.invalidate();invalidateMirrorLocked();}
            last = current; return current;
        } catch (VaultFailure | RuntimeException failure) { originalReadChanged();claims.invalidate();invalidateMirrorLocked(); last = null; throw failure; }
    }
    /** Bounded cancellation only AFTER the durable fence readback. Failure retains
     * exact cancellation intents and ciphertext; it never becomes global cancelAll. */
    boolean reconcileLocalEffects() throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) {
            // Read the actual engine result directly: authority's unavailable
            // metadata write must not mask an original unknown/corrupt error
            // with a later WORK refusal. No exception string mints a witness.
            try{engine.getState();}
            catch(VaultFailure|RuntimeException failure){
                claims.invalidate();invalidateMirrorLocked();last=null;
                if(!(failure instanceof VaultFailure)
                    ||!AndroidProtectedWorkPreferences.FAILURE.equals(((VaultFailure)failure).code)){
                    reconcileAudioAfterFailure(failure);throw failure;
                }
                try{
                    engine.requireOriginalProviderPreservationFence();
                    display.cancelRetainedPending(32);
                    if(audio!=null)audio.reconcile();
                }catch(VaultFailure|RuntimeException refused){reconcileAudioAfterFailure(refused);throw refused;}
                // Even exact OS absence cannot rewrite frozen provider state
                // or acknowledge durable intent completion during this hold.
                return false;
            }
            try{reconcileLocked();display.cancelPending(32);}
            catch(VaultFailure|RuntimeException failure){
                // Cancellation failure must not skip currentness cleanup of
                // the already-owned lane or replace its original failure.
                reconcileAudioAfterFailure(failure);throw failure;
            }
            if(audio!=null)audio.reconcile();
            return journal.pendingOsCancellations().isEmpty()&&(audio==null||!audio.busy());
        } }
    }
    private void reconcileAudioAfterFailure(Throwable original){
        if(audio!=null)try{audio.reconcile();}
        catch(VaultFailure|RuntimeException cleanup){if(cleanup!=original)original.addSuppressed(cleanup);}
    }
    void attach(Object attachment) throws VaultFailure {
        synchronized (engine) { synchronized (coordinator) { invalidateMirrorLocked();reconcileLocked(); claims.attach(attachment); } }
    }
    void attach(Object attachment,Object expectedEpoch)throws VaultFailure {
        synchronized(engine){synchronized(coordinator){
            requireAttachmentEpoch(attachment,expectedEpoch);invalidateMirrorLocked();reconcileLocked();
            requireAttachmentEpoch(attachment,expectedEpoch);claims.attach(attachment,expectedEpoch);
            requireAttachmentEpoch(attachment,expectedEpoch);
        }}
    }
    void detach(Object attachment) {
        synchronized (engine) { synchronized (coordinator) {
            if(mirror!=null&&mirror.plugin==attachment)invalidateMirrorLocked();claims.detach(attachment);
        } }
    }
    void detach(Object attachment,Object expectedEpoch) {
        if(attachment==null||expectedEpoch==null)return;
        synchronized(engine){synchronized(coordinator){
            // Revocation already happened at the actual lifecycle producer.
            // Compare the captured identity, NOT today's epoch, for cleanup.
            if(mirror!=null&&mirror.plugin==attachment&&mirrorAttachmentEpoch==expectedEpoch)invalidateMirrorLocked();
            claims.detach(attachment,expectedEpoch);
        }}
    }
    private Object attachmentEpoch(Object attachment)throws VaultFailure {
        if(attachment==null)throw NativeProviderMirrorAttachment.invalid();
        Object epoch=attachmentFence.currentEpoch(attachment);
        if(epoch==null)throw NativeProviderMirrorAttachment.invalid();return epoch;
    }
    private void requireAttachmentEpoch(Object attachment,Object expected)throws VaultFailure {
        if(expected==null||attachmentEpoch(attachment)!=expected)throw NativeProviderMirrorAttachment.invalid();
    }
    private void invalidateMirrorLocked(){
        if(mirror!=null){NativeProviderMirrorAttachment old=mirror;mirror=null;mirrorAttachmentEpoch=null;old.invalidate();claims.detach(old.claimsOwner);
            try{old.publish(journal.presentationRevision());}catch(VaultFailure|RuntimeException unavailable){/* No hint is authority. */}}
    }
    private void publishMirrorHint(){
        synchronized(engine){synchronized(coordinator){if(mirror!=null)try{requireAttachmentEpoch(mirror.plugin,mirrorAttachmentEpoch);mirror.publish(journal.presentationRevision());}
            catch(VaultFailure|RuntimeException unavailable){/* Durable journal is recovered by bounded foreground pull. */}}}
    }
    java.util.Map<String,Object> mirrorAttach(Object plugin,NativeProviderMirrorAttachment.Hint hint)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){
            Object epoch=attachmentEpoch(plugin);invalidateMirrorLocked();reconcileLocked();requireAttachmentEpoch(plugin,epoch);
            mirror=new NativeProviderMirrorAttachment(mirrorIncarnation,plugin,hint);mirrorAttachmentEpoch=epoch;
            claims.attach(mirror.claimsOwner,epoch);
            long revision=journal.presentationRevision();requireAttachmentEpoch(plugin,epoch);
            mirror.publish(revision);var result=mirror.snapshot(revision,supportedProfile());requireAttachmentEpoch(plugin,epoch);return result;
        }}
    }
    private NativeProviderMirrorAttachment requireMirror(Object plugin,String id)throws VaultFailure{
        if(mirror==null)throw NativeProviderMirrorAttachment.invalid();requireAttachmentEpoch(plugin,mirrorAttachmentEpoch);mirror.require(plugin,id);return mirror;
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
            if(work.networkPending()||!work.quarantined.isEmpty()||(audio!=null&&audio.busy()))return NativeProviderJobLifecycle.Result.RETRY;
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
                if(audio!=null){audio.reconcile();if(!audio.busy())for(String id:journal.admittedRecordIds(current.principal)){
                    invocation.attempt.check();NativeProviderJournal.Presentation presentation=journal.presentation(current.principal,id);
                    try{org.json.JSONObject row=presentation.record();
                        if(!"PENDING".equals(row.getString("audio_state"))||row.getBoolean("card_dismissed")||!row.isNull("acknowledged_event_id")
                            ||!NativeProviderTime.live(clock.observe().bounds,presentation.payload.reservedAt,presentation.payload.validUntil))continue;
                    }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw new VaultFailure("custodial_provider_audio_invalid",invalid);}
                    if(audio.start(presentation.payload.get("body"),audioOwner(presentation)))break;
                }}
                // Re-read after effects: an earlier display observation must not become
                // cleanup authority after its own horizon expires. Predicates stay in
                // the sole journal owner; no expiry guesses or uncertain-work eviction.
                invocation.attempt.check();current=currentLocked();NativeProviderJournal.Observation cleanup=clock.observe();
                if(cleanup.bounds!=null)journal.compactSettledRecords(current.principal,cleanup,16);
                NativeProviderJournal.Work remaining=journal.pendingWork(current.principal);
                return remaining.networkPending()||quarantineWaiting||!journal.pendingOsCancellations().isEmpty()||(audio!=null&&audio.busy())
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
            if(audio!=null)audio.reconcile();
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
            if(audio!=null)audio.reconcile();
        }}
        NativeProviderJobSchedule.request(pendingWork(),delivery.jobs);
        publishMirrorHint();
    }
    void retireClaim(Object attachment,String claim) throws VaultFailure {
        requireDelivery();synchronized(engine){synchronized(coordinator){claims.retire(attachment,currentLocked().principal,claim);}}
    }
    private NativeProviderAudioSequence.Owner audioOwner(NativeProviderJournal.Presentation presentation){
        return new NativeProviderAudioSequence.Owner(){
            private NativeProviderJournal.OriginalAudioState originalAttempt;
            private NativeProviderAuthority.Current exact()throws VaultFailure{
                NativeProviderAuthority.Current current=currentLocked();journal.requirePresentationCurrent(current.principal,presentation);
                try{if(!journal.presentation(current.principal,presentation.payload.recordId).record().isNull("acknowledged_event_id"))
                    throw new VaultFailure("custodial_provider_audio_acknowledged");}
                catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw new VaultFailure("custodial_provider_audio_invalid",invalid);}
                return current;
            }
            public void current()throws VaultFailure{
                exact();
                // This callback is re-entered by the actual SDK effect Authority,
                // including asynchronous onPrepared and the second cycle. A
                // first-start observation cannot authorize a later native sound.
                NativeProviderJournal.Observation observed=clock.observe();
                if(!NativeProviderTime.live(observed.bounds,presentation.payload.reservedAt,presentation.payload.validUntil))
                    throw new VaultFailure("custodial_provider_audio_time_unavailable");
            }
            public boolean begin()throws VaultFailure{
                NativeProviderAuthority.Current current=exact();
                if(!journal.tryStartAudio(current.principal,presentation,clock.observe()))return false;
                originalAttempt=journal.observeOriginalAudioAttempt(current.principal,presentation,originalJobCurrent(presentation));return true;
            }
            public void completed()throws VaultFailure{journal.applyPresentationAction(exact().principal,presentation,"audio_completed",clock.observe());publishMirrorHint();}
            public void stopped(){/* Exact quiet releases lane; persisted IN_PROGRESS remains uncertain. */publishMirrorHint();}
            @Override public void released(NativeProviderAudioSequence.ReleasedCompletion actual){
                try{
                    // Consume actual release fact NOW, before a later legitimate
                    // job starts. Preserve immutable history, not an old live lane.
                    actual.claimOriginal(audio,this,presentation.payload.get("body"));
                    if(delivery==null||delivery.originalAudioPolicy==null||originalAttempt==null)throw originalJobUnavailable();
                    NativeProviderJournal.OriginalAudioState completed=journal.observeOriginalAudioCompletion(exact().principal,presentation,originalJobCurrent(presentation));
                    NativeProviderTime.Profile profile=delivery.profiles.select(delivery.platform);
                    if(profile==null||!profile.matches(delivery.platform))throw originalJobUnavailable();
                    OriginalJobFact fact=new OriginalJobFact(presentation,this,actual,originalAttempt,completed,delivery.originalAudioPolicy,profile.fingerprint());
                    long bytes=NativeProviderPayload.canonical(presentation.payload.data(),false).getBytes(java.nio.charset.StandardCharsets.UTF_8).length
                        +presentation.payload.get("body").getBytes(java.nio.charset.StandardCharsets.UTF_8).length+4096L;
                    if(ordinaryOriginalUnknown||ordinaryOriginalFacts.size()>=1024||ordinaryOriginalBytes+bytes>8L*1024*1024
                        ||ordinaryOriginalFacts.containsKey(presentation.payload.recordId))throw originalJobUnavailable();
                    ordinaryOriginalFacts.put(presentation.payload.recordId,fact);ordinaryOriginalBytes+=bytes;originalReadChanged();
                }catch(Exception unknown){ordinaryOriginalUnknown=true;originalReadChanged();}
                // Tracking refusal never rewrites the original durable outcome
                // or replays/stops an independently completed provider episode.
            }
        };
    }
}
