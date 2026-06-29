// Latest Odin signal bucket per ticker (BigQuery signals table — same source as ohlc-signals-indicator).

const bigquery = require('../../config/bigquery');
const { makeCacheKey, getCache, setCache } = require('../../utils/cache');

const OHLC_SIGNALS_TABLE_FQN =
  process.env.OHLC_SIGNALS_TABLE_FQN || '`extended-byway-454621-s6.sp500data1.Test`';

const VALID_BUCKETS = new Set(['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N']);

const SIGNALS_LOOKBACK_DAYS = Math.min(
  Math.max(Number(process.env.PAPER_SIGNALS_LOOKBACK_DAYS || 21), 7),
  90
);
const LATEST_SIGNALS_CACHE_TTL_SECS = Number(process.env.PAPER_LATEST_SIGNALS_CACHE_TTL_SECS || 120);
const SIGNALS_BQ_CHUNK_SIZE = Math.min(Math.max(Number(process.env.PAPER_SIGNALS_BQ_CHUNK_SIZE || 200), 50), 500);

/** @type {Map<string, Promise<Map<string, string>>>} */
const inflightByCacheKey = new Map();

function bqCellToPlain(v) {
  if (v == null) return null;
  if (typeof v === 'object' && v.value !== undefined) return v.value;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return v;
}

function normalizeSignalBucket(sig) {
  if (sig == null || sig === '') return 'N';
  const s = String(bqCellToPlain(sig) ?? sig)
    .trim()
    .toUpperCase();
  if (!s || s === 'NULL') return 'N';
  if (VALID_BUCKETS.has(s)) return s;
  if (/^L1/.test(s)) return 'L1';
  if (/^L2/.test(s)) return 'L2';
  if (s.startsWith('L')) return 'L3';
  if (/^S1/.test(s)) return 'S1';
  if (/^S2/.test(s)) return 'S2';
  if (s.startsWith('S')) return 'S3';
  return 'N';
}

function signalSideFromBucket(bucket) {
  const k = String(bucket || 'N').toUpperCase();
  if (k === 'L1' || k === 'L2' || k === 'L3') return 'long';
  if (k === 'S1' || k === 'S2' || k === 'S3') return 'short';
  return 'neutral';
}

function normalizeTickerList(tickers) {
  return [
    ...new Set(
      (tickers || [])
        .map((t) => String(t || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ].sort();
}

function mapFromCacheObject(obj) {
  const out = new Map();
  if (!obj || typeof obj !== 'object') return out;
  for (const [sym, bucket] of Object.entries(obj)) {
    out.set(String(sym).toUpperCase(), normalizeSignalBucket(bucket));
  }
  return out;
}

function mapToCacheObject(map) {
  return Object.fromEntries(map);
}

/**
 * @param {string[]} tickers
 * @returns {Promise<Map<string, string>>}
 */
async function queryLatestSignalsChunk(tickers) {
  const uniq = normalizeTickerList(tickers);
  const out = new Map();
  if (!uniq.length) return out;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - SIGNALS_LOOKBACK_DAYS);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const query = `
    WITH ranked AS (
      SELECT
        \`Ticker\` AS ticker,
        \`Signal\` AS sig,
        ROW_NUMBER() OVER (PARTITION BY \`Ticker\` ORDER BY \`Date\` DESC) AS rn
      FROM ${OHLC_SIGNALS_TABLE_FQN}
      WHERE \`Ticker\` IN UNNEST(@tickers)
        AND \`Date\` BETWEEN @start AND @end
    )
    SELECT ticker, sig FROM ranked WHERE rn = 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { tickers: uniq, start: startStr, end: endStr }
  });

  for (const row of rows || []) {
    const sym = String(row.ticker || bqCellToPlain(row.ticker) || '')
      .trim()
      .toUpperCase();
    if (!sym) continue;
    out.set(sym, normalizeSignalBucket(row.sig));
  }
  return out;
}

/**
 * Latest Odin bucket per ticker (BigQuery; cached in Redis, chunked for large lists).
 * @param {string[]} tickers
 * @returns {Promise<Map<string, string>>}
 */
async function getLatestSignalsForTickers(tickers) {
  const uniq = normalizeTickerList(tickers);
  const out = new Map();
  if (!uniq.length) return out;

  const cacheKey = makeCacheKey('paper:latest-signals:v2', {
    symbols: uniq,
    lookbackDays: SIGNALS_LOOKBACK_DAYS
  });

  const cached = await getCache(cacheKey);
  if (cached) {
    return mapFromCacheObject(cached);
  }

  if (inflightByCacheKey.has(cacheKey)) {
    return inflightByCacheKey.get(cacheKey);
  }

  const work = (async () => {
    const merged = new Map();
    const chunks = [];
    for (let i = 0; i < uniq.length; i += SIGNALS_BQ_CHUNK_SIZE) {
      chunks.push(uniq.slice(i, i + SIGNALS_BQ_CHUNK_SIZE));
    }

    const chunkMaps = await Promise.all(chunks.map((chunk) => queryLatestSignalsChunk(chunk)));
    for (const m of chunkMaps) {
      for (const [sym, bucket] of m) merged.set(sym, bucket);
    }

    await setCache(cacheKey, mapToCacheObject(merged), LATEST_SIGNALS_CACHE_TTL_SECS);
    return merged;
  })();

  inflightByCacheKey.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflightByCacheKey.delete(cacheKey);
  }
}

/**
 * @param {string} ticker
 * @returns {Promise<string|null>} L1|S1|N etc., or null if unavailable
 */
async function getLatestSignalBucket(ticker) {
  const map = await getLatestSignalsForTickers([ticker]);
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  return map.get(sym) ?? null;
}

module.exports = {
  getLatestSignalBucket,
  getLatestSignalsForTickers,
  normalizeSignalBucket,
  signalSideFromBucket,
  VALID_BUCKETS,
  SIGNALS_LOOKBACK_DAYS,
  LATEST_SIGNALS_CACHE_TTL_SECS
};
