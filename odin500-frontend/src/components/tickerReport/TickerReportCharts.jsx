'use client';
import { useMemo, useSyncExternalStore } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

function useChartColors() {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const light = theme === 'light';
  return useMemo(
    () => ({
      navy: light ? '#1C3964' : '#93c5fd',
      blue: light ? '#30679C' : '#60a5fa',
      grid: light ? '#e8ecf2' : 'rgba(148, 163, 184, 0.2)',
      text: light ? '#718096' : '#94a3b8',
      pos: '#2E7D32',
      neg: '#C62828',
      bg: light ? '#ffffff' : 'rgba(15, 23, 42, 0.4)',
      band: light ? 'rgba(230, 235, 243, 0.45)' : 'rgba(148, 163, 184, 0.12)'
    }),
    [light]
  );
}

function baseOptions(c, { yPct = true } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: c.text, boxWidth: 12, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: c.bg,
        titleColor: c.navy,
        bodyColor: c.text,
        borderColor: c.grid,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: c.text, maxRotation: 0, font: { size: 10 } },
        grid: { color: c.grid }
      },
      y: {
        ticks: {
          color: c.text,
          font: { size: 10 },
          callback: yPct ? (v) => `${v}%` : undefined
        },
        grid: { color: c.grid }
      }
    }
  };
}

export function TickerReportMonthlyReturnsChart({ data }) {
  const c = useChartColors();
  const values = data.values || [];
  const labels = values.map((_, i) => `M${i + 1}`);
  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Monthly return',
          data: values,
          backgroundColor: values.map((v) => (v >= 0 ? c.pos : c.neg)),
          borderRadius: 2
        }
      ]
    }),
    [values, c]
  );
  return (
    <figure className="ticker-report__chart">
      <div className="ticker-report__chart-canvas ticker-report__chart-canvas--bar">
        <Bar data={chartData} options={baseOptions(c)} />
      </div>
      <figcaption>Monthly returns over the trailing 3-year window (green positive, red negative).</figcaption>
    </figure>
  );
}

export function TickerReportAnnualCompareChart({ data, symbol }) {
  const c = useChartColors();
  const chartData = useMemo(
    () => ({
      labels: data.years,
      datasets: [
        {
          label: symbol,
          data: data.ticker,
          backgroundColor: c.navy,
          borderRadius: 2
        },
        {
          label: 'SPY',
          data: data.bench,
          backgroundColor: c.blue,
          borderRadius: 2
        }
      ]
    }),
    [data, symbol, c]
  );
  return (
    <figure className="ticker-report__chart">
      <div className="ticker-report__chart-canvas ticker-report__chart-canvas--bar">
        <Bar data={chartData} options={baseOptions(c)} />
      </div>
      <figcaption>{symbol} versus S&amp;P 500 (SPY) calendar-year returns.</figcaption>
    </figure>
  );
}

