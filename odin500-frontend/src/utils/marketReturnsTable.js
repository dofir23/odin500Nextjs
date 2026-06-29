import { fetchJsonCached, canFetchMarketData } from '../store/apiStore.js';
import { MARKET_SERIES, META_BY_KEY, OTHER_MARKET_SUBSECTIONS } from '../components/marketSeriesRegistry.js';

/** Summary column → `performance.dynamicPeriods[].period` (POST /api/market/ticker-returns). */
export const MARKET_SUMMARY_TF_PERIOD = {
  '1D': 'Last date',
  '1M': 'Last Month',
  '6M': 'Last 6 months',
  '1Y': 'Last 1 year',
  '3Y': 'Last 3 years',
  '5Y': 'Last 5 years',
  '10Y': 'Last 10 years',
  '20Y': 'Last 20 years'
};

export const MARKET_SUMMARY_TFS = Object.keys(MARKET_SUMMARY_TF_PERIOD).map((key) => ({ key }));

export const RETURN_TABLE_LEFT_GROUPS = [
  { id: 'us', title: 'Key US Indices' },
  { id: 'index', title: 'Index ETFs' },
  { id: 'sector', title: 'SP500 Sectors' },
  { id: 'other', title: 'Other Markets ETFs' }
];

export const RETURN_TABLE_PAGE_SIZE = 20;

/** Index constituent tables on the return table page (POST /api/market/ticker-details). */
export const RETURN_TABLE_INDEX_UNIVERSES = [
  { id: 'sp500', title: 'S&P 500', apiIndex: 'SP500' },
  { id: 'dow-jones', title: 'Dow Jones', apiIndex: 'Dow Jones' },
  { id: 'nasdaq-100', title: 'Nasdaq 100', apiIndex: 'Nasdaq 100' }
];

export function rowDefTicker(d) {
  return String(d.ticker || META_BY_KEY[d.key]?.ticker || d.key || '')
    .toUpperCase()
    .trim();
}

export function pickTickerReturnsFromBatch(payload, ticker) {
  const u = String(ticker || '').toUpperCase().trim();
  if (!payload || !u) return null;
  if (payload.batch === true && payload.byTicker && payload.byTicker[u] != null) {
    const row = payload.byTicker[u];
    if (row && row.success === false) return null;
    return row;
  }
  if (!payload.batch && String(payload.ticker || '').toUpperCase() === u) return payload;
  return null;
}

export function pickDynamicReturnPct(dynamicPeriods, periodName) {
  if (!periodName || !Array.isArray(dynamicPeriods)) return undefined;
  const row = dynamicPeriods.find((r) => r.period === periodName);
  const v = row?.totalReturn;
  return v != null && Number.isFinite(Number(v)) ? Number(v) : undefined;
}

export function marketSeriesToRowDef(s) {
  const useFundName = s.group === 'other' && s.subsection === 'inverse' && s.addon;
  return {
    key: s.key,
    label: String(useFundName ? s.addon : s.label || s.key || '').trim()
  };
}

function groupSeries(groupId) {
  return MARKET_SERIES.filter((s) => s.group === groupId).map(marketSeriesToRowDef);
}

/** Sections for the return table page (mirrors market page left aside groups). */
export function returnTableSections() {
  return RETURN_TABLE_LEFT_GROUPS.map((g) => {
    if (g.id === 'other') {
      const rows = MARKET_SERIES.filter((s) => s.group === 'other');
      const subsections = OTHER_MARKET_SUBSECTIONS.map((sub) => ({
        id: sub.id,
        title: sub.title,
        rows: rows.filter((r) => r.subsection === sub.id).map(marketSeriesToRowDef)
      })).filter((sub) => sub.rows.length > 0);
      return { ...g, subsections, rows: [] };
    }
    return { ...g, rows: groupSeries(g.id), subsections: null };
  });
}

export function uniqueMarketSummaryTickers(rowDefs) {
  const seen = new Set();
  const list = [];
  for (const d of rowDefs) {
    const t = rowDefTicker(d);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    list.push(t);
  }
  return list;
}

