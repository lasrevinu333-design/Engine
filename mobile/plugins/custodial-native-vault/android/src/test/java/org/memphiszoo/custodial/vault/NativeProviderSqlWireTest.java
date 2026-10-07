package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Exact backend SQL-produced fixture; no HTTP/FCM, clock qualification or effect. */
public final class NativeProviderSqlWireTest {
    @Test public void actualSqlReservationWireHasIdenticalNativeMeaningAndDigest() throws Exception {
        String path = System.getenv("NATIVE_LOCATION_WIRE_FIXTURE");
        org.junit.Assume.assumeNotNull("Run the backend isolated SQL fixture first", path);
        JSONObject fixture = new JSONObject(new String(Files.readAllBytes(Path.of(path)), StandardCharsets.UTF_8));
        JSONObject envelope = fixture.getJSONObject("envelope");
        NativeProviderPayload payload = NativeProviderPayload.fromInventory(envelope.getJSONObject("payload"));
        assertEquals(NativeProviderPayload.LOCATION_SCHEMA, payload.get("schema"));
        assertEquals(envelope.getString("wire"), NativeProviderPayload.canonical(payload.data(), false));
        assertEquals(payload.contentHash, NativeProviderPrincipal.hash(NativeProviderPayload.canonical(payload.data(), true)));
        JSONObject expected = fixture.getJSONObject("expected");
        for (String field : new String[]{"credential_id", "employee_id", "device_id", "assignment_epoch"})
            assertEquals(expected.getString(field), payload.get("receipt_" + field));
        assertEquals(expected.getString("generation_id"), payload.generationId);
        assertEquals(expected.getString("principal_digest"), payload.principalDigest);
        assertEquals(expected.getString("token_digest"), payload.tokenDigest);
        assertEquals(42, payload.data().size());
        TreeMap<String, String> crossed = new TreeMap<>(payload.data());
        crossed.put("projection_id", "99000000-0000-4000-8000-000000000001");
        NativeProviderPayloadTest.signed(crossed);
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> NativeProviderPayloadTest.accept(crossed));
        TreeMap<String, String> mutable = new TreeMap<>(payload.data()); mutable.put("body", "tampered SQL wire");
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> NativeProviderPayloadTest.accept(mutable));
    }
}
