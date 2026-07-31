import { describe, expect, it } from 'vitest';
import {
  createGeneratedDeviceIdentifier,
  isCustodialKioskIdentifier,
  normalizeDeviceIdentifier,
  resolveDeviceIdentity,
} from './device-identity';

describe('device identity', () => {
  it('normalizes kiosk aliases without accepting out-of-range custodial phones', () => {
    expect(normalizeDeviceIdentifier(' kiosk-5 ')).toBe('KIOSK_05');
    expect(normalizeDeviceIdentifier('KIOSK_10')).toBe('KIOSK_10');
    expect(isCustodialKioskIdentifier('kiosk_02')).toBe(true);
    expect(isCustodialKioskIdentifier('KIOSK_01')).toBe(false);
    expect(isCustodialKioskIdentifier('KIOSK_11')).toBe(false);
  });

  it('keeps credential identity authoritative and reports conflicts', () => {
    expect(resolveDeviceIdentity({
      edition: 'custodial',
      credentialDeviceId: 'KIOSK_04',
      storedDeviceIds: ['KIOSK_05', 'KIOSK_04'],
      explicitDeviceId: 'KIOSK_06',
      fullyDeviceName: 'KIOSK_07',
    })).toEqual({
      canonicalId: 'KIOSK_04',
      source: 'credential',
      configured: true,
      conflicts: ['KIOSK_05', 'KIOSK_06', 'KIOSK_07'],
    });
  });

  it('keeps stored assignment ahead of URL and Fully Kiosk identity', () => {
    const result = resolveDeviceIdentity({
      edition: 'custodial',
      storedDeviceIds: ['KIOSK_08'],
      explicitDeviceId: 'KIOSK_03',
      fullyDeviceName: 'KIOSK_09',
    });
    expect(result.canonicalId).toBe('KIOSK_08');
    expect(result.source).toBe('stored');
    expect(result.conflicts).toEqual(['KIOSK_03', 'KIOSK_09']);
  });

  it('uses Fully Kiosk only as the final configured custodial fallback', () => {
    expect(resolveDeviceIdentity({
      edition: 'custodial',
      fullyDeviceName: 'kiosk 10',
      fullyDeviceId: 'hardware-serial',
    })).toEqual({
      canonicalId: 'KIOSK_10',
      source: 'fully',
      configured: true,
      conflicts: [],
    });
  });

  it('generates only manager and viewer identifiers from an explicit UUID input', () => {
    const uuid = 'c59af0ea-9d2d-4e37-a5d1-4fb4adfa48ca';
    expect(createGeneratedDeviceIdentifier('manager', uuid)).toBe(`ops-app-${uuid}`);
    expect(createGeneratedDeviceIdentifier('viewer', uuid)).toBe(`viewer-app-${uuid}`);
    expect(createGeneratedDeviceIdentifier('custodial', uuid)).toBe('');
    expect(resolveDeviceIdentity({ edition: 'manager', generatedUuid: uuid }).source).toBe('generated');
    expect(resolveDeviceIdentity({ edition: 'custodial', generatedUuid: uuid })).toEqual({
      canonicalId: '',
      source: 'unconfigured',
      configured: false,
      conflicts: [],
    });
  });

  it('is pure and does not rewrite its input arrays', () => {
    const stored = Object.freeze(['kiosk-4', 'KIOSK_05']);
    const input = Object.freeze({
      edition: 'custodial' as const,
      storedDeviceIds: stored,
      explicitDeviceId: 'KIOSK_06',
    });
    resolveDeviceIdentity(input);
    expect(stored).toEqual(['kiosk-4', 'KIOSK_05']);
  });
});
