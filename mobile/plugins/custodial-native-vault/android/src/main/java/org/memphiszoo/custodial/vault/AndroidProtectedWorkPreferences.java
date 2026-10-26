package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** One process-wide commit boundary across Activity/plugin/NFC store instances.
 * This is a storage primitive, NOT separation authentication or an inventory
 * acknowledgement. No runtime currently invokes freeze(): the native owner
 * must bind/authenticate/encrypt its exact snapshot before that is mounted.
 * Unknown/corrupt fence bytes still prohibit mutation; there is no thaw API.
 */
final class AndroidProtectedWorkPreferences implements SharedPreferences {
    static final String FENCE_KEY = "native_separation_freeze.v1";
    // Durable CHECK PENDING, not authenticated separation or inventory proof.
    // Established before HTTP so a crash/write failure after a genuine native
    // observation cannot resurrect ordinary cached admission on restart.
    static final String PROBE_KEY = "native_separation_probe.v1";
    static final String NFC_WRITE_KEY = "native_nfc_original_write_attempt.v1";
    static final String NFC_GENERATION_KEY = "native_nfc_original_write_generation.v1";
    static final String WORK_WRITE_KEY = "native_work_original_write_attempt.v1";
    static final String WORK_GENERATION_KEY = "native_work_original_write_generation.v1";
    // Raw, census-visible storage fence; NOT an original attempt UUID or ACK.
    static final String MUTATION_KEY = "native_work_mutation_epoch.v1";
    static final String FAILURE = "custodial_native_protected_work_frozen";
    // Provider generation revalidation already holds this monitor before WORK
    // admission. Sharing it avoids COMMIT -> provider versus provider -> COMMIT.
    // AndroidProviderCipher's static initializer only allocates this Object.
    private static final Object COMMIT_LOCK = AndroidProviderCipher.STORE_LOCK;
    // Supplement to the census-visible durable epoch below. Invalidate even
    // memory-only failed writes; byte equality alone cannot detect A -> B -> A.
    // This does NOT supply durable all-eight-store/browser generation proof,
    // inventory acknowledgement, finalizer or shared-key retirement authority.
    // A shared counter conservatively invalidates outstanding work observations
    // from every adapter on ANY attempted protected preferences commit.
    private static long mutationEpoch;
    private static NativePrivateMutationEpochStore mutationJournal;
    private static NativePrivateMutationEpochStore.Current durableMutationCurrent;
    // A refused explicit metadata recovery never falls back to process-only
    // admission, even when attachment had not yet installed a journal.
    private static boolean mutationEpochRecoveryPending;
    private static NativePrivateMutationEpochStore.ExistingRoot mutationRecoveryRoot;
    private static final Set<SharedPreferences> UNCERTAIN_MUTATIONS = Collections.newSetFromMap(new java.util.IdentityHashMap<>());
    // SharedPreferences.commit(false) can already have removed the guard in
    // memory. Every adapter of the same Android private-preferences object must
    // remain denied until the identical pending bytes are durably restored or
    // an authenticated exact cancellation completes. Process restart reads the
    // disk guard; this is not a substitute for that durable marker.
    private static final class PendingProbeCancellation {
        final String record;
        final Map<String,?> original,cancelled,restored;
        PendingProbeCancellation(Map<String,?> original,String record)throws VaultFailure {
            this.original=copy(original);this.record=record;
            Map<String,Object> next=new HashMap<>(original);
            next.put(MUTATION_KEY,attemptEpoch(durableEpoch(original),1));
            this.cancelled=copy(next);next.put(PROBE_KEY,record);this.restored=copy(next);
        }
        boolean matchesCurrent(Map<String,?> current)throws VaultFailure {
            Map<String,Object> before=new HashMap<>(original);before.put(PROBE_KEY,record);
            return NativeProtectedWorkSnapshot.exactRawEquals(before,current)
                ||NativeProtectedWorkSnapshot.exactRawEquals(cancelled,current)
                ||NativeProtectedWorkSnapshot.exactRawEquals(restored,current);
        }
    }
    private static final Map<SharedPreferences,PendingProbeCancellation> UNCERTAIN_CANCELLATIONS = new java.util.IdentityHashMap<>();
    /** Native source-object provenance only. The original map is NOT a fresh
     * snapshot: current raw bytes/epoch must remain visible to every observer.
     * No caller-supplied JSON/map can create this continuation. */
    static final class ProbeContinuation {
        final Map<String,?> original;
        private ProbeContinuation(PendingProbeCancellation pending){original=pending.original;}
    }
    private static final Map<SharedPreferences,String> UNCERTAIN_NFC_ATTEMPTS = new java.util.IdentityHashMap<>();
    private static final Map<SharedPreferences,String> UNCERTAIN_WORK_ATTEMPTS = new java.util.IdentityHashMap<>();
    private final SharedPreferences delegate;

    AndroidProtectedWorkPreferences(SharedPreferences delegate) {
        if (delegate == null || delegate instanceof AndroidProtectedWorkPreferences)
            throw new IllegalArgumentException("raw private preferences required");
        this.delegate = delegate;
    }

    /** Immutable raw snapshot, including unreadable encrypted records. A caller
     * may classify a COPY but must never interpret decode failure as absence. */
    Map<String, ?> protectedSnapshot() {
        synchronized (COMMIT_LOCK) { return copy(delegate.getAll()); }
    }

