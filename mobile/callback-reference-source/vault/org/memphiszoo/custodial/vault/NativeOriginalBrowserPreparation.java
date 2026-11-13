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
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Native-owned document-start source, NOT an employee/plugin API or ACK.
 * Two transient private source stamps bind the exact injected closure. They
 * are not credentials, operation IDs, stored keys or reusable effect evidence.
 * The receive stamp is never included in a native-to-page message. The private
 * bootstrap binds the native postMessage before page code and never exposes its
 * collector/factory/raw values. Origin/main-frame and document lifetime are
 * independently checked by the platform callback, not supplied in JSON.
 */
final class NativeOriginalBrowserPreparation implements AutoCloseable {
    private static final String OBJECT="custodialOriginalBrowserPreparation";
    private static final String ASSET="memphis-custodial-original-browser.js";
    private static final int MAX_SCRIPT=2*1024*1024,MAX_MESSAGE=16*1024*1024;
    private static final String[] BINDING={"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"};
    private final WebView view;
    private final Bridge nativeBridge;
    private WebViewListener lifecycle;
    private boolean initialBridgeRegistrationAttempted;
    private final String grantToken=token(),replyToken=token();
    private final Object monitor=new Object();
    private ScriptHandler script;
    private final CustodialNativeRuntime.OriginalBrowserCleanup ownerCleanup;
    private Runnable physicalCleanup;
    private boolean physicalCleanupClaimed;
    private long document;
    private boolean closed,ready,documentUsed;
    // Diagnostic scalars only; never consulted by native Source authority.
    private volatile boolean diagnosticPhysicalCleanupStarted,diagnosticPhysicalCleanupFinished,diagnosticPhysicalCleanupPostRefused;
    private volatile boolean diagnosticOwnerJavaRetired,diagnosticProviderDisposalDelegated;
    private JavaScriptReplyProxy documentProxy;
    private Pending pending;
    private RecoveryReload recoveryReload;

    /** A queued UI action only, never a capture/current-manager capability. */
    private static final class RecoveryReload {
        final long document,startedNanos=System.nanoTime();
        final NativePrivateCustodyFrameReadControl control;
        final ArrayBlockingQueue<Boolean> settled=new ArrayBlockingQueue<>(1);
        RecoveryReload(long document,NativePrivateCustodyFrameReadControl control){this.document=document;this.control=control;}
    }

    private static final class SourceMessage {
        final String raw;final long document;
        SourceMessage(String raw,long document){this.raw=raw;this.document=document;}
    }
    private static final class Pending {
        final long document;final String nonce,binding;final JavaScriptReplyProxy proxy;
        final long startedNanos=System.nanoTime();
        String phaseNonce;
        final NativePrivateCustodyFrameReadControl control;
        final ArrayBlockingQueue<SourceMessage> replies=new ArrayBlockingQueue<>(2);
        boolean closed;
        Pending(long document,String binding,NativePrivateCustodyFrameReadControl control,JavaScriptReplyProxy proxy){
            this.document=document;this.binding=binding;this.control=control;this.proxy=proxy;nonce=token();
        }
    }

