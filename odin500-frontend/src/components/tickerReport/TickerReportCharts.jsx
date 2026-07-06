'use client';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import '../../utils/chartJsSetup.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import {
  CHART_CMP_COLOR_BENCH,
  CHART_CMP_COLOR_TICK,
  getChartComparisonColors,
  fmtPctSignedAxis,
  fmtPctSignedCompact
} from '../../utils/chartComparisonTheme.js';
import { useChartComparisonColors } from '../../hooks/useChartComparisonColors.js';

/** Shared app font stack so report charts render in the same face as the rest of the site. */
const APP_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
/** Single-series return bars use the same blue (positive) / amber (negative) as StatsTickerReturnsBarChart. */
const RETURN_POS = '#2563eb';
const RETURN_NEG = '#f59e0b';

function zeroAwareGrid(ctx, colors) {
  const v = ctx.tick?.value;
  return v === 0 || Math.abs(Number(v)) < 1e-9 ? colors.gridZero : colors.grid;
}

function zeroAwareGridWidth(ctx) {
  const v = ctx.tick?.value;
  return v === 0 || Math.abs(Number(v)) < 1e-9 ? 1.35 : 1;
}

/**
 * Chart.js options that mirror the site's comparison/return bar charts
 * (StatsGroupedComparisonBarChart / StatsTickerReturnsBarChart).
 */
function baseOptions({ legend = false, grouped = false, showBarLabels = false, colors = getChartComparisonColors('dark') } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    font: { family: APP_FONT },
    datasets: {
      bar: {
        barPercentage: grouped ? 0.82 : 0.85,
        categoryPercentage: grouped ? 0.72 : 0.85
      }
    },
    plugins: {
      legend: {
        display: legend,
        labels: {
          color: colors.axis,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          font: { family: APP_FONT, size: 11, weight: '600' }
        }
      },
      // Datalabels are registered globally (chartJsSetup).
      datalabels: {
        display: (ctx) => {
          if (!showBarLabels) return false;
          const raw = ctx.dataset.data?.[ctx.dataIndex];
          return raw != null && Number.isFinite(raw);
        },
        formatter: (value) => (Number.isFinite(value) ? fmtPctSignedCompact(value) : ''),
        color: colors.dataLabel,
        font: { family: APP_FONT, size: 10, weight: '700' },
        anchor: (ctx) => (Number(ctx.dataset.data?.[ctx.dataIndex]) < 0 ? 'start' : 'end'),
        align: (ctx) => (Number(ctx.dataset.data?.[ctx.dataIndex]) < 0 ? 'bottom' : 'top'),
        offset: 2,
        clip: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        titleFont: { family: APP_FONT, size: 11, weight: '600' },
        bodyFont: { family: APP_FONT, size: 11 },
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || '';
            const raw = ctx.parsed?.y;
            const text = raw != null && Number.isFinite(raw) ? fmtPctSigned(raw) : '—';
            return label ? `${label}: ${text}` : text;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: colors.axis,
          autoSkip: true,
          maxRotation: 0,
          font: { family: APP_FONT, size: 10, weight: '600' }
        }
      },
      y: {
        grid: { color: (ctx) => zeroAwareGrid(ctx, colors), lineWidth: zeroAwareGridWidth },
        ticks: {
          color: colors.axis,
          padding: 6,
          maxTicksLimit: 8,
          font: { family: APP_FONT, size: 10, weight: '600' },
          callback: (value) => fmtPctSignedAxis(value)
        }
      }
    }
  };
}

export function TickerReportMonthlyReturnsChart({ data }) {
  const cmpColors = useChartComparisonColors();
  const values = data.values || [];
  const chartData = useMemo(
    () => ({
      labels: values.map((_, i) => `M${i + 1}`),
      datasets: [
        {
          label: 'Monthly return',
          data: values,
          backgroundColor: values.map((v) => (v >= 0 ? RETURN_POS : RETURN_NEG)),
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3
        }
      ]
    }),
    [values]
  );
  const options = useMemo(() => baseOptions({ legend: false, colors: cmpColors }), [cmpColors]);
  return (
    <figure className="ticker-report__chart">
      <div className="ticker-report__chart-canvas ticker-report__chart-canvas--bar">
        <Bar data={chartData} options={options} />
      </div>
      <figcaption>Monthly returns over the trailing 3-year window (blue positive, amber negative).</figcaption>
    </figure>
  );
}

export function TickerReportAnnualCompareChart({ data, symbol }) {
  const cmpColors = useChartComparisonColors();
  const chartData = useMemo(
    () => ({
      labels: data.years,
      datasets: [
        {
          label: symbol,
          data: data.ticker,
          backgroundColor: CHART_CMP_COLOR_TICK,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3
        },
        {
          label: 'SPY',
          data: data.bench,
          backgroundColor: CHART_CMP_COLOR_BENCH,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3
        }
      ]
    }),
    [data, symbol]
  );
  const options = useMemo(() => baseOptions({ legend: true, grouped: true, colors: cmpColors }), [cmpColors]);
  return (
    <figure className="ticker-report__chart">
      <div className="ticker-report__chart-canvas ticker-report__chart-canvas--bar">
        <Bar data={chartData} options={options} />
      </div>
      <figcaption>{symbol} versus S&amp;P 500 (SPY) calendar-year returns.</figcaption>
    </figure>
  );
}
