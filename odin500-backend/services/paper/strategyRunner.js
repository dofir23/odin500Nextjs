const supabaseService = require('../../config/supabaseService');
const { getCurrentPrice } = require('./pnlCalculator');
const { placeOrder } = require('./orderEngine');
const { getClosableQty } = require('./positionManager');
const {
  getLatestSignalBucket,
  normalizeSignalBucket,
  signalSideFromBucket,
  VALID_BUCKETS
} = require('./latestSignal');

const BINDING_SELECT =
  '*, paper_strategies!inner(*, paper_strategy_rules(*))';

function normalizeAction(action) {
  const a = String(action || '').toUpperCase();
  return ['BTO', 'STO', 'BTC', 'STC'].includes(a) ? a : 'BTO';
}

function isOpeningAction(action) {
  const a = normalizeAction(action);
  return a === 'BTO' || a === 'STO';
}

function isClosingAction(action) {
  const a = normalizeAction(action);
  return a === 'STC' || a === 'BTC';
}

function parseParams(rule) {
  const p = rule?.params;
  if (p && typeof p === 'object' && !Array.isArray(p)) return p;
  return {};
}

function round6(v) {
  return Math.round(Number(v || 0) * 1000000) / 1000000;
}

/**
 * Caps opening order qty by share count and/or dollar notional.
 * When allotFullCap is true, each trigger uses the full remaining allowance under the cap(s).
 * Otherwise ruleQty is applied as a per-trade ceiling (legacy shares-per-trade behavior).
 * @returns {{ ok: true, qty: number } | { ok: false, skipMessage: string }}
 */
function capOpeningOrderQty({
  side,
  ruleQty,
  openQty,
  maxPosQty,
  maxPosValue,
  currentPrice,
  allotFullCap = false
}) {
  const sideLabel = side === 'long' ? 'long' : 'short';
  const hasQtyCap = Number.isFinite(maxPosQty) && maxPosQty > 0;
  const hasValueCap = Number.isFinite(maxPosValue) && maxPosValue > 0;

  if (hasQtyCap || hasValueCap) {
    let qty = Infinity;

    if (hasQtyCap) {
      if (openQty >= maxPosQty) {
        return { ok: false, skipMessage: `Max ${sideLabel} position limit reached` };
      }
      qty = Math.min(qty, maxPosQty - openQty);
    }

    if (hasValueCap) {
      if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
        return { ok: false, skipMessage: 'No price available for max position value check' };
      }
      const currentValue = openQty * currentPrice;
      if (currentValue >= maxPosValue) {
        return { ok: false, skipMessage: `Max ${sideLabel} position value reached` };
      }
      qty = Math.min(qty, (maxPosValue - currentValue) / currentPrice);
    }

    if (!allotFullCap && Number.isFinite(ruleQty) && ruleQty > 0) {
      qty = Math.min(qty, ruleQty);
    }

    qty = round6(qty);
    if (qty <= 0) {
      if (hasValueCap && hasQtyCap) {
        return { ok: false, skipMessage: `Max ${sideLabel} position limit or value reached` };
      }
      if (hasValueCap) {
        return { ok: false, skipMessage: `Max ${sideLabel} position value reached` };
      }
      return { ok: false, skipMessage: `Max ${sideLabel} position limit reached` };
    }

    return { ok: true, qty };
  }

  let qty = ruleQty;

  if (openQty > 0) {
    return { ok: false, skipMessage: `Already in ${sideLabel} position — entry skipped` };
  }

  qty = round6(qty);
  if (qty <= 0) {
    return { ok: false, skipMessage: `Max ${sideLabel} position limit reached` };
  }

  return { ok: true, qty };
}

