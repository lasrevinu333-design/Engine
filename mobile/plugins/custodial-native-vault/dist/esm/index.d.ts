export interface CustodialInstallationBinding {
  schema_version: 1;
  device_id: string;
  installation_seal: string;
  enrolled_at: string;
  migrated_from_credential_only_state: boolean;
  enrollment_operation_id?: string;
}

export interface CustodialVaultState {
  schema_version: 2;
  state: string;
  revision: number;
  active: boolean;
  blocked: boolean;
  reason: string;
  credential_present: boolean;
  credential_usable: boolean;
  recovery_required: boolean;
  recovery_device_id: string;
  recovery_reason: string;
  legacy_pending: boolean;
  legacy_seal: string;
  pending_operation_id: string;
  pending_device_id: string;
  pending_flow: string;
  pending_server_confirmation: boolean;
  active_enrollment_flow: '' | 'enrollment' | 'recovery';
  scan_journal_state: 'READY' | 'CORRUPTED_PRESERVED';
  scan_journal_recovery_required: boolean;
  scan_journal_recovery?: Record<string, unknown>;
  scan_journal_disposition?: Record<string, unknown>;
  pending_enrollment?: Record<string, unknown>;
  enrollment_terminal: boolean;
  cancelled_operation_id: string;
  cancelled_device_id: string;
  cancelled_enrollment?: { operation_id: string; device_id: string; flow: string; status: 'cancelled' };
  removal_operation_id: string;
  removal_pending: boolean;
  removal_finalized: boolean;
  removal_device_id: string;
  removal_remote_complete: boolean;
  removal?: { operation_id: string; device_id: string; remote_complete: boolean; finalized: boolean };
  installation?: CustodialInstallationBinding;
}

export interface CustodialNativeEnvelope {
  status: number;
  payload: {
    ok: true;
    data: Record<string, unknown>;
  };
}

