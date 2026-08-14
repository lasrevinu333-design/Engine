package org.memphiszoo.custodial.vault;

import java.util.Locale;
import java.util.UUID;

/**
 * Converts a server-issued snapshot time into a native monotonic work clock.
 * Wall time is intentionally never read here: changing Android's clock cannot
 * alter a signed work timestamp after the snapshot has been anchored.
 */
final class OfflineAuthorityTime {
    private final OfflineAuthorityTimeStore store;
    private final MonotonicClock clock;

    OfflineAuthorityTime(OfflineAuthorityTimeStore store, MonotonicClock clock) {
        this.store = store;
        this.clock = clock;
    }

    synchronized void acceptSnapshot(String deviceId, String snapshotId, String generatedAt, String expiresAt) throws VaultFailure {
        MonotonicPoint now = currentPoint();
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String canonicalSnapshot = canonicalSnapshotId(snapshotId);
        String canonicalGenerated = exactTimestamp(generatedAt);
        String canonicalExpiry = exactTimestamp(expiresAt);
        if (VaultTimestamps.epochMillis(canonicalExpiry, "custodial_native_offline_anchor_refused")
            <= VaultTimestamps.epochMillis(canonicalGenerated, "custodial_native_offline_anchor_refused")) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        OfflineAuthorityAnchor existing = store.loadAnchor();
        if (existing != null) {
            boolean identical = existing.deviceId.equals(canonicalDevice)
                && existing.snapshotId.equals(canonicalSnapshot)
                && existing.generatedAt.equals(canonicalGenerated)
                && existing.expiresAt.equals(canonicalExpiry);
            if (identical) {
                if (existing.bootCount != now.bootCount) {
                    throw new VaultFailure("custodial_native_offline_anchor_refused");
                }
                timestampAt(existing, now.elapsedRealtimeMillis);
                return;
            }
            if (VaultTimestamps.epochMillis(canonicalGenerated, "custodial_native_offline_anchor_refused")
                <= VaultTimestamps.epochMillis(existing.generatedAt, "custodial_native_offline_anchor_refused")) {
                throw new VaultFailure("custodial_native_offline_anchor_refused");
            }
        }
        store.saveAnchor(new OfflineAuthorityAnchor(
            canonicalDevice,
            canonicalSnapshot,
            canonicalGenerated,
            canonicalExpiry,
            now.elapsedRealtimeMillis,
            now.bootCount
        ));
    }

    synchronized String beginOccurrence(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId
    ) throws VaultFailure {
        return beginOccurrence(deviceId, locationCode, clientSessionId, snapshotId, "", true);
    }

    synchronized String beginOccurrence(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String snapshotId,
        String nativeScanEntryId,
        boolean verifiedNativeScanEntry
    ) throws VaultFailure {
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String canonicalLocation = canonicalLocationCode(locationCode);
        String exactSessionId = exactSessionId(clientSessionId);
        String canonicalSnapshot = canonicalSnapshotId(snapshotId);
        String exactNativeScanEntryId = nativeScanEntryId.isEmpty() ? "" : exactSessionId(nativeScanEntryId);
        OfflineOccurrence existing = store.loadOccurrence(exactSessionId);
        if (existing != null) {
            if (!existing.deviceId.equals(canonicalDevice)
                || !existing.locationCode.equals(canonicalLocation)
                || !existing.snapshotId.equals(canonicalSnapshot)
                || !existing.nativeScanEntryId.equals(exactNativeScanEntryId)) {
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            }
            return existing.startedAt;
        }
        if (!verifiedNativeScanEntry) throw new VaultFailure("custodial_native_scan_entry_missing");
        MonotonicPoint now = currentPoint();
        OfflineAuthorityAnchor anchor = requireMatchingAnchor(canonicalDevice, canonicalSnapshot, now);
        String startedAt = timestampAt(anchor, now.elapsedRealtimeMillis);
        store.saveOccurrence(new OfflineOccurrence(
            exactSessionId,
            canonicalDevice,
            canonicalLocation,
            anchor.snapshotId,
            anchor.generatedAt,
            anchor.expiresAt,
            anchor.anchorElapsedRealtimeMillis,
            anchor.bootCount,
            exactNativeScanEntryId,
            startedAt,
            ""
        ));
        return startedAt;
    }

