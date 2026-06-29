import { mapRowsToCandles } from './chartData.js';

const MONTH_TO_NUM = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12
};

/** @param {string} label e.g. "Jan 2023" */
export function sparseChartLabelToTime(label) {
  const s = String(label || '').trim();
  const m = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return s.slice(0, 10);
  const month = MONTH_TO_NUM[m[1]] || 1;
  const year = Number(m[2]);
  const day = 15;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Rolling peak drawdown (%), always <= 0.
 * @param {{ time: string, close: number }[]} candles
 */
export function computeDrawdownFromCandles(candles) {
  let peak = -Infinity;
  const points = [];
  for (const c of candles) {
    if (!c?.time || c.close == null) continue;
    if (c.close > peak) peak = c.close;
    const dd = peak > 0 ? ((c.close - peak) / peak) * 100 : 0;
    points.push({ time: c.time, value: dd <= 0 ? dd : 0 });
  }
  return points;
}

/**
 * @param {{ labels?: string[], values?: number[] }} sparse
 */
export function drawdownPointsFromSparse(sparse) {
  const labels = sparse?.labels || [];
  const values = sparse?.values || [];
  return labels
    .map((label, i) => ({
      time: sparseChartLabelToTime(label),
      value: Number(values[i]) <= 0 ? Number(values[i]) : 0
    }))
    .filter((p) => p.time && Number.isFinite(p.value));
}

/**
 * @param {{ time: string, value: number }[]} points
 */
export function findMaxDrawdownPoint(points) {
  if (!points?.length) return null;
  let min = points[0];
  for (const p of points) {
    if (p.value < min.value) min = p;
  }
  return min.value < -0.01 ? min : null;
}

export function formatDrawdownAxis(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1) return '-0%';
  return `${n}%`;
}

export function formatDrawdownPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

export function formatDrawdownDateLabel(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** @param {unknown[]} rows */
export function drawdownFromOhlcRows(rows) {
  const candles = mapRowsToCandles(rows || []);
  return computeDrawdownFromCandles(candles);
}
