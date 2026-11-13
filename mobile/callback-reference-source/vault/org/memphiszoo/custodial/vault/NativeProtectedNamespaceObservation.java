package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** UNMOUNTED read-only observation of the eight source-declared native stores.
 * Reads only already-bound native readers. No Android discovery/open, crypto,
 * credential extraction, transport, write, freeze, ACK or deletion is provided.
 * Guarded readers detect participating process-local write attempts, including
 * byte ABA. This is not a durable cross-store freeze or restart guarantee.
 * Raw copies stay private and in memory; only counts/digests are diagnostic.
 * This does NOT inventory foreign plugin stores, browser realms or disk files.
 */
final class NativeProtectedNamespaceObservation implements AutoCloseable {
    static final String FAILURE="custodial_native_namespace_observation_unknown";
    static final String SCHEMA="custodial.native-source-namespace-observation.v1";
    static final String SHARED_KEY="SHARED_VAULT_V2";
    static final Map<String,String> KEY_FAMILIES;
    static {
        Map<String,String> groups=new TreeMap<>();
        groups.put("MemphisZooCustodialNativeVaultV2",SHARED_KEY);
        groups.put("MemphisZooCustodialOfflineAuthorityTimeV1",SHARED_KEY);
        groups.put("MemphisZooCustodialRetainedAttemptV1",SHARED_KEY);
        groups.put("MemphisZooCustodialRetainedReadQueryV1",SHARED_KEY);
        groups.put("MemphisZooCustodialRetainedBatchV1",SHARED_KEY);
        groups.put("MemphisZooCustodialNativeProviderV1","SEPARATE_PROVIDER_V1");
        groups.put("MemphisZooCustodialNativeVaultV1","LEGACY_VAULT_V1");
        groups.put("WSSecureStorageSharedPreferences","LEGACY_ALIAS_BOUND_SECURE_STORAGE");
        KEY_FAMILIES=Collections.unmodifiableMap(groups);
    }
    interface Store { Map<String,?> readAll() throws VaultFailure; }
    /** Native storage coordination only; never authentication or admission. */
    interface GuardedStore extends Store {
        Object commitCoordinator();
        long mutationEpochForReadOnlyCapture() throws VaultFailure;
        default String durableMutationStampForReadOnlyCapture()throws VaultFailure{return "PROCESS_ONLY";}
    }
    final String digest;
    final Map<String,Integer> recordCounts;
    final int recordCount;
    final String state="SOURCE_DECLARED_ROWS_OBSERVED_NOT_FROZEN";
    final String semanticInventoryState="UNKNOWN";
    final String browserInventoryState="UNKNOWN";
    final boolean frozen=false,accepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false,phoneReleased=false;
    private final Map<String,Store> stores;
    private final Object coordinator,captureLock;
    private final long originalEpoch;
    private final String originalDurableStamp;
    // Borrowed from the saved native owner; never closed/adopted here. Null
    // exclusively identifies the unchanged ordinary observation path.
    private final AndroidProtectedWorkPreferences.HeldOriginalRead heldRead;
    private Map<String,Map<String,?>> original;
    private String originalValuesSha256;

