import { createHash } from 'node:crypto';

const OWNER_RECEIPT_SCHEMAS = Object.freeze({
  piece: 'custodial.original-piece0-completed-SQL-with-protected-credential-guard.v1',
  components: 'custodial.bounded-original-piece-separate-current-SQL-components.v1',
  native: 'custodial.native-returned-original-query-piece-assembly-source-proof.v1',
  http: 'custodial.owning-http-bounded-original-query-source-proof.v1',
  g01: 'custodial.G01-current-owning-complete-frame-source-proof.v1',
});

const G01_CONTEXT_SCHEMA = 'custodial.G01-owner-receipt-trusted-context.v1';
const SHA256 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;

function requiredKeys(value, keys, label) {
  exactKeys(value, keys, label);
  for (const key of keys) if (!(key in value)) fail(`${label} missing required field: ${key}`);
}
function presentKeys(value, keys, label) {
  object(value, label);
  for (const key of keys) if (!(key in value)) fail(`${label} missing required field: ${key}`);
}

function sha(value, label) { if (typeof value !== 'string' || !SHA256.test(value)) fail(`${label} must be lowercase sha256`); }
function tuple(value, label) {
  requiredKeys(value, ['commit', 'tree'], label);
  if (typeof value.commit !== 'string' || !HEX40.test(value.commit) || typeof value.tree !== 'string' || !HEX40.test(value.tree)) fail(`${label} commit/tree invalid`);
}
function bool(value, label) { if (value !== true && value !== false) fail(`${label} must be boolean`); }
function exactFalse(value, label) { if (value !== false) fail(`${label} must be false`); }
function digestBytes(bytes) { return createHash('sha256').update(bytes, 'utf8').digest('hex'); }

function byteView(payload, label) {
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  fail(`${label} must be Buffer, Uint8Array, or immutable UTF8 string`);
}
function checkUnderlyingPin(receiptEvidence, trusted, label) {
  requiredKeys(trusted, ['path', 'bytes', 'sha256', 'payload'], `${label} trusted`);
  const payload = byteView(trusted.payload, `${label} payload`);
  if (!Number.isInteger(trusted.bytes) || trusted.bytes < 0 || trusted.bytes !== payload.length) fail(`${label} trusted bytes do not match payload`);
  sha(trusted.sha256, `${label} trusted.sha256`);
  if (digestBytes(payload) !== trusted.sha256) fail(`${label} payload hash mismatch`);
  const found = receiptEvidence.find((entry) => entry.path === trusted.path);
  if (!found || found.bytes !== trusted.bytes || found.sha256 !== trusted.sha256) fail(`${label} is not pinned to the receipt evidence`);
  try { return JSON.parse(payload.toString('utf8')); } catch { fail(`${label} payload JSON is malformed`); }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function fail(message) {
  throw new Error(`Owner receipt inspection failed: ${message}`);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  object(value, label);
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`${label} contains unknown fields: ${unknown.join(', ')}`);
}

function exactSourcePair(receipt, expected, label) {
  const frontend = receipt.frontend;
  const backend = receipt.backend;
  if (!frontend || !backend
      || frontend.commit !== expected.frontend.commit
      || frontend.tree !== expected.frontend.tree
      || backend.commit !== expected.backend.commit
      || backend.tree !== expected.backend.tree) {
    fail(`${label} source commit/tree does not match the independently bound pair`);
  }
}

