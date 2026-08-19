'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { historyToChartPoints } from '../../utils/paperPerformanceUtils.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';

const CHART_SHELL =
  'overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40';

/**
 * Up / down palette. The line is coloured by whether the book is above or below where it
 * started, not by a house colour — on a summary card the first question is "did this make
 * money", and a permanently blue line answers it only after you read the axis that isn't there.
 */
const TONE = {
  up: { light: '#059669', dark: '#34d399', fill: '16, 185, 129' },
  down: { light: '#dc2626', dark: '#f87171', fill: '244, 63, 94' }
};

function money(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n >= 1000 ? 0 : 2
  }).format(n);
}

function dayLabel(unixSec) {
  if (!Number.isFinite(unixSec)) return '';
  return new Date(unixSec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Compact equity curve for public portfolio summary cards.
 *
 * Reads as a sparkline but carries three things a bare line doesn't: it is coloured against its
 * own starting value, that start is drawn as a dashed reference, and hovering (or touching) any
 * point puts that day's date, equity and return-since-start in the readout above the chart.
 * With no pointer on it the readout shows the latest point, so the numbers are never hidden
 * behind an interaction.
 *
 * @param {{ history: Array<{ snapshot_at: string, equity: number }>, loading?: boolean, height?: number }} props
 */
export function PublicPortfolioMiniChart({ history = [], loading = false, height = 96 }) {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const hostRef = useRef(null);
  const points = useMemo(() => historyToChartPoints(history), [history]);

  /** null = not hovering, so the readout falls back to the last point. */
  const [hovered, setHovered] = useState(null);

  const first = points[0];
  const last = points[points.length - 1];
  const startValue = first?.value;

  const pctFrom = useCallback(
    (value) => {
      if (!Number.isFinite(startValue) || startValue === 0 || !Number.isFinite(value)) return null;
      return ((value - startValue) / startValue) * 100;
    },
    [startValue]
  );

  const shown = hovered || (last ? { time: last.time, value: last.value } : null);
  const shownPct = shown ? pctFrom(shown.value) : null;
  const totalPct = last ? pctFrom(last.value) : null;
  const up = (totalPct ?? 0) >= 0;

  useEffect(() => {
    const el = hostRef.current;
    const pts = historyToChartPoints(history);
    if (!el || pts.length < 2) return undefined;

    const light = theme === 'light';
    const base = pts[0].value;
    const chart = createChart(el, {
      width: el.clientWidth || 240,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: light ? '#64748b' : '#94a3b8',
        attributionLogo: false
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false, borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false },
      handleScroll: false,
      handleScale: false,
      // Magnet snaps the crosshair to a real snapshot, so the readout can never show a value
      // interpolated between two days that the portfolio never actually held.
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          style: 0,
          color: light ? 'rgba(100, 116, 139, 0.45)' : 'rgba(148, 163, 184, 0.45)',
          labelVisible: false
        },
        horzLine: { visible: false, labelVisible: false }
      }
    });

    /**
     * Baseline rather than area: it splits the fill at the starting equity, so the stretch where
     * the book was underwater is red and the stretch above it green — in one glance, not just at
     * the final value.
     */
    const series = chart.addBaselineSeries({
      baseValue: { type: 'price', price: base },
      topLineColor: light ? TONE.up.light : TONE.up.dark,
      topFillColor1: `rgba(${TONE.up.fill}, 0.28)`,
      topFillColor2: `rgba(${TONE.up.fill}, 0.02)`,
      bottomLineColor: light ? TONE.down.light : TONE.down.dark,
      bottomFillColor1: `rgba(${TONE.down.fill}, 0.02)`,
      bottomFillColor2: `rgba(${TONE.down.fill}, 0.28)`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerBorderColor: light ? '#ffffff' : '#0f172a'
    });
    series.setData(pts);

    // The starting equity, so "flat" has a visible position instead of being implied.
    series.createPriceLine({
      price: base,
      color: light ? 'rgba(100, 116, 139, 0.35)' : 'rgba(148, 163, 184, 0.3)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false
    });

    chart.timeScale().fitContent();

    const onMove = (param) => {
      const value = param?.seriesData?.get(series)?.value;
      if (!param?.time || !Number.isFinite(value)) {
        setHovered(null);
        return;
      }
      setHovered({ time: param.time, value });
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => {
      if (hostRef.current) chart.applyOptions({ width: hostRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      ro.disconnect();
      chart.remove();
      setHovered(null);
    };
  }, [theme, history, height]);

  if (loading) {
    return (
      <div
        className={`${CHART_SHELL} animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100 dark:from-white/[0.06] dark:via-white/10 dark:to-white/[0.06]`}
        style={{ minHeight: height }}
        aria-hidden
      />
    );
  }

  if (points.length < 2) {
    return (
      <div
        className={`${CHART_SHELL} flex items-center justify-center p-3 text-center text-[0.72rem] text-slate-500 dark:text-slate-400`}
        style={{ minHeight: height }}
      >
        <span>Equity curve builds after more snapshots.</span>
      </div>
    );
  }

  const toneText = up
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={CHART_SHELL}>
      {/* Values live here rather than on the chart: at 64px tall an in-chart label would sit on
          the line it is describing. */}
      <div className="flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-1 text-[0.68rem] tabular-nums">
        <span className="text-slate-500 dark:text-slate-400">
          {hovered ? dayLabel(shown.time) : 'Latest'}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{money(shown?.value)}</span>
          <span className={`font-bold ${toneText}`}>
            {shownPct == null ? '—' : fmtPctSigned(shownPct, { decimals: 2 })}
          </span>
        </span>
      </div>
      <div
        ref={hostRef}
        className="w-full cursor-crosshair"
        style={{ height }}
        role="img"
        aria-label={`Equity curve, ${money(startValue)} to ${money(last?.value)}, ${
          totalPct == null ? 'change unavailable' : `${fmtPctSigned(totalPct, { decimals: 2 })} since inception`
        }`}
      />
    </div>
  );
}
