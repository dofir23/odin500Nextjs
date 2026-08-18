'use client';
import { fmtPct, fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import { computeClosedTradesAnalytics } from '../../utils/closedTradesAnalytics.js';
import { avgMonthlyUnavailableReason, computeAvgMonthlyReturn } from '../../utils/portfolioAgeMetrics.js';

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

/**
 * @param {{ account?: object, loading?: boolean, closedTrades?: object[] }} props
 *   `closedTrades` drives the win rate — pass the same array the Closed trades tab renders so the
 *   two surfaces can never report different numbers.
 */
export function AccountSummary({ account, loading, closedTrades = [] }) {
  if (loading && !account) {
    return (
      <section className="paper-stats" aria-busy="true">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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

  // Dated from creation, not publication: an owner who traded for months before publishing has a
  // track record that long, and measuring from published_at would overstate the monthly rate.
  const { avgMonthlyReturnPct, daysElapsed } = computeAvgMonthlyReturn(
    totalReturnPct,
    account?.created_at
  );

  // Win rate counts closed trades only — an open position has no realized result to judge yet.
  const tradeStats = computeClosedTradesAnalytics(closedTrades);

  return (
    <section className="paper-stats" aria-label="Portfolio summary">
      <article className="paper-stat paper-stat--highlight">
        <span className="paper-stat__label">Portfolio value</span>
        <strong className="paper-stat__value">{money(equity)}</strong>
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Cash available</span>
        <strong className="paper-stat__value">{money(account?.cash_balance ?? account?.cash)}</strong>
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
      <article className="paper-stat">
        <span className="paper-stat__label">Avg monthly return</span>
        {avgMonthlyReturnPct != null ? (
          <strong className={`paper-stat__value ${toneClass(avgMonthlyReturnPct)}`}>
            {fmtPctSigned(avgMonthlyReturnPct, { decimals: 2 })}
          </strong>
        ) : (
          <strong className="paper-stat__value paper-stat__value--na" title={avgMonthlyUnavailableReason(daysElapsed)}>
            N/A
          </strong>
        )}
      </article>
      <article className="paper-stat">
        <span className="paper-stat__label">Win rate</span>
        {tradeStats.totalTrades > 0 ? (
          <strong className="paper-stat__value">
            {fmtPct(tradeStats.winRate, { decimals: 1 })}
            <span>
              {tradeStats.wins}W / {tradeStats.losses}L
            </span>
          </strong>
        ) : (
          <strong className="paper-stat__value paper-stat__value--na" title="No closed trades yet">
            N/A
          </strong>
        )}
      </article>
    </section>
  );
}

