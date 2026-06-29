// Pure rules for when pending paper orders should fill.

function normalizeAction(order) {
  const act = String(order.action || '').toUpperCase().trim();
  if (['BTO', 'STO', 'BTC', 'STC'].includes(act)) return act;
  const side = String(order.side || '').toLowerCase();
  return side === 'buy' ? 'BTO' : 'STC';
}

function isBuyAction(action) {
  return action === 'BTO' || action === 'BTC';
}

function isStopTriggered(action, stop, price) {
  if (stop == null || !Number.isFinite(stop)) return false;
  if (isBuyAction(action)) return price >= stop;
  return price <= stop;
}

function isLimitSatisfied(action, limit, price) {
  if (limit == null || !Number.isFinite(limit)) return false;
  if (isBuyAction(action)) return price <= limit;
  return price >= limit;
}

function isStopTriggeredMeta(order) {
  return Boolean(order?.metadata?.stop_triggered);
}

/**
 * Evaluate a pending order against the current market price.
 * @returns {{ kind: 'none' | 'arm_stop' | 'fill', fillPrice?: number }}
 */
function evaluatePendingOrder(order, currentPrice) {
  const price = Number(currentPrice);
  if (!Number.isFinite(price) || price <= 0) return { kind: 'none' };

  const type = String(order.order_type || '').toLowerCase();
  const action = normalizeAction(order);
  const limit = order.limit_price != null ? Number(order.limit_price) : null;
  const stop = order.stop_price != null ? Number(order.stop_price) : null;

  if (type === 'limit') {
    if (!isLimitSatisfied(action, limit, price)) return { kind: 'none' };
    return { kind: 'fill', fillPrice: price };
  }

  if (type === 'stop_market') {
    if (!isStopTriggered(action, stop, price)) return { kind: 'none' };
    return { kind: 'fill', fillPrice: price };
  }

  if (type === 'stop_limit') {
    if (!isStopTriggeredMeta(order)) {
      if (!isStopTriggered(action, stop, price)) return { kind: 'none' };
      return { kind: 'arm_stop' };
    }
    if (!isLimitSatisfied(action, limit, price)) return { kind: 'none' };
    return { kind: 'fill', fillPrice: limit };
  }

  return { kind: 'none' };
}

/**
 * Worst-case price for buying-power checks.
 */
function priceForRiskCheck(order, marketPrice) {
  const type = String(order.orderType || order.order_type || 'market').toLowerCase();
  const market = Number(marketPrice);
  const limit = order.limitPrice != null ? Number(order.limitPrice) : order.limit_price != null ? Number(order.limit_price) : null;
  const stop = order.stopPrice != null ? Number(order.stopPrice) : order.stop_price != null ? Number(order.stop_price) : null;
  const action = normalizeAction(order);
  const candidates = [market];

  if (type === 'limit' && limit != null) candidates.push(limit);
  if ((type === 'stop_market' || type === 'stop_limit') && stop != null) candidates.push(stop);
  if (type === 'stop_limit' && limit != null) candidates.push(limit);

  if (isBuyAction(action)) {
    return Math.max(...candidates.filter((n) => Number.isFinite(n) && n > 0));
  }
  return market;
}

module.exports = {
  normalizeAction,
  isBuyAction,
  evaluatePendingOrder,
  priceForRiskCheck,
  isStopTriggered,
  isLimitSatisfied
};
