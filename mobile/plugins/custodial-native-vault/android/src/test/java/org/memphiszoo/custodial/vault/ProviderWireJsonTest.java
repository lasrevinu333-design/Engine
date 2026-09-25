package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class ProviderWireJsonTest {
    static JSONObject parse(String text) throws Exception { return ProviderWireJson.object(text.getBytes(StandardCharsets.UTF_8), 262144); }
    @Test public void exactStringsNestedValuesAndFractionalTimestampSurvive() throws Exception {
        JSONObject value = parse(" {\"timestamp\":\"2026-09-24T12:34:56.123456Z\",\"items\":[{\"ok\":true},null,false],\"unicode\":\"é\\uD83D\\uDE00\",\"integer\":42,\"decimal\":1.0,\"exponent\":1e0} \r\n");
        assertEquals("2026-09-24T12:34:56.123456Z", value.getString("timestamp"));
        assertEquals("é😀", value.getString("unicode")); assertTrue(value.get("integer") instanceof Long);
        assertTrue(value.get("decimal") instanceof Double); assertTrue(value.get("exponent") instanceof Double);
        assertEquals(3, value.getJSONArray("items").length());
    }
    @Test public void duplicatesIncludingEscapedAndNestedNamesAreRejected() throws Exception {
        for (String text : new String[]{"{\"ok\":false,\"ok\":true}", "{\"ok\":false,\"\\u006fk\":true}",
            "{\"data\":{\"operation\":\"a\",\"operation\":\"b\"}}", "{\"items\":[{\"id\":1,\"id\":2}]}"})
            ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> parse(text));
    }
    @Test public void permissiveAndroidJsonExtensionsAndTrailingContentAreRejected() throws Exception {
        for (String text : new String[]{"{'ok':true}", "{ok:true}", "{\"ok\":true,}", "{\"items\":[1,]}", "{\"ok\"=true}",
            "{\"ok\":NaN}", "{\"ok\":Infinity}", "{\"ok\":01}", "{\"ok\":+1}", "{\"ok\":.5}", "{\"ok\":1.}",
            "{\"ok\":1e999}", "{\"ok\":9223372036854775808}", "{\"ok\":true}{}", "{} trailing", "[]", "null", "", "\uFEFF{}",
            "{\"x\":\"\\q\"}", "{\"x\":\"\\uD800\"}", "{\"x\":\"\\uDC00\"}", "{\"x\":\"line\nfeed\"}"})
            ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> parse(text));
    }
    @Test public void malformedUtf8DepthValueCountAndByteLimitFailClosed() throws Exception {
        ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> ProviderWireJson.object(new byte[]{(byte) 0xc3, (byte) 0x28}, 100));
        ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> ProviderWireJson.object("{}".getBytes(StandardCharsets.UTF_8), 1));
        ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":" + "[".repeat(17) + "0" + "]".repeat(17) + "}"));
        ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":[" + "0,".repeat(10000) + "0]}"));
        ProviderRecordStoreTest.failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":\"" + "a".repeat(262144) + "\"}"));
    }
}
