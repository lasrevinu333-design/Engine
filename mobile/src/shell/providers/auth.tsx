import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { AuthSnapshot, RuntimePorts } from '../core/types';
import { createRequiredContext } from './context';

const unknown: AuthSnapshot = { state: 'unknown', displayName: '', role: '' };
const [AuthContext, useAuth] = createRequiredContext<AuthSnapshot>('Auth');

export function AuthProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setSnapshot(unknown);
    }, 3_000);
    void Promise.resolve(runtime.auth.read()).then((next) => {
      if (active) {
        window.clearTimeout(timeout);
        setSnapshot(next);
      }
    }).catch(() => {
      if (active) {
        window.clearTimeout(timeout);
        setSnapshot(unknown);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [runtime]);
  if (!snapshot) return <div className="shellBoot" role="status">Preparing secure app context…</div>;
  return <AuthContext.Provider value={snapshot}>{children}</AuthContext.Provider>;
}

export { useAuth };
