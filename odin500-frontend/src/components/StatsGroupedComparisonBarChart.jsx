'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';
import {
  CHART_CMP_COLOR_AXIS,
  CHART_CMP_COLOR_BENCH,
  CHART_CMP_COLOR_GRID,
  CHART_CMP_COLOR_GRID_ZERO,
  CHART_CMP_COLOR_TICK,
  finiteComparisonPct,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../utils/chartComparisonTheme.js';

function computeLinearYExtent(rows) {
  const pcts = [];
  for (const r of rows) {
    const t = finiteComparisonPct(r.tickerReturn);
    const b = finiteComparisonPct(r.benchmarkReturn);
    if (t != null) pcts.push(t);
    if (b != null) pcts.push(b);
  }
  if (!pcts.length) return { min: -10, max: 20 };
  const minV = Math.min(0, ...pcts);
  const maxV = Math.max(0, ...pcts);
  const span = Math.max(1, maxV - minV);
  const pad = span * 0.08;
  return { min: minV - pad, max: maxV + pad };
}

/**
 * Grouped ticker vs benchmark returns (Chart.js, linear Y).
 * @param {{
 *   rows: Array<{ period?: string, tickerReturn?: number | null, benchmarkReturn?: number | null }>,
 *   tickerLabel: string,
 *   benchLabel: string,
 *   formatXAxisLabel?: (period: string) => string,
 *   xAxisMaxLabels?: number,
 *   plotHeight?: number,
 *   chartFullscreen?: boolean,
 *   showBarLabels?: boolean,
 *   benchBarColor?: string,
 *   className?: string,
 * }} props
 */
export function StatsGroupedComparisonBarChart({
  rows = [],
  tickerLabel,
  benchLabel,
  formatXAxisLabel = null,
  xAxisMaxLabels = 16,
  plotHeight = 300,
  chartFullscreen = false,
  showBarLabels = false,
  benchBarColor = CHART_CMP_COLOR_BENCH,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart<'bar'> | null} */ (null));
  const showDatalabels = chartFullscreen || showBarLabels;

  const labels = useMemo(() => {
    return rows.map((r) => {
      const period = String(r.period ?? '');
      return typeof formatXAxisLabel === 'function' ? formatXAxisLabel(period) : period;
    });
  }, [rows, formatXAxisLabel]);

  const benchRaw = useMemo(() => rows.map((r) => finiteComparisonPct(r.benchmarkReturn)), [rows]);
  const tickRaw = useMemo(() => rows.map((r) => finiteComparisonPct(r.tickerReturn)), [rows]);

  const yExtent = useMemo(() => computeLinearYExtent(rows), [rows]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: benchLabel,
          data: benchRaw,
          rawPcts: benchRaw,
          backgroundColor: benchBarColor,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3,
          datalabels: { color: benchBarColor }
        },
        {
          label: tickerLabel,
          data: tickRaw,
          rawPcts: tickRaw,
          backgroundColor: CHART_CMP_COLOR_TICK,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3,
          datalabels: { color: CHART_CMP_COLOR_TICK }
        }
      ]
    }),
    [labels, benchLabel, tickerLabel, benchRaw, tickRaw, benchBarColor]
  );

  const options = useMemo(() => {
    const { min, max } = yExtent;
    const cap = Math.max(4, Number(xAxisMaxLabels) || 16);
    const dense = labels.length > cap;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      datasets: {
        bar: {
          barPercentage: 0.82,
          categoryPercentage: 0.72
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => (items[0]?.label != null ? String(items[0].label) : ''),
            label: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              const label = ctx.dataset.label || '';
              const text = raw != null && Number.isFinite(raw) ? fmtPctSigned(raw) : '—';
              return `${label}: ${text}`;
            }
          }
        },
        datalabels: {
          display: (ctx) => {
            if (!showDatalabels) return false;
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && Number.isFinite(raw);
          },
          formatter: (_value, ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return fmtPctSignedCompact(raw);
          },
          font: { size: 9, weight: '700' },
          anchor: (ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && raw < 0 ? 'start' : 'end';
          },
          align: (ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && raw < 0 ? 'bottom' : 'top';
          },
          offset: 2
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: dense,
            maxTicksLimit: dense ? cap : undefined,
            maxRotation: 0,
            color: CHART_CMP_COLOR_AXIS,
            font: { size: 10, weight: '600' }
          }
        },
        y: {
          min,
          max,
          grid: {
            color: (ctx) => {
              const v = ctx.tick?.value;
              if (v === 0 || Math.abs(Number(v)) < 1e-9) return CHART_CMP_COLOR_GRID_ZERO;
              return CHART_CMP_COLOR_GRID;
            }
          },
          ticks: {
            maxTicksLimit: 8,
            color: CHART_CMP_COLOR_AXIS,
            padding: 6,
            font: { size: 10, weight: '600' },
            callback: (value) => fmtPctSignedAxis(value)
          }
        }
      }
    };
  }, [yExtent, labels.length, xAxisMaxLabels, showDatalabels]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, showBarLabels, rows]);

  const heightStyle = chartFullscreen ? '100%' : `${plotHeight}px`;

  return (
    <div
      className={'stats-grouped-comparison-bar-chart' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 180 : undefined }}
    >
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  );
}
