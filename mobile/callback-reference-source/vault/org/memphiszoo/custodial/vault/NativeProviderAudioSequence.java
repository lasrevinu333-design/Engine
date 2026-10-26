package org.memphiszoo.custodial.vault;

/** One application-owned finite audio lane. Callback identity, not a timer or
 * void SDK return, advances each tone/speech. Uses existing engine->coordinator
 * order, including callbacks; adapters must never block waiting for callbacks. */
final class NativeProviderAudioSequence {
    interface Result { void done(boolean complete); }
    interface Effect { void run() throws Exception; }
    interface Authority { void perform(Effect effect) throws Exception; }
    interface Surface {
        void prepare(String operation,Result ready) throws Exception; // No audible effect; exact service/focus/voice readiness.
        void tone(String operation, Authority authority,Result result) throws Exception;
        void speak(String operation, String fullText,Authority authority,Result result) throws Exception;
        void stop(String operation, Result quiet) throws Exception;
        void release(String operation,Result released) throws Exception;
    }
    interface Scheduler { Object after(Runnable callback,long millis); void cancel(Object handle); }
    interface Owner {
        void current() throws VaultFailure; // Current native principal/record/ACK fence, not JS.
        boolean begin() throws VaultFailure; // Exact first-effect journal acquisition.
        void completed() throws VaultFailure;
        void stopped() throws VaultFailure; // Local capability only; uncertain journal stays.
        /** Private sequence fact after actual quiet AND release. Existing owners need no new action. */
        default void released(ReleasedCompletion actual) throws VaultFailure {}
    }
    /** Opaque callback DATA only, never target/plan/receipt authority. Its only
     * constructor is the real release callback after exactly two completed
     * tone/speech episodes. The START revision rejects intervening/reentrant
     * attempts even if an older SDK episode later reports successful release. */
    final class ReleasedCompletion {
        private final Session original;private boolean claimed;
        private ReleasedCompletion(Session session){original=session;}
        private void requireOriginal(NativeProviderAudioSequence sequence,Owner owner,String text)throws VaultFailure {
            if(sequence!=NativeProviderAudioSequence.this||owner!=original.owner||text==null||!text.equals(original.text)
                ||!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator)||ordinaryEntryUnknown||ordinaryStartDepth!=0
                ||ordinaryEntryRevision!=original.entryRevision||active!=null||failure!=null
                ||!original.releaseConfirmed||!original.complete||!original.settlementSucceeded
                ||original.toneCompletions!=2||original.speechCompletions!=2)throw releasedUnavailable();
        }
        void claimOriginal(NativeProviderAudioSequence sequence,Owner owner,String text)throws VaultFailure {
            requireOriginal(sequence,owner,text);if(claimed)throw releasedUnavailable();claimed=true;
        }
        void requireClaimedOriginal(NativeProviderAudioSequence sequence,Owner owner,String text)throws VaultFailure {
            requireOriginal(sequence,owner,text);if(!claimed)throw releasedUnavailable();
        }
    }
    private static VaultFailure releasedUnavailable(){return new VaultFailure("custodial_recurring_ordinary_audio_unavailable");}
    private static final long RING_GAP=900, REPEAT_GAP=1200, EFFECT_BOUND=60000;
    private final Object engine,coordinator;private final Surface surface;private final Scheduler scheduler;
    private volatile Session active;private volatile String failure;
    // Entry revision observes even a reentrant start attempt before callbacks.
    // It never changes the original audible sequence or clears old UNKNOWN.
    private long ordinaryEntryRevision;private boolean ordinaryEntryUnknown;private int ordinaryStartDepth;
    final class OrdinaryIdleRead {
        private final long revision;
        private OrdinaryIdleRead(long revision){this.revision=revision;}
        void requireCurrent()throws VaultFailure {
            if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator)||ordinaryEntryUnknown
                ||ordinaryStartDepth!=0||active!=null||ordinaryEntryRevision!=revision)throw new VaultFailure("custodial_recurring_native_audio_not_idle");
        }
    }
    OrdinaryIdleRead captureOrdinaryIdle()throws VaultFailure {
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator)||ordinaryEntryUnknown||ordinaryStartDepth!=0||active!=null)
            throw new VaultFailure("custodial_recurring_native_audio_not_idle");
        return new OrdinaryIdleRead(ordinaryEntryRevision);
    }
    private void ordinaryStartEntered(){if(ordinaryEntryRevision==Long.MAX_VALUE)ordinaryEntryUnknown=true;else ordinaryEntryRevision++;
        if(ordinaryStartDepth==Integer.MAX_VALUE)ordinaryEntryUnknown=true;else ordinaryStartDepth++;}
    private void ordinaryStartExited(){if(ordinaryStartDepth>0)ordinaryStartDepth--;else ordinaryEntryUnknown=true;}

    private static final class Session {
        final String operation=java.util.UUID.randomUUID().toString(),text;final Owner owner;
        final long entryRevision;long step;int cycle,toneCompletions,speechCompletions;boolean stopping,complete,started,settlementAttempted,settlementSucceeded,releaseConfirmed;Object timer;
        Session(String text,Owner owner,long revision){this.text=text;this.owner=owner;entryRevision=revision;}
    }
    NativeProviderAudioSequence(Object engine,Object coordinator,Surface surface,Scheduler scheduler){
        if(engine==null||coordinator==null||surface==null||scheduler==null)throw new IllegalArgumentException("provider_audio_dependencies_required");
        this.engine=engine;this.coordinator=coordinator;this.surface=surface;this.scheduler=scheduler;
    }
    void requireAudioOwnerStart(Owner owner)throws VaultFailure {
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator)||ordinaryEntryUnknown||active==null
            ||active.owner!=owner||active.entryRevision!=ordinaryEntryRevision||failure!=null)throw releasedUnavailable();
    }
    boolean ownsAudioOwner(Owner owner){
        if(!Thread.holdsLock(engine)||!Thread.holdsLock(coordinator))throw new IllegalStateException("provider_lock_owner_required");
        return active!=null&&active.owner==owner;
    }
    boolean busy(){return active!=null;}
    String failure(){return failure;}
    boolean start(String fullText,Owner owner)throws VaultFailure{
        synchronized(engine){synchronized(coordinator){
            ordinaryStartEntered(); // BEFORE any original owner/current/key callback.
            try {
            if(owner==null||fullText==null||fullText.isEmpty()||fullText.length()>1000||fullText.codePoints().anyMatch(Character::isISOControl))
                throw new VaultFailure("custodial_provider_audio_invalid");
            if(active!=null)return false;
            owner.current();Session s=new Session(fullText,owner,ordinaryEntryRevision);active=s;failure=null;
            long step=++s.step;watchdog(s,step);
            try{surface.prepare(s.operation,ready->{synchronized(engine){synchronized(coordinator){
                if(!owns(s,step))return;clearTimer(s);
                if(!ready){stop(s,false,"custodial_provider_audio_not_ready");return;}
                try{s.owner.current();if(!s.owner.begin()){stop(s,false,"custodial_provider_audio_already_owned");return;}s.started=true;tone(s);}
                catch(Exception refusal){stop(s,false,"custodial_provider_audio_start_refused");}
            }}});}catch(Exception unavailable){stop(s,false,"custodial_provider_audio_not_ready");}
            return active==s||s.started;
            } finally {ordinaryStartExited();}
        }}
    }
    void reconcile()throws VaultFailure{
        synchronized(engine){synchronized(coordinator){Session s=active;if(s==null)return;
            if(s.stopping){requestStop(s);if(active!=null)throw new VaultFailure("custodial_provider_audio_stop_unconfirmed");return;}
            try{s.owner.current();}catch(VaultFailure stale){stop(s,false,stale.code);if(active!=null)throw new VaultFailure("custodial_provider_audio_stop_unconfirmed",stale);}
        }}
    }
    void cancel(){synchronized(engine){synchronized(coordinator){if(active!=null)stop(active,false,"custodial_provider_audio_interrupted");}}}
    private boolean owns(Session s,long step){return active==s&&!s.stopping&&s.step==step;}
    private Authority authority(Session s,long step){return effect->{synchronized(engine){synchronized(coordinator){
        if(!owns(s,step))throw new VaultFailure("custodial_provider_audio_operation_stale");s.owner.current();effect.run();
    }}};}
    private void clearTimer(Session s){if(s.timer!=null){scheduler.cancel(s.timer);s.timer=null;}}
    private void watchdog(Session s,long step){s.timer=scheduler.after(()->{
        synchronized(engine){synchronized(coordinator){if(owns(s,step))stop(s,false,"custodial_provider_audio_callback_timeout");}}
    },EFFECT_BOUND);}
    private void tone(Session s){
        if(active!=s||s.stopping)return;
        try{s.owner.current();long step=++s.step;watchdog(s,step);surface.tone(s.operation,authority(s,step),ok->{
            synchronized(engine){synchronized(coordinator){if(!owns(s,step))return;clearTimer(s);
                if(!ok){stop(s,false,"custodial_provider_tone_failed");return;}s.toneCompletions++;gap(s,RING_GAP,()->speech(s));
            }}
        });}catch(Exception e){stop(s,false,"custodial_provider_tone_unavailable");}
    }
    private void speech(Session s){
        if(active!=s||s.stopping)return;
        try{s.owner.current();long step=++s.step;watchdog(s,step);surface.speak(s.operation,s.text,authority(s,step),ok->{
            synchronized(engine){synchronized(coordinator){if(!owns(s,step))return;clearTimer(s);
                if(!ok){stop(s,false,"custodial_provider_speech_failed");return;}
                s.speechCompletions++;if(s.cycle++==0)gap(s,REPEAT_GAP,()->tone(s));else stop(s,true,null);
            }}
        });}catch(Exception e){stop(s,false,"custodial_provider_speech_unavailable");}
    }
    private void gap(Session s,long delay,Runnable next){long step=++s.step;s.timer=scheduler.after(()->{
        synchronized(engine){synchronized(coordinator){if(!owns(s,step))return;s.timer=null;
            try{s.owner.current();next.run();}catch(Exception stale){stop(s,false,"custodial_provider_audio_owner_stale");}
        }}
    },delay);}
    private void stop(Session s,boolean complete,String reason){
        if(active!=s)return;clearTimer(s);s.step++;s.stopping=true;s.complete=complete;if(reason!=null)failure=reason;requestStop(s);
    }
    private void requestStop(Session s){
        if(active!=s||!s.stopping)return;long step=s.step;
        try{surface.stop(s.operation,quiet->{synchronized(engine){synchronized(coordinator){
            if(active!=s||!s.stopping||s.step!=step||!quiet)return;
            try{if(!s.settlementAttempted){s.settlementAttempted=true;if(s.complete){s.owner.current();s.owner.completed();s.settlementSucceeded=true;}else if(s.started)s.owner.stopped();}}
            catch(Exception uncertain){failure="custodial_provider_audio_settlement_unknown";}
            // Exact quiet readback permits releasing the physical lane, even
            // when journal completion is uncertain. IN_PROGRESS cannot replay.
            try{surface.release(s.operation,released->{synchronized(engine){synchronized(coordinator){
                if(active!=s||!s.stopping||s.step!=step)return;
                if(released){active=null;s.releaseConfirmed=true;
                    if(s.complete&&s.started&&s.settlementSucceeded&&failure==null&&s.entryRevision==ordinaryEntryRevision
                        &&s.toneCompletions==2&&s.speechCompletions==2){
                        try{s.owner.released(new ReleasedCompletion(s));}
                        catch(Exception unavailable){failure="custodial_recurring_ordinary_audio_unavailable";}
                    }
                }else failure="custodial_provider_audio_release_unknown";
            }}});}catch(Exception unknown){failure="custodial_provider_audio_release_unknown";}
        }}});}catch(Exception uncertain){failure="custodial_provider_audio_stop_unconfirmed";}
    }
}
