import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { AuthSnapshot, RuntimePorts } from '../core/types';
import { createRequiredContext } from './context';

const unknown: AuthSnapshot = { state: 'unknown', displayName: '', role: '' };
const [AuthContext, useAuth] = createRequiredContext<AuthSnapshot>('Auth');

interface AuthObservation {
  runtime: RuntimePorts;
  snapshot: AuthSnapshot | null;
  isCurrent(): boolean;
}

export function authSnapshotForRuntime(
  runtime: RuntimePorts,
  observation: AuthObservation | null,
): AuthSnapshot | null {
  return observation?.runtime === runtime && observation.isCurrent()
    ? observation.snapshot
    : null;
}

export function bindAuthLifecycle(
  runtime: RuntimePorts,
  publish: (observation: AuthObservation) => void,
): () => void {
  let active = true;
  const isCurrent = () => active;
  // A new effect owns a pending display, even when StrictMode reuses the runtime.
  publish({ runtime, snapshot: null, isCurrent });
  let timeoutPending = true;
  const timeout = globalThis.setTimeout(() => {
    timeoutPending = false;
    if (active) publish({ runtime, snapshot: unknown, isCurrent });
  }, 3_000);
  const clearOwnTimeout = () => {
    if (!timeoutPending) return;
    timeoutPending = false;
    globalThis.clearTimeout(timeout);
  };
  const complete = (snapshot: AuthSnapshot) => {
    if (active) {
      clearOwnTimeout();
      publish({ runtime, snapshot, isCurrent });
    }
  };
  try {
    void Promise.resolve(runtime.auth.read()).then(complete).catch(() => complete(unknown));
  } catch {
    complete(unknown);
  }
  return () => {
    if (!active) return;
    active = false;
    clearOwnTimeout();
  };
}

export function AuthProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const [observation, setObservation] = useState<AuthObservation | null>(null);
  useEffect(() => {
    return bindAuthLifecycle(runtime, setObservation);
  }, [runtime]);
  const snapshot = authSnapshotForRuntime(runtime, observation);
  if (!snapshot) return <div className="shellBoot" role="status">Preparing secure app context…</div>;
  return <AuthContext.Provider value={snapshot}>{children}</AuthContext.Provider>;
}

export { useAuth };
