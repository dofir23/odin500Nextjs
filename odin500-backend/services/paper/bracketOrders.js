// Bracket / OCO exit orders after entry fills.

const crypto = require('crypto');
const supabaseService = require('../../config/supabaseService');
const { actionToLegacySide } = require('./orderEngineHelpers');

/**
 * @param {{ stopLoss?: number, takeProfit?: number }} bracket
 * @param {string} action BTO | STO
 * @param {number} referencePrice
 */
function validateBracket(bracket, action, referencePrice) {
  if (!bracket || typeof bracket !== 'object') return null;
  const stopLoss = bracket.stopLoss != null ? Number(bracket.stopLoss) : bracket.stop_loss != null ? Number(bracket.stop_loss) : null;
  const takeProfit =
    bracket.takeProfit != null ? Number(bracket.takeProfit) : bracket.take_profit != null ? Number(bracket.take_profit) : null;

  if ((!stopLoss || stopLoss <= 0) && (!takeProfit || takeProfit <= 0)) {
    throw new Error('Bracket requires at least a stop-loss or take-profit price');
  }

  const ref = Number(referencePrice);
  if (!Number.isFinite(ref) || ref <= 0) {
    throw new Error('Cannot attach bracket without a valid entry price');
  }

  const act = String(action).toUpperCase();
  if (act === 'BTO') {
    if (stopLoss != null && stopLoss > 0 && stopLoss >= ref) {
      throw new Error('Long stop-loss must be below the entry price');
    }
    if (takeProfit != null && takeProfit > 0 && takeProfit <= ref) {
      throw new Error('Long take-profit must be above the entry price');
    }
  } else if (act === 'STO') {
    if (stopLoss != null && stopLoss > 0 && stopLoss <= ref) {
      throw new Error('Short stop-loss must be above the entry price');
    }
    if (takeProfit != null && takeProfit > 0 && takeProfit >= ref) {
      throw new Error('Short take-profit must be below the entry price');
    }
  } else {
    throw new Error('Bracket orders are only supported on opening trades (BTO or STO)');
  }

  return {
    stopLoss: stopLoss != null && stopLoss > 0 ? stopLoss : null,
    takeProfit: takeProfit != null && takeProfit > 0 ? takeProfit : null
  };
}

/**
 * @param {string} accountId
 * @param {object} entryOrder filled entry order
 * @param {number} fillQty
 * @param {number} fillPrice
 */
async function createBracketExits(accountId, entryOrder, fillQty, fillPrice) {
  const bracket = entryOrder.metadata?.bracket;
  if (!bracket) return [];

  const validated = validateBracket(bracket, entryOrder.action, fillPrice);
  if (!validated) return [];

  const ticker = String(entryOrder.ticker || '').toUpperCase();
  const qty = Number(fillQty);
  const ocoGroupId = crypto.randomUUID();
  const action = String(entryOrder.action || '').toUpperCase();
  const isLong = action === 'BTO';
  const exitAction = isLong ? 'STC' : 'BTC';
  const exitSide = actionToLegacySide(exitAction);
  const legs = [];

  if (validated.stopLoss != null) {
    legs.push({
      account_id: accountId,
      ticker,
      side: exitSide,
      action: exitAction,
      qty,
      order_type: 'stop_market',
      stop_price: validated.stopLoss,
      limit_price: null,
      source: 'bracket',
      metadata: {
        oco_group_id: ocoGroupId,
        oco_role: 'stop_loss',
        parent_order_id: entryOrder.id
      },
      status: 'pending'
    });
  }

  if (validated.takeProfit != null) {
    legs.push({
      account_id: accountId,
      ticker,
      side: exitSide,
      action: exitAction,
      qty,
      order_type: 'limit',
      stop_price: null,
      limit_price: validated.takeProfit,
      source: 'bracket',
      metadata: {
        oco_group_id: ocoGroupId,
        oco_role: 'take_profit',
        parent_order_id: entryOrder.id
      },
      status: 'pending'
    });
  }

  if (!legs.length) return [];

  const { data, error } = await supabaseService.from('paper_orders').insert(legs).select('*');
  if (error) throw error;
  return data || [];
}

async function cancelOcoSiblings(filledOrder) {
  const groupId = filledOrder?.metadata?.oco_group_id;
  if (!groupId) return;

  const { data: pending, error: selErr } = await supabaseService
    .from('paper_orders')
    .select('id, metadata')
    .eq('account_id', filledOrder.account_id)
    .eq('status', 'pending');

  if (selErr) {
    console.warn('[paper-bracket] list OCO siblings:', selErr.message);
    return;
  }

  const siblingIds = (pending || [])
    .filter((row) => row.id !== filledOrder.id && row.metadata?.oco_group_id === groupId)
    .map((row) => row.id);

  if (!siblingIds.length) return;

  const { error } = await supabaseService
    .from('paper_orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .in('id', siblingIds);

  if (error) {
    console.warn('[paper-bracket] cancel OCO siblings:', error.message);
  }
}

module.exports = {
  validateBracket,
  createBracketExits,
  cancelOcoSiblings
};
