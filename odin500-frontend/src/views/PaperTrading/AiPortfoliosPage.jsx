'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Search, SearchX, X } from 'lucide-react';
import { Link, useSearchParams } from '@/navigation/appRouterCompat.jsx';
import { FigmaPagination } from '../../components/FigmaPagination.jsx';
import { PaperSortableTh } from '../../components/paper/PaperSortableTh.jsx';
import { PublicPortfoliosTopSummary } from '../../components/paper/PublicPortfoliosTopSummary.jsx';
import { CopyPortfolioModal } from '../../components/paper/CopyPortfolioModal.jsx';
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
/**
 * Typing pause before a search reaches the API — one request per word rather than per keystroke,
 * while the table still feels like it is answering what you typed.
 */
const SEARCH_DEBOUNCE_MS = 350;

/** Guards the URL and the request against a pasted essay. */
const MAX_SEARCH_LEN = 100;

const PAGE_SIZE = 10;
const TOP_PERFORMERS = 5;

const DEFAULT_ENGINE = '__all__';
const DEFAULT_INDEX = '__all__';
const DEFAULT_DIRECTION = '__all__';
const DEFAULT_SORT = 'avg_monthly_return_pct';
const DEFAULT_DIR = 'desc';

const ALLOWED_ENGINES = new Set(['__all__', 'ai', ...ENGINE_PATTERNS.map((e) => e.id)]);
const ALLOWED_INDICES = new Set(['__all__', ...INDEX_PATTERNS.map((i) => i.id)]);
const ALLOWED_DIRECTIONS = new Set(DIRECTION_OPTIONS.map((d) => d.id));
// Mirrors SORT_KEYS in the backend's publicPortfolioQuery.js. Average monthly return leads:
// total return rewards whichever book has simply run longest, while the monthly average is
// age-normalised. It is withheld below a month of track record, so those rows sort last and
// fall back to total return among themselves.
const ALLOWED_SORTS = new Set([
  'equity',
  'total_return_pct',
  'avg_monthly_return_pct',
  'positions_count',
  'published_at'
]);
const ALLOWED_DIRS = new Set(['asc', 'desc']);

function parseParam(raw, allowed, fallback) {
  const v = String(raw || '').trim();
  return allowed.has(v) ? v : fallback;
}

/** Engines may include facet ids beyond the known Claude/ChatGPT/Gemini set. */
function parseEngineParam(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v || v === DEFAULT_ENGINE) return DEFAULT_ENGINE;
  if (ALLOWED_ENGINES.has(v)) return v;
  if (/^[a-z0-9_-]{1,32}$/.test(v)) return v;
  return DEFAULT_ENGINE;
}

function parseSearchParamValue(raw) {
  return String(raw || '').trim().slice(0, MAX_SEARCH_LEN);
}

