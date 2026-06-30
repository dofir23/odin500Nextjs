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
            Browse paper portfolios published by Odin500 users. View-only snapshots of holdings and performance.
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
        <div className="paper-public-grid" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <article key={i} className="paper-public-card paper-skeleton" aria-hidden />
          ))}
        </div>
      ) : null}

      {!loading && !portfolios.length ? (
        <div className="paper-empty paper-empty--public">
          <p>No published portfolios yet</p>
          <p className="paper-empty__hint">
            Publish your paper account from{' '}
            <Link to="/paper-trading" className="paper-link">
              Your Portfolio
            </Link>{' '}
            to share it here.
          </p>
        </div>
      ) : null}

      {!loading && portfolios.length > 0 ? (
        <div className="paper-public-grid">
          {portfolios.map((p) => (
            <Link
              key={p.id}
              to={`/paper-trading/public/${encodeURIComponent(p.id)}`}
              className="paper-public-card"
            >
              <div className="paper-public-card__top">
                <div className="paper-public-card__identity">
                  <span className="paper-public-card__avatar" aria-hidden>
                    {ownerInitials(p.owner_label)}
                  </span>
                  <div className="paper-public-card__identity-text">
                    <h2 className="paper-public-card__title">{p.name}</h2>
                    <p className="paper-public-card__owner">by {p.owner_label}</p>
                  </div>
                </div>
                {p.strategy_mode && p.strategy_mode !== 'manual' ? (
                  <span className="paper-public-card__tag">Automated</span>
                ) : null}
              </div>

              {p.publish_description ? (
                <p className="paper-public-card__desc">{p.publish_description}</p>
              ) : (
                <p className="paper-public-card__desc paper-public-card__desc--muted">
                  Published paper portfolio — tap to view holdings and performance.
                </p>
              )}

              <div className="paper-public-card__metrics">
                <div className="paper-public-card__metric paper-public-card__metric--primary">
                  <span className="paper-public-card__metric-label">Portfolio value</span>
                  <strong className="paper-public-card__metric-value">{money(p.equity)}</strong>
                </div>
                <div className="paper-public-card__metric">
                  <span className="paper-public-card__metric-label">Total return</span>
                  <strong className={'paper-public-card__metric-value ' + toneClass(p.total_return)}>
                    {money(p.total_return)}
                    <span>{fmtPctSigned(p.total_return_pct, { decimals: 2 })}</span>
                  </strong>
                </div>
                <div className="paper-public-card__metric">
                  <span className="paper-public-card__metric-label">Positions</span>
                  <strong className="paper-public-card__metric-value">{p.positions_count ?? 0}</strong>
                </div>
              </div>

              <div className="paper-public-card__foot">
                <span className="paper-public-card__meta">Published {fmtDate(p.published_at)}</span>
                <span className="paper-public-card__cta">View portfolio</span>
              </div>
            </Link>
          ))}
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
