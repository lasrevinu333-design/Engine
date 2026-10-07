package org.memphiszoo.custodial.vault;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Converts a server-issued snapshot time into a native monotonic work clock.
 * Wall time is intentionally never read here: changing Android's clock cannot
 * alter a signed work timestamp after the snapshot has been anchored.
 */
final class OfflineAuthorityTime {
    private static final long MAX_OCCURRENCE_DURATION_MS = 24L * 60L * 60L * 1000L;
    private final OfflineAuthorityTimeStore store;
    private final MonotonicClock clock;

    OfflineAuthorityTime(OfflineAuthorityTimeStore store, MonotonicClock clock) {
        this.store = store;
        this.clock = clock;
    }

    synchronized void acceptSnapshot(String deviceId, String snapshotId, String generatedAt, String expiresAt) throws VaultFailure {
        acceptSnapshot(deviceId, snapshotId, generatedAt, expiresAt, "");
    }

    synchronized void acceptSnapshot(
        String deviceId,
        String snapshotId,
        String generatedAt,
        String expiresAt,
        String snapshotJson
    ) throws VaultFailure {
        store.requireWorkAdmission();
        MonotonicPoint now = currentPoint();
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String canonicalSnapshot = canonicalSnapshotId(snapshotId);
        String canonicalGenerated = exactTimestamp(generatedAt);
        String canonicalExpiry = exactTimestamp(expiresAt);
        long generatedMillis = VaultTimestamps.epochMillis(canonicalGenerated, "custodial_native_offline_anchor_refused");
        long expiryMillis = VaultTimestamps.epochMillis(canonicalExpiry, "custodial_native_offline_anchor_refused");
        if (expiryMillis <= generatedMillis) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        String exactSnapshotJson = snapshotJson == null ? "" : snapshotJson;
        if (exactSnapshotJson.length() > 65_536) throw new VaultFailure("custodial_native_offline_anchor_refused");
        long monotonicBaseMillis = generatedMillis;
        OfflineAuthorityAnchor existing;
        try {
            existing = store.loadAnchor();
        } catch (VaultFailure firstFailure) {
            if (!"custodial_native_offline_anchor_refused".equals(firstFailure.code)) throw firstFailure;
            try {
                // A transient AndroidKeyStore or preferences read must not trigger
                // recovery. Require the same protected record to fail twice.
                existing = store.loadAnchor();
            } catch (VaultFailure repeatedFailure) {
                if (!"custodial_native_offline_anchor_refused".equals(repeatedFailure.code)
                    || store.hasOccurrences()
                    || store.loadRollbackFence() != null
                    || !store.preserveUnreadableAuthorityAnchor(canonicalDevice, canonicalGenerated)) {
                    throw repeatedFailure;
                }
                // The unreadable encrypted record is now preserved byte-for-byte.
                // The authenticated server snapshot may replace only the cache;
                // protected work and rollback state were proven empty above.
                existing = null;
            }
        }
        if (existing != null) {
            boolean identical = existing.deviceId.equals(canonicalDevice)
                && existing.snapshotId.equals(canonicalSnapshot)
                && existing.generatedAt.equals(canonicalGenerated)
                && existing.expiresAt.equals(canonicalExpiry)
                && existing.snapshotJson.equals(exactSnapshotJson);
            if (identical) {
                if (existing.bootCount != now.bootCount) {
                    throw new VaultFailure("custodial_native_offline_anchor_refused");
                }
                timestampAt(existing, now.elapsedRealtimeMillis);
                store.requireWorkAdmission();
                return;
            }
            boolean fullSnapshotUpgrade = existing.deviceId.equals(canonicalDevice)
                && existing.snapshotId.equals(canonicalSnapshot)
                && existing.generatedAt.equals(canonicalGenerated)
                && existing.expiresAt.equals(canonicalExpiry)
                && existing.snapshotJson.isEmpty()
                && !exactSnapshotJson.isEmpty();
            if (fullSnapshotUpgrade) {
                store.saveAnchor(new OfflineAuthorityAnchor(
                    existing.deviceId,
                    existing.snapshotId,
                    existing.generatedAt,
                    existing.expiresAt,
                    existing.clockBaseAt,
                    existing.anchorElapsedRealtimeMillis,
                    existing.bootCount,
                    false,
                    exactSnapshotJson
                ));
                store.requireWorkAdmission();
                return;
            }
            if (generatedMillis
                <= VaultTimestamps.epochMillis(existing.generatedAt, "custodial_native_offline_anchor_refused")) {
                throw new VaultFailure("custodial_native_offline_anchor_refused");
            }
            if (existing.bootCount != now.bootCount) {
                // elapsedRealtime cannot bridge a reboot. A newer authenticated
                // server snapshot may establish the new boot's monotonic base,
                // but never while protected work or a rollback fence survives.
                if (store.hasOccurrences() || store.loadRollbackFence() != null) {
                    throw new VaultFailure("custodial_native_offline_anchor_refused");
                }
                monotonicBaseMillis = generatedMillis;
            } else {
                if (now.elapsedRealtimeMillis < existing.anchorElapsedRealtimeMillis) {
                    throw new VaultFailure("custodial_native_offline_anchor_refused");
                }
                monotonicBaseMillis = Math.max(
                    generatedMillis,
                    derivedTimestampMillis(existing.clockBaseAt, existing.anchorElapsedRealtimeMillis, now.elapsedRealtimeMillis)
                );
            }
        }
        if (monotonicBaseMillis > expiryMillis) throw new VaultFailure("custodial_native_offline_anchor_expired");
        store.saveAnchor(new OfflineAuthorityAnchor(
            canonicalDevice,
            canonicalSnapshot,
            canonicalGenerated,
            canonicalExpiry,
            VaultTimestamps.fromEpochMillisExact(monotonicBaseMillis),
            now.elapsedRealtimeMillis,
            now.bootCount,
            false,
            exactSnapshotJson
        ));
        store.requireWorkAdmission();
    }

