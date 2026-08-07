'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { FigmaPagination } from '../../components/FigmaPagination.jsx';
import { PaperSortableTh } from '../../components/paper/PaperSortableTh.jsx';
import { PublicPortfoliosTopSummary } from '../../components/paper/PublicPortfoliosTopSummary.jsx';
import { AiPortfolioCreatorChat } from '../../components/paper/AiPortfolioCreatorChat.jsx';
import { ThemedDropdown } from '../../components/ThemedDropdown.jsx';
import { usePublicPortfoliosPaged } from '../../hooks/usePublicPortfolios.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import { ENGINE_PATTERNS, INDEX_PATTERNS, enrichPortfolioTags } from '../../utils/aiPortfolioTags.js';
import '../../styles/paper-trading.css';

const ALL_ENGINES = { id: '__all__', label: 'All AI engines' };
const ALL_INDICES = { id: '__all__', label: 'All indices' };
const DIRECTION_OPTIONS = [
  { id: '__all__', label: 'All directions' },
  { id: 'long', label: 'Long' },
  { id: 'short', label: 'Short' },
  { id: 'long_short', label: 'Long-Short' }
];
const INDEX_OPTIONS = [ALL_INDICES, ...INDEX_PATTERNS.map(({ id, label }) => ({ id, label }))];
const PAGE_SIZE = 10;
const TOP_PERFORMERS = 5;

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

