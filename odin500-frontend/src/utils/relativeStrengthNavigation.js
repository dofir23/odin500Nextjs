import { DEFAULT_TICKER_ROUTE_SYMBOL, sanitizeTickerPageInput } from './tickerUrlSync.js';

export const RELATIVE_PERFORMANCE_TICKER_BASE = '/relative-performance/ticker';

/**
 * Parse `:symbol` route segment (`AAPL`, `AAPL,MSFT`, or empty when base path has no segment).
 * @param {string} [symbolParam]
 * @returns {string[]}
 */
export function parseRelativePerformanceRouteSymbols(symbolParam) {
  if (symbolParam == null || symbolParam === '') {
    return [];
  }
  let raw = String(symbolParam);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return raw
    .split(',')
    .map((p) => sanitizeTickerPageInput(p.trim()))
    .filter(Boolean);
}

/**
 * @param {string | string[]} tickers One symbol, comma-separated string, or array (empty allowed).
 * @returns {string} e.g. `/relative-performance/ticker/AAPL%2CMSFT` or `/relative-performance/ticker` when cleared
 */
export function buildRelativePerformanceTickerHref(tickers) {
  const list = Array.isArray(tickers)
    ? tickers
    : String(tickers || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const seen = new Set();
  const normalized = [];
  for (const t of list) {
    const sym = sanitizeTickerPageInput(t);
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    normalized.push(sym);
  }
  if (!normalized.length) {
    return RELATIVE_PERFORMANCE_TICKER_BASE;
  }
  const segment = normalized.join(',');
  return `${RELATIVE_PERFORMANCE_TICKER_BASE}/${encodeURIComponent(segment)}`;
}

/** Sidebar / deep links default symbol when none specified. */
export function buildRelativePerformanceDefaultHref() {
  return buildRelativePerformanceTickerHref(DEFAULT_TICKER_ROUTE_SYMBOL);
}

/** @deprecated Use {@link buildRelativePerformanceTickerHref}. */
export const buildRelativeStrengthTickerHref = buildRelativePerformanceTickerHref;
