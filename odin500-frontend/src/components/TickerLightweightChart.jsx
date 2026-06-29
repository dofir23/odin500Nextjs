'use client';
import { useEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { mapRowsToCandles, rowDateToTimeKey } from '../utils/chartData.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { fmtChartPrice, fmtPctSigned } from '../utils/formatDisplayNumber.js';

function chartOptionsForTheme(theme, height) {
  if (theme === 'light') {
    return {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#475569',
        attributionLogo: false
      },
      grid: {
        vertLines: { color: 'rgba(15, 23, 42, 0.08)' },
        horzLines: { color: 'rgba(15, 23, 42, 0.08)' }
      },
      rightPriceScale: { borderColor: 'rgba(15, 23, 42, 0.12)' },
      timeScale: {
        borderColor: 'rgba(15, 23, 42, 0.12)',
        rightOffset: 4,
        barSpacing: 8,
        fixLeftEdge: false,
        fixRightEdge: false
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(37, 99, 235, 0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(37, 99, 235, 0.35)', width: 1, style: 2 }
      },
      height
    };
  }
  return {
    layout: {
      background: { color: 'rgba(255, 255, 255, 0.03)' },
      textColor: '#94a3b8',
      attributionLogo: false
    },
    grid: {
      vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
      horzLines: { color: 'rgba(148, 163, 184, 0.12)' }
    },
    rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.25)' },
    timeScale: {
      borderColor: 'rgba(148, 163, 184, 0.25)',
      rightOffset: 4,
      barSpacing: 8,
      fixLeftEdge: false,
      fixRightEdge: false
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(148, 163, 184, 0.45)', width: 1, style: 2 },
      horzLine: { color: 'rgba(148, 163, 184, 0.45)', width: 1, style: 2 }
    },
    height
  };
}

/** @typedef {'line' | 'area' | 'candles' | 'bars'} TickerChartType */

export const TICKER_CHART_TYPE_OPTIONS = [
  { id: 'area', label: 'Area' },
  { id: 'line', label: 'Line' },
  { id: 'candles', label: 'Candles' },
  { id: 'bars', label: 'Bars' }
];

function timeKeyFromCrosshair(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t.slice(0, 10);
  if (typeof t === 'number') return new Date(t * 1000).toISOString().slice(0, 10);
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const m = String(t.month).padStart(2, '0');
    const d = String(t.day).padStart(2, '0');
    return t.year + '-' + m + '-' + d;
  }
  return String(t);
}

function pickNum(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function formatChartTime(t) {
  if (t == null) return '—';
  if (typeof t === 'string') return t;
  if (typeof t === 'number') return new Date(t * 1000).toISOString().slice(0, 10);
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const m = String(t.month).padStart(2, '0');
    const d = String(t.day).padStart(2, '0');
    return t.year + '-' + m + '-' + d;
  }
  return String(t);
}

/** Clamp chart canvas to plot host so mobile padding/inset does not overflow the viewport. */
function measureChartWidth(el) {
  if (!el) return 0;
  const plotHost = el.closest('.ticker-chart-plot-host');
  const cap = plotHost?.clientWidth ?? el.clientWidth;
  return Math.max(0, Math.floor(Math.min(el.clientWidth, cap)));
}

/** Rising trend icon (dropdown trigger), stroke uses `currentColor`. */
export function IconChartTypeDropdown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M4 17 L8 13 L11 15 L15 9 L17 11 L19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 7h4v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ohlcFromMainPoint(chartType, md) {
  if (chartType === 'line' || chartType === 'area') {
    if (!md || md.value === undefined) return null;
    return { close: md.value };
  }
  if (!md || md.close === undefined) return null;
  return {
    open: md.open,
    high: md.high,
    low: md.low,
    close: md.close
  };
}

/**
 * @typedef {object} PaperChartPosition
 * @property {number} qty
 * @property {number} avgCost
 * @property {number|null} [currentPrice]
 * @property {number|null} [unrealizedPnl]
 * @property {number|null} [unrealizedPnlPct]
 */

/**
 * TradingView **Lightweight Charts™** — main series type controlled by parent (line, area, candles, bars) + volume.
 * @param {{ rows: unknown[], height?: number, chartType?: TickerChartType, paperPosition?: PaperChartPosition|null, markers?: Array<{ time: string, position?: string, shape?: string, color?: string, text?: string }> }} props
 */
