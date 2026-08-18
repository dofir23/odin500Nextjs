const { STARTING_CAPITAL } = require('./dbSchema');

/**
 * Position count + share sizing for AI-managed portfolios.
 *
 * Both are wizard answers now, not product constants. The book holds however many names the
 * user asked for, sized one of three ways:
 *   - `equal_split`   same SHARE COUNT for every name — the largest count the capital covers.
 *   - `equal_capital` same DOLLAR AMOUNT per name — capital / N, then floor to whole shares.
 *   - `fixed_qty`     a share count the user typed, reduced if it would overspend.
 *
 * Every mode keeps the book's gross cost at or under the account's capital. Leftover cash is
 * expected in all three — whole-share rounding rarely spends the balance exactly.
 */

/** Bounds on the "how many positions?" answer — the Dow only has 30 members to pick from. */
const POSITION_COUNT_MIN = 1;
const POSITION_COUNT_MAX = 30;
/** Sanity ceiling on a hand-typed share count; affordability does the real limiting. */
const MAX_QTY_PER_POSITION = 1000000;

/** What each direction used to be hard-coded to — now just the pre-filled suggestion. */
const DEFAULT_POSITION_COUNT = { long: 5, short: 5, long_short: 10 };

const DIRECTION_LABELS = { long: 'Long-only', short: 'Short-only', long_short: 'Long-Short' };

const SIZING_LABELS = {
  equal_split: 'Equal split',
  equal_capital: 'Equal capital',
  fixed_qty: 'Fixed share count'
};

/** Long-Short needs a name on each side, so it can never be a one-position book. */
function minPositionCount(direction) {
  return direction === 'long_short' ? 2 : POSITION_COUNT_MIN;
}

function defaultPositionCount(direction) {
  return DEFAULT_POSITION_COUNT[direction] || 5;
}

/** Clamps any user/db/AI-supplied count into the allowed range for this direction. */
function normalizePositionCount(direction, raw) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return defaultPositionCount(direction);
  return Math.min(POSITION_COUNT_MAX, Math.max(minPositionCount(direction), n));
}

/**
 * Splits a total position count into per-leg counts. Odd Long-Short totals put the extra
 * name on the long leg (7 → 4 long + 3 short).
 * @returns {{ longCount: number, shortCount: number, total: number, label: string }}
 */
function resolvePositionSpec(direction, positionCount) {
  const total = normalizePositionCount(direction, positionCount);
  const label = DIRECTION_LABELS[direction] || direction;
  if (direction === 'short') return { longCount: 0, shortCount: total, total, label };
  if (direction === 'long_short') {
    const longCount = Math.ceil(total / 2);
    return { longCount, shortCount: total - longCount, total, label };
  }
  return { longCount: total, shortCount: 0, total, label };
}

/**
 * Normalizes the sizing answer. A `fixed_qty` without a usable number is meaningless, so it
 * falls back to equal split rather than erroring the whole create.
 * @returns {{ sizing: 'equal_split'|'equal_capital'|'fixed_qty', qty: number|null }}
 */
function normalizeSizing({ sizing, qty } = {}) {
  const mode = String(sizing || '').trim();
  const n = Math.trunc(Number(qty));
  if (mode === 'fixed_qty' && Number.isFinite(n) && n > 0) {
    return { sizing: 'fixed_qty', qty: Math.min(n, MAX_QTY_PER_POSITION) };
  }
  if (mode === 'equal_capital') return { sizing: 'equal_capital', qty: null };
  return { sizing: 'equal_split', qty: null };
}

/** One-line description of the sizing rule, for prompts and publish copy. */
function describeSizing({ sizing, qty }, capital = STARTING_CAPITAL) {
  const norm = normalizeSizing({ sizing, qty });
  const cap = `$${capital.toLocaleString('en-US')}`;
  if (norm.sizing === 'fixed_qty') {
    return `${norm.qty} share(s) of every pick (reduced automatically if that would cost more than ${cap})`;
  }
  if (norm.sizing === 'equal_capital') {
    return `equal capital — ${cap} split evenly across the picks, then as many whole shares of each as its slice buys`;
  }
  return `equal split — the same number of shares of every pick, as many as ${cap} covers without going over`;
}

