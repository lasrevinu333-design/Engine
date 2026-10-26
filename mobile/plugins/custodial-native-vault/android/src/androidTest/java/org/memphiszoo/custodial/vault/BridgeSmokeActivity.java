package org.memphiszoo.custodial.vault;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicReference;

public final class BridgeSmokeActivity extends BridgeActivity {
    // Test-host lifetime only. This owner has no native admission/receipt role.
    private android.webkit.WebView teardownView;
    private volatile boolean activityDestroyStarted,viewRemovedBeforeDestroy,viewDestroyCompleted;
    private int diagnosticPageCallbackCount;
    // Test-only native callback DATA. Captured from the existing listener
    // before automatic shell handoff; never a Source/currentness grant.
    private String initialCommittedUrl,initialLoadedUrl;

    private void diagnosticPageCallback(String stage,android.webkit.WebView actual) {
        if(diagnosticPageCallbackCount>=32)return;
        diagnosticPageCallbackCount++;
        System.out.println("CUSTODIAL_TEST_HOST_PAGE_CALLBACK stage="+stage
            +" elapsed="+android.os.SystemClock.elapsedRealtime()+" sameView="+(actual==teardownView)
            +" destroyStarted="+activityDestroyStarted+" destroyCompleted="+viewDestroyCompleted);
    }
    private static volatile CustodialNativeVaultPlugin testPlugin;
    private static volatile AtomicReference<NativeOriginalBrowserPreparation> testSource;

    static void install(CustodialNativeVaultPlugin plugin) {
        install(plugin, null);
    }

    static void install(CustodialNativeVaultPlugin plugin,
        AtomicReference<NativeOriginalBrowserPreparation> source) {
        if(source!=null&&(plugin==null||source.get()!=null))
            throw new AssertionError("A new original Source fixture is required");
        testPlugin = plugin;
        testSource = source;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        CustodialNativeVaultPlugin plugin = testPlugin;
        if (plugin == null) throw new IllegalStateException("Managed-emulator plugin fixture is missing");
        bridgeBuilder.addPluginInstance(plugin);
        var source=testSource;
        if(source!=null)bridgeBuilder.addPluginInstance(new BeforeNavigationSource(source));
        super.onCreate(savedInstanceState);
        // Same post-Builder normal shipping startup seam: restore only the
        // already-attached initial Sources before the first UI navigation.
        var bridge=getBridge();
        bridge.setWebViewClient(new CustodialWebViewClient(bridge));
        teardownView=getBridge().getWebView();
        if(teardownView==null)throw new AssertionError("Actual test-host WebView missing");
        getBridge().addWebViewListener(new com.getcapacitor.WebViewListener(){
            @Override public void onPageStarted(android.webkit.WebView actual){
                if(actual==teardownView){initialCommittedUrl=null;initialLoadedUrl=null;}
                diagnosticPageCallback("PAGE_STARTED",actual);
            }
            @Override public void onPageCommitVisible(android.webkit.WebView actual,String url){
                if(actual==teardownView&&url!=null&&url.equals(actual.getUrl()))initialCommittedUrl=url;
                diagnosticPageCallback("PAGE_COMMIT_VISIBLE",actual);
            }
            @Override public void onPageLoaded(android.webkit.WebView actual){
                if(actual==teardownView)initialLoadedUrl=actual.getUrl();
                diagnosticPageCallback("PAGE_LOADED",actual);
            }
            @Override public boolean onRenderProcessGone(android.webkit.WebView actual,
                android.webkit.RenderProcessGoneDetail detail){
                boolean matched=actual==teardownView;
                boolean killed=detail!=null&&!detail.didCrash();
                boolean expected=matched&&activityDestroyStarted&&isFinishing()&&isDestroyed()
                    &&viewRemovedBeforeDestroy&&viewDestroyCompleted&&killed;
                System.out.println("CUSTODIAL_TEST_HOST_RENDERER_EXIT matched="+matched
                    +" destroyStarted="+activityDestroyStarted+" finishing="+isFinishing()
                    +" destroyed="+isDestroyed()+" removed="+viewRemovedBeforeDestroy
                    +" destroyCompleted="+viewDestroyCompleted+" detailPresent="+(detail!=null)
                    +" didCrash="+(detail==null?"UNKNOWN":String.valueOf(detail.didCrash()))
                    +" expectedTerminalTeardown="+expected);
                // Only acknowledge the already-cleaned exact killed renderer.
                // A live, foreign, crashed or incompletely destroyed view still
                // follows Android's failing unhandled-renderer path.
                if(expected){teardownView=null;return true;}
                return false;
            }
        });
        if(source!=null){
            try{source.get().completeInitialBridgeRegistration(getBridge());}
            catch(VaultFailure unavailable){throw new AssertionError("Original Source initial lifecycle registration unavailable",unavailable);}
            getBridge().addWebViewListener(new com.getcapacitor.WebViewListener(){
                @Override public void onPageStarted(android.webkit.WebView actual){
                    android.util.Log.i("CustodialOriginalRuntime","Native page started: "+actual.getUrl());
                    observeOriginalSourceLifecycle();
                }
                @Override public void onPageLoaded(android.webkit.WebView actual){
                    android.util.Log.i("CustodialOriginalRuntime","Native page loaded: "+actual.getUrl());
                    observeOriginalSourceLifecycle();
                }
            });
        }
    }

