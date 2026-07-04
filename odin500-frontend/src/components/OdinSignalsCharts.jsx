'use client';
import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import '../utils/chartJsSetup.js';

/** Shared app font stack so these charts render in the same face as the rest of the site. */
const APP_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Single source of truth for signal colors, reused by both the charts and the HTML legends.
 * Longs are a green ramp (L1 strongest → L3 mildest), shorts a red ramp (S1 strongest → S3 mildest).
 */
export const ODIN_SIGNAL_COLORS = {
  L1: '#15803d',
  L2: '#22c55e',
  L3: '#86efac',
  S1: '#dc2626',
  S2: '#ef4444',
  S3: '#fb923c',
  N: '#94a3b8'
};

export const ODIN_DIRECTION_COLORS = {
  long: '#22c55e',
  short: '#ef4444',
  neutral: '#94a3b8'
};

/** Slice order for the signals breakdown doughnut (longs first, then shorts, then neutral). */
const SIGNAL_DONUT_ORDER = ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N'];

/** Gauge zone ramp: strong bearish → strong bullish (widths sum to 100). */
const GAUGE_ZONES = [30, 15, 10, 15, 30];
const GAUGE_ZONE_COLORS = ['#ef4444', '#f59e0b', '#94a3b8', '#4ade80', '#22c55e'];
const GAUGE_ZONE_LABELS = ['Strong Bearish', 'Bearish', 'Neutral', 'Bullish', 'Strong Bullish'];

/**
 * Draws the gauge needle + hub. White fill with a dark outline so it stays legible on both the
 * light and dark themes and over any zone color underneath.
 */
const odinGaugeNeedlePlugin = {
  id: 'odinGaugeNeedle',
  afterDatasetsDraw(chart, _args, opts) {
    const score = opts?.score;
    if (score == null || !Number.isFinite(score)) return;
    const arc = chart.getDatasetMeta(0)?.data?.[0];
    if (!arc) return;
    const { ctx } = chart;
    const cx = arc.x;
    const cy = arc.y;
    const outer = arc.outerRadius;
    const t = Math.max(0, Math.min(100, score)) / 100;
    const angle = Math.PI * (1 + t); // π (left / 0) → 2π (right / 100)
    const perp = angle + Math.PI / 2;
    const len = outer * 0.9;
    const baseW = Math.max(4, outer * 0.045);
    const tipX = cx + Math.cos(angle) * len;
    const tipY = cy + Math.sin(angle) * len;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(perp) * baseW, cy + Math.sin(perp) * baseW);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(cx - Math.cos(perp) * baseW, cy - Math.sin(perp) * baseW);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, baseW + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, baseW - 0.5), 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.restore();
  }
};

/**
 * Half-doughnut OMX gauge with a value needle.
 * @param {{ score: number | null, height?: number }} props
 */
export function OdinOmxGauge({ score, height = 168 }) {
  const hasData = score != null && Number.isFinite(score);

  const data = useMemo(
    () => ({
      labels: GAUGE_ZONE_LABELS,
      datasets: [
        {
          data: GAUGE_ZONES,
          backgroundColor: GAUGE_ZONE_COLORS,
          borderWidth: 0,
          hoverOffset: 0
        }
      ]
    }),
    []
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      font: { family: APP_FONT },
      rotation: -90,
      circumference: 180,
      cutout: '62%',
      layout: { padding: { top: 4, bottom: 2 } },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          enabled: hasData,
          titleFont: { family: APP_FONT, size: 11, weight: '600' },
          bodyFont: { family: APP_FONT, size: 11 },
          displayColors: false,
          callbacks: { label: (ctx) => ctx.label }
        },
        odinGaugeNeedle: { score: hasData ? score : null }
      }
    }),
    [hasData, score]
  );

  return (
    <div className="odin-omx-chart" style={{ height }}>
      <Doughnut data={data} options={options} plugins={[odinGaugeNeedlePlugin]} />
    </div>
  );
}

/** Shared doughnut options (legend rendered in HTML, % datalabels drawn on the slices). */
function useDoughnutOptions(total) {
  return useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      font: { family: APP_FONT },
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: total > 0,
          titleFont: { family: APP_FONT, size: 11, weight: '600' },
          bodyFont: { family: APP_FONT, size: 11 },
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed || 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return `${ctx.label}: ${v} (${pct}%)`;
            }
          }
        },
        datalabels: {
          display: (ctx) => {
            if (total <= 0) return false;
            const v = ctx.dataset.data[ctx.dataIndex] || 0;
            return v / total >= 0.08;
          },
          color: '#ffffff',
          font: { family: APP_FONT, size: 12, weight: '700' },
          formatter: (v) => {
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return `${pct}%`;
          },
          anchor: 'center',
          align: 'center'
        }
      }
    }),
    [total]
  );
}

/**
 * Long / Short / Neutral direction doughnut.
 * @param {{ long: number, short: number, neutral: number, height?: number }} props
 */
export function OdinDirectionDonut({ long = 0, short = 0, neutral = 0, height = 200 }) {
  const total = long + short + neutral;
  const data = useMemo(
    () => ({
      labels: ['Long', 'Short', 'Neutral'],
      datasets: [
        {
          data: total === 0 ? [1] : [long, short, neutral],
          backgroundColor:
            total === 0
              ? ['rgba(148,163,184,0.25)']
              : [ODIN_DIRECTION_COLORS.long, ODIN_DIRECTION_COLORS.short, ODIN_DIRECTION_COLORS.neutral],
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    }),
    [long, short, neutral, total]
  );
  const options = useDoughnutOptions(total);
  return (
    <div className="odin-omx-chart" style={{ height }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}

/**
 * L1–L3 / S1–S3 / N signals doughnut.
 * @param {{ stats: Record<string, number>, height?: number }} props
 */
export function OdinSignalsBreakdownDonut({ stats, height = 200 }) {
  const total = SIGNAL_DONUT_ORDER.reduce((sum, k) => sum + (Number(stats?.[k]) || 0), 0);
  const data = useMemo(
    () => ({
      labels: SIGNAL_DONUT_ORDER,
      datasets: [
        {
          data: total === 0 ? [1] : SIGNAL_DONUT_ORDER.map((k) => Number(stats?.[k]) || 0),
          backgroundColor:
            total === 0
              ? ['rgba(148,163,184,0.25)']
              : SIGNAL_DONUT_ORDER.map((k) => ODIN_SIGNAL_COLORS[k]),
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    }),
    [stats, total]
  );
  const options = useDoughnutOptions(total);
  return (
    <div className="odin-omx-chart" style={{ height }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}
