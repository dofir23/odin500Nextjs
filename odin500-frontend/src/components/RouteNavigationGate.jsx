'use client';
import { useEffect, useRef } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import {
  installHistoryNavigationAbort,
  installInternalLinkNavigationAbort,
  resetRouteNavigationAbort
} from '../navigation/routeNavigationAbort.js';

/**
 * Resets stale route fetches on navigation.
 * Do not wrap children in Suspense — async app pages + Suspense hide SSR HTML in
 * `hidden` streaming slots until JS runs (blank page with JS disabled).
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

  return <div className="route-nav-gate">{children}</div>;
}
