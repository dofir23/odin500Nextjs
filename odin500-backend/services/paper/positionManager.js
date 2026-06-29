// FIFO lot accounting for paper trading.
// Stores open lots in paper_position_lots and closures in paper_lot_closures / paper_trades_closed.

const supabaseService = require('../../config/supabaseService');

/**
 * @param {'BTO'|'STO'|'BTC'|'STC'} action
 */
function mapAction(action) {
  const act = String(action || '').toUpperCase();
  if (!['BTO', 'STO', 'BTC', 'STC'].includes(act)) throw new Error(`Unsupported action: ${action}`);
  return act;
}

function round6(v) {
  return Math.round(Number(v || 0) * 1000000) / 1000000;
}

async function incrementCash(accountId, amount) {
  const { error } = await supabaseService.rpc('increment_cash', {
    p_account_id: accountId,
    p_amount: amount
  });
  if (error) throw error;
}

async function createOpenLot(accountId, order, fill) {
  const side = order.action === 'STO' ? 'short' : 'long';
  const { data, error } = await supabaseService
    .from('paper_position_lots')
    .insert({
      account_id: accountId,
      ticker: String(order.ticker || '').toUpperCase(),
      side,
      opened_qty: fill.fillQty,
      remaining_qty: fill.fillQty,
      entry_price: fill.fillPrice,
      entry_fees: fill.totalFees || 0,
      source_order_id: order.id
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function closeLotsFifo(accountId, order, fill) {
  const ticker = String(order.ticker || '').toUpperCase();
  const closeAction = mapAction(order.action);
  const closeLong = closeAction === 'STC';
  const targetSide = closeLong ? 'long' : 'short';
  const { data: lots, error: lotsErr } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', accountId)
    .eq('ticker', ticker)
    .eq('side', targetSide)
    .eq('status', 'open')
    .gt('remaining_qty', 0)
    .order('opened_at', { ascending: true });
  if (lotsErr) throw lotsErr;

  let remaining = round6(fill.fillQty);
  let grossRealized = 0;
  let netRealized = 0;
  let closedQty = 0;
  let weightedEntry = 0;
  const closureRows = [];

  for (const lot of lots || []) {
    if (remaining <= 0) break;
    const lotQty = Math.min(remaining, Number(lot.remaining_qty || 0));
    if (lotQty <= 0) continue;
    remaining = round6(remaining - lotQty);
    closedQty += lotQty;
    weightedEntry += lotQty * Number(lot.entry_price || 0);

    const openPrice = Number(lot.entry_price || 0);
    const closePrice = Number(fill.fillPrice || 0);
    const gross = closeLong ? (closePrice - openPrice) * lotQty : (openPrice - closePrice) * lotQty;
    const proportionalFees = (Number(fill.totalFees || 0) * lotQty) / Number(fill.fillQty || 1);
    const net = gross - proportionalFees;
    grossRealized += gross;
    netRealized += net;

    closureRows.push({
      account_id: accountId,
      ticker,
      close_order_id: order.id,
      close_fill_id: fill.fillId || null,
      open_lot_id: lot.id,
      close_action: closeAction,
      qty: lotQty,
      open_price: openPrice,
      close_price: closePrice,
      gross_realized_pnl: gross,
      fees_allocated: proportionalFees,
      net_realized_pnl: net,
      closed_at: new Date().toISOString()
    });

    const nextRemaining = round6(Number(lot.remaining_qty || 0) - lotQty);
    const nextStatus = nextRemaining <= 0 ? 'closed' : 'open';
    const { error: lotUpdErr } = await supabaseService
      .from('paper_position_lots')
      .update({
        remaining_qty: nextRemaining,
        status: nextStatus,
        closed_at: nextStatus === 'closed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', lot.id);
    if (lotUpdErr) throw lotUpdErr;
  }

  if (remaining > 0) {
    throw new Error(`Not enough ${targetSide} lots to close ${fill.fillQty} shares of ${ticker}`);
  }

  if (closureRows.length) {
    const { error: closureErr } = await supabaseService.from('paper_lot_closures').insert(closureRows);
    if (closureErr) throw closureErr;
  }

  const avgEntry = closedQty > 0 ? weightedEntry / closedQty : 0;
  const avgExit = Number(fill.fillPrice || 0);
  const { error: tradeErr } = await supabaseService.from('paper_trades_closed').insert({
    account_id: accountId,
    ticker,
    close_order_id: order.id,
    close_fill_id: fill.fillId || null,
    action: closeAction,
    qty_closed: closedQty,
    avg_entry_price: avgEntry,
    avg_exit_price: avgExit,
    gross_realized_pnl: grossRealized,
    total_fees: Number(fill.totalFees || 0),
    net_realized_pnl: netRealized,
    closed_at: new Date().toISOString()
  });
  if (tradeErr) throw tradeErr;

  return { grossRealized, netRealized, closedQty, avgEntry, avgExit };
}

/**
 * @param {string} accountId
 * @param {{ action: string, ticker: string, id?: string }} order
 * @param {{ fillPrice: number, fillQty: number, totalFees?: number, fillId?: string }} fill
 */
async function applyFill(accountId, order, fill) {
  const ticker = String(order.ticker || '').trim().toUpperCase();
  const action = mapAction(order.action || order.side);
  const fillPrice = Number(fill.fillPrice);
  const fillQty = Number(fill.fillQty);
  const totalFees = Number(fill.totalFees || 0);
  if (!ticker || !Number.isFinite(fillPrice) || fillPrice <= 0 || !Number.isFinite(fillQty) || fillQty <= 0) {
    throw new Error('Invalid fill data');
  }

  const grossNotional = fillQty * fillPrice;
  const isBuyCash = action === 'BTO' || action === 'BTC';
  const cashDelta = isBuyCash ? -(grossNotional + totalFees) : grossNotional - totalFees;
  await incrementCash(accountId, cashDelta);

  if (action === 'BTO' || action === 'STO') {
    await createOpenLot(accountId, { ...order, action, ticker }, { ...fill, totalFees });
    return { opened: fillQty, closed: 0, realized: 0 };
  }

  const out = await closeLotsFifo(accountId, { ...order, action, ticker }, { ...fill, totalFees });
  return { opened: 0, closed: out.closedQty, realized: out.netRealized };
}

async function getClosableQty(accountId, ticker) {
  const sym = String(ticker || '').toUpperCase().trim();
  if (!sym) return { closableLongQty: 0, closableShortQty: 0 };
  const { data, error } = await supabaseService
    .from('paper_position_lots')
    .select('side, remaining_qty')
    .eq('account_id', accountId)
    .eq('ticker', sym)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (error) throw error;
  let closableLongQty = 0;
  let closableShortQty = 0;
  for (const row of data || []) {
    if (row.side === 'long') closableLongQty += Number(row.remaining_qty || 0);
    if (row.side === 'short') closableShortQty += Number(row.remaining_qty || 0);
  }
  return {
    closableLongQty: round6(closableLongQty),
    closableShortQty: round6(closableShortQty)
  };
}

module.exports = { applyFill, getClosableQty };
