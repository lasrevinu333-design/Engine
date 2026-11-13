package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/** Fixed native coordinator on the SAME bounded Plugin worker. One current
 * item plus one coalesced latest-issued wake; no new pool, public factory,
 * retry timer, JSON eligibility or callback replay. All waits are outside
 * Engine/Writer/WORK monitors; the existing ordinary20/phase3 bounds only
 * refuse locally and never establish UTC/server-plan freshness. */
final class NativeRecurringOrdinaryDeliveryCoordinator {
    private static final long PHASE_NANOS=3_000_000_000L;
    private static final String FAILURE="custodial_recurring_ordinary_attempt_pending";
    private NativeRecurringOrdinaryDeliveryCoordinator(){}

    static void run(Context context,CustodialNativeRuntime runtime,NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.OrdinaryRenderWake wake,VaultEngine.NativeOrdinaryRecurringTrigger trigger)throws VaultFailure {
        if(context==null||runtime==null||source==null||wake==null||trigger==null||trigger.outcomeOnly()
            ||Looper.myLooper()==Looper.getMainLooper()||Thread.holdsLock(runtime.engine)
            ||Thread.holdsLock(CustodialNativeNotificationWriter.class))throw refused();
        long until=trigger.localDeadlineNanos();wake.requireCurrent(source);trigger.requireCurrent(runtime);
        boolean observedQuiescent=false;
        for(int observation=0;observation<16;observation++){
            requireTime(until);wake.requireCurrent(source);trigger.requireCurrent(runtime);
            var state=onUi(source,wake,until,source::beginWriterStateRead);
            try{
                await(state::hasReply,()->false,until);
                var actual=onUi(source,wake,until,()->state.take(source));
                if(actual.unknown||actual.held)throw refused();
                if(actual.ownersReady&&actual.active==0){observedQuiescent=true;break;}
            }finally{state.close();}
            pause(until);
        }
        if(!observedQuiescent)throw refused();
        // The one HOLD independently checks afresh; passive state never admits it.
        var hold=onUi(source,wake,until,source::beginOrdinaryDeliveryWriterHold);
        try{
            var first=onUi(source,wake,until,()->hold.initialRead(source));
            await(first::hasReply,first::hasTerminalRefusal,until);
            var initial=onUi(source,wake,until,()->first.takeOriginalOrdinaryFrame(source));
            try(initial;var read=runtime.claimOrdinaryRecurringRead(source,hold,initial)){
                read.requireTrigger(trigger);
                var last=onUi(source,wake,until,()->hold.beginTerminalRead(source));
                await(last::hasReply,last::hasTerminalRefusal,until);
                var terminal=onUi(source,wake,until,()->last.takeOriginalOrdinaryFrame(source));
                try(terminal){read.verifyTerminal(terminal);}
                wake.requireCurrent(source);trigger.requireCurrent(runtime);requireTime(until);
                try(var effects=read.captureNativeEffects(context)){
                    // Actual full plan, native no-audio, producer and short CAS
                    // are mandatory inside this fixed Runtime/Engine path.
                    runtime.applyOrdinaryRecurringDelivery(read,source,hold,effects);
                }
            }
        }finally{hold.close();}
    }

    /** Called ONLY after durable ATTEMPTED. No POST is permitted until the
     * actual same-original private JS handler has processed RELEASE and the
     * native Source transfers its authenticated one-use reply. Failure leaves
     * the original durable attempt outcome-only; native cleanup is not an ACK. */
    static NativeRecurringApplicationSource.CompletedCallbackRelease releaseAndAwait(
        NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold,long until)throws VaultFailure {
        if(Looper.myLooper()==Looper.getMainLooper())throw refused();
        var read=onUi(source,null,until,()->hold.beginOrdinaryReleaseForTransport(source));
        try{
            await(read::hasReply,()->false,until);
            return onUi(source,null,until,()->read.takeProcessed(source));
        }finally{read.close();}
    }

