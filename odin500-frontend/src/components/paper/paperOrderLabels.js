'use client';
const ORDER_TYPE_LABELS = {
  market: 'Market',
  limit: 'Limit',
  stop_market: 'Stop',
  stop_limit: 'Stop limit'
};

export function paperOrderTypeLabel(type) {
  const key = String(type || '').toLowerCase();
  return ORDER_TYPE_LABELS[key] || key || '—';
}

export const PAPER_ORDER_TYPE_OPTIONS = [
  { id: 'market', label: 'Market' },
  { id: 'limit', label: 'Limit' },
  { id: 'stop_market', label: 'Stop' },
  { id: 'stop_limit', label: 'Stop limit' }
];

/**
 * @param {object} order
 * @returns {string}
 */
export function formatOrderPriceSummary(order) {
  if (!order) return '—';
  const type = String(order.order_type || '').toLowerCase();
  const stop = order.stop_price != null ? Number(order.stop_price) : null;
  const limit = order.limit_price != null ? Number(order.limit_price) : null;
  const parts = [];

  if (type === 'stop_market' || type === 'stop_limit') {
    if (Number.isFinite(stop)) parts.push(`Stop ${stop.toFixed(2)}`);
  }
  if (type === 'limit' || type === 'stop_limit') {
    if (Number.isFinite(limit)) parts.push(`Limit ${limit.toFixed(2)}`);
  }
  if (!parts.length && order.avg_fill_price != null) {
    return Number(order.avg_fill_price).toFixed(2);
  }
  return parts.length ? parts.join(' · ') : '—';
}

export function pendingOrderSuccessMessage(orderType) {
  const type = String(orderType || '').toLowerCase();
  if (type === 'limit') return 'Limit order queued — fills when price is reached (checked on daily close)';
  if (type === 'stop_market') return 'Stop order queued — fills when stop price is reached (checked on daily close)';
  if (type === 'stop_limit') {
    return 'Stop-limit order queued — activates at stop, then fills at limit (checked on daily close)';
  }
  return 'Order queued';
}