    synchronized String completeOccurrence(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String startedAt
    ) throws VaultFailure {
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String canonicalLocation = canonicalLocationCode(locationCode);
        String exactSessionId = exactSessionId(clientSessionId);
        OfflineOccurrence occurrence = store.loadOccurrence(exactSessionId);
        if (occurrence == null) throw new VaultFailure("custodial_native_offline_occurrence_missing");
        if (!occurrence.deviceId.equals(canonicalDevice)
            || !occurrence.locationCode.equals(canonicalLocation)
            || !occurrence.startedAt.equals(exactTimestamp(startedAt))) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        if (!occurrence.completedAt.isEmpty()) return occurrence.completedAt;
        MonotonicPoint now = currentPoint();
        if (now.bootCount != occurrence.bootCount || now.elapsedRealtimeMillis < occurrence.anchorElapsedRealtimeMillis) {
            // Preserve the durable occurrence. A manager can reconcile it, but
            // this device must never manufacture a post-reboot completion time.
            throw new VaultFailure("custodial_native_completion_recovery_required");
        }
        String completedAt = timestampAt(occurrence, now.elapsedRealtimeMillis);
        if (VaultTimestamps.epochMillis(completedAt, "custodial_native_completion_recovery_required")
            < VaultTimestamps.epochMillis(occurrence.startedAt, "custodial_native_completion_recovery_required")) {
            throw new VaultFailure("custodial_native_completion_recovery_required");
        }
        OfflineOccurrence completed = occurrence.withCompletedAt(completedAt);
        store.saveOccurrence(completed);
        return completedAt;
    }

