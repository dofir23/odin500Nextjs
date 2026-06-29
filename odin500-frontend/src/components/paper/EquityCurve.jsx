'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';

const CHART_HEIGHT = 260;

function chartOptionsForTheme(theme, width) {
  const light = theme === 'light';
  return {
    width,
    height: CHART_HEIGHT,
    layout: {
      background: { color: 'transparent' },
      textColor: light ? '#64748b' : '#94a3b8',
      attributionLogo: false
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: light ? '#e2e8f0' : 'rgba(148, 163, 184, 0.12)' }
    },
    rightPriceScale: { borderVisible: false },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false
    }
  };
}

/** @param {string} iso */
function snapshotToUnixSec(iso) {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function toChartPoints(history) {
  const raw = (history || [])
    .map((row) => {
      const time = snapshotToUnixSec(row.snapshot_at);
      const equity = Number(row.equity);
      if (time == null || !Number.isFinite(equity)) return null;
      return { time, value: equity };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  // lightweight-charts requires strictly ascending time
  const points = [];
  for (const pt of raw) {
    const last = points[points.length - 1];
    if (last && last.time === pt.time) {
      last.value = pt.value;
    } else if (!last || pt.time > last.time) {
      points.push(pt);
    }
  }
  return points;
}

/**
 * @param {{ history: Array<{ snapshot_at: string, equity: number }> }} props
 */
export function EquityCurve({ history }) {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const points = toChartPoints(history);

  useEffect(() => {
    const el = hostRef.current;
    const pts = toChartPoints(history);
    if (!el || pts.length < 2) return undefined;

    const light = theme === 'light';
    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 600));
    const series = chart.addAreaSeries({
      lineColor: light ? '#2563eb' : '#60a5fa',
      topColor: light ? 'rgba(37, 99, 235, 0.28)' : 'rgba(96, 165, 250, 0.32)',
      bottomColor: 'rgba(37, 99, 235, 0)',
      lineWidth: 2,
      priceLineVisible: false
    });
    series.setData(pts);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: hostRef.current.clientWidth });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [theme, history]);

  return (
    <div className="paper-card paper-chart-card">
      <div className="paper-card__head">
        <h2 className="paper-card__title">Portfolio performance</h2>
      </div>
      <div className="paper-card__body">
        {points.length < 2 ? (
          <p className="paper-chart-empty">
            Performance chart appears after two portfolio snapshots are recorded.
          </p>
        ) : (
          <div ref={hostRef} className="paper-chart-host" />
        )}
      </div>
    </div>
  );
}
