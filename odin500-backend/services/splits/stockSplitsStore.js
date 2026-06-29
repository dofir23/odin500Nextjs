const bigquery = require('../../config/bigquery');
const {
  DATASET,
  SPLITS_TABLE,
  SYNC_STATE_TABLE,
  SPLITS_TABLE_FQN,
  SYNC_STATE_TABLE_FQN
} = require('./splitConfig');

let tablesReady = false;

function rowDateKey(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.value) return String(v.value).slice(0, 10);
  return String(v).slice(0, 10);
}

function formatSplitRatio(splitFrom, splitTo) {
  const from = Number(splitFrom);
  const to = Number(splitTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return null;
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(Math.round(from * 1000), Math.round(to * 1000));
  const nFrom = Math.round(from * 1000) / g;
  const nTo = Math.round(to * 1000) / g;
  return `${nTo}:${nFrom}`;
}

/** @param {object} raw */
function normalizeSplitRow(raw) {
  const ticker = String(raw?.ticker || '')
    .trim()
    .toUpperCase();
  const splitId = String(raw?.id || '').trim();
  const executionDate = rowDateKey(raw?.execution_date);
  const splitFrom = Number(raw?.split_from);
  const splitTo = Number(raw?.split_to);
  if (!ticker || !splitId || !executionDate || !Number.isFinite(splitFrom) || !Number.isFinite(splitTo)) {
    return null;
  }
  const ratio = splitTo / splitFrom;
  return {
    split_id: splitId,
    ticker,
    execution_date: executionDate,
    split_from: splitFrom,
    split_to: splitTo,
    split_ratio: formatSplitRatio(splitFrom, splitTo),
    ratio_factor: Number.isFinite(ratio) ? ratio : null,
    adjustment_type: raw?.adjustment_type ? String(raw.adjustment_type) : null,
    historical_adjustment_factor:
      raw?.historical_adjustment_factor != null && Number.isFinite(Number(raw.historical_adjustment_factor))
        ? Number(raw.historical_adjustment_factor)
        : null,
    source: 'massive',
    ingested_at: new Date().toISOString()
  };
}

async function ensureTables() {
  if (tablesReady) return;

  const ddl = `
    CREATE TABLE IF NOT EXISTS ${SPLITS_TABLE_FQN} (
      split_id STRING NOT NULL,
      ticker STRING NOT NULL,
      execution_date DATE NOT NULL,
      split_from FLOAT64 NOT NULL,
      split_to FLOAT64 NOT NULL,
      split_ratio STRING,
      ratio_factor FLOAT64,
      adjustment_type STRING,
      historical_adjustment_factor FLOAT64,
      source STRING,
      ingested_at TIMESTAMP NOT NULL
    )
    CLUSTER BY ticker, execution_date
  `;
  const stateDdl = `
    CREATE TABLE IF NOT EXISTS ${SYNC_STATE_TABLE_FQN} (
      sync_key STRING NOT NULL,
      last_execution_date DATE,
      last_run_at TIMESTAMP,
      last_new_count INT64,
      last_total_fetched INT64
    )
  `;
  await bigquery.query({ query: ddl });
  await bigquery.query({ query: stateDdl });
  tablesReady = true;
}

async function getSyncState() {
  await ensureTables();
  const query = `
    SELECT last_execution_date, last_run_at, last_new_count, last_total_fetched
    FROM ${SYNC_STATE_TABLE_FQN}
    WHERE sync_key = 'default'
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query });
  return rows?.[0] || null;
}

async function saveSyncState({ lastExecutionDate, lastNewCount, lastTotalFetched }) {
  await ensureTables();
  const query = `
    MERGE ${SYNC_STATE_TABLE_FQN} T
    USING (
      SELECT
        'default' AS sync_key,
        DATE(@lastExecutionDate) AS last_execution_date,
        CURRENT_TIMESTAMP() AS last_run_at,
        @lastNewCount AS last_new_count,
        @lastTotalFetched AS last_total_fetched
    ) S
    ON T.sync_key = S.sync_key
    WHEN MATCHED THEN UPDATE SET
      last_execution_date = S.last_execution_date,
      last_run_at = S.last_run_at,
      last_new_count = S.last_new_count,
      last_total_fetched = S.last_total_fetched
    WHEN NOT MATCHED THEN INSERT (
      sync_key, last_execution_date, last_run_at, last_new_count, last_total_fetched
    ) VALUES (
      S.sync_key, S.last_execution_date, S.last_run_at, S.last_new_count, S.last_total_fetched
    )
  `;
  await bigquery.query({
    query,
    params: {
      lastExecutionDate: lastExecutionDate || null,
      lastNewCount: Number(lastNewCount) || 0,
      lastTotalFetched: Number(lastTotalFetched) || 0
    }
  });
}

/**
 * @param {object[]} rawRows
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
async function insertNewSplits(rawRows) {
  await ensureTables();
  const normalized = (rawRows || []).map(normalizeSplitRow).filter(Boolean);
  if (!normalized.length) return { inserted: 0, skipped: 0 };

  const ids = normalized.map((r) => r.split_id);
  const existingQuery = `
    SELECT split_id
    FROM ${SPLITS_TABLE_FQN}
    WHERE split_id IN UNNEST(@ids)
  `;
  const [existingRows] = await bigquery.query({ query: existingQuery, params: { ids } });
  const existing = new Set((existingRows || []).map((r) => r.split_id));
  const fresh = normalized.filter((r) => !existing.has(r.split_id));
  if (!fresh.length) return { inserted: 0, skipped: normalized.length };

  const table = bigquery.dataset(DATASET).table(SPLITS_TABLE);
  await table.insert(fresh);
  return { inserted: fresh.length, skipped: normalized.length - fresh.length };
}

function mapSplitRow(r) {
  return {
    id: r.split_id,
    ticker: r.ticker,
    execution_date: rowDateKey(r.execution_date),
    split_from: Number(r.split_from),
    split_to: Number(r.split_to),
    split_ratio: r.split_ratio || formatSplitRatio(r.split_from, r.split_to),
    ratio_factor: r.ratio_factor != null ? Number(r.ratio_factor) : null,
    adjustment_type: r.adjustment_type || null,
    historical_adjustment_factor:
      r.historical_adjustment_factor != null ? Number(r.historical_adjustment_factor) : null,
    source: r.source || 'massive',
    ingested_at: r.ingested_at?.value || r.ingested_at || null
  };
}

/**
 * @param {{ days?: number, limit?: number, ticker?: string, tickers?: string[] }} opts
 */
async function queryRecentSplits(opts = {}) {
  await ensureTables();
  const days = Math.min(Math.max(Number(opts.days) || 90, 1), 3650);
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const ticker = opts.ticker ? String(opts.ticker).trim().toUpperCase() : null;
  const tickers = Array.isArray(opts.tickers)
    ? [...new Set(opts.tickers.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))]
    : null;

  if (tickers && tickers.length === 0) return [];

  const query = `
    SELECT *
    FROM ${SPLITS_TABLE_FQN}
    WHERE execution_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
      ${ticker ? 'AND ticker = @ticker' : ''}
      ${tickers ? 'AND ticker IN UNNEST(@tickers)' : ''}
    ORDER BY execution_date DESC, ticker ASC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({
    query,
    params: {
      days,
      limit,
      ...(ticker ? { ticker } : {}),
      ...(tickers ? { tickers } : {})
    }
  });
  return (rows || []).map(mapSplitRow);
}

/**
 * Latest split for a ticker (any date).
 * @param {string} ticker
 */
async function queryLatestSplitForTicker(ticker) {
  await ensureTables();
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  if (!sym) return null;
  const query = `
    SELECT *
    FROM ${SPLITS_TABLE_FQN}
    WHERE ticker = @ticker
    ORDER BY execution_date DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { ticker: sym } });
  return rows?.[0] ? mapSplitRow(rows[0]) : null;
}

/**
 * Most recent split on or before today.
 * @param {string} ticker
 */
async function queryLatestPastSplitForTicker(ticker) {
  await ensureTables();
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  if (!sym) return null;
  const query = `
    SELECT *
    FROM ${SPLITS_TABLE_FQN}
    WHERE ticker = @ticker
      AND execution_date <= CURRENT_DATE()
    ORDER BY execution_date DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { ticker: sym } });
  return rows?.[0] ? mapSplitRow(rows[0]) : null;
}

