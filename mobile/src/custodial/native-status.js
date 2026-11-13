import { Capacitor } from '@capacitor/core';
import { CustodialNativeVault } from '@memphis-zoo/custodial-native-vault';
import {
  CUSTODIAL_DEVICE_KEYS,
  CUSTODIAL_INSTALLATION_MARKER_KEY,
  CUSTODIAL_INSTALLATION_RECORD_KEY,
} from './security-keys.js';

const browserTestBuild = typeof __MZ_CUSTODIAL_BROWSER_TEST__ !== 'undefined'
  && __MZ_CUSTODIAL_BROWSER_TEST__ === true;

function canonicalDeviceId(value) {
  const match = String(value || '').trim().match(/^KIOSK[_-]?(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
}

function safeInstallation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const deviceId = canonicalDeviceId(value.device_id);
  const seal = String(value.installation_seal || '').trim();
  if (value.schema_version !== 1 || !deviceId || !/^[A-Za-z0-9._:-]{16,256}$/.test(seal)) return null;
  return Object.freeze({ schema_version: 1, device_id: deviceId, installation_seal: seal });
}

function localBinding(storage) {
  try {
    const identities = CUSTODIAL_DEVICE_KEYS.map((key) => canonicalDeviceId(storage.getItem(key)));
    return {
      identities,
      marker: String(storage.getItem(CUSTODIAL_INSTALLATION_MARKER_KEY) || '').trim(),
    };
  } catch {
    return { identities: [], marker: '' };
  }
}

function bindingStatus(nativeState, storage) {
  if (!nativeState || typeof nativeState !== 'object' || Array.isArray(nativeState)) {
    return { state: 'unavailable', initialized: true, ready: false, available: false, quarantined: false, reason: 'custodial_native_state_invalid', deviceId: '' };
  }
  if (nativeState.blocked === true) {
    return { state: 'quarantined', initialized: true, ready: false, available: true, quarantined: true, reason: String(nativeState.reason || 'custodial_native_vault_blocked'), deviceId: '' };
  }
  const installation = safeInstallation(nativeState.installation);
  if (nativeState.active === true && nativeState.credential_present === true) {
    if (!installation) {
      return { state: 'quarantined', initialized: true, ready: false, available: true, quarantined: true, reason: 'installation_binding_missing', deviceId: '' };
    }
    const binding = localBinding(storage);
    if (!binding.identities.length || binding.identities.some((value) => value !== installation.device_id)) {
      return { state: 'quarantined', initialized: true, ready: false, available: true, quarantined: true, reason: 'device_identity_binding_incomplete', deviceId: '' };
    }
    if (binding.marker !== installation.installation_seal) {
      return { state: 'quarantined', initialized: true, ready: false, available: true, quarantined: true, reason: 'installation_binding_mismatch', deviceId: '' };
    }
    return { state: 'enrolled', initialized: true, ready: true, available: true, quarantined: false, reason: '', deviceId: installation.device_id };
  }
  const nativePhase = String(nativeState.state || '').toUpperCase();
  if (nativePhase === 'EMPTY') {
    return { state: 'unenrolled', initialized: true, ready: true, available: true, quarantined: false, reason: '', deviceId: '' };
  }
  return { state: 'checking', initialized: true, ready: false, available: true, quarantined: false, reason: 'custodial_security_transition_in_progress', deviceId: '' };
}

function browserState(storage) {
  if (
    !browserTestBuild
    || typeof location === 'undefined'
    || location.protocol !== 'http:'
    || !['127.0.0.1', 'localhost'].includes(location.hostname)
  ) throw new Error('The Custodial native status boundary is unavailable.');
  const raw = storage.getItem(`capacitor-storage_${CUSTODIAL_INSTALLATION_RECORD_KEY}`);
  if (raw == null) return { schema_version: 1, state: 'EMPTY', active: false, credential_present: false };
  let encoded;
  let record;
  try {
    encoded = JSON.parse(raw);
    record = JSON.parse(encoded);
  } catch {
    return { schema_version: 1, state: 'BLOCKED', blocked: true, reason: 'custodial_browser_test_record_invalid' };
  }
  const installation = safeInstallation(record);
  return installation
    ? { schema_version: 1, state: 'ACTIVE', active: true, credential_present: true, installation }
    : { schema_version: 1, state: 'BLOCKED', blocked: true, reason: 'custodial_browser_test_record_invalid' };
}

export function createCustodialNativeStatusFacade({
  plugin = CustodialNativeVault,
  storage = globalThis.localStorage,
} = {}) {
  let status = Object.freeze({
    state: 'checking', initialized: false, ready: false, available: true,
    quarantined: false, reason: '', deviceId: '',
  });
  const nativePlatform = Capacitor.isNativePlatform?.() === true
    && String(Capacitor.getPlatform?.() || '').toLowerCase() === 'android';
  const inspect = async () => {
    try {
      const nativeState = nativePlatform ? await plugin.getState() : browserState(storage);
      status = Object.freeze(bindingStatus(nativeState, storage));
    } catch {
      status = Object.freeze({
        state: 'unavailable', initialized: true, ready: false, available: false,
        quarantined: false, reason: 'custodial_native_status_unavailable', deviceId: '',
      });
    }
    return status;
  };
  try {
    globalThis.addEventListener?.('storage', (event) => {
      if (event.key === null || CUSTODIAL_DEVICE_KEYS.includes(String(event.key)) || event.key === CUSTODIAL_INSTALLATION_MARKER_KEY) {
        status = Object.freeze({
          state: 'unavailable', initialized: true, ready: false, available: false,
          quarantined: false, reason: 'custodial_local_binding_changed', deviceId: '',
        });
      }
    });
  } catch {}
  const initial = inspect();
  return Object.freeze({
    ready: initial,
    ensureSecurityState: inspect,
    getStatus: () => status,
    async waitForStableState({ requireEnrollment = false } = {}) {
      const current = await inspect();
      if (requireEnrollment && !(current.state === 'enrolled' && current.ready === true)) {
        const error = new Error('Custodial native status is not enrolled.');
        error.code = 'custodial_security_state_unavailable';
        throw error;
      }
      return current;
    },
  });
}
