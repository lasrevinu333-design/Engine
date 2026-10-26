package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.atomic.AtomicReference;

/** Passive actual private protocol reads, never a synthetic quiet flag or
 * HOLD retry. Every actual HOLD still checks the live private writer sets. */
final class NativeRecurringCallbackProtocolAndroidSupport {
    private NativeRecurringCallbackProtocolAndroidSupport(){}
    static void awaitWriterQuiescence(ActivityScenario<BridgeSmokeActivity> scenario,
        NativeRecurringApplicationSource source,long originalUntil)throws Exception {
        // A finite16 observations leaves the existing64 nonce budget for actual
        // held phases/release. No state reset, callback polling effect or retry.
        for(int attempt=0;attempt<16&&android.os.SystemClock.elapsedRealtime()<originalUntil;attempt++){
            AtomicReference<NativeRecurringApplicationSource.WriterStateRead> pending=new AtomicReference<>();
            scenario.onActivity(host->{try{pending.set(source.beginWriterStateRead());}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}});
            try(var read=pending.get()){
                long replyUntil=Math.min(originalUntil,android.os.SystemClock.elapsedRealtime()+3_000);
                while(android.os.SystemClock.elapsedRealtime()<replyUntil&&!read.hasReply())android.os.SystemClock.sleep(25);
                assertTrue("Actual private scalar reply inside SAME original remainder",android.os.SystemClock.elapsedRealtime()<replyUntil&&read.hasReply());
                AtomicReference<NativeRecurringApplicationSource.WriterState> value=new AtomicReference<>();
                scenario.onActivity(host->{try{value.set(read.take(source));}catch(VaultFailure unavailable){throw new AssertionError(unavailable);}});
                var state=value.get();assertNotNull(state);
                System.out.println("CUSTODIAL_RECURRING_WRITER_STATE observation="+(attempt+1)+" writerEpoch="+state.epoch+" activeWriters="+state.active+" writerUnknown="+state.unknown+" held="+state.held+" snapshotOwnersReady="+state.ownersReady);
                assertFalse("Actual unresolved writer state is not quiescence",state.unknown);
                assertFalse("An existing hold is not a new native opportunity",state.held);
                if(state.active==0&&state.ownersReady){assertTrue(android.os.SystemClock.elapsedRealtime()<originalUntil);return;}
            }
            android.os.SystemClock.sleep(25);
        }
        throw new AssertionError("Actual callback writers did not become quiescent inside bounded original observation; no HOLD retry");
    }
}
