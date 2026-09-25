package org.memphiszoo.custodial.vault;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;

/** One native process/Activity attachment owns opaque mirror capabilities. No persistent
 * callback survives detach/process death. Durable records/actions stay in the journal.
 * Runtime holds engine-before-provider coordinator before invoking these methods. */
final class NativeProviderClaims {
    static final class Claim {
        final String id;
        final NativeProviderJournal.Presentation presentation;
        private final String data;
        private boolean visuallyRetired;
        private Claim(NativeProviderJournal.Presentation presentation, NativeProviderJournal.Observation observation) throws Exception {
            this.presentation = presentation; id = UUID.randomUUID().toString(); JSONObject record = presentation.record();
            boolean historical = observation.authenticatedAt == null || observation.authenticatedAt.isBefore(presentation.payload.reservedAt)
                || !observation.authenticatedAt.isBefore(presentation.payload.validUntil);
            data = new JSONObject().put("claim_id", id).put("payload", presentation.payload.json())
                .put("play_audio", !"COMPLETED".equals(record.getString("audio_state")))
                .put("navigation_pending", record.getBoolean("navigation_pending")).put("historical", historical).toString();
        }
        JSONObject data() throws Exception { return new JSONObject(data); }
    }
    private final NativeProviderJournal journal;
    private final Map<String, Claim> claims = new LinkedHashMap<>();
    private Object attachment;
    NativeProviderClaims(NativeProviderJournal journal) { this.journal = journal; }
    /** The actual plugin supplies its private Java owner object, never a JS-provided ID. */
    synchronized void attach(Object owner) throws VaultFailure {
        if (owner == null) throw invalid(); if (attachment != owner) { claims.clear(); attachment = owner; }
    }
    synchronized void detach(Object owner) { if (attachment == owner) { claims.clear(); attachment = null; } }
    synchronized void invalidate() { claims.clear(); }
    synchronized Claim claimNext(Object owner, NativeProviderPrincipal current, NativeProviderJournal.Observation observation) throws VaultFailure {
        requireAttachment(owner);
        try {
            if (observation == null) throw invalid();
            // A stale prior attachment/identity callback can never revive if A later returns.
            for (java.util.Iterator<Claim> it = claims.values().iterator(); it.hasNext();) {
                Claim existing = it.next();
                try { journal.requirePresentationCurrent(current, existing.presentation); }
                catch (VaultFailure stale) {
                    if (!"custodial_provider_operation_stale".equals(stale.code) && !"custodial_provider_waiting_native_principal".equals(stale.code)
                        && !"custodial_provider_generation_refused".equals(stale.code)) throw stale;
                    it.remove();
                }
            }
            for (String recordId : journal.admittedRecordIds(current)) {
                boolean claimed = false;
                for (Claim existing : claims.values()) if (existing.presentation.payload.recordId.equals(recordId)) { claimed = true; break; }
                if (claimed) continue;
                NativeProviderJournal.Presentation presentation = journal.presentation(current, recordId); JSONObject record = presentation.record();
                boolean pendingNavigation = record.getBoolean("navigation_pending");
                if (!pendingNavigation && (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id")
                    || record.getBoolean("mirror_retire_pending") || (record.getBoolean("mirror_rendered") && "COMPLETED".equals(record.getString("audio_state"))))) continue;
                boolean live = observation.authenticatedAt != null && !observation.authenticatedAt.isBefore(presentation.payload.reservedAt)
                    && observation.authenticatedAt.isBefore(presentation.payload.validUntil);
                if (!live && !pendingNavigation) continue;
                if (claims.size() >= 256) throw new VaultFailure("custodial_provider_claim_capacity");
                Claim claim = new Claim(presentation, observation); claims.put(claim.id, claim); return claim;
            }
            return null;
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_claim_invalid", error); }
    }
    synchronized boolean isCurrent(Object owner, NativeProviderPrincipal current, String id) throws VaultFailure {
        requireAttachment(owner); Claim claim = claims.get(id); if (claim == null || claim.visuallyRetired) return false;
        journal.requirePresentationCurrent(current, claim.presentation); return true;
    }
    synchronized void apply(Object owner, NativeProviderPrincipal current, String id, String action,
        NativeProviderJournal.Observation observation) throws VaultFailure {
        requireAttachment(owner); Claim claim = claims.get(id);
        if (claim == null || (claim.visuallyRetired && !"audio_completed".equals(action))) throw invalid();
        journal.requirePresentationCurrent(current, claim.presentation);
        journal.applyPresentationAction(current, claim.presentation, action, observation);
        // Closing the visual card does not cancel its two-cycle audio. The one finite
        // completion callback retains no display/open/ack/navigation authority.
        if (claim.visuallyRetired && "audio_completed".equals(action)) claims.remove(id);
    }
    synchronized void retire(Object owner, NativeProviderPrincipal current, String id) throws VaultFailure {
        requireAttachment(owner); Claim claim = claims.get(id);
        if (claim != null) { journal.confirmMirrorRetired(current, claim.presentation); claim.visuallyRetired = true; }
    }
    private void requireAttachment(Object owner) throws VaultFailure { if (owner == null || owner != attachment) throw invalid(); }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_claim_invalid"); }
}
