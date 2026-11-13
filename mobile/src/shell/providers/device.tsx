import { useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { resolveDeviceIdentity } from '../core/device-identity';
import type { AppEdition, DeviceIdentity } from '../core/types';
import { useAuth } from './auth';
import { createRequiredContext } from './context';

declare global {
  interface Window {
    fully?: {
      getDeviceName?: () => string;
      getDeviceId?: () => string;
    };
  }
}

const [DeviceContext, useDeviceIdentity] = createRequiredContext<DeviceIdentity>('DeviceIdentity');

function safeFullyValue(read: (() => string) | undefined): string {
  try {
    return String(read?.() || '');
  } catch {
    return '';
  }
}

export function DeviceIdentityProvider({
  edition,
  children,
}: PropsWithChildren<{ edition: AppEdition }>) {
  const auth = useAuth();
  const identity = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    const storedDeviceIds = edition === 'custodial'
      ? []
      : [
          localStorage.getItem('memphisAssignedDeviceId'),
          localStorage.getItem(`mz_${edition}_device_id`),
        ];
    const generatedUuid = crypto.randomUUID();
    const resolved = resolveDeviceIdentity({
      edition,
      credentialDeviceId: auth.deviceId,
      storedDeviceIds,
      explicitDeviceId: edition === 'custodial' ? null : search.get('device'),
      fullyDeviceName: edition === 'custodial' ? null : safeFullyValue(window.fully?.getDeviceName),
      fullyDeviceId: edition === 'custodial' ? null : safeFullyValue(window.fully?.getDeviceId),
      generatedUuid,
    });
    if (resolved.source === 'generated') {
      localStorage.setItem(`mz_${edition}_device_id`, resolved.canonicalId);
      if (edition === 'manager') localStorage.setItem('memphisAssignedDeviceId', resolved.canonicalId);
    }
    return resolved;
  }, [auth.deviceId, edition]);

  return <DeviceContext.Provider value={identity}>{children}</DeviceContext.Provider>;
}

export { useDeviceIdentity };