async function evaluateRule(rule) {
  const ticker = String(rule.ticker || '').toUpperCase().trim();
  const type = String(rule.rule_type || '').toLowerCase();
  const params = parseParams(rule);

  if (type === 'signal_side' || type === 'signal_bucket') {
    const bucket = await getLatestSignalBucket(ticker);
    if (bucket == null) {
      return { shouldTrade: false, message: `No signal for ${ticker}` };
    }
    if (type === 'signal_bucket') {
      const rawList = Array.isArray(params.buckets)
        ? params.buckets
        : params.bucket != null && params.bucket !== ''
          ? [params.bucket]
          : rule.threshold_value != null && rule.threshold_value !== ''
            ? [rule.threshold_value]
            : [];
      const wants = [
        ...new Set(
          rawList
            .map((b) => {
              const s = String(b || '')
                .trim()
                .toUpperCase();
              return VALID_BUCKETS.has(s) ? s : normalizeSignalBucket(s);
            })
            .filter((b) => b && b !== 'N')
        )
      ];
      return {
        shouldTrade: wants.length > 0 && wants.includes(bucket),
        price: null,
        signalBucket: bucket
      };
    }
    const wantSide = String(params.side || '')
      .trim()
      .toLowerCase();
    const side = signalSideFromBucket(bucket);
    return {
      shouldTrade: wantSide === side,
      price: null,
      signalBucket: bucket
    };
  }

  const price = await getCurrentPrice(ticker);
  if (price == null) return { shouldTrade: false, message: `No price for ${ticker}` };
  const threshold = Number(rule.threshold_value);

  if (type === 'price_above') {
    return { shouldTrade: Number.isFinite(threshold) ? price >= threshold : false, price };
  }
  if (type === 'price_below') {
    return { shouldTrade: Number.isFinite(threshold) ? price <= threshold : false, price };
  }
  if (type === 'always') {
    return { shouldTrade: true, price };
  }
  return { shouldTrade: false, message: `Unsupported rule_type ${rule.rule_type}` };
}

/**
 * Resolves order qty from rule + current position.
 * Opens: respects params.max_position_qty and params.max_position_value (whichever caps first).
 * Closes: params.close_all closes entire side; otherwise min(rule qty, open qty).
 * @param {number|null} [currentPrice] — latest close; required when max_position_value is set
 * @returns {{ ok: true, qty: number, action: string } | { ok: false, skipMessage: string }}
 */
function resolveOrderFromRule(rule, position, currentPrice = null) {
  const action = normalizeAction(rule.action);
  const params = parseParams(rule);
  const closeAll = params.close_all === true;
  const ruleQty = Number(rule.qty || 0);

  if (!closeAll && (!Number.isFinite(ruleQty) || ruleQty <= 0)) {
    return { ok: false, skipMessage: 'Invalid rule quantity' };
  }

  const longQty = Number(position?.closableLongQty || 0);
  const shortQty = Number(position?.closableShortQty || 0);
  const maxPos = Number(params.max_position_qty);
  const maxPosValue = Number(params.max_position_value);
  const allotFullCap =
    params.allot_full_cap === true ||
    (params.allot_full_cap !== false &&
      Number.isFinite(maxPosValue) &&
      maxPosValue > 0);

  if (action === 'BTO') {
    const capped = capOpeningOrderQty({
      side: 'long',
      ruleQty,
      openQty: longQty,
      maxPosQty: maxPos,
      maxPosValue,
      currentPrice,
      allotFullCap
    });
    if (!capped.ok) return capped;
    return { ok: true, qty: capped.qty, action };
  }

  if (action === 'STO') {
    const capped = capOpeningOrderQty({
      side: 'short',
      ruleQty,
      openQty: shortQty,
      maxPosQty: maxPos,
      maxPosValue,
      currentPrice,
      allotFullCap
    });
    if (!capped.ok) return capped;
    return { ok: true, qty: capped.qty, action };
  }

  if (action === 'STC') {
    if (longQty <= 0) {
      return { ok: false, skipMessage: 'No long position to close' };
    }
    const qty = closeAll ? longQty : Math.min(ruleQty, longQty);
    return { ok: true, qty, action };
  }

  if (action === 'BTC') {
    if (shortQty <= 0) {
      return { ok: false, skipMessage: 'No short position to close' };
    }
    const qty = closeAll ? shortQty : Math.min(ruleQty, shortQty);
    return { ok: true, qty, action };
  }

  return { ok: false, skipMessage: `Unsupported action ${action}` };
}

function rulesFromBinding(binding) {
  const strategy = binding.paper_strategies;
  if (!strategy) return { strategy: null, rules: [] };
  const rules = (strategy.paper_strategy_rules || []).filter((r) => r.is_active !== false);
  return { strategy, rules };
}

async function loadPositionsForRules(accountId, rules) {
  const tickers = [
    ...new Set(
      rules.map((r) => String(r.ticker || '').toUpperCase().trim()).filter(Boolean)
    )
  ];
  const cache = new Map();
  await Promise.all(
    tickers.map(async (ticker) => {
      cache.set(ticker, await getClosableQty(accountId, ticker));
    })
  );
  return cache;
}

