package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;

/** Bounded canonical protected payload, not current-principal or display authority.
 * Only the SDK service / typed inventory owner may call the ingress factories.
 * Journal admission must additionally validate known generation, full principal,
 * activation/retirement and authenticated native time before any effect. */
final class NativeProviderPayload {
    static final String SCHEMA = "custodial.native-provider-payload.v1";
    static final int MAX_BYTES = 3500;
    private static final String[] COMMON = {"schema", "generation_id", "principal_digest", "token_digest", "receipt_job_id",
        "receipt_credential_id", "receipt_employee_id", "receipt_device_id", "receipt_assignment_epoch", "notification_key",
        "reservation_at", "valid_until", "content_sha256", "kind", "notification_type", "title", "body", "channel_id", "route", "service_date"};
    private static final String[] LUNCH = {"event", "loan_id", "scheduled_time", "scheduled_at", "coverer_slot_id", "projection_id", "document_identity"};
    private static final String[] LOCATION = {"reminder_contract", "cleaned_at", "cycle_base_at", "cycle_base_evidence", "due_soon_at", "overdue_at",
        "status_code", "location_id", "location_code", "location_name", "form_type", "group_code", "group_name"};
    private final Map<String, String> data;
    final String generationId, principalDigest, tokenDigest, jobId, notificationKey, contentHash, recordId;
    final Instant reservedAt, validUntil;

