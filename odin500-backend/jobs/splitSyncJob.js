const { fetchAllSplits } = require('../services/splits/massiveSplitsClient');
const {
  ensureTables,
  getSyncState,
  saveSyncState,
  insertNewSplits,
  rowDateKey
} = require('../services/splits/stockSplitsStore');
const { DEFAULT_INITIAL_SYNC_YEARS } = require('../services/splits/splitConfig');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function yearsAgoDate(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return isoDate(d);
}

/**
 * Incremental sync from Massive → BigQuery stock_splits.
 * @param {{ forceFrom?: string }} [opts]
 */
async function runSplitSync(opts = {}) {
  await ensureTables();
  if (!process.env.MASSIVE_API_KEY) {
    return { ok: false, skipped: true, reason: 'MASSIVE_API_KEY not set' };
  }

  const state = await getSyncState();
  const overlapDays = Number(process.env.SPLITS_SYNC_OVERLAP_DAYS || 7);
  let since =
    opts.forceFrom ||
    (state?.last_execution_date ? addDays(rowDateKey(state.last_execution_date), -overlapDays) : null) ||
    yearsAgoDate(DEFAULT_INITIAL_SYNC_YEARS);

  const fetched = await fetchAllSplits({
    'execution_date.gte': since,
    limit: '1000',
    sort: 'execution_date.asc'
  });

  const { inserted, skipped } = await insertNewSplits(fetched);

  let maxExecution = state?.last_execution_date ? rowDateKey(state.last_execution_date) : null;
  for (const row of fetched) {
    const d = rowDateKey(row?.execution_date);
    if (d && (!maxExecution || d > maxExecution)) maxExecution = d;
  }

  await saveSyncState({
    lastExecutionDate: maxExecution || since,
    lastNewCount: inserted,
    lastTotalFetched: fetched.length
  });

  return {
    ok: true,
    since,
    fetched: fetched.length,
    inserted,
    skipped,
    lastExecutionDate: maxExecution || since
  };
}

module.exports = { runSplitSync };
