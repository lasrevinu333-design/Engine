package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Small opt-in installer/readback qualification; no original/native owner,
 * approval, browser action, device credential or SQL operation is created. */
@RunWith(AndroidJUnit4.class)
public final class ReleaseArtInstallProfileAndroidRuntimeTest {
    private static final String APK="/data/app/~~synthetic/org.memphiszoo.custodial.vault.test-synthetic/base.apk";
    private static final String GOOD="[org.memphiszoo.custodial.vault.test]\n  path: "+APK
        +"\n    x86_64: [status=speed] [reason=install] [primary-abi]\n      [location is /data/app/synthetic/oat/x86_64/base.odex]\n";

    @Test(timeout=30_000)
    public void selectedReleaseInstallerReportsExactSpeedBeforeAnyOriginal() throws Exception {
        assertTrue("ART_PROFILE_REFUSED: packaged generated speed profile required",ReleaseArtInstallProfile.selected());
        // The actual strict fresh release guard performs the metadata read at
        // its terminal before returning to any original fixture constructor.
        ReleaseInstrumentationProfile.requireFreshIsolatedTarget();
    }

    @Test(timeout=5_000)
    public void exactPublicArtDumpGrammarAcceptsOnlySamePackageApkIsaAndInstallFilter() {
        ReleaseArtInstallProfile.requireDump(GOOD,APK);
        String[] bad={"",GOOD.replace(".vault.test]",".foreign.test]"),
            GOOD.replace(APK,APK.replace("base.apk","other.apk")),
            GOOD.replace("status=speed","status=verify"),GOOD.replace("status=speed","status=speed-profile"),
            GOOD.replace("reason=install","reason=cmdline"),GOOD.replace("x86_64:","arm64:"),
            GOOD.replace(" [primary-abi]",""),GOOD+GOOD,
            GOOD+"  path: "+APK+"\n",GOOD+"    x86_64: [status=speed] [reason=install] [primary-abi]\n",
            GOOD.replace("[org.memphiszoo.custodial.vault.test]\n",""),
            GOOD.replace("  path: "+APK+"\n",""),GOOD.replace("    x86_64: [status=speed] [reason=install] [primary-abi]\n",""),
            GOOD+"  known secondary dex files:\n",GOOD+"Error: synthetic missing package\n",
            "x".repeat(131_073)};
        for(String dump:bad)assertThrows(AssertionError.class,()->ReleaseArtInstallProfile.requireDump(dump,APK));
        assertThrows(AssertionError.class,()->ReleaseArtInstallProfile.requireDump(GOOD,APK+"\n"));
    }
}
