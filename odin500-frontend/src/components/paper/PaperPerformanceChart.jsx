'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { canFetchMarketData } from '../../store/apiStore.js';
import { ThemedDropdown } from '../ThemedDropdown.jsx';
import { fetchOhlcSignalsQuery } from '../../query/marketQueries.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../../utils/documentTheme.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import {
  filterHistoryByRange,
  historyToChartPoints,
  rebaseToHundred,
  ohlcRowsToClosePoints,
  alignBenchmarkToPortfolio,
  periodReturnPct,
  maxDrawdownPct,
  dedupeAscendingPoints,
  toDailyTradingPoints
} from '../../utils/paperPerformanceUtils.js';

const CHART_HEIGHT = 260;

/**
 * Indices offered for comparison. Tickers and colours come from the same market registry the
 * /market and compare pages use, so one index is the same colour everywhere in the app.
 */
const BENCHMARKS = [
  { id: 'SPX', ticker: 'SPX', label: 'S&P 500', color: '#56208E', colorLight: '#7c3aed' },
  { id: 'INDU', ticker: 'DJI', label: 'Dow Jones', color: '#ff6b00', colorLight: '#c2410c' },
  { id: 'NDX', ticker: 'NDX', label: 'Nasdaq 100', color: '#7a2fff', colorLight: '#6d28d9' }
];

const BENCHMARK_BY_ID = Object.fromEntries(BENCHMARKS.map((b) => [b.id, b]));

