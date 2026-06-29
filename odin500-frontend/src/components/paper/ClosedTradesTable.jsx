'use client';
import { paperActionLabel } from './paperActionLabels.js';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function toneClass(v) {
  if (Number(v) > 0) return 'paper-tone-up';
  if (Number(v) < 0) return 'paper-tone-down';
  return '';
}

export function ClosedTradesTable({ trades, totals, loading }) {
  if (loading && !trades?.length) return <p className="paper-empty">Loading closed trades…</p>;
  if (!trades?.length) return <p className="paper-empty">No closed trades yet</p>;

  return (
    <div className="paper-table-wrap">
      <table className="paper-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Symbol</th>
            <th>Qty</th>
            <th>Avg entry</th>
            <th>Avg exit</th>
            <th>Fees</th>
            <th>Net P&amp;L</th>
            <th>Closed at</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id}>
              <td>{paperActionLabel(t.action)}</td>
              <td className="paper-table__sym">{t.ticker}</td>
              <td>{t.qty_closed}</td>
              <td>{money(t.avg_entry_price)}</td>
              <td>{money(t.avg_exit_price)}</td>
              <td>{money(t.total_fees)}</td>
              <td className={toneClass(t.net_realized_pnl)}>{money(t.net_realized_pnl)}</td>
              <td>{fmtTime(t.closed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals ? (
        <p className="paper-order__estimate" style={{ marginTop: '0.5rem' }}>
          Closed gross: <strong>{money(totals.gross_realized_pnl)}</strong> · Closed net:{' '}
          <strong className={toneClass(totals.net_realized_pnl)}>{money(totals.net_realized_pnl)}</strong>
        </p>
      ) : null}
    </div>
  );
}