/**
 * Next announced split after today.
 * @param {string} ticker
 */
async function queryNextUpcomingSplitForTicker(ticker) {
  await ensureTables();
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  if (!sym) return null;
  const query = `
    SELECT *
    FROM ${SPLITS_TABLE_FQN}
    WHERE ticker = @ticker
      AND execution_date > CURRENT_DATE()
    ORDER BY execution_date ASC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { ticker: sym } });
  return rows?.[0] ? mapSplitRow(rows[0]) : null;
}

/**
 * @param {{ ticker?: string, from?: string, to?: string, limit?: number, tickers?: string[] }} opts
 */
async function querySplits(opts = {}) {
  await ensureTables();
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 1000);
  const ticker = opts.ticker ? String(opts.ticker).trim().toUpperCase() : null;
  const from = opts.from ? String(opts.from).slice(0, 10) : null;
  const to = opts.to ? String(opts.to).slice(0, 10) : null;
  const tickers = Array.isArray(opts.tickers)
    ? [...new Set(opts.tickers.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))]
    : null;

  if (tickers && tickers.length === 0) return [];

  const query = `
    SELECT *
    FROM ${SPLITS_TABLE_FQN}
    WHERE 1 = 1
      ${ticker ? 'AND ticker = @ticker' : ''}
      ${tickers ? 'AND ticker IN UNNEST(@tickers)' : ''}
      ${from ? 'AND execution_date >= DATE(@from)' : ''}
      ${to ? 'AND execution_date <= DATE(@to)' : ''}
    ORDER BY execution_date DESC, ticker ASC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({
    query,
    params: {
      limit,
      ...(ticker ? { ticker } : {}),
      ...(tickers ? { tickers } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    }
  });
  return (rows || []).map(mapSplitRow);
}

module.exports = {
  ensureTables,
  getSyncState,
  saveSyncState,
  insertNewSplits,
  queryRecentSplits,
  queryLatestSplitForTicker,
  queryLatestPastSplitForTicker,
  queryNextUpcomingSplitForTicker,
  querySplits,
  normalizeSplitRow,
  formatSplitRatio,
  rowDateKey
};
