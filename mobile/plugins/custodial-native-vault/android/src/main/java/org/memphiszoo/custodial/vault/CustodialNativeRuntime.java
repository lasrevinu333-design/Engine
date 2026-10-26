package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.SystemClock;
import android.provider.Settings;
import java.util.Map;
import org.json.JSONObject;

/** One application-context native runtime, available before an Activity or Capacitor.
 * Construction extracts the existing owners, without calling enrollment, recovery,
 * provider registration or notification effects. Activity-backed gates remain in plugin. */
final class CustodialNativeRuntime {
    private static CustodialNativeRuntime instance;
    final VaultEngine engine;
    final AndroidOfflineAuthorityTimeStore offlineStore;
    final OfflineAuthorityTime offlineTime;
    final NativePrincipalJournal principalJournal;
    final NativeLegacyLineageJournal legacyJournal;
    final Object providerCoordinator = new Object();
    private final Context application;
    private NativeProviderRuntimeOwner localProviderOwner;
    private NativeOriginalBrowserPreparation originalBrowser;
    private CustodialNativeVaultPlugin originalBrowserOwner;
    private com.getcapacitor.Bridge originalBrowserBridge;
    private android.webkit.WebView originalBrowserView;
    private boolean originalBrowserAttachmentRefused;
    // Cleanup identity survives authority detachment. Never consulted for
    // capture, registration, dispatch or receipt admission.
    private final java.util.IdentityHashMap<android.webkit.WebView,OriginalBrowserCleanup> originalBrowserCleanups=
        new java.util.IdentityHashMap<>();
    static final class OriginalBrowserCleanup {
        private final CustodialNativeRuntime runtime;
        private final CustodialNativeVaultPlugin owner;
        private final com.getcapacitor.Bridge bridge;
        private final android.webkit.WebView view;
        private NativeOriginalBrowserPreparation source;
        private OriginalBrowserCleanup(CustodialNativeRuntime runtime,CustodialNativeVaultPlugin owner,
            com.getcapacitor.Bridge bridge,android.webkit.WebView view){
            this.runtime=runtime;this.owner=owner;this.bridge=bridge;this.view=view;
        }
        void bind(NativeOriginalBrowserPreparation actual,com.getcapacitor.Bridge actualBridge,
            android.webkit.WebView actualView)throws VaultFailure {
            synchronized(runtime){
                if(actual==null||source!=null||actualBridge!=bridge||actualView!=view
                    ||runtime.originalBrowserCleanups.get(view)!=this)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                source=actual;
            }
        }
        void finished(NativeOriginalBrowserPreparation actual){
            synchronized(runtime){
                if(source==actual&&runtime.originalBrowserCleanups.get(view)==this)
                    runtime.originalBrowserCleanups.remove(view);
            }
        }
        private void drainForDestroyedOwner(CustodialNativeVaultPlugin actualOwner){
            if(actualOwner!=owner||source==null||runtime.originalBrowserCleanups.get(view)!=this
                ||!owner.ownsOriginalBrowserDestruction(runtime,bridge,view))return;
            source.finishPhysicalCleanupForOwnerDestruction(this);
        }
        boolean permitsOwnerDestruction(NativeOriginalBrowserPreparation actual,
            com.getcapacitor.Bridge actualBridge,android.webkit.WebView actualView){
            synchronized(runtime){
                return source==actual&&bridge==actualBridge&&view==actualView
                    &&runtime.originalBrowserCleanups.get(view)==this
                    &&owner.ownsOriginalBrowserDestruction(runtime,bridge,view);
            }
        }
    }
    private final java.util.IdentityHashMap<android.webkit.WebView,RecurringBrowserCleanup> recurringBrowserCleanups=
        new java.util.IdentityHashMap<>();
    /** Native view lifetime for cleanup ONLY, independent of authority detach. */
    static final class RecurringBrowserCleanup {
        private final CustodialNativeRuntime runtime;
        private final CustodialNativeVaultPlugin owner;
        private final com.getcapacitor.Bridge bridge;
        private final android.webkit.WebView view;
        private NativeRecurringApplicationSource source;
        private RecurringBrowserCleanup(CustodialNativeRuntime runtime,CustodialNativeVaultPlugin owner,
            com.getcapacitor.Bridge bridge,android.webkit.WebView view){
            this.runtime=runtime;this.owner=owner;this.bridge=bridge;this.view=view;
        }
        void bind(NativeRecurringApplicationSource actual,com.getcapacitor.Bridge actualBridge,
            android.webkit.WebView actualView)throws VaultFailure {
            synchronized(runtime){
                if(actual==null||source!=null||actualBridge!=bridge||actualView!=view
                    ||runtime.recurringBrowserCleanups.get(view)!=this)
                    throw new VaultFailure("custodial_recurring_application_source_unavailable");
                source=actual;
            }
        }
        boolean permitsOwnerDestruction(NativeRecurringApplicationSource actual,
            com.getcapacitor.Bridge actualBridge,android.webkit.WebView actualView){
            synchronized(runtime){return source==actual&&bridge==actualBridge&&view==actualView
                &&runtime.recurringBrowserCleanups.get(view)==this
                &&owner.ownsOriginalBrowserDestruction(runtime,bridge,view);}
        }
        VaultEngine originalWriterAbortEngine(NativeRecurringApplicationSource actual,
            com.getcapacitor.Bridge actualBridge,android.webkit.WebView actualView)throws VaultFailure {
            synchronized(runtime){
                if(source!=actual||bridge!=actualBridge||view!=actualView
                    ||runtime.recurringBrowserCleanups.get(view)!=this)
                    throw new VaultFailure("custodial_recurring_application_source_unavailable");
                return runtime.engine;
            }
        }
        void requestOrdinaryRender(NativeRecurringApplicationSource actual,NativeRecurringApplicationSource.OrdinaryRenderWake wake)throws VaultFailure {
            synchronized(runtime){
                if(source!=actual||runtime.recurringApplication!=actual||runtime.recurringApplicationRetired
                    ||runtime.originalBrowserOwner!=owner||runtime.originalBrowserBridge!=bridge||runtime.originalBrowserView!=view
                    ||runtime.recurringBrowserCleanups.get(view)!=this)throw new VaultFailure("custodial_recurring_application_source_unavailable");
                actual.requireAttachedView(view);wake.requireCurrent(actual);
            }
            runtime.scheduleOrdinaryRecurringCoordinator(owner,actual,wake);
        }
        private void drainForDestroyedOwner(CustodialNativeVaultPlugin actualOwner){
            if(actualOwner!=owner||source==null||runtime.recurringBrowserCleanups.get(view)!=this
                ||!owner.ownsOriginalBrowserDestruction(runtime,bridge,view))return;
            try{source.finishCleanupForOwnerDestruction(this);}
            finally{if(runtime.recurringBrowserCleanups.get(view)==this)runtime.recurringBrowserCleanups.remove(view);}
        }
    }
    private NativeRecurringApplicationSource recurringApplication;
    private boolean recurringApplicationAttachmentAttempted,recurringApplicationRetired;
    private OrdinaryCoordinatorTask ordinaryCoordinatorCurrent,ordinaryCoordinatorPending;
    private VaultEngine.NativeOrdinaryRecurringTrigger ordinaryCoordinatorLastTrigger;
    private String ordinaryRecoveryLastKey;
    private volatile int ordinaryRecoveryUnavailable;
    private volatile boolean ordinaryRecoveryObservationUnavailable;
    static final class OrdinaryCoordinatorTask {
        private final CustodialNativeVaultPlugin owner;private final NativeRecurringApplicationSource source;
        private final NativeRecurringApplicationSource.OrdinaryRenderWake wake;
        private final VaultEngine.NativeOrdinaryRecurringTrigger trigger;
        private OrdinaryCoordinatorTask(CustodialNativeVaultPlugin owner,NativeRecurringApplicationSource source,
            NativeRecurringApplicationSource.OrdinaryRenderWake wake,VaultEngine.NativeOrdinaryRecurringTrigger trigger){
            this.owner=owner;this.source=source;this.wake=wake;this.trigger=trigger;
        }
    }
    private void scheduleOrdinaryRecurringCoordinator(CustodialNativeVaultPlugin owner,NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.OrdinaryRenderWake wake)throws VaultFailure {
        // Capture actual native issue outside Runtime monitor. No UI/HTTP wait.
        var trigger=engine.captureOrdinaryRecurringTrigger(this);
        var task=new OrdinaryCoordinatorTask(owner,source,wake,trigger);
        synchronized(this){
            if(recurringApplicationRetired||recurringApplication!=source||originalBrowserOwner!=owner)throw new VaultFailure("custodial_recurring_application_source_unavailable");
            wake.requireCurrent(source);
            if(ordinaryCoordinatorLastTrigger!=null&&ordinaryCoordinatorLastTrigger.sameIssue(trigger))return;
            if(ordinaryCoordinatorCurrent!=null){ordinaryCoordinatorPending=task;return;}
            ordinaryCoordinatorCurrent=task;ordinaryCoordinatorLastTrigger=trigger;
        }
        if(!owner.enqueueOrdinaryRecurringCoordinator(this,task))finishOrdinaryRecurringCoordinator(task);
    }
    void runOrdinaryRecurringCoordinator(CustodialNativeVaultPlugin owner,OrdinaryCoordinatorTask task){
        boolean outcomeRead=false,admittedWake=false;
        try{
            synchronized(this){if(task==null||task!=ordinaryCoordinatorCurrent||task.owner!=owner||originalBrowserOwner!=owner
                ||recurringApplicationRetired||recurringApplication!=task.source)return;}
            task.wake.requireCurrent(task.source);task.trigger.requireCurrent(this);admittedWake=true;
            if(task.trigger.outcomeOnly()){outcomeRead=true;recoverOneOrdinaryOriginalOutcome();}
            else NativeRecurringOrdinaryDeliveryCoordinator.run(application,this,task.source,task.wake,task.trigger);
        }catch(VaultFailure|RuntimeException refused){
            // No same-issue retry or ready signal. Persisted ATTEMPTED stays
            // original-outcome-only; only a later genuine GET can wake again.
        }finally{
            // At most one original-only GET per admitted genuine wake. It is
            // independent of fresh-effect admission/current target and never
            // keeps a browser/native hold over HTTP or reauthorizes a POST.
            if(admittedWake&&!outcomeRead&&!Thread.currentThread().isInterrupted())try{recoverOneOrdinaryOriginalOutcome();}catch(VaultFailure|RuntimeException unavailable){}
            finishOrdinaryRecurringCoordinator(task);
        }
    }
    private void recoverOneOrdinaryOriginalOutcome()throws VaultFailure {
        if(Thread.currentThread().isInterrupted())return;
        var selection=engine.observeOrdinaryRecoveryOriginals(this);
        ordinaryRecoveryUnavailable=selection.unavailable;
        ordinaryRecoveryObservationUnavailable=selection.observationUnavailable;
        final String key;
        synchronized(this){
            if(selection.originalKeys.isEmpty())return;
            String selected=selection.originalKeys.get(0);
            if(ordinaryRecoveryLastKey!=null)for(String candidate:selection.originalKeys)
                if(candidate.compareTo(ordinaryRecoveryLastKey)>0){selected=candidate;break;}
            ordinaryRecoveryLastKey=selected;key=selected;
        }
        if(!Thread.currentThread().isInterrupted())resolveOrdinaryRecurringOutcome(key);
    }
    private void finishOrdinaryRecurringCoordinator(OrdinaryCoordinatorTask task){
        final OrdinaryCoordinatorTask next;
        synchronized(this){
            if(task!=ordinaryCoordinatorCurrent)return;
            next=ordinaryCoordinatorPending;ordinaryCoordinatorPending=null;ordinaryCoordinatorCurrent=next;
            if(next!=null)ordinaryCoordinatorLastTrigger=next.trigger;
        }
        if(next!=null&&!next.owner.enqueueOrdinaryRecurringCoordinator(this,next)){
            // A full/closed existing queue is refusal, never a resubmit loop.
            synchronized(this){if(ordinaryCoordinatorCurrent==next){ordinaryCoordinatorCurrent=null;ordinaryCoordinatorPending=null;}}
        }
    }


