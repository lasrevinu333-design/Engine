package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

/** Exact response validation only. The internal HTTPS transport must establish origin.
 * Never construct from WebView/FCM/Intent input and never use HTTP200 as settlement. */
final class NativeProviderRegistrationReceipt {
    static final String SCHEMA = "custodial.native-provider-registration.v1";
    private static final String[] FIELDS = {"schema", "operation_id", "generation_id", "registration_id", "principal_digest", "token_digest",
        "device_id", "credential_id", "employee_id", "assignment_epoch", "native_app", "activated_at", "prior_generation_id",
        "prior_dispatch_retired_at", "server_now", "admitted_state", "replayed"};
    private final String encoded, expectedEncoded;
    final String generationId, registrationId, activatedAt, priorGenerationId, priorRetiredAt;
    private NativeProviderRegistrationReceipt(JSONObject value, NativeProviderJournal.Prepared expected) throws Exception {
        exact(value, FIELDS);
        JSONObject original = expected.json(), principal = original.getJSONObject("principal");
        if (!"PREPARED_QUARANTINE".equals(original.get("state"))) throw invalid();
        if (!SCHEMA.equals(value.get("schema")) || !"ACTIVE".equals(value.get("admitted_state"))
            || !(value.get("replayed") instanceof Boolean)) throw invalid();
        for (String field : new String[]{"operation_id", "generation_id", "principal_digest", "token_digest"})
            if (!(value.get(field) instanceof String) || !original.get(field).equals(value.get(field))) throw invalid();
        for (String field : new String[]{"device_id", "credential_id", "employee_id"})
            if (!(value.get(field) instanceof String) || !principal.get(field).equals(value.get(field))) throw invalid();
        if (integer(value.get("assignment_epoch")) != integer(principal.get("assignment_epoch"))) throw invalid();
        JSONObject app = value.getJSONObject("native_app");
        exact(app, "package_name", "version_name", "version_code", "build_id"); integer(app.get("version_code"));
        if (!NativeLegacyLineageJournal.same(app, original.getJSONObject("native_app"))) throw invalid();
        generationId = value.getString("generation_id"); registrationId = uuid(value.get("registration_id"));
        activatedAt = timestamp(value.get("activated_at")); String serverNow = timestamp(value.get("server_now"));
        if (Instant.parse(activatedAt).isAfter(Instant.parse(serverNow))) throw invalid();
        if (value.get("prior_generation_id") == JSONObject.NULL) {
            if (value.get("prior_dispatch_retired_at") != JSONObject.NULL) throw invalid();
            priorGenerationId = null; priorRetiredAt = null;
        } else {
            priorGenerationId = uuid(value.get("prior_generation_id")); priorRetiredAt = timestamp(value.get("prior_dispatch_retired_at"));
            if (generationId.equals(priorGenerationId) || !activatedAt.equals(priorRetiredAt)) throw invalid();
        }
        encoded = value.toString(); expectedEncoded = original.toString();
    }
    static NativeProviderRegistrationReceipt validateResponse(NativeProviderJournal.Prepared expected, AuthorizedResponse response) throws VaultFailure {
        try {
            if (expected == null || response == null || response.status < 200 || response.status >= 300) throw invalid();
            String contentType = ""; int contentTypes = 0;
            for (Map.Entry<String, String> header : response.headers.entrySet())
                if ("content-type".equalsIgnoreCase(header.getKey())) { contentTypes++; contentType = header.getValue() == null ? "" : header.getValue(); }
            if (contentTypes != 1 || !contentType.toLowerCase(java.util.Locale.ROOT).matches("application/json(?:\\s*;\\s*charset=utf-8)?")) throw invalid();
            JSONObject envelope = ProviderWireJson.object(response.body, 262144); exact(envelope, "ok", "data");
            if (!Boolean.TRUE.equals(envelope.get("ok"))) throw invalid();
            return new NativeProviderRegistrationReceipt(envelope.getJSONObject("data"), expected);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_registration_receipt_invalid", error); }
    }
    void requireExpected(NativeProviderJournal.Prepared expected) throws VaultFailure {
        try { if (expected == null || !NativeLegacyLineageJournal.same(new JSONObject(expectedEncoded), expected.json())) throw invalid(); }
        catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_registration_receipt_invalid", error); }
    }
    JSONObject json() throws VaultFailure {
        try { return new JSONObject(encoded); } catch (Exception error) { throw new VaultFailure("custodial_provider_registration_receipt_invalid", error); }
    }
    private static void exact(JSONObject value, String... fields) throws VaultFailure {
        Set<String> actual = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) actual.add(it.next());
        if (!actual.equals(new HashSet<>(Arrays.asList(fields)))) throw invalid();
    }
    private static long integer(Object value) throws VaultFailure {
        if (!(value instanceof Integer || value instanceof Long) || ((Number) value).longValue() <= 0 || ((Number) value).longValue() > 9007199254740991L) throw invalid();
        return ((Number) value).longValue();
    }
    private static String uuid(Object value) throws VaultFailure {
        if (!(value instanceof String) || !((String) value).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw invalid();
        return (String) value;
    }
    private static String timestamp(Object value) throws VaultFailure {
        if (!(value instanceof String) || !((String) value).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z")) throw invalid();
        try {
            Instant parsed = Instant.parse((String) value);
            String canonical = new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(parsed);
            if (!canonical.equals(value)) throw invalid(); return (String) value;
        } catch (Exception error) { throw invalid(); }
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_registration_receipt_invalid"); }
}
