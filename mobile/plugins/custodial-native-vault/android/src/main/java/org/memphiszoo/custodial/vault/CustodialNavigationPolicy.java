package org.memphiszoo.custodial.vault;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** OC24-15: top-level WebView navigation is not permission to launch another app.
 * This policy does not intercept HTTP/API requests, image decoding or the
 * separately authenticated physical NFC intent/handoff path.
 */
public final class CustodialNavigationPolicy {
    private static final Set<String> PAGES = new HashSet<>(Arrays.asList(
        "/", "/app-shell.html", "/index.html", "/scan.html",
        "/employee-hub.html", "/start_page1.html",
        "/messages.html", "/messages-chatscope.html", "/thread.html",
        "/employee-schedule.html", "/employee-events.html", "/events.html",
        "/employee-feedback.html", "/system-feedback.html"
    ));

    private CustodialNavigationPolicy() {}

    /** True consumes/blocks navigation; false allows only packaged Custodial pages. */
    public static boolean shouldBlock(String value) {
        if (value == null || value.isEmpty()) return true;
        try {
            URI target = new URI(value);
            return !"https".equalsIgnoreCase(target.getScheme())
                || !"localhost".equalsIgnoreCase(target.getHost())
                || target.getRawUserInfo() != null
                || (target.getPort() != -1 && target.getPort() != 443)
                || !PAGES.contains(target.getRawPath());
        } catch (URISyntaxException | IllegalArgumentException invalid) {
            return true;
        }
    }
}
