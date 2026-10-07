package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual synthetic SQL start/end bytes, not FCM, native admission or clock qualification. */
public final class NativeProviderLunchSqlWireTest {
    private static final String MIGRATION = "20261003194000_native_lunch_delivery.sql";
    private static final String MIGRATION_SHA = "22ef0f716accbd8c2222a117ba876a04631163399ec5619418ddc2e0835f156b";
    private static JSONObject fixture() throws Exception {
        String path = System.getenv("NATIVE_LUNCH_WIRE_FIXTURE");
        assertNotNull("Explicit actual SQL LUNCH fixture required; never silently skip", path);
        JSONObject fixture = new JSONObject(new String(Files.readAllBytes(Path.of(path)), StandardCharsets.UTF_8));
        requireProvenance(fixture);
        return fixture;
    }
    private static void requireProvenance(JSONObject fixture) throws Exception {
        assertEquals("custodial.native-lunch-sql-wire-fixture.v1", fixture.getString("schema"));
        assertEquals(2, fixture.getJSONArray("cases").length());
        JSONObject p = fixture.getJSONObject("sql_fixture_provenance");
        assertEquals("custodial.native-actual-sql-fixture-provenance.v1", p.getString("schema"));
        assertTrue(p.getBoolean("synthetic")); assertFalse(p.getBoolean("production"));
        assertTrue(p.getBoolean("automatic_grants_absent_before_and_after_each"));
        assertTrue(p.getString("backend_commit").matches("[0-9a-f]{40}"));
        assertTrue(p.getString("backend_tree").matches("[0-9a-f]{40}"));
        assertEquals("scripts/native-target-source-database-tests.mjs", p.getJSONObject("source_script").getString("path"));
        assertTrue(p.getJSONObject("source_script").getString("sha256").matches("[0-9a-f]{64}"));
        assertTrue(p.getString("migration_manifest_sha256").matches("[0-9a-f]{64}"));
        assertEquals(MIGRATION, p.getJSONObject("owning_migration").getString("file"));
        assertEquals(MIGRATION_SHA, p.getJSONObject("owning_migration").getString("sha256"));
        JSONArray manifest = p.getJSONArray("migration_manifest");
        assertTrue("Complete replay, not an isolated fabricated migration", manifest.length() >= 213);
        String prior = ""; int owners = 0; boolean integrated = manifest.length() == 227;
        Set<String> names = new HashSet<>(); StringBuilder wire = new StringBuilder("[");
        for (int i = 0; i < manifest.length(); i++) {
            JSONObject row = manifest.getJSONObject(i); String name = row.getString("file"), digest = row.getString("sha256");
            assertEquals(2, row.length()); assertTrue(row.has("file") && row.has("sha256"));
            assertTrue(name.matches("[0-9]{14}_[a-zA-Z0-9_]+\\.sql"));
            assertTrue("Every migration appears exactly once", names.add(name));
            if (!integrated) assertTrue(name.compareTo(prior) > 0); prior = name;
            assertTrue(digest.matches("[0-9a-f]{64}"));
            if (i > 0) wire.append(',');
            wire.append("{\"file\":").append(JSONObject.quote(name)).append(",\"sha256\":").append(JSONObject.quote(digest)).append('}');
            if (MIGRATION.equals(name)) { owners++; assertEquals(MIGRATION_SHA, digest); }
        }
        wire.append(']');
        if (integrated) assertEquals("Exact integrated phase order, not a timestamp-sorted approximation",
            "df6373a06e51e1477e0304dc0460be2e600d6240a5107719cc536b0c0cf21a34", NativeProviderPrincipal.hash(wire.toString()));
        assertEquals(p.getString("migration_manifest_sha256"), NativeProviderPrincipal.hash(wire.toString() + "\n"));
        assertEquals(1, owners);
    }
    private static JSONObject entry(JSONObject fixture, int i) throws Exception { return fixture.getJSONArray("cases").getJSONObject(i); }
    private static JSONObject raw(JSONObject entry) throws Exception { return entry.getJSONObject("envelope").getJSONObject("payload"); }
    private static NativeProviderPayload decode(JSONObject entry) throws Exception { return NativeProviderPayload.fromInventory(raw(entry)); }
    private static void requireSource(NativeProviderPayload payload, JSONObject expected) throws Exception {
        for (String field : new String[]{"credential_id", "employee_id", "device_id", "assignment_epoch"})
            assertEquals(field, expected.getString(field), payload.get("receipt_" + field));
        for (String field : new String[]{"generation_id", "principal_digest", "token_digest", "receipt_job_id",
            "notification_key", "projection_id", "document_identity", "loan_id", "event", "coverer_slot_id",
            "service_date", "scheduled_time", "scheduled_at", "reservation_at", "valid_until"})
            assertEquals(field, expected.getString(field), payload.get(field));
    }
    private static void rejected(JSONObject raw) throws Exception {
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> NativeProviderPayload.fromInventory(raw));
    }
    @Test public void actualStartAndEndSqlStringsHaveExactNativeMeaningAndDigest() throws Exception {
        JSONObject fixture = fixture(); Set<String> events = new HashSet<>(), records = new HashSet<>();
        for (int i = 0; i < 2; i++) {
            JSONObject row = entry(fixture, i), envelope = row.getJSONObject("envelope");
            NativeProviderPayload p = decode(row); requireSource(p, row.getJSONObject("expected"));
            assertEquals(row.getString("event"), p.get("event")); events.add(p.get("event")); records.add(p.recordId);
            assertEquals(NativeProviderPayload.SCHEMA, p.get("schema")); assertEquals(27, p.data().size());
            assertEquals("employee_lunch_coverage", p.get("kind")); assertEquals("lunch_coverage", p.get("notification_type"));
            assertEquals("employee-lunch-coverage", p.get("channel_id")); assertEquals("employee-schedule.html?hub=employee", p.get("route"));
            assertEquals(envelope.getString("wire"), NativeProviderPayload.canonical(p.data(), false));
            assertEquals(p.contentHash, NativeProviderPrincipal.hash(NativeProviderPayload.canonical(p.data(), true)));
            assertTrue(envelope.getString("wire").getBytes(StandardCharsets.UTF_8).length <= 3500);
            assertTrue(envelope.getBoolean("dispatch_authorized")); assertFalse(envelope.getBoolean("replayed"));
            assertFalse(envelope.getBoolean("delivery_outcome_unknown"));
            assertEquals(p.recordId, NativeProviderPrincipal.hash(p.generationId + "\n" + p.jobId + "\n" + p.notificationKey));
            assertFalse(p.reservedAt.isBefore(NativeProviderPayload.timestamp(p.get("scheduled_at"))));
            assertTrue(p.reservedAt.isBefore(p.validUntil));
        }
        assertEquals(Set.of("start", "end"), events); assertEquals(2, records.size());
        NativeProviderPayload start = decode(entry(fixture, 0)), end = decode(entry(fixture, 1));
        assertEquals("start", start.get("event")); assertEquals("end", end.get("event"));
        assertEquals(start.get("loan_id"), end.get("loan_id"));
        assertEquals(start.validUntil, NativeProviderPayload.timestamp(end.get("scheduled_at")));
        assertTrue(end.validUntil.isAfter(start.validUntil));
    }
    @Test public void fcmAndInventoryFactoriesAgreeWithoutGrantingAuthority() throws Exception {
        JSONObject fixture = fixture();
        for (int i = 0; i < 2; i++) {
            NativeProviderPayload p = decode(entry(fixture, i));
            NativeProviderPayload fcm = NativeProviderPayload.fromFcm("123456789012", "123456789012", false, p.data());
            assertEquals(p.data(), fcm.data()); assertEquals(p.recordId, fcm.recordId);
            assertThrows(UnsupportedOperationException.class, () -> p.data().put("body", "changed"));
            ProviderRecordStoreTest.failure("custodial_provider_origin_refused", () ->
                NativeProviderPayload.fromFcm("foreign", "123456789012", false, p.data()));
        }
    }
    @Test public void missingWrongTypedAndExtraFieldsFailOnActualSqlPayloads() throws Exception {
        JSONObject fixture = fixture();
        for (int i = 0; i < 2; i++) {
            JSONObject original = raw(entry(fixture, i));
            for (String field : decode(entry(fixture, i)).data().keySet()) {
                JSONObject missing = new JSONObject(original.toString()); missing.remove(field); rejected(missing);
                JSONObject typed = new JSONObject(original.toString()); typed.put(field, true); rejected(typed);
            }
            JSONObject extra = new JSONObject(original.toString()); extra.put("test_delivery", "true"); rejected(extra);
        }
    }
    @Test public void everyActualSqlContentFieldIsDigestBound() throws Exception {
        JSONObject fixture = fixture();
        for (int i = 0; i < 2; i++) {
            NativeProviderPayload p = decode(entry(fixture, i));
            for (String field : p.data().keySet()) {
                JSONObject altered = p.json();
                // Keep the device syntactically valid so this case reaches the
                // content-hash check, not the earlier device-name validator.
                altered.put(field, field.equals("receipt_device_id")
                    ? (p.get(field).equals("KIOSK_10") ? "KIOSK_09" : "KIOSK_10") : p.get(field) + "x");
                rejected(altered);
            }
        }
    }
    @Test public void resignedMalformedRouteEventAndTimeCannotBecomeLunch() throws Exception {
        JSONObject fixture = fixture();
        for (int i = 0; i < 2; i++) {
            NativeProviderPayload p = decode(entry(fixture, i));
            for (Map.Entry<String,String> change : Map.of("route", "https://external.invalid/",
                "event", "other", "channel_id", "employee-overdue", "scheduled_time", "24:00",
                "valid_until", p.get("reservation_at")).entrySet()) {
                Map<String,String> altered = new TreeMap<>(p.data()); altered.put(change.getKey(), change.getValue());
                NativeProviderPayloadTest.signed(altered); rejected(new JSONObject(altered));
            }
        }
    }
    @Test public void independentlyCapturedSourceAndRecipientCannotBeCrossed() throws Exception {
        JSONObject fixture = fixture();
        for (int i = 0; i < 2; i++) {
            JSONObject row = entry(fixture, i), expected = row.getJSONObject("expected");
            NativeProviderPayload original = decode(row); requireSource(original, expected);
            for (String field : new String[]{"receipt_employee_id", "receipt_credential_id", "receipt_job_id", "generation_id", "principal_digest", "token_digest",
                "projection_id", "loan_id", "document_identity", "notification_key", "receipt_device_id", "receipt_assignment_epoch"}) {
                Map<String,String> crossed = new TreeMap<>(original.data());
                String replacement = field.equals("receipt_device_id") ? "KIOSK_10" : field.equals("receipt_assignment_epoch") ? "2"
                    : field.endsWith("digest") || field.equals("loan_id") || field.equals("document_identity") || field.equals("notification_key")
                    ? "f".repeat(64) : "99000000-0000-4000-8000-000000000001";
                assertNotEquals(replacement, crossed.get(field)); crossed.put(field, replacement); NativeProviderPayloadTest.signed(crossed);
                // Syntax alone is not source/current-owner authority. The independently
                // captured SQL expectation, not a fictional parser authorization, refuses it.
                NativeProviderPayload syntacticallyValid = NativeProviderPayload.fromInventory(new JSONObject(crossed));
                assertThrows(AssertionError.class, () -> requireSource(syntacticallyValid, expected));
            }
            NativeProviderPayload other = decode(entry(fixture, 1-i));
            assertThrows(AssertionError.class, () -> requireSource(other, expected));
        }
    }
    @Test public void missingGrantOrChangedOwningMigrationProvenanceIsNotCredited() throws Exception {
        JSONObject fixture = fixture();
        JSONObject noGrantProof = new JSONObject(fixture.toString());
        noGrantProof.getJSONObject("sql_fixture_provenance").put("automatic_grants_absent_before_and_after_each", false);
        assertThrows(AssertionError.class, () -> requireProvenance(noGrantProof));
        JSONObject wrongMigration = new JSONObject(fixture.toString());
        wrongMigration.getJSONObject("sql_fixture_provenance").getJSONObject("owning_migration").put("sha256", "0".repeat(64));
        assertThrows(AssertionError.class, () -> requireProvenance(wrongMigration));
        for (String fault : new String[]{"missing", "order", "duplicate", "changed-digest", "manifest-hash"}) {
            JSONObject changed = new JSONObject(fixture.toString());
            JSONObject proof = changed.getJSONObject("sql_fixture_provenance");
            JSONArray rows = proof.getJSONArray("migration_manifest");
            if (fault.equals("missing")) rows.remove(rows.length()-1);
            if (fault.equals("order")) { Object first=rows.get(0); rows.put(0,rows.get(1)); rows.put(1,first); }
            if (fault.equals("duplicate")) rows.put(0,rows.get(1));
            if (fault.equals("changed-digest")) rows.getJSONObject(20).put("sha256","0".repeat(64));
            if (fault.equals("manifest-hash")) proof.put("migration_manifest_sha256","0".repeat(64));
            assertThrows(fault, AssertionError.class, () -> requireProvenance(changed));
        }
    }
}
