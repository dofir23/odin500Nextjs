'use client';
import { useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { META_BY_KEY } from './marketSeriesRegistry.js';
import { fmtPct } from '../utils/formatDisplayNumber.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { MARKET_SUMMARY_TFS } from '../utils/marketReturnsTable.js';
import { FigmaPagination } from './FigmaPagination.jsx';

function sectionSlug(title) {
  return String(title || 'section').replace(/\s+/g, '-');
}

function SortHeaderIcon({ active, dir }) {
  if (!active) {
    return (
      <svg className="mkt-returns-summary__sort-icon mkt-returns-summary__sort-icon--neutral" width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
        <path d="M5.5 1.5L8.25 4.25H2.75L5.5 1.5Z" fill="currentColor" opacity="0.45" />
        <path d="M5.5 10.5L2.75 7.75H8.25L5.5 10.5Z" fill="currentColor" opacity="0.45" />
      </svg>
    );
  }
  if (dir === 'asc') {
    return (
      <svg className="mkt-returns-summary__sort-icon mkt-returns-summary__sort-icon--active" width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
        <path d="M5.5 2.5L9 7H2L5.5 2.5Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="mkt-returns-summary__sort-icon mkt-returns-summary__sort-icon--active" width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
      <path d="M5.5 9.5L2 5H9L5.5 9.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Multi-period returns grid (same layout as market page “Index & sector returns”).
 * @param {{
 *   title: string,
 *   defs: Array<{ key: string, label: string, ticker?: string }>,
 *   vals?: Record<string, Record<string, number | undefined>>,
 *   loading?: boolean,
 *   error?: string,
 *   showInfoTip?: boolean,
 *   className?: string,
 *   titleCount?: number | null,
 *   page?: number,
 *   totalPages?: number,
 *   onPageChange?: (page) => void,
 * }} props
 */
export function MarketReturnsSummaryTable({
  title,
  defs,
  vals = {},
  loading = false,
  error = '',
  showInfoTip = false,
  className = '',
  titleCount = null,
  page = 1,
  totalPages = 1,
  onPageChange = null
}) {
  const tfs = MARKET_SUMMARY_TFS;
  const tfCount = tfs.length;
  const slug = sectionSlug(title);
  const showPager = totalPages > 1 && typeof onPageChange === 'function';
  const [sortKey, setSortKey] = useState('market');
  const [sortDir, setSortDir] = useState('asc');

  const sortedDefs = useMemo(() => {
    const list = Array.isArray(defs) ? [...defs] : [];
    list.sort((a, b) => {
      if (sortKey === 'market') {
        const cmp = String(a?.label || '').localeCompare(String(b?.label || ''), undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = Number(vals?.[a?.key]?.[sortKey]);
      const bv = Number(vals?.[b?.key]?.[sortKey]);
      const aOk = Number.isFinite(av);
      const bOk = Number.isFinite(bv);
      if (!aOk && !bOk) return String(a?.label || '').localeCompare(String(b?.label || ''), undefined, { sensitivity: 'base' });
      if (!aOk) return 1;
      if (!bOk) return -1;
      const cmp = av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [defs, vals, sortKey, sortDir]);

  const onSortHeader = (nextKey) => {
    if (nextKey === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === 'market' ? 'asc' : 'desc');
  };

  return (
    <section
      className={'mkt-watch-card mkt-returns-summary return-table-page__section-card' + (className ? ` ${className}` : '')}
      style={{ '--mkt-summary-tf-count': tfCount }}
      aria-labelledby={`return-table-section-${slug}`}
    >
      <header className="mkt-watch-card__head mkt-returns-summary__head">
        <span
          id={`return-table-section-${slug}`}
          className="mkt-returns-summary__title-row"
        >
          {title}
          {titleCount != null ? (
            <span className="return-table-page__section-count" title="Symbols in this table">
              [{titleCount}]
            </span>
          ) : null}
          {showInfoTip ? <ChartInfoTip tip={CHART_INFO_TIPS.marketIndexReturns} align="start" /> : null}
        </span>
      </header>
      <div className="mkt-returns-summary__scroll">
        <div className="mkt-watch-card__table mkt-returns-summary__table" role="table">
          <div className="mkt-watch-card__row mkt-watch-card__row--head mkt-returns-summary__row" role="row">
            <span className="mkt-returns-summary__h" role="columnheader" aria-sort={sortKey === 'market' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button
                type="button"
                className={'mkt-returns-summary__sort-btn' + (sortKey === 'market' ? ' mkt-returns-summary__sort-btn--active' : '')}
                onClick={() => onSortHeader('market')}
                aria-label="Sort by market"
              >
                <span className="mkt-returns-summary__sort-label">Market</span>
                <SortHeaderIcon active={sortKey === 'market'} dir={sortDir} />
              </button>
            </span>
            {tfs.map((tf) => (
              <span
                key={tf.key}
                className="mkt-returns-summary__h mkt-returns-summary__h--num"
                role="columnheader"
                aria-sort={sortKey === tf.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className={'mkt-returns-summary__sort-btn mkt-returns-summary__sort-btn--num' + (sortKey === tf.key ? ' mkt-returns-summary__sort-btn--active' : '')}
                  onClick={() => onSortHeader(tf.key)}
                  aria-label={`Sort by ${tf.key}`}
                >
                  <span className="mkt-returns-summary__sort-label">{tf.key}</span>
                  <SortHeaderIcon active={sortKey === tf.key} dir={sortDir} />
                </button>
              </span>
            ))}
          </div>
          {sortedDefs.map((d) => {
            const meta = META_BY_KEY[d.key];
            const ticker = meta?.ticker || d.ticker;
            const routeSym = sanitizeTickerPageInput(ticker || d.key);
            const indexTo = meta?.indexRouteSlug ? `/indices/${encodeURIComponent(meta.indexRouteSlug)}` : '';
            const tickerTo =
              indexTo ||
              (routeSym && ticker
                ? `/ticker/${encodeURIComponent(routeSym)}?ticker=${encodeURIComponent(routeSym)}`
                : '');
            const rowTitle = indexTo ? `Open ${d.label} index page` : routeSym ? `Open ${routeSym}` : '';
            const cells = tfs.map((tf) => {
              const raw = vals?.[d.key]?.[tf.key];
              const v = Number(raw);
              const pending = loading && raw === undefined;
              const text = pending ? '…' : Number.isFinite(v) ? fmtPct(v, { plainPositive: true }) : '—';
              const tone =
                !pending && Number.isFinite(v) ? (v > 0 ? 'app-num--up' : v < 0 ? 'app-num--down' : '') : '';
              return (
                <span
                  key={tf.key}
                  className={'mkt-returns-summary__cell mkt-returns-summary__cell--num' + (tone ? ` ${tone}` : '')}
                >
                  {text}
                </span>
              );
            });
            if (tickerTo) {
              return (
                <Link
                  key={d.key}
                  to={tickerTo}
                  className="mkt-watch-card__row mkt-returns-summary__row"
                  title={rowTitle}
                  role="row"
                >
                  <span className="mkt-returns-summary__cell mkt-returns-summary__cell--label">{d.label}</span>
                  {cells}
                </Link>
              );
            }
            return (
              <div key={d.key} className="mkt-watch-card__row mkt-returns-summary__row" role="row">
                <span className="mkt-returns-summary__cell mkt-returns-summary__cell--label">{d.label}</span>
                {cells}
              </div>
            );
          })}
        </div>
      </div>
      {loading ? <div className="mkt-panel-status">Refreshing…</div> : null}
      {error ? <div className="mkt-panel-status mkt-panel-status--err">{error}</div> : null}
      {showPager ? (
        <div className="return-table-page__pagination">
          <FigmaPagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            ariaLabel={`${title} pagination`}
          />
        </div>
      ) : null}
    </section>
  );
}
