'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ThemedDropdown } from '../ThemedDropdown.jsx';
import { PaperManageModal } from './PaperManageModal.jsx';
import { paperActionLabel } from './paperActionLabels.js';

function money(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

export function getClosableLegs(position) {
  if (!position) return [];
  const long = Number(position.long_qty) || 0;
  const short = Number(position.short_qty) || 0;
  const legs = [];
  if (long > 0) {
    legs.push({
      key: 'long',
      action: 'STC',
      sideLabel: 'Long',
      verb: 'Sell',
      qty: long,
      avgCost: position.avg_long_cost
    });
  }
  if (short > 0) {
    legs.push({
      key: 'short',
      action: 'BTC',
      sideLabel: 'Short',
      verb: 'Cover',
      qty: short,
      avgCost: position.avg_short_cost
    });
  }
  return legs;
}

/** Opening legs — always offer long (BTO) and short (STO) when adding to a position. */
export function getOpenableLegs(position) {
  if (!position) return [];
  const longQty = Number(position.long_qty) || 0;
  const shortQty = Number(position.short_qty) || 0;
  return [
    {
      key: 'long',
      action: 'BTO',
      sideLabel: 'Long',
      verb: 'Buy',
      openQty: longQty,
      avgCost: position.avg_long_cost
    },
    {
      key: 'short',
      action: 'STO',
      sideLabel: 'Short',
      verb: 'Short',
      openQty: shortQty,
      avgCost: position.avg_short_cost
    }
  ];
}

function defaultOpenLegKey(longQty, shortQty) {
  if (shortQty > 0 && longQty === 0) return 'short';
  if (longQty > 0 && shortQty === 0) return 'long';
  if (shortQty > longQty) return 'short';
  return 'long';
}

const BUY_QTY_PRESETS = [1, 5, 10, 25, 50];

function buildPositionSummary(position, leg, isBuy) {
  const sym = position?.ticker ? String(position.ticker).toUpperCase() : '';
  const last = money(position?.current_price);
  const net = position?.net_qty ?? 0;
  if (!leg) return `${sym} · Last ${last} · Net qty ${net}`;

  if (isBuy) {
    const openPart =
      leg.openQty > 0
        ? `${leg.sideLabel} ${leg.openQty} @ ${money(leg.avgCost)}`
        : `No open ${leg.sideLabel.toLowerCase()}`;
    return `${sym} · ${openPart} · Last ${last} · Net qty ${net}`;
  }

  return `${sym} · ${leg.sideLabel} ${leg.qty} @ ${money(leg.avgCost)} · Last ${last} · Net qty ${net}`;
}

/**
 * @param {'close' | 'buy'} mode
 */
export function PositionOrderModal({ open, position, mode = 'close', onClose, onConfirm, busy = false }) {
  const isBuy = mode === 'buy';
  const closeLegs = useMemo(() => getClosableLegs(position), [position]);
  const openLegs = useMemo(() => getOpenableLegs(position), [position]);
  const legs = isBuy ? openLegs : closeLegs;
  const [legKey, setLegKey] = useState('long');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const qtyInputRef = useRef(null);

  const leg = legs.find((l) => l.key === legKey) || legs[0];
  const quantity = Number(qty);
  const sym = position?.ticker ? String(position.ticker).toUpperCase() : '';
  const longQty = Number(position?.long_qty) || 0;
  const shortQty = Number(position?.short_qty) || 0;
  const isShortOpen = isBuy && leg?.action === 'STO';

  const legOptions = useMemo(
    () =>
      legs.map((l) => ({
        id: l.key,
        label: `${l.sideLabel} · ${paperActionLabel(l.action)}`
      })),
    [legs]
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    if (isBuy) {
      const nextKey = defaultOpenLegKey(longQty, shortQty);
      setLegKey(nextKey);
      setQty('');
      requestAnimationFrame(() => qtyInputRef.current?.focus());
      return;
    }
    if (!closeLegs.length) return;
    setLegKey(closeLegs[0].key);
    setQty(String(closeLegs[0].qty));
  }, [open, isBuy, position?.ticker, position?.long_qty, position?.short_qty, closeLegs, longQty, shortQty]);

  async function handleSubmit() {
    if (!position) return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (!leg) return;
    if (!isBuy && quantity > leg.qty) {
      setError(`Maximum ${leg.verb.toLowerCase()} qty: ${leg.qty}`);
      return;
    }
    setError('');
    try {
      await onConfirm({
        ticker: sym,
        action: leg.action,
        qty: quantity,
        orderType: 'market'
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Order failed');
    }
  }

  if (!position) return null;
  if (!isBuy && !closeLegs.length) return null;
  if (isBuy && !openLegs.length) return null;

  const estPrice = position.current_price;
  const estTotal =
    Number.isFinite(quantity) && quantity > 0 && estPrice != null && Number.isFinite(Number(estPrice))
      ? quantity * Number(estPrice)
      : null;

  const modalClass =
    'paper-rule-edit-modal paper-pos-order-modal' +
    (isBuy ? ' paper-pos-order-modal--buy' : ' paper-pos-order-modal--close');

  const title = isBuy ? `Buy ${sym}` : `Close ${sym}`;
  const submitClass = isBuy
    ? isShortOpen
      ? ' paper-btn--submit-short'
      : ' paper-btn--submit-entry'
    : ' paper-btn--submit-exit';
  const submitLabel = busy
    ? 'Submitting…'
    : `${leg?.verb ?? 'Submit'} ${quantity > 0 ? quantity : ''} ${sym}`.trim();

  const hintText = isBuy && leg?.action === 'BTO'
    ? 'Adds to your long position with a market buy order. Quantity is filled at the latest available price.'
    : isBuy && leg?.action === 'STO'
      ? 'Adds to your short position with a market short order. Quantity is filled at the latest available price.'
      : leg?.action === 'STC'
        ? 'Closes part or all of your long position with a market sell order.'
        : 'Closes part or all of your short position with a market cover order.';

  return (
    <PaperManageModal
      open={open}
      title={title}
      titleId="paper-pos-order-title"
      modalClassName={modalClass}
      onClose={onClose}
      footer={
        <div className="paper-rule-edit-modal__actions">
          <button type="button" className="paper-btn paper-btn--danger" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={'paper-btn' + submitClass}
            onClick={() => void handleSubmit()}
            disabled={busy}
          >
            {submitLabel}
          </button>
        </div>
      }
    >
      <div className="paper-rule-edit-modal__summary-card">
        <span className="paper-rule-edit-modal__summary-label">Current position</span>
        <p className="paper-rule-edit-modal__summary">{buildPositionSummary(position, leg, isBuy)}</p>
      </div>

      <div className="paper-strategy-rule-form paper-strategy-rule-form--modal paper-pos-order-modal__form">
        <div className="paper-strategy-rule-form__layout">
          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--primary">
            <label className="paper-field paper-strategy-rule-form__field--rule-type">
              <span className="paper-field__label">Action</span>
              {legOptions.length > 1 ? (
                <ThemedDropdown
                  className="paper-strategy-rule-form__dd"
                  wideLabel
                  value={legKey}
                  options={legOptions}
                  disabled={busy}
                  onChange={(id) => {
                    setLegKey(id);
                    const picked = legs.find((l) => l.key === id);
                    if (!isBuy && picked) setQty(String(picked.qty));
                    setError('');
                  }}
                  ariaLabelPrefix="Action"
                  labelFallback="Action"
                />
              ) : (
                <input
                  type="text"
                  className="paper-input"
                  readOnly
                  value={leg ? `${leg.sideLabel} · ${paperActionLabel(leg.action)}` : '—'}
                />
              )}
            </label>
            <label className="paper-field paper-strategy-rule-form__field--tickers">
              <span className="paper-field__label">Ticker</span>
              <input type="text" className="paper-input" readOnly value={sym} />
            </label>
          </div>

          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--secondary">
            <label className="paper-field paper-strategy-rule-form__field--qty">
              <span className="paper-field__label">
                {isBuy
                  ? leg?.action === 'STO'
                    ? 'Shares to short'
                    : 'Shares to buy'
                  : `Quantity to ${leg?.verb.toLowerCase()}`}
              </span>
              <input
                ref={qtyInputRef}
                type="number"
                className="paper-input"
                min="1"
                max={isBuy ? undefined : leg?.qty}
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={busy}
                placeholder={isBuy ? 'Enter quantity' : String(leg?.qty ?? '')}
              />
            </label>
            <label className="paper-field paper-strategy-rule-form__field--max">
              <span className="paper-field__label">{isBuy ? 'Last price' : 'Max available'}</span>
              <input
                type="text"
                className="paper-input"
                readOnly
                value={isBuy ? money(estPrice) : leg ? String(leg.qty) : '—'}
              />
            </label>
          </div>
        </div>

        <div className="paper-pos-order-modal__presets" aria-label="Quick quantity">
          {isBuy
            ? BUY_QTY_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="paper-qty-presets__btn"
                  onClick={() => setQty(String(n))}
                  disabled={busy}
                >
                  {n}
                </button>
              ))
            : leg ? (
                <button
                  type="button"
                  className="paper-qty-presets__btn paper-qty-presets__btn--all"
                  onClick={() => setQty(String(leg.qty))}
                  disabled={busy}
                >
                  ALL ({leg.qty})
                </button>
              ) : null}
        </div>

        <p className="paper-strategy-muted paper-strategy-rule-form__hint">{hintText}</p>

        {estTotal != null ? (
          <p className="paper-strategy-muted paper-strategy-rule-form__hint paper-pos-order-modal__estimate">
            Est. order value: <strong>{money(estTotal)}</strong>
            <span className="paper-order__estimate-meta">
              {' '}
              ({quantity} × {money(estPrice)}, mkt est.)
            </span>
          </p>
        ) : null}

        {error ? <p className="paper-strategy-err">{error}</p> : null}
      </div>
    </PaperManageModal>
  );
}

/** @deprecated Use PositionOrderModal with mode="close" */
export function ClosePositionModal(props) {
  return <PositionOrderModal {...props} mode="close" />;
}
