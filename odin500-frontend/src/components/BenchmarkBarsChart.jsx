'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';
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
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';

/**
 * @typedef {{ tf: string, bench: number | null, tick: number | null }} BenchmarkBarsRow
 */

export function symlogCoord(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.sign(n) * Math.log10(Math.abs(n) + 1);
}

export function symlogToPct(coord) {
  const c = Number(coord);
  if (!Number.isFinite(c) || c === 0) return 0;
  return Math.sign(c) * (10 ** Math.abs(c) - 1);
}

function collectFinitePcts(rows) {
  const out = [];
  for (const r of rows) {
    const b = finiteComparisonPct(r.bench);
    const t = finiteComparisonPct(r.tick);
    if (b != null) out.push(b);
    if (t != null) out.push(t);
  }
  return out;
}

export { fmtPctSignedCompact } from '../utils/chartComparisonTheme.js';

function logDecadeBounds(pcts) {
  const maxV = Math.max(...pcts, 1);
  const minV = Math.min(...pcts, 0);
  const minExp = Math.floor(Math.log10(Math.max(minV, 0.1)));
  const maxExp = Math.ceil(Math.log10(Math.max(maxV, 1)));
  return {
    min: 10 ** minExp,
    max: 10 ** maxExp,
    minExp,
    maxExp
  };
}

function computeYExtent(rows) {
  const pcts = collectFinitePcts(rows);
  if (!pcts.length) {
    return { min: symlogCoord(-10), max: symlogCoord(25), allPositive: false, logBounds: null, minExp: 0, maxExp: 0 };
  }

  const allPositive = pcts.every((v) => v >= 0);
  const allNegative = pcts.every((v) => v <= 0);
  const coords = pcts.map(symlogCoord);

  let minCoord = Math.min(...coords);
  let maxCoord = Math.max(...coords);
  let logBounds = null;
  let minExp = 0;
  let maxExp = 0;

  if (allPositive) {
    logBounds = logDecadeBounds(pcts);
    minExp = logBounds.minExp;
    maxExp = logBounds.maxExp;
    minCoord = Math.min(minCoord, symlogCoord(logBounds.min), symlogCoord(0));
    maxCoord = Math.max(maxCoord, symlogCoord(logBounds.max));
  } else if (allNegative) {
    minCoord = Math.min(minCoord, symlogCoord(Math.min(...pcts)));
    maxCoord = Math.max(maxCoord, symlogCoord(0));
  } else {
    minCoord = Math.min(minCoord, symlogCoord(Math.min(...pcts)), 0);
    maxCoord = Math.max(maxCoord, symlogCoord(Math.max(...pcts)), 0);
  }

  const pad = Math.max((maxCoord - minCoord) * 0.04, 0.06);
  return {
    min: minCoord - pad,
    max: maxCoord + pad,
    allPositive,
    logBounds,
    minExp,
    maxExp
  };
}

/**
 * Grouped benchmark vs ticker returns (symlog Y, Chart.js).
 * @param {{
 *   rows: BenchmarkBarsRow[],
 *   tickerLabel: string,
 *   benchLabel: string,
 *   plotHeight?: number,
 *   chartFullscreen?: boolean,
 *   className?: string,
 * }} props
 */
export function BenchmarkBarsChart({
  rows = [],
  tickerLabel,
  benchLabel,
  plotHeight = 280,
  chartFullscreen = false,
  className = ''
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart<'bar'> | null} */ (null));

  const labels = useMemo(() => rows.map((r) => r.tf), [rows]);

  const benchRaw = useMemo(() => rows.map((r) => finiteComparisonPct(r.bench)), [rows]);
  const tickRaw = useMemo(() => rows.map((r) => finiteComparisonPct(r.tick)), [rows]);

  const benchData = useMemo(() => benchRaw.map((v) => (v == null ? null : symlogCoord(v))), [benchRaw]);
  const tickData = useMemo(() => tickRaw.map((v) => (v == null ? null : symlogCoord(v))), [tickRaw]);

  const yExtent = useMemo(() => computeYExtent(rows), [rows]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: benchLabel,
          data: benchData,
          rawPcts: benchRaw,
          backgroundColor: CHART_CMP_COLOR_BENCH,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3,
          datalabels: { color: CHART_CMP_COLOR_BENCH }
        },
        {
          label: tickerLabel,
          data: tickData,
          rawPcts: tickRaw,
          backgroundColor: CHART_CMP_COLOR_TICK,
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 3,
          datalabels: { color: CHART_CMP_COLOR_TICK }
        }
      ]
    }),
    [labels, benchLabel, tickerLabel, benchData, tickData, benchRaw, tickRaw]
  );

  const options = useMemo(() => {
    const { min, max, allPositive, minExp, maxExp } = yExtent;

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
            if (!chartFullscreen) return false;
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && Number.isFinite(raw);
          },
          formatter: (_value, ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return fmtPctSignedCompact(raw);
          },
          font: { size: 10, weight: '700' },
          anchor: (ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && raw < 0 ? 'start' : 'end';
          },
          align: (ctx) => {
            const raw = ctx.dataset.rawPcts?.[ctx.dataIndex];
            return raw != null && raw < 0 ? 'bottom' : 'top';
          },
          offset: 3
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            color: CHART_CMP_COLOR_AXIS,
            font: { size: 11, weight: '600' }
          }
        },
        y: {
          min,
          max,
          afterBuildTicks: (scale) => {
            if (!allPositive) return;
            const ticks = [];
            for (let e = minExp; e <= maxExp; e += 1) {
              const pct = 10 ** e;
              ticks.push({ value: symlogCoord(pct) });
            }
            if (!ticks.some((t) => t.value === 0)) {
              ticks.unshift({ value: 0 });
            }
            scale.ticks = ticks;
          },
          grid: {
            color: (ctx) => {
              const v = ctx.tick?.value;
              if (v === 0 || Math.abs(v) < 1e-9) return CHART_CMP_COLOR_GRID_ZERO;
              return CHART_CMP_COLOR_GRID;
            }
          },
          ticks: {
            maxTicksLimit: 8,
            color: CHART_CMP_COLOR_AXIS,
            padding: 6,
            font: { size: 10, weight: '600' },
            callback: (value) => fmtPctSignedAxis(symlogToPct(value))
          }
        }
      }
    };
  }, [yExtent, chartFullscreen]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize();
    chart.update('none');
  }, [plotHeight, chartFullscreen, rows]);

  const heightStyle = chartFullscreen ? '100%' : `${plotHeight}px`;

  return (
    <div
      className={'benchmark-bars-chart' + (className ? ` ${className}` : '')}
      style={{ width: '100%', height: heightStyle, display: 'block', minHeight: chartFullscreen ? 180 : undefined }}
    >
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  );
}
