import { fmtPctSigned } from './formatDisplayNumber.js';

export const CHART_CMP_COLOR_TICK = '#f59e0b';
export const CHART_CMP_COLOR_BENCH = '#3b82f6';
/** Periodic comparison charts (bench2 legend). */
export const CHART_CMP_COLOR_BENCH2 = '#3b82f6';
export const CHART_CMP_COLOR_EXCESS_LINE = '#38bdf8';
export const CHART_CMP_COLOR_EXCESS_FILL = 'rgba(56, 189, 248, 0.12)';
export const CHART_CMP_COLOR_GRID = 'rgba(148, 163, 184, 0.14)';
export const CHART_CMP_COLOR_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
export const CHART_CMP_COLOR_AXIS = 'rgba(148, 163, 184, 0.78)';

/** Readable axis / bar-value colors per document theme. */
export function getChartComparisonColors(theme = 'dark') {
  const isLight = theme === 'light';
  return {
    axis: isLight ? '#475569' : CHART_CMP_COLOR_AXIS,
    dataLabel: isLight ? '#0f172a' : '#e2e8f0',
    grid: isLight ? 'rgba(71, 85, 105, 0.2)' : CHART_CMP_COLOR_GRID,
    gridZero: isLight ? 'rgba(71, 85, 105, 0.42)' : CHART_CMP_COLOR_GRID_ZERO,
    avgLine: isLight ? '#c2410c' : '#f97316'
  };
}

export function fmtPctSignedAxis(v) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const decimals = Math.abs(n) >= 100 ? 0 : 1;
  return fmtPctSigned(n, { decimals });
}

export function fmtPctSignedCompact(v) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    const body = k.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    return `${sign}${body}K%`;
  }
  return fmtPctSignedAxis(n);
}

export function finiteComparisonPct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
