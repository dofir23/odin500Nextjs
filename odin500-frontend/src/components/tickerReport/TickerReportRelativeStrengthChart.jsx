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
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import {
  buildRelativeStrengthFromOhlc,
  relativeStrengthPointsFromSparse,
  resolveRelativeStrengthStats
} from '../../utils/relativeStrengthSeries.js';
import {
  detachTickerReportChart,
  subscribeTickerReportTimeScale
} from '../../utils/tickerReportChartUtils.js';

const CHART_HEIGHT = 340;
const BASELINE = 100;

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
      scaleMargins: { top: 0.08, bottom: 0.08 }
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

/**
 * 3-year relative strength vs SPY, rebased to 100 (PDF report style).
 * @param {{ symbol: string, periodEnd?: string, benchmark?: string, data?: object }} props
 */
export function TickerReportRelativeStrengthChart({
  symbol,
  periodEnd,
  benchmark = 'SPY',
  data
}) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const bench = String(benchmark || 'SPY').toUpperCase();
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const light = theme === 'light';
  const lightRef = useRef(light);
  lightRef.current = light;
  const statsDataRef = useRef(data);
  statsDataRef.current = data;

  const hostRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const pendingRef = useRef(null);
  const updateEvenLabelRef = useRef(() => {});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    peak: '—',
    trough: '—',
    now: '—',
    peakDate: '',
    troughDate: ''
  });
  const [evenLabelTop, setEvenLabelTop] = useState(null);

  const endDate = useMemo(() => {
    if (periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) return periodEnd;
    return new Date().toISOString().slice(0, 10);
  }, [periodEnd]);

  const startDate = useMemo(() => isoYearsBefore(endDate, 3), [endDate]);

  const lineColor = light ? '#1C3964' : '#93c5fd';
  const baselineColor = light ? '#718096' : '#94a3b8';

  const updateEvenLabel = useCallback(() => {
    const series = seriesRef.current;
    const host = hostRef.current;
    if (!series || !host) {
      setEvenLabelTop(null);
      return;
    }
    const y = series.priceToCoordinate(BASELINE);
    if (y == null) {
      setEvenLabelTop(null);
      return;
    }
    setEvenLabelTop(Math.max(8, Math.min(Number(y) - 8, host.clientHeight - 24)));
  }, []);

  updateEvenLabelRef.current = updateEvenLabel;

  const applySeriesData = useCallback(() => {
    const pending = pendingRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!pending?.length || !series || !chart) return false;

    series.setData(pending);
    const resolved = resolveRelativeStrengthStats(pending, statsDataRef.current || {});
    setStats(resolved);

    const troughPt = resolved.troughPoint;
    const isLight = lightRef.current;
    if (troughPt?.time) {
      series.setMarkers([
        {
          time: troughPt.time,
          position: 'inBar',
          color: isLight ? '#C62828' : '#f87171',
          shape: 'circle',
          size: 1.2
        }
      ]);
    } else {
      series.setMarkers([]);
    }

    chart.timeScale().fitContent();
    requestAnimationFrame(() => updateEvenLabelRef.current());
    return true;
  }, []);

  const applySeriesDataRef = useRef(applySeriesData);
  applySeriesDataRef.current = applySeriesData;

  useEffect(() => {
    let cancelled = false;
    const fallback = relativeStrengthPointsFromSparse(data || {});

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
        const body = { start_date: startDate, end_date: endDate };
        const [tickerRes, benchRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ohlc-signals-indicator',
            method: 'POST',
            body: { ...body, ticker: sym },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ohlc-signals-indicator',
            method: 'POST',
            body: { ...body, ticker: bench },
            ttlMs: 5 * 60 * 1000
          })
        ]);
        if (cancelled) return;

        const tickerRows = Array.isArray(tickerRes.data?.data) ? tickerRes.data.data : [];
        const benchRows = Array.isArray(benchRes.data?.data) ? benchRes.data.data : [];
        let points = buildRelativeStrengthFromOhlc(tickerRows, benchRows);
        if (points.length < 2 && fallback.length) points = fallback;

        pendingRef.current = points;
        applySeriesDataRef.current();
      } catch (e) {
        if (!cancelled) {
          pendingRef.current = fallback;
          applySeriesDataRef.current();
          if (!fallback.length) setError(e?.message || 'Failed to load relative strength chart');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, bench, startDate, endDate, data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 640));
    const series = chart.addLineSeries({
      color: lineColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      priceScaleId: 'left'
    });

    series.createPriceLine({
      price: BASELINE,
      color: baselineColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: ''
    });

    chartRef.current = chart;
    seriesRef.current = series;
    applySeriesDataRef.current();

    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      updateEvenLabelRef.current();
    };

    const ts = chart.timeScale();
    const onRange = () => updateEvenLabelRef.current();
    subscribeTickerReportTimeScale(ts, onRange);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      detachTickerReportChart(chart, ts, onRange);
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [theme, lineColor, baselineColor]);

  useEffect(() => {
    applySeriesDataRef.current();
  }, [sym, startDate, endDate, data]);

  useLayoutEffect(() => {
    updateEvenLabel();
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => updateEvenLabelRef.current());
    ro.observe(host);
    return () => ro.disconnect();
  }, [updateEvenLabel, loading]);

  return (
    <figure className="ticker-report__chart ticker-report-rs-chart">
      <div className="ticker-report-rs-chart__plot" ref={hostRef} style={{ height: CHART_HEIGHT }}>
        <div ref={containerRef} className="ticker-report-rs-chart__canvas" />
        <div className="ticker-report-rs-chart__legend" aria-hidden>
          <div className="ticker-report-rs-chart__legend-title">
            {sym} ÷ {bench} (rebased to 100)
          </div>
          <div className="ticker-report-rs-chart__legend-metrics">
            <span className="ticker-report-rs-chart__metric">
              <strong className="ticker-report-rs-chart__metric-val ticker-report-rs-chart__metric-val--peak">
                Peak {stats.peak}
              </strong>
              {stats.peakDate ? <span className="ticker-report-rs-chart__metric-date">{stats.peakDate}</span> : null}
            </span>
            <span className="ticker-report-rs-chart__metric">
              <strong className="ticker-report-rs-chart__metric-val ticker-report-rs-chart__metric-val--trough">
                Trough {stats.trough}
              </strong>
              {stats.troughDate ? (
                <span className="ticker-report-rs-chart__metric-date">{stats.troughDate}</span>
              ) : null}
            </span>
            <span className="ticker-report-rs-chart__metric">
              <strong className="ticker-report-rs-chart__metric-val ticker-report-rs-chart__metric-val--now">
                Now {stats.now}
              </strong>
            </span>
          </div>
        </div>
        {evenLabelTop != null ? (
          <div className="ticker-report-rs-chart__even-label" style={{ top: evenLabelTop }}>
            Even (100)
          </div>
        ) : null}
        {loading ? <div className="ticker-report-price-chart__status">Loading chart…</div> : null}
        {!loading && error ? (
          <div className="ticker-report-price-chart__status ticker-report-price-chart__status--err">{error}</div>
        ) : null}
      </div>
      <figcaption>
        Relative strength of {sym} versus the S&amp;P 500 ({bench}), rebased to 100 at the start of the observation
        window. Values above 100 indicate cumulative outperformance.
      </figcaption>
    </figure>
  );
}
