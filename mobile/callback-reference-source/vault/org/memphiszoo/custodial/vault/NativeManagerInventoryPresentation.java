package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Rejection-only presentation of a detached v1 local source join. Not authentication,
 * custody, a currentness check, or permission. The owning caller retains all guards.
 * No input object/record is returned or mutated; only validated primitive counts
 * and fixed labels reach the returned immutable String. */
final class NativeManagerInventoryPresentation {
    private NativeManagerInventoryPresentation() {}
    private static final String SCHEMA = "custodial.native-retained-eight-namespace-semantic-join.v1";
    private static final String STATE = "EXACT_ALL8_VALUES_AND_LOCAL_OWNER_SOURCE_CLASSIFICATIONS_JOINED_NOT_CUSTODY_OR_ACCEPTANCE";
    // Exact source-owned KEY_FAMILIES; no caller-selected namespace or family.
    private static final String[] NAMES = {
        "MemphisZooCustodialNativeVaultV2", "MemphisZooCustodialOfflineAuthorityTimeV1",
        "MemphisZooCustodialRetainedAttemptV1", "MemphisZooCustodialRetainedReadQueryV1",
        "MemphisZooCustodialRetainedBatchV1", "MemphisZooCustodialNativeProviderV1",
        "MemphisZooCustodialNativeVaultV1", "WSSecureStorageSharedPreferences"};
    private static final String[] FAMILIES = {"SHARED_VAULT_V2", "SEPARATE_PROVIDER_V1",
        "LEGACY_VAULT_V1", "LEGACY_ALIAS_BOUND_SECURE_STORAGE"};
    private static final String ROOT_FALSE = "durable_retention all8_backend_writer_bound absence_proves_no_late_commit complete_namespace_inventory all_writer_durable_freeze_or_ABA_guard current_server_readback clock_profile_qualified inventory_acknowledged work_accepted new_work_allowed resend_allowed finalizer_allowed key_removal phone_released";
    private static final String ROW_FALSE = "current_server_readback inventory_acknowledged work_accepted resend_allowed finalizer_allowed key_removal";
    private static final String FAMILY_FALSE = "all_writer_durable_freeze_or_ABA_guard current_server_reconciliation finalizer_allowed key_removal";
    private static final String CHUNK_FALSE = "current_server_readback resend_allowed work_accepted";

