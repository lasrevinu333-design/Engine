package org.memphiszoo.custodial.vault;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;

/** One native process/Activity attachment owns opaque mirror capabilities. No persistent
 * callback survives detach/process death. Durable records/actions stay in the journal.
 * Runtime holds engine-before-provider coordinator before invoking these methods. */
final class NativeProviderClaims {
    enum Freshness { CURRENT, HISTORICAL_EXPIRED, FRESHNESS_UNAVAILABLE, RETIRED }
    private static Freshness freshness(NativeProviderPayload payload, NativeProviderJournal.Observation observation) throws VaultFailure {
        if (observation == null || observation.bounds == null) return Freshness.FRESHNESS_UNAVAILABLE;
        if (NativeProviderTime.live(observation.bounds, payload.reservedAt, payload.validUntil)) return Freshness.CURRENT;
        return NativeProviderTime.reached(observation.bounds, payload.validUntil)
            ? Freshness.HISTORICAL_EXPIRED : Freshness.FRESHNESS_UNAVAILABLE;
    }
    /** No content/authority is returned; caller has already proved the exact old
     * capability and a definitive existing native principal/removal fence. */
    static JSONObject retiredState() throws VaultFailure {
        try { return new JSONObject().put("current",false).put("freshness",Freshness.RETIRED.name())
            .put("retire_visual",true).put("stop_audio",true).put("navigation_pending",false); }
        catch(Exception invalid){throw new VaultFailure("custodial_provider_claim_invalid",invalid);}
    }
    static final class Claim {
        final String id;
        final NativeProviderJournal.Presentation presentation;
        private final String data;
        private boolean visuallyRetired;
        private final boolean audioOffered;
        private boolean audioStarted, audioCompleted;
        private Claim(NativeProviderJournal.Presentation presentation, NativeProviderJournal.Observation observation) throws Exception {
            this.presentation = presentation; id = UUID.randomUUID().toString(); JSONObject record = presentation.record();
            boolean historical = !NativeProviderTime.live(observation.bounds, presentation.payload.reservedAt, presentation.payload.validUntil);
            audioOffered = !historical && "PENDING".equals(record.getString("audio_state"));
            data = new JSONObject().put("claim_id", id).put("payload", presentation.payload.json())
                .put("play_audio", audioOffered)
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
                try {
                    journal.requirePresentationCurrent(current, existing.presentation);
                    if(existing.audioOffered&&!existing.audioStarted&&!existing.audioCompleted
                        &&!NativeProviderTime.live(observation.bounds,existing.presentation.payload.reservedAt,existing.presentation.payload.validUntil))
                        existing.audioCompleted=true; // Retire unused capability, never alter persisted audio facts.
                }
                catch (VaultFailure stale) {
                    if (!"custodial_provider_operation_stale".equals(stale.code) && !"custodial_provider_waiting_native_principal".equals(stale.code)
                        && !"custodial_provider_generation_refused".equals(stale.code)) throw stale;
                    it.remove();
                }
            }
            // One offered/current audio capability at a time. Dismiss retires the
            // visual only; it cannot let another speech sequence overlap. A new
            // runtime's old IN_PROGRESS record is visual uncertainty, not replay.
            for (Claim existing : claims.values()) if (existing.audioOffered && !existing.audioCompleted) return null;
            for (String recordId : journal.admittedRecordIds(current)) {
                boolean claimed = false;
                for (Claim existing : claims.values()) if (existing.presentation.payload.recordId.equals(recordId)) { claimed = true; break; }
                if (claimed) continue;
                NativeProviderJournal.Presentation presentation = journal.presentation(current, recordId); JSONObject record = presentation.record();
                boolean pendingNavigation = record.getBoolean("navigation_pending");
                if (!pendingNavigation && (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id") || !record.isNull("opened_event_id")
                    || record.getBoolean("mirror_retire_pending"))) continue;
                boolean live = NativeProviderTime.live(observation.bounds, presentation.payload.reservedAt, presentation.payload.validUntil);
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
    synchronized void requireClaim(Object owner,String id) throws VaultFailure {
        requireAttachment(owner);if(!claims.containsKey(id))throw invalid();
    }
    synchronized JSONObject state(Object owner,NativeProviderPrincipal current,String id,NativeProviderJournal.Observation observation) throws VaultFailure {
        requireAttachment(owner);Claim claim=claims.get(id);if(claim==null)throw invalid();
        journal.requirePresentationCurrent(current,claim.presentation);
        try {
            JSONObject record=journal.presentation(current,claim.presentation.payload.recordId).record();
            boolean acknowledged=!record.isNull("acknowledged_event_id");
            return new JSONObject().put("current",true).put("freshness",freshness(claim.presentation.payload,observation).name())
                .put("retire_visual",claim.visuallyRetired||record.getBoolean("card_dismissed")||acknowledged)
                .put("stop_audio",acknowledged).put("navigation_pending",record.getBoolean("navigation_pending"));
        }catch(VaultFailure invalid){throw invalid;}catch(Exception invalid){throw new VaultFailure("custodial_provider_claim_invalid",invalid);}
    }
    synchronized void apply(Object owner, NativeProviderPrincipal current, String id, String action,
        NativeProviderJournal.Observation observation) throws VaultFailure {
        requireAttachment(owner); Claim claim = claims.get(id);
        if (claim == null || (claim.visuallyRetired && !"audio_completed".equals(action)&&!"audio_stopped".equals(action))) throw invalid();
        journal.requirePresentationCurrent(current, claim.presentation);
        if("audio_stopped".equals(action)){
            if(!claim.audioStarted||claim.audioCompleted)throw invalid();
            claim.audioCompleted=true; // Release capability only; durable IN_PROGRESS stays uncertain.
            if(claim.visuallyRetired)claims.remove(id);return;
        }
        if ("audio_started".equals(action) && (!claim.audioOffered || claim.audioStarted || claim.audioCompleted)) throw invalid();
        if ("audio_started".equals(action) && !NativeProviderTime.live(observation.bounds, claim.presentation.payload.reservedAt, claim.presentation.payload.validUntil))
            throw new VaultFailure("custodial_provider_display_time_unavailable");
        if ("audio_completed".equals(action) && (!claim.audioStarted || claim.audioCompleted)) throw invalid();
        journal.applyPresentationAction(current, claim.presentation, action, observation);
        if ("audio_started".equals(action)) claim.audioStarted = true;
        if ("audio_completed".equals(action)) claim.audioCompleted = true;
        // A never-started dismissed/acknowledged offer is canceled without
        // manufacturing completed speech; an active offer continues unchanged.
        if (("dismissed".equals(action) || "acknowledged".equals(action)) && !claim.audioStarted) claim.audioCompleted = true;
        // Closing the visual card does not cancel its two-cycle audio. The one finite
        // completion callback retains no display/open/ack/navigation authority.
        if (claim.visuallyRetired && "audio_completed".equals(action)) claims.remove(id);
    }
    synchronized void retire(Object owner, NativeProviderPrincipal current, String id) throws VaultFailure {
        requireAttachment(owner); Claim claim = claims.get(id);
        if (claim != null) {
            journal.confirmMirrorRetired(current, claim.presentation); claim.visuallyRetired = true;
            // Exact destination readback can retire a never-started offer. It
            // must not block FIFO or invent a persisted speech completion.
            if(!claim.audioStarted)claim.audioCompleted=true;
        }
    }
    private void requireAttachment(Object owner) throws VaultFailure { if (owner == null || owner != attachment) throw invalid(); }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_claim_invalid"); }
}
