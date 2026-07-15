'use client';

/** Canonical TanStack Query keys for shared market APIs. */
export const marketKeys = {
  all: ['market'],
  tickerDetails: (index, period) => ['market', 'ticker-details', String(index || ''), String(period || '')],
  tickerCoreReturns: (ticker, customStartDate, customEndDate) => [
    'market',
    'ticker-core-returns',
    String(ticker || '').toUpperCase(),
    String(customStartDate || ''),
    String(customEndDate || '')
  ],
  indexMovers: (index, period) => ['market', 'index-movers', String(index || ''), String(period || '')],
  railSnapshot: (timeframe, asOfDate) => [
    'market',
    'rail-snapshot',
    String(timeframe || ''),
    String(asOfDate || '')
  ],
  ohlcSignals: (ticker, startDate, endDate) => [
    'market',
    'ohlc-signals',
    String(ticker || '').toUpperCase(),
    String(startDate || ''),
    String(endDate || '')
  ]
};
