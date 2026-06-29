'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import {
  installHistoryNavigationAbort,
  installInternalLinkNavigationAbort,
  resetRouteNavigationAbort
} from '../navigation/routeNavigationAbort.js';
import { PageRouteFallback } from './PageRouteFallback.jsx';

function RouteNavigationFallback() {
  return (
    <div className="route-nav-gate__pending" role="status" aria-live="polite" aria-label="Loading page">
      <PageRouteFallback />
    </div>
  );
}

/**
 * Resets stale route fetches on navigation and shows loading UI while lazy route chunks load.
 */
export function RouteNavigationGate({ children }) {
  const location = useLocation();
  const prevKeyRef = useRef(location.key);

  useEffect(() => {
    if (prevKeyRef.current === location.key) return;
    prevKeyRef.current = location.key;
    resetRouteNavigationAbort({ locationKey: location.key });
  }, [location.key]);

  useEffect(() => {
    const offLinks = installInternalLinkNavigationAbort();
    const offHistory = installHistoryNavigationAbort();
    return () => {
      offLinks();
      offHistory();
    };
  }, []);

  return (
    <div className="route-nav-gate">
      <Suspense key={location.key} fallback={<RouteNavigationFallback />}>
        {children}
      </Suspense>
    </div>
  );
}
