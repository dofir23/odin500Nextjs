const supabaseService = require('../../config/supabaseService');
const { querySplits } = require('./stockSplitsStore');

const LOOKBACK_DAYS = Number(process.env.PAPER_SPLIT_LOOKBACK_DAYS || 120);

function round6(v) {
  return Math.round(Number(v || 0) * 1000000) / 1000000;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function isBeforeSplitInstant(ts, executionDate) {
  if (!ts || !executionDate) return false;
  const splitEnd = new Date(`${executionDate}T23:59:59.999Z`);
  const opened = new Date(ts);
  return opened.getTime() <= splitEnd.getTime();
}

async function getAdjustmentState() {
  const { data, error } = await supabaseService
    .from('paper_split_adjustment_state')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error && !String(error.message || '').includes('does not exist')) throw error;
  return data || null;
}

async function saveAdjustmentState(patch) {
  const row = {
    id: 'default',
    last_processed_date: patch.lastProcessedDate || null,
    last_run_at: new Date().toISOString(),
    last_adjustments_count: patch.lastAdjustmentsCount != null ? Number(patch.lastAdjustmentsCount) : 0
  };
  const { error } = await supabaseService.from('paper_split_adjustment_state').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function getAppliedEntityIds(splitId) {
  const { data, error } = await supabaseService
    .from('paper_split_adjustments')
    .select('entity_type, entity_id')
    .eq('split_id', splitId);
  if (error) {
    if (String(error.message || '').includes('does not exist')) return new Set();
    throw error;
  }
  const set = new Set();
  for (const row of data || []) {
    set.add(`${row.entity_type}:${row.entity_id}`);
  }
  return set;
}

async function recordAdjustment(row) {
  const { error } = await supabaseService.from('paper_split_adjustments').insert(row);
  if (error) {
    if (String(error.code) === '23505') return false;
    throw error;
  }
  return true;
}

async function getTickersWithPaperExposure() {
  const tickers = new Set();
  const [{ data: lots, error: lotErr }, { data: orders, error: ordErr }] = await Promise.all([
    supabaseService
      .from('paper_position_lots')
      .select('ticker')
      .eq('status', 'open')
      .gt('remaining_qty', 0),
    supabaseService.from('paper_orders').select('ticker').eq('status', 'pending')
  ]);
  if (lotErr) throw lotErr;
  if (ordErr) throw ordErr;
  for (const row of lots || []) {
    const sym = String(row.ticker || '').trim().toUpperCase();
    if (sym) tickers.add(sym);
  }
  for (const row of orders || []) {
    const sym = String(row.ticker || '').trim().toUpperCase();
    if (sym) tickers.add(sym);
  }
  return [...tickers];
}

/**
 * @param {object} split
 * @param {Set<string>} appliedKeys
 */
async function adjustOpenLotsForSplit(split, appliedKeys) {
  const ticker = String(split.ticker || '').toUpperCase();
  const factor = Number(split.ratio_factor);
  if (!ticker || !Number.isFinite(factor) || factor <= 0) return 0;

  const { data: lots, error } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('ticker', ticker)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (error) throw error;

  let count = 0;
  for (const lot of lots || []) {
    const key = `lot:${lot.id}`;
    if (appliedKeys.has(key)) continue;
    if (!isBeforeSplitInstant(lot.opened_at, split.execution_date)) continue;

    const beforeQty = Number(lot.remaining_qty || 0);
    const beforeOpened = Number(lot.opened_qty || 0);
    const beforePrice = Number(lot.entry_price || 0);
    if (beforeQty <= 0 || beforePrice <= 0) continue;

    const afterQty = round6(beforeQty * factor);
    const afterOpened = round6(beforeOpened * factor);
    const afterPrice = round6(beforePrice / factor);

    const { error: updErr } = await supabaseService
      .from('paper_position_lots')
      .update({
        remaining_qty: afterQty,
        opened_qty: afterOpened,
        entry_price: afterPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', lot.id);
    if (updErr) throw updErr;

    const inserted = await recordAdjustment({
      split_id: split.split_id || split.id,
      ticker,
      execution_date: split.execution_date,
      ratio_factor: factor,
      adjustment_type: split.adjustment_type || null,
      entity_type: 'lot',
      entity_id: lot.id,
      account_id: lot.account_id,
      before_qty: beforeQty,
      after_qty: afterQty,
      before_price: beforePrice,
      after_price: afterPrice,
      metadata: { opened_qty_before: beforeOpened, opened_qty_after: afterOpened }
    });
    if (inserted) {
      appliedKeys.add(key);
      count += 1;
    }
  }
  return count;
}

/**
 * @param {object} split
 * @param {Set<string>} appliedKeys
 */
async function adjustPendingOrdersForSplit(split, appliedKeys) {
  const ticker = String(split.ticker || '').toUpperCase();
  const factor = Number(split.ratio_factor);
  if (!ticker || !Number.isFinite(factor) || factor <= 0) return 0;

  const { data: orders, error } = await supabaseService
    .from('paper_orders')
    .select('*')
    .eq('ticker', ticker)
    .eq('status', 'pending');
  if (error) throw error;

  let count = 0;
  for (const order of orders || []) {
    const key = `order:${order.id}`;
    if (appliedKeys.has(key)) continue;
    const submittedAt = order.submitted_at || order.created_at;
    if (!isBeforeSplitInstant(submittedAt, split.execution_date)) continue;

    const beforeQty = Number(order.qty || 0);
    const beforeLimit = order.limit_price != null ? Number(order.limit_price) : null;
    const beforeStop = order.stop_price != null ? Number(order.stop_price) : null;
    if (beforeQty <= 0) continue;

    const afterQty = round6(beforeQty * factor);
    const patch = {
      qty: afterQty,
      limit_price: beforeLimit != null && Number.isFinite(beforeLimit) ? round6(beforeLimit / factor) : null,
      stop_price: beforeStop != null && Number.isFinite(beforeStop) ? round6(beforeStop / factor) : null
    };

    const { error: updErr } = await supabaseService.from('paper_orders').update(patch).eq('id', order.id);
    if (updErr) throw updErr;

    const inserted = await recordAdjustment({
      split_id: split.split_id || split.id,
      ticker,
      execution_date: split.execution_date,
      ratio_factor: factor,
      adjustment_type: split.adjustment_type || null,
      entity_type: 'order',
      entity_id: order.id,
      account_id: order.account_id,
      before_qty: beforeQty,
      after_qty: afterQty,
      before_price: beforeLimit ?? beforeStop ?? null,
      after_price: patch.limit_price ?? patch.stop_price ?? null,
      metadata: {
        limit_before: beforeLimit,
        limit_after: patch.limit_price,
        stop_before: beforeStop,
        stop_after: patch.stop_price,
        order_type: order.order_type
      }
    });
    if (inserted) {
      appliedKeys.add(key);
      count += 1;
    }
  }
  return count;
}

/**
 * Apply corporate split adjustments to paper lots and pending orders.
 * @param {{ forceFrom?: string }} [opts]
 */
async function runPaperSplitAdjustments(opts = {}) {
  const today = isoDate(new Date());
  const state = await getAdjustmentState();
  const defaultFrom = addDays(today, -LOOKBACK_DAYS);
  const since =
    opts.forceFrom ||
    (state?.last_processed_date ? addDays(String(state.last_processed_date).slice(0, 10), -7) : defaultFrom);

  const tickers = await getTickersWithPaperExposure();
  if (!tickers.length) {
    await saveAdjustmentState({ lastProcessedDate: today, lastAdjustmentsCount: 0 });
    return { ok: true, since, splits: 0, adjusted: 0, tickers: 0 };
  }

  const splits = [];
  for (const ticker of tickers) {
    const rows = await querySplits({
      ticker,
      from: since,
      to: today,
      limit: 100
    });
    splits.push(...rows);
  }

  splits.sort((a, b) => {
    if (a.execution_date < b.execution_date) return -1;
    if (a.execution_date > b.execution_date) return 1;
    return String(a.ticker).localeCompare(String(b.ticker));
  });

  let adjusted = 0;
  let maxDate = state?.last_processed_date ? String(state.last_processed_date).slice(0, 10) : since;

  for (const split of splits) {
    if (!split.execution_date || split.execution_date > today) continue;
    const splitId = split.id || split.split_id;
    if (!splitId) continue;

    const appliedKeys = await getAppliedEntityIds(splitId);
    adjusted += await adjustOpenLotsForSplit(split, appliedKeys);
    adjusted += await adjustPendingOrdersForSplit(split, appliedKeys);

    if (split.execution_date > maxDate) maxDate = split.execution_date;
  }

  await saveAdjustmentState({ lastProcessedDate: maxDate, lastAdjustmentsCount: adjusted });

  return {
    ok: true,
    since,
    splits: splits.length,
    adjusted,
    tickers: tickers.length,
    lastProcessedDate: maxDate
  };
}

async function listRecentPaperAdjustments(limit = 50) {
  const { data, error } = await supabaseService
    .from('paper_split_adjustments')
    .select('*')
    .order('adjusted_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));
  if (error) {
    if (String(error.message || '').includes('does not exist')) return [];
    throw error;
  }
  return data || [];
}

module.exports = {
  runPaperSplitAdjustments,
  listRecentPaperAdjustments,
  getAdjustmentState
};
