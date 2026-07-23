import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type {
  EditionDefinition,
  ExternalRouteResolution,
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

export function DeepLinkProvider({
  definition,
  runtime,
  children,
}: PropsWithChildren<{ definition: EditionDefinition; runtime: RuntimePorts }>) {
  const [state, setState] = useState<DeepLinkState>({ ready: false, resolution: null, sequence: 0 });
  const lastUrl = useRef('');

  useEffect(() => {
    let active = true;
    let remove = () => {};
    const accept = (url: string | null) => {
      if (!active || !url || url === lastUrl.current) return;
      lastUrl.current = url;
      const resolution = normalizeExternalRoute(url, definition);
      if (resolution) {
        setState((previous) => ({
          ready: true,
          resolution,
          sequence: previous.sequence + 1,
        }));
      }
    };
    void runtime.deepLinks.getLaunchUrl()
      .then((url) => {
        accept(url);
        if (active) setState((previous) => ({ ...previous, ready: true }));
      })
      .catch(() => {
        if (active) setState((previous) => ({ ...previous, ready: true }));
      });
    void runtime.deepLinks.addUrlListener(accept).then((listener) => {
      remove = () => void listener.remove();
      if (!active) remove();
    });
    return () => {
      active = false;
      remove();
    };
  }, [definition, runtime]);

  return <DeepLinkContext.Provider value={state}>{children}</DeepLinkContext.Provider>;
}

export { useDeepLinks };