    /** Read on the actual UI owner only. App-shell progress100 is NOT a
     * completed startup: its React effect still performs the normal handoff.
     * Both native callback facts must belong to the current terminal Home URL.
     * No JS evaluation, sleep, routing override or readiness DTO is used. */
    boolean hasCompletedInitialLegacyHome(String expectedDevice) {
        if(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()
            ||expectedDevice==null||(!expectedDevice.isEmpty()&&!"KIOSK_08".equals(expectedDevice)))
            throw new AssertionError("Exact test-owned initial Home observation required");
        var bridge=getBridge();var actual=teardownView;
        if(actual==null||bridge==null||bridge.getWebView()!=actual||activityDestroyStarted||viewDestroyCompleted)return false;
        String url=actual.getUrl();
        boolean terminal="https://localhost/index.html".equals(url)
            ||"https://localhost/index.html?protected_recovery=1".equals(url)
            ||(!expectedDevice.isEmpty()&&("https://localhost/index.html?device="+expectedDevice).equals(url));
        return terminal&&url.equals(initialCommittedUrl)&&url.equals(initialLoadedUrl)&&actual.getProgress()==100;
    }

    /** Capacitor registers plugin instances before loadWebView. The injected
     * engine skips production load, so attach its actual Source at that same
     * native startup point, before an initial document can own reply proxies.
     * No methods are exported to JavaScript by this test-only plugin. */
    @CapacitorPlugin(name="CustodialOriginalBrowserStartupFixture")
    public static final class BeforeNavigationSource extends Plugin {
        private final AtomicReference<NativeOriginalBrowserPreparation> source;
        BeforeNavigationSource(AtomicReference<NativeOriginalBrowserPreparation> source){this.source=source;}
        @Override public void load(){
            var bridge=getBridge();var view=bridge.getWebView();
            if(view==null||view.getUrl()!=null||source.get()!=null)
                throw new AssertionError("Source must attach before the first native navigation");
            view.getSettings().setSupportMultipleWindows(false);
            view.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
            try{
                var attached=NativeOriginalBrowserPreparation.attach(getContext(),bridge);
                attached.requireAttachedView(view);
                if(!source.compareAndSet(null,attached)){attached.close();throw new AssertionError("Original Source was already attached");}
                android.util.Log.i("CustodialOriginalRuntime","Actual Source attached before initial automatic navigation");
            }catch(VaultFailure failure){throw new AssertionError("Original Source unavailable before navigation",failure);}
        }
    }

    /** Read-only lifecycle DATA; no tokens, proxy handles, capture, callbacks,
     * field writes or readiness substitution. Actual capture still decides. */
    static void observeOriginalSourceLifecycle(){
        try{
            var source=testSource==null?null:testSource.get();
            var value=new org.json.JSONObject().put("source_present",source!=null);
            if(source!=null)for(String name:new String[]{"closed","ready","documentUsed","pending","documentProxy","recoveryReload"}){
                var field=NativeOriginalBrowserPreparation.class.getDeclaredField(name);field.setAccessible(true);
                Object data=field.get(source);value.put(name,field.getType()==boolean.class?data:data!=null);
            }
            android.util.Log.i("CustodialOriginalRuntime","Read-only Source lifecycle before capture: "+value);
        }catch(Exception unavailable){android.util.Log.w("CustodialOriginalRuntime","Read-only Source lifecycle unavailable");}
    }

    @Override
    public void onDestroy() {
        activityDestroyStarted=true;
        System.out.println("CUSTODIAL_TEST_HOST_DESTROY_BEGIN finishing="+isFinishing()+" elapsed="+android.os.SystemClock.elapsedRealtime());
        try {super.onDestroy();}
        finally {
            testPlugin = null;
            testSource = null;
            System.out.println("CUSTODIAL_TEST_HOST_DESTROY_END destroyed="+isDestroyed()+" elapsed="+android.os.SystemClock.elapsedRealtime());
        }
    }

    @Override
    public void onDetachedFromWindow() {
        // WebView.destroy requires prior removal from its view hierarchy.
        // Capacitor's normal super path destroys this same actual WebView;
        // removeAllViews alone removes its children, not its parent linkage.
        var actual=teardownView;
        if(actual!=null){
            if(getBridge()==null||getBridge().getWebView()!=actual||viewDestroyCompleted)
                throw new AssertionError("Exact test-host WebView teardown differs");
            actual.stopLoading();
            var parent=actual.getParent();
            if(parent instanceof android.view.ViewGroup)((android.view.ViewGroup)parent).removeView(actual);
            if(actual.getParent()!=null)throw new AssertionError("Test-host WebView must be removed before destroy");
            viewRemovedBeforeDestroy=true;
        }
        System.out.println("CUSTODIAL_TEST_HOST_DETACH_BEFORE_DESTROY removed="+viewRemovedBeforeDestroy
            +" destroyStarted="+activityDestroyStarted+" elapsed="+android.os.SystemClock.elapsedRealtime());
        super.onDetachedFromWindow();
        // No WebView method may be called after this normal destroy returns.
        viewDestroyCompleted=true;
        System.out.println("CUSTODIAL_TEST_HOST_DETACH_DESTROY_COMPLETE removed="+viewRemovedBeforeDestroy+" elapsed="+android.os.SystemClock.elapsedRealtime());
    }
}
