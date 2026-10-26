package org.memphiszoo.custodial.vault;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Native authenticated-observation -> exact signed raw freeze. The finite
 * overload is used only by explicit protected maintenance, never startup/JS.
 * Never accepts browser context, a browser identity, an arbitrary HTTP request
 * or a browser inventory. This stage does not ACK/classify/finalize anything.
 * Failure leaves originals in place. A pending probe cannot become ordinary
 * writer admission without its separate authenticated exact recovery.
 */
final class NativeSeparationFreeze {
    // Only one native check/cancellation chain at a time. Do not hold the vault
    // monitor across network. This separate owner prevents an older in-flight
    // separation response from arriving after cancellation has admitted work.
    private static final Object CHECK_LOCK=new Object();
    private static boolean checkInProgress;
    /** Ordinary vault effects read the SAME existing WORK guard. This is a
     * denial-only native seam: it cannot cancel/admit a check or mint an ACK.
     * Original purpose-specific retained recovery does not call this seam. */
    interface OrdinaryVaultAdmission {
        void requireOrdinaryVaultAdmission() throws VaultFailure;
    }
    interface Store {
        Map<String,?> separationRawSnapshot()throws VaultFailure;
        void prepareSeparationProbe(Map<String,?> original)throws VaultFailure;
        void freezeSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence evidence)throws VaultFailure;
        org.json.JSONObject readSeparationSnapshotEvidence(Map<String,?> captured)throws VaultFailure;
    }
    interface InspectionStore extends Store {
        NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence proof)throws VaultFailure;
        default NativeCompletionJournal.RetainedArgumentMatch compareRetainedCompletionArguments(Map<String,?> original,NativeSeparationEvidence proof,
            String sourceKey,byte[] candidate)throws VaultFailure {throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);}
        default NativeRetainedCompletionSemantics.Observation inspectRetainedCompletionSemantics(Map<String,?> original,NativeSeparationEvidence proof,
            String sourceKey,byte[] candidate,char[] credential)throws VaultFailure {throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE);}
        default NativeRetainedCompletionCensus.Observation inspectRetainedCompletionCensus(Map<String,?> original,NativeSeparationEvidence proof,
            java.util.List<byte[]> candidates,char[] credential)throws VaultFailure {throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE);}
        default java.util.List<byte[]> collectRetainedCompletionReadArguments(Map<String,?> original,NativeSeparationEvidence proof,
            char[] credential)throws VaultFailure {throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE);}
        default java.util.List<NativeRetainedCompletionCensus.NativeReadGroup> collectRetainedCompletionReadGroups(
            Map<String,?> original,NativeSeparationEvidence proof,char[] credential)throws VaultFailure {
            throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE);
        }
    }
    interface RecoveryStore extends InspectionStore {
        Map<String,?> preparePendingSeparationRecovery()throws VaultFailure;
        void cancelPendingSeparationRecovery(Map<String,?> captured)throws VaultFailure;
    }
    /** Only an incomplete CHECK_PENDING can recover to normal active operation.
     * Missing check, authenticated separation, unknown status, foreign actor or
     * changed records remain denied. Nothing is rebound, enrolled or erased. */
    static void recoverPending(VaultEngine engine,RecoveryStore store,NativePrincipalJournal principal,
        NativeLegacyLineageJournal legacy)throws VaultFailure{
        synchronized(CHECK_LOCK){
            if(checkInProgress)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            checkInProgress=true;
            try{
                Map<String,?> captured=store.preparePendingSeparationRecovery();
                engine.recoverNativePendingCheck(principal,legacy,()->store.cancelPendingSeparationRecovery(captured));
            }finally{checkInProgress=false;}
        }
    }
    /** Discovery only after original signed evidence verification. The exact
     * complete raw map is checked again after decoding. No inventory ACK or
     * eligibility is produced, and no ordinary live decoder may prune records. */
    static NativeProtectedWorkInventory inspect(VaultEngine engine,InspectionStore store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy)throws VaultFailure{
        synchronized(engine){
            NativeSeparationEvidence proof=restore(engine,store,principal,legacy);
            Map<String,?> captured=store.separationRawSnapshot();
            Map<String,Object> original=new HashMap<>(captured);original.remove("native_separation_freeze.v1");
            NativeProtectedWorkInventory result=store.inspectSeparationSnapshot(original,proof);
            // Reverify full original principal and bytes after decoding, without
            // resigning or accepting a later principal/raw-map generation.
            NativeSeparationEvidence after=restore(engine,store,principal,legacy);
            if(!proof.body.equals(after.body)||!NativeProtectedWorkSnapshot.exactRawEquals(captured,store.separationRawSnapshot()))
                throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            return result;
        }
    }
    /** Purpose-specific one-record join under original native HMAC/principal and
     * complete frozen raw map. Browser bytes remain UNAUTHENTICATED input. This
     * does not admit inventory, work, cutoff eligibility, finalization or reuse. */
    static NativeCompletionJournal.RetainedArgumentMatch compareOriginalCompletionArguments(VaultEngine engine,InspectionStore store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,String sourceKey,byte[] candidate)throws VaultFailure{
        return engine.compareRetainedOriginalCompletionArguments(store,principal,legacy,sourceKey,candidate);
    }
    /** Specific original completion/session signature observation, not full
     * native/browser semantic inventory or a finalizer capability. */
    static NativeRetainedCompletionSemantics.Observation inspectOriginalCompletionSemantics(VaultEngine engine,InspectionStore store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,String sourceKey,byte[] candidate)throws VaultFailure{
        return engine.inspectRetainedOriginalCompletionSemantics(store,principal,legacy,sourceKey,candidate);
    }
    static NativeRetainedCompletionCensus.Observation inspectOriginalCompletionCensus(VaultEngine engine,InspectionStore store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,java.util.List<byte[]> candidates)throws VaultFailure{
        return engine.inspectRetainedOriginalCompletionCensus(store,principal,legacy,candidates);
    }
    /** Offline/restart readback only: verifies retained proof, original principal
     * and exact current raw records. Missing/invalid evidence is not an empty
     * inventory and grants no work/ACK/finalization. No network or state writes. */
    static NativeSeparationEvidence restore(VaultEngine engine,Store store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy)throws VaultFailure{
        Map<String,?> captured=store.separationRawSnapshot();
        if(!captured.containsKey("native_separation_freeze.v1")||captured.containsKey("native_separation_probe.v1"))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
        Map<String,Object> original=new HashMap<>(captured);original.remove("native_separation_freeze.v1");
        NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(original);
        synchronized(engine){
            NativeSeparationEvidence evidence=engine.restoreNativeSeparationSnapshot(store.readSeparationSnapshotEvidence(captured),snapshot,principal,legacy);
            if(!NativeProtectedWorkSnapshot.exactRawEquals(captured,store.separationRawSnapshot()))throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            return evidence;
        }
    }
    static NativeSeparationEvidence observe(VaultEngine engine,Store store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy)throws VaultFailure{
        return observeUnderControl(engine,store,principal,legacy,null);
    }
    /** Protected explicit invocation only. This control adds rejection, never
     * authentication or permission. Cancellation preserves any durable probe
     * or signed freeze already written; it cannot silently thaw ordinary work. */
    static NativeSeparationEvidence observe(VaultEngine engine,Store store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,
        NativePrivateCustodyFrameReadControl invocation)throws VaultFailure{
        if(invocation==null)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
        invocation.check();return observeUnderControl(engine,store,principal,legacy,invocation);
    }
    private static void requireInvocation(NativePrivateCustodyFrameReadControl invocation)throws VaultFailure{
        if(invocation!=null)invocation.check();
    }
    private static NativeSeparationEvidence observeUnderControl(VaultEngine engine,Store store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,
        NativePrivateCustodyFrameReadControl invocation)throws VaultFailure{
        synchronized(CHECK_LOCK){
            if(checkInProgress)throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
            checkInProgress=true;
            try{requireInvocation(invocation);return observeOwned(engine,store,principal,legacy,invocation);}finally{checkInProgress=false;}
        }
    }
    private static NativeSeparationEvidence observeOwned(VaultEngine engine,Store store,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,
        NativePrivateCustodyFrameReadControl invocation)throws VaultFailure{
        // Capture BEFORE principal validation and HTTP. A concurrent journal
        // change cannot become silently adopted after authentication.
        Map<String,?> captured=store.separationRawSnapshot();
        requireInvocation(invocation);
        if(captured.containsKey("native_separation_freeze.v1")){
            // Existing authenticated immutable context needs no new HTTP.
            // Recommit exact signed bytes to resolve a prior memory-only write.
            synchronized(engine){
                NativeSeparationEvidence retained=restore(engine,store,principal,legacy);
                Map<String,Object> original=new HashMap<>(captured);original.remove("native_separation_freeze.v1");
                requireInvocation(invocation);store.freezeSeparationSnapshot(original,retained);requireInvocation(invocation);return retained;
            }
        }
        Map<String,Object> raw=new HashMap<>(captured);
        // Retry may contain a retained encrypted fence. The adapter must
        // authenticate/decrypt and compare it to the newly signed evidence
        // before accepting this stripped raw identity. Malformed is refusal.
        raw.remove("native_separation_freeze.v1");
        raw.remove("native_separation_probe.v1");
        Map<String,?> exact=Collections.unmodifiableMap(raw);
        NativeProtectedWorkSnapshot snapshot=NativeProtectedWorkSnapshot.capture(exact);
        // No HTTP can return an authenticated separation until a durable
        // pending guard already blocks ordinary writers/cached admission.
        // This guard is not separation evidence and has no generic thaw API.
        requireInvocation(invocation);store.prepareSeparationProbe(exact);requireInvocation(invocation);
        NativeSeparationContext context=engine.readNativeSeparationContext(principal,legacy);
        requireInvocation(invocation);
        synchronized(engine){
            requireInvocation(invocation);
            NativeSeparationEvidence evidence=engine.attestNativeSeparationSnapshot(context,snapshot,principal,legacy);
            requireInvocation(invocation);store.freezeSeparationSnapshot(exact,evidence);requireInvocation(invocation);
            // Exact raw CAS is the journal boundary; the same engine monitor
            // prevents a concurrent vault/credential replacement across it.
            return evidence;
        }
    }
    private NativeSeparationFreeze(){}
}
