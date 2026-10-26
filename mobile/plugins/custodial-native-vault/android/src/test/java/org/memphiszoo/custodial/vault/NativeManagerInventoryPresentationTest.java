package org.memphiszoo.custodial.vault;

import java.math.BigInteger;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pure synthetic semantic-JSON vectors, NOT an owning capture or authority fixture. */
public final class NativeManagerInventoryPresentationTest {
    private static int checks;
    private static final String HASH = "ab".repeat(32);
    private static final String UUID = "11111111-1111-1111-1111-111111111111";
    private static final String[] NAMES = {"MemphisZooCustodialNativeVaultV2", "MemphisZooCustodialOfflineAuthorityTimeV1",
        "MemphisZooCustodialRetainedAttemptV1", "MemphisZooCustodialRetainedReadQueryV1", "MemphisZooCustodialRetainedBatchV1",
        "MemphisZooCustodialNativeProviderV1", "MemphisZooCustodialNativeVaultV1", "WSSecureStorageSharedPreferences"};
    private static final String[] FAMILIES = {"SHARED_VAULT_V2", "SEPARATE_PROVIDER_V1", "LEGACY_VAULT_V1", "LEGACY_ALIAS_BOUND_SECURE_STORAGE"};
    private static final String ROOT_FALSE = "durable_retention all8_backend_writer_bound absence_proves_no_late_commit complete_namespace_inventory all_writer_durable_freeze_or_ABA_guard current_server_readback clock_profile_qualified inventory_acknowledged work_accepted new_work_allowed resend_allowed finalizer_allowed key_removal phone_released";
    private static final String ROW_FALSE = "current_server_readback inventory_acknowledged work_accepted resend_allowed finalizer_allowed key_removal";
    private static final String FAMILY_FALSE = "all_writer_durable_freeze_or_ABA_guard current_server_reconciliation finalizer_allowed key_removal";
    private static final String CHUNK_FALSE = "current_server_readback resend_allowed work_accepted";

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--current-completion-read-presentation-only")) {
            currentReadPresentationCases(); return;
        }
        if((args.length==1||args.length==2)&&args[0].equals("--browser-candidate-completion-presentation-only")){
            String[] selected={"golden","legacy","closed","digest-rights","boundaries"};
            if(args.length==2&&!java.util.Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_new_browser_candidate_member");
            for(String member:selected){
                if(args.length==2&&!member.equals(args[1]))continue;
                if(member.equals("golden"))browserCandidateGolden();
                else if(member.equals("legacy"))browserCandidateLegacyAndProvenance();
                else if(member.equals("closed"))browserCandidateClosedTypesAndCounts();
                else if(member.equals("digest-rights"))browserCandidateDigestOrderAndFalseRights();
                else browserCandidateBoundaries();
                System.out.println("PASS_NEW_BROWSER_CANDIDATE_PRESENTATION_ONLY "+member);
            }
            System.out.println("NEW browser-candidate checks="+checks+"; SYNTHETIC_JSON_ONLY; NO_SOURCE_AUTH_NATIVE_ACCEPTANCE_ACK_OR_EFFECT_RIGHTS");return;
        }
        if (args.length == 1 && args[0].equals("--completion-presentation-only")) {
            completionPresentationCases(); return;
        }
        if (args.length == 1 && args[0].equals("--owning-completion-presentation-only")) {
            // Actual existing owning fixture, not a predecessor test method or a fake Observation.
            // Its Android-preferences/JCE/Engine dependencies require Main's separate fixture lease.
            Class<?> type = Class.forName("org.memphiszoo.custodial.vault.NativeRetainedNamespaceCompletionJoinTest$Fixture");
            Object fixture = type.getDeclaredConstructor(int.class).newInstance(0);
            JSONObject value = (JSONObject) type.getDeclaredMethod("inspect").invoke(fixture);
            String before = value.toString(), rendered = NativeManagerInventoryPresentation.completionSummary(value);
            check(before.equals(value.toString()));
            check(rendered.contains("matched original completion/session triples 1, joined rows 3"));
            check(rendered.contains("unresolved retained rows " + value.getInt("application_unresolved_record_count")));
            completionNoSecrets(value, rendered);
            System.out.println("NEW owning-completion renderer checks=" + checks + "; synthetic owning Engine fixture only; NOT Android/device/current-server/authority proof");
            return;
        }
        if (args.length == 2 && args[0].equals("--captured-original-inventory-only")) {
            byte[] bytes = java.nio.file.Files.readAllBytes(java.nio.file.Path.of(args[1]));
            String digest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
            if (!digest.equals("54b7a460e336a616b0e5aa5c2d9cfacf54d79bb26a346441820a2989f6868bce")) throw new IllegalArgumentException("original_capture_changed");
            JSONObject product = new JSONObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            JSONObject inventory = product.getJSONObject("native_preparation").getJSONObject("original_native_inventory_observation");
            String before = inventory.toString(), rendered = NativeManagerInventoryPresentation.summary(inventory);
            check(before.equals(inventory.toString()));
            check(rendered.contains("Totals: retained 15, source-known 5, unresolved 10"));
            check(rendered.contains("UNKNOWN: application semantics; browser inventory; durable writer-fence; current server acceptance."));
            for (String name : NAMES) check(rendered.contains(name+":"));
            for (String field : new String[]{"principal_digest","original_generation_id","values_sha256","source_capture_sha256"})
                check(!rendered.contains(inventory.getString(field)));
            System.out.println("PASS newly joined captured original inventory presentation; archived synthetic signed manager/actual isolated SQL representation only; no effect or current-authority proof");
            return;
        }
        if (args.length != 1 || !args[0].equals("--inventory-presentation-only")) throw new IllegalArgumentException("focused_selector_required");
        JSONObject empty = fixture(false);
        String zero = NativeManagerInventoryPresentation.summary(empty);
        check(zero.contains("Totals: retained 0, source-known 0, unresolved 0"));
        check(zero.contains("UNKNOWN: application semantics; browser inventory; durable writer-fence; current server acceptance."));
        check(zero.contains("empty domains confer no ACK"));
        JSONObject mixed = fixture(true);
        String before = mixed.toString();
        String output = NativeManagerInventoryPresentation.summary(mixed);
        check(mixed.toString().equals(before));
        check(output.contains("Totals: retained 8, source-known 4, unresolved 4"));
        for (int i = 0; i < 8; i++) check(output.contains(NAMES[i] + ": retained 1, source-known " + (i % 2 == 0 ? "1, unresolved 0" : "0, unresolved 1")));
        check(!output.contains(HASH) && !output.contains(UUID));
        mixed.getJSONArray("records").getJSONObject(0).put("raw_identity_sha256", "cd".repeat(32));
        check(output.equals(NativeManagerInventoryPresentation.summary(mixed))); // labels/counts, not raw identities
        check(NativeManagerInventoryPresentation.summary(fixture(true)).equals(output));
        mixed.put("record_count", 99);
        check(output.contains("Totals: retained 8")); // already-returned String is detached
        refuse(null);
        reject(s -> s.put("schema", "foreign"));
        reject(s -> s.put("state", "ACCEPTED"));
        reject(s -> s.put("record_count", 0));
        reject(s -> s.put("source_classified_record_count", 5));
        reject(s -> s.put("unresolved_source_record_count", 5));
        reject(s -> s.put("source_classified_record_count", 3).put("unresolved_source_record_count", 5));
        for (Object bad : new Object[]{-1, 32769, Long.MAX_VALUE, 8.0, "8", true, JSONObject.NULL, new BigInteger("8")}) {
            reject(s -> s.put("record_count", bad));
        }
        reject(s -> s.put("source_classified_record_count", Long.MAX_VALUE).put("unresolved_source_record_count", Long.MAX_VALUE));
        JSONObject longs = fixture(true);
        longs.put("record_count", 8L).put("source_classified_record_count", 4L).put("unresolved_source_record_count", 4L).put("engine_revision", Long.MAX_VALUE);
        check(NativeManagerInventoryPresentation.summary(longs).equals(output));
        reject(s -> s.put("engine_revision", -1));
        reject(s -> s.getJSONArray("namespaces").remove(0));
        reject(s -> s.getJSONArray("namespaces").put(s.getJSONArray("namespaces").getJSONObject(0)));
        reject(s -> s.getJSONArray("namespaces").put(1, s.getJSONArray("namespaces").getJSONObject(0)));
        reject(s -> ns(s).put("namespace", "NinthDomain"));
        reject(s -> ns(s).put("key_family", "LEGACY_VAULT_V1"));
        for (Object bad : new Object[]{4097, -1, "1", 1.0, true}) reject(s -> ns(s).put("record_count", bad));
        reject(s -> ns(s).put("record_count", 2));
        reject(s -> ns(s).put("semantic_inventory_state", "COMPLETE"));
        reject(s -> ns(s).put("empty_is_not_key_removal_authority", false));
        reject(s -> s.getJSONArray("key_family_references").remove(0));
        reject(s -> s.getJSONArray("key_family_references").put(1, family(s)));
        reject(s -> family(s).put("key_family", "FOREIGN"));
        reject(s -> family(s).put("source_declared_raw_rows_to_preserve", 6));
        reject(s -> family(s).put("source_declared_raw_rows_to_preserve", "5"));
        reject(s -> family(s).put("possible_undeclared_references", "NONE"));
        reject(s -> s.getJSONArray("records").remove(0));
        reject(s -> s.getJSONArray("records").put(1, row(s)));
        reject(s -> row(s).put("namespace", "ForeignDomain"));
        reject(s -> row(s).put("key_family", "SEPARATE_PROVIDER_V1"));
        reject(s -> row(s).put("raw_identity_sha256", "secret"));
        reject(s -> row(s).put("raw_type", "OBJECT"));
        reject(s -> row(s).put("local_source_classified", "true"));
        reject(s -> row(s).put("local_source_classified", false));
        reject(s -> row(s).put("local_source_classification", "UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED").put("vault_provider_source_state", "UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED"));
        reject(s -> row(s).put("local_source_classification", "ARBITRARY_ACCEPTED"));
        reject(s -> row(s).put("journal_source_state", "secret with spaces"));
        reject(s -> row(s).put("application_semantic_disposition", "SAFE_EMPTY"));
        reject(s -> s.put("native_semantic_inventory_state", "COMPLETE"));
        reject(s -> s.put("browser_inventory_state", "COMPLETE"));
        reject(s -> s.put("work_witnesses_do_not_cover_all8_values", false));
        reject(s -> s.put("cached_observations_are_historical_local_only", "true"));
        reject(s -> s.put("all_fixed_work_chunks_have_original_cached_observations", "false"));
        reject(s -> chunk(s).put("chunk_index", 1));
        reject(s -> chunk(s).put("chunk_index", 0.0));
        reject(s -> chunk(s).put("original_write_hmac_validated", "true"));
        reject(s -> s.put("batch_owner_state", "ACCEPTED"));
        for (String key : ROOT_FALSE.split(" ")) { reject(s -> s.put(key, true)); reject(s -> s.put(key, "false")); }
        for (String key : ROW_FALSE.split(" ")) reject(s -> row(s).put(key, true));
        for (String key : FAMILY_FALSE.split(" ")) reject(s -> family(s).put(key, true));
        for (String key : CHUNK_FALSE.split(" ")) reject(s -> chunk(s).put(key, true));
        reject(s -> ns(s).put("durable_retention", true));
        // Extra unknown flags (even in a nested witness) cannot smuggle authority.
        reject(s -> s.put("approved", true));
        reject(s -> ns(s).put("key_removal", true));
        reject(s -> family(s).put("work_accepted", true));
        reject(s -> chunk(s).put("finalizer_allowed", true));
        reject(s -> row(s).put("raw_secret", "MUST_NOT_DISPLAY"));
        reject(s -> s.put("records", "not-array"));
        reject(s -> s.getJSONArray("records").put(0, true));
        reject(s -> s.remove("record_count"));
        System.out.println("NEW inventory presentation checks=" + checks + " failures=0; PURE_SYNTHETIC_JSON_ONLY; Android/OS/manager/custody/effects NOT_PROVEN");
    }

    private static JSONObject fixture(boolean records) {
        JSONObject s = new JSONObject().put("schema", "custodial.native-retained-eight-namespace-semantic-join.v1")
            .put("state", "EXACT_ALL8_VALUES_AND_LOCAL_OWNER_SOURCE_CLASSIFICATIONS_JOINED_NOT_CUSTODY_OR_ACCEPTANCE")
            .put("original_generation_id", UUID).put("engine_revision", 42).put("record_count", records ? 8 : 0)
            .put("source_classified_record_count", records ? 4 : 0).put("unresolved_source_record_count", records ? 4 : 0)
            .put("native_semantic_inventory_state", "UNKNOWN").put("browser_inventory_state", "UNKNOWN")
            .put("batch_owner_state", "ORIGINAL_GENERATION_AND_FROZEN_VALUES_BOUND_BATCH_LAYOUT")
            .put("original_work_batch_operation_id", UUID).put("all_fixed_work_chunks_have_original_cached_observations", true)
            .put("work_witnesses_do_not_cover_all8_values", true).put("cached_observations_are_historical_local_only", true);
        for (String key : "source_capture_sha256 values_sha256 semantic_join_sha256 original_frozen_work_sha256 principal_digest".split(" ")) s.put(key, HASH);
        falseFlags(s, ROOT_FALSE);
        JSONArray names = new JSONArray(), rows = new JSONArray(), families = new JSONArray();
        for (int i = 0; i < 8; i++) {
            String family = FAMILIES[i < 5 ? 0 : i - 4];
            names.put(new JSONObject().put("namespace", NAMES[i]).put("key_family", family).put("record_count", records ? 1 : 0)
                .put("semantic_inventory_state", "UNKNOWN").put("durable_retention", false).put("empty_is_not_key_removal_authority", true));
            if (records) {
                String local = i % 2 == 0 ? "LOCAL_ORIGINAL_SOURCE_BOUND_NOT_ACCEPTED" : "NAMESPACE_SEMANTICS_UNRESOLVED_RETAINED";
                JSONObject row = new JSONObject().put("namespace", NAMES[i]).put("key_family", family).put("raw_identity_sha256", HASH)
                    .put("raw_type", "STRING").put("journal_source_state", local).put("vault_provider_source_state", local)
                    .put("local_source_classification", local).put("local_source_classified", i % 2 == 0)
                    .put("application_semantic_disposition", "UNKNOWN_RETAINED");
                falseFlags(row, ROW_FALSE); rows.put(row);
            }
        }
        for (int i = 0; i < 4; i++) {
            JSONObject f = new JSONObject().put("key_family", FAMILIES[i]).put("source_declared_raw_rows_to_preserve", records ? (i == 0 ? 5 : 1) : 0)
                .put("possible_undeclared_references", "UNKNOWN").put("zero_rows_is_not_key_removal_authority", true);
            falseFlags(f, FAMILY_FALSE); families.put(f);
        }
        JSONObject c = new JSONObject().put("chunk_index", 0).put("state", "LOCAL_WITNESS_NOT_CURRENT_SERVER")
            .put("write_journal_state", "COMMITTED").put("query_journal_state", "OBSERVED").put("cached_status", "PRESENT_CURRENT")
            .put("original_write_hmac_validated", true).put("original_target_query_hmac_validated", true)
            .put("cached_original_observation_validated", true).put("ambiguous_request_identity", false)
            .put("original_write_request_id", UUID).put("original_query_request_id", UUID)
            .put("original_write_body_sha256", HASH).put("original_query_body_sha256", HASH);
        falseFlags(c, CHUNK_FALSE);
        return s.put("namespaces", names).put("records", rows).put("key_family_references", families).put("original_work_journal_chunks", new JSONArray().put(c));
    }
    private static final String COMPLETION_FALSE = "saved_source_join_layout_capsule_identity_rewritten historical_snapshot_principal_verified clock_profile_qualified durable_retention all_writer_durable_freeze_or_ABA_guard resend_allowed new_work_allowed finalizer_allowed complete_namespace_inventory current_server_readback cutoff_eligible work_accepted inventory_acknowledged key_removal phone_released browser_source_authenticated";
    private static final String RECEIPT = "ORIGINAL_NATIVE_COMPLETION_SESSION_VALUES_MATCH_NOT_ACCEPTANCE";
    private static final String PAIR = "ORIGINAL_COMPLETION_SESSION_JOIN_ONLY_NOT_ELIGIBILITY";

    private static void completionPresentationCases() throws Exception {
        JSONObject value = completionFixture(true); String before = value.toString();
        String rendered = NativeManagerInventoryPresentation.completionSummary(value);
        check(before.equals(value.toString()));
        check(rendered.contains("Totals: retained 10, matched original completion/session triples 1, joined rows 3, unresolved retained rows 7"));
        check(rendered.contains(NAMES[1] + ": retained 3, completion/session joined 3, unresolved 0"));
        completionNoSecrets(value, rendered);
        JSONObject zero = completionFixture(false);
        check(NativeManagerInventoryPresentation.completionSummary(zero).contains("retained 0, matched original completion/session triples 0, joined rows 0, unresolved retained rows 0"));
        value.put("matched_completion_count", 99); check(rendered.contains("triples 1")); // detached result
        completionRefuse(null);
        completionReject(s -> s.put("schema", "foreign"));
        completionReject(s -> s.put("state", "ACCEPTED"));
        completionReject(s -> s.put("matched_completion_count", 2));
        completionReject(s -> s.put("completion_semantic_joined_record_count", 2));
        completionReject(s -> s.put("application_unresolved_record_count", 6));
        completionReject(s -> s.put("matched_completion_count", 0).put("completion_semantic_joined_record_count", 0).put("application_unresolved_record_count", 10));
        for (String field : new String[]{"record_count", "matched_completion_count", "completion_semantic_joined_record_count", "application_unresolved_record_count", "engine_revision"}) {
            for (Object bad : new Object[]{-1, "1", 1.0, true, JSONObject.NULL, new BigInteger("1")}) completionReject(s -> s.put(field, bad));
        }
        completionReject(s -> s.put("record_count", Long.MAX_VALUE));
        completionReject(s -> s.getJSONArray("records").remove(0));
        completionReject(s -> s.getJSONArray("records").put(0, true));
        completionReject(s -> s.getJSONArray("records").put(0, s.getJSONArray("records").getJSONObject(1)));
        completionReject(s -> s.getJSONArray("namespaces").put(0, s.getJSONArray("namespaces").getJSONObject(1)));
        completionReject(s -> s.getJSONArray("namespaces").getJSONObject(1).put("record_count", 4));
        completionReject(s -> s.getJSONArray("key_family_references").getJSONObject(0).put("source_declared_raw_rows_to_preserve", 8));
        completionReject(s -> s.getJSONArray("key_family_references").put(1, s.getJSONArray("key_family_references").getJSONObject(0)));
        completionReject(s -> s.getJSONArray("records").getJSONObject(1).put("key_family", "LEGACY_VAULT_V1"));
        completionReject(s -> s.getJSONArray("records").getJSONObject(1).put("raw_identity_sha256", "not-a-hash"));
        completionReject(s -> completion(s, 1).put("raw_identity_sha256", completion(s, 8).get("raw_identity_sha256")));
        completionReject(s -> completion(s, 1).put("argument_provenance", "CALLER_JSON"));
        completionReject(s -> completion(s, 1).put("argument_values_sha256", "wrong"));
        completionReject(s -> completion(s, 1).put("receipt_binding_sha256", "wrong"));
        completionReject(s -> completion(s, 1).put("finish_cutoff_relation", "ELIGIBLE"));
        completionReject(s -> completion(s, 8).put("kind", "FINISH_PROOF"));
        completionReject(s -> completion(s, 8).put("state", RECEIPT));
        completionReject(s -> completion(s, 1).put("automatic_acceptance", true));
        completionReject(s -> completion(s, 1).put("raw_record", "MUST_NOT_DISPLAY"));
        completionReject(s -> s.getJSONArray("records").getJSONObject(1).remove("native_completion_semantics"));
        completionReject(s -> s.getJSONArray("records").getJSONObject(0).put("native_completion_semantics", completion(s, 1)));
        completionReject(s -> s.getJSONArray("records").getJSONObject(2).put("application_semantic_disposition", "ORIGINAL_WRITE_HMAC_VALID_NOT_ACCEPTED"));
        completionReject(s -> s.getJSONArray("records").getJSONObject(1).put("local_source_classified", true));
        completionReject(s -> s.put("native_semantic_inventory_state", "COMPLETE"));
        completionReject(s -> s.put("browser_inventory_state", "COMPLETE"));
        completionReject(s -> s.put("completion_reconciliation_sha256", "00".repeat(32)));
        for (String pin : "source_capture_sha256 values_sha256 original_source_join_sha256 original_signed_manifest_sha256 principal_digest original_generation_id".split(" "))
            completionReject(s -> s.put(pin, pin.equals("original_generation_id") ? "22222222-2222-2222-2222-222222222222" : "cd".repeat(32)));
        for (String flag : COMPLETION_FALSE.split(" ")) { completionReject(s -> s.put(flag, true)); completionReject(s -> s.put(flag, "false")); }
        for (String flag : (ROW_FALSE + " cutoff_eligible browser_source_authenticated").split(" ")) completionReject(s -> s.getJSONArray("records").getJSONObject(1).put(flag, true));
        for (String flag : FAMILY_FALSE.split(" ")) completionReject(s -> s.getJSONArray("key_family_references").getJSONObject(0).put(flag, true));
        for (String flag : CHUNK_FALSE.split(" ")) completionReject(s -> s.getJSONArray("original_work_journal_chunks").getJSONObject(0).put(flag, true));
        completionReject(s -> s.put("approved", true));
        completionReject(s -> s.remove("records"));
        // Integer/Long are the producer's accepted integral representation; no numeric coercion.
        JSONObject longs = completionFixture(true); longs.put("record_count", 10L).put("matched_completion_count", 1L).put("completion_semantic_joined_record_count", 3L).put("application_unresolved_record_count", 7L);
        check(rendered.equals(NativeManagerInventoryPresentation.completionSummary(longs)));
        System.out.println("NEW completion presentation checks=" + checks + " failures=0; SYNTHETIC_JSON_ONLY; owning fixture and Android/currentness/auth/effects NOT_PROVEN");
    }
    private static void completionNoSecrets(JSONObject value, String rendered) {
        check(rendered.contains("NOT eligibility, current server acceptance, browser authentication/inventory, or durable writer-fence authority."));
        check(rendered.contains("No ACK, work acceptance, resend, finalizer, key-removal, phone-release, or other effect rights."));
        for (String field : "source_capture_sha256 values_sha256 original_source_join_sha256 completion_reconciliation_sha256 original_signed_manifest_sha256 original_generation_id principal_digest".split(" ")) check(!rendered.contains(value.getString(field)));
        JSONArray rows = value.getJSONArray("records");
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i); check(!rendered.contains(row.getString("raw_identity_sha256")));
            if (row.has("native_completion_semantics")) {
                JSONObject c = row.getJSONObject("native_completion_semantics"); check(!rendered.contains(c.getString("raw_identity_sha256")));
                for (String key : new String[]{"argument_values_sha256", "receipt_binding_sha256"}) if (c.has(key)) check(!rendered.contains(c.getString(key)));
            }
        }
    }
    private static JSONObject completionFixture(boolean populated) throws Exception {
        JSONObject source = fixture(populated), value = new JSONObject().put("schema", "custodial.native-all8-original-completion-reconciliation.v1")
            .put("state", "ALL8_EXACT_ROWS_WITH_ORIGINAL_NATIVE_COMPLETION_SEMANTICS_NOT_ACCEPTANCE")
            .put("original_generation_id", UUID).put("principal_digest", HASH).put("engine_revision", 42)
            .put("record_count", populated ? 10 : 0).put("completion_semantic_joined_record_count", populated ? 3 : 0)
            .put("matched_completion_count", populated ? 1 : 0).put("application_unresolved_record_count", populated ? 7 : 0)
            .put("native_semantic_inventory_state", "UNKNOWN").put("browser_inventory_state", "UNKNOWN");
        for (String field : "source_capture_sha256 values_sha256 original_source_join_sha256 original_signed_manifest_sha256".split(" ")) value.put(field, HASH);
        falseFlags(value, COMPLETION_FALSE);
        for (String field : "namespaces records key_family_references original_work_journal_chunks".split(" ")) value.put(field, source.get(field));
        JSONArray rows = value.getJSONArray("records");
        for (int i = 0; i < rows.length(); i++) rows.getJSONObject(i).put("application_semantic_disposition", "UNRECONCILED_RECORD_RETAINED").put("cutoff_eligible", false).put("browser_source_authenticated", false);
        if (populated) {
            JSONObject work = rows.getJSONObject(1);
            work.put("application_semantic_disposition", RECEIPT).put("native_completion_semantics", new JSONObject()
                .put("raw_identity_sha256", "01".repeat(32)).put("kind", "COMPLETION_RECEIPT").put("state", RECEIPT).put("automatic_acceptance", false)
                .put("argument_provenance", "CAPTURED_NATIVE_ORIGINAL_V3_VALUES").put("argument_values_sha256", HASH).put("receipt_binding_sha256", HASH)
                .put("start_cutoff_relation", "BEFORE").put("finish_cutoff_relation", "AFTER"));
            for (int i = 0; i < 2; i++) rows.put(new JSONObject(work.toString()).put("raw_identity_sha256", (i == 0 ? "02" : "03").repeat(32))
                .put("application_semantic_disposition", PAIR).put("native_completion_semantics", new JSONObject().put("raw_identity_sha256", (i == 0 ? "04" : "05").repeat(32))
                    .put("kind", i == 0 ? "OCCURRENCE" : "FINISH_PROOF").put("state", PAIR).put("automatic_acceptance", false)));
            value.getJSONArray("namespaces").getJSONObject(1).put("record_count", 3);
            value.getJSONArray("key_family_references").getJSONObject(0).put("source_declared_raw_rows_to_preserve", 7);
        }
        // Independent DataOutputStream encoding of the producer's UTF-16 transcript, not authentication.
        var bytes = new java.io.ByteArrayOutputStream(); var output = new java.io.DataOutputStream(bytes);
        for (String field : "schema source_capture_sha256 values_sha256 original_source_join_sha256 original_signed_manifest_sha256 principal_digest original_generation_id engine_revision".split(" ")) {
            String item = value.get(field).toString(); output.writeInt(item.length()); output.writeChars(item);
        }
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            for (String field : new String[]{"namespace", "raw_identity_sha256", "application_semantic_disposition"}) { String item = row.getString(field); output.writeInt(item.length()); output.writeChars(item); }
            if (row.has("native_completion_semantics")) {
                JSONObject c = row.getJSONObject("native_completion_semantics"); var fields = new java.util.TreeSet<String>(); c.keys().forEachRemaining(fields::add);
                for (String field : fields) for (String item : new String[]{field, c.get(field).toString()}) { output.writeInt(item.length()); output.writeChars(item); }
            }
        }
        return value.put("completion_reconciliation_sha256", java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray())));
    }
    private static JSONObject completion(JSONObject value, int index) { return value.getJSONArray("records").getJSONObject(index).getJSONObject("native_completion_semantics"); }
    private static void completionReject(Consumer<JSONObject> mutation) throws Exception { JSONObject value = completionFixture(true); mutation.accept(value); completionRefuse(value); }
    private static void completionRefuse(JSONObject value) {
        String before = value == null ? null : value.toString();
        try { NativeManagerInventoryPresentation.completionSummary(value); throw new AssertionError("malformed_completion_accepted"); }
        catch (IllegalArgumentException expected) { check("native_manager_inventory_presentation_invalid".equals(expected.getMessage()) && expected.getCause() == null); }
        if (value != null) check(before.equals(value.toString()));
    }


    // NEW browser candidate vectors use detached synthetic JSON only. Neither
    // their digest nor a legacy binding fact authenticates browser/native work.
    private static final String LEGACY_CANDIDATE_PROVENANCE="BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE";
    private static final String[] CANDIDATE_STATES={
        "UNMATCHED_ARGUMENT_CANDIDATE_RETAINED","UNINSPECTABLE_ARGUMENT_CANDIDATE_RETAINED",
        "AMBIGUOUS_ARGUMENT_CANDIDATE_RETAINED","ARGUMENT_VALUES_MISMATCH_RETAINED",
        "NATIVE_COMPLETION_UNRESOLVED_RETAINED","AMBIGUOUS_SESSION_ARGUMENT_RETAINED",
        "ARGUMENT_VALUES_MATCH_NATIVE_COMPLETION_UNAUTHENTICATED_SOURCE"};
    private static JSONObject browserCandidateFixture(boolean legacy)throws Exception {
        JSONObject value=completionFixture(true);JSONArray candidates=new JSONArray();
        for(int i=0;i<CANDIDATE_STATES.length;i++)candidates.put(new JSONObject()
            .put("argument_values_sha256",i==6?HASH:String.format("%064x",i+1))
            .put("state",CANDIDATE_STATES[i]).put("source_authenticated",false));
        value.put("argument_candidate_count",7).put("unresolved_argument_candidate_count",6).put("argument_candidates",candidates);
        if(legacy)completion(value,1).put("argument_provenance",LEGACY_CANDIDATE_PROVENANCE);
        return browserCandidateRehash(value);
    }
    private static JSONObject browserCandidateRehash(JSONObject value)throws Exception {
        // Independent DataOutputStream transcription, retaining all original
        // field/row ordering. No producer/class/authority implementation is copied.
        var bytes=new java.io.ByteArrayOutputStream();var output=new java.io.DataOutputStream(bytes);
        for(String field:"schema source_capture_sha256 values_sha256 original_source_join_sha256 original_signed_manifest_sha256 principal_digest original_generation_id engine_revision".split(" "))
            candidateHashText(output,value.get(field).toString());
        JSONArray rows=value.getJSONArray("records");
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);
            for(String field:new String[]{"namespace","raw_identity_sha256","application_semantic_disposition"})candidateHashText(output,row.getString(field));
            if(row.has("native_completion_semantics")){
                JSONObject c=row.getJSONObject("native_completion_semantics");var fields=new java.util.TreeSet<String>();c.keys().forEachRemaining(fields::add);
                for(String field:fields){candidateHashText(output,field);candidateHashText(output,c.get(field).toString());}
            }
        }
        if(value.has("argument_candidates")){
            candidateHashText(output,"browser_argument_candidates.v1");
            candidateHashText(output,value.get("argument_candidate_count").toString());
            candidateHashText(output,value.get("unresolved_argument_candidate_count").toString());
            JSONArray candidates=value.getJSONArray("argument_candidates");
            for(int i=0;i<candidates.length();i++){
                JSONObject row=candidates.getJSONObject(i);
                for(String field:new String[]{"argument_values_sha256","state","source_authenticated"})candidateHashText(output,row.get(field).toString());
            }
        }
        return value.put("completion_reconciliation_sha256",java.util.HexFormat.of().formatHex(
            java.security.MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray())));
    }
    private static void candidateHashText(java.io.DataOutputStream out,String value)throws Exception {out.writeInt(value.length());out.writeChars(value);}
    private static void browserCandidateReject(Consumer<JSONObject> mutation,boolean rehash)throws Exception {
        JSONObject value=browserCandidateFixture(false);mutation.accept(value);
        if(rehash)browserCandidateRehash(value);completionRefuse(value);
    }
    private static void browserCandidateGolden()throws Exception {
        JSONObject value=browserCandidateFixture(false);String before=value.toString();
        // Golden suffix hashes independently calculated with Node length-prefixed
        // UTF16BE transcript, not by the renderer/owning Native join.
        check(value.getString("completion_reconciliation_sha256").equals("ee56e7f2aa02f1849bcca672a33211381291704f4bcf7ec22fac62af7dbda096"));
        String text=NativeManagerInventoryPresentation.completionSummary(value);
        check(before.equals(value.toString()));
        check(text.contains("Browser argument candidates: retained 7, unresolved retained 6"));
        check(text.contains("Source-unverified; NOT accepted work or browser authentication."));
        check(!text.contains("Legacy-v2 browser-argument binding matches"));
        completionNoSecrets(value,text);
        for(int i=0;i<7;i++)check(!text.contains(value.getJSONArray("argument_candidates").getJSONObject(i).getString("argument_values_sha256")));
        value.getJSONArray("argument_candidates").getJSONObject(0).put("argument_values_sha256","ff".repeat(32));
        check(text.contains("retained 7, unresolved retained 6"));completionRefuse(value);
    }
    private static void browserCandidateLegacyAndProvenance()throws Exception {
        JSONObject legacy=browserCandidateFixture(true);
        check(legacy.getString("completion_reconciliation_sha256").equals("52c9de6f1de788f79e3cd927e43107bd8d5d64f37c8ccb6aba783136c64ce07d"));
        String rendered=NativeManagerInventoryPresentation.completionSummary(legacy);
        check(rendered.contains("Legacy-v2 browser-argument binding matches: 1. Source-unverified; NOT native-v3 acceptance."));
        check(rendered.contains("No ACK, work acceptance, resend, finalizer, key-removal, phone-release, or other effect rights."));
        completionNoSecrets(legacy,rendered);
        JSONObject fixed=browserCandidateFixture(false);
        completion(fixed,1).put("argument_provenance","CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN");browserCandidateRehash(fixed);
        check(NativeManagerInventoryPresentation.completionSummary(fixed).contains("retained 7, unresolved retained 6"));
        JSONObject oldShape=completionFixture(true);completion(oldShape,1).put("argument_provenance",LEGACY_CANDIDATE_PROVENANCE);
        browserCandidateRehash(oldShape);completionRefuse(oldShape); // no candidates => legacy fact remains disallowed
        browserCandidateReject(s->completion(s,1).put("argument_provenance","CALLER_JSON"),true);
    }
    private static void browserCandidateClosedTypesAndCounts()throws Exception {
        for(String missing:new String[]{"argument_candidate_count","unresolved_argument_candidate_count","argument_candidates"})
            browserCandidateReject(s->s.remove(missing),false);
        for(String field:new String[]{"argument_candidate_count","unresolved_argument_candidate_count"}){
            for(Object bad:new Object[]{-1,4097,"1",1.0,true,JSONObject.NULL,new BigInteger("1")})
                browserCandidateReject(s->s.put(field,bad),false);
        }
        browserCandidateReject(s->s.put("argument_candidate_count",0).put("unresolved_argument_candidate_count",0).put("argument_candidates",new JSONArray()),true);
        browserCandidateReject(s->s.put("unresolved_argument_candidate_count",7),true);
        browserCandidateReject(s->s.put("unresolved_argument_candidate_count",8),true);
        browserCandidateReject(s->s.put("argument_candidate_count",8),false);
        browserCandidateReject(s->s.put("argument_candidates","not-array"),false);
        browserCandidateReject(s->s.getJSONArray("argument_candidates").put(0,true),false);
        for(String field:new String[]{"argument_values_sha256","state","source_authenticated"})
            browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).remove(field),false);
        browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("extra",false),true);
        for(Object bad:new Object[]{"bad","A".repeat(64),7,JSONObject.NULL})
            browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("argument_values_sha256",bad),false);
        for(Object bad:new Object[]{"ACCEPTED",7,JSONObject.NULL})
            browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("state",bad),false);
        for(Object bad:new Object[]{true,"false",0,JSONObject.NULL})
            browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("source_authenticated",bad),false);
        browserCandidateReject(s->s.put("candidate_authority",false),false);
    }
    private static void browserCandidateDigestOrderAndFalseRights()throws Exception {
        browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("argument_values_sha256","cd".repeat(32)),false);
        browserCandidateReject(s->s.getJSONArray("argument_candidates").getJSONObject(0).put("state",CANDIDATE_STATES[1]),false);
        browserCandidateReject(s->{
            JSONArray c=s.getJSONArray("argument_candidates");Object first=c.get(0);c.put(0,c.get(1));c.put(1,first);
        },false);
        browserCandidateReject(s->s.put("completion_reconciliation_sha256","00".repeat(32)),false);
        for(String right:COMPLETION_FALSE.split(" "))browserCandidateReject(s->s.put(right,true),true);
        for(String right:(ROW_FALSE+" cutoff_eligible browser_source_authenticated").split(" "))
            browserCandidateReject(s->s.getJSONArray("records").getJSONObject(1).put(right,true),true);
        browserCandidateReject(s->completion(s,1).put("automatic_acceptance",true),true);
        browserCandidateReject(s->s.put("native_semantic_inventory_state","COMPLETE"),true);
        browserCandidateReject(s->s.put("browser_inventory_state","AUTHENTICATED"),true);
    }
    private static void browserCandidateBoundaries()throws Exception {
        for(int n:new int[]{1,4096}){
            JSONObject value=browserCandidateFixture(false);JSONArray rows=new JSONArray();
            for(int i=0;i<n;i++)rows.put(new JSONObject().put("argument_values_sha256",HASH).put("state",CANDIDATE_STATES[6]).put("source_authenticated",false));
            value.put("argument_candidate_count",(long)n).put("unresolved_argument_candidate_count",0L).put("argument_candidates",rows);
            browserCandidateRehash(value);
            check(NativeManagerInventoryPresentation.completionSummary(value).contains("Browser argument candidates: retained "+n+", unresolved retained 0"));
        }
    }

    private static final String READ_EFFECTS = "inventory_acknowledged work_accepted replay_allowed finalizer_allowed key_removal phone_released";
    private static JSONObject currentReadFixture(int accepted, int unresolved) {
        // Main's declared exact14-field Engine projection, SYNTHETIC DTO only;
        // the actual Engine producer is not exported in the inspected source.
        JSONObject value = new JSONObject().put("schema", "custodial.native-original-completion-read-observation.v1")
            .put("state", "CURRENT_AUTHENTICATED_ORIGINAL_COMPLETION_READS_NOT_ACK")
            .put("operation_id", UUID).put("original_generation_id", "22222222-2222-2222-2222-222222222222")
            .put("selected_argument_count", accepted + unresolved).put("accepted_count", accepted)
            .put("unresolved_selected_count", unresolved).put("readback_set_sha256", HASH);
        falseFlags(value, READ_EFFECTS); return value;
    }
    private static void currentReadRefuse(JSONObject value) {
        String before = value == null ? null : value.toString();
        String returned = null;
        try { returned = NativeManagerInventoryPresentation.currentCompletionReadSummary(value); throw new AssertionError("malformed_current_read_accepted"); }
        catch (IllegalArgumentException expected) { check("native_manager_inventory_presentation_invalid".equals(expected.getMessage()) && expected.getCause() == null); }
        check(returned == null); // Refusal cannot return partial/success text.
        if (value != null) check(before.equals(value.toString()));
    }
    private static void currentReadReject(Consumer<JSONObject> mutation) {
        JSONObject value = currentReadFixture(2, 1); mutation.accept(value); currentReadRefuse(value);
    }
    private static void currentReadPresentationCases() {
        for (int[] counts : new int[][]{{0, 0}, {2, 1}, {0, 4096}, {4096, 0}, {2048, 2048}}) {
            JSONObject value = currentReadFixture(counts[0], counts[1]); String before = value.toString();
            check(value.length() == 14);
            String rendered = NativeManagerInventoryPresentation.currentCompletionReadSummary(value);
            check(rendered.startsWith("Authenticated original completion reads: " + counts[0] + " accepted originals; " + counts[1] + " unresolved selected originals."));
            check(rendered.contains("Other unresolved retained work is not counted as accepted."));
            check(rendered.contains("Empty selection is not proof of empty work or complete inventory."));
            check(rendered.endsWith("No ACK, resend, finalization or key removal."));
            check(before.equals(value.toString()));
            for (String pin : new String[]{"operation_id", "original_generation_id", "readback_set_sha256"}) check(!rendered.contains(value.getString(pin)));
            value.put("accepted_count", 9999); check(rendered.contains(counts[0] + " accepted originals"));
        }
        JSONObject longs = currentReadFixture(2, 1);
        longs.put("selected_argument_count", 3L).put("accepted_count", 2L).put("unresolved_selected_count", 1L);
        check(NativeManagerInventoryPresentation.currentCompletionReadSummary(longs).equals(NativeManagerInventoryPresentation.currentCompletionReadSummary(currentReadFixture(2, 1))));
        currentReadRefuse(null);
        for (String field : currentReadFixture(2, 1).keySet()) currentReadReject(s -> s.remove(field));
        currentReadReject(s -> s.put("schema", "foreign")); currentReadReject(s -> s.put("state", "ACKNOWLEDGED"));
        for (String field : new String[]{"operation_id", "original_generation_id"}) {
            for (Object bad : new Object[]{"not-uuid", "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", UUID + "\n", 7, JSONObject.NULL}) currentReadReject(s -> s.put(field, bad));
        }
        for (Object bad : new Object[]{"A".repeat(64), "a".repeat(63), HASH + "\n", 7, JSONObject.NULL}) currentReadReject(s -> s.put("readback_set_sha256", bad));
        for (String field : new String[]{"selected_argument_count", "accepted_count", "unresolved_selected_count"}) {
            for (Object bad : new Object[]{-1, 4097, Long.MAX_VALUE, "1", 1.0, true, JSONObject.NULL, new BigInteger("1")}) currentReadReject(s -> s.put(field, bad));
        }
        currentReadReject(s -> s.put("selected_argument_count", 4));
        currentReadReject(s -> s.put("accepted_count", 3));
        currentReadReject(s -> s.put("unresolved_selected_count", 2));
        currentReadReject(s -> s.put("selected_argument_count", 0));
        currentReadReject(s -> s.put("accepted_count", 4096).put("unresolved_selected_count", 4096));
        for (String flag : READ_EFFECTS.split(" ")) {
            for (Object bad : new Object[]{true, "false", 0, JSONObject.NULL}) currentReadReject(s -> s.put(flag, bad));
        }
        for (String extra : new String[]{"private_payload", "approved", "complete_inventory", "browser_authenticated", "resend_allowed"}) currentReadReject(s -> s.put(extra, false));
        System.out.println("NEW current completion read presentation checks=" + checks + " failures=0; SYNTHETIC_ENGINE_DTO_ONLY; authentication/currentness/SQL/Android/ACK NOT_PROVEN");
    }

    private static void falseFlags(JSONObject s, String keys) { for (String key : keys.split(" ")) s.put(key, false); }
    private static JSONObject ns(JSONObject s) { return s.getJSONArray("namespaces").getJSONObject(0); }
    private static JSONObject row(JSONObject s) { return s.getJSONArray("records").getJSONObject(0); }
    private static JSONObject family(JSONObject s) { return s.getJSONArray("key_family_references").getJSONObject(0); }
    private static JSONObject chunk(JSONObject s) { return s.getJSONArray("original_work_journal_chunks").getJSONObject(0); }
    private static void reject(Consumer<JSONObject> mutation) { JSONObject s = fixture(true); mutation.accept(s); refuse(s); }
    private static void refuse(JSONObject s) {
        try { NativeManagerInventoryPresentation.summary(s); throw new AssertionError("malformed_input_accepted"); }
        catch (IllegalArgumentException expected) { check("native_manager_inventory_presentation_invalid".equals(expected.getMessage()) && expected.getCause() == null); }
    }
    private static void check(boolean ok) { checks++; if (!ok) throw new AssertionError("inventory_presentation_check_" + checks); }
}
