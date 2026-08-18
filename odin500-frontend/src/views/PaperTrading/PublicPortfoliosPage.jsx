'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { FigmaPagination } from '../../components/FigmaPagination.jsx';
import { PaperSortableTh } from '../../components/paper/PaperSortableTh.jsx';
import { PublicPortfoliosTopSummary } from '../../components/paper/PublicPortfoliosTopSummary.jsx';
import { usePublicPortfoliosPaged } from '../../hooks/usePublicPortfolios.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import '../../styles/paper-trading.css';

const PAGE_SIZE = 10;
const TOP_PERFORMERS = 3;

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
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function ownerInitials(label) {
  const text = String(label || '').trim();
  if (!text) return '?';
  if (text.includes('@')) return text.charAt(0).toUpperCase();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function PublicPortfoliosPageContent() {
  const [sortKey, setSortKey] = useState('total_return_pct');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Table: one page of rows, sorted and paged by the API.
  const { portfolios, pagination, loading, error } = usePublicPortfoliosPaged({
    page,
    pageSize: PAGE_SIZE,
    sort: sortKey,
    dir: sortDir
  });

  // Top performers stay the best overall, independent of which page is showing.
  const { portfolios: topRows, loading: topLoading } = usePublicPortfoliosPaged({
    page: 1,
    pageSize: TOP_PERFORMERS,
    sort: 'total_return_pct',
    dir: 'desc'
  });

  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir]);

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.total_pages ?? 1;
  const rangeStart = total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.page_size, total);

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
        {/* Display-only: sorting stays on total return. */}
        <th scope="col" className="paper-table__th--num" title="Total return ÷ months since publication. Shown only once a portfolio is at least a month old.">
          Avg monthly
        </th>
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
          <h1 className="paper-header__title">Published Portfolios</h1>
          <p className="paper-header__sub">
            Browse virtual portfolios published by Odin500 users — including AI-built books for major
            indices (Claude, ChatGPT, Gemini). Ranked by total return since publication, so check the
            published date before comparing two books.
          </p>
        </div>
        <div className="paper-header__actions">
          <Link to="/virtual-portfolio" className="paper-btn paper-btn--ghost">
            Your Portfolio
          </Link>
        </div>
      </header>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {topLoading || topRows.length > 0 ? (
        <PublicPortfoliosTopSummary
          portfolios={topRows}
          loading={topLoading}
          limit={TOP_PERFORMERS}
        />
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
          <p>No published portfolios yet</p>
          <p className="paper-empty__hint">
            Publish your virtual portfolio account from{' '}
            <Link to="/virtual-portfolio" className="paper-link">
              Your Portfolio
            </Link>{' '}
            to share it here.
          </p>
        </div>
      ) : null}

      {!loading && total > 0 ? (
        <div className="paper-table-wrap paper-public-table-wrap">
          <table className="paper-table paper-public-table">
            {tableHead}
            <tbody>
              {portfolios.map((p) => {
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
                            {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                              <span className="paper-tag">Automated</span>
                            ) : null}
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
              ariaLabel="Public portfolios pagination"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PublicPortfoliosPage() {
  return <PublicPortfoliosPageContent />;
}
