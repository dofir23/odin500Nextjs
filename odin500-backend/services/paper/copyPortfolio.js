/**
 * Copy a published portfolio into a new paper account for the current user.
 *
 * Semantics: SNAPSHOT copy. We replicate the source's *target weights* at today's prices —
 * never its share counts (meaningless across different capital bases) and never its entry
 * prices. The copy's cost basis is today's market, so its performance diverges from the
 * source's advertised return immediately. The UI must say so; see CopyPortfolioModal.
 *
 * Weighting uses gross exposure per leg divided by source equity, which preserves both the
 * relative position sizes *and* the source's cash ratio. A source sitting 50% in cash produces
 * a copy sitting ~50% in cash rather than a fully-invested book with a different risk profile.
 */

const supabaseService = require('../../config/supabaseService');
const { fetchLatestClosePrices, enrichLotsWithPnl, aggregateLotsToPositions } = require('./pnlCalculator');
const {
  createAccountForUser,
  placeOrder,
  listAccountsForUser,
  STARTING_CAPITAL
} = require('./orderEngine');

const MAX_NAME_LEN = 60;

function httpError(message, status = 400, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * A copy always starts with the same capital the source started with, so the two books stay
 * directly comparable. Not caller-supplied: letting the client pick would both break that
 * comparison and hand it control over how much buying power a new account is created with.
 */
function resolveCopyCapital(account) {
  const n = Number(account?.starting_capital);
  return Number.isFinite(n) && n > 0 ? n : STARTING_CAPITAL;
}

/**
 * Published + copy-enabled source, with its open positions and equity.
 * @param {string} accountId
 */
async function loadCopyableSource(accountId) {
  const id = String(accountId || '').trim();
  if (!id) throw httpError('Portfolio id is required', 400);

  const { data: account, error } = await supabaseService
    .from('paper_accounts')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw error;
  if (!account) throw httpError('Portfolio not found', 404);

  // Column is added by paper_accounts_copy_lineage.sql; treat a missing value as opted-in
  // so the endpoint still works before the migration has been run.
  if (account.allow_copy === false) {
    throw httpError('The owner has turned off copying for this portfolio', 403, 'COPY_DISABLED');
  }

  const { data: lots, error: lotErr } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (lotErr) throw lotErr;

  const positions = aggregateLotsToPositions(await enrichLotsWithPnl(lots || []));
  // equity = cash + signed market value (longs add, shorts subtract) — same basis as pnlCalculator.
  const marketValue = positions.reduce((sum, p) => sum + (Number(p.market_value) || 0), 0);
  const equity = round2((Number(account.cash_balance) || 0) + marketValue);

  return { account, positions, equity };
}

/**
 * One leg per side per ticker, so a hedged book (both long and short in the same name)
 * replicates faithfully instead of collapsing to its net.
 * @returns {Array<{ ticker: string, action: 'BTO'|'STO', side: 'long'|'short', gross: number }>}
 */
function buildSourceLegs(positions) {
  const legs = [];
  for (const p of positions || []) {
    const ticker = String(p.ticker || '').trim().toUpperCase();
    if (!ticker) continue;
    const longGross = Number(p.long_market_value) || 0;
    const shortGross = Number(p.short_market_value) || 0;
    if (Number(p.long_qty) > 0 && longGross > 0) {
      legs.push({ ticker, action: 'BTO', side: 'long', gross: longGross });
    }
    if (Number(p.short_qty) > 0 && shortGross > 0) {
      legs.push({ ticker, action: 'STO', side: 'short', gross: shortGross });
    }
  }
  return legs;
}

/**
 * Resolve each source leg into a whole-share order sized against the copier's capital.
 * Anything unbuyable lands in `skipped` with a reason rather than silently vanishing.
 */
function planAllocation({ legs, equity, capital, priceMap }) {
  const planned = [];
  const skipped = [];

  for (const leg of legs) {
    const price = Number(priceMap.get(leg.ticker));
    const weight = leg.gross / equity;
    const targetDollars = capital * weight;

    if (!Number.isFinite(price) || price <= 0) {
      skipped.push({
        ticker: leg.ticker,
        action: leg.action,
        weight_pct: round2(weight * 100),
        reason: 'No market price available'
      });
      continue;
    }

    const qty = Math.floor(targetDollars / price);
    if (qty < 1) {
      skipped.push({
        ticker: leg.ticker,
        action: leg.action,
        weight_pct: round2(weight * 100),
        reason: `Share price ${round2(price)} exceeds the ${round2(targetDollars)} target for this position`
      });
      continue;
    }

    planned.push({
      ticker: leg.ticker,
      action: leg.action,
      side: leg.side,
      qty,
      price: round2(price),
      weight_pct: round2(weight * 100),
      est_cost: round2(qty * price)
    });
  }

  // Largest first: if buying power runs out, small tail positions fail instead of a core holding.
  planned.sort((a, b) => b.est_cost - a.est_cost);

  const estInvested = round2(planned.reduce((s, p) => s + p.est_cost, 0));
  return {
    planned,
    skipped,
    est_invested: estInvested,
    est_cash_remaining: round2(capital - estInvested),
    // A source running gross exposure above its equity (leveraged or market-neutral short book)
    // produces target weights summing past 100%. We replicate faithfully rather than silently
    // deleveraging, so the order engine's buying-power check decides — flag it for the UI.
    exceeds_capital: estInvested > capital
  };
}

/**
 * What the caller would get if they copied right now. Unauthenticated on purpose — an
 * anonymous visitor sees the concrete allocation before being asked to sign up.
 * @param {{ accountId: string, capital?: number }} opts
 */
async function buildCopyPreview({ accountId }) {
  const { account, positions, equity } = await loadCopyableSource(accountId);
  const resolvedCapital = resolveCopyCapital(account);

  if (equity <= 0) {
    throw httpError('This portfolio has no equity to copy', 422, 'EMPTY_SOURCE');
  }

  const legs = buildSourceLegs(positions);
  if (!legs.length) {
    throw httpError('This portfolio holds no open positions to copy', 422, 'NO_POSITIONS');
  }

  const priceMap = await fetchLatestClosePrices(legs.map((l) => l.ticker));
  const allocation = planAllocation({ legs, equity, capital: resolvedCapital, priceMap });

  return {
    source: {
      id: account.id,
      name: account.name,
      equity_at_preview: equity,
      ai_managed: Boolean(account.ai_managed),
      ai_engine: account.ai_engine || null,
      ai_rebalance_cadence: account.ai_rebalance_cadence || null
    },
    capital: resolvedCapital,
    suggested_name: `Copy of ${account.name}`.slice(0, MAX_NAME_LEN),
    ...allocation
  };
}

/** `uq_paper_accounts_user_name` makes duplicate names a 409, so disambiguate before inserting. */
function resolveCopyName(existingAccounts, desired, sourceName) {
  const base = (String(desired || '').trim() || `Copy of ${sourceName}`).slice(0, MAX_NAME_LEN);
  const taken = new Set(existingAccounts.map((a) => String(a.name || '').trim().toLowerCase()));

  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/**
 * Create the copy and place its opening orders.
 * @param {{ userId: string, accountId: string, name?: string, capital?: number, copyAiStrategy?: boolean }} opts
 */
async function executeCopy({ userId, accountId, name, copyAiStrategy = false }) {
  const { account: source, positions, equity } = await loadCopyableSource(accountId);
  const resolvedCapital = resolveCopyCapital(source);

  if (equity <= 0) throw httpError('This portfolio has no equity to copy', 422, 'EMPTY_SOURCE');

  // No account cap here: manual and AI creation are uncapped too, and a limit on this path
  // alone would be arbitrary. copyPortfolioLimiter (10/hour/user) bounds the abuse surface.
  const existing = await listAccountsForUser(userId);

  const legs = buildSourceLegs(positions);
  if (!legs.length) {
    throw httpError('This portfolio holds no open positions to copy', 422, 'NO_POSITIONS');
  }

  const priceMap = await fetchLatestClosePrices(legs.map((l) => l.ticker));
  const { planned, skipped } = planAllocation({
    legs,
    equity,
    capital: resolvedCapital,
    priceMap
  });

  if (!planned.length) {
    throw httpError(
      'None of these positions can be bought with this portfolio’s starting capital.',
      422,
      'NOTHING_AFFORDABLE'
    );
  }

  const resolvedName = resolveCopyName(existing, name, source.name);
  const account = await createAccountForUser(userId, {
    name: resolvedName,
    starting_capital: resolvedCapital
  });

  const lineage = {
    copied_from_account_id: source.id,
    copied_at: new Date().toISOString(),
    copied_from_snapshot: {
      source_name: source.name,
      source_equity: equity,
      capital: resolvedCapital,
      copied_at: new Date().toISOString(),
      legs: planned.map((p) => ({
        ticker: p.ticker,
        action: p.action,
        qty: p.qty,
        price: p.price,
        weight_pct: p.weight_pct
      }))
    }
  };

  // Inheriting the AI agent is opt-in: it trades the account autonomously and bills AI usage
  // per rebalance, so it is never switched on implicitly by copying holdings.
  if (copyAiStrategy && source.ai_managed) {
    Object.assign(lineage, {
      ai_managed: true,
      ai_engine: source.ai_engine,
      ai_index_focus: source.ai_index_focus,
      ai_direction: source.ai_direction,
      ai_criteria: source.ai_criteria,
      ai_rebalance_cadence: source.ai_rebalance_cadence,
      // Undefined (migration not run) serializes away, so this stays safe on older instances.
      ai_position_count: source.ai_position_count,
      ai_position_sizing: source.ai_position_sizing,
      ai_position_qty: source.ai_position_qty
    });
  }

  const { error: lineageErr } = await supabaseService
    .from('paper_accounts')
    .update(lineage)
    .eq('id', account.id);
  if (lineageErr) throw lineageErr;

  const placed = [];
  const failed = [...skipped];

  for (const leg of planned) {
    try {
      await placeOrder(userId, {
        accountId: account.id,
        ticker: leg.ticker,
        action: leg.action,
        qty: leg.qty,
        orderType: 'market',
        source: 'copy_portfolio'
      });
      placed.push(leg);
    } catch (err) {
      failed.push({
        ticker: leg.ticker,
        action: leg.action,
        weight_pct: leg.weight_pct,
        reason: err?.message || 'Order rejected'
      });
    }
  }

  const { data: finalAccount, error: reloadErr } = await supabaseService
    .from('paper_accounts')
    .select('*')
    .eq('id', account.id)
    .single();
  if (reloadErr) throw reloadErr;

  return {
    account: finalAccount,
    placed,
    failed,
    ai_strategy_copied: Boolean(lineage.ai_managed),
    source: {
      id: source.id,
      name: source.name,
      equity_at_copy: equity
    }
  };
}

module.exports = {
  buildCopyPreview,
  executeCopy
};
