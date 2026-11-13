package org.memphiszoo.custodial.vault;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.function.BooleanSupplier;

/** Custodial-only navigation gate, before Capacitor's unordered plugin chain. */
public final class CustodialWebViewClient extends BridgeWebViewClient {
    private final WebView diagnosticOriginalView;
    private int diagnosticResourceErrors;

    public CustodialWebViewClient(Bridge bridge) {
        super(bridge);
        diagnosticOriginalView=bridge==null?null:bridge.getWebView();
        try{CustodialNativeRuntime.completeInitialOriginalBrowserRegistration(bridge);}
        catch(VaultFailure unavailable){android.util.Log.w("CustodialVault","original_browser_initial_registration_unavailable");}
    }

    // Bounded scalar diagnostics only. Never filter a resource callback or
    // change Capacitor's original super/listener/error-page ordering.
    @Override
    public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error) {
        diagnosticResourceFailure(view,request,error,null);
        super.onReceivedError(view,request,error);
    }
    @Override
    public void onReceivedHttpError(WebView view,WebResourceRequest request,android.webkit.WebResourceResponse response) {
        diagnosticResourceFailure(view,request,null,response);
        super.onReceivedHttpError(view,request,response);
    }
    private void diagnosticResourceFailure(WebView actual,WebResourceRequest request,
        android.webkit.WebResourceError error,android.webkit.WebResourceResponse response) {
        if(diagnosticResourceErrors>=8)return;
        diagnosticResourceErrors++;
        try{
            String frame=request==null?"UNKNOWN":String.valueOf(request.isForMainFrame());
            int errorCode=error==null?0:error.getErrorCode(),statusCode=response==null?0:response.getStatusCode();
            System.out.println("CUSTODIAL_NORMAL_RESOURCE_FAILURE sameView="+(actual==diagnosticOriginalView)
                +" mainFrame="+frame+" errorCode="+errorCode+" statusCode="+statusCode
                +" assetKind="+diagnosticAssetKind(request));
        }catch(RuntimeException unavailable){
            // No raw error text, description, URL, request/response body,
            // headers or credentials. Original super remains OUTSIDE this catch.
            System.out.println("CUSTODIAL_NORMAL_RESOURCE_FAILURE metadataUnavailable=true");
        }
    }
    private static String diagnosticAssetKind(WebResourceRequest request) {
        Uri uri=request==null?null:request.getUrl();
        if(uri==null||!"https".equals(uri.getScheme())||!"localhost".equals(uri.getHost())
            ||uri.getPort()!=-1||uri.getUserInfo()!=null)return "OTHER";
        String path=uri.getPath();
        if("/favicon.ico".equals(path))return "FAVICON";
        if("/manifest.json".equals(path)||"/manifest.webmanifest".equals(path))return "MANIFEST";
        if(path==null)return "OTHER";
        return switch(path){
            case "/app-shell.html" -> "APP_SHELL_HTML";
            case "/index.html" -> "INDEX_HTML";
            case "/employee-schedule.html" -> "EMPLOYEE_HTML";
            case "/bridge-smoke.html" -> "BRIDGE_SMOKE_HTML";
            case "/memphis-ui.js" -> "UI_JS";
            case "/memphis-ui.css" -> "UI_CSS";
            case "/memphis-auth.js" -> "AUTH_JS";
            case "/memphis-device-identity.js" -> "DEVICE_IDENTITY_JS";
            case "/memphis-scan-sync.js" -> "SCAN_SYNC_JS";
            case "/memphis-device-reminders.js" -> "DEVICE_REMINDERS_JS";
            case "/memphis-recurring-schedule-target.js" -> "RECURRING_TARGET_JS";
            case "/memphis-custodial-original-browser.js" -> "ORIGINAL_BROWSER_BOOTSTRAP";
            case "/memphis-custodial-recurring-application.js" -> "RECURRING_BOOTSTRAP";
            case "/memphis-custodial-bridge.js" -> "NORMAL_BRIDGE_JS";
            case "/memphis-build-identity.js" -> "BUILD_IDENTITY_JS";
            case "/memphis-native-layout.js" -> "NATIVE_LAYOUT_JS";
            case "/memphis-interaction-feedback.js" -> "INTERACTION_FEEDBACK_JS";
            default -> "OTHER";
        };
    }

    static boolean guardedDecision(String url, BooleanSupplier allowedLocalDelegate) {
        // Short-circuit: a plugin returning false cannot override this denial.
        return CustodialNavigationPolicy.shouldBlock(url) || allowedLocalDelegate.getAsBoolean();
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request == null ? null : request.getUrl();
        return guardedDecision(uri == null ? null : uri.toString(),
            () -> super.shouldOverrideUrlLoading(view, request));
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return guardedDecision(url, () -> super.shouldOverrideUrlLoading(view, url));
    }
}
