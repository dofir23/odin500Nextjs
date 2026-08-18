const supabaseService = require('../../config/supabaseService');
const { placeOrder } = require('./orderEngine');
const { getClosableQty } = require('./positionManager');
const { fetchLatestClosePrices } = require('./pnlCalculator');
const { STARTING_CAPITAL } = require('./dbSchema');
const { runAiPortfolioRebalance } = require('./aiPortfolioCreator');
const { resolvePositionSpec, planAiAllocation } = require('./aiPositionSizing');

const CADENCE_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000
};

function isDue(account) {
  const cadenceMs = CADENCE_MS[account.ai_rebalance_cadence] || CADENCE_MS.daily;
  if (!account.ai_last_rebalanced_at) return true;
  const elapsed = Date.now() - new Date(account.ai_last_rebalanced_at).getTime();
  return elapsed >= cadenceMs;
}

async function listDueAiManagedAccounts() {
  const { data, error } = await supabaseService
    .from('paper_accounts')
    .select('*')
    .eq('ai_managed', true)
    .eq('is_published', true);
  if (error) throw error;
  return (data || []).filter(isDue);
}

/** Current open lots collapsed to one { ticker, action } per (ticker, side) — action = the action that OPENED it. */
async function loadCurrentHoldings(accountId) {
  const { data, error } = await supabaseService
    .from('paper_position_lots')
    .select('ticker, side')
    .eq('account_id', accountId)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (error) throw error;

  const seen = new Map();
  for (const row of data || []) {
    const ticker = String(row.ticker || '').toUpperCase();
    const action = row.side === 'short' ? 'STO' : 'BTO';
    seen.set(`${ticker}:${action}`, { ticker, action });
  }
  return [...seen.values()];
}

async function writeRebalanceLog(accountId, { engine, added, dropped, rawOutput, status, error }) {
  await supabaseService.from('paper_ai_rebalance_log').insert({
    account_id: accountId,
    engine,
    added,
    dropped,
    raw_output: rawOutput ? String(rawOutput).slice(0, 4000) : null,
    status,
    error: error || null
  });
}

/**
 * How many names this account should hold. `ai_position_count` is the user's answer from the
 * creator wizard; accounts created before that column existed fall back to what they're
 * actually holding right now, so a legacy 5- or 10-name book keeps its shape.
 */
function resolveAccountPositionCount(account, currentHoldings) {
  const stored = Number(account.ai_position_count);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return currentHoldings.length || undefined;
}

/**
 * Sizes the names a rebalance is opening, matching how the account was originally built:
 *   - equal_capital  each new name gets one position's dollar slice of the starting capital.
 *   - equal_split / fixed_qty  the per-position share count the book was built with.
 * Accounts created before the sizing columns existed have neither, and fall back to the old
 * equal-dollar split — which is the same math as equal_capital.
 */
function planAddedOrders(account, added, priceMap, totalCount) {
  const capital = Number(account.starting_capital) || STARTING_CAPITAL;
  const storedQty = Number(account.ai_position_qty);
  const isEqualCapital = account.ai_position_sizing === 'equal_capital';

  if (!isEqualCapital && Number.isFinite(storedQty) && storedQty > 0) {
    return planAiAllocation({ holdings: added, priceMap, capital, sizing: 'fixed_qty', qty: storedQty });
  }

  // Size against the book's full name count, not just the names being added, so a rebalance
  // that swaps 2 of 10 gives those 2 a tenth of the capital each — not half.
  const perPositionDollars = capital / Math.max(1, totalCount);
  const orders = [];
  const failed = [];
  for (const h of added) {
    const price = priceMap.get(h.ticker);
    const qty = price ? Math.floor(perPositionDollars / price) : 0;
    if (qty < 1) {
      failed.push({ ticker: h.ticker, action: 'open', error: 'No price or price too high for this position\'s share of the capital' });
      continue;
    }
    orders.push({ ticker: h.ticker, action: h.action, qty });
  }
  return { orders, failed };
}

