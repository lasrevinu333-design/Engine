package org.memphiszoo.custodial.vault;

import android.content.Context;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;

/** Internal explicit native original coordination; never startup/employee configuration.
 * All names and native no-backup stores are fixed. Opening preference handles
 * is not an edit, key creation, provider activation or freeze. Ordinary effect
 * admission, complete namespace semantics and protected manager trigger remain
 * separate. No JS/API, remote collector, arbitrary caller IDs or raw getter. */
final class AndroidPrivateCustodyOwnerRecovery {
    /** Fixed local existing-only restart read. No current ACTIVE vault,
     * provider owner, browser recapture or network is manufactured to inspect
     * an original/fixed-successor outcome. All owners come from this Context. */
    static JSONObject inspectOriginalFinalization(Context context,VaultEngine engine,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(context==null||engine==null||control==null||Thread.holdsLock(engine))
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        control.check();Context application=context.getApplicationContext();
        if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();control.check();
            synchronized(engine){
                Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
                for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                    existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
                var readers=AndroidProtectedNamespaceReaders.bind(existing);
                var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                var capsules=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                var result=engine.inspectExistingOriginalFinalization(readers,journal,capsules,held,control);
                held.requireCurrent();control.check();return result;
            }
        }
    }
    /** Explicit native FIRST baseline only. No plugin/startup trigger or caller
     * paths/IDs. The Engine verifies frozen WORK/current principal and unique
     * original provider context, and refuses any saved/pending operation. */
    static void establishInitialNativeMutationBaseline(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||providerCoordinator==null||control==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();Context application=context.getApplicationContext();if(application==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        synchronized(engine){synchronized(providerCoordinator){
            control.check();Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            engine.establishInitialNativeMutationBaseline(application,work,principal,legacy,provider,readers,control);
        }}
        control.check();
    }
    /** FIRST local snapshot only. All factories share this fixed application's
     * native no-backup root; the Engine owns authentication/absence/retention.
     * No supplied root/generation, startup trigger, HTTP or original retry. */
    static JSONObject retainInitialOriginal(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||providerCoordinator==null||control==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();Context application=context.getApplicationContext();if(application==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);
        synchronized(engine){synchronized(providerCoordinator){
            control.check();Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            var batches=new AndroidRetainedBatchStore(application).journal();
            var result=engine.retainInitialOriginalPrivateCustody(application,work,principal,legacy,provider,batches,readers,control);
            control.check();return result;
        }}
    }
    /** Explicit native saved-original current read, never startup/resume or a
     * plugin endpoint. Preparation borrows the fixed existing owners under
     * engine -> providerCoordinator; HTTP must run after BOTH are released.
     * The typed result, not this helper, owns the reconstructed scope on success.
     */
    static VaultEngine.NativePrivateCustodyCurrentFrameRead readSavedOriginalCurrentFrame(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return savedOriginalCurrentFrame(context,engine,work,principal,legacy,providerCoordinator,http,control,false,false,null);
    }
    /** Browser-only saved DATA preparation precedes the actual fresh HTTP
     * observation. Same fixed owner/plan/control; no stale lease is renewed,
     * no caller identity is accepted, and ordinary readers stay unchanged. */
    static VaultEngine.NativePrivateCustodyCurrentFrameRead readSavedOriginalCurrentFrameForBrowserPreparation(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return savedOriginalCurrentFrame(context,engine,work,principal,legacy,providerCoordinator,http,control,false,true,null);
    }
    /** Explicit installed-HELD read only. No failed ordinary read is silently
     * retried as this mode; the fixed Runtime action must select it directly. */
    static VaultEngine.NativePrivateCustodyCurrentFrameRead readHeldSavedOriginalCurrentFrameForBrowserPreparation(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        control.check();var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead();
        try{return savedOriginalCurrentFrame(context,engine,work,principal,legacy,providerCoordinator,http,control,false,true,held);}
        catch(VaultFailure|RuntimeException|Error failure){held.close();throw failure;}
    }
    /** Explicit initial original custody, not a resend/resume selector. The
     * Engine alone checks saved operation identities and existing UNKNOWNs. */
    static VaultEngine.NativePrivateCustodyCurrentFrameRead retainSavedOriginalCurrentFrame(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return savedOriginalCurrentFrame(context,engine,work,principal,legacy,providerCoordinator,http,control,true,false,null);
    }
    /** Explicit request-retention phase only, from this application's normal
     * existing native owners. No current read follows automatically and no
     * reconstructed owner transfers with the detached historical stage DATA. */
    static JSONObject retainSavedOriginalRequests(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null||http==null||control==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();Context application=context.getApplicationContext();
        if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        var exchanges=AndroidPrivateCustodyExchangeJournal.fromNativeContext(application);
        VaultEngine.NativePrivateCustodySavedReadOwner prepared=null;Throwable primary=null;
        try{
            synchronized(engine){synchronized(providerCoordinator){
                control.check();Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
                for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                    existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
                var readers=AndroidProtectedNamespaceReaders.bind(existing);
                var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
                var batch=new AndroidRetainedBatchStore(application).journal();
                prepared=engine.prepareSavedOriginalPrivateCustodyCurrentRead(work,principal,legacy,provider,batch,readers,capsules,operations);
            }}
            // No externally held Engine/provider monitor can reach this call.
            // The SAME control covers reconstruction and the producer phase.
            control.check();
            var result=engine.retainSavedOriginalPrivateCustodyRequests(prepared,exchanges,http,control);
            control.check();return result;
        }catch(VaultFailure|RuntimeException|Error failure){primary=failure;throw failure;}
        finally{
            // Always owned here, even if Engine entry refused before claiming.
            // A successful stage has already closed it; close is idempotent.
            if(prepared!=null)try{prepared.close();}
            catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
        }
    }
    // Fixed native entry points above, not a caller-supplied permission/flag.
    private static VaultEngine.NativePrivateCustodyCurrentFrameRead savedOriginalCurrentFrame(
        Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyHttp http,NativePrivateCustodyFrameReadControl control,boolean initialCustody,boolean browserPreparation,
        AndroidProtectedWorkPreferences.HeldOriginalRead heldSource)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null||http==null||control==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(initialCustody&&browserPreparation)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(heldSource!=null&&(initialCustody||!browserPreparation))throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        // Reentrant callers cannot release an externally held monitor merely
        // by leaving the nested preparation block. Refuse BEFORE any effects.
        if(Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);
        // The existing API26/no-backup factories precede preference handles.
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        var exchanges=AndroidPrivateCustodyExchangeJournal.fromNativeContext(application);
        VaultEngine.NativePrivateCustodySavedReadOwner prepared=null;
        boolean transferred=false;Throwable primary=null;
        try {
            synchronized(engine){synchronized(providerCoordinator){
                Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
                for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                    existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
                var readers=AndroidProtectedNamespaceReaders.bind(existing);
                var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
                var batch=new AndroidRetainedBatchStore(application).journal();
                prepared=heldSource==null?engine.prepareSavedOriginalPrivateCustodyCurrentRead(work,principal,legacy,provider,batch,readers,capsules,operations)
                    :engine.prepareSavedHeldOriginalPrivateCustodyCurrentRead(work,principal,legacy,provider,batch,readers,capsules,operations,heldSource);
            }}
            // Both preparation monitors are released here. Refuse a frame
            // whose coordination budget/cancellation expired during preparation.
            control.check();
            var result=browserPreparation?engine.readSavedOriginalPrivateCustodyCurrentFrameForBrowserPreparation(prepared,exchanges,http,control)
                :initialCustody?engine.retainSavedOriginalPrivateCustodyFrame(prepared,exchanges,http,control)
                :engine.readSavedOriginalPrivateCustodyCurrentFrame(prepared,exchanges,http,control);
            transferred=true;return result;
        }catch(VaultFailure|RuntimeException|Error failure){primary=failure;throw failure;}
        finally {
            if(!transferred&&prepared!=null)try{prepared.close();}
            catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
        }
    }
    /** Explicit local recovery of EXISTING saved-original piece journals only.
     * No HTTP, caller identity/range, missing-record preparation or saved-owner
     * transfer. The Engine owns exact original force/alias recovery; a partial
     * or canceled outcome preserves records and cannot authorize dispatch. */
    static JSONObject resumeSavedOriginalPieceJournals(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null||control==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        if(Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_native_vault_concurrent_change");
        control.check();
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        var exchanges=AndroidPrivateCustodyExchangeJournal.fromNativeContext(application);
        VaultEngine.NativePrivateCustodySavedReadOwner prepared=null;Throwable primary=null;
        try {
            synchronized(engine){synchronized(providerCoordinator){
                control.check();Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
                for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                    existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
                var readers=AndroidProtectedNamespaceReaders.bind(existing);
                var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
                var batch=new AndroidRetainedBatchStore(application).journal();
                prepared=engine.prepareSavedOriginalPrivateCustodyCurrentRead(work,principal,legacy,provider,batch,readers,capsules,operations);
                control.check();
            }}
            control.check();
            var result=engine.resumeSavedOriginalPrivateCustodyPieceJournals(prepared,exchanges,control);
            control.check();return result;
        }catch(VaultFailure|RuntimeException|Error failure){primary=failure;throw failure;}
        finally {
            // No transfer on success. This also closes preparation if the
            // Engine's own finally was never entered (e.g. preentry refusal).
            if(prepared!=null)try{prepared.close();}
            catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
        }
    }
    static JSONObject observeOriginal(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        // Existing API26 factory preflight happens before preference handles.
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        var exchanges=AndroidPrivateCustodyExchangeJournal.fromNativeContext(application);
        synchronized(engine){synchronized(providerCoordinator){
            Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            var batch=new AndroidRetainedBatchStore(application).journal();
            return engine.recoverOriginalPrivateCustodyPiecesFromSavedOperation(work,principal,legacy,provider,batch,readers,capsules,operations,exchanges);
        }}
    }
    /** Same fixed read-only owners; caller cannot request commit/resume or
     * select an operation, generation, range, path or permission. */
    static JSONObject observePendingOriginal(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        synchronized(engine){synchronized(providerCoordinator){
            Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            var batch=new AndroidRetainedBatchStore(application).journal();
            return engine.inspectPendingOriginalPrivateCustodyOwner(work,principal,legacy,provider,batch,readers,capsules,operations);
        }}
    }
    /** Explicit read-only saved-original application semantics. This opens no
     * transport journal, creates no plan and does not authenticate a manager. */
    static JSONObject observeSavedCompletionSemantics(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        synchronized(engine){synchronized(providerCoordinator){
            Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            var batch=new AndroidRetainedBatchStore(application).journal();
            return engine.inspectSavedOriginalPrivateCustodyCompletionSemantics(work,principal,legacy,provider,batch,readers,capsules,operations);
        }}
    }
    /** Fixed local resume only, from an already encrypted pending original.
     * No new UUID/signature/ciphertext, transport, ACK or removal is attempted. */
    static JSONObject resumePendingOriginal(Context context,VaultEngine engine,AndroidOfflineAuthorityTimeStore work,
        NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,Object providerCoordinator)throws VaultFailure {
        if(context==null||engine==null||work==null||principal==null||legacy==null||providerCoordinator==null)
            throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        Context application=context.getApplicationContext();if(application==null)throw new VaultFailure(NativePrivateCustodyOperationStore.FAILURE);
        var operations=AndroidPrivateCustodyOperationStore.fromNativeContext(application);
        var capsules=AndroidPrivateCapsuleFileStore.fromNativeContext(application);
        synchronized(engine){synchronized(providerCoordinator){
            Map<String,android.content.SharedPreferences> existing=new TreeMap<>();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())
                existing.put(name,application.getSharedPreferences(name,Context.MODE_PRIVATE));
            var readers=AndroidProtectedNamespaceReaders.bind(existing);
            var provider=new NativeProviderJournal(new AndroidProviderStore(application).records(),providerCoordinator);
            var batch=new AndroidRetainedBatchStore(application).journal();
            return engine.resumeSavedOriginalPendingPrivateCustodyOwner(work,principal,legacy,provider,batch,readers,capsules,operations);
        }}
    }
    private AndroidPrivateCustodyOwnerRecovery(){}
}
