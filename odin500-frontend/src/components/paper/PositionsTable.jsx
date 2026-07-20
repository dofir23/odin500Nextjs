'use client';
import { useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { fmtAbsSigned, fmtPctSigned, fmtQty, roundQty6 } from '../../utils/formatDisplayNumber.js';
import { PaperSortableTh } from './PaperSortableTh.jsx';
import { PositionOrderModal, getClosableLegs } from './ClosePositionModal.jsx';
import { PaperManageModal } from './PaperManageModal.jsx';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

function closeAllConfirmCopy(position) {
  const sym = position?.ticker ? String(position.ticker).toUpperCase() : 'this ticker';
  const legs = getClosableLegs(position);
  if (!legs.length) {
    return `Close all open quantity for ${sym}?`;
  }
  const parts = legs.map((leg) => `${fmtQty(leg.qty)} ${leg.sideLabel.toLowerCase()} shares`);
  const qtyLine = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Close all open quantity for ${sym}? This will flatten ${qtyLine} with market order${legs.length > 1 ? 's' : ''}.`;
}

function toneClass(v) {
  if (Number(v) > 0) return 'paper-tone-up';
  if (Number(v) < 0) return 'paper-tone-down';
  return '';
}

function positionCostBasis(p) {
  const netQty = Number(p.net_qty) || 0;
  if (netQty > 0 && p.avg_long_cost != null) return Number(p.avg_long_cost);
  if (netQty < 0 && p.avg_short_cost != null) return Number(p.avg_short_cost);
  if (Number(p.long_qty) > 0 && !Number(p.short_qty) && p.avg_long_cost != null) return Number(p.avg_long_cost);
  if (Number(p.short_qty) > 0 && !Number(p.long_qty) && p.avg_short_cost != null) return Number(p.avg_short_cost);
  return null;
}

function positionChangePerShare(p) {
  const price = Number(p.current_price);
  if (!Number.isFinite(price)) return null;
  const cost = positionCostBasis(p);
  if (cost == null || !Number.isFinite(cost)) return null;
  const netQty = Number(p.net_qty) || 0;
  if (netQty > 0) return price - cost;
  if (netQty < 0) return cost - price;
  return null;
}

function positionChangePct(p) {
  if (p.unrealized_pnl_pct != null && Number.isFinite(Number(p.unrealized_pnl_pct))) {
    return Number(p.unrealized_pnl_pct);
  }
  const cost = positionCostBasis(p);
  const change = positionChangePerShare(p);
  if (cost == null || change == null || cost <= 0) return null;
  return (change / cost) * 100;
}

function sortValue(p, key) {
  switch (key) {
    case 'ticker':
      return String(p.ticker || '').toUpperCase();
    case 'long_qty':
      return Number(p.long_qty) || 0;
    case 'short_qty':
      return Number(p.short_qty) || 0;
    case 'net_qty':
      return Number(p.net_qty) || 0;
    case 'avg_long_cost':
      return p.avg_long_cost == null ? null : Number(p.avg_long_cost);
    case 'avg_short_cost':
      return p.avg_short_cost == null ? null : Number(p.avg_short_cost);
    case 'current_price':
      return p.current_price == null ? null : Number(p.current_price);
    case 'cost_basis':
      return positionCostBasis(p);
    case 'change':
      return positionChangePerShare(p);
    case 'change_pct':
      return positionChangePct(p);
    case 'market_value':
      return p.market_value == null ? null : Number(p.market_value);
    case 'unrealized_pnl':
      return p.unrealized_pnl == null ? null : Number(p.unrealized_pnl);
    default:
      return null;
  }
}

function sortPositions(positions, sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...(positions || [])].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);

    if (sortKey === 'ticker') {
      const as = String(av || '');
      const bs = String(bv || '');
      if (as === bs) return 0;
      return as < bs ? -1 * dir : 1 * dir;
    }

    const aOk = av != null && Number.isFinite(Number(av));
    const bOk = bv != null && Number.isFinite(Number(bv));
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    if (Number(av) === Number(bv)) return 0;
    return Number(av) < Number(bv) ? -1 * dir : 1 * dir;
  });
}

export function PositionsTable({ positions, loading, onPlaceOrder, readOnly = false }) {
  const [orderModal, setOrderModal] = useState(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [closeAllPosition, setCloseAllPosition] = useState(null);
  const [closeAllBusy, setCloseAllBusy] = useState(false);
  const [closeAllError, setCloseAllError] = useState('');
  const [sortKey, setSortKey] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');

  const sortedPositions = useMemo(
    () => sortPositions(positions, sortKey, sortDir),
    [positions, sortKey, sortDir]
  );

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'ticker' ? 'asc' : 'desc');
  };

  async function handleOrderConfirm(orderInput) {
    if (!onPlaceOrder) {
      throw new Error('Order placement is unavailable');
    }
    setOrderBusy(true);
    try {
      await onPlaceOrder(orderInput);
    } finally {
      setOrderBusy(false);
    }
  }

  async function handleCloseAllConfirm() {
    if (!closeAllPosition || !onPlaceOrder) return;
    const legs = getClosableLegs(closeAllPosition);
    if (!legs.length) {
      setCloseAllPosition(null);
      return;
    }
    setCloseAllBusy(true);
    setCloseAllError('');
    try {
      const sym = String(closeAllPosition.ticker || '').toUpperCase();
      for (const leg of legs) {
        await onPlaceOrder({
          ticker: sym,
          action: leg.action,
          qty: roundQty6(leg.qty),
          orderType: 'market'
        });
      }
      setCloseAllPosition(null);
    } catch (err) {
      setCloseAllError(err?.message || 'Failed to close position');
    } finally {
      setCloseAllBusy(false);
    }
  }

  if (loading && !positions?.length) {
    return <p className="paper-empty">Loading positions…</p>;
  }

  if (!positions?.length) {
    return (
      <div className="paper-empty">
        <p>No open positions</p>
        {!readOnly ? (
          <p className="paper-empty__hint">Search a symbol and place a buy order to get started.</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="paper-table-wrap">
        <table className="paper-table paper-table--positions">
          <thead>
            <tr>
              <PaperSortableTh label="Symbol" sortKey="ticker" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <PaperSortableTh
                label="Long qty"
                sortKey="long_qty"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Short qty"
                sortKey="short_qty"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Net qty"
                sortKey="net_qty"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Avg long"
                sortKey="avg_long_cost"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Avg short"
                sortKey="avg_short_cost"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Last price"
                sortKey="current_price"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Cost basis"
                sortKey="cost_basis"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Change"
                sortKey="change"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Chg %"
                sortKey="change_pct"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              <PaperSortableTh
                label="Net market value"
                sortKey="market_value"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
                title="Long MV minus short liability"
              />
              <PaperSortableTh
                label="Unrealized P&L"
                sortKey="unrealized_pnl"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                align="right"
              />
              {readOnly ? null : <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((p) => {
              const lastPrice = p.current_price;
              const costBasis = positionCostBasis(p);
              const changePerShare = positionChangePerShare(p);
              const changePct = positionChangePct(p);
              const closableLegs = getClosableLegs(p);
              const canTrade = Boolean(onPlaceOrder);
              const canClose = closableLegs.length > 0 && canTrade;
              return (
                <tr key={p.id || p.ticker}>
                  <td>
                    <Link
                      to={`/ticker/${encodeURIComponent(p.ticker)}`}
                      className="paper-table__sym paper-table__sym-link"
                      title={`View ${p.ticker} chart and data`}
                    >
                      {p.ticker}
                    </Link>
                  </td>
                  <td>{fmtQty(p.long_qty)}</td>
                  <td>{fmtQty(p.short_qty)}</td>
                  <td>{fmtQty(p.net_qty)}</td>
                  <td>{money(p.avg_long_cost)}</td>
                  <td>{money(p.avg_short_cost)}</td>
                  <td>{money(lastPrice)}</td>
                  <td>{money(costBasis)}</td>
                  <td className={toneClass(changePerShare)}>
                    {changePerShare != null ? fmtAbsSigned(changePerShare) : '—'}
                  </td>
                  <td className={toneClass(changePct)}>
                    {changePct != null ? fmtPctSigned(changePct) : '—'}
                  </td>
                  <td className={toneClass(p.market_value)}>
                    {money(p.market_value)}
                    {Number(p.short_qty) > 0 && Number(p.long_qty) > 0 ? (
                      <span className="paper-table__sub">
                        L {money(p.long_market_value)} · S −{money(p.short_market_value)}
                      </span>
                    ) : null}
                  </td>
                  <td className={toneClass(p.unrealized_pnl)}>
                    {money(p.unrealized_pnl)}
                    <span className="paper-table__sub">
                      {changePct != null ? fmtPctSigned(changePct) : ''}
                    </span>
                  </td>
                  {readOnly ? null : (
                  <td className="paper-table__actions">
                    {canTrade ? (
                      <div className="paper-pos-actions">
                        <button
                          type="button"
                          className="paper-pos-action-btn paper-pos-action-btn--buy"
                          onClick={() => setOrderModal({ position: p, mode: 'buy' })}
                          title={`Buy or short more ${p.ticker}`}
                        >
                          Buy
                        </button>
                        {canClose ? (
                          <>
                            <button
                              type="button"
                              className="paper-pos-action-btn paper-pos-action-btn--sell"
                              onClick={() => setOrderModal({ position: p, mode: 'close' })}
                              title={`Sell or cover part of ${p.ticker}`}
                            >
                              Sell
                            </button>
                            <button
                              type="button"
                              className="paper-pos-action-btn paper-pos-action-btn--close"
                              onClick={() => {
                                setCloseAllError('');
                                setCloseAllPosition(p);
                              }}
                              title={`Close all ${p.ticker} quantity`}
                            >
                              Close
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PositionOrderModal
        open={orderModal != null}
        position={orderModal?.position ?? null}
        mode={orderModal?.mode ?? 'close'}
        onClose={() => {
          if (!orderBusy) setOrderModal(null);
        }}
        onConfirm={handleOrderConfirm}
        busy={orderBusy}
      />

      <PaperManageModal
        open={closeAllPosition != null}
        title={
          closeAllPosition?.ticker
            ? `Close ${String(closeAllPosition.ticker).toUpperCase()}`
            : 'Close position'
        }
        titleId="paper-close-all-position-title"
        modalClassName="paper-close-all-modal"
        onClose={() => {
          if (!closeAllBusy) {
            setCloseAllError('');
            setCloseAllPosition(null);
          }
        }}
        footer={
          <div className="paper-rule-edit-modal__actions">
            <button
              type="button"
              className="paper-btn paper-btn--ghost"
              onClick={() => {
                if (!closeAllBusy) {
                  setCloseAllError('');
                  setCloseAllPosition(null);
                }
              }}
              disabled={closeAllBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="paper-btn paper-btn--danger"
              onClick={() => void handleCloseAllConfirm()}
              disabled={closeAllBusy}
            >
              {closeAllBusy ? 'Closing…' : 'Confirm'}
            </button>
          </div>
        }
      >
        <p className="paper-modal-msg">{closeAllConfirmCopy(closeAllPosition)}</p>
        {closeAllError ? <p className="paper-strategy-err">{closeAllError}</p> : null}
      </PaperManageModal>
    </>
  );
}