/**
 * Rebalances one AI-managed account: asks its configured engine for the updated target
 * holdings, diffs against currently open lots, closes drops and opens adds via the normal
 * order engine (sized to the account's per-position share count), leaves unchanged tickers
 * untouched, and logs the run.
 * @param {object} account a row from paper_accounts (ai_managed = true)
 */
async function rebalanceAccount(account) {
  const currentHoldings = await loadCurrentHoldings(account.id);

  let result;
  try {
    result = await runAiPortfolioRebalance({
      userId: account.user_id,
      engine: account.ai_engine,
      indexFocus: account.ai_index_focus,
      direction: account.ai_direction,
      positionCount: resolveAccountPositionCount(account, currentHoldings),
      sizing: account.ai_position_sizing,
      positionQty: account.ai_position_qty,
      criteria: account.ai_criteria,
      cadence: account.ai_rebalance_cadence,
      currentHoldings
    });
  } catch (err) {
    await writeRebalanceLog(account.id, {
      engine: account.ai_engine,
      added: [],
      dropped: [],
      status: 'error',
      error: err.message || 'AI call failed'
    });
    return { accountId: account.id, status: 'error', error: err.message };
  }

  if (!result.proposal) {
    await writeRebalanceLog(account.id, {
      engine: account.ai_engine,
      added: [],
      dropped: [],
      rawOutput: result.reply,
      status: 'no_proposal',
      error: result.reply
    });
    return { accountId: account.id, status: 'no_proposal' };
  }

  const targetHoldings = result.proposal.holdings;
  const currentKeys = new Set(currentHoldings.map((h) => `${h.ticker}:${h.action}`));
  const targetKeys = new Set(targetHoldings.map((h) => `${h.ticker}:${h.action}`));

  const dropped = currentHoldings.filter((h) => !targetKeys.has(`${h.ticker}:${h.action}`));
  const added = targetHoldings.filter((h) => !currentKeys.has(`${h.ticker}:${h.action}`));

  const failed = [];

  for (const h of dropped) {
    try {
      const closable = await getClosableQty(account.id, h.ticker);
      const closeAction = h.action === 'STO' ? 'BTC' : 'STC';
      const qty = h.action === 'STO' ? closable.closableShortQty : closable.closableLongQty;
      if (qty > 0) {
        await placeOrder(account.user_id, {
          accountId: account.id,
          ticker: h.ticker,
          action: closeAction,
          qty,
          orderType: 'market',
          source: 'ai_rebalance'
        });
      }
    } catch (err) {
      failed.push({ ticker: h.ticker, action: 'close', error: err.message });
    }
  }

  if (added.length) {
    const spec = resolvePositionSpec(account.ai_direction, resolveAccountPositionCount(account, currentHoldings));
    const priceMap = await fetchLatestClosePrices(added.map((h) => h.ticker));
    const plan = planAddedOrders(account, added, priceMap, spec.total);
    failed.push(...plan.failed.map((f) => ({ action: 'open', ...f })));

    for (const order of plan.orders) {
      try {
        await placeOrder(account.user_id, {
          accountId: account.id,
          ticker: order.ticker,
          action: order.action,
          qty: order.qty,
          orderType: 'market',
          source: 'ai_rebalance'
        });
      } catch (err) {
        failed.push({ ticker: order.ticker, action: 'open', error: err.message });
      }
    }
  }

  await supabaseService
    .from('paper_accounts')
    .update({ ai_last_rebalanced_at: new Date().toISOString() })
    .eq('id', account.id);

  await writeRebalanceLog(account.id, {
    engine: account.ai_engine,
    added: added.map((h) => h.ticker),
    dropped: dropped.map((h) => h.ticker),
    rawOutput: result.proposal.rationale || result.reply,
    status: failed.length ? 'partial' : 'ok',
    error: failed.length ? JSON.stringify(failed).slice(0, 2000) : null
  });

  return { accountId: account.id, status: failed.length ? 'partial' : 'ok', added, dropped, failed };
}

module.exports = { listDueAiManagedAccounts, loadCurrentHoldings, rebalanceAccount, isDue };