    private NativeProviderPayload(Map<String, ?> supplied) throws VaultFailure {
        try {
            if (supplied == null || supplied.size() > 40) throw invalid();
            TreeMap<String, String> copy = new TreeMap<>();
            for (Map.Entry<String, ?> entry : supplied.entrySet()) {
                if (entry.getKey() == null || !(entry.getValue() instanceof String)) throw invalid();
                strictText(entry.getKey(), 100, false); strictText((String) entry.getValue(), 1000, true);
                copy.put(entry.getKey(), (String) entry.getValue());
            }
            boolean lunch = "employee_lunch_coverage".equals(copy.get("kind"));
            if (!lunch && !"employee_location_status".equals(copy.get("kind"))) throw invalid();
            Set<String> fields = new HashSet<>(Arrays.asList(COMMON)); fields.addAll(Arrays.asList(lunch ? LUNCH : LOCATION));
            if (!copy.keySet().equals(fields) || !SCHEMA.equals(copy.get("schema"))) throw invalid();
            for (String field : fields) if (!field.equals("group_code") && !field.equals("group_name") && copy.get(field).isEmpty()) throw invalid();
            if (canonical(copy, false).getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) throw invalid();
            data = Collections.unmodifiableMap(copy);
            generationId = uuid(get("generation_id")); jobId = uuid(get("receipt_job_id"));
            uuid(get("receipt_credential_id")); uuid(get("receipt_employee_id"));
            if (!get("receipt_device_id").equals(VaultValidation.deviceId(get("receipt_device_id")))) throw invalid();
            positiveInteger(get("receipt_assignment_epoch"));
            principalDigest = digest(get("principal_digest")); tokenDigest = digest(get("token_digest")); contentHash = digest(get("content_sha256"));
            if (!contentHash.equals(NativeProviderPrincipal.hash(canonical(copy, true)))) throw invalid();
            notificationKey = get("notification_key"); strictText(notificationKey, 240, false);
            strictText(get("title"), 180, false); strictText(get("body"), 1000, true);
            reservedAt = timestamp(get("reservation_at")); validUntil = timestamp(get("valid_until"));
            if (!reservedAt.isBefore(validUntil)) throw invalid();
            String day = get("service_date");
            if (!day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !LocalDate.parse(day).toString().equals(day)) throw invalid();
            if (lunch) validateLunch(); else validateLocation();
            // Stable logical identity; changed content at the same identity is a conflict, not a new record.
            recordId = NativeProviderPrincipal.hash(generationId + "\n" + jobId + "\n" + notificationKey);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_payload_invalid", error); }
    }

    /** Malformed protected traffic must never fall through to legacy plugin delivery. */
    static boolean protectedTraffic(Map<String, ?> data) {
        if (data == null) return false;
        Object kind = data.get("kind"), schema = data.get("schema");
        return "employee_lunch_coverage".equals(kind) || "employee_location_status".equals(kind)
            || (schema instanceof String && ((String) schema).startsWith("custodial.native-provider-"));
    }
    static NativeProviderPayload fromFcm(String sdkSender, String configuredProjectNumber, boolean hasNotification,
        Map<String, ?> data) throws VaultFailure {
        if (configuredProjectNumber == null || !configuredProjectNumber.matches("[1-9][0-9]{0,29}")
            || !configuredProjectNumber.equals(sdkSender) || hasNotification) throw new VaultFailure("custodial_provider_origin_refused");
        return new NativeProviderPayload(data);
    }
    /** Called only after the internal typed HTTPS inventory response has been authenticated. */
    static NativeProviderPayload fromInventory(JSONObject object) throws VaultFailure {
        try {
            Map<String, Object> values = new TreeMap<>();
            for (java.util.Iterator<String> it = object.keys(); it.hasNext();) { String key = it.next(); values.put(key, object.get(key)); }
            return new NativeProviderPayload(values);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_payload_invalid", error); }
    }
    String get(String field) { return data.get(field); }
    Map<String, String> data() { return data; }
    JSONObject json() throws VaultFailure {
        try { return new JSONObject(canonical(data, false)); }
        catch (Exception error) { throw new VaultFailure("custodial_provider_payload_invalid", error); }
    }
    void requirePrincipal(NativeProviderPrincipal principal) throws VaultFailure {
        try {
            if (principal == null || !principalDigest.equals(principal.digest)) throw invalid();
            JSONObject value = principal.json();
            for (String field : new String[]{"credential_id", "employee_id", "device_id", "assignment_epoch"})
                if (!get("receipt_" + field).equals(String.valueOf(value.get(field)))) throw invalid();
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_payload_invalid", error); }
    }
    private void validateLunch() throws VaultFailure {
        if (!"lunch_coverage".equals(get("notification_type")) || !"employee-lunch-coverage".equals(get("channel_id"))
            || !"employee-schedule.html?hub=employee".equals(get("route")) || !Arrays.asList("start", "end").contains(get("event"))) throw invalid();
        digest(get("loan_id")); digest(get("document_identity")); digest(notificationKey); uuid(get("projection_id"));
        strictText(get("coverer_slot_id"), 100, false);
        if (!get("scheduled_time").matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) throw invalid();
        Instant scheduled = timestamp(get("scheduled_at"));
        if (reservedAt.isBefore(scheduled) || ("start".equals(get("event")) && validUntil.isAfter(scheduled.plusSeconds(3600)))) throw invalid();
        // SQL must additionally prove the exact active publication/loan/recipient and coverage end.
    }
    private void validateLocation() throws VaultFailure {
        String status = get("status_code"), form = get("form_type");
        if (!"location_status".equals(get("notification_type")) || !"verified-visit-reminders.v2".equals(get("reminder_contract"))
            || !Arrays.asList("due_soon", "overdue").contains(status) || !Arrays.asList("restroom", "exhibit").contains(form)
            || !("overdue".equals(status) ? "employee-overdue" : "employee-due-soon").equals(get("channel_id"))) throw invalid();
        uuid(get("location_id")); String code = get("location_code");
        if (!code.matches("[A-Z0-9._:-]{1,100}") || !("employee-schedule.html?hub=employee&highlight=" + code).equals(get("route"))) throw invalid();
        strictText(get("location_name"), 180, false); strictText(get("group_code"), 100, false); strictText(get("group_name"), 180, false);
        Instant cleaned = timestamp(get("cleaned_at")), base = timestamp(get("cycle_base_at")), due = timestamp(get("due_soon_at")), overdue = timestamp(get("overdue_at"));
        String evidence = get("cycle_base_evidence");
        if (!("completed_cleaning".equals(evidence) && base.equals(cleaned))
            && !("verified_check_checkout".equals(evidence) && base.isAfter(cleaned))) throw invalid();
        long minutes = "restroom".equals(form) ? 75 : 195;
        if (!due.equals(base.plusSeconds(minutes * 60)) || !overdue.equals(base.plusSeconds((minutes + 15) * 60))) throw invalid();
        long repeat = 0;
        if ("due_soon".equals(status)) {
            if (reservedAt.isBefore(due) || !reservedAt.isBefore(overdue) || validUntil.isAfter(overdue)) throw invalid();
        } else {
            if (reservedAt.isBefore(overdue)) throw invalid();
            repeat = Duration.between(overdue, reservedAt).getSeconds() / 300;
            if (validUntil.isAfter(overdue.plusSeconds(Math.multiplyExact(repeat + 1, 300)))) throw invalid();
        }
        String cycle = DateTimeFormatter.ofPattern("uuuuMMddHHmmssSSSSSS").withZone(ZoneOffset.UTC).format(base);
        if (!notificationKey.equals("location-visit:" + get("service_date") + ":" + get("location_id") + ":" + status + ":" + cycle + ":" + repeat)) throw invalid();
    }

    /** Flat sorted-key JSON using RFC8259/JSON.stringify string escaping (not JSONObject's slash escaping). */
    static String canonical(Map<String, String> data, boolean excludeHash) throws VaultFailure {
        StringBuilder encoded = new StringBuilder("{"); boolean first = true;
        for (Map.Entry<String, String> entry : new TreeMap<>(data).entrySet()) {
            if (excludeHash && "content_sha256".equals(entry.getKey())) continue;
            if (!first) encoded.append(','); first = false;
            quote(encoded, entry.getKey()); encoded.append(':'); quote(encoded, entry.getValue());
        }
        return encoded.append('}').toString();
    }
    private static void quote(StringBuilder out, String value) throws VaultFailure {
        if (value == null) throw invalid();
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= value.length() || !Character.isLowSurrogate(value.charAt(i + 1))) throw invalid();
                out.append(c).append(value.charAt(++i)); continue;
            }
            if (Character.isLowSurrogate(c)) throw invalid();
            switch (c) {
                case '"': out.append("\\\""); break; case '\\': out.append("\\\\"); break;
                case '\b': out.append("\\b"); break; case '\f': out.append("\\f"); break;
                case '\n': out.append("\\n"); break; case '\r': out.append("\\r"); break; case '\t': out.append("\\t"); break;
                default:
                    if (c < 32) { out.append("\\u00").append(Character.forDigit(c >>> 4, 16)).append(Character.forDigit(c & 15, 16)); }
                    else out.append(c);
            }
        }
        out.append('"');
    }
    private static void strictText(String value, int max, boolean lines) throws VaultFailure {
        if (value == null || value.length() > max || !new String(value.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8).equals(value)) throw invalid();
        for (int i = 0; i < value.length(); i++) if (Character.isISOControl(value.charAt(i))
            && !(lines && (value.charAt(i) == '\n' || value.charAt(i) == '\r' || value.charAt(i) == '\t'))) throw invalid();
    }
    static Instant timestamp(String value) throws VaultFailure {
        try {
            if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z")) throw invalid();
            Instant parsed = Instant.parse(value);
            if (!new DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(parsed).equals(value)) throw invalid();
            return parsed;
        } catch (Exception error) { throw invalid(); }
    }
    private static String uuid(String value) throws VaultFailure {
        if (value == null || !value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw invalid(); return value;
    }
    private static String digest(String value) throws VaultFailure {
        if (value == null || !value.matches("[0-9a-f]{64}")) throw invalid(); return value;
    }
    private static long positiveInteger(String value) throws VaultFailure {
        try {
            if (!value.matches("[1-9][0-9]{0,15}")) throw invalid(); long result = Long.parseLong(value);
            if (result > 9007199254740991L) throw invalid(); return result;
        } catch (Exception error) { throw invalid(); }
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_payload_invalid"); }
}
