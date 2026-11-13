package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;

public class CustodialWebViewClientTest {
    @Test public void externalTargetsNeverReachAnyPluginDecision() {
        for (boolean pluginDecision : new boolean[] {false, true}) {
            for (String url : new String[] {null, "", "https://example.invalid/", "tel:5550100",
                "mailto:synthetic@example.invalid", "intent://settings", "data:text/html,test",
                "blob:https://localhost/test", "file:///sdcard/test", "content://media/test",
                "https://localhost/manager-access.html", "https://localhost/schedule-weekly.html",
                "https://localhost/%69ndex.html", "http://localhost/index.html"}) {
                int[] calls = {0};
                assertTrue(CustodialWebViewClient.guardedDecision(url, () -> { calls[0]++; return pluginDecision; }));
                assertEquals("No plugin order/result can bypass " + url, 0, calls[0]);
            }
        }
    }

    @Test public void allowedLocalTrafficRetainsCapacitorDecision() {
        for (boolean pluginDecision : new boolean[] {false, true}) {
            int[] calls = {0};
            assertEquals(pluginDecision, CustodialWebViewClient.guardedDecision("https://localhost/index.html",
                () -> { calls[0]++; return pluginDecision; }));
            assertEquals(1, calls[0]);
        }
    }

    @Test public void bothRealWebViewOverloadsFailClosedBeforeNullBridge() {
        CustodialWebViewClient client = new CustodialWebViewClient(null);
        assertTrue(client.shouldOverrideUrlLoading(null, "https://example.invalid/"));
        assertTrue(client.shouldOverrideUrlLoading(null, (android.webkit.WebResourceRequest) null));
    }
}
