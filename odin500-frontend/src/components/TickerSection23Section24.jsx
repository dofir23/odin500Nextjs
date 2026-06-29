'use client';
import { isDev } from '../lib/env.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import {fetchJsonCached, getAuthToken, canFetchMarketData} from '../store/apiStore.js';
import { useReturnsChartFiltersMenuMode } from '../context/WatchlistDockContext.jsx';
import { ReturnsChartFiltersMenu } from './ReturnsChartFiltersMenu.jsx';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { ReturnsChartPieIcon } from './returnsChartToolbarIcons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ChartSectionIconActions } from './ChartSectionIconActions.jsx';
import { buildRelativeStrengthTickerHref } from '../utils/relativeStrengthNavigation.js';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';
import { BenchmarkBarsChart } from './BenchmarkBarsChart.jsx';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';

const GROUPS = [
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500', benchmark: 'SPX', benchLabel: 'S&P 500' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones', benchmark: 'DJI', benchLabel: 'Dow Jones' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100', benchmark: 'IXIC', benchLabel: 'Nasdaq 100' },
  { id: 'etf', apiIndex: 'ETF', label: 'ETF', benchmark: 'QQQ', benchLabel: 'ETF' },
  { id: 'other', apiIndex: 'Other', label: 'Other', benchmark: 'IWM', benchLabel: 'Other' }
];

const TF_ROWS = [
  { key: '1D', period: 'Last date' },
  { key: '5D', period: 'Week' },
  { key: '1M', period: 'Last Month' },
  { key: '3M', period: 'Last 3 months' },
  { key: '6M', period: 'Last 6 months' },
  { key: 'YTD', period: 'Year to Date (YTD)' },
  { key: '1Y', period: 'Last 1 year' },
  { key: '3Y', period: 'Last 3 years' },
  { key: '5Y', period: 'Last 5 years' },
  { key: '10Y', period: 'Last 10 years' },
  { key: '20Y', period: 'Last 20 years' }
];
const TABLE_ONLY_START_DATE = '2005-01-01';
const S24_CHART_PLOT_HEIGHT = 280;

/** Stable empty default — `= []` in params is a new array every render when the prop is omitted. */
const DEFAULT_INITIAL_SP500_ROWS = Object.freeze([]);

