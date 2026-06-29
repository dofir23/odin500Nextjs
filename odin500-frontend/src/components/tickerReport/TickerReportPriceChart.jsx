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
import { createChart, LineStyle } from 'lightweight-charts';
import { fetchJsonCached, canFetchMarketData } from '../../store/apiStore.js';
import { mapRowsToCandles } from '../../utils/chartData.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { fmtChartPrice } from '../../utils/formatDisplayNumber.js';
import {
  detachTickerReportChart,
  subscribeTickerReportTimeScale
} from '../../utils/tickerReportChartUtils.js';

const CHART_HEIGHT = 360;

function isoYearsBefore(endIso, years) {
  const d = new Date(`${endIso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function compute52WeekRange(candles) {
  const window = candles.slice(-252);
  if (!window.length) return { high: null, low: null };
  let high = -Infinity;
  let low = Infinity;
  for (const c of window) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  return { high: Number.isFinite(high) ? high : null, low: Number.isFinite(low) ? low : null };
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
      scaleMargins: { top: 0.1, bottom: 0.08 }
    },
    rightPriceScale: { visible: false },
    timeScale: {
      borderVisible: true,
      borderColor: light ? '#e8ecf2' : 'rgba(148, 163, 184, 0.25)',
      timeVisible: true,
      rightOffset: 8
    },
    crosshair: {
      vertLine: { visible: true, color: light ? 'rgba(28, 57, 100, 0.25)' : 'rgba(148, 163, 184, 0.35)' },
      horzLine: { visible: true, color: light ? 'rgba(28, 57, 100, 0.25)' : 'rgba(148, 163, 184, 0.35)' }
    }
  };
}

/**
 * 3-year price + MA200 (TickerPage-style lightweight chart) with 52-week range band.
 * @param {{ symbol: string, periodEnd?: string, fallback?: { high52?: number, low52?: number }, chartCaption?: string }} props
 */
export function TickerReportPriceChart({ symbol, periodEnd, fallback, chartCaption }) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const light = theme === 'light';

  const hostRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const maSeriesRef = useRef(null);
  const pendingDataRef = useRef(null);
  const rangeRef = useRef({ high: null, low: null, last: null });
  const updateOverlayRef = useRef(() => {});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range52, setRange52] = useState({
    high: fallback?.high52 ?? null,
    low: fallback?.low52 ?? null,
    last: null
  });
  const [overlay, setOverlay] = useState({ bandTop: 0, bandHeight: 0, highTop: 0, lowTop: 0, lastTop: 0 });

  const endDate = useMemo(() => {
    if (periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) return periodEnd;
    return new Date().toISOString().slice(0, 10);
  }, [periodEnd]);

  const startDate = useMemo(() => isoYearsBefore(endDate, 3), [endDate]);

  const lineColors = useMemo(
    () => ({
      price: light ? '#1c3964' : '#93c5fd',
      ma: light ? '#30679c' : '#60a5fa',
      band: light ? 'rgba(230, 235, 243, 0.55)' : 'rgba(148, 163, 184, 0.14)'
    }),
    [light]
  );

  const updateOverlay = useCallback(() => {
    const chart = chartRef.current;
    const series = priceSeriesRef.current;
    const host = hostRef.current;
    if (!chart || !series || !host) return;

    const { high, low, last } = rangeRef.current;
    const height = host.clientHeight;
    const toY = (val) => {
      if (!Number.isFinite(val)) return null;
      const y = series.priceToCoordinate(val);
      return y == null ? null : Number(y);
    };

    const yHigh = toY(high);
    const yLow = toY(low);
    const yLast = toY(last);

    let bandTop = 0;
    let bandHeight = 0;
    if (yHigh != null && yLow != null) {
      bandTop = Math.min(yHigh, yLow);
      bandHeight = Math.abs(yLow - yHigh);
    }

    setOverlay({
      bandTop,
      bandHeight,
      highTop: yHigh != null ? Math.max(0, yHigh - 10) : 0,
      lowTop: yLow != null ? Math.max(0, yLow - 10) : 0,
      lastTop: yLast != null ? Math.max(0, yLast - 10) : height - 24
    });
  }, []);

  updateOverlayRef.current = updateOverlay;

  const applySeriesData = useCallback(() => {
    const pending = pendingDataRef.current;
    const priceSeries = priceSeriesRef.current;
    const maSeries = maSeriesRef.current;
    const chart = chartRef.current;
    if (!pending || !priceSeries || !chart) return false;
    priceSeries.setData(pending.linePts);
    maSeries?.setData(pending.ma200Data);
    chart.timeScale().fitContent();
    requestAnimationFrame(() => updateOverlayRef.current());
    return true;
  }, []);

  const applySeriesDataRef = useRef(applySeriesData);
  applySeriesDataRef.current = applySeriesData;

  useEffect(() => {
    let cancelled = false;
    if (!canFetchMarketData()) {
      setLoading(false);
      setError('Sign in to load live price chart.');
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

        const payload = res.data || {};
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const candles = mapRowsToCandles(rows);
        const linePts = candles.map((c) => ({ time: c.time, value: c.close }));
        const ma200Data = Array.isArray(payload.ma200)
          ? payload.ma200
              .filter((r) => r.date && r.value != null)
              .map((r) => ({ time: r.date, value: Number(r.value) }))
              .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
          : [];

        const computed = compute52WeekRange(candles);
        const high52 = computed.high ?? fallback?.high52 ?? null;
        const low52 = computed.low ?? fallback?.low52 ?? null;
        const last = linePts.length ? linePts[linePts.length - 1].value : null;

        rangeRef.current = { high: high52, low: low52, last };
        setRange52({ high: high52, low: low52, last });
        pendingDataRef.current = { linePts, ma200Data };
        applySeriesDataRef.current();
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load chart');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, startDate, endDate, fallback?.high52, fallback?.low52]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 640));
    const priceSeries = chart.addLineSeries({
      color: lineColors.price,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      priceScaleId: 'left'
    });
    priceSeries.applyOptions({
      priceFormat: {
        type: 'custom',
        formatter: (p) => fmtChartPrice(p)
      }
    });

    const maSeries = chart.addLineSeries({
      color: lineColors.ma,
      lineWidth: 1.5,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceScaleId: 'left'
    });

    maSeriesRef.current = maSeries;
    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;
    applySeriesDataRef.current();

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      updateOverlayRef.current();
    };

    const ts = chart.timeScale();
    const onRange = () => updateOverlayRef.current();
    subscribeTickerReportTimeScale(ts, onRange);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      detachTickerReportChart(chart, ts, onRange);
      chartRef.current = null;
      priceSeriesRef.current = null;
      maSeriesRef.current = null;
    };
  }, [theme, lineColors.price, lineColors.ma]);

  useEffect(() => {
    applySeriesDataRef.current();
  }, [sym, startDate, endDate]);

  useLayoutEffect(() => {
    updateOverlay();
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => updateOverlayRef.current());
    ro.observe(host);
    return () => ro.disconnect();
  }, [updateOverlay, range52]);

  const fmtUsd = (v) => (Number.isFinite(v) ? fmtChartPrice(v) : '—');

  return (
    <figure className="ticker-report__chart ticker-report-price-chart">
      <div className="ticker-report-price-chart__plot" ref={hostRef} style={{ height: CHART_HEIGHT }}>
        {range52.high != null && range52.low != null && overlay.bandHeight > 0 ? (
          <div
            className="ticker-report-price-chart__band"
            style={{
              top: overlay.bandTop,
              height: overlay.bandHeight,
              // background: lineColors.band
            }}
            aria-hidden
          />
        ) : null}
        <div ref={containerRef} className="ticker-report-price-chart__canvas" />
        <div className="ticker-report-price-chart__legend" aria-hidden>
          <span className="ticker-report-price-chart__legend-item">
            <span className="ticker-report-price-chart__swatch ticker-report-price-chart__swatch--price" />
            {sym} Price
          </span>
          <span className="ticker-report-price-chart__legend-item">
            <span className="ticker-report-price-chart__swatch ticker-report-price-chart__swatch--ma" />
            200-Day Moving Avg
          </span>
        </div>
        {range52.high != null ? (
          <div className="ticker-report-price-chart__range-label" style={{ top: overlay.highTop }}>
            52W High <strong>${fmtUsd(range52.high)}</strong>
          </div>
        ) : null}
        {range52.low != null ? (
          <div className="ticker-report-price-chart__range-label" style={{ top: overlay.lowTop }}>
            52W Low <strong>${fmtUsd(range52.low)}</strong>
          </div>
        ) : null}
        {range52.last != null ? (
          <div className="ticker-report-price-chart__last" style={{ top: overlay.lastTop }}>
            ${fmtUsd(range52.last)}
          </div>
        ) : null}
        {loading ? <div className="ticker-report-price-chart__status">Loading chart…</div> : null}
        {!loading && error ? <div className="ticker-report-price-chart__status ticker-report-price-chart__status--err">{error}</div> : null}
      </div>
      <figcaption>
        {chartCaption ||
          `${sym} 3-year price with 200-day moving average.${
            range52.high != null && range52.low != null
              ? ` 52W range $${fmtUsd(range52.low)} – $${fmtUsd(range52.high)}.`
              : ''
          }`}
      </figcaption>
    </figure>
  );
}
