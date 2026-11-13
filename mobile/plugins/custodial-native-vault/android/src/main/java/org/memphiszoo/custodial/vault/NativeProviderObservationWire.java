package org.memphiszoo.custodial.vault;

import org.json.JSONObject;

/** Exact interval wire shape only. Parsed timestamps never create a clock Bounds
 * capability or grant native effect/cleanup authority. No v1 point fallback. */
final class NativeProviderObservationWire {
    static boolean bestEffort(JSONObject value) {
        return value != null && "custodial.provider-best-effort-observation.v1".equals(value.opt("schema"));
    }
    static void validate(JSONObject value, boolean requireBounds) throws Exception {
        if (bestEffort(value)) {
            NativeProviderClockExchange.exact(value, "schema", "estimated_at", "server_observed_at", "clock_policy_id", "elapsed_realtime_ms", "boot_count");
            long estimate = NativeProviderClockExchange.micros(value.get("estimated_at"));
            long floor = NativeProviderClockExchange.micros(value.get("server_observed_at"));
            if (estimate < floor || Math.subtractExact(estimate, floor) >= NativeProviderTime.MAX_HORIZON_US
                || !(value.get("clock_policy_id") instanceof String)
                || !value.getString("clock_policy_id").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) throw invalid();
            for (String field : new String[]{"elapsed_realtime_ms", "boot_count"}) {
                Object number = value.get(field);
                if (!(number instanceof Integer || number instanceof Long) || ((Number) number).longValue() < 0
                    || ((Number) number).longValue() > (field.equals("boot_count") ? Integer.MAX_VALUE : 9007199254740991L)) throw invalid();
            }
            return;
        }
        NativeProviderClockExchange.exact(value, "earliest_at", "latest_at", "clock_profile_id", "elapsed_realtime_ms", "boot_count");
        boolean unknown = value.get("earliest_at") == JSONObject.NULL;
        if (unknown != (value.get("latest_at") == JSONObject.NULL) || unknown != (value.get("clock_profile_id") == JSONObject.NULL)
            || (unknown && requireBounds)) throw invalid();
        for (String field : new String[]{"elapsed_realtime_ms", "boot_count"}) {
            Object number = value.get(field);
            if (number == JSONObject.NULL) { if (!unknown) throw invalid(); }
            else if (!(number instanceof Integer || number instanceof Long) || ((Number) number).longValue() < 0
                || ((Number) number).longValue() > (field.equals("boot_count") ? Integer.MAX_VALUE : 9007199254740991L)) throw invalid();
        }
        if (!unknown) {
            long earliest = NativeProviderClockExchange.micros(value.get("earliest_at"));
            long latest = NativeProviderClockExchange.micros(value.get("latest_at"));
            if (latest < earliest || !(value.get("clock_profile_id") instanceof String)
                || !value.getString("clock_profile_id").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) throw invalid();
        }
    }
    /** Wire structure has no authority. Best-effort estimates are never compared
     * to server receipt as a claimed UTC bound. Only the observed server time is. */
    static Long serverFloor(JSONObject value) throws Exception {
        validate(value, false);
        String field = bestEffort(value) ? "server_observed_at" : "earliest_at";
        return value.isNull(field) ? null : NativeProviderClockExchange.micros(value.get(field));
    }
    static long presentationFirst(JSONObject value) throws Exception {
        validate(value, true);
        return NativeProviderClockExchange.micros(value.get(bestEffort(value) ? "estimated_at" : "earliest_at"));
    }
    static long presentationLast(JSONObject value) throws Exception {
        validate(value, true);
        return NativeProviderClockExchange.micros(value.get(bestEffort(value) ? "estimated_at" : "latest_at"));
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_observation_invalid"); }
}