function inspectPieceReceipt(value, expectedSourcePair) {
  exactKeys(value, [
    'schema', 'at_utc', 'status', 'frontend', 'backend', 'source_pair', 'artifacts',
    'actual_denial', 'cleanup', 'native_HTTP_TLS_Android_semantic_ACK_finalizer_key_removal_audit_build_install_deploy_physical',
    'ONE_email_TEST', 'phone_owner', 'audits', 'nextstep', 'completed_component',
  ], 'piece receipt');
  if (value.schema !== OWNER_RECEIPT_SCHEMAS.piece) fail('unknown piece receipt schema');
  if (value.status !== 'ONE_NEW_ACTUAL_SQL_PIECE0_COMPONENT_COMPLETE_WHOLE_RUN_FAILED_SECOND_FIXTURE_DENIED') {
    fail('piece receipt status is not the reviewed partial-component status');
  }
  exactSourcePair(value, expectedSourcePair, 'piece receipt');
  if (value.actual_denial?.revoked_credential_reader_case_NOT_executed_or_qualified !== true
      || value.actual_denial?.protected_rows_not_changed !== true
      || value.native_HTTP_TLS_Android_semantic_ACK_finalizer_key_removal_audit_build_install_deploy_physical !== false) {
    fail('piece receipt contains contradictory authority or qualification claims');
  }
  return Object.freeze({
    disposition: 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE',
    scope_complete: false,
    source_evidence_status: 'INCOMPLETE',
    deferred: Object.freeze(['whole original run', 'remaining return pieces', 'native/HTTP/physical qualification']),
  });
}

function inspectComponentsReceipt(value, expectedSourcePair) {
  exactKeys(value, [
    'schema', 'at_utc', 'status', 'frontend', 'backend', 'source_pair', 'recoverable',
    'positive_component', 'separate_negative_component', 'artifacts', 'prior_actual_denial',
    'revoked_credential_reader_case_NOT_executed_or_qualified', 'cleanup', 'native_HTTP_TLS_Android_semantic_ACK_finalizer_key_removal_audit_build_install_deploy_physical',
    'ONE_email_TEST', 'phone_owner', 'audits', 'nextstep', 'limitations', 'skill_guidance',
    'semantic_inventory_ACK_resend_finalizer_key_removal_audit_ready_build_install_deploy_physical',
  ], 'component receipt');
  if (value.schema !== OWNER_RECEIPT_SCHEMAS.components) fail('unknown component receipt schema');
  if (value.status !== 'ONE_COMPLETED_ACTUAL_PIECE0_COMPONENT_PLUS_SEPARATE_INCOMPLETE_RETURN_REFUSAL_PASS_NOT_SINGLE_RUN_SUITE_PASS') {
    fail('component receipt status is not the reviewed partial-component status');
  }
  exactSourcePair(value, expectedSourcePair, 'component receipt');
  if (value.positive_component?.original_failed_whole_run_preserved !== true
      || value.separate_negative_component?.only_new_unfinished_API_boundary !== true
      || value.prior_actual_denial?.revoked_credential_reader_case_NOT_executed_or_qualified !== true
      || value.prior_actual_denial?.protected_rows_not_changed !== true
      || value.semantic_inventory_ACK_resend_finalizer_key_removal_audit_ready_build_install_deploy_physical !== false) {
    fail('component receipt lacks the required partial/negative/authority dispositions');
  }
  return Object.freeze({
    disposition: 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE',
    scope_complete: false,
    source_evidence_status: 'INCOMPLETE',
    deferred: Object.freeze(['whole SQL/source suite', 'remaining return pieces', 'native/HTTP/physical qualification']),
  });
}

