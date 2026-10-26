package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.net.Uri;
import android.os.Looper;
import android.webkit.WebView;
import androidx.webkit.ScriptHandler;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;
import java.io.ByteArrayOutputStream;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Set;
import org.json.JSONObject;
import org.json.JSONArray;

/** Fixed normal application birth only. This is NOT an OS effect producer,
 * target acceptance, live principal/currentness grant or receipt authority.
 * The exact generated asset mounts the SAME normal bridge/presenter/scheduler
 * and employee owner. Nothing here exposes its private lexical sink to JS. */
final class NativeRecurringApplicationSource implements AutoCloseable {
    private static final String OBJECT="custodialRecurringScheduleApplication";
    private static final String ABORT_OBJECT="custodialRecurringOriginalWriterAbort";
    private OriginalWriterAbort originalWriterAbort;
    private static final String ASSET="memphis-custodial-recurring-application.js";
    private static final int MAX_SCRIPT=2*1024*1024;
    private final Bridge bridge;
    private final WebView view;
    private final String grantToken=token(),replyToken=token();
    private ScriptHandler script;
    private WebViewListener lifecycle;
    private boolean closed,initialRegistrationAttempted,listenerInstalled;
    // Diagnostic raw birth DATA only. A delayed BOUND callback cannot establish
    // document liveness or be converted into any Engine/receipt eligibility.
    private boolean producerBirthObserved;
    private long document;
    private boolean documentCommitted;
    private JavaScriptReplyProxy producerProxy;
    private DocumentRead pendingRead;
    private WriterStateRead pendingWriterState;
    private CallbackHold pendingCallbackHold;
    private OrdinaryReleaseRead pendingOrdinaryRelease;
    private boolean ordinaryWakeQueued;
    private int ordinaryObservationDiagnosticCount;
    private OrdinaryRenderWake pendingOrdinaryRenderWake;
    // Cleanup-only native lifetime. These fields NEVER admit a read, hold,
    // principal, effect or receipt. Authority errors may leave the JS page alive.
    private final CustodialNativeRuntime.RecurringBrowserCleanup ownerCleanup;
    private long cleanupNavigation;
    private JavaScriptReplyProxy cleanupProxy;
    private boolean cleanupViewRetired,physicalCleanupClaimed,physicalCleanupPosted;
    private Runnable physicalCleanup,destructionCleanup;
    private final java.util.ArrayList<CallbackRelease> callbackReleases=new java.util.ArrayList<>();
    private final class CallbackRelease implements Runnable {
        private final CallbackHold hold;
        private final long navigation;
        private boolean claimed;
        private CallbackRelease(CallbackHold original){hold=original;navigation=original.cleanupNavigation;}
        @Override public void run(){
            synchronized(NativeRecurringApplicationSource.this){
                if(claimed)return;
                claimed=true;callbackReleases.remove(this);
                // Only the original live native document's cleanup channel.
                // Logical Source retirement alone MUST NOT strand its JS body.
                if(Looper.myLooper()!=Looper.getMainLooper()||cleanupViewRetired
                    ||navigation!=cleanupNavigation||hold.originalProxy!=cleanupProxy)return;
                try{postCallbackCommand(hold,"RELEASE_CALLBACK_WRITERS",token(),true);}
                catch(Exception unavailable){android.util.Log.w("CustodialVault","recurring_callback_release_unavailable");}
            }
        }
    }
    private void drainCallbackReleasesOnUi(){
        if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("custodial_recurring_cleanup_requires_ui");
        for(var release:new java.util.ArrayList<>(callbackReleases))release.run();
    }
    // Bounded scalar diagnostics only; never consulted by Source authority.
    private volatile boolean diagnosticOwnerJavaRetired,diagnosticProviderDisposalDelegated;
    private volatile boolean diagnosticProviderRemovalAttempted;
    private int diagnosticLifecycleCount;
    private synchronized void diagnosticLifecycle(String stage,boolean sameView) {
        if(diagnosticLifecycleCount>=32)return;
        diagnosticLifecycleCount++;
        System.out.println("CUSTODIAL_RECURRING_SOURCE_LIFECYCLE stage="+stage
            +" elapsed="+android.os.SystemClock.elapsedRealtime()+" sameView="+sameView
            +" ui="+(Looper.myLooper()==Looper.getMainLooper())+" closed="+closed+" document="+document);
    }

    /** Denial ONLY. The immutable actual Engine is supplied by this browser's
     * native cleanup owner, never JS. The interface lives until WebView.destroy,
     * including after logical Source retirement, so an in-flight genuine
     * ordinary call always observes the same already-retired barrier.
     * No WebView/SDK/provider/cipher/Store/HTTP callback runs from this entry.
     */
    public final class OriginalWriterAbort {
        private final VaultEngine originalEngine;
        private OriginalWriterAbort(VaultEngine actual){originalEngine=actual;}
        @android.webkit.JavascriptInterface
        public boolean abort(String actualGrant,String actualReply){
            if(!grantToken.equals(actualGrant)||!replyToken.equals(actualReply))return false;
            synchronized(originalEngine){
                synchronized(NativeRecurringApplicationSource.this){
                    // Retire ALL evidence before allowing the exact original.
                    // An already-persisted ATTEMPTED row is never rolled back.
                    closed=true;producerBirthObserved=false;documentCommitted=false;
                    producerProxy=null;pendingOrdinaryRenderWake=null;
                    if(pendingOrdinaryRelease!=null){
                        OrdinaryReleaseRead read=pendingOrdinaryRelease;
                        synchronized(read){read.retired=true;read.processed=false;}
                        pendingOrdinaryRelease=null;
                    }
                    if(pendingRead!=null)pendingRead.close();
                    if(pendingWriterState!=null)pendingWriterState.close();
                    if(pendingCallbackHold!=null)pendingCallbackHold.retire();
                    // Immutable channel tokens survive retirement. This is a
                    // denial acknowledgement even when another path closed us.
                    return true;
                }
            }
        }
    }

