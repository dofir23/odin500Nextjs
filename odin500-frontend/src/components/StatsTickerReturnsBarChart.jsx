'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import { formatWeekAxisDate } from '../utils/isoWeek.js';
import { fmtPct, fmtPctSigned } from '../utils/formatDisplayNumber.js';
import {
  CHART_CMP_COLOR_AXIS,
  CHART_CMP_COLOR_GRID,
  CHART_CMP_COLOR_GRID_ZERO,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../utils/chartComparisonTheme.js';

export const TICKER_RETURNS_COL_BAR = '#2563eb';
export const TICKER_RETURNS_COL_NEG = '#f59e0b';
export const TICKER_RETURNS_COL_AVG = '#f97316';
export const TICKER_RETURNS_YEAR_PALETTE = [
  '#38bdf8',
  '#f97316',
  '#64748b',
  '#eab308',
  '#7dd3fc',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#f472b6',
  '#22d3ee'
];

function pickNiceStep(span, targetCount) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(2, targetCount);
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const err = raw / pow10;
  let nice = 10;
  if (err <= 1.5) nice = 1;
  else if (err <= 3) nice = 2;
  else if (err <= 7) nice = 5;
  return nice * pow10;
}

function buildTicks(yMin, yMax, step) {
  const ticks = [];
  const k0 = Math.ceil((yMin - 1e-9) / step);
  const k1 = Math.floor((yMax + 1e-9) / step);
  for (let k = k0; k <= k1; k++) {
    ticks.push(Math.round(k * step * 1e8) / 1e8);
  }
  if (!ticks.length) ticks.push(0);
  return ticks;
}

function computePercentAxis(seriesValues, avgExtra, plotPx) {
  const vals = seriesValues.filter((v) => Number.isFinite(v));
  if (!vals.length) {
    return { yMin: -20, yMax: 60 };
  }
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (avgExtra != null && Number.isFinite(avgExtra)) {
    lo = Math.min(lo, avgExtra);
    hi = Math.max(hi, avgExtra);
  }
  let span = hi - lo;
  if (span < 1e-6) {
    lo -= 5;
    hi += 5;
    span = 10;
  }
  const pad = Math.max(span * 0.08, 2);
  lo -= pad;
  hi += pad;

  const effPlot = plotPx != null && Number.isFinite(plotPx) ? plotPx : 280;
  const renderedInnerPx = effPlot * 0.75;
  const minPxPerTick = renderedInnerPx < 200 ? 28 : renderedInnerPx < 340 ? 22 : renderedInnerPx < 500 ? 18 : 14;
  const targetCount = Math.min(22, Math.max(5, Math.round(renderedInnerPx / minPxPerTick)));

  const step = pickNiceStep(hi - lo, targetCount);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  buildTicks(yMin, yMax, step);
  return { yMin, yMax };
}

function shouldLabelBar(r, i, n, periodMode, chartFullscreen) {
  if (chartFullscreen) return true;
  if (periodMode === 'monthly') {
    if (n <= 24) return true;
    if (Math.abs(Number(r.totalReturn)) >= 12) return true;
    return false;
  }
  if (periodMode === 'weekly') {
    if (n <= 24) return true;
    if (Math.abs(Number(r.totalReturn)) >= 20) return true;
    return false;
  }
  if (periodMode === 'daily') {
    if (n <= 18) return true;
    if (Math.abs(Number(r.totalReturn)) >= 4) return true;
    return false;
  }
  if (periodMode === 'quarterly') {
    if (n <= 32) return true;
    return Math.abs(Number(r.totalReturn)) >= 15;
  }
  return true;
}

function buildSparseXLabels(displayRows, periodMode) {
  const n = displayRows.length;
  const labelEvery =
    periodMode === 'monthly'
      ? n > 72
        ? 12
        : n > 48
          ? 6
          : n > 24
            ? 3
            : 1
      : n > 28
        ? 4
        : n > 14
          ? 2
          : 1;

  return displayRows.map((r, i) => {
    if (periodMode === 'monthly') {
      const isJanuary = r.month === 1;
      if (!(isJanuary || i === 0 || i === n - 1 || i % labelEvery === 0)) return '';
    } else if (periodMode === 'weekly') {
      const isYearStart = r.week === 1;
      if (!(isYearStart || i === n - 1)) return '';
    } else if (periodMode === 'daily') {
      const isMonthStart = r.day === 1;
      if (!(isMonthStart || i === 0 || i === n - 1 || i % 5 === 0)) return '';
    } else if (i % labelEvery !== 0 && i !== n - 1) {
      return '';
    }

    if (periodMode === 'monthly') {
      return r.month === 1 ? String(r.year) : r.xLabel;
    }
    if (periodMode === 'weekly') {
      if (r.week === 1) return String(r.year);
      if (i === n - 1) {
        return formatWeekAxisDate(String(r.endDate || r.period || '').slice(0, 10)) || String(r.year);
      }
      return '';
    }
    if (periodMode === 'daily') {
      return r.day === 1
        ? `${String(r.month).padStart(2, '0')}/${String(r.day).padStart(2, '0')}`
        : String(r.day);
    }
    return r.xLabel;
  });
}

function barColorsForRows(displayRows, periodMode) {
  if (periodMode !== 'monthly') {
    return displayRows.map((r) => (r.totalReturn < 0 ? TICKER_RETURNS_COL_NEG : TICKER_RETURNS_COL_BAR));
  }
  const years = [...new Set(displayRows.map((r) => r.year))].sort((a, b) => a - b);
  const yearColors = new Map(years.map((y, i) => [y, TICKER_RETURNS_YEAR_PALETTE[i % TICKER_RETURNS_YEAR_PALETTE.length]]));
  return displayRows.map((r) => yearColors.get(r.year) || TICKER_RETURNS_COL_BAR);
}