    synchronized String loadSnapshotJson(String deviceId) throws VaultFailure {
        OfflineAuthorityAnchor anchor = store.loadAnchor();
        if (anchor == null || !anchor.deviceId.equals(VaultValidation.deviceId(deviceId))) return "";
        return anchor.snapshotJson;
    }

    /** Retired provider-only point adapter. Cleaning anchor never grants provider
     * time authority; preserve native counters as unknown ingress evidence only.
     * All cleaning/NFC authority methods below remain unchanged. */
    synchronized NativeProviderJournal.Observation providerObservation(String deviceId) throws VaultFailure {
        VaultValidation.deviceId(deviceId);
        long elapsed; int boot;
        try { elapsed = clock.now(); } catch (RuntimeException unavailable) { elapsed = -1; }
        try { boot = clock.bootCount(); } catch (RuntimeException unavailable) { boot = -1; }
        // Missing clock observations can be retained honestly in quarantine. They never derive a time.
        MonotonicPoint now = new MonotonicPoint(Math.max(-1, elapsed), Math.max(-1, boot));
        return new NativeProviderJournal.Observation(null, now.elapsedRealtimeMillis, now.bootCount);
    }

    synchronized void authorizeNewWork(String deviceId, String snapshotId) throws VaultFailure {
        store.requireWorkAdmission();
        if (store.loadRollbackFence() != null) throw new VaultFailure("custodial_native_rollback_fence_active");
        MonotonicPoint now = currentPoint();
        OfflineAuthorityAnchor anchor = requireMatchingAnchor(
            VaultValidation.deviceId(deviceId),
            canonicalSnapshotId(snapshotId),
            now
        );
        if (store.hasUnfinishedOccurrences()) throw new VaultFailure("custodial_native_queue_admission_refused");
        if (!anchor.newWorkAuthorized) store.saveAnchor(anchor.withNewWorkAuthorized(true));
        store.requireWorkAdmission();
    }

    synchronized boolean hasOccurrencesAwaitingAcknowledgement() throws VaultFailure {
        return store.hasOccurrences();
    }

    /** Same existing CLEANING clock, but a frozen read-only store. No provider
     * clock/profile authority and no anchor/authorization/occurrence mutation. */
    OfflineAuthorityTime readOnlyView(OfflineAuthorityTimeStore frozen) {
        return new OfflineAuthorityTime(frozen, clock);
    }

