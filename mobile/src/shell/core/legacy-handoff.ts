import type { AppEdition, RemovableListener, RuntimePorts } from './types';
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

export function bindHardwareBackLifecycle({
  deepLinks,
  currentRouteId,
  homeRouteId,
  edition,
  onBack,
  isCurrent,
  reportFailure,
}: {
  deepLinks: Pick<RuntimePorts['deepLinks'], 'addBackListener' | 'handleRootBack'>;
  currentRouteId: string;
  homeRouteId: string;
  edition: AppEdition;
  onBack: () => void;
  isCurrent: () => boolean;
  reportFailure: (error: Error) => void;
}): () => void {
  let active = true;
  let failed = false;
  let listener: RemovableListener | null = null;
  let removed = false;
  const current = () => active && !failed && isCurrent();
  const remove = () => {
    if (!listener || removed) return;
    removed = true;
    try {
      void Promise.resolve(listener.remove()).catch(() => {});
    } catch {
      // Teardown is best-effort and must not replace the primary active failure.
    }
  };
  const fail = () => {
    if (!current()) return;
    failed = true;
    remove();
    reportFailure(new Error('Hardware Back failed.'));
  };
  try {
    void deepLinks.addBackListener(() => {
      if (!current()) return;
      try {
        const action = resolveHardwareBackAction(currentRouteId, homeRouteId);
        const result = action === 'pop' ? onBack() : deepLinks.handleRootBack(edition);
        void Promise.resolve(result).catch(fail);
      } catch {
        fail();
      }
    }).then((nextListener) => {
      listener = nextListener;
      if (!current()) remove();
    }).catch(fail);
  } catch {
    fail();
  }
  return () => {
    if (!active) return;
    active = false;
    remove();
  };
}