/**
 * Ticker period returns bar chart with average return line (Chart.js).
 * @param {{
 *   rows: Array<{ rowKey: string, xLabel: string, totalReturn: number, year?: number, month?: number, week?: number, day?: number, endDate?: string, period?: string }>,
 *   periodMode?: string,
 *   avgReturn?: number | null,
 *   plotHeight?: number,
 *   chartFullscreen?: boolean,
 *   className?: string,
 * }} props
 */
export function StatsTickerReturnsBarChart({
  rows = [],
  periodMode = 'annual',
  avgReturn = null,
  plotHeight = 260,
  chartFullscreen = false,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart | null} */ (null));
  const n = rows.length;
  const showBarLabels = chartFullscreen;

  const labels = useMemo(() => buildSparseXLabels(rows, periodMode), [rows, periodMode]);
  const categoryLabels = useMemo(() => rows.map((r) => r.xLabel || r.rowKey), [rows]);
  const returns = useMemo(() => rows.map((r) => r.totalReturn), [rows]);
  const barColors = useMemo(() => barColorsForRows(rows, periodMode), [rows, periodMode]);
  const yExtent = useMemo(
    () => computePercentAxis(returns, avgReturn, plotHeight),
    [returns, avgReturn, plotHeight]
  );

  const avgLineData = useMemo(() => {
    if (avgReturn == null || !Number.isFinite(avgReturn) || !n) return [];
    return Array(n).fill(avgReturn);
  }, [avgReturn, n]);

  const data = useMemo(
    () => ({
      labels: categoryLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Return',
          data: returns,
          rawPcts: returns,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 2,
          minBarLength: 2,
          order: 2,
          datalabels: {
            color: CHART_CMP_COLOR_AXIS,
            display: (ctx) => {
              if (!showBarLabels) return false;
              const row = rows[ctx.dataIndex];
              return row ? shouldLabelBar(row, ctx.dataIndex, n, periodMode, chartFullscreen) : false;
            },
            formatter: (_v, ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw) ? fmtPctSignedCompact(raw) : '';
            },
            anchor: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && raw < 0 ? 'start' : 'end';
            },
            align: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && raw < 0 ? 'bottom' : 'top';
            },
            offset: 2,
            font: { size: 11, weight: '700' }
          }
        },
        ...(avgLineData.length
          ? [
              {
                type: 'line',
                label: 'Average',
                data: avgLineData,
                borderColor: TICKER_RETURNS_COL_AVG,
                backgroundColor: TICKER_RETURNS_COL_AVG,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                order: 1,
                datalabels: {
                  display: (ctx) => ctx.dataIndex === n - 1,
                  formatter: () => {
                    const sign = avgReturn >= 0 ? '+' : '';
                    return `Av. ${sign}${fmtPct(avgReturn, { plainPositive: true })}`;
                  },
                  color: TICKER_RETURNS_COL_AVG,
                  anchor: 'end',
                  align: (ctx) => {
                    const yScale = ctx.chart.scales.y;
                    const avgPx = yScale.getPixelForValue(avgReturn);
                    const topPx = yScale.top;
                    return avgPx < topPx + 16 ? 'bottom' : 'top';
                  },
                  offset: 4,
                  font: { size: 10, weight: '700' }
                }
              }
            ]
          : [])
      ]
    }),
    [categoryLabels, returns, barColors, avgLineData, rows, n, periodMode, chartFullscreen, showBarLabels, avgReturn]
  );

  const options = useMemo(() => {
    const { yMin, yMax } = yExtent;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      datasets: {
        bar: {
          barPercentage: 0.85,
          categoryPercentage: 0.85
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx == null) return '';
              return rows[idx]?.xLabel ?? items[0]?.label ?? '';
            },
            label: (ctx) => {
              if (ctx.dataset.type === 'line') {
                return `Average: ${fmtPctSigned(avgReturn)}`;
              }
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw) ? `Return: ${fmtPctSigned(raw)}` : '';
            }
          }
        },
        datalabels: {
          clip: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            color: CHART_CMP_COLOR_AXIS,
            font: { size: 11, weight: '600' },
            callback: (_val, index) => labels[index] ?? ''
          }
        },
        y: {
          min: yMin,
          max: yMax,
          grid: {
            color: (ctx) => {
              const v = ctx.tick?.value;
              if (v === 0 || Math.abs(Number(v)) < 1e-9) return CHART_CMP_COLOR_GRID_ZERO;
              return CHART_CMP_COLOR_GRID;
            },
            lineWidth: (ctx) => {
              const v = ctx.tick?.value;
              return v === 0 || Math.abs(Number(v)) < 1e-9 ? 1.35 : 1;
            }
          },
          ticks: {
            color: CHART_CMP_COLOR_AXIS,
            padding: 6,
            font: { size: 11, weight: '600' },
            callback: (value) => fmtPctSignedAxis(value)
          }
        }
      }
    };
  }, [yExtent, labels, rows, avgReturn]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, rows, avgReturn]);

  const heightStyle = chartFullscreen ? '100%' : `${Math.max(140, plotHeight)}px`;

  return (
    <div
      className={'stats-ticker-returns-bar-chart' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 180 : 140 }}
      aria-label={`${periodMode} returns bar chart`}
    >
      <Chart ref={chartRef} type="bar" data={data} options={options} />
    </div>
  );
}
