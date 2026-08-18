'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { NormalizedPerformanceCard } from '../../components/NormalizedPerformanceCard.jsx';
import { fetchWithAuth, canFetchMarketData } from '../../store/apiStore.js';
import { apiUrl } from '../../utils/apiOrigin.js';
import { fetchMarketRailSnapshotQuery } from '../../query/marketQueries.js';
import { MARKET_STALE } from '../../query/queryClient.js';
import { fmtAbsSigned, fmtPct, fmtPrice } from '../../utils/marketCalculations.js';
import { useAiEngineLeaders, usePortfolioHistoryCache } from '../../hooks/useAiEngineLeaders.js';
import {
  ENGINE_SECTIONS,
  baselineLabel,
  buildChartRegistry,
  buildEngineSeries,
  buildIndexSeries,
  commonBaselineMs,
  dedupeSeriesSymbols,
  indexKey,
  isPortfolioKey,
  keyTarget
} from '../../utils/aiCompareSeries.js';
import '../../styles/paper-trading.css';

const TOP_PER_ENGINE = 5;

/** Beyond this the chart is unreadable spaghetti, so further toggles are refused. */
const MAX_SELECTED = 8;

const DEFAULT_KEYS = [indexKey('SPX')];

/** Lead-in before the baseline so a holiday/weekend publish date still has a prior close. */
const BASELINE_LEAD_IN_MS = 7 * 24 * 60 * 60 * 1000;

/** Only reached with nothing but indices selected — there is no portfolio to derive a start from. */
const INDEX_ONLY_TIMEFRAME = '6M';

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

/** Matches the left-aside `mkt-mini-card` header typography on /market. */
const MKT_ASIDE_TITLE_CLASS = 'uppercase text-[12px] font-medium leading-[1.1]';

/**
 * Rail numerics. A $110,822.13 equity is three glyphs wider than the index levels the market
 * rail's columns were sized for, which pushed Last and Δ into each other. Cents are noise at
 * six figures, so they are dropped above 1,000 and kept below it.
 */
function railValue(v, { signed = false } = {}) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  const decimals = Math.abs(n) >= 1000 ? 0 : 2;
  return signed ? fmtAbsSigned(n, { decimals }) : fmtPrice(n, { decimals });
}

/**
 * One rail row, in the exact six-column `mkt-mini-card__row` grid /market uses:
 * checkbox · name · ticker · last · Δ · %.
 *
 * The two row kinds fill those columns from different sources — an index from its OHLC
 * snapshot, a portfolio from its own equity/return — so both read identically in the rail.
 */
function CompareRailRow({ series, snapshot, selected, disabled, showTicker, onToggle }) {
  const isPortfolio = series.kind === 'portfolio';
  const last = isPortfolio ? series.equity : snapshot?.close;
  const chg = isPortfolio ? series.totalReturn : snapshot?.chg;
  const chgPct = isPortfolio ? series.totalReturnPct : snapshot?.chgPct;
  const up = Number(chgPct) > 0;
  const down = Number(chgPct) < 0;
  const has = last != null && Number.isFinite(Number(last));

  const to = isPortfolio
    ? `/virtual-portfolio/public/${encodeURIComponent(series.accountId)}`
    : series.indexRouteSlug
      ? `/indices/${encodeURIComponent(series.indexRouteSlug)}`
      : '';

  return (
    <div className="mkt-mini-card__row">
      <label className="mkt-mini-card__check-label" style={{ ['--mkt-check-accent']: series.color }}>
        <input
          type="checkbox"
          className="mkt-mini-card__check"
          checked={selected}
          disabled={disabled && !selected}
          onChange={() => onToggle(series.key)}
          aria-label={`Show ${series.label} in chart`}
        />
      </label>
      {to ? (
        <Link className="mkt-mini-card__name mkt-mini-card__name--link" to={to} title={series.label}>
          {series.label}
        </Link>
      ) : (
        <span className="mkt-mini-card__name" title={series.label}>
          {series.label}
        </span>
      )}
      {showTicker ? (
        <span className="mkt-mini-card__ticker" title={series.label}>
          {series.symbol || '—'}
        </span>
      ) : null}
      <span>{has ? railValue(last) : '—'}</span>
      <span className={up ? 'is-up' : down ? 'is-down' : ''}>{railValue(chg, { signed: true })}</span>
      <span className={up ? 'is-up' : down ? 'is-down' : ''}>
        {chgPct != null && Number.isFinite(Number(chgPct)) ? fmtPct(chgPct) : '—'}
      </span>
    </div>
  );
}

/**
 * `showTicker` is on for Indices (DJI/SPX/NDX are meaningful symbols) and off for the engine
 * cards, where the "ticker" is only an abbreviation of the portfolio name — the name column
 * beside it already says the same thing, and dropping it gives that name 34px more room.
 */
