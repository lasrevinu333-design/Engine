package org.memphiszoo.custodial.vault;

import org.json.JSONObject;

/** Exact interval wire shape only. Parsed timestamps never create a clock Bounds
 * capability or grant native effect/cleanup authority. No v1 point fallback. */
final class NativeProviderObservationWire {
    static void validate(JSONObject value, boolean requireBounds) throws Exception {
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
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_observation_invalid"); }
}
