'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJsonCached, canFetchMarketData } from '../store/apiStore.js';
import { toDateInput } from '../utils/misc.js';
import { getQueryClient, MARKET_STALE } from './queryClient.js';
import { marketKeys } from './marketQueryKeys.js';

export const RETURNS_DEFAULT_START = '2017-01-01';

/** Normalize ticker-core-returns date window so pages share one cache entry per day. */
export function defaultReturnsRangeBody(endDate) {
  return {
    customStartDate: RETURNS_DEFAULT_START,
    customEndDate: String(endDate || toDateInput(new Date())).slice(0, 10)
  };
}

async function postMarket(path, body, ttlMs) {
  const { data } = await fetchJsonCached({
    path,
    method: 'POST',
    body,
    ttlMs,
    auth: true,
    // Shared catalog fetches should finish even if the originating route changes.
    routeAbort: false
  });
  return data;
}

export async function fetchTickerDetailsQuery({ index, period }, options = {}) {
  const qc = options.queryClient || getQueryClient();
  const staleTime = options.staleTime ?? MARKET_STALE.tickerDetails;
  return qc.fetchQuery({
    queryKey: marketKeys.tickerDetails(index, period),
    queryFn: () =>
      postMarket('/api/market/ticker-details', { index, period }, staleTime),
    staleTime
  });
}

export async function fetchTickerCoreReturnsQuery(
  { ticker, customStartDate, customEndDate, ...rest },
  options = {}
) {
  const range = {
    customStartDate: customStartDate || RETURNS_DEFAULT_START,
    customEndDate: customEndDate || toDateInput(new Date()),
    ...rest
  };
  const sym = String(ticker || '').toUpperCase().trim();
  const qc = options.queryClient || getQueryClient();
  const staleTime = options.staleTime ?? MARKET_STALE.tickerCoreReturns;
  return qc.fetchQuery({
    queryKey: marketKeys.tickerCoreReturns(sym, range.customStartDate, range.customEndDate),
    queryFn: () =>
      postMarket(
        '/api/market/ticker-core-returns',
        { ticker: sym, customStartDate: range.customStartDate, customEndDate: range.customEndDate },
        staleTime
      ),
    staleTime
  });
}

export async function fetchIndexMarketMoversQuery({ index, period }, options = {}) {
  const qc = options.queryClient || getQueryClient();
  const staleTime = options.staleTime ?? MARKET_STALE.indexMovers;
  return qc.fetchQuery({
    queryKey: marketKeys.indexMovers(index, period),
    queryFn: () =>
      postMarket('/api/market/index-market-movers', { index, period }, staleTime),
    staleTime
  });
}

export async function fetchMarketRailSnapshotQuery(body, options = {}) {
  const qc = options.queryClient || getQueryClient();
  const staleTime = options.staleTime ?? MARKET_STALE.railSnapshot;
  const timeframe = body?.timeframe || body?.range || '';
  const asOfDate = body?.asOfDate || body?.as_of || '';
  return qc.fetchQuery({
    queryKey: marketKeys.railSnapshot(timeframe, asOfDate),
    queryFn: () => postMarket('/api/market/market-rail-snapshot', body, staleTime),
    staleTime
  });
}

export async function fetchOhlcSignalsQuery({ ticker, startDate, endDate }, options = {}) {
  const qc = options.queryClient || getQueryClient();
  const staleTime = options.staleTime ?? MARKET_STALE.ohlcSignals;
  const sym = String(ticker || '').toUpperCase().trim();
  return qc.fetchQuery({
    queryKey: marketKeys.ohlcSignals(sym, startDate, endDate),
    queryFn: () =>
      postMarket(
        '/api/market/ohlc-signals-indicator',
        { ticker: sym, start_date: startDate, end_date: endDate },
        staleTime
      ),
    staleTime
  });
}

/** React hooks — subscribe to shared cache. */
export function useTickerDetailsQuery({ index, period, enabled = true }) {
  return useQuery({
    queryKey: marketKeys.tickerDetails(index, period),
    queryFn: () =>
      postMarket('/api/market/ticker-details', { index, period }, MARKET_STALE.tickerDetails),
    enabled: Boolean(enabled && index && period && canFetchMarketData()),
    staleTime: MARKET_STALE.tickerDetails
  });
}

export function useIndexMarketMoversQuery({ index, period, enabled = true }) {
  return useQuery({
    queryKey: marketKeys.indexMovers(index, period),
    queryFn: () =>
      postMarket('/api/market/index-market-movers', { index, period }, MARKET_STALE.indexMovers),
    enabled: Boolean(enabled && index && period && canFetchMarketData()),
    staleTime: MARKET_STALE.indexMovers
  });
}

export function useTickerCoreReturnsQuery({
  ticker,
  customStartDate = RETURNS_DEFAULT_START,
  customEndDate,
  enabled = true
}) {
  const end = customEndDate || toDateInput(new Date());
  const sym = String(ticker || '').toUpperCase().trim();
  return useQuery({
    queryKey: marketKeys.tickerCoreReturns(sym, customStartDate, end),
    queryFn: () =>
      postMarket(
        '/api/market/ticker-core-returns',
        { ticker: sym, customStartDate, customEndDate: end },
        MARKET_STALE.tickerCoreReturns
      ),
    enabled: Boolean(enabled && sym && canFetchMarketData()),
    staleTime: MARKET_STALE.tickerCoreReturns
  });
}
