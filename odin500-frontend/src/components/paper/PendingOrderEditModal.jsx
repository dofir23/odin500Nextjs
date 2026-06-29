'use client';
import { useEffect, useState } from 'react';
import { PaperManageModal } from './PaperManageModal.jsx';
import { paperOrderTypeLabel } from './paperOrderLabels.js';

/**
 * @param {{
 *   open: boolean,
 *   order: object | null,
 *   onClose: () => void,
 *   onSave: (patch: { qty: number, limitPrice?: number | null, stopPrice?: number | null }) => Promise<void>,
 *   busy?: boolean
 * }} props
 */
export function PendingOrderEditModal({ open, order, onClose, onSave, busy = false }) {
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [error, setError] = useState('');

  const orderType = String(order?.order_type || '').toLowerCase();
  const showLimit = orderType === 'limit' || orderType === 'stop_limit';
  const showStop = orderType === 'stop_market' || orderType === 'stop_limit';

  useEffect(() => {
    if (!open || !order) return;
    setQty(String(order.qty ?? ''));
    setLimitPrice(order.limit_price != null ? String(order.limit_price) : '');
    setStopPrice(order.stop_price != null ? String(order.stop_price) : '');
    setError('');
  }, [open, order]);

  async function handleSave() {
    setError('');
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid quantity');
      return;
    }

    const patch = { qty: quantity };

    if (showLimit) {
      const lp = Number(limitPrice);
      if (!Number.isFinite(lp) || lp <= 0) {
        setError('Enter a valid limit price');
        return;
      }
      patch.limitPrice = lp;
    }

    if (showStop) {
      const sp = Number(stopPrice);
      if (!Number.isFinite(sp) || sp <= 0) {
        setError('Enter a valid stop price');
        return;
      }
      patch.stopPrice = sp;
    }

    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not update order');
    }
  }

  return (
    <PaperManageModal
      open={open}
      title={`Edit ${order?.ticker || ''} order`}
      titleId="paper-pending-order-edit-title"
      onClose={() => {
        if (!busy) onClose();
      }}
      modalClassName="paper-pending-edit-modal"
      footer={
        <>
          <button type="button" className="paper-btn paper-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="paper-btn paper-btn--primary" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {order ? (
        <div className="paper-pending-edit">
          <p className="paper-pending-edit__meta">
            {paperOrderTypeLabel(order.order_type)} · {String(order.action || '').toUpperCase()}
          </p>
          <label className="paper-field">
            <span className="paper-field__label">Quantity</span>
            <input
              type="number"
              className="paper-field__input"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={busy}
            />
          </label>
          {showStop ? (
            <label className="paper-field">
              <span className="paper-field__label">Stop price</span>
              <input
                type="number"
                className="paper-field__input"
                min="0"
                step="0.01"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                disabled={busy}
              />
            </label>
          ) : null}
          {showLimit ? (
            <label className="paper-field">
              <span className="paper-field__label">Limit price</span>
              <input
                type="number"
                className="paper-field__input"
                min="0"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={busy}
              />
            </label>
          ) : null}
          {error ? <p className="paper-feedback paper-feedback--err">{error}</p> : null}
        </div>
      ) : null}
    </PaperManageModal>
  );
}
