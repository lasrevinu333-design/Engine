import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import {
  isCustodialKioskIdentifier,
  normalizeDeviceIdentifier,
} from '../core/device-identity';
import type { AuthSnapshot } from '../core/types';

const CREDENTIAL_KEY = 'memphis_zoo_custodial_device_credential';
const DEVICE_KEY = 'memphisAssignedDeviceId';

function currentDeviceId(): string {
  return normalizeDeviceIdentifier(
    localStorage.getItem(DEVICE_KEY) || localStorage.getItem('mz_scan_device_id'),
  );
}

async function readCredential(): Promise<string> {
  try {
    const value = await SecureStorage.get(CREDENTIAL_KEY);
    if (typeof value === 'string' && value.trim()) return value.trim();
  } catch {}
  return String(localStorage.getItem(CREDENTIAL_KEY) || '').trim();
}

export async function readCustodialShellAuth(): Promise<AuthSnapshot> {
  const credential = await readCredential();
  const deviceId = currentDeviceId();
  if (credential && isCustodialKioskIdentifier(deviceId)) {
    return {
      state: 'enrolled',
      displayName: '',
      role: 'custodial',
      deviceId,
    };
  }
  return { state: 'unknown', displayName: '', role: 'custodial' };
}

export async function custodialAuthHeaders(): Promise<Record<string, string>> {
  const credential = await readCredential();
  const deviceId = currentDeviceId();
  return {
    ...(credential ? {
      'X-Device-Credential': credential,
      'X-Memphis-Device-Credential': credential,
    } : {}),
    ...(isCustodialKioskIdentifier(deviceId) ? { 'X-Device-Id': deviceId } : {}),
  };
}
