package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;

/** NEW exact local placeholder admission only; not a WebView/phone test. */
public final class CustodialSupplyPlaceholderNavigationTest {
    @Test public void exactPackagedPlaceholderAndExistingHomeReturnRemainLocal() {
        for(String target:new String[]{"https://localhost/supply-coming-soon.html",
            "https://localhost:443/supply-coming-soon.html", "https://localhost/supply-coming-soon.html?device=OTHER#notice",
            "https://localhost/index.html"})assertFalse(target,CustodialNavigationPolicy.shouldBlock(target));
        // URL parameters are not device authority, a request, or an external grant.
    }
    @Test public void noSupplyWorkflowExternalHostSchemeWildcardOrPathEncodingIsAdmitted() {
        for(String target:new String[]{"https://external.invalid/supply-coming-soon.html","http://localhost/supply-coming-soon.html",
            "https://localhost:444/supply-coming-soon.html","https://localhost.evil.invalid/supply-coming-soon.html",
            "https://evil@localhost/supply-coming-soon.html","https://localhost/%73upply-coming-soon.html",
            "https://localhost/a/../supply-coming-soon.html","https://localhost//supply-coming-soon.html",
            "https://localhost/SUPPLY-coming-soon.html","https://localhost/supply-coming-soon.html/",
            "https://localhost/supply-request-module/index.html","https://localhost/supply-request.html",
            "https://localhost/supply-coming-soon.html;extra","https://localhost/supply-catalog.mjs",
            "file:///supply-coming-soon.html","intent://supply","mailto:test@example.invalid",
            "javascript:alert(1)","data:text/html,not-approved",null,"","./supply-coming-soon.html"})
            assertTrue(String.valueOf(target),CustodialNavigationPolicy.shouldBlock(target));
    }
}
