import { parseUrlWithHierarchicalCustomSchemes } from '../shared/custom-scheme-url';

const CUSTOM_SCAN_SCHEMES = new Set(['memphiszoo:', 'memphiszoo-custodial:']);
const SCAN_PARAMETERS = ['code', 'location', 'loc', 'session_uuid', 'action'] as const;

export function resolveCustodialScanTarget(
  rawValue: unknown,
  currentLocation: string,
  deviceId: string,
  entrySource: 'native-nfc',
  entryId = '',
): URL | null {
  if (entrySource !== 'native-nfc') return null;
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
  const canonicalEntryId = String(entryId || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonicalEntryId)) {
    target.searchParams.set('entry_id', canonicalEntryId.toLowerCase());
  }
  return target;
}