    synchronized Map<String,Object> observeReadiness(String deviceId, org.json.JSONObject principal) throws VaultFailure {
        Map<String,Object> result = new java.util.LinkedHashMap<>();
        try {
            String device = VaultValidation.deviceId(deviceId);
            result.put("pending_occurrences", store.hasOccurrences());
            result.put("unfinished_occurrence", store.hasUnfinishedOccurrences());
            result.put("rollback_fence_active", store.loadRollbackFence() != null);
            result.put("protected_work_admission", "UNKNOWN");
            store.requireWorkAdmission();
            result.put("protected_work_admission", Boolean.TRUE.equals(result.get("pending_occurrences")) ? "PENDING" : "CLEAR");
            if (!store.loadScanJournalQuarantine().isEmpty()) return readiness(result, "DO_NOT_USE", "scan_journal_recovery_required", "UNVERIFIED");
            // Decode actual retained scans; never consume them or declare an
            // undecoded/nonempty pending native transition clear for a badge.
            boolean scanPending = !store.loadScanEntries().isEmpty();
            if (Boolean.TRUE.equals(result.get("rollback_fence_active"))) return readiness(result, "NEEDS_MANAGER", "rollback_fence_active", "UNVERIFIED");
            OfflineAuthorityAnchor anchor = store.loadAnchor();
            if (anchor == null) return readiness(result, "NEEDS_INTERNET", "anchor_missing", "UNVERIFIED");
            result.put("snapshot_id", anchor.snapshotId);
            if (!device.equals(anchor.deviceId) || anchor.snapshotJson.isEmpty()) return readiness(result, "NEEDS_INTERNET", "snapshot_binding_unverified", "UNVERIFIED");
            org.json.JSONObject snapshot = new org.json.JSONObject(anchor.snapshotJson);
            if (!"offline-scan-snapshot.v2".equals(snapshot.opt("schema_version"))
                || !"scan.v4.snapshot-bound-authority".equals(snapshot.opt("contract_version"))
                || !device.equals(snapshot.opt("canonical_device_id"))
                || !anchor.snapshotId.equals(snapshot.opt("snapshot_id")) || !anchor.generatedAt.equals(snapshot.opt("generated_at"))
                || !anchor.expiresAt.equals(snapshot.opt("expires_at"))) return readiness(result, "NEEDS_INTERNET", "snapshot_binding_unverified", "UNVERIFIED");
            for (String key : new String[]{"employee_id", "credential_id", "assignment_epoch"})
                if (!principal.get(key).equals(snapshot.opt(key))) return readiness(result, "NEEDS_INTERNET", "snapshot_principal_changed", "UNVERIFIED");
            int beforeBoot = clock.bootCount(); MonotonicPoint point = currentPoint();
            if (beforeBoot != point.bootCount) return readiness(result, "UNKNOWN", "clock_observation_changed", "UNVERIFIED");
            result.put("observed_boot_count", point.bootCount); result.put("observed_elapsed_realtime_ms", point.elapsedRealtimeMillis);
            requireMatchingAnchor(device, anchor.snapshotId, point); // Existing expiry/continuity rules; read only.
            if (Boolean.TRUE.equals(result.get("unfinished_occurrence"))) return readiness(result, "NEEDS_INTERNET", "original_finish_pending", "CONFIRMED");
            if (Boolean.TRUE.equals(result.get("pending_occurrences"))) return readiness(result, "NEEDS_INTERNET", "original_receipt_pending", "CONFIRMED");
            if (scanPending) return readiness(result, "UNKNOWN", "native_scan_pending", "CONFIRMED");
            return readiness(result, "CONFIRMED", "current_native_snapshot_observed", "CONFIRMED");
        } catch (VaultFailure error) {
            if ("custodial_native_offline_anchor_expired".equals(error.code)) return readiness(result, "NEEDS_INTERNET", "anchor_expired", "EXPIRED");
            if ("custodial_native_offline_anchor_continuity_changed".equals(error.code)) return readiness(result, "NEEDS_INTERNET", "clock_continuity_changed", "UNVERIFIED");
            if ("custodial_native_monotonic_clock_unavailable".equals(error.code)) return readiness(result, "UNKNOWN", "clock_unavailable", "UNVERIFIED");
            if ("custodial_native_protected_work_frozen".equals(error.code)) {
                result.put("protected_work_admission", "RECOVERY_REQUIRED");
                return readiness(result, "NEEDS_MANAGER", "protected_work_recovery_required", "UNVERIFIED");
            }
            return readiness(result, "UNKNOWN", "protected_state_unavailable", "UNVERIFIED");
        } catch (Exception error) { return readiness(result, "UNKNOWN", "protected_state_unavailable", "UNVERIFIED"); }
    }
    private static Map<String,Object> readiness(Map<String,Object> result, String observation, String reason, String clock) {
        result.put("observation", observation); result.put("reason", reason); result.put("native_clock_continuity", clock); return result;
    }

