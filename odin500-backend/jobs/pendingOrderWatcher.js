// Polls pending limit/stop paper orders (interval: paperJobRunner, default every 4h).

const supabaseService = require('../config/supabaseService');
const { executeFill } = require('../services/paper/orderEngine');
const { simulateFill } = require('../services/paper/executionSimulator');
const { getCurrentPrice } = require('../services/paper/pnlCalculator');
const { evaluatePendingOrder } = require('../services/paper/pendingOrderRules');

async function checkPendingOrders() {
  const { data: orders, error } = await supabaseService
    .from('paper_orders')
    .select('*')
    .eq('status', 'pending')
    .in('order_type', ['limit', 'stop_market', 'stop_limit']);

  if (error) throw error;
  if (!orders?.length) return { filled: 0, armed: 0 };

  let filled = 0;
  let armed = 0;

  for (const order of orders) {
    try {
      const price = await getCurrentPrice(order.ticker);
      if (price == null) continue;

      const evalResult = evaluatePendingOrder(order, price);
      if (evalResult.kind === 'none') continue;

      if (evalResult.kind === 'arm_stop') {
        const nextMeta = { ...(order.metadata || {}), stop_triggered: true };
        const { error: armErr } = await supabaseService
          .from('paper_orders')
          .update({ metadata: nextMeta })
          .eq('id', order.id)
          .eq('status', 'pending');
        if (armErr) throw armErr;
        armed += 1;
        continue;
      }

      const remaining = Number(order.qty) - Number(order.filled_qty || 0);
      if (remaining <= 0) continue;

      const fillPrice = evalResult.fillPrice ?? price;
      const action = String(order.action || '').toUpperCase() || (String(order.side).toLowerCase() === 'buy' ? 'BTO' : 'STC');
      const fill = simulateFill(action, remaining, fillPrice);
      await executeFill(order.account_id, order, fill, price);
      filled += 1;
    } catch (err) {
      console.warn('[paper-pending-watcher] order', order.id, err?.message || err);
    }
  }

  return { filled, armed };
}

module.exports = { checkPendingOrders };