    synchronized void acknowledgeCompletedOccurrence(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String startedAt,
        String completedAt
    ) throws VaultFailure {
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String canonicalLocation = canonicalLocationCode(locationCode);
        String exactSessionId = exactSessionId(clientSessionId);
        OfflineOccurrence occurrence = store.loadOccurrence(exactSessionId);
        if (occurrence == null) return;
        if (!occurrence.deviceId.equals(canonicalDevice)
            || !occurrence.locationCode.equals(canonicalLocation)
            || !occurrence.startedAt.equals(exactTimestamp(startedAt))
            || occurrence.completedAt.isEmpty()
            || !occurrence.completedAt.equals(exactTimestamp(completedAt))) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        store.deleteOccurrence(exactSessionId);
        if (store.loadOccurrence(exactSessionId) != null) {
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
    }

    private OfflineAuthorityAnchor requireMatchingAnchor(
        String deviceId,
        String snapshotId,
        MonotonicPoint now
    ) throws VaultFailure {
        OfflineAuthorityAnchor anchor = store.loadAnchor();
        if (anchor == null
            || !anchor.deviceId.equals(deviceId)
            || !anchor.snapshotId.equals(snapshotId)
            || anchor.bootCount != now.bootCount
            || now.elapsedRealtimeMillis < anchor.anchorElapsedRealtimeMillis) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        timestampAt(anchor, now.elapsedRealtimeMillis);
        return anchor;
    }

    private MonotonicPoint currentPoint() throws VaultFailure {
        long elapsed = clock.now();
        int bootCount = clock.bootCount();
        if (elapsed < 0L || bootCount < 0) throw new VaultFailure("custodial_native_monotonic_clock_unavailable");
        return new MonotonicPoint(elapsed, bootCount);
    }

    private static String timestampAt(OfflineAuthorityAnchor anchor, long currentElapsed) throws VaultFailure {
        return timestampAt(
            anchor.generatedAt,
            anchor.expiresAt,
            anchor.anchorElapsedRealtimeMillis,
            currentElapsed
        );
    }

    private static String timestampAt(OfflineOccurrence occurrence, long currentElapsed) throws VaultFailure {
        return timestampAt(
            occurrence.generatedAt,
            occurrence.expiresAt,
            occurrence.anchorElapsedRealtimeMillis,
            currentElapsed
        );
    }

    private static String timestampAt(
        String generatedAt,
        String expiresAt,
        long anchorElapsed,
        long currentElapsed
    ) throws VaultFailure {
        if (currentElapsed < anchorElapsed) throw new VaultFailure("custodial_native_offline_anchor_refused");
        try {
            long delta = Math.subtractExact(currentElapsed, anchorElapsed);
            long timestamp = Math.addExact(
                VaultTimestamps.epochMillis(generatedAt, "custodial_native_offline_anchor_refused"),
                delta
            );
            if (timestamp > VaultTimestamps.epochMillis(expiresAt, "custodial_native_offline_anchor_refused")) {
                throw new VaultFailure("custodial_native_offline_anchor_expired");
            }
            return VaultTimestamps.fromEpochMillisExact(timestamp);
        } catch (ArithmeticException error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    private static String exactTimestamp(String value) throws VaultFailure {
        String candidate = value == null ? "" : value;
        if (!candidate.matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$")) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        VaultTimestamps.epochMillis(candidate, "custodial_native_offline_anchor_refused");
        return candidate;
    }

    private static String canonicalSnapshotId(String value) throws VaultFailure {
        String candidate = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (!candidate.matches("[0-9a-f]{64}")) throw new VaultFailure("custodial_native_offline_anchor_refused");
        return candidate;
    }

    private static String exactSessionId(String value) throws VaultFailure {
        String candidate = value == null ? "" : value;
        try {
            UUID.fromString(candidate);
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch", error);
        }
        if (candidate.indexOf('\r') >= 0 || candidate.indexOf('\n') >= 0 || candidate.indexOf('\0') >= 0) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        return candidate;
    }

    private static String canonicalLocationCode(String value) throws VaultFailure {
        String candidate = String.valueOf(value).trim().toUpperCase(Locale.ROOT);
        if (candidate.equals("TETON") || candidate.equals("TETON_EXHIBIT")) return "TETX";
        if (candidate.equals("TETON_RR") || candidate.equals("TETON_RESTROOMS")
            || candidate.equals("TETON_MENS") || candidate.equals("TETON_MEN")
            || candidate.equals("TETON_MENS_RESTROOM") || candidate.equals("TETON_MENS_RESTROOMS")
            || candidate.equals("TETON_MEN_RESTROOM") || candidate.equals("TETON_MEN_RESTROOMS")) return "TETM";
        if (!candidate.matches("[A-Z0-9._:-]{1,100}")) {
            throw new VaultFailure("custodial_native_attestation_location_refused");
        }
        return candidate;
    }

    interface MonotonicClock {
        long now();
        int bootCount();
    }

    interface OfflineAuthorityTimeStore {
        OfflineAuthorityAnchor loadAnchor() throws VaultFailure;
        void saveAnchor(OfflineAuthorityAnchor anchor) throws VaultFailure;
        OfflineOccurrence loadOccurrence(String clientSessionId) throws VaultFailure;
        void saveOccurrence(OfflineOccurrence occurrence) throws VaultFailure;
        void deleteOccurrence(String clientSessionId) throws VaultFailure;
    }

    static final class OfflineAuthorityAnchor {
        final String deviceId;
        final String snapshotId;
        final String generatedAt;
        final String expiresAt;
        final long anchorElapsedRealtimeMillis;
        final int bootCount;

        OfflineAuthorityAnchor(
            String deviceId,
            String snapshotId,
            String generatedAt,
            String expiresAt,
            long anchorElapsedRealtimeMillis,
            int bootCount
        ) {
            this.deviceId = deviceId;
            this.snapshotId = snapshotId;
            this.generatedAt = generatedAt;
            this.expiresAt = expiresAt;
            this.anchorElapsedRealtimeMillis = anchorElapsedRealtimeMillis;
            this.bootCount = bootCount;
        }
    }

    static final class OfflineOccurrence {
        final String clientSessionId;
        final String deviceId;
        final String locationCode;
        final String snapshotId;
        final String generatedAt;
        final String expiresAt;
        final long anchorElapsedRealtimeMillis;
        final int bootCount;
        final String nativeScanEntryId;
        final String startedAt;
        final String completedAt;

        OfflineOccurrence(
            String clientSessionId,
            String deviceId,
            String locationCode,
            String snapshotId,
            String generatedAt,
            String expiresAt,
            long anchorElapsedRealtimeMillis,
            int bootCount,
            String nativeScanEntryId,
            String startedAt,
            String completedAt
        ) {
            this.clientSessionId = clientSessionId;
            this.deviceId = deviceId;
            this.locationCode = locationCode;
            this.snapshotId = snapshotId;
            this.generatedAt = generatedAt;
            this.expiresAt = expiresAt;
            this.anchorElapsedRealtimeMillis = anchorElapsedRealtimeMillis;
            this.bootCount = bootCount;
            this.nativeScanEntryId = nativeScanEntryId;
            this.startedAt = startedAt;
            this.completedAt = completedAt;
        }

        OfflineOccurrence withCompletedAt(String value) {
            return new OfflineOccurrence(
                clientSessionId,
                deviceId,
                locationCode,
                snapshotId,
                generatedAt,
                expiresAt,
                anchorElapsedRealtimeMillis,
                bootCount,
                nativeScanEntryId,
                startedAt,
                value
            );
        }
    }

    private static final class MonotonicPoint {
        final long elapsedRealtimeMillis;
        final int bootCount;

        MonotonicPoint(long elapsedRealtimeMillis, int bootCount) {
            this.elapsedRealtimeMillis = elapsedRealtimeMillis;
            this.bootCount = bootCount;
        }
    }
}
