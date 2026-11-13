package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Provider;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** Regression for the normal local-JVM platform/classpath only. No Android,
 * keystore, current principal, private capability, network or application
 * workflow is simulated or admitted by these checks. */
public final class HostJvmCompilePlatformTest {
    @Test public void currentJdkFileApisUseOwnedTemporaryFile() throws Exception {
        assertEquals(21, Runtime.version().feature());
        Path owned = Files.createTempFile("custodial-unit-platform-", ".txt");
        try {
            String original = "UNIT JVM platform\nsnow \u96ea\n";
            Files.writeString(owned, original, StandardCharsets.UTF_8);
            assertEquals(original, Files.readString(owned, StandardCharsets.UTF_8));
        } finally {
            Files.deleteIfExists(owned);
        }
    }

    @Test public void pinnedHostJsonApiPrecedesAndroidStub() throws Exception {
        JSONObject value = new JSONObject("{\"first\":1,\"second\":{\"value\":true}}");
        assertEquals(Set.of("first", "second"), value.keySet());
        assertTrue(value.similar(new JSONObject("{\"second\":{\"value\":true},\"first\":1}")));
        assertEquals("{\"unit\":\"value\"}", JSONObject.valueToString(Map.of("unit", "value")));
        assertTrue(JSONObject.class.getProtectionDomain().getCodeSource().getLocation()
            .toString().endsWith("/json-20250517.jar"));
    }

    @Test public void hostManagementAndProviderApisNeedNoProviderRegistration() {
        assertNotNull(java.lang.management.ManagementFactory.getRuntimeMXBean());
        Provider unregistered = new Provider("UNIT-host-platform", "1.0", "UNIT only, never registered") {};
        assertEquals("1.0", unregistered.getVersionStr());
        assertNull(java.security.Security.getProvider(unregistered.getName()));
    }
}
