package org.memphiszoo.custodial.vault;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.function.BooleanSupplier;

/** Custodial-only navigation gate, before Capacitor's unordered plugin chain. */
public final class CustodialWebViewClient extends BridgeWebViewClient {
    public CustodialWebViewClient(Bridge bridge) { super(bridge); }

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
