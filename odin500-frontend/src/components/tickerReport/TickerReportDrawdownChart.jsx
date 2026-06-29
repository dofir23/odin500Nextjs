'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { createChart } from 'lightweight-charts';
import { fetchJsonCached, canFetchMarketData } from '../../store/apiStore.js';
import {
  drawdownFromOhlcRows,
  drawdownPointsFromSparse,
  findMaxDrawdownPoint,
  formatDrawdownAxis,
  formatDrawdownDateLabel,
  formatDrawdownPct
} from '../../utils/drawdownSeries.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import {
  detachTickerReportChart,
  subscribeTickerReportTimeScale
} from '../../utils/tickerReportChartUtils.js';

const CHART_HEIGHT = 340;

function isoYearsBefore(endIso, years) {
  const d = new Date(`${endIso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function chartOptionsForTheme(theme, width) {
  const light = theme === 'light';
  return {
    width,
    height: CHART_HEIGHT,
    layout: {
      background: { color: light ? '#ffffff' : 'rgba(15, 23, 42, 0.35)' },
      textColor: light ? '#718096' : '#94a3b8',
      attributionLogo: false
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: light ? '#e8ecf2' : 'rgba(148, 163, 184, 0.18)' }
    },
    leftPriceScale: {
      visible: true,
      borderVisible: false,
      scaleMargins: { top: 0.06, bottom: 0.06 }
    },
    rightPriceScale: { visible: false },
    timeScale: {
      borderVisible: true,
      borderColor: light ? '#718096' : 'rgba(148, 163, 184, 0.35)',
      timeVisible: true,
      rightOffset: 8
    },
    crosshair: {
      vertLine: { visible: true, color: light ? 'rgba(28, 57, 100, 0.2)' : 'rgba(148, 163, 184, 0.3)' },
      horzLine: { visible: true, color: light ? 'rgba(28, 57, 100, 0.2)' : 'rgba(148, 163, 184, 0.3)' }
    }
  };
}

function drawdownSeriesOptions(light) {
  const red = light ? '#c62828' : '#f87171';
  const fill = light ? 'rgba(198, 40, 40, 0.25)' : 'rgba(248, 113, 113, 0.22)';
  return {
    baseValue: { type: 'price', price: 0 },
    lineColor: red,
    lineWidth: 1.8,
    topLineColor: 'rgba(198, 40, 40, 0)',
    topFillColor1: 'rgba(198, 40, 40, 0)',
    topFillColor2: 'rgba(198, 40, 40, 0)',
    bottomLineColor: red,
    bottomFillColor1: fill,
    bottomFillColor2: fill,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: true,
    priceScaleId: 'left'
  };
}

/**
 * Underwater drawdown from rolling peak (matches PDF report chart).
 * @param {{ symbol: string, periodEnd?: string, data?: { labels?: string[], values?: number[] } }} props
 */
export function TickerReportDrawdownChart({ symbol, periodEnd, data }) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const light = theme === 'light';
  const lightRef = useRef(light);
  lightRef.current = light;

  const hostRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const pendingRef = useRef(null);
  const maxPointRef = useRef(null);
  const updateMaxOverlayRef = useRef(() => {});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxOverlay, setMaxOverlay] = useState({ visible: false, top: 0, left: 0, dateLabel: '', ddLabel: '' });

  const endDate = useMemo(() => {
    if (periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) return periodEnd;
    return new Date().toISOString().slice(0, 10);
  }, [periodEnd]);

  const startDate = useMemo(() => isoYearsBefore(endDate, 3), [endDate]);

  const updateMaxOverlay = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const host = hostRef.current;
    const maxPt = maxPointRef.current;
    if (!chart || !series || !host || !maxPt) {
      setMaxOverlay((o) => (o.visible ? { ...o, visible: false } : o));
      return;
    }
    const y = series.priceToCoordinate(maxPt.value);
    const x = chart.timeScale().timeToCoordinate(maxPt.time);
    if (y == null || x == null) {
      setMaxOverlay((o) => (o.visible ? { ...o, visible: false } : o));
      return;
    }
    const left = Math.min(Math.max(Number(x), 48), host.clientWidth - 120);
    const top = Math.max(Number(y) - 36, 8);
    setMaxOverlay({
      visible: true,
      left,
      top,
      dateLabel: formatDrawdownDateLabel(maxPt.time),
      ddLabel: `Max DD ${formatDrawdownPct(maxPt.value)}`
    });
  }, []);

  updateMaxOverlayRef.current = updateMaxOverlay;

  const applySeriesData = useCallback(() => {
    const pending = pendingRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!pending?.length || !series || !chart) return false;
    series.setData(pending);
    const maxPt = findMaxDrawdownPoint(pending);
    maxPointRef.current = maxPt;
    const isLight = lightRef.current;
    if (maxPt) {
      series.setMarkers([
        {
          time: maxPt.time,
          position: 'inBar',
          color: isLight ? '#c62828' : '#f87171',
          shape: 'circle',
          size: 1.2
        }
      ]);
    } else {
      series.setMarkers([]);
    }
    chart.timeScale().fitContent();
    requestAnimationFrame(() => updateMaxOverlayRef.current());
    return true;
  }, []);

  const applySeriesDataRef = useRef(applySeriesData);
  applySeriesDataRef.current = applySeriesData;

  useEffect(() => {
    let cancelled = false;
    const fallback = drawdownPointsFromSparse(data || {});

    if (!canFetchMarketData()) {
      pendingRef.current = fallback;
      applySeriesDataRef.current();
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: sym, start_date: startDate, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        if (cancelled) return;
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        let points = drawdownFromOhlcRows(rows);
        if (points.length < 2 && fallback.length) points = fallback;
        pendingRef.current = points;
        applySeriesDataRef.current();
      } catch (e) {
        if (!cancelled) {
          pendingRef.current = fallback;
          applySeriesDataRef.current();
          if (!fallback.length) setError(e?.message || 'Failed to load drawdown chart');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, startDate, endDate, data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 640));
    const series = chart.addBaselineSeries(drawdownSeriesOptions(theme === 'light'));
    series.applyOptions({
      priceFormat: {
        type: 'custom',
        formatter: formatDrawdownAxis
      }
    });

    chartRef.current = chart;
    seriesRef.current = series;
    applySeriesDataRef.current();

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      updateMaxOverlayRef.current();
    };

    const ts = chart.timeScale();
    const onRange = () => updateMaxOverlayRef.current();
    subscribeTickerReportTimeScale(ts, onRange);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      detachTickerReportChart(chart, ts, onRange);
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    applySeriesDataRef.current();
  }, [sym, startDate, endDate, data]);

  useLayoutEffect(() => {
    updateMaxOverlay();
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => updateMaxOverlayRef.current());
    ro.observe(host);
    return () => ro.disconnect();
  }, [updateMaxOverlay, loading]);

  return (
    <figure className="ticker-report__chart ticker-report-drawdown-chart">
      <div className="ticker-report-drawdown-chart__plot" ref={hostRef} style={{ height: CHART_HEIGHT }}>
        <div ref={containerRef} className="ticker-report-drawdown-chart__canvas" />
        {maxOverlay.visible ? (
          <div
            className="ticker-report-drawdown-chart__max-label"
            style={{ left: maxOverlay.left, top: maxOverlay.top }}
          >
            <span className="ticker-report-drawdown-chart__max-date">{maxOverlay.dateLabel}</span>
            <strong>{maxOverlay.ddLabel}</strong>
          </div>
        ) : null}
        {loading ? <div className="ticker-report-price-chart__status">Loading chart…</div> : null}
        {!loading && error ? (
          <div className="ticker-report-price-chart__status ticker-report-price-chart__status--err">{error}</div>
        ) : null}
      </div>
      <figcaption>
        Drawdown from rolling peak over the 3-year window. The red shaded area shows the depth and duration of each
        drawdown period.
      </figcaption>
    </figure>
  );
}
