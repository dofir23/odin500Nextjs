// BigQuery persistence for the per-day, per-engine AI stance on a ticker.
//
// One row per (ticker, market day, engine). The read path asks for "today" first and only falls
// through to the model when nothing is stored, so each engine is paid for once per ticker per day
// no matter how many people open the page.

const bigquery = require('../../config/bigquery');
const { DATASET, STANCE_TABLE, STANCE_TABLE_FQN, VALID_STANCES } = require('./tickerStanceConfig');

let tableReady = false;

/** BigQuery returns DATE/TIMESTAMP cells as `{ value }` wrappers. */
function bqCellToPlain(v) {
  if (v == null) return null;
  if (typeof v === 'object' && v.value !== undefined) return v.value;
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function ensureTable() {
  if (tableReady) return;
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${STANCE_TABLE_FQN} (
      ticker STRING NOT NULL,
      stance_date DATE NOT NULL,
      engine STRING NOT NULL,
      stance STRING NOT NULL,
      rationale STRING,
      model STRING,
      created_at TIMESTAMP NOT NULL
    )
    PARTITION BY stance_date
    CLUSTER BY ticker, engine
  `;
  await bigquery.query({ query: ddl });
  tableReady = true;
}

/**
 * Stored stances for one ticker on one market day.
 *
 * Deduped to the newest row per engine: a retry after a partial failure appends rather than
 * overwrites (streaming inserts cannot UPDATE a row still in the buffer), so the table can
 * legitimately hold two rows for the same engine and the later one wins.
 *
 * @param {string} ticker
 * @param {string} stanceDate YYYY-MM-DD
 * @returns {Promise<Array<{ engine: string, stance: string, rationale: string|null, model: string|null, created_at: string|null }>>}
 */
async function getStancesForDay(ticker, stanceDate) {
  await ensureTable();
  const query = `
    SELECT engine, stance, rationale, model, created_at
    FROM (
      SELECT
        engine, stance, rationale, model, created_at,
        ROW_NUMBER() OVER (PARTITION BY engine ORDER BY created_at DESC) AS rn
      FROM ${STANCE_TABLE_FQN}
      WHERE ticker = @ticker AND stance_date = DATE(@stanceDate)
    )
    WHERE rn = 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { ticker: String(ticker || '').toUpperCase(), stanceDate }
  });
  return (rows || []).map((r) => ({
    engine: String(bqCellToPlain(r.engine) || ''),
    stance: String(bqCellToPlain(r.stance) || 'neutral'),
    rationale: bqCellToPlain(r.rationale),
    model: bqCellToPlain(r.model),
    created_at: bqCellToPlain(r.created_at)
  }));
}

/**
 * @param {Array<{ ticker: string, stanceDate: string, engine: string, stance: string, rationale?: string, model?: string }>} entries
 */
async function insertStances(entries) {
  const rows = (entries || [])
    .filter((e) => e && e.ticker && e.stanceDate && e.engine && VALID_STANCES.has(e.stance))
    .map((e) => ({
      ticker: String(e.ticker).toUpperCase(),
      stance_date: e.stanceDate,
      engine: String(e.engine),
      stance: e.stance,
      // BigQuery STRING has no practical cap, but an unbounded model reply is not worth storing.
      rationale: e.rationale ? String(e.rationale).slice(0, 1000) : null,
      model: e.model ? String(e.model) : null,
      created_at: new Date().toISOString()
    }));
  if (!rows.length) return 0;

  await ensureTable();
  await bigquery.dataset(DATASET).table(STANCE_TABLE).insert(rows);
  return rows.length;
}

module.exports = { ensureTable, getStancesForDay, insertStances };
