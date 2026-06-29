'use client';
import { useEffect, useMemo, useState } from 'react';
import { TickerSymbolCombobox } from '../TickerSymbolCombobox.jsx';
import { ThemedDropdown } from '../ThemedDropdown.jsx';
import { canFetchProtectedApi, fetchJsonCached } from '../../store/apiStore.js';
import { sanitizeTickerPageInput } from '../../utils/tickerUrlSync.js';
import {
  PAPER_ACTION_OPTIONS,
  isClosingPaperAction,
  paperActionLabel
} from './paperActionLabels.js';
import { PAPER_ORDER_TYPE_OPTIONS, pendingOrderSuccessMessage } from './paperOrderLabels.js';

const QTY_PRESETS = [10, 25, 50, 100, 500];

function money(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v));
}

function fmtPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function rowDateKey(row) {
  const d = row?.Date ?? row?.date ?? row?.market_date;
  if (d && typeof d === 'object' && d.value != null) return String(d.value);
  return String(d || '');
}

function pickClose(row) {
  if (!row || typeof row !== 'object') return null;
  const candidates = [row.Close, row.close, row.close_price, row.price, row.Adj_Close, row.adj_close];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function latestCloseFromOhlcPayload(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => rowDateKey(b).localeCompare(rowDateKey(a)));
  for (const row of sorted) {
    const close = pickClose(row);
    if (close != null) return close;
  }
  return null;
}

function isOpeningAction(action) {
  return action === 'BTO' || action === 'STO';
}

