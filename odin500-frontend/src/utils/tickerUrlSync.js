/** Default when `?ticker=` / `?symbol=` is missing or invalid (e.g. Odin Signals). */
export const DEFAULT_TICKERS_PAGE_SYMBOL = 'NVDA';

/** Canonical `/ticker/:symbol` segment when no symbol is provided (matches ticker page defaults). */
export const DEFAULT_TICKER_ROUTE_SYMBOL = 'AAPL';

/** Canonical `/indices/:slug` when no slug is provided (matches Index page default). */
export const DEFAULT_INDEX_ROUTE_SLUG = 'sp500';

/** True for main ticker page `/ticker`, `/ticker/SYM` — not `/statistic/ticker-*` stats routes. */
export function isMainTickerRoutePath(pathname) {
  const p = String(pathname || '');
  return p === '/ticker' || /^\/ticker\/[^/]+/.test(p);
}

/** True for `/indices`, `/indices/slug` — not unrelated paths. */
export function isMainIndicesRoutePath(pathname) {
  const p = String(pathname || '');
  return p === '/indices' || /^\/indices\/[^/]+/.test(p);
}

export function sanitizeTickerPageInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
}

/** Parse symbol from `/ticker/:symbol` pathname (case preserved after sanitize). */
export function symbolFromTickerPathname(pathname) {
  const m = String(pathname || '').match(/^\/ticker\/([^/?#]+)/i);
  if (!m) return '';
  try {
    return sanitizeTickerPageInput(decodeURIComponent(m[1]));
  } catch {
    return sanitizeTickerPageInput(m[1]);
  }
}

/** Canonical in-app path for main ticker page (uppercase symbol segment). */
export function buildTickerPath(symbol) {
  const s = sanitizeTickerPageInput(symbol) || DEFAULT_TICKER_ROUTE_SYMBOL;
  return `/ticker/${encodeURIComponent(s)}`;
}

/**
 * Update ticker URL without App Router navigation (avoids duplicate SSR/RSC fetch on symbol change).
 * Next.js `useParams()` may stay stale until a full route transition; pair with {@link resolveTickerPageSymbol}.
 */
export function replaceTickerPathname(symbol) {
  if (typeof window === 'undefined') return;
  const path = buildTickerPath(symbol);
  window.history.replaceState(window.history.state, '', path);
}

/**
 * Effective ticker symbol: prefer browser pathname when it disagrees with stale router params
 * (after client-side {@link replaceTickerPathname}).
 */
export function resolveTickerPageSymbol(symbolParam, pathname) {
  const fromRouter = sanitizeTickerPageInput(symbolParam) || '';
  const path =
    pathname != null && pathname !== ''
      ? pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '';
  const fromPath = symbolFromTickerPathname(path);
  if (fromPath && fromRouter && fromPath !== fromRouter) return fromPath;
  return fromPath || fromRouter || DEFAULT_TICKER_ROUTE_SYMBOL;
}

/** Canonical `/historical-data/:symbol` path (lowercase segment, same as ticker reports). */
export function buildHistoricalDataHref(symbol) {
  const s = sanitizeTickerPageInput(symbol) || DEFAULT_TICKER_ROUTE_SYMBOL;
  return `/historical-data/${encodeURIComponent(s.toLowerCase())}`;
}

/** For ticker search APIs: keep spaces (company names); case sent as typed (DB ilike is case-insensitive). */
export function sanitizeTickerSearchInput(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9.\s-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 48);
}

/** URL `?ticker=` or legacy `?symbol=`; falls back to {@link DEFAULT_TICKERS_PAGE_SYMBOL} when missing/invalid. */
export function resolveTickersPageSymbol(searchParams) {
  const raw =
    searchParams.get('ticker') ||
    searchParams.get('symbol') ||
    '';
  const s = sanitizeTickerPageInput(raw);
  return s || DEFAULT_TICKERS_PAGE_SYMBOL;
}
