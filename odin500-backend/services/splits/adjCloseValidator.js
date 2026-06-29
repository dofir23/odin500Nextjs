const bigquery = require('../../config/bigquery');

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'extended-byway-454621-s6';
const DATASET = process.env.BIGQUERY_DATASET || 'sp500data1';
const TABLE = process.env.BIGQUERY_TABLE || 'stock_all_data';
const TABLE_FQN = `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;

const TOLERANCE = Number(process.env.SPLITS_ADJ_CLOSE_TOLERANCE || 0.03);

function rowDateKey(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.value) return String(v.value).slice(0, 10);
  return String(v).slice(0, 10);
}

function pickNum(row, keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') {
      const n = Number(row[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Compare raw close jump vs adj_close continuity around a split execution date.
 * @param {string} ticker
 * @param {string} executionDate YYYY-MM-DD
 * @param {number} ratioFactor split_to / split_from
 */
async function validateAdjCloseAroundSplit(ticker, executionDate, ratioFactor) {
  const sym = String(ticker || '').trim().toUpperCase();
  const exec = String(executionDate || '').slice(0, 10);
  const factor = Number(ratioFactor);
  if (!sym || !exec || !Number.isFinite(factor) || factor <= 0) {
    return { ok: false, error: 'Invalid ticker, date, or ratio factor' };
  }

  const query = `
    SELECT Date AS market_date, Close, Adj_Close
    FROM ${TABLE_FQN}
    WHERE UPPER(Symbol) = @ticker
      AND Date BETWEEN DATE_SUB(DATE(@exec), INTERVAL 10 DAY) AND DATE_ADD(DATE(@exec), INTERVAL 10 DAY)
    ORDER BY Date ASC
  `;
  const [rows] = await bigquery.query({ query, params: { ticker: sym, exec } });
  if (!rows?.length) {
    return { ok: false, ticker: sym, execution_date: exec, error: 'No OHLC rows in window' };
  }

  const bars = rows.map((r) => ({
    date: rowDateKey(r.market_date),
    close: pickNum(r, ['Close', 'close']),
    adjClose: pickNum(r, ['Adj_Close', 'adj_close', 'AdjClose'])
  }));

  let before = null;
  let onOrAfter = null;
  for (const bar of bars) {
    if (!bar.date) continue;
    if (bar.date < exec) before = bar;
    if (bar.date >= exec && !onOrAfter) onOrAfter = bar;
  }

  if (!before || !onOrAfter) {
    return { ok: false, ticker: sym, execution_date: exec, error: 'Could not bracket execution date with bars' };
  }

  const expectedCloseRatio = 1 / factor;
  const closeRatio =
    before.close > 0 && onOrAfter.close > 0 ? onOrAfter.close / before.close : null;
  const adjRatio =
    before.adjClose > 0 && onOrAfter.adjClose > 0 ? onOrAfter.adjClose / before.adjClose : null;

  const closeOk =
    closeRatio != null && Math.abs(closeRatio - expectedCloseRatio) <= Math.max(TOLERANCE, expectedCloseRatio * TOLERANCE);
  const adjOk = adjRatio != null && Math.abs(adjRatio - 1) <= TOLERANCE;

  return {
    ok: closeOk && adjOk,
    ticker: sym,
    execution_date: exec,
    ratio_factor: factor,
    expected_close_ratio: expectedCloseRatio,
    close_ratio: closeRatio,
    adj_close_ratio: adjRatio,
    close_ok: closeOk,
    adj_close_ok: adjOk,
    before_bar: { date: before.date, close: before.close, adj_close: before.adjClose },
    after_bar: { date: onOrAfter.date, close: onOrAfter.close, adj_close: onOrAfter.adjClose },
    tolerance: TOLERANCE
  };
}

module.exports = { validateAdjCloseAroundSplit };
