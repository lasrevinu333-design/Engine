import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { z } from 'zod';
import type { AuthSnapshot, RuntimePorts } from '../core/types';
import { useAuth } from './auth';
import { useDeviceIdentity } from './device';

const envelope = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export interface ApiClient {
  get<T>(
    path: `/${string}`,
    schema: z.ZodType<T>,
  ): Promise<T>;
}

function authHeaders(auth: AuthSnapshot, deviceId: string): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (deviceId) headers.set('X-Device-Id', deviceId);
  if (auth.role) headers.set('X-Memphis-App-Role', auth.role);
  return headers;
}

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const auth = useAuth();
  const device = useDeviceIdentity();
  const client = useMemo<ApiClient>(() => ({
    async get<T>(path: `/${string}`, schema: z.ZodType<T>) {
      const headers = authHeaders(auth, device.canonicalId);
      for (const [name, value] of Object.entries(await runtime.auth.headers())) {
        if (value) headers.set(name, value);
      }
      const response = await fetch(`https://memphis-zoo-mcp.onrender.com${path}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
        credentials: 'omit',
      });
      const parsedEnvelope = envelope.parse(await response.json());
      if (!response.ok || !parsedEnvelope.ok) {
        throw new Error(parsedEnvelope.error || `HTTP ${response.status}`);
      }
      return schema.parse(parsedEnvelope.data);
    },
  }), [auth, device.canonicalId, runtime]);
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside ApiProvider.');
  return value;
}
