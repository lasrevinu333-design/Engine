import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type {
  EditionDefinition,
  ExternalRouteResolution,
  RemovableListener,
  RuntimePorts,
} from '../core/types';
import { normalizeExternalRoute } from '../core/route-normalization';
import { createRequiredContext } from './context';

interface DeepLinkState {
  ready: boolean;
  resolution: ExternalRouteResolution | null;
  sequence: number;
}

const [DeepLinkContext, useDeepLinks] = createRequiredContext<DeepLinkState>('DeepLinks');

export function bindDeepLinkLifecycle(
  deepLinks: RuntimePorts['deepLinks'],
  definition: EditionDefinition,
  publish: (update: (previous: DeepLinkState) => DeepLinkState) => void,
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
      // Teardown cannot replace a primary failure, including after disposal.
    }
  };
  const fail = () => {
    if (!active || failed) return;
    failed = true;
    remove();
    reportFailure(new Error('Deep-link setup failed.'));
  };
  const accept = (url: string | null) => {
    if (!active || failed || !url) return;
    const resolution = normalizeExternalRoute(url, definition);
    if (resolution) {
      publish((previous) => ({ ready: true, resolution, sequence: previous.sequence + 1 }));
    }
  };
  const ready = () => {
    if (active && !failed) publish((previous) => ({ ...previous, ready: true }));
  };
  try {
    void deepLinks.getLaunchUrl().then((url) => {
      accept(url);
      ready();
    }).catch(ready);
  } catch {
    ready();
  }
  try {
    void deepLinks.addUrlListener(accept).then((nextListener) => {
      listener = nextListener;
      if (!active || failed) remove();
    }).catch(fail);
  } catch {
    fail();
  }
  return () => {
    active = false;
    remove();
  };
}

export function DeepLinkProvider({
  definition,
  runtime,
  children,
}: PropsWithChildren<{ definition: EditionDefinition; runtime: RuntimePorts }>) {
  const [state, setState] = useState<DeepLinkState>({ ready: false, resolution: null, sequence: 0 });
  const [failure, setFailure] = useState<{
    definition: EditionDefinition;
    runtime: RuntimePorts;
    owner: { active: boolean };
    error: Error;
  } | null>(null);

  useEffect(() => {
    const owner = { active: true };
    const close = bindDeepLinkLifecycle(runtime.deepLinks, definition, setState, (error) => {
      setFailure({ definition, runtime, owner, error });
    });
    return () => {
      owner.active = false;
      close();
    };
  }, [definition, runtime]);

  if (failure?.runtime === runtime && failure.definition === definition && failure.owner.active) {
    throw failure.error;
  }
  return <DeepLinkContext.Provider value={state}>{children}</DeepLinkContext.Provider>;
}

export { useDeepLinks };