    synchronized RollbackFence beginRollbackFence(String deviceId) throws VaultFailure {
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        RollbackFence existing = store.loadRollbackFence();
        if (existing != null) {
            if (!existing.deviceId.equals(canonicalDevice)) throw new VaultFailure("custodial_native_rollback_fence_mismatch");
            if (store.hasOccurrences()) throw new VaultFailure("custodial_native_rollback_fence_refused");
            return existing;
        }
        if (store.hasOccurrences()) throw new VaultFailure("custodial_native_rollback_fence_refused");
        RollbackFence fence = new RollbackFence(canonicalDevice, UUID.randomUUID().toString());
        store.saveRollbackFence(fence);
        RollbackFence persisted = store.loadRollbackFence();
        if (persisted == null || !persisted.deviceId.equals(fence.deviceId) || !persisted.fenceId.equals(fence.fenceId)) {
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
        OfflineAuthorityAnchor anchor = store.loadAnchor();
        if (anchor != null && anchor.deviceId.equals(canonicalDevice) && anchor.newWorkAuthorized) {
            store.saveAnchor(anchor.withNewWorkAuthorized(false));
        }
        return fence;
    }

    synchronized void clearRollbackFence(String deviceId, String fenceId) throws VaultFailure {
        String canonicalDevice = VaultValidation.deviceId(deviceId);
        String exactFenceId = exactSessionId(fenceId);
        RollbackFence existing = store.loadRollbackFence();
        if (existing == null) return;
        if (!existing.deviceId.equals(canonicalDevice) || !existing.fenceId.equals(exactFenceId)) {
            throw new VaultFailure("custodial_native_rollback_fence_mismatch");
        }
        store.deleteRollbackFence();
        if (store.loadRollbackFence() != null) throw new VaultFailure("custodial_native_offline_time_persistence_failed");
    }

    synchronized RollbackFence rollbackFence() throws VaultFailure {
        return store.loadRollbackFence();
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
        return beginOccurrence(deviceId, locationCode, clientSessionId, snapshotId, nativeScanEntryId, verifiedNativeScanEntry, "", false);
    }

    synchronized String beginOccurrence(String deviceId, String locationCode, String clientSessionId,
        String snapshotId, String nativeScanEntryId, boolean verifiedNativeScanEntry, String identity) throws VaultFailure {
        return beginOccurrence(deviceId, locationCode, clientSessionId, snapshotId, nativeScanEntryId, verifiedNativeScanEntry, identity, true);
    }

    private String beginOccurrence(String deviceId, String locationCode, String clientSessionId,
        String snapshotId, String nativeScanEntryId, boolean verifiedNativeScanEntry, String identity, boolean strict) throws VaultFailure {
        store.requireWorkAdmission();
        if (store.loadRollbackFence() != null) throw new VaultFailure("custodial_native_rollback_fence_active");
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
            if (strict && verifiedNativeScanEntry && !existing.nativeTagIdentity.isEmpty()
                && !PhysicalNfcTagIdentity.sameObservedTag(existing.nativeTagIdentity, identity))
                throw new VaultFailure("custodial_native_tag_identity_mismatch");
            store.requireWorkAdmission();
            return existing.startedAt;
        }
        if (!verifiedNativeScanEntry) throw new VaultFailure("custodial_native_scan_entry_missing");
        if (strict) PhysicalNfcTagIdentity.require(identity);
        MonotonicPoint now = currentPoint();
        OfflineAuthorityAnchor anchor = requireMatchingAnchor(canonicalDevice, canonicalSnapshot, now);
        if (!anchor.newWorkAuthorized) throw new VaultFailure("custodial_native_queue_admission_refused");
        String startedAt = timestampAt(anchor, now.elapsedRealtimeMillis);
        store.saveAnchor(anchor.withNewWorkAuthorized(false));
        store.saveOccurrence(new OfflineOccurrence(
            exactSessionId,
            canonicalDevice,
            canonicalLocation,
            anchor.snapshotId,
            anchor.generatedAt,
            anchor.expiresAt,
            anchor.clockBaseAt,
            anchor.anchorElapsedRealtimeMillis,
            anchor.bootCount,
            exactNativeScanEntryId,
            startedAt,
            "",
            identity
        ));
        store.requireWorkAdmission();
        return startedAt;
    }

