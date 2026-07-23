import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { NetworkSnapshot, RuntimePorts } from '../core/types';
import { createRequiredContext } from './context';

const [NetworkContext, useNetwork] = createRequiredContext<NetworkSnapshot>('Network');

export function NetworkProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>({
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'unknown' : 'none',
  });
  useEffect(() => {
    let active = true;
    let remove = () => {};
    void runtime.network.getStatus().then((next) => {
      if (active) setSnapshot(next);
    });
    void runtime.network.addListener((next) => {
      if (active) setSnapshot(next);
    }).then((listener) => {
      remove = () => void listener.remove();
      if (!active) remove();
    });
    return () => {
      active = false;
      remove();
    };
  }, [runtime]);
  return <NetworkContext.Provider value={snapshot}>{children}</NetworkContext.Provider>;
}

export { useNetwork };
