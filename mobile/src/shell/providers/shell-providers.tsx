import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { EditionDefinition, RuntimePorts } from '../core/types';
import { ApiProvider } from './api';
import { AuthProvider } from './auth';
import { DeepLinkProvider } from './deep-links';
import { DeviceIdentityProvider } from './device';
import { ShellErrorBoundary } from './error-boundary';
import { NetworkProvider } from './network';
import { NotificationsProvider } from './notifications';
import { ReleaseProvider } from './release';
import { ViewportProvider } from './viewport';

export function ShellProviders({
  definition,
  runtime,
  children,
}: PropsWithChildren<{ definition: EditionDefinition; runtime: RuntimePorts }>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  }));

  return (
    <ShellErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ViewportProvider>
          <AuthProvider runtime={runtime}>
            <DeviceIdentityProvider edition={definition.edition}>
              <ApiProvider runtime={runtime}>
                <NetworkProvider runtime={runtime}>
                  <NotificationsProvider runtime={runtime}>
                    <ReleaseProvider edition={definition.edition}>
                      <DeepLinkProvider definition={definition} runtime={runtime}>
                        {children}
                      </DeepLinkProvider>
                    </ReleaseProvider>
                  </NotificationsProvider>
                </NetworkProvider>
              </ApiProvider>
            </DeviceIdentityProvider>
          </AuthProvider>
        </ViewportProvider>
      </QueryClientProvider>
    </ShellErrorBoundary>
  );
}