function inspectNativeReceipt(value, expectedSourcePair) {
  exactKeys(value, [
    'schema', 'at_utc', 'audits', 'backend', 'cleanup', 'frontend', 'implemented',
    'inventory_ACK_complete_semantics_resend_finalizer_key_removal_audit_build_sign_install_deploy_or_physical',
    'limitations', 'nextstep', 'phone_owner', 'prior_evidence_rebind', 'qualification', 'recoverable', 'source_pair',
    'ONE_email_TEST',
  ], 'native receipt');
  if (value.schema !== OWNER_RECEIPT_SCHEMAS.native) fail('unknown native receipt schema');
  exactSourcePair(value, expectedSourcePair, 'native receipt');
  if (value.implemented?.read_only_no_write_query_ACK_finalizer_or_key_removal_capability !== true
      || value.implemented?.pending_alias_corrupt_absent_or_legacy_reply_cannot_assemble_or_resend !== true
      || value.qualification?.new_methods !== 13
      || value.qualification?.NOT_single_run_suite_PASS !== true
      || value.qualification?.observer_failure_reconciliation?.original_failure_not_overwritten !== true
      || value.qualification?.observer_failure_reconciliation?.tests_executed_by_reconciler !== 0
      || value.inventory_ACK_complete_semantics_resend_finalizer_key_removal_audit_build_sign_install_deploy_or_physical !== false
      || value.limitations?.actual_Android_storage_keystore_TLS_and_physical_qualification !== false
      || value.limitations?.native_HTTP_actual_SQL_current_source_composition !== 'OPEN') {
    fail('native receipt lacks preserved failure/component-only dispositions');
  }
  if (!Array.isArray(value.qualification?.failures_retained) || value.qualification.failures_retained.length < 1) {
    fail('native receipt does not retain its historical failures');
  }
  return Object.freeze({
    disposition: 'NATIVE_SOURCE_COMPONENTS_COMPLETE_OVERALL_INCOMPLETE',
    scope_complete: false,
    source_evidence_status: 'INCOMPLETE',
    deferred: Object.freeze(['whole native assembly/source suite', 'current SQL/HTTP/native composition', 'runtime/Android/physical qualification']),
    component_count: 13,
  });
}

function inspectHttpReceipt(value, expectedSourcePair) {
  exactKeys(value, [
    'schema', 'at_utc', 'audits', 'backend', 'cleanup', 'frontend', 'implemented', 'limitations', 'nextstep',
    'operational_inventory_ACK_finalizer_key_removal_build_sign_install_deploy_or_physical', 'phone_owner',
    'prior_evidence_rebound_NOT_replayed', 'qualification', 'recoverable', 'source_pair', 'ONE_email_TEST',
  ], 'HTTP receipt');
  if (value.schema !== OWNER_RECEIPT_SCHEMAS.http) fail('unknown HTTP receipt schema');
  exactSourcePair(value, expectedSourcePair, 'HTTP receipt');
  if (value.qualification?.new_owning_source_cases !== 10
      || value.qualification?.old_proof_groups_replayed !== 0
      || value.qualification?.source_modules_are_real_callbacks_and_streams_are_injected !== true
      || value.implemented?.reader_choice_pinned_before_awaits_no_dynamic_or_client_switch !== true
      || value.implemented?.fixed_complete_frame_RPC_only_bounded_reader_original_chunk_NO_range_or_partial_fallback !== true
      || value.implemented?.parser_limits_restore_guards_disconnection_wait_cleanup_capture_and_raw_bytes_preserved !== true
      || value.operational_inventory_ACK_finalizer_key_removal_build_sign_install_deploy_or_physical !== false
      || value.limitations?.no_live_activation !== true
      || value.limitations?.source_selected_reader_NOT_HTTP_socket_TLS_SQL_native_runtime_composition !== true
      || value.limitations?.actual_Android_keystore_storage_phone_physical !== false) {
    fail('HTTP receipt lacks preserved source-only/operationally-incomplete dispositions');
  }
  return Object.freeze({
    disposition: 'HTTP_SOURCE_COMPONENTS_COMPLETE_OVERALL_INCOMPLETE',
    scope_complete: false,
    source_evidence_status: 'INCOMPLETE',
    deferred: Object.freeze(['whole HTTP/source composition', 'SQL/native/TLS/runtime qualification', 'physical qualification']),
    component_count: 10,
  });
}