    static String summary(JSONObject snapshot) {
        try {
            if (snapshot == null) throw invalid();
            shape(snapshot, "schema state source_capture_sha256 values_sha256 semantic_join_sha256 original_frozen_work_sha256 original_generation_id principal_digest engine_revision record_count source_classified_record_count unresolved_source_record_count namespaces key_family_references records original_work_journal_chunks batch_owner_state original_work_batch_operation_id all_fixed_work_chunks_have_original_cached_observations work_witnesses_do_not_cover_all8_values cached_observations_are_historical_local_only native_semantic_inventory_state browser_inventory_state " + ROOT_FALSE);
            equal(snapshot, "schema", SCHEMA); equal(snapshot, "state", STATE);
            for (String field : words("source_capture_sha256 values_sha256 semantic_join_sha256 original_frozen_work_sha256 principal_digest")) hash(snapshot, field);
            uuid(snapshot, "original_generation_id", false);
            integral(snapshot.get("engine_revision"), Long.MAX_VALUE);
            flags(snapshot, ROOT_FALSE, false);
            flags(snapshot, "work_witnesses_do_not_cover_all8_values cached_observations_are_historical_local_only", true);
            bool(snapshot, "all_fixed_work_chunks_have_original_cached_observations");
            equal(snapshot, "native_semantic_inventory_state", "UNKNOWN");
            equal(snapshot, "browser_inventory_state", "UNKNOWN");
            String batch = text(snapshot, "batch_owner_state");
            if (!Arrays.asList("EMPTY_NO_BATCH_OWNER", "BATCH_OWNER_UNRESOLVED_RETAINED", "ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT").contains(batch)) throw invalid();
            uuid(snapshot, "original_work_batch_operation_id", true);
            int total = count(snapshot, "record_count", 32768);
            int known = count(snapshot, "source_classified_record_count", 32768);
            int unresolved = count(snapshot, "unresolved_source_record_count", 32768);
            if ((long) known + unresolved != total) throw invalid();
            int[] declared = new int[8], actual = new int[8], classified = new int[8];
            boolean[] seen = new boolean[8];
            JSONArray namespaces = array(snapshot, "namespaces", 8);
            if (namespaces.length() != 8) throw invalid();
            for (int i = 0; i < 8; i++) {
                JSONObject n = object(namespaces, i);
                shape(n, "namespace key_family record_count semantic_inventory_state durable_retention empty_is_not_key_removal_authority");
                int index = namespace(n);
                if (seen[index]) throw invalid();
                seen[index] = true;
                declared[index] = count(n, "record_count", 4096);
                equal(n, "semantic_inventory_state", "UNKNOWN");
                flags(n, "durable_retention", false);
                flags(n, "empty_is_not_key_removal_authority", true);
            }
            JSONArray rows = array(snapshot, "records", 32768);
            if (rows.length() != total) throw invalid();
            Set<String> identities = new HashSet<>();
            int actualKnown = 0;
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = object(rows, i);
                shape(row, "namespace key_family raw_identity_sha256 raw_type journal_source_state vault_provider_source_state local_source_classification local_source_classified application_semantic_disposition " + ROW_FALSE);
                int index = namespace(row);
                String id = hash(row, "raw_identity_sha256");
                if (!identities.add(index + ":" + id) || ++actual[index] > 4096) throw invalid();
                if (!Arrays.asList("STRING", "INTEGER", "LONG", "BOOLEAN", "FLOAT_RAW_BITS", "STRING_SET").contains(text(row, "raw_type"))) throw invalid();
                String journal = localState(row, "journal_source_state");
                String provider = localState(row, "vault_provider_source_state");
                String local = localState(row, "local_source_classification");
                // Mirrors the v1 producer's choice, never an application verdict.
                if (!local.equals(index >= 1 && index <= 4 ? journal : provider)) throw invalid();
                boolean isKnown = bool(row, "local_source_classified");
                if (isKnown != (!local.contains("UNRESOLVED") && !local.equals("UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED"))) throw invalid();
                if (isKnown) { classified[index]++; actualKnown++; }
                equal(row, "application_semantic_disposition", "UNKNOWN_RETAINED");
                flags(row, ROW_FALSE, false);
            }
            if (!Arrays.equals(declared, actual) || actualKnown != known) throw invalid();
            int[] familyTotals = new int[4];
            for (int i = 0; i < 8; i++) familyTotals[familyIndex(i)] += actual[i]; // <=32768, no overflow
            JSONArray families = array(snapshot, "key_family_references", 4);
            if (families.length() != 4) throw invalid();
            Set<String> familySeen = new HashSet<>();
            for (int i = 0; i < 4; i++) {
                JSONObject family = object(families, i);
                shape(family, "key_family source_declared_raw_rows_to_preserve possible_undeclared_references zero_rows_is_not_key_removal_authority " + FAMILY_FALSE);
                String name = text(family, "key_family");
                int index = Arrays.asList(FAMILIES).indexOf(name);
                if (index < 0 || !familySeen.add(name) || count(family, "source_declared_raw_rows_to_preserve", 32768) != familyTotals[index]) throw invalid();
                equal(family, "possible_undeclared_references", "UNKNOWN");
                flags(family, FAMILY_FALSE, false);
                flags(family, "zero_rows_is_not_key_removal_authority", true);
            }
            // Existing 40MiB WORK / 24576-byte chunks => at most 1707 witnesses.
            JSONArray chunks = array(snapshot, "original_work_journal_chunks", 1707);
            for (int i = 0; i < chunks.length(); i++) {
                JSONObject chunk = object(chunks, i);
                shape(chunk, "chunk_index state write_journal_state query_journal_state original_write_hmac_validated original_target_query_hmac_validated cached_original_observation_validated ambiguous_request_identity cached_status original_write_request_id original_query_request_id original_write_body_sha256 original_query_body_sha256 " + CHUNK_FALSE);
                if (count(chunk, "chunk_index", 1706) != i) throw invalid();
                for (String field : words("state write_journal_state query_journal_state cached_status")) localState(chunk, field);
                for (String field : words("original_write_hmac_validated original_target_query_hmac_validated cached_original_observation_validated ambiguous_request_identity")) bool(chunk, field);
                uuid(chunk, "original_write_request_id", true); uuid(chunk, "original_query_request_id", true);
                for (String field : words("original_write_body_sha256 original_query_body_sha256")) if (chunk.get(field) != JSONObject.NULL) hash(chunk, field);
                flags(chunk, CHUNK_FALSE, false);
            }
            StringBuilder result = new StringBuilder("Retained native domains (local source classification only):\n");
            for (int i = 0; i < 8; i++) result.append(NAMES[i]).append(": retained ").append(actual[i])
                .append(", source-known ").append(classified[i]).append(", unresolved ").append(actual[i] - classified[i]).append('\n');
            return result.append("Totals: retained ").append(total).append(", source-known ").append(known).append(", unresolved ").append(unresolved)
                .append("\nUNKNOWN: application semantics; browser inventory; durable writer-fence; current server acceptance.")
                .append("\nLocal witnesses and empty domains confer no ACK, resend, finalizer, key-removal, or other effect rights.").toString();
        } catch (Exception malformed) { throw invalid(); }
    }

    private static final String COMPLETION_SCHEMA = "custodial.native-all8-original-completion-reconciliation.v1";
    private static final String COMPLETION_RECEIPT = "ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE";
    private static final String COMPLETION_PAIR = "ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY";
    private static final String LEGACY_ARGUMENT_PROVENANCE = "BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE";
    private static final String[] ARGUMENT_STATES = {"UNMATCHED_ARGUMENT_CANDIDATE_RETAINED",
        "UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED", "AMBIGUOUS_ARGUMENT_CANDIDATE_RETAINED",
        "ARGUMENT_VALUES_MISMATCH_RETAINED", "NATIVE_COMPLETION_UNRESOLVED_RETAINED",
        "AMBIGUOUS_SESSION_ARGUMENT_RETAINED", "ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE"};
    private static final String COMPLETION_FALSE = "saved_source_join_layout_capsule_identity_rewritten historical_snapshot_principal_verified clock_profile_qualified durable_retention all_writer_durable_freeze_or_ABA_guard resend_allowed new_work_allowed finalizer_allowed complete_namespace_inventory current_server_readback cutoff_eligible work_accepted inventory_acknowledged key_removal phone_released browser_source_authenticated";

    /** Rejection-only rendering of the owning join's detached observation.
     * Structural/digest consistency is NOT authentication or a currentness check. */
    static String completionSummary(JSONObject snapshot) {
        try {
            if (snapshot == null) throw invalid();
            boolean browserCandidates = snapshot.has("argument_candidate_count") || snapshot.has("unresolved_argument_candidate_count") || snapshot.has("argument_candidates");
            shape(snapshot, "schema state source_capture_sha256 values_sha256 original_source_join_sha256 completion_reconciliation_sha256 original_signed_manifest_sha256 original_generation_id principal_digest engine_revision record_count completion_semantic_joined_record_count matched_completion_count application_unresolved_record_count records namespaces key_family_references original_work_journal_chunks native_semantic_inventory_state browser_inventory_state " + COMPLETION_FALSE
                + (browserCandidates ? " argument_candidate_count unresolved_argument_candidate_count argument_candidates" : ""));
            equal(snapshot, "schema", COMPLETION_SCHEMA);
            equal(snapshot, "state", "ALL8_EXACT_ROWS_WITH_ORIGINAL_NATIVE_COMPLETION_SEMANTICS_NOT_ACCEPTANCE");
            for (String field : words("source_capture_sha256 values_sha256 original_source_join_sha256 completion_reconciliation_sha256 original_signed_manifest_sha256 principal_digest")) hash(snapshot, field);
            uuid(snapshot, "original_generation_id", false);
            long revision = integral(snapshot.get("engine_revision"), Long.MAX_VALUE);
            flags(snapshot, COMPLETION_FALSE, false);
            equal(snapshot, "native_semantic_inventory_state", "UNKNOWN"); equal(snapshot, "browser_inventory_state", "UNKNOWN");
            int total = count(snapshot, "record_count", 32768), joined = count(snapshot, "completion_semantic_joined_record_count", 32768);
            int matched = count(snapshot, "matched_completion_count", 4096), unresolved = count(snapshot, "application_unresolved_record_count", 32768);
            if (joined != 3L * matched || (long) joined + unresolved != total) throw invalid();
            int[] declared = new int[8], actual = new int[8], covered = new int[8];
            boolean[] seen = new boolean[8];
            JSONArray namespaces = array(snapshot, "namespaces", 8);
            if (namespaces.length() != 8) throw invalid();
            for (int i = 0; i < 8; i++) {
                JSONObject n = object(namespaces, i);
                shape(n, "namespace key_family record_count semantic_inventory_state durable_retention empty_is_not_key_removal_authority");
                int index = namespace(n); if (seen[index]) throw invalid(); seen[index] = true;
                declared[index] = count(n, "record_count", 4096);
                equal(n, "semantic_inventory_state", "UNKNOWN"); flags(n, "durable_retention", false);
                flags(n, "empty_is_not_key_removal_authority", true);
            }
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            for (String field : words("schema source_capture_sha256 values_sha256 original_source_join_sha256 original_signed_manifest_sha256 principal_digest original_generation_id")) completionHashText(digest, text(snapshot, field));
            completionHashText(digest, Long.toString(revision));
            JSONArray rows = array(snapshot, "records", 32768);
            if (rows.length() != total) throw invalid();
            Set<String> identities = new HashSet<>(), workIdentities = new HashSet<>();
            int receipts = 0, starts = 0, finishes = 0, fences = 0, legacyReceipts = 0;
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = object(rows, i);
                boolean hasCompletion = row.has("native_completion_semantics");
                shape(row, "namespace key_family raw_identity_sha256 raw_type journal_source_state vault_provider_source_state local_source_classification local_source_classified application_semantic_disposition cutoff_eligible browser_source_authenticated " + ROW_FALSE + (hasCompletion ? " native_completion_semantics" : ""));
                int index = namespace(row); String id = hash(row, "raw_identity_sha256");
                if (!identities.add(index + ":" + id) || ++actual[index] > 4096) throw invalid();
                if (!Arrays.asList("STRING", "INTEGER", "LONG", "BOOLEAN", "FLOAT_RAW_BITS", "STRING_SET").contains(text(row, "raw_type"))) throw invalid();
                String journal = localState(row, "journal_source_state"), provider = localState(row, "vault_provider_source_state");
                String local = localState(row, "local_source_classification");
                if (!local.equals(index >= 1 && index <= 4 ? journal : provider)) throw invalid();
                boolean known = bool(row, "local_source_classified");
                if (known != (!local.contains("UNRESOLVED") && !local.equals("UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED"))) throw invalid();
                flags(row, ROW_FALSE + " cutoff_eligible browser_source_authenticated", false);
                String state = localState(row, "application_semantic_disposition");
                completionHashText(digest, text(row, "namespace")); completionHashText(digest, id); completionHashText(digest, state);
                if (index == 1) {
                    if (state.equals("ORIGINAL_AUTHENTICATED_WORK_FREEZE_MARKER_RETAINED")) {
                        if (hasCompletion || ++fences > 1) throw invalid();
                    } else {
                        Object item = row.get("native_completion_semantics"); if (!(item instanceof JSONObject)) throw invalid();
                        JSONObject completion = (JSONObject) item;
                        boolean receipt = COMPLETION_RECEIPT.equals(state);
                        shape(completion, "raw_identity_sha256 kind state automatic_acceptance" + (receipt ? " argument_provenance argument_values_sha256 receipt_binding_sha256 start_cutoff_relation finish_cutoff_relation" : ""));
                        if (!workIdentities.add(hash(completion, "raw_identity_sha256"))) throw invalid();
                        equal(completion, "state", state); flags(completion, "automatic_acceptance", false);
                        String kind = text(completion, "kind");
                        if (!Arrays.asList("MUTATION_EPOCH_METADATA", "OCCURRENCE", "FINISH_PROOF", "COMPLETION_RECEIPT", "SCAN_ENTRIES", "NFC_HANDOFFS", "LEGACY_LINEAGE", "PROTECTED_METADATA", "UNRECOGNIZED").contains(kind)) throw invalid();
                        if (receipt) {
                            equal(completion, "kind", "COMPLETION_RECEIPT");
                            String provenance = text(completion, "argument_provenance");
                            if (!Arrays.asList("CAPTURED_NATIVE_ORIGINAL_V3_VALUES", "CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN").contains(provenance)) {
                                if (!browserCandidates || !LEGACY_ARGUMENT_PROVENANCE.equals(provenance)) throw invalid();
                                legacyReceipts++;
                            }
                            hash(completion, "argument_values_sha256"); hash(completion, "receipt_binding_sha256");
                            for (String field : words("start_cutoff_relation finish_cutoff_relation")) if (!Arrays.asList("BEFORE", "EQUAL", "AFTER").contains(text(completion, field))) throw invalid();
                            receipts++; covered[index]++;
                        } else if (COMPLETION_PAIR.equals(state)) {
                            if (kind.equals("OCCURRENCE")) starts++; else if (kind.equals("FINISH_PROOF")) finishes++; else throw invalid();
                            covered[index]++;
                        } else if (!Arrays.asList("UNRECONCILED_RECORD_RETAINED", "MALFORMED_RECEIPT_KEY_RETAINED", "AMBIGUOUS_BROWSER_ARGUMENT_ROWS_RETAINED", "LEGACY_ORIGINAL_VALUES_UNAVAILABLE_RETAINED", "BROWSER_ARGUMENT_VALUES_MISMATCH_RETAINED", "INVALID_OR_UNREADABLE_COMPLETION_RETAINED", "AMBIGUOUS_SESSION_COMPLETIONS_RETAINED").contains(state)) throw invalid();
                        Set<String> fields = new java.util.TreeSet<>(); completion.keys().forEachRemaining(fields::add);
                        for (String field : fields) { completionHashText(digest, field); completionHashText(digest, completion.get(field).toString()); }
                    }
                } else {
                    if (hasCompletion) throw invalid();
                    String expected = "UNRECONCILED_RECORD_RETAINED";
                    if (known && local.equals(journal)) {
                        if ((index == 2 || index == 4) && local.equals("ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED")) expected = local;
                        if ((index == 3 || index == 4) && Arrays.asList("ORIGINAL_QUERY_HMAC_VALID_CACHED_OUTCOME_UNKNOWN", "CACHED_ORIGINAL_TARGET_WITNESS_LOCAL_ONLY").contains(local)) expected = local;
                        if (index == 4 && local.equals("ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT")) expected = local;
                    }
                    if (!expected.equals(state)) throw invalid();
                }
            }
            if (!Arrays.equals(declared, actual) || receipts != matched || starts != matched || finishes != matched || covered[1] != joined) throw invalid();
            int argumentCount = 0, argumentUnresolved = 0;
            if (browserCandidates) {
                argumentCount = count(snapshot, "argument_candidate_count", 4096);
                argumentUnresolved = count(snapshot, "unresolved_argument_candidate_count", argumentCount);
                JSONArray candidates = array(snapshot, "argument_candidates", 4096);
                if (argumentCount < 1 || candidates.length() != argumentCount) throw invalid();
                completionHashText(digest, "browser_argument_candidates.v1");
                completionHashText(digest, Integer.toString(argumentCount));
                completionHashText(digest, Integer.toString(argumentUnresolved));
                int actualUnresolved = 0;
                for (int i = 0; i < candidates.length(); i++) {
                    JSONObject candidate = object(candidates, i);
                    shape(candidate, "argument_values_sha256 state source_authenticated");
                    String argumentHash = hash(candidate, "argument_values_sha256"), state = text(candidate, "state");
                    if (!Arrays.asList(ARGUMENT_STATES).contains(state)) throw invalid();
                    flags(candidate, "source_authenticated", false);
                    if (!ARGUMENT_STATES[6].equals(state)) actualUnresolved++;
                    completionHashText(digest, argumentHash); completionHashText(digest, state); completionHashText(digest, "false");
                }
                if (actualUnresolved != argumentUnresolved) throw invalid();
            }
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest.digest()) hex.append(Character.forDigit((b & 255) >>> 4, 16)).append(Character.forDigit(b & 15, 16));
            if (!hex.toString().equals(text(snapshot, "completion_reconciliation_sha256"))) throw invalid();
            int[] familyTotals = new int[4]; for (int i = 0; i < 8; i++) familyTotals[familyIndex(i)] += actual[i];
            JSONArray families = array(snapshot, "key_family_references", 4); if (families.length() != 4) throw invalid();
            Set<String> familySeen = new HashSet<>();
            for (int i = 0; i < 4; i++) {
                JSONObject family = object(families, i);
                shape(family, "key_family source_declared_raw_rows_to_preserve possible_undeclared_references zero_rows_is_not_key_removal_authority " + FAMILY_FALSE);
                String name = text(family, "key_family"); int index = Arrays.asList(FAMILIES).indexOf(name);
                if (index < 0 || !familySeen.add(name) || count(family, "source_declared_raw_rows_to_preserve", 32768) != familyTotals[index]) throw invalid();
                equal(family, "possible_undeclared_references", "UNKNOWN"); flags(family, FAMILY_FALSE, false);
                flags(family, "zero_rows_is_not_key_removal_authority", true);
            }
            JSONArray chunks = array(snapshot, "original_work_journal_chunks", 1707);
            for (int i = 0; i < chunks.length(); i++) {
                JSONObject chunk = object(chunks, i);
                shape(chunk, "chunk_index state write_journal_state query_journal_state original_write_hmac_validated original_target_query_hmac_validated cached_original_observation_validated ambiguous_request_identity cached_status original_write_request_id original_query_request_id original_write_body_sha256 original_query_body_sha256 " + CHUNK_FALSE);
                if (count(chunk, "chunk_index", 1706) != i) throw invalid();
                for (String field : words("state write_journal_state query_journal_state cached_status")) localState(chunk, field);
                for (String field : words("original_write_hmac_validated original_target_query_hmac_validated cached_original_observation_validated ambiguous_request_identity")) bool(chunk, field);
                uuid(chunk, "original_write_request_id", true); uuid(chunk, "original_query_request_id", true);
                for (String field : words("original_write_body_sha256 original_query_body_sha256")) if (chunk.get(field) != JSONObject.NULL) hash(chunk, field);
                flags(chunk, CHUNK_FALSE, false);
            }
            StringBuilder result = new StringBuilder("Original native completion/session observation (local retained snapshot only):\n");
            for (int i = 0; i < 8; i++) result.append(NAMES[i]).append(": retained ").append(actual[i]).append(", completion/session joined ").append(covered[i]).append(", unresolved ").append(actual[i] - covered[i]).append('\n');
            result.append("Totals: retained ").append(total).append(", matched original completion/session triples ").append(matched).append(", joined rows ").append(joined).append(", unresolved retained rows ").append(unresolved);
            if (browserCandidates) {
                result.append("\nBrowser argument candidates: retained ").append(argumentCount).append(", unresolved retained ").append(argumentUnresolved)
                    .append(". Source-unverified; NOT accepted work or browser authentication.");
                if (legacyReceipts > 0) result.append("\nLegacy-v2 browser-argument binding matches: ").append(legacyReceipts)
                    .append(". Source-unverified; NOT native-v3 acceptance.");
            }
            return result.append("\nNOT eligibility, current server acceptance, browser authentication/inventory, or durable writer-fence authority.")
                .append("\nNo ACK, work acceptance, resend, finalizer, key-removal, phone-release, or other effect rights. Close this observation before later workflows.").toString();
        } catch (Exception malformed) { throw invalid(); }
    }

    /** Display of the caller's current authenticated READ observation only.
     * Closed representation checks do not authenticate its source/currentness
     * or turn a known selected subset into complete inventory/ACK authority. */
    static String currentCompletionReadSummary(JSONObject observation) {
        try {
            if (observation == null) throw invalid();
            String effects = "inventory_acknowledged work_accepted replay_allowed finalizer_allowed key_removal phone_released";
            shape(observation, "schema state operation_id original_generation_id selected_argument_count accepted_count unresolved_selected_count readback_set_sha256 " + effects);
            equal(observation, "schema", "custodial.native-original-completion-read-observation.v1");
            equal(observation, "state", "CURRENT_AUTHENTICATED_ORIGINAL_COMPLETION_READS_NOT_ACK");
            uuid(observation, "operation_id", false); uuid(observation, "original_generation_id", false);
            hash(observation, "readback_set_sha256"); flags(observation, effects, false);
            int selected = count(observation, "selected_argument_count", 4096);
            int accepted = count(observation, "accepted_count", 4096);
            int unresolved = count(observation, "unresolved_selected_count", 4096);
            if (selected != (long) accepted + unresolved) throw invalid();
            return "Authenticated original completion reads: " + accepted + " accepted originals; " + unresolved
                + " unresolved selected originals. Other unresolved retained work is not counted as accepted."
                + " Empty selection is not proof of empty work or complete inventory."
                + " No ACK, resend, finalization or key removal.";
        } catch (Exception malformed) { throw invalid(); }
    }

    private static void completionHashText(java.security.MessageDigest hash, String value) {
        int length = value.length(); for (int shift = 24; shift >= 0; shift -= 8) hash.update((byte) (length >>> shift));
        for (int i = 0; i < length; i++) { char c = value.charAt(i); hash.update((byte) (c >>> 8)); hash.update((byte) c); }
    }

    private static int familyIndex(int namespace) { return namespace < 5 ? 0 : namespace - 4; }
    private static int namespace(JSONObject value) throws Exception {
        int index = Arrays.asList(NAMES).indexOf(text(value, "namespace"));
        if (index < 0 || !FAMILIES[familyIndex(index)].equals(text(value, "key_family"))) throw invalid();
        return index;
    }
    private static String[] words(String fields) { return fields.split(" "); }
    private static void shape(JSONObject value, String fields) {
        Set<String> remaining = new HashSet<>(Arrays.asList(words(fields)));
        for (Iterator<String> keys = value.keys(); keys.hasNext();) if (!remaining.remove(keys.next())) throw invalid();
        if (!remaining.isEmpty()) throw invalid();
    }
    private static String text(JSONObject value, String field) throws Exception {
        Object item = value.get(field); if (!(item instanceof String)) throw invalid(); return (String) item;
    }
    private static String localState(JSONObject value, String field) throws Exception {
        String item = text(value, field); if (!item.matches("[A-Z0-9_]{1,160}")) throw invalid(); return item;
    }
    private static String hash(JSONObject value, String field) throws Exception {
        String item = text(value, field); if (!item.matches("[a-f0-9]{64}")) throw invalid(); return item;
    }
    private static void uuid(JSONObject value, String field, boolean nullable) throws Exception {
        if (nullable && value.get(field) == JSONObject.NULL) return;
        if (!text(value, field).matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw invalid();
    }
    private static void equal(JSONObject value, String field, String expected) throws Exception { if (!expected.equals(text(value, field))) throw invalid(); }
    private static boolean bool(JSONObject value, String field) throws Exception {
        Object item = value.get(field); if (!(item instanceof Boolean)) throw invalid(); return (Boolean) item;
    }
    private static void flags(JSONObject value, String fields, boolean expected) throws Exception { for (String field : words(fields)) if (bool(value, field) != expected) throw invalid(); }
    private static long integral(Object value, long max) {
        if (!(value instanceof Integer || value instanceof Long)) throw invalid();
        long count = ((Number) value).longValue(); if (count < 0 || count > max) throw invalid(); return count;
    }
    private static int count(JSONObject value, String field, int max) throws Exception { return (int) integral(value.get(field), max); }
    private static JSONArray array(JSONObject value, String field, int max) throws Exception {
        Object item = value.get(field); if (!(item instanceof JSONArray) || ((JSONArray) item).length() > max) throw invalid(); return (JSONArray) item;
    }
    private static JSONObject object(JSONArray value, int index) throws Exception {
        Object item = value.get(index); if (!(item instanceof JSONObject)) throw invalid(); return (JSONObject) item;
    }
    private static IllegalArgumentException invalid() { return new IllegalArgumentException("native_manager_inventory_presentation_invalid"); }
}
