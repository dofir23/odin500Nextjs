/**
 * Delay after last keystroke before calling `GET /api/tickers/search` (and watchlist resolve).
 * Shared by `TickerSymbolCombobox` and `WatchlistTickerMultiselect`.
 *
 * Override in `.env`: `VITE_TICKER_SEARCH_DEBOUNCE_MS=300` (integer ms, clamped 50–5000).
 */
import { tickerSearchDebounceMs } from '../lib/env.js';

function readTickerSearchDebounceMs() {
  const raw = tickerSearchDebounceMs();
  if (raw === undefined || raw === '') return 400;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 400;
  return Math.min(5000, Math.max(50, Math.floor(n)));
}

export const TICKER_SEARCH_DEBOUNCE_MS = readTickerSearchDebounceMs();
