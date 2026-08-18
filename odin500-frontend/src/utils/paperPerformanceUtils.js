/** @typedef {'1M'|'3M'|'6M'|'YTD'|'ALL'} PaperPerfRange */

export const PAPER_PERF_RANGES = [
  { id: '1M', label: '1 month', short: '1M' },
  { id: '3M', label: '3 months', short: '3M' },
  { id: '6M', label: '6 months', short: '6M' },
  { id: 'YTD', label: 'Year to date', short: 'YTD' },
  { id: 'ALL', label: 'All time', short: 'All' }
];

/** @param {string} iso */
export function snapshotToUnixSec(iso) {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/** @param {PaperPerfRange} range */
export function rangeStartDate(range) {
  const now = new Date();
  if (range === 'ALL') return null;
  if (range === 'YTD') return new Date(now.getFullYear(), 0, 1);
  const d = new Date(now);
  if (range === '1M') d.setMonth(d.getMonth() - 1);
  else if (range === '3M') d.setMonth(d.getMonth() - 3);
  else if (range === '6M') d.setMonth(d.getMonth() - 6);
  return d;
}

/**
 * @param {Array<{ snapshot_at: string, equity: number }>} history
 * @param {PaperPerfRange} range
 */
export function filterHistoryByRange(history, range) {
  const start = rangeStartDate(range);
  if (!start) return [...(history || [])];
  const startMs = start.getTime();
  return (history || []).filter((row) => Date.parse(row.snapshot_at) >= startMs);
}

/**
 * @param {Array<{ time: number, value: number }>} points
 */
export function dedupeAscendingPoints(points) {
  const sorted = [...(points || [])].sort((a, b) => a.time - b.time);
  const out = [];
  for (const pt of sorted) {
    const last = out[out.length - 1];
    if (last && last.time === pt.time) last.value = pt.value;
    else if (!last || pt.time > last.time) out.push({ ...pt });
  }
  return out;
}

/**
 * @param {Array<{ snapshot_at: string, equity: number }>} history
 */
export function historyToChartPoints(history) {
  const raw = (history || [])
    .map((row) => {
      const time = snapshotToUnixSec(row.snapshot_at);
      const equity = Number(row.equity);
      if (time == null || !Number.isFinite(equity)) return null;
      return { time, value: equity };
    })
    .filter(Boolean);
  return dedupeAscendingPoints(raw);
}

/** Snapshots are stamped in UTC, but a "trading day" is a New York day. */
const MARKET_TIME_ZONE = 'America/New_York';

/** `en-CA` formats as YYYY-MM-DD, which is exactly the key we want. */
const MARKET_DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: MARKET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** @param {number} unixSec → 'YYYY-MM-DD' for the New York day that timestamp falls in. */
export function marketDayKey(unixSec) {
  const ms = Number(unixSec) * 1000;
  if (!Number.isFinite(ms)) return null;
  const key = MARKET_DAY_FMT.format(new Date(ms));
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/** Midnight UTC for a day key — what lightweight-charts renders as that calendar date. */
function dayKeyToUnixSec(key) {
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Collapse intraday snapshots to one point per trading day.
 *
 * The snapshot job writes several rows a day, which made the line look like an intraday tick
 * chart and left flat weekend plateaus where nothing traded. Keeping only the last snapshot of
 * each New York weekday gives the same daily-close cadence as the ticker charts.
 *
 * Holidays are not filtered — the market calendar lives on the backend, and a lone holiday
 * snapshot just repeats the prior close rather than drawing a misleading gap.
 *
 * @param {Array<{ time: number, value: number }>} points
 */
export function toDailyTradingPoints(points) {
  const byDay = new Map();
  // Ascending, so the last write for a day is that day's closing value.
  for (const pt of dedupeAscendingPoints(points)) {
    const key = marketDayKey(pt.time);
    if (!key) continue;
    const time = dayKeyToUnixSec(key);
    if (time == null) continue;
    const weekday = new Date(time * 1000).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    byDay.set(key, { time, value: pt.value });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

/**
 * Rebase series so first point = 100 (percentage performance).
 * @param {Array<{ time: number, value: number }>} points
 */
export function rebaseToHundred(points) {
  const pts = dedupeAscendingPoints(points);
  if (!pts.length) return [];
  const base = Number(pts[0].value);
  if (!Number.isFinite(base) || base <= 0) return pts.map((p) => ({ time: p.time, value: 100 }));
  return pts.map((p) => ({
    time: p.time,
    value: Math.round((p.value / base) * 10000) / 100
  }));
}

/**
 * @param {Array<{ Date?: string, date?: string, Close?: number, close?: number }>} rows
 */
export function ohlcRowsToClosePoints(rows) {
  const raw = (rows || [])
    .map((row) => {
      const dateStr = row.Date ?? row.date ?? row.market_date;
      const close = Number(row.Close ?? row.close ?? row.close_price ?? row.price);
      if (!dateStr || !Number.isFinite(close) || close <= 0) return null;
      const time = snapshotToUnixSec(String(dateStr).length <= 10 ? `${dateStr}T12:00:00Z` : dateStr);
      if (time == null) return null;
      return { time, value: close };
    })
    .filter(Boolean);
  return dedupeAscendingPoints(raw);
}

/**
 * Align benchmark to portfolio times (nearest prior benchmark point).
 * @param {Array<{ time: number, value: number }>} portfolioPts
 * @param {Array<{ time: number, value: number }>} benchmarkPts
 */
export function alignBenchmarkToPortfolio(portfolioPts, benchmarkPts) {
  const bench = dedupeAscendingPoints(benchmarkPts);
  if (!portfolioPts.length || !bench.length) return [];
  const out = [];
  let j = 0;
  for (const p of dedupeAscendingPoints(portfolioPts)) {
    while (j + 1 < bench.length && bench[j + 1].time <= p.time) j += 1;
    const b = bench[j];
    if (b && b.time <= p.time) out.push({ time: p.time, value: b.value });
  }
  return out;
}

/**
 * @param {Array<{ time: number, value: number }>} points
 */
export function periodReturnPct(points) {
  const pts = dedupeAscendingPoints(points);
  if (pts.length < 2) return null;
  const first = Number(pts[0].value);
  const last = Number(pts[pts.length - 1].value);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

/**
 * @param {Array<{ time: number, value: number }>} points
 */
export function maxDrawdownPct(points) {
  const pts = dedupeAscendingPoints(points);
  if (pts.length < 2) return null;
  let peak = Number(pts[0].value);
  let maxDd = 0;
  for (const p of pts) {
    const v = Number(p.value);
    if (!Number.isFinite(v)) continue;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((peak - v) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/** Chart palette for multiple accounts (readable in light + dark). */
export const PAPER_CHART_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1'
];
