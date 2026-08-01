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
