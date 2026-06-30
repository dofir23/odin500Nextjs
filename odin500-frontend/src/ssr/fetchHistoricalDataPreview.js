/** Default daily rows exposed in SSR HTML and public preview API. */
export const HISTORICAL_DATA_PREVIEW_ROWS = 30;

export function parseHistoricalDataSymbol(pathname) {
  const m = String(pathname || '').match(/^\/historical-data\/([A-Za-z0-9.]+)$/i);
  if (!m) return null;
  return decodeURIComponent(m[1]).toUpperCase();
}

import { resolveApiOrigin } from '../lib/resolveApiOrigin.js';

function getApiOriginForSsr() {
  return resolveApiOrigin();
}

/**
 * Fetch public OHLC preview for SSR or server-side meta enrichment.
 * @param {string} symbol
 * @param {number} [limit]
 * @returns {Promise<object|null>}
 */
export async function fetchHistoricalDataPreview(symbol, limit = HISTORICAL_DATA_PREVIEW_ROWS) {
  const sym = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
  if (!sym) return null;

  const base = getApiOriginForSsr();
  const url =
    `${base}/api/public/market/ohlc-preview?symbol=${encodeURIComponent(sym)}` +
    `&limit=${encodeURIComponent(String(limit))}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