    /** Wake ownership is scheduling DATA only. A private typed-render signal
     * cannot create a frame, choose a purpose, admit a native effect or POST. */
    final class OrdinaryRenderWake {
        private final long originalDocument=document;
        private final JavaScriptReplyProxy originalProxy=producerProxy;
        private OrdinaryRenderWake(){}
        void requireCurrent(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                if(expected!=NativeRecurringApplicationSource.this||closed||cleanupViewRetired||!documentCommitted
                    ||originalDocument!=document||originalProxy==null||originalProxy!=producerProxy)throw failure();
            }
        }
    }
    private void queueOrdinaryRenderWake(){
        // A private scheduling notice may precede native page commit. Retain
        // only its actual document/proxy identity, never eligibility or DATA.
        if(ownerCleanup==null)return;
        pendingOrdinaryRenderWake=new OrdinaryRenderWake();
        flushOrdinaryRenderWake();
    }
    private void flushOrdinaryRenderWake(){
        if(closed||cleanupViewRetired||!documentCommitted||ownerCleanup==null
            ||ordinaryWakeQueued||pendingOrdinaryRenderWake==null)return;
        OrdinaryRenderWake wake=pendingOrdinaryRenderWake;pendingOrdinaryRenderWake=null;ordinaryWakeQueued=true;
        // Callback returns before coordinator work. One queued notice plus one
        // coalesced later notice; no executor/retry timer or payload replay.
        if(!new android.os.Handler(Looper.getMainLooper()).post(()->{
            try{wake.requireCurrent(this);ownerCleanup.requestOrdinaryRender(this,wake);}
            catch(VaultFailure retired){/* A scheduling notice grants nothing. */}
            finally{synchronized(NativeRecurringApplicationSource.this){ordinaryWakeQueued=false;flushOrdinaryRenderWake();}}
        }))ordinaryWakeQueued=false;
    }
    /** A separate same-original-phase release-processed reply. Cleanup close
     * never fabricates this reply, and posting/return is not acceptance. */
    final class OrdinaryReleaseRead implements AutoCloseable {
        private final CallbackHold hold;private final String phase=token();
        private boolean processed,retired,taken;
        private OrdinaryReleaseRead(CallbackHold hold){this.hold=hold;}
        synchronized boolean hasReply(){return processed&&!retired&&!taken;}
        CompletedCallbackRelease takeProcessed(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireOrdinaryRelease(this,expected);
                synchronized(this){if(!processed||retired||taken)throw failure();taken=true;
                    if(pendingOrdinaryRelease==this)pendingOrdinaryRelease=null;
                    return new CompletedCallbackRelease(hold);}}
        }
        @Override public void close(){synchronized(NativeRecurringApplicationSource.this){
            final boolean cleanup;
            synchronized(this){cleanup=!retired&&!taken;retired=true;processed=false;}
            if(pendingOrdinaryRelease==this)pendingOrdinaryRelease=null;
            // A lost processed reply must not strand ordinary JS callbacks.
            // This one cleanup-only release has NO reply/receipt authority.
            if(cleanup)queueOrdinaryReleaseCleanup(hold);
        }}
    }
    private void queueOrdinaryReleaseCleanup(CallbackHold hold){
        CallbackRelease remove=new CallbackRelease(hold);callbackReleases.add(remove);
        if(Looper.myLooper()==Looper.getMainLooper())remove.run();
        else if(cleanupViewRetired){remove.claimed=true;callbackReleases.remove(remove);}
        else try{if(!view.post(remove)){remove.claimed=true;callbackReleases.remove(remove);}}
        catch(RuntimeException unavailable){remove.claimed=true;callbackReleases.remove(remove);}
    }
    final class CompletedCallbackRelease {
        private final CallbackHold original;
        private CompletedCallbackRelease(CallbackHold hold){original=hold;}
        void requireOriginal(NativeRecurringApplicationSource expected,CallbackHold hold)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                if(expected!=NativeRecurringApplicationSource.this||original!=hold||!original.ordinaryDelivery
                    ||closed||cleanupViewRetired||!documentCommitted||original.originalDocument!=document
                    ||original.originalProxy!=producerProxy)throw failure();
            }
        }
    }
    private void requireOrdinaryRelease(OrdinaryReleaseRead read,NativeRecurringApplicationSource expected)throws VaultFailure {
        requireRealmOnUi();
        if(expected!=this||read==null||pendingOrdinaryRelease!=read||closed||cleanupViewRetired||!documentCommitted
            ||read.retired||read.taken||read.hold.originalDocument!=document||read.hold.originalProxy!=producerProxy
            ||!employeePage(view.getUrl()))throw failure();
    }

    /** Passive authenticated scalars only. They do not acquire a hold or
     * authorize any later read/effect; the actual HOLD always checks afresh. */
    static final class WriterState {
        final long epoch;final int active;final boolean unknown,held,ownersReady;
        private WriterState(long epoch,int active,boolean unknown,boolean held,boolean ownersReady){
            this.epoch=epoch;this.active=active;this.unknown=unknown;this.held=held;this.ownersReady=ownersReady;
        }
    }
    final class WriterStateRead implements AutoCloseable {
        private final long originalDocument;private final JavaScriptReplyProxy originalProxy;
        private final String phase=token();private WriterState reply;private boolean retired,taken;
        private WriterStateRead(){originalDocument=document;originalProxy=producerProxy;}
        synchronized boolean hasReply(){return !retired&&!taken&&reply!=null;}
        WriterState take(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireWriterStateRead(this,expected);
                synchronized(this){if(retired||taken||reply==null)throw failure();taken=true;
                    WriterState result=reply;reply=null;pendingWriterState=null;return result;}}
        }
        @Override public void close(){synchronized(NativeRecurringApplicationSource.this){
            synchronized(this){retired=true;reply=null;}if(pendingWriterState==this)pendingWriterState=null;
        }}
    }
    synchronized WriterStateRead beginWriterStateRead()throws VaultFailure {
        requireRealmOnUi();
        if(closed||!documentCommitted||document<1||producerProxy==null||pendingRead!=null||pendingCallbackHold!=null
            ||pendingWriterState!=null||pendingOrdinaryRelease!=null||!employeePage(view.getUrl()))throw failure();
        WriterStateRead read=new WriterStateRead();pendingWriterState=read;
        try{JSONObject command=new JSONObject();command.put("schema","custodial.native-recurring-document-command.v1");
            command.put("grant_token",grantToken);command.put("command","OBSERVE_CALLBACK_WRITERS");command.put("phase",read.phase);
            read.originalProxy.postMessage(command.toString());requireWriterStateRead(read,this);return read;
        }catch(Exception unavailable){read.close();throw failure();}
    }
    private void requireWriterStateRead(WriterStateRead read,NativeRecurringApplicationSource expected)throws VaultFailure {
        requireRealmOnUi();
        if(expected!=this||read==null||pendingWriterState!=read||closed||!documentCommitted||read.retired||read.taken
            ||read.originalDocument!=document||read.originalProxy!=producerProxy||!employeePage(view.getUrl()))throw failure();
    }

    /** Opaque, Source-created one-use native channel DATA. This is deliberately
     * not a target/OS receipt or a current-principal/settlement capability. */
    final class DocumentRead implements AutoCloseable {
        private final long originalDocument;
        private final JavaScriptReplyProxy originalProxy;
        private final String phase=token();
        private byte[] reply;
        private String rawChannelSha256;
        private boolean retired,taken;
        private DocumentRead(long doc,JavaScriptReplyProxy proxy){originalDocument=doc;originalProxy=proxy;}
        synchronized boolean hasReply(){return !retired&&!taken&&reply!=null;}
        byte[] takeRawData(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this) {
                requireDocumentRead(this,expected);
                synchronized(this) {
                    if(retired||taken||reply==null)throw failure();
                    // Transfer only native-parsed DATA (never private channel tokens). The
                    // eventual typed owner must independently join principal,
                    // original target, OS effects and durable journal fences.
                    byte[] value=reply;reply=null;taken=true;pendingRead=null;return value;
                }
            }
        }
        @Override public void close(){synchronized(NativeRecurringApplicationSource.this){
            synchronized(this){retired=true;if(reply!=null)Arrays.fill(reply,(byte)0);reply=null;rawChannelSha256=null;}
            if(pendingRead==this)pendingRead=null;
        }}
    }

    synchronized DocumentRead beginDocumentDataRead()throws VaultFailure {
        requireRealmOnUi();
        if(closed||!documentCommitted||document<1||producerProxy==null||pendingRead!=null||pendingCallbackHold!=null||pendingWriterState!=null||pendingOrdinaryRelease!=null
            ||!employeePage(view.getUrl()))throw failure();
        DocumentRead read=new DocumentRead(document,producerProxy);pendingRead=read;
        try {
            JSONObject command=new JSONObject();command.put("schema","custodial.native-recurring-document-command.v1");
            command.put("grant_token",grantToken);command.put("command","OBSERVE_RAW_DATA");command.put("phase",read.phase);
            read.originalProxy.postMessage(command.toString());
            requireDocumentRead(read,this);return read;
        }catch(Exception unavailable){read.close();throw failure();}
    }
    private void requireDocumentRead(DocumentRead read,NativeRecurringApplicationSource expected)throws VaultFailure {
        requireRealmOnUi();
        if(expected!=this||read==null||pendingRead!=read||closed||!documentCommitted
            ||read.originalDocument!=document||read.originalProxy!=producerProxy||!employeePage(view.getUrl()))throw failure();
    }

    /** Source-born callback interlock ATTEMPT only. Neither this object nor
     * its raw observations establish WORK/OS/principal/target settlement or
     * permit a receipt. No copied JS JSON can construct one. All channel and
     * WebView observations run on UI; never wait for UI under a vendor lock. */
    /** Captured native document lifetime DATA only. It permits the original
     * application HOLD to end before network I/O; it never approves effects,
     * reopens a retired Source or addresses a successor JS document. */
    final class CompletedDocumentLifetime {
        private final CallbackHold original;
        private CompletedDocumentLifetime(CallbackHold original){this.original=original;}
        void requireCurrent(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                if(expected!=NativeRecurringApplicationSource.this||closed||cleanupViewRetired||!documentCommitted
                    ||original.originalDocument!=document||original.originalProxy!=producerProxy
                    ||original.cleanupNavigation!=cleanupNavigation)throw failure();
            }
        }
    }
    final class CallbackHold implements AutoCloseable {
        private final long originalDocument;
        private final JavaScriptReplyProxy originalProxy;
        private final boolean ordinaryDelivery;
        private final String holdPhase=token();
        private final long cleanupNavigation;
        private final CallbackRead initial;
        private final java.util.Set<OrdinaryCallbackFrame> ordinaryFrames=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        private CallbackRead pending,terminal;
        private long originalWriterEpoch=-1;
        private boolean retired,initialTaken,terminalRequested,nativeWriterLeaseAttempted;
        private CallbackHold(long doc,JavaScriptReplyProxy proxy){this(doc,proxy,false);}
        private CallbackHold(long doc,JavaScriptReplyProxy proxy,boolean ordinary){
            ordinaryDelivery=ordinary;originalDocument=doc;originalProxy=proxy;cleanupNavigation=NativeRecurringApplicationSource.this.cleanupNavigation;
            initial=new CallbackRead(this,holdPhase,false);pending=initial;
        }
        CallbackRead initialRead(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireCallbackHold(this,expected);return initial;}
        }
        CallbackRead beginTerminalRead(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireCallbackHold(this,expected);
                if(!initialTaken||pending!=null||terminalRequested||originalWriterEpoch<0)throw failure();
                terminalRequested=true; // Claim BEFORE posting; no retry after throw.
                terminal=new CallbackRead(this,token(),true);pending=terminal;
                try{postCallbackCommand(this,ordinaryDelivery?"OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS":"OBSERVE_HELD_CALLBACK_WRITERS",terminal.phase,true);
                    requireCallbackRead(terminal,expected);return terminal;}
                catch(Exception unavailable){close();throw failure();}
            }
        }
        /** Native lifetime DATA only, usable under the vendor monitor without
         * a UI wait or WebView access. The actual terminal UI read remains
         * independently mandatory; this is not document/currentness authority. */
        void claimNativeWriterLeaseBirth(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireNativeWriterLeaseBirth(expected);
                if(nativeWriterLeaseAttempted)throw failure();
                nativeWriterLeaseAttempted=true; // BEFORE native callbacks; never retry this hold.
            }
        }
        void requireNativeWriterLeaseBirth(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireNativeWriterLeaseLifetime(expected);
                if(terminalRequested||pending!=null)throw failure();
            }
        }
        void requireNativeWriterLeaseLifetime(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                if(expected!=NativeRecurringApplicationSource.this||pendingCallbackHold!=this||retired||closed
                    ||!documentCommitted||!initialTaken||originalWriterEpoch<0
                    ||originalDocument!=document||originalProxy!=producerProxy)throw failure();
            }
        }
        CompletedDocumentLifetime captureCompletedDocumentLifetime(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireNativeWriterLeaseLifetime(expected);
                if(!ordinaryDelivery||!terminalRequested||pending!=null)throw failure();
                return new CompletedDocumentLifetime(this);
            }
        }
        OrdinaryReleaseRead beginOrdinaryReleaseForTransport(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireCallbackHold(this,expected);
                if(!ordinaryDelivery||!terminalRequested||pending!=null||pendingOrdinaryRelease!=null)throw failure();
                OrdinaryReleaseRead read=new OrdinaryReleaseRead(this);pendingOrdinaryRelease=read;
                try{postCallbackCommand(this,"RELEASE_ORDINARY_DELIVERY_WRITERS",read.phase,true);
                    // Retire the old hold/frame authority while retaining ONLY
                    // this authenticated release reply until take/close/nav.
                    retire();return read;
                }catch(Exception unavailable){read.close();close();throw failure();}
            }
        }
        /** Explicit UI release. Posting is not a callback/OS settlement ACK. */
        void release(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireCallbackHold(this,expected);
                try{postCallbackCommand(this,"RELEASE_CALLBACK_WRITERS",token(),true);}
                catch(Exception unavailable){retire();throw failure();}
                retire();
            }
        }
        private void retire(){
            retired=true;initial.retire();if(terminal!=null)terminal.retire();pending=null;
            for(OrdinaryCallbackFrame frame:java.util.List.copyOf(ordinaryFrames))frame.close();
            if(pendingCallbackHold==this)pendingCallbackHold=null;
        }
        @Override public void close(){
            synchronized(NativeRecurringApplicationSource.this){
                boolean release=!retired;retire();
                if(!release)return;
                CallbackRelease remove=new CallbackRelease(this);callbackReleases.add(remove);
                if(Looper.myLooper()==Looper.getMainLooper())remove.run();
                else if(cleanupViewRetired){remove.claimed=true;callbackReleases.remove(remove);}
                else try{
                    // Queue publication and native owner retirement share this
                    // monitor: no View call can follow the retirement barrier.
                    if(!view.post(remove)){remove.claimed=true;callbackReleases.remove(remove);
                        android.util.Log.w("CustodialVault","recurring_callback_release_unavailable");}
                }catch(RuntimeException unavailable){remove.claimed=true;callbackReleases.remove(remove);
                    android.util.Log.w("CustodialVault","recurring_callback_release_unavailable");}
            }
        }
    }
    /** One exact native request/response phase. Raw DATA transfers once and
     * must still join the original target/native generation/effects/journal. */
    final class CallbackRead implements AutoCloseable {
        private final CallbackHold hold;
        private final String phase;
        private final boolean terminal;
        private byte[] reply;
        private String rawChannelSha256;
        private boolean retired,taken;
        private String refusalKind;
        synchronized boolean hasTerminalRefusal(){return refusalKind!=null;}
        synchronized String terminalRefusalKind(){return refusalKind;}
        private CallbackRead(CallbackHold owner,String nonce,boolean last){hold=owner;phase=nonce;terminal=last;}
        synchronized boolean hasReply(){return !retired&&!taken&&reply!=null;}
        byte[] takeRawData(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireCallbackRead(this,expected);
                synchronized(this){
                    if(hold.ordinaryDelivery||retired||taken||reply==null)throw failure();
                    byte[] value=reply;reply=null;taken=true;hold.pending=null;
                    if(!terminal)hold.initialTaken=true;
                    return value;
                }
            }
        }
        /** Exact ordinary channel transfer only. A JSON copy cannot mint a frame. */
        OrdinaryCallbackFrame takeOriginalOrdinaryFrame(NativeRecurringApplicationSource expected)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                requireCallbackRead(this,expected);
                synchronized(this){
                    if(!hold.ordinaryDelivery||retired||taken||reply==null||rawChannelSha256==null)throw failure();
                    OrdinaryCallbackFrame frame=new OrdinaryCallbackFrame(hold,terminal,reply,rawChannelSha256);
                    reply=null;taken=true;hold.pending=null;if(!terminal)hold.initialTaken=true;
                    return frame;
                }
            }
        }
        private synchronized void retire(){retired=true;if(reply!=null)Arrays.fill(reply,(byte)0);reply=null;rawChannelSha256=null;}
        @Override public void close(){synchronized(NativeRecurringApplicationSource.this){hold.close();}}
    }
    synchronized CallbackHold beginCallbackWriterHold()throws VaultFailure {
        requireRealmOnUi();
        if(originalWriterAbort==null)throw failure();
        drainCallbackReleasesOnUi();
        if(closed||!documentCommitted||document<1||producerProxy==null||pendingRead!=null||pendingCallbackHold!=null||pendingWriterState!=null||pendingOrdinaryRelease!=null
            ||!employeePage(view.getUrl()))throw failure();
        CallbackHold hold=new CallbackHold(document,producerProxy);pendingCallbackHold=hold;
        try{postCallbackCommand(hold,"HOLD_CALLBACK_WRITERS",hold.holdPhase,false);
            requireCallbackHold(hold,this);return hold;}
        catch(Exception unavailable){hold.close();throw failure();}
    }
    /** Separate ordinary schema; existing protected/raw hold remains unchanged. */
    synchronized CallbackHold beginOrdinaryDeliveryWriterHold()throws VaultFailure {
        requireRealmOnUi();
        if(originalWriterAbort==null)throw failure();drainCallbackReleasesOnUi();
        if(closed||!documentCommitted||document<1||producerProxy==null||pendingRead!=null||pendingCallbackHold!=null||pendingWriterState!=null||pendingOrdinaryRelease!=null
            ||!employeePage(view.getUrl()))throw failure();
        CallbackHold hold=new CallbackHold(document,producerProxy,true);pendingCallbackHold=hold;
        try{postCallbackCommand(hold,"HOLD_ORDINARY_DELIVERY_WRITERS",hold.holdPhase,false);
            requireCallbackHold(hold,this);return hold;}
        catch(Exception unavailable){hold.close();throw failure();}
    }
    /** Source-born opaque raw DATA. No OS/WORK/principal/effect or receipt grant. */
    final class OrdinaryCallbackFrame implements AutoCloseable {
        private final CallbackHold hold;private final boolean terminal;
        private final long originalDocument,writerEpoch;private final JavaScriptReplyProxy originalProxy;
        private final String channelSha256;private byte[] raw;private boolean claimed,retired;
        private OrdinaryCallbackFrame(CallbackHold hold,boolean terminal,byte[] raw,String channelSha256){
            this.hold=hold;this.terminal=terminal;this.raw=raw;this.channelSha256=channelSha256;
            originalDocument=hold.originalDocument;originalProxy=hold.originalProxy;writerEpoch=hold.originalWriterEpoch;hold.ordinaryFrames.add(this);
        }
        void requireOriginal(NativeRecurringApplicationSource expected,CallbackHold original)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){
                hold.requireNativeWriterLeaseLifetime(expected);
                if(original!=hold||!hold.ordinaryDelivery||retired||raw==null||originalDocument!=hold.originalDocument
                    ||originalProxy!=hold.originalProxy||writerEpoch!=hold.originalWriterEpoch||channelSha256==null)throw failure();
            }
        }
        void claimInitial(NativeRecurringApplicationSource expected,CallbackHold original)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireOriginal(expected,original);
                if(terminal||claimed)throw failure();claimed=true;}
        }
        void requireTerminalOf(OrdinaryCallbackFrame initial,NativeRecurringApplicationSource expected,CallbackHold original)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireOriginal(expected,original);initial.requireOriginal(expected,original);
                if(!terminal||claimed||initial.terminal||!initial.claimed||initial.hold!=hold
                    ||initial.writerEpoch!=writerEpoch||initial.originalDocument!=originalDocument||initial.originalProxy!=originalProxy)throw failure();
                claimed=true;
            }
        }
        byte[] copyData(NativeRecurringApplicationSource expected,CallbackHold original)throws VaultFailure {
            synchronized(NativeRecurringApplicationSource.this){requireOriginal(expected,original);return raw.clone();}
        }
        @Override public void close(){synchronized(NativeRecurringApplicationSource.this){retired=true;if(raw!=null)Arrays.fill(raw,(byte)0);raw=null;hold.ordinaryFrames.remove(this);}}
    }
    private void requireCallbackHold(CallbackHold hold,NativeRecurringApplicationSource expected)throws VaultFailure {
        requireRealmOnUi();
        if(expected!=this||hold==null||pendingCallbackHold!=hold||hold.retired||closed||!documentCommitted
            ||hold.originalDocument!=document||hold.originalProxy!=producerProxy||!employeePage(view.getUrl()))throw failure();
    }
    private void requireCallbackRead(CallbackRead read,NativeRecurringApplicationSource expected)throws VaultFailure {
        if(read==null)throw failure();requireCallbackHold(read.hold,expected);
        if(read.hold.pending!=read||read.retired||read.taken||read.refusalKind!=null||read.terminal&&!read.hold.initialTaken)throw failure();
    }
    private void postCallbackCommand(CallbackHold hold,String command,String phase,boolean original)throws Exception {
        if(Looper.myLooper()!=Looper.getMainLooper())throw failure();
        JSONObject value=new JSONObject();value.put("schema","custodial.native-recurring-document-command.v1");
        value.put("grant_token",grantToken);value.put("command",command);value.put("phase",phase);
        if(original)value.put("hold_phase",hold.holdPhase);
        hold.originalProxy.postMessage(value.toString());
    }

    static NativeRecurringApplicationSource attach(Context application,Bridge bridge)throws VaultFailure {
        if(application==null||bridge==null||Looper.myLooper()!=Looper.getMainLooper()
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))throw failure();
        return attach(application,bridge,null);
    }
    static NativeRecurringApplicationSource attach(Context application,Bridge bridge,
        CustodialNativeRuntime.RecurringBrowserCleanup cleanup)throws VaultFailure {
        if(application==null||bridge==null||Looper.myLooper()!=Looper.getMainLooper()
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))throw failure();
        return new NativeRecurringApplicationSource(application,bridge,cleanup);
    }
    private NativeRecurringApplicationSource(Context application,Bridge bridge,
        CustodialNativeRuntime.RecurringBrowserCleanup cleanup)throws VaultFailure {
        this.bridge=bridge;view=bridge.getWebView();if(view==null)throw failure();
        ownerCleanup=cleanup;if(cleanup!=null){
            cleanup.bind(this,bridge,view);
            originalWriterAbort=new OriginalWriterAbort(cleanup.originalWriterAbortEngine(this,bridge,view));
        }
        byte[] bytes=null,buildBytes=null;
        try {
            requireRealmOnUi();
            // Only the actual Runtime-owned Source can install a HOLD barrier.
            // Ownerless DATA adapters retain ordinary app behavior, no HOLD.
            if(originalWriterAbort!=null)view.addJavascriptInterface(originalWriterAbort,ABORT_OBJECT);
            bytes=asset(application,"public/"+ASSET,MAX_SCRIPT);
            buildBytes=asset(application,"public/build.json",65_536);
            JSONObject build=new JSONObject(utf8(buildBytes));
            JSONObject entry=build.getJSONObject("native_recurring_application_bootstrap");
            NativeRetainedAttempt.keys(entry,"schema","asset","sha256");
            if(!"custodial".equals(build.get("edition"))
                ||!"custodial.native-recurring-application-asset.v1".equals(entry.get("schema"))
                ||!ASSET.equals(entry.get("asset"))||!hex(MessageDigest.getInstance("SHA-256").digest(bytes)).equals(entry.get("sha256")))throw failure();
            String body="(()=>{'use strict';const module={exports:{}};const exports=module.exports;\n"+utf8(bytes)
                +"\nif(typeof module.exports.installNativeRecurringApplication!=='function')throw Error('Normal application source unavailable');"
                +"module.exports.installNativeRecurringApplication({grantToken:"+JSONObject.quote(grantToken)
                +",replyToken:"+JSONObject.quote(replyToken)+"});})();";
            WebViewCompat.addWebMessageListener(view,OBJECT,Set.of("https://localhost"),(actual,message,origin,main,proxy)->{
                // A retained registration can still receive late callbacks.
                // Logical retirement wins BEFORE any provider/settings read.
                synchronized(this){if(closed)return;}
                if(actual!=view||proxy==null)return;
                if(!main||!origin(origin)){close();return;}
                try {requireRealmOnUi();}catch(VaultFailure unavailable){close();return;}
                if(message==null||message.getType()!=WebMessageCompat.TYPE_STRING)return;
                final String raw;try {raw=message.getData();}catch(RuntimeException malformed){return;}
                if(raw==null||raw.length()>262144)return;
                synchronized(this) {
                    if(closed||!employeePage(view.getUrl()))return;
                    try {
                        JSONObject birth=new JSONObject(raw);
                        if("custodial.native-recurring-ordinary-render-wake.v1".equals(birth.optString("schema"))){
                            NativeRetainedAttempt.keys(birth,"schema","reply_token");
                            if(proxy!=producerProxy||!replyToken.equals(birth.opt("reply_token")))return;
                            queueOrdinaryRenderWake();return;
                        }
                        if("custodial.native-recurring-ordinary-release-processed.v1".equals(birth.optString("schema"))){
                            OrdinaryReleaseRead read=pendingOrdinaryRelease;
                            if(read==null||proxy!=read.hold.originalProxy||!replyToken.equals(birth.opt("reply_token"))
                                ||!read.phase.equals(birth.opt("phase"))||!read.hold.holdPhase.equals(birth.opt("hold_phase")))return;
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","hold_phase","hold_active",
                                "writer_epoch","held_attempted","writer_unknown","active_writer_count","receipt_eligible");
                            requireOrdinaryRelease(read,this);
                            if(!Boolean.FALSE.equals(birth.get("hold_active"))||!Boolean.FALSE.equals(birth.get("receipt_eligible"))
                                ||!Boolean.FALSE.equals(birth.get("held_attempted"))||!Boolean.FALSE.equals(birth.get("writer_unknown"))
                                ||callbackEpoch(birth.get("writer_epoch"))!=read.hold.originalWriterEpoch
                                ||callbackEpoch(birth.get("active_writer_count"))!=0)throw failure();
                            synchronized(read){if(!read.retired&&!read.taken&&!read.processed)read.processed=true;}
                            return;
                        }
                        if("custodial.native-recurring-writer-state-data.v1".equals(birth.optString("schema"))){
                            WriterStateRead read=pendingWriterState;
                            if(read==null||proxy!=read.originalProxy||!replyToken.equals(birth.opt("reply_token"))||!read.phase.equals(birth.opt("phase")))return;
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","writer_epoch","active_writer_count","writer_unknown","hold_active","snapshot_owners_ready","receipt_eligible");
                            requireWriterStateRead(read,this);
                            long epoch=callbackEpoch(birth.get("writer_epoch")),count=callbackEpoch(birth.get("active_writer_count"));
                            if(count>16384||!(birth.get("writer_unknown") instanceof Boolean)||!(birth.get("hold_active") instanceof Boolean)
                                ||!(birth.get("snapshot_owners_ready") instanceof Boolean)||!Boolean.FALSE.equals(birth.get("receipt_eligible")))throw failure();
                            synchronized(read){if(read.retired||read.taken||read.reply!=null)return;
                                read.reply=new WriterState(epoch,(int)count,birth.getBoolean("writer_unknown"),birth.getBoolean("hold_active"),birth.getBoolean("snapshot_owners_ready"));}
                            return;
                        }
                        if("custodial.native-recurring-ordinary-observation-diagnostic.v1".equals(birth.optString("schema"))){
                            CallbackHold hold=pendingCallbackHold;CallbackRead read=hold==null?null:hold.pending;
                            if(read==null||!hold.ordinaryDelivery||ordinaryObservationDiagnosticCount>=16
                                ||proxy!=hold.originalProxy||!replyToken.equals(birth.opt("reply_token"))
                                ||!hold.holdPhase.equals(birth.opt("hold_phase"))||!read.phase.equals(birth.opt("phase")))return;
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","hold_phase","stage","guard","operation",
                                "site","ordinal","held_attempted","writer_epoch","held_epoch","active_writer_count","writer_unknown","receipt_eligible");
                            requireCallbackRead(read,this);
                            String stage=birth.getString("stage"),guard=birth.getString("guard"),operation=birth.getString("operation"),site=birth.getString("site");
                            if(!Set.of("ENTRY","OWNERS","RENDER_KEYS","SELECTOR_COPY","OWNER_IDENTITY","SERIALIZE","PUBLICATION",
                                "EMPLOYEE_BEFORE","EMPLOYEE_CALL","EMPLOYEE_AFTER","EMPLOYEE_COPY","EMPLOYEE_COPIED",
                                "PRESENTER_BEFORE","PRESENTER_CALL","PRESENTER_AFTER","PRESENTER_COPY","PRESENTER_COPIED",
                                "SCHEDULER_BEFORE","SCHEDULER_CALL","SCHEDULER_AFTER","SCHEDULER_COPY","SCHEDULER_COPIED",
                                "REMINDER_BEFORE","REMINDER_CALL","REMINDER_AFTER","REMINDER_COPY","REMINDER_COPIED").contains(stage)
                                ||!Set.of("NONE","DOCUMENT","HOLD").contains(guard)||!Set.of("NONE","POLL","LOAD","RECONCILE","OTHER").contains(operation)
                                ||!Set.of("BRIDGE_RECONCILE","UNCLASSIFIED","EMPLOYEE_341","EMPLOYEE_419","EMPLOYEE_420","EMPLOYEE_421","EMPLOYEE_422","EMPLOYEE_423","EMPLOYEE_424","EMPLOYEE_425","EMPLOYEE_426","EMPLOYEE_427","EMPLOYEE_428","EMPLOYEE_429","EMPLOYEE_430","EMPLOYEE_431","EMPLOYEE_432","EMPLOYEE_433","EMPLOYEE_434","EMPLOYEE_435","EMPLOYEE_448","EMPLOYEE_457","EMPLOYEE_467","EMPLOYEE_469","PRESENTER_109","PRESENTER_123","PRESENTER_126","PRESENTER_134","PRESENTER_139","PRESENTER_141","PRESENTER_163","PRESENTER_189","PRESENTER_236","PRESENTER_257","PRESENTER_262","PRESENTER_269","PRESENTER_280","PRESENTER_50","PRESENTER_90","REMINDER_1018","REMINDER_1094","REMINDER_1198","REMINDER_1245","REMINDER_1280","REMINDER_1289","REMINDER_1292","REMINDER_1299","REMINDER_1464","REMINDER_1569","REMINDER_1573","REMINDER_1580","REMINDER_1597","REMINDER_1598","REMINDER_1599","REMINDER_1600","REMINDER_1601","REMINDER_1602","REMINDER_1603","REMINDER_1604","REMINDER_1605","REMINDER_1606","REMINDER_1607","REMINDER_1608","REMINDER_1609","REMINDER_1610","REMINDER_1611","REMINDER_1612","REMINDER_1613","REMINDER_1614","REMINDER_1615","REMINDER_1616","REMINDER_1617","REMINDER_1618","REMINDER_1619","REMINDER_1620","REMINDER_1621","REMINDER_1622","REMINDER_1623","REMINDER_1624","REMINDER_1625","REMINDER_1626","REMINDER_1627","REMINDER_1628","REMINDER_1629","REMINDER_1630","REMINDER_1631","REMINDER_1632","REMINDER_1633","REMINDER_1634","REMINDER_1635","REMINDER_1636","REMINDER_1637","REMINDER_1638","REMINDER_1639","REMINDER_1640","REMINDER_1641","REMINDER_580","REMINDER_586","REMINDER_590","REMINDER_605","REMINDER_616","REMINDER_674","REMINDER_701","REMINDER_945","SCHEDULER_OWNED").contains(site)
                                ||!(birth.get("held_attempted") instanceof Boolean)||!(birth.get("writer_unknown") instanceof Boolean)
                                ||!Boolean.FALSE.equals(birth.get("receipt_eligible")))return;
                            long ordinal=callbackEpoch(birth.get("ordinal")),epoch=callbackEpoch(birth.get("writer_epoch")),
                                heldEpoch=callbackEpoch(birth.get("held_epoch")),count=callbackEpoch(birth.get("active_writer_count"));
                            if(ordinal<1||ordinal>16||count>16384)return;
                            ordinaryObservationDiagnosticCount++;
                            System.out.println("CUSTODIAL_ORDINARY_OBSERVATION_NATIVE_DIAGNOSTIC phase="+(read.terminal?"TERMINAL":"INITIAL")
                                +" stage="+stage+" guard="+guard+" operation="+operation+" site="+site+" ordinal="+ordinal
                                +" heldAttempted="+birth.getBoolean("held_attempted")+" writerEpoch="+epoch+" heldEpoch="+heldEpoch
                                +" activeWriters="+count+" writerUnknown="+birth.getBoolean("writer_unknown"));
                            return;
                        }
                        if("custodial.native-recurring-callback-refused-data.v1".equals(birth.optString("schema"))){
                            CallbackHold hold=pendingCallbackHold;CallbackRead read=hold==null?null:hold.pending;
                            if(read==null||proxy!=hold.originalProxy||!replyToken.equals(birth.opt("reply_token"))
                                ||!hold.holdPhase.equals(birth.opt("hold_phase"))||!read.phase.equals(birth.opt("phase")))return;
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","hold_phase","kind","writer_epoch","active_writer_count","writer_unknown","receipt_eligible");
                            requireCallbackRead(read,this);String kind=birth.getString("kind");
                            long epoch=callbackEpoch(birth.get("writer_epoch")),count=callbackEpoch(birth.get("active_writer_count"));
                            if(!Set.of("HOLD_ALREADY_ACTIVE","WRITER_UNKNOWN","WRITERS_ACTIVE","OBSERVATION_FAILED").contains(kind)
                                ||count>16384||!(birth.get("writer_unknown") instanceof Boolean)||!Boolean.FALSE.equals(birth.get("receipt_eligible")))throw failure();
                            synchronized(read){if(read.retired||read.taken||read.reply!=null||read.refusalKind!=null)return;read.refusalKind=kind;}
                            System.out.println("CUSTODIAL_RECURRING_CALLBACK_REFUSAL kind="+kind+" writerEpoch="+epoch+" activeWriters="+count+" writerUnknown="+birth.getBoolean("writer_unknown"));
                            return;
                        }
                        if("custodial.native-recurring-ordinary-held-data.v1".equals(birth.optString("schema"))) {
                            CallbackHold hold=pendingCallbackHold;CallbackRead read=hold==null?null:hold.pending;
                            if(read==null||!hold.ordinaryDelivery||proxy!=hold.originalProxy||!replyToken.equals(birth.opt("reply_token"))
                                ||!hold.holdPhase.equals(birth.opt("hold_phase"))||!read.phase.equals(birth.opt("phase")))return;
                            try {
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","hold_phase","writer_epoch","receipt_eligible","failed_callback_terminals","data");
                            requireCallbackRead(read,this);
                            long epoch=callbackEpoch(birth.get("writer_epoch"));
                            if(!Boolean.FALSE.equals(birth.get("receipt_eligible")))throw failure();
                            if(hold.originalWriterEpoch>=0&&hold.originalWriterEpoch!=epoch)throw failure();
                            JSONArray failures=birth.getJSONArray("failed_callback_terminals");
                            if(failures.length()>128)throw failure();
                            long previous=-1;
                            for(int i=0;i<failures.length();i++){
                                JSONObject item=failures.getJSONObject(i);NativeRetainedAttempt.keys(item,"epoch","kind");
                                long observed=callbackEpoch(item.get("epoch"));
                                if(observed<=previous||observed>epoch||!Set.of("SYNC_THROW","PROMISE_REJECTED","HELD_PRE_EFFECT_REFUSAL").contains(item.get("kind")))throw failure();
                                previous=observed;
                            }
                            JSONObject data=birth.getJSONObject("data");
                            NativeRetainedAttempt.keys(data,"schema","receipt_eligible","selector","employee","presenter","scheduler","reminder");
                            if(!"custodial.native-recurring-ordinary-document-data.v1".equals(data.get("schema"))
                                ||!Boolean.FALSE.equals(data.get("receipt_eligible")))throw failure();
                            JSONObject selector=data.getJSONObject("selector");
                            NativeRetainedAttempt.keys(selector,"principal","service_date","intent_id","target_digest");
                            for(String key:new String[]{"principal","service_date","intent_id","target_digest"})
                                if(!(selector.get(key) instanceof String))throw failure();
                            String[] owners={"employee","presenter","scheduler","reminder"};
                            String[] schemas={"custodial.native-employee-raw-data.v1","custodial.native-presenter-ordinary-target-data.v1",
                                "custodial.native-scheduler-ordinary-target-data.v1","custodial.native-reminder-ordinary-target-data.v1"};
                            for(int i=0;i<owners.length;i++){
                                JSONObject owner=data.getJSONObject(owners[i]);
                                if(!schemas[i].equals(owner.get("schema"))||!Boolean.FALSE.equals(owner.get("receipt_eligible")))throw failure();
                            }
                            requireCallbackRead(read,this);
                            synchronized(read){if(read.retired||read.taken||read.reply!=null)return;
                                byte[] channel=raw.getBytes(StandardCharsets.UTF_8);
                                try{
                                    if(channel.length>1_048_576)throw failure();
                                    read.rawChannelSha256=hex(MessageDigest.getInstance("SHA-256").digest(channel));
                                    // Strip channel secrets only. Retain ALL observed failed
                                    // callback kind/epoch DATA; no effect UNKNOWN is erased.
                                    JSONObject retained=new JSONObject();
                                    retained.put("schema","custodial.native-recurring-ordinary-native-data.v1");
                                    retained.put("receipt_eligible",false);retained.put("writer_epoch",epoch);
                                    retained.put("failed_callback_terminals",failures);retained.put("document_data",data);
                                    read.reply=retained.toString().getBytes(StandardCharsets.UTF_8);hold.originalWriterEpoch=epoch;
                                }finally{Arrays.fill(channel,(byte)0);}
                            }
                            }catch(Exception unavailable){hold.close();}
                            return;
                        }
                        if("custodial.native-recurring-callback-held-data.v1".equals(birth.optString("schema"))) {
                            CallbackHold hold=pendingCallbackHold;CallbackRead read=hold==null?null:hold.pending;
                            if(read==null||hold.ordinaryDelivery||proxy!=hold.originalProxy||!replyToken.equals(birth.opt("reply_token"))
                                ||!hold.holdPhase.equals(birth.opt("hold_phase"))||!read.phase.equals(birth.opt("phase")))return;
                            try {
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","hold_phase","writer_epoch","receipt_eligible","failed_callback_terminals","data");
                            requireCallbackRead(read,this);
                            long epoch=callbackEpoch(birth.get("writer_epoch"));
                            if(!Boolean.FALSE.equals(birth.get("receipt_eligible")))throw failure();
                            if(hold.originalWriterEpoch>=0&&hold.originalWriterEpoch!=epoch)throw failure();
                            JSONArray failures=birth.getJSONArray("failed_callback_terminals");
                            if(failures.length()>128)throw failure();
                            long previous=-1;
                            for(int i=0;i<failures.length();i++){
                                JSONObject item=failures.getJSONObject(i);NativeRetainedAttempt.keys(item,"epoch","kind");
                                long observed=callbackEpoch(item.get("epoch"));
                                if(observed<=previous||observed>epoch||!Set.of("SYNC_THROW","PROMISE_REJECTED","HELD_PRE_EFFECT_REFUSAL").contains(item.get("kind")))throw failure();
                                previous=observed;
                            }
                            JSONObject data=birth.getJSONObject("data");
                            NativeRetainedAttempt.keys(data,"schema","receipt_eligible","employee","presenter","scheduler","reminder");
                            if(!"custodial.native-recurring-document-raw-data.v1".equals(data.get("schema"))
                                ||!Boolean.FALSE.equals(data.get("receipt_eligible")))throw failure();
                            String[] owners={"employee","presenter","scheduler","reminder"};
                            String[] schemas={"custodial.native-employee-raw-data.v1","custodial.native-presenter-raw-data.v1",
                                "custodial.native-scheduler-raw-data.v1","custodial.native-browser-reminder-state-data.v1"};
                            for(int i=0;i<owners.length;i++){
                                JSONObject owner=data.getJSONObject(owners[i]);
                                if(!schemas[i].equals(owner.get("schema"))||!Boolean.FALSE.equals(owner.get("receipt_eligible")))throw failure();
                            }
                            requireCallbackRead(read,this);
                            synchronized(read){if(read.retired||read.taken||read.reply!=null)return;
                                byte[] channel=raw.getBytes(StandardCharsets.UTF_8);
                                try{
                                    if(channel.length>1_048_576)throw failure();
                                    read.rawChannelSha256=hex(MessageDigest.getInstance("SHA-256").digest(channel));
                                    // Strip channel secrets only. Retain ALL observed failed
                                    // callback kind/epoch DATA; no effect UNKNOWN is erased.
                                    JSONObject retained=new JSONObject();
                                    retained.put("schema","custodial.native-recurring-callback-native-data.v1");
                                    retained.put("receipt_eligible",false);retained.put("writer_epoch",epoch);
                                    retained.put("failed_callback_terminals",failures);retained.put("document_data",data);
                                    read.reply=retained.toString().getBytes(StandardCharsets.UTF_8);hold.originalWriterEpoch=epoch;
                                }finally{Arrays.fill(channel,(byte)0);}
                            }
                            }catch(Exception unavailable){hold.close();}
                            return;
                        }
                        if("custodial.native-recurring-document-reply.v1".equals(birth.optString("schema"))) {
                            NativeRetainedAttempt.keys(birth,"schema","reply_token","phase","data");
                            DocumentRead read=pendingRead;
                            if(read==null||proxy!=read.originalProxy||!replyToken.equals(birth.get("reply_token"))
                                ||!read.phase.equals(birth.get("phase")))return;
                            requireDocumentRead(read,this);
                            JSONObject data=birth.getJSONObject("data");
                            NativeRetainedAttempt.keys(data,"schema","receipt_eligible","employee","presenter","scheduler","reminder");
                            if(!"custodial.native-recurring-document-raw-data.v1".equals(data.get("schema"))
                                ||!Boolean.FALSE.equals(data.get("receipt_eligible")))return;
                            String[] owners={"employee","presenter","scheduler","reminder"};
                            String[] schemas={"custodial.native-employee-raw-data.v1","custodial.native-presenter-raw-data.v1",
                                "custodial.native-scheduler-raw-data.v1","custodial.native-browser-reminder-state-data.v1"};
                            for(int i=0;i<owners.length;i++) {
                                JSONObject owner=data.getJSONObject(owners[i]);
                                if(!schemas[i].equals(owner.get("schema"))||!Boolean.FALSE.equals(owner.get("receipt_eligible")))return;
                            }
                            requireDocumentRead(read,this);
                            synchronized(read){if(read.retired||read.taken||read.reply!=null)return;
                                byte[] channel=raw.getBytes(StandardCharsets.UTF_8);
                                try{read.rawChannelSha256=hex(MessageDigest.getInstance("SHA-256").digest(channel));
                                    read.reply=data.toString().getBytes(StandardCharsets.UTF_8);
                                }finally{Arrays.fill(channel,(byte)0);}
                            }
                            return;
                        }
                        NativeRetainedAttempt.keys(birth,"schema","reply_token","state");
                        if(!"custodial.native-recurring-normal-birth.v1".equals(birth.get("schema"))
                            ||!replyToken.equals(birth.get("reply_token"))
                            ||!"NORMAL_PRODUCERS_BOUND_NOT_SETTLEMENT".equals(birth.get("state")))return;
                        producerBirthObserved=true;
                        // First exact injected object only. A later callback
                        // never replaces an existing document's channel.
                        if(producerProxy==null)producerProxy=proxy;
                        // The authenticated fixed bootstrap's actual native
                        // proxy is cleanup DATA, independently of read authority.
                        if(!cleanupViewRetired&&cleanupProxy==null)cleanupProxy=proxy;
                    }catch(Exception malformed){/* No callback DATA is native authority. */}
                }
            });
            listenerInstalled=true;
            script=WebViewCompat.addDocumentStartJavaScript(view,body,Set.of("https://localhost"));
            lifecycle=new WebViewListener(){
                @Override public void onPageStarted(WebView actual){if(actual==view){
                    diagnosticLifecycle("PAGE_STARTED_BEFORE_INVALIDATE",true);
                    synchronized(NativeRecurringApplicationSource.this){
                        // Drain any prior off-UI close, then release the active
                        // old-page hold before retiring its navigation channel.
                        drainCallbackReleasesOnUi();invalidateDocument();
                        cleanupProxy=null;
                        if(cleanupNavigation==Long.MAX_VALUE)retireRenderedView();else cleanupNavigation++;
                    }
                    diagnosticLifecycle("PAGE_STARTED_AFTER_INVALIDATE",true);
                }}
                @Override public void onPageCommitVisible(WebView actual,String url){
                    diagnosticLifecycle("PAGE_COMMIT_BEFORE_OBSERVE",actual==view);
                    if(actual==view)synchronized(NativeRecurringApplicationSource.this){
                        if(!closed&&employeePage(url)&&employeePage(view.getUrl())){documentCommitted=true;flushOrdinaryRenderWake();}
                    }
                    diagnosticLifecycle("PAGE_COMMIT_AFTER_OBSERVE",actual==view);
                }
                @Override public void onReceivedError(WebView actual){if(actual==view)invalidateDocument();}
                @Override public void onReceivedHttpError(WebView actual){if(actual==view)invalidateDocument();}
                @Override public boolean onRenderProcessGone(WebView actual,android.webkit.RenderProcessGoneDetail detail){
                    if(actual==view)retireRenderedView();return false;
                }
            };
            bridge.addWebViewListener(lifecycle);
        }catch(VaultFailure unavailable){close();throw unavailable;}
        catch(Exception unavailable){close();throw failure();}
        finally {if(bytes!=null)Arrays.fill(bytes,(byte)0);if(buildBytes!=null)Arrays.fill(buildBytes,(byte)0);}
    }
    synchronized void requireAttachedView(WebView expected)throws VaultFailure {
        if(closed||expected==null||expected!=view)throw failure();
    }
    /** Builder replaces its listeners after plugin load. Complete only this
     * same initial registration before the first navigation; never repair it. */
    synchronized void completeInitialBridgeRegistration(Bridge expected)throws VaultFailure {
        if(closed||Looper.myLooper()!=Looper.getMainLooper()||expected!=bridge||expected.getWebView()!=view)throw failure();
        if(initialRegistrationAttempted)return;
        initialRegistrationAttempted=true;
        if(lifecycle==null||document!=0||producerBirthObserved){close();throw failure();}
        try {bridge.removeWebViewListener(lifecycle);bridge.addWebViewListener(lifecycle);}
        catch(RuntimeException unavailable){close();throw failure();}
    }
    private void requireRealmOnUi()throws VaultFailure {
        if(Looper.myLooper()!=Looper.getMainLooper())throw failure();
        try {var settings=view.getSettings();if(settings==null||settings.supportMultipleWindows()
            ||settings.getJavaScriptCanOpenWindowsAutomatically())throw failure();}
        catch(VaultFailure unavailable){throw unavailable;}
        catch(RuntimeException unavailable){throw failure();}
    }
    private synchronized void invalidateDocument(){
        if(document==Long.MAX_VALUE){close();return;}
        document++;documentCommitted=false;producerBirthObserved=false;producerProxy=null;pendingOrdinaryRenderWake=null;
        if(pendingOrdinaryRelease!=null)pendingOrdinaryRelease.close();
        if(pendingRead!=null)pendingRead.close();
        if(pendingWriterState!=null)pendingWriterState.close();
        if(pendingCallbackHold!=null)pendingCallbackHold.close();
    }
    @Override public void close(){closeInternal(false);}
    private void closeInternal(boolean ownerDestruction) {
        final Runnable remove;
        synchronized(this){
            // A denial-only synchronous abort can retire authority without
            // calling any UI/provider operation. Later original cleanup must
            // still stage once, even though closed was already set.
            if(physicalCleanup==null){
                closed=true;producerBirthObserved=false;documentCommitted=false;producerProxy=null;pendingOrdinaryRenderWake=null;
                if(pendingOrdinaryRelease!=null)pendingOrdinaryRelease.close();
        if(pendingRead!=null)pendingRead.close();
                if(pendingWriterState!=null)pendingWriterState.close();
                if(pendingCallbackHold!=null)pendingCallbackHold.close();
                final ScriptHandler ownedScript=script;script=null;
                final WebViewListener ownedLifecycle=lifecycle;lifecycle=null;
                final boolean ownedListener=listenerInstalled;listenerInstalled=false;
                // Sole cleanup task is published before a concurrent owner
                // death can retire the view or claim physical removal.
                physicalCleanup=()->runPhysicalCleanup(ownedScript,ownedLifecycle,ownedListener,false);
                destructionCleanup=()->runPhysicalCleanup(ownedScript,ownedLifecycle,ownedListener,true);
            }
            remove=physicalCleanup;
            if(remove==null||physicalCleanupClaimed||ownerDestruction||physicalCleanupPosted)return;
            // Same native owner/view lifetime as the normal Capacitor bridge.
            // Keep provider registrations until WebView.destroy disposes them;
            // authority and pending reads have already retired above. The
            // independent R2c live-document release channel remains unchanged.
            if(ownerCleanup!=null){diagnosticLifecycle("OWNER_BOUND_REGISTRATIONS_RETAINED",true);return;}
            if(cleanupViewRetired){physicalCleanupClaimed=true;return;}
            // Native API unregister must not run on its own message callback
            // stack. A real owner death alone drains this queued task inline.
            physicalCleanupPosted=true;
            try{if(!view.post(remove))android.util.Log.w("CustodialVault","recurring_application_cleanup_unavailable");}
            catch(RuntimeException unavailable){android.util.Log.w("CustodialVault","recurring_application_cleanup_unavailable");}
        }
    }
    private void runPhysicalCleanup(ScriptHandler ownedScript,WebViewListener ownedLifecycle,boolean ownedListener,
        boolean ownerDestruction){
        // Owner-bound generic/captured tasks never call provider unregister,
        // including a late captured task after native owner retirement.
        if(ownerCleanup!=null){
            if(!ownerDestruction)return;
            synchronized(this){
                if(physicalCleanupClaimed)return;
                if(Looper.myLooper()!=Looper.getMainLooper())return;
                physicalCleanupClaimed=true;
            }
            // Actual native owner predicate was checked by the sole caller.
            // This is ONLY Java-listener retirement; actual view destruction
            // is independently observed by the test host after Plugin destroy.
            if(ownedLifecycle!=null)bridge.removeWebViewListener(ownedLifecycle);
            diagnosticOwnerJavaRetired=true;
            diagnosticProviderDisposalDelegated=true;
            diagnosticLifecycle("OWNER_JAVA_RETIRED_PROVIDER_DISPOSAL_DELEGATED",true);
            return;
        }
        synchronized(this){
            if(physicalCleanupClaimed)return;
            physicalCleanupClaimed=true;
            if(Looper.myLooper()!=Looper.getMainLooper()||cleanupViewRetired&&!ownerDestruction)return;
            drainCallbackReleasesOnUi();
        }
        diagnosticLifecycle("RETIRE_STATE_SET",true);
        diagnosticProviderRemovalAttempted=true;
            try {if(ownedScript!=null){
                diagnosticLifecycle("SCRIPT_REMOVE_BEFORE",true);
                ownedScript.remove();
                diagnosticLifecycle("SCRIPT_REMOVE_AFTER",true);
            }}
            finally {try {if(ownedListener){
                diagnosticLifecycle("MESSAGE_LISTENER_REMOVE_BEFORE",true);
                WebViewCompat.removeWebMessageListener(view,OBJECT);
                diagnosticLifecycle("MESSAGE_LISTENER_REMOVE_AFTER",true);
            }} finally {if(ownedLifecycle!=null){
                diagnosticLifecycle("BRIDGE_LISTENER_REMOVE_BEFORE",true);
                bridge.removeWebViewListener(ownedLifecycle);
                diagnosticLifecycle("BRIDGE_LISTENER_REMOVE_AFTER",true);
            }}}
    }
    private void retireRenderedView(){
        synchronized(this){cleanupViewRetired=true;cleanupProxy=null;}
        closeInternal(false);
    }
    void finishCleanupForOwnerDestruction(CustodialNativeRuntime.RecurringBrowserCleanup cleanup){
        if(cleanup==null||cleanup!=ownerCleanup||!cleanup.permitsOwnerDestruction(this,bridge,view))return;
        final Runnable remove,drain;
        synchronized(this){
            cleanupViewRetired=true;cleanupProxy=null;
            closeInternal(true);remove=physicalCleanup;drain=destructionCleanup;
            // Retire releases locally. A dying JS document must not be called.
            for(var release:callbackReleases)release.claimed=true;
            callbackReleases.clear();
            if(physicalCleanupClaimed||remove==null)return;
        }
        // Owner-bound cleanup was never posted. Do not touch the provider at
        // this Java-owner boundary; actual WebView.destroy follows separately.
        if(ownerCleanup!=null){drain.run();return;}
        // Historical ownerless path retains its exact API-removal body.
        try{view.removeCallbacks(remove);}
        finally{
            // Same original API body; this private task is invoked only after
            // the actual Plugin destruction predicate above. View retirement
            // remains one-way, including while these pre-destroy removals run.
            drain.run();
        }
    }
    private static long callbackEpoch(Object value)throws VaultFailure {
        if(!(value instanceof Integer)&&!(value instanceof Long))throw failure();
        long epoch=((Number)value).longValue();
        if(epoch<0||epoch>9007199254740991L)throw failure();return epoch;
    }
    private static boolean origin(Uri value){return value!=null&&"https".equals(value.getScheme())&&"localhost".equals(value.getHost())
        &&value.getUserInfo()==null&&(value.getPort()==-1||value.getPort()==443);}
    private static boolean employeePage(String raw){try {Uri page=Uri.parse(raw);return origin(page)&&"/employee-schedule.html".equals(page.getPath());}
        catch(RuntimeException malformed){return false;}}
    private static byte[] asset(Context application,String name,int max)throws Exception {
        try(var input=application.getAssets().open(name);var out=new ByteArrayOutputStream()) {
            byte[] block=new byte[8192];for(int n;(n=input.read(block))!=-1;){if(out.size()+n>max)throw failure();out.write(block,0,n);}
            if(out.size()==0)throw failure();return out.toByteArray();
        }
    }
    private static String utf8(byte[] bytes)throws Exception {return StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(bytes)).toString();}
    private static String token(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);try{return hex(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}
    private static VaultFailure failure(){return new VaultFailure("custodial_recurring_application_source_unavailable");}
}