    /** A finished physical occurrence may await delivery without blocking a new job. */
    synchronized String completeOccurrenceFromScan(String deviceId, String locationCode,
        String sessionId, String startedAt, String finishEntryId, boolean verifiedEntry) throws VaultFailure {
        return completeOccurrenceFromScan(deviceId, locationCode, sessionId, startedAt, finishEntryId, verifiedEntry, "", false);
    }

    synchronized String completeOccurrenceFromScan(String deviceId, String locationCode,
        String sessionId, String startedAt, String finishEntryId, boolean verifiedEntry, String identity) throws VaultFailure {
        return completeOccurrenceFromScan(deviceId, locationCode, sessionId, startedAt, finishEntryId, verifiedEntry, identity, true);
    }

    synchronized void requireFinishTagOrPreservedProof(String sessionId, String entryId, String identity) throws VaultFailure {
        store.requireWorkAdmission();
        OfflineOccurrence occurrence = store.loadOccurrence(exactSessionId(sessionId));
        if (occurrence != null && !occurrence.completedAt.isEmpty()
            && exactSessionId(entryId).equals(store.loadFinishEntryId(occurrence))) return;
        requireMatchingObservedTag(sessionId, identity);
    }

    synchronized void requireMatchingObservedTag(String sessionId, String identity) throws VaultFailure {
        store.requireWorkAdmission();
        OfflineOccurrence occurrence = store.loadOccurrence(exactSessionId(sessionId));
        if (occurrence == null) throw new VaultFailure("custodial_native_offline_occurrence_missing");
        if (occurrence.nativeTagIdentity.isEmpty())
            throw new VaultFailure("custodial_native_tag_identity_legacy_pending");
        if (!PhysicalNfcTagIdentity.sameObservedTag(occurrence.nativeTagIdentity, PhysicalNfcTagIdentity.require(identity)))
            throw new VaultFailure("custodial_native_tag_identity_mismatch");
    }

    private String completeOccurrenceFromScan(String deviceId, String locationCode,
        String sessionId, String startedAt, String finishEntryId, boolean verifiedEntry, String identity, boolean strict) throws VaultFailure {
        store.requireWorkAdmission();
        String entry = exactSessionId(finishEntryId);
        OfflineOccurrence occurrence = store.loadOccurrence(exactSessionId(sessionId));
        if (occurrence == null || !occurrence.deviceId.equals(VaultValidation.deviceId(deviceId))
            || !occurrence.locationCode.equals(canonicalLocationCode(locationCode))
            || !occurrence.startedAt.equals(exactTimestamp(startedAt))) {
            throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
        }
        String preserved = store.loadFinishEntryId(occurrence);
        if (!preserved.isEmpty()) {
            if (!preserved.equals(entry) || occurrence.completedAt.isEmpty())
                throw new VaultFailure("custodial_native_offline_occurrence_mismatch");
            store.requireWorkAdmission();
            return occurrence.completedAt;
        }
        if (!verifiedEntry) throw new VaultFailure("custodial_native_scan_entry_missing");
        if (strict || !occurrence.nativeTagIdentity.isEmpty()) requireMatchingObservedTag(sessionId, identity);
        String ended = completeOccurrence(deviceId, locationCode, sessionId, startedAt);
        occurrence = store.loadOccurrence(sessionId);
        store.saveFinishEntryId(occurrence, entry);
        if (!entry.equals(store.loadFinishEntryId(occurrence)))
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        store.requireWorkAdmission();
        return ended;
    }

