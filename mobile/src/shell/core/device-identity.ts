import type { AppEdition, DeviceIdentity, DeviceIdentityInput } from './types';

const GENERIC_DEVICE_ID = /^[a-z][a-z0-9._:-]{2,127}$/i;
const KIOSK_ID = /^kiosk[\s_-]?0*(\d{1,2})$/i;

export function normalizeDeviceIdentifier(value: unknown): string {
  const input = String(value ?? '').trim();
  if (!input) return '';
  const kioskMatch = input.match(KIOSK_ID);
  if (kioskMatch) {
    const number = Number(kioskMatch[1]);
    if (Number.isInteger(number) && number >= 1 && number <= 99) {
      return `KIOSK_${String(number).padStart(2, '0')}`;
    }
    return '';
  }
  return GENERIC_DEVICE_ID.test(input) ? input : '';
}

export function isCustodialKioskIdentifier(value: unknown): boolean {
  const normalized = normalizeDeviceIdentifier(value);
  const match = normalized.match(/^KIOSK_(\d{2})$/);
  if (!match) return false;
  const number = Number(match[1]);
  return number >= 2 && number <= 10;
}

function acceptedForEdition(edition: AppEdition, value: unknown): string {
  const normalized = normalizeDeviceIdentifier(value);
  if (!normalized) return '';
  if (edition === 'custodial') return isCustodialKioskIdentifier(normalized) ? normalized : '';
  return normalized;
}

export function createGeneratedDeviceIdentifier(edition: AppEdition, uuid: unknown): string {
  if (edition === 'custodial') return '';
  const normalizedUuid = String(uuid ?? '').trim().toLowerCase();
  if (!/^[a-f0-9-]{16,64}$/.test(normalizedUuid)) return '';
  return `${edition === 'manager' ? 'ops' : 'viewer'}-app-${normalizedUuid}`;
}

export function resolveDeviceIdentity(input: DeviceIdentityInput): DeviceIdentity {
  const candidates = [
    input.credentialDeviceId,
    ...(input.storedDeviceIds ?? []),
    input.explicitDeviceId,
    input.fullyDeviceName,
    input.fullyDeviceId,
  ]
    .map((candidate) => acceptedForEdition(input.edition, candidate))
    .filter(Boolean);
  const conflicts = [...new Set(candidates)].slice(1);
  const credential = acceptedForEdition(input.edition, input.credentialDeviceId);
  if (credential) return { canonicalId: credential, source: 'credential', configured: true, conflicts: conflicts.filter((value) => value !== credential) };

  for (const candidate of input.storedDeviceIds ?? []) {
    const stored = acceptedForEdition(input.edition, candidate);
    if (stored) return { canonicalId: stored, source: 'stored', configured: true, conflicts: conflicts.filter((value) => value !== stored) };
  }

  const explicit = acceptedForEdition(input.edition, input.explicitDeviceId);
  if (explicit) return { canonicalId: explicit, source: 'explicit', configured: true, conflicts: conflicts.filter((value) => value !== explicit) };

  if (input.edition === 'custodial') {
    const fullyName = acceptedForEdition(input.edition, input.fullyDeviceName);
    if (fullyName) return { canonicalId: fullyName, source: 'fully', configured: true, conflicts: conflicts.filter((value) => value !== fullyName) };
    const fullyId = acceptedForEdition(input.edition, input.fullyDeviceId);
    if (fullyId) return { canonicalId: fullyId, source: 'fully', configured: true, conflicts: conflicts.filter((value) => value !== fullyId) };
    return { canonicalId: '', source: 'unconfigured', configured: false, conflicts };
  }

  const generated = createGeneratedDeviceIdentifier(input.edition, input.generatedUuid);
  if (generated) return { canonicalId: generated, source: 'generated', configured: true, conflicts };
  return { canonicalId: '', source: 'unconfigured', configured: false, conflicts };
}
