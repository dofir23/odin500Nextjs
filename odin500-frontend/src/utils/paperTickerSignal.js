import { fetchJsonCached } from '../store/apiStore.js';
import {
  readRowSignal,
  signalSideFromBucket,
  signalSideLabel,
  toSignalBucket
} from './odinSignalTreemap.js';

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

function rowDateKey(row) {
  const d = row?.Date ?? row?.date;
  if (d && typeof d === 'object' && d.value != null) return String(d.value);
  return String(d || '');
}

/**
 * Latest Odin signal for one ticker (L1–L3 → Long, S1–S3 → Short, N → Neutral).
 * @param {string} symbol
 * @returns {Promise<{ symbol: string, bucket: string, side: 'long'|'short'|'neutral', label: string }>}
 */
export async function fetchLatestSignalForTicker(symbol) {
  const sym = String(symbol || '')
    .toUpperCase()
    .trim();
  if (!sym) {
    return { symbol: '', bucket: 'N', side: 'neutral', label: 'Neutral' };
  }

  const hit = cache.get(sym);
  if (hit && Date.now() - hit.ts < CACHE_MS) {
    return hit;
  }

  const end = new Date().toISOString().slice(0, 10);
  const startD = new Date();
  startD.setDate(startD.getDate() - 21);
  const start = startD.toISOString().slice(0, 10);

  const res = await fetchJsonCached({
    path: '/api/market/ohlc-signals-indicator',
    method: 'POST',
    body: { ticker: sym, start_date: start, end_date: end },
    ttlMs: CACHE_MS
  });

  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  const sorted = [...rows].sort((a, b) => rowDateKey(a).localeCompare(rowDateKey(b)));
  const last = sorted[sorted.length - 1];
  const bucket = toSignalBucket(readRowSignal(last));
  const side = signalSideFromBucket(bucket);
  const entry = {
    symbol: sym,
    bucket,
    side,
    label: signalSideLabel(side),
    ts: Date.now()
  };
  cache.set(sym, entry);
  return entry;
}

/** @param {string[]} symbols @param {number} [max] */
export async function fetchLatestSignalsForTickers(symbols, max = 18) {
  const list = [...new Set((symbols || []).map((s) => String(s).toUpperCase().trim()).filter(Boolean))].slice(
    0,
    max
  );
  const out = new Map();
  const chunkSize = 4;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (sym) => {
        try {
          return await fetchLatestSignalForTicker(sym);
        } catch {
          return { symbol: sym, bucket: 'N', side: 'neutral', label: '—' };
        }
      })
    );
    for (const r of results) {
      if (r?.symbol) out.set(r.symbol, r);
    }
  }
  return out;
}
