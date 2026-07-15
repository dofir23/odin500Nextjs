// Pre-trade validation for paper orders.

const { normalizeAction, isBuyAction } = require('./pendingOrderRules');

const MAX_QTY = 10000;

function round6(v) {
  return Math.round(Number(v || 0) * 1000000) / 1000000;
}

/**
 * @param {{ action: string, ticker: string, qty: number, orderType?: string, limitPrice?: number, stopPrice?: number }} order
 * @param {{ cash_balance: number }} account
 * @param {number} currentPrice
 * @param {{ closableLongQty?: number, closableShortQty?: number }} [context]
 */
function validateOrder(order, account, currentPrice, context = {}) {
  const ticker = String(order.ticker || '').trim().toUpperCase();
  if (!ticker) {
    throw new Error('Ticker symbol is required');
  }

  const qty = round6(order.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (qty > MAX_QTY) {
    throw new Error(`Quantity cannot exceed ${MAX_QTY}`);
  }

  const price = Number(currentPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`No market price available for ${ticker}`);
  }

  const action = normalizeAction(order);
  if (!['BTO', 'STO', 'BTC', 'STC'].includes(action)) {
    throw new Error('Action must be one of BTO, STO, BTC, STC');
  }

  const orderType = String(order.orderType || order.order_type || 'market').toLowerCase();
  const limitPrice =
    order.limitPrice != null ? Number(order.limitPrice) : order.limit_price != null ? Number(order.limit_price) : null;
  const stopPrice =
    order.stopPrice != null ? Number(order.stopPrice) : order.stop_price != null ? Number(order.stop_price) : null;

  if (orderType === 'limit') {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      throw new Error('Limit price is required for limit orders');
    }
  }

  if (orderType === 'stop_market' || orderType === 'stop_limit') {
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
      throw new Error('Stop price is required for stop orders');
    }
  }

  if (orderType === 'stop_limit') {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      throw new Error('Limit price is required for stop-limit orders');
    }
  }

  if (orderType === 'stop_market' || orderType === 'stop_limit') {
    if (action === 'STC' && stopPrice >= price) {
      throw new Error('Sell stop must be below the current market price');
    }
    if (action === 'BTC' && stopPrice <= price) {
      throw new Error('Buy stop (cover) must be above the current market price');
    }
    if (action === 'BTO' && stopPrice <= price) {
      throw new Error('Buy stop must be above the current market price');
    }
    if (action === 'STO' && stopPrice >= price) {
      throw new Error('Sell stop (short) must be below the current market price');
    }
  }

  const isBuyCashFlow = action === 'BTO' || action === 'BTC';
  if (isBuyCashFlow) {
    const cost = qty * price * 1.002;
    const cash = Number(account.cash_balance);
    if (!Number.isFinite(cash) || cash < cost) {
      throw new Error('Insufficient cash for this order');
    }
  }

  const closableLong = round6(context.closableLongQty || 0);
  const closableShort = round6(context.closableShortQty || 0);

  // Allow tiny float noise so "close all" matches lot sums.
  if (action === 'STC' && qty > closableLong + 1e-9) {
    throw new Error(`Insufficient long lots to close: open long qty is ${closableLong}`);
  }
  if (action === 'BTC' && qty > closableShort + 1e-9) {
    throw new Error(`Insufficient short lots to close: open short qty is ${closableShort}`);
  }
}

module.exports = { validateOrder, MAX_QTY, normalizeAction, isBuyAction, round6 };
