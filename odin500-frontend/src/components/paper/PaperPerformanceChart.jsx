'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchJsonCached } from '../../store/apiStore.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import {
  PAPER_PERF_RANGES,
  filterHistoryByRange,
  historyToChartPoints,
  rebaseToHundred,
  ohlcRowsToClosePoints,
  alignBenchmarkToPortfolio,
  periodReturnPct,
  maxDrawdownPct,
  dedupeAscendingPoints
} from '../../utils/paperPerformanceUtils.js';

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

/**
 * Single-account performance chart with time range and optional SPY benchmark.
 * @param {{ history: Array<{ snapshot_at: string, equity: number }>, loading?: boolean }} props
 */
export function PaperPerformanceChart({ history = [], loading = false }) {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef([]);
  const [range, setRange] = useState('6M');
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkPoints, setBenchmarkPoints] = useState([]);

  const filteredHistory = useMemo(() => filterHistoryByRange(history, range), [history, range]);

  const portfolioPoints = useMemo(() => historyToChartPoints(filteredHistory), [filteredHistory]);

  const displayPortfolio = useMemo(() => {
    if (showBenchmark) return rebaseToHundred(portfolioPoints);
    return portfolioPoints;
  }, [portfolioPoints, showBenchmark]);

  const displayBenchmark = useMemo(() => {
    if (!showBenchmark || !benchmarkPoints.length) return [];
    const aligned = alignBenchmarkToPortfolio(portfolioPoints, benchmarkPoints);
    return rebaseToHundred(aligned);
  }, [showBenchmark, benchmarkPoints, portfolioPoints]);

  const periodReturn = useMemo(() => periodReturnPct(displayPortfolio), [displayPortfolio]);
  const drawdown = useMemo(() => maxDrawdownPct(displayPortfolio), [displayPortfolio]);

  useEffect(() => {
    if (!showBenchmark) {
      setBenchmarkPoints([]);
      return undefined;
    }
    let cancelled = false;
    setBenchmarkBusy(true);
    (async () => {
      try {
        const res = await fetchJsonCached({
          path: '/api/market/ohlc?symbol=SPY&limit=600',
          method: 'GET',
          ttlMs: 60 * 60 * 1000
        });
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const start = filterHistoryByRange(history, range)[0]?.snapshot_at;
        const startMs = start ? Date.parse(start) : 0;
        const closes = ohlcRowsToClosePoints(rows).filter((p) => !startMs || p.time * 1000 >= startMs - 86400000);
        setBenchmarkPoints(closes);
      } catch {
        if (!cancelled) setBenchmarkPoints([]);
      } finally {
        if (!cancelled) setBenchmarkBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBenchmark, range, history]);

  useEffect(() => {
    const el = hostRef.current;
    const portPts = dedupeAscendingPoints(displayPortfolio);
    if (!el || portPts.length < 2) return undefined;

    const light = theme === 'light';
    const chart = createChart(el, chartOptionsForTheme(theme, el.clientWidth || 600));
    seriesRef.current = [];

    const main = chart.addAreaSeries({
      lineColor: light ? '#2563eb' : '#60a5fa',
      topColor: light ? 'rgba(37, 99, 235, 0.28)' : 'rgba(96, 165, 250, 0.32)',
      bottomColor: 'rgba(37, 99, 235, 0)',
      lineWidth: 2,
      priceLineVisible: false,
      title: showBenchmark ? 'Your portfolio' : undefined
    });
    main.setData(portPts);
    seriesRef.current.push(main);

    const benchPts = dedupeAscendingPoints(displayBenchmark);
    if (showBenchmark && benchPts.length >= 2) {
      const bench = chart.addLineSeries({
        color: light ? '#64748b' : '#94a3b8',
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        title: 'SPY (S&P 500)'
      });
      bench.setData(benchPts);
      seriesRef.current.push(bench);
    }

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
      seriesRef.current = [];
    };
  }, [theme, displayPortfolio, displayBenchmark, showBenchmark]);

  const yAxisHint = showBenchmark
    ? 'Indexed to 100 at the start of the range — easier to compare with the market.'
    : 'Portfolio value in US dollars.';

  return (
    <div className="paper-card paper-chart-card">
      <div className="paper-card__head paper-chart-card__head">
        <div className="paper-chart-card__titles">
          <h2 className="paper-card__title">Portfolio performance</h2>
          <p className="paper-chart-card__hint">{yAxisHint}</p>
        </div>
        {periodReturn != null ? (
          <div className="paper-chart-card__stats" aria-label="Summary for selected time range">
            <span className="paper-chart-card__stat">
              <span className="paper-chart-card__stat-label">Return</span>
              <strong className={periodReturn >= 0 ? 'paper-tone-up' : 'paper-tone-down'}>
                {fmtPctSigned(periodReturn, { decimals: 2 })}
              </strong>
            </span>
            {drawdown != null ? (
              <span className="paper-chart-card__stat">
                <span className="paper-chart-card__stat-label">Max drop</span>
                <strong>−{drawdown.toFixed(1)}%</strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      

      <div className="paper-card__body">
        {loading ? (
          <div className="paper-skeleton paper-chart-host" aria-busy="true" />
        ) : displayPortfolio.length < 2 ? (
          <div className="paper-chart-empty">
            <p className="paper-chart-empty__title">Chart not ready yet</p>
            <p>
              We record your portfolio value over time. After a couple of snapshots, your performance line will
              appear here. Place a trade or check back tomorrow.
            </p>
          </div>
        ) : (
          <>
            {showBenchmark ? (
              <div className="paper-chart-legend" aria-hidden>
                <span className="paper-chart-legend__item paper-chart-legend__item--you">Your portfolio</span>
                <span className="paper-chart-legend__item paper-chart-legend__item--spy">SPY benchmark</span>
              </div>
            ) : null}
            <div ref={hostRef} className="paper-chart-host" />
          </>
        )}
      </div>
    </div>
  );
}