function parsePage(raw) {
  const n = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

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

/**
 * Shared gallery body for both AI boards. `owner` splits them: `admin` is Odin's own books,
 * `user` is everything members published. Same filters, sorting, table and creator chat — only
 * the copy and the server-side owner filter differ, so they stay in sync by construction.
 * @param {{ owner: 'admin'|'user', title: string, subtitle: string, emptyText: string }} props
 */
function AiPortfoliosPageContent({ owner, title, subtitle, emptyText }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copyTarget, setCopyTarget] = useState(null);

  const engineFilter = parseEngineParam(searchParams.get('engine'));
  const indexFilter = parseParam(searchParams.get('index'), ALLOWED_INDICES, DEFAULT_INDEX);
  const directionFilter = parseParam(searchParams.get('direction'), ALLOWED_DIRECTIONS, DEFAULT_DIRECTION);
  const searchQuery = parseSearchParamValue(searchParams.get('q'));
  const sortKey = parseParam(searchParams.get('sort'), ALLOWED_SORTS, DEFAULT_SORT);
  const sortDir = parseParam(searchParams.get('dir'), ALLOWED_DIRS, DEFAULT_DIR);
  const page = parsePage(searchParams.get('page'));

  const patchParams = useCallback(
    (mutate) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  /**
   * The box holds its own instant value while the URL — and so the request — only takes it after
   * a pause. Writing every keystroke into the URL would fire a query each time and stack up
   * history entries for half-typed words.
   */
  const [search, setSearch] = useState(searchQuery);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = search.trim().slice(0, MAX_SEARCH_LEN);
      if (next === searchQuery) return;
      patchParams((params) => {
        if (next) params.set('q', next);
        else params.delete('q');
        params.delete('page');
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search, searchQuery, patchParams]);

  const setEngineFilter = useCallback(
    (id) => {
      patchParams((next) => {
        if (id === DEFAULT_ENGINE) next.delete('engine');
        else next.set('engine', id);
        next.delete('page');
      });
    },
    [patchParams]
  );

  const setIndexFilter = useCallback(
    (id) => {
      patchParams((next) => {
        if (id === DEFAULT_INDEX) next.delete('index');
        else next.set('index', id);
        next.delete('page');
      });
    },
    [patchParams]
  );

  const setDirectionFilter = useCallback(
    (id) => {
      patchParams((next) => {
        if (id === DEFAULT_DIRECTION) next.delete('direction');
        else next.set('direction', id);
        next.delete('page');
      });
    },
    [patchParams]
  );

  /** Drops search and all three filters at once — the way out of a no-match empty state. */
  const clearFilters = useCallback(() => {
    setSearch('');
    patchParams((next) => {
      next.delete('q');
      next.delete('engine');
      next.delete('index');
      next.delete('direction');
      next.delete('page');
    });
  }, [patchParams]);

  const setPage = useCallback(
    (nextPage) => {
      patchParams((next) => {
        if (nextPage <= 1) next.delete('page');
        else next.set('page', String(nextPage));
      });
    },
    [patchParams]
  );

  const onSort = useCallback(
    (key) => {
      patchParams((next) => {
        const effectiveSort = key;
        const effectiveDir = key === sortKey ? (sortDir === 'desc' ? 'asc' : 'desc') : 'desc';
        if (effectiveSort === DEFAULT_SORT) next.delete('sort');
        else next.set('sort', effectiveSort);
        if (effectiveDir === DEFAULT_DIR) next.delete('dir');
        else next.set('dir', effectiveDir);
        next.delete('page');
      });
    },
    [patchParams, sortDir, sortKey]
  );

  // Table: one page of rows, filtered/sorted/paged by the API.
  const { portfolios, pagination, facets, loading, error, refetch } = usePublicPortfoliosPaged({
    page,
    pageSize: PAGE_SIZE,
    sort: sortKey,
    dir: sortDir,
    aiOnly: true,
    owner,
    engine: engineFilter,
    index: indexFilter,
    direction: directionFilter,
    q: searchQuery
  });

  // Top performers carousel: always the best few under the same filters, independent of page.
  const {
    portfolios: topRows,
    loading: topLoading,
    refetch: refetchTop
  } = usePublicPortfoliosPaged({
    page: 1,
    pageSize: TOP_PERFORMERS,
    sort: 'total_return_pct',
    dir: 'desc',
    aiOnly: true,
    owner,
    engine: engineFilter,
    index: indexFilter,
    direction: directionFilter,
    q: searchQuery
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

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.total_pages ?? 1;
  const rangeStart = total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.page_size, total);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    engineFilter !== DEFAULT_ENGINE ||
    indexFilter !== DEFAULT_INDEX ||
    directionFilter !== DEFAULT_DIRECTION;

  const reloadAll = () => {
    void refetch();
    void refetchTop();
  };

  // The creator is mounted in ProtectedLayout (so it appears on every page), not here, so the
  // board refreshes off its broadcast rather than an onCreated prop.
  useEffect(() => {
    const onCreated = () => reloadAll();
    window.addEventListener('odin-ai-portfolio-created', onCreated);
    return () => window.removeEventListener('odin-ai-portfolio-created', onCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          title="Total return ÷ months since publication. Shown only once a portfolio is at least a month old; younger books sort last."
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
          <h1 className="paper-header__title">{title}</h1>
          <p className="paper-header__sub">{subtitle}</p>
        </div>
        <div className="paper-header__actions">
          <Link to="/virtual-portfolio/public" className="paper-btn paper-btn--ghost">
            All Published Portfolios
          </Link>
        </div>
      </header>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {topLoading || topRows.length > 0 ? (
        <PublicPortfoliosTopSummary
          portfolios={topRows}
          loading={topLoading}
          limit={TOP_PERFORMERS}
          carousel
        />
      ) : null}

      {!loading ? (
        <div className="paper-public-filters flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2 mt-5">
          {/* Leads the row: it labels everything after it, search box included. */}
          <Filter size={16} strokeWidth={2} aria-hidden className="paper-public-filters__icon" />
          <div className="paper-search">
            <Search size={15} strokeWidth={2} aria-hidden className="paper-search__icon" />
            <input
              type="search"
              className="paper-search__input"
              placeholder="Search portfolios or owners…"
              aria-label="Search portfolios by name or owner"
              maxLength={MAX_SEARCH_LEN}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="paper-search__clear"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                <X size={14} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
          <ThemedDropdown
            value={engineFilter}
            options={engineOptions}
            onChange={setEngineFilter}
            title="AI engine filter"
            ariaLabelPrefix="AI engine filter"
            wideLabel
          />
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

      {/* Two different empty states: filters that match nothing is a dead end with a way out,
          while an unfiltered empty board is genuinely waiting on someone to publish. */}
      {!loading && !total && hasActiveFilters ? (
        <div className="paper-empty paper-empty--public paper-empty--filtered">
          <span className="paper-empty__icon" aria-hidden>
            <SearchX size={22} strokeWidth={1.75} />
          </span>
          <p className="paper-empty__title">No portfolios match these filters</p>
          <p className="paper-empty__hint">
            No published book fits every filter at once. Widen one of them, or clear them all to
            see the full board.
          </p>
          <button type="button" className="paper-btn paper-btn--ghost paper-empty__action" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

      {!loading && !total && !hasActiveFilters ? (
        <div className="paper-empty paper-empty--public">
          <p>{emptyText}</p>
          <p className="paper-empty__hint">
            Check back soon, or browse{' '}
            <Link to="/virtual-portfolio/public" className="paper-link">
              all published portfolios
            </Link>{' '}
            in the meantime.
          </p>
        </div>
      ) : null}

      {!loading && total > 0 ? (
        <div className="paper-table-wrap paper-public-table-wrap">
          <table className="paper-table paper-public-table">
            {tableHead}
            <tbody>
              {rows.map((p) => {
                const href = `/virtual-portfolio/public/${encodeURIComponent(p.id)}`;
                return (
                  <tr key={p.id} className="paper-public-table__row">
                    <td className="paper-public-table__portfolio">
                      <Link to={href} className="paper-public-table__identity">
                        <span className="paper-public-table__avatar" aria-hidden>
                          {ownerInitials(p.owner_label)}
                        </span>
                        <span className="paper-public-table__identity-text">
                          <span className="paper-public-table__name">{p.name}</span>
                          {/* Owner and tags share one line so every row is the same height. */}
                          <span className="paper-public-table__meta">
                            <span className="paper-public-table__owner">by {p.owner_label}</span>
                            {/* Tags are grouped so they can drop to a line of their own, intact,
                                once the column is too narrow to hold owner and tags together. */}
                            <span className="paper-public-table__tags">
                              {p.ai_engine ? (
                                <span className="paper-tag paper-tag--engine" data-engine={p.ai_engine.id}>
                                  {p.ai_engine.label}
                                </span>
                              ) : null}
                              {p.index_focus ? (
                                <span className="paper-tag paper-tag--index" data-index={p.index_focus.id}>
                                  {p.index_focus.label}
                                </span>
                              ) : null}
                              <span className="paper-tag paper-tag--direction" data-direction={p.direction.id}>
                                {p.direction.label}
                              </span>
                              {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                                <span className="paper-tag">Automated</span>
                              ) : null}
                            </span>
                          </span>
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
                    <td className={'paper-public-table__num ' + toneClass(p.avg_monthly_return_pct)}>
                      {p.avg_monthly_return_pct == null ? (
                        <span
                          className="paper-public-table__na"
                          title={
                            p.days_elapsed != null
                              ? `Published ${Math.round(p.days_elapsed)} day(s) ago — needs a full month before an average is meaningful`
                              : 'Needs a full month before an average is meaningful'
                          }
                        >
                          N/A
                        </span>
                      ) : (
                        fmtPctSigned(p.avg_monthly_return_pct, { decimals: 2 })
                      )}
                    </td>
                    <td className="paper-public-table__num">
                      <span className="paper-public-table__count">{p.positions_count ?? 0}</span>
                    </td>
                    <td className="paper-public-table__date">{fmtDate(p.published_at)}</td>
                    <td className="paper-public-table__action">
                      <span className="paper-public-table__actions">
                        <Link to={href} className="paper-public-table__cta">
                          View
                        </Link>
                        {(p.positions_count ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="paper-public-table__cta paper-public-table__cta--copy"
                            onClick={() => setCopyTarget({ id: p.id, name: p.name })}
                          >
                            Copy
                          </button>
                        ) : null}
                      </span>
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

      <CopyPortfolioModal
        open={Boolean(copyTarget)}
        portfolio={copyTarget}
        onClose={() => setCopyTarget(null)}
      />
    </div>
  );
}

/** Odin's own AI books — every portfolio published from an admin account. */
export default function AiPortfoliosPage() {
  return (
    <AiPortfoliosPageContent
      owner="admin"
      title="Odin AI Portfolios"
      subtitle="Virtual portfolios built and traded by AI models on Odin's own accounts — Claude and ChatGPT today, with Gemini and more on the way — going long and short on the S&P 500, Nasdaq-100, and Dow Jones. Ranked by average monthly return, which puts books of different ages on the same footing; the ones too young for that figure sort last."
      emptyText="No Odin AI portfolios published yet"
    />
  );
}

/** The same board, restricted to AI portfolios published by members rather than by Odin. */
export function UserAiPortfoliosPage() {
  return (
    <AiPortfoliosPageContent
      owner="user"
      title="User AI Portfolios"
      subtitle="AI-managed virtual portfolios built and published by Odin500 members. Same engines and the same published track record as Odin's own books — ranked by average monthly return, which puts books of different ages on the same footing; the ones too young for that figure sort last."
      emptyText="No member AI portfolios published yet"
    />
  );
}
