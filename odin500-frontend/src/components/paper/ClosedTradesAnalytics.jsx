'use client';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import { computeClosedTradesAnalytics } from '../../utils/closedTradesAnalytics.js';

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
 * @param {{ trades: object[], loading?: boolean }} props
 */
export function ClosedTradesAnalytics({ trades = [], loading = false }) {
  const stats = computeClosedTradesAnalytics(trades);

  if (loading && !trades?.length) {
    return (
      <div className="paper-analytics" aria-busy="true">
        <div className="paper-skeleton" style={{ minHeight: '6rem' }} />
      </div>
    );
  }

  if (!stats.totalTrades) {
    return (
      <div className="paper-analytics paper-analytics--empty">
        <p className="paper-analytics__empty-title">No completed trades yet</p>
        <p>When you close positions, win rate and profit stats will show up here automatically.</p>
      </div>
    );
  }

  return (
    <div className="paper-analytics">
      <div className="paper-analytics__intro">
        <h3 className="paper-analytics__title">Your trading results</h3>
        <p className="paper-analytics__hint">Summary of trades you have already closed (realized profit or loss).</p>
      </div>
      <div className="paper-analytics__grid">
        <article className="paper-analytics__card">
          <span className="paper-analytics__label">Win rate</span>
          <strong className="paper-analytics__value">
            {stats.winRate != null ? fmtPctSigned(stats.winRate, { decimals: 1 }) : '—'}
          </strong>
          <span className="paper-analytics__sub">
            {stats.wins} wins · {stats.losses} losses
          </span>
        </article>
        <article className="paper-analytics__card">
          <span className="paper-analytics__label">Total closed P&amp;L</span>
          <strong className={`paper-analytics__value ${toneClass(stats.totalNet)}`}>{money(stats.totalNet)}</strong>
          <span className="paper-analytics__sub">{stats.totalTrades} trades</span>
        </article>
        <article className="paper-analytics__card">
          <span className="paper-analytics__label">Average winning trade</span>
          <strong className={`paper-analytics__value ${toneClass(stats.avgWin)}`}>{money(stats.avgWin)}</strong>
        </article>
        <article className="paper-analytics__card">
          <span className="paper-analytics__label">Average losing trade</span>
          <strong className={`paper-analytics__value ${toneClass(stats.avgLoss)}`}>{money(stats.avgLoss)}</strong>
        </article>
        {stats.best ? (
          <article className="paper-analytics__card">
            <span className="paper-analytics__label">Best trade</span>
            <strong className={`paper-analytics__value ${toneClass(stats.best.net_realized_pnl)}`}>
              {stats.best.ticker} {money(stats.best.net_realized_pnl)}
            </strong>
          </article>
        ) : null}
        {stats.worst ? (
          <article className="paper-analytics__card">
            <span className="paper-analytics__label">Worst trade</span>
            <strong className={`paper-analytics__value ${toneClass(stats.worst.net_realized_pnl)}`}>
              {stats.worst.ticker} {money(stats.worst.net_realized_pnl)}
            </strong>
          </article>
        ) : null}
      </div>
    </div>
  );
}
