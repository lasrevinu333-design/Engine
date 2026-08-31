package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Map;
import org.junit.Test;

public final class NativeVaultClientTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String OPERATION = "11111111-1111-4111-8111-111111111111";
    private static final String DEVICE = "KIOSK_02";

    @Test
    public void facadeReturnsSafeStableIdentityAndAuthorizedResponse() throws Exception {
        MemoryPersistence persistence = new MemoryPersistence();
        TestCipher cipher = new TestCipher();
        MutableClock clock = new MutableClock(NOW);
        FakeTransport transport = new FakeTransport(clock);
        VaultEngine engine = new VaultEngine(
            persistence,
            cipher,
            transport,
            new FakeLegacySource(),
            new TestSealGenerator(),
            clock
        );
        engine.enroll(OPERATION, DEVICE, "enrollment", "12345678".toCharArray());
        engine.completeLocalBinding(OPERATION);
        engine.confirmEnrollment(OPERATION);
        NativeVaultClient client = new NativeVaultClient(persistence, engine);

        NativeVaultClient.State first = client.state();
        NativeVaultClient.State second = client.state();
        NativeVaultClient.HttpResponse response = client.authorized(
            DEVICE,
            "/device-auth/status?device_id=KIOSK_02",
            "GET",
            Map.of(),
            new byte[0]
        );

        assertTrue(first.active);
        assertFalse(first.blocked);
        assertEquals(DEVICE, first.deviceId);
        assertEquals(first.installationId, second.installationId);
        assertTrue(first.installationId.matches("^[0-9a-f-]{36}$"));
        assertEquals("employee-1", first.employeeId);
        assertEquals("Employee One", first.employeeName);
        assertEquals(OPERATION, first.credentialId);
        assertEquals(200, response.status);
        assertEquals("{\"ok\":true}", response.bodyUtf8());
    }

    @Test
    public void inactiveStateNeverInventsIdentity() throws Exception {
        MemoryPersistence persistence = new MemoryPersistence();
        MutableClock clock = new MutableClock(NOW);
        VaultEngine engine = new VaultEngine(
            persistence,
            new TestCipher(),
            new FakeTransport(clock),
            new FakeLegacySource(),
            new TestSealGenerator(),
            clock
        );
        NativeVaultClient client = new NativeVaultClient(persistence, engine);

        NativeVaultClient.State state = client.state();

        assertFalse(state.active);
        assertEquals("EMPTY", state.phase);
        assertEquals("", state.deviceId);
        assertEquals("", state.installationId);
        assertEquals("", state.employeeId);
        assertEquals("", state.credentialId);
    }
}
