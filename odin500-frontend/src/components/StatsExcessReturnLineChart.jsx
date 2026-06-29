'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import {
  CHART_CMP_COLOR_AXIS,
  CHART_CMP_COLOR_EXCESS_FILL,
  CHART_CMP_COLOR_EXCESS_LINE,
  CHART_CMP_COLOR_GRID,
  CHART_CMP_COLOR_GRID_ZERO,
  finiteComparisonPct,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../utils/chartComparisonTheme.js';
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';

function computeExcessYExtent(rows) {
  const pcts = [];
  for (const r of rows) {
    const v = finiteComparisonPct(r.excessReturn);
    if (v != null) pcts.push(v);
  }
  if (!pcts.length) return { min: -10, max: 10 };
  const minV = Math.min(0, ...pcts);
  const maxV = Math.max(0, ...pcts);
  const span = Math.max(1, maxV - minV);
  const pad = span * 0.1;
  return { min: minV - pad, max: maxV + pad };
}

/**
 * Excess return line (ticker − benchmark), Chart.js linear Y with zero fill.
 * @param {{
 *   rows: Array<{ period?: string, excessReturn?: number | null }>,
 *   seriesLabel: string,
 *   formatXAxisLabel?: (period: string) => string,
 *   xAxisMaxLabels?: number,
 *   plotHeight?: number,
 *   chartFullscreen?: boolean,
 *   showPointLabels?: boolean,
 *   className?: string,
 * }} props
 */
export function StatsExcessReturnLineChart({
  rows = [],
  seriesLabel,
  formatXAxisLabel = null,
  xAxisMaxLabels = 12,
  plotHeight = 300,
  chartFullscreen = false,
  showPointLabels = false,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart<'line'> | null} */ (null));
  const showDatalabels = chartFullscreen || showPointLabels;

  const labels = useMemo(() => {
    return rows.map((r) => {
      const period = String(r.period ?? '');
      return typeof formatXAxisLabel === 'function' ? formatXAxisLabel(period) : period;
    });
  }, [rows, formatXAxisLabel]);

  const excessRaw = useMemo(() => rows.map((r) => finiteComparisonPct(r.excessReturn)), [rows]);
  const yExtent = useMemo(() => computeExcessYExtent(rows), [rows]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: seriesLabel,
          data: excessRaw,
          rawPcts: excessRaw,
          borderColor: CHART_CMP_COLOR_EXCESS_LINE,
          backgroundColor: CHART_CMP_COLOR_EXCESS_FILL,
          pointBackgroundColor: CHART_CMP_COLOR_EXCESS_LINE,
          pointBorderColor: CHART_CMP_COLOR_EXCESS_LINE,
          pointRadius: 3,
          pointHoverRadius: 4,
          borderWidth: 2.4,
          fill: true,
          tension: 0,
          spanGaps: false,
          datalabels: { color: CHART_CMP_COLOR_EXCESS_LINE }
        }
      ]
    }),
    [labels, seriesLabel, excessRaw]
  );

  const options = useMemo(() => {
    const { min, max } = yExtent;
    const cap = Math.max(4, Number(xAxisMaxLabels) || 12);
    const dense = labels.length > cap;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => (items[0]?.label != null ? String(items[0].label) : ''),
            label: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              const text = raw != null && Number.isFinite(raw) ? fmtPctSigned(raw) : '—';
              return `${seriesLabel}: ${text}`;
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
          offset: 4
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
  }, [yExtent, labels.length, xAxisMaxLabels, showDatalabels, seriesLabel]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, showPointLabels, rows]);

  const heightStyle = chartFullscreen ? '100%' : `${plotHeight}px`;

  return (
    <div
      className={'stats-excess-return-line-chart' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 180 : undefined }}
    >
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
