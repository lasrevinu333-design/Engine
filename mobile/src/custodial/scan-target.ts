import { parseUrlWithHierarchicalCustomSchemes } from '../shared/custom-scheme-url';

const CUSTOM_SCAN_SCHEMES = new Set(['memphiszoo:', 'memphiszoo-custodial:']);
const SCAN_PARAMETERS = ['code', 'location', 'loc', 'session_uuid', 'action'] as const;

export function resolveCustodialScanTarget(
  rawValue: unknown,
  currentLocation: string,
  deviceId: string,
  entrySource: 'native-nfc' | 'manual-qr-fallback',
): URL | null {
  if (entrySource !== 'native-nfc' && entrySource !== 'manual-qr-fallback') return null;
  const parsed = parseUrlWithHierarchicalCustomSchemes(rawValue, CUSTOM_SCAN_SCHEMES);
  if (!parsed) return null;
  const { input: incoming, protocol } = parsed;
  const customScan = CUSTOM_SCAN_SCHEMES.has(protocol) && incoming.hostname === 'scan';
  const webScan = protocol === 'https:'
    && incoming.hostname === 'lasrevinu333-design.github.io'
    && /^\/Engine\/(?:$|(?:index|scan)(?:\.html)?$)/.test(incoming.pathname);
  if (!customScan && !webScan) return null;
  if (!SCAN_PARAMETERS.some((key) => incoming.searchParams.has(key)) && !customScan) return null;

  const target = new URL('./scan.html', currentLocation);
  for (const key of SCAN_PARAMETERS) {
    if (incoming.searchParams.has(key)) target.searchParams.set(key, incoming.searchParams.get(key) ?? '');
  }
  const pathCode = customScan ? incoming.pathname.replace(/^\/+/, '') : '';
  if (pathCode) target.searchParams.set('code', pathCode);
  const canonicalDeviceId = String(deviceId || '').trim().toUpperCase();
  if (canonicalDeviceId) target.searchParams.set('device', canonicalDeviceId);
  target.searchParams.set('source', entrySource);
  return target;
}
