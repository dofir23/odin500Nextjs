'use client';

import { Link } from '@/navigation/appRouterCompat.jsx';
import { PaperLoginGate } from '../../components/paper/PaperLoginGate.jsx';
import { usePublicPortfolios } from '../../hooks/usePublicPortfolios.js';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import '../../styles/paper-trading.css';

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
  const { portfolios, loading, error } = usePublicPortfolios();

  return (
    <div className="paper-page odin-content-page paper-page--public">
      <header className="paper-header">
        <div>
          <h1 className="paper-header__title">Public Portfolios</h1>
          <p className="paper-header__sub">
            Browse virtual portfolios published by Odin500 users. View-only snapshots of holdings and performance.
          </p>
        </div>
        <div className="paper-header__actions">
          <Link to="/paper-trading" className="paper-btn paper-btn--ghost">
            Your Portfolio
          </Link>
        </div>
      </header>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {loading ? (
        <div className="paper-table-wrap paper-public-table-wrap" aria-busy="true">
          <table className="paper-table paper-public-table">
            <thead>
              <tr>
                <th scope="col">Portfolio</th>
                <th scope="col">Portfolio value</th>
                <th scope="col">Total return</th>
                <th scope="col">Positions</th>
                <th scope="col">Published</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="paper-public-table__skel-row" aria-hidden>
                  <td colSpan={6}>
                    <div className="paper-skeleton paper-public-table__skel" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !portfolios.length ? (
        <div className="paper-empty paper-empty--public">
          <p>No published portfolios yet</p>
          <p className="paper-empty__hint">
            Publish your virtual portfolio account from{' '}
            <Link to="/paper-trading" className="paper-link">
              Your Portfolio
            </Link>{' '}
            to share it here.
          </p>
        </div>
      ) : null}

      {!loading && portfolios.length > 0 ? (
        <div className="paper-table-wrap paper-public-table-wrap">
          <table className="paper-table paper-public-table">
            <thead>
              <tr>
                <th scope="col">Portfolio</th>
                <th scope="col">Portfolio value</th>
                <th scope="col">Total return</th>
                <th scope="col">Positions</th>
                <th scope="col">Published</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p) => {
                const href = `/paper-trading/public/${encodeURIComponent(p.id)}`;
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
    </div>
  );
}

export default function PublicPortfoliosPage() {
  return (
    <PaperLoginGate>
      <PublicPortfoliosPageContent />
    </PaperLoginGate>
  );
}
