'use client';
import { useRef } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import {
  getRouteNavigationEpoch,
  isAbortError,
  isRouteNavigationAbortError,
  isRouteNavigationStale
} from '../navigation/routeNavigationAbort.js';

/**
 * Pathname + navigation epoch — add both to loader effect deps so browser back/forward re-fetches.
 */
export function useRouteNavigationDeps() {
  const location = useLocation();
  const navEpoch = getRouteNavigationEpoch();
  return { pathname: location.pathname, navEpoch };
}

export function shouldIgnoreRouteLoadError(err) {
  return isAbortError(err) || isRouteNavigationAbortError(err);
}

/**
 * Returns a stale-check function for route-scoped async loaders.
 * Call at effect start: `const stale = useRouteLoadGuard();` then `if (stale(cancelled)) return`.
 */
export function useRouteLoadGuard() {
  const epochRef = useRef(getRouteNavigationEpoch());
  return (cancelled) => isRouteNavigationStale(cancelled, epochRef.current);
}
