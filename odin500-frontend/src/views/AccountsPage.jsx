'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { usePaperAccount } from '../hooks/usePaperAccount.js';
import { usePaperOrders } from '../hooks/usePaperOrders.js';
import { usePaperPositions } from '../hooks/usePaperPositions.js';
import { usePaperPortfolioAnalytics } from '../hooks/usePaperPortfolioAnalytics.js';
import { paperActionLabel } from '../components/paper/paperActionLabels.js';
import { exportAccountsSummaryCsv } from '../utils/paperPortfolioExport.js';
import { fmtPct, fmtPctSigned, fmtQty } from '../utils/formatDisplayNumber.js';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(v));
}

function toneClass(v) {
  if (Number(v) > 0) return 'accounts-tone-up';
  if (Number(v) < 0) return 'accounts-tone-down';
  return 'accounts-tone-flat';
}

function positionCostBasis(p) {
  const netQty = Number(p.net_qty) || 0;
  if (netQty > 0 && p.avg_long_cost != null) return Number(p.avg_long_cost);
  if (netQty < 0 && p.avg_short_cost != null) return Number(p.avg_short_cost);
  if (Number(p.long_qty) > 0 && !Number(p.short_qty) && p.avg_long_cost != null) {
    return Number(p.avg_long_cost);
  }
  if (Number(p.short_qty) > 0 && !Number(p.long_qty) && p.avg_short_cost != null) {
    return Number(p.avg_short_cost);
  }
  return p.avg_cost != null ? Number(p.avg_cost) : null;
}

function positionPnlPct(p) {
  if (p.unrealized_pnl_pct != null && Number.isFinite(Number(p.unrealized_pnl_pct))) {
    return Number(p.unrealized_pnl_pct);
  }
  return null;
}

function formatActivityTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

function activityStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'filled') return 'filled';
  if (s === 'pending' || s === 'submitted') return 'warning';
  if (s === 'cancelled' || s === 'canceled' || s === 'rejected') return 'warning';
  return 'settled';
}

function riskFromAccount(acc) {
  const equity = Number(acc.equity) || 0;
  const cash = Number(acc.cash) || 0;
  if (equity <= 0) return { label: 'Low', key: 'low' };
  const investedPct = ((equity - cash) / equity) * 100;
  if (investedPct >= 85) return { label: 'High', key: 'high' };
  if (investedPct >= 50) return { label: 'Medium', key: 'medium' };
  return { label: 'Low', key: 'low' };
}

