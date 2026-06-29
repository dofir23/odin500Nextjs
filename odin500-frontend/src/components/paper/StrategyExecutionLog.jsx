'use client';
import { paperActionLabel } from './paperActionLabels.js';
import { formatRuleQty } from './strategyRuleUtils.js';

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function ruleLabel(row) {
  const r = row?.paper_strategy_rules;
  if (!r) return row?.rule_id ? String(row.rule_id).slice(0, 8) : '—';
  return `${r.rule_type || 'rule'} · ${r.ticker || ''} · ${paperActionLabel(r.action)} ×${formatRuleQty(r)}`;
}

export function StrategyExecutionLog({ log = [], loading = false }) {
  if (loading) {
    return <p className="paper-strategy-muted">Loading execution log…</p>;
  }
  if (!log.length) {
    return (
      <div className="paper-strategy-log-empty">
        <p className="paper-strategy-log-empty__title">No trades yet</p>
        <p className="paper-strategy-muted">
          The system is actively monitoring your tickers. Any automated buys, sells, or skipped trades will
          appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="paper-table-wrap">
      <table className="paper-table paper-strategy-log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Rule</th>
            <th>Status</th>
            <th>Message</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {log.map((row) => (
            <tr key={row.id}>
              <td>{fmtTime(row.ran_at)}</td>
              <td>{ruleLabel(row)}</td>
              <td>
                <span className={`paper-strategy-status paper-strategy-status--${row.status}`}>
                  {row.status}
                </span>
              </td>
              <td>{row.message || '—'}</td>
              <td className="paper-mono">{row.order_id ? String(row.order_id).slice(0, 8) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
