package org.memphiszoo.custodial.vault;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Presentation of validated representations only. No authentication, clock,
 * permission, native effect, IO or original-operation creation lives here. */
final class NativeManagerPreparationPresentation {
    private static final Pattern UUID = Pattern.compile(
        "[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");
    private static final Pattern MICROS = Pattern.compile(
        "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z");
    private NativeManagerPreparationPresentation() {}

    static String title() {
        return "Same-original protected recovery";
    }

    static String explanation() {
        return "Recorded challenges, captured server snapshots and read-only observations do not establish current manager authority or authorize native actions. "
            + "Only the separately confirmed enrollment-separation action can request one local transition, after independently current original inventory, holds and manager approval. "
            + "All original work and keys remain retained. No action here accepts or replays work, removes keys or releases a phone. "
            + "An interrupted separation requires retained local status, never a repeat write.";
    }

    static String stageButton() {
        return "Stage original preparation only";
    }

    static String readButton() {
        return "Read original server snapshot";
    }

    static String baselineButton() {
        return "Initialize FIRST native durable-fence baseline only";
    }

    static String prepareWorkButton() {
        return "Check existing separation and hold ORIGINAL native work";
    }

    static String originalWorkHeld() {
        return "The original native WORK snapshot is held under the authenticated existing separation. "
            + "Ordinary writes remain blocked. This is not complete inventory, manager approval, work acceptance, "
            + "replay, ACK, finalization, key removal, or phone release. Close this view before the FIRST baseline step. "
            + "A failed or interrupted check must preserve its pending probe for exact recovery, never reset or clear it.";
    }

    // The owning Activity may display this only after confirmed installation;
    // a thrown or uncertain result must remain held, never become this message.
    static String baselineInstalled() {
        return "Native rejection metadata installed. Previously captured native observations are invalidated. "
            + "This does not authorize saved-original replacement, work acceptance, replay, ACK, finalization, "
            + "key removal, phone release, or current manager authority. Native-only: this is not browser or "
            + "all-writer completion. Close this view before any later original workflow.";
    }

    static String retainFirstButton() {
        return "Retain FIRST encrypted NATIVE original (LOCAL ONLY)";
    }

    // Show only after the owning Activity confirms the exact original local
    // observation. A thrown or uncertain retention result must remain held.
    static String firstOriginalRetained() {
        return "The original encrypted native snapshot and LOCAL operation were observed. "
            + "This local observation does not establish server custody or authorize work acceptance, replay, "
            + "ACK, removal, finalization, key removal, browser freeze, or phone release. Preserve originals "
            + "and close this view before any later workflow. Later saved-original recovery must never replace "
            + "this original. This message supplies no authentication, attempt, or receipt.";
    }

    static String held() {
        return "Outcome unconfirmed. Exact retained state has not been verified. Preserve original data and keys. "
            + "Use the protected status and recovery process before taking further action. Do not resend, replace "
            + "the original, reset state, or initiate another native action.";
    }

    static String recoverOriginalPiecesButton() {
        return "LOCAL RECOVER ORIGINAL PIECE JOURNALS";
    }

    // Only after the closed same-original local recovery result. Partial or
    // uncertain recovery stays held; this text never invites a retry/send.
    static String originalPiecesLocallyRecovered() {
        return "Existing original piece journals were checked and any pending or alias recovery completed LOCALLY ONLY. "
            + "Missing records were not created. This local recovery does not establish server custody or authorize "
            + "transport, resend, work acceptance, inventory ACK, finalization, key removal, phone release, or current "
            + "manager authority. Preserve originals and close this view before any next action. Interrupted or partial "
            + "recovery remains retained; never automatically retry, reopen, replace, or reset originals.";
    }

