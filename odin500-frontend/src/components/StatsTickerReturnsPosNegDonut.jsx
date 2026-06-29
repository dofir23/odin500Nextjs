'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
import { TICKER_RETURNS_COL_BAR, TICKER_RETURNS_COL_NEG } from './StatsTickerReturnsBarChart.jsx';

/**
 * Positive vs negative period count donut (Chart.js).
 * @param {{ pos: number, neg: number, plotHeight?: number, chartFullscreen?: boolean, className?: string }} props
 */
export function StatsTickerReturnsPosNegDonut({ pos = 0, neg = 0, plotHeight = 220, chartFullscreen = false, className = '' }) {
  const chartRef = useRef(/** @type {import('chart.js').Chart<'doughnut'> | null} */ (null));
  const total = pos + neg;

  const data = useMemo(
    () => ({
      labels: ['Positive', 'Negative'],
      datasets: [
        {
          data: total === 0 ? [1] : [pos, neg],
          backgroundColor: total === 0 ? ['rgba(148,163,184,0.25)'] : [TICKER_RETURNS_COL_BAR, TICKER_RETURNS_COL_NEG],
          borderWidth: 0,
          hoverOffset: 0
        }
      ]
    }),
    [pos, neg, total]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: '63%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: total > 0,
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || '';
              const val = ctx.parsed;
              return `${label}: ${val}`;
            }
          }
        },
        datalabels: {
          display: () => total > 0,
          color: '#fff',
          font: { size: 16, weight: '800' },
          formatter: (_value, ctx) => {
            const val = ctx.dataset.data[ctx.dataIndex];
            return val > 0 ? String(val) : '';
          },
          anchor: 'center',
          align: 'center'
        }
      }
    }),
    [total]
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, pos, neg]);

  const size = chartFullscreen ? '100%' : `${Math.min(260, plotHeight ?? 220)}px`;

  if (total === 0) {
    return (
      <div
        className={'stats-ticker-returns-posneg-donut stats-ticker-returns-posneg-donut--empty' + (className ? ` ${className}` : '')}
        style={{ width: size, height: size, maxWidth: '100%', margin: '8px auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ticker-muted)' }}>No data</span>
      </div>
    );
  }

  return (
    <div
      className={'stats-ticker-returns-posneg-donut' + (className ? ` ${className}` : '')}
      style={{ width: size, height: size, maxWidth: 'min(260px, 100%)', margin: '8px auto 4px', display: 'block' }}
      aria-hidden
    >
      <Doughnut ref={chartRef} data={data} options={options} />
    </div>
  );
}