export default function AccountsPage() {
  const {
    accounts,
    account,
    activeAccountId,
    setActiveAccountId,
    loading: accountLoading,
    error: accountError
  } = usePaperAccount();

  const {
    summaries,
    sectors,
    sectorEquity,
    loading: analyticsLoading,
    error: analyticsError
  } = usePaperPortfolioAnalytics({ accountId: activeAccountId, enabled: true });

  const selectedAccountId = activeAccountId || summaries[0]?.id || accounts[0]?.id || '';

  const { positions, loading: positionsLoading } = usePaperPositions({
    enabled: Boolean(selectedAccountId),
    accountId: selectedAccountId
  });

  const { orders, loading: ordersLoading } = usePaperOrders({
    accountId: selectedAccountId
  });

  const [exporting, setExporting] = useState(false);

  const accountMetaById = useMemo(() => {
    const map = new Map();
    for (const row of accounts || []) map.set(row.id, row);
    return map;
  }, [accounts]);

  const linkedAccounts = useMemo(() => {
    if (summaries.length) {
      return summaries.map((row) => {
        const meta = accountMetaById.get(row.id);
        return {
          ...row,
          is_published: Boolean(meta?.is_published ?? row.is_published),
          starting_capital: Number(row.starting_capital ?? meta?.starting_capital) || 0
        };
      });
    }
    return (accounts || []).map((row) => ({
      id: row.id,
      name: row.name,
      equity: null,
      cash: Number(row.cash_balance) || 0,
      total_return: null,
      total_return_pct: null,
      unrealized_pnl_total: null,
      realized_pnl_total: null,
      positions_count: null,
      is_automated: false,
      is_published: Boolean(row.is_published),
      starting_capital: Number(row.starting_capital) || 0
    }));
  }, [summaries, accounts, accountMetaById]);

  const totals = useMemo(() => {
    const equity = linkedAccounts.reduce((s, a) => s + (Number(a.equity) || 0), 0);
    const cash = linkedAccounts.reduce((s, a) => s + (Number(a.cash) || 0), 0);
    const totalReturn = linkedAccounts.reduce((s, a) => s + (Number(a.total_return) || 0), 0);
    const unrealized = linkedAccounts.reduce((s, a) => s + (Number(a.unrealized_pnl_total) || 0), 0);
    const invested = Math.max(0, equity - cash);
    const bpUsed = equity > 0 ? (invested / equity) * 100 : 0;
    return { equity, cash, totalReturn, unrealized, bpUsed };
  }, [linkedAccounts]);

  const topPositions = useMemo(() => {
    return [...(positions || [])]
      .sort((a, b) => Math.abs(Number(b.market_value) || 0) - Math.abs(Number(a.market_value) || 0))
      .slice(0, 8);
  }, [positions]);

  const recentActivity = useMemo(() => {
    return [...(orders || [])]
      .sort((a, b) => {
        const ta = new Date(a.filled_at || a.submitted_at || a.created_at || 0).getTime();
        const tb = new Date(b.filled_at || b.submitted_at || b.created_at || 0).getTime();
        return tb - ta;
      })
      .slice(0, 5)
      .map((o) => {
        const actionLabel = paperActionLabel(o.action) || String(o.side || 'Order');
        const qtyLabel = fmtQty(o.qty);
        const ticker = String(o.ticker || '').toUpperCase();
        return {
          id: o.id,
          time: formatActivityTime(o.filled_at || o.submitted_at || o.created_at),
          event: `${actionLabel} ${ticker}`.trim(),
          detail: `${qtyLabel} · ${String(o.order_type || 'market')}`,
          status: String(o.status || 'unknown')
        };
      });
  }, [orders]);

  const riskCockpit = useMemo(() => {
    const topSector = [...(sectors || [])].sort(
      (a, b) => (Number(b.weight_pct) || 0) - (Number(a.weight_pct) || 0)
    )[0];
    const concentration = Number(topSector?.weight_pct) || 0;
    const equity = Number(sectorEquity) || totals.equity || Number(account?.equity) || 0;
    const cash = Number(account?.cash_balance ?? account?.cash) || totals.cash || 0;
    const cashPct = equity > 0 ? (cash / equity) * 100 : 0;
    const unrealized = totals.unrealized;
    const unrealizedPct = equity > 0 ? (unrealized / equity) * 100 : 0;

    return {
      concentration,
      concentrationLabel: topSector
        ? `${fmtPct(concentration, { plainPositive: true, decimals: 0 })} (${topSector.sector})`
        : 'No open sector exposure',
      cashPct,
      cashLabel: `${fmtPct(cashPct, { plainPositive: true, decimals: 0 })} cash buffer`,
      unrealizedPct,
      unrealizedLabel: `${fmtPctSigned(unrealizedPct, { decimals: 1 })} open P&L vs equity`
    };
  }, [sectors, sectorEquity, totals.equity, totals.cash, totals.unrealized, account]);

  const loading = accountLoading || analyticsLoading;
  const error = accountError || analyticsError;
  const selectedName =
    linkedAccounts.find((a) => a.id === selectedAccountId)?.name || account?.name || 'Portfolio';

  function handleExport() {
    if (!linkedAccounts.length) return;
    setExporting(true);
    try {
      exportAccountsSummaryCsv(summaries.length ? summaries : linkedAccounts);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="accounts-page">
      <header className="accounts-hero">
        <div>
          <p className="accounts-hero__eyebrow">Portfolio command center</p>
          <h1 className="accounts-hero__title">Accounts</h1>
          <p className="accounts-hero__sub">
            Live view of your virtual portfolios — balances, open positions, sector risk, and recent order
            activity.
          </p>
        </div>
        <div className="accounts-hero__actions">
          <button
            type="button"
            className="accounts-btn accounts-btn--ghost"
            disabled={!linkedAccounts.length || exporting}
            onClick={handleExport}
          >
            {exporting ? 'Exporting…' : 'Export Snapshot'}
          </button>
          <Link to="/paper-trading" className="accounts-btn accounts-btn--primary">
            Open portfolios
          </Link>
        </div>
      </header>

      {error ? (
        <p className="accounts-alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="accounts-kpis" aria-busy={loading}>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Net account value</span>
          <strong className="accounts-kpi__value">
            {loading && !linkedAccounts.length ? '…' : money(totals.equity)}
          </strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Total return</span>
          <strong className={`accounts-kpi__value ${toneClass(totals.totalReturn)}`}>
            {loading && !linkedAccounts.length ? '…' : money(totals.totalReturn)}
          </strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Capital invested</span>
          <strong className="accounts-kpi__value">
            {loading && !linkedAccounts.length
              ? '…'
              : fmtPct(totals.bpUsed, { plainPositive: true, decimals: 1 })}
          </strong>
        </article>
        <article className="accounts-kpi">
          <span className="accounts-kpi__label">Cash available</span>
          <strong className="accounts-kpi__value">
            {loading && !linkedAccounts.length ? '…' : money(totals.cash)}
          </strong>
        </article>
      </section>

      <section className="accounts-grid">
        <article className="accounts-card">
          <h2 className="accounts-card__title">Portfolios</h2>
          {loading && !linkedAccounts.length ? (
            <p className="accounts-empty">Loading portfolios…</p>
          ) : !linkedAccounts.length ? (
            <p className="accounts-empty">
              No virtual portfolios yet.{' '}
              <Link to="/paper-trading" className="accounts-inline-link">
                Create one
              </Link>
            </p>
          ) : (
            <div className="accounts-account-list">
              {linkedAccounts.map((acc) => {
                const risk = riskFromAccount(acc);
                const selected = acc.id === selectedAccountId;
                const returnPct = acc.total_return_pct;
                return (
                  <button
                    type="button"
                    className={'accounts-account' + (selected ? ' accounts-account--selected' : '')}
                    key={acc.id}
                    onClick={() => setActiveAccountId(acc.id)}
                    aria-pressed={selected}
                  >
                    <div>
                      <h3>{acc.name || 'Portfolio'}</h3>
                      <p>
                        Virtual portfolio
                        {acc.is_automated ? ' · Auto' : ''}
                        {acc.is_published ? ' · Public' : ''}
                      </p>
                    </div>
                    <div className="accounts-account__nums">
                      <strong>{money(acc.equity)}</strong>
                      <span className={toneClass(returnPct)}>
                        {returnPct == null ? '—' : fmtPctSigned(returnPct, { decimals: 2 })} total
                      </span>
                    </div>
                    <span className={`accounts-risk accounts-risk--${risk.key}`}>{risk.label} risk</span>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <article className="accounts-card">
          <h2 className="accounts-card__title">Risk cockpit</h2>
          <p className="accounts-card__hint">Based on {selectedName}</p>
          <div className="accounts-risk-grid">
            <div>
              <p className="accounts-mini__label">Concentration risk</p>
              <div className="accounts-meter">
                <span style={{ width: `${Math.min(100, Math.max(0, riskCockpit.concentration))}%` }} />
              </div>
              <p className="accounts-mini__value">{riskCockpit.concentrationLabel}</p>
            </div>
            <div>
              <p className="accounts-mini__label">Cash buffer</p>
              <div className="accounts-meter">
                <span style={{ width: `${Math.min(100, Math.max(0, riskCockpit.cashPct))}%` }} />
              </div>
              <p className="accounts-mini__value">{riskCockpit.cashLabel}</p>
            </div>
            <div>
              <p className="accounts-mini__label">Open P&amp;L vs equity</p>
              <div className="accounts-meter">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.abs(riskCockpit.unrealizedPct) * 4))}%`
                  }}
                />
              </div>
              <p className={`accounts-mini__value ${toneClass(riskCockpit.unrealizedPct)}`}>
                {riskCockpit.unrealizedLabel}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="accounts-grid accounts-grid--table">
        <article className="accounts-card">
          <div className="accounts-card__head">
            <h2 className="accounts-card__title">Top positions</h2>
            <Link to="/paper-trading" className="accounts-link-btn">
              Open full blotter
            </Link>
          </div>
          <div className="accounts-table-wrap">
            {positionsLoading && !topPositions.length ? (
              <p className="accounts-empty">Loading positions…</p>
            ) : !topPositions.length ? (
              <p className="accounts-empty">No open positions in {selectedName}.</p>
            ) : (
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Avg</th>
                    <th>Last</th>
                    <th>Value</th>
                    <th>P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {topPositions.map((p) => {
                    const avg = positionCostBasis(p);
                    const pnlPct = positionPnlPct(p);
                    const pnl = Number(p.unrealized_pnl);
                    return (
                      <tr key={`${p.ticker}-${p.net_qty}`}>
                        <td>
                          <Link
                            to={`/ticker/${encodeURIComponent(String(p.ticker || '').toLowerCase())}`}
                            className="accounts-inline-link"
                          >
                            {String(p.ticker || '').toUpperCase()}
                          </Link>
                        </td>
                        <td>{fmtQty(p.net_qty ?? p.qty)}</td>
                        <td>{money(avg)}</td>
                        <td>{money(p.current_price)}</td>
                        <td>{money(p.market_value)}</td>
                        <td className={toneClass(pnl)}>
                          {money(pnl)}{' '}
                          <span>{pnlPct == null ? '' : fmtPctSigned(pnlPct, { decimals: 2 })}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>

        <article className="accounts-card">
          <div className="accounts-card__head">
            <h2 className="accounts-card__title">Live activity</h2>
            <Link to="/paper-trading" className="accounts-link-btn">
              View orders
            </Link>
          </div>
          <div className="accounts-activity">
            {ordersLoading && !recentActivity.length ? (
              <p className="accounts-empty">Loading activity…</p>
            ) : !recentActivity.length ? (
              <p className="accounts-empty">No recent orders for {selectedName}.</p>
            ) : (
              recentActivity.map((a) => (
                <div className="accounts-activity__item" key={a.id}>
                  <span className="accounts-activity__time">{a.time}</span>
                  <div>
                    <p className="accounts-activity__event">{a.event}</p>
                    <p className="accounts-activity__detail">{a.detail}</p>
                  </div>
                  <span
                    className={`accounts-activity__status accounts-activity__status--${activityStatusClass(a.status)}`}
                  >
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