function inspectG01Receipt(value, bytes, expectedSourcePair, trusted) {
  if (!trusted || typeof trusted !== 'object' || Array.isArray(trusted)) fail('G01 trusted context is required');
  requiredKeys(trusted, ['schema', 'receipt', 'source_pair', 'underlying', 'original_tuple', 'source_window', 'scope', 'disposition'], 'G01 trusted context');
  if (trusted.schema !== G01_CONTEXT_SCHEMA) fail('G01 trusted context schema is not recognized');
  requiredKeys(trusted.receipt, ['bytes', 'sha256'], 'G01 trusted receipt');
  if (!Number.isInteger(trusted.receipt.bytes) || trusted.receipt.bytes !== Buffer.byteLength(bytes, 'utf8')) fail('G01 receipt byte length is not pinned');
  sha(trusted.receipt.sha256, 'G01 trusted receipt.sha256');
  if (digestBytes(Buffer.from(bytes, 'utf8')) !== trusted.receipt.sha256) fail('G01 receipt bytes do not match trusted hash');
  requiredKeys(trusted.source_pair, ['frontend', 'backend'], 'G01 trusted source_pair');
  tuple(trusted.source_pair.frontend, 'G01 trusted frontend'); tuple(trusted.source_pair.backend, 'G01 trusted backend');
  exactSourcePair(value, trusted.source_pair, 'G01 receipt');
  if (expectedSourcePair) exactSourcePair(value, expectedSourcePair, 'G01 caller source pair');
  requiredKeys(value, ['schema','at_utc','gate','disposition','frontend','backend','qualification_window','proof_scope','limits','evidence','original_tuple_hash_witnesses','cleanup','container_socket_closed_verified','temporary_offline_dependencies_removed','narrow_own_native_process_absence_verified','task_owned_live_resources','stage_budget_adjustment','failed_prior_receipts','Task10_static_callgraph','next_gate','next_action','audit_started','final_audit_cap','phone_owner_unchanged','production'], 'G01 receipt');
  if (value.schema !== OWNER_RECEIPT_SCHEMAS.g01 || value.gate !== 'G01' || value.disposition !== 'PASS_COMPONENT_LOCAL_HTTP_SQL_JVM_SOURCE_NOT_RUNTIME_OR_ACCEPTANCE') fail('G01 receipt schema/disposition mismatch');
  if (!Array.isArray(value.evidence) || value.evidence.length < 4) fail('G01 evidence list is incomplete');
  const evidencePaths = new Set();
  for (const entry of value.evidence) { requiredKeys(entry, ['path','bytes','sha256'], 'G01 evidence entry'); if (evidencePaths.has(entry.path)) fail('G01 evidence contains duplicate paths'); evidencePaths.add(entry.path); if (!Number.isInteger(entry.bytes) || entry.bytes < 0) fail('G01 evidence bytes invalid'); sha(entry.sha256, 'G01 evidence sha256'); }

  requiredKeys(trusted.underlying, ['actual_result','result','cleanup_finish','launch'], 'G01 trusted underlying');
  const actual = checkUnderlyingPin(value.evidence, trusted.underlying.actual_result, 'actual run');
  const result = checkUnderlyingPin(value.evidence, trusted.underlying.result, 'result');
  const cleanup = checkUnderlyingPin(value.evidence, trusted.underlying.cleanup_finish, 'cleanup');
  const launch = checkUnderlyingPin(value.evidence, trusted.underlying.launch, 'launch');
  if (actual.schema !== 'custodial.current-all-piece-owning-HTTP-SQL-native-qualification.v1' || actual.gate !== 'G01' || actual.status !== 'NEW1_ALL3_CURRENT_REPEATABLE_SQL_PIECES_ORIGINAL_NATIVE_JOURNAL_ASSEMBLY_KEY_VALUES_PASS_SOURCE_ONLY_C01_UNCHANGED_NOT_REPLAYED') fail('actual run schema/status is not the pinned G01 run');
  requiredKeys(actual.source, ['frontend','backend'], 'actual source');
  if (actual.source.frontend !== trusted.source_pair.frontend.commit || actual.source.backend !== trusted.source_pair.backend.commit) fail('actual run source tuple mismatch');
  requiredKeys(actual.same_fixed_restricted_readonly_snapshot, ['snapshot','actor','readonly','isolation'], 'actual SQL scope');
  requiredKeys(trusted.scope, ['snapshot','native_current_SQL_snapshot_frame_readback','semantic_inventory','ack','finalizer','key_removal','release','physical'], 'G01 trusted scope');
  if (trusted.scope.snapshot !== actual.same_fixed_restricted_readonly_snapshot.snapshot || actual.same_fixed_restricted_readonly_snapshot.actor !== 'custodial_application_reader' || actual.same_fixed_restricted_readonly_snapshot.readonly !== 'on' || actual.same_fixed_restricted_readonly_snapshot.isolation !== 'repeatable read') fail('actual SQL snapshot scope mismatch');
  if (actual.original_queries !== 3 || actual.original_typed_write_prerequisites !== 3 || actual.normal_fixed_complete_frame_reader_calls !== 3 || !Array.isArray(actual.pieces) || actual.pieces.length !== 3) fail('actual run does not contain exactly three original pieces');
  const indices = new Set(); const requests = new Set();
  for (const piece of actual.pieces) {
    if (!Number.isInteger(piece.index) || indices.has(piece.index) || piece.index < 0 || piece.index > 2 || piece.HTTP_status !== 200) fail('actual run piece index/status is missing or duplicated');
    indices.add(piece.index); presentKeys(piece.metadata, ['schema','state','operation_id','generation_id','frame_sha256','chunk_count','chunk_index','readback','query_witness','current_SQL_snapshot_frame_readback','exact_authenticated_original_owner_proof_bytes_match'], 'actual piece metadata');
    if (piece.metadata.schema !== 'custodial.private-custody-original-frame-piece.v1' || piece.metadata.operation_id !== trusted.original_tuple.operation_id || piece.metadata.generation_id !== trusted.original_tuple.generation_id || piece.metadata.frame_sha256 !== trusted.original_tuple.frame_sha256 || piece.metadata.chunk_index !== piece.index || piece.metadata.chunk_count !== 3 || piece.metadata.current_SQL_snapshot_frame_readback !== true || piece.metadata.exact_authenticated_original_owner_proof_bytes_match !== true) fail('actual piece tuple/snapshot binding mismatch');
    if (!piece.query_witness && !piece.metadata.query_witness) fail('actual piece query witness missing');
    const witness = piece.query_witness || piece.metadata.query_witness; if (!witness.native_request_id || requests.has(witness.native_request_id)) fail('actual query observation identity missing or duplicated'); requests.add(witness.native_request_id);
  }
  if (indices.size !== 3 || requests.size !== 3) fail('actual query/piece identity set is incomplete');

  presentKeys(actual.native, ['schema','key_removal','finalizer','actual_server_response_bytes_consumed','new_original_queries_sent_once','native_projection','source_qualification_only','same_original_operation_frame_generation_and_existing_key','original_requests_NOT_renewed','inventory_ACK'], 'actual native');
  const np = actual.native.native_projection; presentKeys(np, ['existing_original_device_key_GCM_all_value_chunks_verified','exact_original_all8_values_compared_in_native_only','original_values_sha256','original_generation_id','original_capsule_sha256','current_SQL_snapshot_frame_readback','actual_native_TLS_runtime_qualified','actual_Android_storage_qualified','network_dispatch_allowed','application_values_applied_or_semantically_accepted','key_removal','finalizer_allowed','inventory_acknowledged','work_accepted','new_work_allowed','resend_allowed','phone_released','expected_original_chunks'], 'actual native projection');
  if (actual.native.actual_server_response_bytes_consumed !== 3 || actual.native.new_original_queries_sent_once !== 3 || actual.native.key_removal !== false || actual.native.finalizer !== false || actual.native.source_qualification_only !== true || actual.native.same_original_operation_frame_generation_and_existing_key !== true || actual.native.original_requests_NOT_renewed !== true || actual.native.inventory_ACK !== false || np.existing_original_device_key_GCM_all_value_chunks_verified !== true || np.exact_original_all8_values_compared_in_native_only !== true || np.original_values_sha256 !== trusted.original_tuple.values_sha256 || np.original_generation_id !== trusted.original_tuple.generation_id || np.original_capsule_sha256 !== trusted.original_tuple.capsule_sha256 || np.operation_id !== trusted.original_tuple.operation_id || np.frame_sha256 !== trusted.original_tuple.frame_sha256 || np.assembled_frame_sha256 !== trusted.original_tuple.frame_sha256 || np.current_SQL_snapshot_frame_readback !== false || np.actual_native_TLS_runtime_qualified !== false || np.actual_Android_storage_qualified !== false || (np.actual_Android_keystore_qualified !== undefined && np.actual_Android_keystore_qualified !== false) || np.network_dispatch_allowed !== false || np.application_values_applied_or_semantically_accepted !== false || np.key_removal !== false || np.finalizer_allowed !== false || np.inventory_acknowledged !== false || np.work_accepted !== false || np.new_work_allowed !== false || np.resend_allowed !== false || np.phone_released !== false || np.expected_original_chunks !== 3 || np.native_semantic_inventory_state !== 'UNKNOWN' || np.complete_namespace_inventory !== false || np.browser_inventory_state !== 'UNKNOWN' || np.durable_retention !== false || np.separate_durable_chunk_plan_record !== false || np.writer_authority !== false || np.transport_origin_authenticated !== false || np.all_writer_durable_freeze_or_ABA_guard !== false || np.original_saved_records_or_queries_modified !== false || np.replacement_key_IV_signature_operation_or_query_created !== false || np.original_operation_record_rewritten !== false || np.current_server_readback !== false || np.frame_request_attestation_bound !== false || np.raw_byte_record_response_or_credential_getter !== false || np.uuid_naming_hash_is_authentication !== false) fail('actual native/GCM/all8/effect flags are unsafe or incomplete');
  if (np.all_original_returned_piece_bindings_present !== true || np.fixed_per_chunk_identity_plan_bound !== true || np.historical_exact_original_returned_pieces !== 3 || np.historical_reported_SQL_complete_frame_source_fields_verified !== true || np.read_only_assembly_no_additional_store_or_query !== true || np.pieces_retained_in_original_existing_key_encrypted_QUERY_observation_slots !== true || np.IDs_derived_from_original_committed_operation_and_exact_frame !== true || np.all_pieces_share_original_frame_but_NOT_a_current_cross_query_SQL_snapshot !== true) fail('actual native safe source-only bindings are incomplete');
  presentKeys(np, ['original_query_and_observation_artifacts'], 'actual native query artifacts');
  if (!Array.isArray(np.original_query_and_observation_artifacts) || np.original_query_and_observation_artifacts.length !== 3) fail('actual native query artifact count is not exactly three');
  const artifactIndices = new Set();
  for (const piece of actual.pieces) {
    const witness = piece.metadata.query_witness; const artifact = np.original_query_and_observation_artifacts.find((entry) => entry.chunk_index === piece.index);
    if (!artifact || artifactIndices.has(piece.index) || artifact.original_query_id !== witness.native_request_id || artifact.response_sha256 !== piece.reply_sha256 || artifact.target_write_record_sha256 !== witness.target_prepared_record_sha256 || artifact.target_unknown_record_sha256 !== witness.target_unknown_record_sha256 || piece.original_query_body_sha256 !== witness.request_body_sha256 || artifact.observation_phase !== 'COMMITTED') fail('native original query/observation artifact does not match HTTP piece witness');
    artifactIndices.add(piece.index);
  }
  if (artifactIndices.size !== 3) fail('native original query artifact indices are incomplete');
  if (JSON.stringify(stable(actual.before_custody)) !== JSON.stringify(stable(actual.after_custody))) fail('actual before/after custody hashes differ');

  if (result.schema !== 'custodial.G01-current-all-piece-native-actual-SQL-protected-run.v1' || result.exit !== 0 || result.source_unchanged !== true) fail('actual protected-run result is not clean');
  for (const side of ['source_before','source_after']) { requiredKeys(result[side], ['commit','replay_sha256','status','tree'], `actual result ${side}`); if (result[side].commit !== trusted.source_pair.backend.commit || result[side].tree !== trusted.source_pair.backend.tree || result[side].replay_sha256 !== trusted.source_window.replay_sha256 || result[side].status !== '') fail(`actual result ${side} is dirty or mixed`); }
  if (!Array.isArray(result.steps) || result.steps.some((step) => step.returncode !== 0 || step.interrupted === true || step.output_truncated === true || step.timed_out === true)) fail('actual run command cutoff/exit state is unsafe');
  if (!Array.isArray(launch.commands) || launch.commands.some((command) => command.status !== 0 || ('signal' in command && command.signal !== null) || ('error' in command && command.error !== null))) fail('launch command execution is unsafe');
  if (launch.owned_offline_dependencies_removed !== true || launch.no_other_resource_cleanup_claim_without_protected_runner_receipt !== true) fail('launch cleanup/evidence boundary is unsafe');
  requiredKeys(cleanup, ['owned_connection_closed','owned_HTTP_loopback_server_and_lease_connection_closed','native_classes_host_fixtures_raw_requests_and_testcopies_removed','production'], 'actual cleanup');
  if (cleanup.owned_connection_closed !== true || cleanup.owned_HTTP_loopback_server_and_lease_connection_closed !== true || cleanup.production !== false || !Array.isArray(cleanup.native_classes_host_fixtures_raw_requests_and_testcopies_removed) || cleanup.native_classes_host_fixtures_raw_requests_and_testcopies_removed.some((entry) => entry.removed !== true)) fail('actual owned cleanup is incomplete');

  const windowSource = trusted.source_window; requiredKeys(windowSource, ['replay_sha256','status','source_pair'], 'G01 trusted source_window'); sha(windowSource.replay_sha256, 'G01 source replay'); if (windowSource.status !== '') fail('trusted clean source status must be empty'); requiredKeys(windowSource.source_pair, ['commit','tree'], 'G01 source window pair'); if (windowSource.source_pair.commit !== trusted.source_pair.backend.commit || windowSource.source_pair.tree !== trusted.source_pair.backend.tree) fail('G01 source window tuple mismatch');
  for (const side of ['source_before','source_after']) { requiredKeys(value.qualification_window[side], ['commit','replay_sha256','status','tree'], `G01 ${side}`); if (value.qualification_window[side].commit !== trusted.source_pair.backend.commit || value.qualification_window[side].tree !== trusted.source_pair.backend.tree || value.qualification_window[side].replay_sha256 !== windowSource.replay_sha256 || value.qualification_window[side].status !== '') fail(`G01 ${side} is not clean`); }
  requiredKeys(value.proof_scope.current_isolated_SQL_role, ['snapshot','actor','readonly','isolation'], 'G01 proof scope'); if (value.proof_scope.current_isolated_SQL_role.snapshot !== trusted.scope.snapshot) fail('G01 wrapper snapshot differs from actual snapshot');
  for (const key of ['three_original_queries_sent_once','same_original_operation_frame_generation_principal_revision_and_original_prepared_unknown_query_identity','owning_native_assembler_and_fresh_public_projection_completed','same_original_existing_JCE_TEST_key_GCM_all_value_chunks_verified','exact_original_all8_values_compared_in_native_only','after_query_custody_rows_hashes_unchanged']) if (value.proof_scope[key] !== true) fail(`G01 wrapper proof flag is unsafe: ${key}`);
  if (value.proof_scope.actual_loopback_HTTP_raw_original_bodies_and_fixed_restricted_SQL_reader_calls !== 3 || value.proof_scope.actual_owning_native_encrypted_QUERY_observation_slots_consumed !== 3 || value.proof_scope.NEW_combined_positive_composition_cases !== 1) fail('G01 wrapper query/piece counts are not exact');
  if (value.proof_scope.full254_schema_replay_and_typed_writer_setup !== 'Prerequisites only, not new repeated product PASS') fail('G01 wrapper prerequisite scope was promoted');
  for (const key of ['native_current_SQL_snapshot_frame_readback','semantic_inventory','ack','finalizer','key_removal','release','physical']) { exactFalse(trusted.scope[key], `G01 scope.${key}`); exactFalse(trusted.disposition[key], `G01 disposition.${key}`); }
  requiredKeys(trusted.disposition, ['native_current_SQL_snapshot_frame_readback','semantic_inventory','ack','finalizer','key_removal','release','physical'], 'G01 trusted disposition');
  requiredKeys(trusted.original_tuple, ['operation_id','generation_id','frame_sha256','values_sha256','capsule_sha256'], 'G01 original tuple'); for (const key of ['frame_sha256','values_sha256','capsule_sha256']) sha(trusted.original_tuple[key], `G01 tuple.${key}`);
  requiredKeys(value.original_tuple_hash_witnesses, ['operation_id','generation_id','frame_sha256','values_sha256','capsule_sha256'], 'G01 tuple witness'); for (const key of Object.keys(trusted.original_tuple)) if (value.original_tuple_hash_witnesses[key] !== trusted.original_tuple[key]) fail(`G01 tuple mismatch: ${key}`);
  requiredKeys(value.qualification_window.cleanup, ['container_absent','socket_absent'], 'G01 cleanup window'); if (value.qualification_window.cleanup.container_absent !== true || value.qualification_window.cleanup.socket_absent !== true) fail('G01 qualification cleanup is not clean');
  if (!Array.isArray(value.task_owned_live_resources) || value.task_owned_live_resources.length !== 0 || value.audit_started !== 0 || value.final_audit_cap !== 3 || value.production !== false) fail('G01 task state is not bounded');
  return Object.freeze({ disposition:'COMPONENT_COMPLETE_OVERALL_INCOMPLETE', scope_complete:false, source_evidence_status:'COMPLETE_SOURCE_COMPONENT_ONLY', source_pair:Object.freeze({frontend:Object.freeze({...trusted.source_pair.frontend}),backend:Object.freeze({...trusted.source_pair.backend})}), evidence_count:value.evidence.length, query_count:3, piece_count:3, limits:Object.freeze(['source component only; no overall readiness or SOURCE program PASS','actual underlying run payloads are externally hash/length pinned; source proof does not self-pin','synthetic actor/JCE TEST-key/HTTPS facade; not Android Keystore/storage/native TLS/runtime','semantic, ACK/resend/finalizer/key-removal/release/physical qualification remain false']) });
}

export function inspectCustodialOwnerReceipt(bytes, expectedSourcePair, trustedContext) {
  let value;
  try { value = JSON.parse(bytes); } catch { fail('receipt JSON is malformed'); }
  object(value, 'receipt');
  if (value.schema === OWNER_RECEIPT_SCHEMAS.g01) return inspectG01Receipt(value, bytes, expectedSourcePair, trustedContext);
  if (value.schema === OWNER_RECEIPT_SCHEMAS.piece) return inspectPieceReceipt(value, expectedSourcePair);
  if (value.schema === OWNER_RECEIPT_SCHEMAS.components) return inspectComponentsReceipt(value, expectedSourcePair);
  if (value.schema === OWNER_RECEIPT_SCHEMAS.native) return inspectNativeReceipt(value, expectedSourcePair);
  if (value.schema === OWNER_RECEIPT_SCHEMAS.http) return inspectHttpReceipt(value, expectedSourcePair);
  fail('receipt schema is not one of the two independently reviewed owner schemas');
}