function toneClass(v) {
  if (Number(v) > 0) return 'paper-tone-up';
  if (Number(v) < 0) return 'paper-tone-down';
  return '';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ownerInitials(label) {
  const text = String(label || '').trim();
  if (!text) return '?';
  if (text.includes('@')) return text.charAt(0).toUpperCase();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function AiPortfoliosPageContent() {
  const [sortKey, setSortKey] = useState('avg_monthly_return_pct');
  const [sortDir, setSortDir] = useState('desc');
  const [engineFilter, setEngineFilter] = useState('__all__');
  const [indexFilter, setIndexFilter] = useState('__all__');
  const [directionFilter, setDirectionFilter] = useState('__all__');
  const [page, setPage] = useState(1);

  // Table: one page of rows, filtered/sorted/paged by the API.
  const { portfolios, pagination, facets, loading, error, refetch } = usePublicPortfoliosPaged({
    page,
    pageSize: PAGE_SIZE,
    sort: sortKey,
    dir: sortDir,
    aiOnly: true,
    engine: engineFilter,
    index: indexFilter,
    direction: directionFilter
  });

  // Top performers carousel: always the best few under the same filters, independent of page.
  const {
    portfolios: topRows,
    loading: topLoading,
    refetch: refetchTop
  } = usePublicPortfoliosPaged({
    page: 1,
    pageSize: TOP_PERFORMERS,
    sort: 'avg_monthly_return_pct',
    dir: 'desc',
    aiOnly: true,
    engine: engineFilter,
    index: indexFilter,
    direction: directionFilter
  });

  const rows = useMemo(() => portfolios.map(enrichPortfolioTags), [portfolios]);

  const engineOptions = useMemo(() => {
    const present = facets?.engines || [];
    // Keep known-engine ordering (Claude, ChatGPT, Gemini, ...) for the ones present.
    const known = ENGINE_PATTERNS.filter((e) => present.some((p) => p.id === e.id)).map(
      ({ id, label }) => ({ id, label })
    );
    const extra = present.filter((e) => !known.some((k) => k.id === e.id));
    return [ALL_ENGINES, ...known, ...extra];
  }, [facets]);

  // A narrower filter can drop the total below the page we're on.
  useEffect(() => {
    setPage(1);
  }, [engineFilter, indexFilter, directionFilter, sortKey, sortDir]);

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.total_pages ?? 1;
  const rangeStart = total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.page_size, total);

  const hasActiveFilters =
    engineFilter !== '__all__' || indexFilter !== '__all__' || directionFilter !== '__all__';

  const reloadAll = () => {
    void refetch();
    void refetchTop();
  };

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  };

  const tableHead = (
    <thead>
      <tr>
        <th scope="col">Portfolio</th>
        <PaperSortableTh
          label="Portfolio value"
          sortKey="equity"
          activeKey={sortKey}
          dir={sortDir}
          onSort={onSort}
          align="right"
        />
        <PaperSortableTh
          label="Total return"
          sortKey="total_return_pct"
          activeKey={sortKey}
          dir={sortDir}
          onSort={onSort}
          align="right"
        />
        <PaperSortableTh
          label="Avg monthly"
          sortKey="avg_monthly_return_pct"
          activeKey={sortKey}
          dir={sortDir}
          onSort={onSort}
          align="right"
        />
        <PaperSortableTh
          label="Positions"
          sortKey="positions_count"
          activeKey={sortKey}
          dir={sortDir}
          onSort={onSort}
          align="right"
        />
        <PaperSortableTh
          label="Published"
          sortKey="published_at"
          activeKey={sortKey}
          dir={sortDir}
          onSort={onSort}
        />
        <th scope="col">
          <span className="sr-only">Action</span>
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="paper-page odin-content-page paper-page--public">
      <header className="paper-header">
        <div>
          <h1 className="paper-header__title">AI Portfolios</h1>
          <p className="paper-header__sub">
            Virtual portfolios traded by AI models — Claude and ChatGPT today, with Gemini and more on the
            way — going long and short on the S&amp;P 500, Nasdaq-100, and Dow Jones. Ranked by average
            monthly return so portfolios of different ages compare fairly.
          </p>
        </div>
        <div className="paper-header__actions">
          <Link to="/paper-trading/public" className="paper-btn paper-btn--ghost">
            All Public Portfolios
          </Link>
        </div>
      </header>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      <AiPortfolioCreatorChat onCreated={reloadAll} />

      {topLoading || topRows.length > 0 ? (
        <PublicPortfoliosTopSummary
          portfolios={topRows}
          loading={topLoading}
          limit={TOP_PERFORMERS}
          carousel
        />
      ) : null}

      {!loading ? (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 mt-5">
          <label className="flex items-center gap-2">
            <Filter size={16} strokeWidth={2} aria-hidden />
            <ThemedDropdown
              value={engineFilter}
              options={engineOptions}
              onChange={setEngineFilter}
              title="AI engine filter"
              ariaLabelPrefix="AI engine filter"
              wideLabel
            />
          </label>
          <ThemedDropdown
            value={indexFilter}
            options={INDEX_OPTIONS}
            onChange={setIndexFilter}
            title="Index filter"
            ariaLabelPrefix="Index filter"
            wideLabel
          />
          <ThemedDropdown
            value={directionFilter}
            options={DIRECTION_OPTIONS}
            onChange={setDirectionFilter}
            title="Direction filter"
            ariaLabelPrefix="Direction filter"
            wideLabel
          />
        </div>
      ) : null}

      {loading ? (
        <div className="paper-table-wrap paper-public-table-wrap" aria-busy="true">
          <table className="paper-table paper-public-table">
            {tableHead}
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="paper-public-table__skel-row" aria-hidden>
                  <td colSpan={7}>
                    <div className="paper-skeleton paper-public-table__skel" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !total ? (
        <div className="paper-empty paper-empty--public">
          {hasActiveFilters ? (
            <p>No AI portfolios match these filters yet</p>
          ) : (
            <>
              <p>No AI portfolios published yet</p>
              <p className="paper-empty__hint">
                Check back soon, or browse{' '}
                <Link to="/paper-trading/public" className="paper-link">
                  all public portfolios
                </Link>{' '}
                in the meantime.
              </p>
            </>
          )}
        </div>
      ) : null}

      {!loading && total > 0 ? (
        <div className="paper-table-wrap paper-public-table-wrap">
          <table className="paper-table paper-public-table">
            {tableHead}
            <tbody>
              {rows.map((p) => {
                const href = `/paper-trading/public/${encodeURIComponent(p.id)}`;
                const avgTitle =
                  p.months_elapsed != null
                    ? `Over ~${p.months_elapsed} month${Number(p.months_elapsed) === 1 ? '' : 's'} since publish`
                    : undefined;
                return (
                  <tr key={p.id} className="paper-public-table__row">
                    <td className="paper-public-table__portfolio">
                      <Link to={href} className="paper-public-table__identity">
                        <span className="paper-public-card__avatar" aria-hidden>
                          {ownerInitials(p.owner_label)}
                        </span>
                        <span className="paper-public-table__identity-text">
                          <span className="paper-public-table__name-row">
                            <span className="paper-public-table__name">{p.name}</span>
                            {p.ai_engine ? (
                              <span className="paper-public-card__tag">{p.ai_engine.label}</span>
                            ) : null}
                            {p.index_focus ? (
                              <span className="paper-public-card__tag">{p.index_focus.label}</span>
                            ) : null}
                            <span className="paper-public-card__tag">{p.direction.label}</span>
                            {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                              <span className="paper-public-card__tag">Automated</span>
                            ) : null}
                          </span>
                          <span className="paper-public-table__owner">by {p.owner_label}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="paper-public-table__num">{money(p.equity)}</td>
                    <td className={'paper-public-table__num ' + toneClass(p.total_return)}>
                      <span className="paper-public-table__return">
                        {money(p.total_return)}
                        <span className="paper-public-table__return-pct">
                          {fmtPctSigned(p.total_return_pct, { decimals: 2 })}
                        </span>
                      </span>
                    </td>
                    <td
                      className={'paper-public-table__num ' + toneClass(p.avg_monthly_return_pct)}
                      title={avgTitle}
                    >
                      {p.avg_monthly_return_pct == null
                        ? '—'
                        : fmtPctSigned(p.avg_monthly_return_pct, { decimals: 2 })}
                    </td>
                    <td className="paper-public-table__num">{p.positions_count ?? 0}</td>
                    <td className="paper-public-table__date">{fmtDate(p.published_at)}</td>
                    <td className="paper-public-table__action">
                      <Link to={href} className="paper-public-table__cta">
                        View portfolio
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && total > 0 ? (
        <div className="paper-public-pager">
          <p className="paper-public-pager__count">
            Showing {rangeStart}–{rangeEnd} of {total} portfolio{total === 1 ? '' : 's'}
          </p>
          {totalPages > 1 ? (
            <FigmaPagination
              page={pagination.page}
              totalPages={totalPages}
              onPageChange={setPage}
              ariaLabel="AI portfolios pagination"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AiPortfoliosPage() {
  return <AiPortfoliosPageContent />;
}