    static NativeOriginalBrowserPreparation attach(Context context,Bridge bridge)throws VaultFailure {
        return attach(context,bridge,null);
    }
    static NativeOriginalBrowserPreparation attach(Context context,Bridge bridge,
        CustodialNativeRuntime.OriginalBrowserCleanup cleanup)throws VaultFailure {
        if(context==null||bridge==null||Looper.myLooper()!=Looper.getMainLooper()
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
            ||!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))throw failure();
        return new NativeOriginalBrowserPreparation(context,bridge,cleanup);
    }
    private NativeOriginalBrowserPreparation(Context context,Bridge bridge,
        CustodialNativeRuntime.OriginalBrowserCleanup cleanup)throws VaultFailure {
        nativeBridge=bridge;
        view=bridge.getWebView();if(view==null)throw failure();
        ownerCleanup=cleanup;
        if(cleanup!=null)cleanup.bind(this,bridge,view);
        byte[] bytes=null,buildBytes=null;
        try{
            requireConstrainedNativeRealmOnUi();
            bytes=asset(context,"public/"+ASSET,MAX_SCRIPT);
            buildBytes=asset(context,"public/build.json",65536);
            JSONObject build=new JSONObject(utf8(buildBytes));
            JSONObject source=build.getJSONObject("native_original_browser_bootstrap");
            NativeRetainedAttempt.keys(source,"schema","asset","sha256");
            if(!"custodial.native-original-browser-bootstrap-asset.v1".equals(source.get("schema"))
                ||!ASSET.equals(source.get("asset"))||!hash(bytes).equals(source.get("sha256"))
                ||!"custodial".equals(build.get("edition")))throw failure();
            String body=NativeOriginalBrowserRealmSource.script(grantToken,replyToken)
                +"\n(()=>{'use strict';const module={exports:{}};const exports=module.exports;\n"+utf8(bytes)
                +"\nif(typeof module.exports.installNativeOriginalBrowserPreparation!=='function')throw Error('Original source unavailable');"
                +"module.exports.installNativeOriginalBrowserPreparation({grantToken:"+JSONObject.quote(grantToken)
                +",replyToken:"+JSONObject.quote(replyToken)+"});})();";
            WebViewCompat.addWebMessageListener(view,OBJECT,Set.of("https://localhost"),(actual,message,origin,main,proxy)->{
                // Closed native listeners may remain until this exact view is
                // destroyed. Refuse BEFORE settings/provider/message access.
                synchronized(monitor){if(closed)return;}
                if(actual!=view)return; // Another native view is not ours to retire.
                // A platform-observed child/foreign realm in THIS view is a
                // withdrawal of this single-document source, not ignorable
                // noise followed by continued original-current publication.
                // This is denial only; it cannot prove that unseen realms or
                // pre-existing workers do not exist.
                if(!main||!origin(origin)){close();return;}
                try{requireConstrainedNativeRealmOnUi();}
                catch(VaultFailure unavailable){close();return;}
                if(message==null||message.getType()!=WebMessageCompat.TYPE_STRING)return;
                final String raw;try{raw=message.getData();}catch(RuntimeException invalid){return;}
                if(raw==null||raw.length()>MAX_MESSAGE)return;
                synchronized(monitor){
                    if(closed||!local(view.getUrl()))return;
                    if(raw.length()<1024)try{
                        JSONObject hello=new JSONObject(raw);
                        if("custodial.native-original-browser-realm-withdrawal.v1".equals(hello.opt("schema"))){
                            NativeRetainedAttempt.keys(hello,"schema","reply_token");
                            if(replyToken.equals(hello.get("reply_token")))close();
                            return;
                        }
                        if("custodial.native-original-browser-document-retired.v1".equals(hello.opt("schema"))){
                            NativeRetainedAttempt.keys(hello,"schema","reply_token");
                            if(replyToken.equals(hello.get("reply_token")))retireDocument(proxy);
                            return;
                        }
                        if("custodial.native-original-browser-bootstrap.v1".equals(hello.opt("schema"))){
                            NativeRetainedAttempt.keys(hello,"schema","reply_token");
                            if(replyToken.equals(hello.get("reply_token"))&&!documentUsed){ready=true;documentProxy=proxy;}
                            return;
                        }
                    }catch(Exception ignored){/* A capture reply is checked off the UI thread below. */}
                    if(pending!=null&&!pending.closed&&pending.document==document)
                        pending.replies.offer(new SourceMessage(raw,document));
                }
            });
            script=WebViewCompat.addDocumentStartJavaScript(view,body,Set.of("https://localhost"));
            lifecycle=new WebViewListener(){
                @Override public void onPageStarted(WebView actual){if(actual==view)invalidateDocument();}
                @Override public void onReceivedError(WebView actual){if(actual==view)invalidateDocument();}
                @Override public void onReceivedHttpError(WebView actual){if(actual==view)invalidateDocument();}
                @Override public boolean onRenderProcessGone(WebView actual,android.webkit.RenderProcessGoneDetail detail){
                    if(actual==view)invalidateDocument();return false;
                }
            };
            bridge.addWebViewListener(lifecycle);
        }catch(VaultFailure invalid){close();throw invalid;}
        catch(Exception invalid){close();throw failure();}
        finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);if(buildBytes!=null)Arrays.fill(buildBytes,(byte)0);}
    }
    /** Native registration identity only. An existing Source cannot be
     * adopted by another WebView after an Activity/plugin lifecycle change. */
    void requireAttachedView(WebView expected)throws VaultFailure {
        synchronized(monitor){if(closed||expected==null||expected!=view)throw failure();}
    }
    /** Capacitor Builder replaces its listener list after plugin load. Finish
     * registration of THIS same callback once, after Builder returns and before
     * the initial UI navigation callbacks. Never attach a new Source, clear a
     * retired document, renew a capture or repair a later lost registration. */
    void completeInitialBridgeRegistration(Bridge expected)throws VaultFailure {
        synchronized(monitor){
            if(Looper.myLooper()!=Looper.getMainLooper()||closed||expected!=nativeBridge
                ||expected==null||expected.getWebView()!=view)throw failure();
            if(initialBridgeRegistrationAttempted)return;
            initialBridgeRegistrationAttempted=true;
            if(lifecycle==null||document!=0||ready||documentUsed||documentProxy!=null||pending!=null||recoveryReload!=null){
                close();throw failure();
            }
            try{
                expected.removeWebViewListener(lifecycle);
                expected.addWebViewListener(lifecycle);
            }catch(RuntimeException unavailable){close();throw failure();}
        }
    }
    /** Native settings observation, never page-supplied realm/ACK authority.
     * Do not silently reconfigure a changed view or adopt its new settings.
     * Construction and each UI delivery/receipt use the same real WebView.
     */
    private void requireConstrainedNativeRealmOnUi()throws VaultFailure {
        if(Looper.myLooper()!=Looper.getMainLooper())throw failure();
        try{
            var settings=view.getSettings();
            if(settings==null||settings.supportMultipleWindows()||settings.getJavaScriptCanOpenWindowsAutomatically())throw failure();
        }catch(VaultFailure unavailable){close();throw unavailable;}
        catch(RuntimeException unavailable){close();throw failure();}
        catch(Error unavailable){close();throw unavailable;}
    }
    private void invalidateDocument(){synchronized(monitor){
        document++;ready=false;documentUsed=false;documentProxy=null;if(pending!=null)pending.closed=true;
    }}
    /** Denial for this exact platform-supplied document proxy only. A late
     * old-page notice cannot retire its successor. A forged pagehide can only
     * deny this document: it never resets documentUsed or creates a new
     * capture baseline. Only native onPageStarted does that, and every new
     * capture still needs its original current-owner checks. */
    private void retireDocument(JavaScriptReplyProxy proxy){synchronized(monitor){
        if(closed||proxy==null||proxy!=documentProxy)return;
        ready=false;documentUsed=true;documentProxy=null;
        if(pending!=null){pending.closed=true;pending.replies.clear();}
    }}
    private void current(Pending value)throws VaultFailure {
        requireCaptureLifetime(value.startedNanos,value.control);
        synchronized(monitor){if(closed||value.closed||pending!=value||value.document!=document)throw failure();}
    }
    /** Same resource lifetime as the injected capture, measured from native
     * admission rather than a later reply. This never authenticates work time
     * or extends the original control/document budget. */
    private static void requireCaptureLifetime(long startedNanos)throws VaultFailure {
        long elapsed=System.nanoTime()-startedNanos;
        if(elapsed<0||elapsed>=30_000_000_000L)throw failure();
    }
    private static void requireCaptureLifetime(long startedNanos,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        requireCaptureLifetime(startedNanos);
        if(control==null)throw failure();
        control.check();
        requireCaptureLifetime(startedNanos);
    }
    private static void requireReloadCommandLifetime(long startedNanos,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        long elapsed=System.nanoTime()-startedNanos;
        if(elapsed<0||elapsed>=5_000_000_000L||control==null)throw failure();
        control.check();
        elapsed=System.nanoTime()-startedNanos;
        if(elapsed<0||elapsed>=5_000_000_000L)throw failure();
    }
    /** Explicit protected-maintenance UI only, between completed attempts.
     * The private one-use Source cannot be reopened in the same document.
     * Reloading its fixed app page is NOT a resend, new original, authenticated
     * manager read or hold cancellation. Every later action must independently
     * reconstruct and authenticate the same retained original again. */
    void reloadConsumedRecoveryDocument(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control==null||Looper.myLooper()==Looper.getMainLooper())throw failure();
        control.check();final RecoveryReload request;
        synchronized(monitor){
            // WebView URL access belongs to the queued UI callback below.
            if(closed||pending!=null||recoveryReload!=null||!documentUsed)throw failure();
            request=new RecoveryReload(document,control);recoveryReload=request;
        }
        boolean posted=false;
        try{
            posted=view.post(()->{
                boolean completed=false;
                try{
                    synchronized(monitor){
                        requireReloadCommandLifetime(request.startedNanos,request.control);
                        if(closed||recoveryReload!=request||document!=request.document||pending!=null
                            ||!documentUsed||!local(view.getUrl()))throw failure();
                        requireConstrainedNativeRealmOnUi();
                        // Retire the old document BEFORE invoking the UI effect.
                        // A throwing/ambiguous reload cannot revive its Source.
                        invalidateDocument();view.reload();completed=true;
                    }
                }catch(Exception refused){/* Signal unavailable; never retry or clear retained storage. */}
                finally{
                    synchronized(monitor){if(recoveryReload==request)recoveryReload=null;}
                    request.settled.offer(completed);
                }
            });
            if(!posted)throw failure();
            for(;;){
                requireReloadCommandLifetime(request.startedNanos,control);
                Boolean completed;
                try{completed=request.settled.poll(100,TimeUnit.MILLISECONDS);}
                catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure();}
                if(completed==null)continue;
                requireReloadCommandLifetime(request.startedNanos,control);
                if(!completed)throw failure();return;
            }
        }finally{
            // A posted callback owns settlement. Its original control will be
            // closed by the maintenance worker on timeout/cancel, so a delayed
            // callback refuses before effect. Never open a competing capture.
            if(!posted)synchronized(monitor){if(recoveryReload==request)recoveryReload=null;}
        }
    }
    private void send(Pending value,String command)throws VaultFailure {
        current(value);
        final boolean close="CLOSE".equals(command);
        final String phase=token();
        final String raw;
        try{
            JSONObject message=new JSONObject(value.binding).put("schema","custodial.native-original-browser-capture-request.v1")
                .put("command",command).put("grant_token",grantToken).put("request_nonce",value.nonce).put("phase_nonce",phase);
            raw=message.toString();
        }catch(Exception invalid){throw failure();}
        synchronized(monitor){value.phaseNonce=phase;}
        if(!view.post(()->{
            synchronized(monitor){
                if(closed||document!=value.document||!local(view.getUrl())
                    ||!close&&(pending!=value||value.closed)){value.closed=true;return;}
                try{requireConstrainedNativeRealmOnUi();}
                catch(VaultFailure unavailable){value.closed=true;close();return;}
                // UI scheduling is an asynchronous boundary. Admission before
                // view.post cannot authorize a delayed capture after its same
                // original resource budget/control has expired or closed.
                // CLOSE still settles this document's original exchange; it
                // does not clear the durable browser hold or renew authority.
                if(!close)try{current(value);}
                catch(VaultFailure unavailable){value.closed=true;return;}
                // Reply to the exact native-injected object/document which
                // proved its private source stamp. Window.postMessage would
                // target a DIFFERENT listener and cannot bind this source.
                try{value.proxy.postMessage(raw);}
                catch(RuntimeException unavailable){value.closed=true;}
            }
        }))throw failure();
    }
    private NativeOriginalBrowserPreparationWire.OwnedReply receive(Pending value,String command)throws VaultFailure {
        final String phase;synchronized(monitor){phase=value.phaseNonce;}
        for(;;){
            current(value);SourceMessage received;
            try{received=value.replies.poll(100,TimeUnit.MILLISECONDS);}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure();}
            if(received==null)continue;
            current(value);
            try{
                if(received.document!=value.document)throw failure();
                var reply=NativeOriginalBrowserPreparationWire.decode(received.raw,command,replyToken,value.nonce,phase,new JSONObject(value.binding));
                try{current(value);return reply;}
                catch(VaultFailure|RuntimeException|Error invalid){reply.close();throw invalid;}
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
        }
    }
    private NativeOriginalBrowserPreparationWire.OwnedDataReply receiveData(Pending value,String command,
        JSONObject observation,int expectedChunkIndex)throws VaultFailure {
        final String phase;synchronized(monitor){phase=value.phaseNonce;}
        for(;;){
            current(value);SourceMessage received;
            try{received=value.replies.poll(100,TimeUnit.MILLISECONDS);}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure();}
            if(received==null)continue;current(value);
            try{
                if(received.document!=value.document)throw failure();
                var reply=NativeOriginalBrowserPreparationWire.decodeData(received.raw,command,replyToken,value.nonce,phase,
                    new JSONObject(value.binding),observation,expectedChunkIndex);
                try{current(value);return reply;}
                catch(VaultFailure|RuntimeException|Error invalid){reply.close();throw invalid;}
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
        }
    }
    private NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply receiveHoldFence(Pending value,String observationSha)throws VaultFailure {
        final String phase;synchronized(monitor){phase=value.phaseNonce;}
        for(;;){
            current(value);SourceMessage received;
            try{received=value.replies.poll(100,TimeUnit.MILLISECONDS);}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure();}
            if(received==null)continue;current(value);
            try{
                if(received.document!=value.document)throw failure();
                var reply=NativeOriginalBrowserPreparationWire.decodeHoldFence(received.raw,replyToken,value.nonce,phase,
                    new JSONObject(value.binding),observationSha);
                try{current(value);return reply;}
                catch(VaultFailure|RuntimeException|Error invalid){reply.close();throw invalid;}
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
        }
    }
    /** Fresh same-document realm read, never a cached Source-ready flag or
     * JSON effect admission. Failed/ambiguous queries keep all originals. */
    private void requireOriginalRealm(Pending value)throws VaultFailure {
        send(value,NativeOriginalBrowserRealmSource.COMMAND);
        final String phase;synchronized(monitor){phase=value.phaseNonce;}
        try{for(;;){
            current(value);SourceMessage received;
            try{received=value.replies.poll(100,TimeUnit.MILLISECONDS);}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw failure();}
            if(received==null)continue;
            current(value);if(received.document!=value.document)throw failure();
            NativeOriginalBrowserRealmSource.verify(received.raw,replyToken,value.nonce,phase,new JSONObject(value.binding));
            current(value);return;
        }}catch(VaultFailure invalid){close();throw invalid;}
        catch(Exception invalid){close();throw failure();}
    }
    Exchange capture(JSONObject original,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return capture(original,control,false);
    }
    /** Read/check the SAME already-held original only. The injected owner must
     * refuse absent/foreign hold bytes before any marker or epoch write. This
     * is not a new baseline, a reopened old capture or any effect authority. */
    Exchange captureExistingHold(JSONObject original,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        return capture(original,control,true);
    }
    private Exchange capture(JSONObject original,NativePrivateCustodyFrameReadControl control,boolean existingHold)throws VaultFailure {
        if(control==null||Looper.myLooper()==Looper.getMainLooper())throw failure();
        final String binding;
        try{
            NativeRetainedAttempt.keys(original,BINDING);
            if(!original.getString("operation_id").matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
                ||!original.getString("frame_sha256").matches("[0-9a-f]{64}")
                ||!original.getString("original_generation_id").matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
                ||original.getString("native_mutation_stamp").isEmpty()||original.getString("native_mutation_stamp").length()>4096)throw failure();
            binding=original.toString();
        }catch(Exception invalid){throw failure();}
        final Pending value;
        synchronized(monitor){
            if(closed||!ready||documentProxy==null||documentUsed||pending!=null||recoveryReload!=null)throw failure();
            value=new Pending(document,binding,control,documentProxy);pending=value;documentUsed=true;
        }
        final String command=existingHold?"CAPTURE_EXISTING_HELD":"CAPTURE";
        try{send(value,command);return new Exchange(this,value,receive(value,command));}
        catch(VaultFailure|RuntimeException|Error invalid){finish(value);throw invalid;}
    }
    static final class Exchange implements AutoCloseable {
        private final NativeOriginalBrowserPreparation owner;
        private final Pending pending;
        private final String observation,census;
        private NativeOriginalBrowserPreparationWire.OwnedReply originalReply;
        private NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply initialHoldFence;
        private NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply postDecisionHoldFence;
        private NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply postFinalizationHoldFence;
        private String terminalHoldPhaseNonce;
        private String valueMetadata;
        private List<byte[]> valueChunks;
        private NativeOriginalBrowserValueFrame.OriginalRecords valueRecords;
        private List<byte[]> nativeArguments;
        private boolean rechecked,terminalHoldStarted,terminalHoldChecked,holdCheckStarted,closed;
        private boolean postDecisionHoldStarted,postDecisionHoldChecked;
        private boolean postFinalizationHoldStarted,postFinalizationHoldChecked;
        private Exchange(NativeOriginalBrowserPreparation owner,Pending pending,NativeOriginalBrowserPreparationWire.OwnedReply reply)throws VaultFailure {
            this.owner=owner;this.pending=pending;originalReply=reply;
            try{
                observation=reply.observation().toString();census=reply.census().toString();requireCurrent();
            }catch(VaultFailure|RuntimeException|Error invalid){reply.close();originalReply=null;throw invalid;}
        }
        void requireCurrent()throws VaultFailure {if(closed||originalReply==null)throw failure();owner.current(pending);}
        void requireOriginalBinding(JSONObject original)throws VaultFailure {
            requireCurrent();try{JSONObject before=new JSONObject(pending.binding);
                NativeRetainedAttempt.keys(original,BINDING);for(String key:BINDING)if(!before.get(key).equals(original.get(key)))throw failure();
            }catch(Exception invalid){throw failure();}requireCurrent();
        }
        List<byte[]> copyArguments()throws VaultFailure {
            requireCurrent();List<byte[]> copy=originalReply.copyArguments();try{
                requireCurrent();return copy;
            }catch(VaultFailure|RuntimeException|Error invalid){for(byte[] bytes:copy)Arrays.fill(bytes,(byte)0);throw invalid;}
        }
        /** Correlate the private argument census with the actual binary row
         * parse in this same collected document. These immutable DATA links
         * are not native decoding of a row's argument payload, browser source
         * authentication, current server acceptance, or any effect authority. */
        List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> originalArgumentRecords()throws VaultFailure {
            requireCurrent();
            if(valueMetadata==null||valueChunks==null||valueRecords==null)throw failure();
            try{
                var metadata=new JSONObject(valueMetadata);
                if(!valueRecords.observationSha256.equals(metadata.get("observation_sha256"))
                    ||!valueRecords.frameSha256.equals(metadata.get("frame_sha256"))
                    ||valueRecords.recordCount!=metadata.getInt("record_count"))throw failure();
                var originals=valueRecords.originalRecords();var candidates=originalReply.originalArgumentRecords();
                for(int i=0;i<candidates.size();i++){
                    var candidate=candidates.get(i);
                    if(candidate.candidateOrdinal!=i||candidate.captureRecordOrdinal<0
                        ||candidate.captureRecordOrdinal>=originals.size())throw failure();
                    var row=originals.get(candidate.captureRecordOrdinal);
                    if(row.ordinal!=candidate.captureRecordOrdinal||!row.store.equals(candidate.store)
                        ||!java.util.Objects.equals(row.database,candidate.database)
                        ||!java.util.Objects.equals(row.version,candidate.version)
                        ||!java.util.Objects.equals(row.objectStore,candidate.objectStore)
                        ||!row.keySha256.equals(candidate.keySha256)||!row.bodySha256.equals(candidate.bodySha256))throw failure();
                }
                requireCurrent();return candidates;
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
        }
        /** Copy only candidates whose bytes match the actual decoded original
         * binary row payload. This is DATA correlation, never browser source
         * authentication, SQL acceptance, an ACK or an effect permission.
         * Every nonmatching row remains in the complete original frame. */
        List<byte[]> copyArgumentsMatchingOriginalPayload()throws VaultFailure {
            requireCurrent();List<byte[]> copies=null,matched=new ArrayList<>();boolean transferred=false;
            try{
                // Reuse the same collected-document/candidate-to-binary-row
                // identity checks; this does not require all candidates match.
                var candidates=originalArgumentRecords();var collected=valueRecords;
                var matches=collected.argumentPayloadMatches();
                copies=originalReply.copyArguments();requireCurrent();
                if(matches==null||matches.size()!=candidates.size()||copies.size()!=candidates.size())throw failure();
                for(int i=0;i<candidates.size();i++){
                    requireCurrent();var candidate=candidates.get(i);var match=matches.get(i);byte[] bytes=copies.get(i);
                    if(match==null||candidate.candidateOrdinal!=i||match.candidateOrdinal!=i
                        ||match.captureRecordOrdinal!=candidate.captureRecordOrdinal
                        ||!candidate.argumentSha256.equals(match.argumentSha256)||bytes==null
                        ||!candidate.argumentSha256.equals(hash(bytes)))throw failure();
                    if(match.matchesOriginalPayload)matched.add(bytes);else Arrays.fill(bytes,(byte)0);
                }
                if(collected!=valueRecords||candidates!=originalArgumentRecords())throw failure();
                requireCurrent();transferred=true;return matched;
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
            finally{if(!transferred&&copies!=null)for(byte[] bytes:copies)if(bytes!=null)Arrays.fill(bytes,(byte)0);}
        }
        /** Whole-row native DATA matching only. Neither the browser candidate
         * subset nor a match count supplies Source/SQL/ACK authority. */
        List<byte[]> copyNativeArgumentsMatchingOriginalPayload()throws VaultFailure {
            requireCurrent();List<byte[]> copies=new ArrayList<>();boolean transferred=false;
            try{
                NativeOriginalBrowserValueFrame.OriginalRecords collected;List<byte[]> originals;
                synchronized(this){
                    requireCurrent();collected=valueRecords;originals=nativeArguments;
                    if(valueMetadata==null||valueChunks==null||collected==null||originals==null)throw failure();
                }
                var metadata=new JSONObject(valueMetadata);var rows=collected.originalRecords();var matches=collected.nativeArgumentPayloadMatches();
                if(!collected.observationSha256.equals(metadata.get("observation_sha256"))
                    ||!collected.frameSha256.equals(metadata.get("frame_sha256"))
                    ||collected.recordCount!=metadata.getInt("record_count")||rows.size()!=collected.recordCount
                    ||!collected.sessionStorageState.equals(metadata.get("session_storage_state"))
                    ||matches==null||matches.size()!=rows.size())throw failure();
                boolean[] seen=new boolean[originals.size()];
                for(int i=0;i<rows.size();i++){
                    requireCurrent();var row=rows.get(i);var match=matches.get(i);
                    if(row==null||row.ordinal!=i||match==null||match.captureRecordOrdinal!=i)throw failure();
                    if(!match.matchesOriginalPayload){
                        if(match.nativeArgumentOrdinal!=-1||!"".equals(match.argumentSha256))throw failure();
                        continue;
                    }
                    int index=match.nativeArgumentOrdinal;
                    if(index<0||index>=originals.size()||seen[index])throw failure();seen[index]=true;
                    byte[] original=originals.get(index);
                    if(original==null||!match.argumentSha256.equals(hash(original)))throw failure();
                    byte[] copy=original.clone();boolean owned=false;
                    try{
                        if(!match.argumentSha256.equals(hash(copy))||!Arrays.equals(copy,original))throw failure();
                        copies.add(copy);owned=true;
                    }finally{if(!owned)Arrays.fill(copy,(byte)0);}
                }
                synchronized(this){
                    requireCurrent();if(collected!=valueRecords||originals!=nativeArguments||valueMetadata==null||valueChunks==null)throw failure();
                    transferred=true;return copies;
                }
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
            finally{if(!transferred)for(byte[] bytes:copies)Arrays.fill(bytes,(byte)0);}
        }
        /** Read every fixed original DATA chunk through this same private
         * document and native control. These volatile bytes are NOT custody,
         * an inventory ACK, current server evidence or finalizer authority.
         * Native custody must retain them before this exchange can be closed.
         */
        void collectOriginalValues()throws VaultFailure {collectOriginalValues(null,false);}
        /** Complete native-original DATA loans from the owning native reader,
         * not a caller-selected browser candidate subset or capability. An
         * explicitly supplied empty list is distinct from the no-list path. */
        void collectOriginalValues(List<byte[]> completeOriginalNativeArguments)throws VaultFailure {
            if(completeOriginalNativeArguments==null)throw failure();
            collectOriginalValues(completeOriginalNativeArguments,true);
        }
        private void collectOriginalValues(List<byte[]> completeNative,boolean suppliedNative)throws VaultFailure {
            requireCurrent();if(valueMetadata!=null||valueChunks!=null||rechecked)throw failure();
            List<byte[]> chunks=new ArrayList<>(),nativeCopies=null,nativeOriginals=null;boolean transferred=false;
            try{
                if(suppliedNative){
                    nativeCopies=new ArrayList<>();nativeOriginals=new ArrayList<>();
                    int count=completeNative.size();long total=0;
                    if(count<0||count>4096)throw failure();
                    for(int i=0;i<count;i++){
                        byte[] original=completeNative.get(i);
                        if(original==null||original.length<1||original.length>4*1024*1024
                            ||(total+=original.length)>8*1024*1024)throw failure();
                        byte[] copy=original.clone();boolean owned=false;
                        try{nativeCopies.add(copy);owned=true;nativeOriginals.add(original);}
                        finally{if(!owned)Arrays.fill(copy,(byte)0);}
                    }
                    requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                }
                JSONObject captured=originalReply.observation(),metadata;
                owner.send(pending,"DATA_FRAME");
                try(var frame=owner.receiveData(pending,"DATA_FRAME",captured,-1)){metadata=frame.metadata();}
                if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                int count=metadata.getInt("chunk_count"),size=metadata.getInt("byte_count"),total=0;
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                for(int i=0;i<count;i++){
                    requireCurrent();if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                    owner.send(pending,"DATA_CHUNK");
                    try(var part=owner.receiveData(pending,"DATA_CHUNK",captured,i)){
                        if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                        if(!ProviderWireJson.same(metadata,part.metadata()))throw failure();
                        byte[] bytes=part.copyChunk();boolean retained=false;
                        try{chunks.add(bytes);retained=true;total+=bytes.length;digest.update(bytes);requireCurrent();}
                        finally{if(!retained)Arrays.fill(bytes,(byte)0);}
                    }
                }
                if(total!=size||!hex(digest.digest()).equals(metadata.getString("frame_sha256"))||chunks.isEmpty())throw failure();
                ByteBuffer header=ByteBuffer.wrap(chunks.get(0));byte[] magic=new byte[8],observed=new byte[32];
                try{
                    header.get(magic);header.get(observed);
                    if(!Arrays.equals(magic,"MZBRV001".getBytes(StandardCharsets.US_ASCII))
                        ||!hex(observed).equals(captured.getString("observation_sha256"))
                        ||header.getInt()!=captured.getInt("local_record_count")
                        ||header.getInt()!=(captured.isNull("session_record_count")?-1:captured.getInt("session_record_count"))
                        ||header.getInt()!=captured.getInt("database_count")||header.getInt()!=captured.getInt("record_count"))throw failure();
                }finally{Arrays.fill(magic,(byte)0);Arrays.fill(observed,(byte)0);}
                var candidates=originalReply.originalArgumentRecords();
                List<byte[]> arguments=originalReply.copyArguments();
                NativeOriginalBrowserValueFrame.OriginalRecords records;
                try{
                    requireCurrent();
                    if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                    records=suppliedNative
                        ?NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,captured,chunks,candidates,arguments,nativeCopies)
                        :NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,captured,chunks,candidates,arguments);
                    if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                    requireCurrent();
                }finally{for(byte[] bytes:arguments)Arrays.fill(bytes,(byte)0);}
                requireCurrent();String encodedMetadata=metadata.toString();
                synchronized(this){
                    requireCurrent();if(suppliedNative)requireNativeArgumentLoans(completeNative,nativeOriginals,nativeCopies);
                    valueMetadata=encodedMetadata;valueChunks=chunks;valueRecords=records;
                    nativeArguments=suppliedNative?nativeCopies:null;transferred=true;
                }
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
            finally{if(!transferred){
                for(byte[] bytes:chunks)Arrays.fill(bytes,(byte)0);
                if(nativeCopies!=null)for(byte[] bytes:nativeCopies)Arrays.fill(bytes,(byte)0);
            }}
        }
        private void requireNativeArgumentLoans(List<byte[]> complete,List<byte[]> originals,List<byte[]> copies)throws VaultFailure {
            requireCurrent();
            if(complete==null||originals==null||copies==null||complete.size()!=originals.size()||copies.size()!=originals.size())throw failure();
            for(int i=0;i<originals.size();i++)
                if(complete.get(i)!=originals.get(i)||!Arrays.equals(originals.get(i),copies.get(i)))throw failure();
            requireCurrent();
        }
        void recheck()throws VaultFailure {
            requireCurrent();if(rechecked)throw failure();owner.send(pending,"RECHECK");
            try(var next=owner.receive(pending,"RECHECK")){originalReply.requireSameMetadata(next);requireCurrent();rechecked=true;}
        }
        /** Two finite Source observations of this same private capture, not a
         * public receipt, all-writer proof or ACK capability. The first read
         * precedes the owning current-manager IO; the terminal read must keep
         * the original tuple/hold/epoch and never renew the capture lifetime.
         * A failed/unknown phase cannot be retried on this Exchange. */
        void observeOriginalHoldFence()throws VaultFailure {
            requireCurrent();
            if(holdCheckStarted||rechecked||valueMetadata==null||valueChunks==null||valueRecords==null)throw failure();
            holdCheckStarted=true;
            try{
                String observed=new JSONObject(observation).getString("observation_sha256");
                owner.send(pending,"HOLD_FENCE");var reply=owner.receiveHoldFence(pending,observed);
                try{requireHoldMatchesOriginalFrame(reply.json());requireCurrent();initialHoldFence=reply;}
                catch(VaultFailure|RuntimeException|Error invalid){reply.close();throw invalid;}
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
        }
        void requireTerminalOriginalHoldFence()throws VaultFailure {
            requireCurrent();
            if(!holdCheckStarted||initialHoldFence==null||terminalHoldStarted||!rechecked)throw failure();
            // Mark before IO: an ambiguous terminal reply is not permission
            // to issue another phase or establish a newer epoch as baseline.
            terminalHoldStarted=true;
            try{
                String observed=new JSONObject(observation).getString("observation_sha256");
                owner.send(pending,"HOLD_FENCE");
                try(var terminal=owner.receiveHoldFence(pending,observed)){
                    JSONObject observedHold=terminal.json();
                    requireSameOriginalHoldFence(initialHoldFence.json(),observedHold);
                    requireHoldMatchesOriginalFrame(observedHold);requireCurrent();
                    owner.requireOriginalRealm(pending);requireCurrent();
                    terminalHoldPhaseNonce=observedHold.getString("phase_nonce");terminalHoldChecked=true;
                }
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
        }
        private void requireHoldMatchesOriginalFrame(JSONObject observed)throws VaultFailure {
            requireCurrent();
            if(valueRecords==null||valueMetadata==null||valueChunks==null)throw failure();
            try{
                // The encrypted binary original already retains these two
                // localStorage rows. Do not create a second durable baseline
                // or infer the original epoch from today's same-value page.
                JSONObject binding=new JSONObject(pending.binding),metadata=new JSONObject(valueMetadata);
                requireSameOriginalFrameHold(valueRecords,binding,observed,metadata);
                requireCurrent();
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
        }
        private static void requireSameOriginalFrameHold(NativeOriginalBrowserValueFrame.OriginalRecords records,
            JSONObject binding,JSONObject observed,JSONObject metadata)throws VaultFailure {
            try{
                if(records==null)throw failure();var original=records.originalHeldBrowserMetadata();
                if(original==null||!original.operationId.equals(binding.getString("operation_id"))
                    ||!original.holdMarkerSha256.equals(observed.get("hold_marker_sha256"))
                    ||!original.mutationEpoch.equals(observed.get("mutation_epoch"))
                    ||!records.frameSha256.equals(metadata.get("frame_sha256"))
                    ||!records.observationSha256.equals(metadata.get("observation_sha256"))
                    ||!records.observationSha256.equals(observed.get("observation_sha256"))
                    ||records.recordCount!=metadata.getInt("record_count"))throw failure();
                for(String key:BINDING)if(!binding.get(key).equals(observed.get(key)))throw failure();
            }catch(Exception invalid){throw failure();}
        }
        /** Owning private prerequisite only. Cold frame DATA or a caller's
         * successful comparison cannot supply the two Source phases. This
         * checks the unchanged capture budget; it is not a new current read,
         * an all-writer verdict or a transferable permission. */
        void requireCheckedOriginalHoldFence()throws VaultFailure {
            requireCurrent();
            if(!holdCheckStarted||!terminalHoldStarted||!terminalHoldChecked||!rechecked||initialHoldFence==null)throw failure();
            requireHoldMatchesOriginalFrame(initialHoldFence.json());requireCurrent();
        }
        /** ONE post-decision Source phase on this same original capture.
         * Consume the attempt even on prerequisite/transport refusal: an
         * ambiguous result cannot acquire a newer baseline or a retry. No
         * control/document/capture start is replaced or renewed here. */
        void requirePostDecisionOriginalHoldFence()throws VaultFailure {
            synchronized(this){
                if(postDecisionHoldStarted)throw failure();
                postDecisionHoldStarted=true;
            }
            NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply reply=null;
            boolean transferred=false;
            try{
                requireCheckedOriginalHoldFence();
                String observed=new JSONObject(observation).getString("observation_sha256");
                owner.send(pending,"HOLD_FENCE");
                reply=owner.receiveHoldFence(pending,observed);
                JSONObject observedHold=reply.json();
                requireSamePostDecisionOriginalHoldFence(initialHoldFence.json(),terminalHoldPhaseNonce,observedHold);
                requireHoldMatchesOriginalFrame(observedHold);
                owner.requireOriginalRealm(pending);requireCurrent();
                requireCheckedOriginalHoldFence();requireCurrent();
                synchronized(this){
                    requireCurrent();
                    postDecisionHoldFence=reply;postDecisionHoldChecked=true;transferred=true;
                }
            }catch(VaultFailure invalid){throw invalid;}
            catch(Exception invalid){throw failure();}
            finally{if(!transferred&&reply!=null)reply.close();}
        }
        /** No Source I/O. Only the successfully completed private post phase
         * plus the unchanged original frame/control/document lifetime qualify.
         * This is not current-manager, all-writer or effect authority. */
        synchronized void requireCheckedPostDecisionOriginalHoldFence()throws VaultFailure {
            requireCheckedOriginalHoldFence();
            if(!postDecisionHoldStarted||!postDecisionHoldChecked||postDecisionHoldFence==null)throw failure();
            JSONObject observed=postDecisionHoldFence.json();
            requireSamePostDecisionOriginalHoldFence(initialHoldFence.json(),terminalHoldPhaseNonce,observed);
            requireHoldMatchesOriginalFrame(observed);requireCurrent();
        }
        /** A separate one-use Source read AFTER the local snapshot attempt.
         * It reuses neither the decision phase nor a cached ready projection.
         * Same capture/document/control/time budget; no new baseline/retry. */
        void requirePostFinalizationOriginalHoldFence()throws VaultFailure {
            synchronized(this){
                if(postFinalizationHoldStarted)throw failure();
                postFinalizationHoldStarted=true;
            }
            NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply reply=null;boolean transferred=false;
            try{
                requireCheckedPostDecisionOriginalHoldFence();
                String observed=new JSONObject(observation).getString("observation_sha256");
                owner.send(pending,"HOLD_FENCE");reply=owner.receiveHoldFence(pending,observed);
                requireDistinctFinalizationHold(initialHoldFence.json(),terminalHoldPhaseNonce,
                    postDecisionHoldFence.json(),reply.json());
                owner.requireOriginalRealm(pending);requireCurrent();
                requireHoldMatchesOriginalFrame(reply.json());requireCheckedPostDecisionOriginalHoldFence();requireCurrent();
                synchronized(this){
                    requireCurrent();postFinalizationHoldFence=reply;postFinalizationHoldChecked=true;transferred=true;
                }
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
            finally{if(!transferred&&reply!=null)reply.close();}
        }
        synchronized void requireCheckedPostFinalizationOriginalHoldFence()throws VaultFailure {
            requireCheckedPostDecisionOriginalHoldFence();
            if(!postFinalizationHoldStarted||!postFinalizationHoldChecked||postFinalizationHoldFence==null)throw failure();
            requireDistinctFinalizationHold(initialHoldFence.json(),terminalHoldPhaseNonce,
                postDecisionHoldFence.json(),postFinalizationHoldFence.json());
            requireHoldMatchesOriginalFrame(postFinalizationHoldFence.json());requireCurrent();
        }
        private static void requireDistinctFinalizationHold(JSONObject original,String terminalPhase,
            JSONObject decision,JSONObject finalized)throws VaultFailure {
            requireSamePostDecisionOriginalHoldFence(original,terminalPhase,decision);
            requireSamePostDecisionOriginalHoldFence(original,terminalPhase,finalized);
            try{
                if(decision.getString("phase_nonce").equals(finalized.getString("phase_nonce")))throw failure();
            }catch(Exception invalid){throw failure();}
        }
        private static void requireSamePostDecisionOriginalHoldFence(JSONObject original,String terminalPhase,
            JSONObject postDecision)throws VaultFailure {
            requireSameOriginalHoldFence(original,postDecision);
            try{
                if(terminalPhase==null||!terminalPhase.matches("[0-9a-f]{64}")
                    ||terminalPhase.equals(original.getString("phase_nonce"))
                    ||terminalPhase.equals(postDecision.getString("phase_nonce")))throw failure();
            }catch(Exception invalid){throw failure();}
        }
        private static void requireSameOriginalHoldFence(JSONObject original,JSONObject terminal)throws VaultFailure {
            try{
                // Both owned values have already passed the closed decoder;
                // only the newly issued phase nonce is expected to differ.
                var names=original.keys();
                while(names.hasNext()){
                    String key=names.next();
                    if(!"phase_nonce".equals(key)&&!original.get(key).equals(terminal.get(key)))throw failure();
                }
                if(original.getString("phase_nonce").equals(terminal.getString("phase_nonce")))throw failure();
            }catch(Exception invalid){throw failure();}
        }
        /** Native-only data readiness for the fixed second manager READ. It
         * exposes no bytes and cannot substitute for the later Source recheck
         * required before local preservation. */
        void requireCollectedOriginalValues()throws VaultFailure {
            requireCurrent();if(valueMetadata==null||valueChunks==null||valueRecords==null||rechecked)throw failure();
        }
        JSONObject originalValueMetadata()throws VaultFailure {
            requireCurrent();if(!rechecked||valueMetadata==null||valueChunks==null)throw failure();
            try{return new JSONObject(valueMetadata);}catch(Exception invalid){throw failure();}
        }
        /** Binary-validated original identities, still bound to this SAME
         * injected document/control. This type has no browser semantic,
         * durable-fence, acceptance or effect authority of its own. */
        NativeOriginalBrowserValueFrame.OriginalRecords originalRecords()throws VaultFailure {
            requireCurrent();if(!rechecked||valueRecords==null||valueChunks==null)throw failure();
            try{
                var metadata=new JSONObject(valueMetadata);
                if(!valueRecords.observationSha256.equals(metadata.get("observation_sha256"))
                    ||!valueRecords.frameSha256.equals(metadata.get("frame_sha256"))
                    ||valueRecords.recordCount!=metadata.getInt("record_count")
                    ||valueRecords.originalRecords().size()!=valueRecords.recordCount
                    ||!valueRecords.sessionStorageState.equals(metadata.get("session_storage_state")))throw failure();
                requireCurrent();return valueRecords;
            }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw failure();}
        }
        void writeOriginalValueChunkTo(VaultEngine.NativeBrowserValueJournalTarget target,int index)throws VaultFailure {
            requireCurrent();if(!rechecked||valueChunks==null||target==null||index<0||index>=valueChunks.size())throw failure();
            target.retainOriginalBytes(valueChunks.get(index));requireCurrent();
        }
        JSONObject projection()throws VaultFailure {
            requireCurrent();if(!rechecked)throw failure();try{return new JSONObject()
                .put("schema","custodial.native-original-browser-source-observation.v1")
                .put("state","SAME_DOCUMENT_CAPTURE_RECHECKED_NOT_ACK")
                .put("observation",new JSONObject(observation)).put("census",new JSONObject(census))
                .put("original_value_frame",valueMetadata==null?JSONObject.NULL:new JSONObject(valueMetadata))
                .put("all_declared_original_value_bytes_received_volatile_only",valueChunks!=null)
                .put("original_value_bytes_durably_retained",false)
                .put("private_document_start_source_bound",true).put("browser_source_authenticated",false)
                .put("complete_namespace_inventory",false).put("all_writer_durable_freeze_or_ABA_guard",false)
                .put("inventory_acknowledged",false).put("work_accepted",false).put("finalizer_allowed",false)
                .put("key_removal",false).put("phone_released",false);}
            catch(Exception invalid){throw failure();}
        }
        @Override public void close(){
            if(closed)return;closed=true;
            if(originalReply!=null){originalReply.close();originalReply=null;}
            if(initialHoldFence!=null){initialHoldFence.close();initialHoldFence=null;}
            synchronized(this){
                if(postDecisionHoldFence!=null){postDecisionHoldFence.close();postDecisionHoldFence=null;}
                if(postFinalizationHoldFence!=null){postFinalizationHoldFence.close();postFinalizationHoldFence=null;}
                postFinalizationHoldChecked=false;
                postDecisionHoldChecked=false;terminalHoldPhaseNonce=null;
            }
            if(valueChunks!=null){for(byte[] bytes:valueChunks)Arrays.fill(bytes,(byte)0);valueChunks=null;}valueMetadata=null;valueRecords=null;
            synchronized(this){
                if(nativeArguments!=null){for(byte[] bytes:nativeArguments)Arrays.fill(bytes,(byte)0);nativeArguments=null;}
            }
            owner.finish(pending);
        }
    }
    private void finish(Pending value){
        try{send(value,"CLOSE");}catch(VaultFailure ignored){/* Source expiry/document loss already retains its hold. */}
        synchronized(monitor){value.closed=true;value.replies.clear();if(pending==value)pending=null;}
    }
    @Override public void close(){
        final Runnable remove;
        synchronized(monitor){
            if(closed)return;
            closed=true;ready=false;documentProxy=null;
            if(pending!=null){pending.closed=true;pending.replies.clear();pending=null;}
            // Publish the sole cleanup task before releasing the logical
            // retirement lock. Owner destruction can claim it even when a
            // concurrent generic close has not posted it yet.
            physicalCleanup=this::runPhysicalCleanup;
            remove=physicalCleanup;
        }
        // One fixed, data-free withdrawal breadcrumb per Source. In
        // particular never log tokens, originals, principals or request
        // bodies. This preserves the actual Java withdrawal site when a
        // platform-native crash prevents instrumentation failure reporting.
        android.util.Log.w("CustodialVault","original_browser_source_withdrawn",
            new Throwable("Original browser Source withdrawal site"));
        // Logical withdrawal above is synchronous. Physical unregistration
        // must not destroy the injected native object on its own message
        // callback stack (including realm refusal during navigation).
        // If the destroyed view refuses the post, closed remains sticky;
        // no callback can create authority while its owner is torn down.
        synchronized(monitor){
            // A concurrent owner death can claim cleanup before this generic
            // close reaches its post. Never touch the view after that claim.
            if(physicalCleanupClaimed){diagnosticRetirement("POST_SKIPPED_OWNER_CLAIM");return;}
            if(ownerCleanup!=null){
                // Production registrations are owned by the exact WebView.
                // Keep this sticky-closed listener/script until actual native
                // view destruction; unregistering mid-navigation is unsafe on
                // the observed provider. This is not disposal completion.
                diagnosticRetirement("OWNER_BOUND_REGISTRATIONS_RETAINED");return;
            }
            diagnosticRetirement("POST_BEFORE");
            boolean posted=view.post(remove);
            diagnosticPhysicalCleanupPostRefused=!posted;
            diagnosticRetirement(posted?"POST_ACCEPTED":"POST_REFUSED");
        }
    }
    private void runPhysicalCleanup(){
        synchronized(monitor){
            // A captured/late generic task cannot unregister an owner-bound
            // source, including before the native owner retirement barrier.
            if(physicalCleanupClaimed||ownerCleanup!=null)return;
            physicalCleanupClaimed=true;
        }
            diagnosticPhysicalCleanupStarted=true;diagnosticRetirement("RUN_BEGIN");
            try{try{if(script!=null){
                diagnosticRetirement("SCRIPT_REMOVE_BEFORE");script.remove();diagnosticRetirement("SCRIPT_REMOVE_RETURN");
            }}catch(RuntimeException ignored){diagnosticRetirement("SCRIPT_REMOVE_THROW");}finally{
                diagnosticRetirement("MESSAGE_REMOVE_BEFORE");
                try{WebViewCompat.removeWebMessageListener(view,OBJECT);diagnosticRetirement("MESSAGE_REMOVE_RETURN");}
                catch(RuntimeException ignored){diagnosticRetirement("MESSAGE_REMOVE_THROW");}
            }}finally{diagnosticPhysicalCleanupFinished=true;diagnosticRetirement("RUN_END");
                synchronized(monitor){physicalCleanup=null;}
                if(ownerCleanup!=null)ownerCleanup.finished(this);
            }

    }
    void finishPhysicalCleanupForOwnerDestruction(CustodialNativeRuntime.OriginalBrowserCleanup cleanup){
        if(cleanup==null||cleanup!=ownerCleanup||!cleanup.permitsOwnerDestruction(this,nativeBridge,view))return;
        close(); // idempotent logical withdrawal, no provider unregister.
        final WebViewListener ownedLifecycle;
        synchronized(monitor){
            if(physicalCleanupClaimed)return;
            physicalCleanupClaimed=true;physicalCleanup=null;
            // No owner-bound task was posted. The one claim invalidates any
            // captured task without invoking WebView/AndroidX on a dying view.
            script=null;ownedLifecycle=lifecycle;lifecycle=null;
        }
        diagnosticRetirement("OWNER_JAVA_RETIRE_BEFORE");
        try{
            // Capacitor's Java listener list only; no WebView/provider method.
            if(ownedLifecycle!=null)nativeBridge.removeWebViewListener(ownedLifecycle);
            diagnosticOwnerJavaRetired=true;diagnosticProviderDisposalDelegated=true;
            diagnosticRetirement("OWNER_JAVA_RETIRED_PROVIDER_DISPOSAL_DELEGATED");
            // This does NOT mean WebView.destroy has happened. The owning test
            // must independently observe the actual host destroy completion.
        }finally{cleanup.finished(this);}
    }
    /** Fixed scalar observation only. Never consulted by Source/currentness. */
    private void diagnosticRetirement(String stage){
        System.out.println("CUSTODIAL_ORIGINAL_RETIRE stage="+stage
            +" source_id="+Integer.toUnsignedString(System.identityHashCode(this))
            +" elapsed="+android.os.SystemClock.elapsedRealtime()
            +" callerUI="+(Looper.myLooper()==Looper.getMainLooper()));
    }
    private static boolean local(String value){return !CustodialNavigationPolicy.shouldBlock(value);}
    private static boolean origin(Uri value){return value!=null&&"https".equals(value.getScheme())&&"localhost".equals(value.getHost())
        &&value.getUserInfo()==null&&value.getQuery()==null&&value.getFragment()==null
        &&(value.getPort()==-1||value.getPort()==443)&&(value.getPath()==null||"".equals(value.getPath())||"/".equals(value.getPath()));}
    private static byte[] asset(Context context,String path,int max)throws Exception {
        try(var input=context.getAssets().open(path);var out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];try{int count;while((count=input.read(buffer))!=-1){if(out.size()+count>max)throw failure();out.write(buffer,0,count);}return out.toByteArray();}
            finally{Arrays.fill(buffer,(byte)0);}
        }
    }
    private static String utf8(byte[] bytes)throws Exception {return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}
    private static String hash(byte[] bytes)throws Exception {return hex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static String token(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);try{return hex(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static String hex(byte[] bytes){StringBuilder out=new StringBuilder(bytes.length*2);for(byte b:bytes){out.append(Character.forDigit((b&255)>>>4,16));out.append(Character.forDigit(b&15,16));}return out.toString();}
    private static VaultFailure failure(){return new VaultFailure("custodial_original_browser_preparation_unavailable");}
}
