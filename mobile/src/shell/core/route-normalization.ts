import type {
  AppEdition,
  EditionDefinition,
  ExternalRouteResolution,
  ShellRoute,
} from './types';
import { parseUrlWithHierarchicalCustomSchemes } from '../../shared/custom-scheme-url';

const SCAN_PARAMETERS = ['code', 'location', 'loc', 'session_uuid', 'action'] as const;
const NATIVE_NFC_HANDOFF_PARAMETER = 'mz_nfc_handoff';
const SCAN_ACTIONS = new Set(['complete', 'resume', 'start']);
const SCAN_TEXT = /^[a-z0-9][a-z0-9 _.-]{0,127}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LEGACY_NAVIGATION_PARAMETERS = [
  'conversation_id',
  'date',
  'employee',
  'event_id',
  'filter',
  'location',
  'period',
  'status',
  'tab',
  'thread_id',
] as const;
const SAFE_LEGACY_FILE = /^[a-z0-9][a-z0-9._-]*\.html$/i;
const TRUSTED_WEB_HOSTS = new Set([
  'lasrevinu333-design.github.io',
  'localhost',
  '127.0.0.1',
]);
const EDITION_SCHEMES: Record<AppEdition, string> = {
  manager: 'memphiszoo-manager:',
  custodial: 'memphiszoo-custodial:',
  viewer: 'memphiszoo-viewer:',
};
const CUSTOM_SCHEMES = new Set([
  ...Object.values(EDITION_SCHEMES),
  'memphiszoo:',
]);

function routeById(definition: EditionDefinition, id: string): ShellRoute | undefined {
  return definition.routes.find((route) => route.id === id || route.path === `/${id}`);
}

function routeFromLegacyUrl(definition: EditionDefinition, input: URL): ShellRoute | undefined {
  const file = input.pathname.split('/').filter(Boolean).at(-1) || 'index.html';
  const candidates = definition.routes.filter((route) => {
    const target = new URL(route.legacyTarget, 'https://memphis.invalid/');
    return target.pathname.split('/').filter(Boolean).at(-1) === file;
  });
  return candidates.find((route) => {
    const target = new URL(route.legacyTarget, 'https://memphis.invalid/');
    return Boolean(target.hash) && target.hash === input.hash;
  }) ?? candidates.find((route) => {
    const target = new URL(route.legacyTarget, 'https://memphis.invalid/');
    const expectedHub = target.searchParams.get('hub');
    return expectedHub != null && expectedHub === input.searchParams.get('hub');
  }) ?? candidates[0];
}

function copyAllowedParameters(input: URL, target: URL, keys: readonly string[]): void {
  for (const key of keys) {
    const value = input.searchParams.get(key);
    if (value != null && value !== '') target.searchParams.set(key, value);
  }
}

function scanText(value: string | null): string | null {
  if (value == null || value === '') return '';
  const normalized = value.trim();
  return SCAN_TEXT.test(normalized) ? normalized : null;
}

function copyScanParameters(input: URL, target: URL, pathCode = ''): boolean {
  const canonicalPathCode = scanText(pathCode);
  if (canonicalPathCode == null) return false;
  const code = scanText(input.searchParams.get('code'));
  const location = scanText(input.searchParams.get('location'));
  const loc = scanText(input.searchParams.get('loc'));
  if (code == null || location == null || loc == null) return false;
  if (location && loc && location.toLowerCase() !== loc.toLowerCase()) return false;

  const sessionUuid = input.searchParams.get('session_uuid');
  if (sessionUuid && !UUID.test(sessionUuid)) return false;
  const action = String(input.searchParams.get('action') || '').trim().toLowerCase();
  if (action && !SCAN_ACTIONS.has(action)) return false;
  const handoffValues = input.searchParams.getAll(NATIVE_NFC_HANDOFF_PARAMETER);
  if (handoffValues.length > 1 || (handoffValues.length === 1 && !UUID.test(handoffValues[0]))) return false;

  if (canonicalPathCode) target.searchParams.set('code', canonicalPathCode);
  else if (code) target.searchParams.set('code', code);
  if (location) target.searchParams.set('location', location);
  else if (loc) target.searchParams.set('loc', loc);
  if (sessionUuid) target.searchParams.set('session_uuid', sessionUuid);
  if (action) target.searchParams.set('action', action);
  if (handoffValues.length === 1) target.searchParams.set(NATIVE_NFC_HANDOFF_PARAMETER, handoffValues[0].toLowerCase());
  return true;
}

