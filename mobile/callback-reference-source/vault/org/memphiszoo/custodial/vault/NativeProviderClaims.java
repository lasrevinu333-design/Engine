package org.memphiszoo.custodial.vault;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;

/** One native process/Activity attachment owns opaque mirror capabilities. No persistent
 * callback survives detach/process death. Durable records/actions stay in the journal.
 * Runtime holds engine-before-provider coordinator before invoking these methods. */
final class NativeProviderClaims {
    /** Additional withdrawal-only native lifecycle binding. The opaque epoch
     * is process-local DATA, not principal/time/provider or effect admission.
     * Shipping Runtime supplies the actual plugin lifecycle producer; no JS
     * field, nonce or caller-selected boolean is accepted as an epoch. */
    interface AttachmentFence {Object currentEpoch(Object actualOwner)throws VaultFailure;}
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
        private final NativeProviderClaims owner;
        private final Attachment attachment;
        final String id;
        final NativeProviderJournal.Presentation presentation;
        private final String data;
        private boolean visuallyRetired;
        private final boolean audioOffered;
        private boolean audioStarted, audioCompleted;
        private Claim(NativeProviderClaims owner, Attachment attachment, NativeProviderJournal.Presentation presentation,
            NativeProviderJournal.Observation observation, boolean offerAudio) throws Exception {
            this.owner=owner;this.attachment=attachment;
            this.presentation = presentation; id = UUID.randomUUID().toString(); JSONObject record = presentation.record();
            boolean historical = !NativeProviderTime.live(observation.bounds, presentation.payload.reservedAt, presentation.payload.validUntil);
            audioOffered = offerAudio && !historical && "PENDING".equals(record.getString("audio_state"));
            data = new JSONObject().put("claim_id", id).put("payload", presentation.payload.json())
                .put("play_audio", audioOffered)
                .put("navigation_pending", record.getBoolean("navigation_pending")).put("historical", historical).toString();
        }
        JSONObject data() throws Exception { synchronized(owner){
            owner.requireAttachment(attachment);if(owner.claims.get(id)!=this)throw invalid();
            JSONObject result=new JSONObject(data);owner.requireAttachment(attachment);return result;
        } }
    }
    private final NativeProviderJournal journal;
    private final boolean offerAudio;
    private final AttachmentFence attachmentFence;
    private final Map<String, Claim> claims = new LinkedHashMap<>();
    /** Private invocation identity also withdraws work interrupted by a native
     * detach/invalidate and reattach of the same legacy owner/epoch pair. */
    private static final class Attachment {
        final Object owner,epoch;
        private Attachment(Object owner,Object epoch){this.owner=owner;this.epoch=epoch;}
    }
    private Attachment attachment;
    NativeProviderClaims(NativeProviderJournal journal) { this(journal,true); }
    NativeProviderClaims(NativeProviderJournal journal,boolean offerAudio) { this(journal,offerAudio,owner->owner); }
    NativeProviderClaims(NativeProviderJournal journal,boolean offerAudio,AttachmentFence attachmentFence) {
        if(attachmentFence==null)throw new IllegalArgumentException("native_attachment_fence_required");
        this.journal=journal;this.offerAudio=offerAudio;this.attachmentFence=attachmentFence;
    }
    /** The actual plugin supplies its private Java owner object, never a JS-provided ID. */
    synchronized void attach(Object owner) throws VaultFailure {
        if(owner==null)throw invalid();Attachment previous=attachment;Object epoch;
        try{epoch=attachmentFence.currentEpoch(owner);}
        catch(VaultFailure|RuntimeException failure){if(previous!=null&&previous.owner==owner)withdraw(previous);throw failure;}
        if(epoch==null){if(previous!=null&&previous.owner==owner)withdraw(previous);throw invalid();}
        if(attachment!=previous)throw invalid();
        attach(owner,epoch);
    }
    /** Expected epoch is native withdrawal DATA; only the real fence can make
     * this exact opaque reference current. It never substitutes for evidence. */
    synchronized void attach(Object owner,Object expectedEpoch)throws VaultFailure {
        if(owner==null||expectedEpoch==null)throw invalid();Attachment previous=attachment;Object actual;
        try{actual=attachmentFence.currentEpoch(owner);}
        catch(VaultFailure|RuntimeException failure){if(previous!=null&&previous.owner==owner)withdraw(previous);throw failure;}
        if(attachment!=previous)throw invalid();
        if(actual!=expectedEpoch){
            if(previous!=null&&previous.owner==owner&&actual!=previous.epoch)withdraw(previous);
            throw invalid();
        }
        Attachment next=previous!=null&&previous.owner==owner&&previous.epoch==expectedEpoch
            ?previous:new Attachment(owner,expectedEpoch);
        if(next!=previous){claims.clear();attachment=next;}
        requireAttachment(next); // Same fence reference AFTER publication; failure withdraws only next.
    }
    synchronized boolean detach(Object owner,Object expectedEpoch){
        Attachment current=attachment;
        if(current==null||owner==null||expectedEpoch==null||current.owner!=owner||current.epoch!=expectedEpoch)return false;
        withdraw(current);return true;
    }
    synchronized void detach(Object owner) { if(attachment!=null&&attachment.owner==owner)withdraw(attachment); }
    synchronized void invalidate() {
        claims.clear();if(attachment!=null)attachment=new Attachment(attachment.owner,attachment.epoch);
    }
    synchronized Claim claimNext(Object owner, NativeProviderPrincipal current, NativeProviderJournal.Observation observation) throws VaultFailure {
        Attachment attached=requireAttachment(owner);
        try {
            if (observation == null) throw invalid();
            // A stale prior attachment/identity callback can never revive if A later returns.
            for (java.util.Iterator<Claim> it = claims.values().iterator(); it.hasNext();) {
                Claim existing = it.next();
                try {
                    journal.requirePresentationCurrent(current, existing.presentation);
                    requireAttachment(attached);
                    if(existing.audioOffered&&!existing.audioStarted&&!existing.audioCompleted
                        &&!NativeProviderTime.live(observation.bounds,existing.presentation.payload.reservedAt,existing.presentation.payload.validUntil))
                        existing.audioCompleted=true; // Retire unused capability, never alter persisted audio facts.
                }
                catch (VaultFailure stale) {
                    if (!"custodial_provider_operation_stale".equals(stale.code) && !"custodial_provider_waiting_native_principal".equals(stale.code)
                        && !"custodial_provider_generation_refused".equals(stale.code)) throw stale;
                    requireAttachment(attached);
                    it.remove();
                }
            }
            // One offered/current audio capability at a time. Dismiss retires the
            // visual only; it cannot let another speech sequence overlap. A new
            // runtime's old IN_PROGRESS record is visual uncertainty, not replay.
            for (Claim existing : claims.values()) if (existing.audioOffered && !existing.audioCompleted) {requireAttachment(attached);return null;}
            var recordIds=journal.admittedRecordIds(current);requireAttachment(attached);
            for (String recordId : recordIds) {
                boolean claimed = false;
                for (Claim existing : claims.values()) if (existing.presentation.payload.recordId.equals(recordId)) { claimed = true; break; }
                if (claimed) continue;
                NativeProviderJournal.Presentation presentation = journal.presentation(current, recordId);requireAttachment(attached);
                JSONObject record = presentation.record();
                boolean pendingNavigation = record.getBoolean("navigation_pending");
                if (!pendingNavigation && (record.getBoolean("card_dismissed") || !record.isNull("acknowledged_event_id") || !record.isNull("opened_event_id")
                    || record.getBoolean("mirror_retire_pending"))) continue;
                boolean live = NativeProviderTime.live(observation.bounds, presentation.payload.reservedAt, presentation.payload.validUntil);
                if (!live && !pendingNavigation) continue;
                if (claims.size() >= 256) throw new VaultFailure("custodial_provider_claim_capacity");
                Claim claim = new Claim(this,attached,presentation, observation,offerAudio);
                requireAttachment(attached);claims.put(claim.id, claim);requireAttachment(attached);return claim;
            }
            requireAttachment(attached);return null;
        } catch (VaultFailure error) { discardIfWithdrawn(attached);throw error; }
        catch (Exception error) { discardIfWithdrawn(attached);throw new VaultFailure("custodial_provider_claim_invalid", error); }
    }
    synchronized boolean isCurrent(Object owner, NativeProviderPrincipal current, String id) throws VaultFailure {
        Attachment attached=requireAttachment(owner); Claim claim = claims.get(id);
        if (claim == null || claim.visuallyRetired) {requireAttachment(attached);return false;}
        try{journal.requirePresentationCurrent(current, claim.presentation);requireAttachment(attached);return true;}
        catch(VaultFailure failure){discardIfWithdrawn(attached);throw failure;}
    }
    synchronized void requireClaim(Object owner,String id) throws VaultFailure {
        Attachment attached=requireAttachment(owner);if(!claims.containsKey(id))throw invalid();requireAttachment(attached);
    }
    synchronized JSONObject state(Object owner,NativeProviderPrincipal current,String id,NativeProviderJournal.Observation observation) throws VaultFailure {
        Attachment attached=requireAttachment(owner);Claim claim=claims.get(id);if(claim==null)throw invalid();
        try {
            journal.requirePresentationCurrent(current,claim.presentation);requireAttachment(attached);
            var presentation=journal.presentation(current,claim.presentation.payload.recordId);requireAttachment(attached);
            JSONObject record=presentation.record();
            boolean acknowledged=!record.isNull("acknowledged_event_id");
            JSONObject result=new JSONObject().put("current",true).put("freshness",freshness(claim.presentation.payload,observation).name())
                .put("retire_visual",claim.visuallyRetired||record.getBoolean("card_dismissed")||acknowledged)
                .put("stop_audio",acknowledged).put("navigation_pending",record.getBoolean("navigation_pending"));
            requireAttachment(attached);return result;
        }catch(VaultFailure invalid){discardIfWithdrawn(attached);throw invalid;}
        catch(Exception invalid){discardIfWithdrawn(attached);throw new VaultFailure("custodial_provider_claim_invalid",invalid);}
    }
    synchronized void apply(Object owner, NativeProviderPrincipal current, String id, String action,
        NativeProviderJournal.Observation observation) throws VaultFailure {
        Attachment attached=requireAttachment(owner); Claim claim = claims.get(id);
        if (claim == null || (claim.visuallyRetired && !"audio_completed".equals(action)&&!"audio_stopped".equals(action))) throw invalid();
        try {
        journal.requirePresentationCurrent(current, claim.presentation);
        requireAttachment(attached);
        if("audio_stopped".equals(action)){
            if(!claim.audioStarted||claim.audioCompleted)throw invalid();
            claim.audioCompleted=true; // Release capability only; durable IN_PROGRESS stays uncertain.
            if(claim.visuallyRetired)claims.remove(id);requireAttachment(attached);return;
        }
        if ("audio_started".equals(action) && (!claim.audioOffered || claim.audioStarted || claim.audioCompleted)) throw invalid();
        if ("audio_started".equals(action) && !NativeProviderTime.live(observation.bounds, claim.presentation.payload.reservedAt, claim.presentation.payload.validUntil))
            throw new VaultFailure("custodial_provider_display_time_unavailable");
        if ("audio_completed".equals(action) && (!claim.audioStarted || claim.audioCompleted)) throw invalid();
        requireAttachment(attached); // Immediately before the existing durable action; never replay it.
        if ("audio_started".equals(action)) {
            boolean started=journal.tryStartAudio(current, claim.presentation, observation);requireAttachment(attached);
            if (!started) {
                claim.audioCompleted = true; // Retire unused local offer, not the other owner's durable audio.
                throw new VaultFailure("custodial_provider_audio_already_owned");
            }
            claim.audioStarted = true;
        } else {journal.applyPresentationAction(current, claim.presentation, action, observation);requireAttachment(attached);}
        if ("audio_completed".equals(action)) claim.audioCompleted = true;
        // A never-started dismissed/acknowledged offer is canceled without
        // manufacturing completed speech; an active offer continues unchanged.
        if (("dismissed".equals(action) || "acknowledged".equals(action)) && !claim.audioStarted) claim.audioCompleted = true;
        // Closing the visual card does not cancel its two-cycle audio. The one finite
        // completion callback retains no display/open/ack/navigation authority.
        if (claim.visuallyRetired && "audio_completed".equals(action)) claims.remove(id);
        requireAttachment(attached);
        }catch(VaultFailure|RuntimeException failure){discardIfWithdrawn(attached);throw failure;}
    }
    synchronized void retire(Object owner, NativeProviderPrincipal current, String id) throws VaultFailure {
        Attachment attached=requireAttachment(owner); Claim claim = claims.get(id);
        try {
        if (claim != null) {
            requireAttachment(attached);journal.confirmMirrorRetired(current, claim.presentation);requireAttachment(attached);
            claim.visuallyRetired = true;
            // Exact destination readback can retire a never-started offer. It
            // must not block FIFO or invent a persisted speech completion.
            if(!claim.audioStarted)claim.audioCompleted=true;
        }
        requireAttachment(attached);
        }catch(VaultFailure|RuntimeException failure){discardIfWithdrawn(attached);throw failure;}
    }
    private Attachment requireAttachment(Object owner) throws VaultFailure {
        Attachment current=attachment;if(owner==null||current==null||owner!=current.owner)throw invalid();
        requireAttachment(current);return current;
    }
    private void requireAttachment(Attachment expected)throws VaultFailure {
        if(expected==null||attachment!=expected)throw invalid();
        try{
            Object epoch=attachmentFence.currentEpoch(expected.owner);
            if(attachment!=expected||epoch==null||epoch!=expected.epoch)throw invalid();
        }catch(VaultFailure|RuntimeException failure){withdraw(expected);throw failure;}
    }
    private void withdraw(Attachment expected){if(attachment==expected){claims.clear();attachment=null;}}
    /** A failed journal action keeps its original failure/outcome. This is only
     * best-effort withdrawal of volatile callbacks, never compensation/retry. */
    private void discardIfWithdrawn(Attachment expected){
        try{requireAttachment(expected);}catch(VaultFailure|RuntimeException withdrawn){/* Already withdrawn, or a successor owns the attachment. */}
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_claim_invalid"); }
}
