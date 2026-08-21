package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Durable authority boundary between a physical ReaderCallback and WebView navigation.
 * The WebView receives only an opaque identifier; the original NFC URL never becomes
 * trusted merely because it arrived in an Android intent.
 */
public final class NativeNfcScanHandoff {
    public static final String QUERY_PARAMETER = "mz_nfc_handoff";
    private static final String TAG = "CustodialNfc";
    private static final String SCHEMA = "native-nfc-handoff.v1";
    private static final String PENDING = "pending";
    private static final String CLAIMED = "claimed";
    private static final long TTL_MS = 15L * 60L * 1000L;
    private static final int MAX_HANDOFFS = 4;
    private static final Object LOCK = new Object();

    private NativeNfcScanHandoff() {}

    /** Called only after ReaderCallback (or a live ACTION_NDEF_DISCOVERED Tag) reads NDEF. */
    public static String recordPhysicalRead(Context context, String url) {
        try {
            String handoffId = record(
                new AndroidOfflineAuthorityTimeStore(context),
                url,
                SystemClock.elapsedRealtime(),
                currentBootCount(context)
            );
            Log.i(TAG, "physical_read_persisted");
            return handoffId;
        } catch (VaultFailure | RuntimeException error) {
            Log.w(TAG, "physical_read_persistence_refused");
            return "";
        }
    }

    static Map<String, Object> claim(Context context, String handoffUrl) throws VaultFailure {
        String handoffId = handoffIdFromUrl(handoffUrl);
        Map<String, Object> record = require(
            new AndroidOfflineAuthorityTimeStore(context),
            handoffId,
            SystemClock.elapsedRealtime(),
            currentBootCount(context)
        );
        Log.i(TAG, CLAIMED.equals(record.get("state")) ? "handoff_claim_reused" : "handoff_claimed");
        return record;
    }

    static void markClaimed(Context context, String handoffId, String entryId) throws VaultFailure {
        markClaimed(
            new AndroidOfflineAuthorityTimeStore(context),
            handoffId,
            entryId,
            SystemClock.elapsedRealtime(),
            currentBootCount(context)
        );
        Log.i(TAG, "handoff_entry_persisted");
    }

