'use client';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';

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

export function AccountSummary({ account, loading }) {
  if (loading && !account) {
    return (
      <section className="paper-stats" aria-busy="true">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <article key={i} className="paper-stat" aria-hidden>
            <div className="paper-skeleton" style={{ minHeight: '4.5rem' }} />
          </article>
        ))}
      </section>
    );
  }

  const equity = account?.equity ?? account?.cash_balance;
  const starting = Number(account?.starting_capital) || 100_000;
  const totalReturn =
    account?.total_return != null
      ? Number(account.total_return)
      : equity != null
        ? Number(equity) - starting
        : 0;
  const totalReturnPct =
    starting > 0 && Number.isFinite(totalReturn)
      ? (totalReturn / starting) * 100
      : Number(account?.total_return_pct ?? 0);
  const openPnl = account?.unrealized_pnl_total ?? 0;
  const closedPnl = account?.realized_pnl_total ?? 0;
  return (
    <section className="paper-stats" aria-label="Portfolio summary">
      <article className="paper-stat paper-stat--highlight">
        <span className="paper-stat__label">Portfolio value</span>
        <strong className="paper-stat__value">{money(equity)}</strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Cash available</span>
        <strong className="paper-stat__value">{money(account?.cash_balance)}</strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Total return</span>
        <strong className={`paper-stat__value ${toneClass(totalReturn)}`}>
          {money(totalReturn)}
          <span>{fmtPctSigned(totalReturnPct, { decimals: 2 })}</span>
        </strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Open positions</span>
        <strong className="paper-stat__value">{account?.positions_count ?? 0}</strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Open trades P&amp;L</span>
        <strong className={`paper-stat__value ${toneClass(openPnl)}`}>{money(openPnl)}</strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Closed trades P&amp;L</span>
        <strong className={`paper-stat__value ${toneClass(closedPnl)}`}>{money(closedPnl)}</strong>
      </article>
    </section>
  );
}

