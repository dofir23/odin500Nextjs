'use client';

import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HydrationMarker } from '@/components/HydrationMarker';
import { SocialCaptureBootstrap } from '@/components/SocialCaptureBootstrap';
import { LoginGateProvider } from '@/context/LoginGateContext.jsx';
import { EngagementProvider } from '@/context/EngagementContext.jsx';
import { WatchlistDockProvider } from '@/context/WatchlistDockContext.jsx';
import { ProductTourProvider } from '@/context/ProductTourContext.jsx';
import { initAuthSessionOnLoad } from '@/store/apiStore.js';
import { installRouteNavigationAbortErrorFilter } from '@/navigation/routeNavigationAbort.js';
import { installChunkLoadRecovery } from '@/utils/installChunkLoadRecovery.js';
import { createAppQueryClient } from '@/query/queryClient.js';

export function Providers({ children }) {
  const [queryClient] = useState(() => createAppQueryClient());

  useEffect(() => {
    initAuthSessionOnLoad();
    const offAbort = installRouteNavigationAbortErrorFilter();
    const offChunk = installChunkLoadRecovery();
    return () => {
      offAbort();
      offChunk();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LoginGateProvider>
        <EngagementProvider>
          <WatchlistDockProvider>
            <ProductTourProvider>
              <HydrationMarker />
              <SocialCaptureBootstrap />
              {children}
            </ProductTourProvider>
          </WatchlistDockProvider>
        </EngagementProvider>
      </LoginGateProvider>
    </QueryClientProvider>
  );
}
