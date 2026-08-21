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
  getState(): Promise<CustodialVaultState>;
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
  }): Promise<{
    p_client_started_at: string;
    p_native_scan_entry_id: string;
    p_native_start_attestation_version: 'custodial-native-start.v1';
    p_native_start_attestation: string;
  }>;
  attestOfflineCompletion(options: {
    device_id: string;
    location_code: string;
    client_session_id: string;
    client_completion_id: string;
    context_id: string;
    native_finish_scan_entry_id: string;
    client_started_at: string;
  }): Promise<{
    p_client_ended_at: string;
    p_native_finish_scan_entry_id: string;
    p_native_completion_attestation_version: 'custodial-native-completion.v2';
    p_native_completion_attestation: string;
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