/** Drops holdings we have no usable price for; the rest can still be sized and placed. */
function pricedHoldings(holdings, priceMap, failed) {
  const priced = [];
  for (const h of holdings || []) {
    const ticker = String(h?.ticker || '').trim().toUpperCase();
    const action = String(h?.action || '').trim().toUpperCase();
    if (!ticker || !action) continue;
    const price = Number(priceMap?.get?.(ticker));
    if (!Number.isFinite(price) || price <= 0) {
      failed.push({ ticker, error: 'No market price available' });
      continue;
    }
    priced.push({ ticker, action, price });
  }
  return priced;
}

function grossOf(orders) {
  return Math.round(orders.reduce((sum, o) => sum + o.qty * o.price, 0) * 100) / 100;
}

/**
 * Turns a proposed holdings list into opening orders.
 *
 * Gross basket cost (long + short notional alike) is capped at `capital` in every mode. A fixed
 * qty that would overspend is clamped down to the affordable count rather than failing the
 * create with no way to recover in the UI.
 *
 * @param {{ holdings: Array<{ticker:string, action:string}>, priceMap: Map<string, number>,
 *           capital?: number, sizing?: string, qty?: number|null }} input
 * @returns {{ orders: Array<{ticker:string, action:string, qty:number, price:number}>,
 *            failed: Array<{ticker:string, error:string}>, qtyPerPosition: number|null,
 *            requestedQty: number|null, clamped: boolean, grossCost: number,
 *            capitalPerPosition: number|null }}
 *   `qtyPerPosition` is null under equal_capital — share counts differ by price there.
 */
function planAiAllocation({ holdings, priceMap, capital = STARTING_CAPITAL, sizing = 'equal_split', qty = null }) {
  const budget = Number(capital) > 0 ? Number(capital) : STARTING_CAPITAL;
  const norm = normalizeSizing({ sizing, qty });

  const failed = [];
  const priced = pricedHoldings(holdings, priceMap, failed);
  const empty = {
    orders: [],
    failed,
    qtyPerPosition: null,
    requestedQty: norm.qty,
    clamped: false,
    grossCost: 0,
    capitalPerPosition: null
  };
  if (!priced.length) return empty;

  if (norm.sizing === 'equal_capital') {
    // Even dollar slices, floored to whole shares — so a $200 stock and a $20 stock end up
    // holding roughly the same market value rather than the same share count.
    const slice = budget / priced.length;
    const orders = [];
    for (const p of priced) {
      const shares = Math.floor(slice / p.price);
      if (shares < 1) {
        failed.push({
          ticker: p.ticker,
          error: `One share costs more than this position's $${Math.floor(slice).toLocaleString('en-US')} share of the capital`
        });
        continue;
      }
      orders.push({ ticker: p.ticker, action: p.action, qty: shares, price: p.price });
    }
    if (!orders.length) return empty;
    return {
      orders,
      failed,
      qtyPerPosition: null,
      requestedQty: null,
      clamped: false,
      grossCost: grossOf(orders),
      capitalPerPosition: Math.round(slice * 100) / 100
    };
  }

  // One "basket" = a single share of every pick, so budget / basket is the most shares of
  // each the capital can carry while keeping every position the same share count.
  const basketPrice = priced.reduce((sum, p) => sum + p.price, 0);
  if (basketPrice <= 0) return empty;

  const affordableQty = Math.floor(budget / basketPrice);
  const qtyPerPosition = norm.sizing === 'fixed_qty' ? Math.min(norm.qty, affordableQty) : affordableQty;

  if (qtyPerPosition < 1) {
    for (const p of priced) {
      failed.push({
        ticker: p.ticker,
        error: 'One share of every pick already costs more than the portfolio capital'
      });
    }
    return empty;
  }

  const orders = priced.map((p) => ({ ticker: p.ticker, action: p.action, qty: qtyPerPosition, price: p.price }));
  return {
    orders,
    failed,
    qtyPerPosition,
    requestedQty: norm.qty,
    clamped: norm.sizing === 'fixed_qty' && qtyPerPosition < norm.qty,
    grossCost: grossOf(orders),
    capitalPerPosition: null
  };
}

module.exports = {
  POSITION_COUNT_MIN,
  POSITION_COUNT_MAX,
  MAX_QTY_PER_POSITION,
  DEFAULT_POSITION_COUNT,
  DIRECTION_LABELS,
  SIZING_LABELS,
  minPositionCount,
  defaultPositionCount,
  normalizePositionCount,
  resolvePositionSpec,
  normalizeSizing,
  describeSizing,
  planAiAllocation
};