    static String record(
        AndroidOfflineAuthorityTimeStore store,
        String url,
        long elapsed,
        int bootCount
    ) throws VaultFailure {
        String physicalUrl = String.valueOf(url == null ? "" : url).trim();
        if (physicalUrl.isEmpty() || physicalUrl.length() > 2048 || elapsed < 0L || bootCount < 0) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused");
        }
        final Uri parsed;
        try {
            parsed = Uri.parse(physicalUrl);
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
        if (parsed.getScheme() == null || !parsed.getQueryParameters(QUERY_PARAMETER).isEmpty()) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused");
        }
        String handoffId = UUID.randomUUID().toString();
        String entryId = UUID.randomUUID().toString();
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("schema_version", SCHEMA);
        record.put("handoff_id", handoffId);
        record.put("entry_id", entryId);
        record.put("url", physicalUrl);
        record.put("created_elapsed_ms", elapsed);
        record.put("expires_elapsed_ms", elapsed + TTL_MS);
        record.put("boot_count", bootCount);
        record.put("state", PENDING);
        synchronized (LOCK) {
            Map<String, Map<String, Object>> handoffs = store.loadNfcHandoffs();
            purgeInvalid(handoffs, elapsed, bootCount);
            if (handoffs.size() >= MAX_HANDOFFS) {
                Map.Entry<String, Map<String, Object>> oldestClaimed = handoffs.entrySet().stream()
                    .filter(entry -> CLAIMED.equals(entry.getValue().get("state")))
                    .min(java.util.Comparator
                        .comparingLong((Map.Entry<String, Map<String, Object>> entry) ->
                            number(entry.getValue().get("created_elapsed_ms")))
                        .thenComparing(Map.Entry::getKey))
                    .orElse(null);
                if (oldestClaimed == null || !handoffs.remove(oldestClaimed.getKey(), oldestClaimed.getValue())) {
                    throw new VaultFailure("custodial_native_nfc_handoff_capacity_reached");
                }
            }
            handoffs.put(handoffId, record);
            store.saveNfcHandoffs(handoffs);
        }
        return handoffId;
    }

    static Map<String, Object> require(
        AndroidOfflineAuthorityTimeStore store,
        String handoffId,
        long elapsed,
        int bootCount
    ) throws VaultFailure {
        synchronized (LOCK) {
            Map<String, Map<String, Object>> handoffs = store.loadNfcHandoffs();
            boolean changed = purgeInvalid(handoffs, elapsed, bootCount);
            if (changed) store.saveNfcHandoffs(handoffs);
            Map<String, Object> record = handoffs.get(canonicalUuid(handoffId));
            if (record == null) throw new VaultFailure("custodial_native_nfc_handoff_missing");
            return new LinkedHashMap<>(record);
        }
    }

    static void markClaimed(
        AndroidOfflineAuthorityTimeStore store,
        String handoffId,
        String entryId,
        long elapsed,
        int bootCount
    ) throws VaultFailure {
        synchronized (LOCK) {
            Map<String, Map<String, Object>> handoffs = store.loadNfcHandoffs();
            boolean changed = purgeInvalid(handoffs, elapsed, bootCount);
            Map<String, Object> record = handoffs.get(canonicalUuid(handoffId));
            if (record == null
                || !canonicalUuid(entryId).equals(record.get("entry_id"))
                || !List.of(PENDING, CLAIMED).contains(record.get("state"))) {
                throw new VaultFailure("custodial_native_nfc_handoff_refused");
            }
            if (!CLAIMED.equals(record.get("state"))) {
                record.put("state", CLAIMED);
                changed = true;
            }
            if (changed) store.saveNfcHandoffs(handoffs);
        }
    }

    static String handoffIdFromUrl(String value) throws VaultFailure {
        try {
            Uri parsed = Uri.parse(String.valueOf(value == null ? "" : value));
            List<String> values = parsed.getQueryParameters(QUERY_PARAMETER);
            if (values.size() != 1) throw new VaultFailure("custodial_native_nfc_handoff_refused");
            String handoffId = canonicalUuid(values.get(0));
            if (handoffId.isEmpty()) throw new VaultFailure("custodial_native_nfc_handoff_refused");
            return handoffId;
        } catch (VaultFailure error) {
            throw error;
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_nfc_handoff_refused", error);
        }
    }

    private static boolean purgeInvalid(
        Map<String, Map<String, Object>> handoffs,
        long elapsed,
        int bootCount
    ) {
        return handoffs.entrySet().removeIf(entry -> !valid(
            entry.getKey(), entry.getValue(), elapsed, bootCount
        ));
    }

    private static boolean valid(
        String handoffId,
        Map<String, Object> record,
        long elapsed,
        int bootCount
    ) {
        if (record == null || record.size() != 8) return false;
        long created = number(record.get("created_elapsed_ms"));
        long expires = number(record.get("expires_elapsed_ms"));
        return handoffId.equals(canonicalUuid(String.valueOf(record.get("handoff_id"))))
            && !canonicalUuid(String.valueOf(record.get("entry_id"))).isEmpty()
            && SCHEMA.equals(record.get("schema_version"))
            && !String.valueOf(record.get("url")).isEmpty()
            && created >= 0L
            && expires - created == TTL_MS
            && elapsed >= created
            && elapsed < expires
            && number(record.get("boot_count")) == bootCount
            && List.of(PENDING, CLAIMED).contains(record.get("state"));
    }

    private static int currentBootCount(Context context) throws VaultFailure {
        try {
            int value = Settings.Global.getInt(context.getContentResolver(), "boot_count", -1);
            if (value < 0) throw new VaultFailure("custodial_native_monotonic_clock_unavailable");
            return value;
        } catch (VaultFailure error) {
            throw error;
        } catch (RuntimeException error) {
            throw new VaultFailure("custodial_native_monotonic_clock_unavailable", error);
        }
    }

    private static String canonicalUuid(String value) {
        String normalized = String.valueOf(value == null ? "" : value).trim().toLowerCase(java.util.Locale.ROOT);
        try {
            return UUID.fromString(normalized).toString().equals(normalized) ? normalized : "";
        } catch (IllegalArgumentException error) {
            return "";
        }
    }

    private static long number(Object value) {
        return value instanceof Number ? ((Number) value).longValue() : -1L;
    }
}