function eventTarget(edition: AppEdition, eventId: string): string | null {
  if (!/^[a-z0-9_-]{1,128}$/i.test(eventId) || edition === 'viewer') return null;
  const target = new URL('./events.html', 'https://memphis.invalid/');
  target.searchParams.set('hub', edition === 'manager' ? 'manager' : 'employee');
  target.searchParams.set('event_id', eventId);
  return `.${target.pathname}${target.search}`;
}

function decodePathPart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length <= 256 ? decoded : null;
  } catch {
    return null;
  }
}

function normalizeCustomScheme(
  input: URL,
  definition: EditionDefinition,
): ExternalRouteResolution | null {
  const host = input.hostname.toLowerCase();
  const pathPart = input.pathname.replace(/^\/+/, '');
  const decodedPath = decodePathPart(pathPart);
  if (decodedPath == null) return null;
  if (host === 'route') {
    const route = routeById(definition, decodedPath);
    return route ? { kind: 'shell', routeId: route.id, path: route.path } : null;
  }
  if (host === 'scan' && definition.edition === 'custodial') {
    const target = new URL('./scan.html', 'https://memphis.invalid/');
    if (!copyScanParameters(input, target, decodedPath)) return null;
    return { kind: 'legacy', routeId: 'custodial.cleaning', target: `.${target.pathname}${target.search}` };
  }
  if (host === 'event') {
    const target = eventTarget(definition.edition, decodedPath);
    return target ? { kind: 'legacy', routeId: `${definition.edition}.events`, target } : null;
  }
  return null;
}

function isTrustedCompatibilityUrl(input: URL): boolean {
  if (input.protocol === 'capacitor:' || input.protocol === 'ionic:') return true;
  if (!['http:', 'https:'].includes(input.protocol)) return false;
  if (!TRUSTED_WEB_HOSTS.has(input.hostname)) return false;
  if (input.hostname === 'lasrevinu333-design.github.io') {
    return input.protocol === 'https:' && /^\/Engine(?:\/|$)/.test(input.pathname);
  }
  return true;
}

export function normalizeExternalRoute(
  rawUrl: unknown,
  definition: EditionDefinition,
): ExternalRouteResolution | null {
  const source = String(rawUrl ?? '').trim();
  if (!source) return null;

  const parsed = parseUrlWithHierarchicalCustomSchemes(source, CUSTOM_SCHEMES);
  if (!parsed) return null;
  const { input, protocol } = parsed;

  if (protocol === EDITION_SCHEMES[definition.edition]) {
    return normalizeCustomScheme(input, definition);
  }
  if (
    protocol === 'memphiszoo:'
    && definition.edition === 'custodial'
    && input.hostname.toLowerCase() === 'scan'
  ) {
    return normalizeCustomScheme(input, definition);
  }
  if (CUSTOM_SCHEMES.has(protocol)) return null;
  if (!isTrustedCompatibilityUrl(input)) return null;

  const shellPath = input.hash.startsWith('#/')
    ? decodePathPart(input.hash.slice(2))
    : null;
  const shellRoute = shellPath == null ? undefined : routeById(definition, shellPath);
  if (shellRoute) return { kind: 'shell', routeId: shellRoute.id, path: shellRoute.path };

  if (definition.edition === 'custodial') {
    const hasScanParameter = SCAN_PARAMETERS.some((key) => input.searchParams.has(key));
    const canonicalRootScan = input.hostname === 'lasrevinu333-design.github.io'
      && input.pathname === '/Engine/';
    if (hasScanParameter && (
      canonicalRootScan
      || /\/(?:index|scan)(?:\.html)?$/i.test(input.pathname)
    )) {
      const target = new URL('./scan.html', 'https://memphis.invalid/');
      if (!copyScanParameters(input, target)) return null;
      return { kind: 'legacy', routeId: 'custodial.cleaning', target: `.${target.pathname}${target.search}` };
    }
  }

  const filename = input.pathname.split('/').filter(Boolean).at(-1) || 'index.html';
  if (!SAFE_LEGACY_FILE.test(filename)) return null;
  const matchingRoute = routeFromLegacyUrl(definition, input);
  if (!matchingRoute) return null;
  const targetUrl = new URL(matchingRoute.legacyTarget, 'https://memphis.invalid/');
  copyAllowedParameters(input, targetUrl, LEGACY_NAVIGATION_PARAMETERS);
  const target = `.${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  return {
    kind: 'legacy',
    routeId: matchingRoute.id,
    target,
  };
}

export function normalizeShellPath(rawPath: unknown, definition: EditionDefinition): string {
  const value = String(rawPath ?? '').trim();
  const normalized = value.startsWith('/') ? value : `/${value}`;
  const route = definition.routes.find((candidate) => candidate.path === normalized);
  return route?.path ?? definition.routes.find((candidate) => candidate.id === definition.homeRouteId)?.path ?? '/';
}
