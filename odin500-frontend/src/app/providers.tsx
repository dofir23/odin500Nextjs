'use client';

import { useEffect } from 'react';
import { HydrationMarker } from '@/components/HydrationMarker';
import { LoginGateProvider } from '@/context/LoginGateContext.jsx';
import { EngagementProvider } from '@/context/EngagementContext.jsx';
import { WatchlistDockProvider } from '@/context/WatchlistDockContext.jsx';
import { ProductTourProvider } from '@/context/ProductTourContext.jsx';
import { initAuthSessionOnLoad } from '@/store/apiStore.js';
import { installRouteNavigationAbortErrorFilter } from '@/navigation/routeNavigationAbort.js';

export function Providers({ children }) {
  useEffect(() => {
    initAuthSessionOnLoad();
    return installRouteNavigationAbortErrorFilter();
  }, []);

  return (
    <LoginGateProvider>
      <EngagementProvider>
        <WatchlistDockProvider>
          <ProductTourProvider>
            <HydrationMarker />
            {children}
          </ProductTourProvider>
        </WatchlistDockProvider>
      </EngagementProvider>
    </LoginGateProvider>
  );
}
