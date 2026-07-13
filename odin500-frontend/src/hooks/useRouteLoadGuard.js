'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import {
  composeAbortSignals,
  getRouteNavigationAbortSignal,
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
 * Snapshot the current navigation epoch and return a stale checker for this load cycle.
 * Call once at the start of a loader effect (not as a hook that freezes the first mount epoch).
 */
export function beginRouteLoadGuard() {
  const epochAtStart = getRouteNavigationEpoch();
  return (cancelled = false) => isRouteNavigationStale(cancelled, epochAtStart);
}

/**
 * @deprecated Prefer beginRouteLoadGuard() inside each effect so the epoch is fresh.
 * Kept for callers that already use the hook shape.
 */
export function useRouteLoadGuard() {
  const epochRef = useRef(getRouteNavigationEpoch());
  epochRef.current = getRouteNavigationEpoch();
  return useCallback(
    (cancelled) => isRouteNavigationStale(cancelled, epochRef.current),
    []
  );
}

/**
 * Run an async route loader with AbortSignal + stale guards.
 * Cleanup aborts a local controller; route navigation also aborts via the shared signal.
 *
 * @param {(ctx: { signal: AbortSignal, stale: () => boolean, epochAtStart: number }) => void | Promise<void>} effect
 * @param {unknown[]} deps
 */
export function useAbortableRouteEffect(effect, deps) {
  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const local = new AbortController();
    const signal =
      composeAbortSignals(getRouteNavigationAbortSignal(), local.signal) || local.signal;
    const stale = () =>
      isRouteNavigationStale(cancelled, epochAtStart) || signal.aborted;

    const run = async () => {
      try {
        await effect({ signal, stale, epochAtStart });
      } catch (err) {
        if (shouldIgnoreRouteLoadError(err) || stale()) return;
        throw err;
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        local.abort(new DOMException('Aborted', 'AbortError'));
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
  }, deps);
}
