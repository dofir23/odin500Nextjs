'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import { fmtPct, fmtPctSigned } from '../utils/formatDisplayNumber.js';
import {
  CHART_CMP_COLOR_AXIS,
  CHART_CMP_COLOR_GRID,
  CHART_CMP_COLOR_GRID_ZERO,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../utils/chartComparisonTheme.js';
import { TICKER_RETURNS_COL_AVG, TICKER_RETURNS_COL_BAR, TICKER_RETURNS_COL_NEG } from './StatsTickerReturnsBarChart.jsx';

function slotCountForMode(periodMode) {
  if (periodMode === 'weekly') return 53;
  if (periodMode === 'daily') return 31;
  return 12;
}

function buildSparseSlotLabels(n, periodMode, weekAxisLabels) {
  const every = periodMode === 'weekly' ? 4 : periodMode === 'daily' ? 5 : 1;
  return Array.from({ length: n }, (_, i) => {
    if ((periodMode === 'weekly' || periodMode === 'daily') && i % every !== 0 && i !== n - 1) {
      return '';
    }
    if (periodMode === 'weekly') {
      return weekAxisLabels?.get(i + 1) || '';
    }
    return String(i + 1);
  });
}

/**
 * Fixed-slot returns chart (12 months / 53 weeks / 31 days for one year), Chart.js.
 * @param {{
 *   slotValues: Array<number | null>,
 *   periodMode?: 'monthly' | 'weekly' | 'daily',
 *   weekAxisLabels?: Map<number, string>,
 *   avgReturn?: number | null,
 *   yMin?: number,
 *   yMax?: number,
 *   plotHeight?: number,
 *   chartFullscreen?: boolean,
 *   className?: string,
 * }} props
 */
export function StatsPeriodSlotReturnsBarChart({
  slotValues = [],
  periodMode = 'monthly',
  weekAxisLabels = null,
  avgReturn = null,
  yMin = -15,
  yMax = 25,
  plotHeight = 278,
  chartFullscreen = false,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart | null} */ (null));
  const n = slotCountForMode(periodMode);
  const showBarLabels = chartFullscreen || (periodMode !== 'weekly' && periodMode !== 'daily');

  const categoryLabels = useMemo(
    () => Array.from({ length: n }, (_, i) => String(i + 1)),
    [n]
  );

  const sparseLabels = useMemo(
    () => buildSparseSlotLabels(n, periodMode, weekAxisLabels),
    [n, periodMode, weekAxisLabels]
  );

  const values = useMemo(() => {
    const src = slotValues.length >= n ? slotValues.slice(0, n) : [...slotValues, ...Array(n - slotValues.length).fill(null)];
    return src.map((v) => (Number.isFinite(v) ? v : null));
  }, [slotValues, n]);

  const barColors = useMemo(
    () => values.map((v) => (v != null && v < 0 ? TICKER_RETURNS_COL_NEG : TICKER_RETURNS_COL_BAR)),
    [values]
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
          data: values,
          rawPcts: values,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 2,
          minBarLength: 2,
          order: 2,
          datalabels: {
            color: CHART_CMP_COLOR_AXIS,
            display: (ctx) => {
              if (!showBarLabels) return false;
              const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
              return raw != null && Number.isFinite(raw);
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
            font: { size: 10, weight: '700' }
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
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                order: 1,
                datalabels: {
                  display: (ctx) => ctx.dataIndex === n - 1,
                  formatter: () => `Avg ${fmtPct(avgReturn, { plainPositive: true })}`,
                  color: TICKER_RETURNS_COL_AVG,
                  anchor: 'end',
                  align: 'bottom',
                  offset: 4,
                  font: { size: 10, weight: '700' }
                }
              }
            ]
          : [])
      ]
    }),
    [categoryLabels, values, barColors, avgLineData, n, showBarLabels, avgReturn]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      datasets: {
        bar: {
          barPercentage: periodMode === 'weekly' ? 0.95 : periodMode === 'daily' ? 0.9 : 0.78,
          categoryPercentage: periodMode === 'weekly' ? 0.95 : periodMode === 'daily' ? 0.9 : 0.78
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (_items, dataItems) => {
              const idx = dataItems?.dataIndex;
              if (idx == null) return '';
              if (periodMode === 'weekly') {
                return weekAxisLabels?.get(idx + 1) || `Week ${idx + 1}`;
              }
              if (periodMode === 'daily') return `Day ${idx + 1}`;
              return `Month ${idx + 1}`;
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
        datalabels: { clip: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            color: CHART_CMP_COLOR_AXIS,
            font: { size: 11, weight: '600' },
            callback: (_val, index) => sparseLabels[index] ?? ''
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
            stepSize: 5,
            color: CHART_CMP_COLOR_AXIS,
            padding: 6,
            font: { size: 10, weight: '600' },
            callback: (value) => fmtPctSignedAxis(value)
          }
        }
      }
    }),
    [yMin, yMax, sparseLabels, periodMode, weekAxisLabels, avgReturn]
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, slotValues, avgReturn, yMin, yMax, periodMode]);

  const heightStyle = chartFullscreen ? '100%' : `${Math.max(140, plotHeight)}px`;

  return (
    <div
      className={'stats-period-slot-returns-bar-chart ticker-monthly__chartjs' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 180 : 140 }}
      aria-label={`${periodMode} returns bar chart for selected year`}
    >
      <Chart ref={chartRef} type="bar" data={data} options={options} />
    </div>
  );
}