    /** Closed local-result admission and rendering, not authentication/effect
     * authority. Do not expose success/count text until all fields match. */
    static String originalPiecesLocallyRecovered(JSONObject result)throws VaultFailure {
        try {
            if(result==null)throw invalidLocalPieceResult();
            boolean browserResult="custodial.native-saved-original-piece-journal-resume.v2".equals(result.get("schema"));
            if(result.length()!=(browserResult?14:13)
                ||(!browserResult&&!"custodial.native-saved-original-piece-journal-resume.v1".equals(result.get("schema")))
                ||!"EXISTING_ORIGINAL_PIECE_JOURNALS_LOCALLY_RECOVERED_NO_TRANSPORT_OR_ACK".equals(result.get("state")))
                throw invalidLocalPieceResult();
            for(String flag:new String[]{"missing_records_created","network_dispatch_allowed",
                "remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted",
                "resend_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(flag)))throw invalidLocalPieceResult();
            Object observed=result.get("existing_records_observed"),recovered=result.get("pending_or_alias_records_recovered");
            if(!(observed instanceof Integer)||!(recovered instanceof Integer)
                ||(Integer)observed<0||(Integer)recovered<0||(Integer)recovered>(Integer)observed)
                throw invalidLocalPieceResult();
            String browserText=browserResult?browserJournalLocallyRecovered(result.get("browser_local_journal")):null;
            String nativeText=originalPiecesLocallyRecovered()
                +"\n\nExisting records observed: "+observed+"\nPending/alias records recovered: "+recovered;
            return browserResult?"Native original piece journals:\n"+nativeText+"\n\nBrowser original local journal:\n"+browserText:nativeText;
        }catch(VaultFailure refused){throw refused;}
        catch(Exception malformed){throw invalidLocalPieceResult();}
    }

    private static String browserJournalLocallyRecovered(Object value)throws Exception {
        if(!(value instanceof JSONObject))throw invalidLocalPieceResult();
        JSONObject result=(JSONObject)value;
        if(result.length()!=16
            ||!"custodial.native-original-browser-local-journal-resume.v1".equals(result.get("schema")))
            throw invalidLocalPieceResult();
        for(String flag:new String[]{"missing_records_created","network_dispatch_allowed",
            "current_remote_browser_custody","inventory_acknowledged","work_accepted",
            "finalizer_allowed","key_removal","phone_released"})
            if(!Boolean.FALSE.equals(result.get(flag)))throw invalidLocalPieceResult();
        Object observedValue=result.get("existing_records_observed"),recoveredValue=result.get("pending_or_alias_records_recovered");
        if(!(observedValue instanceof Integer)||!(recoveredValue instanceof Integer))throw invalidLocalPieceResult();
        int observed=(Integer)observedValue,recovered=(Integer)recoveredValue;
        if(observed<0||observed>65||recovered<0||recovered>observed)throw invalidLocalPieceResult();
        Object declaredValue=result.get("declared_chunk_count"),missingValue=result.get("missing_chunk_count");
        Object committed=result.get("all_original_browser_parts_committed_observed"),digest=result.get("current_local_part_set_sha256");
        String text;
        Object state=result.get("state");
        if("NO_SAVED_BROWSER_FRAME_OBSERVED".equals(state)){
            if(observed!=0||recovered!=0||declaredValue!=JSONObject.NULL||missingValue!=JSONObject.NULL
                ||!Boolean.FALSE.equals(committed)||!"".equals(digest))throw invalidLocalPieceResult();
            text="No saved browser frame evidence was observed. Browser original completeness remains UNKNOWN, not empty.";
        }else if("ORPHAN_BROWSER_PARTS_RETAINED".equals(state)){
            if(observed<1||observed>64||recovered!=0||declaredValue!=JSONObject.NULL||missingValue!=JSONObject.NULL
                ||!Boolean.FALSE.equals(committed)||!"".equals(digest))throw invalidLocalPieceResult();
            text="Orphan browser parts remain retained. The original browser frame and completeness remain UNKNOWN; recovery is incomplete.";
        }else{
            if(!(declaredValue instanceof Integer)||!(missingValue instanceof Integer))throw invalidLocalPieceResult();
            int declared=(Integer)declaredValue,missing=(Integer)missingValue;
            if(declared<1||declared>64)throw invalidLocalPieceResult();
            if("INCOMPLETE_BROWSER_ORIGINAL_PARTS_RETAINED".equals(state)){
                if(missing<1||missing>declared||observed!=1+declared-missing
                    ||!Boolean.FALSE.equals(committed)||!"".equals(digest))throw invalidLocalPieceResult();
                text="Browser original parts remain retained and incomplete. Missing declared chunks: "+missing+" of "+declared+". Not all original browser parts were recovered.";
            }else if("EXISTING_BROWSER_PARTS_LOCALLY_RECOVERED_NOT_REMOTE_ACK".equals(state)){
                if(missing!=0||observed!=1+declared||!Boolean.TRUE.equals(committed)
                    ||!(digest instanceof String)||!((String)digest).matches("[a-f0-9]{64}"))throw invalidLocalPieceResult();
                text="All declared original browser parts were observed committed LOCALLY ONLY. This is a local observation, not server custody or remote ACK.";
            }else throw invalidLocalPieceResult();
        }
        return text+"\nExisting browser records observed: "+observed+"\nBrowser pending/alias records recovered: "+recovered
            +"\nMissing records were not created. No network dispatch, current server custody, inventory ACK, new work acceptance, finalization, key removal, or phone release is authorized. Preserve originals.";
    }

    private static VaultFailure invalidLocalPieceResult() {
        return new VaultFailure("custodial_private_custody_transport_outcome_unknown");
    }

    static String retainSavedCustodyButton() {
        return "Retain ORIGINAL native requests only (NO ACK)";
    }

    static String readSavedCustodyButton() {
        return "Read CURRENT saved native frame (NO RESEND / ACK)";
    }

    /** Stage DATA cannot be presented as a current frame or accepted work. */
    static String originalRequestsRetained(JSONObject result)throws VaultFailure {
        try{
            if(result==null||result.getClass()!=JSONObject.class)throw invalidLocalPieceResult();
            NativeRetainedAttempt.keys(result,"schema","state","operation_id","original_generation_id","frame_sha256","plan_sha256",
                "current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released");
            if(!"custodial.native-original-custody-retention-stage.v1".equals(result.get("schema"))
                ||!"ORIGINAL_REQUEST_PHASE_RETURNED_CURRENT_READ_NOT_RUN".equals(result.get("state")))throw invalidLocalPieceResult();
            for(String key:new String[]{"operation_id","original_generation_id"}){
                Object value=result.get(key);
                if(!(value instanceof String)||!UUID.matcher((String)value).matches())throw invalidLocalPieceResult();
                if(!java.util.UUID.fromString((String)value).toString().equals(value))throw invalidLocalPieceResult();
            }
            for(String key:new String[]{"frame_sha256","plan_sha256"})
                if(!(result.get(key) instanceof String)||!result.getString(key).matches("[a-f0-9]{64}"))throw invalidLocalPieceResult();
            for(String key:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(key)))throw invalidLocalPieceResult();
            return "The original request transport phase returned. Current server readback has NOT run. "
                +"Close this maintenance view and reopen it, then choose Read CURRENT saved native frame. "
                +"That is a separate read-only action, not renewal or resend of these originals. "
                +"Preserve all records and keys. No inventory ACK, work acceptance, replay, finalization, key removal or phone release is authorized.";
        }catch(VaultFailure failure){throw failure;}
        catch(Exception failure){throw invalidLocalPieceResult();}
    }

    static String currentOriginalCustodyObserved(JSONObject result)throws VaultFailure {
        try{
            if(result==null||result.getClass()!=JSONObject.class
                ||!"custodial.native-current-original-frame-read.v1".equals(result.get("schema"))
                ||!"CURRENT_READ_AND_NATIVE_CRYPTO_BOUND_NOT_SEMANTIC_ACK".equals(result.get("state")))throw invalidLocalPieceResult();
            for(String key:new String[]{"remote_future_acceptance_or_transaction_authority","inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(key)))throw invalidLocalPieceResult();
            var browser=result.getJSONObject("browser_local_custody");String state=browser.getString("state");
            if(!java.util.Set.of("SAVED_ORIGINAL_LOCAL_PARTS_READ_BACK_NOT_REMOTE_ACK","UNKNOWN_NOT_OBSERVED","LOCAL_PRESERVATION_INCOMPLETE_RETAINED").contains(state))throw invalidLocalPieceResult();
            return "A separate current native encrypted-frame read was observed. It did not resend original requests. "
                +"This is not semantic work acceptance, current manager authority, inventory ACK, finalization, key removal or phone release. "
                +("SAVED_ORIGINAL_LOCAL_PARTS_READ_BACK_NOT_REMOTE_ACK".equals(state)
                    ?"Saved browser parts were read back locally only; they are not remotely accepted. "
                    :"Browser local preservation is not yet complete and verified; originals remain protected. ")
                +"Preserve all originals and close this view before staging manager preparation.";
        }catch(VaultFailure failure){throw failure;}
        catch(Exception failure){throw invalidLocalPieceResult();}
    }

    // Only after the owning typed current-frame result; not an approval or
    // permission inferred from a local operation, HTTP response or UNKNOWN.
    static String originalCustodyObserved() {
        return "Initial original-custody transport and the current native encrypted-frame read were observed. "
            + "A preserved UNKNOWN is not resend authority. This is not inventory ACK, current manager authority, "
            + "work acceptance, replay, finalization, key removal, or phone release. Preserve originals and close "
            + "this view before staging preparation. This observation is not semantic acceptance.";
    }

    /** Admission of the owning result's representation only. No archived
     * result or rendered text supplies current authorization or effect rights. */
    static String enrollmentSeparationObserved(JSONObject result)throws VaultFailure {
        try {
            if(result==null||result.getClass()!=JSONObject.class||result.length()!=13
                ||!"custodial.native-original-enrollment-successor-observation.v1".equals(result.get("schema"))
                ||!"ORIGINAL_SUCCESSOR_OBSERVED_ALL_WORK_RETAINED_NOT_RELEASED".equals(result.get("state")))
                throw invalidEnrollmentSeparationResult();
            for(String flag:new String[]{"all_original_work_retained","inventory_acknowledged"})
                if(!Boolean.TRUE.equals(result.get(flag)))throw invalidEnrollmentSeparationResult();
            for(String flag:new String[]{"work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(flag)))throw invalidEnrollmentSeparationResult();
            for(String field:new String[]{"original_operation_id","original_generation_id"}) {
                Object value=result.get(field);
                if(!(value instanceof String)||((String)value).length()!=36
                    ||!UUID.matcher((String)value).matches())throw invalidEnrollmentSeparationResult();
            }
            long original=enrollmentSeparationRevision(result.get("original_vault_revision"));
            long observed=enrollmentSeparationRevision(result.get("observed_vault_revision"));
            if(original==Long.MAX_VALUE||observed!=original+1)throw invalidEnrollmentSeparationResult();
            // All thirteen fields have been admitted before returning any text.
            return "The exact local enrollment successor was observed. All original work, history and encryption keys remain retained and held. "
                +"This observation does not accept or resend work, permit replay or repeat finalization, remove keys or release the phone. "
                +"If this display is lost or interrupted, use retained local finalization status only; do not repeat separation.";
        }catch(VaultFailure refused){throw refused;}
        catch(Exception malformed){throw invalidEnrollmentSeparationResult();}
    }

    static String enrollmentSeparationUnknown() {
        return "Enrollment separation outcome is unconfirmed. Preserve all original work and keys and use retained local finalization status only. "
            +"Do not repeat separation or retry a write. No work acceptance, resend, replay, repeat finalization, key removal or phone release is authorized.";
    }

    private static long enrollmentSeparationRevision(Object value)throws VaultFailure {
        if(!(value instanceof String))throw invalidEnrollmentSeparationResult();
        String text=(String)value;
        if(text.length()<1||text.length()>19||!text.matches("0|[1-9][0-9]{0,18}"))
            throw invalidEnrollmentSeparationResult();
        try { return Long.parseLong(text); }
        catch(NumberFormatException malformed){throw invalidEnrollmentSeparationResult();}
    }

    private static VaultFailure invalidEnrollmentSeparationResult() {
        return new VaultFailure("custodial_original_browser_preparation_unavailable");
    }

    static String closed() {
        return "Preparation view closed. The original remains retained. Closing this view does not reset "
            + "data or authorize another attempt.";
    }

    static String staged(String challengeId) {
        exactAscii(challengeId, 36);
        if (!UUID.matcher(challengeId).matches()) throw invalid();
        return "Original challenge " + challengeId + " recorded for preparation only. This is not work acceptance, "
            + "replay or finalizer authorization, key removal, phone release, or current manager authority.";
    }

    /** Display DATA only, after the protected owner validates registration.
     * Never coerce/normalize a reference or infer registration from an ID. */
    static String originalInventoryRequestReference(Object nativeRequestId) {
        if (!(nativeRequestId instanceof String)) throw invalid();
        String id = (String) nativeRequestId;
        exactAscii(id, 36);
        if (!UUID.matcher(id).matches()) throw invalid();
        return "Original inventory request UUID: " + id
            + "\nUse this exact UUID in the existing manager inventory-review panel's Original native request UUID field, "
            + "not the earlier preparation challenge UUID. This reference alone is not manager confirmation or native ACK "
            + "and does not authorize work acceptance, replay, finalization, key removal or phone release.";
    }

    static String observed(String observedAt, String currentUntil) {
        LocalDateTime observation = civilMicros(observedAt), until = civilMicros(currentUntil);
        if (!observation.isBefore(until)) throw invalid();
        return "Captured server snapshot: observed at " + observedAt + "; observation window ends " + currentUntil
            + ". These unchanged UTC timestamps describe that snapshot only, not live freshness, current manager "
            + "authority, or permission. No work acceptance, replay, finalization, key removal, or phone release "
            + "is authorized.";
    }

    // Canonical fields are ASCII, hence exact UTF-8. This rejects every non-ASCII
    // code unit (including paired/unpaired surrogates) before parsing or display.
    private static void exactAscii(String value, int length) {
        if (value == null || value.length() != length) throw invalid();
        for (int i = 0; i < value.length(); i++) if (value.charAt(i) > 0x7f) throw invalid();
    }

    private static LocalDateTime civilMicros(String value) {
        exactAscii(value, 27);
        if (!MICROS.matcher(value).matches()) throw invalid();
        int year = Integer.parseInt(value.substring(0, 4));
        if (year < 1) throw invalid();
        try {
            return LocalDateTime.of(year, Integer.parseInt(value.substring(5, 7)),
                Integer.parseInt(value.substring(8, 10)), Integer.parseInt(value.substring(11, 13)),
                Integer.parseInt(value.substring(14, 16)), Integer.parseInt(value.substring(17, 19)),
                Integer.parseInt(value.substring(20, 26)) * 1000);
        } catch (DateTimeException failure) {
            throw invalid();
        }
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Invalid original preparation presentation input");
    }
}
