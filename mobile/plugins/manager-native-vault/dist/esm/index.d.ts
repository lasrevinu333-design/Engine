export type ManagerAccessLevel = '' | 'read_only' | 'full_access';
export type ManagerEnrollmentFlow = 'enroll' | 'recover' | 'replace';
export type ManagerKeySecurityLevel = '' | 'trusted_environment' | 'strongbox' | 'secure_enclave';

export interface ManagerVaultState {
  schema_version: 2;
  contract_version: 'manager-device-auth.v2';
  state: string;
  revision: number;
  active: boolean;
  blocked: boolean;
  reason: string;
  device_id: string;
  manager_id: string;
  roles: Array<'OPS_MANAGER' | 'CUSTODIAL_MANAGER' | 'DIRECTOR' | 'SECURITY_ADMIN'>;
  access_level: ManagerAccessLevel;
  key_security_level: ManagerKeySecurityLevel;
  pending_operation_id: string;
  pending_flow: '' | ManagerEnrollmentFlow;
  removal_operation_id: string;
  removal_pending: boolean;
}

export interface ManagerMutationResult {
  operation_id: string;
  replayed: boolean;
  vault_state: ManagerVaultState;
}

export interface ManagerAuthorizedRequest {
  path: string;
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body_base64?: string;
}

export interface ManagerAuthorizedResponse {
  status: number;
  headers: Record<string, string>;
  body_base64: string;
}

export interface ManagerNativeVaultPlugin {
  getStatus(): Promise<ManagerVaultState>;
  enroll(options: {
    operation_id: string;
    flow: ManagerEnrollmentFlow;
    enrollment_code: string;
    device_label: string;
    requested_access_level: 'full_access';
  }): Promise<ManagerMutationResult>;
  resumeEnrollment(options: { operation_id: string }): Promise<ManagerMutationResult>;
  confirmEnrollment(options: { operation_id: string }): Promise<ManagerMutationResult>;
  cancelEnrollment(options: { operation_id: string }): Promise<ManagerMutationResult>;
  remove(options: { operation_id: string }): Promise<ManagerMutationResult>;
  authorizedRequest(options: ManagerAuthorizedRequest): Promise<ManagerAuthorizedResponse>;
}

export declare const ManagerNativeVault: ManagerNativeVaultPlugin;
