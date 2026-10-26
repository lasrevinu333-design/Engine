package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class ProviderWireJsonTest {
    static JSONObject parse(String text) throws Exception { return ProviderWireJson.object(text.getBytes(StandardCharsets.UTF_8), 262144); }
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && "--owned-string-spans".equals(args[0])) {
            ProviderWireJsonTest test = new ProviderWireJsonTest();
            test.largeRawAndEscapedSpansRetainExactDecodedStrings();
            test.spanBoundariesCannotConcealMalformedStringsOrDuplicateKeys();
            test.exactStringsNestedValuesAndFractionalTimestampSurvive();
            test.duplicatesIncludingEscapedAndNestedNamesAreRejected();
            test.permissiveAndroidJsonExtensionsAndTrailingContentAreRejected();
            test.malformedUtf8DepthValueCountAndByteLimitFailClosed();
            System.out.println("Owning wire-string span cases PASS"); return;
        }
        if (args.length != 1 || !"--pattern-boundaries".equals(args[0])) throw new IllegalArgumentException("focused selector required");
        ProviderWireJsonTest test = new ProviderWireJsonTest();
        test.numericPatternKeepsExact64CharacterBoundary();
        test.numericPatternPreservesLeadingZeroAndTypedNumberRules();
        test.numericPatternPreservesExponentAndDecimalGrammar();
        test.unicodeEscapePatternKeepsHexAndSurrogateValidation();
        System.out.println("NEW4 ProviderWireJson pattern boundary cases PASS");
    }
    @Test public void exactStringsNestedValuesAndFractionalTimestampSurvive() throws Exception {
        JSONObject value = parse(" {\"timestamp\":\"2026-09-24T12:34:56.123456Z\",\"items\":[{\"ok\":true},null,false],\"unicode\":\"é\\uD83D\\uDE00\",\"integer\":42,\"decimal\":1.0,\"exponent\":1e0} \r\n");
        assertEquals("2026-09-24T12:34:56.123456Z", value.getString("timestamp"));
        assertEquals("é😀", value.getString("unicode")); assertTrue(value.get("integer") instanceof Long);
        assertTrue(value.get("decimal") instanceof Double); assertTrue(value.get("exponent") instanceof Double);
        assertEquals(3, value.getJSONArray("items").length());
    }
    @Test public void largeRawAndEscapedSpansRetainExactDecodedStrings() throws Exception {
        String raw = "Abc012+/=éΩ😀".repeat(4096);
        assertEquals(raw, parse("{\"s\":\"" + raw + "\"}").getString("s"));
        String run = "0123456789abcdef".repeat(2048);
        String wire = "{\"s\":\"" + run + "\\n" + run + "\\uD83D\\uDE00" + run
            + "\\\"\\\\\\/\\b\\f\\r\\t\"}";
        assertEquals(run + "\n" + run + "😀" + run + "\"\\/\b\f\r\t", parse(wire).getString("s"));
        assertEquals("", parse("{\"s\":\"\"}").getString("s"));
        assertEquals("\u0000", parse("{\"s\":\"\\u0000\"}").getString("s"));
    }
    @Test public void spanBoundariesCannotConcealMalformedStringsOrDuplicateKeys() throws Exception {
        String run = "a".repeat(8192);
        for (String suffix : new String[]{"\\q\"}", "\\u12G4\"}", "\\uD800\"}", "\\uDC00\"}",
            "\\uD800x\"}", "\\uD83D\\u0041\"}", "\n\"}", "\\", ""})
            failure("custodial_provider_wire_json_invalid", () -> parse("{\"s\":\"" + run + suffix));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"" + run + "k\":1,\"" + run + "\\u006b\":2}"));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"s\":\"" + run + "\\n" + run + "\u0001\"}"));
    }
    @Test public void duplicatesIncludingEscapedAndNestedNamesAreRejected() throws Exception {
        for (String text : new String[]{"{\"ok\":false,\"ok\":true}", "{\"ok\":false,\"\\u006fk\":true}",
            "{\"data\":{\"operation\":\"a\",\"operation\":\"b\"}}", "{\"items\":[{\"id\":1,\"id\":2}]}"})
        failure("custodial_provider_wire_json_invalid", () -> parse(text));
    }
    @Test public void permissiveAndroidJsonExtensionsAndTrailingContentAreRejected() throws Exception {
        for (String text : new String[]{"{'ok':true}", "{ok:true}", "{\"ok\":true,}", "{\"items\":[1,]}", "{\"ok\"=true}",
            "{\"ok\":NaN}", "{\"ok\":Infinity}", "{\"ok\":01}", "{\"ok\":+1}", "{\"ok\":.5}", "{\"ok\":1.}",
            "{\"ok\":1e999}", "{\"ok\":9223372036854775808}", "{\"ok\":true}{}", "{} trailing", "[]", "null", "", "\uFEFF{}",
            "{\"x\":\"\\q\"}", "{\"x\":\"\\uD800\"}", "{\"x\":\"\\uDC00\"}", "{\"x\":\"line\nfeed\"}"})
            failure("custodial_provider_wire_json_invalid", () -> parse(text));
    }
    @Test public void malformedUtf8DepthValueCountAndByteLimitFailClosed() throws Exception {
        failure("custodial_provider_wire_json_invalid", () -> ProviderWireJson.object(new byte[]{(byte) 0xc3, (byte) 0x28}, 100));
        failure("custodial_provider_wire_json_invalid", () -> ProviderWireJson.object("{}".getBytes(StandardCharsets.UTF_8), 1));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":" + "[".repeat(17) + "0" + "]".repeat(17) + "}"));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":[" + "0,".repeat(10000) + "0]}"));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"x\":\"" + "a".repeat(262144) + "\"}"));
    }

    @Test public void numericPatternKeepsExact64CharacterBoundary() throws Exception {
        String sixtyFour = "0." + "1".repeat(62);
        assertEquals(64, sixtyFour.length());
        assertTrue(parse("{\"n\":" + sixtyFour + "}").get("n") instanceof Double);
        String sixtyFive = "0." + "1".repeat(63);
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"n\":" + sixtyFive + "}"));
    }

    @Test public void numericPatternPreservesLeadingZeroAndTypedNumberRules() throws Exception {
        assertEquals(Long.valueOf(0), parse("{\"n\":0}").get("n"));
        assertEquals(Long.valueOf(-12), parse("{\"n\":-12}").get("n"));
        assertTrue(parse("{\"n\":1.0}").get("n") instanceof Double);
        assertTrue(parse("{\"n\":1e0}").get("n") instanceof Double);
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"n\":01}"));
        failure("custodial_provider_wire_json_invalid", () -> parse("{\"n\":-01}"));
    }

    @Test public void numericPatternPreservesExponentAndDecimalGrammar() throws Exception {
        assertEquals(Double.valueOf(-125.0), parse("{\"n\":-1.25e2}").get("n"));
        assertEquals(Double.valueOf(0.01), parse("{\"n\":1E-2}").get("n"));
        for (String text : new String[]{"1.", ".5", "1e", "1e+", "+1", "--1", "1_0"})
            failure("custodial_provider_wire_json_invalid", () -> parse("{\"n\":" + text + "}"));
    }

    @Test public void unicodeEscapePatternKeepsHexAndSurrogateValidation() throws Exception {
        assertEquals("AΩ", parse("{\"s\":\"\\u0041\\u03a9\"}").getString("s"));
        for (String text : new String[]{"\\u12G4", "\\u123", "\\uD800", "\\uDC00", "\\uD800\\u0041"})
            failure("custodial_provider_wire_json_invalid", () -> parse("{\"s\":\"" + text + "\"}"));
    }

    private interface Attempt { void run() throws Exception; }
    private static void failure(String expectedCode, Attempt attempt) throws Exception {
        try { attempt.run(); fail("expected " + expectedCode); }
        catch (VaultFailure error) { assertEquals(expectedCode, error.code); }
    }
}
