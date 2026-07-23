import type { AppEdition } from './types';
import {
  isCustodialKioskIdentifier,
  normalizeDeviceIdentifier,
} from './device-identity';

const SAFE_TARGET = /^\.\/[a-z0-9][a-z0-9._-]*\.html(?:[?#]|$)/i;

export function buildLegacyHandoffUrl(
  baseHref: string,
  target: string,
  edition: AppEdition,
  canonicalDeviceId: string,
): string {
  if (!SAFE_TARGET.test(target)) throw new Error(`Unsafe compatibility target: ${target}`);
  const url = new URL(target, baseHref);
  if (url.origin !== new URL(baseHref).origin) throw new Error('Compatibility handoff must stay on the app origin.');
  const deviceId = normalizeDeviceIdentifier(canonicalDeviceId);
  if (edition === 'custodial' && isCustodialKioskIdentifier(deviceId) && !url.searchParams.has('device')) {
    url.searchParams.set('device', deviceId);
  }
  return url.href;
}

export function handoffToLegacy(
  target: string,
  edition: AppEdition,
  canonicalDeviceId: string,
  replace = false,
): void {
  const href = buildLegacyHandoffUrl(window.location.href, target, edition, canonicalDeviceId);
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}

export function resolveHardwareBackAction(currentRouteId: string, homeRouteId: string): 'pop' | 'home' {
  return currentRouteId === homeRouteId ? 'home' : 'pop';
}
