package org.memphiszoo.custodial.vault;

/** Transient native frame coordination only, never a journal/dispatch identity
 * or receipt. The fixed overall admission/result budget is independent of
 * each existing 30-second Attempt. No request, owner, time, HMAC or saved
 * witness is replaced. The engine must check at preparation/result boundaries
 * and create a piece ONLY immediately before its already-authorized HTTP.
 *
 * Cancellation is a signal, not IO settlement. close/cancel keep the exact
 * active ownership until its ORIGINAL calling thread invokes endPiece AFTER
 * Http finally, disconnect/detach and owned dispatch/body cleanup settle.
 * No background thread, forced termination, network or authority is created.
 * Checks cannot promise physical wall-time settlement of platform IO.
 */
final class NativePrivateCustodyFrameReadControl implements AutoCloseable {
    private final long deadline=System.nanoTime()+180_000_000_000L;
    private NativeRetainedHttp.Attempt active;
    private Thread pieceOwner;
    private boolean canceled,closed,ending;

    void check()throws VaultFailure {
        NativeRetainedHttp.Attempt piece;
        synchronized(this){
            if(!closed&&!canceled&&!expired())return;
            canceled=true;piece=active;
        }
        var failure=failure();
        try{if(piece!=null)piece.cancel();}catch(RuntimeException cleanup){failure.addSuppressed(cleanup);}
        throw failure;
    }
    NativeRetainedHttp.Attempt beginPiece()throws VaultFailure {
        // Do not turn a second begin into an implicit end or join of active IO.
        synchronized(this){if(active!=null||ending)throw failure();}
        check();
        synchronized(this){
            if(closed||canceled||expired()){canceled=true;throw failure();}
            if(active!=null||ending)throw failure();
            active=new NativeRetainedHttp.Attempt();pieceOwner=Thread.currentThread();return active;
        }
    }
    void endPiece(NativeRetainedHttp.Attempt piece)throws VaultFailure {
        synchronized(this){
            if(piece==null||piece!=active||pieceOwner!=Thread.currentThread()||ending)throw failure();
            ending=true;
        }
        boolean ended=false;
        try{
            // Caller contract: the actual HTTP finally has ALREADY settled.
            // Retire this transient Attempt rather than permit later reuse.
            piece.cancel();ended=true;
        }finally{
            synchronized(this){
                ending=false;
                // Failed cancellation does not release uncertain ownership.
                if(ended){active=null;pieceOwner=null;}
            }
        }
    }
    /** Lifecycle cancellation must survive an await consuming interrupt.
     * This method performs NO platform IO and releases NO piece ownership.
     * The actual worker's next checkpoint/finally owns network cleanup. */
    void requestCancellation(){
        NativeRetainedHttp.Attempt piece;
        synchronized(this){canceled=true;piece=active;}
        if(piece!=null)piece.requestCancellation();
    }
    void cancel(){
        NativeRetainedHttp.Attempt piece;
        synchronized(this){canceled=true;piece=active;}
        // Disconnect may block/throw; never hold this monitor during it.
        if(piece!=null)piece.cancel();
    }
    @Override public void close(){
        NativeRetainedHttp.Attempt piece;
        synchronized(this){closed=true;canceled=true;piece=active;}
        if(piece!=null)piece.cancel();
        // Deliberately NO active=null, detach, end, or settlement claim.
    }
    private boolean expired(){return Thread.currentThread().isInterrupted()||System.nanoTime()-deadline>=0;}
    private static VaultFailure failure(){return new VaultFailure("custodial_private_custody_transport_outcome_unknown");}
}