function RailCard({
  title,
  badge,
  series,
  snapshots,
  selectedSet,
  atCap,
  showTicker = true,
  onToggle,
  onAll,
  onNone,
  emptyText
}) {
  return (
    <section className={'mkt-mini-card' + (showTicker ? '' : ' ai-cmp-card--no-ticker')}>
      <header className="mkt-mini-card__head">
        <span className={MKT_ASIDE_TITLE_CLASS}>
          {title}
          {badge ? (
            <span className="mkt-mini-card__tf" title="Same date range as the performance chart">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mkt-mini-card__head-actions">
          <button type="button" className="mkt-mini-card__tiny-btn" onClick={onAll} disabled={!series.length}>
            All
          </button>
          <button type="button" className="mkt-mini-card__tiny-btn" onClick={onNone} disabled={!series.length}>
            None
          </button>
        </span>
      </header>
      <div className="mkt-mini-card__subhead" title="Latest value and total move over the chart window">
        <span>M</span>
        <span>Name</span>
        {showTicker ? <span>Ticker</span> : null}
        <span>Last</span>
        <span>Δ</span>
        <span>%</span>
      </div>
      {series.length ? (
        series.map((s) => (
          <CompareRailRow
            key={s.key}
            series={s}
            snapshot={snapshots?.[s.key]}
            selected={selectedSet.has(s.key)}
            disabled={atCap}
            showTicker={showTicker}
            onToggle={onToggle}
          />
        ))
      ) : (
        <p className="ai-cmp-card__empty">{emptyText}</p>
      )}
    </section>
  );
}

export default function AiPortfolioComparePage() {
  const { byEngine, total, loading } = useAiEngineLeaders({ limit: TOP_PER_ENGINE });
  const loadPortfolioHistory = usePortfolioHistoryCache();

  const [selectedKeys, setSelectedKeys] = useState(DEFAULT_KEYS);

  // Badges are deduped once across the whole set — indices included, so a portfolio can never
  // shadow SPX — then the rail slices are read back out of the deduped list. Doing it per
  // section would let the same badge appear in two cards.
  const allSeries = useMemo(
    () =>
      dedupeSeriesSymbols([
        ...buildIndexSeries(),
        ...ENGINE_SECTIONS.flatMap((e) => buildEngineSeries(e.id, byEngine[e.id] || []))
      ]),
    [byEngine]
  );

  const indexSeries = useMemo(() => allSeries.filter((s) => s.kind === 'index'), [allSeries]);
  const engineSeries = useMemo(
    () =>
      Object.fromEntries(
        ENGINE_SECTIONS.map((e) => [e.id, allSeries.filter((s) => s.engineId === e.id)])
      ),
    [allSeries]
  );

  const { metaByKey, tickerByKey } = useMemo(() => buildChartRegistry(allSeries), [allSeries]);

  // Every series is measured from the youngest selected portfolio's publish date, so a book
  // running two weeks is never compared against six months of an index.
  const baselineMs = useMemo(() => commonBaselineMs(selectedKeys, metaByKey), [selectedKeys, metaByKey]);

  /**
   * The window is derived, not chosen — hence no timeframe buttons on this page. It has to
   * start at or before the baseline: if the fetch began after it, an index would be truncated
   * at the window start and rebased there while the portfolio rebased at its own inception,
   * which is exactly the mismatch the baseline exists to remove. A few days of lead-in cover
   * the case where the baseline date itself was a market holiday.
   */
  const range = useMemo(() => {
    if (!Number.isFinite(baselineMs)) return null;
    const start = new Date(baselineMs - BASELINE_LEAD_IN_MS);
    return { start: isoDay(start), end: isoDay(new Date()) };
  }, [baselineMs]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const atCap = selectedKeys.length >= MAX_SELECTED;

  /**
   * Last / Δ / % for the index rows, from the same endpoint the /market rail uses so the two
   * pages can't disagree on a number. Portfolio rows already carry theirs on the list payload.
   */
  const [indexSnapshots, setIndexSnapshots] = useState({});
  useEffect(() => {
    if (!canFetchMarketData()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchMarketRailSnapshotQuery(
          {
            timeframe: INDEX_ONLY_TIMEFRAME,
            series: indexSeries.map((s) => ({ key: keyTarget(s.key), ticker: s.target }))
          },
          { staleTime: MARKET_STALE.railSnapshot }
        );
        if (cancelled || !payload?.success) return;
        const byKey = payload.byKey || {};
        // Re-namespace back onto `idx:*` so the rail can look snapshots up by series key.
        setIndexSnapshots(
          Object.fromEntries(indexSeries.map((s) => [s.key, byKey[keyTarget(s.key)]]).filter(([, v]) => v))
        );
      } catch {
        /* rail figures are supplementary — the chart still renders without them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indexSeries]);

  const onToggle = useCallback((key) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, key];
    });
  }, []);

  /**
   * One loader for both kinds of series: portfolio keys resolve to the public equity-curve
   * endpoint (already reshaped to OHLC rows by the cache), index keys to the market OHLC route.
   */
  const loadSeriesRows = useCallback(
    async (target, startDate, endDate, key) => {
      if (isPortfolioKey(key)) return loadPortfolioHistory(keyTarget(key));
      const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: target, start_date: startDate, end_date: endDate })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) throw new Error(payload?.error || `Failed loading ${target}`);
      return Array.isArray(payload.data) ? payload.data : [];
    },
    [loadPortfolioHistory]
  );

  /** "All" on a card — adds that card's rows up to the selection cap. */
  const selectAllIn = useCallback(
    (rows) =>
      setSelectedKeys((prev) => {
        const next = [...prev];
        for (const s of rows) {
          if (!next.includes(s.key) && next.length < MAX_SELECTED) next.push(s.key);
        }
        return next;
      }),
    []
  );

  /** "None" on a card — clears just that card's rows, leaving other cards' picks alone. */
  const clearAllIn = useCallback(
    (rows) =>
      setSelectedKeys((prev) => {
        const drop = new Set(rows.map((s) => s.key));
        return prev.filter((k) => !drop.has(k));
      }),
    []
  );

  const compareBestOfEach = () => {
    const picks = ENGINE_SECTIONS.map((e) => (engineSeries[e.id] || [])[0]).filter(Boolean);
    setSelectedKeys([indexKey('SPX'), ...picks.map((p) => p.key)].slice(0, MAX_SELECTED));
  };

  const selectedPortfolioCount = selectedKeys.filter((k) => isPortfolioKey(k)).length;

  return (
    <div className="paper-page odin-content-page">
      <header className="paper-header">
        <div>
          <h1 className="paper-header__title">Compare AI Portfolios</h1>
          <p className="paper-header__sub">
            Put the top-performing books from each AI model on one chart, against the indices they
            trade. Every line is rebased to a common start date, so portfolios of different ages are
            measured over the same window.
          </p>
        </div>
        <div className="paper-header__actions">
          <button type="button" className="paper-btn paper-btn--ghost" onClick={compareBestOfEach} disabled={!total}>
            Compare best of each
          </button>
          <Link to="/virtual-portfolio/ai" className="paper-btn paper-btn--ghost">
            AI Portfolios
          </Link>
        </div>
      </header>

      {/* Same shell/rail/centre structure and classes as /market, so both pages share one
          visual language — see .mkt-fig-shell and .mkt-left in index.css. */}
      <div className="mkt-fig-shell mkt-fig-shell--watchlist-dock-open ai-cmp-shell">
        <aside className="mkt-left" aria-label="Series selection">
          <RailCard
            title="Indices"
            badge={INDEX_ONLY_TIMEFRAME}
            series={indexSeries}
            snapshots={indexSnapshots}
            selectedSet={selectedSet}
            atCap={atCap}
            onToggle={onToggle}
            onAll={() => selectAllIn(indexSeries)}
            onNone={() => clearAllIn(indexSeries)}
            emptyText="No indices available."
          />

          {ENGINE_SECTIONS.map((engine) => {
            const series = engineSeries[engine.id] || [];
            return (
              <RailCard
                key={engine.id}
                title={engine.label}
                badge={series.length ? `TOP ${series.length}` : ''}
                series={series}
                selectedSet={selectedSet}
                atCap={atCap}
                showTicker={false}
                onToggle={onToggle}
                onAll={() => selectAllIn(series)}
                onNone={() => clearAllIn(series)}
                emptyText={loading ? 'Loading…' : `No published ${engine.label} portfolios yet.`}
              />
            );
          })}
        </aside>

        <main className="mkt-center ai-cmp-main">
          <NormalizedPerformanceCard
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            timeframe={INDEX_ONLY_TIMEFRAME}
            loadSeriesRows={loadSeriesRows}
            metaByKey={metaByKey}
            tickerByKey={tickerByKey}
            defaultKeys={DEFAULT_KEYS}
            baselineMs={baselineMs}
            range={range}
            showTimeframes={false}
            emptyHint="Pick an index or a portfolio from the left to start comparing."
          />

          <p className="ai-cmp-note">
            {baselineMs ? (
              <>
                Rebased to <strong>{baselineLabel(baselineMs)}</strong> — the publish date of the
                youngest portfolio selected. Every line shows its return since that date, so the
                comparison covers a window all {selectedPortfolioCount + 1} series share.
              </>
            ) : (
              <>
                Showing index performance over the selected timeframe. Add a portfolio and every
                line rebases to its publish date so the spans stay comparable.
              </>
            )}{' '}
            Simulated paper trading — not investment advice.
          </p>
        </main>
      </div>
    </div>
  );
}
