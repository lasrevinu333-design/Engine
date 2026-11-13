package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Full native journal identity, not a device/employee tuple or a browser profile.
 * Construct only from NativePrincipalJournal/engine.readLegacyPrincipal in the runtime.
 * This value validates/binds identity; it does not authenticate its source. */
final class NativeProviderPrincipal {
    private static final String[] V1 = {"schema_version", "device_id", "employee_id", "assignment_epoch", "credential_id",
        "credential_operation_id", "installation_seal", "enrolled_at"};
    private final String encoded;
    private final String canonical;
    final String digest;
    private NativeProviderPrincipal(JSONObject supplied) throws VaultFailure {
        try {
            if (supplied == null) throw new IllegalArgumentException("principal required");
            // Validate BEFORE JSON roundtrip: desktop/Android serializers may turn 4.0 into 4.
            Object suppliedEpoch = supplied.opt("assignment_epoch");
            if (!(suppliedEpoch instanceof Integer || suppliedEpoch instanceof Long)) throw new IllegalArgumentException("principal epoch type");
            JSONObject value = new JSONObject(supplied.toString());
            Object schema = value.get("schema_version");
            boolean legacy = NativeLegacyLineageJournal.PRINCIPAL.equals(schema);
            if (!legacy && !"custodial-protected-principal.v1".equals(schema)) throw new IllegalArgumentException("principal schema");
            Set<String> required = new HashSet<>(Arrays.asList(legacy ? NativeLegacyLineageJournal.PRINCIPAL_KEYS : V1));
            Set<String> actual = new HashSet<>(); for (java.util.Iterator<String> it = value.keys(); it.hasNext();) actual.add(it.next());
            if (!actual.equals(required)) throw new IllegalArgumentException("principal fields");
            for (String name : required) if (!name.equals("assignment_epoch") && !(value.get(name) instanceof String)) throw new IllegalArgumentException("principal field type");
            exact(value.getString("device_id"), VaultValidation.deviceId(value.getString("device_id")));
            uuid(value.getString("employee_id")); uuid(value.getString("credential_id"));
            exact(value.getString("installation_seal"), VaultValidation.bindingSeal(value.getString("installation_seal")));
            String enrolled = value.getString("enrolled_at");
            if (enrolled.length() > 64 || !enrolled.endsWith("Z")) throw new IllegalArgumentException("principal time");
            Instant.parse(enrolled); // Preserve exact original string and sub-second precision in binding.
            Object epoch = value.get("assignment_epoch");
            if (!(epoch instanceof Integer || epoch instanceof Long) || ((Number) epoch).longValue() <= 0
                || ((Number) epoch).longValue() > 9007199254740991L) throw new IllegalArgumentException("principal epoch");
            if (legacy) {
                uuid(value.getString("activation_operation_id")); uuid(value.getString("legacy_binding_id"));
                for (String field : new String[]{"activation_receipt_sha256", "installation_binding_sha256"})
                    if (!value.getString(field).matches("[0-9a-f]{64}")) throw new IllegalArgumentException("principal digest");
                String kind = value.getString("legacy_binding_kind");
                if (!NativeLegacyLineageJournal.OBSERVED.equals(kind) && !NativeLegacyLineageJournal.CONFIRMED.equals(kind)) throw new IllegalArgumentException("principal lineage");
            } else exact(value.getString("credential_operation_id"), VaultValidation.operationId(value.getString("credential_operation_id")));
            JSONArray fields = new JSONArray().put("custodial.native-provider-principal.v1");
            for (String name : new TreeSet<>(required)) fields.put(new JSONArray().put(name).put(value.get(name)));
            encoded = value.toString(); canonical = fields.toString(); digest = hash(canonical);
        } catch (Exception error) { throw new VaultFailure("custodial_provider_principal_invalid", error); }
    }
    static NativeProviderPrincipal fromNativeJournal(JSONObject value) throws VaultFailure { return new NativeProviderPrincipal(value); }
    JSONObject json() throws VaultFailure {
        try { return new JSONObject(encoded); } catch (Exception error) { throw new VaultFailure("custodial_provider_principal_invalid", error); }
    }
    boolean same(NativeProviderPrincipal other) { return other != null && canonical.equals(other.canonical); }
    static String hash(String value) throws VaultFailure {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte b : bytes) result.append(Character.forDigit((b & 255) >>> 4, 16)).append(Character.forDigit(b & 15, 16));
            return result.toString();
        } catch (Exception error) { throw new VaultFailure("custodial_provider_digest_failed", error); }
    }
    private static void uuid(String value) {
        if (!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new IllegalArgumentException("principal UUID");
    }
    private static void exact(String value, String normalized) { if (!value.equals(normalized)) throw new IllegalArgumentException("noncanonical principal"); }
}
