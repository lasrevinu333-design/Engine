import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { getCustodialSecurityRuntime } from '../../custodial/security-runtime.js';
import {
  isCustodialKioskIdentifier,
  normalizeDeviceIdentifier,
} from '../core/device-identity';
import type { AuthSnapshot } from '../core/types';

const { store: credentialStore, security } = getCustodialSecurityRuntime({ secureStorage: SecureStorage });

function currentDeviceId(): string {
  return normalizeDeviceIdentifier(credentialStore.getStatus().deviceId);
}

export async function readCustodialShellAuth(): Promise<AuthSnapshot> {
  let status;
  try {
    status = await security.ensureSecurityState();
  } catch {
    status = security.getStatus();
  }
  if (status.quarantined) {
    return { state: 'quarantined', displayName: '', role: 'custodial', reason: status.reason };
  }
  if (status.initialized && status.available === false) {
    return { state: 'unavailable', displayName: '', role: 'custodial', reason: status.reason };
  }
  if (status.ready !== true) return { state: 'unknown', displayName: '', role: 'custodial' };
  const deviceId = currentDeviceId();
  if (status.state === 'enrolled' && isCustodialKioskIdentifier(deviceId)) {
    return {
      state: 'enrolled',
      displayName: '',
      role: 'custodial',
      deviceId,
    };
  }
  return { state: 'unknown', displayName: '', role: 'custodial' };
}

export async function custodialRequestMetadata(): Promise<Record<string, string>> {
  await security.waitForStableState({ requireEnrollment: true });
  return {};
}