/** `isNone` is the default entry — selected while nothing is compared, and a reset when picked. */
const BENCHMARK_OPTIONS = [
  { id: '__none__', label: 'Select', isNone: true },
  ...BENCHMARKS.map((b) => ({ id: b.id, label: b.label }))
];

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10);
}

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
    // One point per trading day, so the axis and crosshair read as dates, never clock times.
    timeScale: {
      borderVisible: false,
      timeVisible: false,
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
  const [range] = useState('6M');
  const [selectedIds, setSelectedIds] = useState([]);
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState('');
  /** { [id]: Array<{time, value}> } — raw index closes, kept across toggles so re-picking is instant. */
  const [benchmarkSeries, setBenchmarkSeries] = useState({});

  const filteredHistory = useMemo(() => filterHistoryByRange(history, range), [history, range]);

  // Daily closes only: the snapshot job writes several rows a day and keeps writing over the
  // weekend, which the chart used to draw as intraday noise plus flat Sat/Sun plateaus.
  const portfolioPoints = useMemo(
    () => toDailyTradingPoints(historyToChartPoints(filteredHistory)),
    [filteredHistory]
  );

  // Primitives, not memoized arrays: these are what the fetch effect keys off, so a parent
  // re-render that rebuilds `history` can't cancel an in-flight request and restart it.
  const rangeStartMs = portfolioPoints.length ? portfolioPoints[0].time * 1000 : 0;
  const selectedKey = selectedIds.join(',');

  /** Each chosen index, sampled at the portfolio's own snapshot times and rebased to the same 100. */
  const displayBenchmarks = useMemo(
    () =>
      selectedIds
        .map((id) => {
          const raw = benchmarkSeries[id];
          if (!raw?.length) return null;
          // Snap index closes onto the same day-start timestamps, otherwise their noon-UTC
          // stamps sort after the portfolio's day marker and each day aligns to the prior close.
          const points = dedupeAscendingPoints(
            rebaseToHundred(alignBenchmarkToPortfolio(portfolioPoints, toDailyTradingPoints(raw)))
          );
          if (points.length < 2) return null;
          return { ...BENCHMARK_BY_ID[id], points };
        })
        .filter(Boolean),
    [selectedIds, benchmarkSeries, portfolioPoints]
  );

  // "Comparing" means a line is actually on screen, not merely that something is picked —
  // otherwise the axis would flip to base-100 while showing nothing new.
  const comparing = displayBenchmarks.length > 0;

  // Dollars are meaningless against an index level, so the chart switches to base-100 whenever
  // a benchmark is drawn — the same trick the old SPY toggle used.
  const displayPortfolio = useMemo(
    () => (comparing ? rebaseToHundred(portfolioPoints) : portfolioPoints),
    [portfolioPoints, comparing]
  );

  const periodReturn = useMemo(() => periodReturnPct(displayPortfolio), [displayPortfolio]);
  const drawdown = useMemo(() => maxDrawdownPct(displayPortfolio), [displayPortfolio]);

  /**
   * Loads the chosen index over the portfolio's own span.
   *
   * Failures are surfaced rather than swallowed — an empty series and a blank chart is
   * indistinguishable from "the feature is broken", which is exactly how the previous version
   * failed. Every exit path sets either points or an explanation.
   */
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : [];
    if (!ids.length) {
      setBenchmarkError('');
      return undefined;
    }
    if (!rangeStartMs) {
      setBenchmarkError('No portfolio history to compare against yet.');
      return undefined;
    }
    if (!canFetchMarketData()) {
      setBenchmarkError('Sign in to load index data.');
      return undefined;
    }

    let cancelled = false;
    setBenchmarkBusy(true);
    setBenchmarkError('');
    (async () => {
      // A week of lead-in so the first snapshot has a prior close to align against.
      const startDate = isoDay(rangeStartMs - 7 * 86400000);
      const endDate = isoDay(Date.now());
      const failures = [];
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const meta = BENCHMARK_BY_ID[id];
          if (!meta) return null;
          try {
            const payload = await fetchOhlcSignalsQuery({ ticker: meta.ticker, startDate, endDate });
            const rows = Array.isArray(payload?.data) ? payload.data : [];
            const points = ohlcRowsToClosePoints(rows);
            if (!points.length) failures.push(`${meta.label} returned no data`);
            return [id, points];
          } catch (err) {
            failures.push(`${meta.label}: ${err instanceof Error ? err.message : 'request failed'}`);
            return [id, []];
          }
        })
      );
      if (cancelled) return;
      setBenchmarkSeries((prev) => ({ ...prev, ...Object.fromEntries(loaded.filter(Boolean)) }));
      setBenchmarkError(failures.join(' · '));
      setBenchmarkBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedKey, rangeStartMs]);

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
      // Comparing: flatten the fill so benchmark lines crossing the portfolio stay readable.
      bottomColor: 'rgba(37, 99, 235, 0)',
      lineWidth: 2,
      priceLineVisible: false,
      title: comparing ? 'Your portfolio' : undefined
    });
    main.setData(portPts);
    seriesRef.current.push(main);

    for (const bench of displayBenchmarks) {
      const line = chart.addLineSeries({
        color: light ? bench.colorLight : bench.color,
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        title: bench.label
      });
      line.setData(bench.points);
      seriesRef.current.push(line);
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
  }, [theme, displayPortfolio, displayBenchmarks, comparing]);

  const yAxisHint = comparing
    ? 'Indexed to 100 at the start of the range — your portfolio and each index on the same scale.'
    : 'Portfolio value in US dollars.';

  return (
    <div className="paper-card paper-chart-card">
      <div className="paper-card__head paper-chart-card__head">
        <div className="paper-chart-card__titles">
          <h2 className="paper-card__title">Portfolio performance</h2>
          <p className="paper-chart-card__hint">{yAxisHint}</p>
        </div>
        <div className="paper-chart-card__head-right">
          {/* Sits left of Return so the comparison control reads as part of the same summary row. */}
          <ThemedDropdown
            size="sm"
            multiple
            value={selectedIds}
            options={BENCHMARK_OPTIONS}
            onChange={setSelectedIds}
            title="Compare with one or more indices"
            ariaLabelPrefix="Compare with"
            labelFallback="Select"
            className="paper-bench__dd"
          />
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
      </div>

      {benchmarkBusy || benchmarkError ? (
        <p className={'paper-bench__status' + (benchmarkError ? ' paper-bench__status--error' : '')}>
          {benchmarkBusy ? 'Loading index data…' : benchmarkError}
        </p>
      ) : null}

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
            {comparing ? (
              <div className="paper-chart-legend" aria-hidden>
                <span className="paper-chart-legend__item paper-chart-legend__item--you">Your portfolio</span>
                {displayBenchmarks.map((b) => (
                  <span
                    key={b.id}
                    className="paper-chart-legend__item paper-chart-legend__item--bench"
                    style={{ ['--paper-bench-color']: b.color }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}
            <div ref={hostRef} className="paper-chart-host" />
          </>
        )}
      </div>
    </div>
  );
}