async function logStrategyEvent({ strategyId, accountId, ruleId, status, message, orderId = null }) {
  await supabaseService.from('paper_strategy_execution_log').insert({
    strategy_id: strategyId,
    account_id: accountId,
    rule_id: ruleId,
    status,
    message,
    order_id: orderId
  });
}

async function processBinding(binding) {
  const { strategy, rules } = rulesFromBinding(binding);
  if (!strategy || strategy.is_active === false) {
    return { triggered: 0, failed: 0 };
  }

  const positionByTicker = await loadPositionsForRules(binding.account_id, rules);

  let triggered = 0;
  let failed = 0;

  for (const rule of rules) {
    try {
      const evalOut = await evaluateRule(rule);
      if (!evalOut.shouldTrade) continue;

      const ticker = String(rule.ticker || '').toUpperCase().trim();
      const position = positionByTicker.get(ticker) || {
        closableLongQty: 0,
        closableShortQty: 0
      };

      const params = parseParams(rule);
      const action = normalizeAction(rule.action);
      const needsPrice =
        isOpeningAction(action) &&
        Number.isFinite(Number(params.max_position_value)) &&
        Number(params.max_position_value) > 0;
      let price = evalOut.price;
      if (needsPrice && (price == null || !Number.isFinite(price))) {
        price = await getCurrentPrice(ticker);
      }

      const resolved = resolveOrderFromRule(rule, position, price);
      if (!resolved.ok) {
        await logStrategyEvent({
          strategyId: strategy.id,
          accountId: binding.account_id,
          ruleId: rule.id,
          status: 'skipped',
          message: resolved.skipMessage
        });
        continue;
      }

      const hasBracket = isOpeningAction(resolved.action) && params.bracket;
      const result = await placeOrder(strategy.user_id, {
        account_id: binding.account_id,
        ticker: rule.ticker,
        action: resolved.action,
        qty: resolved.qty,
        orderType: 'market',
        source: 'strategy',
        ...(isOpeningAction(resolved.action) && params.bracket ? { bracket: params.bracket } : {}),
        metadata: {
          strategy_id: strategy.id,
          rule_id: rule.id,
          triggered_price: evalOut.price,
          signal_bucket: evalOut.signalBucket || null
        }
      });

      // Refresh cached position so later rules in the same run see updated lots.
      positionByTicker.set(ticker, await getClosableQty(binding.account_id, ticker));

      await logStrategyEvent({
        strategyId: strategy.id,
        accountId: binding.account_id,
        ruleId: rule.id,
        status: 'triggered',
        message: hasBracket ? 'Order submitted with OCO bracket exits' : 'Order submitted',
        orderId: result?.order?.id || null
      });
      triggered += 1;
    } catch (e) {
      failed += 1;
      await logStrategyEvent({
        strategyId: strategy.id,
        accountId: binding.account_id,
        ruleId: rule.id,
        status: 'failed',
        message: e.message || String(e)
      });
    }
  }

  await supabaseService
    .from('paper_strategy_account_bindings')
    .update({
      last_run_at: new Date().toISOString(),
      last_error: failed > 0 ? 'See execution log' : null
    })
    .eq('id', binding.id);

  return { triggered, failed };
}

async function loadActiveBindings(accountIdFilter) {
  let q = supabaseService
    .from('paper_strategy_account_bindings')
    .select(BINDING_SELECT)
    .eq('is_active', true);

  if (accountIdFilter) {
    q = q.eq('account_id', accountIdFilter);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function runStrategiesOnce() {
  const bindings = await loadActiveBindings(null);
  let triggered = 0;
  let failed = 0;
  for (const binding of bindings) {
    const out = await processBinding(binding);
    triggered += out.triggered;
    failed += out.failed;
  }
  return { triggered, failed };
}

/**
 * @param {string} accountId
 */
async function runStrategiesForAccount(accountId) {
  const bindings = await loadActiveBindings(accountId);
  let triggered = 0;
  let failed = 0;
  for (const binding of bindings) {
    const out = await processBinding(binding);
    triggered += out.triggered;
    failed += out.failed;
  }
  return { triggered, failed };
}

module.exports = {
  runStrategiesOnce,
  runStrategiesForAccount,
  evaluateRule,
  resolveOrderFromRule,
  capOpeningOrderQty,
  isOpeningAction,
  isClosingAction
};