export function OrderTicket({ onPlaceOrder, positions = [], strategyActive = false, initialTicker = '' }) {
  const [ticker, setTicker] = useState('');
  const [action, setAction] = useState('BTO');
  const [orderType, setOrderType] = useState('market');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [bracketStopLoss, setBracketStopLoss] = useState('');
  const [bracketTakeProfit, setBracketTakeProfit] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sym = sanitizeTickerPageInput(initialTicker);
    if (sym) setTicker(sym);
  }, [initialTicker]);

  const sym = ticker.trim().toUpperCase();
  const quantity = Number(qty);
  const held = useMemo(() => {
    const row = positions.find((p) => String(p.ticker).toUpperCase() === sym);
    return row
      ? {
          long: Number(row.long_qty || 0),
          short: Number(row.short_qty || 0),
          currentPrice:
            row.current_price != null && Number.isFinite(Number(row.current_price))
              ? Number(row.current_price)
              : null
        }
      : { long: 0, short: 0, currentPrice: null };
  }, [positions, sym]);

  const isBuy = action === 'BTO' || action === 'BTC';
  const isClose = isClosingPaperAction(action);
  const closableQty = action === 'STC' ? held.long : action === 'BTC' ? held.short : 0;
  const showBracket = isOpeningAction(action);

  const [marketPrice, setMarketPrice] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    if (!showBracket) setBracketEnabled(false);
  }, [showBracket]);

  useEffect(() => {
    if (!sym) {
      setMarketPrice(null);
      setPriceBusy(false);
      setPriceError('');
      return undefined;
    }

    setPriceError('');
    setMarketPrice(held.currentPrice != null ? held.currentPrice : null);

    if (!canFetchProtectedApi()) {
      setPriceBusy(false);
      if (held.currentPrice == null) {
        setPriceError('Sign in to load market price');
      }
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setPriceBusy(true);
      try {
        const res = await fetchJsonCached({
          path: '/api/market/ohlc?symbol=' + encodeURIComponent(sym) + '&limit=5',
          method: 'GET',
          ttlMs: 60 * 1000
        });
        if (cancelled) return;
        const close = latestCloseFromOhlcPayload(res.data);
        if (close != null) {
          setMarketPrice(close);
          setPriceError('');
        } else if (held.currentPrice == null) {
          setPriceError('No price data for this symbol');
        }
      } catch (err) {
        if (!cancelled && held.currentPrice == null) {
          setPriceError(err?.message || 'Could not load price');
        }
      } finally {
        if (!cancelled) setPriceBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, held.currentPrice]);

  const referencePrice = useMemo(() => {
    if (orderType === 'limit' || orderType === 'stop_limit') {
      const lp = Number(limitPrice);
      if (Number.isFinite(lp) && lp > 0) return lp;
    }
    if (orderType === 'stop_market') {
      const sp = Number(stopPrice);
      if (Number.isFinite(sp) && sp > 0) return sp;
    }
    if (marketPrice != null && Number.isFinite(marketPrice) && marketPrice > 0) return marketPrice;
    return null;
  }, [orderType, limitPrice, stopPrice, marketPrice]);

  const priceAtLabel = fmtPrice(referencePrice);
  const estTotal =
    Number.isFinite(quantity) &&
    quantity > 0 &&
    referencePrice != null &&
    Number.isFinite(referencePrice)
      ? quantity * referencePrice
      : null;

  const submitPriceSuffix = priceAtLabel ? ` @ ${priceAtLabel}` : priceBusy && sym ? ' @ …' : '';

  function onSymbolChange(next) {
    setTicker(next);
    setSuccess('');
    setError('');
  }

  function resetFormFields() {
    setQty('');
    setLimitPrice('');
    setStopPrice('');
    setBracketStopLoss('');
    setBracketTakeProfit('');
    setBracketEnabled(false);
  }

  async function handleSubmit() {
    setError('');
    setSuccess('');
    if (!sym) {
      setError('Search and select a ticker symbol');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (action === 'STC') {
      if (held.long <= 0) {
        setError('No long position to sell');
        return;
      }
      if (held.long < quantity) {
        setError(`Not enough long shares to close. Open long qty: ${held.long}`);
        return;
      }
    }
    if (action === 'BTC') {
      if (held.short <= 0) {
        setError('No short position to cover');
        return;
      }
      if (held.short < quantity) {
        setError(`Not enough short shares to close. Open short qty: ${held.short}`);
        return;
      }
    }

    const body = { ticker: sym, action, qty: quantity, orderType };

    if (orderType === 'limit' || orderType === 'stop_limit') {
      const lp = Number(limitPrice);
      if (!Number.isFinite(lp) || lp <= 0) {
        setError('Enter a valid limit price');
        return;
      }
      body.limitPrice = lp;
    }

    if (orderType === 'stop_market' || orderType === 'stop_limit') {
      const sp = Number(stopPrice);
      if (!Number.isFinite(sp) || sp <= 0) {
        setError('Enter a valid stop price');
        return;
      }
      body.stopPrice = sp;
    }

    if (bracketEnabled && showBracket) {
      const sl = Number(bracketStopLoss);
      const tp = Number(bracketTakeProfit);
      const hasSl = Number.isFinite(sl) && sl > 0;
      const hasTp = Number.isFinite(tp) && tp > 0;
      if (!hasSl && !hasTp) {
        setError('Enter a stop-loss and/or take-profit price for the bracket');
        return;
      }
      body.bracket = {
        ...(hasSl ? { stopLoss: sl } : {}),
        ...(hasTp ? { takeProfit: tp } : {})
      };
    }

    setBusy(true);
    try {
      const result = await onPlaceOrder(body);
      const fillPrice = result?.fill?.fillPrice ?? result?.order?.avg_fill_price;
      if (fillPrice != null) {
        const bracketNote = body.bracket ? ' Bracket exits queued.' : '';
        setSuccess(`Filled ${quantity} @ ${Number(fillPrice).toFixed(2)}.${bracketNote}`);
      } else if (result?.pending) {
        setSuccess(pendingOrderSuccessMessage(orderType));
      } else {
        setSuccess('Order submitted');
      }
      resetFormFields();
    } catch (err) {
      setError(err?.message || 'Order failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-card">
      <div className="paper-card__head">
        <h2 className="paper-card__title">Place order</h2>
        {sym ? <span className="paper-table__sym">{sym}</span> : null}
      </div>
      <div className="paper-card__body paper-order">
        {strategyActive ? (
          <p className="paper-order__strategy-warn" role="status">
            <strong>Automation active:</strong> This portfolio buys and sells automatically. You can place
            manual trades here, but they may override your strategy rules.
          </p>
        ) : null}
        <div className="paper-order__symbol-block">
          <span className="paper-order__symbol-label">Symbol</span>
          <TickerSymbolCombobox
            variant="header"
            symbol={ticker}
            onSymbolChange={onSymbolChange}
            inputId="paper-ticker-search"
            placeholder="Search symbol or company (e.g. NVDA)"
            showOdinSignal
          />
          {sym && (held.long > 0 || held.short > 0) ? (
            <p className="paper-order__estimate">
              Long: <strong>{held.long}</strong> · Short: <strong>{held.short}</strong>
            </p>
          ) : null}
        </div>

        <div className="paper-field">
          <span className="paper-field__label">Action</span>
          <ThemedDropdown
            className="paper-order__dd"
            value={action}
            options={PAPER_ACTION_OPTIONS}
            onChange={setAction}
            title="Order action"
            ariaLabelPrefix="Action"
            labelFallback="Buy"
            wideLabel
            disabled={busy}
          />
        </div>

        <div className="paper-field">
          <span className="paper-field__label">Order type</span>
          <ThemedDropdown
            className="paper-order__dd"
            value={orderType}
            options={PAPER_ORDER_TYPE_OPTIONS}
            onChange={setOrderType}
            title="Order type"
            ariaLabelPrefix="Order type"
            labelFallback="Market"
            wideLabel
            disabled={busy}
          />
        </div>

        {orderType === 'stop_market' || orderType === 'stop_limit' ? (
          <p className="paper-order__help" role="note">
            Stop orders are checked against the latest daily close — not live intraday prices.
          </p>
        ) : null}

        <label className="paper-field">
          <span className="paper-field__label">Quantity (shares)</span>
          <input
            type="number"
            className="paper-field__input"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </label>

        <div className="paper-qty-presets" aria-label="Quick quantity">
          {isClose && closableQty > 0 ? (
            <button
              type="button"
              className="paper-qty-presets__btn paper-qty-presets__btn--all"
              onClick={() => setQty(String(closableQty))}
            >
              ALL ({closableQty})
            </button>
          ) : null}
          {QTY_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              className="paper-qty-presets__btn"
              onClick={() => setQty(String(n))}
            >
              {n}
            </button>
          ))}
        </div>

        {orderType === 'stop_market' || orderType === 'stop_limit' ? (
          <label className="paper-field">
            <span className="paper-field__label">Stop price</span>
            <input
              type="number"
              className="paper-field__input"
              min="0"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
            />
          </label>
        ) : null}

        {orderType === 'limit' || orderType === 'stop_limit' ? (
          <label className="paper-field">
            <span className="paper-field__label">Limit price</span>
            <input
              type="number"
              className="paper-field__input"
              min="0"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.00"
            />
          </label>
        ) : null}

        {showBracket ? (
          <div className="paper-bracket">
            <label className="paper-bracket__toggle">
              <input
                type="checkbox"
                checked={bracketEnabled}
                onChange={(e) => setBracketEnabled(e.target.checked)}
                disabled={busy}
              />
              <span>Set auto-exits (stop-loss / take-profit)</span>
            </label>
            <p className="paper-bracket__hint">
              After your entry fills, optional exit orders are placed. Filling one cancels the other.
            </p>
            {bracketEnabled ? (
              <div className="paper-bracket__fields">
                <label className="paper-field">
                  <span className="paper-field__label">Stop-loss price</span>
                  <input
                    type="number"
                    className="paper-field__input"
                    min="0"
                    step="0.01"
                    value={bracketStopLoss}
                    onChange={(e) => setBracketStopLoss(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <label className="paper-field">
                  <span className="paper-field__label">Take-profit price</span>
                  <input
                    type="number"
                    className="paper-field__input"
                    min="0"
                    step="0.01"
                    value={bracketTakeProfit}
                    onChange={(e) => setBracketTakeProfit(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {sym && referencePrice != null && Number.isFinite(quantity) && quantity > 0 && estTotal != null ? (
          <p className="paper-order__estimate">
            Est. order value: <strong>{money(estTotal)}</strong>
            <span className="paper-order__estimate-meta">
              {' '}
              ({quantity} × {money(referencePrice)}
              {orderType === 'limit' ? ', limit' : orderType === 'market' ? ', mkt est.' : ', ref.'})
            </span>
          </p>
        ) : sym && referencePrice != null ? (
          <p className="paper-order__estimate paper-order__estimate--muted">
            Reference price: <strong>{money(referencePrice)}</strong>
          </p>
        ) : sym && priceBusy ? (
          <p className="paper-order__estimate paper-order__estimate--muted">Loading price estimate…</p>
        ) : sym && priceError ? (
          <p className="paper-feedback paper-feedback--err paper-order__price-err">{priceError}</p>
        ) : null}

        {error ? <p className="paper-feedback paper-feedback--err">{error}</p> : null}
        {success ? <p className="paper-feedback paper-feedback--ok">{success}</p> : null}

        <button
          type="button"
          className={'paper-submit' + (isBuy ? ' paper-submit--buy' : ' paper-submit--sell')}
          disabled={busy || !sym}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Submitting…' : `${paperActionLabel(action)} ${sym || 'stock'}${submitPriceSuffix}`}
        </button>
      </div>
    </div>
  );
}
