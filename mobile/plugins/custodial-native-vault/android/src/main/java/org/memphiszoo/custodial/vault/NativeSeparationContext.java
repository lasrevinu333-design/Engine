package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Typed H04 context from the exact native authenticated transport owner.
 * Validation is NOT authentication: callers must supply an actual HTTPS result
 * and a receiver-owned protected principal, never WebView-supplied JSON.
 * This value grants no Start/Finish authority and does not acknowledge inventory.
 */
final class NativeSeparationContext {
    static final String PATH = "/device-auth/separation-context";
    static final String FAILURE = "custodial_native_separation_context_invalid";
    private final NativeProviderPrincipal principal;
    private final String encoded;
    final String separationId;
    final long authorityRevision;
    final Instant cutoff;

    private NativeSeparationContext(NativeProviderPrincipal principal, JSONObject value) throws Exception {
        this.principal = principal;
        encoded = value.toString();
        separationId = text(value, "separation_id");
        authorityRevision = integer(value, "authority_revision");
        cutoff = Instant.parse(text(value, "cutoff_at")); // Never Date/double/millisecond rounding.
    }

    static NativeSeparationContext fromAuthenticatedResponse(AuthorizedRequest request,
        AuthorizedResponse response, NativeProviderPrincipal principal) throws VaultFailure {
        try {
            if (request == null || response == null || principal == null
                || !PATH.equals(request.path) || !"GET".equals(request.method)
                || request.body.length != 0 || response.status != 200) throw invalid();
            JSONObject envelope = ProviderWireJson.object(response.body, 131072);
            keys(envelope, "ok", "data");
            if (!Boolean.TRUE.equals(envelope.get("ok"))) throw invalid();
            return validateRetainedData(envelope.getJSONObject("data"),principal);
        } catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    /** Structural validation ONLY for the native signed-record verifier.
     * This does not authenticate persisted data: the caller must additionally
     * verify the exact original-credential signature and full raw snapshot. */
    static NativeSeparationContext validateRetainedData(JSONObject data,NativeProviderPrincipal principal)throws VaultFailure{
        try{
            if(data==null||principal==null)throw invalid();
            JSONObject expected = principal.json();
            keys(data, "schema", "separation_id", "authority_revision", "employee_id", "device_id",
                "canonical_device_id", "credential_id", "assignment_epoch", "cutoff_at", "state",
                "native_inventory_state", "server_known_open_sessions", "new_work_allowed", "phone_released", "purpose");
            if (!"custodial.separation-context.v1".equals(text(data, "schema"))
                || !"PENDING_RECONCILIATION".equals(text(data, "state"))
                || !"SEPARATION_STATUS_ONLY".equals(text(data, "purpose"))
                || !Boolean.FALSE.equals(data.get("new_work_allowed"))
                || !Boolean.FALSE.equals(data.get("phone_released"))) throw invalid();
            uuid(text(data, "separation_id")); uuid(text(data, "device_id"));
            uuid(text(data, "employee_id")); uuid(text(data, "credential_id"));
            integer(data, "authority_revision");
            if (!expected.getString("device_id").equals(text(data, "canonical_device_id"))
                || !expected.getString("employee_id").equals(text(data, "employee_id"))
                || !expected.getString("credential_id").equals(text(data, "credential_id"))
                || expected.getLong("assignment_epoch") != integer(data, "assignment_epoch")) throw invalid();
            String cutoff = text(data, "cutoff_at");
            if (!cutoff.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z")) throw invalid();
            Instant parsed = Instant.parse(cutoff);
            // ISO parsing may normalize a leap second; retain only exact values.
            if (cutoff.substring(17,19).equals("60") || parsed.getNano() % 1000 != 0) throw invalid();
            if (!Set.of("UNKNOWN", "VERIFIED_EMPTY", "PROTECTED_PENDING", "RECONCILED")
                .contains(text(data, "native_inventory_state"))) throw invalid();
            JSONArray sessions = data.getJSONArray("server_known_open_sessions");
            Set<String> identities = new HashSet<>();
            for (int i = 0; i < sessions.length(); i++) {
                JSONObject session = sessions.getJSONObject(i);
                keys(session, "session_id", "session_uuid", "client_session_id", "started_at", "status_at_separation");
                String sessionId = text(session, "session_id"); uuid(sessionId);
                if (!identities.add(sessionId)) throw invalid();
                // Legacy identifiers/timestamps are retained evidence, NOT native
                // occurrence/time proof. Do not convert or invent their format.
                for (String field : new String[]{"session_uuid", "client_session_id", "started_at"}) {
                    Object item = session.get(field);
                    if (item != JSONObject.NULL && !(item instanceof String)) throw invalid();
                }
                if (!Set.of("active", "pending_submit").contains(text(session, "status_at_separation"))) throw invalid();
            }
            return new NativeSeparationContext(principal, data);
        } catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }

    JSONObject json() throws VaultFailure {
        try { return new JSONObject(encoded); }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }
    JSONObject originalPrincipal() throws VaultFailure { return principal.json(); }
    boolean matchesPrincipal(NativeProviderPrincipal current) { return principal.same(current); }
    boolean same(NativeSeparationContext other) throws VaultFailure {
        try { return other != null && principal.same(other.principal) && ProviderWireJson.same(json(), other.json()); }
        catch (Exception error) { throw new VaultFailure(FAILURE, error); }
    }
    private static long integer(JSONObject object, String field) throws Exception {
        Object value = object.get(field);
        if (!(value instanceof Integer || value instanceof Long)) throw invalid();
        long result = ((Number) value).longValue();
        if (result <= 0 || result > 9007199254740991L) throw invalid();
        return result;
    }
    private static String text(JSONObject object, String field) throws Exception {
        Object value = object.get(field); if (!(value instanceof String)) throw invalid(); return (String) value;
    }
    private static void uuid(String value) throws VaultFailure {
        if (!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw invalid();
    }
    private static void keys(JSONObject value, String... fields) throws VaultFailure {
        Set<String> actual = new HashSet<>();
        for (java.util.Iterator<String> it = value.keys(); it.hasNext();) actual.add(it.next());
        if (!actual.equals(new HashSet<>(Arrays.asList(fields)))) throw invalid();
    }
    private static VaultFailure invalid() { return new VaultFailure(FAILURE); }
}