    /** Native client construction after Capacitor Builder returns. Consult
     * only the already-existing runtime and its exact first Bridge/Source;
     * never construct/adopt a runtime or repair a later document here. */
    static void completeInitialOriginalBrowserRegistration(com.getcapacitor.Bridge bridge)throws VaultFailure {
        final CustodialNativeRuntime current;
        synchronized(CustodialNativeRuntime.class){current=instance;}
        if(current==null)return;
        synchronized(current){
            if(current.originalBrowser==null||current.originalBrowserAttachmentRefused)return;
            if(bridge==null||current.originalBrowserBridge!=bridge||current.originalBrowserView!=bridge.getWebView())
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            current.originalBrowser.completeInitialBridgeRegistration(bridge);
            if(current.recurringApplication!=null&&!current.recurringApplicationRetired) {
                try {current.recurringApplication.completeInitialBridgeRegistration(bridge);}
                catch(VaultFailure|RuntimeException unavailable) {
                    current.recurringApplicationRetired=true;current.recurringApplication.close();
                }
            }
        }
    }

    /** Fixed packaged-document owner, registered only by native plugin load.
     * No PluginMethod accepts a browser object, token or selected identity. */
    synchronized void attachOriginalBrowser(CustodialNativeVaultPlugin owner,com.getcapacitor.Bridge bridge)throws VaultFailure {
        if(owner==null||originalBrowserAttachmentRefused)
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        var view=bridge==null?null:bridge.getWebView();
        if(originalBrowser!=null){
            if(!sameOriginalBrowserAttachment(originalBrowserOwner,originalBrowserBridge,originalBrowserView,owner,bridge,view)){
                // A second live native owner is not evidence that every browser
                // writer belongs to the retained Source. Retire that Source
                // before refusal; neither owner's later destruction can turn
                // this ambiguity into a fresh maintenance baseline.
                originalBrowserAttachmentRefused=true;
                originalBrowser.close();
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            }
            originalBrowser.requireAttachedView(view);return;
        }
        if(bridge==null||view==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        if(originalBrowserOwner!=null||originalBrowserBridge!=null||originalBrowserView!=null){
            originalBrowserAttachmentRefused=true;
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        }
        if(originalBrowserCleanups.containsKey(view))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        var cleanup=new OriginalBrowserCleanup(this,owner,bridge,view);
        originalBrowserCleanups.put(view,cleanup);
        final NativeOriginalBrowserPreparation attached;
        try {attached=NativeOriginalBrowserPreparation.attach(application,bridge,cleanup);}
        catch(VaultFailure|RuntimeException unavailable){
            // A constructor which bound its Source may already have queued
            // cleanup. Preserve that exact identity for actual owner death.
            if(cleanup.source==null&&originalBrowserCleanups.get(view)==cleanup)originalBrowserCleanups.remove(view);
            throw unavailable;
        }
        boolean installed=false;
        try{
            attached.requireAttachedView(view);
            originalBrowser=attached;originalBrowserOwner=owner;originalBrowserBridge=bridge;originalBrowserView=view;
            installed=true;
        }finally{if(!installed)attached.close();}
    }
    /** Native initial plugin load only, same already-recorded application
     * owner/Bridge/WebView. Missing asset or partial birth is pending forever
     * for this registration; no later load adopts/replaces an app owner. */
    synchronized void attachRecurringApplication(CustodialNativeVaultPlugin owner,com.getcapacitor.Bridge bridge)throws VaultFailure {
        var view=bridge==null?null:bridge.getWebView();
        if(owner==null||recurringApplicationRetired
            ||!sameOriginalBrowserAttachment(originalBrowserOwner,originalBrowserBridge,originalBrowserView,owner,bridge,view))
            throw new VaultFailure("custodial_recurring_application_source_unavailable");
        if(recurringApplicationAttachmentAttempted) {
            if(recurringApplication==null)throw new VaultFailure("custodial_recurring_application_source_unavailable");
            recurringApplication.requireAttachedView(view);return;
        }
        recurringApplicationAttachmentAttempted=true;
        if(recurringBrowserCleanups.containsKey(view))throw new VaultFailure("custodial_recurring_application_source_unavailable");
        var cleanup=new RecurringBrowserCleanup(this,owner,bridge,view);recurringBrowserCleanups.put(view,cleanup);
        final NativeRecurringApplicationSource attached;
        try{attached=NativeRecurringApplicationSource.attach(application,bridge,cleanup);}
        catch(VaultFailure|RuntimeException unavailable){
            if(cleanup.source==null&&recurringBrowserCleanups.get(view)==cleanup)recurringBrowserCleanups.remove(view);
            throw unavailable;
        }
        boolean installed=false;
        try {attached.requireAttachedView(view);recurringApplication=attached;installed=true;}
        finally {if(!installed)attached.close();}
    }
    /** Identity comparison only, not manager/Source/effect authority. The
     * Runtime supplies its actual registered native objects, never JSON. */
    private static boolean sameOriginalBrowserAttachment(Object expectedOwner,Object expectedBridge,Object expectedView,
        Object owner,Object bridge,Object view){
        return expectedOwner!=null&&expectedBridge!=null&&expectedView!=null
            &&expectedOwner==owner&&expectedBridge==bridge&&expectedView==view;
    }
    synchronized void detachOriginalBrowser(CustodialNativeVaultPlugin owner){
        // A stale/foreign plugin lifecycle callback cannot detach someone
        // else's Source. Clear only this exact registration before cleanup.
        if(owner==null)return;
        try {
            if(originalBrowserOwner==owner){
                recurringApplicationRetired=true;
                var recurring=recurringApplication;recurringApplication=null;
                try {if(recurring!=null){
                    var cleanup=recurringBrowserCleanups.get(originalBrowserView);
                    if(cleanup!=null&&cleanup.source==recurring
                        &&owner.ownsOriginalBrowserDestruction(this,cleanup.bridge,cleanup.view))
                        cleanup.drainForDestroyedOwner(owner);
                    else recurring.close();
                }}
                finally {detachMatchedOriginalBrowser();}
            }
        }finally{
            try{
                for(var cleanup:new java.util.ArrayList<>(recurringBrowserCleanups.values()))
                    cleanup.drainForDestroyedOwner(owner);
            }finally{
                // Original cleanup is independent even if recurring physical
                // removal throws; preserve the original destruction attempt.
                for(var cleanup:new java.util.ArrayList<>(originalBrowserCleanups.values()))
                    cleanup.drainForDestroyedOwner(owner);
            }
        }
    }
    private void detachMatchedOriginalBrowser(){
        var attached=originalBrowser;originalBrowser=null;originalBrowserOwner=null;
        originalBrowserBridge=null;originalBrowserView=null;
        if(attached!=null)attached.close();
    }
    /** Nullable attached owner only. The Engine requires a live source for
     * FIRST capture, but may recover authenticated saved DATA without one. */
    private synchronized NativeOriginalBrowserPreparation attachedOriginalBrowserOrNull() {
        return originalBrowserAttachmentRefused?null:originalBrowser;
    }
    /** Protected native maintenance screen only. No plugin API or caller
     * selected URL/identity, and no automatic recovery/request after reload. */
    void reloadConsumedOriginalRecoveryDocument(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(this)||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();var source=attachedOriginalBrowserOrNull();
        if(source==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        source.reloadConsumedRecoveryDocument(control);control.check();
    }
    /** Protected native LOCAL read only. No selected body/ID, provider owner,
     * browser Source, HTTP, original-write retry or startup effect. */
    JSONObject inspectExistingOriginalEnrollmentFinalization(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(this)||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();var result=AndroidPrivateCustodyOwnerRecovery.inspectOriginalFinalization(application,engine,control);
        control.check();return result;
    }
    /** Same existing original + actual current manager-purpose reads + packaged
     * document DATA/recheck/local retention. Not finalization authority. */
    JSONObject preserveSavedOriginalBrowserPreparation(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control)){
            return engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,attachedOriginalBrowserOrNull());
        }
    }
    /** Separate explicit read after the original native hold. Missing saved
     * browser DATA cannot be replaced by a fresh browser capture in this path. */
    JSONObject reconstructHeldSavedOriginalBrowserPreparation(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control,true)){
            JSONObject observed=engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,null);
            control.check();
            for(String flag:new String[]{"manager_approval","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(observed.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            if(!"CURRENT_MANAGER_AND_SAVED_BROWSER_DATA_NOT_CURRENT_BROWSER_AUTHORITY".equals(observed.get("state")))
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            JSONObject result=new JSONObject().put("schema","custodial.native-held-original-reconstruction.v1")
                .put("state","AUTHENTICATED_SAVED_ORIGINAL_CURRENT_READ_NOT_ACK")
                .put("original_data_authenticated",true).put("transaction_authority",false)
                .put("complete_namespace_inventory",false).put("all_writer_durable_freeze_or_ABA_guard",false)
                .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
                .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false)
                .put("observation",observed);
            control.check();return result;
        }catch(org.json.JSONException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }

    /** Explicit local signed-request action, not the read-only verification.
     * Reattach only the installed original HELD source and the SAME live
     * packaged browser hold, then retain its native intent and signed request. A saved
     * browser frame without its still-live owner cannot authorize this write.
     * No plugin/caller chooses an ID, record, root, identity or credential. */
    JSONObject retainHeldOriginalInventoryAckRequest(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        NativeOriginalBrowserPreparation source=attachedOriginalBrowserOrNull();
        if(source==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control,true)){
            // Both actual manager-purpose reads and the saved-original browser
            // comparison remain owned by this finite invocation. Never reuse
            // a preparation projection as proof for a later transaction.
            engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,source);
            control.check();
            synchronized(engine){
                try(var issuer=engine.prepareOriginalInventoryAckIntentControl(prepared,control)){
                    var journal=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                    try(var retained=journal.retainOriginalIntent(issuer)){
                        JSONObject result=retained.projection();
                        if(!"custodial.native-original-inventory-ack-intent-observation.v1".equals(result.get("schema"))
                            ||!"LOCAL_ACK_INTENT_ONLY_NOT_ACK".equals(result.get("state")))
                            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                        for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                            if(!Boolean.FALSE.equals(result.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                        issuer.requireCurrent();control.check();
                        // The private typed retained original, not the detached
                        // projection above, is the signing producer's input.
                        try(var requestOwner=engine.prepareOriginalInventoryAckRequestControl(issuer,retained)){
                            var requests=NativeOriginalInventoryAckRequestJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                            try(var saved=requests.retainOriginalRequest(requestOwner)){
                                JSONObject request=saved.projection();
                                if(!"custodial.native-original-inventory-ack-request-observation.v1".equals(request.get("schema"))
                                    ||!"LOCAL_SIGNED_REQUEST_RETAINED_NOT_ACK".equals(request.get("state")))
                                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                                    if(!Boolean.FALSE.equals(request.get(flag)))throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                                requestOwner.requireCurrent();control.check();return request;
                            }
                        }
                    }
                }
            }
        }catch(org.json.JSONException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }

    /** Explicit FIRST registration only. The SAME live HELD/browser/manager
     * scope owns local intent, signed request and durable UNKNOWN before HTTP.
     * A previously retained request cannot acquire first-write provenance here,
     * even if its UNKNOWN marker is absent. No restored request is resent. */
    JSONObject registerHeldOriginalInventoryRequest(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        NativeOriginalBrowserPreparation source=attachedOriginalBrowserOrNull();
        if(source==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();var binding=held.originalMetadataForOwningRecovery();
            // Require the original persisted browser pair before the saved
            // reader, so this action cannot fill missing browser originals.
            if(binding.browserFrameSha256==null||binding.browserPartSetSha256==null)
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            control.check();
            try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control,true)){
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,source);
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                VaultEngine.NativeOriginalInventoryAckIntentControl issuer=null;
                NativeOriginalInventoryAckIntentJournal.Result retained=null;
                VaultEngine.NativeOriginalInventoryAckRequestControl requestOwner=null;
                NativeOriginalInventoryAckRequestJournal.Result saved=null;
                NativeOriginalInventoryAckUnknownJournal.Unknown unknown=null;
                Throwable primary=null;
                try{
                    synchronized(engine){
                        held.requireCurrent();control.check();
                        issuer=engine.prepareOriginalInventoryAckIntentControl(prepared,control);
                        var intents=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        retained=intents.retainOriginalIntent(issuer);
                        requestOwner=engine.prepareOriginalInventoryAckRequestControl(issuer,retained);
                        var requests=NativeOriginalInventoryAckRequestJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        saved=requests.retainOriginalRequest(requestOwner);
                        var unknowns=NativeOriginalInventoryAckUnknownJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        // The journal consumes the live Result's first-write
                        // claim before reservation. Existing records/ambiguity
                        // cannot be converted to another dispatch attempt.
                        unknown=unknowns.reserveOriginalDispatchUnknown(requestOwner,saved);
                        unknown.requireCurrent(requestOwner);held.requireCurrent();control.check();
                    }
                    // ALL original owners remain alive, but neither Engine nor
                    // providerCoordinator is held during the fixed HTTP call.
                    // The Engine owns its one-shot request/Attempt and settles
                    // IO before returning or throwing; never retry on failure.
                    control.check();
                    JSONObject result=engine.registerOriginalInventoryRequest(requestOwner,saved,unknown,new NativePrivateCustodyHttp(),control);
                    control.check();return result;
                }catch(VaultFailure|RuntimeException|Error failure){primary=failure;throw failure;}
                finally{
                    // Close every locally acquired handle, in reverse order,
                    // even on partial acquisition. These closes retire only
                    // observations/issuers; durable originals and UNKNOWN stay.
                    // The Activity owns the borrowed finite control's lifetime.
                    synchronized(engine){
                        try(var ownedIssuer=issuer;var ownedIntent=retained;var ownedRequestOwner=requestOwner;
                            var ownedRequest=saved;var ownedUnknown=unknown){
                            // try-with-resources also preserves later cleanup
                            // failures as suppressed when an earlier close fails.
                        }catch(RuntimeException|Error cleanup){
                            if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;
                        }
                    }
                }
            }
        }
    }

    /** Explicit protected SERVER status READ of an existing signed original.
     * This cannot create/repair local intent, request or UNKNOWN, and cannot
     * obtain first-write provenance or resend the archived registration. */
    JSONObject readHeldOriginalInventoryRegistrationStatus(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return inspectHeldOriginalInventoryServer(control,InventoryRead.REGISTRATION);
    }

    /** Explicit protected advancement of ONE original manifest chunk. Only
     * the existing actual HELD/browser/manager scope selects the bytes/slot.
     * A reopened original is read-only; no plugin or caller-supplied index. */
    JSONObject advanceHeldOriginalInventoryManifest(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return inspectHeldOriginalInventoryServer(control,InventoryRead.ADVANCE_MANIFEST);
    }

    /** Existing-only authenticated decision observation. No archived writer
     * resend, original creation, private ACK or finalization is reachable. */
    JSONObject readHeldOriginalInventoryManagerDecisionStatus(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return inspectHeldOriginalInventoryServer(control,InventoryRead.MANAGER_DECISION);
    }
    JSONObject retainHeldOriginalInventoryManagerDecisionObservation(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return inspectHeldOriginalInventoryServer(control,InventoryRead.RETAIN_MANAGER_DECISION);
    }

    /** Separate explicit protected native action, never a status/read or
     * plugin operation. The SAME existing request and held browser/native
     * graph must obtain a fresh authenticated decision before the Engine can
     * privately admit one fixed enrollment transition. All work/keys remain;
     * an unknown result has local readback only, not a write retry. */
    JSONObject separateHeldOriginalEnrollmentKeepingWork(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return inspectHeldOriginalInventoryServer(control,InventoryRead.SEPARATE_ENROLLMENT_KEEP_WORK);
    }
    private enum InventoryRead { REGISTRATION, ADVANCE_MANIFEST, MANAGER_DECISION, RETAIN_MANAGER_DECISION, SEPARATE_ENROLLMENT_KEEP_WORK }

    private JSONObject inspectHeldOriginalInventoryServer(NativePrivateCustodyFrameReadControl control,InventoryRead mode)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        NativeOriginalBrowserPreparation source=attachedOriginalBrowserOrNull();
        if(source==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();var binding=held.originalMetadataForOwningRecovery();
            // Exclude legacy/unbound or missing browser originals before the
            // saved owner can enter any browser first-capture branch.
            if(binding.browserFrameSha256==null||binding.browserPartSetSha256==null)
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            control.check();
            try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control,true)){
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,source);
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                VaultEngine.NativeOriginalInventoryAckIntentControl issuer=null;
                NativeOriginalInventoryAckIntentJournal.Result retained=null;
                VaultEngine.NativeOriginalInventoryAckRequestControl requestOwner=null;
                NativeOriginalInventoryAckRequestJournal.Result saved=null;
                Throwable primary=null;
                try{
                    synchronized(engine){
                        held.requireCurrent();control.check();
                        issuer=engine.prepareOriginalInventoryAckIntentControl(prepared,control);
                        var intents=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        retained=intents.inspectOriginalIntent(issuer);
                        if(retained==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                        requestOwner=engine.prepareOriginalInventoryAckRequestControl(issuer,retained);
                        var requests=NativeOriginalInventoryAckRequestJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        saved=requests.inspectOriginalRequest(requestOwner);
                        if(saved==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                        requestOwner.requireCurrent();held.requireCurrent();control.check();
                    }
                    // Keep every original owner alive, but release Engine and
                    // providerCoordinator before fixed authenticated reads.
                    // Only the separately confirmed separation mode may then
                    // enter its closed private ACK/local successor transaction.
                    // Status modes never acquire that local write permission.
                    control.check();
                    JSONObject result=switch(mode){
                        case ADVANCE_MANIFEST -> engine.advanceOriginalInventoryManifest(requestOwner,saved,new NativePrivateCustodyHttp(),control);
                        case MANAGER_DECISION -> engine.readOriginalInventoryManagerDecisionStatus(requestOwner,saved,new NativePrivateCustodyHttp(),control);
                        case RETAIN_MANAGER_DECISION -> engine.retainOriginalInventoryManagerDecisionObservation(requestOwner,saved,new NativePrivateCustodyHttp(),control);
                        case SEPARATE_ENROLLMENT_KEEP_WORK -> engine.separateHeldOriginalEnrollmentKeepingWork(requestOwner,saved,new NativePrivateCustodyHttp(),control);
                        case REGISTRATION -> engine.readOriginalInventoryRegistrationStatus(requestOwner,saved,new NativePrivateCustodyHttp(),control);
                    };
                    held.requireCurrent();control.check();
                    if(attachedOriginalBrowserOrNull()!=source)
                        throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                    return result;
                }catch(VaultFailure|RuntimeException|Error failure){primary=failure;throw failure;}
                finally{
                    synchronized(engine){
                        try(var ownedIssuer=issuer;var ownedIntent=retained;var ownedRequestOwner=requestOwner;var ownedRequest=saved){
                            // Reverse closure also covers partial acquisition;
                            // no original files, keys or borrowed frame control
                            // are removed, reset or closed by this cleanup.
                        }catch(RuntimeException|Error cleanup){
                            if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;
                        }
                    }
                }
            }
        }
    }

    /** Protected existing-only local status. A warm Runtime and the actual
     * installed V3 HELD/browser originals are prerequisites, not absence or
     * send authority. No first retention, recovery, signing selection or
     * dispatch is reachable from this entry. Current server READs still run
     * through the original saved owner and both finite manager leases. */
    JSONObject inspectHeldOriginalInventoryAckStatus(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        NativeOriginalBrowserPreparation source=attachedOriginalBrowserOrNull();
        if(source==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();
            var binding=held.originalMetadataForOwningRecovery();
            // The saved HELD reader checks this exact browser pair before and
            // after its fresh HTTP read. Requiring it here excludes legacy V2
            // and therefore the preserve helper's missing-browser capture path.
            if(binding.browserFrameSha256==null||binding.browserPartSetSha256==null)
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            control.check();
            try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control,true)){
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,source);
                held.requireCurrent();control.check();
                if(attachedOriginalBrowserOrNull()!=source)
                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                synchronized(engine){
                    try(var issuer=engine.prepareOriginalInventoryAckIntentControl(prepared,control)){
                        JSONObject result=new JSONObject()
                            .put("schema","custodial.native-original-inventory-ack-local-status.v1")
                            .put("state","ORIGINAL_INTENT_ABSENT_UNPROVEN_NOT_SEND_AUTHORITY")
                            .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
                            .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
                        var intents=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                        try(var retained=intents.inspectOriginalIntent(issuer)){
                            if(retained!=null){
                                result.put("state","ORIGINAL_REQUEST_ABSENT_UNPROVEN_NOT_SEND_AUTHORITY");
                                try(var requestOwner=engine.prepareOriginalInventoryAckRequestControl(issuer,retained)){
                                    var requests=NativeOriginalInventoryAckRequestJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                                    try(var saved=requests.inspectOriginalRequest(requestOwner)){
                                        if(saved!=null){
                                            var unknown=NativeOriginalInventoryAckUnknownJournal.fromNativeNoBackupRoot(NativePrivateMutationEpochStore.originalContextNoBackupRoot(application));
                                            JSONObject observed=unknown.inspectOriginalUnknown(requestOwner,saved);
                                            if(!"custodial.native-original-inventory-ack-dispatch-unknown-observation.v1".equals(observed.get("schema"))
                                                ||!("ABSENT_UNPROVEN_NOT_SEND_AUTHORITY".equals(observed.get("state"))
                                                    ||"EXISTING_DISPATCH_UNKNOWN_NOT_ACK".equals(observed.get("state"))))
                                                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                                            for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                                                if(!Boolean.FALSE.equals(observed.get(flag)))
                                                    throw new VaultFailure("custodial_original_browser_preparation_unavailable");
                                            result.put("state",observed.get("state")).put("observation",observed);
                                            saved.requireCurrent();
                                        }
                                        requestOwner.requireCurrent();retained.requireCurrent();
                                    }
                                }
                            }
                            issuer.requireCurrent();held.requireCurrent();control.check();return result;
                        }
                    }
                }
            }
        }catch(org.json.JSONException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }

    /** Explicit protected maintenance only. Reconstruct and inspect the SAME
     * original before the denial-only native hold; never accept a caller
     * identity, inventory, counter, receipt or effect permission. Once the
     * hold is promoted it invalidates the predecessor source by design. */
    JSONObject holdSavedOriginalNativeWriters(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        try(var prepared=openExistingSavedOriginalRecoveryChallengeRequest(control)){
            engine.preserveOriginalBrowserUnderCurrentManager(prepared,new NativePrivateCustodyHttp(),control,attachedOriginalBrowserOrNull());
            control.check();
            synchronized(engine){
                try(var original=engine.prepareOriginalDurableWriterHold(prepared,control)){
                    control.check();AndroidProtectedWorkPreferences.holdOriginalWriters(original);
                    // No original.requireCurrent() after our own authoritative
                    // transition: it is NOT permission to adopt a new source.
                    control.check();
                }
            }
            try{
                return new JSONObject().put("schema","custodial.native-original-writer-hold-observation.v1")
                    .put("state","ORIGINAL_NATIVE_WRITERS_HELD_NOT_ACK")
                    .put("native_writer_hold_observed",true).put("transaction_authority",false)
                    .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
                    .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
            }catch(org.json.JSONException failure){throw new VaultFailure("custodial_original_browser_preparation_unavailable",failure);}
        }
    }

    /** Denial metadata only. Unlike get(), this accessor cannot trigger
     * startup recovery or construct any owner for a status-button click. */
    static synchronized CustodialNativeRuntime existingForProtectedHeldRead(Context context)throws VaultFailure {
        try{
            if(context==null||instance==null||context.getApplicationContext()!=instance.application)
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            return instance;
        }catch(RuntimeException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }
    /** Explicit protected VERIFY only, never the status-only accessor. Reattach
     * existing denial metadata before extracting owners; absent/non-HELD state
     * cannot construct a Runtime. This proves no saved DATA or manager authority:
     * the existing reconstruction must still authenticate the SAME originals.
     * No HTTP runs while this factory holds the Runtime monitor. */
    static synchronized CustodialNativeRuntime forProtectedHeldOriginalVerification(
        Context context,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null)throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        try{
            Context application=context==null?null:context.getApplicationContext();
            if(application==null||instance!=null&&application!=instance.application)
                throw new VaultFailure("custodial_original_browser_preparation_unavailable");
            if(instance==null)AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournal(application);
            else{
                try{AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);}
                catch(VaultFailure attachFailure){
                    // Explicit VERIFY may resume the SAME interrupted metadata
                    // in a warm process too. Check cancellation before recovery.
                    control.check();
                    try{AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournal(application);}
                    catch(VaultFailure recoveryFailure){
                        if(recoveryFailure!=attachFailure)attachFailure.addSuppressed(recoveryFailure);
                        throw attachFailure;
                    }
                    control.check();
                }
            }
            control.check();
            try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
                held.requireCurrent();control.check();
                CustodialNativeRuntime current=instance;
                if(current==null)current=new CustodialNativeRuntime(application,held);
                // Keep the exact installed counter/file/operation/generation/
                // value/plan witness across construction, not just HELD text.
                AndroidProtectedWorkPreferences.attachExistingMutationEpochJournal(application);
                held.requireCurrent();control.check();
                instance=current;return current;
            }
        }catch(RuntimeException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }
    JSONObject observeSavedOriginalNativeWriterHold(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure("custodial_original_browser_preparation_unavailable");
        control.check();
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();control.check();
            JSONObject result=new JSONObject().put("schema","custodial.native-existing-writer-hold-observation.v1")
                .put("state","EXISTING_NATIVE_HOLD_OBSERVED_NOT_ORIGINAL_VERIFIED")
                .put("native_writer_hold_observed",true).put("original_inventory_verified",false)
                .put("transaction_authority",false).put("inventory_acknowledged",false).put("work_accepted",false)
                .put("replay_allowed",false).put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
            control.check();held.requireCurrent();control.check();return result;
        }catch(org.json.JSONException unavailable){throw new VaultFailure("custodial_original_browser_preparation_unavailable",unavailable);}
    }

    static synchronized CustodialNativeRuntime get(Context context) {
        if (context == null || context.getApplicationContext() == null) throw new IllegalArgumentException("custodial_application_context_required");
        if (instance == null) instance = new CustodialNativeRuntime(context.getApplicationContext());
        return instance;
    }
    private CustodialNativeRuntime(Context application) {this(application,null);}
    private CustodialNativeRuntime(Context application,AndroidProtectedWorkPreferences.HeldOriginalRead held) {
        this.application = application;
        VaultClock clock = System::currentTimeMillis;
        // Finish only a pre-existing validated mutation-counter transition
        // before opening its participating owners. This never initializes a
        // journal or cancels WORK probe/freeze, enrollment or message guards.
        try {
            // The VERIFY factory already recovered and owns this exact HELD
            // lease. Repeating recovery would revoke/replace its Current.
            if(held==null)AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournal(application);
            else held.requireCurrent();
        }
        catch (VaultFailure unavailable) {
            throw new IllegalStateException(AndroidProtectedWorkPreferences.FAILURE, unavailable);
        }
        // Open the already existing WORK owner before the vault. A persisted
        // pending/frozen guard must also deny ordinary vault recovery after a
        // restart, before legacy adoption, credential rotation or HTTP.
        offlineStore = new AndroidOfflineAuthorityTimeStore(application);
        engine = new VaultEngine(
            new SharedPreferencesVaultPersistence(application, new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(), new HttpsEnrollmentTransport(),
            new AndroidLegacyVaultSource(application, clock), new SecureInstallationSealGenerator(), clock,offlineStore);
        offlineTime = new OfflineAuthorityTime(offlineStore, new OfflineAuthorityTime.MonotonicClock() {
            @Override public long now() { return SystemClock.elapsedRealtime(); }
            @Override public int bootCount() {
                try { return Settings.Global.getInt(application.getContentResolver(), "boot_count", -1); }
                catch (RuntimeException unavailable) { return -1; }
            }
        });
        principalJournal = new NativePrincipalJournal(offlineStore);
        legacyJournal = new NativeLegacyLineageJournal(offlineStore);
        // Provider is required by the current complete-system scope, but its
        // admitted effect owner remains unfinished. Do not touch its preference/
        // key namespace merely to start the app or register private components.
    }

    /** Caller holds engine before providerCoordinator for every provider mutation/effect.
     * Reads the actual native journals; does not manufacture, refresh or repair a principal. */
    NativeProviderPrincipal readProviderPrincipal() throws VaultFailure {
        synchronized (engine) {
            Map<String, Object> state = engine.getState();
            if (!Boolean.TRUE.equals(state.get("active"))) return null;
            JSONObject principal = NativeLegacyLineageJournal.applies(state)
                ? engine.readLegacyPrincipal(legacyJournal) : principalJournal.readFor(state);
            return principal == null ? null : NativeProviderPrincipal.fromNativeJournal(principal);
        }
    }
    /** Native vendor observer only. No getState recovery/adoption, public
     * principal DTO, caller readiness or source callback participates. */
    NativeProviderPrincipal readNotificationMutationPrincipal()throws VaultFailure {
        synchronized(engine) {
            Map<String,Object> state=engine.observeStateReadOnly();
            if(!Boolean.TRUE.equals(state.get("active")))return null;
            JSONObject principal=NativeLegacyLineageJournal.applies(state)
                ?engine.readLegacyPrincipal(legacyJournal):principalJournal.readFor(state);
            return principal==null?null:NativeProviderPrincipal.fromNativeJournal(principal);
        }
    }
    /** Same native registration tuple, born here only; not a public profile or
     * JS-supplied document/currentness/effect capability. */
    static final class RecurringCompletionSourceBinding {
        private final CustodialNativeRuntime owner;
        private final NativeRecurringApplicationSource source;
        private final NativeRecurringApplicationSource.CallbackHold hold;
        private final Object plugin,bridge,view;
        private RecurringCompletionSourceBinding(CustodialNativeRuntime owner,NativeRecurringApplicationSource source,
            NativeRecurringApplicationSource.CallbackHold hold){
            this.owner=owner;this.source=source;this.hold=hold;
            plugin=owner.originalBrowserOwner;bridge=owner.originalBrowserBridge;view=owner.originalBrowserView;
        }
        void requireOriginalFrame(NativeRecurringApplicationSource originalSource,NativeRecurringApplicationSource.CallbackHold originalHold)throws VaultFailure {
            if(originalSource!=source||originalHold!=hold)throw new VaultFailure("custodial_recurring_application_source_unavailable");
        }
        void requireOriginalDocument(CustodialNativeRuntime expected,NativeRecurringApplicationSource.CompletedDocumentLifetime original)throws VaultFailure {
            synchronized(owner){
                if(expected!=owner||owner.recurringApplicationRetired||!owner.recurringApplicationAttachmentAttempted
                    ||owner.recurringApplication!=source||plugin==null||bridge==null||view==null
                    ||owner.originalBrowserOwner!=plugin||owner.originalBrowserBridge!=bridge||owner.originalBrowserView!=view)
                    throw new VaultFailure("custodial_recurring_application_source_unavailable");
                source.requireAttachedView(owner.originalBrowserView);original.requireCurrent(source);
            }
        }
        void requireCurrent(CustodialNativeRuntime expected)throws VaultFailure {
            synchronized(owner){
                if(expected!=owner||owner.recurringApplicationRetired||!owner.recurringApplicationAttachmentAttempted
                    ||owner.recurringApplication!=source||plugin==null||bridge==null||view==null
                    ||owner.originalBrowserOwner!=plugin||owner.originalBrowserBridge!=bridge||owner.originalBrowserView!=view)
                    throw new VaultFailure("custodial_recurring_application_source_unavailable");
                source.requireAttachedView(owner.originalBrowserView);
                hold.requireNativeWriterLeaseLifetime(source);
            }
        }
    }
    private synchronized RecurringCompletionSourceBinding captureRecurringCompletionSource(NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold)throws VaultFailure {
        if(source==null||hold==null||recurringApplication!=source)
            throw new VaultFailure("custodial_recurring_application_source_unavailable");
        RecurringCompletionSourceBinding binding=new RecurringCompletionSourceBinding(this,source,hold);
        binding.requireCurrent(this);return binding;
    }
    VaultEngine.NativeRecurringCompletionRead claimRecurringCompletionRead(NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold)throws VaultFailure {
        // Runtime lock is released BEFORE Engine acquisition. Engine may then
        // recheck Runtime→Source tuple; no monitor is held over a UI wait.
        RecurringCompletionSourceBinding binding=captureRecurringCompletionSource(source,hold);
        return engine.claimRecurringCompletionRead(this,binding);
    }
    VaultEngine.NativeOrdinaryRecurringRead claimOrdinaryRecurringRead(NativeRecurringApplicationSource source,
        NativeRecurringApplicationSource.CallbackHold hold,NativeRecurringApplicationSource.OrdinaryCallbackFrame initial)throws VaultFailure {
        // Same actual runtime/source birth. Release Runtime monitor BEFORE Engine.
        RecurringCompletionSourceBinding binding=captureRecurringCompletionSource(source,hold);
        return engine.claimOrdinaryRecurringRead(this,binding,source,hold,initial);
    }
    /** Cached EXISTING provider lookup only. No construction/register/reopen
     * or supplied Current; backend binding text is requirements DATA only. */
    NativeProviderRuntimeOwner.OrdinaryOriginalJobRead captureOrdinaryOriginalJobs(NativeProviderPrincipal principal,
        String readId,String semanticDigest,String targetDigest,String bindings)throws VaultFailure {
        synchronized(engine){synchronized(providerCoordinator){
            if(localProviderOwner==null)throw new VaultFailure("custodial_provider_original_job_unavailable");
            return localProviderOwner.captureOrdinaryOriginalJobs(this,principal,readId,semanticDigest,targetDigest,bindings);
        }}
    }
    boolean ownsOrdinaryOriginalProvider(NativeProviderRuntimeOwner original){
        return Thread.holdsLock(engine)&&original!=null&&localProviderOwner==original;
    }
    /** Private current native lane observation, not a voice completion or
     * historical provider-journal settlement capability. */
    final class NativeOrdinaryNoAudioRead {
        private final NativeProviderRuntimeOwner originalOwner;
        private final NativeProviderAudioSequence.OrdinaryIdleRead sequence;
        private final CustodialProviderAudioService.OrdinaryIdleRead service;
        private NativeOrdinaryNoAudioRead(NativeProviderRuntimeOwner owner,NativeProviderAudioSequence.OrdinaryIdleRead sequence,
            CustodialProviderAudioService.OrdinaryIdleRead service){originalOwner=owner;this.sequence=sequence;this.service=service;}
        void requireCurrent()throws VaultFailure {
            if(!Thread.holdsLock(engine))throw new VaultFailure("custodial_recurring_native_audio_not_idle");
            synchronized(providerCoordinator){
                if(localProviderOwner!=originalOwner)throw new VaultFailure("custodial_recurring_native_audio_not_idle");
                if(sequence!=null)sequence.requireCurrent();service.requireCurrent();
            }
        }
    }
    NativeOrdinaryNoAudioRead captureOrdinaryNoAudioRead()throws VaultFailure {
        if(!Thread.holdsLock(engine))throw new VaultFailure("custodial_recurring_native_audio_not_idle");
        synchronized(providerCoordinator){
            // Direct cached read ONLY: never localOwner(), construction,
            // admission/reconcile/storage/key/SDK callback or TTS operation.
            NativeProviderRuntimeOwner current=localProviderOwner;
            var sequence=current==null?null:current.captureOrdinaryAudioIdle();
            var service=CustodialProviderAudioService.captureOrdinaryIdle();
            NativeOrdinaryNoAudioRead read=new NativeOrdinaryNoAudioRead(current,sequence,service);read.requireCurrent();return read;
        }
    }
    /** Fixed native completion route, package-only. Inputs are the actual
     * Source17/Engine read and producer18a private read, never caller JSON.
     * All UI acquisition/terminal waits finish before this call. */
    NativeRecurringOrdinaryAttemptJournal.Data applyOrdinaryRecurringDelivery(VaultEngine.NativeOrdinaryRecurringRead read,
        NativeRecurringApplicationSource source,NativeRecurringApplicationSource.CallbackHold hold,
        NativeRecurringOrdinaryEffectProducer.ScopeRead effects)throws VaultFailure {
        if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()
            ||Thread.holdsLock(engine)||Thread.holdsLock(CustodialNativeNotificationWriter.class))
            throw new VaultFailure("custodial_recurring_ordinary_attempt_pending");
        captureRecurringCompletionSource(source,hold); // Runtime monitor released before Writer/Engine.
        try(var attempt=NativeRecurringOrdinaryCommitPermit.retain(application,this,read,source,hold,effects)){
            // Durable semantic snapshot/appliedAt is fixed. Resume ordinary
            // application callbacks BEFORE HTTP; the same native document is
            // still independently checked without reviving the retired HOLD.
            var processed=NativeRecurringOrdinaryDeliveryCoordinator.releaseAndAwait(source,hold,read.localDeadlineNanos());
            attempt.acceptProcessedRelease(processed);
            return attempt.dispatchOriginalOnce();
        }finally{effects.close();read.close();hold.close();}
    }
    /** Read-only original-intent recovery, never a resend or current-winner
     * inference. A recovered row has no constructor for a POST owner. */
    NativeRecurringOrdinaryAttemptJournal.Data resolveOrdinaryRecurringOutcome(String retainedPurposeKey)throws VaultFailure {
        if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()
            ||Thread.holdsLock(engine)||Thread.holdsLock(CustodialNativeNotificationWriter.class))
            throw new VaultFailure("custodial_recurring_ordinary_attempt_pending");
        return engine.queryRetainedOrdinaryRecurringOutcome(this,retainedPurposeKey);
    }
    NativeRecurringTargetJournal notificationMutationJournal() {
        return new NativeRecurringTargetJournal(offlineStore);
    }
    /** Local preservation only, distinct from admitting ingress/display/network.
     * Empty installations do not create a provider key or namespace while suspended.
     * Retained ciphertext must be fenced before enrollment finalization; unreadable
     * provider key/store fails closed and is never regenerated or cleared. */
    private NativeProviderRuntimeOwner localOwner() {
        NativeProviderReleaseAdmission.Selected admitted = qualifiedRelease(application);
        return localOwner(admitted == null ? NativeProviderTime.Profiles.NONE : admitted.profiles(), admitted != null);
    }
    private NativeProviderRuntimeOwner localOwner(NativeProviderTime.Profiles profiles, boolean admitted) {
        if (!Thread.holdsLock(engine) || !Thread.holdsLock(providerCoordinator)) throw new IllegalStateException("provider_lock_owner_required");
        if (localProviderOwner == null && (admitted || AndroidProviderStore.hasRetainedState(application))) {
            AndroidProviderStore store = new AndroidProviderStore(application);
            NativeProviderJournal journal = new NativeProviderJournal(store.records(), providerCoordinator);
            NativeProviderRuntimeOwner.Delivery delivery = null;
            boolean nativeAudio=false;
            try {
                AndroidProviderClockReadings readings = new AndroidProviderClockReadings(application);
                NativeProviderAudioPolicy audioPolicy=null;
                if(admitted){NativeProviderAppIdentity app=AndroidProviderAppIdentity.read(application);
                    audioPolicy=NativeProviderAudioAdmission.compiled(app,NativeProviderReleaseAdmission.compiled(AndroidProviderPlatform.read(),app));
                    if(audioPolicy==null)throw new VaultFailure("custodial_provider_audio_policy_unqualified");}
                AndroidProviderAudioSurface audio=audioPolicy==null?null:new AndroidProviderAudioSurface(application,audioPolicy);
                nativeAudio=audio!=null;
                delivery = new NativeProviderRuntimeOwner.Delivery(profiles, AndroidProviderPlatform.read(), readings,
                    () -> AndroidProviderAppIdentity.read(application), new NativeProviderHttp(readings), new AndroidProviderJobs(application), AndroidProviderTokenSource::refresh,audio,audio,audioPolicy);
            } catch (VaultFailure unavailable) {
                // Missing platform identity cannot block the original local removal
                // fence/cancellation owner or become a guessed qualified profile.
                android.util.Log.w("CustodialNativeVault", "provider_platform_unqualified");
            }
            localProviderOwner = new NativeProviderRuntimeOwner(engine, principalJournal, legacyJournal, journal,
                providerCoordinator, new AndroidProviderNotifications(application,nativeAudio), delivery,this::currentProviderAttachmentEpoch);
        }
        return localProviderOwner;
    }
    void reconcileProviderFence() throws VaultFailure {
        synchronized (engine) { synchronized (providerCoordinator) {
            NativeProviderRuntimeOwner owner = localOwner();
            if (owner != null) {
                // The owning effect method verifies the actual engine fence
                // itself. A preceding ordinary reconcile would fail before its
                // exact retained-only cancellation path during a WORK hold.
                try { owner.reconcileLocalEffects(); }
                catch (VaultFailure pending) {
                    if (!"custodial_provider_os_cancel_failed".equals(pending.code)
                        && !"custodial_provider_os_cancel_unconfirmed".equals(pending.code)) throw pending;
                    // Exact intent and every existing key remain preserved;
                    // this is not removal/finalizer or key-retirement admission.
                    android.util.Log.w("CustodialNativeVault", "provider_exact_cancellation_pending");
                }
            }
        } }
    }
    void attachProviderLocal(Object attachment) throws VaultFailure {
        synchronized (engine) { synchronized (providerCoordinator) {
            NativeProviderRuntimeOwner owner = localOwner();
            if (owner != null) {
                owner.reconcileLocalEffects();
                try {
                    engine.requireOriginalProviderPreservationFence();
                    return; // Remain unbound while exact preserved work is held.
                } catch (VaultFailure notHeld) {
                    if (!"custodial_provider_original_preservation_fence_required".equals(notHeld.code)) throw notHeld;
                }
                owner.attach(attachment);
            }
        } }
    }
    private Object currentProviderAttachmentEpoch(Object attachment)throws VaultFailure {
        if(!(attachment instanceof CustodialNativeVaultPlugin))throw NativeProviderMirrorAttachment.invalid();
        Object epoch=((CustodialNativeVaultPlugin)attachment).currentProviderAttachmentEpoch(this);
        if(epoch==null)throw NativeProviderMirrorAttachment.invalid();return epoch;
    }
    void attachProviderLocal(CustodialNativeVaultPlugin attachment,Object expectedEpoch)throws VaultFailure {
        if(expectedEpoch==null||currentProviderAttachmentEpoch(attachment)!=expectedEpoch)throw NativeProviderMirrorAttachment.invalid();
        synchronized(engine){synchronized(providerCoordinator){
            if(currentProviderAttachmentEpoch(attachment)!=expectedEpoch)throw NativeProviderMirrorAttachment.invalid();
            NativeProviderRuntimeOwner owner=localOwner();
            if(owner!=null){owner.reconcileLocalEffects();
                if(currentProviderAttachmentEpoch(attachment)!=expectedEpoch)throw NativeProviderMirrorAttachment.invalid();
                owner.attach(attachment,expectedEpoch);
            }
        }}
    }
    void detachProviderLocal(Object attachment) {
        synchronized (engine) { synchronized (providerCoordinator) {
            if (localProviderOwner != null) localProviderOwner.detach(attachment);
        } }
    }
    void detachProviderLocal(CustodialNativeVaultPlugin attachment,Object expectedEpoch) {
        if(attachment==null||expectedEpoch==null)return;
        synchronized(engine){synchronized(providerCoordinator){
            if(localProviderOwner!=null)localProviderOwner.detach(attachment,expectedEpoch);
        }}
    }
    /** Lifecycle recovery of an already-pending local original, never creation
     * or activation of the private protocol. Native API26 filesystem support
     * is not a clock/audio profile or release/removal admission. */
    void recoverPendingPrivateCustodyOwnerIfPresent()throws VaultFailure {
        if(android.os.Build.VERSION.SDK_INT<26)return;
        if(AndroidPrivateCustodyOperationStore.pendingOriginalPresent(application))
            AndroidPrivateCustodyOwnerRecovery.resumePendingOriginal(application,engine,offlineStore,
                principalJournal,legacyJournal,providerCoordinator);
    }
    NativeProviderRemovalCoordinator providerRemoval(RemovalCoordinator removal) {
        return new NativeProviderRemovalCoordinator(engine, removal, this::reconcileProviderFence);
    }
    /** Internal read-only source binding only; no JS endpoint or automatic
     * recovery trigger. Never manufacture a missing original plan/generation. */
    JSONObject observeOriginalPrivateCustodyPieces(VaultEngine.NativePrivateCustodyChunkIdentityPlan original)throws VaultFailure {
        return AndroidPrivateCustodyPieceRecovery.observeOriginal(application,engine,original);
    }
    /** Internal explicit saved-owner read; zero caller identities/URLs/bytes.
     * No startup hook, employee bridge, provider effect or removal authority. */
    JSONObject observeSavedOriginalPrivateCustodyRecovery()throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.observeOriginal(application,engine,offlineStore,principalJournal,legacyJournal,providerCoordinator);
    }
    /** Explicit internal fixed native current read. Not an employee/plugin
     * endpoint, automatic lifecycle request or protected removal admission.
     * Caller owns control; the returned read owns its reconstructed original
     * scope until close. No supplied identity, bytes, URL or Connections seam.
     */
    VaultEngine.NativePrivateCustodyCurrentFrameRead readSavedOriginalPrivateCustodyCurrentFrame(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrame(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,new NativePrivateCustodyHttp(),control);
    }
    /** Protected screen only: fixed original-native status/probe/freeze path.
     * No employee/plugin hook, selected identity, manager claim, raw snapshot
     * getter or removal effect. Existing authenticated server separation is a
     * prerequisite; a failed/uncertain check leaves its original probe held. */
    void prepareOriginalWorkForCustody(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Thread.holdsLock(engine)||Thread.holdsLock(providerCoordinator))
            throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE);
        control.check();
        NativeSeparationFreeze.observe(engine,offlineStore,principalJournal,legacyJournal,control);
        control.check();
    }
    /** Fixed protected transport phase only. It cannot borrow the remaining
     * budget to start a new current-read phase or renew an old request. */
    JSONObject retainSavedOriginalNativeCustody(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.retainSavedOriginalRequests(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,new NativePrivateCustodyHttp(),control);
    }
    /** Separate explicit existing-only current read, with this invocation's
     * own normal finite control. Never creates, resends or retimes originals. */
    JSONObject readSavedOriginalNativeCustody(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        try(var read=AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrame(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,new NativePrivateCustodyHttp(),control)){
            try{
                var result=read.projection();control.check();
                result.put("browser_local_custody",read.observeSavedOriginalBrowserValues());control.check();return result;
            }catch(org.json.JSONException invalid){throw new VaultFailure("custodial_original_browser_preparation_unavailable",invalid);}
        }
    }
    /** Explicit local same-original journal recovery only. No HTTP dependency,
     * selector, replacement identity or automatic first-custody continuation. */
    JSONObject resumeSavedOriginalNativePieceJournals(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.resumeSavedOriginalPieceJournals(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,control);
    }
    /** Explicit FIRST local metadata baseline, not startup, a saved-operation
     * upgrade or a plugin route. The fixed native owner verifies frozen WORK;
     * no caller ID/approval, DATA removal or finalizer is introduced. */
    void establishInitialNativeMutationBaseline(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AndroidPrivateCustodyOwnerRecovery.establishInitialNativeMutationBaseline(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,control);
    }
    /** Explicit FIRST local retention only, with no caller IDs/bytes/root or
     * transport/ACK effect. Existing originals are never rebound or replaced. */
    JSONObject retainInitialOriginalPrivateCustody(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.retainInitialOriginal(application,engine,offlineStore,
            principalJournal,legacyJournal,providerCoordinator,control);
    }
    /** Internal existing-reader/application-semantics composition. The typed
     * result owns the read and original saved scope until closed. No employee
     * plugin, supplied identity, manager approval or acceptance is introduced.
     */
    VaultEngine.NativeRetainedNamespaceCompletionObservation readSavedOriginalPrivateCustodyCompletionSemantics(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        var read=readSavedOriginalPrivateCustodyCurrentFrame(control);
        try{return read.takeCompletionSemantics();}
        catch(VaultFailure|RuntimeException|Error failure){
            try{read.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
            throw failure;
        }
    }
    /** Internal fixed target read; not a manager decision or employee API. */
    VaultEngine.NativeSameOriginalRecoveryTargetObservation readSavedOriginalRecoveryPreparationTarget(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        var read=readSavedOriginalPrivateCustodyCurrentFrame(control);
        try{return read.takeOriginalRecoveryTarget(new NativePrivateCustodyHttp());}
        catch(VaultFailure|RuntimeException|Error failure){
            try{read.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
            throw failure;
        }
    }
    /** Source/local preparation only; existing saved original scope remains
     * owned until close. No employee action, challenge send or approval. */
    VaultEngine.NativeSameOriginalRecoveryPreparationIntent prepareSavedOriginalRecoveryPreparationIntent(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        var target=readSavedOriginalRecoveryPreparationTarget(control);
        try{return target.takeOriginalPreparationIntent();}
        catch(VaultFailure|RuntimeException|Error failure){
            try{target.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
            throw failure;
        }
    }
    /** Internal saved-byte preparation, NOT request dispatch or approval. */
    VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepareSavedOriginalRecoveryChallengeRequest(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        var target=readSavedOriginalRecoveryPreparationTarget(control);
        try{return target.takeFirstOriginalChallengeRequest();}
        catch(VaultFailure|RuntimeException|Error failure){
            try{target.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
            throw failure;
        }
    }
    /** Existing-only acquisition for browser continuation. The target's fixed
     * existing intent cannot create a missing intent/request or resend a
     * challenge. Success transfers the complete same-original owner chain. */
    private VaultEngine.NativeSameOriginalRecoveryPreparedRequest openExistingSavedOriginalRecoveryChallengeRequest(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return openExistingSavedOriginalRecoveryChallengeRequest(control,false);
    }
    private VaultEngine.NativeSameOriginalRecoveryPreparedRequest openExistingSavedOriginalRecoveryChallengeRequest(
        NativePrivateCustodyFrameReadControl control,boolean heldReconstruction)throws VaultFailure {
        control.check();
        var read=heldReconstruction
            ?AndroidPrivateCustodyOwnerRecovery.readHeldSavedOriginalCurrentFrameForBrowserPreparation(application,engine,offlineStore,
                principalJournal,legacyJournal,providerCoordinator,new NativePrivateCustodyHttp(),control)
            :AndroidPrivateCustodyOwnerRecovery.readSavedOriginalCurrentFrameForBrowserPreparation(application,engine,offlineStore,
                principalJournal,legacyJournal,providerCoordinator,new NativePrivateCustodyHttp(),control);
        VaultEngine.NativeSameOriginalRecoveryTargetObservation target;
        try{target=read.takeOriginalRecoveryTarget(new NativePrivateCustodyHttp());}
        catch(VaultFailure|RuntimeException|Error failure){
            try{read.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}throw failure;
        }
        VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent=null;
        try{
            control.check();intent=target.takeExistingOriginalPreparationIntent();control.check();
            var prepared=intent.takeOriginalChallengeRequest();
            try{control.check();return prepared;}
            catch(VaultFailure|RuntimeException|Error failure){
                try{prepared.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
                throw failure;
            }
        }catch(VaultFailure|RuntimeException|Error failure){
            try{if(intent!=null)intent.close();else target.close();}
            catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}
            throw failure;
        }
    }
    /** Explicit internal original-byte dispatch only. The caller retains the
     * SAME control and deadline throughout the saved read/target/intent chain.
     * No Engine/provider monitor surrounds HTTP, no restored request retry or
     * automatic trigger, and returned metadata is not approval or acceptance.
     */
    JSONObject sendSavedOriginalRecoveryChallenge(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null)throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
        control.check();
        JSONObject detached;
        // Resource cleanup preserves any primary failure and closes the entire
        // prepared original scope on success as well as every failed dispatch.
        try(var prepared=prepareSavedOriginalRecoveryChallengeRequest(control)){
            control.check();
            // Engine verifies this SAME original control, then owns the piece
            // only after its native prefix and through settled HTTP cleanup.
            var observation=engine.sendOriginalRecoveryChallenge(prepared,new NativePrivateCustodyHttp(),control);
            control.check();
            detached=new JSONObject(observation.toString());
            control.check();
        }catch(org.json.JSONException failure){
            throw new VaultFailure("custodial_private_custody_transport_outcome_unknown",failure);
        }
        control.check();
        return detached;
    }
    /** Internal existing-original observation only. The existing-only intent
     * handle cannot mint a missing intent or request. No challenge dispatch,
     * new control, approval or effect permission is introduced.
     */
    JSONObject observeSavedOriginalRecoveryChallengeOutcome(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return readExistingSavedOriginalRecoveryOutcome(control,false);
    }
    /** Explicit internal current-authenticated remote status read after an
     * uncertain original reply. Existing-only acquisition cannot mint a new
     * intent/request; this is not a challenge resend or employee endpoint. */
    JSONObject readSavedOriginalRecoveryChallengeStatus(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return readExistingSavedOriginalRecoveryOutcome(control,true);
    }
    private JSONObject readExistingSavedOriginalRecoveryOutcome(
        NativePrivateCustodyFrameReadControl control,boolean remoteStatus)throws VaultFailure {
        return readExistingSavedOriginalRecoveryOutcome(control,remoteStatus,false);
    }
    /** Internal fixed manager-purpose observation; never an employee/plugin
     * endpoint, supplied receipt/identity or automatic startup trigger. */
    JSONObject readCurrentSavedOriginalManagerPreparation(
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return readExistingSavedOriginalRecoveryOutcome(control,true,true);
    }
    private JSONObject readExistingSavedOriginalRecoveryOutcome(
        NativePrivateCustodyFrameReadControl control,boolean remoteStatus,boolean managerPreparation)throws VaultFailure {
        if(control==null)throw new VaultFailure("custodial_private_custody_transport_outcome_unknown");
        control.check();
        var target=readSavedOriginalRecoveryPreparationTarget(control);
        VaultEngine.NativeSameOriginalRecoveryPreparationIntent intent=null;
        VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared=null;
        Throwable primary=null;
        JSONObject detached;
        try{
            control.check();
            intent=target.takeExistingOriginalPreparationIntent();
            control.check();
            prepared=intent.takeOriginalChallengeRequest();
            control.check();
            var observation=managerPreparation?engine.readCurrentOriginalManagerPreparation(prepared,new NativePrivateCustodyHttp(),control):
                remoteStatus?engine.readOriginalRecoveryChallengeStatus(prepared,new NativePrivateCustodyHttp(),control)
                :engine.observeOriginalRecoveryChallengeOutcome(prepared);
            control.check();
            detached=new JSONObject(observation.toString());
            control.check();
        }catch(VaultFailure|RuntimeException|Error failure){
            primary=failure;throw failure;
        }catch(org.json.JSONException failure){
            var error=new VaultFailure("custodial_private_custody_transport_outcome_unknown",failure);
            primary=error;throw error;
        }finally{
            // Each successful factory transfers ownership of its predecessor.
            // Close only the latest owner, including on acquisition failure.
            try{
                if(prepared!=null)prepared.close();
                else if(intent!=null)intent.close();
                else target.close();
            }catch(RuntimeException|Error cleanup){
                if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;
            }
        }
        control.check();
        return detached;
    }
    /** Explicit internal read of a pending original only. No employee bridge,
     * automatic promotion, manager-auth fiction or removal/key capability. */
    JSONObject observePendingOriginalPrivateCustodyOwner()throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.observePendingOriginal(application,engine,offlineStore,principalJournal,legacyJournal,providerCoordinator);
    }
    /** Explicit internal local application observation; not manager/session,
     * browser, current SQL, automatic recovery or finalizer authority. */
    JSONObject observeSavedOriginalPrivateCustodyCompletionSemantics()throws VaultFailure {
        return AndroidPrivateCustodyOwnerRecovery.observeSavedCompletionSemantics(application,engine,offlineStore,principalJournal,legacyJournal,providerCoordinator);
    }
    /** Finite mirror operations only. Retained local state is never created by JS. */
    private NativeProviderRuntimeOwner requireMirrorOwner() throws VaultFailure {
        NativeProviderRuntimeOwner owner=localOwner();if(owner==null)throw new VaultFailure("custodial_provider_suspended");return owner;
    }
    Map<String,Object> providerMirrorAttach(Object plugin,NativeProviderMirrorAttachment.Hint hint)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorAttach(plugin,hint);}}
    }
    void providerMirrorStopped(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorStopped(plugin,attachment);}}
    }
    JSONObject providerMirrorClaimNext(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorClaimNext(plugin,attachment);}}
    }
    JSONObject providerMirrorClaimState(Object plugin,String attachment,String claim)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorClaimState(plugin,attachment,claim);}}
    }
    void providerMirrorApply(Object plugin,String attachment,String claim,String action)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorApply(plugin,attachment,claim,action);}}
    }
    void providerMirrorRetire(Object plugin,String attachment,String claim)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorRetire(plugin,attachment,claim);}}
    }
    void providerMirrorDetach(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorDetach(plugin,attachment);}}
    }
    /** Read compiled inputs and immutable packaged identity before constructing
     * any vault/provider namespace. Empty release inputs remain suspended. */
    private static NativeProviderReleaseAdmission.Selected qualifiedRelease(Context context) {
        if (!NativeProviderReleaseAdmission.hasCompiledInputs()) return null;
        try {
            NativeProviderAppIdentity app=AndroidProviderAppIdentity.read(context);
            NativeProviderReleaseAdmission.Selected clock=NativeProviderReleaseAdmission.compiled(AndroidProviderPlatform.read(),app);
            return NativeProviderAudioAdmission.compiled(app,clock)==null?null:clock;
        } catch (VaultFailure | RuntimeException unavailable) { return null; }
    }
    private static NativeProviderRuntimeOwner qualifiedOwner(Context context) {
        NativeProviderReleaseAdmission.Selected admitted = qualifiedRelease(context);
        try {
            return NativeProviderReleaseAdmission.open(admitted, profiles -> {
                CustodialNativeRuntime runtime = get(context);
                synchronized (runtime.engine) { synchronized (runtime.providerCoordinator) {
                    return runtime.localOwner(profiles, true);
                } }
            });
        } catch (VaultFailure | RuntimeException unavailable) { return null; }
    }
    static NativeProviderComponentRuntime providerComponents(Context context) {
        NativeProviderRuntimeOwner owner = qualifiedOwner(context);
        return owner == null ? NativeProviderComponentRuntime.SUSPENDED : owner;
    }
    static NativeProviderIngressRuntime providerIngress(Context context) {
        NativeProviderRuntimeOwner owner = qualifiedOwner(context);
        return owner == null ? NativeProviderIngressRuntime.SUSPENDED : owner;
    }
}
