export interface ManagerVaultState {
  schema_version: 2;
  state: string;
  revision: number;
  active: boolean;
  blocked: boolean;
  reason: string;
  device_id: string;
  legacy_pending: boolean;
  pending_operation_id: string;
  pending_flow: string;
  removal_operation_id: string;
  removal_pending: boolean;
  removal_finalized: boolean;
}

export interface ManagerNativeEnvelope {
  status: number;
  payload: {
    ok: true;
    data: Record<string, unknown>;
  };
}

export interface ManagerNativeVaultPlugin {
  getState(): Promise<ManagerVaultState>;
  enroll(options: {
    operation_id: string;
    flow: 'enrollment' | 'recovery';
    enrollment_code: string;
  }): Promise<ManagerNativeEnvelope>;
  resumeEnrollment(options: { operation_id: string }): Promise<ManagerNativeEnvelope>;
  migrateLegacyEnrollment(options: {
    device_id: string;
  }): Promise<ManagerVaultState>;
  cancelEnrollment(options: { operation_id: string }): Promise<ManagerVaultState>;
  authorizedRequest(options: {
    path: string;
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body_base64?: string;
  }): Promise<{ status: number; headers: Record<string, string>; body_base64: string }>;
  removeEnrollment(options: { operation_id: string }): Promise<ManagerNativeEnvelope>;
}

export declare const ManagerNativeVault: ManagerNativeVaultPlugin;
