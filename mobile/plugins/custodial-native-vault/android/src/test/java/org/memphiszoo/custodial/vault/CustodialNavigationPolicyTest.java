package org.memphiszoo.custodial.vault;

import org.junit.AfterClass;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class CustodialNavigationPolicyTest {
    private static int checks;
    private static void check(String target, boolean blocked) {
        assertEquals("Navigation target: " + target, blocked, CustodialNavigationPolicy.shouldBlock(target));
        checks++;
    }

    @Test public void packagedCustodialRoutesStayInside() {
        for (String page : new String[] {"/", "/app-shell.html", "/index.html", "/scan.html",
            "/employee-hub.html", "/start_page1.html", "/messages.html", "/messages-chatscope.html",
            "/thread.html", "/employee-schedule.html", "/employee-events.html", "/events.html",
            "/employee-feedback.html", "/system-feedback.html"}) {
            check("https://localhost" + page, false);
            check("https://localhost" + page + "?hub=employee&assistant=memphis", false);
            check("https://localhost" + page + "#custodial", false);
        }
        check("HTTPS://LOCALHOST:443/index.html", false);
        check("https://localhost/scan.html?code=NOCX&native_nfc_handoff=synthetic", false);
        // Navigation allowance never grants an NFC proof or an API credential.
    }

    @Test public void externalAppsAndRemoteDocumentsCannotLaunch() {
        for (String target : new String[] {"https://example.invalid/recipe", "http://example.invalid/",
            "tel:5550100", "mailto:synthetic@example.invalid", "sms:5550100", "geo:0,0",
            "market://details?id=example", "intent://settings#Intent;scheme=android;end",
            "android-app://com.android.settings", "file:///sdcard/image.jpg", "content://media/external/images/1",
            "data:text/html,<script>alert(1)</script>", "blob:https://localhost/synthetic", "javascript:alert(1)",
            "about:blank", "https://memphis-zoo-mcp.onrender.com/moxie/",
            "https://lasrevinu333-design.github.io/Engine/index.html?code=NOCX",
            "https://docs.google.com/forms/d/e/synthetic/viewform", "memphiszoo-custodial://scan?code=NOCX"}) {
            check(target, true);
        }
        // Incoming physical NFC is a different Activity/reader path, unmodified.
    }

    @Test public void hostPathAndEncodingCannotBroadenTheAllowlist() {
        for (String target : new String[] {"http://localhost/index.html", "https://localhost:444/index.html",
            "https://localhost.example.invalid/index.html", "https://localhost./index.html",
            "https://localhost@evil.invalid/index.html", "https://evil@localhost/index.html",
            "https://127.0.0.1/index.html", "https://[::1]/index.html", "https://local%68ost/index.html",
            "https://localhost/%69ndex.html", "https://localhost/INDEX.html", "https://localhost/a/../index.html",
            "https://localhost//index.html", "https://localhost/index.html/", "https://localhost/index.html;extra",
            "https://localhost/moxie-mobile.html", "https://localhost/manager-access.html",
            "https://localhost/schedule-weekly.html", "https://localhost/config.json",
            "https://localhost/%2e%2e/index.html", "https://localhost/\\evil.invalid/index.html",
            "https://localhost/index.html%00", "https://localhost:443@evil.invalid/index.html"}) {
            check(target, true);
        }
        check("https://localhost/index.html?next=https%3A%2F%2Fexample.invalid", false);
        // Any subsequent remote navigation is separately denied; query is not a grant.
    }

    @Test public void absentMalformedAndRelativeTargetsFailClosed() {
        for (String target : new String[] {null, "", " ", "/index.html", "index.html", "//localhost/index.html",
            "https://", "https://localhost", "https://localhost/index.html\n", "https://localhost/%zz"}) {
            check(target, true);
        }
    }

    @AfterClass public static void evidence() {
        System.out.println("CUSTODIAL_NAVIGATION_POLICY_LOCAL_CHECKS=" + checks
            + "; NOT_WEBVIEW_LOCK_TASK_CAMERA_OR_PHONE_PROOF");
    }
}