export interface CustodialNativeVaultPlugin {
  providerMirrorAttach(): Promise<{schema:'custodial.provider-mirror-attachment.v1'; attachment_id:string;
    runtime_incarnation:string; revision:string; state:'ATTACHED'|'SUSPENDED'; audio_ready:boolean}>;
  providerMirrorStopped(options:{attachment_id:string}): Promise<{stopped:true}>;
  providerClaimNext(options:{attachment_id:string}): Promise<{claim:null|{claim_id:string;payload:Record<string,string>;
    play_audio:boolean;navigation_pending:boolean;historical:boolean}}>;
  providerClaimState(options:{attachment_id:string;claim_id:string}): Promise<{current:boolean;freshness:'CURRENT'|'HISTORICAL_EXPIRED'|'FRESHNESS_UNAVAILABLE'|'RETIRED';retire_visual:boolean;stop_audio:boolean;navigation_pending:boolean}>;
  providerApplyAction(options:{attachment_id:string;claim_id:string;action:'displayed'|'opened'|'acknowledged'|'dismissed'|'audio_started'|'audio_completed'|'audio_stopped'|'navigation_completed'}): Promise<{applied:true}>;
  providerRetireClaim(options:{attachment_id:string;claim_id:string}): Promise<{retired:true}>;
  providerMirrorDetach(options:{attachment_id:string}): Promise<{detached:true}>;
  addListener(eventName:'providerPresentationAvailable',listener:(hint:{runtime_incarnation:string;revision:string})=>void): Promise<{remove():Promise<void>}>;
  getCustodialReadinessObservation(options: { device_id: string; expected_principal_identity: string }): Promise<{
    schema: 'custodial.phone-readiness-observation.v1';
    canonical_device_id: string | null; principal_identity: string | null; snapshot_id: string | null;
    observed_boot_count: number | null; observed_elapsed_realtime_ms: number | null;
    pending_occurrences: boolean | null; unfinished_occurrence: boolean | null; rollback_fence_active: boolean | null;
    observation: 'CONFIRMED' | 'NEEDS_INTERNET' | 'NEEDS_MANAGER' | 'DO_NOT_USE' | 'UNKNOWN';
    reason: 'observation_unavailable' | 'request_invalid' | 'native_enrollment_unavailable' | 'principal_changed'
      | 'protected_work_recovery_required' | 'observation_changed' | 'principal_or_protected_state_changed' | 'scan_journal_recovery_required'
      | 'rollback_fence_active' | 'anchor_missing' | 'snapshot_binding_unverified' | 'snapshot_principal_changed' | 'clock_observation_changed'
      | 'original_finish_pending' | 'original_receipt_pending' | 'native_scan_pending' | 'current_native_snapshot_observed' | 'anchor_expired'
      | 'clock_continuity_changed' | 'clock_unavailable' | 'protected_state_unavailable';
    native_clock_continuity: 'CONFIRMED' | 'UNVERIFIED' | 'EXPIRED';
    protected_work_admission: 'CLEAR' | 'PENDING' | 'RECOVERY_REQUIRED' | 'UNKNOWN'; read_only: true;
  }>;
  getState(): Promise<CustodialVaultState>;
  reportRecoveryDiagnostic(options: { reason: string; outcome: string; detail: string }): Promise<{ reported: true }>;
  attestScanIntent(options: { url: string }): Promise<{
    entry_id: string;
    entry_source: 'native-nfc';
    device_id: string;
    url: string;
    created_at: string;
    expires_at: string;
    client_session_id: string | null;
  }>;
  recoverPendingScanIntent(): Promise<{
    recovered: boolean;
    entry_id?: string;
    entry_source?: 'native-nfc';
    device_id?: string;
    url?: string;
    created_at?: string;
    expires_at?: string;
    client_session_id?: string | null;
  }>;
  verifyScanEntry(options: { entry_id: string }): Promise<Record<string, unknown>>;
  bindScanEntry(options: { entry_id: string; client_session_id: string; location_code: string; action: 'start' | 'finish'; device_id: string }): Promise<{ bound: true }>;
  consumeScanEntry(options: { entry_id: string; client_session_id: string; location_code: string; action: 'start' | 'finish'; device_id: string }): Promise<{ consumed: true }>;
  attestOfflineStart(options: {
    device_id: string;
    location_code: string;
    client_session_id: string;
    snapshot_id: string;
    snapshot_employee_id: string;
    snapshot_assignment_epoch: number;
    snapshot_credential_id: string;
    entry_id: string;
    original_native_start_attestation_version?: 'custodial-native-start.v1' | '';
    original_native_start_attestation?: string;
  }): Promise<{
    p_client_started_at: string;
    p_native_scan_entry_id: string;
    p_native_start_attestation_version: 'custodial-native-start.v1';
    p_native_start_attestation: string;
    p_native_start_transport_attestation_version?: 'custodial-native-start-transport.v1';
    p_native_start_transport_attestation?: string;
  }>;
  attestOfflineCompletion(options: {
    device_id: string;
    location_code: string;
    client_session_id: string;
    client_completion_id: string;
    context_id: string;
    native_finish_scan_entry_id: string;
    client_started_at: string;
    original_native_completion_attestation_version?: 'custodial-native-completion.v2' | '';
    original_native_completion_attestation?: string;
  }): Promise<{
    p_client_ended_at: string;
    p_native_finish_scan_entry_id: string;
    p_native_completion_attestation_version: 'custodial-native-completion.v2';
    p_native_completion_attestation: string;
    p_native_completion_transport_attestation_version?: 'custodial-native-completion-transport.v1';
    p_native_completion_transport_attestation?: string;
  }>;
  captureOfflineCompletionTime(options: {
    device_id: string;
    location_code: string;
    client_session_id: string;
    native_finish_scan_entry_id: string;
    client_started_at: string;
  }): Promise<{ p_client_ended_at: string; p_native_finish_scan_entry_id: string }>;
  acknowledgeOfflineCompletion(options: {
    device_id: string;
    location_code: string;
    client_session_id: string;
    native_finish_scan_entry_id: string;
    client_started_at: string;
    client_ended_at: string;
  }): Promise<{ acknowledged: true }>;
  anchorOfflineAuthoritySnapshot(options: {
    device_id: string;
    snapshot_id: string;
    generated_at: string;
    expires_at: string;
    snapshot: Record<string, unknown>;
  }): Promise<{ anchored: true }>;
  loadOfflineAuthoritySnapshot(options: {
    device_id: string;
  }): Promise<{ snapshot: Record<string, unknown> | null }>;
  authorizeOfflineNewWork(options: {
    device_id: string;
    snapshot_id: string;
  }): Promise<{ authorized: true }>;
  getOfflineAuthorityState(options: {
    device_id: string;
  }): Promise<{
    occurrences_awaiting_acknowledgement: boolean;
    rollback_fence_active: boolean;
    rollback_fence_id: string | null;
  }>;
  beginRollbackFence(options: {
    device_id: string;
  }): Promise<{ rollback_fence_active: true; rollback_fence_id: string }>;
  clearRollbackFence(options: {
    device_id: string;
    rollback_fence_id: string;
  }): Promise<{ cleared: true }>;
  enroll(options: {
    operation_id: string;
    device_id: string;
    flow: 'enrollment' | 'recovery';
    enrollment_code: string;
  }): Promise<CustodialNativeEnvelope>;
  resumeEnrollment(options: { operation_id: string }): Promise<CustodialNativeEnvelope>;
  completeLocalBinding(options: { operation_id: string }): Promise<CustodialVaultState>;
  completeLegacyBinding(options: {
    device_id: string;
  }): Promise<CustodialVaultState>;
  confirmEnrollment(options: { operation_id: string }): Promise<CustodialVaultState>;
  cancelEnrollment(options: { operation_id: string }): Promise<CustodialVaultState>;
  authorizedRequest(options: {
    path: string;
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    device_id: string;
    headers?: Record<string, string>;
    body_base64?: string;
  }): Promise<{ status: number; headers: Record<string, string>; body_base64: string }>;
  removeEnrollment(options: { operation_id: string; device_id: string }): Promise<CustodialNativeEnvelope>;
  finalizeRemoval(options: { operation_id: string }): Promise<CustodialVaultState>;
}

export declare const CustodialNativeVault: CustodialNativeVaultPlugin;
