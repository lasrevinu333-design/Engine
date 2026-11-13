export const MEMPHIS_MAP_ORIGIN = 'https://memphis-zoo-infrastructure-map.lasrevinu333.chatgpt.site';
export const MEMPHIS_MAP_PROJECT_REF = 'dwzdqekusvivjbxsapdu';
export const MEMPHIS_MAP_AUTH_STORAGE_KEY = `sb-${MEMPHIS_MAP_PROJECT_REF}-auth-token`;

export function currentMemphisMapAccessToken({
  origin = globalThis.location?.origin || '',
  storage = globalThis.localStorage,
  now = () => Date.now(),
} = {}) {
  if (origin !== MEMPHIS_MAP_ORIGIN || !storage?.getItem) return '';
  let session;
  try {
    const raw = storage.getItem(MEMPHIS_MAP_AUTH_STORAGE_KEY);
    if (!raw || raw.length > 100_000) return '';
    session = JSON.parse(raw);
  } catch {
    return '';
  }
  const token = String(session?.access_token || '').trim();
  const expiresAt = Number(session?.expires_at || 0);
  if (!token || token.length > 8192 || !Number.isFinite(expiresAt) || expiresAt * 1000 <= now() + 30_000) return '';
  return token;
}

export function isMemphisMapDashboardSession(session) {
  return /^map_identity:[a-z0-9_]+$/.test(String(session?.auth_mode || ''))
    && session?.read_only === true
    && session?.access_level === 'read_only';
}
