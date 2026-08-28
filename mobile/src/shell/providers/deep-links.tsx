import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let active = true;
    let remove = () => {};
    const report = (stage: string, outcome: string) => {
      if (definition.edition === 'custodial' && runtime.platform === 'capacitor') {
        void runtime.nfcTransitions.report(stage, outcome);
      }
    };
    const accept = (url: string | null) => {
      if (!active || !url) return;
      report('shell_url_received', 'observed');
      const resolution = normalizeExternalRoute(url, definition);
      if (resolution) {
        report('shell_route_resolved', 'accepted');
        setState((previous) => ({
          ready: true,
          resolution,
          sequence: previous.sequence + 1,
        }));
      } else report('shell_route_resolved', 'rejected');
    };
    report('shell_provider_started', 'started');
    void runtime.deepLinks.getLaunchUrl()
      .then((url) => {
        report('shell_launch_checked', url ? 'accepted' : 'empty');
        accept(url);
        if (active) setState((previous) => ({ ...previous, ready: true }));
      })
      .catch(() => {
        report('shell_launch_checked', 'failed');
        if (active) setState((previous) => ({ ...previous, ready: true }));
      });
    void runtime.deepLinks.addUrlListener(accept).then((listener) => {
      report('shell_listener_ready', 'ready');
      remove = () => void listener.remove();
      if (!active) remove();
    }).catch(() => report('shell_listener_ready', 'failed'));
    return () => {
      active = false;
      remove();
    };
  }, [definition, runtime]);

  return <DeepLinkContext.Provider value={state}>{children}</DeepLinkContext.Provider>;
}

export { useDeepLinks };
