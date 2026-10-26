import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { NetworkSnapshot, RemovableListener, RuntimePorts } from '../core/types';
import { createRequiredContext } from './context';

const [NetworkContext, useNetwork] = createRequiredContext<NetworkSnapshot>('Network');

export function bindNetworkLifecycle(
  network: RuntimePorts['network'],
  publish: (next: NetworkSnapshot) => void,
  reportFailure: (error: Error) => void,
): () => void {
  let active = true;
  let failed = false;
  let listener: RemovableListener | null = null;
  let removed = false;
  const remove = () => {
    if (!listener || removed) return;
    removed = true;
    try {
      void Promise.resolve(listener.remove()).catch(() => {});
    } catch {
      // Teardown must not replace a setup failure or leak a rejected native call.
    }
  };
  const fail = () => {
    if (!active || failed) return;
    failed = true;
    remove();
    reportFailure(new Error('Network setup failed.'));
  };
  const accept = (next: NetworkSnapshot) => {
    if (active && !failed) publish(next);
  };
  try {
    void network.getStatus().then(accept).catch(fail);
  } catch {
    fail();
  }
  if (!failed) {
    try {
      void network.addListener(accept).then((nextListener) => {
        listener = nextListener;
        if (!active || failed) remove();
      }).catch(fail);
    } catch {
      fail();
    }
  }
  return () => {
    active = false;
    remove();
  };
}

export function NetworkProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>({
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'unknown' : 'none',
  });
  const [failure, setFailure] = useState<{
    runtime: RuntimePorts;
    owner: { active: boolean };
    error: Error;
  } | null>(null);

  useEffect(() => {
    const owner = { active: true };
    const close = bindNetworkLifecycle(runtime.network, setSnapshot, (error) => {
      setFailure({ runtime, owner, error });
    });
    return () => {
      owner.active = false;
      close();
    };
  }, [runtime]);
  if (failure?.runtime === runtime && failure.owner.active) throw failure.error;
  return <NetworkContext.Provider value={snapshot}>{children}</NetworkContext.Provider>;
}

export { useNetwork };