export function TickerLightweightChart({
  rows,
  height = 320,
  chartType = 'line',
  onHoverOhlcChange = null,
  paperPosition = null,
  markers = null
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volRef = useRef(null);
  const paperPriceLineRef = useRef(null);
  const rowByTimeRef = useRef(new Map());
  const chartTypeRef = useRef(chartType);
  const onHoverOhlcChangeRef = useRef(onHoverOhlcChange);

  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  const { linePoints, candles, volumes, rowByTime } = useMemo(() => {
    const sorted = [...(rows || [])].sort((a, b) => {
      const ta = rowDateToTimeKey(a);
      const tb = rowDateToTimeKey(b);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    const candles0 = mapRowsToCandles(sorted);
    const byTime = new Map();
    for (const row of sorted) {
      const t = rowDateToTimeKey(row);
      if (t) byTime.set(t, row);
    }
    const linePts = candles0.map((c) => ({ time: c.time, value: c.close }));
    const upCol = chartTheme === 'light' ? 'rgba(100, 116, 139, 0.28)' : 'rgba(148, 163, 184, 0.2)';
    const downCol = chartTheme === 'light' ? 'rgba(100, 116, 139, 0.28)' : 'rgba(148, 163, 184, 0.2)';
    const volumes0 = candles0
      .map((c) => {
        const row = byTime.get(c.time);
        const v = row ? pickNum(row, ['Volume', 'volume', 'VOLUME']) : null;
        const val = v != null && Number.isFinite(v) && v > 0 ? v : null;
        if (val == null) return null;
        const up = c.close >= c.open;
        return {
          time: c.time,
          value: val,
          color: up ? upCol : downCol
        };
      })
      .filter(Boolean);
    return { linePoints: linePts, candles: candles0, volumes: volumes0, rowByTime: byTime };
  }, [rows, chartTheme]);

  useEffect(() => {
    rowByTimeRef.current = rowByTime;
  }, [rowByTime]);

  useEffect(() => {
    chartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    onHoverOhlcChangeRef.current = onHoverOhlcChange;
  }, [onHoverOhlcChange]);

  const addMainSeries = useCallback((chart, type, theme) => {
    const ohlcStyle =
      theme === 'light'
        ? {
            upColor: '#16a34a',
            downColor: '#dc2626',
            borderVisible: false,
            wickUpColor: '#16a34a',
            wickDownColor: '#dc2626',
            priceScaleId: 'right'
          }
        : {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceScaleId: 'right'
          };
    const lineColor = theme === 'light' ? '#0284c7' : '#38bdf8';
    switch (type) {
      case 'line':
        return chart.addLineSeries({
          color: lineColor,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
      case 'area':
        return chart.addAreaSeries({
          lineColor,
          topColor: theme === 'light' ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.45)',
          bottomColor: theme === 'light' ? 'rgba(2, 132, 199, 0.04)' : 'rgba(56, 189, 248, 0.02)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
      case 'candles':
        return chart.addCandlestickSeries(ohlcStyle);
      case 'bars':
        return chart.addBarSeries(ohlcStyle);
      default:
        return chart.addLineSeries({
          color: lineColor,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const appearance = chartOptionsForTheme(chartTheme, height);
    const chart = createChart(el, {
      ...appearance,
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      },
      width: measureChartWidth(el)
    });

    const mainSeries = addMainSeries(chart, chartType, chartTheme);
    mainSeries.applyOptions({
      priceFormat: {
        type: 'custom',
        formatter: (p) => fmtChartPrice(p)
      }
    });
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
      baseLineVisible: false
    });

    mainSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.24 }
    });
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 }
    });

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    volRef.current = volSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!param || param.time === undefined || param.point === undefined) {
        if (typeof onHoverOhlcChangeRef.current === 'function') onHoverOhlcChangeRef.current(null);
        return;
      }
      const ct = chartTypeRef.current;
      const md = param.seriesData.get(mainSeries);
      const ohlc = ohlcFromMainPoint(ct, md);
      if (!ohlc) {
        if (typeof onHoverOhlcChangeRef.current === 'function') onHoverOhlcChangeRef.current(null);
        return;
      }
      const tKey = timeKeyFromCrosshair(param.time);
      const dateStr = formatChartTime(param.time);
      const row = rowByTimeRef.current.get(tKey);
      const v = param.seriesData.get(volSeries);
      const vol = v && typeof v.value === 'number' && v.value > 0 ? Number(v.value) : null;
      let open = null;
      let high = null;
      let low = null;
      let close = null;
      if (ct === 'line' || ct === 'area') {
        open = row ? pickNum(row, ['Open', 'open']) : null;
        high = row ? pickNum(row, ['High', 'high']) : null;
        low = row ? pickNum(row, ['Low', 'low']) : null;
        close = ohlc.close;
      } else {
        open = ohlc.open ?? null;
        high = ohlc.high ?? null;
        low = ohlc.low ?? null;
        close = ohlc.close ?? null;
      }
      if (typeof onHoverOhlcChangeRef.current === 'function') {
        onHoverOhlcChangeRef.current({ date: dateStr, open, high, low, close, volume: vol });
      }
    });

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: measureChartWidth(containerRef.current) });
    });
    ro.observe(el);
    const plotHost = el.closest('.ticker-chart-plot-host');
    if (plotHost) ro.observe(plotHost);

    const onWinResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: measureChartWidth(containerRef.current) });
    };
    window.addEventListener('resize', onWinResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volRef.current = null;
    };
  }, [chartType, addMainSeries, chartTheme]);

  /** Height alone must not recreate the chart — otherwise the data effect can miss a run and the series stay empty. */
  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el) return;
    chart.applyOptions({ height, width: measureChartWidth(el) });
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = mainSeriesRef.current;
    const volSeries = volRef.current;
    if (!chart || !main || !volSeries) return;

    if (chartType === 'line' || chartType === 'area') {
      main.setData(linePoints);
    } else {
      main.setData(candles);
    }
    volSeries.setData(volumes);
    if (typeof main.setMarkers === 'function') {
      main.setMarkers(Array.isArray(markers) && markers.length ? markers : []);
    }
    chart.timeScale().fitContent();
  }, [linePoints, candles, volumes, chartType, chartTheme, markers]);

  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main) return undefined;

    if (paperPriceLineRef.current) {
      try {
        main.removePriceLine(paperPriceLineRef.current);
      } catch {
        /* series may have been removed */
      }
      paperPriceLineRef.current = null;
    }

    if (!paperPosition) return undefined;

    const qty = Number(paperPosition.qty);
    const avg = Number(paperPosition.avgCost);
    if (!Number.isFinite(qty) || qty === 0 || !Number.isFinite(avg) || avg <= 0) {
      return undefined;
    }

    const isLong = qty > 0;
    const lineColor = isLong
      ? chartTheme === 'light'
        ? '#16a34a'
        : '#22c55e'
      : chartTheme === 'light'
        ? '#dc2626'
        : '#ef4444';

    paperPriceLineRef.current = main.createPriceLine({
      price: avg,
      color: lineColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `Paper ${Math.abs(qty)} @ ${fmtChartPrice(avg)}`
    });

    return () => {
      if (paperPriceLineRef.current && mainSeriesRef.current) {
        try {
          mainSeriesRef.current.removePriceLine(paperPriceLineRef.current);
        } catch {
          /* ignore */
        }
        paperPriceLineRef.current = null;
      }
    };
  }, [paperPosition, chartType, chartTheme, linePoints.length, candles.length]);

  const paperBadge = useMemo(() => {
    if (!paperPosition) return null;
    const qty = Number(paperPosition.qty);
    const avg = Number(paperPosition.avgCost);
    if (!Number.isFinite(qty) || qty === 0 || !Number.isFinite(avg)) return null;
    const pnl = paperPosition.unrealizedPnl;
    const pnlPct = paperPosition.unrealizedPnlPct;
    const pnlUp = pnl != null && Number(pnl) > 0;
    const pnlDown = pnl != null && Number(pnl) < 0;
    return {
      qty: Math.abs(qty),
      avg,
      pnl,
      pnlPct,
      pnlClass: pnlUp ? 'ticker-lw-chart__paper-badge--up' : pnlDown ? 'ticker-lw-chart__paper-badge--down' : ''
    };
  }, [paperPosition]);

  return (
    <div className="ticker-lw-chart">
      {paperBadge ? (
        <div
          className={'ticker-lw-chart__paper-badge' + (paperBadge.pnlClass ? ` ${paperBadge.pnlClass}` : '')}
          aria-label="Paper trading position on this symbol"
        >
          <span className="ticker-lw-chart__paper-badge-tag">Paper</span>
          <span className="ticker-lw-chart__paper-badge-main">
            {paperBadge.qty} @ {fmtChartPrice(paperBadge.avg)}
          </span>
          {paperBadge.pnl != null && Number.isFinite(Number(paperBadge.pnl)) ? (
            <span className="ticker-lw-chart__paper-badge-pnl">
              {Number(paperBadge.pnl) >= 0 ? '+' : ''}
              {fmtChartPrice(paperBadge.pnl)}
              {paperBadge.pnlPct != null ? ` (${fmtPctSigned(paperBadge.pnlPct)})` : ''}
            </span>
          ) : null}
        </div>
      ) : null}
      <div ref={containerRef} className="ticker-lw-chart__root" />
    </div>
  );
}