    private interface UiAction<T> {T run()throws VaultFailure;}
    private static final class UiWork<T> implements Runnable {
        private final NativeRecurringApplicationSource source;
        private final NativeRecurringApplicationSource.OrdinaryRenderWake wake;
        private final UiAction<T> action;private final long until;
        private boolean cancelled,complete;private T value;private Throwable error;
        private UiWork(NativeRecurringApplicationSource source,NativeRecurringApplicationSource.OrdinaryRenderWake wake,
            UiAction<T> action,long until){this.source=source;this.wake=wake;this.action=action;this.until=until;}
        @Override public void run(){
            synchronized(this){if(cancelled||remaining(until)<=0){complete=true;notifyAll();return;}}
            T result=null;Throwable failed=null;
            try{if(wake!=null)wake.requireCurrent(source);requireTime(until);result=action.run();}
            catch(Throwable failure){failed=failure;}
            boolean discard;
            synchronized(this){discard=cancelled||remaining(until)<=0;
                if(!discard){value=result;error=failed;}complete=true;notifyAll();}
            // A late UI task can never leak an acquired HOLD/read after its
            // bounded worker stopped waiting. The original close remains the
            // sole supported cleanup path, with no synthetic release reply.
            if(discard&&result instanceof AutoCloseable close)try{close.close();}catch(Exception ignored){}
        }
        T await()throws VaultFailure {
            final T captured;final Throwable failed;final boolean unavailable;
            InterruptedException interrupted=null;
            synchronized(this){
                while(!complete&&remaining(until)>0){
                    try{TimeUnit.NANOSECONDS.timedWait(this,remaining(until));}
                    catch(InterruptedException stopped){interrupted=stopped;break;}
                }
                unavailable=interrupted!=null||cancelled||!complete||remaining(until)<=0;
                if(unavailable)cancelled=true;
                captured=value;value=null;failed=error;
            }
            // No callback/Source monitor is acquired while UiWork is held.
            // Covers a reply completed just before its worker's late wakeup.
            if(unavailable){
                if(captured instanceof AutoCloseable close)try{close.close();}catch(Exception ignored){}
                if(interrupted!=null){Thread.currentThread().interrupt();throw new VaultFailure(FAILURE,interrupted);}
                throw refused();
            }
            if(failed instanceof VaultFailure known)throw known;
            if(failed!=null)throw new VaultFailure(FAILURE,failed);
            if(captured==null)throw refused();return captured;
        }
    }

    private static <T>T onUi(NativeRecurringApplicationSource source,NativeRecurringApplicationSource.OrdinaryRenderWake wake,
        long originalUntil,UiAction<T> operation)throws VaultFailure {
        if(Looper.myLooper()==Looper.getMainLooper())throw refused();
        requireTime(originalUntil);long until=System.nanoTime()+Math.min(PHASE_NANOS,remaining(originalUntil));
        UiWork<T> task=new UiWork<>(source,wake,operation,until);
        if(!new Handler(Looper.getMainLooper()).post(task))throw refused();
        return task.await();
    }
    private static void await(BooleanSupplier ready,BooleanSupplier refusal,long originalUntil)throws VaultFailure {
        requireTime(originalUntil);long until=System.nanoTime()+Math.min(PHASE_NANOS,remaining(originalUntil));
        while(!ready.getAsBoolean()){
            if(refusal.getAsBoolean())throw refused();requireTime(until);pause(until);
        }
        requireTime(until);requireTime(originalUntil);
    }
    private static void pause(long until)throws VaultFailure {
        long nanos=Math.min(25_000_000L,remaining(until));if(nanos<=0)throw refused();
        try{TimeUnit.NANOSECONDS.sleep(nanos);}
        catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new VaultFailure(FAILURE,interrupted);}
    }
    private static long remaining(long until){return until-System.nanoTime();}
    private static void requireTime(long until)throws VaultFailure {if(remaining(until)<=0)throw refused();}
    private static VaultFailure refused(){return new VaultFailure(FAILURE);}
}
