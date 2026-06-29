'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';
import {
  CHART_CMP_COLOR_AXIS,
  CHART_CMP_COLOR_GRID,
  CHART_CMP_COLOR_GRID_ZERO,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../utils/chartComparisonTheme.js';
import { TICKER_RETURNS_COL_BAR, TICKER_RETURNS_COL_NEG } from './StatsTickerReturnsBarChart.jsx';

function computeSummaryYExtent(values) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (!vals.length) return { min: -10, max: 20 };
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  const span = Math.max(1, hi - lo);
  const pad = Math.max(span * 0.08, 2);
  return { min: lo - pad, max: hi + pad };
}

/**
 * Max / min / average / median summary bars (Chart.js).
 * @param {{ stats: { max: number, min: number, avg: number, med: number | null }, plotHeight?: number, chartFullscreen?: boolean, className?: string }} props
 */
export function StatsTickerReturnsSummaryBarChart({
  stats,
  plotHeight = 240,
  chartFullscreen = false,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart<'bar'> | null} */ (null));

  const items = useMemo(
    () => [
      { key: 'max', label: 'Max', v: stats?.max },
      { key: 'min', label: 'Min', v: stats?.min },
      { key: 'avg', label: 'Average', v: stats?.avg },
      { key: 'med', label: 'Median', v: stats?.med }
    ],
    [stats]
  );

  const labels = useMemo(() => items.map((it) => it.label), [items]);
  const values = useMemo(() => items.map((it) => (Number.isFinite(it.v) ? it.v : null)), [items]);
  const barColors = useMemo(
    () => values.map((v) => (v != null && v < 0 ? TICKER_RETURNS_COL_NEG : TICKER_RETURNS_COL_BAR)),
    [values]
  );
  const yExtent = useMemo(() => computeSummaryYExtent(values.filter((v) => v != null)), [values]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
          rawPcts: values,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 2,
          minBarLength: 2,
          datalabels: {
            color: CHART_CMP_COLOR_AXIS,
            display: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw);
            },
            formatter: (_v, ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw) ? fmtPctSignedCompact(raw) : '—';
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
        }
      ]
    }),
    [labels, values, barColors]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      datasets: {
        bar: {
          barPercentage: 0.8,
          categoryPercentage: 0.72
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw) ? fmtPctSigned(raw) : '—';
            }
          }
        },
        datalabels: { clip: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: CHART_CMP_COLOR_AXIS,
            font: { size: 11, weight: '700' }
          }
        },
        y: {
          min: yExtent.min,
          max: yExtent.max,
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
    }),
    [yExtent]
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, stats]);

  const heightStyle = chartFullscreen ? '100%' : `${Math.min(320, plotHeight ?? 240)}px`;

  return (
    <div
      className={'stats-ticker-returns-summary-bar-chart' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 160 : 140 }}
    >
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  );
}