    static final class ReadOnlyObservation {
        final Map<String,?> values; final boolean frozen;
        private final SharedPreferences source;
        private final long mutationEpoch;
        private final String durableMutationStamp;
        private ReadOnlyObservation(Map<String,?> values,boolean frozen,SharedPreferences source,long mutationEpoch,String durableMutationStamp) {
            this.values=values; this.frozen=frozen; this.source=source; this.mutationEpoch=mutationEpoch;
            this.durableMutationStamp=durableMutationStamp;
        }
    }
    ReadOnlyObservation observeReadOnly() {
        synchronized(COMMIT_LOCK) {
            try{
                long originalEpoch=mutationEpoch;String stamp=retainedMutationStampForReadOnlyCapture();
                Map<String,?> values=copy(delegate.getAll());boolean frozen=frozen();
                if(originalEpoch!=mutationEpoch||!stamp.equals(retainedMutationStampForReadOnlyCapture()))throw new VaultFailure(FAILURE);
                return new ReadOnlyObservation(values,frozen,delegate,originalEpoch,stamp);
            }catch(VaultFailure unavailable){throw new IllegalStateException(FAILURE,unavailable);}
        }
    }
    boolean matchesReadOnly(ReadOnlyObservation original) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            return original != null && original.source == delegate && original.mutationEpoch == mutationEpoch
                && original.durableMutationStamp.equals(retainedMutationStampForReadOnlyCapture())
                && original.frozen == frozen() && NativeProtectedWorkSnapshot.exactRawEquals(original.values,delegate.getAll())
                && original.mutationEpoch == mutationEpoch
                && original.durableMutationStamp.equals(retainedMutationStampForReadOnlyCapture());
        }
    }

    /** Borrowed exact installed native generation, never a scalar stamp or
     * caller capability. No current/journal ownership is transferred or closed. */
    static final class OrdinaryReadGeneration {
        private final NativePrivateMutationEpochStore journal;
        private final NativePrivateMutationEpochStore.Current current;
        private final long processEpoch;
        private OrdinaryReadGeneration(NativePrivateMutationEpochStore journal,
            NativePrivateMutationEpochStore.Current current,long epoch){
            this.journal=journal;this.current=current;processEpoch=epoch;
        }
    }
    static OrdinaryReadGeneration observeOrdinaryReadGeneration()throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(mutationEpochRecoveryPending)throw new VaultFailure(FAILURE);
            if(mutationJournal==null)return null; // DATA only; never native generation proof.
            if(durableMutationCurrent==null)throw new VaultFailure(FAILURE);
            var original=new OrdinaryReadGeneration(mutationJournal,durableMutationCurrent,mutationEpoch);
            requireOrdinaryReadGeneration(original);return original;
        }
    }
    static void requireOrdinaryReadGeneration(OrdinaryReadGeneration original)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(original==null||mutationEpochRecoveryPending||mutationJournal!=original.journal
                ||durableMutationCurrent!=original.current||mutationEpoch!=original.processEpoch)
                throw new VaultFailure(FAILURE);
            original.journal.requireOrdinaryAdmission(original.current);
            if(mutationEpochRecoveryPending||mutationJournal!=original.journal
                ||durableMutationCurrent!=original.current||mutationEpoch!=original.processEpoch)
                throw new VaultFailure(FAILURE);
        }
    }

    private static void beforeMutation() throws VaultFailure {
        if(mutationEpochRecoveryPending)throw new VaultFailure(FAILURE);
        if(mutationJournal!=null)mutationJournal.requireOrdinaryAdmission(durableMutationCurrent);
        if (mutationEpoch == Long.MAX_VALUE) throw new VaultFailure(FAILURE);
        mutationEpoch++;
        // Only an explicitly installed native baseline participates. Legacy
        // process-only operation is not promoted into durable admission.
        if(mutationJournal!=null){
            try(var prepared=mutationJournal.prepareNext(durableMutationCurrent)){
                var next=mutationJournal.commitPrepared(prepared);
                var prior=durableMutationCurrent;durableMutationCurrent=next;prior.close();
            }catch(VaultFailure failure){throw new VaultFailure(FAILURE,failure);}
        }
    }

    static void bindOriginalMutationEpochJournal(NativePrivateMutationEpochStore journal,
        NativePrivateMutationEpochStore.Current current,VaultEngine.NativeOriginalMutationEpochBootstrap original)throws VaultFailure {
        if(journal==null||current==null||original==null)throw new VaultFailure(FAILURE);
        original.requireCurrent();
        synchronized(COMMIT_LOCK){
            original.requireCurrent();journal.requireCurrent(current);journal.requireOriginalBaseline(original);
            if(mutationRecoveryRoot!=null)mutationRecoveryRoot.requireJournal(journal);
            if(mutationJournal!=null||mutationEpochRecoveryPending)throw new VaultFailure(FAILURE); // no replacement/adoption
            mutationJournal=journal;durableMutationCurrent=current;
        }
    }
    static void requireMutationEpochNotInstalled()throws VaultFailure{
        synchronized(COMMIT_LOCK){if(mutationJournal!=null||mutationEpochRecoveryPending)throw new VaultFailure(FAILURE);}
    }
    /** Exact installed-object check, not a caller path/counter admission. */
    static void requireInstalledMutationEpochJournal(NativePrivateMutationEpochStore journal,
        NativePrivateMutationEpochStore.Current current)throws VaultFailure {
        if(!Thread.holdsLock(COMMIT_LOCK)||mutationEpochRecoveryPending||journal==null||current==null
            ||mutationJournal!=journal||durableMutationCurrent!=current)throw new VaultFailure(FAILURE);
    }
    /** Main's closed native owner only. Durable HELD is denial, never ACK or
     * replacement work. No reset/thaw or PROCESS_ONLY fallback is provided. */
    static void holdOriginalWriters(VaultEngine.NativeOriginalDurableWriterHold token)throws VaultFailure {
        if(token==null)throw new VaultFailure(FAILURE);
        synchronized(COMMIT_LOCK){
            if(mutationEpochRecoveryPending||mutationJournal==null||durableMutationCurrent==null
                ||mutationEpoch==Long.MAX_VALUE)throw new VaultFailure(FAILURE);
            try{
                // The fixed callee begins with full token validation before
                // its coordinator or any journal IO. Only monitor acquisition
                // and local refusal checks precede it here: do not repeat the
                // entire source graph twice without an intervening IO/effect.
                var held=mutationJournal.holdOriginalWriters(durableMutationCurrent,token);
                var prior=durableMutationCurrent;durableMutationCurrent=held;prior.close();
            }finally{
                // Pending intent is already a durable denial on interruption.
                // Keep the original process epoch only until its final owning
                // token check, then invalidate old source observations too.
                mutationEpoch++;
            }
        }
    }
    /** Read-only provenance from the exact installed HELD owner. This lease
     * cannot provision, recover, replace or thaw any journal. Main must still
     * authenticate/match the saved capsule and full original operation. */
    static final class HeldOriginalRead implements AutoCloseable {
        private final NativePrivateMutationEpochStore journal;
        private final NativePrivateMutationEpochStore.Current current;
        private final NativePrivateMutationEpochStore.HeldOriginal original;
        private final long epoch;
        private boolean closed,refused;
        private HeldOriginalRead()throws VaultFailure {
            if(!Thread.holdsLock(COMMIT_LOCK)||mutationEpochRecoveryPending
                ||mutationJournal==null||durableMutationCurrent==null)throw new VaultFailure(FAILURE);
            journal=mutationJournal;current=durableMutationCurrent;epoch=mutationEpoch;
            original=current.heldOriginal();requireCurrent();
        }
        private void requireInstalled()throws VaultFailure {
            if(closed||refused||mutationEpochRecoveryPending||mutationEpoch!=epoch
                ||mutationJournal!=journal||durableMutationCurrent!=current||original==null)
                throw new VaultFailure(FAILURE);
        }
        void requireCurrent()throws VaultFailure {
            synchronized(COMMIT_LOCK){try{
                requireInstalled();journal.requireCurrent(current);
                if(current.heldOriginal()!=original||original.originalCounter<0||original.originalCounter==Long.MAX_VALUE
                    ||current.counter()!=original.originalCounter+1)throw new VaultFailure(FAILURE);
                requireInstalled();
            }catch(VaultFailure failure){refused=true;throw failure;}
            catch(RuntimeException failure){refused=true;throw new VaultFailure(FAILURE,failure);}
            catch(Error failure){refused=true;throw failure;}}
        }
        String heldStampForOwningObservation()throws VaultFailure {
            synchronized(COMMIT_LOCK){try{requireCurrent();return "DURABLE_HELD:"+current.counter();}
            catch(VaultFailure failure){refused=true;throw failure;}
            catch(RuntimeException failure){refused=true;throw new VaultFailure(FAILURE,failure);}
            catch(Error failure){refused=true;throw failure;}}
        }
        /** Bind a fixed retained reader to THIS installed journal's native
         * root. Read-only identity check, never a selected path or adoption. */
        void requireSameNativeRoot(java.io.File nativeRoot)throws VaultFailure {
            synchronized(COMMIT_LOCK){try{
                requireCurrent();journal.requireSameNativeNoBackupRoot(nativeRoot);requireCurrent();
            }catch(VaultFailure failure){refused=true;throw failure;}
            catch(RuntimeException failure){refused=true;throw new VaultFailure(FAILURE,failure);}
            catch(Error failure){refused=true;throw failure;}}
        }
        /** Pointer identity only, used INSIDE the real held FileLock loan.
         * The loan separately rereads exact installed journal bytes. Never
         * recurse through requireCurrent or turn this identity into a lease. */
        void requireSameInstalledForFinalization(NativePrivateMutationEpochStore expected,
            NativePrivateMutationEpochStore.Current original)throws VaultFailure {
            synchronized(COMMIT_LOCK){requireInstalled();
                if(journal!=expected||current!=original)throw new VaultFailure(FAILURE);
            }
        }
        /** Original descriptor provenance only, NOT a current-source stamp or
         * permission. Only Main's separately authenticated reconstruction may
         * use it after matching the same saved original bytes and identities. */
        String originalStampForOwningReconstruction()throws VaultFailure {
            synchronized(COMMIT_LOCK){try{requireCurrent();return "DURABLE_ATTEMPT:"+original.originalCounter;}
            catch(VaultFailure failure){refused=true;throw failure;}
            catch(RuntimeException failure){refused=true;throw new VaultFailure(FAILURE,failure);}
            catch(Error failure){refused=true;throw failure;}}
        }
        static final class OriginalMetadata {
            final long originalCounter;
            final String valuesSha256,generationId,operationId,planSha256,browserFrameSha256,browserPartSetSha256;
            private OriginalMetadata(NativePrivateMutationEpochStore.HeldOriginal held){
                originalCounter=held.originalCounter;valuesSha256=held.originalValuesSha256;
                generationId=held.originalGenerationId;operationId=held.originalOperationId;planSha256=held.originalPlanSha256;
                // Null/null denotes exact legacy V2 metadata, not permission
                // to adopt today's browser data or upgrade the held record.
                browserFrameSha256=held.browserFrameSha256;browserPartSetSha256=held.browserPartSetSha256;
            }
        }
        OriginalMetadata originalMetadataForOwningRecovery()throws VaultFailure {
            synchronized(COMMIT_LOCK){try{requireCurrent();return new OriginalMetadata(current.heldOriginal());}
            catch(VaultFailure failure){refused=true;throw failure;}
            catch(RuntimeException failure){refused=true;throw new VaultFailure(FAILURE,failure);}
            catch(Error failure){refused=true;throw failure;}}
        }
        @Override public void close(){synchronized(COMMIT_LOCK){closed=true;}}
    }
    void commitOriginalInventoryFinalization(VaultPersistence target,
        VaultEngine.NativeOriginalInventoryFinalizationControl control)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(target==null||control==null||mutationEpochRecoveryPending||mutationJournal==null
                ||durableMutationCurrent==null)throw new VaultFailure(FAILURE);
            control.requireBeforeCommit();
            mutationJournal.commitOriginalEnrollment(durableMutationCurrent,target,control);
        }
    }
    static void requireOriginalEnrollmentCommit(VaultPersistence target,
        VaultEngine.NativeOriginalInventoryFinalizationControl control)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(target==null||control==null||mutationEpochRecoveryPending||mutationJournal==null
                ||durableMutationCurrent==null)throw new VaultFailure(FAILURE);
            mutationJournal.requireOriginalEnrollmentCommit(durableMutationCurrent,target,control);
        }
    }
    static HeldOriginalRead openInstalledOriginalHeldRead()throws VaultFailure {
        synchronized(COMMIT_LOCK){return new HeldOriginalRead();}
    }
    /** Read-only native reattachment; not bootstrap or recovery adoption. */
    static void attachExistingMutationEpochJournal(android.content.Context context)throws VaultFailure{
        synchronized(COMMIT_LOCK){
            if(mutationEpochRecoveryPending)throw new VaultFailure(FAILURE);
            if(mutationJournal!=null){mutationJournal.requireSameNativeContext(context);mutationJournal.requireCurrent(durableMutationCurrent);return;}
            var existing=NativePrivateMutationEpochStore.existingFromContextOrAbsent(context);
            if(existing==null)return;
            var current=existing.readCurrent();mutationJournal=existing;durableMutationCurrent=current;
        }
    }
    /** Trusted native initialization BEFORE any WORK adapter. Resume only the
     * existing attempted metadata; this confers no work/auth/ACK authority. */
    static void recoverExistingMutationEpochJournal(android.content.Context context)throws VaultFailure {
        try{
            if(context==null||context.getApplicationContext()==null)throw new VaultFailure(FAILURE);
            recoverExistingMutationEpochJournal(NativePrivateMutationEpochStore.originalContextNoBackupRoot(context),context);
        }catch(Exception failure){throw new VaultFailure(FAILURE,failure);}
    }
    /** Package checked host leaf for the same actual existing-root contract. */
    static void recoverExistingMutationEpochJournalFromNativeNoBackupRoot(java.io.File root)throws VaultFailure {
        recoverExistingMutationEpochJournal(root,null);
    }
    private static void recoverExistingMutationEpochJournal(java.io.File root,android.content.Context context)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            NativePrivateMutationEpochStore.Current next=null;
            try{
                if(mutationJournal!=null)mutationJournal.requireSameNativeNoBackupRoot(root);
                if(mutationRecoveryRoot==null)mutationRecoveryRoot=NativePrivateMutationEpochStore.observeExistingRoot(root);
                else mutationRecoveryRoot.require(root);
                if(mutationEpoch==Long.MAX_VALUE)throw new VaultFailure(FAILURE);
                mutationEpoch++;mutationEpochRecoveryPending=true;
                if(durableMutationCurrent!=null)durableMutationCurrent.close();
                var existing=mutationJournal!=null?mutationJournal:
                    context!=null?NativePrivateMutationEpochStore.recoverExistingFromContextOrAbsent(context):
                    NativePrivateMutationEpochStore.recoverExistingFromNativeNoBackupRootOrAbsent(root);
                if(existing==null){mutationRecoveryRoot.require(root);mutationEpochRecoveryPending=false;return;}
                next=existing.recoverCurrentMetadata();existing.requireCurrent(next);
                existing.requireSameNativeNoBackupRoot(root);
                if(context!=null)existing.requireSameNativeContext(context);
                mutationRecoveryRoot.requireJournal(existing);
                mutationJournal=existing;durableMutationCurrent=next;next=null;
                mutationEpochRecoveryPending=false;
            }catch(Exception failure){throw new VaultFailure(FAILURE,failure);}
            finally{if(next!=null)next.close();}
        }
    }
    static SharedPreferences bindExistingNativeEpoch(android.content.Context context,SharedPreferences preferences){
        try{attachExistingMutationEpochJournal(context);return preferences;}
        catch(VaultFailure refused){throw new IllegalStateException(FAILURE,refused);}
    }
    /** Native rejection stamp only. No scalar caller can install a journal. */
    static String retainedMutationStampForReadOnlyCapture()throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(mutationEpochRecoveryPending)throw new VaultFailure(FAILURE);
            if(mutationJournal==null)return "PROCESS_ONLY";
            long counter=mutationJournal.counterForPreservationRead(durableMutationCurrent);
            return (durableMutationCurrent.heldOriginal()==null?"DURABLE_ATTEMPT:":"DURABLE_HELD:")+counter;
        }
    }

    static String durableEpoch(Map<String,?> raw) throws VaultFailure {
        if(raw==null)throw new VaultFailure(FAILURE);
        if(!raw.containsKey(MUTATION_KEY))return ""; // exact pre-epoch original, not a recovered legacy attempt
        Object value=raw.get(MUTATION_KEY);
        if(!(value instanceof String)||((String)value).isEmpty())throw new VaultFailure(FAILURE);
        epochNumber((String)value);return (String)value;
    }
    private static long epochNumber(String value)throws VaultFailure {
        try{if(value.isEmpty())return 0;
            if(!value.matches("[1-9][0-9]{0,18}"))throw new VaultFailure(FAILURE);
            long n=Long.parseLong(value);if(n<=0)throw new VaultFailure(FAILURE);return n;
        }catch(NumberFormatException error){throw new VaultFailure(FAILURE,error);}
    }
    static String attemptEpoch(String previous,int phase)throws VaultFailure {
        if(previous==null||phase<1||phase>2)throw new VaultFailure(FAILURE);
        long n=epochNumber(previous);if(n>Long.MAX_VALUE-2)throw new VaultFailure(FAILURE);
        return Long.toString(n+phase);
    }
    static void reconstructEpoch(Map<String,Object> prior,String previous,String marker,String completedGeneration,String attemptId)throws VaultFailure {
        if(previous==null)throw new VaultFailure(FAILURE); // old encoded attempt has no durable predecessor authority
        String current=durableEpoch(prior);
        boolean pending=prior.containsKey(marker);
        if(pending){
            if(!current.equals(attemptEpoch(previous,1))&&!current.equals(attemptEpoch(previous,2)))throw new VaultFailure(FAILURE);
            if(current.equals(attemptEpoch(previous,2))!=attemptId.equals(completedGeneration))throw new VaultFailure(FAILURE);
        }else if(!current.equals(previous)&&!(attemptId.equals(completedGeneration)&&current.equals(attemptEpoch(previous,2))))
            throw new VaultFailure(FAILURE);
        if(previous.isEmpty())prior.remove(MUTATION_KEY);else prior.put(MUTATION_KEY,previous);
    }
    private void advanceDurableBeforeExternalWrite()throws VaultFailure {
        Map<String,Object> expected=new HashMap<>(copy(delegate.getAll()));
        String next=attemptEpoch(durableEpoch(expected),1);expected.put(MUTATION_KEY,next);
        beforeMutation();
        commitExternalWorkStamp(expected,next);
    }
    /** Local WORK bytes only. The installed-journal caller invokes this solely
     * inside its synchronous persisted external-write loan. Do not call
     * beforeMutation here: that would start a second journal transaction and
     * release the actual writer lock before the external effect. */
    private void advanceWorkStampUnderExternalWrite()throws VaultFailure {
        Map<String,Object> expected=new HashMap<>(copy(delegate.getAll()));
        String next=attemptEpoch(durableEpoch(expected),1);expected.put(MUTATION_KEY,next);
        commitExternalWorkStamp(expected,next);
    }
    private void commitExternalWorkStamp(Map<String,Object> expected,String next)throws VaultFailure {
        UNCERTAIN_MUTATIONS.add(delegate);
        try{if(!delegate.edit().putString(MUTATION_KEY,next).commit()||!NativeProtectedWorkSnapshot.exactRawEquals(expected,delegate.getAll()))throw new VaultFailure(FAILURE);}
        catch(Exception error){throw new VaultFailure(FAILURE,error);}
        UNCERTAIN_MUTATIONS.remove(delegate);
    }

    /** Compare-and-freeze exact bytes in one durable commit. Caller provides an
     * already protected context record; no credential/browser input accepted by
     * any mounted route. On ambiguous failure preserve bytes and retry exact.
     * Browser-only drafts remain UNKNOWN; this method cannot mark them empty.
     */
    void freeze(Map<String, ?> expected, String protectedContext) throws VaultFailure {
        freeze(expected,protectedContext,null);
    }
    void freeze(Map<String, ?> expected, String protectedContext,String expectedProbe) throws VaultFailure {
        if (expected == null || expected.containsKey(FENCE_KEY) || expected.containsKey(PROBE_KEY) || protectedContext == null
            || protectedContext.isEmpty() || protectedContext.length() > 262144)
            throw new VaultFailure(FAILURE);
        try { synchronized (COMMIT_LOCK) {
            if(UNCERTAIN_MUTATIONS.contains(delegate)||UNCERTAIN_CANCELLATIONS.containsKey(delegate)||hasNfcAttempt()||hasWorkAttempt())throw new VaultFailure(FAILURE);
            Map<String, ?> original = copy(expected);
            Map<String, ?> observed = copy(delegate.getAll());
            Map<String,Object> withoutProbe=new HashMap<>(observed);
            Object probe=withoutProbe.remove(PROBE_KEY);
            if((observed.containsKey(PROBE_KEY)&&!(probe instanceof String))
                ||!java.util.Objects.equals(probe,expectedProbe))throw new VaultFailure(FAILURE);
            if (observed.containsKey(FENCE_KEY)) {
                Map<String, Object> withoutFence = new HashMap<>(withoutProbe);
                Object fence = withoutFence.remove(FENCE_KEY);
                if (!protectedContext.equals(fence) || !NativeProtectedWorkSnapshot.exactRawEquals(original,withoutFence)) throw new VaultFailure(FAILURE);
                // A failed SharedPreferences commit may update MEMORY only.
                // Exact bytes must be recommitted before retry reports success.
            } else {
                if (!NativeProtectedWorkSnapshot.exactRawEquals(original,withoutProbe)) throw new VaultFailure("custodial_native_protected_work_changed");
            }
            Map<String, Object> after = new HashMap<>(original); after.put(FENCE_KEY, protectedContext);
            try {
                withDurableMutation(()->{
                    if (!delegate.edit().putString(FENCE_KEY, protectedContext).remove(PROBE_KEY).commit()
                        || !NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll())) throw new VaultFailure(FAILURE);
                    return null;
                });
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure(FAILURE, error); }
        }} catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE,error); }
    }

    /** Before transport, persist an exact pending check. No authenticated
     * conclusion exists yet, and this class exposes no cancel/thaw operation.
     * Lost connectivity leaves pending work protected, never erased/accepted. */
    void prepareProbe(Map<String,?> expected,String protectedProbe)throws VaultFailure{
        if(expected==null||expected.containsKey(FENCE_KEY)||expected.containsKey(PROBE_KEY)
            ||protectedProbe==null||protectedProbe.isEmpty()||protectedProbe.length()>262144)throw new VaultFailure(FAILURE);
        try{synchronized(COMMIT_LOCK){
            PendingProbeCancellation uncertain=UNCERTAIN_CANCELLATIONS.get(delegate);
            if(UNCERTAIN_MUTATIONS.contains(delegate)||hasNfcAttempt()||hasWorkAttempt())throw new VaultFailure(FAILURE);
            if(uncertain!=null&&(!uncertain.record.equals(protectedProbe)||!uncertain.matchesCurrent(delegate.getAll())))throw new VaultFailure(FAILURE);
            Map<String,Object> observed=new HashMap<>(copy(delegate.getAll()));
            if(observed.containsKey(FENCE_KEY))throw new VaultFailure(FAILURE);
            boolean hasProbe=observed.containsKey(PROBE_KEY);
            Object prior=observed.remove(PROBE_KEY);
            if(hasProbe&&!protectedProbe.equals(prior))throw new VaultFailure(FAILURE);
            if(!NativeProtectedWorkSnapshot.exactRawEquals(copy(expected),observed))throw new VaultFailure("custodial_native_protected_work_changed");
            observed.put(PROBE_KEY,protectedProbe);
            // Preserve the ONE original cancellation successor even when the
            // failed cancel left the old epoch visible. Never rewind a counter
            // or allocate another probe/attempt during exact recommit.
            if(uncertain!=null)observed=new HashMap<>(uncertain.restored);
            // A same-byte retry must establish disk commit, not memory visibility.
            final Map<String,Object> after=observed;
            withDurableMutation(()->{
                Editor editor=delegate.edit().putString(PROBE_KEY,protectedProbe);
                if(uncertain!=null)editor.putString(MUTATION_KEY,(String)uncertain.cancelled.get(MUTATION_KEY));
                if(!editor.commit()||!NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll()))throw new VaultFailure(FAILURE);
                return null;
            });
            // The unchanged v1 probe still hashes its original predecessor.
            // Keep private provenance until exact cancellation is terminal.
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    /** Native recovery may recover the exact marker hidden by an unsuccessful
     * memory-only removal. This value is not authority to cancel anything. */
    Object recoverableProbe(){synchronized(COMMIT_LOCK){
        if(delegate.contains(PROBE_KEY))return delegate.getAll().get(PROBE_KEY);
        PendingProbeCancellation pending=UNCERTAIN_CANCELLATIONS.get(delegate);
        return pending==null?null:pending.record;
    }}

    ProbeContinuation ownedProbeContinuation(Map<String,?> capturedWithoutProbe,String record)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            PendingProbeCancellation pending=UNCERTAIN_CANCELLATIONS.get(delegate);
            if(pending==null)return null;
            if(UNCERTAIN_MUTATIONS.contains(delegate)||hasNfcAttempt()||hasWorkAttempt()
                ||!pending.record.equals(record)||!pending.matchesCurrent(delegate.getAll()))throw new VaultFailure(FAILURE);
            Map<String,Object> actual=new HashMap<>(copy(delegate.getAll()));actual.remove(PROBE_KEY);
            if(!NativeProtectedWorkSnapshot.exactRawEquals(copy(capturedWithoutProbe),actual))throw new VaultFailure(FAILURE);
            return new ProbeContinuation(pending);
        }
    }

    /** Storage half only; caller must hold the native check owner and freshly
     * authenticate the unchanged original full principal. Cannot thaw FENCE,
     * alter work, accept missing/malformed markers, or adopt a different check. */
    void cancelProbe(Map<String,?> expected,String protectedProbe)throws VaultFailure{
        if(expected==null||expected.containsKey(FENCE_KEY)||expected.containsKey(PROBE_KEY)
            ||protectedProbe==null||protectedProbe.isEmpty())throw new VaultFailure(FAILURE);
        try{synchronized(COMMIT_LOCK){
            if(UNCERTAIN_MUTATIONS.contains(delegate)||hasNfcAttempt()||hasWorkAttempt())throw new VaultFailure(FAILURE);
            Map<String,Object> current=new HashMap<>(copy(delegate.getAll()));
            if(current.containsKey(FENCE_KEY)||!protectedProbe.equals(current.remove(PROBE_KEY))
                ||!NativeProtectedWorkSnapshot.exactRawEquals(copy(expected),current))throw new VaultFailure(FAILURE);
            PendingProbeCancellation uncertain=UNCERTAIN_CANCELLATIONS.get(delegate);
            if(uncertain!=null&&(!uncertain.record.equals(protectedProbe)||!uncertain.matchesCurrent(delegate.getAll())))throw new VaultFailure(FAILURE);
            if(uncertain==null)uncertain=new PendingProbeCancellation(current,protectedProbe);
            UNCERTAIN_CANCELLATIONS.put(delegate,uncertain);
            // Retry the same cancellation candidate, not a new epoch/body.
            String epoch=(String)uncertain.cancelled.get(MUTATION_KEY);
            current=new HashMap<>(uncertain.cancelled);
            final Map<String,Object> after=current;
            withDurableMutation(()->{
                if(!delegate.edit().remove(PROBE_KEY).putString(MUTATION_KEY,epoch).commit()||!NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll()))throw new VaultFailure(FAILURE);
                return null;
            });
            UNCERTAIN_CANCELLATIONS.remove(delegate);
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    interface OrdinaryWorkProtection<T> { T protect() throws VaultFailure; }

    /** The shared V2 alias must already exist once an original native journal
     * has been bound. A missing alias then is lost key material, NOT permission
     * to generate a replacement over retained ciphertext. The owning cipher
     * takes this coordinator BEFORE its own monitor; no cipher -> WORK lock
     * acquisition is allowed. Existing-key reads never call this method.
     * Unjournaled initial setup retains its existing owning admission checks;
     * this refusal is not a substitute for those checks or a bootstrap token. */
    static void requireUnjournaledInitialSharedKeyCreation()throws VaultFailure {
        if(!Thread.holdsLock(COMMIT_LOCK)||mutationEpochRecoveryPending
            ||mutationJournal!=null||durableMutationCurrent!=null)
            throw new VaultFailure("custodial_native_shared_key_recreation_refused");
    }

    /** One durable generation boundary for an already admitted fixed storage
     * operation. It does not authenticate or thaw WORK. Every installed-journal
     * caller keeps the persisted writer lock until its verified effect ends. */
    private static <T> T withDurableMutation(OrdinaryWorkProtection<T> operation)throws VaultFailure {
        if(!Thread.holdsLock(COMMIT_LOCK)||operation==null)throw new VaultFailure(FAILURE);
        if(mutationJournal==null){beforeMutation();return operation.protect();}
        if(mutationEpochRecoveryPending||durableMutationCurrent==null
            ||mutationEpoch==Long.MAX_VALUE)throw new VaultFailure(FAILURE);
        var original=durableMutationCurrent;
        mutationEpoch++;
        try{
            var completed=mutationJournal.commitOrdinaryExternalWrite(original,()->{
                T value=operation.protect();
                if(Boolean.FALSE.equals(value))throw new VaultFailure(FAILURE);
                return value;
            });
            if(completed==null||completed.current==null)throw new VaultFailure(FAILURE);
            durableMutationCurrent=completed.current;
            original.close();
            return completed.value;
        }catch(VaultFailure|RuntimeException|Error failure){
            mutationEpochRecoveryPending=true;
            original.close();
            throw failure;
        }
    }

    /** Admission precedes ordinary crypto, not only the eventual preferences
     * commit. Serialize against the SAME process-wide probe/freeze boundary so
     * a pre-existing hold cannot invoke key-creating encryption. This grants no
     * recovery, retirement, successful write or authority acknowledgement. */
    <T> T withOrdinaryWorkAdmission(OrdinaryWorkProtection<T> operation) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            if (operation == null || frozen()) throw new VaultFailure(FAILURE);
            return operation.protect();
        }
    }

    /** Ordinary persistence only: false/throw/ABA attempts still invalidate
     * outstanding process-local observations. Crypto-only admission is above. */
    <T> T withOrdinaryWriteAdmission(OrdinaryWorkProtection<T> operation) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            if(operation==null || frozen()) throw new VaultFailure(FAILURE);
            if(mutationJournal==null){
                // Retain legacy process-only behavior; it is not credited as a
                // durable all-writer fence or finalization admission.
                advanceDurableBeforeExternalWrite();
                return operation.protect();
            }
            return withDurableMutation(()->{
                advanceWorkStampUnderExternalWrite();
                return operation.protect();
            });
        }
    }

    static Object retainedCommitLock() { return COMMIT_LOCK; }

    /** Fixed native reader stamp only. All existing ordinary/retained write
     * attempts advance this counter before editor effects, including false or
     * throwing commits. It is NOT durable after restart, an all-writer freeze,
     * authentication, ACK, finalizer or key-retirement capability. */
    static long retainedMutationEpochForReadOnlyCapture() {
        synchronized(COMMIT_LOCK) { return mutationEpoch; }
    }

    // Exact source-object keyed ambiguity, not durable state or a transport
    // receipt. No reader is shown these bytes as if they had been committed.
    private static final class PendingRetained {
        final String identity; final Map<String,String> expected,next;
        final Object original;
        boolean writing;
        PendingRetained(String identity,Map<String,String> expected,Map<String,String> next,Object original) {
            this.identity=identity;this.expected=Collections.unmodifiableMap(new HashMap<>(expected));
            this.next=Collections.unmodifiableMap(new HashMap<>(next));this.original=original;
        }
    }
    private static final Map<SharedPreferences,PendingRetained> UNCERTAIN_RETAINED =
        new java.util.IdentityHashMap<>();
    private static Map<String,String> retainedCandidate(SharedPreferences source,String identity,Map<String,String> expected) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=UNCERTAIN_RETAINED.get(source);
            if(pending==null)return null;
            if(pending.writing || !pending.identity.equals(identity) || !expected.equals(source.getAll())
                || !pending.expected.equals(expected) && !pending.next.equals(expected)) throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return pending.next;
        }
    }
    private static boolean commitRetained(SharedPreferences source,String identity,Map<String,String> expected,
        Map<String,String> next,Object original) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            if(source==null || source instanceof AndroidProtectedWorkPreferences || expected==null || next==null
                || !expected.equals(source.getAll()) || !next.keySet().containsAll(expected.keySet())) throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            for(var entry:next.entrySet())if(entry.getKey()==null || entry.getValue()==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            PendingRetained pending=UNCERTAIN_RETAINED.get(source);
            if(pending!=null) {
                retainedCandidate(source,identity,expected);
                if(!pending.next.equals(next))throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            } else pending=new PendingRetained(identity,expected,next,original);
            // Mark before editor creation/staging/commit. Any false/exception or
            // mismatched readback retains the same original expected/candidate.
            final PendingRetained selected=pending;
            return withDurableMutation(()->{
                UNCERTAIN_RETAINED.put(source,selected);
                selected.writing=true;
                try {
                    SharedPreferences.Editor editor=source.edit();
                    for(var entry:selected.next.entrySet())editor.putString(entry.getKey(),entry.getValue());
                    if(!editor.commit() || !selected.next.equals(source.getAll()))return false;
                    UNCERTAIN_RETAINED.remove(source);return true;
                } finally { selected.writing=false; }
            });
        }
    }
    static Map<String,String> retainedCandidate(SharedPreferences source,NativeRetainedAttemptJournal.OriginalCommit original) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return retainedCandidate(source,original.identity,original.expected);
    }
    static boolean commitRetained(SharedPreferences source,NativeRetainedAttemptJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return commitRetained(source,original.identity,original.expected,next,original);
    }
    static Map<String,String> retainedCandidate(SharedPreferences source,NativeRetainedQueryJournal.OriginalCommit original) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return retainedCandidate(source,original.identity,original.expected);
    }
    static boolean commitRetained(SharedPreferences source,NativeRetainedQueryJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return commitRetained(source,original.identity,original.expected,next,original);
    }
    static Map<String,String> retainedCandidate(SharedPreferences source,NativeRetainedBatchJournal.OriginalCommit original) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return retainedCandidate(source,original.identity,original.expected);
    }
    static boolean commitRetained(SharedPreferences source,NativeRetainedBatchJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        if(original==null)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        original.requireOpen();return commitRetained(source,original.identity,original.expected,next,original);
    }
    static NativeRetainedBatchJournal.OriginalCommit pendingRetainedBatch(SharedPreferences source) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=UNCERTAIN_RETAINED.get(source);
            if(pending==null)return null;
            if(pending.writing || !(pending.original instanceof NativeRetainedBatchJournal.OriginalCommit)
                || !pending.expected.equals(source.getAll()) && !pending.next.equals(source.getAll())) throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return (NativeRetainedBatchJournal.OriginalCommit)pending.original;
        }
    }

    private static PendingRetained pendingPrepared(SharedPreferences source)throws VaultFailure {
        PendingRetained pending=UNCERTAIN_RETAINED.get(source);
        if(pending==null)return null;
        if(pending.writing || !pending.expected.equals(source.getAll()) && !pending.next.equals(source.getAll()))
            throw new VaultFailure(NativeRetainedAttempt.FAILURE);
        return pending;
    }
    static NativeRetainedAttemptJournal.PendingPrepared pendingPreparedWrite(SharedPreferences source)throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=pendingPrepared(source);if(pending==null)return null;
            if(!(pending.original instanceof NativeRetainedAttemptJournal.OriginalCommit))throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return ((NativeRetainedAttemptJournal.OriginalCommit)pending.original).pendingPrepared(pending.expected,pending.next,null);
        }
    }
    static NativeRetainedQueryJournal.PendingPrepared pendingPreparedQuery(SharedPreferences source)throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=pendingPrepared(source);if(pending==null)return null;
            if(!(pending.original instanceof NativeRetainedQueryJournal.OriginalCommit))throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return ((NativeRetainedQueryJournal.OriginalCommit)pending.original).pendingPrepared(pending.expected,pending.next,null);
        }
    }
    static NativeRetainedAttemptJournal.PendingPrepared pendingPreparedWriteSlot(SharedPreferences source,
        NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=pendingPrepared(source);if(pending==null)return null;
            if(!(pending.original instanceof NativeRetainedBatchJournal.OriginalCommit))throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return ((NativeRetainedBatchJournal.OriginalCommit)pending.original).pendingWrite(manifest,index,pending.expected,pending.next);
        }
    }
    static NativeRetainedQueryJournal.PendingPrepared pendingPreparedQuerySlot(SharedPreferences source,
        NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            PendingRetained pending=pendingPrepared(source);if(pending==null)return null;
            if(!(pending.original instanceof NativeRetainedBatchJournal.OriginalCommit))throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            return ((NativeRetainedBatchJournal.OriginalCommit)pending.original).pendingQuery(manifest,index,pending.expected,pending.next);
        }
    }

    private boolean hasNfcAttempt(){return delegate.contains(NFC_WRITE_KEY)||UNCERTAIN_NFC_ATTEMPTS.containsKey(delegate);}
    private boolean hasWorkAttempt(){return delegate.contains(WORK_WRITE_KEY)||UNCERTAIN_WORK_ATTEMPTS.containsKey(delegate);}
    private boolean malformedWorkGeneration(){
        if(!delegate.contains(WORK_GENERATION_KEY))return false;
        Object value=delegate.getAll().get(WORK_GENERATION_KEY);
        try{return !(value instanceof String)||!NativeNfcOriginalWriteAttempt.uuid((String)value).equals(value);}
        catch(VaultFailure invalid){return true;}
    }
    private boolean malformedNfcGeneration(){
        if(!delegate.contains(NFC_GENERATION_KEY))return false;
        Object value=delegate.getAll().get(NFC_GENERATION_KEY);
        try{return !(value instanceof String)||!NativeNfcOriginalWriteAttempt.uuid((String)value).equals(value);}
        catch(VaultFailure invalid){return true;}
    }
    boolean frozen() { synchronized (COMMIT_LOCK) {
        // Ordinary crypto/effect admission happens BEFORE the later write
        // counter. An interrupted metadata recovery or a stale installed
        // journal must therefore deny here too, not only in beforeMutation().
        // The existing source-owned check preserves legacy PROCESS_ONLY and
        // never creates, repairs, adopts or resets a journal during admission.
        try{
            if(mutationEpochRecoveryPending)return true;
            if(mutationJournal!=null)mutationJournal.requireOrdinaryAdmission(durableMutationCurrent);
            retainedMutationStampForReadOnlyCapture();
        }catch(VaultFailure unavailable){return true;}
        try{if(epochNumber(durableEpoch(delegate.getAll()))>Long.MAX_VALUE-2)return true;}catch(VaultFailure invalid){return true;}
        return mutationEpoch==Long.MAX_VALUE||UNCERTAIN_MUTATIONS.contains(delegate)||UNCERTAIN_CANCELLATIONS.containsKey(delegate)||hasNfcAttempt()||hasWorkAttempt()||malformedWorkGeneration()||malformedNfcGeneration()||delegate.contains(FENCE_KEY)||delegate.contains(PROBE_KEY);
    } }

    Object recoverableWorkOriginal(){synchronized(COMMIT_LOCK){
        return delegate.contains(WORK_WRITE_KEY)?delegate.getAll().get(WORK_WRITE_KEY):UNCERTAIN_WORK_ATTEMPTS.get(delegate);
    }}
    static final class PreparedWorkOriginal {
        private final SharedPreferences source;private final NativeWorkOriginalWriteAttempt attempt;
        private final String record;private boolean terminal;
        private PreparedWorkOriginal(SharedPreferences source,NativeWorkOriginalWriteAttempt attempt,String record){
            this.source=source;this.attempt=attempt;this.record=record;
        }
    }
    PreparedWorkOriginal prepareWorkOriginal(ReadOnlyObservation observation,NativeWorkOriginalWriteAttempt attempt,String record)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            Map<String,?> original=observation==null?null:observation.values;
            if(frozen()||original==null||attempt==null||record==null||record.isEmpty()||record.length()>2097152
                ||!matchesReadOnly(observation)||!NativeProtectedWorkSnapshot.exactRawEquals(original,attempt.originalFrom(original)))
                throw NativeWorkOriginalWriteAttempt.invalid();
            String epoch=attempt.stageEpoch();
            Map<String,Object> after=new HashMap<>(original);after.put(WORK_WRITE_KEY,record);after.put(MUTATION_KEY,epoch);
            UNCERTAIN_WORK_ATTEMPTS.put(delegate,record);
            withDurableMutation(()->{
                try{if(!delegate.edit().putString(WORK_WRITE_KEY,record).putString(MUTATION_KEY,epoch).commit()
                    ||!NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll()))throw NativeWorkOriginalWriteAttempt.invalid();}
                catch(Exception e){throw NativeWorkOriginalWriteAttempt.invalid();}
                return null;
            });
            return new PreparedWorkOriginal(delegate,attempt,record);
        }
    }
    PreparedWorkOriginal recoverWorkOriginal(NativeWorkOriginalWriteAttempt attempt,String record)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(attempt==null||!(recoverableWorkOriginal() instanceof String)||!record.equals(recoverableWorkOriginal())
                ||UNCERTAIN_CANCELLATIONS.containsKey(delegate)||hasNfcAttempt())throw NativeWorkOriginalWriteAttempt.invalid();
            attempt.originalFrom(copy(delegate.getAll()));UNCERTAIN_WORK_ATTEMPTS.put(delegate,record);
            return new PreparedWorkOriginal(delegate,attempt,record);
        }
    }
    /** Exact local row only; no remote acceptance, generic thaw or key effect. */
    boolean commitWorkOriginal(PreparedWorkOriginal prepared,boolean rollback)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(prepared==null||prepared.source!=delegate||prepared.terminal
                ||!prepared.record.equals(recoverableWorkOriginal())||UNCERTAIN_CANCELLATIONS.containsKey(delegate)||hasNfcAttempt())
                throw NativeWorkOriginalWriteAttempt.invalid();
            Map<String,Object> after=new HashMap<>(prepared.attempt.originalFrom(copy(delegate.getAll())));
            Map<String,String> values=prepared.attempt.writeValues(rollback);
            for(var row:values.entrySet()){if(row.getValue()==null)after.remove(row.getKey());else after.put(row.getKey(),row.getValue());}
            after.put(WORK_GENERATION_KEY,prepared.attempt.id);
            String epoch=prepared.attempt.commitEpoch();after.put(MUTATION_KEY,epoch);
            SharedPreferences.Editor editor=delegate.edit();
            for(var row:values.entrySet()){if(row.getValue()==null)editor.remove(row.getKey());else editor.putString(row.getKey(),row.getValue());}
            editor.putString(WORK_GENERATION_KEY,prepared.attempt.id).putString(MUTATION_KEY,epoch).remove(WORK_WRITE_KEY);
            boolean committed=withDurableMutation(()->{
                try{return editor.commit()&&NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll());}
                catch(Exception error){return false;}
            });
            if(!committed)return false;
            UNCERTAIN_WORK_ATTEMPTS.remove(delegate);prepared.terminal=true;return true;
        }
    }

    /** Opaque encrypted original only; not an empty/work acceptance signal. */
    Object recoverableNfcOriginal(){synchronized(COMMIT_LOCK){
        return delegate.contains(NFC_WRITE_KEY)?delegate.getAll().get(NFC_WRITE_KEY):UNCERTAIN_NFC_ATTEMPTS.get(delegate);
    }}
    static final class PreparedNfcOriginal {
        private final SharedPreferences source;private final NativeNfcOriginalWriteAttempt attempt;
        private final String record;private boolean terminal;
        private PreparedNfcOriginal(SharedPreferences source,NativeNfcOriginalWriteAttempt attempt,String record){this.source=source;this.attempt=attempt;this.record=record;}
    }
    PreparedNfcOriginal prepareNfcOriginal(ReadOnlyObservation observation,NativeNfcOriginalWriteAttempt attempt,String record)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            Map<String,?> original=observation==null?null:observation.values;
            if(frozen()||original==null||attempt==null||record==null||record.isEmpty()||record.length()>524288
                ||!matchesReadOnly(observation)
                ||!NativeProtectedWorkSnapshot.exactRawEquals(original,delegate.getAll())
                ||!NativeProtectedWorkSnapshot.exactRawEquals(original,attempt.originalFrom(original)))throw NativeNfcOriginalWriteAttempt.invalid();
            String epoch=attempt.stageEpoch();
            Map<String,Object> after=new HashMap<>(original);after.put(NFC_WRITE_KEY,record);after.put(MUTATION_KEY,epoch);
            UNCERTAIN_NFC_ATTEMPTS.put(delegate,record);
            withDurableMutation(()->{
                try{if(!delegate.edit().putString(NFC_WRITE_KEY,record).putString(MUTATION_KEY,epoch).commit()
                    ||!NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll()))throw NativeNfcOriginalWriteAttempt.invalid();}
                catch(Exception e){throw NativeNfcOriginalWriteAttempt.invalid();}
                return null;
            });
            return new PreparedNfcOriginal(delegate,attempt,record);
        }
    }
    PreparedNfcOriginal recoverNfcOriginal(NativeNfcOriginalWriteAttempt attempt,String record)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(attempt==null||!(recoverableNfcOriginal() instanceof String)||!record.equals(recoverableNfcOriginal())
                ||UNCERTAIN_CANCELLATIONS.containsKey(delegate))throw NativeNfcOriginalWriteAttempt.invalid();
            attempt.originalFrom(copy(delegate.getAll()));
            UNCERTAIN_NFC_ATTEMPTS.put(delegate,record);
            return new PreparedNfcOriginal(delegate,attempt,record);
        }
    }
    /** Only the exact fixed NFC row and original attempt generation. Synchronous
     * disk commit/readback is required before closing the pending marker. This
     * does not settle a scan, original capsule, inventory or server outcome. */
    boolean commitNfcOriginal(PreparedNfcOriginal prepared,boolean rollback)throws VaultFailure {
        synchronized(COMMIT_LOCK){
            if(prepared==null||prepared.source!=delegate||prepared.terminal
                ||!prepared.record.equals(recoverableNfcOriginal())||UNCERTAIN_CANCELLATIONS.containsKey(delegate))throw NativeNfcOriginalWriteAttempt.invalid();
            Map<String,Object> after=new HashMap<>(prepared.attempt.originalFrom(copy(delegate.getAll())));
            String value=rollback?prepared.attempt.original:prepared.attempt.candidate;
            if(value==null)after.remove(NativeNfcOriginalWriteAttempt.KEY);else after.put(NativeNfcOriginalWriteAttempt.KEY,value);
            after.put(NFC_GENERATION_KEY,prepared.attempt.id);
            String epoch=prepared.attempt.commitEpoch();after.put(MUTATION_KEY,epoch);
            SharedPreferences.Editor editor=delegate.edit();
            if(value==null)editor.remove(NativeNfcOriginalWriteAttempt.KEY);else editor.putString(NativeNfcOriginalWriteAttempt.KEY,value);
            editor.putString(NFC_GENERATION_KEY,prepared.attempt.id).putString(MUTATION_KEY,epoch).remove(NFC_WRITE_KEY);
            boolean committed=withDurableMutation(()->{
                try{return editor.commit()&&NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll());}
                catch(Exception error){return false;}
            });
            if(!committed)return false;
            UNCERTAIN_NFC_ATTEMPTS.remove(delegate);prepared.terminal=true;return true;
        }
    }
    private static Map<String, ?> copy(Map<String, ?> source) {
        if (source == null) throw new IllegalStateException("protected inventory unavailable");
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, ?> entry : source.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof Set<?>) value = Collections.unmodifiableSet(new HashSet<>((Set<?>) value));
            result.put(entry.getKey(), value);
        }
        return Collections.unmodifiableMap(result);
    }
    @Override public Map<String, ?> getAll() { return protectedSnapshot(); }
    @Override public String getString(String key, String fallback) { synchronized(COMMIT_LOCK){return delegate.getString(key,fallback);} }
    @Override public Set<String> getStringSet(String key, Set<String> fallback) {
        synchronized(COMMIT_LOCK){Set<String> value=delegate.getStringSet(key,fallback);return value==null?null:new HashSet<>(value);}
    }
    @Override public int getInt(String key,int fallback){synchronized(COMMIT_LOCK){return delegate.getInt(key,fallback);}}
    @Override public long getLong(String key,long fallback){synchronized(COMMIT_LOCK){return delegate.getLong(key,fallback);}}
    @Override public float getFloat(String key,float fallback){synchronized(COMMIT_LOCK){return delegate.getFloat(key,fallback);}}
    @Override public boolean getBoolean(String key,boolean fallback){synchronized(COMMIT_LOCK){return delegate.getBoolean(key,fallback);}}
    @Override public boolean contains(String key){synchronized(COMMIT_LOCK){return delegate.contains(key);}}
    @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){delegate.registerOnSharedPreferenceChangeListener(listener);}
    @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){delegate.unregisterOnSharedPreferenceChangeListener(listener);}
    @Override public Editor edit(){synchronized(COMMIT_LOCK){return new GuardedEditor(delegate.edit(),mutationEpoch,copy(delegate.getAll()));}}
    private final class GuardedEditor implements Editor {
        private final Editor editor;
        // A cancelled probe may legitimately unfreeze ordinary work, but an
        // editor staged before it is not a fresh writer. Pin the SAME existing
        // process observation epoch before staging, including failed commits
        // and A->B->A. This is not a persisted all-writer generation or ACK.
        private final long stagedEpoch;
        private final Map<String,?> stagedValues;
        private final Map<String,Object> nextValues;
        private boolean refused;
        GuardedEditor(Editor editor,long stagedEpoch,Map<String,?> stagedValues){this.editor=editor;this.stagedEpoch=stagedEpoch;this.stagedValues=stagedValues;this.nextValues=new HashMap<>(stagedValues);}
        private void key(String key){if(MUTATION_KEY.equals(key)||FENCE_KEY.equals(key)||PROBE_KEY.equals(key)||NFC_WRITE_KEY.equals(key)||NFC_GENERATION_KEY.equals(key)||WORK_WRITE_KEY.equals(key)||WORK_GENERATION_KEY.equals(key))refused=true;}
        private void value(String key,Object value){key(key);if(value==null)nextValues.remove(key);else nextValues.put(key,value);}
        @Override public Editor putString(String key,String value){value(key,value);editor.putString(key,value);return this;}
        @Override public Editor putStringSet(String key,Set<String> value){Set<String> snapshot=value==null?null:new HashSet<>(value);value(key,snapshot);editor.putStringSet(key,snapshot);return this;}
        @Override public Editor putInt(String key,int value){value(key,value);editor.putInt(key,value);return this;}
        @Override public Editor putLong(String key,long value){value(key,value);editor.putLong(key,value);return this;}
        @Override public Editor putFloat(String key,float value){value(key,value);editor.putFloat(key,value);return this;}
        @Override public Editor putBoolean(String key,boolean value){value(key,value);editor.putBoolean(key,value);return this;}
        @Override public Editor remove(String key){value(key,null);editor.remove(key);return this;}
        @Override public Editor clear(){refused=true;return this;}
        @Override public boolean commit(){synchronized(COMMIT_LOCK){
            if(refused||frozen()||stagedEpoch!=mutationEpoch)return false;
            // Advance BEFORE delegate entry; false/throw can leave memory-only
            // changes, so neither result may preserve a prior observation.
            try{
                if(!NativeProtectedWorkSnapshot.exactRawEquals(stagedValues,delegate.getAll()))return false;
                String next=attemptEpoch(durableEpoch(stagedValues),1);
                return withDurableMutation(()->{
                    refused=true;UNCERTAIN_MUTATIONS.add(delegate);
                    nextValues.put(MUTATION_KEY,next);
                    if(!editor.putString(MUTATION_KEY,next).commit()||!NativeProtectedWorkSnapshot.exactRawEquals(nextValues,delegate.getAll()))return false;
                    UNCERTAIN_MUTATIONS.remove(delegate);return true;
                });
            }catch(VaultFailure error){return false;}
        }}
        @Override public void apply(){throw new IllegalStateException("protected work requires synchronous verified commit");}
    }
}
