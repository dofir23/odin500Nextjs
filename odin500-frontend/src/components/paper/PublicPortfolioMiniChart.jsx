'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { historyToChartPoints } from '../../utils/paperPerformanceUtils.js';

const CHART_HEIGHT = 96;

const CHART_SHELL =
  'min-h-24 overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40';

/**
 * Compact equity sparkline for public portfolio summary cards.
 * @param {{ history: Array<{ snapshot_at: string, equity: number }>, loading?: boolean }} props
 */
export function PublicPortfolioMiniChart({ history = [], loading = false }) {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const hostRef = useRef(null);
  const points = useMemo(() => historyToChartPoints(history), [history]);

  useEffect(() => {
    const el = hostRef.current;
    const pts = historyToChartPoints(history);
    if (!el || pts.length < 2) return undefined;

    const light = theme === 'light';
    const chart = createChart(el, {
      width: el.clientWidth || 240,
      height: CHART_HEIGHT,
      layout: {
        background: { color: 'transparent' },
        textColor: light ? '#64748b' : '#94a3b8',
        attributionLogo: false
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false }
      },
      rightPriceScale: { visible: false, borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 0 }
    });

    const series = chart.addAreaSeries({
      lineColor: light ? '#2563eb' : '#60a5fa',
      topColor: light ? 'rgba(37, 99, 235, 0.28)' : 'rgba(96, 165, 250, 0.28)',
      bottomColor: 'rgba(37, 99, 235, 0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    });
    series.setData(pts);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (hostRef.current) {
        chart.applyOptions({ width: hostRef.current.clientWidth });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [theme, history]);

  if (loading) {
    return (
      <div
        className={`${CHART_SHELL} animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100 dark:from-white/[0.06] dark:via-white/10 dark:to-white/[0.06]`}
        aria-hidden
      />
    );
  }

  if (points.length < 2) {
    return (
      <div className={`${CHART_SHELL} flex items-center justify-center p-3 text-center text-[0.72rem] text-slate-500 dark:text-slate-400`}>
        <span>Equity curve builds after more snapshots.</span>
      </div>
    );
  }

  return (
    <div className={CHART_SHELL} aria-hidden>
      <div ref={hostRef} className="h-24 w-full" />
    </div>
  );
}
