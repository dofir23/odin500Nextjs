'use client';

import { QueryClient } from '@tanstack/react-query';

/** Shared stale times for market catalog queries. */
export const MARKET_STALE = {
  tickerDetails: 5 * 60 * 1000,
  tickerCoreReturns: 5 * 60 * 1000,
  indexMovers: 90 * 1000,
  railSnapshot: 2 * 60 * 1000,
  ohlcSignals: 5 * 60 * 1000
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  });
}

/** Browser singleton so non-React helpers can share the same cache. */
let browserClient = null;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

export function createAppQueryClient() {
  return typeof window === 'undefined' ? makeQueryClient() : getQueryClient();
}
