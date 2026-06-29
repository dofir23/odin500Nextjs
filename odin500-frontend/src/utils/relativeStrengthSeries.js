import { mapRowsToCandles } from './chartData.js';
import { sparseChartLabelToTime } from './drawdownSeries.js';

/**
 * @param {{ labels?: string[], values?: number[] }} sparse
 */
export function relativeStrengthPointsFromSparse(sparse) {
  const labels = sparse?.labels || [];
  const values = sparse?.values || [];
  return labels
    .map((label, i) => ({
      time: sparseChartLabelToTime(label),
      value: Number(values[i])
    }))
    .filter((p) => p.time && Number.isFinite(p.value));
}

/**
 * Rebased ratio index: (ticker / benchmark) normalized to 100 at first aligned bar.
 * @param {unknown[]} tickerRows
 * @param {unknown[]} benchRows
 */
export function buildRelativeStrengthFromOhlc(tickerRows, benchRows) {
  const tickerCandles = mapRowsToCandles(tickerRows || []);
  const benchCandles = mapRowsToCandles(benchRows || []);
  const benchByTime = new Map(benchCandles.map((c) => [c.time, c.close]));

  const aligned = [];
  for (const tc of tickerCandles) {
    const benchClose = benchByTime.get(tc.time);
    if (benchClose == null || benchClose <= 0 || tc.close <= 0) continue;
    aligned.push({ time: tc.time, ratio: tc.close / benchClose });
  }
  if (!aligned.length) return [];

  const base = aligned[0].ratio;
  return aligned.map((p) => ({
    time: p.time,
    value: Math.round((p.ratio / base) * 1000) / 10
  }));
}

/**
 * @param {{ time: string, value: number }[]} points
 */
export function findPeakTroughNow(points) {
  if (!points?.length) return null;
  let peak = points[0];
  let trough = points[0];
  for (const p of points) {
    if (p.value > peak.value) peak = p;
    if (p.value < trough.value) trough = p;
  }
  return {
    peak,
    trough,
    now: points[points.length - 1]
  };
}

export function formatRsLegendDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatRsValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

/**
 * Prefer live peak/trough from dense series; fall back to report metadata for sparse charts.
 * @param {{ time: string, value: number }[]} points
 * @param {{ peak?: number, trough?: number, peakDate?: string, troughDate?: string, values?: number[] }} fallback
 */
export function resolveRelativeStrengthStats(points, fallback = {}) {
  const computed = findPeakTroughNow(points);
  const nowVal = computed?.now?.value ?? fallback?.values?.[fallback.values.length - 1];
  const useReportExtrema = !computed || points.length <= 8;

  const peakVal = useReportExtrema && fallback?.peak != null ? Number(fallback.peak) : computed?.peak?.value;
  const troughVal =
    useReportExtrema && fallback?.trough != null ? Number(fallback.trough) : computed?.trough?.value;

  const peakDate =
    useReportExtrema && fallback?.peakDate
      ? String(fallback.peakDate)
      : computed?.peak?.time
        ? formatRsLegendDate(computed.peak.time)
        : '';

  const troughDate =
    useReportExtrema && fallback?.troughDate
      ? String(fallback.troughDate)
      : computed?.trough?.time
        ? formatRsLegendDate(computed.trough.time)
        : '';

  const troughPoint =
    computed?.trough && (!useReportExtrema || fallback?.trough == null)
      ? computed.trough
      : findClosestPoint(points, troughVal) || computed?.trough || null;

  return {
    peak: formatRsValue(peakVal),
    trough: formatRsValue(troughVal),
    now: formatRsValue(nowVal),
    peakDate,
    troughDate,
    troughPoint
  };
}

function findClosestPoint(points, targetVal) {
  const target = Number(targetVal);
  if (!points?.length || !Number.isFinite(target)) return null;
  let best = points[0];
  let bestDiff = Math.abs(best.value - target);
  for (const p of points) {
    const diff = Math.abs(p.value - target);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}
