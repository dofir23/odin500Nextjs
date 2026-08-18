// Read side of `paper_ai_rebalance_log`.
//
// The table has been written on every AI rebalance since it shipped (services/paper/aiRebalancer.js)
// but had no reader other than the portfolio assistant's chat context, so the history was
// invisible to the people whose portfolios it describes. This exposes it for the Rebalances tab.

const supabaseService = require('../../config/supabaseService');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(n), MAX_LIMIT);
}

/** `added`/`dropped` are jsonb. Older rows hold plain ticker strings; be tolerant of objects. */
function normalizeTickerList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim().toUpperCase();
      const ticker = entry?.ticker ?? entry?.symbol;
      return ticker ? String(ticker).trim().toUpperCase() : null;
    })
    .filter(Boolean);
}

/**
 * @param {object} row
 * @param {boolean} includeReasoning Public callers can opt out of exposing the model's raw text.
 */
function toApiShape(row, includeReasoning) {
  const added = normalizeTickerList(row.added);
  const dropped = normalizeTickerList(row.dropped);
  return {
    id: row.id,
    ran_at: row.ran_at,
    engine: row.engine || null,
    status: row.status || 'ok',
    error: row.error || null,
    added,
    dropped,
    added_count: added.length,
    dropped_count: dropped.length,
    // A run that changed nothing is a real, meaningful outcome — the UI says so explicitly
    // rather than rendering an empty row that reads like a bug.
    unchanged: added.length === 0 && dropped.length === 0,
    reasoning: includeReasoning ? row.raw_output || null : null
  };
}

/**
 * @param {string} accountId
 * @param {{ limit?: number, includeReasoning?: boolean }} [options]
 */
async function getRebalanceLogForAccount(accountId, options = {}) {
  const id = String(accountId || '').trim();
  if (!id) return [];

  const { data, error } = await supabaseService
    .from('paper_ai_rebalance_log')
    .select('id, ran_at, engine, added, dropped, raw_output, status, error')
    .eq('account_id', id)
    .order('ran_at', { ascending: false })
    .limit(clampLimit(options.limit));

  if (error) throw error;
  const includeReasoning = options.includeReasoning !== false;
  return (data || []).map((row) => toApiShape(row, includeReasoning));
}

module.exports = { getRebalanceLogForAccount, DEFAULT_LIMIT, MAX_LIMIT };