/** Dev-only: logs 1D / "Last date" pipeline. For prod builds, temporarily set to `true`. */
const DEBUG_BENCHMARK_TABLE_1D = isDev;

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickDynamic(dynamicPeriods, periodName) {
  if (!periodName || !Array.isArray(dynamicPeriods)) return null;
  const row = dynamicPeriods.find((r) => r.period === periodName);
  const v = row?.totalReturn;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function signedToneClass(v) {
  if (!Number.isFinite(Number(v))) return '';
  return Number(v) > 0 ? 'app-num--up' : Number(v) < 0 ? 'app-num--down' : '';
}

function pickTickerReturnsFromPayload(payload, tickerSym) {
  const u = String(tickerSym || '').toUpperCase().trim();
  if (!payload || !u) return null;
  if (payload.batch === true && payload.byTicker && payload.byTicker[u] != null) {
    const row = payload.byTicker[u];
    if (row && row.success === false) return null;
    return row;
  }
  if (!payload.batch && String(payload.ticker || '').toUpperCase() === u) return payload;
  return null;
}

export function TickerSection23Section24({
  pageSymbol = '',
  prefetchedLongTickerReturns = null,
  prefetchedLongBenchReturns = null,
  prefetchedLongBenchSymbol = '',
  prefetchedLongBusy = false,
  onSectionBenchmarkSymbolChange,
  initialSp500Rows = DEFAULT_INITIAL_SP500_ROWS,
  onViewMore: onViewMoreProp,
  /** Relative Strength ticker page: IndexPage-style head selectors (ticker + index ETF). */
  rsPageSelectors = false,
  selectedTicker = '',
  onSelectedTickerChange,
  selectedBenchmarkSymbol = 'SPX',
  onSelectedBenchmarkSymbolChange,
  tickerSelectOptions = [],
  indexSelectOptions = []
}) {
  const navigate = useNavigate();
  const [groupId, setGroupId] = useState('sp500');
  const [groupRows, setGroupRows] = useState([]);
  const [ticker, setTicker] = useState(String(pageSymbol || '').toUpperCase());
  const [localTickerReturns, setLocalTickerReturns] = useState(null);
  const [localBenchReturns, setLocalBenchReturns] = useState(null);
  const [localReturnsBusy, setLocalReturnsBusy] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const coreReturnsCacheRef = useRef(new Map());
  const filtersMenuMode = useReturnsChartFiltersMenuMode();

  const activeGroup = useMemo(() => GROUPS.find((g) => g.id === groupId) || GROUPS[0], [groupId]);

  const benchSymbol = useMemo(() => {
    if (rsPageSelectors) {
      return String(selectedBenchmarkSymbol || 'SPX').toUpperCase().trim();
    }
    return String(activeGroup.benchmark || '').toUpperCase().trim();
  }, [rsPageSelectors, selectedBenchmarkSymbol, activeGroup.benchmark]);

  const benchLabel = rsPageSelectors
    ? indexSelectOptions.find((o) => o.id === benchSymbol)?.label || benchSymbol || 'Index'
    : activeGroup.benchLabel;

  const onViewMore = useCallback(() => {
    if (typeof onViewMoreProp === 'function') {
      onViewMoreProp();
      return;
    }
    const sym = String(pageSymbol || ticker || '').trim();
    navigate(buildRelativeStrengthTickerHref(sym));
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, onViewMoreProp, pageSymbol, ticker]);

  /** Avoid effect loops: default prop `initialSp500Rows = []` is a new [] every render when omitted. */
  const initialSp500RowsSig = useMemo(() => {
    const arr = initialSp500Rows;
    if (!Array.isArray(arr) || !arr.length) return '';
    return `${arr.length}:${arr.map((r) => String(r?.symbol || '')).join(',')}`;
  }, [initialSp500Rows]);

  useEffect(() => {
    if (rsPageSelectors) {
      const next = String(selectedTicker || pageSymbol || '').toUpperCase();
      if (next) setTicker(next);
      return;
    }
    setTicker(String(pageSymbol || '').toUpperCase());
  }, [pageSymbol, rsPageSelectors, selectedTicker]);

  const usePrefetchLong = useMemo(() => {
    if (rsPageSelectors) return false;
    const symPage = String(pageSymbol || '').toUpperCase().trim();
    const tick = String(ticker || '').toUpperCase().trim();
    const prefB = String(prefetchedLongBenchSymbol || '').toUpperCase().trim();
    return tick === symPage && benchSymbol === prefB;
  }, [pageSymbol, ticker, benchSymbol, prefetchedLongBenchSymbol, rsPageSelectors]);

  const tickerReturns = usePrefetchLong ? prefetchedLongTickerReturns : localTickerReturns;
  const benchReturns = usePrefetchLong ? prefetchedLongBenchReturns : localBenchReturns;
  const loadingReturns =
    loadingGroup || (usePrefetchLong ? prefetchedLongBusy : localReturnsBusy);

  useEffect(() => {
    onSectionBenchmarkSymbolChange?.(benchSymbol);
  }, [benchSymbol, onSectionBenchmarkSymbolChange]);

  useEffect(() => {
    if (rsPageSelectors) return;
    let cancelled = false;
    async function loadGroupRows() {
      if (!canFetchMarketData()) return;
      setLoadingGroup(true);
      try {
        const rowsFromProp =
          activeGroup.id === 'sp500' && Array.isArray(initialSp500Rows) && initialSp500Rows.length
            ? initialSp500Rows
            : null;
        const data = rowsFromProp
          ? { data: rowsFromProp }
          : (
              await fetchJsonCached({
                path: '/api/market/ticker-details',
                method: 'POST',
                body: { index: activeGroup.apiIndex, period: 'last-1-year' },
                ttlMs: 10 * 60 * 1000
              })
            ).data;
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const sorted = [...list].sort((a, b) =>
          String(a.symbol || '').localeCompare(String(b.symbol || ''), undefined, { sensitivity: 'base' })
        );
        setGroupRows(sorted);
        const syms = new Set(sorted.map((r) => String(r.symbol || '').toUpperCase()));
        if (!syms.has(ticker)) {
          setTicker(sorted[0]?.symbol ? String(sorted[0].symbol).toUpperCase() : '');
        }
      } catch {
        if (!cancelled) setGroupRows([]);
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    }
    loadGroupRows();
    return () => {
      cancelled = true;
    };
  }, [activeGroup.apiIndex, activeGroup.id, initialSp500RowsSig, rsPageSelectors]);

  /**
   * When the peer ticker differs from the page symbol, load only missing core payloads.
   * This avoids refetching both symbols when only one dropdown changes.
   */
  useEffect(() => {
    let cancelled = false;
    const symPage = String(pageSymbol || '').toUpperCase().trim();
    const tick = String(ticker || '').toUpperCase().trim();
    const bench = benchSymbol;
    const prefB = String(prefetchedLongBenchSymbol || '').toUpperCase().trim();
    const usePrefetch = tick === symPage && bench === prefB;

    if (!canFetchMarketData() || !tick || !bench) {
      setLocalTickerReturns(null);
      setLocalBenchReturns(null);
      setLocalReturnsBusy(false);
      return () => {
        cancelled = true;
      };
    }

    if (usePrefetch) {
      setLocalTickerReturns(null);
      setLocalBenchReturns(null);
      setLocalReturnsBusy(false);
      return () => {
        cancelled = true;
      };
    }

    async function getCoreReturns(sym) {
      const u = String(sym || '').toUpperCase().trim();
      if (!u) return null;
      const key = `${u}|${TABLE_ONLY_START_DATE}|${yesterdayIso()}`;
      if (coreReturnsCacheRef.current.has(key)) {
        return coreReturnsCacheRef.current.get(key);
      }
      const res = await fetchJsonCached({
        path: '/api/market/ticker-core-returns',
        method: 'POST',
        body: {
          ticker: u,
          customStartDate: TABLE_ONLY_START_DATE,
          customEndDate: yesterdayIso()
        },
        ttlMs: 5 * 60 * 1000
      });
      const payload = pickTickerReturnsFromPayload(res.data, u) || (res.data?.ticker ? res.data : null);
      coreReturnsCacheRef.current.set(key, payload);
      return payload;
    }

    (async () => {
      setLocalReturnsBusy(true);
      try {
        const [tickData, benchData] = await Promise.all([getCoreReturns(tick), getCoreReturns(bench)]);
        if (cancelled) return;
        setLocalTickerReturns(tickData);
        setLocalBenchReturns(benchData);
      } catch {
        if (!cancelled) {
          setLocalTickerReturns(null);
          setLocalBenchReturns(null);
        }
      } finally {
        if (!cancelled) setLocalReturnsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, benchSymbol, pageSymbol, prefetchedLongBenchSymbol]);

  const rows = useMemo(() => {
    const dynT = tickerReturns?.performance?.dynamicPeriods || [];
    const dynB = benchReturns?.performance?.dynamicPeriods || [];
    return TF_ROWS.map((tf) => {
      const bench = pickDynamic(dynB, tf.period);
      const tick = pickDynamic(dynT, tf.period);
      const diff =
        Number.isFinite(bench) && Number.isFinite(tick)
          ? Number(tick) - Number(bench)
          : null;
      return { tf: tf.key, bench, tick, diff };
    });
  }, [tickerReturns, benchReturns]);

  useEffect(() => {
    if (!DEBUG_BENCHMARK_TABLE_1D || loadingReturns) return;
    const period1d = TF_ROWS[0].period;
    const dynT = tickerReturns?.performance?.dynamicPeriods || [];
    const dynB = benchReturns?.performance?.dynamicPeriods || [];
    const rowT = dynT.find((r) => r.period === period1d);
    const rowB = dynB.find((r) => r.period === period1d);
    const tick = pickDynamic(dynT, period1d);
    const bench = pickDynamic(dynB, period1d);
    const diff =
      Number.isFinite(bench) && Number.isFinite(tick) ? Number(tick) - Number(bench) : null;

    // eslint-disable-next-line no-console -- intentional debug trace for 1D / Last date
    console.groupCollapsed('[TickerSection23Section24:1D / Last date]');
    // eslint-disable-next-line no-console
    console.log('context', {
      ticker,
      benchmark: activeGroup.benchmark,
      benchLabel: activeGroup.benchLabel,
      usePrefetchLong,
      tickerAsOf: tickerReturns?.asOfDate,
      benchAsOf: benchReturns?.asOfDate
    });
    // eslint-disable-next-line no-console
    console.log('period key we match on', JSON.stringify(period1d));
    // eslint-disable-next-line no-console
    console.log('all dynamic period labels (ticker)', dynT.map((r) => r.period));
    // eslint-disable-next-line no-console
    console.log('all dynamic period labels (benchmark)', dynB.map((r) => r.period));
    // eslint-disable-next-line no-console
    console.log('raw row ticker "Last date"', rowT ?? '(no row with exact period match)');
    // eslint-disable-next-line no-console
    console.log('raw row benchmark "Last date"', rowB ?? '(no row with exact period match)');
    // eslint-disable-next-line no-console
    console.log('pickDynamic totals', { tick1d: tick, bench1d: bench, diff1d: diff });
    const row1d = rows.find((r) => r.tf === '1D');
    // eslint-disable-next-line no-console
    console.log('computed table row (1D)', row1d);
    // eslint-disable-next-line no-console
    console.log(
      'why 0%? (same calendar start/end often means one trading bar → ~0% return)',
      {
        tickerSameDay:
          rowT?.startDate && rowT?.endDate ? rowT.startDate === rowT.endDate : null,
        benchSameDay:
          rowB?.startDate && rowB?.endDate ? rowB.startDate === rowB.endDate : null,
        tickerPrices: rowT ? { start: rowT.startPrice, end: rowT.endPrice } : null,
        benchPrices: rowB ? { start: rowB.startPrice, end: rowB.endPrice } : null
      }
    );
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [
    loadingReturns,
    tickerReturns,
    benchReturns,
    ticker,
    activeGroup.benchmark,
    activeGroup.benchLabel,
    usePrefetchLong,
    rows
  ]);

  const chartRows = useMemo(
    () => rows.map(({ tf, bench, tick }) => ({ tf, bench, tick })),
    [rows]
  );

  const s24CardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const s24FsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const s24PlotRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const fsPlotSize = useChartFullscreenPlotSize(s24FsRef);
  const chartFullscreen = fsPlotSize != null;
  const s24PlotHeight = chartFullscreen
    ? Math.max(200, Math.round((fsPlotSize?.height ?? 400) - 56))
    : S24_CHART_PLOT_HEIGHT;

  const exportSymbol = String(pageSymbol || ticker || '').trim().toUpperCase() || 'chart';
  const benchSlug = String(benchSymbol || activeGroup.benchmark || activeGroup.id || 'benchmark').toLowerCase();

  const exportS24Csv = useCallback(() => {
    const header = ['period', 'benchmark_pct', 'ticker_pct', 'difference_pct'];
    const lines = [header.join(',')];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    for (const r of rows) {
      lines.push(
        [esc(r.tf), esc(r.bench), esc(r.tick), esc(r.diff)].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportSymbol}-vs-${benchSlug}-benchmark-bars.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, exportSymbol, benchSlug]);

  const exportS24CsvClick = useGatedCsvDownload(exportS24Csv);

  const buildS24SnapshotFilename = useCallback(
    () => buildTickerChartExportFilename('benchmark-bars', `${exportSymbol}-vs-${benchSlug}`),
    [exportSymbol, benchSlug]
  );

  const s24ChartActionsDisabled = loadingReturns || !rows.length;

  const rsPageSelectorControls =
    rsPageSelectors && (tickerSelectOptions.length || indexSelectOptions.length) ? (
      <div className="ticker-rs-controls ticker-rs-controls--inline">
        {tickerSelectOptions.length ? (
          <ThemedDropdown
            wideLabel
            style={{ minWidth: 0, maxWidth: '100%' }}
            value={ticker}
            options={tickerSelectOptions}
            onChange={(id) => {
              const next = String(id || '').toUpperCase();
              setTicker(next);
              onSelectedTickerChange?.(next);
            }}
            title="Ticker"
            ariaLabelPrefix="Ticker"
            labelFallback={ticker || '—'}
          />
        ) : null}
        {indexSelectOptions.length ? (
          <ThemedDropdown
            wideLabel
            style={{ minWidth: 0, maxWidth: '100%' }}
            value={benchSymbol}
            options={indexSelectOptions}
            onChange={(id) => {
              const next = String(id || '').toUpperCase();
              onSelectedBenchmarkSymbolChange?.(next);
            }}
            title="Index"
            ariaLabelPrefix="Index"
            labelFallback={benchLabel || 'S&P 500'}
          />
        ) : null}
      </div>
    ) : null;

  const benchmarkControls = (
    <div className="ticker-s23s24__controls">
      <ThemedDropdown
        className="ticker-s23s24__select-dd"
        style={{ width: '100%' }}
        size="sm"
        wideLabel
        value={ticker}
        options={groupRows.map((r) => {
          const s = String(r.symbol || '').toUpperCase();
          return { id: s, label: s };
        })}
        onChange={setTicker}
        title="Ticker"
        ariaLabelPrefix="Ticker"
        disabled={!groupRows.length}
        labelFallback="—"
      />
      <ThemedDropdown
        className="ticker-s23s24__select-dd"
        style={{ width: '100%' }}
        size="sm"
        wideLabel
        value={groupId}
        options={GROUPS.map((g) => ({ id: g.id, label: g.label }))}
        onChange={setGroupId}
        title="Index group"
        ariaLabelPrefix="Group"
      />
    </div>
  );

  return (
    <section className="ticker-s23s24">
      <div className="ticker-s23s24__card ticker-s23">
        {rsPageSelectors ? (
          <div className="ticker-s23s24__head-row ticker-subh-with-tip ticker-subh-with-tip--in-card ticker-rs-selector-head">
            <div className="ticker-rs-selector-head__left">
              <div className="flex shrink-0 align-centers">
                <ReturnsChartPieIcon />
              </div>
              <div className="ticker-subh-left">
                <ReturnsChartClickableTitle
                  className="ticker-subh ticker-subh--flex uppercase"
                  onClick={onViewMore}
                >
                  Relative Strength
                </ReturnsChartClickableTitle>
                <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
              </div>
            </div>
            {rsPageSelectorControls ? (
              <div className="ticker-rs-selector-head__right">{rsPageSelectorControls}</div>
            ) : null}
          </div>
        ) : (
          <div className="ticker-s23s24__head-row ticker-s23s24__head-row--title-only">
            <div className="ticker-card__h-with-tip">
              <div className="inline-flex shrink-0 items-center gap-2 uppercase">
                <ReturnsChartPieIcon />
                <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
                  Relative Strength
                </ReturnsChartClickableTitle>
              </div>
              <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
            </div>
          </div>
        )}
        <div className="ticker-s23__body">
          <table className="ticker-s23__table">
            <thead>
              <tr>
                <th> Time</th>
                <th>{ticker || 'Ticker'}</th>
                <th>{benchLabel}</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tf}>
                  <th scope="row">{r.tf}</th>
                  <td className={signedToneClass(r.tick)}>{fmtPctSigned(r.tick)}</td>
                  <td className={signedToneClass(r.bench)}>{fmtPctSigned(r.bench)}</td>
                  <td className={signedToneClass(r.diff)}>{fmtPctSigned(r.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={s24CardRef} className="ticker-s23s24__card ticker-s24">
        <div className="ticker-s24__title-row">
          <div className="ticker-card__h-with-tip">
            <div className="inline-flex shrink-0 items-center gap-2 uppercase">
              <ReturnsChartPieIcon />
              <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
                Benchmark vs Ticker Bars
              </ReturnsChartClickableTitle>
            </div>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
          </div>
          <div className="ticker-s24__title-actions">
            <ReturnsChartToolbar
              className="ticker-s24__chart-toolbar-icons"
              showViewMore={false}
              showTableToggle={false}
              onDownload={exportS24CsvClick}
              downloadDisabled={s24ChartActionsDisabled}
            />
            <ChartSectionIconActions
              snapshotRootRef={s24CardRef}
              plotHostRef={s24PlotRef}
              fullscreenTargetRef={s24FsRef}
              buildFilename={buildS24SnapshotFilename}
              disabled={s24ChartActionsDisabled}
              exportPreviewAlt={`Benchmark vs ${ticker || 'ticker'} bars chart`}
              exportModalTitle="Export chart"
            />
          </div>
        </div>
        {!filtersMenuMode && !rsPageSelectors ? benchmarkControls : null}
        <div ref={s24FsRef} className="ticker-chart-fs-shell ticker-s24__chart-shell">
          {loadingReturns ? (
            <div className="chart-viz-loading-wrap ticker-s24__viz-loading">
              <TradingChartLoader
                label="Loading benchmark comparison…"
                sublabel={`${benchLabel} vs ${ticker || 'ticker'}`}
              />
            </div>
          ) : (
            <>
              <div ref={s24PlotRef} className="ticker-s24__chart-wrap">
                <BenchmarkBarsChart
                  rows={chartRows}
                  tickerLabel={ticker || 'Ticker'}
                  benchLabel={benchLabel}
                  plotHeight={s24PlotHeight}
                  chartFullscreen={chartFullscreen}
                />
              </div>
              <div className="ticker-s24__legend">
                <span>
                  <i className="ticker-s24__dot ticker-s24__dot--tick" />
                  {ticker || 'Ticker'}
                </span>
                <span>
                  <i className="ticker-s24__dot ticker-s24__dot--bench" />
                  {benchSymbol || activeGroup.benchmark}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

