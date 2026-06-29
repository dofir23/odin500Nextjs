import { apiUrl } from './apiOrigin.js';
import { HISTORICAL_DATA_PREVIEW_ROWS } from '../ssr/fetchHistoricalDataPreview.js';

export function normalizePreviewRows(preview) {
  if (!preview?.rows?.length) return [];
  return preview.rows.map((r) => {
    const open = Number(r.open);
    const close = Number(r.close);
    const returnPct =
      Number.isFinite(open) && Number.isFinite(close) && open !== 0
        ? ((close - open) / open) * 100
        : null;
    return {
      period: r.date,
      sortKey: r.date,
      open: Number.isFinite(open) ? open : null,
      high: Number.isFinite(Number(r.high)) ? Number(r.high) : null,
      low: Number.isFinite(Number(r.low)) ? Number(r.low) : null,
      close: Number.isFinite(close) ? close : null,
      returnPct: Number.isFinite(returnPct) ? returnPct : null
    };
  });
}

export async function fetchPublicOhlcPreview(symbol, limit = HISTORICAL_DATA_PREVIEW_ROWS) {
  const sym = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
  if (!sym) return null;

  const url =
    apiUrl('/api/public/market/ohlc-preview') +
    `?symbol=${encodeURIComponent(sym)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