    synchronized String completeOccurrence(
        String deviceId,
        String locationCode,
        String clientSessionId,
        String startedAt
    ) throws VaultFailure {
        store.requireWorkAdmission();
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
        if (!occurrence.completedAt.isEmpty()) {
            store.requireWorkAdmission();
            return occurrence.completedAt;
        }
        MonotonicPoint now = currentPoint();
        if (now.bootCount != occurrence.bootCount || now.elapsedRealtimeMillis < occurrence.anchorElapsedRealtimeMillis) {
            // Preserve the durable occurrence. A manager can reconcile it, but
            // this device must never manufacture a post-reboot completion time.
            throw new VaultFailure("custodial_native_completion_recovery_required");
        }
        long completedMillis = derivedTimestampMillis(
            occurrence.clockBaseAt,
            occurrence.anchorElapsedRealtimeMillis,
            now.elapsedRealtimeMillis
        );
        String completedAt = VaultTimestamps.fromEpochMillisExact(completedMillis);
        if (VaultTimestamps.compareInstants(completedAt, occurrence.startedAt, "custodial_native_completion_recovery_required") < 0
            || VaultTimestamps.exceedsDuration(occurrence.startedAt, completedAt, MAX_OCCURRENCE_DURATION_MS,
                "custodial_native_completion_recovery_required")) {
            throw new VaultFailure("custodial_native_completion_recovery_required");
        }
        OfflineOccurrence completed = occurrence.withCompletedAt(completedAt);
        store.saveOccurrence(completed);
        store.requireWorkAdmission();
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
            || !anchor.snapshotId.equals(snapshotId)) {
            throw new VaultFailure("custodial_native_offline_anchor_refused");
        }
        if(anchor.bootCount != now.bootCount || now.elapsedRealtimeMillis < anchor.anchorElapsedRealtimeMillis)
            throw new VaultFailure("custodial_native_offline_anchor_continuity_changed");
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
            anchor.clockBaseAt,
            anchor.expiresAt,
            anchor.anchorElapsedRealtimeMillis,
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
            long timestamp = derivedTimestampMillis(generatedAt, anchorElapsed, currentElapsed);
            if (VaultTimestamps.compareEpochMillisToInstant(timestamp, expiresAt, "custodial_native_offline_anchor_refused") > 0) {
                throw new VaultFailure("custodial_native_offline_anchor_expired");
            }
            return VaultTimestamps.fromEpochMillisExact(timestamp);
        } catch (ArithmeticException error) {
            throw new VaultFailure("custodial_native_offline_anchor_refused", error);
        }
    }

    private static long derivedTimestampMillis(
        String clockBaseAt,
        long anchorElapsed,
        long currentElapsed
    ) throws VaultFailure {
        if (currentElapsed < anchorElapsed) throw new VaultFailure("custodial_native_offline_anchor_refused");
        try {
            return Math.addExact(
                VaultTimestamps.epochMillis(clockBaseAt, "custodial_native_offline_anchor_refused"),
                Math.subtractExact(currentElapsed, anchorElapsed)
            );
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

    interface OfflineAuthorityTimeStore extends NativeCompletionJournal.Store {
        /** Production durable adapters must fence cached successes as well as writes. */
        default void requireWorkAdmission() throws VaultFailure {}
        default String loadCompletionReceipt(String key) throws VaultFailure { return null; }
        default void saveCompletionReceipt(String key, String value) throws VaultFailure { throw new VaultFailure(NativeCompletionJournal.FAILURE); }
        default void deleteCompletionReceipt(String key) throws VaultFailure { throw new VaultFailure(NativeCompletionJournal.FAILURE); }
        OfflineAuthorityAnchor loadAnchor() throws VaultFailure;
        void saveAnchor(OfflineAuthorityAnchor anchor) throws VaultFailure;
        OfflineOccurrence loadOccurrence(String clientSessionId) throws VaultFailure;
        void saveOccurrence(OfflineOccurrence occurrence) throws VaultFailure;
        void deleteOccurrence(String clientSessionId) throws VaultFailure;
        default RollbackFence loadRollbackFence() throws VaultFailure { return null; }
        default void saveRollbackFence(RollbackFence fence) throws VaultFailure {}
        default void deleteRollbackFence() throws VaultFailure {}
        default boolean hasOccurrences() throws VaultFailure { return false; }
        default boolean hasUnfinishedOccurrences() throws VaultFailure { return hasOccurrences(); }
        default String loadFinishEntryId(OfflineOccurrence occurrence) throws VaultFailure { return ""; }
        default void saveFinishEntryId(OfflineOccurrence occurrence, String entryId) throws VaultFailure {
            throw new VaultFailure("custodial_native_offline_time_persistence_failed");
        }
        default boolean preserveUnreadableAuthorityAnchor(
            String deviceId,
            String preservedAt
        ) throws VaultFailure { return false; }
        default Map<String, Map<String, Object>> loadScanEntries() throws VaultFailure {
            return java.util.Collections.emptyMap();
        }
        default void saveScanEntries(Map<String, Map<String, Object>> entries) throws VaultFailure {}
        default Map<String, Object> preserveUnreadableScanJournal(String reason) throws VaultFailure {
            return java.util.Collections.emptyMap();
        }
        default Map<String, Object> loadScanJournalQuarantine() throws VaultFailure {
            return java.util.Collections.emptyMap();
        }
        default Map<String, Object> resolvePreservedScanJournal(
            String managerRecoveryOperationId,
            String deviceId,
            String managerRecoveryEnrolledAt
        ) throws VaultFailure {
            return java.util.Collections.emptyMap();
        }
        default Map<String, Object> loadLatestScanJournalDisposition() throws VaultFailure {
            return java.util.Collections.emptyMap();
        }
    }

    static final class RollbackFence {
        final String deviceId;
        final String fenceId;

        RollbackFence(String deviceId, String fenceId) {
            this.deviceId = deviceId;
            this.fenceId = fenceId;
        }
    }

    static final class OfflineAuthorityAnchor {
        final String deviceId;
        final String snapshotId;
        final String generatedAt;
        final String expiresAt;
        final String clockBaseAt;
        final long anchorElapsedRealtimeMillis;
        final int bootCount;
        final boolean newWorkAuthorized;
        final String snapshotJson;

        OfflineAuthorityAnchor(
            String deviceId,
            String snapshotId,
            String generatedAt,
            String expiresAt,
            String clockBaseAt,
            long anchorElapsedRealtimeMillis,
            int bootCount,
            boolean newWorkAuthorized,
            String snapshotJson
        ) {
            this.deviceId = deviceId;
            this.snapshotId = snapshotId;
            this.generatedAt = generatedAt;
            this.expiresAt = expiresAt;
            this.clockBaseAt = clockBaseAt;
            this.anchorElapsedRealtimeMillis = anchorElapsedRealtimeMillis;
            this.bootCount = bootCount;
            this.newWorkAuthorized = newWorkAuthorized;
            this.snapshotJson = snapshotJson;
        }

        OfflineAuthorityAnchor withNewWorkAuthorized(boolean value) {
            return new OfflineAuthorityAnchor(
                deviceId,
                snapshotId,
                generatedAt,
                expiresAt,
                clockBaseAt,
                anchorElapsedRealtimeMillis,
                bootCount,
                value,
                snapshotJson
            );
        }
    }

    static final class OfflineOccurrence {
        final String clientSessionId;
        final String deviceId;
        final String locationCode;
        final String snapshotId;
        final String generatedAt;
        final String expiresAt;
        final String clockBaseAt;
        final long anchorElapsedRealtimeMillis;
        final int bootCount;
        final String nativeScanEntryId;
        final String startedAt;
        final String completedAt;
        final String nativeTagIdentity;

        OfflineOccurrence(
            String clientSessionId,
            String deviceId,
            String locationCode,
            String snapshotId,
            String generatedAt,
            String expiresAt,
            String clockBaseAt,
            long anchorElapsedRealtimeMillis,
            int bootCount,
            String nativeScanEntryId,
            String startedAt,
            String completedAt
        ) {
            this(clientSessionId, deviceId, locationCode, snapshotId, generatedAt, expiresAt, clockBaseAt,
                anchorElapsedRealtimeMillis, bootCount, nativeScanEntryId, startedAt, completedAt, "");
        }

        OfflineOccurrence(String clientSessionId, String deviceId, String locationCode, String snapshotId,
            String generatedAt, String expiresAt, String clockBaseAt, long anchorElapsedRealtimeMillis,
            int bootCount, String nativeScanEntryId, String startedAt, String completedAt, String nativeTagIdentity) {
            this.nativeTagIdentity = nativeTagIdentity;
            this.clientSessionId = clientSessionId;
            this.deviceId = deviceId;
            this.locationCode = locationCode;
            this.snapshotId = snapshotId;
            this.generatedAt = generatedAt;
            this.expiresAt = expiresAt;
            this.clockBaseAt = clockBaseAt;
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
                clockBaseAt,
                anchorElapsedRealtimeMillis,
                bootCount,
                nativeScanEntryId,
                startedAt,
                value,
                nativeTagIdentity
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