    private NativeProtectedNamespaceObservation(Map<String,Store> stores,Map<String,Map<String,?>> raw,Object coordinator,long epoch) throws VaultFailure {
        this(stores,raw,coordinator,epoch,null);
    }
    private NativeProtectedNamespaceObservation(Map<String,Store> stores,Map<String,Map<String,?>> raw,Object coordinator,long epoch,
        AndroidProtectedWorkPreferences.HeldOriginalRead heldRead) throws VaultFailure {
        this.stores=stores; original=raw;this.coordinator=coordinator;originalEpoch=epoch;
        this.heldRead=heldRead;
        originalDurableStamp=readDurableStamp(stores,coordinator,heldRead);
        // Guarded operations have one monitor, never observer -> commit order.
        captureLock=coordinator==null?this:coordinator;
        Map<String,Integer> counts=new TreeMap<>(); int total=0;
        for(var row:raw.entrySet()){counts.put(row.getKey(),row.getValue().size());total+=row.getValue().size();}
        recordCounts=Collections.unmodifiableMap(counts);recordCount=total;digest=identity(raw);
    }
    static NativeProtectedNamespaceObservation observe(Map<String,Store> readers) throws VaultFailure {
        try {
            if(readers==null||!readers.keySet().equals(KEY_FAMILIES.keySet()))throw invalid();
            Map<String,Store> bound=new TreeMap<>(readers);
            if(bound.values().stream().anyMatch(value->value==null))throw invalid();
            Set<Store> unique=Collections.newSetFromMap(new IdentityHashMap<>());
            for(Store reader:bound.values())if(!unique.add(reader))throw invalid();
            bound=Collections.unmodifiableMap(bound);
            Object coordinator=null;boolean guarded=false,unguarded=false;
            for(Store reader:bound.values()){
                if(reader instanceof GuardedStore){
                    Object lock=((GuardedStore)reader).commitCoordinator();
                    if(lock==null||(guarded&&coordinator!=lock))throw invalid();
                    coordinator=lock;guarded=true;
                }else unguarded=true;
            }
            if(guarded&&unguarded)throw invalid();
            if(!guarded)return observeBound(bound,null,-1);
            synchronized(coordinator){
                long epoch=((GuardedStore)bound.values().iterator().next()).mutationEpochForReadOnlyCapture();
                return observeBound(bound,coordinator,epoch);
            }
        } catch(VaultFailure error){throw error;}
        catch(Exception error){throw new VaultFailure(FAILURE);}
    }
    /** Existing native HELD data only. No scalar predecessor stamp or caller
     * family can enter this path, and no live ordinary stamp is fabricated. */
    static NativeProtectedNamespaceObservation observeHeldOriginal(Map<String,Store> readers,
        AndroidProtectedWorkPreferences.HeldOriginalRead lease)throws VaultFailure {
        try{
            if(lease==null||readers==null)throw invalid();
            Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
            synchronized(coordinator){
                Map<String,Store> bound=Collections.unmodifiableMap(new TreeMap<>(readers));
                if(!AndroidProtectedNamespaceReaders.isFixedOwnerFamily(bound,coordinator))throw invalid();
                lease.requireCurrent();
                long epoch=AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
                return observeBound(bound,coordinator,epoch,lease);
            }
        }catch(VaultFailure error){throw error;}
        catch(Exception error){throw new VaultFailure(FAILURE);}
    }
    private static NativeProtectedNamespaceObservation observeBound(Map<String,Store> bound,Object coordinator,long epoch)throws VaultFailure{
        return observeBound(bound,coordinator,epoch,null);
    }
    private static NativeProtectedNamespaceObservation observeBound(Map<String,Store> bound,Object coordinator,long epoch,
        AndroidProtectedWorkPreferences.HeldOriginalRead lease)throws VaultFailure{
        String stamp=readDurableStamp(bound,coordinator,lease);
        requireEpoch(bound,coordinator,epoch);
        Map<String,Map<String,?>> first=read(bound,coordinator,epoch,lease),second=read(bound,coordinator,epoch,lease);
        if(!stamp.equals(readDurableStamp(bound,coordinator,lease)))throw invalid();
        if(!same(first,second))throw invalid();
        requireEpoch(bound,coordinator,epoch);
        NativeProtectedNamespaceObservation result=new NativeProtectedNamespaceObservation(bound,first,coordinator,epoch,lease);
        // Include the original hash and final comparison in the same window.
        try{
            requireEpoch(bound,coordinator,epoch);
            if(!stamp.equals(result.originalDurableStamp))throw invalid();
            if(!same(first,read(bound,coordinator,epoch,lease)))throw invalid();
            requireEpoch(bound,coordinator,epoch);
            if(!stamp.equals(readDurableStamp(bound,coordinator,lease)))throw invalid();return result;
        }catch(VaultFailure error){result.close();throw error;}
    }
    boolean stillCurrent() throws VaultFailure {
        if(heldRead==null)return stillCurrentOrdinary();
        synchronized(captureLock){try{
            if(original==null)throw invalid();
            if(!epochCurrent(stores,coordinator,originalEpoch)
                ||!originalDurableStamp.equals(readDurableStamp(stores,coordinator,heldRead))){close();return false;}
            Map<String,Map<String,?>> current=read(stores,coordinator,originalEpoch,heldRead);
            boolean currentSource=epochCurrent(stores,coordinator,originalEpoch)&&same(original,current)
                &&originalDurableStamp.equals(readDurableStamp(stores,coordinator,heldRead));
            if(!currentSource)close();return currentSource;
        }catch(VaultFailure error){close();throw error;}
        catch(RuntimeException error){close();throw new VaultFailure(FAILURE);}
        catch(Error error){close();throw error;}}
    }
    /** Existing-only restart comparison. Current actual raw maps remain the
     * observer's source. A PRIVATE LOCAL comparison copy substitutes only the
     * exact archived snapshot to prove every other original all8 row/type is
     * retained. It never adopts the archived ACTIVE state as today's source,
     * writes a row or returns raw DATA to a caller. No ACK/effect authority. */
    void requireRestoredFinalizationOriginalData(VaultEngine.NativeOriginalInventoryFinalizationRestoredRead control,
        VaultEngine.OriginalInventoryFinalizationStoredState state)throws VaultFailure {
        if(control==null||state==null)throw invalid();
        synchronized(captureLock){byte[] originalBytes=null,currentBytes=null;NativeRetainedNamespaceValues values=null;
            try{
                if(original==null||heldRead==null||!stillCurrent())throw invalid();
                var archived=control.requireNamespaceOriginal(this,heldRead);
                var selected=state==VaultEngine.OriginalInventoryFinalizationStoredState.ORIGINAL_SNAPSHOT_PRESENT
                    ?archived:control.terminalSnapshotForReadback();
                var codec=new VaultSnapshotCodec();originalBytes=codec.encode(archived);currentBytes=codec.encode(selected);
                String vaultName="MemphisZooCustodialNativeVaultV2";
                var vault=new TreeMap<String,Object>();vault.putAll(original.get(vaultName));
                if(!java.util.Base64.getEncoder().encodeToString(currentBytes).equals(vault.get("authoritative_snapshot")))throw invalid();
                vault.put("authoritative_snapshot",java.util.Base64.getEncoder().encodeToString(originalBytes));
                var comparison=new TreeMap<String,Map<String,?>>(original);comparison.put(vaultName,vault);
                String capture=control.originalSourceCaptureForReadback();
                if(!identity(comparison).equals(capture))throw invalid();
                values=NativeRetainedNamespaceValues.capture(comparison,capture);
                if(!values.valuesSha256.equals(control.originalValuesForReadback()))throw invalid();
                if(!stillCurrent())throw invalid();control.requireNamespaceOriginal(this,heldRead);
            }catch(VaultFailure error){close();throw error;}
            catch(RuntimeException error){close();throw new VaultFailure(FAILURE);}
            catch(Error error){close();throw error;}
            finally{if(originalBytes!=null)java.util.Arrays.fill(originalBytes,(byte)0);
                if(currentBytes!=null)java.util.Arrays.fill(currentBytes,(byte)0);if(values!=null)values.close();}
        }
    }
    /** Fixed logical-enrollment readback only. This never makes the old ACTIVE
     * observation current again. Every original row, including unknown rows,
     * must remain byte/type exact except its ONE authoritative snapshot key.
     * The same installed HELD epoch/stamp remains mandatory before/after IO.
     * No ordinary writer, baseline adoption, unhold, ACK or key effect exists.
     */
    void requireExactEnrollmentSuccessor(VaultEngine.NativeOriginalInventoryFinalizationControl control)throws VaultFailure {
        if(control==null)throw invalid();
        synchronized(captureLock){byte[] encoded=null;
            try{
                if(original==null||heldRead==null||coordinator!=AndroidProtectedWorkPreferences.retainedCommitLock())throw invalid();
                var terminal=control.requireNamespaceSuccessor(this);
                heldRead.requireCurrent();requireEpoch(stores,coordinator,originalEpoch);
                if(!originalDurableStamp.equals(readDurableStamp(stores,coordinator,heldRead)))throw invalid();
                var expected=new TreeMap<String,Map<String,?>>(original);
                String vaultName="MemphisZooCustodialNativeVaultV2";
                var vault=new TreeMap<String,Object>();vault.putAll(original.get(vaultName));
                if(!(vault.get("authoritative_snapshot") instanceof String))throw invalid();
                encoded=new VaultSnapshotCodec().encode(terminal);
                vault.put("authoritative_snapshot",java.util.Base64.getEncoder().encodeToString(encoded));
                expected.put(vaultName,vault);
                if(!same(expected,read(stores,coordinator,originalEpoch,heldRead)))throw invalid();
                control.requireNamespaceSuccessor(this);heldRead.requireCurrent();requireEpoch(stores,coordinator,originalEpoch);
                if(!originalDurableStamp.equals(readDurableStamp(stores,coordinator,heldRead))
                    ||!same(expected,read(stores,coordinator,originalEpoch,heldRead)))throw invalid();
                heldRead.requireCurrent();control.requireNamespaceSuccessor(this);
            }catch(VaultFailure error){close();throw error;}
            catch(RuntimeException error){close();throw new VaultFailure(FAILURE);}
            catch(Error error){close();throw error;}
            finally{if(encoded!=null)java.util.Arrays.fill(encoded,(byte)0);}
        }
    }
    private boolean stillCurrentOrdinary() throws VaultFailure { synchronized(captureLock){
        try{
            if(original==null)throw invalid();
            if(!epochCurrent(stores,coordinator,originalEpoch)||!originalDurableStamp.equals(readDurableStamp(stores,coordinator))){close();return false;}
            Map<String,Map<String,?>> current=read(stores,coordinator,originalEpoch);
            boolean currentSource=epochCurrent(stores,coordinator,originalEpoch)&&same(original,current)
                &&originalDurableStamp.equals(readDurableStamp(stores,coordinator));
            // Observing any withdrawal retires THIS handle. Returning original
            // bytes/stamps later cannot revive it or publish a fresh baseline.
            // This adds no durable all-writer, effect or ACK authority.
            if(!currentSource)close();return currentSource;
        }catch(VaultFailure error){close();throw error;}
        catch(RuntimeException error){close();throw error;}
        catch(Error error){close();throw error;}
    }
    }
    /** Fixed native owning record binding only. The captured stamp is never
     * refreshed from later bytes and grants no freeze or acceptance authority. */
    String originalMutationStampForOwningOperation() throws VaultFailure { synchronized(captureLock){
        if(heldRead==null){if(!stillCurrent())throw invalid();return originalDurableStamp;}
        try{
            if(!stillCurrent())throw invalid();
            String predecessor=heldRead.originalStampForOwningReconstruction();
            if(!stillCurrent())throw invalid();return predecessor;
        }catch(VaultFailure error){close();throw error;}
        catch(RuntimeException error){close();throw new VaultFailure(FAILURE);}
        catch(Error error){close();throw error;}
    }}
    /** A denial tag, never permission: effect factories must reject this mode. */
    boolean heldOriginalReconstructionOnly(){return heldRead!=null;}
    /** Fixed installed-owner prerequisite for the separate logical transition.
     * Unlike a diagnostic durable-stamp string or a generic GuardedStore, this
     * requires the exact Android reader family and the SAME installed HELD
     * lease used to reconstruct these original rows. It returns no permission,
     * raw map, thaw operation or key-retirement right. Browser/manager/semantic
     * and one-attempt admission remain the Engine's separate responsibilities.
     */
    void requireInstalledOriginalHeldOwner(AndroidProtectedWorkPreferences.HeldOriginalRead expected)throws VaultFailure {
        synchronized(captureLock){try{
            if(expected==null||heldRead!=expected||coordinator==null
                ||coordinator!=AndroidProtectedWorkPreferences.retainedCommitLock()
                ||!AndroidProtectedNamespaceReaders.isFixedOwnerFamily(stores,coordinator)
                ||!stillCurrent())throw invalid();
            expected.requireCurrent();
            if(!originalDurableStamp.equals(expected.heldStampForOwningObservation())||!stillCurrent())throw invalid();
            // An installed hold is not permission to capture a later raw
            // baseline. Match the exact all8 value encoding already bound by
            // the durable original descriptor, not merely before/after bytes.
            var metadata=expected.originalMetadataForOwningRecovery();
            if(originalValuesSha256==null){
                try(var values=NativeRetainedNamespaceValues.capture(original,digest)){
                    originalValuesSha256=values.valuesSha256;
                }
            }
            if(!metadata.valuesSha256.equals(originalValuesSha256))throw invalid();
            if(!stillCurrent())throw invalid();
            expected.requireCurrent();
        }catch(VaultFailure error){close();throw error;}
        catch(RuntimeException error){close();throw new VaultFailure(FAILURE);}
        catch(Error error){close();throw error;}}
    }
    /** Typed native-only census seam. Raw captures never leave this observer
     * through a getter, generic callback, WebView or plugin endpoint. Equal
     * before/after reads are NOT an all-writer durable freeze/ABA guarantee. */
    NativeRetainedNamespaceCensus.Observation inspectRetainedJournals(
        NativeRetainedWorkCapture capture,NativeProviderPrincipal principal,long revision,String originalGeneration,
        NativeRetainedBatchJournal journal,char[] credential) throws VaultFailure {
        try{
        Map<String,Map<String,?>> raw=originalForOwningRead();
        if(capture==null||!sameRows(raw.get(NativeRetainedNamespaceCensus.WORK),capture.frozen))throw invalid();
        // Journal owners acquire their own coordinator before shared commits.
        // Do not introduce commit -> journal ordering around their callbacks.
        NativeRetainedNamespaceCensus.Observation value=NativeRetainedNamespaceCensus.inspect(
            raw,digest,capture,principal,revision,originalGeneration,journal,credential);
        requireSameOwningRead(raw);
        if(!sameRows(raw.get(NativeRetainedNamespaceCensus.WORK),capture.frozen))throw invalid();
        return value;
        }catch(VaultFailure error){refuseHeld();throw error;}
        catch(RuntimeException error){refuseHeld();throw error;}
        catch(Error error){refuseHeld();throw error;}
    }
    static String retainedCensusRowIdentity(String name,String key,Object value) throws VaultFailure {
        if(!KEY_FAMILIES.containsKey(name))throw invalid();
        return identity(Collections.singletonMap(name,Collections.singletonMap(key,value)));
    }
    /** Typed native owner-only full-value capture. No raw getter is introduced.
     * WORK must match its authenticated original frozen capture; all eight
     * stores are compared before/after encoding, including unknown rows and
     * markers. This is volatile retention, NOT atomic/durable/semantic proof. */
    NativeRetainedNamespaceValues captureRetainedOriginalValues(NativeRetainedWorkCapture work) throws VaultFailure { synchronized(captureLock){
        NativeRetainedNamespaceValues value=null;
        try {
            if(!stillCurrent()||work==null||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
            value=NativeRetainedNamespaceValues.capture(original,digest);
            if(!stillCurrent()||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen)
                ||!value.matchesOriginal(original,digest))throw invalid();
            return value;
        }catch(VaultFailure error){refuseHeld();if(value!=null)value.close();throw error;}
        catch(Exception error){refuseHeld();if(value!=null)value.close();throw invalid();}
        catch(Error error){if(heldRead!=null){refuseHeld();if(value!=null)value.close();}throw error;}
        }
    }
    /** Closed native source join only, not raw export or server custody. */
    NativeRetainedNamespaceSemanticJoin.Observation joinRetainedOriginalSemantics(
        NativeRetainedWorkCapture work,NativeRetainedNamespaceValues values,NativeProviderPrincipal principal,long revision,
        String generation,NativeRetainedNamespaceCensus.Observation journals,NativeVaultProviderReferenceCensus.Observation references) throws VaultFailure { synchronized(captureLock){
        try{
        if(!stillCurrent()||work==null||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
        NativeRetainedNamespaceSemanticJoin.Observation result=NativeRetainedNamespaceSemanticJoin.inspect(
            original,digest,values,work,principal,revision,generation,journals,references);
        if(!stillCurrent()||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();return result;
        }catch(VaultFailure error){refuseHeld();throw error;}
        catch(RuntimeException error){refuseHeld();throw error;}
        catch(Error error){refuseHeld();throw error;}
        }
    }
    /** Additive application-semantic reconciliation over the SAME raw capture.
     * It does not rewrite the already saved capsule/layout/source-join digest.
     * No browser candidates or caller-selected native rows enter this seam. */
    NativeRetainedNamespaceCompletionJoin.Observation joinOriginalCompletionSemantics(
        NativeRetainedWorkCapture work,NativeRetainedNamespaceValues values,
        NativeRetainedNamespaceSemanticJoin.Observation source,NativeRetainedCompletionCensus.Observation completions,
        NativeSeparationEvidence proof,NativeProviderPrincipal principal,long revision,String generation)throws VaultFailure { synchronized(captureLock){
        try{
        if(!stillCurrent()||work==null||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
        NativeRetainedNamespaceCompletionJoin.Observation result=NativeRetainedNamespaceCompletionJoin.inspect(
            original,digest,work,values,source,completions,proof,principal,revision,generation);
        if(!stillCurrent()||!sameRows(original.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();return result;
        }catch(VaultFailure error){refuseHeld();throw error;}
        catch(RuntimeException error){refuseHeld();throw error;}
        catch(Error error){refuseHeld();throw error;}
        }
    }
    /** Original owning vault/provider typed seam, no generic raw callback. */
    NativeVaultProviderReferenceCensus.Observation inspectOriginalVaultProviderReferences(
        NativeRetainedWorkCapture work,VaultPersistence persistence,VaultSnapshot original,NativeProviderJournal provider,
        NativeProviderPrincipal principal,NativeSeparationContext context,NativeProviderJournal.OriginalGeneration generation) throws VaultFailure {
        try{
        Map<String,Map<String,?>> raw=originalForOwningRead();
        if(work==null||!sameRows(raw.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
        NativeVaultProviderReferenceCensus.Observation result=NativeVaultProviderReferenceCensus.inspect(
            raw,digest,persistence,original,provider,principal,context,generation);
        requireSameOwningRead(raw);
        if(!sameRows(raw.get(NativeRetainedNamespaceCensus.WORK),work.frozen))throw invalid();
        return result;
        }catch(VaultFailure error){refuseHeld();throw error;}
        catch(RuntimeException error){refuseHeld();throw error;}
        catch(Error error){refuseHeld();throw error;}
    }
    // Private immutable capture only; it never leaves the closed owning joins.
    // Close and participating writes during a join are checked again afterward.
    private Map<String,Map<String,?>> originalForOwningRead()throws VaultFailure {synchronized(captureLock){
        if(!stillCurrent())throw invalid();return original;
    }}
    private void requireSameOwningRead(Map<String,Map<String,?>> raw)throws VaultFailure {synchronized(captureLock){
        if(original!=raw||!stillCurrent())throw invalid();
    }}
    private void refuseHeld(){if(heldRead!=null)close();}
    @Override public void close(){synchronized(captureLock){original=null;originalValuesSha256=null;}} // Not a secure-erasure guarantee for Java strings.

    private static String readDurableStamp(Map<String,Store> stores,Object coordinator)throws VaultFailure{
        if(coordinator==null)return "UNGUARDED";
        String fixed=AndroidProtectedNamespaceReaders.readFixedOwnerDurableStamp(stores,coordinator);
        if(fixed!=null){requireDurableStamp(fixed);return fixed;}
        String stamp=null;
        for(Store reader:stores.values()){
            if(!(reader instanceof GuardedStore))throw invalid();
            String value=((GuardedStore)reader).durableMutationStampForReadOnlyCapture();
            requireDurableStamp(value);
            if(stamp!=null&&!stamp.equals(value))throw invalid();stamp=value;
        }
        if(stamp==null)throw invalid();return stamp;
    }
    private static String readDurableStamp(Map<String,Store> stores,Object coordinator,
        AndroidProtectedWorkPreferences.HeldOriginalRead lease)throws VaultFailure{
        if(lease==null)return readDurableStamp(stores,coordinator);
        if(!AndroidProtectedNamespaceReaders.isFixedOwnerFamily(stores,coordinator))throw invalid();
        String stamp=lease.heldStampForOwningObservation();
        if(stamp==null||!stamp.matches("DURABLE_HELD:[1-9][0-9]{0,18}"))throw invalid();
        try{Long.parseLong(stamp.substring("DURABLE_HELD:".length()));}
        catch(NumberFormatException outsideCounterRange){throw invalid();}
        return stamp;
    }
    private static void requireDurableStamp(String value)throws VaultFailure{
        if(value==null||(!value.equals("PROCESS_ONLY")&&!value.matches("DURABLE_ATTEMPT:(?:0|[1-9][0-9]{0,18})")))throw invalid();
        if(value.startsWith("DURABLE_ATTEMPT:"))try{Long.parseLong(value.substring("DURABLE_ATTEMPT:".length()));}
        catch(NumberFormatException outsideCounterRange){throw invalid();}
    }
    private static boolean epochCurrent(Map<String,Store> stores,Object coordinator,long epoch)throws VaultFailure{
        if(coordinator==null)return true;
        if(epoch<0)throw invalid();boolean current=true;
        for(Store reader:stores.values()){
            if(!(reader instanceof GuardedStore))throw invalid();
            GuardedStore guard=(GuardedStore)reader;
            if(guard.commitCoordinator()!=coordinator)throw invalid();
            long observed=guard.mutationEpochForReadOnlyCapture();
            if(guard.commitCoordinator()!=coordinator)throw invalid();
            if(observed<0)throw invalid();
            if(observed!=epoch)current=false;
        }
        return current;
    }
    private static void requireEpoch(Map<String,Store> stores,Object coordinator,long epoch)throws VaultFailure{
        if(!epochCurrent(stores,coordinator,epoch))throw invalid();
    }
    private static Map<String,Map<String,?>> read(Map<String,Store> stores,Object coordinator,long epoch) throws VaultFailure {
        return read(stores,coordinator,epoch,null);
    }
    private static Map<String,Map<String,?>> read(Map<String,Store> stores,Object coordinator,long epoch,
        AndroidProtectedWorkPreferences.HeldOriginalRead lease) throws VaultFailure {
        Map<String,Map<String,?>> all=new TreeMap<>();Budget budget=new Budget();
        String stamp=readDurableStamp(stores,coordinator,lease);
        try {
            if(coordinator!=null&&AndroidProtectedNamespaceReaders.isFixedOwnerFamily(stores,coordinator)){
                // Exact private final BoundStore family, SAME held native
                // coordinator. Keep the first pre-read and EVERY post-read/
                // post-copy check, including the final row's checks.
                requireEpoch(stores,coordinator,epoch);
                if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                for(String name:KEY_FAMILIES.keySet()){
                    Map<String,?> source=stores.get(name).readAll();
                    requireEpoch(stores,coordinator,epoch);
                    if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                    Map<String,?> copy=copy(name,source,budget);
                    if(!sameRows(copy,source))throw invalid();
                    requireEpoch(stores,coordinator,epoch);
                    if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                    // Only local TreeMap.put with final String keys and the
                    // immutable KEY_FAMILIES iterator lie before the next
                    // fixed readAll: no IO, caller code or callback. The last
                    // post-copy boundary is that next read's pre-read boundary,
                    // not a verdict retained across any read/copy/lease check.
                    all.put(name,copy);
                }
                return Collections.unmodifiableMap(all);
            }
            // Generic/mixed readers may run callbacks in their guard methods.
            // Their original full-check loop remains unchanged.
            for(String name:KEY_FAMILIES.keySet()){
                requireEpoch(stores,coordinator,epoch);
                if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                Map<String,?> source=stores.get(name).readAll();
                requireEpoch(stores,coordinator,epoch);
                if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                Map<String,?> copy=copy(name,source,budget);
                if(!sameRows(copy,source))throw invalid();
                requireEpoch(stores,coordinator,epoch);
                if(!stamp.equals(readDurableStamp(stores,coordinator,lease)))throw invalid();
                all.put(name,copy);
            }
            return Collections.unmodifiableMap(all);
        }catch(VaultFailure error){throw error;}
        catch(Exception error){throw new VaultFailure(FAILURE);}
    }
    private static Map<String,?> copy(String namespace,Map<String,?> source,Budget budget) throws VaultFailure {
        if(source==null||source.size()>4096)throw invalid();
        Map<String,Object> result=new TreeMap<>();int count=0;
        for(var row:source.entrySet()){
            if(++count>4096||++budget.records>32768)throw invalid();
            String key=row.getKey();Object value=row.getValue();
            if(key==null||key.isEmpty()||key.length()>1024||result.containsKey(key))throw invalid();
            budget.string(key);
            if(value instanceof String)budget.string((String)value,
                NativeRetainedNamespaceCensus.WORK.equals(namespace)?NativeProtectedWorkSnapshot.retainedStringLimit(key):524288);
            else if(value instanceof Set<?>){
                if(((Set<?>)value).size()>4096)throw invalid();Set<String> items=new HashSet<>();int n=0;
                for(Object item:(Set<?>)value){if(++n>4096||!(item instanceof String)||!items.add((String)item))throw invalid();budget.string((String)item);}
                if(n!=((Set<?>)value).size())throw invalid();value=Collections.unmodifiableSet(items);
            }else if(!(value instanceof Integer||value instanceof Long||value instanceof Boolean||value instanceof Float))throw invalid();
            result.put(key,value);
        }
        if(count!=source.size())throw invalid();return Collections.unmodifiableMap(result);
    }
    private static final class Budget {
        int records;long characters;
        void string(String text) throws VaultFailure {
            string(text,524288);
        }
        void string(String text,int cellLimit) throws VaultFailure {
            if(text.length()>cellLimit||(characters+=text.length())>8388608)throw invalid();
        }
    }
    private static boolean same(Map<String,Map<String,?>> a,Map<String,Map<String,?>> b) throws VaultFailure {
        if(!a.keySet().equals(b.keySet()))return false;
        for(String name:a.keySet())if(!sameRows(a.get(name),b.get(name)))return false;return true;
    }
    private static boolean sameRows(Map<String,?> a,Map<String,?> b) throws VaultFailure {
        if(a==null||b==null||a.size()!=b.size()||!a.keySet().equals(b.keySet()))return false;
        for(String key:a.keySet()){
            Object x=a.get(key),y=b.get(key);
            if(x instanceof Float){if(!(y instanceof Float)||Float.floatToRawIntBits((Float)x)!=Float.floatToRawIntBits((Float)y))return false;}
            else if(x instanceof Set<?>){if(!(y instanceof Set<?>)||!x.equals(y))return false;}
            else if(x==null||y==null||x.getClass()!=y.getClass()||!x.equals(y))return false;
        }
        return true;
    }
    private static String identity(Map<String,Map<String,?>> raw) throws VaultFailure {
        try {
            MessageDigest hash=MessageDigest.getInstance("SHA-256");text(hash,SCHEMA);
            number(hash,raw.size());
            for(String name:new TreeSet<>(raw.keySet())){
                text(hash,name);Map<String,?> rows=raw.get(name);number(hash,rows.size());
                for(String key:new TreeSet<>(rows.keySet())){
                    text(hash,key);Object value=rows.get(key);
                    if(value instanceof String){text(hash,"string");text(hash,(String)value);}
                    else if(value instanceof Integer){text(hash,"int32");text(hash,value.toString());}
                    else if(value instanceof Long){text(hash,"int64");text(hash,value.toString());}
                    else if(value instanceof Boolean){text(hash,"boolean");hash.update((byte)((Boolean)value?1:0));}
                    else if(value instanceof Float){text(hash,"float32");number(hash,Float.floatToRawIntBits((Float)value));}
                    else if(value instanceof Set<?>){text(hash,"string-set");Set<String> items=new TreeSet<>();for(Object item:(Set<?>)value)items.add((String)item);number(hash,items.size());for(String item:items)text(hash,item);}
                    else throw invalid();
                }
            }
            StringBuilder out=new StringBuilder(64);for(byte value:hash.digest())out.append(Character.forDigit((value&255)>>>4,16)).append(Character.forDigit(value&15,16));return out.toString();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE);}
    }
    private static void text(MessageDigest hash,String value){number(hash,value.length());for(int i=0;i<value.length();i++){char c=value.charAt(i);hash.update((byte)(c>>>8));hash.update((byte)c);}}
    private static void number(MessageDigest hash,int value){for(int shift=24;shift>=0;shift-=8)hash.update((byte)(value>>>shift));}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
