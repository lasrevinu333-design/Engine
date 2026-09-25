package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderPayloadTest {
    static final String PROJECT = "123456789012", RESERVATION = "2026-09-24T17:00:00.123456Z", END = "2026-09-24T18:00:00.000000Z";
    static Map<String, String> lunch(NativeProviderJournal.Prepared prepared) throws Exception {
        JSONObject principal = prepared.json().getJSONObject("principal"); Map<String, String> data = new TreeMap<>();
        data.put("schema", NativeProviderPayload.SCHEMA); data.put("kind", "employee_lunch_coverage"); data.put("notification_type", "lunch_coverage");
        data.put("generation_id", prepared.generationId); data.put("principal_digest", prepared.principalDigest); data.put("token_digest", prepared.tokenDigest);
        data.put("receipt_job_id", "77000000-0000-4000-8000-000000000001");
        for (String field : new String[]{"credential_id", "employee_id", "device_id", "assignment_epoch"}) data.put("receipt_" + field, String.valueOf(principal.get(field)));
        data.put("notification_key", "a".repeat(64)); data.put("reservation_at", RESERVATION); data.put("valid_until", END);
        data.put("title", "Lunch coverage starts now"); data.put("body", "Open My Schedule for your borrowed areas."); data.put("channel_id", "employee-lunch-coverage");
        data.put("route", "employee-schedule.html?hub=employee"); data.put("service_date", "2026-09-24");
        data.put("event", "start"); data.put("loan_id", "b".repeat(64)); data.put("scheduled_time", "12:00"); data.put("scheduled_at", "2026-09-24T17:00:00.000000Z");
        data.put("coverer_slot_id", "staff-slot-2"); data.put("projection_id", "66000000-0000-4000-8000-000000000001"); data.put("document_identity", "c".repeat(64));
        return signed(data);
    }
    static Map<String, String> signed(Map<String, String> data) throws Exception {
        data.put("content_sha256", NativeProviderPrincipal.hash(NativeProviderPayload.canonical(data, true))); return data;
    }
    static NativeProviderPayload accept(Map<String, ?> data) throws VaultFailure { return NativeProviderPayload.fromFcm(PROJECT, PROJECT, false, data); }
    static NativeProviderRegistrationReceiptTest.Fixture fixture() throws Exception { return new NativeProviderRegistrationReceiptTest.Fixture(false); }
    static Map<String, String> location(boolean overdue, boolean exhibit) throws Exception {
        Map<String, String> data = lunch(fixture().prepared);
        for (String field : new String[]{"event", "loan_id", "scheduled_time", "scheduled_at", "coverer_slot_id", "projection_id", "document_identity"}) data.remove(field);
        data.put("kind", "employee_location_status"); data.put("notification_type", "location_status"); data.put("reminder_contract", "verified-visit-reminders.v2");
        data.put("cleaned_at", "2026-09-24T13:00:00.123456Z"); data.put("cycle_base_at", data.get("cleaned_at")); data.put("cycle_base_evidence", "completed_cleaning");
        data.put("due_soon_at", exhibit ? "2026-09-24T16:15:00.123456Z" : "2026-09-24T14:15:00.123456Z");
        data.put("overdue_at", exhibit ? "2026-09-24T16:30:00.123456Z" : "2026-09-24T14:30:00.123456Z");
        data.put("status_code", overdue ? "overdue" : "due_soon"); data.put("form_type", exhibit ? "exhibit" : "restroom");
        data.put("reservation_at", overdue ? (exhibit ? "2026-09-24T16:35:00.123456Z" : "2026-09-24T14:35:00.123456Z") : data.get("due_soon_at"));
        data.put("valid_until", overdue ? (exhibit ? "2026-09-24T16:40:00.123456Z" : "2026-09-24T14:40:00.123456Z") : data.get("overdue_at"));
        data.put("location_id", "55000000-0000-4000-8000-000000000001"); data.put("location_code", "TETM"); data.put("location_name", "Teton restroom");
        data.put("group_code", "TETON"); data.put("group_name", "Teton"); data.put("channel_id", overdue ? "employee-overdue" : "employee-due-soon");
        data.put("route", "employee-schedule.html?hub=employee&highlight=TETM");
        data.put("notification_key", "location-visit:2026-09-24:" + data.get("location_id") + ":" + data.get("status_code") + ":20260924130000123456:" + (overdue ? "1" : "0"));
        return signed(data);
    }
    @Test public void exactFcmAndAuthenticatedInventoryAreIdenticalButDoNotCreateAuthority() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            NativeProviderRegistrationReceiptTest.Fixture f = new NativeProviderRegistrationReceiptTest.Fixture(legacy);
            Map<String, String> data = lunch(f.prepared); NativeProviderPayload received = accept(data);
            NativeProviderPayload inventory = NativeProviderPayload.fromInventory(received.json());
            assertEquals(received.recordId, inventory.recordId); assertEquals(received.data(), inventory.data()); received.requirePrincipal(f.principal);
            assertEquals(RESERVATION, received.reservedAt.toString());
            data.put("body", "mutated caller buffer"); assertNotEquals(data.get("body"), received.get("body"));
            try { received.data().put("body", "mutated"); fail(); } catch (UnsupportedOperationException expected) { }
            assertFalse(f.f.journal().prepareRegistration(f.principal, NativeProviderJournalTest.app()).confirmed);
        }
    }
    @Test public void expectedSdkSenderAndDataOnlyAreMandatory() throws Exception {
        Map<String, String> data = lunch(fixture().prepared);
        for (String sender : new String[]{"", "foreign", "/topics/" + PROJECT, "0" + PROJECT})
            ProviderRecordStoreTest.failure("custodial_provider_origin_refused", () -> NativeProviderPayload.fromFcm(sender, PROJECT, false, data));
        ProviderRecordStoreTest.failure("custodial_provider_origin_refused", () -> NativeProviderPayload.fromFcm(PROJECT, PROJECT, true, data));
        ProviderRecordStoreTest.failure("custodial_provider_origin_refused", () -> NativeProviderPayload.fromFcm(PROJECT, "", false, data));
    }
    @Test public void allContentFieldsAreHashedAndSameLogicalIdentityCannotBecomeANewRecord() throws Exception {
        Map<String, String> original = lunch(fixture().prepared); NativeProviderPayload accepted = accept(original);
        for (String key : original.keySet()) {
            Map<String, String> changed = new TreeMap<>(original); changed.put(key, changed.get(key) + "x");
            try { accept(changed); fail("unbound field " + key); } catch (VaultFailure expected) { }
        }
        Map<String, String> changed = new TreeMap<>(original); changed.put("body", "A different body"); NativeProviderPayload conflict = accept(signed(changed));
        assertEquals(accepted.recordId, conflict.recordId); assertNotEquals(accepted.contentHash, conflict.contentHash);
    }
    @Test public void unknownMissingWrongTypedAndTestDeliveryFieldsNeverBecomeProtectedAuthority() throws Exception {
        Map<String, String> source = lunch(fixture().prepared);
        for (String field : source.keySet()) {
            Map<String, Object> changed = new HashMap<>(source); changed.remove(field);
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(changed));
            changed.put(field, true); ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(changed));
        }
        for (String field : new String[]{"test_delivery", "sender", "active", "inspection_score", "extra"}) {
            Map<String, String> changed = new TreeMap<>(source); changed.put(field, "true");
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
        }
    }
    @Test public void malformedProtectedTrafficIsNotLegacyFallback() {
        assertTrue(NativeProviderPayload.protectedTraffic(Map.of("kind", "employee_location_status", "test_delivery", true)));
        assertTrue(NativeProviderPayload.protectedTraffic(Map.of("schema", NativeProviderPayload.SCHEMA, "kind", "foreign")));
        assertTrue(NativeProviderPayload.protectedTraffic(Map.of("schema", "custodial.native-provider-payload.v2")));
        assertFalse(NativeProviderPayload.protectedTraffic(Map.of("kind", "employee_message")));
    }
    @Test public void aliasesArbitraryRoutesChannelMismatchAndInvalidFractionalTimesFailEvenIfRehashed() throws Exception {
        Map<String, String> source = lunch(fixture().prepared);
        for (String route : new String[]{"https://example.invalid", "employee-schedule.html?hub=employee&device=KIOSK_09", "../employee-schedule.html?hub=employee", "Employee-schedule.html?hub=employee"}) {
            Map<String, String> changed = new TreeMap<>(source); changed.put("route", route);
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
        }
        for (String time : new String[]{"2026-09-24T17:00:00Z", "2026-09-24T17:00:00.123Z", "2026-09-24T24:00:00.000000Z", "2026-09-24T23:59:60.000000Z", END}) {
            Map<String, String> changed = new TreeMap<>(source); changed.put("reservation_at", time);
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
        }
        Map<String, String> changed = new TreeMap<>(source); changed.put("channel_id", "employee-events");
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
    }
    @Test public void existingRestroomAndExhibitThresholdsAndFiveMinuteOverdueBucketsArePreserved() throws Exception {
        for (boolean exhibit : new boolean[]{false, true}) for (boolean overdue : new boolean[]{false, true}) {
            Map<String, String> data = location(overdue, exhibit); accept(data);
            Map<String, String> shortened = new TreeMap<>(data);
            shortened.put("valid_until", data.get("reservation_at").replace(".123456", ".123457")); accept(signed(shortened)); // Earlier coverage end.
            for (String key : new String[]{"due_soon_at", "overdue_at", "valid_until"}) {
                Map<String, String> changed = new TreeMap<>(data); changed.put(key, data.get(key).replace(".123456", ".123457"));
                ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
            }
        }
    }
    @Test public void verifiedCheckCycleIsSeparateFromCleaningAndRequiresPriorClean() throws Exception {
        Map<String, String> checked = location(false, false); checked.put("cleaned_at", "2026-09-24T12:00:00.123456Z");
        checked.put("cycle_base_evidence", "verified_check_checkout"); accept(signed(checked));
        checked.put("cleaned_at", checked.get("cycle_base_at")); ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(checked)));
        checked.put("cleaned_at", ""); ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(checked)));
    }
    @Test public void lunchStartExpiresAtLoanEndAndEndNoticeHasNoInventedResponseDeadline() throws Exception {
        Map<String, String> data = lunch(fixture().prepared);
        data.put("valid_until", "2026-09-24T18:00:00.000001Z"); ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(data)));
        data.put("event", "end"); data.put("scheduled_at", "2026-09-24T18:00:00.000000Z"); data.put("scheduled_time", "13:00");
        data.put("reservation_at", "2026-09-24T18:00:00.000001Z"); data.put("valid_until", "2026-09-24T21:00:00.000000Z"); accept(signed(data));
    }
    @Test public void nativePrincipalDigestAndEveryRecipientFieldMustMatch() throws Exception {
        NativeProviderRegistrationReceiptTest.Fixture f = fixture(); Map<String, String> data = lunch(f.prepared);
        for (String field : new String[]{"principal_digest", "receipt_device_id", "receipt_employee_id", "receipt_credential_id", "receipt_assignment_epoch"}) {
            Map<String, String> changed = new TreeMap<>(data);
            changed.put(field, field.equals("principal_digest") ? "d".repeat(64) : field.endsWith("epoch") ? "5" : field.endsWith("device_id") ? "KIOSK_09" : "99000000-0000-4000-8000-000000000001");
            NativeProviderPayload candidate = accept(signed(changed));
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> candidate.requirePrincipal(f.principal));
        }
    }
    @Test public void utf8ByteCapUnknownIntegersAndMalformedUnicodeAreNotCoercedOrTruncated() throws Exception {
        Map<String, String> data = lunch(fixture().prepared);
        for (String epoch : new String[]{"4.0", "04", "4e0", "+4", " 4", "0", "-1", "9007199254740992"}) {
            Map<String, String> changed = new TreeMap<>(data); changed.put("receipt_assignment_epoch", epoch);
            ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(signed(changed)));
        }
        data.put("body", "界".repeat(1000)); assertTrue(NativeProviderPayload.canonical(signed(data), false).getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 3500);
        ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(data));
        data.put("body", "broken\ud800"); ProviderRecordStoreTest.failure("custodial_provider_payload_invalid", () -> accept(data));
    }
    @Test public void canonicalEncodingMatchesIndependentNodeJsonStringifyAndSha256Golden() throws Exception {
        JSONObject fixture;
        try (java.io.InputStream stream = getClass().getResourceAsStream("/provider-wire-golden.json")) {
            assertNotNull("independent Node golden fixture must be on the test classpath", stream);
            fixture = new JSONObject(new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
        String wire = fixture.getString("wire"), expected = fixture.getString("sha256");
        if (System.getenv("PROVIDER_WIRE_GOLDEN") != null) {
            assertEquals("live Node oracle must match committed fixture", wire, System.getenv("PROVIDER_WIRE_GOLDEN"));
            assertEquals(expected, System.getenv("PROVIDER_WIRE_GOLDEN_SHA256"));
        }
        JSONObject object = new JSONObject(wire);
        Map<String, String> values = new TreeMap<>();
        for (java.util.Iterator<String> keys = object.keys(); keys.hasNext();) { String key = keys.next(); values.put(key, object.getString(key)); }
        assertEquals(wire, NativeProviderPayload.canonical(values, false)); assertEquals(expected, NativeProviderPrincipal.hash(NativeProviderPayload.canonical(values, false)));
    }
}