export function allReturnTableRowDefs() {
  return MARKET_SERIES.map(marketSeriesToRowDef);
}

export function buildValsFromBatch(payload, rowDefs, tfs = MARKET_SUMMARY_TFS) {
  const out = {};
  for (const d of rowDefs) {
    const sym = rowDefTicker(d);
    const rec = pickTickerReturnsFromBatch(payload, sym);
    const periods = rec?.performance?.dynamicPeriods || [];
    out[d.key] = {};
    for (const tf of tfs) {
      out[d.key][tf.key] = pickDynamicReturnPct(periods, MARKET_SUMMARY_TF_PERIOD[tf.key]);
    }
  }
  return out;
}

/** Must match `MAX_TICKER_RETURNS_BATCH` in `odin500-backend/controllers/marketController.js`. */
export const MAX_TICKER_RETURNS_BATCH = 12;

export function chunkTickerList(tickers, size = MAX_TICKER_RETURNS_BATCH) {
  const chunks = [];
  for (let i = 0; i < tickers.length; i += size) {
    chunks.push(tickers.slice(i, i + size));
  }
  return chunks;
}

/** Normalize single-ticker and batched `/ticker-returns` responses into `{ batch, byTicker }`. */
export function normalizeTickerReturnsPayload(payload) {
  if (!payload) return { batch: true, byTicker: {} };
  if (payload.batch === true && payload.byTicker) return payload;
  const t = String(payload.ticker || '').toUpperCase().trim();
  if (t) return { batch: true, byTicker: { [t]: payload } };
  return { batch: true, byTicker: {} };
}

async function fetchMarketTickerReturnsChunk(tickers, refreshMs) {
  const { data: payload } = await fetchJsonCached({
    path: '/api/market/ticker-returns',
    method: 'POST',
    body: { tickers },
    auth: true,
    ttlMs: refreshMs > 0 ? Math.max(refreshMs, 15_000) : 5 * 60 * 1000
  });
  if (!payload?.success && payload?.batch !== true) {
    throw new Error(payload?.error || 'Failed loading returns');
  }
  return normalizeTickerReturnsPayload(payload);
}

/**
 * POST /api/market/ticker-returns — loads `performance.dynamicPeriods` for many symbols.
 * Backend allows at most {@link MAX_TICKER_RETURNS_BATCH} tickers per request; larger lists are chunked automatically.
 */
export async function fetchMarketTickerReturnsBatch(tickers, refreshMs = 0) {
  if (!canFetchMarketData()) {
    throw new Error('Unable to load return tables.');
  }
  const unique = [
    ...new Set(tickers.map((t) => String(t || '').toUpperCase().trim()).filter(Boolean))
  ];
  if (!unique.length) return { batch: true, byTicker: {} };

  const chunks = chunkTickerList(unique);
  const parts = await Promise.all(chunks.map((chunk) => fetchMarketTickerReturnsChunk(chunk, refreshMs)));

  const byTicker = {};
  for (const part of parts) {
    Object.assign(byTicker, part.byTicker || {});
  }
  return { success: true, batch: true, byTicker };
}

/** Constituent symbols for an index (POST /api/market/ticker-details). */
export async function fetchIndexConstituentRowDefs(apiIndex) {
  if (!canFetchMarketData()) return [];
  const { data } = await fetchJsonCached({
    path: '/api/market/ticker-details',
    method: 'POST',
    body: { index: apiIndex, period: 'last-date' },
    auth: true,
    ttlMs: 5 * 60 * 1000
  });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const seen = new Set();
  const defs = [];
  for (const r of rows) {
    const symbol = String(r.symbol || r.Symbol || '').toUpperCase().trim();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    const name = String(r.name || r.Name || r.companyName || r.CompanyName || '').trim();
    defs.push({ key: symbol, ticker: symbol, label: name || symbol });
  }
  defs.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return defs;
}
