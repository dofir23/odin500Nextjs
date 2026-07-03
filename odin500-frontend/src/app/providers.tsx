'use client';

import { useEffect } from 'react';
import { HydrationMarker } from '@/components/HydrationMarker';
import { SocialCaptureBootstrap } from '@/components/SocialCaptureBootstrap';
import { LoginGateProvider } from '@/context/LoginGateContext.jsx';
import { EngagementProvider } from '@/context/EngagementContext.jsx';
import { WatchlistDockProvider } from '@/context/WatchlistDockContext.jsx';
import { ProductTourProvider } from '@/context/ProductTourContext.jsx';
import { initAuthSessionOnLoad } from '@/store/apiStore.js';
import { installRouteNavigationAbortErrorFilter } from '@/navigation/routeNavigationAbort.js';
import { installChunkLoadRecovery } from '@/utils/installChunkLoadRecovery.js';

export function Providers({ children }) {
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
  );
}
