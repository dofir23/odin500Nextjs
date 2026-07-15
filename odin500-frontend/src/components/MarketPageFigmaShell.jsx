'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import {
  canFetchMarketData,
  fetchJsonCached,
  fetchWithAuth,
  getAuthToken,
  isAbortError,
  isAuthDisabled
} from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { NormalizedPerformanceCard } from './NormalizedPerformanceCard.jsx';
import { SectorTreemap } from './SectorTreemap.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import {
  DEFAULT_SELECTED_KEYS,
  MARKET_SERIES,
  META_BY_KEY,
  OTHER_MARKET_SUBSECTIONS
} from './marketSeriesRegistry.js';
import { useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { fmtAbsSigned, fmtPct, fmtPctSigned, fmtPrice } from '../utils/marketCalculations.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';
import { MarketReturnsSummaryTable } from './MarketReturnsSummaryTable.jsx';
import { buildValsFromBatch, fetchMarketTickerReturnsBatch, uniqueMarketSummaryTickers } from '../utils/marketReturnsTable.js';
import { dedupeTickerDetailRows, tickerRowSymbol } from '../utils/dedupeTickerRows.js';
import {
  fetchMarketRailSnapshotQuery,
  fetchTickerDetailsQuery
} from '../query/marketQueries.js';
import { MARKET_STALE } from '../query/queryClient.js';

const LEFT_GROUPS = [
  { id: 'us', title: 'Key US Indices ' },
  { id: 'index', title: 'Index ETFs' },
  { id: 'sector', title: 'SP500 Sectors' },
  { id: 'other', title: 'Other Markets ETFs' }
];

/** Matches left-aside `mkt-mini-card` header title typography. */
const MKT_ASIDE_TITLE_CLASS = 'uppercase text-[12px] font-medium leading-[1.1]';

/** Renders titles with a smaller “s” in “ETFs” (e.g. Index ETF<span>s</span>). */
function MktAsideTitleText({ text }) {
  const str = String(text ?? '');
  if (!/ETFs/i.test(str)) return str;
  const parts = [];
  const re = /ETFs/gi;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    parts.push(
      <span key={`etf-${i++}`} className="mkt-title-etfs">
        ETF<span className="mkt-title-etfs__s">s</span>
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push(str.slice(last));
  return <>{parts}</>;
}
const REFRESH_MAP = { manual: 0, '15s': 15000, '30s': 30000, '60s': 60000 };

/** Dev logging for market API responses — open browser console on /market */
function logMarketApi(label, detail) {
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[MarketPage API] ${label}`, detail);
}

async function logFetchJsonCached(label, fetchArgs) {
  const url = apiUrl(fetchArgs.path);
  logMarketApi(`${label} → request`, { url, method: fetchArgs.method || 'GET', body: fetchArgs.body });
  const result = await fetchJsonCached(fetchArgs);
  logMarketApi(`${label} ← response`, {
    url,
    fromCache: result.fromCache,
    status: result.status,
    payload: result.data,
    dataLength: Array.isArray(result.data?.data) ? result.data.data.length : undefined,
    success: result.data?.success,
    byKeyCount: result.data?.byKey ? Object.keys(result.data.byKey).length : undefined
  });
  return result;
}

async function logFetchWithAuth(label, path, init) {
  const url = apiUrl(path);
  logMarketApi(`${label} → request`, { url, ...init, body: init?.body ? JSON.parse(init.body) : undefined });
  const res = await fetchWithAuth(url, init);
  const rawText = await res.clone().text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { _parseError: true, rawPreview: rawText.slice(0, 200) };
  }
  logMarketApi(`${label} ← response`, {
    url,
    status: res.status,
    ok: res.ok,
    rawLength: rawText.length,
    payload,
    dataLength: Array.isArray(payload?.data) ? payload.data.length : undefined,
    success: payload?.success
  });
  return { res, payload, rawText };
}
const LS_KEYS = {
  selected: 'market_shell_selected_keys',
  tf: 'market_shell_tf',
  axis: 'market_shell_axis',
  refresh: 'market_shell_refresh'
};

function groupRows(groupId) {
  return MARKET_SERIES.filter((s) => s.group === groupId);
}

function otherMarketSubsections() {
  const rows = groupRows('other');
  return OTHER_MARKET_SUBSECTIONS.map((sub) => ({
    ...sub,
    rows: rows.filter((r) => r.subsection === sub.id)
  })).filter((sub) => sub.rows.length > 0);
}

function MarketMiniCardRow({ row: r, groupId, snapshot, selectedKeys, onToggleSeries }) {
  const v = snapshot;
  const up = Number(v?.chgPct) > 0;
  const down = Number(v?.chgPct) < 0;
  const checked = selectedKeys.includes(r.key);
  const tickerLabel = r.symbol
    ? String(r.symbol)
    : String(r.ticker || r.key || '').toUpperCase();
  const routeSym = sanitizeTickerPageInput(r.ticker || r.symbol || r.key);
  const indexTo = r.indexRouteSlug ? `/indices/${encodeURIComponent(r.indexRouteSlug)}` : '';
  const tickerTo =
    indexTo ||
    (routeSym ? `/ticker/${encodeURIComponent(routeSym)}?ticker=${encodeURIComponent(routeSym)}` : '');
  const linkTitle = indexTo
    ? `Open ${r.label} index page`
    : routeSym
      ? `Open ${routeSym} on ticker page (OHLC: ${String(r.ticker || '').toUpperCase()})`
      : '';

  return (
    <div className="mkt-mini-card__row">
      <label className="mkt-mini-card__check-label" style={{ ['--mkt-check-accent']: r.color }}>
        <input
          type="checkbox"
          className="mkt-mini-card__check"
          checked={checked}
          onChange={() => onToggleSeries(r.key)}
          aria-label={`Show ${r.label} in chart`}
        />
      </label>
      {indexTo ? (
        <Link className="mkt-mini-card__name mkt-mini-card__name--link" to={indexTo} title={linkTitle}>
          {r.label}
        </Link>
      ) : (
        <MktMiniCardName label={r.label} />
      )}
      {tickerTo ? (
        <Link className="mkt-mini-card__ticker mkt-mini-card__ticker--link" to={tickerTo} title={linkTitle}>
          {tickerLabel || '—'}
        </Link>
      ) : (
        <span className="mkt-mini-card__ticker" title={`OHLC symbol: ${String(r.ticker || '').toUpperCase()}`}>
          {tickerLabel || '—'}
        </span>
      )}
      <span>{v ? fmtPrice(v.close) : '—'}</span>
      <span className={up ? 'is-up' : down ? 'is-down' : ''}>{v ? fmtAbsSigned(v.chg) : '—'}</span>
      <span className={up ? 'is-up' : down ? 'is-down' : ''}>{v ? fmtPctSigned(v.chgPct) : '—'}</span>
    </div>
  );
}

/** Full label on hover when the name cell is ellipsis-truncated. */
function MktMiniCardName({ label }) {
  const ref = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [hover, setHover] = useState(false);
  const [tipPos, setTipPos] = useState(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  const placeTip = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxW = Math.min(280, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - maxW - 8));
    setTipPos({ left, top: r.top - 6, maxW });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [label, measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const wrap = el.parentElement;
    if (wrap) ro.observe(wrap);
    return () => ro.disconnect();
  }, [measure]);

  const showTip = truncated
    ? () => {
        setHover(true);
        placeTip();
      }
    : undefined;

  const text = String(label ?? '');

  return (
    <>
      <span
        ref={ref}
        className="mkt-mini-card__name"
        onMouseEnter={showTip}
        onMouseLeave={truncated ? () => setHover(false) : undefined}
        onFocus={showTip}
        onBlur={truncated ? () => setHover(false) : undefined}
        tabIndex={truncated ? 0 : undefined}
      >
        {text}
      </span>
      {truncated && hover && tipPos
        ? createPortal(
            <span
              className="mkt-mini-card__name-tip"
              role="tooltip"
              style={{
                left: tipPos.left,
                top: tipPos.top,
                maxWidth: tipPos.maxW
              }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
  );
}

const RAIL_SNAPSHOT_SERIES = MARKET_SERIES.map((s) => ({ key: s.key, ticker: s.ticker }));
const RAIL_SNAPSHOT_STORAGE_PREFIX = 'mkt-rail-snapshot:v1:';

function rowsByGroupFromByKey(byKey) {
  const out = {};
  for (const g of LEFT_GROUPS) {
    const seriesRows = groupRows(g.id);
    out[g.id] = Object.fromEntries(seriesRows.map((r) => [r.key, byKey?.[r.key] ?? null]));
  }
  return out;
}

function LeftSnapshotStack({
  selectedKeys,
  onToggleSeries,
  onSelectGroupAll,
  onClearGroup,
  onSelectSubsectionAll,
  onClearSubsection,
  timeframe,
  refreshMs,
  initialRowsByGroup = null
}) {
  const [rowsByGroup, setRowsByGroup] = useState(() => initialRowsByGroup || {});

  useEffect(() => {
    let cancel = false;
    const tf = timeframe || '6M';
    const storageKey = RAIL_SNAPSHOT_STORAGE_PREFIX + tf;

    async function load() {
      if (!canFetchMarketData()) {
        logMarketApi('market-rail-snapshot skipped', {
          canFetchMarketData: false,
          isAuthDisabled: isAuthDisabled(),
          hasAuthToken: Boolean(getAuthToken())
        });
        return;
      }
      if (initialRowsByGroup && Object.keys(initialRowsByGroup).length && tf === '6M') {
        return;
      }

      try {
        const stale = sessionStorage.getItem(storageKey);
        if (stale) {
          const parsed = JSON.parse(stale);
          if (parsed?.byKey && !cancel) setRowsByGroup(rowsByGroupFromByKey(parsed.byKey));
        }
      } catch {
        /* ignore */
      }

      try {
        const payload = await fetchMarketRailSnapshotQuery(
          { timeframe: tf, series: RAIL_SNAPSHOT_SERIES },
          { staleTime: refreshMs > 0 ? Math.max(refreshMs, 30_000) : MARKET_STALE.railSnapshot }
        );
        logMarketApi('market-rail-snapshot ← response', {
          success: payload?.success,
          keys: payload?.byKey ? Object.keys(payload.byKey).length : 0
        });
        if (cancel) return;
        if (!payload?.success) {
          throw new Error(payload?.error || 'Failed loading market snapshot');
        }
        const byKey = payload.byKey || {};
        setRowsByGroup(rowsByGroupFromByKey(byKey));
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ byKey, ts: Date.now() }));
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!cancel && !isAbortError(e)) {
          console.error('[market-rail-snapshot]', e);
        }
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [timeframe, refreshMs, initialRowsByGroup]);

return (
    <aside className="mkt-left">
      {LEFT_GROUPS.map((g) => (
        <section key={g.id} className="mkt-mini-card">
          <header className="mkt-mini-card__head">
            <span className={MKT_ASIDE_TITLE_CLASS}>
              <MktAsideTitleText text={g.title} />
              <span
                className={'mkt-mini-card__tf' + (String(timeframe).toUpperCase() === '10Y' ? ' mkt-mini-card__tf--10y' : '')}
                title="Same date range as the performance chart"
              >
                {timeframe}
              </span>
            </span>
            <span className="mkt-mini-card__head-actions">
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onSelectGroupAll(g.id)}>
                All
              </button>
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onClearGroup(g.id)}>
                None
              </button>
            </span>
          </header>
          <div className="mkt-mini-card__subhead" title="Last close and total move over the chart timeframe">
            <span>M</span>
            <span>Name</span>
            <span>Ticker</span>
            <span>Last</span>
            <span>Δ</span>
            <span>%</span>
          </div>
          {g.id === 'other'
            ? otherMarketSubsections().map((sub) => (
                <div key={sub.id} className="mkt-mini-card__subsection">
                  <header className="mkt-mini-card__subsection-head">
                    <span className={MKT_ASIDE_TITLE_CLASS}>
                      <MktAsideTitleText text={sub.title} />
                      <span
                        className={
                          'mkt-mini-card__tf' + (String(timeframe).toUpperCase() === '10Y' ? ' mkt-mini-card__tf--10y' : '')
                        }
                        title="Same date range as the performance chart"
                      >
                        {timeframe}
                      </span>
                    </span>
                    <span className="mkt-mini-card__head-actions">
                      <button
                        type="button"
                        className="mkt-mini-card__tiny-btn"
                        onClick={() => onSelectSubsectionAll(sub.id)}
                      >
                        All
                      </button>
                      <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onClearSubsection(sub.id)}>
                        None
                      </button>
                    </span>
                  </header>
                  {sub.rows.map((r) => (
                    <MarketMiniCardRow
                      key={r.key}
                      row={r}
                      groupId={g.id}
                      snapshot={rowsByGroup[g.id]?.[r.key]}
                      selectedKeys={selectedKeys}
                      onToggleSeries={onToggleSeries}
                    />
                  ))}
                </div>
              ))
            : groupRows(g.id).map((r) => (
                <MarketMiniCardRow
                  key={r.key}
                  row={r}
                  groupId={g.id}
                  snapshot={rowsByGroup[g.id]?.[r.key]}
                  selectedKeys={selectedKeys}
                  onToggleSeries={onToggleSeries}
                />
              ))}
        </section>
      ))}
    </aside>
  );
}

const SUMMARY_RETURNS_DEFS = [
  { key: 'SPX', label: 'S&P 500' },
  { key: 'DJI', label: 'Dow Jones' },
  { key: 'NDX', label: 'Nasdaq-100' },
  { key: 'XLK', label: 'Technology' },
  { key: 'XLE', label: 'Energy' },
  { key: 'XLV', label: 'Healthcare' },
  { key: 'XLI', label: 'Industrials' }
];

function SummaryReturnsCard({ refreshMs = 0, initialVals = null }) {
  const [vals, setVals] = useState(() => initialVals || {});
  const [loading, setLoading] = useState(() => !initialVals || !Object.keys(initialVals).length);
  const [error, setError] = useState('');
  const defs = SUMMARY_RETURNS_DEFS;
  const summaryTickers = useMemo(() => uniqueMarketSummaryTickers(defs), []);

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchMarketData()) return;
      if (initialVals && Object.keys(initialVals).length) return;
      if (!summaryTickers.length) return;
      setLoading(true);
      setError('');
      try {
        const payload = await fetchMarketTickerReturnsBatch(summaryTickers, refreshMs);
        logMarketApi('summary-returns ← response', { payload, tickerCount: summaryTickers.length });
        if (cancel) return;
        setVals(buildValsFromBatch(payload, defs));
      } catch (e) {
        if (!cancel) setError(e.message || 'Failed loading summary');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [defs, refreshMs, summaryTickers, initialVals]);

  return (
    <MarketReturnsSummaryTable
      title="Index & sector returns"
      defs={defs}
      vals={vals}
      loading={loading}
      error={error}
      showInfoTip
    />
  );
}

/** Thumbnail index (not SP500). Same strings as `MarketHeatmapPage` INDEX_MENU `apiIndex`. */
const HEATMAP_THUMB_INDEX = 'Dow Jones';

function MarketHeatmapThumbnail({ refreshMs = 0, initialRows = null }) {
  const [rows, setRows] = useState(() => dedupeTickerDetailRows(initialRows || []));
  const [loading, setLoading] = useState(() => !initialRows?.length);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchMarketData()) {
        setError('Unable to load heatmap.');
        setRows([]);
        return;
      }
      if (initialRows?.length) return;
      setLoading(true);
      setError('');
      try {
        const payload = await fetchTickerDetailsQuery(
          { index: HEATMAP_THUMB_INDEX, period: 'last-date' },
          { staleTime: 3 * 60 * 1000 }
        );
        logMarketApi('heatmap-ticker-details ← response', {
          rows: Array.isArray(payload?.data) ? payload.data.length : 0
        });
        if (cancel) return;
        const list = dedupeTickerDetailRows(Array.isArray(payload?.data) ? payload.data : []);
        setRows(list);
        if (!list.length) setError('No heatmap rows for this index.');
      } catch (e) {
        if (!cancel) {
          setError(e.message || 'Failed to load heatmap');
          setRows([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshMs, initialRows]);

  return (
    <section className="mkt-heat-thumb-card mkt-heat-thumb-card--figma">
      <header className="mkt-heat-thumb-card__head mkt-heat-thumb-card__head--figma">
        <div className="flex items-center gap-2">
          <Link
            to="/heatmap"
            className={`${MKT_ASIDE_TITLE_CLASS} mkt-heat-thumb-card__title-link`}
            title="Open full heatmap"
          >
            Stock Market Heatmap
          </Link>
          <ChartInfoTip tip={CHART_INFO_TIPS.marketHeatmapThumb} align="end" />
        </div>
      </header>
      <div className="mkt-treemap-thumb-host mkt-treemap-thumb-host--figma" aria-busy={loading}>
        <Link
          to="/heatmap"
          className="mkt-treemap-thumb-host__link"
          aria-label={'Open full heatmap for ' + HEATMAP_THUMB_INDEX}
        >
          {error ? <div className="mkt-treemap-thumb-host__err">{error}</div> : null}
          {!error && rows.length > 0 ? (
            <SectorTreemap
              rows={rows}
              scaleMin={-3}
              scaleMax={3}
              highlightSymbol=""
              disableTooltip
              titleCaseGroupLabels
            />
          ) : !error && !loading ? (
            <div className="mkt-treemap-thumb-host__empty">No data</div>
          ) : null}
          {loading && !rows.length ? (
            <div className="mkt-treemap-thumb-host__loading" role="status" aria-live="polite">
              <TradingChartLoader label="Loading heatmap…" sublabel={HEATMAP_THUMB_INDEX} />
            </div>
          ) : null}
        </Link>
      </div>
    </section>
  );
}

const WATCHLIST_INDEX_OPTIONS = [
  { id: 'dow-jones', label: 'Dow Jones', apiIndex: 'Dow Jones' },
  { id: 'sp500', label: 'S&P 500', apiIndex: 'sp500' },
  { id: 'nasdaq-100', label: 'Nasdaq 100', apiIndex: 'Nasdaq 100' }
];

function watchRowSymbolUpper(r) {
  return tickerRowSymbol(r);
}

function watchRowLastNum(r) {
  const n = Number(r.price ?? r.close);
  return Number.isFinite(n) ? n : NaN;
}

function watchRowPctNum(r) {
  const rawPct = Number(r.totalReturnPercentage);
  const fallbackPct = Number(r.change_pct);
  return Number.isFinite(rawPct) ? rawPct : Number.isFinite(fallbackPct) ? fallbackPct * 100 : NaN;
}

function RightWatchlistCard({ refreshMs = 0, initialRows = null }) {
  const [selectedIndexId, setSelectedIndexId] = useState('dow-jones');
  const [rows, setRows] = useState(() => dedupeTickerDetailRows(initialRows || []));
  const [loading, setLoading] = useState(() => !initialRows?.length);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'security', dir: 'asc' });

  const selectedIndex = useMemo(
    () => WATCHLIST_INDEX_OPTIONS.find((opt) => opt.id === selectedIndexId) || WATCHLIST_INDEX_OPTIONS[0],
    [selectedIndexId]
  );

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchMarketData()) {
        setRows([]);
        setError('Unable to load tickers.');
        return;
      }
      if (initialRows?.length && selectedIndex.apiIndex === 'Dow Jones') return;
      setLoading(true);
      setError('');
      try {
        const payload = await fetchTickerDetailsQuery(
          { index: selectedIndex.apiIndex, period: 'last-date' },
          { staleTime: 2 * 60 * 1000 }
        );
        logMarketApi('watchlist-ticker-details ← response', {
          index: selectedIndex.apiIndex,
          rows: Array.isArray(payload?.data) ? payload.data.length : 0
        });
        if (cancel) return;
        const list = dedupeTickerDetailRows(Array.isArray(payload?.data) ? payload.data : []);
        setRows(list);
        if (!list.length) setError('No rows for selected index.');
      } catch (e) {
        if (!cancel) {
          setRows([]);
          setError(e.message || 'Failed loading tickers');
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshMs, selectedIndex.apiIndex, initialRows]);

  useEffect(() => {
    setSort({ key: 'security', dir: 'asc' });
  }, [selectedIndexId]);

  const sortedRows = useMemo(() => {
    const list = dedupeTickerDetailRows(rows);
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    const tie = (a, b) => watchRowSymbolUpper(a).localeCompare(watchRowSymbolUpper(b), undefined, { sensitivity: 'base' });
    list.sort((a, b) => {
      if (sort.key === 'security') {
        return dirMul * watchRowSymbolUpper(a).localeCompare(watchRowSymbolUpper(b), undefined, { sensitivity: 'base' });
      }
      if (sort.key === 'last') {
        const na = watchRowLastNum(a);
        const nb = watchRowLastNum(b);
        const aNa = !Number.isFinite(na);
        const bNa = !Number.isFinite(nb);
        if (aNa && bNa) return tie(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (na - nb);
        return c !== 0 ? c : tie(a, b);
      }
      if (sort.key === 'pct') {
        const pa = watchRowPctNum(a);
        const pb = watchRowPctNum(b);
        const aNa = !Number.isFinite(pa);
        const bNa = !Number.isFinite(pb);
        if (aNa && bNa) return tie(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (pa - pb);
        return c !== 0 ? c : tie(a, b);
      }
      return tie(a, b);
    });
    return list;
  }, [rows, sort]);

  const onWatchSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  }, []);

  const watchSortGlyph = (key) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕');

  const watchSortIcoClass = (key) =>
    'mkt-watch-card__sort-ico' +
    (sort.key === key ? ' mkt-watch-card__sort-ico--active' : ' mkt-watch-card__sort-ico--idle');

  const ariaSortFor = (key) => {
    if (sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <aside className="mkt-right">
      <section className="mkt-watch-card">
        <header className="mkt-watch-card__head">
          <span className={MKT_ASIDE_TITLE_CLASS}>Tickers List</span>
          <div className="mkt-watch-card__controls">
            <ThemedDropdown
              className="mkt-watch-card__dd"
              size="sm"
              wideLabel
              value={selectedIndexId}
              options={WATCHLIST_INDEX_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label }))}
              onChange={setSelectedIndexId}
              title="Index selection"
              ariaLabelPrefix="Index"
            />
          </div>
        </header>
        <div className="mkt-watch-card__table">
          <div className="mkt-watch-card__row mkt-watch-card__row--head" role="row">
            <button
              type="button"
              className="mkt-watch-card__th"
              onClick={() => onWatchSort('security')}
              aria-sort={ariaSortFor('security')}
              title="Sort by security name"
            >
              Security
              <span className={watchSortIcoClass('security')} aria-hidden>
                {watchSortGlyph('security')}
              </span>
            </button>
            <button
              type="button"
              className="mkt-watch-card__th mkt-watch-card__th--num"
              onClick={() => onWatchSort('last')}
              aria-sort={ariaSortFor('last')}
              title="Sort by last price"
            >
              Last
              <span className={watchSortIcoClass('last')} aria-hidden>
                {watchSortGlyph('last')}
              </span>
            </button>
            <button
              type="button"
              className="mkt-watch-card__th mkt-watch-card__th--num"
              onClick={() => onWatchSort('pct')}
              aria-sort={ariaSortFor('pct')}
              title="Sort by 1 day percent change"
            >
              1D%
              <span className={watchSortIcoClass('pct')} aria-hidden>
                {watchSortGlyph('pct')}
              </span>
            </button>
          </div>
          {loading && !rows.length ? (
            <div className="mkt-panel-status">Loading…</div>
          ) : null}
          {!loading && error ? (
            <div className="mkt-panel-status mkt-panel-status--err">{error}</div>
          ) : null}
          {!loading && !error && !rows.length ? (
            <div className="mkt-panel-status">No data</div>
          ) : null}
          {!error &&
            sortedRows.map((r, idx) => {
              const symbol = watchRowSymbolUpper(r);
              const last = watchRowLastNum(r);
              const pct = watchRowPctNum(r);
              return (
                <Link to={'/ticker/' + encodeURIComponent(symbol)} className="mkt-watch-card__row" key={`${symbol}-${idx}`}>
                  <span>{symbol || '—'}</span>
                  <span>{fmtPrice(last)}</span>
                  <span className={pct > 0 ? 'app-num--up' : pct < 0 ? 'app-num--down' : ''}>
                    {fmtPct(pct, { plainPositive: true })}
                  </span>
                </Link>
              );
            })}
        </div>
      </section>
    </aside>
  );
}

export { MarketPageFigmaShellSkeleton } from './MarketPageFigmaShellSkeleton.jsx';

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').MarketDashboardInitialData | null} [props.initialMarketData]
 */
export function MarketPageFigmaShell({ initialMarketData = null }) {
  const { isDockOpen } = useRightRailDock();
  const dockLayoutReadyRef = useRef(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  const initialRowsByGroup = useMemo(() => {
    if (!initialMarketData?.railSnapshot) return null;
    return rowsByGroupFromByKey(initialMarketData.railSnapshot);
  }, [initialMarketData]);

  useEffect(() => {
    logMarketApi('mount', {
      canFetchMarketData: canFetchMarketData(),
      isAuthDisabled: isAuthDisabled(),
      hasAuthToken: Boolean(getAuthToken()),
      hasSsrData: Boolean(initialMarketData)
    });
  }, [initialMarketData]);

  useEffect(() => {
    if (!dockLayoutReadyRef.current) {
      dockLayoutReadyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => notifyChartFullscreenLayout(), 80);
    return () => window.clearTimeout(t);
  }, [isDockOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const [selectedSeries, setSelectedSeries] = useState(DEFAULT_SELECTED_KEYS);
  const [timeframe, setTimeframe] = useState('6M');
  const [axisMode, setAxisMode] = useState('auto');
  const [refreshMode, setRefreshMode] = useState(null);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.selected);
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed) && parsed.length) {
        setSelectedSeries(parsed);
      }
      const savedTf = localStorage.getItem(LS_KEYS.tf);
      if (savedTf) setTimeframe(savedTf);
      const savedAxis = localStorage.getItem(LS_KEYS.axis);
      if (savedAxis) setAxisMode(savedAxis);
      const savedRefresh = localStorage.getItem(LS_KEYS.refresh);
      if (savedRefresh != null) setRefreshMode(savedRefresh);
    } catch {
      /* ignore */
    }
    setPrefsHydrated(true);
  }, []);
  const refreshMs = REFRESH_MAP[refreshMode] ?? 0;
  const ohlcCacheRef = useRef(new Map());

  const loadOhlcRows = useCallback(async (ticker, startDate, endDate) => {
    const key = `${String(ticker).toUpperCase()}|${startDate}|${endDate}`;
    const now = Date.now();
    const hit = ohlcCacheRef.current.get(key);
    if (hit && now - hit.ts < Math.max(1000, refreshMs)) return hit.rows;
    const body = { ticker, start_date: startDate, end_date: endDate };
    const { res, payload } = await logFetchWithAuth('ohlc-signals-indicator', '/api/market/ohlc-signals-indicator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || `Failed loading ${ticker}`);
    }
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    ohlcCacheRef.current.set(key, { ts: now, rows });
    return rows;
  }, [refreshMs]);

  useEffect(() => {
    ohlcCacheRef.current.clear();
  }, [refreshMs, timeframe]);

  const onToggleSeries = (seriesKey) => {
    setSelectedSeries((prev) => {
      if (prev.includes(seriesKey)) return prev.length <= 1 ? prev : prev.filter((k) => k !== seriesKey);
      return [...prev, seriesKey];
    });
  };
  const onSelectGroupAll = (groupId) => {
    const groupKeys = groupRows(groupId).map((s) => s.key);
    setSelectedSeries((prev) => Array.from(new Set([...prev, ...groupKeys])));
  };
  const onClearGroup = (groupId) => {
    const groupKeys = new Set(groupRows(groupId).map((s) => s.key));
    setSelectedSeries((prev) => {
      const next = prev.filter((k) => !groupKeys.has(k));
      return next.length ? next : prev;
    });
  };
  const onSelectSubsectionAll = (subsectionId) => {
    const keys = groupRows('other')
      .filter((s) => s.subsection === subsectionId)
      .map((s) => s.key);
    setSelectedSeries((prev) => Array.from(new Set([...prev, ...keys])));
  };
  const onClearSubsection = (subsectionId) => {
    const subsectionKeys = new Set(
      groupRows('other')
        .filter((s) => s.subsection === subsectionId)
        .map((s) => s.key)
    );
    setSelectedSeries((prev) => {
      const next = prev.filter((k) => !subsectionKeys.has(k));
      return next.length ? next : prev;
    });
  };

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      localStorage.setItem(LS_KEYS.selected, JSON.stringify(selectedSeries));
    } catch {
      /* ignore */
    }
  }, [selectedSeries, prefsHydrated]);
  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      localStorage.setItem(LS_KEYS.tf, timeframe);
      localStorage.setItem(LS_KEYS.axis, axisMode);
      localStorage.setItem(LS_KEYS.refresh, refreshMode);
    } catch {
      /* ignore */
    }
  }, [timeframe, axisMode, refreshMode, prefsHydrated]);

  const normalizedPerformanceChart = (
    <NormalizedPerformanceCard
      selectedKeys={selectedSeries}
      onSelectedKeysChange={setSelectedSeries}
      timeframe={timeframe}
      onTimeframeChange={setTimeframe}
      axisMode={axisMode}
      refreshMs={refreshMs}
      loadSeriesRows={loadOhlcRows}
    />
  );

  return (
    <section className={'mkt-fig-shell' + (isDockOpen ? ' mkt-fig-shell--watchlist-dock-open' : '')}>
      {isMobileLayout ? normalizedPerformanceChart : null}
      <LeftSnapshotStack
        selectedKeys={selectedSeries}
        onToggleSeries={onToggleSeries}
        onSelectGroupAll={onSelectGroupAll}
        onClearGroup={onClearGroup}
        onSelectSubsectionAll={onSelectSubsectionAll}
        onClearSubsection={onClearSubsection}
        timeframe={timeframe}
        refreshMs={refreshMs}
        initialRowsByGroup={initialRowsByGroup}
      />
      <main className="mkt-center">
        {/* <div className="mkt-options">
          <label className="mkt-options__item">
            <span>Refresh</span>
            <ThemedDropdown
              className="mkt-options__dd"
              size="sm"
              wideLabel
              value={refreshMode}
              options={[
                { id: 'manual', label: 'Manual' },
                { id: '15s', label: '15s' },
                { id: '30s', label: '30s' },
                { id: '60s', label: '60s' }
              ]}
              onChange={setRefreshMode}
              title="Refresh interval"
              ariaLabelPrefix="Refresh"
            />
          </label>
          <label className="mkt-options__item">
            <span>Axis</span>
            <ThemedDropdown
              className="mkt-options__dd"
              size="sm"
              wideLabel
              value={axisMode}
              options={[
                { id: 'auto', label: 'Auto' },
                { id: 'fixed10', label: 'Fixed ±10%' },
                { id: 'fixed20', label: 'Fixed ±20%' }
              ]}
              onChange={setAxisMode}
              title="Chart axis mode"
              ariaLabelPrefix="Axis"
            />
          </label>
        </div> */}
        {!isMobileLayout ? normalizedPerformanceChart : null}
        <div className="mkt-center-bottom">
          <SummaryReturnsCard
            refreshMs={refreshMs}
            initialVals={initialMarketData?.summaryReturns}
          />
          <MarketHeatmapThumbnail
            refreshMs={refreshMs}
            initialRows={initialMarketData?.heatmapThumb}
          />
        </div>
      </main>
      {!isDockOpen ? (
        <RightWatchlistCard refreshMs={refreshMs} initialRows={initialMarketData?.watchlistRows} />
      ) : null}
    </section>
  );
}

