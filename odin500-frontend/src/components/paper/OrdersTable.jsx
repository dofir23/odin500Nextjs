'use client';
import { useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { paperActionLabel } from './paperActionLabels.js';
import { formatOrderPriceSummary, paperOrderTypeLabel } from './paperOrderLabels.js';
import { PendingOrderEditModal } from './PendingOrderEditModal.jsx';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function SidePill({ side, action }) {
  const s = String(side).toLowerCase();
  const label = paperActionLabel(action) || s;
  return <span className={'paper-side-pill paper-side-pill--' + s}>{label}</span>;
}

function StatusPill({ status }) {
  const s = String(status || '').toLowerCase();
  return <span className={'paper-status paper-status--' + s}>{status}</span>;
}

export function OrdersTable({ orders, loading, onCancel, onModify }) {
  const [editOrder, setEditOrder] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const pending = (orders || []).filter((o) => o.status === 'pending');
  const history = (orders || []).filter((o) => o.status !== 'pending');

  async function handleSave(patch) {
    if (!editOrder || !onModify) return;
    setEditBusy(true);
    try {
      await onModify(editOrder.id, patch);
      setEditOrder(null);
    } finally {
      setEditBusy(false);
    }
  }

  function renderRow(o) {
    const canEdit =
      o.status === 'pending' &&
      onModify &&
      !o.metadata?.stop_triggered &&
      ['limit', 'stop_market', 'stop_limit'].includes(String(o.order_type || '').toLowerCase());

    return (
      <tr key={o.id}>
        <td>
          <SidePill side={o.side} action={o.action} />
        </td>
        <td>
          <Link
            to={`/ticker/${encodeURIComponent(o.ticker)}`}
            className="paper-table__sym paper-table__sym-link"
          >
            {o.ticker}
          </Link>
        </td>
        <td>{o.qty}</td>
        <td>{paperOrderTypeLabel(o.order_type)}</td>
        <td>{formatOrderPriceSummary(o)}</td>
        <td>
          <StatusPill status={o.status} />
        </td>
        <td>{formatTime(o.filled_at || o.submitted_at)}</td>
        <td className="paper-table__actions">
          {canEdit ? (
            <button type="button" className="paper-order-action-btn" onClick={() => setEditOrder(o)}>
              Edit
            </button>
          ) : null}
          {o.status === 'pending' && onCancel ? (
            <button type="button" className="paper-cancel-btn" onClick={() => void onCancel(o.id)}>
              Cancel
            </button>
          ) : null}
        </td>
      </tr>
    );
  }

  const head = (
    <thead>
      <tr>
        <th>Side</th>
        <th>Symbol</th>
        <th>Qty</th>
        <th>Type</th>
        <th>Price</th>
        <th>Status</th>
        <th>Time</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <div className="paper-orders-panel">
      <h3 className="paper-section-title">Pending</h3>
      {loading && !pending.length ? (
        <p className="paper-empty">Loading orders…</p>
      ) : !pending.length ? (
        <p className="paper-empty">No pending orders</p>
      ) : (
        <div className="paper-table-wrap">
          <table className="paper-table">
            {head}
            <tbody>{pending.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      <h3 className="paper-section-title">History</h3>
      {!history.length ? (
        <p className="paper-empty">No filled or cancelled orders yet</p>
      ) : (
        <div className="paper-table-wrap">
          <table className="paper-table">
            {head}
            <tbody>{history.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      <PendingOrderEditModal
        open={editOrder != null}
        order={editOrder}
        onClose={() => {
          if (!editBusy) setEditOrder(null);
        }}
        onSave={handleSave}
        busy={editBusy}
      />
    </div>
  );
}
