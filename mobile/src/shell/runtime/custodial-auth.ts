import { createCustodialNativeStatusFacade } from '../../custodial/native-status.js';
import {
  isCustodialKioskIdentifier,
  normalizeDeviceIdentifier,
} from '../core/device-identity';
import type { AuthSnapshot } from '../core/types';

const security = createCustodialNativeStatusFacade();

interface CustodialStatusSnapshot {
  state: string;
  initialized: boolean;
  ready: boolean;
  available: boolean;
  quarantined: boolean;
  reason: string;
  deviceId: string;
}

function currentDeviceId(): string {
  return normalizeDeviceIdentifier(security.getStatus().deviceId);
}

export async function readCustodialShellAuth(): Promise<AuthSnapshot> {
  let status: CustodialStatusSnapshot;
  try {
    status = await security.ensureSecurityState() as CustodialStatusSnapshot;
  } catch {
    status = security.getStatus() as CustodialStatusSnapshot;
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
  return { state: 'unenrolled', displayName: '', role: 'custodial' };
}

export async function custodialRequestMetadata(): Promise<Record<string, string>> {
  await security.waitForStableState({ requireEnrollment: true });
  return {};
}
