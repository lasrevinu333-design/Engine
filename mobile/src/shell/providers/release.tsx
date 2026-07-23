import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { AppEdition, ReleaseIdentity } from '../core/types';
import { createRequiredContext } from './context';

const [ReleaseContext, useRelease] = createRequiredContext<ReleaseIdentity>('Release');

export function ReleaseProvider({
  edition,
  children,
}: PropsWithChildren<{ edition: AppEdition }>) {
  const [identity, setIdentity] = useState<ReleaseIdentity>({
    edition,
    buildId: 'loading',
    sourceCommit: '',
    schemaVersion: null,
  });
  useEffect(() => {
    let active = true;
    void fetch('./build.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('build identity unavailable')))
      .then((build) => {
        if (!active) return;
        setIdentity({
          edition,
          buildId: String(build.build_id || 'unknown'),
          sourceCommit: String(build.source_commit || ''),
          schemaVersion: Number.isInteger(build.schema_version) ? build.schema_version : null,
        });
      })
      .catch(() => {
        if (active) setIdentity((previous) => ({ ...previous, buildId: 'unavailable' }));
      });
    return () => {
      active = false;
    };
  }, [edition]);
  return <ReleaseContext.Provider value={identity}>{children}</ReleaseContext.Provider>;
}

export { useRelease };
